import type { PackSpec } from '../../src/packSpec'

const STRATEGY_ADRS = ['adr-rolling', 'adr-bluegreen', 'adr-canary']
const FORCES = 'This element is changed and deployed while people use it. The forces: most outages start with a change, so how a change reaches production decides much of the availability; a release that cannot be undone quickly turns a small mistake into a long outage; old and new versions run side by side during most deployments and both must work against the same database; a schema change that the previous version cannot read makes rollback impossible; small, frequent changes fail less often and are easier to undo than large, rare ones (DORA); and deploying is not the same as releasing: code can be in production without users seeing it. The snippets of this pack assume the element is deployed to the shop namespace as order-api; rename them for yours.'

const pack: PackSpec = {
  id: 'concern-deployment',
  name: 'Deployment and rollback',
  group: 'sdlc',
  description: 'How a change reaches production and how it is undone: the rollout strategy and its automatic checks, database migrations that keep rollback possible, feature flags and their removal, the time to roll back, and the release cadence measured with the DORA metrics.',
  tags: ['operations', 'deployment', 'rollback', 'canary', 'blue-green', 'migrations', 'feature-flags', 'dora'],
  concern: {
    id: 'deployment',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'these elements are deployed and changed in production, so how a change rolls out, and how it is taken back, has to be decided.',
  },
  sources: [
    { title: 'DORA: DevOps Research and Assessment', url: 'https://dora.dev/' },
    { title: 'Google SRE workbook: Canarying Releases', url: 'https://sre.google/workbook/canarying-releases/' },
    { title: 'Martin Fowler: Parallel Change (expand and contract)', url: 'https://martinfowler.com/bliki/ParallelChange.html' },
    { title: 'Martin Fowler: Blue Green Deployment', url: 'https://martinfowler.com/bliki/BlueGreenDeployment.html' },
    { title: 'Pete Hodgson: Feature Toggles (aka Feature Flags)', url: 'https://martinfowler.com/articles/feature-toggles.html' },
    { title: 'The Twelve-Factor App, V. Build, release, run', url: 'https://12factor.net/build-release-run' },
    { title: 'Argo Rollouts documentation', url: 'https://argo-rollouts.readthedocs.io/en/stable/' },
    { title: 'Kubernetes documentation: Deployments', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/' },
    { title: 'Kubernetes documentation: Pod Lifecycle (termination of pods)', url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/' },
    { title: 'AWS Well-Architected Framework, Reliability Pillar', url: 'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html' },
    { title: 'flagd: flag definitions', url: 'https://flagd.dev/reference/flag-definitions/' },
  ],
  questions: [
    {
      key: 'STRATEGY', title: 'Rollout', label: 'How does a new version roll out?',
      hint: 'This decides how many users a bad version reaches before it is stopped, and how fast it is undone.',
      default: 'canary',
      options: [
        { value: 'rolling', label: 'a rolling update', description: 'Instances are replaced a few at a time; old and new versions serve together for minutes. Pick it for small teams and internal services, when both versions can run side by side and the error rate is watched during the rollout.' },
        { value: 'bluegreen', label: 'blue-green', description: 'The new version starts beside the old one, is smoke-tested, and all traffic switches at once; switching back takes seconds. Pick it when versions must not serve together, or rollback must be instant, and double capacity during a release is affordable.' },
        { value: 'canary', label: 'a canary with automatic analysis', description: 'The new version gets 5 %, then 25 %, then 50 % of traffic; at each step its success rate and latency are compared with the stable version and a worse canary is rolled back by itself. Pick it with enough traffic to judge a step (about 100 requests per step or more) and metrics per version.' },
      ],
    },
    {
      key: 'MIGRATIONS', title: 'Schema changes', label: 'How do database schema changes ship?',
      hint: 'During a rollout and after a rollback, the previous version runs against the new schema. A change it cannot read makes rollback impossible. The migration tool itself is decided in the Data store pack.',
      default: 'expand',
      options: [
        { value: 'expand', label: 'expand and contract', description: 'Every change is backward compatible for one release: add, migrate data, switch the code, and remove the old only a release later. Pick it whenever the element owns a schema and versions run side by side, which a rolling update and a canary always do.' },
        { value: 'window', label: 'a maintenance window', description: 'Changes that cannot be made online run with the element stopped, in an announced window, after a rehearsal on a copy of production. Pick it only for a large one-off change (a type change on a huge table, a database upgrade) and when downtime is acceptable.' },
        { value: 'none', label: 'no schema of its own', description: 'The element keeps no database schema; any state lives in services that own their migrations. Pick it for web front ends, gateways and stateless workers.' },
      ],
    },
    {
      key: 'FLAGS', title: 'Feature flags', label: 'Is deploying separate from releasing?',
      hint: 'With feature flags, code reaches production switched off and is turned on for some users, then all, without a deploy; turning it off is the fastest rollback. A flag left behind after its rollout is a debt item, removed by a deadline.',
      default: 'yes',
      options: [
        { value: 'yes', label: 'feature flags', description: 'Unfinished or risky features ship switched off and are turned on per environment or share of users through OpenFeature with a provider (LaunchDarkly, Unleash, flagd, ConfigCat). Pick it with trunk-based development, several changes in flight, or features released at a business date.' },
        { value: 'no', label: 'no flags: a deploy is a release', description: 'What is merged and deployed is live for everyone. Pick it for small teams with fast rollback and features small enough to finish in one change; it avoids the cost of flags and their clean-up.' },
      ],
    },
    {
      key: 'CADENCE', title: 'Cadence', label: 'How often does it release?',
      hint: 'Smaller, more frequent releases fail less often and are easier to undo (DORA). The cadence sets the targets for the DORA metrics.',
      default: 'continuous',
      options: [
        { value: 'continuous', label: 'continuous deployment of every merge', description: 'Every change merged to the main branch goes to production through the pipeline, the same day. Pick it with a test suite and rollout checks the team trusts, and a product where small changes can reach users at any time.' },
        { value: 'train', label: 'a weekly release train', description: 'Changes merged before a weekly cut-off are released together. Pick it when releases need coordination (app stores, customers told in advance, a regulated sign-off), or while the pipeline\'s checks are not yet trusted.' },
      ],
    },
  ],
  details: [
    { key: 'ROLLBACK_MINUTES', label: 'How fast must a bad release be undone (minutes)?', default: '15', number: true },
    { key: 'CANARY_SUCCESS_PERCENT', label: 'Lowest success rate a canary step may show (%); at or above the availability objective decided in the Availability pack', default: '99', number: true },
    { key: 'WINDOW_MINUTES', label: 'How long is a maintenance window for an offline migration (minutes)? Only with migrations in a maintenance window', default: '120', number: true },
    { key: 'FLAG_AGE_DAYS', label: 'Most days a flag may stay after its feature reached all users. Only with feature flags', default: '90', number: true },
  ],
  need: {
    label: 'Changes ship safely and undo quickly',
    text: 'The team changes this element often while people use it. A change must reach production without an outage, a bad change must be stopped before it reaches most users and be undone within minutes, the database must never block a rollback, a feature must be switchable without a deploy where the team decides so, and the team must know how often it ships and how long a change takes to reach users.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-rollback', label: 'Bad release undone fast', ears_type: 'event-driven',
      trigger: 'a release raises the error rate or latency above its service level, or a person decides to roll it back',
      action: 'restore the previous version within {{ROLLBACK_MINUTES}} minutes with one action, using the artifact already built for it and no rebuild',
      rationale: 'Most outages start with a change; how long they last is how long the change takes to undo (DORA, failed deployment recovery time; The Twelve-Factor App, V).',
      scenario: { label: 'Rollback timed', given: 'a release that raises the error rate', when: 'the rollback is started', then: 'the previous version serves all traffic within {{ROLLBACK_MINUTES}} minutes and nothing was rebuilt' },
    },
    {
      id: 'req-graceful', label: 'Deploys drop no requests', ears_type: 'ubiquitous',
      action: 'leave the load balancer and let its requests in flight finish, for up to 30 seconds, before an instance stops, and receive traffic on a new instance only once its readiness check (decided in the Observability pack) passes, so that a deployment under steady load fails 0 requests',
      rationale: 'Requests cut off at shutdown and traffic sent to instances still starting are the errors every deployment causes unless they are designed out (Kubernetes documentation, Pod Lifecycle: termination of pods).',
      scenario: { label: 'Release under load', given: 'steady traffic at the usual rate against staging', when: 'a new version is deployed', then: 'no request fails because of the deployment' },
    },
    {
      id: 'req-rolling', label: 'Rolling update keeps capacity', when: { STRATEGY: ['rolling'] }, ears_type: 'event-driven',
      trigger: 'a new version rolls out',
      action: 'replace instances one at a time, starting each new one before an old one stops, and halt the rollout when new instances fail to become ready for 5 minutes or the error rate rises above its service level',
      rationale: 'A rolling update that removes capacity first, or carries on past failing instances, turns a bad version into an outage (Kubernetes documentation, Deployments: rolling update strategy and progress deadline).',
      scenario: { label: 'Broken version halts', given: 'a version whose instances never become ready', when: 'it rolls out', then: 'the rollout stops after 5 minutes with the old instances still serving' },
    },
    {
      id: 'req-bluegreen', label: 'Switch after smoke tests', when: { STRATEGY: ['bluegreen'] }, ears_type: 'event-driven',
      trigger: 'a new version is deployed beside the live one',
      action: 'run smoke tests against it before any user traffic reaches it, switch all traffic at once only when they pass, and keep the previous version running for 60 minutes to switch back to',
      rationale: 'Blue-green buys an instant rollback by keeping the old version warm; the smoke tests decide the switch (Martin Fowler, Blue Green Deployment).',
      scenario: { label: 'Failed smoke test', given: 'a new version whose checkout smoke test fails', when: 'it is deployed beside the live one', then: 'no user traffic reaches it and the live version keeps serving' },
    },
    {
      id: 'req-canary', label: 'Canary judged automatically', when: { STRATEGY: ['canary'] }, ears_type: 'event-driven',
      trigger: 'a new version rolls out',
      action: 'send it 5 %, 25 % and 50 % of traffic in turn for 10 minutes each, measure its success rate and 95th percentile latency at every step, and roll back automatically when the success rate drops below {{CANARY_SUCCESS_PERCENT}} % or the 95th percentile is more than 20 % above the stable version\'s',
      rationale: 'A canary limits a bad version to a small share of users, and an automatic judgement stops it faster than a person watching dashboards (Google SRE workbook, Canarying Releases).',
      scenario: { label: 'Bad canary rolled back', given: 'a version that fails more than 100 minus {{CANARY_SUCCESS_PERCENT}} % of requests', when: 'it reaches the 5 % step', then: 'the analysis fails and all traffic returns to the stable version within {{ROLLBACK_MINUTES}} minutes' },
    },
    {
      id: 'req-expand-contract', label: 'Schema changes stay compatible', when: { MIGRATIONS: ['expand'] }, ears_type: 'ubiquitous',
      action: 'change the schema only in backward-compatible steps (add, migrate data, switch the code, and remove the old at least one release later), so that the previous version keeps working against the new schema',
      rationale: 'During a rollout and after a rollback, the previous version runs against the new schema; a rename or a drop in one step breaks it (Martin Fowler, Parallel Change).',
      scenario: { label: 'Rollback after migration', given: 'a release that added a column and a migration that filled it', when: 'the release is rolled back', then: 'the previous version runs against the new schema without errors' },
    },
    {
      id: 'req-migration-window', label: 'Offline migrations rehearsed', when: { MIGRATIONS: ['window'] }, ears_type: 'state-driven',
      precondition: 'a schema change cannot run while the element serves',
      action: 'run it only in the announced maintenance window of {{WINDOW_MINUTES}} minutes, after a rehearsal on a restored copy of production in which the migration and the way back (the restore) each finished within half the window, and with a backup taken just before it',
      rationale: 'An offline migration that overruns its window, or cannot be undone, is an outage without an end; the rehearsal tells how long each takes (AWS Well-Architected Reliability Pillar, REL 8: implement change).',
      scenario: { label: 'Rehearsal decides', given: 'an offline migration planned for the {{WINDOW_MINUTES}}-minute window', when: 'its rehearsal on a copy of production takes longer than half the window', then: 'it is not run in that window until it is made faster or the window longer' },
    },
    {
      id: 'req-no-schema', label: 'No schema of its own', when: { MIGRATIONS: ['none'] }, ears_type: 'ubiquitous',
      action: 'keep no database schema of its own and depend on no database client or migration tool, leaving every stored state to services that own their migrations',
      rationale: 'An element without a schema can always be rolled back; this keeps it that way until the decision changes.',
      scenario: { label: 'Nothing to migrate', given: 'the element\'s repository', when: 'its dependencies are searched for database clients and migration tools, and its tree for a migrations directory', then: 'there are none' },
    },
    {
      id: 'req-flags', label: 'Features behind flags', when: { FLAGS: ['yes'] }, ears_type: 'ubiquitous',
      action: 'ship unfinished or risky features switched off behind a flag that can be turned on and off per environment and per share of users without a deploy, apply a changed flag within 60 seconds, and remove each flag within {{FLAG_AGE_DAYS}} days of its feature reaching all users',
      rationale: 'Flags separate deploying from releasing and make switching a feature off the fastest rollback; flags left behind become untested branches (Pete Hodgson, Feature Toggles).',
      scenario: { label: 'Feature switched off', given: 'a feature turned on for 10 % of users', when: 'its flag is turned off', then: 'within 60 seconds no user sees it, and nothing was deployed' },
    },
    {
      id: 'req-no-flags', label: 'No flags: deploys are releases', when: { FLAGS: ['no'] }, ears_type: 'ubiquitous',
      action: 'make every deployed change live for everyone at once, depend on no feature flag SDK or provider, and keep work too large to finish in one change on its branch until it is',
      rationale: 'Without flags, a flag SDK that arrives unnoticed is a release process nobody decided; this keeps the decision true until it is superseded.',
      scenario: { label: 'No flag SDK', given: 'the element\'s repository', when: 'its dependencies are searched for feature flag SDKs and providers', then: 'there are none' },
    },
    {
      id: 'req-continuous', label: 'Every merge deployed', when: { CADENCE: ['continuous'] }, ears_type: 'ubiquitous',
      action: 'deploy every change merged to the main branch to production through the automated pipeline within 1 day, and recover from a failed deployment within {{ROLLBACK_MINUTES}} minutes by rolling back',
      rationale: 'DORA\'s research ties on-demand deployment and lead times under a day to fewer failed changes and faster recovery (DORA, the four key metrics).',
      scenario: { label: 'Merge reaches production', given: 'a change merged to the main branch in the morning', when: 'the day ends', then: 'it is in production, deployed by the pipeline' },
    },
    {
      id: 'req-train', label: 'Weekly release train', when: { CADENCE: ['train'] }, ears_type: 'event-driven',
      trigger: 'the weekly cut-off passes',
      action: 'release every change merged before it to production within 2 working days, keeping the lead time from merge to production under 7 days, and recover from a failed deployment within {{ROLLBACK_MINUTES}} minutes by rolling back',
      rationale: 'A fixed weekly train keeps batches small enough to undo; DORA\'s metrics show whether it is getting slower or failing more (DORA, the four key metrics).',
      scenario: { label: 'Train leaves on time', given: 'changes merged before Tuesday\'s cut-off', when: 'the release train runs', then: 'they are in production by Thursday' },
    },
  ],
  adrs: [
    {
      id: 'adr-rolling', label: 'Rolling updates', when: { STRATEGY: ['rolling'] },
      decision: 'New versions roll out as a rolling update: on Kubernetes a Deployment with maxUnavailable 0 and maxSurge 1, a preStop delay, a progress deadline of 5 minutes and the readiness probes decided in the Observability pack; on other platforms the equivalent (ECS rolling deployments with the deployment circuit breaker, Azure App Service or Cloud Run revisions). The pipeline watches the error rate during the rollout and runs kubectl rollout undo (or the platform\'s rollback) when it rises. The previous version\'s image stays in the registry, so rollback takes {{ROLLBACK_MINUTES}} minutes at most. Schema changes: {{MIGRATIONS}}. Feature flags: {{FLAGS}}. Cadence: {{CADENCE}}.',
      consequences: '• Nothing to install beyond the platform; the cheapest strategy.\n• Old and new versions serve together for minutes: both must work with the same schema and messages.\n• A bad version reaches a growing share of users until someone or something notices.\n• Rollback is another rolling update, minutes rather than seconds.',
      alternatives: '1. Canary with automatic analysis: limits a bad version to 5 % of traffic, but needs Argo Rollouts or Flagger and metrics per version.\n2. Blue-green: instant switch back, at double capacity during each release.',
    },
    {
      id: 'adr-bluegreen', label: 'Blue-green deployments', when: { STRATEGY: ['bluegreen'] },
      decision: 'New versions deploy beside the live one and take traffic all at once after their smoke tests pass: on Kubernetes with Argo Rollouts (blueGreen strategy with pre-promotion analysis), elsewhere with AWS CodeDeploy blue/green, Azure App Service deployment slots or two target groups behind the load balancer. The previous version keeps running for 60 minutes after the switch, so switching back takes seconds and always within {{ROLLBACK_MINUTES}} minutes. Schema changes: {{MIGRATIONS}}. Feature flags: {{FLAGS}}. Cadence: {{CADENCE}}. Choose the tool by the platform the element runs on.',
      consequences: '• Rollback is a switch: seconds, not a redeploy.\n• Users never see two versions at once, but the database does: the schema must still suit both.\n• Double the capacity during each release, and a full environment to warm up.\n• All users get the new version at once; smoke tests are the only gate before them.',
      alternatives: '1. Canary: exposes a bad version to a few users first, with gradual traffic shifting.\n2. Rolling update: no extra capacity, but rollback is slower and versions mix.',
    },
    {
      id: 'adr-canary', label: 'Canary with automatic analysis', when: { STRATEGY: ['canary'] },
      decision: 'New versions roll out as a canary: 5 %, 25 %, 50 %, then 100 % of traffic, 10 minutes per step, with an automatic analysis at every step from Prometheus (or the metrics backend): the canary\'s success rate must stay at or above {{CANARY_SUCCESS_PERCENT}} % and its 95th percentile latency within 20 % of the stable version\'s, or the rollout aborts. Tooling: Argo Rollouts or Flagger on Kubernetes, with traffic split by the ingress or service mesh (NGINX, Istio, Linkerd, Gateway API); AWS CodeDeploy or App Mesh canaries on ECS and Lambda. Choose Argo Rollouts when the team already uses Argo CD, Flagger when it uses Flux. An abort returns all traffic to the stable version within {{ROLLBACK_MINUTES}} minutes. Schema changes: {{MIGRATIONS}}. Feature flags: {{FLAGS}}. Cadence: {{CADENCE}}.',
      consequences: '• A bad version reaches 5 % of users for minutes, not everyone.\n• Rollback is automatic and does not wait for a person.\n• Needs metrics per version and enough traffic for the analysis to be meaningful; at low traffic the steps judge noise.\n• A rollout takes 30 minutes or more; urgent fixes need a documented fast path.',
      alternatives: '1. Rolling update with a person watching: simpler, but slower to notice and a bad version reaches everyone.\n2. Blue-green: instant switch back, but everyone gets the new version at once.',
    },
    {
      id: 'adr-expand-contract', label: 'Expand and contract migrations', when: { MIGRATIONS: ['expand'] },
      decision: 'Schema changes ship as expand and contract: a migration only adds (columns, tables, indexes built concurrently), data is backfilled in batches, the code switches over in a later release, and removals come at least one release after nothing reads the old shape. Migrations run as a separate pipeline step before the new version rolls out, with the migration tool decided in the Data store pack (Flyway, Liquibase, Atlas, or the framework\'s own), which records what ran. A linter in CI refuses destructive or backward-incompatible changes (Atlas migrate lint, or Squawk for PostgreSQL).',
      consequences: '• The previous version always runs against the current schema, so rollback never waits on the database.\n• A rename or type change takes two or three releases instead of one.\n• Old columns linger until the contract step; someone has to schedule it.\n• Backfills on large tables run in batches, outside the deployment.',
      alternatives: '1. Migrations in a maintenance window: one step, but downtime and no quick rollback.\n2. Migrations that run on application start: simple, but every instance races to migrate and a failure blocks the rollout.',
    },
    {
      id: 'adr-migration-window', label: 'Offline migrations in a window', when: { MIGRATIONS: ['window'] },
      decision: 'Schema changes that cannot run online are made in an announced maintenance window of {{WINDOW_MINUTES}} minutes with the element stopped. Before the window, the migration is rehearsed on a copy of production restored from the latest backup, and it runs only if the migration and the way back (restoring that backup) each finished within half the window in the rehearsal. Just before the window a fresh backup is taken. Changes that can run online still ship as expand and contract. Migrations run with the tool decided in the Data store pack (Flyway, Liquibase, Atlas or the framework\'s own), from the pipeline, never by hand.',
      consequences: '• Large or awkward changes can be done in one step.\n• Each window is downtime, announced in advance and counted by users if not by the target.\n• Rollback after the window means restoring the backup and losing what was written since.\n• A copy of production for the rehearsal must be kept safe like production.',
      alternatives: '1. Expand and contract only: no downtime, but some changes take several releases.\n2. Online schema change tools (gh-ost, pt-online-schema-change, pg_repack): big changes without downtime, with tooling to learn.',
    },
    {
      id: 'adr-no-schema', label: 'No schema of its own', when: { MIGRATIONS: ['none'] },
      context: `${FORCES} Here the element stores nothing of its own: every state it touches lives in a service that owns its migrations.`,
      decision: 'The element keeps no database schema and depends on no database client or migration tool; a dependency rule in CI fails the build when one arrives. State it needs lives in services that own their migrations and are reached through their APIs. Adding a store of its own supersedes this decision and brings the schema change question back.',
      consequences: '• Rollback never waits on a database: the previous version always runs.\n• A feature that needs state of its own has to supersede this decision first, or put the state in a service that owns it.\n• Nothing to migrate, back up or rehearse for this element.',
      alternatives: '1. Expand and contract migrations: for when the element gets a store of its own.\n2. A cache or local file as hidden state: works until a second instance or a rollback shows it was a schema after all.',
    },
    {
      id: 'adr-flags', label: 'Features released behind flags', when: { FLAGS: ['yes'] },
      decision: 'Deploying is separate from releasing: unfinished or risky features ship switched off behind a feature flag and are turned on per environment and per share of users without a deploy. Flags are read through the OpenFeature SDK with one provider for the organisation (LaunchDarkly, Unleash, ConfigCat, or flagd with the flag definitions in the repository); choose by whether a hosted provider is allowed to hold the targeting data, and by cost per seat. A changed flag takes effect within 60 seconds on every instance. A flag whose feature has reached all users is a debt item: it is removed, with the code path behind it, within {{FLAG_AGE_DAYS}} days, and a test fails the build on an older one. Turning a flag off is the first rollback for a released feature; the deployment rollback is the second.',
      consequences: '• Code reaches production continuously; releases are business decisions, made in the flag tool.\n• Every flag doubles the paths to test until it is removed; the {{FLAG_AGE_DAYS}}-day removal is what keeps the count down.\n• The provider is on the request path or in the SDK\'s cache: its outage must leave the element on the last known flags.\n• Who may flip a flag in production is an access decision, written down next to the flags.',
      alternatives: '1. No flags, a deploy is a release: simpler, but every merge is visible to everyone at once.\n2. Flags in configuration files or environment variables: no provider, but changing one is a deploy.',
    },
    {
      id: 'adr-no-flags', label: 'A deploy is a release', when: { FLAGS: ['no'] },
      context: `${FORCES} Here the team keeps changes small enough to finish in one change and trusts the rollback, so it does without flags.`,
      decision: 'There are no feature flags: what is merged and deployed is live for everyone. Unfinished work stays on a branch until it is small enough to ship whole, or ships dark behind a route nobody links to. Rolling back a release is the only way to take a feature back, within {{ROLLBACK_MINUTES}} minutes. This decision is superseded when a feature has to reach some users before others, or be released at a business date apart from its deploy.',
      consequences: '• No flag provider, no flag clean-up, one path to test.\n• A feature cannot be switched off without rolling back everything deployed with it.\n• Features that take weeks need long-lived branches or dark routes, both of which hide integration problems.',
      alternatives: '1. Feature flags through OpenFeature with a provider: releases apart from deploys, at the cost of flags and their removal.\n2. Flags in configuration: a half-way that still needs a deploy to flip.',
    },
    {
      id: 'adr-continuous', label: 'Continuous deployment', when: { CADENCE: ['continuous'] },
      decision: 'Every change merged to the main branch goes to production through the pipeline without a manual step, the same day: trunk-based development with short-lived branches and the rollout strategy above as the safety net. Feature flags: {{FLAGS}}; what is not ready for users either ships switched off behind a flag or stays small enough to finish in one change. The DORA metrics: a weekly job checks deployment frequency (a production deployment on at least 5 days a week) and lead time (every merge in production within 1 day); the change failure rate and the recovery time ({{ROLLBACK_MINUTES}} minutes by rollback) come from the incident tracker and the rollback drill, and all four are reviewed every month (Apache DevLake, Sleuth, LinearB or the CI system\'s own reports).',
      consequences: '• Small batches: each release is easy to understand and to undo.\n• The pipeline\'s tests and rollout checks are the only gate; their quality is the release process.\n• Users see changes continuously; announcements are tied to flags or to dark routes, not to deploys.',
      alternatives: '1. A weekly release train: more coordination, larger batches.\n2. Manual approval of each production deploy: a person as the gate, slower without being safer.',
    },
    {
      id: 'adr-release-train', label: 'Weekly release train', when: { CADENCE: ['train'] },
      decision: 'Changes merged before a weekly cut-off are released together within 2 working days, through the same automated pipeline and rollout strategy; urgent fixes can leave outside the train. Feature flags: {{FLAGS}}. The DORA metrics: a weekly job checks deployment frequency (at least one production release every 7 days) and lead time (every merge in production within 7 days); the change failure rate and the recovery time ({{ROLLBACK_MINUTES}} minutes by rollback) come from the incident tracker and the rollback drill, and all four are reviewed every month (Apache DevLake, Sleuth, LinearB or the CI system\'s own reports).',
      consequences: '• Releases are predictable for customers, support and app stores.\n• Batches are a week of changes: a failure is harder to pin on one change.\n• Lead time is up to a week by design; moving to continuous deployment later is a change of policy, not of tooling.',
      alternatives: '1. Continuous deployment: smaller batches and shorter lead time, with full trust in the pipeline.\n2. Monthly or quarterly releases: big batches that fail more often and are hard to undo (DORA).',
    },
  ],
  fitness: [
    {
      id: 'ff-rollback-drill', label: 'Rollback drilled', category: 'operational', implements: STRATEGY_ADRS,
      checks: ['req-rollback', 'req-continuous', 'req-train'],
      threshold: 'Rollback of the staging deployment to the previous version completes within {{ROLLBACK_MINUTES}} minutes, every week',
      description: 'A scheduled pipeline rolls the staging deployment back to the previous version and forward again, timing each, and fails past {{ROLLBACK_MINUTES}} minutes. With Argo Rollouts use kubectl argo rollouts undo and status instead; on a managed runtime, the platform\'s rollback command (az webapp deployment slot swap, gcloud run services update-traffic).',
      tool: 'GitHub Actions scheduled workflow with kubectl',
      language: 'yaml',
      snippet: `name: rollback-drill
on:
  schedule: [{ cron: '0 9 * * 1' }]   # Mondays 09:00
jobs:
  drill:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Roll back and time it
        run: |
          start=$(date +%s)
          kubectl -n shop-staging rollout undo deployment/order-api
          kubectl -n shop-staging rollout status deployment/order-api --timeout={{ROLLBACK_MINUTES}}m
          echo "Rolled back in $(( $(date +%s) - start )) s"
      - name: Roll forward again
        if: always()
        run: |
          kubectl -n shop-staging rollout undo deployment/order-api
          kubectl -n shop-staging rollout status deployment/order-api --timeout={{ROLLBACK_MINUTES}}m`,
    },
    {
      id: 'ff-graceful', label: 'Deploy under load drops nothing', category: 'operational', implements: STRATEGY_ADRS,
      checks: ['req-graceful'],
      threshold: '0 failed requests (connection errors, 502, 503, 504) in a k6 run that spans a staging deployment at a steady rate',
      description: 'The staging pipeline starts a k6 run at a steady rate, deploys the new version while it runs, and lets the run end two minutes after the rollout finished; the threshold fails the run, and the pipeline, on any failed request. It catches instances stopped with requests in flight and traffic routed before readiness.',
      tool: 'Grafana k6, started by the staging deploy job',
      language: 'js',
      snippet: `// k6 run --env BASE_URL=https://staging.shop.example deploy-under-load.js &
// then, in the same job: kubectl -n shop-staging set image deployment/order-api order-api=$IMAGE
//   && kubectl -n shop-staging rollout status deployment/order-api --timeout=4m; wait  (the k6 exit code fails the job)
import http from 'k6/http'

export const options = {
  scenarios: {
    steady: { executor: 'constant-arrival-rate', rate: 50, timeUnit: '1s', duration: '6m', preAllocatedVUs: 100, maxVUs: 500 },
  },
  thresholds: {
    http_req_failed: ['rate==0'],   // one connection reset or 5xx during the rollout fails the run
  },
}

export default function () {
  http.get(\`\${__ENV.BASE_URL}/orders?page=1\`)
}`,
    },
    {
      id: 'ff-rolling', label: 'Rolling update keeps capacity', when: { STRATEGY: ['rolling'] }, category: 'structural', implements: ['adr-rolling'],
      checks: ['req-rolling'],
      threshold: '0 Deployments with a Recreate strategy, maxUnavailable above 0, maxSurge of 0, a progress deadline above 300 s, or a container without a preStop hook',
      description: 'A policy over the Kubernetes manifests fails the pipeline when a Deployment could remove capacity during a rollout, stop an instance without a preStop delay, or carry on forever past failing instances. Liveness and readiness probes are checked by the Observability pack\'s policy.',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `package main

import rego.v1

deny contains msg if {
  input.kind == "Deployment"
  input.spec.strategy.type == "Recreate"
  msg := sprintf("%s: strategy Recreate stops every instance first; use RollingUpdate", [input.metadata.name])
}

deny contains msg if {
  input.kind == "Deployment"
  unavailable := object.get(input.spec, ["strategy", "rollingUpdate", "maxUnavailable"], "25%")
  not unavailable in {0, "0", "0%"}
  msg := sprintf("%s: set strategy.rollingUpdate.maxUnavailable to 0 (is %v)", [input.metadata.name, unavailable])
}

deny contains msg if {
  input.kind == "Deployment"
  surge := object.get(input.spec, ["strategy", "rollingUpdate", "maxSurge"], "25%")
  surge in {0, "0", "0%"}
  msg := sprintf("%s: set strategy.rollingUpdate.maxSurge to 1 or more", [input.metadata.name])
}

deny contains msg if {
  input.kind == "Deployment"
  object.get(input.spec, "progressDeadlineSeconds", 600) > 300
  msg := sprintf("%s: set progressDeadlineSeconds to 300 or less", [input.metadata.name])
}

deny contains msg if {
  input.kind == "Deployment"
  some c in input.spec.template.spec.containers
  not c.lifecycle.preStop
  msg := sprintf("%s: container %s has no lifecycle.preStop (a sleep that lets the load balancer drain it)", [input.metadata.name, c.name])
}`,
    },
    {
      id: 'ff-bluegreen', label: 'Switch gated by smoke tests', when: { STRATEGY: ['bluegreen'] }, category: 'operational', implements: ['adr-bluegreen'],
      checks: ['req-bluegreen'],
      threshold: 'Traffic switches only after the smoke-test job passes against the preview service; the previous version is kept for 3600 s after the switch',
      description: 'The Rollout runs a k6 smoke-test job against the preview service before promotion; a failed job aborts the release with the live version untouched. The script comes from a ConfigMap mounted into the job. The previous version is scaled down only an hour after the switch.',
      tool: 'Argo Rollouts (blueGreen strategy, pre-promotion analysis)',
      language: 'yaml',
      snippet: `apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: order-api, namespace: shop }
spec:
  strategy:
    blueGreen:
      activeService: order-api
      previewService: order-api-preview
      autoPromotionEnabled: true
      scaleDownDelaySeconds: 3600
      prePromotionAnalysis:
        templates: [{ templateName: smoke-tests }]
---
apiVersion: v1
kind: ConfigMap
metadata: { name: smoke-tests, namespace: shop }
data:
  smoke.js: |
    import http from 'k6/http'
    import { check } from 'k6'
    export const options = { vus: 1, iterations: 10, thresholds: { checks: ['rate==1'] } }
    export default function () {
      const res = http.get(\`\${__ENV.BASE_URL}/orders?page=1\`)
      check(res, { 'orders answer 200': (r) => r.status === 200 })
    }
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata: { name: smoke-tests, namespace: shop }
spec:
  metrics:
    - name: smoke
      provider:
        job:
          spec:
            backoffLimit: 0
            template:
              spec:
                restartPolicy: Never
                volumes: [{ name: tests, configMap: { name: smoke-tests } }]
                containers:
                  - name: k6
                    image: grafana/k6:0.54.0
                    args: [run, --env, BASE_URL=http://order-api-preview, /tests/smoke.js]
                    volumeMounts: [{ name: tests, mountPath: /tests }]`,
    },
    {
      id: 'ff-canary', label: 'Canary analysis aborts bad versions', when: { STRATEGY: ['canary'] }, category: 'operational', implements: ['adr-canary'],
      checks: ['req-canary'],
      threshold: 'A canary step fails at a success rate below {{CANARY_SUCCESS_PERCENT}} % or a 95th percentile more than 20 % above the stable version\'s; a second failed measurement aborts the rollout',
      description: 'The Rollout shifts traffic in steps and runs an analysis from the first step on, measured every minute: the canary\'s success rate against {{CANARY_SUCCESS_PERCENT}} %, and the ratio of the canary\'s 95th percentile to the stable version\'s against 1.2. A second failed measurement of either aborts the rollout and returns all traffic to the stable version. Flagger\'s Canary resource with metric templates does the same.',
      tool: 'Argo Rollouts (canary strategy with a Prometheus AnalysisTemplate)',
      language: 'yaml',
      snippet: `apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: order-api, namespace: shop }
spec:
  strategy:
    canary:
      canaryService: order-api-canary
      stableService: order-api
      trafficRouting: { nginx: { stableIngress: order-api } }
      analysis:
        templates: [{ templateName: canary-health }]
        startingStep: 1
        args:
          - { name: canary, value: order-api-canary }
          - { name: stable, value: order-api }
      steps:
        - setWeight: 5
        - pause: { duration: 10m }
        - setWeight: 25
        - pause: { duration: 10m }
        - setWeight: 50
        - pause: { duration: 10m }
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata: { name: canary-health, namespace: shop }
spec:
  args: [{ name: canary }, { name: stable }]
  metrics:
    - name: success-rate
      interval: 1m
      failureLimit: 1                       # a second failed measurement fails the analysis
      successCondition: result[0] * 100 >= {{CANARY_SUCCESS_PERCENT}}
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_server_request_duration_seconds_count{service="{{args.canary}}",http_response_status_code!~"5.."}[2m]))
            / sum(rate(http_server_request_duration_seconds_count{service="{{args.canary}}"}[2m]))
    - name: p95-vs-stable
      interval: 1m
      failureLimit: 1
      successCondition: result[0] <= 1.2    # canary p95 at most 20 % above the stable p95
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket{service="{{args.canary}}"}[2m])))
            / histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket{service="{{args.stable}}"}[2m])))`,
    },
    {
      id: 'ff-migration-lint', label: 'Migrations stay compatible', when: { MIGRATIONS: ['expand'] }, category: 'structural', implements: ['adr-expand-contract'],
      checks: ['req-expand-contract'],
      threshold: '0 destructive or backward-incompatible statements (drop, rename, type change) in a migration that is not a marked contract step',
      description: 'Every pull request that adds a migration is linted against the main branch; dropping or renaming a column or table fails the build unless the migration is the contract step of an earlier expand, marked with a lint directive and reviewed.',
      tool: 'Atlas (atlas migrate lint); Squawk does the same for PostgreSQL',
      language: 'hcl',
      snippet: `# atlas.hcl
lint {
  destructive {
    error = true
  }
  incompatible {
    error = true
  }
}

env "ci" {
  dev = "docker://postgres/16/dev"
  migration {
    dir = "file://migrations"
  }
}

# CI step:
#   atlas migrate lint --env ci --git-base origin/main
# A reviewed contract step opts out per statement with:
#   -- atlas:nolint destructive`,
    },
    {
      id: 'ff-migration-rehearsal', label: 'Offline migration rehearsed', when: { MIGRATIONS: ['window'] }, category: 'process', implements: ['adr-migration-window'],
      checks: ['req-migration-window'],
      threshold: 'In the rehearsal on a restored copy of production, the migration and the restore each finish within half of {{WINDOW_MINUTES}} minutes; the production run needs an approved environment',
      description: 'A pipeline job restores the latest backup into a rehearsal database, runs the pending migrations against it and times them, then restores the backup again (the way back) and times that; it fails when either took longer than half the window. The production job runs only after an approval in a protected environment, takes a backup first, and only follows a passed rehearsal.',
      tool: 'GitHub Actions (protected environment) with pg_restore and Flyway',
      language: 'yaml',
      snippet: `jobs:
  rehearse:
    runs-on: ubuntu-latest
    steps:
      - run: |
          half=$(( {{WINDOW_MINUTES}} * 30 ))   # seconds: half of {{WINDOW_MINUTES}} minutes
          pg_restore --clean --no-owner -d "$REHEARSAL_DB_URL" backups/latest.dump
          start=$(date +%s)
          flyway -url="$REHEARSAL_JDBC_URL" -locations=filesystem:migrations migrate
          took=$(( $(date +%s) - start ))
          echo "Migration took $took s"
          test "$took" -le "$half" || { echo "::error::Migration longer than half the window"; exit 1; }
          start=$(date +%s)
          pg_restore --clean --no-owner -d "$REHEARSAL_DB_URL" backups/latest.dump
          took=$(( $(date +%s) - start ))
          echo "The way back (restore) took $took s"
          test "$took" -le "$half" || { echo "::error::Restore longer than half the window"; exit 1; }
  migrate:
    needs: rehearse
    runs-on: ubuntu-latest
    environment: production-maintenance   # required reviewers; the window is announced
    steps:
      - run: |
          ./scripts/backup-now.sh
          flyway -url="$PROD_JDBC_URL" -locations=filesystem:migrations migrate`,
    },
    {
      id: 'ff-no-schema', label: 'No database client arrives', when: { MIGRATIONS: ['none'] }, category: 'structural', implements: ['adr-no-schema'],
      checks: ['req-no-schema'],
      threshold: '0 dependencies on a database client or migration tool, and no migrations directory in the repository',
      description: 'A dependency rule fails the build when a database driver, ORM or migration tool is added, which would mean a schema arrived without its decision; a pipeline step fails on a migrations directory. For Python, Go or the JVM, the same rule goes in the dependency allow-list of the build (pip-audit --require-hashes with a constraints file, go.mod review, a Gradle dependency verification).',
      tool: 'dependency-cruiser; for Python: a constraints file reviewed in CI; for Go: go.mod reviewed in CI',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'no-schema-of-its-own',
    comment: 'ADR No schema of its own: supersede it before adding a database client or a migration tool',
    severity: 'error',
    from: {},
    to: { path: 'node_modules/(pg|mysql2|mongodb|mongoose|@prisma/client|prisma|knex|typeorm|sequelize|drizzle-orm|node-pg-migrate|umzug)(/|$)' },
  }],
}
// CI, after depcruise:  test ! -e migrations -a ! -e prisma/migrations -a ! -e db/migrate`,
    },
    {
      id: 'ff-flag-age', label: 'Stale flags removed', when: { FLAGS: ['yes'] }, category: 'structural', implements: ['adr-flags'],
      checks: ['req-flags'],
      threshold: '0 flags on for everyone for more than {{FLAG_AGE_DAYS}} days',
      description: 'A test reads the flagd flag definitions kept in the repository, treats a flag as fully released when it is enabled with defaultVariant on and no targeting, takes the date its defaultVariant line last changed from git blame, and fails for every flag released longer than {{FLAG_AGE_DAYS}} days ago, so that it is removed with the code path behind it. The checkout needs the history (fetch-depth: 0). With a hosted provider, read the flags and their last change from its API instead.',
      tool: 'Vitest over flagd (OpenFeature) flag definitions, with git blame',
      language: 'ts',
      snippet: `import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const FILE = 'flags/flags.flagd.json'
const text = readFileSync(FILE, 'utf8')
const lines = text.split('\\n')
const { flags } = JSON.parse(text) as {
  flags: Record<string, { state: 'ENABLED' | 'DISABLED'; defaultVariant?: string; targeting?: unknown }>
}
const MAX_DAYS = {{FLAG_AGE_DAYS}}

/** When the given line of the file last changed, from git blame. */
const changedAt = (line: number): number => {
  const blame = execFileSync('git', ['blame', '--porcelain', \`-L\${line},\${line}\`, '--', FILE], { encoding: 'utf8' })
  return Number(/^committer-time (\\d+)$/m.exec(blame)![1]) * 1000
}

it.each(Object.entries(flags))('flag %s is removed in time after its full release', (key, flag) => {
  const released = flag.state === 'ENABLED' && flag.defaultVariant === 'on' && !flag.targeting
  if (!released) return
  const start = lines.findIndex((l) => l.includes(\`"\${key}"\`))
  const line = lines.findIndex((l, i) => i > start && l.includes('"defaultVariant"')) + 1
  const days = (Date.now() - changedAt(line)) / 86_400_000
  expect(days, \`remove flag \${key}: on for everyone for \${Math.floor(days)} days\`).toBeLessThanOrEqual(MAX_DAYS)
})`,
    },
    {
      id: 'ff-flag-propagation', label: 'Flag changes take effect in time', when: { FLAGS: ['yes'] }, category: 'operational', implements: ['adr-flags'],
      checks: ['req-flags'],
      threshold: 'A flag turned off reaches the element within 60 seconds, with no deployment',
      description: 'An integration test against the staging element turns a flag on and then off at its source (the flag definitions file flagd watches, or the provider\'s API with a hosted provider) and polls the element until its answer changes, failing past 60 seconds.',
      tool: 'Vitest against staging, writing the flagd flag definitions (or the provider\'s API)',
      language: 'ts',
      snippet: `import { readFileSync, writeFileSync } from 'node:fs'

const FLAGS = process.env.FLAGS_FILE ?? 'flags/flags.flagd.json'   // the file flagd syncs from
const BASE_URL = process.env.BASE_URL!
const FLAG = 'new-checkout'

const setDefault = (variant: 'on' | 'off'): void => {
  const doc = JSON.parse(readFileSync(FLAGS, 'utf8'))
  doc.flags[FLAG].defaultVariant = variant
  writeFileSync(FLAGS, JSON.stringify(doc, null, 2))
}
const until = async (ok: () => Promise<boolean>, ms: number): Promise<void> => {
  const end = Date.now() + ms
  while (!(await ok())) {
    if (Date.now() > end) throw new Error(\`not applied within \${ms} ms\`)
    await new Promise((r) => setTimeout(r, 1000))
  }
}
const seen = async (): Promise<string | null> => (await fetch(\`\${BASE_URL}/checkout\`)).headers.get('x-feature-new-checkout')

it('a flag turned off reaches the element within 60 seconds', async () => {
  setDefault('on')
  await until(async () => (await seen()) === 'on', 60_000)
  const started = Date.now()
  setDefault('off')
  await until(async () => (await seen()) === 'off', 60_000)
  expect(Date.now() - started).toBeLessThanOrEqual(60_000)
})`,
    },
    {
      id: 'ff-no-flags', label: 'No flag SDK arrives', when: { FLAGS: ['no'] }, category: 'structural', implements: ['adr-no-flags'],
      checks: ['req-no-flags'],
      threshold: '0 dependencies on a feature flag SDK or provider client',
      description: 'A dependency rule fails the build when a feature flag SDK or a provider\'s client is added, which would mean releases became separate from deploys without the decision being superseded. For Python, Go or the JVM, the same rule goes in the dependency review of the build.',
      tool: 'dependency-cruiser; for Python: a constraints file reviewed in CI; for Go: go.mod reviewed in CI',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'no-feature-flags',
    comment: 'ADR A deploy is a release: supersede it before adding feature flags',
    severity: 'error',
    from: {},
    to: { path: 'node_modules/(@openfeature/|launchdarkly-node-server-sdk|@launchdarkly/|unleash-client|configcat-node|flagsmith-nodejs|@growthbook/)' },
  }],
}`,
    },
    {
      id: 'ff-dora-continuous', label: 'Deploys daily, merges live within a day', when: { CADENCE: ['continuous'] }, category: 'process', implements: ['adr-continuous'],
      checks: ['req-continuous'],
      threshold: 'Production deployments on at least 5 days of every week; the longest lead time from merge to production in the last 7 days at most 24 hours',
      description: 'A weekly job reads the repository\'s production deployments and merged pull requests of the last 7 days: it fails below 5 deployment days, and when any merge waited more than 24 hours for the first production deployment after it. Change failure rate and recovery come from the incident tracker and the rollback drill, reviewed monthly.',
      tool: 'GitHub CLI and jq in a scheduled GitHub Actions job',
      language: 'yaml',
      snippet: `name: dora-weekly
