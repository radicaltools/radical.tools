import type { PackSpec, When } from '../../src/packSpec'

const TENANTS: When = { ISOLATION: ['pool', 'schema', 'database', 'silo'] }
const SHARED: When = { ISOLATION: ['pool', 'schema', 'database'] }
const FORCES = 'This element keeps data, and the system may serve several customer organisations (tenants) from one deployment. The forces: one query that forgets the tenant filter, one cache key or file path without the tenant, or one tenant id taken from the request instead of the credential shows a customer another\'s data; the more is shared, the cheaper each tenant is to run and the further one mistake reaches; one tenant\'s load slows everyone sharing the same database or service (the noisy neighbour); customers ask for their own keys, their own region and proof that their data is gone when they leave; and per-tenant schemas, databases or deployments multiply what has to be migrated and run.'

const pack: PackSpec = {
  id: 'concern-tenant-isolation',
  name: 'Tenant isolation',
  group: 'identity',
  description: 'How one customer organisation\'s data and load stay apart from another\'s: where tenants are separated, how a noisy neighbour is held back, whose keys encrypt the data, and how a tenant leaves.',
  tags: ['security', 'multi-tenancy', 'saas', 'isolation', 'row-level-security', 'encryption'],
  concern: {
    id: 'tenant-isolation',
    trigger: 'LIST RELATIONS WHERE target.type = "database" AND target.external != true AND source.external != true AND source.type != "person"',
    applyTo: 'target',
    why: 'these databases keep the system\'s data, so whether several customer organisations share them, and how their data is kept apart, has to be decided.',
  },
  sources: [
    { title: 'AWS Well-Architected SaaS Lens: silo, pool and bridge isolation', url: 'https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/saas-lens.html' },
    { title: 'Azure Architecture Center: Architect multitenant solutions', url: 'https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/overview' },
    { title: 'PostgreSQL documentation: Row Security Policies', url: 'https://www.postgresql.org/docs/current/ddl-rowsecurity.html' },
    { title: 'OWASP ASVS 4.0.3, V4 Access Control', url: 'https://owasp.org/www-project-application-security-verification-standard/' },
    { title: 'NIST SP 800-57 Part 1 Rev. 5, Recommendation for Key Management', url: 'https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final' },
  ],
  questions: [
    {
      key: 'ISOLATION', title: 'Isolation', label: 'How are tenants kept apart?',
      hint: 'The more tenants share, the cheaper each is to run and the further one missed filter reaches. Most systems pool small tenants and give large or regulated ones more.',
      default: 'pool',
      options: [
        { value: 'pool', label: 'shared schema with row-level security', description: 'All tenants in the same tables, every row carrying a tenant id, and the database itself filtering by it (PostgreSQL row-level security, SQL Server security policies). Pick it for many small tenants (hundreds or more) on a self-service plan.' },
        { value: 'schema', label: 'a schema per tenant', description: 'One database, one schema per tenant with its own database role. Pick it for tens to a few hundred tenants who want a clean export and per-tenant restore, without a database each.' },
        { value: 'database', label: 'a database per tenant', description: 'Each tenant gets its own database (or cluster) with its own credentials, the application shared. Pick it for fewer, larger tenants, per-tenant backup and restore, data residency per tenant, or contracts that ask for it.' },
        { value: 'silo', label: 'a deployment per tenant', description: 'Each tenant runs its own copy of the whole stack in its own account or project. Pick it for a handful of large or regulated customers (government, health, banking) who pay for it, or when a customer must run it in their own cloud.' },
        { value: 'single', label: 'one organisation only', description: 'The system serves one organisation and will not hold another\'s data. Pick it for an in-house system; the decision records it so that a second customer is not added on the quiet.' },
      ],
    },
    {
      key: 'NOISY', title: 'Noisy neighbours', label: 'How is one tenant\'s load kept from slowing the others?',
      hint: 'Where tenants share a database or service, one tenant\'s import or report can take it from everyone. Limits per tenant keep the damage to that tenant.',
      default: 'quotas',
      options: [
        { value: 'quotas', label: 'per-tenant quotas', description: 'Every tenant has limits on requests per second, concurrent queries and background jobs, enforced at the gateway and the job queue. Pick it when tenants are of similar size and on the same plan.' },
        { value: 'tiered', label: 'quotas and dedicated capacity', description: 'Quotas for everyone, and tenants that outgrow a share of the pool are moved to dedicated capacity (their own database or nodes) under a premium tier. Pick it when a few tenants are much larger than the rest, or larger tenants pay for guaranteed capacity.' },
      ],
    },
    {
      key: 'KEYS', title: 'Encryption keys', label: 'Whose keys encrypt each tenant\'s data?',
      hint: 'Keys per tenant make a leaked backup or a missed filter less useful, and deleting a tenant\'s key deletes its data everywhere, backups included.',
      default: 'tenant',
      options: [
        { value: 'tenant', label: 'a key per tenant', description: 'Each tenant\'s data is encrypted with its own key in the platform\'s key management service, so deleting the key erases the tenant (crypto-shredding). Pick it when tenants hold personal or confidential data, or you must prove deletion when a tenant leaves.' },
        { value: 'customer', label: 'customer-managed keys', description: 'Tenants hold their own keys in their own key management service (bring your own key) and can revoke our access at any time. Pick it for enterprise or regulated customers who require control of their keys.' },
        { value: 'shared', label: 'platform keys', description: 'The data stores are encrypted at rest with the platform\'s keys, the same for all tenants; isolation rests on access control. Pick it for data of low sensitivity, or while no customer asks for more.' },
      ],
    },
  ],
  details: [
    { key: 'TENANT_RPS', label: 'Requests per second one tenant may make', default: '100', number: true },
    { key: 'OFFBOARD_DAYS', label: 'Days within which a leaving tenant\'s data is erased', default: '30', number: true },
  ],
  need: {
    label: 'Tenants never see each other',
    text: 'Customer organisations may share this system, and the element keeps their data. No tenant may ever see, change or slow down another: a forgotten tenant filter, a tenant id taken from the request, a shared cache key or file path, or one tenant\'s heavy job each breaks that promise for everyone. Customers also ask whose keys protect their data, where it is kept, and for proof that it is gone when they leave. If the system serves one organisation only, that has to be a decision too, so a second one is not added on the quiet.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-tenant-context', label: 'Tenant from the credential', when: TENANTS, ears_type: 'ubiquitous',
      action: 'take the tenant of every request only from the authenticated credential, never from a parameter, header or body the caller sets, and carry it to every query, cache key, file path, message and log line the request leads to',
      rationale: 'A tenant id the caller can set is an open door; one cache key or object path without it is a cross-tenant leak (ASVS V4.2.1; AWS SaaS Lens, tenant context).',
      scenario: { label: 'Forged tenant ignored', given: 'a user of tenant A', when: 'the user sends a request naming tenant B in a header and in the body', then: 'the request runs for tenant A only, and every query, cache key and log line it leads to carries tenant A' },
    },
    {
      id: 'req-cross-tenant', label: 'Other tenants\' data unseen', when: TENANTS, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request names a record, file or key that belongs to another tenant',
      action: 'answer 404 as if it did not exist, return and change nothing of it, and record the attempt as a security event, alerting on more than 10 in an hour from one tenant',
      rationale: 'The answer must not confirm that the record exists, and attempts to cross the boundary are a signal (OWASP API1:2023; ASVS V4.2.1).',
      scenario: { label: 'Other tenant\'s record', given: 'two tenants with an order each', when: 'a user of the first asks for, changes and lists the second\'s order by its id', then: 'every answer is 404 or leaves it out, nothing of the order is returned or changed, and a security event is recorded' },
    },
    {
      id: 'req-rls', label: 'Database filters by tenant', when: { ISOLATION: ['pool'] }, ears_type: 'ubiquitous',
      action: 'enable and force row-level security on every table that holds tenant data, set the tenant for each transaction from the request, and connect the application with a role that cannot bypass the policies',
      rationale: 'With all tenants in one table, a filter the database applies itself still holds when a query in the code forgets it (PostgreSQL Row Security Policies; AWS SaaS Lens, pool isolation).',
      scenario: { label: 'Forgotten filter holds', given: 'two tenants with rows in the same table', when: 'a query without any tenant condition runs in a transaction of the first tenant', then: 'it returns only the first tenant\'s rows' },
    },
    {
      id: 'req-schema-onboard', label: 'Schema per tenant', when: { ISOLATION: ['schema'] }, ears_type: 'event-driven',
      trigger: 'a tenant is onboarded',
      action: 'create its schema and a database role granted only on that schema, apply every migration within 5 minutes, and open every connection of its requests with that role and its schema alone on the search path',
      rationale: 'A schema boundary only holds when each tenant\'s requests cannot name another schema; a role per schema makes the database refuse it (Azure multitenant guidance, schema per tenant).',
      scenario: { label: 'Other schema refused', given: 'two onboarded tenants', when: 'a request of the first names a table of the second\'s schema explicitly', then: 'the database refuses it with a permission error' },
    },
    {
      id: 'req-database-onboard', label: 'Database per tenant', when: { ISOLATION: ['database'] }, ears_type: 'event-driven',
      trigger: 'a tenant is onboarded',
      action: 'provision its database with credentials valid for that database only within 15 minutes, register it in the tenant catalogue, and have the application open connections only through the catalogue entry of the caller\'s tenant',
      rationale: 'A database per tenant isolates storage, backups and restores; the routing from tenant to database becomes the boundary to protect (AWS SaaS Lens, silo storage; Azure multitenant guidance).',
      scenario: { label: 'Routed to own database', given: 'two onboarded tenants', when: 'a user of the first makes a request', then: 'it opens a connection only to the first tenant\'s database, whose credentials cannot open the second\'s' },
    },
    {
      id: 'req-migrate-all', label: 'Every tenant migrated', when: { ISOLATION: ['schema', 'database'] }, ears_type: 'event-driven',
      trigger: 'a release changes the database schema',
      action: 'bring every tenant to the new schema version within 24 hours, report each tenant that fails, and keep the application working with both versions until the last tenant is migrated',
      rationale: 'With a schema or database per tenant, a migration runs once per tenant; one that fails silently leaves a tenant on a version the code no longer expects (Azure multitenant guidance, deployment and migration).',
      scenario: { label: 'Migration reaches all', given: 'tenants on schema version 41', when: 'a release with migration 42 is deployed', then: 'within 24 hours every tenant is on version 42, or the failing ones are reported' },
    },
    {
      id: 'req-silo', label: 'Nothing shared between stacks', when: { ISOLATION: ['silo'] }, ears_type: 'ubiquitous',
      action: 'deploy each tenant as its own stack in its own cloud account or project, with no data store, queue, key or credential shared with another tenant, and roll every release out to all stacks within 7 days',
      rationale: 'A deployment per tenant isolates everything, but only while no resource is shared and the stacks do not drift apart in version (AWS SaaS Lens, silo model).',
      scenario: { label: 'Stacks share nothing', given: 'the infrastructure code of two tenant stacks', when: 'their resources and access policies are compared', then: 'no data store, queue, key or credential appears in both, and both run the same release' },
    },
    {
      id: 'req-quota', label: 'Noisy tenant throttled', when: SHARED, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a tenant exceeds {{TENANT_RPS}} requests per second, or its quota of concurrent queries or background jobs',
      action: 'throttle that tenant alone with 429 and a Retry-After header, and keep the other tenants\' p95 latency within 10% of its level before the burst',
      rationale: 'Where tenants share capacity, one tenant\'s load must cost that tenant, not everyone (AWS SaaS Lens, noisy neighbour; Azure multitenant guidance).',
      scenario: { label: 'Burst stays contained', given: 'two tenants under normal load', when: 'the first sends ten times {{TENANT_RPS}} requests per second for 5 minutes', then: 'the first gets 429 with Retry-After for the excess, and the second\'s p95 latency rises by less than 10%' },
    },
    {
      id: 'req-tier-move', label: 'Large tenants moved out', when: { ...SHARED, NOISY: ['tiered'] }, ears_type: 'event-driven',
      trigger: 'a tenant uses more than 20% of a shared database\'s or service\'s capacity for 7 days in a row',
      action: 'propose it for dedicated capacity, and once approved move it with no more than 5 minutes of write downtime',
      rationale: 'Quotas protect the others but hold the large tenant back; moving it out keeps both served (AWS SaaS Lens, tiered and bridge models).',
      scenario: { label: 'Large tenant moved', given: 'a tenant using 25% of the shared database for 7 days', when: 'its move to a dedicated database is approved and run', then: 'its data is on the dedicated database and writes were refused for no more than 5 minutes' },
    },
    {
      id: 'req-tenant-keys', label: 'Data encrypted per tenant', when: { ...TENANTS, KEYS: ['tenant', 'customer'] }, ears_type: 'ubiquitous',
      action: 'encrypt each tenant\'s data with a data key of its own (envelope encryption with the tenant id as encryption context), so that no key decrypts two tenants\' data and deleting a tenant\'s key makes its data, backups included, unreadable',
      rationale: 'A key per tenant limits what one leak exposes and makes erasure provable by destroying the key (NIST SP 800-57 Part 1, key separation; AWS SaaS Lens, tenant-aware encryption).',
      scenario: { label: 'Key opens one tenant', given: 'data of two tenants encrypted with their own keys', when: 'the first tenant\'s key is used on the second\'s data, and then the first tenant\'s key is deleted', then: 'the second\'s data does not decrypt, and the first\'s data and backups no longer decrypt' },
    },
    {
      id: 'req-byok-revoke', label: 'Revoked customer key honoured', when: { ...TENANTS, KEYS: ['customer'] }, ears_type: 'event-driven',
      trigger: 'a customer disables or revokes its key in its own key management service',
      action: 'stop reading and writing that tenant\'s data within 5 minutes, drop its cached data keys, and tell the tenant\'s administrators',
      rationale: 'Customer-managed keys are only control if revoking them takes effect; cached data keys must not outlive the revocation (NIST SP 800-57 Part 1, key compromise and revocation).',
      scenario: { label: 'Key revoked', given: 'a tenant using its own key', when: 'it disables the key', then: 'within 5 minutes reads and writes of its data fail and its administrators are told' },
    },
    {
      id: 'req-platform-keys', label: 'Encrypted at rest', when: { ...TENANTS, KEYS: ['shared'] }, ears_type: 'ubiquitous',
      action: 'encrypt every data store and backup at rest with platform-managed AES-256 keys rotated at least every 12 months',
      rationale: 'With shared keys isolation rests on access control alone, but a lost disk or snapshot must still be unreadable (NIST SP 800-57 Part 1, cryptoperiods).',
      scenario: { label: 'Stores encrypted', given: 'the infrastructure as deployed', when: 'its data stores and backups are listed', then: 'each is encrypted at rest and its key was rotated within the last 12 months' },
    },
    {
      id: 'req-offboard', label: 'Leaving tenant erased', when: TENANTS, ears_type: 'event-driven',
      trigger: 'a tenant\'s contract ends',
      action: 'offer an export of its data for 30 days, then erase its data from every store, cache, search index and backup within {{OFFBOARD_DAYS}} days, and give it a deletion certificate',
      rationale: 'A tenant leaving must be able to take its data and prove it is gone; data in backups and indexes is the part usually forgotten (GDPR Art. 17 and 28(3)(g); AWS SaaS Lens, tenant offboarding).',
      scenario: { label: 'Tenant offboarded', given: 'a tenant whose contract has ended and whose export period has passed', when: '{{OFFBOARD_DAYS}} days have passed', then: 'no store, cache, index or backup returns any of its data, and the certificate is issued' },
    },
    {
      id: 'req-single', label: 'One organisation only', when: { ISOLATION: ['single'] }, ears_type: 'ubiquitous',
      action: 'hold the data of exactly one organisation per deployment, and refuse to create a second organisation or import records belonging to another one',
      rationale: 'Without a tenant boundary in the design, a second customer added on the quiet would share everything with the first; this makes the boundary a requirement.',
      scenario: { label: 'Second organisation refused', given: 'a deployment serving one organisation', when: 'an administrator tries to create a second organisation', then: 'it is refused and the attempt is recorded' },
    },
  ],
  adrs: [
    {
      id: 'adr-pool', label: 'Pooled tables with row-level security', when: { ISOLATION: ['pool'] },
      decision: 'All tenants share the same database and tables; every table with tenant data has a non-null tenant_id column, leading every index and key, and row-level security policies that compare it with the tenant set for the transaction (PostgreSQL RLS with FORCE ROW LEVEL SECURITY and SET LOCAL app.tenant_id; SQL Server security policies; on Aurora or Cloud SQL the same). The application connects as a role without BYPASSRLS; migrations run as another. The tenant comes from the token, is set by middleware, and is part of every cache key, object-store prefix and message. Encryption keys: {{KEYS}}. Noisy neighbours: {{NOISY}}.',
      consequences: '• The cheapest model per tenant: onboarding is a row, one migration covers everyone.\n• A query that forgets the tenant still returns only the tenant\'s rows; the database holds the boundary.\n• Per-tenant backup, restore and residency are hard: they mean filtered exports, not a file per tenant.\n• Noisy neighbours share everything, so quotas are a must.\n• Connection pooling must reset the tenant setting between transactions (SET LOCAL, not SET).',
      alternatives: '1. A tenant filter only in the application code (ORM global scope): no database feature needed, but one raw query crosses the boundary.\n2. A schema per tenant: cleaner per-tenant export, migrations multiply.\n3. A database per tenant: the strongest storage isolation, the highest cost per tenant.',
    },
    {
      id: 'adr-schema', label: 'A schema per tenant', when: { ISOLATION: ['schema'] },
      decision: 'Each tenant gets its own schema in a shared database, with a database role granted only on that schema; a request opens its connection with its tenant\'s role and search path. Migrations run per schema with Flyway or Liquibase (one target per schema), driven by the tenant catalogue, and the release waits until all schemas are migrated or reports the failures. Plan for at most a few hundred schemas per database (catalogue size and migration time grow with each); beyond that, add a database and shard tenants over them. Encryption keys: {{KEYS}}. Noisy neighbours: {{NOISY}}.',
      consequences: '• A forgotten filter cannot cross schemas: the role is refused by the database.\n• Per-tenant export and restore are a schema dump.\n• Every migration runs once per tenant: release time and failure handling grow with the number of tenants.\n• Connection pools per role or per schema multiply connections; a pooler (PgBouncer) is needed.',
      alternatives: '1. Pooled tables with row-level security: cheaper, scales to many more tenants.\n2. A database per tenant: isolates load and backups too, costs more.\n3. Schemas without a role per tenant: simpler, but a query naming another schema is not refused.',
    },
    {
      id: 'adr-database', label: 'A database per tenant', when: { ISOLATION: ['database'] },
      decision: 'Each tenant gets its own database (or managed instance), created by the onboarding pipeline with credentials valid for that database only and kept in the secret store under the tenant\'s id. A tenant catalogue maps tenant to connection; the application resolves it from the token\'s tenant on every request and never takes a connection string from the request. Small tenants can share an instance with a database each (Azure SQL elastic pools, Aurora with a database per tenant); large or regulated ones get an instance of their own, in the region they ask for. Migrations run per database from the catalogue. Encryption keys: {{KEYS}}. Noisy neighbours: {{NOISY}}.',
      consequences: '• Storage, backups, restores and residency are per tenant.\n• A tenant\'s heavy queries load its own database first; the shared application tier still needs quotas.\n• Cost and operations grow with the number of tenants: monitoring, patching and migrations per database.\n• The tenant catalogue is critical: a wrong entry routes one tenant to another\'s data.',
      alternatives: '1. A schema per tenant: cheaper, weaker isolation of load and backups.\n2. Pooled tables with row-level security: the cheapest, no per-tenant restore.\n3. A deployment per tenant: isolates the application too, the highest cost.',
    },
    {
      id: 'adr-silo', label: 'A deployment per tenant', when: { ISOLATION: ['silo'] },
      context: `${FORCES} Here each tenant is large or regulated enough to pay for, or require, a stack of its own.`,
      decision: 'Each tenant runs its own copy of the whole stack in its own cloud account or project (AWS account per tenant via Control Tower / Organizations, Azure subscription, Google Cloud project), created from the same infrastructure code (Terraform or Pulumi modules with the tenant as input) and deployed by one pipeline that rolls each release out to every stack within 7 days, in waves. Nothing is shared between stacks but the pipeline and the observability backend, which receives data tagged per tenant. Encryption keys: {{KEYS}}.',
      consequences: '• The strongest isolation: no shared data store, network or quota; no noisy neighbour.\n• Cost and operations per tenant are the highest: every stack is monitored, patched and upgraded.\n• Stacks drift apart unless the pipeline is the only way to change them.\n• Onboarding a tenant takes an account and a full deployment, not a row.',
      alternatives: '1. A database per tenant with a shared application: most of the data isolation at a fraction of the cost.\n2. Pooled tables with row-level security: cheapest, weakest.\n3. Tenants run it themselves (on-premises or in their cloud): full control for them, upgrades out of our hands.',
    },
    {
      id: 'adr-single', label: 'One organisation per deployment', when: { ISOLATION: ['single'] },
      context: `${FORCES} Here the system serves one organisation, and no customer data of another is expected.`,
      decision: 'The system serves exactly one organisation; its data model has no tenant and the deployment refuses to create a second organisation. Serving another organisation means another deployment, or superseding this decision with one of the multi-tenant models first. Encryption at rest uses the platform\'s keys.',
      consequences: '• No tenant filter, no tenant catalogue, no per-tenant quotas: the simplest data model.\n• A second customer cannot be added without a migration of the data model or a separate deployment.\n• The decision makes the boundary explicit, so it is not crossed by accident.',
      alternatives: '1. Pooled tables with a tenant id from the start: little cost now, and ready for a second customer, but a boundary nobody tests until then.\n2. A deployment per customer when a second one comes: no change to the data model.',
    },
    {
      id: 'adr-quotas', label: 'Per-tenant quotas', when: { ...SHARED, NOISY: ['quotas'] },
      decision: 'Every tenant has limits enforced where load enters: {{TENANT_RPS}} requests per second at the gateway (Envoy or Kong rate limiting keyed by the token\'s tenant, or AWS API Gateway usage plans), a cap on concurrent database queries per tenant in the connection pool, and a per-tenant concurrency limit in the job queue (BullMQ groups, Sidekiq limits). Statement timeouts bound one query. Load, latency and errors are measured per tenant, so the noisy one is visible.',
      consequences: '• One tenant\'s burst costs that tenant, not everyone.\n• Limits need tuning per plan and a way to raise them for a tenant.\n• Every metric gains a tenant label: watch its cardinality.',
      alternatives: '1. Quotas plus dedicated capacity for large tenants: needed once tenant sizes differ by orders of magnitude.\n2. Scaling the shared pool for the largest tenant: simple, expensive, and still one tenant\'s query can lock a table.',
    },
    {
      id: 'adr-tiered', label: 'Quotas and dedicated capacity', when: { ...SHARED, NOISY: ['tiered'] },
      decision: 'Every tenant has quotas as in the pool ({{TENANT_RPS}} requests per second at the gateway, query and job concurrency per tenant), and tenants are placed by tier: the standard tier in shared pools, the premium tier on dedicated capacity (its own database and worker nodes, the same code). A tenant using more than 20% of a shared pool for 7 days is proposed for the premium tier; the tenant catalogue routes each tenant, and moving one is a scripted copy with a short write freeze (pg_dump or logical replication, AWS DMS).',
      consequences: '• Large tenants get guaranteed capacity, small ones stay cheap.\n• Two placement models to run and test, and a move procedure to rehearse.\n• The tenant catalogue decides where data lives: it must be correct and audited.',
      alternatives: '1. Quotas only: simpler, but the largest tenants are throttled.\n2. Dedicated capacity for every tenant: no noisy neighbours, at the cost per tenant of a database each.',
    },
    {
      id: 'adr-tenant-keys', label: 'An encryption key per tenant', when: { ...TENANTS, KEYS: ['tenant'] },
      decision: 'Each tenant has its own key in the platform\'s key management service (AWS KMS, Azure Key Vault, Google Cloud KMS), and data is encrypted with data keys it wraps, the tenant id as encryption context (AWS Encryption SDK, Tink). Key policies let only the services act on it; keys rotate every 12 months. When a tenant leaves, its key is scheduled for deletion after the export period, which makes its data unreadable everywhere, backups included.',
      consequences: '• A missed filter or a leaked backup exposes ciphertext of other tenants, not data.\n• Erasure is provable: deleting the key is the deletion.\n• Key management cost and calls grow with tenants and requests; cache data keys for a few minutes.\n• Queries over encrypted fields are limited: encrypt fields, not whole tables, where search is needed.',
      alternatives: '1. Customer-managed keys: control for the customer, but a revoked key stops their service.\n2. Platform keys for all: simplest, no per-tenant erasure by key.',
    },
    {
      id: 'adr-customer-keys', label: 'Customer-managed keys', when: { ...TENANTS, KEYS: ['customer'] },
      decision: 'Tenants that ask for it keep their key in their own key management service (AWS KMS in their account with a key policy granting our role, Azure Key Vault with a managed identity, Google Cloud KMS with Cloud EKM, or an HSM through KMIP); the others get a key per tenant in ours. Data is encrypted with data keys wrapped by the tenant\'s key, the tenant id as encryption context; cached data keys live at most 5 minutes, so a revocation takes effect within that. A revoked key puts the tenant in a suspended state with a clear message, not a stream of errors.',
      consequences: '• Customers can cut our access to their data at any time, which regulated customers require.\n• A customer\'s key outage is our outage for that tenant: support needs to tell the two apart.\n• Onboarding needs the customer\'s key set up and tested before data arrives.',
      alternatives: '1. A key per tenant in our key management service: the same isolation, without the customer\'s control.\n2. Platform keys for all: simplest, refused by customers who require their own keys.',
    },
    {
      id: 'adr-platform-keys', label: 'Platform encryption keys', when: { ...TENANTS, KEYS: ['shared'] },
      decision: 'Data stores and backups are encrypted at rest with platform-managed keys (AWS KMS managed keys, Azure platform-managed keys, Google default encryption), AES-256, rotated at least every 12 months; the same keys serve every tenant. Tenant isolation rests on the access control of the isolation model; erasure of a leaving tenant is by deleting its data and letting backups expire. Revisit when a customer asks for its own key or must be able to prove erasure.',
      consequences: '• Nothing to manage per tenant; no extra calls or cost.\n• A missed filter or leaked backup exposes every tenant in it: access control carries the whole boundary.\n• Erasure in backups takes as long as backup retention.',
      alternatives: '1. A key per tenant: limits a leak and proves erasure, at some cost.\n2. Customer-managed keys: control for the customer.',
    },
  ],
  fitness: [
    {
      id: 'ff-cross-tenant', label: 'Cross-tenant calls return nothing', when: SHARED, category: 'structural', implements: ['adr-pool', 'adr-schema', 'adr-database'],
      threshold: '0 records of another tenant returned or changed, over every operation, with forged tenant headers included',
      description: 'An integration test sets up two tenants with data of every kind, then calls every operation as a user of the first with the second\'s ids, filters and a forged tenant header, expecting 404 or nothing of the second back. The operations come from the router, so a new one is tested without anyone adding it.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app, routes } from '../src/app'
import { seedTwoTenants } from './tenants'

const { a, b } = await seedTwoTenants() // users, tokens and record ids of each

describe.each(routes)('$method $path', (route) => {
  it('never shows or changes tenant B to tenant A', async () => {
    const res = await request(app)[route.method.toLowerCase()](route.withIds(b.ids))
      .set('Authorization', \`Bearer \${a.token}\`)
      .set('X-Tenant-Id', b.tenantId) // forged: must be ignored
    expect(JSON.stringify(res.body)).not.toContain(b.tenantId)
    for (const id of Object.values(b.ids)) expect(JSON.stringify(res.body)).not.toContain(id)
    expect(await b.snapshot()).toEqual(b.before)
  })
})`,
    },
    {
      id: 'ff-rls', label: 'Row-level security on every table', when: { ISOLATION: ['pool'] }, category: 'structural', implements: ['adr-pool'],
      threshold: '0 tables with a tenant_id column without row-level security enabled and forced; the application role has no BYPASSRLS',
      description: 'A database test runs after the migrations in CI and fails on any table holding tenant data without forced row-level security, or when the application role can bypass it.',
      tool: 'pgTAP',
      language: 'sql',
      snippet: `BEGIN;
SELECT plan(2);

SELECT is_empty($$
  SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r' AND n.nspname = 'public'
    AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'tenant_id')
    AND NOT (c.relrowsecurity AND c.relforcerowsecurity)
$$, 'every table with tenant_id has forced row-level security');

SELECT ok(NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'app'), 'the app role cannot bypass RLS');

SELECT * FROM finish();
ROLLBACK;`,
    },
    {
      id: 'ff-tenant-migrations', label: 'No tenant left behind', when: { ISOLATION: ['schema', 'database'] }, category: 'operational', implements: ['adr-schema', 'adr-database'],
      threshold: '0 tenants on an older schema version 24 hours after a release',
      description: 'A scheduled job reads the schema version of every tenant from the tenant catalogue and fails, naming them, when any tenant is behind the latest migration 24 hours after a release.',
      tool: 'Flyway (flyway info per tenant schema or database)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
latest=$(ls db/migration | sed -E 's/^V([0-9]+)__.*/\\1/' | sort -n | tail -1)
behind=0
for tenant in $(psql "$CATALOGUE_URL" -Atc "select id from tenants where active"); do
  v=$(flyway -configFiles="tenants/$tenant.conf" info -outputType=json | jq -r '.schemaVersion')
  if [ "$v" != "$latest" ]; then echo "tenant $tenant on $v, latest $latest"; behind=$((behind+1)); fi
done
exit $behind`,
    },
    {
      id: 'ff-silo', label: 'Stacks share nothing', when: { ISOLATION: ['silo'] }, category: 'structural', implements: ['adr-silo'],
      threshold: '0 resources or access policies in a tenant stack that reference another tenant\'s account or resources',
      description: 'A policy runs over every tenant stack\'s Terraform plan in CI and refuses any resource or policy that names an account other than the tenant\'s own or the shared tooling account.',
      tool: 'Conftest',
      language: 'rego',
      snippet: `package main

import rego.v1

allowed_accounts := {input.variables.tenant_account_id.value, input.variables.tooling_account_id.value}

deny contains msg if {
	some r in input.resource_changes
	some account in regex.find_n("arn:aws:[a-z0-9-]+:[a-z0-9-]*:([0-9]{12})", json.marshal(r.change.after), -1)
	id := substring(account, count(account) - 12, 12)
	not allowed_accounts[id]
	msg := sprintf("%s references account %s outside this tenant's stack", [r.address, id])
}`,
    },
    {
      id: 'ff-noisy-neighbour', label: 'Bursts stay contained', when: SHARED, category: 'operational', implements: ['adr-quotas', 'adr-tiered'],
      threshold: 'With one tenant at 10 × {{TENANT_RPS}} requests per second, the other tenants\' p95 latency rises by less than 10% and the noisy tenant gets 429',
      description: 'A load test in a staging environment runs a steady load for a quiet tenant and a burst far above quota for a noisy one, and checks the quiet tenant\'s latency against its baseline and the noisy tenant\'s 429s.',
      tool: 'k6',
      language: 'js',
      snippet: `import http from 'k6/http'
import { check } from 'k6'

export const options = {
  scenarios: {
    quiet: { executor: 'constant-arrival-rate', rate: 20, timeUnit: '1s', duration: '5m', preAllocatedVUs: 20, exec: 'quiet' },
    noisy: { executor: 'constant-arrival-rate', rate: 10 * __ENV.TENANT_RPS, timeUnit: '1s', duration: '5m', preAllocatedVUs: 200, exec: 'noisy' },
  },
  thresholds: {
    'http_req_duration{scenario:quiet}': [\`p(95)<\${1.1 * __ENV.BASELINE_P95_MS}\`],
    'checks{scenario:noisy}': ['rate>0.8'],
  },
}

export function quiet() { http.get(\`\${__ENV.BASE}/orders\`, { headers: { Authorization: \`Bearer \${__ENV.QUIET_TOKEN}\` } }) }
export function noisy() {
  const res = http.get(\`\${__ENV.BASE}/orders\`, { headers: { Authorization: \`Bearer \${__ENV.NOISY_TOKEN}\` } })
  check(res, { 'throttled or served': (r) => r.status === 429 || r.status === 200 })
}`,
    },
    {
      id: 'ff-tenant-share', label: 'Tenant share watched', when: { ...SHARED, NOISY: ['tiered'] }, category: 'operational', implements: ['adr-tiered'],
      threshold: 'An alert within 1 hour of any tenant using more than 20% of a shared pool\'s capacity for 7 days',
      description: 'An alerting rule over the per-tenant database time metric raises a ticket for the tenant to be moved to dedicated capacity.',
      tool: 'Prometheus alerting rules',
      language: 'yaml',
      snippet: `groups:
  - name: tenant-capacity
    rules:
      - alert: TenantOutgrowsSharedPool
        expr: |
          sum by (tenant, pool) (rate(db_query_seconds_total{pool=~"shared-.*"}[7d]))
            / ignoring(tenant) group_left sum by (pool) (rate(db_query_seconds_total{pool=~"shared-.*"}[7d]))
            > 0.20
        for: 1h
        labels: { severity: ticket }
        annotations:
          summary: "Tenant {{ $labels.tenant }} uses over 20% of {{ $labels.pool }}: propose dedicated capacity"`,
    },
    {
      id: 'ff-key-separation', label: 'Keys open one tenant', when: { ...TENANTS, KEYS: ['tenant', 'customer'] }, category: 'structural', implements: ['adr-tenant-keys', 'adr-customer-keys'],
      threshold: '0 successful decryptions of a tenant\'s data with another tenant\'s key or encryption context',
      description: 'An integration test against a local key management service encrypts data for two tenants and tries every cross-combination of key and encryption context, expecting each to fail.',
      tool: 'Vitest with LocalStack (KMS) and the AWS SDK',
      language: 'ts',
      snippet: `import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms'

const kms = new KMSClient({ endpoint: 'http://localhost:4566', region: 'eu-central-1' })

it('a tenant key decrypts nothing of another tenant', async () => {
  const { CiphertextBlob } = await kms.send(new EncryptCommand({
    KeyId: keys.a, Plaintext: Buffer.from('order of A'), EncryptionContext: { tenant: 'a' },
  }))
  await expect(kms.send(new DecryptCommand({ CiphertextBlob, KeyId: keys.b, EncryptionContext: { tenant: 'a' } }))).rejects.toThrow()
  await expect(kms.send(new DecryptCommand({ CiphertextBlob, KeyId: keys.a, EncryptionContext: { tenant: 'b' } }))).rejects.toThrow()
})`,
    },
    {
      id: 'ff-byok-revoke', label: 'Revoked key stops access', when: { ...TENANTS, KEYS: ['customer'] }, category: 'operational', implements: ['adr-customer-keys'],
      threshold: 'Reads and writes of a tenant\'s data fail within 5 minutes of its key being disabled',
      description: 'An integration test disables a tenant\'s key in a local key management service and polls a read of its data until it fails, failing itself past 5 minutes.',
      tool: 'Vitest with LocalStack (KMS)',
      language: 'ts',
      snippet: `import { DisableKeyCommand } from '@aws-sdk/client-kms'

it('stops serving a tenant within 5 minutes of its key being disabled', async () => {
  await kms.send(new DisableKeyCommand({ KeyId: keys.customer }))
  const started = Date.now()
  while ((await api.readOrder('customer', orderId)).ok) {
    expect(Date.now() - started).toBeLessThan(5 * 60_000)
    await new Promise((r) => setTimeout(r, 10_000))
  }
}, 6 * 60_000)`,
    },
    {
      id: 'ff-encrypted-at-rest', label: 'Stores encrypted at rest', when: { ...TENANTS, KEYS: ['shared'] }, category: 'structural', implements: ['adr-platform-keys'],
      threshold: '0 failed encryption-at-rest checks on the infrastructure code',
      description: 'The infrastructure code is scanned in CI, and the encryption-at-rest checks for databases, buckets and volumes must pass.',
      tool: 'Checkov',
      language: 'yaml',
      snippet: `# .checkov.yaml
framework: [terraform]
check:
  - CKV_AWS_16   # RDS encrypted at rest
  - CKV_AWS_19   # S3 bucket encrypted at rest
  - CKV_AWS_3    # EBS volumes encrypted
  - CKV_AWS_7    # KMS key rotation enabled
hard-fail-on: [CKV_AWS_16, CKV_AWS_19, CKV_AWS_3, CKV_AWS_7]`,
    },
    {
      id: 'ff-single-org', label: 'Exactly one organisation', when: { ISOLATION: ['single'] }, category: 'structural', implements: ['adr-single'],
      threshold: 'Exactly 1 organisation in the database, and creating a second is refused',
      description: 'A database test runs after the migrations in CI: it counts the organisations and tries to insert a second one, which a constraint must refuse.',
      tool: 'pgTAP',
      language: 'sql',
      snippet: `BEGIN;
SELECT plan(2);

SELECT is((SELECT count(*) FROM organisation), 1::bigint, 'exactly one organisation');

SELECT throws_ok(
  $$ INSERT INTO organisation (id, name) VALUES (gen_random_uuid(), 'Second') $$,
  NULL, 'a second organisation is refused'
);

SELECT * FROM finish();
ROLLBACK;`,
    },
  ],
}

export default pack
