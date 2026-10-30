import type { PackSpec, When } from '../../src/packSpec'

const STYLE_ADRS = ['adr-layered', 'adr-hexagonal', 'adr-clean', 'adr-slices']
const READ_ADRS = ['adr-read-models', 'adr-read-store']
const SEPARATE_READS: When = { CQRS: ['models', 'store'] }
const FORCES = 'This deployable holds code that keeps changing, and its inner structure decides where each piece of that code goes. The forces: business rules mixed with HTTP handlers, SQL and framework calls can only be tested by starting everything, and change whenever the framework does; a structure with more rings and mappings than the domain needs is ceremony that slows every feature; a feature cut across technical layers touches every layer, while a feature kept in one slice may duplicate what its neighbours do; reads and writes often want different shapes, and forcing both through one model makes either the screens or the rules awkward; and a rule that lives only in a diagram is broken by the first deadline.'

const pack: PackSpec = {
  id: 'concern-architecture-style',
  name: 'Architecture style',
  group: 'architecture',
  description: 'The structure inside one deployable: layers, ports and adapters, clean rings or vertical slices; where the business logic lives; whether reads and writes are separated; and how far the domain stays independent of the framework. The snippets are for the JVM (ArchUnit, jMolecules, JaCoCo); each tool line names the .NET, TypeScript and Python equivalent.',
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
    { title: 'Eric Evans: Domain-Driven Design (reference and summary)', url: 'https://www.domainlanguage.com/ddd/' },
    { title: 'Martin Fowler: CQRS', url: 'https://martinfowler.com/bliki/CQRS.html' },
    { title: 'microservices.io, Command Query Responsibility Segregation (CQRS)', url: 'https://microservices.io/patterns/data/cqrs.html' },
    { title: 'ISO/IEC 25010, Maintainability: modularity, testability', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
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
        { value: 'hexagonal', label: 'ports and adapters (hexagonal)', description: 'A core with the use cases and domain rules and no framework, database or transport in it; it declares ports, and adapters for HTTP, the database and messaging implement them. Pick it when the business rules are the valuable part and must be tested without infrastructure, or when the database, broker or transport is likely to change. Goes with a domain kept plain of framework annotations.' },
        { value: 'clean', label: 'clean or onion rings', description: 'Concentric rings (entities, use cases, interface adapters, frameworks and drivers) with every source dependency pointing inwards and one class per use case. Pick it for a large, long-lived domain with many use cases and several delivery channels (web, API, jobs, messaging), where the extra mapping pays for itself. Goes with a domain kept plain of framework annotations.' },
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
      hint: 'Annotations from the ORM and the validation library in domain classes save mapping code, and tie the domain to those libraries and their upgrades. Only layers and vertical slices admit them: ports and adapters and clean rings keep their core plain.',
      default: 'pure',
      options: [
        { value: 'pure', label: 'plain language, no framework annotations', description: 'Domain classes import nothing but the language, the domain itself and the jMolecules role annotations; persistence and transport models live in adapters with explicit mapping. Pick it with ports and adapters or clean rings, a domain expected to outlive the framework, or several persistence or delivery technologies.' },
        { value: 'annotations', label: 'mapping and validation annotations allowed', description: 'Domain classes may carry ORM mapping and validation annotations (Jakarta Persistence and Bean Validation; EF Core attributes on .NET) but call no framework service, transaction, HTTP or messaging API. Pick it to save mapping code when the ORM is a settled choice and the domain is mapped one to one to tables; not with ports and adapters or clean rings, whose core imports no framework.' },
      ],
    },
  ],
  details: [
    { key: 'DOMAIN_COVERAGE', label: 'What line coverage must the infrastructure-free unit tests reach on the domain code (%)?', default: '80', number: true },
    { key: 'READ_LAG_SECONDS', label: 'How stale may a separate read store get at the 99th percentile (seconds)?', default: '5', number: true },
  ],
  need: {
    label: 'Code structured on purpose',
    text: 'Each deployable holds code several people change every week. Where a business rule, a query, a framework call or a mapping goes should follow from a decided structure, not from whoever wrote it first: then the rules can be tested without starting a database, a change of framework or database stays in one place, a new feature has an obvious home, and reads and writes each get the shape they need. The structure has to hold as the code grows, so the build checks it. Every rule below assumes one package layout under com.example.shop: `domain` holds the domain model (`domain.model`) and domain services (`domain.service`); `application` holds the use cases or transaction scripts and the ports (`application.port.in`, `application.port.out`); `adapter.web`, `adapter.persistence`, `adapter.messaging` and `adapter.jobs` hold the adapters, which are also the presentation and data-access layers; `features.<name>` is one vertical slice; `query` holds read models (in a slice, `features.<name>.query`). Test classes are left out of the rules.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-layers', label: 'Layers call downwards', when: { STYLE: ['layered'] }, ears_type: 'ubiquitous',
      action: 'let presentation depend only on business logic and business logic only on data access, never the reverse, with 0 HTTP or user-interface types in the business layer and 0 SQL outside data access',
      rationale: 'Layering keeps each concern in one place, so a change of screen or of database stays in its layer (Fowler, PresentationDomainDataLayering).',
      scenario: { label: 'Upward call refused', given: 'the layer rules', when: 'data-access code imports a presentation type, or a service imports a Spring MVC type', then: 'the rule check reports both and the build fails' },
    },
    {
      id: 'req-ports', label: 'Core reached through ports', when: { STYLE: ['hexagonal'] }, ears_type: 'ubiquitous',
      action: 'keep the core (domain and application) free of framework-service, database-driver, messaging and HTTP imports, let adapters reach it only through the ports it declares, and let no adapter use another adapter',
      rationale: 'The application is driven and drives the outside world only through ports, so each side can be replaced or tested alone (Cockburn, Hexagonal architecture).',
      scenario: { label: 'Adapter bypasses port', given: 'the core with its ports and the web and persistence adapters', when: 'the web adapter calls the persistence adapter directly, or the core imports a Spring class', then: 'the rule check reports both and the build fails' },
    },
    {
      id: 'req-rings', label: 'Dependencies point inwards', when: { STYLE: ['clean'] }, ears_type: 'ubiquitous',
      action: 'point every source dependency inwards (adapters, then application services, then domain services, then the domain model), with 0 outward dependencies and each use case as one interactor class in application.usecase implementing an input boundary from application.port.in',
      rationale: 'The dependency rule is what makes the inner rings independent of the UI, the database and the frameworks (Martin, The Clean Architecture).',
      scenario: { label: 'Outward dependency refused', given: 'the rings', when: 'a use case imports a controller, or an interactor is added that implements no input boundary', then: 'the rule check reports both and the build fails' },
    },
    {
      id: 'req-slices', label: 'Slices stand alone', when: { STYLE: ['slices'] }, ears_type: 'ubiquitous',
      action: 'keep each feature\'s endpoint, handler, validation and data access in its own slice under features, with 0 dependencies from one slice on another and 0 dependencies from the common domain folder on any slice',
      rationale: 'Coupling is minimised between slices and maximised within one, so a change to a feature stays in its slice (Bogard, Vertical Slice Architecture).',
      scenario: { label: 'Slice uses another', given: 'the slices for placing and for cancelling an order', when: 'the cancel handler calls a class of the place-order slice', then: 'the rule check reports the dependency between slices and the build fails' },
    },
    {
      id: 'req-domain-tests', label: 'Rules tested without infrastructure', when: { LOGIC: ['rich'] }, ears_type: 'ubiquitous',
      action: 'test the business rules with unit tests that start no database, broker or web server and cover at least {{DOMAIN_COVERAGE}}% of the lines of every domain package',
      rationale: 'Rules that can only be tested through the infrastructure are tested slowly and rarely; testability is part of maintainability (ISO/IEC 25010).',
      scenario: { label: 'Domain tests run alone', given: 'a build agent with no database, broker or container runtime', when: 'the domain unit tests run', then: 'they all pass and cover at least {{DOMAIN_COVERAGE}}% of the lines of every domain package' },
    },
    {
      id: 'req-aggregates', label: 'Aggregates guard invariants', when: { LOGIC: ['rich'] }, ears_type: 'ubiquitous',
      action: 'enforce every invariant inside the aggregate it belongs to, change an aggregate\'s state only through its methods (0 public setters on domain classes), and refer from one aggregate to another by identifier only (0 object references between aggregates)',
      rationale: 'Rules kept with the data they protect hold in every use case; logic in services over data-only objects is the anemic domain model (Fowler, AnemicDomainModel; Evans, Domain-Driven Design).',
      scenario: { label: 'Invariant cannot be bypassed', given: 'an order whose total may not exceed its credit limit', when: 'a use case adds a line that passes the limit, and another tries to set the total directly', then: 'the first is refused by the order itself and the second does not compile' },
    },
    {
      id: 'req-scripts', label: 'One script per use case', when: { LOGIC: ['scripts'] }, ears_type: 'ubiquitous',
      action: 'put each use case\'s business logic in one transaction script (a class named *Script) that runs in one transaction, with 0 business rules in controllers, views or database triggers and 0 calls from one script to another',
      rationale: 'A transaction script is simplest when each procedure stands alone; scripts calling each other become a domain model without its protections (Fowler, Transaction Script).',
      scenario: { label: 'Script stands alone', given: 'the scripts for placing and for cancelling an order', when: 'the rule check runs', then: 'each script is called only from entry points, runs in a transaction, and calls no other script' },
    },
    {
      id: 'req-one-model', label: 'One model serves both', when: { CQRS: ['none'] }, ears_type: 'ubiquitous',
      action: 'serve queries and commands from the one model, with 0 read-model packages or projections in the deployable, and let a query change nothing',
      rationale: 'A read side that appears without a decision is the second model with none of its benefits; keeping it out until decided keeps the code to one shape (Fowler, CQRS).',
      scenario: { label: 'Read side arrives undecided', given: 'the one-model rule', when: 'a change adds a query package with read models', then: 'the rule check reports it and the build fails until a new decision separates reads and writes' },
    },
    {
      id: 'req-read-models', label: 'Queries use read models', when: SEPARATE_READS, ears_type: 'ubiquitous',
      action: 'serve every query from a read model in the query package shaped for the screen or API that uses it, with 0 queries loading aggregates or using the write side\'s repositories and 0 commands reading a read model to decide',
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
      id: 'req-rebuild', label: 'Projections can be rebuilt', when: { CQRS: ['store'] }, ears_type: 'ubiquitous',
      action: 'keep every projection rebuildable from the retained events alone, so that a read model cleared and replayed from the start of the stream equals the one built as the events arrived',
      rationale: 'A read store that cannot be rebuilt is a second source of truth; replay is what makes it disposable (Fowler, CQRS; microservices.io, CQRS).',
      scenario: { label: 'Projection rebuilt', given: 'an order summary read model built from events', when: 'it is cleared and the projection replays the stream from the start', then: 'the rebuilt read model equals the one built incrementally' },
    },
    {
      id: 'req-pure', label: 'Domain imports no framework', when: { FRAMEWORK: ['pure'] }, ears_type: 'ubiquitous',
      action: 'keep the domain code free of framework, ORM, serialisation and validation-library imports and annotations, with 0 such imports (the jMolecules role annotations excepted), so that a framework upgrade changes no domain file',
      rationale: 'A domain tied to no framework outlives framework upgrades and is tested as plain code (Martin, The Clean Architecture; Cockburn, Hexagonal architecture).',
      scenario: { label: 'Framework upgrade', given: 'the domain code', when: 'the rule check runs, and later the framework is upgraded a major version', then: 'the check finds 0 framework imports and the upgrade changes no domain file' },
    },
    {
      id: 'req-annotations', label: 'Only mapping annotations', when: { FRAMEWORK: ['annotations'] }, ears_type: 'ubiquitous',
      action: 'allow in the domain code only Jakarta Persistence and Bean Validation annotations (and the jMolecules role annotations), with 0 uses of framework services, transactions, HTTP or messaging APIs',
      rationale: 'Mapping annotations are declarations the domain can live with; calls into the framework make the domain depend on its runtime (jMolecules, architecture concepts as code).',
      scenario: { label: 'Framework call refused', given: 'a domain entity with mapping annotations', when: 'a change makes it call a repository or publish through the framework\'s event bus', then: 'the rule check reports it and the build fails' },
    },
  ],
  adrs: [
    {
      id: 'adr-layered', label: 'The code is layered', when: { STYLE: ['layered'] },
      decision: 'Inside the deployable the code is cut into three layers, presentation (adapter.web, adapter.jobs), business logic (application, domain) and data access (adapter.persistence, adapter.messaging), each depending only on the one below; SQL stays in data access and HTTP and user-interface types stay in presentation. Business rules: {{LOGIC}}. Reads and writes: {{CQRS}}. Domain code and the framework: {{FRAMEWORK}}. The rules are checked in the build with ArchUnit\'s layeredArchitecture(); NetArchTest on .NET, dependency-cruiser or eslint-plugin-boundaries for TypeScript and import-linter\'s layers contract for Python express the same rules, as a unit test in the existing test runner.',
      consequences: '• Simple to explain and matches most web frameworks, so new people find their way at once.\n• Business logic depends on data access, so its tests need a database or mocks of the data layer.\n• A feature cuts across all three layers; with many features the layers grow wide and features blur inside them.\n• Moving to ports and adapters later means inverting the dependency between business logic and data access.',
      alternatives: '1. Ports and adapters: business logic without infrastructure, at the cost of ports and mapping code.\n2. Vertical slices: a feature in one place instead of three layers, with some duplication.\n3. No explicit structure: fastest for a prototype, and the most expensive to untangle later.',
    },
    {
      id: 'adr-hexagonal', label: 'Ports and adapters', when: { STYLE: ['hexagonal'] },
      decision: 'Inside the deployable the code has a core (domain and application) that imports no framework service, database driver, messaging or HTTP library; the core declares driving ports (application.port.in, the use cases it offers) and driven ports (application.port.out: repositories, publishers, clients it needs), and the adapters outside it implement them. Dependencies point into the core only and adapters do not use each other. Business rules: {{LOGIC}}. Reads and writes: {{CQRS}}. Domain code and the framework: {{FRAMEWORK}}. The rules are checked in the build with jMolecules\' hexagonal annotations and JMoleculesArchitectureRules.ensureHexagonal() (ArchUnit); NetArchTest on .NET, dependency-cruiser for TypeScript and import-linter for Python express the same rules.',
      consequences: '• The core is tested in milliseconds without infrastructure, and an adapter is replaced without touching it.\n• More code: ports, adapters and the mapping between core objects and persistence or transport models.\n• Framework conveniences that reach into the core (transactions, ORM lazy loading, validation by annotation) move to adapters or are given up.\n• It says nothing about cutting the core by domain: with several domains, combine it with modules (Module boundaries).',
      alternatives: '1. Layers: less code and closer to the framework, but business logic depends on data access.\n2. Clean or onion rings: the same inward rule with more named rings and one class per use case.\n3. Vertical slices: less mapping, but no common core the slices are tested against.',
    },
    {
      id: 'adr-clean', label: 'Clean architecture rings', when: { STYLE: ['clean'] },
      decision: 'Inside the deployable the code is cut into rings: the domain model (domain.model, the entities), domain services (domain.service), application services (application: one interactor class per use case in application.usecase, each implementing an input boundary from application.port.in and calling output boundaries from application.port.out) and the adapters (adapter.web, adapter.persistence, adapter.messaging, adapter.jobs: controllers, presenters, gateways and the framework wiring). Every source dependency points inwards; data crosses a boundary as simple structures, never as ORM entities or HTTP requests. Business rules: {{LOGIC}}. Reads and writes: {{CQRS}}. Domain code and the framework: {{FRAMEWORK}}. The rules are checked in the build with ArchUnit\'s onionArchitecture(); NetArchTest on .NET, dependency-cruiser for TypeScript and import-linter\'s layers contract for Python express the same rules.',
      consequences: '• Use cases read as the list of what the system does, each testable alone with fake gateways.\n• The most mapping code of the options: request, response and persistence models at every boundary.\n• Delivery channels (web, API, jobs, messages) reuse the same use cases.\n• Too much ceremony for a domain with few rules; the rings must earn their keep.',
      alternatives: '1. Ports and adapters: the same inward rule with fewer named rings.\n2. Layers: less mapping, but the business layer depends on data access.\n3. Vertical slices: each request self-contained, with less structure shared between them.',
    },
    {
      id: 'adr-slices', label: 'Vertical slices', when: { STYLE: ['slices'] },
      decision: 'Inside the deployable the code is cut by feature: one slice per request (a command or a query) under features.<name>, holding its endpoint, request and response types, validation, handler and data access. Slices do not use each other; code moves to the common domain folder only when a second slice really needs it, and the domain folder knows no slice. Requests go through the framework\'s routing with one handler class per request (Spring MVC on the JVM, MediatR or Wolverine on .NET, a plain handler map in TypeScript). Business rules: {{LOGIC}}. Reads and writes: {{CQRS}}. Domain code and the framework: {{FRAMEWORK}}. The rules are checked in the build with ArchUnit\'s slices().should().notDependOnEachOther(); NetArchTest on .NET and dependency-cruiser for TypeScript express the same rule.',
      consequences: '• A new or changed feature touches one folder, so changes are small and reviews focused.\n• Each slice may pick the simplest data access for its job (raw SQL for a report, the ORM for a command).\n• Some duplication between slices is accepted; rules needed by several slices must be noticed and moved to the domain.\n• Without discipline the common folder becomes a hidden layer.',
      alternatives: '1. Layers: shared technical structure, but every feature crosses every layer.\n2. Ports and adapters: a shared, infrastructure-free core, at the cost of ports and mapping.\n3. Clean rings: use cases as classes too, with full rings around them.',
    },
    {
      id: 'adr-rich-domain', label: 'A rich domain model', when: { LOGIC: ['rich'] },
      decision: 'Business rules live in a rich domain model: aggregates and entities carry behaviour, protect their invariants and change state only through their methods; value objects replace primitive types for money, quantities and identifiers; an aggregate refers to another only by identifier; one transaction changes one aggregate, and changes to others follow from domain events. Use cases (or handlers) load an aggregate, call it and save it, and hold no rules themselves. The domain is tested by unit tests that start no infrastructure and cover at least {{DOMAIN_COVERAGE}}% of the lines of every domain package. jMolecules annotations (@AggregateRoot, @Entity, @ValueObject) mark the roles and its ArchUnit rules check them; on .NET and in TypeScript the same rules are written as architecture tests over naming conventions.',
      consequences: '• A rule is written once and holds in every use case that changes the data.\n• Domain tests are plain unit tests of objects, without mocks of repositories.\n• Mapping to the database takes care (aggregates as consistency boundaries, no lazy navigation between them).\n• Overkill for a domain that is mostly CRUD.',
      alternatives: '1. Transaction scripts: simpler for few rules, but a rule needed in two scripts gets copied.\n2. An anemic model with services: looks like a domain model but has the costs of both and the protections of neither.\n3. Rules in the database (constraints, procedures): enforced everywhere, but hard to test and to change.',
    },
    {
      id: 'adr-transaction-scripts', label: 'Transaction scripts', when: { LOGIC: ['scripts'] },
      decision: 'Business rules live in transaction scripts: each use case is one procedure in a class named *Script (an application service or a request handler) that validates, reads, decides and writes in one transaction over simple data objects. Scripts are called only from entry points (controllers, message listeners, jobs) and never call each other; a rule needed by two scripts moves into a small function both call. Tests of a script exercise its data access: through fakes of the ports with ports and adapters or clean rings, against a containerised database otherwise. When rules start being copied between scripts, this decision is revisited in favour of a domain model.',
      consequences: '• The simplest code for a domain close to CRUD: one place per use case, easy to follow.\n• A rule needed by several use cases has to be noticed and extracted, or it is copied and drifts.\n• Tests of a script need its data access, as fakes or a container, so they are slower than tests of a domain object.\n• Moving to a domain model later is a refactoring per script, not a rewrite.',
      alternatives: '1. A rich domain model: rules kept with the data in every use case, at the cost of modelling and mapping.\n2. Table module: one class per table with the rules about it; fits record-set frameworks.\n3. Rules in stored procedures: close to the data, hard to test and version.',
    },
    {
      id: 'adr-one-model', label: 'One model for reads and writes', when: { CQRS: ['none'] },
      decision: 'Reads and writes share one model: queries load the same entities or data objects the commands change, through the same repositories, and the presentation code shapes them for the screen. A query changes nothing. A screen that needs a join or projection the model cannot give gets a query method or SQL of its own in data access, recorded as the exception. This decision is revisited when reads outnumber writes by orders of magnitude, screens need projections the model should not carry, or reads must scale apart from writes.',
      consequences: '• The least code: one model, one set of repositories, no projections to run.\n• Screens are shaped like the entities; joins and projections beyond them need the recorded exceptions.\n• Read load hits the write model\'s tables and indexes; scaling reads apart later means a replica or a separate read store.\n• With a rich domain model, loading an aggregate to show a list is wasteful; the exceptions grow with the number of list screens.',
      alternatives: '1. Separate read models on the same database: screens get their shape, reads stay fresh, two models to keep.\n2. A separate read store updated by events: reads scale apart, at the cost of staleness and projections to run.\n3. A database read replica: more read capacity without a second model, same shape.',
    },
    {
      id: 'adr-read-models', label: 'Separate read models', when: { CQRS: ['models'] },
      decision: 'Commands go through the domain model; queries go through read models of their own in the query package (query objects with SQL, database views, or jOOQ, Dapper or Kysely queries) shaped for the screen or API that uses them, on the same database, so they are up to date at once. Queries never load aggregates or use the write side\'s repositories, and the write side never reads the read models to decide.',
      consequences: '• Screens get exactly the joins and projections they need without bending the domain model.\n• Reads are consistent with writes at once, since both use one database.\n• Two models to change when a field is added that both sides need.\n• Read and write load still share one database; scaling them apart needs a separate store.',
      alternatives: '1. One model for both: less code, while reads look like the entities.\n2. A separate read store updated by events: scales reads apart, at the cost of staleness and projections to run.',
    },
    {
      id: 'adr-read-store', label: 'A separate read store', when: { CQRS: ['store'] },
      decision: 'Commands change the write store through the domain model and publish events from it (through an outbox, as the Data consistency pack decides); projections in the query package consume them and update a read store chosen for the queries (Elasticsearch or OpenSearch for search, a document store or denormalised tables for screens, a columnar store for dashboards). Read models lag by at most {{READ_LAG_SECONDS}} seconds at the 99th percentile, and the client that made a change reads its own write (it is served from the command\'s response or waits for the projection\'s version). Every projection can be rebuilt by clearing its read model and replaying the stream from the start; a test proves it.',
      consequences: '• Reads scale and pick their technology apart from writes.\n• Readers see data up to {{READ_LAG_SECONDS}} seconds old; screens have to be designed for that.\n• Projections are more code to run, watch and rebuild; their lag is an operational metric.\n• The events become a contract between the write and the read side.',
      alternatives: '1. Separate read models on the same database: fresh reads, but shared load.\n2. One model for both: the least code while reads and writes look alike.\n3. A database read replica: scales reads without projections, but keeps the write model\'s shape.',
    },
  ],
  fitness: [
    {
      id: 'ff-layers', label: 'Layers call downwards', when: { STYLE: ['layered'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-layered'], checks: ['req-layers'],
      threshold: '0 layer violations: no layer is accessed by a layer above the one it serves, 0 Spring MVC or servlet types in the business layer, 0 SQL or JDBC types outside data access',
      description: 'An ArchUnit test declares the three layers and which may access which, forbids web types in the business layer and SQL outside data access; it runs with the unit tests and fails on any violation.',
      tool: 'ArchUnit (JUnit 5); for .NET: NetArchTest; for TypeScript: dependency-cruiser; for Python: import-linter layers contract',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop", importOptions = ImportOption.DoNotIncludeTests.class)
class LayerRulesTest {
  @ArchTest
  static final ArchRule layers = layeredArchitecture().consideringAllDependencies()
      .layer("Presentation").definedBy("..adapter.web..", "..adapter.jobs..")
      .layer("Business").definedBy("..application..", "..domain..")
      .layer("DataAccess").definedBy("..adapter.persistence..", "..adapter.messaging..")
      .whereLayer("Presentation").mayNotBeAccessedByAnyLayer()
      .whereLayer("Business").mayOnlyBeAccessedByLayers("Presentation")
      .whereLayer("DataAccess").mayOnlyBeAccessedByLayers("Business")
      .withOptionalLayers(true);

  @ArchTest
  static final ArchRule noWebInBusiness = noClasses().that().resideInAnyPackage("..application..", "..domain..")
      .should().dependOnClassesThat().resideInAnyPackage("org.springframework.web..", "jakarta.servlet..");

  @ArchTest
  static final ArchRule sqlOnlyInDataAccess = noClasses().that().resideOutsideOfPackage("..adapter.persistence..")
      .should().dependOnClassesThat().resideInAnyPackage("java.sql..", "javax.sql..", "org.springframework.jdbc..", "org.jooq..", "org.hibernate..");
}`,
    },
    {
      id: 'ff-hexagonal', label: 'Ports and adapters hold', when: { STYLE: ['hexagonal'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-hexagonal'], checks: ['req-ports'],
      threshold: '0 violations of the hexagonal rules: the core depends on no adapter and no framework service, adapters reach the core only through ports and do not use each other',
      description: 'Each package names its role in package-info.java with jMolecules\' hexagonal annotations; JMoleculesArchitectureRules.ensureHexagonal() derives the allowed dependencies from them and fails the test on any other, and a second rule keeps the core free of adapters and framework services (whether persistence annotations may appear in the domain is the FRAMEWORK decision, checked by its own rule).',
      tool: 'jMolecules ArchUnit rules (jmolecules-archunit with ArchUnit, JUnit 5); for .NET: NetArchTest; for TypeScript: dependency-cruiser; for Python: import-linter',
      language: 'java',
      snippet: `// package-info.java of each package names its role (org.jmolecules.architecture.hexagonal):
//   @Application      package com.example.shop.application;
//   @PrimaryPort      package com.example.shop.application.port.in;
//   @SecondaryPort    package com.example.shop.application.port.out;
//   @PrimaryAdapter   package com.example.shop.adapter.web;
//   @SecondaryAdapter package com.example.shop.adapter.persistence;

@AnalyzeClasses(packages = "com.example.shop", importOptions = ImportOption.DoNotIncludeTests.class)
class HexagonalRulesTest {
  @ArchTest
  static final ArchRule hexagonal = JMoleculesArchitectureRules.ensureHexagonal();

  @ArchTest
  static final ArchRule coreIsPlain = noClasses().that().resideInAnyPackage("..domain..", "..application..")
      .should().dependOnClassesThat().resideInAnyPackage(
          "..adapter..", "org.springframework..", "jakarta.servlet..", "jakarta.transaction..", "jakarta.jms..")
      .because("ADR Ports and adapters: the core imports no adapter and no framework service");
}`,
    },
    {
      id: 'ff-rings', label: 'Rings depend inwards', when: { STYLE: ['clean'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-clean'], checks: ['req-rings'],
      threshold: '0 dependencies from an inner ring to an outer one; 100% of the interactor classes implement an input boundary',
      description: 'ArchUnit\'s onionArchitecture() declares the rings and fails the test on any dependency pointing outwards; a second rule requires every class in application.usecase to implement an interface from application.port.in, so a use case cannot be reached except through its boundary.',
      tool: 'ArchUnit (JUnit 5); for .NET: NetArchTest; for TypeScript: dependency-cruiser; for Python: import-linter layers contract',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop", importOptions = ImportOption.DoNotIncludeTests.class)
class RingRulesTest {
  @ArchTest
  static final ArchRule rings = onionArchitecture()
      .domainModels("..domain.model..")
      .domainServices("..domain.service..")
      .applicationServices("..application..")
      .adapter("web", "..adapter.web..")
      .adapter("persistence", "..adapter.persistence..")
      .adapter("messaging", "..adapter.messaging..")
      .adapter("jobs", "..adapter.jobs..")
      .withOptionalLayers(true);

  @ArchTest
  static final ArchRule oneInteractorPerUseCase = classes().that().resideInAPackage("..application.usecase..")
      .and().areNotInterfaces()
      .should().implement(JavaClass.Predicates.resideInAPackage("..application.port.in.."))
      .because("ADR Clean architecture rings: a use case is reached only through its input boundary");
}`,
    },
    {
      id: 'ff-slices', label: 'Slices independent', when: { STYLE: ['slices'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-slices'], checks: ['req-slices'],
      threshold: '0 dependencies from one feature slice on another; 0 dependencies from the domain folder on a slice',
      description: 'ArchUnit finds the slices (the packages under features) and checks that none depends on another, and that the common domain folder depends on no slice; it runs with the unit tests.',
      tool: 'ArchUnit (JUnit 5); for .NET: NetArchTest over the Features namespaces; for TypeScript: dependency-cruiser',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop", importOptions = ImportOption.DoNotIncludeTests.class)
class SliceRulesTest {
  @ArchTest
  static final ArchRule slicesStandAlone = slices().matching("..features.(*)..").should().notDependOnEachOther();

  @ArchTest
  static final ArchRule domainKnowsNoSlice = noClasses().that().resideInAPackage("..domain..")
      .should().dependOnClassesThat().resideInAPackage("..features..")
      .because("ADR Vertical slices: the common domain folder serves the slices and knows none of them");
}`,
    },
    {
      id: 'ff-domain-tests', label: 'Domain tested alone', when: { LOGIC: ['rich'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-rich-domain'], checks: ['req-domain-tests'],
      threshold: 'The domain unit tests pass on a runner with no database, broker or container runtime and cover at least {{DOMAIN_COVERAGE}}% of the lines of every domain package',
      description: 'A Gradle task runs only the tests of the domain packages and a JaCoCo verification task checks their line coverage per domain package; CI runs the task on a runner without Docker, so a domain test that starts a container fails there.',
      tool: 'Gradle with JaCoCo (JUnit 5), on a CI runner without Docker; for .NET: coverlet with a threshold on the Domain project; for TypeScript: Vitest coverage thresholds per glob (Vitest 3.2 or later for test.projects)',
      language: 'kotlin',
      snippet: `// build.gradle.kts — CI runs \`./gradlew domainTest\` on a runner without Docker
val domainTest by tasks.registering(Test::class) {
  useJUnitPlatform()
  filter { includeTestsMatching("com.example.shop.domain.*") }
  finalizedBy("domainCoverage")
}

tasks.register<JacocoCoverageVerification>("domainCoverage") {
  executionData(domainTest.get())
  sourceSets(sourceSets.main.get())
  violationRules {
    rule {
      element = "PACKAGE"
      includes = listOf("com.example.shop.domain.*")
      limit {
        counter = "LINE"
        value = "COVEREDRATIO"
        minimum = ({{DOMAIN_COVERAGE}} / 100.0).toBigDecimal()
      }
    }
  }
}`,
    },
    {
      id: 'ff-pure', label: 'Domain imports no framework', when: { FRAMEWORK: ['pure'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: STYLE_ADRS, checks: ['req-pure'],
      threshold: '0 dependencies of domain classes outside the language, the domain itself and the jMolecules role annotations',
      description: 'An ArchUnit rule lets domain classes depend only on the language, the domain and jMolecules (annotation types count as dependencies); the build fails on any other dependency.',
      tool: 'ArchUnit (JUnit 5); for TypeScript: a dependency-cruiser rule from src/domain to node_modules; for .NET: NetArchTest HaveDependencyOnAny over the Domain namespace',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop", importOptions = ImportOption.DoNotIncludeTests.class)
class DomainPurityTest {
  @ArchTest
  static final ArchRule domainIsPlain = classes().that().resideInAPackage("..domain..")
      .should().onlyDependOnClassesThat().resideInAnyPackage("..domain..", "java..", "kotlin..", "org.jmolecules..")
      .because("ADR: the domain imports no framework; jMolecules annotations only name the roles");
}`,
    },
    {
      id: 'ff-annotations', label: 'Only mapping annotations', when: { FRAMEWORK: ['annotations'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: STYLE_ADRS, checks: ['req-annotations'],
      threshold: '0 dependencies of domain classes outside the language, the domain, jMolecules, Jakarta Persistence and Bean Validation',
      description: 'An ArchUnit rule allows the domain the mapping and validation annotations and nothing else of the framework; a call into Spring, a transaction API or a messaging client fails the build.',
      tool: 'ArchUnit (JUnit 5); for .NET: NetArchTest allowing only the EF Core and DataAnnotations namespaces',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop", importOptions = ImportOption.DoNotIncludeTests.class)
class DomainAnnotationsTest {
  @ArchTest
  static final ArchRule onlyMapping = classes().that().resideInAPackage("..domain..")
      .should().onlyDependOnClassesThat().resideInAnyPackage(
          "..domain..", "java..", "kotlin..", "org.jmolecules..", "jakarta.persistence..", "jakarta.validation..")
      .because("ADR: mapping and validation annotations only, no framework services");
}`,
    },
    {
      id: 'ff-aggregates', label: 'Aggregates guard their state', when: { LOGIC: ['rich'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-rich-domain'], checks: ['req-aggregates'],
      threshold: '0 public setters on domain classes and 0 violations of the jMolecules DDD rules (aggregates referenced by identifier only, entities inside one aggregate)',
      description: 'Aggregates, entities and value objects are marked with jMolecules annotations; JMoleculesDddRules.all() checks that aggregates refer to each other only by identifier and entities belong to one aggregate, and a second rule forbids public setters in the domain.',
      tool: 'jMolecules DDD rules (jmolecules-archunit with ArchUnit, JUnit 5); for .NET and TypeScript: an architecture test over the naming conventions of aggregates and identifiers',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop", importOptions = ImportOption.DoNotIncludeTests.class)
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
      id: 'ff-scripts', label: 'Scripts stand alone', when: { LOGIC: ['scripts'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-transaction-scripts'], checks: ['req-scripts'],
      threshold: '0 scripts depended on by another script; 100% of public script methods annotated @Transactional',
      description: 'ArchUnit rules over the classes named *Script: a script is used only by entry points and application code (never by another script), and every public method of a script is transactional.',
      tool: 'ArchUnit (JUnit 5); for .NET: NetArchTest over classes named *Script; for TypeScript: dependency-cruiser between *Script files',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop", importOptions = ImportOption.DoNotIncludeTests.class)
class ScriptRulesTest {
  @ArchTest
  static final ArchRule calledOnlyFromEntryPoints = classes().that().haveSimpleNameEndingWith("Script")
      .should().onlyHaveDependentClassesThat().resideInAnyPackage("..adapter..", "..application..", "..features..");

  @ArchTest
  static final ArchRule noScriptCallsAnother = noClasses().that().haveSimpleNameEndingWith("Script")
      .should().dependOnClassesThat().haveSimpleNameEndingWith("Script");

  @ArchTest
  static final ArchRule oneTransactionEach = methods().that().arePublic()
      .and().areDeclaredInClassesThat().haveSimpleNameEndingWith("Script")
      .should().beAnnotatedWith(Transactional.class);
}`,
    },
    {
      id: 'ff-one-model', label: 'No read side without a decision', when: { CQRS: ['none'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-one-model'], checks: ['req-one-model'],
      threshold: '0 classes in a query package and 0 projections in the deployable',
      description: 'An ArchUnit rule fails the build when a query package or a projection class appears, which would mean a read side arrived without its decision.',
      tool: 'ArchUnit (JUnit 5); for TypeScript: a dependency-cruiser rule forbidding src/query; for .NET: NetArchTest over a Query namespace',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop", importOptions = ImportOption.DoNotIncludeTests.class)
class OneModelRulesTest {
  @ArchTest
  static final ArchRule noReadSide = noClasses().should().resideInAPackage("..query..")
      .orShould().haveSimpleNameEndingWith("Projection")
      .because("ADR One model for reads and writes: supersede it before adding read models or projections");
}`,
    },
    {
      id: 'ff-read-models', label: 'Queries skip the write side', when: SEPARATE_READS, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: READ_ADRS, checks: ['req-read-models'],
      threshold: '0 dependencies from the query package on the domain, the application or the persistence adapter, and 0 from the write side on the query package',
      description: 'ArchUnit rules keep the two sides apart: the query package (or a slice\'s query package) may not use the domain model, the use cases or the write side\'s repositories, and the write side may not read the read models.',
      tool: 'ArchUnit (JUnit 5); for .NET: NetArchTest over the Query and Domain namespaces; for TypeScript: dependency-cruiser between src/query and src/domain',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.example.shop", importOptions = ImportOption.DoNotIncludeTests.class)
class CqrsRulesTest {
  @ArchTest
  static final ArchRule queriesSkipWriteSide = noClasses().that().resideInAPackage("..query..")
      .should().dependOnClassesThat().resideInAnyPackage("..domain..", "..application..", "..adapter.persistence..")
      .because("ADR: queries read their read models, never aggregates or the write side's repositories");

  @ArchTest
  static final ArchRule writeSideSkipsReadModels = noClasses().that()
      .resideInAnyPackage("..domain..", "..application..", "..features..").and().resideOutsideOfPackage("..query..")
      .should().dependOnClassesThat().resideInAPackage("..query..");
}`,
    },
    {
      id: 'ff-read-lag', label: 'Read store lag bounded', when: { CQRS: ['store'] }, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: ['adr-read-store'], checks: ['req-read-lag'],
      threshold: '99th percentile of projection lag at most {{READ_LAG_SECONDS}} seconds over 10 minutes',
      description: 'Each projection records, for every event it applies, the seconds between the event\'s commit and the read store update as a histogram projection_lag_seconds labelled with the projection; an alert fires when the 99th percentile passes the limit.',
      tool: 'Prometheus alerting rule (the histogram is exported by the projections with Micrometer)',
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
    {
      id: 'ff-projection-rebuild', label: 'Projection rebuilt from the stream', when: { CQRS: ['store'] }, characteristic: 'reliability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-read-store'], checks: ['req-rebuild'],
      threshold: 'For every projection, the read model cleared and replayed from the start of the stream equals the one built as the events arrived',
      description: 'An integration test starts the broker in a container, places an order and waits for the read model, then clears the read store, seeks the projection\'s consumer group to the start and waits for the rebuild; the two read models must be equal. One such test per projection.',
      tool: 'Testcontainers (Kafka) with Spring Boot and Awaitility (JUnit 5); for TypeScript: the same test with @testcontainers/kafka and Vitest',
      language: 'java',
      snippet: `@SpringBootTest
@Testcontainers
class OrderSummaryProjectionRebuildTest {
  @Container @ServiceConnection
  static KafkaContainer kafka = new KafkaContainer("apache/kafka:3.9.0");

  @Autowired PlaceOrderUseCase placeOrder;
  @Autowired OrderSummaryReadStore readStore;     // the read model
  @Autowired OrderSummaryProjection projection;   // its consumer, with a consumer group of its own

  @Test
  void rebuildEqualsIncrementalBuild() {
    var id = placeOrder.place(new PlaceOrder(CUSTOMER, LINES));
    await().atMost(Duration.ofSeconds({{READ_LAG_SECONDS}})).until(() -> readStore.find(id).isPresent());
    var built = readStore.find(id).orElseThrow();

    readStore.clear();
    projection.seekToBeginning();   // resets the consumer group's offsets to the start of the topic
    await().atMost(Duration.ofSeconds(30)).until(() -> readStore.find(id).isPresent());
    assertEquals(built, readStore.find(id).orElseThrow());
  }
}`,
    },
  ],
}

export default pack
