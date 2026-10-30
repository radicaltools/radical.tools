import type { PackSpec, When } from '../../src/packSpec'

const FRAMEWORKS = ['adr-samm', 'adr-ssdf', 'adr-sdl']
const TESTED: When = { PENTEST: ['yearly', 'major'] }
const REVIEWED: When = { CHAMPIONS: ['champions', 'appsec'] }
const FORCES = 'A team builds this element, and the element is only as secure as the team\'s habits. The forces: the tools and gates of the other security packs work only while someone in the team knows why they are there and looks after them; a security specialist outside the team is a queue, while one inside every team is time taken from features; maturity that is never measured is assumed, and the assumption is always higher than the truth; a framework adopted all at once turns into paperwork, while targets per practice with a date show what to improve next; a penetration test finds what scanners miss (access across roles, business logic, chained flaws) but covers a few days a year and costs money; training taken once at onboarding teaches the attacks of that year; and buyers, auditors and standards (PCI DSS, US federal buyers) ask for evidence of the process, not only of the product. This pack decides who does the security practices and how their maturity is measured. The tools and gates are decided by the Secure coding, Software supply chain, Threat modelling, Definition of Done and change approval, and Security event logging and detection packs; this pack never decides them again.'

const pack: PackSpec = {
  id: 'concern-secure-development',
  name: 'Secure development process',
  group: 'security',
  description: 'How the team that builds the element does security, measured against a framework: OWASP SAMM, NIST SSDF or the Microsoft SDL, who carries security in the team, how often an external tester attacks the element, and how the team is trained. The snippets are Node scripts and GitHub Actions over records kept under security/.',
  tags: ['security', 'sdlc', 'owasp samm', 'nist ssdf', 'security champions', 'penetration testing'],
  concern: {
    id: 'secure-development',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'a team builds these elements, so who does their security practices and how the team\'s maturity is measured has to be decided.',
  },
  sources: [
    { title: 'OWASP SAMM v2: the model (15 security practices in 5 business functions)', url: 'https://owaspsamm.org/model/' },
    { title: 'OWASP SAMM: assessment tools (SAMM Toolbox, SAMMwise)', url: 'https://owaspsamm.org/assessment/' },
    { title: 'NIST SP 800-218, Secure Software Development Framework (SSDF) Version 1.1', url: 'https://csrc.nist.gov/pubs/sp/800/218/final' },
    { title: 'NIST SP 800-218 Rev. 1 (SSDF 1.2), initial public draft, December 2025', url: 'https://csrc.nist.gov/pubs/sp/800/218/r1/ipd' },
    { title: 'CISA: Secure Software Development Attestation Form', url: 'https://www.cisa.gov/secure-software-attestation-form' },
    { title: 'OMB M-26-05: Adopting a Risk-based Approach to Software and Hardware Security (January 2026)', url: 'https://www.whitehouse.gov/wp-content/uploads/2026/01/M-26-05-Adopting-a-Risk-based-Approach-to-Software-and-Hardware-Security.pdf' },
    { title: 'Microsoft Security Development Lifecycle: practices', url: 'https://www.microsoft.com/en-us/securityengineering/sdl/practices' },
    { title: 'OWASP Security Champions Guide', url: 'https://securitychampions.owasp.org/' },
    { title: 'OWASP Web Security Testing Guide', url: 'https://owasp.org/www-project-web-security-testing-guide/' },
    { title: 'PCI Security Standards Council: PCI DSS v4.0.1, Requirements 6.2.2 and 11.4', url: 'https://www.pcisecuritystandards.org/standards/pci-dss/' },
    { title: 'BSIMM16 (Black Duck)', url: 'https://www.blackduck.com/resources/analyst-reports/bsimm.html' },
  ],
  questions: [
    {
      key: 'FRAMEWORK', title: 'Framework', label: 'Which framework is the team\'s security practice measured against?',
      hint: 'The framework says what a complete secure development process looks like and how far the team is from it. It picks no tools: the tools and gates come from the Secure coding, Software supply chain, Threat modelling and Definition of Done packs, and the framework counts them as evidence.',
      default: 'samm',
      options: [
        { value: 'samm', label: 'OWASP SAMM v2 with a target per practice', description: 'The team scores itself on the 15 SAMM practices (0 to 3) with the SAMM Toolbox at least once a year, and sets a target score and a date for each practice. Pick it when the goal is to improve step by step and show the progress, and no customer or regulator asks for a particular framework.' },
        { value: 'ssdf', label: 'NIST SSDF practices mapped to evidence', description: 'Each of the 19 practices of NIST SP 800-218 (SSDF 1.1, PO.1 to RV.3) is mapped to the evidence that the team follows it: a workflow, a policy, a report. Pick it when you sell software to US federal agencies, or to buyers who ask for SSDF conformance or the CISA attestation form.' },
        { value: 'sdl', label: 'the Microsoft SDL as the team\'s checklist', description: 'The ten practices of the Microsoft Security Development Lifecycle are the team\'s checklist, each marked done, partial or not applicable with its evidence, reviewed once a year. Pick it for a small team that wants a short, concrete list rather than a maturity model, when no buyer asks for a framework.' },
      ],
    },
    {
      key: 'CHAMPIONS', title: 'Security role', label: 'Who carries security in the team?',
      hint: 'Someone has to know why each security gate is there, answer the security questions of a change and keep the framework\'s record. A champion in each team is close to the code; a central team brings depth but is a queue. Which changes need a security review is set by the Threat modelling and Definition of Done packs; this answer says who gives it.',
      default: 'champions',
      options: [
        { value: 'champions', label: 'a security champion in each team', description: 'One developer in each team that owns code is its security champion, with hours set aside every week (4 by default), further training, and a place in a champions group with a GitHub team of its own. Pick it with two or more teams, or for one team without a security specialist nearby.' },
        { value: 'appsec', label: 'a central application security team', description: 'A central application security team reviews the changes labelled for a security review, within a set number of days (5 by default), and runs the framework assessment with the team. Pick it when the organisation has such a team and the element has few but high-risk changes, or a regulator asks for review by a security function.' },
        { value: 'none', label: 'no dedicated security role', description: 'Nobody has security as a role: peer reviewers answer the security questions and the engineering lead keeps the framework record. Pick it only for one small team building internal software; the decision records it, so that the first external customer or audit supersedes it.' },
      ],
    },
    {
      key: 'PENTEST', title: 'Penetration test', label: 'How often does an external tester attack the element?',
      hint: 'A penetration test finds what scanners do not: access across roles, business logic, chained flaws. Its findings enter the deadlines of the Secure coding pack, which also decides the scanners and the dynamic testing (ZAP).',
      default: 'yearly',
      options: [
        { value: 'yearly', label: 'an external penetration test every year and before each major release', description: 'An external firm tests the element at least every 12 months and before each major release, following the OWASP Web Security Testing Guide, signed in as each role, with a retest of the high findings. Pick it for anything reached from the internet or holding personal or payment data; PCI DSS Requirement 11.4 asks for at least this.' },
        { value: 'major', label: 'an external penetration test before each major release', description: 'An external firm tests each major release before it is published, and nothing in between. Pick it when major releases come at least once a year and the changes between them are small, or the budget covers one test per release.' },
        { value: 'none', label: 'no penetration test, with what replaces it recorded', description: 'No external test; a record names what replaces it (the Secure coding pack\'s dynamic testing, a bug bounty programme, an internal red team) and is reviewed every year. Pick it for internal tools without personal data, or before a first release, while a test would only find what the scanners already report.' },
      ],
    },
    {
      key: 'TRAINING', title: 'Training', label: 'How is the team trained in secure coding?',
      hint: 'Attacks and frameworks change; a course taken once covers the attacks of the year it was taken. The completion records are evidence for every framework above.',
      default: 'yearly',
      options: [
        { value: 'yearly', label: 'secure coding training every year, with a completion record', description: 'Every engineer who commits to the element completes the secure coding course within their first 30 days (by default) and again every 12 months; completions come from the learning platform\'s export. Pick it by default, and whenever PCI DSS applies (Requirement 6.2.2 asks for training every 12 months).' },
        { value: 'onboarding', label: 'secure coding training at onboarding only', description: 'Every engineer completes the course within their first 30 days (by default), and not again; what is new reaches the team through champions and reviews. Pick it for a small, stable team with a security champion, where no standard asks for yearly training.' },
      ],
    },
  ],
  details: [
    { key: 'ASSESSMENT_MONTHS', label: 'At most how many months may pass between two reviews of the framework record?', default: '12', number: true },
    { key: 'SAMM_FLOOR', label: 'What is the lowest target score a SAMM practice may have (0 to 3)? (OWASP SAMM only)', default: '1', number: true },
    { key: 'CHAMPION_HOURS', label: 'How many hours a week does each champion spend on security? (security champions only)', default: '4', number: true },
    { key: 'SECURITY_TEAM', label: 'Which GitHub team (its slug) gives security reviews: the champions, or the central application security team? (not with no dedicated security role)', default: 'security-reviewers' },
    { key: 'APPSEC_REVIEW_DAYS', label: 'Within how many days must the central team give a security review? (central team only)', default: '5', number: true },
    { key: 'PENTEST_MONTHS', label: 'At most how many months may pass between two penetration tests? (yearly tests only)', default: '12', number: true },
    { key: 'PENTEST_TRIAGE_DAYS', label: 'Within how many days of a penetration test report must its findings be filed? (with penetration tests)', default: '5', number: true },
    { key: 'MAJOR_TAGS', label: 'Which regular expression matches the git tag of a major release? (with penetration tests)', default: '^v[0-9]+\\.0\\.0$' },
    { key: 'TRAINING_COURSE', label: 'Which course in the learning platform counts as the secure coding training?', default: 'Secure coding' },
    { key: 'ONBOARDING_DAYS', label: 'Within how many days of their first commit must an engineer complete the course?', default: '30', number: true },
  ],
  need: {
    label: 'The team builds security in, and can show it',
    text: 'The element is built by a team, and its security rests on what that team does every week: who answers the security questions of a change, whether an attacker\'s view is ever taken, whether the people writing the code know today\'s attacks, and whether anyone measures how far the practice is from where it should be. Buyers, auditors and standards ask for that evidence. The snippets assume a GitHub repository with the records under security/ (samm/assessment.yaml, ssdf/evidence.yaml or sdl/checklist.yaml, champions.yaml, pentests.yaml), Node scripts under scripts/security/ run by a scheduled workflow with js-yaml installed and the GitHub CLI signed in with a token that can read the organisation\'s teams, CODEOWNERS (where used) naming teams as @org/team, and the learning platform\'s completions downloaded by the same job to training.csv (email,course,completed_on), never committed.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-samm-current', label: 'SAMM assessment is current', when: { FRAMEWORK: ['samm'] }, ears_type: 'ubiquitous',
      action: 'assess the team that builds the element against the 15 practices of OWASP SAMM v2 at least every {{ASSESSMENT_MONTHS}} months, and record the date and the score of each practice (0 to 3) in security/samm/assessment.yaml',
      rationale: 'SAMM is meant to be measured and measured again: a score per practice shows where the team stands, and an assessment older than a year describes a team that no longer exists (OWASP SAMM v2 model; SAMM assessment tools).',
      scenario: { label: 'Stale assessment found', given: 'the SAMM record in security/samm/assessment.yaml', when: 'its date is more than {{ASSESSMENT_MONTHS}} months ago, or one of the 15 practices has no score', then: 'the scheduled check fails naming the date or the practice' },
    },
    {
      id: 'req-samm-targets', label: 'SAMM targets met on time', when: { FRAMEWORK: ['samm'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a SAMM practice scores below its target after the date set for reaching it',
      action: 'fail the scheduled check until a new assessment reaches the target or the date is moved in a reviewed pull request, and keep every practice\'s target at {{SAMM_FLOOR}} or above',
      rationale: 'A target and a date per practice turn a maturity model into a plan; moving a date in a pull request leaves a record of who decided to wait (OWASP SAMM v2 model).',
      scenario: { label: 'Missed target fails', given: 'a practice with score 1, target 2 and a target date that has passed', when: 'the scheduled check runs', then: 'it fails naming the practice, and passes again once the score reaches 2 or the date is moved' },
    },
    {
      id: 'req-ssdf-evidence', label: 'Evidence for every SSDF practice', when: { FRAMEWORK: ['ssdf'] }, ears_type: 'ubiquitous',
      action: 'keep in security/ssdf/evidence.yaml, for each of the 19 practices of NIST SSDF 1.1 (PO.1 to PO.5, PS.1 to PS.3, PW.1, PW.2, PW.4 to PW.9, RV.1 to RV.3), at least one link to evidence that the practice is followed or a reason why it does not apply, with every repository path in it existing and the map reviewed at least every {{ASSESSMENT_MONTHS}} months',
      rationale: 'The SSDF states outcomes, not tools; a buyer, an auditor or an agency using the CISA attestation form asks for evidence per practice, and a link to nothing is no evidence (NIST SP 800-218; CISA Secure Software Development Attestation Form).',
      scenario: { label: 'Gap in the evidence map', given: 'the evidence map', when: 'a practice is missing, has neither evidence nor a reason, or names a file that was deleted', then: 'the check fails naming the practice id' },
    },
    {
      id: 'req-sdl-checklist', label: 'SDL checklist kept', when: { FRAMEWORK: ['sdl'] }, ears_type: 'ubiquitous',
      action: 'keep in security/sdl/checklist.yaml the ten practices of the Microsoft SDL, each marked done, partial or not-applicable, with a link to evidence when done or partial, what is missing when partial and a reason when not-applicable, reviewed at least every {{ASSESSMENT_MONTHS}} months',
      rationale: 'A checklist is only as good as its last review; evidence per item makes "done" something another person can verify (Microsoft Security Development Lifecycle: practices).',
      scenario: { label: 'Unsupported item found', given: 'the SDL checklist', when: 'an item is marked done without evidence, or the review date is more than {{ASSESSMENT_MONTHS}} months ago', then: 'the check fails naming the item or the date' },
    },
    {
      id: 'req-champion', label: 'A champion in each team', when: { CHAMPIONS: ['champions'] }, ears_type: 'ubiquitous',
      action: 'name in security/champions.yaml one security champion for each team that owns code of the element, who is a member of that team and of the {{SECURITY_TEAM}} GitHub team and has at least {{CHAMPION_HOURS}} hours a week set aside for security',
      rationale: 'A champion in every team spreads security without a queue, and the role needs time and investment, or it exists only on paper (OWASP Security Champions Guide: invest in your champions, anticipate personnel changes).',
      scenario: { label: 'Team without a champion', given: 'a team named in CODEOWNERS', when: 'it has no entry in security/champions.yaml, or its champion has left the team or has fewer than {{CHAMPION_HOURS}} hours', then: 'the check fails naming the team' },
    },
    {
      id: 'req-champion-review', label: 'Security review by a champion', when: { CHAMPIONS: ['champions'] }, ears_type: 'event-driven',
      trigger: 'a pull request to the element carries the security-review label',
      action: 'merge it only after an approving review from a member of {{SECURITY_TEAM}} who is not its author',
      rationale: 'The security review that the Definition of Done or the threat model asks for is given by someone who knows both the code and the attacks (OWASP Security Champions Guide; NIST SP 800-218 PO.2 and PW.7).',
      scenario: { label: 'Labelled change waits for a champion', given: 'a pull request with the security-review label, approved by a reviewer outside {{SECURITY_TEAM}}', when: 'a champion who is not its author approves it', then: 'the security-review check turns from failing to passing and the pull request can be merged' },
    },
    {
      id: 'req-appsec-review', label: 'Security review by the central team in time', when: { CHAMPIONS: ['appsec'] }, ears_type: 'event-driven',
      trigger: 'a pull request to the element carries the security-review label',
      action: 'merge it only after an approving review from a member of the {{SECURITY_TEAM}} team who is not its author, given within {{APPSEC_REVIEW_DAYS}} days of the label',
      rationale: 'A central team gives depth, and a deadline keeps it from becoming the queue that teams learn to avoid (NIST SP 800-218 PO.2 and PW.7).',
      scenario: { label: 'Waiting review reported', given: 'a pull request labelled security-review with no approval from {{SECURITY_TEAM}}', when: '{{APPSEC_REVIEW_DAYS}} days pass', then: 'the security-review check still blocks the merge and the daily job fails naming the pull request' },
    },
    {
      id: 'req-one-team', label: 'One team while nobody owns security', when: { CHAMPIONS: ['none'] }, ears_type: 'state-driven',
      precondition: 'no one in or around the team has security as a role',
      action: 'have code of the element owned by at most one team in CODEOWNERS, so that a second team supersedes the decision before it owns code',
      rationale: 'Without a security role, the peer reviewers of one small team carry the security questions; a second team brings code nobody reviews with the whole in mind, which is where a champion or a central team is needed (OWASP Security Champions Guide).',
      scenario: { label: 'Second team noticed', given: 'the decision that no one has security as a role', when: 'a pull request adds a second team to CODEOWNERS', then: 'the check fails and asks for the decision to be superseded' },
    },
    {
      id: 'req-pentest-yearly', label: 'Penetration test every year', when: { PENTEST: ['yearly'] }, ears_type: 'ubiquitous',
      action: 'have the element tested by an external penetration tester at least every {{PENTEST_MONTHS}} months, record each test in security/pentests.yaml with its date, tester, scope and a link to the report, and file its findings as findings of the Secure coding pack within {{PENTEST_TRIAGE_DAYS}} days of the report',
      rationale: 'Scanners miss access control across roles and business logic; a yearly external test is what PCI DSS Requirement 11.4 asks for, and its findings count only once they enter the deadlines (OWASP Web Security Testing Guide; OWASP SAMM v2, Security Testing).',
      scenario: { label: 'Overdue test found', given: 'security/pentests.yaml whose newest test is more than {{PENTEST_MONTHS}} months old, or whose findings were filed later than {{PENTEST_TRIAGE_DAYS}} days after it', when: 'the scheduled check runs', then: 'it fails naming the overdue test or the late filing' },
    },
    {
      id: 'req-pentest-major', label: 'Major releases tested first', when: TESTED, ears_type: 'event-driven',
      trigger: 'a major release (a tag matching {{MAJOR_TAGS}}) is published',
      action: 'have an external penetration test of its release candidate recorded in security/pentests.yaml for that release, dated no later than the tag, with its findings filed as findings of the Secure coding pack within {{PENTEST_TRIAGE_DAYS}} days of the report',
      rationale: 'A major release changes the attack surface the most; PCI DSS Requirement 11.4 asks for a test after any significant change, and SAMM\'s Security Testing practice puts manual testing where releases are largest (OWASP SAMM v2 model).',
      scenario: { label: 'Untested major release found', given: 'a tag matching {{MAJOR_TAGS}}', when: 'security/pentests.yaml has no test for it, or only one dated after the tag', then: 'the check fails naming the tag' },
    },
    {
      id: 'req-pentest-none', label: 'No test, and what replaces it', when: { PENTEST: ['none'] }, ears_type: 'ubiquitous',
      action: 'record in security/pentests.yaml why the element has no penetration test and what replaces it, and review that record at least every {{ASSESSMENT_MONTHS}} months',
      rationale: 'Leaving out manual testing is a decision with a reason and an expiry, not an omission nobody notices (OWASP SAMM v2, Security Testing).',
      scenario: { label: 'Stale waiver found', given: 'security/pentests.yaml with a waiver', when: 'the waiver names no replacement, or was reviewed more than {{ASSESSMENT_MONTHS}} months ago', then: 'the check fails' },
    },
    {
      id: 'req-training-onboarding', label: 'Course within the first days', ears_type: 'event-driven',
      trigger: 'an engineer makes a first commit to the element',
      action: 'have them complete the {{TRAINING_COURSE}} course within {{ONBOARDING_DAYS}} days, as recorded by the learning platform',
      rationale: 'Training is a practice in every framework of this pack (SSDF PO.2.2, SAMM Education and Guidance, SDL practice 10); the first weeks are when habits form (NIST SP 800-218; Microsoft SDL practices).',
      scenario: { label: 'Untrained committer found', given: 'an engineer whose first commit is more than {{ONBOARDING_DAYS}} days old', when: 'the learning platform export holds no completion of {{TRAINING_COURSE}} for them', then: 'the scheduled check fails naming their commit e-mail' },
    },
    {
      id: 'req-training-yearly', label: 'Course every year', when: { TRAINING: ['yearly'] }, ears_type: 'ubiquitous',
      action: 'have every engineer who committed to the element in the last 90 days complete the {{TRAINING_COURSE}} course within the last 12 months',
      rationale: 'PCI DSS Requirement 6.2.2 asks that developers of custom software are trained at least every 12 months; attacks and frameworks change faster than that (PCI DSS v4.0.1).',
      scenario: { label: 'Lapsed training found', given: 'an engineer who committed last month', when: 'their last completion of {{TRAINING_COURSE}} is 13 months old', then: 'the scheduled check fails naming their commit e-mail' },
    },
  ],
  adrs: [
    {
      id: 'adr-samm', label: 'Security practice measured with OWASP SAMM', when: { FRAMEWORK: ['samm'] },
      decision: 'The security practice of the team that builds the element is measured with OWASP SAMM v2. At least every {{ASSESSMENT_MONTHS}} months the team scores the 15 practices with the SAMM Toolbox (the Excel or Google Sheets workbook from the owaspsamm/core releases; SAMMwise works too) and copies its Scorecard into security/samm/assessment.yaml: the date, and for each practice by its id (G-SM, G-PC, G-EG, D-TA, D-SR, D-SA, I-SB, I-SD, I-DM, V-AA, V-RT, V-ST, O-IM, O-EM, O-OM) the score, the target and the date to reach it; no target is below {{SAMM_FLOOR}}. Targets are set per practice, not one level for all, and someone outside the team (a champion of another team, the central security team) runs the interview. The evidence for a practice is what another pack decided: Threat Assessment the Threat modelling pack, Secure Build the Software supply chain pack, Security Testing and Defect Management the Secure coding pack, Incident Management the Security event logging and detection pack. Security role: {{CHAMPIONS}}. Penetration tests: {{PENTEST}}. Training: {{TRAINING}}.',
      consequences: '• One score per practice shows where the team stands and what to improve next; the next assessment shows whether it did.\n• A self-assessment flatters: the Toolbox\'s quality criteria help, but a score is only as honest as the people answering, which is why someone outside the team asks the questions.\n• An assessment takes a day or two of the team\'s and a facilitator\'s time each period.\n• SAMM is not a certification: no buyer or regulator takes a SAMM score as proof by itself.',
      alternatives: '1. NIST SSDF with evidence per practice: what US federal buyers know, but outcomes without levels, so it shows gaps, not progress.\n2. The Microsoft SDL as a checklist: shorter, but done or not done, with no levels.\n3. BSIMM: describes what more than a hundred firms do (BSIMM16), useful to compare against, but it is a study of organisations with a security group, not a target for one team.',
    },
    {
      id: 'adr-ssdf', label: 'Security practice mapped to the NIST SSDF', when: { FRAMEWORK: ['ssdf'] },
      decision: 'The security practice of the team that builds the element is measured against NIST SP 800-218, the Secure Software Development Framework 1.1. security/ssdf/evidence.yaml maps each of its 19 practices (PO.1 to PO.5, PS.1 to PS.3, PW.1, PW.2, PW.4 to PW.9, RV.1 to RV.3; version 1.1 merged PW.3 into PW.4) to the evidence that the team follows it, a repository path or a link, and is reviewed at least every {{ASSESSMENT_MONTHS}} months. Most evidence is a decision of another pack: PW.1 and PW.2 the Threat modelling pack, PS.1 to PS.3 and PW.4 the Software supply chain pack, PW.5, PW.7, PW.8 and RV.1 to RV.3 the Secure coding pack; PO.2 is this pack\'s security role and training. SSDF 1.2 (SP 800-218 Rev. 1, an initial public draft of December 2025) adds the practices PO.6 and PW.10; they join the map when it is final. When a US federal agency asks for the CISA Secure Software Development Attestation Form, it is filled from the map and signed by the chief executive or a designee who can bind the company; OMB M-26-05 (January 2026) rescinded the memoranda that made the form mandatory, so each agency now decides by its own risk-based policy whether to ask for it. Security role: {{CHAMPIONS}}. Penetration tests: {{PENTEST}}. Training: {{TRAINING}}.',
      consequences: '• Speaks the language of US federal buyers and of many enterprise questionnaires; the map answers them in hours instead of weeks.\n• The SSDF says which outcome to reach, not how well: the map shows gaps, not progress, so improvement needs goals of its own.\n• The map goes stale as workflows are renamed; the check catches a missing repository path, but a link outside the repository is checked only by the reviewer.\n• Version 1.2 will add practices; the map grows when it is final.',
      alternatives: '1. OWASP SAMM with targets: levels and progress, but buyers asking for the SSDF need a mapping on top.\n2. The Microsoft SDL as a checklist: shorter, and less known to buyers.\n3. The attestation form alone, without a map: a signature with nothing under it.',
    },
    {
      id: 'adr-sdl', label: 'The Microsoft SDL as the team\'s checklist', when: { FRAMEWORK: ['sdl'] },
      decision: 'The security practice of the team that builds the element follows the Microsoft Security Development Lifecycle as a checklist. security/sdl/checklist.yaml lists the ten practices on Microsoft\'s SDL page (security standards, metrics and governance; proven security features, languages and frameworks; security design review and threat modelling; cryptography standards; the software supply chain; the engineering environment; security testing; operational platform security; security monitoring and response; security training), each marked done, partial or not-applicable with its evidence, what is missing or a reason, and is reviewed at least every {{ASSESSMENT_MONTHS}} months against the page as it stands. Each item points at the pack that decides it: threat modelling the Threat modelling pack, cryptography the Encryption in transit and at rest pack, the supply chain the Software supply chain pack, security testing the Secure coding pack, monitoring and response the Security event logging and detection pack. Security role: {{CHAMPIONS}}. Penetration tests: {{PENTEST}}. Training: {{TRAINING}}.',
      consequences: '• Ten items a small team can keep in mind and review in an hour.\n• Done or not done hides how well: partial with a note is the honest middle, and there are no levels to show progress.\n• Microsoft changes the SDL page without version numbers; the review compares the checklist with the page.\n• Few buyers ask for the SDL by name; a questionnaire still needs its own mapping.',
      alternatives: '1. OWASP SAMM: levels and targets per practice, for a day or two per assessment.\n2. NIST SSDF: what US federal buyers ask for, 19 practices with evidence.\n3. No framework: nobody can say which practices are missing.',
    },
    {
      id: 'adr-champions', label: 'A security champion in each team', when: { CHAMPIONS: ['champions'] },
      decision: 'Each team that owns code of the element names one developer as its security champion in security/champions.yaml, with at least {{CHAMPION_HOURS}} hours a week set aside in the team\'s plan. The champions form the GitHub team {{SECURITY_TEAM}}, meet monthly as a group, get training beyond the course every engineer takes, and have the role in their goals. A champion facilitates the team\'s threat modelling (its method and timing are the Threat modelling pack\'s), keeps the framework record with the engineering lead, and gives the security review: a pull request with the security-review label, set by its author or a reviewer when the Definition of Done or the threat model asks for a security review, is merged only after a champion who is not its author approves it. The security-review check enforces this; it is added to the required checks of main in the ruleset the Code review and branching pack keeps. A champion who leaves is replaced before the team\'s next labelled pull request.',
      consequences: '• Security questions are answered inside the team, by someone who knows the code, without a queue.\n• {{CHAMPION_HOURS}} hours a week per team are not spent on features; without them the role exists only on paper.\n• A champion is not a specialist: hard questions still need outside help, budgeted separately.\n• The role rests on one person per team; a departure leaves a gap, which the check reports.',
      alternatives: '1. A central application security team: depth and consistent reviews, but a queue and distance from the code.\n2. No dedicated role: nothing to staff, and nobody accountable when a gate is switched off.',
    },
    {
      id: 'adr-appsec', label: 'A central application security team reviews', when: { CHAMPIONS: ['appsec'] },
      decision: 'A central application security team, the GitHub team {{SECURITY_TEAM}}, gives the security review: a pull request with the security-review label, set by its author or a reviewer when the Definition of Done or the threat model asks for a security review, is merged only after a member of that team who is not its author approves it, and the team answers within {{APPSEC_REVIEW_DAYS}} days of the label; a daily job reports pull requests waiting longer. The security-review check is added to the required checks of main in the ruleset the Code review and branching pack keeps. The central team also facilitates threat modelling with the developers (the method is the Threat modelling pack\'s), runs the framework assessment with the engineering lead, and scopes the penetration tests.',
      consequences: '• Reviews by specialists, the same across teams.\n• A queue: a change may wait {{APPSEC_REVIEW_DAYS}} days, and teams learn to label less; watch how many reviews are asked for.\n• Knowledge stays with the central team; developers learn only what the reviews teach them.\n• Needs a central team with enough people to keep the deadline.',
      alternatives: '1. A security champion in each team: no queue, less depth.\n2. Champions with the central team behind them for the hard cases: often the next step, recorded by superseding this decision.',
    },
    {
      id: 'adr-no-security-role', label: 'No dedicated security role', when: { CHAMPIONS: ['none'] },
      decision: 'Nobody in or around the team has security as a role. The security questions of a change are part of the peer review the Code review and branching pack requires, the engineering lead keeps the framework record, and no change waits for a security specialist. This holds while one small team builds the element for internal use; the first external customer, audit or second team supersedes this decision.',
      consequences: '• Nothing to staff, no hours set aside, no queue.\n• Nobody is accountable when a security gate is switched off or a finding ages, and the framework\'s people practices (SAMM Education and Guidance, SSDF PO.2, the SDL\'s roles) score low.\n• The depth of a security review is whatever the reviewer happens to know.',
      alternatives: '1. A security champion in each team: a few hours a week, one person accountable.\n2. A central application security team: depth, at the cost of a queue.',
    },
    {
      id: 'adr-pentest', label: 'External penetration tests', when: TESTED,
      decision: 'An external penetration testing firm attacks the element: {{PENTEST}}. Each test follows the OWASP Web Security Testing Guide, signs in as each role, covers the element\'s APIs and the business logic of its main journeys, and ends with a report and a retest of high and critical findings. Every test is recorded in security/pentests.yaml (date, tester, scope, the release it was for, a link to the report in a restricted store, never the report itself, and the date its findings were filed); its findings become findings of the Secure coding pack, with that pack\'s deadlines, within {{PENTEST_TRIAGE_DAYS}} days of the report. A major release is one whose tag matches {{MAJOR_TAGS}}.',
      consequences: '• Finds what scanners miss: access across roles, business logic, chained flaws.\n• Each test costs money and one to three weeks with the retest; it is budgeted with the releases.\n• A test is a snapshot: code merged the week after is untested until the next one, which is why the Secure coding pack\'s scanners keep running.\n• Before a major release the test is on the release\'s critical path; it is booked weeks ahead.',
      alternatives: '1. No external test, with dynamic scanning and a bug bounty instead: cheaper, but access control and business logic go untested by anyone thinking like an attacker.\n2. An internal red team: knows the system, shares its builders\' blind spots, and few organisations have one.\n3. Penetration testing as a subscription: shorter cycles, worth it with many releases a year.',
    },
    {
      id: 'adr-no-pentest', label: 'No penetration test, with a replacement recorded', when: { PENTEST: ['none'] },
      decision: 'The element has no external penetration test. security/pentests.yaml records why and what replaces it (the dynamic testing decided in the Secure coding pack, a bug bounty programme, an internal red team exercise), and the record is reviewed at least every {{ASSESSMENT_MONTHS}} months. Payment data, the first external customer, or a contract or standard that asks for a penetration test (PCI DSS Requirement 11.4 does) supersedes this decision.',
      consequences: '• No test to buy, schedule or wait for.\n• Access control across roles and business logic are tested only by the team that wrote them.\n• The framework\'s testing practice (SAMM Security Testing, SSDF PW.8, SDL security testing) scores lower, and the record says so.',
      alternatives: '1. An external test every year and before each major release: what PCI DSS asks for.\n2. An external test before each major release only: one test per release, nothing between.',
    },
  ],
  fitness: [
    {
      id: 'ff-samm', label: 'SAMM assessment current and on target', when: { FRAMEWORK: ['samm'] }, characteristic: 'security', scope: 'atomic', cadence: 'temporal', every: '365d', invocation: 'manual', implements: ['adr-samm'], checks: ['req-samm-current', 'req-samm-targets'],
      threshold: 'The assessment is at most {{ASSESSMENT_MONTHS}} months old; all 15 practices have a score from 0 to 3 and a target from {{SAMM_FLOOR}} to 3; 0 practices below target after their date',
      description: 'A scheduled job, and every pull request that changes security/samm/, reads the assessment copied from the SAMM Toolbox\'s Scorecard and fails on a stale date, a missing practice, a target below the floor, or a practice below its target after its date. The file is a format of this pack: the Toolbox is a workbook with no machine-readable export, so the Scorecard\'s practice scores are copied into it after each assessment.',
      tool: 'Node.js with js-yaml (scripts/security/samm-check.mjs) in a scheduled GitHub Actions job',
      language: 'js',
      snippet: `// scripts/security/samm-check.mjs; security/samm/assessment.yaml looks like:
//   assessed: 2026-09-15
//   practices: { G-SM: { score: 1.5, target: 2, by: 2027-06-30 }, G-PC: { ... }, ... }
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const PRACTICES = ['G-SM', 'G-PC', 'G-EG', 'D-TA', 'D-SR', 'D-SA', 'I-SB', 'I-SD', 'I-DM', 'V-AA', 'V-RT', 'V-ST', 'O-IM', 'O-EM', 'O-OM']
const MONTHS = {{ASSESSMENT_MONTHS}}, FLOOR = {{SAMM_FLOOR}}
const a = yaml.load(readFileSync('security/samm/assessment.yaml', 'utf8'), { schema: yaml.JSON_SCHEMA })
const oldest = new Date(); oldest.setMonth(oldest.getMonth() - MONTHS)
const errors = []
if (!(new Date(a.assessed) >= oldest)) errors.push(\`assessment of \${a.assessed} is older than \${MONTHS} months\`)
for (const id of PRACTICES) {
  const p = a.practices?.[id]
  if (!p) { errors.push(\`\${id}: no score\`); continue }
  if (!(p.score >= 0 && p.score <= 3)) errors.push(\`\${id}: score \${p.score} is not from 0 to 3\`)
  if (!(p.target >= FLOOR && p.target <= 3)) errors.push(\`\${id}: target \${p.target} is not from \${FLOOR} to 3\`)
  if (p.score < p.target && !(new Date(p.by) > new Date())) errors.push(\`\${id}: \${p.score} is below its target \${p.target}, due \${p.by ?? 'on no date'}\`)
}
if (errors.length) { console.error(errors.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-ssdf', label: 'SSDF evidence map complete', when: { FRAMEWORK: ['ssdf'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-ssdf'], checks: ['req-ssdf-evidence'],
      threshold: 'All 19 SSDF 1.1 practice ids have at least one piece of evidence or a reason; 0 repository paths in the map missing; the map reviewed within {{ASSESSMENT_MONTHS}} months',
      description: 'A scheduled job, and every pull request, reads security/ssdf/evidence.yaml and fails on a missing practice id, a practice with neither evidence nor a reason, a repository path that no longer exists (a renamed workflow), or a stale review date. Links outside the repository must be https links; whether they still show what they claim is the reviewer\'s part. When SSDF 1.2 is final, PO.6 and PW.10 are added to the list.',
      tool: 'Node.js with js-yaml (scripts/security/ssdf-check.mjs) in a scheduled GitHub Actions job',
      language: 'js',
      snippet: `// scripts/security/ssdf-check.mjs; security/ssdf/evidence.yaml looks like:
//   reviewed: 2026-09-20
//   practices: { PO.1: [docs/security/requirements.md], PO.2: [security/champions.yaml], PW.6: { na: "interpreted code, no compiler" } }
import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const IDS = ['PO.1', 'PO.2', 'PO.3', 'PO.4', 'PO.5', 'PS.1', 'PS.2', 'PS.3', 'PW.1', 'PW.2', 'PW.4', 'PW.5', 'PW.6', 'PW.7', 'PW.8', 'PW.9', 'RV.1', 'RV.2', 'RV.3']
const MONTHS = {{ASSESSMENT_MONTHS}}
const map = yaml.load(readFileSync('security/ssdf/evidence.yaml', 'utf8'), { schema: yaml.JSON_SCHEMA })
const oldest = new Date(); oldest.setMonth(oldest.getMonth() - MONTHS)
const errors = []
if (!(new Date(map.reviewed) >= oldest)) errors.push(\`evidence map last reviewed \${map.reviewed}, more than \${MONTHS} months ago\`)
for (const id of IDS) {
  const e = map.practices?.[id]
  if (e?.na) continue
  if (!Array.isArray(e) || !e.length) { errors.push(\`\${id}: no evidence and no reason\`); continue }
  for (const link of e) {
    if (/^https?:/.test(link) ? !link.startsWith('https://') : !existsSync(link)) errors.push(\`\${id}: \${link} does not exist or is not https\`)
  }
}
if (errors.length) { console.error(errors.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-sdl', label: 'SDL checklist complete and reviewed', when: { FRAMEWORK: ['sdl'] }, characteristic: 'security', scope: 'atomic', cadence: 'temporal', every: '365d', invocation: 'manual', implements: ['adr-sdl'], checks: ['req-sdl-checklist'],
      threshold: 'All 10 SDL practices present; each done or partial item has evidence, each partial item says what is missing, each not-applicable item a reason; reviewed within {{ASSESSMENT_MONTHS}} months',
      description: 'A scheduled job, and every pull request, reads security/sdl/checklist.yaml, whose keys are this pack\'s short names for the ten practices on Microsoft\'s SDL page in the page\'s order, and fails on a missing practice, an unsupported status or a stale review date.',
      tool: 'Node.js with js-yaml (scripts/security/sdl-check.mjs) in a scheduled GitHub Actions job',
      language: 'js',
      snippet: `// scripts/security/sdl-check.mjs; security/sdl/checklist.yaml looks like:
//   reviewed: 2026-09-20
//   practices: { threat-modeling: { status: partial, evidence: [docs/threat-model.md], missing: "the admin UI" }, ... }
import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const PRACTICES = ['standards-governance', 'proven-features', 'threat-modeling', 'cryptography', 'supply-chain',
  'engineering-environment', 'security-testing', 'platform-security', 'monitoring-response', 'training']
const MONTHS = {{ASSESSMENT_MONTHS}}
const list = yaml.load(readFileSync('security/sdl/checklist.yaml', 'utf8'), { schema: yaml.JSON_SCHEMA })
const oldest = new Date(); oldest.setMonth(oldest.getMonth() - MONTHS)
const errors = []
if (!(new Date(list.reviewed) >= oldest)) errors.push(\`checklist last reviewed \${list.reviewed}\`)
for (const id of PRACTICES) {
  const p = list.practices?.[id] ?? {}
  if (p.status === 'not-applicable') { if (!p.reason) errors.push(\`\${id}: not applicable without a reason\`); continue }
  if (!['done', 'partial'].includes(p.status)) { errors.push(\`\${id}: status is \${p.status}\`); continue }
  if (!p.evidence?.length || p.evidence.some((e) => !e.startsWith('https://') && !existsSync(e))) errors.push(\`\${id}: evidence missing\`)
  if (p.status === 'partial' && !p.missing) errors.push(\`\${id}: partial without saying what is missing\`)
}
if (errors.length) { console.error(errors.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-champions', label: 'A champion named for each team', when: { CHAMPIONS: ['champions'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'weekly', invocation: 'automated', implements: ['adr-champions'], checks: ['req-champion'],
      threshold: '0 teams in CODEOWNERS without a champion in security/champions.yaml; every champion a member of their team and of {{SECURITY_TEAM}}, with at least {{CHAMPION_HOURS}} hours a week',
      description: 'A weekly job reads security/champions.yaml and the teams named in .github/CODEOWNERS, asks GitHub for the members of each team and of the champions\' team, and fails naming a team without a champion, a champion who has left their team or the champions\' team, or one with fewer hours than decided. With collective ownership (no CODEOWNERS), the teams listed in the file are checked.',
      tool: 'Node.js with js-yaml and the GitHub CLI (gh api orgs/{org}/teams/{team_slug}/members, a token with read access to the organisation\'s members)',
      language: 'js',
      snippet: `// scripts/security/champions-check.mjs; security/champions.yaml: { teams: { order-team: { champion: alice, hours: 4 } } }
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const ORG = process.env.GITHUB_REPOSITORY_OWNER, HOURS = {{CHAMPION_HOURS}}
const { teams = {} } = yaml.load(readFileSync('security/champions.yaml', 'utf8'), { schema: yaml.JSON_SCHEMA })
const members = (team) => JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', \`orgs/\${ORG}/teams/\${team}/members\`], { encoding: 'utf8' })).flat().map((m) => m.login)
const owners = existsSync('.github/CODEOWNERS')
  ? [...readFileSync('.github/CODEOWNERS', 'utf8').matchAll(new RegExp(\`@\${ORG}/([\\\\w.-]+)\`, 'gi'))].map((m) => m[1]) : []
const errors = []
for (const team of new Set(owners)) if (!teams[team]) errors.push(\`\${team} owns code but has no champion\`)
const reviewers = members('{{SECURITY_TEAM}}')
for (const [team, c] of Object.entries(teams)) {
  if (!c?.champion) { errors.push(\`\${team}: no champion named\`); continue }
  if (!members(team).includes(c.champion)) errors.push(\`\${team}: \${c.champion} is not in the team\`)
  if (!reviewers.includes(c.champion)) errors.push(\`\${team}: \${c.champion} is not in {{SECURITY_TEAM}}\`)
  if (!(c.hours >= HOURS)) errors.push(\`\${team}: \${c.hours ?? 0} hours a week, fewer than \${HOURS}\`)
}
if (errors.length) { console.error(errors.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-security-review', label: 'Labelled changes need a security approval', when: REVIEWED, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'manual', implements: ['adr-champions', 'adr-appsec'], checks: ['req-champion-review', 'req-appsec-review'],
      threshold: '0 pull requests with the security-review label merged without an approval, still standing, from a member of {{SECURITY_TEAM}} who is not the author',
      description: 'A workflow runs on every change to a pull request\'s labels, commits and reviews; when the security-review label is set, it fails unless the latest review of some member of {{SECURITY_TEAM}} other than the author is an approval. The job is a required check of main, in the ruleset the Code review and branching pack keeps. GITHUB_TOKEN cannot list team members, so the workflow uses a token with read access to the organisation\'s members (a GitHub App installation token or a fine-grained token) stored as ORG_READ_TOKEN.',
      tool: 'GitHub Actions with the GitHub CLI (pulls/{pull_number}/reviews and orgs/{org}/teams/{team_slug}/members)',
      language: 'yaml',
      snippet: `# .github/workflows/security-review.yml
name: security-review
on:
  pull_request:
    types: [opened, reopened, synchronize, labeled, unlabeled]
  pull_request_review:
    types: [submitted, dismissed]
jobs:
  security-review:
    runs-on: ubuntu-latest
    steps:
      - name: Approved by a security reviewer
        if: contains(github.event.pull_request.labels.*.name, 'security-review')
        env:
          GH_TOKEN: \${{ secrets.ORG_READ_TOKEN }}
          PR: \${{ github.event.pull_request.number }}
          AUTHOR: \${{ github.event.pull_request.user.login }}
        run: |
          team=$(gh api --paginate "orgs/$GITHUB_REPOSITORY_OWNER/teams/{{SECURITY_TEAM}}/members" --jq '.[].login')
          approvers=$(gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$PR/reviews" --jq '.[] | select(.state != "COMMENTED") | "\\(.user.login) \\(.state)"' \\
            | awk '{ last[$1] = $2 } END { for (u in last) if (last[u] == "APPROVED") print u }')
          for u in $approvers; do
            if [ "$u" != "$AUTHOR" ] && grep -qxF "$u" <<< "$team"; then exit 0; fi
          done
          echo "the security-review label needs an approval from {{SECURITY_TEAM}}"; exit 1`,
    },
    {
      id: 'ff-one-team', label: 'One team owns the code', when: { CHAMPIONS: ['none'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-no-security-role'], checks: ['req-one-team'],
      threshold: 'At most 1 distinct team named in .github/CODEOWNERS',
      description: 'A check on every pull request counts the distinct teams that .github/CODEOWNERS names (written @org/team) and fails above one, so that a second team cannot own code while the decision that nobody has security as a role stands. Without a CODEOWNERS file (collective ownership) it passes.',
      tool: 'grep in a GitHub Actions step',
      language: 'bash',
      snippet: `# a step of the pull request workflow
set -euo pipefail
[ -f .github/CODEOWNERS ] || exit 0
teams=$(grep -v '^[[:space:]]*#' .github/CODEOWNERS | grep -oE '@[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+' | tr '[:upper:]' '[:lower:]' | sort -u)
count=$(printf '%s' "$teams" | grep -c . || true)
if [ "$count" -gt 1 ]; then
  echo "CODEOWNERS names $count teams; supersede the decision that nobody has security as a role:"
  echo "$teams"
  exit 1
fi`,
    },
    {
      id: 'ff-appsec-wait', label: 'Security reviews given in time', when: { CHAMPIONS: ['appsec'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-appsec'], checks: ['req-appsec-review'],
      threshold: '0 open pull requests labelled security-review for more than {{APPSEC_REVIEW_DAYS}} days without an approval from {{SECURITY_TEAM}}',
      description: 'A daily job lists the open pull requests with the security-review label, skips those a member of {{SECURITY_TEAM}} has approved, finds when the label was last added from the issue\'s events, and fails naming each one that has waited longer than the deadline, so the wait shows up before the team learns to avoid the label.',
      tool: 'GitHub CLI (gh pr list, gh pr view --json latestReviews, gh api issues/{issue_number}/events) in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `# scheduled daily, with GH_TOKEN able to read the organisation's teams
set -euo pipefail
team=$(gh api --paginate "orgs/{owner}/teams/{{SECURITY_TEAM}}/members" --jq '.[].login')
late=0
for pr in $(gh pr list --label security-review --state open --json number --jq '.[].number'); do
  approved=$(gh pr view "$pr" --json latestReviews --jq '.latestReviews[] | select(.state == "APPROVED") | .author.login' \\
    | grep -cxF -f <(printf '%s\\n' "$team") || true)
  [ "$approved" -gt 0 ] && continue
  since=$(gh api --paginate "repos/{owner}/{repo}/issues/$pr/events" \\
    --jq '.[] | select(.event == "labeled" and .label.name == "security-review") | .created_at' | tail -1)
  days=$(( ( $(date +%s) - $(date -d "$since" +%s) ) / 86400 ))
  if [ "$days" -gt {{APPSEC_REVIEW_DAYS}} ]; then echo "#$pr has waited $days days for a security review"; late=1; fi
done
exit "$late"`,
    },
    {
      id: 'ff-pentest-age', label: 'Penetration test not older than the limit', when: { PENTEST: ['yearly'] }, characteristic: 'security', scope: 'holistic', cadence: 'temporal', every: '365d', invocation: 'manual', implements: ['adr-pentest'], checks: ['req-pentest-yearly'],
      threshold: 'The newest penetration test in security/pentests.yaml is at most {{PENTEST_MONTHS}} months old',
      description: 'A scheduled job reads the dates of the tests recorded in security/pentests.yaml and fails when the newest is older than the limit, a month before which the next test should already be booked.',
      tool: 'Node.js with js-yaml (scripts/security/pentest-age.mjs) in a scheduled GitHub Actions job',
      language: 'js',
      snippet: `// scripts/security/pentest-age.mjs
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const MONTHS = {{PENTEST_MONTHS}}
const { tests = [] } = yaml.load(readFileSync('security/pentests.yaml', 'utf8'), { schema: yaml.JSON_SCHEMA })
const newest = tests.map((t) => new Date(t.date)).sort((a, b) => b - a)[0]
const oldest = new Date(); oldest.setMonth(oldest.getMonth() - MONTHS)
if (!(newest >= oldest)) {
  console.error(\`no penetration test in the last \${MONTHS} months (newest: \${newest?.toISOString().slice(0, 10) ?? 'none'})\`)
  process.exit(1)
}`,
    },
    {
      id: 'ff-pentest-record', label: 'Tests recorded, findings filed, major releases tested', when: TESTED, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'release', invocation: 'automated', implements: ['adr-pentest'], checks: ['req-pentest-yearly', 'req-pentest-major'],
      threshold: 'Every recorded test names its tester, scope and report and had its findings filed within {{PENTEST_TRIAGE_DAYS}} days; every tag matching {{MAJOR_TAGS}} since the decision has a test for it dated no later than the tag',
      description: 'A job on every pushed tag, and weekly, reads security/pentests.yaml and the repository\'s tags, and fails on a test without its tester, scope or report link, findings filed late, or a major release tag with no test, or only one dated after the tag. Tags created before the date in adopted: are not checked.',
      tool: 'Node.js with js-yaml and git for-each-ref (scripts/security/pentest-record.mjs) in GitHub Actions',
      language: 'js',
      snippet: `// scripts/security/pentest-record.mjs; security/pentests.yaml looks like:
//   adopted: 2026-11-01
//   tests: [{ date: 2027-03-10, tester: Example Security Ltd, scope: Order API and Storefront, release: v3.0.0, report: https://..., findings_filed: 2027-03-14 }]
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const MAJOR = /{{MAJOR_TAGS}}/, TRIAGE_DAYS = {{PENTEST_TRIAGE_DAYS}}
const { adopted, tests = [] } = yaml.load(readFileSync('security/pentests.yaml', 'utf8'), { schema: yaml.JSON_SCHEMA })
const errors = []
for (const t of tests) {
  if (!t.tester || !t.scope || !t.report) errors.push(\`test of \${t.date}: tester, scope and report are required\`)
  if (!((new Date(t.findings_filed) - new Date(t.date)) / 86_400_000 <= TRIAGE_DAYS)) errors.push(\`test of \${t.date}: findings not filed within \${TRIAGE_DAYS} days\`)
}
const tags = execFileSync('git', ['for-each-ref', 'refs/tags', '--format=%(refname:short) %(creatordate:short)'], { encoding: 'utf8' })
  .split('\\n').filter(Boolean).map((line) => line.split(' '))
for (const [tag, date] of tags.filter(([tag, date]) => MAJOR.test(tag) && new Date(date) >= new Date(adopted))) {
  const t = tests.find((x) => x.release === tag)
  if (!t || new Date(t.date) > new Date(date)) errors.push(\`\${tag} (\${date}): no penetration test before the release\`)
}
if (errors.length) { console.error(errors.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-pentest-waiver', label: 'No-test record current', when: { PENTEST: ['none'] }, characteristic: 'security', scope: 'atomic', cadence: 'temporal', every: '365d', invocation: 'manual', implements: ['adr-no-pentest'], checks: ['req-pentest-none'],
      threshold: 'security/pentests.yaml holds a waiver with a reason and a replacement, reviewed within {{ASSESSMENT_MONTHS}} months',
      description: 'A scheduled job reads the waiver in security/pentests.yaml and fails when it has no reason, names nothing that replaces the test, or was last reviewed too long ago.',
      tool: 'Node.js with js-yaml (scripts/security/pentest-waiver.mjs) in a scheduled GitHub Actions job',
      language: 'js',
      snippet: `// scripts/security/pentest-waiver.mjs; security/pentests.yaml looks like:
//   waiver: { reason: internal tool, no personal data, replaced_by: [ZAP baseline scan per deploy (Secure coding)], reviewed: 2026-10-01 }
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const MONTHS = {{ASSESSMENT_MONTHS}}
const { waiver } = yaml.load(readFileSync('security/pentests.yaml', 'utf8'), { schema: yaml.JSON_SCHEMA })
const oldest = new Date(); oldest.setMonth(oldest.getMonth() - MONTHS)
const errors = []
if (!waiver?.reason) errors.push('the waiver gives no reason')
if (!waiver?.replaced_by?.length) errors.push('the waiver names nothing that replaces the test')
if (!(new Date(waiver?.reviewed) >= oldest)) errors.push(\`the waiver was last reviewed \${waiver?.reviewed}, more than \${MONTHS} months ago\`)
if (errors.length) { console.error(errors.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-training-onboarding', label: 'New committers trained', characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'weekly', invocation: 'automated', implements: FRAMEWORKS, checks: ['req-training-onboarding'],
      threshold: '0 people who committed in the last 90 days, first committed more than {{ONBOARDING_DAYS}} days ago, and have no completion of {{TRAINING_COURSE}}',
      description: 'A weekly job downloads the completions from the learning platform (its export or API, reduced to email,course,completed_on in training.csv and never committed), takes each author\'s first commit date from git log, and fails naming everyone who committed recently and is past the onboarding window without a completion. Commits must use the work address the learning platform knows; bots are skipped.',
      tool: 'Node.js and git log (scripts/security/training-onboarding.mjs) in a scheduled GitHub Actions job',
      language: 'js',
      snippet: `// scripts/security/training-onboarding.mjs; training.csv: email,course,completed_on (downloaded by the job, never committed)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const COURSE = '{{TRAINING_COURSE}}', DAYS = {{ONBOARDING_DAYS}}
const trained = new Set(readFileSync('training.csv', 'utf8').trim().split('\\n').slice(1)
  .map((l) => l.split(',')).filter(([, course]) => course === COURSE).map(([email]) => email.toLowerCase()))
const git = (...args) => execFileSync('git', ['log', '--no-merges', ...args], { encoding: 'utf8' }).split('\\n').filter(Boolean)
const first = new Map()
for (const line of git('--reverse', '--format=%ae %as')) {
  const [email, date] = line.split(' ')
  if (!first.has(email.toLowerCase())) first.set(email.toLowerCase(), new Date(date))
}
const recent = new Set(git('--since=90 days ago', '--format=%ae').map((e) => e.toLowerCase()).filter((e) => !/\\[bot\\]/.test(e)))
const due = (email) => (Date.now() - first.get(email)) / 86_400_000 > DAYS
const missing = [...recent].filter((email) => due(email) && !trained.has(email))
if (missing.length) { console.error(\`no completion of \${COURSE}:\\n\${missing.join('\\n')}\`); process.exit(1) }`,
    },
    {
      id: 'ff-training-yearly', label: 'Committers trained in the last 12 months', when: { TRAINING: ['yearly'] }, characteristic: 'security', scope: 'atomic', cadence: 'temporal', every: '365d', invocation: 'manual', implements: FRAMEWORKS, checks: ['req-training-yearly'],
      threshold: '0 people who committed in the last 90 days without a completion of {{TRAINING_COURSE}} in the last 12 months',
      description: 'The same weekly job compares each recent author\'s latest completion of the course with today, and fails naming everyone whose latest completion is older than 12 months.',
      tool: 'Node.js and git log (scripts/security/training-yearly.mjs) in a scheduled GitHub Actions job',
      language: 'js',
      snippet: `// scripts/security/training-yearly.mjs; training.csv: email,course,completed_on (downloaded by the job, never committed)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const COURSE = '{{TRAINING_COURSE}}'
const latest = new Map()
for (const [email, course, on] of readFileSync('training.csv', 'utf8').trim().split('\\n').slice(1).map((l) => l.split(','))) {
  const key = email.toLowerCase()
  if (course === COURSE && !(latest.get(key) > new Date(on))) latest.set(key, new Date(on))
}
const year = new Date(); year.setFullYear(year.getFullYear() - 1)
const recent = new Set(execFileSync('git', ['log', '--no-merges', '--since=90 days ago', '--format=%ae'], { encoding: 'utf8' })
  .split('\\n').filter((e) => e && !/\\[bot\\]/.test(e)).map((e) => e.toLowerCase()))
const lapsed = [...recent].filter((email) => !(latest.get(email) >= year))
if (lapsed.length) { console.error(\`\${COURSE} not completed in the last 12 months:\\n\${lapsed.join('\\n')}\`); process.exit(1) }`,
    },
  ],
}

export default pack
