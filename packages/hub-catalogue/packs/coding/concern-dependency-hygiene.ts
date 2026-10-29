import type { PackSpec, When } from '../../src/packSpec'

const UPDATES = ['adr-automerge', 'adr-weekly-batch', 'adr-manual']
const LOCKED: When = { PINNING: ['lockfile-ranges', 'exact'] }
const FORCES = 'This element is built from third-party packages that keep moving whether or not we follow. The forces: a dependency left alone for a year is upgraded in one painful jump, with every breaking change at once, while small frequent updates each cost minutes; a bot that merges on its own needs tests worth trusting, and one that only opens pull requests buries the team under them; a manifest with ranges and no lockfile builds something different each week, while exact pins turn every update into a commit someone has to make; a package nobody imports any more still gets installed, scanned and patched, and one whose maintainer left stops getting fixes without telling anyone; and a licence that forbids what we do with the code is found at the worst time, in due diligence. Vulnerability scanning and the deadlines to fix a vulnerable dependency, integrity hashes, where packages are fetched from, SBOMs and build provenance are decided by the Software supply chain concern; this one decides how the dependencies are kept current, pinned, used and licensed, and the Backend stack and Frontend stack packs refer here for updates and pinning. The snippets assume an npm project with package.json and package-lock.json at the root (one per workspace in a monorepo), the GitHub CLI, and dependency-exceptions.json at the root for recorded exceptions; each names the equivalent for Python, Go, the JVM and .NET.'

