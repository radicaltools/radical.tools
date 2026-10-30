import type { PackSpec, When } from '../../src/packSpec'

const CACHED: When = { WHERE: ['edge', 'shared', 'local'] }
const DATA: When = { WHERE: ['shared', 'local'] }
const CACHE_ADRS = ['adr-edge', 'adr-shared', 'adr-local']
const DATA_ADRS = ['adr-shared', 'adr-local']
const FORCES = 'This element reads from a data store, and some of what it reads is read far more often than it changes. The forces: a cache cuts latency and load on the store, but every cached entry is a second copy that is wrong from the moment the data changes until it expires or is removed; a lost or late invalidation shows users old data, and a write decided on a cached value loses an update; when a hot entry expires, every request that misses at once goes to the store (a stampede); a cache creates two code paths, and a store sized for the traffic the cache lets through browns out when the cache is empty or down; and a response cached for everyone that was meant for one caller is a data leak. Where reads are served from (the primary, replicas, read models) and how stale they may be is decided in the Data consistency pack; the CDN hosting and the caching of a front end\'s static files in the Infrastructure and Frontend stack packs; the latency budget in the Capacity and scaling pack; whether personal data may sit in a cache, and how erasure reaches it, in the Personal data and Data classification packs; the tenant in every cache key in the Tenant isolation pack.'

