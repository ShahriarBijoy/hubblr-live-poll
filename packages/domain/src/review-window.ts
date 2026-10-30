import { z } from "zod";

export const MIN_DURATION_SEC = 60;
export const MAX_DURATION_SEC = 86_400;

export const DurationSec = z.int().multipleOf(60).min(MIN_DURATION_SEC).max(MAX_DURATION_SEC);
export type DurationSec = z.infer<typeof DurationSec>;
