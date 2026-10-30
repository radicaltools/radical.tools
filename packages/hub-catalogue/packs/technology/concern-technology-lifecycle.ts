import type { PackSpec } from '../../src/packSpec'

const MAIN = ['adr-board', 'adr-teams', 'adr-rfc']
const APPROVED = { BOARD: ['board', 'rfc'] }
const FORCES = 'The organisation builds on many technologies, and each was chosen in an ADR of one system or another; a tech radar puts them in rings (Adopt, Trial, Assess, Hold) so that the next team knows what is safe to pick, what is being tried, and what to stay away from. The forces: a radar kept by hand next to the ADRs says the same thing twice and drifts from them within months; a ring move decided by nobody in particular is not believed, and one decided by a committee that seldom meets is not waited for; Trial without an end becomes a second technology nobody chose; Hold without a check is a wish, because the next pull request adds the library again; and a migration off a technology on Hold competes with features for every sprint. The ADR statuses already say most of it: accepted is Adopt, proposed is Assess, deprecated is Hold, superseded is off the radar. Which version of a chosen runtime, framework or engine is still supported, and when it is upgraded, is decided in the Backend stack, Frontend stack, Data store and Infrastructure packs; dependency updates in the Dependency hygiene pack; known vulnerabilities and provenance in the Software supply chain pack.'

const DERIVED = 'The radar is drawn from the ADRs of the architecture model, not kept beside them: an ADR whose concern is a Tech Radar pack (Backend stack, Frontend stack, Data store, Infrastructure), or one that radar/overrides.json gives a technology name, is one entry. Its ring comes from its status (accepted: Adopt, proposed: Assess, deprecated: Hold; superseded: off the radar, its successor is on it), its quadrant from its pack (the two stacks: Languages & Frameworks; data store and infrastructure: Platforms; a tool named from another pack: Tools unless the overrides say otherwise), and its name from its label. Where two ADRs name one technology, the most recent decides. radar/overrides.json, a small file in the repository that names ADRs by label, holds what the statuses cannot say: Trial, a short technology name, the package names of a technology, its known uses once on Hold, the approvers and the date of the last review. scripts/radar.mjs writes radar/radar.json from both on every pull request, and nobody edits that file by hand; Studio\'s radar view will draw the same ADRs once it ships.'

