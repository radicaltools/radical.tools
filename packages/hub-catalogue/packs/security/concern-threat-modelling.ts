import type { PackSpec, When } from '../../src/packSpec'

const CADENCE = ['adr-on-change', 'adr-per-release', 'adr-yearly']
const STRIDE: When = { METHOD: ['stride', 'stride-linddun'] }
const REGISTER: When = { WHERE: ['pytm', 'register'] }
const FORCES = 'People and other systems reach this element across a trust boundary, and every boundary is a place where data can be read, changed, faked or denied. The forces: a design flaw found in a threat model costs a conversation, the same flaw found in production costs an incident; a threat model made once and filed away describes a system that no longer exists, while one redone on every change costs time in the changes that matter most; a method gives the team a shared list of what can go wrong, but each method sees some threats and misses others (STRIDE sees attackers, not privacy harms; LINDDUN sees privacy, not tampering; PASTA weighs risk to the business but takes longer); a threat model kept where the code is gets reviewed with it, one kept in a tool nobody opens does not; and a threat nobody mitigated must still end somewhere: accepted by a named person until a date, or carried by a party under contract, never left open by default. The mitigations themselves are decided in the Authentication, Authorization, Encryption, Rate limiting and Software supply chain packs; who facilitates the sessions in the Secure development process pack.'

