import type { PackSpec, When } from '../../src/packSpec'

const ALL_ADRS = ['adr-acid', 'adr-outbox', 'adr-saga']
const MESSAGING: When = { MODEL: ['outbox', 'saga'] }
const FORCES = 'This element writes to stores and queues, and one business operation often changes several records, sometimes in several stores or services. The forces: a crash between two writes leaves half an operation behind; writing to a database and then to a broker (a dual write) loses or invents events when either fails; concurrent transactions at the default isolation level lose updates and break invariants that span rows; brokers deliver at least once, so every message may come twice; replicas and caches lag, so a user may not see what they just saved; and when several elements write the same data, nobody knows which copy is the truth.'

const pack: PackSpec = {
  id: 'concern-data-consistency',
  name: 'Data consistency',
  group: 'data',
  description: 'How one business operation stays all-or-nothing across records, stores and services: transactions, isolation, events, sagas, and what readers may see.',
  tags: ['consistency', 'transactions', 'isolation', 'outbox', 'saga', 'idempotency'],
  concern: {
    id: 'data-consistency',
    trigger: 'LIST RELATIONS WHERE (source.type = "container" OR source.type = "component" OR source.type = "webapp" OR source.type = "system") AND source.external != true AND (target.type = "database" OR target.type = "queue") AND target.external != true',
    applyTo: 'source',
    why: 'these elements write to stores or queues, so how an operation that changes several records stays consistent, and what readers may see meanwhile, has to be decided.',
  },
  sources: [
    { title: 'microservices.io: Pattern: Saga', url: 'https://microservices.io/patterns/data/saga.html' },
    { title: 'microservices.io: Pattern: Transactional outbox', url: 'https://microservices.io/patterns/data/transactional-outbox.html' },
    { title: 'PostgreSQL documentation: Transaction Isolation', url: 'https://www.postgresql.org/docs/current/transaction-iso.html' },
    { title: 'Jepsen: Consistency Models', url: 'https://jepsen.io/consistency' },
  ],
  questions: [
    {
      key: 'MODEL', title: 'Transactions', label: 'How does an operation that changes several records stay all-or-nothing?',
      hint: 'Decided by where the records live: one database can do it in one transaction; a database plus a queue needs an outbox; several services\' databases need a saga.',
      default: 'outbox',
      options: [
        { value: 'acid', label: 'one ACID transaction', description: 'Every record the operation changes is in one database this element owns, and nothing outside it must learn of the change atomically. Pick it for a monolith or a modular monolith on one database.' },
        { value: 'outbox', label: 'a local transaction with a transactional outbox', description: 'The change is in one database, and others learn of it through a queue: the event is written in the same transaction and published afterwards. Pick it when the element writes a database and publishes events, as an order service does.' },
        { value: 'saga', label: 'a saga with compensating steps', description: 'One business operation changes data owned by several services or an external system, each with its own transaction; a failed step undoes the earlier ones. Pick it when no single database holds everything the operation changes.' },
      ],
    },
    {
      key: 'ISOLATION', title: 'Isolation', label: 'At what isolation level do transactions run?',
      hint: 'The level decides which anomalies concurrent transactions can produce: lost updates at Read Committed, write skew at snapshot isolation, none at Serializable, which in turn aborts transactions that must be retried.',
      default: 'read-committed',
      options: [
        { value: 'read-committed', label: 'Read Committed with version checks', description: 'The default of PostgreSQL, SQL Server and Oracle; read-modify-write is protected by a version column or SELECT ... FOR UPDATE. Pick it when invariants are on single rows and contention is low or moderate.' },
        { value: 'snapshot', label: 'Repeatable Read (snapshot isolation)', description: 'Each transaction sees one snapshot; concurrent updates of the same row abort one of them, but write skew across rows remains. Pick it for reports and multi-row reads that must be consistent, with constraints for cross-row rules.' },
        { value: 'serializable', label: 'Serializable', description: 'The database guarantees the result of some serial order (PostgreSQL SSI, CockroachDB, Spanner); conflicting transactions abort and are retried. Pick it when invariants span rows (no double booking, balances never negative) and you can retry.' },
      ],
    },
    {
      key: 'READS', title: 'Reads', label: 'Where are reads served from?',
      hint: 'Replicas and caches take load off the primary, but lag behind it: a user may not see what they just saved, or two pages may disagree.',
      default: 'primary',
      options: [
        { value: 'primary', label: 'the primary only', description: 'Every read sees every committed write. Pick it while the primary can carry the reads, which is longer than most expect.' },
        { value: 'ryw', label: 'replicas, with read-your-writes', description: 'Reads go to replicas, but a user who has just written reads from the primary or from a replica that has caught up with their write. Pick it when reads must scale and users must see their own changes at once.' },
        { value: 'bounded', label: 'replicas and caches, with bounded staleness', description: 'Reads may be a few seconds old, never more than a stated bound, and decisions that write are taken on the primary. Pick it for catalogues, dashboards and feeds where a few seconds do not matter.' },
      ],
    },
    {
      key: 'OWNERSHIP', title: 'Source of truth', label: 'Who may write each entity?',
      hint: 'When several elements write the same tables, every invariant has to hold in all of them, and a change of schema is a change to all of them.',
      default: 'owner',
      options: [
        { value: 'owner', label: 'one owning element per entity', description: 'Each entity has one element that writes it; others ask its API or keep read-only copies fed by its events. Pick it for services with their own databases, and for modules of a monolith that should be separable.' },
        { value: 'shared', label: 'a database shared by several elements', description: 'Several elements write the same tables. Pick it only for an existing system where splitting is not yet possible; invariants then have to live in the database itself.' },
      ],
    },
  ],
  details: [
    { key: 'PROPAGATION_SECONDS', label: 'How many seconds may others see the old state after a commit?', default: '5', number: true },
    { key: 'IDEMPOTENCY_HOURS', label: 'For how many hours are processed message ids remembered?', default: '72', number: true },
    { key: 'SAGA_MINUTES', label: 'Within how many minutes must a saga complete or be compensated?', default: '15', number: true },
  ],
  need: {
    label: 'Operations all-or-nothing',
    text: 'A business operation (placing an order, booking a slot, moving money) changes several records, often in more than one store or service. Whatever fails, and however many requests run at once, it must happen entirely or not at all, the rules that span records must hold, nothing may be told to others that did not happen (or be left untold), and people must see what they have just done.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-atomic', label: 'One transaction per operation', when: { MODEL: ['acid'] }, ears_type: 'ubiquitous',
      action: 'change every record of one business operation in a single database transaction, so that after a crash at any point either all of its changes are visible or none',
      rationale: 'Atomicity of a single transaction is the simplest guarantee there is; it holds only while every record is in one database (PostgreSQL docs, Transactions; Jepsen consistency models).',
      scenario: { label: 'Crash mid-operation', given: 'an order that reserves stock and creates an invoice', when: 'the process is killed after the reservation and before the invoice', then: 'neither the reservation nor the invoice exists after restart' },
    },
    {
      id: 'req-outbox', label: 'Events published with the change', when: { MODEL: ['outbox'] }, ears_type: 'event-driven',
      trigger: 'a transaction changes state that other elements must learn about',
      action: 'write the event to an outbox table in the same transaction, publish it to the queue within {{PROPAGATION_SECONDS}} seconds of the commit, and publish no event whose transaction rolled back',
      rationale: 'A dual write to a database and a broker loses or invents events when either fails; the transactional outbox makes the event part of the commit (microservices.io, Transactional outbox).',
      scenario: { label: 'Event follows commit', given: 'an order placed while the broker is down', when: 'the broker comes back, and another order\'s transaction rolls back', then: 'the first order\'s event is published within {{PROPAGATION_SECONDS}} seconds of the broker\'s return; the second has no event' },
    },
    {
      id: 'req-saga', label: 'Failed sagas compensated', when: { MODEL: ['saga'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a step of a saga fails for good, or the saga has not completed within {{SAGA_MINUTES}} minutes',
      action: 'run the compensating step of every completed step in reverse order, record the saga\'s outcome, and alert the owner when a compensation itself fails',
      rationale: 'A saga has no rollback: each step commits locally, so a failure is undone by compensating transactions (microservices.io, Saga; Garcia-Molina and Salem, Sagas, 1987).',
      scenario: { label: 'Payment fails, stock released', given: 'a saga that reserved stock and then fails to charge the card', when: 'the payment step fails for good', then: 'the stock is released, the order is marked failed, and nothing remains reserved after {{SAGA_MINUTES}} minutes' },
    },
    {
      id: 'req-saga-state', label: 'Saga state durable and visible', when: { MODEL: ['saga'] }, ears_type: 'ubiquitous',
      action: 'keep each saga\'s step and outcome in durable storage so that a restart resumes it, and mark the records it changes as pending until it completes, so that no other operation acts on a half-done state',
      rationale: 'Sagas lack isolation: other transactions see intermediate states; a semantic lock (a pending state) is the usual countermeasure (microservices.io, Saga, countermeasures).',
      scenario: { label: 'Saga resumes', given: 'a saga stopped by a deployment after its second of four steps', when: 'the service starts again', then: 'the saga continues from its third step, and the order stays pending until it completes' },
    },
    {
      id: 'req-idempotent', label: 'Duplicates have no effect', when: MESSAGING, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a consumer receives a message it has already processed',
      action: 'acknowledge it without a second effect, recognising it by its message id, which is remembered for at least {{IDEMPOTENCY_HOURS}} hours in the same transaction as the effect',
      rationale: 'Brokers and outbox relays deliver at least once, so duplicates are normal; an idempotent consumer makes them harmless (microservices.io, Idempotent consumer).',
      scenario: { label: 'Message delivered twice', given: 'an OrderPlaced message already processed', when: 'it is delivered again an hour later', then: 'it is acknowledged and nothing is charged, reserved or sent a second time' },
    },
    {
      id: 'req-lost-update', label: 'No lost updates', when: { ISOLATION: ['read-committed'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'two transactions update the same record from the same version',
      action: 'commit the first and reject the second with a conflict, by checking a version column in the UPDATE\'s WHERE clause or locking the row with SELECT ... FOR UPDATE',
      rationale: 'At Read Committed a read-modify-write cycle loses one of two concurrent updates (PostgreSQL docs, Transaction Isolation, Read Committed; Jepsen: lost update).',
      scenario: { label: 'Concurrent edits', given: 'two users editing the same order at version 7', when: 'both save', then: 'one save succeeds and the other gets a conflict with the current version' },
    },
    {
      id: 'req-write-skew', label: 'No write skew', when: { ISOLATION: ['snapshot'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'two concurrent transactions each read a set of rows and then write different rows of it, breaking a rule over the set',
      action: 'enforce that rule with a database constraint (unique, exclusion or check) or by locking the rows read with SELECT ... FOR UPDATE, and retry a transaction aborted by a serialization failure up to 3 times',
      rationale: 'Snapshot isolation (PostgreSQL Repeatable Read) prevents lost updates but allows write skew across rows (PostgreSQL docs, Transaction Isolation; Jepsen: snapshot isolation, G2-item).',
      scenario: { label: 'Double booking prevented', given: 'one free slot', when: 'two customers book it at the same moment', then: 'exactly one booking is stored' },
    },
    {
      id: 'req-serializable', label: 'Serialization failures retried', when: { ISOLATION: ['serializable'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a transaction fails with a serialization failure (SQLSTATE 40001) or a deadlock (40P01)',
      action: 'retry it from the start up to 3 times with jittered backoff, and report a conflict to the caller only after the last attempt fails',
      rationale: 'Serializable isolation guarantees the effect of some serial order by aborting conflicting transactions; applications must be prepared to retry them (PostgreSQL docs, Transaction Isolation, Serializable).',
      scenario: { label: 'Conflict retried', given: 'two transfers from the same account running at once', when: 'one is aborted with SQLSTATE 40001', then: 'it is retried and succeeds, and the balance is never negative' },
    },
    {
      id: 'req-read-primary', label: 'Reads see every commit', when: { READS: ['primary'] }, ears_type: 'ubiquitous',
      action: 'serve every read from the primary, so that a read started after a commit returns that commit',
      rationale: 'Reading from the primary gives linearizable reads for a single-leader database without further design (Jepsen: consistency models).',
      scenario: { label: 'Saved and seen', given: 'a user who has just saved an address', when: 'the next page loads', then: 'it shows the new address' },
    },
    {
      id: 'req-ryw', label: 'Users see their own writes', when: { READS: ['ryw'] }, ears_type: 'event-driven',
      trigger: 'a user who has written within the last {{PROPAGATION_SECONDS}} seconds reads',
      action: 'serve the read from the primary, or from a replica that has replayed at least the position of the user\'s last commit (LSN or GTID)',
      rationale: 'Read-your-writes is the session guarantee users notice when it is missing (Jepsen: read your writes; Terry et al., Session Guarantees, 1994).',
      scenario: { label: 'Own change visible', given: 'replicas lagging 3 seconds behind', when: 'a user saves an address and reloads at once', then: 'the reload shows the new address' },
    },
    {
      id: 'req-bounded', label: 'Staleness bounded', when: { READS: ['bounded'] }, ears_type: 'state-driven',
      precondition: 'while a read is served from a replica or a cache',
      action: 'return data no older than {{PROPAGATION_SECONDS}} seconds, stop routing reads to a replica that lags more, and take every decision that writes on the primary',
      rationale: 'Bounded staleness keeps the gain of replicas while capping how wrong a reader can be (Jepsen: consistency models); decisions on stale data cause lost updates.',
      scenario: { label: 'Lagging replica dropped', given: 'a replica whose lag grows past {{PROPAGATION_SECONDS}} seconds', when: 'reads arrive', then: 'they go to the primary or another replica until it catches up' },
    },
    {
      id: 'req-owner', label: 'One writer per entity', when: { OWNERSHIP: ['owner'] }, ears_type: 'ubiquitous',
      action: 'let only the owning element write each entity\'s records, enforced by database roles, and let other elements read it through the owner\'s API or keep read-only copies fed by its events',
      rationale: 'A single source of truth per entity keeps every invariant in one place (microservices.io, Database per service).',
      scenario: { label: 'Other writer refused', given: 'the orders table owned by the order service', when: 'the inventory service tries to update an order', then: 'the database refuses the write' },
    },
    {
      id: 'req-shared', label: 'Shared tables guarded', when: { OWNERSHIP: ['shared'] }, ears_type: 'ubiquitous',
      action: 'enforce every invariant of a table that several elements write with database constraints (primary and foreign keys, unique, check, exclusion), and list for each such table the elements that write it',
      rationale: 'Application code in several elements cannot keep a rule consistently; the database is the only place all writers pass (PostgreSQL docs, Constraints).',
      scenario: { label: 'Constraint holds', given: 'two services writing order lines', when: 'one inserts a line for an order that does not exist', then: 'the database refuses it' },
    },
  ],
  adrs: [
    {
      id: 'adr-acid', label: 'One database transaction per operation', when: { MODEL: ['acid'] },
      decision: 'Each business operation runs in one database transaction (PostgreSQL, MySQL InnoDB or SQL Server), opened and committed by one unit of work at the application\'s edge: Spring @Transactional, EF Core SaveChanges, Prisma $transaction or a hand-written withTransaction. No call to another service or broker happens inside it. Isolation: {{ISOLATION}}. Reads: {{READS}}. Writers: {{OWNERSHIP}}. Rules that span rows are database constraints where SQL can state them.',
      consequences: '• All-or-nothing comes from the database, with no extra machinery.\n• Every record the operation changes must stay in that database: splitting it into services later means revisiting this decision.\n• Long transactions hold locks: work that is slow or calls out happens before or after, not inside.\n• Nothing outside the database learns of the change atomically; once events are needed, an outbox is.',
      alternatives: '1. A transactional outbox: the same transaction plus reliable events for others.\n2. A saga: when the data is spread over services.\n3. Distributed transactions (XA, two-phase commit): atomic across stores, but blocking, rarely supported by brokers and cloud services.',
    },
    {
      id: 'adr-outbox', label: 'Transactional outbox', when: { MODEL: ['outbox'] },
      decision: 'State changes and the events that announce them are written in one local transaction: the event goes to an outbox table, and a relay publishes it to the broker within {{PROPAGATION_SECONDS}} seconds, then marks it sent. The relay is change data capture with Debezium (its outbox event router) when Kafka Connect is already run, otherwise a polling publisher, or the framework\'s outbox (Spring Modulith event publication registry, MassTransit or NServiceBus outbox). Nothing publishes to the broker directly. Consumers are idempotent: they remember message ids for {{IDEMPOTENCY_HOURS}} hours in the same transaction as their effect. Isolation: {{ISOLATION}}. Reads: {{READS}}. Writers: {{OWNERSHIP}}.',
      consequences: '• No lost or invented events: an event exists if and only if its change committed.\n• Delivery is at least once, so every consumer must be idempotent.\n• Others see the change up to {{PROPAGATION_SECONDS}} seconds later; the relay\'s lag must be watched.\n• The outbox table needs cleaning up, and event order holds only per aggregate key.',
      alternatives: '1. Publish after commit (dual write): simpler, but a crash between commit and publish loses the event.\n2. Event sourcing: the events are the state, which removes the dual write but changes the whole persistence model.\n3. Two-phase commit between database and broker: blocking and seldom supported.',
    },
    {
      id: 'adr-saga', label: 'Sagas with compensation', when: { MODEL: ['saga'] },
      decision: 'An operation that changes data in several services runs as an orchestrated saga: each step a local transaction in its own service, each with a compensating step, the saga\'s state durable so it resumes after a restart. The orchestrator is Temporal, AWS Step Functions, Camunda 8 or MassTransit state machines: Temporal when the team writes workflows in code and runs it itself or on Temporal Cloud, Step Functions on AWS for few steps and managed operation, Camunda when business owners read and change BPMN. Choreography by events only for two or three steps. Records the saga changes stay pending until it completes; a saga not done within {{SAGA_MINUTES}} minutes is compensated. Steps talk through the transactional outbox, and consumers remember message ids for {{IDEMPOTENCY_HOURS}} hours. Isolation of each local transaction: {{ISOLATION}}. Reads: {{READS}}. Writers: {{OWNERSHIP}}.',
      consequences: '• Each service keeps its own database and its own transactions.\n• No isolation between sagas: others see pending states, and the design has to say what they may do with them.\n• Every step needs a compensating step that cannot fail for good, which is real design work (refunds, releases, cancellation notices).\n• An orchestrator is one more system to run and to keep available.',
      alternatives: '1. Put the data in one database and use one transaction: simpler, if the service boundaries allow.\n2. Distributed transactions (XA, two-phase commit): atomic but blocking, and rarely available across services and SaaS APIs.\n3. Choreography without an orchestrator: no central component, but the flow is hard to see and to change past three steps.',
    },
  ],
  fitness: [
    {
      id: 'ff-concurrency', label: 'Invariants hold under concurrency', category: 'structural', implements: ALL_ADRS,
      threshold: '0 lost updates or broken invariants in 1,000 concurrent attempts against a real database at the chosen isolation level',
      description: 'An integration test runs many concurrent operations that compete for the same records against the real database engine (not an in-memory fake), at the isolation level and with the retries of the decision, and checks the invariant afterwards.',
      tool: 'Vitest with Testcontainers (PostgreSQL)',
      language: 'ts',
      snippet: `it('never sells more than is in stock', async () => {
  await db.query("update stock set available = 10 where sku = 'A'")
  const attempts = Array.from({ length: 1000 }, () => placeOrder({ sku: 'A', quantity: 1 }).then(() => 1, () => 0))
  const sold = (await Promise.all(attempts)).reduce((a, b) => a + b, 0)
  const { rows } = await db.query("select available from stock where sku = 'A'")
  expect(sold).toBe(10)
  expect(rows[0].available).toBe(0)
})`,
    },
    {
      id: 'ff-atomic', label: 'No half operations', when: { MODEL: ['acid'] }, category: 'structural', implements: ['adr-acid'],
      threshold: '0 records left behind when an operation fails at any of its steps',
      description: 'An integration test makes the operation fail after each of its writes in turn and checks that none of its records exist afterwards.',
      tool: 'Vitest with Testcontainers (PostgreSQL)',
      language: 'ts',
      snippet: `it.each(['afterReservation', 'afterInvoice', 'beforeCommit'])('leaves nothing when it fails %s', async (step) => {
  const failAt = { [step]: () => { throw new Error('injected') } }
  await expect(placeOrder({ sku: 'A', quantity: 1 }, { hooks: failAt })).rejects.toThrow('injected')
  expect(await count('reservations')).toBe(0)
  expect(await count('invoices')).toBe(0)
})`,
    },
    {
      id: 'ff-no-dual-write', label: 'Only the relay publishes', when: MESSAGING, category: 'structural', implements: ['adr-outbox', 'adr-saga'],
      threshold: '0 modules outside the outbox relay that import a broker client',
      description: 'A dependency rule fails the build when code outside the relay imports a broker client, which would be a dual write that can lose or invent events.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'publish-through-outbox',
    comment: 'ADR Transactional outbox: write to the outbox table; only the relay talks to the broker',
    severity: 'error',
    from: { pathNot: '^src/outbox/relay' },
    to: { path: 'node_modules/(kafkajs|amqplib|@aws-sdk/client-sqs|@aws-sdk/client-sns|@azure/service-bus|@google-cloud/pubsub)' },
  }],
}`,
    },
    {
      id: 'ff-outbox-lag', label: 'Outbox drained in time', when: { MODEL: ['outbox'] }, category: 'operational', implements: ['adr-outbox'],
      threshold: 'The oldest unpublished outbox row is never older than {{PROPAGATION_SECONDS}} seconds for more than 2 minutes',
      description: 'The database exporter reports the age of the oldest unpublished outbox row; Prometheus pages when the relay falls behind, before consumers notice.',
      tool: 'Prometheus with sql_exporter',
      language: 'yaml',
      snippet: `# sql_exporter collector
collector_name: outbox
metrics:
  - metric_name: outbox_oldest_unpublished_seconds
    type: gauge
    help: 'Age of the oldest event not yet published'
    values: [age]
    query: |
      SELECT coalesce(extract(epoch FROM now() - min(created_at)), 0) AS age FROM outbox WHERE published_at IS NULL
---
# Prometheus alerting rule
groups:
  - name: data-consistency
    rules:
      - alert: OutboxBehind
        expr: outbox_oldest_unpublished_seconds > {{PROPAGATION_SECONDS}}
        for: 2m
        labels: { severity: page }`,
    },
    {
      id: 'ff-idempotent', label: 'Duplicates absorbed', when: MESSAGING, category: 'structural', implements: ['adr-outbox', 'adr-saga'],
      threshold: 'Every consumer, given each message twice, produces exactly the effects of one delivery',
      description: 'A test for each consumer delivers every message it handles twice, including a redelivery after a simulated crash before the acknowledgement, and compares the effects with a single delivery.',
      tool: 'Vitest with Testcontainers (PostgreSQL and the broker)',
      language: 'ts',
      snippet: `describe.each(consumers)('%s', (consumer) => {
  it('has the same effect for a message delivered twice', async () => {
    const message = consumer.sampleMessage()
    await consumer.handle(message)
    const once = await snapshotEffects()
    await consumer.handle(message)                       // redelivery
    expect(await snapshotEffects()).toEqual(once)
  })
})`,
    },
    {
      id: 'ff-saga', label: 'Sagas compensate', when: { MODEL: ['saga'] }, category: 'structural', implements: ['adr-saga'],
      threshold: 'For every step of every saga, a failure there runs the compensations of all earlier steps in reverse order, and 0 steps without a compensation test',
      description: 'A workflow test makes each step fail in turn on a time-skipping test server and checks that the completed steps were compensated in reverse order.',
      tool: 'Temporal TypeScript SDK (@temporalio/testing)',
      language: 'ts',
      snippet: `import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { placeOrder } from '../src/workflows'

it('releases the stock when the payment fails', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping()
  const done: string[] = []
  const worker = await Worker.create({
    connection: env.nativeConnection, taskQueue: 'test',
    workflowsPath: require.resolve('../src/workflows'),
    activities: {
      reserveStock: async () => { done.push('reserve') },
      releaseStock: async () => { done.push('release') },
      chargePayment: async () => { throw new Error('card declined') },
    },
  })
  await worker.runUntil(env.client.workflow.execute(placeOrder, { taskQueue: 'test', workflowId: 'order-1', args: [{ sku: 'A' }] }).catch(() => undefined))
  expect(done).toEqual(['reserve', 'release'])
  await env.teardown()
})`,
    },
    {
      id: 'ff-stuck-sagas', label: 'No stuck sagas', when: { MODEL: ['saga'] }, category: 'operational', implements: ['adr-saga'],
      threshold: '0 sagas open for more than {{SAGA_MINUTES}} minutes',
      description: 'The database exporter counts sagas neither completed nor compensated after the limit; Prometheus pages when there is one, since the records it holds stay pending.',
      tool: 'Prometheus with sql_exporter',
      language: 'yaml',
      snippet: `# sql_exporter collector
collector_name: sagas
metrics:
  - metric_name: sagas_overdue
    type: gauge
    help: 'Sagas open longer than allowed'
    values: [n]
    query: |
      SELECT count(*) AS n FROM saga_instance
      WHERE status NOT IN ('completed', 'compensated') AND started_at < now() - interval '{{SAGA_MINUTES}} minutes'
---
groups:
  - name: data-consistency
    rules:
      - alert: SagaStuck
        expr: sagas_overdue > 0
        for: 5m
        labels: { severity: page }`,
    },
    {
      id: 'ff-ryw', label: 'Own writes read back', when: { READS: ['ryw'] }, category: 'structural', implements: ALL_ADRS,
      threshold: '0 of 100 write-then-read pairs return the old value while replicas lag',
      description: 'An integration test delays replication on purpose (a paused WAL replay on the replica) and checks that a user\'s read straight after their write still returns it.',
      tool: 'Vitest with Testcontainers (PostgreSQL primary and replica)',
      language: 'ts',
      snippet: `it('shows a user their own write while the replica lags', async () => {
  await replica.query('select pg_wal_replay_pause()')
  for (let i = 0; i < 100; i++) {
    await api.as(user).put('/me/address', { street: \`Street \${i}\` })
    const { body } = await api.as(user).get('/me/address')
    expect(body.street).toBe(\`Street \${i}\`)
  }
  await replica.query('select pg_wal_replay_resume()')
})`,
    },
    {
      id: 'ff-staleness', label: 'Replica lag bounded', when: { READS: ['ryw', 'bounded'] }, category: 'operational', implements: ALL_ADRS,
      threshold: 'Replica lag above {{PROPAGATION_SECONDS}} seconds for no more than 1 minute; a lagging replica receives no reads',
      description: 'The PostgreSQL exporter reports each replica\'s lag; Prometheus alerts when it passes the bound, and the read router takes the replica out of rotation on the same signal.',
      tool: 'Prometheus with postgres_exporter',
      language: 'yaml',
      snippet: `groups:
  - name: data-consistency
    rules:
      - alert: ReplicaTooStale
        expr: pg_replication_lag_seconds > {{PROPAGATION_SECONDS}}
        for: 1m
        labels: { severity: ticket }
        annotations:
          summary: 'Replica {{ $labels.instance }} is more than {{PROPAGATION_SECONDS}} s behind'`,
    },
    {
      id: 'ff-owner', label: 'Only owners write', when: { OWNERSHIP: ['owner'] }, category: 'structural', implements: ALL_ADRS,
      threshold: '0 roles other than the owner\'s with INSERT, UPDATE or DELETE on an entity\'s tables',
      description: 'A database test run in CI after the migrations asserts the privileges of every role on each entity\'s tables: the owner writes, others at most read.',
      tool: 'pgTAP (run with pg_prove)',
      language: 'sql',
      snippet: `BEGIN;
SELECT plan(3);
SELECT table_privs_are('public', 'orders', 'order_service', ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
SELECT table_privs_are('public', 'orders', 'inventory_service', ARRAY['SELECT'], 'inventory reads orders, never writes');
SELECT table_privs_are('public', 'orders', 'reporting', ARRAY['SELECT']);
SELECT * FROM finish();
ROLLBACK;`,
    },
    {
      id: 'ff-constraints', label: 'Shared rules in the database', when: { OWNERSHIP: ['shared'] }, category: 'structural', implements: ALL_ADRS,
      threshold: 'Every rule listed for a shared table is a constraint in the schema; 0 rules kept only in application code',
      description: 'A database test run in CI after the migrations asserts that the keys, references and checks the shared tables rely on exist, so no writer can bypass them.',
      tool: 'pgTAP (run with pg_prove)',
      language: 'sql',
      snippet: `BEGIN;
SELECT plan(4);
SELECT has_pk('public', 'order_lines', 'order lines have a key');
SELECT fk_ok('public', 'order_lines', 'order_id', 'public', 'orders', 'id');
SELECT col_is_unique('public', 'orders', ARRAY['customer_id', 'external_ref'], 'one order per external reference');
SELECT has_check('public', 'stock', 'stock cannot go negative');
SELECT * FROM finish();
ROLLBACK;`,
    },
  ],
}

export default pack
