import type { PackSpec } from '../../src/packSpec'

const FORMATS = ['adr-problem-details', 'adr-microsoft-error', 'adr-google-status', 'adr-minimal-body']
const CATALOGUE = { CODES: ['catalogue'] }
const FORCES = 'Other parts of the system or other systems call this element\'s HTTP API, and every one of them has to handle its errors in code. The forces: a client can only act on what it can parse, so an error body that changes shape from one operation to the next is handled by string matching or not at all; the HTTP status alone does not tell "order not found" from "customer not found", so clients that need to tell them apart need a code that never changes meaning; a form that shows one invalid field per round trip costs the user a submit per mistake; a message copied from an exception tells the caller about the code, not about what to do; a code nobody documented is a support ticket; and a published guide (Zalando, Microsoft, Google) already fixes a shape, which costs nothing to follow and a lot to argue with. What never reaches a caller (stack traces, class names, SQL, paths, hosts) and the correlation field are decided in Error handling and logging conventions, which this pack takes as given; conflicts and failed preconditions (409, 412) in Idempotency and concurrency, 429 in Rate limiting, and how the error shape changes across versions in API evolution.'

const pack: PackSpec = {
  id: 'concern-api-errors',
  name: 'Errors',
  group: 'api',
  description: 'What an error looks like to a caller of an HTTP API: the body\'s format, stable error codes, how validation errors are reported, and where the codes are documented. What must never reach a caller is decided in Error handling and logging conventions.',
  tags: ['api', 'errors', 'problem details', 'rfc 9457', 'error codes', 'validation'],
  concern: {
    id: 'api-errors',
    trigger: 'LIST RELATIONS WHERE source.type != "person" AND target.external != true AND (target.type = "container" OR target.type = "component")',
    applyTo: 'target',
    why: 'other parts of the system or other systems call these elements, so what an error looks like to a caller has to be decided once for every operation they offer.',
  },
  sources: [
    { title: 'RFC 9457, Problem Details for HTTP APIs', url: 'https://www.rfc-editor.org/rfc/rfc9457' },
    { title: 'RFC 6901, JavaScript Object Notation (JSON) Pointer', url: 'https://www.rfc-editor.org/rfc/rfc6901' },
    { title: 'RFC 9110, HTTP Semantics (15. Status Codes)', url: 'https://www.rfc-editor.org/rfc/rfc9110#name-status-codes' },
    { title: 'Microsoft Azure REST API Guidelines: Handling errors', url: 'https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md#handling-errors' },
    { title: 'Google AIP-193, Errors', url: 'https://google.aip.dev/193' },
    { title: 'google/rpc/error_details.proto (ErrorInfo, BadRequest, RequestInfo, Help)', url: 'https://github.com/googleapis/googleapis/blob/master/google/rpc/error_details.proto' },
    { title: 'Zalando RESTful API Guidelines: MUST support problem JSON [176], MUST not expose stack traces [177]', url: 'https://opensource.zalando.com/restful-api-guidelines/#176' },
    { title: 'OWASP Error Handling Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html' },
    { title: 'Spectral: custom rulesets', url: 'https://github.com/stoplightio/spectral/blob/develop/docs/guides/4-custom-rulesets.md' },
  ],
  questions: [
    {
      key: 'FORMAT', title: 'Error body', label: 'What does an error look like to a caller?',
      hint: 'Every client parses this body, so it is the one shape the whole API keeps. Follow the guide chosen in the API style guide pack: Zalando\'s guidelines ask for problem details, Microsoft\'s for its error object, Google\'s AIPs for google.rpc.Status. How the shape changes across versions is the API evolution pack\'s decision.',
      default: 'problem-details',
      options: [
        { value: 'problem-details', label: 'RFC 9457 problem details', description: 'Every error is application/problem+json with type (a URI reference naming the problem), title, status, detail and instance, plus a stable code and the correlation id as extension members. Pick it for any HTTP API with more than one client or a public one, and whenever the chosen guide is Zalando\'s or your own: it is the IETF standard, and Spring, ASP.NET Core and most gateways write it already.' },
        { value: 'microsoft', label: 'Microsoft\'s error object', description: 'Every error is a JSON body {"error": {"code", "message", "target", "details", "innererror"}} with the code repeated in an x-ms-error-code header, as the Microsoft Azure REST API Guidelines require. Pick it when the chosen guide is Microsoft\'s, or the API sits beside Azure or Microsoft Graph APIs whose clients already parse that shape.' },
        { value: 'google', label: 'google.rpc.Status as JSON', description: 'Every error is a JSON body {"error": {"code", "message", "status", "details"}} where code is the HTTP status, status the google.rpc.Code name and details holds a google.rpc.ErrorInfo with a stable reason, as Google AIP-193 requires. Pick it when the chosen guide is Google\'s AIPs, or the API is gRPC transcoded to HTTP/JSON, where this is the shape the gateway speaks.' },
        { value: 'minimal', label: 'a minimal body of status, code and message', description: 'The HTTP status plus a JSON body holding only a stable code, a message and the correlation id. Pick it for an internal API with one client owned by the same team, where a standard shape buys nothing yet; moving to problem details later is a breaking change.' },
      ],
    },
    {
      key: 'CODES', title: 'Error codes', label: 'How does a client tell one error from another?',
      hint: 'The status says what kind of failure it was; a code says which one. A code a client keys on is part of the contract, so it must be listed and must never change meaning.',
      default: 'catalogue',
      options: [
        { value: 'catalogue', label: 'a catalogue of stable codes, listed per operation', description: 'Every error carries a machine-readable code from one catalogue kept with the OpenAPI document (ORDER_NOT_FOUND, PAYMENT_DECLINED), each operation lists the codes it may return, and a released code is never renamed or removed. Pick it when clients act differently on errors of the same status, or the API is public or used by partners.' },
        { value: 'status-only', label: 'the HTTP status alone', description: 'Clients key on the HTTP status only; where the format has a code field it holds the status\'s reason phrase (NOT_FOUND, INTERNAL_SERVER_ERROR), and problem details use type about:blank. Pick it for an internal API whose one client treats every error of a status the same, so a catalogue would be paperwork.' },
      ],
    },
    {
      key: 'VALIDATION', title: 'Invalid input', label: 'How are invalid fields in a request reported?',
      hint: 'A client that fills a form wants to mark every wrong field at once; one that only logs the failure needs just the first.',
      default: 'all',
      options: [
        { value: 'all', label: 'every field error in one response', description: 'One response lists every invalid field of the request body, each with its location (a JSON Pointer, RFC 6901, or the dotted field path of google.rpc.BadRequest) and a field-level code. Pick it whenever a person fills the request in through a form, and as the default for any public API.' },
        { value: 'first', label: 'the first field error only', description: 'Validation stops at the first invalid field and the response names that one, with its location and code. Pick it for machine-to-machine APIs whose callers build requests in code and treat any invalid request as a bug.' },
      ],
    },
    {
      key: 'DOCS', title: 'Code documentation', label: 'Where does a developer read what a code means?',
      hint: 'Only when codes come from a catalogue: with the HTTP status alone there is nothing beyond the status to document, and this answer decides nothing. RFC 9457 suggests type URIs that resolve to a page; Zalando deliberately keeps them as identifiers documented in the OpenAPI document.',
      default: 'page',
      options: [
        { value: 'page', label: 'a documentation page per code', description: 'Every code has a public page under one base URL (when it happens, what the caller should do), which the problem details type URI or a google.rpc.Help link points to. Pick it for public and partner APIs, where the developer who hits an error is not the one who read the reference.' },
        { value: 'identifiers', label: 'identifiers documented in the OpenAPI document only', description: 'Codes and type URIs are identifiers that do not resolve (type /problems/order-not-found); each code is described in the catalogue and published with the OpenAPI document beside the operations that return it. Pick it for internal APIs, or when a separate documentation site would fall out of step with the contract, as the Zalando guidelines argue.' },
      ],
    },
  ],
  details: [
    { key: 'CODE_PATTERN', label: 'Regular expression every error code and field-level code matches', default: '^[A-Z][A-Z0-9_]*[A-Z0-9]$' },
    { key: 'VALIDATION_STATUS', label: 'Status of a response to a request body that fails validation (400, or 422 for content that parses but breaks a rule)', default: '400', number: true },
    { key: 'GENERIC_MESSAGE', label: 'Text every unexpected (5xx) error gives its caller', default: 'An unexpected error occurred. Quote the trace id of this response when you contact support.' },
    { key: 'ERROR_DOCS_URL', label: 'Base URL of the error code pages (a documentation page per code only)', default: 'https://developer.example.com/errors/' },
  ],
  need: {
    label: 'Errors a caller can act on',
    text: 'Every client of this API has to handle its errors in code: tell one failure from another without parsing prose, mark every wrong field for its user, and quote one id to support. That only works if every operation answers errors in one documented shape, with codes that keep their meaning and text written for the caller rather than copied from an exception. The snippets assume one OpenAPI document per API under api/ (api/orders.yaml), the error code catalogue at api/errors/codes.yaml, the error rules in api/style/errors.yaml beside the style ruleset the API style guide pack keeps, the app exported from src/app (an Express app, with test-only routes: GET /__boom throws an unexpected error and GET /__expected an expected one, both with the text in the ERROR_MARK variable), POST /orders validating email, items[].quantity and currency, and the tests under test/ run with NODE_ENV=production.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-problem-details', label: 'Errors answered as problem details', when: { FORMAT: ['problem-details'] }, ears_type: 'event-driven',
      trigger: 'an operation answers with a 4xx or 5xx status',
      action: 'send a body of media type application/problem+json holding type (a URI reference), title, status equal to the response\'s status, detail, instance, and as extension members a code matching {{CODE_PATTERN}} and the correlation id under the field set in Error handling and logging conventions; where codes are the HTTP status alone, type is about:blank and title the status\'s reason phrase',
      rationale: 'One standard shape lets every client parse every error with one library, and the extension members carry what the five standard ones do not; clients must ignore extensions they do not know, so adding one breaks nobody (RFC 9457, sections 3.1, 3.2 and 4.2.1; Zalando guidelines, rule 176).',
      scenario: { label: 'Not found and crash answered as problems', given: 'the element running with production settings', when: 'an order that does not exist is requested and a route that throws an unexpected error is called, both with a traceparent header', then: 'both answers are application/problem+json with type, title, status equal to the response\'s, detail, instance, a code matching {{CODE_PATTERN}} and the trace id of the traceparent' },
    },
    {
      id: 'req-microsoft-error', label: 'Errors answered as Microsoft\'s error object', when: { FORMAT: ['microsoft'] }, ears_type: 'event-driven',
      trigger: 'an operation answers with a 4xx or 5xx status',
      action: 'send a JSON body whose only top-level member is error, an object holding code (matching {{CODE_PATTERN}}), message, and where they apply target and details (each an object of the same shape), with the correlation id as a property of error under the field set in Error handling and logging conventions; repeat the code in an x-ms-error-code header, and send no innererror with production settings',
      rationale: 'The guidelines make the top-level code and the header the contract and leave the other fields free; innererror is for debugging detail, which belongs in the log, not in the answer (Microsoft Azure REST API Guidelines, Handling errors; OWASP Error Handling Cheat Sheet).',
      scenario: { label: 'Not found and crash answered as error objects', given: 'the element running with production settings', when: 'an order that does not exist is requested and a route that throws an unexpected error is called, both with a traceparent header', then: 'both answers are JSON with only the member error, whose code matches {{CODE_PATTERN}} and equals the x-ms-error-code header, which has a message and the trace id of the traceparent, and no innererror' },
    },
    {
      id: 'req-google-status', label: 'Errors answered as google.rpc.Status', when: { FORMAT: ['google'] }, ears_type: 'event-driven',
      trigger: 'an operation answers with a 4xx or 5xx status',
      action: 'send a JSON body whose only top-level member is error, holding code (the HTTP status), status (the google.rpc.Code name, such as NOT_FOUND or INTERNAL), message, and details with exactly one google.rpc.ErrorInfo (reason matching {{CODE_PATTERN}}, domain the service\'s name) and one google.rpc.RequestInfo whose requestId is the correlation id, no detail type twice',
      rationale: 'AIP-193 requires an ErrorInfo in every error and keeps its reason and domain stable as the machine-readable identity of the error; RequestInfo is the detail meant for the id a client quotes when it reports a problem (Google AIP-193; google/rpc/error_details.proto).',
      scenario: { label: 'Not found and crash answered as statuses', given: 'the element running with production settings', when: 'an order that does not exist is requested and a route that throws an unexpected error is called, both with a traceparent header', then: 'both answers are JSON with only the member error, whose code equals the response\'s status, whose status is a google.rpc.Code name, and whose details hold one ErrorInfo with a reason matching {{CODE_PATTERN}} and one RequestInfo with the trace id of the traceparent' },
    },
    {
      id: 'req-minimal', label: 'Errors answered as status, code and message', when: { FORMAT: ['minimal'] }, ears_type: 'event-driven',
      trigger: 'an operation answers with a 4xx or 5xx status',
      action: 'send a JSON body holding only code (matching {{CODE_PATTERN}}), message and the correlation id under the field set in Error handling and logging conventions, plus the list of field errors when the request failed validation, and nothing else',
      rationale: 'A client owned by the same team needs a code to key on and an id to quote; every further field is one more thing to keep stable and one more place for internals to slip out (OWASP Error Handling Cheat Sheet).',
      scenario: { label: 'Not found and crash answered minimally', given: 'the element running with production settings', when: 'an order that does not exist is requested and a route that throws an unexpected error is called, both with a traceparent header', then: 'both answers are JSON with exactly the fields code, message and the correlation field, the code matching {{CODE_PATTERN}} and the id the trace id of the traceparent' },
    },
    {
      id: 'req-correlation', label: 'Every error carries the request\'s id', ears_type: 'event-driven',
      trigger: 'an operation answers with a 4xx or 5xx status',
      action: 'carry in the error body the correlation id of the request (the trace id of an incoming traceparent header, or the id created at the edge when there is none), in the place the error format gives it and under the field set in Error handling and logging conventions',
      rationale: 'The id in the answer is what a client quotes to support and what finds the one log line of that failure among millions; without it a report of an error cannot be traced (RFC 9457, section 3.2 extension members; google.rpc.RequestInfo; OWASP Error Handling Cheat Sheet).',
      scenario: { label: 'Trace id handed back', given: 'a request with the traceparent 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01', when: 'it fails with a 404 and another fails with a 500', then: 'both error bodies carry 4bf92f3577b34da6a3ce929d0e0e4736 as the correlation id' },
    },
    {
      id: 'req-caller-text', label: 'Error text written for the caller', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an error is caused by an exception, a driver error or an upstream system\'s answer',
      action: 'fill the human-readable text of the error body (detail, message) only with text written for callers (the code\'s catalogue entry, or the operation\'s own wording), never with the exception\'s or upstream\'s message, and give every 5xx error the fixed text "{{GENERIC_MESSAGE}}"',
      rationale: 'An exception\'s message is written for the developer and describes the code, not what the caller should do; passing it through also passes on whatever it names. The leak of stack traces, class names and SQL is ruled out in Error handling and logging conventions; this rules out the text (OWASP Error Handling Cheat Sheet; RFC 9457, section 4: not a debugging tool).',
      scenario: { label: 'Exception text stays inside', given: 'a route that throws an unexpected error and one that throws an expected error, both with a random marker in their message', when: 'each is called with production settings', then: 'neither answer holds the marker, and the 500 answer holds "{{GENERIC_MESSAGE}}"' },
    },
    {
      id: 'req-documented', label: 'Error responses documented per operation', ears_type: 'ubiquitous',
      action: 'document in the OpenAPI document, for every operation, at least one 4xx response and a default response, each with its content described, so that 0 operations leave a caller to guess what their errors look like',
      rationale: 'Clients are generated from the document; an error response it does not describe is one the client has no type for (Zalando guidelines, rule 151, MUST specify success and error responses; Microsoft Azure REST API Guidelines, Handling errors).',
      scenario: { label: 'Undocumented errors refused', given: 'a pull request adding an operation with only a 200 response, and one whose 404 response has no content', when: 'the Spectral rules run on the OpenAPI documents', then: 'both fail, naming the operation and the missing response or content' },
    },
    {
      id: 'req-codes', label: 'Codes come from one catalogue', when: CATALOGUE, ears_type: 'ubiquitous',
      action: 'take every error code from the one catalogue api/errors/codes.yaml (each code matching {{CODE_PATTERN}}, with its status of at least 400, a title and a description), list in each operation\'s x-error-codes the codes it may return, and never rename or remove a released code',
      rationale: 'A client keys on codes, so a code is part of the contract: renamed or removed, it breaks callers silently, and a code returned but never listed is one no client was written for (Microsoft Azure REST API Guidelines: error codes are part of the API contract; Google AIP-193: the same reason and domain for the same error, consistent over time).',
      scenario: { label: 'Unknown and renamed codes refused', given: 'a pull request that lists a code on an operation that the catalogue lacks, and another that renames a code in the catalogue', when: 'the catalogue test runs', then: 'the first fails naming the operation and the code, the second fails the snapshot of the codes' },
    },
    {
      id: 'req-status-only', label: 'Errors keyed on the status alone', when: { CODES: ['status-only'] }, ears_type: 'ubiquitous',
      action: 'give every error the code of its HTTP status where the format has a code field (the status\'s reason phrase in upper snake case: NOT_FOUND, UNPROCESSABLE_CONTENT, INTERNAL_SERVER_ERROR), and in problem details the type about:blank, so that no code carries more than the status does',
      rationale: 'With one client that treats every error of a status alike, a code that only repeats the status is honest about what the client may rely on; about:blank is the type RFC 9457 defines for exactly that (RFC 9457, section 4.2.1; RFC 9110, section 15).',
      scenario: { label: 'Status names the error', given: 'the element running with production settings', when: 'an order that does not exist is requested and a route that throws an unexpected error is called', then: 'the first answer is 404 with the code NOT_FOUND and the second 500 with INTERNAL_SERVER_ERROR, and a problem details type is about:blank' },
    },
    {
      id: 'req-validation-all', label: 'Every invalid field reported at once', when: { VALIDATION: ['all'] }, ears_type: 'event-driven',
      trigger: 'a request body fails validation',
      action: 'answer {{VALIDATION_STATUS}} listing every invalid field in one response, each with its location (a JSON Pointer per RFC 6901 into the body; the dotted field path of google.rpc.BadRequest in that format) and a field-level code matching {{CODE_PATTERN}}',
      rationale: 'A user who submits a form with three mistakes should learn of all three at once, and a client can only mark the fields if it can locate them; RFC 9457 shows exactly this list of detail and pointer (RFC 9457, section 3; RFC 6901; google.rpc.BadRequest field violations).',
      scenario: { label: 'Three mistakes, one answer', given: 'a new order with an invalid e-mail address, a quantity of 0 in its first item and an unknown currency', when: 'it is posted', then: 'the answer is {{VALIDATION_STATUS}} and lists exactly three field errors, located at the e-mail address, the first item\'s quantity and the currency, each with a code matching {{CODE_PATTERN}}' },
    },
    {
      id: 'req-validation-first', label: 'First invalid field reported', when: { VALIDATION: ['first'] }, ears_type: 'event-driven',
      trigger: 'a request body fails validation',
      action: 'answer {{VALIDATION_STATUS}} naming only the first invalid field found, with its location (a JSON Pointer per RFC 6901 into the body; the dotted field path of google.rpc.BadRequest in that format) and a field-level code matching {{CODE_PATTERN}}, in the place the format keeps field errors',
      rationale: 'A caller that builds requests in code fixes a bug, not a form; one located error is enough to find it, and stopping early keeps validation simple (RFC 6901; RFC 9110, section 15.5.1).',
      scenario: { label: 'Three mistakes, the first reported', given: 'a new order with an invalid e-mail address, a quantity of 0 in its first item and an unknown currency', when: 'it is posted', then: 'the answer is {{VALIDATION_STATUS}} and lists exactly one field error, with a location and a code matching {{CODE_PATTERN}}' },
    },
    {
      id: 'req-docs-page', label: 'A page for every code', when: { ...CATALOGUE, DOCS: ['page'] }, ears_type: 'ubiquitous',
      action: 'publish for every code of the catalogue a page at {{ERROR_DOCS_URL}} followed by the code in lower case with dashes (ORDER_NOT_FOUND at order-not-found), reachable without signing in and answering 200 with HTML that names the code',
      rationale: 'The developer who meets an error is often not the one who read the reference; a type URI that resolves to human-readable documentation is what RFC 9457 recommends, and AIP-193 requires the links of a publicly documented service to be reachable without authentication (RFC 9457, sections 3.1.1 and 4; Google AIP-193, Help).',
      scenario: { label: 'Every code has its page', given: 'the catalogue and the published documentation site', when: 'the page of each code is fetched', then: 'every page answers 200 with HTML that names its code; a code added without a page fails the check' },
    },
    {
      id: 'req-docs-identifiers', label: 'Codes documented in the contract', when: { ...CATALOGUE, DOCS: ['identifiers'] }, ears_type: 'ubiquitous',
      action: 'document every code in its catalogue entry with a description of when it happens and what the caller should do, published with the OpenAPI document beside the operations whose x-error-codes list it',
      rationale: 'An identifier that does not resolve is fine when the contract itself explains it; the Zalando guidelines keep type URIs as identifiers precisely so that the documentation lives in the OpenAPI document and cannot drift from it (Zalando guidelines, rule 176; RFC 9457, section 3.1.1: the type URI may be non-resolvable).',
      scenario: { label: 'Undescribed code refused', given: 'a pull request adding a code to the catalogue without a description', when: 'the catalogue test runs', then: 'it fails naming the code' },
    },
  ],
  adrs: [
    {
      id: 'adr-problem-details', label: 'Errors are RFC 9457 problem details', when: { FORMAT: ['problem-details'] },
      decision: 'Every error response is application/problem+json (RFC 9457): type (a URI reference naming the problem), title, status (equal to the response\'s), detail (text written for the caller, "{{GENERIC_MESSAGE}}" for every 5xx), instance (the request path), plus two extension members: code, matching {{CODE_PATTERN}}, and the correlation id under the field set in Error handling and logging conventions. Field errors go in an errors extension member, an array of { pointer, code, detail } with pointer a JSON Pointer (RFC 6901) into the body, as RFC 9457 section 3 shows. Codes: {{CODES}}. Invalid input: {{VALIDATION}}, answered {{VALIDATION_STATUS}}. Where codes come from a catalogue, what a code means is read in {{DOCS}}: with a page per code the type is that page\'s URL under {{ERROR_DOCS_URL}}; with identifiers it is the relative reference /problems/<code in lower case with dashes>, never resolved, as the Zalando guidelines do. The one error handler of Error handling and logging conventions writes the body: Spring Framework 6 ProblemDetail with a @ControllerAdvice extending ResponseEntityExceptionHandler, ASP.NET Core AddProblemDetails() with a custom InvalidModelStateResponseFactory for the errors array, a FastAPI exception handler, or a small mapper in src/http/problem.ts for Express. Every operation documents a default response with the Problem schema in the OpenAPI document. Statuses follow RFC 9110; conflicts and failed preconditions (409, 412) are decided in Idempotency and concurrency, 429 in Rate limiting, and how this shape evolves across versions in API evolution.',
      consequences: '• One shape for every error, a standard with libraries on every major stack, and a type field clients can switch on.\n• Clients that send Accept: application/json only may get problem+json anyway; some HTTP clients do not parse +json as JSON, which the Zalando guidelines warn about.\n• ASP.NET Core\'s ValidationProblemDetails writes errors as a map of field names to messages, not the pointer array; it has to be replaced, and so does any framework default that differs.\n• The code and the correlation id are extension members: standard parsers keep them, but a client must know their names.',
      alternatives: '1. Microsoft\'s error object: equally complete, but a shape of one vendor\'s guide, and no type URI to document.\n2. google.rpc.Status as JSON: natural behind a gRPC gateway, verbose over plain HTTP.\n3. A minimal body: less to build now, and a breaking change the day a second client needs more.',
    },
    {
      id: 'adr-microsoft-error', label: 'Errors are Microsoft\'s error object', when: { FORMAT: ['microsoft'] },
      decision: 'Every error response is application/json {"error": {"code", "message", "target", "details", "innererror"}} as the Microsoft Azure REST API Guidelines define it: code matching {{CODE_PATTERN}} and repeated in the x-ms-error-code header, message written for the caller ("{{GENERIC_MESSAGE}}" for every 5xx), target naming what failed, details an array of error objects of the same shape, and the correlation id as a property of error under the field set in Error handling and logging conventions. innererror is never sent with production settings: what it would hold goes to the log. Field errors are entries of details with code, message and target, the target a JSON Pointer (RFC 6901) into the body. Codes: {{CODES}}. Invalid input: {{VALIDATION}}, answered {{VALIDATION_STATUS}}. Where codes come from a catalogue, what a code means is read in {{DOCS}} (with a page per code, at {{ERROR_DOCS_URL}}<code in lower case with dashes>, linked from the code\'s description in the OpenAPI document). The one error handler of Error handling and logging conventions writes the body: an ASP.NET Core exception handler and InvalidModelStateResponseFactory, a Spring @ControllerAdvice, or an Express error handler in src/http. Every operation documents a default response with the error schema in the OpenAPI document. Statuses follow RFC 9110; conflicts and failed preconditions (409, 412) are decided in Idempotency and concurrency, 429 in Rate limiting, and how this shape evolves across versions in API evolution.',
      consequences: '• Clients of Azure and Microsoft Graph APIs parse it already, and the header lets a gateway or log read the code without the body.\n• No framework writes it by default; the handler and the validation response are ours to build and keep.\n• The guidelines treat only the top-level code as contract; target and details may change, so clients must not key on them.\n• Adding a top-level code is, in the guidelines\' words, a change that needs a new service version, which the API evolution pack decides.',
      alternatives: '1. RFC 9457 problem details: the standard with framework support everywhere.\n2. google.rpc.Status as JSON: the other big vendor\'s shape, natural behind gRPC.\n3. A minimal body: simpler, but no place for field errors beyond a list of our own.',
    },
    {
      id: 'adr-google-status', label: 'Errors are google.rpc.Status as JSON', when: { FORMAT: ['google'] },
      decision: 'Every error response is application/json {"error": {"code", "message", "status", "details"}}, the HTTP/JSON form of google.rpc.Status that Google AIP-193 defines: code is the HTTP status, status the google.rpc.Code name (NOT_FOUND, INVALID_ARGUMENT, INTERNAL), message written for the developer ("{{GENERIC_MESSAGE}}" for every 5xx), and details a list of typed messages, each type at most once: one google.rpc.ErrorInfo always (reason matching {{CODE_PATTERN}}, domain the service\'s name, metadata for the values the message names), one google.rpc.RequestInfo whose requestId is the correlation id, a google.rpc.BadRequest whose fieldViolations hold the field errors (field the dotted path, reason the field-level code), and, with a page per code, a google.rpc.Help link to it. Codes: {{CODES}}. Invalid input: {{VALIDATION}}, answered {{VALIDATION_STATUS}}. Where codes come from a catalogue, what a code means is read in {{DOCS}} (with a page per code, at {{ERROR_DOCS_URL}}<code in lower case with dashes>). The details are built from the google.rpc types (api-common-protos; com.google.rpc in proto-google-common-protos for Java); behind grpc-gateway the default error handler writes the bare Status with the gRPC code, so runtime.WithErrorHandler is set to write this form. Every operation documents a default response with the Status schema in the OpenAPI document. Statuses follow RFC 9110; conflicts and failed preconditions (409, 412) are decided in Idempotency and concurrency, 429 in Rate limiting, and how this shape evolves across versions in API evolution.',
      consequences: '• Identical errors over gRPC and HTTP, and clients of Google APIs parse it already.\n• Verbose: three typed details in every error, each with an @type URL.\n• Field paths are dotted protobuf paths (items[0].quantity), not JSON Pointers; a client that expects pointers needs a converter.\n• AIP-193 makes reason, domain and the metadata keys permanent once sent: a key may get an empty value, never disappear.',
      alternatives: '1. RFC 9457 problem details: lighter over plain HTTP, but a second shape beside gRPC\'s own.\n2. Microsoft\'s error object: no typed details, a vendor shape all the same.\n3. The bare Status grpc-gateway writes by default: the gRPC code where clients expect the HTTP status.',
    },
    {
      id: 'adr-minimal-body', label: 'Errors are status, code and message', when: { FORMAT: ['minimal'] },
      decision: 'Every error response is application/json {"code", "message", and the correlation id under the field set in Error handling and logging conventions}, with the HTTP status carrying the kind of failure: code matching {{CODE_PATTERN}}, message written for the caller ("{{GENERIC_MESSAGE}}" for every 5xx), and nothing else, except an errors array of { pointer, code, message } for field errors, with pointer a JSON Pointer (RFC 6901) into the body. Codes: {{CODES}}. Invalid input: {{VALIDATION}}, answered {{VALIDATION_STATUS}}. Where codes come from a catalogue, what a code means is read in {{DOCS}} (with a page per code, at {{ERROR_DOCS_URL}}<code in lower case with dashes>). The one error handler of Error handling and logging conventions writes the body (an Express error handler in src/http, a Spring @ControllerAdvice, an ASP.NET Core exception handler). Every operation documents a default response with the error schema in the OpenAPI document. This decision holds while the API has one client owned by the same team; a second client, or a client outside the team, supersedes it with problem details. Statuses follow RFC 9110; conflicts and failed preconditions (409, 412) are decided in Idempotency and concurrency, 429 in Rate limiting, and how this shape evolves across versions in API evolution.',
      consequences: '• The least to build and the least to keep stable.\n• No standard parser knows the shape; every client writes its own, which is cheap with one client and costly with five.\n• Moving to problem details later changes every error response: a breaking change that needs a new version under API evolution.',
      alternatives: '1. RFC 9457 problem details: a few more fields, and a standard any later client knows.\n2. The HTTP status alone with an empty body: nothing to quote to support, and no field errors.',
    },
  ],
  fitness: [
    {
      id: 'ff-problem-shape', label: 'Errors are problem details', when: { FORMAT: ['problem-details'] }, category: 'structural', implements: ['adr-problem-details'],
      checks: ['req-problem-details', 'req-correlation'],
      threshold: 'A 404 and a 500 answered with production settings are application/problem+json with type, title, status equal to the response\'s, detail, instance, a code matching {{CODE_PATTERN}} and the trace id of the request\'s traceparent',
      description: 'An integration test calls an unknown order and the test-only route that throws, both with a traceparent header, and checks the media type, the five members, the code and the correlation id in each answer. The correlation field\'s name is the one set in Error handling and logging conventions. For Java the same test is MockMvc or RestAssured; for .NET, WebApplicationFactory with xUnit.',
      tool: 'Vitest with supertest',
      language: 'ts',
      snippet: `// test/http/problem-details.test.ts   (NODE_ENV=production in this file's setup)
import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'   // GET /__boom throws an unexpected error, in tests only

const TRACE = 'traceId'   // the correlation field set in Error handling and logging conventions
const TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

it.each(['/orders/does-not-exist', '/__boom'])('GET %s answers problem details', async (path) => {
  const res = await request(app).get(path).set('traceparent', TRACEPARENT)
  expect(res.status).toBeGreaterThanOrEqual(400)
  expect(res.headers['content-type']).toMatch(/^application\\/problem\\+json/)
  expect(res.body).toMatchObject({ type: expect.any(String), title: expect.any(String), status: res.status, detail: expect.any(String), instance: expect.any(String) })
  expect(res.body.code).toMatch(new RegExp('{{CODE_PATTERN}}'))
  expect(res.body[TRACE]).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
})`,
    },
    {
      id: 'ff-microsoft-shape', label: 'Errors are Microsoft\'s error object', when: { FORMAT: ['microsoft'] }, category: 'structural', implements: ['adr-microsoft-error'],
      checks: ['req-microsoft-error', 'req-correlation'],
      threshold: 'A 404 and a 500 answered with production settings are JSON with only the member error, whose code matches {{CODE_PATTERN}} and equals the x-ms-error-code header, with a message, the trace id of the request\'s traceparent and no innererror',
      description: 'An integration test calls an unknown order and the test-only route that throws, both with a traceparent header, and checks the envelope, the code against the header, the message, the correlation id and the absence of innererror. The correlation field\'s name is the one set in Error handling and logging conventions.',
      tool: 'Vitest with supertest',
      language: 'ts',
      snippet: `// test/http/error-object.test.ts   (NODE_ENV=production in this file's setup)
import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'   // GET /__boom throws an unexpected error, in tests only

const TRACE = 'traceId'   // the correlation field set in Error handling and logging conventions
const TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

it.each(['/orders/does-not-exist', '/__boom'])('GET %s answers the error object', async (path) => {
  const res = await request(app).get(path).set('traceparent', TRACEPARENT)
  expect(res.status).toBeGreaterThanOrEqual(400)
  expect(res.headers['content-type']).toMatch(/^application\\/json/)
  expect(Object.keys(res.body)).toEqual(['error'])
  const { error } = res.body
  expect(error.code).toMatch(new RegExp('{{CODE_PATTERN}}'))
  expect(res.headers['x-ms-error-code']).toBe(error.code)
  expect(error.message).toEqual(expect.any(String))
  expect(error[TRACE]).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
  expect(error).not.toHaveProperty('innererror')
})`,
    },
    {
      id: 'ff-google-shape', label: 'Errors are google.rpc.Status', when: { FORMAT: ['google'] }, category: 'structural', implements: ['adr-google-status'],
      checks: ['req-google-status', 'req-correlation'],
      threshold: 'A 404 and a 500 answered with production settings are JSON with only the member error, whose code equals the response\'s status, whose status is an upper-case google.rpc.Code name, and whose details hold exactly one ErrorInfo with a reason matching {{CODE_PATTERN}} and a domain, and one RequestInfo with the trace id of the request\'s traceparent',
      description: 'An integration test calls an unknown order and the test-only route that throws, both with a traceparent header, and checks the envelope, the HTTP status in code, the google.rpc.Code name, the ErrorInfo and the RequestInfo by their @type, and that no detail type appears twice.',
      tool: 'Vitest with supertest',
      language: 'ts',
      snippet: `// test/http/rpc-status.test.ts   (NODE_ENV=production in this file's setup)
import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'   // GET /__boom throws an unexpected error, in tests only

const TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
const T = 'type.googleapis.com/google.rpc.'

it.each(['/orders/does-not-exist', '/__boom'])('GET %s answers google.rpc.Status', async (path) => {
  const res = await request(app).get(path).set('traceparent', TRACEPARENT)
  expect(Object.keys(res.body)).toEqual(['error'])
  const { error } = res.body
  expect(error).toMatchObject({ code: res.status, status: expect.stringMatching(/^[A-Z_]+$/), message: expect.any(String) })
  const types = error.details.map((d: { '@type': string }) => d['@type'])
  expect(new Set(types).size).toBe(types.length)
  const info = error.details.find((d: { '@type': string }) => d['@type'] === T + 'ErrorInfo')
  expect(info.reason).toMatch(new RegExp('{{CODE_PATTERN}}'))
  expect(info.domain).toEqual(expect.any(String))
  expect(error.details.find((d: { '@type': string }) => d['@type'] === T + 'RequestInfo').requestId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
})`,
    },
    {
      id: 'ff-minimal-shape', label: 'Errors are status, code and message', when: { FORMAT: ['minimal'] }, category: 'structural', implements: ['adr-minimal-body'],
      checks: ['req-minimal', 'req-correlation'],
      threshold: 'A 404 and a 500 answered with production settings are JSON with exactly the fields code, message and the correlation field, the code matching {{CODE_PATTERN}} and the id the trace id of the request\'s traceparent',
      description: 'An integration test calls an unknown order and the test-only route that throws, both with a traceparent header, and checks that the body holds exactly the three fields, nothing more. The correlation field\'s name is the one set in Error handling and logging conventions.',
      tool: 'Vitest with supertest',
      language: 'ts',
      snippet: `// test/http/error-body.test.ts   (NODE_ENV=production in this file's setup)
import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'   // GET /__boom throws an unexpected error, in tests only

const TRACE = 'traceId'   // the correlation field set in Error handling and logging conventions
const TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

it.each(['/orders/does-not-exist', '/__boom'])('GET %s answers code, message and id only', async (path) => {
  const res = await request(app).get(path).set('traceparent', TRACEPARENT)
  expect(res.status).toBeGreaterThanOrEqual(400)
  expect(res.headers['content-type']).toMatch(/^application\\/json/)
  expect(Object.keys(res.body).sort()).toEqual(['code', 'message', TRACE].sort())
  expect(res.body.code).toMatch(new RegExp('{{CODE_PATTERN}}'))
  expect(res.body[TRACE]).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
})`,
    },
    {
      id: 'ff-caller-text', label: 'No exception text reaches the caller', category: 'process', implements: FORMATS,
      checks: ['req-caller-text'],
      threshold: '0 occurrences of an exception\'s message in the answers to an unexpected and an expected error with production settings; the 500 answer holds "{{GENERIC_MESSAGE}}"',
      description: 'An integration test puts a random marker in the messages of the errors two test-only routes throw (an unexpected TypeError and an expected not-found error), calls both, and checks that the marker appears in neither answer and that the 500 answer holds the fixed text. The leak of stack traces, class names and SQL is checked in Error handling and logging conventions; this checks the text.',
      tool: 'Vitest with supertest',
      language: 'ts',
      snippet: `// test/http/caller-text.test.ts   (NODE_ENV=production in this file's setup)
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { expect, it } from 'vitest'

process.env.ERROR_MARK = \`mark-\${randomUUID()}\`
const { app } = await import('../../src/app')   // GET /__boom and GET /__expected throw errors whose message is ERROR_MARK

it('passes no exception message to the caller', async () => {
  for (const path of ['/__boom', '/__expected']) {
    const res = await request(app).get(path)
    expect(res.status, path).toBeGreaterThanOrEqual(400)
    expect(res.text, path).not.toContain(process.env.ERROR_MARK)
  }
})
it('answers every unexpected error with the fixed text', async () => {
  const res = await request(app).get('/__boom')
  expect(res.status).toBe(500)
  expect(res.text).toContain('{{GENERIC_MESSAGE}}')
})`,
    },
    {
      id: 'ff-openapi-errors', label: 'Every operation documents its errors', category: 'structural', implements: FORMATS,
      checks: ['req-documented'],
      threshold: '0 Spectral errors from the two error rules on the OpenAPI documents under api/ on every pull request: every operation has a default response and at least one 4xx response, and every 4xx, 5xx and default response describes its content',
      description: 'Spectral lints the OpenAPI documents with these rules on every pull request, failing at severity error: where the API style guide pack lints with Spectral, api/style/ruleset.yaml lists this file in its extends and its job runs them; otherwise a job of their own runs spectral lint "api/*.yaml" --ruleset api/style/errors.yaml --fail-severity=error. The first rule demands a default response and a 4xx response on every operation; the second demands content on every error response. The schema each response points to is the one the decision names.',
      tool: 'Spectral (@stoplight/spectral-cli 6)',
      language: 'yaml',
      snippet: `# api/style/errors.yaml
formats: [oas3]
rules:
  error-responses-documented:
    description: Every operation documents a default response and at least one 4xx response
    severity: error
    given: $.paths[*][get,put,post,patch,delete].responses
    then:
      - field: default
        function: truthy
      - function: schema
        functionOptions:
          schema:
            not: { propertyNames: { not: { pattern: '^4' } } }
  error-responses-have-content:
    description: Every error response describes its body
    severity: error
    given: $.paths[*][get,put,post,patch,delete].responses[?(@property.match(/^(4|5|default)/))]
    then:
      field: content
      function: truthy`,
    },
    {
      id: 'ff-error-codes', label: 'Codes listed, catalogued, described and kept', when: CATALOGUE, category: 'structural', implements: FORMATS,
      checks: ['req-codes', 'req-docs-identifiers'],
      threshold: 'Every operation in the OpenAPI documents under api/ lists at least one code in x-error-codes and every listed code is in api/errors/codes.yaml; every catalogue code matches {{CODE_PATTERN}} and has a status of at least 400 and a non-empty description; the sorted list of codes matches its snapshot',
      description: 'A test reads every OpenAPI document under api/ and the catalogue, checks every operation\'s x-error-codes against the catalogue, checks each entry, and snapshots the sorted codes, so that a renamed or removed code fails until the snapshot is updated in a reviewed change (which API evolution then judges). Where Error handling and logging conventions keeps an error catalogue in the code, api/errors/codes.yaml is generated from it, so there is one list.',
      tool: 'Vitest with the yaml package',
      language: 'ts',
      snippet: `// test/api/error-codes.test.ts
import { readdirSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parse } from 'yaml'

type Entry = { status: number; title: string; description: string }
type Paths = Record<string, Record<string, { 'x-error-codes'?: string[] }>>
const catalogue: Record<string, Entry> = parse(readFileSync('api/errors/codes.yaml', 'utf8'))
const docs = readdirSync('api').filter((f) => f.endsWith('.yaml')).map((f) => ({ f, doc: parse(readFileSync(\`api/\${f}\`, 'utf8')) }))
const operations = docs.filter(({ doc }) => doc?.openapi).flatMap(({ f, doc }) => Object.entries(doc.paths as Paths).flatMap(([path, item]) =>
  ['get', 'put', 'post', 'patch', 'delete'].filter((m) => item[m]).map((m) => ({ name: \`\${f} \${m.toUpperCase()} \${path}\`, codes: item[m]['x-error-codes'] ?? [] }))))

it.each(operations)('$name lists its codes, all in the catalogue', ({ codes }) => {
  expect(codes.length).toBeGreaterThan(0)
  for (const code of codes) expect(Object.keys(catalogue)).toContain(code)
})
it('every code is well-formed, described and keeps its name', () => {
  for (const [code, e] of Object.entries(catalogue)) {
    expect(code).toMatch(new RegExp('{{CODE_PATTERN}}'))
    expect(e.status, code).toBeGreaterThanOrEqual(400)
    expect(e.description?.trim(), code).toBeTruthy()
  }
  expect(Object.keys(catalogue).sort()).toMatchSnapshot()
})`,
    },
    {
      id: 'ff-status-codes', label: 'Codes repeat the status', when: { CODES: ['status-only'] }, category: 'structural', implements: FORMATS,
      checks: ['req-status-only'],
      threshold: 'An unknown order answers 404 with the code NOT_FOUND and the test-only crash 500 with INTERNAL_SERVER_ERROR; a problem details type, where present, is about:blank',
      description: 'An integration test calls an unknown order and the test-only route that throws and looks for the status\'s reason phrase as the code anywhere in the body (the code member, error.code, or ErrorInfo.reason, by format).',
      tool: 'Vitest with supertest',
      language: 'ts',
      snippet: `// test/http/status-codes.test.ts   (NODE_ENV=production in this file's setup)
import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'   // GET /__boom throws an unexpected error, in tests only

it.each([
  { path: '/orders/does-not-exist', status: 404, code: 'NOT_FOUND' },
  { path: '/__boom', status: 500, code: 'INTERNAL_SERVER_ERROR' },
])('GET $path answers $status with the code $code', async ({ path, status, code }) => {
  const res = await request(app).get(path)
  expect(res.status).toBe(status)
  expect(res.text).toContain(\`"\${code}"\`)
  if (res.body.type !== undefined) expect(res.body.type).toBe('about:blank')
})`,
    },
    {
      id: 'ff-validation-all', label: 'Every invalid field reported', when: { VALIDATION: ['all'] }, category: 'structural', implements: FORMATS,
      checks: ['req-validation-all'],
      threshold: 'An order posted with three invalid fields is answered {{VALIDATION_STATUS}} with exactly three field errors, located at the e-mail address, the first item\'s quantity and the currency, each with a code matching {{CODE_PATTERN}}',
      description: 'An integration test posts an order with three mistakes and reads the field errors wherever the format keeps them: errors in problem details and the minimal body, error.details in Microsoft\'s object, the fieldViolations of a google.rpc.BadRequest. Locations are JSON Pointers, or dotted paths in Google\'s format.',
      tool: 'Vitest with supertest',
      language: 'ts',
      snippet: `// test/http/validation.test.ts   (NODE_ENV=production in this file's setup)
import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'

type Field = { field?: string; code?: string }
const fieldErrors = (b: any): Field[] =>
  b.errors?.map((e: any) => ({ field: e.pointer, code: e.code }))
  ?? b.error?.details?.flatMap((d: any) => d.fieldViolations?.map((v: any) => ({ field: v.field, code: v.reason }))
    ?? (d['@type'] ? [] : [{ field: d.target, code: d.code }])) ?? []

it('reports every invalid field in one answer', async () => {
  const res = await request(app).post('/orders').send({ email: 'not-an-email', items: [{ sku: 'A-1', quantity: 0 }], currency: 'XYZ' })
  expect(res.status).toBe({{VALIDATION_STATUS}})
  const errors = fieldErrors(res.body)
  expect([['/currency', '/email', '/items/0/quantity'], ['currency', 'email', 'items[0].quantity']]).toContainEqual(errors.map((e) => e.field).sort())
  for (const e of errors) expect(e.code).toMatch(new RegExp('{{CODE_PATTERN}}'))
})`,
    },
    {
      id: 'ff-validation-first', label: 'The first invalid field reported', when: { VALIDATION: ['first'] }, category: 'structural', implements: FORMATS,
      checks: ['req-validation-first'],
      threshold: 'An order posted with three invalid fields is answered {{VALIDATION_STATUS}} with exactly one field error, with a location and a code matching {{CODE_PATTERN}}',
      description: 'An integration test posts an order with three mistakes and reads the field errors wherever the format keeps them: errors in problem details and the minimal body, error.details in Microsoft\'s object, the fieldViolations of a google.rpc.BadRequest.',
      tool: 'Vitest with supertest',
      language: 'ts',
      snippet: `// test/http/validation.test.ts   (NODE_ENV=production in this file's setup)
import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'

type Field = { field?: string; code?: string }
const fieldErrors = (b: any): Field[] =>
  b.errors?.map((e: any) => ({ field: e.pointer, code: e.code }))
  ?? b.error?.details?.flatMap((d: any) => d.fieldViolations?.map((v: any) => ({ field: v.field, code: v.reason }))
    ?? (d['@type'] ? [] : [{ field: d.target, code: d.code }])) ?? []

it('reports the first invalid field only', async () => {
  const res = await request(app).post('/orders').send({ email: 'not-an-email', items: [{ sku: 'A-1', quantity: 0 }], currency: 'XYZ' })
  expect(res.status).toBe({{VALIDATION_STATUS}})
  const errors = fieldErrors(res.body)
  expect(errors).toHaveLength(1)
  expect(errors[0].field).toEqual(expect.any(String))
  expect(errors[0].code).toMatch(new RegExp('{{CODE_PATTERN}}'))
})`,
    },
    {
      id: 'ff-docs-pages', label: 'Every code has a page', when: { ...CATALOGUE, DOCS: ['page'] }, category: 'operational', implements: FORMATS,
      checks: ['req-docs-page'],
      threshold: 'Every code in api/errors/codes.yaml has a page at {{ERROR_DOCS_URL}}<code in lower case with dashes> that answers 200 without credentials, with an HTML content type and the code in its text; checked after every documentation deploy and nightly',
      description: 'A script fetches the page of every code in the catalogue, without credentials, and fails naming each code whose page is missing, not HTML or does not name the code. It runs in the documentation site\'s deploy job and on a nightly schedule.',
      tool: 'Node.js 20 (a script with fetch and the yaml package)',
      language: 'js',
      snippet: `// scripts/check-error-pages.mjs   (node scripts/check-error-pages.mjs)
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const BASE = '{{ERROR_DOCS_URL}}'
const codes = Object.keys(parse(readFileSync('api/errors/codes.yaml', 'utf8')))
const missing = []
for (const code of codes) {
  const url = BASE + code.toLowerCase().replaceAll('_', '-')
  const res = await fetch(url, { redirect: 'follow' }).catch((e) => ({ ok: false, status: e.message }))
  const html = res.ok && (res.headers.get('content-type') ?? '').startsWith('text/html') ? await res.text() : ''
  if (!html.includes(code)) missing.push(\`\${code}: no HTML page naming it at \${url} (\${res.status})\`)
}
if (missing.length) {
  console.error(missing.join('\\n'))
  process.exit(1)
}
console.log(\`\${codes.length} error pages found\`)`,
    },
  ],
}

export default pack
