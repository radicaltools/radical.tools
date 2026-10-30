import type { PackSpec } from '../../src/packSpec'

const APPROVALS = ['adr-peer-approval', 'adr-cab', 'adr-release-approver']
const FORCES = 'Every change to this element travels from a pull request to production, and somewhere on the way someone decides that it is done and may go. The forces: a Definition of Done kept in people\'s heads is applied unevenly, and one that repeats the rules of other packs drifts away from them; approval by people outside the team feels safe, but DORA\'s research (dora.dev) finds that it slows delivery and leads to larger, riskier batches without lowering the change failure rate; regulators and auditors still ask that no one can put a change into production alone, and that every change is recorded and approved; an incident is exactly when a slow path gets skipped, so the emergency path has to be designed rather than improvised; and a change nobody can trace back to its reason costs hours in the next incident. The snippets assume GitHub: rulesets on main (kept by the Code review and branching pack), a deployment environment for production, GitHub Actions workflows under .github/workflows/ and the GitHub CLI with jq in scheduled jobs; GitLab\'s protected environments with deployment approvals do the same.'
/** What every main decision says about the Definition of Done and the other answers. */
const DOD_AND_ANSWERS = 'The Definition of Done is kept as {{DOD}}. Each of its items names the decision that owns it instead of setting it again: the tests of the Test strategy decision, the Code quality gate, the reviews and their number of the Code review and branching decision, the open findings of the Secure coding decision, the documentation of the Code documentation decision and the rollout of the Deployment and rollback decision. Every item a machine can check is written "(check: <status check name>)" and is a required status check on main. Segregation of duties: {{SEGREGATION}}. Emergency fixes: {{EMERGENCY}}. Traceability: {{TRACE}}.'

