import type { PackSpec, When } from '../../src/packSpec'

const LEADS = ['adr-lead-reliability', 'adr-lead-maintainability', 'adr-lead-security', 'adr-lead-performance', 'adr-lead-cost']
const WRITTEN: When = { METHOD: ['atam', 'scenarios'] }
const FORCES = 'This system has to meet several quality goals at once, and they pull against each other. The forces: every redundant zone, encryption hop, cache or abstraction buys one quality with another or with money; a conflict settled when it arrives, under a deadline, is settled by whoever is in the room; "fast", "secure" and "easy to change" mean different things to different people until they carry a number; a ranking agreed once drifts from the product as the market, the regulator and the load change; and a decision that quietly gives up a quality is found out only when that quality fails. The numbers themselves are set in the packs that own each quality (Availability, Capacity and scaling, Backup and recovery, Encryption in transit and at rest, Authentication, Delivery metrics and the others); this pack decides which of them gives way. Legal obligations (the Personal data pack, a regulator\'s rules) are constraints, not qualities to rank: no ranking lowers them.'
const MODEL_HEAD = `import { readdirSync, readFileSync } from 'node:fs'
import { JSON_SCHEMA, load } from 'js-yaml'
import { expect, it } from 'vitest'

const nodes = readdirSync('architecture/nodes', { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.md'))
  .map((f) => (load(readFileSync(\`architecture/nodes/\${f}\`, 'utf8').split(/^---$/m)[1] ?? '', { schema: JSON_SCHEMA }) ?? {}) as Record<string, string>)`
const SYSTEMS = `const slug = (s: unknown) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const systems = nodes.filter((n) => n.type === 'system' && String(n.external) !== 'true').map((n) => ({ system: slug(n.label) }))`

