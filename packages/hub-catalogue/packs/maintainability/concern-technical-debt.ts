import type { PackSpec, When } from '../../src/packSpec'

const REGISTRIES = ['adr-issues', 'adr-adrs', 'adr-tool']
const KEYED: When = { REGISTRY: ['issues', 'adrs'] }
const SUNSET: When = { DEPRECATION: ['sunset'] }
const FORCES = 'Code lives in this element and every deadline leaves a shortcut in it; whether those shortcuts are seen, counted and repaid decides how fast the element can change next year. The forces: debt taken knowingly for a deadline is a sound loan and debt taken unknowingly is a surprise, and both charge interest in every change that touches them (Cunningham\'s metaphor, Fowler\'s quadrant); a debt nobody can see is never repaid, while a register nobody prunes becomes a graveyard; time for repayment competes with features in every planning, and a team that gets none slows down without anyone having decided it; deprecated code and endpoints stay because removing them has no sponsor and no date; and a full rewrite looks like freedom from all debt and usually recreates it, two years late (Spolsky). What a change must pass to be merged is decided by the Code quality gate concern and which tests it has by the Test strategy concern; a feature flag past its rollout is a debt item in the register here, but its removal is decided in the Deployment and rollback pack. This decision is about the debt that is already there and the debt taken on purpose. The snippets assume one repository layout: source in src/, tests in test/, decision records in docs/adr and debt records in docs/debt, the pipelines on GitHub Actions with the GitHub CLI, and GitHub Issues, Jira or Linear as the tracker.'

