import type { PackSpec, When } from '../../src/packSpec'

const VERSIONED: When = { VERSIONING: ['path', 'header'] }
const ADRS = ['adr-version-path', 'adr-version-header', 'adr-versionless']
const FORCES = 'Other systems call this element through its API, and they are built and released by other people on their own schedule. The forces: a renamed field, a new required input, a narrowed type or a changed error code breaks a caller that cannot change on the same day; without a machine-readable contract nobody can tell which change breaks what, so breaks are found in production; every version kept alive costs code, tests and attention; callers have to hear that something is going away early enough to move, and with a date they can plan for; and the contract callers read must be what the API really serves. Snippets assume one contract document per served version under api/ (api/v1.yaml, api/v2.yaml; schema.graphql for GraphQL; .proto files under api/ for Protocol Buffers), the router\'s table in src/app and the released contract reachable at $API_URL.'

const pack: PackSpec = {
  id: 'concern-api-evolution',
  name: 'API evolution',
  group: 'api',
  description: 'An API that systems outside yours call: how its contract is written, how it may change without breaking its callers, how versions are named, and how long an old one lives. Contracts between your own parts are decided in the Communication style pack.',
  tags: ['api', 'versioning', 'compatibility', 'contracts', 'deprecation', 'contract-testing'],
  concern: {
    id: 'api-evolution',
    trigger: 'LIST RELATIONS WHERE source.external = true AND target.external != true AND (target.type = "system" OR target.type = "container" OR target.type = "webapp" OR target.type = "component")',
    applyTo: 'target',
    why: 'systems outside yours call these elements, so how their API may change without breaking them has to be decided.',
  },
  sources: [
    { title: 'OpenAPI Specification (latest)', url: 'https://spec.openapis.org/oas/latest.html' },
    { title: 'GraphQL Specification (October 2021), @deprecated', url: 'https://spec.graphql.org/October2021/#sec--deprecated' },
    { title: 'RFC 8594, The Sunset HTTP Header Field', url: 'https://www.rfc-editor.org/rfc/rfc8594' },
    { title: 'RFC 9745, The Deprecation HTTP Response Header Field', url: 'https://www.rfc-editor.org/rfc/rfc9745' },
    { title: 'Google AIP-180, Backwards compatibility', url: 'https://google.aip.dev/180' },
    { title: 'Google AIP-185, API Versioning', url: 'https://google.aip.dev/185' },
    { title: 'Microsoft REST API Guidelines', url: 'https://github.com/microsoft/api-guidelines' },
    { title: 'microservices.io, Service Integration Contract Test', url: 'https://microservices.io/patterns/testing/service-integration-contract-test.html' },
    { title: 'Pact documentation', url: 'https://docs.pact.io/' },
  ],
  questions: [
    {
      key: 'FORMAT', title: 'Contract', label: 'How is the API described?',
      hint: 'A machine-readable contract is what callers generate clients from and what every change is checked against for breaks.',
      default: 'openapi',
      options: [
        { value: 'openapi', label: 'OpenAPI 3.1', description: 'REST over HTTP, described in an OpenAPI document; breaking changes are found with oasdiff. Pick it for resource-style HTTP APIs and for public or partner APIs, where callers expect plain HTTP and JSON.' },
        { value: 'graphql', label: 'a GraphQL schema', description: 'One endpoint where callers choose the fields they read; it evolves by adding fields and marking old ones @deprecated, checked with graphql-inspector. Pick it when many clients need different shapes of the same data, usually front ends; it goes with no versions, deprecation field by field.' },
        { value: 'protobuf', label: 'Protocol Buffers (gRPC)', description: 'Binary contracts in .proto files whose field numbers are never reused, checked with buf breaking. Pick it for service-to-service calls with high volume or streaming, where both sides use generated code.' },
      ],
    },
    {
      key: 'VERSIONING', title: 'Versions', label: 'How does a caller name the version it wants?',
      hint: 'Released versions only ever add; this decides where a breaking change goes: a new version beside the old one, or a deprecation of the old element in the only version.',
      default: 'path',
      options: [
        { value: 'path', label: 'a major version in the path', description: '/v1/, /v2/ in the URL; for Protocol Buffers the package suffix .v1 (AIP-185). Pick it for public and partner REST or gRPC APIs: the version shows in every log line and is easy to route and to cache. Unusual with a GraphQL schema, which has one endpoint: pick no versions there.' },
        { value: 'header', label: 'a version header', description: 'Callers name the version in an Api-Version header (gRPC metadata api-version for Protocol Buffers), often a date as Stripe does. Pick it when URLs must stay the same across versions (stored links, hypermedia) or versions are frequent and small. Unusual with a GraphQL schema: pick no versions there.' },
        { value: 'none', label: 'no versions, deprecation field by field', description: 'There is only ever one version: an element is removed only after it has been deprecated for the sunset period and nobody uses it. Pick it for GraphQL, or for any API where you can see each caller\'s usage.' },
      ],
    },
    {
      key: 'CONTRACT_TESTS', title: 'Contract tests', label: 'How is it checked that the API keeps its promises?',
      hint: 'A contract diff finds a break in the document; a test against the running API finds a break in what it really serves.',
      default: 'pact',
      options: [
        { value: 'pact', label: 'consumer-driven contract tests (Pact)', description: 'Each caller records the interactions it relies on and publishes them to a Pact Broker; every build of the API verifies them all, and can-i-deploy blocks a release that would break one. Pick it when the callers are known teams who can run Pact in their builds.' },
        { value: 'conformance', label: 'conformance tests against the contract', description: 'Tests generated from the published contract (Schemathesis for OpenAPI and GraphQL; for gRPC, the server\'s reflection compared with the contract and every RPC probed) call the running API and fail on any answer the contract does not describe. Pick it when callers are unknown or outside (a public API, many partners) and cannot give you tests.' },
      ],
    },
  ],
  details: [
    { key: 'SUNSET_MONTHS', label: 'For how many months is a deprecated version or field still served?', default: '6', number: true },
    { key: 'USAGE_DAYS', label: 'For how many days must nobody use a deprecated element before it is removed?', default: '30', number: true },
  ],
  need: {
    label: 'Callers not broken',
    text: 'Other systems call this API, and they are released on their own schedule by people who do not see our code. A renamed field, a new required parameter, a narrower type or a changed error breaks them without warning; without a contract nobody can tell which change breaks what, and without notice and a date a caller cannot plan its move off an old version. The API also has to keep changing, so the rules must make safe changes cheap and unsafe ones visible.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-contract', label: 'Contract published', ears_type: 'ubiquitous',
      action: 'publish its interface as {{FORMAT}}, kept in the repository with the code, tagged with every release, and served at a stable URL that holds the document of the release deployed',
      rationale: 'The contract is what callers build against and what every change is checked against; a published copy that is not the deployed release\'s is worse than none (OpenAPI Specification; Google AIP-180).',
      scenario: { label: 'Published contract is the release\'s', given: 'a deployed release of the API', when: 'the contract is fetched from the stable URL and compared with the document at the release tag', then: 'the two are the same, operation by operation and field by field' },
    },
    {
      id: 'req-compat', label: 'Breaking changes versioned', when: VERSIONED, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request removes or renames a field, operation, enum value or error code, makes an optional input required, narrows a type, or changes what a field means',
      action: 'refuse it unless the change goes into a new version served beside the old one, so that 0 breaking changes reach a released version',
      rationale: 'Adding is safe; anything else breaks a caller that has not changed (Google AIP-180 lists the changes that break source, wire and semantic compatibility).',
      scenario: { label: 'Breaking change refused', given: 'a pull request that renames a response field of a released version', when: 'the contract check compares it with the last release', then: 'the check fails, and passes once the rename is in a new version' },
    },
    {
      id: 'req-path', label: 'Major version in path', when: { VERSIONING: ['path'] }, ears_type: 'ubiquitous',
      action: 'serve each major version under its own path prefix (/v1/, /v2/; the package suffix .v1 for Protocol Buffers), serve at most two major versions at once, and change a released major version only by adding',
      rationale: 'A version in the path is visible in every log and easy to route; two at a time bounds the cost of keeping old ones (Google AIP-185, Microsoft REST API Guidelines).',
      scenario: { label: 'Two versions side by side', given: 'major versions 1 and 2 served', when: 'a caller calls the same operation under /v1/ and /v2/, and the served prefixes are listed from the router', then: 'each answers in its own shape, and the list holds no more than two prefixes' },
    },
    {
      id: 'req-header', label: 'Version named per request', when: { VERSIONING: ['header'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request carries no Api-Version header, or names a version that is not served',
      action: 'answer 400 with the list of versions served',
      rationale: 'A caller that does not name a version gets whatever is newest and breaks on the next release; requiring it makes the dependency explicit (Microsoft REST API Guidelines require an explicit api-version).',
      scenario: { label: 'Missing version refused', given: 'versions 2025-01-01 and 2026-01-01 served', when: 'a request comes without Api-Version and one with 2024-01-01', then: 'both get 400 with a body that lists 2025-01-01 and 2026-01-01' },
    },
    {
      id: 'req-header-echo', label: 'Version echoed, two at most', when: { VERSIONING: ['header'] }, ears_type: 'ubiquitous',
      action: 'answer every request in the version its Api-Version header names, echo that version in the Api-Version response header, and serve at most two versions at once',
      rationale: 'The echo lets a caller and a log line prove which version answered; two at a time bounds the cost of keeping old ones (Microsoft REST API Guidelines).',
      scenario: { label: 'Version echoed', given: 'versions 2025-01-01 and 2026-01-01 served', when: 'a request names 2026-01-01, and the served versions are listed', then: 'the answer carries Api-Version: 2026-01-01 and the list holds no more than two versions' },
    },
    {
      id: 'req-versionless', label: 'Removal only after disuse', when: { VERSIONING: ['none'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request removes, renames or changes the meaning of an element of the contract',
      action: 'refuse it unless the element has been deprecated for at least {{SUNSET_MONTHS}} months and no caller has used it for {{USAGE_DAYS}} days',
      rationale: 'With a single version nothing may break in place; usage data is what makes a removal safe (GraphQL Specification, @deprecated; Google AIP-180).',
      scenario: { label: 'Used field kept', given: 'a field deprecated {{SUNSET_MONTHS}} months ago that one caller used yesterday', when: 'a pull request removes it', then: 'the check fails and names the caller; with {{USAGE_DAYS}} days without a call it passes' },
    },
    {
      id: 'req-sunset', label: 'Deprecation announced', when: { FORMAT: ['openapi'] }, ears_type: 'event-driven',
      trigger: 'a version or operation is deprecated',
      action: 'mark it deprecated: true with an x-sunset date at least {{SUNSET_MONTHS}} months away in the contract, add a Deprecation header (RFC 9745) and a Sunset header (RFC 8594) with that date to every answer that uses it, tell every known caller, and keep serving it until that date',
      rationale: 'Callers need notice they can read in code and a date they can plan for; the headers make both machine-readable (RFC 9745, RFC 8594).',
      scenario: { label: 'Deprecation carries a date', given: 'an operation deprecated today', when: 'a caller calls it', then: 'the answer carries Deprecation with today\'s date and Sunset at least {{SUNSET_MONTHS}} months later, equal to the contract\'s x-sunset, and the operation still works' },
    },
    {
      id: 'req-sunset-graphql', label: 'Deprecation announced per field', when: { FORMAT: ['graphql'] }, ears_type: 'event-driven',
      trigger: 'a field, argument or enum value is deprecated',
      action: 'mark it @deprecated with a reason that ends in "deprecated YYYY-MM-DD, sunset YYYY-MM-DD", the sunset at least {{SUNSET_MONTHS}} months after the deprecation, tell every known caller, and keep serving it until that date',
      rationale: 'One endpoint answers many fields at once, so a per-answer header cannot name a field; the reason in the schema is what every client and tool reads (GraphQL Specification, @deprecated).',
      scenario: { label: 'Field carries its dates', given: 'a field deprecated today', when: 'the schema is introspected', then: 'its deprecation reason ends in today\'s date and a sunset at least {{SUNSET_MONTHS}} months later, and the field still resolves' },
    },
    {
      id: 'req-sunset-protobuf', label: 'Deprecation announced per field', when: { FORMAT: ['protobuf'] }, ears_type: 'event-driven',
      trigger: 'a field, RPC or enum value is deprecated',
      action: 'mark it [deprecated = true] with a comment above it "Deprecated: YYYY-MM-DD, sunset: YYYY-MM-DD", the sunset at least {{SUNSET_MONTHS}} months after the deprecation, tell every known caller, keep serving it until that date, and reserve its number and name when it is removed',
      rationale: 'Generated code warns on a deprecated field, and the dates in the contract are what callers plan by; reserving keeps the number from ever meaning something else (Google AIP-180).',
      scenario: { label: 'Field carries its dates', given: 'a field deprecated today', when: 'the .proto files are checked', then: 'the field is marked deprecated with today\'s date and a sunset at least {{SUNSET_MONTHS}} months later' },
    },
    {
      id: 'req-usage', label: 'Usage of deprecated counted', ears_type: 'ubiquitous',
      action: 'count the calls to every deprecated version, operation and field per calling system and day, export the counts and each sunset date as metrics, and alert the API\'s owner when an element is called within 30 days of its sunset',
      rationale: 'Without usage per caller, a sunset date is a guess and the callers still on an old version are found by breaking them.',
      scenario: { label: 'Laggards identified', given: 'a deprecated operation called by two systems, its sunset 20 days away', when: 'the usage metrics are read', then: 'they list both systems with their call counts, and the owner is alerted' },
    },
    {
      id: 'req-pact', label: 'Caller contracts verified', when: { CONTRACT_TESTS: ['pact'] }, ears_type: 'event-driven',
      trigger: 'the API or one of its callers is built',
      action: 'verify every caller\'s published contract against the API, and block the deployment of either side while one verification fails',
      rationale: 'A caller\'s contract states what it really relies on, which a contract diff cannot know (microservices.io, Service Integration Contract Test; Pact documentation).',
      scenario: { label: 'Break caught before deploy', given: 'a caller whose contract reads the field "total"', when: 'a build of the API drops "total" and asks to deploy', then: 'the verification fails and the deployment is blocked' },
    },
    {
      id: 'req-conformance', label: 'Running API conforms', when: { CONTRACT_TESTS: ['conformance'], FORMAT: ['openapi', 'graphql'] }, ears_type: 'event-driven',
      trigger: 'the API is built',
      action: 'run tests generated from its contract against every operation of a running instance, and fail the build on any answer whose status code or body the contract does not describe',
      rationale: 'Callers you cannot ask for tests rely on the contract alone, so the contract must be true of the running API (OpenAPI Specification).',
      scenario: { label: 'Undocumented answer caught', given: 'an operation that answers 500 for an empty name, not described in the contract', when: 'the conformance tests run on the build', then: 'they fail and name the operation and the input' },
    },
    {
      id: 'req-conformance-grpc', label: 'Running server conforms', when: { CONTRACT_TESTS: ['conformance'], FORMAT: ['protobuf'] }, ears_type: 'event-driven',
      trigger: 'the API is built',
      action: 'compare the services a running instance reflects with the services of the contract, call every RPC with an empty request, and fail the build on a service missing or extra or on an RPC answering Unknown or Internal',
      rationale: 'Generated stubs make the shapes match; what they cannot show is a service left unregistered or an RPC that crashes on input the contract allows (Google AIP-180).',
      scenario: { label: 'Unregistered service caught', given: 'a service in the contract the server does not register', when: 'the conformance step runs on the build', then: 'it fails and names the service' },
    },
  ],
  adrs: [
    {
      id: 'adr-version-path', label: 'Additive changes, major version in the path', when: { VERSIONING: ['path'] },
      decision: 'The API is described in {{FORMAT}}, kept with the code, one contract document per served version. Released versions change only by adding; a breaking change goes into a new major version under its own path prefix (/v2/, or the package suffix .v2 for Protocol Buffers; for a GraphQL schema the endpoint /v2/graphql), served beside the previous one. At most two major versions are served at once. A deprecated version is marked in its contract with its sunset date, announced to callers (Deprecation and Sunset headers over HTTP) and served for {{SUNSET_MONTHS}} months; calls to it are counted per caller and alerted near the sunset. Every pull request diffs each version\'s document against the last release\'s (oasdiff for OpenAPI, graphql-inspector for GraphQL, buf breaking for Protocol Buffers) and fails on a break; a new version has nothing to diff against. Promises to callers are checked by {{CONTRACT_TESTS}}. Choosing what counts as breaking: Google AIP-180 (source, wire and semantic compatibility).',
      consequences: '• Callers upgrade when they choose, within {{SUNSET_MONTHS}} months of a deprecation.\n• Two major versions run side by side for a while: twice the routes, tests and documentation.\n• A breaking change costs a whole new major version, so teams batch them and design for adding.\n• Fields and field numbers are never reused for something else.',
      alternatives: '1. A version header: stable URLs, but the version is hidden from logs and caches.\n2. No versions, field-by-field deprecation: cheaper, but needs usage data for every caller.\n3. Releasing with the callers: only for callers inside our own release, which the Communication style pack decides.',
    },
    {
      id: 'adr-version-header', label: 'Additive changes, version named in a header', when: { VERSIONING: ['header'] },
      decision: 'The API is described in {{FORMAT}}, kept with the code, one contract document per served version (api/2026-01-01.yaml). Released versions change only by adding; a breaking change goes into a new version that callers ask for in the Api-Version header (gRPC metadata api-version for Protocol Buffers; for a GraphQL schema the same header on the one endpoint). A request without a served version is answered 400 with the versions served; the version served is echoed in the response. At most two versions are served at once, each translated from one implementation by a version layer at the edge (as Stripe does with dated versions). A deprecated version is marked in its contract with its sunset date, announced to callers (Deprecation and Sunset headers over HTTP) and served for {{SUNSET_MONTHS}} months; calls to it are counted per caller and alerted near the sunset. Every pull request diffs each version\'s document against the last release\'s and fails on a break; a new version has nothing to diff against. Promises to callers are checked by {{CONTRACT_TESTS}}.',
      consequences: '• URLs and links stay the same across versions.\n• Every caller must send the header; clients that do not are refused, which surfaces them early.\n• Caches and gateways must vary on Api-Version.\n• The version layer is code of its own that has to be tested per version.',
      alternatives: '1. A major version in the path: visible and easy to route, but URLs change with every major version.\n2. A query parameter (api-version, as Azure does): visible in logs, but easy to drop when links are copied.\n3. No versions, field-by-field deprecation.',
    },
    {
      id: 'adr-versionless', label: 'One version, deprecated field by field', when: { VERSIONING: ['none'] },
      decision: 'The API is described in {{FORMAT}}, kept with the code, and has a single version. It changes only by adding; an element to go is marked deprecated in the contract with its dates (@deprecated with the sunset in its reason in GraphQL, deprecated: true with x-sunset in OpenAPI, [deprecated = true] with a dated comment in Protocol Buffers), announced to callers (Deprecation and Sunset headers over HTTP), and is removed only after {{SUNSET_MONTHS}} months and {{USAGE_DAYS}} days without a call, as the usage counts per caller show. Every pull request is diffed against the last release\'s contract (oasdiff with its deprecation grace period, graphql-inspector with the usage rule, buf breaking with reserved numbers and names) and fails on a removal the dates and the usage data do not allow. Promises to callers are checked by {{CONTRACT_TESTS}}. Choose it over versions when the API is GraphQL or you can see every caller\'s usage; prefer versions for public APIs whose callers you cannot see.',
      consequences: '• Callers never migrate between versions; they only stop using what is deprecated.\n• Usage per caller and field has to be collected and kept, or nothing can ever be removed.\n• A change of meaning cannot be made in place: it needs a new field with a new name.',
      alternatives: '1. A major version in the path or a header: lets breaking changes happen in bulk, at the cost of running versions side by side.\n2. Releasing with the callers: only for callers inside our own release, which the Communication style pack decides.',
    },
  ],
  fitness: [
    {
      id: 'ff-oasdiff', label: 'OpenAPI break check', when: { FORMAT: ['openapi'] }, category: 'structural', implements: ADRS, checks: ['req-contract', 'req-compat', 'req-versionless'],
      threshold: '0 breaking changes (oasdiff level ERR) between each version\'s document at the last release tag and the pull request, a removal after its x-sunset date and {{SUNSET_MONTHS}} months of deprecation not counting; after a deployment, 0 differences between the stable URL and the release\'s document',
      description: 'In every pull request, oasdiff compares each contract document with the same document at the last release tag and fails on any change it rates as breaking (removed or renamed operations and fields, new required inputs, narrowed types, removed enum values); a deprecated operation must carry x-sunset at least {{SUNSET_MONTHS}} months away, and once that date has passed its removal is not breaking (whether anybody still calls it is checked by the usage alert). A new version is a new document with nothing to diff against. After each deployment the same tool compares the stable URL with the release\'s document.',
      tool: 'oasdiff',
      language: 'yaml',
      snippet: `# .github/workflows/api-contract.yml (job steps; actions/checkout@v4.2.2 with fetch-depth: 0 — pin by commit SHA in your repository)
- name: No breaking API changes outside a new version
  run: |
    last=$(git describe --tags --abbrev=0)
    for doc in api/*.yaml; do                               # one document per served version
      git show "$last:$doc" > /tmp/base.yaml 2>/dev/null || continue   # a new version: nothing to diff against
      docker run --rm -v /tmp:/base -v "$PWD":/rev tufin/oasdiff:stable \\
        breaking /base/base.yaml "/rev/$doc" --fail-on ERR \\
        --deprecation-days-stable $(( {{SUNSET_MONTHS}} * 30 ))      # x-sunset required this far away; removal after it is not breaking
    done
# after each deployment:
- name: The stable URL serves the release's contract
  run: |
    for doc in api/*.yaml; do
      docker run --rm -v "$PWD":/rev tufin/oasdiff:stable \\
        diff "/rev/$doc" "$API_URL/openapi/$(basename "$doc" .yaml).json" --fail-on-diff
    done`,
    },
    {
      id: 'ff-graphql-inspector', label: 'GraphQL break check', when: { FORMAT: ['graphql'] }, category: 'structural', implements: ADRS, checks: ['req-contract', 'req-compat', 'req-versionless'],
      threshold: '0 breaking changes between the schema at the last release tag and the pull request, the removal of a deprecated field unused for {{USAGE_DAYS}} days not counting; after a deployment, 0 differences between the served schema and the release\'s',
      description: 'In every pull request, graphql-inspector diffs the schema with the one at the last release tag and fails on a breaking change (a removed field or type, a changed argument, a nullable field made non-null on input). Removing a deprecated field is allowed when the usage module, asked per field, reports no call in the last {{USAGE_DAYS}} days (the dates in the reason are checked by the sunset test). After each deployment the served schema is introspected and must equal the release\'s.',
      tool: 'graphql-inspector',
      language: 'yaml',
      snippet: `# .github/workflows/api-contract.yml (job steps; actions/checkout@v4.2.2 with fetch-depth: 0 — pin by commit SHA in your repository)
- name: No breaking schema changes
  run: |
    git show "$(git describe --tags --abbrev=0)":schema.graphql > /tmp/base.graphql
    npx @graphql-inspector/cli diff /tmp/base.graphql schema.graphql \\
      --rule suppressRemovalOfDeprecatedField \\
      --rule considerUsage --onUsage ./usage.js
    # usage.js: export default (fields) => Promise<boolean[]>, true when the field had 0 calls in the last {{USAGE_DAYS}} days
# after each deployment:
- name: The endpoint serves the release's schema
  run: |
    npx @graphql-inspector/cli introspect "$API_URL/graphql" --write /tmp/served.graphql
    npx @graphql-inspector/cli diff schema.graphql /tmp/served.graphql | grep -q 'No changes detected'`,
    },
    {
      id: 'ff-buf', label: 'Protobuf break check', when: { FORMAT: ['protobuf'] }, category: 'structural', implements: ADRS, checks: ['req-contract', 'req-compat', 'req-versionless'],
      threshold: '0 breaking changes against the last release tag, a deleted field whose number and name are reserved not counting; 0 lint findings, PACKAGE_VERSION_SUFFIX included; after a deployment, the services the server reflects equal the contract\'s',
      description: 'buf lint requires a version suffix on every package, and buf breaking compares the .proto files with the last release tag, failing on a renumbered field, a changed type, a removed RPC, or a field deleted without reserving its number and name (which is how a field past its sunset goes). After each deployment the services the server reflects are compared with the services of the release\'s descriptors.',
      tool: 'buf breaking, grpcurl',
      language: 'yaml',
      snippet: `# buf.yaml
version: v2
lint:
  use: [STANDARD]          # includes PACKAGE_VERSION_SUFFIX: acme.orders.v1
breaking:
  use: [FILE, FIELD_NO_DELETE_UNLESS_NUMBER_RESERVED, FIELD_NO_DELETE_UNLESS_NAME_RESERVED]
  except: [FIELD_NO_DELETE]   # a field may go once its number and name are reserved
# CI step (checkout with fetch-depth: 0); with a version header, each version is its own module directory, diffed with subdir=:
#   buf lint && buf breaking --against ".git#tag=$(git describe --tags --abbrev=0)"
# after each deployment: the server reflects the services of the release
#   buf build -o /tmp/release.binpb
#   diff <(grpcurl -protoset /tmp/release.binpb list | sort) <(grpcurl -plaintext "$GRPC_ADDRESS" list | grep -v '^grpc\\.' | sort)`,
    },
    {
      id: 'ff-sunset', label: 'Deprecations carry a sunset', when: { FORMAT: ['openapi'] }, category: 'structural', implements: ADRS, checks: ['req-sunset'],
      threshold: 'Every operation marked deprecated in the contract carries x-sunset and answers with a Deprecation header and a Sunset date equal to it and at least {{SUNSET_MONTHS}} months after the deprecation; 0 without',
      description: 'A test reads the operations marked deprecated from the contract documents (not from a list kept by hand), calls each and checks the Deprecation (RFC 9745) and Sunset (RFC 8594) headers against the contract\'s x-sunset.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import { readFileSync, readdirSync } from 'node:fs'
import { parse } from 'yaml'
import request from 'supertest'
import { app } from '../src/app'

const SUNSET_MONTHS = {{SUNSET_MONTHS}}
type Op = { deprecated?: boolean; 'x-sunset'?: string; 'x-example'?: string }
const deprecated = readdirSync('api').filter((f) => f.endsWith('.yaml')).flatMap((file) => {
  const spec = parse(readFileSync(\`api/\${file}\`, 'utf8'))
  return Object.entries(spec.paths as Record<string, Record<string, Op>>).flatMap(([path, ops]) =>
    Object.entries(ops).filter(([, op]) => op.deprecated).map(([method, op]) => ({ method, path: op['x-example'] ?? path, sunset: op['x-sunset'] })))
})

describe.each(deprecated)('$method $path', ({ method, path, sunset }) => {
  it('announces its deprecation and a sunset far enough away', async () => {
    expect(sunset).toMatch(/^\\d{4}-\\d{2}-\\d{2}/)                      // x-sunset in the contract
    const res = await request(app)[method](path)
    expect(res.headers.deprecation).toMatch(/^@\\d+$/)                  // RFC 9745: @<epoch seconds>
    const from = new Date(Number(res.headers.deprecation.slice(1)) * 1000)
    from.setMonth(from.getMonth() + SUNSET_MONTHS)
    expect(Date.parse(res.headers.sunset)).toBe(Date.parse(sunset!))     // RFC 8594, the contract's date
    expect(Date.parse(res.headers.sunset)).toBeGreaterThanOrEqual(from.getTime())
  })
})`,
    },
    {
      id: 'ff-sunset-graphql', label: 'Deprecated fields carry their dates', when: { FORMAT: ['graphql'] }, category: 'structural', implements: ADRS, checks: ['req-sunset-graphql'],
      threshold: 'Every @deprecated field, argument and enum value has a reason ending in "deprecated YYYY-MM-DD, sunset YYYY-MM-DD" with the sunset at least {{SUNSET_MONTHS}} months after the deprecation; 0 without',
      description: 'A test builds the schema from schema.graphql, walks every type for deprecated fields, arguments and enum values, and checks the two dates in each reason.',
      tool: 'Vitest with the graphql package (or the test runner of your stack)',
      language: 'ts',
      snippet: `import { readFileSync } from 'node:fs'
import { buildSchema, isObjectType, isInputObjectType, isEnumType, isInterfaceType } from 'graphql'

const SUNSET_MONTHS = {{SUNSET_MONTHS}}
const DATES = /deprecated (\\d{4}-\\d{2}-\\d{2}), sunset (\\d{4}-\\d{2}-\\d{2})$/
const schema = buildSchema(readFileSync('schema.graphql', 'utf8'))
const deprecated: Array<{ where: string; reason: string | null | undefined }> = []
for (const type of Object.values(schema.getTypeMap())) {
  if (type.name.startsWith('__')) continue
  if (isEnumType(type)) for (const v of type.getValues()) if (v.deprecationReason != null) deprecated.push({ where: \`\${type.name}.\${v.name}\`, reason: v.deprecationReason })
  if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)) for (const f of Object.values(type.getFields())) {
    if (f.deprecationReason != null) deprecated.push({ where: \`\${type.name}.\${f.name}\`, reason: f.deprecationReason })
    if ('args' in f) for (const a of f.args) if (a.deprecationReason != null) deprecated.push({ where: \`\${type.name}.\${f.name}(\${a.name})\`, reason: a.deprecationReason })
  }
}

describe.each(deprecated)('$where', ({ reason }) => {
  it('names its deprecation and sunset dates, far enough apart', () => {
    const m = DATES.exec(reason ?? '')
    expect(m, 'reason ends in "deprecated YYYY-MM-DD, sunset YYYY-MM-DD"').not.toBeNull()
    const from = new Date(m![1])
    from.setMonth(from.getMonth() + SUNSET_MONTHS)
    expect(Date.parse(m![2])).toBeGreaterThanOrEqual(from.getTime())
  })
})`,
    },
    {
      id: 'ff-sunset-protobuf', label: 'Deprecated fields carry their dates', when: { FORMAT: ['protobuf'] }, category: 'structural', implements: ADRS, checks: ['req-sunset-protobuf'],
      threshold: 'Every [deprecated = true] field, RPC and enum value has a comment "Deprecated: YYYY-MM-DD, sunset: YYYY-MM-DD" on the line above with the sunset at least {{SUNSET_MONTHS}} months after the deprecation; 0 without',
      description: 'A CI step greps the .proto files for deprecated elements and checks the dated comment above each; reserving the number and name on removal is checked by buf breaking.',
      tool: 'grep and GNU date in the CI job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# every deprecated field, RPC or enum value: the line above reads "// Deprecated: 2026-01-01, sunset: 2026-07-01"
set -uo pipefail
fail=0
while IFS=: read -r file line _; do
  dates=$(sed -n "$((line - 1))p" "$file" | grep -Eo 'Deprecated: [0-9]{4}-[0-9]{2}-[0-9]{2}, sunset: [0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
  if [ -z "$dates" ]; then echo "$file:$line: deprecated without its dates"; fail=1; continue; fi
  from=$(date -d "$(echo "$dates" | cut -d' ' -f2 | tr -d ,)" +%s)
  to=$(date -d "$(echo "$dates" | cut -d' ' -f4)" +%s)
  if [ $(( (to - from) / 86400 )) -lt $(( {{SUNSET_MONTHS}} * 30 )) ]; then echo "$file:$line: sunset under {{SUNSET_MONTHS}} months after deprecation"; fail=1; fi
done < <(grep -rn 'deprecated = true' api/ --include='*.proto')
exit $fail`,
    },
    {
      id: 'ff-usage', label: 'Deprecated usage counted and alerted', category: 'operational', implements: ADRS, checks: ['req-usage'],
      threshold: 'The counter api_deprecated_calls_total{caller, operation} is scraped (an alert fires while it is absent); an alert names every caller that called an element whose sunset is under 30 days away in the last 7 days',
      description: 'The element exports api_deprecated_calls_total{caller, operation} and api_sunset_timestamp_seconds{operation} (from the dates in the contract); Prometheus rules alert when the counter is missing and when a deprecated element close to its sunset is still called.',
      tool: 'Prometheus alerting rules',
      language: 'yaml',
      snippet: `groups:
- name: api-deprecations
  rules:
  - alert: DeprecatedUsageNotCounted
    expr: absent(api_deprecated_calls_total)
    for: 1h
    labels: { severity: ticket }
    annotations: { summary: "the API exports no usage counter for deprecated elements" }
  - alert: SunsetNearWithCallers
    expr: |
      sum by (operation, caller) (increase(api_deprecated_calls_total[7d])) > 0
      and on (operation) (api_sunset_timestamp_seconds - time()) < 30 * 86400
    labels: { severity: ticket }
    annotations: { summary: "{{ $labels.caller }} still calls {{ $labels.operation }}, whose sunset is under 30 days away" }`,
    },
    {
      id: 'ff-two-paths', label: 'Two major versions at most', when: { VERSIONING: ['path'] }, category: 'structural', implements: ['adr-version-path'], checks: ['req-path'],
      threshold: 'The router serves at most 2 distinct major version prefixes; a third fails the test',
      description: 'A test lists the routes from the router (not from a list kept by hand), collects their /vN/ prefixes (for gRPC, the .vN package suffixes of the registered services) and fails when there are more than two.',
      tool: 'Vitest (or the test runner of your stack)',
      language: 'ts',
      snippet: `import { routes } from '../src/app'          // the router's table

it('serves at most two major versions', () => {
  const majors = new Set(routes.map((r) => /^\\/v(\\d+)\\//.exec(r.path)?.[1]).filter(Boolean))
  expect([...majors].length, \`major versions served: \${[...majors].join(', ')}\`).toBeLessThanOrEqual(2)
})`,
    },
    {
      id: 'ff-header-versions', label: 'Version header required and echoed', when: { VERSIONING: ['header'] }, category: 'structural', implements: ['adr-version-header'], checks: ['req-header', 'req-header-echo'],
      threshold: 'A request without Api-Version, and one naming an unserved version, get 400 with the served versions; a request naming a served version is answered with that version echoed; at most 2 versions are served',
      description: 'A test calls the API without the header, with an unknown version and with each served version, and checks the status, the list in the 400 body and the echoed header.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../src/app'

it('requires the version header, echoes it, and serves two versions at most', async () => {
  const missing = await request(app).get('/orders').expect(400)
  const served: string[] = missing.body.versions
  expect(served.length).toBeLessThanOrEqual(2)
  const unknown = await request(app).get('/orders').set('Api-Version', '2000-01-01').expect(400)
  expect(unknown.body.versions).toEqual(served)
  for (const v of served) {
    const res = await request(app).get('/orders').set('Api-Version', v).expect(200)
    expect(res.headers['api-version']).toBe(v)
  }
})`,
    },
    {
      id: 'ff-pact', label: 'Caller contracts verified', when: { CONTRACT_TESTS: ['pact'] }, category: 'process', implements: ADRS, checks: ['req-pact'],
      threshold: '100 % of the callers\' pacts for the main branch and every deployed version verify on each build; can-i-deploy answers yes before every deployment',
      description: 'Every build of the API fetches the pacts of its callers from the Pact Broker and replays them against the running API, publishing the result; the deployment step asks can-i-deploy and stops on no.',
      tool: 'Pact (pact-js Verifier, Pact Broker can-i-deploy)',
      language: 'ts',
      snippet: `import { Verifier } from '@pact-foundation/pact'

it('honours every caller\\'s pact', () =>
  new Verifier({
    provider: 'order-api',
    providerBaseUrl: 'http://localhost:8080',
    pactBrokerUrl: process.env.PACT_BROKER_BASE_URL,
    consumerVersionSelectors: [{ mainBranch: true }, { deployedOrReleased: true }],
    publishVerificationResult: true,
    providerVersion: process.env.GIT_SHA,
  }).verifyProvider())

// before deploying:
//   npx --package=@pact-foundation/pact-cli pact-broker can-i-deploy --pacticipant order-api --version "$GIT_SHA" --to-environment production`,
    },
    {
      id: 'ff-conformance', label: 'API conforms to contract', when: { CONTRACT_TESTS: ['conformance'], FORMAT: ['openapi', 'graphql'] }, category: 'structural', implements: ADRS, checks: ['req-conformance'],
      threshold: '0 answers whose status code, headers or body the contract does not describe, and 0 server errors, over every operation, on each build',
      description: 'On every build, Schemathesis generates calls for each operation of the published contract (OpenAPI or GraphQL), runs them against a running instance and fails on an answer the contract does not allow or on a server error.',
      tool: 'Schemathesis',
      language: 'bash',
      snippet: `# CI step, after the API is started
pip install 'schemathesis>=4'
st run "$API_URL/openapi.json" --checks all      # for a GraphQL schema: st run "$API_URL/graphql" --checks all`,
    },
    {
      id: 'ff-conformance-grpc', label: 'Server conforms to contract', when: { CONTRACT_TESTS: ['conformance'], FORMAT: ['protobuf'] }, category: 'structural', implements: ADRS, checks: ['req-conformance-grpc'],
      threshold: 'The services the running server reflects equal the services of the contract; 0 RPCs answer Unknown or Internal to an empty request',
      description: 'On every build, the services the server reflects are compared with those of the contract\'s descriptors, and every RPC is called with an empty request; a crash (Unknown, Internal) fails the build, an InvalidArgument does not.',
      tool: 'buf and grpcurl',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
buf build -o /tmp/contract.binpb
diff <(grpcurl -protoset /tmp/contract.binpb list | sort) <(grpcurl -plaintext "$GRPC_ADDRESS" list | grep -v '^grpc\\.' | sort)
fail=0
for svc in $(grpcurl -protoset /tmp/contract.binpb list); do
  for rpc in $(grpcurl -protoset /tmp/contract.binpb list "$svc"); do
    out=$(grpcurl -plaintext -d '{}' "$GRPC_ADDRESS" "$rpc" 2>&1 || true)
    if echo "$out" | grep -qE 'Code: (Unknown|Internal)'; then echo "$rpc crashes on an empty request"; fail=1; fi
  done
done
exit $fail`,
    },
  ],
}

export default pack
