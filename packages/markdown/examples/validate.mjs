import { readFile } from 'node:fs/promises';
import { createValidator } from '@radical/markdown';

const schema = JSON.parse(await readFile(new URL('x.schema.json', import.meta.url), 'utf8'));
const validate = createValidator({ x: schema });

for (const name of ['valid.md', 'invalid.md']) {
  const text = await readFile(new URL(name, import.meta.url), 'utf8');
  const diagnostics = validate({ uri: name, text });
  console.log(`${name}: ${diagnostics.length} diagnostic(s)`);
  for (const diagnostic of diagnostics) {
    console.log(`  ${diagnostic.code}: ${diagnostic.message}`);
  }
}
