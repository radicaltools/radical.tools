import type { PackSpec, When } from '../../src/packSpec'

const GUIDES = ['adr-guide-azure', 'adr-guide-zalando', 'adr-guide-google', 'adr-guide-own']
const SPECTRAL: When = { LINT: ['spectral'] }
const FORCES = 'Other systems and other parts of this system call its API, and every caller pays for each inconsistency in it: a field named in camelCase here and snake_case there, lists paged three ways, errors in four shapes. The forces: without a written guide every team decides these small questions again, and differently; a published guide settles hundreds of them at once and has been argued over in public, but none fits every case and each brings its own conventions with it; rules that only reviewers check drift with reviewer fatigue, while a linter catches naming and structure in seconds and says nothing about design; some deviations are necessary (a legacy API, a partner\'s format), but an exception without a reason and an end becomes the rule; and the contract may be written before the code or produced from it, while the guide has to hold for the document callers read. HTTP semantics (RFC 9110) are the common ground every guide refines. This pack applies to HTTP/JSON APIs described in OpenAPI; GraphQL and gRPC follow their own conventions.'

const pack: PackSpec = {
  id: 'concern-api-style-guide',
  name: 'API style guide',
  group: 'api',
  description: 'Which published HTTP API guideline the element\'s APIs follow, how conformance is checked, whether the OpenAPI document comes before the code or from it, and how a deviation is recorded. The lead pack of the API Guidelines group: the Resource design, Errors, Collections and Idempotency and concurrency packs decide the details the chosen guide suggests, and API evolution decides the description format and versions.',
  tags: ['api', 'style-guide', 'openapi', 'spectral', 'linting', 'api-governance'],
  concern: {
    id: 'api-style-guide',
    trigger: 'LIST RELATIONS WHERE source.type != "person" AND target.external != true AND (target.type = "container" OR target.type = "component")',
    applyTo: 'target',
    why: 'other systems or other parts call these elements, so which API guideline their interfaces follow, and how that is checked, has to be decided.',
  },
  sources: [
    { title: 'Microsoft Azure REST API Guidelines (microsoft/api-guidelines, azure/Guidelines.md)', url: 'https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md' },
    { title: 'Microsoft REST API Guidelines repository: the general guide deprecated, the Azure and Microsoft Graph guidelines current', url: 'https://github.com/microsoft/api-guidelines' },
    { title: 'Zalando RESTful API and Event Guidelines', url: 'https://opensource.zalando.com/restful-api-guidelines/' },
    { title: 'Google API Improvement Proposals (AIPs)', url: 'https://google.aip.dev/' },
    { title: 'OpenAPI Specification 3.1.1', url: 'https://spec.openapis.org/oas/v3.1.1.html' },
    { title: 'Spectral documentation (rulesets, extends, overrides, CLI)', url: 'https://github.com/stoplightio/spectral/tree/develop/docs' },
    { title: 'Zally, the API linter for the Zalando guidelines', url: 'https://github.com/zalando/zally' },
    { title: 'Spectral ruleset for the Zalando RESTful API Guidelines (@baloise/spectral-rules)', url: 'https://github.com/baloise-incubator/spectral-ruleset' },
    { title: 'Azure API Style Guide and its Spectral ruleset (archived September 2026)', url: 'https://github.com/Azure/azure-api-style-guide' },
    { title: 'Google API Linter (protocol buffers)', url: 'https://linter.aip.dev/' },
    { title: 'RFC 9110, HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
  ],
  questions: [
    {
      key: 'GUIDE', title: 'Guide', label: 'Which published API guideline do the element\'s HTTP APIs follow?',
      hint: 'One guide settles hundreds of small questions at once: field names, paths, lists, errors, updates. The other API Guidelines packs (Resource design, Errors, Collections, Idempotency and concurrency) decide those details; the guide picked here is what they start from. Microsoft\'s general REST API Guidelines are deprecated: Microsoft now keeps the Azure guidelines, the complete one, and the Microsoft Graph guidelines, which are for Graph workloads only. Applies to HTTP/JSON APIs described in OpenAPI; GraphQL and gRPC follow their own conventions, and the API evolution pack decides the description format.',
      default: 'zalando',
      options: [
        { value: 'azure', label: 'the Microsoft Azure REST API Guidelines', description: 'Microsoft\'s current REST guide (azure/Guidelines.md in microsoft/api-guidelines): camelCase field names, lists as a value array with a nextLink, an error object with code and message plus an x-ms-error-code header, a required api-version query parameter, JSON Merge Patch for updates. Pick it on Azure or Microsoft stacks, or when your callers already know Azure\'s APIs; its Spectral ruleset is archived, so you keep a copy yourself.' },
        { value: 'zalando', label: 'the Zalando RESTful API Guidelines', description: 'An open guide of numbered MUST, SHOULD and MAY rules: API first, snake_case property names, kebab-case paths, Problem JSON for errors, cursor-based pagination preferred, no version in the URL. Pick it for a REST landscape of several teams that wants rules strict enough to lint; Zally and a community Spectral ruleset check them.' },
        { value: 'google', label: 'Google\'s API Improvement Proposals (AIPs)', description: 'Google\'s numbered proposals for resource-oriented APIs: resource names, the standard methods Get, List, Create, Update and Delete, custom methods with a colon verb, page tokens, errors as google.rpc.Status, written protobuf-first and mapped to HTTP/JSON with camelCase fields (AIP-127). Pick it when your APIs are also served over gRPC or you follow Google Cloud\'s style; only protocol buffers have a linter (api-linter), so for OpenAPI the team writes the Spectral rules.' },
        { value: 'own', label: 'our own guide, derived from a published one', description: 'A guide kept in the repository (api/style/guide.md) that names the published guide it starts from, numbers its rules, and says where and why it differs. Pick it when the organisation already has conventions no published guide matches, or several guides must be reconciled; you own the rules and their ruleset.' },
      ],
    },
    {
      key: 'LINT', title: 'Enforcement', label: 'How is conformance to the guide enforced?',
      hint: 'A linter checks naming and structure on every change in seconds; reviewers then spend their time on the design, which no linter judges. API owners review contract changes either way.',
      default: 'spectral',
      options: [
        { value: 'spectral', label: 'Spectral in CI, failing the pull request', description: 'Every pull request lints the OpenAPI documents with Spectral and the guide\'s ruleset kept in the repository; a finding of severity error blocks the merge, warnings show on the changed lines. Pick it whenever the guide has a ruleset or the team can write one. With the Zalando guide, Zally does the same where the team runs a Zally server.' },
        { value: 'review', label: 'review by the API owners only', description: 'No linter: the API owners check each contract change against the guide with a checklist in the pull request. Pick it for one small API, or for the months before a ruleset exists; it does not scale past a few APIs and misses what a tired reviewer misses.' },
      ],
    },
    {
      key: 'DESIGN', title: 'Contract first?', label: 'Does the OpenAPI document come before the code or from it?',
      hint: 'Design-first agrees the contract before anyone builds against it; code-first keeps the document and the code from drifting apart because one is made from the other. The guide is checked on the document in both cases.',
      default: 'design',
      options: [
        { value: 'design', label: 'the OpenAPI document written first and merged before the code', description: 'A new or changed operation is proposed as a change to the document alone, reviewed, merged, and only then implemented; the server serves exactly what the document describes. Pick it for APIs other teams or companies call, where the contract is agreed before anyone builds against it. The Zalando guide requires it (rule 100, API first).' },
        { value: 'code', label: 'the OpenAPI document generated from the code', description: 'The document is generated from the code\'s annotations (springdoc-openapi, FastAPI, @nestjs/swagger, tsoa), committed under api/, and each pull request shows its diff for review. Pick it for APIs whose callers are your own front ends, or where the framework\'s annotations are the team\'s habit.' },
      ],
    },
    {
      key: 'EXCEPTIONS', title: 'Deviations', label: 'How is a deviation from the guide recorded?',
      hint: 'Some deviations are necessary: a legacy API, a partner\'s format, a framework that cannot do otherwise. Recorded where they happen, with a reason and an end, they stay visible; unrecorded, they become the rule.',
      default: 'inline',
      options: [
        { value: 'inline', label: 'an inline exception in the OpenAPI document, with a reason and an expiry', description: 'A deviation is recorded on the operation or schema it concerns, as an x-api-style-exceptions entry naming the rule, the reason, the approving API owner and an expiry date; the linter turns that rule off there and nowhere else. Pick it for a landscape with legacy APIs or partner formats that cannot follow every rule.' },
        { value: 'none', label: 'no exceptions; a rule that does not fit is changed for every API', description: 'Nothing turns a rule off for one API: a rule that does not fit is changed or removed in the ruleset for everyone. Pick it for a new landscape with few APIs, where the first exception would not be the last.' },
      ],
    },
  ],
  details: [
    { key: 'API_OWNERS', label: 'Which GitHub team owns the API style and approves contract changes?', default: '@acme/api-owners' },
    { key: 'EXCEPTION_MONTHS', label: 'For how many months at most may an exception stand before it is renewed? (inline exceptions only)', default: '6', number: true },
  ],
  need: {
    label: 'APIs that read as one',
    text: 'Other systems and other parts of this system call its APIs. Every caller learns one API and expects the next to work the same way: the same names, the same lists, the same errors. Without a guide, and without a check that the guide is followed, each API drifts its own way and every caller pays for it in client code. The snippets assume one OpenAPI document per API under api/ (api/orders.yaml), the style ruleset in api/style/ruleset.yaml extended by .spectral.yaml at the root, our own guide (where there is one) in api/style/guide.md, the router\'s table exported from src/app, and CODEOWNERS and the pull-request template under .github/.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-guide-declared', label: 'Guide named in every contract', ears_type: 'ubiquitous',
      action: 'declare in every OpenAPI document under api/ the guide it follows, as info.x-api-guide with the name and URL of {{GUIDE}} and the revision adopted, the same guide in every document',
      rationale: 'Callers and reviewers can tell which conventions to expect, and a guide that changes upstream is adopted on purpose at a known revision; OpenAPI allows such x- extensions on the Info Object (OpenAPI Specification 3.1.1, Specification Extensions).',
      scenario: { label: 'Contract names its guide', given: 'the OpenAPI documents under api/', when: 'their info objects are read', then: 'each has x-api-guide with a name, an https URL and a revision, and all name the same guide' },
    },
    {
      id: 'req-lint', label: 'Contracts linted on every change', when: SPECTRAL, ears_type: 'event-driven',
      trigger: 'a pull request changes a document under api/ or the style ruleset',
      action: 'lint every document under api/ with Spectral and the ruleset of {{GUIDE}}, block the merge on any finding of severity error, and show warnings on the changed lines',
      rationale: 'Naming and structure are what a linter checks best and reviewers check worst; failing at severity error is Spectral\'s default (Spectral documentation, CLI: --fail-severity).',
      scenario: { label: 'Violation blocks the merge', given: 'a pull request adding a property whose name breaks the guide\'s casing rule', when: 'the API style job runs', then: 'it fails with an annotation on that line, and the pull request cannot be merged' },
    },
    {
      id: 'req-ruleset-pinned', label: 'Ruleset kept and pinned', when: SPECTRAL, ears_type: 'ubiquitous',
      action: 'keep the style ruleset in the repository under api/style/, extending the guide\'s published ruleset only as a vendored copy or a package at an exact version, never a URL, so that a change upstream never fails an unchanged pull request',
      rationale: 'A ruleset fetched from a branch changes under you; the Azure ruleset is archived and will not change at all, so it is kept as a copy (Spectral documentation, extends; Azure API Style Guide).',
      scenario: { label: 'Unpinned ruleset refused', given: 'a ruleset that extends a raw GitHub URL', when: 'the ruleset check runs', then: 'it fails naming the URL, and passes once the ruleset is vendored or installed at an exact version' },
    },
    {
      id: 'req-rule-sources', label: 'Every rule names its guideline', when: SPECTRAL, ears_type: 'ubiquitous',
      action: 'give every rule the ruleset defines a documentationUrl to the guideline it enforces and a severity of error for the guide\'s MUST (DO) rules and warn for its SHOULD rules',
      rationale: 'A finding that links to its guideline is fixed rather than argued about, and the severity mirrors the guide\'s own keywords (Spectral documentation, rules: documentationUrl and severity; Zalando RESTful API Guidelines, rule 100).',
      scenario: { label: 'Rule without a source refused', given: 'a new rule in api/style/ruleset.yaml with no documentationUrl', when: 'the ruleset check runs', then: 'it fails naming the rule' },
    },
    {
      id: 'req-owners-review', label: 'API owners approve contract changes', ears_type: 'event-driven',
      trigger: 'a pull request changes a document or the style ruleset under api/',
      action: 'request a review from {{API_OWNERS}} and merge it only after one of them approves, having checked the change against {{GUIDE}} for what no rule checks',
      rationale: 'A linter checks names and shapes, not whether a resource is the right one; the guides assume a review by people who own the API style (Microsoft Azure REST API Guidelines, API review; Zalando RESTful API Guidelines, rule 100).',
      scenario: { label: 'Contract waits for its owners', given: 'a pull request that changes api/orders.yaml', when: 'it is opened', then: '{{API_OWNERS}} is requested for review and the merge waits for its approval' },
    },
    {
      id: 'req-review-checklist', label: 'Guide checklist ticked', when: { LINT: ['review'] }, ears_type: 'event-driven',
      trigger: 'a pull request changes a document under api/',
      action: 'carry the API style checklist of {{GUIDE}} from the pull-request template, and merge only when every item of it is ticked',
      rationale: 'Without a linter the checklist is the only record that each rule was looked at; an unticked item is a question the reviewer skipped.',
      scenario: { label: 'Unticked item blocks', given: 'a pull request changing api/orders.yaml whose checklist has one item unticked', when: 'the checklist job runs', then: 'it fails, and passes once the item is ticked' },
    },
    {
      id: 'req-design-first', label: 'Contract merged before code', when: { DESIGN: ['design'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request changes a document under api/ and the implementation under src/ together',
      action: 'refuse the merge, so that a contract change is reviewed and merged on its own before the code that serves it',
      rationale: 'An agreed contract lets callers build against it while it is implemented; reviewed beside its code, the contract is read as a by-product of it (Zalando RESTful API Guidelines, rule 100, API first).',
      scenario: { label: 'Mixed change refused', given: 'a pull request adding an operation to api/orders.yaml and its handler to src/', when: 'the design-first check runs', then: 'it fails; split into two pull requests, the contract one passes' },
    },
    {
      id: 'req-design-routes', label: 'Server serves the contract', when: { DESIGN: ['design'] }, ears_type: 'ubiquitous',
      action: 'serve exactly the operations its OpenAPI documents describe: 0 routes the documents do not describe, and 501 Not Implemented for every described operation not built yet',
      rationale: 'With the contract first, the code follows it; an undescribed route is a contract nobody reviewed, and 501 is the status for a method the server does not support yet (RFC 9110, 15.6.2).',
      scenario: { label: 'Undescribed route caught', given: 'a handler for GET /orders/{id}/notes that api/orders.yaml does not describe', when: 'the route test runs', then: 'it fails naming GET /orders/{id}/notes' },
    },
    {
      id: 'req-code-first', label: 'Generated contract committed', when: { DESIGN: ['code'] }, ears_type: 'event-driven',
      trigger: 'a pull request is built',
      action: 'generate the OpenAPI documents from the code and fail when they differ from the documents committed under api/, so that every contract change shows as a diff in the pull request',
      rationale: 'Generated from the code the document cannot drift from it, but callers and the linter read the committed copy; the diff is where a reviewer sees the contract change (OpenAPI Specification 3.1.1).',
      scenario: { label: 'Stale contract caught', given: 'a pull request that renames a field in the code without regenerating api/', when: 'it is built', then: 'the contract job fails and names api/ as changed' },
    },
    {
      id: 'req-exception-recorded', label: 'Deviations recorded where they occur', when: { EXCEPTIONS: ['inline'] }, ears_type: 'ubiquitous',
      action: 'record each deviation from {{GUIDE}} on the element of the OpenAPI document it concerns, as an x-api-style-exceptions entry naming the rule, the reason, the approving API owner, the approval date and an expiry at most {{EXCEPTION_MONTHS}} months later, and turn a lint rule off only through such an entry',
      rationale: 'An exception kept beside what it excuses is seen by every reader of the contract; Spectral can turn a rule off for one part of one document, and Zally\'s x-zally-ignore shows the same idea (Spectral documentation, overrides; Zally).',
      scenario: { label: 'Incomplete exception refused', given: 'an x-api-style-exceptions entry with no reason on GET /orders', when: 'the exception check runs', then: 'it fails naming the operation; with a reason, an approver and an expiry it passes and the rule is off for that operation only' },
    },
    {
      id: 'req-exception-expiry', label: 'Expired exceptions fail', when: { EXCEPTIONS: ['inline'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an exception passes its expiry date',
      action: 'fail the build until the deviation is fixed or the exception is renewed with a new approval in a pull request the API owners approve',
      rationale: 'An exception without an end becomes the rule; the expiry makes someone decide again.',
      scenario: { label: 'Expired exception fails', given: 'an exception whose expiry was yesterday', when: 'the exception check runs', then: 'it fails naming the rule and the date' },
    },
    {
      id: 'req-no-exceptions', label: 'No rule off for one API', when: { EXCEPTIONS: ['none'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a document or the ruleset turns a rule off for one part of an API, through an x-api-style-exceptions entry, x-zally-ignore or a Spectral override',
      action: 'fail the build; a rule that does not fit is changed or removed in the ruleset for every API, in a pull request the API owners approve',
      rationale: 'With no exceptions the ruleset is the same for everyone, so a misfit rule is fixed once instead of excused many times (Spectral documentation, overrides; Zally, rule H002: avoid x-zally-ignore).',
      scenario: { label: 'Override refused', given: 'a pull request that adds an overrides section to .spectral.yaml', when: 'the build runs', then: 'it fails and asks for the rule to be changed in api/style/ruleset.yaml instead' },
    },
    {
      id: 'req-own-guide', label: 'Our guide says how each rule is checked', when: { GUIDE: ['own'] }, ears_type: 'ubiquitous',
      action: 'keep the guide in api/style/guide.md, naming the published guide it derives from and its revision, with every rule numbered, marked MUST or SHOULD, and followed by the lint rule that checks it or "review"',
      rationale: 'A guide of our own is only as good as its upkeep: naming the base keeps its answers traceable, and naming the check for each rule shows what is enforced and what is hoped for (Spectral documentation, rulesets).',
      scenario: { label: 'Rule without a check refused', given: 'api/style/guide.md with a rule "R14 MUST" and no "Checked by:" line', when: 'the guide test runs', then: 'it fails, and passes once the rule names a lint rule that exists or "review"' },
    },
  ],
  adrs: [
    {
      id: 'adr-guide-azure', label: 'APIs follow the Microsoft Azure REST API Guidelines', when: { GUIDE: ['azure'] },
      decision: 'Every HTTP/JSON API of the element follows the Microsoft Azure REST API Guidelines (azure/Guidelines.md on the vNext branch of microsoft/api-guidelines), at the revision recorded in each document\'s info.x-api-guide. The general Microsoft REST API Guidelines are deprecated and are not used; the Microsoft Graph guidelines apply to Microsoft Graph workloads only. Its DO rules are binding, its YOU SHOULD rules are followed unless an exception says why; the parts written for Azure Resource Manager and the Azure API Stewardship Board are not adopted, and our API owners ({{API_OWNERS}}) take the Board\'s place. For the other API Guidelines packs it implies camelCase field names, lists as an object with a value array and an absolute nextLink, an error object with code and message and an x-ms-error-code header, JSON Merge Patch for partial updates, ETag with If-Match for concurrency and Repeatability-Request-ID for retried POSTs; its api-version query parameter is weighed in the API evolution pack. Conformance: {{LINT}}. Where Spectral lints, api/style/ruleset.yaml extends the Spectral ruleset of Azure/azure-api-style-guide (spectral.yaml with its functions directory), vendored into api/style/vendor/azure at that repository\'s final commit: the repository was archived in September 2026 when Azure moved its specifications to TypeSpec, so the copy is ours to keep. Contract: {{DESIGN}}. Deviations: {{EXCEPTIONS}}. The OpenAPI extensions of our own are named in this decision and nowhere else: info.x-api-guide (the guide and its revision), x-api-style-exceptions (a recorded deviation, where deviations are allowed) and x-retry-safe (an operation a client must not retry, when the Idempotency and concurrency pack decides so); a pack or team that needs another x- name adds it here first.',
      consequences: '• Callers who know Azure\'s APIs, and clients generated for them, find what they expect.\n• The guide is long and written for Azure services; deciding which of its rules apply is work the API owners do once and record.\n• The archived ruleset gets no fixes: rules that misfire on OpenAPI 3.1 are changed in our copy, and new rules are ours to write.\n• Azure itself now designs in TypeSpec, so the guide\'s own tooling has moved away from hand-written OpenAPI.',
      alternatives: '1. The Zalando RESTful API Guidelines: stricter, with numbered rules made to be linted, but snake_case and Problem JSON differ from Microsoft\'s conventions.\n2. Google\'s AIPs: thorough on resource design, but protobuf-first and without an OpenAPI linter.\n3. The Microsoft Graph REST API Guidelines: Microsoft\'s other current guide, but built around Microsoft Graph and OData conventions.\n4. Our own guide derived from this one: freedom to drop the Azure-only parts, at the cost of keeping a guide.',
    },
    {
      id: 'adr-guide-zalando', label: 'APIs follow the Zalando RESTful API Guidelines', when: { GUIDE: ['zalando'] },
      decision: 'Every HTTP/JSON API of the element follows the Zalando RESTful API Guidelines (opensource.zalando.com/restful-api-guidelines), at the revision recorded in each document\'s info.x-api-guide. MUST rules are binding, SHOULD rules are followed unless an exception says why. Every document carries info.x-api-id and info.x-audience (rules 215 and 219). For the other API Guidelines packs it implies snake_case property names (rule 118), kebab-case path segments (rule 129), Problem JSON for errors (rule 176), cursor-based pagination over offsets (rule 160), and ETag with If-Match and the Idempotency-Key header as options (rules 182 and 230); its rule against versions in the URL (rule 115) is weighed in the API evolution pack. Rule 100 asks for API first, which is met only when the OpenAPI document is written and merged before the code. Conformance: {{LINT}}. Where Spectral lints, api/style/ruleset.yaml extends the zalando flavour of the community ruleset @baloise/spectral-rules (zalando.yml, installed at an exact version), which covers part of the MUST rules, and adds rules of ours for the rest that a document shows; Zally, Zalando\'s own linter, is the alternative where the team runs a Zally server (zally lint fails on any MUST violation). Contract: {{DESIGN}}. Deviations: {{EXCEPTIONS}}. API owners ({{API_OWNERS}}) approve every contract change. The OpenAPI extensions of our own are named in this decision and nowhere else: info.x-api-guide (the guide and its revision), x-api-style-exceptions (a recorded deviation, where deviations are allowed) and x-retry-safe (an operation a client must not retry, when the Idempotency and concurrency pack decides so); a pack or team that needs another x- name adds it here first.',
      consequences: '• Numbered rules with MUST, SHOULD and MAY make findings and exceptions easy to name.\n• snake_case fields are unusual for JavaScript clients, which map names or live with them.\n• The community Spectral ruleset is maintained by Baloise, not Zalando, and covers only part of the MUST rules; the rest are ours to write or to check in review.\n• The guide also covers events and Zalando\'s own infrastructure (x-api-id, x-audience); the parts that do not apply to us are recorded once.',
      alternatives: '1. The Microsoft Azure REST API Guidelines: camelCase and nextLink, familiar to Azure users, but its ruleset is archived.\n2. Google\'s AIPs: thorough on resource design, but protobuf-first and without an OpenAPI linter.\n3. Our own guide derived from this one: our conventions, at the cost of keeping a guide.\n4. No guide: every team decides again, and the callers pay for the differences.',
    },
    {
      id: 'adr-guide-google', label: 'APIs follow Google\'s API Improvement Proposals', when: { GUIDE: ['google'] },
      decision: 'Every HTTP/JSON API of the element follows Google\'s API Improvement Proposals (google.aip.dev), the general AIPs at the revision recorded in each document\'s info.x-api-guide: resource-oriented design (AIP-121), resource names (AIP-122), the standard methods (AIP-131 to AIP-135) and custom methods with a colon verb (AIP-136), mapped to HTTP/JSON as AIP-127 describes. For the other API Guidelines packs it implies lowerCamelCase JSON field names (the JSON form of AIP-140\'s lower_snake_case), page_size and page_token with next_page_token for lists (AIP-158), errors as google.rpc.Status (AIP-193), an etag field for concurrency (AIP-154) and a request_id for safe retries (AIP-155); its major version in the path (AIP-185) is weighed in the API evolution pack. Conformance: {{LINT}}. No Spectral ruleset for AIPs on OpenAPI is published (Google\'s api-linter checks protocol buffers only), so where Spectral lints, the team writes the rules in api/style/ruleset.yaml, each linked to its AIP, starting with the resource names, the standard methods and the field names. Contract: {{DESIGN}}. Deviations: {{EXCEPTIONS}}. API owners ({{API_OWNERS}}) approve every contract change. The OpenAPI extensions of our own are named in this decision and nowhere else: info.x-api-guide (the guide and its revision), x-api-style-exceptions (a recorded deviation, where deviations are allowed) and x-retry-safe (an operation a client must not retry, when the Idempotency and concurrency pack decides so); a pack or team that needs another x- name adds it here first.',
      consequences: '• The most thorough guidance on resource design of the three, with a reason given for each rule.\n• The AIPs are written for protocol buffers and gRPC; applying them to a hand-written OpenAPI document means translating each rule through AIP-127.\n• Every lint rule is ours to write and keep, so coverage starts small and grows.\n• Callers who know Google Cloud APIs find what they expect; others meet custom methods such as POST /orders/123:cancel, which some HTTP tooling handles badly.',
      alternatives: '1. The Zalando RESTful API Guidelines: written for REST over HTTP and with a ruleset to extend.\n2. The Microsoft Azure REST API Guidelines: camelCase like the AIPs, written for HTTP, ruleset archived.\n3. Our own guide derived from the AIPs: keeps their resource model and drops what does not fit HTTP.',
    },
    {
      id: 'adr-guide-own', label: 'APIs follow our own guide', when: { GUIDE: ['own'] },
      decision: 'Every HTTP/JSON API of the element follows our own guide, api/style/guide.md, kept in the repository. Its first lines name the published guide it derives from (the Zalando RESTful API Guidelines, the Microsoft Azure REST API Guidelines or Google\'s AIPs) and the revision taken; each rule is numbered (R1, R2, …), marked MUST or SHOULD, says where it differs from the base and why, and is followed by a line naming the lint rule that checks it or "review". The answers it gives on resource design, errors, collections and idempotency are the ones the other API Guidelines packs record. Each document names the guide in info.x-api-guide. Conformance: {{LINT}}. Where Spectral lints, api/style/ruleset.yaml extends the base guide\'s ruleset where one exists (a vendored copy of the Azure ruleset, or @baloise/spectral-rules for Zalando, at an exact version) and adds a rule for each checkable rule of ours. Contract: {{DESIGN}}. Deviations: {{EXCEPTIONS}}. The guide and the ruleset change only in pull requests the API owners ({{API_OWNERS}}) approve. The OpenAPI extensions of our own are named in this decision and nowhere else: info.x-api-guide (the guide and its revision), x-api-style-exceptions (a recorded deviation, where deviations are allowed) and x-retry-safe (an operation a client must not retry, when the Idempotency and concurrency pack decides so); a pack or team that needs another x- name adds it here first.',
      consequences: '• The rules fit the organisation, and each says where it came from.\n• We keep the guide: every change to the base guide is ours to read and adopt or not.\n• New team members learn a guide they cannot find on the web; the guide and its checks must be good enough to learn from.\n• Without discipline the guide grows into a list of everybody\'s preferences; each rule needs an owner\'s approval and a check.',
      alternatives: '1. A published guide as it is: no upkeep, and callers may know it already, but its misfits become exceptions.\n2. No written guide, only the ruleset: rules without reasons, argued about at every finding.',
    },
    {
      id: 'adr-design-first', label: 'The contract is written before the code', when: { DESIGN: ['design'] },
      decision: 'The OpenAPI 3.1 document under api/ is written before the code. A new or changed operation or schema is proposed in a pull request that changes only the documents under api/, reviewed against {{GUIDE}} by {{API_OWNERS}}, merged, and only then implemented in a pull request of its own. Callers can build against a mock served from the merged document (Prism) while the code is written. The server serves exactly what the documents describe: a test compares the router\'s table with them, and a described operation not built yet answers 501 Not Implemented.',
      consequences: '• The contract is agreed before anyone builds against it, and callers can start at once.\n• Two pull requests for each new operation, and the second may find the first was wrong, which means a third.\n• The router and the document are kept in step by a test, not by generation; the test must list routes from the router itself.',
      alternatives: '1. The document generated from the code: no drift and one pull request, but the contract is reviewed only after it is built.\n2. Contract and code in one pull request: faster, but the contract is read as a by-product of the code.',
    },
    {
      id: 'adr-code-first', label: 'The contract is generated from the code', when: { DESIGN: ['code'] },
      decision: 'The OpenAPI documents are generated from the code (springdoc-openapi on Spring, app.openapi() in FastAPI, @nestjs/swagger, tsoa), written to api/ by npm run openapi:generate or the build\'s equivalent, and committed. Every pull request regenerates them and fails when the committed copy differs, so each contract change is a diff reviewed beside the code that made it, by {{API_OWNERS}} against {{GUIDE}}. The linter and the callers read the committed documents.',
      consequences: '• The document cannot drift from the code, and a change needs one pull request.\n• The contract is reviewed after it is built; a design the reviewers reject costs the implementation too.\n• What the document can say is limited by the generator\'s annotations; some rules of the guide (descriptions, examples, extensions) need annotations of their own.',
      alternatives: '1. The document written first and merged before the code: agreed earlier, at the cost of two pull requests and a route test.\n2. Generating the document at runtime only, without committing it: no diff to review and nothing for the linter to read before release.',
    },
  ],
  fitness: [
    {
      id: 'ff-guide-declared', label: 'Contracts name their guide', category: 'structural', implements: GUIDES, checks: ['req-guide-declared'],
      threshold: 'Every document under api/ has info.x-api-guide with a name, an https URL and a revision; 1 distinct guide across all documents',
      description: 'A test reads every OpenAPI document under api/ and checks info.x-api-guide, then that all documents name the same guide.',
      tool: 'Vitest with the yaml package (or the test runner of your stack)',
      language: 'ts',
      snippet: `// test/api/guide.test.ts
import { readdirSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

const docs = readdirSync('api').filter((f) => f.endsWith('.yaml'))
const guideOf = (file: string) => parse(readFileSync(\`api/\${file}\`, 'utf8')).info?.['x-api-guide']

describe.each(docs)('%s', (file) => {
  it('names the guide it follows, at a revision', () => {
    const guide = guideOf(file)
    expect(guide, 'info.x-api-guide is missing').toBeTruthy()
    expect(String(guide.name ?? '')).not.toBe('')
    expect(guide.url).toMatch(/^https:\\/\\//)
    expect(String(guide.revision ?? '')).not.toBe('')
  })
})

it('names the same guide in every document', () => {
  expect(new Set(docs.map((f) => guideOf(f)?.url)).size).toBeLessThanOrEqual(1)
})`,
    },
    {
      id: 'ff-spectral-ci', label: 'Spectral lints every contract change', when: SPECTRAL, category: 'process', implements: GUIDES, checks: ['req-lint'],
      threshold: '0 Spectral findings of severity error in the documents under api/ for the pull request to merge; warnings annotated, not blocking',
      description: 'A workflow runs on every pull request that touches api/ or the ruleset, lints all documents with the ruleset in .spectral.yaml and fails at severity error; the github-actions format puts each finding on its line in the pull request. The job is listed among the checks the main branch requires, in the ruleset the Code review and branching pack keeps.',
      tool: 'Spectral CLI (@stoplight/spectral-cli) in GitHub Actions',
      language: 'yaml',
      snippet: `# .github/workflows/api-style.yml
name: api-style
on:
  pull_request:
    paths: ['api/**', '.spectral.yaml', 'package-lock.json']
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
      - uses: actions/setup-node@v4.1.0   # pin by commit SHA in your repository
        with:
          node-version: 22
          cache: npm
      - run: npm ci   # @stoplight/spectral-cli and the guide's ruleset package, at exact versions
      - run: node api/style/check-ruleset.mjs
      - run: npx spectral lint "api/*.yaml" --ruleset .spectral.yaml --fail-severity error --format github-actions`,
    },
    {
      id: 'ff-ruleset', label: 'Ruleset pinned and every rule sourced', when: SPECTRAL, category: 'structural', implements: GUIDES, checks: ['req-ruleset-pinned', 'req-rule-sources'],
      threshold: '0 extends entries that are URLs or packages without an exact version; 0 rules defined in api/style/ruleset.yaml without an https documentationUrl or with a severity other than error or warn',
      description: 'A script run in the API style job reads api/style/ruleset.yaml: every extends entry must be a local file, a Spectral built-in or a package installed at an exact version in package.json, and every rule the file defines (not a mere severity change of an extended rule) must link to its guideline and carry error or warn.',
      tool: 'Node.js with the yaml package',
      language: 'js',
      snippet: `// api/style/check-ruleset.mjs
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const ruleset = parse(readFileSync('api/style/ruleset.yaml', 'utf8'))
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const versions = { ...pkg.dependencies, ...pkg.devDependencies }
const problems = []
for (const entry of [ruleset.extends ?? []].flat()) {
  const ref = Array.isArray(entry) ? entry[0] : entry               // [ruleset, 'recommended' | 'all' | 'off']
  if (/^https?:/.test(ref)) { problems.push(\`extends \${ref}: a URL changes under you; vendor it or install it at an exact version\`); continue }
  if (ref.startsWith('spectral:') || (ref.startsWith('.') && !ref.includes('node_modules/'))) continue
  const name = /^(?:.*node_modules\\/)?((?:@[^/]+\\/)?[^/]+)/.exec(ref)[1]
  if (!/^\\d+\\.\\d+\\.\\d+$/.test(versions[name] ?? '')) problems.push(\`\${name} is not installed at an exact version\`)
}
for (const [name, rule] of Object.entries(ruleset.rules ?? {})) {
  if (typeof rule !== 'object' || rule === null) continue               // a severity change of an extended rule
  if (!/^https:\\/\\//.test(rule.documentationUrl ?? '')) problems.push(\`\${name}: no documentationUrl to the guideline it enforces\`)
  if (!['error', 'warn'].includes(rule.severity)) problems.push(\`\${name}: severity is error (MUST) or warn (SHOULD)\`)
}
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-codeowners', label: 'API owners own the contracts', category: 'process', implements: GUIDES, checks: ['req-owners-review'],
      threshold: 'CODEOWNERS assigns /api/ to {{API_OWNERS}}, and the rules of the main branch require a code owner\'s review',
      description: 'A CI step checks that .github/CODEOWNERS gives /api/ (the documents and the style ruleset) to the API owners, and asks GitHub whether the rules that apply to main require a code owner\'s review, so the approval cannot be skipped. The branch ruleset itself is kept by the Code review and branching pack; this check only reads it. The step needs a token that can read the repository\'s rules (GH_TOKEN).',
      tool: 'bash with the GitHub CLI (REST: GET /repos/{owner}/{repo}/rules/branches/{branch})',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# the API owners own api/, and main requires their approval
set -euo pipefail
grep -Eq '^/api/[[:space:]].*{{API_OWNERS}}' .github/CODEOWNERS \\
  || { echo "CODEOWNERS: /api/ is not owned by {{API_OWNERS}}"; exit 1; }
required=$(gh api "repos/$GITHUB_REPOSITORY/rules/branches/main" \\
  --jq '[.[] | select(.type == "pull_request") | .parameters.require_code_owner_review] | any')
[ "$required" = true ] || { echo "main does not require a code owner's review"; exit 1; }`,
    },
    {
      id: 'ff-review-checklist', label: 'Style checklist ticked', when: { LINT: ['review'] }, category: 'process', implements: GUIDES, checks: ['req-review-checklist'],
      threshold: '0 unticked items in the "API style checklist" section of a pull request that changes api/; a missing section fails too',
      description: 'The pull-request template (.github/pull_request_template.md) carries a section "## API style checklist" with one item per MUST rule of the guide that a reviewer checks. A workflow on pull requests that touch api/ reads the description and fails while the section is missing or has an unticked item; it reruns when the description is edited.',
      tool: 'GitHub Actions (bash over the pull request\'s body)',
      language: 'yaml',
      snippet: `# .github/workflows/api-review.yml
name: api-review
on:
  pull_request:
    types: [opened, edited, synchronize, reopened]
    paths: ['api/**']
jobs:
  checklist:
    runs-on: ubuntu-latest
    steps:
      - name: Every item of the API style checklist is ticked
        env:
          BODY: \${{ github.event.pull_request.body }}
        run: |
          section=$(printf '%s\\n' "$BODY" | tr -d '\\r' | sed -n '/^## API style checklist/,/^## /p')
          [ -n "$section" ] || { echo "no 'API style checklist' section (see .github/pull_request_template.md)"; exit 1; }
          if printf '%s\\n' "$section" | grep -q '^- \\[ \\]'; then echo "unticked items in the API style checklist"; exit 1; fi`,
    },
    {
      id: 'ff-design-first-pr', label: 'Contract changes come alone', when: { DESIGN: ['design'] }, category: 'process', implements: ['adr-design-first'], checks: ['req-design-first'],
      threshold: '0 pull requests that change a document under api/ and a file under src/ together',
      description: 'A CI step on every pull request lists the files changed against the base branch and fails when both a contract document and implementation code are among them.',
      tool: 'bash and git in the CI job (checkout with fetch-depth: 0)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# a contract change is merged on its own, before the code that serves it
set -euo pipefail
changed=$(git diff --name-only "origin/\${GITHUB_BASE_REF:-main}...HEAD")
if printf '%s\\n' "$changed" | grep -q '^api/[^/]*\\.yaml$' && printf '%s\\n' "$changed" | grep -q '^src/'; then
  echo "this pull request changes the contract under api/ and the code under src/ together;"
  echo "merge the contract change first, then implement it"
  exit 1
fi`,
    },
    {
      id: 'ff-routes-match', label: 'Server serves the contract', when: { DESIGN: ['design'] }, category: 'structural', implements: ['adr-design-first'], checks: ['req-design-routes'],
      threshold: '0 routes in the router\'s table that the documents do not describe; every described operation not in the table answers 501',
      description: 'A test lists the operations of every document under api/ and the routes from the router itself (not from a list kept by hand), fails on a route the documents do not describe, and calls each described operation the router does not serve, expecting 501 from the fallback handler.',
      tool: 'Vitest with supertest and the yaml package (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `// test/api/routes.test.ts
import { readdirSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'
import request from 'supertest'
import { expect, it } from 'vitest'
import { app, routes } from '../../src/app'   // routes: the router's table, [{ method, path }]

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace']
const described = readdirSync('api').filter((f) => f.endsWith('.yaml')).flatMap((file) => {
  const { paths = {} } = parse(readFileSync(\`api/\${file}\`, 'utf8'))
  return Object.entries(paths as Record<string, object>).flatMap(([path, item]) =>
    Object.keys(item).filter((k) => METHODS.includes(k)).map((m) => \`\${m.toUpperCase()} \${path}\`))
})
const served = routes.map((r) => \`\${r.method.toUpperCase()} \${r.path.replace(/:(\\w+)/g, '{$1}')}\`)

it('serves no route the contract does not describe', () => {
  expect(served.filter((r) => !described.includes(r))).toEqual([])
})

it('answers 501 for each described operation not built yet', async () => {
  for (const op of described.filter((d) => !served.includes(d))) {
    const [method, path] = op.split(' ')
    expect((await request(app)[method.toLowerCase() as 'get'](path.replace(/\\{\\w+\\}/g, 'x'))).status, op).toBe(501)
  }
})`,
    },
    {
      id: 'ff-generated-matches', label: 'Committed contract is what the code makes', when: { DESIGN: ['code'] }, category: 'process', implements: ['adr-code-first'], checks: ['req-code-first'],
      threshold: '0 differences, new files included, under api/ after regenerating the documents from the code',
      description: 'A workflow on every pull request regenerates the OpenAPI documents from the code and fails when anything under api/ changed or appeared, so a contract change that was not committed cannot merge.',
      tool: 'GitHub Actions with the project\'s generator (npm run openapi:generate over @nestjs/swagger or tsoa; on Spring, springdoc-openapi-maven-plugin in ./mvnw verify)',
      language: 'yaml',
      snippet: `# .github/workflows/api-generated.yml
name: api-generated
on: [pull_request]
jobs:
  contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
      - uses: actions/setup-node@v4.1.0   # pin by commit SHA in your repository
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run openapi:generate   # writes api/*.yaml from the code
      - name: The committed contract is what the code produces
        run: |
          git status --porcelain -- api/
          test -z "$(git status --porcelain -- api/)" || { echo "run npm run openapi:generate and commit api/"; exit 1; }`,
    },
    {
      id: 'ff-exceptions', label: 'Exceptions complete and current', when: { EXCEPTIONS: ['inline'] }, category: 'structural', implements: GUIDES, checks: ['req-exception-recorded', 'req-exception-expiry'],
      threshold: '0 exceptions without a rule, a reason, an approver and dates; 0 expired; 0 standing more than {{EXCEPTION_MONTHS}} months from approval; 0 differences between the committed .spectral.yaml and the one the exceptions produce',
      description: 'A script run in CI walks every document under api/ for x-api-style-exceptions entries, checks each, and writes .spectral.yaml: the style ruleset plus one Spectral override per exception, turning its rule off at that JSON pointer only. CI runs it and then git diff --exit-code .spectral.yaml, so an override added by hand, without its entry, fails. With review only, the overrides are written but nothing lints with them.',
      tool: 'Node.js with the yaml package; Spectral overrides',
      language: 'js',
      snippet: `// api/style/exceptions.mjs — entries: { rule, reason, approvedBy, approved: 2026-10-01, until: 2027-04-01 }
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parse, stringify } from 'yaml'

const MAX_MONTHS = {{EXCEPTION_MONTHS}}
const KEY = 'x-api-style-exceptions'
const pointer = (parts) => '#/' + parts.map((p) => encodeURIComponent(String(p).replaceAll('~', '~0').replaceAll('/', '~1'))).join('/')
const problems = []
const overrides = []
function walk(node, parts, file) {
  if (!node || typeof node !== 'object') return
  for (const e of node[KEY] ?? []) {
    const where = file + pointer(parts)
    if (!e.rule || !e.reason || !e.approvedBy) problems.push(\`\${where}: an exception names its rule, reason and approver\`)
    const limit = new Date(e.approved)
    limit.setMonth(limit.getMonth() + MAX_MONTHS)
    if (!(Date.parse(e.until) <= limit.getTime())) problems.push(\`\${where}: \${e.rule} stands past \${MAX_MONTHS} months from its approval\`)
    if (!(Date.parse(e.until) >= Date.now())) problems.push(\`\${where}: \${e.rule} expired on \${e.until}\`)
    overrides.push({ files: [where], rules: { [e.rule]: 'off' } })
  }
  for (const [k, v] of Object.entries(node)) if (k !== KEY) walk(v, [...parts, k], file)
}
for (const f of readdirSync('api').filter((n) => n.endsWith('.yaml'))) walk(parse(readFileSync(\`api/\${f}\`, 'utf8')), [], \`api/\${f}\`)
writeFileSync('.spectral.yaml', stringify({ extends: ['./api/style/ruleset.yaml'], ...(overrides.length ? { overrides } : {}) }))
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-no-exceptions', label: 'No rule turned off for one API', when: { EXCEPTIONS: ['none'] }, category: 'structural', implements: GUIDES, checks: ['req-no-exceptions'],
      threshold: '0 x-api-style-exceptions or x-zally-ignore keys under api/; 0 overrides sections in .spectral.yaml or api/style/*.yaml',
      description: 'A CI step searches the documents for inline exceptions and the ruleset files for Spectral overrides, and fails on any; turning a rule off for every API in api/style/ruleset.yaml stays allowed, through a pull request the API owners approve.',
      tool: 'bash and grep in the CI job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# no rule is turned off for one part of one API
set -euo pipefail
inline=$(grep -rnE '"?(x-api-style-exceptions|x-zally-ignore)"?[[:space:]]*:' api/ || true)
overrides=$(grep -lE '^overrides:' .spectral.yaml api/style/*.yaml 2>/dev/null || true)
if [ -n "$inline$overrides" ]; then
  printf '%s\\n' "$inline" "$overrides" | sed '/^$/d'
  echo "exceptions are not allowed: change or remove the rule in api/style/ruleset.yaml for every API"
  exit 1
fi`,
    },
    {
      id: 'ff-own-guide', label: 'Our guide says how each rule is checked', when: { GUIDE: ['own'] }, category: 'structural', implements: ['adr-guide-own'], checks: ['req-own-guide'],
      threshold: 'api/style/guide.md names its base guide with an https link and a revision; every "### R<n> MUST|SHOULD" rule is followed by a "Checked by:" line; 0 lint rules named that the ruleset does not define',
      description: 'A test parses api/style/guide.md: the "Derived from:" line, each numbered rule with its "Checked by: review" or "Checked by: spectral `rule-name`" line, and the rule names, which must be defined in api/style/ruleset.yaml or in a local ruleset it extends. With review only, every rule says review and the ruleset may be absent.',
      tool: 'Vitest with the yaml package',
      language: 'ts',
      snippet: `// test/api/own-guide.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parse } from 'yaml'
import { expect, it } from 'vitest'

const guide = readFileSync('api/style/guide.md', 'utf8')
const rulesIn = (file: string): string[] => {
  if (!existsSync(file)) return []
  const r = parse(readFileSync(file, 'utf8')) ?? {}
  const local = [r.extends ?? []].flat().map((e) => (Array.isArray(e) ? e[0] : e)).filter((e) => e.startsWith('.'))
  return [...Object.keys(r.rules ?? {}), ...local.flatMap((e) => rulesIn(join(dirname(file), e)))]
}
const lintRules = rulesIn('api/style/ruleset.yaml')

it('names the published guide it derives from, at a revision', () => {
  expect(guide).toMatch(/^Derived from: \\[.+\\]\\(https:\\/\\/[^)]+\\) at revision \\S+/m)
})

it('says for every rule how it is checked', () => {
  const headings = guide.match(/^### R\\d+ (MUST|SHOULD) /gm) ?? []
  const rules = [...guide.matchAll(/^### R\\d+ (?:MUST|SHOULD) .+\\n+Checked by: (?:review|spectral \`([\\w-]+)\`)$/gm)]
  expect(rules.length, 'a "Checked by:" line after every rule').toBe(headings.length)
  expect(rules.map((r) => r[1]).filter((name) => name && !lintRules.includes(name))).toEqual([])
})`,
    },
  ],
}

export default pack
