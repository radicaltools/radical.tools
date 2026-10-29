import type { PackSpec, When } from '../../src/packSpec'

const KEY: When = { IDEMPOTENCY: ['key'] }
const KEY_DB: When = { IDEMPOTENCY: ['key'], STORE: ['database'] }
const KEY_REDIS: When = { IDEMPOTENCY: ['key'], STORE: ['redis'] }
const FORCES = 'Other elements, partners and browsers call this element\'s HTTP API to change things, over networks that drop connections. The forces: a timeout does not tell the caller whether the change happened, and gateways, SDKs, mobile apps and impatient users try again, so an order, a payment or a message is made twice; POST and PATCH are not idempotent in HTTP, while PUT and DELETE are; remembering requests costs a store, an expiry and a write on every call; two clients that read the same resource and write it back overwrite each other without either knowing (the lost update); and preventing that asks every client to keep and send a version. Retries of the calls this element makes to others are decided in the Integration resilience pack, duplicate messages in the Messaging pack, transactions and isolation in the Data consistency pack, and the body of every error answer in the Errors pack of the API Guidelines.'

const pack: PackSpec = {
  id: 'concern-api-idempotency',
  name: 'Idempotency and concurrency',
  group: 'api',
  description: 'The operations an HTTP API offers: how a client retries a request that changes something without doing it twice, and how two clients are kept from silently overwriting each other\'s changes. The snippets are for a Node service with Vitest, supertest and Spectral; each tool line names the JVM equivalent. Retries of the calls this element makes to others are decided in the Integration resilience pack.',
  tags: ['api', 'idempotency', 'retries', 'concurrency', 'etag', 'optimistic-locking'],
  concern: {
    id: 'api-idempotency',
    trigger: 'LIST RELATIONS WHERE source.type != "person" AND target.external != true AND (target.type = "container" OR target.type = "component")',
    applyTo: 'target',
    why: 'other elements and systems call these elements\' APIs to change things, so how a retried request is kept from acting twice, and how concurrent changes are kept from overwriting each other, has to be decided.',
  },
  sources: [
    { title: 'IETF httpapi Internet-Draft, The Idempotency-Key HTTP Header Field (draft-ietf-httpapi-idempotency-key-header, not an RFC)', url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/' },
    { title: 'RFC 9110, HTTP Semantics (9.2.2 idempotent methods, 8.8.3 ETag, 13.1.1 If-Match, 15.5 client error status codes)', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
    { title: 'RFC 6585, Additional HTTP Status Codes (3. 428 Precondition Required)', url: 'https://www.rfc-editor.org/rfc/rfc6585' },
    { title: 'RFC 7396, JSON Merge Patch', url: 'https://www.rfc-editor.org/rfc/rfc7396' },
    { title: 'Stripe API reference: Idempotent requests', url: 'https://docs.stripe.com/api/idempotent_requests' },
    { title: 'Microsoft REST API Guidelines, Azure (exactly-once behaviour, conditional requests)', url: 'https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md' },
    { title: 'Zalando RESTful API Guidelines (rules 182, 229, 230 and 231)', url: 'https://opensource.zalando.com/restful-api-guidelines/' },
    { title: 'Google AIP-154, Resource freshness validation', url: 'https://google.aip.dev/154' },
    { title: 'Redis documentation: Key eviction (maxmemory-policy)', url: 'https://redis.io/docs/latest/develop/reference/eviction/' },
  ],
  questions: [
    {
      key: 'IDEMPOTENCY', title: 'Retries', label: 'How is a retried request that changes something kept from acting twice?',
      hint: 'POST and PATCH are not idempotent in HTTP: a client that retries one after a timeout may create or change something twice. PUT and DELETE are idempotent by definition (RFC 9110). This decides what the API offers its callers; retries of the calls this element makes to others are decided in the Integration resilience pack.',
      default: 'key',
      options: [
        { value: 'key', label: 'an Idempotency-Key header on POST and PATCH', description: 'The client sends a unique key with each POST and PATCH and the same key on every retry; the API keeps the first response and replays it for a repeat. The IETF httpapi working group\'s draft defines the header; Stripe works this way. Pick it when the API has commands and creations that do not map to a PUT (payments, orders, sending a message) and its callers retry automatically.' },
        { value: 'put', label: 'client-chosen ids with PUT create-or-replace', description: 'Clients create a resource with a PUT to a URI whose id they chose, and change it with PUT or JSON Merge Patch, so every change can be repeated with the same result and nothing extra is stored. Pick it for resource-shaped APIs where every operation can be expressed as a state to reach, and the callers can generate ids (UUIDs).' },
        { value: 'none', label: 'no protection, unsafe requests not retried', description: 'Nothing is stored and nothing is added to the API; the contract tells callers that POST and PATCH are not safe to retry and how to look up whether a request that timed out took effect. Pick it only while a duplicate is cheap and visible (a draft, a note) and no caller retries automatically; the decision records the risk.' },
      ],
    },
    {
      key: 'STORE', title: 'Key store', label: 'Where are the idempotency keys and their responses kept?',
      hint: 'Only when idempotency keys are used (an Idempotency-Key header on POST and PATCH); with the other answers nothing is stored. Kept in the change\'s own transaction, a key cannot be lost while the change is kept; kept apart, a crash between the two leaves a gap.',
      default: 'database',
      options: [
        { value: 'database', label: 'a table in the element\'s own database, in the change\'s transaction', description: 'The key, a fingerprint of the request and the response are written in the same transaction as the change, so both commit or neither does; a scheduled job deletes old rows. Pick it when the element writes its changes to one relational database it owns (PostgreSQL, MySQL, SQL Server).' },
        { value: 'redis', label: 'a shared Redis with an expiry on every key', description: 'The key is claimed in Redis before the change runs and replaced by the response after it, each with an expiry, so Redis removes old keys itself. Pick it when the changes do not land in one relational database (a document store, several stores) or several services share one key store.' },
      ],
    },
    {
      key: 'CONCURRENCY', title: 'Concurrent edits', label: 'How are two clients kept from silently overwriting each other\'s changes?',
      hint: 'A client that reads a resource, changes it and writes it back overwrites whatever another client wrote in between (the lost update). This decides how a client tells the API which version it changed; how the database checks it in one atomic step is decided in the Data consistency pack.',
      default: 'etag',
      options: [
        { value: 'etag', label: 'ETag and If-Match, 412 on a stale version', description: 'Every response that carries a resource carries an ETag; a change must send it back in If-Match, a stale one is refused with 412 Precondition Failed and a missing one with 428 Precondition Required. HTTP\'s own mechanism (RFC 9110, RFC 6585). Pick it for HTTP APIs whose callers can read and send headers, which is nearly all of them.' },
        { value: 'version', label: 'a version field in the body, 409 on a stale version', description: 'Each representation carries a version field that a change must send back; a stale one is refused with 409 Conflict. Google AIP-154 keeps its etag in the body this way. Pick it when callers or tools in between cannot set headers (low-code platforms, some form builders), or the same API is also served over gRPC.' },
        { value: 'lww', label: 'last write wins', description: 'Changes carry no version; the write that commits last is kept, and the representation shows who wrote it and when. Pick it only for resources that one person or system edits at a time (a user\'s own settings); the decision records that concurrent edits are lost.' },
      ],
    },
  ],
  details: [
    { key: 'KEY_HOURS', label: 'How long are idempotency keys and their responses kept (hours)? (idempotency keys only)', default: '24', number: true },
    { key: 'LOCK_SECONDS', label: 'How long may a request with an idempotency key take at most (seconds)? A repeat waits this long for it, and a claim on a key lasts this long. (idempotency keys only)', default: '30', number: true },
  ],
  need: {
    label: 'A retried request does not act twice',
    text: 'Callers of this element\'s API retry when a connection drops or an answer is late, and several callers change the same resources. A retry must not create a second order or charge a second time, and a change made from a stale copy must not silently overwrite someone else\'s. The snippets assume a Node service: the HTTP app exported from src/app, the OpenAPI document at openapi.yaml, HTTP tests with Vitest and supertest under tests/api, a database client in tests/db, a fixture createOrder() in tests/api/fixtures that creates an order the way the API does, and an orders resource at /orders/{id} that answers GET and PUT.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-key-replay', label: 'A repeat gets the first answer', when: KEY, ears_type: 'event-driven',
      trigger: 'a POST or PATCH arrives with an Idempotency-Key and the same request fingerprint as a request of the same client that completed within the last {{KEY_HOURS}} hours',
      action: 'return the stored status code and body of that first request, before evaluating any precondition, without performing the operation again',
      rationale: 'A timeout does not tell the client whether the change happened; replaying the first response makes the retry safe (IETF Idempotency-Key draft, 2.6; Stripe, Idempotent requests).',
      scenario: { label: 'Repeated order', given: 'an order created with POST /orders and Idempotency-Key K', when: 'the same request with K is sent again', then: 'the second answer has the first one\'s status and body, and one order exists' },
    },
    {
      id: 'req-key-required', label: 'Unsafe requests carry a key', when: KEY, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a POST or PATCH arrives without an Idempotency-Key',
      action: 'refuse it with 400 Bad Request before any part of it runs, and declare the header as required, with the 400 and 422 answers, on every POST and PATCH in the OpenAPI document',
      rationale: 'An optional key protects only the careful callers; the draft asks a resource that requires the header to answer its absence with 400 and to publish its idempotency rules (IETF Idempotency-Key draft, 2.5.2 and 2.7).',
      scenario: { label: 'Order without a key', given: 'the orders API', when: 'POST /orders is sent without an Idempotency-Key', then: 'it is refused with 400, no order is created, and the OpenAPI document lists the header as required' },
    },
    {
      id: 'req-key-mismatch', label: 'A key is not reused for another request', when: KEY, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request reuses an Idempotency-Key of the same client with a different method, path or body',
      action: 'refuse it with 422 Unprocessable Content and perform nothing',
      rationale: 'A key reused for another request is a client bug; replaying the first answer would hide it and running the request would break the key\'s promise (IETF Idempotency-Key draft, 2.2 and 2.7; Zalando rule 230 answers 400 instead, the draft\'s 422 is used here).',
      scenario: { label: 'Key reused with another body', given: 'an order created with Idempotency-Key K and quantity 2', when: 'POST /orders is sent with K and quantity 3', then: 'it is refused with 422 and the first order is unchanged' },
    },
    {
      id: 'req-key-concurrent', label: 'Overlapping repeats run once', when: KEY, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request arrives with an Idempotency-Key whose first request is still running',
      action: 'never run it a second time: wait at most {{LOCK_SECONDS}} seconds for the first and return its response, or refuse it with 409 Conflict',
      rationale: 'A client that times out quickly retries while the first attempt is still running; without a claim on the key both run (IETF Idempotency-Key draft, 2.6 and 2.7: a concurrent request gets a conflict).',
      scenario: { label: 'Two overlapping attempts', given: 'an order request that takes 500 ms', when: 'the same request with the same key is sent twice at once', then: 'one order exists, and the second answer is either the first one\'s or 409' },
    },
    {
      id: 'req-key-expiry', label: 'Keys are kept, then removed', when: KEY, ears_type: 'ubiquitous',
      action: 'keep each Idempotency-Key with its response for at least {{KEY_HOURS}} hours and remove it within one hour after that',
      rationale: 'Clients retry for minutes or hours, not forever; a bounded retention keeps the store small and must be published (IETF Idempotency-Key draft, 2.3; Stripe and Zalando rule 230 keep keys for 24 hours).',
      scenario: { label: 'Old keys removed', given: 'keys stored over the last two days', when: 'the clean-up has run', then: 'no key older than {{KEY_HOURS}} hours plus one is left, and every younger key is still there' },
    },
    {
      id: 'req-key-atomic', label: 'Key and change commit together', when: KEY_DB, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the change of a request with an Idempotency-Key fails or is rolled back',
      action: 'leave no record of the key, so that a retry with the same key performs the operation anew; the key, its response and the change commit in one database transaction',
      rationale: 'A key stored without its change makes every retry replay a change that never happened; a change stored without its key lets a retry do it twice. One transaction rules out both.',
      scenario: { label: 'Failed order leaves no key', given: 'an order request whose second write fails', when: 'it is sent with key K and then retried with K', then: 'the first leaves neither an order nor K behind, and the retry creates the order' },
    },
    {
      id: 'req-key-redis', label: 'Redis keeps every key for its time', when: KEY_REDIS, ears_type: 'ubiquitous',
      action: 'claim each Idempotency-Key in Redis with an atomic set-if-absent and an expiry of {{LOCK_SECONDS}} seconds before the operation runs, keep the response with an expiry of {{KEY_HOURS}} hours, and run that Redis with maxmemory-policy noeviction, so that no key lives without an expiry or is evicted before it',
      rationale: 'A key Redis evicts under memory pressure turns the next retry into a duplicate; noeviction makes Redis refuse writes instead of dropping keys (Redis documentation, Key eviction).',
      scenario: { label: 'Keys expire, never evicted', given: 'the Redis that holds the keys', when: 'its configuration and keys are read', then: 'maxmemory-policy is noeviction and every key has an expiry of at most {{KEY_HOURS}} hours' },
    },
    {
      id: 'req-put-create', label: 'A repeated PUT changes nothing', when: { IDEMPOTENCY: ['put'] }, ears_type: 'event-driven',
      trigger: 'a client sends the same PUT to a URI whose id it chose more than once',
      action: 'keep exactly one resource with that representation: answer the first with 201 Created and every repeat with 200 OK, changing nothing',
      rationale: 'PUT is idempotent by definition, so a client that chooses the id can retry a creation like any other PUT; a repeat whose change is already reflected may be answered with success (RFC 9110, 9.2.2, 9.3.4 and 13.1.1; Microsoft REST API Guidelines: PUT to create or replace).',
      scenario: { label: 'Order PUT twice', given: 'a new UUID chosen by the client', when: 'PUT /orders/{that id} is sent twice with the same body', then: 'the first answer is 201, the second 200 with the same body, and one order exists' },
    },
    {
      id: 'req-put-no-post', label: 'No POST changes state', when: { IDEMPOTENCY: ['put'] }, ears_type: 'ubiquitous',
      action: 'offer no POST operation, and accept partial changes only as JSON Merge Patch (application/merge-patch+json), so that every request that changes state can be repeated with the same result',
      rationale: 'One POST left in the API is one operation a retry can do twice; a merge patch sets values instead of adding to them, so applying it again gives the same document (RFC 7396).',
      scenario: { label: 'Contract without POST', given: 'the OpenAPI document', when: 'it is linted', then: 'it has no POST operation and every PATCH accepts only application/merge-patch+json' },
    },
    {
      id: 'req-none-retry', label: 'Callers are told not to retry', when: { IDEMPOTENCY: ['none'] }, ears_type: 'ubiquitous',
      action: 'mark every POST and PATCH operation in the OpenAPI document as not safe to retry (x-retry-safe: false) and say in its description how a caller finds out whether a request that timed out took effect',
      rationale: 'A client should not retry a non-idempotent request automatically unless it knows it is safe (RFC 9110, 9.2.2); with no protection in the API, the contract is the only place that tells callers so.',
      scenario: { label: 'Unsafe operations marked', given: 'the OpenAPI document', when: 'it is linted', then: 'every POST and PATCH has x-retry-safe: false and a description of how to look the result up' },
    },
    {
      id: 'req-etag', label: 'Changes only from the current version', when: { CONCURRENCY: ['etag'] }, ears_type: 'ubiquitous',
      action: 'send a strong ETag with every response that carries a resource, and apply a PUT, PATCH or DELETE that would change an existing resource only when its If-Match matches the current ETag, refusing any other with 412 Precondition Failed and changing nothing',
      rationale: 'If-Match makes a change conditional on the version the client saw, which prevents the lost update; the comparison is strong (RFC 9110, 8.8.3 and 13.1.1; Microsoft REST API Guidelines, Conditional requests; Zalando rule 182).',
      scenario: { label: 'Stale If-Match refused', given: 'an order read with ETag E and changed since by another client', when: 'a PUT with If-Match E is sent', then: 'it is refused with 412 and the order keeps the other client\'s change' },
    },
    {
      id: 'req-etag-required', label: 'Changes must be conditional', when: { CONCURRENCY: ['etag'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a PUT, PATCH or DELETE that would change an existing resource carries no If-Match',
      action: 'refuse it with 428 Precondition Required and change nothing',
      rationale: 'An optional If-Match protects only the clients that send it; 428 tells the others to read first (RFC 6585, 3).',
      scenario: { label: 'Unconditional change refused', given: 'an existing order', when: 'a PUT that changes it is sent without If-Match', then: 'it is refused with 428 and the order is unchanged' },
    },
    {
      id: 'req-version', label: 'Stale versions refused', when: { CONCURRENCY: ['version'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a PUT or PATCH that would change an existing resource carries a version other than the resource\'s current version',
      action: 'refuse it with 409 Conflict and change nothing; every representation carries the current version, which changes with every change',
      rationale: 'The version the client read, sent back with the change, is what tells a stale write from a current one; AIP-154 answers a mismatch with ABORTED, which is HTTP 409 (Google AIP-154).',
      scenario: { label: 'Stale version refused', given: 'an order read at version 7 and saved since at version 8', when: 'a PUT carrying version 7 is sent', then: 'it is refused with 409 and the order stays at version 8' },
    },
    {
      id: 'req-lww', label: 'The last write is kept and traceable', when: { CONCURRENCY: ['lww'] }, ears_type: 'ubiquitous',
      action: 'apply a PUT or PATCH without any precondition, keep the write that commits last, and show in every representation when and by whom the resource was last changed (updatedAt, updatedBy)',
      rationale: 'With no version check an overwrite cannot be prevented, only traced; the record of the last writer is what a person needs to find a lost change.',
      scenario: { label: 'Second write kept', given: 'an order read by Alice and by Bob', when: 'Alice saves quantity 3 and then Bob saves quantity 5 from his copy', then: 'the order has quantity 5 and shows Bob as its last writer' },
    },
  ],
  adrs: [
    {
      id: 'adr-key', label: 'Idempotency keys on unsafe requests', when: KEY,
      decision: 'Every POST and PATCH the API offers takes an Idempotency-Key request header as the IETF httpapi working group\'s Internet-Draft "The Idempotency-Key HTTP Header Field" defines it (a draft, not an RFC: pin the draft version the API follows in its documentation). The value is a Structured Field String, a UUID v4 the client generates once per intended change and sends again on every retry of it. The header is required: a request without it is refused with 400. One middleware in front of every POST and PATCH handler, not code in each handler, keeps per calling client (its authenticated identity or API key) the key, a fingerprint of the request (method, path and the SHA-256 of the body) and the response of every request that completed, for {{KEY_HOURS}} hours. A repeat with the same key and fingerprint gets the stored response before any precondition is evaluated; the same key with another fingerprint gets 422; a repeat while the first is still running never runs: it waits at most {{LOCK_SECONDS}} seconds for the first, or gets 409. Keys and responses are kept in {{STORE}}. The OpenAPI document declares the header on every POST and PATCH and states the retention. GET, HEAD, OPTIONS, PUT and DELETE take no key: they are idempotent by definition (RFC 9110, 9.2.2). The bodies of the 400, 409 and 422 answers follow the Errors pack.',
      consequences: '• A client may retry any request after a timeout or a dropped connection without doing it twice; SDKs and gateways can retry POST safely.\n• Every POST and PATCH costs a write and a read of the key store, and the stored responses take space.\n• After {{KEY_HOURS}} hours a key is gone and a retry runs again: clients must stop retrying before then.\n• The client must keep the key across its own restarts; a client that makes a new key per attempt gets no protection.\n• The draft may still change (status codes, syntax); following a pinned version keeps callers\' expectations stable.',
      alternatives: '1. Client-chosen ids with PUT: nothing to store, but every operation must be expressed as a PUT to a known URI.\n2. A secondary key in the body with a unique constraint (Zalando rule 231): a duplicate creation fails with 409 instead of replaying the first answer, and it covers creations only.\n3. The Repeatability-Request-ID and Repeatability-First-Sent headers of the Microsoft REST API Guidelines: the same idea, rarely seen outside Azure.\n4. No protection: simpler, and every timeout becomes a question for a person.',
    },
    {
      id: 'adr-put', label: 'Client-chosen ids with PUT', when: { IDEMPOTENCY: ['put'] },
      decision: 'Every resource is created with a PUT to a URI whose id the client chose (a UUID v4, or a key from the client\'s own system such as its order number): the first PUT creates it with 201, a repeat with the same representation changes nothing and gets 200 (RFC 9110, 9.3.4; Microsoft REST API Guidelines: PUT to create or replace). Changes are a PUT of the whole representation or a JSON Merge Patch (RFC 7396, application/merge-patch+json), both of which leave the same state when repeated; an action such as cancelling or shipping is a PUT or merge patch of a state field, or a PUT of a resource of its own (PUT /payments/{id}), never a POST. The API offers no POST. A repeat whose change is already reflected in the current state is answered with success even when its precondition no longer holds, as RFC 9110 13.1.1 allows. Ids from clients are validated like any input (a UUID, or the pattern the contract states), and authorisation decides whether a client may create under that URI. Nothing extra is stored: the resource itself records the change.',
      consequences: '• No key store and no expiry: a retry a week later is as harmless as one a second later.\n• Every operation must be shaped as a state to reach; commands (a payment, an e-mail, an increment) need a resource of their own.\n• A client that reuses an id by mistake replaces another resource; the concurrent-edits decision decides whether that is refused.\n• Side effects of a change (an event, an e-mail) must be emitted only when the state actually changed, or a repeat emits them again.',
      alternatives: '1. An Idempotency-Key header: keeps POST and commands, at the cost of a key store and an expiry.\n2. POST with a client id in the body and a unique constraint (Zalando rule 231): a repeat gets 409 and the client must read the resource to learn it was its own.\n3. No protection: nothing to build, and every timeout risks a duplicate.',
    },
    {
      id: 'adr-none', label: 'No idempotency for unsafe requests', when: { IDEMPOTENCY: ['none'] },
      context: `${FORCES} Here a duplicate is cheap and a person sees it: nothing the API creates moves money or reaches a customer.`,
      decision: 'POST and PATCH are not made idempotent: the API stores no keys and takes no client-chosen ids. The OpenAPI document marks every POST and PATCH with x-retry-safe: false, an extension of our own, and its description tells the caller how to find out after a timeout whether the request took effect (a GET filtered by a reference the caller sent) before trying again. Clients the team builds do not retry POST or PATCH automatically, and the proxies in front keep their defaults that do not pass a POST or PATCH to another upstream (in NGINX, no non_idempotent in proxy_next_upstream). This holds while a duplicate is cheap and visible; the first operation whose duplicate costs money or trust (a payment, an order, a message to a customer) supersedes this decision.',
      consequences: '• Nothing to build, store or expire.\n• A timeout leaves the caller not knowing whether the change happened; users pressing the button again and third-party clients that retry create duplicates.\n• Duplicates are found and removed by people.\n• The first operation that cannot afford a duplicate needs this decision superseded, not an exception.',
      alternatives: '1. An Idempotency-Key header on POST and PATCH.\n2. Client-chosen ids with PUT.\n3. A unique constraint on a natural key per resource (Zalando rule 231): duplicates refused with 409, creations only.',
    },
    {
      id: 'adr-store-db', label: 'Idempotency keys in the change\'s transaction', when: KEY_DB,
      decision: 'Idempotency keys and responses are kept in a table idempotency_keys in the element\'s own database (client, key, fingerprint, response status, response body, created_at; primary key client and key), written in the same transaction as the change: the middleware opens the transaction, sets lock_timeout to {{LOCK_SECONDS}} seconds, inserts the key row with INSERT ... ON CONFLICT DO NOTHING, runs the handler inside the transaction, writes the response into the row and commits. A second request with the same key waits on the first one\'s uncommitted row; once the first commits it reads and returns the stored response, if the first rolls back it runs itself, and past the lock timeout it gets 409. A request whose transaction rolls back leaves no key, so its retry runs anew. Every hour a pg_cron job (a scheduled job outside PostgreSQL) deletes the rows older than {{KEY_HOURS}} hours.',
      consequences: '• The key and the change commit or roll back together: no window where one exists without the other.\n• No new infrastructure, and the keys are backed up with the data.\n• One more insert and update per unsafe request on the hot path, and a table that holds every response body for {{KEY_HOURS}} hours.\n• Only a change inside this database is protected; a call to another system inside the request needs its own idempotency (the Integration resilience pack).\n• A waiting repeat holds a database connection for up to {{LOCK_SECONDS}} seconds; the draft asks for an immediate 409, waiting briefly gives the caller the answer instead.',
      alternatives: '1. Redis with an expiry: shared across services and fast, but outside the change\'s transaction.\n2. A unique column on the resource itself: protects creations only and replays nothing.',
    },
    {
      id: 'adr-store-redis', label: 'Idempotency keys in Redis', when: KEY_REDIS,
      decision: 'Idempotency keys and responses are kept in one Redis shared by every instance (managed: Amazon ElastiCache, Azure Cache for Redis or Google Memorystore; Valkey works the same). Before the handler runs, the middleware claims the key with SET idem:<client>:<key> <in-progress marker with the fingerprint> NX EX {{LOCK_SECONDS}}; a request that finds a claim gets 409, or the stored response once there is one. When the handler completes, the response replaces the marker with an expiry of {{KEY_HOURS}} hours; when it fails before changing anything, the claim is deleted so the retry runs. Redis runs with maxmemory-policy noeviction and AOF persistence (appendonly yes), with an alert on memory use, so a key is never evicted early.',
      consequences: '• Fast, and one store for every element that offers keys; Redis expires old keys itself.\n• Not in the change\'s transaction: if the process dies after the change commits and before the response is stored, the claim expires after {{LOCK_SECONDS}} seconds and the next retry runs the change again; where such a duplicate costs money, add a unique constraint on a natural key as well.\n• noeviction makes Redis refuse writes when full, so unsafe requests fail instead of losing keys: size it and alert on memory.\n• Replication is asynchronous: a failover can lose the last keys written.\n• One more stateful service to run and secure; managed Redis may block CONFIG, so the check reads the setting from the provider instead.',
      alternatives: '1. A table in the element\'s own database, in the change\'s transaction: no gap between key and change.\n2. Redis with an eviction policy: cheaper memory, but evicted keys turn retries into duplicates.',
    },
    {
      id: 'adr-etag', label: 'ETag and If-Match for concurrent edits', when: { CONCURRENCY: ['etag'] },
      decision: 'Concurrent edits are caught with HTTP conditional requests (RFC 9110, section 13). Every response that carries a resource carries a strong ETag (quoted, never W/), computed as a hash of the stored representation as the Microsoft REST API Guidelines recommend, and every successful change returns the new one. A PUT, PATCH or DELETE that would change an existing resource must carry If-Match with the ETag the client last saw: a mismatch is refused with 412 Precondition Failed and a missing If-Match with 428 Precondition Required (RFC 6585), both changing nothing. A creation with PUT may send If-None-Match: * to refuse overwriting an existing resource, and GET answers If-None-Match with 304. The comparison and the write are one atomic step, in the way the Data consistency pack decides (a version checked in the UPDATE\'s WHERE clause). The OpenAPI document declares If-Match on every PUT, PATCH and DELETE with its 412 and 428 answers, whose bodies follow the Errors pack.',
      consequences: '• Two clients can no longer silently overwrite each other: the second one learns of the first.\n• Every client must read before it writes and keep the ETag; scripts and simple integrations must learn to send If-Match.\n• A 412 needs a path in the client: read again, merge or ask the user.\n• The ETag must change with every change visible in the representation, embedded parts included; a hash of the representation does so by construction.\n• Caches and CDNs can use the same ETags to revalidate.',
      alternatives: '1. A version field in the body with 409: works where headers are dropped, but outside HTTP\'s own semantics.\n2. Last write wins: nothing to send, and concurrent changes are lost silently.\n3. Pessimistic locks (a lock resource held while a person edits): held across thinking time and left behind by crashed clients.',
    },
    {
      id: 'adr-version', label: 'A version field for concurrent edits', when: { CONCURRENCY: ['version'] },
      decision: 'Each representation carries a field version (an integer increased with every change, or an opaque string), the way Google AIP-154 keeps an etag field in the resource. A PUT or PATCH that would change an existing resource must send the version it read, a required field of the request body; a version other than the current one is refused with 409 Conflict and changes nothing, and the client reads the resource again. DELETE takes the version as a query parameter. The comparison and the write are one atomic step (version = the expected value in the UPDATE\'s WHERE clause), in the way the Data consistency pack decides. The error body of the 409 says that the version was stale, apart from other conflicts, as the Errors pack shapes it.',
      consequences: '• Lost updates are refused with nothing but JSON: it works where headers are dropped and in APIs also served over gRPC.\n• HTTP caches and generic clients do not understand it: no 304 revalidation, no 412 or 428.\n• 409 also means other conflicts, so clients must read the error type to know a stale version from a duplicate.\n• The version is part of every schema that changes a resource.',
      alternatives: '1. ETag and If-Match: HTTP\'s own mechanism, understood by caches and tools.\n2. Last write wins: nothing to send, concurrent changes lost.',
    },
    {
      id: 'adr-lww', label: 'Last write wins', when: { CONCURRENCY: ['lww'] },
      context: `${FORCES} Here each resource is changed by one person or system at a time, so concurrent edits are rare.`,
      decision: 'PUT and PATCH carry no precondition and no version: the write that commits last is the one kept. Each representation shows when and by whom it was last changed (updatedAt, updatedBy), so an overwrite can be traced. This holds while each resource is edited by one person or system at a time (a user\'s own settings, records one integration owns); the first resource that several people edit at once supersedes this decision for it.',
      consequences: '• Nothing for clients to keep or send.\n• Two concurrent edits lose one of them silently; only updatedBy and the logs show who was overwritten.\n• A PATCH limits the damage to the fields it sends; a PUT overwrites every field.',
      alternatives: '1. ETag and If-Match with 412.\n2. A version field in the body with 409.',
    },
  ],
  fitness: [
    {
      id: 'ff-key-http', label: 'Repeats replay, misuse is refused', when: KEY, category: 'structural', implements: ['adr-key'], checks: ['req-key-replay', 'req-key-required', 'req-key-mismatch'],
      threshold: 'A repeat with the same key gets the first status and body and creates 0 more orders; a reused key with another body gets 422; a POST without a key gets 400',
      description: 'An HTTP test sends one order twice with the same key and compares the answers and the orders stored, then reuses the key with another body and sends one without a key. Each test uses a fresh UUID as its key and as the order\'s reference, so tests in parallel do not see each other\'s orders.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack: JUnit with MockMvc or REST Assured, xUnit with WebApplicationFactory)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../../src/app'
import { db } from '../db'

const post = (body: object, key?: string) => {
  const req = request(app).post('/orders')
  return (key ? req.set('Idempotency-Key', \`"\${key}"\`) : req).send(body)   // a Structured Field String
}
const stored = async (ref: string) => (await db.query('select count(*)::int as n from orders where reference = $1', [ref])).rows[0].n

it('performs a repeated request once and replays its answer', async () => {
  const key = crypto.randomUUID(), order = { sku: 'SKU-1', quantity: 2, reference: key }
  const first = await post(order, key)
  const again = await post(order, key)
  expect(first.status).toBe(201)
  expect([again.status, again.body]).toEqual([first.status, first.body])
  expect(await stored(key)).toBe(1)
})

it('refuses a reused key with another body (422) and a missing key (400)', async () => {
  const key = crypto.randomUUID(), order = { sku: 'SKU-1', quantity: 2, reference: key }
  await post(order, key).expect(201)
  await post({ ...order, quantity: 3 }, key).expect(422)
  await post({ ...order, reference: crypto.randomUUID() }).expect(400)
})`,
    },
    {
      id: 'ff-key-concurrent', label: 'Overlapping repeats run once', when: KEY, category: 'structural', implements: ['adr-key'], checks: ['req-key-concurrent'],
      threshold: 'In 10 runs of two overlapping requests with one key, each run stores 1 order, and the second answer is the first one\'s or 409',
      description: 'The test app holds every order change for 500 ms through a test hook, so the two requests overlap; whether the second waits for the first or is refused with 409 depends on the key store, and the test accepts either, but never a second order.',
      tool: 'Vitest with supertest, the app built by a test fixture with a 500 ms hold in the order handler (on the JVM: JUnit with REST Assured and a CompletableFuture pair)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { appHoldingOrders } from './fixtures'   // the app with a test hook that holds each order change for 500 ms
import { db } from '../db'

it.each([...Array(10).keys()])('never runs two overlapping requests with one key twice (run %i)', async () => {
  const key = crypto.randomUUID()
  const order = { sku: 'SKU-1', quantity: 2, reference: key }
  const send = () => request(appHoldingOrders).post('/orders').set('Idempotency-Key', \`"\${key}"\`).send(order)
  const [first, second] = (await Promise.all([send(), send()])).sort((a, b) => a.status - b.status)
  expect(first.status).toBe(201)
  if (second.status !== 409) expect([second.status, second.body]).toEqual([first.status, first.body])
  const { rows } = await db.query('select count(*)::int as n from orders where reference = $1', [key])
  expect(rows[0].n).toBe(1)
})`,
    },
    {
      id: 'ff-key-contract', label: 'The contract requires the key', when: KEY, category: 'structural', implements: ['adr-key'], checks: ['req-key-required'],
      threshold: '0 POST or PATCH operations in openapi.yaml without a required Idempotency-Key header parameter and documented 400 and 422 answers',
      description: 'A Spectral rule over the OpenAPI document fails the build when a POST or PATCH does not declare the Idempotency-Key header as required or does not document the 400 and 422 answers; references to shared parameters are resolved. A new operation fails until it takes the key. Add the rule to the ruleset the API style guide keeps.',
      tool: 'Spectral (npx @stoplight/spectral-cli lint openapi.yaml --ruleset .spectral.yaml --fail-severity error); for a Java build the same CLI runs in the pipeline',
      language: 'yaml',
      snippet: `# .spectral.yaml
extends: [[spectral:oas, off]]
rules:
  idempotency-key-required:
    description: Every POST and PATCH takes a required Idempotency-Key header and documents 400 and 422 (ADR Idempotency keys on unsafe requests)
    message: "{{path}}: declare a required Idempotency-Key header parameter and the 400 and 422 answers"
    severity: error
    given: $.paths[*][post,patch]
    then:
      function: schema
      functionOptions:
        schema:
          type: object
          required: [parameters, responses]
          properties:
            parameters:
              type: array
              contains:
                type: object
                required: [name, in, required]
                properties: { name: { const: Idempotency-Key }, in: { const: header }, required: { const: true } }
            responses: { type: object, required: ['400', '422'] }`,
    },
    {
      id: 'ff-key-atomic', label: 'A failed change leaves no key', when: KEY_DB, category: 'structural', implements: ['adr-store-db'], checks: ['req-key-atomic'],
      threshold: 'After a request whose second write fails: 0 rows in idempotency_keys and 0 orders for its key; the retry with the same key answers 201',
      description: 'An integration test against the real database makes the second write of an order fail once, then checks that neither the order nor the key was kept and that the retry with the same key creates the order.',
      tool: 'Vitest with supertest against PostgreSQL in a container (Testcontainers); for the JVM: JUnit with Testcontainers and a Mockito spy on the repository',
      language: 'ts',
      snippet: `import request from 'supertest'
import { vi } from 'vitest'
import { app } from '../../src/app'
import { orderLines } from '../../src/orders/repository'   // the second write of an order, inside its transaction
import { db } from '../db'

it('a change that rolls back leaves no key, so the retry runs', async () => {
  const key = crypto.randomUUID()
  const order = { sku: 'SKU-1', quantity: 2, reference: key }
  const post = () => request(app).post('/orders').set('Idempotency-Key', \`"\${key}"\`).send(order)
  vi.spyOn(orderLines, 'insert').mockRejectedValueOnce(new Error('disk full'))
  expect((await post()).status).toBeGreaterThanOrEqual(500)
  expect((await db.query('select 1 from idempotency_keys where key = $1', [key])).rowCount).toBe(0)
  expect((await db.query('select 1 from orders where reference = $1', [key])).rowCount).toBe(0)
  expect((await post()).status).toBe(201)
})`,
    },
    {
      id: 'ff-key-table', label: 'Old keys are cleaned up', when: KEY_DB, category: 'operational', implements: ['adr-store-db'], checks: ['req-key-expiry'],
      threshold: '0 keys older than {{KEY_HOURS}} hours plus one; 1 clean-up job scheduled; 0 failed clean-up runs in the last day',
      description: 'A query run every hour by the monitoring job against the element\'s database returns one row per problem; any row with a count above 0 raises an alert. The clean-up itself is a pg_cron job created once by a migration (shown in the comment).',
      tool: 'PostgreSQL with pg_cron (cron.job, cron.job_run_details), the query run by the monitoring job; on another database the scheduler\'s own job history',
      language: 'sql',
      snippet: `-- the clean-up, created once by a migration:
--   SELECT cron.schedule('idempotency-keys-cleanup', '0 * * * *',
--     $$DELETE FROM idempotency_keys WHERE created_at < now() - interval '{{KEY_HOURS}} hours'$$);
-- the check, hourly: alert on any row with n > 0
SELECT 'keys kept too long' AS problem, count(*) AS n
FROM idempotency_keys
WHERE created_at < now() - interval '{{KEY_HOURS}} hours' - interval '1 hour'
UNION ALL
SELECT 'clean-up not scheduled', CASE WHEN count(*) = 0 THEN 1 ELSE 0 END
FROM cron.job
WHERE command ILIKE '%DELETE FROM idempotency_keys%'
UNION ALL
SELECT 'clean-up failed in the last day', count(*)
FROM cron.job_run_details d JOIN cron.job j USING (jobid)
WHERE j.command ILIKE '%DELETE FROM idempotency_keys%'
  AND d.status = 'failed' AND d.start_time > now() - interval '1 day';`,
    },
    {
      id: 'ff-key-redis', label: 'Redis keys expire, never evicted', when: KEY_REDIS, category: 'operational', implements: ['adr-store-redis'], checks: ['req-key-expiry', 'req-key-redis'],
      threshold: 'maxmemory-policy is noeviction; 0 idem:* keys without an expiry or with one above {{KEY_HOURS}} hours',
      description: 'A script run after every deploy and hourly by the monitoring job reads the eviction policy and scans the idempotency keys without blocking Redis (SCAN), failing on a key with no expiry or a longer one. Managed Redis that blocks CONFIG (some ElastiCache setups) has its policy read from the provider\'s parameter group instead.',
      tool: 'redis-cli in a shell step (REDIS_URL points at the key store)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
max=$(( {{KEY_HOURS}} * 3600 ))
policy=$(redis-cli -u "$REDIS_URL" --raw CONFIG GET maxmemory-policy | tail -n 1)
[ "$policy" = noeviction ] || { echo "maxmemory-policy is $policy, not noeviction"; exit 1; }
bad=0
while read -r key; do
  ttl=$(redis-cli -u "$REDIS_URL" --raw TTL "$key" < /dev/null)
  [ "$ttl" -eq -2 ] && continue                     # expired since the scan
  if [ "$ttl" -lt 0 ] || [ "$ttl" -gt "$max" ]; then echo "$key: TTL $ttl"; bad=$((bad + 1)); fi
done < <(redis-cli -u "$REDIS_URL" --scan --pattern 'idem:*')
[ "$bad" -eq 0 ] || { echo "$bad idempotency keys without a valid expiry"; exit 1; }`,
    },
    {
      id: 'ff-put-repeat', label: 'A repeated PUT changes nothing', when: { IDEMPOTENCY: ['put'] }, category: 'structural', implements: ['adr-put'], checks: ['req-put-create'],
      threshold: 'The first PUT to a new id answers 201, the repeat 200 with the same body; 1 order stored for the id',
      description: 'An HTTP test creates an order with a PUT to a fresh UUID, repeats the same request, and checks the answers and the rows stored.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack: JUnit with MockMvc or REST Assured)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../../src/app'
import { db } from '../db'

it('a repeated PUT leaves one resource and changes nothing', async () => {
  const id = crypto.randomUUID()
  const order = { sku: 'SKU-1', quantity: 2 }
  const first = await request(app).put(\`/orders/\${id}\`).send(order).expect(201)
  const again = await request(app).put(\`/orders/\${id}\`).send(order).expect(200)
  expect(again.body).toEqual(first.body)
  const { rows } = await db.query('select count(*)::int as n from orders where id = $1', [id])
  expect(rows[0].n).toBe(1)
})`,
    },
    {
      id: 'ff-put-contract', label: 'No POST in the contract', when: { IDEMPOTENCY: ['put'] }, category: 'structural', implements: ['adr-put'], checks: ['req-put-no-post'],
      threshold: '0 POST operations and 0 PATCH request bodies other than application/merge-patch+json in openapi.yaml',
      description: 'Two Spectral rules over the OpenAPI document fail the build on any POST and on a PATCH that accepts another media type. A POST that only reads (a search with a large body) is exempted by name in the ruleset\'s overrides, where the exception is visible in review.',
      tool: 'Spectral (npx @stoplight/spectral-cli lint openapi.yaml --ruleset .spectral.yaml --fail-severity error)',
      language: 'yaml',
      snippet: `# .spectral.yaml
extends: [[spectral:oas, off]]
rules:
  no-post:
    description: State is created and changed with PUT and JSON Merge Patch, never POST (ADR Client-chosen ids with PUT)
    message: "{{path}}: replace POST with a PUT to a URI whose id the client chooses"
    severity: error
    given: $.paths[*]
    then: { field: post, function: undefined }
  patch-is-merge-patch:
    description: A PATCH accepts only application/merge-patch+json (RFC 7396), which repeats with the same result
    message: "{{path}}: a PATCH body is application/merge-patch+json only"
    severity: error
    given: $.paths[*].patch.requestBody.content
    then:
      function: schema
      functionOptions:
        schema: { type: object, minProperties: 1, propertyNames: { const: application/merge-patch+json } }`,
    },
    {
      id: 'ff-none-contract', label: 'Unsafe operations marked', when: { IDEMPOTENCY: ['none'] }, category: 'structural', implements: ['adr-none'], checks: ['req-none-retry'],
      threshold: '0 POST or PATCH operations in openapi.yaml without x-retry-safe: false and a description of at least 20 characters',
      description: 'A Spectral rule over the OpenAPI document fails the build when a POST or PATCH is not marked as unsafe to retry or has no description to tell the caller how to look the result up. Generated clients and the API portal read the extension.',
      tool: 'Spectral (npx @stoplight/spectral-cli lint openapi.yaml --ruleset .spectral.yaml --fail-severity error)',
      language: 'yaml',
      snippet: `# .spectral.yaml
extends: [[spectral:oas, off]]
rules:
  unsafe-not-retry-safe:
    description: Every POST and PATCH is marked as not safe to retry and says how to look the result up (ADR No idempotency for unsafe requests)
    message: "{{path}}: set x-retry-safe: false and describe how a caller finds out whether a request that timed out took effect"
    severity: error
    given: $.paths[*][post,patch]
    then:
      function: schema
      functionOptions:
        schema:
          type: object
          required: [x-retry-safe, description]
          properties:
            x-retry-safe: { const: false }
            description: { type: string, minLength: 20 }`,
    },
    {
      id: 'ff-etag', label: 'Changes only from the current ETag', when: { CONCURRENCY: ['etag'] }, category: 'structural', implements: ['adr-etag'], checks: ['req-etag', 'req-etag-required'],
      threshold: 'A GET answers a strong ETag; a change without If-Match gets 428, with a stale one 412, with the current one 200 and a new ETag; the refused changes leave the order unchanged',
      description: 'An HTTP test reads an order, tries to change it without If-Match, changes it with the ETag it read, and then tries again with that now stale ETag, checking the stored quantity at the end.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack: JUnit with MockMvc or REST Assured)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../../src/app'
import { createOrder } from './fixtures'

it('changes a resource only from the version the client saw', async () => {
  const url = \`/orders/\${(await createOrder()).id}\`
  const read = await request(app).get(url).expect(200)
  const etag = read.headers.etag
  expect(etag).toMatch(/^"[^"]*"$/)                                   // strong: quoted, no W/ prefix
  const change = (quantity: number) => request(app).put(url).send({ ...read.body, quantity })
  await change(3).expect(428)                                          // no If-Match
  const saved = await change(3).set('If-Match', etag).expect(200)
  expect(saved.headers.etag).not.toBe(etag)
  await change(4).set('If-Match', etag).expect(412)                    // stale: the order changed since
  expect((await request(app).get(url)).body.quantity).toBe(3)
})`,
    },
    {
      id: 'ff-version', label: 'Stale versions refused', when: { CONCURRENCY: ['version'] }, category: 'structural', implements: ['adr-version'], checks: ['req-version'],
      threshold: 'A change from the current version answers 200 with a new version; a change from the old version answers 409 and leaves the order unchanged',
      description: 'An HTTP test reads an order with its version, saves a change from it, and saves another change from the same, now stale, copy.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack: JUnit with MockMvc or REST Assured)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../../src/app'
import { createOrder } from './fixtures'

it('refuses a change made from a stale version with 409', async () => {
  const url = \`/orders/\${(await createOrder()).id}\`
  const seen = (await request(app).get(url).expect(200)).body
  expect(seen.version).toBeDefined()
  const saved = await request(app).put(url).send({ ...seen, quantity: 3 }).expect(200)
  expect(saved.body.version).not.toEqual(seen.version)
  await request(app).put(url).send({ ...seen, quantity: 4 }).expect(409)   // seen.version is stale now
  expect((await request(app).get(url)).body).toMatchObject({ quantity: 3, version: saved.body.version })
})`,
    },
    {
      id: 'ff-lww', label: 'The last writer is shown', when: { CONCURRENCY: ['lww'] }, category: 'structural', implements: ['adr-lww'], checks: ['req-lww'],
      threshold: 'Two changes from the same copy both answer 200; the order holds the second one\'s quantity, its writer in updatedBy and a valid updatedAt',
      description: 'An HTTP test has two users change the same order from the same copy, one after the other, and checks that the second write is kept and that the representation names its writer.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack: JUnit with MockMvc or REST Assured)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../../src/app'
import { asUser, createOrder } from './fixtures'   // asUser: a supertest agent signed in as that user

it('keeps the last write and shows who made it', async () => {
  const url = \`/orders/\${(await createOrder()).id}\`
  const seen = (await request(app).get(url).expect(200)).body
  const [alice, bob] = await Promise.all([asUser('alice'), asUser('bob')])
  await alice.put(url).send({ ...seen, quantity: 3 }).expect(200)
  await bob.put(url).send({ ...seen, quantity: 5 }).expect(200)          // from the same copy: no precondition
  const now = (await request(app).get(url).expect(200)).body
  expect(now).toMatchObject({ quantity: 5, updatedBy: 'bob' })
  expect(Number.isNaN(Date.parse(now.updatedAt))).toBe(false)
})`,
    },
  ],
}

export default pack