const pack: PackSpec = {
  id: 'concern-technical-debt',
  name: 'Technical debt',
  group: 'maintainability',
  description: 'Where technical debt is written down so that it can be seen, how much of the team\'s time repaying it gets, how deprecated code and endpoints are retired (a flag past its rollout is a debt item; its removal is decided in the Deployment and rollback pack), and how a rewrite is decided.',
  tags: ['maintainability', 'technical debt', 'deprecation', 'strangler fig', 'refactoring'],
  concern: {
    id: 'technical-debt',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements and accumulates shortcuts, so where that debt is recorded, how it is repaid and how old code is retired has to be decided; one decision usually covers a whole repository and is bound to every element built from it.',
  },
  sources: [
    { title: 'Ward Cunningham: Ward Explains Debt Metaphor (c2.com)', url: 'https://wiki.c2.com/?WardExplainsDebtMetaphor' },
    { title: 'Martin Fowler: TechnicalDebt', url: 'https://martinfowler.com/bliki/TechnicalDebt.html' },
    { title: 'Martin Fowler: TechnicalDebtQuadrant', url: 'https://martinfowler.com/bliki/TechnicalDebtQuadrant.html' },
    { title: 'Martin Fowler: StranglerFigApplication', url: 'https://martinfowler.com/bliki/StranglerFigApplication.html' },
    { title: 'Kruchten, Nord, Ozkaya: Technical Debt: From Metaphor to Theory and Practice (IEEE Software, 2012)', url: 'https://ieeexplore.ieee.org/document/6336722' },
    { title: 'SonarSource: Metric definitions, technical debt and the SQALE debt ratio', url: 'https://docs.sonarsource.com/sonarqube-server/latest/user-guide/code-metrics/metrics-definition/' },
    { title: 'Michael Nygard: Documenting Architecture Decisions', url: 'https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions' },
    { title: 'RFC 8594, The Sunset HTTP Header Field', url: 'https://www.rfc-editor.org/rfc/rfc8594' },
    { title: 'RFC 9745, The Deprecation HTTP Header Field', url: 'https://www.rfc-editor.org/rfc/rfc9745' },
    { title: 'Forsgren, Humble, Kim: Accelerate', url: 'https://itrevolution.com/product/accelerate/' },
    { title: 'ISO/IEC 25010, Maintainability: modifiability, analysability', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
    { title: 'Joel Spolsky: Things You Should Never Do, Part I', url: 'https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/' },
    { title: 'eslint-plugin-unicorn: expiring-todo-comments', url: 'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/expiring-todo-comments.md' },
  ],
  questions: [
    {
      key: 'REGISTRY', title: 'Register', label: 'Where is technical debt written down?',
      hint: 'A debt that is only in someone\'s head is never planned, never repaid and never retired with its owner; the register is the one place planning looks at.',
      default: 'issues',
      options: [
        { value: 'issues', label: 'issues in the tracker, labelled tech-debt', description: 'Every debt item is an issue (GitHub Issues, Jira, Linear) with the label tech-debt, an assignee, a cost estimate and a consequence; the code points at it with TODO (KEY-123), and debt is triaged in the same meeting as bugs. Pick it when the team already plans from the tracker and debt should compete for the same backlog on equal terms.' },
        { value: 'adrs', label: 'decision records in the repository', description: 'Debt is recorded as decision records next to the ADRs (docs/debt/NNNN-*.md, copied from a template, with front matter for owner, cost and status) with a consequences section; items too small for a record are TODO (DEBT-NNNN) comments pointing at one. Pick it when the debt is architectural (a wrong boundary, a library to leave, a schema to split) and the reasoning matters more than the ticket, or when the tracker belongs to someone else.' },
        { value: 'tool', label: 'a code-analysis platform, no separate list', description: 'SonarQube or SonarCloud is the register: each open issue carries its remediation effort, the sum is the debt, the debt ratio is a quality-gate condition and the dashboard is the report; an issue accepted as "won\'t fix" with a reason is tolerated debt. Pick it when most of the debt is in the code itself (duplication, complexity, smells) and nobody will keep a list by hand.' },
      ],
    },
    {
      key: 'BUDGET', title: 'Budget', label: 'How much of the team\'s time does repayment get?',
      hint: 'Repayment that is not planned does not happen; a budget turns "we should" into a share of every iteration, a window on the calendar or a rule for every change.',
      default: 'fixed-share',
      options: [
        { value: 'fixed-share', label: 'a fixed share of every iteration', description: 'A share of each iteration\'s capacity (20% by default) goes to items from the register, picked by the team, and the share reached is reported at the end. Pick it when the team plans in iterations and the debt is spread across the code rather than in a few large items.' },
        { value: 'windows', label: 'repayment windows on the calendar', description: 'A number of days a quarter (5 by default) are blocked for repayment only, as a fix-it week or a debt sprint, with the items picked from the register before the window starts. Pick it when the debt comes in large items (a migration, a framework upgrade) that cannot be done in slices beside feature work.' },
        { value: 'boy-scout', label: 'the boy-scout rule, no budget', description: 'Every change leaves the code it touches a little better, and a touched file\'s lint findings may not grow; debt is repaid in passing and the register shrinks only where people work. Pick it for a small codebase with a steady team and little debt, where a budget would be more ceremony than work.' },
      ],
    },
    {
      key: 'DEPRECATION', title: 'Deprecation', label: 'What happens to deprecated code and endpoints?',
      hint: 'Deprecated code that stays costs a little in every change and a lot in the one that finally removes it; a date gives removal a sponsor. Feature flags are retired as the Deployment and rollback pack decides.',
      default: 'sunset',
      options: [
        { value: 'sunset', label: 'an enforced sunset date', description: 'Everything deprecated (code, endpoints) carries a sunset date at least a grace period ahead (90 days by default) and is removed by it; a check fails the build the day after. Pick it when the team can commit to removal dates, including for endpoints other teams call.' },
        { value: 'tolerated', label: 'a marker without a date', description: 'Deprecated code is marked with its reason, replacement and register key, no new code may call it, and it is removed only when it blocks a change. Pick it when callers you do not control depend on it and a date you cannot enforce would only be missed.' },
      ],
    },
    {
      key: 'REWRITE', title: 'Rewrite', label: 'How is a rewrite decided?',
      hint: 'A full rewrite stops delivery for months and recreates the bugs the old code had already fixed; a piece-by-piece replacement keeps the old system in production until each piece is proven.',
      default: 'strangler',
      options: [
        { value: 'strangler', label: 'piece by piece (strangler fig)', description: 'A rewrite replaces one piece at a time behind a facade, old and new running side by side with a cut-over and a way back per piece; big-bang rewrites are not done. Pick it by default, and always when the element serves users while it is rewritten.' },
        { value: 'big-bang-allowed', label: 'a full rewrite with a written case', description: 'A full rewrite may be started when a written case with cost, risk, parity criteria and what the old code knows that nobody remembers is accepted by the owners and recorded as an ADR. Pick it when the element is small, its behaviour is fully specified by tests, or it must leave a platform that is going away.' },
      ],
    },
    {
      key: 'AGE', title: 'Age limit', label: 'Is there a maximum age for a debt item?',
      hint: 'A register that only grows stops being read; an age limit forces a decision on every item: schedule it, or accept the debt in writing and close it.',
      default: 'max-age',
      options: [
        { value: 'max-age', label: 'escalation after a maximum age', description: 'A debt item older than the limit (180 days by default) is escalated to the owner\'s lead and either scheduled into the next iteration or window, or closed with a written decision that the debt is accepted. Pick it when the register has more than a few dozen items or several teams feed it.' },
        { value: 'none', label: 'no age limit', description: 'Items stay in the register until they are repaid or someone closes them. Pick it for a short register that one team prunes in its triage anyway.' },
      ],
    },
  ],
  details: [
    { key: 'DEBT_SHARE_PCT', label: 'What share of each iteration goes to debt (%)?', default: '20', number: true },
    { key: 'WINDOW_DAYS_PER_QUARTER', label: 'How many days a quarter are a repayment window?', default: '5', number: true },
    { key: 'MAX_DEBT_AGE_DAYS', label: 'After how many days is a debt item escalated?', default: '180', number: true },
    { key: 'MAX_DEBT_RATIO_PCT', label: 'What technical debt ratio is allowed on new code (%)?', default: '5', number: true },
    { key: 'SUNSET_GRACE_DAYS', label: 'How many days of notice does a sunset date give at least?', default: '90', number: true },
  ],
  need: {
    label: 'Debt is visible and repaid on purpose',
    text: 'Every shortcut taken in this element charges interest in each later change that touches it. The team needs the debt written down where planning can see it, with an owner, what repaying costs and what leaving it costs; a known share of its time to repay it; deprecated code and endpoints that actually go away; and a way to decide a rewrite that does not stop delivery for a year. Without this the element gets slower to change every quarter and nobody can say why.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-todo-key', label: 'Every TODO names a debt item', when: KEYED, ears_type: 'ubiquitous',
      action: 'allow a TODO, FIXME, HACK or XXX comment only in the form TODO (KEY-123), where KEY-123 is an open item of the register (an issue, or a debt record not marked repaid), and fail lint on a comment without a key and the build on a comment whose item is closed or repaid',
      rationale: 'A TODO without a record is debt only its author knows about; one pointing at a closed item is a repaid debt nobody removed from the code (Fowler, TechnicalDebt; Kruchten et al.: debt items need an identity to be managed).',
      scenario: { label: 'Keyless TODO refused', given: 'a pull request with a TODO without a key, a TODO (KEY-123) whose item is open, and a TODO (KEY-99) whose item is closed', when: 'lint and the build run', then: 'lint names the keyless comment, the build names KEY-99 as closed, and only KEY-123 passes' },
    },
    {
      id: 'req-debt-record', label: 'Debt items carry owner, cost and consequence', ears_type: 'ubiquitous',
      action: 'record for every debt item an owner, an estimate of what repaying it costs (days or remediation effort) and the consequence of leaving it (what gets slower, riskier or impossible), and fail the weekly register check on an item without them',
      rationale: 'Debt is a decision about interest against principal; without cost and consequence there is nothing to decide with, and without an owner nobody brings it to planning (Kruchten, Nord, Ozkaya: a technical debt item; Cunningham).',
      scenario: { label: 'Incomplete item flagged', given: 'a new debt item without an owner or a consequence', when: 'the weekly register check runs', then: 'it fails naming the item, and passes once owner, cost and consequence are filled in' },
    },
    {
      id: 'req-share-reported', label: 'Repayment share is measured', ears_type: 'event-driven',
      trigger: 'an iteration ends',
      action: 'report the share of the pull requests merged in it that repaid debt (labelled tech-debt), with the register\'s size, where the team and its stakeholders see it',
      rationale: 'What is not measured is the first thing cut; Accelerate links sustained delivery performance to time deliberately spent on the system itself.',
      scenario: { label: 'Share in the iteration report', given: 'an iteration in which 12 pull requests were merged, 3 of them labelled tech-debt', when: 'it ends and the share job runs', then: 'the report shows 25% debt work and the number of open items' },
    },
    {
      id: 'req-fixed-share', label: 'A share of every iteration', when: { BUDGET: ['fixed-share'] }, ears_type: 'state-driven',
      precondition: 'an iteration is being planned',
      action: 'reserve at least {{DEBT_SHARE_PCT}}% of its capacity for items from the register, chosen by the team by consequence, and fail the share job at the iteration\'s end when fewer than {{DEBT_SHARE_PCT}}% of the merged pull requests repaid debt, so that the retrospective explains it',
      rationale: 'Repayment that competes with features item by item loses every time; a fixed share removes the per-item negotiation (Fowler, TechnicalDebt: paying down with every iteration).',
      scenario: { label: 'Share planned and kept', given: 'an iteration with {{DEBT_SHARE_PCT}}% reserved', when: 'it closes and the share job runs', then: 'at least {{DEBT_SHARE_PCT}}% of the merged pull requests are labelled tech-debt, or the job fails for the retrospective to record why' },
    },
    {
      id: 'req-windows', label: 'Repayment windows on the calendar', when: { BUDGET: ['windows'] }, ears_type: 'event-driven',
      trigger: 'a quarter starts',
      action: 'block at least {{WINDOW_DAYS_PER_QUARTER}} days of the whole team for repayment only, recorded in debt-windows.json with the items picked from the register at least 14 days before the window, and merge no pull request without the tech-debt label during the window',
      rationale: 'Large items (an upgrade, a migration) cannot be sliced beside feature work; a window only works when it is on the calendar before features claim it (Kruchten et al.: debt repayment as planned work).',
      scenario: { label: 'Window held', given: 'the current quarter', when: 'the window test and the window-merge check run', then: 'debt-windows.json holds a window of at least {{WINDOW_DAYS_PER_QUARTER}} days for the quarter with items picked 14 days ahead, and no pull request merged during the window lacks the tech-debt label' },
    },
    {
      id: 'req-boy-scout', label: 'Touched files do not get worse', when: { BUDGET: ['boy-scout'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request leaves a file it changed with more lint findings (errors and warnings) than the file had on the base branch',
      action: 'fail the check and block the merge until the touched file has at most as many findings as before',
      rationale: 'Without a budget the only repayment is in passing; the rule makes "a little better" checkable instead of hoped for (Fowler, TechnicalDebt; duplication and complexity in new code are the Code quality gate\'s conditions).',
      scenario: { label: 'Findings grew in a touched file', given: 'a file with 4 lint findings', when: 'a pull request changes it and leaves 5', then: 'the check fails naming the file, and passes once the count is 4 or fewer' },
    },
    {
      id: 'req-deprecated-marked', label: 'Deprecated code says why and what instead', ears_type: 'ubiquitous',
      action: 'mark every deprecated function, module and endpoint with the language\'s deprecation marker (@deprecated, [Obsolete], warnings.deprecated) whose text names the replacement and the register key, and answer deprecated endpoints with a Deprecation header',
      rationale: 'A deprecation without a replacement teaches nothing and is ignored; one with a key can be planned (RFC 9745; ISO 25010 analysability).',
      scenario: { label: 'Marker complete', given: 'a function deprecated in a pull request', when: 'the marker check runs', then: 'its @deprecated text names a replacement and a register key, and a marker without either fails the check' },
    },
    {
      id: 'req-sunset', label: 'Deprecated things carry a sunset and go', when: SUNSET, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a deprecated function, module or endpoint is still in the code after its sunset date, or is deprecated with a sunset less than {{SUNSET_GRACE_DAYS}} days ahead',
      action: 'fail the build naming the item, and for endpoints send the sunset date in a Sunset header beside the Deprecation header from the day of deprecation, so that callers see it coming',
      rationale: 'Removal has no sponsor unless a date forces one; a build that fails after the date is a sponsor that never forgets (RFC 8594; RFC 9745; Kruchten et al.: debt repayment as planned work).',
      scenario: { label: 'Build fails after sunset', given: 'a module marked deprecated with a sunset of 2027-01-31, and a pull request deprecating another with a sunset 10 days ahead', when: 'the build runs on 2027-02-01', then: 'it fails naming the first module and its sunset, and the pull request fails for a sunset inside the grace period' },
    },
    {
      id: 'req-no-new-callers', label: 'No new callers of deprecated code', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'new or changed code calls or imports something marked deprecated',
      action: 'fail lint, unless the line carries a disable comment naming the register key under which the call is tolerated',
      rationale: 'Deprecated code can only be removed when its callers stop growing; a named exception keeps the debt visible instead of hidden in a blanket disable (Fowler, StranglerFigApplication: the old code shrinks only if nothing new depends on it).',
      scenario: { label: 'New call to deprecated code refused', given: 'a function marked @deprecated', when: 'a pull request adds a call to it without a disable comment, and another with one naming KEY-123', then: 'the first fails lint and the second passes' },
    },
    {
      id: 'req-tolerated', label: 'Deprecated code tolerated until it blocks', when: { DEPRECATION: ['tolerated'] }, ears_type: 'ubiquitous',
      action: 'keep deprecated code without a removal date, with its marker naming the replacement and the register item that stays open, and let no new code call it, so that it is removed in the change it first blocks',
      rationale: 'A date the team cannot enforce is a promise broken on schedule; a marker, an open item and a ban on new callers keep the debt visible and shrinking without one (Fowler, TechnicalDebt; Kruchten et al.).',
      scenario: { label: 'Tolerated item stays visible', given: 'a deprecated function with a marker naming its replacement and key', when: 'the marker check and the no-deprecated lint run on a pull request that adds a call to it', then: 'the marker passes and the new call fails lint' },
    },
    {
      id: 'req-no-new-debt', label: 'New debt comes with its record', ears_type: 'event-driven',
      trigger: 'a pull request knowingly takes a shortcut: it waives a quality-gate condition, suppresses a warning, skips a test or adds a TODO',
      action: 'carry the register key of a debt item opened in the same pull request, with owner, cost and consequence, so that 0 shortcuts are merged without a record',
      rationale: 'Deliberate debt is sound only when it is written down at the moment it is taken; afterwards nobody remembers it was a loan (Fowler, TechnicalDebtQuadrant: deliberate and prudent). What the gate itself requires is the Code quality gate concern\'s decision.',
      scenario: { label: 'Suppressed warning has a key', given: 'a pull request that adds a lint-disable comment', when: 'it is reviewed', then: 'the comment names a register key opened in the same pull request, or the pull request is not approved' },
      unchecked: 'the reviewer of each pull request checks that a waived condition, a suppression or a skipped test names a register item opened in the same pull request; no tool can tell a deliberate shortcut from an accident (a TODO without a key is the one case the lint catches)',
    },
    {
      id: 'req-strangler', label: 'Rewrites go piece by piece', when: { REWRITE: ['strangler'] }, ears_type: 'ubiquitous',
      action: 'replace an element or module to be rewritten one piece at a time behind a facade that routes each piece to old or new, keep old and new running side by side with a documented cut-over and a way back per piece, and let no code outside the facade import the legacy module',
      rationale: 'The old system keeps serving while each new piece is proven in production, and a failed piece is routed back instead of rolled back as a whole (Fowler, StranglerFigApplication; Spolsky on what a rewrite forgets).',
      scenario: { label: 'Legacy reached only through the facade', given: 'a module outside src/legacy and src/facade that imports src/legacy', when: 'the dependency rule runs', then: 'the build fails naming the module and the import' },
    },
    {
      id: 'req-rewrite-case', label: 'A rewrite needs an accepted case', when: { REWRITE: ['big-bang-allowed'] }, ears_type: 'event-driven',
      trigger: 'a full rewrite of the element or of one of its modules is proposed',
      action: 'write the case as an ADR of kind rewrite with the cost in person-months, the risks, the parity criteria (which tests and behaviours the new code must match), what the old code handles that no document describes, and a cut-over plan, accepted in writing by at least two owners, and merge no pull request labelled rewrite that does not link an accepted rewrite ADR',
      rationale: 'A rewrite is the costliest way to repay debt and usually recreates the bugs the old code had fixed; a written case makes the gamble explicit before months are spent (Spolsky, Things You Should Never Do; Nygard, Documenting Architecture Decisions).',
      scenario: { label: 'Rewrite without case stopped', given: 'a pull request labelled rewrite whose description links no accepted rewrite ADR', when: 'the rewrite check runs', then: 'it fails, and passes once the description links an ADR of kind rewrite with status accepted and two accepting owners' },
    },
    {
      id: 'req-age', label: 'Old debt items get a decision', when: { AGE: ['max-age'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a debt item has been open for more than {{MAX_DEBT_AGE_DAYS}} days without being marked escalated or accepted-debt',
      action: 'fail the weekly age check naming it, so that within 1 week it is escalated to the owner\'s lead and either scheduled into the next iteration or window or closed with a written decision that the debt is accepted',
      rationale: 'A register that only grows stops being read; forcing a decision keeps every item either moving or honestly accepted (Kruchten et al.: debt that is never repaid should be declared, not carried).',
      scenario: { label: 'Old item escalated', given: 'a debt item opened {{MAX_DEBT_AGE_DAYS}} days ago plus one', when: 'the age check runs', then: 'it fails naming the item, and passes once the item is marked escalated, scheduled, or closed as accepted debt' },
    },
    {
      id: 'req-tool-ratio', label: 'Debt ratio bounded in the gate', when: { REGISTRY: ['tool'] }, ears_type: 'ubiquitous',
      action: 'keep the technical debt ratio on new code at or below {{MAX_DEBT_RATIO_PCT}}% as a quality-gate condition, show the overall ratio and total remediation effort on the project dashboard, assign every open issue to an owner, and accept an issue as won\'t fix only with a written reason',
      rationale: 'With the platform as the register, the ratio is the one number debt is managed by, and an unassigned or silently accepted issue is debt that has left the register (SonarSource, metric definitions: technical debt ratio; SQALE).',
      scenario: { label: 'Ratio over the limit fails the gate', given: 'a pull request whose new code has a debt ratio of {{MAX_DEBT_RATIO_PCT}}% plus 1, and an open issue without an assignee', when: 'the analysis and the weekly register check run', then: 'the quality gate fails on the debt-ratio condition, and the register check names the unassigned issue' },
    },
  ],
  adrs: [
    {
      id: 'adr-issues', label: 'Debt is tracked as issues labelled tech-debt', when: { REGISTRY: ['issues'] },
      decision: 'Every debt item is an issue in the tracker (GitHub Issues, Jira or Linear) with the label tech-debt, an assignee as owner, a Cost section with the estimate in days and a Consequence section; an issue form (.github/ISSUE_TEMPLATE/tech-debt.yml with required fields) makes cost and consequence mandatory, and a weekly check fails on an open item without them or without an assignee. Debt is triaged in the same weekly triage as bugs. Code points at an item with TODO (KEY-123): lint fails a TODO without a key and a CI script fails the build on a TODO whose issue is closed. A pull request that repays an item carries the label tech-debt. A feature flag past its rollout is an item like any other; its removal follows the Deployment and rollback pack. Repayment budget: {{BUDGET}}. Deprecated code and endpoints: {{DEPRECATION}}. Rewrites: {{REWRITE}}. Age: {{AGE}}. A shortcut taken knowingly in a pull request (a waived quality-gate condition, a suppressed warning, a skipped test) opens its issue in the same pull request.',
      consequences: '• Debt competes for the same backlog as features and bugs, on the same board, with the same estimates.\n• The share of debt work per iteration falls out of the tracker and the labelled pull requests for free.\n• A tracker fills with small items quickly; triage must close duplicates and merge siblings or the label becomes noise.\n• Architectural debt gets a ticket-sized description; the reasoning behind it needs an ADR beside the issue.',
      alternatives: '1. Decision records in the repository: better for architectural debt with reasoning, but invisible to the planning board unless mirrored.\n2. A code-analysis platform as the register: free for debt in the code itself, blind to debt in design, process or missing tests.\n3. A wiki page or spreadsheet: easy to start, outside every workflow, and the first thing to go stale.',
    },
    {
      id: 'adr-adrs', label: 'Debt is recorded as decision records', when: { REGISTRY: ['adrs'] },
      decision: 'Debt is recorded as decision records in the repository, docs/debt/NNNN-title.md, copied from docs/debt/template.md: YAML front matter with owner, cost_days, date, status (open, accepted, repaid) and, where one exists, sunset, then the sections Context, Decision and Consequences, reviewed in the pull request like code. Its number is its key: TODO (DEBT-0042) points at it from the code, lint fails a TODO without a key, a CI script fails the build on a TODO whose record is repaid, and a test over the records fails the build on a missing owner, cost or Consequences section or a sunset in the past. Items too small for a record are TODO comments pointing at the record of the debt they belong to. A pull request that repays a record carries the label tech-debt. A feature flag past its rollout is a record like any other; its removal follows the Deployment and rollback pack. Repayment budget: {{BUDGET}}. Deprecated code and endpoints: {{DEPRECATION}}. Rewrites: {{REWRITE}}. Age: {{AGE}}. A shortcut taken knowingly in a pull request adds or amends a record in the same pull request.',
      consequences: '• The reasoning travels with the code: a record says why the debt was taken and what repaying it means, which a ticket never does.\n• Records are reviewed, versioned and searchable with the code; no second system.\n• Planning does not see docs/debt unless the team mirrors items into the tracker or reads the register at every planning.\n• Small items are expensive to record, so some go unrecorded; the TODO rule catches those that reach the code.',
      alternatives: '1. Issues labelled tech-debt: visible in planning, cheaper per item, poorer at reasoning.\n2. A code-analysis platform as the register: measures debt in the code, says nothing about why it is there.\n3. Debt sections inside the architecture ADRs themselves: fewer files, but the debt disappears into decisions nobody reopens.',
    },
    {
      id: 'adr-tool', label: 'Debt is tracked in the code-analysis platform', when: { REGISTRY: ['tool'] },
      decision: 'SonarQube (or SonarCloud) is the register: each open issue carries its remediation effort, the sum is the technical debt, and the debt ratio (remediation effort over development cost, SQALE) is a quality-gate condition, at most {{MAX_DEBT_RATIO_PCT}}% on new code; the project dashboard shows the overall ratio and effort and is the report. Every open issue is assigned to an owner, which a weekly check over the issues API enforces; an issue is accepted (won\'t fix) only with a comment giving the reason, and accepted issues are the tolerated debt. TODO comments are flagged by rule S1135 and counted as debt. A pull request that repays issues carries the label tech-debt. There is no separate list; debt outside the code (a design to change, a missing test suite, a feature flag past its rollout, whose removal follows the Deployment and rollback pack) gets a ticket or ADR only by exception and is linked from a Sonar issue where one exists. Repayment budget: {{BUDGET}}. Deprecated code and endpoints: {{DEPRECATION}}. Rewrites: {{REWRITE}}. Age: {{AGE}}.',
      consequences: '• Debt in the code is measured without anyone keeping a list, with one number everyone understands.\n• The gate stops new debt from entering while the overall ratio is worked down (Clean as You Code).\n• Design, process and test debt are not code smells; the platform does not see them, so they go unrecorded unless someone makes an exception.\n• Remediation effort is the rule\'s estimate, not the team\'s; the ratio is a trend to watch, not a budget to spend.',
      alternatives: '1. Issues labelled tech-debt: sees every kind of debt, but each item is written by hand.\n2. Decision records in the repository: best for architectural debt, worst for the hundreds of small smells the platform finds.\n3. Both the platform and a tracker: complete, until the two disagree and neither is maintained.',
    },
    {
      id: 'adr-strangler', label: 'Rewrites follow the strangler fig', when: { REWRITE: ['strangler'] },
      context: `${FORCES} Here the element must keep serving while any part of it is rewritten.`,
      decision: 'A rewrite replaces one piece at a time behind a facade: a reverse proxy, API gateway or an in-process routing module that sends each piece\'s calls to the old or the new implementation (Envoy, NGINX, Spring Cloud Gateway or a feature flag per piece in the code). Old and new run side by side; each piece has a cut-over, a comparison period (shadow traffic or a diff of both answers where the piece allows it) and a way back by routing. New code reaches the old module only through the facade; a dependency rule fails the build on a direct import of src/legacy. A piece is done when the old implementation is deleted. Big-bang rewrites are not done; a proposal for one is an ADR that supersedes this decision.',
      consequences: '• Delivery continues during the rewrite and every piece is proven in production before the next starts.\n• A failed piece is routed back in minutes; nothing is bet on a single cut-over day.\n• The facade and two implementations cost running and reasoning effort until the last piece is gone; a strangler that stops halfway is the worst of both.\n• Pieces must be found along seams (a bounded context, a route, a table); an element without seams needs them cut first.',
      alternatives: '1. A full rewrite with a written case: one cut-over, months without delivery, and the old code\'s undocumented behaviour rediscovered in production.\n2. Refactoring in place without a facade: cheaper when the technology stays; not a rewrite.\n3. Running the new system for new customers only: a strangler by tenant, viable when data need not move.',
    },
    {
      id: 'adr-big-bang', label: 'A full rewrite is allowed with an accepted case', when: { REWRITE: ['big-bang-allowed'] },
      context: `${FORCES} Here the element is small or leaving a platform, so a full rewrite is on the table.`,
      decision: 'A full rewrite of the element or of a module may be started only after a case written as an ADR with kind: rewrite in its front matter is accepted in writing by at least two owners (accepted_by): cost in person-months, risks, parity criteria (the tests and behaviours the new code must match, run against both), what the old code handles that no document describes, a data migration and a cut-over plan with a rollback. Until the ADR is accepted no rewrite code is merged: a pull request labelled rewrite must link an accepted rewrite ADR. Where the element serves users during the rewrite, the strangler-fig approach is preferred and the case must say why it does not apply.',
      consequences: '• A rewrite becomes a decision with a price instead of a mood; most proposals do not survive writing the case.\n• When one is accepted, the parity criteria make "done" testable.\n• The old system still has to be maintained while the new one is built; the case has to budget for both.\n• Months of a rewrite are months without visible features; stakeholders accept that in the ADR, not after.',
      alternatives: '1. Strangler fig only: no rewrite stops delivery, but a small element or one leaving its platform pays for a facade it does not need.\n2. No rule: rewrites start on enthusiasm and end on budget.\n3. Rewrite only within fixed windows: bounds the cost but rarely the risk.',
    },
  ],
  fitness: [
    {
      id: 'ff-todo-key', label: 'Every TODO names a key', when: KEYED, category: 'structural', implements: ['adr-issues', 'adr-adrs'],
      checks: ['req-todo-key'],
      threshold: '0 TODO, FIXME, HACK or XXX comments without a register key of the form KEY-123',
      description: 'A script run in lint greps the tracked source files for TODO-like comments and fails on any that does not carry a key in the agreed form, with or without a sunset in brackets before it: TODO (KEY-123): text, or TODO [2027-01-31] (KEY-123): text. A semgrep pattern-regex rule does the same inside semgrep ci.',
      tool: 'git grep in a lint step (or semgrep pattern-regex)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/check-todos.sh: every TODO/FIXME names a register key, e.g. TODO (SHOP-123): ...
set -euo pipefail
bad=$(git grep -nE '\\b(TODO|FIXME|HACK|XXX)\\b' -- ':!node_modules' ':!*.md' ':!scripts/check-todos.sh' \\
  | grep -vE '\\b(TODO|FIXME|HACK|XXX)\\b( *\\[[^]]+\\])? *\\(([A-Z]+-[0-9]+)\\)' || true)
if [ -n "$bad" ]; then
  printf 'TODO without a register key (use TODO (KEY-123): text):\\n%s\\n' "$bad"
  exit 1
fi`,
    },
    {
      id: 'ff-todo-closed', label: 'No TODO points at a closed item', when: KEYED, category: 'structural', implements: ['adr-issues', 'adr-adrs'],
      checks: ['req-todo-key'],
      threshold: '0 TODO comments whose issue is closed or whose debt record is marked repaid; the build fails on the first',
      description: 'A CI step collects every key from TODO comments and asks the register for the item\'s state: a DEBT-NNNN key is looked up as docs/debt/NNNN-*.md and its front-matter status must not be repaid; any other key is an issue of the repository (SHOP-123 is issue 123) read with gh and must be open. For Jira, the issue lookup is GET /rest/api/3/issue/KEY?fields=status with curl, as the commented line shows.',
      tool: 'gh api and grep in a CI step; curl for Jira',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/check-todo-items.sh: a TODO (SHOP-123) points at an open issue; a TODO (DEBT-0042) at a record not yet repaid
set -euo pipefail
REPO=\${GITHUB_REPOSITORY:-acme/shop}
stale=0
for key in $(git grep -ohE '\\b(TODO|FIXME|HACK|XXX)\\b[^(]*\\(([A-Z]+-[0-9]+)\\)' -- ':!node_modules' | grep -oE '[A-Z]+-[0-9]+' | sort -u); do
  case "$key" in
    DEBT-*)
      record=$(ls docs/debt/"\${key#DEBT-}"-*.md 2>/dev/null | head -1)
      if [ -z "$record" ]; then echo "TODO ($key): no record docs/debt/\${key#DEBT-}-*.md"; stale=1
      elif grep -qE '^status: *repaid' "$record"; then echo "TODO ($key): record is repaid"; stale=1; fi;;
    *)
      state=$(gh api "repos/$REPO/issues/\${key##*-}" --jq .state 2>/dev/null || echo missing)
      # Jira: state=$(curl -sf -u "$JIRA_USER:$JIRA_TOKEN" "$JIRA_URL/rest/api/3/issue/$key?fields=status" | jq -r .fields.status.statusCategory.key)  # "done" = closed
      if [ "$state" != "open" ]; then echo "TODO ($key): issue is $state"; stale=1; fi;;
  esac
done
exit $stale`,
    },
    {
      id: 'ff-debt-issues', label: 'Debt issues are complete', when: { REGISTRY: ['issues'] }, category: 'process', implements: ['adr-issues'],
      checks: ['req-debt-record'],
      threshold: '0 open issues labelled tech-debt without an assignee, a Cost section or a Consequence section',
      description: 'A weekly job lists the open issues labelled tech-debt and fails on one without an assignee or whose body lacks the Cost or Consequence heading that the issue form writes; the form itself (.github/ISSUE_TEMPLATE/tech-debt.yml with required fields) keeps a new item from being opened without them. With Jira the same is a JQL filter on labels = tech-debt AND assignee is EMPTY, plus the required custom fields.',
      tool: 'gh issue list in a scheduled job; a JQL filter for Jira',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/debt-issues.sh: weekly; every open debt item has an owner, a cost and a consequence
set -euo pipefail
bad=$(gh issue list --label tech-debt --state open --limit 500 --json number,assignees,body --jq '
  .[] | select((.assignees | length) == 0 or (.body | test("### Cost") | not) or (.body | test("### Consequence") | not))
      | "#\\(.number)"')
[ -z "$bad" ] || { echo "debt items without owner, cost or consequence:"; echo "$bad"; exit 1; }
# .github/ISSUE_TEMPLATE/tech-debt.yml: labels: [tech-debt]; body: textarea "Cost" (required), textarea "Consequence" (required)`,
    },
    {
      id: 'ff-debt-register', label: 'Debt records are complete and not past sunset', when: { REGISTRY: ['adrs'] }, category: 'structural', implements: ['adr-adrs'],
      checks: ['req-debt-record'],
      threshold: '0 records in docs/debt without owner, cost_days, date, status and a Consequences section; 0 records not marked repaid with a sunset in the past',
      description: 'A test in the unit suite parses the front matter of every record in docs/debt (copied from the template there) and fails on a missing owner, date or status, a cost of 0 or none, a missing Consequences heading, or a record not marked repaid whose sunset date has passed. An unquoted date is parsed by gray-matter as a Date object, so the test normalises it.',
      tool: 'Vitest with gray-matter; pytest with python-frontmatter for Python',
      language: 'ts',
      snippet: `import { readFileSync, readdirSync } from 'node:fs'
import matter from 'gray-matter'
import { expect, it } from 'vitest'

const files = readdirSync('docs/debt').filter((f) => /^\\d{4}-.*\\.md$/.test(f))
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''))

it.each(files)('%s has an owner, a cost, a date, a status, consequences and a live sunset', (file) => {
  const { data, content } = matter(readFileSync(\`docs/debt/\${file}\`, 'utf8'))
  expect(data.owner, 'owner').toBeTruthy()
  expect(Number(data.cost_days), 'cost_days').toBeGreaterThan(0)
  expect(iso(data.date), 'date').toMatch(/^\\d{4}-\\d{2}-\\d{2}$/)
  expect(['open', 'accepted', 'repaid'], 'status').toContain(data.status)
  expect(content).toMatch(/^## Consequences/m)
  if (data.status !== 'repaid' && data.sunset) expect(Date.parse(iso(data.sunset)), 'sunset has passed').toBeGreaterThan(Date.now())
})`,
    },
    {
      id: 'ff-debt-ratio', label: 'Debt ratio in the quality gate, every issue owned', when: { REGISTRY: ['tool'] }, category: 'process', implements: ['adr-tool'],
      checks: ['req-tool-ratio', 'req-debt-record'],
      threshold: 'Technical debt ratio on new code at most {{MAX_DEBT_RATIO_PCT}}% and maintainability rating A on new code as quality-gate conditions; 0 open issues without an assignee in the weekly check',
      description: 'The project\'s quality gate carries the conditions new_sqale_debt_ratio > {{MAX_DEBT_RATIO_PCT}} and new_maintainability_rating > 1 (worse than A) as errors, added once through the API (or in the gate\'s settings page), and the pipeline waits for the gate with sonar.qualitygate.wait=true so that a failed gate fails the build. A weekly job asks the issues API for open, unresolved issues without an assignee and fails when there are any.',
      tool: 'SonarQube web API (api/qualitygates, api/issues) with curl and jq',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
# once, for the gate the project uses (gateId from api/qualitygates/list; SonarCloud: the same API under sonarcloud.io with organization=)
curl -sf -u "$SONAR_TOKEN:" -X POST "$SONAR_URL/api/qualitygates/create_condition" \\
  -d gateId="$GATE_ID" -d metric=new_sqale_debt_ratio -d op=GT -d error={{MAX_DEBT_RATIO_PCT}}
curl -sf -u "$SONAR_TOKEN:" -X POST "$SONAR_URL/api/qualitygates/create_condition" \\
  -d gateId="$GATE_ID" -d metric=new_maintainability_rating -d op=GT -d error=1   # worse than A fails
# sonar-project.properties, so that the pipeline fails when the gate does:
#   sonar.newCode.referenceBranch=main
#   sonar.qualitygate.wait=true
# weekly: every open issue has an owner
unassigned=$(curl -sf -u "$SONAR_TOKEN:" "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&resolved=false&assigned=false&ps=1" | jq '.total')
[ "$unassigned" -eq 0 ] || { echo "$unassigned open issues without an owner"; exit 1; }`,
    },
    {
      id: 'ff-debt-share', label: 'Repayment share reported', category: 'process', implements: REGISTRIES,
      checks: ['req-share-reported', 'req-fixed-share'],
      threshold: 'The share of pull requests merged in the iteration that carry the label tech-debt is reported with the register\'s size; with a fixed share, it is at least {{DEBT_SHARE_PCT}}%',
      description: 'A scheduled job at the end of each iteration counts the pull requests merged since the iteration started and those among them labelled tech-debt (the label every register variant puts on a repayment), prints the share with the number of open items (issues labelled tech-debt, open records in docs/debt, or unresolved Sonar issues, one line each), and, where a fixed share is agreed, fails below it so that the retrospective sees it. With Jira as the tracker the open count comes from JQL: labels = tech-debt AND resolution = Unresolved.',
      tool: 'gh pr list in a scheduled job (plus the register\'s own count)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/debt-share.sh [iteration-start YYYY-MM-DD]
set -euo pipefail
SINCE=\${1:-$(date -d '14 days ago' +%F 2>/dev/null || date -v-14d +%F)}
MIN="\${DEBT_SHARE_PCT:-0}"   # with a fixed share the job sets DEBT_SHARE_PCT={{DEBT_SHARE_PCT}}; 0 = report only
all=$(gh pr list --state merged --search "merged:>=$SINCE" --limit 500 --json number --jq length)
debt=$(gh pr list --state merged --label tech-debt --search "merged:>=$SINCE" --limit 500 --json number --jq length)
open=$(gh issue list --state open --label tech-debt --limit 500 --json number --jq length)   # issues as the register
# open=$(grep -L '^status: *repaid' docs/debt/[0-9]*.md | wc -l)                                 # records as the register
# open=$(curl -sf -u "$SONAR_TOKEN:" "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&resolved=false&ps=1" | jq .total)   # Sonar
share=$(( debt * 100 / (all > 0 ? all : 1) ))
echo "since $SINCE: $debt of $all merged pull requests repaid debt ($share%), $open debt items open"
[ "$share" -ge "$MIN" ] || { echo "below the agreed $MIN%"; exit 1; }`,
    },
    {
      id: 'ff-debt-windows', label: 'Repayment windows scheduled and kept', when: { BUDGET: ['windows'] }, category: 'process', implements: REGISTRIES,
      checks: ['req-windows'],
      threshold: 'debt-windows.json holds for the current quarter a window of at least {{WINDOW_DAYS_PER_QUARTER}} working days with its items picked at least 14 days before it starts; 0 pull requests merged during a window without the tech-debt label',
      description: 'A test in the unit suite reads debt-windows.json ([{ "quarter": "2026-Q4", "start": "2026-11-16", "end": "2026-11-20", "pickedOn": "2026-10-30", "items": ["SHOP-123", "DEBT-0042"] }]) and fails when the current quarter has no window, the window is shorter than {{WINDOW_DAYS_PER_QUARTER}} working days, or its items were picked fewer than 14 days before it; a scheduled job on the day after each window lists the pull requests merged during it and fails on one without the tech-debt label.',
      tool: 'Vitest (a test over debt-windows.json) with a gh pr list step',
      language: 'ts',
      snippet: `// test/debt-windows.test.ts
import { expect, it } from 'vitest'
import windows from '../debt-windows.json'

const MIN_DAYS = {{WINDOW_DAYS_PER_QUARTER}}
const now = new Date()
const quarter = \`\${now.getFullYear()}-Q\${Math.floor(now.getMonth() / 3) + 1}\`
const workingDays = (from: string, to: string): number => {
  let n = 0
  for (const d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) if (d.getDay() >= 1 && d.getDay() <= 5) n++
  return n
}

it(\`\${quarter} has a repayment window of at least \${MIN_DAYS} working days, picked 14 days ahead\`, () => {
  const w = windows.find((x) => x.quarter === quarter)
  expect(w, \`no window for \${quarter} in debt-windows.json\`).toBeTruthy()
  expect(workingDays(w!.start, w!.end), 'window too short').toBeGreaterThanOrEqual(MIN_DAYS)
  expect((Date.parse(w!.start) - Date.parse(w!.pickedOn)) / 86_400_000, 'items picked too late').toBeGreaterThanOrEqual(14)
  expect(w!.items.length, 'no items picked').toBeGreaterThan(0)
})
// the day after a window: gh pr list --state merged --search "merged:$START..$END -label:tech-debt" --json number --jq 'length == 0' || exit 1`,
    },
    {
      id: 'ff-boy-scout', label: 'Touched files do not get worse', when: { BUDGET: ['boy-scout'] }, category: 'process', implements: REGISTRIES,
      checks: ['req-boy-scout'],
      threshold: 'In every pull request the lint findings (errors and warnings) of the files it modifies are at most what they were on the base branch',
      description: 'A pull-request step lints the modified files on the head and, in a temporary worktree, on the base branch, and fails when the count of findings grew; new files are covered by the quality gate\'s own conditions. ESLint exits 1 whenever a file has an error-level finding, so each run ends in || true and the JSON (complete on exit 1) is counted. With SonarQube the same is a gate condition on new code; this script needs no platform.',
      tool: 'ESLint in a pull-request step (git worktree); ruff --output-format json for Python',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/findings-do-not-grow.sh: lint findings in modified files, head vs base (checkout with fetch-depth: 0)
set -euo pipefail
BASE=\${BASE_REF:-origin/main}
files=$(git diff --name-only --diff-filter=M "$BASE...HEAD" -- '*.ts' '*.tsx')
[ -z "$files" ] && exit 0
count() { (npx eslint --no-error-on-unmatched-pattern --format json $files || true) | jq '[.[] | .errorCount + .warningCount] | add // 0'; }
after=$(count)
git worktree add -q "$RUNNER_TEMP/base" "$BASE"
before=$(cd "$RUNNER_TEMP/base" && npm ci --silent && count)
git worktree remove --force "$RUNNER_TEMP/base"
echo "findings in touched files: $before -> $after"
[ "$after" -le "$before" ] || { echo 'touched files got worse; leave them at least as clean'; exit 1; }`,
    },
    {
      id: 'ff-deprecated-marker', label: 'Every deprecation names a replacement and a key', category: 'structural', implements: REGISTRIES,
      checks: ['req-deprecated-marked', 'req-tolerated'],
      threshold: '0 @deprecated, [Obsolete( or warnings.deprecated( markers whose text lacks a register key (KEY-123) or the word "use" naming the replacement',
      description: 'A script run in lint greps the tracked source files for deprecation markers and fails on one whose text (the rest of the line) does not name a register key and a replacement ("use OrdersV2Client"); endpoints are covered by the Deprecation header test of the sunset variant and by the handler that writes it.',
      tool: 'git grep in a lint step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/check-deprecations.sh: @deprecated use <replacement>: <reason> (KEY-123)
set -euo pipefail
bad=$(git grep -nE '@deprecated|\\[Obsolete\\(|warnings\\.deprecated\\(' -- ':!node_modules' ':!*.md' ':!scripts/check-deprecations.sh' \\
  | grep -vE '\\(([A-Z]+-[0-9]+)\\)' ; git grep -nE '@deprecated|\\[Obsolete\\(|warnings\\.deprecated\\(' -- ':!node_modules' ':!*.md' ':!scripts/check-deprecations.sh' \\
  | grep -viE '\\buse [A-Za-z_.]' ; true)
if [ -n "$bad" ]; then
  printf 'deprecation markers without a register key or a replacement ("use X"):\\n%s\\n' "$bad"
  exit 1
fi`,
    },
    {
      id: 'ff-expiring-todo', label: 'Dated TODOs expire in the lint', when: SUNSET, category: 'structural', implements: REGISTRIES,
      checks: ['req-sunset'],
      threshold: '0 TODO comments with a date in brackets whose date has passed; a TODO without a date is left to the key rule',
      description: 'Deprecated code carries its sunset as a dated TODO beside the @deprecated marker, TODO [2027-01-31] (KEY-123): remove, and unicorn/expiring-todo-comments turns the comment into a lint error the day after the date; allowWarningComments stays true so that an undated, keyed TODO is not an error here (the key rule governs it). For other languages the sunset script of this pack catches the same expired dates by grep.',
      tool: 'ESLint with eslint-plugin-unicorn (expiring-todo-comments); the sunset grep script elsewhere',
      language: 'js',
      snippet: `// eslint.config.js
import unicorn from 'eslint-plugin-unicorn'

export default [{
  plugins: { unicorn },
  rules: {
    'unicorn/expiring-todo-comments': ['error', {
      allowWarningComments: true,      // a TODO without a date is the key rule's business, not an error here
      checkDatesOnPullRequests: true,  // dates fail on pull requests too
      terms: ['todo', 'fixme'],
    }],
  },
}]
// in the code:
// /** @deprecated use OrdersV2Client: v1 has no idempotency keys (SHOP-123). TODO [2027-01-31] (SHOP-123): remove v1 */`,
    },
    {
      id: 'ff-sunset-grace', label: 'Sunsets give notice and are kept', when: SUNSET, category: 'structural', implements: REGISTRIES,
      checks: ['req-sunset'],
      threshold: '0 dated TODOs in the tree whose date has passed; 0 dated TODOs added by the pull request with a date fewer than {{SUNSET_GRACE_DAYS}} days ahead',
      description: 'A pull-request script greps every TODO [YYYY-MM-DD] in the tracked files (any language) and fails on one whose date has passed, then reads the lines the pull request added and fails on a new dated TODO whose date is inside the grace period, so a sunset cannot be set too close to be noticed.',
      tool: 'git grep and git diff in a pull-request step (GNU date)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/check-sunsets.sh: expired sunsets fail; a new sunset gives at least the grace period (checkout with fetch-depth: 0)
set -euo pipefail
GRACE={{SUNSET_GRACE_DAYS}}
today=$(date -u +%F); soonest=$(date -u -d "$GRACE days" +%F); bad=0
while IFS= read -r line; do
  d=$(grep -oE '\\[[0-9]{4}-[0-9]{2}-[0-9]{2}\\]' <<< "$line" | tr -d '[]')
  if [ "$d" \\< "$today" ]; then echo "sunset passed: $line"; bad=1; fi
done < <(git grep -nE '\\b(TODO|FIXME)\\b *\\[[0-9]{4}-[0-9]{2}-[0-9]{2}\\]' -- ':!node_modules' ':!*.md' || true)
while IFS= read -r line; do
  d=$(grep -oE '\\[[0-9]{4}-[0-9]{2}-[0-9]{2}\\]' <<< "$line" | tr -d '[]')
  if [ "$d" \\< "$soonest" ]; then echo "sunset inside the $GRACE-day grace period: $line"; bad=1; fi
done < <(git diff "origin/\${GITHUB_BASE_REF:-main}...HEAD" -- . ':!*.md' | grep -E '^\\+' | grep -E '\\b(TODO|FIXME)\\b *\\[[0-9]{4}-[0-9]{2}-[0-9]{2}\\]' || true)
exit $bad`,
    },
    {
      id: 'ff-sunset-header', label: 'Deprecated endpoints announce their sunset', when: SUNSET, category: 'process', implements: REGISTRIES,
      checks: ['req-sunset', 'req-deprecated-marked'],
      threshold: 'Every route in the deprecated-routes list answers with a Deprecation header and a Sunset header whose date is in the future and at least {{SUNSET_GRACE_DAYS}} days after the deprecation date',
      description: 'The edge keeps the deprecated routes in one list (path, deprecated-since, sunset) from which the handler writes the Deprecation (RFC 9745) and Sunset (RFC 8594) headers; an integration test calls each listed route and asserts both headers, that the sunset has not passed, and that it gives at least {{SUNSET_GRACE_DAYS}} days from the deprecation date.',
      tool: 'Vitest with supertest; the same test with httpx under pytest for Python',
      language: 'ts',
      snippet: `// test/http/sunset-headers.test.ts
import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../../src/app'
import { DEPRECATED_ROUTES } from '../../src/http/deprecated-routes'   // [{ path: '/v1/orders', since: '2026-10-01', sunset: '2027-01-31', key: 'SHOP-123' }]

const GRACE = {{SUNSET_GRACE_DAYS}}

it.each(DEPRECATED_ROUTES)('$path announces its deprecation and sunset', async (route) => {
  const res = await request(app).get(route.path)
  expect(res.headers['deprecation'], 'Deprecation header').toBeTruthy()
  const sunset = Date.parse(res.headers['sunset'])
  expect(sunset, 'Sunset header is a date').not.toBeNaN()
  expect(sunset, \`\${route.path} is past its sunset: remove it (\${route.key})\`).toBeGreaterThan(Date.now())
  expect((sunset - Date.parse(route.since)) / 86_400_000, 'sunset gives the grace period').toBeGreaterThanOrEqual(GRACE)
})`,
    },
    {
      id: 'ff-no-deprecated', label: 'No new calls to deprecated code', category: 'structural', implements: REGISTRIES,
      checks: ['req-no-new-callers', 'req-tolerated'],
      threshold: '0 calls to code marked @deprecated without a line-level disable naming a register key',
      description: 'Lint fails on a call to or import of anything marked @deprecated, using type information so that re-exports and overloads count too; an existing call is tolerated only with a line disable whose description names the register key (the Code quality gate\'s require-description rule makes the description mandatory). On the JVM the same is javac -Xlint:deprecation -Werror; in .NET, CS0618 as an error in the project file.',
      tool: 'typescript-eslint (@typescript-eslint/no-deprecated); javac -Xlint:deprecation for the JVM',
      language: 'js',
      snippet: `// eslint.config.js
import tseslint from 'typescript-eslint'

export default tseslint.config({
  files: ['src/**/*.ts', 'src/**/*.tsx'],
  languageOptions: { parserOptions: { projectService: true } },
  rules: { '@typescript-eslint/no-deprecated': 'error' },
})
// a tolerated existing call names its debt item:
// // eslint-disable-next-line @typescript-eslint/no-deprecated -- SHOP-123, goes with the v1 sunset`,
    },
    {
      id: 'ff-strangler-boundary', label: 'Legacy reached only through the facade', when: { REWRITE: ['strangler'] }, category: 'structural', implements: ['adr-strangler'],
      checks: ['req-strangler'],
      threshold: '0 imports of src/legacy from outside src/legacy and src/facade',
      description: 'A dependency rule fails the build when any module outside the legacy code and the facade imports the legacy code directly, so that new code grows only on the new side and the old module can be deleted piece by piece. On the JVM an ArchUnit rule noClasses().that().resideOutsideOfPackages("..legacy..", "..facade..").should().dependOnClassesThat().resideInAPackage("..legacy..") does the same.',
      tool: 'dependency-cruiser; ArchUnit for the JVM',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'legacy-only-through-facade',
    comment: 'ADR Strangler fig: new code calls the facade; the legacy module is reached only through it',
    severity: 'error',
    from: { pathNot: '^src/(legacy|facade)/' },
    to: { path: '^src/legacy/' },
  }],
  options: { tsConfig: { fileName: 'tsconfig.json' } },
}`,
    },
    {
      id: 'ff-rewrite-case', label: 'A rewrite has an accepted case', when: { REWRITE: ['big-bang-allowed'] }, category: 'process', implements: ['adr-big-bang'],
      checks: ['req-rewrite-case'],
      threshold: 'Every ADR of kind rewrite has status accepted, at least 2 names in accepted_by and the sections Cost, Risks, Parity criteria and Cut-over; 0 pull requests labelled rewrite whose description links no such ADR',
      description: 'Rewrite cases are ADRs with kind: rewrite in their front matter. A test in the unit suite fails on a rewrite ADR that is not accepted by at least two owners or lacks one of the required sections; a pull-request step on a pull request labelled rewrite reads the docs/adr path from its description and fails unless that file has kind rewrite and status accepted.',
      tool: 'Vitest with gray-matter (plus a gh pr view step)',
      language: 'ts',
      snippet: `import { readFileSync, readdirSync } from 'node:fs'
import matter from 'gray-matter'
import { expect, it } from 'vitest'

const SECTIONS = ['## Cost', '## Risks', '## Parity criteria', '## Cut-over']
const rewrites = readdirSync('docs/adr').filter((f) => f.endsWith('.md'))
  .map((f) => ({ f, ...matter(readFileSync(\`docs/adr/\${f}\`, 'utf8')) }))
  .filter(({ data }) => data.kind === 'rewrite')

it.each(rewrites)('$f is an accepted rewrite case', ({ data, content }) => {
  expect(data.status).toBe('accepted')
  expect(data.accepted_by?.length ?? 0, 'owners who accepted it').toBeGreaterThanOrEqual(2)
  for (const s of SECTIONS) expect(content, s).toContain(s)
})
// pull-request step, when the pull request carries the label rewrite:
//   adr=$(gh pr view "$PR" --json body --jq .body | grep -oE 'docs/adr/[0-9]{4}-[a-z0-9-]+\\.md' | head -1)
//   [ -n "$adr" ] && grep -qE '^kind: *rewrite' "$adr" && grep -qE '^status: *accepted' "$adr" || { echo "link an accepted rewrite ADR"; exit 1; }`,
    },
    {
      id: 'ff-debt-age', label: 'Old debt issues are escalated', when: { AGE: ['max-age'], REGISTRY: ['issues'] }, category: 'process', implements: ['adr-issues'],
      checks: ['req-age'],
      threshold: '0 open issues labelled tech-debt older than {{MAX_DEBT_AGE_DAYS}} days without the label escalated or accepted-debt',
      description: 'A weekly job lists open debt issues older than {{MAX_DEBT_AGE_DAYS}} days that carry neither escalated nor accepted-debt and fails naming them, so that the run shows red until each is escalated, scheduled or closed as accepted. With Jira the same is JQL: labels = tech-debt AND created <= -{{MAX_DEBT_AGE_DAYS}}d AND labels not in (escalated, accepted-debt) AND resolution = Unresolved.',
      tool: 'gh issue list in a scheduled job; a JQL filter for Jira',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/debt-age.sh: weekly
set -euo pipefail
export MAX={{MAX_DEBT_AGE_DAYS}}
old=$(gh issue list --label tech-debt --state open --limit 500 --json number,title,createdAt,labels --jq '
  .[] | select((now - (.createdAt | fromdateiso8601)) > (env.MAX | tonumber) * 86400)
      | select(any(.labels[].name; . == "escalated" or . == "accepted-debt") | not)
      | "#\\(.number) \\(.title) (opened \\(.createdAt[:10]))"')
if [ -n "$old" ]; then
  printf 'debt items older than %s days without a decision:\\n%s\\n' "$MAX" "$old"
  exit 1
fi`,
    },
    {
      id: 'ff-debt-age-records', label: 'Old debt records are escalated', when: { AGE: ['max-age'], REGISTRY: ['adrs'] }, category: 'process', implements: ['adr-adrs'],
      checks: ['req-age'],
      threshold: '0 records in docs/debt with status open and a date older than {{MAX_DEBT_AGE_DAYS}} days without escalated: true in the front matter',
      description: 'A test in the unit suite reads the front matter of every record in docs/debt and fails on one still open (not accepted, not repaid) whose date is older than {{MAX_DEBT_AGE_DAYS}} days and which is not marked escalated: true; marking it accepted with the reason in the record, or repaid, is the way out.',
      tool: 'Vitest with gray-matter; pytest with python-frontmatter for Python',
      language: 'ts',
      snippet: `import { readFileSync, readdirSync } from 'node:fs'
import matter from 'gray-matter'
import { expect, it } from 'vitest'

const MAX_DAYS = {{MAX_DEBT_AGE_DAYS}}
const files = readdirSync('docs/debt').filter((f) => /^\\d{4}-.*\\.md$/.test(f))
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''))

it.each(files)('%s is repaid, accepted, escalated or young', (file) => {
  const { data } = matter(readFileSync(\`docs/debt/\${file}\`, 'utf8'))
  if (data.status !== 'open' || data.escalated === true) return
  const age = (Date.now() - Date.parse(iso(data.date))) / 86_400_000
  expect(age, \`\${file} (owner \${data.owner}) is \${Math.floor(age)} days old: escalate, schedule or accept it\`).toBeLessThanOrEqual(MAX_DAYS)
})`,
    },
    {
      id: 'ff-debt-age-sonar', label: 'Old Sonar issues are escalated', when: { AGE: ['max-age'], REGISTRY: ['tool'] }, category: 'process', implements: ['adr-tool'],
      checks: ['req-age'],
      threshold: '0 unresolved issues created more than {{MAX_DEBT_AGE_DAYS}} days ago without the tag escalated or accepted-debt',
      description: 'A weekly job asks the issues API for unresolved issues created before the limit and fails on those without the tag escalated or accepted-debt (tags are set on the issue in the platform); accepting an issue as won\'t fix with a reason resolves it and takes it out of the list.',
      tool: 'SonarQube web API (api/issues/search) with curl and jq',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# weekly: unresolved issues older than the limit carry an escalation or acceptance tag
set -euo pipefail
before=$(date -u -d '{{MAX_DEBT_AGE_DAYS}} days ago' +%F 2>/dev/null || date -u -v-{{MAX_DEBT_AGE_DAYS}}d +%F)
old=$(curl -sf -u "$SONAR_TOKEN:" "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&resolved=false&createdBefore=$before&ps=500" \\
  | jq -r '.issues[] | select((.tags | index("escalated") == null) and (.tags | index("accepted-debt") == null)) | "\\(.key) \\(.creationDate[:10]) \\(.message)"')
[ -z "$old" ] || { echo "issues older than {{MAX_DEBT_AGE_DAYS}} days without a decision:"; echo "$old"; exit 1; }`,
    },
  ],
}

export default pack
