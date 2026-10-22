import type { PackSpec, When } from '../../src/packSpec'

const ZONES: When = { TIER: ['99.9', '99.95'] }
const FORCES = 'People or other systems reach this element, so when it is down somebody notices: a customer who cannot buy, a partner whose calls fail. The forces: every extra nine costs more (more zones, more replicas, automation instead of people) while users cannot tell 99.99 % from 100 % behind their own network; the allowed downtime per 30 days shrinks from hours (99.0 %) to minutes (99.99 %), and a person paged at night needs 15 to 30 minutes just to start; an element is never more available than the product of the hard dependencies it calls; planned work (releases, migrations, patching) is downtime too unless it is designed out; and without an agreed number and a policy for when it is missed, reliability work loses every argument against features.'

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
  ],
  questions: [
    {
      key: 'TIER', title: 'Target', label: 'What availability does it promise, per 30 days (%)?',
      hint: 'Each nine cuts the allowed downtime tenfold and decides the redundancy: one zone, several zones, or several regions. Pick the lowest target the users and contracts accept, not the highest you can imagine.',
      default: '99.9',
      options: [
        { value: '99.0', label: '99.0', description: 'Down at most 7 h 12 min per 30 days. One zone, instances restarted by the platform, a managed database with backups. Pick it for internal tools and back-office work that can wait an hour, with nobody paged at night.' },
        { value: '99.9', label: '99.9', description: 'Down at most 43 min per 30 days. At least two instances in two availability zones and a database that fails over by itself; someone on call. Pick it for most customer-facing services and partner APIs.' },
        { value: '99.95', label: '99.95', description: 'Down at most 21 min per 30 days. Three zones with capacity to lose one at peak, releases and schema changes without downtime. Pick it for revenue paths (checkout, payments) where an hour down is a visible loss.' },
        { value: '99.99', label: '99.99', description: 'Down at most 4 min 19 s per 30 days: no time for a person to react. Active-active in two regions with automatic failover. Pick it only when a contract or safety demands it and the budget covers roughly double the infrastructure.' },
      ],
    },
    {
      key: 'BUDGET', title: 'Error budget', label: 'What happens when the error budget is spent?',
      hint: 'The error budget is the downtime the target allows. Without a policy agreed in advance, a missed target changes nothing.',
      default: 'freeze',
      options: [
        { value: 'freeze', label: 'releases freeze', description: 'While the 30-day budget is spent, only reliability and security fixes are deployed. Pick it when the target is in a contract or the same outages keep coming back, and product owners have agreed to it in writing.' },
        { value: 'review', label: 'a review sets priorities', description: 'A spent budget starts a blameless postmortem and puts its top action into the next iteration; releases go on. Pick it for a young product where shipping matters more than the last nine, or a team without the authority to freeze.' },
      ],
    },
    {
      key: 'DEPENDENCIES', title: 'Dependencies', label: 'How do the dependencies it calls fit the target?',
      hint: 'Availability multiplies along synchronous calls: two hard dependencies at 99.9 % leave at most 99.8 % for the caller.',
      default: 'stronger',
      options: [
        { value: 'stronger', label: 'hard dependencies above our target', description: 'Every service it must call to answer offers a committed availability higher than its own target, and the product of them still meets it. Pick it when the dependencies are managed services or platforms with published SLAs (databases, queues, identity providers).' },
        { value: 'degrade', label: 'degraded service without them', description: 'Dependencies that cannot meet the target are made soft: without them it still serves what does not need them (cached prices, orders queued for later). Pick it when a partner system or an older internal service is weaker than the target.' },
      ],
    },
    {
      key: 'MAINTENANCE', title: 'Planned work', label: 'May planned work take it down?',
      hint: 'Releases, migrations and patching are the most common cause of downtime. Either they are designed to run online, or they get an announced window.',
      default: 'none',
      options: [
        { value: 'none', label: 'no planned downtime', description: 'Releases, schema changes and patching run while it serves; anything they break counts against the error budget. Pick it for 99.95 % and above, for users in every time zone, and whenever releases are frequent.' },
        { value: 'window', label: 'an announced maintenance window', description: 'Work that cannot run online gets a weekly window, announced in advance and left out of the measured availability. Pick it for users in one time zone with a quiet night, and only with a target of 99.9 % or less.' },
      ],
    },
  ],
  details: [
    { key: 'WINDOW', label: 'When is the maintenance window?', default: 'Sundays 02:00 to 04:00 UTC' },
  ],
  need: {
    label: 'Available as promised',
    text: 'People and other systems reach this element and depend on it answering. They need to know how much downtime to expect, and the team needs a number that decides when reliability work comes before features. The target has to be paid for with the redundancy it implies, hold up when a zone or a dependency fails, and survive the team\'s own releases and maintenance.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-target', label: 'Availability target met', ears_type: 'ubiquitous',
      action: 'answer at least {{TIER}} % of valid requests in every 30-day window without a server error, measured where callers reach it (load balancer or API gateway), with requests refused for the caller\'s own fault (4xx) left out',
      rationale: 'A target measured as users see it, over a rolling window, is what the error budget and every other decision here rest on (Google SRE book, chapter 4).',
      scenario: { label: 'Target computed', given: '30 days of production traffic at the load balancer', when: 'the share of valid requests answered without a 5xx is computed', then: 'it is at least {{TIER}} %' },
    },
    {
      id: 'req-instance', label: 'Lost instance replaced', when: { TIER: ['99.0'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'its only instance, or the host under it, stops',
      action: 'start a replacement automatically and serve again within 15 minutes, without a person',
      rationale: 'At 99.0 % one zone is enough, but 7 h 12 min a month does not cover a restart that waits for someone to notice (AWS Well-Architected REL 11).',
      scenario: { label: 'Instance restarted', given: 'the element running on one instance', when: 'the instance is killed', then: 'a new one serves requests within 15 minutes and nobody was paged to start it' },
    },
    {
      id: 'req-zones', label: 'Survives a zone loss', when: ZONES, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'one availability zone becomes unreachable',
      action: 'keep answering from the remaining zones within 5 minutes, with at least two instances in two zones (three zones for 99.95 %) and enough capacity left to carry the peak',
      rationale: 'A zone loss is a routine event at cloud scale; 43 minutes a month (99.9 %) or 21 (99.95 %) is gone in one outage if serving depends on a single zone (AWS Well-Architected REL 10).',
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
      action: 'deploy only changes that fix reliability or security, until the measured availability is back at {{TIER}} % or above',
      rationale: 'An error budget policy agreed in advance turns a missed target into a decision nobody has to argue about (Google SRE workbook, Example Error Budget Policy).',
      scenario: { label: 'Release blocked', given: 'a 30-day availability below {{TIER}} %', when: 'a feature change is about to deploy to production, and then a reliability fix', then: 'the feature change is stopped by the pipeline and the fix deploys' },
    },
    {
      id: 'req-review', label: 'Spent budget reviewed', when: { BUDGET: ['review'] }, ears_type: 'event-driven',
      trigger: 'the error budget of the last 30 days is spent',
      action: 'hold a blameless postmortem within 5 working days and put its most important reliability action into the next iteration',
      rationale: 'Without a freeze, the review is what makes a missed target change priorities (Google SRE workbook, Example Error Budget Policy).',
      scenario: { label: 'Review held', given: 'a 30-day availability that falls below {{TIER}} %', when: '5 working days pass', then: 'a postmortem is written and its top action is planned in the next iteration' },
    },
    {
      id: 'req-dependencies', label: 'Dependencies above target', when: { DEPENDENCIES: ['stronger'] }, ears_type: 'ubiquitous',
      action: 'call synchronously only services whose committed availability is above {{TIER}} %, and keep the product of those availabilities, its own included, at or above {{TIER}} %',
      rationale: 'Availability multiplies along hard dependencies: an element cannot promise more than the services it waits for (Google SRE book, chapter 3; AWS Well-Architected REL 1).',
      scenario: { label: 'Dependency budget checked', given: 'the list of services it calls synchronously, with their committed availability', when: 'the product of their availabilities is computed', then: 'every one is above {{TIER}} % and the product is at least {{TIER}} %' },
    },
    {
      id: 'req-degrade', label: 'Degrades without dependencies', when: { DEPENDENCIES: ['degrade'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a dependency weaker than its own target does not answer within its timeout',
      action: 'go on serving every operation that does not need it, and answer those that do within 1 second with a degraded result (cached data, work queued for later) or a clear "try later"',
      rationale: 'A soft dependency does not count against the target; turning hard dependencies soft is how an element beats the availability of what it calls (AWS Well-Architected REL 5).',
      scenario: { label: 'Partner down', given: 'a dependency that stops answering', when: 'requests that need it and requests that do not arrive', then: 'the second are served as usual and the first get a degraded answer within 1 second' },
    },
    {
      id: 'req-online', label: 'Planned work runs online', when: { MAINTENANCE: ['none'] }, ears_type: 'event-driven',
      trigger: 'a release, a schema change or a patch is rolled out',
      action: 'go on answering throughout, and count every request it fails meanwhile against the error budget',
      rationale: 'Planned work is the most common cause of downtime; designing it out is what high targets need (Google SRE book, chapter 4).',
      scenario: { label: 'Release under load', given: 'steady production-like traffic', when: 'a release with a schema change rolls out', then: 'the error rate stays below 0.1 % throughout' },
    },
    {
      id: 'req-window', label: 'Maintenance window kept', when: { MAINTENANCE: ['window'] }, ears_type: 'state-driven',
      precondition: 'planned work needs it stopped',
      action: 'stop only within the maintenance window ({{WINDOW}}), announce it to users at least 7 days before, show a maintenance page meanwhile, and leave the window out of the measured availability only when it was announced in time',
      rationale: 'A window announced in advance is downtime users can plan around; one that is not is an outage (Google SRE book, chapter 4).',
      scenario: { label: 'Window announced', given: 'a migration that needs the element stopped', when: 'it is scheduled', then: 'it runs within {{WINDOW}}, users were told 7 days before, and they see a maintenance page while it runs' },
    },
  ],
  adrs: [
    {
      id: 'adr-one-zone', label: 'One zone, restarted by the platform', when: { TIER: ['99.0'] },
      decision: 'The element targets {{TIER}} % per 30 days (7 h 12 min of downtime). It runs in one availability zone on a platform that restarts failed instances by itself: a Kubernetes Deployment with liveness probes, or a managed runtime (Azure App Service, Google Cloud Run, AWS App Runner). Its database is a managed single instance with automated backups. Dependencies: {{DEPENDENCIES}}. Planned work: {{MAINTENANCE}}. When the budget is spent: {{BUDGET}}. Choose the runtime by what the team already operates; a managed runtime unless the element needs Kubernetes features.',
      consequences: '• The cheapest setup: one copy of everything.\n• A zone outage takes the element down until the zone returns; that is accepted at 99.0 %.\n• Nobody is paged at night; outages wait for working hours as long as the month\'s budget lasts.\n• Moving to 99.9 % later means a second zone and a database that fails over, which this decision does not prepare.',
      alternatives: '1. Two zones from the start: buys 99.9 % but doubles the cost for users who do not need it.\n2. A single virtual machine restarted by hand: cheaper, but a restart waits for someone to notice.',
    },
    {
      id: 'adr-multi-zone', label: 'Redundant across zones', when: ZONES,
      decision: 'The element targets {{TIER}} % per 30 days. It runs at least two instances in two availability zones (for 99.95 %: three zones, with enough instances that two zones carry the peak), spread with Kubernetes topology spread constraints or zone-redundant platform settings, behind a load balancer that health-checks each instance. Its database fails over to a synchronous standby in another zone by itself: Amazon RDS Multi-AZ, Azure SQL zone-redundant, Cloud SQL high availability or a Patroni cluster. Dependencies: {{DEPENDENCIES}}. Planned work: {{MAINTENANCE}}. When the budget is spent: {{BUDGET}}. Someone is on call, since 43 minutes (21 for 99.95 %) do not wait for the morning.',
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
      decision: 'The error budget is the downtime {{TIER}} % allows in a rolling 30-day window. While it is spent, the deployment pipeline lets through only changes labelled as reliability or security fixes; feature work resumes when the measured availability is back at {{TIER}} % or above. The policy is signed by the product owner and the team lead, and an exception needs both. The budget is computed from the SLO\'s recording rules (Sloth or Pyrra on Prometheus, or the SLO feature of Datadog, Grafana Cloud or Google Cloud Monitoring), and the pipeline reads it before every production deploy.',
      consequences: '• Reliability work wins automatically when users are hurting, with no argument.\n• A bad month can stop feature releases for days; product owners plan for it.\n• The availability measurement must be trusted, since it now gates releases.\n• Fixes have to be labelled honestly; the label is reviewed in the pull request.',
      alternatives: '1. A review instead of a freeze: keeps shipping, but relies on the review changing priorities.\n2. No policy: the target is reported and nothing follows from it.',
    },
    {
      id: 'adr-budget-review', label: 'Spent budget triggers a review', when: { BUDGET: ['review'] },
      decision: 'The error budget is the downtime {{TIER}} % allows in a rolling 30-day window. When it is spent, an alert opens a ticket for a blameless postmortem, held within 5 working days; its most important action goes into the next iteration ahead of feature work. Releases are not stopped. The budget is computed from the SLO\'s recording rules (Sloth or Pyrra on Prometheus, or the SLO feature of Datadog, Grafana Cloud or Google Cloud Monitoring).',
      consequences: '• Feature releases keep going in a bad month.\n• The postmortem makes the causes visible and gives reliability work a place in the plan.\n• If the same causes keep spending the budget, this decision should be superseded by a freeze.',
      alternatives: '1. A release freeze: stronger, but needs product owners\' agreement and a trusted measurement.\n2. No policy: the target is reported and nothing follows from it.',
    },
  ],
  fitness: [
    {
      id: 'ff-slo', label: 'Availability SLO measured', category: 'operational', implements: ['adr-one-zone', 'adr-multi-zone', 'adr-multi-region'],
      threshold: 'Availability at least {{TIER}} % over every rolling 30 days; a page when the budget burns 14.4 times faster than allowed over 1 hour',
      description: 'An SLO spec generates the Prometheus recording rules for the availability over 30 days and the multiwindow burn-rate alerts. The SLI is the share of requests answered without a 5xx at the edge. The error budget remaining is what the budget policy reads.',
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
        total_query: sum(rate(http_server_request_duration_seconds_count{job="order-api"}[{{.window}}]))
    alerting:
      name: OrderApiAvailability
      page_alert:
        labels: { severity: page }
      ticket_alert:
        labels: { severity: ticket }`,
    },
    {
      id: 'ff-instance-loss', label: 'Killed instance comes back', when: { TIER: ['99.0'] }, category: 'operational', implements: ['adr-one-zone'],
      threshold: 'After its instance is killed the element serves again within 15 minutes, with no person acting',
      description: 'A scheduled chaos experiment kills the element\'s pod; a probe (the Blackbox exporter or a k6 check) records how long until it answers again, and the experiment fails past 15 minutes.',
      tool: 'Chaos Mesh (PodChaos), with the Prometheus Blackbox exporter as probe',
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
# Alert if not back: probe_success{job="blackbox",instance="https://shop.example.com/healthz"} == 0 for 15m`,
    },
    {
      id: 'ff-zone-loss', label: 'Zone loss tolerated', when: ZONES, category: 'operational', implements: ['adr-multi-zone'],
      threshold: 'With every instance in one zone killed at production-like load, errors above 0.1 % last no longer than 5 minutes',
      description: 'A chaos experiment kills every pod on the nodes of one zone while a load test runs at the expected peak; the load test fails when errors stay above 0.1 % for more than 5 minutes. Run it every month and after every change to the deployment, and once a quarter fail over the database as well.',
      tool: 'Chaos Mesh (PodChaos by node zone) with k6 as load',
      language: 'yaml',
      snippet: `apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata: { name: order-api-zone-a-down, namespace: shop }
spec:
  action: pod-kill
  mode: all
  selector:
    namespaces: [shop]
    labelSelectors: { app: order-api }
    nodeSelectors:
      topology.kubernetes.io/zone: eu-west-1a
# Meanwhile: k6 run --env RATE=<peak rps> zone-loss.js
# with thresholds: { http_req_failed: [{ threshold: 'rate<0.001', abortOnFail: false }] }
# evaluated over the window from 5 minutes after the kill to its end.`,
    },
    {
      id: 'ff-region-failover', label: 'Region failover drilled', when: { TIER: ['99.99'] }, category: 'operational', implements: ['adr-multi-region'],
      threshold: 'With one region cut off, every request is answered from the other region within 60 seconds; 0 % errors after that',
      description: 'A quarterly game day cuts the application subnets of one region off the network while a k6 probe calls the global endpoint every second from outside; the probe fails if any request fails more than 60 seconds after the cut. The stop condition ends the experiment when the global error alarm fires.',
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
      threshold: 'A production deploy without the reliability-fix label is refused whenever the 30-day error budget remaining is 0 or below',
      description: 'A pipeline step before every production deploy reads the error budget remaining from Prometheus (the Sloth recording rule) and fails when it is spent, unless the change carries the label for reliability or security fixes.',
      tool: 'GitHub Actions step querying the Prometheus HTTP API',
      language: 'yaml',
      snippet: `- name: Error budget gate
  if: \${{ !contains(github.event.pull_request.labels.*.name, 'reliability-fix') }}
  run: |
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
      threshold: 'Every spent 30-day budget opens a postmortem ticket within 1 hour; 100 % of them closed within 5 working days',
      description: 'An alerting rule fires when the error budget remaining reaches 0 and Alertmanager routes it to the ticket system (Jira or GitHub Issues through a webhook receiver); the team\'s monthly review counts tickets closed in time.',
      tool: 'Prometheus alerting rule routed by Alertmanager',
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
          description: "Hold a blameless postmortem within 5 working days (ADR Spent budget triggers a review)."`,
    },
  ],
}

export default pack
