import type { PackSpec, When } from '../../src/packSpec'

const STYLES = ['adr-exceptions', 'adr-result', 'adr-codes']
const EDGE: When = { BOUNDARY: ['edge'] }
const LAYERED: When = { BOUNDARY: ['layered'] }
const FORCES = 'Code in this element fails: a dependency times out, input is wrong, a record is gone, a bug is hit. The forces: a failure that is swallowed becomes a wrong answer nobody can explain; one that is logged at every layer on its way up becomes five lines about one event; a caller that is handed a stack trace learns the file layout, the framework and sometimes the SQL; a log line without the request\'s id cannot be found when it matters; logs are read widely and copied to places with weaker access, so a password or an e-mail address in them is a leak; expected failures (not found, rejected, conflict) and unexpected ones (bugs, outages) need different handling, and a style that does not separate them handles both badly; and every convention here is kept by hundreds of hands, so it holds only if a tool checks it. What is done with the lines once written (shipping, retention, alerting, traces) is the Observability concern\'s decision, not this one\'s.'

const pack: PackSpec = {
  id: 'concern-error-handling-logging',
  name: 'Error handling and logging conventions',
  group: 'maintainability',
  description: 'How the code signals, propagates and records failures: the error style, where errors are handled, what an error that reaches a caller looks like, how a log line is shaped, and what must never be in one.',
  tags: ['maintainability', 'error handling', 'exceptions', 'result types', 'logging', 'redaction', 'problem details'],
  concern: {
    id: 'error-handling-logging',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements and fails in production, so how a failure is signalled, where it is handled and how it is recorded has to be decided once for everyone who writes in them.',
  },
  sources: [
    { title: 'RFC 9457, Problem Details for HTTP APIs', url: 'https://www.rfc-editor.org/rfc/rfc9457' },
    { title: 'OWASP Logging Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html' },
    { title: 'OWASP Error Handling Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html' },
    { title: 'OWASP Top 10 2021, A09: Security Logging and Monitoring Failures', url: 'https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/' },
    { title: 'Microsoft .NET: Best practices for exceptions', url: 'https://learn.microsoft.com/en-us/dotnet/standard/exceptions/best-practices-for-exceptions' },
    { title: 'Joe Duffy: The Error Model', url: 'https://joeduffyblog.com/2016/02/07/the-error-model/' },
    { title: 'The Rust Programming Language, chapter 9: Error Handling', url: 'https://doc.rust-lang.org/book/ch09-00-error-handling.html' },
    { title: 'Martin Fowler: Replacing Throwing Exceptions with Notification', url: 'https://martinfowler.com/articles/replaceThrowWithNotification.html' },
    { title: 'pino documentation: Redaction', url: 'https://getpino.io/#/docs/redaction' },
    { title: 'structlog documentation', url: 'https://www.structlog.org/en/stable/' },
    { title: 'The Twelve-Factor App, XI. Logs', url: 'https://12factor.net/logs' },
    { title: 'ISO/IEC 25010, Maintainability: analysability', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
  ],
  questions: [
    {
      key: 'STYLE', title: 'Error style', label: 'How does code signal a failure?',
      hint: 'The style decides whether an expected failure is visible in a function\'s signature, how much ceremony each call carries, and what the language and its linters can check for you.',
      default: 'exceptions',
      options: [
        { value: 'exceptions', label: 'exceptions with a small domain hierarchy', description: 'One base error class, typed subclasses for the expected failures (NotFound, Validation, Conflict, UpstreamUnavailable), and unexpected ones left to propagate untouched to the edge. Pick it as the default in Java, C#, Python, TypeScript and Kotlin, where the libraries throw anyway and the frameworks map exceptions to responses.' },
        { value: 'result', label: 'explicit result types for expected failures', description: 'A function that can fail in an expected way returns a Result or Either (Rust Result, Go error values, Kotlin Result, neverthrow or fp-ts in TypeScript), and exceptions or panics are kept for bugs. Pick it in Rust and Go, or in a TypeScript or Kotlin codebase whose team wants failures in the type signature and is ready to handle one at every call.' },
        { value: 'codes', label: 'error codes from a catalogue', description: 'Every error is a code from one catalogue (code, HTTP status, message), returned as a value and never invented at the call site. Pick it for C and embedded code, protocol-driven code bases, and APIs whose clients key on stable codes and need them documented.' },
      ],
    },
    {
      key: 'BOUNDARY', title: 'Where handled', label: 'Where are errors handled?',
      hint: 'Handling in one place keeps inner code honest and the log free of repeats; handling per layer keeps a layer\'s callers free of its dependencies\' error types.',
      default: 'edge',
      options: [
        { value: 'edge', label: 'handled once at the edge', description: 'One middleware, exception filter or handler at the edge (HTTP, queue consumer, CLI main) maps every error to a response, logs it once and ends the request; inner code only throws or returns. Pick it for services and web apps of one or two layers, where a 404 or 409 is the same decision everywhere.' },
        { value: 'layered', label: 'translated layer by layer', description: 'Each layer catches the errors of the layer below and raises its own, with the original as the cause: a repository turns a driver error into a persistence error, the domain turns that into a domain error, the API maps domain errors to responses. Pick it when the domain must not depend on the drivers\' error types, or when a layer is reused behind several edges (HTTP, messaging, batch).' },
      ],
    },
    {
      key: 'LOGS', title: 'Log shape', label: 'How is a log line shaped?',
      hint: 'A line is read by machines first: parsed, indexed, counted, searched by request id. Fields it does not have cannot be searched.',
      default: 'structured',
      options: [
        { value: 'structured', label: 'structured JSON lines', description: 'One JSON object per line with a fixed set of fields (timestamp, level, message, service, the correlation id, and an error object with type, message and stack), written by pino, structlog, Serilog, zap or a JSON encoder for logback. Pick it for anything that runs as a service and whose logs are shipped and searched.' },
        { value: 'text', label: 'fixed-layout text lines', description: 'One human-readable line per event in a fixed layout (time, level, correlation id in brackets, message, key=value fields), parsed with one regular expression. Pick it for CLIs, build tools and small utilities whose logs are read by a person on a terminal, not indexed.' },
      ],
    },
    {
      key: 'REDACTION', title: 'Redaction', label: 'How are secrets and personal data kept out of logs?',
      hint: 'Redaction by hand at each call fails the first time someone logs an object whole; it has to live in the logger.',
      default: 'denylist',
      options: [
        { value: 'allowlist', label: 'an allow-list of logged fields', description: 'The logger drops every field that is not on its list and every object goes through a serializer that picks the fields allowed for its type; nothing is ever logged whole. Pick it when logs leave the organisation (a SaaS log backend), when the data is regulated (health, payments), or after one leak too many.' },
        { value: 'denylist', label: 'a deny-list of redacted paths', description: 'The logger redacts known secret and personal-data fields by path (password, token, authorization, cookie, e-mail, IBAN) wherever they appear, and everything else is allowed. Pick it as the baseline for an internal log store, where a new field is more often useful than dangerous.' },
      ],
    },
    {
      key: 'CALLER', title: 'What a caller sees', label: 'What does an error look like to a caller?',
      hint: 'A client acts on what it is given: a stable code it can key on, a message it may show, and never a stack trace to learn from.',
      default: 'problem-details',
      options: [
        { value: 'problem-details', label: 'RFC 9457 problem details', description: 'Every error response is application/problem+json with type (a URI that documents the error), title, status, detail, instance, a stable code and the correlation id; no stack traces in production. Pick it for any HTTP API with more than one client or a public one. How the shape evolves across API versions is the API evolution concern\'s decision.' },
        { value: 'minimal', label: 'status, code and message only', description: 'An error response is the HTTP status plus a JSON body with a stable code, a message and the correlation id, nothing more. Pick it for an internal API with one client owned by the same team, or a non-HTTP edge (queue, CLI) where problem details do not apply.' },
      ],
    },
  ],
  details: [
    { key: 'BASE_ERROR', label: 'Name of the base error class or error type', default: 'AppError' },
    { key: 'CORRELATION_FIELD', label: 'Name of the correlation field in every log line and error response', default: 'traceId' },
    { key: 'LEVELS', label: 'Log levels in use, highest first', default: 'error, warn, info, debug' },
    { key: 'REDACTED_FIELDS', label: 'Fields that must never appear in a log line', default: 'password, token, authorization, cookie, email, iban' },
    { key: 'MAX_MESSAGE_CHARS', label: 'Longest allowed log message (characters); the rest goes in fields', default: '200', number: true },
  ],
  need: {
    label: 'Failures explained, not leaked',
    text: 'When something goes wrong in the element, the person investigating must find every line about that request by one id, see the first cause rather than the last symptom, and tell a bug from an expected refusal at a glance. The caller must get an answer it can act on, with nothing in it about how the element is built. Nobody reading the logs, inside or outside the team, may learn a password, a token or a customer\'s personal data from them. All of this must hold in code written by many people, so a tool must hold it.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-no-swallow', label: 'No error swallowed', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'code catches an error it cannot recover from',
      action: 'rethrow or return it to the caller with the original attached as the cause, so that 0 catch blocks are empty and 0 catch blocks end after only logging',
      rationale: 'A swallowed error turns a failure into a wrong result that surfaces later, somewhere else, with no trace back to the cause (Microsoft, Best practices for exceptions: do not catch what you cannot handle; Duffy, The Error Model).',
      scenario: { label: 'Swallowing refused', given: 'a change that adds a catch block which logs the error and continues', when: 'the linter runs on the pull request', then: 'it fails naming the block, and the change is not merged until the error is rethrown, returned or handled with a stated recovery' },
    },
    {
      id: 'req-cause', label: 'Errors carry their cause', ears_type: 'event-driven',
      trigger: 'an error is wrapped in another error',
      action: 'attach the original as the cause (Error.cause, inner exception, __cause__ via raise from, source() in Rust, %w in Go) so that the whole chain and the first stack trace are kept and logged',
      rationale: 'The last error says what failed for the caller; the first says why; a wrap that drops the original leaves the investigator with the symptom only (Microsoft, Best practices for exceptions: inner exceptions; ISO 25010 analysability).',
      scenario: { label: 'Chain kept', given: 'a repository call that fails on a connection reset and is wrapped as a persistence error', when: 'the error is logged at the boundary', then: 'the log line holds both errors, the connection reset as the cause, with the original stack trace' },
    },
    {
      id: 'req-hierarchy', label: 'Expected failures typed', when: { STYLE: ['exceptions'] }, ears_type: 'ubiquitous',
      action: 'raise every expected failure as a subclass of {{BASE_ERROR}} that names the case (not found, validation, conflict, upstream unavailable) and carries a stable code, throw only Error instances, and let unexpected errors propagate untouched to the boundary',
      rationale: 'A small hierarchy lets the boundary map the expected cases without a chain of string matches, and treats what is not in it as a bug (Microsoft, Best practices for exceptions: derive from Exception, use the predefined types; Fowler, Notification: exceptions for the unexpected).',
      scenario: { label: 'Expected case mapped', given: 'a request for an order that does not exist', when: 'the use case runs', then: 'it throws the not-found subclass of {{BASE_ERROR}} with its code, and the boundary answers 404; a TypeError from the same code path propagates and the boundary answers 500' },
    },
    {
      id: 'req-result', label: 'Expected failures returned', when: { STYLE: ['result'] }, ears_type: 'ubiquitous',
      action: 'return every expected failure as a Result (or Either, or an error value) in the function\'s signature, with an error type that names the case and carries a stable code, treat an ignored Result as a build error, and reserve exceptions or panics for bugs and broken invariants',
      rationale: 'With the failure in the signature the compiler, not the reviewer, finds the caller who forgot it; exceptions stay for what no caller can handle (Rust book, chapter 9: recoverable errors with Result; Duffy, The Error Model).',
      scenario: { label: 'Ignored result refused', given: 'a call to a function returning a Result whose value is never matched or unwrapped', when: 'the build runs', then: 'it fails naming the call; once the error branch is handled or returned, it passes' },
    },
    {
      id: 'req-codes', label: 'Errors come from the catalogue', when: { STYLE: ['codes'] }, ears_type: 'ubiquitous',
      action: 'signal every error with a code from the one catalogue in the repository (code, status, message template), 0 codes invented at a call site, and never remove or rename a code once released (a code can only be added or deprecated)',
      rationale: 'Clients key on codes; a code that changes meaning or vanishes breaks them silently, and a code made up inline is one the catalogue cannot document (RFC 9457, section 4.2: extension members for stable codes; OWASP Error Handling Cheat Sheet).',
      scenario: { label: 'Unknown code refused', given: 'a change that returns a code that is not in the catalogue', when: 'the catalogue test runs', then: 'it fails naming the code; a change that renames an existing code fails the catalogue snapshot' },
    },
    {
      id: 'req-edge', label: 'Handled once at the edge', when: EDGE, ears_type: 'event-driven',
      trigger: 'an error reaches the edge of the element (HTTP handler, queue consumer, CLI main, scheduled job)',
      action: 'map it in the one error handler to the response shape, log it exactly once with its cause chain and the {{CORRELATION_FIELD}}, and answer; no other code in the element builds an error response or knows an HTTP status',
      rationale: 'One handler means one place where a mapping is right or wrong, and one log line per failure; inner code that knows status codes cannot be reused behind another edge (OWASP Error Handling Cheat Sheet: global handler; Fowler, Notification).',
      scenario: { label: 'One handler, one line', given: 'a request whose use case throws a conflict error from two layers down', when: 'it is handled', then: 'the response is 409 in the agreed shape, exactly 1 log line carries the error, and no module outside the edge imports the response mapping' },
    },
    {
      id: 'req-layered', label: 'Each layer owns its errors', when: LAYERED, ears_type: 'ubiquitous',
      action: 'translate the errors of the layer below into its own error types at every layer boundary (driver error → persistence error → domain error → API response), with the original as the cause, so that 0 driver or framework error types cross into the domain or application layer',
      rationale: 'A domain that catches a vendor\'s exception is coupled to that vendor; translation at each boundary keeps a layer\'s callers free of its dependencies\' types while the cause chain keeps the detail (Microsoft, Best practices for exceptions: wrapping; Duffy, The Error Model).',
      scenario: { label: 'Driver error stays below', given: 'a repository whose database driver throws a unique-violation error', when: 'the use case calls it', then: 'it receives a persistence duplicate-key error with the driver error as cause, and the architecture test finds no dependency from the domain on the driver\'s types' },
    },
    {
      id: 'req-log-once', label: 'Each error logged once', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an error is caught by a layer that rethrows it',
      action: 'pass it on without logging it there, so that one failure produces exactly 1 error-level log line, written where the error is finally handled',
      rationale: 'An error logged at every layer on its way up is five lines, five alerts and one event; the one line at the handler has the full cause chain anyway (Sonar rule S2139; OWASP Logging Cheat Sheet).',
      scenario: { label: 'No duplicate lines', given: 'a failure that crosses three layers before it is handled', when: 'the log of that request is read', then: 'it holds exactly 1 error-level line for the failure, with the whole cause chain' },
    },
    {
      id: 'req-correlation', label: 'Every line carries the request id', ears_type: 'ubiquitous',
      action: 'put the {{CORRELATION_FIELD}} of the current request, message or job in every log line, taken from the incoming trace context or request id or created at the edge, through the logger\'s context (async-local storage, MDC, contextvars), never by hand at each call',
      rationale: 'The id is how one request\'s lines are found among millions and joined across elements; a line without it is noise at the moment it is needed (OWASP Logging Cheat Sheet: event attributes; Google SRE workbook, correlation across signals).',
      scenario: { label: 'Request found whole', given: 'a request that logs in the handler, a use case and a repository', when: 'the log is filtered by its {{CORRELATION_FIELD}}', then: 'all of its lines are found and none of them lacks the field' },
    },
    {
      id: 'req-structured', label: 'Lines are JSON with fixed fields', when: { LOGS: ['structured'] }, ears_type: 'ubiquitous',
      action: 'write every log line as one JSON object on standard output through the one configured logger (never console or print), with the fields timestamp, level, message, service, {{CORRELATION_FIELD}} and, for errors, an error object with type, message, stack and cause; the message is a constant phrase of at most {{MAX_MESSAGE_CHARS}} characters and variable data goes in fields',
      rationale: 'A fixed shape is parsed, indexed and counted without regular expressions, and a constant message groups one event across millions of lines (The Twelve-Factor App, XI; structlog and pino documentation).',
      scenario: { label: 'Every line parses', given: 'the log output of a full test run', when: 'each line is parsed as JSON', then: 'every line parses, has the fixed fields, a level from {{LEVELS}} and a message of at most {{MAX_MESSAGE_CHARS}} characters' },
    },
    {
      id: 'req-text', label: 'Lines follow one layout', when: { LOGS: ['text'] }, ears_type: 'ubiquitous',
      action: 'write every log line through the one configured logger (never console or print) in the layout "ISO-8601 time, level, [{{CORRELATION_FIELD}}], message, key=value fields", one event per line with the message at most {{MAX_MESSAGE_CHARS}} characters and stack traces indented on the following lines',
      rationale: 'A fixed layout is readable on a terminal and still parsed by one regular expression when it has to be; free-form lines are neither (OWASP Logging Cheat Sheet: event format).',
      scenario: { label: 'Every line matches', given: 'the log output of a full test run', when: 'each line is matched against the layout', then: 'every line matches, with a level from {{LEVELS}} and the {{CORRELATION_FIELD}} in brackets' },
    },
    {
      id: 'req-no-secrets', label: 'No secrets or personal data logged', ears_type: 'ubiquitous',
      action: 'keep {{REDACTED_FIELDS}} and every other secret, credential and personal-data value out of log lines by {{REDACTION}} configured in the logger itself, with 0 log calls that pass a whole request, response, headers or body object',
      rationale: 'Logs are read by more people and tools than the database and copied to places with weaker access; a secret or personal datum in them is a breach, and redaction done by hand at each call fails on the first whole object logged (OWASP Logging Cheat Sheet: data to exclude; OWASP Top 10 A09; pino, Redaction).',
      scenario: { label: 'Sign-in logged clean', given: 'a sign-in request with a password and an Authorization header, and an order with a customer e-mail', when: 'their log lines are read', then: 'no line holds the password, the header value or the e-mail, each is replaced by a redaction marker or absent, and the user id is there' },
    },
    {
      id: 'req-problem-details', label: 'Callers get problem details, never a stack', when: { CALLER: ['problem-details'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an error reaches a caller in production',
      action: 'answer with application/problem+json holding type (a URI that documents the error), title, status, detail, instance, a stable code and the {{CORRELATION_FIELD}}, and never a stack trace, exception class name, SQL, file path or internal host name; for an unexpected error the detail is generic and the status 500',
      rationale: 'A documented shape lets clients act on the code and show the detail, and the correlation id lets support find the lines; a stack trace tells an attacker the framework and the file layout (RFC 9457; OWASP Error Handling Cheat Sheet; OWASP Top 10 A09).',
      scenario: { label: 'Unexpected error answered clean', given: 'a route that throws a TypeError, with the element configured as in production', when: 'it is called', then: 'the response is 500 application/problem+json with type, title, status, code and {{CORRELATION_FIELD}}, and its body matches no stack-trace pattern, class name, path or SQL' },
    },
    {
      id: 'req-minimal', label: 'Callers get status, code and message, never a stack', when: { CALLER: ['minimal'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an error reaches a caller in production',
      action: 'answer with the HTTP status (or exit status at a CLI, or a dead-letter reason at a queue) and a body holding only a stable code, a message and the {{CORRELATION_FIELD}}, never a stack trace, exception class name, SQL, file path or internal host name; for an unexpected error the message is generic',
      rationale: 'A client needs a code to key on and an id to quote to support; everything else in an error body is attack surface (OWASP Error Handling Cheat Sheet; OWASP Top 10 A09).',
      scenario: { label: 'Unexpected error answered clean', given: 'a route that throws a TypeError, with the element configured as in production', when: 'it is called', then: 'the response is 500 with exactly the fields code, message and {{CORRELATION_FIELD}}, and its body matches no stack-trace pattern, class name, path or SQL' },
    },
    {
      id: 'req-levels', label: 'Levels mean something', ears_type: 'ubiquitous',
      action: 'use the levels {{LEVELS}} by meaning: error only for a failure that lost work or needs a person to act, warn for a failure handled or degraded, info for business events and lifecycle, debug for diagnosis and off in production; an expected failure answered with a 4xx is logged at warn or info, never error',
      rationale: 'Alerts and dashboards count by level; a 404 logged at error buries the real failures and teaches everyone to ignore the level (Google SRE book, chapter 6: pages, tickets and logging; OWASP Logging Cheat Sheet).',
      scenario: { label: 'Expected failure not an error', given: 'a request for a missing order and a request that hits a database outage', when: 'both are logged', then: 'the first line is at warn or info with its code and the second at error with the cause chain' },
    },
  ],
  adrs: [
    {
      id: 'adr-exceptions', label: 'Exceptions with a small domain hierarchy', when: { STYLE: ['exceptions'] },
      decision: 'Expected failures are thrown as subclasses of one base class {{BASE_ERROR}} (NotFoundError, ValidationError, ConflictError, UpstreamUnavailableError, each with a stable code and an HTTP status hint); unexpected errors (TypeError, NullPointerException, driver errors nobody translated) are not caught below the boundary. Every wrap passes the original as the cause (Error.cause, inner exception, raise … from). Errors are {{BOUNDARY}}; the handler maps {{BASE_ERROR}} subclasses by their code, treats everything else as 500 and logs each failure once at the level its meaning asks for ({{LEVELS}}). A caller sees {{CALLER}}. Log lines are {{LOGS}} with the {{CORRELATION_FIELD}} from the logger\'s context (AsyncLocalStorage, MDC, contextvars), and {{REDACTED_FIELDS}} are kept out by {{REDACTION}} in the logger (pino redact or serializers, structlog processors, Serilog destructuring policies, logback masking). Conventions are held by the linters: ESLint (no-empty, preserve-caught-error, only-throw-error), Ruff (BLE, TRY, LOG), Error Prone and Sonar on the JVM, Roslyn analyzers in .NET.',
      consequences: '• Little ceremony: the happy path reads straight, and the frameworks already map exceptions to responses.\n• A function\'s signature does not say what it can fail with; reviewers and the hierarchy carry that knowledge.\n• An exception used for an expected case that is frequent (a cache miss, a validation on every field) costs stack capture; batch validation is reported as a notification object, not thrown field by field.\n• The hierarchy must stay small (under about ten classes) or it becomes a second type system nobody keeps up.',
      alternatives: '1. Result types: failures in the signature, at the cost of handling at every call and fighting libraries that throw.\n2. Error codes from a catalogue: stable for clients, but codes compared by hand everywhere inside the code.\n3. Catch-all handlers per controller: the same mapping written many times, drifting apart.',
    },
    {
      id: 'adr-result', label: 'Result types for expected failures', when: { STYLE: ['result'] },
      decision: 'A function that can fail in an expected way returns a Result: Result<T, E> and the ? operator in Rust (thiserror for error types, anyhow only at the binary\'s edge), error values with %w and errors.Is/As in Go, kotlin.Result or Arrow\'s Either in Kotlin, neverthrow (or fp-ts Either) in TypeScript. The error type of each module names its cases and carries a stable code; wraps keep the source. Exceptions and panics are for bugs and broken invariants only and are never caught except at the boundary. An ignored Result fails the build (unused_must_use, errcheck, neverthrow/must-use-result). Errors are {{BOUNDARY}}; the handler maps the error cases to responses and logs each failure once at the level its meaning asks for ({{LEVELS}}). A caller sees {{CALLER}}. Log lines are {{LOGS}} with the {{CORRELATION_FIELD}} from the logger\'s context, and {{REDACTED_FIELDS}} are kept out by {{REDACTION}} in the logger (zap or slog handlers, tracing layers, pino redact or serializers).',
      consequences: '• Every expected failure is in the signature; forgetting one is a compile error, not an incident.\n• Every call that can fail is handled or passed on explicitly, which is more code and a style the whole team must share.\n• Libraries that throw (HTTP clients, ORMs, JSON parsers) are wrapped at the module boundary into Results, and that wrapping is where bugs hide.\n• Unexpected errors still need the boundary handler, so the element has two mechanisms, not one.',
      alternatives: '1. Exceptions with a hierarchy: less ceremony, failures invisible in signatures.\n2. Error codes from a catalogue: values too, but untyped; a Result\'s error type can carry the catalogue code.\n3. Results everywhere, bugs included: panics wrapped as values hide what should crash loudly.',
    },
    {
      id: 'adr-codes', label: 'Error codes from a catalogue', when: { STYLE: ['codes'] },
      decision: 'One catalogue in the repository (errors/catalogue.json, or a generated enum from it) defines every error: a stable upper-case code (ORDER_NOT_FOUND), the HTTP status or exit status, a message template with named placeholders and a documentation URI. Code signals an error by returning or raising an error value built from a catalogue entry (fail(\'ORDER_NOT_FOUND\', { orderId }) in TypeScript or Python, an error struct with the code in Go, an enum in C), never an ad-hoc string; a code that is not in the catalogue fails a test, and a renamed or removed code fails the catalogue snapshot (codes are added or deprecated, never changed). Errors are {{BOUNDARY}}; the handler maps the catalogue entry to the status and to {{CALLER}}, with the code as the stable member, and logs each failure once at the level its meaning asks for ({{LEVELS}}), with the code as a field. Log lines are {{LOGS}} with the {{CORRELATION_FIELD}} from the logger\'s context, and {{REDACTED_FIELDS}} are kept out by {{REDACTION}} in the logger. Unexpected errors map to one catalogue entry (INTERNAL) and keep their cause in the log only.',
      consequences: '• Clients and support share one documented list; a code never changes meaning.\n• The catalogue is a shared file everyone edits; ownership and review of it must be clear or it fills with near-duplicates.\n• Codes are compared as values inside the code too, which is weaker than types; a generated enum limits typos.\n• Message templates in one place are easy to translate and easy to leave stale.',
      alternatives: '1. Exceptions with a hierarchy: the type is the code; works until a client needs the list.\n2. Result types with an error enum per module: typed, but there is no one list across the element.\n3. Codes invented at call sites: what a catalogue replaces; nobody can list them.',
    },
    {
      id: 'adr-edge', label: 'Errors handled once at the edge', when: EDGE,
      decision: 'One error handler per kind of edge owns the mapping from errors to the outside: an Express or Fastify error handler, a NestJS exception filter, a Spring @ControllerAdvice, an ASP.NET exception handler middleware, a FastAPI exception handler; a queue consumer\'s and a scheduled job\'s outer loop do the same for their failures (acknowledge, retry or dead-letter by error kind). The handler maps the error to {{CALLER}}, logs it exactly once with the cause chain and the {{CORRELATION_FIELD}}, and never leaks a stack trace in production. Domain and application code import no HTTP framework and know no status code; a dependency rule (dependency-cruiser, ArchUnit, import-linter) keeps it so.',
      consequences: '• One place to get the mapping right, one log line per failure, and inner code reusable behind another edge.\n• The handler needs the error\'s kind to map it, so the error style must carry it (a subclass, a Result case or a code).\n• A library\'s raw error that reaches the handler untranslated becomes a 500, which is right for a bug and wrong for an expected case someone forgot to type.',
      alternatives: '1. Translation per layer: keeps driver types out of the domain, at the cost of error classes per layer.\n2. Try/catch in every controller action: the same mapping written many times.',
    },
    {
      id: 'adr-layered', label: 'Errors translated layer by layer', when: LAYERED,
      decision: 'Each layer defines its own error types and translates the ones from below at its boundary: the persistence adapter catches driver errors (SQLException, DataAccessException, pg errors) and raises persistence errors (DuplicateKey, Unavailable); the domain and application layers raise their own (OrderNotFound, OrderAlreadyPaid) and wrap persistence errors they cannot handle; the API adapter maps domain errors to {{CALLER}} and logs each failure once with the cause chain and the {{CORRELATION_FIELD}}. Every translation keeps the original as the cause. An architecture test (ArchUnit, dependency-cruiser, import-linter) fails when the domain or application layer depends on a driver or framework error type, and a review rule fails a translation that drops the cause.',
      consequences: '• The domain depends on no vendor\'s types and the same application layer serves HTTP, messaging and batch edges.\n• More error classes and more code at each boundary; a lazy translation that drops the cause is the common bug, so the linters check for it.\n• Logging still happens once, at the edge; a layer that logs what it translates doubles the lines.',
      alternatives: '1. Handled once at the edge: less code, but the domain sees driver errors unless it never catches at all.\n2. One flat hierarchy shared by all layers: fewer classes, but the domain imports the persistence errors.',
    },
  ],
  fitness: [
    {
      id: 'ff-eslint-errors', label: 'TypeScript error rules', category: 'structural', implements: STYLES,
      threshold: '0 violations of no-empty, preserve-caught-error, only-throw-error, no-floating-promises and no-console in src on every pull request',
      description: 'ESLint (9.34 or later for preserve-caught-error) runs as a required check: an empty catch, a rethrow that drops the cause, a thrown non-Error, an unhandled rejected promise and a console call each fail the build.',
      tool: 'ESLint with typescript-eslint',
      language: 'js',
      snippet: `// eslint.config.js
import tseslint from 'typescript-eslint'
export default tseslint.config({
  files: ['src/**/*.ts'],
  languageOptions: { parserOptions: { projectService: true } },
  rules: {
    'no-empty': ['error', { allowEmptyCatch: false }],   // no swallowed errors
    'preserve-caught-error': 'error',                     // new Error(msg, { cause }) when rethrowing
    '@typescript-eslint/only-throw-error': 'error',       // throw Error instances only (no-throw-literal, typed)
    '@typescript-eslint/no-floating-promises': 'error',   // a dropped rejection is a swallowed error
    'no-console': 'error',                                // the logger, never console
  },
})`,
    },
    {
      id: 'ff-ruff-errors', label: 'Python error rules', category: 'structural', implements: STYLES,
      threshold: '0 violations of the BLE, TRY, LOG, G, T20, S110 and B904 rules in src on every pull request',
      description: 'Ruff runs as a required check with the exception and logging rule families: a blind except, a try-except-pass, a raise inside except without from, logging.error instead of logging.exception, an f-string in a log call and a print each fail the build.',
      tool: 'Ruff',
      language: 'toml',
      snippet: `# pyproject.toml
[tool.ruff.lint]
extend-select = [
  "BLE",   # BLE001: blind except Exception without re-raise
  "TRY",   # TRY002 raise bare Exception, TRY003 message built inline, TRY201 bare re-raise,
           # TRY203 useless try/except, TRY300 else clause, TRY400 logging.exception, TRY401 redundant exception in message
  "LOG",   # logging module misuse, e.g. LOG015 root logger calls
  "G",     # G004: f-string in a log call; data goes in extra=, not the message
  "T20",   # T201 print, T203 pprint: the logger, never print
  "S110",  # try-except-pass
  "B904",  # raise ... from err inside except: keep the cause
]
[tool.ruff.lint.per-file-ignores]
"tests/**" = ["T20", "BLE001"]`,
    },
    {
      id: 'ff-java-errors', label: 'Java error rules', category: 'structural', implements: STYLES,
      threshold: '0 Error Prone errors from the exception patterns at compile time; 0 open Sonar issues of S108, S1166, S2139, S1181, S112, S106 on new code',
      description: 'Error Prone runs in the compiler with its exception patterns raised to errors; the SonarQube quality profile sets the matching rules to Blocker so the quality gate on new code fails on an empty catch, a dropped cause, log-and-rethrow, a caught Throwable, a thrown generic exception or System.out.',
      tool: 'Error Prone (javac plugin) and SonarQube',
      language: 'xml',
      snippet: `<!-- pom.xml: maven-compiler-plugin -->
<compilerArgs>
  <arg>-XDcompilePolicy=simple</arg>
  <arg>-Xplugin:ErrorProne
    -Xep:EmptyCatch:ERROR
    -Xep:UnusedException:ERROR
    -Xep:CatchAndPrintStackTrace:ERROR
    -Xep:SystemOut:ERROR
    -Xep:Finally:ERROR</arg>
</compilerArgs>
<!-- SonarQube quality profile, severity Blocker:
     S108  empty block           S1166 exception handlers should preserve the original exception
     S2139 logged and rethrown   S1181 Throwable and Error should not be caught
     S112  generic exception thrown   S106 System.out used to log -->`,
    },
    {
      id: 'ff-semgrep-logging', label: 'No console, print, whole objects or log-and-rethrow', category: 'structural', implements: STYLES,
      threshold: '0 Semgrep findings of the four logging rules in src on every pull request',
      description: 'Semgrep runs on src with four rules: console in TypeScript, print in Python, a log call passed a whole request, response, headers or body object, and a catch that logs and rethrows (the error would be logged twice).',
      tool: 'Semgrep',
      language: 'yaml',
      snippet: `# .semgrep/logging.yml   (semgrep --config .semgrep/ --error src/)
rules:
  - id: no-console
    languages: [typescript, javascript]
    severity: ERROR
    message: Use the logger; console lines have no level, no correlation id and no redaction
    pattern: console.$M(...)
  - id: no-print
    languages: [python]
    severity: ERROR
    message: Use the logger, not print
    pattern: print(...)
  - id: no-whole-object-logged
    languages: [typescript, javascript, python]
    severity: ERROR
    message: Never log a whole request, response, headers or body; log the fields the serializer allows
    patterns:
      - pattern: $LOG.$LEVEL(..., $OBJ, ...)
      - metavariable-regex: { metavariable: $LEVEL, regex: ^(error|warn|warning|info|debug|exception)$ }
      - metavariable-regex: { metavariable: $OBJ, regex: ^(req|request|res|response|ctx|event|body|headers)$ }
  - id: log-and-rethrow
    languages: [typescript, javascript]
    severity: ERROR
    message: Log once, where the error is handled; a catch that logs and rethrows logs it twice
    pattern: |
      try { ... } catch ($E) { ... $LOG.$LEVEL(...); ... throw ...; }`,
    },
    {
      id: 'ff-redact-denylist', label: 'Secret paths redacted in the logger', when: { REDACTION: ['denylist'] }, category: 'structural', implements: STYLES,
      threshold: 'Every path of {{REDACTED_FIELDS}} is in the logger\'s redact list; a unit test logging each of them sees only the redaction marker',
      description: 'The logger is built once with a redact list of the known secret and personal-data paths; a unit test logs an object holding each of them at top level and one level down and asserts that the written line holds only the marker. structlog: a processor that walks event_dict for the same keys; Serilog: Destructurama.Attributed or a masking enricher with the same list.',
      tool: 'pino (redact) with a Vitest test',
      language: 'js',
      snippet: `// src/logger.js
import pino from 'pino'
export const PATHS = ['password', 'token', 'authorization', 'cookie', 'email', 'iban']   // REDACTED_FIELDS
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: [...PATHS, ...PATHS.map((p) => \`*.\${p}\`), 'req.headers.authorization', 'req.headers.cookie'], censor: '[REDACTED]' },
})

// test/logger.test.js
it('redacts every listed path at the top level and one level down', () => {
  const lines = []
  const log = pino({ redact: logger[pino.symbols.redactFmtSym] ?? { paths: PATHS.flatMap((p) => [p, \`*.\${p}\`]), censor: '[REDACTED]' } },
    { write: (l) => lines.push(l) })
  log.info({ ...Object.fromEntries(PATHS.map((p) => [p, 'secret-1'])), user: Object.fromEntries(PATHS.map((p) => [p, 'secret-2'])) }, 'sign-in')
  expect(lines[0]).not.toMatch(/secret-[12]/)
  expect((lines[0].match(/\\[REDACTED\\]/g) ?? []).length).toBe(PATHS.length * 2)
})`,
    },
    {
      id: 'ff-redact-allowlist', label: 'Only allowed fields leave the logger', when: { REDACTION: ['allowlist'] }, category: 'structural', implements: STYLES,
      threshold: '100 % of top-level log fields are on the allow-list and every object field goes through a serializer; a unit test logging an unknown field and a whole user object sees neither',
      description: 'The logger\'s formatter drops every top-level field that is not on the allow-list, and each object type has a serializer that picks its allowed fields, so nothing is logged whole; a unit test logs an unknown field and a whole user record and asserts that only the allowed fields are written. structlog: a processor that filters event_dict to the same list.',
      tool: 'pino (formatters and serializers) with a Vitest test',
      language: 'js',
      snippet: `// src/logger.js
import pino from 'pino'
const ALLOWED = new Set(['level', 'time', 'msg', 'service', 'traceId', 'err', 'req', 'user', 'order', 'durationMs', 'code'])
const pick = (keys) => (o) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]))
export const logger = pino({
  base: { service: 'order-api' },
  formatters: { log: (o) => Object.fromEntries(Object.entries(o).filter(([k]) => ALLOWED.has(k))) },
  serializers: {
    req: (r) => ({ id: r.id, method: r.method, path: String(r.url).split('?')[0] }),   // no headers, no body
    user: pick(['id', 'role']),                                                           // never name, email, phone
    order: pick(['id', 'status', 'total']),
    err: pino.stdSerializers.err,
  },
})
// test: logger.info({ user: { id: 7, email: 'a@b.c' }, password: 'x' }, 'sign-in')
//   expect(line).toContain('"user":{"id":7,"role"') ; expect(line).not.toMatch(/a@b\\.c|password/)`,
    },
    {
      id: 'ff-log-shape', label: 'Every log line well-formed and correlated', category: 'process', implements: STYLES,
      threshold: '100 % of the lines written during a full test run parse as {{LOGS}}, carry a level from {{LEVELS}}, a {{CORRELATION_FIELD}} and a message of at most {{MAX_MESSAGE_CHARS}} characters',
      description: 'The test run writes its logs to a file; a test afterwards reads every line and asserts the shape: JSON lines must parse and hold the fields, text lines must match the fixed layout. One malformed or uncorrelated line fails the build.',
      tool: 'Vitest (a test over the test run\'s log file)',
      language: 'ts',
      snippet: `// test/log-shape.test.ts  (the app writes LOG_FILE=test-logs/app.log during the run)
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
const FIELD = '{{CORRELATION_FIELD}}'
const LEVELS = '{{LEVELS}}'.split(/,\\s*/)
const MAX = {{MAX_MESSAGE_CHARS}}
const TEXT = /^\\d{4}-\\d\\d-\\d\\dT\\S+ (ERROR|WARN|INFO|DEBUG) \\[[0-9a-f]{16,32}\\] .{1,200}(\\s\\w+=\\S+)*$/
it('every log line of the test run is well-formed and carries the correlation id', () => {
  const lines = readFileSync('test-logs/app.log', 'utf8').split('\\n').filter((l) => l && !l.startsWith(' '))   // indented = stack trace
  expect(lines.length).toBeGreaterThan(0)
  for (const line of lines) {
    if (line.startsWith('{')) {
      const o = JSON.parse(line)
      expect(LEVELS, line).toContain(o.level)
      expect(o[FIELD], line).toMatch(/^[0-9a-f]{16,32}$/)
      expect(String(o.msg ?? o.message).length, line).toBeLessThanOrEqual(MAX)
    } else expect(line).toMatch(TEXT)
  }
})`,
    },
    {
      id: 'ff-no-stack-to-caller', label: 'A 500 carries no stack trace', category: 'process', implements: STYLES,
      threshold: '0 stack-trace patterns, class names, paths or SQL in the body of a 500 response with production settings; the body holds exactly the agreed fields and the {{CORRELATION_FIELD}}',
      description: 'An integration test starts the element with production settings, calls a route that throws an unexpected error, and asserts the response shape ({{CALLER}}) and that the body matches no stack-trace, class-name, path or SQL pattern. The same test with a route that throws an expected error checks the mapped status.',
      tool: 'Vitest with supertest',
      language: 'ts',
      snippet: `// test/http/error-response.test.ts   (NODE_ENV=production in this file's setup)
import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'   // registers GET /__boom in tests only: throws new TypeError('kaput')

const LEAKS = /\\n\\s+at |TypeError|kaput|\\/src\\/|node_modules|\\.ts:\\d+|SELECT |INSERT |localhost|10\\.\\d+\\.\\d+\\.\\d+/

it('an unexpected error reaches the caller as a clean 500', async () => {
  const res = await request(app).get('/__boom').set('traceparent', '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')
  expect(res.status).toBe(500)
  expect(JSON.stringify(res.body)).not.toMatch(LEAKS)
  expect(res.body['{{CORRELATION_FIELD}}']).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
  expect(Object.keys(res.body).sort()).toMatchSnapshot()   // the agreed fields, nothing more; reviewed when it changes
  // problem details: expect(res.headers['content-type']).toMatch(/application\\/problem\\+json/); expect(res.body.type).toMatch(/^https?:/)
})`,
    },
    {
      id: 'ff-edge-imports', label: 'Only the edge maps errors to responses', when: EDGE, category: 'structural', implements: ['adr-edge'],
      threshold: '0 modules outside src/http import the error handler or the response mapping; 0 domain or application modules import an HTTP framework',
      description: 'A dependency rule fails the build when any module outside the edge imports the error-to-response mapping, or when domain or application code imports the HTTP framework (and so could build a response or know a status code). On the JVM the same rule is an ArchUnit test; in Python, import-linter.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    {
      name: 'only-the-edge-maps-errors',
      comment: 'ADR Errors handled once at the edge: only src/http knows the response shape and status codes',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/http/' },
      to: { path: '^src/http/(error-handler|problem)\\\\.ts$' },
    },
    {
      name: 'inner-code-knows-no-http',
      comment: 'domain and application code throws or returns; it does not build responses',
      severity: 'error',
      from: { path: '^src/(domain|application)/' },
      to: { path: 'node_modules/(express|fastify|@nestjs/common|hono|koa)' },
    },
  ],
}`,
    },
    {
      id: 'ff-layer-errors', label: 'Driver errors stay below the domain', when: LAYERED, category: 'structural', implements: ['adr-layered'],
      threshold: '0 dependencies from the domain or application packages on driver, persistence or HTTP-client exception types; every domain exception extends the domain base',
      description: 'An ArchUnit test fails the build when a domain or application class depends on a driver or framework exception type, when a persistence adapter method declares a driver exception, or when a domain exception does not extend the domain base class. In TypeScript the same rules are dependency-cruiser rules on the driver packages.',
      tool: 'ArchUnit (JUnit 5)',
      language: 'java',
      snippet: `// src/test/java/com/shop/orders/LayerErrorsTest.java
@AnalyzeClasses(packages = "com.shop.orders")
class LayerErrorsTest {
  @ArchTest
  static final ArchRule domain_sees_no_driver_errors = noClasses()
      .that().resideInAnyPackage("..domain..", "..application..")
      .should().dependOnClassesThat().resideInAnyPackage(
          "java.sql..", "org.springframework.dao..", "jakarta.persistence..", "org.springframework.web.client..");

  @ArchTest
  static final ArchRule adapters_translate_driver_errors = methods()
      .that().areDeclaredInClassesThat().resideInAPackage("..adapter.persistence..").and().arePublic()
      .should().notDeclareThrowableOfType(java.sql.SQLException.class);

  @ArchTest
  static final ArchRule domain_errors_extend_the_base = classes()
      .that().resideInAPackage("..domain..").and().haveSimpleNameEndingWith("Exception")
      .should().beAssignableTo(DomainException.class);
}`,
    },
    {
      id: 'ff-result-must-use', label: 'No Result ignored', when: { STYLE: ['result'] }, category: 'structural', implements: ['adr-result'],
      threshold: '0 Results left unhandled in src: the build fails on an unused Result, an unchecked error value or an unwrap outside tests',
      description: 'The linter of the language makes a dropped Result a build error: neverthrow/must-use-result in TypeScript, unused_must_use plus clippy\'s unwrap_used and expect_used in Rust, errcheck, errorlint and wrapcheck in golangci-lint.',
      tool: 'eslint-plugin-neverthrow (TypeScript); clippy (Rust); golangci-lint (Go)',
      language: 'js',
      snippet: `// eslint.config.js (added for the result style)
import neverthrow from 'eslint-plugin-neverthrow'
export default [{
  files: ['src/**/*.ts'],
  plugins: { neverthrow },
  rules: { 'neverthrow/must-use-result': 'error' },   // a Result never matched or unwrapped is a dropped error
}]

// Rust, src/lib.rs:  #![deny(unused_must_use, clippy::unwrap_used, clippy::expect_used)]   (allowed under #[cfg(test)])
// Go, .golangci.yml:
//   linters: { enable: [errcheck, errorlint, wrapcheck] }
//   linters-settings: { errcheck: { check-blank: true, check-type-assertions: true } }`,
    },
    {
      id: 'ff-codes-catalogue', label: 'Every code is in the catalogue and stable', when: { STYLE: ['codes'] }, category: 'structural', implements: ['adr-codes'],
      threshold: '100 % of codes used in src exist in the catalogue; the sorted list of codes matches its snapshot, so a rename or removal fails the build',
      description: 'A test collects every code used in src, checks each against the catalogue, snapshots the sorted list of codes so that a removed or renamed code is a reviewed change, and checks that every entry has a status, a documentation URI and a message template under the length limit.',
      tool: 'Vitest (a test over the error catalogue)',
      language: 'ts',
      snippet: `// test/errors/catalogue.test.ts
import { execSync } from 'node:child_process'
import { expect, it } from 'vitest'
import { CATALOGUE } from '../../src/errors/catalogue'   // { ORDER_NOT_FOUND: { status: 404, type: 'https://…/errors/order-not-found', message: 'Order {orderId} not found' }, … }

const used = new Set(execSync("grep -rhoE \\"fail\\\\('[A-Z_]+'\\" src | grep -oE '[A-Z_]+'").toString().trim().split('\\n'))

it('every code used in src is in the catalogue', () => {
  for (const code of used) expect(CATALOGUE, \`\${code} is not in the catalogue\`).toHaveProperty(code)
})
it('codes are added or deprecated, never renamed or removed', () => {
  expect(Object.keys(CATALOGUE).sort()).toMatchSnapshot()
})
it('every entry has a status, a documentation URI and a short message', () => {
  for (const [code, e] of Object.entries(CATALOGUE)) {
    expect(e.status, code).toBeGreaterThanOrEqual(400)
    expect(e.type, code).toMatch(/^https?:\\/\\//)
    expect(e.message.length, code).toBeLessThanOrEqual({{MAX_MESSAGE_CHARS}})
  }
})`,
    },
  ],
}

export default pack
