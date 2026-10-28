import type { PackSpec } from '../../src/packSpec'

const SHAPES = ['adr-pyramid', 'adr-trophy']
const FORCES = 'Code lives in this element and changes every week; the tests decide whether a change can be released with confidence or only with hope. The forces: fast tests give feedback in minutes but exercise little of the wiring, while end-to-end tests exercise everything but are slow, brittle and late; coverage shows what was run, not what was checked; tests that share data or depend on order fail at random, and a suite that fails at random is soon ignored; copies of production data make realistic tests but carry personal data; and a test that fails only sometimes teaches everyone to rerun until green. Contract tests between the system\'s parts and with outside callers are decided in the Communication style and API evolution packs.'

const pack: PackSpec = {
  id: 'concern-test-strategy',
  name: 'Test strategy',
  group: 'maintainability',
  description: 'Which tests the element has at which level, which gates a change must pass, where end-to-end tests run, where test data comes from, and what happens to a flaky test. The snippets are for a Node project with Vitest, Playwright, Stryker, SonarQube and Checkly; each tool line names the JVM equivalent.',
  tags: ['maintainability', 'testing', 'test pyramid', 'testing trophy', 'mutation testing', 'flaky tests'],
  concern: {
    id: 'test-strategy',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements, so how it is tested before a change is released has to be decided.',
  },
  sources: [
    { title: 'Martin Fowler: TestPyramid', url: 'https://martinfowler.com/bliki/TestPyramid.html' },
    { title: 'Ham Vocke: The Practical Test Pyramid (martinfowler.com)', url: 'https://martinfowler.com/articles/practical-test-pyramid.html' },
    { title: 'Martin Fowler: Eradicating Non-Determinism in Tests', url: 'https://martinfowler.com/articles/nonDeterminism.html' },
    { title: 'Martin Fowler: Continuous Integration', url: 'https://martinfowler.com/articles/continuousIntegration.html' },
    { title: 'Jez Humble, David Farley: Continuous Delivery (the deployment pipeline)', url: 'https://www.oreilly.com/library/view/continuous-delivery-reliable/9780321670250/' },
    { title: 'Cindy Sridharan: Testing in Production, the safe way', url: 'https://copyconstruct.medium.com/testing-in-production-the-safe-way-18ca102d0ef1' },
    { title: 'ISO/IEC 25010, Maintainability: testability', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
    { title: 'SonarQube: Clean as You Code', url: 'https://docs.sonarsource.com/sonarqube-server/latest/core-concepts/clean-as-you-code/' },
    { title: 'Stryker Mutator', url: 'https://stryker-mutator.io/' },
    { title: 'PIT mutation testing', url: 'https://pitest.org/' },
    { title: 'Testcontainers', url: 'https://testcontainers.com/' },
    { title: 'Regulation (EU) 2016/679 (GDPR), Articles 25 and 32', url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj' },
  ],
  questions: [
    {
      key: 'SHAPE', title: 'Test shape', label: 'Where does most of the testing happen?',
      hint: 'The shape says which level carries the bulk of the tests: it decides how fast feedback is, how much a refactoring breaks, and what a green build proves. Contract tests between parts and with outside callers are decided in the Communication style and API evolution packs, not here.',
      default: 'pyramid',
      options: [
        { value: 'pyramid', label: 'a test pyramid, mostly unit tests', description: 'Many fast unit tests, fewer integration tests, a handful of end-to-end tests. Pick it when the element holds real domain logic (calculations, rules, state machines) that can be tested in isolation.' },
        { value: 'trophy', label: 'a testing trophy, mostly integration tests', description: 'Most tests run the element with its real database in a container and fake only what lies outside it; static analysis and a few unit tests below, a few end-to-end tests above. Pick it for web apps and services that mostly glue a framework, a database and other APIs together.' },
      ],
    },
    {
      key: 'GATE', title: 'Quality gate', label: 'What must the tests prove before a merge?',
      hint: 'Coverage shows which lines ran; mutation testing shows whether a test would notice a line being wrong. Mutation testing costs build time.',
      default: 'coverage',
      options: [
        { value: 'coverage', label: 'coverage of new code', description: 'New and changed lines must be covered by tests to a set percentage. Pick it as the baseline for any codebase, or when build time is tight.' },
        { value: 'mutation', label: 'coverage and a mutation score', description: 'Coverage, plus a minimum share of mutants killed in changed code. Pick it when the element holds business rules where a wrong condition costs money or trust, and the build can afford a few extra minutes.' },
      ],
    },
    {
      key: 'DATA', title: 'Test data', label: 'Where does test data come from?',
      hint: 'Data shared between tests makes them depend on order; production copies carry personal data.',
      default: 'synthetic',
      options: [
        { value: 'synthetic', label: 'data built by each test', description: 'Each test creates the data it needs with builders or factories, in a fresh or rolled-back database. Pick it by default: tests stay independent and can run in parallel.' },
        { value: 'fixtures', label: 'versioned seed datasets', description: 'Reviewed seed datasets kept with the tests are loaded into a fresh database for each run. Pick it when the data needed is large or intricate (a product catalogue, tariffs) and the same for many tests.' },
        { value: 'masked', label: 'masked copies of production', description: 'Production data, with personal data masked or replaced, is copied into test environments. Pick it only when realistic volume and distribution matter (performance, migrations, reports) and synthetic data cannot reproduce them.' },
      ],
    },
    {
      key: 'E2E', title: 'End-to-end', label: 'Where do the end-to-end tests run?',
      hint: 'End-to-end tests are the slowest and most brittle; where they run decides what they can stop.',
      default: 'pipeline',
      options: [
        { value: 'pipeline', label: 'an ephemeral environment per pull request', description: 'Every pull request is deployed to a short-lived environment and the journeys run there before the merge. Pick it when environments can be created in minutes (containers, infrastructure as code).' },
        { value: 'staging', label: 'staging, after the merge', description: 'Merged builds deploy to a shared staging environment and the journeys gate the promotion to production. Pick it when a full environment is too costly to create per pull request.' },
        { value: 'production', label: 'production, as synthetic checks', description: 'No end-to-end gate before release; the journeys run against production after each deploy and on a schedule, and a failure rolls back. Pick it when you deploy many times a day behind feature flags with fast, automated rollback.' },
      ],
    },
    {
      key: 'FLAKY', title: 'Flaky tests', label: 'What happens to a test that fails at random?',
      hint: 'A test that fails and passes on the same code teaches everyone to rerun until green, and then real failures are rerun too.',
      default: 'quarantine',
      options: [
        { value: 'quarantine', label: 'quarantine, then a fix or deletion', description: 'The flaky test is moved out of the gate within a day, given an owner, and fixed or deleted within a deadline. Pick it for larger suites and several teams, where blocking everyone on one test costs more than the lost check.' },
        { value: 'zero', label: 'a failure like any other', description: 'No automatic retries: a test that fails and then passes fails the build, and is fixed before anything else merges. Pick it for a small suite and one team, where flakes are rare and fixed at once.' },
      ],
    },
  ],
  details: [
    { key: 'PIPELINE_MINUTES', label: 'Within how many minutes must the pull-request test run finish?', default: '10', number: true },
    { key: 'COVERAGE', label: 'What coverage of new code is required (%)?', default: '80', number: true },
    { key: 'MUTATION', label: 'What mutation score is required on changed code (%)?', default: '70', number: true },
    { key: 'JOURNEYS', label: 'Which user journeys do the end-to-end tests cover (one Playwright spec each, e2e/<journey>.spec.ts)?', default: 'sign-in, search, checkout' },
    { key: 'QUARANTINE_DAYS', label: 'Within how many days must a quarantined test be fixed or deleted?', default: '7', number: true },
  ],
  need: {
    label: 'Changes are released with confidence',
    text: 'The element changes often, and every change must be releasable without fear: the tests have to catch a broken rule, a broken integration and a broken journey before users do, give that answer quickly enough that people wait for it, and give the same answer every time they run on the same code. A green build must mean something. The checks below share one layout: unit tests under test/unit, integration tests under test/integration, end-to-end journeys as Playwright specs under e2e/<journey>.spec.ts, JUnit reports written to reports/<suite>.xml, quarantined tests listed in quarantine.json.',
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
      rationale: 'A gate on new code keeps coverage from falling without demanding that old code be fixed first (SonarQube, Clean as You Code; ISO/IEC 25010 testability).',
      scenario: { label: 'Uncovered code refused', given: 'a pull request adding code', when: 'its tests cover less than {{COVERAGE}}% of the new lines', then: 'the quality gate fails and the pull request cannot be merged' },
    },
    {
      id: 'req-mutation', label: 'Tests notice wrong code', when: { GATE: ['mutation'] }, ears_type: 'ubiquitous',
      action: 'kill at least {{MUTATION}}% of the mutants generated in the files each pull request changes',
      rationale: 'Coverage shows that a line ran, not that a test would fail if it were wrong; a surviving mutant is a change no test notices (Stryker Mutator; PIT).',
      scenario: { label: 'Weak tests refused', given: 'a pull request whose tests run the new code but assert nothing about a condition', when: 'mutation testing flips that condition', then: 'the mutant survives, the score falls below {{MUTATION}}% and the merge is blocked' },
    },
    {
      id: 'req-pyramid', label: 'Mostly fast unit tests', when: { SHAPE: ['pyramid'] }, ears_type: 'ubiquitous',
      action: 'keep at least 70% of the automated tests as unit tests that touch no network and run in under 100 ms each, and at most 10% as end-to-end tests',
      rationale: 'Tests low in the pyramid are fast, precise about what broke and cheap to keep; high ones are slow and brittle, so few of them (Fowler, TestPyramid; Vocke, The Practical Test Pyramid).',
      scenario: { label: 'Unit test stays isolated', given: 'the unit test suite with network access disabled', when: 'it runs', then: 'every test passes in under 100 ms, unit tests are at least 70% of all tests and end-to-end tests at most 10%' },
    },
    {
      id: 'req-trophy', label: 'Integration tests use real services', when: { SHAPE: ['trophy'] }, ears_type: 'ubiquitous',
      action: 'test behaviour mostly through integration tests that run the element with its real database and broker in containers and fake only systems outside it, with integration tests at least 50% of the suite and 0 in-memory substitutes for the database',
      rationale: 'For code that mostly glues a framework and a database together, the bugs live in the wiring; an in-memory substitute hides exactly those (Vocke, The Practical Test Pyramid: integration tests; Testcontainers).',
      scenario: { label: 'Real database in tests', given: 'the test suite', when: 'it runs', then: 'the integration tests start the same database engine and version as production in a container, no test file imports an in-memory substitute, and integration tests are at least 50% of all tests' },
    },
    {
      id: 'req-own-data', label: 'Tests build their own data', when: { DATA: ['synthetic'] }, ears_type: 'ubiquitous',
      action: 'create the data each test needs in the test itself with builders or factories, and leave nothing behind, so that the suite passes in random order and in parallel',
      rationale: 'Tests sharing data depend on order and break each other, the most common cause of flaky suites (Fowler, Eradicating Non-Determinism in Tests: isolation).',
      scenario: { label: 'Order does not matter', given: 'the test suite', when: 'it runs three times in random order with parallel workers', then: 'all three runs pass' },
    },
    {
      id: 'req-fixtures', label: 'Seed data is versioned', when: { DATA: ['fixtures'] }, ears_type: 'ubiquitous',
      action: 'keep seed datasets in version control under test/seed, load them into a fresh database for each test run after the current migrations, and change them only through a reviewed pull request',
      rationale: 'Shared data is safe when it is the same on every run and every change to it is visible; a database kept between runs drifts (Vocke, The Practical Test Pyramid).',
      scenario: { label: 'Seed loads on fresh database', given: 'the seed datasets and the current migrations', when: 'a test run starts', then: 'a fresh database is migrated, the seed loads without error, and the suite passes in random order' },
    },
    {
      id: 'req-masking', label: 'No personal data in tests', when: { DATA: ['masked'] }, ears_type: 'event-driven',
      trigger: 'a copy of production data is made for a test environment',
      action: 'mask or replace every personal-data field before the copy leaves the production environment, so that 0 real names, e-mail addresses, phone numbers, addresses or payment details reach a test environment',
      rationale: 'Test environments are less protected than production; personal data in them is a breach waiting to happen (GDPR Articles 25 and 32: data protection by design, security of processing).',
      scenario: { label: 'Copy carries no personal data', given: 'a production snapshot', when: 'it is copied to a test environment', then: 'a scan of the copy finds 0 personal-data values, and the copy is refused otherwise' },
    },
    {
      id: 'req-e2e-pr', label: 'Journeys tested before merge', when: { E2E: ['pipeline'] }, ears_type: 'event-driven',
      trigger: 'a pull request is opened or updated',
      action: 'deploy it to an ephemeral environment, run the end-to-end tests of {{JOURNEYS}} there with 0 skipped, block the merge on a failure, and remove the environment when the pull request closes',
      rationale: 'A broken journey is cheapest to fix before the merge; an environment per pull request keeps changes from waiting for a shared one (Vocke, The Practical Test Pyramid: end-to-end tests).',
      scenario: { label: 'Broken journey blocks merge', given: 'a pull request that breaks one of: {{JOURNEYS}}', when: 'its ephemeral environment is tested', then: 'the journey fails and the pull request cannot be merged' },
    },
    {
      id: 'req-e2e-staging', label: 'Journeys gate promotion', when: { E2E: ['staging'] }, ears_type: 'event-driven',
      trigger: 'a build is merged to the main branch',
      action: 'deploy it to staging, run the end-to-end tests of {{JOURNEYS}} there with 0 skipped, and promote it to production only when all pass',
      rationale: 'One shared environment is cheaper than one per change; the gate keeps a broken journey out of production (Humble and Farley, Continuous Delivery: the deployment pipeline).',
      scenario: { label: 'Broken build not promoted', given: 'a merged build that breaks one of: {{JOURNEYS}}', when: 'it is tested on staging', then: 'it is not promoted to production and the team is told' },
    },
    {
      id: 'req-e2e-prod', label: 'Journeys checked in production', when: { E2E: ['production'] }, ears_type: 'event-driven',
      trigger: 'a release reaches production',
      action: 'run synthetic checks of {{JOURNEYS}} against it at once and every 5 minutes after, and roll the release back automatically when a check fails twice in a row',
      rationale: 'With many deploys a day, production is the only environment where every journey can be proved; fast rollback bounds the harm of what slipped through (Sridharan, Testing in Production).',
      scenario: { label: 'Failing journey rolls back', given: 'a release that breaks one of: {{JOURNEYS}}', when: 'the synthetic check fails twice in a row', then: 'the rollback webhook is called and the team is alerted' },
    },
    {
      id: 'req-quarantine', label: 'Flaky tests quarantined', when: { FLAKY: ['quarantine'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a test fails and then passes on the same commit',
      action: 'list it in quarantine.json with an owner and a ticket within 1 working day, where it runs but no longer blocks merges, and fix or delete it within {{QUARANTINE_DAYS}} days',
      rationale: 'A flaky test left in the gate teaches everyone to rerun until green; one left in quarantine forever is a deleted test nobody decided to delete (Fowler, Eradicating Non-Determinism in Tests: quarantine).',
      scenario: { label: 'Flaky test leaves the gate', given: 'a test that fails and then passes on the same commit', when: 'the nightly run reports it as flaky', then: 'the run fails until the test is in quarantine.json with an owner, and after {{QUARANTINE_DAYS}} days it is fixed or deleted' },
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
      decision: 'Tests follow the pyramid: most are unit tests of the domain logic under test/unit, run with Vitest without network or database (JUnit 5 on the JVM); integration tests under test/integration cover each adapter against the real dependency in a container (Testcontainers); a few end-to-end tests cover {{JOURNEYS}} (Playwright). Every pull request runs unit and integration tests within {{PIPELINE_MINUTES}} minutes. Gate: {{GATE}}, measured in the SonarQube quality gate on new code; mutation testing with Stryker (PIT on the JVM). Test data: {{DATA}}. End-to-end tests run in {{E2E}}. Flaky tests: {{FLAKY}}.',
      consequences: '• Fast, precise feedback: a failing unit test names the rule that broke.\n• Refactoring that changes internal interfaces rewrites many unit tests; test behaviour, not methods, to limit it.\n• Wiring bugs (configuration, queries, serialisation) are caught only by the thinner integration layer.\n• Requires code where the logic can be called without infrastructure.\n• The gate costs build time in proportion to what it proves: coverage is free, a mutation score adds minutes.\n• Where the end-to-end tests run decides what they can stop: before the merge, before production, or only after.',
      alternatives: '1. A testing trophy: mostly integration tests, better for glue code, slower feedback.\n2. An ice-cream cone of manual and end-to-end tests: slow, brittle and late; the shape to move away from.',
    },
    {
      id: 'adr-trophy', label: 'A testing trophy', when: { SHAPE: ['trophy'] },
      decision: 'Most tests are integration tests under test/integration that run the element through its public interface (HTTP or the UI component tree) with its real database and broker started by Testcontainers, faking only systems outside it (MSW or WireMock); static analysis (TypeScript strict, ESLint and SonarQube) and a few unit tests under test/unit for pure logic sit below; a few end-to-end tests cover {{JOURNEYS}} with Playwright. Every pull request runs them within {{PIPELINE_MINUTES}} minutes. Gate: {{GATE}}, in the SonarQube quality gate on new code. Test data: {{DATA}}. End-to-end tests run in {{E2E}}. Flaky tests: {{FLAKY}}. In-memory substitutes for the database (pg-mem, SQLite for PostgreSQL, H2) are not used.',
      consequences: '• Tests survive refactoring because they use the element as its callers do.\n• Wiring, queries and serialisation are tested for real.\n• Slower than unit tests: containers start once per run and tests must clean up; keeping the run under {{PIPELINE_MINUTES}} minutes needs parallel workers.\n• A failing test says which behaviour broke, not which line; debugging takes longer.\n• The gate costs build time in proportion to what it proves: coverage is free, a mutation score adds minutes.\n• Where the end-to-end tests run decides what they can stop: before the merge, before production, or only after.',
      alternatives: '1. A test pyramid: faster and more precise where there is real domain logic.\n2. In-memory database substitutes: faster, but they differ from the real engine exactly where bugs hide.',
    },
  ],
  fitness: [
    {
      id: 'ff-pr-time', label: 'Pull-request tests in time', category: 'process', implements: SHAPES, checks: ['req-pr-suite'],
      threshold: 'The pull-request test job finishes within {{PIPELINE_MINUTES}} minutes',
      description: 'The test job has a hard timeout of {{PIPELINE_MINUTES}} minutes, so a slow suite fails instead of quietly growing; it is listed among the checks the main branch requires, in the ruleset the Code review and branching pack keeps.',
      tool: 'GitHub Actions (timeout-minutes) with Vitest; for the JVM: the same job running ./gradlew test',
      language: 'yaml',
      snippet: `# .github/workflows/test.yml
name: test
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: {{PIPELINE_MINUTES}}
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
      - uses: actions/setup-node@v4.1.0   # pin by commit SHA in your repository
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npx vitest run --project unit --reporter=junit --outputFile=reports/unit.xml
      - run: npx vitest run --project integration --reporter=junit --outputFile=reports/integration.xml`,
    },
    {
      id: 'ff-coverage', label: 'Coverage of new code', category: 'process', implements: SHAPES, checks: ['req-coverage'],
      threshold: 'Coverage on new code at least {{COVERAGE}}%; the quality gate fails the pull request below it',
      description: 'The pipeline sends the coverage report to SonarQube and waits for the quality gate, whose condition "Coverage on New Code is less than {{COVERAGE}}%" is created once through the Web API, not in the properties file.',
      tool: 'SonarQube quality gate (sonar-scanner with sonar.qualitygate.wait, the condition through api/qualitygates/create_condition; SonarQube Cloud takes gateId and organization instead of gateName); for the JVM: the same with the JaCoCo report path',
      language: 'bash',
      snippet: `# sonar-project.properties, in the repository:
#   sonar.projectKey=shop-order-api
#   sonar.sources=src
#   sonar.tests=test
#   sonar.javascript.lcov.reportPaths=coverage/lcov.info
#   sonar.newCode.referenceBranch=main
#   sonar.qualitygate.wait=true
# the gate's condition, created once (SonarQube Server; needs the Administer Quality Gates permission):
curl -fsS -u "$SONAR_TOKEN:" -X POST "$SONAR_HOST_URL/api/qualitygates/create_condition" \\
  --data-urlencode "gateName=Shop" --data-urlencode "metric=new_coverage" \\
  --data-urlencode "op=LT" --data-urlencode "error={{COVERAGE}}"`,
    },
    {
      id: 'ff-mutation', label: 'Mutation score on changed files', when: { GATE: ['mutation'] }, category: 'process', implements: SHAPES, checks: ['req-mutation'],
      threshold: 'Mutation score on the files the pull request changes at least {{MUTATION}}%; the build breaks below it',
      description: 'Stryker runs incrementally over the source files the pull request changes (the mutate globs come from git diff) and breaks the build when the score falls below the threshold. On the JVM, PIT with mutationThreshold and the git-based scm goal does the same.',
      tool: 'Stryker Mutator (@stryker-mutator/vitest-runner); for the JVM: PIT with pitest-maven\'s scmMutationCoverage goal',
      language: 'bash',
      snippet: `# stryker.config.json, in the repository:
#   { "testRunner": "vitest", "incremental": true, "reporters": ["clear-text", "html", "json"],
#     "thresholds": { "high": 85, "low": 75, "break": {{MUTATION}} } }
changed=$(git diff --name-only origin/main...HEAD -- 'src/**/*.ts' | grep -v '\\.test\\.ts$' | paste -sd, -)
[ -z "$changed" ] || npx stryker run --mutate "$changed"`,
    },
    {
      id: 'ff-unit-isolated', label: 'Unit tests stay isolated and few are end-to-end', when: { SHAPE: ['pyramid'] }, category: 'structural', implements: ['adr-pyramid'], checks: ['req-pyramid'],
      threshold: '0 unit tests reach the network or run over 100 ms; unit tests at least 70% and end-to-end tests at most 10% of all tests',
      description: 'The unit-test project disables network connections in its setup, so a unit test that reaches a server fails; a step in CI reads the JUnit reports, counts tests per suite and fails when the shares are off or a unit test took more than 100 ms.',
      tool: 'Vitest with nock 14 or later (which intercepts native fetch too) and xmllint over the JUnit reports; for the JVM: JUnit 5 with a SecurityManager-free network block through a test ArchUnit rule and the same report arithmetic',
      language: 'ts',
      snippet: `// test/unit/setup.ts (vitest.config.ts: test.setupFiles of the unit project)
import nock from 'nock'
import { afterAll, beforeAll } from 'vitest'

beforeAll(() => nock.disableNetConnect())   // any real HTTP call throws
afterAll(() => nock.enableNetConnect())

// CI, from the JUnit reports reports/unit.xml, reports/integration.xml, reports/e2e.xml:
//   count() { xmllint --xpath 'string(sum(//testsuite/@tests))' "$1"; }
//   unit=$(count reports/unit.xml); e2e=$(count reports/e2e.xml); all=$((unit + $(count reports/integration.xml) + e2e))
//   [ $((unit * 100 / all)) -ge 70 ] && [ $((e2e * 100 / all)) -le 10 ]
//   [ "$(xmllint --xpath 'count(//testcase[@time > 0.1])' reports/unit.xml)" = 0 ]   # no unit test over 100 ms`,
    },
    {
      id: 'ff-no-fakes', label: 'No in-memory database', when: { SHAPE: ['trophy'] }, category: 'structural', implements: ['adr-trophy'], checks: ['req-trophy'],
      threshold: '0 test or test-helper files import an in-memory database substitute',
      description: 'A dependency rule fails the build when a file under test or src imports an in-memory substitute for the database (helpers included, not only the test files); the integration tests use Testcontainers with the production engine and version.',
      tool: 'dependency-cruiser; for the JVM: an ArchUnit rule forbidding org.h2 in test classes',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'no-in-memory-database',
    comment: 'ADR Testing trophy: integration tests use the real engine (Testcontainers)',
    severity: 'error',
    from: { path: '^(test|src)/' },
    to: { path: '^node_modules/(pg-mem|sqlite3|better-sqlite3|mongodb-memory-server)/' },
  }],
  options: { tsConfig: { fileName: 'tsconfig.json' } },
}`,
    },
    {
      id: 'ff-integration-share', label: 'Integration tests carry the suite', when: { SHAPE: ['trophy'] }, category: 'structural', implements: ['adr-trophy'], checks: ['req-trophy'],
      threshold: 'Integration tests at least 50% of all tests',
      description: 'A step in CI reads the JUnit reports of the unit, integration and end-to-end runs, counts the tests per suite and fails when integration tests are below half of the total.',
      tool: 'xmllint over the JUnit reports in a shell step; for the JVM: the same over the surefire and failsafe reports',
      language: 'bash',
      snippet: `set -euo pipefail
count() { xmllint --xpath 'string(sum(//testsuite/@tests))' "$1"; }
integration=$(count reports/integration.xml)
all=$(( $(count reports/unit.xml) + integration + $(count reports/e2e.xml) ))
echo "integration tests: $integration of $all"
[ $((integration * 100 / all)) -ge 50 ] || { echo "integration tests are below half of the suite (ADR A testing trophy)"; exit 1; }`,
    },
    {
      id: 'ff-shuffle', label: 'Tests pass in any order', when: { DATA: ['synthetic', 'fixtures'] }, category: 'process', implements: SHAPES, checks: ['req-own-data', 'req-fixtures'],
      threshold: 'The suite passes in 3 consecutive runs with random order and parallel workers',
      description: 'A nightly job runs the suite three times with shuffled order and a different seed each time; a failure prints the seed, so the order can be reproduced.',
      tool: 'Vitest (sequence.shuffle); for the JVM: JUnit 5 with junit.jupiter.testmethod.order.default set to MethodOrderer$Random; for Python: pytest-randomly',
      language: 'ts',
      snippet: `// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    sequence: { shuffle: true },  // files and tests in random order
    pool: 'threads',
  },
})
// nightly: for run in 1 2 3; do npx vitest run --sequence.seed=$RANDOM || exit 1; done`,
    },
    {
      id: 'ff-seed-loads', label: 'Seed loads on a fresh database', when: { DATA: ['fixtures'] }, category: 'structural', implements: SHAPES, checks: ['req-fixtures'],
      threshold: 'Every test run starts from a fresh database with the current migrations and the seed under test/seed loaded without error',
      description: 'Vitest\'s global setup starts PostgreSQL in a container, runs the migrations and loads every seed file; a seed that no longer fits the schema fails the setup and with it the run, so the seed cannot drift from the migrations.',
      tool: 'Vitest globalSetup with Testcontainers (@testcontainers/postgresql) and pg; for the JVM: a Testcontainers JDBC URL with an init script',
      language: 'ts',
      snippet: `// test/globalSetup.ts (vitest.config.ts: test.globalSetup) — a fresh, migrated database with the seed loaded, for every run
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import pg from 'pg'

let container: StartedPostgreSqlContainer

export async function setup() {
  container = await new PostgreSqlContainer('postgres:17').start()
  process.env.DATABASE_URL = container.getConnectionUri()
  execFileSync('npm', ['run', 'migrate'], { stdio: 'inherit', env: process.env })   // the current migrations
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  for (const file of readdirSync('test/seed').filter((f) => f.endsWith('.sql')).sort())
    await client.query(readFileSync(\`test/seed/\${file}\`, 'utf8'))   // the seed, changed only through reviewed pull requests
  await client.end()
}

export async function teardown() {
  await container.stop()
}`,
    },
    {
      id: 'ff-pii-scan', label: 'Test copies hold no personal data', when: { DATA: ['masked'] }, category: 'operational', implements: SHAPES, checks: ['req-masking'],
      threshold: '0 personal-data findings in a sample of 10,000 rows per table of each copy; a copy with findings is not released to test environments',
      description: 'Before a masked copy is released, a job samples every text column and runs Presidio\'s analyzer over it; any finding stops the release of the copy.',
      tool: 'Microsoft Presidio (presidio-analyzer) in a Python job of the copy pipeline',
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
      id: 'ff-journeys-covered', label: 'Every journey has a test', category: 'structural', implements: SHAPES, checks: ['req-e2e-pr', 'req-e2e-staging', 'req-e2e-prod'],
      threshold: '100% of the journeys {{JOURNEYS}} have a Playwright spec under e2e',
      description: 'A test lists the journeys the decision names and expects a spec file e2e/<journey>.spec.ts for each (spaces in a journey\'s name become dashes); a journey without a spec fails the test, so the list and the suite cannot drift apart.',
      tool: 'Vitest over the e2e directory; for the JVM: the same test with JUnit 5 over src/e2e',
      language: 'ts',
      snippet: `import { existsSync } from 'node:fs'
import { expect, it } from 'vitest'

const JOURNEYS = '{{JOURNEYS}}'.split(/,\\s*/).map((j) => j.trim().toLowerCase().replace(/\\s+/g, '-'))

it.each(JOURNEYS)('journey %s has an end-to-end spec', (journey) => {
  expect(existsSync(\`e2e/\${journey}.spec.ts\`), \`e2e/\${journey}.spec.ts is missing\`).toBe(true)
})`,
    },
    {
      id: 'ff-e2e-gate', label: 'Journeys gate the release', when: { E2E: ['pipeline', 'staging'] }, category: 'process', implements: SHAPES, checks: ['req-e2e-pr', 'req-e2e-staging'],
      threshold: 'All end-to-end tests pass before the build is merged or promoted, with 0 skipped',
      description: 'Playwright runs the journeys against the environment the pipeline deployed (an ephemeral one per pull request, or staging after the merge) with no retries and no test.only; a CI step reads the JUnit report and fails on a skipped test. The job is a required check for the merge, or the gate of the promotion.',
      tool: 'Playwright (junit reporter) with xmllint in a shell step; for the JVM: Playwright for Java with the same report',
      language: 'ts',
      snippet: `// playwright.config.ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,                       // no test.only left in the gate
  retries: 0,
  reporter: [['junit', { outputFile: 'reports/e2e.xml' }]],
  use: { baseURL: process.env.E2E_BASE_URL, trace: 'retain-on-failure' },
})
// CI, after npx playwright test:
//   [ "$(xmllint --xpath 'string(//testsuites/@skipped)' reports/e2e.xml)" = 0 ] || { echo "skipped end-to-end tests"; exit 1; }`,
    },
    {
      id: 'ff-synthetic', label: 'Journeys checked in production', when: { E2E: ['production'] }, category: 'operational', implements: SHAPES, checks: ['req-e2e-prod'],
      threshold: 'Each journey runs after every deploy and every 5 minutes from 2 locations; 2 failed runs in a row call the rollback webhook',
      description: 'The Playwright journeys run as Checkly browser checks, one per journey, every 5 minutes from two locations; the escalation policy alerts after two failed runs in a row and the alert channel is a webhook on the deployment pipeline that rolls the release back. The deploy job deploys the checks and triggers them against the new release at once.',
      tool: 'Checkly CLI (checkly/constructs; npx checkly deploy and npx checkly trigger in the deploy job)',
      language: 'ts',
      snippet: `// checkly/checkout.check.ts — one BrowserCheck per journey of: {{JOURNEYS}}
import { AlertEscalationBuilder, BrowserCheck, Frequency, WebhookAlertChannel } from 'checkly/constructs'

const rollback = new WebhookAlertChannel('rollback-webhook', {
  name: 'Roll back the release',
  url: process.env.ROLLBACK_WEBHOOK_URL!,   // the deployment pipeline's rollback endpoint
  method: 'POST',
})

new BrowserCheck('checkout-journey', {
  name: 'Checkout journey',
  frequency: Frequency.EVERY_5M,
  locations: ['eu-west-1', 'eu-central-1'],
  code: { entrypoint: '../e2e/checkout.spec.ts' },
  alertChannels: [rollback],
  alertEscalationPolicy: AlertEscalationBuilder.runBasedEscalation(2),   // two failed runs in a row alert, and the webhook rolls back
})
// deploy job, after the deploy:  npx checkly deploy && npx checkly trigger   (runs the checks against the new release at once)`,
    },
    {
      id: 'ff-flaky-report', label: 'Flaky tests enter quarantine', when: { FLAKY: ['quarantine'] }, category: 'process', implements: SHAPES, checks: ['req-quarantine'],
      threshold: '0 tests that passed only on retry in the nightly run without an entry in quarantine.json',
      description: 'The nightly run retries a failed test once, only to tell a flake from a failure; a reporter lists the tests that passed on retry in reports/flaky.json and fails the run for any that is not yet in quarantine.json, so a flake is entered within a day or the nightly stays red. The gate itself skips the tests tagged @quarantine.',
      tool: 'Vitest (retry: 1 with a custom reporter reading each test\'s diagnostic().flaky); for the JVM: Gradle\'s test-retry plugin with failOnPassedAfterRetry off and its flaky report',
      language: 'ts',
      snippet: `// test/flakyReporter.ts (nightly vitest.config.ts: test.retry = 1, test.reporters = ['default', new FlakyReporter()])
import { writeFileSync } from 'node:fs'
import type { Reporter, TestModule } from 'vitest/node'
import quarantine from '../quarantine.json'   // [{ "test": "...", "owner": "...", "ticket": "...", "since": "2026-10-01" }]

export class FlakyReporter implements Reporter {
  onTestRunEnd(modules: ReadonlyArray<TestModule>) {
    const flaky = modules.flatMap((m) => [...m.children.allTests()]).filter((t) => t.diagnostic()?.flaky).map((t) => t.fullName)
    writeFileSync('reports/flaky.json', JSON.stringify(flaky, null, 2))
    const unquarantined = flaky.filter((name) => !quarantine.some((q) => q.test === name))
    if (unquarantined.length) {
      console.error('flaky tests not yet in quarantine (list them within 1 working day):\\n' + unquarantined.join('\\n'))
      process.exitCode = 1
    }
  }
}`,
    },
    {
      id: 'ff-quarantine', label: 'Quarantine is emptied', when: { FLAKY: ['quarantine'] }, category: 'process', implements: SHAPES, checks: ['req-quarantine'],
      threshold: '0 tests in quarantine for more than {{QUARANTINE_DAYS}} days; every entry has an owner and a ticket',
      description: 'Quarantined tests are listed in quarantine.json and tagged @quarantine, which the gate skips and a separate non-blocking job runs. A test over the list fails the build when an entry is older than the deadline or has no owner or ticket.',
      tool: 'Vitest (a test over quarantine.json); for the JVM: the same test with JUnit 5 over the file',
      language: 'ts',
      snippet: `import { expect, it } from 'vitest'
import quarantine from '../quarantine.json'   // [{ "test": "...", "owner": "...", "ticket": "...", "since": "2026-10-01" }]

const MAX_DAYS = {{QUARANTINE_DAYS}}

it('no test stays in quarantine past the deadline', () => {
  const overdue = quarantine.filter((q) =>
    !q.owner || !q.ticket || (Date.now() - Date.parse(q.since)) / 86_400_000 > MAX_DAYS)
  expect(overdue).toEqual([])
})`,
    },
    {
      id: 'ff-flaky-fails', label: 'Flaky tests fail the build', when: { FLAKY: ['zero'] }, category: 'process', implements: SHAPES, checks: ['req-no-retry'],
      threshold: '0 tests that pass only on retry; such a test fails the build',
      description: 'The run retries a failed test once, only to tell a flake from a real failure; a reporter fails the build when any test passed on retry and names it as flaky.',
      tool: 'Vitest (retry: 1 with a custom reporter reading each test\'s diagnostic().flaky); for the JVM: Gradle\'s test-retry plugin with failOnPassedAfterRetry',
      language: 'ts',
      snippet: `// test/flakyReporter.ts (vitest.config.ts: test.retry = 1, test.reporters = ['default', new FlakyReporter()])
import type { Reporter, TestModule } from 'vitest/node'

export class FlakyReporter implements Reporter {
  onTestRunEnd(modules: ReadonlyArray<TestModule>) {
    const flaky = modules.flatMap((m) => [...m.children.allTests()]).filter((t) => t.diagnostic()?.flaky).map((t) => t.fullName)
    if (flaky.length) {
      console.error('flaky tests (passed only on retry); fix or delete them before merging anything else:\\n' + flaky.join('\\n'))
      process.exitCode = 1
    }
  }
}`,
    },
  ],
}

export default pack
