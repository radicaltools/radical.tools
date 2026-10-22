import type { PackSpec } from '../../src/packSpec'

const SHAPES = ['adr-pyramid', 'adr-trophy', 'adr-contract']
const FORCES = 'Code lives in this element and changes every week; the tests decide whether a change can be released with confidence or only with hope. The forces: fast tests give feedback in minutes but exercise little of the wiring, while end-to-end tests exercise everything but are slow, brittle and late; coverage shows what was run, not what was checked; tests that share data or depend on order fail at random, and a suite that fails at random is soon ignored; copies of production data make realistic tests but carry personal data; and every service another team depends on is a contract that can break without a test of its own failing.'

const pack: PackSpec = {
  id: 'concern-test-strategy',
  name: 'Test strategy',
  group: 'maintainability',
  description: 'Which tests the element has at which level, which gates a change must pass, where end-to-end tests run, where test data comes from, and what happens to a flaky test.',
  tags: ['maintainability', 'testing', 'test pyramid', 'contract testing', 'mutation testing', 'flaky tests'],
  concern: {
    id: 'test-strategy',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements, so how it is tested before a change is released has to be decided.',
  },
  sources: [
    { title: 'Martin Fowler: TestPyramid', url: 'https://martinfowler.com/bliki/TestPyramid.html' },
    { title: 'Ham Vocke: The Practical Test Pyramid (martinfowler.com)', url: 'https://martinfowler.com/articles/practical-test-pyramid.html' },
    { title: 'Ian Robinson: Consumer-Driven Contracts (martinfowler.com)', url: 'https://martinfowler.com/articles/consumerDrivenContracts.html' },
    { title: 'Martin Fowler: Eradicating Non-Determinism in Tests', url: 'https://martinfowler.com/articles/nonDeterminism.html' },
    { title: 'Martin Fowler: Continuous Integration', url: 'https://martinfowler.com/articles/continuousIntegration.html' },
    { title: 'ISO/IEC 25010, Maintainability: testability', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
    { title: 'Stryker Mutator', url: 'https://stryker-mutator.io/' },
  ],
  questions: [
    {
      key: 'SHAPE', title: 'Test shape', label: 'Where does most of the testing happen?',
      hint: 'The shape says which level carries the bulk of the tests: it decides how fast feedback is, how much a refactoring breaks, and what a green build proves.',
      default: 'pyramid',
      options: [
        { value: 'pyramid', label: 'a test pyramid, mostly unit tests', description: 'Many fast unit tests, fewer integration tests, a handful of end-to-end tests. Pick it when the element holds real domain logic (calculations, rules, state machines) that can be tested in isolation.' },
        { value: 'trophy', label: 'a testing trophy, mostly integration tests', description: 'Most tests run the element with its real database in a container and fake only what lies outside it; static analysis and a few unit tests below, a few end-to-end tests above. Pick it for web apps and services that mostly glue a framework, a database and other APIs together.' },
        { value: 'contract', label: 'contract-heavy, consumer-driven contracts', description: 'Each service is tested alone, and the calls between services are covered by consumer-driven contract tests instead of end-to-end tests across them. Pick it when several services owned by different teams deploy independently.' },
      ],
    },
    {
      key: 'GATE', title: 'Quality gate', label: 'What must the tests prove before a merge?',
      hint: 'Coverage shows which lines ran; mutation testing shows whether a test would notice a line being wrong. Mutation testing costs build time.',
      default: 'coverage',
      options: [
        { value: 'coverage', label: 'coverage of new code', description: 'New and changed lines must be covered by tests to a set percentage. Pick it as the baseline for any codebase, or when build time is tight.' },
        { value: 'mutation', label: 'coverage and mutation score', description: 'Coverage, plus a minimum share of mutants killed in changed code. Pick it when the element holds business rules where a wrong condition costs money or trust, and the build can afford a few extra minutes.' },
      ],
    },
    {
      key: 'DATA', title: 'Test data', label: 'Where does test data come from?',
      hint: 'Data shared between tests makes them depend on order; production copies carry personal data.',
      default: 'synthetic',
      options: [
        { value: 'synthetic', label: 'built by each test', description: 'Each test creates the data it needs with builders or factories, in a fresh or rolled-back database. Pick it by default: tests stay independent and can run in parallel.' },
        { value: 'fixtures', label: 'versioned seed datasets', description: 'Reviewed seed datasets kept with the tests are loaded into a fresh database for each run. Pick it when the data needed is large or intricate (a product catalogue, tariffs) and the same for many tests.' },
        { value: 'masked', label: 'masked copies of production', description: 'Production data, with personal data masked or replaced, is copied into test environments. Pick it only when realistic volume and distribution matter (performance, migrations, reports) and synthetic data cannot reproduce them.' },
      ],
    },
    {
      key: 'E2E', title: 'End-to-end', label: 'Where do the end-to-end tests run?',
      hint: 'End-to-end tests are the slowest and most brittle; where they run decides what they can stop.',
      default: 'pipeline',
      options: [
        { value: 'pipeline', label: 'on each pull request, in an ephemeral environment', description: 'Every pull request is deployed to a short-lived environment and the journeys run there before the merge. Pick it when environments can be created in minutes (containers, infrastructure as code).' },
        { value: 'staging', label: 'after the merge, on staging', description: 'Merged builds deploy to a shared staging environment and the journeys gate the promotion to production. Pick it when a full environment is too costly to create per pull request.' },
        { value: 'production', label: 'in production, as synthetic checks', description: 'No end-to-end gate before release; the journeys run against production after each deploy and on a schedule, and a failure rolls back. Pick it when you deploy many times a day behind feature flags with fast, automated rollback.' },
      ],
    },
    {
      key: 'FLAKY', title: 'Flaky tests', label: 'What happens to a test that fails at random?',
      hint: 'A test that fails and passes on the same code teaches everyone to rerun until green, and then real failures are rerun too.',
      default: 'quarantine',
      options: [
        { value: 'quarantine', label: 'quarantined, then fixed or deleted', description: 'The flaky test is moved out of the gate within a day, given an owner, and fixed or deleted within a deadline. Pick it for larger suites and several teams, where blocking everyone on one test costs more than the lost check.' },
        { value: 'zero', label: 'a flaky test is a failure', description: 'No automatic retries: a test that fails and then passes fails the build, and is fixed before anything else merges. Pick it for a small suite and one team, where flakes are rare and fixed at once.' },
      ],
    },
  ],
  details: [
    { key: 'PIPELINE_MINUTES', label: 'Within how many minutes must the pull-request test run finish?', default: '10', number: true },
    { key: 'COVERAGE', label: 'What coverage of new code is required (%)?', default: '80', number: true },
    { key: 'MUTATION', label: 'What mutation score is required on changed code (%)?', default: '70', number: true },
    { key: 'JOURNEYS', label: 'Which user journeys do the end-to-end tests cover?', default: 'sign-in, search, checkout' },
    { key: 'QUARANTINE_DAYS', label: 'Within how many days must a quarantined test be fixed or deleted?', default: '7', number: true },
  ],
  need: {
    label: 'Changes are released with confidence',
    text: 'The element changes often, and every change must be releasable without fear: the tests have to catch a broken rule, a broken integration and a broken journey before users do, give that answer quickly enough that people wait for it, and give the same answer every time they run on the same code. A green build must mean something.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-pr-suite', label: 'Fast tests on every change', ears_type: 'event-driven',
      trigger: 'a pull request is opened or updated',
      action: 'run the unit and integration tests within {{PIPELINE_MINUTES}} minutes and block the merge on any failure',
      rationale: 'Feedback that takes longer than about ten minutes is no longer waited for, and changes pile up untested (Fowler, Continuous Integration: keep the build fast).',
      scenario: { label: 'Change is tested in time', given: 'a pull request with a failing test', when: 'it is pushed', then: 'the test run reports the failure within {{PIPELINE_MINUTES}} minutes and the pull request cannot be merged' },
    },
    {
      id: 'req-coverage', label: 'New code is covered', ears_type: 'ubiquitous',
      action: 'cover at least {{COVERAGE}}% of new and changed lines, branches included, with automated tests, measured on each pull request',
      rationale: 'A gate on new code keeps coverage from falling without demanding that old code be fixed first (SonarQube "Clean as You Code"; ISO 25010 testability).',
      scenario: { label: 'Uncovered code refused', given: 'a pull request adding code', when: 'its tests cover less than {{COVERAGE}}% of the new lines', then: 'the quality gate fails and the pull request cannot be merged' },
    },
    {
      id: 'req-mutation', label: 'Tests notice wrong code', when: { GATE: ['mutation'] }, ears_type: 'ubiquitous',
      action: 'kill at least {{MUTATION}}% of the mutants generated in the changed code of each pull request',
      rationale: 'Coverage shows that a line ran, not that a test would fail if it were wrong; a surviving mutant is a change no test notices (Stryker, PIT; Building Evolutionary Architectures).',
      scenario: { label: 'Weak tests refused', given: 'a pull request whose tests run the new code but assert nothing about a condition', when: 'mutation testing flips that condition', then: 'the mutant survives, the score falls below {{MUTATION}}% and the merge is blocked' },
    },
    {
      id: 'req-pyramid', label: 'Mostly fast unit tests', when: { SHAPE: ['pyramid'] }, ears_type: 'ubiquitous',
      action: 'keep at least 70% of the automated tests as unit tests that touch no network, database or file system and run in under 100 ms each, and at most 10% as end-to-end tests',
      rationale: 'Tests low in the pyramid are fast, precise about what broke and cheap to keep; high ones are slow and brittle, so few of them (Fowler, TestPyramid; Vocke, The Practical Test Pyramid).',
      scenario: { label: 'Unit test stays isolated', given: 'the unit test suite with network access disabled', when: 'it runs', then: 'every test passes in under 100 ms and unit tests are at least 70% of all tests' },
    },
    {
      id: 'req-trophy', label: 'Integration tests use real services', when: { SHAPE: ['trophy'] }, ears_type: 'ubiquitous',
      action: 'test behaviour mostly through integration tests that run the element with its real database and broker in containers and fake only systems outside it, with integration tests at least 50% of the suite and 0 in-memory substitutes for the database',
      rationale: 'For code that mostly glues a framework and a database together, the bugs live in the wiring; an in-memory substitute hides exactly those (Vocke, The Practical Test Pyramid: integration tests; Testcontainers).',
      scenario: { label: 'Real database in tests', given: 'the integration test suite', when: 'it runs', then: 'it starts the same database engine and version as production in a container, and no test uses an in-memory substitute' },
    },
    {
      id: 'req-contracts', label: 'Contracts verified before deploy', when: { SHAPE: ['contract'] }, ears_type: 'event-driven',
      trigger: 'a consumer changes how it calls a provider, or a provider is about to be deployed',
      action: 'verify every consumer\'s contract against the provider in the provider\'s build, and refuse to deploy a version that has not verified the contracts of the consumers in the target environment',
      rationale: 'Contract tests find a breaking change between services in the provider\'s build, in minutes, without an environment with every service in it (Robinson, Consumer-Driven Contracts).',
      scenario: { label: 'Breaking change refused', given: 'a consumer whose contract expects a field', when: 'the provider removes the field and tries to deploy', then: 'contract verification fails and the deployment is refused' },
    },
    {
      id: 'req-own-data', label: 'Tests build their own data', when: { DATA: ['synthetic'] }, ears_type: 'ubiquitous',
      action: 'create the data each test needs in the test itself with builders or factories, and leave nothing behind, so that the suite passes in random order and in parallel',
      rationale: 'Tests sharing data depend on order and break each other, the most common cause of flaky suites (Fowler, Eradicating Non-Determinism in Tests: isolation).',
      scenario: { label: 'Order does not matter', given: 'the test suite', when: 'it runs three times in random order with parallel workers', then: 'all three runs pass' },
    },
    {
      id: 'req-fixtures', label: 'Seed data is versioned', when: { DATA: ['fixtures'] }, ears_type: 'ubiquitous',
      action: 'keep seed datasets in version control next to the tests, load them into a fresh database for each test run after the current migrations, and change them only through a reviewed pull request',
      rationale: 'Shared data is safe when it is the same on every run and every change to it is visible; a database kept between runs drifts (Vocke, The Practical Test Pyramid).',
      scenario: { label: 'Seed loads on fresh database', given: 'the seed datasets and the current migrations', when: 'a test run starts', then: 'a fresh database is migrated, the seed loads without error, and tests that change it run in a transaction rolled back afterwards' },
    },
    {
      id: 'req-masking', label: 'No personal data in tests', when: { DATA: ['masked'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a copy of production data is made for a test environment',
      action: 'mask or replace every personal-data field before the copy leaves the production environment, so that 0 real names, e-mail addresses, phone numbers, addresses or payment details reach a test environment',
      rationale: 'Test environments are less protected than production; personal data in them is a breach waiting to happen (GDPR Art. 25 and 32: data protection by design, security of processing).',
      scenario: { label: 'Copy carries no personal data', given: 'a production snapshot', when: 'it is copied to a test environment', then: 'a scan of the copy finds 0 personal-data values and the copy is refused otherwise' },
    },
    {
      id: 'req-e2e-pr', label: 'Journeys tested before merge', when: { E2E: ['pipeline'] }, ears_type: 'event-driven',
      trigger: 'a pull request is opened or updated',
      action: 'deploy it to an ephemeral environment, run the end-to-end tests of {{JOURNEYS}} there, block the merge on a failure, and remove the environment when the pull request closes',
      rationale: 'A broken journey is cheapest to fix before the merge; an environment per pull request keeps changes from waiting for a shared one (Vocke, The Practical Test Pyramid: end-to-end tests).',
      scenario: { label: 'Broken journey blocks merge', given: 'a pull request that breaks one of: {{JOURNEYS}}', when: 'its ephemeral environment is tested', then: 'the journey fails and the pull request cannot be merged' },
    },
    {
      id: 'req-e2e-staging', label: 'Journeys gate promotion', when: { E2E: ['staging'] }, ears_type: 'event-driven',
      trigger: 'a build is merged to the main branch',
      action: 'deploy it to staging, run the end-to-end tests of {{JOURNEYS}} there, and promote it to production only when all pass',
      rationale: 'One shared environment is cheaper than one per change; the gate keeps a broken journey out of production (Humble, Farley: Continuous Delivery, the deployment pipeline).',
      scenario: { label: 'Broken build not promoted', given: 'a merged build that breaks one of: {{JOURNEYS}}', when: 'it is tested on staging', then: 'it is not promoted to production and the team is told' },
    },
    {
      id: 'req-e2e-prod', label: 'Journeys checked in production', when: { E2E: ['production'] }, ears_type: 'event-driven',
      trigger: 'a release reaches production',
      action: 'run synthetic checks of {{JOURNEYS}} against it within 5 minutes and every 5 minutes after, and roll the release back automatically when a check fails twice in a row',
      rationale: 'With many deploys a day, production is the only environment where every journey can be proved; fast rollback bounds the harm of what slipped through (Sridharan, Testing in production; Google SRE, release engineering).',
      scenario: { label: 'Failing journey rolls back', given: 'a release that breaks one of: {{JOURNEYS}}', when: 'the synthetic check fails twice in a row', then: 'the release is rolled back automatically and the team is alerted' },
    },
    {
      id: 'req-quarantine', label: 'Flaky tests quarantined', when: { FLAKY: ['quarantine'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a test fails and then passes on the same commit',
      action: 'move it to quarantine within 1 working day, where it runs but no longer blocks merges, assign it an owner, and fix or delete it within {{QUARANTINE_DAYS}} days',
      rationale: 'A flaky test left in the gate teaches everyone to rerun until green; one left in quarantine forever is a deleted test nobody decided to delete (Fowler, Eradicating Non-Determinism in Tests: quarantine).',
      scenario: { label: 'Flaky test leaves the gate', given: 'a test that fails and then passes on the same commit', when: 'it is reported as flaky', then: 'within 1 working day it is quarantined with an owner, and after {{QUARANTINE_DAYS}} days it is fixed or deleted' },
    },
    {
      id: 'req-no-retry', label: 'Flaky tests fail the build', when: { FLAKY: ['zero'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a test fails and then passes on the same commit',
      action: 'fail the build, naming the test as flaky, and merge nothing else to the main branch until it is fixed or deleted',
      rationale: 'A small suite stays trustworthy only if every flake is treated as a defect at once (Fowler, Eradicating Non-Determinism in Tests).',
      scenario: { label: 'Flaky test stops the line', given: 'a test that fails and then passes on the same commit', when: 'the build runs', then: 'the build fails naming the test as flaky' },
    },
  ],
  adrs: [
    {
      id: 'adr-pyramid', label: 'A test pyramid', when: { SHAPE: ['pyramid'] },
      decision: 'Tests follow the pyramid: most are unit tests of the domain logic, run without network or database (JUnit 5, xUnit, Vitest or pytest by stack); integration tests cover each adapter against the real dependency in a container (Testcontainers); a few end-to-end tests cover {{JOURNEYS}} (Playwright). Every pull request runs unit and integration tests within {{PIPELINE_MINUTES}} minutes. Gate: {{GATE}}, measured in the SonarQube (or SonarCloud) quality gate on new code; mutation testing with Stryker (JS/TS, .NET) or PIT (JVM). Test data: {{DATA}}. End-to-end tests run {{E2E}}. Flaky tests: {{FLAKY}}.',
      consequences: '• Fast, precise feedback: a failing unit test names the rule that broke.\n• Refactoring that changes internal interfaces rewrites many unit tests; test behaviour, not methods, to limit it.\n• Wiring bugs (configuration, queries, serialisation) are caught only by the thinner integration layer.\n• Requires code where the logic can be called without infrastructure.',
      alternatives: '1. A testing trophy: mostly integration tests, better for glue code, slower feedback.\n2. Contract-heavy: for many independently deployed services.\n3. An ice-cream cone of manual and end-to-end tests: slow, brittle and late; the shape to move away from.',
    },
    {
      id: 'adr-trophy', label: 'A testing trophy', when: { SHAPE: ['trophy'] },
      decision: 'Most tests are integration tests that run the element through its public interface (HTTP or the UI component tree) with its real database and broker started by Testcontainers, faking only systems outside it (WireMock or MSW); static analysis (TypeScript strict, ESLint or the compiler and SonarQube) and a few unit tests for pure logic sit below; a few end-to-end tests cover {{JOURNEYS}} with Playwright. Every pull request runs them within {{PIPELINE_MINUTES}} minutes. Gate: {{GATE}}, in the SonarQube quality gate on new code. Test data: {{DATA}}. End-to-end tests run {{E2E}}. Flaky tests: {{FLAKY}}. In-memory substitutes for the database (H2, SQLite for PostgreSQL, pg-mem) are not used.',
      consequences: '• Tests survive refactoring because they use the element as its callers do.\n• Wiring, queries and serialisation are tested for real.\n• Slower than unit tests: containers start once per run and tests must clean up; keeping the run under {{PIPELINE_MINUTES}} minutes needs parallel workers.\n• A failing test says which behaviour broke, not which line; debugging takes longer.',
      alternatives: '1. A test pyramid: faster and more precise where there is real domain logic.\n2. In-memory database substitutes: faster, but they differ from the real engine exactly where bugs hide.\n3. Contract-heavy: needed in addition when several services are owned by different teams.',
    },
    {
      id: 'adr-contract', label: 'Consumer-driven contracts', when: { SHAPE: ['contract'] },
      decision: 'Each service is tested alone (unit and integration tests with Testcontainers), and every call between services is covered by consumer-driven contract tests with Pact: consumers publish their contracts to a Pact Broker (or PactFlow), providers verify them in their build, and every deployment asks can-i-deploy first. Asynchronous messages get message pacts. End-to-end tests across services shrink to {{JOURNEYS}}, run {{E2E}}. Every pull request runs its service\'s tests within {{PIPELINE_MINUTES}} minutes. Gate: {{GATE}}, in the SonarQube quality gate on new code. Test data: {{DATA}}. Flaky tests: {{FLAKY}}. Choose Pact for HTTP and messages across languages; Spring Cloud Contract only when every service is on Spring.',
      consequences: '• A breaking change between services is found in the provider\'s build in minutes, not in a shared environment days later.\n• Teams deploy independently without a full environment of every service.\n• Contracts cover only what consumers use; a consumer without a contract is unprotected.\n• The broker is one more thing to run (or a PactFlow subscription), and teams must learn the workflow.',
      alternatives: '1. End-to-end tests across all services in a shared environment: realistic, but slow, flaky and blocking every team.\n2. Provider-written OpenAPI schema tests: check the provider against its own document, not against what consumers rely on.\n3. A test pyramid per service without contracts: fast, but blind to breaking changes between services.',
    },
  ],
  fitness: [
    {
      id: 'ff-pr-time', label: 'Pull-request tests in time', category: 'process', implements: SHAPES,
      threshold: 'The pull-request test job finishes within {{PIPELINE_MINUTES}} minutes and is a required check for merging',
      description: 'The test job has a hard timeout of {{PIPELINE_MINUTES}} minutes and is a required status check in branch protection, so a slow suite fails instead of quietly growing.',
      tool: 'GitHub Actions (timeout-minutes) with branch protection',
      language: 'yaml',
      snippet: `# .github/workflows/test.yml
name: test
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10   # PIPELINE_MINUTES
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm test -- --reporter=junit --outputFile=reports/junit.xml`,
    },
    {
      id: 'ff-coverage', label: 'Coverage of new code', category: 'process', implements: SHAPES,
      threshold: 'Coverage on new code at least {{COVERAGE}}%; the quality gate fails the pull request below it',
      description: 'The pipeline sends the coverage report to SonarQube and waits for the quality gate, whose condition is "Coverage on New Code is less than {{COVERAGE}}%".',
      tool: 'SonarQube quality gate',
      language: 'properties',
      snippet: `# sonar-project.properties
sonar.projectKey=shop-order-api
sonar.sources=src
sonar.tests=test
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.newCode.referenceBranch=main
# fail the pipeline when the gate fails
sonar.qualitygate.wait=true
# Quality gate (in SonarQube): Coverage on New Code < 80% -> failed`,
    },
    {
      id: 'ff-mutation', label: 'Mutation score', when: { GATE: ['mutation'] }, category: 'process', implements: SHAPES,
      threshold: 'Mutation score on changed code at least {{MUTATION}}%; the build breaks below it',
      description: 'Stryker runs incrementally on the files the pull request changes and breaks the build when the score falls below the threshold. On the JVM, PIT with mutationThreshold and the git-based scm goal does the same.',
      tool: 'Stryker Mutator',
      language: 'json',
      snippet: `{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "vitest",
  "mutate": ["src/**/*.ts", "!src/**/*.test.ts"],
  "incremental": true,
  "reporters": ["clear-text", "html", "json"],
  "thresholds": { "high": 85, "low": 75, "break": 70 }
}`,
    },
    {
      id: 'ff-unit-isolated', label: 'Unit tests stay isolated', when: { SHAPE: ['pyramid'] }, category: 'structural', implements: ['adr-pyramid'],
      threshold: '0 unit tests reach the network; unit tests at least 70% of all tests',
      description: 'The unit-test project disables network connections in its setup, so a unit test that reaches a server fails; a step in CI counts tests per suite from the JUnit reports and fails when unit tests are below 70%.',
      tool: 'Vitest with nock',
      language: 'ts',
      snippet: `// test/unit/setup.ts (vitest.config.ts: test.setupFiles for the unit project)
import nock from 'nock'
import { afterAll, beforeAll } from 'vitest'

beforeAll(() => nock.disableNetConnect())   // any real HTTP call throws
afterAll(() => nock.enableNetConnect())

// CI: unit share from the JUnit reports
// unit=$(xmllint --xpath 'sum(//testsuites/@tests)' reports/unit.xml)
// all=$(xmllint --xpath 'sum(//testsuites/@tests)' reports/*.xml)
// [ $((unit * 100 / all)) -ge 70 ]`,
    },
    {
      id: 'ff-no-fakes', label: 'No in-memory database', when: { SHAPE: ['trophy'] }, category: 'structural', implements: ['adr-trophy'],
      threshold: '0 test files import an in-memory database substitute',
      description: 'A dependency rule fails the build when a test imports an in-memory substitute for the database; the integration tests use Testcontainers with the production engine and version.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'no-in-memory-database',
    comment: 'ADR Testing trophy: integration tests use the real engine (Testcontainers)',
    severity: 'error',
    from: { path: '\\\\.(test|spec)\\\\.ts$' },
    to: { path: 'node_modules/(pg-mem|sqlite3|better-sqlite3|mongodb-memory-server)' },
  }],
}`,
    },
    {
      id: 'ff-can-i-deploy', label: 'Contracts verified', when: { SHAPE: ['contract'] }, category: 'process', implements: ['adr-contract'],
      threshold: '0 deployments of a version that has not verified the contracts of the consumers in the target environment',
      description: 'The deploy job asks the Pact Broker whether this version is compatible with what is deployed in the target environment, and stops when it is not; after deploying it records the deployment.',
      tool: 'Pact Broker can-i-deploy (pact-broker CLI)',
      language: 'bash',
      snippet: `pact-broker can-i-deploy \\
  --pacticipant order-api --version "$GIT_SHA" \\
  --to-environment production \\
  --broker-base-url "$PACT_BROKER_URL" --retry-while-unknown 6 --retry-interval 10

# after a successful deploy
pact-broker record-deployment \\
  --pacticipant order-api --version "$GIT_SHA" --environment production`,
    },
    {
      id: 'ff-shuffle', label: 'Tests pass in any order', when: { DATA: ['synthetic', 'fixtures'] }, category: 'process', implements: SHAPES,
      threshold: 'The suite passes in 3 consecutive runs with random order and parallel workers',
      description: 'A nightly job runs the suite three times with shuffled order and a different seed each time; a failure prints the seed, so the order can be reproduced. JUnit 5: junit.jupiter.testmethod.order.default=org.junit.jupiter.api.MethodOrderer$Random; pytest: pytest-randomly.',
      tool: 'Vitest (sequence.shuffle)',
      language: 'ts',
      snippet: `// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    sequence: { shuffle: true },  // files and tests in random order
    pool: 'threads',
  },
})
// nightly: for seed in 1 2 3; do npx vitest run --sequence.seed=$RANDOM || exit 1; done`,
    },
    {
      id: 'ff-pii-scan', label: 'Test copies hold no personal data', when: { DATA: ['masked'] }, category: 'operational', implements: SHAPES,
      threshold: '0 personal-data findings in a sample of 10,000 rows per table of each copy; a copy with findings is not released to test environments',
      description: 'Before a masked copy is released, a job samples every text column and runs Presidio\'s analyzer over it; any finding stops the release of the copy.',
      tool: 'Microsoft Presidio',
      language: 'python',
      snippet: `from presidio_analyzer import AnalyzerEngine
analyzer = AnalyzerEngine()
ENTITIES = ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "IBAN_CODE", "CREDIT_CARD", "LOCATION"]

def findings(rows):
    for table, column, value in rows:           # sampled text columns of the copy
        for hit in analyzer.analyze(text=str(value), entities=ENTITIES, language="en"):
            if hit.score >= 0.6:
                yield table, column, hit.entity_type

hits = list(findings(sample_rows(limit_per_table=10_000)))
assert not hits, f"personal data in the test copy: {hits[:20]}"`,
    },
    {
      id: 'ff-e2e-gate', label: 'Journeys gate the release', when: { E2E: ['pipeline', 'staging'] }, category: 'process', implements: SHAPES,
      threshold: 'All end-to-end tests of {{JOURNEYS}} pass before the build is merged or promoted; 0 skipped',
      description: 'Playwright runs the journeys against the environment the pipeline deployed (an ephemeral one per pull request, or staging after the merge); its job is a required check for the merge or for the promotion.',
      tool: 'Playwright',
      language: 'ts',
      snippet: `// playwright.config.ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,                       // no test.only left in the gate
  retries: 0,
  reporter: [['junit', { outputFile: 'reports/e2e.xml' }]],
  use: { baseURL: process.env.E2E_BASE_URL, trace: 'retain-on-failure' },
})`,
    },
    {
      id: 'ff-synthetic', label: 'Journeys checked in production', when: { E2E: ['production'] }, category: 'operational', implements: SHAPES,
      threshold: 'Each journey of {{JOURNEYS}} runs every 5 minutes from 2 locations; 2 failures in a row roll the release back',
      description: 'The Playwright journeys run as Checkly browser checks against production after each deploy and every 5 minutes; an alert channel triggers the rollback.',
      tool: 'Checkly (Playwright browser checks)',
      language: 'ts',
      snippet: `// checkly/checkout.check.ts
import { BrowserCheck, Frequency } from 'checkly/constructs'
new BrowserCheck('checkout-journey', {
  name: 'Checkout journey',
  frequency: Frequency.EVERY_5M,
  locations: ['eu-west-1', 'eu-central-1'],
  degradedResponseTime: 8000,
  maxResponseTime: 15000,
  code: { entrypoint: '../e2e/checkout.spec.ts' },
})`,
    },
    {
      id: 'ff-quarantine', label: 'Quarantine is emptied', when: { FLAKY: ['quarantine'] }, category: 'process', implements: SHAPES,
      threshold: '0 tests in quarantine for more than {{QUARANTINE_DAYS}} days; every entry has an owner and a ticket',
      description: 'Quarantined tests are listed in quarantine.json and tagged @quarantine, which the gate skips and a separate non-blocking job runs. A test over the list fails the build when an entry is older than the deadline or has no owner.',
      tool: 'Vitest (a test over quarantine.json)',
      language: 'ts',
      snippet: `import { expect, it } from 'vitest'
import quarantine from '../quarantine.json'   // [{ test, owner, ticket, since: "2026-10-01" }]

const DAYS = Number(process.env.QUARANTINE_DAYS ?? 7)

it('no test stays in quarantine past the deadline', () => {
  const overdue = quarantine.filter((q) =>
    !q.owner || !q.ticket || (Date.now() - Date.parse(q.since)) / 86_400_000 > DAYS)
  expect(overdue).toEqual([])
})`,
    },
    {
      id: 'ff-flaky-fails', label: 'Flaky tests fail the build', when: { FLAKY: ['zero'] }, category: 'process', implements: SHAPES,
      threshold: '0 tests that pass only on retry; such a test fails the build',
      description: 'The test-retry plugin reruns a failed test once only to tell a flake from a real failure; with failOnPassedAfterRetry a test that passes on retry still fails the build and is reported as flaky.',
      tool: 'Gradle test-retry plugin',
      language: 'kotlin',
      snippet: `// build.gradle.kts
plugins { id("org.gradle.test-retry") version "1.6.2" }

tasks.test {
  retry {
    maxRetries.set(1)
    failOnPassedAfterRetry.set(true)  // a flake is a failure
  }
}`,
    },
  ],
}

export default pack
