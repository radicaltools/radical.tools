import type { PackSpec, When } from '../../src/packSpec'

const DEFAULT_ADRS = ['adr-sync', 'adr-commands', 'adr-events', 'adr-streams']
const ASYNC: When = { DEFAULT: ['commands', 'events', 'streams'] }
const PUBLISHED: When = { DEFAULT: ['events', 'streams'] }
const FORCES = 'The system\'s own parts (services, modules, front ends and back ends) have to ask each other for data and to get things done. How they do it decides how they fail together. The forces: a synchronous call ties the caller to the callee being up and fast at that moment (temporal coupling), and a chain of them multiplies latency and the odds that one link is down; asynchronous messages decouple in time but make the result arrive later and the flow harder to follow; events let parts react without the publisher knowing them, until nobody can tell what happens after an order is placed; a flow across parts needs either a coordinator that knows every step or a chain of reactions nobody owns; and parts are released apart, so every interaction is a contract that must not break. Delivery guarantees of a queue are the Messaging pack, and calls to systems outside are Integration resilience.'

const pack: PackSpec = {
  id: 'concern-communication-style',
  name: 'Communication style',
  group: 'architecture',
  description: 'How the system\'s own parts talk to each other: synchronous calls, commands over queues, published events or streams; when to deviate from the default, how deep a chain of calls may go, how contracts are written and checked, and who coordinates a flow across parts.',
  tags: ['architecture', 'communication', 'rest', 'grpc', 'messaging', 'events', 'event-driven', 'streaming', 'choreography', 'orchestration', 'asyncapi'],
  concern: {
    id: 'communication-style',
    trigger: 'LIST RELATIONS WHERE source.external != true AND target.external != true AND (source.type = "container" OR source.type = "webapp" OR source.type = "component") AND (target.type = "container" OR target.type = "component" OR target.type = "queue")',
    applyTo: 'source',
    why: 'these parts of the system call or message other parts of it, so how they talk, and how they fail together, has to be decided.',
  },
  sources: [
    { title: 'Martin Fowler: What do you mean by "Event-Driven"?', url: 'https://martinfowler.com/articles/201701-event-driven.html' },
    { title: 'microservices.io, Messaging', url: 'https://microservices.io/patterns/communication-style/messaging.html' },
    { title: 'microservices.io, Remote Procedure Invocation', url: 'https://microservices.io/patterns/communication-style/rpi.html' },
    { title: 'microservices.io, Saga (choreography and orchestration)', url: 'https://microservices.io/patterns/data/saga.html' },
    { title: 'Enterprise Integration Patterns', url: 'https://www.enterpriseintegrationpatterns.com/' },
    { title: 'AsyncAPI Specification', url: 'https://www.asyncapi.com/docs/reference/specification/latest' },
    { title: 'gRPC, Deadlines', url: 'https://grpc.io/docs/guides/deadlines/' },
    { title: 'Google SRE book, Addressing Cascading Failures', url: 'https://sre.google/sre-book/addressing-cascading-failures/' },
    { title: 'Sam Newman: Building Microservices, 2nd ed. (O\'Reilly)', url: 'https://www.oreilly.com/library/view/building-microservices-2nd/9781492034018/' },
  ],
  questions: [
    {
      key: 'DEFAULT', title: 'Default style', label: 'How do the system\'s parts talk to each other by default?',
      hint: 'The default is what a new interaction uses without a discussion; an exception needs a reason recorded. It decides how much one part being slow or down affects the others.',
      default: 'events',
      options: [
        { value: 'sync', label: 'synchronous request and response', description: 'A part calls another and waits for the answer. Pick it for a modular monolith or a few services, when most interactions are queries that need an answer now, and every part on a chain has the availability the caller needs.' },
        { value: 'commands', label: 'commands over queues', description: 'A part asks another to do something by sending a command to the receiver\'s queue and learns the outcome from a reply later; queries stay synchronous. Pick it when work takes longer than a user should wait (documents, payments, provisioning), the receiver may be down for a while, or load comes in bursts.' },
        { value: 'events', label: 'published events (pub/sub)', description: 'Each part publishes events about its own changes, carrying the data others need; others subscribe, keep their own copies and answer from them. Pick it for services owned by several teams, where many parts react to the same facts and a part should keep working while another is down.' },
        { value: 'streams', label: 'event streams (a replayable log)', description: 'Parts write events to a durable, partitioned log that consumers read at their own pace and can replay from the start to build new views. Pick it for high volume (thousands of events a second), analytics and read models rebuilt from history, or stream processing (Kafka Streams, Flink).' },
      ],
    },
    {
      key: 'SYNC_API', title: 'Calls', label: 'How are synchronous calls between parts made?',
      hint: 'Every default leaves some synchronous calls (queries at least, and the front end calling its back end). This decides their protocol and contract format; messages are described in AsyncAPI either way.',
      default: 'rest',
      options: [
        { value: 'rest', label: 'HTTP and JSON described in OpenAPI', description: 'Resource-style HTTP with JSON, contracts in OpenAPI 3.1. Pick it when browsers or many languages call, people need to read and try the API, or call volume is moderate.' },
        { value: 'grpc', label: 'gRPC described in Protocol Buffers', description: 'Binary calls over HTTP/2 with generated clients, contracts in .proto files, deadlines built in, streaming available. Pick it for high-volume service-to-service calls where both sides use generated code; browsers need gRPC-Web or a gateway.' },
      ],
    },
    {
      key: 'FLOWS', title: 'Multi-step flows', label: 'Who coordinates a business flow that spans several parts?',
      hint: 'Placing an order may reserve stock, take payment and book shipping in three parts. Someone has to know the steps, and what to undo when one fails (all-or-nothing semantics are the Data consistency pack).',
      default: 'orchestration',
      options: [
        { value: 'orchestration', label: 'an orchestrator runs each flow', description: 'A workflow engine (Temporal, Camunda, AWS Step Functions) runs each flow as code or a model: it calls each part, keeps the state, retries and compensates. Pick it for flows with more than three steps, branches, timeouts or human tasks, or when someone must see where each instance is.' },
        { value: 'choreography', label: 'parts react to each other\'s events', description: 'No coordinator: each part reacts to events of others and publishes its own. Pick it for short flows (up to three steps) where each reaction belongs to a different team, with events as the default; longer flows become hard to follow.' },
        { value: 'local', label: 'no flow spans parts', description: 'Every business operation completes inside one part and one local transaction; boundaries are drawn so that this holds. Pick it for a monolith or modular monolith, or services cut so that no operation needs two of them.' },
      ],
    },
    {
      key: 'CONTRACTS', title: 'Contracts', label: 'How is it checked that a change does not break another part?',
      hint: 'Parts are released apart, so every call and message is a contract. A diff of the contract finds a break in the document; consumer-driven tests find a break in what consumers really use.',
      default: 'pact',
      options: [
        { value: 'spec', label: 'contract diffs on every change', description: 'The provider\'s OpenAPI, .proto or AsyncAPI document is linted and compared with the version on main; a breaking change fails the build. Pick it when consumers are many or unknown, or the teams cannot run consumer tests.' },
        { value: 'pact', label: 'consumer-driven contract tests', description: 'Each consumer records the calls and messages it relies on as pacts; every provider build verifies them, and can-i-deploy blocks a release that breaks one. Pick it when the consuming parts are known teams who run Pact in their builds.' },
      ],
    },
  ],
  details: [
    { key: 'MAX_DEPTH', label: 'How many synchronous calls deep may a chain between parts go?', default: '2', number: true },
    { key: 'CALL_BUDGET_MS', label: 'How long may a user request spend in calls between parts, at the 99th percentile (milliseconds)?', default: '800', number: true },
    { key: 'PROPAGATION_SECONDS', label: 'Within how many seconds must a command\'s outcome or an event reach the parts that act on it (99th percentile)?', default: '10', number: true },
    { key: 'RETENTION_DAYS', label: 'For how many days at least does the event log keep events?', default: '7', number: true },
    { key: 'FLOW_MINUTES', label: 'Within how many minutes must a flow across parts finish or be reported stuck?', default: '15', number: true },
  ],
  need: {
    label: 'Parts talk without failing together',
    text: 'The system\'s parts depend on each other for data and for work. When one is slow or down, the others should degrade in a known way instead of stalling in a chain of waiting calls; when one changes, the others should not break; and when a business flow runs across several parts, someone should be able to tell where it stands and what happens when a step fails. That needs a default way of talking, known exceptions, contracts for every interaction, and limits that the build and the monitoring check.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-default', label: 'One default, recorded exceptions', ears_type: 'ubiquitous',
      action: 'use {{DEFAULT}} for every interaction between the system\'s own parts and record each exception in an ADR with its reason, with 0 interactions in the model that are neither the default nor a recorded exception',
      rationale: 'Mixing styles case by case makes failure behaviour unpredictable; a default with recorded exceptions keeps it decidable (Newman, Building Microservices, ch. 4).',
      scenario: { label: 'Exception is recorded', given: 'the interactions between parts in the model, each with its style', when: 'they are compared with the default and the ADRs', then: 'each one either uses the default or is named by an ADR with its reason' },
    },
    {
      id: 'req-depth', label: 'Call chains stay short', ears_type: 'ubiquitous',
      action: 'keep every chain of synchronous calls between the system\'s own parts at most {{MAX_DEPTH}} calls deep, with 0 cycles of calls',
      rationale: 'Each synchronous hop multiplies latency and the chance that one link is down, and cycles of calls turn overload into cascading failure (Google SRE book, Addressing Cascading Failures).',
      scenario: { label: 'Deep chain found', given: 'traces of the user journeys', when: 'the synchronous calls between parts are followed from each request', then: 'no chain is deeper than {{MAX_DEPTH}} and no part calls itself through others' },
    },
    {
      id: 'req-contracts', label: 'Every interaction has a contract', ears_type: 'ubiquitous',
      action: 'describe every interaction between parts in a contract owned by the providing part ({{SYNC_API}} for calls, AsyncAPI 3.0 for commands and events) and generate clients, stubs or message types from it, with 0 interactions without a contract',
      rationale: 'Parts released apart need a machine-checkable agreement; hand-written clients drift from what the provider serves (AsyncAPI Specification; microservices.io, Messaging).',
      scenario: { label: 'Contract for each interaction', given: 'the interactions between parts in the model', when: 'each is looked up in the providers\' contracts', then: 'every call is in an OpenAPI or .proto file and every message in an AsyncAPI document' },
    },
    {
      id: 'req-deadline', label: 'Calls carry a deadline', when: { DEFAULT: ['sync'] }, ears_type: 'event-driven',
      trigger: 'a part calls another part synchronously',
      action: 'pass the remaining deadline of the user\'s request with the call and give up when it has passed, so that a user request spends at most {{CALL_BUDGET_MS}} ms in calls between parts at the 99th percentile',
      rationale: 'With synchronous calls as the default, deadline propagation stops a slow part from holding every caller above it (gRPC, Deadlines; Google SRE book, Addressing Cascading Failures).',
      scenario: { label: 'Expired deadline stops', given: 'a request whose deadline has 50 ms left', when: 'the first part calls a second that takes 500 ms', then: 'the call is cancelled after 50 ms, the second part stops working on it, and the user gets a timely error' },
    },
    {
      id: 'req-commands', label: 'Commands answered later', when: { DEFAULT: ['commands'] }, ears_type: 'event-driven',
      trigger: 'a part needs another to do something whose result it does not need to answer its own caller',
      action: 'send it as a command to the receiving part\'s queue, answer its caller with the command\'s id without waiting, and receive the outcome as a reply within {{PROPAGATION_SECONDS}} seconds at the 99th percentile while the receiver is up',
      rationale: 'A command over a queue lets the sender carry on while the receiver is busy or down; each queue has one owner that executes its commands (Enterprise Integration Patterns, Command Message; microservices.io, Messaging).',
      scenario: { label: 'Command accepted and answered', given: 'the inventory part and its command queue', when: 'ordering sends a reserve-stock command while inventory is up, and again while it is down', then: 'ordering answers its caller at once both times; the first reply arrives within {{PROPAGATION_SECONDS}} seconds, the second after inventory is back' },
    },
    {
      id: 'req-events', label: 'Parts answer from own data', when: PUBLISHED, ears_type: 'ubiquitous',
      action: 'publish an event after every committed change other parts depend on, carrying the state they need, and answer user requests from the part\'s own data, with 0 synchronous calls to another part on a user\'s request path outside the recorded exceptions',
      rationale: 'Event-carried state transfer removes the temporal coupling: a part keeps answering while the publisher is down (Fowler, What do you mean by "Event-Driven"?).',
      scenario: { label: 'Publisher down, reader works', given: 'shipping keeping a copy of the order data it needs from ordering\'s events', when: 'ordering is stopped and a user asks shipping for a delivery', then: 'shipping answers from its own copy' },
    },
    {
      id: 'req-propagation', label: 'Events arrive in time', when: PUBLISHED, ears_type: 'event-driven',
      trigger: 'a part publishes an event',
      action: 'apply it in every subscribing part within {{PROPAGATION_SECONDS}} seconds at the 99th percentile',
      rationale: 'Copies kept from events are eventually consistent; bounding how long that takes makes it a requirement instead of a surprise (microservices.io, Messaging).',
      scenario: { label: 'Copy catches up', given: 'shipping subscribed to ordering\'s events', when: 'an order\'s address changes', then: 'shipping\'s copy shows the new address within {{PROPAGATION_SECONDS}} seconds' },
    },
    {
      id: 'req-replay', label: 'Events can be replayed', when: { DEFAULT: ['streams'] }, ears_type: 'ubiquitous',
      action: 'keep every event in a log partitioned by entity key for at least {{RETENTION_DAYS}} days (topics holding current state compacted instead), so that a new or repaired consumer builds its view by reading from the start',
      rationale: 'Replay is what a stream offers over a queue: views can be rebuilt and new consumers added without asking the producers (Fowler, What do you mean by "Event-Driven"?, event sourcing and streams).',
      scenario: { label: 'View rebuilt by replay', given: 'a consumer whose view was lost', when: 'it is reset to the start of the log', then: 'it rebuilds the view from the retained events without any producer being involved' },
    },
    {
      id: 'req-orchestrated', label: 'Flows run in the orchestrator', when: { FLOWS: ['orchestration'] }, ears_type: 'ubiquitous',
      action: 'run every business flow that spans more than one part as a workflow in the orchestrator, with each instance\'s current step and history visible, a compensation declared for every step that changes data, and the flow finished or compensated within {{FLOW_MINUTES}} minutes',
      rationale: 'An orchestrator keeps the steps of a flow in one place and its state visible per instance (microservices.io, Saga: orchestration).',
      scenario: { label: 'Failed step compensated', given: 'the place-order workflow with reserve stock, take payment and book shipping', when: 'the payment is declined', then: 'the workflow releases the stock, ends as failed, and its history shows each step' },
    },
    {
      id: 'req-choreographed', label: 'Choreographed flows are traced', when: { FLOWS: ['choreography'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a flow that spans parts has started and not reached its end event within {{FLOW_MINUTES}} minutes',
      action: 'report it as stuck with its correlation id and the last event seen, and alert the team that owns the part that should have reacted',
      rationale: 'Without a coordinator nobody notices a flow that stops halfway; a monitor of the event chain gives it an owner (microservices.io, Saga: choreography).',
      scenario: { label: 'Stuck flow reported', given: 'an order placed and its stock reserved', when: 'no payment event follows within {{FLOW_MINUTES}} minutes', then: 'the flow is reported stuck with its correlation id and the payment team is alerted' },
    },
    {
      id: 'req-local-flows', label: 'Operations stay in one part', when: { FLOWS: ['local'] }, ears_type: 'ubiquitous',
      action: 'complete every business operation inside one part and one local transaction, with 0 operations that change data in two parts',
      rationale: 'A flow that stays inside one part needs neither a coordinator nor compensation; boundaries are drawn to keep it so (Newman, Building Microservices, ch. 6).',
      scenario: { label: 'Operation stays local', given: 'the operations that change data', when: 'each is traced', then: 'each changes the data of one part only, in one transaction' },
    },
    {
      id: 'req-contract-diff', label: 'Breaking changes refused', when: { CONTRACTS: ['spec'] }, ears_type: 'event-driven',
      trigger: 'a change to a contract between parts is proposed',
      action: 'lint it against the house rules and compare it with the contract on the main branch, and refuse to merge a change that would break an existing consumer',
      rationale: 'A break found in the pull request is cheap; found in production it stops the consuming part (Building Evolutionary Architectures, atomic fitness functions).',
      scenario: { label: 'Removed field refused', given: 'an event contract with a field consumers read', when: 'a change removes that field', then: 'the build fails naming the breaking change' },
    },
    {
      id: 'req-pacts', label: 'Consumers\' pacts verified', when: { CONTRACTS: ['pact'] }, ears_type: 'event-driven',
      trigger: 'a part is about to be deployed',
      action: 'verify it against every pact its consumers have published, for calls and for messages, and deploy it only when every pact of the consumer versions in production passes',
      rationale: 'Consumer-driven contracts test what consumers really use, so a provider can change everything else freely (microservices.io, Service Integration Contract Test).',
      scenario: { label: 'Breaking deploy blocked', given: 'a consumer in production whose pact reads a field', when: 'the provider removes the field and tries to deploy', then: 'verification fails and can-i-deploy blocks the release' },
    },
  ],
  adrs: [
    {
      id: 'adr-sync', label: 'Synchronous calls by default', when: { DEFAULT: ['sync'] },
      decision: 'Parts talk by synchronous request and response by default: {{SYNC_API}} (Spring\'s RestClient or grpc-java, .NET\'s typed HttpClient or Grpc.Net.Client, fetch or @connectrpc in TypeScript), with clients generated from the contracts. Every call carries the remaining deadline of the user\'s request (gRPC deadlines, or a request-timeout header the server honours); a user request spends at most {{CALL_BUDGET_MS}} ms in calls between parts and a chain is at most {{MAX_DEPTH}} calls deep. A command over a queue or an event is used instead, recorded as an exception, when the caller does not need the result to answer, the work takes longer than the budget, several parts react, or the callee may be down longer than the caller can wait. Flows across parts: {{FLOWS}}. Contract checks: {{CONTRACTS}}.',
      consequences: '• Simplest to write, follow and debug: one request, one trace, an answer or an error.\n• The caller is only as available as everything it calls: availabilities multiply along a chain, hence the depth limit.\n• Overload spreads upstream unless deadlines and load shedding stop it.\n• Work that takes long or must survive a callee being down needs the recorded exceptions.',
      alternatives: '1. Commands over queues: callers do not wait, at the cost of answering later.\n2. Published events: no temporal coupling, at the cost of copies and eventual consistency.\n3. A service mesh to add retries and timeouts: helps, but does not remove the coupling of waiting.',
    },
    {
      id: 'adr-commands', label: 'Commands over queues by default', when: { DEFAULT: ['commands'] },
      decision: 'A part that needs another to do something sends a command to that part\'s own queue (RabbitMQ or Azure Service Bus queues, Amazon SQS; one owning part per queue) and answers its own caller with the command\'s id; the receiver replies with an outcome event the sender correlates by id, within {{PROPAGATION_SECONDS}} seconds at the 99th percentile while it is up. Queries that need an answer now stay synchronous ({{SYNC_API}}), at most {{MAX_DEPTH}} calls deep. Messages are described in AsyncAPI; delivery guarantees, deduplication and dead-lettering follow the Messaging pack. Flows across parts: {{FLOWS}}. Contract checks: {{CONTRACTS}}.',
      consequences: '• Senders keep working while a receiver is busy or down; bursts wait in the queue.\n• Users see an accepted state and the outcome later, so screens and APIs must show pending work.\n• Each queue has one owner, so who executes a command is never in doubt.\n• Following a request means following a correlation id across messages.',
      alternatives: '1. Synchronous calls: immediate answers, coupled availability.\n2. Published events: receivers decide what to do, no one is told to do anything.\n3. A shared job table polled by workers: no broker, but a database used as a queue.',
    },
    {
      id: 'adr-events', label: 'Published events by default', when: { DEFAULT: ['events'] },
      decision: 'Each part publishes events about its own committed changes (through an outbox, as CloudEvents described in AsyncAPI) carrying the state its subscribers need; subscribers keep their own copies and answer user requests from them. Events go through a publish-subscribe broker: Apache Kafka for many subscribers and replay, Amazon SNS with SQS or Google Pub/Sub on those clouds, Azure Service Bus topics on Azure. Copies are updated within {{PROPAGATION_SECONDS}} seconds at the 99th percentile. A command to one specific part goes to that part\'s queue; a synchronous call ({{SYNC_API}}, at most {{MAX_DEPTH}} deep) is a recorded exception for an answer only its owner can give now, such as a payment authorisation. Flows across parts: {{FLOWS}}. Contract checks: {{CONTRACTS}}.',
      consequences: '• A part keeps answering while the parts it depends on are down: no temporal coupling on the user path.\n• Data is copied and eventually consistent; screens and rules must tolerate {{PROPAGATION_SECONDS}} seconds of lag.\n• Publishers do not know their subscribers; what happens after an event is visible only in the contracts and traces.\n• Event schemas become long-lived contracts that need versioning.',
      alternatives: '1. Synchronous calls: simpler, coupled availability.\n2. Commands over queues: the sender decides what happens, coupling it to the receivers.\n3. Event notification without state (subscribers call back for data): smaller events, but the temporal coupling returns.',
    },
    {
      id: 'adr-streams', label: 'Event streams by default', when: { DEFAULT: ['streams'] },
      decision: 'Parts write their events to a durable, partitioned log (Apache Kafka, Confluent Cloud, Amazon MSK, Redpanda; Amazon Kinesis or Azure Event Hubs where a managed cloud log is preferred), keyed by entity so that order holds per entity, retained for at least {{RETENTION_DAYS}} days, with topics holding current state compacted. Consumers read at their own pace, keep their own views (Kafka Streams, Apache Flink or plain consumers) and can rebuild them by replaying from the start; events reach every consumer within {{PROPAGATION_SECONDS}} seconds at the 99th percentile. Synchronous calls ({{SYNC_API}}, at most {{MAX_DEPTH}} deep) are recorded exceptions. Flows across parts: {{FLOWS}}. Contract checks: {{CONTRACTS}}.',
      consequences: '• New consumers and new views are added without asking producers, by replaying history.\n• High throughput, with order per key and parallelism per partition.\n• A cluster to run (or pay for) and partitions to size; consumer lag becomes a key metric.\n• Events in the log live for days or forever, so their schemas must stay readable for that long.',
      alternatives: '1. Published events through a pub/sub broker without replay: simpler, but views cannot be rebuilt from history.\n2. Commands over queues: work distribution, not a history.\n3. Change data capture from each database: no code to publish, but internal tables become the contract.',
    },
    {
      id: 'adr-orchestration', label: 'Flows run by an orchestrator', when: { FLOWS: ['orchestration'] },
      decision: 'Every business flow across parts runs as a workflow in an orchestrator: Temporal for flows written as code, Camunda 8 where the flow is modelled in BPMN with business people, AWS Step Functions on AWS. The workflow calls each part\'s commands, keeps the state and history of each instance, retries steps with backoff, waits on timers and human tasks, and runs a declared compensation for every completed step that changed data when a later one fails (saga semantics as in the Data consistency pack). A flow finishes or is compensated within {{FLOW_MINUTES}} minutes. The workflow belongs to the part that owns the business outcome.',
      consequences: '• Each flow is written in one place and each instance\'s state is visible and searchable.\n• Timeouts, retries and compensation come from the engine instead of hand-written state machines.\n• The orchestrator is a component to run (or pay for) and must be highly available.\n• The owning part knows every step: a change to a step means changing the workflow too.',
      alternatives: '1. Choreography: no central component, but flows are visible only through tracing.\n2. Hand-written state machines in a database table: no engine, but timers, retries and history to build.\n3. Distributed transactions (two-phase commit): unsupported by most brokers and services, and blocking.',
    },
    {
      id: 'adr-choreography', label: 'Flows by choreography', when: { FLOWS: ['choreography'] },
      decision: 'Flows across parts are choreographed: each part reacts to the events of others and publishes its own, and no part coordinates the flow. Every flow is documented as an event chain (which part reacts to which event and what it publishes) in the AsyncAPI documents and a flow diagram in the model; every event carries the flow\'s correlation id. A process monitor subscribes to the start and end events of each flow and reports an instance not finished within {{FLOW_MINUTES}} minutes. A flow that grows past three steps or needs timeouts is moved to an orchestrator by a new ADR.',
      consequences: '• No central component; each team owns its reaction and changes it alone.\n• The flow exists only as the sum of reactions; without the documented chain and the monitor nobody can tell where an instance is.\n• Compensation is spread across parts, each undoing its own step on a failure event.\n• Cyclic reactions are possible and must be caught in review.',
      alternatives: '1. An orchestrator: one place for the flow and its state, at the cost of a central component.\n2. Keeping the flow in one part: no coordination at all, if the boundaries allow it.',
    },
  ],
  fitness: [
    {
      id: 'ff-depth', label: 'Call chains within depth', category: 'holistic', implements: DEFAULT_ADRS,
      threshold: '0 traces of the user journeys with more than {{MAX_DEPTH}} nested synchronous calls between parts',
      description: 'The end-to-end journeys run with OpenTelemetry tracing into an in-memory exporter; the test follows each span\'s parents and counts nested HTTP and gRPC client spans (database calls are not counted). A new call that deepens a chain fails the test.',
      tool: 'Vitest with the OpenTelemetry SDK (InMemorySpanExporter)',
      language: 'ts',
      snippet: `import { SpanKind } from '@opentelemetry/api'
import { InMemorySpanExporter, SimpleSpanProcessor, type ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

const exporter = new InMemorySpanExporter()
new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).register()

it('no request goes more than {{MAX_DEPTH}} calls deep', async () => {
  await runUserJourneys() // the journeys of the end-to-end suite, against the parts started for the test
  const spans = exporter.getFinishedSpans()
  const byId = new Map(spans.map((s) => [s.spanContext().spanId, s]))
  const isCall = (s: ReadableSpan) =>
    s.kind === SpanKind.CLIENT && ('http.request.method' in s.attributes || 'rpc.system' in s.attributes)
  const depth = (s: ReadableSpan) => {
    let d = 0
    for (let p: ReadableSpan | undefined = s; p; p = byId.get(p.parentSpanContext?.spanId ?? '')) if (isCall(p)) d++
    return d
  }
  expect(Math.max(0, ...spans.map(depth))).toBeLessThanOrEqual({{MAX_DEPTH}})
})`,
    },
    {
      id: 'ff-budget', label: 'Calls within budget', when: { DEFAULT: ['sync'] }, category: 'operational', implements: ['adr-sync'],
      threshold: '99th percentile of the time a user request spends in calls between parts at most {{CALL_BUDGET_MS}} ms under the expected load',
      description: 'A k6 test drives the user journeys at the expected rate against a production-like environment; the parts tag their outgoing calls, and the threshold fails the run when the 99th percentile passes the budget.',
      tool: 'k6',
      language: 'js',
      snippet: `import http from 'k6/http'
import { check } from 'k6'

export const options = {
  scenarios: {
    journeys: { executor: 'constant-arrival-rate', rate: 50, timeUnit: '1s', duration: '10m', preAllocatedVUs: 100 },
  },
  thresholds: { 'http_req_duration{journey:order-status}': ['p(99)<{{CALL_BUDGET_MS}}'] },
}

export default function () {
  const res = http.get(\`\${__ENV.BASE_URL}/orders/\${__VU}/status\`, { tags: { journey: 'order-status' } })
  check(res, { answered: (r) => r.status === 200 })
}`,
    },
    {
      id: 'ff-command-reply', label: 'Commands accepted and answered', when: { DEFAULT: ['commands'] }, category: 'structural', implements: ['adr-commands'],
      threshold: 'A command is acknowledged at once and its outcome arrives within {{PROPAGATION_SECONDS}} seconds; a command sent while the receiver is down is answered after it is back',
      description: 'An integration test starts the broker in a container, sends a command to the receiver\'s queue and waits for the correlated reply; a second test stops the receiver first and expects the reply once it restarts.',
      tool: 'Testcontainers (RabbitMQ) with Awaitility',
      language: 'java',
      snippet: `@SpringBootTest
@Testcontainers
class ReserveStockCommandTest {
  @Container @ServiceConnection
  static RabbitMQContainer rabbit = new RabbitMQContainer("rabbitmq:4-management");

  @Autowired RabbitTemplate rabbitTemplate;
  @Autowired ReplyCollector replies; // listens on the sender's reply queue

  @Test
  void commandIsAnswered() {
    var id = UUID.randomUUID().toString();
    rabbitTemplate.convertAndSend("inventory.commands", "reserve-stock", new ReserveStock(id, "SKU-1", 2));
    await().atMost(Duration.ofSeconds({{PROPAGATION_SECONDS}}))
        .until(() -> replies.outcomeOf(id).isPresent());
  }
}`,
    },
    {
      id: 'ff-asyncapi', label: 'Message contracts valid', when: ASYNC, category: 'structural', implements: ['adr-commands', 'adr-events', 'adr-streams'],
      threshold: '0 AsyncAPI validation errors, and every queue or topic the parts use described in an AsyncAPI document',
      description: 'CI validates every part\'s AsyncAPI document and checks that each channel the code uses (read from the broker configuration) is described in one of them.',
      tool: 'AsyncAPI CLI',
      language: 'yaml',
      snippet: `# .github/workflows/contracts.yml
jobs:
  asyncapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          for doc in services/*/asyncapi.yaml; do npx -y @asyncapi/cli validate "$doc"; done
      - run: |
          # every channel in the broker config is described in some AsyncAPI document
          yq -r '.channels[].address' services/*/asyncapi.yaml | sort -u > described.txt
          yq -r '.topics[].name' platform/broker/topics.yaml | sort -u > used.txt
          comm -23 used.txt described.txt | tee undescribed.txt
          [ ! -s undescribed.txt ]`,
    },
    {
      id: 'ff-propagation', label: 'Events applied in time', when: PUBLISHED, category: 'operational', implements: ['adr-events', 'adr-streams'],
      threshold: '99th percentile of the time from publishing an event to its being applied by each subscriber at most {{PROPAGATION_SECONDS}} seconds over 10 minutes',
      description: 'Each subscriber records, for every event it applies, the seconds since the event\'s time attribute as a histogram labelled with the subscriber; an alert fires when the 99th percentile passes the limit.',
      tool: 'Prometheus alerting rule',
      language: 'yaml',
      snippet: `groups:
  - name: event-propagation
    rules:
      - alert: EventsAppliedLate
        expr: |
          histogram_quantile(0.99, sum by (le, subscriber) (rate(event_applied_delay_seconds_bucket[10m]))) > {{PROPAGATION_SECONDS}}
        for: 10m
        labels: { severity: page }
        annotations:
          summary: "{{ $labels.subscriber }} applies events later than {{PROPAGATION_SECONDS}} s"`,
    },
    {
      id: 'ff-retention', label: 'Log keeps events', when: { DEFAULT: ['streams'] }, category: 'structural', implements: ['adr-streams'],
      threshold: '0 deleting topics retaining events for less than {{RETENTION_DAYS}} days',
      description: 'Topics are declared as Strimzi KafkaTopic resources; a policy run in CI over the manifests refuses a deleting topic whose retention is shorter than the limit (compacted topics keep the latest state per key and pass).',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `package main
import rego.v1

min_ms := {{RETENTION_DAYS}} * 24 * 60 * 60 * 1000

deny contains msg if {
  input.kind == "KafkaTopic"
  cfg := object.get(input.spec, "config", {})
  object.get(cfg, "cleanup.policy", "delete") == "delete"
  retention := to_number(object.get(cfg, "retention.ms", 604800000))
  retention >= 0
  retention < min_ms
  msg := sprintf("topic %s keeps events less than {{RETENTION_DAYS}} days", [input.metadata.name])
}`,
    },
    {
      id: 'ff-openapi', label: 'Call contracts linted', when: { SYNC_API: ['rest'] }, category: 'structural', implements: DEFAULT_ADRS,
      threshold: '0 errors or warnings from the house ruleset on every OpenAPI and AsyncAPI document',
      description: 'Spectral lints every contract with the built-in OpenAPI and AsyncAPI rulesets plus house rules (operation ids, error schema, deadline header) and fails the build on a warning.',
      tool: 'Spectral',
      language: 'yaml',
      snippet: `# .spectral.yaml   —   npx @stoplight/spectral-cli lint "services/*/{openapi,asyncapi}.yaml" --fail-severity warn
extends: ["spectral:oas", "spectral:asyncapi"]
rules:
  operation-operationId: error
  errors-use-problem-json:
    description: Every error response is application/problem+json
    given: "$.paths.*.*.responses[?(@property >= '400')].content"
    then: { field: "application/problem+json", function: truthy }
    severity: error`,
    },
    {
      id: 'ff-buf', label: 'Proto contracts checked', when: { SYNC_API: ['grpc'] }, category: 'structural', implements: DEFAULT_ADRS,
      threshold: '0 buf lint errors and 0 breaking changes against the main branch in the .proto files',
      description: 'Buf lints every .proto file with its standard rules and compares them with the main branch, failing on a field number reused, a field removed or a type changed. Deadlines are required by the house client wrapper, not by the contract.',
      tool: 'Buf',
      language: 'yaml',
      snippet: `# buf.yaml
version: v2
modules:
  - path: proto
lint:
  use: [STANDARD]
breaking:
  use: [FILE]
# CI:
#   buf lint
#   buf breaking --against '.git#branch=main'`,
    },
    {
      id: 'ff-breaking', label: 'No breaking contract change', when: { CONTRACTS: ['spec'] }, category: 'structural', implements: DEFAULT_ADRS,
      threshold: '0 breaking changes against the main branch in OpenAPI and AsyncAPI documents',
      description: 'For each changed contract, CI compares the new version with the one on main: oasdiff for OpenAPI, the AsyncAPI CLI\'s diff for AsyncAPI (Buf covers .proto files). A breaking change fails the build.',
      tool: 'oasdiff and AsyncAPI CLI (diff)',
      language: 'bash',
      snippet: `set -euo pipefail
for doc in services/*/openapi.yaml; do
  git show "origin/main:$doc" > base.yaml 2>/dev/null || continue   # new contract
  oasdiff breaking base.yaml "$doc" --fail-on ERR
done
for doc in services/*/asyncapi.yaml; do
  git show "origin/main:$doc" > base.yaml 2>/dev/null || continue
  npx -y @asyncapi/cli diff base.yaml "$doc" --type breaking --format json > breaking.json
  [ "$(jq length breaking.json)" -eq 0 ] || { cat breaking.json; exit 1; }
done`,
    },
    {
      id: 'ff-pact', label: 'Consumers\' pacts pass', when: { CONTRACTS: ['pact'] }, category: 'process', implements: DEFAULT_ADRS,
      threshold: '100% of the pacts of consumer versions on main or in production verified before each deploy; 0 deploys refused by can-i-deploy that went ahead',
      description: 'Every provider build verifies the pacts of its consumers (HTTP interactions with the Verifier, messages with MessageProviderPact) and publishes the result to the Pact Broker; the deploy job runs can-i-deploy first.',
      tool: 'Pact (pact-js) and Pact Broker',
      language: 'ts',
      snippet: `import { Verifier } from '@pact-foundation/pact'

it('honours every consumer\\'s pact', () =>
  new Verifier({
    provider: 'ordering',
    providerBaseUrl: 'http://localhost:8080',
    pactBrokerUrl: process.env.PACT_BROKER_URL,
    consumerVersionSelectors: [{ mainBranch: true }, { deployedOrReleased: true }],
    publishVerificationResult: true,
    providerVersion: process.env.GIT_SHA,
    providerVersionBranch: process.env.GIT_BRANCH,
  }).verifyProvider())

// deploy job, before deploying:
//   npx pact-broker can-i-deploy --pacticipant ordering --version $GIT_SHA --to-environment production`,
    },
    {
      id: 'ff-workflow', label: 'Workflows compensate', when: { FLOWS: ['orchestration'] }, category: 'structural', implements: ['adr-orchestration'],
      threshold: 'Every workflow has a test in which each step that changes data fails once and the earlier steps are compensated',
      description: 'Workflow tests run in Temporal\'s test environment with time skipping and mocked activities; for each step the test makes it fail and verifies the compensations of the earlier steps ran.',
      tool: 'Temporal Java SDK testing (TestWorkflowExtension)',
      language: 'java',
      snippet: `class PlaceOrderWorkflowTest {
  @RegisterExtension
  static final TestWorkflowExtension temporal = TestWorkflowExtension.newBuilder()
      .setWorkflowTypes(PlaceOrderWorkflowImpl.class)
      .setDoNotStart(true)
      .build();

  @Test
  void releasesStockWhenPaymentFails(TestWorkflowEnvironment env, Worker worker, PlaceOrderWorkflow workflow) {
    var inventory = mock(InventoryActivities.class, withSettings().withoutAnnotations());
    var payment = mock(PaymentActivities.class, withSettings().withoutAnnotations());
    when(payment.charge(any())).thenThrow(ApplicationFailure.newNonRetryableFailure("declined", "PaymentDeclined"));
    worker.registerActivitiesImplementations(inventory, payment);
    env.start();

    assertThrows(WorkflowFailedException.class, () -> workflow.place(ORDER));
    verify(inventory).release(ORDER.id());
  }
}`,
    },
    {
      id: 'ff-stuck-flows', label: 'Stuck flows alerted', when: { FLOWS: ['choreography'] }, category: 'operational', implements: ['adr-choreography'],
      threshold: '0 flow instances open longer than {{FLOW_MINUTES}} minutes without an alert',
      description: 'A process monitor subscribes to the start and end events of each documented flow, correlated by id, and exports the age of the oldest open instance per flow; the alert names the flow and goes to the owner of the step expected next.',
      tool: 'Prometheus alerting rule',
      language: 'yaml',
      snippet: `groups:
  - name: choreographed-flows
    rules:
      - alert: FlowStuck
        expr: max by (flow, next_step_owner) (flow_oldest_open_instance_seconds) > {{FLOW_MINUTES}} * 60
        labels: { severity: ticket }
        annotations:
          summary: "A {{ $labels.flow }} flow has been open for more than {{FLOW_MINUTES}} minutes"`,
    },
  ],
}

export default pack