const pack: PackSpec = {
  id: 'concern-caching',
  name: 'Caching',
  group: 'architecture',
  description: 'Where reads of a data store are cached (at the HTTP edge, in a shared Redis or Valkey, in each instance, or not at all), how long entries live and how a change removes them, how a miss storm is prevented, and what happens when the cache is down. Where reads are served from and how stale they may be is decided in the Data consistency pack. The snippets are for a Node service with Vitest, Testcontainers, dependency-cruiser, k6 and Prometheus; each tool line names the JVM equivalent.',
  tags: ['caching', 'performance', 'http caching', 'redis', 'cache invalidation', 'cache stampede'],
  concern: {
    id: 'caching',
    trigger: 'LIST RELATIONS WHERE (source.type = "container" OR source.type = "component") AND source.external != true AND target.type = "database"',
    applyTo: 'source',
    why: 'these elements read a data store, so whether and where its data is cached, how stale a reader may see it, and what happens when the cache misses or fails has to be decided.',
  },
  sources: [
    { title: 'RFC 9111, HTTP Caching', url: 'https://www.rfc-editor.org/rfc/rfc9111' },
    { title: 'RFC 9110, HTTP Semantics (validators, conditional requests)', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
    { title: 'RFC 5861, HTTP Cache-Control Extensions for Stale Content', url: 'https://www.rfc-editor.org/rfc/rfc5861' },
    { title: 'Amazon Builders\' Library: Caching challenges and strategies', url: 'https://aws.amazon.com/builders-library/caching-challenges-and-strategies/' },
    { title: 'Amazon ElastiCache: Caching strategies (lazy loading, write-through, TTL)', url: 'https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html' },
    { title: 'Redis documentation: Key eviction', url: 'https://redis.io/docs/latest/develop/reference/eviction/' },
    { title: 'Caffeine wiki', url: 'https://github.com/ben-manes/caffeine/wiki' },
    { title: 'Vattani, Chierichetti, Lowenstein: Optimal Probabilistic Cache Stampede Prevention (PVLDB 8(8), 2015)', url: 'https://www.vldb.org/pvldb/vol8/p886-vattani.pdf' },
    { title: 'Nishtala et al.: Scaling Memcache at Facebook (NSDI 2013)', url: 'https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala' },
  ],
  questions: [
    {
      key: 'WHERE', title: 'Where', label: 'Where is data read from the store cached?',
      hint: 'Each place caches different things: the edge only responses that are the same for every caller, a shared cache anything at the cost of a store to run, an in-process cache anything at the cost of one copy per instance. Replicas and read models are decided in the Data consistency pack, not here.',
      default: 'none',
      options: [
        { value: 'edge', label: 'HTTP caching at the edge (Cache-Control and ETag)', description: 'The element marks its responses with Cache-Control and ETag (RFC 9111) and a CDN in front of it, and the browsers, keep them; a hit never reaches the element. Pick it when the responses read most are the same for every caller: catalogues, prices, public content.' },
        { value: 'shared', label: 'a shared cache (Redis or Valkey) with cache-aside', description: 'Every instance looks in one Redis or Valkey first and, on a miss, reads the store and puts the entry there with an expiry. Pick it when reads differ per caller or per query, several instances serve them, and the store or its latency is the bottleneck.' },
        { value: 'local', label: 'an in-process cache in each instance', description: 'Each instance keeps a size-bounded cache in its own memory: Caffeine on the JVM, lru-cache in Node.js. Pick it for small, hot, slowly changing data (reference data, configuration, feature lists) where a network hop matters and instances may disagree for a few seconds.' },
        { value: 'none', label: 'no cache', description: 'Every read goes to the store; nothing keeps copies of its data between requests. Pick it while the store meets the latency budget and carries the reads, which is longer than most expect; the decision records it so a cache does not arrive without one.' },
      ],
    },
    {
      key: 'INVALIDATION', title: 'Invalidation', label: 'How does a change leave the cache?',
      hint: 'Expiry alone bounds staleness by the TTL; removing entries on a change bounds it by seconds, if every write path does it. Where the Data consistency pack decides reads with bounded staleness, the TTL (TTL_SECONDS) must not exceed that pack\'s propagation bound (PROPAGATION_SECONDS). Only with a cache (not with no cache).',
      default: 'delete',
      options: [
        { value: 'ttl', label: 'expiry alone (TTL)', description: 'Entries expire after the TTL and nothing removes them earlier; a reader may see data as old as the TTL. Pick it when that much staleness is acceptable to the product (catalogues, reference data, counts) and writes come from many places you do not control. Not for an element whose Data consistency decision is reads from the primary only, which asks a cache to remove an entry when its data changes.' },
        { value: 'delete', label: 'deletion by the writer after the commit', description: 'The code that changes the data deletes the entries it made stale (or purges them from the CDN) right after its transaction commits; the TTL stays as the backstop. Pick it when the writes go through this element\'s own code.' },
        { value: 'event', label: 'deletion by change events (outbox or change data capture)', description: 'A consumer of the store\'s change events (the outbox events, or Debezium change data capture) deletes or purges the entries each change made stale; the TTL stays as the backstop. Pick it when other services, jobs or migrations write the same data, or a deletion lost to a crash is not acceptable.' },
      ],
    },
    {
      key: 'STAMPEDE', title: 'Miss storms', label: 'What keeps many concurrent misses for one key from all reading the store?',
      hint: 'When a hot entry expires, every request that misses at once reads the store, which slows every one of them down. Only with a shared or in-process cache: at the edge, the CDN\'s request collapsing does this and is named in the decision.',
      default: 'coalesce',
      options: [
        { value: 'coalesce', label: 'request coalescing (one load per key at a time)', description: 'The first miss for a key loads it; concurrent misses for the same key wait for that load instead of reading the store themselves (single flight). Pick it by default: it bounds store reads per key to one per instance at any moment.' },
        { value: 'early', label: 'probabilistic early refresh (XFetch)', description: 'A read close to an entry\'s expiry refreshes it early with a probability that grows as expiry nears, so one request reloads a hot entry before it expires. Pick it for a few very hot entries that are expensive to load, where even one wave of waiting requests is too slow.' },
        { value: 'none', label: 'no protection; the store takes every miss', description: 'Concurrent misses each read the store. Pick it only when the store carries the peak read load with an empty cache, which a load test proves; the decision records it.' },
      ],
    },
    {
      key: 'DOWN', title: 'Cache down', label: 'What happens to reads while the shared cache is down?',
      hint: 'A store sized for the traffic the cache lets through cannot take every read at once. Only with a shared cache: an in-process cache fails with its instance, and the CDN\'s availability is the Infrastructure pack\'s.',
      default: 'store',
      options: [
        { value: 'store', label: 'reads from the store behind a circuit breaker and a concurrency limit', description: 'Reads go to the store, a circuit breaker stops trying the cache until it answers again, and each instance runs only a limited number of store reads at once, refusing the rest with 503. Pick it when the store can carry part of the read load and a slower, partial service is better than none.' },
        { value: 'fail', label: 'a fast refusal (503 with Retry-After)', description: 'Reads that need the cache are refused at once as temporary, and the store is not read. Pick it when the store cannot carry the reads without the cache and must be kept free for writes, or when the cache is the only copy fast enough to be useful.' },
      ],
    },
  ],
  details: [
    { key: 'TTL_SECONDS', label: 'How long may a cached entry or response live (seconds)? The oldest data a reader can be served', default: '60', number: true },
    { key: 'INVALIDATE_SECONDS', label: 'Within how many seconds of a commit must a changed entry be gone from every cache? (deletion by the writer or by change events)', default: '5', number: true },
    { key: 'HIT_RATIO', label: 'What share of lookups must the cache answer (%)? (shared or in-process cache)', default: '80', number: true },
    { key: 'LOCAL_MAX_ENTRIES', label: 'How many entries may each instance\'s cache hold at most? (in-process cache)', default: '10000', number: true },
    { key: 'CACHE_TIMEOUT_MS', label: 'After how many milliseconds does a call to the shared cache give up? (shared cache)', default: '50', number: true },
    { key: 'FALLBACK_CONCURRENCY', label: 'With the shared cache down, how many store reads may each instance run at once? (reads from the store)', default: '20', number: true },
  ],
  need: {
    label: 'Reads fast without serving wrong data',
    text: 'The element reads the same data from its store again and again, and the store\'s latency and capacity limit how fast and how many reads it can serve. Reads have to stay fast under load, yet a reader must not see data older than a stated bound, no write may be decided on a stale copy, no response meant for one caller may reach another, and neither an expired hot entry nor a cache outage may take the store down. The snippets assume the application under src/ (src/app exports the app, the router\'s table and createApp, src/http/cachePolicy the Cache-Control per route and the set of personal routes, src/cache/read the cached reads, src/cache/invalidate the removal after a write, src/cache/local and src/cache/xfetch the in-process cache and the early refresh, src/commands the operations that change data, src/catalog/store the store reads) and the tests under tests/ with their fixtures in tests/cache.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-cache-control', label: 'Every response says how it may be cached', ears_type: 'ubiquitous',
      action: 'send an explicit Cache-Control header with every response to a GET request, mark every response that carries personal data or depends on who is calling private or no-store, and give every response a shared cache may store an ETag and a lifetime (s-maxage or max-age, plus any stale-while-revalidate) of at most {{TTL_SECONDS}} seconds',
      rationale: 'Without Cache-Control a cache may choose a lifetime of its own (RFC 9111 4.2.2, heuristic freshness); a shared cache that stores a response meant for one caller hands it to the next, which private and no-store forbid (RFC 9111 3.5, 5.2.2.5, 5.2.2.7).',
      scenario: { label: 'Cache headers per route', given: 'every GET route of the element', when: 'each is called as a signed-in user', then: 'every response carries Cache-Control, those with personal data are private or no-store, and those a shared cache may keep carry an ETag and a lifetime of at most {{TTL_SECONDS}} seconds' },
    },
    {
      id: 'req-no-cache', label: 'Reads go to the store', when: { WHERE: ['none'] }, ears_type: 'ubiquitous',
      action: 'read the data it serves from the store on every request and keep no copy of the store\'s data between requests, in its own memory or in another store',
      rationale: 'A cache is a second copy with its own staleness, failure mode and cold start, and services come to depend on it without noticing (Amazon Builders\' Library, Caching challenges and strategies); while the store meets the latency budget, not having one is the simpler design.',
      scenario: { label: 'No cache library', given: 'the element\'s source code', when: 'the dependency rules run', then: 'no module under src imports a cache client or an in-process cache library, apart from the modules other decisions give a Redis of their own' },
    },
    {
      id: 'req-expiry', label: 'Every entry expires', when: CACHED, ears_type: 'ubiquitous',
      action: 'store every cached entry and every response a shared cache may keep with an expiry of at most {{TTL_SECONDS}} seconds, so that no reader is served data older than that even when a removal is lost',
      rationale: 'Expiry is the backstop that bounds staleness whatever else fails, and the TTL is chosen by how stale a reader may see the data (Amazon Builders\' Library; ElastiCache caching strategies, adding TTL).',
      scenario: { label: 'No entry outlives the TTL', given: 'the cache after a day of normal traffic', when: 'its entries, or the headers of the responses a shared cache may keep, are read', then: 'every one expires within {{TTL_SECONDS}} seconds' },
    },
    {
      id: 'req-invalidate', label: 'A change leaves the cache', when: { ...CACHED, INVALIDATION: ['delete', 'event'] }, ears_type: 'event-driven',
      trigger: 'a transaction that changes cached data commits',
      action: 'remove the entries it made stale from every cache that holds them (the shared cache, the cache of every instance, or the CDN) within {{INVALIDATE_SECONDS}} seconds, deleting them rather than writing the new value',
      rationale: 'Without removal on a change, readers see old data until the TTL; a delete is idempotent and cannot leave an older value behind, as two concurrent overwrites can (Nishtala et al., Scaling Memcache at Facebook, section 2).',
      scenario: { label: 'Change reaches every reader', given: 'a product whose price is cached in every instance (or at the CDN)', when: 'its price is changed', then: 'every reader gets the new price within {{INVALIDATE_SECONDS}} seconds' },
    },
    {
      id: 'req-writes-bypass', label: 'Writes decide on the store', when: DATA, ears_type: 'ubiquitous',
      action: 'take every decision that writes (a stock check before a reservation, a price at checkout, a permission check) on data read from the store inside the writing transaction, never on a cached entry',
      rationale: 'A cached entry may be up to the TTL old by design; a write decided on it is a lost update (Amazon Builders\' Library, on cache consistency). The Data consistency pack takes the same rule for replicas.',
      scenario: { label: 'Commands do not read the cache', given: 'the operations that change data, under src/commands', when: 'the dependency rules run', then: 'none of them reaches the cached reads, directly or through other modules' },
    },
    {
      id: 'req-coalesce', label: 'One load per key at a time', when: { ...DATA, STAMPEDE: ['coalesce'] }, ears_type: 'event-driven',
      trigger: 'several requests miss the cache for the same key at the same time',
      action: 'read the store for that key once per instance, and give the other requests the result of that read',
      rationale: 'When a hot entry expires, every concurrent request recomputes it and each recomputation slows the others (Vattani et al.); coalescing allows one pending load per key (Amazon Builders\' Library, request coalescing; Caffeine wiki, Population: an atomic get with a mapping function).',
      scenario: { label: 'Hundred misses, one read', given: 'a key that is not in the cache', when: '100 requests for it arrive at once on one instance', then: 'the store is read once and all 100 requests get the same value' },
    },
    {
      id: 'req-early', label: 'Hot entries refreshed before they expire', when: { ...DATA, STAMPEDE: ['early'] }, ears_type: 'event-driven',
      trigger: 'a request reads an entry close to its expiry',
      action: 'refresh the entry before it expires with a probability that rises as expiry nears, scaled by how long its last load took (XFetch with beta 1), and serve the cached value meanwhile',
      rationale: 'Probabilistic early expiration lets one request reload a hot entry just before it expires, so the many that follow find it fresh; the exponential form (XFetch) is optimal and needs no tuning at beta 1 (Vattani et al., sections 4 and 5).',
      scenario: { label: 'Refresh just in time', given: 'an entry read every millisecond whose last load took 50 ms', when: 'its expiry approaches', then: 'a read refreshes it before it expires, and less than 1 second before' },
    },
    {
      id: 'req-cold', label: 'The store carries a cold cache', when: { ...DATA, STAMPEDE: ['none'] }, ears_type: 'state-driven',
      precondition: 'the cache is empty, after a deploy, a flush or a failover',
      action: 'serve the peak read load set in the Capacity and scaling pack from the store alone, with fewer than 0.1 % errors and within that pack\'s latency budget',
      rationale: 'Without protection every miss reaches the store; a store sized for the traffic a warm cache lets through browns out when the cache is cold (Amazon Builders\' Library, cold start and thundering herd).',
      scenario: { label: 'Peak on an empty cache', given: 'an emptied cache', when: 'the peak read rate on 20 hot keys runs for 5 minutes', then: 'errors stay under 0.1 % and the 95th percentile within the latency budget' },
    },
    {
      id: 'req-down-store', label: 'Cache outage falls back, limited', when: { WHERE: ['shared'], DOWN: ['store'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the shared cache does not answer within {{CACHE_TIMEOUT_MS}} ms or refuses connections',
      action: 'serve reads from the store, stop calling the cache through a circuit breaker until it answers again, and run at most {{FALLBACK_CONCURRENCY}} store reads at once per instance, refusing the excess with 503 and a Retry-After header',
      rationale: 'Falling back to the store when the cache fails sends it the whole read load at once and can brown it out; cap the rate of calls to it and shed the rest (Amazon Builders\' Library, cache downtime).',
      scenario: { label: 'Cache stopped, store protected', given: 'a warm shared cache', when: 'the cache is stopped and 200 reads arrive at once', then: 'each read answers 200 or 503 with Retry-After, some answer 200, and the store never runs more than {{FALLBACK_CONCURRENCY}} reads at once' },
    },
    {
      id: 'req-down-fail', label: 'Cache outage refused fast', when: { WHERE: ['shared'], DOWN: ['fail'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the shared cache does not answer within {{CACHE_TIMEOUT_MS}} ms or refuses connections',
      action: 'refuse the reads that need it with 503 and a Retry-After header within {{CACHE_TIMEOUT_MS}} ms plus 100 ms, without reading the store',
      rationale: 'When the store cannot carry the reads without the cache, a fast refusal keeps it free for writes and for the moment the cache returns (Amazon Builders\' Library, cache downtime and load shedding).',
      scenario: { label: 'Cache stopped, reads refused', given: 'a warm shared cache', when: 'the cache is stopped and a read arrives', then: 'it is refused with 503 and Retry-After within {{CACHE_TIMEOUT_MS}} ms plus 100 ms, and the store receives no read' },
    },
    {
      id: 'req-local-bound', label: 'In-process cache bounded', when: { WHERE: ['local'] }, ears_type: 'ubiquitous',
      action: 'hold at most {{LOCAL_MAX_ENTRIES}} entries in each instance\'s cache, evicting the least recently or least frequently used when it is full',
      rationale: 'An unbounded in-process cache grows with the key space until the instance runs out of memory; size-based eviction keeps the hit ratio high in bounded memory (Caffeine wiki, Eviction and Efficiency).',
      scenario: { label: 'Cache stays in its bound', given: 'an instance\'s cache', when: '1,000 more keys than the bound are loaded into it', then: 'it holds at most {{LOCAL_MAX_ENTRIES}} entries' },
    },
    {
      id: 'req-shared-own', label: 'The cache has a Redis of its own', when: { WHERE: ['shared'] }, ears_type: 'ubiquitous',
      action: 'keep cached entries in a Redis or Valkey instance used only as this cache, with maxmemory set and the allkeys-lru or allkeys-lfu eviction policy',
      rationale: 'A cache may lose any entry, while idempotency keys, sessions and rate-limit counters must not be evicted; Redis advises a separate instance over mixing them under a volatile policy, and maxmemory 0 means no limit at all (Redis documentation, Key eviction).',
      scenario: { label: 'Cache Redis configured', given: 'the cache\'s Redis or Valkey', when: 'its memory settings are read', then: 'maxmemory is above 0 and the eviction policy is allkeys-lru or allkeys-lfu' },
    },
    {
      id: 'req-hit-ratio', label: 'The cache earns its place', when: DATA, ears_type: 'ubiquitous',
      action: 'answer at least {{HIT_RATIO}} % of cache lookups from the cache over each hour of traffic, and alert the team when it falls below',
      rationale: 'A cache that misses most lookups adds a hop and a second copy for nothing; a falling ratio is the first sign of a wrong TTL, key or eviction policy (Redis documentation, Key eviction: keyspace_hits and keyspace_misses).',
      scenario: { label: 'Low hit ratio alerts', given: 'the cache\'s hit and miss counters', when: 'the hit ratio over an hour stays below {{HIT_RATIO}} % for 15 minutes', then: 'an alert opens a ticket for the team' },
    },
    {
      id: 'req-conditional', label: 'Unchanged responses revalidate cheaply', when: { WHERE: ['edge'] }, ears_type: 'event-driven',
      trigger: 'a GET request carries an If-None-Match header that matches the current ETag of a response a shared cache may keep',
      action: 'answer 304 Not Modified without a body',
      rationale: 'Revalidation turns an expired entry into a small 304 instead of a full response, so a short TTL costs little (RFC 9111 4.3; RFC 9110 13.1.2 and 15.4.5).',
      scenario: { label: 'Expired entry revalidated', given: 'a response a shared cache keeps, with its ETag', when: 'it is requested again with If-None-Match set to that ETag', then: 'the answer is 304 without a body' },
    },
  ],
  adrs: [
    {
      id: 'adr-edge', label: 'HTTP caching at the edge', when: { WHERE: ['edge'] },
      decision: 'Responses that are the same for every caller are cached by the CDN in front of the element (Amazon CloudFront, Azure Front Door, Fastly or Cloudflare; where it runs is decided in the Infrastructure pack) and by browsers, following RFC 9111. The element sets the policy per route in one table in the code (src/http/cachePolicy): a shared response gets Cache-Control public with s-maxage, and any stale-while-revalidate (RFC 5861), adding up to at most {{TTL_SECONDS}} seconds, and an ETag, and a request whose If-None-Match matches is answered with 304; a response that carries personal data or depends on the caller gets private or no-store. The CDN\'s cache key is the path and the query parameters listed per route, never a cookie or the Authorization header. Concurrent misses for one object are collapsed by the CDN into one request to the element (CloudFront and Fastly request collapsing), with an origin shield where the CDN offers one. Invalidation: {{INVALIDATION}}; where entries are removed on a change, the removal goes through the CDN\'s purge API (CloudFront CreateInvalidation by path, Fastly purge by surrogate key, Cloudflare purge by cache tag), whose propagation counts against the bound. Static files of a front end are cached as the Frontend stack pack decides.',
      consequences: '• A hit never reaches the element or the store: the cheapest and fastest cache there is.\n• Only responses that are the same for every caller gain; personalised responses still reach the element on every request.\n• A mistake in the policy (a personal response marked public) shows one user\'s data to others: the policy table and its test are the control.\n• A purge is an API call with its own propagation time and, on some CDNs, a price per path.\n• The hit ratio is read in the CDN\'s own statistics, not in the element\'s metrics.',
      alternatives: '1. A shared application cache (Redis or Valkey): caches what differs per caller too, at the cost of a store to run.\n2. An in-process cache: no network hop, but one copy per instance.\n3. No cache: nothing to invalidate; every read reaches the store.',
    },
    {
      id: 'adr-shared', label: 'A shared cache with cache-aside', when: { WHERE: ['shared'] },
      decision: 'Data read from the store is cached in a Redis or Valkey used for nothing else (managed: Amazon ElastiCache, Azure Cache for Redis or Google Memorystore), with maxmemory set and the allkeys-lru eviction policy, separate from any Redis that keeps idempotency keys, sessions or rate-limit counters. Reads use cache-aside through src/cache/read: look in the cache, on a miss read the store and set the entry with an expiry of at most {{TTL_SECONDS}} seconds. Keys are cache:<entity>:<id>:v<schema version>, so a release that changes the cached shape starts on new keys. Calls to the cache give up after {{CACHE_TIMEOUT_MS}} ms (ioredis commandTimeout with the offline queue off; a Lettuce command timeout on the JVM). Invalidation: {{INVALIDATION}}; an entry removed on a change is deleted, never overwritten, and gone within {{INVALIDATE_SECONDS}} seconds of the commit. Concurrent misses for one key: {{STAMPEDE}}. With the cache down: {{DOWN}}; the circuit breaker is that of the library the Integration resilience pack chose (cockatiel, Resilience4j, Polly). Decisions that write read the store inside their transaction, never the cache. The staleness the TTL allows must fit the read decision of the Data consistency pack.',
      consequences: '• One miss warms the cache for every instance; a hit costs a network round trip, well under a millisecond within one zone.\n• A store to size, patch and watch; a managed service takes most of the work.\n• The cache is on the read path: its outage is designed for (falling back with a limit, or refusing fast), and a store sized only for the misses cannot take every read at once.\n• Every write path must remove what it changed, or readers see old data up to the TTL; deletion by change events also catches writers outside the element.\n• Two code paths, hit and miss: tests must run both, and a cold cache is tested on purpose.',
      alternatives: '1. An in-process cache: no hop and no store to run, but one copy per instance and invalidation in every instance.\n2. HTTP caching at the edge: no store, but only for responses that are the same for everyone.\n3. Read replicas (the Data consistency pack): more read capacity without a second copy to invalidate.\n4. Write-through, the writer setting the new value in the cache: entries are fresh, but two concurrent writers can leave the older value, and values nobody reads fill the cache (ElastiCache caching strategies; Nishtala et al.).',
    },
    {
      id: 'adr-local', label: 'An in-process cache in each instance', when: { WHERE: ['local'] },
      decision: 'Each instance keeps a size-bounded in-process cache, made in one place (src/cache/local): Caffeine on the JVM (maximumSize and expireAfterWrite, W-TinyLFU eviction), lru-cache in Node.js (max, ttl and a fetchMethod), MemoryCache with a SizeLimit in .NET. It holds at most {{LOCAL_MAX_ENTRIES}} entries per instance, each for at most {{TTL_SECONDS}} seconds. Loads go through the cache\'s own loader (Caffeine get with a mapping function or a LoadingCache; lru-cache fetch), never a get followed by a separate put. Invalidation: {{INVALIDATION}}; with several instances, an entry removed on a change is removed in every instance by a broadcast each instance subscribes to (Redis pub/sub or a fan-out topic of the broker), within {{INVALIDATE_SECONDS}} seconds of the commit. Concurrent misses for one key: {{STAMPEDE}}. Decisions that write read the store inside their transaction, never the cache. The staleness the TTL allows must fit the read decision of the Data consistency pack.',
      consequences: '• The fastest hit there is: no network and no serialisation.\n• One copy per instance: memory times the instances, one miss per instance per key, and a new instance starts cold.\n• Instances may disagree until a removal reaches all of them, or the TTL passes.\n• The cache lives in the process\'s memory: its bound is what keeps it from growing the heap until the instance dies.\n• Nothing to run outside the process, and no cache outage to design for.',
      alternatives: '1. A shared cache (Redis or Valkey): one copy for all instances, at the cost of a store and a hop.\n2. HTTP caching at the edge: nothing in the element, but only for responses that are the same for everyone.\n3. Both tiers, an in-process cache in front of a shared one: fewer hops, two layers to invalidate; added when measurements show the shared cache\'s round trip matters.',
    },
    {
      id: 'adr-none', label: 'No cache', when: { WHERE: ['none'] },
      context: `${FORCES} Here the store meets the latency budget and carries the reads, so a second copy would add staleness and a failure mode for nothing.`,
      decision: 'No cache stands between this element and its store: every read goes to the store as the Data consistency pack\'s read decision says, and no code keeps copies of the store\'s data between requests (no Redis for data, no in-process cache, no memoised query results). HTTP responses still say how browsers and proxies may keep them: Cache-Control on every GET, private or no-store for personal data. Revisit when the reads exceed the latency budget of the Capacity and scaling pack or the store\'s capacity; adding a cache supersedes this decision.',
      consequences: '• No stale data, nothing to invalidate, and no second store to run or to fail.\n• Every read costs a store round trip, and the store carries the whole read load: scaling reads means replicas (the Data consistency pack) or a bigger store.\n• The first cache needs this decision superseded, which brings its staleness and failure mode into the open.',
      alternatives: '1. A shared cache (Redis or Valkey) with cache-aside.\n2. An in-process cache in each instance.\n3. HTTP caching at the edge, for responses that are the same for everyone.',
    },
  ],
  fitness: [
    {
      id: 'ff-cache-control', label: 'Cache headers right on every route', characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-edge', 'adr-shared', 'adr-local', 'adr-none'], checks: ['req-cache-control', 'req-expiry', 'req-conditional'],
      threshold: '100% of GET routes answer with Cache-Control; personal routes private or no-store and never public; every response a shared cache may keep has an ETag, a lifetime of at most {{TTL_SECONDS}} seconds and answers If-None-Match with 304',
      description: 'A test lists the GET routes from the router\'s table (not from a list kept by hand), calls each as a signed-in user and reads its Cache-Control. A route on the personal list must be private or no-store; a response marked for shared caches (public or s-maxage) must carry an ETag and a lifetime, s-maxage (or max-age) plus stale-while-revalidate, within the TTL, and a second request with its ETag must get 304. A new route without a policy fails the test in its pull request.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack: JUnit with MockMvc, xUnit with WebApplicationFactory)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app, routes } from '../src/app'               // routes: the router's table, each with an example path
import { PERSONAL } from '../src/http/cachePolicy'     // the GET routes whose answers carry personal data or depend on the caller
import { signIn } from './cache/fixtures'

const TTL_SECONDS = {{TTL_SECONDS}}
const token = await signIn()
const seconds = (cc: string, name: string) => Number(cc.split(',').map((d) => d.trim()).find((d) => d.startsWith(\`\${name}=\`))?.slice(name.length + 1) ?? NaN)

describe.each(routes.filter((r) => r.method === 'GET'))('GET $path', (route) => {
  it('says who may keep the answer, and for how long', async () => {
    const res = await request(app).get(route.example).set('Authorization', \`Bearer \${token}\`).expect(200)
    const cc = String(res.headers['cache-control'] ?? '')
    expect(cc, 'an explicit Cache-Control').not.toBe('')
    if (PERSONAL.has(route.path)) {
      expect(cc).toMatch(/\\b(private|no-store)\\b/)
      return expect(cc).not.toMatch(/\\bpublic\\b|s-maxage/)
    }
    if (!/\\bpublic\\b|s-maxage/.test(cc)) return       // not for shared caches
    const fresh = Number.isNaN(seconds(cc, 's-maxage')) ? seconds(cc, 'max-age') : seconds(cc, 's-maxage')
    expect(fresh + (seconds(cc, 'stale-while-revalidate') || 0)).toBeLessThanOrEqual(TTL_SECONDS)
    expect(res.headers.etag, 'an ETag to revalidate with').toBeTruthy()
    await request(app).get(route.example).set('Authorization', \`Bearer \${token}\`).set('If-None-Match', res.headers.etag).expect(304)
  })
})`,
    },
    {
      id: 'ff-no-cache', label: 'No cache arrives unannounced', when: { WHERE: ['none'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-none'], checks: ['req-no-cache'],
      threshold: '0 modules under src, outside the modules other decisions give a Redis of their own, import a cache client or an in-process cache library',
      description: 'A dependency rule fails the build when code under src imports a Redis, Valkey or Memcached client or an in-process cache library, which would mean a cache arrived without its decision. The modules that keep idempotency keys, rate-limit counters or sessions in a Redis by other decisions are left out by path.',
      tool: 'dependency-cruiser (or the equivalent for your stack: an ArchUnit rule forbidding com.github.benmanes.caffeine, io.lettuce, redis.clients.jedis and org.springframework.cache)',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'no-cache',
    comment: 'ADR No cache: supersede it before keeping copies of the store\\'s data. Redis for idempotency keys, rate limits and sessions is decided elsewhere.',
    severity: 'error',
    from: { path: '^src/', pathNot: '^src/(idempotency|rate-limit|sessions)/' },
    to: { path: '^node_modules/(ioredis|redis|iovalkey|memjs|memcached|lru-cache|node-cache|keyv|cache-manager|@redis/[^/]+|@valkey/[^/]+|@keyv/[^/]+|@isaacs/ttlcache)/' },
  }],
}`,
    },
    {
      id: 'ff-shared-config', label: 'Cache Redis bounded, every key expiring', when: { WHERE: ['shared'] }, characteristic: 'reliability', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: ['adr-shared'], checks: ['req-shared-own', 'req-expiry'],
      threshold: 'maxmemory above 0 and maxmemory-policy allkeys-lru or allkeys-lfu; 0 cache keys without an expiry or with more than {{TTL_SECONDS}} seconds left',
      description: 'A script run after every deploy and hourly by the monitoring job reads the cache\'s memory settings with INFO memory (which managed services allow where CONFIG GET is disabled) and scans the cache keys without blocking Redis (SCAN), failing on a key with no expiry or a longer one.',
      tool: 'redis-cli in a shell step (REDIS_URL points at the cache\'s own Redis or Valkey; valkey-cli takes the same arguments)',
      language: 'bash',
      snippet: `set -euo pipefail
info=$(redis-cli -u "$REDIS_URL" --raw INFO memory | tr -d '\\r')
policy=$(awk -F: '$1 == "maxmemory_policy" { print $2 }' <<<"$info")
max=$(awk -F: '$1 == "maxmemory" { print $2 }' <<<"$info")
[[ "$policy" == allkeys-lru || "$policy" == allkeys-lfu ]] || { echo "eviction policy $policy: the cache needs allkeys-lru or allkeys-lfu"; exit 1; }
[ "$max" -gt 0 ] || { echo "maxmemory is 0: the cache grows until the host runs out of memory"; exit 1; }
bad=0
while read -r key; do
  ttl=$(redis-cli -u "$REDIS_URL" --raw TTL "$key" < /dev/null)
  [ "$ttl" -eq -2 ] && continue                                 # expired during the scan
  if [ "$ttl" -lt 0 ] || [ "$ttl" -gt {{TTL_SECONDS}} ]; then echo "$key: TTL $ttl"; bad=1; fi
done < <(redis-cli -u "$REDIS_URL" --scan --pattern 'cache:*')
exit $bad`,
    },
    {
      id: 'ff-local-bounded', label: 'In-process cache bounded in size and age', when: { WHERE: ['local'] }, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-local'], checks: ['req-local-bound', 'req-expiry'],
      threshold: 'The cache\'s bound is at most {{LOCAL_MAX_ENTRIES}} entries and its TTL above 0 and at most {{TTL_SECONDS}} seconds; after 1,000 more keys than the bound, it holds at most {{LOCAL_MAX_ENTRIES}}',
      description: 'A unit test builds the cache with its production settings from the one module that makes it, checks the bound and the TTL, then loads 1,000 more keys than the bound and checks that it evicted instead of growing.',
      tool: 'Vitest over lru-cache; for the JVM: JUnit over Caffeine, reading cache.policy().eviction() and cache.policy().expireAfterWrite()',
      language: 'ts',
      snippet: `import { expect, it } from 'vitest'
import { createProductCache } from '../src/cache/local'   // the in-process cache with its production settings (lru-cache)

const MAX_ENTRIES = {{LOCAL_MAX_ENTRIES}}
const TTL_SECONDS = {{TTL_SECONDS}}

it('is bounded in size and in age', () => {
  const cache = createProductCache()
  expect(cache.max).toBeLessThanOrEqual(MAX_ENTRIES)
  expect(cache.ttl).toBeGreaterThan(0)
  expect(cache.ttl).toBeLessThanOrEqual(TTL_SECONDS * 1000)
})

it('evicts instead of growing past the bound', async () => {
  const cache = createProductCache({ load: async (id: string) => ({ id }) })
  for (let i = 0; i < MAX_ENTRIES + 1000; i++) await cache.fetch(String(i))
  expect(cache.size).toBeLessThanOrEqual(MAX_ENTRIES)
})`,
    },
    {
      id: 'ff-invalidate', label: 'A change reaches every reader in time', when: { ...CACHED, INVALIDATION: ['delete', 'event'] }, characteristic: 'functional-suitability', scope: 'holistic', cadence: 'triggered', trigger: 'deploy', invocation: 'automated', implements: CACHE_ADRS, checks: ['req-invalidate'],
      threshold: 'Every reader (each instance, or the CDN) serves the changed value within {{INVALIDATE_SECONDS}} seconds of the write',
      description: 'An integration test against a deployed environment reads one product through every reader so that each has it cached, changes its price through the API, and polls every reader until it serves the new price, failing past the bound. With deletion by change events, a second run makes the change with SQL straight in the store, as a job or another service would, and expects the same.',
      tool: 'Vitest with fetch against the environment (READ_URLS lists each instance\'s own address, or the CDN\'s; for the JVM: JUnit with the HTTP client)',
      language: 'ts',
      snippet: `import { expect, it } from 'vitest'

const READ_URLS = process.env.READ_URLS!.split(',')     // every instance's own address, or the CDN's
const WRITE_URL = process.env.WRITE_URL!
const INVALIDATE_SECONDS = {{INVALIDATE_SECONDS}}
const price = (url: string) => fetch(\`\${url}/products/42\`).then((r) => r.json()).then((p) => p.price as number)

it('a committed change reaches every reader within the bound', async () => {
  const before = await Promise.all(READ_URLS.map(price))  // now cached by every reader
  const changed = before[0] + 1
  const write = await fetch(\`\${WRITE_URL}/products/42\`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: \`Bearer \${process.env.WRITER_TOKEN}\` },
    body: JSON.stringify({ price: changed }),
  })
  expect(write.ok).toBe(true)
  const committed = Date.now()
  for (const url of READ_URLS) {
    while ((await price(url)) !== changed) {
      expect(Date.now() - committed).toBeLessThan(INVALIDATE_SECONDS * 1000)
      await new Promise((r) => setTimeout(r, 200))
    }
  }
}, 60_000)`,
    },
    {
      id: 'ff-writes-bypass', label: 'Commands never read the cache', when: DATA, characteristic: 'functional-suitability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: DATA_ADRS, checks: ['req-writes-bypass'],
      threshold: '0 modules under src/commands that reach src/cache/read, directly or through other modules',
      description: 'A dependency rule follows every import from the operations that change data and fails the build when one of them reaches the cached reads. Removing entries after a write (src/cache/invalidate) stays allowed.',
      tool: 'dependency-cruiser (reachable rule); for the JVM: an ArchUnit rule that classes in ..commands.. do not depend on ..cache.read..',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'writes-decide-on-the-store',
    comment: 'ADR cache: a decision that writes reads the store inside its transaction, never a cached entry (src/cache/invalidate stays allowed)',
    severity: 'error',
    from: { path: '^src/commands/' },
    to: { path: '^src/cache/read', reachable: true },
  }],
  options: { tsConfig: { fileName: 'tsconfig.json' } },
}`,
    },
    {
      id: 'ff-coalesce', label: 'Concurrent misses read the store once', when: { ...DATA, STAMPEDE: ['coalesce'] }, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: DATA_ADRS, checks: ['req-coalesce'],
      threshold: '100 concurrent reads of one uncached key cause exactly 1 store read and return 1 value',
      description: 'A test forgets one key, starts 100 reads of it at once through the cached reads and counts the calls to the store. With a shared cache it runs against a Redis started by Testcontainers; with an in-process cache, against the cache itself.',
      tool: 'Vitest (vi.spyOn on the store reads); for the JVM: JUnit with Caffeine\'s AsyncLoadingCache or the Redis client of the decision',
      language: 'ts',
      snippet: `import { expect, it, vi } from 'vitest'
import { products } from '../src/cache/read'          // the cached reads: getOrLoad and forget
import { productStore } from '../src/catalog/store'   // the store reads a miss falls back to

it('100 concurrent misses for one key read the store once', async () => {
  const read = vi.spyOn(productStore, 'findById')
  await products.forget('42')                         // a cold key
  const answers = await Promise.all(Array.from({ length: 100 }, () => products.getOrLoad('42')))
  expect(read).toHaveBeenCalledTimes(1)
  expect(new Set(answers.map((p) => JSON.stringify(p))).size).toBe(1)
})`,
    },
    {
      id: 'ff-early', label: 'Hot entries refreshed just before expiry', when: { ...DATA, STAMPEDE: ['early'] }, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: DATA_ADRS, checks: ['req-early'],
      threshold: 'For an entry read every millisecond whose load took 50 ms, a refresh happens before expiry and less than 1 second before it',
      description: 'A unit test drives the early-refresh check with a read every millisecond across the entry\'s life and records the first read that refreshes it. With XFetch, the chance of a refresh more than 1 second (20 load times) early is about 50 times e to the minus 20, so the test is stable.',
      tool: 'Vitest; for the JVM: JUnit over the same check (Caffeine\'s refreshAfterWrite refreshes at a fixed age, not probabilistically, so the check is code of your own)',
      language: 'ts',
      snippet: `import { expect, it } from 'vitest'
import { refreshEarly } from '../src/cache/xfetch'   // true when now - delta * beta * ln(random()) >= expiry

it('refreshes a hot entry before it expires, and not long before', () => {
  const expiry = {{TTL_SECONDS}} * 1000
  const delta = 50                                  // the last load took 50 ms
  let refreshedAt: number | undefined
  for (let now = 0; now < expiry && refreshedAt === undefined; now += 1) {   // a read every millisecond
    if (refreshEarly({ now, expiry, delta, beta: 1 })) refreshedAt = now
  }
  expect(refreshedAt).toBeDefined()
  expect(expiry - refreshedAt!).toBeLessThan(1000)
})`,
    },
    {
      id: 'ff-cold-cache', label: 'The store carries the peak on a cold cache', when: { ...DATA, STAMPEDE: ['none'] }, characteristic: 'performance-efficiency', scope: 'holistic', cadence: 'temporal', every: '30d', invocation: 'automated', implements: DATA_ADRS, checks: ['req-cold'],
      threshold: 'With the cache emptied, 5 minutes at the peak read rate on 20 hot keys: errors under 0.1 % and the 95th percentile under the latency budget of the Capacity and scaling pack',
      description: 'The scheduled load job empties the cache (FLUSHDB on the cache\'s own Redis, or a rolling restart for in-process caches) and at once runs k6 at the peak rate against 20 hot keys, the shape that makes a stampede. PEAK_RPS and P95_MS come from the Capacity and scaling pack\'s decision.',
      tool: 'k6 (constant-arrival-rate executor and thresholds), run by the scheduled load job',
      language: 'js',
      snippet: `// load/cold-cache.js, run right after emptying the cache:
//   shared cache: redis-cli -u "$REDIS_URL" FLUSHDB; in-process caches: a rolling restart of the instances
import http from 'k6/http'

export const options = {
  scenarios: {
    cold: { executor: 'constant-arrival-rate', rate: Number(__ENV.PEAK_RPS), timeUnit: '1s', duration: '5m', preAllocatedVUs: 200, maxVUs: 1000 },
  },
  thresholds: {
    http_req_failed: ['rate<0.001'],
    http_req_duration: [\`p(95)<\${__ENV.P95_MS}\`],     // the latency budget of the Capacity and scaling pack
  },
}

export default function () {
  http.get(\`\${__ENV.BASE_URL}/products/\${1 + Math.floor(Math.random() * 20)}\`)   // 20 hot keys
}`,
    },
    {
      id: 'ff-down-store', label: 'Cache outage falls back within a limit', when: { WHERE: ['shared'], DOWN: ['store'] }, characteristic: 'reliability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-shared'], checks: ['req-down-store'],
      threshold: 'With the cache container stopped, 200 concurrent reads answer only 200 or 503 with Retry-After, at least one 200, and at most {{FALLBACK_CONCURRENCY}} store reads run at once',
      description: 'An integration test starts Redis in a container, builds the app on it, warms one key, stops the container and fires 200 reads at 50 keys. A probe around the store reads records how many ran at once.',
      tool: 'Vitest with supertest and Testcontainers (@testcontainers/redis); for the JVM: JUnit with Testcontainers and Resilience4j\'s CircuitBreaker and Bulkhead',
      language: 'ts',
      snippet: `import request from 'supertest'
import { expect, it } from 'vitest'
import { RedisContainer } from '@testcontainers/redis'
import { createApp } from '../src/app'             // the app, built on the given cache
import { storeProbe } from './cache/storeProbe'    // counts the store reads, and how many ran at once

const FALLBACK_CONCURRENCY = {{FALLBACK_CONCURRENCY}}

it('reads from the store, a limited number at a time, while the cache is down', async () => {
  const redis = await new RedisContainer('redis:7.4').start()
  const app = createApp({ cacheUrl: redis.getConnectionUrl() })
  await request(app).get('/products/1').expect(200)   // warms the cache
  await redis.stop()
  storeProbe.reset()
  const answers = await Promise.all(Array.from({ length: 200 }, (_, i) => request(app).get(\`/products/\${1 + (i % 50)}\`)))
  for (const a of answers) expect(a.status === 200 || (a.status === 503 && a.headers['retry-after'] !== undefined)).toBe(true)
  expect(answers.filter((a) => a.status === 200).length).toBeGreaterThan(0)
  expect(storeProbe.maxConcurrent()).toBeLessThanOrEqual(FALLBACK_CONCURRENCY)
}, 60_000)`,
    },
    {
      id: 'ff-down-fail', label: 'Cache outage refused fast', when: { WHERE: ['shared'], DOWN: ['fail'] }, characteristic: 'reliability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-shared'], checks: ['req-down-fail'],
      threshold: 'With the cache container stopped, a read is answered 503 with Retry-After within {{CACHE_TIMEOUT_MS}} ms plus 100 ms, and 0 store reads happen',
      description: 'An integration test starts Redis in a container, builds the app on it, warms one key, stops the container, then times one read and counts the store reads it caused.',
      tool: 'Vitest with supertest and Testcontainers (@testcontainers/redis); for the JVM: JUnit with Testcontainers',
      language: 'ts',
      snippet: `import request from 'supertest'
import { expect, it } from 'vitest'
import { RedisContainer } from '@testcontainers/redis'
import { createApp } from '../src/app'             // the app, built on the given cache
import { storeProbe } from './cache/storeProbe'    // counts the store reads

const CACHE_TIMEOUT_MS = {{CACHE_TIMEOUT_MS}}

it('refuses reads at once while the cache is down, sparing the store', async () => {
  const redis = await new RedisContainer('redis:7.4').start()
  const app = createApp({ cacheUrl: redis.getConnectionUrl() })
  await request(app).get('/products/1').expect(200)   // warms the cache
  await redis.stop()
  storeProbe.reset()
  const started = Date.now()
  const res = await request(app).get('/products/2')
  expect(res.status).toBe(503)
  expect(res.headers['retry-after']).toBeDefined()
  expect(Date.now() - started).toBeLessThan(CACHE_TIMEOUT_MS + 100)
  expect(storeProbe.total()).toBe(0)
}, 60_000)`,
    },
    {
      id: 'ff-hit-ratio', label: 'Hit ratio watched', when: DATA, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: DATA_ADRS, checks: ['req-hit-ratio'],
      threshold: 'An alert opens a ticket when the share of lookups answered from the cache over the last hour stays below {{HIT_RATIO}} % for 15 minutes',
      description: 'Prometheus computes the hit ratio over an hour. For a shared cache, from redis_exporter\'s keyspace counters of the cache\'s own Redis (meaningful because nothing else uses it); for an in-process cache, from the cache.gets meter that Micrometer\'s Caffeine binder exports (in Node.js, a prom-client counter of the same name and labels). Keep the rule of the cache the decision names.',
      tool: 'Prometheus alerting rules over redis_exporter (shared cache) or Micrometer\'s CaffeineCacheMetrics (in-process cache)',
      language: 'yaml',
      snippet: `groups:
  - name: cache
    rules:
      - alert: SharedCacheHitRatioLow        # the cache's own Redis or Valkey, scraped by redis_exporter
        expr: |
          sum by (instance) (rate(redis_keyspace_hits_total[1h]))
            / (sum by (instance) (rate(redis_keyspace_hits_total[1h])) + sum by (instance) (rate(redis_keyspace_misses_total[1h])))
            < {{HIT_RATIO}} / 100
        for: 15m
        labels: { severity: ticket }
        annotations:
          summary: "Cache {{ $labels.instance }} answers only {{ $value | humanizePercentage }} of lookups"
      - alert: LocalCacheHitRatioLow         # Micrometer's Caffeine binder: cache_gets_total{cache, result="hit"|"miss"}
        expr: |
          sum by (cache) (rate(cache_gets_total{result="hit"}[1h])) / sum by (cache) (rate(cache_gets_total[1h])) < {{HIT_RATIO}} / 100
        for: 15m
        labels: { severity: ticket }
        annotations:
          summary: "In-process cache {{ $labels.cache }} answers only {{ $value | humanizePercentage }} of lookups"`,
    },
  ],
}

export default pack
