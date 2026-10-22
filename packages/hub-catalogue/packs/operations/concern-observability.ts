import type { PackSpec, When } from '../../src/packSpec'

const OTEL: When = { SIGNALS: ['otel'] }
const SIGNAL_ADRS = ['adr-otel', 'adr-logs']
const FORCES = 'This element runs in production. The forces: users notice an outage before a team without signals does; healthy needs a number agreed in advance, measured as users see it; alerts on every cause wake people for nothing until they are ignored, while alerts on symptoms that burn the error budget are worth acting on; a request crosses several elements, and its trail is lost without a shared id; logs are searched widely and copied to places with weaker access, so secrets and personal data in them leak; and keeping every log line and every trace forever costs more than the failures they explain.'

const pack: PackSpec = {
  id: 'concern-observability',
  name: 'Observability',
  group: 'operations',
  description: 'Running in production: the service levels promised and how they are measured, who is alerted and when, what the logs may hold and for how long, and how a failure is traced to its cause.',
  tags: ['operations', 'observability', 'slo', 'sli', 'logging', 'tracing', 'alerting', 'opentelemetry'],
  concern: {
    id: 'observability',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'these elements run in production, so how you will know they are healthy, and find out why when they are not, has to be decided.',
  },
  sources: [
    { title: 'Google SRE book, chapter 6: Monitoring Distributed Systems', url: 'https://sre.google/sre-book/monitoring-distributed-systems/' },
    { title: 'Google SRE workbook: Alerting on SLOs', url: 'https://sre.google/workbook/alerting-on-slos/' },
    { title: 'Google SRE book, chapter 11: Being On-Call', url: 'https://sre.google/sre-book/being-on-call/' },
    { title: 'OpenTelemetry documentation', url: 'https://opentelemetry.io/docs/' },
    { title: 'W3C Trace Context', url: 'https://www.w3.org/TR/trace-context/' },
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
        { value: 'logs', label: 'structured logs and metrics only', description: 'Less to run and pay for; a request across elements is followed by its correlation id, by hand. Pick it for a single element with few dependencies, or a team not yet ready to run a tracing backend.' },
      ],
    },
    {
      key: 'SLI', title: 'Measured by', label: 'How are the service levels measured?',
      hint: 'A service level indicator measured where users meet the service is the number every alert and every argument rests on.',
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
      key: 'LOGS', title: 'Personal data', label: 'May logs hold personal data?',
      hint: 'Logs are read by many people and tools and kept in places with weaker access than the database; personal data in them is a leak waiting to happen and falls under GDPR all the same.',
      default: 'redact',
      options: [
        { value: 'redact', label: 'no, pseudonymous ids only', description: 'Names, e-mail and postal addresses, phone numbers and payment data never reach a log; a user id that means nothing outside the system stands in. Pick it by default, and always when logs go to a SaaS backend or many people can read them.' },
        { value: 'restricted', label: 'only in a restricted log store', description: 'Support needs to find a customer\'s requests by what the customer says; personal data goes only to a separate store with role-based access, every read recorded and a short retention. Pick it only with a lawful basis for it and a named owner.' },
      ],
    },
    {
      key: 'SAMPLING', title: 'Trace sampling', label: 'Which traces are kept?',
      hint: 'Every trace kept costs storage; the ones that explain failures are a small share of them. Applies only with OpenTelemetry traces.',
      default: 'tail',
      options: [
        { value: 'head', label: 'head sampling', description: 'A fixed share of traces is chosen at the first element and every element follows that choice. Pick it for high traffic with errors that are not rare, when the cost of a Collector that buffers traces is not justified.' },
        { value: 'tail', label: 'tail sampling', description: 'The Collector waits for a whole trace and keeps every one with an error or slower than the target, plus a share of the rest. Pick it when errors are rare and each one must be explainable.' },
        { value: 'all', label: 'every trace', description: 'Nothing is dropped. Pick it for low traffic (under about 50 requests per second) where storage is cheap and every request may need explaining.' },
      ],
    },
  ],
  details: [
    { key: 'AVAILABILITY', label: 'Availability promised (%, per 30 days)', default: '99.9', number: true },
    { key: 'P95_MS', label: 'Response time at the 95th percentile (ms)', default: '500', number: true },
    { key: 'LOG_DAYS', label: 'How long are logs kept (days)?', default: '30', number: true },
    { key: 'SAMPLE_PERCENT', label: 'Share of ordinary traces kept (%)', default: '10', number: true },
  ],
  need: {
    label: 'Health seen, failures explained',
    text: 'The system runs in production for its users. Someone must know when it is unhealthy before users say so, be woken only for what matters, and find the cause of a failure across elements quickly; everyone must agree what healthy means. What is collected to do that must not leak secrets or personal data, and must not cost more than it explains.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-slo', label: 'Service levels met', ears_type: 'ubiquitous',
      action: 'meet {{AVAILABILITY}} % availability and a 95th percentile response time of {{P95_MS}} ms in every 30-day window, measured by {{SLI}}',
      rationale: 'A number everyone agrees on, measured as users see it, decides when to alert and when to slow down changes (Google SRE book, chapter 4; SRE workbook, Implementing SLOs).',
      scenario: { label: 'Levels measured', given: '30 days of production traffic', when: 'availability and the 95th percentile are computed', then: 'they are at least {{AVAILABILITY}} % and at most {{P95_MS}} ms' },
    },
    {
      id: 'req-sli-request', label: 'Good requests counted', when: { SLI: ['request'] }, ears_type: 'ubiquitous',
      action: 'count a request as good when it is valid and answered without a 5xx within {{P95_MS}} ms, at the load balancer or the server\'s edge, and publish the good and total counts as metrics',
      rationale: 'Measured at the edge, the indicator sees what users see, including failures the element never logs (Google SRE workbook, Implementing SLOs).',
      scenario: { label: 'Good and bad counted', given: 'requests answered with 200 in 100 ms, 200 after {{P95_MS}} ms, 500 and 404', when: 'the indicator is computed', then: 'only the first is good, and the 404 is left out as invalid' },
    },
    {
      id: 'req-sli-probe', label: 'Probed from outside', when: { SLI: ['probes'] }, ears_type: 'ubiquitous',
      action: 'be probed every minute from at least 2 locations outside its own network by a check that exercises a real read path, and count a minute as down when the probes from 2 locations fail',
      rationale: 'With little traffic a ratio of requests is noise; probes measure availability whether or not users are there (Google SRE book, chapter 6, black-box monitoring).',
      scenario: { label: 'Outage seen by probes', given: 'probes in two locations', when: 'the element stops answering at night with no users', then: 'the minutes are counted as down and the alert follows' },
    },
    {
      id: 'req-alert', label: 'Alert on budget burn', ears_type: 'event-driven',
      trigger: 'errors or slow responses burn the 30-day error budget 14.4 times faster than allowed over 1 hour, or 6 times faster over 6 hours',
      action: 'alert {{ONCALL}} with the service level, the burn rate and a link to the runbook, and send nothing for causes users do not feel',
      rationale: 'Multiwindow burn-rate alerts catch fast outages within minutes and slow leaks within hours, without paging on noise (Google SRE workbook, Alerting on SLOs).',
      scenario: { label: 'Budget burn alerts', given: 'an error rate that would use the month\'s budget in about 2 days', when: 'it lasts 5 minutes', then: 'the people alerted get an alert with the runbook' },
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
      id: 'req-logs', label: 'Logs structured and clean', ears_type: 'ubiquitous',
      action: 'write structured (JSON) log lines to standard output, each with the trace or correlation id of its request, never with a secret, token or password, and delete them after {{LOG_DAYS}} days',
      rationale: 'Logs are searched across elements and copied to places with weaker access; a bounded retention limits both cost and what a leak exposes (OWASP Logging Cheat Sheet; The Twelve-Factor App, XI).',
      scenario: { label: 'Request found in logs', given: 'a request that fails', when: 'its trace or correlation id is searched', then: 'every log line of it is found, none with a secret, and none older than {{LOG_DAYS}} days is kept' },
    },
    {
      id: 'req-pii-redact', label: 'No personal data logged', when: { LOGS: ['redact'] }, ears_type: 'ubiquitous',
      action: 'keep names, e-mail and postal addresses, phone numbers and payment data out of logs, traces and metric labels, writing a pseudonymous user id instead',
      rationale: 'Personal data in logs is processed under GDPR like anywhere else, and logs are the copy nobody remembers to delete (OWASP Logging Cheat Sheet, data to exclude).',
      scenario: { label: 'Sign-up logged clean', given: 'a customer signing up with name, e-mail and phone', when: 'the request\'s log lines and spans are read', then: 'none holds the name, e-mail or phone; the user id is there' },
    },
    {
      id: 'req-pii-restricted', label: 'Personal data logs restricted', when: { LOGS: ['restricted'] }, ears_type: 'ubiquitous',
      action: 'write personal data only to a separate log store that only the support role can read, record every read with who and when, keep it out of the general logs, traces and metric labels, and delete it after {{LOG_DAYS}} days at most',
      rationale: 'When support must find a customer by what they say, the data is kept where access is controlled and audited, not in every log (GDPR Article 32; OWASP Logging Cheat Sheet).',
      scenario: { label: 'Support search audited', given: 'a support engineer and a developer', when: 'both search the restricted store by a customer\'s e-mail', then: 'only the support engineer sees results, and the read is recorded' },
    },
    {
      id: 'req-trace', label: 'Requests traced', when: OTEL, ears_type: 'ubiquitous',
      action: 'propagate the W3C Trace Context (traceparent) through every call it makes, to other elements, outside systems and messages on queues',
      rationale: 'A slow request is explained by where its time went; one broken link in the propagation splits the trace (W3C Trace Context).',
      scenario: { label: 'Slow request explained', given: 'a request slowed by one downstream call', when: 'its trace is opened', then: 'the slow call is visible with its timing, in the same trace as the request' },
    },
    {
      id: 'req-sample-head', label: 'Traces sampled at the start', when: { SIGNALS: ['otel'], SAMPLING: ['head'] }, ears_type: 'ubiquitous',
      action: 'keep {{SAMPLE_PERCENT}} % of traces, decided once at the first element and followed by every element after it (parent-based sampling)',
      rationale: 'A decision made once keeps traces whole; each element choosing on its own leaves fragments (OpenTelemetry, Sampling).',
      scenario: { label: 'Traces whole', given: '10 000 requests across three elements', when: 'the kept traces are counted', then: 'about {{SAMPLE_PERCENT}} % are kept and each kept trace has the spans of all three elements' },
    },
    {
      id: 'req-sample-tail', label: 'Failing traces kept', when: { SIGNALS: ['otel'], SAMPLING: ['tail'] }, ears_type: 'event-driven',
      trigger: 'a trace completes',
      action: 'keep it when any span has an error or the trace took longer than {{P95_MS}} ms, and keep {{SAMPLE_PERCENT}} % of the rest',
      rationale: 'The traces that explain failures are rare; deciding after the trace is complete keeps every one of them at a fraction of the cost (OpenTelemetry, Sampling).',
      scenario: { label: 'Error trace kept', given: 'a thousand traces of which three have an error', when: 'they pass the Collector', then: 'all three are kept, and about {{SAMPLE_PERCENT}} % of the others' },
    },
    {
      id: 'req-sample-all', label: 'Every trace kept', when: { SIGNALS: ['otel'], SAMPLING: ['all'] }, ears_type: 'ubiquitous',
      action: 'keep every trace for at least 7 days',
      rationale: 'At low traffic the cost is small and any request, not only failing ones, may need explaining.',
      scenario: { label: 'Any request traced', given: 'a request a customer complains about 5 days later', when: 'its trace is looked up by its id', then: 'it is there' },
    },
    {
      id: 'req-health', label: 'Health reported', ears_type: 'ubiquitous',
      action: 'answer a liveness check that fails only when it must be restarted, and a readiness check that fails while it cannot serve, which the platform uses to restart it and route traffic',
      rationale: 'The platform restarts what hangs and routes around what is not ready; a liveness check that follows a dependency restarts everything when that dependency fails (Kubernetes documentation, probes).',
      scenario: { label: 'Hung instance replaced', given: 'an instance that stops answering', when: 'its liveness check fails', then: 'the platform restarts it, and no traffic reached it once its readiness check failed' },
    },
  ],
  adrs: [
    {
      id: 'adr-otel', label: 'OpenTelemetry for all signals', when: OTEL,
      decision: 'The element emits logs, metrics and traces with the OpenTelemetry SDK of its language (auto-instrumentation for the HTTP server, clients, database and queue libraries), propagating the W3C Trace Context on every call and message. Signals go to an OpenTelemetry Collector, which samples ({{SAMPLING}}), removes attributes that must not leave, and exports to the backend. Choose the backend by what the team already runs, cost per GB ingested and where the data may be kept: the Grafana stack (Tempo, Loki, Mimir or Prometheus) self-hosted or in Grafana Cloud, Elastic, Honeycomb, Datadog or New Relic; the Collector keeps that choice reversible. Service levels: {{AVAILABILITY}} % and {{P95_MS}} ms at the 95th percentile per 30 days, measured by {{SLI}}. Personal data in logs: {{LOGS}}; logs kept {{LOG_DAYS}} days.',
      consequences: '• One standard for all three signals, and any backend that speaks OTLP.\n• Every element and library on a request\'s path must pass the trace context on, queues included, or traces break.\n• Trace volume needs a sampling policy and a Collector to run it.\n• The Collector is one more component to run, scale and upgrade.',
      alternatives: '1. Structured logs and metrics only: less to run, but slower to explain failures across elements.\n2. A vendor\'s own agent (Datadog, Dynatrace): more automatic, but every signal is tied to that vendor and its pricing.',
    },
    {
      id: 'adr-logs', label: 'Structured logs and metrics', when: { SIGNALS: ['logs'] },
      decision: 'The element writes structured JSON log lines to standard output, each with a correlation id taken from the incoming X-Request-ID or traceparent header or created at the edge, and passes that id on in every call it makes. It exposes request rate, errors and duration as Prometheus metrics (or OpenTelemetry metrics) on its own endpoint. A shipper (Fluent Bit, Vector or Grafana Alloy) sends the logs to the log store: Loki, Elasticsearch or OpenSearch, or the cloud\'s own (CloudWatch Logs, Azure Monitor Logs). No tracing. Service levels: {{AVAILABILITY}} % and {{P95_MS}} ms at the 95th percentile per 30 days, measured by {{SLI}}. Personal data in logs: {{LOGS}}; logs kept {{LOG_DAYS}} days.',
      consequences: '• Less to run and to pay for than three signals.\n• A request across elements is followed by its correlation id, by hand, and where its time went is guessed from timestamps.\n• Adding tracing later is easier if the correlation id is already the traceparent.',
      alternatives: '1. OpenTelemetry with traces: more to run, but a slow request explains itself.\n2. Unstructured text logs: nothing to set up, but they cannot be searched or counted reliably.',
    },
    {
      id: 'adr-oncall', label: 'Paging around the clock', when: { ONCALL: ['oncall'] },
      decision: 'An on-call rotation is paged at any hour when the error budget burns fast, and acknowledges within 5 minutes; unacknowledged pages escalate to the secondary and then the team lead. The rotation runs in PagerDuty, Opsgenie, Grafana OnCall or incident.io, fed by Alertmanager (or the backend\'s alerting). Only symptoms page (multiwindow burn-rate alerts on the service levels); causes such as a full disk or a restarting pod become tickets. Every alert links its runbook. The rotation is large enough that each engineer is on call at most one week in four, and time on call is paid or given back.',
      consequences: '• Outages at night are handled at night; a target of 99.9 % or more becomes reachable.\n• On-call costs money and people\'s evenings; noisy alerts burn the rotation out, so every page that needed no action is fixed or removed.\n• Runbooks have to exist and be kept current.',
      alternatives: '1. Alerts in working hours only: cheaper, but a night outage lasts until the morning.\n2. A follow-the-sun rotation across time zones: nobody is woken, but it needs teams in several regions.',
    },
    {
      id: 'adr-hours', label: 'Alerts in working hours', when: { ONCALL: ['hours'] },
      decision: 'Burn-rate alerts reach the team in working hours through the team channel (Slack or Microsoft Teams) and a mobile notification; outside working hours, Alertmanager\'s time intervals route them to tickets for the next working day instead. A status page (Atlassian Statuspage, Instatus or the cloud\'s own) shows an outage automatically from the same alerts, so users know it is known. Only symptoms alert; every alert links its runbook.',
      consequences: '• Nobody is woken; no on-call cost.\n• An outage at night lasts until the morning: one such night can use a month\'s budget at {{AVAILABILITY}} %, which the target must allow.\n• The status page carries the communication outside hours.',
      alternatives: '1. An on-call rotation around the clock: night outages are fixed at night, at the cost of a paid rotation.\n2. Best effort by whoever sees the alert: no cost, no promise, and burnout of the conscientious few.',
    },
  ],
  fitness: [
    {
      id: 'ff-slo', label: 'Service levels watched', when: { SLI: ['request'] }, category: 'operational', implements: SIGNAL_ADRS,
      threshold: 'Availability at least {{AVAILABILITY}} % and 95 % of requests under {{P95_MS}} ms over every 30 days; burn-rate alerts at 14.4 times (1 h) and 6 times (6 h)',
      description: 'An SLO spec generates the Prometheus recording rules for both service levels and the multiwindow burn-rate alerts from the request metrics; the alerts go to Alertmanager, which routes them as the alerting decision says.',
      tool: 'Sloth (Prometheus SLO generator); Pyrra takes the same objectives',
      language: 'yaml',
      snippet: `# sloth generate -i slos.yaml -o slos.rules.yaml
version: "prometheus/v1"
service: "order-api"
slos:
  - name: "availability"
    objective: {{AVAILABILITY}}
    sli:
      events:
        error_query: sum(rate(http_server_request_duration_seconds_count{job="order-api",http_response_status_code=~"5.."}[{{.window}}]))
        total_query: sum(rate(http_server_request_duration_seconds_count{job="order-api"}[{{.window}}]))
    alerting:
      name: OrderApiAvailability
      page_alert: { labels: { severity: page } }
      ticket_alert: { labels: { severity: ticket } }
  - name: "latency"
    objective: 95
    description: "95 % of requests under {{P95_MS}} ms"
    sli:
      events:
        # le: the histogram bucket at {{P95_MS}} ms, in seconds
        error_query: |
          sum(rate(http_server_request_duration_seconds_count{job="order-api"}[{{.window}}]))
          - sum(rate(http_server_request_duration_seconds_bucket{job="order-api",le="0.5"}[{{.window}}]))
        total_query: sum(rate(http_server_request_duration_seconds_count{job="order-api"}[{{.window}}]))
    alerting:
      name: OrderApiLatency
      page_alert: { labels: { severity: page } }
      ticket_alert: { labels: { severity: ticket } }`,
    },
    {
      id: 'ff-probe', label: 'Probes measure availability', when: { SLI: ['probes'] }, category: 'operational', implements: SIGNAL_ADRS,
      threshold: 'A probe every 60 s from at least 2 locations; probe success at least {{AVAILABILITY}} % over 30 days',
      description: 'The Blackbox exporter, run in at least two locations outside the element\'s network, probes a real read path every minute; a recording rule turns the minutes failed in two locations into the availability, and an alert fires when it falls below the target.',
      tool: 'Prometheus Blackbox exporter',
      language: 'yaml',
      snippet: `# blackbox.yml
modules:
  orders_read:
    prober: http
    timeout: 5s
    http:
      valid_status_codes: [200]
      fail_if_body_not_matches_regexp: ['"orders":']
---
# prometheus.yml (in each probe location, with external label location=<name>)
scrape_configs:
  - job_name: blackbox-order-api
    scrape_interval: 60s
    metrics_path: /probe
    params: { module: [orders_read] }
    static_configs: [{ targets: ["https://shop.example.com/api/orders?probe=1"] }]
    relabel_configs:
      - { source_labels: [__address__], target_label: __param_target }
      - { source_labels: [__param_target], target_label: instance }
      - { target_label: __address__, replacement: "blackbox-exporter:9115" }
---
# rules: a minute is down when 2 or more locations fail it
groups:
  - name: probe-slo
    rules:
      - record: order_api:probe_up:minute
        expr: (count(probe_success{job="blackbox-order-api"} == 0) or vector(0)) < bool 2
      - alert: OrderApiProbeAvailabilityLow
        expr: avg_over_time(order_api:probe_up:minute[30d]) < {{AVAILABILITY}} / 100
        labels: { severity: page }`,
    },
    {
      id: 'ff-paging', label: 'Pages reach on-call', when: { ONCALL: ['oncall'] }, category: 'process', implements: ['adr-oncall'],
      threshold: 'Every alert with severity page routes to the on-call receiver; 0 cause alerts (severity ticket) do',
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
      id: 'ff-hours-routing', label: 'Night alerts become tickets', when: { ONCALL: ['hours'] }, category: 'process', implements: ['adr-hours'],
      threshold: 'Page alerts reach the team channel only within working hours; outside them 100 % become tickets',
      description: 'The Alertmanager routing sends page alerts to the team channel only during the working-hours time interval and to tickets otherwise; a pipeline step validates the configuration and the receivers with amtool whenever it changes.',
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
      receiver: team-channel
      active_time_intervals: [working-hours]
      continue: true
    - matchers: [ 'severity="page"' ]
      receiver: tickets
      mute_time_intervals: [working-hours]
---
# CI step
- run: |
    amtool check-config alertmanager.yml
    amtool config routes test --config.file=alertmanager.yml --verify.receivers=team-channel,tickets severity=page`,
    },
    {
      id: 'ff-clean-logs', label: 'Logs clean and correlated', category: 'structural', implements: SIGNAL_ADRS,
      threshold: '0 log lines without a trace or correlation id, and 0 with a secret or an e-mail address, in a full test run',
      description: 'The test suite\'s logs are collected; one step counts lines without the id, another scans them for secrets and personal data with gitleaks and an extra rule for e-mail addresses. With personal data in a restricted store, only the general logs are scanned.',
      tool: 'gitleaks (with a custom rule) and jq, in the CI pipeline',
      language: 'yaml',
      snippet: `# .gitleaks-logs.toml
[extend]
useDefault = true

[[rules]]
id = "email-in-logs"
description = "E-mail address in a log line"
regex = '''[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'''
---
# CI step after the tests, which write JSON logs to test-logs/
- run: |
    missing=$(cat test-logs/*.json | jq -c 'select((.trace_id // .correlation_id) == null)' | wc -l)
    test "$missing" -eq 0 || { echo "::error::$missing log lines without a trace or correlation id"; exit 1; }
    gitleaks dir test-logs/ --config .gitleaks-logs.toml --redact --exit-code 1`,
    },
    {
      id: 'ff-retention', label: 'Log retention enforced', category: 'structural', implements: SIGNAL_ADRS,
      threshold: 'Retention set to {{LOG_DAYS}} days in the log store; 0 log lines older than {{LOG_DAYS}} days',
      description: 'The log store deletes lines older than the retention; the configuration is in the repository and reviewed, and a monthly query for the oldest line checks that deletion runs.',
      tool: 'Grafana Loki (compactor retention); CloudWatch Logs or Elasticsearch ILM take the same number',
      language: 'yaml',
      snippet: `# loki config (excerpt)
compactor:
  working_directory: /loki/compactor
  retention_enabled: true
  delete_request_store: s3
limits_config:
  retention_period: {{LOG_DAYS}}d
# Monthly check (logcli): nothing older than the retention is returned
#   logcli query '{service_name="order-api"}' --from="$(date -u -d '-{{LOG_DAYS}} days -1 day' +%FT%TZ)" \\
#     --to="$(date -u -d '-{{LOG_DAYS}} days' +%FT%TZ)" --limit 1`,
    },
    {
      id: 'ff-trace-propagation', label: 'Traces stay whole', when: OTEL, category: 'structural', implements: ['adr-otel'],
      threshold: 'A request through the element and its outgoing calls yields exactly 1 trace id, with a client span for every outgoing call',
      description: 'An integration test sends a request with a known traceparent, lets the element make its outgoing calls (to a stub), and checks that every finished span carries that trace id and that the stub received the traceparent header.',
      tool: 'Vitest with the OpenTelemetry InMemorySpanExporter',
      language: 'ts',
      snippet: `import { trace, SpanKind } from '@opentelemetry/api'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import request from 'supertest'

const exporter = new InMemorySpanExporter()
const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
provider.register()

it('keeps one trace across the element and its outgoing calls', async () => {
  const traceId = '4bf92f3577b34da6a3ce929d0e0e4736'
  await request(app).get('/orders/42').set('traceparent', \`00-\${traceId}-00f067aa0ba902b7-01\`).expect(200)
  const spans = exporter.getFinishedSpans()
  expect(new Set(spans.map((s) => s.spanContext().traceId))).toEqual(new Set([traceId]))
  expect(spans.some((s) => s.kind === SpanKind.CLIENT)).toBe(true)
  expect(stub.lastRequest.headers.traceparent).toContain(traceId)
})`,
    },
    {
      id: 'ff-tail-sampling', label: 'Error traces always kept', when: { SIGNALS: ['otel'], SAMPLING: ['tail'] }, category: 'operational', implements: ['adr-otel'],
      threshold: '100 % of traces with an error or slower than {{P95_MS}} ms kept; about {{SAMPLE_PERCENT}} % of the rest',
      description: 'The Collector\'s tail sampling policy is kept in the repository; a test sends a known mix of traces through a Collector started in the pipeline and counts what reaches the exporter.',
      tool: 'OpenTelemetry Collector (tail_sampling processor, contrib distribution)',
      language: 'yaml',
      snippet: `processors:
  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: {{P95_MS}} }
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
      id: 'ff-health', label: 'Probes declared', category: 'structural', implements: SIGNAL_ADRS,
      threshold: '0 deployed containers without a liveness and a readiness probe',
      description: 'A policy over the Kubernetes manifests fails the pipeline when a container of the element has no liveness or no readiness probe.',
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
