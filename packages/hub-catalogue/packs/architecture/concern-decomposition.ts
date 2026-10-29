import type { PackSpec, When } from '../../src/packSpec'

const ONE_DEPLOYABLE: When = { SPLIT: ['monolith', 'modular'] }
const MANY_DEPLOYABLES: When = { SPLIT: ['microservices', 'serverless'] }
const WITH_BOUNDARIES = ['modular', 'microservices', 'serverless']
const SPLIT_ADRS = ['adr-monolith', 'adr-modular-monolith', 'adr-microservices', 'adr-serverless']
const FORCES = 'The system has to be built, released and run by a given number of teams. How it is split into deployables decides how independently they can work and how much there is to operate. The forces: several teams in one deployable wait for each other\'s releases and step on each other\'s code; every split adds network calls that fail and are slow, data that is no longer in one transaction, and pipelines, dashboards and on-call to run (the microservice premium); boundaries drawn before the domain is understood are expensive to move once they are services; two services sharing a database are one service released twice; and an existing system cannot be replaced in one step.'

const pack: PackSpec = {
  id: 'concern-decomposition',
  name: 'Decomposition',
  group: 'architecture',
  description: 'How the system is split into deployables: one monolith, a modular monolith, microservices or serverless functions; where the boundaries go, who owns the data, and how an existing system is moved over. The checks are shell and TypeScript scripts (run with tsx) over GitHub, Kubernetes manifests, PostgreSQL and the architecture model, plus Spring Modulith for the module test; each tool line names the alternatives.',
  tags: ['architecture', 'decomposition', 'monolith', 'modular monolith', 'microservices', 'serverless', 'bounded context', 'strangler fig'],
  concern: {
    id: 'decomposition',
    trigger: 'LIST NODES WHERE type = "system" AND external != true',
    why: 'this system is built and run by people, so how it is split into deployables, and who owns which data, has to be decided.',
  },
  sources: [
    { title: 'Martin Fowler: MonolithFirst', url: 'https://martinfowler.com/bliki/MonolithFirst.html' },
    { title: 'Martin Fowler: MicroservicePremium', url: 'https://martinfowler.com/bliki/MicroservicePremium.html' },
    { title: 'James Lewis, Martin Fowler: Microservices', url: 'https://martinfowler.com/articles/microservices.html' },
    { title: 'Martin Fowler: BoundedContext', url: 'https://martinfowler.com/bliki/BoundedContext.html' },
    { title: 'Martin Fowler: StranglerFigApplication', url: 'https://martinfowler.com/bliki/StranglerFigApplication.html' },
    { title: 'microservices.io, Database per service', url: 'https://microservices.io/patterns/data/database-per-service.html' },
    { title: 'microservices.io, Shared database', url: 'https://microservices.io/patterns/data/shared-database.html' },
    { title: 'Sam Newman: Monolith to Microservices (O\'Reilly)', url: 'https://www.oreilly.com/library/view/monolith-to-microservices/9781492047834/' },
    { title: 'Sam Newman: Building Microservices, 2nd ed. (O\'Reilly)', url: 'https://www.oreilly.com/library/view/building-microservices-2nd/9781492034018/' },
    { title: 'Matthew Skelton, Manuel Pais: Team Topologies', url: 'https://teamtopologies.com/book' },
    { title: 'AWS Well-Architected Framework, Serverless Applications Lens', url: 'https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html' },
    { title: 'ISO/IEC 25010, Maintainability: modularity', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
    { title: 'Spring Modulith reference documentation', url: 'https://docs.spring.io/spring-modulith/reference/' },
  ],
  questions: [
    {
      key: 'SPLIT', title: 'Deployables', label: 'How is the system split into deployables?',
      hint: 'Each deployable is released, scaled and run on its own. More of them buy independence for teams and costs network calls, distributed data and operations. The structure inside each is the Architecture style pack.',
      default: 'modular',
      options: [
        { value: 'monolith', label: 'one monolith', description: 'One deployable and one database, without enforced inner boundaries. Pick it for one team (up to about eight people), a new product whose domain is still being discovered, or a short-lived system. Goes with one shared schema; the boundary question then says only how it would be cut later.' },
        { value: 'modular', label: 'a modular monolith', description: 'One deployable cut into modules, one per bounded context, each with a published API and its own data. Pick it for one to about three teams, when boundaries are not yet proven, or when the platform and on-call for many services are not there yet: modules can become services later. Goes with a schema per module (or a database per module where isolation matters more than cost).' },
        { value: 'microservices', label: 'microservices, one per bounded context', description: 'Each bounded context is a service with its own pipeline, data and owning team. Pick it when several teams (more than about three) must release independently, parts scale or fail differently, the boundaries are known, and there is a platform for deployment, observability and on-call per service. Goes with a database per deployable; a shared schema would make them one service released many times.' },
        { value: 'serverless', label: 'serverless functions, grouped per context', description: 'Functions (AWS Lambda, Azure Functions, Google Cloud Functions) triggered by HTTP, queues and schedules, deployed per bounded context as one stack. Pick it for spiky or low, event-driven load where paying per call beats running servers, short tasks (seconds), and a team ready to work within the provider\'s limits. Goes with a database per deployable (per stack).' },
      ],
    },
    {
      key: 'DATA', title: 'Data', label: 'Who owns which data?',
      hint: 'Data shared between parts is coupling the network does not remove: parts that read each other\'s tables have to change together. This pack owns the decision; the Data consistency pack refers to it.',
      default: 'schemas',
      options: [
        { value: 'own', label: 'a database per deployable', description: 'Each service or function group has its own database that nobody else reads; others get its data through its API or events. Pick it with microservices or serverless, or whenever parts must be released and scaled apart; not with one monolith, which has one database.' },
        { value: 'schemas', label: 'one server, a schema per module', description: 'One database server; each module has a schema and a database user of its own, and no query reaches another module\'s schema. Pick it for a modular monolith, or for services on their way out of one: cheap to run, and each schema can move to its own server later. Not with one monolith, which has no modules to give schemas to.' },
        { value: 'shared', label: 'one shared schema, writes owned', description: 'All parts use one schema; each table has one owning module that alone writes it, and others read only through views it publishes. Pick it for a monolith, or an existing system whose tables cannot be split yet. Not with microservices or serverless: services sharing a schema are one service released many times.' },
      ],
    },
    {
      key: 'BOUNDARY', title: 'Boundaries', label: 'What decides where a boundary goes?',
      hint: 'A boundary in the wrong place makes every change cross it. This decides what a module or service is cut around. With one monolith there are no enforced boundaries yet; the answer then says how it would be cut.',
      default: 'context',
      options: [
        { value: 'context', label: 'bounded contexts of the domain', description: 'Boundaries follow the bounded contexts of a context map: each holds one model and its own language (ordering, billing, shipping). Pick it when the domain is understood well enough to draw a context map, usually after an event-storming or domain-modelling workshop.' },
        { value: 'team', label: 'the teams that own them', description: 'Each stream-aligned team owns its parts end to end, and boundaries are drawn so that most changes stay within one team (Conway\'s law used on purpose). Pick it when the team structure is settled and coordination between teams is the main cost.' },
        { value: 'need', label: 'a measured need only', description: 'Everything stays together unless a part has a measured, different need: load, runtime, security zone or release rate, recorded with the numbers. Pick it when the domain is young and boundaries are not known, to avoid splitting too early.' },
      ],
    },
    {
      key: 'MIGRATION', title: 'Starting point', label: 'Is an existing system being replaced?',
      hint: 'A big-bang rewrite delays all value to the end and usually overruns; an existing system is replaced piece by piece behind a facade.',
      default: 'new',
      options: [
        { value: 'new', label: 'no, it is a new system', description: 'There is no legacy to move from. Pick it for a new product, or a new system beside existing ones that keep running.' },
        { value: 'strangler', label: 'yes, piece by piece (strangler fig)', description: 'A routing facade sits in front of the old system; capabilities are rebuilt one at a time, their traffic routed to the new parts, and the old code removed until nothing is left. Pick it whenever an existing system in use is replaced or decomposed.' },
      ],
    },
  ],
  details: [
    { key: 'TEAMS', label: 'How many teams build the system?', default: '3', number: true },
    { key: 'PER_TEAM', label: 'At most how many deployables may one team own?', default: '3', number: true },
    { key: 'BUILD_MINUTES', label: 'How long may building and testing one deployable take (minutes)?', default: '15', number: true },
    { key: 'MIGRATION_MONTHS', label: 'Within how many months must the old system be retired?', default: '24', number: true },
  ],
  need: {
    label: 'Teams deliver without waiting',
    text: 'Teams building this system: {{TEAMS}}. Each should be able to change, test and release its part without waiting for the others, while the system as a whole stays something the organisation can afford to run: every extra deployable is another pipeline, another data store, more network calls and more on-call. Who owns which data has to be clear, because shared data couples parts no matter how they are deployed; and if an existing system is being replaced, it has to keep working while it is. The checks below share one layout: each deployable lives in services/<name> with a Backstage catalog-info.yaml naming its owner (spec.owner) and a workflow .github/workflows/deploy-<name>.yml of its own; the architecture model is the Radical Markdown folder architecture/ (nodes under architecture/nodes, one Markdown file per element with its type and label in the front matter); database users are named module_<name> and tables carry their owning module in a table comment.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-inventory', label: 'Deployables are on record', ears_type: 'ubiquitous',
      action: 'record every deployable of the system in the architecture model as a container or web app, and in the service catalog with its owning team, with 0 deployable folders missing from the model',
      rationale: 'A decomposition nobody can see drifts: services appear without owners and data without a home (Newman, Building Microservices, ch. 1; ISO/IEC 25010 modularity).',
      scenario: { label: 'Every deployable known', given: 'the deployable folders under services', when: 'they are compared with the containers and web apps in the model', then: 'every folder is in the model, and the build fails naming the missing ones otherwise' },
    },
    {
      id: 'req-revisit', label: 'Decomposition revisited', ears_type: 'event-driven',
      trigger: 'building and testing a deployable passes {{BUILD_MINUTES}} minutes, two deployables are released together more than twice in a quarter, or the number of teams moves away from {{TEAMS}}',
      action: 'review this decision and record the outcome in an ADR within one month',
      rationale: 'The right split depends on teams, size and coupling, which change; these signals say the current one no longer fits (Fowler, MonolithFirst; Newman, Monolith to Microservices).',
      scenario: { label: 'Signal leads to review', given: 'the decomposition decision', when: 'the build passes {{BUILD_MINUTES}} minutes, or two services are released together for the third time in a quarter', then: 'the check fails, and within a month an ADR records whether they are merged, re-cut or left as they are' },
    },
    {
      id: 'req-build', label: 'One fast pipeline', when: ONE_DEPLOYABLE, ears_type: 'ubiquitous',
      action: 'build, test and package the whole system as one deployable in at most {{BUILD_MINUTES}} minutes from commit',
      rationale: 'A single deployable stays workable for several people only while its pipeline is fast; a slow one is the first sign it has outgrown its shape (Fowler, MonolithFirst).',
      scenario: { label: 'Build within limit', given: 'a commit to the main branch', when: 'the pipeline builds, tests and packages the deployable', then: 'it finishes within {{BUILD_MINUTES}} minutes' },
    },
    {
      id: 'req-modules', label: 'A module per context', when: { SPLIT: ['modular'] }, ears_type: 'ubiquitous',
      action: 'cut the deployable into one module per bounded context, each with a published API, its own data and an owning team, so that each module starts and passes its tests with the other modules absent',
      rationale: 'A module that runs alone can later be extracted into a service without reaching into the others (Spring Modulith, application module tests; Fowler, MonolithFirst).',
      scenario: { label: 'Module runs alone', given: 'the ordering module', when: 'its integration tests start it without the other modules', then: 'it starts and its tests pass, using only mocks of the APIs it depends on' },
    },
    {
      id: 'req-independent', label: 'Deployed independently', when: MANY_DEPLOYABLES, ears_type: 'event-driven',
      trigger: 'a service or function group changes',
      action: 'build, test and deploy it to production from a pipeline of its own that builds no other deployable, with 0 pairs of deployables released together more than twice in a quarter',
      rationale: 'Independent deployability is the reason to split; services that must be released together carry the costs of distribution without its benefit (Lewis and Fowler, Microservices; Newman, Building Microservices).',
      scenario: { label: 'One service released alone', given: 'two services where one calls the other', when: 'the called service is changed and released', then: 'it reaches production from its own pipeline and the calling service is neither rebuilt nor redeployed' },
    },
    {
      id: 'req-owners', label: 'Each team owns a few', when: MANY_DEPLOYABLES, ears_type: 'ubiquitous',
      action: 'give every deployable exactly one owning team in its catalog entry and let no team own more than {{PER_TEAM}} deployables',
      rationale: 'A service is as small as one team can own completely, building and running it; more per team than it can operate becomes neglect (Newman, Building Microservices, ch. 15; Skelton and Pais, Team Topologies).',
      scenario: { label: 'Ownership within limit', given: 'the deployables and their owning teams', when: 'the ownership is counted', then: 'each has one owner and no team owns more than {{PER_TEAM}}' },
    },
    {
      id: 'req-functions', label: 'Functions grouped per context', when: { SPLIT: ['serverless'] }, ears_type: 'ubiquitous',
      action: 'deploy the functions of one bounded context together as one stack, give each one trigger and a timeout of at most 30 seconds, and tag each with its context and owning team',
      rationale: 'Functions deployed one by one become hundreds of unowned units; grouping per context keeps the boundary and the ownership (AWS Well-Architected, Serverless Applications Lens).',
      scenario: { label: 'Function belongs somewhere', given: 'the infrastructure templates', when: 'a function without a context tag or with a 5-minute timeout is added', then: 'the template check fails' },
    },
    {
      id: 'req-own-data', label: 'Each deployable owns its data', when: { DATA: ['own'] }, ears_type: 'ubiquitous',
      action: 'let each deployable read and write only its own database, with 0 credentials to another\'s database and other data obtained through its owner\'s API or events',
      rationale: 'Shared databases couple services at the schema; each service keeping its data private is what lets it change alone (microservices.io, Database per service).',
      scenario: { label: 'No foreign credentials', given: 'the deployment manifests of every workload', when: 'the database secrets each receives are listed, as environment variables, envFrom and volumes', then: 'each receives only those of its own database' },
    },
    {
      id: 'req-schemas', label: 'A schema per module', when: { DATA: ['schemas'] }, ears_type: 'ubiquitous',
      action: 'keep each module\'s tables in a schema of its own, reachable only by that module\'s database user, with 0 queries joining or reading another module\'s schema',
      rationale: 'Schemas with their own users keep one database server cheap while making a cross-module query fail at once; each schema can later move out (microservices.io, Database per service: schema-per-service).',
      scenario: { label: 'Foreign schema refused', given: 'the ordering and billing modules with their own schemas and users', when: 'ordering\'s user selects from a billing table', then: 'the database refuses it with a permission error' },
    },
    {
      id: 'req-shared', label: 'Each table has one writer', when: { DATA: ['shared'] }, ears_type: 'ubiquitous',
      action: 'record an owning module for every table in its table comment, let only that module\'s database user insert, update or delete its rows, and let other modules read only through views the owner publishes',
      rationale: 'A shared database is the simplest store but couples everything that writes to it; single writers keep the coupling to reads (microservices.io, Shared database).',
      scenario: { label: 'Foreign write refused', given: 'the orders table owned by ordering', when: 'billing\'s database user updates a row of it', then: 'the database refuses it with a permission error' },
    },
    {
      id: 'req-contexts', label: 'Boundaries follow contexts', when: { BOUNDARY: ['context'], SPLIT: WITH_BOUNDARIES }, ears_type: 'ubiquitous',
      action: 'draw every boundary between modules or services along a bounded context of the context map, with 0 contexts split across two deployables or modules',
      rationale: 'A bounded context is the boundary inside which a model is consistent; cutting across one splits a model that has to change together (Fowler, BoundedContext).',
      scenario: { label: 'Context not split', given: 'the context map and the deployables', when: 'each context is traced to the deployables holding its code', then: 'every context is held by exactly one module or service' },
      unchecked: 'The architects trace the context map to the deployables at the quarterly architecture review; a context map is a drawing people agree on, which no tool reads.',
    },
    {
      id: 'req-team-changes', label: 'Changes stay in one team', when: { BOUNDARY: ['team'], SPLIT: WITH_BOUNDARIES }, ears_type: 'ubiquitous',
      action: 'keep the boundaries so that at least 80% of the pull requests merged in a quarter touch only the parts of one team, and redraw them when that share falls',
      rationale: 'Boundaries that match the teams keep coordination low; the share of single-team changes measures it (Conway\'s law; Skelton and Pais, Team Topologies).',
      scenario: { label: 'Changes stay with a team', given: 'the merged pull requests of a quarter and the owners of each part', when: 'each change is matched to the teams whose parts it touches', then: 'at least 80% touch the parts of one team only' },
    },
    {
      id: 'req-split-need', label: 'Splits backed by numbers', when: { BOUNDARY: ['need'] }, ears_type: 'event-driven',
      trigger: 'a part is proposed to become a deployable or module of its own',
      action: 'split it only when an ADR records the measured need: a load, runtime, security zone or release rate that differs from the rest by at least a factor of 2, or a compliance boundary',
      rationale: 'Splitting before the need is known pays the microservice premium for nothing (Fowler, MicroservicePremium).',
      scenario: { label: 'Split needs numbers', given: 'a proposal to extract the search into a service', when: 'it is reviewed', then: 'it goes ahead only with an ADR showing, for example, search load ten times the rest' },
      unchecked: 'The reviewers of the pull request that adds a deployable ask for the ADR with the numbers; whether a measured need is real is judged by people, not read by a tool.',
    },
    {
      id: 'req-strangler', label: 'Legacy replaced piece by piece', when: { MIGRATION: ['strangler'] }, ears_type: 'event-driven',
      trigger: 'a capability of the old system has been rebuilt',
      action: 'route its traffic through the routing facade to the new part, keep the route switchable back for 30 days, then remove the old code, so that the old system\'s share of requests falls every month and reaches 0 within {{MIGRATION_MONTHS}} months',
      rationale: 'The strangler fig replaces a system while it keeps running, each step small and reversible (Fowler, StranglerFigApplication; Newman, Monolith to Microservices, ch. 3).',
      scenario: { label: 'Route switched over', given: 'a rebuilt order history behind the routing facade', when: 'its route is switched to the new part and the new part fails', then: 'the route is switched back within minutes, and once stable for 30 days the old code is removed' },
    },
  ],
  adrs: [
    {
      id: 'adr-monolith', label: 'One monolith', when: { SPLIT: ['monolith'] },
      decision: 'The system is one deployable with one database, built by one pipeline in at most {{BUILD_MINUTES}} minutes and released as a whole; {{TEAMS}} team(s) work in it. Data: {{DATA}}. There are no enforced inner boundaries yet; should the code be cut later, boundaries are drawn by {{BOUNDARY}}. Starting point: {{MIGRATION}}. The decision is revisited when the number of teams grows, the build passes {{BUILD_MINUTES}} minutes, or parts need different scaling. Criteria that made it the choice: one team or very few, a domain still being discovered, no platform for running many services.',
      consequences: '• Simplest to build, test, deploy and debug: local calls, one transaction, one log.\n• Everyone releases together, so a broken part blocks the release and teams wait on each other as they grow.\n• Without enforced boundaries the code tends to tangle; moving to modules later means drawing them first, by the boundary rule above.\n• Scales as a whole: running more copies scales every part at once.\n• A new system starts with nothing to migrate; a replacement adds the facade and the deadline of the strangler decision.',
      alternatives: '1. A modular monolith: the same single deployable with enforced module boundaries, ready to split later.\n2. Microservices: independent releases per team, at the cost of distribution and operations.\n3. Serverless functions: no servers to run, but many small units and provider limits.',
    },
    {
      id: 'adr-modular-monolith', label: 'A modular monolith', when: { SPLIT: ['modular'] },
      decision: 'The system is one deployable cut into modules, one per bounded context, each with a published API, its own data and an owning team; {{TEAMS}} team(s) work in it and it is built in at most {{BUILD_MINUTES}} minutes. Boundaries are drawn by {{BOUNDARY}}; data: {{DATA}}. Starting point: {{MIGRATION}}. Each module starts and is tested on its own (Spring Modulith\'s @ApplicationModuleTest on Spring Boot; on .NET one project per module with its own test project; in TypeScript an Nx project per module). A module is extracted into a service only when a team or a measured need justifies it (Module boundaries keeps the rules between modules).',
      consequences: '• Boundaries by domain without the network: one deploy, local calls, one transaction where really needed.\n• Modules with a clean API and private data can become services later with little rework.\n• All modules release together, so one broken module blocks the others\' release.\n• One runtime: a module that needs very different scaling or technology is a reason to extract it.\n• A new system starts with nothing to migrate; a replacement adds the facade and the deadline of the strangler decision.',
      alternatives: '1. A plain monolith: simpler, but boundaries erode and splitting later is harder.\n2. Microservices from the start: independent releases, at the cost of distribution before boundaries are proven.\n3. Separate repositories per module in one deployable: strong boundaries, slow cross-module changes.',
    },
    {
      id: 'adr-microservices', label: 'Microservices per context', when: { SPLIT: ['microservices'] },
      decision: 'The system is split into services, one per bounded context, each in services/<name> with a pipeline, data store and one owning team of its own; {{TEAMS}} team(s) own at most {{PER_TEAM}} services each. Boundaries are drawn by {{BOUNDARY}}; data: {{DATA}}. Starting point: {{MIGRATION}}. Services meet only through contracts checked as the Communication style pack decides, and each is deployed on its own from its own pipeline. A service runs on the shared platform (Kubernetes with a paved-road template, or a managed container service such as ECS, Cloud Run or Azure Container Apps), with per-service dashboards and on-call. Criteria that made it the choice: more teams than one deployable can carry, parts that scale or fail differently, known boundaries, and a platform to run them.',
      consequences: '• Teams release, scale and choose technology per service without waiting for each other.\n• Every call between contexts is a network call that can fail or be slow, and an operation across services needs events or sagas instead of one transaction.\n• More to run: a pipeline, data store, dashboards and on-call per service, and a platform team to make that cheap.\n• A wrong boundary is expensive to move; boundaries should be proven, ideally first as modules.\n• A new system starts with nothing to migrate; a replacement adds the facade and the deadline of the strangler decision.',
      alternatives: '1. A modular monolith: the same boundaries in one deployable, simpler to run, released together.\n2. Services per technical layer (a data service, a UI service): every feature touches all of them.\n3. A distributed monolith with a shared database: services in name only.',
    },
    {
      id: 'adr-serverless', label: 'Serverless functions per context', when: { SPLIT: ['serverless'] },
      decision: 'The system is built from functions grouped per bounded context: each context is one stack in services/<name> (AWS SAM or AWS CDK on AWS Lambda, where the template check below runs; Bicep with Azure Functions or Terraform with Google Cloud Functions need the equivalent policy named in the check) with its functions, queues and data store, owned by one team; {{TEAMS}} team(s) own at most {{PER_TEAM}} stacks each. Each function has one trigger and a timeout of at most 30 seconds; longer work runs as a workflow (Step Functions, Durable Functions). Boundaries are drawn by {{BOUNDARY}}; data: {{DATA}}. Starting point: {{MIGRATION}}. Criteria that made it the choice: spiky or low event-driven load, short tasks, and a team at home with the provider\'s limits.',
      consequences: '• No servers to patch or scale; cost follows use and is near zero when idle.\n• Cold starts add latency to the first call after idle; latency-critical paths need provisioned concurrency.\n• Provider limits (duration, payload, concurrency) shape the design, and local testing needs emulators or a cloud sandbox.\n• Strong lock-in to the provider\'s triggers and services.\n• A new system starts with nothing to migrate; a replacement adds the facade and the deadline of the strangler decision.',
      alternatives: '1. Containers per context (microservices): no cold starts or duration limits, but servers to run.\n2. A modular monolith on a managed platform: simplest, at the cost of paying for idle capacity.\n3. One function per endpoint deployed alone: maximal granularity, unmanageable ownership.',
    },
    {
      id: 'adr-own-database', label: 'A database per deployable', when: { DATA: ['own'] },
      decision: 'Each deployable has its own database (a separate database or managed instance) and holds the only credentials to it, mounted from a Kubernetes secret named db-<deployable>; other deployables get its data through its API or by consuming its events into a copy of their own. Reports that need data from several deployables read a reporting store fed by events or change data capture (Debezium), never the services\' databases. Which element writes each table is decided here; the Data consistency pack refers to it.',
      consequences: '• Each deployable changes its schema and scales its store without asking anyone.\n• No joins or transactions across deployables: queries across them are API compositions or read models, and consistency across them is eventual.\n• More databases to back up, patch and watch.\n• Duplicated data must have one owner; copies are read-only.',
      alternatives: '1. One server with a schema per deployable: cheaper, same ownership, less isolation of load.\n2. A shared database: easy joins, but every schema change couples all its users.',
    },
    {
      id: 'adr-schema-per-module', label: 'A schema per module', when: { DATA: ['schemas'] },
      decision: 'The modules share one database server; each module has a schema and a database user of its own (module_<name>), granted only on that schema, and its migrations (Flyway or Liquibase locations, EF Core migrations per DbContext) touch only it. A module that needs another\'s data calls its API or keeps a copy fed by its events; there are no cross-schema joins or foreign keys. Which element writes each table is decided here; the Data consistency pack refers to it.',
      consequences: '• One server to run and back up, while a cross-module query fails at once.\n• A module can move to its own server later by pointing its user elsewhere.\n• No database-enforced references between modules; consistency between them is the modules\' job.\n• Load is still shared: a heavy module slows the others.',
      alternatives: '1. A database per deployable: full isolation, more to run.\n2. One shared schema: joins anywhere, and boundaries only by convention.',
    },
    {
      id: 'adr-shared-schema', label: 'Shared schema, owned writes', when: { DATA: ['shared'] },
      decision: 'All parts use one schema. Every table has one owning module, recorded in its table comment and in the model; only the owner\'s database user (module_<name>) may insert, update or delete it, and other modules read it only through views the owner publishes as its read API. This is a stage: tables move into a schema per module as boundaries firm up. Which element writes each table is decided here; the Data consistency pack refers to it.',
      consequences: '• Simple and cheap; existing queries and reports keep working.\n• Reads across modules stay possible and therefore coupling stays: a view is a contract to keep.\n• Single writers stop the worst coupling (two modules changing the same rows).\n• Splitting the data later means moving tables and replacing views with APIs or events.',
      alternatives: '1. A schema per module: enforced isolation on the same server.\n2. A database per deployable: full isolation, more to run.',
    },
    {
      id: 'adr-strangler', label: 'Strangler fig migration', when: { MIGRATION: ['strangler'] },
      decision: 'The old system is replaced piece by piece. A routing facade (an API gateway or reverse proxy: Envoy, NGINX, YARP, Spring Cloud Gateway, or the cloud\'s gateway) sits in front of it from the first step and labels every request with the backend that served it; capabilities are rebuilt one at a time in order of value and risk, their routes switched to the new parts and kept switchable back for 30 days, then the old code is removed. Data moves with its capability, synchronised both ways (change data capture) while both sides write. The share of traffic still reaching the old system falls every month and reaches zero within {{MIGRATION_MONTHS}} months of the start, which the facade exports as migration_started_timestamp_seconds.',
      consequences: '• Value arrives with every capability moved, and each step can be reversed.\n• For a while two systems run, and data synchronisation between them is extra work and risk.\n• The facade is on every request path and must be as reliable as the system.\n• Without a deadline and a measure the last 20% never moves; the monthly share and the alerts keep it honest.',
      alternatives: '1. A big-bang rewrite: no parallel running, but all value at the end and a high risk of overrun.\n2. Branch by abstraction inside the old code: no facade needed, but works only where the old code can still be changed.\n3. Leaving the old system and building around it: no migration cost, and the old system\'s problems stay.',
    },
  ],
  fitness: [
    {
      id: 'ff-inventory', label: 'Every deployable in the model', category: 'structural', implements: SPLIT_ADRS, checks: ['req-inventory'],
      threshold: '0 folders under services that are not a container or web app in the architecture model',
      description: 'A test reads the architecture model\'s node files, collects the labels of its containers and web apps, and compares them with the folders under services (a label matches a folder when it equals the folder name ignoring case and spaces); a folder without an element fails the test naming it.',
      tool: 'Vitest with the yaml package over the Radical Markdown folder; for a model kept as a single .radical file: the same test over its nodes array',
      language: 'ts',
      snippet: `import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { expect, it } from 'vitest'

const MODEL = 'architecture/nodes'
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [])
const frontMatter = (file: string) => parse(readFileSync(file, 'utf8').split(/^---$/m)[1] ?? '') ?? {}
const slug = (s: string) => s.toLowerCase().replace(/\\s+/g, '-')

it('every deployable folder is a container or web app in the model', () => {
  const modelled = new Set(files(MODEL).map(frontMatter)
    .filter((n) => n.type === 'container' || n.type === 'webapp')
    .map((n) => slug(String(n.label))))
  const missing = readdirSync('services', { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).filter((name) => !modelled.has(slug(name)))
  expect(missing, 'deployables missing from the architecture model').toEqual([])
})`,
    },
    {
      id: 'ff-build-time', label: 'Pipeline within limit', when: ONE_DEPLOYABLE, category: 'process', implements: ['adr-monolith', 'adr-modular-monolith'], checks: ['req-build', 'req-revisit'],
      threshold: 'Build, test and package finish within {{BUILD_MINUTES}} minutes on the main branch',
      description: 'The CI job that builds, tests and packages the deployable has a timeout; when it is hit, the job fails and the failure is the signal to review the decomposition within a month.',
      tool: 'GitHub Actions (timeout-minutes); the build command is the stack\'s (./mvnw or ./gradlew on the JVM, dotnet on .NET, npm in TypeScript)',
      language: 'yaml',
      snippet: `# .github/workflows/build.yml
name: build
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: {{BUILD_MINUTES}}   # ADR: one deployable stays fast to build
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
      - run: ./mvnw -B verify package`,
    },
    {
      id: 'ff-module-alone', label: 'Modules start alone', when: { SPLIT: ['modular'] }, category: 'structural', implements: ['adr-modular-monolith'], checks: ['req-modules'],
      threshold: 'Every module starts and passes its integration tests with the other modules absent',
      description: 'Each module has an integration test that bootstraps only that module (Spring Modulith\'s standalone bootstrap mode, the default), with the beans of the modules it depends on mocked. A module that needs another to start fails its test.',
      tool: 'Spring Modulith (@ApplicationModuleTest, JUnit 5); for .NET: a WebApplicationFactory per module project; for TypeScript: one Nx project per module with its own test target',
      language: 'java',
      snippet: `@ApplicationModuleTest   // bootstraps the ordering module alone (BootstrapMode.STANDALONE is the default)
class OrderingModuleTest {
  @Autowired Ordering ordering;      // the module's own API
  @MockitoBean BillingApi billing;   // the API of a module ordering depends on

  @Test
  void placesAnOrderOnItsOwn(Scenario scenario) {
    scenario.stimulate(() -> ordering.place(new PlaceOrder(CUSTOMER, LINES)))
        .andWaitForEventOfType(OrderPlaced.class)
        .toArrive();
  }
}`,
    },
    {
      id: 'ff-own-pipeline', label: 'A pipeline per deployable', when: MANY_DEPLOYABLES, category: 'structural', implements: ['adr-microservices', 'adr-serverless'], checks: ['req-independent'],
      threshold: '100% of the deployables have a deploy workflow triggered only by their own folder; 0 workflow steps that build or deploy another deployable',
      description: 'A test reads each deployable\'s workflow file, checks that it is triggered by changes under its own folder only, and that no run step names another deployable\'s folder; a workflow that builds or deploys two deployables fails the test.',
      tool: 'Vitest with the yaml package over .github/workflows; for GitLab CI: the same test over the rules:changes of each job',
      language: 'ts',
      snippet: `import { readdirSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { expect, it } from 'vitest'

const deployables = readdirSync('services', { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)

it.each(deployables)('%s deploys from a pipeline of its own', (name) => {
  const workflow = parse(readFileSync(\`.github/workflows/deploy-\${name}.yml\`, 'utf8'))
  expect(workflow.on.push.paths).toEqual([\`services/\${name}/**\`])
  const steps: string[] = Object.values<any>(workflow.jobs).flatMap((job) => job.steps.map((s: any) => s.run ?? ''))
  for (const other of deployables.filter((o) => o !== name))
    for (const step of steps) expect(step, \`\${name}'s pipeline touches \${other}\`).not.toContain(\`services/\${other}\`)
})`,
    },
    {
      id: 'ff-coordinated-releases', label: 'No releases in lockstep', when: MANY_DEPLOYABLES, category: 'process', implements: ['adr-microservices', 'adr-serverless'], checks: ['req-independent', 'req-revisit'],
      threshold: '0 pairs of deployables released within 15 minutes of each other more than twice in the last quarter',
      description: 'A monthly job lists the successful runs of every deployable\'s deploy workflow on main over the last quarter and counts, per pair, the releases that happened within 15 minutes of each other; a pair over the limit fails the job, which is the signal to review the decomposition within a month.',
      tool: 'GitHub CLI (gh run list) in a TypeScript script run with tsx from a scheduled GitHub Actions job; for GitLab: the same over the pipelines API',
      language: 'ts',
      snippet: `// scripts/coordinated-releases.ts — scheduled monthly: npx tsx scripts/coordinated-releases.ts
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const since = new Date()
since.setMonth(since.getMonth() - 3)
const deployables = readdirSync('services', { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)

const releases = (name: string): number[] =>
  JSON.parse(execFileSync('gh', ['run', 'list', '--workflow', \`deploy-\${name}.yml\`, '--branch', 'main', '--status', 'success',
    '--limit', '500', '--json', 'createdAt'], { encoding: 'utf8' }))
    .map((run: { createdAt: string }) => Date.parse(run.createdAt))
    .filter((t: number) => t > since.getTime())

const times = Object.fromEntries(deployables.map((d) => [d, releases(d)]))
const together: string[] = []
for (const a of deployables) for (const b of deployables) if (a < b) {
  const n = times[a].filter((ta) => times[b].some((tb) => Math.abs(ta - tb) < 15 * 60_000)).length
  if (n > 2) together.push(\`\${a} and \${b}: released together \${n} times\`)
}
if (together.length) {
  console.error('deployables released in lockstep this quarter (ADR: deployed independently):\\n' + together.join('\\n'))
  process.exit(1)
}`,
    },
    {
      id: 'ff-ownership', label: 'Owners within limit', when: MANY_DEPLOYABLES, category: 'process', implements: ['adr-microservices', 'adr-serverless'], checks: ['req-owners'],
      threshold: 'Every deployable names one owner in its catalog entry; no team owns more than {{PER_TEAM}}',
      description: 'Each deployable has a Backstage catalog-info.yaml naming its owner; a CI step collects the owners, fails when one is missing, and fails when a team owns more than the limit.',
      tool: 'yq (mikefarah) in a shell step over Backstage catalog-info.yaml; for a different catalog: the same over its owner field',
      language: 'bash',
      snippet: `set -euo pipefail
# every service folder has catalog-info.yaml with spec.owner
: > owners.txt
for f in services/*/catalog-info.yaml; do
  owner=$(yq '.spec.owner // ""' "$f")
  [ -n "$owner" ] || { echo "no owner: $f"; exit 1; }
  echo "$owner" >> owners.txt
done
sort owners.txt | uniq -c | awk -v max={{PER_TEAM}} '$1 > max { print "too many deployables for " $2 ": " $1; bad = 1 } END { exit bad }'`,
    },
    {
      id: 'ff-functions', label: 'Functions belong to a stack', when: { SPLIT: ['serverless'] }, category: 'structural', implements: ['adr-serverless'], checks: ['req-functions'],
      threshold: '0 functions without a context and owner tag or with a timeout above 30 seconds',
      description: 'A CloudFormation Guard rule runs over every synthesised template in CI and fails on a function without a context and owner tag or with a timeout over 30 seconds: SAM functions carry Tags as a map, CDK output as the Lambda resource with a list of Key/Value pairs, and a Lambda function without a Timeout keeps the 3-second default and passes.',
      tool: 'AWS CloudFormation Guard (cfn-guard validate) over SAM and CDK-synthesised templates; for Bicep: PSRule for Azure with a custom rule; for Terraform: Conftest over the plan JSON',
      language: 'text',
      snippet: `# rules/functions.guard  —  cfn-guard validate -d template.yaml -r rules/functions.guard
let sam_functions = Resources.*[ Type == 'AWS::Serverless::Function' ]
let lambda_functions = Resources.*[ Type == 'AWS::Lambda::Function' ]

rule sam_functions_belong_to_a_context when %sam_functions !empty {
  %sam_functions.Properties {
    Tags.context exists
    Tags.owner exists
    Timeout !exists or Timeout <= 30
  }
}

rule lambda_functions_belong_to_a_context when %lambda_functions !empty {
  %lambda_functions.Properties {
    Tags[ Key == 'context' ] !empty
    Tags[ Key == 'owner' ] !empty
    Timeout !exists or Timeout <= 30
  }
}`,
    },
    {
      id: 'ff-own-database', label: 'No foreign credentials', when: { DATA: ['own'] }, category: 'structural', implements: ['adr-own-database'], checks: ['req-own-data'],
      threshold: '0 workloads that receive another deployable\'s database secret',
      description: 'A policy over the Kubernetes manifests fails when a Deployment, StatefulSet, Job or CronJob references a database secret other than its own (secrets are named db-<app>), whether through envFrom, an env entry with secretKeyRef, or a secret volume.',
      tool: 'Conftest (Open Policy Agent, rego.v1) over the rendered manifests; for ECS: the same rule over the task definitions\' secrets',
      language: 'rego',
      snippet: `package main
import rego.v1

workloads := {"Deployment", "StatefulSet", "Job", "CronJob"}

pod_spec := input.spec.template.spec if { input.kind in {"Deployment", "StatefulSet", "Job"} }
pod_spec := input.spec.jobTemplate.spec.template.spec if { input.kind == "CronJob" }

db_secrets contains name if {
  some c in pod_spec.containers
  some src in c.envFrom
  name := src.secretRef.name
}
db_secrets contains name if {
  some c in pod_spec.containers
  some e in c.env
  name := e.valueFrom.secretKeyRef.name
}
db_secrets contains name if {
  some v in pod_spec.volumes
  name := v.secret.secretName
}

deny contains msg if {
  input.kind in workloads
  app := input.metadata.labels["app.kubernetes.io/name"]
  some name in db_secrets
  startswith(name, "db-")
  name != sprintf("db-%s", [app])
  msg := sprintf("%s %s reads database secret %s (ADR A database per deployable)", [input.kind, app, name])
}`,
    },
    {
      id: 'ff-schema-grants', label: 'Schemas closed to others', when: { DATA: ['schemas'] }, category: 'structural', implements: ['adr-schema-per-module'], checks: ['req-schemas'],
      threshold: '0 module users with any privilege on another module\'s schema',
      description: 'An integration test starts PostgreSQL in a container, runs every module\'s migrations and grants, and runs this query; any row fails the test.',
      tool: 'Testcontainers (PostgreSQL) with the test runner of the stack; the query is plain SQL',
      language: 'sql',
      snippet: `-- module users are named module_<name>, schemas <name>
SELECT r.rolname AS module_user, n.nspname AS foreign_schema
FROM pg_roles r CROSS JOIN pg_namespace n
WHERE r.rolname LIKE 'module\\_%'
  AND n.nspname NOT IN ('public', 'information_schema') AND n.nspname NOT LIKE 'pg\\_%'
  AND n.nspname <> substring(r.rolname FROM 8)
  AND has_schema_privilege(r.rolname, n.oid, 'USAGE');
-- expected: 0 rows`,
    },
    {
      id: 'ff-table-writers', label: 'One writer per table', when: { DATA: ['shared'] }, category: 'structural', implements: ['adr-shared-schema'], checks: ['req-shared'],
      threshold: '0 tables writable by a module user other than the owner\'s; 0 tables without an owner in their comment',
      description: 'An integration test starts PostgreSQL in a container, runs the migrations and grants, and checks that every table (including partitioned ones) names its owning module in its table comment and can be written only by that module\'s user.',
      tool: 'Testcontainers (PostgreSQL) with the test runner of the stack; the query is plain SQL',
      language: 'sql',
      snippet: `-- tables carry their owning module in the table comment (COMMENT ON TABLE orders IS 'ordering'); module users are module_<module>
SELECT r.rolname AS module_user, c.relname AS foreign_table, obj_description(c.oid, 'pg_class') AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND r.rolname LIKE 'module\\_%'
  AND (obj_description(c.oid, 'pg_class') IS NULL OR obj_description(c.oid, 'pg_class') <> substring(r.rolname FROM 8))
  AND has_table_privilege(r.rolname, c.oid, 'INSERT, UPDATE, DELETE');
-- expected: 0 rows`,
    },
    {
      id: 'ff-team-changes', label: 'Changes stay with one team', when: { BOUNDARY: ['team'], SPLIT: WITH_BOUNDARIES }, category: 'process', implements: SPLIT_ADRS, checks: ['req-team-changes'],
      threshold: 'At least 80% of the pull requests merged in the last quarter touch the parts of one team only',
      description: 'A monthly job lists the pull requests merged in the last quarter with their files, maps each file to its owning team through the CODEOWNERS entries (folder prefixes, one per part, as the Code review and branching pack keeps them) and counts the pull requests whose files belong to one team; below 80% the job fails and the boundaries are reviewed.',
      tool: 'GitHub CLI (gh pr list) in a TypeScript script run with tsx from a scheduled GitHub Actions job',
      language: 'ts',
      snippet: `// scripts/single-team-changes.ts — scheduled monthly: npx tsx scripts/single-team-changes.ts
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const since = new Date()
since.setMonth(since.getMonth() - 3)
const owners = readFileSync('.github/CODEOWNERS', 'utf8').split('\\n')
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => { const [pattern, team] = line.trim().split(/\\s+/); return { prefix: pattern.replace(/^\\//, ''), team } })
const teamOf = (file: string) => owners.filter((o) => file.startsWith(o.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0]?.team

const prs: Array<{ files: Array<{ path: string }> }> = JSON.parse(execFileSync('gh', ['pr', 'list', '--state', 'merged',
  '--search', \`merged:>=\${since.toISOString().slice(0, 10)}\`, '--limit', '1000', '--json', 'files'], { encoding: 'utf8' }))
const singleTeam = prs.filter((pr) => new Set(pr.files.map((f) => teamOf(f.path)).filter(Boolean)).size <= 1).length
const share = Math.round((singleTeam * 100) / Math.max(prs.length, 1))
console.log(\`\${singleTeam} of \${prs.length} merged pull requests touched one team's parts (\${share}%)\`)
if (share < 80) process.exit(1)`,
    },
    {
      id: 'ff-legacy-share', label: 'Legacy traffic falls', when: { MIGRATION: ['strangler'] }, category: 'operational', implements: ['adr-strangler'], checks: ['req-strangler'],
      threshold: 'The share of requests reaching the old system falls every 30 days while above 0, and is 0 within {{MIGRATION_MONTHS}} months of the migration\'s start',
      description: 'The routing facade labels each request with the backend that served it and exports the migration\'s start as migration_started_timestamp_seconds; a recording rule keeps the old system\'s 7-day share, one alert fires when the share is above 0 and has not fallen in 30 days, another when it is above 0 past the deadline.',
      tool: 'Prometheus recording and alerting rules',
      language: 'yaml',
      snippet: `groups:
  - name: strangler
    rules:
      - record: migration:legacy_share:ratio_7d
        expr: |
          sum(rate(facade_requests_total{backend="legacy"}[7d])) / sum(rate(facade_requests_total[7d]))
      - alert: MigrationStalled
        expr: |
          migration:legacy_share:ratio_7d > 0
          and migration:legacy_share:ratio_7d >= migration:legacy_share:ratio_7d offset 30d
        labels: { severity: ticket }
        annotations:
          summary: "Legacy share has not fallen in 30 days; it must reach 0 within {{MIGRATION_MONTHS}} months"
      - alert: MigrationPastDeadline
        expr: |
          migration:legacy_share:ratio_7d > 0
          and time() - max(migration_started_timestamp_seconds) > {{MIGRATION_MONTHS}} * 30 * 86400
        labels: { severity: page }
        annotations:
          summary: "The old system still serves traffic {{MIGRATION_MONTHS}} months after the migration started (ADR Strangler fig migration)"`,
    },
  ],
}

export default pack
