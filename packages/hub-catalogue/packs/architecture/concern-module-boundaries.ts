import type { PackSpec } from '../../src/packSpec'

const RULE_ADRS = ['adr-allowlist', 'adr-levels']
const FORCES = 'The code in this element is cut into parts (modules, packages, libraries) and keeps changing. Without written and checked rules, every shortcut adds a dependency nobody decided on: one module reads another\'s internals, two packages import each other, and a "common" folder grows until every change touches everything. The forces: rules kept only in a wiki erode within months; a cycle makes two parts one, so neither can be tested, owned or released alone; sharing code saves typing but couples the teams that share it; a boundary nobody owns is crossed by whoever is in a hurry; and an old codebase cannot fix every violation at once. What the parts are (layers, rings, slices) is the Architecture style pack; this pack keeps the boundaries between them.'

const pack: PackSpec = {
  id: 'concern-module-boundaries',
  name: 'Module boundaries',
  group: 'architecture',
  description: 'Keeping the parts of the code apart: which part may depend on which, through what, with no cycles; what they may share; who owns each; and how the build enforces it on the code there is today.',
  tags: ['maintainability', 'modularity', 'dependencies', 'architecture rules', 'cycles', 'shared kernel', 'codeowners'],
  concern: {
    id: 'module-boundaries',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements, so which of its parts may depend on which, and how the build keeps it that way, has to be decided.',
  },
  sources: [
    { title: 'ISO/IEC 25010, Maintainability: modularity, analysability, modifiability, testability', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
    { title: 'Ford, Parsons, Kua, Sadalage: Building Evolutionary Architectures, 2nd ed. (fitness functions)', url: 'https://www.oreilly.com/library/view/building-evolutionary-architectures/9781492097532/' },
    { title: 'Martin Fowler: BoundedContext', url: 'https://martinfowler.com/bliki/BoundedContext.html' },
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
        { value: 'allowlist', label: 'each part lists what it may use', description: 'Every part declares the parts it may depend on (Spring Modulith allowedDependencies, import-linter contracts, an explicit map in dependency-cruiser); everything else is forbidden. Pick it for up to about fifteen parts that are peers, such as the modules of a modular monolith, where each dependency deserves a decision.' },
        { value: 'levels', label: 'parts ranked in levels', description: 'Each part is tagged with a level (for example app, feature, domain, util) and may depend only on parts of lower levels, never on its own level\'s peers or higher. Pick it for a monorepo with dozens of libraries, where a list per part would be unmaintainable.' },
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
        { value: 'kernel', label: 'a small shared kernel', description: 'A few value types and contracts (money, identifiers, event schemas) live in one shared part that every user of it must approve changes to. Pick it when parts genuinely speak the same language about a few concepts.' },
        { value: 'library', label: 'versioned internal libraries', description: 'Shared code is published as libraries with semantic versions; each part upgrades on its own schedule. Pick it when the parts are released separately (services, several repositories).' },
        { value: 'none', label: 'nothing but third-party libraries', description: 'Parts share no code of their own; small helpers are duplicated and data crosses only through APIs or events. Pick it when teams must never wait for each other, accepting some duplication.' },
      ],
    },
    {
      key: 'OWNERS', title: 'Ownership', label: 'Does each part have a team that owns it?',
      hint: 'Boundaries hold better when someone is responsible for each side: a change to a part asks its owners.',
      default: 'team',
      options: [
        { value: 'team', label: 'yes, one owning team per part', description: 'Each part has an owning team in CODEOWNERS whose approval a change to it needs. Pick it when more than one team works in the code.' },
        { value: 'collective', label: 'no, one team owns the whole codebase', description: 'One team owns everything and any member may change any part. Pick it for a single team of up to about eight people.' },
      ],
    },
  ],
  details: [
    { key: 'RATCHET_PERCENT', label: 'By how much must the baseline of known violations shrink each quarter (%)?', default: '20', number: true },
    { key: 'KERNEL_PERCENT', label: 'At most how much of the code may the shared kernel be (% of lines)?', default: '5', number: true },
  ],
  need: {
    label: 'Parts change on their own',
    text: 'The code in this element must stay easy to understand, test and change as it grows and as people come and go. That needs parts with clear boundaries: a change to one part should not ripple through the others, each part should be testable on its own, and the rules about what may depend on what should hold because the build checks them, not because everyone remembers them.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-allowlist', label: 'Only declared dependencies', when: { RULES: ['allowlist'] }, ears_type: 'ubiquitous',
      action: 'let each part depend only on the parts it declares as allowed, with 0 undeclared dependencies between parts on the main branch outside the recorded baseline',
      rationale: 'Declaring each dependency makes it a decision visible in review; rules that are not checked erode with every shortcut (Building Evolutionary Architectures, ch. 2; Spring Modulith, allowed dependencies).',
      scenario: { label: 'Undeclared dependency found', given: 'the ordering module, allowed to use catalog only', when: 'a change makes it import a class of billing', then: 'the rule check reports the undeclared dependency naming both modules' },
    },
    {
      id: 'req-levels', label: 'Dependencies point down levels', when: { RULES: ['levels'] }, ears_type: 'ubiquitous',
      action: 'let each part depend only on parts of a lower level, with 0 dependencies on a part of the same or a higher level on the main branch outside the recorded baseline',
      rationale: 'Levels give a large number of parts one direction without a list per part (Nx, enforce module boundaries; ISO/IEC 25010 modularity).',
      scenario: { label: 'Upward dependency found', given: 'a domain library and a feature library', when: 'the domain library imports the feature library', then: 'the rule check reports the dependency on a higher level' },
    },
    {
      id: 'req-public-api', label: 'Parts meet through APIs', ears_type: 'ubiquitous',
      action: 'let a part use another only through that part\'s published API (its public package or index), with 0 imports of another part\'s internal files and 0 queries on another part\'s tables',
      rationale: 'A part whose internals others reach into cannot change them alone, and cannot later be extracted (Fowler, BoundedContext; Spring Modulith, application modules).',
      scenario: { label: 'Internal access refused', given: 'two parts, each with a published API', when: 'one imports the other\'s internal class', then: 'the rule check reports it and the build fails' },
    },
    {
      id: 'req-cycles', label: 'No cycles between parts', ears_type: 'ubiquitous',
      action: 'keep the dependency graph between parts free of cycles, with 0 cycles between modules, packages or libraries',
      rationale: 'Parts in a cycle can only be understood, tested and released together, which makes them one part (Acyclic Dependencies Principle, R. C. Martin; ISO/IEC 25010 modularity).',
      scenario: { label: 'Cycle refused', given: 'two parts where A depends on B', when: 'a change makes B depend on A', then: 'the rule check reports the cycle with both parts named and the change is not merged' },
    },
    {
      id: 'req-fail', label: 'Violations fail the build', when: { ENFORCE: ['fail'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a change adds a dependency the rules forbid or a cycle',
      action: 'fail the build of that change before it can be merged, naming the rule and the two parts involved',
      rationale: 'A violation is cheapest to fix in the pull request that brings it; after the merge others start to depend on it (Building Evolutionary Architectures, atomic fitness functions).',
      scenario: { label: 'Violation blocks merge', given: 'a pull request that adds a forbidden dependency', when: 'the build runs', then: 'the build fails naming the rule and both parts, and the pull request cannot be merged' },
    },
    {
      id: 'req-ratchet', label: 'Known violations shrink', when: { ENFORCE: ['ratchet'] }, ears_type: 'state-driven',
      precondition: 'known violations remain in the recorded baseline',
      action: 'fail any change that adds a violation outside the baseline, and shrink the baseline by at least {{RATCHET_PERCENT}}% each quarter',
      rationale: 'An old codebase cannot be fixed at once; freezing what is there stops it getting worse while the baseline records the debt to pay down (ArchUnit FreezingArchRule, dependency-cruiser known violations).',
      scenario: { label: 'Baseline holds and shrinks', given: 'a baseline of known violations', when: 'a change adds a new violation, and a quarter ends', then: 'the change fails the build, and the baseline holds at least {{RATCHET_PERCENT}}% fewer violations than a quarter earlier' },
    },
    {
      id: 'req-kernel', label: 'Shared kernel stays small', when: { SHARED: ['kernel'] }, ears_type: 'ubiquitous',
      action: 'keep in the shared kernel only types and contracts used by at least two parts, with no I/O, framework or rule of a single part, at most {{KERNEL_PERCENT}}% of the code, and changes approved by an owner of every part that uses it',
      rationale: 'A shared kernel is shared on purpose and kept small; a growing "common" folder couples everything to everything (Evans, Domain-Driven Design, Shared Kernel).',
      scenario: { label: 'Kernel stays small', given: 'the shared kernel', when: 'a change adds code used by one part only, or the kernel passes {{KERNEL_PERCENT}}% of the lines', then: 'the check fails and the change is moved into the part that uses it' },
    },
    {
      id: 'req-library', label: 'Shared libraries are versioned', when: { SHARED: ['library'] }, ears_type: 'event-driven',
      trigger: 'shared code changes',
      action: 'publish it as a new semantic version of its library, and keep every consumer at most one major version behind the latest for no longer than 90 days',
      rationale: 'Versioned libraries let each part upgrade on its own schedule; bounding the lag keeps old versions from piling up (Semantic Versioning 2.0.0).',
      scenario: { label: 'Library upgraded in time', given: 'a shared library and its consumers', when: 'a new major version is published', then: 'within 90 days every consumer is on it or the previous major' },
    },
    {
      id: 'req-no-shared', label: 'Nothing shared but contracts', when: { SHARED: ['none'] }, ears_type: 'ubiquitous',
      action: 'share no source code between parts apart from third-party libraries and API clients generated from published contracts, with 0 imports of another part\'s code',
      rationale: 'Every shared line is a reason for two teams to coordinate; duplication of small helpers is cheaper than that coupling (Building Evolutionary Architectures, coupling).',
      scenario: { label: 'Cross-part import refused', given: 'two parts', when: 'one imports a helper from the other', then: 'the rule check reports it and the build fails' },
    },
    {
      id: 'req-owners', label: 'Every part has an owner', when: { OWNERS: ['team'] }, ears_type: 'ubiquitous',
      action: 'name an owning team in CODEOWNERS for 100% of the parts, and require that team\'s approval to merge a change to its part',
      rationale: 'A boundary nobody owns is crossed by whoever is in a hurry; owners review what crosses theirs (Conway\'s law; GitHub CODEOWNERS).',
      scenario: { label: 'Owner approves change', given: 'a part owned by a team', when: 'someone outside the team opens a pull request changing it', then: 'the pull request cannot be merged until the owning team approves it' },
    },
  ],
  adrs: [
    {
      id: 'adr-allowlist', label: 'Declared dependencies only', when: { RULES: ['allowlist'] },
      decision: 'Each part (module, package or library) declares the parts it may depend on and exposes a published API; any other dependency, any access to another part\'s internals and any cycle fails the rule check, which runs as a test in every build ({{ENFORCE}}). Shared code: {{SHARED}}. Ownership: {{OWNERS}}. The checker by stack: Spring Modulith (@ApplicationModule(allowedDependencies = …) with ApplicationModules.verify()) for Spring Boot, ArchUnit slices for other JVM code, import-linter contracts for Python, NetArchTest for .NET, dependency-cruiser with an explicit map for TypeScript. Pick the one that runs as a unit test in the existing test runner, so a violation shows up like any failing test.',
      consequences: '• Every dependency between parts is a visible decision, reviewed when it is added.\n• The declarations are code to maintain: adding a dependency means changing two lines and convincing a reviewer.\n• Boundaries hold only while the check runs in every build.\n• With many parts the lists become noise; levels scale better.',
      alternatives: '1. Levels: one rule for many parts, but less precise between peers.\n2. Only forbidding known-bad dependencies: easy to start, but anything not foreseen is allowed.\n3. No checked rules: fastest to start, and boundaries erode within months.',
    },
    {
      id: 'adr-levels', label: 'Parts ranked in levels', when: { RULES: ['levels'] },
      decision: 'Each part is tagged with a level (app, feature, data-access, domain, util; or the levels the codebase needs) and may depend only on parts of lower levels and only through their public entry point; cycles are forbidden. The rules run in every build ({{ENFORCE}}). Shared code: {{SHARED}}. Ownership: {{OWNERS}}. The checker by stack: Nx\'s @nx/enforce-module-boundaries with type tags (plus scope tags per domain) in a TypeScript monorepo, eslint-plugin-boundaries without Nx, ArchUnit layeredArchitecture() over module packages on the JVM, import-linter\'s layers contract for Python.',
      consequences: '• One rule covers dozens of parts; a new library only needs its tags.\n• Peers at the same level cannot use each other, which pushes shared code down a level.\n• Says nothing about which domain may use which; add scope tags when that matters.\n• Boundaries hold only while the lint runs in every build.',
      alternatives: '1. Per-part lists: precise, but unmaintainable for dozens of parts.\n2. Separate repositories per part: strong boundaries, slow cross-part changes.\n3. No checked rules: boundaries erode within months.',
    },
    {
      id: 'adr-shared-kernel', label: 'A small shared kernel', when: { SHARED: ['kernel'] },
      decision: 'Code shared between parts lives in one shared kernel: value types and contracts (money, identifiers, event schemas) used by at least two parts, with no I/O, no framework and no rule of a single part, at most {{KERNEL_PERCENT}}% of the source lines. Every part that uses the kernel has an owner among its CODEOWNERS, so a change to it is approved by them all.',
      consequences: '• Parts speak the same language about the few concepts they share.\n• Every kernel change is a change to every part that uses it, hence the approvals and the size limit.\n• Helpers that are convenient but not shared concepts stay in the parts and are sometimes duplicated.',
      alternatives: '1. Versioned internal libraries: each part upgrades on its own schedule.\n2. Nothing shared: no coupling through code, at the cost of duplication.\n3. A free-for-all "common" folder: easy, and it couples everything to everything.',
    },
    {
      id: 'adr-shared-libraries', label: 'Versioned internal libraries', when: { SHARED: ['library'] },
      decision: 'Code shared between parts is published as internal libraries with semantic versions to the internal registry (npm, Maven, NuGet or PyPI on Artifactory, GitHub Packages or a cloud artifact registry). Each part upgrades on its own schedule; Renovate opens the upgrade pull requests, minor and patch versions merge automatically on green builds, and no consumer stays more than one major version behind for over 90 days.',
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
      id: 'ff-cycles', label: 'No dependency cycles', category: 'structural', implements: RULE_ADRS,
      threshold: '0 cycles between modules, packages or libraries on the main branch',
      description: 'A dependency rule in the build fails on any cycle between the folders that make up the parts. On the JVM the same check is ArchUnit\'s slices().matching("..(*)..").should().beFreeOfCycles(); for Python, import-linter\'s independence contract.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'no-circular',
    comment: 'ADR Module boundaries: parts in a cycle are one part',
    severity: 'error',
    from: { path: '^src/' },
    to: { circular: true },
  }],
  options: { tsConfig: { fileName: 'tsconfig.json' }, doNotFollow: { path: 'node_modules' } },
}
// package.json: "check:deps": "depcruise src --config .dependency-cruiser.cjs"`,
    },
    {
      id: 'ff-public-api', label: 'Only public APIs used', category: 'structural', implements: RULE_ADRS,
      threshold: '0 imports from one part into another part\'s internal files',
      description: 'A dependency rule allows a part to import another only through its index (the published API); a deep import into another part\'s folder fails the build. Spring Modulith\'s verify() and Nx\'s module boundaries do the same in their stacks.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'only-through-public-api',
    comment: 'ADR Module boundaries: parts meet through their published API',
    severity: 'error',
    from: { path: '^src/modules/([^/]+)/' },
    to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\\\.ts$'] },
  }],
}`,
    },
    {
      id: 'ff-allowlist', label: 'Only declared dependencies', when: { RULES: ['allowlist'] }, category: 'structural', implements: ['adr-allowlist'],
      threshold: '0 dependencies on modules a module does not declare, 0 accesses to internals and 0 cycles between modules',
      description: 'Each module declares its allowed dependencies in package-info.java; a test lets Spring Modulith find the modules and verify every dependency against those lists, and writes the module diagram. In Python, import-linter contracts per module do the same.',
      tool: 'Spring Modulith (ArchUnit underneath)',
      language: 'java',
      snippet: `// ordering/package-info.java
