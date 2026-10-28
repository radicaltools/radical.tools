import type { PackSpec, When } from '../../src/packSpec'

const OTEL: When = { SIGNALS: ['otel'] }
const SIGNAL_ADRS = ['adr-otel', 'adr-logs']
const FORCES = 'This element runs in production. The forces: users notice an outage before a team without signals does; healthy needs a number agreed in advance, measured as users see it; alerts on every cause wake people for nothing until they are ignored, while alerts on symptoms that burn the error budget are worth acting on; a request crosses several elements, and its trail is lost without a shared id; and keeping every log line and every trace forever costs more than the failures they explain. The availability objective itself, and the burn-rate alerts generated for it, are decided in the Availability pack; what a log line holds and never holds in the Error handling and logging conventions pack. The snippets of this pack assume the element is order-api, scraped by Prometheus as job order-api and deployed to the shop namespace; rename them for yours.'

const pack: PackSpec = {
  id: 'concern-observability',
  name: 'Observability',
  group: 'operations',
  description: 'Running in production: which signals are collected, how the service level indicator is measured, who is alerted and when, how long logs are kept, and how a failure is traced to its cause.',
  tags: ['operations', 'observability', 'sli', 'logging', 'tracing', 'alerting', 'opentelemetry'],
  concern: {
    id: 'observability',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'these elements run in production, so how you will know they are healthy, and find out why when they are not, has to be decided.',
  },
  sources: [
    { title: 'Google SRE book, chapter 6: Monitoring Distributed Systems', url: 'https://sre.google/sre-book/monitoring-distributed-systems/' },
    { title: 'Google SRE workbook: Implementing SLOs', url: 'https://sre.google/workbook/implementing-slos/' },
    { title: 'Google SRE workbook: Alerting on SLOs', url: 'https://sre.google/workbook/alerting-on-slos/' },
    { title: 'Google SRE book, chapter 11: Being On-Call', url: 'https://sre.google/sre-book/being-on-call/' },
    { title: 'OpenTelemetry documentation', url: 'https://opentelemetry.io/docs/' },
    { title: 'W3C Trace Context', url: 'https://www.w3.org/TR/trace-context/' },
    { title: 'Kubernetes documentation: Liveness, Readiness and Startup Probes', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/' },
    { title: 'Prometheus Alertmanager documentation', url: 'https://prometheus.io/docs/alerting/latest/alertmanager/' },
    { title: 'OWASP Logging Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html' },
    { title: 'The Twelve-Factor App, XI. Logs', url: 'https://12factor.net/logs' },
  ],
  questions: [
    {
      key: 'SIGNALS', title: 'Signals', label: 'What will you collect?',
      hint: 'Traces show where a slow or failed request spent its time across elements; logs alone rarely do.',
      default: 'otel',
      options: [
        { value: 'otel', label: 'logs, metrics and traces (OpenTelemetry)', description: 'One vendor-neutral standard for all three, sent through a Collector to the backend you choose. Pick it when a request crosses two or more of your elements or a queue, or when you may change backend later.' },
        { value: 'logs', label: 'structured logs and metrics', description: 'Less to run and pay for; a request across elements is followed by its correlation id, by hand. Pick it for a single element with few dependencies, or a team not yet ready to run a tracing backend.' },
      ],
    },
    {
      key: 'SLI', title: 'Measured by', label: 'How is the availability objective measured?',
      hint: 'The objective and its burn-rate alerts are decided in the Availability pack; this decides the indicator they are computed from, measured where users meet the service.',
      default: 'request',
      options: [
        { value: 'request', label: 'the share of good requests at the edge', description: 'Good requests over valid requests, counted at the load balancer or the server\'s edge. Pick it when the element has steady traffic (more than about 1 request per second), so that a ratio over minutes means something.' },
        { value: 'probes', label: 'synthetic probes from outside', description: 'A probe exercises a real read path every minute from several locations outside the network. Pick it for low or bursty traffic, where a few failed requests swing the ratio, or to see outages before the first user arrives in the morning.' },
      ],
    },
    {
      key: 'ONCALL', title: 'Alerting', label: 'Who is alerted when it breaks?',
      hint: 'Alerts go to people who can act, on symptoms users feel, not on every cause.',
      default: 'oncall',
      options: [
        { value: 'oncall', label: 'the on-call engineer, around the clock', description: 'A paid rotation answers pages at any hour within 5 minutes. Pick it for an availability target of 99.9 % or more, or users in several time zones: 43 minutes a month do not wait for the morning.' },
        { value: 'hours', label: 'the team, in working hours', description: 'Alerts reach the team in working hours; outside them they become tickets and the status page says so. Pick it for internal tools, a target of 99.5 % or less, or users in one time zone who are not working at night.' },
      ],
    },
    {
      key: 'SAMPLING', title: 'Trace sampling', label: 'Which traces are kept?',
      hint: 'Every trace kept costs storage; the ones that explain failures are a small share of them. Only when the signals are logs, metrics and traces (OpenTelemetry).',
      default: 'tail',
      options: [
        { value: 'head', label: 'head sampling', description: 'A fixed share of traces is chosen at the first element and every element follows that choice. Pick it for high traffic with errors that are not rare, when the cost of a Collector that buffers traces is not justified.' },
        { value: 'tail', label: 'tail sampling', description: 'The Collector waits for a whole trace and keeps every one with an error or slower than the limit, plus a share of the rest. Pick it when errors are rare and each one must be explainable.' },
        { value: 'all', label: 'every trace', description: 'Nothing is dropped. Pick it for low traffic (under about 50 requests per second) where storage is cheap and every request may need explaining.' },
      ],
    },
  ],
  details: [
    { key: 'LOG_DAYS', label: 'How long are logs kept (days)?', default: '30', number: true },
    { key: 'SAMPLE_PERCENT', label: 'Share of ordinary traces kept (%). Only with head or tail sampling', default: '10', number: true },
    { key: 'SLOW_TRACE_MS', label: 'A trace slower than this is always kept (ms); set it at the latency objective decided in the Capacity and scaling pack. Only with tail sampling', default: '500', number: true },
  ],
  need: {
    label: 'Health seen, failures explained',
    text: 'The system runs in production for its users. Someone must know when it is unhealthy before users say so, be woken only for what matters, and find the cause of a failure across elements quickly. The indicator the objective is computed from must measure what users see, and what is collected must not cost more than it explains.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-sli-request', label: 'Good requests counted', when: { SLI: ['request'] }, ears_type: 'ubiquitous',
      action: 'count a request as good when it is valid and answered without a 5xx, at the load balancer or the server\'s edge, leave 4xx answers out as invalid, and record the good and total rates as the indicator the Availability pack\'s objective is measured with',
      rationale: 'Measured at the edge, the indicator sees what users see, including failures the element never logs (Google SRE workbook, Implementing SLOs).',
      scenario: { label: 'Good and bad counted', given: 'requests answered with 200, 500 and 404', when: 'the indicator is computed', then: 'the 200 is good, the 500 is bad, and the 404 is left out as invalid' },
    },
    {
      id: 'req-sli-probe', label: 'Probed from outside', when: { SLI: ['probes'] }, ears_type: 'ubiquitous',
      action: 'be probed every minute from at least 2 locations outside its own network by a check that exercises a real read path, and count a minute as down, in the indicator the Availability pack\'s objective is measured with, when the probes from 2 locations fail',
      rationale: 'With little traffic a ratio of requests is noise; probes measure availability whether or not users are there (Google SRE book, chapter 6, black-box monitoring).',
      scenario: { label: 'Outage seen by probes', given: 'probes in two locations', when: 'the element stops answering at night with no users', then: 'the minutes are counted as down in the indicator' },
    },
    {
      id: 'req-alert', label: 'Burn-rate alerts reach people', ears_type: 'event-driven',
      trigger: 'a burn-rate alert generated for the objective decided in the Availability pack fires',
      action: 'deliver it to {{ONCALL}} with the service level, the burn rate and a link to the runbook, and route an alert on a cause users do not feel to a ticket, never to a person',
      rationale: 'Multiwindow burn-rate alerts catch fast outages within minutes and slow leaks within hours; routing decides whether anyone acts on them (Google SRE workbook, Alerting on SLOs).',
      scenario: { label: 'Outage alerts', given: 'every request failing', when: 'the fast burn-rate alert fires', then: 'the people alerted get it with the runbook link, and a cause alert from the same minute became a ticket' },
    },
    {
      id: 'req-escalate', label: 'Pages escalate', when: { ONCALL: ['oncall'] }, ears_type: 'event-driven',
      trigger: 'a page is not acknowledged within 5 minutes',
      action: 'escalate it to the secondary on-call, and after another 10 minutes to the team lead, at any hour',
      rationale: 'An on-call rotation is only as fast as its slowest answer; escalation bounds it (Google SRE book, chapter 11).',
      scenario: { label: 'Missed page escalates', given: 'a page sent at night', when: 'the primary does not acknowledge it within 5 minutes', then: 'the secondary is paged, and the team lead 10 minutes later' },
    },
    {
      id: 'req-hours', label: 'Out-of-hours alerts wait', when: { ONCALL: ['hours'] }, ears_type: 'state-driven',
      precondition: 'outside working hours',
      action: 'turn alerts into tickets for the next working day instead of calling anyone, and show the outage on the status page within 5 minutes',
      rationale: 'Without on-call, users still need to know the service is down and that it is known; the ticket makes sure the morning starts with it.',
      scenario: { label: 'Night outage', given: 'an outage at 23:00', when: 'the burn-rate alert fires', then: 'nobody is called, a ticket waits for the morning, and the status page shows the outage within 5 minutes' },
    },
    {
      id: 'req-retention', label: 'Logs deleted after retention', ears_type: 'ubiquitous',
      action: 'keep its log lines for {{LOG_DAYS}} days and no longer, deleted by the log store, not by hand',
      rationale: 'A bounded retention limits both cost and what a leak exposes; logs are the copy nobody remembers to delete (OWASP Logging Cheat Sheet; The Twelve-Factor App, XI).',
      scenario: { label: 'Old lines gone', given: 'the log store', when: 'lines older than {{LOG_DAYS}} days are queried', then: 'none is returned' },
    },
    {
      id: 'req-trace', label: 'Requests traced', when: OTEL, ears_type: 'ubiquitous',
      action: 'propagate the W3C Trace Context (traceparent) through every call it makes, to other elements, outside systems and messages on queues, with a client span for each',
      rationale: 'A slow request is explained by where its time went; one broken link in the propagation splits the trace (W3C Trace Context).',
      scenario: { label: 'Slow request explained', given: 'a request slowed by one downstream call', when: 'its trace is opened', then: 'the slow call is visible with its timing, in the same trace as the request' },
    },
    {
      id: 'req-sample-head', label: 'Traces sampled at the start', when: { SIGNALS: ['otel'], SAMPLING: ['head'] }, ears_type: 'ubiquitous',
      action: 'keep {{SAMPLE_PERCENT}} % of traces, decided once by the SDK at the first element (parent-based sampling with a trace-id ratio) and followed by every element after it',
      rationale: 'A decision made once keeps traces whole; each element choosing on its own leaves fragments (OpenTelemetry, Sampling).',
      scenario: { label: 'Traces whole', given: '10 000 requests across three elements', when: 'the kept traces are counted', then: 'about {{SAMPLE_PERCENT}} % are kept and each kept trace has the spans of all three elements' },
    },
    {
      id: 'req-sample-tail', label: 'Failing traces kept', when: { SIGNALS: ['otel'], SAMPLING: ['tail'] }, ears_type: 'event-driven',
      trigger: 'a trace completes',
      action: 'keep it when any span has an error or the trace took longer than {{SLOW_TRACE_MS}} ms, and keep {{SAMPLE_PERCENT}} % of the rest',
      rationale: 'The traces that explain failures are rare; deciding after the trace is complete keeps every one of them at a fraction of the cost (OpenTelemetry, Sampling).',
      scenario: { label: 'Error trace kept', given: 'a thousand traces of which three have an error', when: 'they pass the Collector', then: 'all three are kept, and about {{SAMPLE_PERCENT}} % of the others' },
    },
    {
      id: 'req-sample-all', label: 'Every trace kept', when: { SIGNALS: ['otel'], SAMPLING: ['all'] }, ears_type: 'ubiquitous',
      action: 'keep every trace for at least 7 days, with no sampling in the SDK or the Collector',
      rationale: 'At low traffic the cost is small and any request, not only failing ones, may need explaining.',
      scenario: { label: 'Any request traced', given: 'a request a customer complains about 5 days later', when: 'its trace is looked up by its id', then: 'it is there' },
    },
    {
      id: 'req-health', label: 'Health reported', ears_type: 'ubiquitous',
      action: 'answer a liveness check that fails only when it must be restarted, and a readiness check that fails while it cannot serve, which the platform uses to restart it and route traffic',
      rationale: 'The platform restarts what hangs and routes around what is not ready; a liveness check that follows a dependency restarts everything when that dependency fails (Kubernetes documentation, Liveness, Readiness and Startup Probes).',
      scenario: { label: 'Hung instance replaced', given: 'an instance that stops answering', when: 'its liveness check fails', then: 'the platform restarts it, and no traffic reached it once its readiness check failed' },
    },
  ],
  adrs: [
    {
      id: 'adr-otel', label: 'OpenTelemetry for all signals', when: OTEL,
      decision: 'The element emits logs, metrics and traces with the OpenTelemetry SDK of its language (auto-instrumentation for the HTTP server, clients, database and queue libraries), propagating the W3C Trace Context on every call and message. Signals go to an OpenTelemetry Collector, which removes attributes that must not leave and exports to the backend. Trace sampling: {{SAMPLING}}; a head decision is made by the SDK at the first element and followed by the rest, while tail sampling and keeping every trace are the Collector\'s to do. Choose the backend by what the team already runs, cost per GB ingested and where the data may be kept: the Grafana stack (Tempo, Loki, Mimir or Prometheus) self-hosted or in Grafana Cloud, Elastic, Honeycomb, Datadog or New Relic; the Collector keeps that choice reversible. The availability objective and its burn-rate alerts are decided in the Availability pack and measured with {{SLI}}; alerts reach {{ONCALL}}. Log lines: shaped and redacted as decided in the Error handling and logging conventions pack; logs kept {{LOG_DAYS}} days.',
      consequences: '• One standard for all three signals, and any backend that speaks OTLP.\n• Every element and library on a request\'s path must pass the trace context on, queues included, or traces break.\n• Trace volume needs a sampling policy; tail sampling needs a Collector that buffers whole traces.\n• The Collector is one more component to run, scale and upgrade.',
      alternatives: '1. Structured logs and metrics only: less to run, but slower to explain failures across elements.\n2. A vendor\'s own agent (Datadog, Dynatrace): more automatic, but every signal is tied to that vendor and its pricing.',
    },
    {
      id: 'adr-logs', label: 'Structured logs and metrics', when: { SIGNALS: ['logs'] },
      decision: 'The element writes structured JSON log lines to standard output, each with a correlation id taken from the incoming X-Request-ID or traceparent header or created at the edge, and passes that id on in every call it makes. It exposes request rate, errors and duration as Prometheus metrics (or OpenTelemetry metrics with the same semantic conventions, which the indicator queries assume) on its own endpoint. A shipper (Fluent Bit, Vector or Grafana Alloy) sends the logs to the log store: Loki, Elasticsearch or OpenSearch, or the cloud\'s own (CloudWatch Logs, Azure Monitor Logs). No tracing. The availability objective and its burn-rate alerts are decided in the Availability pack and measured with {{SLI}}; alerts reach {{ONCALL}}. Log lines: shaped and redacted as decided in the Error handling and logging conventions pack; logs kept {{LOG_DAYS}} days.',
      consequences: '• Less to run and to pay for than three signals.\n• A request across elements is followed by its correlation id, by hand, and where its time went is guessed from timestamps.\n• Adding tracing later is easier if the correlation id is already the traceparent.',
      alternatives: '1. OpenTelemetry with traces: more to run, but a slow request explains itself.\n2. Unstructured text logs: nothing to set up, but they cannot be searched or counted reliably.',
    },
    {
      id: 'adr-oncall', label: 'Paging around the clock', when: { ONCALL: ['oncall'] },
      decision: 'An on-call rotation is paged at any hour when the error budget burns fast, and acknowledges within 5 minutes; unacknowledged pages escalate to the secondary after 5 minutes and to the team lead 10 minutes later. The rotation runs in PagerDuty, Opsgenie, Grafana OnCall or incident.io, fed by Alertmanager (or the backend\'s alerting); the escalation policy is kept in Terraform. Only symptoms page (the multiwindow burn-rate alerts generated for the objective decided in the Availability pack); causes such as a full disk or a restarting pod become tickets. Every alert links its runbook. The rotation is large enough that each engineer is on call at most one week in four, and time on call is paid or given back.',
      consequences: '• Outages at night are handled at night; a target of 99.9 % or more becomes reachable.\n• On-call costs money and people\'s evenings; noisy alerts burn the rotation out, so every page that needed no action is fixed or removed.\n• Runbooks have to exist and be kept current.',
      alternatives: '1. Alerts in working hours only: cheaper, but a night outage lasts until the morning.\n2. A follow-the-sun rotation across time zones: nobody is woken, but it needs teams in several regions.',
    },
    {
      id: 'adr-hours', label: 'Alerts in working hours', when: { ONCALL: ['hours'] },
      decision: 'Burn-rate alerts reach the team in working hours through the team channel (Slack or Microsoft Teams) and a mobile notification; outside working hours, Alertmanager\'s time intervals route them to tickets for the next working day instead. The same alerts reach the status page\'s incoming webhook (Instatus, Grafana OnCall\'s status page, or a small bridge to Atlassian Statuspage\'s incidents API) within a minute, so users know the outage is known. Only symptoms alert; every alert links its runbook.',
      consequences: '• Nobody is woken; no on-call cost.\n• An outage at night lasts until the morning: one such night can use a month\'s budget at 99.9 %, which the objective decided in the Availability pack must allow.\n• The status page carries the communication outside hours.',
      alternatives: '1. An on-call rotation around the clock: night outages are fixed at night, at the cost of a paid rotation.\n2. Best effort by whoever sees the alert: no cost, no promise, and burnout of the conscientious few.',
    },
  ],
  fitness: [
    {
      id: 'ff-sli-request', label: 'Request indicator recorded', when: { SLI: ['request'] }, category: 'operational', implements: SIGNAL_ADRS,
      checks: ['req-sli-request'],
      threshold: 'The good and total request rates are recorded from the edge metrics; a unit test over the rules counts a 200 as good, a 500 as bad and a 404 as invalid',
      description: 'Recording rules in the repository compute the good and total request rates from the server\'s request histogram, leaving 4xx answers out; promtool runs a unit test over them in the pipeline with synthetic series, so a change that counts a 500 as good or a 404 as a request fails the build. The Availability pack\'s SLO spec uses the same queries.',
      tool: 'promtool test rules (Prometheus)',
      language: 'yaml',
      snippet: `# sli.rules.yaml
groups:
  - name: order-api-sli
    rules:
      - record: order_api:requests_total:rate5m
        labels: { service: order-api }
        expr: sum(rate(http_server_request_duration_seconds_count{job="order-api",http_response_status_code!~"4.."}[5m]))
      - record: order_api:requests_good:rate5m
        labels: { service: order-api }
        expr: sum(rate(http_server_request_duration_seconds_count{job="order-api",http_response_status_code!~"4..|5.."}[5m]))
---
# sli.test.yaml   (CI: promtool test rules sli.test.yaml)
rule_files: [sli.rules.yaml]
evaluation_interval: 1m
tests:
  - interval: 1m
    input_series:
      - series: 'http_server_request_duration_seconds_count{job="order-api",http_response_status_code="200"}'
        values: '0+90x10'    # 1.5 good requests per second
      - series: 'http_server_request_duration_seconds_count{job="order-api",http_response_status_code="500"}'
        values: '0+30x10'    # 0.5 failed requests per second
      - series: 'http_server_request_duration_seconds_count{job="order-api",http_response_status_code="404"}'
        values: '0+60x10'    # invalid: left out of both rates
    promql_expr_test:
      - expr: order_api:requests_good:rate5m / order_api:requests_total:rate5m
        eval_time: 10m
        exp_samples:
          - labels: '{service="order-api"}'
            value: 0.75`,
    },
    {
      id: 'ff-probe', label: 'Probes measure availability', when: { SLI: ['probes'] }, category: 'operational', implements: SIGNAL_ADRS,
      checks: ['req-sli-probe'],
      threshold: 'A probe every 60 s from at least 2 locations outside the network, scraped by one Prometheus; a minute is recorded as down when 2 or more locations fail it',
      description: 'A Blackbox exporter runs in each of at least two locations outside the element\'s network and probes a real read path every minute; one central Prometheus scrapes both exporters with a location label per target, so the recording rule sees every location in one evaluation and marks a minute down when two or more fail. The recorded series is the raw indicator the Availability pack\'s SLO spec reads.',
      tool: 'Prometheus Blackbox exporter, scraped by one central Prometheus',
      language: 'yaml',
      snippet: `# blackbox.yml (in each probe location)
modules:
  orders_read:
    prober: http
    timeout: 5s
    http:
      valid_status_codes: [200]
      fail_if_body_not_matches_regexp: ['"orders":']
---
# prometheus.yml of the central Prometheus: one job per exporter location, same target
scrape_configs:
  - job_name: blackbox-order-api-eu-west
    scrape_interval: 60s
    metrics_path: /probe
    params: { module: [orders_read] }
    static_configs: [{ targets: ["https://shop.example.com/api/orders?probe=1"], labels: { location: eu-west } }]
    relabel_configs:
      - { source_labels: [__address__], target_label: __param_target }
      - { source_labels: [__param_target], target_label: instance }
      - { target_label: __address__, replacement: "blackbox-eu-west.probes.example.net:9115" }
  - job_name: blackbox-order-api-us-east
    scrape_interval: 60s
    metrics_path: /probe
    params: { module: [orders_read] }
    static_configs: [{ targets: ["https://shop.example.com/api/orders?probe=1"], labels: { location: us-east } }]
    relabel_configs:
      - { source_labels: [__address__], target_label: __param_target }
      - { source_labels: [__param_target], target_label: instance }
      - { target_label: __address__, replacement: "blackbox-us-east.probes.example.net:9115" }
---
# rules: a minute is down when 2 or more locations fail it
groups:
  - name: probe-sli
    rules:
      - record: order_api:probe_up:minute
        expr: (count(probe_success{job=~"blackbox-order-api-.*"} == 0) or vector(0)) < bool 2
# The Availability pack's SLO spec reads it as a raw indicator:
#   sli: { raw: { error_ratio_query: 1 - avg_over_time(order_api:probe_up:minute[{{.window}}]) } }`,
    },
    {
      id: 'ff-paging', label: 'Pages reach on-call', when: { ONCALL: ['oncall'] }, category: 'process', implements: ['adr-oncall'],
      checks: ['req-alert'],
      threshold: 'Every alert with severity page routes to the on-call receiver; 0 cause alerts (severity ticket) do; the configuration is valid',
      description: 'A pipeline step tests the Alertmanager routing tree whenever its configuration changes: page alerts must reach the on-call receiver (PagerDuty), ticket alerts must not.',
      tool: 'amtool (Prometheus Alertmanager)',
      language: 'yaml',
      snippet: `# alertmanager.yml (excerpt)
route:
  receiver: tickets
  routes:
    - matchers: [ 'severity="page"' ]
      receiver: pagerduty-oncall
receivers:
  - name: pagerduty-oncall
    pagerduty_configs: [{ routing_key_file: /etc/alertmanager/pagerduty-key }]
  - name: tickets
    webhook_configs: [{ url: "https://tickets.example.com/alertmanager" }]
---
# CI step
- run: |
    amtool check-config alertmanager.yml
    amtool config routes test --config.file=alertmanager.yml --verify.receivers=pagerduty-oncall severity=page service=order-api
    amtool config routes test --config.file=alertmanager.yml --verify.receivers=tickets severity=ticket service=order-api`,
    },
    {
      id: 'ff-escalation', label: 'Escalation policy as code', when: { ONCALL: ['oncall'] }, category: 'process', implements: ['adr-oncall'],
      checks: ['req-escalate'],
      threshold: 'The escalation policy in Terraform escalates after 5 minutes to the secondary and after 10 more to the team lead; terraform plan reports no drift from it',
      description: 'The PagerDuty escalation policy is kept in Terraform with the delays the decision names; the pipeline validates it on every change and a nightly plan fails on drift, so a delay changed by hand in the console is caught. Opsgenie and Grafana OnCall have Terraform providers with the same shape.',
      tool: 'Terraform with the PagerDuty provider (terraform plan -detailed-exitcode)',
      language: 'hcl',
      snippet: `resource "pagerduty_escalation_policy" "order_api" {
  name      = "Order API"
  num_loops = 2

  rule {                                  # primary on-call; after 5 minutes unacknowledged, the next rule
    escalation_delay_in_minutes = 5
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.primary.id
    }
  }
  rule {                                  # secondary; after 10 more minutes, the team lead
    escalation_delay_in_minutes = 10
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.secondary.id
    }
  }
  rule {
    escalation_delay_in_minutes = 10
    target {
      type = "user_reference"
      id   = pagerduty_user.team_lead.id
    }
  }
}
# CI: terraform validate; nightly: terraform plan -detailed-exitcode (2 = drift, fails the job)`,
    },
    {
      id: 'ff-hours-routing', label: 'Night alerts become tickets, the status page knows', when: { ONCALL: ['hours'] }, category: 'process', implements: ['adr-hours'],
      checks: ['req-alert', 'req-hours'],
      threshold: 'Page alerts match the status-page, team-channel and tickets receivers in the routing tree, the status-page route waits at most 1 minute, and the configuration is valid',
      description: 'The Alertmanager routing sends page alerts to the status page\'s webhook within a minute, to the team channel during the working-hours time interval and to tickets outside it; a pipeline step validates the configuration and the receivers with amtool whenever it changes. amtool does not evaluate time intervals, so the channel-or-ticket split is confirmed once after a change by adding a test alert (amtool alert add severity=page) outside hours and seeing the ticket.',
      tool: 'amtool (Prometheus Alertmanager time intervals)',
      language: 'yaml',
      snippet: `# alertmanager.yml (excerpt)
time_intervals:
  - name: working-hours
    time_intervals:
      - weekdays: ['monday:friday']
        times: [{ start_time: '08:00', end_time: '18:00' }]
        location: 'Europe/Warsaw'
route:
  receiver: tickets
  routes:
    - matchers: [ 'severity="page"' ]
      receiver: status-page
      group_wait: 1m
      continue: true
    - matchers: [ 'severity="page"' ]
      receiver: team-channel
      active_time_intervals: [working-hours]
      continue: true
    - matchers: [ 'severity="page"' ]
      receiver: tickets
      mute_time_intervals: [working-hours]
receivers:
  - name: status-page
    webhook_configs: [{ url: "https://status.example.com/incoming/alertmanager" }]
  - name: team-channel
    slack_configs: [{ channel: "#shop-alerts", api_url_file: /etc/alertmanager/slack-url }]
  - name: tickets
    webhook_configs: [{ url: "https://tickets.example.com/alertmanager" }]
---
# CI step
- run: |
    amtool check-config alertmanager.yml
    amtool config routes test --config.file=alertmanager.yml --verify.receivers=status-page,team-channel,tickets severity=page`,
    },
    {
      id: 'ff-retention', label: 'Log retention enforced', category: 'structural', implements: SIGNAL_ADRS,
      checks: ['req-retention'],
      threshold: 'Retention set to {{LOG_DAYS}} days in the log store; a monthly query for lines older than {{LOG_DAYS}} days plus 1 returns 0 lines',
      description: 'The log store\'s retention is in the repository and reviewed; a monthly job queries the day before the retention boundary (one day of slack for the compactor\'s delete delay) and fails when any line comes back. CloudWatch Logs and Elasticsearch ILM take the same number; the query step uses their CLI instead of logcli.',
      tool: 'Grafana Loki (compactor retention) and logcli in a scheduled job',
      language: 'yaml',
      snippet: `# loki config (excerpt)
compactor:
  working_directory: /loki/compactor
  retention_enabled: true
  delete_request_store: s3
limits_config:
  retention_period: {{LOG_DAYS}}d
---
# .github/workflows/log-retention.yml
name: log-retention
on:
  schedule: [{ cron: '0 6 1 * *' }]
jobs:
  oldest-line:
    runs-on: ubuntu-latest
    steps:
      - env: { LOKI_ADDR: https://loki.example.internal }
        run: |
          from=$(date -u -d "-$(( {{LOG_DAYS}} + 2 )) days" +%FT%TZ)
          to=$(date -u -d "-$(( {{LOG_DAYS}} + 1 )) days" +%FT%TZ)
          lines=$(logcli query '{service_name="order-api"}' --quiet --output=raw --limit=1 --from="$from" --to="$to" | wc -l)
          test "$lines" -eq 0 || { echo "::error::log lines older than {{LOG_DAYS}} days are still kept"; exit 1; }`,
    },
    {
      id: 'ff-trace-propagation', label: 'Traces stay whole', when: OTEL, category: 'structural', implements: ['adr-otel'],
      checks: ['req-trace'],
      threshold: 'A request through the element and its outgoing calls yields exactly 1 trace id, with as many client spans as outgoing calls, each carrying the traceparent',
      description: 'An integration test registers the HTTP instrumentation before the app is loaded, sends a request with a known traceparent, lets the element make its outgoing calls to a stub, and checks that every finished span carries that trace id, that there is a client span per call, and that the stub received the traceparent header on each.',
      tool: 'Vitest with the OpenTelemetry InMemorySpanExporter and HttpInstrumentation',
      language: 'ts',
      snippet: `import { SpanKind } from '@opentelemetry/api'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import request from 'supertest'

const exporter = new InMemorySpanExporter()
const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
provider.register()
registerInstrumentations({ instrumentations: [new HttpInstrumentation()] })
const { app } = await import('../src/app')        // loaded after the instrumentation, so http is patched
const { stub } = await import('./stubs/partner')  // records every request the element sends it

it('keeps one trace across the element and its outgoing calls', async () => {
  const traceId = '4bf92f3577b34da6a3ce929d0e0e4736'
  await request(app).get('/orders/42').set('traceparent', \`00-\${traceId}-00f067aa0ba902b7-01\`).expect(200)
  const spans = exporter.getFinishedSpans()
  expect(new Set(spans.map((s) => s.spanContext().traceId))).toEqual(new Set([traceId]))
  expect(spans.filter((s) => s.kind === SpanKind.CLIENT)).toHaveLength(stub.requests.length)
  for (const r of stub.requests) expect(r.headers.traceparent).toContain(traceId)
})`,
    },
    {
      id: 'ff-head-sampling', label: 'SDK samples at the root', when: { SIGNALS: ['otel'], SAMPLING: ['head'] }, category: 'structural', implements: ['adr-otel'],
      checks: ['req-sample-head'],
      threshold: 'Every container of the element sets OTEL_TRACES_SAMPLER=parentbased_traceidratio and OTEL_TRACES_SAMPLER_ARG to {{SAMPLE_PERCENT}} / 100',
      description: 'A policy over the Kubernetes manifests fails the pipeline when a container of the element does not configure the SDK\'s parent-based trace-id-ratio sampler with the agreed share; parent-based means only the first element decides and the others follow. On other platforms the same two variables go in the service\'s environment and the same check reads it.',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `package main

import rego.v1

env(c) := {e.name: e.value | some e in c.env}

deny contains msg if {
  input.kind == "Deployment"
  some c in input.spec.template.spec.containers
  object.get(env(c), "OTEL_TRACES_SAMPLER", "") != "parentbased_traceidratio"
  msg := sprintf("%s: container %s must set OTEL_TRACES_SAMPLER=parentbased_traceidratio", [input.metadata.name, c.name])
}

deny contains msg if {
  input.kind == "Deployment"
  some c in input.spec.template.spec.containers
  to_number(object.get(env(c), "OTEL_TRACES_SAMPLER_ARG", "1")) != {{SAMPLE_PERCENT}} / 100
  msg := sprintf("%s: container %s must set OTEL_TRACES_SAMPLER_ARG to the agreed share of traces", [input.metadata.name, c.name])
}`,
    },
    {
      id: 'ff-tail-sampling', label: 'Error traces always kept', when: { SIGNALS: ['otel'], SAMPLING: ['tail'] }, category: 'operational', implements: ['adr-otel'],
      checks: ['req-sample-tail'],
      threshold: 'The Collector\'s tail sampling policy keeps traces with an error status or slower than {{SLOW_TRACE_MS}} ms and {{SAMPLE_PERCENT}} % of the rest; the configuration validates',
      description: 'The Collector\'s tail sampling policy is kept in the repository and validated with the Collector\'s own validate command in the pipeline, so a policy that drops errors or a mistyped field fails the build before it runs.',
      tool: 'OpenTelemetry Collector contrib (tail_sampling processor; otelcol-contrib validate)',
      language: 'yaml',
      snippet: `# collector.yaml   (CI: otelcol-contrib validate --config=collector.yaml)
processors:
  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: {{SLOW_TRACE_MS}} }
      - name: the-rest
        type: probabilistic
        probabilistic: { sampling_percentage: {{SAMPLE_PERCENT}} }
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [tail_sampling, batch]
      exporters: [otlp]`,
    },
    {
      id: 'ff-keep-all', label: 'Nothing sampled, kept 7 days', when: { SIGNALS: ['otel'], SAMPLING: ['all'] }, category: 'structural', implements: ['adr-otel'],
      checks: ['req-sample-all'],
      threshold: 'The SDK sampler is always_on, the Collector\'s traces pipeline has no sampling processor, and the trace store keeps blocks for at least 168 h',
      description: 'A pipeline step reads the element\'s manifest, the Collector configuration and the trace store\'s configuration from the repository and fails when any of the three would drop or expire traces early. For a hosted backend, the retention check reads the backend\'s settings API instead.',
      tool: 'yq in the CI pipeline (Grafana Tempo for the trace store)',
      language: 'bash',
      snippet: `# every container of the element samples nothing away
yq -e '[.spec.template.spec.containers[].env[] | select(.name == "OTEL_TRACES_SAMPLER") | .value] | all_c(. == "always_on")' k8s/order-api.yaml
# the Collector's traces pipeline has no sampling processor
yq -e '[.service.pipelines.traces.processors[] | select(test("sampl"))] | length == 0' collector.yaml
# Tempo keeps blocks for at least 7 days (168h)
yq -e '.compactor.compaction.block_retention | sub("h", "") | tonumber >= 168' tempo.yaml`,
    },
    {
      id: 'ff-health', label: 'Probes declared', category: 'structural', implements: SIGNAL_ADRS,
      checks: ['req-health'],
      threshold: '0 deployed containers without a liveness and a readiness probe',
      description: 'A policy over the Kubernetes manifests fails the pipeline when a container of the element has no liveness or no readiness probe. On a managed runtime, the health check path of the service is set in its configuration and the same policy reads that.',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `package main

import rego.v1

deny contains msg if {
  input.kind == "Deployment"
  some c in input.spec.template.spec.containers
  not c.livenessProbe
  msg := sprintf("%s: container %s has no livenessProbe", [input.metadata.name, c.name])
}

deny contains msg if {
  input.kind == "Deployment"
  some c in input.spec.template.spec.containers
  not c.readinessProbe
  msg := sprintf("%s: container %s has no readinessProbe", [input.metadata.name, c.name])
}`,
    },
  ],
}

export default pack
