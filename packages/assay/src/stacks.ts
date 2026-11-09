// ─── Radical Assay: units of every stack ─────────────────────────────────────
//
// Each reader finds the units of its stack anywhere in the repository and
// the dependencies each manifest states: npm, Maven, Gradle, Go, .NET,
// Python, PHP, Ruby, Elixir, Rust, VB6, and a folder with only a
// Dockerfile. A reference by path (a .NET ProjectReference, a VB6 project
// reference, a Gradle project(':x'), a gem, mix or Cargo path dependency)
// names its unit at once; a reference by name is resolved when the units of
// every repository are known (link.ts).

import { load } from './yaml'
import { basename } from 'node:path'
import type { DependencyFact, GroupFact, Stack, TestFramework, Unit } from './facts'
import { RepoFiles, TEST_FILE, dirOf, escapeRe, lineAt, lineOf, resolveFrom } from './files'
import { buildReferences } from './msbuild'

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
  [/^laravel\/framework$/, 'Laravel'], [/^symfony\/framework-bundle$/, 'Symfony'],
  [/^rails$/, 'Rails'], [/^sinatra$/, 'Sinatra'], [/^phoenix$/, 'Phoenix'], [/^ecto_sql$/, 'Ecto'], [/^actix-web$/, 'Actix Web'], [/^axum$/, 'Axum'], [/^sqlx$/, 'SQLx'],
  [/^github\.com\/gin-gonic\/gin$/, 'Gin'], [/^github\.com\/gorilla\/mux$/, 'gorilla/mux'],
  [/Microsoft ActiveX Data Objects|^msado/i, 'ADO'], [/Microsoft DAO/i, 'DAO'], [/DirectX|^dx\d+vb/i, 'DirectX'],
  [/Winsock|^mswinsck/i, 'Winsock'],
]

/** The test frameworks a unit's dependencies name, the first that matches. */
const TEST_FRAMEWORKS: Array<[RegExp, TestFramework]> = [
  [/^vitest$/, 'vitest'], [/^jest$/, 'jest'], [/^mocha$/, 'mocha'],
  [/^org\.junit\.jupiter:|^org\.springframework\.boot:spring-boot-starter-test$/, 'junit5'], [/^junit:junit$/, 'junit4'],
  [/^pytest$/i, 'pytest'], [/^xunit(\.core|\.v3[\w.-]*)?$/i, 'xunit'], [/^NUnit$/i, 'nunit'], [/^MSTest(\.TestFramework|\.Sdk)?(\/[\d.]+)?$/i, 'mstest'],
]

