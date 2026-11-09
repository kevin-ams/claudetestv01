import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Base de datos local (PGlite) nueva en una carpeta temporal; nunca la de Netlify.
process.env.EOS_FORCE_LOCAL_DB = "1";
process.env.EOS_DATA_DIR ??= mkdtempSync(path.join(tmpdir(), "eos-test-"));
