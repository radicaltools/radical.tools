// The simulated product owner: an MCP server over HTTP with one tool,
// ask_product_owner. Each question is answered by a separate model session
// that holds the hidden specification up to the current step.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const PO_MODEL = 'claude-sonnet-5-5';
export const PO_LIMIT = 25;

const prompt = (short) => `You speak for the people at Zielony Kubek, a small online shop: Marta (owner), Kasia (warehouse), Tomek (accounting), Piotr (sales), Ola (marketing), Jan (customer service), and the security and data protection consultants they hired. A developer is building the shop's back end and asks you questions.

How you answer:
- Answer from what is written below and from nothing else. Be brief and concrete: the rule, the numbers, who wants it.
- Answer the question that was asked, fully for its subject. A question about one area ("how should payments that fail be handled?", "does accounting need anything from stock?") gets everything you know about that area. Do not bring up other areas.
${short ? `- You only have your notes of the last few conversations with the developer in front of you; what was agreed before that you no longer remember, and the people who agreed it are not here. When what is written below does not settle the matter, answer: "I do not have that in front of me. If it was agreed earlier, go by what is already built and written down; otherwise it is your choice." For what is listed below as not decided, answer: "Not decided, your choice."` : `- When what is written below does not settle the matter, answer: "Not decided, your choice."`}
- When the developer describes a concrete case (a situation, what is done, what comes out) and asks whether it is right, say yes or no by what is written below. When it is not right, say what must come out in that case. Say nothing about cases that were not asked about. When what is written below does not settle the case, say so as for any other question.
- When a question asks for everything at once (all requirements, all rules, anything else you should know), answer that you do not know where to start and ask the developer to pick an area.
- You are not technical. How the API, the code or the database look is the developer's choice, except where a standing requirement below says otherwise. You do not review designs or code.
- Never mention these notes as a document, their headings, the R and HD identifiers, tests, or that anything is being held back. Speak as the people concerned would.

What you know:
`;

export function cleanEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_|CLAUDE_AGENT_|MCP_)/.test(k)) delete env[k];
  return env;
}

function ask(spec, question, short) {
  return new Promise((resolve) => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'po-'));
    const child = spawn('claude', ['-p', question, '--model', PO_MODEL, '--system-prompt', prompt(short) + spec, '--tools', '',
      '--strict-mcp-config', '--no-session-persistence', '--setting-sources', 'project', '--output-format', 'json'],
    { cwd, env: cleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    const timer = setTimeout(() => child.kill('SIGKILL'), 180_000);
    child.on('close', () => {
      clearTimeout(timer);
      fs.rmSync(cwd, { recursive: true, force: true });
      try {
        const r = JSON.parse(out);
        resolve({ answer: String(r.result ?? '').trim() || 'Not decided, your choice.', costUsd: r.total_cost_usd ?? 0 });
      } catch {
        resolve({ answer: 'The product owner is not available right now; decide yourself.', costUsd: 0, error: (err || out).slice(0, 500) });
      }
    });
  });
}

// memory: how many steps back the product owner knows, the current one included; 0 for all of them.
export async function startPO({ hiddenDir, logFile, memory = 0, standards = false }) {
  const po = { step: 0, asked: 0, url: '' };
  // With a short memory a trap step is known by the wish of who asks only (hidden-forget), not by the standing requirement.
  const forget = `${hiddenDir}-forget`;
  const group = standards ? fs.readFileSync(path.join(hiddenDir, 'standards.md'), 'utf8') + '\n\n' : '';
  const spec = () => group + fs.readdirSync(hiddenDir).filter((f) => /^\d+\.md$/.test(f) && Number(f.slice(0, 2)) <= po.step && (!memory || Number(f.slice(0, 2)) > po.step - memory)).sort()
    .map((f) => fs.readFileSync(memory && fs.existsSync(path.join(forget, f)) ? path.join(forget, f) : path.join(hiddenDir, f), 'utf8')).join('\n\n');

  const tool = {
    name: 'ask_product_owner',
    description: 'Ask the product owner one specific question about a business rule of the system. Returns the answer as text.',
    inputSchema: { type: 'object', properties: { question: { type: 'string', description: 'One specific question' } }, required: ['question'] },
  };

  async function handle(msg) {
    if (msg.id === undefined) return null; // a notification
    const ok = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
    if (msg.method === 'initialize') return ok({ protocolVersion: msg.params?.protocolVersion ?? '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'product-owner', version: '1.0.0' } });
    if (msg.method === 'ping') return ok({});
    if (msg.method === 'tools/list') return ok({ tools: [tool] });
    if (msg.method === 'tools/call') {
      const question = String(msg.params?.arguments?.question ?? '').trim();
      if (!question) return ok({ content: [{ type: 'text', text: 'Ask a question.' }], isError: true });
      if (po.asked >= PO_LIMIT) return ok({ content: [{ type: 'text', text: 'The product owner has no more time in this session; decide yourself.' }] });
      po.asked += 1;
      const r = await ask(spec(), question, memory > 0);
      fs.appendFileSync(logFile, JSON.stringify({ step: po.step, n: po.asked, question, ...r, at: new Date().toISOString() }) + '\n');
      return ok({ content: [{ type: 'text', text: r.answer }] });
    }
    return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } };
  }

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); return res.end(); }
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', async () => {
      let body;
      try { body = JSON.parse(s); } catch { res.writeHead(400); return res.end(); }
      const list = Array.isArray(body) ? body : [body];
      const out = (await Promise.all(list.map(handle))).filter(Boolean);
      if (!out.length) { res.writeHead(202); return res.end(); }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(Array.isArray(body) ? out : out[0]));
    });
  });
  server.requestTimeout = 0;
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  po.url = `http://127.0.0.1:${server.address().port}/mcp`;
  po.close = () => { server.close(); server.closeAllConnections?.(); };
  return po;
}
