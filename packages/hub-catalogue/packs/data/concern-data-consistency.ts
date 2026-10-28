import type { PackSpec, When } from '../../src/packSpec'

const MODEL_ADRS = ['adr-acid', 'adr-outbox', 'adr-saga']
const MESSAGING: When = { MODEL: ['outbox', 'saga'] }
const FORCES = 'This element writes to stores and queues, and one business operation often changes several records, sometimes in several stores or services. The forces: a crash between two writes leaves half an operation behind; writing to a database and then to a broker (a dual write) loses or invents events when either fails; concurrent transactions at the default isolation level lose updates and break invariants that span rows; brokers deliver at least once, so every message may come twice; replicas and caches lag, so a user may not see what they just saved; and when several elements write the same data, nobody knows which copy is the truth.'

const pack: PackSpec = {
  id: 'concern-data-consistency',
  name: 'Data consistency',
  group: 'data',
  description: 'How one business operation stays all-or-nothing across records, stores and services: transactions, isolation, events, sagas, and what readers may see. Which element writes each table is decided in the Decomposition pack; how consumers absorb duplicates in the Messaging pack.',
  tags: ['consistency', 'transactions', 'isolation', 'outbox', 'saga', 'replicas'],
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
    { title: 'Garcia-Molina and Salem, Sagas (SIGMOD 1987)', url: 'https://dl.acm.org/doi/10.1145/38713.38742' },
    { title: 'Terry et al., Session Guarantees for Weakly Consistent Replicated Data (1994)', url: 'https://ieeexplore.ieee.org/document/331722' },
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
        { value: 'ryw', label: 'replicas with read-your-writes', description: 'Reads go to replicas, but a user who has just written reads from the primary or from a replica that has caught up with their write. Pick it when reads must scale and users must see their own changes at once.' },
        { value: 'bounded', label: 'replicas and caches with bounded staleness', description: 'Reads may be a few seconds old, never more than a stated bound, and decisions that write are taken on the primary. Pick it for catalogues, dashboards and feeds where a few seconds do not matter.' },
      ],
    },
  ],
  details: [
    { key: 'PROPAGATION_SECONDS', label: 'How many seconds may others see the old state after a commit? (the outbox relay\'s lag and a replica\'s staleness alike)', default: '5', number: true },
    { key: 'SAGA_MINUTES', label: 'Within how many minutes must a saga complete or be compensated? (sagas only)', default: '15', number: true },
  ],
  need: {
    label: 'Operations all-or-nothing',
    text: 'A business operation (placing an order, booking a slot, moving money) changes several records, often in more than one store or service. Whatever fails, and however many requests run at once, it must happen entirely or not at all, the rules that span records must hold, nothing may be told to others that did not happen (or be left untold), and people must see what they have just done. The snippets assume the application under src/ (src/orders the operations, src/db the transaction helper and data sources, src/outbox the relay, src/workflows the sagas) and the tests under tests/ with their fixtures beside them.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-atomic', label: 'One transaction per operation', when: { MODEL: ['acid'] }, ears_type: 'ubiquitous',
      action: 'change every record of one business operation in a single database transaction, so that after a crash at any point either all of its changes are visible or none',
      rationale: 'Atomicity of a single transaction is the simplest guarantee there is; it holds only while every record is in one database (PostgreSQL docs, Transaction Isolation; Jepsen consistency models).',
      scenario: { label: 'Crash mid-operation', given: 'an order that reserves stock and creates an invoice', when: 'the process is killed after the reservation and before the invoice', then: 'neither the reservation nor the invoice exists after restart' },
    },
    {
      id: 'req-outbox', label: 'Events published with the change', when: MESSAGING, ears_type: 'event-driven',
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
      precondition: 'a read is served from a replica or a cache',
      action: 'return data no older than {{PROPAGATION_SECONDS}} seconds, stop routing reads to a replica that lags more, and take every decision that writes on the primary',
      rationale: 'Bounded staleness keeps the gain of replicas while capping how wrong a reader can be (Jepsen: consistency models); decisions on stale data cause lost updates.',
      scenario: { label: 'Lagging replica dropped', given: 'a replica whose lag grows past {{PROPAGATION_SECONDS}} seconds', when: 'reads arrive', then: 'they go to the primary or another replica until it catches up' },
    },
  ],
  adrs: [
    {
      id: 'adr-acid', label: 'One database transaction per operation', when: { MODEL: ['acid'] },
      decision: 'Each business operation runs in one database transaction (PostgreSQL, MySQL InnoDB or SQL Server), opened and committed by one unit of work at the application\'s edge: Spring @Transactional, EF Core SaveChanges, Prisma $transaction or a hand-written withTransaction. No call to another service or broker happens inside it. Isolation: {{ISOLATION}}. Reads: {{READS}}. Which element writes each table is decided in the Decomposition pack. Rules that span rows are database constraints where SQL can state them.',
      consequences: '• All-or-nothing comes from the database, with no extra machinery.\n• Every record the operation changes must stay in that database: splitting it into services later means revisiting this decision.\n• Long transactions hold locks: work that is slow or calls out happens before or after, not inside.\n• Nothing outside the database learns of the change atomically; once events are needed, an outbox is.',
      alternatives: '1. A transactional outbox: the same transaction plus reliable events for others.\n2. A saga: when the data is spread over services.\n3. Distributed transactions (XA, two-phase commit): atomic across stores, but blocking, rarely supported by brokers and cloud services.',
    },
    {
      id: 'adr-outbox', label: 'Transactional outbox', when: { MODEL: ['outbox'] },
      decision: 'State changes and the events that announce them are written in one local transaction: the event goes to an outbox table, and a relay publishes it to the broker within {{PROPAGATION_SECONDS}} seconds, then marks it sent. The relay is change data capture with Debezium (its outbox event router) when Kafka Connect is already run, otherwise a polling publisher, or the framework\'s outbox (Spring Modulith event publication registry, MassTransit or NServiceBus outbox). Nothing publishes to the broker directly. Delivery is at least once; consumers absorb duplicates as decided in the Messaging pack. Isolation: {{ISOLATION}}. Reads: {{READS}}. Which element writes each table is decided in the Decomposition pack.',
      consequences: '• No lost or invented events: an event exists if and only if its change committed.\n• Delivery is at least once, so every consumer must be idempotent (the Messaging pack decides how).\n• Others see the change up to {{PROPAGATION_SECONDS}} seconds later; the relay\'s lag must be watched.\n• The outbox table needs cleaning up, and event order holds only per aggregate key.',
      alternatives: '1. Publish after commit (dual write): simpler, but a crash between commit and publish loses the event.\n2. Event sourcing: the events are the state, which removes the dual write but changes the whole persistence model.\n3. Two-phase commit between database and broker: blocking and seldom supported.',
    },
    {
      id: 'adr-saga', label: 'Sagas with compensation', when: { MODEL: ['saga'] },
      decision: 'An operation that changes data in several services runs as an orchestrated saga: each step a local transaction in its own service, each with a compensating step, the saga\'s state durable so it resumes after a restart. The orchestrator is Temporal, AWS Step Functions, Camunda 8 or MassTransit state machines: Temporal when the team writes workflows in code and runs it itself or on Temporal Cloud, Step Functions on AWS for few steps and managed operation, Camunda when business owners read and change BPMN. Choreography by events only for two or three steps. Records the saga changes stay pending until it completes; a saga not done within {{SAGA_MINUTES}} minutes is compensated. The orchestrator calls each step over its own durable queue; each step\'s own state change and the events it emits go through that service\'s transactional outbox, and consumers absorb duplicates as decided in the Messaging pack. Isolation of each local transaction: {{ISOLATION}}. Reads: {{READS}}. Which element writes each table is decided in the Decomposition pack.',
      consequences: '• Each service keeps its own database and its own transactions.\n• No isolation between sagas: others see pending states, and the design has to say what they may do with them.\n• Every step needs a compensating step that cannot fail for good, which is real design work (refunds, releases, cancellation notices).\n• An orchestrator is one more system to run and to keep available.',
      alternatives: '1. Put the data in one database and use one transaction: simpler, if the service boundaries allow.\n2. Distributed transactions (XA, two-phase commit): atomic but blocking, and rarely available across services and SaaS APIs.\n3. Choreography without an orchestrator: no central component, but the flow is hard to see and to change past three steps.',
    },
    {
      id: 'adr-read-committed', label: 'Read Committed with version checks', when: { ISOLATION: ['read-committed'] },
      decision: 'Transactions run at Read Committed, the database\'s default. Every read-modify-write carries a version column checked in the UPDATE\'s WHERE clause (optimistic locking: JPA @Version, EF Core concurrency tokens, Prisma or a hand-written version = $expected), or locks the row with SELECT ... FOR UPDATE where the write always follows the read; a conflict is reported to the caller with the current version. Rules over several rows are database constraints.',
      consequences: '• The cheapest level: no serialization aborts, no retry loop in every transaction.\n• Every read-modify-write must remember its version or lock: one forgotten is a lost update.\n• Rules that span rows cannot be enforced by the level and need a constraint or an explicit lock.',
      alternatives: '1. Repeatable Read (snapshot isolation): consistent multi-row reads, write skew remains.\n2. Serializable: no anomalies, at the cost of aborts and retries.',
    },
    {
      id: 'adr-snapshot', label: 'Repeatable Read (snapshot isolation)', when: { ISOLATION: ['snapshot'] },
      decision: 'Transactions run at Repeatable Read (PostgreSQL snapshot isolation, SQL Server SNAPSHOT), so each sees one consistent snapshot and a concurrent update of the same row aborts one of them, which is retried up to 3 times. Rules over a set of rows (one booking per slot, a balance never negative) are enforced with a unique, exclusion or check constraint, or by locking the rows read with SELECT ... FOR UPDATE, because snapshot isolation allows write skew.',
      consequences: '• Reports and multi-row reads are consistent without locks.\n• Every cross-row rule needs a constraint or a lock: the level does not protect it.\n• Concurrent updates of the same row abort: a retry loop is needed where that is common.\n• Long snapshots hold back vacuum in PostgreSQL: keep transactions short.',
      alternatives: '1. Read Committed with version checks: cheaper, no consistent multi-row reads.\n2. Serializable: write skew is caught by the database, with more aborts.',
    },
    {
      id: 'adr-serializable', label: 'Serializable', when: { ISOLATION: ['serializable'] },
      decision: 'Transactions run at Serializable (PostgreSQL SSI, CockroachDB, Spanner), so the database guarantees the effect of some serial order and aborts a transaction that would break it. Every transaction is wrapped in one retry helper that retries a serialization failure (SQLSTATE 40001) or deadlock (40P01) up to 3 times with jittered backoff and reports a conflict only after the last attempt; the helper is the only way to open a transaction. Transactions stay short and touch few rows, so aborts stay rare.',
      consequences: '• Invariants that span rows hold without a constraint or lock for each.\n• A retry rate to watch: above a few percent, p99 latency rises and the hot rows need redesign.\n• Every transaction must be safe to run again from the start: no side effects before the commit.\n• PostgreSQL SSI costs memory for predicate locks on large scans.',
      alternatives: '1. Repeatable Read with constraints: fewer aborts, every cross-row rule stated by hand.\n2. Read Committed with version checks: cheapest, protects single rows only.',
    },
    {
      id: 'adr-reads-primary', label: 'Reads from the primary only', when: { READS: ['primary'] },
      decision: 'Every read is served from the primary; no read replica or cache stands between the application and committed data. The application configures one connection pool and no read-only data source. Replicas, if any exist, serve backups and analytics only. Revisit when the primary\'s read load passes 60% of its capacity for a week.',
      consequences: '• A read after a commit always returns it: no session guarantees to build.\n• The primary carries every read: vertical scaling and query tuning are the levers.\n• No replica routing to get wrong.',
      alternatives: '1. Replicas with read-your-writes: reads scale, users still see their own changes.\n2. Replicas and caches with bounded staleness: the most scale, a stated staleness for everyone.',
    },
    {
      id: 'adr-ryw', label: 'Replicas with read-your-writes', when: { READS: ['ryw'] },
      decision: 'Reads go to replicas through a router (the framework\'s read/write splitting, pgpool, ProxySQL or application code) that keeps, per user session, the position of their last commit (PostgreSQL LSN, MySQL GTID); a read within {{PROPAGATION_SECONDS}} seconds of that commit goes to the primary, or to a replica that has replayed past the position. A replica lagging more than {{PROPAGATION_SECONDS}} seconds is taken out of rotation.',
      consequences: '• Reads scale with replicas and users see what they just saved.\n• The router is on every request and has to carry the session\'s position (a cookie or token claim).\n• Other users still see changes late, up to the replica lag.\n• A replica\'s lag is an alert and a routing signal at once.',
      alternatives: '1. The primary only: no router, no lag, less scale.\n2. Bounded staleness for everyone: simpler router, and a user may miss their own write for a few seconds.',
    },
    {
      id: 'adr-bounded', label: 'Replicas and caches with bounded staleness', when: { READS: ['bounded'] },
      decision: 'Reads are served from replicas and caches and may be up to {{PROPAGATION_SECONDS}} seconds old; the router takes a replica out of rotation when its lag passes that bound, and cache entries expire within it. Every decision that writes (a stock check before a reservation, a balance before a transfer) is taken on the primary inside the writing transaction, never on a replica or cache read.',
      consequences: '• The most read scale, with a staleness the product can state.\n• A user may not see their own change for a few seconds: the interface has to cope (optimistic updates, a "saving" state).\n• Any write that trusts a replica read is a lost update waiting to happen: the primary-only rule for decisions needs a review check.\n• Cache invalidation is bounded by expiry, not by correctness.',
      alternatives: '1. Replicas with read-your-writes: users see their own changes, at the cost of a session-aware router.\n2. The primary only: no staleness, no scale from replicas.',
    },
  ],
  fitness: [
    {
      id: 'ff-concurrency', label: 'Invariants hold under concurrency', category: 'structural', implements: [...MODEL_ADRS, 'adr-read-committed', 'adr-snapshot', 'adr-serializable'], checks: ['req-write-skew'],
      threshold: '0 lost updates or broken invariants in 1,000 concurrent attempts against a real database at the chosen isolation level',
      description: 'An integration test runs many concurrent operations that compete for the same records against the real database engine (not an in-memory fake), at the isolation level and with the retries of the decision, and checks the invariant afterwards.',
      tool: 'Vitest with Testcontainers (PostgreSQL)',
      language: 'ts',
      snippet: `import { db } from './db'
import { placeOrder } from '../src/orders/placeOrder'

it('never sells more than is in stock', async () => {
  await db.query("update stock set available = 10 where sku = 'A'")
  const attempts = Array.from({ length: 1000 }, () => placeOrder({ sku: 'A', quantity: 1 }).then(() => 1, () => 0))
  const sold = (await Promise.all(attempts)).reduce((a, b) => a + b, 0)
  const { rows } = await db.query("select available from stock where sku = 'A'")
  expect(sold).toBe(10)
  expect(rows[0].available).toBe(0)
})`,
    },
    {
      id: 'ff-lost-update', label: 'Second writer gets a conflict', when: { ISOLATION: ['read-committed'] }, category: 'structural', implements: ['adr-read-committed'], checks: ['req-lost-update'],
      threshold: 'Of two updates from the same version, exactly 1 commits and 1 is refused with a conflict naming the current version',
      description: 'An integration test reads one order at version 7 in two sessions, saves from both, and expects one success and one conflict that carries the current version; it runs against the real database.',
      tool: 'Vitest with Testcontainers (PostgreSQL)',
      language: 'ts',
      snippet: `import { orders } from '../src/orders/repository'
import { seedOrder } from './db'

it('refuses the second update from the same version', async () => {
  const id = await seedOrder({ version: 7 })
  const [first, second] = await Promise.allSettled([
    orders.update(id, { note: 'first' }, { expectedVersion: 7 }),
    orders.update(id, { note: 'second' }, { expectedVersion: 7 }),
  ])
  const outcomes = [first, second].map((r) => r.status).sort()
  expect(outcomes).toEqual(['fulfilled', 'rejected'])
  const rejected = [first, second].find((r) => r.status === 'rejected') as PromiseRejectedResult
  expect(rejected.reason).toMatchObject({ name: 'ConflictError', currentVersion: 8 })
})`,
    },
    {
      id: 'ff-serialization-retry', label: 'Serialization failures retried', when: { ISOLATION: ['serializable'] }, category: 'structural', implements: ['adr-serializable'], checks: ['req-serializable'],
      threshold: 'The transaction helper retries SQLSTATE 40001 and 40P01 up to 3 times and reports a conflict after the 4th failure',
      description: 'A unit test gives the retry helper a transaction body that fails with 40001 twice and then succeeds, expects 3 attempts, then one that always fails and expects a conflict after 4 attempts. The helper is the only way to open a transaction, which code review keeps.',
      tool: 'Vitest',
      language: 'ts',
      snippet: `import { withSerializableRetry } from '../src/db/transaction'

const serializationFailure = () => Object.assign(new Error('could not serialize access'), { code: '40001' })

it('retries a serialization failure and gives up after the third retry', async () => {
  let attempts = 0
  const flaky = async () => { attempts++; if (attempts < 3) throw serializationFailure(); return 'ok' }
  await expect(withSerializableRetry(flaky)).resolves.toBe('ok')
  expect(attempts).toBe(3)

  attempts = 0
  const hopeless = async () => { attempts++; throw serializationFailure() }
  await expect(withSerializableRetry(hopeless)).rejects.toMatchObject({ name: 'ConflictError' })
  expect(attempts).toBe(4)
})`,
    },
    {
      id: 'ff-atomic', label: 'No half operations', when: { MODEL: ['acid'] }, category: 'structural', implements: ['adr-acid'], checks: ['req-atomic'],
      threshold: '0 records left behind when an operation fails at any of its steps',
      description: 'An integration test makes the operation fail after each of its writes in turn and checks that none of its records exist afterwards.',
      tool: 'Vitest with Testcontainers (PostgreSQL)',
      language: 'ts',
      snippet: `import { placeOrder } from '../src/orders/placeOrder'
import { count } from './db'

it.each(['afterReservation', 'afterInvoice', 'beforeCommit'])('leaves nothing when it fails %s', async (step) => {
  const failAt = { [step]: () => { throw new Error('injected') } }
  await expect(placeOrder({ sku: 'A', quantity: 1 }, { hooks: failAt })).rejects.toThrow('injected')
  expect(await count('reservations')).toBe(0)
  expect(await count('invoices')).toBe(0)
})`,
    },
    {
      id: 'ff-no-dual-write', label: 'Only the relay publishes', when: MESSAGING, category: 'structural', implements: ['adr-outbox', 'adr-saga'], checks: ['req-outbox'],
      threshold: '0 modules outside the outbox relay that import a broker client',
      description: 'A dependency rule fails the build when code outside the relay imports a broker client, which would be a dual write that can lose or invent events.',
      tool: 'dependency-cruiser (or the equivalent for your stack: ArchUnit, NetArchTest)',
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
      id: 'ff-outbox-test', label: 'Events follow commits only', when: MESSAGING, category: 'structural', implements: ['adr-outbox', 'adr-saga'], checks: ['req-outbox'],
      threshold: 'A committed change has its event on the broker within {{PROPAGATION_SECONDS}} seconds of the broker\'s return; a rolled-back change has 0 events',
      description: 'An integration test stops the broker, places an order (committed) and makes a second one roll back, restarts the broker and reads the topic: the first order\'s event arrives within the bound, the second never.',
      tool: 'Vitest with Testcontainers (PostgreSQL and the broker)',
      language: 'ts',
      snippet: `import { placeOrder } from '../src/orders/placeOrder'
import { broker, topic } from './broker'    // the broker container and a consumer of the events topic

it('publishes committed changes only, once the broker is back', async () => {
  await broker.stop()
  const committed = await placeOrder({ sku: 'A', quantity: 1 })
  await expect(placeOrder({ sku: 'A', quantity: 1 }, { hooks: { beforeCommit: () => { throw new Error('injected') } } })).rejects.toThrow()
  await broker.start()
  const events = await topic.collect({ seconds: {{PROPAGATION_SECONDS}} })
  expect(events.map((e) => e.orderId)).toEqual([committed.id])
})`,
    },
    {
      id: 'ff-outbox-lag', label: 'Outbox drained in time', when: MESSAGING, category: 'operational', implements: ['adr-outbox', 'adr-saga'], checks: ['req-outbox'],
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
      id: 'ff-saga', label: 'Sagas compensate', when: { MODEL: ['saga'] }, category: 'structural', implements: ['adr-saga'], checks: ['req-saga'],
      threshold: 'For every step of every saga, a failure there runs the compensations of all earlier steps in reverse order, and 0 steps without a compensation test',
      description: 'A workflow test makes each step fail in turn on a time-skipping test server and checks that the completed steps were compensated in reverse order. The Temporal form is below; the same test is written with Step Functions Local, Camunda zeebe-process-test or the MassTransit test harness.',
      tool: 'Temporal TypeScript SDK (@temporalio/testing); for Step Functions: Step Functions Local with mocked service integrations; for Camunda 8: zeebe-process-test; for MassTransit: the in-memory test harness',
      language: 'ts',
      snippet: `import { fileURLToPath } from 'node:url'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { placeOrder } from '../src/workflows'

const steps = [
  { name: 'reserveStock', compensations: [] },
  { name: 'chargePayment', compensations: ['releaseStock'] },
  { name: 'shipOrder', compensations: ['refundPayment', 'releaseStock'] },
]

it.each(steps)('compensates everything before $name in reverse order', async (failing) => {
  const env = await TestWorkflowEnvironment.createTimeSkipping()
  const done: string[] = []
  const record = (name: string) => async () => { if (name === failing.name) throw new Error('fails for good'); done.push(name) }
  const worker = await Worker.create({
    connection: env.nativeConnection, taskQueue: 'test',
    workflowsPath: fileURLToPath(new URL('../src/workflows', import.meta.url)),
    activities: Object.fromEntries(['reserveStock', 'chargePayment', 'shipOrder', 'releaseStock', 'refundPayment'].map((n) => [n, record(n)])),
  })
  await worker.runUntil(env.client.workflow.execute(placeOrder, { taskQueue: 'test', workflowId: \`order-\${failing.name}\`, args: [{ sku: 'A' }] }).catch(() => undefined))
  expect(done.filter((n) => failing.compensations.includes(n))).toEqual(failing.compensations)
  await env.teardown()
})`,
    },
    {
      id: 'ff-saga-resume', label: 'Sagas resume after a restart', when: { MODEL: ['saga'] }, category: 'structural', implements: ['adr-saga'], checks: ['req-saga-state'],
      threshold: 'A saga stopped after its second step continues from the third on a new worker, with 0 steps repeated, and the order stays pending until the saga completes',
      description: 'A workflow test stops the worker once the second activity has completed, starts a new worker, and checks that the saga finishes with each step run exactly once and that the order\'s status was pending until the end.',
      tool: 'Temporal TypeScript SDK (@temporalio/testing); for other orchestrators, the equivalent restart of the engine or harness mid-flow',
      language: 'ts',
      snippet: `import { fileURLToPath } from 'node:url'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { placeOrder } from '../src/workflows'
import { orders } from '../src/orders/repository'

it('continues from the third step on a new worker', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping()
  const done: string[] = []
  let secondDone!: () => void
  const afterSecond = new Promise<void>((r) => { secondDone = r })
  const activities = {
    reserveStock: async () => { done.push('reserve') },
    chargePayment: async () => { done.push('charge'); secondDone() },
    shipOrder: async () => { done.push('ship'); expect((await orders.get('order-1')).status).toBe('pending') },
    notify: async () => { done.push('notify') },
  }
  const options = { connection: env.nativeConnection, taskQueue: 'test', workflowsPath: fileURLToPath(new URL('../src/workflows', import.meta.url)), activities }
  const first = await Worker.create(options)
  const handle = await env.client.workflow.start(placeOrder, { taskQueue: 'test', workflowId: 'order-1', args: [{ sku: 'A' }] })
  const run = first.run()
  await afterSecond
  first.shutdown()
  await run
  const second = await Worker.create(options)
  await second.runUntil(handle.result())
  expect(done).toEqual(['reserve', 'charge', 'ship', 'notify'])
  expect((await orders.get('order-1')).status).toBe('completed')
  await env.teardown()
})`,
    },
    {
      id: 'ff-stuck-sagas', label: 'No stuck sagas', when: { MODEL: ['saga'] }, category: 'operational', implements: ['adr-saga'], checks: ['req-saga'],
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
      id: 'ff-reads-primary', label: 'Reads hit the primary', when: { READS: ['primary'] }, category: 'structural', implements: ['adr-reads-primary'], checks: ['req-read-primary'],
      threshold: 'Every connection pool the application opens reports pg_is_in_recovery() = false; 0 read-only data sources configured',
      description: 'A test starts the application\'s data access with its production configuration shape, asks every pool it opened whether it is on a replica, and checks that no read-only data source is configured.',
      tool: 'Vitest with Testcontainers (PostgreSQL primary and a replica, to make the check meaningful)',
      language: 'ts',
      snippet: `import { dataSources } from '../src/db/dataSources'   // every pool the application opens, by name

it('serves every read from the primary', async () => {
  expect(Object.keys(dataSources.readOnly ?? {})).toEqual([])
  for (const [name, pool] of Object.entries(dataSources.all())) {
    const { rows } = await pool.query('select pg_is_in_recovery() as replica')
    expect(rows[0].replica, \`pool \${name} points at a replica\`).toBe(false)
  }
})`,
    },
    {
      id: 'ff-ryw', label: 'Own writes read back', when: { READS: ['ryw'] }, category: 'structural', implements: ['adr-ryw'], checks: ['req-ryw'],
      threshold: '0 of 100 write-then-read pairs return the old value while replicas lag',
      description: 'An integration test delays replication on purpose (a paused WAL replay on the replica) and checks that a user\'s read straight after their write still returns it.',
      tool: 'Vitest with Testcontainers (PostgreSQL primary and replica)',
      language: 'ts',
      snippet: `import { api, replica, user } from './replicas'

it('shows a user their own write while the replica lags', async () => {
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
      id: 'ff-staleness', label: 'Replica lag bounded and routed', when: { READS: ['ryw', 'bounded'] }, category: 'operational', implements: ['adr-ryw', 'adr-bounded'], checks: ['req-bounded', 'req-ryw'],
      threshold: 'Replica lag above {{PROPAGATION_SECONDS}} seconds for no more than 1 minute; a replica lagging more than that receives no reads for more than 1 minute',
      description: 'The PostgreSQL exporter reports each replica\'s lag, and the read router exports replica_in_rotation (1 while it sends reads to the replica); Prometheus alerts when the lag passes the bound, and pages when a lagging replica is still in rotation.',
      tool: 'Prometheus with postgres_exporter (pg_replication_lag_seconds) and the router\'s own replica_in_rotation gauge',
      language: 'yaml',
      snippet: `groups:
  - name: data-consistency
    rules:
      - alert: ReplicaTooStale
        expr: pg_replication_lag_seconds > {{PROPAGATION_SECONDS}}
        for: 1m
        labels: { severity: ticket }
        annotations:
          summary: 'Replica {{ $labels.instance }} is more than {{PROPAGATION_SECONDS}} s behind'
      - alert: StaleReplicaStillServingReads
        expr: (pg_replication_lag_seconds > {{PROPAGATION_SECONDS}}) and on (instance) (replica_in_rotation == 1)
        for: 1m
        labels: { severity: page }
        annotations:
          summary: 'Replica {{ $labels.instance }} lags past the bound and still receives reads'`,
    },
  ],
}

export default pack
