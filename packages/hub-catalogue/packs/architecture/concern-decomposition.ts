import type { PackSpec, When } from '../../src/packSpec'

const ONE_DEPLOYABLE: When = { SPLIT: ['monolith', 'modular'] }
const MANY_DEPLOYABLES: When = { SPLIT: ['microservices', 'serverless'] }
const SPLIT_ADRS = ['adr-monolith', 'adr-modular-monolith', 'adr-microservices', 'adr-serverless']
const FORCES = 'The system has to be built, released and run by a given number of teams. How it is split into deployables decides how independently they can work and how much there is to operate. The forces: several teams in one deployable wait for each other\'s releases and step on each other\'s code; every split adds network calls that fail and are slow, data that is no longer in one transaction, and pipelines, dashboards and on-call to run (the microservice premium); boundaries drawn before the domain is understood are expensive to move once they are services; two services sharing a database are one service released twice; and an existing system cannot be replaced in one step.'

const pack: PackSpec = {
  id: 'concern-decomposition',
  name: 'Decomposition',
  group: 'architecture',
  description: 'How the system is split into deployables: one monolith, a modular monolith, microservices or serverless functions; where the boundaries go, who owns the data, and how an existing system is moved over.',
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
    { title: 'Spring Modulith reference documentation', url: 'https://docs.spring.io/spring-modulith/reference/' },
  ],
  questions: [
    {
      key: 'SPLIT', title: 'Deployables', label: 'How is the system split into deployables?',
      hint: 'Each deployable is released, scaled and run on its own. More of them buy independence for teams and costs network calls, distributed data and operations. The structure inside each is the Architecture style pack.',
      default: 'modular',
      options: [
        { value: 'monolith', label: 'one monolith', description: 'One deployable and one database, without enforced inner boundaries. Pick it for one team (up to about eight people), a new product whose domain is still being discovered, or a short-lived system.' },
        { value: 'modular', label: 'a modular monolith', description: 'One deployable cut into modules, one per bounded context, each with a published API and its own data. Pick it for one to about three teams, when boundaries are not yet proven, or when the platform and on-call for many services are not there yet: modules can become services later.' },
        { value: 'microservices', label: 'microservices, one per bounded context', description: 'Each bounded context is a service with its own pipeline, data and owning team. Pick it when several teams (more than about three) must release independently, parts scale or fail differently, the boundaries are known, and there is a platform for deployment, observability and on-call per service.' },
        { value: 'serverless', label: 'serverless functions, grouped per context', description: 'Functions (AWS Lambda, Azure Functions, Google Cloud Functions) triggered by HTTP, queues and schedules, deployed per bounded context as one stack. Pick it for spiky or low, event-driven load where paying per call beats running servers, short tasks (seconds), and a team ready to work within the provider\'s limits.' },
      ],
    },
    {
      key: 'DATA', title: 'Data', label: 'Who owns which data?',
      hint: 'Data shared between parts is coupling the network does not remove: parts that read each other\'s tables have to change together.',
      default: 'schemas',
      options: [
        { value: 'own', label: 'a database per deployable', description: 'Each service or function group has its own database that nobody else reads; others get its data through its API or events. Pick it with microservices or serverless, or whenever parts must be released and scaled apart.' },
        { value: 'schemas', label: 'one server, a schema per module', description: 'One database server; each module has a schema and a database user of its own, and no query reaches another module\'s schema. Pick it for a modular monolith, or for services on their way out of one: cheap to run, and each schema can move to its own server later.' },
        { value: 'shared', label: 'one shared schema, writes owned', description: 'All parts use one schema; each table has one owning module that alone writes it, and others read only through views it publishes. Pick it for a monolith, or an existing system whose tables cannot be split yet.' },
      ],
    },
    {
      key: 'BOUNDARY', title: 'Boundaries', label: 'What decides where a boundary goes?',
      hint: 'A boundary in the wrong place makes every change cross it. This decides what a module or service is cut around.',
      default: 'context',
      options: [
        { value: 'context', label: 'bounded contexts of the domain', description: 'Boundaries follow the bounded contexts of a context map: each holds one model and its own language (ordering, billing, shipping). Pick it when the domain is understood well enough to draw a context map, usually after an event-storming or domain-modelling workshop.' },
        { value: 'team', label: 'the teams that own them', description: 'Each stream-aligned team owns its parts end to end, and boundaries are drawn so that most changes stay within one team (Conway\'s law used on purpose). Pick it when the team structure is settled and coordination between teams is the main cost.' },
        { value: 'need', label: 'only a measured need splits', description: 'Everything stays together unless a part has a measured, different need: load, runtime, security zone or release rate, recorded with the numbers. Pick it when the domain is young and boundaries are not known, to avoid splitting too early.' },
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
    text: '{{TEAMS}} teams build this system. Each should be able to change, test and release its part without waiting for the others, while the system as a whole stays something the organisation can afford to run: every extra deployable is another pipeline, another data store, more network calls and more on-call. Who owns which data has to be clear, because shared data couples parts no matter how they are deployed; and if an existing system is being replaced, it has to keep working while it is.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-inventory', label: 'Deployables are on record', ears_type: 'ubiquitous',
      action: 'record every deployable of the system in the architecture model with its owning team, the bounded contexts or modules it holds and the data stores it owns, with 0 deployed units missing from the model',
      rationale: 'A decomposition nobody can see drifts: services appear without owners and data without a home (Newman, Building Microservices, ch. 1; ISO/IEC 25010 modularity).',
      scenario: { label: 'Every deployable known', given: 'the list of units deployed to production', when: 'it is compared with the deployables in the model', then: 'every unit is in the model with an owning team and its data stores' },
    },
    {
      id: 'req-revisit', label: 'Decomposition revisited', ears_type: 'event-driven',
      trigger: 'the number of teams moves away from {{TEAMS}}, building and testing a deployable passes {{BUILD_MINUTES}} minutes, or two deployables are released together more than twice in a quarter',
      action: 'review this decision and record the outcome in an ADR within one month',
      rationale: 'The right split depends on teams, size and coupling, which change; these signals say the current one no longer fits (Fowler, MonolithFirst; Newman, Monolith to Microservices).',
      scenario: { label: 'Signal leads to review', given: 'the decomposition decision', when: 'two services are released together for the third time in a quarter', then: 'within a month an ADR records whether they are merged, re-cut or left as they are' },
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
      action: 'build, test and deploy it to production without building, deploying or waiting for the release of any other, with 0 releases coordinated between deployables in a quarter',
      rationale: 'Independent deployability is the reason to split; services that must be released together carry the costs of distribution without its benefit (Lewis and Fowler, Microservices; Newman, Building Microservices).',
      scenario: { label: 'One service released alone', given: 'two services where one calls the other', when: 'the called service is changed and released', then: 'it reaches production on its own and the calling service is neither rebuilt nor redeployed' },
    },
    {
      id: 'req-owners', label: 'Each team owns a few', when: MANY_DEPLOYABLES, ears_type: 'ubiquitous',
      action: 'give every deployable exactly one owning team and let no team own more than {{PER_TEAM}} deployables',
      rationale: 'A service is as small as one team can own completely, building and running it; more per team than it can operate becomes neglect (Newman, Building Microservices, ch. 15; Team Topologies).',
      scenario: { label: 'Ownership within limit', given: 'the deployables and their owning teams', when: 'the ownership is counted', then: 'each has one owner and no team owns more than {{PER_TEAM}}' },
    },
    {
      id: 'req-functions', label: 'Functions grouped per context', when: { SPLIT: ['serverless'] }, ears_type: 'ubiquitous',
      action: 'deploy the functions of one bounded context together as one stack, give each one trigger and a timeout of at most 30 seconds, and tag each with its context and owning team',
      rationale: 'Functions deployed one by one become hundreds of unowned units; grouping per context keeps the boundary and the ownership (AWS Well-Architected Serverless Lens).',
      scenario: { label: 'Function belongs somewhere', given: 'the infrastructure templates', when: 'a function without a context tag or with a 5-minute timeout is added', then: 'the template check fails' },
    },
    {
      id: 'req-own-data', label: 'Each deployable owns its data', when: { DATA: ['own'] }, ears_type: 'ubiquitous',
      action: 'let each deployable read and write only its own database, with 0 credentials to another\'s database and other data obtained through its owner\'s API or events',
      rationale: 'Shared databases couple services at the schema; each service keeping its data private is what lets it change alone (microservices.io, Database per service).',
      scenario: { label: 'No foreign credentials', given: 'the deployment configuration of every service', when: 'the database credentials each receives are listed', then: 'each receives only those of its own database' },
    },
    {
      id: 'req-schemas', label: 'A schema per module', when: { DATA: ['schemas'] }, ears_type: 'ubiquitous',
      action: 'keep each module\'s tables in a schema of its own, reachable only by that module\'s database user, with 0 queries joining or reading another module\'s schema',
      rationale: 'Schemas with their own users keep one database server cheap while making a cross-module query fail at once; each schema can later move out (microservices.io, Database per service: schema-per-service).',
      scenario: { label: 'Foreign schema refused', given: 'the ordering and billing modules with their own schemas and users', when: 'ordering\'s user selects from a billing table', then: 'the database refuses it with a permission error' },
    },
    {
      id: 'req-shared', label: 'Each table has one writer', when: { DATA: ['shared'] }, ears_type: 'ubiquitous',
      action: 'record an owning module for every table, let only that module\'s database user insert, update or delete its rows, and let other modules read only through views the owner publishes',
      rationale: 'A shared database is the simplest store but couples everything that writes to it; single writers keep the coupling to reads (microservices.io, Shared database).',
      scenario: { label: 'Foreign write refused', given: 'the orders table owned by ordering', when: 'billing\'s database user updates a row of it', then: 'the database refuses it with a permission error' },
    },
    {
      id: 'req-contexts', label: 'Boundaries follow contexts', when: { BOUNDARY: ['context'] }, ears_type: 'ubiquitous',
      action: 'draw every boundary between modules or services along a bounded context of the context map, with 0 contexts split across two deployables or modules',
      rationale: 'A bounded context is the boundary inside which a model is consistent; cutting across one splits a model that has to change together (Fowler, BoundedContext).',
      scenario: { label: 'Context not split', given: 'the context map and the deployables', when: 'each context is traced to the deployables holding its code', then: 'every context is held by exactly one module or service' },
    },
    {
      id: 'req-team-changes', label: 'Changes stay in one team', when: { BOUNDARY: ['team'] }, ears_type: 'ubiquitous',
      action: 'keep the boundaries so that at least 80% of merged changes in a quarter touch only the parts of one team, and redraw them when that share falls',
      rationale: 'Boundaries that match the teams keep coordination low; the share of single-team changes measures it (Conway\'s law; Skelton and Pais, Team Topologies).',
      scenario: { label: 'Changes stay with a team', given: 'the merged pull requests of a quarter and the owners of each part', when: 'each change is matched to the teams whose parts it touches', then: 'at least 80% touch the parts of one team only' },
    },
    {
      id: 'req-split-need', label: 'Splits backed by numbers', when: { BOUNDARY: ['need'] }, ears_type: 'event-driven',
      trigger: 'a part is proposed to become a deployable or module of its own',
      action: 'split it only when an ADR records the measured need: a load, runtime, security zone or release rate that differs from the rest by at least a factor of 2 or a compliance boundary',
      rationale: 'Splitting before the need is known pays the microservice premium for nothing (Fowler, MicroservicePremium).',
      scenario: { label: 'Split needs numbers', given: 'a proposal to extract the search into a service', when: 'it is reviewed', then: 'it goes ahead only with an ADR showing, for example, search load ten times the rest' },
    },
    {
      id: 'req-strangler', label: 'Legacy replaced piece by piece', when: { MIGRATION: ['strangler'] }, ears_type: 'event-driven',
      trigger: 'a capability of the old system has been rebuilt',
      action: 'route its traffic through the routing facade to the new part, keep the route switchable back for 30 days, then remove the old code, and retire the old system within {{MIGRATION_MONTHS}} months',
      rationale: 'The strangler fig replaces a system while it keeps running, each step small and reversible (Fowler, StranglerFigApplication; Newman, Monolith to Microservices, ch. 3).',
      scenario: { label: 'Route switched over', given: 'a rebuilt order history behind the routing facade', when: 'its route is switched to the new part and the new part fails', then: 'the route is switched back within minutes, and once stable for 30 days the old code is removed' },
    },
  ],
  adrs: [
    {
      id: 'adr-monolith', label: 'One monolith', when: { SPLIT: ['monolith'] },
      decision: 'The system is one deployable with one database, built by one pipeline in at most {{BUILD_MINUTES}} minutes and released as a whole; {{TEAMS}} teams work in it. Boundaries are drawn by {{BOUNDARY}}; data: {{DATA}}. It is revisited when the number of teams grows, the build passes {{BUILD_MINUTES}} minutes, or parts need different scaling. Criteria that made it the choice: one team or very few, a domain still being discovered, no platform for running many services.',
      consequences: '• Simplest to build, test, deploy and debug: local calls, one transaction, one log.\n• Everyone releases together, so a broken part blocks the release and teams wait on each other as they grow.\n• Without enforced boundaries the code tends to tangle; moving to modules later means drawing them first.\n• Scales as a whole: running more copies scales every part at once.',
      alternatives: '1. A modular monolith: the same single deployable with enforced module boundaries, ready to split later.\n2. Microservices: independent releases per team, at the cost of distribution and operations.\n3. Serverless functions: no servers to run, but many small units and provider limits.',
    },
    {
      id: 'adr-modular-monolith', label: 'A modular monolith', when: { SPLIT: ['modular'] },
      decision: 'The system is one deployable cut into modules, one per bounded context, each with a published API, its own data and an owning team; {{TEAMS}} teams work in it and it is built in at most {{BUILD_MINUTES}} minutes. Boundaries are drawn by {{BOUNDARY}}; data: {{DATA}}. Each module starts and is tested on its own (Spring Modulith\'s @ApplicationModuleTest on Spring Boot; on .NET one project per module with its own test project; in TypeScript an Nx project per module). A module is extracted into a service only when a team or a measured need justifies it (Module boundaries keeps the rules between modules).',
      consequences: '• Boundaries by domain without the network: one deploy, local calls, one transaction where really needed.\n• Modules with a clean API and private data can become services later with little rework.\n• All modules release together, so one broken module blocks the others\' release.\n• One runtime: a module that needs very different scaling or technology is a reason to extract it.',
      alternatives: '1. A plain monolith: simpler, but boundaries erode and splitting later is harder.\n2. Microservices from the start: independent releases, at the cost of distribution before boundaries are proven.\n3. Separate repositories per module in one deployable: strong boundaries, slow cross-module changes.',
    },
    {
      id: 'adr-microservices', label: 'Microservices per context', when: { SPLIT: ['microservices'] },
      decision: 'The system is split into services, one per bounded context, each with its own repository or Nx project, pipeline, data store and one owning team; {{TEAMS}} teams own at most {{PER_TEAM}} services each. Boundaries are drawn by {{BOUNDARY}}; data: {{DATA}}. Services meet only through versioned contracts, and each is deployed on its own after its consumers\' contracts pass (Pact can-i-deploy). A service runs on the shared platform (Kubernetes with a paved-road template, or a managed container service such as ECS, Cloud Run or Azure Container Apps), with per-service dashboards and on-call. Criteria that made it the choice: more teams than one deployable can carry, parts that scale or fail differently, known boundaries, and a platform to run them.',
      consequences: '• Teams release, scale and choose technology per service without waiting for each other.\n• Every call between contexts is a network call that can fail or be slow, and an operation across services needs events or sagas instead of one transaction.\n• More to run: a pipeline, data store, dashboards and on-call per service, and a platform team to make that cheap.\n• A wrong boundary is expensive to move; boundaries should be proven, ideally first as modules.',
      alternatives: '1. A modular monolith: the same boundaries in one deployable, simpler to run, released together.\n2. Services per technical layer (a data service, a UI service): every feature touches all of them.\n3. A distributed monolith with a shared database: services in name only.',
    },
    {
      id: 'adr-serverless', label: 'Serverless functions per context', when: { SPLIT: ['serverless'] },
      decision: 'The system is built from functions grouped per bounded context: each context is one stack (AWS SAM, AWS CDK or the Serverless Framework on AWS Lambda; Bicep with Azure Functions; Terraform with Google Cloud Functions) with its functions, queues and data store, owned by one team; {{TEAMS}} teams own at most {{PER_TEAM}} stacks each. Each function has one trigger and a timeout of at most 30 seconds; longer work runs as a workflow (Step Functions, Durable Functions). Boundaries are drawn by {{BOUNDARY}}; data: {{DATA}}. Criteria that made it the choice: spiky or low event-driven load, short tasks, and a team at home with the provider\'s limits.',
      consequences: '• No servers to patch or scale; cost follows use and is near zero when idle.\n• Cold starts add latency to the first call after idle; latency-critical paths need provisioned concurrency.\n• Provider limits (duration, payload, concurrency) shape the design, and local testing needs emulators or a cloud sandbox.\n• Strong lock-in to the provider\'s triggers and services.',
      alternatives: '1. Containers per context (microservices): no cold starts or duration limits, but servers to run.\n2. A modular monolith on a managed platform: simplest, at the cost of paying for idle capacity.\n3. One function per endpoint deployed alone: maximal granularity, unmanageable ownership.',
    },
    {
      id: 'adr-own-database', label: 'A database per deployable', when: { DATA: ['own'] },
      decision: 'Each deployable has its own database (a separate database or managed instance) and holds the only credentials to it; other deployables get its data through its API or by consuming its events into a copy of their own. Reports that need data from several deployables read a reporting store fed by events or change data capture (Debezium), never the services\' databases.',
      consequences: '• Each deployable changes its schema and scales its store without asking anyone.\n• No joins or transactions across deployables: queries across them are API compositions or read models, and consistency across them is eventual.\n• More databases to back up, patch and watch.\n• Duplicated data must have one owner; copies are read-only.',
      alternatives: '1. One server with a schema per deployable: cheaper, same ownership, less isolation of load.\n2. A shared database: easy joins, but every schema change couples all its users.',
    },
    {
      id: 'adr-schema-per-module', label: 'A schema per module', when: { DATA: ['schemas'] },
      decision: 'The modules share one database server; each module has a schema and a database user of its own, granted only on that schema, and its migrations (Flyway or Liquibase locations, EF Core migrations per DbContext) touch only it. A module that needs another\'s data calls its API or keeps a copy fed by its events; there are no cross-schema joins or foreign keys.',
      consequences: '• One server to run and back up, while a cross-module query fails at once.\n• A module can move to its own server later by pointing its user elsewhere.\n• No database-enforced references between modules; consistency between them is the modules\' job.\n• Load is still shared: a heavy module slows the others.',
      alternatives: '1. A database per deployable: full isolation, more to run.\n2. One shared schema: joins anywhere, and boundaries only by convention.',
    },
    {
      id: 'adr-shared-schema', label: 'Shared schema, owned writes', when: { DATA: ['shared'] },
      decision: 'All parts use one schema. Every table has one owning module, recorded in a table comment and in the model; only the owner\'s database user may insert, update or delete it, and other modules read it only through views the owner publishes as its read API. New tables follow the module\'s name prefix. This is a stage: tables move into a schema per module as boundaries firm up.',
      consequences: '• Simple and cheap; existing queries and reports keep working.\n• Reads across modules stay possible and therefore coupling stays: a view is a contract to keep.\n• Single writers stop the worst coupling (two modules changing the same rows).\n• Splitting the data later means moving tables and replacing views with APIs or events.',
      alternatives: '1. A schema per module: enforced isolation on the same server.\n2. A database per deployable: full isolation, more to run.',
    },
    {
      id: 'adr-strangler', label: 'Strangler fig migration', when: { MIGRATION: ['strangler'] },
      decision: 'The old system is replaced piece by piece. A routing facade (an API gateway or reverse proxy: Envoy, NGINX, YARP, Spring Cloud Gateway, or the cloud\'s gateway) sits in front of it from the first step; capabilities are rebuilt one at a time in order of value and risk, their routes switched to the new parts and kept switchable back for 30 days, then the old code is removed. Data moves with its capability, synchronised both ways (change data capture) while both sides write. The share of traffic still reaching the old system is reported every month; it reaches zero within {{MIGRATION_MONTHS}} months.',
      consequences: '• Value arrives with every capability moved, and each step can be reversed.\n• For a while two systems run, and data synchronisation between them is extra work and risk.\n• The facade is on every request path and must be as reliable as the system.\n• Without a deadline and a measure the last 20% never moves; the monthly share keeps it honest.',
      alternatives: '1. A big-bang rewrite: no parallel running, but all value at the end and a high risk of overrun.\n2. Branch by abstraction inside the old code: no facade needed, but works only where the old code can still be changed.\n3. Leaving the old system and building around it: no migration cost, and the old system\'s problems stay.',
    },
  ],
  fitness: [
    {
      id: 'ff-build-time', label: 'Pipeline within limit', when: ONE_DEPLOYABLE, category: 'process', implements: ['adr-monolith', 'adr-modular-monolith'],
      threshold: 'Build, test and package finish within {{BUILD_MINUTES}} minutes on the main branch',
      description: 'The CI job that builds, tests and packages the deployable has a timeout; when it is hit, the job fails and the trend is reviewed as a signal to revisit the decomposition.',
      tool: 'GitHub Actions (timeout-minutes)',
      language: 'yaml',
      snippet: `# .github/workflows/build.yml
name: build
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: {{BUILD_MINUTES}}   # ADR: one deployable stays fast to build
    steps:
      - uses: actions/checkout@v4
      - run: ./mvnw -B verify package`,
    },
    {
      id: 'ff-module-alone', label: 'Modules start alone', when: { SPLIT: ['modular'] }, category: 'structural', implements: ['adr-modular-monolith'],
      threshold: 'Every module starts and passes its integration tests with the other modules absent',
      description: 'Each module has an integration test that bootstraps only that module (Spring Modulith\'s standalone bootstrap mode), with the APIs of the modules it depends on mocked. A module that needs another to start fails its test. On .NET, a WebApplicationFactory per module does the same.',
      tool: 'Spring Modulith (@ApplicationModuleTest)',
      language: 'java',
      snippet: `@ApplicationModuleTest(mode = BootstrapMode.STANDALONE)
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
      id: 'ff-can-i-deploy', label: 'Deploys checked alone', when: MANY_DEPLOYABLES, category: 'process', implements: ['adr-microservices', 'adr-serverless'],
      threshold: '0 deployments that need another deployable released first; each deploys when its consumers\' contracts pass',
      description: 'Each deployable has its own pipeline, triggered only by changes in its own folder. Before deploying, it asks the Pact Broker whether the version is compatible with what is in production; it deploys alone if so, and the release is recorded for its consumers.',
      tool: 'Pact Broker (can-i-deploy) in GitHub Actions',
      language: 'yaml',
      snippet: `# .github/workflows/ordering.yml
on: { push: { branches: [main], paths: ['services/ordering/**'] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: >
          npx pact-broker can-i-deploy --pacticipant ordering
          --version \${{ github.sha }} --to-environment production
          --broker-base-url \${{ vars.PACT_BROKER_URL }}
      - run: ./deploy.sh services/ordering
      - run: >
          npx pact-broker record-deployment --pacticipant ordering
          --version \${{ github.sha }} --environment production`,
    },
    {
      id: 'ff-ownership', label: 'Owners within limit', when: MANY_DEPLOYABLES, category: 'process', implements: ['adr-microservices', 'adr-serverless'],
      threshold: 'Every deployable has one owner in its catalog entry; no team owns more than {{PER_TEAM}}',
      description: 'Each deployable has a Backstage catalog-info.yaml naming its owner; a CI step counts deployables per owner and fails when one is missing or a team owns more than the limit.',
      tool: 'yq over Backstage catalog-info.yaml',
      language: 'bash',
      snippet: `# every service folder has catalog-info.yaml with spec.owner
for f in services/*/catalog-info.yaml; do
  owner=$(yq -r '.spec.owner // ""' "$f")
  [ -n "$owner" ] || { echo "no owner: $f"; exit 1; }
  echo "$owner"
done | sort | uniq -c | awk -v max={{PER_TEAM}} '$1 > max { print "too many for " $2 ": " $1; bad = 1 } END { exit bad }'`,
    },
    {
      id: 'ff-functions', label: 'Functions belong to a stack', when: { SPLIT: ['serverless'] }, category: 'structural', implements: ['adr-serverless'],
      threshold: '0 functions without a context and owner tag or with a timeout above 30 seconds',
      description: 'A CloudFormation Guard rule runs over every synthesised template (SAM or CDK) in CI and fails on a function that does not belong to a context or runs too long.',
      tool: 'AWS CloudFormation Guard (cfn-guard)',
      language: 'text',
      snippet: `# rules/functions.guard  —  cfn-guard validate -d template.yaml -r rules/functions.guard
let functions = Resources.*[ Type == 'AWS::Serverless::Function' ]

rule functions_belong_to_a_context when %functions !empty {
  %functions.Properties.Tags.context exists
  %functions.Properties.Tags.owner exists
  %functions.Properties.Timeout <= 30
}`,
    },
    {
      id: 'ff-own-database', label: 'No foreign credentials', when: { DATA: ['own'] }, category: 'structural', implements: ['adr-own-database'],
      threshold: '0 deployments that receive another deployable\'s database secret',
      description: 'A policy over the Kubernetes manifests fails when a workload references a database secret other than its own (secrets are named db-<app>).',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `package main
import rego.v1

deny contains msg if {
  input.kind == "Deployment"
  app := input.metadata.labels["app.kubernetes.io/name"]
  some c in input.spec.template.spec.containers
  some src in c.envFrom
  startswith(src.secretRef.name, "db-")
  src.secretRef.name != sprintf("db-%s", [app])
  msg := sprintf("%s reads database secret %s (ADR A database per deployable)", [app, src.secretRef.name])
}`,
    },
    {
      id: 'ff-schema-grants', label: 'Schemas closed to others', when: { DATA: ['schemas'] }, category: 'structural', implements: ['adr-schema-per-module'],
      threshold: '0 module users with any privilege on another module\'s schema',
      description: 'An integration test starts PostgreSQL in a container, runs every module\'s migrations and grants, and runs this query; any row fails the test.',
      tool: 'Testcontainers (PostgreSQL)',
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
      id: 'ff-table-writers', label: 'One writer per table', when: { DATA: ['shared'] }, category: 'structural', implements: ['adr-shared-schema'],
      threshold: '0 tables writable by a module user other than the owner\'s',
      description: 'An integration test starts PostgreSQL in a container, runs the migrations and grants, and checks that each table (prefixed with its owning module) can be written only by its owner\'s user.',
      tool: 'Testcontainers (PostgreSQL)',
      language: 'sql',
      snippet: `-- tables are named <module>_<name>, module users module_<module>
SELECT r.rolname AS module_user, c.relname AS foreign_table
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' AND c.relkind = 'r' AND r.rolname LIKE 'module\\_%'
  AND split_part(c.relname, '_', 1) <> substring(r.rolname FROM 8)
  AND has_table_privilege(r.rolname, c.oid, 'INSERT, UPDATE, DELETE');
-- expected: 0 rows`,
    },
    {
      id: 'ff-legacy-share', label: 'Legacy traffic falls', when: { MIGRATION: ['strangler'] }, category: 'operational', implements: ['adr-strangler'],
      threshold: 'The share of requests reaching the old system falls every month and is 0 within {{MIGRATION_MONTHS}} months',
      description: 'The routing facade labels each request with the backend that served it; a recording rule keeps the share of the old system, a dashboard shows the trend, and an alert fires when it has not fallen over a month.',
      tool: 'Prometheus recording and alerting rules',
      language: 'yaml',
      snippet: `groups:
  - name: strangler
    rules:
      - record: migration:legacy_share:ratio_7d
        expr: |
          sum(rate(facade_requests_total{backend="legacy"}[7d])) / sum(rate(facade_requests_total[7d]))
      - alert: MigrationStalled
        expr: migration:legacy_share:ratio_7d >= migration:legacy_share:ratio_7d offset 30d
        labels: { severity: ticket }
        annotations:
          summary: "Legacy share has not fallen in 30 days; it must reach 0 within {{MIGRATION_MONTHS}} months"`,
    },
  ],
}

export default pack
