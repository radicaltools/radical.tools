import type { PackSpec, When } from '../../src/packSpec'

const SHED: When = { OVERLOAD: ['shed', 'both'] }
const QUEUE: When = { OVERLOAD: ['backpressure', 'both'] }
const SCALING_ADRS = ['adr-fixed', 'adr-autoscale', 'adr-serverless']
const FORCES = 'This element runs on capacity someone has to provide. The forces: load is not flat (a busy hour, a campaign, a sale day can be several times the usual), and a service sized for the average falls over at the peak; an overloaded service does not slow down gracefully, it queues, times out and retries until it serves nobody (a cascading failure); adding instances takes minutes and only helps when the element keeps no state of its own; whatever it calls (a database, a partner) has limits of its own that scaling out can break; idle capacity costs money every hour; and the only way to know the breaking point is to measure it before users find it. The snippets of this pack assume the element is order-api in the shop namespace, with Prometheus, cAdvisor and kube-state-metrics on Kubernetes; rename them for yours.'

const pack: PackSpec = {
  id: 'concern-capacity',
  name: 'Capacity and scaling',
  group: 'reliability',
  description: 'How much load it carries: the expected load and its peak, the latency budget under load, how it scales to meet it, what it does when overloaded, and how often the capacity is proven with a load test.',
  tags: ['reliability', 'performance', 'capacity', 'scaling', 'autoscaling', 'load-shedding', 'backpressure', 'load-testing'],
  concern: {
    id: 'capacity',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp" OR type = "database" OR type = "queue") AND external != true',
    why: 'these elements run on capacity of their own (instances, connections, storage, throughput), so the load they must carry, how they scale and what they do when overloaded has to be decided.',
  },
  sources: [
    { title: 'Google SRE book, chapter 1: Introduction (capacity planning)', url: 'https://sre.google/sre-book/introduction/' },
    { title: 'Google SRE book, chapter 21: Handling Overload', url: 'https://sre.google/sre-book/handling-overload/' },
    { title: 'Google SRE book, chapter 22: Addressing Cascading Failures', url: 'https://sre.google/sre-book/addressing-cascading-failures/' },
    { title: 'Amazon Builders\' Library: Using load shedding to avoid overload', url: 'https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/' },
    { title: 'AWS Well-Architected Framework, Reliability Pillar', url: 'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html' },
    { title: 'The Twelve-Factor App, VIII. Concurrency', url: 'https://12factor.net/concurrency' },
    { title: 'Grafana k6 documentation', url: 'https://grafana.com/docs/k6/latest/' },
    { title: 'Kubernetes documentation: Horizontal Pod Autoscaling', url: 'https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/' },
    { title: 'RabbitMQ documentation: Queue Length Limit', url: 'https://www.rabbitmq.com/docs/maxlength' },
    { title: 'AWS Lambda documentation: function metrics', url: 'https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics-types.html' },
  ],
  questions: [
    {
      key: 'SCALING', title: 'Scaling', label: 'How does it scale to the peak?',
      hint: 'This decides whether capacity follows the load by itself, and what the element must be like for that (stateless, quick to start).',
      default: 'horizontal',
      options: [
        { value: 'fixed', label: 'a fixed fleet sized for the peak', description: 'A set number of instances (or one bigger machine) provisioned for the peak with headroom, changed by a reviewed change. Pick it when the load is predictable within a factor of 2, the element keeps state that is hard to split, or the load is small enough that autoscaling saves little.' },
        { value: 'horizontal', label: 'horizontal autoscaling', description: 'Stateless instances added and removed by the platform on CPU, request rate or queue length (Kubernetes HPA or KEDA, ECS Service Auto Scaling, VM scale sets). Pick it when the load varies by more than 2 times over a day or a season and the element keeps no state of its own.' },
        { value: 'serverless', label: 'serverless functions or containers', description: 'The platform starts an instance per demand, down to zero (AWS Lambda, Google Cloud Run, Azure Functions or Container Apps). Pick it for spiky or mostly idle traffic, requests that finish in seconds, and when a cold start fits the latency target.' },
      ],
    },
    {
      key: 'OVERLOAD', title: 'Overload', label: 'What does it do when more arrives than it can handle?',
      hint: 'Scaling takes minutes and has a ceiling. Without a rule for overload, everything slows down until everything times out.',
      default: 'shed',
      options: [
        { value: 'shed', label: 'load shedding', description: 'Above a concurrency limit it refuses new requests at once (503 with Retry-After), lowest priority first, so those it accepts stay fast. Pick it for synchronous APIs and pages where a caller waits and a fast "try again" beats a slow timeout.' },
        { value: 'backpressure', label: 'a bounded queue with backpressure', description: 'Work goes into a bounded queue processed at the rate the workers sustain; when the queue is full, producers are refused. Pick it when the work can be done later (orders, e-mails, imports) and the caller does not wait for the result.' },
        { value: 'both', label: 'load shedding for requests and a bounded queue for work', description: 'The synchronous part sheds load, the asynchronous part queues it with backpressure. Pick it when the element both answers callers and processes work in the background.' },
      ],
    },
    {
      key: 'LOADTEST', title: 'Load tests', label: 'When is the capacity proven with a load test?',
      hint: 'Capacity estimates are wrong until measured; regressions in performance arrive with ordinary changes.',
      default: 'release',
      options: [
        { value: 'release', label: 'a load test of every release candidate', description: 'The pipeline runs a load test at the peak against a production-like environment and stops the release on a regression. Pick it when releases are frequent, an environment of production size is affordable, and performance regressions have reached users before.' },
        { value: 'scheduled', label: 'a monthly load test and one before each peak event', description: 'A full-scale test every month and 4 weeks before each announced peak event, finding the breaking point. Pick it when a production-size environment is costly to keep, or releases rarely change the hot paths.' },
      ],
    },
  ],
  details: [
    { key: 'EXPECTED_RPS', label: 'Expected load in a normal busy hour (requests per second)', default: '100', number: true },
    { key: 'PEAK_FACTOR', label: 'How many times that load is the peak (a sale day, a campaign)?', default: '5', number: true },
    { key: 'P95_MS', label: 'Response time at the 95th percentile under load (ms)', default: '500', number: true },
    { key: 'CONCURRENCY_CAP', label: 'Most concurrent connections the database (or the weakest dependency) accepts from this element. Only with horizontal or serverless scaling', default: '200', number: true },
  ],
  need: {
    label: 'Carries the load it is given',
    text: 'The element serves a load that changes over the day and peaks on known and unknown occasions. It must carry the peak at an acceptable response time without paying for the peak all year, must not collapse when more arrives than it can handle, must not overwhelm what it depends on, and its real limits must be known before users find them.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-peak', label: 'Peak load carried', ears_type: 'ubiquitous',
      action: 'serve {{PEAK_FACTOR}} times {{EXPECTED_RPS}} requests per second, sustained for 15 minutes, with a 95th percentile response time under {{P95_MS}} ms and fewer than 0.1 % errors',
      rationale: 'A service sized for the average fails at the peak; a load figure with a latency and error bound is what a load test can check (AWS Well-Architected Reliability Pillar, REL 7: design to scale with demand).',
      scenario: { label: 'Peak load test', given: 'a production-like environment', when: 'load rises to {{PEAK_FACTOR}} times {{EXPECTED_RPS}} requests per second and holds for 15 minutes', then: 'the 95th percentile stays under {{P95_MS}} ms and errors under 0.1 %' },
    },
    {
      id: 'req-headroom', label: 'Headroom kept', when: { SCALING: ['fixed'] }, ears_type: 'state-driven',
      precondition: 'the busiest hour of the last 7 days used more than 70 % of the provisioned CPU or memory',
      action: 'raise a capacity alert that opens a ticket, so that the team raises the provisioned capacity by a reviewed change before the next expected peak',
      rationale: 'A fixed fleet does not follow the load; 30 % headroom at the observed peak leaves room for growth and for an instance lost (Google SRE book, chapter 1, capacity planning).',
      scenario: { label: 'Headroom alert', given: 'a fixed fleet', when: 'the weekly busiest hour uses 75 % of its CPU', then: 'an alert opens a capacity ticket, and the change is merged before the next expected peak' },
    },
    {
      id: 'req-autoscale', label: 'Scales out in time', when: { SCALING: ['horizontal'] }, ears_type: 'event-driven',
      trigger: 'load rises from {{EXPECTED_RPS}} to {{PEAK_FACTOR}} times {{EXPECTED_RPS}} requests per second within 5 minutes',
      action: 'add instances, ready to serve within 3 minutes, so that the 95th percentile stays under {{P95_MS}} ms through the ramp, and remove them only after 15 minutes below the scaling target',
      rationale: 'Autoscaling helps only if new instances are ready before the queue grows; a slow scale-in avoids flapping (Kubernetes documentation, Horizontal Pod Autoscaling: stabilization window; AWS Well-Architected Reliability Pillar, REL 7).',
      scenario: { label: 'Ramp to peak', given: 'the element at {{EXPECTED_RPS}} requests per second with a scale-down stabilization of 15 minutes', when: 'load ramps to {{PEAK_FACTOR}} times that in 5 minutes', then: 'the 95th percentile stays under {{P95_MS}} ms through the ramp' },
    },
    {
      id: 'req-cold-start', label: 'Cold starts bounded', when: { SCALING: ['serverless'] }, ears_type: 'event-driven',
      trigger: 'a request arrives and no warm instance is free',
      action: 'answer it within 1 second including the start, keeping enough instances warm (provisioned concurrency or minimum instances) for {{EXPECTED_RPS}} requests per second',
      rationale: 'Cold starts land on users at the start of every spike; warm capacity for the normal load keeps them to the burst only.',
      scenario: { label: 'Burst after idle', given: 'the element idle at its minimum instances', when: 'a burst of {{PEAK_FACTOR}} times {{EXPECTED_RPS}} requests per second arrives', then: 'every request is answered within 1 second' },
    },
    {
      id: 'req-downstream', label: 'Dependencies not flooded', when: { SCALING: ['horizontal', 'serverless'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'it scales out faster than its database or another dependency accepts connections',
      action: 'keep its connections to the dependency at or below {{CONCURRENCY_CAP}}, the dependency\'s limit for this element, and reach the database through a connection pooler (Amazon RDS Proxy, PgBouncer)',
      rationale: 'An element that scales to a thousand instances opens a thousand connections; the database falls over first (Amazon Builders\' Library, load shedding; Google SRE book, chapter 22).',
      scenario: { label: 'Connections capped', given: 'a database that accepts {{CONCURRENCY_CAP}} connections from the element', when: 'load would scale the element beyond that', then: 'connections stay at or below {{CONCURRENCY_CAP}} and excess requests are throttled, not failed by the database' },
    },
    {
      id: 'req-shed', label: 'Excess load shed', when: SHED, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'requests in flight exceed its concurrency limit, or the oldest waiting request has waited longer than {{P95_MS}} ms',
      action: 'refuse new requests at once with 503 and a Retry-After header, lowest priority first (health checks and paying customers last), so that the requests it accepts keep a 95th percentile under {{P95_MS}} ms',
      rationale: 'Refusing early keeps the accepted work fast; queueing everything makes every request slow and invites retries that deepen the overload (Google SRE book, chapter 21; Amazon Builders\' Library).',
      scenario: { label: 'Twice the peak', given: 'the element at full capacity', when: 'load reaches 2 times {{PEAK_FACTOR}} times {{EXPECTED_RPS}} requests per second', then: 'excess requests get 503 within 50 ms and accepted ones keep a 95th percentile under {{P95_MS}} ms' },
    },
    {
      id: 'req-backpressure', label: 'Backpressure on producers', when: QUEUE, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'its work queue reaches its bound because the workers fall behind',
      action: 'refuse new work with 429 and a Retry-After header, never drop work already accepted, send work that fails repeatedly to a dead-letter queue that is watched, and keep the backlog from growing for more than 15 minutes in a row',
      rationale: 'An unbounded queue hides overload until memory or the wait runs out; a bound pushes the pressure back to the producer, who can wait or retry (Google SRE book, chapter 22).',
      scenario: { label: 'Queue full', given: 'workers slower than the producers', when: 'the queue reaches its bound', then: 'producers get 429 with Retry-After, no accepted message is lost, and an alert fires if the backlog still grows after 15 minutes' },
    },
    {
      id: 'req-loadtest-release', label: 'Release load-tested', when: { LOADTEST: ['release'] }, ears_type: 'event-driven',
      trigger: 'a release candidate is built',
      action: 'run a load test at {{PEAK_FACTOR}} times {{EXPECTED_RPS}} requests per second for 15 minutes against a production-like environment, and stop the release when the 95th percentile exceeds {{P95_MS}} ms or errors exceed 0.1 %',
      rationale: 'Performance regressions arrive with ordinary changes; a gate on every candidate finds them before users do.',
      scenario: { label: 'Regression stopped', given: 'a release candidate that makes the hot path 50 % slower', when: 'the pipeline runs its load test', then: 'the test fails on the {{P95_MS}} ms threshold and the release does not deploy' },
    },
    {
      id: 'req-loadtest-scheduled', label: 'Capacity tested monthly', when: { LOADTEST: ['scheduled'] }, ears_type: 'event-driven',
      trigger: '30 days have passed since the last load test, or an announced peak event is 4 weeks away',
      action: 'run a load test that ramps past {{PEAK_FACTOR}} times {{EXPECTED_RPS}} requests per second up to 3 times the peak, fail it when the 95th percentile exceeds {{P95_MS}} ms before 1.5 times the peak, and record the band of load where it broke',
      rationale: 'Knowing the breaking point, and keeping it 50 % above the peak, leaves time to act before a peak event instead of during it.',
      scenario: { label: 'Breaking point found', given: 'a production-size environment', when: 'the monthly test ramps the load to 3 times the peak', then: 'the 95th percentile held to 1.5 times the peak, and the band where it broke is recorded' },
    },
  ],
  adrs: [
    {
      id: 'adr-fixed', label: 'Fixed fleet sized for the peak', when: { SCALING: ['fixed'] },
      decision: 'The element runs a fixed number of instances sized so that the peak ({{PEAK_FACTOR}} times {{EXPECTED_RPS}} requests per second) uses at most 70 % of CPU, memory and connection pools, and losing one instance still carries it (N+1). Capacity changes by a reviewed change in the infrastructure code (Terraform, Pulumi, Helm values), driven by a headroom alert on the weekly busiest hour that opens a ticket. Overload: {{OVERLOAD}}. Load tests: {{LOADTEST}}. Choose bigger instances over more of them only while the element keeps state that cannot be split; otherwise add instances.',
      consequences: '• Predictable cost and behaviour; nothing scales by surprise.\n• Paying for the peak all the time: at a peak factor of {{PEAK_FACTOR}}, most of the capacity idles most of the day.\n• An unexpected peak above the headroom is handled only by the overload rule, until someone adds capacity.\n• Growing one instance has a ceiling: the largest instance type.',
      alternatives: '1. Horizontal autoscaling: follows the load and saves idle cost, but the element must be stateless and start fast.\n2. Serverless: no capacity to plan, but cold starts and per-request cost at steady high load.',
    },
    {
      id: 'adr-autoscale', label: 'Horizontal autoscaling', when: { SCALING: ['horizontal'] },
      decision: 'The element runs stateless instances that the platform adds and removes: on Kubernetes, a HorizontalPodAutoscaler on CPU or on request rate (through KEDA or the Prometheus Adapter); elsewhere ECS Service Auto Scaling, Azure VM scale sets or Container Apps scale rules. Minimum replicas (at least 2) carry {{EXPECTED_RPS}} requests per second with one zone lost; maximum replicas carry 1.5 times the peak ({{PEAK_FACTOR}} times the normal load) and, times the pool size per instance, stay within the {{CONCURRENCY_CAP}} connections the database accepts; scale-in waits 15 minutes. Instances start serving within 60 seconds and hold no session or file of their own. Overload: {{OVERLOAD}}. Load tests: {{LOADTEST}}. Choose the metric that rises first with load: request rate or concurrency for APIs, queue length for workers, CPU only when the work is CPU-bound.',
      consequences: '• Capacity follows the load; idle cost drops at night.\n• The element must be stateless and start fast; sessions and uploads live in shared stores.\n• Scaling takes minutes; a spike faster than that is met by the overload rule.\n• The maximum is a deliberate ceiling: at it, an alert asks whether to raise it or shed load.\n• Downstream limits (database connections) cap how far scaling helps; the pool size times the maximum replicas is that cap.',
      alternatives: '1. A fixed fleet sized for the peak: simpler, but pays for the peak all year.\n2. Serverless: scales per request to zero, at the cost of cold starts and platform limits.',
    },
    {
      id: 'adr-serverless', label: 'Serverless scaling', when: { SCALING: ['serverless'] },
      decision: 'The element runs on a serverless platform that starts instances per demand: AWS Lambda, Google Cloud Run, Azure Functions (Flex Consumption) or Azure Container Apps. Warm capacity (provisioned concurrency or minimum instances) carries {{EXPECTED_RPS}} requests per second; maximum concurrency is capped at {{CONCURRENCY_CAP}}, what its database and other dependencies accept, with a connection pooler (Amazon RDS Proxy, PgBouncer) in front of the database; above the cap the platform throttles, which is the overload behaviour working. Overload: {{OVERLOAD}}. Load tests: {{LOADTEST}}. Choose the platform by request duration (Lambda up to 15 minutes; Cloud Run and Container Apps for containers and longer requests), cold start of the runtime, and cost at the steady load: above a few million requests a day, compare with containers on autoscaling.',
      consequences: '• No capacity to plan or idle fleet to pay for; scaling is per request.\n• Cold starts add latency at the start of every burst; warm capacity costs money.\n• Account and regional concurrency limits apply and must be raised ahead of peaks; a throttle below our own cap means that limit was hit.\n• Scaling out can flood the database: the concurrency cap and the pooler are not optional.\n• Ties the element to the platform\'s runtime, limits and pricing.',
      alternatives: '1. Containers with horizontal autoscaling: no cold starts and cheaper at steady load, but capacity to manage.\n2. A fixed fleet: predictable, but sized for a peak that rarely comes.',
    },
    {
      id: 'adr-shed', label: 'Shed load at a concurrency limit', when: SHED,
      decision: 'Each instance limits the requests in flight and refuses the excess at once with 503 and Retry-After, before doing any work for it. The limit adapts to the measured latency (Envoy\'s adaptive concurrency filter, Netflix concurrency-limits, or the framework\'s own limiter such as ASP.NET Core\'s concurrency limiter), or is set from the load test at the knee of the latency curve. Requests carry a priority: health checks and the paying path are shed last, background and bulk calls first. Clients retry with exponential backoff and jitter, at most 3 times.',
      consequences: '• Accepted requests stay fast under overload; the service does not collapse.\n• Some callers see 503 at the peak; that is visible and must be explained to them.\n• The priority of each route is a product decision, written down next to the code.\n• Retries without backoff would undo it; clients are part of the design.',
      alternatives: '1. Unbounded queueing: no refusals, but every request slows down until all time out.\n2. Per-client rate limits only: protects against one noisy caller, not against total load.',
    },
    {
      id: 'adr-backpressure', label: 'Bounded queue with backpressure', when: QUEUE,
      decision: 'Work that the caller does not wait for goes into a bounded queue. The bounded primitive is RabbitMQ with x-max-length and x-overflow reject-publish: a full queue refuses the publish, the producer\'s publisher confirm fails, and the producer answers 429 with Retry-After. With Amazon SQS or Kafka, which have no length bound (SQS is unbounded, Kafka is bounded by retention, not count), the producer gates itself: it reads the queue depth (ApproximateNumberOfMessages) or the consumer lag before publishing and answers 429 above the agreed bound. Workers scale on queue length or consumer lag (KEDA scalers) up to what downstream systems accept. Accepted work is never dropped; messages that fail repeatedly go to a dead-letter queue with an alert on it.',
      consequences: '• Peaks are absorbed by the queue and processed at a sustainable rate.\n• Results arrive later at the peak; the product must accept that delay for this work.\n• The queue length, the age of the oldest message and the dead-letter queue become the signals to watch.\n• Producers must handle 429 and retry; a producer that drops work on 429 loses it.\n• With SQS or Kafka the bound lives in the producer\'s code, not in the broker.',
      alternatives: '1. Processing everything synchronously: simple, but the caller waits and peaks hit the database directly.\n2. An unbounded queue: never refuses, but hides overload until memory or the delay is unacceptable.',
    },
  ],
  fitness: [
    {
      id: 'ff-loadtest-release', label: 'Load test gates release', when: { LOADTEST: ['release'] }, category: 'operational', implements: SCALING_ADRS,
      checks: ['req-peak', 'req-autoscale', 'req-loadtest-release'],
      threshold: '95th percentile under {{P95_MS}} ms and errors under 0.1 % through a 5-minute ramp to {{PEAK_FACTOR}} times {{EXPECTED_RPS}} requests per second and 15 minutes at it',
      description: 'The pipeline runs a k6 test against a production-like environment for every release candidate: a 5-minute ramp from the normal load to the peak (which an autoscaler has to follow in time) and 15 minutes at the peak; the thresholds fail the run, and the pipeline stops the release.',
      tool: 'Grafana k6',
      language: 'js',
      snippet: `// k6 run --env BASE_URL=https://staging.shop.example peak.js   (in the release pipeline)
import http from 'k6/http'
import { check } from 'k6'

const NORMAL = {{EXPECTED_RPS}}
const PEAK = NORMAL * {{PEAK_FACTOR}}

export const options = {
  scenarios: {
    peak: {
      executor: 'ramping-arrival-rate',
      startRate: NORMAL, timeUnit: '1s',
      preAllocatedVUs: 200, maxVUs: 2000,
      stages: [
        { target: PEAK, duration: '5m' },   // ramp to the peak
        { target: PEAK, duration: '15m' },  // hold it
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<{{P95_MS}}'],
    http_req_failed: ['rate<0.001'],
  },
}

export default function () {
  const res = http.get(\`\${__ENV.BASE_URL}/orders?page=1\`)
  check(res, { 'status 200': (r) => r.status === 200 })
}`,
    },
    {
      id: 'ff-loadtest-scheduled', label: 'Breaking point measured', when: { LOADTEST: ['scheduled'] }, category: 'operational', implements: SCALING_ADRS,
      checks: ['req-peak', 'req-autoscale', 'req-loadtest-scheduled'],
      threshold: '95th percentile under {{P95_MS}} ms and errors under 0.1 % up to 1.5 times {{PEAK_FACTOR}} times {{EXPECTED_RPS}} requests per second; the band of load where the 95th percentile broke, up to 3 times the peak, is recorded; run at most 30 days ago',
      description: 'A scheduled job runs a k6 test that ramps from the normal load past the peak to 3 times the peak, tagging requests by the band of load they were sent in. The thresholds assert the latency and error bounds up to 1.5 times the peak; the summary records the first band above it where the 95th percentile broke, as the breaking point, in a file kept with the run. The job runs monthly and 4 weeks before each announced peak event.',
      tool: 'Grafana k6 in a scheduled job',
      language: 'js',
      snippet: `// k6 run --env BASE_URL=https://staging.shop.example breaking-point.js   (monthly, and 4 weeks before a peak event)
import http from 'k6/http'
import exec from 'k6/execution'

const NORMAL = {{EXPECTED_RPS}}
const PEAK = NORMAL * {{PEAK_FACTOR}}
const STAGES = [
  { target: PEAK, minutes: 5 },         // ramp to the peak
  { target: PEAK * 1.5, minutes: 10 },  // on to 1.5 x the peak: capacity must hold here
  { target: PEAK * 3, minutes: 15 },    // on to 3 x the peak: find where it breaks
]
const BANDS = ['1.5-2', '2-2.5', '2.5-3']

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-arrival-rate', startRate: NORMAL, timeUnit: '1s', preAllocatedVUs: 500, maxVUs: 10000,
      stages: STAGES.map((s) => ({ target: s.target, duration: \`\${s.minutes}m\` })),
    },
  },
  thresholds: {
    'http_req_duration{band:upto1.5}': ['p(95)<{{P95_MS}}'],
    'http_req_failed{band:upto1.5}': ['rate<0.001'],
    // the bands above 1.5 x are recorded, not asserted (a threshold makes k6 report the sub-metric)
    'http_req_duration{band:1.5-2}': ['p(95)>=0'],
    'http_req_duration{band:2-2.5}': ['p(95)>=0'],
    'http_req_duration{band:2.5-3}': ['p(95)>=0'],
  },
}

/** The arrival rate at a moment of the ramp, in requests per second. */
function rateAt(seconds) {
  let start = 0
  let from = NORMAL
  for (const s of STAGES) {
    const d = s.minutes * 60
    if (seconds <= start + d) return from + ((s.target - from) * (seconds - start)) / d
    start += d
    from = s.target
  }
  return from
}

export default function () {
  const rate = rateAt(exec.instance.currentTestRunDuration / 1000)
  const band = rate <= PEAK * 1.5 ? 'upto1.5' : rate <= PEAK * 2 ? '1.5-2' : rate <= PEAK * 2.5 ? '2-2.5' : '2.5-3'
  http.get(\`\${__ENV.BASE_URL}/orders?page=1\`, { tags: { band } })
}

export function handleSummary(data) {
  const p95 = (band) => (data.metrics[\`http_req_duration{band:\${band}}\`] || { values: {} }).values['p(95)']
  const broken = BANDS.find((b) => (p95(b) || 0) > {{P95_MS}})
  const line = broken ? \`breaking point: between \${broken} x the peak\` : 'breaking point: not reached below 3 x the peak'
  return {
    stdout: line + '\\n',
    'breaking-point.json': JSON.stringify({ date: new Date().toISOString(), peakRps: PEAK, broken: broken || null, p95ByBand: BANDS.map((b) => [b, p95(b)]) }),
  }
}`,
    },
    {
      id: 'ff-headroom', label: 'Headroom watched', when: { SCALING: ['fixed'] }, category: 'operational', implements: ['adr-fixed'],
      checks: ['req-headroom'],
      threshold: 'The highest hourly average of CPU and of memory use in the last 7 days at most 70 % of what is provisioned; above it, a ticket alert',
      description: 'Recording rules compute the element\'s CPU and memory use as a share of its requests (container-level series only, so the pod-level and pause-container series are not counted twice); an alert takes the highest hourly average of the last 7 days for each and opens a capacity ticket above 70 %.',
      tool: 'Prometheus recording and alerting rules (kube-state-metrics and cAdvisor metrics)',
      language: 'yaml',
      snippet: `groups:
  - name: capacity
    rules:
      - record: order_api:cpu_use:ratio
        expr: |
          sum(rate(container_cpu_usage_seconds_total{namespace="shop",pod=~"order-api-.*",container!="",container!="POD"}[5m]))
          / sum(kube_pod_container_resource_requests{namespace="shop",pod=~"order-api-.*",resource="cpu"})
      - record: order_api:memory_use:ratio
        expr: |
          sum(container_memory_working_set_bytes{namespace="shop",pod=~"order-api-.*",container!="",container!="POD"})
          / sum(kube_pod_container_resource_requests{namespace="shop",pod=~"order-api-.*",resource="memory"})
      - alert: OrderApiHeadroomLow
        expr: |
          max_over_time(avg_over_time(order_api:cpu_use:ratio[1h])[7d:1h]) > 0.70
          or max_over_time(avg_over_time(order_api:memory_use:ratio[1h])[7d:1h]) > 0.70
        labels: { severity: ticket }
        annotations:
          summary: "Order API used over 70 % of its provisioned CPU or memory at the week's busiest hour: plan a capacity change"`,
    },
    {
      id: 'ff-hpa-behaviour', label: 'Autoscaler bounds and scale-in delay', when: { SCALING: ['horizontal'] }, category: 'structural', implements: ['adr-autoscale'],
      checks: ['req-autoscale'],
      threshold: 'The HorizontalPodAutoscaler has minReplicas at least 2, maxReplicas set, and a scale-down stabilization window of at least 900 s',
      description: 'A policy over the Kubernetes manifests fails the pipeline when the element\'s autoscaler could run a single instance, has no ceiling, or scales in sooner than 15 minutes after the load drops. ECS and Container Apps have the same three settings in their scale rules.',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `package main

import rego.v1

deny contains msg if {
  input.kind == "HorizontalPodAutoscaler"
  object.get(input.spec, "minReplicas", 1) < 2
  msg := sprintf("%s: minReplicas must be at least 2 (the normal load with one zone lost)", [input.metadata.name])
}

deny contains msg if {
  input.kind == "HorizontalPodAutoscaler"
  not input.spec.maxReplicas
  msg := sprintf("%s: set maxReplicas (1.5 x the peak, within the database's connection cap)", [input.metadata.name])
}

deny contains msg if {
  input.kind == "HorizontalPodAutoscaler"
  object.get(input.spec, ["behavior", "scaleDown", "stabilizationWindowSeconds"], 300) < 900
  msg := sprintf("%s: set behavior.scaleDown.stabilizationWindowSeconds to 900 or more", [input.metadata.name])
}`,
    },
    {
      id: 'ff-autoscale-ceiling', label: 'Autoscaling not at its ceiling', when: { SCALING: ['horizontal'] }, category: 'operational', implements: ['adr-autoscale'],
      checks: ['req-autoscale'],
      threshold: 'The autoscaler sits at its maximum replicas for no more than 15 minutes in a row',
      description: 'A Prometheus alert fires when the HorizontalPodAutoscaler has run at its maximum for 15 minutes: the ceiling is too low or the load is beyond plan, and someone decides which.',
      tool: 'Prometheus alerting rule over kube-state-metrics',
      language: 'yaml',
      snippet: `groups:
  - name: autoscaling
    rules:
      - alert: OrderApiAtMaxReplicas
        expr: |
          kube_horizontalpodautoscaler_status_current_replicas{namespace="shop",horizontalpodautoscaler="order-api"}
            >= kube_horizontalpodautoscaler_spec_max_replicas{namespace="shop",horizontalpodautoscaler="order-api"}
        for: 15m
        labels: { severity: page }
        annotations:
          summary: "Order API has been at its maximum replicas for 15 minutes"`,
    },
    {
      id: 'ff-pool-cap', label: 'Replicas times pool size within the cap', when: { SCALING: ['horizontal'] }, category: 'structural', implements: ['adr-autoscale'],
      checks: ['req-downstream'],
      threshold: 'maxReplicas of the autoscaler times the connection pool size per instance (DB_POOL_SIZE) is at most {{CONCURRENCY_CAP}}',
      description: 'A policy over the Kubernetes manifests, run with conftest --combine so that it sees the autoscaler and the Deployment together, fails the pipeline when the most instances the autoscaler may run, times the pool size each is configured with, exceeds what the database accepts from the element.',
      tool: 'Conftest (Open Policy Agent), conftest test --combine k8s/',
      language: 'rego',
      snippet: `package main

import rego.v1

deny contains msg if {
  some hpa in input
  hpa.contents.kind == "HorizontalPodAutoscaler"
  some dep in input
  dep.contents.kind == "Deployment"
  dep.contents.metadata.name == hpa.contents.spec.scaleTargetRef.name
  some c in dep.contents.spec.template.spec.containers
  some e in c.env
  e.name == "DB_POOL_SIZE"
  connections := hpa.contents.spec.maxReplicas * to_number(e.value)
  connections > {{CONCURRENCY_CAP}}
  msg := sprintf("%s: %d replicas x pool %s = %d connections, above the cap the database accepts", [dep.contents.metadata.name, hpa.contents.spec.maxReplicas, e.value, connections])
}`,
    },
    {
      id: 'ff-serverless-throttles', label: 'Throttled only at our cap', when: { SCALING: ['serverless'] }, category: 'operational', implements: ['adr-serverless'],
      checks: ['req-downstream'],
      threshold: '0 throttled invocations in any 5 minutes while concurrency is under 90 % of {{CONCURRENCY_CAP}}; concurrency under 80 % of {{CONCURRENCY_CAP}} for all but 5 minutes',
      description: 'The function\'s reserved concurrency is the cap; throttling at it is the overload rule working. Two CloudWatch alarms in Terraform: one on concurrent executions sustained above 80 % of the cap (raise the cap, or the database\'s limit), and one on throttles that happen while concurrency is still under 90 % of the cap, which means the account or region limit throttled first and must be raised. Cloud Run and Azure Functions expose the same two metrics in Cloud Monitoring and Azure Monitor.',
      tool: 'Amazon CloudWatch alarms in Terraform (metric math)',
      language: 'hcl',
      snippet: `resource "aws_lambda_function" "order_api" {
  function_name                  = "order-api"
  # ...
  reserved_concurrent_executions = {{CONCURRENCY_CAP}}   # what the database accepts through the pooler
}

resource "aws_cloudwatch_metric_alarm" "order_api_concurrency_near_cap" {
  alarm_name          = "order-api-concurrency-80pct"
  namespace           = "AWS/Lambda"
  metric_name         = "ConcurrentExecutions"
  dimensions          = { FunctionName = aws_lambda_function.order_api.function_name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = {{CONCURRENCY_CAP}} * 0.8
  comparison_operator = "GreaterThanThreshold"
}

resource "aws_cloudwatch_metric_alarm" "order_api_throttled_below_cap" {
  alarm_name          = "order-api-throttled-below-cap"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  metric_query {
    id          = "below_cap"
    expression  = "IF(concurrency < {{CONCURRENCY_CAP}} * 0.9, throttles, 0)"
    label       = "throttles while under 90 % of our cap: the account limit throttled, not us"
    return_data = true
  }
  metric_query {
    id = "throttles"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Throttles"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = aws_lambda_function.order_api.function_name }
    }
  }
  metric_query {
    id = "concurrency"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "ConcurrentExecutions"
      period      = 300
      stat        = "Maximum"
      dimensions  = { FunctionName = aws_lambda_function.order_api.function_name }
    }
  }
}`,
    },
    {
      id: 'ff-cold-start', label: 'Burst after idle answered in time', when: { SCALING: ['serverless'] }, category: 'operational', implements: ['adr-serverless'],
      checks: ['req-cold-start'],
      threshold: 'After 15 idle minutes, a 2-minute burst at {{PEAK_FACTOR}} times {{EXPECTED_RPS}} requests per second has every request answered within 1000 ms and fewer than 0.1 % errors',
      description: 'A nightly job waits until the element has been idle at its minimum instances for 15 minutes, then runs a k6 burst at the peak rate; the slowest request, cold starts included, must answer within a second. On AWS, the InitDuration in the function\'s logs says how much of it was the start.',
      tool: 'Grafana k6 in a scheduled job',
      language: 'js',
      snippet: `// k6 run --env BASE_URL=https://staging.shop.example cold-start.js   (nightly, after 15 idle minutes)
import http from 'k6/http'

export const options = {
  scenarios: {
    burst: { executor: 'constant-arrival-rate', rate: {{PEAK_FACTOR}} * {{EXPECTED_RPS}}, timeUnit: '1s', duration: '2m', preAllocatedVUs: 500, maxVUs: 5000 },
  },
  thresholds: {
    http_req_duration: ['max<1000'],   // the slowest request, cold start included
    http_req_failed: ['rate<0.001'],
  },
}

export default function () {
  http.get(\`\${__ENV.BASE_URL}/orders?page=1\`)
}`,
    },
    {
      id: 'ff-shed', label: 'Overload is shed fast', when: SHED, category: 'operational', implements: ['adr-shed'],
      checks: ['req-shed'],
      threshold: 'At twice the peak: refused requests answered with 503 in under 50 ms (95th percentile), accepted ones under {{P95_MS}} ms, and nothing but 200 or 503',
      description: 'A k6 overload test drives twice the peak and checks two things separately: refusals are fast 503s, and the requests that were accepted kept their latency. A service that slows everything down instead fails the test.',
      tool: 'Grafana k6',
      language: 'js',
      snippet: `import http from 'k6/http'
import { Trend } from 'k6/metrics'

const accepted = new Trend('accepted_duration', true)
const refused = new Trend('refused_duration', true)

export const options = {
  scenarios: {
    overload: { executor: 'constant-arrival-rate', rate: 2 * {{PEAK_FACTOR}} * {{EXPECTED_RPS}}, timeUnit: '1s',
                duration: '10m', preAllocatedVUs: 500, maxVUs: 5000 },
  },
  thresholds: {
    accepted_duration: ['p(95)<{{P95_MS}}'],
    refused_duration: ['p(95)<50'],
    http_req_failed: ['rate<0.001'],   // anything but 200 or 503
  },
}

http.setResponseCallback(http.expectedStatuses(200, 503))

export default function () {
  const res = http.get(\`\${__ENV.BASE_URL}/orders?page=1\`)
  ;(res.status === 503 ? refused : accepted).add(res.timings.duration)
}`,
    },
    {
      id: 'ff-backlog', label: 'Backlog drains, dead letters seen', when: QUEUE, category: 'operational', implements: ['adr-backpressure'],
      checks: ['req-backpressure'],
      threshold: 'The queue\'s ready messages grow for no more than 15 minutes in a row; the dead-letter queue holds messages for no more than 5 minutes before a ticket',
      description: 'Two Prometheus alerts over RabbitMQ\'s per-queue metrics: one fires when the work queue has kept growing for 15 minutes, meaning the workers cannot keep up even after scaling; the other opens a ticket when the dead-letter queue is not empty. The queue is declared with x-max-length and x-overflow reject-publish, so a full queue refuses the publish. With Kafka the first rule reads kafka_consumergroup_lag from kafka_exporter; with SQS, ApproximateAgeOfOldestMessage in CloudWatch.',
      tool: 'Prometheus alerting rules over the RabbitMQ Prometheus plugin (/metrics/detailed, family queue_coarse_metrics)',
      language: 'yaml',
      snippet: `# prometheus.yml: scrape the per-queue metrics
#   - job_name: rabbitmq-queues
#     metrics_path: /metrics/detailed
#     params: { family: [queue_coarse_metrics] }
#     static_configs: [{ targets: ["rabbitmq.shop:15692"] }]
groups:
  - name: backpressure
    rules:
      - alert: OrderWorkersFallingBehind
        expr: deriv(sum(rabbitmq_detailed_queue_messages_ready{queue="orders"})[15m:1m]) > 0
        for: 15m
        labels: { severity: page }
        annotations:
          summary: "The orders queue has grown for 15 minutes: workers cannot keep up even after scaling"
      - alert: OrderDeadLetters
        expr: sum(rabbitmq_detailed_queue_messages_ready{queue="orders.dlq"}) > 0
        for: 5m
        labels: { severity: ticket }
        annotations:
          summary: "Messages in the orders dead-letter queue: work that failed repeatedly needs a look"`,
    },
  ],
}

export default pack
