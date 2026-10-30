declare namespace Cloudflare {
	interface Env {
		// Test-only binding from vitest.config.ts.
		TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
	}
}