on:
  schedule: [{ cron: '0 7 * * 1' }]
jobs:
  frequency-and-lead-time:
    runs-on: ubuntu-latest
    steps:
      - env:
          GH_TOKEN: \${{ github.token }}
        run: |
          since=$(date -u -d '-7 days' +%FT%TZ)
          gh api "repos/\${{ github.repository }}/deployments?environment=production&per_page=100" \\
            --jq "[.[] | select(.created_at > \\"$since\\") | .created_at]" > deploys.json
          days=$(jq 'map(.[0:10]) | unique | length' deploys.json)
          echo "Days with a production deployment in the last 7: $days"
          test "$days" -ge 5
          # lead time: from each merge of the last 7 days to the first production deployment after it
          gh pr list --state merged --search "merged:>=$(date -u -d '-7 days' +%F)" --limit 200 --json mergedAt \\
            | jq -e --slurpfile deploys deploys.json '
                [.[] | .mergedAt as $m | ($deploys[0] | map(select(. >= $m)) | min) as $d
                     | select($d != null) | (($d | fromdateiso8601) - ($m | fromdateiso8601)) / 3600]
                | (max // 0) as $worst | "Longest lead time: \\($worst | floor) h" | stderr | $worst <= 24'`,
    },
    {
      id: 'ff-dora-train', label: 'Train leaves weekly, merges live within a week', when: { CADENCE: ['train'] }, category: 'process', implements: ['adr-release-train'],
      checks: ['req-train'],
      threshold: 'At least 1 production deployment in every 7 days; the longest lead time from merge to production in the last 14 days at most 7 days',
      description: 'A weekly job reads the repository\'s production deployments and merged pull requests: it fails when no production deployment happened in the last 7 days, and when any merge of the last 14 days waited more than 7 days for the first production deployment after it. Change failure rate and recovery come from the incident tracker and the rollback drill, reviewed monthly.',
      tool: 'GitHub CLI and jq in a scheduled GitHub Actions job',
      language: 'yaml',
      snippet: `name: dora-weekly
on:
  schedule: [{ cron: '0 7 * * 1' }]
jobs:
  train:
    runs-on: ubuntu-latest
    steps:
      - env:
          GH_TOKEN: \${{ github.token }}
        run: |
          since=$(date -u -d '-14 days' +%FT%TZ)
          gh api "repos/\${{ github.repository }}/deployments?environment=production&per_page=100" \\
            --jq "[.[] | select(.created_at > \\"$since\\") | .created_at]" > deploys.json
          week=$(date -u -d '-7 days' +%FT%TZ)
          n=$(jq --arg week "$week" 'map(select(. > $week)) | length' deploys.json)
          echo "Production deployments in the last 7 days: $n"
          test "$n" -ge 1
          gh pr list --state merged --search "merged:>=$(date -u -d '-14 days' +%F)" --limit 300 --json mergedAt \\
            | jq -e --slurpfile deploys deploys.json '
                [.[] | .mergedAt as $m | ($deploys[0] | map(select(. >= $m)) | min) as $d
                     | select($d != null) | (($d | fromdateiso8601) - ($m | fromdateiso8601)) / 86400]
                | (max // 0) as $worst | "Longest lead time: \\($worst | floor) days" | stderr | $worst <= 7'`,
    },
  ],
}

export default pack
