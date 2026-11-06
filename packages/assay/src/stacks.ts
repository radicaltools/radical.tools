// ─── Radical Assay: units of every stack ─────────────────────────────────────
//
// Each reader finds the units of its stack anywhere in the repository and
// the dependencies each manifest states: npm, Maven, Gradle, Go, .NET,
// Python, VB6, and a folder with only a Dockerfile. A reference by path (a
// .NET ProjectReference, a VB6 project reference, a Gradle project(':x'))
// names its unit at once; a reference by name is resolved when the units of
// every repository are known (link.ts).

import { basename } from 'node:path'
import type { DependencyFact, GroupFact, Stack, Unit } from './facts'
import { RepoFiles, TEST_FILE, dirOf, escapeRe, lineAt, lineOf, resolveFrom } from './files'

export interface StackUnits {
  units: Unit[]
  dependencies: DependencyFact[]
  groups: GroupFact[]
  notes: string[]
}

/** Frameworks and runtimes worth naming as a unit's technology, by what its manifest depends on. */
const TECHNOLOGY: Array<[RegExp, string]> = [
  [/^react$/, 'React'], [/^vue$/, 'Vue'], [/^svelte$/, 'Svelte'], [/^@angular\/core$/, 'Angular'],
  [/^next$/, 'Next.js'], [/^nuxt$/, 'Nuxt'], [/^express$/, 'Express'], [/^fastify$/, 'Fastify'], [/^koa$/, 'Koa'],
  [/^@nestjs\/core$/, 'NestJS'], [/^hono$/, 'Hono'], [/^electron$/, 'Electron'], [/^vite$/, 'Vite'],
  [/^@modelcontextprotocol\/(server|sdk)$/, 'MCP'], [/^graphql$/, 'GraphQL'], [/^(@prisma\/client|prisma)$/, 'Prisma'],
  [/^typeorm$/, 'TypeORM'], [/^sequelize$/, 'Sequelize'], [/^mongoose$/, 'MongoDB'], [/^pg$/, 'PostgreSQL'],
  [/^mysql2?$/, 'MySQL'], [/^(redis|ioredis)$/, 'Redis'], [/^kafkajs$/, 'Kafka'], [/^amqplib$/, 'RabbitMQ'],
  [/^typescript$/, 'TypeScript'], [/^@grpc\/grpc-js$|^google\.golang\.org\/grpc$|^grpcio$|^Grpc\.|^io\.grpc:/, 'gRPC'],
  [/spring-boot-starter-web$|spring-boot-starter-webflux$/, 'Spring Boot'], [/spring-cloud-starter-gateway/, 'Spring Cloud Gateway'],
  [/spring-cloud-starter-netflix-eureka-server/, 'Eureka'], [/spring-cloud-config-server/, 'Spring Cloud Config'],
  [/spring-boot-starter-data-jpa/, 'JPA'], [/^Microsoft\.AspNetCore|^Microsoft\.NET\.Sdk\.Web$/, 'ASP.NET Core'],
  [/^Microsoft\.EntityFrameworkCore/, 'Entity Framework Core'], [/^Microsoft\.AspNetCore\.Components\.WebAssembly/, 'Blazor'],
  [/^(flask|Flask)$/, 'Flask'], [/^(django|Django)$/, 'Django'], [/^fastapi$/, 'FastAPI'],
  [/^github\.com\/gin-gonic\/gin$/, 'Gin'], [/^github\.com\/gorilla\/mux$/, 'gorilla/mux'],
  [/Microsoft ActiveX Data Objects|^msado/i, 'ADO'], [/Microsoft DAO/i, 'DAO'],
]

const technologyOf = (names: string[]): string[] =>
  [...new Set(names.flatMap((d) => TECHNOLOGY.filter(([re]) => re.test(d)).map(([, name]) => name)))].sort()