@ApplicationModule(allowedDependencies = { "catalog", "customer::api" })
package com.example.shop.ordering;

class ModuleStructureTest {
  static final ApplicationModules modules = ApplicationModules.of(ShopApplication.class);

  @Test
  void modulesUseOnlyDeclaredDependencies() {
    modules.verify(); // fails on undeclared dependencies, internals and cycles
  }

  @Test
  void writeDocumentation() {
    new Documenter(modules).writeModulesAsPlantUml();
  }
}`,
    },
    {
      id: 'ff-levels', label: 'Dependencies point down levels', when: { RULES: ['levels'] }, category: 'structural', implements: ['adr-levels'],
      threshold: '0 dependencies on a library of the same or a higher level',
      description: 'Each Nx project is tagged with its level; the lint rule fails when a project depends on a project of a level it may not use, or imports past a library\'s public entry point.',
      tool: 'Nx module boundaries (@nx/enforce-module-boundaries)',
      language: 'js',
      snippet: `// eslint.config.mjs
import nx from '@nx/eslint-plugin'
export default [
  ...nx.configs['flat/base'],
  {
    files: ['**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': ['error', {
        enforceBuildableLibDependency: true,
        depConstraints: [
          { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:feature', 'type:data-access', 'type:domain', 'type:util'] },
          { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:data-access', 'type:domain', 'type:util'] },
          { sourceTag: 'type:data-access', onlyDependOnLibsWithTags: ['type:domain', 'type:util'] },
          { sourceTag: 'type:domain', onlyDependOnLibsWithTags: ['type:util'] },
          { sourceTag: 'type:util', onlyDependOnLibsWithTags: [] },
        ],
      }],
    },
  },
]`,
    },
    {
      id: 'ff-ratchet', label: 'Known violations frozen', when: { ENFORCE: ['ratchet'] }, category: 'structural', implements: RULE_ADRS,
      threshold: '0 new violations outside the baseline; the baseline shrinks by at least {{RATCHET_PERCENT}}% each quarter',
      description: 'The rules run with today\'s violations frozen in a baseline committed to the repository: a new violation fails, a fixed one is removed from the store automatically. A quarterly review compares the size of the baseline with the quarter before. With dependency-cruiser the same is `depcruise-baseline` and `--ignore-known`.',
      tool: 'ArchUnit FreezingArchRule',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop")
class FrozenRulesTest {
  // archunit.properties:
  //   freeze.store.default.path=src/test/resources/archunit_store
  //   freeze.store.default.allowStoreCreation=true   (first run only)
  //   freeze.refreeze=false
  @ArchTest
  static final ArchRule noCycles =
      freeze(slices().matching("com.example.shop.(*)..").should().beFreeOfCycles());

  @ArchTest
  static final ArchRule noInternals =
      freeze(noClasses().that().resideInAPackage("com.example.shop.ordering..")
          .should().dependOnClassesThat().resideInAPackage("com.example.shop.billing.internal.."));
}`,
    },
    {
      id: 'ff-kernel', label: 'Shared kernel stays small', when: { SHARED: ['kernel'] }, category: 'structural', implements: ['adr-shared-kernel'],
      threshold: 'The shared kernel imports no part and no I/O library, and holds at most {{KERNEL_PERCENT}}% of the source lines',
      description: 'A dependency rule keeps the kernel free of the parts and of I/O; a second step in the same job compares the kernel\'s line count with the whole and fails above the limit.',
      tool: 'dependency-cruiser and cloc',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'kernel-depends-on-nothing',
    comment: 'ADR A small shared kernel: types and contracts only',
    severity: 'error',
    from: { path: '^src/shared-kernel/' },
    to: { path: ['^src/modules/', 'node_modules/(pg|mongodb|axios|express|fastify|kafkajs)'] },
  }],
}
// CI: fail when the kernel passes the limit
// kernel=$(cloc --json src/shared-kernel | jq '.SUM.code'); all=$(cloc --json src | jq '.SUM.code')
// [ $((kernel * 100 / all)) -le {{KERNEL_PERCENT}} ]`,
    },
    {
      id: 'ff-library', label: 'Library versions not left behind', when: { SHARED: ['library'] }, category: 'process', implements: ['adr-shared-libraries'],
      threshold: 'An update pull request for a new internal library version is opened within 1 day; no consumer stays more than one major version behind for over 90 days',
      description: 'Renovate watches the internal registry and opens a pull request in every consumer when a shared library is released; patch and minor versions merge automatically on green tests, majors go to the owning team, and the dependency dashboard shows who lags.',
      tool: 'Renovate',
      language: 'json',
      snippet: `{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", ":dependencyDashboard"],
  "packageRules": [
    {
      "matchPackageNames": ["@shop/**"],
      "groupName": "internal libraries",
      "schedule": ["at any time"],
      "automerge": true,
      "matchUpdateTypes": ["minor", "patch"]
    },
    {
      "matchPackageNames": ["@shop/**"],
      "matchUpdateTypes": ["major"],
      "labels": ["internal-major"],
      "prPriority": 5
    }
  ]
}`,
    },
    {
      id: 'ff-no-shared', label: 'No code shared between parts', when: { SHARED: ['none'] }, category: 'structural', implements: ['adr-share-nothing'],
      threshold: '0 imports from one part\'s folder into another\'s',
      description: 'A dependency rule forbids any import from one part into another; generated API clients live in each consumer and are generated from the provider\'s published contract.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'parts-share-nothing',
    comment: 'ADR Parts share no code',
    severity: 'error',
    from: { path: '^src/modules/([^/]+)/' },
    to: { path: '^src/modules/', pathNot: '^src/modules/$1/' },
  }],
}`,
    },
    {
      id: 'ff-owners', label: 'Every part has owners', when: { OWNERS: ['team'] }, category: 'process', implements: RULE_ADRS,
      threshold: '100% of the part folders are matched by a CODEOWNERS entry naming an existing team; branch protection requires code owner review',
      description: 'A workflow validates CODEOWNERS on every pull request: every file is owned, and each owner exists and has write access. Branch protection on main requires a review from code owners.',
      tool: 'codeowners-validator (GitHub Action) with GitHub branch protection',
      language: 'yaml',
      snippet: `# .github/workflows/codeowners.yml
name: CODEOWNERS
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mszostok/codeowners-validator@v0.7.4
        with:
          checks: "files,owners,duppatterns,syntax"
          experimental_checks: "notowned"
          github_access_token: "\${{ secrets.OWNERS_VALIDATOR_TOKEN }}"`,
    },
  ],
}

export default pack
