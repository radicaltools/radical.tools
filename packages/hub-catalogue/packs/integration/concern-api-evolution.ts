import type { PackSpec, When } from '../../src/packSpec'

const ADDITIVE: When = { CHANGE: ['additive'] }
const VERSIONED: When = { CHANGE: ['additive'], VERSIONING: ['path', 'header'] }
const ADDITIVE_ADRS = ['adr-version-path', 'adr-version-header', 'adr-versionless']
const ALL_ADRS = [...ADDITIVE_ADRS, 'adr-instep']
const FORCES = 'Other systems call this element through its API, and they are built and released by other people on their own schedule. The forces: a renamed field, a new required input, a narrowed type or a changed error code breaks a caller that cannot change on the same day; without a machine-readable contract nobody can tell which change breaks what, so breaks are found in production; every version kept alive costs code, tests and attention; callers have to hear that something is going away early enough to move, and with a date they can plan for; and the contract callers read must be what the API really serves.'

const pack: PackSpec = {
  id: 'concern-api-evolution',
  name: 'API evolution',
  group: 'integration',
  description: 'An API other systems call: how its contract is written, how it may change without breaking its callers, how versions are named, and how long an old one lives.',
  tags: ['api', 'versioning', 'compatibility', 'contracts', 'deprecation', 'contract-testing'],
  concern: {
    id: 'api-evolution',
    trigger: 'LIST RELATIONS WHERE source.external = true AND target.external != true AND (target.type = "system" OR target.type = "container" OR target.type = "webapp" OR target.type = "component")',
    applyTo: 'target',
    why: 'other systems call these elements, so how their API may change without breaking them has to be decided.',
  },
  sources: [
    { title: 'OpenAPI Specification (latest)', url: 'https://spec.openapis.org/oas/latest.html' },
    { title: 'RFC 8594, The Sunset HTTP Header Field', url: 'https://www.rfc-editor.org/rfc/rfc8594' },
    { title: 'RFC 9745, The Deprecation HTTP Response Header Field', url: 'https://www.rfc-editor.org/rfc/rfc9745' },
    { title: 'Google AIP-180, Backwards compatibility', url: 'https://google.aip.dev/180' },
    { title: 'Google AIP-185, API Versioning', url: 'https://google.aip.dev/185' },
    { title: 'Microsoft REST API Guidelines', url: 'https://github.com/microsoft/api-guidelines' },
    { title: 'microservices.io, Service Integration Contract Test', url: 'https://microservices.io/patterns/testing/service-integration-contract-test.html' },
  ],
  questions: [
    {
      key: 'FORMAT', title: 'Contract', label: 'How is the API described?',
      hint: 'A machine-readable contract is what callers generate clients from and what every change is checked against for breaks.',
      default: 'openapi',
      options: [
        { value: 'openapi', label: 'OpenAPI 3.1', description: 'REST over HTTP, described in an OpenAPI document; breaking changes are found with oasdiff. Pick it for resource-style HTTP APIs and for public or partner APIs, where callers expect plain HTTP and JSON.' },
        { value: 'graphql', label: 'a GraphQL schema', description: 'One endpoint where callers choose the fields they read; it evolves by adding fields and marking old ones @deprecated, checked with graphql-inspector. Pick it when many clients need different shapes of the same data, usually front ends.' },
        { value: 'protobuf', label: 'Protocol Buffers (gRPC)', description: 'Binary contracts in .proto files whose field numbers are never reused, checked with buf breaking. Pick it for service-to-service calls with high volume or streaming, where both sides use generated code.' },
      ],
    },
    {
      key: 'CHANGE', title: 'Changes', label: 'How may the API change?',
      hint: 'A caller you do not release with cannot change on the day you do; this decides whether a breaking change is ever allowed in place.',
      default: 'additive',
      options: [
        { value: 'additive', label: 'additive only, breaks in a new version', description: 'Every release only adds; anything that would break a caller goes into a new version served beside the old one until its sunset. Pick it when any caller is released on its own schedule: partners, installed mobile apps, other teams\' services.' },
        { value: 'instep', label: 'in step with its callers', description: 'The API and every caller change in one release, so a breaking change is allowed. Pick it only when every caller is yours, built in the same repository or release train, and no old client stays installed (no mobile app, no partner).' },
      ],
    },
    {
      key: 'VERSIONING', title: 'Versions', label: 'How does a caller name the version it wants?',
      hint: 'Only matters when breaking changes go to a new version; with changes in step with the callers the answer is not used.',
      default: 'path',
      options: [
        { value: 'path', label: 'a major version in the path', description: '/v1/, /v2/ in the URL; for Protocol Buffers the package suffix .v1 (AIP-185). Pick it for public and partner REST or gRPC APIs: the version shows in every log line and is easy to route and to cache.' },
        { value: 'header', label: 'a version header', description: 'Callers name the version in an Api-Version header (gRPC metadata for Protocol Buffers), often a date as Stripe does. Pick it when URLs must stay the same across versions (stored links, hypermedia) or versions are frequent and small.' },
        { value: 'none', label: 'no versions, deprecation field by field', description: 'There is only ever one version: an element is removed only after it has been deprecated for the sunset period and nobody uses it. Pick it for GraphQL, or for any API where you can see each caller\'s usage.' },
      ],
    },
    {
      key: 'CONTRACT_TESTS', title: 'Contract tests', label: 'How is it checked that the API keeps its promises?',
      hint: 'A contract diff finds a break in the document; a test against the running API finds a break in what it really serves.',
      default: 'pact',
      options: [
        { value: 'pact', label: 'consumer-driven contract tests (Pact)', description: 'Each caller records the interactions it relies on and publishes them to a Pact Broker; every build of the API verifies them all, and can-i-deploy blocks a release that would break one. Pick it when the callers are known teams who can run Pact in their builds.' },
        { value: 'conformance', label: 'conformance tests against the contract', description: 'Tests generated from the published contract (Schemathesis) call every operation of the running API and fail on any answer the contract does not describe. Pick it when callers are unknown or outside (a public API, many partners) and cannot give you tests.' },
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
      action: 'publish its interface as {{FORMAT}}, kept in the repository with the code, released with every version and served at a stable URL, and fail the build when what it serves differs from that contract',
      rationale: 'The contract is what callers build against and what every change is checked against; a contract that drifts from the code is worse than none (OpenAPI Specification; Google AIP-180).',
      scenario: { label: 'Contract matches release', given: 'a released version of the API', when: 'its contract is fetched from the stable URL and compared with what the release serves', then: 'the two match, operation by operation and field by field' },
    },
    {
      id: 'req-compat', label: 'Breaking changes versioned', when: VERSIONED, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request removes or renames a field, operation, enum value or error code, makes an optional input required, narrows a type, or changes what a field means',
      action: 'refuse it unless the change goes into a new major version served beside the old one, so that 0 breaking changes reach a released version',
      rationale: 'Adding is safe; anything else breaks a caller that has not changed (Google AIP-180 lists the changes that break source, wire and semantic compatibility).',
      scenario: { label: 'Breaking change refused', given: 'a pull request that renames a response field of a released version', when: 'the contract check compares it with the last release', then: 'the check fails, and passes once the rename is in a new major version' },
    },
    {
      id: 'req-path', label: 'Major version in path', when: { CHANGE: ['additive'], VERSIONING: ['path'] }, ears_type: 'ubiquitous',
      action: 'serve each major version under its own path prefix (/v1/, /v2/; the package suffix .v1 for Protocol Buffers), serve at most two major versions at once, and change a released major version only by adding',
      rationale: 'A version in the path is visible in every log and easy to route; two at a time bounds the cost of keeping old ones (Google AIP-185, Microsoft REST API Guidelines).',
      scenario: { label: 'Two versions side by side', given: 'major versions 1 and 2 served', when: 'a caller calls the same operation under /v1/ and /v2/', then: 'each answers in its own shape, and releasing a third major version needs version 1 retired first' },
    },
    {
      id: 'req-header', label: 'Version named per request', when: { CHANGE: ['additive'], VERSIONING: ['header'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request carries no Api-Version header, or names a version that is not served',
      action: 'answer 400 with the list of versions served, and otherwise answer in the version named and echo it in the response, serving at most two major versions at once',
      rationale: 'A caller that does not name a version gets whatever is newest and breaks on the next release; requiring it makes the dependency explicit (Microsoft REST API Guidelines require an explicit api-version).',
      scenario: { label: 'Missing version refused', given: 'versions 2025-01-01 and 2026-01-01 served', when: 'a request comes without Api-Version, one with 2024-01-01 and one with 2026-01-01', then: 'the first two get 400 listing the served versions; the third is answered with Api-Version: 2026-01-01' },
    },
    {
      id: 'req-versionless', label: 'Removal only after disuse', when: { CHANGE: ['additive'], VERSIONING: ['none'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request removes, renames or changes the meaning of an element of the contract',
      action: 'refuse it unless the element has been deprecated for at least {{SUNSET_MONTHS}} months and no caller has used it for {{USAGE_DAYS}} days',
      rationale: 'With a single version nothing may break in place; usage data is what makes a removal safe (GraphQL specification, @deprecated; Google AIP-180).',
      scenario: { label: 'Used field kept', given: 'a field deprecated {{SUNSET_MONTHS}} months ago that one caller used yesterday', when: 'a pull request removes it', then: 'the check fails and names the caller; with {{USAGE_DAYS}} days without a call it passes' },
    },
    {
      id: 'req-sunset', label: 'Deprecation announced', when: ADDITIVE, ears_type: 'event-driven',
      trigger: 'a version, operation or field is deprecated',
      action: 'mark it deprecated in the contract, add a Deprecation header (RFC 9745) and a Sunset header (RFC 8594) with a date at least {{SUNSET_MONTHS}} months away to every answer that uses it, tell every known caller, and keep serving it until that date',
      rationale: 'Callers need notice they can read in code and a date they can plan for; the headers make both machine-readable (RFC 9745, RFC 8594).',
      scenario: { label: 'Deprecation carries a date', given: 'an operation deprecated today', when: 'a caller calls it', then: 'the answer carries Deprecation with today\'s date and Sunset at least {{SUNSET_MONTHS}} months later, and the operation still works' },
    },
    {
      id: 'req-usage', label: 'Usage of deprecated counted', when: ADDITIVE, ears_type: 'ubiquitous',
      action: 'count the calls to every deprecated version, operation and field per calling system and day, and keep the counts until the sunset date',
      rationale: 'Without usage per caller, a sunset date is a guess and the callers still on an old version are found by breaking them.',
      scenario: { label: 'Laggards identified', given: 'a deprecated operation called by two systems', when: 'the usage report for the last 7 days is read', then: 'it lists both systems with their daily call counts' },
    },
    {
      id: 'req-instep', label: 'Released with its callers', when: { CHANGE: ['instep'] }, ears_type: 'ubiquitous',
      action: 'release a change of its contract only in the same release as every caller that uses it, built and tested together in one pipeline',
      rationale: 'Breaking in place is only safe when no caller can be left behind; one pipeline makes that a fact rather than a promise.',
      scenario: { label: 'Callers built together', given: 'a pull request that renames a field of the contract', when: 'the pipeline runs', then: 'every caller of the field is built and tested against the change in the same pipeline, and the release ships them together' },
    },
    {
      id: 'req-pact', label: 'Caller contracts verified', when: { CONTRACT_TESTS: ['pact'] }, ears_type: 'event-driven',
      trigger: 'the API or one of its callers is built',
      action: 'verify every caller\'s published contract against the API, and block the deployment of either side while one verification fails',
      rationale: 'A caller\'s contract states what it really relies on, which a contract diff cannot know (microservices.io, Service Integration Contract Test; Pact).',
      scenario: { label: 'Break caught before deploy', given: 'a caller whose contract reads the field "total"', when: 'a build of the API drops "total" and asks to deploy', then: 'the verification fails and the deployment is blocked' },
    },
    {
      id: 'req-conformance', label: 'Running API conforms', when: { CONTRACT_TESTS: ['conformance'] }, ears_type: 'event-driven',
      trigger: 'the API is built',
      action: 'run tests generated from its contract against every operation of a running instance, and fail the build on any answer whose status code or body the contract does not describe',
      rationale: 'Callers you cannot ask for tests rely on the contract alone, so the contract must be true of the running API (OpenAPI Specification).',
      scenario: { label: 'Undocumented answer caught', given: 'an operation that answers 500 for an empty name, not described in the contract', when: 'the conformance tests run on the build', then: 'they fail and name the operation and the input' },
    },
  ],
  adrs: [
    {
      id: 'adr-version-path', label: 'Additive changes, major version in the path', when: { CHANGE: ['additive'], VERSIONING: ['path'] },
      decision: 'The API is described in {{FORMAT}}, kept with the code. Released versions change only by adding; a breaking change goes into a new major version under its own path prefix (/v2/, or the package suffix .v2 for Protocol Buffers), served beside the previous one. At most two major versions are served at once. A deprecated version answers with Deprecation and Sunset headers and is served for {{SUNSET_MONTHS}} months; calls to it are counted per caller. Every pull request is diffed against the contract of the last release (oasdiff for OpenAPI, graphql-inspector for GraphQL, buf breaking for Protocol Buffers) and fails on a break. Promises to callers are checked by {{CONTRACT_TESTS}}. Choosing what counts as breaking: Google AIP-180 (source, wire and semantic compatibility).',
      consequences: '• Callers upgrade when they choose, within {{SUNSET_MONTHS}} months of a deprecation.\n• Two major versions run side by side for a while: twice the routes, tests and documentation.\n• A breaking change costs a whole new major version, so teams batch them and design for adding.\n• Fields and field numbers are never reused for something else.',
      alternatives: '1. A version header: stable URLs, but the version is hidden from logs and caches.\n2. No versions, field-by-field deprecation: cheaper, but needs usage data for every caller.\n3. Releasing with the callers: simplest, only when every caller is ours.',
    },
    {
      id: 'adr-version-header', label: 'Additive changes, version named in a header', when: { CHANGE: ['additive'], VERSIONING: ['header'] },
      decision: 'The API is described in {{FORMAT}}, kept with the code. Released versions change only by adding; a breaking change goes into a new version that callers ask for in the Api-Version header (gRPC metadata of the same name for Protocol Buffers). A request without a served version is answered 400; the version served is echoed in the response. At most two major versions are served at once, each translated from one implementation by a version layer at the edge (as Stripe does with dated versions). A deprecated version answers with Deprecation and Sunset headers and is served for {{SUNSET_MONTHS}} months; calls to it are counted per caller. Every pull request is diffed against the last release\'s contract and fails on a break. Promises to callers are checked by {{CONTRACT_TESTS}}.',
      consequences: '• URLs and links stay the same across versions.\n• Every caller must send the header; clients that do not are refused, which surfaces them early.\n• Caches and gateways must vary on Api-Version.\n• The version layer is code of its own that has to be tested per version.',
      alternatives: '1. A major version in the path: visible and easy to route, but URLs change with every major version.\n2. A query parameter (api-version, as Azure does): visible in logs, but easy to drop when links are copied.\n3. No versions, field-by-field deprecation.',
    },
    {
      id: 'adr-versionless', label: 'One version, deprecated field by field', when: { CHANGE: ['additive'], VERSIONING: ['none'] },
      decision: 'The API is described in {{FORMAT}}, kept with the code, and has a single version. It changes only by adding; an element to go is marked deprecated in the contract (@deprecated in GraphQL, deprecated: true in OpenAPI, deprecated = true in Protocol Buffers) with Deprecation and Sunset headers, and is removed only after {{SUNSET_MONTHS}} months and {{USAGE_DAYS}} days without a call, as the usage counts per caller show. Every pull request is diffed against the last release\'s contract (oasdiff, graphql-inspector or buf breaking) and fails on a removal the usage data does not allow. Promises to callers are checked by {{CONTRACT_TESTS}}. Choose it over versions when the API is GraphQL or you can see every caller\'s usage; prefer versions for public APIs whose callers you cannot see.',
      consequences: '• Callers never migrate between versions; they only stop using what is deprecated.\n• Usage per caller and field has to be collected and kept, or nothing can ever be removed.\n• A change of meaning cannot be made in place: it needs a new field with a new name.',
      alternatives: '1. A major version in the path or a header: lets breaking changes happen in bulk, at the cost of running versions side by side.\n2. Releasing with the callers: only when every caller is ours.',
    },
    {
      id: 'adr-instep', label: 'API released in step with its callers', when: { CHANGE: ['instep'] },
      context: `${FORCES} Here every caller is ours, built in the same repository or release train, and no old client stays installed.`,
      decision: 'The API is described in {{FORMAT}}, kept with the code, and has no versions: a change of the contract, breaking or not, is released together with every caller that uses it. The callers depend on the contract inside the workspace, never on a published copy, so the build graph (Nx affected, Turborepo, Bazel) builds and tests each caller of a changed contract in the same pipeline. Promises to callers are checked by {{CONTRACT_TESTS}}. An outside caller (a partner, an installed mobile app, another team\'s release) needs this decision superseded by additive changes first.',
      consequences: '• No versions to keep, no sunset to wait for.\n• Every change of the contract rebuilds and retests all its callers; the pipeline is as slow as the slowest caller.\n• The first outside caller makes this decision wrong overnight; it has to be visible when one arrives.',
      alternatives: '1. Additive changes with a version in the path or a header: needed as soon as one caller is released on its own.\n2. A single version deprecated field by field: no lockstep releases, but usage tracking.',
    },
  ],
  fitness: [
    {
      id: 'ff-oasdiff', label: 'OpenAPI break check', when: { FORMAT: ['openapi'], CHANGE: ['additive'] }, category: 'structural', implements: ADDITIVE_ADRS,
      threshold: '0 breaking changes (oasdiff level ERR) between the last release\'s contract and the pull request, outside a new major version',
      description: 'In every pull request, oasdiff compares the OpenAPI document with the one of the last release tag and fails on any change it rates as breaking (removed or renamed operations and fields, new required inputs, narrowed types, removed enum values).',
      tool: 'oasdiff',
      language: 'yaml',
      snippet: `# .github/workflows/api-contract.yml (a job step)
- name: No breaking API changes
  run: |
    git fetch --tags
    git show "$(git describe --tags --abbrev=0)":api/openapi.yaml > /tmp/base.yaml
    docker run --rm -v /tmp:/base -v "$PWD":/rev tufin/oasdiff \\
      breaking /base/base.yaml /rev/api/openapi.yaml --fail-on ERR`,
    },
    {
      id: 'ff-graphql-inspector', label: 'GraphQL break check', when: { FORMAT: ['graphql'], CHANGE: ['additive'] }, category: 'structural', implements: ADDITIVE_ADRS,
      threshold: '0 breaking changes between the last release\'s schema and the pull request; a field is removed only once deprecated',
      description: 'In every pull request, graphql-inspector diffs the schema with the one on the main branch and fails on a breaking change (a removed field or type, a changed argument, a nullable field made non-null on input).',
      tool: 'graphql-inspector',
      language: 'yaml',
      snippet: `# .github/workflows/api-contract.yml (a job step)
- name: No breaking schema changes
  run: npx @graphql-inspector/cli diff 'git:origin/main:schema.graphql' schema.graphql`,
    },
    {
      id: 'ff-buf', label: 'Protobuf break check', when: { FORMAT: ['protobuf'], CHANGE: ['additive'] }, category: 'structural', implements: ADDITIVE_ADRS,
      threshold: '0 breaking changes (buf rule set FILE) against the main branch; 0 lint findings, PACKAGE_VERSION_SUFFIX included',
      description: 'buf lint requires a version suffix on every package, and buf breaking compares the .proto files with the main branch, failing on a removed or renumbered field, a changed type or a removed RPC.',
      tool: 'buf breaking',
      language: 'yaml',
      snippet: `# buf.yaml
version: v2
lint:
  use: [STANDARD]          # includes PACKAGE_VERSION_SUFFIX: acme.orders.v1
breaking:
  use: [FILE]
# CI step:
#   buf lint && buf breaking --against '.git#branch=main'`,
    },
    {
      id: 'ff-sunset', label: 'Deprecations carry a sunset', when: ADDITIVE, category: 'structural', implements: ADDITIVE_ADRS,
      threshold: 'Every operation marked deprecated in the contract answers with a Deprecation header and a Sunset date at least {{SUNSET_MONTHS}} months after it; 0 without',
      description: 'A test reads the operations marked deprecated from the contract (not from a list kept by hand), calls each and checks the Deprecation (RFC 9745) and Sunset (RFC 8594) headers. For gRPC the same test reads the response metadata.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import request from 'supertest'
import { app } from '../src/app'

const SUNSET_MONTHS = {{SUNSET_MONTHS}}
const spec = parse(readFileSync('api/openapi.yaml', 'utf8'))
const deprecated = Object.entries(spec.paths).flatMap(([path, ops]) =>
  Object.entries(ops as Record<string, { deprecated?: boolean; 'x-example'?: string }>)
    .filter(([, op]) => op.deprecated)
    .map(([method, op]) => ({ method, path: op['x-example'] ?? path })))

describe.each(deprecated)('$method $path', ({ method, path }) => {
  it('announces its deprecation and a sunset far enough away', async () => {
    const res = await request(app)[method](path)
    expect(res.headers.deprecation).toMatch(/^@\\d+$/)        // RFC 9745: @<epoch seconds>
    const from = new Date(Number(res.headers.deprecation.slice(1)) * 1000)
    from.setMonth(from.getMonth() + SUNSET_MONTHS)
    expect(Date.parse(res.headers.sunset)).toBeGreaterThanOrEqual(from.getTime()) // RFC 8594
  })
})`,
    },
    {
      id: 'ff-pact', label: 'Caller contracts verified', when: { CONTRACT_TESTS: ['pact'] }, category: 'process', implements: ALL_ADRS,
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
//   npx pact-broker can-i-deploy --pacticipant order-api --version "$GIT_SHA" --to-environment production`,
    },
    {
      id: 'ff-conformance', label: 'API conforms to contract', when: { CONTRACT_TESTS: ['conformance'] }, category: 'structural', implements: ALL_ADRS,
      threshold: '0 answers whose status code, headers or body the contract does not describe, over every operation, on each build',
      description: 'On every build, Schemathesis generates calls for each operation of the published contract (OpenAPI or GraphQL), runs them against a running instance and fails on an answer the contract does not allow or on a server error. For gRPC the generated server stubs make the build fail instead.',
      tool: 'Schemathesis',
      language: 'yaml',
      snippet: `# .github/workflows/api-contract.yml (after the API is started)
- name: The running API conforms to its contract
  uses: schemathesis/action@v1
  with:
    schema: 'http://localhost:8080/openapi.json'   # or http://localhost:8080/graphql`,
    },
    {
      id: 'ff-instep', label: 'Callers built with contract', when: { CHANGE: ['instep'] }, category: 'process', implements: ['adr-instep'],
      threshold: 'Every caller of the contract is built and tested in the pipeline of each change to it; 0 callers depend on a published copy of the contract',
      description: 'The callers depend on the contract project inside the workspace, so the build graph puts each of them in the affected set of a change to the contract; a module-boundary rule fails the lint when a caller imports a published client package instead.',
      tool: 'Nx (nx affected, @nx/enforce-module-boundaries)',
      language: 'yaml',
      snippet: `# .github/workflows/ci.yml
- run: npx nx affected -t lint test e2e --base=origin/main
# eslint.config: callers may use the contract only from the workspace
#   '@nx/enforce-module-boundaries': ['error', {
#     banTransitiveDependencies: true,
#     depConstraints: [{ sourceTag: 'type:caller', onlyDependOnLibsWithTags: ['type:contract', 'type:lib'] }],
#   }]`,
    },
  ],
}

export default pack
