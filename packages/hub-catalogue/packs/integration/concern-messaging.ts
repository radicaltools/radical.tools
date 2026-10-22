import type { PackSpec, When } from '../../src/packSpec'

const LEAST: When = { DELIVERY: ['least'] }
const BROKER_ADRS = ['adr-kafka', 'adr-rabbitmq', 'adr-sqs']
const FORCES = 'Parts of the system, or other systems, talk through this queue instead of calling each other. The forces: brokers and networks redeliver, so a message may arrive twice, and avoiding that loses messages instead (exactly once does not exist end to end); a change committed to the database and its message sent to the broker are two writes, and a crash between them keeps one without the other; parallel consumers reorder messages unless order is asked for, and global order does not scale; a message that always fails either blocks the ones behind it or vanishes; producers and consumers are released apart, so a message schema changes while old messages are still waiting; and a backlog grows silently until someone notices that nothing has happened for an hour.'

const pack: PackSpec = {
  id: 'concern-messaging',
  name: 'Messaging',
  group: 'integration',
  description: 'Messages through queues and topics: how often each is delivered, whether order matters, which broker carries them, how their schemas change, what happens to one that cannot be handled, and how a message and its change stay together.',
  tags: ['messaging', 'queues', 'events', 'kafka', 'rabbitmq', 'sqs', 'idempotency', 'outbox', 'dead-letter', 'schema-registry'],
  concern: {
    id: 'messaging',
    trigger: 'LIST NODES WHERE type = "queue" AND external != true',
    why: 'messages pass through these queues, so how often each is delivered, in what order, and what happens to one that cannot be handled has to be decided.',
  },
  sources: [
    { title: 'Enterprise Integration Patterns, Dead Letter Channel', url: 'https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html' },
    { title: 'microservices.io, Transactional outbox', url: 'https://microservices.io/patterns/data/transactional-outbox.html' },
    { title: 'microservices.io, Idempotent Consumer', url: 'https://microservices.io/patterns/communication-style/idempotent-consumer.html' },
    { title: 'AsyncAPI Specification', url: 'https://www.asyncapi.com/docs/reference/specification/latest' },
    { title: 'CloudEvents specification', url: 'https://cloudevents.io/' },
    { title: 'Confluent, Schema Evolution and Compatibility', url: 'https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html' },
  ],
  questions: [
    {
      key: 'DELIVERY', title: 'Delivery', label: 'How often may a message be delivered?',
      hint: 'Exactly once does not exist across a network: either a message may come twice, or it may be lost. This decides which.',
      default: 'least',
      options: [
        { value: 'least', label: 'at least once', description: 'Nothing is lost: the broker redelivers until a consumer acknowledges, so a message may arrive twice and every consumer must recognise one it has handled; producers send through an outbox. Pick it whenever a message changes a record: orders, payments, stock.' },
        { value: 'most', label: 'at most once', description: 'A message is never redelivered, so a crash can lose one; consumers stay simple. Pick it only for messages whose loss changes no record: notifications soon superseded, metrics, cache invalidations with an expiry behind them.' },
      ],
    },
    {
      key: 'ORDER', title: 'Order', label: 'Does the order of messages matter?',
      hint: 'Order across all messages does not scale; order per key (per order, per account) is usually what is needed, and costs parallelism within a key.',
      default: 'key',
      options: [
        { value: 'key', label: 'in order per key', description: 'Messages with the same key (an order id, an account id) are handled one at a time in the order sent; different keys in parallel. Pick it when a later message depends on an earlier one: created, paid, shipped.' },
        { value: 'none', label: 'in any order', description: 'Consumers run in parallel freely; each message carries a version so a stale one is recognised and ignored. Pick it when messages are independent of each other or carry the whole state of what they describe.' },
      ],
    },
    {
      key: 'BROKER', title: 'Broker', label: 'Which broker carries the messages?',
      hint: 'A log keeps messages to be read again; a queue hands each to one consumer and forgets it. Choose by fan-out, replay, volume and who runs it.',
      default: 'kafka',
      options: [
        { value: 'kafka', label: 'Apache Kafka', description: 'A replicated log: messages are kept for days and can be replayed, order holds per partition, throughput reaches hundreds of thousands a second. Pick it for event streams read by several consumers, replay or rebuilding read models, or very high volume; run as Confluent Cloud, Amazon MSK, Aiven or Strimzi.' },
        { value: 'rabbitmq', label: 'RabbitMQ', description: 'Queues with flexible routing through exchanges, acknowledgement per message and built-in dead-lettering; quorum queues replicate. Pick it for commands and work queues between services, routing by type or header, and moderate volume (thousands a second); run yourself or as CloudAMQP or Amazon MQ.' },
        { value: 'sqs', label: 'Amazon SQS', description: 'A managed queue with nothing to operate: redrive to a dead-letter queue built in, FIFO queues for order per message group, SNS in front for fan-out. Pick it on AWS when each queue has one consuming service and replay is not needed.' },
      ],
    },
    {
      key: 'SCHEMA', title: 'Schemas', label: 'How do message schemas change safely?',
      hint: 'Producers and consumers are released apart, and old messages wait in the queue while new code reads them: each schema change has to be readable both ways.',
      default: 'registry',
      options: [
        { value: 'registry', label: 'a schema registry', description: 'Schemas (Avro, Protobuf or JSON Schema) are registered with a compatibility mode, and the registry refuses an incompatible version when a producer registers it: Confluent Schema Registry or Apicurio for Kafka, AWS Glue Schema Registry on AWS. Pick it when several teams produce or consume the same messages, or messages are kept and replayed long after they were written.' },
        { value: 'repo', label: 'schemas in the repository', description: 'Messages are described in an AsyncAPI document with JSON Schema in the producer\'s repository, and CI refuses a breaking change. Pick it when one team owns the producer and its few consumers, or the broker has no registry.' },
      ],
    },
  ],
  details: [
    { key: 'MAX_ATTEMPTS', label: 'After how many failed attempts is a message set aside?', default: '5', number: true },
    { key: 'DLQ_HOURS', label: 'Within how many hours must a set-aside message be replayed or discarded?', default: '24', number: true },
    { key: 'LAG_MINUTES', label: 'How old may the oldest waiting message get before someone is alerted (minutes)?', default: '5', number: true },
    { key: 'DEDUPE_DAYS', label: 'For how many days does a consumer remember the messages it has handled?', default: '7', number: true },
  ],
  need: {
    label: 'Messages arrive and count once',
    text: 'Parts of the system talk through queues. A message can be delivered twice, lost, arrive out of order, or fail every time it is handled; the change it reports can commit while the message is never sent; a producer can change a message so that a consumer released last month cannot read it. Each of these quietly corrupts data, and a stuck consumer looks like silence, unless it is decided how each is handled.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-envelope', label: 'Messages identify themselves', ears_type: 'ubiquitous',
      action: 'give every message a unique id, its type, its schema version, its source, the time it was produced and a correlation id, as CloudEvents attributes',
      rationale: 'Deduplication, ordering checks, tracing and replay all need these, and a common envelope means every consumer finds them in the same place (CloudEvents specification).',
      scenario: { label: 'Envelope complete', given: 'each message type a producer sends', when: 'one of each is read from the queue', then: 'each carries id, type, schema version, source, time and correlation id, and no two ids are equal' },
    },
    {
      id: 'req-dedupe', label: 'Duplicates handled once', when: LEAST, ears_type: 'ubiquitous',
      action: 'handle a message delivered more than once as once, by recording its id in the same transaction as its effect and keeping the ids for {{DEDUPE_DAYS}} days',
      rationale: 'At-least-once delivery means duplicates; recording the id with the effect is what makes the second delivery harmless even after a crash (microservices.io, Idempotent Consumer).',
      scenario: { label: 'Duplicate ignored', given: 'a consumer that has handled a message', when: 'the same message is delivered again, once right away and once after a restart', then: 'state is as after one delivery, and the duplicates are counted' },
    },
    {
      id: 'req-outbox', label: 'Message sent with its change', when: LEAST, ears_type: 'ubiquitous',
      action: 'write each message to an outbox table in the same database transaction as the change it reports, and relay it to the broker from there, so that neither the change nor the message exists without the other',
      rationale: 'Writing to the database and then to the broker loses one of the two in a crash between; the outbox makes them one write (microservices.io, Transactional outbox).',
      scenario: { label: 'Crash between write and send', given: 'a change committed with its message in the outbox', when: 'the process crashes before the message reaches the broker, and restarts', then: 'the message is sent after the restart, and a rolled-back change sends nothing' },
    },
    {
      id: 'req-dlq', label: 'Failing messages set aside', when: LEAST, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'handling a message fails {{MAX_ATTEMPTS}} times',
      action: 'move it to a dead-letter queue with the error and the number of attempts, go on with the next messages, and alert the consumer\'s owner, who replays or discards it within {{DLQ_HOURS}} hours',
      rationale: 'One poisoned message must neither block the rest nor vanish (Enterprise Integration Patterns, Dead Letter Channel).',
      scenario: { label: 'Poison message set aside', given: 'a message its consumer always fails on', when: 'it has failed {{MAX_ATTEMPTS}} times', then: 'it is in the dead-letter queue with its error, the owner is alerted, and the messages behind it are handled' },
    },
    {
      id: 'req-lossy', label: 'Only losable messages', when: { DELIVERY: ['most'] }, ears_type: 'ubiquitous',
      action: 'carry only message types listed as losable, whose loss changes no record, and drop a message whose handling fails without retrying it, counting the drops per type',
      rationale: 'At-most-once delivery loses messages by design; the list keeps a message that matters from being sent through it by accident.',
      scenario: { label: 'Unlisted type refused', given: 'the list of losable message types', when: 'a producer sends a type on the list, a type not on it, and a consumer fails on one message', then: 'the first is delivered, the second is refused at the producer, and the failed one is dropped and counted' },
    },
    {
      id: 'req-order', label: 'Order kept per key', when: { ORDER: ['key'] }, ears_type: 'ubiquitous',
      action: 'publish every message with its key (the order id, the account id), and handle the messages of one key one at a time in the order they were published, while different keys run in parallel',
      rationale: 'Applying "paid" before "created" breaks the record; order per key keeps it without giving up parallelism across keys (Enterprise Integration Patterns, Resequencer and Message Sequence).',
      scenario: { label: 'Order of one key kept', given: 'three messages for one order published in sequence among a thousand for other orders', when: 'four consumers handle them in parallel', then: 'the three are handled in the order published' },
    },
    {
      id: 'req-stale', label: 'Stale messages ignored', when: { ORDER: ['none'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a message arrives carrying a version older than the one the record it changes already holds',
      action: 'ignore it and count it, so that the result does not depend on the order of delivery',
      rationale: 'Without order, a late message would overwrite a newer state; a version on each message makes any order give the same result.',
      scenario: { label: 'Late message ignored', given: 'a record at version 3', when: 'a message with version 2 for it arrives', then: 'the record stays at version 3 and the stale message is counted' },
    },
    {
      id: 'req-schema-registry', label: 'Incompatible schemas refused', when: { SCHEMA: ['registry'] }, ears_type: 'event-driven',
      trigger: 'a producer registers a new version of a message schema',
      action: 'check it against every earlier version under the subject\'s compatibility mode (BACKWARD_TRANSITIVE by default, FULL_TRANSITIVE when consumers may upgrade first) and refuse an incompatible one before any message uses it',
      rationale: 'Old messages wait in the queue and are replayed long after; a transitive check keeps every version readable (Confluent, Schema Evolution and Compatibility).',
      scenario: { label: 'Removed field refused', given: 'a subject in BACKWARD_TRANSITIVE mode with three versions', when: 'a producer registers a version that removes a field without a default', then: 'the registry refuses it and the producer\'s build fails' },
    },
    {
      id: 'req-schema-repo', label: 'Breaking schema change refused', when: { SCHEMA: ['repo'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request changes a message in the AsyncAPI document so that a consumer of the last release cannot read it (a field removed, renamed or retyped, or a new required field)',
      action: 'fail the build, and accept the change only as a new message type or channel version published beside the old one',
      rationale: 'Producers and consumers are released apart; the document is the contract both build against (AsyncAPI Specification).',
      scenario: { label: 'Breaking change fails', given: 'a pull request that renames a field of a message', when: 'the schema check compares it with the last release', then: 'the build fails, and passes once the change is a new message version' },
    },
    {
      id: 'req-lag', label: 'Backlog alerted', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the oldest message waiting for a consumer is older than {{LAG_MINUTES}} minutes',
      action: 'alert the owner of that consumer',
      rationale: 'A stopped or slow consumer looks like silence; the age of the oldest message is the one number that shows it (AWS ApproximateAgeOfOldestMessage, consumer lag in Kafka).',
      scenario: { label: 'Stuck consumer alerted', given: 'a consumer that has stopped', when: 'messages wait longer than {{LAG_MINUTES}} minutes', then: 'its owner is alerted' },
    },
  ],
  adrs: [
    {
      id: 'adr-least', label: 'At-least-once delivery with idempotent consumers', when: LEAST,
      decision: 'Messages are delivered at least once. Producers write each message to an outbox table in the transaction of the change it reports, and a relay publishes it (Debezium reading the outbox, or a polling relay of the framework: Spring Modulith, MassTransit, NServiceBus outbox). Every message carries CloudEvents attributes; consumers record each id in the transaction of its effect and keep the ids for {{DEDUPE_DAYS}} days. A message that fails {{MAX_ATTEMPTS}} times, with backoff between attempts, goes to a dead-letter queue and its owner is alerted, to replay or discard it within {{DLQ_HOURS}} hours. Consumers handle messages {{ORDER}}.',
      consequences: '• No message is lost, and no change is published without its message or the other way round.\n• Every consumer keeps a table of handled ids, written in the same transaction as its effect.\n• The outbox relay is a moving part to run and watch; messages leave a little after the commit.\n• Dead letters need an owner, a tool to replay them and a deadline.',
      alternatives: '1. At most once: simpler consumers, but messages are lost.\n2. A distributed transaction (XA) across the database and the broker: rarely supported by modern brokers, slow, and couples their availability.\n3. Kafka transactions (exactly-once within Kafka): only for read-process-write that stays inside Kafka; the database still needs the outbox.',
    },
    {
      id: 'adr-most', label: 'At-most-once delivery for losable messages', when: { DELIVERY: ['most'] },
      context: `${FORCES} Here the messages are notifications, metrics or hints whose loss changes no record.`,
      decision: 'Messages are delivered at most once: acknowledged on receipt (auto-ack, or offsets committed before handling) and never redelivered; a failed message is dropped and counted. Only message types on the losable list, kept in the code, may be published; anything that changes a record needs this decision superseded by at-least-once delivery first. Every message still carries CloudEvents attributes. Consumers handle messages {{ORDER}}.',
      consequences: '• Simple consumers: no handled-id table, no dead letters, no outbox.\n• A crash or a deployment loses the messages in flight, by design.\n• The losable list is the line to watch: a message that matters must never go through.',
      alternatives: '1. At least once with idempotent consumers and an outbox, as soon as a message matters.\n2. No messaging: notify by a direct call that may fail visibly.',
    },
    {
      id: 'adr-kafka', label: 'Apache Kafka carries the messages', when: { BROKER: ['kafka'] },
      decision: 'Messages go through Apache Kafka (managed: Confluent Cloud, Amazon MSK or Aiven; on Kubernetes: Strimzi). Topics are replicated 3 times with min.insync.replicas = 2; producers use acks = all and enable.idempotence = true; retention is at least 7 days so a consumer can replay. Consumers handle messages {{ORDER}}: the message key (the order id, the account id) is the partition key, so the messages of one key stay in order on one partition; a consumer group\'s parallelism is its partition count. Kafka has no dead-letter queue of its own: the consumer framework (Spring Kafka DeadLetterPublishingRecoverer, Kafka Connect errors.deadletterqueue) publishes failed messages to a <topic>.dlq topic. Consumer lag is exported to Prometheus and alerted at {{LAG_MINUTES}} minutes. Choose Kafka over a queue broker when several consumers read the same stream, replay is needed, or volume is beyond tens of thousands a second.',
      consequences: '• Any number of consumers can read a topic, each at its own pace, and replay it.\n• Order is per partition only; the partition count bounds parallelism and is hard to change later.\n• Retries and dead letters are the consumer\'s code, not the broker\'s.\n• A cluster is heavy to run yourself; managed Kafka costs per partition and throughput.',
      alternatives: '1. RabbitMQ: routing and per-message dead-lettering built in, but no replay.\n2. Amazon SQS with SNS: nothing to run, but no replay and fan-out through SNS.\n3. Apache Pulsar or Redpanda: Kafka-like logs with other trade-offs (tiered storage, no JVM).',
    },
    {
      id: 'adr-rabbitmq', label: 'RabbitMQ carries the messages', when: { BROKER: ['rabbitmq'] },
      decision: 'Messages go through RabbitMQ (self-run on three nodes, CloudAMQP or Amazon MQ), on quorum queues so that they survive the loss of a node. Publishers use publisher confirms; consumers acknowledge manually after handling, with a prefetch of 10 to 50. A policy on every queue sets a dead-letter exchange and delivery-limit = {{MAX_ATTEMPTS}}, so a message that keeps failing goes to its <queue>.dlq. Consumers handle messages {{ORDER}}; where order per key is needed, the consistent-hash exchange spreads keys over single-active-consumer queues, so one key always lands in one queue read by one consumer. Queue depth, consumers and dead letters are exported through the rabbitmq_prometheus plugin and alerted. Choose RabbitMQ over a log when messages are commands or work items for one consumer each, routing by type matters, and replay is not needed.',
      consequences: '• Dead-lettering and delivery limits are the broker\'s, not code.\n• A message is gone once acknowledged: no replay, so read models are rebuilt from the source, not the queue.\n• Order per key costs a queue per hash bucket and one active consumer each.\n• A cluster to run and upgrade, unless bought managed.',
      alternatives: '1. Apache Kafka: replay and many consumers per stream, but dead letters and routing in code.\n2. Amazon SQS: nothing to run on AWS, less routing.\n3. Azure Service Bus: managed, with sessions for order and dead-lettering built in, on Azure.',
    },
    {
      id: 'adr-sqs', label: 'Amazon SQS carries the messages', when: { BROKER: ['sqs'] },
      decision: 'Messages go through Amazon SQS, with SNS in front when more than one service consumes a kind of message. Each queue has a redrive policy to its own dead-letter queue with maxReceiveCount = {{MAX_ATTEMPTS}} and a visibility timeout of six times the consumer\'s handling time. Consumers handle messages {{ORDER}}; where order per key is needed, FIFO queues take the key as MessageGroupId (in high-throughput mode when one queue needs more than 300 messages a second), otherwise standard queues are used. CloudWatch alarms watch ApproximateAgeOfOldestMessage at {{LAG_MINUTES}} minutes and any message in a dead-letter queue. Queues are defined in Terraform. Choose SQS on AWS when each queue has one consuming service, replay is not needed, and nobody should run a broker.',
      consequences: '• Nothing to run or patch; cost per request.\n• Standard queues deliver at least once and out of order; FIFO queues keep order per group at a lower throughput.\n• No replay: a message is gone once deleted.\n• Messages are limited to 256 KB; larger payloads go to S3 with a reference.',
      alternatives: '1. Amazon Kinesis or MSK: replay and many readers per stream on AWS, more to manage.\n2. Amazon EventBridge: routing by content between many services, with lower throughput per rule.\n3. RabbitMQ on Amazon MQ: richer routing, a broker to size.',
    },
    {
      id: 'adr-registry', label: 'Message schemas in a schema registry', when: { SCHEMA: ['registry'] },
      decision: 'Every message type has a schema (Avro or Protobuf; JSON Schema where consumers cannot use either) registered in a schema registry under one subject per topic or message type: Confluent Schema Registry or Apicurio Registry with Kafka, AWS Glue Schema Registry on AWS. Subjects are set to BACKWARD_TRANSITIVE, FULL_TRANSITIVE where consumers may be upgraded before producers. Producers fail to start with an unregistered schema (auto.register.schemas = false in production); CI asks the registry whether a changed schema is compatible before merge. The schema version travels in the message.',
      consequences: '• An incompatible schema is refused before any message uses it, across teams.\n• Old messages stay readable for as long as they are kept.\n• The registry is on the producer\'s path at start-up and must be highly available.\n• Removing a field needs a default first; renaming is add-then-remove.',
      alternatives: '1. Schemas in the repository with an AsyncAPI diff in CI: no registry to run, but only the producer\'s repository is checked.\n2. Schemaless JSON: nothing to set up, and breaks are found by consumers in production.',
    },
    {
      id: 'adr-schema-repo', label: 'Message schemas in the repository', when: { SCHEMA: ['repo'] },
      decision: 'Every channel and message is described in an AsyncAPI document with JSON Schema payloads, kept in the producer\'s repository and released with it. CI compares the document with the last release (AsyncAPI CLI diff) and fails on a breaking change; a breaking change becomes a new message version on the same channel, published beside the old one until consumers have moved. Consumers generate their types from the released document. Choose it over a registry when one team owns the producer and its consumers, or the broker has no registry to hand.',
      consequences: '• No registry to run; the contract is reviewed with the code.\n• Only the producer\'s pull requests are checked: a consumer that reads a field the document never promised is not protected.\n• Two versions of a message are published side by side while consumers move.',
      alternatives: '1. A schema registry: checks at publish time across teams, one more service to run.\n2. Schemaless JSON: nothing to set up, breaks found in production.',
    },
  ],
  fitness: [
    {
      id: 'ff-dupes', label: 'Duplicate delivery harmless', when: LEAST, category: 'structural', implements: ['adr-least'],
      threshold: 'Every consumer, given each of its message types twice (and again after a restart), ends in the same state as with one delivery; 0 double effects',
      description: 'An integration test starts the real broker and database in containers, publishes each message type a consumer handles twice with the same id, restarts the consumer, publishes it a third time, and compares the state with a single delivery.',
      tool: 'Testcontainers (Kafka, RabbitMQ or LocalStack module) with Vitest',
      language: 'ts',
      snippet: `import { runWith } from './harness'   // starts broker and database with Testcontainers, runs the real consumer
import { MESSAGE_SAMPLES } from '../src/messages/samples'   // one sample per message type

describe.each(MESSAGE_SAMPLES)('$type', (sample) => {
  it('has the effect of one delivery when delivered three times', async () => {
    const once = await runWith([sample])
    const thrice = await runWith([sample, sample], { restart: true, then: [sample] })
    expect(thrice.state).toEqual(once.state)
    expect(thrice.duplicatesCounted).toBe(2)
  })
})`,
    },
    {
      id: 'ff-outbox', label: 'Only the outbox publishes', when: LEAST, category: 'structural', implements: ['adr-least'],
      threshold: '0 modules outside the outbox relay import a broker client',
      description: 'A dependency rule fails the build when code outside the outbox relay imports the broker\'s client, which would mean a message sent outside the transaction of its change.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'publish-through-outbox',
    comment: 'ADR At-least-once delivery: messages go to the outbox table, only the relay talks to the broker',
    severity: 'error',
    from: { pathNot: '^src/outbox/relay' },
    to: { path: 'node_modules/(kafkajs|@confluentinc/kafka-javascript|amqplib|@aws-sdk/client-sqs|@aws-sdk/client-sns)' },
  }],
}`,
    },
    {
      id: 'ff-lossy', label: 'Only losable types sent', when: { DELIVERY: ['most'] }, category: 'structural', implements: ['adr-most'],
      threshold: 'Every message type a producer can publish is on the losable list; 0 off it',
      description: 'A test enumerates the message types the producers can publish from their type definitions (not from a list kept by hand) and fails on any that is not on the losable list, so a message that matters cannot slip into an at-most-once queue.',
      tool: 'Vitest',
      language: 'ts',
      snippet: `import { PUBLISHED_TYPES } from '../src/messages'       // derived from the producers' type union
import { LOSABLE } from '../src/messages/losable'          // reviewed list: loss changes no record

it('publishes only message types whose loss changes no record', () => {
  expect(PUBLISHED_TYPES.filter((t) => !LOSABLE.has(t))).toEqual([])
})`,
    },
    {
      id: 'ff-stale', label: 'Any order, same result', when: { ORDER: ['none'] }, category: 'structural', implements: ['adr-least', 'adr-most'],
      threshold: 'For every message type, all orders of a sequence of 3 versions end in the state of the highest version; 0 differences',
      description: 'A property-based test generates sequences of versioned messages for one record, applies every permutation, and expects the same final state as the ordered sequence.',
      tool: 'fast-check with Vitest',
      language: 'ts',
      snippet: `import fc from 'fast-check'
import { apply, emptyState } from '../src/consumer'
import { arbitraryUpdates } from './arbitraries'   // versioned messages for one record

it('ends in the same state whatever the order', () => {
  fc.assert(fc.property(
    arbitraryUpdates(3).chain((updates) =>
      fc.tuple(fc.constant(updates), fc.shuffledSubarray(updates, { minLength: updates.length }))),
    ([updates, shuffled]) => {
      const ordered = [...updates].sort((a, b) => a.version - b.version).reduce(apply, emptyState)
      expect(shuffled.reduce(apply, emptyState)).toEqual(ordered)
    }))
})`,
    },
    {
      id: 'ff-order', label: 'Order per key holds', when: { ORDER: ['key'] }, category: 'structural', implements: BROKER_ADRS,
      threshold: 'With 4 consumers in parallel, the messages of each of 100 keys are handled in the order published; 0 out of order',
      description: 'An integration test against the real broker in a container publishes numbered messages for 100 keys interleaved, runs four consumers, and checks that each key\'s numbers were handled in increasing order.',
      tool: 'Testcontainers (Kafka, RabbitMQ or LocalStack module) with Vitest',
      language: 'ts',
      snippet: `it('keeps the order within each key', async () => {
  const keys = Array.from({ length: 100 }, (_, i) => 'order-' + i)
  for (let n = 1; n <= 20; n++) for (const key of keys) await publish({ key, n })
  const handled = await consumeWith(4, keys.length * 20)          // [{ key, n }] in handling order
  for (const key of keys) {
    const ns = handled.filter((m) => m.key === key).map((m) => m.n)
    expect(ns).toEqual([...ns].sort((a, b) => a - b))
  }
})`,
    },
    {
      id: 'ff-kafka', label: 'Kafka lag and durability', when: { BROKER: ['kafka'] }, category: 'operational', implements: ['adr-kafka'],
      threshold: 'An alert fires when a consumer group with waiting messages has made no progress for {{LAG_MINUTES}} minutes, or a dead-letter topic receives a message',
      description: 'Prometheus rules over kafka-exporter metrics alert on a consumer group that has messages waiting but has not moved its offset for {{LAG_MINUTES}} minutes (the oldest waiting message is at least that old) and on any message published to a .dlq topic.',
      tool: 'Prometheus alerting rules (kafka-exporter)',
      language: 'yaml',
      snippet: `groups:
- name: messaging
  rules:
  - alert: ConsumerStuck
    expr: kafka_consumergroup_lag_sum > 0
      and delta(kafka_consumergroup_current_offset_sum[{{LAG_MINUTES}}m]) == 0
    labels: { severity: page }
    annotations: { summary: "{{ $labels.consumergroup }} has not moved for {{LAG_MINUTES}} minutes" }
  - alert: DeadLetters
    expr: increase(kafka_topic_partition_current_offset{topic=~".+\\\\.dlq"}[5m]) > 0
    labels: { severity: ticket }`,
    },
    {
      id: 'ff-rabbitmq', label: 'RabbitMQ backlog and dead letters', when: { BROKER: ['rabbitmq'] }, category: 'operational', implements: ['adr-rabbitmq'],
      threshold: 'An alert fires when a queue has messages ready and no consumer, or messages ready that have not decreased for {{LAG_MINUTES}} minutes, or any message in a .dlq queue; every queue is a quorum queue with delivery-limit = {{MAX_ATTEMPTS}}',
      description: 'Prometheus rules over the rabbitmq_prometheus plugin\'s per-object metrics alert on stuck queues and dead letters; the policy that sets the dead-letter exchange and delivery limit is applied from the repository.',
      tool: 'Prometheus alerting rules (rabbitmq_prometheus plugin, per-object metrics)',
      language: 'yaml',
      snippet: `# policy, applied from the repository:
#   rabbitmqctl set_policy dlx ".*" '{"dead-letter-exchange":"dlx","delivery-limit":{{MAX_ATTEMPTS}}}' --apply-to quorum_queues
groups:
- name: messaging
  rules:
  - alert: QueueWithoutConsumer
    expr: rabbitmq_queue_messages_ready > 0 and rabbitmq_queue_consumers == 0
    for: {{LAG_MINUTES}}m
  - alert: QueueStuck
    expr: rabbitmq_queue_messages_ready > 0 and delta(rabbitmq_queue_messages_ready[{{LAG_MINUTES}}m]) >= 0
    for: {{LAG_MINUTES}}m
  - alert: DeadLetters
    expr: rabbitmq_queue_messages{queue=~".+\\\\.dlq"} > 0`,
    },
    {
      id: 'ff-sqs', label: 'SQS age and dead letters', when: { BROKER: ['sqs'] }, category: 'operational', implements: ['adr-sqs'],
      threshold: 'An alarm fires when ApproximateAgeOfOldestMessage exceeds {{LAG_MINUTES}} minutes or a dead-letter queue holds a message; every queue has a redrive policy with maxReceiveCount = {{MAX_ATTEMPTS}}',
      description: 'The queues, their dead-letter queues and their CloudWatch alarms are defined together in Terraform, so a queue cannot exist without its redrive policy and alarms.',
      tool: 'Amazon CloudWatch alarms (Terraform)',
      language: 'hcl',
      snippet: `resource "aws_sqs_queue" "orders_dlq" { name = "orders-dlq" }

resource "aws_sqs_queue" "orders" {
  name           = "orders"
  redrive_policy = jsonencode({ deadLetterTargetArn = aws_sqs_queue.orders_dlq.arn, maxReceiveCount = {{MAX_ATTEMPTS}} })
}

resource "aws_cloudwatch_metric_alarm" "orders_age" {
  alarm_name          = "orders-oldest-message"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateAgeOfOldestMessage"
  dimensions          = { QueueName = aws_sqs_queue.orders.name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = {{LAG_MINUTES}} * 60
  comparison_operator = "GreaterThanThreshold"
}

resource "aws_cloudwatch_metric_alarm" "orders_dead_letters" {
  alarm_name          = "orders-dead-letters"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.orders_dlq.name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
}`,
    },
    {
      id: 'ff-registry', label: 'Schemas compatible before merge', when: { SCHEMA: ['registry'] }, category: 'process', implements: ['adr-registry'],
      threshold: 'Every changed schema is compatible with all registered versions of its subject before merge; 0 incompatible registrations',
      description: 'A CI step asks the registry whether each changed schema is compatible with every version of its subject under the subject\'s mode, and fails on the first that is not.',
      tool: 'Confluent Schema Registry compatibility API (Apicurio Registry offers the same check)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
for file in $(git diff --name-only origin/main -- 'schemas/*.avsc'); do
  subject="$(basename "$file" .avsc)-value"
  body=$(jq -n --rawfile s "$file" '{schemaType: "AVRO", schema: $s}')
  curl -sf -u "$SR_KEY:$SR_SECRET" -H 'Content-Type: application/vnd.schemaregistry.v1+json' \\
    -d "$body" "$SCHEMA_REGISTRY_URL/compatibility/subjects/$subject/versions?verbose=true" \\
    | jq -e '.is_compatible' > /dev/null || { echo "incompatible: $file"; exit 1; }
done`,
    },
    {
      id: 'ff-asyncapi', label: 'AsyncAPI break check', when: { SCHEMA: ['repo'] }, category: 'structural', implements: ['adr-schema-repo'],
      threshold: '0 breaking changes between the last release\'s AsyncAPI document and the pull request',
      description: 'In every pull request, the AsyncAPI CLI diffs the document with the one of the last release tag and the step fails when it reports a breaking change.',
      tool: 'AsyncAPI CLI (asyncapi diff)',
      language: 'yaml',
      snippet: `# .github/workflows/messages.yml (a job step)
- name: No breaking message changes
  run: |
    git fetch --tags
    git show "$(git describe --tags --abbrev=0)":asyncapi.yaml > /tmp/base.yaml
    npx @asyncapi/cli diff /tmp/base.yaml asyncapi.yaml --type breaking --format json > /tmp/breaking.json
    jq -e 'length == 0' /tmp/breaking.json`,
    },
  ],
}

export default pack