const pack: PackSpec = {
  id: 'concern-dependency-hygiene',
  name: 'Dependency hygiene',
  group: 'coding',
  description: 'Keeping third-party dependencies current, pinned, used and licensed: how updates arrive, how versions are locked, what happens to an unused or abandoned dependency, which licences are allowed, and how far behind upstream the element may fall.',
  tags: ['maintainability', 'dependencies', 'renovate', 'dependabot', 'lockfile', 'libyear', 'licences'],
  concern: {
    id: 'dependency-hygiene',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'these elements are built from third-party packages that keep moving, so how updates arrive, how versions are locked and what happens to unused, abandoned or wrongly licensed dependencies has to be decided; one decision usually covers a whole repository and is bound to every element built from it.',
  },
  sources: [
    { title: 'Renovate docs: Automerge configuration and troubleshooting', url: 'https://docs.renovatebot.com/key-concepts/automerge/' },
    { title: 'Renovate docs: Configuration options, packageRules', url: 'https://docs.renovatebot.com/configuration-options/#packagerules' },
    { title: 'GitHub Docs: Dependabot options reference (groups, schedule, cooldown)', url: 'https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference' },
    { title: 'libyear: a simple measure of dependency freshness (Cox, Bouwers, van Eekelen, Visser: Measuring Dependency Freshness in Software Systems, ICSE 2015)', url: 'https://libyear.com/' },
    { title: 'Semantic Versioning 2.0.0', url: 'https://semver.org/' },
    { title: 'npm Docs: npm ci and package-lock.json', url: 'https://docs.npmjs.com/cli/v10/commands/npm-ci' },
    { title: 'SPDX License List', url: 'https://spdx.org/licenses/' },
    { title: 'Open Source Initiative: OSI Approved Licenses', url: 'https://opensource.org/licenses' },
    { title: 'Martin Fowler: Continuous Integration', url: 'https://martinfowler.com/articles/continuousintegration.html' },
    { title: 'Knip documentation', url: 'https://knip.dev/' },
    { title: 'OWASP Top 10 2021, A06: Vulnerable and Outdated Components', url: 'https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/' },
    { title: 'OpenSSF Scorecard checks: Maintained', url: 'https://github.com/ossf/scorecard/blob/main/docs/checks.md#maintained' },
  ],
  questions: [
    {
      key: 'UPDATES', title: 'Updates', label: 'How do dependency updates arrive?',
      hint: 'This decides most of the rest: how many pull requests people see, how far behind the element may drift, and how much the tests have to be trusted. Other packs (Backend stack, Frontend stack) take this answer as given.',
      default: 'automerge-patch',
      options: [
        { value: 'automerge-patch', label: 'a bot that merges patch and minor updates on its own', description: 'Renovate opens a pull request per update; patch and minor updates of packages that follow semantic versioning (not 0.x) merge automatically once the required checks pass and the release is at least 3 days old, major updates wait for a person. Pick it when the test suite is one you would release on (see the Test strategy concern) and the team would rather review majors than click through dozens of minors.' },
        { value: 'weekly-batch', label: 'one weekly pull request from a bot, merged by a person', description: 'Renovate groups, or Dependabot grouped updates, open one pull request a week with every minor and patch update, and separate ones for majors; a person reviews and merges them within the week. Pick it when the tests are not yet trusted enough to merge unattended, or when the team wants to see what changed.' },
        { value: 'manual', label: 'updates by hand on a cadence, from an outdated report', description: 'No bot pull requests; on a cadence (every 14 days by default) a job publishes an outdated report as an issue and a person applies the updates in one change. Pick it for a small or frozen codebase with few dependencies, or where no bot may open pull requests.' },
      ],
    },
    {
      key: 'PINNING', title: 'Pinning', label: 'How are versions pinned?',
      hint: 'The manifest says what is acceptable, the lockfile says what was installed; the question is which of the two the build obeys, and who decides when it moves. Integrity hashes and SHA-pinned CI actions belong to the Software supply chain concern, which takes this answer as given.',
      default: 'lockfile-ranges',
      options: [
        { value: 'lockfile-ranges', label: 'ranges in the manifest, exact versions in a committed lockfile', description: 'The manifest declares caret ranges (except the formatter, which is pinned exactly, as the Code style and conventions pack decides), the committed lockfile fixes every version, transitive ones included, and CI installs exactly the lockfile (npm ci, pnpm install --frozen-lockfile, uv sync --locked, go mod verify). Pick it as the default for applications: reproducible builds, and updates arrive as lockfile changes the bot can open.' },
        { value: 'exact', label: 'exact versions in the manifest and the lockfile', description: 'The manifest holds no ^ or ~ ranges (save-exact), so every version change is a visible line in a reviewed diff, and the lockfile pins the transitive tree. Pick it when auditors or a platform team want each version change explicit in the manifest, or when a range has already let a surprise in.' },
        { value: 'floating', label: 'ranges without a lockfile, resolved by each consumer', description: 'A library declares the ranges it supports and commits no lockfile, so each consumer resolves its own tree; CI tests the range at its lowest and highest resolution. Pick it only for a published library; an application always locks.' },
      ],
    },
    {
      key: 'UNUSED', title: 'Unused', label: 'What happens to a dependency nobody imports?',
      hint: 'A dependency nobody uses is still installed, scanned, patched and licensed; one that is imported but not declared works only by accident.',
      default: 'forbidden',
      options: [
        { value: 'forbidden', label: 'a failed build', description: 'knip or depcheck (Node), deptry (Python) or go mod tidy -diff run on every pull request and fail it on a declared dependency nobody imports, an import nobody declared, or a dev dependency used in production code. Pick it as the default; the first run cleans the backlog, after that it costs nothing.' },
        { value: 'reviewed', label: 'a report on a cadence, removed in a review', description: 'A scheduled job publishes the unused-dependency report as an issue on a cadence (every 90 days by default) and the team removes or justifies each entry before the next one. Pick it when the analysis has too many false positives on the codebase (plugins loaded by name, dynamic requires) to be a gate yet.' },
      ],
    },
    {
      key: 'LICENCES', title: 'Licences', label: 'Which licences may a dependency carry?',
      hint: 'A copyleft licence in a product that is shipped, or an unknown one, is a legal finding found late; what counts depends on whether the element leaves the organisation.',
      default: 'allowlist',
      options: [
        { value: 'allowlist', label: 'an allowlist of licences', description: 'Every dependency, transitive ones included, must carry one of the allowed SPDX licences (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause and ISC by default); an unknown, missing or copyleft licence fails the build until it is replaced or an exception for that package and version is recorded. Pick it for anything shipped to customers, embedded in a product or offered as a service outside the organisation.' },
        { value: 'denylist', label: 'a denylist of forbidden licences', description: 'The build fails only on the forbidden licences (GPL-2.0-only, GPL-3.0-only, AGPL-3.0-only and SSPL-1.0 by default); other licences, unknown ones included, pass and are listed in the report. Pick it for internal services where strong copyleft is the only real risk and an allowlist would block too much.' },
        { value: 'none', label: 'no licence check, for an element that is never distributed', description: 'No licence check; the element is never distributed, published or offered to anyone outside the organisation, which is what makes most licence terms moot, and a check keeps it that way. Pick it only for internal tools, and revisit the moment the element leaves the building.' },
      ],
    },
    {
      key: 'AGE', title: 'Freshness', label: 'How far behind upstream may the element fall?',
      hint: 'libyear counts, for each dependency, the time between the version used and the latest release; the total shows the upgrade debt in one number.',
      default: 'max-age',
      options: [
        { value: 'max-age', label: 'a libyear budget, in total and per dependency', description: 'A job measures libyear on every pull request and fails when the total exceeds the budget (1 libyear by default) or one dependency is further behind its latest release than allowed (6 months by default). Pick it whenever the element is in active development; it keeps the big-bang upgrade from ever being needed.' },
        { value: 'none', label: 'no freshness measure', description: 'Freshness is not measured; updates arrive as the update process delivers them, and nothing fails when the element falls behind. Pick it for a frozen codebase that is only patched, and say so in the decision.' },
      ],
    },
  ],
  details: [
    { key: 'MANUAL_CADENCE_DAYS', label: 'Every how many days are dependencies updated by hand (manual updates)?', default: '14', number: true },
    { key: 'UPDATE_DAY', label: 'On which weekday does the weekly update pull request land (lower case, as Dependabot writes it)?', default: 'monday' },
    { key: 'REVIEW_CADENCE_DAYS', label: 'Every how many days is the unused-dependency report reviewed?', default: '90', number: true },
    { key: 'REPLACE_DAYS', label: 'Within how many days must a deprecated or dormant dependency be replaced, forked or removed?', default: '90', number: true },
    { key: 'ALLOWED_LICENCES', label: 'Which licences are allowed (SPDX identifiers, comma-separated)?', default: 'MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC' },
    { key: 'DENIED_LICENCES', label: 'Which licences are forbidden (SPDX identifiers, comma-separated)?', default: 'GPL-2.0-only, GPL-3.0-only, AGPL-3.0-only, SSPL-1.0' },
    { key: 'INTERNAL_REGISTRY', label: 'Which host is the internal registry that artefacts may be published to (for an element never distributed)?', default: 'registry.internal.example.com' },
    { key: 'MAX_LIBYEARS', label: 'How many libyears may all direct dependencies add up to?', default: '1.0', number: true },
    { key: 'MAX_MONTHS_BEHIND', label: 'How many months may one dependency be behind its latest release?', default: '6', number: true },
  ],
  need: {
    label: 'Dependencies stay current, pinned, used and licensed',
    text: 'The element runs mostly on code we did not write, and that code keeps changing upstream. Updates must arrive in small steps that a build can prove safe, instead of one upgrade a year that breaks everything at once; every build must install the versions that were tested; what is installed must be what the code uses, with nothing abandoned or forgotten in it; and every package must carry a licence we may ship under. The security side of the same packages, known vulnerabilities, integrity and provenance, is decided by the Software supply chain concern.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-automerge', label: 'Safe updates merge on their own', when: { UPDATES: ['automerge-patch'] }, ears_type: 'event-driven',
      trigger: 'the update bot opens a patch or minor update of a package at version 1.0.0 or above and every required check passes',
      action: 'merge it without a person, after the release has been public for at least 3 days, and leave major updates and updates of 0.x packages for a person to review',
      rationale: 'Under semantic versioning a patch or minor release adds no breaking change, and 0.x versions promise nothing (semver.org 4, 6, 7); a short minimum release age lets a bad release be pulled before it is merged (Renovate docs, Automerge, minimumReleaseAge).',
      scenario: { label: 'Minor update merges itself', given: 'Renovate configured for the element and a dependency with a new minor release 3 days old and a new major release', when: 'the update pull requests are opened and their checks pass', then: 'the minor update is merged without a reviewer and the major one waits with the major-update label' },
    },
    {
      id: 'req-weekly-batch', label: 'One update pull request a week', when: { UPDATES: ['weekly-batch'] }, ears_type: 'event-driven',
      trigger: 'the weekly update run starts on {{UPDATE_DAY}}',
      action: 'open at most one pull request with every pending patch and minor update and one per pending major update, and have a person merge or close each within 7 days',
      rationale: 'One grouped pull request a week is reviewed; thirty single ones are ignored (GitHub Docs, Dependabot grouped updates; Fowler, Continuous Integration: everyone commits to the mainline every day).',
      scenario: { label: 'Weekly batch merged in time', given: 'four pending minor updates and one pending major update', when: 'the run on {{UPDATE_DAY}} opens the pull requests and the daily age check runs a week later', then: 'one pull request carried the four minors and one the major, and none is still open after 7 days' },
    },
    {
      id: 'req-manual-cadence', label: 'Updates applied on a cadence', when: { UPDATES: ['manual'] }, ears_type: 'event-driven',
      trigger: '{{MANUAL_CADENCE_DAYS}} days have passed since the last dependency update',
      action: 'publish an outdated report listing every dependency behind its latest release with current, wanted and latest version, and apply or defer each line in one reviewed change before the next report',
      rationale: 'Without a bot, a fixed cadence and a report are what keep "later" from becoming "never" (Cox et al., Measuring Dependency Freshness: freshness decays unless updating is routine).',
      scenario: { label: 'Report leads to an update', given: 'the last dependency update is {{MANUAL_CADENCE_DAYS}} days old', when: 'the report job runs', then: 'an issue lists every outdated dependency, and the next run fails while that issue is still open' },
    },
    {
      id: 'req-same-checks', label: 'Updates pass the same checks', ears_type: 'ubiquitous',
      action: 'run every required check of an ordinary pull request on every dependency update, bot-made or by hand (labelled dependencies), and merge no update whose checks did not all succeed',
      rationale: 'An update is a code change made by someone else; only the full build proves it safe, and automerge is only as safe as that build (Fowler, Continuous Integration; Renovate docs, Automerge: only with good test coverage).',
      scenario: { label: 'Breaking update refused', given: 'the dependency update pull requests merged in the last 30 days', when: 'the weekly check reads their status checks', then: 'every one has every check concluded success or skipped; one merged with a failed or missing check fails the job' },
    },
    {
      id: 'req-lockfile-install', label: 'Builds install the lockfile', when: LOCKED, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the committed lockfile does not match the manifest, a manifest has no lockfile beside it, or a build would resolve a version other than the one in it',
      action: 'fail the build instead of updating the lockfile or installing something else',
      rationale: 'A lockfile only reproduces the tested tree if the build refuses to drift from it (npm Docs, npm ci: fails when package.json and package-lock.json disagree). The Software supply chain pack takes this as given for its hashes and registry proxy.',
      scenario: { label: 'Drifted lockfile fails', given: 'a manifest changed without regenerating the lockfile', when: 'CI installs dependencies', then: 'the install fails naming the package and the working tree is unchanged' },
    },
    {
      id: 'req-exact-versions', label: 'No ranges in the manifest', when: { PINNING: ['exact'] }, ears_type: 'ubiquitous',
      action: 'declare every dependency in the manifest with one exact version (workspace and alias protocols resolving to one version included), 0 caret, tilde, wildcard, comparison or hyphen ranges and 0 dist-tags, so that every version change is a visible line in a reviewed diff',
      rationale: 'With exact versions a change in what is installed is always a change in the manifest; a range lets the lockfile move without a line in the file people read (semver.org; npm Docs, save-exact).',
      scenario: { label: 'Range refused', given: 'a pull request that adds a dependency as ^2.1.0', when: 'the manifest test runs', then: 'it fails naming the dependency, and passes once the version is 2.1.0' },
    },
    {
      id: 'req-floating-range', label: 'Declared ranges are tested at both ends', when: { PINNING: ['floating'] }, ears_type: 'ubiquitous',
      action: 'commit no lockfile, declare for every dependency the lowest version the code works with as the range\'s lower bound, and test on every pull request against both the lowest and the highest resolution of the declared ranges',
      rationale: 'A library imposes its ranges on every consumer; a lower bound nobody tested is a promise nobody kept (semver.org 8, 9; Cox et al., Measuring Dependency Freshness).',
      scenario: { label: 'Lower bound tested', given: 'a library declaring a dependency as >=1.4', when: 'the pull-request build runs', then: 'one job installs 1.4 exactly and one the latest in range, both run the tests, and no lockfile is in the repository' },
    },
    {
      id: 'req-unused-fails', label: 'Unused dependencies fail the build', when: { UNUSED: ['forbidden'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request leaves a declared dependency nobody imports, an import of a package nobody declared, or a dev dependency used in production code',
      action: 'fail its required check naming the package',
      rationale: 'Every installed package is attack surface, patch work and licence to carry; an undeclared import works only until a transitive dependency drops it (Knip documentation: unused and unlisted dependencies; OWASP Top 10 A06:2021).',
      scenario: { label: 'Orphan dependency refused', given: 'a pull request that removes the last import of a package but not its manifest entry', when: 'its checks run', then: 'the dependency check fails naming the package' },
    },
    {
      id: 'req-unused-review', label: 'Unused dependencies reviewed', when: { UNUSED: ['reviewed'] }, ears_type: 'event-driven',
      trigger: '{{REVIEW_CADENCE_DAYS}} days have passed since the last unused-dependency review',
      action: 'publish the unused-dependency report as an issue and remove or record a reason for every entry before the next report, so that 0 entries appear in two consecutive reports without a reason in dependency-exceptions.json',
      rationale: 'A report nobody acts on is noise; the rule that nothing appears twice unexplained keeps the backlog from growing (Knip documentation; Fowler, Continuous Integration).',
      scenario: { label: 'Entry does not come back', given: 'a report naming an unused package', when: 'the next report is published {{REVIEW_CADENCE_DAYS}} days later', then: 'the package is gone from the manifest or dependency-exceptions.json carries its reason; otherwise the job fails naming it' },
    },
    {
      id: 'req-abandoned', label: 'Abandoned dependencies replaced', ears_type: 'state-driven',
      precondition: 'a direct dependency is marked deprecated on its registry, or its latest version was released more than 24 months ago',
      action: 'fail the daily check naming it until it is replaced, forked or removed within {{REPLACE_DAYS}} days, or listed with an issue in dependency-exceptions.json',
      rationale: 'A package nobody maintains gets no fix when the next vulnerability or runtime version arrives; finding out then is too late (OpenSSF Scorecard, Maintained check; Cox et al., Measuring Dependency Freshness).',
      scenario: { label: 'Deprecated package tracked', given: 'a direct dependency whose maintainer marks it deprecated', when: 'the daily check runs', then: 'it fails naming the package, and within {{REPLACE_DAYS}} days the package is no longer a dependency or dependency-exceptions.json names it with its issue' },
    },
    {
      id: 'req-licence-allowlist', label: 'Only allowed licences', when: { LICENCES: ['allowlist'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a production dependency, transitive ones included, carries a licence that is not one of {{ALLOWED_LICENCES}}, or no recognisable licence at all',
      action: 'fail the build naming the package and its licence, unless an exception for that package and version is recorded in dependency-exceptions.json',
      rationale: 'An allowlist of SPDX identifiers is a decision made once, instead of a lawyer\'s question at every release; an unknown licence is the riskiest of all (SPDX License List; OSI approved licences).',
      scenario: { label: 'Copyleft dependency refused', given: 'a pull request adding a transitive dependency licensed GPL-3.0-only', when: 'the licence check runs', then: 'the build fails naming the package and the licence' },
    },
    {
      id: 'req-licence-denylist', label: 'Forbidden licences refused', when: { LICENCES: ['denylist'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a production dependency, transitive ones included, carries one of {{DENIED_LICENCES}}',
      action: 'fail the build naming the package and its licence, and list every other licence found in the build report',
      rationale: 'Strong copyleft is the licence family that changes the terms of what links to it; a denylist stops it at the door without blocking the long tail of permissive licences (SPDX License List; OSI).',
      scenario: { label: 'Forbidden licence refused', given: 'a pull request adding a dependency licensed AGPL-3.0-only', when: 'the licence check runs', then: 'the build fails naming the package and the licence, and the report lists the licences of the rest' },
    },
    {
      id: 'req-internal-only', label: 'Never distributed', when: { LICENCES: ['none'] }, ears_type: 'ubiquitous',
      action: 'publish no package, image or binary of the element anywhere but {{INTERNAL_REGISTRY}}: the manifest is private, and every publish or push command in the pipelines names that host',
      rationale: 'Not checking licences is safe only while nothing is distributed; a check over the publish targets is what turns the first external release into the licence question instead of a surprise (SPDX License List; OSI).',
      scenario: { label: 'No external artefact', given: 'the element\'s pipelines and manifest', when: 'the publish-target check runs', then: 'package.json is private and every publish or push command targets {{INTERNAL_REGISTRY}}; a push to another host fails the check' },
    },
    {
      id: 'req-freshness', label: 'Freshness bounded', when: { AGE: ['max-age'] }, ears_type: 'ubiquitous',
      action: 'keep the direct dependencies at most {{MAX_LIBYEARS}} libyears behind their latest releases in total, and no single one more than {{MAX_MONTHS_BEHIND}} months behind, measured on every pull request',
      rationale: 'libyear turns upgrade debt into one number that can be bounded; systems with a low libyear count are upgraded in small steps instead of rewritten (Cox et al., Measuring Dependency Freshness; libyear.com).',
      scenario: { label: 'Stale dependency fails', given: 'a dependency pinned to a version released {{MAX_MONTHS_BEHIND}} months and one week before its latest', when: 'the libyear check runs', then: 'it fails naming the dependency and its drift, and passes once the dependency is updated' },
    },
  ],
  adrs: [
    {
      id: 'adr-automerge', label: 'Renovate merges patch and minor updates on its own', when: { UPDATES: ['automerge-patch'] },
      decision: 'Renovate (the Mend-hosted GitHub app, or the self-hosted runner) opens one pull request per dependency update from renovate.json in the repository, labelled dependencies. Patch and minor updates of packages at 1.0.0 or above merge automatically once the required checks pass and the release has been public for 3 days (minimumReleaseAge); major updates and updates of 0.x packages get a label and wait for a reviewer. Lockfile maintenance runs weekly. Pinning: {{PINNING}}. Unused dependencies: {{UNUSED}}. Licences: {{LICENCES}}. Freshness: {{AGE}}. Deprecated or dormant dependencies (no release for 24 months) are replaced, forked or removed within {{REPLACE_DAYS}} days. Renovate over Dependabot here because Dependabot cannot merge on its own (its cooldown covers the release age, not the merge).',
      consequences: '• Most updates land the day after release, in steps small enough that a failing one is easy to read.\n• The build is the only reviewer of a minor update: it has to be one the team would release on (Test strategy concern), or automerge is a way to ship breakage unattended.\n• A package that breaks semantic versioning in a minor release can still get through; the minimum release age and the tests are the defence, and such a package gets a packageRule that turns automerge off.\n• Renovate needs the app installed and permission to merge; the dependency dashboard issue is where paused and rate-limited updates show up.',
      alternatives: '1. One weekly grouped pull request a person merges: more control, more drift, one more chore a week.\n2. Dependabot with automerge through a GitHub Actions workflow: works, with the cooldown as the release age, but the merge logic lives in a workflow of our own.\n3. Manual updates from an outdated report: fine for a frozen codebase, a year of drift for a living one.',
    },
    {
      id: 'adr-weekly-batch', label: 'One grouped update pull request a week', when: { UPDATES: ['weekly-batch'] },
      decision: 'An update bot opens one pull request every {{UPDATE_DAY}} with all pending patch and minor updates grouped, and a separate one per major update, labelled dependencies: Dependabot version updates with groups in .github/dependabot.yml on GitHub, or Renovate with a single groupName and a weekly schedule elsewhere. A person reviews the batch, reads the changelogs of anything that touches the public behaviour, and merges or closes it within 7 days; nothing merges without the required checks, and a daily job fails on an update pull request older than 7 days. Pinning: {{PINNING}}. Unused dependencies: {{UNUSED}}. Licences: {{LICENCES}}. Freshness: {{AGE}}. Deprecated or dormant dependencies (no release for 24 months) are replaced, forked or removed within {{REPLACE_DAYS}} days.',
      consequences: '• A week of drift at most, and the team sees what changed.\n• One batch is bisected by hand when it breaks: with many updates in it, finding the culprit takes a while, which is why majors stay separate.\n• The batch needs an owner each week or it goes stale and the next one conflicts with it.\n• Dependabot groups cannot merge on their own; moving to automerge later means moving to Renovate or adding a workflow.',
      alternatives: '1. Automerge of patch and minor updates with Renovate: less drift and no weekly chore, but the tests must be trusted.\n2. One pull request per update, unmerged: dozens of open pull requests that nobody reads.\n3. Manual updates from an outdated report: the same drift with more work.',
    },
    {
      id: 'adr-manual', label: 'Dependencies updated by hand on a cadence', when: { UPDATES: ['manual'] },
      decision: 'No bot opens pull requests. A scheduled job runs every {{MANUAL_CADENCE_DAYS}} days, produces the outdated report (npm outdated --json; pip list --outdated --format=json; go list -m -u all; mvn versions:display-dependency-updates; dotnet list package --outdated) and opens an issue with it labelled dependencies; a person updates or explicitly defers every line in one reviewed change, labelled dependencies, before the next report, and the job fails if the previous report\'s issue is still open. Pinning: {{PINNING}}. Unused dependencies: {{UNUSED}}. Licences: {{LICENCES}}. Freshness: {{AGE}}. Deprecated or dormant dependencies (no release for 24 months) are replaced, forked or removed within {{REPLACE_DAYS}} days. This decision fits a small or frozen codebase; when the element returns to active development it is superseded by a bot.',
      consequences: '• No bot, no app permissions, no stream of pull requests.\n• Up to {{MANUAL_CADENCE_DAYS}} days of drift, and the update is one larger change rather than many small ones.\n• Depends on a person doing the chore; the failing report job is the only thing that notices when they do not.\n• Security fixes in dependencies wait for the cadence unless the Software supply chain concern\'s deadlines pull them forward.',
      alternatives: '1. Renovate with automerge of patch and minor updates: continuous, needs trusted tests.\n2. A weekly grouped bot pull request: the same cadence with the diff prepared for you; preferable wherever a bot may run.',
    },
  ],
  fitness: [
    {
      id: 'ff-renovate-rules', label: 'Renovate automerges only safe updates', when: { UPDATES: ['automerge-patch'] }, category: 'process', implements: ['adr-automerge'],
      checks: ['req-automerge'],
      threshold: 'renovate.json validates; its rules automerge patch and minor updates of packages at 1.0.0 or above after a 3-day minimum release age and label major and 0.x updates for a person; 0 other automerge rules',
      description: 'The repository\'s renovate.json is validated in CI with renovate-config-validator, and its package rules are what decide the gate: automerge for patch and minor updates of stable packages, a minimum release age of 3 days, majors and 0.x packages labelled for a person. A test over the file (jq in the same step) fails on an automerge rule outside those. The file is renovate.json; CI runs `npx --package renovate renovate-config-validator renovate.json` and then `jq -e \'[.packageRules[] | select(.automerge == true)] | all(.matchUpdateTypes == ["patch", "minor"] and .matchCurrentVersion == "!/^0/")\' renovate.json`, which fails when any automerge rule reaches past patch and minor updates of stable packages.',
      tool: 'Renovate (renovate-config-validator and jq in CI)',
      language: 'json',
      snippet: `{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "labels": ["dependencies"],
  "minimumReleaseAge": "3 days",
  "lockFileMaintenance": { "enabled": true, "schedule": ["before 6am on monday"] },
  "packageRules": [
    { "matchUpdateTypes": ["patch", "minor"], "matchCurrentVersion": "!/^0/",
      "automerge": true, "automergeType": "pr", "platformAutomerge": true },
    { "matchUpdateTypes": ["major"], "automerge": false, "labels": ["dependencies", "major-update"] },
    { "matchCurrentVersion": "/^0/", "automerge": false, "labels": ["dependencies", "pre-1.0"] }
  ]
}`,
    },
    {
      id: 'ff-weekly-groups', label: 'Updates grouped weekly', when: { UPDATES: ['weekly-batch'] }, category: 'process', implements: ['adr-weekly-batch'],
      checks: ['req-weekly-batch'],
      threshold: 'dependabot.yml groups patch and minor updates into one weekly pull request on {{UPDATE_DAY}}; 0 update pull requests open longer than 7 days',
      description: 'Dependabot groups every patch and minor update into one weekly pull request and keeps majors separate; a daily job lists the open pull requests labelled dependencies and fails when one is older than 7 days. With Renovate, the same is one packageRule with groupName "weekly updates" and schedule ["before 6am on {{UPDATE_DAY}}"].',
      tool: 'Dependabot version updates (grouped) with the GitHub CLI',
      language: 'yaml',
      snippet: `# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly, day: {{UPDATE_DAY}}, time: "06:00" }
    open-pull-requests-limit: 5
    groups:
      weekly-updates:
        patterns: ["*"]
        update-types: ["minor", "patch"]
# daily job: no update pull request older than 7 days
# gh pr list --label dependencies --state open --json createdAt \\
#   | jq -e '[.[] | select((now - (.createdAt | fromdateiso8601)) > 7 * 86400)] | length == 0'`,
    },
    {
      id: 'ff-outdated-report', label: 'Outdated report on schedule', when: { UPDATES: ['manual'] }, category: 'process', implements: ['adr-manual'],
      checks: ['req-manual-cadence'],
      threshold: 'A report issue labelled dependencies is opened every {{MANUAL_CADENCE_DAYS}} days; 0 report issues still open when the next one is due',
      description: 'A scheduled workflow runs npm outdated --json, turns it into a table and opens an issue labelled dependencies; before opening it fails when the previous report is still open, which is the signal that the update did not happen. Python: pip list --outdated --format=json; Go: go list -m -u -json all; JVM: mvn versions:display-dependency-updates; .NET: dotnet list package --outdated.',
      tool: 'npm outdated with the GitHub CLI (GitHub Actions schedule)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# runs on a schedule every {{MANUAL_CADENCE_DAYS}} days (for 14: cron '0 6 1,15 * *')
set -euo pipefail
open=$(gh issue list --label dependencies --state open --json number --jq 'length')
[ "$open" -eq 0 ] || { echo "the previous dependency report is still open"; exit 1; }
npm outdated --json > outdated.json || true           # exits 1 when something is outdated
{
  echo "| package | current | wanted | latest |"; echo "|---|---|---|---|"
  jq -r 'to_entries[] | "| \\(.key) | \\(.value.current) | \\(.value.wanted) | \\(.value.latest) |"' outdated.json
} > report.md
gh issue create --title "Dependency update $(date +%F)" --label dependencies --body-file report.md`,
    },
    {
      id: 'ff-updates-checked', label: 'Updates merged only with green checks', category: 'process', implements: UPDATES,
      checks: ['req-same-checks'],
      threshold: '0 pull requests labelled dependencies merged in the last 30 days with a status check that did not conclude success or skipped',
      description: 'A weekly job lists the pull requests labelled dependencies merged in the last 30 days (Renovate and Dependabot label theirs; a manual update is labelled by its author) and reads each one\'s status checks; a merged update with a failed, cancelled or missing check fails the job, which means a bypass or a check that is not required and belongs in the branch rules.',
      tool: 'GitHub CLI (gh pr list with statusCheckRollup) in a scheduled job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# weekly: every merged dependency update had every check green
set -euo pipefail
since=$(date -u -d '30 days ago' +%F 2>/dev/null || date -u -v-30d +%F)
bad=$(gh pr list --state merged --label dependencies --search "merged:>=$since" --limit 200 --json number,statusCheckRollup \\
  --jq '.[] | select((.statusCheckRollup | length) == 0 or any(.statusCheckRollup[]; (.conclusion // .state) as $c | $c != "SUCCESS" and $c != "SKIPPED" and $c != "NEUTRAL")) | "#\\(.number)"')
[ -z "$bad" ] || { echo "dependency updates merged without green checks:"; echo "$bad"; exit 1; }`,
    },
    {
      id: 'ff-lockfile-frozen', label: 'Install refuses lockfile drift', when: LOCKED, category: 'structural', implements: UPDATES,
      checks: ['req-lockfile-install'],
      threshold: '0 builds in which the install changes the lockfile or a manifest has no lockfile beside it',
      description: 'CI installs with the frozen-lockfile command of each package manager and fails when the lockfile would change or is missing. Elsewhere: pnpm install --frozen-lockfile, uv sync --locked, poetry check --lock, go mod tidy -diff, mvn with the dependency lock plugin\'s check, dotnet restore --locked-mode. The lockfile\'s integrity hashes and where packages come from are the Software supply chain concern.',
      tool: 'npm ci with git diff (GitHub Actions); the frozen-lockfile install of each other package manager',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
for manifest in $(git ls-files '*package.json' | grep -v node_modules); do
  dir=$(dirname "$manifest")
  [ -f "$dir/package-lock.json" ] || { echo "$dir has no lockfile"; exit 1; }
done
npm ci --ignore-scripts                     # fails when package.json and the lockfile disagree
git diff --exit-code -- '*package-lock.json' # and nothing may have rewritten it`,
    },
    {
      id: 'ff-exact-versions', label: 'Manifest holds exact versions', when: { PINNING: ['exact'] }, category: 'structural', implements: UPDATES,
      checks: ['req-exact-versions'],
      threshold: '0 dependencies declared with anything but one exact version (a workspace: or npm: alias resolving to one version counts as exact); save-exact is set so new installs stay exact',
      description: 'A unit test reads the manifest and fails on any dependency whose version is not exactly one semver version: caret, tilde, wildcard, comparison and hyphen ranges, dist-tags such as next, and aliases without a version all fail; workspace:* and npm:pkg@1.2.3 pass, as a monorepo needs. .npmrc sets save-exact so that npm install writes exact versions. Python: pin with == in pyproject; Go modules are exact by construction.',
      tool: 'Vitest (a test over package.json) and .npmrc save-exact',
      language: 'ts',
      snippet: `import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const SEMVER = /^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.-]+)?(\\+[0-9A-Za-z.-]+)?$/
const exact = (v: string): boolean => SEMVER.test(v) || /^workspace:/.test(v) || /^npm:.+@\\d+\\.\\d+\\.\\d+$/.test(v)
const ranged = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).filter(([, version]) => !exact(String(version)))

it('every dependency is declared with one exact version', () => {
  expect(ranged).toEqual([])
})
// .npmrc: save-exact=true`,
    },
    {
      id: 'ff-range-matrix', label: 'Ranges tested at both ends', when: { PINNING: ['floating'] }, category: 'process', implements: UPDATES,
      checks: ['req-floating-range'],
      threshold: 'The tests pass with the lowest-direct and with the highest resolution of the declared ranges; 0 lockfiles tracked in the repository',
      description: 'A pull-request job fails when a lockfile is tracked, then installs the library twice, once resolving every direct dependency to the lowest version its range allows and once to the highest, and runs the tests on each. For a JavaScript library the same is pnpm install --config.resolution-mode=lowest-direct against the default.',
      tool: 'uv (resolution lowest-direct and highest) in GitHub Actions; pnpm resolution-mode for JavaScript',
      language: 'yaml',
      snippet: `# .github/workflows/range.yml
jobs:
  range:
    runs-on: ubuntu-latest
    strategy: { matrix: { resolution: [lowest-direct, highest] } }
    steps:
      - uses: actions/checkout@v4.2.2      # pin by commit SHA in your repository
      - run: |
          tracked=$(git ls-files uv.lock poetry.lock package-lock.json pnpm-lock.yaml yarn.lock)
          [ -z "$tracked" ] || { echo "a library commits no lockfile: $tracked"; exit 1; }
      - uses: astral-sh/setup-uv@v5.1.0    # pin by commit SHA in your repository
      - run: uv pip install --system --resolution \${{ matrix.resolution }} -e '.[test]'
      - run: pytest`,
    },
    {
      id: 'ff-knip', label: 'Unused and unlisted dependencies fail', when: { UNUSED: ['forbidden'] }, category: 'structural', implements: UPDATES,
      checks: ['req-unused-fails'],
      threshold: '0 unused dependencies, 0 unlisted imports, 0 unresolved imports on every pull request',
      description: 'knip runs as a required check with dependency findings as errors; files and exports stay warnings until the backlog is clean. Python: deptry . with DEP001 to DEP004 in pyproject [tool.deptry]; Go: go mod tidy -diff fails when go.mod would change; JVM: the dependency:analyze goal of the Maven dependency plugin with failOnWarning. The file is knip.json; CI runs npx knip --reporter compact.',
      tool: 'knip; deptry for Python; go mod tidy -diff for Go; maven-dependency-plugin analyze for the JVM',
      language: 'json',
      snippet: `{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": ["src/index.ts", "src/cli.ts"],
  "project": ["src/**/*.ts"],
  "ignoreDependencies": [],
  "rules": {
    "dependencies": "error",
    "unlisted": "error",
    "unresolved": "error",
    "files": "warn",
    "exports": "warn"
  }
}`,
    },
    {
      id: 'ff-unused-review', label: 'Unused report is acted on', when: { UNUSED: ['reviewed'] }, category: 'process', implements: UPDATES,
      checks: ['req-unused-review'],
      threshold: 'A report issue every {{REVIEW_CADENCE_DAYS}} days; 0 packages named in two consecutive reports without a reason in dependency-exceptions.json',
      description: 'A scheduled workflow runs knip in report mode, opens the report as an issue, and fails when a package named in the previous report is named again without an entry in dependency-exceptions.json ([{ "package": "left-pad", "reason": "loaded by name in plugins/", "issue": 123 }]).',
      tool: 'knip (JSON reporter) with jq and the GitHub CLI',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scheduled every {{REVIEW_CADENCE_DAYS}} days (for 90: cron '0 6 1 */3 *')
set -euo pipefail
npx knip --reporter json --include dependencies,unlisted > unused.json || true
jq -r '.issues[] | .dependencies[]?.name, .devDependencies[]?.name' unused.json | sort -u > now.txt
gh issue list --label unused-dependencies --state all --limit 1 --json body --jq '.[0].body // ""' | grep -oE '^- \\S+' | cut -c3- | sort -u > before.txt
jq -r '.[].package' dependency-exceptions.json | sort -u > excused.txt
comm -12 now.txt before.txt | comm -23 - excused.txt > repeat.txt
{ echo "Unused dependencies as of $(date +%F):"; sed 's/^/- /' now.txt; } > report.md
gh issue create --title "Unused dependencies $(date +%F)" --label unused-dependencies --body-file report.md
test ! -s repeat.txt || { echo "named twice without a reason:"; cat repeat.txt; exit 1; }`,
    },
    {
      id: 'ff-licence-allowlist', label: 'Licences on the allowlist', when: { LICENCES: ['allowlist'] }, category: 'structural', implements: UPDATES,
      checks: ['req-licence-allowlist'],
      threshold: '100 % of production dependencies carry one of {{ALLOWED_LICENCES}} or are excused by package and version in dependency-exceptions.json; the build fails on the first that does not',
      description: 'The licence checker of each ecosystem runs on every pull request with the allowlist and exits non-zero on the first package outside it, unknown licences included; packages excused in dependency-exceptions.json (package and version, with a reason) are excluded by name and version. pip-licenses matches the classifier names packages declare, so its list is kept in those names next to the SPDX one.',
      tool: 'license-checker-rseidelsohn (npm); pip-licenses (Python); go-licenses (Go)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
ALLOWED="{{ALLOWED_LICENCES}}"        # SPDX identifiers
excused=$(jq -r '[.[] | select(.version) | "\\(.package)@\\(.version)"] | join(";")' dependency-exceptions.json)
# npm: production tree, first licence outside the list exits 1; excused packages left out by name@version
npx license-checker-rseidelsohn --production --excludePrivatePackages --onlyAllow "\${ALLOWED//, /;}" --excludePackages "$excused"
# Go (--ignore takes module path prefixes)
go-licenses check ./... --allowed_licenses="\${ALLOWED// /}"
# Python: classifier names as packages declare them (pip-licenses --from=classifier prints them)
pip-licenses --from=classifier --allow-only "MIT License;Apache Software License;BSD License;ISC License (ISCL)"`,
    },
    {
      id: 'ff-licence-denylist', label: 'Forbidden licences refused', when: { LICENCES: ['denylist'] }, category: 'structural', implements: UPDATES,
      checks: ['req-licence-denylist'],
      threshold: '0 production dependencies carrying one of {{DENIED_LICENCES}}; every other licence listed in the build report',
      description: 'The licence checker runs on every pull request with the denylist, fails on the first match and writes the full licence list as a build artefact for the record. go-licenses classifies GPL and LGPL as restricted and only AGPL and the like as forbidden, so both types are disallowed there.',
      tool: 'license-checker-rseidelsohn (npm); pip-licenses (Python); go-licenses (Go)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
DENIED="{{DENIED_LICENCES}}"          # SPDX identifiers
# npm: exits 1 on the first package with a forbidden licence; the report lists the rest
npx license-checker-rseidelsohn --production --csv --out reports/licences.csv --failOn "\${DENIED//, /;}"
# Go: GPL and LGPL are "restricted" in go-licenses' classification, AGPL and the like "forbidden"
go-licenses check ./... --disallowed_types=forbidden,restricted
# Python: classifier names (pip-licenses --from=classifier)
pip-licenses --from=classifier --fail-on "GNU General Public License v3 (GPLv3);GNU Affero General Public License v3"`,
    },
    {
      id: 'ff-no-external-publish', label: 'Nothing published outside the organisation', when: { LICENCES: ['none'] }, category: 'structural', implements: UPDATES,
      checks: ['req-internal-only'],
      threshold: 'package.json is private; 0 publish or push commands in the pipelines (npm publish, docker push, twine upload, gh release upload, dotnet nuget push) that do not name {{INTERNAL_REGISTRY}}',
      description: 'A CI step checks that the manifest is private and greps every workflow file for the commands that publish a package, image or binary; each found line must name the internal registry host, so the first line that would publish elsewhere fails the build and raises the licence question before the artefact leaves.',
      tool: 'git grep with jq in a CI step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI: the element is never distributed; every publish target is the internal registry
set -euo pipefail
REGISTRY='{{INTERNAL_REGISTRY}}'
jq -e '.private == true' package.json > /dev/null || { echo "package.json is not private"; exit 1; }
external=$(git grep -nE 'npm publish|docker push|twine upload|gh release upload|dotnet nuget push' -- '.github/workflows' '*.yml' '*.yaml' 'Makefile' | grep -vF "$REGISTRY" || true)
[ -z "$external" ] || { echo "publishes outside $REGISTRY (decide licences first):"; echo "$external"; exit 1; }`,
    },
    {
      id: 'ff-libyear', label: 'Freshness within bounds', when: { AGE: ['max-age'] }, category: 'operational', implements: UPDATES,
      checks: ['req-freshness'],
      threshold: 'Direct dependencies at most {{MAX_LIBYEARS}} libyears behind in total; no single one more than {{MAX_MONTHS_BEHIND}} months behind',
      description: 'libyear runs on every pull request and fails when the collective drift or any dependency\'s own drift crosses the bound (its limit flags), naming the dependencies behind. Python: the libyear package prints "Your system is N libyears behind" per requirements file; the job reads the number and compares the total (that tool has no per-dependency limit).',
      tool: 'libyear (npm); libyear (PyPI) for Python',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
# npm: fails above either bound and lists the dependencies behind (limits in libyears)
npx libyear \\
  --limit-drift-collective={{MAX_LIBYEARS}} \\
  --limit-drift-individual="$(awk 'BEGIN { print {{MAX_MONTHS_BEHIND}} / 12 }')"
# Python: "Your system is 4.95 libyears behind" -> the number is the third field from the end
total=$(libyear -r requirements.txt | awk '/libyears behind/ { print $(NF-2) }')
awk -v t="$total" 'BEGIN { exit (t > {{MAX_LIBYEARS}}) }' || { echo "$total libyears behind, limit {{MAX_LIBYEARS}}"; exit 1; }`,
    },
    {
      id: 'ff-abandoned', label: 'No deprecated or dormant dependency', category: 'operational', implements: UPDATES,
      checks: ['req-abandoned'],
      threshold: '0 direct dependencies marked deprecated on the registry or whose latest version was released more than 24 months ago, unless listed with an issue in dependency-exceptions.json',
      description: 'A daily job asks the registry about every direct dependency and fails on one that is deprecated or whose latest version (dist-tags.latest, not the metadata\'s modified date, which moves on any change) was released more than 24 months ago; each hit gets an issue and a deadline of {{REPLACE_DAYS}} days, recorded in dependency-exceptions.json while the replacement is under way. Python: the PyPI JSON API (releases and yanked flags); Go: go list -m -u -json for the latest version\'s time; .NET: dotnet list package --deprecated.',
      tool: 'npm view with jq (GitHub Actions schedule)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
jq -r '(.dependencies + .devDependencies) | keys[]' package.json | while read -r pkg; do
  npm view "$pkg" --json | jq -r --arg pkg "$pkg" '
    ((now - (.time[."dist-tags".latest] | sub("\\\\.[0-9]+Z$"; "Z") | fromdateiso8601)) / 86400 | floor) as $days   # npm writes milliseconds; jq reads none
    | if .deprecated then "\\($pkg): deprecated: \\(.deprecated)"
      elif $days > 730 then "\\($pkg): latest release \\($days) days ago"
      else empty end'
done | grep -v -F -f <(jq -r '.[].package' dependency-exceptions.json) | tee abandoned.txt
test ! -s abandoned.txt   # each line gets an issue with a {{REPLACE_DAYS}}-day deadline, listed in dependency-exceptions.json meanwhile`,
    },
  ],
}

export default pack
