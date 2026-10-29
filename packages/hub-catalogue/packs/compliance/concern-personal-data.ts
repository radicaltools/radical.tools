import type { PackSpec, When } from '../../src/packSpec'

const PERSONAL: When = { PERSONAL: ['yes'] }
const ERASURE_ADRS = ['adr-delete', 'adr-anonymise', 'adr-crypto']
const BREACH = 'A breach of personal data is assessed and notified as this decision says, whatever incident it arrives through: the breach lead named in docs/breaches/runbook.md decides, on the data protection officer\'s advice, whether it is unlikely to result in a risk to people; unless it is, the supervisory authority named in the runbook is notified without undue delay and within 72 hours of becoming aware of it, with the content of GDPR Art. 33(3), in phases when facts are still missing; the people affected are told without undue delay when the risk is high, unless an exception of Art. 34(3) applies; and every breach, notified or not, is documented in docs/breaches/register.json with its facts, effects, remedy and the reason for each decision. Every processor is bound by contract to tell the controller of a breach within {{PROCESSOR_NOTICE_HOURS}} hours, as processors.yaml records.'
const FORCES = 'This store keeps data, and some of it may be about people. The forces: data protection law (GDPR) limits why personal data may be processed, for how long it is kept and where it may go, and gives people the rights to get, take away and erase it, each within one month; copies multiply (replicas, backups, logs, exports, analytics, processors) and every one of them has to follow; health, biometric and other special categories carry a higher bar; a breach has to be assessed, and most often notified to the authority, within 72 hours of becoming aware of it, when the facts are still unclear; erasing must not break the records others still need (invoices, the audit trail); and the controller has to be able to prove all of it (accountability, Art. 5(2)).'

