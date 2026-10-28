import type { AdrSpec, FitnessSpec, PackSpec, RequirementSpec, When } from '../../src/packSpec'

const DEFAULT_ADRS = ['adr-sync', 'adr-commands', 'adr-events', 'adr-streams']
const ASYNC: When = { DEFAULT: ['commands', 'events', 'streams'] }
const PUBLISHED: When = { DEFAULT: ['events', 'streams'] }
const CHOREOGRAPHY: When = { FLOWS: ['choreography'], DEFAULT: ['events', 'streams'] }
/** Choreography asked for with a default that publishes nothing: flows are orchestrated instead. */
const ORCHESTRATED_FALLBACK: When = { FLOWS: ['choreography'], DEFAULT: ['sync', 'commands'] }
const FALLBACK_SENTENCE = 'Choreography was chosen, but it needs published events and the default ({{DEFAULT}}) publishes none, so flows across parts are orchestrated. '
const FORCES = 'The system\'s own parts (services, modules, front ends and back ends) have to ask each other for data and to get things done. How they do it decides how they fail together. The forces: a synchronous call ties the caller to the callee being up and fast at that moment (temporal coupling), and a chain of them multiplies latency and the odds that one link is down; asynchronous messages decouple in time but make the result arrive later and the flow harder to follow; events let parts react without the publisher knowing them, until nobody can tell what happens after an order is placed; a flow across parts needs either a coordinator that knows every step or a chain of reactions nobody owns; and parts are released apart, so every interaction is a contract that must not break. Delivery guarantees of a queue are the Messaging pack, calls to systems outside are Integration resilience, and contracts with callers outside the system are the API evolution pack.'

const orchestratedRequirement = (id: string, label: string, when: When, because: string): RequirementSpec => ({
  id, label, when, ears_type: 'ubiquitous',
  action: 'run every business flow that spans more than one part as a workflow in the orchestrator, with each instance\'s current step and history visible, a compensation declared for every step that changes data, and the flow finished or compensated within {{FLOW_MINUTES}} minutes',
  rationale: `${because}An orchestrator keeps the steps of a flow in one place and its state visible per instance (microservices.io, Saga: orchestration).`,
  scenario: { label: 'Failed step compensated', given: 'the place-order workflow with reserve stock, take payment and book shipping', when: 'the payment is declined', then: 'the workflow releases the stock, ends as failed, and its history shows each step' },
})

const orchestrationAdr = (id: string, label: string, when: When, lead: string): AdrSpec => ({
  id, label, when,
  decision: `${lead}Every business flow across parts runs as a workflow in an orchestrator: Temporal for flows written as code, Camunda 8 where the flow is modelled in BPMN with business people, AWS Step Functions on AWS. The workflow calls each part\'s commands, keeps the state and history of each instance, retries steps with backoff, waits on timers and human tasks, and runs a declared compensation for every completed step that changed data when a later one fails (saga semantics as in the Data consistency pack). A flow finishes or is compensated within {{FLOW_MINUTES}} minutes. The workflow belongs to the part that owns the business outcome.`,
  consequences: '• Each flow is written in one place and each instance\'s state is visible and searchable.\n• Timeouts, retries and compensation come from the engine instead of hand-written state machines.\n• The orchestrator is a component to run (or pay for) and must be highly available.\n• The owning part knows every step: a change to a step means changing the workflow too.',
  alternatives: '1. Choreography: no central component, but flows are visible only through tracing.\n2. Hand-written state machines in a database table: no engine, but timers, retries and history to build.\n3. Distributed transactions (two-phase commit): unsupported by most brokers and services, and blocking.',
})

const workflowCheck = (id: string, when: When, adr: string, req: string): FitnessSpec => ({
  id, label: 'Workflows compensate', when, category: 'structural', implements: [adr], checks: [req],
  threshold: 'Every workflow has a test in which each step that changes data fails once and the earlier steps are compensated',
  description: 'Workflow tests run in Temporal\'s time-skipping test environment with the activities mocked; for each step the test makes it fail with a non-retryable failure and verifies the compensations of the earlier steps ran.',
  tool: 'Temporal TypeScript SDK (@temporalio/testing) with Vitest; for the JVM: Temporal\'s TestWorkflowExtension with JUnit 5',
  language: 'ts',
  snippet: `import { WorkflowFailedError } from '@temporalio/client'
import { ApplicationFailure } from '@temporalio/common'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type * as activities from '../src/activities'
import { placeOrder } from '../src/workflows'

const ORDER = { id: 'order-1', sku: 'SKU-1', quantity: 2, amountCents: 4200 }   // the workflow's input, as src/workflows declares it

let env: TestWorkflowEnvironment
beforeAll(async () => { env = await TestWorkflowEnvironment.createTimeSkipping() })
afterAll(async () => { await env?.teardown() })

it('releases the stock when the payment is declined', async () => {
  const mocks = {
    reserveStock: vi.fn(async () => 'reservation-1'),
    releaseStock: vi.fn(async () => {}),
    charge: vi.fn(async () => { throw ApplicationFailure.nonRetryable('declined', 'PaymentDeclined') }),
    bookShipping: vi.fn(async () => 'shipment-1'),
  } satisfies typeof activities
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue: 'test',
    workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
    activities: mocks,
  })
  await expect(worker.runUntil(
    env.client.workflow.execute(placeOrder, { args: [ORDER], workflowId: 'order-1', taskQueue: 'test' }),
  )).rejects.toBeInstanceOf(WorkflowFailedError)
  expect(mocks.releaseStock).toHaveBeenCalledWith('reservation-1')
  expect(mocks.bookShipping).not.toHaveBeenCalled()
})`,
})