const pack: PackSpec = {
  id: 'concern-definition-of-done',
  name: 'Definition of Done and change approval',
  group: 'sdlc',
  description: 'What every change must carry before it counts as done, and who or what approves it going to production: a Definition of Done that points at the packs owning each item, peer review or a change advisory board or a release approver, segregation of duties, the emergency path, and traceability from requirement to release. The snippets are for GitHub (rulesets, environments, Actions, the GitHub CLI); GitLab\'s protected environments with deployment approvals are the equivalent.',
  tags: ['sdlc', 'definition of done', 'change approval', 'segregation of duties', 'emergency change', 'traceability'],
  concern: {
    id: 'definition-of-done',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code in these elements changes and reaches production, so what a change must carry before it counts as done, and who or what approves it going to production, has to be decided; one decision usually covers a whole repository and is bound to every element built from it.',
  },
  sources: [
    { title: 'DORA: Streamlining change approval', url: 'https://dora.dev/capabilities/streamlining-change-approval/' },
    { title: 'DORA: Accelerate State of DevOps Report 2019', url: 'https://dora.dev/research/2019/dora-report/' },
    { title: 'Nicole Forsgren, Jez Humble, Gene Kim: Accelerate (IT Revolution)', url: 'https://itrevolution.com/product/accelerate/' },
    { title: 'The Scrum Guide 2020: Commitment: Definition of Done', url: 'https://scrumguides.org/scrum-guide.html' },
    { title: 'GitHub Docs: Managing environments for deployment (required reviewers, prevent self-review, deployment branches)', url: 'https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment' },
    { title: 'GitHub Docs: REST API endpoints for deployment environments', url: 'https://docs.github.com/en/rest/deployments/environments' },
    { title: 'GitHub Docs: REST API endpoints for rule suites', url: 'https://docs.github.com/en/rest/repos/rule-suites' },
    { title: 'GitLab Docs: Deployment approvals', url: 'https://docs.gitlab.com/ci/environments/deployment_approvals/' },
    { title: 'Regulation (EU) 2022/2554, the EU Digital Operational Resilience Act (DORA), Article 9(4)(e)', url: 'https://eur-lex.europa.eu/eli/reg/2022/2554/oj' },
    { title: 'Commission Delegated Regulation (EU) 2024/1774 (ICT risk management under the EU Digital Operational Resilience Act), Article 17: ICT change management', url: 'https://eur-lex.europa.eu/eli/reg_del/2024/1774/oj' },
    { title: 'PCI Security Standards Council: PCI DSS v4.0.1, Requirements 6.5.1 and 6.5.4', url: 'https://www.pcisecuritystandards.org/standards/pci-dss/' },
  ],
  questions: [
    {
      key: 'APPROVAL', title: 'Approval', label: 'Who or what approves a change going to production?',
      hint: 'This decides whether anyone outside the team stands between a reviewed change and production. DORA\'s research found no evidence that approval by people outside the team lowers the change failure rate, and found that it leads to larger, slower and riskier releases; peer review recorded in the development platform meets the goal of segregation of duties. Who reviews a pull request, and how many approve it, is decided in the Code review and branching pack; this question is only about the way to production.',
      default: 'peer-review',
      options: [
        { value: 'peer-review', label: 'a peer-reviewed change with a green pipeline', description: 'The pull request\'s approving reviews and a green pipeline are the approval: nothing waits for a further sign-off, and the deployment record links the change to its reviewers and its pipeline run. Pick it by default, and in a regulated firm too when the auditor accepts reviews recorded in the platform as the change approval.' },
        { value: 'cab', label: 'a change advisory board for high-risk changes only', description: 'Changes touching paths classified as high-risk (schema migrations, infrastructure and payments by default) also wait for a member of the change advisory board to approve their production deployment; every other change goes as with peer review. Pick it when a regulator or auditor asks for a separate approval of significant changes, or a class of changes keeps causing outages that review did not catch.' },
        { value: 'release-approver', label: 'a named release approver for every production deployment', description: 'Every production deployment waits for one of a short list of named approvers in the deployment environment (GitHub environment required reviewers, GitLab deployment approvals). Pick it only when a contract or regulator asks for a named sign-off on every release, or a release is a business event; it adds a wait to every deployment, and continuous deployment without a manual step (Deployment and rollback pack) is no longer possible.' },
      ],
    },
    {
      key: 'SEGREGATION', title: 'Segregation', label: 'Can one person put a change into production alone?',
      hint: 'Segregation of duties means that whoever writes a change does not approve it, whoever starts a deployment does not approve it, and nobody can skip the approval. PCI DSS (Requirement 6.5.4) and the technical standard under the EU Digital Operational Resilience Act (Delegated Regulation (EU) 2024/1774, Article 17) ask for it; peer review covers most of it, and the rest is closing the bypasses.',
      default: 'none',
      options: [
        { value: 'enforced', label: 'author, approver and deployer kept apart', description: 'The approver of a change is never its author and never the person who started its deployment; administrators cannot bypass the main branch\'s rulesets or the production environment\'s rules. Pick it for regulated firms (payments, banking, insurance, health, a financial-reporting audit) and for any team whose administrators merge their own changes today.' },
        { value: 'none', label: 'no separation beyond the peer review', description: 'The review the Code review and branching pack requires is the only separation; administrators may bypass the rules, and every bypass is posted to the team the next day. Pick it for an unregulated team small enough that an administrator is often the only person awake during an incident.' },
      ],
    },
    {
      key: 'EMERGENCY', title: 'Emergency', label: 'How does an emergency fix reach production?',
      hint: 'An incident is when a slow path is most tempting to skip. Either the normal path is fast enough to use, or there is a recorded way around it that is reviewed afterwards; the technical standard under the EU Digital Operational Resilience Act asks that emergency changes have safeguards and be documented, assessed and approved after they are made.',
      default: 'same-path',
      options: [
        { value: 'same-path', label: 'the normal path, expedited', description: 'The fix is a pull request like any other, labelled emergency so that the reviewer on call takes it first; the same review, pipeline and approval apply, and production accepts deployments from main only. Pick it when the pipeline from merge to production runs in about 30 minutes and a reviewer is always reachable.' },
        { value: 'break-glass', label: 'a break-glass deployment reviewed afterwards', description: 'A separate break-glass workflow deploys a hotfix branch without waiting for the review, the board or the release approver, with a second on-call engineer approving the run; it opens a review issue at once, and the change must be reviewed and merged to main within a set number of hours (24 by default). Pick it when the normal path takes hours (a manual approval, a long pipeline) and incidents cannot wait for it.' },
      ],
    },
    {
      key: 'TRACE', title: 'Traceability', label: 'Must every change name the ticket or requirement it serves?',
      hint: 'An id in every pull request links requirement, commit and release, so that an auditor or the next incident can find why a line changed and which release carried it.',
      default: 'ticket',
      options: [
        { value: 'ticket', label: 'a ticket or requirement id in every pull request, checked', description: 'Each pull request title names an id from the tracker or the requirements (a Jira key such as SHOP-123 by default), checked on the pull request; the id reaches the squash commit on main and the release. Pick it when work is planned in a tracker, or an auditor traces requirements to releases.' },
        { value: 'none', label: 'no required ticket id', description: 'The pull request\'s description says why; nothing links it to a tracker. Pick it for a small team without a tracker, or where the pull request itself is the unit of planning.' },
      ],
    },
    {
      key: 'DOD', title: 'Definition of Done', label: 'Where does the Definition of Done live?',
      hint: 'The Definition of Done lists what every change carries before it counts as done; each item points at the pack that owns it (tests, quality gate, review, security findings, documentation, rollout) rather than setting it again. Where it lives decides whether it is checked on every change or remembered.',
      default: 'template',
      options: [
        { value: 'template', label: 'a pull request template checklist backed by required checks', description: 'The Definition of Done is the checklist in .github/pull_request_template.md: items a machine can check name their required status check, the others are ticked by the author or marked N/A with a reason, and a check refuses the merge while an item is open. Pick it by default: the list is in front of the author and the reviewer on every change.' },
        { value: 'agreement', label: 'a written team agreement reviewed each iteration', description: 'The Definition of Done is a page in the repository (docs/definition-of-done.md) that the team reviews and dates every iteration; items a machine can check still name their required status check. Pick it for a team that works in iterations, keeps its working agreements together and finds a checklist in every pull request turns into noise.' },
      ],
    },
  ],
  details: [
    { key: 'PROD_ENV', label: 'What is the production deployment environment called (in GitHub or GitLab)?', default: 'production' },
    { key: 'HIGH_RISK_PATHS', label: 'Which paths make a change high-risk, so that it goes to the board? Comma-separated from the repository root, each ending with / (a change advisory board for high-risk changes only)', default: 'migrations/, infra/, payments/' },
    { key: 'APPROVAL_HOURS', label: 'Within how many working hours must a manual approval be given? (a board or a release approver only)', default: '8', number: true },
    { key: 'BREAK_GLASS_HOURS', label: 'Within how many hours must a break-glass change be reviewed and merged to main? (break-glass only; with the normal path, deployments younger than this are left to the next day\'s check)', default: '24', number: true },
    { key: 'TICKET_PATTERN', label: 'Which extended regular expression must a ticket or requirement id match? (ticket ids only)', default: '[A-Z][A-Z0-9]+-[0-9]+' },
    { key: 'DOD_REVIEW_DAYS', label: 'Within how many days must the team review its written Definition of Done again? (a written team agreement only)', default: '14', number: true },
  ],
  need: {
    label: 'Every change done and approved before production',
    text: 'Every change to this element must arrive in production carrying the same evidence: tested, checked, reviewed, free of open security findings above the bar, documented and rolled out as the packs owning those rules decide. Someone or something accountable must have approved it going to production, no one may be able to put it there alone where the firm needs that, an emergency needs a path that is fast and still recorded, and afterwards it must be possible to show who approved what, and why the change was made. The snippets assume GitHub: the Definition of Done in .github/pull_request_template.md or docs/definition-of-done.md with its checkable items written "(check: <status check name>)", rulesets on main, a deployment environment for production, and workflows under .github/workflows/.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-dod-items', label: 'One Definition of Done, each item owned', ears_type: 'ubiquitous',
      action: 'keep one Definition of Done for the element whose items each name the decision that owns them (tests, quality gate, reviews, security findings, documentation, rollout), and make every item a machine can check a required status check on the main branch',
      rationale: 'The Definition of Done is the formal description of the quality an increment must have, binding on everyone who builds it (Scrum Guide 2020); naming the owning decision keeps one owner per rule, and a required check cannot be forgotten under pressure.',
      scenario: { label: 'Dropped check noticed', given: 'a Definition of Done with the item "Tests of the Test strategy pass (check: test)"', when: 'the check "test" is removed from the rulesets on main and the weekly comparison runs', then: 'the comparison fails naming "test"' },
    },
    {
      id: 'req-dod-template', label: 'Checklist complete before merge', when: { DOD: ['template'] }, ears_type: 'event-driven',
      trigger: 'a pull request is opened, edited or updated',
      action: 'check its description against the Definition of Done checklist copied from .github/pull_request_template.md, and refuse the merge while the checklist is missing or an item is neither ticked nor marked N/A with a reason',
      rationale: 'A checklist nobody has to complete is decoration; one that blocks the merge makes the Definition of Done the commitment the Scrum Guide says the developers must conform to (Scrum Guide 2020).',
      scenario: { label: 'Open item blocks merge', given: 'a pull request whose description leaves "Documentation updated" unticked', when: 'the definition-of-done check runs', then: 'it fails naming the item; ticking it, or writing "N/A: no public behaviour changed", makes it pass' },
    },
    {
      id: 'req-dod-agreement', label: 'Team agreement reviewed', when: { DOD: ['agreement'] }, ears_type: 'ubiquitous',
      action: 'keep the Definition of Done in docs/definition-of-done.md with a "Last reviewed:" date that the team moves forward at each review and that is never more than {{DOD_REVIEW_DAYS}} days old',
      rationale: 'The Scrum Team creates and keeps its own Definition of Done (Scrum Guide 2020); an agreement nobody revisits drifts from what the team does, and a dated review makes the drift visible.',
      scenario: { label: 'Stale agreement flagged', given: 'docs/definition-of-done.md last reviewed more than {{DOD_REVIEW_DAYS}} days ago', when: 'the weekly check runs', then: 'it fails until the team reviews the page and moves the date' },
    },
    {
      id: 'req-change-record', label: 'Every deployment traces to an approved change', ears_type: 'ubiquitous',
      action: 'link every production deployment to the commit it deployed, the merged pull request that commit belongs to, at least one approving review by someone other than that pull request\'s author, and the pipeline run that deployed it, in the platform\'s deployment history',
      rationale: 'An approval that leaves no record can be shown neither to an auditor nor to the next incident. The EU Digital Operational Resilience Act (DORA, Regulation (EU) 2022/2554), Article 9(4)(e), asks that changes to ICT systems be recorded, tested, assessed, approved, implemented and verified in a controlled manner; DORA\'s capability guidance recommends recording peer review in the development platform (DORA: Streamlining change approval).',
      scenario: { label: 'Unapproved deployment found', given: 'the production deployments of the last 30 days, one of them from a pull request approved only by its author', when: 'the daily change-record job runs', then: 'it fails naming that deployment\'s commit and pull request, and passes for the others' },
    },
    {
      id: 'req-peer-approval', label: 'The review is the approval', when: { APPROVAL: ['peer-review'] }, ears_type: 'ubiquitous',
      action: 'deploy a merged change to {{PROD_ENV}} with no manual approval and no wait timer beyond the reviews and the green pipeline, so that the reviewed pull request is the approval',
      rationale: 'DORA\'s research found no evidence that approval by people outside the team lowers the change failure rate, and found that heavyweight approval leads to larger, less frequent and riskier releases (DORA: Streamlining change approval; Accelerate State of DevOps Report 2019; Accelerate).',
      scenario: { label: 'No sign-off after review', given: 'a pull request that is approved and green', when: 'it is merged', then: 'its deployment to {{PROD_ENV}} starts without waiting for a person, and the {{PROD_ENV}} environment has no required reviewers and no wait timer' },
    },
    {
      id: 'req-cab', label: 'High-risk changes wait for the board', when: { APPROVAL: ['cab'] }, ears_type: 'state-driven',
      precondition: 'a merged pull request changes a file under {{HIGH_RISK_PATHS}}',
      action: 'label it change:high-risk and deploy it only through the {{PROD_ENV}}-high-risk environment, whose required reviewers are the change advisory board, while every other change deploys through {{PROD_ENV}} on its reviews and green pipeline',
      rationale: 'Approval from outside the team pays only where review keeps missing what goes wrong; DORA recommends finding high-risk changes early so they get extra scrutiny, and keeping the share of changes that need manual approval low (DORA: Streamlining change approval).',
      scenario: { label: 'Board sees only high-risk', given: 'one pull request changing a file under {{HIGH_RISK_PATHS}} and another changing only other files', when: 'both are merged', then: 'the first is labelled change:high-risk and waits for a board member in {{PROD_ENV}}-high-risk; the second deploys through {{PROD_ENV}} without waiting' },
    },
    {
      id: 'req-cab-calibrate', label: 'High-risk list kept short', when: { APPROVAL: ['cab'] }, ears_type: 'ubiquitous',
      action: 'compare every quarter the change failure rate of the changes the board approved with that of the other changes, and remove a path from {{HIGH_RISK_PATHS}} whose changes failed no more often than the rest',
      rationale: 'DORA suggests measuring how many changes at each risk level need manual approval; a board that never sheds a class of changes only grows, and the batches waiting for it grow with it (DORA: Streamlining change approval).',
      scenario: { label: 'Quarterly comparison recorded', given: 'a quarter of production deployments, split into high-risk and other', when: 'the board meets at the start of the next quarter', then: 'its minutes record both change failure rates and, for each path, whether it stays on the list and why' },
      unchecked: 'the change advisory board, at its first meeting of each quarter, with the change failure rate the Delivery metrics pack measures, split by the change:high-risk label',
    },
    {
      id: 'req-release-approver', label: 'A named approver releases', when: { APPROVAL: ['release-approver'] }, ears_type: 'event-driven',
      trigger: 'a deployment to {{PROD_ENV}} starts',
      action: 'hold it until one of the named release approvers, listed as required reviewers of the {{PROD_ENV}} environment, approves it, and keep who approved it on the run',
      rationale: 'Where a contract or a regulator asks for a named sign-off on every release, the environment\'s required reviewers make it part of the pipeline rather than a document beside it (GitHub Docs: Managing environments for deployment; GitLab Docs: Deployment approvals).',
      scenario: { label: 'Deployment waits for approver', given: 'a merged change', when: 'its deployment job to {{PROD_ENV}} starts', then: 'the job waits until a release approver approves, and the run shows who approved it' },
    },
    {
      id: 'req-segregation', label: 'No one deploys a change alone', when: { SEGREGATION: ['enforced'] }, ears_type: 'ubiquitous',
      action: 'let no person put a change into production alone: the {{PROD_ENV}} environment prevents self-review and cannot be bypassed by administrators, the active branch rulesets list no bypass actors, and every production deployment carries an approval by someone other than the author of its pull request',
      rationale: 'PCI DSS asks for documented change approval by authorised parties (Requirement 6.5.1) and for roles separated so that only reviewed and approved changes are deployed (Requirement 6.5.4); the technical standard under the EU Digital Operational Resilience Act asks that the functions approving changes be independent of those requesting and implementing them (Delegated Regulation (EU) 2024/1774, Article 17(1)(b)).',
      scenario: { label: 'Bypass setting caught', given: 'an administrator who turns on administrator bypass for {{PROD_ENV}}', when: 'the daily segregation check runs', then: 'it fails naming the setting, and passes again only when the bypass is off, self-review is prevented and no ruleset lists a bypass actor' },
    },
    {
      id: 'req-bypass-reported', label: 'Bypasses are seen', when: { SEGREGATION: ['none'] }, ears_type: 'event-driven',
      trigger: 'someone pushes or merges to main past its rulesets',
      action: 'post the bypass with the person, the time and the commits to the team within 1 working day',
      rationale: 'Without enforced segregation a bypass is allowed, but it must not go unseen; the rule-suite history records every bypass with its actor and commits (GitHub Docs: REST API endpoints for rule suites).',
      scenario: { label: 'Bypass posted', given: 'an administrator who merges a pull request to main past the required review', when: 'the daily bypass report runs', then: 'the team channel receives the bypass with the administrator, the time and the commits' },
    },
    {
      id: 'req-emergency-path', label: 'Emergency fixes take the normal path', when: { EMERGENCY: ['same-path'] }, ears_type: 'event-driven',
      trigger: 'a fix for a production incident is needed',
      action: 'ship it as a pull request labelled emergency through the same reviews, pipeline and approval as every change, with {{PROD_ENV}} accepting deployments from the main branch only',
      rationale: 'One path into production means that an emergency fix carries the same safeguards and leaves the same record as any change, which is what the technical standard under the EU Digital Operational Resilience Act asks of emergency changes (Delegated Regulation (EU) 2024/1774, Article 17(1)(f)).',
      scenario: { label: 'Hotfix branch refused', given: 'an engineer who runs the deploy workflow from a hotfix branch during an incident', when: 'the deployment job asks for the {{PROD_ENV}} environment', then: 'GitHub refuses it because the branch is not main, and the fix has to go through a pull request' },
    },
    {
      id: 'req-break-glass', label: 'Break-glass reviewed afterwards', when: { EMERGENCY: ['break-glass'] }, ears_type: 'event-driven',
      trigger: 'an incident needs a fix in production faster than the normal path allows',
      action: 'deploy it from a hotfix/ branch only through the break-glass workflow approved by a second on-call engineer, open a break-glass-review issue naming the commit before the deployment, and have the change reviewed, merged to main and the issue closed within {{BREAK_GLASS_HOURS}} hours',
      rationale: 'The technical standard under the EU Digital Operational Resilience Act asks for emergency changes to have adequate safeguards and to be documented, re-evaluated, assessed and approved after they are implemented (Delegated Regulation (EU) 2024/1774, Article 17(1)(f) and (g)); a review issue with a deadline turns "afterwards" into a date.',
      scenario: { label: 'Overdue break-glass flagged', given: 'a break-glass deployment whose review issue is still open', when: '{{BREAK_GLASS_HOURS}} hours have passed and the hourly check runs', then: 'the check fails naming the issue, until the change is merged to main and the issue closed' },
    },
    {
      id: 'req-ticket', label: 'Every change names its ticket', when: { TRACE: ['ticket'] }, ears_type: 'ubiquitous',
      action: 'name a ticket or requirement id matching {{TICKET_PATTERN}} in the title of every pull request opened by a person, and refuse the merge without one, so that the commit on main and the release that carries it name the id',
      rationale: 'An id in every change links requirement, commit and release, which is how an auditor or the next incident finds why a line changed; the EU Digital Operational Resilience Act asks that changes to ICT systems be recorded (Regulation (EU) 2022/2554, Article 9(4)(e)).',
      scenario: { label: 'Title without id refused', given: 'a pull request titled "fix: apply coupon once"', when: 'the ticket-id check runs', then: 'it fails; retitled "fix: apply coupon once (SHOP-123)", it passes' },
    },
  ],
  adrs: [
    {
      id: 'adr-peer-approval', label: 'A reviewed, green change is approved for production', when: { APPROVAL: ['peer-review'] },
      decision: `A change is approved for production by its pull request: the approving reviews the Code review and branching decision requires, and a green pipeline. No further sign-off stands between the merge and the deployment: the {{PROD_ENV}} GitHub environment has no required reviewers and no wait timer (on GitLab, the protected environment has no approval rules). The deployment history links each deployed commit to its pull request, its approvers and the pipeline run, and that is the change record an auditor reads. ${DOD_AND_ANSWERS}`,
      consequences: '• Nothing waits for a meeting or a signature: a reviewed change reaches production as fast as the pipeline and the rollout allow.\n• The review carries the weight of the approval, so a rubber-stamp review is a rubber-stamp approval; the Code review and branching pack\'s limits on size and turnaround are what keep reviews real.\n• An auditor who expects a separate approval has to accept the review recorded in the platform as the approval; agree on that before the audit, not during it.\n• A class of changes that keeps failing despite review gets no extra gate until this decision is revisited.',
      alternatives: '1. A change advisory board for high-risk changes only: extra scrutiny where review keeps missing problems, at the price of a wait for those changes.\n2. A named release approver for every deployment: a signature on every release, and a queue in front of every deployment.\n3. A change advisory board for every change: DORA\'s research finds it slows delivery without lowering the change failure rate.',
    },
    {
      id: 'adr-cab', label: 'High-risk changes also go to the change advisory board', when: { APPROVAL: ['cab'] },
      decision: `A change is approved for production by its pull request (the reviews the Code review and branching decision requires and a green pipeline), and a change that touches {{HIGH_RISK_PATHS}} is approved by the change advisory board as well. The deploy workflow labels such a pull request change:high-risk on merge and deploys it through the {{PROD_ENV}}-high-risk GitHub environment, whose required reviewers are the board's members (on GitLab, a protected environment with an approval rule for the board's group); every other change deploys through {{PROD_ENV}} without waiting. The board decides within {{APPROVAL_HOURS}} working hours from the pull request, its pipeline run and the rollout plan, with no separate form, and once a quarter compares the change failure rate of the changes it approved with the rest and drops a path whose changes fail no more often. ${DOD_AND_ANSWERS}`,
      consequences: '• Most changes flow as with peer review; only the classified ones wait, up to {{APPROVAL_HOURS}} working hours.\n• The board sees what review keeps missing only if the classification is right: a list of paths is coarse, and a risky change outside it goes through unseen.\n• Changes that wait tend to grow into larger batches, which DORA\'s research links to more risk; the quarterly comparison is what keeps the list short.\n• The board\'s members must be reachable within the deadline, holidays included.',
      alternatives: '1. Peer review and a green pipeline as the only approval: the fastest, and enough when review catches what goes wrong.\n2. A named release approver for every deployment: one gate for every change instead of a board for some.\n3. A board for every change: DORA\'s research finds no lower change failure rate for it, and slower delivery.',
    },
    {
      id: 'adr-release-approver', label: 'A named release approver approves every production deployment', when: { APPROVAL: ['release-approver'] },
      decision: `Every deployment to production waits for one of the named release approvers: the {{PROD_ENV}} GitHub environment lists them as required reviewers (up to six people or teams, of whom one must approve), and the deployment job waits until one does; on GitLab, the protected environment has an approval rule naming them. The approver decides within {{APPROVAL_HOURS}} working hours from the pull requests in the release, their pipeline runs and the rollout plan, and the approval stays on the run. The change itself is still approved for merge by the reviews the Code review and branching decision requires. ${DOD_AND_ANSWERS}`,
      consequences: '• Every release carries a named person\'s approval, which is what some contracts and auditors ask for.\n• Every deployment waits for a person: continuous deployment of every merge without a manual step, as the Deployment and rollback pack may decide, is ruled out, and releases tend to batch up, which DORA\'s research links to more failures, not fewer.\n• The approver sees a release, not each change; the approval adds little to the reviews unless the approver checks something they cannot (a business date, a customer notice).\n• The approvers become a queue and a single point of failure; keep at least three, across time zones if the team spans them.',
      alternatives: '1. Peer review and a green pipeline as the approval: no wait, and the same evidence in the platform.\n2. A change advisory board for high-risk changes only: the wait only where it buys something.\n3. A sign-off by e-mail or in a ticket: no wait in the pipeline, but nothing stops a deployment without it.',
    },
    {
      id: 'adr-segregation', label: 'No one puts a change into production alone', when: { SEGREGATION: ['enforced'] },
      context: `${FORCES} Here segregation of duties is asked for, by an auditor, a regulator or the team's own view of the risk.`,
      decision: 'No person can put a change into production alone. The author of a change never approves it: the rulesets on main require an approval from someone else (the Code review and branching decision) and list no bypass actors, so neither repository nor organisation administrators can merge past them. No one approves a deployment they started: every GitHub environment with required reviewers has Prevent self-review on (on GitLab, "Allow pipeline triggerer to approve deployment" stays off), and "Allow administrators to bypass configured protection rules" is off for {{PROD_ENV}}. No person holds credentials that deploy to production outside the pipeline, which deploys with its own short-lived OpenID Connect identity. This is the separation PCI DSS Requirement 6.5.4 and the technical standard under the EU Digital Operational Resilience Act (Delegated Regulation (EU) 2024/1774, Article 17(1)(b)) ask for, met with peer review recorded in the platform as DORA\'s capability guidance recommends.',
      consequences: '• An administrator cannot fix a broken ruleset or a stuck deployment alone; that takes a second person, at night too, so the emergency path ({{EMERGENCY}}) must not depend on a bypass.\n• A team of one or two cannot ship while one of them is away; segregation needs at least three people who can review and approve.\n• Bypassing is impossible rather than reported, so a mistake in the rules blocks everyone until two people fix it.\n• The daily check needs a token with write access to the rulesets, a secret to guard in its own right.',
      alternatives: '1. No separation beyond the peer review, with every bypass reported: simpler for a small team, and not what a regulator accepts.\n2. A quarterly manual review of who can bypass: finds a bypass months after it was used.',
    },
    {
      id: 'adr-break-glass', label: 'Emergency fixes may break glass and are reviewed afterwards', when: { EMERGENCY: ['break-glass'] },
      decision: 'An incident fix that cannot wait for the normal path is deployed through a break-glass workflow (workflow_dispatch in .github/workflows/break-glass.yml) from a hotfix/ branch. Its deployment job uses the {{PROD_ENV}}-break-glass GitHub environment, which accepts hotfix/* branches only and whose required reviewers are the on-call engineers with Prevent self-review on, so a second on-call engineer approves the run within minutes. It skips the review and any manual approval of the production deployment, never the build and the unit tests. Before it deploys, the workflow opens an issue labelled break-glass-review naming the commit, the incident and who approved; within {{BREAK_GLASS_HOURS}} hours the change goes through a normal pull request with the whole Definition of Done, is merged to main, and the issue is closed with a link to it. Each use is discussed in the incident review. This is the documentation, re-evaluation and approval after implementation that the technical standard under the EU Digital Operational Resilience Act asks of emergency changes (Delegated Regulation (EU) 2024/1774, Article 17(1)(g)).',
      consequences: '• An incident is fixed in minutes even when the normal path takes hours.\n• Two people still act together, so segregation of duties holds where it is decided.\n• A hotfix deployed but not yet merged is overwritten by the next normal deployment; hold normal deployments until it is merged, which the {{BREAK_GLASS_HOURS}}-hour limit keeps short.\n• Every use says the normal path is too slow; frequent use means that path needs fixing, not more glass.',
      alternatives: '1. The normal path, expedited: one path into production, which works when the pipeline takes minutes and a reviewer is always reachable.\n2. An administrator bypassing the rules: fast, but unseen unless reported, and impossible where segregation is enforced.\n3. Direct access to production for the engineer on call: the fastest, and the change is in neither the history nor the record.',
    },
  ],
  fitness: [
    {
      id: 'ff-dod-required', label: 'Definition of Done checks are required on main', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: APPROVALS, checks: ['req-dod-items'],
      threshold: 'Every item of the Definition of Done written "(check: name)" is a required status check on main; 0 missing',
      description: 'A scheduled job, and every pull request that changes the Definition of Done, reads the items written "(check: <status check name>)" and the required status checks in force on main through the GitHub rulesets API, and fails naming each item the rulesets do not require. The checks belong to their owners: test (Test strategy), quality-gate (Code quality gate), the security scan (Secure coding) and the docs build (Code documentation); definition-of-done and ticket-id come from this pack; the reviews are the rulesets\' pull_request rule (Code review and branching), and the rollout is the deploy job (Deployment and rollback). Set DOD_FILE to docs/definition-of-done.md for a written team agreement.',
      tool: 'GitHub CLI (gh api) and jq in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# weekly, and on every change to the Definition of Done: each "(check: name)" item is a required status check on main
# template lines look like:  - [ ] Tests of the Test strategy pass (check: test)
set -euo pipefail
dod=\${DOD_FILE:-.github/pull_request_template.md}   # docs/definition-of-done.md for a written team agreement
wanted=$(grep -oE '\\(check: [^)]+\\)' "$dod" | sed -E 's/^\\(check: (.*)\\)$/\\1/' | sort -u || true)
[ -n "$wanted" ] || { echo "$dod names no (check: ...) item"; exit 1; }
required=$(gh api "repos/$GITHUB_REPOSITORY/rules/branches/main" \\
  --jq '.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context' | sort -u)
missing=$(comm -23 <(echo "$wanted") <(echo "$required"))
[ -z "$missing" ] || { echo "Definition of Done items that are not required checks on main:"; echo "$missing"; exit 1; }
echo "every checkable item of the Definition of Done is required on main"`,
    },
    {
      id: 'ff-dod-checklist', label: 'Checklist complete before merge', when: { DOD: ['template'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'manual', implements: APPROVALS, checks: ['req-dod-template'],
      threshold: '0 items in the "## Definition of Done" section of the pull request description that are unticked and not marked "N/A: " with a reason of at least 10 characters; the check fails when the section is missing',
      description: 'A workflow runs on every change to the pull request, its description included, reads the "## Definition of Done" section copied from .github/pull_request_template.md and fails on any item that is open and not marked N/A with a reason. It is the required check definition-of-done on main, so an open item blocks the merge; ticking an item is the author\'s statement, and the reviewer sees it.',
      tool: 'GitHub Actions (pull_request, the edited type included) with jq',
      language: 'yaml',
      snippet: `# .github/workflows/definition-of-done.yml, listed as the required check "definition-of-done" on main
name: definition-of-done
on:
  pull_request:
    types: [opened, edited, synchronize, reopened, ready_for_review]
permissions:
  contents: read
jobs:
  definition-of-done:
    runs-on: ubuntu-latest
    steps:
      - name: Every item ticked, or marked N/A with a reason
        run: |
          body=$(jq -r '.pull_request.body // ""' "$GITHUB_EVENT_PATH" | tr -d '\\r')
          grep -q '^## Definition of Done' <<< "$body" \\
            || { echo "::error::the Definition of Done checklist of .github/pull_request_template.md is missing"; exit 1; }
          open=$(sed -n '/^## Definition of Done/,/^## /p' <<< "$body" | grep -E '^[[:space:]]*- \\[ \\]' | grep -vE 'N/A: .{10,}' || true)
          [ -z "$open" ] || { echo "::error::unticked Definition of Done items:"; echo "$open"; exit 1; }`,
    },
    {
      id: 'ff-dod-reviewed', label: 'Team agreement reviewed on time', when: { DOD: ['agreement'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'temporal', every: '{{DOD_REVIEW_DAYS}}d', invocation: 'manual', implements: APPROVALS, checks: ['req-dod-agreement'],
      threshold: 'The "Last reviewed:" date in docs/definition-of-done.md is at most {{DOD_REVIEW_DAYS}} days old, and the page names at least 1 required check',
      description: 'A weekly job reads the review date that the team moves forward at each review (in its retrospective, through a pull request like any change) and fails when it is older than the limit, so a forgotten agreement shows as a red job rather than as drift.',
      tool: 'Bash with GNU date in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# weekly: the written Definition of Done was reviewed within the last {{DOD_REVIEW_DAYS}} days and still names its checks
set -euo pipefail
page=docs/definition-of-done.md   # holds a line "Last reviewed: 2026-10-20", moved forward at each review
reviewed=$(grep -oE '^Last reviewed: [0-9]{4}-[0-9]{2}-[0-9]{2}' "$page" | cut -d' ' -f3 || true)
[ -n "$reviewed" ] || { echo "$page has no 'Last reviewed: YYYY-MM-DD' line"; exit 1; }
age=$(( ( $(date -u +%s) - $(date -u -d "$reviewed" +%s) ) / 86400 ))   # GNU date, as on ubuntu-latest
[ "$age" -le {{DOD_REVIEW_DAYS}} ] || { echo "Definition of Done last reviewed $age days ago, limit {{DOD_REVIEW_DAYS}}"; exit 1; }
grep -qE '\\(check: [^)]+\\)' "$page" || { echo "$page names no required check"; exit 1; }
echo "Definition of Done reviewed $age days ago"`,
    },
    {
      id: 'ff-change-record', label: 'Every deployment traces to an approved change', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: APPROVALS, checks: ['req-change-record', 'req-segregation'],
      threshold: 'Every deployment to {{PROD_ENV}} of the last 30 days and older than {{BREAK_GLASS_HOURS}} hours belongs to a merged pull request with at least 1 approving review by someone other than its author; 0 without',
      description: 'A daily job lists the deployments to {{PROD_ENV}} through the deployments API (GitHub Actions creates one for every job that names the environment), finds the merged pull request of each deployed commit and its reviews, and fails naming every deployment without an approval from someone other than the author. Deployments younger than {{BREAK_GLASS_HOURS}} hours are left to a later run, so that a break-glass change has its time to be reviewed and merged. The deployment, its run and its pull request together are the change record.',
      tool: 'GitHub CLI (gh api) and jq in a scheduled GitHub Actions job (GNU date)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# daily: every production deployment of the last 30 days leads to a merged pull request approved by someone other than its author
set -euo pipefail
repo=$GITHUB_REPOSITORY
since=$(date -u -d '30 days ago' +%FT%TZ)                 # GNU date, as on ubuntu-latest
grace=$(date -u -d '{{BREAK_GLASS_HOURS}} hours ago' +%FT%TZ)   # a break-glass change has this long to be reviewed and merged
failed=0
for sha in $(gh api --paginate "repos/$repo/deployments?environment={{PROD_ENV}}&per_page=100" \\
    --jq ".[] | select(.created_at >= \\"$since\\" and .created_at <= \\"$grace\\") | .sha" | sort -u); do
  pr=$(gh api "repos/$repo/commits/$sha/pulls" --jq '[.[] | select(.merged_at != null)][0] | "\\(.number) \\(.user.login)"')
  if [ "$pr" = "null null" ]; then echo "::error::$sha was deployed without a merged pull request"; failed=1; continue; fi
  read -r number author <<< "$pr"
  approvers=$(gh api --paginate "repos/$repo/pulls/$number/reviews" \\
    --jq ".[] | select(.state == \\"APPROVED\\" and .user.login != \\"$author\\") | .user.login")
  [ -n "$approvers" ] || { echo "::error::$sha (#$number) has no approval from anyone but its author $author"; failed=1; }
done
exit $failed`,
    },
    {
      id: 'ff-no-manual-gate', label: 'No sign-off after the review', when: { APPROVAL: ['peer-review'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-peer-approval'], checks: ['req-peer-approval'],
      threshold: 'The {{PROD_ENV}} environment has 0 required reviewers and no wait timer',
      description: 'A daily job reads the protection rules of the {{PROD_ENV}} environment and fails when someone adds required reviewers or a wait timer, which would put a manual approval back between a reviewed change and production without superseding the decision.',
      tool: 'GitHub CLI (gh api) and jq in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# daily: the {{PROD_ENV}} environment adds no manual approval and no wait to a reviewed, green change
set -euo pipefail
rules=$(gh api "repos/$GITHUB_REPOSITORY/environments/{{PROD_ENV}}" --jq '.protection_rules')
jq -e 'map(select(.type == "required_reviewers")) | length == 0' <<< "$rules" > /dev/null \\
  || { echo "{{PROD_ENV}} has required reviewers; the reviewed pull request is the approval"; exit 1; }
jq -e 'map(select((.wait_timer // 0) > 0)) | length == 0' <<< "$rules" > /dev/null \\
  || { echo "{{PROD_ENV}} has a wait timer"; exit 1; }
echo "{{PROD_ENV}} deploys on the review and the green pipeline alone"`,
    },
    {
      id: 'ff-high-risk', label: 'High-risk changes wait for the board', when: { APPROVAL: ['cab'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'deploy', invocation: 'manual', implements: ['adr-cab'], checks: ['req-cab'],
      threshold: 'Every merged change touching {{HIGH_RISK_PATHS}} is labelled change:high-risk and deploys through {{PROD_ENV}}-high-risk; every other change deploys through {{PROD_ENV}}',
      description: 'The deploy workflow, .github/workflows/deploy.yml, classifies the merged pull request by the paths it changed, labels it, and picks the environment of the deployment job with an expression over the needs context, which GitHub Actions allows for a job\'s environment; the board\'s environment holds the job until a board member approves.',
      tool: 'GitHub Actions (the environment chosen by an expression) with the GitHub CLI',
      language: 'yaml',
      snippet: `on: { push: { branches: [main] } }
permissions: { contents: read, pull-requests: write }
jobs:
  classify:
    runs-on: ubuntu-latest
    outputs:
      high_risk: \${{ steps.paths.outputs.high_risk }}
    steps:
      - id: paths
        env:
          GH_TOKEN: \${{ github.token }}
          HIGH_RISK_PATHS: '{{HIGH_RISK_PATHS}}'
        run: |
          pr=$(gh api "repos/$GITHUB_REPOSITORY/commits/$GITHUB_SHA/pulls" --jq '.[0].number')
          files=$(gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$pr/files" --jq '.[].filename')
          if grep -qE "^($(sed -E 's/[[:space:]]*,[[:space:]]*/|/g' <<< "$HIGH_RISK_PATHS"))" <<< "$files"; then
            gh pr edit "$pr" --repo "$GITHUB_REPOSITORY" --add-label change:high-risk
            echo "high_risk=true" >> "$GITHUB_OUTPUT"
          else echo "high_risk=false" >> "$GITHUB_OUTPUT"; fi
  deploy:
    needs: classify
    runs-on: ubuntu-latest
    environment: \${{ needs.classify.outputs.high_risk == 'true' && '{{PROD_ENV}}-high-risk' || '{{PROD_ENV}}' }}
    steps:
      - run: ./scripts/deploy.sh   # the rollout decided in the Deployment and rollback pack`,
    },
    {
      id: 'ff-approvers-set', label: 'Approvers named in the environment', when: { APPROVAL: ['cab', 'release-approver'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-cab', 'adr-release-approver'], checks: ['req-cab', 'req-release-approver'],
      threshold: 'The approving environment ({{PROD_ENV}} for a release approver, {{PROD_ENV}}-high-risk for the board) has a required_reviewers rule with at least 1 reviewer',
      description: 'A daily job reads the protection rules of the approving environment and fails when it has no required reviewers, which would let deployments through without the approval the decision names; it prints the approvers, so a change to the list shows in the job log.',
      tool: 'GitHub CLI (gh api) and jq in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# daily: the approving environment names its approvers; run with {{PROD_ENV}} for a release approver, {{PROD_ENV}}-high-risk for the board
set -euo pipefail
env="$1"
rules=$(gh api "repos/$GITHUB_REPOSITORY/environments/$env" --jq '.protection_rules')
n=$(jq '[.[] | select(.type == "required_reviewers") | .reviewers[]] | length' <<< "$rules")
[ "$n" -ge 1 ] || { echo "$env has no required reviewers, so nothing waits for an approval"; exit 1; }
echo "$env waits for one of:"
jq -r '.[] | select(.type == "required_reviewers") | .reviewers[] | "  \\(.type) \\(.reviewer.login // .reviewer.slug)"' <<< "$rules"`,
    },
    {
      id: 'ff-segregation', label: 'No bypass and no self-approval', when: { SEGREGATION: ['enforced'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-segregation'], checks: ['req-segregation'],
      threshold: 'Administrator bypass off and self-review prevented on {{PROD_ENV}}; 0 bypass actors on every active branch ruleset',
      description: 'A daily job reads the {{PROD_ENV}} environment and every active branch ruleset, and fails when administrators can bypass the environment, when a required-reviewers rule lets a person approve a deployment they started, or when a ruleset lists a bypass actor. The API returns bypass actors only to a token with write access to the ruleset, so the job runs with a GitHub App token that has it, and fails rather than passes when they are missing.',
      tool: 'GitHub CLI (gh api) and jq, with a GitHub App token',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# daily, with a token that has write access to the rulesets (bypass actors are returned only then)
set -euo pipefail
repo=$GITHUB_REPOSITORY
envjson=$(gh api "repos/$repo/environments/{{PROD_ENV}}")
jq -e '.can_admins_bypass == false' <<< "$envjson" > /dev/null \\
  || { echo "administrators can bypass the rules of {{PROD_ENV}}"; exit 1; }
jq -e '[.protection_rules[] | select(.type == "required_reviewers") | .prevent_self_review] | all' <<< "$envjson" > /dev/null \\
  || { echo "{{PROD_ENV}} lets a person approve a deployment they started"; exit 1; }
for id in $(gh api "repos/$repo/rulesets?targets=branch" --jq '.[] | select(.enforcement == "active") | .id'); do
  actors=$(gh api "repos/$repo/rulesets/$id" \\
    --jq 'if .bypass_actors == null then error("bypass_actors not returned: use a token with write access") else .bypass_actors | length end')
  [ "$actors" = 0 ] || { echo "ruleset $id lets $actors actor(s) bypass it"; exit 1; }
done
echo "no one can bypass the rulesets or {{PROD_ENV}}, and no one approves their own deployment"`,
    },
    {
      id: 'ff-bypass-report', label: 'Bypasses posted to the team', when: { SEGREGATION: ['none'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: APPROVALS, checks: ['req-bypass-reported'],
      threshold: 'Every rule suite on main with the result bypass in the last day is posted to the team channel by the daily run',
      description: 'A daily job reads the rule-suite history of main through the rule suites API, filtered to bypasses, and posts each one (when, who, the commits) to the team\'s channel through an incoming webhook. Nobody is blocked, and nobody bypasses unseen.',
      tool: 'GitHub CLI (gh api), jq and curl in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# daily: every bypass of the rules on main in the last day is posted to the team
set -euo pipefail
bypasses=$(gh api "repos/$GITHUB_REPOSITORY/rulesets/rule-suites?ref=refs/heads/main&time_period=day&rule_suite_result=bypass&per_page=100" \\
  --jq '.[] | "\\(.pushed_at) \\(.actor_name) \\(.before_sha[0:7])..\\(.after_sha[0:7])"')
[ -n "$bypasses" ] || { echo "no bypass on main in the last day"; exit 0; }
text=$(printf 'Rules on main bypassed in the last day (when, who, commits):\\n%s' "$bypasses")
curl -fsS -X POST -H 'Content-Type: application/json' \\
  --data "$(jq -n --arg text "$text" '{text: $text}')" "$TEAM_WEBHOOK_URL"   # a Slack or Teams incoming webhook
echo "$bypasses"`,
    },
    {
      id: 'ff-main-only', label: 'Production deploys from main only', when: { EMERGENCY: ['same-path'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: APPROVALS, checks: ['req-emergency-path'],
      threshold: 'The deployment branch policy of {{PROD_ENV}} is custom and allows exactly the branch main',
      description: 'A daily job reads the deployment branch policy of the {{PROD_ENV}} environment and fails when it allows any branch but main, so a fix has no way into production that skips the pull request, the reviews and the approval. The emergency label itself is a convention for the reviewer on call.',
      tool: 'GitHub CLI (gh api) and jq in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# daily: the {{PROD_ENV}} environment takes deployments from main only, so an emergency fix takes the same path as any change
set -euo pipefail
repo=$GITHUB_REPOSITORY
gh api "repos/$repo/environments/{{PROD_ENV}}" --jq '.deployment_branch_policy' \\
  | jq -e '. != null and .custom_branch_policies == true' > /dev/null \\
  || { echo "{{PROD_ENV}} does not limit the branches it deploys from"; exit 1; }
names=$(gh api "repos/$repo/environments/{{PROD_ENV}}/deployment-branch-policies" \\
  --jq '[.branch_policies[] | "\\(.type // "branch"):\\(.name)"] | sort | join(",")')
[ "$names" = "branch:main" ] || { echo "{{PROD_ENV}} deploys from $names, not from main alone"; exit 1; }
echo "{{PROD_ENV}} deploys from main only"`,
    },
    {
      id: 'ff-break-glass', label: 'Break-glass reviewed in time', when: { EMERGENCY: ['break-glass'] }, characteristic: 'security', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: ['adr-break-glass'], checks: ['req-break-glass'],
      threshold: '0 open break-glass-review issues older than {{BREAK_GLASS_HOURS}} hours; every deployment to {{PROD_ENV}}-break-glass has a break-glass-review issue naming its commit',
      description: 'An hourly job lists the open break-glass-review issues and fails on any older than the limit, and checks that each deployment to the break-glass environment has an issue naming its commit, so a break-glass deployment can stay neither unrecorded nor unreviewed.',
      tool: 'GitHub CLI (gh issue list, gh api) and jq in a scheduled GitHub Actions job (GNU date)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# hourly: every break-glass deployment has its review issue, closed within {{BREAK_GLASS_HOURS}} hours
set -euo pipefail
repo=$GITHUB_REPOSITORY
limit=$(date -u -d '{{BREAK_GLASS_HOURS}} hours ago' +%FT%TZ)   # GNU date, as on ubuntu-latest
overdue=$(gh issue list --repo "$repo" --label break-glass-review --state open --limit 200 --json number,title,createdAt \\
  --jq ".[] | select(.createdAt < \\"$limit\\") | \\"#\\(.number) \\(.title), opened \\(.createdAt)\\"")
[ -z "$overdue" ] || { echo "break-glass changes not reviewed and merged within {{BREAK_GLASS_HOURS}} hours:"; echo "$overdue"; exit 1; }
for sha in $(gh api "repos/$repo/deployments?environment={{PROD_ENV}}-break-glass&per_page=100" --jq '.[].sha' | sort -u); do
  n=$(gh issue list --repo "$repo" --label break-glass-review --state all --search "$sha" --json number --jq 'length')
  [ "$n" -ge 1 ] || { echo "break-glass deployment $sha has no review issue"; exit 1; }
done
echo "every break-glass deployment is recorded, and none is overdue"`,
    },
    {
      id: 'ff-ticket-id', label: 'Every pull request names its ticket', when: { TRACE: ['ticket'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: APPROVALS, checks: ['req-ticket'],
      threshold: 'The required check ticket-id fails on every pull request opened by a person whose title names no id matching {{TICKET_PATTERN}}',
      description: 'A workflow checks the title on every change to the pull request and fails without an id; as the required check ticket-id on main, and an item of the Definition of Done, it blocks the merge. The title becomes the subject of the squash commit, so the id reaches main, and git log between two release tags lists the ids a release delivers. Updates opened by Dependabot or Renovate are skipped.',
      tool: 'GitHub Actions (pull_request, the edited type included) with jq and grep',
      language: 'yaml',
      snippet: `# .github/workflows/traceability.yml, listed as the required check "ticket-id" on main
name: traceability
on:
  pull_request:
    types: [opened, edited, synchronize, reopened]
permissions:
  contents: read
jobs:
  ticket-id:
    if: github.event.pull_request.user.type != 'Bot'   # Dependabot and Renovate updates carry no ticket
    runs-on: ubuntu-latest
    steps:
      - name: The title names a ticket or requirement id
        run: |
          title=$(jq -r '.pull_request.title' "$GITHUB_EVENT_PATH")
          if ! grep -qE '{{TICKET_PATTERN}}' <<< "$title"; then
            echo "::error::the pull request title names no id matching {{TICKET_PATTERN}}: $title"
            exit 1
          fi`,
    },
  ],
}

export default pack
