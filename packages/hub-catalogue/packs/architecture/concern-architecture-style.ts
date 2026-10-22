import type { PackSpec, When } from '../../src/packSpec'

const STYLE_ADRS = ['adr-layered', 'adr-hexagonal', 'adr-clean', 'adr-slices']
const READ_ADRS = ['adr-read-models', 'adr-read-store']
const SEPARATE_READS: When = { CQRS: ['models', 'store'] }
const FORCES = 'This deployable holds code that keeps changing, and its inner structure decides where each piece of that code goes. The forces: business rules mixed with HTTP handlers, SQL and framework calls can only be tested by starting everything, and change whenever the framework does; a structure with more rings and mappings than the domain needs is ceremony that slows every feature; a feature cut across technical layers touches every layer, while a feature kept in one slice may duplicate what its neighbours do; reads and writes often want different shapes, and forcing both through one model makes either the screens or the rules awkward; and a rule that lives only in a diagram is broken by the first deadline.'

const pack: PackSpec = {
  id: 'concern-architecture-style',
  name: 'Architecture style',
  group: 'architecture',
  description: 'The structure inside one deployable: layers, ports and adapters, clean rings or vertical slices; where the business logic lives; whether reads and writes are separated; and how far the domain stays independent of the framework.',
  tags: ['architecture', 'layered', 'hexagonal', 'clean architecture', 'vertical slices', 'cqrs', 'domain model', 'ddd'],
  concern: {
    id: 'architecture-style',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these deployables, so how it is structured inside, and where its business logic goes, has to be decided.',
  },
  sources: [
    { title: 'Alistair Cockburn: Hexagonal architecture (ports and adapters)', url: 'https://alistair.cockburn.us/hexagonal-architecture/' },
    { title: 'Robert C. Martin: The Clean Architecture', url: 'https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html' },
    { title: 'Martin Fowler: PresentationDomainDataLayering', url: 'https://martinfowler.com/bliki/PresentationDomainDataLayering.html' },
    { title: 'Jimmy Bogard: Vertical Slice Architecture', url: 'https://www.jimmybogard.com/vertical-slice-architecture/' },
    { title: 'Martin Fowler: Transaction Script (Patterns of Enterprise Application Architecture)', url: 'https://martinfowler.com/eaaCatalog/transactionScript.html' },
    { title: 'Martin Fowler: AnemicDomainModel', url: 'https://martinfowler.com/bliki/AnemicDomainModel.html' },
    { title: 'Martin Fowler: CQRS', url: 'https://martinfowler.com/bliki/CQRS.html' },
    { title: 'microservices.io, Command Query Responsibility Segregation (CQRS)', url: 'https://microservices.io/patterns/data/cqrs.html' },
    { title: 'jMolecules: architecture and DDD concepts as code', url: 'https://github.com/xmolecules/jmolecules' },
    { title: 'ArchUnit user guide', url: 'https://www.archunit.org/userguide/html/000_Index.html' },
  ],
  questions: [
    {
      key: 'STYLE', title: 'Structure', label: 'How is the code inside the deployable structured?',
      hint: 'This decides what a part of the code is (a layer, the core and its adapters, a ring, a feature) and which way dependencies between those parts may point. How the system is split into deployables is the Decomposition pack; how modules are kept apart is Module boundaries.',
      default: 'hexagonal',
      options: [
        { value: 'layered', label: 'layers (presentation, business, data access)', description: 'Each layer uses only the one below it. Pick it for mostly forms over data with few business rules, one team, and a framework that already works this way (Spring MVC, ASP.NET MVC, Django, Rails).' },
        { value: 'hexagonal', label: 'ports and adapters (hexagonal)', description: 'A core with the use cases and domain rules and no framework, database or transport in it; it declares ports, and adapters for HTTP, the database and messaging implement them. Pick it when the business rules are the valuable part and must be tested without infrastructure, or when the database, broker or transport is likely to change.' },
        { value: 'clean', label: 'clean or onion rings', description: 'Concentric rings (entities, use cases, interface adapters, frameworks and drivers) with every source dependency pointing inwards and one class per use case. Pick it for a large, long-lived domain with many use cases and several delivery channels (web, API, jobs, messaging), where the extra mapping pays for itself.' },
        { value: 'slices', label: 'vertical slices, one per feature', description: 'One folder per request (a command or a query) holding its endpoint, handler, validation and data access; slices do not use each other, and only what several slices really share moves to a common domain folder. Pick it for many independent features changed at a high rate, where most changes are a new or changed request and layers would make every change touch every layer.' },
      ],
    },
    {
      key: 'LOGIC', title: 'Domain logic', label: 'Where do the business rules live?',
      hint: 'Rules kept with the data they protect hold everywhere that data changes; rules kept in procedures are simpler until the same rule is needed in a second procedure.',
      default: 'rich',
      options: [
        { value: 'rich', label: 'a rich domain model (aggregates)', description: 'Entities and aggregates carry the behaviour and protect their own invariants; state changes only through their methods and one transaction changes one aggregate (DDD tactical patterns). Pick it when there are many rules and invariants (pricing, eligibility, state machines) used by several use cases.' },
        { value: 'scripts', label: 'transaction scripts per use case', description: 'Each use case is one procedure (an application-service method or handler) that reads, decides and writes in one transaction, over simple data objects. Pick it when the rules are few and mostly validation, each belongs to one use case, and the domain is close to CRUD.' },
      ],
    },
    {
      key: 'CQRS', title: 'Reads and writes', label: 'Are reads and writes served by separate models?',
      hint: 'Screens and reports want joined, flattened data; rules want aggregates. Separating them helps when the two shapes pull apart, and costs a second model or a second store.',
      default: 'none',
      options: [
        { value: 'none', label: 'no, one model for both', description: 'Queries read the same model the commands change. Pick it when reads look like the entities they show and read and write load are of the same order.' },
        { value: 'models', label: 'separate read models, same database', description: 'Commands go through the domain model; queries read from the same database through their own query objects or SQL views shaped for the screen, never through aggregates. Pick it when screens need joins and projections the domain model should not carry, but reads must be up to date at once.' },
        { value: 'store', label: 'a separate read store, updated by events', description: 'Commands change the write store and publish events; projections update a read store (a search index, a document store, denormalised tables) a few seconds later. Pick it when reads outnumber writes by orders of magnitude, need a different technology (full-text search, aggregates for dashboards), or must scale apart, and a short staleness is acceptable.' },
      ],
    },
    {
      key: 'FRAMEWORK', title: 'Framework', label: 'How far does the domain code stay independent of the framework?',
      hint: 'Annotations from the ORM and the validation library in domain classes save mapping code, and tie the domain to those libraries and their upgrades.',
      default: 'pure',
      options: [
        { value: 'pure', label: 'fully: plain language only', description: 'Domain classes import nothing but the language and the domain itself; persistence and transport models live in adapters with explicit mapping. Pick it with ports and adapters or clean rings, a domain expected to outlive the framework, or several persistence or delivery technologies.' },
        { value: 'annotations', label: 'mapping and validation annotations allowed', description: 'Domain classes may carry ORM mapping and validation annotations (Jakarta Persistence, Bean Validation, EF Core attributes) but call no framework service, transaction, HTTP or messaging API. Pick it to save mapping code when the ORM is a settled choice and the domain is mapped one to one to tables.' },
      ],
    },
  ],
  details: [
    { key: 'DOMAIN_COVERAGE', label: 'What line coverage must the infrastructure-free unit tests reach on the domain code (%)?', default: '80', number: true },
    { key: 'READ_LAG_SECONDS', label: 'How stale may a separate read store get at the 99th percentile (seconds)?', default: '5', number: true },
  ],
  need: {
    label: 'Code structured on purpose',
    text: 'Each deployable holds code several people change every week. Where a business rule, a query, a framework call or a mapping goes should follow from a decided structure, not from whoever wrote it first: then the rules can be tested without starting a database, a change of framework or database stays in one place, a new feature has an obvious home, and reads and writes each get the shape they need. The structure has to hold as the code grows, so the build checks it.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-layers', label: 'Layers call downwards', when: { STYLE: ['layered'] }, ears_type: 'ubiquitous',
      action: 'let presentation depend only on business logic and business logic only on data access, never the reverse, with 0 HTTP or user-interface types in the business layer and 0 SQL outside data access',
      rationale: 'Layering keeps each concern in one place, so a change of screen or of database stays in its layer (Fowler, PresentationDomainDataLayering).',
      scenario: { label: 'Upward call refused', given: 'the layer rules', when: 'data-access code imports a presentation type', then: 'the rule check reports the upward dependency and the build fails' },
    },
    {
      id: 'req-ports', label: 'Core reached through ports', when: { STYLE: ['hexagonal'] }, ears_type: 'ubiquitous',
      action: 'keep the core free of framework, database, messaging and HTTP imports, let adapters reach it only through the ports it declares, and let no adapter use another adapter',
      rationale: 'The application is driven and drives the outside world only through ports, so each side can be replaced or tested alone (Cockburn, Hexagonal architecture).',
      scenario: { label: 'Adapter bypasses port', given: 'the core with its ports and the web and persistence adapters', when: 'the web adapter calls the persistence adapter directly, or the core imports a database driver', then: 'the rule check reports both and the build fails' },
    },
    {
      id: 'req-rings', label: 'Dependencies point inwards', when: { STYLE: ['clean'] }, ears_type: 'ubiquitous',
      action: 'point every source dependency inwards (frameworks and drivers, then interface adapters, then use cases, then entities), with 0 outward dependencies and each use case in a class of its own with its input and output boundaries',
      rationale: 'The dependency rule is what makes the inner rings independent of the UI, the database and the frameworks (Martin, The Clean Architecture).',
      scenario: { label: 'Outward dependency refused', given: 'the four rings', when: 'a use case imports a controller or an entity imports a repository implementation', then: 'the rule check reports the outward dependency and the build fails' },
    },
    {
      id: 'req-slices', label: 'Slices stand alone', when: { STYLE: ['slices'] }, ears_type: 'ubiquitous',
      action: 'keep each feature\'s endpoint, handler, validation and data access in its own slice, with 0 dependencies from one slice on another and shared code only in the common domain folder',
      rationale: 'Coupling is minimised between slices and maximised within one, so a change to a feature stays in its slice (Bogard, Vertical Slice Architecture).',
      scenario: { label: 'Slice uses another', given: 'the slices for placing and for cancelling an order', when: 'the cancel handler calls a class of the place-order slice', then: 'the rule check reports the dependency between slices and the build fails' },
    },
    {
      id: 'req-domain-tests', label: 'Rules tested without infrastructure', ears_type: 'ubiquitous',
      action: 'test the business rules with unit tests that start no database, broker or web server and cover at least {{DOMAIN_COVERAGE}}% of the lines of the domain code',
      rationale: 'Rules that can only be tested through the infrastructure are tested slowly and rarely; testability is part of maintainability (ISO/IEC 25010).',
      scenario: { label: 'Domain tests run alone', given: 'a build agent with no database, broker or container runtime', when: 'the domain unit tests run', then: 'they all pass and cover at least {{DOMAIN_COVERAGE}}% of the domain code\'s lines' },
    },
    {
      id: 'req-cqs', label: 'Commands and queries apart', ears_type: 'ubiquitous',
      action: 'make every operation either a command that changes state and returns at most an identifier or a result code, or a query that returns data and changes nothing',
      rationale: 'An operation that both answers and changes cannot be retried, cached or reasoned about safely (command–query separation, Meyer; Fowler, CQRS).',
      scenario: { label: 'Query changes nothing', given: 'a snapshot of the stores', when: 'every query of the deployable runs', then: 'the stores are unchanged' },
    },
    {
      id: 'req-aggregates', label: 'Aggregates guard invariants', when: { LOGIC: ['rich'] }, ears_type: 'ubiquitous',
      action: 'enforce every invariant inside the aggregate it belongs to, change an aggregate\'s state only through its methods (0 public setters on domain classes), and change at most one aggregate per transaction',
      rationale: 'Rules kept with the data they protect hold in every use case; logic in services over data-only objects is the anemic domain model (Fowler, AnemicDomainModel; Evans, Domain-Driven Design).',
      scenario: { label: 'Invariant cannot be bypassed', given: 'an order whose total may not exceed its credit limit', when: 'a use case adds a line that passes the limit, and another tries to set the total directly', then: 'the first is refused by the order itself and the second does not compile' },
    },
    {
      id: 'req-scripts', label: 'One script per use case', when: { LOGIC: ['scripts'] }, ears_type: 'ubiquitous',
      action: 'put each use case\'s business logic in one transaction script that runs in one transaction, with 0 business rules in controllers, views or database triggers and 0 calls from one script to another',
      rationale: 'A transaction script is simplest when each procedure stands alone; scripts calling each other become a domain model without its protections (Fowler, Transaction Script).',
      scenario: { label: 'Script stands alone', given: 'the scripts for placing and for cancelling an order', when: 'the rule check runs', then: 'each script is called only from entry points, runs in a transaction, and calls no other script' },
    },
    {
      id: 'req-read-models', label: 'Queries use read models', when: SEPARATE_READS, ears_type: 'ubiquitous',
      action: 'serve every query from a read model shaped for the screen or API that uses it, with 0 queries loading aggregates or using the write side\'s repositories',
      rationale: 'Separating the read side lets each model take the shape its job needs (Fowler, CQRS; microservices.io, CQRS).',
      scenario: { label: 'Query skips the aggregates', given: 'the order list screen', when: 'its query runs', then: 'it reads the order summary read model and loads no order aggregate' },
    },
    {
      id: 'req-read-lag', label: 'Read store catches up', when: { CQRS: ['store'] }, ears_type: 'event-driven',
      trigger: 'a command commits a change',
      action: 'update every read model it affects within {{READ_LAG_SECONDS}} seconds at the 99th percentile, and let a client that made the change read its own write',
      rationale: 'A separate read store is eventually consistent; bounding the lag and keeping read-your-writes makes it acceptable to users (microservices.io, CQRS).',
      scenario: { label: 'Read store catches up', given: 'a read store fed by events', when: 'an order is placed and the order list is read', then: 'the person who placed it sees it at once, and every reader within {{READ_LAG_SECONDS}} seconds' },
    },
    {
      id: 'req-pure', label: 'Domain imports no framework', when: { FRAMEWORK: ['pure'] }, ears_type: 'ubiquitous',
      action: 'keep the domain code free of framework, ORM, serialisation and validation-library imports and annotations, with 0 such imports, so that a framework upgrade changes no domain file',
      rationale: 'A domain tied to no framework outlives framework upgrades and is tested as plain code (Martin, The Clean Architecture; Cockburn, Hexagonal architecture).',
      scenario: { label: 'Framework upgrade', given: 'the domain code', when: 'the rule check runs, and later the framework is upgraded a major version', then: 'the check finds 0 framework imports and the upgrade changes no domain file' },
    },
    {
      id: 'req-annotations', label: 'Only mapping annotations', when: { FRAMEWORK: ['annotations'] }, ears_type: 'ubiquitous',
      action: 'allow in the domain code only the persistence-mapping and validation annotations of the chosen libraries, with 0 uses of framework services, transactions, HTTP or messaging APIs',
      rationale: 'Mapping annotations are declarations the domain can live with; calls into the framework make the domain depend on its runtime (jMolecules, architecture concepts as code).',
      scenario: { label: 'Framework call refused', given: 'a domain entity with mapping annotations', when: 'a change makes it call a repository or publish through the framework\'s event bus', then: 'the rule check reports it and the build fails' },
    },
  ],
  adrs: [
    {
      id: 'adr-layered', label: 'The code is layered', when: { STYLE: ['layered'] },
      decision: 'Inside the deployable the code is cut into three layers, presentation, business logic and data access, each depending only on the one below; SQL stays in data access and HTTP and user-interface types stay in presentation. Business rules: {{LOGIC}}. Reads and writes: {{CQRS}}. Domain code and the framework: {{FRAMEWORK}}. The rules are checked in the build: ArchUnit\'s layeredArchitecture() on the JVM, NetArchTest on .NET, dependency-cruiser or eslint-plugin-boundaries for TypeScript, import-linter\'s layers contract for Python; pick the one that runs as a unit test in the existing test runner.',
      consequences: '• Simple to explain and matches most web frameworks, so new people find their way at once.\n• Business logic depends on data access, so its tests need a database or mocks of the data layer.\n• A feature cuts across all three layers; with many features the layers grow wide and features blur inside them.\n• Moving to ports and adapters later means inverting the dependency between business logic and data access.',
      alternatives: '1. Ports and adapters: business logic without infrastructure, at the cost of ports and mapping code.\n2. Vertical slices: a feature in one place instead of three layers, with some duplication.\n3. No explicit structure: fastest for a prototype, and the most expensive to untangle later.',
    },
    {
      id: 'adr-hexagonal', label: 'Ports and adapters', when: { STYLE: ['hexagonal'] },
      decision: 'Inside the deployable the code has a core (domain model and use cases) that imports no framework, database, messaging or HTTP library; the core declares driving ports (the use cases it offers) and driven ports (repositories, publishers, clients it needs), and adapters outside it implement them. Dependencies point into the core only and adapters do not use each other. Business rules: {{LOGIC}}. Reads and writes: {{CQRS}}. Domain code and the framework: {{FRAMEWORK}}. The rules are checked in the build: jMolecules\' hexagonal annotations with JMoleculesArchitectureRules.ensureHexagonal() (ArchUnit) on the JVM, NetArchTest on .NET, dependency-cruiser for TypeScript, import-linter for Python.',
      consequences: '• The core is tested in milliseconds without infrastructure, and an adapter is replaced without touching it.\n• More code: ports, adapters and the mapping between core objects and persistence or transport models.\n• Framework conveniences that reach into the core (transactions, ORM lazy loading, validation by annotation) move to adapters or are given up.\n• It says nothing about cutting the core by domain: with several domains, combine it with modules (Module boundaries).',
      alternatives: '1. Layers: less code and closer to the framework, but business logic depends on data access.\n2. Clean or onion rings: the same inward rule with more named rings and one class per use case.\n3. Vertical slices: less mapping, but no common core the slices are tested against.',
    },
    {
      id: 'adr-clean', label: 'Clean architecture rings', when: { STYLE: ['clean'] },
      decision: 'Inside the deployable the code is cut into four rings: entities (enterprise rules), use cases (one interactor class per use case with its input and output boundaries), interface adapters (controllers, presenters, gateways) and frameworks and drivers (web framework, ORM, broker clients). Every source dependency points inwards; data crosses a boundary as simple structures, never as ORM entities or HTTP requests. Business rules: {{LOGIC}}. Reads and writes: {{CQRS}}. Domain code and the framework: {{FRAMEWORK}}. The rules are checked in the build: ArchUnit\'s onionArchitecture() or jMolecules\' ensureOnionClassical() on the JVM, NetArchTest on .NET, dependency-cruiser for TypeScript, import-linter\'s layers contract for Python.',
      consequences: '• Use cases read as the list of what the system does, each testable alone with fake gateways.\n• The most mapping code of the options: request, response and persistence models at every boundary.\n• Delivery channels (web, API, jobs, messages) reuse the same use cases.\n• Too much ceremony for a domain with few rules; the rings must earn their keep.',
      alternatives: '1. Ports and adapters: the same inward rule with fewer named rings.\n2. Layers: less mapping, but the business layer depends on data access.\n3. Vertical slices: each request self-contained, with less structure shared between them.',
    },
    {
      id: 'adr-slices', label: 'Vertical slices', when: { STYLE: ['slices'] },
      decision: 'Inside the deployable the code is cut by feature: one slice per request (a command or a query) holding its endpoint, request and response types, validation, handler and data access. Slices do not use each other; code moves to the common domain folder only when a second slice really needs it. Requests go through a mediator or the framework\'s routing (MediatR or Wolverine on .NET, Spring\'s handlers or Axon on the JVM, a plain handler map in TypeScript). Business rules: {{LOGIC}}. Reads and writes: {{CQRS}}. Domain code and the framework: {{FRAMEWORK}}. The rules are checked in the build: NetArchTest on .NET, ArchUnit\'s slices().should().notDependOnEachOther() on the JVM, dependency-cruiser for TypeScript.',
      consequences: '• A new or changed feature touches one folder, so changes are small and reviews focused.\n• Each slice may pick the simplest data access for its job (raw SQL for a report, the ORM for a command).\n• Some duplication between slices is accepted; rules needed by several slices must be noticed and moved to the domain.\n• Without discipline the common folder becomes a hidden layer.',
      alternatives: '1. Layers: shared technical structure, but every feature crosses every layer.\n2. Ports and adapters: a shared, infrastructure-free core, at the cost of ports and mapping.\n3. Clean rings: use cases as classes too, with full rings around them.',
    },
    {
      id: 'adr-rich-domain', label: 'A rich domain model', when: { LOGIC: ['rich'] },
      decision: 'Business rules live in a rich domain model: aggregates and entities carry behaviour, protect their invariants and change state only through their methods; value objects replace primitive types for money, quantities and identifiers; an aggregate refers to another only by identifier; one transaction changes one aggregate, and changes to others follow from domain events. Use cases (or handlers) load an aggregate, call it and save it, and hold no rules themselves. On the JVM jMolecules annotations (@AggregateRoot, @Entity, @ValueObject) mark the roles and its ArchUnit rules check them; elsewhere the same rules are written as architecture tests.',
      consequences: '• A rule is written once and holds in every use case that changes the data.\n• Domain tests are plain unit tests of objects, without mocks of repositories.\n• Mapping to the database takes care (aggregates as consistency boundaries, no lazy navigation between them).\n• Overkill for a domain that is mostly CRUD.',
      alternatives: '1. Transaction scripts: simpler for few rules, but a rule needed in two scripts gets copied.\n2. An anemic model with services: looks like a domain model but has the costs of both and the protections of neither.\n3. Rules in the database (constraints, procedures): enforced everywhere, but hard to test and to change.',
    },
    {
      id: 'adr-transaction-scripts', label: 'Transaction scripts', when: { LOGIC: ['scripts'] },
      decision: 'Business rules live in transaction scripts: each use case is one procedure (an application-service method or a request handler) that validates, reads, decides and writes in one transaction over simple data objects. Scripts are called only from entry points (controllers, message listeners, jobs) and never call each other; a rule needed by two scripts moves into a small function both call. When rules start being copied between scripts, this decision is revisited in favour of a domain model.',
      consequences: '• The simplest code for a domain close to CRUD: one place per use case, easy to follow.\n• A rule needed by several use cases has to be noticed and extracted, or it is copied and drifts.\n• Tests of a script usually need the data access, so they run against an in-memory or containerised database.\n• Moving to a domain model later is a refactoring per script, not a rewrite.',
      alternatives: '1. A rich domain model: rules kept with the data in every use case, at the cost of modelling and mapping.\n2. Table module: one class per table with the rules about it; fits record-set frameworks.\n3. Rules in stored procedures: close to the data, hard to test and version.',
    },
    {
      id: 'adr-read-models', label: 'Separate read models', when: { CQRS: ['models'] },
      decision: 'Commands go through the domain model; queries go through read models of their own (query objects with SQL, database views, or jOOQ, Dapper or Kysely queries) shaped for the screen or API that uses them, on the same database, so they are up to date at once. Queries never load aggregates or use the write side\'s repositories, and the write side never reads the read models to decide.',
      consequences: '• Screens get exactly the joins and projections they need without bending the domain model.\n• Reads are consistent with writes at once, since both use one database.\n• Two models to change when a field is added that both sides need.\n• Read and write load still share one database; scaling them apart needs a separate store.',
      alternatives: '1. One model for both: less code, while reads look like the entities.\n2. A separate read store updated by events: scales reads apart, at the cost of staleness and projections to run.',
    },
    {
      id: 'adr-read-store', label: 'A separate read store', when: { CQRS: ['store'] },
      decision: 'Commands change the write store through the domain model and publish events from it (through an outbox, see the Messaging pack); projections consume them and update a read store chosen for the queries (Elasticsearch or OpenSearch for search, a document store or denormalised tables for screens, a columnar store for dashboards). Read models lag by at most {{READ_LAG_SECONDS}} seconds at the 99th percentile, and the client that made a change reads its own write (it is served from the command\'s response or waits for the projection\'s version). A projection can be rebuilt from the events.',
      consequences: '• Reads scale and pick their technology apart from writes.\n• Readers see data up to {{READ_LAG_SECONDS}} seconds old; screens have to be designed for that.\n• Projections are more code to run, watch and rebuild; their lag is an operational metric.\n• The events become a contract between the write and the read side.',
      alternatives: '1. Separate read models on the same database: fresh reads, but shared load.\n2. One model for both: the least code while reads and writes look alike.\n3. A database read replica: scales reads without projections, but keeps the write model\'s shape.',
    },
  ],
  fitness: [
    {
      id: 'ff-layers', label: 'Layers call downwards', when: { STYLE: ['layered'] }, category: 'structural', implements: ['adr-layered'],
      threshold: '0 layer violations: no layer is accessed by a layer above the one it serves',
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
      id: 'ff-hexagonal', label: 'Ports and adapters hold', when: { STYLE: ['hexagonal'] }, category: 'structural', implements: ['adr-hexagonal'],
      threshold: '0 violations of the hexagonal rules: the core depends on no adapter, adapters reach the core only through ports and do not use each other',
      description: 'Ports and adapters are marked with jMolecules\' hexagonal annotations (on package-info.java or the types); the jMolecules ArchUnit rules derive the allowed dependencies from them and fail the test on any other. On .NET, NetArchTest expresses the same rules; in TypeScript, dependency-cruiser with one forbidden rule per direction.',
      tool: 'jMolecules ArchUnit rules (ArchUnit)',
      language: 'java',
      snippet: `// adapter/web/package-info.java:        @PrimaryAdapter package com.example.shop.adapter.web;
// adapter/persistence/package-info.java: @SecondaryAdapter package com.example.shop.adapter.persistence;
// core/port/in/package-info.java:        @PrimaryPort package com.example.shop.core.port.in;
// core/port/out/package-info.java:       @SecondaryPort package com.example.shop.core.port.out;

@AnalyzeClasses(packages = "com.example.shop")
class HexagonalRulesTest {
  @ArchTest
  static final ArchRule hexagonal = JMoleculesArchitectureRules.ensureHexagonal();

  @ArchTest
  static final ArchRule coreIsPlain = noClasses().that().resideInAPackage("..core..")
      .should().dependOnClassesThat().resideInAnyPackage("org.springframework..", "jakarta.persistence..", "..adapter..");
}`,
    },
    {
      id: 'ff-rings', label: 'Rings depend inwards', when: { STYLE: ['clean'] }, category: 'structural', implements: ['adr-clean'],
      threshold: '0 dependencies from an inner ring to an outer one',
      description: 'Dependency rules forbid each ring to import any ring outside it; the build fails on a violation. On the JVM, ArchUnit\'s onionArchitecture() with domainModels, domainServices, applicationServices and adapters declares the same rings.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs, rings: src/entities < src/use-cases < src/adapters < src/frameworks
const outer = { entities: ['use-cases', 'adapters', 'frameworks'], 'use-cases': ['adapters', 'frameworks'], adapters: ['frameworks'] }
module.exports = {
  forbidden: Object.entries(outer).map(([ring, outside]) => ({
    name: \`\${ring}-depends-inwards\`,
    comment: 'ADR Clean architecture rings: source dependencies point inwards',
    severity: 'error',
    from: { path: \`^src/\${ring}/\` },
    to: { path: outside.map((o) => \`^src/\${o}/\`) },
  })),
  options: { tsConfig: { fileName: 'tsconfig.json' } },
}`,
    },
    {
      id: 'ff-slices', label: 'Slices independent', when: { STYLE: ['slices'] }, category: 'structural', implements: ['adr-slices'],
      threshold: '0 dependencies from one feature slice on another',
      description: 'A test finds the slices (namespaces under Features) and checks that none depends on another; it runs with the unit tests. On the JVM, ArchUnit\'s slices().matching("..features.(*)..").should().notDependOnEachOther() is the same rule.',
      tool: 'NetArchTest (xUnit)',
      language: 'csharp',
      snippet: `public class SliceRulesTests
{
    static readonly Assembly App = typeof(Program).Assembly;
    static readonly string[] Slices = App.GetTypes()
        .Select(t => t.Namespace).OfType<string>()
        .Where(n => n.StartsWith("Shop.Features."))
        .Select(n => string.Join('.', n.Split('.').Take(3)))
        .Distinct().ToArray();

    public static IEnumerable<object[]> SliceNames => Slices.Select(s => new object[] { s });

    [Theory, MemberData(nameof(SliceNames))]
    public void SliceDependsOnNoOtherSlice(string slice)
    {
        var result = Types.InAssembly(App).That().ResideInNamespace(slice)
            .ShouldNot().HaveDependencyOnAny(Slices.Where(s => s != slice).ToArray())
            .GetResult();
        Assert.True(result.IsSuccessful, string.Join(", ", result.FailingTypeNames ?? []));
    }
}`,
    },
    {
      id: 'ff-domain-tests', label: 'Domain tested alone', category: 'structural', implements: STYLE_ADRS,
      threshold: 'The domain unit tests run with no database, broker or container runtime and cover at least {{DOMAIN_COVERAGE}}% of the domain code\'s lines',
      description: 'The domain tests are a test project of their own that starts no infrastructure (no Testcontainers, no global setup); the coverage threshold applies to the domain folder only, and the CI job that runs them has no Docker available, so a test that needs infrastructure fails there.',
      tool: 'Vitest (coverage thresholds per glob)',
      language: 'ts',
      snippet: `// vitest.config.ts: run in a CI job without Docker
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    projects: [{ test: { name: 'domain', include: ['src/domain/**/*.test.ts'], environment: 'node' } }],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      thresholds: { 'src/domain/**': { lines: {{DOMAIN_COVERAGE}} } },
    },
  },
})`,
    },
    {
      id: 'ff-pure', label: 'Domain imports no framework', when: { FRAMEWORK: ['pure'] }, category: 'structural', implements: STYLE_ADRS,
      threshold: '0 imports of framework, ORM, serialisation or validation libraries in the domain code',
      description: 'An ArchUnit rule lets domain classes depend only on the language and the domain itself; the build fails on any other dependency. In TypeScript, a dependency-cruiser rule from src/domain to node_modules does the same.',
      tool: 'ArchUnit',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop")
class DomainPurityTest {
  @ArchTest
  static final ArchRule domainIsPlain = classes().that().resideInAPackage("..domain..")
      .should().onlyDependOnClassesThat().resideInAnyPackage("..domain..", "java..")
      .because("ADR: the domain imports no framework");
}`,
    },
    {
      id: 'ff-annotations', label: 'Only mapping annotations', when: { FRAMEWORK: ['annotations'] }, category: 'structural', implements: STYLE_ADRS,
      threshold: '0 dependencies of domain classes outside the language, the domain, Jakarta Persistence and Bean Validation',
      description: 'An ArchUnit rule allows the domain the mapping and validation annotations and nothing else of the framework; a call into Spring, a transaction API or a messaging client fails the build.',
      tool: 'ArchUnit',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop")
class DomainAnnotationsTest {
  @ArchTest
  static final ArchRule onlyMapping = classes().that().resideInAPackage("..domain..")
      .should().onlyDependOnClassesThat().resideInAnyPackage(
          "..domain..", "java..", "jakarta.persistence..", "jakarta.validation..")
      .because("ADR: mapping and validation annotations only, no framework services");
}`,
    },
    {
      id: 'ff-aggregates', label: 'Aggregates guard their state', when: { LOGIC: ['rich'] }, category: 'structural', implements: ['adr-rich-domain'],
      threshold: '0 public setters on domain classes and 0 violations of the jMolecules DDD rules (aggregates referenced by identifier only)',
      description: 'Aggregates, entities and value objects are marked with jMolecules annotations; its ArchUnit rules check that aggregates refer to each other only by identifier and entities belong to one aggregate, and a second rule forbids public setters in the domain.',
      tool: 'jMolecules DDD rules (ArchUnit)',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop")
class DomainModelRulesTest {
  @ArchTest
  static final ArchRule ddd = JMoleculesDddRules.all();

  @ArchTest
  static final ArchRule noSetters = methods().that().areDeclaredInClassesThat().resideInAPackage("..domain..")
      .and().haveNameMatching("set[A-Z].*")
      .should().notBePublic()
      .because("ADR A rich domain model: state changes through behaviour");
}`,
    },
    {
      id: 'ff-scripts', label: 'Scripts stand alone', when: { LOGIC: ['scripts'] }, category: 'structural', implements: ['adr-transaction-scripts'],
      threshold: '0 scripts called by another script; 100% of public script methods run in a transaction',
      description: 'ArchUnit rules: scripts are used only by entry points (web, messaging, jobs), and every public script method is transactional.',
      tool: 'ArchUnit',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop")
class ScriptRulesTest {
  @ArchTest
  static final ArchRule calledOnlyFromEntryPoints = classes().that().resideInAPackage("..usecase..")
      .should().onlyHaveDependentClassesThat().resideInAnyPackage("..web..", "..messaging..", "..jobs..");

  @ArchTest
  static final ArchRule oneTransactionEach = methods().that().arePublic()
      .and().areDeclaredInClassesThat().resideInAPackage("..usecase..")
      .should().beAnnotatedWith(Transactional.class);
}`,
    },
    {
      id: 'ff-read-models', label: 'Queries skip the write side', when: SEPARATE_READS, category: 'structural', implements: READ_ADRS,
      threshold: '0 dependencies from query code on aggregates or write-side repositories, and 0 from command code on read models',
      description: 'ArchUnit rules keep the two sides apart: the query package may not use the domain model or its repositories, and the command side may not read the read models.',
      tool: 'ArchUnit',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop")
class CqrsRulesTest {
  @ArchTest
  static final ArchRule queriesSkipWriteSide = noClasses().that().resideInAPackage("..query..")
      .should().dependOnClassesThat().resideInAnyPackage("..domain.model..", "..domain.repository..", "..command..");

  @ArchTest
  static final ArchRule commandsSkipReadModels = noClasses().that().resideInAPackage("..command..")
      .should().dependOnClassesThat().resideInAPackage("..query..");
}`,
    },
    {
      id: 'ff-read-lag', label: 'Read store lag bounded', when: { CQRS: ['store'] }, category: 'operational', implements: ['adr-read-store'],
      threshold: '99th percentile of projection lag at most {{READ_LAG_SECONDS}} seconds over 10 minutes',
      description: 'Each projection records, for every event it applies, the seconds between the event\'s commit and the read store update as a histogram; an alert fires when the 99th percentile passes the limit.',
      tool: 'Prometheus alerting rule',
      language: 'yaml',
      snippet: `groups:
  - name: read-models
    rules:
      - alert: ReadModelLagging
        expr: |
          histogram_quantile(0.99, sum by (le, projection) (rate(projection_lag_seconds_bucket[10m]))) > {{READ_LAG_SECONDS}}
        for: 10m
        labels: { severity: page }
        annotations:
          summary: "Projection {{ $labels.projection }} lags more than {{READ_LAG_SECONDS}} s (ADR A separate read store)"`,
    },
  ],
}

export default pack