/** Java's entry point: a Spring Boot application or a main method, in the unit's own sources. */
function javaMain(files: RepoFiles, path: string): string | null {
  const prefix = path === '.' ? '' : `${path}/`
  for (const f of files.list) {
    if (!f.startsWith(`${prefix}src/main/`) || !/\.(java|kt)$/.test(f)) continue
    const text = files.read(f)
    if (/@SpringBootApplication\b/.test(text)) return 'it has a Spring Boot application class'
    if (/\bpublic\s+static\s+void\s+main\s*\(|^\s*fun\s+main\s*\(/m.test(text)) return 'it has a main method'
  }
  return null
}

/** A unit that checks others, by its name or folder. */
const TESTS = /(^|[-_./\s])(e2e|tests?|specs?|integration-tests?|unittests?)([-_./\s]|$)/i

/** Manifests inside a test's or fixture's folder belong to the tests, not the system. */
const inTests = (file: string): boolean => /(^|\/)(tests?|__tests__|fixtures?|testdata|examples?|samples?)\//i.test(file)
/** A test's data: other repositories' sources, of any stack. */
const inFixtures = (file: string): boolean => /(^|\/)(fixtures?|__fixtures__|testdata)\//i.test(file)

interface Draft {
  path: string
  stack: Stack
  name: string
  /** True when a manifest names it (else the folder does): only such a name links a dependency. */
  named: boolean
  aliases: string[]
  reasons: string[]
  tests: boolean
  deps: string[]
  description?: string
  evidence: { file: string; line: number }
  /** Dependencies by path: the dependency's text, the unit folder or manifest it names, its line. */
  refs: Array<{ name: string; path: string; line: number; file: string }>
  depLines: Map<string, { file: string; line: number }>
}

function draft(stack: Stack, path: string, file: string, name: string | undefined, line: number): Draft {
  return { path, stack, name: name || basename(path === '.' ? '' : path) || '.', named: !!name, aliases: [], reasons: [], tests: false, deps: [], evidence: { file, line }, refs: [], depLines: new Map() }
}

// ── npm ──────────────────────────────────────────────────────────────────────

function npm(files: RepoFiles, notes: string[]): Draft[] {
  const manifests = files.named(/^package\.json$/).filter((f) => !inTests(f))
  const out: Draft[] = []
  for (const file of manifests) {
    const text = files.read(file)
    let json: Record<string, unknown>
    try {
      json = JSON.parse(text) as Record<string, unknown>
      if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('not an object')
    } catch (error) {
      notes.push(`${file} does not parse: ${(error as Error).message}`)
      continue
    }
    const path = dirOf(file)
    // A root that names workspaces is their shell, when they are there.
    if (path === '.' && json.workspaces && manifests.length > 1) continue
    if (path === '.' && files.has('pnpm-workspace.yaml') && manifests.length > 1) continue
    const d = draft('npm', path, file, typeof json.name === 'string' ? json.name : undefined, lineOf(text, /"name"\s*:/))
    const scripts = (json.scripts && typeof json.scripts === 'object' ? json.scripts : {}) as Record<string, unknown>
    if (json.bin) d.reasons.push('it has a bin')
    const run = ['start', 'dev', 'serve', 'preview'].find((s) => typeof scripts[s] === 'string')
    if (run) d.reasons.push(`it has a ${run} script`)
    if (files.has(`${path === '.' ? '' : `${path}/`}index.html`)) d.reasons.push('it has an index.html')
    if ((json.engines as Record<string, unknown> | undefined)?.vscode) d.reasons.push('it is a VS Code extension')
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      const deps = json[field]
      if (!deps || typeof deps !== 'object') continue
      for (const dep of Object.keys(deps)) {
        d.deps.push(dep)
        d.depLines.set(dep, { file, line: lineOf(text, new RegExp(`"${escapeRe(dep)}"\\s*:`)) })
        if (dep === 'electron') d.reasons.push('it depends on Electron')
      }
    }
    if (typeof json.description === 'string' && json.description) d.description = json.description
    d.tests = !d.reasons.length && TESTS.test(`${d.name} ${path}`)
    out.push(d)
  }
  return out
}

// ── Maven ────────────────────────────────────────────────────────────────────

const tag = (xml: string, name: string): string | undefined => new RegExp(`<${name}>\\s*([^<]+?)\\s*</${name}>`).exec(xml)?.[1]

function maven(files: RepoFiles): Draft[] {
  const out: Draft[] = []
  for (const file of files.named(/^pom\.xml$/).filter((f) => !inTests(f))) {
    const text = files.read(file)
    const parent = /<parent>([\s\S]*?)<\/parent>/.exec(text)?.[1] ?? ''
    // The project's own coordinates: outside <parent>, <dependencies>, <build> and <profiles>.
    const own = text.replace(/<parent>[\s\S]*?<\/parent>|<dependencies>[\s\S]*?<\/dependencies>|<dependencyManagement>[\s\S]*?<\/dependencyManagement>|<build>[\s\S]*?<\/build>|<profiles>[\s\S]*?<\/profiles>/g, '')
    const artifactId = tag(own, 'artifactId')
    if (!artifactId) continue
    const groupId = tag(own, 'groupId') ?? tag(parent, 'groupId') ?? ''
    const packaging = tag(own, 'packaging') ?? 'jar'
    // An aggregator (packaging pom) holds modules; it is no unit itself.
    if (packaging === 'pom') continue
    const path = dirOf(file)
    const d = draft('maven', path, file, groupId ? `${groupId}:${artifactId}` : artifactId, lineOf(text, `<artifactId>${artifactId}</artifactId>`))
    d.aliases.push(artifactId)
    if (/spring-boot-maven-plugin/.test(text)) d.reasons.push('it builds with the Spring Boot plugin')
    if (packaging === 'war') d.reasons.push('it is packaged as a war')
    const main = javaMain(files, path)
    if (main) d.reasons.push(main)
    for (const m of text.matchAll(/<dependency>\s*([\s\S]*?)<\/dependency>/g)) {
      const g = tag(m[1], 'groupId')
      const a = tag(m[1], 'artifactId')
      if (!a) continue
      const dep = g ? `${g}:${a}` : a
      d.deps.push(dep)
      d.depLines.set(dep, { file, line: lineAt(text, m.index! + m[0].indexOf(a)) })
    }
    const description = tag(own, 'description')
    if (description) d.description = description
    d.tests = !d.reasons.length && TESTS.test(`${artifactId} ${path}`)
    out.push(d)
  }
  return out
}

// ── Gradle ───────────────────────────────────────────────────────────────────

function gradle(files: RepoFiles): Draft[] {
  const out: Draft[] = []
  for (const file of files.named(/^build\.gradle(\.kts)?$/).filter((f) => !inTests(f))) {
    const text = files.read(file)
    const path = dirOf(file)
    const settings = files.read(`${path === '.' ? '' : `${path}/`}settings.gradle`) || files.read(`${path === '.' ? '' : `${path}/`}settings.gradle.kts`)
    // A root build that only includes projects is their shell.
    if (path === '.' && /\binclude\b/.test(settings) && !/\b(implementation|api|compile)\b/.test(text)) continue
    const rootName = /rootProject\.name\s*=\s*['"]([^'"]+)['"]/.exec(settings)?.[1]
    const d = draft('gradle', path, file, path === '.' ? rootName : undefined, 1)
    if (/\b(application|org\.springframework\.boot)\b/.test(text)) d.reasons.push('it applies the application or Spring Boot plugin')
    const main = javaMain(files, path)
    if (main) d.reasons.push(main)
    for (const m of text.matchAll(/\b(?:implementation|api|compile|runtimeOnly|testImplementation)\s*\(?\s*project\(\s*['"]:?([^'"]+)['"]\s*\)/g)) {
      d.refs.push({ name: `:${m[1]}`, path: m[1].replace(/:/g, '/'), line: lineAt(text, m.index!), file })
    }
    for (const m of text.matchAll(/\b(?:implementation|api|compile|runtimeOnly)\s*\(?\s*['"]([\w.-]+):([\w.-]+)(?::[^'"]*)?['"]/g)) {
      const dep = `${m[1]}:${m[2]}`
      d.deps.push(dep)
      d.depLines.set(dep, { file, line: lineAt(text, m.index!) })
    }
    d.tests = !d.reasons.length && TESTS.test(path)
    out.push(d)
  }
  return out
}

// ── Go ───────────────────────────────────────────────────────────────────────

function go(files: RepoFiles): Draft[] {
  const out: Draft[] = []
  for (const file of files.named(/^go\.mod$/).filter((f) => !inTests(f))) {
    const text = files.read(file)
    const module = /^module\s+(\S+)/m.exec(text)?.[1]
    const path = dirOf(file)
    const prefix = path === '.' ? '' : `${path}/`
    // Its main packages are its apps; a module without one is a library.
    const mains = [...new Set(files.list
      .filter((f) => f.startsWith(prefix) && f.endsWith('.go') && !f.endsWith('_test.go') && /^package main\b/m.test(files.read(f)))
      .map(dirOf))]
      .filter((dir) => !files.list.some((f) => f !== file && f.endsWith('/go.mod') && dir.startsWith(dirOf(f) + '/') && dirOf(f).length > path.length))
    const requires = [...text.matchAll(/^\s*(?:require\s+)?([a-z0-9.-]+\.[a-z]{2,}\/\S+)\s+v[\d.]+/gm)].map((m) => ({ dep: m[1], line: lineAt(text, m.index!) }))
    const at = mains.length === 1 ? [mains[0]] : mains.length ? mains : [path]
    for (const dir of at) {
      const d = draft('go', dir, file, module ? (dir === path ? module : `${module}/${dir.slice(prefix.length)}`) : undefined, lineOf(text, /^module\s/m))
      if (mains.includes(dir)) d.reasons.push('it has a main package')
      d.aliases.push(basename(dir === '.' ? (module ?? '') : dir))
      for (const r of requires) { d.deps.push(r.dep); d.depLines.set(r.dep, { file, line: r.line }) }
      out.push(d)
    }
  }
  return out
}

/** Go before modules (GOPATH, glide, dep): a folder whose .go files are a main package, with no go.mod above it. */
function goWithoutModules(files: RepoFiles): Draft[] {
  const modules = files.named(/^go\.mod$/).map(dirOf)
  const mains = [...new Set(files.list.filter((f) => f.endsWith('.go') && !f.endsWith('_test.go') && !inTests(f) && !/(^|\/)vendor\//.test(f) && /^package main\b/m.test(files.read(f))).map(dirOf))]
    .filter((dir) => !modules.some((m) => m === '.' || dir === m || dir.startsWith(`${m}/`)))
  // cmd/<name> is the app of the folder above cmd/.
  return mains.map((dir) => {
    const path = /^cmd(\/[^/]+)?$/.test(dir) ? '.' : dir.replace(/\/cmd(\/[^/]+)?$/, '')
    const marker = ['glide.yaml', 'Gopkg.toml', 'vendor/vendor.json'].map((m) => `${path === '.' ? '' : `${path}/`}${m}`).find((m) => files.has(m))
    const d = draft('go', path, marker ?? files.list.find((f) => dirOf(f) === dir && f.endsWith('.go'))!, undefined, 1)
    d.reasons.push('it has a main package')
    d.aliases.push(basename(path === '.' ? files.root : path))
    return d
  })
}

// ── .NET ─────────────────────────────────────────────────────────────────────

function dotnet(files: RepoFiles, groups: GroupFact[], repo: string): Draft[] {
  const out: Draft[] = []
  for (const file of files.named(/\.(cs|fs|vb)proj$/i).filter((f) => !inFixtures(f))) {
    const text = files.read(file)
    const name = /<AssemblyName>([^<]+)<\/AssemblyName>/.exec(text)?.[1] ?? basename(file).replace(/\.(cs|fs|vb)proj$/i, '')
    const path = dirOf(file)
    const d = draft('dotnet', path, file, name, 1)
    const sdk = /<Project\s+Sdk="([^"]+)"/.exec(text)?.[1] ?? ''
    if (/Microsoft\.NET\.Sdk\.(Web|Worker|BlazorWebAssembly)/.test(sdk)) d.reasons.push(`it uses the ${sdk.replace('Microsoft.NET.Sdk.', '')} SDK`)
    if (/<OutputType>\s*(Exe|WinExe)\s*<\/OutputType>/i.test(text)) d.reasons.push('its output is an executable')
    for (const m of text.matchAll(/<ProjectReference\s+Include="([^"]+)"/g)) {
      const target = resolveFrom(path, m[1])
      if (target) d.refs.push({ name: basename(m[1].replace(/\\/g, '/')).replace(/\.(cs|fs|vb)proj$/i, ''), path: target, line: lineAt(text, m.index!), file })
    }
    for (const m of text.matchAll(/<PackageReference\s+Include="([^"]+)"/g)) {
      d.deps.push(m[1])
      d.depLines.set(m[1], { file, line: lineAt(text, m.index!) })
    }
    if (sdk) d.deps.push(sdk)
    d.tests = /Microsoft\.NET\.Test\.Sdk|xunit|NUnit|MSTest/.test(text) || (!d.reasons.length && TESTS.test(name))
    if (d.tests) d.reasons = []
    out.push(d)
  }
  for (const file of files.named(/\.sln$/i).filter((f) => !inFixtures(f))) {
    const text = files.read(file)
    const projects = [...text.matchAll(/^Project\("[^"]+"\)\s*=\s*"([^"]+)",\s*"([^"]+\.(?:cs|fs|vb)proj)"/gm)]
    if (!projects.length) continue
    groups.push({
      id: `${repo}:group:${file}`, name: basename(file).replace(/\.sln$/i, ''),
      units: projects.map((p) => resolveFrom(dirOf(file), dirOf(p[2].replace(/\\/g, '/'))) ?? '').filter(Boolean).map((p) => `${repo}:unit:${p}`),
      evidence: { file, line: lineOf(text, /^Project\(/m) },
    })
  }
  return out
}

// ── Python ───────────────────────────────────────────────────────────────────

function python(files: RepoFiles): Draft[] {
  const out: Draft[] = []
  const markers = files.named(/^(pyproject\.toml|setup\.py|requirements\.txt|Pipfile)$/).filter((f) => !inTests(f))
  for (const path of [...new Set(markers.map(dirOf))]) {
    const prefix = path === '.' ? '' : `${path}/`
    const pyproject = files.read(`${prefix}pyproject.toml`)
    const setup = files.read(`${prefix}setup.py`)
    const name = /^\s*name\s*=\s*["']([^"']+)["']/m.exec(pyproject)?.[1] ?? /\bname\s*=\s*["']([^"']+)["']/.exec(setup)?.[1]
    const evidenceFile = markers.find((m) => dirOf(m) === path)!
    const d = draft('python', path, evidenceFile, name, 1)
    d.aliases.push(basename(path === '.' ? '' : path))
    const entry = ['main.py', 'app.py', 'server.py', 'manage.py', 'wsgi.py', '__main__.py'].find((f) => files.has(`${prefix}${f}`))
    if (entry) d.reasons.push(`it has ${entry}`)
    else if (files.list.some((f) => f.startsWith(prefix) && f.endsWith('.py') && !f.slice(prefix.length).includes('/') && /if __name__ == ['"]__main__['"]/.test(files.read(f)))) d.reasons.push('it has a __main__ block')
    const requirements = files.read(`${prefix}requirements.txt`)
    for (const [i, line] of requirements.split('\n').entries()) {
      const dep = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(line)?.[1]
      if (dep && !line.trim().startsWith('#') && !line.trim().startsWith('-')) { d.deps.push(dep); d.depLines.set(dep, { file: `${prefix}requirements.txt`, line: i + 1 }) }
    }
    d.tests = !d.reasons.length && TESTS.test(`${d.name} ${path}`)
    out.push(d)
  }
  return out
}

// ── VB6 ──────────────────────────────────────────────────────────────────────

/** A .vbp's key=value lines (a key may repeat), with their lines. */
function ini(text: string): Array<{ key: string; value: string; line: number }> {
  return text.split(/\r?\n/).map((l, i) => {
    const at = l.indexOf('=')
    return at > 0 ? { key: l.slice(0, at).trim(), value: l.slice(at + 1).trim(), line: i + 1 } : null
  }).filter((x): x is { key: string; value: string; line: number } => !!x)
}

const unquote = (s: string): string => s.replace(/^"(.*)"$/, '$1')

function vb6(files: RepoFiles, groups: GroupFact[], repo: string): Draft[] {
  const out: Draft[] = []
  const projects = files.named(/\.vbp$/i).filter((f) => !inFixtures(f))
  // Two projects of one name in one folder (CorLib.vbp and CorLib.Build.vbp) are one unit: the shorter file wins.
  const chosen = new Map<string, string>()
  for (const file of projects) {
    const name = unquote(ini(files.read(file)).find((e) => e.key === 'Name')?.value ?? basename(file).replace(/\.vbp$/i, ''))
    const key = `${dirOf(file)}|${name.toLowerCase()}`
    const prev = chosen.get(key)
    if (!prev || basename(file).length < basename(prev).length) chosen.set(key, file)
  }
  for (const file of chosen.values()) {
    const entries = ini(files.read(file))
    const get = (k: string) => entries.find((e) => e.key === k)
    const type = get('Type')?.value ?? 'Exe'
    const name = unquote(get('Name')?.value ?? basename(file).replace(/\.vbp$/i, ''))
    const path = dirOf(file)
    const d = draft('vb6', path, file, name, get('Name')?.line ?? 1)
    const exe = unquote(get('ExeName32')?.value ?? '')
    if (exe) d.aliases.push(exe)
    d.aliases.push(basename(file))
    if (type === 'Exe') d.reasons.push('it is a VB6 Standard EXE')
    else if (type === 'OleExe') d.reasons.push('it is a VB6 ActiveX EXE')
    d.tests = TESTS.test(name) || TESTS.test(basename(file))
    if (d.tests) d.reasons = []
    for (const e of entries) {
      if (e.key === 'Reference') {
        // *\A<path to a .vbp>: another project of the group; *\G{guid}#ver#lcid#<file>#<description>: a COM library.
        const project = /^\*\\A(.+\.vbp)$/i.exec(e.value)
        if (project) {
          const target = resolveFrom(path, project[1])
          if (target) d.refs.push({ name: basename(project[1].replace(/\\/g, '/')), path: target, line: e.line, file })
          continue
        }
        const parts = e.value.split('#')
        const library = (parts[4] ?? '').trim() || basename((parts[3] ?? '').replace(/\\/g, '/'))
        const binary = basename((parts[3] ?? '').replace(/\\/g, '/'))
        if (library) { d.deps.push(library); d.depLines.set(library, { file, line: e.line }) }
        if (binary && binary !== library) { d.deps.push(binary); d.depLines.set(binary, { file, line: e.line }) }
      } else if (e.key === 'Object') {
        const ocx = e.value.split(';').pop()?.trim()
        if (ocx) { d.deps.push(ocx); d.depLines.set(ocx, { file, line: e.line }) }
      }
    }
    if (entries.some((e) => /^(Form|UserControl)$/.test(e.key))) d.reasons.push('it has forms')
    if (type !== 'Exe' && type !== 'OleExe') d.reasons = d.reasons.filter((r) => r !== 'it has forms')
    d.description = { Exe: 'VB6 Standard EXE', OleExe: 'VB6 ActiveX EXE', OleDll: 'VB6 ActiveX DLL', Control: 'VB6 ActiveX Control (OCX)' }[type] ?? `VB6 ${type}`
    out.push(d)
  }
  for (const file of files.named(/\.vbg$/i).filter((f) => !inFixtures(f))) {
    const text = files.read(file)
    const members = ini(text).filter((e) => e.key === 'Project' || e.key === 'StartupProject').map((e) => resolveFrom(dirOf(file), e.value)).filter((p): p is string => !!p)
    if (!members.length) continue
    groups.push({ id: `${repo}:group:${file}`, name: basename(file).replace(/\.vbg$/i, ''), units: [...new Set(members.map((m) => `${repo}:unit:${dirOf(m)}`))], evidence: { file, line: 1 } })
  }
  return out
}

// ── Docker ───────────────────────────────────────────────────────────────────

/** A folder with a Dockerfile no manifest claims runs something: an app in the language its base image names. */
function docker(files: RepoFiles, claimed: Set<string>): Draft[] {
  const out: Draft[] = []
  for (const file of files.named(/^Dockerfile$/).filter((f) => !inTests(f))) {
    const path = dirOf(file)
    if (claimed.has(path)) continue
    // docker/<name>/Dockerfile below a unit packages that unit.
    if ([...claimed].some((c) => (c === '.' || path.startsWith(`${c}/`)) && /(^|\/)(docker|\.docker|deploy|build|packaging|container)(\/|$)/i.test(c === '.' ? path : path.slice(c.length + 1)))) continue
    // A Dockerfile alone in its folder builds what other folders hold.
    const prefix = path === '.' ? '' : `${path}/`
    if (!files.list.some((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes('/') && !/^(Dockerfile|\.dockerignore|README(\.md)?)$/i.test(f.slice(prefix.length)))) continue
    const text = files.read(file)
    const d = draft('docker', path, file, undefined, lineOf(text, /^FROM\s/mi))
    d.reasons.push('it has a Dockerfile')
    const images = [...text.matchAll(/^FROM\s+(\S+)/gmi)].map((m) => m[1].toLowerCase())
    d.deps.push(...images)
    out.push(d)
  }
  return out
}

const BASE_IMAGES: Array<[RegExp, string]> = [
  [/^(node|.*\/node)[:@]?/, 'Node.js'], [/python/, 'Python'], [/golang|^go:/, 'Go'], [/openjdk|temurin|eclipse-temurin|amazoncorretto|maven|gradle/, 'Java'],
  [/dotnet|aspnet/, '.NET'], [/nginx/, 'nginx'], [/ruby/, 'Ruby'], [/php/, 'PHP'],
]

/** Every unit of every stack in the repository, with the dependencies their manifests state. */
export function readStacks(files: RepoFiles, repo: string): StackUnits {
  const notes: string[] = []
  const groups: GroupFact[] = []
  const drafts = [...npm(files, notes), ...maven(files), ...gradle(files), ...go(files), ...goWithoutModules(files), ...dotnet(files, groups, repo), ...python(files), ...vb6(files, groups, repo)]
  // One unit per folder: the first stack read claims it (a Python folder with a package.json for its tooling stays npm).
  const byPath = new Map<string, Draft>()
  for (const d of drafts) if (!byPath.has(d.path)) byPath.set(d.path, d)
  for (const d of docker(files, new Set(byPath.keys()))) byPath.set(d.path, d)

  const units: Unit[] = []
  const dependencies: DependencyFact[] = []
  for (const d of [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    const prefix = d.path === '.' ? '' : `${d.path}/`
    if (files.has(`${prefix}Dockerfile`) && !d.reasons.includes('it has a Dockerfile')) d.reasons.push('it has a Dockerfile')
    const technology = new Set(technologyOf(d.deps))
    if (d.stack === 'docker') for (const img of d.deps) for (const [re, t] of BASE_IMAGES) if (re.test(img)) technology.add(t)
    technology.add({ npm: 'Node.js', maven: 'Java', gradle: 'Java', go: 'Go', dotnet: '.NET', python: 'Python', vb6: 'VB6', docker: '' }[d.stack])
    technology.delete('')
    const id = `${repo}:unit:${d.path}`
    units.push({
      id, name: d.name, ...(d.aliases.length ? { aliases: [...new Set(d.aliases.filter((a) => a && a !== d.name))] } : {}),
      path: d.path, stack: d.stack,
      kind: d.tests ? 'tests' : d.reasons.length ? 'app' : 'library',
      why: d.tests ? 'it checks other units' : d.reasons.length ? [...new Set(d.reasons)].join(', ') : 'nothing in its manifest runs it',
      technology: [...technology].sort(),
      ...(d.description ? { description: d.description } : {}),
      ...(d.named ? {} : { named: false }),
      evidence: d.evidence,
    })
    if (d.stack === 'docker') continue
    for (const dep of [...new Set(d.deps)].sort()) {
      dependencies.push({ id: `${repo}:dep:${d.path}:${dep}`, unit: id, package: dep, evidence: d.depLines.get(dep) ?? d.evidence })
    }
    for (const r of d.refs) {
      // A path names a unit's folder, or its manifest (a .vbp or .csproj) in it.
      const folder = byPath.has(r.path) ? r.path : dirOf(r.path)
      const target = byPath.has(folder) ? `${repo}:unit:${folder}` : undefined
      if (!target) notes.push(`${r.file}:${r.line} references ${r.path}, which is no unit of the repository`)
      dependencies.push({ id: `${repo}:dep:${d.path}:${r.name}`, unit: id, package: r.name, ...(target ? { target } : {}), evidence: { file: r.file, line: r.line } })
    }
  }
  return { units, dependencies, groups, notes }
}

export { TEST_FILE }
