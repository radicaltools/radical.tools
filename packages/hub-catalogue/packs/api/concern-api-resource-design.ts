import type { PackSpec } from '../../src/packSpec'

const MAIN = ['adr-camel', 'adr-snake']
const FORCES = 'Other parts of the system and outside systems call this element over HTTP, and each caller learns its conventions once and then expects them everywhere. The forces: field and path names that change style from one operation to the next make every client mapping a special case; methods that do not mean what HTTP says break caches, proxies and retries (a GET that changes state is repeated by anything on the way, a POST retried after a timeout creates twice); status codes chosen by taste make every caller write its own handling; operations that are not create, read, update or delete need a home that does not turn the API into remote procedure calls; work that takes longer than a gateway waits needs a way to finish without holding the connection; and conventions hold only while a linter enforces them on every pull request. Which published guide the API follows as a whole is decided in the API style guide pack; error bodies, collections, and idempotency keys with preconditions in the Errors, Collections, and Idempotency and concurrency packs; versions and deprecation in the API evolution pack; 429 and request limits in the Rate limiting pack.'

const pack: PackSpec = {
  id: 'concern-api-resource-design',
  name: 'Resource design',
  group: 'api',
  description: 'How an HTTP API\'s resources look to its callers: how fields and paths are named, what each method and status code means, where operations that are not create, read, update or delete go, and how work that outlasts a request reports its outcome. The snippets lint the OpenAPI document with Spectral and test the running API with Vitest and supertest.',
  tags: ['api', 'rest', 'http', 'resource design', 'openapi', 'spectral'],
  concern: {
    id: 'api-resource-design',
    trigger: 'LIST RELATIONS WHERE source.type != "person" AND target.external != true AND (target.type = "container" OR target.type = "component")',
    applyTo: 'target',
    why: 'other parts and systems call these elements over an API, so how its resources, paths, fields, methods and status codes look has to be decided.',
  },
  sources: [
    { title: 'RFC 9110, HTTP Semantics (9.2 method properties, 10.2 Allow and Location, 15 status codes)', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
    { title: 'RFC 3339, Date and Time on the Internet: Timestamps', url: 'https://www.rfc-editor.org/rfc/rfc3339' },
    { title: 'RFC 7396, JSON Merge Patch', url: 'https://www.rfc-editor.org/rfc/rfc7396' },
    { title: 'Microsoft Azure REST API Guidelines', url: 'https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md' },
    { title: 'Zalando RESTful API and Event Guidelines', url: 'https://opensource.zalando.com/restful-api-guidelines/' },
    { title: 'Google AIP-122, Resource names', url: 'https://google.aip.dev/122' },
    { title: 'Google AIP-136, Custom methods', url: 'https://google.aip.dev/136' },
    { title: 'Google AIP-140, Field names', url: 'https://google.aip.dev/140' },
    { title: 'Google AIP-151, Long-running operations', url: 'https://google.aip.dev/151' },
    { title: 'Standard Webhooks specification', url: 'https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md' },
    { title: 'Spectral: rulesets and core functions', url: 'https://docs.stoplight.io/docs/spectral/cb95cf0d26b83-core-functions' },
  ],
  questions: [
    {
      key: 'CASING', title: 'Field casing', label: 'How are JSON fields and query parameters named?',
      hint: 'The casing of fields shows in every client and every log line, and changing it later breaks every caller. If the API style guide pack adopted a published guide, answer as it does: Microsoft and Google use camelCase in JSON, Zalando snake_case.',
      default: 'camel',
      options: [
        { value: 'camel', label: 'camelCase', description: 'customerId, createdAt, as the Microsoft Azure guidelines and Google\'s JSON mapping of field names write them. Pick it when callers are mostly JavaScript, TypeScript, Java or .NET, whose serializers produce it by default, or when the API sits beside Microsoft or Google APIs.' },
        { value: 'snake', label: 'snake_case', description: 'customer_id, created_at, as the Zalando guidelines require. Pick it when callers and services are mostly Python or Ruby, or when the organisation already follows the Zalando guidelines.' },
      ],
    },
    {
      key: 'PATHS', title: 'Paths', label: 'How are words joined in a path segment?',
      hint: 'Paths are the first thing a caller reads and the hardest thing to change. The guides agree on plural nouns, identifiers in braces and a limit on nesting (set in the details); they differ on how the words of one segment are joined.',
      default: 'kebab',
      options: [
        { value: 'kebab', label: 'kebab-case path segments', description: '/sales-orders/{orderId}/line-items: the Zalando guidelines require it and the Azure guidelines prefer it. Pick it by default: URLs are case-sensitive, and lower-case words joined by hyphens are the easiest to read, type and say aloud.' },
        { value: 'camel', label: 'camelCase path segments', description: '/salesOrders/{orderId}/lineItems: Google\'s resource names (AIP-122) require it and the Azure guidelines allow it. Pick it when the API follows Google\'s AIPs or its paths come from gRPC transcoding, where collection identifiers are camelCase.' },
      ],
    },
    {
      key: 'ACTIONS', title: 'Actions', label: 'Where do operations that are not create, read, update, delete or list go?',
      hint: 'Cancel, approve, resend: some operations are not a plain write of a resource. The guides disagree here more than anywhere else, so the API has to pick one way and use it everywhere.',
      default: 'custom',
      options: [
        { value: 'custom', label: 'custom methods (POST /orders/{orderId}:cancel)', description: 'A POST to the resource\'s path followed by a colon and a verb, as Google AIP-136 and the Azure guidelines\' action operations do. Pick it when actions have inputs and side effects of their own and the verb should be visible in the path, the logs and the authorization rules.' },
        { value: 'resource', label: 'action resources (POST /orders/{orderId}/cancellations)', description: 'Each action becomes a noun resource that records it, created with POST and readable afterwards, so paths stay verb-free as the Zalando guidelines require. Pick it when the record of the action matters (who cancelled, when, why) or the organisation follows the Zalando guidelines.' },
        { value: 'patch', label: 'status changes by PATCH', description: 'An action is a write of the resource\'s status field, checked against the allowed transitions; a transition that is not allowed answers 409. Pick it when actions are mostly moves through a lifecycle with no input beyond the new status, and the API should stay plain create, read, update and delete.' },
      ],
    },
    {
      key: 'LRO', title: 'Long-running work', label: 'How does work that takes longer than a request report its outcome?',
      hint: 'Gateways and load balancers cut long requests off (Amazon API Gateway after 29 seconds by default, a load balancer\'s idle timeout often after 60), and clients give up sooner. Work that can take longer must answer at once and report its outcome another way. The limit in seconds is set in the details.',
      default: 'operation',
      options: [
        { value: 'operation', label: 'an operation resource to poll', description: 'The request answers 202 Accepted with an Operation-Location header; the caller polls /operations/{operationId} until its status is Succeeded, Failed or Canceled. This is the Azure status monitor and Google\'s AIP-151 operation. Pick it by default: any caller can follow it, with nothing of its own to host.' },
        { value: 'callback', label: 'a signed callback when the work ends', description: 'The request answers 202 Accepted; when the work ends, its outcome is POSTed to the https URL the calling system registered, signed as the Standard Webhooks specification describes, and retried until it is accepted. Pick it for partners who run servers of their own and would otherwise poll many operations.' },
        { value: 'none', label: 'no long-running operations', description: 'Every operation finishes within the request and answers with its result; nothing answers 202. Pick it when no operation comes near the limit, and record it so that the first slow one becomes a decision, not a surprise.' },
      ],
    },
  ],
  details: [
    { key: 'MAX_LEVELS', label: 'How many collections deep may a path go, the top-level collection included?', default: '3', number: true },
    { key: 'SYNC_SECONDS', label: 'Above how many seconds must work run as a long-running operation? (a bucket boundary of the request-duration histogram)', default: '10', number: true },
    { key: 'OPERATION_DAYS', label: 'For how many days can a finished operation still be read? (an operation resource to poll only)', default: '30', number: true },
    { key: 'CALLBACK_HOURS', label: 'For how many hours is a failed callback retried? (a signed callback only)', default: '72', number: true },
  ],
  need: {
    label: 'Callers can predict the API',
    text: 'Other parts of the system and outside systems call this element over HTTP and JSON. Each caller learns the API\'s conventions once and builds on them: a field named in another style, a path that hides a verb, a GET that changes something, a 200 where a 201 or a 404 belongs, or a request that hangs for minutes each costs every caller a special case, a retry that does harm, or a timeout. The snippets assume the OpenAPI document at api/openapi.yaml, linted by Spectral with the ruleset .spectral.yaml at the repository root (each check adds its rules to it), the application exported by src/app, and the HTTP tests under test/api with their fixtures in test/api/fixtures.ts.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-casing', label: 'One casing for fields', ears_type: 'ubiquitous',
      action: 'name every property of a request or response body and every query parameter in {{CASING}}, with acronyms cased as ordinary words, so that 0 names in the published contract break the rule',
      rationale: 'One casing across every operation lets callers map fields mechanically and keeps generated clients uniform; Microsoft and Google write JSON fields in camelCase, Zalando in snake_case (Azure REST API Guidelines, JSON field name casing; Google AIP-140; Zalando rules 118 and 130).',
      scenario: { label: 'Other casing refused', given: 'the OpenAPI document of the API', when: 'a pull request adds a property and a query parameter named in another casing', then: 'the lint step fails and names both' },
    },
    {
      id: 'req-paths', label: 'Paths are plural nouns', ears_type: 'ubiquitous',
      action: 'address every resource as a collection named by a plural noun followed by its identifier in braces (/orders/{orderId}), with {{PATHS}}, at most {{MAX_LEVELS}} collections deep, with no trailing slash and no verb as a path segment',
      rationale: 'Predictable paths let a caller guess the next one; deep nesting makes long URLs that break when ownership changes (Zalando rules 129, 134, 141 and 147; Azure REST API Guidelines, URL casing; Google AIP-122).',
      scenario: { label: 'Bad paths refused', given: 'the OpenAPI document of the API', when: 'a pull request adds a singular collection, a path ending in a slash, a path with /cancel as a segment, and one nested a collection deeper than {{MAX_LEVELS}}', then: 'the lint step fails for each of the four' },
    },
    {
      id: 'req-methods', label: 'Methods mean what HTTP says', ears_type: 'ubiquitous',
      action: 'use GET and HEAD only for reads that change nothing and carry no request body, make PUT and DELETE idempotent so that repeating one leaves the resource as the first left it, answer a successful DELETE with 204 and no body, and from then on answer a read of the deleted resource with 404, or 410 where the deletion is recorded',
      rationale: 'Caches, proxies and client retries rely on safe and idempotent methods meaning what RFC 9110 says (RFC 9110 9.2.1, 9.2.2, 15.3.5, 15.5.5 and 15.5.11; Zalando rule 148).',
      scenario: { label: 'Methods behave', given: 'an existing order', when: 'it is read twice, replaced twice with the same body, deleted, and read again', then: 'both reads return the same body, both replacements leave the same state, the delete answers 204 without a body, and the last read answers 404 or 410' },
    },
    {
      id: 'req-create', label: 'Created resources located', ears_type: 'event-driven',
      trigger: 'a POST to a collection creates a resource',
      action: 'answer 201 Created with a Location header holding the new resource\'s URL and the resource in the body',
      rationale: 'The Location header is how a caller learns the identifier the server chose without parsing the body (RFC 9110 15.3.2 and 10.2.2; Azure REST API Guidelines, POST returns 201 with the URL of the created resource).',
      scenario: { label: 'Create answers 201', given: 'a valid new order', when: 'it is posted to /orders', then: 'the answer is 201 with a Location header, and a GET of that URL returns the order' },
    },
    {
      id: 'req-unsupported', label: 'Unsupported requests refused', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request uses a method its path does not support, or sends a body in a media type the operation does not accept',
      action: 'answer 405 with an Allow header that lists the supported methods, or 415, before any part of the operation runs, with the error body the Errors pack decides',
      rationale: 'A precise status tells the caller what to fix; RFC 9110 requires the Allow header with 405 (RFC 9110 15.5.6, 15.5.16 and 10.2.1; Zalando rule 220, most specific status codes).',
      scenario: { label: 'Wrong method and media type', given: 'the /orders collection, which supports GET and POST', when: 'it is sent a PATCH, and a POST with Content-Type text/plain', then: 'the PATCH answers 405 with Allow naming GET and POST, and the POST answers 415' },
    },
    {
      id: 'req-formats', label: 'Timestamps in UTC, identifiers as strings', ears_type: 'ubiquitous',
      action: 'write every timestamp as an RFC 3339 date-time in UTC ending in Z (2026-10-29T14:05:00Z), declared with format date-time in the contract, and every identifier as an opaque string the server generates, declared as type string and never as a number',
      rationale: 'One timestamp format parses the same in every language, and UTC removes offsets from comparisons; numeric identifiers overflow in JavaScript and invite callers to guess or sort them (RFC 3339 section 5.6; Azure REST API Guidelines, RFC 3339 for date and time; Zalando rules 169 and 174).',
      scenario: { label: 'Formats hold', given: 'an order read from the API and the contract that describes it', when: 'its timestamps and identifiers are checked', then: 'every timestamp ends in Z and is declared date-time, and every identifier is a string in the answer and in the contract' },
    },
    {
      id: 'req-sync', label: 'Requests answered in time', ears_type: 'ubiquitous',
      action: 'answer at least 99% of the requests to each route within {{SYNC_SECONDS}} seconds, measured over any 5 minutes, and make any work that can take longer either faster or, where the decision on long-running work allows it, a long-running operation',
      rationale: 'A request held longer than the gateway or the client waits fails without a result while the work may still go on; long work answers at once instead (RFC 9110 15.3.3; Google AIP-151; Azure REST API Guidelines, long-running operations).',
      scenario: { label: 'Slow route flagged', given: 'a route whose requests take longer than {{SYNC_SECONDS}} seconds for more than 1% of them', when: '15 minutes pass', then: 'an alert names the route' },
    },
    {
      id: 'req-actions-custom', label: 'Actions as custom methods', when: { ACTIONS: ['custom'] }, ears_type: 'ubiquitous',
      action: 'expose each operation that is not create, read, update, delete or list as a custom method, a path ending in a colon and a camelCase verb (POST /orders/{orderId}:cancel, POST /orders:import), called with POST, or with GET when it only reads, and never with PUT, PATCH or DELETE',
      rationale: 'A custom method keeps the verb out of the resource hierarchy and its HTTP method honest about side effects (Google AIP-136; Azure REST API Guidelines, action operations).',
      scenario: { label: 'Custom method shape', given: 'the OpenAPI document of the API', when: 'a pull request adds PUT /orders/{orderId}:cancel and POST /orders/{orderId}/cancel', then: 'the lint step fails for both; POST /orders/{orderId}:cancel passes' },
    },
    {
      id: 'req-actions-resource', label: 'Actions as resources', when: { ACTIONS: ['resource'] }, ears_type: 'ubiquitous',
      action: 'model each operation that is not create, read, update, delete or list as a noun resource that records it (POST /orders/{orderId}/cancellations creates a cancellation and answers 201 with its Location), so that 0 paths carry a verb or a colon',
      rationale: 'The API describes resources and the only place for actions is the HTTP method; a letter box for each action keeps URLs verb-free and leaves a record (Zalando rules 138 and 141).',
      scenario: { label: 'Action recorded as resource', given: 'the OpenAPI document of the API', when: 'a pull request adds POST /orders/{orderId}:cancel, and another adds POST /orders/{orderId}/cancellations answering 201 with Location', then: 'the lint step fails for the first and passes the second' },
    },
    {
      id: 'req-actions-patch', label: 'Actions as status changes', when: { ACTIONS: ['patch'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a PATCH asks for a status its resource cannot move to from the current one',
      action: 'answer 409 Conflict and leave the resource unchanged; change state otherwise only by a PATCH of the status field (JSON Merge Patch), with no action paths',
      rationale: 'A forbidden transition conflicts with the resource\'s current state, which is what 409 says; Merge Patch keeps the write a plain update (RFC 9110 15.5.10; RFC 7396; Zalando rule 148).',
      scenario: { label: 'Forbidden transition refused', given: 'a cancelled order', when: 'a PATCH sets its status to shipped', then: 'the answer is 409 and the order is still cancelled' },
    },
    {
      id: 'req-lro-operation', label: 'Long work polled as an operation', when: { LRO: ['operation'] }, ears_type: 'event-driven',
      trigger: 'an operation is started that can take longer than {{SYNC_SECONDS}} seconds',
      action: 'answer 202 Accepted at once with an Operation-Location header naming /operations/{operationId}, whose GET returns the status (NotStarted, Running, Succeeded, Failed or Canceled) with a Retry-After header until the work ends, the error when it failed, and stays readable for {{OPERATION_DAYS}} days after it ended',
      rationale: 'The caller gets an answer before any timeout and a resource it can poll at the pace the server sets (Azure REST API Guidelines, long-running operations and status monitor; Google AIP-151, including its rule of thumb of 30 days before an operation expires; Zalando rule 253; RFC 9110 15.3.3).',
      scenario: { label: 'Operation polled to the end', given: 'a report that takes a minute to build', when: 'it is requested and the Operation-Location is polled as Retry-After says', then: 'the request answers 202 at once, the polls show Running and then Succeeded, and the operation is still readable {{OPERATION_DAYS}} days later' },
    },
    {
      id: 'req-lro-callback', label: 'Long work reported by callback', when: { LRO: ['callback'] }, ears_type: 'event-driven',
      trigger: 'an operation that can take longer than {{SYNC_SECONDS}} seconds is started and later ends',
      action: 'answer the start with 202 Accepted and the operation\'s id, then POST the outcome to the https URL registered for the calling system, signed as Standard Webhooks specifies (webhook-id, webhook-timestamp and an HMAC-SHA256 webhook-signature), and retry with the same webhook-id for {{CALLBACK_HOURS}} hours until the receiver answers 2xx',
      rationale: 'The receiver can prove the message came from us and was not replayed, and drop a retried one by its id; a schedule over days survives the receiver\'s outages (Standard Webhooks specification: signatures, retries, idempotency; RFC 9110 15.3.3).',
      scenario: { label: 'Callback retried and signed', given: 'a registered receiver that fails its first delivery', when: 'a long operation is started and ends', then: 'the start answers 202, and the receiver gets the outcome twice with the same webhook-id and a valid signature' },
    },
  ],
  adrs: [
    {
      id: 'adr-camel', label: 'Resource conventions with camelCase fields', when: { CASING: ['camel'] },
      decision: 'The API\'s resources follow one set of conventions, enforced on api/openapi.yaml by Spectral in every pull request and tested on the running API. Fields and query parameters are camelCase, acronyms as words (customerId, httpUrl), as the Azure guidelines and Google\'s JSON mapping write them. Paths: {{PATHS}}, collections as plural nouns, identifiers in braces, at most {{MAX_LEVELS}} collections deep. Methods as RFC 9110 defines them: GET and HEAD safe, PUT and DELETE idempotent, a POST that creates answers 201 with Location, DELETE answers 204, an unknown resource 404, an unsupported method 405 with Allow, a media type not accepted 415. Timestamps are RFC 3339 in UTC (format date-time), identifiers opaque strings. Operations that are not create, read, update, delete or list: {{ACTIONS}}. Long-running work: {{LRO}}.',
      consequences: '• JavaScript, Java (Jackson) and .NET (System.Text.Json with web defaults) produce camelCase by default, so most clients need no naming policy.\n• Python and Ruby services map names at the edge (pydantic\'s to_camel alias generator, for one), and database columns in snake_case never leak into the contract.\n• Spectral fails the pull request on any break of the rules; an existing API in another casing needs a new version or a recorded exception, decided in the API evolution pack.\n• The rules check the contract; the HTTP tests check that the running API matches it.',
      alternatives: '1. snake_case fields, as Zalando requires: natural for Python and SQL, but every JavaScript, Java and .NET client configures a naming policy.\n2. Each service its own casing: no decision to make, and callers of two services learn two styles.\n3. PascalCase, as older OData services use: unusual in JSON and a third style for callers.',
    },
    {
      id: 'adr-snake', label: 'Resource conventions with snake_case fields', when: { CASING: ['snake'] },
      decision: 'The API\'s resources follow one set of conventions, enforced on api/openapi.yaml by Spectral in every pull request and tested on the running API. Fields and query parameters are snake_case (customer_id, created_at), as the Zalando guidelines require. Paths: {{PATHS}}, collections as plural nouns, identifiers in braces, at most {{MAX_LEVELS}} collections deep. Methods as RFC 9110 defines them: GET and HEAD safe, PUT and DELETE idempotent, a POST that creates answers 201 with Location, DELETE answers 204, an unknown resource 404, an unsupported method 405 with Allow, a media type not accepted 415. Timestamps are RFC 3339 in UTC (format date-time), identifiers opaque strings. Operations that are not create, read, update, delete or list: {{ACTIONS}}. Long-running work: {{LRO}}.',
      consequences: '• Python, Ruby and column names carry over without mapping.\n• JavaScript, Java and .NET clients configure a naming policy (Jackson\'s PropertyNamingStrategies.SNAKE_CASE, JsonNamingPolicy.SnakeCaseLower in .NET 8) or work with snake_case properties.\n• Callers that also use Microsoft or Google APIs meet two casings.\n• Spectral fails the pull request on any break of the rules; an existing API in another casing needs a new version or a recorded exception, decided in the API evolution pack.',
      alternatives: '1. camelCase fields, as the Azure guidelines and Google\'s JSON mapping use: no naming policy in JavaScript, Java or .NET, but a mapping in Python and Ruby.\n2. Each service its own casing: no decision to make, and callers of two services learn two styles.',
    },
    {
      id: 'adr-actions-custom', label: 'Actions as custom methods', when: { ACTIONS: ['custom'] },
      decision: 'An operation that is not create, read, update, delete or list is a custom method: the resource\'s path followed by a colon and a camelCase verb, called with POST (POST /orders/{orderId}:cancel; on a collection, POST /orders:import), or with GET when it only reads. The body carries the method\'s input and the answer the resource after the change. A custom method is used only where a standard method cannot express the operation (Google AIP-136; Azure guidelines, action operations), identifiers never contain a colon, and no path segment is a verb.',
      consequences: '• The verb shows in the path, in access logs and in authorization rules per operation.\n• Some routers and gateways read a colon in a path as a parameter marker; check once that yours match /orders/{orderId}:cancel, and escape or rewrite the route if not.\n• Nothing records that the action happened unless the resource or an audit log does.',
      alternatives: '1. Action resources (POST /orders/{orderId}/cancellations): verb-free and recorded, but a noun for every action.\n2. Status changes by PATCH: no new paths, but side effects hide behind a field write.\n3. A verb as a sub-resource (POST /orders/{orderId}/cancel), as OData actions do: familiar, but it looks like a collection and breaks the verb-free path rule.',
    },
    {
      id: 'adr-actions-resource', label: 'Actions as resources', when: { ACTIONS: ['resource'] },
      decision: 'An operation that is not create, read, update, delete or list is modelled as a resource that records it: POST /orders/{orderId}/cancellations creates a cancellation (201 with Location, the reason and the actor in the body) and GET lists them. Paths carry no verbs and no colons (Zalando rules 138 and 141).',
      consequences: '• Every action leaves a record that can be read, listed and audited.\n• A noun has to be found for every action, and some are awkward (a recalculation, a resend).\n• Each action resource is one more thing to secure, page and keep.',
      alternatives: '1. Custom methods (POST /orders/{orderId}:cancel): the verb is plain to see, but the path is no longer verb-free and nothing is recorded.\n2. Status changes by PATCH: fewer paths, but no room for the action\'s own input.',
    },
    {
      id: 'adr-actions-patch', label: 'Actions as status changes', when: { ACTIONS: ['patch'] },
      decision: 'A change of state is a write of the resource\'s status field with PATCH and application/merge-patch+json (RFC 7396): PATCH /orders/{orderId} with {"status": "cancelled"}. The allowed transitions are kept in one table in the code and listed in the status field\'s description in the contract; a transition the table does not allow answers 409 Conflict and changes nothing. There are no action paths.',
      consequences: '• No new paths: the API stays create, read, update and delete.\n• Side effects (a refund, an e-mail) hang off a field write, so they must be described on the field.\n• Input an action needs beyond the new status (a reason, an amount) goes into the same PATCH body, or does not fit.\n• Two callers changing the status at once need a precondition, decided in the Idempotency and concurrency pack.',
      alternatives: '1. Custom methods (POST /orders/{orderId}:cancel): room for the action\'s input, at the cost of a path per action.\n2. Action resources (POST /orders/{orderId}/cancellations): a record of each action, at the cost of a resource per action.',
    },
    {
      id: 'adr-lro-operation', label: 'Long work as operations to poll', when: { LRO: ['operation'] },
      decision: 'Work that can take longer than {{SYNC_SECONDS}} seconds answers 202 Accepted at once with an absolute Operation-Location header naming /operations/{operationId}. The operation carries id, status (NotStarted, Running, Succeeded, Failed or Canceled), and the result or the error when it ends; its GET sends Retry-After while the work runs, and a finished operation stays readable for {{OPERATION_DAYS}} days. This is the Azure guidelines\' status monitor; Google\'s AIP-151 operation (name, done, response or error) is the same shape under other names.',
      consequences: '• Any caller can follow it with plain GETs, and nothing has to be hosted on the caller\'s side.\n• Callers poll; Retry-After keeps the polling at the pace the server chooses.\n• Operations are stored for {{OPERATION_DAYS}} days and need their own clean-up and access control: only the caller that started one may read it.',
      alternatives: '1. A signed callback when the work ends: no polling, but the caller must run a reachable endpoint.\n2. Holding the request open: simple, and cut off by the first gateway timeout.',
    },
    {
      id: 'adr-lro-callback', label: 'Long work reported by signed callbacks', when: { LRO: ['callback'] },
      decision: 'Work that can take longer than {{SYNC_SECONDS}} seconds answers 202 Accepted with the operation\'s id. When it ends, its outcome is POSTed to the https URL registered for the calling system (never a URL taken from the request), signed as the Standard Webhooks specification describes (webhook-id, webhook-timestamp and webhook-signature, HMAC-SHA256 with a secret per caller), and retried with exponential backoff for {{CALLBACK_HOURS}} hours until the receiver answers 2xx. The webhook-id stays the same across retries so the receiver can drop duplicates.',
      consequences: '• Callers learn the outcome without polling.\n• Callers need a reachable https endpoint and must verify signatures and timestamps.\n• A callback still undelivered after {{CALLBACK_HOURS}} hours is lost unless the caller can ask; tell the caller\'s owner when that happens.\n• Requests to callers\' URLs are a server-side request forgery risk; URLs registered ahead per caller, never taken from a request, keep it bounded.',
      alternatives: '1. An operation resource to poll: nothing to host on the caller\'s side, at the cost of polling.\n2. Callbacks without signatures: simpler, and anyone who learns the URL can forge an outcome.',
    },
    {
      id: 'adr-lro-none', label: 'No long-running operations', when: { LRO: ['none'] },
      decision: 'Every operation finishes within {{SYNC_SECONDS}} seconds and answers with its final result; no operation answers 202. Work that would take longer is made smaller or split, or moved out of the API (a large export becomes a scheduled file). The first operation that cannot finish in time supersedes this decision.',
      consequences: '• Callers handle one kind of answer, and there is no operation store to keep.\n• Every operation must stay fast as data grows; the latency alert shows the first one that does not.\n• Adding long-running work later is a new decision, and its operations a change to the contract.',
      alternatives: '1. An operation resource to poll: room for slow work, at the cost of an operation store.\n2. A signed callback: room for slow work, at the cost of endpoints on the callers\' side.',
    },
  ],
  fitness: [
    {
      id: 'ff-casing-camel', label: 'Fields camelCase, formats declared', when: { CASING: ['camel'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-camel'], checks: ['req-casing', 'req-formats'],
      threshold: '0 properties or query parameters outside camelCase, 0 identifiers not typed string, 0 timestamp properties without format date-time, and 0 date-time examples outside UTC in api/openapi.yaml',
      description: 'Spectral lints the OpenAPI document in the pull-request build and fails on any error. Identifiers are the properties named id or ending in Id; timestamps those ending in At or Time.',
      tool: 'Spectral CLI (spectral lint api/openapi.yaml --fail-severity=error)',
      language: 'yaml',
      snippet: `# .spectral.yaml, with the path and contract rules beside these
formats: [oas3]
rules:
  field-names-camel-case:
    severity: error
    given: '$..properties[*]~'
    then: { function: casing, functionOptions: { type: camel } }
  query-parameters-camel-case:
    severity: error
    given: "$..parameters[?(@.in == 'query')].name"
    then: { function: casing, functionOptions: { type: camel } }
  ids-are-strings:
    severity: error
    given: '$..properties[?(@property.match(/^id$|Id$/))]'
    then: { field: type, function: enumeration, functionOptions: { values: [string] } }
  timestamps-are-date-time:
    severity: error
    given: '$..properties[?(@property.match(/(At|Time)$/))]'
    then: { function: schema, functionOptions: { schema: { required: [format], properties: { format: { const: date-time } } } } }
  timestamp-examples-in-utc:
    severity: error
    given: "$..properties[?(@.format == 'date-time')].example"
    then: { function: pattern, functionOptions: { match: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$' } }`,
    },
    {
      id: 'ff-casing-snake', label: 'Fields snake_case, formats declared', when: { CASING: ['snake'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-snake'], checks: ['req-casing', 'req-formats'],
      threshold: '0 properties or query parameters outside snake_case, 0 identifiers not typed string, 0 timestamp properties without format date-time, and 0 date-time examples outside UTC in api/openapi.yaml',
      description: 'Spectral lints the OpenAPI document in the pull-request build and fails on any error. Identifiers are the properties named id or ending in _id; timestamps those ending in _at or _time.',
      tool: 'Spectral CLI (spectral lint api/openapi.yaml --fail-severity=error)',
      language: 'yaml',
      snippet: `# .spectral.yaml, with the path and contract rules beside these
formats: [oas3]
rules:
  field-names-snake-case:
    severity: error
    given: '$..properties[*]~'
    then: { function: casing, functionOptions: { type: snake } }
  query-parameters-snake-case:
    severity: error
    given: "$..parameters[?(@.in == 'query')].name"
    then: { function: casing, functionOptions: { type: snake } }
  ids-are-strings:
    severity: error
    given: '$..properties[?(@property.match(/^id$|_id$/))]'
    then: { field: type, function: enumeration, functionOptions: { values: [string] } }
  timestamps-are-date-time:
    severity: error
    given: '$..properties[?(@property.match(/(_at|_time)$/))]'
    then: { function: schema, functionOptions: { schema: { required: [format], properties: { format: { const: date-time } } } } }
  timestamp-examples-in-utc:
    severity: error
    given: "$..properties[?(@.format == 'date-time')].example"
    then: { function: pattern, functionOptions: { match: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$' } }`,
    },
    {
      id: 'ff-paths-kebab', label: 'Paths kebab-case, plural, shallow', when: { PATHS: ['kebab'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MAIN, checks: ['req-paths'],
      threshold: '0 paths in api/openapi.yaml with a segment outside kebab-case, a trailing slash, a collection that is not plural, or more than {{MAX_LEVELS}} collections',
      description: 'Spectral checks every path of the OpenAPI document: segments are kebab-case words or {parameters}, collections end in s or are on the list of irregular plurals and singletons in the rule, and no path is deeper than the limit. A custom method\'s :verb at the end is let through here; the actions check decides whether it is allowed.',
      tool: 'Spectral CLI (spectral lint api/openapi.yaml --fail-severity=error)',
      language: 'yaml',
      snippet: `# .spectral.yaml, with the casing and contract rules beside these
formats: [oas3]
rules:
  path-segments-kebab-case:
    severity: error
    given: '$.paths[*]~'
    then: { function: pattern, functionOptions: { match: '^(/([a-z][a-z0-9]*(-[a-z0-9]+)*|\\{[a-z][A-Za-z0-9_]*\\}))+(:[a-z][A-Za-z]*)?$' } }
  path-collections-plural:
    message: '{{property}}: a collection is not a plural noun (add irregular plurals and singletons to the list)'
    severity: error
    given: '$.paths[*]~'
    then: { function: pattern, functionOptions: { match: '^(/([a-z0-9-]*s|people|children|data|media|me|\\{[^}]+\\}))+(:[A-Za-z]+)?$' } }
  path-nesting-depth:
    message: '{{property}} is more than {{MAX_LEVELS}} collections deep'
    severity: error
    given: '$.paths[*]~'
    then: { function: pattern, functionOptions: { notMatch: '^(/[^/{]+(/\\{[^}]+\\})?){{{MAX_LEVELS}}}/[^/{]' } }`,
    },
    {
      id: 'ff-paths-camel', label: 'Paths camelCase, plural, shallow', when: { PATHS: ['camel'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MAIN, checks: ['req-paths'],
      threshold: '0 paths in api/openapi.yaml with a segment outside camelCase, a trailing slash, a collection that is not plural, or more than {{MAX_LEVELS}} collections',
      description: 'Spectral checks every path of the OpenAPI document: segments are camelCase words or {parameters}, collections end in s or are on the list of irregular plurals and singletons in the rule, and no path is deeper than the limit. A custom method\'s :verb at the end is let through here; the actions check decides whether it is allowed.',
      tool: 'Spectral CLI (spectral lint api/openapi.yaml --fail-severity=error)',
      language: 'yaml',
      snippet: `# .spectral.yaml, with the casing and contract rules beside these
formats: [oas3]
rules:
  path-segments-camel-case:
    severity: error
    given: '$.paths[*]~'
    then: { function: pattern, functionOptions: { match: '^(/([a-z][a-zA-Z0-9]*|\\{[a-z][A-Za-z0-9_]*\\}))+(:[a-z][A-Za-z]*)?$' } }
  path-collections-plural:
    message: '{{property}}: a collection is not a plural noun (add irregular plurals and singletons to the list)'
    severity: error
    given: '$.paths[*]~'
    then: { function: pattern, functionOptions: { match: '^(/([a-zA-Z0-9]*s|people|children|data|media|me|\\{[^}]+\\}))+(:[A-Za-z]+)?$' } }
  path-nesting-depth:
    message: '{{property}} is more than {{MAX_LEVELS}} collections deep'
    severity: error
    given: '$.paths[*]~'
    then: { function: pattern, functionOptions: { notMatch: '^(/[^/{]+(/\\{[^}]+\\})?){{{MAX_LEVELS}}}/[^/{]' } }`,
    },
    {
      id: 'ff-contract', label: 'Contract follows HTTP semantics', characteristic: 'compatibility', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MAIN, checks: ['req-methods', 'req-create', 'req-paths'],
      threshold: '0 GET, HEAD or DELETE operations with a request body, 0 responses 201 without a Location header, 0 DELETE operations without a 204 or 202 response, 0 reads of one resource without a 404 response, and 0 paths with a verb as a segment in api/openapi.yaml',
      description: 'Spectral checks the methods and status codes the OpenAPI document declares against RFC 9110. The verb list is a start; add the verbs of your domain.',
      tool: 'Spectral CLI (spectral lint api/openapi.yaml --fail-severity=error)',
      language: 'yaml',
      snippet: `# .spectral.yaml, with the casing and path rules beside these
formats: [oas3]
rules:
  no-body-on-get-head-delete:
    severity: error
    given: '$.paths[*][get,head,delete]'
    then: { field: requestBody, function: falsy }
  created-names-location:
    severity: error
    given: "$.paths[*][post,put].responses['201']"
    then: { field: headers.Location, function: truthy }
  delete-answers-204:
    severity: error
    given: '$.paths[*].delete.responses'
    then: { function: or, functionOptions: { properties: ['204', '202'] } }
  read-declares-404:
    severity: error
    given: '$.paths[?(@property.match(/\\}$/))].get.responses'
    then: { field: '404', function: truthy }
  no-verb-segments:
    severity: error
    given: '$.paths[*]~'
    then: { function: pattern, functionOptions: { notMatch: '/(cancel|approve|reject|submit|send|activate|deactivate|archive|restore|publish|retry|start|stop|run|execute)(/|$)' } }`,
    },
    {
      id: 'ff-http', label: 'Running API keeps HTTP semantics', characteristic: 'compatibility', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MAIN, checks: ['req-methods', 'req-create', 'req-unsupported', 'req-formats'],
      threshold: 'POST /orders answers 201 with the order and a Location whose GET returns the same order; two GETs and two PUTs of it return the same state; its timestamps end in Z and its id is a string; DELETE answers 204 without a body and the next GET 404 or 410; PATCH /orders answers 405 with Allow naming GET and POST; a text/plain POST answers 415',
      description: 'An HTTP test (test/api/semantics.test.ts) runs one resource through its life against the application and checks the status codes, headers and formats RFC 9110 and RFC 3339 prescribe. Timestamps are left out of the comparison of the two PUTs, since an update time may move.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack: JUnit with MockMvc, xUnit with WebApplicationFactory)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'
import { newOrder } from './fixtures'   // a valid body for POST /orders

const TIME = /(At|_at|Time|_time)$/
const untimed = (body: object) => Object.fromEntries(Object.entries(body).filter(([name]) => !TIME.test(name)))
it('creates, reads, replaces and deletes as RFC 9110 says', async () => {
  const { headers: { location: url }, body: posted } = await request(app).post('/orders').send(newOrder()).expect(201)
  const read = (await request(app).get(url).expect(200)).body
  expect(read).toEqual(posted)
  expect(typeof read.id).toBe('string')
  for (const [name, value] of Object.entries(read)) if (TIME.test(name)) expect(value, name).toMatch(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$/)
  expect((await request(app).get(url)).body).toEqual(read)
  const once = (await request(app).put(url).send(read).expect(200)).body
  expect(untimed((await request(app).put(url).send(read).expect(200)).body)).toEqual(untimed(once))
  expect((await request(app).delete(url).expect(204)).text).toBe('')
  expect([404, 410]).toContain((await request(app).get(url)).status)
})

it('refuses an unsupported method with 405 and Allow, a media type it does not accept with 415', async () => {
  const wrong = await request(app).patch('/orders').send({}).expect(405)
  expect(wrong.headers.allow.split(/,\\s*/)).toEqual(expect.arrayContaining(['GET', 'POST']))
  await request(app).post('/orders').set('Content-Type', 'text/plain').send('id=1').expect(415)
})`,
    },
    {
      id: 'ff-custom-methods', label: 'Custom methods well-formed', when: { ACTIONS: ['custom'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-actions-custom'], checks: ['req-actions-custom'],
      threshold: '0 paths in api/openapi.yaml with a colon that offer PUT, PATCH or DELETE, and 0 custom-method verbs outside camelCase',
      description: 'Spectral checks that a path ending in :verb is only called with POST or GET and that the verb is camelCase; the contract check already refuses a verb as a path segment.',
      tool: 'Spectral CLI (spectral lint api/openapi.yaml --fail-severity=error)',
      language: 'yaml',
      snippet: `# .spectral.yaml, with the casing, path and contract rules beside these
formats: [oas3]
rules:
  custom-method-post-or-get:
    severity: error
    given: '$.paths[?(@property.match(/:/))]'
    then:
      - { field: put, function: falsy }
      - { field: patch, function: falsy }
      - { field: delete, function: falsy }
  custom-method-verb-camel-case:
    severity: error
    given: '$.paths[*]~'
    then: { function: pattern, functionOptions: { match: '^[^:]*(:[a-z][A-Za-z]*)?$' } }`,
    },
    {
      id: 'ff-action-paths', label: 'No action paths', when: { ACTIONS: ['resource', 'patch'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-actions-resource', 'adr-actions-patch'], checks: ['req-actions-resource', 'req-actions-patch', 'req-create'],
      threshold: '0 paths in api/openapi.yaml with a colon, and 0 POST operations on a collection without a 201 or 202 response',
      description: 'Spectral refuses custom methods, so an action is either a resource created by POST on its collection or a PATCH of the status field; the contract check already refuses a verb as a path segment.',
      tool: 'Spectral CLI (spectral lint api/openapi.yaml --fail-severity=error)',
      language: 'yaml',
      snippet: `# .spectral.yaml, with the casing, path and contract rules beside these
formats: [oas3]
rules:
  no-custom-methods:
    severity: error
    given: '$.paths[*]~'
    then: { function: pattern, functionOptions: { notMatch: ':' } }
  post-on-collection-creates:
    severity: error
    given: '$.paths[?(!@property.match(/\\}$/))].post.responses'
    then: { function: or, functionOptions: { properties: ['201', '202'] } }`,
    },
    {
      id: 'ff-transitions', label: 'Forbidden transitions refused', when: { ACTIONS: ['patch'] }, characteristic: 'functional-suitability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-actions-patch'], checks: ['req-actions-patch'],
      threshold: 'Every transition the lifecycle table allows answers 200; every other one answers 409 and leaves the status as it was',
      description: 'An HTTP test (test/api/transitions.test.ts) reads the transition table from the code, so a new status or transition is tested without editing the test, and tries every pair of statuses with a Merge Patch of the status field.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'
import { TRANSITIONS } from '../../src/orders/lifecycle'   // { placed: ['paid', 'cancelled'], paid: ['shipped', 'cancelled'], ... }
import { orderIn } from './fixtures'                        // creates an order in a status and returns its URL

const statuses = Object.keys(TRANSITIONS)
const pairs = statuses.flatMap((from) => statuses.filter((to) => to !== from).map((to) => ({ from, to, allowed: TRANSITIONS[from].includes(to) })))
const patch = (url: string, status: string) =>
  request(app).patch(url).set('Content-Type', 'application/merge-patch+json').send(JSON.stringify({ status }))

it.each(pairs)('$from → $to (allowed: $allowed)', async ({ from, to, allowed }) => {
  const url = await orderIn(from)
  const res = await patch(url, to)
  expect(res.status).toBe(allowed ? 200 : 409)
  expect((await request(app).get(url)).body.status).toBe(allowed ? to : from)
})`,
    },
    {
      id: 'ff-operation-poll', label: 'Long work polled to the end', when: { LRO: ['operation'] }, characteristic: 'compatibility', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-lro-operation'], checks: ['req-lro-operation'],
      threshold: 'A long request answers 202 with an Operation-Location under /operations; every poll shows one of the five statuses, with Retry-After until the end; the work ends within 60 polls; an operation that ended {{OPERATION_DAYS}} days ago less one hour is still readable',
      description: 'An HTTP test (test/api/operations.test.ts) starts the slowest operation the API has, follows Operation-Location at the pace Retry-After sets, and reads an operation the fixtures stored as ended just inside the retention period.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'
import { operationEndedHoursAgo, startLongRunning } from './fixtures'   // e.g. POST /reports; a stored, finished operation

const ENDED = ['Succeeded', 'Failed', 'Canceled']
it('answers 202 and an operation that can be polled to its end', async () => {
  const started = await startLongRunning(request(app)).expect(202)
  const monitor = new URL(started.headers['operation-location']).pathname
  expect(monitor).toMatch(/^\\/operations\\/[^/]+$/)
  for (let poll = 0; poll < 60; poll++) {
    const res = await request(app).get(monitor).expect(200)
    expect([...ENDED, 'NotStarted', 'Running']).toContain(res.body.status)
    if (res.body.status === 'Failed') expect(res.body.error).toBeDefined()
    if (ENDED.includes(res.body.status)) return
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    await new Promise((resolve) => setTimeout(resolve, Number(res.headers['retry-after']) * 1000))
  }
  throw new Error('the operation did not end within 60 polls')
})

it('keeps a finished operation readable for {{OPERATION_DAYS}} days', async () => {
  const id = await operationEndedHoursAgo({{OPERATION_DAYS}} * 24 - 1)
  await request(app).get('/operations/' + id).expect(200)
})`,
    },
    {
      id: 'ff-callback', label: 'Callbacks signed and retried', when: { LRO: ['callback'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-lro-callback'], checks: ['req-lro-callback'],
      threshold: 'A long request answers 202; a delivery the receiver refuses with 500 is retried with the same webhook-id; every delivery carries a valid v1 HMAC-SHA256 signature; the retry schedule spans at least {{CALLBACK_HOURS}} hours',
      description: 'An HTTP test (test/api/callbacks.test.ts) registers a local receiver that refuses the first delivery, starts a long operation, and verifies each delivery\'s signature as the Standard Webhooks specification computes it (HMAC-SHA256 over id.timestamp.body with the base64 secret after whsec_). The test allows a plain-http loopback receiver; production registers https URLs only.',
      tool: 'Vitest with supertest and node:http (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import { createHmac } from 'node:crypto'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'
import { RETRY_DELAYS_SECONDS } from '../../src/callbacks'      // the delivery schedule of the decision
import { registerCallback, startLongRunning } from './fixtures'   // registers the receiver's URL and secret for the test client
it('posts the outcome signed, and retries a refused delivery with the same id', async () => {
  const secret = 'whsec_' + Buffer.from('a secret for the test client').toString('base64')
  const got: Array<{ headers: IncomingHttpHeaders; body: string }> = []
  const receiver = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk)).on('end', () => { got.push({ headers: req.headers, body }); res.writeHead(got.length === 1 ? 500 : 204).end() })
  }).listen(0)
  await registerCallback('http://127.0.0.1:' + (receiver.address() as { port: number }).port + '/done', secret)
  await startLongRunning(request(app)).expect(202)
  await expect.poll(() => got.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(2)
  for (const { headers, body } of got) {
    const signed = createHmac('sha256', Buffer.from(secret.slice('whsec_'.length), 'base64')).update(headers['webhook-id'] + '.' + headers['webhook-timestamp'] + '.' + body).digest('base64')
    expect(String(headers['webhook-signature']).split(' ')).toContain('v1,' + signed)
  }
  expect(got[1].headers['webhook-id']).toBe(got[0].headers['webhook-id'])
  expect(RETRY_DELAYS_SECONDS.reduce((sum, s) => sum + s, 0)).toBeGreaterThanOrEqual({{CALLBACK_HOURS}} * 3600)
  receiver.close()
})`,
    },
    {
      id: 'ff-latency', label: 'Slow routes alerted', characteristic: 'performance-efficiency', scope: 'holistic', cadence: 'continual', invocation: 'automated', implements: [...MAIN, 'adr-lro-none'], checks: ['req-sync'],
      threshold: 'An alert fires for any route where more than 1% of requests took longer than {{SYNC_SECONDS}} seconds over 5 minutes, sustained for 15 minutes',
      description: 'A Prometheus alerting rule over the OpenTelemetry HTTP server duration histogram computes, per route, the share of requests slower than the limit. The limit must be a bucket boundary of the histogram (the OpenTelemetry default boundaries end at 10 seconds); le is matched with and without .0, since Prometheus 3 may write bucket bounds as floats.',
      tool: 'Prometheus alerting rules (promtool check rules), on the http.server.request.duration metric of OpenTelemetry',
      language: 'yaml',
      snippet: `# prometheus/rules/api-resource-design.yml
groups:
  - name: api-resource-design
    rules:
      - alert: RequestsSlowerThanTheLimit
        expr: |
          1 - (
            sum by (http_route) (rate(http_server_request_duration_seconds_bucket{job="order-api", le=~"{{SYNC_SECONDS}}|{{SYNC_SECONDS}}.0"}[5m]))
            / sum by (http_route) (rate(http_server_request_duration_seconds_count{job="order-api"}[5m]))
          ) > 0.01
        for: 15m
        labels:
          severity: ticket
        annotations:
          summary: 'More than 1% of {{ $labels.http_route }} takes over {{SYNC_SECONDS}} s: make it faster or a long-running operation'`,
    },
  ],
}

export default pack
