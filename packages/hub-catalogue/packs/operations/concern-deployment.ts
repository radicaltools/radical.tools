import type { PackSpec } from '../../src/packSpec'

const STRATEGY_ADRS = ['adr-rolling', 'adr-bluegreen', 'adr-canary']
const FORCES = 'This element is changed and deployed while people use it. The forces: most outages start with a change, so how a change reaches production decides much of the availability; a release that cannot be undone quickly turns a small mistake into a long outage; old and new versions run side by side during most deployments and both must work against the same database; a schema change that the previous version cannot read makes rollback impossible; small, frequent changes fail less often and are easier to undo than large, rare ones (DORA); and deploying is not the same as releasing: code can be in production without users seeing it.'

const pack: PackSpec = {
  id: 'concern-deployment',
  name: 'Deployment and rollback',
  group: 'operations',
  description: 'How a change reaches production and how it is undone: the rollout strategy and its automatic checks, database migrations that keep rollback possible, feature flags, the time to roll back, and the release cadence measured with the DORA metrics.',
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
  ],
  questions: [
    {
      key: 'STRATEGY', title: 'Rollout', label: 'How does a new version roll out?',
      hint: 'This decides how many users a bad version reaches before it is stopped, and how fast it is undone.',
      default: 'canary',
      options: [
        { value: 'rolling', label: 'a rolling update', description: 'Instances are replaced a few at a time; old and new versions serve together for minutes. Pick it for small teams and internal services, when both versions can run side by side and the error rate is watched during the rollout.' },
        { value: 'bluegreen', label: 'blue-green', description: 'The new version starts beside the old one, is smoke-tested, and all traffic switches at once; switching back takes seconds. Pick it when versions must not serve together, or rollback must be instant, and double capacity during a release is affordable.' },
        { value: 'canary', label: 'a canary with automatic analysis', description: 'The new version gets 5 %, then 25 %, then 50 % of traffic; at each step its error rate and latency are compared with the stable one and a worse canary is rolled back by itself. Pick it with enough traffic to judge a step (about 100 requests per step or more) and metrics per version.' },
      ],
    },
    {
      key: 'MIGRATIONS', title: 'Schema changes', label: 'How do database schema changes ship?',
      hint: 'During a rollout and after a rollback, the previous version runs against the new schema. A change it cannot read makes rollback impossible.',
      default: 'expand',
      options: [
        { value: 'expand', label: 'expand and contract', description: 'Every change is backward compatible for one release: add, migrate data, switch the code, and remove the old only a release later. Pick it whenever the element owns a schema and versions run side by side, which a rolling update and a canary always do.' },
        { value: 'window', label: 'in a maintenance window', description: 'Changes that cannot be made online run with the element stopped, in an announced window, after a rehearsal on a copy of production. Pick it only for a large one-off change (a type change on a huge table, a database upgrade) and when downtime is acceptable.' },
        { value: 'none', label: 'no schema of its own', description: 'The element keeps no database schema; any state lives in services that own their migrations. Pick it for web front ends, gateways and stateless workers.' },
      ],
    },
    {
      key: 'FLAGS', title: 'Feature flags', label: 'Is deploying separate from releasing?',
      hint: 'With feature flags, code reaches production switched off and is turned on for some users, then all, without a deploy; turning it off is the fastest rollback.',
      default: 'yes',
      options: [
        { value: 'yes', label: 'yes, behind feature flags', description: 'Unfinished or risky features ship switched off and are turned on per environment or share of users through OpenFeature with a provider (LaunchDarkly, Unleash, flagd, ConfigCat). Pick it with trunk-based development, several changes in flight, or features released at a business date.' },
        { value: 'no', label: 'no, a deploy is a release', description: 'What is merged and deployed is live for everyone. Pick it for small teams with fast rollback and features small enough to finish in one change; it avoids the cost of flags and their clean-up.' },
      ],
    },
    {
      key: 'CADENCE', title: 'Cadence', label: 'How often does it release?',
      hint: 'Smaller, more frequent releases fail less often and are easier to undo (DORA). The cadence sets the targets for the four DORA metrics.',
      default: 'continuous',
      options: [
        { value: 'continuous', label: 'continuously, every merge', description: 'Every change merged to the main branch goes to production through the pipeline, the same day. Pick it with a test suite and rollout checks the team trusts, and a product where small changes can reach users at any time.' },
        { value: 'train', label: 'a weekly release train', description: 'Changes merged before a weekly cut-off are released together. Pick it when releases need coordination (app stores, customers told in advance, a regulated sign-off), or while the pipeline\'s checks are not yet trusted.' },
      ],
    },
  ],
  details: [
    { key: 'ROLLBACK_MINUTES', label: 'How fast must a bad release be undone (minutes)?', default: '15', number: true },
  ],
  need: {
    label: 'Changes ship safely and undo quickly',
    text: 'The team changes this element often while people use it. A change must reach production without an outage, a bad change must be stopped before it reaches most users and be undone within minutes, the database must never block a rollback, and the team must know how often it ships and how often shipping goes wrong.',
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
      action: 'take an instance out of the load balancer and let its requests in flight finish, for up to 30 seconds, before stopping it, and send traffic to a new instance only once its readiness check passes',
      rationale: 'Requests cut off at shutdown and traffic sent to instances still starting are the errors every deployment causes unless they are designed out (Kubernetes documentation, pod termination).',
      scenario: { label: 'Release under load', given: 'steady traffic at the usual rate', when: 'a new version is deployed', then: 'no request fails because of the deployment' },
    },
    {
      id: 'req-rolling', label: 'Rolling update keeps capacity', when: { STRATEGY: ['rolling'] }, ears_type: 'event-driven',
      trigger: 'a new version rolls out',
      action: 'replace instances one at a time, starting each new one before an old one stops, and halt the rollout when new instances fail readiness for 5 minutes or the error rate rises above its service level',
      rationale: 'A rolling update that removes capacity first, or carries on past failing instances, turns a bad version into an outage (Kubernetes documentation, Deployments).',
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
      action: 'send it 5 %, 25 % and 50 % of traffic in turn for 10 minutes each, compare its success rate and 95th percentile latency with the stable version at every step, and roll back automatically when the success rate drops below 99 % or the latency is 20 % worse',
      rationale: 'A canary limits a bad version to a small share of users, and an automatic judgement stops it faster than a person watching dashboards (Google SRE workbook, Canarying Releases).',
      scenario: { label: 'Bad canary rolled back', given: 'a version that fails 3 % of requests', when: 'it reaches the 5 % step', then: 'the analysis fails and all traffic returns to the stable version within {{ROLLBACK_MINUTES}} minutes' },
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
      action: 'run it only in an announced maintenance window, after a rehearsal on a restored copy of production that finished within half the window, and with a backup taken just before it and a tested way back',
      rationale: 'An offline migration that overruns its window, or cannot be undone, is an outage without an end; the rehearsal tells how long it takes (AWS Well-Architected REL 8).',
      scenario: { label: 'Rehearsal decides', given: 'an offline migration planned for a two-hour window', when: 'its rehearsal on a copy of production takes 90 minutes', then: 'it is not run in that window until it is made faster or the window longer' },
    },
    {
      id: 'req-no-schema', label: 'No schema of its own', when: { MIGRATIONS: ['none'] }, ears_type: 'ubiquitous',
      action: 'keep no database schema of its own, leaving every stored state to services that own their migrations',
      rationale: 'An element without a schema can always be rolled back; this keeps it that way until the decision changes.',
      scenario: { label: 'Nothing to migrate', given: 'the element\'s repository', when: 'it is searched for migrations and database clients', then: 'there are none' },
    },
    {
      id: 'req-flags', label: 'Features behind flags', when: { FLAGS: ['yes'] }, ears_type: 'ubiquitous',
      action: 'ship unfinished or risky features switched off behind a flag that can be turned on and off per environment and per share of users without a deploy, take effect within 60 seconds, and remove each flag within 30 days of the feature reaching all users',
      rationale: 'Flags separate deploying from releasing and make switching a feature off the fastest rollback; flags left behind become untested branches (Pete Hodgson, Feature Toggles).',
      scenario: { label: 'Feature switched off', given: 'a feature turned on for 10 % of users', when: 'its flag is turned off', then: 'within 60 seconds no user sees it, and nothing was deployed' },
    },
    {
      id: 'req-continuous', label: 'Every merge deployed', when: { CADENCE: ['continuous'] }, ears_type: 'ubiquitous',
      action: 'deploy every change merged to the main branch to production through the automated pipeline within 1 day, keeping the change failure rate under 15 % and recovering from a failed deployment within 1 hour',
      rationale: 'DORA\'s research ties on-demand deployment and lead times under a day to fewer failed changes and faster recovery (DORA, the four key metrics).',
      scenario: { label: 'Merge reaches production', given: 'a change merged to the main branch in the morning', when: 'the day ends', then: 'it is in production, deployed by the pipeline' },
    },
    {
      id: 'req-train', label: 'Weekly release train', when: { CADENCE: ['train'] }, ears_type: 'event-driven',
      trigger: 'the weekly cut-off passes',
      action: 'release every change merged before it to production within 2 working days, keeping the lead time from merge to production under 7 days and the change failure rate under 15 %',
      rationale: 'A fixed weekly train keeps batches small enough to undo; DORA\'s metrics show whether it is getting slower or failing more (DORA, the four key metrics).',
      scenario: { label: 'Train leaves on time', given: 'changes merged before Tuesday\'s cut-off', when: 'the release train runs', then: 'they are in production by Thursday' },
    },
  ],
  adrs: [
    {
      id: 'adr-rolling', label: 'Rolling updates', when: { STRATEGY: ['rolling'] },
      decision: 'New versions roll out as a rolling update: on Kubernetes a Deployment with maxUnavailable 0 and maxSurge 1, readiness probes, a preStop delay and a progress deadline of 5 minutes; on other platforms the equivalent (ECS rolling deployments with the deployment circuit breaker, Azure App Service or Cloud Run revisions). The pipeline watches the error rate during the rollout and runs kubectl rollout undo (or the platform\'s rollback) when it rises. The previous version\'s image stays in the registry, so rollback takes {{ROLLBACK_MINUTES}} minutes at most. Schema changes: {{MIGRATIONS}}. Feature flags: {{FLAGS}}. Cadence: {{CADENCE}}.',
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
      decision: 'New versions roll out as a canary: 5 %, 25 %, 50 %, then 100 % of traffic, 10 minutes per step, with an automatic analysis at every step that compares the canary\'s success rate and 95th percentile latency (from Prometheus or the metrics backend) with the stable version and aborts on a worse result. Tooling: Argo Rollouts or Flagger on Kubernetes, with traffic split by the ingress or service mesh (NGINX, Istio, Linkerd, Gateway API); AWS CodeDeploy or App Mesh canaries on ECS and Lambda. Choose Argo Rollouts when the team already uses Argo CD, Flagger when it uses Flux. An abort returns all traffic to the stable version within {{ROLLBACK_MINUTES}} minutes. Schema changes: {{MIGRATIONS}}. Feature flags: {{FLAGS}}. Cadence: {{CADENCE}}.',
      consequences: '• A bad version reaches 5 % of users for minutes, not everyone.\n• Rollback is automatic and does not wait for a person.\n• Needs metrics per version and enough traffic for the analysis to be meaningful; at low traffic the steps judge noise.\n• A rollout takes 30 minutes or more; urgent fixes need a documented fast path.',
      alternatives: '1. Rolling update with a person watching: simpler, but slower to notice and a bad version reaches everyone.\n2. Blue-green: instant switch back, but everyone gets the new version at once.',
    },
    {
      id: 'adr-expand-contract', label: 'Expand and contract migrations', when: { MIGRATIONS: ['expand'] },
      decision: 'Schema changes ship as expand and contract: a migration only adds (columns, tables, indexes built concurrently), data is backfilled in batches, the code switches over in a later release, and removals come at least one release after nothing reads the old shape. Migrations run as a separate pipeline step before the new version rolls out, with a migration tool that records what ran: Flyway, Liquibase, Atlas, or the framework\'s own (Entity Framework, Alembic, Prisma Migrate). A linter in CI refuses destructive or backward-incompatible changes (Atlas migrate lint, or Squawk for PostgreSQL).',
      consequences: '• The previous version always runs against the current schema, so rollback never waits on the database.\n• A rename or type change takes two or three releases instead of one.\n• Old columns linger until the contract step; someone has to schedule it.\n• Backfills on large tables run in batches, outside the deployment.',
      alternatives: '1. Migrations in a maintenance window: one step, but downtime and no quick rollback.\n2. Migrations that run on application start: simple, but every instance races to migrate and a failure blocks the rollout.',
    },
    {
      id: 'adr-migration-window', label: 'Offline migrations in a window', when: { MIGRATIONS: ['window'] },
      decision: 'Schema changes that cannot run online are made in an announced maintenance window with the element stopped. Before the window, the migration is rehearsed on a copy of production restored from the latest backup, and it runs only if the rehearsal finished within half the window. Just before it, a fresh backup is taken; the way back (a down-migration or the restore) is part of the rehearsal. Changes that can run online still ship as expand and contract. Migrations run with Flyway, Liquibase, Atlas or the framework\'s own tool, from the pipeline, never by hand.',
      consequences: '• Large or awkward changes can be done in one step.\n• Each window is downtime, announced in advance and counted by users if not by the target.\n• Rollback after the window means restoring the backup and losing what was written since.\n• A copy of production for the rehearsal must be kept safe like production.',
      alternatives: '1. Expand and contract only: no downtime, but some changes take several releases.\n2. Online schema change tools (gh-ost, pt-online-schema-change, pg_repack): big changes without downtime, with tooling to learn.',
    },
    {
      id: 'adr-continuous', label: 'Continuous deployment', when: { CADENCE: ['continuous'] },
      decision: 'Every change merged to the main branch goes to production through the pipeline without a manual step, the same day: trunk-based development with short-lived branches, the rollout strategy above as the safety net, and feature flags ({{FLAGS}}) for what is not ready. The four DORA metrics are measured from the pipeline and the incident tracker (Apache DevLake, Sleuth, LinearB or the CI system\'s own reports) and reviewed every month: deployment frequency daily or more, lead time for changes under 1 day, change failure rate under 15 %, failed deployment recovery under 1 hour.',
      consequences: '• Small batches: each release is easy to understand and to undo.\n• The pipeline\'s tests and rollout checks are the only gate; their quality is the release process.\n• Users see changes continuously; announcements are tied to flags, not deploys.',
      alternatives: '1. A weekly release train: more coordination, larger batches.\n2. Manual approval of each production deploy: a person as the gate, slower without being safer.',
    },
    {
      id: 'adr-release-train', label: 'Weekly release train', when: { CADENCE: ['train'] },
      decision: 'Changes merged before a weekly cut-off are released together within 2 working days, through the same automated pipeline and rollout strategy; urgent fixes can leave outside the train. The four DORA metrics are measured from the pipeline and the incident tracker (Apache DevLake, Sleuth, LinearB or the CI system\'s own reports) and reviewed every month: at least one production release every 7 days, lead time for changes under 7 days, change failure rate under 15 %, failed deployment recovery under 1 day. Feature flags: {{FLAGS}}.',
      consequences: '• Releases are predictable for customers, support and app stores.\n• Batches are a week of changes: a failure is harder to pin on one change.\n• Lead time is up to a week by design; moving to continuous deployment later is a change of policy, not of tooling.',
      alternatives: '1. Continuous deployment: smaller batches and shorter lead time, with full trust in the pipeline.\n2. Monthly or quarterly releases: big batches that fail more often and are hard to undo (DORA).',
    },
  ],
  fitness: [
    {
      id: 'ff-rollback-drill', label: 'Rollback drilled', category: 'operational', implements: STRATEGY_ADRS,
      threshold: 'Rollback of the staging deployment to the previous version completes within {{ROLLBACK_MINUTES}} minutes, every week',
      description: 'A scheduled pipeline rolls the staging deployment back to the previous version and forward again, timing each, and fails past {{ROLLBACK_MINUTES}} minutes. With Argo Rollouts use kubectl argo rollouts undo and status instead.',
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
      id: 'ff-rolling', label: 'Rolling update keeps capacity', when: { STRATEGY: ['rolling'] }, category: 'structural', implements: ['adr-rolling'],
      threshold: '0 Deployments with maxUnavailable above 0, without a readiness probe, or without a progress deadline of at most 300 s',
      description: 'A policy over the Kubernetes manifests fails the pipeline when a Deployment could remove capacity during a rollout, route traffic to instances that are not ready, or carry on forever past failing instances.',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `package main

import rego.v1

deny contains msg if {
  input.kind == "Deployment"
  object.get(input.spec, ["strategy", "rollingUpdate", "maxUnavailable"], "25%") != 0
  msg := sprintf("%s: set strategy.rollingUpdate.maxUnavailable to 0", [input.metadata.name])
}

deny contains msg if {
  input.kind == "Deployment"
  object.get(input.spec, "progressDeadlineSeconds", 600) > 300
  msg := sprintf("%s: set progressDeadlineSeconds to 300 or less", [input.metadata.name])
}

deny contains msg if {
  input.kind == "Deployment"
  some c in input.spec.template.spec.containers
  not c.readinessProbe
  msg := sprintf("%s: container %s has no readinessProbe", [input.metadata.name, c.name])
}`,
    },
    {
      id: 'ff-bluegreen', label: 'Switch gated by smoke tests', when: { STRATEGY: ['bluegreen'] }, category: 'operational', implements: ['adr-bluegreen'],
      threshold: 'Traffic switches only after the smoke tests pass on the preview; the previous version kept for 3600 s',
      description: 'The Rollout runs a smoke-test job against the preview service before promotion; a failed job aborts the release with the live version untouched. The previous version is scaled down only an hour after the switch.',
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
                containers:
                  - name: k6
                    image: grafana/k6:0.54.0
                    args: [run, --env, BASE_URL=http://order-api-preview, /tests/smoke.js]`,
    },
    {
      id: 'ff-canary', label: 'Canary analysis aborts bad versions', when: { STRATEGY: ['canary'] }, category: 'operational', implements: ['adr-canary'],
      threshold: 'A canary step fails at a success rate below 99 % or a 95th percentile above 0.5 s; 0 bad versions promoted past 5 %',
      description: 'The Rollout shifts traffic in steps and runs an analysis from the first step on; two failed measurements abort the rollout and return all traffic to the stable version. Flagger\'s Canary resource with metric templates does the same.',
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
        args: [{ name: service, value: order-api-canary }]
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
  args: [{ name: service }]
  metrics:
    - name: success-rate
      interval: 1m
      failureLimit: 2
      successCondition: result[0] >= 0.99
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_server_request_duration_seconds_count{service="{{args.service}}",http_response_status_code!~"5.."}[2m]))
            / sum(rate(http_server_request_duration_seconds_count{service="{{args.service}}"}[2m]))
    - name: p95-latency
      interval: 1m
      failureLimit: 2
      successCondition: result[0] <= 0.5
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket{service="{{args.service}}"}[2m])))`,
    },
    {
      id: 'ff-migration-lint', label: 'Migrations stay compatible', when: { MIGRATIONS: ['expand'] }, category: 'structural', implements: ['adr-expand-contract'],
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
      threshold: 'Rehearsal on a restored copy of production finishes within half the window (60 minutes for a 2-hour window); the production run needs an approved environment',
      description: 'A pipeline job restores the latest backup into a rehearsal database, runs the pending migrations against it and times them; the production job runs only after an approval in a protected environment and fails if the rehearsal took longer than half the window.',
      tool: 'GitHub Actions (protected environment) with pg_restore and Flyway',
      language: 'yaml',
      snippet: `jobs:
  rehearse:
    runs-on: ubuntu-latest
    steps:
      - run: |
          pg_restore --clean --no-owner -d "$REHEARSAL_DB_URL" backups/latest.dump
          start=$(date +%s)
          flyway -url="$REHEARSAL_JDBC_URL" -locations=filesystem:migrations migrate
          took=$(( $(date +%s) - start ))
          echo "Rehearsal took $took s"
          test "$took" -le 3600 || { echo "::error::Longer than half the window"; exit 1; }
  migrate:
    needs: rehearse
    runs-on: ubuntu-latest
    environment: production-maintenance   # required reviewers, window announced
    steps:
      - run: |
          ./scripts/backup-now.sh
          flyway -url="$PROD_JDBC_URL" -locations=filesystem:migrations migrate`,
    },
    {
      id: 'ff-flag-age', label: 'Stale flags removed', when: { FLAGS: ['yes'] }, category: 'structural', implements: STRATEGY_ADRS,
      threshold: '0 flags fully released for more than 30 days',
      description: 'A test reads the flag definitions kept in the repository and fails for every flag that has been on for all users for more than 30 days, so that it is removed with the code path behind it.',
      tool: 'Vitest over flagd (OpenFeature) flag definitions',
      language: 'ts',
      snippet: `import { readFileSync } from 'node:fs'