const pack: PackSpec = {
  id: 'concern-communication-style',
  name: 'Communication style',
  group: 'architecture',
  description: 'How the system\'s own parts talk to each other: synchronous calls, commands over queues, published events or streams; when to deviate from the default, how deep a chain of calls may go, how contracts between the parts are written and checked, and who coordinates a flow across parts. The snippets are TypeScript (Vitest, pact-js, Temporal\'s TypeScript SDK) with Spectral, Buf, oasdiff, Conftest and Prometheus; each tool line names the JVM equivalent.',
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
    { title: 'microservices.io, Service Integration Contract Test', url: 'https://microservices.io/patterns/testing/service-integration-contract-test.html' },
    { title: 'Enterprise Integration Patterns', url: 'https://www.enterpriseintegrationpatterns.com/' },
    { title: 'AsyncAPI Specification', url: 'https://www.asyncapi.com/docs/reference/specification/latest' },
    { title: 'gRPC, Deadlines', url: 'https://grpc.io/docs/guides/deadlines/' },
    { title: 'Google SRE book, Addressing Cascading Failures', url: 'https://sre.google/sre-book/addressing-cascading-failures/' },
    { title: 'Sam Newman: Building Microservices, 2nd ed. (O\'Reilly)', url: 'https://www.oreilly.com/library/view/building-microservices-2nd/9781492034018/' },
    { title: 'Ford, Parsons, Kua, Sadalage: Building Evolutionary Architectures, 2nd ed. (fitness functions)', url: 'https://www.oreilly.com/library/view/building-evolutionary-architectures/9781492097532/' },
  ],
  questions: [
    {
      key: 'DEFAULT', title: 'Default style', label: 'How do the system\'s parts talk to each other by default?',
      hint: 'The default is what a new interaction uses without a discussion; an exception needs a reason recorded. It decides how much one part being slow or down affects the others.',
      default: 'events',
      options: [
        { value: 'sync', label: 'synchronous request and response', description: 'A part calls another and waits for the answer. Pick it for a modular monolith or a few services, when most interactions are queries that need an answer now, and every part on a chain has the availability the caller needs. Flows across parts are then orchestrated or kept local; choreography needs published events.' },
        { value: 'commands', label: 'commands over queues', description: 'A part asks another to do something by sending a command to the receiver\'s queue and learns the outcome from a reply later; queries stay synchronous. Pick it when work takes longer than a user should wait (documents, payments, provisioning), the receiver may be down for a while, or load comes in bursts. Flows across parts are then orchestrated or kept local; choreography needs published events.' },
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
      hint: 'Placing an order may reserve stock, take payment and book shipping in three parts. Someone has to know the steps, and what to undo when one fails (all-or-nothing semantics are the Data consistency pack). Choreography is available only with published events or streams as the default; with synchronous calls or commands it falls back to an orchestrator.',
      default: 'orchestration',
      options: [
        { value: 'orchestration', label: 'an orchestrator runs each flow', description: 'A workflow engine (Temporal, Camunda, AWS Step Functions) runs each flow as code or a model: it calls each part, keeps the state, retries and compensates. Pick it for flows with more than three steps, branches, timeouts or human tasks, or when someone must see where each instance is.' },
        { value: 'choreography', label: 'parts react to each other\'s events', description: 'No coordinator: each part reacts to events of others and publishes its own. Pick it for short flows (up to three steps) where each reaction belongs to a different team; longer flows become hard to follow. Only with published events or event streams as the default: with synchronous calls or commands nothing is published to react to, and flows are orchestrated instead.' },
        { value: 'local', label: 'no flow spans parts', description: 'Every business operation completes inside one part and one local transaction; boundaries are drawn so that this holds. Pick it for a monolith or modular monolith, or services cut so that no operation needs two of them.' },
      ],
    },
    {
      key: 'CONTRACTS', title: 'Contracts', label: 'How is it checked that a change does not break another part?',
      hint: 'Parts are released apart, so every call and message between them is a contract. A diff of the contract finds a break in the document; consumer-driven tests find a break in what consumers really use. Contracts with callers outside the system are decided in the API evolution pack.',
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
    text: 'The system\'s parts depend on each other for data and for work. When one is slow or down, the others should degrade in a known way instead of stalling in a chain of waiting calls; when one changes, the others should not break; and when a business flow runs across several parts, someone should be able to tell where it stands and what happens when a step fails. That needs a default way of talking, known exceptions, contracts for every interaction, and limits that the build and the monitoring check. The checks below share one layout: each part lives in services/<name> with its contract in services/<name>/openapi.yaml, services/<name>/asyncapi.yaml or proto/; the parts started for the end-to-end suite export their traces over OTLP (port 4318) to a Jaeger container whose query API (port 16686) the tests read through test/e2e/traces.ts; Kafka topics are declared as Strimzi KafkaTopic manifests in platform/kafka/topics/, RabbitMQ queues in platform/rabbitmq/definitions.json, and the topics and queues of a managed broker (Amazon SNS and SQS, Google Pub/Sub, Azure Service Bus, Confluent Cloud) in Terraform under infra/.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-default', label: 'One default, recorded exceptions', ears_type: 'ubiquitous',
      action: 'use {{DEFAULT}} for every interaction between the system\'s own parts and record each exception in an ADR with its reason, with 0 interactions in the model that are neither the default nor a recorded exception',
      rationale: 'Mixing styles case by case makes failure behaviour unpredictable; a default with recorded exceptions keeps it decidable (Newman, Building Microservices, ch. 4).',
      scenario: { label: 'Exception is recorded', given: 'the interactions between parts in the model, each with its style', when: 'they are compared with the default and the ADRs', then: 'each one either uses the default or is named by an ADR with its reason' },
      unchecked: 'The architects compare the interactions in the model with the default and the recorded exceptions at the quarterly architecture review; whether a reason holds is judged by people, not read by a tool.',
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
      id: 'req-deadline', label: 'Calls carry a deadline', ears_type: 'event-driven',
      trigger: 'a part calls another part synchronously',
      action: 'pass the remaining deadline of the user\'s request with the call and give up when it has passed, so that a user request spends at most {{CALL_BUDGET_MS}} ms in calls between parts at the 99th percentile',
      rationale: 'Deadline propagation stops a slow part from holding every caller above it, whatever the default style leaves synchronous (gRPC, Deadlines; Google SRE book, Addressing Cascading Failures).',
      scenario: { label: 'Expired deadline stops', given: 'a request whose deadline has 50 ms left', when: 'the first part calls a second that takes 500 ms', then: 'the call is cancelled after 50 ms, the second part is not called again, and the user gets a timely error' },
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
      action: 'publish an event after every committed change other parts depend on, carrying the state they need, and answer user requests from the part\'s own data, with 0 synchronous calls from one back-end part to another on a user\'s request path outside the recorded exceptions (the front end calling its back end is not one)',
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
    orchestratedRequirement('req-orchestrated', 'Flows run in the orchestrator', { FLOWS: ['orchestration'] }, ''),
    orchestratedRequirement('req-orchestrated-fallback', 'Flows run in an orchestrator for want of events', ORCHESTRATED_FALLBACK, 'Choreography needs published events and this default publishes none, so the orchestrator takes the flows. '),
    {
      id: 'req-choreographed', label: 'Choreographed flows are traced', when: CHOREOGRAPHY, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a flow that spans parts has started and not reached its end event within {{FLOW_MINUTES}} minutes',
      action: 'report it as stuck with its correlation id and the last event seen, and alert the team that owns the part that should have reacted',
      rationale: 'Without a coordinator nobody notices a flow that stops halfway; a monitor of the event chain gives it an owner (microservices.io, Saga: choreography).',
      scenario: { label: 'Stuck flow reported', given: 'an order placed and its stock reserved', when: 'no payment event follows within {{FLOW_MINUTES}} minutes', then: 'the flow is reported stuck with its correlation id and the payment team is alerted' },
    },
    {
      id: 'req-local-flows', label: 'Operations stay in one part', when: { FLOWS: ['local'] }, ears_type: 'ubiquitous',
      action: 'complete every business operation inside one part and one local transaction, with 0 operations in which one part asks another to change data',
      rationale: 'A flow that stays inside one part needs neither a coordinator nor compensation; boundaries are drawn to keep it so (Newman, Building Microservices, ch. 6).',
      scenario: { label: 'Operation stays local', given: 'the traces of the journeys that change data', when: 'the calls between parts in each are listed', then: 'none asks another part to create, change or delete anything' },
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
      decision: 'Parts talk by synchronous request and response by default: {{SYNC_API}}, with clients generated from the contracts. Every call carries the remaining deadline of the user\'s request (gRPC deadlines, or the X-Request-Deadline header the server honours, as an absolute Unix epoch in milliseconds); a user request spends at most {{CALL_BUDGET_MS}} ms in calls between parts and a chain is at most {{MAX_DEPTH}} calls deep. A command over a queue or an event is used instead, recorded as an exception, when the caller does not need the result to answer, the work takes longer than the budget, several parts react, or the callee may be down longer than the caller can wait. Flows across parts are orchestrated or stay local, as the flows decision records; choreography needs published events, so with this default it falls back to the orchestrator. Contract checks: {{CONTRACTS}}.',
      consequences: '• Simplest to write, follow and debug: one request, one trace, an answer or an error.\n• The caller is only as available as everything it calls: availabilities multiply along a chain, hence the depth limit.\n• Overload spreads upstream unless deadlines and load shedding stop it.\n• Work that takes long or must survive a callee being down needs the recorded exceptions.',
      alternatives: '1. Commands over queues: callers do not wait, at the cost of answering later.\n2. Published events: no temporal coupling, at the cost of copies and eventual consistency.\n3. A service mesh to add retries and timeouts: helps, but does not remove the coupling of waiting.',
    },
    {
      id: 'adr-commands', label: 'Commands over queues by default', when: { DEFAULT: ['commands'] },
      decision: 'A part that needs another to do something sends a command to that part\'s own queue (RabbitMQ or Azure Service Bus queues, Amazon SQS; one owning part per queue) and answers its own caller with the command\'s id; the receiver replies with an outcome message the sender correlates by id, within {{PROPAGATION_SECONDS}} seconds at the 99th percentile while it is up. Queries that need an answer now stay synchronous ({{SYNC_API}}), at most {{MAX_DEPTH}} calls deep, each carrying the remaining deadline and spending at most {{CALL_BUDGET_MS}} ms per user request. Messages are described in AsyncAPI; delivery guarantees, deduplication and dead-lettering follow the Messaging pack. Flows across parts are orchestrated or stay local, as the flows decision records; choreography needs published events, so with this default it falls back to the orchestrator. Contract checks: {{CONTRACTS}}.',
      consequences: '• Senders keep working while a receiver is busy or down; bursts wait in the queue.\n• Users see an accepted state and the outcome later, so screens and APIs must show pending work.\n• Each queue has one owner, so who executes a command is never in doubt.\n• Following a request means following a correlation id across messages.',
      alternatives: '1. Synchronous calls: immediate answers, coupled availability.\n2. Published events: receivers decide what to do, no one is told to do anything.\n3. A shared job table polled by workers: no broker, but a database used as a queue.',
    },
    {
      id: 'adr-events', label: 'Published events by default', when: { DEFAULT: ['events'] },
      decision: 'Each part publishes events about its own committed changes (through an outbox, as the Data consistency pack decides; as CloudEvents described in AsyncAPI) carrying the state its subscribers need; subscribers keep their own copies and answer user requests from them. Events go through a publish-subscribe broker: Apache Kafka for many subscribers and replay, Amazon SNS with SQS or Google Pub/Sub on those clouds, Azure Service Bus topics on Azure. Copies are updated within {{PROPAGATION_SECONDS}} seconds at the 99th percentile. A command to one specific part goes to that part\'s queue; a synchronous call between back-end parts ({{SYNC_API}}, at most {{MAX_DEPTH}} deep, carrying the remaining deadline, at most {{CALL_BUDGET_MS}} ms per user request) is a recorded exception for an answer only its owner can give now, such as a payment authorisation; the front end calling its back end is no exception. Flows across parts: {{FLOWS}}. Contract checks: {{CONTRACTS}}.',
      consequences: '• A part keeps answering while the parts it depends on are down: no temporal coupling on the user path.\n• Data is copied and eventually consistent; screens and rules must tolerate {{PROPAGATION_SECONDS}} seconds of lag.\n• Publishers do not know their subscribers; what happens after an event is visible only in the contracts and traces.\n• Event schemas become long-lived contracts that need versioning.',
      alternatives: '1. Synchronous calls: simpler, coupled availability.\n2. Commands over queues: the sender decides what happens, coupling it to the receivers.\n3. Event notification without state (subscribers call back for data): smaller events, but the temporal coupling returns.',
    },
    {
      id: 'adr-streams', label: 'Event streams by default', when: { DEFAULT: ['streams'] },
      decision: 'Parts write their events to a durable, partitioned log: Apache Kafka on Kubernetes with Strimzi, whose topics are KafkaTopic manifests (a managed Kafka such as Confluent Cloud, Amazon MSK or Redpanda Cloud declares its topics in Terraform and checks the same retention there). Topics are keyed by entity so that order holds per entity, retained for at least {{RETENTION_DAYS}} days, with topics holding current state compacted. Consumers read at their own pace, keep their own views (Kafka Streams, Apache Flink or plain consumers) and can rebuild them by replaying from the start; events reach every consumer within {{PROPAGATION_SECONDS}} seconds at the 99th percentile. Synchronous calls between back-end parts ({{SYNC_API}}, at most {{MAX_DEPTH}} deep, carrying the remaining deadline, at most {{CALL_BUDGET_MS}} ms per user request) are recorded exceptions; the front end calling its back end is no exception. Flows across parts: {{FLOWS}}. Contract checks: {{CONTRACTS}}.',
      consequences: '• New consumers and new views are added without asking producers, by replaying history.\n• High throughput, with order per key and parallelism per partition.\n• A cluster to run (or pay for) and partitions to size; consumer lag becomes a key metric.\n• Events in the log live for days or forever, so their schemas must stay readable for that long.',
      alternatives: '1. Published events through a pub/sub broker without replay: simpler, but views cannot be rebuilt from history.\n2. Commands over queues: work distribution, not a history.\n3. Change data capture from each database: no code to publish, but internal tables become the contract.',
    },
    {
      id: 'adr-rest', label: 'Synchronous calls over HTTP and JSON', when: { SYNC_API: ['rest'] },
      decision: 'Synchronous calls between parts are resource-style HTTP with JSON bodies, described in OpenAPI 3.1 documents owned by the providing part (services/<name>/openapi.yaml), linted with Spectral against the house ruleset in every build; errors are application/problem+json. Clients are generated from the documents (openapi-typescript or OpenAPI Generator) and never written by hand. The remaining deadline travels in the X-Request-Deadline header.',
      consequences: '• Any language and any browser can call; people can read and try the API.\n• JSON over HTTP/1.1 costs more per call than a binary protocol; high-volume paths may need the gRPC exception.\n• Deadlines are a house convention the servers must honour, not a protocol feature.',
      alternatives: '1. gRPC: generated clients, deadlines and streaming built in, but browsers need a gateway.\n2. GraphQL between parts: flexible queries, and a contract that is hard to diff for breaking changes.',
    },
    {
      id: 'adr-grpc', label: 'Synchronous calls over gRPC', when: { SYNC_API: ['grpc'] },
      decision: 'Synchronous calls between parts are gRPC over HTTP/2, described in .proto files owned by the providing part under proto/, linted with Buf\'s STANDARD rules and compared with the main branch in every build. Clients are generated with Buf (Connect for TypeScript, grpc-java, Grpc.Net.Client) and never written by hand. The remaining deadline travels as the gRPC deadline, which every client wrapper sets from the incoming one.',
      consequences: '• Binary, fast, with deadlines and streaming built into the protocol.\n• Browsers and scripts need gRPC-Web, Connect or a gateway; people cannot try the API with curl.\n• Field numbers are forever: a removed or retyped field is a break Buf refuses.',
      alternatives: '1. HTTP and JSON with OpenAPI: readable by people and browsers, slower per call.\n2. gRPC only where volume demands it, HTTP elsewhere: two client stacks to keep.',
    },
    orchestrationAdr('adr-orchestration', 'Flows run by an orchestrator', { FLOWS: ['orchestration'] }, ''),
    orchestrationAdr('adr-orchestration-fallback', 'Flows run by an orchestrator, as nothing is published', ORCHESTRATED_FALLBACK, FALLBACK_SENTENCE),
    {
      id: 'adr-choreography', label: 'Flows by choreography', when: CHOREOGRAPHY,
      decision: 'Flows across parts are choreographed: each part reacts to the events of others and publishes its own, and no part coordinates the flow. Every flow is documented as an event chain (which part reacts to which event and what it publishes) in the AsyncAPI documents and a flow diagram in the model; every event carries the flow\'s correlation id. A process monitor subscribes to the start and end events of each flow and reports an instance not finished within {{FLOW_MINUTES}} minutes. A flow that grows past three steps or needs timeouts is moved to an orchestrator by a new ADR.',
      consequences: '• No central component; each team owns its reaction and changes it alone.\n• The flow exists only as the sum of reactions; without the documented chain and the monitor nobody can tell where an instance is.\n• Compensation is spread across parts, each undoing its own step on a failure event.\n• Cyclic reactions are possible and must be caught in review.',
      alternatives: '1. An orchestrator: one place for the flow and its state, at the cost of a central component.\n2. Keeping the flow in one part: no coordination at all, if the boundaries allow it.',
    },
    {
      id: 'adr-local-flows', label: 'No flow spans parts', when: { FLOWS: ['local'] },
      decision: 'No business flow spans parts: every operation that changes data completes inside one part and one local transaction, and the boundaries between parts are drawn (and redrawn, through the Decomposition pack) so that this holds. A part may ask another for data on the way, never to change anything; an operation that would need two parts to change data is a reason to move the boundary, not to add a coordinator. The end-to-end traces prove it on every run.',
      consequences: '• No orchestrator, no compensation, no stuck flows: each operation is one transaction.\n• The boundaries carry the constraint: a feature that spans two parts cannot be built until they are re-cut or merged.\n• Reads across parts stay synchronous or come from copies; writes never cross.',
      alternatives: '1. An orchestrator for the few flows that must span parts: a central component for the exceptions.\n2. Choreography: reactions across parts, visible only through tracing.',
    },
    {
      id: 'adr-contract-diffs', label: 'Contracts diffed on every change', when: { CONTRACTS: ['spec'] },
      decision: 'A change to a contract between parts is checked against the version on the main branch in the pull request: oasdiff for OpenAPI, the AsyncAPI CLI\'s diff for AsyncAPI, Buf for .proto files. A breaking change (a field or operation removed, a type narrowed, a required field added to a request) fails the build; it ships only as a new version of the contract with the old one kept until every consumer has moved, as the API evolution pack decides for callers outside.',
      consequences: '• Works for consumers the provider does not know, with no test code on the consumer side.\n• A diff knows the document, not what consumers use: a change that breaks nobody still fails, and a semantic change the schema cannot express passes.\n• Versioning and deprecation become routine work for every provider.',
      alternatives: '1. Consumer-driven contract tests: precise about what consumers use, but every consumer must run Pact.\n2. End-to-end tests across parts in a shared environment: slow, flaky and late.',
    },
    {
      id: 'adr-consumer-contracts', label: 'Consumer-driven contract tests', when: { CONTRACTS: ['pact'] },
      decision: 'Every consuming part records the calls and messages it relies on as pacts with Pact and publishes them to the Pact Broker (or PactFlow); every provider build fetches and verifies the pacts of the consumer versions on main and deployed, publishes the results, and the deploy job asks can-i-deploy before deploying and records the deployment after. Messages are verified with message pacts; gRPC calls with the pact-protobuf-plugin. A provider may change anything no pact relies on.',
      consequences: '• A breaking change is found in the provider\'s build, in minutes, without an environment that holds every part.\n• Only what consumers use is protected: a consumer without a pact is on its own.\n• The broker is one more component to run (or a subscription), and every team has to learn the workflow.',
      alternatives: '1. Contract diffs on every change: no consumer tests to write, but no knowledge of what consumers really use.\n2. Provider-written schema tests: the provider against its own document, not against its consumers.',
    },
  ],
  fitness: [
    {
      id: 'ff-depth', label: 'Call chains within depth', category: 'holistic', implements: DEFAULT_ADRS, checks: ['req-depth'],
      threshold: '0 traces of the end-to-end journeys with more than {{MAX_DEPTH}} nested synchronous calls between parts, and 0 in which a part is reached again through its own calls',
      description: 'The parts started for the end-to-end suite export their spans over OTLP to a Jaeger container; each journey is run with a traceparent header the test generates, the trace is fetched from Jaeger\'s query API by that id, and the test follows each span\'s parents counting nested HTTP and gRPC client spans that another part continues with a server span (database calls and calls to systems outside are not counted), and fails when one part serves twice in a line of nested calls (a cycle). The HTTP method is read under the stable name http.request.method and the old http.method, so SDKs on either semantic convention are counted. A new call that deepens a chain fails the test. The helper test/e2e/traces.ts is shared with the other trace-based checks of this pack.',
      tool: 'Vitest with Jaeger (jaegertracing/jaeger, OTLP in on 4318, query API on 16686; the /api/traces endpoint is Jaeger\'s internal JSON API); for the JVM: the same test with JUnit 5 and RestClient',
      language: 'ts',
      snippet: `// test/e2e/traces.ts — the parts export spans over OTLP to the Jaeger container started for the suite
import { randomBytes, randomUUID } from 'node:crypto'

export interface Span { id: string; parent?: string; service: string; kind?: string; method?: string; durationMs: number; rpc: boolean }

export const newTraceId = () => randomUUID().replace(/-/g, '')
export const traceparent = (traceId: string) => \`00-\${traceId}-\${randomBytes(8).toString('hex')}-01\`

/** The spans of one trace, once Jaeger has them all (two reads in a row agree). */
export async function trace(traceId: string): Promise<Span[]> {
  let last = -1
  for (let i = 0; i < 20; i++) {
    const res = await fetch(\`\${process.env.JAEGER_URL}/api/traces/\${traceId}\`)
    const spans = res.ok ? toSpans((await res.json()).data[0]) : []
    if (spans.length > 0 && spans.length === last) return spans
    last = spans.length
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(\`trace \${traceId} did not settle\`)
}

// A call between parts is an HTTP or gRPC client span that a server span of another part continues;
// a call to a system outside has no server span in the trace and is not counted. The HTTP method is
// read under the stable semantic-convention name and the old one (SDKs still emitting http.method).
const toSpans = (trace: any): Span[] => {
  const spans = trace.spans.map((s: any) => {
    const tag = (key: string) => s.tags.find((t: any) => t.key === key)?.value
    const method = tag('http.request.method') ?? tag('http.method')
    return {
      id: s.spanID,
      parent: s.references.find((r: any) => r.refType === 'CHILD_OF')?.spanID,
      service: trace.processes[s.processID].serviceName,
      kind: tag('span.kind'),
      method,
      durationMs: s.duration / 1000,
      rpc: tag('span.kind') === 'client' && (method !== undefined || tag('rpc.system') !== undefined),
    }
  })
  return spans.map((s: Span) => ({ ...s, rpc: s.rpc && spans.some((x: Span) => x.kind === 'server' && x.parent === s.id) }))
}

// test/e2e/depth.test.ts
import { expect, it } from 'vitest'
import { journeys } from './journeys'   // the journeys of the suite; each takes the headers to send with its first request
import { newTraceId, trace, traceparent, type Span } from './traces'

const ancestry = (spans: Span[], s: Span): Span[] => {
  const line: Span[] = []
  for (let p: Span | undefined = s; p; p = spans.find((x) => x.id === p!.parent)) line.push(p)
  return line
}
const depth = (spans: Span[], s: Span) => ancestry(spans, s).filter((p) => p.rpc).length
// a part reached again through its own calls: its service serves twice in one line of server spans
const cycle = (spans: Span[], s: Span) => {
  const served = ancestry(spans, s).filter((p) => p.kind === 'server').map((p) => p.service)
  return new Set(served).size < served.length
}

it.each(journeys)('$name goes at most {{MAX_DEPTH}} calls deep, without cycles', async (journey) => {
  const traceId = newTraceId()
  await journey.run({ traceparent: traceparent(traceId) })   // the parts continue the trace
  const spans = await trace(traceId)
  expect(Math.max(0, ...spans.map((s) => depth(spans, s)))).toBeLessThanOrEqual({{MAX_DEPTH}})
  expect(spans.filter((s) => cycle(spans, s)).map((s) => s.service)).toEqual([])
})`,
    },
    {
      id: 'ff-budget', label: 'Calls within budget', category: 'holistic', implements: DEFAULT_ADRS, checks: ['req-deadline'],
      threshold: '99th percentile over the traces of the end-to-end journeys of the time a request spends in calls between parts at most {{CALL_BUDGET_MS}} ms',
      description: 'The same traces as the depth check: for each journey run, the test finds the server span the request entered and sums the durations of its outgoing client spans (nested calls run inside them); the 99th percentile over all runs must stay within the budget. Under production load the same number is read from the traces in Jaeger or Tempo with the same arithmetic.',
      tool: 'Vitest with Jaeger (test/e2e/traces.ts); for the JVM: the same test with JUnit 5',
      language: 'ts',
      snippet: `import { expect, it } from 'vitest'
import { journeys } from './journeys'
import { newTraceId, trace, traceparent } from './traces'

it('a request spends at most {{CALL_BUDGET_MS}} ms in calls between parts (p99 over the journeys)', async () => {
  const spent: number[] = []
  for (const journey of journeys) for (let i = 0; i < 20; i++) {
    const traceId = newTraceId()
    await journey.run({ traceparent: traceparent(traceId) })
    const spans = await trace(traceId)
    const ids = new Set(spans.map((s) => s.id))
    const entry = spans.find((s) => s.kind === 'server' && !(s.parent && ids.has(s.parent)))   // where the request entered
    const outgoing = spans.filter((s) => s.rpc && s.parent === entry?.id)                       // nested calls run inside these
    spent.push(outgoing.reduce((sum, s) => sum + s.durationMs, 0))
  }
  spent.sort((a, b) => a - b)
  expect(spent[Math.floor((spent.length - 1) * 0.99)]).toBeLessThanOrEqual({{CALL_BUDGET_MS}})
}, 600_000)`,
    },
    {
      id: 'ff-deadline', label: 'Expired deadline stops the call', when: { SYNC_API: ['rest'] }, category: 'structural', implements: ['adr-rest'], checks: ['req-deadline'],
      threshold: 'A request whose deadline passes during a call to another part is answered with 504 within {{CALL_BUDGET_MS}} ms and the called part is not called again',
      description: 'A test starts a stand-in for the called part that answers after 500 ms, points the part under test at it, sends a request whose X-Request-Deadline is 50 ms away and expects a 504 well within the budget and a single downstream call.',
      tool: 'Vitest with a Node http server as the slow part; for the JVM: the same test with JUnit 5 and WireMock\'s fixed delay',
      language: 'ts',
      snippet: `import http from 'node:http'
import { afterAll, beforeAll, expect, it } from 'vitest'

// a stand-in for the part called downstream, answering after 500 ms;
// the part under test is started with DOWNSTREAM_URL=http://localhost:18081
let calls = 0
const slow = http.createServer((_req, res) => { calls++; setTimeout(() => res.end('{}'), 500) })
beforeAll(() => new Promise<void>((resolve) => slow.listen(18081, resolve)))
afterAll(() => slow.close())

it('gives up when the deadline has passed', async () => {
  const started = Date.now()
  const res = await fetch(\`\${process.env.PART_URL}/orders/1/status\`, {
    headers: { 'X-Request-Deadline': String(Date.now() + 50) },   // absolute deadline, Unix epoch milliseconds
  })
  expect(res.status).toBe(504)
  expect(Date.now() - started).toBeLessThan({{CALL_BUDGET_MS}})
  expect(calls).toBe(1)   // no retry past the deadline
})`,
    },
    {
      id: 'ff-deadline-grpc', label: 'Expired gRPC deadline stops the call', when: { SYNC_API: ['grpc'] }, category: 'structural', implements: ['adr-grpc'], checks: ['req-deadline'],
      threshold: 'A call whose deadline is 50 ms away ends with DEADLINE_EXCEEDED within {{CALL_BUDGET_MS}} ms, the called part receives the same deadline, and it is called once',
      description: 'A test starts a stand-in for the called part as a gRPC server that answers after 500 ms, points the part under test at it, calls the part under test with a deadline 50 ms away and expects DEADLINE_EXCEEDED within the budget. The stand-in records the deadline it was given: it must be set and no later than the caller\'s (the part passed it on rather than starting a fresh one), and it is called once (no retry past the deadline). Both sides use pass-through serializers with empty messages, so no generated code is needed; an empty message is a valid Protocol Buffers message whose fields all hold their defaults.',
      tool: 'Vitest with @grpc/grpc-js; for the JVM: the same test with JUnit 5, grpc-java\'s in-process server and Context.current().getDeadline()',
      language: 'ts',
      snippet: `import * as grpc from '@grpc/grpc-js'
import { afterAll, beforeAll, expect, it } from 'vitest'

// a stand-in for the part called downstream, answering after 500 ms;
// the part under test is started with DOWNSTREAM_GRPC=localhost:18082 and served at PART_GRPC
const raw = { serialize: (b: Buffer) => b, deserialize: (b: Buffer) => b }
const method = (path: string) => ({ path, requestStream: false, responseStream: false, requestSerialize: raw.serialize, requestDeserialize: raw.deserialize, responseSerialize: raw.serialize, responseDeserialize: raw.deserialize })

const seen: Array<number> = []   // the deadline of each downstream call, in epoch milliseconds
const slow = new grpc.Server()
slow.addService({ GetStock: method('/inventory.v1.InventoryService/GetStock') }, {
  GetStock: (call: grpc.ServerUnaryCall<Buffer, Buffer>, done: grpc.sendUnaryData<Buffer>) => {
    const d = call.getDeadline()
    seen.push(d instanceof Date ? d.getTime() : d)   // Infinity when the caller set none
    setTimeout(() => done(null, Buffer.alloc(0)), 500)
  },
})
beforeAll(() => new Promise<void>((resolve, reject) =>
  slow.bindAsync('localhost:18082', grpc.ServerCredentials.createInsecure(), (err) => (err ? reject(err) : resolve())),
))
afterAll(() => slow.forceShutdown())

it('gives up when the deadline has passed and passes the deadline on', async () => {
  const client = new grpc.Client(process.env.PART_GRPC!, grpc.credentials.createInsecure())
  const started = Date.now()
  const deadline = started + 50
  const code = await new Promise<grpc.status>((resolve) => client.makeUnaryRequest(
    '/ordering.v1.OrderingService/GetOrderStatus', raw.serialize, raw.deserialize, Buffer.alloc(0),
    new grpc.Metadata(), { deadline }, (err) => resolve(err ? err.code : grpc.status.OK),
  ))
  expect(code).toBe(grpc.status.DEADLINE_EXCEEDED)
  expect(Date.now() - started).toBeLessThan({{CALL_BUDGET_MS}})
  await new Promise((r) => setTimeout(r, 600))   // room for a retry, which must not come
  expect(seen).toHaveLength(1)
  expect(seen[0]).toBeLessThanOrEqual(deadline + 20)   // the caller's deadline, give or take the clock's rounding
  client.close()
})`,
    },
    {
      id: 'ff-command-reply', label: 'Commands accepted and answered', when: { DEFAULT: ['commands'] }, category: 'structural', implements: ['adr-commands'], checks: ['req-commands'],
      threshold: 'A command\'s outcome reply arrives within {{PROPAGATION_SECONDS}} seconds while the receiver is up; a command sent while the receiver is down is answered within {{PROPAGATION_SECONDS}} seconds of its restart',
      description: 'An integration test starts RabbitMQ in a container and the receiving part against it, sends a command to the receiver\'s queue and waits for the correlated reply on the sender\'s reply queue; a second test stops the receiver, sends, restarts it and expects the reply.',
      tool: 'Vitest with Testcontainers (@testcontainers/rabbitmq) and amqplib; for the JVM: Testcontainers with Spring AMQP and Awaitility',
      language: 'ts',
      snippet: `import { randomUUID } from 'node:crypto'
import amqp from 'amqplib'
import { RabbitMQContainer, type StartedRabbitMQContainer } from '@testcontainers/rabbitmq'
import { afterAll, beforeAll, it } from 'vitest'
import { startInventory, type RunningPart } from './parts'   // starts the receiving part against the broker

let rabbit: StartedRabbitMQContainer
let inventory: RunningPart
beforeAll(async () => {
  rabbit = await new RabbitMQContainer('rabbitmq:4-management').start()
  inventory = await startInventory({ AMQP_URL: rabbit.getAmqpUrl() })
}, 120_000)
afterAll(async () => { await inventory.stop(); await rabbit.stop() })

const send = async (id: string) => {
  const channel = await (await amqp.connect(rabbit.getAmqpUrl())).createChannel()
  await channel.assertQueue('inventory.commands', { durable: true })
  channel.sendToQueue('inventory.commands', Buffer.from(JSON.stringify({ type: 'reserve-stock', id, sku: 'SKU-1', quantity: 2 })))
}
const replyTo = async (id: string, withinMs: number) => {
  const channel = await (await amqp.connect(rabbit.getAmqpUrl())).createChannel()
  await channel.assertQueue('ordering.replies', { durable: true })
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(\`no reply for \${id} within \${withinMs} ms\`)), withinMs)
    channel.consume('ordering.replies', (m) => {
      if (m && JSON.parse(m.content.toString()).commandId === id) { clearTimeout(timer); channel.ack(m); resolve() }
    })
  })
}

it('answers a command within {{PROPAGATION_SECONDS}} s while the receiver is up', async () => {
  const id = randomUUID()
  await send(id)
  await replyTo(id, {{PROPAGATION_SECONDS}} * 1000)
})

it('answers a command sent while the receiver was down, once it is back', async () => {
  await inventory.stop()
  const id = randomUUID()
  await send(id)
  inventory = await startInventory({ AMQP_URL: rabbit.getAmqpUrl() })
  await replyTo(id, {{PROPAGATION_SECONDS}} * 1000)   // rejects when no reply comes in time
})`,
    },
    {
      id: 'ff-asyncapi', label: 'Message contracts valid', when: PUBLISHED, category: 'structural', implements: ['adr-events', 'adr-streams'], checks: ['req-contracts'],
      threshold: '0 AsyncAPI validation errors, 0 Spectral warnings, and every topic declared for the broker described in an AsyncAPI document',
      description: 'CI validates and lints every part\'s AsyncAPI document and compares the channel addresses in the documents with the topics declared for the broker: Strimzi KafkaTopic manifests under platform/kafka/topics, and the topics of a managed broker (aws_sns_topic, google_pubsub_topic, azurerm_servicebus_topic, confluent_kafka_topic) read from the Terraform state under infra/ with the job\'s read access to it. A topic no document describes fails the job, and so does finding no topic at all.',
      tool: 'AsyncAPI CLI and Spectral (spectral:asyncapi) with yq, jq and terraform show -json in GitHub Actions',
      language: 'yaml',
      snippet: `# .github/workflows/contracts.yml   (.spectral-asyncapi.yaml holds: extends: ["spectral:asyncapi"])
jobs:
  asyncapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
      - run: |
          for doc in services/*/asyncapi.yaml; do npx -y @asyncapi/cli validate "$doc"; done
      - run: npx -y @stoplight/spectral-cli lint "services/*/asyncapi.yaml" --ruleset .spectral-asyncapi.yaml --fail-severity warn
      - uses: hashicorp/setup-terraform@v3.1.2   # pin by commit SHA in your repository
      - run: |
          # every topic declared for the broker is described in some AsyncAPI document
          shopt -s nullglob
          yq '.channels[].address' services/*/asyncapi.yaml | sort -u > described.txt
          manifests=(platform/kafka/topics/*.yaml)   # Strimzi KafkaTopic manifests
          if [ \${#manifests[@]} -gt 0 ]; then yq '.spec.topicName // .metadata.name' "\${manifests[@]}"; fi > used.txt
          if [ -d infra ]; then                       # topics of a managed broker, from the Terraform state
            terraform -chdir=infra init -input=false > /dev/null
            terraform -chdir=infra show -json | jq -r '
              def modules: ., (.child_modules[]? | modules);
              .values.root_module | modules | .resources[]?
              | select(.type | IN("aws_sns_topic", "google_pubsub_topic", "azurerm_servicebus_topic", "confluent_kafka_topic"))
              | .values.name // .values.topic_name' >> used.txt
          fi
          sort -u -o used.txt used.txt
          [ -s used.txt ] || { echo "no topics found in platform/kafka/topics or infra/"; exit 1; }
          comm -23 used.txt described.txt | tee undescribed.txt
          [ ! -s undescribed.txt ]`,
    },
    {
      id: 'ff-asyncapi-queues', label: 'Command contracts valid', when: { DEFAULT: ['commands'] }, category: 'structural', implements: ['adr-commands'], checks: ['req-contracts'],
      threshold: '0 AsyncAPI validation errors, 0 Spectral warnings, and every queue declared for the broker described in an AsyncAPI document',
      description: 'CI validates and lints every part\'s AsyncAPI document and compares the channel addresses in the documents with the queues declared for the broker: the RabbitMQ definitions file the broker is loaded with, and the queues of a managed broker (aws_sqs_queue, azurerm_servicebus_queue) read from the Terraform state under infra/. A queue no document describes fails the job, and so does finding no queue at all.',
      tool: 'AsyncAPI CLI and Spectral (spectral:asyncapi) with yq, jq and terraform show -json in GitHub Actions',
      language: 'yaml',
      snippet: `# .github/workflows/contracts.yml   (.spectral-asyncapi.yaml holds: extends: ["spectral:asyncapi"])
jobs:
  asyncapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
      - run: |
          for doc in services/*/asyncapi.yaml; do npx -y @asyncapi/cli validate "$doc"; done
      - run: npx -y @stoplight/spectral-cli lint "services/*/asyncapi.yaml" --ruleset .spectral-asyncapi.yaml --fail-severity warn
      - uses: hashicorp/setup-terraform@v3.1.2   # pin by commit SHA in your repository
      - run: |
          # every queue declared for the broker is described in some AsyncAPI document
          yq '.channels[].address' services/*/asyncapi.yaml | sort -u > described.txt
          defs=platform/rabbitmq/definitions.json
          if [ -f "$defs" ]; then jq -r '.queues[].name' "$defs"; fi > used.txt
          if [ -d infra ]; then                       # queues of a managed broker, from the Terraform state
            terraform -chdir=infra init -input=false > /dev/null
            terraform -chdir=infra show -json | jq -r '
              def modules: ., (.child_modules[]? | modules);
              .values.root_module | modules | .resources[]?
              | select(.type | IN("aws_sqs_queue", "azurerm_servicebus_queue")) | .values.name' >> used.txt
          fi
          sort -u -o used.txt used.txt
          [ -s used.txt ] || { echo "no queues found in $defs or infra/"; exit 1; }
          comm -23 used.txt described.txt | tee undescribed.txt
          [ ! -s undescribed.txt ]`,
    },
    {
      id: 'ff-no-sync-calls', label: 'No undecided synchronous call', when: PUBLISHED, category: 'holistic', implements: ['adr-events', 'adr-streams'], checks: ['req-events'],
      threshold: '0 synchronous calls between back-end parts in the traces of the end-to-end journeys outside the recorded exceptions',
      description: 'From the same traces as the depth check, the test pairs each client span with the server span it produced in another part and checks the pair against the list of recorded exceptions (caller, callee, ADR); a call to a system outside has no server span and is not counted, and the suite\'s own requests to the back end are not spans.',
      tool: 'Vitest with Jaeger (test/e2e/traces.ts); for the JVM: the same test with JUnit 5',
      language: 'ts',
      snippet: `import { expect, it } from 'vitest'
import exceptions from './sync-call-exceptions.json'   // [{ "from": "ordering", "to": "payment", "adr": "ADR-023 Payment authorisation is synchronous" }]
import { journeys } from './journeys'
import { newTraceId, trace, traceparent } from './traces'

it.each(journeys)('$name makes no synchronous call between back-end parts outside the recorded exceptions', async (journey) => {
  const traceId = newTraceId()
  await journey.run({ traceparent: traceparent(traceId) })
  const spans = await trace(traceId)
  const calls = spans.filter((s) => s.rpc).map((client) => ({
    from: client.service,
    to: spans.find((s) => s.kind === 'server' && s.parent === client.id)?.service,   // undefined: a system outside
  }))
  const undecided = calls.filter((c) => c.to && !exceptions.some((e) => e.from === c.from && e.to === c.to))
  expect(undecided).toEqual([])
})`,
    },
    {
      id: 'ff-propagation', label: 'Events applied in time', when: PUBLISHED, category: 'operational', implements: ['adr-events', 'adr-streams'], checks: ['req-propagation'],
      threshold: '99th percentile of the time from publishing an event to its being applied by each subscriber at most {{PROPAGATION_SECONDS}} seconds over 10 minutes',
      description: 'Each subscriber records, for every event it applies, the seconds since the event\'s time attribute as a histogram event_applied_delay_seconds labelled with the subscriber; an alert fires when the 99th percentile passes the limit.',
      tool: 'Prometheus alerting rule (the histogram is exported by the subscribers with the OpenTelemetry metrics SDK or Micrometer)',
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
      id: 'ff-retention', label: 'Log keeps events', when: { DEFAULT: ['streams'] }, category: 'structural', implements: ['adr-streams'], checks: ['req-replay'],
      threshold: '0 deleting topics (cleanup.policy delete or compact,delete) retaining events for less than {{RETENTION_DAYS}} days',
      description: 'Topics are declared as Strimzi KafkaTopic manifests under platform/kafka/topics; a policy run in CI over the manifests refuses a topic whose cleanup policy deletes and whose retention is shorter than the limit (a purely compacted topic keeps the latest state per key and passes).',
      tool: 'Conftest (Open Policy Agent, rego.v1) over the KafkaTopic manifests; for a managed Kafka declared in Terraform: the same rule over the config of confluent_kafka_topic resources in terraform show -json',
      language: 'rego',
      snippet: `package main
import rego.v1

min_ms := {{RETENTION_DAYS}} * 24 * 60 * 60 * 1000

deny contains msg if {
  input.kind == "KafkaTopic"
  cfg := object.get(input.spec, "config", {})
  contains(object.get(cfg, "cleanup.policy", "delete"), "delete")   # "delete" and "compact,delete" both delete
  retention := to_number(object.get(cfg, "retention.ms", 604800000))
  retention >= 0
  retention < min_ms
  msg := sprintf("topic %s keeps events less than {{RETENTION_DAYS}} days", [input.metadata.name])
}`,
    },
    {
      id: 'ff-openapi', label: 'Call contracts linted', when: { SYNC_API: ['rest'] }, category: 'structural', implements: ['adr-rest'], checks: ['req-contracts'],
      threshold: '0 errors or warnings from the house ruleset on every OpenAPI document',
      description: 'Spectral lints every part\'s OpenAPI document with the built-in OpenAPI ruleset plus the house rules (operation ids, problem+json errors) and fails the build on a warning.',
      tool: 'Spectral (spectral:oas); for Buf-generated OpenAPI from .proto files the same ruleset applies',
      language: 'yaml',
      snippet: `# .spectral.yaml   —   npx -y @stoplight/spectral-cli lint "services/*/openapi.yaml" --fail-severity warn
extends: ["spectral:oas"]
rules:
  operation-operationId: error
  errors-use-problem-json:
    description: Every error response is application/problem+json
    given: "$.paths.*.*.responses[?(@property >= '400')].content"
    then: { field: "application/problem+json", function: truthy }
    severity: error`,
    },
    {
      id: 'ff-buf', label: 'Proto contracts checked', when: { SYNC_API: ['grpc'] }, category: 'structural', implements: ['adr-grpc'], checks: ['req-contracts'],
      threshold: '0 buf lint errors and 0 breaking changes against the main branch in the .proto files',
      description: 'Buf lints every .proto file with its STANDARD rules and compares them with the main branch, failing on a field number reused, a field removed or a type changed. Deadlines are set by the house client wrapper, not by the contract.',
      tool: 'Buf (buf lint, buf breaking)',
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
      id: 'ff-breaking', label: 'No breaking contract change', when: { CONTRACTS: ['spec'] }, category: 'structural', implements: ['adr-contract-diffs'], checks: ['req-contract-diff'],
      threshold: '0 breaking changes against the main branch in OpenAPI and AsyncAPI documents',
      description: 'For each changed contract, CI compares the new version with the one on main: oasdiff for OpenAPI, the AsyncAPI CLI\'s diff for AsyncAPI (Buf covers .proto files, see Proto contracts checked). A breaking change fails the build.',
      tool: 'oasdiff (breaking --fail-on ERR) and AsyncAPI CLI (diff, which exits with an error on a breaking change)',
      language: 'bash',
      snippet: `set -euo pipefail
for doc in services/*/openapi.yaml; do
  git show "origin/main:$doc" > base.yaml 2>/dev/null || continue   # new contract
  oasdiff breaking --fail-on ERR base.yaml "$doc"
done
for doc in services/*/asyncapi.yaml; do
  git show "origin/main:$doc" > base.yaml 2>/dev/null || continue
  npx -y @asyncapi/cli diff base.yaml "$doc" --type breaking --format json   # exits non-zero on a breaking change
done`,
    },
    {
      id: 'ff-pact', label: 'Consumers\' pacts pass', when: { CONTRACTS: ['pact'] }, category: 'process', implements: ['adr-consumer-contracts'], checks: ['req-pacts'],
      threshold: '100% of the pacts of consumer versions on main or deployed verified in every provider build; 0 deploys without a passing can-i-deploy answer',
      description: 'Every provider build verifies the pacts of its consumers (HTTP interactions with the Verifier, messages with MessageProviderPact) and publishes the result to the Pact Broker; the deploy job runs can-i-deploy first and records the deployment after.',
      tool: 'Pact (pact-js Verifier and MessageProviderPact; for gRPC the pact-protobuf-plugin through pact-js\'s plugin API, PactV4) and the Pact Broker CLI from @pact-foundation/pact-cli; for the JVM: pact-jvm\'s @PactBroker provider tests with the same CLI',
      language: 'ts',
      snippet: `import { Verifier } from '@pact-foundation/pact'
import { it } from 'vitest'

it('honours every consumer\\'s pact', () =>
  new Verifier({
    provider: 'ordering',
    providerBaseUrl: 'http://localhost:8080',
    pactBrokerUrl: process.env.PACT_BROKER_URL,
    pactBrokerToken: process.env.PACT_BROKER_TOKEN,
    consumerVersionSelectors: [{ mainBranch: true }, { deployedOrReleased: true }],
    publishVerificationResult: true,
    providerVersion: process.env.GIT_SHA,
    providerVersionBranch: process.env.GIT_BRANCH,
  }).verifyProvider())

// deploy job, before and after deploying (the one CLI; \`npx pact-broker\` alone does not exist):
//   npx --package=@pact-foundation/pact-cli pact-broker can-i-deploy --pacticipant ordering --version "$GIT_SHA" \\
//     --to-environment production --broker-base-url "$PACT_BROKER_URL" --broker-token "$PACT_BROKER_TOKEN" \\
//     --retry-while-unknown 6 --retry-interval 10
//   ./deploy.sh services/ordering
//   npx --package=@pact-foundation/pact-cli pact-broker record-deployment --pacticipant ordering --version "$GIT_SHA" \\
//     --environment production --broker-base-url "$PACT_BROKER_URL" --broker-token "$PACT_BROKER_TOKEN"`,
    },
    workflowCheck('ff-workflow', { FLOWS: ['orchestration'] }, 'adr-orchestration', 'req-orchestrated'),
    workflowCheck('ff-workflow-fallback', ORCHESTRATED_FALLBACK, 'adr-orchestration-fallback', 'req-orchestrated-fallback'),
    {
      id: 'ff-stuck-flows', label: 'Stuck flows alerted', when: CHOREOGRAPHY, category: 'operational', implements: ['adr-choreography'], checks: ['req-choreographed'],
      threshold: '0 flow instances open longer than {{FLOW_MINUTES}} minutes without an alert',
      description: 'A process monitor subscribes to the start and end events of each documented flow, correlated by id, and exports the age of the oldest open instance per flow as flow_oldest_open_instance_seconds; the alert names the flow and goes to the owner of the step expected next.',
      tool: 'Prometheus alerting rule (the gauge is exported by the process monitor)',
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
    {
      id: 'ff-local-flows', label: 'No write crosses a part', when: { FLOWS: ['local'] }, category: 'holistic', implements: ['adr-local-flows'], checks: ['req-local-flows'],
      threshold: '0 client spans with a mutating method (POST, PUT, PATCH, DELETE) between parts in the traces of the journeys that change data',
      description: 'From the same traces as the depth check, the test lists the HTTP client spans of each data-changing journey and fails on one whose method changes data in another part; reads between parts pass. For gRPC the mutating methods are named in a list instead of taken from the HTTP method.',
      tool: 'Vitest with Jaeger (test/e2e/traces.ts); for the JVM: the same test with JUnit 5',
      language: 'ts',
      snippet: `import { expect, it } from 'vitest'
import { journeys } from './journeys'
import { newTraceId, trace, traceparent } from './traces'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

it.each(journeys.filter((j) => j.changesData))('$name changes data in one part only', async (journey) => {
  const traceId = newTraceId()
  await journey.run({ traceparent: traceparent(traceId) })
  const spans = await trace(traceId)
  const writesElsewhere = spans
    .filter((s) => s.rpc && MUTATING.has(s.method ?? ''))
    .map((client) => ({ from: client.service, to: spans.find((s) => s.kind === 'server' && s.parent === client.id)?.service, method: client.method }))
    .filter((c) => c.to !== undefined)   // a system outside is not a part
  expect(writesElsewhere).toEqual([])
})`,
    },
  ],
}

export default pack
