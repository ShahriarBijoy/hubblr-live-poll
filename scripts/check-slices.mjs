import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const SOURCE_ROOTS = ["apps/web/src", "packages/domain/src"];
const SLICES = "apps/web/src/slices/";
const ROUTES = "apps/web/src/routes/";
const DOMAIN_SRC = "packages/domain/src/";
const DOMAIN_PACKAGE = "packages/domain/";
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

// Static imports and re-exports are anchored to a line start so prose in comments rarely matches.
const IMPORT_PATTERNS = [
	/^[ \t]*(?:import|export)\b[^'";]*?\bfrom[ \t]*(['"])([^'"\r\n]+)\1/gm,
	/^[ \t]*import[ \t]*(['"])([^'"\r\n]+)\1/gm,
	/\bimport[ \t]*\(\s*(['"])([^'"\r\n]+)\1/g,
];

function parseImports(source) {
	const imports = [];
	for (const pattern of IMPORT_PATTERNS) {
		for (const match of source.matchAll(pattern)) {
			const specifier = match[2];
			const offset = match.index + match[0].length - 1 - specifier.length;
			const line = source.slice(0, offset).split("\n").length;
			imports.push({ line, specifier });
		}
	}
	return imports.sort((a, b) => a.line - b.line);
}

function resolveRelative(file, specifier) {
	return specifier.startsWith(".") ? path.posix.join(path.posix.dirname(file), specifier) : null;
}

function sliceOfPath(repoPath) {
	return repoPath.startsWith(SLICES) ? repoPath.slice(SLICES.length).split("/")[0] : null;
}

// A bare specifier reaches a slice only through an alias (@/, ~/, #, src/...), so match the path segment.
function importedSlice(file, specifier) {
	const target = resolveRelative(file, specifier);
	if (target !== null) return sliceOfPath(target);
	return /(?:^|\/)slices\/([^/]+)/.exec(specifier)?.[1] ?? null;
}

const RULES = [
	{
		id: "no-cross-slice-import",
		appliesTo: (file) => sliceOfPath(file) !== null,
		check(file, imports) {
			const ownSlice = sliceOfPath(file);
			return imports.filter(({ specifier }) => {
				const slice = importedSlice(file, specifier);
				return slice !== null && slice !== ownSlice;
			});
		},
	},
	{
		id: "domain-imports-zod-or-domain-only",
		appliesTo: (file) => file.startsWith(DOMAIN_SRC),
		check(file, imports) {
			return imports.filter(({ specifier }) => {
				const target = resolveRelative(file, specifier);
				if (target !== null) return !target.startsWith(DOMAIN_PACKAGE);
				if (specifier === "vitest" && TEST_FILE.test(file)) return false;
				return specifier !== "zod" && !specifier.startsWith("zod/");
			});
		},
	},
	{
		id: "route-imports-one-slice",
		appliesTo: (file) => file.startsWith(ROUTES),
		check(file, imports) {
			let firstSlice = null;
			return imports.filter(({ specifier }) => {
				const slice = importedSlice(file, specifier);
				if (slice === null) return false;
				firstSlice ??= slice;
				return slice !== firstSlice;
			});
		},
	},
];

function listSourceFiles(sourceRoot) {
	const absoluteRoot = path.join(repoRoot, sourceRoot);
	if (!existsSync(absoluteRoot)) {
		throw new Error(`check:slices expected the source folder ${sourceRoot} to exist.`);
	}
	return readdirSync(absoluteRoot, { recursive: true })
		.map((entry) => `${sourceRoot}/${entry.split(path.sep).join("/")}`)
		.filter((file) => SOURCE_FILE.test(file) && !file.split("/").includes("node_modules"));
}

const files = SOURCE_ROOTS.flatMap(listSourceFiles);
const violations = [];
for (const file of files) {
	const rules = RULES.filter((rule) => rule.appliesTo(file));
	if (rules.length === 0) continue;
	const imports = parseImports(readFileSync(path.join(repoRoot, file), "utf8"));
	for (const rule of rules) {
		for (const { line, specifier } of rule.check(file, imports)) {
			violations.push(`${file}:${line} ${rule.id} (imports "${specifier}")`);
		}
	}
}

if (violations.length > 0) {
	console.error(violations.join("\n"));
	console.error(`check:slices failed with ${violations.length} violation(s) in ${files.length} files.`);
	process.exitCode = 1;
} else {
	console.log(`check:slices OK: ${files.length} files, ${RULES.length} rules, 0 violations.`);
}
