// Starts the system under test the way the hosting company would.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startServer(dir, providers, extraEnv = {}) {
  const port = await freePort();
  const db = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bench-db-')), 'shop.sqlite');
  const env = { ...process.env, PORT: String(port), DATABASE_PATH: db, PAYMENT_PROVIDER_URL: providers.urlA, PAYMENT_PROVIDER_B_URL: providers.urlB };
  delete env.PAYMENT_PROVIDER;
  Object.assign(env, extraEnv);
  let log = '';
  const child = spawn('npm', ['start'], { cwd: dir, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (c) => (log = (log + c).slice(-4000)));
  child.stderr.on('data', (c) => (log = (log + c).slice(-4000)));
  let exited = false;
  child.on('exit', () => (exited = true));
  const base = `http://127.0.0.1:${port}`;
  const healthy = async () => { try { const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) }); return r.status === 200; } catch { return false; } };
  const stop = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } fs.rmSync(path.dirname(db), { recursive: true, force: true }); };
  for (let i = 0; i < 120 && !exited; i++) { if (await healthy()) return { base, healthy, stop, up: true, log: () => log }; await sleep(250); }
  stop();
  return { up: false, stop() {}, healthy: async () => false, log: () => log };
}