const pack: PackSpec = {
  id: 'concern-technology-lifecycle',
  name: 'Technology lifecycle',
  group: 'technology',
  description: 'How the organisation\'s technologies move through the radar rings (Adopt, Trial, Assess, Hold), who decides, and what Hold means for the systems that still use a technology. The radar is computed from the ADRs of the architecture model; the snippets are Node scripts and GitHub Actions steps over that folder.',
  tags: ['technology', 'tech radar', 'technology lifecycle', 'governance', 'adr', 'deprecation'],
  concern: {
    id: 'technology-lifecycle',
    trigger: 'LIST NODES WHERE type = "system" AND external != true',
    why: 'these systems are built on technologies the organisation chooses, tries and retires, so how a technology moves between rings and what Hold means for them has to be decided.',
  },
  sources: [
    { title: 'Thoughtworks Technology Radar: FAQ (rings, quadrants, the Technology Advisory Board)', url: 'https://www.thoughtworks.com/radar/faq' },
    { title: 'Neal Ford: Build your own Technology Radar (Thoughtworks Insights)', url: 'https://www.thoughtworks.com/insights/blog/build-your-own-technology-radar' },
    { title: 'Thoughtworks: Build your own Radar', url: 'https://www.thoughtworks.com/radar/byor' },
    { title: 'thoughtworks/build-your-own-radar (source, CSV and JSON input format, Docker image)', url: 'https://github.com/thoughtworks/build-your-own-radar' },
    { title: 'Zalando Tech Radar (ring definitions and ring change proposals)', url: 'https://opensource.zalando.com/tech-radar/' },
    { title: 'Michael Nygard: Documenting Architecture Decisions', url: 'https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions' },
    { title: 'GitHub Docs: About code owners', url: 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners' },
  ],
  questions: [
    {
      key: 'BOARD', title: 'Ring moves', label: 'Who moves a technology between rings?',
      hint: 'A ring move changes what every team may pick next. This decides who weighs one team\'s choice against the others, and how fast a proposal is answered.',
      default: 'rfc',
      options: [
        { value: 'board', label: 'a technology board meeting on a cadence', description: 'A small standing group of senior technologists decides every ring move at a meeting held every few months (every six by default), as the Thoughtworks Technology Advisory Board does for its radar; proposals wait for the next meeting. Pick it when several teams share technologies and someone has to weigh one team\'s choice against the others.' },
        { value: 'teams', label: 'each team, for its own systems', description: 'Each team moves the technologies of the systems it owns by changing its own ADRs; the organisation\'s radar is only their union, published for everyone, with the most recent ADR deciding where two disagree. Pick it for a few autonomous teams with little shared platform, where a central approval would only slow them down.' },
        { value: 'rfc', label: 'a pull request to the radar, approved by named reviewers', description: 'Anyone proposes a ring move as a pull request with its reasons; named reviewers approve it (two approvals by default), and it is answered within two weeks by default, much as Zalando\'s principal engineers vote on ring change proposals. Pick it when teams should propose freely but a few senior people still decide, without waiting for a meeting.' },
      ],
    },
    {
      key: 'HOLD', title: 'Hold', label: 'What does Hold mean for the systems that still use a technology?',
      hint: 'Hold always means no new use. The question is whether the systems already on it must move off, and by when.',
      default: 'migrate',
      options: [
        { value: 'migrate', label: 'no new use, and existing use migrated by a deadline', description: 'Nothing new may use it, and every system that still does has an open migration issue and a deadline (twelve months by default) by which the use is gone. Pick it when the reason for Hold is a risk that grows the longer it stays: an abandoned project, an ended vendor or licence, a security record.' },
        { value: 'freeze', label: 'no new use, existing use kept', description: 'Nothing new may use it; the systems that use it now keep it until they are rewritten or retired, and are listed so the list can only shrink. Pick it when the technology still works and is supported, and a forced migration would cost more than it saves.' },
      ],
    },
    {
      key: 'TRIAL', title: 'Trial', label: 'How does a technology enter Trial?',
      hint: 'The ADR statuses cannot tell Trial from Assess, so Trial is set in the overrides file. Without an end, a trial becomes a second technology nobody chose.',
      default: 'timebox',
      options: [
        { value: 'timebox', label: 'a time-boxed trial in one system with written exit criteria', description: 'A technology enters Trial in one named system, in production, with an owner, written exit criteria and a time box (three months by default); by its end the ADR is accepted, deprecated or superseded. Pick it by default: the trial produces evidence and a decision.' },
        { value: 'open', label: 'any team\'s trial in its own systems', description: 'Any team may try a technology in any of its systems; the trial is recorded with its systems, owner and start date, and the radar review asks for a decision, with no time box. Pick it when teams are few and experienced and a time box would only be paperwork.' },
      ],
    },
    {
      key: 'PUBLISH', title: 'Publishing', label: 'Where do people read the radar?',
      hint: 'The radar is generated either way; this decides whether it is also shown as the familiar radar picture.',
      default: 'file',
      options: [
        { value: 'byor', label: 'a self-hosted Build Your Own Radar app', description: 'Each change on the main branch builds an image of Thoughtworks\' open-source Build Your Own Radar (AGPL-3.0, maintained) with the generated radar file inside, and people open the radar picture in the browser. Pick it when people outside the engineering teams read the radar, or it is shown at all-hands meetings and onboarding.' },
        { value: 'file', label: 'the generated file in the repository', description: 'The generated radar file is the radar: read in the repository and in the pull requests that change it, until Studio\'s radar view, which draws the same ADRs, arrives. Pick it when only engineers read the radar, or you would rather not run one more web app.' },
      ],
    },
  ],
  details: [
    { key: 'REVIEW_MONTHS', label: 'How often is the whole radar reviewed (months)?', default: '6', number: true },
    { key: 'BOARD_MEMBERS', label: 'Who sits on the technology board? (a technology board only)', default: 'the principal engineers and one tech lead per product area' },
    { key: 'RING_APPROVALS', label: 'How many approvals from the listed approvers does a ring move need? (a board or pull requests to the radar)', default: '2', number: true },
    { key: 'RFC_DAYS', label: 'Within how many days is a pull request to the radar answered? (pull requests to the radar only)', default: '14', number: true },
    { key: 'HOLD_MONTHS', label: 'Within how many months is every use of a technology on Hold migrated? (migration by a deadline only)', default: '12', number: true },
    { key: 'TRIAL_MONTHS', label: 'How long may a trial run (months)? (a time-boxed trial only)', default: '3', number: true },
  ],
  need: {
    label: 'Technologies move through the radar on purpose',
    text: 'Teams need to know which technologies to pick, which are being tried, and which to stay away from, and that answer has to come from the decisions the organisation has actually made, not from a slide that drifts from them. A technology should enter Trial with an owner and leave it with a decision, and Hold has to stop new use and say what happens to the old. The snippets assume the architecture model in architecture/ (ADRs as Markdown files with YAML front matter under architecture/nodes), radar/overrides.json beside it, the generated radar/radar.json, the scripts under scripts/, and GitHub with the gh CLI. A radar view in Studio, drawn from the same ADRs, is coming; until then the generated file is the radar.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-radar-from-adrs', label: 'Radar derived from the ADRs', ears_type: 'ubiquitous',
      action: 'derive every entry of the radar from an ADR of the architecture model: its ring from the ADR\'s status (accepted: Adopt, proposed: Assess, deprecated: Hold, superseded: off the radar) unless the overrides file sets Trial, its quadrant from the ADR\'s pack, its name from the ADR\'s label or the technology name in the overrides, and the most recent ADR deciding where two name the same technology',
      rationale: 'An ADR records a decision with its context and consequences when it is made (Nygard, Documenting Architecture Decisions); a radar drawn from those records cannot drift from them, while one kept by hand beside them says everything twice. The rings and quadrants are those of the Thoughtworks Technology Radar (FAQ).',
      scenario: { label: 'Rings follow the statuses', given: 'an accepted ADR of the Backend stack pack, a deprecated ADR of the Frontend stack pack and a superseded ADR of the Data store pack', when: 'scripts/radar.mjs runs', then: 'radar/radar.json holds the first in Adopt under Languages & Frameworks and the second in Hold, and does not hold the third' },
    },
    {
      id: 'req-overrides-valid', label: 'Overrides name real ADRs', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an entry of radar/overrides.json names an ADR label that no ADR of the model carries, or a ring or quadrant outside the radar\'s four',
      action: 'stop the radar\'s generation with an error naming the entry, and write no radar file',
      rationale: 'The overrides name ADRs by label; an ADR renamed or removed would otherwise leave its Trial or Hold record behind without anyone noticing. Build Your Own Radar draws only four rings and four quadrants (build-your-own-radar README).',
      scenario: { label: 'Stale override refused', given: 'radar/overrides.json with an entry for an ADR label the model no longer has', when: 'scripts/radar.mjs runs', then: 'it exits with an error naming the entry and radar/radar.json is not rewritten' },
    },
    {
      id: 'req-radar-current', label: 'Committed radar matches the model', ears_type: 'event-driven',
      trigger: 'a pull request is opened or updated',
      action: 'fail its checks unless the radar/radar.json it commits is exactly what scripts/radar.mjs generates from its architecture model and overrides',
      rationale: 'A ring move is then visible in the pull request that makes it, as a changed line of the radar file next to the changed ADR status, and the radar people read is never older than the model.',
      scenario: { label: 'Stale radar fails the check', given: 'a pull request that deprecates an ADR on the radar without regenerating radar/radar.json', when: 'the radar workflow runs', then: 'the check fails and names radar/radar.json' },
    },
    {
      id: 'req-review', label: 'Radar reviewed on a cadence', ears_type: 'ubiquitous',
      action: 'have the whole radar reviewed at least every {{REVIEW_MONTHS}} months, every entry kept, moved or removed, and the date of the review recorded as reviewed in radar/overrides.json',
      rationale: 'Technology changes fast enough that a radar should be refreshed at least once a year, and twice is better (Ford, Build your own Technology Radar); the Thoughtworks radar itself is published twice a year (FAQ).',
      scenario: { label: 'Overdue review fails', given: 'radar/overrides.json whose reviewed date is more than {{REVIEW_MONTHS}} months old', when: 'the weekly radar check runs', then: 'it fails, naming the date of the last review and the date the next was due' },
    },
    {
      id: 'req-ring-approval', label: 'Ring moves approved', when: APPROVED, ears_type: 'event-driven',
      trigger: 'a pull request moves a technology to another ring, onto the radar or off it',
      action: 'label it radar and merge it only with at least {{RING_APPROVALS}} approvals from the approvers listed in radar/overrides.json on the main branch',
      rationale: 'A ring move changes what every team may pick next, so it is decided by the people the organisation trusted with it: the Technology Advisory Board for the Thoughtworks radar (FAQ), the principal engineers voting on ring change proposals at Zalando (Zalando Tech Radar). Reading the approvers from the main branch keeps a pull request from approving itself.',
      scenario: { label: 'Unapproved move blocked', given: 'a pull request that changes an ADR from proposed to accepted', when: 'it has one approval from a listed approver and one from someone else', then: 'the approval check fails while fewer than {{RING_APPROVALS}} listed approvers have approved, and the pull request carries the label radar' },
    },
    {
      id: 'req-rfc-answered', label: 'Proposals answered in time', when: { BOARD: ['rfc'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request labelled radar stays open for more than {{RFC_DAYS}} days',
      action: 'fail the weekly radar check, naming the pull request, until it is merged or closed',
      rationale: 'Ring change proposals are discussed and voted on (Zalando Tech Radar); a proposal nobody answers teaches teams to stop proposing and pick on their own.',
      scenario: { label: 'Forgotten proposal flagged', given: 'a pull request labelled radar opened {{RFC_DAYS}} days and one hour ago', when: 'the weekly radar check runs', then: 'it fails and names the pull request' },
    },
    {
      id: 'req-team-owned', label: 'Each ADR has an owning team', when: { BOARD: ['teams'] }, ears_type: 'ubiquitous',
      action: 'give every ADR file of the model, in CODEOWNERS, to the team that owns the systems it constrains, and require that team\'s review for any change to it on the main branch',
      rationale: 'When each team moves the technologies of its own systems, the ownership has to be explicit, or anyone may move anyone\'s ring; code owners are requested for review automatically and can be required to approve (GitHub Docs, About code owners).',
      scenario: { label: 'Unowned ADR flagged', given: 'an ADR file under architecture/nodes that no CODEOWNERS pattern matches', when: 'the radar workflow runs', then: 'it fails and names the file' },
    },
    {
      id: 'req-hold-no-new-use', label: 'No new use of a technology on Hold', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a package manifest, lockfile or container image file of the repository uses a package of a technology on Hold and is not among that technology\'s known uses in radar/overrides.json',
      action: 'fail the pull request, naming the file, the package, the technology and what to use instead',
      rationale: 'Hold means "don\'t start anything new with this technology" (Ford, Build your own Technology Radar), "not recommended to be used for new projects" (Zalando Tech Radar); without a check the next pull request adds it again.',
      scenario: { label: 'New use refused', given: 'a technology on Hold whose known uses list one manifest', when: 'a pull request adds its package to another package.json', then: 'the check fails naming that package.json, the package and the technology to use instead' },
    },
    {
      id: 'req-hold-instead', label: 'Hold names its replacement', ears_type: 'ubiquitous',
      action: 'name, for every technology on Hold, what to use in its place and the package names under which it appears in manifests, lockfiles and container images, in its entry of radar/overrides.json',
      rationale: 'A Hold that says only no leaves every team to find its own way out; naming the successor, as a superseding ADR does (Nygard, Documenting Architecture Decisions), gives the migrations one direction, and the package names are what the no-new-use check looks for.',
      scenario: { label: 'Hold without a successor refused', given: 'an ADR deprecated today whose entry in radar/overrides.json names no packages or nothing to use instead', when: 'the radar workflow runs', then: 'it fails and names the technology' },
    },
    {
      id: 'req-hold-migrated', label: 'Uses of Hold migrated by the deadline', when: { HOLD: ['migrate'] }, ears_type: 'event-driven',
      trigger: 'a technology moves to Hold',
      action: 'record each of its known uses with an open migration issue, and remove every use within {{HOLD_MONTHS}} months of the date it moved to Hold',
      rationale: 'A technology put on Hold for a risk stays a risk in every system that still runs it; an issue per use puts the migration on a backlog, and the deadline keeps it from losing to features in every sprint.',
      scenario: { label: 'Migration past its deadline', given: 'a technology on Hold since more than {{HOLD_MONTHS}} months ago with one known use left', when: 'the weekly radar check runs', then: 'it fails, naming the file, the technology and the deadline that passed' },
    },
    {
      id: 'req-trial-recorded', label: 'Trials recorded', ears_type: 'ubiquitous',
      action: 'record every technology in Trial in radar/overrides.json with the systems trying it, an owner and the date the trial started, on an ADR whose status is still proposed',
      rationale: 'The ADR statuses cannot tell Trial from Assess, so Trial is recorded beside them; a technology moves into Trial only once it is used in production somewhere (Thoughtworks Technology Radar FAQ), so the record names where.',
      scenario: { label: 'Incomplete trial refused', given: 'an entry with "ring": "Trial" but no owner, and another on an ADR already accepted', when: 'the radar workflow runs', then: 'it fails and names both technologies' },
    },
    {
      id: 'req-trial-timebox', label: 'Trials end with a decision', when: { TRIAL: ['timebox'] }, ears_type: 'ubiquitous',
      action: 'hold every trial to one system, written exit criteria and {{TRIAL_MONTHS}} months, and decide it by then: its ADR accepted, deprecated or superseded, and the Trial ring removed from the overrides',
      rationale: 'Trial is for technologies ready for use but not yet proven (Thoughtworks Technology Radar FAQ); a time box and exit criteria written up front turn the trial into evidence for a decision instead of a second technology in production nobody chose.',
      scenario: { label: 'Overdue trial flagged', given: 'a trial that started {{TRIAL_MONTHS}} months and one day ago on an ADR still proposed', when: 'the weekly radar check runs', then: 'it fails, naming the technology and the day its time box ended' },
    },
    {
      id: 'req-published', label: 'Radar picture published', when: { PUBLISH: ['byor'] }, ears_type: 'event-driven',
      trigger: 'a change to the architecture model or to radar/overrides.json reaches the main branch',
      action: 'publish the regenerated radar as a new Build Your Own Radar image in the same pipeline run',
      rationale: 'A radar is read by people who never open the repository; Build Your Own Radar draws one from a CSV or JSON file it serves itself (build-your-own-radar README; Thoughtworks, Build your own Radar).',
      scenario: { label: 'Merge publishes the radar', given: 'a pull request that accepts an ADR on the radar', when: 'it is merged', then: 'the publish job pushes an image tagged with the merge commit whose files/radar.json shows the technology in Adopt' },
    },
  ],
  adrs: [
    {
      id: 'adr-board', label: 'A technology board moves technologies between rings', when: { BOARD: ['board'] },
      decision: `${DERIVED} A technology board of {{BOARD_MEMBERS}} decides every ring move. It meets at least every {{REVIEW_MONTHS}} months and walks through the whole radar, recording the date of the meeting as reviewed. Between meetings a ring move (the ADR's status changed, or its entry in the overrides) is a pull request, labelled radar by the check that sees it, which waits for the next meeting and is merged with at least {{RING_APPROVALS}} approvals from the board members listed as approvers in radar/overrides.json. Hold: {{HOLD}}. Trial: {{TRIAL}}. Where it is read: {{PUBLISH}}.`,
      consequences: '• Ring moves are weighed across teams by people who see the whole estate, as the Thoughtworks Technology Advisory Board does.\n• A proposal can wait up to {{REVIEW_MONTHS}} months for a meeting; urgent Holds (a security record, an abandoned project) need the board to approve between meetings.\n• The board is a handful of people\'s time, twice a year at the least; its decisions are only as good as the proposals teams bring.\n• Every move is still a pull request, so the radar\'s history is the repository\'s.',
      alternatives: '1. Each team for its own systems: fast, but nobody weighs one team\'s choice against the others.\n2. Pull requests approved by named reviewers without meetings: quicker answers, but no moment where the whole radar is looked at together.\n3. A radar kept on slides by the board: familiar, and out of step with the ADRs within months.',
    },
    {
      id: 'adr-teams', label: 'Each team moves the technologies of its own systems', when: { BOARD: ['teams'] },
      decision: `${DERIVED} Each team moves the technologies of the systems it owns by changing the status of the ADRs that constrain them; CODEOWNERS gives every ADR file under architecture/nodes to the owning team, and the main branch requires a code owner's review. The organisation's radar is the union, published as it comes out: where two teams' ADRs put one technology in different rings, the most recent ADR sets its ring. At least every {{REVIEW_MONTHS}} months the teams' tech leads walk through the radar together, settle conflicts and record the date as reviewed. Hold: {{HOLD}}. Trial: {{TRIAL}}. Where it is read: {{PUBLISH}}.`,
      consequences: '• No approval outside the team: a ring move is as fast as a pull request.\n• The radar shows what teams decided, not what the organisation recommends; two teams can pull in opposite directions until the review settles it.\n• A technology one team puts on Hold stays open to another; Hold is binding only within the systems of the team that set it.\n• Every ADR needs an owning team in CODEOWNERS, kept current as teams change.',
      alternatives: '1. A technology board: decisions weighed across teams, at the price of waiting for meetings.\n2. Pull requests approved by named reviewers: a light central check without meetings.',
    },
    {
      id: 'adr-rfc', label: 'Ring moves are pull requests approved by named reviewers', when: { BOARD: ['rfc'] },
      decision: `${DERIVED} Anyone may propose a ring move as a pull request: the ADR's status changed, or its entry in the overrides, with the reasons in the ADR's context and alternatives. The check that sees a move labels the pull request radar; it is merged with at least {{RING_APPROVALS}} approvals from the reviewers listed as approvers in radar/overrides.json (as the main branch has them), and it is answered, merged or closed, within {{RFC_DAYS}} days. At least every {{REVIEW_MONTHS}} months the approvers walk through the whole radar and record the date as reviewed. Hold: {{HOLD}}. Trial: {{TRIAL}}. Where it is read: {{PUBLISH}}.`,
      consequences: '• Teams propose without waiting for a meeting, and every proposal has a written reason and an answer within {{RFC_DAYS}} days.\n• The approvers carry a steady trickle of reviews instead of two long meetings; the list in the overrides must name people who actually answer.\n• Proposals are judged one at a time; the periodic walk through the whole radar is what catches two moves that pull against each other.\n• A pull request cannot add its own approver: the list is read from the main branch.',
      alternatives: '1. A technology board meeting on a cadence: the whole radar weighed at once, but proposals wait for the meeting.\n2. Each team for its own systems: no approval at all, and no common recommendation.',
    },
    {
      id: 'adr-hold-migrate', label: 'Hold means migrating off by a deadline', when: { HOLD: ['migrate'] },
      decision: 'A technology on Hold (its ADR deprecated) may not be used anywhere new, and every existing use is gone within {{HOLD_MONTHS}} months. When its ADR is deprecated, its entry in radar/overrides.json gets holdSince (the date), instead (the technology to use in its place), packages (the names under which it appears in package manifests, lockfiles and container images) and uses: one line per manifest that still uses it, with the URL of an open migration issue. The pull request that removes a use closes its issue and removes its line. A deadline that cannot be met is moved only by a ring move like any other, with a new holdSince in a reviewed pull request. Which versions of a runtime, framework or engine are still supported is not a Hold: the version policies of the Backend stack, Frontend stack, Data store and Infrastructure packs decide that.',
      consequences: '• Hold has an end: the technology leaves the estate, with its skills, patching and base images.\n• Each use is a piece of work on some team\'s backlog, with a date; teams will ask for exceptions, and each one is a visible pull request.\n• The package names in the overrides have to be complete, or a use slips past the check.\n• The weekly check fails the radar workflow, not a product build, when a deadline passes: someone has to own the red.',
      alternatives: '1. No new use only: no forced migrations, and the technology stays in the estate for years.\n2. Removal in the next release: unrealistic for anything used widely, so it would be ignored.',
    },
    {
      id: 'adr-hold-freeze', label: 'Hold means no new use', when: { HOLD: ['freeze'] },
      decision: 'A technology on Hold (its ADR deprecated) may not be used anywhere new; the systems that use it when it moves to Hold may keep it until they are rewritten or retired. When its ADR is deprecated, its entry in radar/overrides.json gets holdSince (the date), instead (the technology to use in its place), packages (the names under which it appears in package manifests, lockfiles and container images) and uses: one line per manifest that uses it at that moment, with the reason it stays. Any other use fails the build, so the list can only shrink. Which versions of a runtime, framework or engine are still supported is not a Hold: the version policies of the Backend stack, Frontend stack, Data store and Infrastructure packs decide that, for the uses that stay too.',
      consequences: '• No forced migrations: Hold costs nothing until a system is rewritten.\n• The technology stays in the estate for years, with its skills, patching and base images; its version policy still applies to every use that stays.\n• The list of uses shows the remaining exposure at a glance, and a new use is a visible exception.',
      alternatives: '1. Migration by a deadline: the technology leaves the estate, at the price of work nobody planned.\n2. Hold as advice only: no check, and the next pull request adds it again.',
    },
    {
      id: 'adr-trial-timebox', label: 'Trials are time-boxed in one system', when: { TRIAL: ['timebox'] },
      decision: 'A technology enters Trial in one named system, in production, for at most {{TRIAL_MONTHS}} months: its ADR is proposed, and its entry in radar/overrides.json has "ring": "Trial" and a trial record with the system, an owner, the start date and exit criteria written before it starts (measurable, such as "p99 publish latency under 20 ms at 2,000 messages per second in production for four weeks"). By the end of the time box the owner proposes the decision as a ring move: the ADR accepted (Adopt), or deprecated or superseded, and the Trial ring removed from the overrides in the same pull request.',
      consequences: '• Every trial ends in a decision with evidence behind it.\n• A second system wanting the technology waits for the decision, or the trial is moved to it.\n• A time box too short for the technology\'s real test (a full peak season, a data migration) forces a decision on thin evidence; the time box is a detail, set per organisation.',
      alternatives: '1. Any team\'s trial in its own systems: fewer rules, and trials that never end.\n2. Trials only in a sandbox, never in production: no production risk, and no evidence that counts (Thoughtworks moves a blip into Trial only after production use).',
    },
    {
      id: 'adr-trial-open', label: 'Any team may trial a technology', when: { TRIAL: ['open'] },
      decision: 'Any team may try a technology in any of its systems: its ADR is proposed, and its entry in radar/overrides.json has "ring": "Trial" and a trial record with the systems trying it, an owner and the start date. There is no time box; the radar review at least every {{REVIEW_MONTHS}} months asks each trial for a decision: its ADR accepted, deprecated or superseded, or the trial kept with a reason.',
      consequences: '• Teams try what they need without paperwork beyond one entry.\n• Trials can last for years; the review is the only thing that asks for a decision.\n• Several systems may be on a technology before anyone decides on it, which makes a later Hold more expensive.',
      alternatives: '1. A time-boxed trial in one system with exit criteria: a decision guaranteed, at the cost of a little process.\n2. No Trial ring: a technology goes from Assess straight to Adopt, without evidence from production.',
    },
  ],
  fitness: [
    {
      id: 'ff-radar-generate', label: 'Radar generated from the ADRs', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MAIN, checks: ['req-radar-from-adrs', 'req-overrides-valid'],
      threshold: 'radar/radar.json holds one entry per technology named by an ADR that is not superseded, its ring and quadrant derived as decided; 0 overrides naming a missing ADR or a ring or quadrant outside the four',
      description: 'A Node script reads the front matter of every Markdown file under architecture/nodes (type, label, status, date and concern, the keys the model\'s ADRs carry) and radar/overrides.json, and writes radar/radar.json: name, ring, quadrant, isNew and description as Build Your Own Radar reads them from JSON, plus adr and adrStatus (the ADR\'s label and status; not status, which Build Your Own Radar reads as the movement of a blip), all as strings. It exits with an error, writing nothing, when an override names no ADR or a ring or quadrant outside the four. Other packs that choose a named tool (a broker, a linter) come onto the radar by giving their ADR a technology name in the overrides.',
      tool: 'Node.js 20 or later with js-yaml (npm i -D js-yaml)',
      language: 'js',
      snippet: `// scripts/radar.mjs: writes radar/radar.json, which Build Your Own Radar reads as it is
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { load, JSON_SCHEMA } from 'js-yaml'

const RING = { accepted: 'Adopt', proposed: 'Assess', deprecated: 'Hold' }   // superseded: off the radar
const QUADRANT = { 'backend-stack': 'Languages & Frameworks', 'frontend-stack': 'Languages & Frameworks', 'data-store': 'Platforms', infrastructure: 'Platforms' }
const { entries = {} } = JSON.parse(readFileSync('radar/overrides.json', 'utf8'))
const adrs = readdirSync('architecture/nodes', { recursive: true }).filter((f) => f.endsWith('.md'))
  .map((f) => load(readFileSync(\`architecture/nodes/\${f}\`, 'utf8').split(/^---$/m)[1] ?? '', { schema: JSON_SCHEMA }))
  .filter((n) => n?.type === 'adr').sort((a, b) => String(a.date).localeCompare(String(b.date)))
const errors = Object.keys(entries).filter((l) => !adrs.some((a) => a.label === l)).map((l) => \`radar/overrides.json: no ADR is labelled "\${l}"\`)
const radar = new Map()   // by technology name: the most recent ADR wins
for (const adr of adrs) {
  const o = entries[adr.label] ?? {}
  const quadrant = o.quadrant ?? QUADRANT[adr.concern] ?? (o.technology ? 'Tools' : undefined)
  const ring = o.ring ?? RING[adr.status]
  if (!quadrant || !RING[adr.status]) continue   // not a technology choice, or superseded
  if (!['Adopt', 'Trial', 'Assess', 'Hold'].includes(ring) || !['Techniques', 'Tools', 'Platforms', 'Languages & Frameworks'].includes(quadrant)) errors.push(\`\${adr.label}: ring "\${ring}", quadrant "\${quadrant}"\`)
  const isNew = Date.now() - Date.parse(adr.date) < {{REVIEW_MONTHS}} * 30.44 * 86_400_000
  const name = o.technology ?? adr.label
  radar.set(name, { name, ring, quadrant, isNew: isNew ? 'TRUE' : 'FALSE', description: \`ADR "\${adr.label}", \${adr.status} on \${adr.date}\`, adr: adr.label, adrStatus: adr.status })
}
if (errors.length) { console.error(errors.join('\\n')); process.exit(1) }
writeFileSync('radar/radar.json', \`\${JSON.stringify([...radar.values()].sort((a, b) => a.name.localeCompare(b.name)), null, 2)}\\n\`)`,
    },
    {
      id: 'ff-radar-current', label: 'Committed radar matches the model', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MAIN, checks: ['req-radar-current'],
      threshold: '0 differences between the committed radar/radar.json and what scripts/radar.mjs generates, on every pull request',
      description: 'The radar workflow runs on every pull request and every Monday: it regenerates the radar and fails when the committed file differs, then runs the Hold and Trial checks over it. It is a required check of the main branch, in the ruleset the Code review and branching pack keeps.',
      tool: 'GitHub Actions with Node.js',
      language: 'yaml',
      snippet: `# .github/workflows/radar.yml
name: radar
on:
  pull_request:
  schedule:
    - cron: '0 6 * * 1'
jobs:
  radar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
      - uses: actions/setup-node@v4.1.0   # pin by commit SHA in your repository
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: node scripts/radar.mjs
      - name: The committed radar is what the model gives
        run: git diff --exit-code radar/radar.json || { echo "run node scripts/radar.mjs and commit radar/radar.json"; exit 1; }
      - run: node scripts/radar-hold.mjs
      - run: node scripts/radar-trials.mjs`,
    },
    {
      id: 'ff-hold-uses', label: 'No new use of a technology on Hold', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: [...MAIN, 'adr-hold-migrate', 'adr-hold-freeze'], checks: ['req-hold-no-new-use', 'req-hold-instead'],
      threshold: '0 package manifests, lockfiles or container image files using a package of a technology on Hold outside its known uses; 0 technologies on Hold without packages and a replacement in the overrides',
      description: 'A Node script lists the repository\'s manifests, lockfiles and Dockerfiles with git ls-files, and for each technology in Hold searches them for the package names its entry in radar/overrides.json gives (as whole names, so moment does not match moment-timezone or @types/moment, and a transitive use is found in the lockfile); a file that uses one and is not among the entry\'s uses fails the check. Package names should be distinctive: a runtime such as node is better held by the version policy of its stack pack than by a name search.',
      tool: 'Node.js 20 or later (a step of the radar workflow)',
      language: 'js',
      snippet: `// scripts/radar-hold.mjs: a step of the radar workflow, on every pull request
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const radar = JSON.parse(readFileSync('radar/radar.json', 'utf8'))
const { entries = {} } = JSON.parse(readFileSync('radar/overrides.json', 'utf8'))
const MANIFEST = /(^|\\/)(package(-lock)?\\.json|pnpm-lock\\.yaml|yarn\\.lock|pom\\.xml|build\\.gradle(\\.kts)?|requirements[^/]*\\.txt|poetry\\.lock|go\\.mod|[^/]+\\.csproj|(Docker|Container)file[^/]*)$/
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\\n').filter((f) => MANIFEST.test(f))
const escape = (s) => s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')
const errors = []
for (const blip of radar.filter((b) => b.ring === 'Hold')) {
  const { packages = [], uses = {}, instead } = entries[blip.adr] ?? {}
  if (!packages.length || !instead) errors.push(\`\${blip.name} is on Hold: its entry in radar/overrides.json needs packages and instead\`)
  for (const pkg of packages) {
    const used = new RegExp(\`(^|[^\\\\w@/.-]|node_modules/)\${escape(pkg)}([^\\\\w/-]|$)\`, 'm')
    for (const f of files) {
      if (used.test(readFileSync(f, 'utf8')) && !uses[f]) errors.push(\`\${f} uses \${pkg}: \${blip.name} is on Hold, use \${instead} instead\`)
    }
  }
}
if (errors.length) { console.error(errors.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-hold-migration', label: 'Uses of Hold migrated by the deadline', when: { HOLD: ['migrate'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'weekly', invocation: 'automated', implements: ['adr-hold-migrate'], checks: ['req-hold-migrated'],
      threshold: '0 known uses of a technology on Hold past holdSince plus {{HOLD_MONTHS}} months; every known use has an open GitHub issue',
      description: 'A weekly step of the radar workflow reads the uses of every technology in Hold from radar/overrides.json, fails when the deadline (holdSince plus {{HOLD_MONTHS}} months) has passed for any, and asks GitHub whether each use\'s migration issue is still open: a closed issue with its use still listed means the use was migrated without removing its line, or the issue closed without the migration.',
      tool: 'jq, GNU date and the gh CLI (GH_TOKEN with read access to issues)',
      language: 'bash',
      snippet: `# a weekly step of the radar workflow, after node scripts/radar.mjs
set -euo pipefail
today=$(date -u +%F); fail=0
while IFS=$'\\t' read -r name since file item; do
  [ -n "$since" ] || { echo "$name: no holdSince in radar/overrides.json"; fail=1; continue; }
  due=$(date -u -d "$since +{{HOLD_MONTHS}} months" +%F)
  [[ "$today" > "$due" ]] && { echo "$file still uses $name, on Hold since $since: the deadline $due has passed"; fail=1; }
  [[ "$item" == https://github.com/*/issues/* ]] || { echo "$file: '$item' is no GitHub issue"; fail=1; continue; }
  state=$(gh issue view "$item" --json state --jq .state)
  [ "$state" = OPEN ] || { echo "$file uses $name, but its migration issue $item is $state"; fail=1; }
done < <(jq -r --slurpfile radar radar/radar.json '.entries | to_entries[]
  | select(.key as $label | $radar[0] | any(.adr == $label and .ring == "Hold"))
  | .key as $label | .value as $e | ($e.uses // {}) | to_entries[]
  | [$e.technology // $label, $e.holdSince // "", .key, .value] | @tsv' radar/overrides.json)
exit $fail`,
    },
    {
      id: 'ff-trial-entries', label: 'Trials recorded', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: [...MAIN, 'adr-trial-timebox', 'adr-trial-open'], checks: ['req-trial-recorded'],
      threshold: 'Every technology in Trial has systems, an owner and a start date in radar/overrides.json, and its ADR is proposed',
      description: 'A Node script over the generated radar and the overrides fails for a technology in Trial whose record lacks its systems, owner or start date, or whose ADR is no longer proposed (the decision was taken and the Trial ring left behind).',
      tool: 'Node.js 20 or later (a step of the radar workflow)',
      language: 'js',
      snippet: `// scripts/radar-trials.mjs: a step of the radar workflow
import { readFileSync } from 'node:fs'

const radar = JSON.parse(readFileSync('radar/radar.json', 'utf8'))
const { entries = {} } = JSON.parse(readFileSync('radar/overrides.json', 'utf8'))
const errors = []
for (const blip of radar.filter((b) => b.ring === 'Trial')) {
  const trial = entries[blip.adr]?.trial ?? {}
  if (blip.adrStatus !== 'proposed') errors.push(\`\${blip.name}: its ADR is \${blip.adrStatus}; remove "ring": "Trial" from its entry\`)
  if (!trial.systems?.length || !trial.owner || !/^\\d{4}-\\d{2}-\\d{2}$/.test(trial.started ?? '')) {
    errors.push(\`\${blip.name}: a trial names its systems, an owner and the date it started (YYYY-MM-DD)\`)
  }
}
if (errors.length) { console.error(errors.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-trial-timebox', label: 'Trials end with a decision', when: { TRIAL: ['timebox'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-trial-timebox'], checks: ['req-trial-timebox'],
      threshold: 'Every trial runs in 1 system, has exit criteria, and started no more than {{TRIAL_MONTHS}} months ago',
      description: 'A Node script, run weekly and on every pull request after scripts/radar-trials.mjs, fails for a trial in more than one system, without exit criteria, or past its time box while its ADR is still proposed.',
      tool: 'Node.js 20 or later (a step of the radar workflow)',
      language: 'js',
      snippet: `// scripts/radar-trial-timebox.mjs: a step of the radar workflow, after radar-trials.mjs
import { readFileSync } from 'node:fs'

const MONTHS = {{TRIAL_MONTHS}}
const radar = JSON.parse(readFileSync('radar/radar.json', 'utf8'))
const { entries = {} } = JSON.parse(readFileSync('radar/overrides.json', 'utf8'))
const errors = []
for (const blip of radar.filter((b) => b.ring === 'Trial')) {
  const trial = entries[blip.adr]?.trial ?? {}
  if (trial.systems?.length !== 1) errors.push(\`\${blip.name}: a trial runs in one system\`)
  if (!trial.exit?.trim()) errors.push(\`\${blip.name}: the trial has no written exit criteria\`)
  const end = new Date(\`\${trial.started}T00:00:00Z\`)
  end.setUTCMonth(end.getUTCMonth() + MONTHS)
  if (Number.isNaN(end.getTime())) errors.push(\`\${blip.name}: the trial has no start date\`)
  else if (Date.now() > end.getTime()) errors.push(\`\${blip.name}: the time box ended on \${end.toISOString().slice(0, 10)}; accept, deprecate or supersede its ADR\`)
}
if (errors.length) { console.error(errors.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-review-cadence', label: 'Radar reviewed on a cadence', characteristic: 'maintainability', scope: 'atomic', cadence: 'temporal', every: '180d', invocation: 'manual', implements: MAIN, checks: ['req-review'],
      threshold: 'The reviewed date in radar/overrides.json is no more than {{REVIEW_MONTHS}} months old',
      description: 'A weekly step of the radar workflow reads the date of the last review from the overrides and fails once the next review is overdue, so the red build is the reminder. The review itself is a pull request that moves what it decides and sets reviewed.',
      tool: 'jq and GNU date (a step of the radar workflow)',
      language: 'bash',
      snippet: `# a weekly step of the radar workflow
set -euo pipefail
reviewed=$(jq -r '.reviewed // empty' radar/overrides.json)
[ -n "$reviewed" ] || { echo "radar/overrides.json records no review (\\"reviewed\\": \\"YYYY-MM-DD\\")"; exit 1; }
due=$(date -u -d "$reviewed +{{REVIEW_MONTHS}} months" +%F)
if [[ "$(date -u +%F)" > "$due" ]]; then
  echo "the radar was last reviewed on $reviewed; the next review was due by $due"
  exit 1
fi
echo "radar reviewed on $reviewed; next review due by $due"`,
    },
    {
      id: 'ff-ring-approval', label: 'Ring moves approved', when: APPROVED, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'manual', implements: ['adr-board', 'adr-rfc'], checks: ['req-ring-approval'],
      threshold: 'A pull request that changes any technology\'s ring, or adds or removes one, carries the label radar and has at least {{RING_APPROVALS}} approvals from the approvers listed on main',
      description: 'A workflow on pull_request and pull_request_review regenerates the radar, compares each technology\'s ring with the radar on main, and when anything moved labels the pull request radar and counts the latest approving reviews by the approvers listed in radar/overrides.json as main has it. The job is a required check of the main branch, so the merge waits for the approvals.',
      tool: 'GitHub Actions with jq and the gh CLI (checkout with fetch-depth: 0; GH_TOKEN with pull-requests: write; PR set to the pull request number)',
      language: 'bash',
      snippet: `# .github/workflows/radar-approval.yml runs this on pull_request and pull_request_review
set -euo pipefail
node scripts/radar.mjs
pairs() { jq -r '.[] | "\\(.name) in \\(.ring)"' | sort; }
moves=$(comm -3 <(git show origin/main:radar/radar.json | pairs) <(pairs < radar/radar.json) | tr -d '\\t')
if [ -z "$moves" ]; then echo "no ring moves"; exit 0; fi
echo "ring moves:"; echo "$moves"
gh pr edit "$PR" --add-label radar
approvers=$(git show origin/main:radar/overrides.json | jq -c '.approvers // []')   # as on main: a pull request cannot add its own
got=$(gh pr view "$PR" --json latestReviews \\
  | jq --argjson ok "$approvers" '[.latestReviews[] | select(.state == "APPROVED") | .author.login | select(IN($ok[]))] | length')
[ "$got" -ge {{RING_APPROVALS}} ] || { echo "$got of {{RING_APPROVALS}} approvals from the radar's approvers"; exit 1; }`,
    },
    {
      id: 'ff-rfc-answered', label: 'Proposals answered in time', when: { BOARD: ['rfc'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'weekly', invocation: 'automated', implements: ['adr-rfc'], checks: ['req-rfc-answered'],
      threshold: '0 open pull requests labelled radar older than {{RFC_DAYS}} days',
      description: 'A weekly step of the radar workflow lists the open pull requests labelled radar and fails for any opened more than {{RFC_DAYS}} days ago, naming them.',
      tool: 'gh CLI and jq, GNU date (GH_TOKEN with read access to pull requests)',
      language: 'bash',
      snippet: `# a weekly step of the radar workflow
set -euo pipefail
cutoff=$(date -u -d '{{RFC_DAYS}} days ago' +%Y-%m-%dT%H:%M:%SZ)
stale=$(gh pr list --label radar --state open --limit 200 --json url,title,createdAt \\
  | jq -r --arg cutoff "$cutoff" '.[] | select(.createdAt < $cutoff) | "\\(.url)  \\(.title)"')
if [ -n "$stale" ]; then
  echo "ring proposals open for more than {{RFC_DAYS}} days:"; echo "$stale"
  exit 1
fi`,
    },
    {
      id: 'ff-team-owned', label: 'Each ADR has an owning team', when: { BOARD: ['teams'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-teams'], checks: ['req-team-owned'],
      threshold: '0 ADR files under architecture/nodes without a code owner; the main branch requires a code owner\'s review',
      description: 'A step of the radar workflow finds the ADR files by their front matter, asks the codeowners CLI which of them no CODEOWNERS pattern matches, and reads the main branch\'s rules from GitHub to check that a pull_request rule requires a code owner\'s review. With classic branch protection instead of rulesets, read required_pull_request_reviews.require_code_owner_reviews from the branch protection endpoint.',
      tool: 'codeowners CLI (github.com/hmarr/codeowners) and the gh CLI',
      language: 'bash',
      snippet: `# a step of the radar workflow
set -euo pipefail
unowned=$(grep -rlx --include='*.md' 'type: "adr"' architecture/nodes | xargs -r codeowners -u)
[ -z "$unowned" ] || { echo "ADRs no team owns in CODEOWNERS:"; echo "$unowned"; exit 1; }
required=$(gh api "repos/{owner}/{repo}/rules/branches/main" \\
  --jq '[.[] | select(.type == "pull_request") | .parameters.require_code_owner_review] | any')
[ "$required" = true ] || { echo "main does not require a code owner's review"; exit 1; }`,
    },
    {
      id: 'ff-byor-publish', label: 'Radar picture published', when: { PUBLISH: ['byor'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MAIN, checks: ['req-published'],
      threshold: 'Every push to main that changes architecture/ or radar/ pushes a radar image tagged with its commit',
      description: 'On every push to main that touches the model or the overrides, a job regenerates the radar and builds an image from the Build Your Own Radar image with radar/radar.json copied into the folder it serves as /files; people open the app and give it /files/radar.json. Deploying the image to the internal host is the platform\'s usual deployment. The app shows the ring Hold under the name Thoughtworks now gives it, Caution. Build Your Own Radar is AGPL-3.0: running it unmodified inside the organisation is fine; a modified copy offered to others must offer its source.',
      tool: 'GitHub Actions, Docker, the wwwthoughtworks/build-your-own-radar image, GitHub Container Registry',
      language: 'yaml',
      snippet: `# .github/workflows/radar-publish.yml (ghcr.io needs the repository name in lower case)
name: radar-publish
on:
  push:
    branches: [main]
    paths: ['architecture/**', 'radar/**']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
      - uses: actions/setup-node@v4.1.0   # pin by commit SHA in your repository
        with: { node-version: 22, cache: npm }
      - run: npm ci && node scripts/radar.mjs
      - name: Build and push the radar image
        run: |
          printf 'FROM wwwthoughtworks/build-your-own-radar:v1.2.1\\nCOPY radar/radar.json /opt/build-your-own-radar/files/radar.json\\n' > Dockerfile.radar
          echo "\${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u "\${{ github.actor }}" --password-stdin
          docker build -f Dockerfile.radar -t "ghcr.io/\${{ github.repository }}/radar:\${{ github.sha }}" .
          docker push "ghcr.io/\${{ github.repository }}/radar:\${{ github.sha }}"`,
    },
  ],
}

export default pack
