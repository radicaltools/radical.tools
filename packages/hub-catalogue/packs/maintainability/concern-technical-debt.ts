import type { PackSpec, When } from '../../src/packSpec'

const REGISTRIES = ['adr-issues', 'adr-adrs', 'adr-tool']
const KEYED: When = { REGISTRY: ['issues', 'adrs'] }
const FORCES = 'Code lives in this element and every deadline leaves a shortcut in it; whether those shortcuts are seen, counted and repaid decides how fast the element can change next year. The forces: debt taken knowingly for a deadline is a sound loan and debt taken unknowingly is a surprise, and both charge interest in every change that touches them (Cunningham\'s metaphor, Fowler\'s quadrant); a debt nobody can see is never repaid, while a register nobody prunes becomes a graveyard; time for repayment competes with features in every planning, and a team that gets none slows down without anyone having decided it; deprecated code, endpoints and feature flags stay because removing them has no sponsor and no date; and a full rewrite looks like freedom from all debt and usually recreates it, two years late (Spolsky). What a change must pass to be merged is decided by the Code quality gate concern and which tests it has by the Test strategy concern; this decision is about the debt that is already there and the debt taken on purpose.'

const pack: PackSpec = {
  id: 'concern-technical-debt',
  name: 'Technical debt',
  group: 'maintainability',
  description: 'Where technical debt is written down so that it can be seen, how much of the team\'s time repaying it gets, how deprecated code, endpoints and feature flags are retired, and how a rewrite is decided.',
  tags: ['maintainability', 'technical debt', 'deprecation', 'feature flags', 'strangler fig', 'refactoring'],
  concern: {
    id: 'technical-debt',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements and accumulates shortcuts, so where that debt is recorded, how it is repaid and how old code is retired has to be decided.',
  },
  sources: [
    { title: 'Ward Cunningham: Ward Explains Debt Metaphor (c2.com)', url: 'https://wiki.c2.com/?WardExplainsDebtMetaphor' },
    { title: 'Martin Fowler: TechnicalDebt', url: 'https://martinfowler.com/bliki/TechnicalDebt.html' },
    { title: 'Martin Fowler: TechnicalDebtQuadrant', url: 'https://martinfowler.com/bliki/TechnicalDebtQuadrant.html' },
    { title: 'Martin Fowler: StranglerFigApplication', url: 'https://martinfowler.com/bliki/StranglerFigApplication.html' },
    { title: 'Kruchten, Nord, Ozkaya: Technical Debt: From Metaphor to Theory and Practice (IEEE Software, 2012)', url: 'https://ieeexplore.ieee.org/document/6336722' },
    { title: 'SonarSource: Metric definitions, technical debt and the SQALE debt ratio', url: 'https://docs.sonarsource.com/sonarqube-server/latest/user-guide/code-metrics/metrics-definition/' },
    { title: 'Michael Nygard: Documenting Architecture Decisions', url: 'https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions' },
    { title: 'Pete Hodgson: Feature Toggles (martinfowler.com)', url: 'https://martinfowler.com/articles/feature-toggles.html' },
    { title: 'RFC 8594, The Sunset HTTP Header Field', url: 'https://www.rfc-editor.org/rfc/rfc8594' },
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
        { value: 'adrs', label: 'decision records in the repository', description: 'Debt is recorded as decision records next to the ADRs (docs/debt/NNNN-*.md in Nygard\'s format) with an owner, a cost and a consequences section; items too small for a record are TODO (DEBT-NNNN) comments pointing at one. Pick it when the debt is architectural (a wrong boundary, a library to leave, a schema to split) and the reasoning matters more than the ticket, or when the tracker belongs to someone else.' },
        { value: 'tool', label: 'a code-analysis platform, no separate list', description: 'SonarQube or SonarCloud is the register: each open issue carries its remediation effort, the sum is the debt, the debt ratio is a quality-gate condition and the dashboard is the report; an issue accepted as "won\'t fix" with a reason is tolerated debt. Pick it when most of the debt is in the code itself (duplication, complexity, smells) and nobody will keep a list by hand.' },
      ],
    },
    {
      key: 'BUDGET', title: 'Budget', label: 'How much of the team\'s time does repayment get?',
      hint: 'Repayment that is not planned does not happen; a budget turns "we should" into a share of every iteration, a window on the calendar or a rule for every change.',
      default: 'fixed-share',
      options: [
        { value: 'fixed-share', label: 'a fixed share of every iteration', description: 'At least {{DEBT_SHARE_PCT}}% of each iteration\'s capacity goes to items from the register, picked by the team, and the share reached is reported at the end. Pick it when the team plans in iterations and the debt is spread across the code rather than in a few large items.' },
        { value: 'windows', label: 'dedicated windows: a fix-it week per quarter or a debt sprint per release', description: '{{WINDOW_DAYS_PER_QUARTER}} days a quarter are blocked for repayment only, with the items picked from the register before the window starts. Pick it when the debt comes in large items (a migration, a framework upgrade) that cannot be done in slices beside feature work.' },
        { value: 'boy-scout', label: 'no budget: the boy-scout rule', description: 'Every change leaves the code it touches a little better, and a touched file\'s warnings may not grow; debt is repaid in passing and the register shrinks only where people work. Pick it for a small codebase with a steady team and little debt, where a budget would be more ceremony than work.' },
      ],
    },
    {
      key: 'DEPRECATION', title: 'Deprecation', label: 'What happens to deprecated code, endpoints and flags?',
      hint: 'Deprecated code that stays costs a little in every change and a lot in the one that finally removes it; a date gives removal a sponsor.',
      default: 'sunset',
      options: [
        { value: 'sunset', label: 'a sunset date, enforced', description: 'Everything deprecated (code, endpoints, feature flags) carries a sunset date at least {{SUNSET_GRACE_DAYS}} days ahead and is removed by it; a check fails the build the day after. Pick it when the team can commit to removal dates, including for endpoints other teams call.' },
        { value: 'tolerated', label: 'marked and tolerated', description: 'Deprecated code is marked with its reason and replacement and no new code may call it, but it is removed only when it blocks a change. Pick it when callers you do not control depend on it and a date you cannot enforce would only be missed.' },
      ],
    },
    {
      key: 'REWRITE', title: 'Rewrite', label: 'How is a rewrite decided?',
      hint: 'A full rewrite stops delivery for months and recreates the bugs the old code had already fixed; a piece-by-piece replacement keeps the old system in production until each piece is proven.',
      default: 'strangler',
      options: [
        { value: 'strangler', label: 'piece by piece (strangler fig)', description: 'A rewrite replaces one piece at a time behind a facade, old and new running side by side with a cut-over and a way back per piece; big-bang rewrites are not done. Pick it by default, and always when the element serves users while it is rewritten.' },
        { value: 'big-bang-allowed', label: 'a full rewrite is allowed with a written case', description: 'A full rewrite may be started when a written case with cost, risk, parity criteria and what the old code knows that nobody remembers is accepted by the owners and recorded as an ADR. Pick it when the element is small, its behaviour is fully specified by tests, or it must leave a platform that is going away.' },
      ],
    },
    {
      key: 'AGE', title: 'Age limit', label: 'Is there a maximum age for a debt item?',
      hint: 'A register that only grows stops being read; an age limit forces a decision on every item: schedule it, or accept the debt in writing and close it.',
      default: 'max-age',
      options: [
        { value: 'max-age', label: 'escalated after a maximum age', description: 'A debt item older than {{MAX_DEBT_AGE_DAYS}} days is escalated to the owner\'s lead and either scheduled into the next iteration or window, or closed with a written decision that the debt is accepted. Pick it when the register has more than a few dozen items or several teams feed it.' },
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
    { key: 'MAX_FLAG_AGE_DAYS', label: 'How many days may a feature flag stay in the code after its rollout?', default: '90', number: true },
  ],
  need: {
    label: 'Debt is visible and repaid on purpose',
    text: 'Every shortcut taken in this element charges interest in each later change that touches it. The team needs the debt written down where planning can see it, with an owner, what repaying costs and what leaving it costs; a known share of its time to repay it; deprecated code, endpoints and flags that actually go away; and a way to decide a rewrite that does not stop delivery for a year. Without this the element gets slower to change every quarter and nobody can say why.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-todo-key', label: 'Every TODO names a debt item', when: KEYED, ears_type: 'ubiquitous',
      action: 'allow a TODO, FIXME, HACK or XXX comment only in the form TODO (KEY-123), where KEY-123 is an open item of the register, and fail lint on a comment without a key and the build on a comment whose item is closed',
      rationale: 'A TODO without a record is debt only its author knows about; one pointing at a closed item is a repaid debt nobody removed from the code (Fowler, TechnicalDebt; Kruchten et al.: debt items need an identity to be managed).',
      scenario: { label: 'Keyless TODO refused', given: 'a pull request with a TODO without a key, a TODO (KEY-123) whose item is open, and a TODO (KEY-99) whose item is closed', when: 'lint and the build run', then: 'lint names the keyless comment, the build names KEY-99 as closed, and only KEY-123 passes' },
    },
    {
      id: 'req-debt-record', label: 'Debt items carry owner, cost and consequence', ears_type: 'ubiquitous',
      action: 'record for every debt item an owner, an estimate of what repaying it costs (days or remediation effort) and the consequence of leaving it (what gets slower, riskier or impossible), and refuse an item without them at triage',
      rationale: 'Debt is a decision about interest against principal; without cost and consequence there is nothing to decide with, and without an owner nobody brings it to planning (Kruchten, Nord, Ozkaya: a technical debt item; Cunningham).',
      scenario: { label: 'Incomplete item sent back', given: 'a new debt item without a consequence', when: 'it reaches triage', then: 'it is sent back to its author and does not enter planning until owner, cost and consequence are filled in' },
    },
    {
      id: 'req-share-reported', label: 'Repayment share is measured', ears_type: 'event-driven',
      trigger: 'an iteration ends',
      action: 'report the share of the work items closed in it that were debt items, with the register\'s size and total estimated cost, where the team and its stakeholders see it',
      rationale: 'What is not measured is the first thing cut; Accelerate links sustained delivery performance to time deliberately spent on the system itself.',
      scenario: { label: 'Share in the iteration report', given: 'an iteration in which 12 work items were closed, 3 of them debt items', when: 'it ends', then: 'the report shows 25% debt work, the number of open items and their total estimated cost' },
    },
    {
      id: 'req-fixed-share', label: 'A share of every iteration', when: { BUDGET: ['fixed-share'] }, ears_type: 'state-driven',
      precondition: 'an iteration is being planned',
      action: 'reserve at least {{DEBT_SHARE_PCT}}% of its capacity for items from the register, chosen by the team by consequence, and treat a share below {{DEBT_SHARE_PCT}}% at the iteration\'s end as a planning failure to explain in the retrospective',
      rationale: 'Repayment that competes with features item by item loses every time; a fixed share removes the per-item negotiation (Fowler, TechnicalDebt: paying down with every iteration).',
      scenario: { label: 'Share planned and kept', given: 'an iteration with 40 points of capacity and {{DEBT_SHARE_PCT}}% reserved', when: 'it is planned and then closes', then: 'at least {{DEBT_SHARE_PCT}}% of the planned and of the closed points are debt items, or the retrospective records why not' },
    },
    {
      id: 'req-windows', label: 'Repayment windows on the calendar', when: { BUDGET: ['windows'] }, ears_type: 'event-driven',
      trigger: 'a quarter starts',
      action: 'block at least {{WINDOW_DAYS_PER_QUARTER}} days of the whole team for repayment only, pick the items from the register at least 2 weeks before the window by consequence, and accept no feature work into the window',
      rationale: 'Large items (an upgrade, a migration) cannot be sliced beside feature work; a window only works when it is on the calendar before features claim it (Kruchten et al.: debt repayment as planned work).',
      scenario: { label: 'Window held', given: 'a quarter with its window scheduled and items picked', when: 'the window runs', then: 'the picked items are closed or re-estimated, and no feature work was merged by the team during it' },
    },
    {
      id: 'req-boy-scout', label: 'Touched files do not get worse', when: { BUDGET: ['boy-scout'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request leaves a file it changed with more lint warnings, more duplicated lines or higher cyclomatic complexity than before',
      action: 'fail the check and block the merge until the touched file is at least as clean as it was',
      rationale: 'Without a budget the only repayment is in passing; the rule makes "a little better" checkable instead of hoped for (Robert Martin\'s boy-scout rule, cited in Fowler, TechnicalDebt).',
      scenario: { label: 'Warnings grew in a touched file', given: 'a file with 4 lint warnings', when: 'a pull request changes it and leaves 5', then: 'the check fails naming the file, and passes once the count is 4 or fewer' },
    },
    {
      id: 'req-deprecated-marked', label: 'Deprecated code says why and what instead', ears_type: 'ubiquitous',
      action: 'mark every deprecated function, module, endpoint and flag with the language\'s deprecation marker (@deprecated, [Obsolete], warnings.deprecated) carrying the reason, the replacement and the register key, and answer deprecated endpoints with a Deprecation header',
      rationale: 'A deprecation without a replacement teaches nothing and is ignored; one with a key can be planned (RFC 8594; ISO 25010 analysability).',
      scenario: { label: 'Marker complete', given: 'a function deprecated in a pull request', when: 'the review reads its marker', then: 'it names the reason, the replacement and the register key, and calls to it now raise a compiler or lint warning' },
    },
    {
      id: 'req-sunset', label: 'Deprecated things carry a sunset and go', when: { DEPRECATION: ['sunset'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a deprecated function, module, endpoint or flag is still in the code after its sunset date, or is deprecated with a sunset less than {{SUNSET_GRACE_DAYS}} days ahead',
      action: 'fail the build naming the item, and for endpoints send the sunset date in a Sunset header from the day of deprecation so that callers see it coming',
      rationale: 'Removal has no sponsor unless a date forces one; a build that fails after the date is a sponsor that never forgets (RFC 8594; Hodgson, Feature Toggles: toggles have an expiration).',
      scenario: { label: 'Build fails after sunset', given: 'a module marked deprecated with a sunset of 2027-01-31', when: 'the build runs on 2027-02-01 with the module still there', then: 'the build fails naming the module and its sunset' },
    },
    {
      id: 'req-no-new-callers', label: 'No new callers of deprecated code', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'new or changed code calls or imports something marked deprecated',
      action: 'fail lint, unless the line carries a disable comment naming the register key under which the call is tolerated',
      rationale: 'Deprecated code can only be removed when its callers stop growing; a named exception keeps the debt visible instead of hidden in a blanket disable (Fowler, StranglerFigApplication: the old code shrinks only if nothing new depends on it).',
      scenario: { label: 'New call to deprecated code refused', given: 'a function marked @deprecated', when: 'a pull request adds a call to it without a disable comment, and another with one naming KEY-123', then: 'the first fails lint and the second passes' },
    },
    {
      id: 'req-flags-sunset', label: 'Feature flags are removed after rollout', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a release or experiment flag is still in the code more than {{MAX_FLAG_AGE_DAYS}} days after it was created, or past the retire-by date in its definition',
      action: 'fail the build naming the flag and its owner; permanent operational flags (kill switches, per-tenant permissions) are marked permanent in the flag definition and exempt',
      rationale: 'Every flag doubles the paths through the code it guards; release toggles are meant to live days or weeks, and the ones that stay are the debt nobody wrote down (Hodgson, Feature Toggles: managing the toggle inventory).',
      scenario: { label: 'Stale flag fails the build', given: 'a release flag created {{MAX_FLAG_AGE_DAYS}} days ago plus one, and a kill switch marked permanent', when: 'the flag test runs', then: 'it fails naming the release flag and its owner, and ignores the kill switch' },
    },
    {
      id: 'req-no-new-debt', label: 'New debt comes with its record', ears_type: 'event-driven',
      trigger: 'a pull request knowingly takes a shortcut: it waives a quality-gate condition, suppresses a warning, skips a test or adds a TODO',
      action: 'carry the register key of a debt item opened in the same pull request, with owner, cost and consequence, so that 0 shortcuts are merged without a record',
      rationale: 'Deliberate debt is sound only when it is written down at the moment it is taken; afterwards nobody remembers it was a loan (Fowler, TechnicalDebtQuadrant: deliberate and prudent). What the gate itself requires is the Code quality gate concern\'s decision.',
      scenario: { label: 'Suppressed warning has a key', given: 'a pull request that adds a lint-disable comment', when: 'it is reviewed', then: 'the comment names a register key opened in the same pull request, or the pull request is not approved' },
    },
    {
      id: 'req-strangler', label: 'Rewrites go piece by piece', when: { REWRITE: ['strangler'] }, ears_type: 'ubiquitous',
      action: 'replace an element or module to be rewritten one piece at a time behind a facade that routes each piece to old or new, keep old and new running side by side with a documented cut-over and a way back per piece, and merge no change that routes more than one piece at once or lets new code bypass the facade',
      rationale: 'The old system keeps serving while each new piece is proven in production, and a failed piece is routed back instead of rolled back as a whole (Fowler, StranglerFigApplication; Spolsky on what a rewrite forgets).',
      scenario: { label: 'One piece cut over', given: 'a facade routing orders to the old module and the new one ready', when: 'the orders piece is cut over and a defect appears', then: 'the facade routes orders back to the old module within minutes and no other piece was affected' },
    },
    {
      id: 'req-rewrite-case', label: 'A rewrite needs an accepted case', when: { REWRITE: ['big-bang-allowed'] }, ears_type: 'event-driven',
      trigger: 'a full rewrite of the element or of one of its modules is proposed',
      action: 'write the case as an ADR with the cost in person-months, the risks, the parity criteria (which tests and behaviours the new code must match), what the old code handles that no document describes, and a cut-over plan, and start no rewrite code before the owners have accepted it in writing',
      rationale: 'A rewrite is the costliest way to repay debt and usually recreates the bugs the old code had fixed; a written case makes the gamble explicit before months are spent (Spolsky, Things You Should Never Do; Nygard, Documenting Architecture Decisions).',
      scenario: { label: 'Rewrite without case stopped', given: 'a branch starting a rewrite without an accepted ADR', when: 'it is opened as a pull request', then: 'it is closed with a pointer to the ADR template, and reopened only after the owners accept the case' },
    },
    {
      id: 'req-age', label: 'Old debt items get a decision', when: { AGE: ['max-age'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a debt item has been open for more than {{MAX_DEBT_AGE_DAYS}} days',
      action: 'escalate it to the owner\'s lead within 1 week, and either schedule it into the next iteration or window or close it with a written decision that the debt is accepted, so that 0 items are older than {{MAX_DEBT_AGE_DAYS}} days plus 1 week without one',
      rationale: 'A register that only grows stops being read; forcing a decision keeps every item either moving or honestly accepted (Kruchten et al.: debt that is never repaid should be declared, not carried).',
      scenario: { label: 'Old item escalated', given: 'a debt item opened {{MAX_DEBT_AGE_DAYS}} days ago plus one', when: 'the age check runs', then: 'it names the item, and within 1 week the item is scheduled or closed as accepted debt with the decision in its record' },
    },
    {
      id: 'req-tool-ratio', label: 'Debt ratio bounded in the gate', when: { REGISTRY: ['tool'] }, ears_type: 'ubiquitous',
      action: 'keep the technical debt ratio on new code at or below {{MAX_DEBT_RATIO_PCT}}% as a quality-gate condition, show the overall ratio and total remediation effort on the project dashboard, assign every open issue to an owner, and accept an issue as won\'t fix only with a written reason',
      rationale: 'With the platform as the register, the ratio is the one number debt is managed by, and an unassigned or silently accepted issue is debt that has left the register (SonarSource, metric definitions: technical debt ratio; SQALE).',
      scenario: { label: 'Ratio over the limit fails the gate', given: 'a pull request whose new code has a debt ratio of {{MAX_DEBT_RATIO_PCT}}% plus 1', when: 'the analysis runs', then: 'the quality gate fails on the debt-ratio condition and the pull request cannot be merged' },
    },
  ],
  adrs: [
    {
      id: 'adr-issues', label: 'Debt is tracked as issues labelled tech-debt', when: { REGISTRY: ['issues'] },
      decision: 'Every debt item is an issue in the tracker (GitHub Issues, Jira or Linear) with the label tech-debt, an assignee as owner, a cost estimate in days and a Consequence section; an issue form (.github/ISSUE_TEMPLATE/tech-debt.yml with required fields) makes cost and consequence mandatory, and the weekly triage closes or completes an item without an assignee. Debt is triaged in the same weekly triage as bugs. Code points at an item with TODO (KEY-123): lint fails a TODO without a key and a CI script fails the build on a TODO whose issue is closed. Repayment budget: {{BUDGET}}. Deprecated code, endpoints and flags: {{DEPRECATION}}. Rewrites: {{REWRITE}}. Age: {{AGE}}. A shortcut taken knowingly in a pull request (a waived quality-gate condition, a suppressed warning, a skipped test) opens its issue in the same pull request.',
      consequences: '• Debt competes for the same backlog as features and bugs, on the same board, with the same estimates.\n• The share of debt work per iteration falls out of the tracker for free.\n• A tracker fills with small items quickly; triage must close duplicates and merge siblings or the label becomes noise.\n• Architectural debt gets a ticket-sized description; the reasoning behind it needs an ADR beside the issue.',
      alternatives: '1. Decision records in the repository: better for architectural debt with reasoning, but invisible to the planning board unless mirrored.\n2. A code-analysis platform as the register: free for debt in the code itself, blind to debt in design, process or missing tests.\n3. A wiki page or spreadsheet: easy to start, outside every workflow, and the first thing to go stale.',
    },
    {
      id: 'adr-adrs', label: 'Debt is recorded as decision records', when: { REGISTRY: ['adrs'] },
      decision: 'Debt is recorded as decision records in the repository, docs/debt/NNNN-title.md in Nygard\'s format (context, decision, consequences) with front matter owner, cost_days, status and, where one exists, sunset; managed with adr-tools or log4brains and reviewed in the pull request like code. Its number is its key: TODO (DEBT-0042) points at it from the code, lint fails a TODO without a key, and a test over the records fails the build on a missing owner, cost or consequences section or a sunset in the past. Items too small for a record are TODO comments pointing at the record of the debt they belong to. Repayment budget: {{BUDGET}}. Deprecated code, endpoints and flags: {{DEPRECATION}}. Rewrites: {{REWRITE}}. Age: {{AGE}}. A shortcut taken knowingly in a pull request adds or amends a record in the same pull request.',
      consequences: '• The reasoning travels with the code: a record says why the debt was taken and what repaying it means, which a ticket never does.\n• Records are reviewed, versioned and searchable with the code; no second system.\n• Planning does not see docs/debt unless the team mirrors items into the tracker or reads the register at every planning.\n• Small items are expensive to record, so some go unrecorded; the TODO rule catches those that reach the code.',
      alternatives: '1. Issues labelled tech-debt: visible in planning, cheaper per item, poorer at reasoning.\n2. A code-analysis platform as the register: measures debt in the code, says nothing about why it is there.\n3. Debt sections inside the architecture ADRs themselves: fewer files, but the debt disappears into decisions nobody reopens.',
    },
    {
      id: 'adr-tool', label: 'Debt is tracked in the code-analysis platform', when: { REGISTRY: ['tool'] },
      decision: 'SonarQube (or SonarCloud) is the register: each open issue carries its remediation effort, the sum is the technical debt, and the debt ratio (remediation effort over development cost, SQALE) is a quality-gate condition, at most {{MAX_DEBT_RATIO_PCT}}% on new code; the project dashboard shows the overall ratio and effort and is the report. Every open issue is assigned to an owner; an issue is accepted (won\'t fix) only with a comment giving the reason, and accepted issues are the tolerated debt. TODO comments are flagged by rule S1135 and counted as debt. There is no separate list; debt outside the code (a design to change, a missing test suite) gets a ticket or ADR only by exception and is linked from a Sonar issue where one exists. Repayment budget: {{BUDGET}}. Deprecated code, endpoints and flags: {{DEPRECATION}}. Rewrites: {{REWRITE}}. Age: {{AGE}}.',
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
      decision: 'A full rewrite of the element or of a module may be started only after a case written as an ADR is accepted in writing by the owners: cost in person-months, risks, parity criteria (the tests and behaviours the new code must match, run against both), what the old code handles that no document describes, a data migration and a cut-over plan with a rollback. Until the ADR is accepted no rewrite code is merged. Where the element serves users during the rewrite, the strangler-fig approach is preferred and the case must say why it does not apply.',
      consequences: '• A rewrite becomes a decision with a price instead of a mood; most proposals do not survive writing the case.\n• When one is accepted, the parity criteria make "done" testable.\n• The old system still has to be maintained while the new one is built; the case has to budget for both.\n• Months of a rewrite are months without visible features; stakeholders accept that in the ADR, not after.',
      alternatives: '1. Strangler fig only: no rewrite stops delivery, but a small element or one leaving its platform pays for a facade it does not need.\n2. No rule: rewrites start on enthusiasm and end on budget.\n3. Rewrite only within fixed windows: bounds the cost but rarely the risk.',
    },
  ],
  fitness: [
    {
      id: 'ff-todo-key', label: 'Every TODO names a key', when: KEYED, category: 'structural', implements: ['adr-issues', 'adr-adrs'],
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
      id: 'ff-todo-closed', label: 'No TODO points at a closed issue', when: { REGISTRY: ['issues'] }, category: 'structural', implements: ['adr-issues'],
      threshold: '0 TODO comments whose issue is closed; the build fails on the first',
      description: 'A CI step collects every key from TODO comments, asks the tracker for the issue\'s state and fails when one is closed: the debt was repaid or dropped and the comment is stale. The snippet reads GitHub issues with gh (key SHOP-123 is issue 123 of the repository); for Jira replace the gh call with GET /rest/api/3/issue/KEY?fields=status.',
      tool: 'gh api in a CI step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/check-todo-issues.sh: a TODO (SHOP-123) must point at an open issue
set -euo pipefail
REPO=\${GITHUB_REPOSITORY:-acme/shop}
stale=0
for key in $(git grep -ohE '\\b(TODO|FIXME)\\b[^(]*\\(([A-Z]+-[0-9]+)\\)' -- ':!node_modules' | grep -oE '[A-Z]+-[0-9]+' | sort -u); do
  state=$(gh api "repos/$REPO/issues/\${key##*-}" --jq .state 2>/dev/null || echo missing)
  if [ "$state" != "open" ]; then echo "TODO ($key): issue is $state"; stale=1; fi
done
exit $stale`,
    },
    {
      id: 'ff-debt-register', label: 'Debt records are complete and not past sunset', when: { REGISTRY: ['adrs'] }, category: 'structural', implements: ['adr-adrs'],
      threshold: '0 records in docs/debt without owner, cost_days and a Consequences section; 0 open records with a sunset in the past',
      description: 'A test in the unit suite parses the front matter of every record in docs/debt and fails on a missing owner, a cost of 0 or none, a missing Consequences heading, or a record not marked repaid whose sunset date has passed.',
      tool: 'Vitest with gray-matter',
      language: 'ts',
      snippet: `import { readFileSync, readdirSync } from 'node:fs'
import matter from 'gray-matter'
import { expect, it } from 'vitest'

const files = readdirSync('docs/debt').filter((f) => /^\\d{4}-.*\\.md$/.test(f))

it.each(files)('%s has an owner, a cost, consequences and a live sunset', (file) => {
  const { data, content } = matter(readFileSync(\`docs/debt/\${file}\`, 'utf8'))
  expect(data.owner, 'owner').toBeTruthy()
  expect(Number(data.cost_days), 'cost_days').toBeGreaterThan(0)
  expect(content).toMatch(/^## Consequences/m)
  if (data.status !== 'repaid' && data.sunset) expect(Date.parse(data.sunset)).toBeGreaterThan(Date.now())
})`,
    },
    {
      id: 'ff-debt-ratio', label: 'Debt ratio in the quality gate', when: { REGISTRY: ['tool'] }, category: 'process', implements: ['adr-tool'],
      threshold: 'Technical debt ratio on new code at most {{MAX_DEBT_RATIO_PCT}}% and maintainability rating A on new code; the quality gate fails the pull request otherwise',
      description: 'The project\'s quality gate carries the conditions new_sqale_debt_ratio > {{MAX_DEBT_RATIO_PCT}} and new_maintainability_rating > A as errors, added once through the API (or in the gate\'s settings page), and the pipeline waits for the gate with sonar.qualitygate.wait=true so that a failed gate fails the build.',
      tool: 'SonarQube quality gate (api/qualitygates)',
      language: 'bash',
      snippet: `# once, for the gate the project uses (SonarQube 10.x; SonarCloud: the same API under sonarcloud.io)
curl -sf -u "$SONAR_TOKEN:" -X POST "$SONAR_URL/api/qualitygates/create_condition" \\
  -d gateName=Shop -d metric=new_sqale_debt_ratio -d op=GT -d error=5        # MAX_DEBT_RATIO_PCT
curl -sf -u "$SONAR_TOKEN:" -X POST "$SONAR_URL/api/qualitygates/create_condition" \\
  -d gateName=Shop -d metric=new_maintainability_rating -d op=GT -d error=1  # A on new code

# sonar-project.properties, so that the pipeline fails when the gate does
# sonar.newCode.referenceBranch=main
# sonar.qualitygate.wait=true`,
    },
    {
      id: 'ff-debt-share', label: 'Repayment share reported', category: 'process', implements: REGISTRIES,
      threshold: 'The share of closed work items labelled tech-debt is reported every iteration; with a fixed share, it is at least {{DEBT_SHARE_PCT}}%',
      description: 'A scheduled job at the end of each iteration counts the work items closed since the iteration started and those among them labelled tech-debt, posts the share with the number of open items, and, where a fixed share is agreed, fails below it so that the retrospective sees it. With Jira, the two counts come from JQL: resolved >= startOfSprint() and labels = tech-debt.',
      tool: 'gh issue list in a scheduled job (or a Jira JQL filter)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/debt-share.sh [iteration-start YYYY-MM-DD]; DEBT_SHARE_PCT set = fail below it
set -euo pipefail
SINCE=\${1:-$(date -d '14 days ago' +%F 2>/dev/null || date -v-14d +%F)}
all=$(gh issue list --state closed --search "closed:>=$SINCE" --limit 500 --json number --jq length)
debt=$(gh issue list --state closed --label tech-debt --search "closed:>=$SINCE" --limit 500 --json number --jq length)
open=$(gh issue list --state open --label tech-debt --limit 500 --json number --jq length)
share=$(( debt * 100 / (all > 0 ? all : 1) ))
echo "since $SINCE: $debt of $all closed items were debt ($share%), $open debt items open"
[ -z "\${DEBT_SHARE_PCT:-}" ] || [ "$share" -ge "$DEBT_SHARE_PCT" ] || { echo "below the agreed $DEBT_SHARE_PCT%"; exit 1; }`,
    },
    {
      id: 'ff-expiring-todo', label: 'Sunsets expire in the build', when: { DEPRECATION: ['sunset'] }, category: 'structural', implements: REGISTRIES,
      threshold: '0 TODO comments past their date; a TODO with a sunset less than {{SUNSET_GRACE_DAYS}} days ahead at the time it is added is refused in review',
      description: 'Deprecated code carries its sunset as a dated TODO beside the @deprecated marker, TODO [2027-01-31] (KEY-123): remove, and unicorn/expiring-todo-comments turns the comment into a lint error the day after the date. On the JVM the same is done with a @Deprecated(forRemoval = true) marker and a test over an annotation processor\'s list; in Python with a dated warnings.deprecated message checked by a grep in CI.',
      tool: 'ESLint with eslint-plugin-unicorn (expiring-todo-comments)',
      language: 'js',
      snippet: `// eslint.config.js
import unicorn from 'eslint-plugin-unicorn'

export default [{
  plugins: { unicorn },
  rules: {
    'unicorn/expiring-todo-comments': ['error', {
      allowWarningComments: false,      // a TODO without a condition is an error
      ignoreDatesOnPullRequests: false, // the date fails on pull requests too
      terms: ['todo', 'fixme'],
    }],
  },
}]
// in the code:
// /** @deprecated use OrdersV2Client: v1 has no idempotency keys. TODO [2027-01-31] (SHOP-123): remove v1 */`,
    },
    {
      id: 'ff-flag-age', label: 'No feature flag outlives its sunset', category: 'structural', implements: REGISTRIES,
      threshold: '0 release or experiment flags older than {{MAX_FLAG_AGE_DAYS}} days or past their retire-by date; permanent flags are marked permanent',
      description: 'Flags are declared in flags.json with owner, creation date, kind and a retire-by date; a test in the unit suite fails on a non-permanent flag older than {{MAX_FLAG_AGE_DAYS}} days or past its retire-by date. With LaunchDarkly or Unleash the same test reads the flag list from their API and uses the creation date there.',
      tool: 'Vitest (a test over flags.json)',
      language: 'ts',
      snippet: `import { expect, it } from 'vitest'
import flags from '../flags.json' // [{ key, owner, kind: 'release' | 'experiment' | 'permanent', since: '2026-08-01', retireBy: '2026-10-30' }]

const MAX_DAYS = Number(process.env.MAX_FLAG_AGE_DAYS ?? 90)
const days = (iso: string): number => (Date.now() - Date.parse(iso)) / 86_400_000

it('no release or experiment flag outlives its sunset', () => {
  const stale = flags
    .filter((f) => f.kind !== 'permanent')
    .filter((f) => days(f.since) > MAX_DAYS || (f.retireBy && Date.parse(f.retireBy) < Date.now()))
    .map((f) => \`\${f.key} (owner \${f.owner}, since \${f.since})\`)
  expect(stale).toEqual([])
})`,
    },
    {
      id: 'ff-no-deprecated', label: 'No new calls to deprecated code', category: 'structural', implements: REGISTRIES,
      threshold: '0 calls to code marked @deprecated without a line-level disable naming a register key',
      description: 'Lint fails on a call to or import of anything marked @deprecated, using type information so that re-exports and overloads count too; an existing call is tolerated only with a line disable whose comment names the register key. On the JVM the same is javac -Xlint:deprecation -Werror; in .NET, CS0618 as an error in the project file.',
      tool: 'typescript-eslint (@typescript-eslint/no-deprecated)',
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
      threshold: '0 imports of src/legacy from outside src/legacy and src/facade',
      description: 'A dependency rule fails the build when any module outside the legacy code and the facade imports the legacy code directly, so that new code grows only on the new side and the old module can be deleted piece by piece. On the JVM an ArchUnit rule noClasses().that().resideOutsideOfPackages("..legacy..", "..facade..").should().dependOnClassesThat().resideInAPackage("..legacy..") does the same.',
      tool: 'dependency-cruiser',
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
      threshold: '0 pull requests labelled rewrite without an ADR of kind rewrite with status accepted; every such ADR names at least 2 accepting owners and the sections Cost, Risks, Parity criteria and Cut-over',
      description: 'Rewrite cases are ADRs with kind: rewrite in their front matter. A test in the unit suite fails on a rewrite ADR that is not accepted by at least two owners or lacks one of the required sections, and a pull-request step fails a pull request labelled rewrite whose description does not link an accepted rewrite ADR (gh pr view --json body, grep for docs/adr/).',
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
// pull request labelled rewrite: gh pr view "$PR" --json body --jq .body | grep -q 'docs/adr/' || exit 1`,
    },
    {
      id: 'ff-boy-scout', label: 'Touched files do not get worse', when: { BUDGET: ['boy-scout'] }, category: 'process', implements: REGISTRIES,
      threshold: 'In every pull request the lint warnings of the files it modifies are at most what they were on the base branch',
      description: 'A pull-request step lints the modified files on the head and, in a temporary worktree, on the base branch, and fails when the warning count grew; new files are covered by the quality gate\'s own conditions. With SonarQube the same is a gate condition on new code; this script needs no platform.',
      tool: 'ESLint in a pull-request step (git worktree)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/warnings-do-not-grow.sh: lint warnings in modified files, head vs base
set -euo pipefail
BASE=\${BASE_REF:-origin/main}
files=$(git diff --name-only --diff-filter=M "$BASE...HEAD" -- '*.ts' '*.tsx')
[ -z "$files" ] && exit 0
count() { npx eslint --no-error-on-unmatched-pattern --format json $files | jq '[.[].warningCount] | add // 0'; }
after=$(count)
git worktree add -q "$RUNNER_TEMP/base" "$BASE"
before=$(cd "$RUNNER_TEMP/base" && npm ci --silent && count)
git worktree remove --force "$RUNNER_TEMP/base"
echo "warnings in touched files: $before -> $after"
[ "$after" -le "$before" ] || { echo 'touched files got worse; leave them at least as clean'; exit 1; }`,
    },
    {
      id: 'ff-debt-age', label: 'Old debt items are escalated', when: { AGE: ['max-age'] }, category: 'process', implements: REGISTRIES,
      threshold: '0 debt items older than {{MAX_DEBT_AGE_DAYS}} days without the label escalated or accepted-debt',
      description: 'A weekly job lists open debt items older than {{MAX_DEBT_AGE_DAYS}} days that carry neither escalated nor accepted-debt, posts them to the owners\' leads and fails so that the run shows red until each is scheduled or closed as accepted. With records in the repository the same job reads the date in the front matter; with SonarQube, api/issues/search with createdBefore and statuses=OPEN.',
      tool: 'gh issue list in a scheduled job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scripts/debt-age.sh: weekly; MAX_DEBT_AGE_DAYS defaults to 180
set -euo pipefail
export MAX=\${MAX_DEBT_AGE_DAYS:-180}
old=$(gh issue list --label tech-debt --state open --limit 500 --json number,title,createdAt,labels --jq '
  .[] | select((now - (.createdAt | fromdateiso8601)) > (env.MAX | tonumber) * 86400)
      | select(any(.labels[].name; . == "escalated" or . == "accepted-debt") | not)
      | "#\\(.number) \\(.title) (opened \\(.createdAt[:10]))"')
if [ -n "$old" ]; then
  printf 'debt items older than %s days without a decision:\\n%s\\n' "$MAX" "$old"
  exit 1
fi`,
    },
  ],
}

export default pack
