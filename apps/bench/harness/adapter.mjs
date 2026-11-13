// Has a separate session write the adapter between the test interface and
// the API one system designed for itself. The session sees the system and
// the interface, never the tests.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cleanEnv } from './po.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ADAPTER_MODEL = 'claude-sonnet-5-5';

const prompt = (step, hasPrevious) => `You are writing a test adapter for a shop back end. Work only in the current folder.

- \`kit/interface.md\` describes the test interface and the rules for an adapter. Read it first and follow it exactly.
- \`system/\` holds the back end, already installed and built. Its API is documented in \`system/docs/openapi.yaml\`; read the code where the documentation is missing or unclear. Do not change anything in \`system/\`.
- Write \`./adapter.mjs\`: every function of the interface from step 0 through step ${step}.${hasPrevious ? '\n- `./adapter.mjs` already holds the adapter of the previous step. The system has changed since: check every function against the current API and bring the file up to date.' : ''}
- Check it with \`node kit/check.mjs ${step}\`${step >= 7 ? ` (and \`node kit/check.mjs ${step} b\`, which starts the system with the second payment provider)` : ''}. It starts the system and reports where the adapter's answers have the wrong shape. Repeat until what is left is caused by the system itself.

The adapter is plumbing: it must show the system as it is. Do not work around a fault or a missing feature of the system, and do not make the system look better or worse than it is. When the system cannot do something at all, return \`http.unsupported()\` for it.

End with a short list: functions you returned unsupported for, and problems the check still reports with the cause of each.`;

export function writeAdapter({ prepared, step, previous, outFile, logFile }) {
  return new Promise((resolve) => {
    const dir = prepared.dir;
    fs.cpSync(path.join(here, 'kit'), path.join(dir, 'kit'), { recursive: true });
    const target = path.join(dir, 'adapter.mjs');
    if (previous && fs.existsSync(previous)) fs.copyFileSync(previous, target);
    const child = spawn('claude', ['-p', prompt(step, fs.existsSync(target)), '--model', ADAPTER_MODEL, '--output-format', 'json', '--permission-mode', 'auto',
      '--strict-mcp-config', '--setting-sources', 'project', '--no-session-persistence'], { cwd: dir, env: cleanEnv(), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let timedOut = false;
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', () => {});
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, 25 * 60_000);
    child.on('close', () => {
      clearTimeout(timer);
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* nothing left */ }
      let r = {};
      try { r = JSON.parse(out); } catch { /* no result */ }
      const written = fs.existsSync(target);
      if (written) fs.copyFileSync(target, outFile);
      const info = { written, timedOut, costUsd: r.total_cost_usd ?? null, turns: r.num_turns ?? null, notes: typeof r.result === 'string' ? r.result.slice(0, 4000) : null };
      if (logFile) fs.writeFileSync(logFile, JSON.stringify(info, null, 2));
      resolve(info);
    });
  });
}
