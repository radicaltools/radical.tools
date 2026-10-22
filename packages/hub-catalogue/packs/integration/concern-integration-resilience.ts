import type { PackSpec } from '../../src/packSpec'

const OUTAGE_ADRS = ['adr-fail', 'adr-degrade', 'adr-defer']
const PROTECTION_ADRS = ['adr-library', 'adr-mesh']
const FORCES = 'This element calls systems it does not run: payment, e-mail, maps, partners. The forces: they are slow or down at times, and a call without a timeout holds a thread or a connection until everything behind it stops; most failures are brief, so a retry often succeeds, but retries sent at once by every instance turn a hiccup into an overload (the thundering herd); a timeout does not say whether the other side did the work, so retrying a call that changes something can do it twice; calling a system that is down wastes time and keeps it down; and the user has to be told something true and useful while it is down.'

const pack: PackSpec = {
  id: 'concern-integration-resilience',
  name: 'Integration resilience',
  group: 'integration',
  description: 'Calls to systems outside your control: how long to wait, when and how to try again, how not to do anything twice, when to stop calling, and what the user gets while the other side is down.',
  tags: ['reliability', 'integration', 'timeouts', 'retries', 'backoff', 'idempotency', 'circuit-breaker', 'resilience4j', 'polly'],
  concern: {
    id: 'integration-resilience',
    trigger: 'LIST RELATIONS WHERE source.external != true AND target.external = true AND (source.type = "system" OR source.type = "container" OR source.type = "webapp" OR source.type = "component")',
    applyTo: 'source',
    why: 'these elements call systems outside your control, so what happens when those are slow, down or answer twice has to be decided.',
  },
  sources: [
    { title: 'AWS Builders\' Library, Timeouts, retries, and backoff with jitter', url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/' },
    { title: 'AWS Builders\' Library, Making retries safe with idempotent APIs', url: 'https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/' },
    { title: 'RFC 9110, HTTP Semantics (9.2 safe and idempotent methods, 10.2.3 Retry-After)', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
    { title: 'microservices.io, Circuit Breaker', url: 'https://microservices.io/patterns/reliability/circuit-breaker.html' },
    { title: 'IETF draft, The Idempotency-Key HTTP Header Field', url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/' },
    { title: 'Azure Architecture Center, Circuit Breaker pattern', url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker' },
  ],
  questions: [
    {
      key: 'FAILURE', title: 'When it is down', label: 'What happens to the user\'s action while the outside system is down?',
      hint: 'Every outside system is down sometimes. This also decides whether the call is made while the user waits (fail, degrade) or later from a queue (defer).',
      default: 'fail',
      options: [
        { value: 'fail', label: 'it fails fast and clearly', description: 'The call is made while the user waits; when the system is down the action is refused at once as temporary, with nothing half done, and the user tries again later. Pick it when the action is worthless without the answer (a payment authorisation, a live price) and a later retry by the user is acceptable.' },
        { value: 'degrade', label: 'it goes on with less', description: 'The call is made while the user waits; when the system is down the answer comes from a recent cache or a default, marked incomplete. Pick it for reads whose outside part is nice to have or changes slowly: recommendations, shipping estimates, exchange rates, an address check.' },
        { value: 'defer', label: 'it is accepted and completed later', description: 'The action is stored and the call is made from a queue, so the user does not wait for the outside system; it completes once the system is back and the user is told. Pick it for actions that must not be lost but need not finish now: sending to a partner, booking, e-mail, invoicing.' },
      ],
    },
    {
      key: 'PROTECTION', title: 'Where', label: 'Where do timeouts, retries and circuit breakers live?',
      hint: 'In the code they can see the call (is it safe to repeat? what is the fallback?); in the mesh they are the same for every service and language.',
      default: 'library',
      options: [
        { value: 'library', label: 'a resilience library in the code', description: 'One client per outside system wraps its calls in the library\'s pipeline: Resilience4j (JVM), Polly or Microsoft.Extensions.Http.Resilience (.NET), cockatiel (Node.js), failsafe-go. Pick it when calls need fallbacks or idempotency logic, or there is no service mesh.' },
        { value: 'mesh', label: 'the service mesh, in configuration', description: 'Timeouts, retries and outlier detection (the mesh\'s circuit breaker) are set per outside host in Istio or Linkerd configuration, the same for every language. Pick it when a mesh already carries all traffic on Kubernetes and many services in several languages call the same outside systems; fallbacks stay in the code.' },
      ],
    },
    {
      key: 'IDEMPOTENCY', title: 'Repeats', label: 'How is a repeated call kept from doing something twice?',
      hint: 'A timeout does not say whether the other side did the work. What the outside system offers decides how a retry stays safe.',
      default: 'keys',
      options: [
        { value: 'keys', label: 'idempotency keys', description: 'Every call that changes something carries an Idempotency-Key the outside system remembers, so a repeat returns the first result (Stripe, Adyen, PayPal and most payment APIs). Pick it when the outside system accepts such a key.' },
        { value: 'lookup', label: 'a lookup before each retry', description: 'Every change carries our own reference; after a timeout the client asks the outside system whether a change with that reference exists before trying again. Pick it when the outside system takes no idempotency key but can be queried by a reference you send.' },
        { value: 'readonly', label: 'only reads, nothing to repeat', description: 'The element only reads from outside systems (GET and other safe methods), so every call may be retried. Pick it when no call changes anything outside; a call that does needs this decision revisited.' },
      ],
    },
  ],
  details: [
    { key: 'TIMEOUT_MS', label: 'After how many milliseconds does one call give up?', default: '2000', number: true },
    { key: 'RETRIES', label: 'How many times at most is a failed call retried?', default: '3', number: true },
    { key: 'BACKOFF_MS', label: 'What is the first retry delay (milliseconds), doubled each time?', default: '200', number: true },
    { key: 'BREAKER_PERCENT', label: 'Above what percentage of failed calls does the circuit open?', default: '50', number: true },
    { key: 'DEADLINE_MS', label: 'How long at most does a waiting user wait, retries included (milliseconds)?', default: '5000', number: true },
    { key: 'STALE_MINUTES', label: 'How old may a cached answer be when shown instead (minutes)?', default: '60', number: true },
    { key: 'DEFER_HOURS', label: 'Within how many hours must a deferred action complete?', default: '24', number: true },
  ],
  need: {
    label: 'Outages outside stay outside',
    text: 'The system depends on systems it does not run: payment, e-mail, maps, partners. They are slow or down at times, and their answers get lost on the way. Without decisions, one slow partner holds every thread, retries make a charge twice or pile onto a system that is already struggling, and users see errors, or wait without end, for something that could have waited or come from a cache.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-timeout', label: 'Calls time out', ears_type: 'ubiquitous',
      action: 'give every call to an outside system a connect timeout of at most 1000 ms and a total timeout of {{TIMEOUT_MS}} ms, and make no call without them',
      rationale: 'A call without a timeout turns the other side\'s outage into ours: threads and connections wait until nothing is left (AWS Builders\' Library, Timeouts, retries and backoff with jitter).',
      scenario: { label: 'Slow partner cut off', given: 'an outside system that answers after a minute', when: 'it is called', then: 'the call gives up after {{TIMEOUT_MS}} ms and the thread is free again' },
    },
    {
      id: 'req-retry', label: 'Transient failures retried', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a call to an outside system times out, has its connection refused or reset, or is answered 429, 502, 503 or 504',
      action: 'retry it at most {{RETRIES}} times with exponential backoff and full jitter starting at {{BACKOFF_MS}} ms, wait at least as long as a Retry-After header asks, and never retry any other 4xx answer',
      rationale: 'Most failures are brief, so a retry often succeeds; jitter keeps every instance from retrying at the same moment, and a 4xx other than 408 and 429 will fail the same way again (AWS Builders\' Library; RFC 9110 10.2.3).',
      scenario: { label: 'Brief failure absorbed', given: 'an outside system that answers 503 once and then 200', when: 'it is called, and then a system that always answers 503, and one that answers 400', then: 'the first call succeeds on its first retry; the second gives up after {{RETRIES}} retries with unequal delays; the third is not retried' },
    },
    {
      id: 'req-breaker', label: 'Failing systems left alone', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'more than {{BREAKER_PERCENT}} % of at least 20 calls to one outside system within 30 seconds fail or time out',
      action: 'stop calling it for 30 seconds (open the circuit), treat each call in that time as if the system were down, then let 3 trial calls through and resume only when they succeed',
      rationale: 'Calling a system that is down wastes the caller\'s time and keeps the other side down; the breaker fails at once and probes for recovery (microservices.io, Circuit Breaker; Azure Architecture Center).',
      scenario: { label: 'Calls paused', given: 'an outside system that fails every call', when: '20 calls have failed within 30 seconds and more are made', then: 'the further calls fail at once without reaching it, and after 30 seconds 3 trial calls do' },
    },
    {
      id: 'req-fail', label: 'Outage refused cleanly', when: { FAILURE: ['fail'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an action needs an outside system that is down or whose circuit is open',
      action: 'refuse the action within {{DEADLINE_MS}} ms, retries included, with an answer that says it is temporary (503 with Retry-After for an API), and leave nothing half done',
      rationale: 'A clear refusal in bounded time beats a spinner and a half-done action; Retry-After tells callers when to come back (RFC 9110 15.6.4).',
      scenario: { label: 'Clean refusal', given: 'the outside system down', when: 'the user starts an action that needs it', then: 'within {{DEADLINE_MS}} ms the action is refused as temporary and nothing has changed' },
    },
    {
      id: 'req-degrade', label: 'Answers with less', when: { FAILURE: ['degrade'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an outside system an answer uses is down or its circuit is open',
      action: 'answer within {{DEADLINE_MS}} ms from data cached no more than {{STALE_MINUTES}} minutes ago, or from a default when there is none, and mark the answer as incomplete',
      rationale: 'Most of the value survives without the outside part; marking it keeps a stale or default value from being taken as current.',
      scenario: { label: 'Partial answer', given: 'the outside system down and its answer cached 10 minutes ago', when: 'the user opens a page that uses it', then: 'the page shows within {{DEADLINE_MS}} ms with the cached part marked as not current' },
    },
    {
      id: 'req-degrade-writes', label: 'Changes still refused', when: { FAILURE: ['degrade'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an action that changes something needs an outside system that is down',
      action: 'refuse it within {{DEADLINE_MS}} ms as temporary, leaving nothing half done, rather than completing it from cached data',
      rationale: 'A cache can stand in for a read, never for a change the other side has to make.',
      scenario: { label: 'No change from cache', given: 'the outside system down', when: 'the user starts an action that changes something there', then: 'it is refused as temporary and nothing has changed on either side' },
    },
    {
      id: 'req-defer', label: 'Accepted, completed later', when: { FAILURE: ['defer'] }, ears_type: 'event-driven',
      trigger: 'a user starts an action that needs an outside system',
      action: 'store the action durably before answering, answer within {{DEADLINE_MS}} ms with a reference to follow it by (202 for an API), and make the call from a queue, telling the user when it completes',
      rationale: 'The user\'s intent is kept whatever the outside system does; the queue absorbs its outages and its slowness.',
      scenario: { label: 'Done once it is back', given: 'the outside system down', when: 'the user starts an action that needs it, and the system comes back an hour later', then: 'the action is accepted with a reference at once, completes after the system is back, and the user is told' },
    },
    {
      id: 'req-defer-expire', label: 'Stuck work surfaced', when: { FAILURE: ['defer'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a deferred action has not completed within {{DEFER_HOURS}} hours',
      action: 'stop retrying it, move it to a dead-letter queue, tell the user it did not complete, and alert the owner of the integration',
      rationale: 'Deferred work that retries for ever hides an outage and a promise broken to the user (Enterprise Integration Patterns, Dead Letter Channel).',
      scenario: { label: 'Gives up visibly', given: 'an outside system down for longer than {{DEFER_HOURS}} hours', when: 'a deferred action has waited {{DEFER_HOURS}} hours', then: 'it is in the dead-letter queue, the user is told, and the owner is alerted' },
    },
    {
      id: 'req-idem-key', label: 'Repeats carry one key', when: { IDEMPOTENCY: ['keys'] }, ears_type: 'ubiquitous',
      action: 'send an Idempotency-Key with every call that changes something in an outside system: one key per intended change, the same on every retry of it, stored with the change for at least 24 hours',
      rationale: 'A timeout does not say whether the other side acted; the key makes the retry return the first result instead of acting again (IETF Idempotency-Key header draft; AWS Builders\' Library, Making retries safe).',
      scenario: { label: 'Charge made once', given: 'a payment call whose answer is lost', when: 'it is retried', then: 'the retry carries the same key, and the customer is charged once' },
    },
    {
      id: 'req-idem-lookup', label: 'Look up before repeating', when: { IDEMPOTENCY: ['lookup'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a call that changes something in an outside system times out or its answer is lost',
      action: 'look the change up there by the reference we sent with it, and repeat the call only when no change with that reference exists',
      rationale: 'Without an idempotency key, asking is the only way to know whether a lost call took effect (AWS Builders\' Library, Making retries safe).',
      scenario: { label: 'Lost answer not repeated', given: 'a booking call that took effect but whose answer was lost', when: 'the client recovers from the timeout', then: 'it finds the booking by our reference and does not book again' },
    },
    {
      id: 'req-readonly', label: 'Only safe calls', when: { IDEMPOTENCY: ['readonly'] }, ears_type: 'ubiquitous',
      action: 'call outside systems only with safe methods (GET, HEAD, OPTIONS, or the read-only operations of the API), so that every call may be retried',
      rationale: 'Safe methods change nothing on the other side, so retries need no protection (RFC 9110 9.2.1).',
      scenario: { label: 'Reads only', given: 'every client of an outside system in the code', when: 'the calls they make are listed', then: 'each uses a safe method' },
    },
    {
      id: 'req-library', label: 'One guarded client', when: { PROTECTION: ['library'] }, ears_type: 'ubiquitous',
      action: 'make every call to an outside system through one client per system that applies its timeout, retries and circuit breaker, so that no other code calls it directly',
      rationale: 'Rules applied call by call are forgotten on the next call; one guarded client per system makes them hold everywhere.',
      scenario: { label: 'Direct call refused', given: 'the code base', when: 'a module outside the integration clients opens an HTTP connection to an outside host', then: 'the architecture check fails the build' },
    },
    {
      id: 'req-mesh', label: 'Guarded by the mesh', when: { PROTECTION: ['mesh'] }, ears_type: 'ubiquitous',
      action: 'route every call to an outside system through the mesh, with a timeout, retries and outlier detection configured for its host in the repository, and allow no egress to a host without them',
      rationale: 'In the mesh, the rules are the same for every language and visible in one place; a host without them is an unguarded call.',
      scenario: { label: 'Unguarded host refused', given: 'the mesh configuration in the repository', when: 'an outside host is added without a timeout, retries or outlier detection', then: 'the configuration check fails the pull request' },
    },
  ],
  adrs: [
    {
      id: 'adr-fail', label: 'Outside outages fail fast', when: { FAILURE: ['fail'] },
      decision: 'Calls to outside systems are made while the user waits. Each gives up after {{TIMEOUT_MS}} ms; transient failures are retried at most {{RETRIES}} times with exponential backoff and full jitter from {{BACKOFF_MS}} ms, within a deadline of {{DEADLINE_MS}} ms for the whole action; a circuit breaker per outside system opens above {{BREAKER_PERCENT}} % failures. Repeated calls: {{IDEMPOTENCY}}. While a system is down or its circuit open, an action that needs it is refused at once as temporary (503 with Retry-After), with nothing half done. Choose it over degrading when the action is worthless without the answer.',
      consequences: '• Outages are short and visible to the user; nothing is left half done.\n• The user has to come back and try again; some will not.\n• The deadline bounds how long anyone waits, so retries are few by design.',
      alternatives: '1. Go on with less from a cache or defaults: more available for reads, more code, stale data.\n2. Accept and complete later from a queue: nothing refused, but the user waits for the result.\n3. No timeouts or breakers: simplest, until one slow partner stops everything.',
    },
    {
      id: 'adr-degrade', label: 'Outside outages degrade gracefully', when: { FAILURE: ['degrade'] },
      decision: 'Calls to outside systems are made while the user waits. Each gives up after {{TIMEOUT_MS}} ms; transient failures are retried at most {{RETRIES}} times with exponential backoff and full jitter from {{BACKOFF_MS}} ms, within a deadline of {{DEADLINE_MS}} ms; a circuit breaker per outside system opens above {{BREAKER_PERCENT}} % failures. Repeated calls: {{IDEMPOTENCY}}. Every read has a fallback: the last good answer, cached for up to {{STALE_MINUTES}} minutes (Redis, Caffeine, or the HTTP cache with stale-if-error), or a default; the answer is marked incomplete. Changes that need the outside system are refused as temporary. Choose it for reads whose outside part is nice to have or changes slowly.',
      consequences: '• Users keep working through outages, with a visible note that part of the answer is not current.\n• Every read call needs a fallback, written and tested; a cache to size and expire.\n• Stale data must be safe to show for {{STALE_MINUTES}} minutes; prices and stock rarely are.',
      alternatives: '1. Fail fast: simpler, less available.\n2. Accept and complete later: for actions rather than reads.\n3. Prefetch everything into our own store: always available, but a copy to keep in sync.',
    },
    {
      id: 'adr-defer', label: 'Outside work completed later', when: { FAILURE: ['defer'] },
      decision: 'Actions that need an outside system are stored durably (an outbox or a job table in the same transaction as the action) and answered at once with a reference; a worker makes the call from a queue (the broker in use, or a job runner such as Hangfire, Sidekiq, BullMQ or Temporal). Each call gives up after {{TIMEOUT_MS}} ms; transient failures are retried at once at most {{RETRIES}} times with exponential backoff and full jitter from {{BACKOFF_MS}} ms, then again with backoff capped at 15 minutes until {{DEFER_HOURS}} hours have passed, when the action goes to a dead-letter queue, the user is told and the owner alerted. A circuit breaker per outside system opens above {{BREAKER_PERCENT}} % failures and pauses the worker. Repeated calls: {{IDEMPOTENCY}}.',
      consequences: '• No action is lost to an outage, and the user never waits on the outside system.\n• The user learns the outcome later: the interface must show work in progress and notify.\n• A queue and workers to run and watch, with a dead-letter path and an owner for it.',
      alternatives: '1. Fail fast while the user waits: simpler, but the action is lost when the system is down.\n2. Go on with less: for reads, not for actions that must happen.\n3. A workflow engine (Temporal, AWS Step Functions) for multi-step integrations: durable retries and timers built in, one more platform.',
    },
    {
      id: 'adr-library', label: 'Resilience in a library per client', when: { PROTECTION: ['library'] },
      decision: 'Each outside system has one client in the code, the only code that calls it, and every call goes through the resilience pipeline of the stack\'s library: Resilience4j (TimeLimiter, Retry with exponential random backoff, CircuitBreaker, Bulkhead) on the JVM, Microsoft.Extensions.Http.Resilience (Polly v8) in .NET, cockatiel in Node.js, failsafe-go in Go. Settings come from configuration per outside system: timeout {{TIMEOUT_MS}} ms, at most {{RETRIES}} retries from {{BACKOFF_MS}} ms, circuit open above {{BREAKER_PERCENT}} %. The client knows which calls are safe to repeat and holds the fallback. The library\'s metrics (calls, retries, breaker state) are exported. Choose a library when calls need fallbacks or idempotency logic, or there is no mesh.',
      consequences: '• The rules sit next to the call, which knows whether it may be repeated and what to do instead.\n• One library per language: each stack configures and tests it on its own.\n• A client per outside system is code to keep; an architecture rule keeps others from bypassing it.',
      alternatives: '1. The service mesh: the same rules for every language in configuration, but blind to idempotency and fallbacks.\n2. An API gateway for outgoing calls: one place for all, one more hop and owner.\n3. Hand-written retry loops: no dependency, and every one slightly different.',
    },
    {
      id: 'adr-mesh', label: 'Resilience in the service mesh', when: { PROTECTION: ['mesh'] },
      decision: 'Every outside host is declared to the mesh (Istio ServiceEntry, or Linkerd with an egress policy) and gets, in configuration kept in the repository: a timeout of {{TIMEOUT_MS}} ms, at most {{RETRIES}} retries on connect-failure, refused-stream, reset and 503 (and on other failures only for safe methods), and outlier detection that ejects the host for 30 seconds after consecutive 5xx (the mesh\'s circuit breaker). Egress to hosts not declared is blocked (outboundTrafficPolicy REGISTRY_ONLY). The code keeps what the mesh cannot know: idempotency ({{IDEMPOTENCY}}) and fallbacks. Choose the mesh when it already carries all traffic and many services in several languages call the same outside systems.',
      consequences: '• The same rules for every service and language, changed without a release.\n• The mesh retries without knowing whether a call is safe to repeat: retries on other failures stay limited to safe methods, and the code still sends idempotency protection.\n• Jitter and retry budgets are the mesh\'s (Envoy), not tuned per call.\n• Debugging spans the application and the sidecar.',
      alternatives: '1. A resilience library in each client: aware of idempotency and fallbacks, one per language.\n2. An egress gateway only: one place to watch, but a shared bottleneck.',
    },
  ],
  fitness: [
    {
      id: 'ff-timeout', label: 'Slow calls cut off', category: 'operational', implements: OUTAGE_ADRS,
      threshold: 'With 10 s of latency injected on each outside system, every call gives up within {{TIMEOUT_MS}} ms + 10 % per try, and no user action waits longer than {{DEADLINE_MS}} ms',
      description: 'An integration test puts a Toxiproxy proxy in front of each outside system (or its sandbox stub), adds a latency toxic far above the timeout, and measures how long each call and each user action takes.',
      tool: 'Toxiproxy (Testcontainers module) with Vitest',
      language: 'ts',
      snippet: `import { ToxiProxyContainer } from '@testcontainers/toxiproxy'

it('gives up on a slow partner in time', async () => {
  const toxiproxy = await new ToxiProxyContainer('ghcr.io/shopify/toxiproxy:2.9.0').start()
  const proxy = await toxiproxy.createProxy({ name: 'partner', upstream: 'partner-stub:8080' })
  await proxy.instance.addToxic({ type: 'latency', name: 'slow', stream: 'downstream', toxicity: 1, attributes: { latency: 10_000 } })
  const client = partnerClient('http://' + proxy.host + ':' + proxy.port)   // the production client and settings

  const started = Date.now()
  await expect(client.getQuote(SAMPLE)).rejects.toThrow()
  expect(Date.now() - started).toBeLessThan({{DEADLINE_MS}})
})`,
    },
    {
      id: 'ff-retry', label: 'Retries bounded and jittered', category: 'structural', implements: OUTAGE_ADRS,
      threshold: 'Against a stub that always answers 503: exactly {{RETRIES}} + 1 attempts, delays not all equal; against 400: exactly 1 attempt',
      description: 'A test points the production client at a WireMock stub that always fails, counts the requests it received and their spacing, and repeats with an answer that must not be retried.',
      tool: 'WireMock (JUnit 5 extension; WireMock.Net or the WireMock container for other stacks)',
      language: 'java',
      snippet: `@WireMockTest
class PartnerRetryTest {
  static final int RETRIES = {{RETRIES}};

  @Test
  void retriesTransientFailuresAFewTimesWithJitter(WireMockRuntimeInfo wm) {
    stubFor(get(urlPathEqualTo("/quotes")).willReturn(serviceUnavailable()));
    var client = PartnerClient.create(wm.getHttpBaseUrl());   // production settings
    assertThrows(PartnerUnavailableException.class, () -> client.quote(SAMPLE));
    var requests = findAll(getRequestedFor(urlPathEqualTo("/quotes")));
    assertEquals(RETRIES + 1, requests.size());
    var gaps = IntStream.range(1, requests.size())
        .mapToObj(i -> requests.get(i).getLoggedDate().getTime() - requests.get(i - 1).getLoggedDate().getTime())
        .distinct().count();
    assertTrue(gaps > 1, "delays are jittered");
  }

  @Test
  void doesNotRetryAClientError(WireMockRuntimeInfo wm) {
    stubFor(get(urlPathEqualTo("/quotes")).willReturn(badRequest()));
    assertThrows(PartnerRejectedException.class, () -> PartnerClient.create(wm.getHttpBaseUrl()).quote(SAMPLE));
    verify(exactly(1), getRequestedFor(urlPathEqualTo("/quotes")));
  }
}`,
    },
    {
      id: 'ff-breaker', label: 'Circuit opens and recovers', category: 'operational', implements: PROTECTION_ADRS,
      threshold: 'After 20 failing calls within 30 s, 0 of the next 50 calls reach the outside system; after 30 s at most 3 trial calls do, and calls resume when they succeed',
      description: 'A black-box test against a running instance (with its library or its sidecar) points the outside host at a WireMock stub that fails, drives calls through the instance, and counts what reaches the stub before, during and after the open period.',
      tool: 'WireMock container with Testcontainers (JUnit 5)',
      language: 'java',
      snippet: `@Test
void circuitOpensThenProbes() throws Exception {
  wiremock.stubFor(get(anyUrl()).willReturn(serviceUnavailable()));
  for (int i = 0; i < 20; i++) app.get("/quote");               // calls through the instance under test
  wiremock.resetRequests();
  for (int i = 0; i < 50; i++) app.get("/quote");
  assertEquals(0, wiremock.findAll(getRequestedFor(anyUrl())).size(), "circuit is open");

  wiremock.stubFor(get(anyUrl()).willReturn(ok("{}")));
  Thread.sleep(30_000);
  app.get("/quote");
  assertEquals(200, app.get("/quote").statusCode(), "circuit closed after successful trials");
}`,
    },
    {
      id: 'ff-fail', label: 'Outage drill: refused cleanly', when: { FAILURE: ['fail'] }, category: 'operational', implements: ['adr-fail'],
      threshold: 'With each outside system down, every user action that needs it answers 503 with Retry-After within {{DEADLINE_MS}} ms, and 0 records are changed',
      description: 'An integration test cuts each outside system off with Toxiproxy, runs the actions that need it, and checks the answer, its time and that the database is unchanged.',
      tool: 'Toxiproxy (Testcontainers module) with Vitest and supertest',
      language: 'ts',
      snippet: `it('refuses an action cleanly while the partner is down', async () => {
  await partnerProxy.setEnabled(false)                     // Toxiproxy: the partner is unreachable
  const before = await snapshot(db)
  const started = Date.now()
  const res = await request(app).post('/orders').send(SAMPLE_ORDER)
  expect(res.status).toBe(503)
  expect(res.headers['retry-after']).toBeDefined()
  expect(Date.now() - started).toBeLessThan({{DEADLINE_MS}})
  expect(await snapshot(db)).toEqual(before)
})`,
    },
    {
      id: 'ff-degrade', label: 'Outage drill: answers with less', when: { FAILURE: ['degrade'] }, category: 'operational', implements: ['adr-degrade'],
      threshold: 'With each outside system down, every read that uses it answers within {{DEADLINE_MS}} ms from data at most {{STALE_MINUTES}} minutes old or a default, marked incomplete; 0 errors',
      description: 'An integration test warms the cache, cuts the outside system off with Toxiproxy, and checks that reads still answer, in time and marked incomplete, while changes are refused.',
      tool: 'Toxiproxy (Testcontainers module) with Vitest and supertest',
      language: 'ts',
      snippet: `it('answers from the cache, marked, while the partner is down', async () => {
  await request(app).get('/products/42').expect(200)       // warms the cache
  await partnerProxy.setEnabled(false)
  const started = Date.now()
  const res = await request(app).get('/products/42').expect(200)
  expect(Date.now() - started).toBeLessThan({{DEADLINE_MS}})
  expect(res.body.incomplete).toEqual(['shippingEstimate'])
  expect(res.body.shippingEstimate.asOfMinutesAgo).toBeLessThanOrEqual({{STALE_MINUTES}})
  await request(app).post('/products/42/reserve').expect(503)
})`,
    },
    {
      id: 'ff-defer', label: 'Outage drill: completed later', when: { FAILURE: ['defer'] }, category: 'operational', implements: ['adr-defer'],
      threshold: 'With the outside system down, every action is accepted with 202 within {{DEADLINE_MS}} ms and completes after it is back; 0 actions lost; an action older than {{DEFER_HOURS}} h is in the dead-letter queue',
      description: 'An integration test cuts the outside system off, starts actions, restarts the worker, brings the system back and waits for completion; a second test advances the clock past the deadline and expects the dead letter and the notices.',
      tool: 'Toxiproxy (Testcontainers module) with Vitest (fake timers for the deadline)',
      language: 'ts',
      snippet: `it('keeps the action and completes it once the partner is back', async () => {
  await partnerProxy.setEnabled(false)
  const res = await request(app).post('/bookings').send(SAMPLE_BOOKING).expect(202)
  await restartWorker()
  await partnerProxy.setEnabled(true)
  await waitFor(async () => (await request(app).get(res.body.statusUrl)).body.state === 'completed')
  expect(await partnerStub.bookings()).toHaveLength(1)
})`,
    },
    {
      id: 'ff-idem-key', label: 'Retries reuse the key', when: { IDEMPOTENCY: ['keys'] }, category: 'structural', implements: OUTAGE_ADRS,
      threshold: 'Every retried call that changes something carries the same Idempotency-Key as its first attempt; 0 changing calls without a key',
      description: 'A test makes the stub time out on the first attempt of each changing call and checks that all attempts carry one and the same Idempotency-Key.',
      tool: 'WireMock (JUnit 5 extension)',
      language: 'java',
      snippet: `@Test
void retriesCarryTheSameKey(WireMockRuntimeInfo wm) {
  stubFor(post("/payments").inScenario("lost").whenScenarioStateIs(STARTED)
      .willReturn(ok().withFixedDelay({{TIMEOUT_MS}} * 2)).willSetStateTo("answered"));
  stubFor(post("/payments").inScenario("lost").whenScenarioStateIs("answered").willReturn(ok("{}")));
  PartnerClient.create(wm.getHttpBaseUrl()).pay(SAMPLE_PAYMENT);
  var keys = findAll(postRequestedFor(urlEqualTo("/payments"))).stream()
      .map(r -> r.getHeader("Idempotency-Key")).distinct().toList();
  assertEquals(1, keys.size());
  assertNotNull(keys.get(0));
}`,
    },
    {
      id: 'ff-idem-lookup', label: 'Lookup before repeat', when: { IDEMPOTENCY: ['lookup'] }, category: 'structural', implements: OUTAGE_ADRS,
      threshold: 'After a lost answer to a changing call, the client looks the change up by its reference and repeats it 0 times when it exists',
      description: 'A test makes the stub take the change but time out, and checks that the client asks for the reference and sends the change only once.',
      tool: 'WireMock (JUnit 5 extension)',
      language: 'java',
      snippet: `@Test
void looksUpInsteadOfRepeating(WireMockRuntimeInfo wm) {
  stubFor(post("/bookings").willReturn(created().withFixedDelay({{TIMEOUT_MS}} * 2)));
  stubFor(get(urlPathEqualTo("/bookings")).withQueryParam("reference", matching(".+"))
      .willReturn(okJson("[{\\"id\\":\\"b-1\\"}]")));
  var booking = PartnerClient.create(wm.getHttpBaseUrl()).book(SAMPLE_BOOKING);
  assertEquals("b-1", booking.id());
  verify(exactly(1), postRequestedFor(urlEqualTo("/bookings")));
  verify(exactly(1), getRequestedFor(urlPathEqualTo("/bookings")));
}`,
    },
    {
      id: 'ff-readonly', label: 'Clients only read', when: { IDEMPOTENCY: ['readonly'] }, category: 'structural', implements: OUTAGE_ADRS,
      threshold: '0 calls with POST, PUT, PATCH or DELETE in the clients of outside systems',
      description: 'A Semgrep rule over the integration clients fails the build on a call with a method that changes something, which would mean this decision has to be revisited.',
      tool: 'Semgrep',
      language: 'yaml',
      snippet: `rules:
- id: outside-clients-only-read
  message: Outside systems are only read (ADR on integration resilience); a changing call needs idempotency protection first
  severity: ERROR
  languages: [typescript]
  paths: { include: ['src/integrations/'] }
  pattern-either:
    - pattern: $HTTP.post(...)
    - pattern: $HTTP.put(...)
    - pattern: $HTTP.patch(...)
    - pattern: $HTTP.delete(...)
    - pattern: 'fetch($URL, { ..., method: "$M", ... })'`,
    },
    {
      id: 'ff-library', label: 'No unguarded outside calls', when: { PROTECTION: ['library'] }, category: 'structural', implements: ['adr-library'],
      threshold: '0 classes outside the integration clients use an HTTP client; every client method is guarded by a retry and a circuit breaker',
      description: 'ArchUnit rules fail the build when code outside the integration package uses an HTTP client, or when a public method of an integration client lacks the Resilience4j annotations (NetArchTest does the same in .NET, dependency-cruiser in TypeScript).',
      tool: 'ArchUnit',
      language: 'java',
      snippet: `@AnalyzeClasses(packages = "com.acme.shop")
class OutsideCallsArchTest {
  @ArchTest
  static final ArchRule onlyClientsCallOut = noClasses()
      .that().resideOutsideOfPackage("..integration..")
      .should().dependOnClassesThat().resideInAnyPackage("org.springframework.web.client..", "java.net.http..", "okhttp3..");

  @ArchTest
  static final ArchRule clientsAreGuarded = methods()
      .that().areDeclaredInClassesThat().resideInAPackage("..integration..")
      .and().arePublic()
      .should().beAnnotatedWith(io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker.class)
      .andShould().beAnnotatedWith(io.github.resilience4j.retry.annotation.Retry.class);
}`,
    },
    {
      id: 'ff-mesh', label: 'Every outside host guarded', when: { PROTECTION: ['mesh'] }, category: 'structural', implements: ['adr-mesh'],
      threshold: 'Every ServiceEntry host has a VirtualService with a timeout and at most {{RETRIES}} retry attempts, and a DestinationRule with outlier detection; 0 hosts without',
      description: 'A Conftest policy runs over the mesh manifests in the repository in each pull request and fails on an outside host that lacks any of the three.',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `# conftest test --combine mesh/
package mesh.egress

import rego.v1

docs := [f.contents | some f in input]

hosts contains h if { some e in docs; e.kind == "ServiceEntry"; some h in e.spec.hosts }

guarded_vs(h) if {
  some v in docs; v.kind == "VirtualService"; h in v.spec.hosts
  some r in v.spec.http; r.timeout; r.retries.attempts <= {{RETRIES}}
}

guarded_dr(h) if {
  some d in docs; d.kind == "DestinationRule"; d.spec.host == h
  d.spec.trafficPolicy.outlierDetection
}

deny contains msg if { some h in hosts; not guarded_vs(h); msg := sprintf("%s: no VirtualService with a timeout and bounded retries", [h]) }
deny contains msg if { some h in hosts; not guarded_dr(h); msg := sprintf("%s: no DestinationRule with outlierDetection", [h]) }`,
    },
  ],
}

export default pack
