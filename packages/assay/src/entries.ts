// ─── Radical Assay: where the code is entered ────────────────────────────────
//
// The entry points of a unit's code, where a process's steps start (ADR
// Assay writes the domain, processes and lifecycles it reads): the HTTP
// routes its code declares (Express, Koa, Fastify, Hono, NestJS, Spring,
// ASP.NET Core, Flask, FastAPI, Go), a VB6 application's forms, menu items
// and command buttons with their captions and Click handlers, scheduled jobs
// and message handlers. Each with its file and line.

import { extname } from 'node:path'
import type { EntryFact, Unit } from './facts'
import { GENERATED, RepoFiles, TEST_FILE, lineAt, owner } from './files'
import { withoutVbComments } from './code'

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|java|kt|cs|py|go|frm|bas|cls)$/i
/** A server framework a JavaScript file uses: only there is app.get('/x', …) a route, not a call. */
const JS_SERVER = /\b(?:require\(\s*|from\s+)['"](?:express|koa-router|@koa\/router|fastify|hono|restify)['"]/
const JS_SERVER_TECH = /^(Express|Fastify|Koa|Hono)$/
const METHODS = 'get|post|put|patch|delete|all'

const joinPath = (base: string, path: string): string => {
  const joined = `/${[base, path].map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')}`
  return joined.replace(/\/+/g, '/')
}

/** A VB6 caption as the user sees it: & marks the access key, && is an ampersand. */
const caption = (text: string): string => text.replace(/""/g, '"').replace(/&&/g, '\u0000').replace(/&/g, '').replace(/\u0000/g, '&').trim()

/** The routes, forms, jobs and handlers of the repository's units. */
export function readEntries(files: RepoFiles, repo: string, units: Unit[]): EntryFact[] {
  const out: EntryFact[] = []
  const seen = new Set<string>()
  const add = (unit: Unit, kind: EntryFact['kind'], name: string, rest: Partial<EntryFact> & { evidence: EntryFact['evidence'] }): void => {
    const key = `${kind}:${rest.form ? `${rest.form}.` : ''}${name}${kind === 'route' ? '' : rest.detail ? `:${rest.detail}` : ''}`
    const id = `${repo}:entry:${unit.path}:${key}`
    if (seen.has(id)) return
    seen.add(id)
    out.push({ id, unit: unit.id, kind, name, ...rest })
  }
  // The Case of a Select that calls each VB procedure: the message a packet handler handles.
  let cases: Map<string, string> | undefined
  const vbCases = (): Map<string, string> => {
    if (cases) return cases
    cases = new Map()
    for (const f of files.list.filter((x) => /\.(bas|cls|frm)$/i.test(x))) {
      let label: string | undefined
      for (const line of withoutVbComments(files.read(f)).split(/\r?\n/)) {
        // Case X, the call on its own line or after a colon on the same one.
        const c = /^\s*Case\s+([^:]+?)\s*(?::(.*))?$/i.exec(line)
        if (c && !/^else$/i.test(c[1])) label = c[1].trim()
        if (/^\s*End\s+Select\b/i.test(line)) { label = undefined; continue }
        const call = label && /^\s*(?:Call\s+)?(Handle\w+)\b/i.exec(c ? c[2] ?? '' : line)
        if (call && !cases.has(call[1].toLowerCase())) cases.set(call[1].toLowerCase(), label!)
      }
    }
    return cases
  }
  for (const file of files.list) {
    if (!SOURCE.test(file) || TEST_FILE.test(file) || GENERATED.test(file)) continue
    const unit = owner(units, file)
    if (!unit) continue
    const raw = files.read(file)
    if (!raw) continue
    const ext = extname(file).toLowerCase()
    const at = (index: number) => ({ file, line: lineAt(raw, index) })
    const route = (method: string, path: string, index: number): void => {
      const name = `${method.toUpperCase()} ${path || '/'}`
      add(unit, 'route', name, { detail: path || '/', evidence: at(index) })
    }

    if (ext === '.frm') { vbForm(withoutVbComments(raw), file, unit, add) }
    if (ext === '.frm' || ext === '.bas' || ext === '.cls') { vbHandlers(withoutVbComments(raw), file, unit, add, vbCases()); continue }

    if (/^\.[cm]?[jt]sx?$/.test(ext)) {
      if (JS_SERVER.test(raw) || unit.technology.some((t) => JS_SERVER_TECH.test(t))) {
        // app.get('/orders', handler): the path, then a handler, not a request's options.
        for (const m of raw.matchAll(new RegExp(`\\b\\w+\\.(${METHODS})\\(\\s*(['"\`])(\\/[^'"\`]*)\\2\\s*,(?!\\s*\\{)`, 'g'))) route(m[1] === 'all' ? 'ALL' : m[1], m[3], m.index!)
        for (const m of raw.matchAll(/\b\w+\.route\(\s*(['"`])(\/[^'"`]*)\1\s*\)((?:\s*\.(?:get|post|put|patch|delete)\([^)]*\))+)/g)) {
          for (const verb of m[3].matchAll(/\.(get|post|put|patch|delete)\(/g)) route(verb[1], m[2], m.index!)
        }
      }
      // NestJS: @Controller('orders') and @Get(':id').
      const controller = /@Controller\(\s*(?:['"]([^'"]*)['"])?\s*\)/.exec(raw)
      if (controller) {
        for (const m of raw.matchAll(/@(Get|Post|Put|Patch|Delete|All)\(\s*(?:['"]([^'"]*)['"])?\s*\)/g)) route(m[1], joinPath(controller[1] ?? '', m[2] ?? ''), m.index!)
      }
      for (const m of raw.matchAll(/@(EventPattern|MessagePattern)\(\s*['"]([^'"]+)['"]/g)) add(unit, 'handler', methodAfter(raw, m.index!) ?? m[1], { detail: m[2], evidence: at(m.index!) })
      for (const m of raw.matchAll(/\bcron\.schedule\(\s*['"]([^'"]+)['"]|\bnew\s+CronJob\(\s*['"]([^'"]+)['"]/g)) add(unit, 'job', 'cron', { detail: m[1] ?? m[2], evidence: at(m.index!) })
      for (const m of raw.matchAll(/\.consume\(\s*['"]([^'"]+)['"]|\.subscribe\(\s*\{\s*topics?\s*:\s*\[?\s*['"]([^'"]+)['"]/g)) add(unit, 'handler', 'consume', { detail: m[1] ?? m[2], evidence: at(m.index!) })
    }

    if (ext === '.java' || ext === '.kt') {
      const base = /@RequestMapping\(\s*(?:(?:value|path)\s*=\s*)?\{?\s*"([^"]*)"[^)]*\)\s*(?:@\w+(?:\([^)]*\))?\s*)*(?:public\s+|open\s+|internal\s+)?(?:final\s+)?class\b/.exec(raw)?.[1] ?? ''
      for (const m of raw.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping\b(?:\(\s*(?:(?:value|path)\s*=\s*)?\{?\s*(?:"([^"]*)")?[^)]*\))?/g)) route(m[1], joinPath(base, m[2] ?? ''), m.index!)
      for (const m of raw.matchAll(/@RequestMapping\(([^)]*method\s*=\s*\{?\s*RequestMethod\.(\w+)[^)]*)\)/g)) {
        route(m[2], joinPath(base, /(?:value|path)\s*=\s*\{?\s*"([^"]*)"/.exec(m[1])?.[1] ?? /^\s*"([^"]*)"/.exec(m[1])?.[1] ?? ''), m.index!)
      }
      for (const m of raw.matchAll(/@Scheduled\(([^)]*)\)/g)) add(unit, 'job', methodAfter(raw, m.index!) ?? 'scheduled', { detail: m[1].trim(), evidence: at(m.index!) })
      for (const m of raw.matchAll(/@(KafkaListener|RabbitListener|JmsListener|SqsListener)\(([^)]*)\)/g)) {
        const target = /(?:topics|queues|destination|value)\s*=\s*\{?\s*"([^"]+)"/.exec(m[2])?.[1] ?? /^\s*\{?\s*"([^"]+)"/.exec(m[2])?.[1]
        add(unit, 'handler', methodAfter(raw, m.index!) ?? m[1], { ...(target ? { detail: target } : {}), evidence: at(m.index!) })
      }
    }

    if (ext === '.cs') {
      for (const cls of raw.matchAll(/((?:\[[^\]]*\]\s*)*)(?:public\s+)?(?:sealed\s+|partial\s+|abstract\s+)*class\s+(\w+)/g)) {
        const name = cls[2]
        const template = /\[Route\(\s*"([^"]*)"\s*\)\]/.exec(cls[1])?.[1]
        if (!template && !/Controller(Base)?\b/.test(raw.slice(cls.index!, cls.index! + cls[0].length + 80))) continue
        const base = (template ?? '').replace(/\[controller\]/gi, name.replace(/Controller$/, '').toLowerCase())
        const end = raw.indexOf('\nclass ', cls.index! + 1)
        const body = raw.slice(cls.index!, end < 0 ? undefined : end)
        for (const m of body.matchAll(/\[Http(Get|Post|Put|Patch|Delete)(?:\(\s*"([^"]*)"\s*\))?\]/g)) route(m[1], joinPath(base, m[2] ?? ''), cls.index! + m.index!)
      }
      for (const m of raw.matchAll(/\.Map(Get|Post|Put|Patch|Delete)\(\s*"([^"]*)"/g)) route(m[1], m[2], m.index!)
      for (const m of raw.matchAll(/\bRecurringJob\.AddOrUpdate(?:<\w+>)?\(\s*"([^"]+)"|\[TimerTrigger\(\s*"([^"]+)"/g)) add(unit, 'job', methodAfter(raw, m.index!) ?? 'recurring', { detail: m[1] ?? m[2], evidence: at(m.index!) })
      for (const m of raw.matchAll(/\bIConsumer<(\w+)>|\[ServiceBusTrigger\(\s*"([^"]+)"/g)) add(unit, 'handler', m[1] ? `consume ${m[1]}` : methodAfter(raw, m.index!) ?? 'handler', { ...(m[2] ? { detail: m[2] } : {}), evidence: at(m.index!) })
    }

    if (ext === '.py') {
      for (const m of raw.matchAll(/@\w+\.route\(\s*['"]([^'"]+)['"]([^)]*)\)/g)) {
        const methods = /methods\s*=\s*[[(]([^\])]*)/.exec(m[2])?.[1]
        for (const method of methods ? [...methods.matchAll(/['"](\w+)['"]/g)].map((x) => x[1]) : ['GET']) route(method, m[1], m.index!)
      }
      for (const m of raw.matchAll(/@\w+\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) route(m[1], m[2], m.index!)
      for (const m of raw.matchAll(/@\w+\.scheduled_job\(([^)]*)\)|\bschedule\.every\(([^)]*)\)/g)) add(unit, 'job', methodAfter(raw, m.index!) ?? 'scheduled', { detail: (m[1] ?? m[2] ?? '').trim(), evidence: at(m.index!) })
    }

    if (ext === '.go') {
      for (const m of raw.matchAll(/\b(?:HandleFunc|Handle)\(\s*"((?:[A-Z]+\s+)?\/[^"]*)"/g)) {
        const [method, path] = /^[A-Z]+\s/.test(m[1]) ? m[1].split(/\s+/) : ['ANY', m[1]]
        route(method, path, m.index!)
      }
      for (const m of raw.matchAll(/\.(GET|POST|PUT|PATCH|DELETE|Get|Post|Put|Patch|Delete)\(\s*"(\/[^"]*)"/g)) route(m[1], m[2], m.index!)
    }
  }
  return out
}

/** The name of the method declared next after `index`: what an annotation is on. */
function methodAfter(text: string, index: number): string | undefined {
  const rest = text.slice(index, index + 600)
  return /(?:\bvoid|\bfun|\bdef|\basync\s+\w+|\bpublic\s+[\w<>]+|\bTask)\s+(\w+)\s*\(/.exec(rest)?.[1] ?? /^\s*(?:async\s+)?(\w+)\s*\(/m.exec(rest.slice(rest.indexOf(')') + 1))?.[1]
}

/** A VB6 form: its caption, its menu items and command buttons with their captions and Click handlers. */
function vbForm(text: string, file: string, unit: Unit, add: (unit: Unit, kind: EntryFact['kind'], name: string, rest: Partial<EntryFact> & { evidence: EntryFact['evidence'] }) => void): void {
  const form = /^\s*Begin\s+VB\.(?:Form|MDIForm)\s+(\w+)/m.exec(text)
  if (!form) return
  const formName = form[1]
  const lines = text.split('\n')
  const lineOfIndex = (i: number) => ({ file, line: i + 1 })
  const handler = (name: string, event = 'Click'): EntryFact['evidence'] | undefined => {
    const re = new RegExp(`^\\s*(?:Private\\s+|Public\\s+)?Sub\\s+${name}_${event}\\s*\\(`, 'i')
    const i = lines.findIndex((l) => re.test(l))
    return i < 0 ? undefined : lineOfIndex(i)
  }
  // The form's own properties come before its first nested Begin.
  let depth = 0
  let formCaption: string | undefined
  const items: Array<[EntryFact['kind'], string, Partial<EntryFact> & { evidence: EntryFact['evidence'] }]> = []
  const stack: Array<{ kind: string; name: string; line: number; caption?: string; index?: string; interval?: string }> = []
  lines.forEach((line, i) => {
    const begin = /^\s*Begin\s+([\w.]+)\s+(\w+)/.exec(line)
    if (begin) {
      depth++
      stack.push({ kind: begin[1], name: begin[2], line: i })
      return
    }
    if (/^\s*End\s*$/.test(line)) {
      const block = stack.pop()
      depth--
      if (!block) return
      const name = block.index !== undefined ? `${block.name}(${block.index})` : block.name
      if (/^VB\.Timer$/i.test(block.kind)) {
        // A timer runs its handler every Interval milliseconds (0: until the code sets one).
        const ticks = handler(block.name, 'Timer')
        if (ticks) items.push(['job', name, { form: formName, detail: Number(block.interval) ? `every ${block.interval} ms` : 'interval set by the code', evidence: lineOfIndex(block.line), handler: ticks }])
        return
      }
      const click = handler(block.name)
      // A menu item; a button of any library, or any control the user clicks (an image, a label) that has a Click handler.
      const kind = /^VB\.Menu$/i.test(block.kind) ? 'menu' : /button/i.test(block.kind) || click ? 'control' : undefined
      // A menu captioned - is a separator.
      if (kind === 'menu' && (!block.caption || block.caption === '-')) return
      if (kind && (block.caption || click)) items.push([kind, name, { form: formName, ...(block.caption ? { detail: block.caption } : {}), evidence: lineOfIndex(block.line), ...(click ? { handler: click } : {}) }])
      return
    }
    const top = stack[stack.length - 1]
    if (!top) return
    // Custom button libraries keep the caption in TX.
    const cap = /^\s*(?:Caption|TX)\s*=\s*"((?:[^"]|"")*)"/.exec(line)
    if (cap && top.caption === undefined) top.caption = caption(cap[1])
    const interval = /^\s*Interval\s*=\s*(\d+)/.exec(line)
    if (interval) top.interval = interval[1]
    const index = /^\s*Index\s*=\s*(\d+)/.exec(line)
    if (index) top.index = index[1]
    if (cap && depth === 1 && formCaption === undefined) formCaption = caption(cap[1])
  })
  const load = lines.findIndex((l) => /^\s*(?:Private\s+|Public\s+)?Sub\s+(?:Form|MDIForm)_Load\s*\(/i.test(l))
  add(unit, 'form', formName, { ...(formCaption ? { detail: formCaption } : {}), evidence: { file, line: lineAt(text, form.index! + form[0].indexOf('Begin')) }, ...(load >= 0 ? { handler: lineOfIndex(load) } : {}) })
  for (const [kind, name, rest] of items) add(unit, kind, name, rest)
}

/** A VB module's packet or message handlers: Sub Handle… procedures, each with the Case of the Select that calls it. */
function vbHandlers(text: string, file: string, unit: Unit, add: (unit: Unit, kind: EntryFact['kind'], name: string, rest: Partial<EntryFact> & { evidence: EntryFact['evidence'] }) => void, cases: Map<string, string>): void {
  text.split('\n').forEach((line, i) => {
    const sub = /^\s*(?:(?:Public|Private|Friend)\s+)?Sub\s+(Handle\w+)\s*\(/i.exec(line)
    if (!sub) return
    const label = cases.get(sub[1].toLowerCase())
    add(unit, 'handler', sub[1], { ...(label ? { detail: label } : {}), evidence: { file, line: i + 1 } })
  })
}