/** The unit's test framework: from its dependencies, a Gradle build's test dependencies, a Python folder's pytest files. */
function testFrameworkOf(d: Draft, files: RepoFiles): TestFramework | undefined {
  const prefix_ = d.path === '.' ? '' : `${d.path}/`
  // A JVM unit's tests say which JUnit they are written in (Spring Boot's starter brought JUnit 4 before 2.2).
  if (d.stack === 'maven' || d.stack === 'gradle') {
    const tests = files.list.filter((f) => f.startsWith(`${prefix_}src/test/`) && /\.(java|kt|groovy)$/.test(f)).map((f) => files.read(f))
    if (tests.some((t) => /\borg\.junit\.jupiter\b/.test(t))) return 'junit5'
    if (tests.some((t) => /\bimport\s+org\.junit\.(Test|Assert|Before|runner)\b|@RunWith\b/.test(t))) return 'junit4'
  }
  const named = TEST_FRAMEWORKS.find(([re]) => d.deps.some((dep) => re.test(dep)))?.[1]
  if (named) return named
  const prefix = d.path === '.' ? '' : `${d.path}/`
  if (d.stack === 'gradle') {
    const build = files.read(d.evidence.file)
    if (/junit-jupiter|spring-boot-starter-test|useJUnitPlatform\(\)/.test(build)) return 'junit5'
    if (/['"]junit:junit:/.test(build)) return 'junit4'
  }
  // An npm workspace runs the tests of its packages from its root: the framework the nearest package.json above names.
  if (d.stack === 'npm') {
    for (let at = d.path; at !== '.';) {
      at = dirOf(at)
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(files.read(`${at === '.' ? '' : `${at}/`}package.json`) || '{}') } catch { continue }
      const deps = ['dependencies', 'devDependencies'].flatMap((k) => Object.keys((json[k] as Record<string, unknown> | undefined) ?? {}))
      const found = TEST_FRAMEWORKS.find(([re]) => deps.some((dep) => re.test(dep)))?.[1]
      if (found) return found
    }
  }
  if (d.stack === 'python' && (files.has(`${prefix}pytest.ini`) || files.has(`${prefix}conftest.py`) || /\[tool\.pytest/.test(files.read(`${prefix}pyproject.toml`)))) return 'pytest'
  return undefined
}

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
  /** The binary a VB6 reference names, by the library's name: what another unit's ExeName32 may be. */
  depFiles: Map<string, string>
}

function draft(stack: Stack, path: string, file: string, name: string | undefined, line: number): Draft {
  return { path, stack, name: name || basename(path === '.' ? '' : path) || '.', named: !!name, aliases: [], reasons: [], tests: false, deps: [], evidence: { file, line }, refs: [], depLines: new Map(), depFiles: new Map() }
}

// ── npm ──────────────────────────────────────────────────────────────────────

const LINT_TOOLS = /^(markdownlint(-cli2?)?|prettier|@biomejs\/biome|eslint|@eslint\/\S+|eslint-(config|plugin)-\S+|stylelint(-\S+)?|husky|lint-staged|@commitlint\/\S+|commitlint|cspell|textlint(-\S+)?|editorconfig-checker|alex|write-good)$/

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
    // A manifest of lint and format tools alone (markdownlint, Prettier, Biome) builds and runs nothing.
    const deps = ['dependencies', 'peerDependencies', 'optionalDependencies'].flatMap((k) => Object.keys((json[k] as Record<string, unknown> | undefined) ?? {}))
    const dev = Object.keys((json.devDependencies as Record<string, unknown> | undefined) ?? {})
    if (!deps.length && dev.length && dev.every((x) => LINT_TOOLS.test(x)) && !json.main && !json.bin && !json.exports && !json.workspaces) continue
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
  // An Nx workspace's project with no package.json of its own: its project.json.
  if (files.has('nx.json')) {
    for (const file of files.named(/^project\.json$/).filter((f) => !inTests(f) || /(^|\/)e2e\//.test(f))) {
      const path = dirOf(file)
      if (files.has(path === '.' ? 'package.json' : `${path}/package.json`)) continue
      const text = files.read(file)
      let json: Record<string, unknown>
      try { json = JSON.parse(text) as Record<string, unknown> } catch { continue }
      const d = draft('npm', path, file, typeof json.name === 'string' ? json.name : undefined, lineOf(text, /"name"\s*:/))
      d.tests = TESTS.test(`${d.name} ${path}`)
      if (!d.tests && json.projectType === 'application') d.reasons.push('it is an Nx application')
      out.push(d)
    }
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

/** The folder of the settings file a Gradle build in path belongs to, and its projects by type-safe accessor
 *  (include(":core:data-test") is projects.core.dataTest). */
function gradleSettings(files: RepoFiles, path: string): { root: string; accessors: Map<string, string> } | undefined {
  for (let dir = path; ; dir = dirOf(dir)) {
    const prefix = dir === '.' ? '' : `${dir}/`
    const text = files.read(`${prefix}settings.gradle.kts`) || files.read(`${prefix}settings.gradle`)
    if (text) {
      const accessors = new Map<string, string>()
      for (const m of text.matchAll(/\binclude\s*\(?((?:\s*,?\s*['"]:?[\w:.-]+['"])+)/g)) {
        for (const p of m[1].matchAll(/['"]:?([\w:.-]+)['"]/g)) {
          const camel = p[1].split(':').map((s) => s.replace(/[-_.](\w)/g, (_, c: string) => c.toUpperCase())).join('.')
          accessors.set(camel, prefix + p[1].replace(/:/g, '/'))
        }
      }
      return { root: dir, accessors }
    }
    if (dir === '.') return undefined
  }
}

/** Convention plugins of the repository's builds (gradlePlugin { plugins { register(…) { id = …; implementationClass = … } } }):
 *  each by the id or catalog accessor a build applies it with, and the projects its class adds as dependencies. */
function conventionPlugins(files: RepoFiles): Map<string, Array<{ project: string; file: string; line: number }>> {
  const out = new Map<string, Array<{ project: string; file: string; line: number }>>()
  for (const file of files.named(/^build\.gradle(\.kts)?$/)) {
    const text = files.read(file)
    for (const m of text.matchAll(/\bregister\s*\(\s*["'][^"']+["']\s*\)\s*\{([^{}]*)\}/g)) {
      const cls = /implementationClass\s*=\s*["']([\w.]+)["']/.exec(m[1])?.[1]
      const id = /\bid\s*=\s*(?:["']([\w.-]+)["']|libs\.plugins\.([\w.]+?)(?:\.asProvider\(\))?\.get\(\))/.exec(m[1])
      if (!cls || !id) continue
      const within = dirOf(file) === '.' ? '' : `${dirOf(file)}/`
      const name = new RegExp(`(^|/)${escapeRe(cls.split('.').pop()!)}\\.(kt|java|groovy)$`)
      const source = files.list.find((f) => f.startsWith(within) && name.test(f))
      if (!source) continue
      const code = files.read(source)
      const added = [...code.matchAll(/project\(\s*["']:?([\w:.-]+)["']\s*\)/g)].map((p) => ({ project: p[1], file: source, line: lineAt(code, p.index!) }))
      if (added.length) out.set(id[1] ?? `libs.plugins.${id[2]}`, added)
    }
  }
  return out
}

function gradle(files: RepoFiles): Draft[] {
  const out: Draft[] = []
  const conventions = conventionPlugins(files)
  for (const file of files.named(/^build\.gradle(\.kts)?$/).filter((f) => !inTests(f))) {
    const text = files.read(file)
    const path = dirOf(file)
    const settings = files.read(`${path === '.' ? '' : `${path}/`}settings.gradle`) || files.read(`${path === '.' ? '' : `${path}/`}settings.gradle.kts`)
    // A root build that only includes projects is their shell.
    if (path === '.' && /\binclude\b/.test(settings) && !/\b(implementation|api|compile)\b/.test(text)) continue
    const rootName = /rootProject\.name\s*=\s*['"]([^'"]+)['"]/.exec(settings)?.[1]
    const d = draft('gradle', path, file, path === '.' ? rootName : undefined, 1)
    // The application or Spring Boot plugin applied, not a Spring Boot library depended on.
    if (/\bapply\s+plugin\s*:\s*['"](application|org\.springframework\.boot|spring-boot)['"]|\bid\s*\(?\s*['"](application|org\.springframework\.boot)['"]|^\s*(application|java-application)\s*$|\balias\(\s*libs\.plugins\.[\w.]*spring[\w.]*boot\b/m.test(text)) d.reasons.push('it applies the application or Spring Boot plugin')
    const main = javaMain(files, path)
    if (main) d.reasons.push(main)
    // A project dependency in any configuration (implementation, api, testImplementation, baselineProfile, lintPublish, …):
    // project(":a:b"), or its type-safe accessor projects.a.b.
    const build = gradleSettings(files, path)
    const base = build && build.root !== '.' ? `${build.root}/` : ''
    for (const m of text.matchAll(/\b\w+\s*\(?\s*(?:project\(\s*['"]:?([^'"]+)['"]\s*\)|projects\.([\w.]+))/g)) {
      const target = m[1] ? base + m[1].replace(/:/g, '/') : build?.accessors.get(m[2])
      if (target && target !== path) d.refs.push({ name: m[1] ? `:${m[1]}` : `projects.${m[2]}`, path: target, line: lineAt(text, m.index!), file })
    }
    // The projects its convention plugins add (plugins { alias(libs.plugins.x) } or id("x")).
    const plugins = /\bplugins\s*\{([\s\S]*?)\n\s*\}/.exec(text)
    for (const m of plugins ? plugins[1].matchAll(/\b(?:alias\(\s*(libs\.plugins\.[\w.]+)\s*\)|id\(\s*["']([\w.-]+)["']\s*\))/g) : []) {
      for (const added of conventions.get(m[1] ?? m[2]) ?? []) {
        const target = base + added.project.replace(/:/g, '/')
        if (target !== path) d.refs.push({ name: `:${added.project}`, path: target, line: added.line, file: added.file })
      }
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
    // Its own Go files: none of a module nested in it (go.work's members).
    const nested = files.list.filter((f) => f !== file && f.endsWith('/go.mod') && (path === '.' || f.startsWith(prefix))).map(dirOf)
    // (A tools.go pinning tool versions, //go:build tools, is not code of the module.)
    const own = files.list.filter((f) => f.startsWith(prefix) && f.endsWith('.go') && !nested.some((n) => dirOf(f) === n || f.startsWith(`${n}/`)) && !/^\s*\/\/\s*(go:build|\+build)\s+tools\s*$/m.test(files.read(f)))
    // A module with no Go code of its own (a workspace's root, its tool directives only) builds nothing.
    if (!own.length) continue
    // Its main packages are its apps; a module without one is a library.
    const mains = [...new Set(own.filter((f) => !f.endsWith('_test.go') && /^package main\b/m.test(files.read(f))).map(dirOf))]
    // A module required through a replace directive to a folder is the unit there.
    const replaced = new Map([...text.matchAll(/^\s*(?:replace\s+)?(\S+)(?:\s+v\S+)?\s+=>\s+(\.{1,2}\/\S*)\s*$/gm)].map((m) => [m[1], resolveFrom(path, m[2].replace(/\/$/, ''))]))
    const requires = [...text.matchAll(/^\s*(?:require\s+)?([a-z0-9.-]+\.[a-z]{2,}\/\S+)\s+v[\d.]+/gm)].map((m) => ({ dep: m[1], line: lineAt(text, m.index!) }))
    const at = mains.length === 1 ? [mains[0]] : mains.length ? mains : [path]
    for (const dir of at) {
      const d = draft('go', dir, file, module ? (dir === path ? module : `${module}/${dir.slice(prefix.length)}`) : undefined, lineOf(text, /^module\s/m))
      if (mains.includes(dir)) d.reasons.push('it has a main package')
      d.aliases.push(basename(dir === '.' ? (module ?? '') : dir))
      for (const r of requires) {
        const local = replaced.get(r.dep)
        if (local) d.refs.push({ name: r.dep, path: local, line: r.line, file })
        else { d.deps.push(r.dep); d.depLines.set(r.dep, { file, line: r.line }) }
      }
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
  for (const file of files.named(/\.(cs|fs|vb|sql)proj$/i).filter((f) => !inFixtures(f))) {
    const text = files.read(file)
    const name = /<AssemblyName>([^<]+)<\/AssemblyName>/.exec(text)?.[1] ?? basename(file).replace(/\.(cs|fs|vb|sql)proj$/i, '')
    const path = dirOf(file)
    const d = draft('dotnet', path, file, name, 1)
    const sdk = /<Project\s+Sdk="([^"]+)"/.exec(text)?.[1] ?? ''
    if (/Microsoft\.NET\.Sdk\.(Web|Worker|BlazorWebAssembly)/.test(sdk)) d.reasons.push(`it uses the ${sdk.replace('Microsoft.NET.Sdk.', '')} SDK`)
    if (/<OutputType>\s*(Exe|WinExe)\s*<\/OutputType>/i.test(text)) d.reasons.push('its output is an executable')
    for (const m of text.matchAll(/<ProjectReference\s+Include="([^"]+)"/g)) {
      const target = resolveFrom(path, m[1])
      if (target) d.refs.push({ name: basename(m[1].replace(/\\/g, '/')).replace(/\.(cs|fs|vb)proj$/i, ''), path: target, line: lineAt(text, m.index!), file })
    }
    // References the Directory.Build files above it add, by their conditions on its name and path.
    for (const r of buildReferences(files, file)) if (!d.refs.some((x) => x.path === r.path)) d.refs.push(r)
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

// ── PHP ──────────────────────────────────────────────────────────────────────

/** Composer projects: an app when it is a Laravel application or has a front controller (public/index.php). */
function php(files: RepoFiles, notes: string[]): Draft[] {
  const out: Draft[] = []
  for (const file of files.named(/^composer\.json$/).filter((f) => !inTests(f))) {
    const text = files.read(file)
    let json: Record<string, unknown>
    try { json = JSON.parse(text) as Record<string, unknown> } catch (error) { notes.push(`${file} does not parse: ${(error as Error).message}`); continue }
    const path = dirOf(file)
    const prefix = path === '.' ? '' : `${path}/`
    const d = draft('php', path, file, typeof json.name === 'string' ? json.name : undefined, lineOf(text, /"name"\s*:/))
    for (const field of ['require', 'require-dev']) {
      const deps = json[field]
      if (!deps || typeof deps !== 'object') continue
      for (const dep of Object.keys(deps)) {
        d.deps.push(dep)
        d.depLines.set(dep, { file, line: lineOf(text, new RegExp(`"${escapeRe(dep)}"\\s*:`)) })
      }
    }
    if (d.deps.includes('laravel/framework') || files.has(`${prefix}artisan`)) d.reasons.push('it is a Laravel application')
    else if (files.has(`${prefix}public/index.php`) || files.has(`${prefix}index.php`)) d.reasons.push('it has a front controller')
    if (typeof json.description === 'string' && json.description) d.description = json.description
    d.tests = !d.reasons.length && TESTS.test(`${d.name} ${path}`)
    out.push(d)
  }
  return out
}

// ── Ruby, Elixir, Rust ───────────────────────────────────────────────────────

/** A Gemfile's (or a gemspec's) project: a Rails or Rack application, else a library; gems by path are references. */
function ruby(files: RepoFiles): Draft[] {
  const out: Draft[] = []
  const markers = files.named(/^Gemfile$|\.gemspec$/).filter((f) => !inTests(f))
  for (const path of [...new Set(markers.map(dirOf))]) {
    const prefix = path === '.' ? '' : `${path}/`
    const gemfile = files.read(`${prefix}Gemfile`)
    const spec = markers.find((m) => dirOf(m) === path && m.endsWith('.gemspec'))
    const name = spec ? /\.name\s*=\s*["']([^"']+)["']/.exec(files.read(spec))?.[1] : undefined
    const d = draft('ruby', path, gemfile ? `${prefix}Gemfile` : spec!, name, 1)
    d.aliases.push(basename(path === '.' ? '' : path))
    // A Rails application is known by its module (module Maybe: maybe, an image's name).
    const module = /^module\s+(\w+)/m.exec(files.read(`${prefix}config/application.rb`))?.[1]
    if (module) d.aliases.push(module.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase())
    if (files.has(`${prefix}config/application.rb`)) d.reasons.push('it is a Rails application')
    else if (files.has(`${prefix}config.ru`)) d.reasons.push('it has a Rack config.ru')
    for (const m of gemfile.matchAll(/^\s*gem\s+["']([\w.-]+)["']([^\n]*)/gm)) {
      const local = /\bpath:\s*["']([^"']+)["']/.exec(m[2])?.[1]
      const target = local ? resolveFrom(path, local) : null
      if (target) d.refs.push({ name: m[1], path: target, line: lineAt(gemfile, m.index!), file: `${prefix}Gemfile` })
      else { d.deps.push(m[1]); d.depLines.set(m[1], { file: `${prefix}Gemfile`, line: lineAt(gemfile, m.index!) }) }
    }
    d.tests = !d.reasons.length && TESTS.test(`${d.name} ${path}`)
    out.push(d)
  }
  return out
}

/** A mix.exs project: an OTP application with its own module (mod:) or a Phoenix app, else a library; an umbrella's
 *  root only holds its apps. Dependencies by path or in the umbrella are references. */
function elixir(files: RepoFiles): Draft[] {
  const out: Draft[] = []
  for (const file of files.named(/^mix\.exs$/).filter((f) => !inTests(f) && !/(^|\/)deps\//.test(f))) {
    const text = files.read(file)
    if (/\bapps_path:\s*"/.test(text)) continue
    const path = dirOf(file)
    const d = draft('elixir', path, file, /\bapp:\s*:(\w+)/.exec(text)?.[1], lineOf(text, /\bapp:\s*:/))
    d.aliases.push(basename(path === '.' ? '' : path))
    if (/\bmod:\s*\{/.test(text)) d.reasons.push('it is an OTP application with its own module')
    const deps = /\bdefp?\s+deps\b[^]*?\bdo\b([^]*?)\n\s*end\b/.exec(text)
    for (const m of deps ? deps[1].matchAll(/\{\s*:(\w+)\s*,([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g) : []) {
      const line = lineAt(text, deps!.index! + deps![0].indexOf(deps![1]) + m.index!)
      const local = /\bpath:\s*"([^"]+)"/.exec(m[2])?.[1]
      const target = local ? resolveFrom(path, local) : /\bin_umbrella:\s*true/.test(m[2]) ? resolveFrom(path, `../${m[1]}`) : null
      if (target) d.refs.push({ name: m[1], path: target, line, file })
      else { d.deps.push(m[1]); d.depLines.set(m[1], { file, line }) }
    }
    if (!d.reasons.length && d.deps.includes('phoenix')) d.reasons.push('it is a Phoenix application')
    d.tests = !d.reasons.length && TESTS.test(`${d.name} ${path}`)
    out.push(d)
  }
  return out
}

/** A Cargo.toml's crate: a binary (src/main.rs, [[bin]]) or a library; a workspace's root without a [package] only holds
 *  its members. Dependencies by path are references. */
function rust(files: RepoFiles): Draft[] {
  const out: Draft[] = []
  for (const file of files.named(/^Cargo\.toml$/).filter((f) => !inTests(f))) {
    const text = files.read(file)
    if (!/^\[package\]/m.test(text)) continue
    const path = dirOf(file)
    const prefix = path === '.' ? '' : `${path}/`
    const pkg = /^\[package\]([^[]*)/m.exec(text)?.[1] ?? ''
    const d = draft('rust', path, file, /^\s*name\s*=\s*"([^"]+)"/m.exec(pkg)?.[1], lineOf(text, /^\[package\]/m))
    d.aliases.push(basename(path === '.' ? '' : path))
    if (files.has(`${prefix}src/main.rs`) || /^\[\[bin\]\]/m.test(text) || files.list.some((f) => f.startsWith(`${prefix}src/bin/`) && f.endsWith('.rs'))) d.reasons.push('it builds a binary')
    // [dependencies], [dev-dependencies], [build-dependencies] and their target-specific forms.
    for (const section of text.matchAll(/^\[(?:target\.[^\]]+\.)?(?:dev-|build-)?dependencies\]([^]*?)(?=^\[|$(?![^]))/gm)) {
      for (const m of section[1].matchAll(/^\s*([\w-]+)\s*=\s*(.*)$/gm)) {
        const line = lineAt(text, section.index! + section[0].indexOf(section[1]) + m.index!)
        const local = /\bpath\s*=\s*"([^"]+)"/.exec(m[2])?.[1]
        const target = local ? resolveFrom(path, local) : null
        if (target) d.refs.push({ name: m[1], path: target, line, file })
        else { d.deps.push(m[1]); d.depLines.set(m[1], { file, line }) }
      }
    }
    d.tests = !d.reasons.length && TESTS.test(`${d.name} ${path}`)
    out.push(d)
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
    const entry = ['main.py', 'app.py', 'server.py', 'manage.py', 'wsgi.py', '__main__.py'].find((f) => files.has(`${prefix}${f}`))
    // A pyproject.toml declaring no project ([project], [tool.poetry]), only a workspace or tools' settings, is no unit.
    if (markers.filter((m) => dirOf(m) === path).every((m) => m.endsWith('pyproject.toml')) && !/^\[(project|tool\.poetry)\]/m.test(pyproject) && !entry) continue
    const name = /^\s*name\s*=\s*["']([^"']+)["']/m.exec(pyproject)?.[1] ?? /\bname\s*=\s*["']([^"']+)["']/.exec(setup)?.[1]
    const evidenceFile = markers.find((m) => dirOf(m) === path)!
    const d = draft('python', path, evidenceFile, name, 1)
    d.aliases.push(basename(path === '.' ? '' : path))
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
        // One reference, one dependency: named for its library, its binary kept to find the unit that builds it.
        if (library) { d.deps.push(library); d.depLines.set(library, { file, line: e.line }); if (binary && binary !== library) d.depFiles.set(library, binary) }
      } else if (e.key === 'Object') {
        const ocx = e.value.split(';').pop()?.trim()
        if (ocx) { d.deps.push(ocx); d.depLines.set(ocx, { file, line: e.line }) }
      }
    }
    if (entries.some((e) => /^(Form|UserControl)$/.test(e.key))) d.reasons.push('it has forms')
    if (type !== 'Exe' && type !== 'OleExe') d.reasons = d.reasons.filter((r) => r !== 'it has forms')
    const kind = { Exe: 'VB6 Standard EXE', OleExe: 'VB6 ActiveX EXE', OleDll: 'VB6 ActiveX DLL', Control: 'VB6 ActiveX Control (OCX)' }[type] ?? `VB6 ${type}`
    // What its authors call it: the version information's description, else the project's description or title.
    const said = ['VersionFileDescription', 'Description', 'Title'].map((k) => unquote(get(k)?.value ?? '').trim()).find(Boolean)
    d.description = said && said.toLowerCase() !== name.toLowerCase() ? `${said} (${kind})` : kind
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
/** A compose file's services: its services map, or in compose's first format (no version, no services key) its top
 *  level, where every entry is a service with an image or a build. */
export function composeServices<T = Record<string, unknown>>(doc: unknown): Record<string, T> {
  if (!doc || typeof doc !== 'object') return {}
  const d = doc as { services?: Record<string, T>; version?: unknown }
  if (d.services && typeof d.services === 'object') return d.services
  const entries = Object.entries(d)
  const v1 = d.version === undefined && entries.length > 0 && entries.every(([, v]) => !!v && typeof v === 'object' && ('image' in (v as object) || 'build' in (v as object)))
  return v1 ? (d as Record<string, T>) : {}
}

/** Each folder a compose service is built from, with the folders its services mount as volumes (./web:/web). */
export function composeMounts(files: RepoFiles): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const file of files.list.filter((f) => /(^|\/)(docker-)?compose[^/]*\.ya?ml$/i.test(f))) {
    let doc: { services?: Record<string, { build?: unknown; volumes?: unknown }> } | undefined
    try { doc = load(files.read(file)) as typeof doc } catch { continue }
    for (const def of Object.values(composeServices<{ build?: unknown; volumes?: unknown }>(doc))) {
      const build = typeof def?.build === 'string' ? def.build : typeof (def?.build as { context?: unknown })?.context === 'string' ? (def.build as { context: string }).context : null
      const context = build === null ? null : resolveFrom(dirOf(file), build)
      if (context === null) continue
      const mounted = (Array.isArray(def.volumes) ? def.volumes : []).filter((v): v is string => typeof v === 'string' && /^\.{1,2}(\/|:)/.test(v))
        .map((v) => resolveFrom(dirOf(file), v.split(':')[0])).filter((v): v is string => !!v)
      out.set(context, [...new Set([...(out.get(context) ?? []), ...mounted])])
    }
  }
  return out
}

function docker(files: RepoFiles, claimed: Set<string>, moves: Map<string, string>): Draft[] {
  const out: Draft[] = []
  const mounts = composeMounts(files)
  for (const file of files.named(/^Dockerfile$/).filter((f) => !inTests(f))) {
    const path = dirOf(file)
    if (claimed.has(path)) continue
    // A development container's image is the developers', not the system's.
    if (/(^|\/)\.devcontainer$/.test(path)) continue
    // An image a compose service builds and then mounts a unit's folder into runs that unit (a runner of scripts).
    if ((mounts.get(path) ?? []).some((m) => [...claimed].some((c) => c !== path && (m === '.' || c === m || c.startsWith(`${m}/`))))) continue
    // A Dockerfile above other units that copies their projects or folders builds them.
    const text = files.read(file)
    const copied = [...text.matchAll(/^\s*(?:COPY|ADD)\s+(?:--\S+\s+)*(?:\[\s*"([^"]+)"|(\S+))/gmi)].map((m) => resolveFrom(path, m[1] ?? m[2])).filter((r): r is string => !!r)
    const built = [...claimed].filter((c) => c !== path && copied.some((r) => (r === '.' && path === '.') || c === r || c.startsWith(`${r}/`) || (dirOf(r) === c && /\.(cs|fs|vb|sql)proj$|(^|\/)(package\.json|composer\.json|pom\.xml|build\.gradle(\.kts)?|go\.mod|pyproject\.toml|requirements\.txt)$/i.test(r))))
    if (built.length) {
      // The only unit below it, which it packages (an application in html/ behind its Dockerfile), is known by its folder.
      const below = [...claimed].filter((c) => path === '.' ? c !== '.' : c.startsWith(`${path}/`))
      if (below.length === 1 && built.length === 1 && path !== '.') moves.set(below[0], path)
      continue
    }
    // docker/<name>/Dockerfile below a unit packages that unit.
    if ([...claimed].some((c) => (c === '.' || path.startsWith(`${c}/`)) && /(^|\/)(docker|\.docker|deploy|build|packaging|container)(\/|$)/i.test(c === '.' ? path : path.slice(c.length + 1)))) continue
    // A Dockerfile alone in its folder builds what other folders hold, unless it copies nothing of the repository (an
    // image of its own: a broker with an agent added, a server fetched and built).
    const prefix = path === '.' ? '' : `${path}/`
    const local = [...text.matchAll(/^\s*(?:COPY|ADD)\s+((?:--\S+\s+)*)(?:\[\s*"([^"]+)"|(\S+))/gmi)].some((m) => !/--from=/i.test(m[1]) && !/^https?:\/\//i.test(m[2] ?? m[3]))
    if (local && !files.list.some((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes('/') && !/^(Dockerfile|\.dockerignore|README(\.md)?)$/i.test(f.slice(prefix.length)))) continue
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

/** A manifest's JSON, or nothing where it does not parse. */
const jsonOf = (text: string): { dependencies?: Record<string, string> } => { try { return JSON.parse(text) ?? {} } catch { return {} } }

/** Every unit of every stack in the repository, with the dependencies their manifests state. */
export function readStacks(files: RepoFiles, repo: string): StackUnits {
  const notes: string[] = []
  const groups: GroupFact[] = []
  // A Composer, .NET, Ruby, Elixir or Rust project claims its folder before the package.json that builds its front end.
  const drafts = [...php(files, notes), ...dotnet(files, groups, repo), ...ruby(files), ...elixir(files), ...rust(files), ...npm(files, notes), ...maven(files), ...gradle(files), ...go(files), ...goWithoutModules(files), ...python(files), ...vb6(files, groups, repo)]
  // One unit per folder: the first stack read claims it (a Python folder with a package.json for its tooling stays npm).
  const byPath = new Map<string, Draft>()
  for (const d of drafts) {
    const first = byPath.get(d.path)
    if (!first) { byPath.set(d.path, d); continue }
    // A package.json of tooling alone (devDependencies, nothing it runs) leaves its folder to the Python project beside it.
    if (first.stack === 'npm' && d.stack === 'python' && d.reasons.length && !first.reasons.length && !Object.keys(jsonOf(files.read(`${d.path === '.' ? '' : `${d.path}/`}package.json`)).dependencies ?? {}).length) {
      byPath.set(d.path, d)
      continue
    }
    // Several VB6 projects in one folder (a library, its EXE build, a variant) are one unit, known by each project's name and binary.
    if (first.stack !== 'vb6' || d.stack !== 'vb6') continue
    first.aliases.push(...(d.named ? [d.name] : []), ...d.aliases)
    first.deps.push(...d.deps.filter((x) => !first.deps.includes(x)))
    for (const [k, v] of d.depLines) if (!first.depLines.has(k)) first.depLines.set(k, v)
    for (const [k, v] of d.depFiles) if (!first.depFiles.has(k)) first.depFiles.set(k, v)
    first.refs.push(...d.refs)
    first.reasons.push(...d.reasons.filter((x) => !first.reasons.includes(x)))
  }
  const moves = new Map<string, string>()
  for (const d of docker(files, new Set(byPath.keys()), moves)) byPath.set(d.path, d)
  for (const [from, to] of moves) {
    const d = byPath.get(from)!
    byPath.delete(from)
    d.path = to
    if (!d.named) d.name = basename(to)
    d.reasons.push('it has a Dockerfile')
    byPath.set(to, d)
  }

  const units: Unit[] = []
  const dependencies: DependencyFact[] = []
  for (const d of [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    const prefix = d.path === '.' ? '' : `${d.path}/`
    if (files.has(`${prefix}Dockerfile`) && !d.reasons.includes('it has a Dockerfile')) d.reasons.push('it has a Dockerfile')
    const technology = new Set(technologyOf(d.deps))
    if (d.stack === 'docker') for (const img of d.deps) for (const [re, t] of BASE_IMAGES) if (re.test(img)) technology.add(t)
    technology.add({ npm: 'Node.js', maven: 'Java', gradle: 'Java', go: 'Go', dotnet: '.NET', python: 'Python', php: 'PHP', ruby: 'Ruby', elixir: 'Elixir', rust: 'Rust', vb6: 'VB6', docker: '' }[d.stack])
    technology.delete('')
    const id = `${repo}:unit:${d.path}`
    units.push({
      id, name: d.name, ...(d.aliases.length ? { aliases: [...new Set(d.aliases.filter((a) => a && a !== d.name))] } : {}),
      path: d.path, stack: d.stack,
      kind: d.tests ? 'tests' : d.reasons.length ? 'app' : 'library',
      why: d.tests ? 'it checks other units' : d.reasons.length ? [...new Set(d.reasons)].join(', ') : 'nothing in its manifest runs it',
      technology: [...technology].sort(),
      ...((framework) => (framework ? { testFramework: framework } : {}))(testFrameworkOf(d, files)),
      ...(d.description ? { description: d.description } : {}),
      ...(d.named ? {} : { named: false }),
      evidence: d.evidence,
    })
    if (d.stack === 'docker') continue
    // An Office object library the unit's code never automates (Excel., Word.) is referenced but unused.
    const code = d.stack === 'vb6' ? files.list.filter((f) => (d.path === '.' || f.startsWith(`${d.path}/`)) && /\.(bas|cls|frm|ctl)$/i.test(f)).map((f) => files.read(f)).join('\n') : ''
    const unused = (dep: string): boolean => {
      const app = /^Microsoft (Excel|Word|Outlook|PowerPoint|Access) [\d.]+ Object Library$/i.exec(dep)?.[1]
      return !!app && !new RegExp(`\\b${app}\\.`, 'i').test(code)
    }
    for (const dep of [...new Set(d.deps)].sort()) {
      const binary = d.depFiles.get(dep)
      dependencies.push({ id: `${repo}:dep:${d.path}:${dep}`, unit: id, package: dep, ...(binary ? { file: binary } : {}), ...(unused(dep) ? { unused: true } : {}), evidence: d.depLines.get(dep) ?? d.evidence })
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
