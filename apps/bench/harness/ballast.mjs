// Makes the ballast text that shrinks the window of every session by a fixed amount.
// node harness/ballast.mjs 30k [characters per token, default 2.17]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const size = process.argv[2] ?? '30k';
const tokens = Number(size.replace('k', '')) * 1000;
const perToken = Number(process.argv[3] ?? 2.17);
let seed = 20261112;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed; };
const lines = ['# Hosting environment: diagnostic dump', '', 'The hosting environment keeps this dump loaded in every session. It is not part of the client\'s request and says nothing about the system to build. Ignore it.', ''];
let n = 0; let chars = lines.join('\n').length;
while (chars < tokens * perToken) {
  n += 1;
  const line = `diag ${String(n).padStart(5, '0')}: node ${(rnd() % 4096).toString(16).padStart(3, '0')} probe ${(rnd() % 65536).toString(16).padStart(4, '0')} value ${(rnd() % 100000) / 1000} state nominal`;
  lines.push(line); chars += line.length + 1;
}
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), `ballast-${size}.txt`);
fs.writeFileSync(file, lines.join('\n') + '\n');
console.log(`${file}: ${chars} characters, ${n} lines`);
