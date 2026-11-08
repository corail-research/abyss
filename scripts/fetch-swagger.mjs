import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.VITE_ABYSS_API_URL ?? 'http://localhost:5555';
const specUrl =
    process.env.ABYSS_SWAGGER_URL ??
    `${baseUrl.replace(/\/+$/, '')}/swagger.json`;
const output = path.resolve(process.cwd(), 'swagger.json');

console.log(`→ GET ${specUrl}`);

let response;
try {
    response = await fetch(specUrl, { headers: { Accept: 'application/json' } });
} catch (error) {
    console.error(`✖ Backend unreachable: ${specUrl}`);
    console.error(`  ${error.cause?.code ?? error.message}`);
    console.error('  Start the Flask stack (run.py), then run the command again.');
    process.exit(1);
}

if (!response.ok) {
    console.error(`✖ HTTP ${response.status} ${response.statusText}: ${specUrl}`);
    process.exit(1);
}

const spec = await response.json().catch(() => null);
if (!spec?.swagger && !spec?.openapi) {
    console.error(`✖ ${specUrl} does not return a valid OpenAPI/Swagger specification.`);
    process.exit(1);
}

await writeFile(output, JSON.stringify(spec, null, 2) + '\n');
console.log(
    `✔ ${Object.keys(spec.paths ?? {}).length} routes → ${path.relative(process.cwd(), output)}`
);
