import type { PackSpec, When } from '../../src/packSpec'

const FINANCIAL: When = { SCOPE: ['full', 'simplified'] }
const PROVIDER: When = { SCOPE: ['provider'] }
const TLPT_NAMED: When = { SCOPE: ['full'], TLPT: ['named'] }
const MAIN = ['adr-full', 'adr-simplified', 'adr-provider', 'adr-none']
const FINANCIAL_ADRS = ['adr-full', 'adr-simplified']
const REPORTING_ADRS = [...FINANCIAL_ADRS, 'adr-report-runbook', 'adr-report-outsourced']
const NEIGHBOURS = 'What other packs decide is only referred to here: change management, segregation of duties and emergency changes in the Definition of Done and change approval pack; backups and restore drills in Backup and recovery; availability targets in Availability; monitoring and paging in Observability; dependencies and the SBOM in Software supply chain; encryption in Encryption; audit records in Audit trail.'
const FORCES = 'The organisation that runs this system may be a financial entity, or may sell ICT services to financial entities, and so be bound by the EU Digital Operational Resilience Act (DORA, Regulation (EU) 2022/2554), which applies since 17 January 2025. The forces: whether and how DORA applies is a legal reading of the organisation\'s licences and clients, and a wrong reading is found by the supervisor, not by the team; a major ICT-related incident has to reach the competent authority within hours of being classified, at night and at weekends, and the clock starts when the entity becomes aware of the incident, not when someone finds the runbook; the register of information has to list every ICT service bought, and every new integration in the code is a new entry that procurement may never hear of; resilience tests and threat-led penetration tests run on a regulatory cycle, not when the team has time; and the contracts with ICT providers must say what DORA requires, which engineers rarely read. The DORA delivery metrics (deployment frequency and the others) share only the name; they are the Delivery metrics pack.'

