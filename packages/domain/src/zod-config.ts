import { z } from "zod";

// Zod probes `new Function` when it builds its first object schema. Workers forbid eval, and the web app's CSP
// blocks it, so the browser reports the probe as a policy violation even though Zod catches the error.
z.config({ jitless: true });
