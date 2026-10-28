import type { PackSpec } from '../../src/packSpec'

const GATES = ['adr-linter', 'adr-sonar', 'adr-format-only']
const FORCES = 'Code lives in this element and is changed by several people, soon by people who did not write it; what a change must pass before it is merged, beyond its tests, decides whether the code stays readable or decays one pull request at a time. The forces: review time is the scarcest resource and arguing about formatting and obvious mistakes wastes it, while a machine finds those in seconds; a rule that is not enforced is a wish, and a rule that blocks on old code nobody is touching teaches people to switch it off; strict types and complexity limits catch defects early but cost effort on code that was written without them; a baseline that is never lowered becomes permanent; and every check added to the pull request makes the feedback slower, so the whole gate has to finish in minutes. Tests, coverage and mutation score are decided by the Test strategy concern, not here.'

const pack: PackSpec = {
  id: 'concern-code-quality-gate',
  name: 'Code quality gate',
  group: 'maintainability',
  description: 'What a change must pass before it is merged, beyond the tests: which static analysis is enforced, how strict the types are, whether size and complexity are limited, how new findings are treated against the old ones, and what happens to duplicated code.',
  tags: ['maintainability', 'static analysis', 'linting', 'quality gate', 'complexity', 'technical debt', 'type safety'],
  concern: {
    id: 'code-quality-gate',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements, so what a change must pass before it is merged, beyond the tests, has to be decided.',
  },
  sources: [
    { title: 'SonarSource: Clean as You Code', url: 'https://docs.sonarsource.com/sonarqube-server/latest/core-concepts/clean-as-you-code/introduction/' },
    { title: 'Google Engineering Practices: The Code Reviewer\'s Guide', url: 'https://google.github.io/eng-practices/review/reviewer/' },
    { title: 'Google Engineering Practices: Small CLs', url: 'https://google.github.io/eng-practices/review/developer/small-cls.html' },
    { title: 'Martin Fowler: Continuous Integration', url: 'https://martinfowler.com/articles/continuousIntegration.html' },
    { title: 'Watson, McCabe: Structured Testing, NIST Special Publication 500-235 (cyclomatic complexity)', url: 'https://www.mccabe.com/pdf/mccabe-nist235r.pdf' },
    { title: 'ISO/IEC 25010, Maintainability: modularity, analysability, modifiability', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
    { title: 'ESLint: Configuration Files (flat config)', url: 'https://eslint.org/docs/latest/use/configure/configuration-files' },
    { title: 'Ruff: An extremely fast Python linter and code formatter', url: 'https://docs.astral.sh/ruff/' },
    { title: 'Forsgren, Humble, Kim: Accelerate', url: 'https://itrevolution.com/product/accelerate/' },
  ],
  questions: [
    {
      key: 'STATIC', title: 'Static analysis', label: 'Which static analysis is enforced before a merge?',
      hint: 'This decides who finds the obvious mistakes: a linter in the build, a platform with a gate on new code, or nobody but the reviewer. It also decides what the rest of the gate can hang on.',
      default: 'linter',
      options: [
        { value: 'linter', label: 'a linter and a formatter in CI', description: 'A linter (ESLint or Biome, ruff, golangci-lint, detekt) with a recommended rule set and a formatter (Prettier or Biome, ruff format or Black, gofmt) run on every pull request and fail it on an error; the same versions run locally on commit. Pick it as the default for any codebase with more than one contributor.' },
        { value: 'sonar', label: 'a code-analysis platform with a gate on new code', description: 'SonarQube or SonarCloud analyses every pull request and its quality gate ("Clean as You Code") fails the build when new code brings a bug, a vulnerability, a security hotspot left unreviewed or a maintainability rating below A; the linter and formatter still run locally and in CI for fast feedback. Pick it when several teams or many repositories need one standard with a dashboard, or when a regulator or customer asks for evidence.' },
        { value: 'format-only', label: 'only a formatter', description: 'A formatter is enforced in CI and on commit; no lint rules, no analysis platform. Pick it for prototypes, scripts and tools under 5,000 lines with one or two owners, where review covers what a linter would; the decision records when to revisit it.' },
      ],
    },
    {
      key: 'TYPES', title: 'Types', label: 'How strict are the types?',
      hint: 'A type checker is the cheapest reviewer there is, but turning it to strict on an old codebase produces thousands of errors at once. Dynamic languages have the same choice with mypy, Sorbet or Psalm.',
      default: 'strict',
      options: [
        { value: 'strict', label: 'strict everywhere', description: 'The strictest mode of the checker is on for the whole element: TypeScript strict with noImplicitAny and noUncheckedIndexedAccess, mypy --strict, C# nullable enabled with warnings as errors, Kotlin explicit API. Pick it for a new codebase or one that is already close to it.' },
        { value: 'ratchet', label: 'raised file by file with a baseline', description: 'Strict mode is on for new files and for a growing list of old ones; files not yet strict are listed in a baseline that may only shrink (typescript-strict-plugin, mypy per-module overrides, a #nullable enable per file). Pick it for an existing codebase where strict everywhere would be a months-long stop.' },
        { value: 'loose', label: 'types only where they pay', description: 'Dynamic typing, with type annotations required only on the public functions of a module (parameters and return values) and checked there. Pick it for scripts, notebooks and glue code, or a language without a mature checker.' },
      ],
    },
    {
      key: 'COMPLEXITY', title: 'Complexity', label: 'Are size and complexity limited?',
      hint: 'A function with a cyclomatic complexity over 10 needs more than 10 test paths and is where defects cluster; a limit enforced by the linter keeps it from being written, a number shown in review only keeps it visible.',
      default: 'limits',
      options: [
        { value: 'limits', label: 'enforced limits', description: 'Cyclomatic complexity per function (10 by default), function length (50 lines), file length (400 lines) and nesting (4 levels) are lint errors that block the merge; old code over the limit is baselined per the debt rule. Pick it for code that will be maintained for years by people other than its authors.' },
        { value: 'advisory', label: 'measured and shown, not blocking', description: 'The same measures are computed on every pull request and shown as annotations and a trend, but do not block. Pick it for the first months on a codebase where most functions are already over the limit, with the intent to turn the limits on later.' },
        { value: 'none', label: 'no limits', description: 'Size and complexity are left to review. Pick it only for small, short-lived code with one owner.' },
      ],
    },
    {
      key: 'DEBT', title: 'Findings', label: 'How are new findings treated against the old ones?',
      hint: 'On an existing codebase the first run of a linter reports thousands of findings; what the gate does with the old ones decides whether the new rules are kept or switched off within a week.',
      default: 'zero-new',
      options: [
        { value: 'zero-new', label: 'no new findings', description: 'A change may bring no new finding in the lines it adds or changes; findings in untouched old code are baselined and reported but do not block. Pick it as the default for any codebase with history: the code gets cleaner where it is being changed, which is where it matters.' },
        { value: 'ratchet', label: 'a count that may only go down', description: 'The total number of findings is kept in a committed baseline; a pull request that raises it fails, and one that lowers it lowers the baseline. Pick it when the tooling cannot tell new lines from old (a custom check, a language without a Sonar or reviewdog integration), or when the team wants the debt visibly shrinking.' },
        { value: 'fix-all', label: 'every finding fixed before merge', description: 'No baseline: the whole element has zero findings on the main branch, and a change with one cannot merge. Pick it for a new codebase, or after a one-time clean-up; it is the only option that keeps the rule set from drifting into a list of exceptions.' },
      ],
    },
    {
      key: 'DUPLICATION', title: 'Duplication', label: 'What happens to duplicated code?',
      hint: 'Copied code is the most common way a fix is applied in one place and missed in the others; the question is whether the gate stops it or only shows it.',
      default: 'report',
      options: [
        { value: 'block', label: 'blocked above a threshold', description: 'Duplicated lines in new code above a threshold (3% by default) fail the pull request (jscpd or the Sonar duplication condition). Pick it when the element has a history of copy-paste fixes, or when it holds business rules that must exist once.' },
        { value: 'report', label: 'reported in the pull request', description: 'Duplication is measured on every pull request and shown as a comment or annotation, and the reviewer decides. Pick it as the default: some duplication is better than a wrong abstraction, and the reviewer can tell the two apart.' },
      ],
    },
  ],
  details: [
    { key: 'LINT_MINUTES', label: 'Within how many minutes must the static checks of a pull request finish?', default: '5', number: true },
    { key: 'MAX_COMPLEXITY', label: 'What is the highest cyclomatic complexity allowed per function?', default: '10', number: true },
    { key: 'MAX_FUNCTION_LINES', label: 'How many lines may a function have at most?', default: '50', number: true },
    { key: 'MAX_FILE_LINES', label: 'How many lines may a file have at most?', default: '400', number: true },
    { key: 'DUPLICATION_PCT', label: 'What share of duplicated lines in new code is allowed (%)?', default: '3', number: true },
  ],
  need: {
    label: 'Code stays readable as it changes',
    text: 'The element is changed by several people and will be maintained by people who did not write it. Every change must leave the code at least as readable, typed and small as it found it, and the obvious mistakes (an unused variable, a wrong null check, a 300-line function, a copied block) must be found by a machine in minutes, so that review time goes to design and correctness. A rule that is not enforced is not a rule; one that blocks on code nobody is touching gets switched off.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-gate-on-pr', label: 'Static checks on every change', ears_type: 'event-driven',
      trigger: 'a pull request is opened or updated',
      action: 'run the static checks of this decision within {{LINT_MINUTES}} minutes as a required status check, and block the merge on any error',
      rationale: 'A check that runs after the merge, or that people can skip, does not change what is merged; one that takes longer than a few minutes is not waited for (Fowler, Continuous Integration: every commit builds on an integration machine, keep the build fast).',
      scenario: { label: 'Finding blocks the merge', given: 'a pull request whose change brings a lint error', when: 'it is pushed', then: 'the check reports the error within {{LINT_MINUTES}} minutes and the pull request cannot be merged' },
    },
    {
      id: 'req-formatted', label: 'Code is formatted by the formatter', ears_type: 'ubiquitous',
      action: 'keep every source file exactly as the formatter prints it, with the formatter run on staged files at commit and its check run in CI, so that 0 lines of a pull request differ from the formatter\'s output',
      rationale: 'Formatting is the cheapest thing to automate and the most expensive thing to argue about in review; a formatter with no options ends the argument (Google, The Code Reviewer\'s Guide: style guide is the absolute authority, formatting comments are not needed).',
      scenario: { label: 'Unformatted change refused', given: 'a pull request with a file the formatter would change', when: 'the CI check runs', then: 'it fails naming the file, and the same file is reformatted by the pre-commit hook on the next commit' },
    },
    {
      id: 'req-lint-rules', label: 'Lint rules enforced as errors', when: { STATIC: ['linter'] }, ears_type: 'ubiquitous',
      action: 'run the linter with its recommended rule set plus the type-aware rules of the stack, every rule at error severity, with an unused disable comment itself an error and a file-wide disable allowed only with a comment naming the reason',
      rationale: 'A rule at warning severity is noise within a month; a disable comment without a reason is a rule removed in silence (ESLint docs: linter-options.reportUnusedDisableDirectives; ISO 25010 analysability).',
      scenario: { label: 'Warnings are errors', given: 'the linter configuration', when: 'a rule fires in a changed file and a disable comment covers nothing', then: 'both fail the check, and no rule is configured at warning severity' },
    },
    {
      id: 'req-sonar-gate', label: 'Quality gate on new code', when: { STATIC: ['sonar'] }, ears_type: 'event-driven',
      trigger: 'a pull request is analysed',
      action: 'fail the pipeline unless the quality gate on new code holds: 0 new bugs, 0 new vulnerabilities, 100% of new security hotspots reviewed, maintainability rating A on new code, with new code defined against the main branch',
      rationale: 'A gate on new code is one every pull request can pass, so it stays on; a gate on the whole codebase is failed from day one and ignored (SonarSource, Clean as You Code).',
      scenario: { label: 'New bug fails the gate', given: 'a pull request adding a function with a bug the analyser detects', when: 'the analysis runs', then: 'the quality gate fails on new code, the pipeline waits for it and fails, and the merge is blocked' },
    },
    {
      id: 'req-format-only-revisit', label: 'Formatter only, until the element grows', when: { STATIC: ['format-only'] }, ears_type: 'event-driven',
      trigger: 'the element passes 5,000 source lines or gains a third regular contributor',
      action: 'revisit this decision and introduce a linter with a recommended rule set through a new decision within one month',
      rationale: 'The case for no lint rules is a small codebase that review can hold in its head; past that size the obvious mistakes slip through, and the decision says so before it happens (Google, Small CLs; ISO 25010 analysability).',
      scenario: { label: 'Growth triggers a linter', given: 'an element with only a formatter enforced', when: 'a monthly count shows 5,000 source lines or three regular contributors', then: 'an issue to introduce a linter is opened with this decision linked, and a new decision supersedes it within one month' },
    },
    {
      id: 'req-strict-types', label: 'Strict types everywhere', when: { TYPES: ['strict'] }, ears_type: 'ubiquitous',
      action: 'type-check the whole element in the checker\'s strict mode (TypeScript strict with noImplicitAny and noUncheckedIndexedAccess, mypy --strict, nullable enabled with warnings as errors) on every pull request, with 0 type errors and 0 suppression comments (@ts-ignore, type: ignore, #pragma warning disable) without an issue id',
      rationale: 'Strict typing moves a class of defects from production to the editor at no runtime cost, and a suppression without a reason is a type error nobody will revisit (ISO 25010 analysability; Accelerate: shift left on quality).',
      scenario: { label: 'Implicit any refused', given: 'a pull request adding a parameter without a type', when: 'the type check runs', then: 'it fails with noImplicitAny, and adding @ts-ignore without an issue id fails the lint check as well' },
    },
    {
      id: 'req-type-ratchet', label: 'Strictness only goes up', when: { TYPES: ['ratchet'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request adds a file to the non-strict baseline, or a file in the baseline passes strict checking and is not removed from it',
      action: 'fail the check, and require new files to be strict from their first commit',
      rationale: 'Raising strictness file by file is the only way through an old codebase without stopping delivery, and it works only if the list of exceptions can never grow (Accelerate: work in small batches; SonarSource, Clean as You Code applied to types).',
      scenario: { label: 'Baseline cannot grow', given: 'a baseline of non-strict files', when: 'a pull request adds a new file to it, and another makes a listed file pass strict checking', then: 'the first fails the check, and the second fails until the file is removed from the baseline' },
    },
    {
      id: 'req-boundary-types', label: 'Types at module boundaries', when: { TYPES: ['loose'] }, ears_type: 'ubiquitous',
      action: 'declare the types of the parameters and return values of every exported or public function, check them on every pull request, and leave the rest of the code untyped',
      rationale: 'Types pay most where a caller cannot see the implementation; inside a module the reader has the code (ISO 25010 modularity, analysability).',
      scenario: { label: 'Untyped export refused', given: 'a pull request exporting a function without parameter types', when: 'the check runs', then: 'it fails on the export, while an untyped local helper in the same file passes' },
    },
    {
      id: 'req-complexity-limits', label: 'Size and complexity limited', when: { COMPLEXITY: ['limits'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a changed function has a cyclomatic complexity above {{MAX_COMPLEXITY}} or more than {{MAX_FUNCTION_LINES}} lines, nests deeper than 4 levels, or a changed file has more than {{MAX_FILE_LINES}} lines',
      action: 'report it as an error and block the merge, with functions over the limit before this decision baselined per the findings rule',
      rationale: 'Cyclomatic complexity above 10 means more than 10 independent paths to test and is where defects cluster; function and file length limit what a reader has to hold at once (McCabe, NIST 500-235, the limit of 10; ISO 25010 modularity).',
      scenario: { label: 'Complex function refused', given: 'a pull request adding a function with cyclomatic complexity {{MAX_COMPLEXITY}} plus 1', when: 'the lint check runs', then: 'it fails naming the function and its complexity, and the merge is blocked' },
    },
    {
      id: 'req-complexity-shown', label: 'Complexity shown in review', when: { COMPLEXITY: ['advisory'] }, ears_type: 'event-driven',
      trigger: 'a pull request is opened or updated',
      action: 'compute cyclomatic complexity and length for every changed function and annotate in the pull request each one above {{MAX_COMPLEXITY}} or {{MAX_FUNCTION_LINES}} lines, without blocking the merge',
      rationale: 'What is shown in review gets discussed; a number nobody sees is a limit nobody keeps (McCabe, NIST 500-235; Google, The Code Reviewer\'s Guide: complexity).',
      scenario: { label: 'Complex function annotated', given: 'a pull request changing a function with complexity {{MAX_COMPLEXITY}} plus 5', when: 'the check runs', then: 'the function is annotated with its complexity in the pull request and the check passes' },
    },
    {
      id: 'req-zero-new', label: 'No new findings in changed lines', when: { DEBT: ['zero-new'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a finding of any enabled rule lies on a line the pull request added or changed',
      action: 'fail the check, while findings on untouched lines are reported in the pull request but do not block',
      rationale: 'Fixing the code where it is being changed is where clean-up pays; blocking on old code nobody is touching gets the rules switched off (SonarSource, Clean as You Code: focus on new code).',
      scenario: { label: 'Old finding does not block', given: 'a file with an old finding and a pull request that changes another line of it cleanly', when: 'the check runs', then: 'it passes and the old finding is shown; a second pull request adding a finding on a changed line fails' },
    },
    {
      id: 'req-ratchet', label: 'Findings only go down', when: { DEBT: ['ratchet'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the number of findings after a change is higher than the committed baseline',
      action: 'fail the check; when the number is lower, lower the baseline in the same pull request',
      rationale: 'A count that can only fall makes the debt visible and shrinking, and needs no tool that tells new lines from old (Accelerate: visibility of work; Fowler, Continuous Integration: fix broken builds immediately).',
      scenario: { label: 'Count above baseline refused', given: 'a committed baseline of 120 findings', when: 'a pull request leaves 121, and another leaves 110 without touching the baseline', then: 'the first fails on the count, the second fails until the baseline is set to 110' },
    },
    {
      id: 'req-fix-all', label: 'Zero findings, no baseline', when: { DEBT: ['fix-all'] }, ears_type: 'ubiquitous',
      action: 'keep 0 findings of every enabled rule on the main branch, with no baseline file and no finding suppressed without a comment naming the reason, and fail any pull request with a finding',
      rationale: 'Zero is the only count that needs no explanation and cannot drift; it is affordable on a new or freshly cleaned codebase and costly afterwards (Fowler, Continuous Integration; Google, Small CLs).',
      scenario: { label: 'Any finding refused', given: 'the main branch with 0 findings', when: 'a pull request adds one finding anywhere', then: 'the check fails and the repository holds no baseline file' },
    },
    {
      id: 'req-duplication', label: 'Duplication blocked', when: { DUPLICATION: ['block'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'more than {{DUPLICATION_PCT}}% of the lines a pull request adds duplicate a block of 10 or more lines elsewhere in the element',
      action: 'fail the check, naming both copies',
      rationale: 'A fix applied to one copy and missed in the other is the most common way duplicated code fails; the gate names the second copy while it is still cheap to remove (ISO 25010 modifiability; SonarSource, duplicated lines on new code).',
      scenario: { label: 'Copied block refused', given: 'a pull request that pastes a 12-line block already present in another file', when: 'the check runs', then: 'it fails naming both locations, and the merge is blocked' },
    },
  ],
  adrs: [
    {
      id: 'adr-linter', label: 'A linter and a formatter gate every change', when: { STATIC: ['linter'] },
      decision: 'Every pull request runs the stack\'s linter and formatter as a required check within {{LINT_MINUTES}} minutes: ESLint (flat config, eslint:recommended plus typescript-eslint recommended-type-checked) with Prettier, or Biome for both, on TypeScript; ruff check and ruff format on Python; golangci-lint and gofmt on Go; detekt and ktlint on Kotlin. Every rule is an error; unused disable comments are errors; a file-wide disable needs a comment naming the reason. The same versions run on staged files at commit through husky and lint-staged (or pre-commit on Python). Types: {{TYPES}}. Size and complexity: {{COMPLEXITY}}. New findings: {{DEBT}}. Duplicated code: {{DUPLICATION}}. Tests and coverage follow the Test strategy decision.',
      consequences: '• Obvious mistakes and formatting never reach review; reviewers read for design and correctness.\n• Feedback in seconds locally and in minutes in CI, with no service to run.\n• Rule sets drift unless someone owns them; the recommended set is upgraded with the tool, and each upgrade is a pull request of its own.\n• No history or dashboard across repositories; a team that wants one needs the platform variant.\n• Type-aware ESLint rules need the TypeScript program and are the slowest part; keeping under {{LINT_MINUTES}} minutes needs a cache (eslint --cache) on a large element.',
      alternatives: '1. A code-analysis platform (SonarQube) with a gate on new code: cross-repository view and evidence, but a service to run or pay for and a slower loop.\n2. Only a formatter: nothing to maintain, but every mistake a linter finds is left to the reviewer.\n3. Lint rules at warning severity: easier to adopt, but warnings are ignored within a month and the rule set becomes noise.',
    },
    {
      id: 'adr-sonar', label: 'A code-analysis platform gates new code', when: { STATIC: ['sonar'] },
      decision: 'Every pull request is analysed by SonarQube Server (or SonarCloud) and the pipeline waits for its quality gate (sonar.qualitygate.wait=true); the gate holds conditions on new code only, with new code defined against the main branch: 0 new bugs, 0 new vulnerabilities, 100% of new security hotspots reviewed, maintainability rating A, and the duplication condition where duplication is blocked. The stack\'s linter and formatter (ESLint with Prettier, ruff, golangci-lint) still run locally on commit and as a first CI step, because the platform\'s round trip is too slow to be the only feedback. The whole check finishes within {{LINT_MINUTES}} minutes. Types: {{TYPES}}. Size and complexity: {{COMPLEXITY}}. New findings: {{DEBT}}. Duplicated code: {{DUPLICATION}}. Tests and coverage follow the Test strategy decision; coverage conditions live in the same gate.',
      consequences: '• One standard and one dashboard across repositories and teams, with history, and a report to show an auditor or a customer.\n• The gate on new code can be passed by every pull request from the first day, so it stays on.\n• A service to run and upgrade (or a subscription per line of code), and one more thing between a push and a green check.\n• Two rule sets to keep aligned: what Sonar flags and what the local linter flags; a finding seen only in the platform is found late.\n• Developers need the SonarLint plugin connected to the server to see the same rules in the editor.',
      alternatives: '1. A linter and a formatter in CI only: faster and free, but no cross-repository view and no evidence trail.\n2. GitHub code scanning with CodeQL: strong on security findings, weak on maintainability; a complement, not a replacement.\n3. A gate on the whole codebase instead of new code: it is failed from day one on any existing code and switched off within a week.',
    },
    {
      id: 'adr-format-only', label: 'Only a formatter is enforced', when: { STATIC: ['format-only'] },
      context: `${FORCES} Here the element is small enough for review to hold: a prototype, a set of scripts or an internal tool with one or two owners.`,
      decision: 'Only the stack\'s formatter is enforced: Prettier (or Biome format), ruff format or Black, gofmt, run on staged files at commit and checked in CI within {{LINT_MINUTES}} minutes. No lint rules and no analysis platform; what a linter would find is left to the author and the reviewer. Types: {{TYPES}}. Size and complexity: {{COMPLEXITY}}. New findings: {{DEBT}}. Duplicated code: {{DUPLICATION}}. The decision is revisited, and a linter introduced through a new decision, when the element passes 5,000 source lines or gains a third regular contributor; a monthly count checks both. Tests follow the Test strategy decision.',
      consequences: '• Nothing to configure or maintain beyond the formatter, and a pull request check that takes seconds.\n• Unused variables, unreachable code, wrong equality and the other mistakes a linter finds for free reach review and sometimes production.\n• The element is cheap to start and must be cheap to leave: the revisit trigger is written down so growth does not pass unnoticed.\n• Anything in this decision that depends on a linter (enforced complexity limits, a count of findings) is carried by a standalone tool instead and costs more to set up than it would with one.',
      alternatives: '1. A linter and a formatter in CI: an hour to set up with a recommended rule set, and the right choice as soon as a third person contributes.\n2. A code-analysis platform: far more than a prototype needs.\n3. Nothing enforced at all: formatting arguments in review within a week.',
    },
  ],
  fitness: [
    {
      id: 'ff-gate-job', label: 'Static checks in time, required for merge', category: 'process', implements: GATES,
      threshold: 'The static-check job finishes within {{LINT_MINUTES}} minutes and is a required status check in branch protection',
      description: 'The job that runs the formatter check, the linter and the type check has a hard timeout of {{LINT_MINUTES}} minutes and is a required check for merging, so a slow or skipped gate fails instead of being worked around. Concurrency cancels the run of a superseded push.',
      tool: 'GitHub Actions (timeout-minutes) with branch protection',
      language: 'yaml',
      snippet: `# .github/workflows/quality.yml
name: quality
on: [pull_request]
concurrency:
  group: quality-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  static:
    runs-on: ubuntu-latest
    timeout-minutes: 5            # LINT_MINUTES
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }  # new-code checks need the base branch
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run format:check   # prettier --check .
      - run: npm run lint           # eslint . --cache --max-warnings 0
      - run: npm run typecheck      # tsc --noEmit
# Branch protection: "quality / static" is a required status check`,
    },
    {
      id: 'ff-pre-commit', label: 'Formatted on commit', category: 'process', implements: GATES,
      threshold: '0 files in a pull request differ from the formatter\'s output; the formatter runs on every staged file at commit',
      description: 'husky installs a pre-commit hook that runs lint-staged, which formats and (where a linter is enforced) lints only the staged files in the versions pinned in package.json; CI runs the same formatter check over the whole tree, so a commit made with --no-verify still fails there. On Python the pre-commit framework with ruff-pre-commit does the same.',
      tool: 'husky with lint-staged',
      language: 'json',
      snippet: `// package.json
{
  "scripts": {
    "prepare": "husky",
    "format:check": "prettier --check .",
    "lint": "eslint . --cache --max-warnings 0"
  },
  "lint-staged": {
    "*.{ts,tsx,js,mjs,cjs}": ["prettier --write", "eslint --cache --fix --max-warnings 0"],
    "*.{json,md,yml,yaml,css}": ["prettier --write"]
  }
}
// .husky/pre-commit
// npx lint-staged`,
    },
    {
      id: 'ff-eslint-config', label: 'Recommended rules, every one an error', when: { STATIC: ['linter'] }, category: 'structural', implements: ['adr-linter'],
      threshold: '0 rules at warning severity; an unused disable directive is an error; eslint exits non-zero on any finding',
      description: 'The flat config enables the recommended and type-checked rule sets, turns unused disable directives into errors and keeps no rule at "warn"; CI runs eslint with --max-warnings 0 so a rule accidentally set to warn still fails. On Python the equivalent is ruff with select = ["E", "F", "B", "UP", "C90"] in pyproject.toml; on Go, golangci-lint with the default linters enabled.',
      tool: 'ESLint (flat config) with typescript-eslint',
      language: 'js',
      snippet: `// eslint.config.js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description', minimumDescriptionLength: 10 }],
      'no-warning-comments': 'off',
    },
  },
)`,
    },
    {
      id: 'ff-sonar-gate', label: 'Quality gate on new code holds', when: { STATIC: ['sonar'] }, category: 'process', implements: ['adr-sonar'],
      threshold: '0 new bugs, 0 new vulnerabilities, 100% of new hotspots reviewed, maintainability rating A on new code; the pipeline fails when the gate fails',
      description: 'The scanner runs on every pull request with new code defined against the main branch and waits for the gate; the gate in SonarQube holds conditions on new code only (Reliability rating A, Security rating A, Security hotspots reviewed 100%, Maintainability rating A, and Duplicated lines on new code where duplication is blocked). Coverage conditions from the Test strategy decision live in the same gate.',
      tool: 'SonarQube quality gate (sonar-scanner)',
      language: 'properties',
      snippet: `# sonar-project.properties
sonar.projectKey=shop-order-api
sonar.sources=src
sonar.tests=test
sonar.newCode.referenceBranch=main
sonar.pullrequest.key=\${env.PR_NUMBER}
sonar.pullrequest.branch=\${env.PR_BRANCH}
sonar.pullrequest.base=main
# fail the pipeline when the gate fails (polls up to 5 min)
sonar.qualitygate.wait=true
sonar.qualitygate.timeout=300
# Quality gate "Clean as You Code", conditions on new code:
#   Reliability rating worse than A -> failed
#   Security rating worse than A -> failed
#   Security hotspots reviewed < 100% -> failed
#   Maintainability rating worse than A -> failed
#   Duplicated lines (%) > 3 -> failed        (DUPLICATION_PCT, when blocked)`,
    },
    {
      id: 'ff-size-watch', label: 'Growth is counted monthly', when: { STATIC: ['format-only'] }, category: 'holistic', implements: ['adr-format-only'],
      threshold: 'Source lines below 5,000 and regular contributors (5 or more commits in 90 days) below 3; the monthly job opens an issue otherwise',
      description: 'A scheduled job counts source lines with cloc and contributors with 5 or more commits in the last 90 days from git; when either passes the limit it opens an issue to introduce a linter, linking this decision, and fails the run until the issue exists.',
      tool: 'GitHub Actions (schedule) with cloc and git shortlog',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# .github/workflows/size-watch.yml runs this on: schedule: - cron: '0 6 1 * *'
set -euo pipefail
lines=$(npx cloc src --json | jq '.SUM.code')
people=$(git shortlog -sn --since='90 days ago' -- src | awk '$1 >= 5' | wc -l)
echo "source lines: $lines, regular contributors: $people"
if [ "$lines" -ge 5000 ] || [ "$people" -ge 3 ]; then
  gh issue list --label quality-gate --state open --json number | grep -q number ||
    gh issue create --label quality-gate --title 'Introduce a linter (ADR Only a formatter is enforced)' \\
      --body "src has $lines lines and $people regular contributors; the decision says revisit now."
  exit 1
fi`,
    },
    {
      id: 'ff-strict-types', label: 'Strict type check passes', when: { TYPES: ['strict'] }, category: 'structural', implements: GATES,
      threshold: '0 type errors with strict on for the whole element; 0 suppression comments without an issue id',
      description: 'tsconfig turns on strict and the checks strict leaves out, and the type check runs on every pull request; the ban-ts-comment lint rule (or a grep in CI for "type: ignore" without an issue id on Python) refuses a suppression without a reason. On Python the equivalent is mypy --strict in pyproject.toml; on C#, <Nullable>enable</Nullable> with <TreatWarningsAsErrors>true</TreatWarningsAsErrors>.',
      tool: 'TypeScript compiler (tsc --noEmit)',
      language: 'json',
      snippet: `// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,
    "noEmit": true
  },
  "include": ["src", "test"]
}
// CI: npx tsc --noEmit
// pyproject.toml equivalent: [tool.mypy] strict = true`,
    },
    {
      id: 'ff-type-ratchet', label: 'Non-strict files only decrease', when: { TYPES: ['ratchet'] }, category: 'structural', implements: GATES,
      threshold: 'Every file not marked @ts-strict-ignore passes strict checking; the number of marked files never rises in a pull request, and a marked file that passes strict is unmarked',
      description: 'typescript-strict-plugin checks every file in strict mode except those with a // @ts-strict-ignore comment at the top; tsc-strict runs in CI. A test counts the marked files and compares the count with the committed baseline: a higher count fails, a lower one fails until the baseline is lowered. New files without the comment are strict from their first commit. On Python, mypy per-module overrides in pyproject.toml with strict = false for the listed modules play the same role.',
      tool: 'typescript-strict-plugin with a Vitest test over the baseline',
      language: 'ts',
      snippet: `// tsconfig.json: "plugins": [{ "name": "typescript-strict-plugin" }]   CI: npx tsc-strict
// test/strict-baseline.test.ts
import { execSync } from 'node:child_process'
import { expect, it } from 'vitest'
import baseline from '../strict-baseline.json'   // { "nonStrictFiles": 143 }

it('the number of non-strict files only goes down', () => {
  const count = Number(execSync("grep -rl '^// @ts-strict-ignore' src | wc -l").toString())
  expect(count, 'a file was added to the non-strict baseline').toBeLessThanOrEqual(baseline.nonStrictFiles)
  expect(count, 'files became strict: lower strict-baseline.json').toBe(baseline.nonStrictFiles)
})`,
    },
    {
      id: 'ff-complexity-rules', label: 'Complexity and length limits enforced', when: { COMPLEXITY: ['limits'] }, category: 'structural', implements: GATES,
      threshold: 'Cyclomatic complexity per function at most {{MAX_COMPLEXITY}}, functions at most {{MAX_FUNCTION_LINES}} lines, files at most {{MAX_FILE_LINES}} lines, nesting at most 4; each fails the check',
      description: 'ESLint\'s core complexity, max-lines-per-function, max-lines and max-depth rules fail the check on a function or file over the limit; blank lines and comments are not counted. On Python, ruff\'s C901 (mccabe) with max-complexity and PLR0915 do the same; on Go, gocyclo in golangci-lint; in SonarQube the rules "Cognitive Complexity of functions should not be too high" and "Files should not have too many lines" carry the same limits. Where only a formatter is enforced and there is no linter to carry the rules, the language-independent lizard runs in the same CI step instead: pipx run lizard src --CCN {{MAX_COMPLEXITY}} --length {{MAX_FUNCTION_LINES}} --warnings_only, which exits non-zero on a function over either limit.',
      tool: 'ESLint core rules (complexity, max-lines, max-lines-per-function, max-depth), or lizard without a linter',
      language: 'js',
      snippet: `// eslint.config.js, added to the shared config
export default tseslint.config(
  // ...recommended configs
  {
    rules: {
      'complexity': ['error', { max: 10 }],                                        // MAX_COMPLEXITY
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }], // MAX_FUNCTION_LINES
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],             // MAX_FILE_LINES
      'max-depth': ['error', 4],
      'max-params': ['error', 5],
    },
  },
  { files: ['**/*.test.ts'], rules: { 'max-lines-per-function': 'off' } },  // describe blocks are long by nature
)
// ruff: [tool.ruff.lint.mccabe] max-complexity = 10
// no linter: pipx run lizard src --CCN 10 --length 50 --warnings_only`,
    },
    {
      id: 'ff-new-findings', label: 'No findings on changed lines', when: { DEBT: ['zero-new'], STATIC: ['linter', 'format-only'] }, category: 'process', implements: ['adr-linter', 'adr-format-only'],
      threshold: '0 findings on lines added or changed by the pull request; findings on other lines are reported, not blocking',
      description: 'reviewdog takes the linter\'s output, keeps only the findings that fall on lines the pull request added (filter-mode added), posts them as review comments and fails the job on any; findings elsewhere in a changed file are shown with filter-mode diff_context in a second non-blocking step. With the platform variant the Sonar gate on new code already does this, so this check is not imported there.',
      tool: 'reviewdog',
      language: 'yaml',
      snippet: `# step in .github/workflows/quality.yml
- uses: reviewdog/action-setup@v1
- name: new findings block
  env: { REVIEWDOG_GITHUB_API_TOKEN: \${{ secrets.GITHUB_TOKEN }} }
  run: |
    npx eslint . --format=@microsoft/eslint-formatter-sarif --output-file eslint.sarif || true
    reviewdog -f=sarif -name=eslint -reporter=github-pr-review \\
      -filter-mode=added -fail-level=any < eslint.sarif
- name: old findings shown
  env: { REVIEWDOG_GITHUB_API_TOKEN: \${{ secrets.GITHUB_TOKEN }} }
  run: reviewdog -f=sarif -name=eslint-context -reporter=github-pr-check -filter-mode=diff_context -fail-level=none < eslint.sarif`,
    },
    {
      id: 'ff-ratchet', label: 'Findings count only goes down', when: { DEBT: ['ratchet'] }, category: 'process', implements: GATES,
      threshold: 'The number of findings is at most the committed baseline; a lower number fails until the baseline is lowered to it',
      description: 'A test runs the linter in JSON mode (or reads the platform\'s or lizard\'s report), counts the findings, and compares the count with lint-baseline.json: more fails, fewer fails with the instruction to lower the baseline, so the file in git always shows the current debt and its history shows the trend. The baseline may only be edited in the same pull request that lowers the count.',
      tool: 'Vitest (a test over lint-baseline.json)',
      language: 'ts',
      snippet: `// test/lint-baseline.test.ts
import { execSync } from 'node:child_process'
import { expect, it } from 'vitest'
import baseline from '../lint-baseline.json'   // { "findings": 120 }

it('the number of lint findings only goes down', () => {
  const out = execSync('npx eslint . --format json || true', { maxBuffer: 64 * 1024 * 1024 }).toString()
  const count = (JSON.parse(out) as Array<{ messages: unknown[] }>).reduce((n, f) => n + f.messages.length, 0)
  expect(count, \`\${count - baseline.findings} new findings over the baseline\`).toBeLessThanOrEqual(baseline.findings)
  expect(count, \`findings fell to \${count}: set lint-baseline.json to it\`).toBe(baseline.findings)
})`,
    },
    {
      id: 'ff-fix-all', label: 'Zero findings, no baseline file', when: { DEBT: ['fix-all'] }, category: 'structural', implements: GATES,
      threshold: '0 findings on the main branch and in every pull request; no baseline or suppression file in the repository',
      description: 'The CI step runs the linter with --max-warnings 0 (ruff check with no per-file-ignores; the Sonar gate with 0 issues on overall code), and a test asserts that no baseline file (lint-baseline.json, .eslint-baseline, strict-baseline.json, a Sonar false-positive export) exists, so a baseline cannot be introduced without superseding the decision.',
      tool: 'Vitest with the linter\'s --max-warnings 0',
      language: 'ts',
      snippet: `// test/no-baseline.test.ts
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { expect, it } from 'vitest'

const BASELINES = ['lint-baseline.json', '.eslint-baseline.json', 'strict-baseline.json', '.sonar-false-positives.json']

it('every finding is fixed, none is baselined', () => {
  expect(BASELINES.filter((f) => existsSync(f)), 'ADR fix-all: supersede it before adding a baseline').toEqual([])
  expect(() => execSync('npx eslint . --max-warnings 0', { stdio: 'pipe' })).not.toThrow()
})`,
    },
    {
      id: 'ff-duplication', label: 'Duplication under the threshold', when: { DUPLICATION: ['block'] }, category: 'structural', implements: GATES,
      threshold: 'Duplicated lines at most {{DUPLICATION_PCT}}% of new code, blocks of 10 or more lines; the check fails above it and names both copies',
      description: 'jscpd runs over the source tree in CI with a minimum block of 10 lines and the threshold, exits non-zero above it and prints both locations of every clone; with the platform variant the condition "Duplicated lines on new code" in the Sonar gate carries the same number. The report in HTML is kept as a build artifact for the reviewer.',
      tool: 'jscpd',
      language: 'json',
      snippet: `// .jscpd.json
{
  "threshold": 3,
  "minLines": 10,
  "minTokens": 70,
  "mode": "mild",
  "format": ["typescript", "javascript", "tsx", "python", "go", "kotlin", "csharp"],
  "ignore": ["**/node_modules/**", "**/dist/**", "**/*.test.ts", "**/*.spec.ts"],
  "reporters": ["console", "html"],
  "output": "reports/jscpd",
  "exitCode": 1
}
// CI: npx jscpd src   (exits 1 when duplication is above "threshold" %)`,
    },
  ],
}

export default pack
