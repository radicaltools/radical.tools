import type { PackSpec } from '../../src/packSpec'

const FORCES = 'This element takes requests from people or other systems outside it. The forces: one caller, by mistake (a retry loop, a bad deploy) or on purpose, can use up capacity meant for all; bots guess passwords, create accounts, scrape data and run up the bill of costly operations (messages sent, searches, third-party calls); a request or a page can be large enough to exhaust memory before it is refused; limits that are too tight, or keyed on an address shared by an office or a mobile carrier, lock out real users; and a limit counted on one instance of many is no limit at all. Snippets assume the router\'s table in src/app (routes with method, path, an example and the flags paginated and costly), black-box tests against $BASE_URL of a staging deployment with credentials in TOKEN_* variables, the gateway\'s decK file under gateway/, and Terraform plans read with terraform show -json.'
const WHERE = ['adr-gateway', 'adr-waf', 'adr-app']

const pack: PackSpec = {
  id: 'concern-rate-limiting',
  name: 'Rate limiting and abuse',
  group: 'security',
  description: 'Entry points from outside: how much one caller may ask, how it is counted and where, and how oversized and automated requests are stopped. Whether an element is reachable from outside at all is not decided here (network segmentation is a pack of its own).',
  tags: ['security', 'rate-limiting', 'abuse', 'availability', 'bots', 'api'],
  concern: {
    id: 'rate-limiting',
    trigger: 'LIST RELATIONS WHERE (source.type = "person" OR source.external = true) AND target.external != true AND (target.type = "system" OR target.type = "container" OR target.type = "webapp" OR target.type = "component")',
    applyTo: 'target',
    why: 'these elements take requests from outside, so how much one caller may ask, and what stops abuse, has to be decided.',
  },
  sources: [
    { title: 'OWASP API Security Top 10 2023, API4:2023 Unrestricted Resource Consumption', url: 'https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/' },
    { title: 'OWASP API Security Top 10 2023, API6:2023 Unrestricted Access to Sensitive Business Flows', url: 'https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/' },
    { title: 'RFC 6585, Additional HTTP Status Codes (4. 429 Too Many Requests)', url: 'https://www.rfc-editor.org/rfc/rfc6585' },
    { title: 'RFC 9110, HTTP Semantics (10.2.3 Retry-After, 15.5.14 413 Content Too Large)', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
    { title: 'OWASP Denial of Service Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html' },
    { title: 'OWASP Automated Threats to Web Applications', url: 'https://owasp.org/www-project-automated-threats-to-web-applications/' },
    { title: 'IETF draft, RateLimit header fields for HTTP', url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/' },
  ],
  questions: [
    {
      key: 'EXPOSURE', title: 'Exposure', label: 'Who can reach it?',
      hint: 'Anything on the internet is probed and scraped within hours of going live; a partner API has known callers and agreed limits.',
      default: 'internet',
      options: [
        { value: 'internet', label: 'anyone on the internet', description: 'Anonymous people and bots reach it. Pick it for public web apps, sign-up and sign-in pages and public APIs; it needs volumetric protection at the edge and protection of costly operations.' },
        { value: 'partners', label: 'known partners and our signed-in users', description: 'Every request carries a partner key or a user\'s credential, checked at the edge, so callers are counted by account or API key, not by address. Pick it for B2B APIs and back offices; limits can be agreed per partner.' },
      ],
    },
    {
      key: 'KEY', title: 'Limit key', label: 'What is a caller counted by?',
      hint: 'The key decides who shares a limit: too coarse and an office shares one, too fine and an attacker rotates it.',
      default: 'account',
      options: [
        { value: 'account', label: 'its account or API key, else its source address', description: 'Signed-in callers by account, anonymous ones by address with a lower limit. Pick it when most traffic is signed in and some pages are public.' },
        { value: 'apikey', label: 'its API key', description: 'Each calling system by its key, with limits agreed per key; requests without a valid key are refused before counting. Pick it for machine-to-machine APIs.' },
        { value: 'ip', label: 'its source address', description: 'IPv4 per address, IPv6 per /64. Pick it only when callers are anonymous; offices and mobile carriers share addresses, so allow-list the known ones. Not with known partners, whose every request carries a key to count by.' },
      ],
    },
    {
      key: 'ALGORITHM', title: 'Algorithm', label: 'How are requests counted?',
      hint: 'The algorithm decides whether bursts are allowed and how exact the limit is at the edge of a window.',
      default: 'token-bucket',
      options: [
        { value: 'token-bucket', label: 'a token bucket', description: 'A steady rate plus a burst allowance. Pick it when real clients send in bursts (a page loading 20 resources, a batch job); AWS API Gateway, Envoy and ASP.NET Core offer it.' },
        { value: 'sliding-window', label: 'a sliding window', description: 'No 60 seconds may hold more than the limit, wherever they start. Pick it when the limit protects a fixed capacity (a partner\'s backend, a licence) and must not be exceeded at window edges.' },
        { value: 'fixed-window', label: 'a fixed window per minute', description: 'A counter per calendar minute, reset at its start; cheapest to run, but a caller can send twice the limit across a minute boundary. Pick it for quotas (per day, per month) and simple per-minute limits.' },
      ],
    },
    {
      key: 'WHERE', title: 'Where enforced', label: 'Where is the limit enforced?',
      hint: 'The earlier a request is refused, the less it costs; the later, the more the limit knows about who is calling.',
      default: 'gateway',
      options: [
        { value: 'gateway', label: 'at the API gateway', description: 'Kong, NGINX, Envoy, AWS API Gateway or Azure API Management in front of the element, keyed on the token or API key it validates. Pick it when there is a gateway in the path, which most APIs have.' },
        { value: 'waf', label: 'at the edge WAF or CDN', description: 'Cloudflare, AWS WAF, Azure Front Door or Akamai rate rules before traffic reaches the network. Pick it for public web traffic and floods; counts are approximate and keyed mostly on addresses and headers.' },
        { value: 'app', label: 'in the application', description: 'Middleware in the element with counters shared in Redis. Pick it when the limit depends on business data (plan, tenant, operation cost) that only the element knows.' },
      ],
    },
    {
      key: 'BOTS', title: 'Bots', label: 'How are automated callers stopped on costly operations?',
      hint: 'Credential stuffing, fake sign-ups and scraping stay under per-caller limits by spreading over many addresses; they need their own protection.',
      default: 'challenge',
      options: [
        { value: 'challenge', label: 'a challenge after repeated attempts', description: 'Cloudflare Turnstile, hCaptcha or reCAPTCHA after a source repeats a costly operation. Pick it for public sign-in, sign-up and contact forms without a bot-management product.' },
        { value: 'managed', label: 'managed bot detection at the edge', description: 'Cloudflare Bot Management, AWS WAF Bot Control or Akamai Bot Manager score every request. Pick it for high-value public targets (retail, tickets, finance) facing distributed bots.' },
        { value: 'none', label: 'costly operations only for identified callers', description: 'No bot product; costly operations sit behind sign-in or a partner key. Pick it for partner APIs and back offices, where every caller is known.' },
      ],
    },
  ],
  details: [
    { key: 'LIMIT_PER_MIN', label: 'How many requests a minute may one caller make?', default: '600', number: true },
    { key: 'BURST', label: 'How many requests may a caller send at once above that (token bucket)?', default: '100', number: true },
    { key: 'ANON_LIMIT_PER_MIN', label: 'How many requests a minute may one anonymous source address make?', default: '60', number: true },
    { key: 'MAX_BODY_KB', label: 'What is the largest request body accepted (KB)?', default: '1024', number: true },
    { key: 'MAX_PAGE_ITEMS', label: 'How many items may one page of results hold at most?', default: '100', number: true },
    { key: 'COSTLY_OPS', label: 'Which operations are costly or attractive to bots?', default: 'sign-up, sign-in, password reset, search' },
  ],
  need: {
    label: 'No caller takes it down',
    text: 'The element takes requests from outside. One caller, by mistake or on purpose, can send enough to slow it for everyone; bots try passwords, create accounts and scrape data; oversized requests and pages use up memory; and costly operations run up bills because nothing limits them. Real users behind a shared address must not be locked out on the way.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-limit', label: 'Callers limited', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'one caller, counted by {{KEY}}, sends more than {{LIMIT_PER_MIN}} requests a minute',
      action: 'answer the excess with 429 and a Retry-After header, without raising other callers\' 95th percentile response time by more than 10 %',
      rationale: 'A fair share each: a misbehaving caller slows only itself, and 429 with Retry-After tells a well-behaved client when to come back (OWASP API4:2023; RFC 6585 4; RFC 9110 10.2.3).',
      scenario: { label: 'Excess refused', given: 'one caller and ten others at normal load', when: 'the one sends ten times {{LIMIT_PER_MIN}} requests a minute for three minutes', then: 'at least 99 % of its excess gets 429 with Retry-After, and the others\' 95th percentile stays within 10 % of normal' },
    },
    {
      id: 'req-size', label: 'Oversized requests refused', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request body is larger than {{MAX_BODY_KB}} KB or than its operation allows',
      action: 'refuse it with 413 before reading more than that limit',
      rationale: 'Reading first and checking later is the exhaustion; the limit belongs in the first component that reads the body (OWASP API4:2023, maximum request size; RFC 9110 15.5.14).',
      scenario: { label: 'Large body refused', given: 'every write operation of the router', when: 'a body of 100 times {{MAX_BODY_KB}} KB is sent to each', then: 'each is refused with 413' },
    },
    {
      id: 'req-pages', label: 'Pages bounded', ears_type: 'ubiquitous',
      action: 'return at most {{MAX_PAGE_ITEMS}} items per page of results, and refuse a larger page size with 400',
      rationale: 'One request asking for everything is a flood in a single call (OWASP API4:2023, maximum number of records per page).',
      scenario: { label: 'Page size capped', given: 'every paginated operation of the router', when: 'a caller asks each for a page of 10 000, and then for a page without a size', then: 'the first is refused with 400, and the second holds at most {{MAX_PAGE_ITEMS}} items' },
    },
    {
      id: 'req-token-bucket', label: 'Bursts allowed, rate kept', when: { ALGORITHM: ['token-bucket'] }, ears_type: 'ubiquitous',
      action: 'let each caller send up to {{BURST}} requests at once above its steady rate, refill its allowance at {{LIMIT_PER_MIN}} requests a minute, and refuse requests while the allowance is empty',
      rationale: 'Real clients send in bursts; a bucket admits them without letting the sustained rate exceed the limit (OWASP Denial of Service Cheat Sheet).',
      scenario: { label: 'Burst admitted', given: 'a caller that has sent nothing for a minute', when: 'it sends {{BURST}} requests at once and then twice its rate for a minute', then: 'the burst is accepted, and of the minute\'s requests no more than {{LIMIT_PER_MIN}} plus 10 % are, the rest getting 429' },
    },
    {
      id: 'req-sliding-window', label: 'No window over the limit', when: { ALGORITHM: ['sliding-window'] }, ears_type: 'ubiquitous',
      action: 'count each caller\'s requests over a sliding 60-second window, so that no 60 seconds hold more than {{LIMIT_PER_MIN}} accepted requests from it, window edges included',
      rationale: 'A fixed window lets a caller send twice the limit across its boundary; a sliding window keeps the limit wherever the minute starts (OWASP Denial of Service Cheat Sheet).',
      scenario: { label: 'Edge burst refused', given: 'a caller', when: 'it sends {{LIMIT_PER_MIN}} requests in the last second of one minute and as many in the first second of the next', then: 'the second batch gets 429' },
    },
    {
      id: 'req-fixed-window', label: 'Quota per minute shown', when: { ALGORITHM: ['fixed-window'] }, ears_type: 'ubiquitous',
      action: 'accept at most {{LIMIT_PER_MIN}} requests per caller in each calendar minute, and return the limit, the requests remaining and the seconds to reset with every response',
      rationale: 'A fixed window is cheap and predictable; showing the remaining quota lets clients pace themselves instead of hitting 429 (IETF RateLimit header fields draft).',
      scenario: { label: 'Quota visible', given: 'a caller that has made 10 requests this minute', when: 'it makes another', then: 'the response says the limit is {{LIMIT_PER_MIN}}, that {{LIMIT_PER_MIN}} minus 11 remain, and when the window resets' },
    },
    {
      id: 'req-key-account', label: 'Anonymous callers limited lower', when: { KEY: ['account'] }, ears_type: 'event-driven',
      trigger: 'a request arrives without a credential',
      action: 'count it by its source address (IPv6 by /64) and limit that address to {{ANON_LIMIT_PER_MIN}} requests a minute, apart from the limits of signed-in callers',
      rationale: 'Anonymous traffic has no account to count by; a separate, lower limit keeps it from using up what signed-in users need (OWASP API4:2023).',
      scenario: { label: 'Anonymous flood', given: 'a source address without a credential and a signed-in user', when: 'the address sends {{ANON_LIMIT_PER_MIN}} requests and 10 more within a minute', then: 'the 10 get 429 and the signed-in user\'s requests are unaffected' },
    },
    {
      id: 'req-key-apikey', label: 'Keyless calls refused first', when: { KEY: ['apikey'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request carries no valid API key',
      action: 'refuse it with 401 before it counts against any key\'s limit, and limit such requests to {{ANON_LIMIT_PER_MIN}} a minute per source address',
      rationale: 'If invalid keys counted against valid ones, anyone could spend a partner\'s quota; limiting failures by address slows key guessing (OWASP API4:2023, API2:2023).',
      scenario: { label: 'Invalid key ignored', given: 'a partner\'s key with one request of its limit left', when: 'another source sends {{ANON_LIMIT_PER_MIN}} and 10 more requests naming that key with a wrong secret, and then the partner sends its request', then: 'the forged requests are refused with 401, then 429 after {{ANON_LIMIT_PER_MIN}}, and the partner\'s request is accepted' },
    },
    {
      id: 'req-key-ip', label: 'Addresses counted fairly', when: { KEY: ['ip'] }, ears_type: 'ubiquitous',
      action: 'count IPv4 callers per address and IPv6 callers per /64 prefix, take the address only from the trusted proxy\'s header, and give the addresses on an allow-list of known shared egress (offices, partners) their own higher limits',
      rationale: 'An address taken from any X-Forwarded-For value can be forged, and an IPv6 host owns a whole /64; shared addresses need room or real users are locked out (OWASP Denial of Service Cheat Sheet).',
      scenario: { label: 'Forged header ignored', given: 'a caller over its limit', when: 'it sends a request with a forged X-Forwarded-For value, and then from another address in its /64', then: 'both are counted against the same caller and refused' },
    },
    {
      id: 'req-shared-counters', label: 'One limit across instances', when: { WHERE: ['app'] }, ears_type: 'state-driven',
      precondition: 'the element runs on more than one instance',
      action: 'keep the counters in one shared store, so that the element as a whole accepts no more from one caller than one instance would, within 10 %, and fall back to a per-instance limit rather than none when the store is unreachable',
      rationale: 'A limit counted per instance multiplies with every instance added; failing open would turn a store outage into an open door (OWASP Denial of Service Cheat Sheet).',
      scenario: { label: 'Limit holds on two instances', given: 'two instances sharing a store', when: 'one caller sends twice {{LIMIT_PER_MIN}} requests in a minute spread over both, and again with the store stopped', then: 'no more than one instance alone accepts plus 10 % are accepted, and with the store stopped the caller is still refused past one instance\'s limit' },
    },
    {
      id: 'req-bots-challenge', label: 'Repeated costly calls challenged', when: { BOTS: ['challenge'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'one source calls one of {{COSTLY_OPS}} more than 10 times in 10 minutes',
      action: 'ask for a challenge (Turnstile, hCaptcha or reCAPTCHA) before going on, and never for the first attempt',
      rationale: 'Bots go for what costs us or helps them; a challenge after repetition stops automation without taxing real users (OWASP Automated Threats OAT-007 Credential Cracking, OAT-008 Credential Stuffing, OAT-019 Account Creation).',
      scenario: { label: 'Bot challenged', given: 'one source', when: 'its first attempt at one of {{COSTLY_OPS}} is made, and then 10 more in 10 minutes', then: 'the first attempt sees no challenge and the 11th is answered with one' },
    },
    {
      id: 'req-bots-managed', label: 'Automated traffic stopped at the edge', when: { BOTS: ['managed'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request to one of {{COSTLY_OPS}} is scored as automated by the edge\'s bot detection',
      action: 'block or challenge it at the edge before it reaches the element, letting verified bots (search engines, monitoring) through, and report the blocked share every day',
      rationale: 'Distributed bots stay under every per-caller limit; detection on many signals at once is what catches them (OWASP Automated Threats to Web Applications).',
      scenario: { label: 'Headless browser stopped', given: 'the edge\'s bot detection in blocking mode', when: 'a headless browser script calls the first of {{COSTLY_OPS}} from 50 addresses', then: 'its requests are challenged or blocked at the edge and none reach the element' },
    },
    {
      id: 'req-bots-none', label: 'Costly operations need identity', when: { BOTS: ['none'] }, ears_type: 'ubiquitous',
      action: 'offer {{COSTLY_OPS}} only to callers with a valid account or partner key, so that each can be counted and blocked by who it is',
      rationale: 'Without bot protection, the only defence for a costly operation is that nobody anonymous can reach it (OWASP API6:2023).',
      scenario: { label: 'Anonymous costly call refused', given: 'every route the router marks costly', when: 'each is called without a credential', then: 'each is refused with 401' },
    },
    {
      id: 'req-internet', label: 'Floods absorbed at the edge', when: { EXPOSURE: ['internet'] }, ears_type: 'ubiquitous',
      action: 'accept internet traffic only through the provider\'s edge with volumetric DDoS protection, and refuse connections to the origin from anywhere else',
      rationale: 'A flood measured in gigabits cannot be limited by the element it is aimed at; an origin reachable directly bypasses every edge rule (OWASP Denial of Service Cheat Sheet).',
      scenario: { label: 'Origin hidden', given: 'the element behind its edge', when: 'each of its origin addresses is called directly from the internet', then: 'every connection is refused' },
    },
    {
      id: 'req-partners', label: 'Limits per partner', when: { EXPOSURE: ['partners'] }, ears_type: 'state-driven',
      precondition: 'a partner has used more than 80 % of its agreed limit for 15 minutes',
      action: 'alert the partner\'s owner on our side, so that the limit is raised by agreement or the partner is told before it is refused',
      rationale: 'Limits per partner are agreements, not just defences; a partner that hits its limit unannounced is an outage for its users (OWASP API4:2023).',
      scenario: { label: 'Near the limit', given: 'a partner with an agreed limit', when: 'it runs at 85 % of it for 15 minutes', then: 'its owner on our side is alerted' },
    },
  ],
  adrs: [
    {
      id: 'adr-gateway', label: 'Limits at the API gateway', when: { WHERE: ['gateway'] },
      decision: 'Requests pass an API gateway that limits each caller, counted by {{KEY}}, to {{LIMIT_PER_MIN}} requests a minute using {{ALGORITHM}}, refuses bodies over {{MAX_BODY_KB}} KB, and answers the excess with 429 and Retry-After; counters are shared by all gateway nodes. The element is reachable by {{EXPOSURE}}; bots on costly operations: {{BOTS}}. Choosing the gateway: the one already in the path. Match the algorithm: AWS API Gateway (usage plans) and Envoy\'s local rate limit are token buckets, NGINX limit_req a leaky bucket with a burst, Kong\'s open-source rate-limiting plugin fixed windows (sliding windows in Kong Enterprise and Azure API Management\'s rate-limit-by-key). Judge by whether it can key on the validated token\'s subject or the API key, share counters across nodes (Redis, a global rate limit service) and set limits per caller.',
      consequences: '• One place for every route\'s limits, applied before the element spends anything.\n• The gateway must see the caller\'s identity: it validates tokens or keys itself.\n• Limits that depend on business data (plan, tenant) need the gateway to read it, or a second limit in the element.\n• Limits need tuning from real traffic; start in log-only mode for a week.',
      alternatives: '1. At the edge WAF: earlier and cheaper, but approximate and keyed mostly on addresses.\n2. In the application: knows the business, but a request has already reached the element.\n3. Rely on autoscaling: pays for abuse instead of stopping it.',
    },
    {
      id: 'adr-waf', label: 'Limits at the edge', when: { WHERE: ['waf'] },
      decision: 'Rate rules at the edge WAF or CDN limit each caller, counted by {{KEY}}, to {{LIMIT_PER_MIN}} requests a minute using {{ALGORITHM}} as closely as the product allows, refuse bodies over {{MAX_BODY_KB}} KB, and answer the excess with 429 and Retry-After; the origin accepts traffic only from the edge. The element is reachable by {{EXPOSURE}}; bots on costly operations: {{BOTS}}. Choosing the product: Cloudflare WAF rate limiting rules, AWS WAF rate-based rules (with CloudFront or an ALB), Azure Front Door WAF rate limit rules or Akamai; judge by the keys it can count on (address, header, cookie, JWT claim), the shortest window it supports, how fast it starts blocking, and its price per million requests.',
      consequences: '• Floods are refused before they reach our network or our bill.\n• Counts are approximate and lag by seconds: the limit is a ceiling, not an exact figure.\n• Keys are mostly addresses and headers; per-account limits need the edge to read a token claim or a second limit further in.\n• The edge provider is on every request\'s path.',
      alternatives: '1. At the API gateway: exact, keyed on the validated caller, but after traffic entered our network.\n2. In the application: knows the business, latest of all.',
    },
    {
      id: 'adr-app', label: 'Limits in the application', when: { WHERE: ['app'] },
      decision: 'The element limits each caller, counted by {{KEY}}, to {{LIMIT_PER_MIN}} requests a minute using {{ALGORITHM}}, in middleware that runs before any handler, with counters in a shared Redis; bodies over {{MAX_BODY_KB}} KB are refused by the server\'s own limit. The excess gets 429 and Retry-After. The element is reachable by {{EXPOSURE}}; bots on costly operations: {{BOTS}}. Choosing the library: the framework\'s own (ASP.NET Core rate limiting) or a maintained one with a Redis store (Bucket4j with its Spring Boot starter for Java, express-rate-limit with rate-limit-redis for Node, django-ratelimit for Python); judge by its algorithms, atomic shared counters and per-route configuration.',
      consequences: '• Limits can follow business data: plan, tenant, operation cost.\n• A request has already reached the element when it is refused: floods still need protection in front.\n• Redis is on the request path; when it is unreachable, the per-instance fallback limits less exactly.',
      alternatives: '1. At the API gateway: before the element, but blind to business data.\n2. At the edge WAF: earliest and cheapest, approximate.',
    },
  ],
  fitness: [
    {
      id: 'ff-noisy', label: 'Noisy caller contained', category: 'operational', implements: WHERE, checks: ['req-limit'],
      threshold: 'With one caller at 10 times {{LIMIT_PER_MIN}} requests a minute, other callers\' 95th percentile stays within 10 % of the baseline and at least 99 % of the flood\'s excess gets 429 with Retry-After',
      description: 'A load test in the staging environment runs normal traffic from several callers and a flood from one, and compares the others\' response times with a baseline run without the flood; 90 % of the flood is excess, so 99 % of the excess is 89 % of the flood.',
      tool: 'Grafana k6',
      language: 'js',
      snippet: `import http from 'k6/http'
import { check } from 'k6'

const LIMIT = {{LIMIT_PER_MIN}}
const BASELINE_P95 = Number(__ENV.BASELINE_P95_MS)

export const options = {
  scenarios: {
    normal: { executor: 'constant-arrival-rate', rate: 20, timeUnit: '1s', duration: '3m', preAllocatedVUs: 50, env: { KEY: 'normal' } },
    flood:  { executor: 'constant-arrival-rate', rate: LIMIT * 10, timeUnit: '1m', duration: '3m', preAllocatedVUs: 200, env: { KEY: 'flood' } },
  },
  thresholds: {
    'http_req_duration{scenario:normal}': [\`p(95)<\${BASELINE_P95 * 1.1}\`],
    'checks{scenario:flood}': ['rate>0.89'],
  },
}

export default function () {
  const res = http.get(\`\${__ENV.BASE_URL}/orders\`, { headers: { Authorization: \`Bearer \${__ENV['TOKEN_' + __ENV.KEY]}\` } })
  if (__ENV.KEY === 'flood') check(res, { 'limited with Retry-After': (r) => r.status === 429 && !!r.headers['Retry-After'] })
}`,
    },
    {
      id: 'ff-body', label: 'Oversized bodies refused', category: 'structural', implements: WHERE, checks: ['req-size'],
      threshold: 'A body of 100 times {{MAX_BODY_KB}} KB is answered with 413 on 100 % of the router\'s write operations',
      description: 'A test lists the write operations from the router (not from a list kept by hand), sends an oversized body to each and expects 413, which fails when a new route or a proxy change drops the size limit.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app, routes } from '../src/app'          // routes: the router's table

const oversized = Buffer.alloc({{MAX_BODY_KB}} * 100 * 1024, 'a')

describe.each(routes.filter((r) => ['POST', 'PUT', 'PATCH'].includes(r.method)))('%s %s', (route) => {
  it('refuses an oversized body with 413', async () => {
    const res = await request(app)[route.method.toLowerCase()](route.example)
      .set('Content-Type', 'application/octet-stream').send(oversized)
    expect(res.status).toBe(413)
  })
})`,
    },
    {
      id: 'ff-pages', label: 'Pages capped', category: 'structural', implements: WHERE, checks: ['req-pages'],
      threshold: 'Every paginated operation refuses a page size of 10 000 with 400 and returns at most {{MAX_PAGE_ITEMS}} items without a size; 0 exceptions',
      description: 'A test lists the paginated operations from the router (routes flagged paginated), asks each for an oversized page and for a default one, and checks the refusal and the count.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app, routes } from '../src/app'          // routes flagged paginated name their page-size parameter

describe.each(routes.filter((r) => r.paginated))('GET %s', (route) => {
  it('caps the page', async () => {
    await request(app).get(route.example).query({ [route.pageSizeParam]: 10_000 }).set(auth(user)).expect(400)
    const res = await request(app).get(route.example).set(auth(user)).expect(200)
    expect(res.body.items.length).toBeLessThanOrEqual({{MAX_PAGE_ITEMS}})
  })
})`,
    },
    {
      id: 'ff-bucket', label: 'Bucket admits a burst, keeps the rate', when: { ALGORITHM: ['token-bucket'] }, category: 'operational', implements: WHERE, checks: ['req-token-bucket'],
      threshold: 'After a minute idle, {{BURST}} requests at once are all accepted; of twice {{LIMIT_PER_MIN}} requests spread over the next minute, at most {{LIMIT_PER_MIN}} plus 10 % are accepted and the rest get 429',
      description: 'A black-box test against the staging deployment lets the bucket fill, sends the burst in parallel, then sends at twice the rate for a minute and counts what was accepted.',
      tool: 'Vitest with fetch against $BASE_URL (or the test runner of your stack)',
      language: 'ts',
      snippet: `const LIMIT = {{LIMIT_PER_MIN}}
const BURST = {{BURST}}
const call = () => fetch(\`\${process.env.BASE_URL}/orders\`, { headers: { Authorization: \`Bearer \${process.env.TOKEN_BUCKET}\` } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

it('admits a burst, then holds the rate', async () => {
  await sleep(60_000)                                                   // a minute idle: the bucket is full
  const burst = await Promise.all(Array.from({ length: BURST }, call))
  expect(burst.map((r) => r.status)).toEqual(Array(BURST).fill(200))
  let accepted = 0
  for (let i = 0; i < LIMIT * 2; i++) {                                 // twice the rate for one minute
    const res = await call()
    if (res.status === 200) accepted++
    else expect(res.status).toBe(429)
    await sleep(30_000 / LIMIT)
  }
  expect(accepted).toBeLessThanOrEqual(LIMIT * 1.1)
}, 200_000)`,
    },
    {
      id: 'ff-sliding', label: 'Window edges hold', when: { ALGORITHM: ['sliding-window'] }, category: 'operational', implements: WHERE, checks: ['req-sliding-window'],
      threshold: '{{LIMIT_PER_MIN}} requests in the last second of a minute are accepted and {{LIMIT_PER_MIN}} in the first second of the next all get 429',
      description: 'A black-box test against the staging deployment waits for second 59, sends the limit at once, waits two seconds past the minute boundary and sends the limit again.',
      tool: 'Vitest with fetch against $BASE_URL (or the test runner of your stack)',
      language: 'ts',
      snippet: `const LIMIT = {{LIMIT_PER_MIN}}
const call = () => fetch(\`\${process.env.BASE_URL}/orders\`, { headers: { Authorization: \`Bearer \${process.env.TOKEN_WINDOW}\` } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const untilSecond = async (s: number) => { while (new Date().getSeconds() !== s) await sleep(100) }

it('refuses a burst that straddles the minute boundary', async () => {
  await untilSecond(59)
  const first = await Promise.all(Array.from({ length: LIMIT }, call))
  await sleep(2_000)
  const second = await Promise.all(Array.from({ length: LIMIT }, call))
  expect(first.filter((r) => r.status === 200)).toHaveLength(LIMIT)
  expect(second.filter((r) => r.status === 429)).toHaveLength(LIMIT)
}, 120_000)`,
    },
    {
      id: 'ff-fixed', label: 'Quota headers present', when: { ALGORITHM: ['fixed-window'] }, category: 'structural', implements: WHERE, checks: ['req-fixed-window'],
      threshold: 'After 10 requests in a minute, the 11th answer carries the limit {{LIMIT_PER_MIN}}, {{LIMIT_PER_MIN}} minus 11 remaining and a reset of at most 60 seconds',
      description: 'A black-box test against the staging deployment makes eleven requests at the start of a minute and reads the RateLimit header fields of the last answer.',
      tool: 'Vitest with fetch against $BASE_URL (or the test runner of your stack)',
      language: 'ts',
      snippet: `const LIMIT = {{LIMIT_PER_MIN}}
const call = () => fetch(\`\${process.env.BASE_URL}/orders\`, { headers: { Authorization: \`Bearer \${process.env.TOKEN_QUOTA}\` } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

it('shows the quota with every answer', async () => {
  while (new Date().getSeconds() !== 0) await sleep(100)             // the start of a calendar minute
  for (let i = 0; i < 10; i++) await call()
  const res = await call()
  // IETF draft-ietf-httpapi-ratelimit-headers up to -07; newer drafts fold the three into one RateLimit field
  expect(Number(res.headers.get('ratelimit-limit'))).toBe(LIMIT)
  expect(Number(res.headers.get('ratelimit-remaining'))).toBe(LIMIT - 11)
  expect(Number(res.headers.get('ratelimit-reset'))).toBeLessThanOrEqual(60)
}, 120_000)`,
    },
    {
      id: 'ff-key-account', label: 'Anonymous limit apart', when: { KEY: ['account'] }, category: 'operational', implements: WHERE, checks: ['req-key-account'],
      threshold: 'From one address without a credential, {{ANON_LIMIT_PER_MIN}} requests are accepted and the next 10 get 429; a signed-in user\'s request from the same address is accepted',
      description: 'A black-box test against the staging deployment floods a public route from one address without a credential, then calls with a user\'s token from the same address.',
      tool: 'Vitest with fetch against $BASE_URL (or the test runner of your stack)',
      language: 'ts',
      snippet: `const ANON = {{ANON_LIMIT_PER_MIN}}
const anon = () => fetch(\`\${process.env.BASE_URL}/products\`)
const user = () => fetch(\`\${process.env.BASE_URL}/products\`, { headers: { Authorization: \`Bearer \${process.env.TOKEN_USER}\` } })

it('limits anonymous addresses lower and apart from signed-in callers', async () => {
  const statuses: number[] = []
  for (let i = 0; i < ANON + 10; i++) statuses.push((await anon()).status)
  expect(statuses.slice(0, ANON)).toEqual(Array(ANON).fill(200))
  expect(statuses.slice(ANON)).toEqual(Array(10).fill(429))
  expect((await user()).status).toBe(200)
}, 120_000)`,
    },
    {
      id: 'ff-key-apikey', label: 'Invalid keys do not count', when: { KEY: ['apikey'] }, category: 'operational', implements: WHERE, checks: ['req-key-apikey'],
      threshold: 'With one request of a partner\'s limit left, {{ANON_LIMIT_PER_MIN}} requests naming its key with a wrong secret get 401 and the next 10 get 429; the partner\'s request is then accepted',
      description: 'A black-box test against the staging deployment uses up a partner\'s limit but one, floods with a forged key from another address, and checks that the partner\'s last request still passes.',
      tool: 'Vitest with fetch against $BASE_URL (or the test runner of your stack)',
      language: 'ts',
      snippet: `const LIMIT = {{LIMIT_PER_MIN}}
const ANON = {{ANON_LIMIT_PER_MIN}}
const url = \`\${process.env.BASE_URL}/orders\`
const partner = () => fetch(url, { headers: { 'X-Api-Key': process.env.PARTNER_KEY! } })
const forged = () => fetch(url, { headers: { 'X-Api-Key': \`\${process.env.PARTNER_KEY_ID}.wrong-secret\` } })

it('refuses invalid keys before counting, and limits them per address', async () => {
  for (let i = 0; i < LIMIT - 1; i++) expect((await partner()).status).toBe(200)   // one request left
  const statuses: number[] = []
  for (let i = 0; i < ANON + 10; i++) statuses.push((await forged()).status)
  expect(statuses.slice(0, ANON)).toEqual(Array(ANON).fill(401))
  expect(statuses.slice(ANON)).toEqual(Array(10).fill(429))
  expect((await partner()).status).toBe(200)                                       // the forged calls did not count
}, 300_000)`,
    },
    {
      id: 'ff-key-ip', label: 'Addresses counted fairly', when: { KEY: ['ip'] }, category: 'operational', implements: WHERE, checks: ['req-key-ip'],
      threshold: 'A forged X-Forwarded-For from outside does not reset a caller\'s count; two addresses in one IPv6 /64 share one count; an address in another /64 has its own',
      description: 'A black-box test against the staging deployment floods from the runner\'s address and then forges the header; a second test, from a runner on the trusted-proxy list, presents addresses as the proxy would and checks the /64 grouping.',
      tool: 'Vitest with fetch against $BASE_URL and, for the proxy path, from a runner on the trusted-proxy list (or the test runner of your stack)',
      language: 'ts',
      snippet: `const LIMIT = {{LIMIT_PER_MIN}}
const direct = (headers = {}) => fetch(\`\${process.env.BASE_URL}/products\`, { headers })
const viaProxy = (ip: string) => fetch(\`\${process.env.INTERNAL_URL}/products\`, { headers: { 'X-Forwarded-For': ip } })  // this runner is a trusted proxy in staging

it('ignores a forged X-Forwarded-For from outside', async () => {
  for (let i = 0; i < LIMIT; i++) await direct()
  expect((await direct({ 'X-Forwarded-For': '203.0.113.9' })).status).toBe(429)
}, 120_000)

it('counts an IPv6 /64 as one caller', async () => {
  for (let i = 0; i < LIMIT; i++) await viaProxy('2001:db8:1:2::1')
  expect((await viaProxy('2001:db8:1:2::ffff')).status).toBe(429)
  expect((await viaProxy('2001:db8:1:3::1')).status).toBe(200)
}, 120_000)`,
    },
    {
      id: 'ff-gateway', label: 'Every route limited', when: { WHERE: ['gateway'] }, category: 'structural', implements: ['adr-gateway'], checks: ['req-limit'],
      threshold: '0 gateway services without a rate-limiting plugin on the service, one of its routes, or globally; 0 per-minute limits above {{LIMIT_PER_MIN}} without an exception tag naming its ticket',
      description: 'A Conftest policy over the gateway\'s declarative configuration (Kong decK file) fails the pull request when a service has no rate limit at any level, or one higher than agreed that carries no limit-exception tag; both rate-limiting (config.minute) and rate-limiting-advanced (the limit for the 60-second window) are read.',
      tool: 'Conftest (Open Policy Agent) over the Kong decK configuration',
      language: 'rego',
      snippet: `package main

import rego.v1

limit_plugins := {"rate-limiting", "rate-limiting-advanced"}

plugins_of(s) := array.concat(object.get(s, "plugins", []), [p | some r in object.get(s, "routes", []); some p in object.get(r, "plugins", [])])

limited(s) if { some p in plugins_of(s); p.name in limit_plugins }
global if { some p in object.get(input, "plugins", []); p.name in limit_plugins }

# an agreed exception carries a tag with its ticket: limit-exception:ARCH-123
excepted(p) if { some t in object.get(p, "tags", []); startswith(t, "limit-exception:") }

per_minute(p) := p.config.minute if p.name == "rate-limiting"
per_minute(p) := p.config.limit[i] if { p.name == "rate-limiting-advanced"; some i; p.config.window_size[i] == 60 }

deny contains msg if {
  not global
  some s in input.services
  not limited(s)
  msg := sprintf("service %s has no rate limit on it or its routes", [s.name])
}

deny contains msg if {
  some s in input.services
  some p in plugins_of(s)
  p.name in limit_plugins
  not excepted(p)
  per_minute(p) > {{LIMIT_PER_MIN}}
  msg := sprintf("service %s allows %v a minute without an exception tag", [s.name, per_minute(p)])
}`,
    },
    {
      id: 'ff-waf', label: 'Edge rate rule present', when: { WHERE: ['waf'] }, category: 'structural', implements: ['adr-waf'], checks: ['req-limit'],
      threshold: 'Every web ACL in front of the element holds a rate-based rule in blocking mode; 0 plan changes that remove it',
      description: 'A Conftest policy over the Terraform plan fails when a WAF web ACL has no rate-based rule that blocks, so the edge limit cannot disappear in a refactoring.',
      tool: 'Conftest (Open Policy Agent) over terraform show -json (AWS WAF; for Cloudflare: the cloudflare_ruleset resource with phase http_ratelimit, checked the same way)',
      language: 'rego',
      snippet: `package main

import rego.v1

rate_rule(acl) if {
  some r in acl.rule
  some s in r.statement
  count(s.rate_based_statement) > 0
  some a in r.action
  count(a.block) > 0
}

deny contains msg if {
  some rc in input.resource_changes
  rc.type == "aws_wafv2_web_acl"
  not rate_rule(rc.change.after)
  msg := sprintf("%s has no blocking rate-based rule", [rc.address])
}`,
    },
    {
      id: 'ff-app', label: 'Limit holds across instances', when: { WHERE: ['app'] }, category: 'structural', implements: ['adr-app'], checks: ['req-shared-counters'],
      threshold: 'Two instances sharing Redis accept no more from one caller in a minute than one instance alone plus 10 %, and no more than {{LIMIT_PER_MIN}} + {{BURST}}; another caller is still accepted; with Redis stopped, one instance still refuses past its own limit',
      description: 'An integration test starts two instances of the element with a Redis container, measures what one instance alone accepts from a flood (the single-instance allowance, whatever the algorithm), then spreads the same flood over both and compares; a last run stops Redis and expects the per-instance fallback to refuse.',
      tool: 'Vitest with supertest and Testcontainers (Redis) (or the test runner of your stack)',
      language: 'ts',
      snippet: `const LIMIT = {{LIMIT_PER_MIN}}
const BURST = {{BURST}}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const flood = async (targets: Instance[], n: number) => {
  let accepted = 0
  for (let i = 0; i < n; i++) if ((await request(targets[i % targets.length]).get('/orders').set(auth(caller))).status === 200) accepted++
  return accepted
}

it('accepts no more across two instances than one instance does', async () => {
  const [a, b] = await startInstances(2, { redisUrl: redis.getConnectionUrl() })
  const alone = await flood([a], LIMIT * 2)                 // the single-instance allowance
  await sleep(60_000)
  const pair = await flood([a, b], LIMIT * 2)
  expect(pair).toBeLessThanOrEqual(alone * 1.1)
  expect(pair).toBeLessThanOrEqual(LIMIT + BURST)
  await request(b).get('/orders').set(auth(otherCaller)).expect(200)
}, 300_000)

it('still limits per instance when Redis is unreachable', async () => {
  const [a] = await startInstances(1, { redisUrl: redis.getConnectionUrl() })
  await redis.stop()
  expect(await flood([a], LIMIT * 2)).toBeLessThan(LIMIT * 2)
}, 300_000)`,
    },
    {
      id: 'ff-bots-challenge', label: 'Repeated costly calls challenged', when: { BOTS: ['challenge'] }, category: 'structural', implements: WHERE, checks: ['req-bots-challenge'],
      threshold: 'The 1st attempt at a costly operation from a fresh source shows no challenge; the 11th within 10 minutes shows one',
      description: 'An end-to-end test uses the password reset (one of the costly operations, with no lockout of its own) from one browser context: the first attempt must show no challenge widget, the eleventh must; the locator covers Turnstile, hCaptcha and reCAPTCHA.',
      tool: 'Playwright',
      language: 'ts',
      snippet: `const CHALLENGE = 'iframe[src*="challenges.cloudflare.com"], iframe[src*="hcaptcha.com"], iframe[src*="google.com/recaptcha"]'

const resetOnce = async (page: Page) => {
  await page.goto('/password-reset')
  await page.getByLabel('Email').fill('someone@example.com')
  await page.getByRole('button', { name: 'Send reset link' }).click()
}

test('a repeated costly operation is challenged, a first attempt never', async ({ page }) => {
  await resetOnce(page)
  await expect(page.locator(CHALLENGE)).toHaveCount(0)
  for (let i = 0; i < 10; i++) await resetOnce(page)
  await expect(page.locator(CHALLENGE)).toBeVisible()
})`,
    },
    {
      id: 'ff-bots-managed', label: 'Bot control enabled', when: { BOTS: ['managed'] }, category: 'structural', implements: WHERE, checks: ['req-bots-managed'],
      threshold: 'The web ACL in front of the element holds the managed bot rule group, not in count-only mode',
      description: 'A Conftest policy over the Terraform plan fails when the edge\'s managed bot rule group is missing or overridden to count, which would let bots through silently.',
      tool: 'Conftest (Open Policy Agent) over terraform show -json, for AWS WAF Bot Control (for Cloudflare: the cloudflare_bot_management resource; for Akamai: the akamai_botman_* resources; each checked the same way for presence and a blocking action)',
      language: 'rego',
      snippet: `package main

import rego.v1

bot_control(acl) if {
  some r in acl.rule
  some s in r.statement
  some m in s.managed_rule_group_statement
  m.name == "AWSManagedRulesBotControlRuleSet"
  some o in r.override_action
  count(o.none) > 0
}

deny contains msg if {
  some rc in input.resource_changes
  rc.type == "aws_wafv2_web_acl"
  not bot_control(rc.change.after)
  msg := sprintf("%s does not enforce AWS WAF Bot Control", [rc.address])
}`,
    },
    {
      id: 'ff-bots-none', label: 'Costly operations behind identity', when: { BOTS: ['none'] }, category: 'structural', implements: WHERE, checks: ['req-bots-none'],
      threshold: 'Every route the router marks costly answers 401 without a credential; 0 exceptions',
      description: 'A test lists the routes flagged costly from the router (not from a list kept by hand) and calls each without a credential, expecting 401; a new costly route fails the test until it is protected or flagged.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app, routes } from '../src/app'          // routes flagged costly: the operations listed in the decision

describe.each(routes.filter((r) => r.costly))('%s %s', (route) => {
  it('refuses a call without a credential', async () => {
    await request(app)[route.method.toLowerCase()](route.example).expect(401)
  })
})`,
    },
    {
      id: 'ff-origin', label: 'Origin closed to the internet', when: { EXPOSURE: ['internet'] }, category: 'operational', implements: WHERE, checks: ['req-internet'],
      threshold: '0 of the origin addresses answer a connection from the internet; every one is refused or times out',
      description: 'A scheduled job on a runner outside the provider\'s network tries each origin address directly over HTTPS and fails when any answers, which would mean the edge and its limits can be bypassed.',
      tool: 'curl in a scheduled job on a runner outside the edge',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# ORIGIN_ADDRESSES: the origin's addresses or host names as the edge sees them, space separated
set -uo pipefail
fail=0
for origin in $ORIGIN_ADDRESSES; do
  if curl -sk --max-time 10 -o /dev/null "https://$origin/"; then echo "$origin answers directly, bypassing the edge"; fail=1; fi
done
exit $fail`,
    },
    {
      id: 'ff-partner-alert', label: 'Partner near its limit', when: { EXPOSURE: ['partners'] }, category: 'operational', implements: WHERE, checks: ['req-partners'],
      threshold: 'An alert names every partner whose request rate has been above 80 % of its limit for 15 minutes',
      description: 'A Prometheus rule over the gateway\'s per-consumer request counter alerts the partner\'s owner; a partner whose limit was raised by agreement gets a rule of its own with its figure.',
      tool: 'Prometheus alerting rules over Kong\'s prometheus plugin (per_consumer and status_code_metrics on; for the application: its own http_requests_total by caller)',
      language: 'yaml',
      snippet: `groups:
- name: partner-limits
  rules:
  - alert: PartnerNearLimit
    expr: sum by (consumer) (rate(kong_http_requests_total[15m])) * 60 > 0.8 * {{LIMIT_PER_MIN}}
    for: 15m
    labels: { severity: ticket }
    annotations: { summary: "{{ $labels.consumer }} has run above 80 % of its limit for 15 minutes" }
  # a partner with a raised limit, agreed and recorded: its own rule with its figure
  - alert: PartnerNearLimitAcme
    expr: sum(rate(kong_http_requests_total{consumer="acme"}[15m])) * 60 > 0.8 * 3000
    for: 15m
    labels: { severity: ticket }`,
    },
  ],
}

export default pack
