import type { PackSpec } from '../../src/packSpec'

const STYLES = ['adr-layered', 'adr-hexagonal', 'adr-modular', 'adr-services']
const FORCES = 'Code lives in this element and keeps changing. Without written and checked rules, every shortcut adds a dependency nobody decided on: the user interface reaches into the database, one domain reads another\'s tables, two packages import each other, and a "common" folder grows until every change touches everything. The forces: rules kept only in a wiki erode within months; a cycle makes two parts one, so neither can be tested, owned or released alone; splitting into services early buys network calls and distributed failure before the domain boundaries are known; sharing code saves typing but couples the teams that share it; and an old codebase cannot fix every violation at once.'

const pack: PackSpec = {
  id: 'concern-module-boundaries',
  name: 'Module boundaries',
  group: 'maintainability',
  description: 'How the code is cut into parts, which way the dependencies between them may point, and how the build keeps it that way.',
  tags: ['maintainability', 'modularity', 'dependencies', 'architecture rules', 'hexagonal', 'modular monolith'],
  concern: {
    id: 'module-boundaries',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements, so how it is cut into parts and which way its dependencies point has to be decided.',
  },
  sources: [
    { title: 'ISO/IEC 25010, Maintainability: modularity, analysability, modifiability, testability', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
    { title: 'Ford, Parsons, Kua, Sadalage: Building Evolutionary Architectures, 2nd ed. (fitness functions)', url: 'https://www.oreilly.com/library/view/building-evolutionary-architectures/9781492097532/' },
    { title: 'Alistair Cockburn: Hexagonal architecture (ports and adapters)', url: 'https://alistair.cockburn.us/hexagonal-architecture/' },
    { title: 'Martin Fowler: MonolithFirst', url: 'https://martinfowler.com/bliki/MonolithFirst.html' },
    { title: 'Martin Fowler: BoundedContext', url: 'https://martinfowler.com/bliki/BoundedContext.html' },
    { title: 'ArchUnit user guide', url: 'https://www.archunit.org/userguide/html/000_Index.html' },
    { title: 'dependency-cruiser', url: 'https://github.com/sverweij/dependency-cruiser' },
  ],
  questions: [
    {
      key: 'STYLE', title: 'Structure', label: 'How is the code cut into parts?',
      hint: 'This decides which way dependencies may point and what a part is: a layer, the core and its adapters, a domain module, or a service of its own.',
      default: 'modular',
      options: [
        { value: 'layered', label: 'layers (presentation, business, data access)', description: 'Each layer uses only the one below it. Pick it for a small codebase with little domain logic (mostly forms over data), one team, and a framework that already works this way.' },
        { value: 'hexagonal', label: 'ports and adapters (hexagonal)', description: 'A domain core with no framework or database in it; adapters for HTTP, the database and messaging plug into its ports. Pick it when the domain rules are the valuable part and must be testable without infrastructure, or the infrastructure is likely to change.' },
        { value: 'modular', label: 'a modular monolith, one module per domain', description: 'One deployable, cut into modules by business domain, each with a public API and private internals and data. Pick it when there are several domains but one or two teams, or the boundaries are not yet proven: modules can become services later.' },
        { value: 'services', label: 'one service per bounded context', description: 'Each bounded context is its own deployable with its own data, owned by one team. Pick it only when several teams must release independently and the domain boundaries are known; it brings network calls, distributed failure and more to run.' },
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
      id: 'req-direction', label: 'Dependencies follow the rules', ears_type: 'ubiquitous',
      action: 'allow only the dependencies the {{STYLE}} rules permit, with 0 violations of the dependency rules on the main branch outside the recorded baseline',
      rationale: 'Rules that are not checked erode with every shortcut; a checked rule is an architectural fitness function (Building Evolutionary Architectures, ch. 2; ISO 25010 modularity).',
      scenario: { label: 'Forbidden dependency found', given: 'the dependency rules of the {{STYLE}} structure', when: 'the rule check runs over the main branch', then: 'it reports 0 violations outside the baseline' },
    },
    {
      id: 'req-cycles', label: 'No cycles between parts', ears_type: 'ubiquitous',
      action: 'keep the dependency graph between parts free of cycles, with 0 cycles between modules, layers or services',
      rationale: 'Parts in a cycle can only be understood, tested and released together, which makes them one part (Acyclic Dependencies Principle, R. C. Martin; ISO 25010 modularity).',
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
      id: 'req-layers', label: 'Layers call downwards', when: { STYLE: ['layered'] }, ears_type: 'ubiquitous',
      action: 'let presentation depend only on business logic and business logic only on data access, never the reverse, with 0 HTTP or user-interface types in the business layer and 0 SQL outside data access',
      rationale: 'Layering keeps each concern in one place, so a change of screen or of database stays in its layer (Fowler, PresentationDomainDataLayering).',
      scenario: { label: 'Upward call refused', given: 'the layer rules', when: 'data-access code imports a presentation type', then: 'the rule check reports the upward dependency' },
    },
    {
      id: 'req-core', label: 'Core free of infrastructure', when: { STYLE: ['hexagonal'] }, ears_type: 'ubiquitous',
      action: 'keep the domain core free of framework, database, messaging and HTTP imports, with adapters reaching it only through its ports, so that 100% of the core\'s tests run without starting infrastructure',
      rationale: 'The domain rules are tested and changed without the infrastructure, and infrastructure is replaced without touching them (Cockburn, Hexagonal architecture).',
      scenario: { label: 'Core runs alone', given: 'the domain core and its ports', when: 'the core\'s tests run with no database, broker or web server available', then: 'all of them pass, and the rule check finds 0 infrastructure imports in the core' },
    },
    {
      id: 'req-module-api', label: 'Modules meet through APIs', when: { STYLE: ['modular'] }, ears_type: 'ubiquitous',
      action: 'let a module use another only through that module\'s published API, with 0 references to another module\'s internal packages and 0 queries on another module\'s tables',
      rationale: 'A module whose internals and data others reach into cannot change them alone, and cannot later become a service (Fowler, MonolithFirst; Spring Modulith).',
      scenario: { label: 'Internal access refused', given: 'two domain modules, each with a published API', when: 'one module imports the other\'s internal class or reads its table', then: 'the module check reports it and the build fails' },
    },
    {
      id: 'req-service-data', label: 'Each service owns its data', when: { STYLE: ['services'] }, ears_type: 'ubiquitous',
      action: 'keep each service\'s data in a store only that service reads and writes, with other services getting it through its API or events, and 0 compile-time dependencies on another service\'s code',
      rationale: 'Services that share a database or code have to change and release together, losing the reason they were split (Fowler, BoundedContext; Newman, Building Microservices).',
      scenario: { label: 'Service stays separate', given: 'two services of different bounded contexts', when: 'one of them is changed, built and deployed', then: 'the other is neither rebuilt nor redeployed, and no other service holds credentials to its store' },
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
      id: 'adr-layered', label: 'Code is layered', when: { STYLE: ['layered'] },
      decision: 'The code is cut into three layers, presentation, business logic and data access, each depending only on the one below it; SQL stays in data access and HTTP and user-interface types stay in presentation. Dependency rules are checked in the build ({{ENFORCE}}), cycles are forbidden, and shared code is {{SHARED}}. The checker by stack: ArchUnit\'s layeredArchitecture() on the JVM, NetArchTest on .NET, dependency-cruiser or eslint-plugin-boundaries for TypeScript, import-linter\'s layers contract for Python. Pick the one that runs as a unit test in the existing test runner, so a violation shows up like any failing test.',
      consequences: '• Simple to explain and matches most web frameworks, so new people find their way at once.\n• Business logic still depends on data access, so testing it needs a database or mocks of the data layer.\n• A feature cuts across all three layers; with several domains the layers grow wide and domains blur inside them.\n• Moving to modules later means cutting each layer by domain.',
      alternatives: '1. Ports and adapters: business logic without infrastructure, at the cost of ports and mapping code.\n2. A modular monolith: parts by domain rather than by technical role, better once there are several domains.\n3. No explicit structure: fastest for a prototype, and the most expensive to untangle later.',
    },
    {
      id: 'adr-hexagonal', label: 'Ports and adapters', when: { STYLE: ['hexagonal'] },
      decision: 'The code has a domain core (entities, domain services, use cases) that imports no framework, database, messaging or HTTP library; it declares ports (interfaces) for what it needs and offers, and adapters for the web, the database and the broker implement them outside the core. Dependencies point inwards only. Rules are checked in the build ({{ENFORCE}}), cycles are forbidden, and shared code is {{SHARED}}. The checker by stack: ArchUnit\'s onionArchitecture() (or jMolecules\' architecture annotations) on the JVM, NetArchTest on .NET, dependency-cruiser for TypeScript, import-linter\'s independence and layers contracts for Python.',
      consequences: '• Domain rules are tested in milliseconds without infrastructure, and infrastructure can be replaced without touching them.\n• More code: ports, adapters and the mapping between domain objects and persistence or transport models.\n• Framework conveniences that reach into the domain (ORM annotations on entities, validation annotations) are given up or kept in adapters.\n• Says nothing about cutting the core by domain: with several domains combine it with modules.',
      alternatives: '1. Layers: less code and closer to the framework, but business logic depends on data access.\n2. A modular monolith with layers inside each module: cuts by domain first.\n3. Clean or onion architecture: the same inward rule with more named rings; pick the vocabulary the team knows.',
    },
    {
      id: 'adr-modular', label: 'A modular monolith', when: { STYLE: ['modular'] },
      decision: 'The element is one deployable cut into modules, one per business domain (bounded context). Each module has a published API (a public package or index, plus the events it publishes) and keeps its classes and tables private; other modules use only the API or its events. Cycles between modules are forbidden. Rules are checked in the build ({{ENFORCE}}), shared code is {{SHARED}}. The checker by stack: Spring Modulith (ApplicationModules.verify(), built on ArchUnit) for Spring Boot, ArchUnit slices for other JVM code, Nx module boundaries or eslint-plugin-boundaries for TypeScript monorepos, import-linter for Python, NetArchTest for .NET. Tables are prefixed or in a schema per module, so a cross-module query is visible.',
      consequences: '• Boundaries by domain without the network: one deploy, local calls, one transaction where it is really needed.\n• A module with a clean API and private data can be extracted into a service later, when a team or a scaling need justifies it.\n• All modules release together, so a broken module blocks the release of the others.\n• The boundaries hold only while the check runs in every build.',
      alternatives: '1. Services per bounded context: independent releases and scaling, at the cost of network calls, distributed data and more to run.\n2. Layers only: simpler, but domains blur inside wide layers.\n3. Separate repositories per module: strong boundaries, but versioning and cross-module changes get slow.',
    },
    {
      id: 'adr-services', label: 'A service per bounded context', when: { STYLE: ['services'] },
      decision: 'Each bounded context is a service of its own: its own deployable, its own data store that no other service reads, and one owning team. Services talk only through published APIs and events with versioned contracts; there are no compile-time dependencies between services and no shared database. Inside a service the code is layered or hexagonal. Rules are checked in the build ({{ENFORCE}}), cycles of calls between services are forbidden, and shared code is {{SHARED}}. The checker: Nx module boundaries (tags per service) or dependency-cruiser in a monorepo, ArchUnit per JVM service; across repositories, separate builds make code coupling impossible, and the remaining coupling is checked through contracts (Pact).',
      consequences: '• Teams release, scale and choose technology per service without waiting for each other.\n• Every call between contexts is a network call that can fail or be slow, and a business operation across services needs sagas or events instead of one transaction.\n• More to run: per-service pipelines, observability, data stores and on-call.\n• A wrong boundary is expensive to move; the boundaries should be proven, ideally first as modules of a monolith.',
      alternatives: '1. A modular monolith: the same domain boundaries in one deployable, simpler to run, but released together.\n2. Services per technical layer (a "data service", a "UI service"): every feature touches all of them, the worst of both.\n3. A distributed monolith with a shared database: services in name only.',
    },
  ],
  fitness: [
    {
      id: 'ff-cycles', label: 'No dependency cycles', category: 'structural', implements: STYLES,
      threshold: '0 cycles between modules, layers or services on the main branch',
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
      id: 'ff-layers', label: 'Layers call downwards', when: { STYLE: ['layered'] }, category: 'structural', implements: ['adr-layered'],
      threshold: '0 layer violations: no layer is accessed by a layer below it',
      description: 'An ArchUnit test declares the three layers and which may access which; it runs with the unit tests and fails on any upward access.',
      tool: 'ArchUnit',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop")
class LayerRulesTest {
  @ArchTest
  static final ArchRule layers = layeredArchitecture().consideringAllDependencies()
      .layer("Presentation").definedBy("..web..")
      .layer("Business").definedBy("..service..")
      .layer("DataAccess").definedBy("..repository..")
      .whereLayer("Presentation").mayNotBeAccessedByAnyLayer()
      .whereLayer("Business").mayOnlyBeAccessedByLayers("Presentation")
      .whereLayer("DataAccess").mayOnlyBeAccessedByLayers("Business");
}`,
    },
    {
      id: 'ff-core', label: 'Core imports no infrastructure', when: { STYLE: ['hexagonal'] }, category: 'structural', implements: ['adr-hexagonal'],
      threshold: '0 imports from adapters, frameworks or drivers in src/core',
      description: 'Dependency rules forbid the core to import adapters or infrastructure packages, and adapters to import each other; the build fails on a violation. On the JVM, ArchUnit\'s onionArchitecture() does the same.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    {
      name: 'core-is-pure',
      comment: 'ADR Ports and adapters: the core depends on nothing outside it',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: ['^src/adapters/', 'node_modules/(express|fastify|@nestjs|pg|mongodb|kafkajs|amqplib|axios|prisma|@prisma)'] },
    },
    {
      name: 'adapters-apart',
      severity: 'error',
      from: { path: '^src/adapters/([^/]+)/' },
      to: { path: '^src/adapters/', pathNot: '^src/adapters/$1/' },
    },
  ],
}`,
    },
    {
      id: 'ff-modules', label: 'Modules use only APIs', when: { STYLE: ['modular'] }, category: 'structural', implements: ['adr-modular'],
      threshold: '0 accesses to another module\'s internals and 0 cycles between modules',
      description: 'A test lets Spring Modulith find the modules (top-level packages under the application package) and verify that each uses only the others\' API packages and that there are no cycles; it also writes the module diagram. In a TypeScript monorepo, Nx module boundaries with a tag per module does the same.',
      tool: 'Spring Modulith (ArchUnit underneath)',
      language: 'java',
      snippet: `class ModuleStructureTest {
  static final ApplicationModules modules = ApplicationModules.of(ShopApplication.class);

  @Test
  void modulesUseOnlyEachOthersApi() {
    modules.verify(); // fails on access to internals and on cycles
  }

  @Test
  void writeDocumentation() {
    new Documenter(modules).writeModulesAsPlantUml();
  }
}`,
    },
    {
      id: 'ff-services', label: 'Services do not import each other', when: { STYLE: ['services'] }, category: 'structural', implements: ['adr-services'],
      threshold: '0 imports from one service\'s project into another\'s; services depend only on projects tagged type:contract or type:util',
      description: 'In a monorepo each service is an Nx project tagged with its scope; the lint rule fails when a service imports another service or anything but contracts and utilities.',
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
          { sourceTag: 'type:service', onlyDependOnLibsWithTags: ['type:contract', 'type:util'] },
          { sourceTag: 'type:contract', onlyDependOnLibsWithTags: [] },
          { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:util'] },
        ],
      }],
    },
  },
]`,
    },
    {
      id: 'ff-ratchet', label: 'Known violations frozen', when: { ENFORCE: ['ratchet'] }, category: 'structural', implements: STYLES,
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
  static final ArchRule domainIsPure =
      freeze(noClasses().that().resideInAPackage("..domain..")
          .should().dependOnClassesThat().resideInAnyPackage("..web..", "..persistence.."));
}`,
    },
    {
      id: 'ff-kernel', label: 'Shared kernel stays small', when: { SHARED: ['kernel'] }, category: 'structural', implements: STYLES,
      threshold: 'The shared kernel imports no part and no I/O library, and holds at most {{KERNEL_PERCENT}}% of the source lines',
      description: 'A dependency rule keeps the kernel free of the parts and of I/O; a second step in the same job compares the kernel\'s line count with the whole and fails above the limit.',
      tool: 'dependency-cruiser and cloc',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'kernel-depends-on-nothing',
    comment: 'ADR Module boundaries: the shared kernel holds types and contracts only',
    severity: 'error',
    from: { path: '^src/shared-kernel/' },
    to: { path: ['^src/modules/', 'node_modules/(pg|mongodb|axios|express|fastify|kafkajs)'] },
  }],
}
// CI: fail when the kernel passes the limit
// kernel=$(cloc --json src/shared-kernel | jq '.SUM.code'); all=$(cloc --json src | jq '.SUM.code')
// [ $((kernel * 100 / all)) -le $KERNEL_PERCENT ]`,
    },
    {
      id: 'ff-library', label: 'Library versions not left behind', when: { SHARED: ['library'] }, category: 'process', implements: STYLES,
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
      id: 'ff-no-shared', label: 'No code shared between parts', when: { SHARED: ['none'] }, category: 'structural', implements: STYLES,
      threshold: '0 imports from one part\'s folder into another\'s',
      description: 'A dependency rule forbids any import from one part into another; generated API clients live in each consumer and are generated from the provider\'s published contract.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'parts-share-nothing',
    comment: 'ADR Module boundaries: parts share no code of their own',
    severity: 'error',
    from: { path: '^src/modules/([^/]+)/' },
    to: { path: '^src/modules/', pathNot: '^src/modules/$1/' },
  }],
}`,
    },
    {
      id: 'ff-owners', label: 'Every part has owners', when: { OWNERS: ['team'] }, category: 'process', implements: STYLES,
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
