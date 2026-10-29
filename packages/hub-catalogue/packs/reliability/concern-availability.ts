import type { PackSpec, When } from '../../src/packSpec'

const ZONES: When = { TIER: ['99.9', '99.95'] }
const TIER_ADRS = ['adr-one-zone', 'adr-multi-zone', 'adr-multi-region']
const FORCES = 'People or other systems reach this element, so when it is down somebody notices: a customer who cannot buy, a partner whose calls fail. The forces: every extra nine costs more (more zones, more replicas, automation instead of people) while users cannot tell 99.99 % from 100 % behind their own network; the allowed downtime per 30 days shrinks from hours (99.0 %) to minutes (99.99 %), and a person paged at night needs 15 to 30 minutes just to start; an element is never more available than the product of the hard dependencies it calls; planned work (releases, migrations, patching) is downtime too unless it is designed out; and without an agreed number and a policy for when it is missed, reliability work loses every argument against features. Who is alerted, and the indicator the objective is measured with, are decided in the Observability pack; how a release rolls out without dropping requests in the Deployment and rollback pack. The snippets of this pack assume the element is order-api, scraped by Prometheus as job order-api and deployed to the shop namespace; rename them for yours.'

const pack: PackSpec = {
  id: 'concern-availability',
  name: 'Availability',
  group: 'reliability',
  description: 'How available it must be: the target and its error budget, the redundancy that target needs, what happens when the budget is spent, and how dependencies and planned work count against it.',
  tags: ['reliability', 'availability', 'slo', 'error-budget', 'redundancy', 'multi-zone', 'failover'],
  concern: {
    id: 'availability',
    trigger: 'LIST RELATIONS WHERE (source.type = "person" OR source.external = true) AND target.external != true AND (target.type = "system" OR target.type = "container" OR target.type = "webapp" OR target.type = "component")',
    applyTo: 'target',
    why: 'people or other systems reach these elements, so how much downtime they may have, and what it takes to stay within it, has to be decided.',
  },
  sources: [
    { title: 'Google SRE book, chapter 3: Embracing Risk', url: 'https://sre.google/sre-book/embracing-risk/' },
    { title: 'Google SRE book, chapter 4: Service Level Objectives', url: 'https://sre.google/sre-book/service-level-objectives/' },
    { title: 'Google SRE workbook: Example Error Budget Policy', url: 'https://sre.google/workbook/error-budget-policy/' },
    { title: 'AWS Well-Architected Framework, Reliability Pillar', url: 'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html' },
    { title: 'Sloth: SLO generator for Prometheus', url: 'https://sloth.dev/' },
    { title: 'Chaos Mesh documentation', url: 'https://chaos-mesh.org/docs/' },
    { title: 'Toxiproxy', url: 'https://github.com/Shopify/toxiproxy' },
  ],
  questions: [
    {
      key: 'TIER', title: 'Target', label: 'What availability does it promise, per 30 days (%)?',
      hint: 'Each nine cuts the allowed downtime tenfold and decides the redundancy: one zone, several zones, or several regions. Pick the lowest target the users and contracts accept, not the highest you can imagine.',
      default: '99.9',
      options: [
        { value: '99.0', label: '99.0', description: 'Down at most 7 h 12 min per 30 days. One zone, instances restarted by the platform, a managed database with backups. Pick it for internal tools and back-office work that can wait an hour.' },
        { value: '99.9', label: '99.9', description: 'Down at most 43 min per 30 days. At least two instances in two availability zones and a database that fails over by itself. Pick it for most customer-facing services and partner APIs.' },
        { value: '99.95', label: '99.95', description: 'Down at most 21 min per 30 days. Three zones with capacity to lose one at peak, releases and schema changes without downtime. Pick it for revenue paths (checkout, payments) where an hour down is a visible loss.' },
        { value: '99.99', label: '99.99', description: 'Down at most 4 min 19 s per 30 days: no time for a person to react. Active-active in two regions with automatic failover. Pick it only when a contract or safety demands it and the budget covers roughly double the infrastructure.' },
      ],
    },
    {
      key: 'BUDGET', title: 'Error budget', label: 'What happens when the error budget is spent?',
      hint: 'The error budget is the downtime the target allows. Without a policy agreed in advance, a missed target changes nothing.',
      default: 'freeze',
      options: [
        { value: 'freeze', label: 'a release freeze', description: 'While the 30-day budget is spent, only reliability and security fixes are deployed. Pick it when the target is in a contract or the same outages keep coming back, and product owners have agreed to it in writing.' },
        { value: 'review', label: 'a review that sets priorities', description: 'A spent budget starts a blameless postmortem and puts its top action into the next iteration; releases go on. Pick it for a young product where shipping matters more than the last nine, or a team without the authority to freeze.' },
      ],
    },
    {
      key: 'DEPENDENCIES', title: 'Dependencies', label: 'How do the dependencies it calls fit the target?',
      hint: 'Availability multiplies along synchronous calls: two hard dependencies at 99.9 % leave at most 99.8 % for the caller.',
      default: 'stronger',
      options: [
        { value: 'stronger', label: 'hard dependencies above the target', description: 'Every service it must call to answer offers a committed availability higher than its own target, and the product of them still meets it. Pick it when the dependencies are managed services or platforms with published SLAs (databases, queues, identity providers).' },
        { value: 'degrade', label: 'degraded service without weak dependencies', description: 'Dependencies that cannot meet the target are made soft: without them it still serves what does not need them (cached prices, orders queued for later). Pick it when a partner system or an older internal service is weaker than the target.' },
      ],
    },
    {
      key: 'MAINTENANCE', title: 'Planned work', label: 'May planned work take it down?',
      hint: 'Releases, migrations and patching are the most common cause of downtime. Either they are designed to run online, or they get an announced window.',
      default: 'none',
      options: [
        { value: 'none', label: 'no planned downtime', description: 'Releases, schema changes and patching run while it serves; anything they break counts against the error budget. Pick it for 99.95 % and above, for users in every time zone, and whenever releases are frequent.' },
        { value: 'window', label: 'an announced maintenance window', description: 'Work that cannot run online gets a weekly window, announced in advance and left out of the measured availability. Pick it for users in one time zone with a quiet night, and only with a target of 99.9 % or less; not with 99.95 or 99.99.' },
      ],
    },
  ],
  details: [
    { key: 'WINDOW', label: 'When is the maintenance window? Only with an announced maintenance window', default: 'Sundays 02:00 to 04:00 UTC' },
  ],
  need: {
    label: 'Available as promised',
    text: 'People and other systems reach this element and depend on it answering. They need to know how much downtime to expect, and the team needs a number that decides when reliability work comes before features. The target has to be paid for with the redundancy it implies, hold up when a zone or a dependency fails, and survive the team\'s own releases and maintenance.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-target', label: 'Availability target met', ears_type: 'ubiquitous',
      action: 'answer at least {{TIER}} % of valid requests in every 30-day window without a server error, measured with the indicator decided in the Observability pack (good requests at the edge, or probes from outside), with requests refused for the caller\'s own fault (4xx) left out',
      rationale: 'A target measured as users see it, over a rolling window, is what the error budget and every other decision here rest on (Google SRE book, chapter 4).',
      scenario: { label: 'Target computed', given: '30 days of the indicator', when: 'the share of valid requests answered without a 5xx is computed', then: 'it is at least {{TIER}} %' },
    },
    {
      id: 'req-instance', label: 'Lost instance replaced', when: { TIER: ['99.0'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'its only instance, or the host under it, stops',
      action: 'start a replacement automatically and serve again within 15 minutes, without a person',
      rationale: 'At 99.0 % one zone is enough, but 7 h 12 min a month does not cover a restart that waits for someone to notice (AWS Well-Architected Reliability Pillar, REL 11: design to withstand component failures).',
      scenario: { label: 'Instance restarted', given: 'the element running on one instance', when: 'the instance is killed', then: 'a new one serves requests within 15 minutes and nobody was paged to start it' },
    },
    {
      id: 'req-zones', label: 'Survives a zone loss', when: ZONES, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'one availability zone becomes unreachable',
      action: 'keep answering from the remaining zones within 5 minutes, with at least two instances in two zones (three zones for 99.95 %) and enough capacity left to carry the peak',
      rationale: 'A zone loss is a routine event at cloud scale; 43 minutes a month (99.9 %) or 21 (99.95 %) is gone in one outage if serving depends on a single zone (AWS Well-Architected Reliability Pillar, REL 10: use fault isolation).',
      scenario: { label: 'Zone lost', given: 'the element serving peak traffic across its zones', when: 'every instance in one zone is stopped', then: 'within 5 minutes the error rate is back below 0.1 % without a person acting' },
    },
    {
      id: 'req-region', label: 'Survives a region loss', when: { TIER: ['99.99'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the region serving it fails or is cut off',
      action: 'serve every request from the other region within 60 seconds, by automated health-based routing with no person in the loop',
      rationale: 'At 99.99 % the month allows 4 min 19 s; one regional incident or a person deciding to fail over would use it all (Google SRE book, chapter 3).',
      scenario: { label: 'Region lost', given: 'the element serving from two regions', when: 'one region is cut off from the network', then: 'within 60 seconds every request is answered from the other region' },
    },
    {
      id: 'req-freeze', label: 'Spent budget freezes releases', when: { BUDGET: ['freeze'] }, ears_type: 'state-driven',
      precondition: 'the error budget of the last 30 days is spent',
      action: 'deploy only changes whose pull request is labelled as a reliability or security fix, until the measured availability is back at {{TIER}} % or above',
      rationale: 'An error budget policy agreed in advance turns a missed target into a decision nobody has to argue about (Google SRE workbook, Example Error Budget Policy).',
      scenario: { label: 'Release blocked', given: 'a 30-day availability below {{TIER}} %', when: 'a feature change is about to deploy to production, and then a reliability fix', then: 'the feature change is stopped by the pipeline and the fix deploys' },
    },
    {
      id: 'req-review', label: 'Spent budget reviewed', when: { BUDGET: ['review'] }, ears_type: 'event-driven',
      trigger: 'the error budget of the last 30 days is spent',
      action: 'open a postmortem ticket within 1 hour, hold a blameless postmortem within 5 working days and put its most important reliability action into the next iteration',
      rationale: 'Without a freeze, the review is what makes a missed target change priorities (Google SRE workbook, Example Error Budget Policy).',
      scenario: { label: 'Review held', given: 'a 30-day availability that falls below {{TIER}} %', when: '5 working days pass', then: 'a postmortem is written, its ticket closed, and its top action planned in the next iteration' },
    },
    {
      id: 'req-dependencies', label: 'Dependencies above target', when: { DEPENDENCIES: ['stronger'] }, ears_type: 'ubiquitous',
      action: 'call synchronously only services whose committed availability is above {{TIER}} %, and keep the product of its own infrastructure\'s availability and theirs at or above {{TIER}} %, from a list of hard dependencies kept in the repository',
      rationale: 'Availability multiplies along hard dependencies: an element cannot promise more than the services it waits for (Google SRE book, chapter 3; AWS Well-Architected Reliability Pillar, REL 1: manage service quotas and dependencies).',
      scenario: { label: 'Dependency budget checked', given: 'the list of services it calls synchronously, with their committed availability', when: 'the product of its own infrastructure\'s availability and theirs is computed', then: 'every one is above {{TIER}} % and the product is at least {{TIER}} %' },
    },
    {
      id: 'req-degrade', label: 'Degrades without dependencies', when: { DEPENDENCIES: ['degrade'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a dependency weaker than its own target does not answer within its timeout',
      action: 'go on serving every operation that does not need it, and answer those that do within 1 second with a degraded result (cached data, work queued for later) or a clear "try later" (503)',
      rationale: 'A soft dependency does not count against the target; turning hard dependencies soft is how an element beats the availability of what it calls (AWS Well-Architected Reliability Pillar, REL 5: design interactions to mitigate failures).',
      scenario: { label: 'Partner down', given: 'a dependency that stops answering', when: 'requests that need it and requests that do not arrive', then: 'the second are served as usual and the first get a degraded answer or a 503 within 1 second' },
    },
    {
      id: 'req-online', label: 'Planned work counts', when: { MAINTENANCE: ['none'] }, ears_type: 'event-driven',
      trigger: 'a release, a schema change or a patch rolls out',
      action: 'count every request it fails meanwhile against the error budget, excluding no time from the measured availability; keeping it answering throughout is required by the Deployment and rollback pack',
      rationale: 'Planned work is the most common cause of downtime; counting it is what makes designing it out worth the effort (Google SRE book, chapter 4).',
      scenario: { label: 'Release counted', given: 'a release that fails 100 requests while rolling out', when: 'the 30-day availability is computed', then: 'the 100 failures are in it' },
    },
    {
      id: 'req-window', label: 'Maintenance window kept', when: { MAINTENANCE: ['window'] }, ears_type: 'state-driven',
      precondition: 'planned work needs it stopped',
      action: 'stop only within the maintenance window ({{WINDOW}}) and only when the window was announced on the status page at least 7 days before, show a maintenance page meanwhile, and leave the window out of the measured availability',
      rationale: 'A window announced in advance is downtime users can plan around; one that is not is an outage (Google SRE book, chapter 4).',
      scenario: { label: 'Window announced', given: 'a migration that needs the element stopped', when: 'it is scheduled', then: 'it runs within {{WINDOW}}, the status page announced it 7 days before, users see a maintenance page while it runs, and the minutes are left out of the availability' },
    },
  ],
  adrs: [
    {
      id: 'adr-one-zone', label: 'One zone, restarted by the platform', when: { TIER: ['99.0'] },
      decision: 'The element targets {{TIER}} % per 30 days (7 h 12 min of downtime). It runs in one availability zone on a platform that restarts failed instances by itself: a Kubernetes Deployment with liveness probes, or a managed runtime (Azure App Service, Google Cloud Run, AWS App Runner). Its database is a managed single instance with automated backups. Dependencies: {{DEPENDENCIES}}. Planned work: {{MAINTENANCE}}. When the budget is spent: {{BUDGET}}. Choose the runtime by what the team already operates; a managed runtime unless the element needs Kubernetes features.',
      consequences: '• The cheapest setup: one copy of everything.\n• A zone outage takes the element down until the zone returns; that is accepted at 99.0 %.\n• An outage can wait as long as the month\'s budget allows; whether anyone is paged at night is decided in the Observability pack.\n• Moving to 99.9 % later means a second zone and a database that fails over, which this decision does not prepare.',
      alternatives: '1. Two zones from the start: buys 99.9 % but doubles the cost for users who do not need it.\n2. A single virtual machine restarted by hand: cheaper, but a restart waits for someone to notice.',
    },
    {
      id: 'adr-multi-zone', label: 'Redundant across zones', when: ZONES,
      decision: 'The element targets {{TIER}} % per 30 days. It runs at least two instances in two availability zones (for 99.95 %: three zones, with enough instances that two zones carry the peak), spread with Kubernetes topology spread constraints or zone-redundant platform settings, behind a load balancer that health-checks each instance. Its database fails over to a synchronous standby in another zone by itself: Amazon RDS Multi-AZ, Azure SQL zone-redundant, Cloud SQL high availability or a Patroni cluster. Dependencies: {{DEPENDENCIES}}. Planned work: {{MAINTENANCE}}. When the budget is spent: {{BUDGET}}. 43 minutes a month (21 for 99.95 %) do not wait for the morning; who is alerted, and when, is decided in the Observability pack.',
      consequences: '• A zone loss costs minutes of errors, not hours.\n• Roughly twice the compute of one zone (three zones for 99.95 %), and cross-zone traffic is billed.\n• Every instance must be stateless or share state through the database or a cache: sessions and uploads cannot live on one instance.\n• The database failover is a few dozen seconds of errors, which counts against the budget; it is tested, not assumed.',
      alternatives: '1. One zone and fast restarts: cheaper, but one zone outage uses the whole month\'s budget.\n2. Two regions active-active: survives a region, at roughly twice the cost and with the hard problem of data replicated across regions.',
    },
    {
      id: 'adr-multi-region', label: 'Active-active in two regions', when: { TIER: ['99.99'] },
      decision: 'The element targets {{TIER}} % per 30 days (4 min 19 s). It runs active-active in two regions, each in at least two zones and each able to carry the whole peak. A global load balancer routes by health and moves traffic without a person: Amazon Route 53 with health checks and Application Recovery Controller, Azure Front Door, or Google Cloud global load balancing. Data is replicated across regions by a store built for it: Amazon Aurora Global Database or DynamoDB global tables, Azure Cosmos DB, Google Cloud Spanner, or CockroachDB; choose by the consistency the data needs (strong across regions: Spanner or CockroachDB; per-region writes with replication lag: Aurora Global Database, DynamoDB global tables). Dependencies: {{DEPENDENCIES}}. Planned work: {{MAINTENANCE}}. When the budget is spent: {{BUDGET}}.',
      consequences: '• A region outage costs a minute, not the month.\n• Roughly double the infrastructure, plus cross-region data transfer.\n• Writes across regions are slower or eventually consistent; the data model has to be designed for it.\n• Failover is exercised regularly, or it will not work when needed.\n• Every hard dependency, the identity provider included, must also be multi-region.',
      alternatives: '1. Active-passive with a warm standby region: cheaper, but failover takes minutes and is rarely tested.\n2. Three zones in one region (99.95 %): far simpler, and enough unless a contract demands four nines.',
    },
    {
      id: 'adr-budget-freeze', label: 'Spent budget freezes releases', when: { BUDGET: ['freeze'] },
      decision: 'The error budget is the downtime {{TIER}} % allows in a rolling 30-day window. While it is spent, the deployment pipeline lets through only changes whose pull request is labelled reliability-fix or security-fix; feature work resumes when the measured availability is back at {{TIER}} % or above. The policy is signed by the product owner and the team lead, and an exception needs both. The budget is computed from the SLO\'s recording rules (Sloth or Pyrra on Prometheus, or the SLO feature of Datadog, Grafana Cloud or Google Cloud Monitoring), and the pipeline reads it before every production deploy.',
      consequences: '• Reliability work wins automatically when users are hurting, with no argument.\n• A bad month can stop feature releases for days; product owners plan for it.\n• The availability measurement must be trusted, since it now gates releases.\n• Fixes have to be labelled honestly; the label is reviewed in the pull request.',
      alternatives: '1. A review instead of a freeze: keeps shipping, but relies on the review changing priorities.\n2. No policy: the target is reported and nothing follows from it.',
    },
    {
      id: 'adr-budget-review', label: 'Spent budget triggers a review', when: { BUDGET: ['review'] },
      decision: 'The error budget is the downtime {{TIER}} % allows in a rolling 30-day window. When it is spent, an alert opens a ticket for a blameless postmortem, held within 5 working days; its most important action goes into the next iteration ahead of feature work. Releases are not stopped. The budget is computed from the SLO\'s recording rules (Sloth or Pyrra on Prometheus, or the SLO feature of Datadog, Grafana Cloud or Google Cloud Monitoring).',
      consequences: '• Feature releases keep going in a bad month.\n• The postmortem makes the causes visible and gives reliability work a place in the plan.\n• If the same causes keep spending the budget, this decision should be superseded by a freeze.',
      alternatives: '1. A release freeze: stronger, but needs product owners\' agreement and a trusted measurement.\n2. No policy: the target is reported and nothing follows from it.',
    },
    {
      id: 'adr-deps-stronger', label: 'Hard dependencies above the target', when: { DEPENDENCIES: ['stronger'] },
      decision: 'Every service the element must call to answer (its hard dependencies) has a committed availability above {{TIER}} %, and the product of the platform\'s commitment for our own instances and database and the dependencies\' commitments is at or above {{TIER}} %. The list of hard dependencies with their committed availability and its source (the SLA page) is kept in the repository and checked by a test; adding a synchronous call to a service not on the list, or a weaker one, fails the build. Managed services with a published SLA (the database, the queue, the identity provider) qualify; a partner system or an older internal service without a commitment does not, and must be made soft before it is called synchronously.',
      consequences: '• The target is arithmetic, not hope: the list says whether it can be met.\n• A weak dependency cannot be added quietly; making it soft is a design change with its own cost.\n• SLAs are commitments with credits, not guarantees; the measured availability of a dependency can still fall short, and the budget absorbs it.',
      alternatives: '1. Degraded service without weak dependencies: more design work, but the element beats what it calls.\n2. No rule: the target is promised and the dependencies decide whether it is met.',
    },
    {
      id: 'adr-deps-degrade', label: 'Degraded service without weak dependencies', when: { DEPENDENCIES: ['degrade'] },
      decision: 'Dependencies that cannot commit to more than {{TIER}} % are soft: the element times them out quickly (the timeouts and circuit breakers are decided in the Integration resilience pack), keeps serving every operation that does not need them, and answers the operations that do within 1 second with a degraded result (the last cached prices, an order queued for later confirmation) or a clear 503 with Retry-After. Which operations degrade and how is a product decision written next to each one. A drill in staging cuts each weak dependency off with Toxiproxy and checks both behaviours with a load test.',
      consequences: '• The element\'s availability no longer multiplies with the partner\'s.\n• Every degraded path is code and product work: what to show, what to queue, what to refuse.\n• A degraded answer is still an answer users see; the product must accept it.\n• Queued work needs a drain and a way to tell the user later.',
      alternatives: '1. Hard dependencies above the target only: simpler, but rules out partners without SLAs.\n2. Accepting the dependency\'s availability as our own: honest, and a lower target.',
    },
    {
      id: 'adr-no-downtime', label: 'No planned downtime', when: { MAINTENANCE: ['none'] },
      decision: 'Planned work takes the element down for nobody: releases roll out without dropping requests (as decided in the Deployment and rollback pack), schema changes ship as expand and contract, and patching is a rolling replacement of instances. Nothing is excluded from the measured availability: every request failed during planned work counts against the error budget, which is what keeps the work designed to run online.',
      consequences: '• Users in every time zone get the same promise at every hour.\n• Every change has to be designed to run beside the previous version; a change that cannot waits for a design, not a window.\n• A clumsy release spends budget like an outage, which is the point.',
      alternatives: '1. An announced maintenance window: one-step changes, at the price of downtime users have to plan around.\n2. Excluding releases from the measurement: the number improves, the users\' experience does not.',
    },
    {
      id: 'adr-window', label: 'An announced maintenance window', when: { MAINTENANCE: ['window'] },
      decision: 'Work that cannot run online stops the element only in the maintenance window, {{WINDOW}}, announced on the status page at least 7 days before as a scheduled maintenance; the maintenance job refuses to run without that announcement. While the element is stopped the edge serves a maintenance page (503 with Retry-After). The window\'s minutes are left out of the measured availability by a recording rule that marks them; work outside the window, or in an unannounced one, counts as an outage. Releases that can run online still do, as decided in the Deployment and rollback pack.',
      consequences: '• Large one-step changes stay possible without spending the budget.\n• Users in other time zones see a weekly outage; the window has to be short and rarely used.\n• The window must be announced and kept: an overrun is an outage from the first minute past it.\n• Excluding time from the measurement is a promise users may not share; the contract has to say so.',
      alternatives: '1. No planned downtime: every change designed to run online, at the cost of that design.\n2. Windows without exclusion from the measurement: honest numbers, and a target that has to leave room for them.',
    },
  ],
  fitness: [
    {
      id: 'ff-slo', label: 'Availability SLO measured', when: { MAINTENANCE: ['none'] }, category: 'operational', implements: [...TIER_ADRS, 'adr-no-downtime'],
      checks: ['req-target', 'req-online'],
      threshold: 'Availability at least {{TIER}} % over every rolling 30 days from the indicator, nothing excluded; a page alert at 14.4 times the allowed burn over 1 hour and a ticket at 6 times over 6 hours',
      description: 'An SLO spec generates the Prometheus recording rules for the availability over 30 days and the multiwindow burn-rate alerts; no minute is excluded, so planned work counts. The indicator is the one decided in the Observability pack: the request rates recorded at the edge (shown here), or the probe series as a raw indicator (the commented alternative). The error budget remaining is what the budget policy reads; where the alerts go is decided in the Observability pack.',
      tool: 'Sloth (Prometheus SLO generator); Pyrra takes the same objective',
      language: 'yaml',
      snippet: `# sloth generate -i availability.yaml -o availability.rules.yaml
version: "prometheus/v1"
service: "order-api"
labels:
  owner: "orders-team"
slos:
  - name: "availability"
    objective: {{TIER}}
    description: "Share of valid requests answered without a server error, over 30 days."
    sli:
      events:
        error_query: sum(rate(http_server_request_duration_seconds_count{job="order-api",http_response_status_code=~"5.."}[{{.window}}]))
        total_query: sum(rate(http_server_request_duration_seconds_count{job="order-api",http_response_status_code!~"4.."}[{{.window}}]))
      # with probes as the indicator (Observability pack, ff-probe) use instead:
      # raw:
      #   error_ratio_query: 1 - avg_over_time(order_api:probe_up:minute[{{.window}}])
    alerting:
      name: OrderApiAvailability
      page_alert:
        labels: { severity: page }
      ticket_alert:
        labels: { severity: ticket }`,
    },
    {
      id: 'ff-slo-window', label: 'Availability SLO measured outside the window', when: { MAINTENANCE: ['window'] }, category: 'operational', implements: [...TIER_ADRS, 'adr-window'],
      checks: ['req-target', 'req-window'],
      threshold: 'Availability at least {{TIER}} % over every rolling 30 days from the indicator, with only the minutes inside the maintenance window excluded; a page alert at 14.4 times the allowed burn over 1 hour and a ticket at 6 times over 6 hours',
      description: 'The same SLO spec as without a window, with the indicator queries dropped while a recording rule marks the maintenance window, so those minutes leave a gap that the 30-day average skips; any other minute counts. The window rule is the only place the window is encoded, next to the time it is announced for. Where the alerts go is decided in the Observability pack.',
      tool: 'Sloth (Prometheus SLO generator) with a Prometheus recording rule for the window',
      language: 'yaml',
      snippet: `# maintenance.rules.yaml: 1 inside the window ({{WINDOW}}); edit the day and hours to match it
groups:
  - name: maintenance-window
    rules:
      - record: maintenance_window
        expr: vector(1) and on() (day_of_week() == 0 and hour() >= 2 and hour() < 4)
---
# sloth generate -i availability.yaml -o availability.rules.yaml
version: "prometheus/v1"
service: "order-api"
slos:
  - name: "availability"
    objective: {{TIER}}
    description: "Share of valid requests answered without a server error, over 30 days, outside the maintenance window."
    sli:
      events:
        error_query: sum(rate(http_server_request_duration_seconds_count{job="order-api",http_response_status_code=~"5.."}[{{.window}}])) unless on() maintenance_window == 1
        total_query: sum(rate(http_server_request_duration_seconds_count{job="order-api",http_response_status_code!~"4.."}[{{.window}}])) unless on() maintenance_window == 1
      # with probes as the indicator (Observability pack, ff-probe) use instead:
      # raw:
      #   error_ratio_query: (1 - avg_over_time(order_api:probe_up:minute[{{.window}}])) unless on() maintenance_window == 1
    alerting:
      name: OrderApiAvailability
      page_alert:
        labels: { severity: page }
      ticket_alert:
        labels: { severity: ticket }`,
    },
    {
      id: 'ff-window-announced', label: 'Window announced, maintenance page served', when: { MAINTENANCE: ['window'] }, category: 'process', implements: ['adr-window'],
      checks: ['req-window'],
      threshold: 'The maintenance job runs only when a scheduled maintenance covering now was created on the status page at least 7 days before, and the public URL answers 503 with the maintenance page while the element is stopped',
      description: 'The job that stops the element for maintenance first asks the status page for scheduled maintenances and fails unless one covers the current time and was created at least 7 days earlier; after stopping the element it fetches the public URL and fails unless the maintenance page answers. Shown for Atlassian Statuspage; Instatus and others have the same two fields.',
      tool: 'GitHub Actions job with the Statuspage API (curl and jq)',
      language: 'yaml',
      snippet: `jobs:
  maintenance:
    runs-on: ubuntu-latest
    environment: production-maintenance
    steps:
      - name: Announced at least 7 days ago?
        env:
          STATUSPAGE_KEY: \${{ secrets.STATUSPAGE_KEY }}
          PAGE_ID: \${{ vars.STATUSPAGE_PAGE_ID }}
        run: |
          curl -sf -H "Authorization: OAuth $STATUSPAGE_KEY" "https://api.statuspage.io/v1/pages/$PAGE_ID/incidents/scheduled" \\
            | jq -e 'now as $now | [.[] | select((.scheduled_for | fromdateiso8601) <= $now and (.scheduled_until | fromdateiso8601) >= $now
                                    and (.created_at | fromdateiso8601) <= (.scheduled_for | fromdateiso8601) - 7 * 86400)] | length > 0' \\
            || { echo "::error::no scheduled maintenance covering now was announced 7 days ago"; exit 1; }
      - name: Stop the element and check the maintenance page
        run: |
          kubectl -n shop scale deployment/order-api --replicas=0
          code=$(curl -s -o body.html -w '%{http_code}' https://shop.example.com/)
          test "$code" = 503 && grep -qi maintenance body.html || { echo "::error::no maintenance page (HTTP $code)"; exit 1; }
      # ... the offline work (Deployment and rollback pack, ff-migration-rehearsal), then scale back up`,
    },
    {
      id: 'ff-instance-loss', label: 'Killed instance comes back', when: { TIER: ['99.0'] }, category: 'operational', implements: ['adr-one-zone'],
      checks: ['req-instance'],
      threshold: 'After its instance is killed the element answers the probe again within 15 minutes; a probe that fails for 15 minutes after the drill fires an alert',
      description: 'A scheduled chaos experiment kills the element\'s pod in working hours; the Observability pack\'s probe records whether it answers again, and an alerting rule fires when the probe has failed for 15 minutes. This snippet is Kubernetes-bound; on a managed runtime the same drill restarts the instance with the platform\'s CLI (az webapp restart, or scaling the service to zero and back) on the same schedule, and the same alert rule applies.',
      tool: 'Chaos Mesh (PodChaos) with a Prometheus alerting rule over the Blackbox exporter',
      language: 'yaml',
      snippet: `apiVersion: chaos-mesh.org/v1alpha1
kind: Schedule
metadata: { name: order-api-instance-loss, namespace: shop }
spec:
  schedule: "0 10 * * 2"          # Tuesdays 10:00, in working hours
  type: PodChaos
  historyLimit: 5
  concurrencyPolicy: Forbid
  podChaos:
    action: pod-kill
    mode: all
    selector:
      namespaces: [shop]
      labelSelectors: { app: order-api }
---
groups:
  - name: instance-loss-drill
    rules:
      - alert: OrderApiNotBackAfterInstanceLoss
        expr: probe_success{job=~"blackbox-order-api-.*"} == 0
        for: 15m
        labels: { severity: ticket }
        annotations:
          summary: "Order API has not answered its probe for 15 minutes (instance not replaced by the platform)"`,
    },
    {
      id: 'ff-zone-loss', label: 'Zone loss tolerated', when: ZONES, category: 'operational', implements: ['adr-multi-zone'],
      checks: ['req-zones'],
      threshold: 'With every instance in one zone killed at production-like load, the failure rate from 5 minutes after the kill to the end of the run is below 0.1 %',
      description: 'A chaos experiment kills every pod of the element on the nodes of one zone at the start of a load test at the expected peak; the load test tags requests by phase and fails when the failure rate after the first 5 minutes is 0.1 % or more. Run it every month and after every change to the deployment, and once a quarter fail over the database as well. Chaos Mesh is Kubernetes-bound; on a managed platform, stop the zone\'s instances with the cloud CLI at the same moment.',
      tool: 'Grafana k6 with Chaos Mesh (PodChaos by node zone)',
      language: 'js',
      snippet: `// zone-loss.js   (the job starts it and, at the same moment, applies the PodChaos below)
// apiVersion: chaos-mesh.org/v1alpha1, kind: PodChaos, action: pod-kill, mode: all,
// selector: { namespaces: [shop], labelSelectors: { app: order-api }, nodeSelectors: { topology.kubernetes.io/zone: eu-west-1a } }
import http from 'k6/http'
import exec from 'k6/execution'

export const options = {
  scenarios: {
    peak: { executor: 'constant-arrival-rate', rate: Number(__ENV.RATE), timeUnit: '1s', duration: '20m', preAllocatedVUs: 500, maxVUs: 5000 },
  },
  thresholds: {
    'http_req_failed{phase:after}': ['rate<0.001'],   // from 5 minutes after the kill to the end of the run
  },
}

export default function () {
  const phase = exec.instance.currentTestRunDuration > 5 * 60 * 1000 ? 'after' : 'during'
  http.get(\`\${__ENV.BASE_URL}/orders?page=1\`, { tags: { phase } })
}`,
    },
    {
      id: 'ff-region-failover', label: 'Region failover drilled', when: { TIER: ['99.99'] }, category: 'operational', implements: ['adr-multi-region'],
      checks: ['req-region'],
      threshold: 'With one region cut off, every request is answered from the other region within 60 seconds; 0 % errors after that',
      description: 'A quarterly game day cuts the application subnets of one region off the network while a k6 probe calls the global endpoint every second from outside; the probe fails if any request fails more than 60 seconds after the cut. The stop condition ends the experiment when the global error alarm fires. The experiment shown is AWS-bound (Fault Injection Service); on Azure, Chaos Studio\'s network disconnect fault on the region\'s virtual network does the same, and on Google Cloud a firewall rule that drops the region\'s ingress, applied by the game-day script.',
      tool: 'AWS Fault Injection Service (network disruption), with a k6 probe on the global endpoint',
      language: 'json',
      snippet: `{
  "description": "Cut region A's application subnets off; traffic must move to region B within 60 s",
  "targets": {
    "appSubnets": {
      "resourceType": "aws:ec2:subnet",
      "resourceTags": { "tier": "app", "service": "order-api" },
      "selectionMode": "ALL"
    }
  },
  "actions": {
    "isolateRegion": {
      "actionId": "aws:network:disrupt-connectivity",
      "parameters": { "duration": "PT15M", "scope": "all" },
      "targets": { "Subnets": "appSubnets" }
    }
  },
  "stopConditions": [
    { "source": "aws:cloudwatch:alarm", "value": "arn:aws:cloudwatch:us-east-1:123456789012:alarm:global-error-rate" }
  ],
  "roleArn": "arn:aws:iam::123456789012:role/fis-experiments"
}`,
    },
    {
      id: 'ff-budget-gate', label: 'Spent budget blocks deploys', when: { BUDGET: ['freeze'] }, category: 'process', implements: ['adr-budget-freeze'],
      checks: ['req-freeze'],
      threshold: 'A production deploy of a commit whose pull request carries neither the reliability-fix nor the security-fix label is refused whenever the 30-day error budget remaining is 0 or below',
      description: 'A pipeline step before every production deploy looks up the pull request of the commit being deployed (so it works on push and manual deploys, not only pull_request runs), lets labelled fixes through, and otherwise reads the error budget remaining from Prometheus (the Sloth recording rule) and fails when it is spent.',
      tool: 'GitHub Actions step with the GitHub CLI and the Prometheus HTTP API',
      language: 'yaml',
      snippet: `- name: Error budget gate
  env:
    GH_TOKEN: \${{ github.token }}
  run: |
    labels=$(gh api "repos/\${{ github.repository }}/commits/$GITHUB_SHA/pulls" --jq '[.[].labels[].name] | join(",")')
    case ",$labels," in
      *,reliability-fix,*|*,security-fix,*) echo "Labelled fix: not gated by the error budget"; exit 0;;
    esac
    remaining=$(curl -sf "$PROMETHEUS_URL/api/v1/query" \\
      --data-urlencode 'query=slo:period_error_budget_remaining:ratio{sloth_service="order-api",sloth_slo="availability"}' \\
      | jq -r '.data.result[0].value[1]')
    echo "Error budget remaining: $remaining"
    if awk "BEGIN { exit !($remaining <= 0) }"; then
      echo "::error::Error budget spent: only reliability or security fixes deploy (ADR Spent budget freezes releases)"
      exit 1
    fi`,
    },
    {
      id: 'ff-budget-review', label: 'Spent budget opens a review', when: { BUDGET: ['review'] }, category: 'process', implements: ['adr-budget-review'],
      checks: ['req-review'],
      threshold: 'An alert fires within 15 minutes of the error budget reaching 0 and routes to the ticket system; 0 postmortem tickets open longer than 7 calendar days (5 working days)',
      description: 'An alerting rule fires when the error budget remaining reaches 0 and Alertmanager routes it to the ticket system (GitHub Issues through a webhook bridge, or Jira), which opens an issue labelled postmortem; a weekly job fails when such an issue has been open longer than 7 days, so the postmortem was not held in time.',
      tool: 'Prometheus alerting rule routed by Alertmanager; GitHub CLI in a scheduled job',
      language: 'yaml',
      snippet: `groups:
  - name: error-budget
    rules:
      - alert: OrderApiErrorBudgetSpent
        expr: slo:period_error_budget_remaining:ratio{sloth_service="order-api",sloth_slo="availability"} <= 0
        for: 15m
        labels:
          severity: ticket
          action: postmortem
        annotations:
          summary: "Order API spent its 30-day error budget ({{TIER}} %)"
          description: "Hold a blameless postmortem within 5 working days (ADR Spent budget triggers a review)."
---
# weekly job: every postmortem ticket closed within 5 working days
- env:
    GH_TOKEN: \${{ github.token }}
  run: |
    since=$(date -u -d '-7 days' +%FT%TZ)
    old=$(gh issue list --label postmortem --state open --json number,createdAt --jq "[.[] | select(.createdAt < \\"$since\\")] | length")
    test "$old" -eq 0 || { echo "::error::$old postmortem tickets open longer than 5 working days"; exit 1; }`,
    },
    {
      id: 'ff-dependency-budget', label: 'Dependency availability adds up', when: { DEPENDENCIES: ['stronger'] }, category: 'structural', implements: ['adr-deps-stronger'],
      checks: ['req-dependencies'],
      threshold: 'Every hard dependency in the list has a committed availability above {{TIER}} %, and the product of our own infrastructure\'s commitment and theirs is at least {{TIER}} %',
      description: 'A test reads the list of hard dependencies kept in the repository, with each one\'s committed availability and the SLA it comes from, and fails when any is at or below the target or when the product, with the platform\'s commitment for our own instances and database, falls below it. Adding a synchronous call means adding a line, which the reviewer sees.',
      tool: 'Vitest over reliability/dependencies.yaml',
      language: 'ts',
      snippet: `import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

// reliability/dependencies.yaml:
// own_infrastructure: 99.95          # the platform's commitment for our instances and database (e.g. EKS + RDS Multi-AZ SLAs)
// hard:                              # services the element waits for to answer
//   - { name: Orders database (RDS Multi-AZ), availability: 99.95, source: "https://aws.amazon.com/rds/sla/" }
//   - { name: Identity provider (Entra ID), availability: 99.99, source: "Microsoft Entra SLA" }
type Dependency = { name: string; availability: number; source: string }
const TARGET = {{TIER}}
const deps = parse(readFileSync('reliability/dependencies.yaml', 'utf8')) as { own_infrastructure: number; hard: Dependency[] }

it('every hard dependency commits to more than the target', () => {
  expect(deps.hard.filter((d) => d.availability <= TARGET).map((d) => d.name)).toEqual([])
})

it('the product of our infrastructure and the hard dependencies meets the target', () => {
  const product = deps.hard.reduce((p, d) => p * (d.availability / 100), deps.own_infrastructure / 100) * 100
  expect(product).toBeGreaterThanOrEqual(TARGET)
})`,
    },
    {
      id: 'ff-degrade', label: 'Serves without the weak dependency', when: { DEPENDENCIES: ['degrade'] }, category: 'operational', implements: ['adr-deps-degrade'],
      checks: ['req-degrade'],
      threshold: 'With the weak dependency cut off: operations that do not need it fail below 0.1 %, and operations that need it answer 200 or 503 within 1 second at the 95th percentile',
      description: 'A k6 run in staging cuts the weak dependency off through Toxiproxy (a timeout toxic that drops every byte), keeps sending a mix of operations that need it and operations that do not, and checks the two behaviours separately; it removes the toxic afterwards. Staging reaches the dependency through the Toxiproxy proxy named partner.',
      tool: 'Grafana k6 with Toxiproxy',
      language: 'js',
      snippet: `// k6 run --env BASE_URL=https://staging.shop.example --env TOXIPROXY=http://toxiproxy:8474 degrade.js
import http from 'k6/http'
import { check } from 'k6'

export const options = {
  scenarios: {
    mixed: { executor: 'constant-arrival-rate', rate: 20, timeUnit: '1s', duration: '5m', preAllocatedVUs: 50, maxVUs: 500 },
  },
  thresholds: {
    'http_req_failed{op:independent}': ['rate<0.001'],   // operations that do not need the partner keep serving
    'http_req_duration{op:dependent}': ['p(95)<1000'],   // operations that need it answer within 1 s ...
    'checks{op:dependent}': ['rate==1'],                 // ... with a degraded result (200) or a clear "try later" (503)
  },
}

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } }

export function setup() {
  http.post(\`\${__ENV.TOXIPROXY}/proxies/partner/toxics\`,
    JSON.stringify({ name: 'partner_down', type: 'timeout', stream: 'downstream', toxicity: 1.0, attributes: { timeout: 0 } }), JSON_HEADERS)
}

export function teardown() {
  http.del(\`\${__ENV.TOXIPROXY}/proxies/partner/toxics/partner_down\`)
}

export default function () {
  http.get(\`\${__ENV.BASE_URL}/orders?page=1\`, { tags: { op: 'independent' } })
  const res = http.get(\`\${__ENV.BASE_URL}/prices/42\`, { tags: { op: 'dependent' } })
  check(res, { 'degraded or try later': (r) => r.status === 200 || r.status === 503 }, { op: 'dependent' })
}`,
    },
  ],
}

export default pack