const pack: PackSpec = {
  id: 'concern-threat-modelling',
  name: 'Threat modelling',
  group: 'security',
  description: 'How the threats to an element reached across a trust boundary are found and ended: when the threat model is made and redone, with which method, where it lives, and how each threat ends (mitigated, accepted by a named owner until a date, or transferred). The snippets are Node and Python scripts and shell steps for GitHub Actions.',
  tags: ['security', 'threat modelling', 'stride', 'linddun', 'pasta', 'threat dragon', 'pytm'],
  concern: {
    id: 'threat-modelling',
    trigger: 'LIST RELATIONS WHERE (source.type = "person" OR source.external = true) AND target.external != true AND (target.type = "system" OR target.type = "container" OR target.type = "webapp" OR target.type = "component")',
    applyTo: 'target',
    why: 'people or external systems reach these elements across a trust boundary, so how their threats are found and ended has to be decided.',
  },
  sources: [
    { title: 'Threat Modeling Manifesto', url: 'https://www.threatmodelingmanifesto.org/' },
    { title: 'OWASP Threat Modeling Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html' },
    { title: 'Adam Shostack: Threat Modeling: Designing for Security (Wiley, 2014)', url: 'https://www.wiley.com/en-us/Threat+Modeling%3A+Designing+for+Security-p-9781118809990' },
    { title: 'Microsoft Threat Modeling Tool: threats (the STRIDE model)', url: 'https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats' },
    { title: 'LINDDUN privacy threat modeling framework: threat types', url: 'https://linddun.org/threat-types/' },
    { title: 'Tony UcedaVélez, Marco M. Morana: Risk Centric Threat Modeling: Process for Attack Simulation and Threat Analysis (Wiley, 2015)', url: 'https://www.wiley.com/en-us/Risk+Centric+Threat+Modeling%3A+Process+for+Attack+Simulation+and+Threat+Analysis-p-9780470500965' },
    { title: 'NIST SP 800-218, Secure Software Development Framework (SSDF) 1.1', url: 'https://csrc.nist.gov/pubs/sp/800/218/final' },
    { title: 'OWASP Threat Dragon documentation', url: 'https://www.threatdragon.com/docs/' },
    { title: 'OWASP pytm', url: 'https://github.com/OWASP/pytm' },
  ],
  questions: [
    {
      key: 'WHEN', title: 'When', label: 'When is the threat model made and redone?',
      hint: 'A threat model describes the system as it was when it was made. How often it is redone decides how long a new caller, data store or third party can run with nobody having asked what could go wrong there. Every answer makes the first threat model before the first release.',
      default: 'change',
      options: [
        { value: 'change', label: 'on every change to a trust boundary', description: 'Every pull request that adds or moves a trust boundary (a new external caller, a new data store, a new third party) changes the threat model too, and gets a security review. Pick it when boundaries change during the release cycle and the files that define them can be named (infrastructure code, route tables, the API description).' },
        { value: 'release', label: 'once per release', description: 'Before each release is tagged, the team reviews the changes since the previous release against the threat model and commits the review. Pick it when releases come every few weeks and boundaries are defined in places no path list can catch.' },
        { value: 'yearly', label: 'once a year per system', description: 'Each system\'s threat model is reviewed at least once every 12 months, in a session on the calendar. Pick it only for stable systems whose boundaries rarely change, or where a yearly review is all a standard asks; boundaries added between reviews wait for the next one.' },
      ],
    },
    {
      key: 'METHOD', title: 'Method', label: 'With which method are threats found?',
      hint: 'The method decides which threats the team looks for and how each is recorded. STRIDE is the common starting point; LINDDUN adds the privacy harms STRIDE does not name; PASTA starts from the business and ranks threats by risk.',
      default: 'stride',
      options: [
        { value: 'stride', label: 'STRIDE per element and data flow', description: 'A data-flow diagram with its trust boundaries, then each element and flow examined for spoofing, tampering, repudiation, information disclosure, denial of service and elevation of privilege. Pick it for most systems: it is quick to learn and every tool supports it.' },
        { value: 'stride-linddun', label: 'STRIDE per element and data flow, with LINDDUN for privacy threats', description: 'STRIDE for security threats, and the seven LINDDUN categories (linking, identifying, non-repudiation, detecting, data disclosure, unawareness and unintervenability, non-compliance) on the same diagram for privacy threats. Pick it when the system handles personal data, so harms to the people in the data are looked for, not only attacks on the system.' },
        { value: 'pasta', label: 'PASTA, risk-centric', description: 'The seven stages of the Process for Attack Simulation and Threat Analysis: business objectives first, attack scenarios against them, and every threat scored by likelihood and impact. Pick it when the business wants threats ranked by risk to its objectives (finance, regulated services) and the team can afford the longer process.' },
      ],
    },
    {
      key: 'WHERE', title: 'Where', label: 'Where does the threat model live?',
      hint: 'Every answer keeps the threat model in the repository, so it is reviewed with the code and read by the checks; the answer picks its form. A commercial platform keeps it outside the repository, which these checks cannot read; that is listed among the alternatives.',
      default: 'dragon',
      options: [
        { value: 'dragon', label: 'OWASP Threat Dragon models in the repository', description: 'One Threat Dragon model per system as JSON in threat-model/, drawn in the Threat Dragon desktop or web app, with threats, their category, severity, status and mitigation on the diagram\'s elements; acceptances and transfers in a small YAML file beside them. Pick it when the people who model prefer drawing to code.' },
        { value: 'pytm', label: 'OWASP pytm models with a triaged threat register', description: 'Each system described in Python with pytm (elements, trust boundaries, data flows); pytm generates candidate threats from its library and draws the diagram, and every finding is triaged in a YAML register beside it. Pick it when the team prefers code and wants threats suggested from the model, and accepts triaging pytm\'s findings.' },
        { value: 'register', label: 'a YAML threat register beside a data-flow diagram', description: 'Per system a folder with a Mermaid data-flow diagram in README.md and the threats in threats.yaml, written by hand. Pick it for few, small systems, or when no tool is wanted beyond the repository.' },
      ],
    },
    {
      key: 'UNMITIGATED', title: 'Unmitigated', label: 'What stops a threat that is not mitigated?',
      hint: 'A threat ends mitigated, transferred to a party under contract, or accepted by a named owner until a date. This decides whether an acceptance is enough for every threat, or whether a high or critical one must be mitigated or transferred before a release.',
      default: 'expiry',
      options: [
        { value: 'expiry', label: 'the expiry of its acceptance', description: 'Any threat may be accepted by a named owner with a reason, until an expiry date; past that date the build fails until it is mitigated, transferred or accepted again. Pick it when the owner of the risk should be free to weigh it, and the expiry is enough to bring it back.' },
        { value: 'release-block', label: 'the expiry of its acceptance, and a blocked release for a high or critical threat', description: 'The same expiry, and no release while a high or critical threat is open or accepted: those must be mitigated or transferred first. Pick it for systems where a high threat in production would be a reportable incident (personal, financial or health data).' },
      ],
    },
  ],
  details: [
    { key: 'BOUNDARY_PATHS', label: 'Which paths define a trust boundary (git pathspecs, separated by spaces)? (on every change to a trust boundary only)', default: 'infra/ src/routes/ openapi.yaml' },
    { key: 'ACCEPT_DAYS', label: 'For at most how many days may a threat be accepted before it must be decided again?', default: '180', number: true },
  ],
  need: {
    label: 'Threats are found and ended before attackers find them',
    text: 'People and other systems reach this element across a trust boundary. Before a new caller, data store or third party goes live, someone has to have asked what can go wrong there, and each answer has to end somewhere: a control that mitigates it, a party that carries it under contract, or a named person who accepts it until a date. The threat model has to stay as current as the boundaries it describes. The snippets assume the threat models under threat-model/ (threat-model/<system>.json for Threat Dragon, threat-model/<system>/ for pytm and the register), the architecture model as a Markdown folder under architecture/ (nodes/**/*.md and relations.json), scripts under scripts/ run by Node 20 with js-yaml or Python 3 with PyYAML, reports/threats.json as the one list of threats the reader of the chosen form writes, and GitHub as the code host.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-redo-change', label: 'Boundary changes update the threat model', when: { WHEN: ['change'] }, ears_type: 'event-driven',
      trigger: 'a pull request changes a file that defines a trust boundary ({{BOUNDARY_PATHS}}): a new external caller, a new data store, a new third party, or a moved boundary',
      action: 'change the system\'s threat model under threat-model/ in the same pull request, and give that pull request the security-review label, so that it merges only after the security review the Secure development process pack sets up',
      rationale: 'Threat modelling is most useful early and often, following design changes in manageable steps (Threat Modeling Manifesto, principles); the model must be kept up to date as the system changes (OWASP Threat Modeling Cheat Sheet; NIST SP 800-218 PW.1.1).',
      scenario: { label: 'New partner route modelled', given: 'a pull request that adds a route for a new partner under one of {{BOUNDARY_PATHS}}', when: 'its checks run', then: 'they fail until the same pull request changes threat-model/ and carries the security-review label' },
    },
    {
      id: 'req-redo-release', label: 'Each release reviews the threat model', when: { WHEN: ['release'] }, ears_type: 'event-driven',
      trigger: 'a release is tagged',
      action: 'publish it only when threat-model/ has a commit after the previous release tag, the record of that release\'s threat-model review',
      rationale: 'The threat model is kept current as the system changes (OWASP Threat Modeling Cheat Sheet; NIST SP 800-218 PW.1.1); a review per release is the step the Manifesto asks for, sized to the release.',
      scenario: { label: 'Release without review stopped', given: 'a release tag with no commit to threat-model/ since the previous tag', when: 'the release job runs', then: 'it fails, and it passes once the review is committed and the release is tagged again' },
    },
    {
      id: 'req-redo-yearly', label: 'Threat models reviewed every year', when: { WHEN: ['yearly'] }, ears_type: 'ubiquitous',
      action: 'review the threat model of each system at least once every 12 months, recording the review as a commit to that system\'s model',
      rationale: 'A yearly review is the least that keeps a model from describing a system that no longer exists; the Manifesto prefers continuous refinement to a single delivery, which this answer accepts as a cost (Threat Modeling Manifesto, values; NIST SP 800-218 PW.1.1).',
      scenario: { label: 'Stale model reported', given: 'a system whose threat model was last committed 13 months ago', when: 'the monthly job runs', then: 'it fails naming the system and the date of the last review' },
    },
    {
      id: 'req-in-repo', label: 'Threat model kept in the repository', ears_type: 'ubiquitous',
      action: 'keep each system\'s threat model in the repository under threat-model/ as {{WHERE}}, in a form the pipeline reads into one list of threats (reports/threats.json) on every pull request, and change it only through pull requests',
      rationale: 'Documents record the shared understanding and make it measurable (Threat Modeling Manifesto, principles); kept with the code, the model is reviewed and versioned with what it describes, and available to those who need it (OWASP Threat Modeling Cheat Sheet).',
      scenario: { label: 'Model read on every change', given: 'a pull request', when: 'the pipeline runs', then: 'the reader of the threat model writes reports/threats.json with every threat of every system, and fails on a model it cannot read' },
    },
    {
      id: 'req-pytm-triaged', label: 'Every pytm finding triaged', when: { WHERE: ['pytm'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'pytm generates a finding from a system\'s tm.py that the system\'s threats.yaml does not list by its threat id and element',
      action: 'fail the build, naming the finding, until it is triaged in threats.yaml with a category, a severity and a status',
      rationale: 'pytm suggests threats from its library; a suggestion nobody looked at is neither a threat found nor one ruled out (OWASP pytm; OWASP Threat Modeling Cheat Sheet: what are we going to do about it).',
      scenario: { label: 'New finding waits for triage', given: 'a change to tm.py that adds a data store', when: 'pytm generates findings for it', then: 'the build fails naming each new finding until threats.yaml lists it with a category, a severity and a status' },
    },
    {
      id: 'req-external-callers', label: 'Every outside caller in the threat model', ears_type: 'ubiquitous',
      action: 'name in the threat model every person and every external system that the architecture model shows calling one of the system\'s elements',
      rationale: 'Each outside caller is an entry point across a trust boundary; one missing from the threat model is a boundary nobody examined (Shostack, Threat Modeling, ch. 2: what are you building; OWASP Threat Modeling Cheat Sheet: system modeling).',
      scenario: { label: 'New caller missing', given: 'an architecture model with a new external system that calls the system', when: 'the check runs over the architecture model and threat-model/', then: 'it fails naming that system until the threat model names it' },
    },
    {
      id: 'req-statuses', label: 'Every threat has a status that ends it', ears_type: 'ubiquitous',
      action: 'give every threat an id, the element or data flow it threatens, a severity of low, medium, high or critical, and one status: mitigated, naming the test, ADR or ticket that carries the control; transferred, naming the party that carries the risk and the contract or policy that says so; accepted; not applicable, with the reason; or open, naming the ticket that will close it',
      rationale: 'Each threat gets a response (mitigate, eliminate, transfer or accept) and the response is recorded; a transfer does not lower the risk, so who carries it must be written down (OWASP Threat Modeling Cheat Sheet, response and mitigations).',
      scenario: { label: 'Unended threat refused', given: 'a threat marked mitigated with no reference, and one marked transferred with no party', when: 'the check runs', then: 'it fails naming both threats' },
    },
    {
      id: 'req-acceptance', label: 'Acceptances have an owner and an expiry', ears_type: 'event-driven',
      trigger: 'a threat is accepted',
      action: 'record its risk owner by name (a person, not a team), the reason, the date of the acceptance and an expiry date at most {{ACCEPT_DAYS}} days later',
      rationale: 'Accepting a risk is a decision someone takes for the business; with a name and a date it is visible and comes back for a new decision (OWASP Threat Modeling Cheat Sheet: accept; Threat Modeling Manifesto: a culture of finding and fixing over checkbox compliance).',
      scenario: { label: 'Acceptance without owner refused', given: 'a threat accepted by a team handle, and one accepted for {{ACCEPT_DAYS}} days and one more', when: 'the check runs', then: 'it fails naming both acceptances' },
    },
    {
      id: 'req-expired', label: 'Expired acceptances fail the build', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an accepted threat passes its expiry date',
      action: 'fail the main branch\'s build and every pull request\'s, naming the threat and its owner, until the threat is mitigated, transferred or accepted again by its owner with a new expiry',
      rationale: 'An acceptance that never expires is a threat nobody will look at again; failing the build makes the renewal a decision instead of a habit (OWASP Threat Modeling Cheat Sheet: residual risk).',
      scenario: { label: 'Expired acceptance stops the build', given: 'a threat accepted until yesterday', when: 'the nightly build of the main branch runs', then: 'it fails naming the threat and its owner' },
    },
    {
      id: 'req-high-blocks', label: 'No release with a high threat open or accepted', when: { UNMITIGATED: ['release-block'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a threat of high or critical severity is open or accepted when a release is built',
      action: 'stop the release, naming the threat, until it is mitigated or transferred',
      rationale: 'For the threats that would be an incident, an accepted risk is not enough: the release waits for a control or a party who carries it (OWASP Threat Modeling Cheat Sheet: mitigate, transfer).',
      scenario: { label: 'High threat stops release', given: 'a high threat accepted until next month', when: 'the release job runs', then: 'it fails naming the threat, and passes once the threat is mitigated' },
    },
    {
      id: 'req-stride', label: 'Threats classified by STRIDE', when: STRIDE, ears_type: 'ubiquitous',
      action: 'find threats per element and data flow of the diagram, and record each security threat under exactly one of the six STRIDE categories: spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege',
      rationale: 'STRIDE gives every team the same list of what can go wrong, and applied per element it walks every part of the diagram (Microsoft Threat Modeling Tool, the STRIDE model; Shostack, Threat Modeling, ch. 3).',
      scenario: { label: 'Uncategorised threat refused', given: 'a threat with no category, and one with the category "injection"', when: 'the check runs', then: 'it fails naming both threats' },
    },
    {
      id: 'req-linddun', label: 'Privacy threats under LINDDUN', when: { METHOD: ['stride-linddun'] }, ears_type: 'ubiquitous',
      action: 'examine every data flow and store that carries personal data under the seven LINDDUN categories (linking, identifying, non-repudiation, detecting, data disclosure, unawareness and unintervenability, non-compliance), so that each category appears in every system\'s threat model as a threat or as a not-applicable entry with its reason',
      rationale: 'LINDDUN names the privacy harms that STRIDE does not, such as linking records to a person or detecting that a person is in the data (LINDDUN threat types; OWASP Threat Modeling Cheat Sheet).',
      scenario: { label: 'Privacy category skipped', given: 'a system whose threat model has no threat and no not-applicable entry under detecting', when: 'the check runs', then: 'it fails naming the system and the category' },
    },
    {
      id: 'req-pasta', label: 'Threats scored against business objectives', when: { METHOD: ['pasta'] }, ears_type: 'ubiquitous',
      action: 'list the business objectives and the attack scenarios against them in threat-model/objectives/<system>.md, and give every threat a risk score of likelihood times impact (each 1 to 5) with its severity following the score: low 1 to 5, medium 6 to 11, high 12 to 19, critical 20 to 25',
      rationale: 'PASTA starts from the business objectives (stage 1), simulates attacks against them (stage 6) and ranks the threats by risk and impact (stage 7), so what is fixed first is what would hurt the business most (UcedaVélez and Morana, Risk Centric Threat Modeling).',
      scenario: { label: 'Unscored threat refused', given: 'a threat with no score, and one scored 16 but rated medium', when: 'the check runs', then: 'it fails naming both threats' },
    },
  ],
  adrs: [
    {
      id: 'adr-on-change', label: 'Threat model redone on every change to a trust boundary', when: { WHEN: ['change'] },
      decision: 'Each system that people or external systems reach has one threat model, made before its first release and redone in the pull request that adds or moves a trust boundary: a new external caller, a new data store, a new third party, a changed path between zones. The files that define a trust boundary are {{BOUNDARY_PATHS}}; a pull request check fails while the last change to one of them is newer than the last change to threat-model/, and a pull request that changes threat-model/ carries the security-review label, whose reviewers the Secure development process pack names. Method: {{METHOD}}. Form: {{WHERE}}. Each threat ends mitigated, transferred, or accepted by a named owner until a date at most {{ACCEPT_DAYS}} days away; what stops a threat that is not mitigated: {{UNMITIGATED}}. Findings from scanners and tests follow the Secure coding pack, not this register.',
      consequences: '• The threat model stays as current as the boundaries in the code; a new partner or data store is examined before it merges.\n• The pull requests that touch a boundary take longer: an hour for a new route, a session for a new third party.\n• The list of paths must stay true: a boundary defined elsewhere (a cloud console, another repository) escapes the check, so the review still asks.\n• Git dates prove the model was changed, not that it was thought through; the security review carries that.',
      alternatives: '1. Once per release: fewer sessions, but a boundary added early in a release runs unexamined until the release.\n2. Once a year: cheapest, and a snapshot of a system that keeps changing (Threat Modeling Manifesto: continuous refinement over a single delivery).\n3. A threat model per feature: finer grained, but threats that cross features (a shared store, a partner calling two features) are nowhere in full.',
    },
    {
      id: 'adr-per-release', label: 'Threat model reviewed once per release', when: { WHEN: ['release'] },
      decision: 'Each system that people or external systems reach has one threat model, made before its first release and reviewed before each later release is tagged: the team walks through the changes since the previous tag, updates the model and commits the review to threat-model/ (at least the reviewer and date in the model). The release job fails when threat-model/ has no commit since the previous tag. Method: {{METHOD}}. Form: {{WHERE}}. Each threat ends mitigated, transferred, or accepted by a named owner until a date at most {{ACCEPT_DAYS}} days away; what stops a threat that is not mitigated: {{UNMITIGATED}}. Findings from scanners and tests follow the Secure coding pack, not this register.',
      consequences: '• One planned session per release, which the release job enforces.\n• A boundary added early in a release runs unexamined until the release is tagged.\n• A release with no boundary change still needs a commit, a small ritual that keeps the check honest.\n• With continuous deployment there is no release to hang the review on; the change-driven answer fits better there.',
      alternatives: '1. On every change to a trust boundary: current all the time, but every boundary change waits for the model.\n2. Once a year: cheaper, and up to a year behind the code.',
    },
    {
      id: 'adr-yearly', label: 'Threat model reviewed once a year', when: { WHEN: ['yearly'] },
      decision: 'Each system that people or external systems reach has one threat model, made before its first release and reviewed at least once every 12 months in a session on the team\'s calendar; the review is committed to the system\'s model, and a monthly job fails when a system\'s model has no commit for 365 days. Boundaries added between reviews wait for the next one: this decision accepts that. Method: {{METHOD}}. Form: {{WHERE}}. Each threat ends mitigated, transferred, or accepted by a named owner until a date at most {{ACCEPT_DAYS}} days away; what stops a threat that is not mitigated: {{UNMITIGATED}}. Findings from scanners and tests follow the Secure coding pack, not this register.',
      consequences: '• The cheapest rhythm: one session per system per year.\n• A new third party or data store can run for up to a year before anyone asks what can go wrong there.\n• It fits stable systems and standards that ask for a yearly review; it is the snapshot the Manifesto warns about.\n• The first change to a boundary that worries someone should bring the review forward, by hand.',
      alternatives: '1. Once per release: tied to what actually changes.\n2. On every change to a trust boundary: current all the time, at a cost in the changes that touch boundaries.',
    },
    {
      id: 'adr-stride', label: 'Threats found with STRIDE per element', when: { METHOD: ['stride'] },
      decision: 'Threats are found with STRIDE per element and data flow: first the data-flow diagram with its trust boundaries (what are we working on), then each element and flow examined under the STRIDE categories that apply to its type, and every security threat recorded under one of the six categories: spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege. Privacy harms that are not attacks (linking records to a person, a person unaware of the processing) are out of this method; a system that starts handling personal data supersedes this decision with STRIDE and LINDDUN.',
      consequences: '• Quick to learn: the Elevation of Privilege card game and every tool teach it.\n• Every threat has a category, so a category nobody looked at shows up in review.\n• STRIDE finds threats, it does not rank them: the severity is the team\'s judgement.\n• Privacy harms to the people in the data are not looked for.',
      alternatives: '1. STRIDE with LINDDUN: the same, plus privacy threats; more time per data flow with personal data.\n2. PASTA: ranks threats by risk to the business, at the cost of a longer process.\n3. Attack trees alone: deep on one goal, but no list that walks the whole diagram.',
    },
    {
      id: 'adr-stride-linddun', label: 'Threats found with STRIDE, privacy threats with LINDDUN', when: { METHOD: ['stride-linddun'] },
      decision: 'Security threats are found with STRIDE per element and data flow and recorded under its six categories; privacy threats are found with LINDDUN on the same diagram, on every data flow and store that carries personal data, and recorded under its seven categories, written as: linking, identifying, non-repudiation, detecting, data disclosure, unawareness & unintervenability, non-compliance (Threat Dragon\'s older names linkability, identifiability, detectability, disclosure of information and unawareness are read as these). Each system\'s threat model considers every LINDDUN category at least once, as a threat or as a not-applicable entry with its reason. Which data is personal is recorded as the Data classification pack decides.',
      consequences: '• Harms to the people in the data are looked for, not only attacks on the system.\n• Each flow with personal data takes longer: thirteen categories instead of six.\n• Non-repudiation means opposite things in the two methods (a STRIDE control, a LINDDUN threat to the person): the category names keep them apart.\n• Not-applicable entries with reasons show that a category was considered, which a privacy review can read.',
      alternatives: '1. STRIDE alone: quicker, and blind to privacy harms that are not attacks.\n2. A separate data protection impact assessment only: required by law in some cases, but done once and away from the design.\n3. PASTA: risk-ranked, with no privacy categories of its own.',
    },
    {
      id: 'adr-pasta', label: 'Threats found and ranked with PASTA', when: { METHOD: ['pasta'] },
      decision: 'Threats are found with PASTA, the seven-stage Process for Attack Simulation and Threat Analysis: (1) business objectives, (2) technical scope, (3) decomposition into the data-flow diagram, (4) threat analysis, (5) weaknesses, (6) attack scenarios, (7) risk and impact. Stages 1 and 6 are written in threat-model/objectives/<system>.md under the headings Business objectives and Attack scenarios; every threat carries a risk score of likelihood times impact, each from 1 to 5, and its severity follows the score: low 1 to 5, medium 6 to 11, high 12 to 19, critical 20 to 25. A threat may also name its STRIDE category, which nothing checks.',
      consequences: '• Threats are ranked by what they would cost the business, so the order of work is argued from the objectives.\n• The process is longer: the objectives and the attack scenarios need people from the business, not only engineers.\n• Likelihood and impact are estimates; the scale keeps them comparable, not exact.\n• Without fixed categories, completeness rests on the attack scenarios and the review.',
      alternatives: '1. STRIDE per element: quicker and complete over the diagram, but unranked.\n2. STRIDE with a separate risk rating (DREAD or CVSS): ranking without the business objectives.',
    },
    {
      id: 'adr-dragon', label: 'Threat models kept as OWASP Threat Dragon files', when: { WHERE: ['dragon'] },
      decision: 'Each system\'s threat model is an OWASP Threat Dragon 2 model, threat-model/<system>.json, drawn with the Threat Dragon desktop app or the web app and committed through pull requests. Threats sit on the diagram\'s elements and flows with their category (type), severity, status (Open, Mitigated, N/A) and mitigation, which for a mitigated threat names the test, ADR or ticket and for an open one the ticket. Acceptances and transfers, which Threat Dragon 2.6 cannot hold with an owner and an expiry, are kept in threat-model/risk-decisions.yaml by the threat\'s id. scripts/threats-dragon.mjs reads both into reports/threats.json for the checks.',
      consequences: '• People draw the model; no code to learn.\n• The JSON carries positions and styles, so diffs are long; review the diagram, not the diff.\n• Two files to keep in step for accepted and transferred threats; the reader joins them by id.\n• The development branch of Threat Dragon adds Accepted and Transferred statuses; the reader maps them already, and the register still holds the owner and the expiry.',
      alternatives: '1. OWASP pytm: the model as code with suggested threats, but code to write and findings to triage.\n2. A YAML register beside a Mermaid diagram: no tool at all, and no threats suggested.\n3. Threagile (YAML): its last release, 0.9.1, dates from July 2024.\n4. A commercial platform (ThreatModeler, which acquired IriusRisk in January 2026): libraries and workflows, but the model lives outside the repository and the checks would need an export.',
    },
    {
      id: 'adr-pytm', label: 'Threat models kept as OWASP pytm code', when: { WHERE: ['pytm'] },
      decision: 'Each system\'s threat model is code: threat-model/<system>/tm.py describes its elements, trust boundaries (Boundary) and data flows (Dataflow) with OWASP pytm (1.4), and pytm generates candidate threats from its threat library; python3 tm.py --dfd | dot -Tpng draws the diagram. Every finding is triaged in threat-model/<system>/threats.yaml by its threat id (finding) and element (pytm\'s target), with a category of the chosen method, severity, status and the fields the status needs; the triage lives in the register rather than in pytm\'s overrides, which replace the threat\'s text. scripts/threats_register.py runs each tm.py with --json, fails on an untriaged finding and writes reports/threats.json.',
      consequences: '• Threats are suggested from the model, so a new data store brings its threats with it.\n• Diffs are readable and the diagram is drawn from the code.\n• pytm\'s library is not classified by STRIDE or LINDDUN: the category is set in triage, and a library update can bring new findings to triage.\n• Needs Python and Graphviz in the pipeline, and someone who reads Python in every modelling session.',
      alternatives: '1. OWASP Threat Dragon: drawn, not coded, and nothing suggested.\n2. A YAML register beside a Mermaid diagram: no tool at all.\n3. Threagile: suggests threats from YAML, but its last release, 0.9.1, dates from July 2024.',
    },
    {
      id: 'adr-register', label: 'Threat models kept as a YAML register', when: { WHERE: ['register'] },
      decision: 'Each system\'s threat model is a folder threat-model/<system>/: README.md holds the data-flow diagram as a Mermaid flowchart with the trust boundaries as subgraphs, and threats.yaml lists the threats, each with id, element, category, threat, severity, status, mitigation (the test, ADR or ticket, the ticket of an open threat, or the reason it does not apply), and for an accepted threat owner, reason, accepted and expires, for a transferred one to and reference. scripts/threats_register.py reads every register into reports/threats.json and fails when a system has no diagram.',
      consequences: '• Nothing to install; GitHub renders the diagram and the register reads like a table.\n• Nothing suggests threats: completeness rests on the method and the session.\n• The diagram and the register can drift apart; the review of each change looks at both.',
      alternatives: '1. OWASP Threat Dragon: a drawing tool with threats on the diagram.\n2. OWASP pytm: threats suggested from the model in code.\n3. A document in a wiki: easy to write, outside the review of the code and unreadable by the checks.',
    },
    {
      id: 'adr-release-block', label: 'No release with a high threat open or accepted', when: { UNMITIGATED: ['release-block'] },
      decision: 'A threat of high or critical severity cannot ride into production on an acceptance: the release job reads reports/threats.json and fails while any high or critical threat is open or accepted, until it is mitigated or transferred. Low and medium threats may still be accepted by a named owner until their expiry, at most {{ACCEPT_DAYS}} days.',
      consequences: '• No high threat reaches production on a signature alone.\n• A release can wait on a mitigation; the severity becomes something people argue about, so the method\'s rating rules matter.\n• An urgent fix that is blocked by an unrelated high threat needs that threat transferred or mitigated first, or this decision superseded for the occasion, in writing.',
      alternatives: '1. Acceptance with expiry for every threat: faster releases, and a high threat can go live on one person\'s word.\n2. Blocking every open threat of any severity: thorough, and soon worked around by rating everything low.',
    },
  ],
  fitness: [
    {
      id: 'ff-fresh-change', label: 'Threat model newer than the last boundary change', when: { WHEN: ['change'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-on-change'], checks: ['req-redo-change'],
      threshold: 'The last commit to threat-model/ is no older than the last commit to {{BOUNDARY_PATHS}}; a pull request that changes threat-model/ carries the security-review label',
      description: 'A pull-request check compares git dates: the last commit that touched a file defining a trust boundary against the last commit that touched threat-model/. A boundary change without a model change fails; so does a change to the model without the security-review label, which the Secure development process pack\'s check then turns into a required security approval. Run it on opened, synchronize, labeled and unlabeled, with the full history checked out.',
      tool: 'git and jq in a GitHub Actions step (bash)',
      language: 'bash',
      snippet: `# pull-request check (on: pull_request, types opened, synchronize, labeled, unlabeled; actions/checkout with fetch-depth: 0)
set -euo pipefail
boundary=$(git log -1 --format=%ct HEAD -- {{BOUNDARY_PATHS}})
model=$(git log -1 --format=%ct HEAD -- threat-model/)
if [ -n "$boundary" ] && [ "\${model:-0}" -lt "$boundary" ]; then
  echo "A trust boundary changed after the threat model did:"
  git log -1 --format='  %h %cs %s' HEAD -- {{BOUNDARY_PATHS}}
  echo "Change threat-model/ in this pull request."
  exit 1
fi
if [ -n "$(git diff --name-only "origin/$GITHUB_BASE_REF...HEAD" -- threat-model/)" ] &&
   ! jq -e '.pull_request.labels | any(.name == "security-review")' "$GITHUB_EVENT_PATH" > /dev/null; then
  echo "threat-model/ changed: add the security-review label, so the change gets its security review before the merge"
  exit 1
fi
echo "the threat model is newer than every change to a trust boundary"`,
    },
    {
      id: 'ff-fresh-release', label: 'Threat model reviewed since the previous release', when: { WHEN: ['release'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'release', invocation: 'manual', implements: ['adr-per-release'], checks: ['req-redo-release'],
      threshold: 'threat-model/ has at least 1 commit after the previous release tag',
      description: 'The release job, running on the new tag before anything is published, finds the previous tag and fails when threat-model/ has no commit after it. The first release passes: the model made before it is checked by the other functions.',
      tool: 'git in a GitHub Actions release job (bash)',
      language: 'bash',
      snippet: `# release job, run on the new tag (actions/checkout with fetch-depth: 0): the threat model was reviewed since the previous release
set -euo pipefail
previous=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null) || { echo "first release: nothing to compare"; exit 0; }
since=$(git log -1 --format=%ct "$previous")
model=$(git log -1 --format=%ct HEAD -- threat-model/)
if [ "\${model:-0}" -le "$since" ]; then
  echo "threat-model/ has no commit since $previous: review the threat model and commit the review before this release"
  exit 1
fi
echo "threat model reviewed on $(git log -1 --format=%cs HEAD -- threat-model/), after $previous"`,
    },
    {
      id: 'ff-fresh-yearly', label: 'Every threat model reviewed within a year', when: { WHEN: ['yearly'] }, characteristic: 'security', scope: 'atomic', cadence: 'temporal', every: '365d', invocation: 'manual', implements: ['adr-yearly'], checks: ['req-redo-yearly'],
      threshold: '0 systems under threat-model/ whose last commit is more than 365 days old',
      description: 'A scheduled job runs monthly over each system\'s model (a folder threat-model/<system>/ or a file threat-model/<system>.json) and fails naming every one whose last commit is more than 365 days old, with the date of that commit.',
      tool: 'git in a scheduled GitHub Actions job (bash)',
      language: 'bash',
      snippet: `# scheduled job, monthly (actions/checkout with fetch-depth: 0): every system's threat model reviewed within a year
set -euo pipefail
limit=$(( $(date +%s) - 365 * 86400 ))
status=0
for model in threat-model/*/ threat-model/*.json; do
  [ -e "$model" ] || continue
  last=$(git log -1 --format=%ct HEAD -- "$model")
  if [ "\${last:-0}" -lt "$limit" ]; then
    echo "$model: last reviewed $(git log -1 --format=%cs HEAD -- "$model" | grep . || echo never), over a year ago"
    status=1
  fi
done
exit $status`,
    },
    {
      id: 'ff-dragon', label: 'Threat Dragon models read into one list', when: { WHERE: ['dragon'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-dragon'], checks: ['req-in-repo'],
      threshold: 'Every threat-model/*.json is a Threat Dragon 2 model and every threat on it is written to reports/threats.json, joined with its entry in threat-model/risk-decisions.yaml',
      description: 'A Node script reads each Threat Dragon model (version 2.x), takes every threat from the cells of every diagram with its element (a flow as source -> target: name), category, severity, status and mitigation, joins the acceptances and transfers from risk-decisions.yaml by threat id, and writes reports/threats.json for the other checks. It runs on every pull request; a file that is not a Threat Dragon 2 model fails it.',
      tool: 'Node 20 with js-yaml, reading the Threat Dragon 2 JSON format',
      language: 'js',
      snippet: `// scripts/threats-dragon.mjs: the Threat Dragon models and threat-model/risk-decisions.yaml into reports/threats.json
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import yaml from 'js-yaml'

const decisionsFile = 'threat-model/risk-decisions.yaml'   // [{ threat, decision: accepted | transferred, owner, reason, accepted, expires, to, reference }]
const decisions = existsSync(decisionsFile) ? yaml.load(readFileSync(decisionsFile, 'utf8')) ?? [] : []
const STATUS = { Mitigated: 'mitigated', Avoided: 'mitigated', Eliminated: 'mitigated', NotApplicable: 'not-applicable', Accepted: 'accepted', Transferred: 'transferred' }
const threats = []
for (const file of readdirSync('threat-model').filter((f) => f.endsWith('.json'))) {
  const model = JSON.parse(readFileSync(\`threat-model/\${file}\`, 'utf8'))
  if (!/^2\\./.test(model.version ?? '')) throw new Error(\`\${file}: not a Threat Dragon 2 model (version \${model.version})\`)
  for (const diagram of model.detail.diagrams) {
    const name = Object.fromEntries(diagram.cells.map((c) => [c.id, String(c.data?.name ?? '').replace(/\\s+/g, ' ')]))
    for (const cell of diagram.cells) for (const t of cell.data?.threats ?? []) {
      const element = cell.shape === 'flow' ? \`\${name[cell.source?.cell] ?? 'outside'} -> \${name[cell.target?.cell] ?? 'outside'}: \${name[cell.id]}\` : name[cell.id]
      const decision = decisions.find((d) => d.threat === t.id) ?? {}
      threats.push({ system: file.replace(/\\.json$/, ''), id: t.id, element, category: t.type, severity: String(t.severity ?? '').toLowerCase(),
        mitigation: t.mitigation ?? '', score: t.score, ...decision, status: decision.decision ?? STATUS[t.status] ?? 'open' })
    }
  }
}
mkdirSync('reports', { recursive: true })
writeFileSync('reports/threats.json', JSON.stringify(threats, null, 2))
console.log(\`\${threats.length} threats from \${new Set(threats.map((t) => t.system)).size} Threat Dragon models\`)`,
    },
    {
      id: 'ff-register', label: 'Threat registers read into one list, pytm findings triaged', when: REGISTER, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-pytm', 'adr-register'], checks: ['req-in-repo', 'req-pytm-triaged'],
      threshold: 'Every threat-model/<system>/threats.yaml is written to reports/threats.json; 0 pytm findings missing from their register; 0 hand-written registers without a Mermaid flowchart in README.md',
      description: 'A Python script reads every register into reports/threats.json. Where a system has a tm.py, it runs pytm with --json and fails on every finding (threat id and element) the register does not list; where it has none, it fails when README.md holds no Mermaid flowchart. It runs on every pull request.',
      tool: 'Python 3 with PyYAML, and OWASP pytm 1.4 (python3 tm.py --json) where a system has a tm.py',
      language: 'python',
      snippet: `# scripts/threats_register.py: each threat-model/<system>/threats.yaml into reports/threats.json; with pytm, every finding of tm.py triaged there
import json, pathlib, subprocess, sys
import yaml

threats, problems = [], []
pathlib.Path("reports").mkdir(exist_ok=True)
for register in sorted(pathlib.Path("threat-model").glob("*/threats.yaml")):
    system = register.parent
    entries = yaml.safe_load(register.read_text()) or []
    threats += [{**t, "system": system.name, "severity": str(t.get("severity", "")).lower()} for t in entries]
    if (system / "tm.py").exists():   # pytm: the findings it generates, each triaged by finding id and element
        found = pathlib.Path(f"reports/pytm-{system.name}.json").resolve()
        subprocess.run([sys.executable, "tm.py", "--json", str(found)], cwd=system, check=True)
        triaged = {(t.get("finding"), t.get("element")) for t in entries}
        problems += [f"{system.name}: pytm finding {f['threat_id']} on {f['target']} is not triaged in threats.yaml"
                     for f in json.loads(found.read_text())["findings"] if (f["threat_id"], f["target"]) not in triaged]
    elif "flowchart" not in ((system / "README.md").read_text() if (system / "README.md").exists() else ""):
        problems.append(f"{system.name}: no README.md with the data-flow diagram as a Mermaid flowchart")
pathlib.Path("reports/threats.json").write_text(json.dumps(threats, indent=2, default=str))
print(f"{len(threats)} threats from {len(set(t['system'] for t in threats))} registers")
if problems:
    sys.exit("\\n".join(problems))`,
    },
    {
      id: 'ff-threat-status', label: 'Every threat ends somewhere', characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: CADENCE, checks: ['req-statuses', 'req-acceptance', 'req-expired'],
      threshold: '100% of threats in reports/threats.json have a rated severity and a status with what it needs: a reference for mitigated and open, a reason for not applicable, a party and a contract for transferred, a named owner, a reason and an unexpired acceptance of at most {{ACCEPT_DAYS}} days for accepted',
      description: 'A Node script over reports/threats.json, run on every pull request and nightly on the main branch, so an acceptance that expires fails the build on the day after. A reference is a ticket key (SHOP-123), an issue number (#123), an ADR id (adr-…) or a test file (….test.ts).',
      tool: 'Node 20 (no dependencies)',
      language: 'js',
      snippet: `// scripts/check-threats.mjs: every threat in reports/threats.json ends mitigated, transferred, accepted until a date, not applicable, or open with a ticket
import { readFileSync } from 'node:fs'

const MAX_DAYS = {{ACCEPT_DAYS}}
const REF = /\\b[A-Z][A-Z0-9]+-\\d+\\b|#\\d+\\b|\\badr-[\\w-]+|[\\w./-]+\\.(test|spec)\\.\\w+/   // a ticket, an ADR or a test file
const DAY = 86_400_000
const problems = []
for (const t of JSON.parse(readFileSync('reports/threats.json', 'utf8'))) {
  const at = \`\${t.system} \${t.id} (\${t.element})\`
  if (!['low', 'medium', 'high', 'critical'].includes(t.severity)) problems.push(\`\${at}: severity "\${t.severity}" is not rated\`)
  if (t.status === 'mitigated' && !REF.test(t.mitigation ?? '')) problems.push(\`\${at}: mitigated, but names no test, ADR or ticket\`)
  else if (t.status === 'open' && !REF.test(t.mitigation ?? '')) problems.push(\`\${at}: open without the ticket that will close it\`)
  else if (t.status === 'not-applicable' && !String(t.mitigation ?? '').trim()) problems.push(\`\${at}: not applicable without a reason\`)
  else if (t.status === 'transferred' && !(t.to && t.reference)) problems.push(\`\${at}: transferred without the party and the contract or policy\`)
  else if (t.status === 'accepted') {
    const accepted = Date.parse(t.accepted), expires = Date.parse(t.expires)
    if (!t.owner || String(t.owner).startsWith('@') || !t.reason) problems.push(\`\${at}: accepted without a named owner and a reason\`)
    else if (!(expires > Date.now())) problems.push(\`\${at}: the acceptance by \${t.owner} expired on \${t.expires}\`)
    else if (!(expires - accepted <= MAX_DAYS * DAY)) problems.push(\`\${at}: the acceptance runs past \${MAX_DAYS} days\`)
  } else if (!['mitigated', 'open', 'not-applicable', 'transferred'].includes(t.status)) problems.push(\`\${at}: status "\${t.status}" is not one of the five\`)
}
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }
console.log('every threat has a status that ends it')`,
    },
    {
      id: 'ff-release-gate', label: 'Release waits for high threats', when: { UNMITIGATED: ['release-block'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'release', invocation: 'automated', implements: ['adr-release-block'], checks: ['req-high-blocks'],
      threshold: '0 threats of high or critical severity with the status open or accepted when a release is built',
      description: 'A step in the release job, after the reader of the threat model has written reports/threats.json, selects the high and critical threats that are open or accepted and fails the release naming them.',
      tool: 'jq in a GitHub Actions release job (bash)',
      language: 'bash',
      snippet: `# release job, after the reader of the threat model wrote reports/threats.json
set -euo pipefail
blocking=$(jq -r '.[]
  | select((.severity == "high" or .severity == "critical") and (.status == "open" or .status == "accepted"))
  | "\\(.system) \\(.id) \\(.severity) \\(.status): \\(.element)"' reports/threats.json)
if [ -n "$blocking" ]; then
  echo "High or critical threats neither mitigated nor transferred; the release stops:"
  echo "$blocking"
  exit 1
fi
echo "no open or accepted high or critical threat"`,
    },
    {
      id: 'ff-external-callers', label: 'Threat model names every outside caller', characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: CADENCE, checks: ['req-external-callers'],
      threshold: '0 persons or external systems that the architecture model shows calling an element of the system and that no file under threat-model/ names',
      description: 'A Node script reads the architecture model folder: the front matter of every node under architecture/nodes and the interacts relations in relations.json. It collects the label of every person or external element that calls an element that is not external, and fails for each label that appears nowhere under threat-model/ (case and spacing ignored). It runs on every pull request, so a caller added to the architecture model waits for the threat model.',
      tool: 'Node 20 with js-yaml, over the architecture model\'s Markdown folder',
      language: 'js',
      snippet: `// scripts/check-callers.mjs: the threat model names every person and external system the architecture model shows calling the system
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
const nodes = {}
for (const file of walk('architecture/nodes').filter((f) => f.endsWith('.md'))) {
  const front = yaml.load(readFileSync(file, 'utf8').split(/^---\\s*$/m)[1] ?? '') ?? {}
  if (front.id) nodes[front.id] = front
}
const outside = (n) => n.type === 'person' || n.external === true
const callers = new Set(JSON.parse(readFileSync('architecture/relations.json', 'utf8'))
  .filter((r) => r.relationType === 'interacts' && nodes[r.sourceId] && nodes[r.targetId] && outside(nodes[r.sourceId]) && !outside(nodes[r.targetId]))
  .map((r) => nodes[r.sourceId].label))
const model = walk('threat-model').map((f) => readFileSync(f, 'utf8')).join('\\n').toLowerCase().replace(/\\s+/g, ' ')
const missing = [...callers].filter((label) => !model.includes(label.toLowerCase().replace(/\\s+/g, ' ')))
console.log(\`\${callers.size} outside callers in the architecture model, \${missing.length} not named in threat-model/\`)
if (missing.length) { console.error(missing.map((m) => \`  \${m}\`).join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-categories', label: 'Threats under the method\'s categories', when: STRIDE, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-stride', 'adr-stride-linddun'], checks: ['req-stride', 'req-linddun'],
      threshold: '100% of threats carry a STRIDE category (or, with LINDDUN, a STRIDE or LINDDUN category); with LINDDUN, all 7 LINDDUN categories appear in each system\'s threat model',
      description: 'A Node script over reports/threats.json checks each threat\'s category against the method\'s list, reading Threat Dragon\'s older LINDDUN names as the current ones, and with LINDDUN fails for each system where a category appears nowhere, as a threat or as a not-applicable entry.',
      tool: 'Node 20 (no dependencies)',
      language: 'js',
      snippet: `// scripts/check-categories.mjs: every threat in reports/threats.json under a category of the method: {{METHOD}}
import { readFileSync } from 'node:fs'

const STRIDE = ['spoofing', 'tampering', 'repudiation', 'information disclosure', 'denial of service', 'elevation of privilege']
const LINDDUN = ['linking', 'identifying', 'non-repudiation', 'detecting', 'data disclosure', 'unawareness & unintervenability', 'non-compliance']
const OLDER = { linkability: 'linking', identifiability: 'identifying', detectability: 'detecting', 'disclosure of information': 'data disclosure', unawareness: 'unawareness & unintervenability' }   // Threat Dragon's names
const withLinddun = '{{METHOD}}'.includes('LINDDUN')
const allowed = withLinddun ? [...STRIDE, ...LINDDUN] : STRIDE
const category = (t) => { const c = String(t.category ?? '').trim().toLowerCase(); return OLDER[c] ?? c }
const threats = JSON.parse(readFileSync('reports/threats.json', 'utf8'))
const problems = threats.filter((t) => !allowed.includes(category(t)))
  .map((t) => \`\${t.system} \${t.id}: category "\${t.category ?? ''}" is none of \${withLinddun ? 'STRIDE and LINDDUN' : 'STRIDE'}\`)
if (withLinddun) for (const system of new Set(threats.map((t) => t.system))) {
  const seen = new Set(threats.filter((t) => t.system === system).map(category))
  for (const c of LINDDUN.filter((c) => !seen.has(c))) problems.push(\`\${system}: LINDDUN "\${c}" considered nowhere (a threat, or a not-applicable entry with its reason)\`)
}
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }
console.log(\`\${threats.length} threats, each under a category of the method\`)`,
    },
    {
      id: 'ff-pasta', label: 'Threats scored, objectives written', when: { METHOD: ['pasta'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-pasta'], checks: ['req-pasta'],
      threshold: '100% of threats carry a whole risk score from 1 to 25 and the severity that score gives; every system has threat-model/objectives/<system>.md with the sections Business objectives and Attack scenarios',
      description: 'A Node script over reports/threats.json checks each threat\'s score (the score field of a Threat Dragon threat or of a register entry) and the severity it gives, and that each system has its objectives file with the two sections of PASTA stages 1 and 6.',
      tool: 'Node 20 (no dependencies)',
      language: 'js',
      snippet: `// scripts/check-pasta.mjs: every threat scored and rated by its score; every system with its objectives and attack scenarios
import { existsSync, readFileSync } from 'node:fs'

const rating = (score) => (score >= 20 ? 'critical' : score >= 12 ? 'high' : score >= 6 ? 'medium' : 'low')
const threats = JSON.parse(readFileSync('reports/threats.json', 'utf8'))
const problems = []
for (const t of threats) {
  const score = Number(t.score)   // likelihood (1-5) x impact (1-5)
  if (!Number.isInteger(score) || score < 1 || score > 25) problems.push(\`\${t.system} \${t.id}: risk score "\${t.score ?? ''}" is not likelihood x impact (1 to 25)\`)
  else if (t.severity !== rating(score)) problems.push(\`\${t.system} \${t.id}: severity \${t.severity}, but a score of \${score} is \${rating(score)}\`)
}
for (const system of new Set(threats.map((t) => t.system))) {
  const file = \`threat-model/objectives/\${system}.md\`
  const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  for (const heading of ['## Business objectives', '## Attack scenarios'])
    if (!text.includes(heading)) problems.push(\`\${file}: no "\${heading}" section (PASTA stages 1 and 6)\`)
}
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }
console.log(\`\${threats.length} threats scored, objectives and attack scenarios for every system\`)`,
    },
  ],
}

export default pack
