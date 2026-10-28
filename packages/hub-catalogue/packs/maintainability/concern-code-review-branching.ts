import type { PackSpec } from '../../src/packSpec'

const MODELS = ['adr-trunk', 'adr-feature-pr', 'adr-gitflow']
const FORCES = 'Several people change the code of this element every day, and every change travels from one machine to the main branch through a branch, a review and a merge. The forces: a branch that lives long drifts from main and merges with pain, but one merged within hours needs a way to hide unfinished work; a review catches the mistakes tests do not describe, but a review that waits a day stalls every change behind it and a review of 2,000 lines catches almost nothing (SmartBear: defect density falls off past about 400 lines); the people who know a directory best are not always free to review it; the history of main is what the next incident is debugged from, so what a commit message says and whether history is linear matters a year later; and products shipped in numbered versions to customers who install them need branches for versions in support, which a service deployed continuously never does.'

const pack: PackSpec = {
  id: 'concern-code-review-branching',
  name: 'Code review and branching',
  group: 'maintainability',
  description: 'How a change travels from a developer\'s machine to the main branch: the branching model, who reviews it and how many must approve, who owns which code, how big a change may be and how old a branch, and what a commit message says.',
  tags: ['maintainability', 'code review', 'branching', 'trunk-based development', 'codeowners', 'conventional commits', 'pull requests'],
  concern: {
    id: 'code-review-branching',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements and several people change it, so how a change is branched, reviewed and merged has to be decided.',
  },
  sources: [
    { title: 'Google Engineering Practices: Code Review Developer Guide', url: 'https://google.github.io/eng-practices/review/' },
    { title: 'Paul Hammant: Trunk Based Development', url: 'https://trunkbaseddevelopment.com/' },
    { title: 'Martin Fowler: Patterns for Managing Source Code Branches', url: 'https://martinfowler.com/articles/branching-patterns.html' },
    { title: 'DORA: DevOps Research and Assessment (Accelerate, State of DevOps)', url: 'https://dora.dev/' },
    { title: 'Vincent Driessen: A successful Git branching model (with the 2020 note of reflection)', url: 'https://nvie.com/posts/a-successful-git-branching-model/' },
    { title: 'Conventional Commits 1.0.0', url: 'https://www.conventionalcommits.org/en/v1.0.0/' },
    { title: 'SmartBear: Best Practices for Peer Code Review (the Cisco review study)', url: 'https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/' },
    { title: 'GitHub Docs: About code owners', url: 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners' },
    { title: 'GitHub Docs: About rulesets', url: 'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets' },
  ],
  questions: [
    {
      key: 'BRANCHING', title: 'Branching', label: 'How do changes reach the main branch?',
      hint: 'This decides how long a change lives apart from everyone else\'s, how unfinished work is hidden, and whether there are branches for versions at all.',
      default: 'trunk',
      options: [
        { value: 'trunk', label: 'trunk-based development', description: 'Everyone works on main: a change is a branch of at most a day or two merged through a short pull request, or a pair\'s commit straight to main; unfinished work ships behind a feature flag. Pick it for a service you deploy continuously (see the Deployment pack) with a test suite the team trusts and a team willing to split work into small steps.' },
        { value: 'feature-pr', label: 'feature branches with a pull request each', description: 'Each change is a branch with a pull request, merged to main when reviewed and green; main is always releasable and nothing lives on it that is not reviewed. Pick it for most teams: it needs no feature flags for unfinished work, as long as branches stay under a week and are rebased daily.' },
        { value: 'gitflow', label: 'GitFlow with release and hotfix branches', description: 'A develop branch collects the next version, a release/x.y branch stabilises it, main holds only tagged releases, and hotfix branches patch a version in support. Pick it only for a product shipped in numbered versions that customers install and keep running (desktop, on-premises, embedded, SDKs); for a deployed service its own author advises against it (Driessen, 2020 note).' },
      ],
    },
    {
      key: 'REVIEW', title: 'Review', label: 'Who must approve a change?',
      hint: 'A review catches the mistakes tests do not describe and spreads knowledge of the code; the rule says how many eyes a change gets and whether a pair counts.',
      default: 'one-reviewer',
      options: [
        { value: 'one-reviewer', label: 'one approving review from someone other than the author', description: 'Every pull request needs one approval from a person who did not write it; a new commit dismisses stale approvals. Pick it as the baseline for a team of three or more; it is what Google\'s practice and the DORA data assume.' },
        { value: 'two-critical', label: 'two reviews on critical paths, one elsewhere', description: 'Changes under {{CRITICAL_PATHS}} need two approvals, one from the owning team; everything else needs one. Pick it when some directories move money, decide access or change the schema, so a mistake there costs more than a second review.' },
        { value: 'pairing', label: 'pair or mob programming counts as the review', description: 'A change written by a pair or mob carries Co-authored-by trailers and the partner\'s approval merges it; a change written alone still needs one review. Pick it for a team that pairs most of the day and wants to merge within the hour instead of waiting for an asynchronous review.' },
      ],
    },
    {
      key: 'OWNERSHIP', title: 'Ownership', label: 'Who owns which code?',
      hint: 'Ownership decides who is asked to review and who may say no; without it, reviews go to whoever is free and nobody is accountable for a directory.',
      default: 'codeowners',
      options: [
        { value: 'codeowners', label: 'CODEOWNERS per directory', description: 'A CODEOWNERS file maps every top-level directory to a team; a change under a directory needs that team\'s approval and GitHub asks it automatically. Pick it with two or more teams in one repository, or anywhere a directory holds code with a single accountable team.' },
        { value: 'collective', label: 'collective ownership with rotating reviewers', description: 'Anyone may change and review anything; a reviewer is assigned round-robin from the team so that reviews spread and knowledge does too. Pick it for one team of up to about eight on one codebase, where naming owners per directory would create bottlenecks.' },
      ],
    },
    {
      key: 'SIZE', title: 'Size', label: 'Is there a limit on the size of a change?',
      hint: 'Reviewers find most defects in the first 200 to 400 lines and little after that; a limit forces the split that reviewers would otherwise have to ask for.',
      default: 'limit',
      options: [
        { value: 'limit', label: 'a hard limit per pull request', description: 'A pull request may change at most {{MAX_PR_LINES}} lines (generated files and lock files excluded) and is split otherwise; a lead may label an exception. Pick it whenever reviews are slow or shallow today: a limit is the one lever that changes both.' },
        { value: 'none', label: 'no limit, reviewers may ask to split', description: 'Size is reported on every pull request but nothing blocks; a reviewer may send a large change back. Pick it for a small, disciplined team where large changes are rare and already questioned.' },
      ],
    },
    {
      key: 'COMMITS', title: 'Commits', label: 'What must a commit message say?',
      hint: 'The history of main is what the next incident is debugged from and, with a convention, what the changelog and version number are computed from.',
      default: 'conventional',
      options: [
        { value: 'conventional', label: 'Conventional Commits, enforced by commitlint', description: 'Every commit subject is type(scope): description (feat, fix, refactor, …), checked by a commit-msg hook and in CI; the changelog and the next version are derived from the types. Pick it when you publish a changelog or version numbers, or several teams read one history.' },
        { value: 'free', label: 'free-form, squash-merged', description: 'A subject line under 72 characters in the imperative, a body that says why; pull requests are squash-merged so main holds one commit per change with its pull request number. Pick it when nothing is derived from the messages and the pull request, not the commit, is the unit of history.' },
      ],
    },
  ],
  details: [
    { key: 'MAX_PR_LINES', label: 'How many changed lines may a pull request have at most?', default: '400', number: true },
    { key: 'MAX_BRANCH_DAYS', label: 'How old may a branch get before it is flagged (days; 2 for trunk-based, 7 otherwise)?', default: '2', number: true },
    { key: 'REVIEW_HOURS', label: 'Within how many working hours must a pull request get its first review?', default: '4', number: true },
    { key: 'CRITICAL_PATHS', label: 'Which directories are critical (need the stricter review)?', default: 'payments/, auth/, migrations/' },
  ],
  need: {
    label: 'Changes merge small, reviewed and soon',
    text: 'Several people change this element every day. Each change must reach the main branch while it is still small enough to review and fresh enough to merge without conflict, must be seen by someone other than its author before it lands, must be looked at by the people accountable for the code it touches, and must leave a history that explains itself a year later. Reviews must not become the queue everything waits in.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-protected-main', label: 'Main branch protected', ears_type: 'ubiquitous',
      action: 'protect the main branch with a ruleset that refuses direct pushes, force pushes and deletion, requires the pull-request checks named by the Code quality gate and Test strategy decisions to pass, and keeps the history linear (squash or rebase merges only)',
      rationale: 'A rule that lives in people\'s memory is skipped under pressure; one in the repository\'s rulesets is not, and a linear history is what bisect and blame work on (GitHub Docs: About rulesets; Fowler, Patterns for Managing Source Code Branches: mainline).',
      scenario: { label: 'Direct push refused', given: 'a developer with write access', when: 'they push a commit straight to main, then force-push a branch that was merged', then: 'both pushes are refused by the ruleset and the only way in is a pull request with green checks' },
    },
    {
      id: 'req-one-review', label: 'One review from another person', when: { REVIEW: ['one-reviewer'] }, ears_type: 'state-driven',
      precondition: 'a pull request has no approving review from a person other than its author, or its last approval predates its latest commit',
      action: 'refuse to merge it',
      rationale: 'The author is the one person who cannot see their own blind spots; a stale approval has not seen the code being merged (Google, Code Review Developer Guide: the standard of code review).',
      scenario: { label: 'Stale approval dismissed', given: 'a pull request approved by a reviewer', when: 'the author pushes another commit', then: 'the approval is dismissed and the merge button stays disabled until someone approves again' },
    },
    {
      id: 'req-two-critical', label: 'Two reviews on critical paths', when: { REVIEW: ['two-critical'] }, ears_type: 'state-driven',
      precondition: 'a pull request changes a file under {{CRITICAL_PATHS}}',
      action: 'require two approving reviews from people other than the author, at least one from the owning team, before it merges; one approval elsewhere',
      rationale: 'Where a mistake moves money, grants access or loses data, a second reviewer is cheaper than the incident; everywhere else a second review only lengthens the queue (SmartBear, review study: inspection rate and defect density).',
      scenario: { label: 'Second approval required', given: 'a pull request changing a file under {{CRITICAL_PATHS}} with one approval', when: 'the merge is attempted', then: 'the required check "critical-paths-review" fails naming the files and the missing second approval' },
    },
    {
      id: 'req-pairing', label: 'Pair counts as review', when: { REVIEW: ['pairing'] }, ears_type: 'event-driven',
      trigger: 'a change written by a pair or mob is opened as a pull request',
      action: 'carry a Co-authored-by trailer for every partner on each commit, accept the partner\'s approval as the review, and require one review from someone else for a change whose commits name no partner',
      rationale: 'Two people at one keyboard have reviewed every line as it was written; the trailer makes that visible and auditable, and a solo change gets the review it did not have (Fowler, Patterns for Managing Source Code Branches: pre-integration review vs. pairing).',
      scenario: { label: 'Solo change still reviewed', given: 'two pull requests, one with Co-authored-by trailers on all commits and one without', when: 'each is approved by a co-author of the first', then: 'the first may merge; the second waits for a review from someone who did not write it' },
    },
    {
      id: 'req-turnaround', label: 'First review within hours', ears_type: 'event-driven',
      trigger: 'a pull request is marked ready for review',
      action: 'give it a first review (approval or comments) within {{REVIEW_HOURS}} working hours, with the median over the last 30 days under {{REVIEW_HOURS}} hours and the 90th percentile under one working day',
      rationale: 'A review that waits a day stalls the change, grows it while it waits, and pushes the author to start another branch; Google asks for a reply within one business day at most and prefers hours (Google, Speed of Code Reviews; DORA, lead time for changes).',
      scenario: { label: 'Review turnaround measured', given: 'the pull requests merged in the last 30 days', when: 'the time from ready-for-review to the first review is computed from each timeline', then: 'the median is under {{REVIEW_HOURS}} working hours and the 90th percentile under one working day' },
    },
    {
      id: 'req-owner-approval', label: 'Owning team approves', when: { OWNERSHIP: ['codeowners'] }, ears_type: 'event-driven',
      trigger: 'a pull request changes a file under a directory listed in CODEOWNERS',
      action: 'request a review from the owning team automatically and refuse to merge until a member of it approves, with every top-level directory listed in CODEOWNERS and 0 paths without an owner',
      rationale: 'The team accountable for a directory is the one that knows what a change there breaks; a directory without an owner is reviewed by nobody in particular (GitHub Docs: About code owners).',
      scenario: { label: 'Owner review requested', given: 'a CODEOWNERS file naming a team for payments/', when: 'a pull request changes payments/refund.ts', then: 'the team is requested automatically and the merge waits for one of its members' },
    },
    {
      id: 'req-rotation', label: 'Reviewer assigned by rotation', when: { OWNERSHIP: ['collective'] }, ears_type: 'event-driven',
      trigger: 'a pull request is marked ready for review',
      action: 'assign one reviewer from the team round-robin within 15 minutes, skipping the author and anyone out of office, so that over a month no two people review more than 40% of each other\'s changes',
      rationale: 'Collective ownership works only when reviews actually spread; left to volunteers they go to the same two people (Fowler, Patterns for Managing Source Code Branches; Google, The Standard of Code Review: knowledge sharing).',
      scenario: { label: 'Reviewer rotated', given: 'a team of six with round-robin assignment', when: 'twelve pull requests are opened in a week', then: 'each member other than the author was assigned at least one, within 15 minutes of ready-for-review' },
    },
    {
      id: 'req-pr-size', label: 'Oversized change split', when: { SIZE: ['limit'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request changes more than {{MAX_PR_LINES}} lines, generated files and lock files excluded',
      action: 'fail the size check with the count and the suggestion to split, and allow the merge only with a size-exception label set by a lead and a reason in the description',
      rationale: 'Reviewers find most defects in the first 200 to 400 lines and little after; past that a review is a formality (SmartBear, review study: 200 to 400 LOC per review; Google, Small CLs).',
      scenario: { label: 'Large pull request blocked', given: 'a pull request changing {{MAX_PR_LINES}} + 1 lines of source', when: 'the size check runs', then: 'it fails with the line count, and passes only after a split or a size-exception label with a reason' },
    },
    {
      id: 'req-branch-age', label: 'Old branches flagged', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a branch other than main, develop or a release or hotfix branch has not been merged {{MAX_BRANCH_DAYS}} days after its first commit',
      action: 'flag it in the daily report and tell its author to merge, split or delete it; bot branches (renovate/, dependabot/) are listed apart',
      rationale: 'The cost of a merge grows with the time apart; a branch older than a few days is already a merge nobody wants to do (Hammant, Trunk Based Development: short-lived feature branches; DORA: lead time).',
      scenario: { label: 'Stale branch reported', given: 'a branch whose first commit is {{MAX_BRANCH_DAYS}} + 1 days old and unmerged', when: 'the daily branch report runs', then: 'the branch is listed with its author and age, and renovate/ and dependabot/ branches appear in a separate list' },
    },
    {
      id: 'req-conventional', label: 'Conventional commit messages', when: { COMMITS: ['conventional'] }, ears_type: 'ubiquitous',
      action: 'accept only commits whose subject follows Conventional Commits 1.0.0 (type, optional scope, description under 72 characters; a ! or BREAKING CHANGE footer for breaking changes), checked by a commit-msg hook on every machine and by commitlint over the pull request\'s commits in CI',
      rationale: 'A typed history is read by people and by tools: the changelog and the next version are computed from it, and a breaking change is marked where it was made (Conventional Commits 1.0.0).',
      scenario: { label: 'Untyped commit refused', given: 'a developer committing "fixed stuff"', when: 'the commit-msg hook runs, and then the same commit is pushed in a pull request', then: 'the hook refuses it, and the CI commitlint job fails the pull request naming the commit' },
    },
    {
      id: 'req-free-commits', label: 'Short subjects, one commit per change', when: { COMMITS: ['free'] }, ears_type: 'ubiquitous',
      action: 'keep every commit subject under 72 characters in the imperative with a body saying why, and squash-merge pull requests so that main holds one commit per change with the pull request number in its subject',
      rationale: 'Without a convention, the pull request is the unit of history; squashing keeps main as one line per change with a link to the discussion that explains it (Fowler, Patterns for Managing Source Code Branches: mainline integration).',
      scenario: { label: 'Squash merge only', given: 'a pull request with five commits', when: 'it is merged', then: 'main gains exactly one commit whose subject is under 72 characters and ends with the pull request number' },
    },
    {
      id: 'req-trunk', label: 'Branches merge within days', when: { BRANCHING: ['trunk'] }, ears_type: 'ubiquitous',
      action: 'merge every branch to main within {{MAX_BRANCH_DAYS}} days of its first commit, hide unfinished work behind a feature flag (as the Deployment decision sets) or a branch by abstraction, and have every developer integrate to main at least once a working day',
      rationale: 'Daily integration is the practice behind the DORA findings on lead time and change failure rate; a change that waits a week is a week of other people\'s changes to merge against (Hammant, Trunk Based Development; DORA, Trunk-based development capability).',
      scenario: { label: 'Daily integration', given: 'the merges to main over the last 10 working days', when: 'they are grouped by author and day', then: 'every active developer merged on at least 8 of the 10 days and no branch was older than {{MAX_BRANCH_DAYS}} days at merge' },
    },
    {
      id: 'req-feature-pr', label: 'Main always releasable', when: { BRANCHING: ['feature-pr'] }, ears_type: 'ubiquitous',
      action: 'make every change through a branch and a pull request rebased on main before merge, merge only when reviewed and green, keep branches under {{MAX_BRANCH_DAYS}} days, and keep main releasable at every commit',
      rationale: 'A pull request per change gives every change its review and its checks before it lands; the branch age keeps the model close to continuous integration instead of drifting to long-lived feature branches (Fowler, Patterns for Managing Source Code Branches: feature branching; Hammant: short-lived branches).',
      scenario: { label: 'Any commit of main releases', given: 'the last 20 commits on main', when: 'each is checked out and the release pipeline run', then: 'every one builds, passes its checks and deploys to a test environment' },
    },
    {
      id: 'req-gitflow', label: 'Releases and hotfixes branched', when: { BRANCHING: ['gitflow'] }, ears_type: 'event-driven',
      trigger: 'a version is about to ship, or a shipped version needs a fix',
      action: 'create release/x.y from develop (fixes only, no features), merge it to main with an annotated tag vX.Y.Z and back into develop, and for a fix branch hotfix/x.y.z from the tag on main and merge it to both main and develop, so that main holds only tagged releases',
      rationale: 'Customers who installed version 2.3 need a 2.3.1 without the features of 2.4; release and hotfix branches give each supported version a place to be fixed (Driessen, A successful Git branching model).',
      scenario: { label: 'Hotfix reaches both branches', given: 'version 2.3.0 tagged on main and develop ahead of it', when: 'a hotfix/2.3.1 is merged', then: 'main holds the tag v2.3.1, develop contains the fix, and main\'s history holds no commit outside release and hotfix merges' },
    },
  ],
  adrs: [
    {
      id: 'adr-trunk', label: 'Trunk-based development', when: { BRANCHING: ['trunk'] },
      decision: 'The element is developed trunk-based on GitHub: a change is a branch of at most {{MAX_BRANCH_DAYS}} days merged to main through a short pull request, and unfinished work ships behind a feature flag (OpenFeature with the provider the Deployment decision names) or a branch by abstraction. Main is protected by a ruleset: no direct push or force push, required checks (the Code quality gate and Test strategy jobs), linear history by squash merge. Review: {{REVIEW}}. Ownership: {{OWNERSHIP}}. Size: {{SIZE}}, with {{MAX_PR_LINES}} lines as the limit. Commits: {{COMMITS}}. A first review is due within {{REVIEW_HOURS}} working hours; a daily job (gh api) lists branches older than {{MAX_BRANCH_DAYS}} days and pull requests over the limit.',
      consequences: '• Merges are small and conflicts rare, because nobody is more than two days away from main; lead time for a change is hours.\n• Unfinished work needs flags or abstraction seams, and flags need clean-up (the Deployment pack\'s stale-flag check).\n• Every developer must split work into steps that each leave main releasable, which is a skill the team has to build.\n• There is no branch to stabilise a release on: the test suite and the rollout checks are the only safety net.',
      alternatives: '1. Feature branches with a pull request each: no flags needed for unfinished work, but branches live longer and merges hurt more.\n2. GitFlow: a branch per release, right for installed products, needless ceremony for a service deployed continuously.\n3. Direct commits to main without pull requests: faster still, but the review and the checks have nowhere to run before the code lands.',
    },
    {
      id: 'adr-feature-pr', label: 'Feature branches with pull requests', when: { BRANCHING: ['feature-pr'] },
      decision: 'Every change to the element is a branch from main and a pull request on GitHub, rebased on main before merge and merged by squash when reviewed and green; main is always releasable and nothing reaches it any other way. Branches stay under {{MAX_BRANCH_DAYS}} days, and a daily job (gh api) flags the ones that do not. Main is protected by a ruleset: no direct push or force push, required checks (the Code quality gate and Test strategy jobs), linear history. Review: {{REVIEW}}. Ownership: {{OWNERSHIP}}. Size: {{SIZE}}, with {{MAX_PR_LINES}} lines as the limit. Commits: {{COMMITS}}. A first review is due within {{REVIEW_HOURS}} working hours.',
      consequences: '• Every change gets its review and its checks before it lands; main is releasable at any commit.\n• Unfinished work can stay on its branch, so no feature flags are needed for it, but a branch past a week drifts and merges with pain: the age check is what keeps this model honest.\n• Two branches that touch the same files find out at merge time, later than trunk-based development would.\n• Pull requests are the unit of history and discussion; the merge commit (or squash) links to it.',
      alternatives: '1. Trunk-based development: shorter lead time and fewer merge conflicts, at the price of feature flags and smaller steps.\n2. GitFlow: adds develop, release and hotfix branches that a continuously deployed service does not need.\n3. Long-lived feature branches merged when the feature is done: the merges become projects of their own and main stops reflecting the team\'s work.',
    },
    {
      id: 'adr-gitflow', label: 'GitFlow with release and hotfix branches', when: { BRANCHING: ['gitflow'] },
      context: `${FORCES} Here the element ships in numbered versions that customers install and keep running, so a version in support needs a branch of its own to be fixed on.`,
      decision: 'The element follows GitFlow on GitHub: feature branches merge to develop through pull requests; a release/x.y branch is cut from develop for each version, takes fixes only, and is merged to main with an annotated tag vX.Y.Z and back into develop; a hotfix/x.y.z branch is cut from the tag on main and merged to both. Main and develop are protected by rulesets (no direct or force push, required checks from the Code quality gate and Test strategy decisions); main accepts merges from release/* and hotfix/* only. Review: {{REVIEW}}. Ownership: {{OWNERSHIP}}. Size: {{SIZE}}, with {{MAX_PR_LINES}} lines as the limit. Commits: {{COMMITS}}. Feature branches stay under {{MAX_BRANCH_DAYS}} days; a first review is due within {{REVIEW_HOURS}} working hours. The git-flow AVH command-line extension does the branching; a GitHub Actions job checks main\'s history.',
      consequences: '• Each supported version has a branch to fix on; customers on 2.3 get 2.3.1 without 2.4\'s features.\n• Two long-lived branches (main, develop) and a release branch per version mean double merges and the occasional fix forgotten on one side; the back-merge is checked, not trusted.\n• Integration happens on develop, later than on a trunk; the age limit on feature branches keeps it from drifting further.\n• The model\'s own author advises against it for software deployed continuously; if the element ever becomes a service, this decision is superseded by trunk-based development.',
      alternatives: '1. Trunk-based development with release branches cut from main and fixes cherry-picked back: fewer long-lived branches, enough for most versioned products (Hammant: branch for release).\n2. Feature branches with pull requests and tags on main only: no place to fix a version in support once main has moved on.\n3. One branch per customer version kept forever: unbounded maintenance.',
    },
    {
      id: 'adr-codeowners', label: 'Code owners per directory', when: { OWNERSHIP: ['codeowners'] },
      decision: 'A CODEOWNERS file at .github/CODEOWNERS maps every top-level directory of the element to a GitHub team; a catch-all line at the top names the platform team for anything unlisted. The ruleset requires a code-owner review, so a change under a directory waits for its team, which GitHub requests automatically. Critical directories ({{CRITICAL_PATHS}}) are owned by the team accountable for them. A CI check parses CODEOWNERS and fails when a top-level directory has no owner or an owner is not a team.',
      consequences: '• The people who know a directory see every change to it, and a change in payments/ cannot be waved through by a stranger.\n• A team that is slow to review becomes a bottleneck for everyone touching its directory; the turnaround measure shows where.\n• The file must be kept in step with the directory tree; the check fails the build when it is not.\n• Cross-cutting changes collect several owners and several approvals.',
      alternatives: '1. Collective ownership with rotating reviewers: no bottleneck per directory, but nobody accountable for one either.\n2. Owners listed in a wiki: not enforced, out of date within a month.\n3. One owner for the whole repository: a single person on every pull request\'s path.',
    },
  ],
  fitness: [
    {
      id: 'ff-branch-protection', label: 'Main is protected by a ruleset', category: 'structural', implements: MODELS,
      threshold: 'The rules active on main include pull_request with at least 1 required approval and stale-review dismissal, required_status_checks with strict mode, non_fast_forward (no force push), deletion, and required_linear_history; 0 of them missing',
      description: 'A scheduled job reads the rules in force on main through the GitHub API (rulesets and classic protection combined) and fails when one of the required rules is missing or weaker than the decision, so a setting changed by hand in the web UI is noticed within a day.',
      tool: 'GitHub CLI (gh api) in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# fails when a rule required by the branching decision is missing on main
set -euo pipefail
rules=$(gh api "repos/$GITHUB_REPOSITORY/rules/branches/main")
need() { echo "$rules" | jq -e "$1" > /dev/null || { echo "missing on main: $2"; exit 1; }; }
need 'map(select(.type=="pull_request" and .parameters.required_approving_review_count>=1 and .parameters.dismiss_stale_reviews_on_push)) | length>0' 'pull request with 1 approval, stale reviews dismissed'
need 'map(select(.type=="required_status_checks" and .parameters.strict_required_status_checks_policy)) | length>0' 'required status checks (strict)'
need 'map(select(.type=="non_fast_forward")) | length>0' 'no force push'
need 'map(select(.type=="deletion")) | length>0' 'no deletion'
need 'map(select(.type=="required_linear_history")) | length>0' 'linear history'
echo "main is protected as decided"`,
    },
    {
      id: 'ff-codeowners', label: 'Every directory has an owner', when: { OWNERSHIP: ['codeowners'] }, category: 'structural', implements: ['adr-codeowners'],
      threshold: '0 top-level directories without a matching CODEOWNERS line; every owner is a team (@org/team); the ruleset requires a code-owner review',
      description: 'The CODEOWNERS file names a team per top-level directory with a catch-all first; a CI step walks the top-level directories and fails when one has no line of its own, or when an owner is a single person instead of a team.',
      tool: 'GitHub CODEOWNERS with a shell check in CI',
      language: 'bash',
      snippet: `# .github/CODEOWNERS
# *                 @shop/platform          (catch-all, first so later lines win)
# payments/         @shop/payments
# auth/             @shop/identity
# migrations/       @shop/data @shop/payments
# web/              @shop/storefront

# CI step: every top-level directory owned by a team
set -euo pipefail
for dir in $(git ls-tree -d --name-only HEAD | grep -v '^\\.'); do
  grep -Eq "^$dir/\\s+@[a-z0-9-]+/[a-z0-9-]+" .github/CODEOWNERS || { echo "no team owns $dir/"; exit 1; }
done
grep -Eq '^\\S+\\s+@[a-z0-9-]+\\s*$' .github/CODEOWNERS && { echo "an owner is a person, not a team"; exit 1; }
echo "every top-level directory has an owning team"`,
    },
    {
      id: 'ff-pr-size', label: 'Pull requests stay small', when: { SIZE: ['limit'] }, category: 'process', implements: MODELS,
      threshold: 'Changed lines per pull request (additions + deletions, generated and lock files excluded) at most {{MAX_PR_LINES}}; the check fails above it unless the size-exception label is set',
      description: 'A required check on every pull request sums additions and deletions over its files from the GitHub API, skipping lock files, snapshots and generated code, and fails above the limit with the count; a lead may set the size-exception label, which the check honours and which is reported weekly.',
      tool: 'GitHub CLI (gh api) as a required GitHub Actions check',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# required check "pr-size": fails above MAX_PR_LINES changed lines of source
set -euo pipefail
MAX=400   # MAX_PR_LINES
pr=$(jq -r .pull_request.number "$GITHUB_EVENT_PATH")
lines=$(gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$pr/files" \\
  | jq '[.[] | select(.filename | test("(package-lock\\\\.json|yarn\\\\.lock|pnpm-lock\\\\.yaml|\\\\.snap$|/generated/|\\\\.min\\\\.js$)") | not)
         | .additions + .deletions] | add // 0')
labels=$(gh pr view "$pr" --json labels -q '.labels[].name')
echo "changed lines of source: $lines (limit $MAX)"
if [ "$lines" -gt "$MAX" ] && ! grep -qx size-exception <<< "$labels"; then
  echo "::error::$lines changed lines; split the pull request or ask a lead for the size-exception label"; exit 1
fi`,
    },
    {
      id: 'ff-branch-age', label: 'No long-lived branches', category: 'process', implements: MODELS,
      threshold: '0 branches older than {{MAX_BRANCH_DAYS}} days (first commit not on main) other than main, develop, release/* and hotfix/*; bot branches (renovate/, dependabot/) reported apart and not counted',
      description: 'A daily job lists every branch, computes the age of its first commit not on main, and fails naming the branches over the limit and their last authors; Renovate and Dependabot branches are listed separately so a stale dependency update does not hide a stale feature branch, and the other way round.',
      tool: 'git and GitHub CLI in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# daily: flags branches whose first own commit is older than MAX_BRANCH_DAYS
set -euo pipefail
MAX=2   # MAX_BRANCH_DAYS: 2 for trunk-based, 7 otherwise
git fetch --prune origin '+refs/heads/*:refs/remotes/origin/*'
now=$(date +%s); stale=0
for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -Ev '/(main|develop|HEAD)$|/(release|hotfix)/'); do
  first=$(git log --reverse --format=%ct origin/main.."$b" | head -1); [ -z "$first" ] && continue
  age=$(( (now - first) / 86400 )); author=$(git log -1 --format=%an "$b")
  case "$b" in origin/renovate/*|origin/dependabot/*) echo "bot: $b $age d";; *)
    [ "$age" -gt "$MAX" ] && { echo "::error::$b is $age days old (last: $author); merge, split or delete it"; stale=$((stale+1)); };;
  esac
done
[ "$stale" -eq 0 ]`,
    },
    {
      id: 'ff-commitlint', label: 'Commit messages are conventional', when: { COMMITS: ['conventional'] }, category: 'process', implements: MODELS,
      threshold: '100% of commits in a pull request pass commitlint with the conventional config; subject at most 72 characters; the hook runs on every clone after npm install',
      description: 'commitlint with the conventional config runs on every commit through a husky commit-msg hook, and again in CI over all commits of the pull request, so a commit made with --no-verify is still caught before the merge. semantic-release or release-please derives the changelog and version from the types.',
      tool: 'commitlint with husky',
      language: 'js',
      snippet: `// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 72],
    'scope-enum': [2, 'always', ['api', 'web', 'payments', 'auth', 'db', 'ci', 'deps']],
  },
}
// package.json: "scripts": { "prepare": "husky" }
// .husky/commit-msg:   npx --no -- commitlint --edit "$1"
// CI (pull_request):   npx commitlint --from "$BASE_SHA" --to "$HEAD_SHA" --verbose`,
    },
    {
      id: 'ff-squash-subjects', label: 'Squash merges with short subjects', when: { COMMITS: ['free'] }, category: 'process', implements: MODELS,
      threshold: 'Repository allows squash merge only (merge commits and rebase merges off); 0 commits on main in the last 30 days with a subject over 72 characters or without a pull request number',
      description: 'A scheduled job reads the repository\'s merge settings through the API and fails unless squash is the only merge method, then walks the last 30 days of main and fails on a subject over 72 characters or one that does not end with a pull request number.',
      tool: 'GitHub CLI (gh api) in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
gh api "repos/$GITHUB_REPOSITORY" | jq -e '.allow_squash_merge and (.allow_merge_commit|not) and (.allow_rebase_merge|not)' > /dev/null \\
  || { echo "::error::squash must be the only merge method"; exit 1; }
bad=0
while IFS= read -r subject; do
  [ "\${#subject}" -le 72 ] && grep -Eq '\\(#[0-9]+\\)$' <<< "$subject" || { echo "::error::bad subject on main: $subject"; bad=$((bad+1)); }
done < <(git log --since='30 days ago' --no-merges --format=%s origin/main)
[ "$bad" -eq 0 ]`,
    },
    {
      id: 'ff-review-turnaround', label: 'Reviews come within hours', category: 'holistic', implements: MODELS,
      threshold: 'Over the last 30 days, time from ready-for-review to the first review: median under {{REVIEW_HOURS}} working hours, 90th percentile under one working day (8 hours)',
      description: 'A weekly job reads every merged pull request\'s timeline through the GraphQL API, takes the later of its creation and its last ready-for-review event as the start and the first review or review comment by someone other than the author as the end, counts working hours (Mon–Fri, 9–17 in the team\'s zone) between them, and fails on the percentiles; the numbers go to the team\'s dashboard beside the DORA lead time.',
      tool: 'GitHub GraphQL API (gh api graphql) with a Node script',
      language: 'ts',
      snippet: `// scripts/review-turnaround.ts  (run weekly; REVIEW_HOURS=4)
import { execFileSync } from 'node:child_process'
const q = \`query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){
  pullRequests(last:100, states:MERGED, orderBy:{field:UPDATED_AT,direction:DESC}){ nodes{ number createdAt author{login}
    timelineItems(itemTypes:[READY_FOR_REVIEW_EVENT,PULL_REQUEST_REVIEW], first:50){ nodes{ __typename
      ... on ReadyForReviewEvent{ createdAt } ... on PullRequestReview{ createdAt author{login} } } } } } } }\`
const [owner, name] = process.env.GITHUB_REPOSITORY!.split('/')
const data = JSON.parse(execFileSync('gh', ['api', 'graphql', '-f', \`query=\${q}\`, '-F', \`owner=\${owner}\`, '-F', \`name=\${name}\`]).toString())
const hours = data.data.repository.pullRequests.nodes.flatMap((pr: any) => {
  const items = pr.timelineItems.nodes
  const ready = items.filter((i: any) => i.__typename === 'ReadyForReviewEvent').map((i: any) => i.createdAt).sort().pop() ?? pr.createdAt
  const first = items.find((i: any) => i.__typename === 'PullRequestReview' && i.author?.login !== pr.author?.login && i.createdAt > ready)
  return first ? [workingHours(new Date(ready), new Date(first.createdAt))] : []   // workingHours: Mon–Fri 9–17
}).sort((a: number, b: number) => a - b)
const p = (n: number) => hours[Math.floor(hours.length * n)] ?? 0
console.log({ prs: hours.length, p50: p(0.5), p90: p(0.9) })
if (p(0.5) > Number(process.env.REVIEW_HOURS ?? 4) || p(0.9) > 8) process.exit(1)`,
    },
    {
      id: 'ff-critical-two-approvals', label: 'Critical paths get two approvals', when: { REVIEW: ['two-critical'] }, category: 'process', implements: MODELS,
      threshold: 'A pull request touching {{CRITICAL_PATHS}} merges only with 2 approvals from non-authors, one from the owning team; 0 such merges with fewer',
      description: 'GitHub rulesets cannot vary the approval count by path, so a required check does it: on every review and push it lists the changed files, and when one is under a critical path it counts current approvals by people other than the author and fails below two; CODEOWNERS supplies the owning team\'s approval.',
      tool: 'GitHub Actions with gh (required check "critical-paths-review")',
      language: 'yaml',
      snippet: `# .github/workflows/critical-paths-review.yml
name: critical-paths-review
on:
  pull_request: { types: [opened, synchronize, ready_for_review] }
  pull_request_review: { types: [submitted, dismissed] }
jobs:
  check:
    runs-on: ubuntu-latest
    env: { GH_TOKEN: \${{ github.token }}, PR: \${{ github.event.pull_request.number }}, CRITICAL: '^(payments|auth|migrations)/' }
    steps:
      - run: |
          files=$(gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$PR/files" -q '.[].filename')
          grep -Eq "$CRITICAL" <<< "$files" || { echo "no critical path touched"; exit 0; }
          author=$(gh pr view "$PR" --json author -q .author.login)
          approvals=$(gh pr view "$PR" --json reviews -q "[.reviews[] | select(.state==\\"APPROVED\\" and .author.login!=\\"$author\\") | .author.login] | unique | length")
          [ "$approvals" -ge 2 ] || { echo "::error::critical path changed; $approvals of 2 approvals"; exit 1; }`,
    },
    {
      id: 'ff-pair-trailer', label: 'Pair changes name their partner', when: { REVIEW: ['pairing'] }, category: 'process', implements: MODELS,
      threshold: 'A pull request merged on a co-author\'s approval has a Co-authored-by trailer naming that co-author on 100% of its commits; a pull request without trailers has an approval from someone other than the author',
      description: 'A required check reads the pull request\'s commits and approvals: when every commit carries a Co-authored-by trailer, an approval from one of the named partners is enough; otherwise it demands an approval from someone who authored none of the commits. Pairs set the trailer once with git-mob or a commit template.',
      tool: 'GitHub Actions with gh and git interpret-trailers (required check "pair-or-review")',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# required check "pair-or-review": a pair's partner may approve; a solo change needs an outsider
set -euo pipefail
author=$(gh pr view "$PR" --json author -q .author.login)
approvers=$(gh pr view "$PR" --json reviews -q '.reviews[] | select(.state=="APPROVED") | .author.login' | sort -u | grep -vx "$author" || true)
[ -n "$approvers" ] || { echo "::error::no approval from anyone but the author"; exit 1; }
trailers=""; solo=0
for sha in $(gh pr view "$PR" --json commits -q '.commits[].oid'); do
  t=$(git log -1 --format=%B "$sha" | git interpret-trailers --parse | grep -i '^Co-authored-by:' || true)
  [ -n "$t" ] || solo=1
  trailers="$trailers $(tr 'A-Z' 'a-z' <<< "$t")"
done
[ "$solo" -eq 0 ] && { echo "pair change: Co-authored-by on every commit, partner's approval counts"; exit 0; }
for a in $approvers; do   # a solo change: the approver must not be one of its writers
  grep -q "$(tr 'A-Z' 'a-z' <<< "$a")" <<< "$trailers" || exit 0
done
echo "::error::not every commit names a partner, and every approver co-wrote the change; ask someone else to review"; exit 1`,
    },
    {
      id: 'ff-gitflow-history', label: 'Main holds only releases', when: { BRANCHING: ['gitflow'] }, category: 'structural', implements: ['adr-gitflow'],
      threshold: '100% of merge commits on main come from release/* or hotfix/*; every merge to main carries an annotated tag vX.Y.Z; 0 tags on main absent from develop',
      description: 'A job on every push to main checks that the merged branch was a release or hotfix branch, that the merge is tagged with a semantic version, and that the tagged commit is reachable from develop (the back-merge happened); it fails otherwise, so a forgotten back-merge is found the same day and not in the next release.',
      tool: 'git in a GitHub Actions job on push to main',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# on push to main: release and hotfix merges only, tagged and back-merged
set -euo pipefail
git fetch origin develop --tags
for m in $(git log --merges --first-parent --format=%H origin/main~20..origin/main); do
  src=$(git log -1 --format=%s "$m" | grep -oE "(release|hotfix)/[0-9]+\\.[0-9]+(\\.[0-9]+)?" || true)
  [ -n "$src" ] || { echo "::error::$m merged into main from something other than release/* or hotfix/*"; exit 1; }
  tag=$(git tag --points-at "$m" | grep -E '^v[0-9]+\\.[0-9]+\\.[0-9]+$' || true)
  [ -n "$tag" ] || { echo "::error::merge $m of $src has no vX.Y.Z tag"; exit 1; }
  git merge-base --is-ancestor "$m" origin/develop || { echo "::error::$tag not merged back into develop"; exit 1; }
done
echo "main holds tagged releases, all back-merged"`,
    },
    {
      id: 'ff-daily-integration', label: 'Everyone integrates daily', when: { BRANCHING: ['trunk'] }, category: 'holistic', implements: ['adr-trunk'],
      threshold: 'Over the last 10 working days, every developer with a commit in the period merged to main on at least 8 of the days they committed; branches at merge at most {{MAX_BRANCH_DAYS}} days old',
      description: 'A weekly job groups the merges to main by author and working day and compares them with the days each person committed anywhere; a developer committing for days without merging is working on a hidden branch, which is what trunk-based development is meant to prevent. The result sits beside the DORA lead time on the team\'s dashboard.',
      tool: 'git in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# weekly: days committed vs. days merged to main, per author, last 10 working days
set -euo pipefail
git fetch origin '+refs/heads/*:refs/remotes/origin/*'
since='14 days ago'
committed=$(git log --all --since="$since" --format='%ae %as' | sort -u)
merged=$(git log origin/main --since="$since" --format='%ae %as' | sort -u)
fail=0
for a in $(cut -d' ' -f1 <<< "$committed" | sort -u); do
  c=$(grep -c "^$a " <<< "$committed"); m=$(grep -c "^$a " <<< "$merged" || true)
  echo "$a: committed on $c days, merged to main on $m"
  [ $((m * 10)) -ge $((c * 8)) ] || { echo "::error::$a merged on fewer than 80% of their active days"; fail=1; }
done
exit $fail`,
    },
  ],
}

export default pack
