import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// wrangler reads local secrets from apps/web/.dev.vars, which git ignores. This gives a fresh checkout a random
// VOTER_SECRET and leaves an existing one alone, so voter cookies survive a restart of `pnpm dev`.
const MIN_SECRET_LENGTH = 32;
const devVarsPath = path.resolve(import.meta.dirname, "../apps/web/.dev.vars");

const text = existsSync(devVarsPath) ? readFileSync(devVarsPath, "utf8") : "";
const lines = text.split(/\r?\n/).filter((line) => line !== "");
const secretLine = /^VOTER_SECRET=(.*)$/;
const current = lines.map((line) => secretLine.exec(line)?.[1]).find((value) => value !== undefined);

if (current !== undefined && current.length >= MIN_SECRET_LENGTH) {
	console.log("ensure-dev-vars: VOTER_SECRET is set in apps/web/.dev.vars.");
} else {
	const secret = randomBytes(32).toString("base64url");
	const kept = lines.filter((line) => !secretLine.test(line));
	writeFileSync(devVarsPath, [...kept, `VOTER_SECRET=${secret}`, ""].join("\n"));
	console.log("ensure-dev-vars: wrote a new random VOTER_SECRET to apps/web/.dev.vars.");
}
