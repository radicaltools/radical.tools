// radical harden --gate interrupted with Ctrl+C (SIGINT to the process group,
// as a terminal sends it) while the test runs "without the fix": is the fix
// put back, as the README says ("the working tree is left as it was")?
// Usage: node f1-harden-ctrlc.mjs [signal=SIGINT]
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLI } from './root.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const cli = CLI
const signal = process.argv[2] ?? 'SIGINT'
const repo = join(process.cwd(), 'tmp-f1-repo')
rmSync(repo, { recursive: true, force: true })
mkdirSync(join(repo, 'src'), { recursive: true }); mkdirSync(join(repo, 'tests'))
writeFileSync(join(repo, 'src/fix.mjs'), 'export const ok = false\n')
writeFileSync(join(repo, 'tests/t.mjs'), "import { ok } from '../src/fix.mjs'\nawait new Promise((r) => setTimeout(r, 4000))\nprocess.exit(ok ? 0 : 1)\n")
writeFileSync(join(repo, 'crucible.json'), JSON.stringify({ findings: 'crucible/findings', fuzz: [], runners: [{ files: 'tests/', command: ['node', '{file}'] }] }))
writeFileSync(join(repo, 'package.json'), '{"name":"f1","type":"module"}\n')
const sh = (c) => execSync(c, { cwd: repo, encoding: 'utf8' })
sh('git init -q -b main . && git add -A && git -c user.email=a@b -c user.name=t commit -qm base')
writeFileSync(join(repo, 'src/fix.mjs'), 'export const ok = true // the fix\n')
writeFileSync(join(repo, 'src/helper.mjs'), 'export const helper = 1 // a new file of the fix, not committed yet\n')
console.log('before:', readFileSync(join(repo, 'src/fix.mjs'), 'utf8').trim())

const child = spawn('node', [cli, 'harden', '--gate', '--test', 'tests/t.mjs › x', '--runs', '1'], { cwd: repo, detached: true })
let out = ''
child.stdout.on('data', (d) => { out += d })
child.stderr.on('data', (d) => { out += d })
await new Promise((r) => { const t = setInterval(() => { if (out.includes('Gate for')) { clearInterval(t); r() } }, 50) })
await new Promise((r) => setTimeout(r, 1000)) // the test "without the fix" is running
console.log(`sending ${signal} to the process group (as Ctrl+C does)`)
process.kill(-child.pid, signal)
const code = await new Promise((r) => child.on('close', (c, s) => r(c ?? s)))
await new Promise((r) => setTimeout(r, 500))
console.log('radical harden ended:', code)
console.log(out.trim().split('\n').map((l) => '  | ' + l).join('\n'))
const after = readFileSync(join(repo, 'src/fix.mjs'), 'utf8').trim()
console.log('after: ', after)
console.log('git status:', sh('git status --short --untracked-files=all').trim() || '(clean: the fix is gone)')
const helperKept = existsSync(join(repo, 'src/helper.mjs'))
console.log('src/helper.mjs (new, untracked) still there:', helperKept)
// The gate's copy of the fix is left in the temp folder: name it, then tidy it.
const tmp = process.env.TMPDIR ?? '/tmp'
const left = execSync(`grep -l "the fix" ${join(tmp, 'radical-harden-')}*/src/*.mjs 2>/dev/null || true`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
console.log('the fix survives only in:', left.join(', ') || '(nowhere)')
for (const f of new Set(left.map((f) => dirname(dirname(f))))) rmSync(f, { recursive: true, force: true })
rmSync(repo, { recursive: true, force: true })
if (after.includes('the fix') && helperKept) { console.log('OK: the fix is back'); process.exit(0) }
console.log('BUG: the working tree lost the fix after the interrupt'); process.exit(1)
