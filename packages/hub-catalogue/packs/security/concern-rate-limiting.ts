import type { PackSpec } from '../../src/packSpec'

const FORCES = 'This element takes requests from people or other systems outside it. The forces: one caller, by mistake (a retry loop, a bad deploy) or on purpose, can use up capacity meant for all; bots guess passwords, create accounts, scrape data and run up the bill of costly operations (messages sent, searches, third-party calls); a request or a page can be large enough to exhaust memory before it is refused; limits that are too tight, or keyed on an address shared by an office or a mobile carrier, lock out real users; and a limit counted on one instance of many is no limit at all.'
const WHERE = ['adr-gateway', 'adr-waf', 'adr-app']

const pack: PackSpec = {
  id: 'concern-rate-limiting',
  name: 'Rate limiting and abuse',
  group: 'security',
  description: 'Entry points from outside: how much one caller may ask, how it is counted and where, how oversized and automated requests are stopped, and who can reach it at all.',
  tags: ['security', 'rate-limiting', 'abuse', 'availability', 'bots', 'api'],
  concern: {
    id: 'rate-limiting',
    trigger: 'LIST RELATIONS WHERE (source.type = "person" OR source.external = true) AND target.external != true AND (target.type = "system" OR target.type = "container" OR target.type = "webapp" OR target.type = "component")',
    applyTo: 'target',
    why: 'these elements take requests from outside, so how much one caller may ask, and what stops abuse, has to be decided.',
  },
  sources: [
    { title: 'OWASP API Security Top 10 2023, API4:2023 Unrestricted Resource Consumption', url: 'https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/' },
    { title: 'RFC 6585, Additional HTTP Status Codes (4. 429 Too Many Requests)', url: 'https://www.rfc-editor.org/rfc/rfc6585' },
    { title: 'RFC 9110, HTTP Semantics (10.2.3 Retry-After, 15.5.14 413 Content Too Large)', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
    { title: 'OWASP Denial of Service Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html' },
    { title: 'OWASP Automated Threats to Web Applications', url: 'https://owasp.org/www-project-automated-threats-to-web-applications/' },
    { title: 'IETF draft, RateLimit header fields for HTTP', url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/' },
  ],
  questions: [
    {
      key: 'EXPOSURE', title: 'Exposure', label: 'Who can reach it?',
      hint: 'Anything on the internet is probed and scraped within hours of going live; what is not reachable cannot be flooded.',
      default: 'internet',
      options: [
        { value: 'internet', label: 'anyone on the internet', description: 'Anonymous people and bots reach it. Pick it for public web apps, sign-up and sign-in pages and public APIs; it needs volumetric protection at the edge and protection of costly operations.' },
        { value: 'partners', label: 'known partners and our signed-in users', description: 'Every request carries a partner key or a user\'s credential, checked at the edge. Pick it for B2B APIs and back offices; limits can be agreed per partner.' },
        { value: 'internal', label: 'only our own network', description: 'No public address; only our own systems call it. Pick it when the model shows callers only from inside; limits still stop a runaway internal caller.' },
      ],
    },
    {
      key: 'KEY', title: 'Limit key', label: 'What is a caller counted by?',
      hint: 'The key decides who shares a limit: too coarse and an office shares one, too fine and an attacker rotates it.',
      default: 'account',
      options: [
        { value: 'account', label: 'its account or API key, else its source address', description: 'Signed-in callers by account, anonymous ones by address with a lower limit. Pick it when most traffic is signed in and some pages are public.' },
        { value: 'apikey', label: 'its API key', description: 'Each calling system by its key, with limits agreed per key; requests without a valid key are refused before counting. Pick it for machine-to-machine APIs.' },
        { value: 'ip', label: 'its source address', description: 'IPv4 per address, IPv6 per /64. Pick it only when callers are anonymous; offices and mobile carriers share addresses, so allow-list the known ones.' },
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
        { value: 'none', label: 'costly operations only for identified callers', description: 'No bot product; costly operations sit behind sign-in or a partner key. Pick it for partner and internal APIs, where every caller is known.' },
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
      scenario: { label: 'Excess refused', given: 'one caller and ten others at normal load', when: 'the one sends {{LIMIT_PER_MIN}} requests and then 100 more within a minute', then: 'the extra requests get 429 with Retry-After, and the others\' 95th percentile stays within 10 % of normal' },
    },
    {
      id: 'req-size', label: 'Oversized requests refused', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request body is larger than {{MAX_BODY_KB}} KB or than its operation allows',
      action: 'refuse it with 413 before reading more than that limit',
      rationale: 'Reading first and checking later is the exhaustion; the limit belongs in the first component that reads the body (OWASP API4:2023, maximum request size; RFC 9110 15.5.14).',
      scenario: { label: 'Large body refused', given: 'an operation that accepts {{MAX_BODY_KB}} KB at most', when: 'a 100 MB body is sent', then: 'it is refused with 413 and the element\'s memory does not grow by more than the limit' },
    },
    {
      id: 'req-pages', label: 'Pages bounded', ears_type: 'ubiquitous',
      action: 'return at most {{MAX_PAGE_ITEMS}} items per page of results, and refuse a larger page size with 400',
      rationale: 'One request asking for everything is a flood in a single call (OWASP API4:2023, maximum number of records per page).',
      scenario: { label: 'Page size capped', given: 'a list of 10 000 items', when: 'a caller asks for a page of 10 000', then: 'the request is refused with 400, and a request without a page size gets at most {{MAX_PAGE_ITEMS}} items' },
    },
    {
      id: 'req-token-bucket', label: 'Bursts allowed, rate kept', when: { ALGORITHM: ['token-bucket'] }, ears_type: 'ubiquitous',
      action: 'let each caller send up to {{BURST}} requests at once above its steady rate, refill its allowance at {{LIMIT_PER_MIN}} requests a minute, and refuse requests while the allowance is empty',
      rationale: 'Real clients send in bursts; a bucket admits them without letting the sustained rate exceed the limit (OWASP Denial of Service Cheat Sheet).',
      scenario: { label: 'Burst admitted', given: 'a caller that has sent nothing for a minute', when: 'it sends {{BURST}} requests at once and then keeps sending at twice its rate', then: 'the burst is accepted, and afterwards requests above {{LIMIT_PER_MIN}} a minute get 429' },
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
      scenario: { label: 'Quota visible', given: 'a caller that has made 10 requests this minute', when: 'it makes another', then: 'the response says the limit is {{LIMIT_PER_MIN}}, how many remain and when the window resets' },
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
      scenario: { label: 'Invalid key ignored', given: 'a partner\'s key with its limit almost used', when: 'another source sends 1 000 requests naming that key with a wrong secret', then: 'they are refused with 401, the partner\'s remaining limit does not change, and the source is limited after {{ANON_LIMIT_PER_MIN}}' },
    },
    {
      id: 'req-key-ip', label: 'Addresses counted fairly', when: { KEY: ['ip'] }, ears_type: 'ubiquitous',
      action: 'count IPv4 callers per address and IPv6 callers per /64 prefix, take the address only from the trusted proxy\'s header, and give the addresses on an allow-list of known shared egress (offices, partners) their own higher limits',
      rationale: 'An address taken from any X-Forwarded-For value can be forged, and an IPv6 host owns a whole /64; shared addresses need room or real users are locked out (OWASP Denial of Service Cheat Sheet).',
      scenario: { label: 'Forged header ignored', given: 'a caller over its limit', when: 'it sends requests with a different X-Forwarded-For value each time, and then from other addresses in its /64', then: 'they are all counted against the same caller and refused' },
    },
    {
      id: 'req-shared-counters', label: 'One limit across instances', when: { WHERE: ['app'] }, ears_type: 'state-driven',
      precondition: 'the element runs on more than one instance',
      action: 'keep the counters in one shared store, so that the element as a whole accepts no more than {{LIMIT_PER_MIN}} requests a minute from one caller, within 10 %, and fall back to a per-instance limit rather than none when the store is unreachable',
      rationale: 'A limit counted per instance multiplies with every instance added; failing open would turn a store outage into an open door (OWASP Denial of Service Cheat Sheet).',
      scenario: { label: 'Limit holds on four instances', given: 'four instances behind a load balancer', when: 'one caller sends twice {{LIMIT_PER_MIN}} requests in a minute spread over all four', then: 'no more than {{LIMIT_PER_MIN}} plus 10 % are accepted in total' },
    },
    {
      id: 'req-bots-challenge', label: 'Repeated costly calls challenged', when: { BOTS: ['challenge'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'one source calls one of {{COSTLY_OPS}} more than 10 times in 10 minutes',
      action: 'ask for a challenge (Turnstile, hCaptcha or reCAPTCHA) before going on, and never for the first attempt',
      rationale: 'Bots go for what costs us or helps them; a challenge after repetition stops automation without taxing real users (OWASP Automated Threats OAT-007 Credential Cracking, OAT-008 Credential Stuffing, OAT-019 Account Creation).',
      scenario: { label: 'Bot challenged', given: 'one source', when: 'it calls the first of {{COSTLY_OPS}} 11 times in 10 minutes', then: 'the 11th attempt is answered with a challenge, and a new source\'s first attempt is not' },
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
      rationale: 'Without bot protection, the only defence for a costly operation is that nobody anonymous can reach it (OWASP API6:2023 Unrestricted Access to Sensitive Business Flows).',
      scenario: { label: 'Anonymous costly call refused', given: 'a caller without a credential', when: 'it calls the first of {{COSTLY_OPS}}', then: 'it is refused with 401' },
    },
    {
      id: 'req-internet', label: 'Floods absorbed at the edge', when: { EXPOSURE: ['internet'] }, ears_type: 'ubiquitous',
      action: 'accept internet traffic only through the provider\'s edge with volumetric DDoS protection, and refuse connections to the origin from anywhere else',
      rationale: 'A flood measured in gigabits cannot be limited by the element it is aimed at; an origin reachable directly bypasses every edge rule (OWASP Denial of Service Cheat Sheet).',
      scenario: { label: 'Origin hidden', given: 'the element behind its edge', when: 'its origin address is called directly from the internet', then: 'the connection is refused' },
    },
    {
      id: 'req-partners', label: 'Limits per partner', when: { EXPOSURE: ['partners'] }, ears_type: 'state-driven',
      precondition: 'a partner has used more than 80 % of its agreed limit for 15 minutes',
      action: 'alert the partner\'s owner on our side, so that the limit is raised by agreement or the partner is told before it is refused',
      rationale: 'Limits per partner are agreements, not just defences; a partner that hits its limit unannounced is an outage for its users (OWASP API4:2023).',
      scenario: { label: 'Near the limit', given: 'a partner with an agreed limit', when: 'it runs at 85 % of it for 15 minutes', then: 'its owner on our side is alerted' },
    },
    {
      id: 'req-internal', label: 'Reachable only inside', when: { EXPOSURE: ['internal'] }, ears_type: 'ubiquitous',
      action: 'accept connections only from our own network, with no public address and no route from the internet',
      rationale: 'Not reachable is the strongest limit; the decision records it so that exposing the element later is a decision too.',
      scenario: { label: 'Closed from outside', given: 'the element deployed', when: 'its addresses and ports are scanned from outside the network', then: 'none answers' },
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
      decision: 'The element limits each caller, counted by {{KEY}}, to {{LIMIT_PER_MIN}} requests a minute using {{ALGORITHM}}, in middleware that runs before any handler, with counters in a shared Redis; bodies over {{MAX_BODY_KB}} KB are refused by the server\'s own limit. The excess gets 429 and Retry-After. The element is reachable by {{EXPOSURE}}; bots on costly operations: {{BOTS}}. Choosing the library: the framework\'s own (ASP.NET Core rate limiting, Spring Cloud Gateway RequestRateLimiter) or a maintained one with a Redis store (Bucket4j for Java, express-rate-limit with rate-limit-redis for Node, django-ratelimit for Python); judge by its algorithms, atomic shared counters and per-route configuration.',
      consequences: '• Limits can follow business data: plan, tenant, operation cost.\n• A request has already reached the element when it is refused: floods still need protection in front.\n• Redis is on the request path; when it is unreachable, the per-instance fallback limits less exactly.',
      alternatives: '1. At the API gateway: before the element, but blind to business data.\n2. At the edge WAF: earliest and cheapest, approximate.',
    },
    {
      id: 'adr-internal', label: 'Not reachable from outside', when: { EXPOSURE: ['internal'] },
      decision: 'The element accepts connections only from our own network: no public address, security groups or network policies admit only the internal callers listed in the model. Exposing it later supersedes this decision and brings the edge protection the internet needs.',
      consequences: '• Nothing outside can flood or scrape it.\n• Internal callers are still limited, against retry storms and runaway jobs.\n• Every new caller needs a network rule, which shows up in review.',
      alternatives: '1. Public with limits: needed only if outside callers appear.\n2. Reachable through a VPN for partners: closer to the partners option than to this one.',
    },
  ],
  fitness: [
    {
      id: 'ff-noisy', label: 'Noisy caller contained', category: 'operational', implements: WHERE,
      threshold: 'With one caller at 10 times {{LIMIT_PER_MIN}} requests a minute, other callers\' 95th percentile stays within 10 % of the baseline and at least 99 % of the flood\'s excess gets 429 with Retry-After',
      description: 'A load test in the staging environment runs normal traffic from several callers and a flood from one, and compares the others\' response times with a baseline run without the flood.',
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
    'checks{scenario:flood}': ['rate>0.89'], // 90 % of the flood is excess
  },
}

export default function () {
  const res = http.get(\`\${__ENV.BASE_URL}/orders\`, { headers: { Authorization: \`Bearer \${__ENV['TOKEN_' + __ENV.KEY]}\` } })
  if (__ENV.KEY === 'flood') check(res, { 'limited with Retry-After': (r) => r.status === 429 && !!r.headers['Retry-After'] })
}`,
    },
    {
      id: 'ff-body', label: 'Oversized bodies refused', category: 'structural', implements: WHERE,
      threshold: 'A body of 100 times {{MAX_BODY_KB}} KB is answered with 413 on 100 % of the element\'s write operations',
      description: 'A smoke test after each deployment sends an oversized body to each write operation and expects 413, which fails when a new route or a proxy change drops the size limit.',
      tool: 'curl in the deployment pipeline',
      language: 'bash',
      snippet: `size_kb=$(( {{MAX_BODY_KB}} * 100 ))
for route in $(cat write-routes.txt); do
  code=$(head -c "\${size_kb}K" /dev/zero | curl -s -o /dev/null -w '%{http_code}' \\
    -X POST -H 'Content-Type: application/json' --data-binary @- "$BASE_URL$route")
  [ "$code" = 413 ] || { echo "$route answered $code to an oversized body"; exit 1; }
done`,
    },
    {
      id: 'ff-gateway', label: 'Every route limited', when: { WHERE: ['gateway'] }, category: 'structural', implements: ['adr-gateway'],
      threshold: '0 gateway services without a rate-limiting plugin; 0 limits above {{LIMIT_PER_MIN}} a minute without an exception recorded',
      description: 'A Conftest policy over the gateway\'s declarative configuration (Kong decK file) fails the pull request when a service has no rate limit, or one higher than agreed.',
      tool: 'Conftest (Open Policy Agent) over the Kong decK configuration',
      language: 'rego',
      snippet: `package main

import rego.v1

limited(s) if { some p in s.plugins; p.name in {"rate-limiting", "rate-limiting-advanced"} }
global if { some p in input.plugins; p.name in {"rate-limiting", "rate-limiting-advanced"} }

deny contains msg if {
  not global
  some s in input.services
  not limited(s)
  msg := sprintf("service %s has no rate limit", [s.name])
}

deny contains msg if {
  some s in input.services
  some p in s.plugins
  p.name == "rate-limiting"
  p.config.minute > {{LIMIT_PER_MIN}}
  msg := sprintf("service %s allows %d a minute", [s.name, p.config.minute])
}`,
    },
    {
      id: 'ff-waf', label: 'Edge rate rule present', when: { WHERE: ['waf'] }, category: 'structural', implements: ['adr-waf'],
      threshold: 'Every web ACL in front of the element holds a rate-based rule in blocking mode; 0 plan changes that remove it',
      description: 'A Conftest policy over the Terraform plan fails when a WAF web ACL has no rate-based rule that blocks, so the edge limit cannot disappear in a refactoring.',
      tool: 'Conftest (Open Policy Agent) over terraform show -json',
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
      id: 'ff-app', label: 'Limit holds across instances', when: { WHERE: ['app'] }, category: 'structural', implements: ['adr-app'],
      threshold: 'Against two instances sharing Redis, request {{LIMIT_PER_MIN}} + 1 within a minute gets 429 with Retry-After; another caller\'s request still succeeds',
      description: 'An integration test starts two instances of the element with a Redis container, spreads one caller\'s requests over both, and expects the limit to hold for the pair.',
      tool: 'Vitest with supertest and Testcontainers (Redis)',
      language: 'ts',
      snippet: `it('limits one caller across instances', async () => {
  const [a, b] = await startInstances(2, { redisUrl: redis.getConnectionUrl() })
  for (let i = 0; i < {{LIMIT_PER_MIN}}; i++) await request(i % 2 ? a : b).get('/orders').set(auth(caller)).expect(200)
  const res = await request(a).get('/orders').set(auth(caller))
  expect(res.status).toBe(429)
  expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
  await request(b).get('/orders').set(auth(otherCaller)).expect(200)
})`,
    },
    {
      id: 'ff-bots-challenge', label: 'Repeated sign-in challenged', when: { BOTS: ['challenge'] }, category: 'structural', implements: WHERE,
      threshold: 'The 11th attempt at a costly operation from one source within 10 minutes shows a challenge; the 1st attempt from a new source never does',
      description: 'An end-to-end test repeats the first costly operation from one browser context and expects the challenge widget on the 11th attempt, and none in a fresh context.',
      tool: 'Playwright',
      language: 'ts',
      snippet: `test('repeated sign-in is challenged', async ({ page, browser }) => {
  for (let i = 0; i < 11; i++) {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill('someone@example.com')
    await page.getByLabel('Password').fill(\`wrong-\${i}\`)
    await page.getByRole('button', { name: 'Sign in' }).click()
  }
  await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toBeVisible()
  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto('/sign-in')
  await expect(fresh.locator('iframe[src*="challenges.cloudflare.com"]')).toHaveCount(0)
})`,
    },
    {
      id: 'ff-bots-managed', label: 'Bot control enabled', when: { BOTS: ['managed'] }, category: 'structural', implements: WHERE,
      threshold: 'The web ACL in front of the element holds the managed bot rule group, not in count-only mode',
      description: 'A Conftest policy over the Terraform plan fails when the edge\'s managed bot rule group is missing or overridden to count, which would let bots through silently.',
      tool: 'Conftest (Open Policy Agent) over terraform show -json, for AWS WAF Bot Control',
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
      id: 'ff-closed', label: 'Closed from outside', when: { EXPOSURE: ['internal'] }, category: 'operational', implements: ['adr-internal'],
      threshold: '0 ports of the element answer from outside the network',
      description: 'A scheduled scan from a runner outside the network tries every port of the element\'s addresses and fails on any that answers.',
      tool: 'Nmap',
      language: 'bash',
      snippet: `nmap -Pn -p- --open -oG scan.txt $ELEMENT_ADDRESSES
if grep -q '/open/' scan.txt; then
  echo "reachable from outside:"; grep '/open/' scan.txt; exit 1
fi`,
    },
  ],
}

export default pack
