import type { FitnessSpec, PackSpec } from '../../src/packSpec'

const MODELS = ['adr-relational', 'adr-document', 'adr-keyvalue']
const FORCES = 'This element keeps the system\'s data, and the store chosen for it outlives most of the code around it: data is far harder to move than code. The forces: the way the data is queried (ad hoc and across entities, whole aggregates by id, or a few known lookups at very high volume) favours different data models; some operations must never be seen half done, while others can accept reading slightly old data in exchange for scale and availability; a managed service takes patching, failover and backups off the team but adds a provider, its limits and its bill, while self-hosting needs people who can run the engine at three in the morning; and the schema will change many times while the system is live, so every change has to be repeatable and safe for the code version still running. Backup and recovery is its own concern; whether a change ships as expand and contract or in a window is decided in the Deployment and rollback pack.'

/** The engine's version against endoflife.date, one variant per self-hosted engine. */
function engineCurrent(model: string, adr: string, product: string, engine: string, versionCmd: string, cycleFields: number, tool: string): FitnessSpec {
  return {
    id: `ff-engine-current-${model}`, label: `${engine} on latest minor`, when: { HOSTING: ['self'], MODEL: [model] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: [adr], checks: ['req-engine-patch'],
    threshold: `Every ${engine} node runs the latest release of its ${product} cycle on endoflife.date, or one published less than 30 days ago; 0 cycles past end of support`,
    description: `A scheduled job asks each node its version, looks its cycle up on endoflife.date (${product}) and fails when the newest release of the cycle has been out for more than 30 days without being applied, or the cycle has reached end of support. Runs on Linux (GNU date).`,
    tool,
    language: 'bash',
    snippet: `#!/usr/bin/env bash
# run once per node; the node's connection string comes from the environment
set -euo pipefail
running=$(${versionCmd})
cycle=$(cut -d. -f1-${cycleFields} <<<"$running")
info=$(curl -fsS "https://endoflife.date/api/${product}/\${cycle}.json")
latest=$(jq -r '.latest' <<<"$info"); released=$(jq -r '.latestReleaseDate' <<<"$info"); eol=$(jq -r '.eol' <<<"$info")
if [ "$eol" = true ] || { [ "$eol" != false ] && [ "$(date -d "$eol" +%s)" -lt "$(date +%s)" ]; }; then
  echo "${engine} $cycle is past end of support ($eol)"; exit 1
fi
if [ "$running" != "$latest" ] && [ "$(date -d "$released" +%s)" -lt "$(date -d '30 days ago' +%s)" ]; then
  echo "running $running, $latest released on $released (30 days allowed)"; exit 1
fi`,
  }
}

const pack: PackSpec = {
  id: 'concern-data-store',
  name: 'Data store',
  group: 'technology',
  description: 'Which kind of data store keeps the element\'s data and which product, how consistent reads are, who runs the engine, and how its schema changes.',
  tags: ['technology', 'database', 'data store', 'postgresql', 'mongodb', 'dynamodb', 'redis', 'schema migrations'],
  concern: {
    id: 'data-store',
    trigger: 'LIST NODES WHERE type = "database" AND external != true',
    why: 'these elements keep the system\'s data, so the kind of store, the product, who runs it and how its schema changes have to be decided.',
  },
  sources: [
    { title: 'Pramod Sadalage, Martin Fowler: Evolutionary Database Design', url: 'https://martinfowler.com/articles/evodb.html' },
    { title: 'Martin Fowler: PolyglotPersistence', url: 'https://martinfowler.com/bliki/PolyglotPersistence.html' },
    { title: 'Martin Kleppmann: Designing Data-Intensive Applications', url: 'https://dataintensive.net/' },
    { title: 'endoflife.date: database support lifecycles', url: 'https://endoflife.date/' },
    { title: 'PostgreSQL versioning policy', url: 'https://www.postgresql.org/support/versioning/' },
    { title: 'PostgreSQL documentation: constraints', url: 'https://www.postgresql.org/docs/current/ddl-constraints.html' },
    { title: 'Amazon DynamoDB best practices', url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html' },
    { title: 'MongoDB schema validation', url: 'https://www.mongodb.com/docs/manual/core/schema-validation/' },
    { title: 'MongoDB: the Schema Versioning pattern', url: 'https://www.mongodb.com/blog/post/building-with-patterns-the-schema-versioning-pattern' },
    { title: 'Regulation (EU) 2022/2554 (DORA), Art. 28: ICT third-party risk and exit strategies', url: 'https://eur-lex.europa.eu/eli/reg/2022/2554/oj' },
  ],
  questions: [
    {
      key: 'MODEL', title: 'Data model', label: 'What kind of store keeps the data?',
      hint: 'The data model decides which queries are easy, which are expensive and which are impossible. Choose by how the data is read and changed, not by fashion.',
      default: 'relational',
      options: [
        { value: 'relational', label: 'a relational database (PostgreSQL or MySQL)', description: 'Tables, joins, constraints and transactions across rows. Pick it by default, and whenever the data is related, queried in ways not all known up front (reports, search, back office), or must stay consistent across entities.' },
        { value: 'document', label: 'a document database (MongoDB)', description: 'Each aggregate is one JSON document read and written whole. Pick it when the data is naturally a tree read by id, its shape varies between records, and queries across documents are few and known.' },
        { value: 'keyvalue', label: 'a key-value store (DynamoDB or Redis)', description: 'Items read and written by key, with access patterns designed up front. Pick it for very high volume with a few known lookups (sessions, carts, counters, device state) needing single-digit-millisecond latency at any scale. DynamoDB is only managed; self-hosting means Redis or Valkey.' },
      ],
    },
    {
      key: 'CONSISTENCY', title: 'Consistency', label: 'How consistent must reads be?',
      hint: 'Strong consistency is simplest to program against; eventual consistency buys scale, availability and replicas in other regions at the cost of reading old data for a while.',
      default: 'strong',
      options: [
        { value: 'strong', label: 'strong, with transactions', description: 'A read sees every committed write, and a business operation commits all of its changes or none. Pick it when money, stock or anything counted is involved, or users must see their own changes at once.' },
        { value: 'eventual', label: 'eventual, with a bound on staleness', description: 'Replicas and indexes may lag the primary by a bounded time, asked below. Pick it for read-heavy data that may be seconds old (catalogues, feeds, analytics) or replicas in several regions.' },
      ],
    },
    {
      key: 'HOSTING', title: 'Hosting', label: 'Who runs the engine?',
      hint: 'Running a database well means patching, failover, backups, monitoring and tuning, at any hour. The engine\'s hosting is decided here, not in the Infrastructure pack.',
      default: 'managed',
      options: [
        { value: 'managed', label: 'a managed cloud service', description: 'Amazon RDS or Aurora, Azure Database, Cloud SQL, MongoDB Atlas, DynamoDB or ElastiCache run the engine. Pick it when the team has no database operators, or runs in a public cloud already.' },
        { value: 'self', label: 'self-hosted by us', description: 'We run the engine on our Kubernetes (CloudNativePG, Percona or MongoDB operators) or virtual machines (Patroni). Pick it when data must stay on premises, a provider is ruled out, or the scale makes a managed service too costly, and people with the skills are on call. With a key-value store this means Redis or Valkey, not DynamoDB.' },
      ],
    },
    {
      key: 'MIGRATIONS', title: 'Schema changes', label: 'How does the schema change?',
      hint: 'The schema will change many times while the system runs; each change has to be repeatable in every environment and safe for the code still running. Only when the store has a schema to migrate: a key-value store\'s tables and indexes are infrastructure code, and its item shapes carry a version.',
      default: 'tool',
      options: [
        { value: 'tool', label: 'a versioned migration tool (Flyway or Liquibase)', description: 'Numbered SQL (or changelog) migrations kept with the code, applied by the deploy. Pick it for relational stores, especially when several applications or languages share the tooling or DBAs review SQL; for MongoDB, Liquibase with its MongoDB extension. Not with a key-value store.' },
        { value: 'orm', label: 'the ORM\'s migrations (Prisma, EF Core, Alembic, Django)', description: 'Migrations generated from the model in code and applied by the deploy. Pick it when one application owns a relational store and its ORM generates migrations the team reviews. Not with a document or key-value store: Prisma and Mongoose generate no migrations for MongoDB.' },
        { value: 'lazy', label: 'a schema version per record, upgraded in code', description: 'Each document or item carries its schema version; code upgrades old records when it reads them, and a backfill catches up. Pick it for document and key-value stores with large collections where rewriting everything at once is too costly. Not with a relational database.' },
      ],
    },
  ],
  details: [
    { key: 'STALE_SECONDS', label: 'How old may a read be when consistency is eventual (seconds)? Used only with eventual consistency', default: '5', number: true },
    { key: 'P99_MS', label: 'What 99th-percentile latency must key lookups meet (ms)? Used only with a key-value store', default: '20', number: true },
  ],
  need: {
    label: 'Data kept in the right store',
    text: 'The element keeps data the system depends on. It has to be kept in a store whose data model fits the way the data is read and changed, consistent where it must be, run by people who can keep it healthy, and able to change shape many times while the system stays online. The choice and its reasons must be written down, because data is far harder to move later than code. The checks assume one repository per element with SQL migrations in db/migration, Prisma migrations in prisma/migrations, a Liquibase changelog in db/changelog.xml with its jars in db/lib, request-handling code under src/ and batch jobs under src/jobs/.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-access-patterns', label: 'Queries designed, not scanned', when: { MODEL: ['keyvalue'] }, ears_type: 'ubiquitous',
      action: 'list every query the element makes in an access-pattern catalogue with its expected volume, serve each from a key or index designed for it, and make 0 Scan or KEYS calls on a request path',
      rationale: 'A key-value store fits only when every query is a known lookup; a scan that is fast at launch is a time-out a year later (DynamoDB best practices: design for access patterns; Fowler, PolyglotPersistence).',
      scenario: { label: 'Scan on request path refused', given: 'the access-pattern catalogue and the request-handling code', when: 'a change calls Scan or KEYS outside a batch job', then: 'the lint fails naming the call' },
    },
    {
      id: 'req-indexed-reads', label: 'Request paths read by index', when: { MODEL: ['relational', 'document'] }, ears_type: 'ubiquitous',
      action: 'serve every query on a request path from a key or an index, with 0 whole-table or whole-collection scans over a table or collection above 10,000 rows on a request path',
      rationale: 'A full scan that is fast at launch is a time-out a year later; small tables are scanned by design and are not the problem (Fowler, PolyglotPersistence; Kleppmann, Designing Data-Intensive Applications, ch. 3).',
      scenario: { label: 'No scan on request path', given: 'the store loaded with production-sized data and its scan counters reset', when: 'the request-path test suite runs and the counters are read', then: 'no table or collection above 10,000 rows was scanned whole' },
    },
    {
      id: 'req-versioned', label: 'Migrations are versioned', when: { MIGRATIONS: ['tool', 'orm'], MODEL: ['relational'] }, ears_type: 'event-driven',
      trigger: 'a change needs a different schema, index or reference data',
      action: 'apply it as a versioned migration committed with the code and run by the deploy pipeline with {{MIGRATIONS}}, with 0 schema changes made by hand in any shared environment',
      rationale: 'A schema changed by hand differs between environments, and the difference shows up in production (Sadalage and Fowler, Evolutionary Database Design: all database artefacts are version controlled).',
      scenario: { label: 'Migration applied by pipeline', given: 'a change that adds a column', when: 'it is deployed to each environment in turn', then: 'the same versioned migration is applied by the pipeline everywhere, and the migration history matches in every environment' },
    },
    {
      id: 'req-versioned-doc', label: 'Collection changes are versioned', when: { MIGRATIONS: ['tool'], MODEL: ['document'] }, ears_type: 'event-driven',
      trigger: 'a change needs a different validator, index or reference data',
      action: 'apply it as a versioned changeset committed with the code and run by the deploy pipeline with {{MIGRATIONS}}, with 0 validator or index changes made by hand in any shared environment',
      rationale: 'A collection changed by hand differs between environments, and the difference shows up in production (Sadalage and Fowler, Evolutionary Database Design: all database artefacts are version controlled).',
      scenario: { label: 'Changeset applied by pipeline', given: 'a change that adds an index', when: 'it is deployed to each environment in turn', then: 'the same versioned changeset is applied by the pipeline everywhere, and the changelog history matches in every environment' },
    },
    {
      id: 'req-lazy', label: 'Old records upgraded', when: { MIGRATIONS: ['lazy'], MODEL: ['document', 'keyvalue'] }, ears_type: 'event-driven',
      trigger: 'a record written under an older schema version is read',
      action: 'upgrade it to the current version in code before use, write it back at the next save, and backfill in the background so that 0 records are more than 2 schema versions behind',
      rationale: 'Upgrading on read spreads the cost of a change over time; the backfill keeps the code from carrying upgraders for every version ever written (MongoDB, the Schema Versioning pattern).',
      scenario: { label: 'Old record read', given: 'a record at schema version N-1', when: 'the element reads it and later saves it', then: 'it is used as version N and stored as version N' },
    },
    {
      id: 'req-integrity', label: 'Integrity enforced by the database', when: { MODEL: ['relational'] }, ears_type: 'ubiquitous',
      action: 'enforce the invariants between records in the database itself, with a primary key on 100% of tables, a foreign key on every reference column, and unique and check constraints for the rules they can express',
      rationale: 'Every code path, script and future application obeys a constraint; only some of them obey application code (Sadalage and Fowler, Evolutionary Database Design; PostgreSQL documentation, constraints).',
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
      action: 'answer 99% of key reads and writes within {{P99_MS}} ms as measured by the store, and keep every item under 400 KB',
      rationale: 'Predictable low latency at any scale is the reason to give up queries; 400 KB is DynamoDB\'s item limit, and large values in Redis block other commands (DynamoDB best practices).',
      scenario: { label: 'Lookups within target', given: 'the store at production volume', when: 'a day of key reads and writes has been served and the store\'s latency percentiles are read', then: 'the 99th percentile of reads and of writes is within {{P99_MS}} ms' },
    },
    {
      id: 'req-transactions', label: 'Operations commit whole', when: { CONSISTENCY: ['strong'] }, ears_type: 'event-driven',
      trigger: 'a business operation changes several records',
      action: 'commit all its changes in one transaction, so that 0 readers see part of the operation and a failure leaves none of it',
      rationale: 'A half-applied operation (money taken, order not created) is the hardest kind of bug to find and repair (Kleppmann, Designing Data-Intensive Applications, ch. 7).',
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
      action: 'keep a daily logical export of all data in storage the organisation controls, in a format a self-hosted engine of the same kind loads, with the newest export less than 26 hours old',
      rationale: 'A managed service is a dependency on one provider; an export it does not hold is the exit plan (DORA Art. 28, exit strategies). Loading it into a self-hosted engine is the restore drill of the Backup and recovery pack.',
      scenario: { label: 'Export is fresh', given: 'the storage the organisation controls', when: 'the freshness check runs', then: 'the newest export there is less than 26 hours old' },
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
      decision: 'The data is kept in a relational database: PostgreSQL by default, MySQL where the team or platform already runs it. Consistency: {{CONSISTENCY}}; where it is eventual, reads are at most {{STALE_SECONDS}} seconds old. Hosting: {{HOSTING}} (managed: Amazon RDS or Aurora, Azure Database for PostgreSQL or for MySQL flexible server, Google Cloud SQL; self-hosted: CloudNativePG on Kubernetes or Patroni on virtual machines). Schema changes: {{MIGRATIONS}}; whether a change ships as expand and contract or in a window, and how migrations are linted for it, is decided in the Deployment and rollback pack. Constraints, not only code, enforce the invariants; JSONB columns hold the parts whose shape varies. Choosing PostgreSQL or MySQL: PostgreSQL for richer types (JSONB, arrays, ranges), extensions (PostGIS, pgvector) and transactional DDL; MySQL when existing operations know it. Choosing managed or self-hosted: managed unless data residency, cost at scale or an on-premises platform rules it out.',
      consequences: '• Any query can be written later, including the reports and back-office searches nobody listed today.\n• Transactions and constraints keep the data consistent across entities without application code.\n• Scaling writes past one primary needs partitioning, sharding (Citus, Vitess) or a different store for the hot path.\n• Every schema change is a migration, planned with the code version still running.',
      alternatives: '1. A document database: aggregates read whole and flexible shapes, at the cost of joins and cross-document constraints.\n2. A key-value store: scale and latency for known lookups, no ad hoc queries.\n3. A distributed SQL database (CockroachDB, YugabyteDB, Spanner): relational with horizontal write scale, more cost and latency per write.',
    },
    {
      id: 'adr-document', label: 'A document database', when: { MODEL: ['document'] },
      decision: 'The data is kept in a document database, MongoDB, one document per aggregate, with a JSON Schema validator on every collection. Consistency: {{CONSISTENCY}} (majority write concern; reads from the primary or with majority read concern where it must be strong); where it is eventual, secondaries serve reads at most {{STALE_SECONDS}} seconds old. Hosting: {{HOSTING}} (managed: MongoDB Atlas; self-hosted: the MongoDB or Percona operator on Kubernetes). Schema changes: {{MIGRATIONS}}; whether a change ships as expand and contract or in a window is decided in the Deployment and rollback pack. References between aggregates by id; multi-document transactions only where one operation must change two aggregates. Choosing MongoDB or a PostgreSQL JSONB column: MongoDB when most data is documents and scale-out by sharding is likely; JSONB when only a part of a mostly relational model varies in shape. Amazon DocumentDB or Azure Cosmos DB for MongoDB only after checking the features you need are compatible.',
      consequences: '• An aggregate is read and written in one operation, with no mapping to tables.\n• Shapes can vary between records, and the validator still stops malformed writes.\n• Joins and constraints across documents are the application\'s job; queries not planned for need new indexes or pipelines.\n• Data duplicated across documents for read speed must be kept in step by code.',
      alternatives: '1. A relational database with JSONB columns: constraints and joins with flexible parts.\n2. A key-value store: simpler and faster for lookups by key, no queries on content.\n3. A search engine (OpenSearch) as the main store: great for text search, weak as a system of record.',
    },
    {
      id: 'adr-keyvalue', label: 'A key-value store', when: { MODEL: ['keyvalue'] },
      decision: 'The data is kept in a key-value store designed from its access patterns: Amazon DynamoDB (single-table design, keys and global secondary indexes per listed access pattern, on-demand or provisioned capacity) for durable data on AWS; Redis (or Valkey) with persistence only for small, short-lived or rebuildable data such as sessions, counters and rate limits. Key reads and writes answer within {{P99_MS}} ms at the 99th percentile, measured by the store. Consistency: {{CONSISTENCY}} (DynamoDB strongly consistent reads and TransactWriteItems where it must be strong); where it is eventual, replicas and global tables lag at most {{STALE_SECONDS}} seconds. Hosting: {{HOSTING}} (managed: DynamoDB, ElastiCache or MemoryDB; self-hosted: Redis with Sentinel or Valkey cluster). Schema changes: tables and indexes are infrastructure code applied by the pipeline; item shapes carry a schema version and old items are upgraded in code when read. No Scan on a request path. Choosing DynamoDB or Redis: DynamoDB when the data must survive and grow without limit; Redis when it fits in memory and losing the last second is acceptable. Outside AWS: Azure Cosmos DB or Google Bigtable play DynamoDB\'s part.',
      consequences: '• Single-digit-millisecond latency at any scale, with capacity that scales without re-architecture.\n• Every query must be designed up front; a new access pattern means a new index or a backfill.\n• No joins and limited transactions; reports and analytics go to an export (DynamoDB to S3, Athena) rather than the store.\n• DynamoDB ties the element to AWS; the item and transaction limits shape the design.',
      alternatives: '1. A relational database: any query, transactions and constraints, with less headroom for scale.\n2. A document database: richer queries on content, more operational work.\n3. A cache in front of a relational database: keeps queries flexible and lookups fast, adds invalidation.',
    },
  ],
  fitness: [
    {
      id: 'ff-flyway', label: 'Migrations apply cleanly', when: { MIGRATIONS: ['tool'], MODEL: ['relational'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-relational'], checks: ['req-versioned'],
      threshold: 'Every migration applies to an empty database of the production engine and version; 0 checksum mismatches against applied migrations',
      description: 'On every pull request the pipeline starts the production engine and version, applies all migrations from empty, and validates them; the deploy runs migrate and validate against each environment, so a schema changed by hand shows up as a validation failure. With Liquibase the same is `liquibase update` followed by `liquibase validate`.',
      tool: 'Flyway (PostgreSQL shown; MySQL: the mysql service image and a jdbc:mysql URL)',
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
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
      - run: |
          docker run --rm --network host -v "$PWD/db/migration:/flyway/sql" flyway/flyway:11 \\
            -url=jdbc:postgresql://localhost:5432/app -user=postgres -password=test \\
            -validateMigrationNaming=true migrate validate`,
    },
    {
      id: 'ff-liquibase-mongo', label: 'Changesets apply cleanly', when: { MIGRATIONS: ['tool'], MODEL: ['document'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-document'], checks: ['req-versioned-doc'],
      threshold: 'Every changeset applies to an empty MongoDB of the production version; after the update the changelog reports nothing pending',
      description: 'On every pull request the pipeline starts the production MongoDB version, applies the changelog from empty with Liquibase and its MongoDB extension (the extension and MongoDB driver jars are kept in db/lib and mounted into /liquibase/lib), and checks that status reports the database up to date; the deploy runs the same update against each environment.',
      tool: 'Liquibase with the liquibase-mongodb extension',
      language: 'yaml',
      snippet: `# .github/workflows/migrations.yml
jobs:
  migrations:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:8.0            # the production version
        ports: ['27017:27017']
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
      - run: |
          lb() { docker run --rm --network host -v "$PWD/db:/liquibase/changelog" -v "$PWD/db/lib:/liquibase/lib" \\
                   liquibase/liquibase:4.31 --url="mongodb://localhost:27017/app" --changelog-file=changelog.xml "$@"; }
          lb update
          lb status --verbose | grep -q 'is up to date'`,
    },
    {
      id: 'ff-orm-drift', label: 'Model and migrations agree', when: { MIGRATIONS: ['orm'], MODEL: ['relational'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-relational'], checks: ['req-versioned'],
      threshold: '0 differences between the model in code and the committed migrations',
      description: 'The build fails when the model in code changed without a migration, so every schema change is a committed, versioned migration.',
      tool: 'Prisma Migrate (prisma migrate diff); EF Core: dotnet ef migrations has-pending-model-changes; Alembic: alembic check; Django: manage.py makemigrations --check --dry-run',
      language: 'bash',
      snippet: `# exits 2 when the schema and the migrations differ
npx prisma migrate diff \\
  --from-migrations prisma/migrations \\
  --to-schema-datamodel prisma/schema.prisma \\
  --shadow-database-url "$SHADOW_DATABASE_URL" \\
  --exit-code`,
    },
    {
      id: 'ff-schema-versions', label: 'No document far behind', when: { MIGRATIONS: ['lazy'], MODEL: ['document'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-document'], checks: ['req-lazy'],
      threshold: '0 documents more than 2 schema versions behind the current one, documents without a version field included',
      description: 'A scheduled job counts the documents per collection that are more than two versions behind the version the code writes, or carry no schema version at all (the oldest of all), and fails when any exist; the backfill job then runs.',
      tool: 'mongosh (scheduled job)',
      language: 'js',
      snippet: `// check-schema-versions.js — mongosh "$MONGODB_URI" --file check-schema-versions.js
const CURRENT = { orders: 7, customers: 4 }   // the version the code writes
let behind = 0
for (const [name, version] of Object.entries(CURRENT)) {
  const n = db.getCollection(name).countDocuments({
    $or: [{ schemaVersion: { $lt: version - 2 } }, { schemaVersion: { $exists: false } }],
  })
  if (n > 0) print(\`\${name}: \${n} documents more than 2 versions behind\`)
  behind += n
}
if (behind > 0) quit(1)`,
    },
    {
      id: 'ff-schema-versions-kv', label: 'No item far behind', when: { MIGRATIONS: ['lazy'], MODEL: ['keyvalue'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-keyvalue'], checks: ['req-lazy'],
      threshold: '0 items more than 2 schema versions behind the current one, items without a version attribute included',
      description: 'A scheduled batch job (the one place a Scan is allowed) counts the items more than two versions behind the version the code writes, or without a schema version at all, and fails when any exist; the backfill job then runs. The CLI pages the scan and sums the count.',
      tool: 'AWS CLI (DynamoDB); Redis: a SCAN over the key space in a job, reading the version field of each value',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CURRENT: the schema version the code writes; TABLE from the environment
set -euo pipefail
CURRENT=7
behind=$(aws dynamodb scan --table-name "$TABLE" --select COUNT \\
  --filter-expression 'attribute_not_exists(schemaVersion) OR schemaVersion < :v' \\
  --expression-attribute-values "{\\":v\\":{\\"N\\":\\"$((CURRENT - 2))\\"}}" --query Count --output text)
[ "$behind" -eq 0 ] || { echo "$behind items more than 2 schema versions behind"; exit 1; }`,
    },
    {
      id: 'ff-seq-scan', label: 'No sequential scan on request paths', when: { MODEL: ['relational'] }, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-relational'], checks: ['req-indexed-reads'],
      threshold: '0 sequential scans over a table above 10,000 rows during the request-path test suite',
      description: 'The integration pipeline loads a database with production-sized data, resets the statistics, runs the request-path test suite, then reads pg_stat_user_tables: a table above 10,000 rows with a sequential scan since the reset fails the job.',
      tool: 'psql (PostgreSQL); MySQL: sys.schema_tables_with_full_table_scans after the same suite',
      language: 'sql',
      snippet: `-- before the request-path test suite, on a database loaded with production-sized data:
SELECT pg_stat_reset();

-- after it: tables above 10,000 rows that were read whole; the job fails on any row
SELECT relname, seq_scan, n_live_tup
FROM pg_stat_user_tables
WHERE n_live_tup > 10000 AND seq_scan > 0
ORDER BY seq_scan DESC;`,
    },
    {
      id: 'ff-collscan', label: 'No collection scan on request paths', when: { MODEL: ['document'] }, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-document'], checks: ['req-indexed-reads'],
      threshold: '0 COLLSCAN operations over a collection above 10,000 documents during the request-path test suite',
      description: 'The integration pipeline loads a database with production-sized data, turns the profiler on for every operation, runs the request-path test suite, then reads system.profile: an operation whose plan was a collection scan over a collection above 10,000 documents fails the job.',
      tool: 'mongosh',
      language: 'js',
      snippet: `// before the request-path test suite: db.setProfilingLevel(2)
// after it — mongosh "$MONGODB_URI" --file check-collscan.js
const big = db.getCollectionNames()
  .filter((n) => !n.startsWith('system.') && db.getCollection(n).estimatedDocumentCount() > 10000)
  .map((n) => \`\${db.getName()}.\${n}\`)
const scans = db.system.profile.find({ planSummary: 'COLLSCAN', ns: { $in: big } }).toArray()
if (scans.length) {
  print(scans.map((s) => \`\${s.ns}: \${JSON.stringify(s.command)}\`).join('\\n'))
  quit(1)
}`,
    },
    {
      id: 'ff-integrity', label: 'Keys and foreign keys present', when: { MODEL: ['relational'] }, characteristic: 'functional-suitability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-relational'], checks: ['req-integrity'],
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
      id: 'ff-validators', label: 'Collections validate writes', when: { MODEL: ['document'] }, characteristic: 'functional-suitability', scope: 'atomic', cadence: 'triggered', trigger: 'deploy', invocation: 'automated', implements: ['adr-document'], checks: ['req-documents'],
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
      id: 'ff-no-scan', label: 'No Scan in request code', when: { MODEL: ['keyvalue'] }, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-keyvalue'], checks: ['req-access-patterns'],
      threshold: '0 uses of the DynamoDB Scan command or the Redis KEYS command outside src/jobs',
      description: 'A lint rule forbids importing the DynamoDB Scan command and calling keys() on a client in request-handling code; batch jobs under src/jobs are exempt.',
      tool: 'ESLint (Node.js); other runtimes: a Semgrep rule on the same call names',
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
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.property.name="keys"][callee.object.name!="Object"]',
        message: 'ADR Key-value store: KEYS blocks Redis; use SCAN in a job under src/jobs, never in a request.',
      }],
    },
  },
]`,
    },
    {
      id: 'ff-kv-latency', label: 'Key lookups within target', when: { MODEL: ['keyvalue'] }, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-keyvalue'], checks: ['req-kv-latency'],
      threshold: '99th percentile of the store\'s request latency for GetItem and PutItem at most {{P99_MS}} ms in every hour of the last 24 hours',
      description: 'A daily job reads the store\'s own latency percentile per operation from CloudWatch (SuccessfulRequestLatency, p99, hourly) and fails when any hour exceeds the budget. Runs on Linux (GNU date).',
      tool: 'AWS CLI with CloudWatch SuccessfulRequestLatency (DynamoDB); Redis: redis-benchmark -t get,set against the production-sized store, reading its p99 line',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# daily: the store's p99 for key reads and writes over the last 24 hours, per hour
set -euo pipefail
fail=0
for op in GetItem PutItem; do
  p99=$(aws cloudwatch get-metric-statistics --namespace AWS/DynamoDB --metric-name SuccessfulRequestLatency \\
    --dimensions Name=TableName,Value="$TABLE" Name=Operation,Value="$op" \\
    --start-time "$(date -u -d '24 hours ago' +%FT%TZ)" --end-time "$(date -u +%FT%TZ)" --period 3600 \\
    --extended-statistics p99 --query 'max(Datapoints[].ExtendedStatistics.p99)' --output text)
  [ "$p99" = None ] || [ "$(jq -n "$p99 <= {{P99_MS}}")" = true ] || { echo "$op p99 $p99 ms, budget {{P99_MS}} ms"; fail=1; }
done
exit $fail`,
    },
    {
      id: 'ff-atomic', label: 'Failed operation leaves nothing', when: { CONSISTENCY: ['strong'] }, characteristic: 'functional-suitability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MODELS, checks: ['req-transactions'],
      threshold: 'For every business operation that writes several records: a fault after its second write leaves 0 records changed',
      description: 'An integration test against the real engine (Testcontainers) injects a fault after the second write of an operation through the repository\'s test hook and asserts that none of its records exists afterwards; one such test per multi-record operation.',
      tool: 'Vitest (or your stack\'s test runner) with Testcontainers',
      language: 'ts',
      snippet: `import { afterEach, expect, it } from 'vitest'
import { failAfterWrites, reset } from '../src/data/testHooks'   // the repository's fault injection, test builds only
import { orderLines, orders, placeOrder } from '../src/orders'

afterEach(reset)

it('a failure after the second write leaves nothing of the operation', async () => {
  failAfterWrites(2)                                           // the third write throws
  await expect(placeOrder(sampleOrderWithThreeLines())).rejects.toThrow()
  expect(await orders.find(sampleOrderId)).toBeNull()
  expect(await orderLines.countFor(sampleOrderId)).toBe(0)
})`,
    },
    {
      id: 'ff-replica-lag', label: 'Replica lag within bound', when: { CONSISTENCY: ['eventual'], MODEL: ['relational'] }, characteristic: 'reliability', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: ['adr-relational'], checks: ['req-staleness'],
      threshold: 'Replica lag at most {{STALE_SECONDS}} seconds; an alert fires after 2 minutes above it',
      description: 'An alert on postgres_exporter\'s replication-lag metric pages when a replica falls further behind than the bound.',
      tool: 'Prometheus with postgres_exporter (PostgreSQL); MySQL: mysqld_exporter\'s mysql_slave_status_seconds_behind_master',
      language: 'yaml',
      snippet: `groups:
  - name: data-store
    rules:
      - alert: ReplicaLagAboveBound
        expr: max by (instance) (pg_replication_lag_seconds) > {{STALE_SECONDS}}
        for: 2m
        labels: { severity: page }
        annotations:
          summary: "Replica {{ $labels.instance }} lags {{ $value }}s behind the primary"`,
    },
    {
      id: 'ff-replica-lag-document', label: 'Secondary lag within bound', when: { CONSISTENCY: ['eventual'], MODEL: ['document'] }, characteristic: 'reliability', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: ['adr-document'], checks: ['req-staleness'],
      threshold: 'Replica set member lag at most {{STALE_SECONDS}} seconds; an alert fires after 2 minutes above it',
      description: 'An alert on the MongoDB exporter\'s member replication lag (compatible-mode metric from replSetGetStatus) pages when a secondary falls further behind than the bound.',
      tool: 'Prometheus with the Percona mongodb_exporter (--compatible-mode)',
      language: 'yaml',
      snippet: `groups:
  - name: data-store
    rules:
      - alert: SecondaryLagAboveBound
        expr: max by (set, name) (mongodb_mongod_replset_member_replication_lag{state="SECONDARY"}) > {{STALE_SECONDS}}
        for: 2m
        labels: { severity: page }
        annotations:
          summary: "{{ $labels.name }} in {{ $labels.set }} lags {{ $value }}s behind the primary"`,
    },
    {
      id: 'ff-replica-lag-kv', label: 'Replication lag within bound', when: { CONSISTENCY: ['eventual'], MODEL: ['keyvalue'] }, characteristic: 'reliability', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: ['adr-keyvalue'], checks: ['req-staleness'],
      threshold: 'Redis replica lag, or DynamoDB global table replication latency, at most {{STALE_SECONDS}} seconds; an alert fires after 2 minutes above it',
      description: 'Two alert rules: the Redis exporter\'s replica lag, and DynamoDB\'s ReplicationLatency (milliseconds, per receiving region) brought into Prometheus by the CloudWatch exporter; either pages when a replica falls further behind than the bound.',
      tool: 'Prometheus with redis_exporter and the CloudWatch exporter (aws_dynamodb_replication_latency_maximum)',
      language: 'yaml',
      snippet: `groups:
  - name: data-store
    rules:
      - alert: RedisReplicaLagAboveBound
        expr: max by (instance) (redis_connected_slave_lag_seconds) > {{STALE_SECONDS}}
        for: 2m
        labels: { severity: page }
        annotations:
          summary: "Redis {{ $labels.instance }}: a replica lags {{ $value }}s"
      - alert: DynamoDBReplicationLagAboveBound
        expr: max by (table_name, receiving_region) (aws_dynamodb_replication_latency_maximum) / 1000 > {{STALE_SECONDS}}
        for: 2m
        labels: { severity: page }
        annotations:
          summary: "{{ $labels.table_name }} replicates to {{ $labels.receiving_region }} with {{ $value }}s latency"`,
    },
    {
      id: 'ff-export', label: 'Export is fresh', when: { HOSTING: ['managed'] }, characteristic: 'flexibility', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: MODELS, checks: ['req-exit'],
      threshold: 'The newest export in storage the organisation controls is less than 26 hours old',
      description: 'A scheduled check lists the export location through rclone (S3, Azure Blob Storage, Google Cloud Storage and others alike), takes the newest object\'s modification time and fails when it is older than 26 hours (a daily export with two hours of slack). Runs on Linux (GNU date).',
      tool: 'rclone with jq (scheduled check)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# EXPORT_REMOTE: an rclone remote in storage we control, e.g. s3:exports/orders, azblob:exports/orders, gcs:exports/orders
set -euo pipefail
newest=$(rclone lsjson "$EXPORT_REMOTE" --files-only --recursive | jq -r 'max_by(.ModTime).ModTime')
[ "$newest" != null ] || { echo "no export found in $EXPORT_REMOTE"; exit 1; }
age=$(( $(date +%s) - $(date -d "$newest" +%s) ))
[ "$age" -lt $((26 * 3600)) ] || { echo "newest export is $((age / 3600)) h old"; exit 1; }`,
    },
    engineCurrent('relational', 'adr-relational', 'postgresql', 'PostgreSQL', `psql "$DATABASE_URL" -tAc 'SHOW server_version' | cut -d' ' -f1`, 1,
      'endoflife.date API with psql (PostgreSQL); MySQL: SELECT VERSION() and the mysql product, cycle of two numbers'),
    engineCurrent('document', 'adr-document', 'mongodb', 'MongoDB', `mongosh "$MONGODB_URI" --quiet --eval 'db.version()'`, 2,
      'endoflife.date API with mongosh'),
    engineCurrent('keyvalue', 'adr-keyvalue', 'redis', 'Redis', `redis-cli -u "$REDIS_URL" INFO server | tr -d '\\r' | awk -F: '/^redis_version:/ { print $2 }'`, 2,
      'endoflife.date API with redis-cli (Redis; Valkey: the valkey product)'),
  ],
}

export default pack