const pack: PackSpec = {
  id: 'concern-eu-dora',
  name: 'EU DORA (Digital Operational Resilience Act)',
  group: 'compliance',
  description: 'Whether and how the EU Digital Operational Resilience Act (DORA, Regulation (EU) 2022/2554) applies to the system, and what it then asks of the system and its team: classifying ICT-related incidents and reporting the major ones to the competent authority on time, a register of the ICT third-party services the system calls, resilience testing and threat-led penetration testing, and the contract clauses an ICT provider offers. Not the DORA delivery metrics, which are the Delivery metrics pack. The snippets are Node 20 scripts with js-yaml, jq and bash.',
  tags: ['compliance', 'dora', 'operational resilience', 'incident reporting', 'third-party risk', 'financial services'],
  concern: {
    id: 'eu-dora',
    trigger: 'LIST NODES WHERE type = "system" AND external != true',
    why: 'the organisation running this system may be a financial entity or an ICT provider to one, so whether and how the EU Digital Operational Resilience Act (DORA, Regulation (EU) 2022/2554) applies to it has to be decided.',
  },
  sources: [
    { title: 'Regulation (EU) 2022/2554 on digital operational resilience for the financial sector (DORA)', url: 'https://eur-lex.europa.eu/eli/reg/2022/2554/oj' },
    { title: 'Commission Delegated Regulation (EU) 2024/1774: ICT risk management tools, methods, processes and policies, and the simplified ICT risk management framework', url: 'https://eur-lex.europa.eu/eli/reg_del/2024/1774/oj' },
    { title: 'Commission Delegated Regulation (EU) 2024/1772: criteria for classifying ICT-related incidents and materiality thresholds for major incidents', url: 'https://eur-lex.europa.eu/eli/reg_del/2024/1772/oj' },
    { title: 'Commission Delegated Regulation (EU) 2025/301: content and time limits for the initial notification and the intermediate and final reports on major ICT-related incidents', url: 'https://eur-lex.europa.eu/eli/reg_del/2025/301/oj' },
    { title: 'Commission Implementing Regulation (EU) 2025/302: standard forms, templates and procedures for reporting major ICT-related incidents', url: 'https://eur-lex.europa.eu/eli/reg_impl/2025/302/oj' },
    { title: 'Commission Implementing Regulation (EU) 2024/2956: standard templates for the register of information', url: 'https://eur-lex.europa.eu/eli/reg_impl/2024/2956/oj' },
    { title: 'Commission Delegated Regulation (EU) 2025/1190: threat-led penetration testing', url: 'https://eur-lex.europa.eu/eli/reg_del/2025/1190/oj' },
    { title: 'EBA: Digital Operational Resilience Act', url: 'https://www.eba.europa.eu/activities/direct-supervision-and-oversight/digital-operational-resilience-act' },
    { title: 'ESMA: Digital Operational Resilience Act (DORA)', url: 'https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/digital-operational-resilience-act-dora' },
    { title: 'EIOPA: Digital Operational Resilience Act (DORA)', url: 'https://www.eiopa.europa.eu/digital-operational-resilience-act-dora_en' },
    { title: 'The text of DORA by article (digital-operational-resilience-act.com)', url: 'https://www.digital-operational-resilience-act.com/' },
  ],
  questions: [
    {
      key: 'SCOPE', title: 'Scope', label: 'How does the EU Digital Operational Resilience Act (DORA, Regulation (EU) 2022/2554) apply to the organisation running this system?',
      hint: 'DORA binds the financial entities of Art. 2(1)(a) to (t) (banks, payment and e-money institutions, investment firms, insurers, crypto-asset service providers and the others listed) and reaches ICT third-party service providers through their clients\' contracts. Art. 2(3) excludes some, and Art. 16(1) gives a few a simplified framework. The answer is the compliance officer\'s reading, not the team\'s; it decides everything that follows.',
      default: 'full',
      options: [
        { value: 'full', label: 'a financial entity under the full framework', description: 'A financial entity of Art. 2(1)(a) to (t) that is not among those of Art. 16(1): Articles 5 to 15 and Title II of Delegated Regulation (EU) 2024/1774 apply, with incident reporting, the register of information, yearly resilience testing and, if named, threat-led penetration testing. Pick it when the organisation holds such a licence and is not small and non-interconnected or exempted. A microenterprise (Art. 3(60)) picks it too; DORA exempts it from the yearly test (Art. 24(6)) and has it test by a risk-based plan (Art. 25(3)), so the yearly test here is more than it needs.' },
        { value: 'simplified', label: 'a financial entity under the simplified framework (Art. 16)', description: 'Small and non-interconnected investment firms, payment and e-money institutions exempted under their directives, the exempted credit institutions of Art. 16(1), and small institutions for occupational retirement provision: Articles 5 to 15 give way to Art. 16 and Title III of Delegated Regulation (EU) 2024/1774, while incident reporting, the register and testing still apply and threat-led penetration testing does not (Art. 26(1)). Pick it when the compliance officer has confirmed the entity is one of those Art. 16(1) lists.' },
        { value: 'provider', label: 'an ICT third-party service provider to financial entities', description: 'The organisation provides ICT services (Art. 3(21)) to financial entities and is not one itself: DORA reaches it through its clients\' contracts (Art. 30), and the ESAs may designate it critical (Art. 31), which puts it under a Lead Overseer. Pick it when financial entities use this system as an ICT service.' },
        { value: 'none', label: 'outside DORA', description: 'Not a financial entity of Art. 2(1)(a) to (t), or excluded by Art. 2(3), and providing no ICT services to financial entities. Pick it when that is the compliance officer\'s conclusion; the decision records the basis, and a review on a fixed cycle keeps it true when the business changes.' },
      ],
    },
    {
      key: 'TLPT', title: 'TLPT', label: 'Has the competent authority named the entity for threat-led penetration testing?',
      hint: 'Competent authorities identify the financial entities that must carry out threat-led penetration testing (TLPT) at least every 3 years (Art. 26(1) and (8)), by the criteria of Delegated Regulation (EU) 2025/1190. Only for a financial entity under the full framework: entities under Art. 16(1) and microenterprises are excluded, and a provider takes part in its clients\' tests through their contracts.',
      default: 'not-named',
      options: [
        { value: 'named', label: 'named for threat-led penetration testing', description: 'The authority has told the entity it must carry out TLPT. Pick it when that notice has arrived; tests on live production, attestations and remediation plans follow.' },
        { value: 'not-named', label: 'not named for threat-led penetration testing', description: 'No such notice has arrived; the yearly resilience tests are the testing DORA asks for. Pick it until the authority names the entity; the decision records it so a later notice supersedes it.' },
      ],
    },
    {
      key: 'REPORTING', title: 'Reporting', label: 'Who files the reports on major ICT-related incidents with the authority?',
      hint: 'The initial notification is due within 4 hours of classifying an incident as major and no later than 24 hours after becoming aware of it (Delegated Regulation (EU) 2025/301, Art. 5); credit institutions, central counterparties and trading venue operators, among others, get no weekend extension for it (Art. 5(5)). The filing may be outsourced, but the entity stays fully responsible (DORA Art. 19(5)). Only for a financial entity.',
      default: 'runbook',
      options: [
        { value: 'runbook', label: 'our own on-call filers with a runbook', description: 'A rota of people who can file through the authority\'s reporting channel at any hour, a runbook with the thresholds, deadlines and forms, and a yearly dry run. Pick it when the organisation already runs on-call around the clock, or wants the reports in its own hands.' },
        { value: 'outsourced', label: 'a reporting service provider (Art. 19(5))', description: 'A third party files the reports under a contract that holds it to the deadlines; the on-call engineer classifies and hands over. Pick it when no one in-house can file within 4 hours at any hour, or a group company files for the whole group.' },
      ],
    },
    {
      key: 'REGISTER', title: 'Register', label: 'Where is the register of information kept?',
      hint: 'Art. 28(3) asks for a register of every contractual arrangement for ICT services, reported to the authority at least yearly on the templates of Implementing Regulation (EU) 2024/2956 (as xBRL-CSV, per the ESAs\' reporting package). Either way, the external systems in the architecture model are the check that nothing the system calls is missing. Only for a financial entity.',
      default: 'model',
      options: [
        { value: 'model', label: 'a register file in the repository, checked against the model', description: 'compliance/dora/register.yaml holds one entry per ICT third-party service, named by the external system\'s label in the architecture model, and the build fails when the system calls an external system without one. Pick it when this system holds most of the entity\'s ICT arrangements and engineers keep them current.' },
        { value: 'grc', label: 'a GRC tool, reconciled with the model', description: 'The register lives in the organisation\'s GRC or third-party risk tool, which produces the report for the authority; a nightly CSV export is compared with the model\'s external systems. Pick it when procurement and compliance already keep the contracts of the whole entity there.' },
      ],
    },
  ],
  details: [
    { key: 'AUTHORITY', label: 'Which competent authority receives the incident reports and the register (for example BaFin, the Central Bank of Ireland, KNF)? (a financial entity only)', default: 'the competent authority' },
    { key: 'CLASSIFY_HOURS', label: 'Within how many hours of becoming aware of an ICT-related incident is it classified? Keep it well under 24: a major one must be notified no later than 24 hours after becoming aware (a financial entity only)', default: '4', number: true },
    { key: 'TEST_MONTHS', label: 'How many months may pass between resilience tests of a system supporting critical or important functions (at most 12)? (a financial entity only)', default: '12', number: true },
    { key: 'TLPT_MONTHS', label: 'How many months may pass between threat-led penetration tests (36, unless the authority sets another frequency)? (named for threat-led penetration testing only)', default: '36', number: true },
    { key: 'SCOPE_REVIEW_MONTHS', label: 'How many months may pass before the DORA scope decision is reviewed again?', default: '12', number: true },
    { key: 'CLIENT_NOTICE_HOURS', label: 'Within how many hours of detecting an incident on a service they use are financial-entity clients told, as the contracts set? (an ICT third-party service provider only)', default: '4', number: true },
  ],
  need: {
    label: 'Operational resilience the supervisor can verify',
    text: 'The organisation that runs this system may be bound by the EU Digital Operational Resilience Act (DORA, Regulation (EU) 2022/2554), as a financial entity or as an ICT provider to one. Where it is, the team must classify ICT-related incidents and report the major ones to the competent authority within hours, keep a register of the ICT services the system buys, test the system on a regulatory cycle and hold contracts that say what DORA requires, and it must be able to show all of it at any time. This pack describes what the system and its team do and how they prove it; it is not legal advice, and whether and how DORA applies is for the organisation\'s compliance officer and legal counsel to decide. The snippets assume the records under compliance/dora/ (scope.yaml, register.yaml or subcontractors.yaml, resilience-tests.yaml), the runbook at docs/dora/incident-reporting.md, the contract addendum at contracts/dora-addendum.md, the architecture model as a Radical Markdown folder under architecture/, the incident tool\'s export at reports/incidents.json, and the checks under tools/dora/ (Node 20 with js-yaml and csv-parse, jq).',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-scope', label: 'DORA scope recorded and reviewed', ears_type: 'ubiquitous',
      action: 'keep the decision on how the EU Digital Operational Resilience Act (DORA, Regulation (EU) 2022/2554) applies to the organisation running it in compliance/dora/scope.yaml, with the scope, its basis in the articles of the Regulation, who reviewed it and when, and review it at least every {{SCOPE_REVIEW_MONTHS}} months and whenever the organisation gains a licence, a financial-entity client or a designation',
      rationale: 'Who DORA binds follows from the licences listed in Art. 2(1), the exclusions of Art. 2(3), the simplified framework of Art. 16(1) and the designation of critical ICT providers under Art. 31; each can change with the business, and a scope nobody wrote down cannot be reviewed.',
      scenario: { label: 'Scope record kept current', given: 'compliance/dora/scope.yaml', when: 'the build runs', then: 'it fails when the scope, its basis, the reviewer or the review date is missing, or the review is older than {{SCOPE_REVIEW_MONTHS}} months' },
    },
    {
      id: 'req-classify', label: 'ICT incidents classified', when: FINANCIAL, ears_type: 'event-driven',
      trigger: 'an ICT-related incident is detected or reported',
      action: 'record it in the incident tool and classify it against the criteria of DORA Art. 18(1) and the materiality thresholds of Delegated Regulation (EU) 2024/1772 within {{CLASSIFY_HOURS}} hours of becoming aware of it, recording which thresholds were met and whether it is major',
      rationale: 'DORA Art. 17 asks for a process that records and classifies every ICT-related incident and Art. 18(1) names the criteria; Delegated Regulation (EU) 2024/1772 Art. 8 makes an incident major when it affects critical services and either meets the threshold for malicious unauthorised access (Art. 9(5)(b)) or two other thresholds. The reporting clock starts at awareness, so a late classification eats the time to report.',
      scenario: { label: 'Incident classified in time', given: 'an ICT-related incident the entity became aware of', when: '{{CLASSIFY_HOURS}} hours have passed', then: 'the incident record holds a classification, the thresholds met and whether it is major, or the daily check reports it as classified late' },
    },
    {
      id: 'req-report', label: 'Major incidents reported on time', when: FINANCIAL, ears_type: 'event-driven',
      trigger: 'an ICT-related incident is classified as major',
      action: 'send {{AUTHORITY}} the initial notification within 4 hours of the classification and no later than 24 hours after becoming aware of the incident (within 4 hours of a classification made later than that), an intermediate report within 72 hours of the initial notification and an updated one once regular activities are recovered, and the final report within one month of the latest intermediate report, on the templates of Implementing Regulation (EU) 2025/302',
      rationale: 'DORA Art. 19(1) and (4) require the three reports; Delegated Regulation (EU) 2025/301 Art. 5 sets their time limits, with an extension to noon of the next working day for deadlines on weekends and bank holidays that does not cover the first two reports of credit institutions, central counterparties and trading venue operators (Art. 5(4) and (5)). Holding to the deadlines without the extension is always on time.',
      scenario: { label: 'Major incident reported on time', given: 'an incident classified as major 2 hours after the entity became aware of it', when: 'the reports are filed', then: 'the initial notification is filed within 4 hours of the classification, the intermediate report within 72 hours of the initial notification, and the final report within one month of the latest intermediate report' },
    },
    {
      id: 'req-runbook', label: 'Reporting runbook ready', when: FINANCIAL, ears_type: 'ubiquitous',
      action: 'keep a runbook at docs/dora/incident-reporting.md that names {{AUTHORITY}}, its reporting channel, the classification criteria and thresholds, the three deadlines, the report templates and who files at any hour, so that whoever is on call can file without asking anyone',
      rationale: 'DORA Art. 17(3) asks for roles and responsibilities and communication plans in the incident process, and Art. 19(5) leaves the entity fully responsible even when filing is outsourced; at 03:00 the runbook is what the person on call has.',
      scenario: { label: 'Runbook names what the filer needs', given: 'the runbook', when: 'the build runs', then: 'it fails unless the runbook names {{AUTHORITY}}, the regulations, the 4-hour, 24-hour, 72-hour and one-month deadlines and has sections on classification, the reporting channel and who files' },
    },
    {
      id: 'req-clients', label: 'Clients told of major incidents', when: FINANCIAL, ears_type: 'event-driven',
      trigger: 'a major ICT-related incident has an impact on the financial interests of clients',
      action: 'inform those clients without undue delay of the measures taken to limit its adverse effects, and record when they were informed',
      rationale: 'DORA Art. 19(3) requires it as soon as the entity becomes aware of the incident; the record is how the entity shows it did.',
      scenario: { label: 'Affected clients informed', given: 'a major incident that affected clients\' payments', when: 'the incident record is checked', then: 'it holds the time the clients were informed, or the daily check reports it' },
    },
    {
      id: 'req-register', label: 'Every ICT service in the register', when: FINANCIAL, ears_type: 'ubiquitous',
      action: 'keep a register-of-information entry for every ICT third-party service the system uses, that is every external system the system or its parts call in the architecture model, with the contractual arrangement reference, the provider\'s LEI or EUID, the type of ICT service (S01 to S19 of Annex III of Implementing Regulation (EU) 2024/2956), the function it supports, whether that function is critical or important, and the countries where the service is provided and its data kept',
      rationale: 'DORA Art. 28(3) requires a register of all contractual arrangements for ICT services, distinguishing those that support critical or important functions; Implementing Regulation (EU) 2024/2956 keys it by the arrangement reference, the provider\'s identifier, the function and the type of ICT service, and Art. 30(2)(b) asks for the locations. An integration added in code is a new arrangement the register must show.',
      scenario: { label: 'New integration needs an entry', given: 'a change that adds a call from the system to an external system in the architecture model', when: 'the build runs', then: 'it fails until the register has an entry for that external system with every field filled' },
    },
    {
      id: 'req-critical-contracts', label: 'Critical services under full contracts', when: FINANCIAL, ears_type: 'ubiquitous',
      action: 'hold, for every ICT third-party service that supports a critical or important function, a contract with the clauses of DORA Art. 30(3) (service levels with quantitative targets, notice and reporting obligations, business continuity testing, participation in TLPT, audit and inspection rights, an exit strategy with a transition period) and an exit plan named in its register entry',
      rationale: 'DORA Art. 30(3) lists the extra clauses for services supporting critical or important functions and Art. 28(8) requires documented exit strategies for them; the register entry is where an engineer sees that a service is critical.',
      scenario: { label: 'Critical service without exit plan refused', given: 'a register entry marked critical', when: 'it has no exit plan or no Art. 30(3) clauses', then: 'the register check fails naming the entry' },
    },
    {
      id: 'req-register-submit', label: 'Register submitted to the authority', when: FINANCIAL, ears_type: 'event-driven',
      trigger: 'the competent authority\'s yearly reporting date for the register comes, or the authority asks for the register',
      action: 'submit the register to {{AUTHORITY}} in the format it requires, and inform it in good time of any planned arrangement for ICT services supporting a critical or important function',
      rationale: 'DORA Art. 28(3) requires reporting at least yearly, making the full register available on request, and informing the authority of planned arrangements for critical or important functions.',
      scenario: { label: 'Register submitted on the reporting date', given: 'the authority\'s reporting date for the register', when: 'it arrives', then: 'the register has been submitted and the authority\'s acknowledgement is kept with it' },
      unchecked: 'The compliance officer submits the register on the authority\'s yearly reporting date and tells it of planned arrangements for critical or important functions; the authority\'s acknowledgement is the evidence, and no build can see it.',
    },
    {
      id: 'req-testing', label: 'Critical systems tested on the cycle', when: FINANCIAL, ears_type: 'ubiquitous',
      action: 'test every ICT system and application supporting critical or important functions at least every {{TEST_MONTHS}} months under a digital operational resilience testing programme, by testers independent of its team, with tests of the kinds DORA Art. 25(1) lists chosen by risk, record each test in compliance/dora/resilience-tests.yaml, and fix each finding by the date its priority sets',
      rationale: 'DORA Art. 24(6) requires tests at least yearly of all ICT systems and applications supporting critical or important functions, Art. 24(4) independent testers, internal or external, Art. 24(5) procedures to prioritise and remedy what the tests reveal, and Art. 25(1) lists the kinds of test.',
      scenario: { label: 'Overdue test fails the check', given: 'a system supporting a critical function whose last test is {{TEST_MONTHS}} months and a day old', when: 'the check runs', then: 'it fails naming the system, and it also fails on any finding open past its due date' },
    },
    {
      id: 'req-tlpt', label: 'Threat-led penetration test on the cycle', when: TLPT_NAMED, ears_type: 'ubiquitous',
      action: 'carry out threat-led penetration testing at least every {{TLPT_MONTHS}} months on the live production systems supporting several or all critical or important functions, under Delegated Regulation (EU) 2025/1190, with testers meeting DORA Art. 27 and the ICT third-party providers of those functions taking part, and notify {{AUTHORITY}} of the attestation each test ends with',
      rationale: 'DORA Art. 26(1) requires TLPT at least every 3 years of the entities the authority identifies, Art. 26(2) on live production systems supporting critical or important functions, Art. 26(3) with their ICT providers taking part, and Art. 26(7) an attestation the entity notifies; Art. 27 sets the testers\' requirements.',
      scenario: { label: 'TLPT overdue', given: 'a last threat-led penetration test that ended {{TLPT_MONTHS}} months and a day ago', when: 'the check runs', then: 'it fails, and it also fails when the last test has no attestation' },
    },
    {
      id: 'req-provider-notice', label: 'Clients told of incidents on their service', when: PROVIDER, ears_type: 'event-driven',
      trigger: 'an ICT-related incident affects a service that financial-entity clients use',
      action: 'tell the affected clients within {{CLIENT_NOTICE_HOURS}} hours of detecting it, with the number of their clients affected, the duration and downtime, data losses, the Member States affected and the economic impact, so that they can classify it under Delegated Regulation (EU) 2024/1772',
      rationale: 'DORA Art. 30(2)(f) obliges the provider to assist its clients when an ICT incident related to its service occurs; the clients need these facts for the criteria of Art. 18(1) and must notify a major incident within 4 hours of classifying it.',
      scenario: { label: 'Clients told with the facts', given: 'an incident on a service financial-entity clients use', when: '{{CLIENT_NOTICE_HOURS}} hours have passed since detection', then: 'the clients have been told, and the notice carries clients affected, duration, downtime, data losses, Member States and economic impact' },
    },
    {
      id: 'req-subcontractors', label: 'Subcontractors known to clients', when: PROVIDER, ears_type: 'ubiquitous',
      action: 'keep a list of the ICT subcontractors the service relies on, that is every external system it calls in the architecture model, with the legal entity, the services, the locations of data and the client-facing functions each supports, and give it to clients when it changes',
      rationale: 'DORA Art. 30(2)(a) and (b) put the conditions for subcontracting and the locations of services and data into the clients\' contracts, and Implementing Regulation (EU) 2024/2956 Art. 2 has clients rank the providers in their supply chain; both need the provider\'s list.',
      scenario: { label: 'New subcontractor listed', given: 'a change that adds a call from the service to an external system in the architecture model', when: 'the build runs', then: 'it fails until the subcontractor list has an entry for it with legal entity, services, data locations and functions' },
    },
    {
      id: 'req-provider-contract', label: 'Contract addendum covers DORA', when: PROVIDER, ears_type: 'ubiquitous',
      action: 'offer financial-entity clients a contract addendum with a section for each clause DORA Art. 30(2) requires and, for services supporting their critical or important functions, each clause of Art. 30(3)',
      rationale: 'DORA Art. 30 lists what the clients\' contracts must hold; one addendum kept with the service is one promise to keep instead of one per client.',
      scenario: { label: 'Addendum complete', given: 'contracts/dora-addendum.md', when: 'the build runs', then: 'it fails when a clause of Art. 30(2) or 30(3) has no section' },
    },
  ],
  adrs: [
    {
      id: 'adr-full', label: 'DORA applies in full', when: { SCOPE: ['full'] },
      decision: `The organisation running this system is a financial entity under the full framework of the EU Digital Operational Resilience Act (DORA, Regulation (EU) 2022/2554), applying since 17 January 2025; its ICT risk management follows DORA Articles 5 to 15 and Title II of Delegated Regulation (EU) 2024/1774, kept by the compliance function. For this system: ICT-related incidents are recorded in the incident tool (incident.io, PagerDuty or Jira Service Management, with custom fields for the criteria of Delegated Regulation (EU) 2024/1772) and classified within {{CLASSIFY_HOURS}} hours; major ones are reported to {{AUTHORITY}} on the templates of Implementing Regulation (EU) 2025/302 within the time limits of Delegated Regulation (EU) 2025/301, filed by {{REPORTING}}. The register of information: {{REGISTER}}. Systems supporting critical or important functions are tested at least every {{TEST_MONTHS}} months; the entity is {{TLPT}}. ${NEIGHBOURS}`,
      consequences: '• Every major incident costs three reports, the first within hours, day or night: someone able to file must always be reachable.\n• A new integration in a pull request needs a contract reference before it merges, which slows down trying a new SaaS.\n• Yearly resilience tests and their remediation dates become part of the plan, with independent testers to pay for.\n• The records live in the repository beside the code, so the supervisor\'s questions are answered from the same source the engineers change.\n• The legal reading stays with the compliance officer; the pack covers only what the system and its team must show.',
      alternatives: '1. The simplified framework of Art. 16: less ICT risk management to document, but only for the entities Art. 16(1) lists.\n2. DORA as a yearly compliance project outside engineering: cheaper day to day, but the register and the runbook drift from the system between audits.',
    },
    {
      id: 'adr-simplified', label: 'DORA applies with the simplified framework', when: { SCOPE: ['simplified'] },
      decision: `The organisation running this system is a financial entity under the simplified ICT risk management framework of the EU Digital Operational Resilience Act (DORA, Regulation (EU) 2022/2554), applying since 17 January 2025: Art. 16 and Title III of Delegated Regulation (EU) 2024/1774 replace Articles 5 to 15, kept by the compliance function. Incident reporting, the register of information and resilience testing apply as to any financial entity, and threat-led penetration testing does not (Art. 26(1)). For this system: ICT-related incidents are recorded in the incident tool (incident.io, PagerDuty or Jira Service Management, with custom fields for the criteria of Delegated Regulation (EU) 2024/1772) and classified within {{CLASSIFY_HOURS}} hours; major ones are reported to {{AUTHORITY}} on the templates of Implementing Regulation (EU) 2025/302 within the time limits of Delegated Regulation (EU) 2025/301, filed by {{REPORTING}}. The register of information: {{REGISTER}}. Systems supporting critical or important functions are tested at least every {{TEST_MONTHS}} months. ${NEIGHBOURS}`,
      consequences: '• Less to document for ICT risk management, but the same incident deadlines as the largest bank.\n• A new integration in a pull request needs a contract reference before it merges.\n• No threat-led penetration testing; yearly resilience tests still need independent testers.\n• Growth or a change of licence can end the simplified framework: the scope review has to catch it.',
      alternatives: '1. The full framework anyway: more documentation than DORA asks, a head start if the entity grows out of Art. 16(1).\n2. Treating a small entity as out of scope: Art. 16 eases the framework, it does not remove reporting, the register or testing.',
    },
    {
      id: 'adr-provider', label: 'DORA reaches us through our clients', when: PROVIDER,
      decision: `The organisation provides ICT services to financial entities and is not one itself: the EU Digital Operational Resilience Act (DORA, Regulation (EU) 2022/2554) reaches it through its clients' contracts (Art. 30) until the ESAs designate it critical under Art. 31, which puts it under a Lead Overseer and supersedes this decision. The team offers a DORA addendum at contracts/dora-addendum.md with each clause of Art. 30(2) and (3); keeps the list of its ICT subcontractors at compliance/dora/subcontractors.yaml, checked against the external systems in the architecture model, for the clients' registers; tells affected clients of an incident within {{CLIENT_NOTICE_HOURS}} hours with the facts they need to classify it; and takes part in their threat-led penetration tests where a contract for a critical or important function asks. ${NEIGHBOURS}`,
      consequences: '• Clients, their auditors and their authorities may inspect and audit the service (Art. 30(3)(e)), which needs a prepared evidence room.\n• An incident notice within {{CLIENT_NOTICE_HOURS}} hours needs someone on call who can write it, at any hour.\n• Adding or changing a subcontractor becomes a notice to clients, not a purely technical change.\n• One addendum for all clients keeps one set of promises; clients with stronger demands still negotiate.\n• Designation as critical would bring direct oversight; this decision is superseded the day the ESAs designate the provider.',
      alternatives: '1. Negotiating DORA clauses client by client: no standard to maintain, and as many different promises as clients.\n2. Treating DORA as the clients\' problem: their contracts still bind the provider, and a provider that cannot show the clauses loses regulated clients.',
    },
    {
      id: 'adr-none', label: 'Outside DORA', when: { SCOPE: ['none'] },
      context: `${FORCES} Here the compliance officer has concluded that none of it applies to the organisation.`,
      decision: 'The EU Digital Operational Resilience Act (DORA, Regulation (EU) 2022/2554) does not apply to the organisation running this system: it is not a financial entity of Art. 2(1)(a) to (t), or is excluded by Art. 2(3), and provides no ICT services to financial entities. compliance/dora/scope.yaml records the basis and who reviewed it; the record is reviewed at least every {{SCOPE_REVIEW_MONTHS}} months, and applying for a financial licence or signing a financial-entity client supersedes this decision.',
      consequences: '• No incident reports, register or resilience-testing cycle are owed under DORA.\n• A new client in the financial sector can bring DORA in through its contract overnight; sales must tell the compliance officer.\n• The scope record and its review are the only cost, and the only evidence if anyone asks.',
      alternatives: '1. Following DORA voluntarily: good practice for incident handling and supplier lists, at a cost nobody requires.\n2. Recording nothing: cheaper today, and no basis to point to when a client or an authority asks.',
    },
    {
      id: 'adr-tlpt', label: 'Threat-led penetration testing on the authority\'s cycle', when: TLPT_NAMED,
      decision: 'The competent authority has named the entity for threat-led penetration testing: at least every {{TLPT_MONTHS}} months a test covering the critical or important functions it names runs on the live production systems supporting them, following Delegated Regulation (EU) 2025/1190 (built on the TIBER-EU framework), with threat intelligence from outside the entity and testers meeting Art. 27 (internal testers only with the authority\'s approval, Art. 27(2)); the ICT third-party providers of those functions take part, as their contracts require (Art. 30(3)(d)). The end date of the last test, its attestation and the functions it covered are kept in compliance/dora/scope.yaml under tlpt, and the remediation plan is tracked with the resilience-test findings.',
      consequences: '• A test takes months of preparation with a threat-intelligence provider and a red team, and a budget to match.\n• Live production is attacked on purpose: the test needs a control team and a way to stop it.\n• Findings and the remediation plan go to the authority (Art. 26(6)), so they are fixed on a schedule the authority sees.',
      alternatives: '1. Ordinary yearly penetration tests only: they do not meet Art. 26 once the entity is named.\n2. Internal testers only: possible solely with the authority\'s approval and external threat intelligence (Art. 27(2)).',
    },
    {
      id: 'adr-no-tlpt', label: 'Not named for threat-led penetration testing', when: { SCOPE: ['full'], TLPT: ['not-named'] },
      decision: 'The competent authority has not named the entity for threat-led penetration testing (Art. 26(8)); the resilience tests every {{TEST_MONTHS}} months are the testing DORA asks for. A notice from {{AUTHORITY}} naming the entity supersedes this decision, and the first test is then planned with the authority.',
      consequences: '• No red-team test on production and no attestation to keep.\n• A notice from the authority starts a project of months: the scope review should ask whether one is likely.',
      alternatives: '1. A voluntary TIBER-style test: realistic assurance, at a cost DORA does not ask for.\n2. Waiting without a record: the notice then finds no owner.',
    },
    {
      id: 'adr-report-runbook', label: 'Major incidents filed by our own on-call', when: { ...FINANCIAL, REPORTING: ['runbook'] },
      decision: 'At least two people trained to file with {{AUTHORITY}} are on the on-call rota around the clock, paged as the Observability pack decides; the runbook docs/dora/incident-reporting.md names the authority, its reporting channel, the thresholds of Delegated Regulation (EU) 2024/1772, the deadlines of Delegated Regulation (EU) 2025/301 and the templates of Implementing Regulation (EU) 2025/302. The on-call engineer classifies within {{CLASSIFY_HOURS}} hours of awareness and the filer submits. Once a year the filers fill the templates in a dry run from a past incident.',
      consequences: '• The reports stay in the hands of the people who know the incident.\n• Two trained filers on every rota is a real cost for a small team.\n• The dry run is the only practice; a real major incident may be the first filing.',
      alternatives: '1. A reporting service provider: filing at any hour bought in, with a hand-over to get right in the first hours.\n2. The compliance officer files alone: one person between the entity and a missed deadline.',
    },
    {
      id: 'adr-report-outsourced', label: 'Major incidents filed by a reporting provider', when: { ...FINANCIAL, REPORTING: ['outsourced'] },
      decision: 'A reporting service provider files the reports with {{AUTHORITY}} under DORA Art. 19(5), under a contract that binds it to the time limits of Delegated Regulation (EU) 2025/301 at any hour and names who at the provider receives the hand-over. The on-call engineer classifies within {{CLASSIFY_HOURS}} hours of awareness and hands over through the channel in the runbook docs/dora/incident-reporting.md, which also names the authority, the thresholds and the deadlines. The entity stays fully responsible for the reports.',
      consequences: '• Filing at any hour without training filers in-house.\n• The hand-over is the weak point: facts lost or late in it are the entity\'s fault, not the provider\'s.\n• The provider is itself an ICT third-party service and needs a register entry.',
      alternatives: '1. Our own on-call filers: no hand-over, at the cost of training and rotas.\n2. A group company files for the whole group: one team, as long as it is reachable at any hour.',
    },
    {
      id: 'adr-register-model', label: 'Register of information beside the model', when: { ...FINANCIAL, REGISTER: ['model'] },
      decision: 'The register entries for this system are kept in compliance/dora/register.yaml, one per ICT third-party service, named by the external system\'s label in the architecture model, with the fields the register templates of Implementing Regulation (EU) 2024/2956 key on (arrangement reference, provider LEI or EUID, function, type of ICT service S01 to S19) plus criticality, data locations and, for critical or important functions, the exit plan and the Art. 30(3) clauses. Every pull request runs a script that fails when the system calls an external system with no complete entry. The compliance officer builds the yearly xBRL-CSV report for {{AUTHORITY}} from this file.',
      consequences: '• A new integration cannot merge without its register entry: engineers and procurement meet in the pull request.\n• The file holds contract data in the code repository; who may read it follows the repository\'s access.\n• The report for the authority is built from a file, so a conversion step to the ESAs\' format is still needed.',
      alternatives: '1. A GRC tool reconciled with the model: one register for the whole entity, with an export to keep in step.\n2. A spreadsheet kept by procurement: no link to what the code calls, found incomplete at the yearly report.',
    },
    {
      id: 'adr-register-grc', label: 'Register of information in a GRC tool', when: { ...FINANCIAL, REGISTER: ['grc'] },
      decision: 'The register of information lives in the organisation\'s GRC or third-party risk tool, which produces the yearly report for {{AUTHORITY}}. A nightly job exports the register to reports/register-export.csv (columns provider, contract_reference, provider_id, ict_service_type, function_id, critical, data_locations, exit_plan, clauses_art_30_3, with provider holding the external system\'s label in the architecture model) and a script fails when the system calls an external system the export does not cover completely.',
      consequences: '• One register for the whole entity, kept by the people who own the contracts.\n• Engineers find out about a missing entry from a red nightly job, not before the merge.\n• The export\'s columns are a contract between the GRC tool and the check; a renamed column breaks it.',
      alternatives: '1. A register file in the repository: checked before the merge, but only for the systems whose repositories hold one.\n2. No reconciliation with the model: the register lists what procurement bought, not what the code calls.',
    },
  ],
  fitness: [
    {
      id: 'ff-scope', label: 'DORA scope record current', category: 'process', implements: MAIN, checks: ['req-scope'],
      threshold: 'compliance/dora/scope.yaml has a scope, a basis, a reviewer and a review date at most {{SCOPE_REVIEW_MONTHS}} months old',
      description: 'A script run in CI on every pull request and monthly on a schedule reads the scope record and fails when a field is missing or the last review is older than {{SCOPE_REVIEW_MONTHS}} months, so a stale scope shows up before the supervisor asks.',
      tool: 'Node 20 with js-yaml, in a CI step',
      language: 'js',
      snippet: `// tools/dora/scope-check.mjs — node tools/dora/scope-check.mjs compliance/dora/scope.yaml
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const MONTH_MS = 30.44 * 86_400_000
const scope = yaml.load(readFileSync(process.argv[2], 'utf8'), { schema: yaml.JSON_SCHEMA }) ?? {}
const problems = ['scope', 'basis', 'reviewed', 'reviewed_by'].filter((k) => !scope[k]).map((k) => \`no \${k}\`)
const age = (Date.now() - new Date(scope.reviewed).getTime()) / MONTH_MS
if (!(age <= {{SCOPE_REVIEW_MONTHS}})) problems.push(\`last reviewed \${scope.reviewed}: more than {{SCOPE_REVIEW_MONTHS}} months ago\`)
if (problems.length) { console.error(\`compliance/dora/scope.yaml: \${problems.join('; ')}\`); process.exit(1) }`,
    },
    {
      id: 'ff-runbook', label: 'Reporting runbook names authority and deadlines', when: FINANCIAL, category: 'structural', implements: REPORTING_ADRS, checks: ['req-runbook'],
      threshold: 'docs/dora/incident-reporting.md names {{AUTHORITY}}, the three regulations, the 4-hour, 24-hour, 72-hour and one-month deadlines and clients, and has sections Classification, Reporting channel and Who files',
      description: 'A CI step searches the runbook for the phrases a filer needs and for its three sections; a runbook that loses a deadline or the name of the authority in an edit fails the pull request.',
      tool: 'bash with grep, in a CI step',
      language: 'bash',
      snippet: String.raw`# CI: the incident reporting runbook names the authority, the classification rules, the deadlines and who files
set -euo pipefail
runbook=docs/dora/incident-reporting.md
missing=0
for phrase in '{{AUTHORITY}}' 'Delegated Regulation (EU) 2024/1772' 'Delegated Regulation (EU) 2025/301' 'Implementing Regulation (EU) 2025/302' \
  'initial notification' '4 hours' '24 hours' 'intermediate report' '72 hours' 'final report' 'one month' 'clients'; do
  grep -qiF -- "$phrase" "$runbook" || { echo "$runbook does not name: $phrase"; missing=1; }
done
for section in 'Classification' 'Reporting channel' 'Who files'; do
  grep -qiE "^#+ +$section" "$runbook" || { echo "$runbook has no section: $section"; missing=1; }
done
exit "$missing"`,
    },
    {
      id: 'ff-deadlines', label: 'Incidents classified and reported on time', when: FINANCIAL, category: 'operational', implements: REPORTING_ADRS, checks: ['req-classify', 'req-report', 'req-clients'],
      threshold: '0 incidents classified later than {{CLASSIFY_HOURS}} hours after awareness; 0 major incidents with an initial notification, first intermediate report or final report past its time limit, or with affected clients and no time they were informed',
      description: 'A daily CI job reads the incident tool\'s export (reports/incidents.json: id, major, aware_at, classified_at, initial_at, intermediate_at as a list, final_at, clients_affected, clients_informed_at; ISO 8601 UTC, null when not yet done) and computes each time limit of Delegated Regulation (EU) 2025/301 Art. 5(1) and (2); a report not yet filed counts as late once its time limit has passed. The weekend and bank-holiday extension of Art. 5(4) is not applied, so the check is stricter than the rule; a month is a calendar month as jq\'s mktime normalises it (31 January plus one month is 3 March).',
      tool: 'jq 1.7 in a bash CI step, over the export of incident.io, PagerDuty or Jira Service Management',
      language: 'bash',
      snippet: String.raw`# CI, daily: reports/incidents.json is the incident tool's export (ISO 8601 UTC times, null when not yet done)
set -euo pipefail
late=$(jq -r --argjson classify_h {{CLASSIFY_HOURS}} '
  def t: if . == null then null else sub("\\.[0-9]+"; "") | fromdateiso8601 end;
  def late($due; $at): if $at == null then now > $due else $at > $due end;
  .[] | . as $i | (.aware_at | t) as $aware | (.classified_at | t) as $cls | (.initial_at | t) as $init
  | ((.intermediate_at // []) | map(t)) as $mids
  | [ (select(late($aware + $classify_h * 3600; $cls)) | "classified late"),
      (select(.major) | (if $cls - $aware > 86400 then $cls + 14400 else ([$cls + 14400, $aware + 86400] | min) end) as $due
        | select(late($due; $init)) | "initial notification late"),
      (select(.major and $init != null) | select(late($init + 259200; $mids[0])) | "intermediate report late"),
      (select(.major and ($mids | length) > 0) | select(late($mids | max | gmtime | .[1] += 1 | mktime; .final_at | t)) | "final report late"),
      (select(.major and .clients_affected and .clients_informed_at == null) | "clients not informed") ]
  | select(length > 0) | "\($i.id): \(join(", "))"' reports/incidents.json)
[ -z "$late" ] || { echo "$late"; exit 1; }`,
    },
    {
      id: 'ff-register-model', label: 'Every called external system in the register file', when: { ...FINANCIAL, REGISTER: ['model'] }, category: 'structural', implements: [...FINANCIAL_ADRS, 'adr-register-model'], checks: ['req-register', 'req-critical-contracts'],
      threshold: '0 external systems called by an internal system in the architecture model without a register entry; 0 entries missing contract_reference, provider_id, function_id, data_locations, a true or false critical, or an ict_service_type of S01 to S19; 0 critical entries without exit_plan and clauses_art_30_3',
      description: 'A script on every pull request reads the architecture model folder (nodes/**/*.md with YAML front matter, a folder\'s _index.md being the parent of the files beside it, and relations.json), finds each system an internal system or one of its parts calls with an interacts relation and that is marked external, and looks up its entry by label in compliance/dora/register.yaml. An entry looks like: { provider: Partner, contract_reference: CTR-2025-014, provider_id: <LEI or EUID>, ict_service_type: S19, function_id: F-PAYMENTS, critical: true, data_locations: [DE, IE], exit_plan: docs/dora/exit/partner.md, clauses_art_30_3: [service levels, notice periods, business continuity testing, TLPT participation, audit rights, exit transition period] }.',
      tool: 'Node 20 with js-yaml, in a CI step',
      language: 'js',
      snippet: `// tools/dora/register-check.mjs — node tools/dora/register-check.mjs architecture compliance/dora/register.yaml
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import yaml from 'js-yaml'

const [model, registerFile] = process.argv.slice(2)
const nodes = new Map(), folders = new Map()
for (const file of readdirSync(join(model, 'nodes'), { recursive: true }).filter((f) => f.endsWith('.md'))) {
  const front = yaml.load(readFileSync(join(model, 'nodes', file), 'utf8').split(/^---$/m)[1])
  const index = file.endsWith('_index.md')
  nodes.set(front.id, { ...front, folder: index ? dirname(dirname(file)) : dirname(file) })
  if (index) folders.set(dirname(file), front.id)
}
const systemOf = (id) => { for (let n = nodes.get(id); n; n = nodes.get(folders.get(n.folder))) if (n.type === 'system') return n }
const called = new Set(JSON.parse(readFileSync(join(model, 'relations.json'), 'utf8')).filter((r) => r.relationType === 'interacts')
  .map((r) => [systemOf(r.sourceId), systemOf(r.targetId)]).filter(([s, t]) => s && !s.external && t?.external).map(([, t]) => t.label))
const register = new Map((yaml.load(readFileSync(registerFile, 'utf8')) ?? []).map((e) => [e.provider, e]))
const problems = [...called].flatMap((label) => {
  const e = register.get(label)
  if (!e) return [\`\${label}: called in the model, no register entry\`]
  const keys = ['contract_reference', 'provider_id', 'function_id', 'data_locations', ...(e.critical ? ['exit_plan', 'clauses_art_30_3'] : [])]
  return [...keys.filter((k) => !e[k]?.length), ...(typeof e.critical === 'boolean' ? [] : ['critical: true or false']),
    ...(/^S(0[1-9]|1\\d)$/.test(e.ict_service_type) ? [] : ['ict_service_type: S01 to S19'])].map((k) => \`\${label}: no \${k}\`)
})
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-register-grc', label: 'Every called external system in the GRC register', when: { ...FINANCIAL, REGISTER: ['grc'] }, category: 'structural', implements: [...FINANCIAL_ADRS, 'adr-register-grc'], checks: ['req-register', 'req-critical-contracts'],
      threshold: '0 external systems called by an internal system in the architecture model missing from the register export; 0 rows with an empty contract_reference, provider_id, ict_service_type, function_id or data_locations; 0 critical rows with an empty exit_plan or clauses_art_30_3',
      description: 'A nightly job exports the register from the GRC tool to reports/register-export.csv with the columns the decision names, then a script reads the architecture model folder (nodes/**/*.md with YAML front matter, _index.md for a folder\'s own node, relations.json), finds each external system an internal system calls, and fails when the export has no complete row for it.',
      tool: 'Node 20 with js-yaml and csv-parse 5, in a scheduled CI job after the GRC tool\'s CSV export',
      language: 'js',
      snippet: `// tools/dora/register-grc-check.mjs — node tools/dora/register-grc-check.mjs architecture reports/register-export.csv
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import yaml from 'js-yaml'
import { parse } from 'csv-parse/sync'
const [model, exportFile] = process.argv.slice(2)
const nodes = new Map(), folders = new Map()
for (const file of readdirSync(join(model, 'nodes'), { recursive: true }).filter((f) => f.endsWith('.md'))) {
  const front = yaml.load(readFileSync(join(model, 'nodes', file), 'utf8').split(/^---$/m)[1])
  const index = file.endsWith('_index.md')
  nodes.set(front.id, { ...front, folder: index ? dirname(dirname(file)) : dirname(file) })
  if (index) folders.set(dirname(file), front.id)
}
const systemOf = (id) => { for (let n = nodes.get(id); n; n = nodes.get(folders.get(n.folder))) if (n.type === 'system') return n }
const called = new Set(JSON.parse(readFileSync(join(model, 'relations.json'), 'utf8')).filter((r) => r.relationType === 'interacts')
  .map((r) => [systemOf(r.sourceId), systemOf(r.targetId)]).filter(([s, t]) => s && !s.external && t?.external).map(([, t]) => t.label))
const rows = new Map(parse(readFileSync(exportFile, 'utf8'), { columns: true, skip_empty_lines: true }).map((r) => [r.provider, r]))
const problems = [...called].flatMap((label) => {
  const r = rows.get(label)
  if (!r) return [\`\${label}: called in the model, not in the GRC tool's register\`]
  const critical = r.critical === 'true'
  return ['contract_reference', 'provider_id', 'ict_service_type', 'function_id', 'data_locations', ...(critical ? ['exit_plan', 'clauses_art_30_3'] : [])]
    .filter((k) => !r[k]?.trim()).map((k) => \`\${label}: \${k} empty in the register\`)
})
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-tests', label: 'Resilience tests on the cycle, findings fixed', when: FINANCIAL, category: 'process', implements: [...FINANCIAL_ADRS, 'adr-no-tlpt'], checks: ['req-testing'],
      threshold: '0 systems marked critical without a test in the last {{TEST_MONTHS}} months; 0 tests without types and tester; 0 findings open past their due date',
      description: 'A monthly CI job reads compliance/dora/resilience-tests.yaml, one item per system named by its label in the architecture model: { system: Shop, critical: true, tests: [{ date: 2026-05-12, types: [vulnerability scans, scenario-based tests, penetration testing], tester: external, findings: [{ id: RT-12, priority: high, due: 2026-07-12, closed: 2026-07-01 }] }] }. It fails on an overdue test, a test that names no types or tester, and a finding open past its due date.',
      tool: 'Node 20 with js-yaml, in a scheduled CI job',
      language: 'js',
      snippet: `// tools/dora/tests-check.mjs — node tools/dora/tests-check.mjs compliance/dora/resilience-tests.yaml
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const MONTH_MS = 30.44 * 86_400_000
const systems = yaml.load(readFileSync(process.argv[2], 'utf8'), { schema: yaml.JSON_SCHEMA }) ?? []
const problems = systems.flatMap((s) => {
  const tests = s.tests ?? []
  const last = Math.max(0, ...tests.map((t) => new Date(t.date).getTime()))
  return [
    ...(s.critical && (Date.now() - last) / MONTH_MS > {{TEST_MONTHS}} ? [\`\${s.system}: no resilience test in the last {{TEST_MONTHS}} months\`] : []),
    ...tests.filter((t) => !t.types?.length || !t.tester).map((t) => \`\${s.system}: test of \${t.date} names no types or tester\`),
    ...tests.flatMap((t) => t.findings ?? []).filter((f) => !f.closed && new Date(f.due) < new Date())
      .map((f) => \`\${s.system}: finding \${f.id} (\${f.priority}) open past \${f.due}\`),
  ]
})
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-tlpt', label: 'Threat-led penetration test not overdue', when: TLPT_NAMED, category: 'process', implements: ['adr-tlpt'], checks: ['req-tlpt'],
      threshold: 'The last threat-led penetration test ended at most {{TLPT_MONTHS}} months ago, has an attestation date, and names the functions it covered',
      description: 'A monthly CI job reads the tlpt block of compliance/dora/scope.yaml ({ last_test_end: 2025-11-20, attestation: 2026-02-03, functions: [payments, card issuing] }) and fails when the test is overdue, has no attestation, or names no functions.',
      tool: 'Node 20 with js-yaml, in a scheduled CI job',
      language: 'js',
      snippet: `// tools/dora/tlpt-check.mjs — node tools/dora/tlpt-check.mjs compliance/dora/scope.yaml
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const MONTH_MS = 30.44 * 86_400_000
const { tlpt } = yaml.load(readFileSync(process.argv[2], 'utf8'), { schema: yaml.JSON_SCHEMA }) ?? {}
const problems = []
if (!tlpt?.functions?.length) problems.push('no critical or important functions named for the test')
const age = (Date.now() - new Date(tlpt?.last_test_end).getTime()) / MONTH_MS
if (!(age <= {{TLPT_MONTHS}})) problems.push(\`last TLPT ended \${tlpt?.last_test_end ?? 'never'}: more than {{TLPT_MONTHS}} months ago\`)
if (tlpt?.last_test_end && !tlpt.attestation) problems.push('no attestation from the authority for the last TLPT')
if (problems.length) { console.error(\`TLPT: \${problems.join('; ')}\`); process.exit(1) }`,
    },
    {
      id: 'ff-client-notice', label: 'Clients told in time with the facts', when: PROVIDER, category: 'operational', implements: ['adr-provider'], checks: ['req-provider-notice'],
      threshold: '0 incidents on a client-facing service where clients were told later than {{CLIENT_NOTICE_HOURS}} hours after detection, or not yet told past that; 0 notices missing clients_affected, duration_minutes, downtime_minutes, data_losses, member_states or economic_impact_eur',
      description: 'A daily CI job reads the incident tool\'s export (reports/incidents.json: id, client_impact, detected_at, clients_notified_at, and the notice sent as an object) and fails on a late notice or one that lacks a fact the clients need for their own classification.',
      tool: 'jq 1.7 in a bash CI step, over the export of incident.io, PagerDuty or Jira Service Management',
      language: 'bash',
      snippet: String.raw`# CI, daily: reports/incidents.json is the incident tool's export; client_impact marks an incident on a service financial-entity clients use
set -euo pipefail
late=$(jq -r --argjson hours {{CLIENT_NOTICE_HOURS}} '
  def t: sub("\\.[0-9]+"; "") | fromdateiso8601;
  .[] | select(.client_impact) | . as $i | ($i.detected_at | t + $hours * 3600) as $due
  | [ (select(if $i.clients_notified_at == null then now > $due else ($i.clients_notified_at | t) > $due end) | "clients told late"),
      ((["clients_affected", "duration_minutes", "downtime_minutes", "data_losses", "member_states", "economic_impact_eur"]
        - ($i.notice // {} | keys)) | select(length > 0) | "notice lacks \(join(", "))") ]
  | select(length > 0) | "\($i.id): \(join("; "))"' reports/incidents.json)
[ -z "$late" ] || { echo "$late"; exit 1; }`,
    },
    {
      id: 'ff-subcontractors', label: 'Every called external system on the subcontractor list', when: PROVIDER, category: 'structural', implements: ['adr-provider'], checks: ['req-subcontractors'],
      threshold: '0 external systems called by an internal system in the architecture model without an entry in compliance/dora/subcontractors.yaml; 0 entries missing legal_entity, services, data_locations or supports',
      description: 'A script on every pull request reads the architecture model folder (nodes/**/*.md with YAML front matter, _index.md for a folder\'s own node, relations.json), finds each external system an internal system calls, and looks it up by label in the subcontractor list: { provider: Partner, legal_entity: Partner Payments GmbH, services: [card payment authorisation], data_locations: [DE], supports: [order checkout] }.',
      tool: 'Node 20 with js-yaml, in a CI step',
      language: 'js',
      snippet: `// tools/dora/subcontractors-check.mjs — node tools/dora/subcontractors-check.mjs architecture compliance/dora/subcontractors.yaml
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import yaml from 'js-yaml'

const [model, listFile] = process.argv.slice(2)
const nodes = new Map(), folders = new Map()
for (const file of readdirSync(join(model, 'nodes'), { recursive: true }).filter((f) => f.endsWith('.md'))) {
  const front = yaml.load(readFileSync(join(model, 'nodes', file), 'utf8').split(/^---$/m)[1])
  const index = file.endsWith('_index.md')
  nodes.set(front.id, { ...front, folder: index ? dirname(dirname(file)) : dirname(file) })
  if (index) folders.set(dirname(file), front.id)
}
const systemOf = (id) => { for (let n = nodes.get(id); n; n = nodes.get(folders.get(n.folder))) if (n.type === 'system') return n }
const called = new Set(JSON.parse(readFileSync(join(model, 'relations.json'), 'utf8')).filter((r) => r.relationType === 'interacts')
  .map((r) => [systemOf(r.sourceId), systemOf(r.targetId)]).filter(([s, t]) => s && !s.external && t?.external).map(([, t]) => t.label))
const listed = new Map((yaml.load(readFileSync(listFile, 'utf8')) ?? []).map((s) => [s.provider, s]))
const problems = [...called].flatMap((label) => {
  const s = listed.get(label)
  if (!s) return [\`\${label}: called in the model, not on the subcontractor list given to clients\`]
  return ['legal_entity', 'services', 'data_locations', 'supports'].filter((k) => !s[k]?.length).map((k) => \`\${label}: no \${k}\`)
})
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-addendum', label: 'Contract addendum has every DORA clause', when: PROVIDER, category: 'structural', implements: ['adr-provider'], checks: ['req-provider-contract'],
      threshold: 'contracts/dora-addendum.md has a heading for each of the 14 clauses of DORA Art. 30(2) and 30(3) it checks',
      description: 'A CI step looks for a heading per clause in the addendum offered to clients: the nine of Art. 30(2) and, for critical or important functions, notice and reporting, business continuity, TLPT, audit and exit of Art. 30(3) (its service levels share the Service levels section). A clause dropped in an edit fails the pull request.',
      tool: 'bash with grep, in a CI step',
      language: 'bash',
      snippet: String.raw`# CI: the DORA addendum offered to financial-entity clients has a section for each clause of Art. 30(2) and 30(3)
set -euo pipefail
addendum=contracts/dora-addendum.md
missing=0
while IFS= read -r clause; do
  grep -qiE "^#+ +.*$clause" "$addendum" || { echo "$addendum has no section on: $clause"; missing=1; }
done <<'CLAUSES'
Description of services and subcontracting
Locations of services and data
Data availability, authenticity, integrity and confidentiality
Access to, recovery and return of data
Service levels
Assistance with ICT incidents
Cooperation with authorities
Termination rights
Security awareness and training
Notice and reporting obligations
Business continuity
Threat-led penetration testing
Audit and inspection rights
Exit strategy and transition period
CLAUSES
exit "$missing"`,
    },
  ],
}

export default pack
