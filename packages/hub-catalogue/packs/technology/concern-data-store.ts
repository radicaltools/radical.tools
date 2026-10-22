import type { PackSpec } from '../../src/packSpec'

const MODELS = ['adr-relational', 'adr-document', 'adr-keyvalue']
const FORCES = 'This element keeps the system\'s data, and the store chosen for it outlives most of the code around it: data is far harder to move than code. The forces: the way the data is queried (ad hoc and across entities, whole aggregates by id, or a few known lookups at very high volume) favours different data models; some operations must never be seen half done, while others can accept reading slightly old data in exchange for scale and availability; a managed service takes patching, failover and backups off the team but adds a provider, its limits and its bill, while self-hosting needs people who can run the engine at three in the morning; and the schema will change many times while the system is live, so every change has to be repeatable and safe for the code version still running. Backup and recovery is its own concern.'

const pack: PackSpec = {
  id: 'concern-data-store',
  name: 'Data store',
  group: 'technology',
  description: 'Which kind of data store keeps the element\'s data and which product, how consistent reads are, who runs it, and how its schema changes.',
  tags: ['technology', 'database', 'data store', 'postgresql', 'mongodb', 'dynamodb', 'schema migrations'],
  concern: {
    id: 'data-store',
    trigger: 'LIST NODES WHERE type = "database" AND external != true',
    why: 'these elements keep the system\'s data, so the kind of store, the product, who runs it and how its schema changes have to be decided.',
  },
  sources: [
    { title: 'Pramod Sadalage, Martin Fowler: Evolutionary Database Design', url: 'https://martinfowler.com/articles/evodb.html' },
    { title: 'Martin Fowler: PolyglotPersistence', url: 'https://martinfowler.com/bliki/PolyglotPersistence.html' },
    { title: 'Danilo Sato: ParallelChange (expand and contract)', url: 'https://martinfowler.com/bliki/ParallelChange.html' },
    { title: 'Thoughtworks Technology Radar', url: 'https://www.thoughtworks.com/radar' },
    { title: 'endoflife.date: database support lifecycles', url: 'https://endoflife.date/' },
    { title: 'Amazon DynamoDB best practices', url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html' },
    { title: 'MongoDB schema validation', url: 'https://www.mongodb.com/docs/manual/core/schema-validation/' },
    { title: 'Squawk, a linter for PostgreSQL migrations', url: 'https://github.com/sbdchd/squawk' },
  ],
  questions: [
    {
      key: 'MODEL', title: 'Data model', label: 'What kind of store keeps the data?',
      hint: 'The data model decides which queries are easy, which are expensive and which are impossible. Choose by how the data is read and changed, not by fashion.',
      default: 'relational',
      options: [
        { value: 'relational', label: 'a relational database (PostgreSQL or MySQL)', description: 'Tables, joins, constraints and transactions across rows. Pick it by default, and whenever the data is related, queried in ways not all known up front (reports, search, back office), or must stay consistent across entities.' },
        { value: 'document', label: 'a document database (MongoDB)', description: 'Each aggregate is one JSON document read and written whole. Pick it when the data is naturally a tree read by id, its shape varies between records, and queries across documents are few and known.' },
        { value: 'keyvalue', label: 'a key-value store (DynamoDB or Redis)', description: 'Items read and written by key, with access patterns designed up front. Pick it for very high volume with a few known lookups (sessions, carts, counters, device state) needing single-digit-millisecond latency at any scale.' },
      ],
    },
    {
      key: 'CONSISTENCY', title: 'Consistency', label: 'How consistent must reads be?',
      hint: 'Strong consistency is simplest to program against; eventual consistency buys scale, availability and replicas in other regions at the cost of reading old data for a while.',
      default: 'strong',
      options: [
        { value: 'strong', label: 'strong, with transactions', description: 'A read sees every committed write, and a business operation commits all of its changes or none. Pick it when money, stock or anything counted is involved, or users must see their own changes at once.' },
        { value: 'eventual', label: 'eventual, with a bound on staleness', description: 'Replicas and indexes may lag the primary by a bounded time. Pick it for read-heavy data that may be seconds old (catalogues, feeds, analytics) or replicas in several regions.' },
      ],
    },
    {
      key: 'HOSTING', title: 'Hosting', label: 'Who runs the store?',
      hint: 'Running a database well means patching, failover, backups, monitoring and tuning, at any hour.',
      default: 'managed',
      options: [
        { value: 'managed', label: 'a managed cloud service', description: 'Amazon RDS or Aurora, Azure Database for PostgreSQL, Cloud SQL, MongoDB Atlas, DynamoDB or ElastiCache run the engine. Pick it when the team has no database operators, or runs in a public cloud already.' },
        { value: 'self', label: 'self-hosted by us', description: 'We run the engine on our Kubernetes (CloudNativePG, Percona or MongoDB operators) or virtual machines (Patroni). Pick it when data must stay on premises, a provider is ruled out, or the scale makes a managed service too costly, and people with the skills are on call.' },
      ],
    },
    {
      key: 'MIGRATIONS', title: 'Schema changes', label: 'How does the schema change?',
      hint: 'The schema will change many times while the system runs; each change has to be repeatable in every environment and safe for the code still running.',
      default: 'tool',
      options: [
        { value: 'tool', label: 'a versioned migration tool (Flyway or Liquibase)', description: 'Numbered SQL (or changelog) migrations kept with the code, applied by the deploy. Pick it for relational stores, especially when several applications or languages share the tooling or DBAs review SQL.' },
        { value: 'orm', label: 'the ORM\'s migrations (Prisma, EF Core, Alembic, Django)', description: 'Migrations generated from the model in code and applied by the deploy. Pick it when one application owns the store and its ORM generates migrations the team reviews.' },
        { value: 'lazy', label: 'a schema version per record, upgraded in code', description: 'Each document or item carries its schema version; code upgrades old records when it reads them, and a backfill catches up. Pick it for document and key-value stores with large collections where rewriting everything at once is too costly.' },
      ],
    },
  ],
  details: [
    { key: 'STALE_SECONDS', label: 'How old may a read be when consistency is eventual (seconds)?', default: '5', number: true },
    { key: 'P99_MS', label: 'What 99th-percentile latency must key lookups meet (ms)?', default: '20', number: true },
  ],
  need: {
    label: 'Data kept in the right store',
    text: 'The element keeps data the system depends on. It has to be kept in a store whose data model fits the way the data is read and changed, consistent where it must be, run by people who can keep it healthy, and able to change shape many times while the system stays online. The choice and its reasons must be written down, because data is far harder to move later than code.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-access-patterns', label: 'Queries designed, not scanned', ears_type: 'ubiquitous',
      action: 'list every query the element makes in an access-pattern catalogue with its expected volume, and serve each from a key or index designed for it, with 0 full scans of a table or collection on a request path',
      rationale: 'A store fits only if its data model serves the queries; a full scan that is fast at launch is a time-out a year later (Fowler, PolyglotPersistence; DynamoDB best practices: design for access patterns).',
      scenario: { label: 'No scan on request path', given: 'the access-pattern catalogue and the store with production-sized data', when: 'every listed query runs and its plan is read', then: 'each uses a key or an index, and none scans a whole table or collection' },
    },
    {
      id: 'req-expand-contract', label: 'Schema changes without downtime', ears_type: 'ubiquitous',
      action: 'keep each schema change compatible with the previous release of the code (expand, migrate, then contract in a later release), so that a deploy needs 0 minutes of planned downtime',
      rationale: 'During a rolling deploy the old and the new code run against the same schema; a change only the new code understands breaks the old (Sato, ParallelChange; Sadalage and Fowler, Evolutionary Database Design).',
      scenario: { label: 'Old code survives migration', given: 'the previous release running against the store', when: 'the next release\'s migrations are applied', then: 'the previous release\'s tests still pass against the migrated schema' },
    },
    {
      id: 'req-versioned', label: 'Migrations are versioned', when: { MIGRATIONS: ['tool', 'orm'] }, ears_type: 'event-driven',
      trigger: 'a change needs a different schema, index or reference data',
      action: 'apply it as a versioned migration committed with the code and run by the deploy pipeline with {{MIGRATIONS}}, with 0 schema changes made by hand in any shared environment',
      rationale: 'A schema changed by hand differs between environments, and the difference shows up in production (Sadalage and Fowler, Evolutionary Database Design: all database artefacts are version controlled).',
      scenario: { label: 'Migration applied by pipeline', given: 'a change that adds a column', when: 'it is deployed to each environment in turn', then: 'the same versioned migration is applied by the pipeline everywhere, and the migration history matches in every environment' },
    },
    {
      id: 'req-lazy', label: 'Old records upgraded', when: { MIGRATIONS: ['lazy'] }, ears_type: 'event-driven',
      trigger: 'a record written under an older schema version is read',
      action: 'upgrade it to the current version in code before use, write it back at the next save, and backfill in the background so that 0 records are more than 2 schema versions behind',
      rationale: 'Upgrading on read spreads the cost of a change over time; the backfill keeps the code from carrying upgraders for every version ever written (MongoDB Schema Versioning pattern).',
      scenario: { label: 'Old record read', given: 'a record at schema version N-1', when: 'the element reads it and later saves it', then: 'it is used as version N and stored as version N' },
    },
    {
      id: 'req-integrity', label: 'Integrity enforced by the database', when: { MODEL: ['relational'] }, ears_type: 'ubiquitous',
      action: 'enforce the invariants between records in the database itself, with a primary key on 100% of tables, a foreign key on every reference column, and unique and check constraints for the rules they can express',
      rationale: 'Every code path, script and future application obeys a constraint; only some of them obey application code (Evolutionary Database Design; PostgreSQL documentation, constraints).',
      scenario: { label: 'Dangling reference refused', given: 'an order line that references an order', when: 'a line is inserted for an order that does not exist', then: 'the database refuses the insert' },
    },
    {
      id: 'req-documents', label: 'Documents validated and bounded', when: { MODEL: ['document'] }, ears_type: 'ubiquitous',
      action: 'store each aggregate as one document, validate 100% of collections with a JSON Schema validator that rejects invalid writes, and keep every document under 1 MB',
      rationale: 'Schema-flexible does not mean schema-free: a validator stops malformed documents at the door, and the size bound keeps documents well below MongoDB\'s 16 MB limit and fast to read (MongoDB schema validation).',
      scenario: { label: 'Invalid document refused', given: 'a collection with its JSON Schema validator', when: 'a document missing a required field is inserted', then: 'the database refuses the write' },
    },
    {
      id: 'req-kv-latency', label: 'Key lookups are fast', when: { MODEL: ['keyvalue'] }, ears_type: 'ubiquitous',
      action: 'answer 99% of key reads and writes within {{P99_MS}} ms at peak load, and keep every item under 400 KB',
      rationale: 'Predictable low latency at any scale is the reason to give up queries; 400 KB is DynamoDB\'s item limit, and large values in Redis block other commands (DynamoDB best practices).',
      scenario: { label: 'Lookups within target', given: 'the store at production volume', when: 'a load test reads and writes by key at peak rate for 10 minutes', then: 'the 99th percentile stays within {{P99_MS}} ms' },
    },
    {
      id: 'req-transactions', label: 'Operations commit whole', when: { CONSISTENCY: ['strong'] }, ears_type: 'event-driven',
      trigger: 'a business operation changes several records',
      action: 'commit all its changes in one transaction, so that 0 readers see part of the operation and a failure leaves none of it',
      rationale: 'A half-applied operation (money taken, order not created) is the hardest kind of bug to find and repair (ACID; Kleppmann, Designing Data-Intensive Applications, ch. 7).',
      scenario: { label: 'Failure leaves nothing', given: 'an operation that writes three records', when: 'it fails after the second write', then: 'none of the three records is changed and no reader saw the first two' },
    },
    {
      id: 'req-staleness', label: 'Staleness is bounded', when: { CONSISTENCY: ['eventual'] }, ears_type: 'state-driven',
      precondition: 'replicas or secondary indexes lag behind the primary',
      action: 'serve reads at most {{STALE_SECONDS}} seconds old, and read from the primary wherever a user must see their own write',
      rationale: 'Eventual consistency is acceptable only with a known bound and with read-your-writes where users notice (Kleppmann, Designing Data-Intensive Applications, ch. 5: replication lag).',
      scenario: { label: 'Own write visible', given: 'a user who has just changed a record', when: 'the user reads it again while replicas lag', then: 'the user sees the change, and other readers see it within {{STALE_SECONDS}} seconds' },
    },
    {
      id: 'req-exit', label: 'Data can leave the provider', when: { HOSTING: ['managed'] }, ears_type: 'ubiquitous',
      action: 'keep a logical export of all data, no older than 24 hours, in storage the organisation controls and in a format another provider or a self-hosted engine can load',
      rationale: 'A managed service is a dependency on one provider; an export it does not hold is the exit plan (EBA Guidelines on outsourcing arrangements, exit strategies; DORA Art. 28).',
      scenario: { label: 'Export loads elsewhere', given: 'the latest export', when: 'it is loaded into a self-hosted engine of the same kind', then: 'it loads without error and is less than 24 hours old' },
    },
    {
      id: 'req-engine-patch', label: 'Engine patched on time', when: { HOSTING: ['self'] }, ears_type: 'event-driven',
      trigger: 'a minor or security release of the database engine is published',
      action: 'apply it within 30 days by a rolling upgrade with automatic failover, keeping writes unavailable for under 30 seconds',
      rationale: 'Self-hosting makes patching our job; minor releases carry security and data-corruption fixes, and the engine\'s support lifecycle ends on published dates (PostgreSQL versioning policy; endoflife.date).',
      scenario: { label: 'Minor release applied', given: 'a new minor release of the engine', when: '30 days have passed', then: 'every node runs it, and the failover during the upgrade kept writes unavailable for under 30 seconds' },
    },
  ],
  adrs: [
    {
      id: 'adr-relational', label: 'A relational database', when: { MODEL: ['relational'] },
      decision: 'The data is kept in a relational database: PostgreSQL by default, MySQL where the team or platform already runs it. Consistency: {{CONSISTENCY}}; hosting: {{HOSTING}} (managed: Amazon RDS or Aurora, Azure Database for PostgreSQL flexible server, Google Cloud SQL; self-hosted: CloudNativePG on Kubernetes or Patroni on virtual machines). Schema changes: {{MIGRATIONS}}, linted with Squawk for PostgreSQL. Constraints, not only code, enforce the invariants; JSONB columns hold the parts whose shape varies. Choosing PostgreSQL or MySQL: PostgreSQL for richer types (JSONB, arrays, ranges), extensions (PostGIS, pgvector) and transactional DDL; MySQL when existing operations know it. Choosing managed or self-hosted: managed unless data residency, cost at scale or an on-premises platform rules it out.',
      consequences: '• Any query can be written later, including the reports and back-office searches nobody listed today.\n• Transactions and constraints keep the data consistent across entities without application code.\n• Scaling writes past one primary needs partitioning, sharding (Citus, Vitess) or a different store for the hot path.\n• Schema changes need migrations and expand-and-contract discipline.',
      alternatives: '1. A document database: aggregates read whole and flexible shapes, at the cost of joins and cross-document constraints.\n2. A key-value store: scale and latency for known lookups, no ad hoc queries.\n3. A distributed SQL database (CockroachDB, YugabyteDB, Spanner): relational with horizontal write scale, more cost and latency per write.',
    },
    {
      id: 'adr-document', label: 'A document database', when: { MODEL: ['document'] },
      decision: 'The data is kept in a document database, MongoDB, one document per aggregate, with a JSON Schema validator on every collection. Consistency: {{CONSISTENCY}} (majority write concern; reads from the primary or with majority read concern where it must be strong); hosting: {{HOSTING}} (managed: MongoDB Atlas; self-hosted: the MongoDB or Percona operator on Kubernetes). Schema changes: {{MIGRATIONS}}. References between aggregates by id; multi-document transactions only where one operation must change two aggregates. Choosing MongoDB or a PostgreSQL JSONB column: MongoDB when most data is documents and scale-out by sharding is likely; JSONB when only a part of a mostly relational model varies in shape. Amazon DocumentDB or Azure Cosmos DB for MongoDB only after checking the features you need are compatible.',
      consequences: '• An aggregate is read and written in one operation, with no mapping to tables.\n• Shapes can vary between records, and the validator still stops malformed writes.\n• Joins and constraints across documents are the application\'s job; queries not planned for need new indexes or pipelines.\n• Data duplicated across documents for read speed must be kept in step by code.',
      alternatives: '1. A relational database with JSONB columns: constraints and joins with flexible parts.\n2. A key-value store: simpler and faster for lookups by key, no queries on content.\n3. A search engine (OpenSearch) as the main store: great for text search, weak as a system of record.',
    },
    {
      id: 'adr-keyvalue', label: 'A key-value store', when: { MODEL: ['keyvalue'] },
      decision: 'The data is kept in a key-value store designed from its access patterns: Amazon DynamoDB (single-table design, keys and global secondary indexes per listed access pattern, on-demand or provisioned capacity) for durable data on AWS; Redis (or Valkey) with persistence only for small, short-lived or rebuildable data such as sessions, counters and rate limits. Consistency: {{CONSISTENCY}} (DynamoDB strongly consistent reads and TransactWriteItems where it must be strong); hosting: {{HOSTING}} (managed: DynamoDB, ElastiCache or MemoryDB; self-hosted: Redis with Sentinel or Valkey cluster). Schema changes: {{MIGRATIONS}}. No Scan on a request path. Choosing DynamoDB or Redis: DynamoDB when the data must survive and grow without limit; Redis when it fits in memory and losing the last second is acceptable. Outside AWS: Azure Cosmos DB or Google Bigtable play DynamoDB\'s part.',
      consequences: '• Single-digit-millisecond latency at any scale, with capacity that scales without re-architecture.\n• Every query must be designed up front; a new access pattern means a new index or a backfill.\n• No joins and limited transactions; reports and analytics go to an export (DynamoDB to S3, Athena) rather than the store.\n• DynamoDB ties the element to AWS; the item and transaction limits shape the design.',
      alternatives: '1. A relational database: any query, transactions and constraints, with less headroom for scale.\n2. A document database: richer queries on content, more operational work.\n3. A cache in front of a relational database: keeps queries flexible and lookups fast, adds invalidation.',
    },
  ],
  fitness: [
    {
      id: 'ff-flyway', label: 'Migrations apply cleanly', when: { MIGRATIONS: ['tool'] }, category: 'process', implements: MODELS,
      threshold: 'Every migration applies to an empty database and to the previous release\'s schema; 0 checksum mismatches against applied migrations',
      description: 'On every pull request the pipeline starts the production engine and version, applies all migrations from empty, and validates them; the deploy runs migrate and validate against each environment. With Liquibase the same is `liquibase update` followed by `liquibase validate`.',
      tool: 'Flyway',
      language: 'yaml',
      snippet: `# .github/workflows/migrations.yml
jobs:
  migrations:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17          # the production major version
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: app }
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 5s
    steps:
      - uses: actions/checkout@v4
      - run: |
          docker run --rm --network host -v "$PWD/db/migration:/flyway/sql" flyway/flyway:11 \\
            -url=jdbc:postgresql://localhost:5432/app -user=postgres -password=test \\
            -validateMigrationNaming=true migrate validate`,
    },
    {
      id: 'ff-orm-drift', label: 'Model and migrations agree', when: { MIGRATIONS: ['orm'] }, category: 'process', implements: MODELS,
      threshold: '0 differences between the model in code and the committed migrations',
      description: 'The build fails when the model in code changed without a migration. Prisma compares the migrations with the schema; the equivalents are `dotnet ef migrations has-pending-model-changes` (EF Core), `alembic check` (Alembic) and `python manage.py makemigrations --check --dry-run` (Django).',
      tool: 'Prisma Migrate (prisma migrate diff)',
      language: 'bash',
      snippet: `# exits 2 when the schema and the migrations differ
npx prisma migrate diff \\
  --from-migrations prisma/migrations \\
  --to-schema-datamodel prisma/schema.prisma \\
  --shadow-database-url "$SHADOW_DATABASE_URL" \\
  --exit-code`,
    },
    {
      id: 'ff-schema-versions', label: 'No record far behind', when: { MIGRATIONS: ['lazy'] }, category: 'operational', implements: MODELS,
      threshold: '0 records more than 2 schema versions behind the current one',
      description: 'A scheduled job counts the records per schema version in each collection and fails when any is more than two versions behind; the backfill job then runs. For DynamoDB, the same count comes from a sparse index on the schema version attribute.',
      tool: 'mongosh (scheduled job)',
      language: 'js',
      snippet: `// check-schema-versions.js — mongosh "$MONGODB_URI" --file check-schema-versions.js
const CURRENT = { orders: 7, customers: 4 }   // the version the code writes
let behind = 0
for (const [name, version] of Object.entries(CURRENT)) {
  const n = db.getCollection(name).countDocuments({ schemaVersion: { $lt: version - 2 } })
  if (n > 0) print(\`\${name}: \${n} documents more than 2 versions behind\`)
  behind += n
}
if (behind > 0) quit(1)`,
    },
    {
      id: 'ff-squawk', label: 'Migrations safe to deploy', when: { MODEL: ['relational'] }, category: 'structural', implements: ['adr-relational'],
      threshold: '0 Squawk findings in new migrations (no dropped or renamed column in use, no blocking index build, no NOT NULL column without a default)',
      description: 'Squawk lints the SQL of each new migration for changes that lock tables or break the code still running; the build fails on any finding.',
      tool: 'Squawk',
      language: 'bash',
      snippet: `# lint only the migrations the pull request adds
git diff --name-only --diff-filter=A origin/main -- 'db/migration/*.sql' \\
  | xargs --no-run-if-empty npx squawk-cli \\
      --exclude=prefer-big-int,prefer-text-field`,
    },
    {
      id: 'ff-integrity', label: 'Keys and foreign keys present', when: { MODEL: ['relational'] }, category: 'structural', implements: ['adr-relational'],
      threshold: '100% of tables have a primary key; 0 columns named *_id without a foreign key',
      description: 'A test migrates a fresh database in a container and queries the catalogue for tables without a primary key and reference columns without a foreign key; both lists must be empty.',
      tool: 'Testcontainers with a SQL query on information_schema (PostgreSQL)',
      language: 'sql',
      snippet: `-- tables without a primary key
SELECT t.table_name FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints c
                  WHERE c.table_name = t.table_name AND c.constraint_type = 'PRIMARY KEY');

-- reference columns without a foreign key
SELECT k.table_name, k.column_name FROM information_schema.columns k
WHERE k.table_schema = 'public' AND k.column_name LIKE '%\\_id'
  AND NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage u
                  JOIN information_schema.table_constraints c USING (constraint_name, table_name)
                  WHERE c.constraint_type = 'FOREIGN KEY'
                    AND u.table_name = k.table_name AND u.column_name = k.column_name);`,
    },
    {
      id: 'ff-validators', label: 'Collections validate writes', when: { MODEL: ['document'] }, category: 'structural', implements: ['adr-document'],
      threshold: '100% of collections have a $jsonSchema validator with validationLevel strict and validationAction error',
      description: 'A check run after each deploy lists the collections and fails when one has no JSON Schema validator, or one that only warns.',
      tool: 'mongosh',
      language: 'js',
      snippet: `// check-validators.js — mongosh "$MONGODB_URI" --file check-validators.js
const missing = db.getCollectionInfos({ type: 'collection' })
  .filter((c) => !c.name.startsWith('system.'))
  .filter((c) => !c.options?.validator?.$jsonSchema
    || (c.options.validationLevel ?? 'strict') !== 'strict'
    || (c.options.validationAction ?? 'error') !== 'error')
  .map((c) => c.name)
if (missing.length) { print('Collections without a strict validator: ' + missing.join(', ')); quit(1) }`,
    },
    {
      id: 'ff-no-scan', label: 'No Scan in request code', when: { MODEL: ['keyvalue'] }, category: 'structural', implements: ['adr-keyvalue'],
      threshold: '0 uses of Scan outside batch jobs',
      description: 'A lint rule forbids the DynamoDB Scan command in request-handling code; batch jobs under src/jobs are exempt. For Redis, the same rule forbids KEYS.',
      tool: 'ESLint (no-restricted-imports)',
      language: 'js',
      snippet: `// eslint.config.mjs
export default [
  {
    files: ['src/**/*.ts'],
    ignores: ['src/jobs/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: '@aws-sdk/client-dynamodb', importNames: ['ScanCommand'], message: 'ADR Key-value store: serve requests from a key or index, never Scan.' },
          { name: '@aws-sdk/lib-dynamodb', importNames: ['ScanCommand'], message: 'ADR Key-value store: serve requests from a key or index, never Scan.' },
        ],
      }],
    },
  },
]`,
    },
    {
      id: 'ff-replica-lag', label: 'Replica lag within bound', when: { CONSISTENCY: ['eventual'] }, category: 'operational', implements: MODELS,
      threshold: 'Replica lag at most {{STALE_SECONDS}} seconds; an alert fires after 2 minutes above it',
      description: 'An alert on the exporter\'s replication-lag metric pages when replicas fall further behind than the bound. For MongoDB use the replica set member lag from the MongoDB exporter; for DynamoDB global tables, the ReplicationLatency metric in CloudWatch.',
      tool: 'Prometheus with postgres_exporter',
      language: 'yaml',
      snippet: `groups:
  - name: data-store
    rules:
      - alert: ReplicaLagAboveBound
        expr: max by (instance) (pg_replication_lag_seconds) > 5   # STALE_SECONDS
        for: 2m
        labels: { severity: page }
        annotations:
          summary: "Replica {{ $labels.instance }} lags {{ $value }}s behind the primary"`,
    },
    {
      id: 'ff-export', label: 'Export is fresh', when: { HOSTING: ['managed'] }, category: 'operational', implements: MODELS,
      threshold: 'The newest export in our own storage is less than 26 hours old; a monthly job loads it into a self-hosted engine without error',
      description: 'A scheduled check finds the newest export object in the bucket the organisation controls and fails when it is older than 26 hours (a daily export with two hours of slack).',
      tool: 'AWS CLI (scheduled check)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
newest=$(aws s3api list-objects-v2 --bucket "$EXPORT_BUCKET" --prefix exports/ \\
  --query 'sort_by(Contents, &LastModified)[-1].LastModified' --output text)
age=$(( $(date +%s) - $(date -d "$newest" +%s) ))
[ "$age" -lt $((26 * 3600)) ] || { echo "newest export is $((age / 3600)) h old"; exit 1; }`,
    },
    {
      id: 'ff-engine-current', label: 'Engine on latest minor', when: { HOSTING: ['self'] }, category: 'operational', implements: MODELS,
      threshold: 'Every node runs the latest minor release of its major, or one published less than 30 days ago; 0 majors past end of support',
      description: 'A scheduled job compares the version each node reports with the latest release of its major on endoflife.date, and fails when the latest has been out for more than 30 days or the major has reached end of support. Products: postgresql, mysql, mongodb, redis.',
      tool: 'endoflife.date API (curl and jq)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
running=$(psql "$DATABASE_URL" -tAc 'SHOW server_version' | cut -d' ' -f1)   # e.g. 17.4
major=\${running%%.*}
info=$(curl -fsS "https://endoflife.date/api/postgresql/\${major}.json")
latest=$(jq -r '.latest' <<<"$info"); released=$(jq -r '.latestReleaseDate' <<<"$info"); eol=$(jq -r '.eol' <<<"$info")
[ "$eol" != "true" ] && { [ "$eol" = "false" ] || [ "$(date -d "$eol" +%s)" -gt "$(date +%s)" ]; } \\
  || { echo "PostgreSQL $major is past end of support"; exit 1; }
if [ "$running" != "$latest" ] && [ "$(date -d "$released" +%s)" -lt "$(date -d '30 days ago' +%s)" ]; then
  echo "running $running, $latest released on $released"; exit 1
fi`,
    },
  ],
}

export default pack
