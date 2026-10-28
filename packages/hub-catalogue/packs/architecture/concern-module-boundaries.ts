import type { PackSpec } from '../../src/packSpec'

const RULE_ADRS = ['adr-allowlist', 'adr-levels']
const FORCES = 'The code in this element is cut into parts (modules, packages, libraries) and keeps changing. Without written and checked rules, every shortcut adds a dependency nobody decided on: one module reads another\'s internals, two packages import each other, and a "common" folder grows until every change touches everything. The forces: rules kept only in a wiki erode within months; a cycle makes two parts one, so neither can be tested, owned or released alone; sharing code saves typing but couples the teams that share it; a boundary nobody owns is crossed by whoever is in a hurry; and an old codebase cannot fix every violation at once. What the parts are (layers, rings, slices) is the Architecture style pack; who owns each part is the Code review and branching pack; this pack keeps the boundaries between the parts.'

const pack: PackSpec = {
  id: 'concern-module-boundaries',
  name: 'Module boundaries',
  group: 'architecture',
  description: 'Keeping the parts of the code apart: which part may depend on which, through what, with no cycles; what they may share; and how the build enforces it on the code there is today. The snippets are TypeScript with dependency-cruiser; each tool line names the JVM, .NET and Python equivalent.',
  tags: ['maintainability', 'modularity', 'dependencies', 'architecture rules', 'cycles', 'shared kernel'],
  concern: {
    id: 'module-boundaries',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements, so which of its parts may depend on which, and how the build keeps it that way, has to be decided.',
  },
  sources: [
    { title: 'ISO/IEC 25010, Maintainability: modularity, analysability, modifiability, testability', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
    { title: 'Ford, Parsons, Kua, Sadalage: Building Evolutionary Architectures, 2nd ed. (fitness functions)', url: 'https://www.oreilly.com/library/view/building-evolutionary-architectures/9781492097532/' },
    { title: 'Robert C. Martin: Clean Architecture (component principles: the Acyclic Dependencies Principle)', url: 'https://www.oreilly.com/library/view/clean-architecture-a/9780134494272/' },
    { title: 'Eric Evans: Domain-Driven Design (reference and summary; Shared Kernel)', url: 'https://www.domainlanguage.com/ddd/' },
    { title: 'Martin Fowler: BoundedContext', url: 'https://martinfowler.com/bliki/BoundedContext.html' },
    { title: 'Semantic Versioning 2.0.0', url: 'https://semver.org/spec/v2.0.0.html' },
    { title: 'Spring Modulith reference documentation', url: 'https://docs.spring.io/spring-modulith/reference/' },
    { title: 'Nx: Enforce module boundaries', url: 'https://nx.dev/features/enforce-module-boundaries' },
    { title: 'ArchUnit user guide', url: 'https://www.archunit.org/userguide/html/000_Index.html' },
    { title: 'dependency-cruiser', url: 'https://github.com/sverweij/dependency-cruiser' },
  ],
  questions: [
    {
      key: 'RULES', title: 'Dependency rules', label: 'How are the allowed dependencies between parts declared?',
      hint: 'Either each part says which others it may use, or parts are ranked in levels and may only use lower ones. Anything not allowed fails the build.',
      default: 'allowlist',
      options: [
        { value: 'allowlist', label: 'each part lists what it may use', description: 'Every part declares the parts it may depend on (a module.json per part read by dependency-cruiser; Spring Modulith allowedDependencies, import-linter contracts elsewhere); everything else is forbidden. Pick it for up to about fifteen parts that are peers, such as the modules of a modular monolith, where each dependency deserves a decision.' },
        { value: 'levels', label: 'parts ranked in levels', description: 'Each part is tagged with a level (app, feature, data-access, domain, util) and may depend only on parts of lower levels, never on its own level\'s peers or higher. Pick it for a codebase with dozens of parts, where a list per part would be unmaintainable.' },
      ],
    },
    {
      key: 'ENFORCE', title: 'Enforcement', label: 'How are the rules enforced on the code there is today?',
      hint: 'Rules that only fail on new code can be adopted on an old codebase today; rules that fail on everything need a clean codebase first.',
      default: 'fail',
      options: [
        { value: 'fail', label: 'every violation fails the build', description: 'The rule check fails the build on any violation. Pick it for new code, or when the existing violations are few enough to fix before switching the check on.' },
        { value: 'ratchet', label: 'existing violations frozen, new ones fail', description: 'Today\'s violations are recorded in a baseline; only new ones fail, and the baseline must shrink every quarter. Pick it for an existing codebase with more violations than can be fixed at once.' },
      ],
    },
    {
      key: 'SHARED', title: 'Shared code', label: 'What may the parts share?',
      hint: 'Shared code couples the parts that use it: a change to it is a change to each of them. The policy decides how much coupling is accepted, and who decides.',
      default: 'kernel',
      options: [
        { value: 'kernel', label: 'a small shared kernel', description: 'A few value types and contracts (money, identifiers, event schemas) live in one shared part, src/shared-kernel, that every user of it must approve changes to. Pick it when parts genuinely speak the same language about a few concepts.' },
        { value: 'library', label: 'versioned internal libraries', description: 'Shared code is published as libraries with semantic versions; each part upgrades on its own schedule. Pick it when the parts are released separately (services, several repositories).' },
        { value: 'none', label: 'nothing but third-party libraries', description: 'Parts share no code of their own; small helpers are duplicated and data crosses only through APIs or events. Pick it when teams must never wait for each other, accepting some duplication.' },
      ],
    },
  ],
  details: [
    { key: 'RATCHET_PERCENT', label: 'By how much must the baseline of known violations shrink each quarter (%)?', default: '20', number: true },
    { key: 'KERNEL_PERCENT', label: 'At most how much of the code may the shared kernel be (% of lines)?', default: '5', number: true },
  ],
  need: {
    label: 'Parts change on their own',
    text: 'The code in this element must stay easy to understand, test and change as it grows and as people come and go. That needs parts with clear boundaries: a change to one part should not ripple through the others, each part should be testable on its own, and the rules about what may depend on what should hold because the build checks them, not because everyone remembers them. The checks below share one layout: each part lives in src/modules/<name> with its published API in src/modules/<name>/index.ts and its declarations in src/modules/<name>/module.json; shared code, where allowed, lives in src/shared-kernel; the rules are in .dependency-cruiser.cjs and run as `npm run check:deps` (depcruise src --config .dependency-cruiser.cjs); known violations, where frozen, are in .dependency-cruiser-known-violations.json.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-allowlist', label: 'Only declared dependencies', when: { RULES: ['allowlist'] }, ears_type: 'ubiquitous',
      action: 'let each part depend only on the parts it declares in its module.json as allowed, with 0 undeclared dependencies between parts on the main branch outside the recorded baseline',
      rationale: 'Declaring each dependency makes it a decision visible in review; rules that are not checked erode with every shortcut (Building Evolutionary Architectures, ch. 2; Spring Modulith, allowed dependencies).',
      scenario: { label: 'Undeclared dependency found', given: 'the ordering module, allowed to use catalog only', when: 'a change makes it import from billing', then: 'the rule check reports the undeclared dependency naming both modules' },
    },
    {
      id: 'req-levels', label: 'Dependencies point down levels', when: { RULES: ['levels'] }, ears_type: 'ubiquitous',
      action: 'let each part depend only on parts of a lower level than the one declared in its module.json, with 0 dependencies on a part of the same or a higher level on the main branch outside the recorded baseline',
      rationale: 'Levels give a large number of parts one direction without a list per part (Nx, enforce module boundaries; ISO/IEC 25010 modularity).',
      scenario: { label: 'Upward dependency found', given: 'a domain part and a feature part', when: 'the domain part imports the feature part', then: 'the rule check reports the dependency on a higher level' },
    },
    {
      id: 'req-public-api', label: 'Parts meet through APIs', ears_type: 'ubiquitous',
      action: 'let a part use another only through that part\'s published API (its index.ts), with 0 imports of another part\'s internal files',
      rationale: 'A part whose internals others reach into cannot change them alone, and cannot later be extracted (Fowler, BoundedContext; Spring Modulith, application modules).',
      scenario: { label: 'Internal access refused', given: 'two parts, each with a published API', when: 'one imports a file of the other that is not its index', then: 'the rule check reports it and the build fails' },
    },
    {
      id: 'req-cycles', label: 'No cycles between parts', ears_type: 'ubiquitous',
      action: 'keep the dependency graph between parts free of cycles, with 0 cycles that run through more than one part (a cycle inside one part is that part\'s own business)',
      rationale: 'Parts in a cycle can only be understood, tested and released together, which makes them one part (Martin, Clean Architecture: the Acyclic Dependencies Principle; ISO/IEC 25010 modularity).',
      scenario: { label: 'Cycle refused', given: 'two parts where A depends on B', when: 'a change makes B depend on A', then: 'the rule check reports the cycle with both parts named and the change is not merged' },
    },
    {
      id: 'req-fail', label: 'Violations fail the build', when: { ENFORCE: ['fail'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a change adds a dependency the rules forbid or a cycle',
      action: 'fail the build of that change before it can be merged, naming the rule and the two parts involved',
      rationale: 'A violation is cheapest to fix in the pull request that brings it; after the merge others start to depend on it (Building Evolutionary Architectures, atomic fitness functions).',
      scenario: { label: 'Violation blocks merge', given: 'a pull request that adds a forbidden dependency', when: 'the build runs', then: 'the dependency check fails naming the rule and both parts, and the pull request cannot be merged' },
    },
    {
      id: 'req-ratchet', label: 'Known violations shrink', when: { ENFORCE: ['ratchet'] }, ears_type: 'state-driven',
      precondition: 'known violations remain in the recorded baseline',
      action: 'fail any change that adds a violation outside the baseline, and shrink the baseline by at least {{RATCHET_PERCENT}}% each quarter',
      rationale: 'An old codebase cannot be fixed at once; freezing what is there stops it getting worse while the baseline records the debt to pay down (dependency-cruiser known violations; ArchUnit FreezingArchRule).',
      scenario: { label: 'Baseline holds and shrinks', given: 'a baseline of known violations', when: 'a change adds a new violation, and a quarter ends', then: 'the change fails the build, and the baseline holds at least {{RATCHET_PERCENT}}% fewer violations than at the previous quarter\'s tag' },
    },
    {
      id: 'req-kernel', label: 'Shared kernel stays small', when: { SHARED: ['kernel'] }, ears_type: 'ubiquitous',
      action: 'keep in the shared kernel only types and contracts used by at least two parts, with no dependency on a part and no third-party library beyond the allowed pure ones, at most {{KERNEL_PERCENT}}% of the source lines, and changes approved by the owners of every part that uses it as the Code review and branching pack decides ownership',
      rationale: 'A shared kernel is shared on purpose and kept small; a growing "common" folder couples everything to everything (Evans, Domain-Driven Design, Shared Kernel).',
      scenario: { label: 'Kernel stays small', given: 'the shared kernel', when: 'a change makes it import a part or a database driver, or the kernel passes {{KERNEL_PERCENT}}% of the lines', then: 'the check fails and the change is moved into the part that uses it' },
    },
    {
      id: 'req-library', label: 'Shared libraries are versioned', when: { SHARED: ['library'] }, ears_type: 'event-driven',
      trigger: 'shared code changes',
      action: 'publish it as a new semantic version of its library, and move every consumer to the latest major version within 90 days of its release',
      rationale: 'Versioned libraries let each part upgrade on its own schedule; bounding the lag keeps old versions from piling up (Semantic Versioning 2.0.0).',
      scenario: { label: 'Library upgraded in time', given: 'a shared library and its consumers', when: 'a new major version is published', then: 'within 90 days every consumer is on it, and the lag check fails for any that is not' },
    },
    {
      id: 'req-no-shared', label: 'Nothing shared but contracts', when: { SHARED: ['none'] }, ears_type: 'ubiquitous',
      action: 'share no source code between parts apart from third-party libraries and API clients generated from published contracts, with 0 imports of another part\'s code',
      rationale: 'Every shared line is a reason for two teams to coordinate; duplication of small helpers is cheaper than that coupling (Building Evolutionary Architectures, coupling).',
      scenario: { label: 'Cross-part import refused', given: 'two parts', when: 'one imports a helper from the other', then: 'the rule check reports it and the build fails' },
    },
  ],
  adrs: [
    {
      id: 'adr-allowlist', label: 'Declared dependencies only', when: { RULES: ['allowlist'] },
      decision: 'Each part (src/modules/<name>) declares in its module.json the parts it may depend on ("uses") and exposes a published API in its index.ts; any other dependency, any import of another part\'s file but its index, and any cycle through more than one part fails the dependency check, which runs in every build ({{ENFORCE}}). Shared code: {{SHARED}}. The checker is dependency-cruiser with rules generated from the module.json files; on Spring Boot the same is Spring Modulith (@ApplicationModule(allowedDependencies = …) with ApplicationModules.verify()), on other JVM code ArchUnit slices, in Python import-linter contracts, on .NET NetArchTest. Pick the one that runs in the existing build, so a violation shows up like any failing test.',
      consequences: '• Every dependency between parts is a visible decision, reviewed when it is added.\n• The declarations are code to maintain: adding a dependency means changing one line in module.json and convincing a reviewer.\n• Boundaries hold only while the check runs in every build.\n• With many parts the lists become noise; levels scale better.',
      alternatives: '1. Levels: one rule for many parts, but less precise between peers.\n2. Only forbidding known-bad dependencies: easy to start, but anything not foreseen is allowed.\n3. No checked rules: fastest to start, and boundaries erode within months.',
    },
    {
      id: 'adr-levels', label: 'Parts ranked in levels', when: { RULES: ['levels'] },
      decision: 'Each part (src/modules/<name>) declares its level in its module.json (util, domain, data-access, feature, app; or the levels the codebase needs) and may depend only on parts of lower levels and only through their index.ts; cycles through more than one part are forbidden. The dependency check runs in every build ({{ENFORCE}}). Shared code: {{SHARED}}. The checker is dependency-cruiser with rules generated from the levels; in an Nx workspace the same is @nx/enforce-module-boundaries with type tags, on the JVM ArchUnit\'s layeredArchitecture() over module packages, in Python import-linter\'s layers contract.',
      consequences: '• One rule covers dozens of parts; a new part only needs its level.\n• Peers at the same level cannot use each other, which pushes shared code down a level.\n• Says nothing about which domain may use which; add scope tags or an allowlist when that matters.\n• Boundaries hold only while the check runs in every build.',
      alternatives: '1. Per-part lists: precise, but unmaintainable for dozens of parts.\n2. Separate repositories per part: strong boundaries, slow cross-part changes.\n3. No checked rules: boundaries erode within months.',
    },
    {
      id: 'adr-fail', label: 'Every violation fails the build', when: { ENFORCE: ['fail'] },
      decision: 'The dependency check runs on every pull request as a job the main branch requires (the ruleset that protects main is the Code review and branching pack\'s), and any violation fails it: there is no baseline and no exception list. Existing violations, if any, are fixed before the check is switched on.',
      consequences: '• A violation never reaches main, so nobody comes to depend on one.\n• Switching the check on needs a clean codebase first; on an old one that is a project of its own.\n• A rule that turns out wrong blocks everyone until it is changed, which keeps the rules honest.',
      alternatives: '1. A frozen baseline with a ratchet: adoptable today on an old codebase, at the cost of carrying known violations.\n2. Warnings only: visible, and ignored within weeks.',
    },
    {
      id: 'adr-ratchet', label: 'Known violations frozen, new ones fail', when: { ENFORCE: ['ratchet'] },
      decision: 'The dependency check runs on every pull request with today\'s violations frozen in .dependency-cruiser-known-violations.json (written once with the --baseline option, committed, never edited by hand): a new violation fails the build, a fixed one is removed from the baseline. The baseline shrinks by at least {{RATCHET_PERCENT}}% each quarter against the previous quarter\'s tag (quarter-<year>Q<n>), checked in the build. On the JVM the same is ArchUnit\'s FreezingArchRule with its store committed.',
      consequences: '• Adoptable today on an old codebase; the code stops getting worse at once.\n• The baseline is debt on record: paying it down is planned work, and the quarterly check makes skipping it visible.\n• A fixed violation that is not removed from the baseline hides nothing, since the check only ignores what is listed.',
      alternatives: '1. Every violation fails the build: cleaner, after fixing everything first.\n2. A deadline instead of a ratchet: all violations fixed by a date, usually missed.',
    },
    {
      id: 'adr-shared-kernel', label: 'A small shared kernel', when: { SHARED: ['kernel'] },
      decision: 'Code shared between parts lives in one shared kernel, src/shared-kernel: value types and contracts (money, identifiers, event schemas) used by at least two parts, with no dependency on a part, no I/O or framework library (only the pure libraries on the kernel\'s allowlist), at most {{KERNEL_PERCENT}}% of the source lines. A change to the kernel is approved by the owners of every part that uses it, as the Code review and branching pack decides ownership.',
      consequences: '• Parts speak the same language about the few concepts they share.\n• Every kernel change is a change to every part that uses it, hence the approvals and the size limit.\n• Helpers that are convenient but not shared concepts stay in the parts and are sometimes duplicated.',
      alternatives: '1. Versioned internal libraries: each part upgrades on its own schedule.\n2. Nothing shared: no coupling through code, at the cost of duplication.\n3. A free-for-all "common" folder: easy, and it couples everything to everything.',
    },
    {
      id: 'adr-shared-libraries', label: 'Versioned internal libraries', when: { SHARED: ['library'] },
      decision: 'Code shared between parts is published as internal libraries under the @shop scope with semantic versions to the internal registry (npm, Maven, NuGet or PyPI on Artifactory, GitHub Packages or a cloud artifact registry). Each part upgrades on its own schedule; how the update pull requests arrive is decided in the Dependency hygiene pack. No consumer stays on an older major version for more than 90 days after a new major is released; a weekly check in every consumer fails past that.',
      consequences: '• Parts released apart are not forced to upgrade together.\n• Several versions of a library live at once; fixes have to be released and picked up.\n• Library owners must keep compatibility within a major version and announce majors.',
      alternatives: '1. A shared kernel in the same repository: always one version, but every change hits every user at once.\n2. Nothing shared: no versions to manage, some duplication.',
    },
    {
      id: 'adr-share-nothing', label: 'Parts share no code', when: { SHARED: ['none'] },
      decision: 'Parts share no source code of their own: small helpers are duplicated, and data crosses only through published APIs or events, with clients generated in each consumer from the provider\'s contract. Third-party libraries are allowed.',
      consequences: '• No team ever waits for another to change shared code.\n• Some duplication, and a bug in a copied helper is fixed in each copy.\n• Contracts carry the whole weight of the coupling, so they must be versioned and checked.',
      alternatives: '1. A small shared kernel: less duplication for genuinely shared concepts.\n2. Versioned internal libraries: sharing without lock-step upgrades.',
    },
  ],
  fitness: [
    {
      id: 'ff-cycles', label: 'No dependency cycles', category: 'structural', implements: RULE_ADRS, checks: ['req-cycles'],
      threshold: '0 cycles that run through more than one part on the main branch',
      description: 'A dependency rule fails on any cycle that leaves a part\'s folder (a cycle among the files of one part is not counted); it is one of the rules in .dependency-cruiser.cjs that npm run check:deps runs. On the JVM the same is ArchUnit\'s slices().matching("..(*)..").should().beFreeOfCycles(); for Python, import-linter\'s independence contract.',
      tool: 'dependency-cruiser; for the JVM: ArchUnit slices; for Python: import-linter; for .NET: NetArchTest',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs — in forbidden:
{
  name: 'no-cycles-between-parts',
  comment: 'ADR Module boundaries: parts in a cycle are one part',
  severity: 'error',
  from: { path: '^src/modules/([^/]+)/' },
  to: { circular: true, via: { pathNot: '^src/modules/$1/' } },   // the cycle passes through another part
}
// package.json: "check:deps": "depcruise src --config .dependency-cruiser.cjs"`,
    },
    {
      id: 'ff-public-api', label: 'Only public APIs used', category: 'structural', implements: RULE_ADRS, checks: ['req-public-api'],
      threshold: '0 imports from one part into another part\'s files other than its index.ts',
      description: 'A dependency rule allows a part to import another only through its index (the published API); a deep import into another part\'s folder fails the build. Spring Modulith\'s verify() (named interfaces such as customer::api are its published packages) and Nx\'s module boundaries do the same in their stacks.',
      tool: 'dependency-cruiser; for Spring Boot: Spring Modulith verify(); for an Nx workspace: @nx/enforce-module-boundaries; for .NET: NetArchTest',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs — in forbidden:
{
  name: 'only-through-public-api',
  comment: 'ADR Module boundaries: parts meet through their published API',
  severity: 'error',
  from: { path: '^src/modules/([^/]+)/' },
  to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\\\.ts$'] },
}`,
    },
    {
      id: 'ff-allowlist', label: 'Only declared dependencies', when: { RULES: ['allowlist'] }, category: 'structural', implements: ['adr-allowlist'], checks: ['req-allowlist'],
      threshold: '0 dependencies from a part on a part its module.json does not list',
      description: 'Each part declares what it may use in src/modules/<name>/module.json; the configuration reads the files and generates one forbidden rule per part that allows imports only of the declared parts\' index files. A new dependency means a one-line change to module.json, visible in review.',
      tool: 'dependency-cruiser; for Spring Boot: Spring Modulith @ApplicationModule(allowedDependencies) with ApplicationModules.verify(); for Python: import-linter forbidden contracts',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs — each part declares what it may use in src/modules/<name>/module.json: { "uses": ["catalog", "customer"] }
const { readdirSync, readFileSync } = require('node:fs')
const parts = readdirSync('src/modules')
const uses = Object.fromEntries(parts.map((p) => [p, JSON.parse(readFileSync(\`src/modules/\${p}/module.json\`, 'utf8')).uses ?? []]))

module.exports = {
  forbidden: parts.map((p) => ({
    name: \`\${p}-uses-only-declared-parts\`,
    comment: 'ADR Declared dependencies only: add the part to module.json to use it',
    severity: 'error',
    from: { path: \`^src/modules/\${p}/\` },
    to: { path: '^src/modules/', pathNot: [\`^src/modules/\${p}/\`, ...uses[p].map((u) => \`^src/modules/\${u}/index\\\\.ts$\`)] },
  })),
  options: { tsConfig: { fileName: 'tsconfig.json' } },
}`,
    },
    {
      id: 'ff-levels', label: 'Dependencies point down levels', when: { RULES: ['levels'] }, category: 'structural', implements: ['adr-levels'], checks: ['req-levels'],
      threshold: '0 dependencies from a part on a part of the same or a higher level',
      description: 'Each part declares its level in src/modules/<name>/module.json; the configuration generates one forbidden rule per part that refuses imports from parts of the same or a higher level. In an Nx workspace the same is the type tags of @nx/enforce-module-boundaries.',
      tool: 'dependency-cruiser; for an Nx workspace: @nx/enforce-module-boundaries with depConstraints on type tags; for the JVM: ArchUnit layeredArchitecture(); for Python: import-linter layers contract',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs — each part declares its level in src/modules/<name>/module.json: { "level": "feature" }
const { readdirSync, readFileSync } = require('node:fs')
const LEVELS = ['util', 'domain', 'data-access', 'feature', 'app']   // lowest first: a part may use lower levels only
const parts = readdirSync('src/modules')
const level = Object.fromEntries(parts.map((p) => [p, LEVELS.indexOf(JSON.parse(readFileSync(\`src/modules/\${p}/module.json\`, 'utf8')).level)]))

module.exports = {
  forbidden: parts.map((p) => ({
    name: \`\${p}-depends-down-levels-only\`,
    comment: 'ADR Parts ranked in levels: a part uses parts of lower levels only',
    severity: 'error',
    from: { path: \`^src/modules/\${p}/\` },
    to: { path: parts.filter((o) => o !== p && level[o] >= level[p]).map((o) => \`^src/modules/\${o}/\`) },
  })).filter((rule) => rule.to.path.length > 0),
  options: { tsConfig: { fileName: 'tsconfig.json' } },
}`,
    },
    {
      id: 'ff-fail', label: 'Violations fail the pull request', when: { ENFORCE: ['fail'] }, category: 'process', implements: ['adr-fail'], checks: ['req-fail'],
      threshold: 'The dependency check runs on every pull request and its job fails on any violation, naming the rule and both files',
      description: 'A workflow runs npm run check:deps on every pull request; dependency-cruiser\'s default err reporter exits non-zero on an error-severity violation and prints the rule with the from and to files. The job is listed among the checks the main branch requires, in the ruleset the Code review and branching pack keeps.',
      tool: 'dependency-cruiser in GitHub Actions; for the JVM: the ArchUnit tests in the build\'s test job',
      language: 'yaml',
      snippet: `# .github/workflows/boundaries.yml
name: module boundaries
on: [pull_request]
jobs:
  check-deps:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
      - uses: actions/setup-node@v4.1.0   # pin by commit SHA in your repository
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run check:deps   # depcruise src --config .dependency-cruiser.cjs; exits non-zero on a violation`,
    },
    {
      id: 'ff-ratchet', label: 'Known violations frozen and shrinking', when: { ENFORCE: ['ratchet'] }, category: 'structural', implements: ['adr-ratchet'], checks: ['req-ratchet'],
      threshold: '0 violations outside the baseline on every pull request; the baseline holds at least {{RATCHET_PERCENT}}% fewer entries than at the previous quarter\'s tag',
      description: 'The dependency check runs with --ignore-known, so only violations not in the committed baseline fail; the baseline was written once with --baseline. A second step counts the baseline\'s entries against the file at the previous quarter\'s tag and fails when it has not shrunk enough. With ArchUnit the same is FreezingArchRule with its store committed and counted the same way.',
      tool: 'dependency-cruiser (--baseline, --ignore-known) with jq and git in a shell step; for the JVM: ArchUnit FreezingArchRule with the archunit_store directory',
      language: 'bash',
      snippet: `set -euo pipefail
# once, to freeze today's violations:  npx depcruise src --config .dependency-cruiser.cjs --baseline   (then commit the file)
npx depcruise src --config .dependency-cruiser.cjs --ignore-known   # fails on violations outside .dependency-cruiser-known-violations.json

# the baseline shrinks: compare with the previous quarter's tag (quarter-<year>Q<n>, set by the team)
now=$(jq length .dependency-cruiser-known-violations.json)
previous_tag=$(git describe --tags --match 'quarter-*' --abbrev=0 HEAD~1)
then=$(git show "$previous_tag:.dependency-cruiser-known-violations.json" | jq length)
echo "known violations: $then at $previous_tag, $now now"
[ "$((now * 100))" -le "$((then * (100 - {{RATCHET_PERCENT}})))" ] || { echo "the baseline has not shrunk by {{RATCHET_PERCENT}}% since $previous_tag"; exit 1; }`,
    },
    {
      id: 'ff-kernel', label: 'Shared kernel stays small', when: { SHARED: ['kernel'] }, category: 'structural', implements: ['adr-shared-kernel'], checks: ['req-kernel'],
      threshold: 'The shared kernel imports no part and no third-party package outside its allowlist, and holds at most {{KERNEL_PERCENT}}% of the source lines',
      description: 'A dependency rule keeps the kernel free of the parts and of every package in node_modules except the pure ones on its allowlist (so a database driver, HTTP client or framework cannot slip in); a second step in the same job compares the kernel\'s line count with the whole and fails above the limit.',
      tool: 'dependency-cruiser and cloc with jq in a shell step; for the JVM: an ArchUnit rule over the kernel package and JaCoCo\'s line counts',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs — in forbidden:
{
  name: 'kernel-depends-on-nothing',
  comment: 'ADR A small shared kernel: types and contracts only',
  severity: 'error',
  from: { path: '^src/shared-kernel/' },
  to: { path: ['^src/modules/', '^node_modules/'], pathNot: '^node_modules/(zod|uuid|decimal\\\\.js)/' },   // the pure libraries the kernel may use
}
// CI, in the same job: fail when the kernel passes the limit
//   kernel=$(cloc --json src/shared-kernel | jq '.SUM.code'); all=$(cloc --json src | jq '.SUM.code')
//   [ $((kernel * 100 / all)) -le {{KERNEL_PERCENT}} ]`,
    },
    {
      id: 'ff-library', label: 'No consumer left behind', when: { SHARED: ['library'] }, category: 'process', implements: ['adr-shared-libraries'], checks: ['req-library'],
      threshold: '0 internal libraries on which a consumer is a major version behind for more than 90 days after the newer major\'s release',
      description: 'A weekly job in every consumer lists its outdated packages, and for each internal library whose latest major is newer than the installed one reads the release date of that version from the registry; a lag over 90 days fails the job naming the library.',
      tool: 'npm (outdated, view) in a TypeScript script run with tsx from a scheduled GitHub Actions job; for Maven: versions:display-dependency-updates with the release dates from the repository index',
      language: 'ts',
      snippet: `// scripts/library-lag.ts — scheduled weekly in every consumer: npx tsx scripts/library-lag.ts
import { execFileSync } from 'node:child_process'

const SCOPE = '@shop/'
const MAX_DAYS = 90
// npm outdated exits 1 when something is outdated; its JSON is still on stdout
const npm = (args: string[]): string => { try { return execFileSync('npm', args, { encoding: 'utf8' }) } catch (e: any) { return e.stdout } }
const major = (version: string) => Number(version.split('.')[0])

const outdated: Record<string, { current: string; latest: string }> = JSON.parse(npm(['outdated', '--json']) || '{}')
const late: string[] = []
for (const [name, info] of Object.entries(outdated)) {
  if (!name.startsWith(SCOPE) || major(info.latest) <= major(info.current)) continue
  const published: Record<string, string> = JSON.parse(npm(['view', name, 'time', '--json']))
  const days = Math.floor((Date.now() - Date.parse(published[info.latest])) / 86_400_000)
  if (days > MAX_DAYS) late.push(\`\${name}: on \${info.current}, \${info.latest} was released \${days} days ago\`)
}
if (late.length) { console.error('internal libraries a major behind for over 90 days:\\n' + late.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-no-shared', label: 'No code shared between parts', when: { SHARED: ['none'] }, category: 'structural', implements: ['adr-share-nothing'], checks: ['req-no-shared'],
      threshold: '0 imports from one part\'s folder into another\'s',
      description: 'A dependency rule forbids any import from one part into another; generated API clients live in each consumer and are generated from the provider\'s published contract.',
      tool: 'dependency-cruiser; for the JVM: ArchUnit slices().should().notDependOnEachOther(); for .NET: NetArchTest',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs — in forbidden:
{
  name: 'parts-share-nothing',
  comment: 'ADR Parts share no code',
  severity: 'error',
  from: { path: '^src/modules/([^/]+)/' },
  to: { path: '^src/modules/', pathNot: '^src/modules/$1/' },
}`,
    },
  ],
}

export default pack