const pack: PackSpec = {
  id: 'concern-personal-data',
  name: 'Personal data',
  group: 'compliance',
  description: 'Data about people in the stores: on what basis it is kept, for how long, where it may go, and how a person gets it or has it erased.',
  tags: ['privacy', 'gdpr', 'personal-data', 'retention', 'erasure', 'compliance'],
  concern: {
    id: 'personal-data',
    trigger: 'LIST NODES WHERE type = "database" AND external != true',
    why: 'these stores keep data, and whether any of it is about people decides on what basis it is kept, for how long, where it may go and how it is erased.',
  },
  sources: [
    { title: 'Regulation (EU) 2016/679, General Data Protection Regulation (GDPR)', url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj' },
    { title: 'EDPB guidelines, recommendations and best practices (consent, data subject rights, transfers)', url: 'https://www.edpb.europa.eu/our-work-tools/general-guidance/guidelines-recommendations-best-practices_en' },
    { title: 'EDPB Guidelines 9/2022 on personal data breach notification under GDPR', url: 'https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202209_personal_data_breach_notification_v2.0_en.pdf' },
    { title: 'ICO, UK GDPR guidance and resources', url: 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/' },
    { title: 'Article 29 Working Party, Opinion 05/2014 on Anonymisation Techniques', url: 'https://ec.europa.eu/justice/article-29/documentation/opinion-recommendation/files/2014/wp216_en.pdf' },
    { title: 'CJEU C-311/18 (Schrems II)', url: 'https://curia.europa.eu/juris/liste.jsf?num=C-311/18' },
  ],
  questions: [
    {
      key: 'PERSONAL', title: 'Personal data', label: 'Does it keep data about people?',
      hint: 'Names, e-mail and IP addresses, device and customer ids, and anything else that can be tied to a person count (GDPR Art. 4(1)); so do log lines that carry them. With no, the other questions and details are moot.',
      default: 'yes',
      options: [
        { value: 'yes', label: 'data about people', description: 'Any field, log line or event that identifies a person directly or with other data the organisation holds. Pick it when the store keeps accounts, customers, employees, addresses, IPs or user ids; retention, rights, location and security become requirements.' },
        { value: 'no', label: 'nothing that identifies a person', description: 'Only data about things: products, prices, telemetry without user or device ids. Pick it only when no column, log line or event can be tied to a person; the decision records it and a scan keeps it true.' },
      ],
    },
    {
      key: 'SPECIAL', title: 'Special categories', label: 'Does it keep health, biometric or other special-category data?',
      hint: 'GDPR Art. 9 forbids processing health, genetic, biometric, ethnic, religious, political, trade-union and sex-life data unless one of its exceptions applies, and a large-scale use needs a data protection impact assessment (Art. 35). Only when it keeps data about people.',
      default: 'no',
      options: [
        { value: 'no', label: 'no special categories', description: 'None of the Art. 9 categories and no criminal records (Art. 10). Pick it for ordinary customer, order and account data; the decision records it so a health or biometric field is not added on the quiet.' },
        { value: 'yes', label: 'special-category data', description: 'Health or fitness readings, diagnoses, biometrics used to identify, genetic data, beliefs, ethnicity or sexual orientation, even inferred. Pick it whenever such a field exists or can be derived; it adds field-level encryption, read logging and an impact assessment.' },
      ],
    },
    {
      key: 'REGION', title: 'Location', label: 'Where may the personal data be kept and processed?',
      hint: 'Chapter V of the GDPR allows a transfer outside the EU/EEA only to a country with an adequacy decision or under safeguards such as standard contractual clauses; backups, logs, support tools and every processor count. Only when it keeps data about people.',
      default: 'eu',
      options: [
        { value: 'eu', label: 'the EU/EEA only', description: 'Stores, backups, logs and every processor stay in EU/EEA regions. Pick it when customers or contracts demand it, for public-sector or health data, or simply to need no transfer mechanism at all.' },
        { value: 'adequate', label: 'the EU/EEA and countries with an adequacy decision', description: 'Also the UK, Switzerland, Japan, Canada, the US (certified under the Data Privacy Framework) and the other countries the Commission has found adequate (Art. 45). Pick it when a processor you need runs there and nowhere else.' },
        { value: 'any', label: 'any country under standard contractual clauses', description: 'Transfers to any country with the Commission\'s standard contractual clauses and a transfer impact assessment per processor (Art. 46, EDPB Recommendations 01/2020); adequate countries need neither. Pick it when global processors or follow-the-sun support are needed and someone owns the assessments.' },
      ],
    },
    {
      key: 'ERASURE', title: 'Erasure', label: 'How is a person\'s data erased?',
      hint: 'Erasure (Art. 17) and retention (Art. 5(1)(e)) have to reach every copy: replicas, caches, logs, exports and backups that cannot be edited. Only when it keeps data about people.',
      default: 'delete',
      options: [
        { value: 'delete', label: 'deletion', description: 'Rows and documents are deleted where they live; backups age out and a restore re-applies the erasures made since it was taken. Pick it when the stores are few and known, and backups are kept for weeks rather than years.' },
        { value: 'anonymise', label: 'anonymisation in place', description: 'Identifiers are replaced or generalised so the records no longer relate to anyone, and the records stay for statistics and accounting. Pick it when the business needs the history (orders, revenue) after the person is gone.' },
        { value: 'crypto', label: 'crypto-shredding', description: 'Each person\'s fields are encrypted with a key of their own; destroying the key erases them in every store, log and backup at once. Pick it when the data spreads to backups, event streams or archives you cannot edit, and you can run a key management service.' },
      ],
    },
    {
      key: 'BASIS', title: 'Lawful basis', label: 'On what lawful basis is most of it processed?',
      hint: 'Every purpose needs one of the six bases of Art. 6(1), and the basis decides which rights apply and what has to be recorded: consent must be provable and as easy to withdraw as to give; legitimate interests can be objected to. Only when it keeps data about people.',
      default: 'contract',
      options: [
        { value: 'contract', label: 'contract or legal obligation', description: 'Data needed to deliver what the person signed up for, or that the law requires you to keep (Art. 6(1)(b), (c)). Pick it for accounts, orders, invoices; purpose limitation is what must be enforced.' },
        { value: 'consent', label: 'consent recorded per purpose', description: 'The person opted in to a purpose such as marketing or personalisation (Art. 6(1)(a), Art. 7). Pick it when the processing is optional for the service; each consent is recorded and its withdrawal stops the processing.' },
        { value: 'legitimate', label: 'legitimate interests', description: 'Processing the person would reasonably expect, such as fraud prevention or analytics on their use, after a balancing test (Art. 6(1)(f)). Pick it when consent does not fit and you have documented the test; objections (Art. 21) must be honoured.' },
      ],
    },
  ],
  details: [
    { key: 'RETENTION_MONTHS', label: 'After how many months unused is personal data erased? (data about people only)', default: '24', number: true },
    { key: 'REQUEST_DAYS', label: 'Within how many days is an access or erasure request answered (at most 30)? (data about people only)', default: '30', number: true },
    { key: 'BACKUP_DAYS', label: 'For how many days are backups kept? (data about people only)', default: '35', number: true },
    { key: 'PROCESSOR_NOTICE_HOURS', label: 'Within how many hours must a processor tell you of a breach? (data about people only)', default: '24', number: true },
  ],
  need: {
    label: 'People\'s data handled lawfully',
    text: 'The system keeps data about people. Data protection law and the people themselves expect it to be processed only for a stated purpose on a lawful basis, kept no longer than needed, kept where the law allows, protected against leaks, handed over when a person asks and erased when they ask, every copy included. The organisation also has to be able to show, at any time, what it keeps, why, where and for how long. The snippets assume the application under src/ (src/privacy the erasure, consents and exclusions, src/crypto the envelope layer), the tests under tests/ with their fixtures in tests/privacy, and the records under docs/ (record-of-processing.json, dpia/, and breaches/ with runbook.md and register.json) and processors.yaml.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-record', label: 'Record of processing', when: PERSONAL, ears_type: 'ubiquitous',
      action: 'keep a record of processing that names, for every store and field holding personal data, its purpose, lawful basis, retention period, recipients and location, and update it in the same change that adds or alters such a field',
      rationale: 'The controller has to keep a record of processing activities (GDPR Art. 30) and be able to show compliance (Art. 5(2)); a record updated in the same change cannot drift from the schema.',
      scenario: { label: 'New field recorded', given: 'a migration that adds a column with personal data', when: 'the change is built', then: 'it fails unless the record of processing names the column with purpose, basis, retention, recipients and location' },
    },
    {
      id: 'req-retain', label: 'Unused data expires', when: PERSONAL, ears_type: 'event-driven',
      trigger: 'personal data has not been used for {{RETENTION_MONTHS}} months and no legal obligation requires keeping it',
      action: 'erase it by {{ERASURE}} within 7 days, in every store, cache and export',
      rationale: 'Storage limitation (GDPR Art. 5(1)(e)) and data minimisation (Art. 5(1)(c)): data not kept cannot leak, and a fixed period is what the record of processing can state.',
      scenario: { label: 'Old data expires', given: 'an account unused for {{RETENTION_MONTHS}} months and another used last week', when: 'the retention job runs', then: 'within 7 days nothing identifies the first in any store; the second is untouched' },
    },
    {
      id: 'req-access', label: 'Own data on request', when: PERSONAL, ears_type: 'event-driven',
      trigger: 'a person whose identity has been verified asks for the data kept about them',
      action: 'deliver all of it from every store, as JSON, within {{REQUEST_DAYS}} days, together with the purposes, recipients, retention periods and source of each part',
      rationale: 'The right of access (GDPR Art. 15) and the right to data portability in a structured, commonly used, machine-readable format (Art. 20), both within one month (Art. 12(3)).',
      scenario: { label: 'Data handed over', given: 'a verified person with an account, orders and support tickets', when: 'they ask for their data', then: 'within {{REQUEST_DAYS}} days they receive one JSON file holding all of it, with purposes, recipients and retention periods' },
    },
    {
      id: 'req-erase', label: 'Erasure on request', when: PERSONAL, ears_type: 'event-driven',
      trigger: 'a verified person\'s erasure request is accepted',
      action: 'erase their data by {{ERASURE}} in every store, replica, cache, log and export within {{REQUEST_DAYS}} days, keep only what a legal obligation requires, tell every recipient it was disclosed to, and confirm to the person',
      rationale: 'The right to erasure (GDPR Art. 17) within one month (Art. 12(3)), passed on to the recipients (Art. 19); records the law requires (invoices) are an exception of Art. 17(3)(b).',
      scenario: { label: 'Person erased', given: 'a person with an account, orders, log entries and a copy at a processor', when: 'their erasure request is accepted', then: 'within {{REQUEST_DAYS}} days nothing identifies them in any store, log or export, the processor is told, invoices remain, and the person is told' },
    },
    {
      id: 'req-backups', label: 'Erasures survive restores', when: { ...PERSONAL, ERASURE: ['delete', 'anonymise'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a backup taken before an erasure is restored',
      action: 're-apply every erasure recorded since the backup was taken before the restored store serves a request, and let backups expire after {{BACKUP_DAYS}} days',
      rationale: 'Backups cannot be edited, so they are put "beyond use" until they expire (ICO, right to erasure); a restore must not bring erased people back (GDPR Art. 17).',
      scenario: { label: 'Restore keeps erasures', given: 'a backup taken before a person was erased', when: 'the backup is restored', then: 'the person is erased again before the store serves its first request' },
    },
    {
      id: 'req-anonymise', label: 'Anonymised for good', when: { ...PERSONAL, ERASURE: ['anonymise'] }, ears_type: 'ubiquitous',
      action: 'replace direct identifiers with random values without keeping any mapping, and generalise the remaining quasi-identifiers (birth date, postcode, gender) until every combination of them occurs in at least 5 records',
      rationale: 'Anonymous data is outside the GDPR only when the person can no longer be identified by any reasonably likely means (Recital 26); pseudonymised data with a key is still personal (Art. 4(5)). k-anonymity of 5 is a common floor (Article 29 Working Party, Opinion 05/2014 on anonymisation techniques).',
      scenario: { label: 'No one singled out', given: 'the anonymised records of erased people', when: 'they are grouped by birth year, postcode prefix and gender', then: 'no group holds fewer than 5 records and no table maps them back' },
    },
    {
      id: 'req-shred', label: 'Erasure by key destruction', when: { ...PERSONAL, ERASURE: ['crypto'] }, ears_type: 'event-driven',
      trigger: 'a person\'s erasure request is accepted, or their data passes its retention period',
      action: 'destroy the person\'s data key within 24 hours, and its copies in key backups within {{BACKUP_DAYS}} days, so that their fields in every store, event, log and backup can no longer be decrypted',
      rationale: 'Encrypted data whose key no longer exists cannot be read by anyone, which reaches backups and event streams that cannot be edited (GDPR Art. 17, ICO on erasure of backups).',
      scenario: { label: 'Key destroyed', given: 'a person whose fields are in the store, an event stream and last night\'s backup', when: 'their erasure is accepted and 24 hours pass', then: 'their key is gone and decrypting any of those copies fails' },
    },
    {
      id: 'req-protect', label: 'Protected in transit and by role', when: PERSONAL, ears_type: 'ubiquitous',
      action: 'accept connections carrying personal data only with TLS 1.2 or later, encrypt it at rest with the keys decided in the Encryption pack, give staff access to it only through roles that need it, and review those roles every 6 months',
      rationale: 'Security of processing (GDPR Art. 32(1)(a), (b)) and integrity and confidentiality (Art. 5(1)(f)); encryption also decides whether a breach must be told to the people affected (Art. 34(3)(a)).',
      scenario: { label: 'Guarded everywhere', given: 'the store and the roles with read access to personal tables', when: 'its connection settings and the role reviews are listed', then: 'connections below TLS 1.2 are refused, and every role with access was reviewed in the last 6 months' },
    },
    {
      id: 'req-breach', label: 'Breaches notified in time', when: PERSONAL, ears_type: 'event-driven',
      trigger: 'the organisation becomes aware of a breach of personal data',
      action: 'assess whether it is unlikely to result in a risk to people and, unless it is, notify the supervisory authority named in the breach runbook without undue delay and within 72 hours of becoming aware of it, or with the reasons for the delay when that is not feasible, describing the nature of the breach with the categories and approximate numbers of people and records, the data protection officer\'s contact, the likely consequences and the measures taken or proposed, and sending what is not yet known in later phases',
      rationale: 'GDPR Art. 33(1) sets the deadline, its exception for a breach unlikely to result in a risk, and the reasons a later notification must carry; Art. 33(3) the content; Art. 33(4) allows the content in phases without undue further delay.',
      scenario: { label: 'Breach notified in time', given: 'a log export with the e-mail addresses of 4,000 customers found on a public bucket at 09:00 on Monday and assessed as a risk to people', when: 'the breach lead follows the runbook', then: 'the authority is notified by 09:00 on Thursday with the nature, the numbers, the data protection officer\'s contact, the consequences and the measures, a missing fact follows in a later phase, and the register holds the times' },
    },
    {
      id: 'req-breach-register', label: 'Every breach documented', when: PERSONAL, ears_type: 'ubiquitous',
      action: 'document every breach of personal data in the breach register, notified or not, with the time of becoming aware of it, the facts, the effects, the remedial action, the risk assessment and the decision on notifying with its reason, and reconcile the register with the security incidents at least every 3 months',
      rationale: 'GDPR Art. 33(5): the controller documents any breach, with its facts, effects and remedial action, so that the supervisory authority can verify compliance with Art. 33; a breach that was not notified is the one whose reasoning it will ask for.',
      scenario: { label: 'Unnotified breach documented', given: 'an e-mail with one customer\'s order sent to the wrong customer and assessed as unlikely to result in a risk', when: 'the register is checked', then: 'it holds the breach with its facts, effects, remedy, the assessment and the reason it was not notified, and its last reconciliation is less than 3 months old' },
    },
    {
      id: 'req-breach-people', label: 'People told of a high-risk breach', when: PERSONAL, ears_type: 'event-driven',
      trigger: 'a breach of personal data is assessed as likely to result in a high risk to people',
      action: 'tell the people affected without undue delay, in clear and plain language, the nature of the breach, the data protection officer\'s contact, the likely consequences and the measures taken or proposed, and record the time in the breach register, unless the register records the exception of GDPR Art. 34(3) that applies: the data was unintelligible to anyone not authorised, later measures make the high risk no longer likely, or telling each person would take disproportionate effort and a public notice is made instead',
      rationale: 'GDPR Art. 34(1) and (2) require telling the people affected by a high-risk breach, with the content of Art. 33(3)(b) to (d); Art. 34(3) lists the three exceptions, and Art. 34(4) lets the authority require it later, so the exception relied on is written down.',
      scenario: { label: 'Customers told', given: 'a breach exposing customers\' passwords hashed with a broken algorithm, assessed as high risk', when: 'the assessment is made', then: 'the affected customers are told by e-mail in plain language what happened, whom to contact, what may follow and what to do, and the register holds the time they were told' },
    },
    {
      id: 'req-breach-processor', label: 'Processors report breaches', when: PERSONAL, ears_type: 'ubiquitous',
      action: 'bind every processor in the processor register by contract to tell the controller of a breach of personal data within {{PROCESSOR_NOTICE_HOURS}} hours of becoming aware of it, with what it knows of the content of GDPR Art. 33(3), and record that time in the register',
      rationale: 'A processor must notify the controller without undue delay after becoming aware of a breach (GDPR Art. 33(2)) and assist it with its own notifications (Art. 28(3)(f)); EDPB Guidelines 9/2022 hold the controller aware once its processor has told it, so a fixed time in the contract keeps most of the 72 hours for the controller.',
      scenario: { label: 'Slow processor found', given: 'the processor register with a mail provider whose contract allows 72 hours to report a breach', when: 'the breach readiness check runs', then: 'it fails and names the mail provider, since its notice exceeds {{PROCESSOR_NOTICE_HOURS}} hours' },
    },
    {
      id: 'req-region-eu', label: 'Kept in the EU/EEA', when: { ...PERSONAL, REGION: ['eu'] }, ears_type: 'ubiquitous',
      action: 'store and process personal data only in EU/EEA regions, with backups, logs, support tools and every processor included',
      rationale: 'No transfer outside the EU/EEA, so none of the conditions of GDPR Chapter V (Art. 44-49) has to be met or proven.',
      scenario: { label: 'Nothing leaves the EU', given: 'the deployment, its backups and every processor in the register', when: 'their regions and countries are listed', then: 'all are in the EU/EEA' },
    },
    {
      id: 'req-region-adequate', label: 'Only to adequate countries', when: { ...PERSONAL, REGION: ['adequate'] }, ears_type: 'ubiquitous',
      action: 'transfer personal data outside the EU/EEA only to countries covered by an adequacy decision of the European Commission, and list every processor with its country in the processor register',
      rationale: 'A transfer on the basis of an adequacy decision needs no further authorisation (GDPR Art. 45(1)); the register is part of the record of processing (Art. 30(1)(e)).',
      scenario: { label: 'Only adequate countries', given: 'the processor register', when: 'it is checked against the Commission\'s adequacy list', then: 'every processor outside the EU/EEA is in a country on that list' },
    },
    {
      id: 'req-region-scc', label: 'Transfers under safeguards', when: { ...PERSONAL, REGION: ['any'] }, ears_type: 'event-driven',
      trigger: 'personal data is to be sent to a processor in a country outside the EU/EEA without an adequacy decision',
      action: 'sign the Commission\'s standard contractual clauses and complete a transfer impact assessment before the first transfer, record both in the processor register, and review the assessment every 12 months',
      rationale: 'Without an adequacy decision a transfer needs appropriate safeguards (GDPR Art. 46(2)(c)) and an assessment of the destination\'s law (CJEU C-311/18 Schrems II, EDPB Recommendations 01/2020).',
      scenario: { label: 'Transfer safeguarded', given: 'a new support tool hosted outside the EU/EEA and adequate countries', when: 'it is to receive customer data', then: 'no data is sent before its clauses and impact assessment are in the processor register' },
    },
    {
      id: 'req-special', label: 'Special categories guarded', when: { ...PERSONAL, SPECIAL: ['yes'] }, ears_type: 'ubiquitous',
      action: 'process special-category data only under an Art. 9(2) condition recorded per person, encrypt those fields at field level with keys only the services that need them can use, and log every read with the reader, the time and the purpose, keeping the log 12 months',
      rationale: 'Special categories may be processed only under an exception of GDPR Art. 9(2), most often explicit consent; field-level encryption and read logs are the appropriate measures of Art. 32 for data whose leak harms most.',
      scenario: { label: 'Health field guarded', given: 'a record with a diagnosis', when: 'a service without the key and then a clinician\'s service read it', then: 'the first gets only ciphertext; the second reads it and the read is logged with reader, time and purpose' },
    },
    {
      id: 'req-dpia', label: 'Impact assessed first', when: { ...PERSONAL, SPECIAL: ['yes'] }, ears_type: 'event-driven',
      trigger: 'a change adds a new purpose, store or recipient for special-category data',
      action: 'complete and approve a data protection impact assessment, with the data protection officer\'s advice, before the change is deployed',
      rationale: 'Large-scale processing of special categories requires a DPIA before it starts (GDPR Art. 35(1), (3)(b)), with the DPO consulted (Art. 35(2)).',
      scenario: { label: 'No DPIA, no deploy', given: 'a change that sends health data to a new analytics store', when: 'it is to be deployed', then: 'the deployment waits until its DPIA is approved' },
    },
    {
      id: 'req-purpose', label: 'Used only for its purpose', when: { ...PERSONAL, BASIS: ['contract'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a service the record of processing does not list for a field\'s purpose tries to read it',
      action: 'refuse the read through the database role or API it uses, and log the attempt',
      rationale: 'Data collected for a contract may not be reused for unrelated purposes (purpose limitation, GDPR Art. 5(1)(b), Art. 6(1)(b), (4)); access rights enforce what the record states.',
      scenario: { label: 'Other purpose refused', given: 'the marketing service, which the record does not list for order addresses', when: 'it queries the order addresses', then: 'the query is refused and logged' },
    },
    {
      id: 'req-consent', label: 'Consent provable and revocable', when: { ...PERSONAL, BASIS: ['consent'] }, ears_type: 'event-driven',
      trigger: 'a person gives or withdraws consent for a purpose',
      action: 'record it with the purpose, the version of the wording shown, the time and the channel, and on withdrawal stop processing for that purpose within 24 hours, with withdrawing taking no more steps than giving',
      rationale: 'The controller must be able to demonstrate consent (GDPR Art. 7(1)), and withdrawing it must be as easy as giving it (Art. 7(3); EDPB Guidelines 05/2020 on consent).',
      scenario: { label: 'Consent withdrawn', given: 'a person who consented to personalised offers with wording version 3', when: 'they withdraw it in one click', then: 'the record shows both events with version and channel, and no offer is personalised for them after 24 hours' },
    },
    {
      id: 'req-objection', label: 'Objections honoured', when: { ...PERSONAL, BASIS: ['legitimate'] }, ears_type: 'event-driven',
      trigger: 'a person objects to processing based on legitimate interests',
      action: 'stop that processing for them within 7 days unless a documented compelling ground overrides it, and stop direct marketing at once without exception',
      rationale: 'The right to object (GDPR Art. 21(1)), absolute for direct marketing (Art. 21(2), (3)); legitimate interests need a documented balancing test (Art. 6(1)(f)).',
      scenario: { label: 'Objection honoured', given: 'a person included in usage analytics and marketing e-mails', when: 'they object', then: 'marketing stops at once and analytics excludes them within 7 days' },
    },
    {
      id: 'req-none', label: 'No personal data kept', when: { PERSONAL: ['no'] }, ears_type: 'ubiquitous',
      action: 'keep no data that identifies a person, directly or with other data the organisation holds, in its stores, events or logs',
      rationale: 'Recorded as a requirement and scanned for, the absence of personal data is checked rather than assumed (GDPR Art. 4(1), Recital 26).',
      scenario: { label: 'Nothing personal stored', given: 'the store\'s schema, a sample of its rows and a day of logs', when: 'they are scanned for personal data', then: 'nothing is found' },
    },
  ],
  adrs: [
    {
      id: 'adr-delete', label: 'Personal data erased by deletion', when: { ...PERSONAL, ERASURE: ['delete'] },
      decision: 'Personal data is kept only in the stores and fields the record of processing names, each field classified in the schema (a column comment or a data-catalogue tag in OpenMetadata or DataHub). Lawful basis: {{BASIS}}. Location: {{REGION}}. Special categories: {{SPECIAL}}. Erasure is deletion: one erasure routine knows every store; it publishes a PersonErased event that each owning service handles by deleting the person\'s rows (ON DELETE CASCADE where the schema allows), replacing them with a tombstone where invoices must stay. Logs carry user ids rather than names or addresses and are kept no longer than {{REQUEST_DAYS}} days in the log store (Loki or OpenSearch retention), so that logs expire before any erasure deadline and need no editing. Backups expire after {{BACKUP_DAYS}} days and a restore replays the erasure ledger before serving. Unused data is erased after {{RETENTION_MONTHS}} months by a daily job. Choose deletion over crypto-shredding when the copies are few and known and backups are short-lived. ' + BREACH,
      consequences: '• Erasure is simple to understand and to prove: the rows are gone.\n• Every new store, cache or export must join the erasure routine, or it leaks the people erased.\n• Erased people live on in backups for up to {{BACKUP_DAYS}} days; the erasure ledger is what keeps them from coming back on a restore.\n• Records the business needs later (revenue per month) must be aggregated before the deletion.',
      alternatives: '1. Anonymisation in place: keeps the history for statistics, but anonymisation must hold against re-identification.\n2. Crypto-shredding: reaches backups and streams at once, at the cost of a key per person and a key service on every read.\n3. Handling requests by hand: slow, error-prone and hard to prove.',
    },
    {
      id: 'adr-anonymise', label: 'Personal data erased by anonymisation', when: { ...PERSONAL, ERASURE: ['anonymise'] },
      decision: 'Personal data is kept only in the stores and fields the record of processing names, each field classified in the schema (a column comment or a data-catalogue tag in OpenMetadata or DataHub). Lawful basis: {{BASIS}}. Location: {{REGION}}. Special categories: {{SPECIAL}}. Erasure is anonymisation in place: direct identifiers (name, e-mail, phone, address, IP, external ids) are overwritten with random values and no mapping is kept, the row keeps its internal id and an anonymised_at timestamp; quasi-identifiers are generalised (birth date to year, postcode to its first two characters) until every combination occurs at least 5 times, which a dbt test checks; free-text fields are cleared. Logs carry user ids only and are kept no longer than {{REQUEST_DAYS}} days, so that they expire before any erasure deadline and need no editing. Backups expire after {{BACKUP_DAYS}} days and a restore replays the erasure ledger before serving. Unused data is anonymised after {{RETENTION_MONTHS}} months by a daily job. Use ARX or sdcMicro to measure re-identification risk when the quasi-identifiers change. Choose anonymisation when orders, revenue or usage history must outlive the person. ' + BREACH,
      consequences: '• History stays usable for reporting and accounting without anyone in it.\n• Anonymisation that can be undone is pseudonymisation and still personal data: the k-anonymity check and the removal of free text are not optional.\n• Each new column must be classified as identifier, quasi-identifier or neither, or anonymisation misses it.\n• Backups still hold the original records until they expire after {{BACKUP_DAYS}} days.',
      alternatives: '1. Deletion in every store: simplest to prove, loses the history.\n2. Crypto-shredding: reaches backups at once, but the records become unreadable rather than anonymous.\n3. Pseudonymisation with a kept key: reversible, so it erases nothing (GDPR Art. 4(5)).',
    },
    {
      id: 'adr-crypto', label: 'Personal data erased by crypto-shredding', when: { ...PERSONAL, ERASURE: ['crypto'] },
      decision: 'Personal data is kept only in the stores and fields the record of processing names, each field classified in the schema. Lawful basis: {{BASIS}}. Location: {{REGION}}. Special categories: {{SPECIAL}}. Every personal field is encrypted in the application with a data key of its own per person (envelope encryption, AES-256-GCM), the data keys kept wrapped in a key table and wrapped by one key in a key management service: AWS KMS, Google Cloud KMS or Azure Key Vault on that cloud, HashiCorp Vault (Transit) on premises or across clouds; libraries such as AWS Encryption SDK or Google Tink do the envelope work. Erasure deletes the person\'s wrapped data key from the key table within 24 hours, which makes their fields in every store, event, log and backup unreadable; backups of the key table expire after {{BACKUP_DAYS}} days. Unused data is shredded the same way after {{RETENTION_MONTHS}} months. Searchable fields (e-mail for sign-in) are kept as keyed hashes (HMAC) next to the ciphertext. ' + BREACH,
      consequences: '• One key deletion erases a person everywhere, immutable backups and event streams included.\n• Every read of a personal field decrypts: a key cache and the key service\'s availability are on the hot path.\n• Searching, sorting and joining on encrypted fields is not possible; keyed hashes cover exact matches only.\n• A lost key table loses everyone\'s data: it needs its own backup and recovery, and its backups must expire within {{BACKUP_DAYS}} days for the erasure to hold.',
      alternatives: '1. Deletion in every store: no key service, but backups and streams keep the person until they expire.\n2. Anonymisation in place: keeps readable history, but must hold against re-identification.\n3. One key per store (transparent disk encryption): protects against stolen disks, erases no one.',
    },
    {
      id: 'adr-basis-contract', label: 'Processed for the contract', when: { ...PERSONAL, BASIS: ['contract'] },
      decision: 'Most personal data is processed because the person\'s contract or a legal obligation needs it (GDPR Art. 6(1)(b), (c)): accounts, orders, invoices, support. Purpose limitation is enforced by access: each field\'s purposes are in the record of processing, and only the services and roles listed for a purpose can read the field, by database role or API scope; an attempt from elsewhere is refused and logged. Marketing or analytics beyond the contract needs its own basis and its own entry in the record.',
      consequences: '• No consent to collect or prove, and no objection right for the core processing.\n• Every secondary use (marketing, profiling, analytics beyond the service) needs a separate basis and a review.\n• The record of processing becomes the access list: a new consumer of a field is a change to the record first.',
      alternatives: '1. Consent recorded per purpose: needed for the optional uses, too heavy for the core service.\n2. Legitimate interests: fits analytics and fraud prevention, with a balancing test to keep.',
    },
    {
      id: 'adr-basis-consent', label: 'Processed on recorded consent', when: { ...PERSONAL, BASIS: ['consent'] },
      decision: 'Most personal data is processed on consent (GDPR Art. 6(1)(a), Art. 7): a consent record per person and purpose holds the version of the wording shown, the time, the channel and the withdrawal, if any. Every processing job for a consented purpose reads the record first and skips people without a current consent; a withdrawal takes effect within 24 hours and is one step, offered wherever the consent was given. Wording versions are kept with the code so that any record can be shown with the text the person saw.',
      consequences: '• The person decides, and the proof is in the record, which an auditor can read.\n• Data processing stops when consent is withdrawn: features that depend on it degrade, and the product has to cope.\n• Consent banners and records are work to build and keep current; a change of wording is a new version to record.\n• Consent given under pressure or bundled with the service is invalid: the processing then has no basis at all.',
      alternatives: '1. Contract or legal obligation: no consent to collect, but only for what the service itself needs.\n2. Legitimate interests: no consent either, but a balancing test and the right to object.',
    },
    {
      id: 'adr-basis-legitimate', label: 'Processed on legitimate interests', when: { ...PERSONAL, BASIS: ['legitimate'] },
      decision: 'Most personal data is processed on legitimate interests (GDPR Art. 6(1)(f)): fraud prevention, security, analytics of how the service is used. For each such purpose a balancing test (the interest, its necessity, the person\'s reasonable expectations and the safeguards) is written down in the record of processing and reviewed every 12 months. An objection stops the processing for that person within 7 days unless a documented compelling ground overrides it; direct marketing stops at once. An exclusion list is consulted by every job for these purposes.',
      consequences: '• No consent to collect for processing people would expect anyway.\n• Each purpose carries a written balancing test to maintain, which a supervisory authority may ask for.\n• The right to object has to work: an exclusion list every job honours, and a way to object as easy as unsubscribing.\n• Marketing by e-mail still needs consent under ePrivacy rules in most countries: this basis does not cover it.',
      alternatives: '1. Consent recorded per purpose: stronger for the person, weaker uptake and more to build.\n2. Contract or legal obligation: only for what the service itself needs.',
    },
    {
      id: 'adr-region-eu', label: 'Kept in the EU/EEA only', when: { ...PERSONAL, REGION: ['eu'] },
      decision: 'Personal data is stored and processed in EU/EEA regions only: the cloud provider\'s EU regions for stores, backups and logs, and processors (support, mail, analytics, monitoring) that process in the EU/EEA under contract. The processor register lists each with its country; the infrastructure code pins the regions, and a policy check refuses a provider or backup copy outside the allowed list.',
      consequences: '• No transfer mechanism to maintain: Chapter V does not apply.\n• Some processors are ruled out, and follow-the-sun support from outside the EU has to work without personal data.\n• A new region or processor is a change to the register and the policy, not a quiet configuration edit.',
      alternatives: '1. The EU/EEA and adequate countries: a wider choice of processors, with the adequacy list to follow.\n2. Any country under standard contractual clauses: the widest choice, with a transfer impact assessment per processor to own.',
    },
    {
      id: 'adr-region-adequate', label: 'Kept in the EU/EEA and adequate countries', when: { ...PERSONAL, REGION: ['adequate'] },
      decision: 'Personal data may be stored and processed in EU/EEA regions and transferred to processors in countries the European Commission has found adequate (GDPR Art. 45): the UK, Switzerland, Japan, Canada, the Republic of Korea and the others on the Commission\'s list, and the US only for processors certified under the Data Privacy Framework. The processor register lists each processor with its country and, for the US, its certification; a policy check in CI refuses any other.',
      consequences: '• A wider choice of processors with no clauses to sign and no assessment to write.\n• The adequacy list changes (a decision can be withdrawn, as Schrems II did for Privacy Shield): someone owns keeping the list current and has a plan for a withdrawal.\n• US processors must stay certified: the certification is checked when the register is reviewed.',
      alternatives: '1. The EU/EEA only: nothing to follow, fewer processors.\n2. Any country under standard contractual clauses: every processor allowed, at the cost of an assessment each.',
    },
    {
      id: 'adr-region-any', label: 'Transfers under standard contractual clauses', when: { ...PERSONAL, REGION: ['any'] },
      decision: 'Personal data may be transferred to processors in any country. Inside the EU/EEA and adequate countries nothing more is needed; for every other processor the Commission\'s standard contractual clauses (2021/914) are signed and a transfer impact assessment of the destination\'s law and the safeguards (encryption with keys held in the EU, pseudonymisation) is written before the first transfer and reviewed every 12 months. The processor register carries the dates of both, and a policy check in CI refuses a processor without them.',
      consequences: '• Any processor can be used, including global support and analytics tools.\n• A transfer impact assessment per processor is legal work to own and to refresh yearly; a negative one blocks the processor.\n• Supplementary measures (keys in the EU) shape the architecture of what the processor may see.',
      alternatives: '1. The EU/EEA and adequate countries: no assessments, fewer processors.\n2. The EU/EEA only: nothing to maintain, the fewest processors.',
    },
    {
      id: 'adr-special', label: 'Special categories encrypted and logged', when: { ...PERSONAL, SPECIAL: ['yes'] },
      context: `${FORCES} Here the store keeps special-category data (GDPR Art. 9), whose leak harms most and whose processing is forbidden unless an exception applies.`,
      decision: 'Special-category fields are kept in their own tables or documents, encrypted at field level (pgcrypto or application-side envelope encryption with keys in the key management service) with keys only the services named in the record of processing may use. Each person\'s Art. 9(2) condition, usually explicit consent, is recorded with its date. Every read of these fields is logged with reader, time and purpose (pgAudit object audit logging through the auditor role for direct database access, the service\'s own audit log otherwise) and the log is kept 12 months. A data protection impact assessment is approved before any new purpose, store or recipient, and the change that brings one links it in the record of processing.',
      consequences: '• A leak of the main tables or a backup does not expose the special categories.\n• Analytics on these fields needs its own approved purpose and key, which slows ad-hoc analysis on purpose.\n• Read logs grow with use and are themselves personal data with a 12-month retention.\n• The DPIA becomes a release gate for changes that touch these fields.',
      alternatives: '1. Treat them like other personal data: simpler, but falls short of Art. 9 and Art. 32 for the data whose leak harms most.\n2. A separate system for special categories only: the strongest separation, but a second system to run and integrate.',
    },
    {
      id: 'adr-no-special', label: 'No special categories kept', when: { ...PERSONAL, SPECIAL: ['no'] },
      decision: 'The store keeps no special-category data (GDPR Art. 9) and no criminal-record data (Art. 10): no health, genetic, biometric, ethnic, religious, political, trade-union or sex-life field, and none that lets one be inferred. A field that would hold one needs this decision superseded and a data protection impact assessment first; the classification check on every column is where it would show up.',
      consequences: '• No field-level encryption, read logging or impact assessment to run here.\n• Free-text fields are the risk: a support note can hold a diagnosis, so the scan covers them.\n• The first special-category field is a decision and an assessment, not a migration.',
      alternatives: '1. Special categories guarded: encryption, read logs and a DPIA, when such a field is needed.\n2. A separate system for special categories, keeping this store ordinary.',
    },
    {
      id: 'adr-no-personal', label: 'No personal data kept', when: { PERSONAL: ['no'] },
      context: `${FORCES} Here the store keeps no data about people.`,
      decision: 'The store keeps no data that identifies a person, directly or with other data the organisation holds; its events and logs carry none either (no user, device or session ids, no IP addresses). A scan with Microsoft Presidio of the schema, a sample of rows and a day of logs keeps it true. A feature that needs personal data needs this decision superseded first.',
      consequences: '• No retention, erasure, access or transfer obligations here.\n• Logs and analytics lose the user dimension: per-user debugging and funnels need a store that takes on the obligations.\n• A personal field added by accident fails the scan rather than staying unnoticed.',
      alternatives: '1. Keep personal data with limits, when a feature needs it: superseding this decision with the personal-data pack.\n2. Pseudonymous ids only: still personal data under GDPR Art. 4(5), so it would not lift the obligations.',
    },
  ],
  fitness: [
    {
      id: 'ff-retention', label: 'Retention and requests on time', when: PERSONAL, category: 'operational', implements: ERASURE_ADRS, checks: ['req-retain', 'req-access', 'req-erase'],
      threshold: '0 personal records unused for more than {{RETENTION_MONTHS}} months plus the 7-day grace, and 0 access or erasure requests open for more than {{REQUEST_DAYS}} days',
      description: 'A daily data test returns the records past retention and its 7-day grace, and the access and erasure requests past their deadline; any row fails it and alerts the data owner.',
      tool: 'dbt (a singular data test, run daily by the scheduler)',
      language: 'sql',
      snippet: `-- tests/personal_data_on_time.sql: every row returned is a failure
select 'past retention' as problem, cast(customer_id as text) as id
from {{ ref('customers') }}
where last_used_at < now() - interval '{{RETENTION_MONTHS}} months' - interval '7 days'
  and erased_at is null
  and legal_hold is not true
union all
select 'erasure overdue', cast(request_id as text)
from {{ ref('erasure_requests') }}
where completed_at is null
  and accepted_at < now() - interval '{{REQUEST_DAYS}} days'
union all
select 'access request overdue', cast(request_id as text)
from {{ ref('access_requests') }}
where delivered_at is null
  and verified_at < now() - interval '{{REQUEST_DAYS}} days'`,
    },
    {
      id: 'ff-record', label: 'Every field classified and recorded', when: PERSONAL, category: 'structural', implements: [...ERASURE_ADRS, 'adr-no-special'], checks: ['req-record'],
      threshold: '0 columns in the migrated schema without a classification (personal, special or not-personal) in their comment; 0 personal or special columns absent from the record of processing or without purpose, basis, retention, recipients and location there',
      description: 'In CI, after the migrations run against an empty database, a script lists the columns without a classification and checks every personal or special column against docs/record-of-processing.json; a new column fails the build until it is classified, and a personal one until the record names it with all five facts.',
      tool: 'psql and jq in the CI pipeline, against the migrated schema',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
unclassified=$(psql "$DATABASE_URL" -Atc "
  select c.table_name || '.' || c.column_name
  from information_schema.columns c
  join pg_class t on t.relname = c.table_name
  join pg_namespace n on n.oid = t.relnamespace and n.nspname = c.table_schema
  left join pg_description d on d.objoid = t.oid and d.objsubid = c.ordinal_position
  where c.table_schema = 'public'
    and coalesce(d.description, '') !~ '^(personal|special|not-personal)( |:|$)'")
[ -z "$unclassified" ] || { echo "unclassified columns:"; echo "$unclassified"; exit 1; }
missing=0
for col in $(psql "$DATABASE_URL" -Atc "
  select c.table_name || '.' || c.column_name
  from information_schema.columns c
  join pg_class t on t.relname = c.table_name
  join pg_namespace n on n.oid = t.relnamespace and n.nspname = c.table_schema
  join pg_description d on d.objoid = t.oid and d.objsubid = c.ordinal_position
  where c.table_schema = 'public' and d.description ~ '^(personal|special)( |:|$)'"); do
  jq -e --arg c "$col" '.fields[] | select(.column == $c) | .purpose and .basis and .retention and .recipients and .location' \\
    docs/record-of-processing.json > /dev/null || { echo "$col is not in the record of processing with all five facts"; missing=$((missing+1)); }
done
exit $missing`,
    },
    {
      id: 'ff-pii-scan', label: 'Personal data where declared', category: 'structural', implements: [...ERASURE_ADRS, 'adr-no-personal'], checks: ['req-none'],
      threshold: '0 e-mail addresses, phone numbers, IP addresses, card numbers or IBANs with a score of 0.6 or more in a day of logs and a sample of rows outside the fields classified as personal',
      description: 'A nightly job exports a day of logs and a sample of rows from the fields not classified as personal and scans them for e-mail addresses, phone numbers, IP addresses, card numbers and IBANs; it reports the place and kind of each finding, never the value. Names (PERSON) are left out of the free-text scan because the recogniser flags product and place names at this threshold; they are scanned only in structured fields.',
      tool: 'Microsoft Presidio (presidio-analyzer)',
      language: 'python',
      snippet: `# scan.py <file>: exits 1 when the file holds personal data
import sys
from presidio_analyzer import AnalyzerEngine

ENTITIES = ["EMAIL_ADDRESS", "PHONE_NUMBER", "IP_ADDRESS", "CREDIT_CARD", "IBAN_CODE"]
analyzer = AnalyzerEngine()
found = 0
with open(sys.argv[1], encoding="utf-8") as f:
    for n, line in enumerate(f, 1):
        for r in analyzer.analyze(text=line, entities=ENTITIES, language="en", score_threshold=0.6):
            print(f"{sys.argv[1]}:{n}: {r.entity_type}")  # never print the value
            found += 1
sys.exit(1 if found else 0)`,
    },
    {
      id: 'ff-erasure', label: 'Erasure reaches every store', when: { ...PERSONAL, ERASURE: ['delete', 'anonymise'] }, category: 'structural', implements: ['adr-delete', 'adr-anonymise'], checks: ['req-erase', 'req-backups'],
      threshold: '0 stores where an erased person\'s identifiers (e-mail, name, phone) are found after the erasure routine, 0 identifiers left on the person\'s row by id, and 0 after a restore of an older backup',
      description: 'An integration test seeds one person with unique identifiers across every store the record of processing names, runs the erasure routine, searches each store by the identifiers and reads the row by its internal id (gone under deletion; present with every identifier overwritten under anonymisation, so identifiersOf returns [] in both cases); it then restores a backup taken before the erasure and checks again after the ledger replay.',
      tool: 'Vitest with Testcontainers (PostgreSQL and the other stores of the deployment)',
      language: 'ts',
      snippet: `import { erasure } from '../src/privacy/erasure'
import { stores } from './privacy/stores'              // every store of the record of processing: findByIdentifiers, identifiersOf
import { seedEverywhere, takeBackup, restore } from './privacy/fixtures'

it('erases a person from every store, and keeps them erased after a restore', async () => {
  const email = \`erase-\${crypto.randomUUID()}@example.test\`
  const person = await seedEverywhere({ email, name: \`Erase \${crypto.randomUUID()}\`, phone: '+48600000000' })
  const backup = await takeBackup()
  await erasure.run(person.id)
  for (const store of stores) {
    expect(await store.findByIdentifiers(person)).toEqual([])   // by e-mail, name and phone
    expect(await store.identifiersOf(person.id)).toEqual([])    // row gone, or kept with no identifier left
  }
  await restore(backup)                                         // replays the erasure ledger before serving
  for (const store of stores) {
    expect(await store.findByIdentifiers(person)).toEqual([])
    expect(await store.identifiersOf(person.id)).toEqual([])
  }
})`,
    },
    {
      id: 'ff-k-anonymity', label: 'Anonymised records not singled out', when: { ...PERSONAL, ERASURE: ['anonymise'] }, category: 'operational', implements: ['adr-anonymise'], checks: ['req-anonymise'],
      threshold: 'Every combination of quasi-identifiers among anonymised records occurs in at least 5 records (k ≥ 5); 0 anonymised rows with a non-empty free-text field',
      description: 'A daily data test groups the anonymised records by their quasi-identifiers and returns every group smaller than 5, and every anonymised row whose free text was not cleared.',
      tool: 'dbt (a singular data test)',
      language: 'sql',
      snippet: `-- tests/anonymised_k5.sql: every row returned singles people out
select 'group of ' || count(*) as problem, birth_year || ' ' || postcode_prefix || ' ' || gender as who
from {{ ref('customers') }}
where anonymised_at is not null
group by birth_year, postcode_prefix, gender
having count(*) < 5
union all
select 'free text kept', cast(customer_id as text)
from {{ ref('customers') }}
where anonymised_at is not null
  and coalesce(notes, '') <> ''`,
    },
    {
      id: 'ff-shred', label: 'Shredded data unreadable', when: { ...PERSONAL, ERASURE: ['crypto'] }, category: 'structural', implements: ['adr-crypto'], checks: ['req-shred'],
      threshold: 'After an erasure, the person\'s wrapped data key is gone from the key table, its backup copies expire within {{BACKUP_DAYS}} days, and 0 of the person\'s encrypted fields decrypt in the store, the event stream or a copy taken before',
      description: 'An integration test writes a person\'s fields through the envelope layer, copies the ciphertext as a backup would, erases the person, and expects the key table to hold no data key for them, the key table\'s backup retention to be at most {{BACKUP_DAYS}} days, and every decryption of the copies to fail; the wrapping key in the key service stays, since it wraps everyone\'s data keys.',
      tool: 'Vitest with LocalStack (AWS KMS) or a Vault dev server behind the application\'s envelope layer',
      language: 'ts',
      snippet: `import { envelope } from '../src/crypto/envelope'      // encryptFor(personId, fields), decryptFields(ciphertext)
import { dataKeys } from '../src/crypto/dataKeys'      // the key table: wrapped data key per person, with its backup retention
import { erasure } from '../src/privacy/erasure'
import { store, events, createPerson } from './privacy/fixtures'

it('makes every copy of an erased person unreadable', async () => {
  const person = await createPerson({ email: 'shred@example.test' })
  const copies = [await store.rawFields(person.id), await events.rawFields(person.id)]  // ciphertext, as backups hold it
  expect(await dataKeys.find(person.id)).toBeDefined()
  await erasure.run(person.id)
  expect(await dataKeys.find(person.id)).toBeUndefined()
  expect(dataKeys.backupRetentionDays).toBeLessThanOrEqual({{BACKUP_DAYS}})
  envelope.dropCachedKeys()
  for (const fields of copies) await expect(envelope.decryptFields(fields)).rejects.toThrow()
})`,
    },
    {
      id: 'ff-protect', label: 'TLS floor and reviewed roles', when: PERSONAL, category: 'structural', implements: ERASURE_ADRS, checks: ['req-protect'],
      threshold: 'The database refuses TLS below 1.2 (ssl_min_protocol_version TLSv1.2 or higher); 0 roles with SELECT on a table holding personal data whose last review is older than 6 months',
      description: 'A database test run in CI against the migrated database checks the server\'s minimum TLS version, and joins the roles with SELECT on personal tables (the ones with a column commented personal or special) with the role_reviews table the access owner fills in; any role not reviewed in 6 months fails it.',
      tool: 'pgTAP (run with pg_prove); for a managed database the TLS floor is a parameter-group check with the provider\'s CLI',
      language: 'sql',
      snippet: `BEGIN;
SELECT plan(2);

SELECT ok(current_setting('ssl_min_protocol_version') IN ('TLSv1.2', 'TLSv1.3'), 'connections below TLS 1.2 are refused');

SELECT is_empty($$
  SELECT DISTINCT g.grantee
  FROM information_schema.role_table_grants g
  JOIN information_schema.columns c ON c.table_schema = g.table_schema AND c.table_name = g.table_name
  JOIN pg_class t ON t.relname = c.table_name
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = c.table_schema
  JOIN pg_description d ON d.objoid = t.oid AND d.objsubid = c.ordinal_position
  LEFT JOIN role_reviews r ON r.role_name = g.grantee
  WHERE g.privilege_type = 'SELECT'
    AND d.description ~ '^(personal|special)( |:|$)'
    AND (r.reviewed_at IS NULL OR r.reviewed_at < now() - interval '6 months')
$$, 'every role reading personal data was reviewed in the last 6 months');

SELECT * FROM finish();
ROLLBACK;`,
    },
    {
      id: 'ff-breach-register', label: 'Every breach documented and notified in time', when: PERSONAL, category: 'process', implements: ERASURE_ADRS, checks: ['req-breach', 'req-breach-register', 'req-breach-people'],
      threshold: '0 breaches in the register without an awareness time, facts, effects, remedy and a risk assessment; 0 assessed unlikely without the reason not to notify; 0 others not notified 72 hours after awareness, or first notified later without the reasons for the delay, or whose notification phases together lack the nature, the data protection officer\'s contact, the consequences or the measures; 0 high-risk ones without the time people were told or an Art. 34(3) exception; the last reconciliation with the security incidents at most 92 days old',
      description: 'A daily CI job reads docs/breaches/register.json, the breach register kept in the repository (categories and numbers, never the people\'s data): reconciled_at, and per breach id, aware_at, facts, effects, remedy, risk (unlikely, risk or high), not_notified_reason, notifications (one entry per phase: at, nature, dpo_contact, consequences, measures), delay_reason, people_told_at and art34_exception; times are in UTC (2026-09-07T09:00:00Z). When the breaches are kept as incidents in the incident tool the Incident management pack decides, the job first exports them to this shape. It fails on any gap and prints the breach ids, never their contents.',
      tool: 'jq 1.7 in a daily CI job (bash)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# daily CI: docs/breaches/register.json documents every breach and its notification (GDPR Art. 33, 34); times in UTC
set -euo pipefail
problems=$(jq -r --argjson now "$(date -u +%s)" '
  def t: (. // "1970-01-01T00:00:00Z") | sub("\\\\.[0-9]+"; "") | fromdateiso8601;
  def text(k): (.[k] // "" | tostring | length) > 0;
  (select($now - (.reconciled_at | t) > 92 * 86400) | "not reconciled with the security incidents for 92 days"),
  (.breaches[] | .id as $id | (.notifications // []) as $n |
    (["aware_at", "facts", "effects", "remedy"][] as $k | select(text($k) | not) | "\\($id): no \\($k)"),
    (select(.risk | IN("unlikely", "risk", "high") | not) | "\\($id): risk is not assessed as unlikely, risk or high"),
    (select(.risk == "unlikely" and (text("not_notified_reason") | not)) | "\\($id): not notified, and no reason"),
    (select((.risk == "risk" or .risk == "high") and ($n | length) == 0 and $now - (.aware_at | t) > 72 * 3600) | "\\($id): not notified 72 hours after awareness"),
    (select(($n | length) > 0 and ($n[0].at | t) - (.aware_at | t) > 72 * 3600 and (text("delay_reason") | not)) | "\\($id): notified after 72 hours without the reasons for the delay"),
    (select(($n | length) > 0) | ["nature", "dpo_contact", "consequences", "measures"][] as $k | select([$n[] | has($k)] | any | not) | "\\($id): no phase of the notification gives \\($k)"),
    (select(.risk == "high" and (text("people_told_at") or text("art34_exception") | not)) | "\\($id): high risk, people not told and no Art. 34(3) exception")
  )' docs/breaches/register.json)
[ -z "$problems" ] || { echo "$problems"; exit 1; }`,
    },
    {
      id: 'ff-breach-runbook', label: 'Breach runbook and processor notice ready', when: PERSONAL, category: 'structural', implements: ERASURE_ADRS, checks: ['req-breach', 'req-breach-processor'],
      threshold: 'docs/breaches/runbook.md has the lines Supervisory authority: (with a link) and Decides:, and names the 72 hours, the nature of the breach, the data protection officer, the likely consequences and the measures; 0 processors in processors.yaml without breach_notice_hours or with more than {{PROCESSOR_NOTICE_HOURS}} hours',
      description: 'A CI step on every change fails when the breach runbook stops naming the supervisory authority with its notification link, the person who decides whether to notify, the 72 hours or any of the four parts of the notification of GDPR Art. 33(3), or when a processor in processors.yaml, the processor register, has no breach_notice_hours from its contract or a longer one than allowed.',
      tool: 'bash with grep and yq (mikefarah yq v4) in a CI step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI, on every change: the breach runbook says whom to notify, by when, with what and who decides; processors report in time
set -euo pipefail
f=docs/breaches/runbook.md
problems=0
need() { grep -Eqi "$1" "$f" || { echo "$f: $2"; problems=$((problems + 1)); }; }
need '^Supervisory authority: .*https://' 'no line "Supervisory authority:" with its name and notification link'
need '^Decides: +[^ ]' 'no line "Decides:" naming who decides whether to notify'
need '72 hours' 'does not say the authority is notified within 72 hours of becoming aware'
need 'nature of the breach' 'does not ask for the nature of the breach (categories and numbers of people and records)'
need 'data protection officer' 'does not give the contact of the data protection officer'
need 'likely consequences' 'does not ask for the likely consequences'
need 'measures' 'does not ask for the measures taken or proposed'
late=$(yq '.processors[] | select((.breach_notice_hours // 1000) > {{PROCESSOR_NOTICE_HOURS}}) | .name' processors.yaml)
[ -z "$late" ] || { echo "processors.yaml: no breach notice within {{PROCESSOR_NOTICE_HOURS}} hours: $late"; problems=$((problems + 1)); }
exit $problems`,
    },
    {
      id: 'ff-region', label: 'Deployed in EU regions', when: { ...PERSONAL, REGION: ['eu'] }, category: 'structural', implements: ['adr-region-eu'], checks: ['req-region-eu'],
      threshold: '0 providers, backup copies or processors outside EU/EEA regions in the infrastructure plan and the processor register',
      description: 'In CI the Terraform plan (terraform show -json) is checked by a policy that fails on any provider or backup copy destination outside the allowed EU regions (the region is read from the vault ARN, so eu-west-2, London, is refused); the same run checks processors.yaml, the processor register, against the EEA country list.',
      tool: 'Conftest (on the Terraform plan and on processors.yaml)',
      language: 'rego',
      snippet: `package main

import rego.v1

eu_regions := {"eu-central-1", "eu-central-2", "eu-west-1", "eu-west-3", "eu-north-1", "eu-south-1", "eu-south-2"}
eea := {"AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO"}

deny contains msg if {
	some name, p in input.configuration.provider_config
	p.name == "aws"
	region := p.expressions.region.constant_value
	not region in eu_regions
	msg := sprintf("provider %s deploys to %s, outside the EU", [name, region])
}

deny contains msg if {
	some r in input.resource_changes
	r.type == "aws_backup_plan"
	some rule in r.change.after.rule
	some copy in rule.copy_action
	region := split(copy.destination_vault_arn, ":")[3]
	not region in eu_regions
	msg := sprintf("backup plan %s copies to %s, outside the EU", [r.address, region])
}

deny contains msg if {
	some p in input.processors
	not p.country in eea
	msg := sprintf("processor %s is in %s, outside the EU/EEA", [p.name, p.country])
}`,
    },
    {
      id: 'ff-adequacy', label: 'Processors in adequate countries', when: { ...PERSONAL, REGION: ['adequate'] }, category: 'process', implements: ['adr-region-adequate'], checks: ['req-region-adequate'],
      threshold: '0 processors in the register outside the EU/EEA and the countries with an adequacy decision; 0 US processors without Data Privacy Framework certification',
      description: 'In CI a policy checks processors.yaml, the processor register kept in the repository, against the EU/EEA and the adequacy list; the list is updated when the Commission adopts or withdraws a decision.',
      tool: 'Conftest (on processors.yaml)',
      language: 'rego',
      snippet: `package main

import rego.v1

eea := {"AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO"}
# Adequacy decisions (GDPR Art. 45); US only for companies certified under the Data Privacy Framework
adequate := {"AD", "AR", "CA", "FO", "GG", "IL", "IM", "JP", "JE", "NZ", "KR", "CH", "GB", "UY", "US"}

deny contains msg if {
	some p in input.processors
	not p.country in eea
	not p.country in adequate
	msg := sprintf("processor %s is in %s, which has no adequacy decision", [p.name, p.country])
}

deny contains msg if {
	some p in input.processors
	p.country == "US"
	not p.dpf_certified
	msg := sprintf("processor %s is in the US but not certified under the Data Privacy Framework", [p.name])
}`,
    },
    {
      id: 'ff-scc', label: 'Transfers have clauses and assessment', when: { ...PERSONAL, REGION: ['any'] }, category: 'process', implements: ['adr-region-any'], checks: ['req-region-scc'],
      threshold: '0 processors outside the EU/EEA and adequate countries without a signing date for the standard contractual clauses and a transfer impact assessment reviewed in the last 12 months',
      description: 'In CI a policy checks processors.yaml, the processor register: every processor outside the EU/EEA and the adequate countries needs the date its clauses were signed and the date of its transfer impact assessment, not older than 12 months; a missing date fails as much as an old one.',
      tool: 'Conftest (on processors.yaml)',
      language: 'rego',
      snippet: `package main

import rego.v1

eea := {"AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO"}
adequate := {"AD", "AR", "CA", "FO", "GG", "IL", "IM", "JP", "JE", "NZ", "KR", "CH", "GB", "UY", "US"}
year_ns := 365 * 24 * 60 * 60 * 1000000000

needs_safeguards(p) if {
	not p.country in eea
	not p.country in adequate
}

deny contains msg if {
	some p in input.processors
	needs_safeguards(p)
	not p.scc_signed
	msg := sprintf("processor %s in %s has no standard contractual clauses", [p.name, p.country])
}

deny contains msg if {
	some p in input.processors
	needs_safeguards(p)
	not p.tia_reviewed
	msg := sprintf("processor %s in %s has no transfer impact assessment", [p.name, p.country])
}

deny contains msg if {
	some p in input.processors
	needs_safeguards(p)
	time.now_ns() - time.parse_rfc3339_ns(sprintf("%sT00:00:00Z", [p.tia_reviewed])) > year_ns
	msg := sprintf("processor %s: transfer impact assessment older than 12 months", [p.name])
}`,
    },
    {
      id: 'ff-special', label: 'Special fields encrypted and read-logged', when: { ...PERSONAL, SPECIAL: ['yes'] }, category: 'structural', implements: ['adr-special'], checks: ['req-special'],
      threshold: 'Every column classified as special category is stored as ciphertext (bytea), 0 roles outside the record of processing may read it, and pgAudit object logging through the auditor role covers its table',
      description: 'A database test run in CI after the migrations asserts that each special-category column holds ciphertext, that only the listed roles have SELECT on its table, that pgaudit.role names the auditor role, and that the auditor role holds SELECT on the table, which is what makes pgAudit log every read of it.',
      tool: 'pgTAP (run with pg_prove) with the pgAudit extension',
      language: 'sql',
      snippet: `BEGIN;
SELECT plan(5);
SELECT col_type_is('health', 'conditions', 'diagnosis', 'bytea', 'diagnosis is stored encrypted');
SELECT table_privs_are('health', 'conditions', 'care_service', ARRAY['SELECT', 'INSERT', 'UPDATE']);
SELECT table_privs_are('health', 'conditions', 'reporting', ARRAY[]::text[], 'reporting cannot read diagnoses');
SELECT is(current_setting('pgaudit.role', true), 'auditor', 'pgAudit object logging goes through the auditor role');
SELECT table_privs_are('health', 'conditions', 'auditor', ARRAY['SELECT'], 'reads of diagnoses are logged');
SELECT * FROM finish();
ROLLBACK;`,
    },
    {
      id: 'ff-dpia-gate', label: 'No DPIA, no deploy', when: { ...PERSONAL, SPECIAL: ['yes'] }, category: 'process', implements: ['adr-special'], checks: ['req-dpia'],
      threshold: '0 purposes, stores or recipients of special-category data in the record of processing without an approved impact assessment linked',
      description: 'A release gate reads docs/record-of-processing.json: every entry marked special must link a DPIA file under docs/dpia whose front matter says status: approved; the release stops on any that does not.',
      tool: 'jq and grep in the release pipeline (bash)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
failed=0
for entry in $(jq -r '.processing[] | select(.special == true) | "\\(.purpose)|\\(.dpia // "")"' docs/record-of-processing.json); do
  purpose=\${entry%%|*}; dpia=\${entry#*|}
  if [ -z "$dpia" ] || [ ! -f "docs/dpia/$dpia" ]; then echo "$purpose: no DPIA linked"; failed=1; continue; fi
  grep -q '^status: approved$' "docs/dpia/$dpia" || { echo "$purpose: $dpia is not approved"; failed=1; }
done
exit $failed`,
    },
    {
      id: 'ff-purpose-roles', label: 'Purpose enforced by role', when: { ...PERSONAL, BASIS: ['contract'] }, category: 'structural', implements: ['adr-basis-contract'], checks: ['req-purpose'],
      threshold: 'Every service role has SELECT on a personal table only when the record of processing lists it for a purpose of that table; 0 grants beyond the record',
      description: 'A database test run in CI after the migrations compares the SELECT grants on personal tables with the recipients of docs/record-of-processing.json, loaded into a temporary table by the pipeline, and fails on any grant the record does not explain.',
      tool: 'pgTAP (run with pg_prove); the pipeline loads the record into record_recipients(table_name, role_name) first',
      language: 'sql',
      snippet: `BEGIN;
SELECT plan(1);

SELECT is_empty($$
  SELECT g.grantee, g.table_name
  FROM information_schema.role_table_grants g
  JOIN information_schema.columns c ON c.table_schema = g.table_schema AND c.table_name = g.table_name
  JOIN pg_class t ON t.relname = c.table_name
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = c.table_schema
  JOIN pg_description d ON d.objoid = t.oid AND d.objsubid = c.ordinal_position
  LEFT JOIN record_recipients r ON r.table_name = g.table_name AND r.role_name = g.grantee
  WHERE g.privilege_type = 'SELECT'
    AND d.description ~ '^(personal|special)( |:|$)'
    AND g.grantee NOT IN ('postgres', 'migrator')
    AND r.role_name IS NULL
$$, 'no role reads personal data beyond the record of processing');

SELECT * FROM finish();
ROLLBACK;`,
    },
    {
      id: 'ff-consent', label: 'Consent recorded and honoured', when: { ...PERSONAL, BASIS: ['consent'] }, category: 'structural', implements: ['adr-basis-consent'], checks: ['req-consent'],
      threshold: 'Giving and withdrawing consent each produce 1 record with purpose, wording version, time and channel; withdrawal takes 1 request; after it the purpose\'s job skips the person',
      description: 'An integration test gives consent for personalised offers as a person, withdraws it with one request, reads both records back, and runs the personalisation job to check that the person is skipped.',
      tool: 'Vitest with supertest',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../src/app'
import { consents } from '../src/privacy/consents'
import { personalisation } from '../src/marketing/personalisation'
import { createPerson, tokenFor } from './privacy/fixtures'

it('records consent and its withdrawal, and stops the processing', async () => {
  const person = await createPerson({ email: 'consent@example.test' })
  await request(app).post('/me/consents').send({ purpose: 'personalised-offers', wordingVersion: 3 }).set('Authorization', \`Bearer \${await tokenFor(person)}\`).expect(201)
  await request(app).delete('/me/consents/personalised-offers').set('Authorization', \`Bearer \${await tokenFor(person)}\`).expect(204)
  const records = await consents.history(person.id, 'personalised-offers')
  expect(records).toHaveLength(2)
  for (const r of records) expect(r).toMatchObject({ purpose: 'personalised-offers', wordingVersion: 3, at: expect.any(Date), channel: 'web' })
  expect(records.map((r) => r.event)).toEqual(['given', 'withdrawn'])
  expect(await personalisation.run({ personIds: [person.id] })).toMatchObject({ processed: [], skipped: [person.id] })
})`,
    },
    {
      id: 'ff-objection', label: 'Objections honoured', when: { ...PERSONAL, BASIS: ['legitimate'] }, category: 'structural', implements: ['adr-basis-legitimate'], checks: ['req-objection'],
      threshold: 'After an objection, 0 marketing messages to the person and 0 analytics rows for them from the next job run on; the objection is on the exclusion list with its date',
      description: 'An integration test objects as a person, sends a marketing campaign and runs the analytics job, and checks that neither touched the person and that the exclusion list holds the objection with its date.',
      tool: 'Vitest with supertest, the mail sender captured by the test harness',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../src/app'
import { exclusions } from '../src/privacy/exclusions'
import { campaigns } from '../src/marketing/campaigns'
import { usageAnalytics } from '../src/analytics/usage'
import { createPerson, tokenFor, mails } from './privacy/fixtures'

it('stops marketing at once and analytics from the next run', async () => {
  const person = await createPerson({ email: 'object@example.test' })
  await request(app).post('/me/objections').send({ purposes: ['marketing', 'usage-analytics'] }).set('Authorization', \`Bearer \${await tokenFor(person)}\`).expect(201)
  expect(await exclusions.find(person.id)).toMatchObject({ purposes: ['marketing', 'usage-analytics'], objectedAt: expect.any(Date) })
  await campaigns.send('autumn-offers')
  expect(await mails.sentTo(person.email)).toEqual([])
  await usageAnalytics.run()
  expect(await usageAnalytics.rowsFor(person.id)).toEqual([])
})`,
    },
  ],
}

export default pack