const pack: PackSpec = {
  id: 'concern-quality-priorities',
  name: 'Quality attribute priorities',
  group: 'architecture',
  description: 'Which quality wins when two conflict: a signed ranking of the ISO/IEC 25010:2023 characteristics and cost, written down before the conflicts come; quality attribute scenarios that make the goals measurable; and ADRs that name the quality they favour and the one they give up. The other packs set the numbers; this one decides which gives way. The checks are Vitest tests with js-yaml over the Radical Markdown model and shell scripts with jq.',
  tags: ['architecture', 'quality attributes', 'iso 25010', 'atam', 'trade-offs', 'quality scenarios'],
  concern: {
    id: 'quality-priorities',
    trigger: 'LIST NODES WHERE type = "system" AND external != true',
    why: 'this system has several quality goals that pull against each other, so which one gives way in a conflict has to be decided before the conflict comes.',
  },
  sources: [
    { title: 'ISO/IEC 25010:2023, Systems and software Quality Requirements and Evaluation (SQuaRE): Product quality model', url: 'https://www.iso.org/standard/78176.html' },
    { title: 'Q42 quality model (arc42): ISO/IEC 25010:2023 characteristics and subcharacteristics', url: 'https://quality.arc42.org/standards/iso-25010' },
    { title: 'Kazman, Klein, Clements: ATAM: Method for Architecture Evaluation (CMU/SEI-2000-TR-004)', url: 'https://www.sei.cmu.edu/library/atam-method-for-architecture-evaluation/' },
    { title: 'Bass, Clements, Kazman: Software Architecture in Practice, 4th edition (Addison-Wesley), 3.3 Quality attribute scenarios', url: 'https://www.informit.com/store/software-architecture-in-practice-9780136886099' },
    { title: 'arc42, section 10: Quality requirements', url: 'https://docs.arc42.org/section-10/' },
    { title: 'Q42, the arc42 quality model', url: 'https://quality.arc42.org/' },
  ],
  questions: [
    {
      key: 'LEAD', title: 'Leading quality', label: 'Which quality wins when it conflicts with the others?',
      hint: 'This is the first entry of the ranking and the answer to most conflicts: what the team pays for first, and what gives way. The numbers each quality must meet are set in its own pack (Availability, Capacity and scaling, Encryption in transit and at rest and the others). A safety-critical system follows its safety standard (IEC 61508, ISO 26262), which this ranking does not replace.',
      default: 'reliability',
      options: [
        { value: 'reliability', label: 'reliability', description: 'The service must stay up and correct: availability, fault tolerance and recoverability win over speed of change, latency and cost. Pick it when an hour down costs more than a feature a week late: payments, operations that run around the clock, a platform other systems depend on.' },
        { value: 'maintainability', label: 'maintainability', description: 'Change fast: modularity, analysability and modifiability win, and the team accepts more operational risk and a lower availability target for now. Pick it for a product still finding its market, where time to market decides more than the last nine.' },
        { value: 'security', label: 'security', description: 'Confidentiality, integrity, accountability and authenticity win, even at a cost in latency, convenience and delivery speed. Pick it when the system keeps regulated or sensitive data (health, finance, public sector) and a breach outweighs any outage.' },
        { value: 'performance', label: 'performance efficiency', description: 'Latency and throughput win (time behaviour, capacity, resource utilisation), paid for with more hardware and code that is harder to change. Pick it when speed is the product (trading, bidding, search, games) or a contract sets the latency.' },
        { value: 'cost', label: 'cost', description: 'The running cost wins: every other quality is held at the lowest level users accept. ISO/IEC 25010 has no cost characteristic, so the ranking adds it as a business driver. Pick it for internal tools, batch work and products with thin margins.' },
      ],
    },
    {
      key: 'METHOD', title: 'Method', label: 'How are the quality goals made concrete?',
      hint: 'A ranking says which quality wins; a scenario with a number says by how much and makes it testable. The method decides who writes the scenarios and how much the stakeholders take part.',
      default: 'scenarios',
      options: [
        { value: 'atam', label: 'an ATAM utility tree from a stakeholder workshop', description: 'The people who sign the ranking and the architects refine each characteristic into concerns and quality attribute scenarios in a workshop, and rate each High, Medium or Low for importance and for risk (ATAM step 5). Pick it for a new system or a large change, when the stakeholders disagree, or before an architecture evaluation.' },
        { value: 'scenarios', label: 'quality attribute scenarios written by the architects', description: 'The architects write the scenarios in six parts and the people who sign the ranking review them in the pull request; no workshop. Pick it by default: most of the value of the utility tree at a fraction of the meeting time.' },
        { value: 'ranking', label: 'a ranking of the characteristics only', description: 'Only the order of the characteristics, each of the top three pointing to the requirement that holds its number; no scenarios. Pick it for a small system or a first step, knowing that it says which quality wins, not by how much.' },
      ],
    },
    {
      key: 'TRADEOFFS', title: 'Trade-offs', label: 'How do ADRs record the qualities they trade?',
      hint: 'A decision that buys one quality with another is a trade-off point (ATAM). Written in a fixed line, it can be checked against the ranking; left in prose, nobody notices when a decision goes against it.',
      default: 'line',
      options: [
        { value: 'line', label: 'a Favours and At the cost of line in every ADR', description: 'Every ADR accepted after the ranking carries a line "Favours: … / At the cost of: …" naming characteristics of the ranking, or "none"; one that favours a lower-ranked quality also names who approved the exception. Pick it whenever ADRs are kept in the model: the check costs nothing.' },
        { value: 'none', label: 'no trade-off line in the ADRs', description: 'ADRs describe their consequences in prose and nothing compares them with the ranking. Pick it only while ADRs are few and one architect writes them all.' },
      ],
    },
    {
      key: 'REVIEW', title: 'Review', label: 'When is the ranking reviewed?',
      hint: 'Priorities change with the market, the regulator and the load. A ranking nobody revisits ranks last year\'s product, and people stop following it.',
      default: 'calendar',
      options: [
        { value: 'calendar', label: 'on a fixed calendar', description: 'The ranking is reviewed and signed again within a set number of months (12 by default); the build fails after that. Pick it when releases are continuous and have no major versions to hang a review on.' },
        { value: 'release', label: 'at every major release', description: 'A major release is refused unless the ranking was reviewed since the previous one. Pick it when the product ships major versions (a new major version is when priorities shift).' },
      ],
    },
  ],
  details: [
    { key: 'APPROVERS', label: 'Who signs the ranking (roles, comma-separated)?', default: 'product owner, architect, operations lead' },
    { key: 'LEAD_SCENARIOS', label: 'How many quality attribute scenarios must the leading quality have at least (with scenarios or a utility tree)?', default: '3', number: true },
    { key: 'REVIEW_MONTHS', label: 'Within how many months must the ranking be reviewed again (on a fixed calendar)?', default: '12', number: true },
  ],
  need: {
    label: 'Conflicts between qualities are settled in advance',
    text: 'The system has to be reliable, secure, fast, easy to change and affordable, and these goals pull against each other: redundancy costs money, encryption costs latency, a fast release cadence costs stability. Settled one conflict at a time, the answer depends on who is in the room. The order has to be written down and signed before the conflicts come, the goals have to be measurable, and every decision that gives one up has to say so. The checks assume the architecture model as the Radical Markdown folder architecture/ (nodes under architecture/nodes with their properties in the front matter, relations in architecture/relations.json), and one folder quality/<system>/ per system of the model (its label in lower case, other characters as dashes) holding ranking.json and, with a utility tree, utility-tree.yaml.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-ranking', label: 'Qualities ranked in strict order', ears_type: 'ubiquitous',
      action: 'keep in quality/<system>/ranking.json a strict order of the nine ISO/IEC 25010:2023 product quality characteristics (functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility, safety) and cost, each named once and nothing else, with {{LEAD}} first',
      rationale: 'A ranking with ties settles nothing, and the names of the standard keep "fast" or "robust" from meaning different things to different people (ISO/IEC 25010:2023). Cost is no product characteristic of the standard but conflicts with all of them, so it is ranked beside them (arc42 section 10).',
      scenario: { label: 'Ranking complete and strict', given: 'the ranking file of the system', when: 'it is read', then: 'it names each of the nine characteristics and cost exactly once, nothing else, with {{LEAD}} first' },
    },
    {
      id: 'req-signoff', label: 'Ranking signed', ears_type: 'ubiquitous',
      action: 'record in the ranking file the person who signed the current order for each of: {{APPROVERS}}, and the date of the last review',
      rationale: 'A ranking the people who pay for it never agreed to is overruled at the first conflict with a deadline; the utility tree is built with the stakeholders, not for them (ATAM report, step 5).',
      scenario: { label: 'Sign-offs recorded', given: 'a ranking file', when: 'one of {{APPROVERS}} has no name in it, or the review date is missing', then: 'the ranking check fails naming what is missing' },
    },
    {
      id: 'req-review-calendar', label: 'Ranking reviewed in time', when: { REVIEW: ['calendar'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the ranking of a system was last reviewed more than {{REVIEW_MONTHS}} months ago',
      action: 'fail the main-branch build, naming the ranking file, until the ranking is reviewed and signed again',
      rationale: 'Priorities change with the market, the regulator and the load; quality requirements are kept with the architecture documentation as the system changes (arc42 section 10), and a date nobody checks is not a review.',
      scenario: { label: 'Stale ranking fails the build', given: 'a ranking last reviewed {{REVIEW_MONTHS}} months and one day ago', when: 'the main branch is built', then: 'the build fails naming the ranking file' },
    },
    {
      id: 'req-review-release', label: 'Ranking reviewed for each major release', when: { REVIEW: ['release'] }, ears_type: 'event-driven',
      trigger: 'a major release is tagged',
      action: 'refuse the release unless the ranking of every system was reviewed on or after the date of the previous major release',
      rationale: 'A major version is when priorities shift; tying the review to it makes the review happen when it matters (arc42 section 10).',
      scenario: { label: 'Release waits for the review', given: 'a ranking last reviewed before the previous major release', when: 'the next major release is tagged', then: 'the release job fails naming the ranking file' },
    },
    {
      id: 'req-qas-form', label: 'Scenarios have all six parts', when: WRITTEN, ears_type: 'ubiquitous',
      action: 'hold each quality attribute scenario as an event-driven or complex EARS requirement of the architecture model whose label starts with its characteristic and a colon ("Performance efficiency: …"), whose trigger names the source and the stimulus, whose precondition or trigger names the environment, which the element it is about satisfies (the artifact), and whose action states the response and a response measure with a number and a unit',
      rationale: 'Source, stimulus, environment, artifact, response and response measure are what make a quality goal testable; without the measure, nobody can say whether it is met (Bass, Clements and Kazman, 3.3; arc42 section 10, quality scenarios).',
      scenario: { label: 'Scenario without a measure refused', given: 'a requirement labelled "Performance efficiency: search under load" whose action says "respond quickly"', when: 'the scenario check runs', then: 'it fails naming the requirement, and passes once the action reads "respond within 300 ms at the 95th percentile"' },
    },
    {
      id: 'req-lead-scenarios', label: 'The leading quality is measured', when: WRITTEN, ears_type: 'ubiquitous',
      action: 'hold at least {{LEAD_SCENARIOS}} quality attribute scenarios for {{LEAD}}, the leading quality',
      rationale: 'The leading quality is the one conflicts are decided for; if it carries no number, it leads only in words (Bass, Clements and Kazman, 3.3).',
      scenario: { label: 'Leading quality has scenarios', given: 'the architecture model', when: 'its quality attribute scenarios are counted by characteristic', then: 'there are at least {{LEAD_SCENARIOS}} for {{LEAD}}' },
    },
    {
      id: 'req-utility-tree', label: 'Utility tree kept', when: { METHOD: ['atam'] }, ears_type: 'ubiquitous',
      action: 'keep the utility tree of each system in quality/<system>/utility-tree.yaml, with each characteristic refined into concerns and each leaf naming a quality attribute scenario of the model by its label, rated H, M or L for importance and for risk, and at least one leaf of importance H under {{LEAD}}',
      rationale: 'The utility tree turns the stakeholders\' goals into scenarios and ranks them on two dimensions, importance to the system and risk to achieve, in High, Medium and Low, because finer distinctions are not made reliably (ATAM report, utility trees).',
      scenario: { label: 'Leaf without a scenario refused', given: 'a utility tree with a leaf naming a scenario that is not in the model', when: 'the utility-tree check runs', then: 'it fails naming the leaf' },
    },
    {
      id: 'req-workshop', label: 'Utility tree built with the stakeholders', when: { METHOD: ['atam'] }, ears_type: 'event-driven',
      trigger: 'the ranking is reviewed',
      action: 'revise the utility tree in a workshop with {{APPROVERS}} and the architects, and rank the characteristics from its leaves of importance H',
      rationale: 'Building the tree together is where stakeholders find qualities they had not named; in the report\'s example, performance and availability surfaced only while refining it (ATAM report, utility trees).',
      unchecked: 'The architect runs the workshop with {{APPROVERS}} at each review of the ranking; who was in the room is no fact a script can see, only the tree it leaves.',
      scenario: { label: 'Workshop at each review', given: 'a review of the ranking is due', when: 'the workshop with {{APPROVERS}} is held', then: 'the utility tree and the ranking are updated and signed on the same date' },
    },
    {
      id: 'req-qas-review', label: 'Scenarios reviewed by the signers', when: { METHOD: ['scenarios'] }, ears_type: 'event-driven',
      trigger: 'an architect adds or changes a quality attribute scenario',
      action: 'have the change approved by {{APPROVERS}} in the pull request before it is merged',
      rationale: 'A response measure is a promise someone pays for; the people who sign the ranking confirm that it is the right one (Bass, Clements and Kazman, 3.3: scenarios come from the stakeholders).',
      unchecked: 'Each of {{APPROVERS}} approves the pull request that adds or changes a scenario; whether a measure is worth what it costs is a judgement no script makes.',
      scenario: { label: 'Scenario change approved', given: 'a pull request that changes the response measure of a scenario', when: 'it is reviewed', then: 'it is merged only after {{APPROVERS}} have approved it' },
    },
    {
      id: 'req-anchors', label: 'Top qualities point to their numbers', when: { METHOD: ['ranking'] }, ears_type: 'ubiquitous',
      action: 'name in the ranking file, for each of the three highest-ranked characteristics, a requirement of the architecture model whose action holds a number with a unit, as set by the pack that owns that quality',
      rationale: 'A ranking alone says which quality wins, not by how much; pointing the top three at their numbers keeps it tied to something measurable (ISO/IEC 25010:2023 is a model for specifying and measuring quality).',
      scenario: { label: 'Top quality without a number', given: 'a ranking whose first characteristic points to no requirement of the model', when: 'the ranking check runs', then: 'it fails naming the characteristic' },
    },
    {
      id: 'req-tradeoff-line', label: 'ADRs name what they trade', when: { TRADEOFFS: ['line'] }, ears_type: 'ubiquitous',
      action: 'carry in the consequences of every ADR accepted since the ranking was adopted a line "Favours: <characteristics> / At the cost of: <characteristics>" naming only entries of the ranking, or "Favours: none / At the cost of: none"',
      rationale: 'A decision that affects more than one quality attribute is a trade-off point (ATAM report); written in a fixed line, it can be compared with the ranking by a script instead of by memory.',
      scenario: { label: 'ADR without the line refused', given: 'an ADR accepted after the ranking was adopted', when: 'its consequences have no Favours line, or the line names "speed"', then: 'the trade-off check fails naming the ADR' },
    },
    {
      id: 'req-tradeoff-exception', label: 'Going against the ranking is approved', when: { TRADEOFFS: ['line'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an accepted ADR favours a characteristic ranked below one it gives up',
      action: 'carry in its consequences a line "Exception:" naming who of {{APPROVERS}} approved going against the ranking, and when',
      rationale: 'The ranking settles conflicts in advance; a decision against it may be right, but it is a decision of the people who signed the ranking, not of the ADR\'s author alone (ATAM report: trade-off points).',
      scenario: { label: 'Exception named', given: 'an ADR whose line favours a characteristic ranked below the one it gives up', when: 'it has no Exception line, and then one naming the approver and date', then: 'the trade-off check fails the first time and passes the second' },
    },
  ],
  adrs: [
    {
      id: 'adr-lead-reliability', label: 'Reliability leads the quality ranking', when: { LEAD: ['reliability'] },
      decision: 'Reliability leads. In the ranking of the system (quality/<system>/ranking.json, signed by {{APPROVERS}}) reliability, with faultlessness, availability, fault tolerance and recoverability (ISO/IEC 25010:2023), comes first; the other characteristics and cost follow in the order recorded there. When reliability conflicts with another quality, reliability wins: a feature, a latency gain or a saving that would put at risk the availability target of the Availability pack or the recovery objectives of the Backup and recovery pack waits until it no longer does, and redundancy, tested failover and backups that restore are paid for before optimisations. Method: {{METHOD}}. Trade-offs: {{TRADEOFFS}}. The ranking is reviewed {{REVIEW}}.',
      consequences: '• Every conflict with reliability has a known answer, decided in minutes instead of argued in each design review.\n• More infrastructure per request (replicas in several zones, standby capacity) and slower delivery: changes pass more gates and roll out more carefully.\n• A feature that needs a weaker dependency waits until degradation or redundancy is built around it.\n• The other qualities still meet the numbers their own packs set; they give way only where both cannot be met.\n• Favours: reliability / At the cost of: maintainability, cost',
      alternatives: '1. Maintainability first: faster change and more operational risk; right while the product is still finding its market.\n2. Cost first: a smaller bill and outages the users have to accept.\n3. No ranking, each conflict on its merits: flexible on paper, and in practice decided by whoever is under the most pressure that day.',
    },
    {
      id: 'adr-lead-maintainability', label: 'Maintainability leads the quality ranking', when: { LEAD: ['maintainability'] },
      decision: 'Maintainability leads, for time to market. In the ranking of the system (quality/<system>/ranking.json, signed by {{APPROVERS}}) maintainability, with modularity, analysability and modifiability (ISO/IEC 25010:2023), comes first; the other characteristics and cost follow in the order recorded there. When maintainability conflicts with another quality, it wins: the simpler design that can be changed next week beats the faster or more redundant one, the team accepts a modest availability target in the Availability pack and more operational risk, and the speed this buys is measured by the lead time for changes of the Delivery metrics pack. Method: {{METHOD}}. Trade-offs: {{TRADEOFFS}}. The ranking is reviewed {{REVIEW}}.',
      consequences: '• Features reach users sooner, and the design stays easy to change while the product finds its market.\n• More incidents and slower pages than a reliability- or performance-led design would have; users notice.\n• The ranking has to change when the product matures, or the system keeps the risk profile of a prototype.\n• The other qualities still meet the numbers their own packs set; they give way only where both cannot be met.\n• Favours: maintainability / At the cost of: reliability, performance efficiency',
      alternatives: '1. Reliability first: fewer incidents, slower change.\n2. Performance efficiency first: faster responses, code that is harder to change.\n3. No ranking: the cost of each shortcut is argued again each time.',
    },
    {
      id: 'adr-lead-security', label: 'Security leads the quality ranking', when: { LEAD: ['security'] },
      decision: 'Security leads. In the ranking of the system (quality/<system>/ranking.json, signed by {{APPROVERS}}) security, with confidentiality, integrity, non-repudiation, accountability, authenticity and resistance (ISO/IEC 25010:2023), comes first; the other characteristics and cost follow in the order recorded there. When security conflicts with another quality, security wins: an extra hop for encryption or an authorisation check is paid in latency, a second factor in convenience, a reviewed release in speed of change. The controls themselves are set in the Authentication, Authorization, Encryption in transit and at rest, Secrets and Data classification packs; this decision says that they win a conflict. Method: {{METHOD}}. Trade-offs: {{TRADEOFFS}}. The ranking is reviewed {{REVIEW}}.',
      consequences: '• A proposal that weakens a control for speed or convenience has a known answer: no, unless the signers approve an exception.\n• Slower responses, more steps for users and slower delivery than an unconstrained design.\n• Security work is planned capacity, not what is left over after features.\n• The other qualities still meet the numbers their own packs set; they give way only where both cannot be met.\n• Favours: security / At the cost of: interaction capability, performance efficiency, maintainability',
      alternatives: '1. Reliability first, with security held at the floor its packs set: right when the data is not regulated.\n2. Treating security as a constraint only: the floor is met, and every conflict above it is lost to features.',
    },
    {
      id: 'adr-lead-performance', label: 'Performance efficiency leads the quality ranking', when: { LEAD: ['performance'] },
      decision: 'Performance efficiency leads. In the ranking of the system (quality/<system>/ranking.json, signed by {{APPROVERS}}) performance efficiency, with time behaviour, resource utilisation and capacity (ISO/IEC 25010:2023), comes first; the other characteristics and cost follow in the order recorded there. When it conflicts with another quality, it wins: caches, precomputed and denormalised read models and hand-tuned queries are accepted although they make the code harder to change, and headroom is bought before the latency budget is spent. The latency and throughput numbers are set in the Capacity and scaling pack, the shape of read models in the Architecture style pack. Method: {{METHOD}}. Trade-offs: {{TRADEOFFS}}. The ranking is reviewed {{REVIEW}}.',
      consequences: '• Latency and throughput are protected in every design review, so the product stays fast as it grows.\n• More hardware and more complex code: caches to invalidate, read models to rebuild, optimisations to keep.\n• Changes take longer, because each one is measured against the latency budget before it is merged.\n• The other qualities still meet the numbers their own packs set; they give way only where both cannot be met.\n• Favours: performance efficiency / At the cost of: maintainability, flexibility, cost',
      alternatives: '1. Maintainability first, with performance held at the numbers of the Capacity and scaling pack: right when speed is not what users pay for.\n2. Cost first: smaller machines and slower answers.',
    },
    {
      id: 'adr-lead-cost', label: 'Cost leads the quality ranking', when: { LEAD: ['cost'] },
      decision: 'Cost leads. ISO/IEC 25010:2023 has no cost characteristic, so the ranking of the system (quality/<system>/ranking.json, signed by {{APPROVERS}}) puts cost first as a business driver, followed by the nine characteristics in the order recorded there. When cost conflicts with another quality, the cheaper option wins as long as that quality still meets the number its own pack sets: the lowest availability target users accept (Availability pack), a small fixed fleet or scale to zero (Capacity and scaling pack), and managed services only where they are cheaper at the expected load. The cost-centre tags of the Infrastructure pack make the bill per system visible. Method: {{METHOD}}. Trade-offs: {{TRADEOFFS}}. The ranking is reviewed {{REVIEW}}.',
      consequences: '• A smaller bill, and every proposal that adds running cost has to show what it buys.\n• Lower availability and slower responses than the users might like; the numbers in the other packs are set at the floor.\n• Savings found later (reserved capacity, smaller instances) are easy to take; quality lost to them is harder to win back.\n• Favours: cost / At the cost of: reliability, performance efficiency',
      alternatives: '1. Reliability first: a higher bill and fewer outages.\n2. Leaving cost out of the ranking: the bill grows one well-argued decision at a time.',
    },
    {
      id: 'adr-utility-tree', label: 'Quality goals from an ATAM utility tree', when: { METHOD: ['atam'] },
      decision: 'The quality goals are made concrete with an ATAM-style utility tree (CMU/SEI-2000-TR-004, step 5): in a workshop with {{APPROVERS}} and the architects, each characteristic of the ranking is refined into concerns and those into quality attribute scenarios, each rated H, M or L for importance to the system and for risk to achieve. Each leaf becomes a requirement of the architecture model in the six parts of Bass, Clements and Kazman (source, stimulus, environment, artifact, response, response measure), at least {{LEAD_SCENARIOS}} of them for {{LEAD}}; the tree is kept in quality/<system>/utility-tree.yaml and names its leaves by the requirements\' labels. The (H,H) leaves are the first the architecture is evaluated against and the first to get tests. The workshop is repeated at each review of the ranking.',
      consequences: '• Stakeholders rank concrete scenarios instead of words, and often find qualities they had not named.\n• Half a day to two days of the signers\' time at each review.\n• The tree, the requirements and the ranking are three records to keep in step; the checks hold them together.\n• Favours: none / At the cost of: none',
      alternatives: '1. Scenarios written by the architects and reviewed: cheaper, with less agreement from the people who pay.\n2. A ranking only: settles which quality wins, not by how much.\n3. A full ATAM evaluation by an outside team: all nine steps with risk and trade-off analysis, worth it before a large commitment that cannot be undone.',
    },
    {
      id: 'adr-qas', label: 'Quality goals as quality attribute scenarios', when: { METHOD: ['scenarios'] },
      decision: 'The quality goals are made concrete as quality attribute scenarios written by the architects: each is a requirement of the architecture model in the six parts of Bass, Clements and Kazman (source, stimulus, environment, artifact, response, response measure), labelled with its characteristic, at least {{LEAD_SCENARIOS}} of them for {{LEAD}}; the architecture documentation lists them by characteristic (arc42 section 10). {{APPROVERS}} approve each new or changed scenario in the pull request that adds it. There is no workshop.',
      consequences: '• Measurable goals at the cost of the architects\' writing time and a review, not a meeting.\n• The scenarios reflect what the architects thought of; a quality nobody raised can stay missing until a workshop or an incident finds it.\n• Each scenario is a requirement, so it can be verified by a test like any other.\n• Favours: none / At the cost of: none',
      alternatives: '1. An ATAM utility tree from a workshop: more agreement and better coverage, at the cost of the stakeholders\' time.\n2. A ranking only: no numbers of its own, and no way to tell whether a goal is met.',
    },
    {
      id: 'adr-ranking-only', label: 'A ranking of the qualities only', when: { METHOD: ['ranking'] },
      decision: 'The characteristics are ranked and nothing more: this pack adds no scenarios. In the ranking file, each of the three highest-ranked characteristics points to the requirement of the architecture model that holds its number, set by the pack that owns that quality. The limits are recorded here: a ranking says which quality wins a conflict, not by how much; two neighbours in the ranking are decided as if one were far above the other; and nothing checks that the numbers of the other packs fit the order. The first conflict the ranking cannot settle supersedes this decision with scenarios or a utility tree.',
      consequences: '• Cheap to set up: one file, signed.\n• Conflicts between neighbouring qualities are decided by their order alone, which can be wrong when the higher one is already well met.\n• Below the top three, nothing ties a quality to a number.\n• Favours: none / At the cost of: none',
      alternatives: '1. Quality attribute scenarios written by the architects: numbers for every quality that matters.\n2. An ATAM utility tree: numbers, weights and the stakeholders\' agreement.',
    },
  ],
  fitness: [
    {
      id: 'ff-ranking', label: 'Ranking complete, strict and signed', category: 'structural', implements: LEADS, checks: ['req-ranking', 'req-signoff'],
      threshold: 'For every system of the model, quality/<system>/ranking.json names the nine ISO/IEC 25010:2023 characteristics and cost exactly once and nothing else, with {{LEAD}} first, a signer for each of {{APPROVERS}} and a review date',
      description: 'A test lists the systems of the architecture model that are not external and reads each one\'s ranking file. The file holds "adopted" and "reviewed" dates (YYYY-MM-DD), "approvedBy" (a name per role of the decision), "order" (the ten entries, highest first) and, with a ranking only, "measuredBy" (a requirement label per top characteristic), for example {"adopted": "2026-11-02", "reviewed": "2026-11-02", "approvedBy": {"product owner": "A. Nowak", "architect": "B. Lee", "operations lead": "C. Diaz"}, "order": ["reliability", "security", "cost", "performance efficiency", "maintainability", "functional suitability", "compatibility", "interaction capability", "flexibility", "safety"]}.',
      tool: 'Vitest with js-yaml over the Radical Markdown folder (for a model kept as a single .radical file: the same test over its nodes array)',
      language: 'ts',
      snippet: `${MODEL_HEAD}
${SYSTEMS}
const RANKED = ['functional suitability', 'performance efficiency', 'compatibility', 'interaction capability', 'reliability', 'security', 'maintainability', 'flexibility', 'safety', 'cost']

it.each(systems)('the ranking of $system is complete, strict and signed', ({ system }) => {
  const ranking = JSON.parse(readFileSync(\`quality/\${system}/ranking.json\`, 'utf8'))
  const order: string[] = ranking.order.map((q: string) => q.toLowerCase())
  expect([...order].sort(), 'each of the ten exactly once, nothing else').toEqual([...RANKED].sort())
  expect(order[0], 'the leading quality first').toBe('{{LEAD}}')
  expect('{{APPROVERS}}'.split(/,\\s*/).filter((role) => !ranking.approvedBy?.[role]), 'roles without a signer').toEqual([])
  expect(ranking.reviewed, 'review date').toMatch(/^\\d{4}-\\d{2}-\\d{2}$/)
})`,
    },
    {
      id: 'ff-review-calendar', label: 'Ranking reviewed within the period', when: { REVIEW: ['calendar'] }, category: 'process', implements: LEADS, checks: ['req-review-calendar'],
      threshold: '0 ranking files whose review date is more than {{REVIEW_MONTHS}} months old',
      description: 'A step of the main-branch and nightly builds reads the review date of every ranking file and fails, naming the file, when it is older than the period.',
      tool: 'jq 1.6 or later (strptime, mktime, now) in a shell step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
months={{REVIEW_MONTHS}}
status=0
for f in quality/*/ranking.json; do
  if ! jq -e --argjson m "$months" '(.reviewed | strptime("%Y-%m-%d") | mktime) > (now - $m * 30.44 * 86400)' "$f" > /dev/null; then
    echo "$f: last reviewed $(jq -r .reviewed "$f"), more than $months months ago; review and sign the ranking again"
    status=1
  fi
done
exit $status`,
    },
    {
      id: 'ff-review-release', label: 'Ranking reviewed since the last major release', when: { REVIEW: ['release'] }, category: 'process', implements: LEADS, checks: ['req-review-release'],
      threshold: '0 ranking files reviewed before the date of the previous major release when a major release is tagged',
      description: 'The release job, run on a pushed tag vN.0.0 with the full history checked out, finds the major tag just below it in version order, takes the date of its commit and fails when any ranking was last reviewed before it.',
      tool: 'git (tag --sort=v:refname, log --format=%cs), awk and jq in a step of the release workflow (actions/checkout with fetch-depth: 0)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
tag="\${GITHUB_REF_NAME:?run on a pushed tag vN.0.0}"
previous=$(git tag --list 'v[0-9]*.0.0' --sort=v:refname | awk -v t="$tag" '$0 == t { found = prev } { prev = $0 } END { print found }')
[ -n "$previous" ] || { echo "first major release: the ranking only has to exist"; exit 0; }
since=$(git log -1 --format=%cs "$previous")
status=0
for f in quality/*/ranking.json; do
  reviewed=$(jq -r .reviewed "$f")
  if [[ "$reviewed" < "$since" ]]; then
    echo "$f: last reviewed $reviewed, before $previous ($since); review the ranking for $tag"
    status=1
  fi
done
exit $status`,
    },
    {
      id: 'ff-qas', label: 'Scenarios complete and the leading quality measured', when: WRITTEN, category: 'structural', implements: ['adr-utility-tree', 'adr-qas'], checks: ['req-qas-form', 'req-lead-scenarios'],
      threshold: 'Every requirement labelled "<characteristic>: …" has a trigger, a number with a unit in its action and an element that satisfies it; at least {{LEAD_SCENARIOS}} of them are for {{LEAD}}',
      description: 'A test reads the requirements of the architecture model whose label starts with a characteristic of the ranking and a colon, and checks each for the parts a script can see: the trigger (source and stimulus), a response measure with a number and a unit in the action, and a satisfies relation from the element it is about (the artifact). It then counts those of the leading quality.',
      tool: 'Vitest with js-yaml over the Radical Markdown folder and its relations.json',
      language: 'ts',
      snippet: `${MODEL_HEAD}
const relations: Array<{ relationType: string; targetId: string }> = JSON.parse(readFileSync('architecture/relations.json', 'utf8'))
const RANKED = ['functional suitability', 'performance efficiency', 'compatibility', 'interaction capability', 'reliability', 'security', 'maintainability', 'flexibility', 'safety', 'cost']
const quality = (label: string) => RANKED.find((q) => label.toLowerCase().startsWith(\`\${q}:\`))
const scenarios = nodes.filter((n) => n.type === 'requirement' && quality(String(n.label)))

it.each(scenarios.map((n) => ({ label: n.label, n })))('$label has its parts', ({ n }) => {
  expect(n.trigger, 'the source and the stimulus, in the trigger').toBeTruthy()
  expect(n.action, 'the response and its measure: a number with a unit').toMatch(/\\d+(?:[.,]\\d+)?\\s*(?:%|[a-zµ]+)/i)
  expect(relations.some((r) => r.relationType === 'satisfies' && r.targetId === n.id), 'the artifact: an element that satisfies it').toBe(true)
})

it('the leading quality has its scenarios', () => {
  expect(scenarios.filter((n) => quality(String(n.label)) === '{{LEAD}}').length).toBeGreaterThanOrEqual({{LEAD_SCENARIOS}})
})`,
    },
    {
      id: 'ff-utility-tree', label: 'Utility tree complete', when: { METHOD: ['atam'] }, category: 'structural', implements: ['adr-utility-tree'], checks: ['req-utility-tree'],
      threshold: 'For every system of the model, quality/<system>/utility-tree.yaml exists, each leaf names a requirement of the model and is rated H, M or L for importance and risk, and at least 1 leaf of importance H sits under {{LEAD}}',
      description: 'A test reads each system\'s utility tree: characteristics at the top, concerns below, and lists of leaves with scenario (a requirement label), importance and risk, for example "reliability: { availability: [ { scenario: \'Reliability: checkout survives the loss of a zone\', importance: H, risk: M } ] }". It fails on a missing file, a leaf naming no requirement, a rating outside H, M and L, or no H leaf for the leading quality.',
      tool: 'Vitest with js-yaml over the Radical Markdown folder and the utility-tree files',
      language: 'ts',
      snippet: `${MODEL_HEAD}
${SYSTEMS}
type Leaf = { scenario: string; importance: string; risk: string }
const requirements = new Set(nodes.filter((n) => n.type === 'requirement').map((n) => n.label))

it.each(systems)('the utility tree of $system is complete', ({ system }) => {
  const tree = load(readFileSync(\`quality/\${system}/utility-tree.yaml\`, 'utf8'), { schema: JSON_SCHEMA }) as Record<string, Record<string, Leaf[]>>
  const leaves = Object.entries(tree).flatMap(([quality, concerns]) => Object.values(concerns).flat().map((leaf) => ({ quality, ...leaf })))
  for (const leaf of leaves) {
    expect(requirements.has(leaf.scenario), \`\${leaf.scenario}: no such requirement in the model\`).toBe(true)
    expect(\`\${leaf.importance},\${leaf.risk}\`, leaf.scenario).toMatch(/^[HML],[HML]$/)
  }
  expect(leaves.some((l) => l.quality.toLowerCase() === '{{LEAD}}' && l.importance === 'H'), 'an H leaf for the leading quality').toBe(true)
})`,
    },
    {
      id: 'ff-anchors', label: 'Top three qualities point to their numbers', when: { METHOD: ['ranking'] }, category: 'structural', implements: ['adr-ranking-only'], checks: ['req-anchors'],
      threshold: 'For every system, each of the first 3 entries of the ranking names in measuredBy a requirement of the model whose action holds a number with a unit',
      description: 'A test reads each ranking file\'s measuredBy (characteristic to requirement label, for example "reliability": "Checkout stays available") and looks the requirement up in the architecture model.',
      tool: 'Vitest with js-yaml over the Radical Markdown folder',
      language: 'ts',
      snippet: `${MODEL_HEAD}
${SYSTEMS}

it.each(systems)('the top three qualities of $system point to their numbers', ({ system }) => {
  const ranking = JSON.parse(readFileSync(\`quality/\${system}/ranking.json\`, 'utf8'))
  for (const q of ranking.order.slice(0, 3) as string[]) {
    const requirement = nodes.find((n) => n.type === 'requirement' && n.label === ranking.measuredBy?.[q])
    expect(requirement, \`\${q}: measuredBy names no requirement of the model\`).toBeDefined()
    expect(requirement!.action, \`\${q}: the requirement holds no number with a unit\`).toMatch(/\\d+(?:[.,]\\d+)?\\s*(?:%|[a-zµ]+)/i)
  }
})`,
    },
    {
      id: 'ff-tradeoffs', label: 'ADRs name their trade-offs', when: { TRADEOFFS: ['line'] }, category: 'process', implements: LEADS, checks: ['req-tradeoff-line', 'req-tradeoff-exception'],
      threshold: '0 ADRs accepted since the ranking was adopted without a Favours line, naming an entry outside the ranking, or favouring a lower-ranked characteristic without an Exception line',
      description: 'A test reads the ADRs of the architecture model with status accepted and a date on or after the ranking\'s "adopted" date, finds the line "Favours: … / At the cost of: …" in their consequences and compares the names with the ranking. With several systems in one repository, run it once per ranking file (RANKING=quality/<system>/ranking.json).',
      tool: 'Vitest with js-yaml over the Radical Markdown folder',
      language: 'ts',
      snippet: `${MODEL_HEAD}
const ranking = JSON.parse(readFileSync(process.env.RANKING ?? \`quality/\${readdirSync('quality')[0]}/ranking.json\`, 'utf8'))
const order: string[] = ranking.order.map((q: string) => q.toLowerCase())
const names = (s: string) => s.toLowerCase().split(/,\\s*/).map((q) => q.trim()).filter((q) => q !== 'none')
const adrs = nodes.filter((n) => n.type === 'adr' && n.status === 'accepted' && String(n.date ?? '') >= ranking.adopted)

it.each(adrs.map((a) => ({ label: a.label, a })))('$label names what it trades', ({ a }) => {
  const line = String(a.consequences ?? '').match(/^[•*-]?\\s*Favours:\\s*(.+?)\\s*\\/\\s*At the cost of:\\s*(.+)$/m)
  expect(line, 'a line "Favours: … / At the cost of: …" in the consequences').toBeTruthy()
  const [favours, costs] = [names(line![1]), names(line![2])]
  expect([...favours, ...costs].filter((q) => !order.includes(q)), 'names outside the ranking').toEqual([])
  if (favours.some((f) => costs.some((c) => order.indexOf(f) > order.indexOf(c))))
    expect(a.consequences, 'favours a lower-ranked quality: add "Exception: <who approved>, <date>"').toMatch(/^[•*-]?\\s*Exception:\\s*\\S/m)
})`,
    },
  ],
}

export default pack
