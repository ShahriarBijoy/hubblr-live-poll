import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Setup files can run more than once; applyD1Migrations skips migrations it already applied.
await applyD1Migrations(env.KPI_DB, env.TEST_MIGRATIONS);