const { flags } = JSON.parse(readFileSync('flags/flags.flagd.json', 'utf8')) as {
  flags: Record<string, { metadata?: { fullyReleasedAt?: string } }>
}
const MAX_DAYS = 30

it.each(Object.entries(flags))('flag %s is removed within 30 days of full release', (key, flag) => {
  const released = flag.metadata?.fullyReleasedAt
  if (!released) return
  const days = (Date.now() - Date.parse(released)) / 86_400_000
  expect(days, \`remove flag \${key}: fully released \${Math.floor(days)} days ago\`).toBeLessThanOrEqual(MAX_DAYS)
})`,
    },
    {
      id: 'ff-dora-continuous', label: 'Deploys daily', when: { CADENCE: ['continuous'] }, category: 'process', implements: ['adr-continuous'],
      threshold: 'Production deployments on at least 5 days of every week; lead time under 1 day and change failure rate under 15 % in the monthly DORA review',
      description: 'A weekly job counts the days with a production deployment in the last 7 days from the repository\'s deployments and fails below 5; lead time and change failure rate come from the DORA dashboard (Apache DevLake) in the monthly review.',
      tool: 'GitHub CLI in a scheduled GitHub Actions job; Apache DevLake for the DORA dashboard',
      language: 'yaml',
      snippet: `name: dora-deployment-frequency
on:
  schedule: [{ cron: '0 7 * * 1' }]
jobs:
  frequency:
    runs-on: ubuntu-latest
    steps:
      - env:
          GH_TOKEN: \${{ github.token }}
        run: |
          since=$(date -u -d '-7 days' +%FT%TZ)
          days=$(gh api "repos/\${{ github.repository }}/deployments?environment=production&per_page=100" \\
            --jq "[.[] | select(.created_at > \\"$since\\") | .created_at[0:10]] | unique | length")
          echo "Days with a production deployment in the last 7: $days"
          test "$days" -ge 5`,
    },
    {
      id: 'ff-dora-train', label: 'Train leaves weekly', when: { CADENCE: ['train'] }, category: 'process', implements: ['adr-release-train'],
      threshold: 'At least 1 production deployment in every 7 days; lead time under 7 days and change failure rate under 15 % in the monthly DORA review',
      description: 'A weekly job fails when no production deployment happened in the last 7 days; lead time and change failure rate come from the DORA dashboard (Apache DevLake) in the monthly review.',
      tool: 'GitHub CLI in a scheduled GitHub Actions job; Apache DevLake for the DORA dashboard',
      language: 'yaml',
      snippet: `name: dora-release-train
on:
  schedule: [{ cron: '0 7 * * 1' }]
jobs:
  train:
    runs-on: ubuntu-latest
    steps:
      - env:
          GH_TOKEN: \${{ github.token }}
        run: |
          since=$(date -u -d '-7 days' +%FT%TZ)
          n=$(gh api "repos/\${{ github.repository }}/deployments?environment=production&per_page=100" \\
            --jq "[.[] | select(.created_at > \\"$since\\")] | length")
          echo "Production deployments in the last 7 days: $n"
          test "$n" -ge 1`,
    },
  ],
}

export default pack
