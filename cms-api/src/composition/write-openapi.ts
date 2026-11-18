// Writes the committed copy of the specification. Usage: pnpm openapi:generate
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOpenApiDocument } from './openapi/build-document.js';

const target = join(import.meta.dirname, '..', '..', 'openapi.json');
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
