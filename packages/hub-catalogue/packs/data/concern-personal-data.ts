import type { PackSpec, When } from '../../src/packSpec'

const PERSONAL: When = { PERSONAL: ['yes'] }
const FORCES = 'This store keeps data, and some of it may be about people. The forces: data protection law (GDPR) limits why personal data may be processed, for how long it is kept and where it may go, and gives people the rights to get, take away and erase it, each within one month; copies multiply (replicas, backups, logs, exports, analytics, processors) and every one of them has to follow; health, biometric and other special categories carry a higher bar; erasing must not break the records others still need (invoices, the audit trail); and the controller has to be able to prove all of it (accountability, Art. 5(2)).'

const pack: PackSpec = {
  id: 'concern-personal-data',
  name: 'Personal data',
  group: 'data',
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
    { title: 'ICO, UK GDPR guidance and resources', url: 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/' },
  ],
  questions: [
    {
      key: 'PERSONAL', title: 'Personal data', label: 'Does it keep data about people?',
      hint: 'Names, e-mail and IP addresses, device and customer ids, and anything else that can be tied to a person count (GDPR Art. 4(1)); so do log lines that carry them.',
      default: 'yes',
      options: [
        { value: 'yes', label: 'yes, data about people', description: 'Any field, log line or event that identifies a person directly or with other data the organisation holds. Pick it when the store keeps accounts, customers, employees, addresses, IPs or user ids; retention, rights, location and security become requirements.' },
        { value: 'no', label: 'no, nothing that identifies a person', description: 'Only data about things: products, prices, telemetry without user or device ids. Pick it only when no column, log line or event can be tied to a person; the decision records it and a scan keeps it true.' },
      ],
    },
    {
      key: 'SPECIAL', title: 'Special categories', label: 'Does it keep health, biometric or other special-category data?',
      hint: 'GDPR Art. 9 forbids processing health, genetic, biometric, ethnic, religious, political, trade-union and sex-life data unless one of its exceptions applies, and a large-scale use needs a data protection impact assessment (Art. 35).',
      default: 'no',
      options: [
        { value: 'no', label: 'no special categories', description: 'None of the Art. 9 categories and no criminal records (Art. 10). Pick it for ordinary customer, order and account data.' },
        { value: 'yes', label: 'special-category data', description: 'Health or fitness readings, diagnoses, biometrics used to identify, genetic data, beliefs, ethnicity or sexual orientation, even inferred. Pick it whenever such a field exists or can be derived; it adds field-level encryption, read logging and an impact assessment.' },
      ],
    },
    {
      key: 'REGION', title: 'Location', label: 'Where may the personal data be kept and processed?',
      hint: 'Chapter V of the GDPR allows a transfer outside the EU/EEA only to a country with an adequacy decision or under safeguards such as standard contractual clauses; backups, logs, support tools and every processor count.',
      default: 'eu',
      options: [
        { value: 'eu', label: 'in the EU/EEA only', description: 'Stores, backups, logs and every processor stay in EU/EEA regions. Pick it when customers or contracts demand it, for public-sector or health data, or simply to need no transfer mechanism at all.' },
        { value: 'adequate', label: 'in the EU/EEA or a country with an adequacy decision', description: 'Also the UK, Switzerland, Japan, Canada, the US (certified under the Data Privacy Framework) and the other countries the Commission has found adequate (Art. 45). Pick it when a processor you need runs there and nowhere else.' },
        { value: 'any', label: 'anywhere, under standard contractual clauses', description: 'Transfers to any country with the Commission\'s standard contractual clauses and a transfer impact assessment per processor (Art. 46, EDPB Recommendations 01/2020). Pick it when global processors or follow-the-sun support are needed and someone owns the assessments.' },
      ],
    },
    {
      key: 'ERASURE', title: 'Erasure', label: 'How is a person\'s data erased?',
      hint: 'Erasure (Art. 17) and retention (Art. 5(1)(e)) have to reach every copy: replicas, caches, logs, exports and backups that cannot be edited.',
      default: 'delete',
      options: [
        { value: 'delete', label: 'deletion', description: 'Rows and documents are deleted where they live; backups age out and a restore re-applies the erasures made since it was taken. Pick it when the stores are few and known, and backups are kept for weeks rather than years.' },
        { value: 'anonymise', label: 'anonymisation in place', description: 'Identifiers are replaced or generalised so the records no longer relate to anyone, and the records stay for statistics and accounting. Pick it when the business needs the history (orders, revenue) after the person is gone.' },
        { value: 'crypto', label: 'crypto-shredding', description: 'Each person\'s fields are encrypted with a key of their own; destroying the key erases them in every store, log and backup at once. Pick it when the data spreads to backups, event streams or archives you cannot edit, and you can run a key management service.' },
      ],
    },
    {
      key: 'BASIS', title: 'Lawful basis', label: 'On what lawful basis is most of it processed?',
      hint: 'Every purpose needs one of the six bases of Art. 6(1), and the basis decides which rights apply and what has to be recorded: consent must be provable and as easy to withdraw as to give; legitimate interests can be objected to.',
      default: 'contract',
      options: [
        { value: 'contract', label: 'contract or legal obligation', description: 'Data needed to deliver what the person signed up for, or that the law requires you to keep (Art. 6(1)(b), (c)). Pick it for accounts, orders, invoices; purpose limitation is what must be enforced.' },
        { value: 'consent', label: 'consent, recorded per purpose', description: 'The person opted in to a purpose such as marketing or personalisation (Art. 6(1)(a), Art. 7). Pick it when the processing is optional for the service; each consent is recorded and its withdrawal stops the processing.' },
        { value: 'legitimate', label: 'legitimate interests', description: 'Processing the person would reasonably expect, such as fraud prevention or analytics on their use, after a balancing test (Art. 6(1)(f)). Pick it when consent does not fit and you have documented the test; objections (Art. 21) must be honoured.' },
      ],
    },
  ],
  details: [
    { key: 'RETENTION_MONTHS', label: 'After how many months unused is personal data erased?', default: '24', number: true },
    { key: 'ERASE_DAYS', label: 'Within how many days is an erasure request done (at most 30)?', default: '30', number: true },
    { key: 'BACKUP_DAYS', label: 'For how many days are backups kept?', default: '35', number: true },
  ],
  need: {
    label: 'People\'s data handled lawfully',
    text: 'The system keeps data about people. Data protection law and the people themselves expect it to be processed only for a stated purpose on a lawful basis, kept no longer than needed, kept where the law allows, protected against leaks, handed over when a person asks and erased when they ask, every copy included. The organisation also has to be able to show, at any time, what it keeps, why, where and for how long.',
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
      action: 'deliver all of it from every store, as JSON, within 30 days, together with the purposes, recipients, retention periods and source of each part',
      rationale: 'The right of access (GDPR Art. 15) and the right to data portability in a structured, commonly used, machine-readable format (Art. 20), both within one month (Art. 12(3)).',
      scenario: { label: 'Data handed over', given: 'a verified person with an account, orders and support tickets', when: 'they ask for their data', then: 'within 30 days they receive one JSON file holding all of it, with purposes, recipients and retention periods' },
    },
    {
      id: 'req-erase', label: 'Erasure on request', when: PERSONAL, ears_type: 'event-driven',
      trigger: 'a verified person\'s erasure request is accepted',
      action: 'erase their data by {{ERASURE}} in every store, replica, cache, log and export within {{ERASE_DAYS}} days, keep only what a legal obligation requires, tell every recipient it was disclosed to, and confirm to the person',
      rationale: 'The right to erasure (GDPR Art. 17) within one month (Art. 12(3)), passed on to the recipients (Art. 19); records the law requires (invoices) are an exception of Art. 17(3)(b).',
      scenario: { label: 'Person erased', given: 'a person with an account, orders, log entries and a copy at a processor', when: 'their erasure request is accepted', then: 'within {{ERASE_DAYS}} days nothing identifies them in any store, log or export, the processor is told, invoices remain, and the person is told' },
    },
    {
      id: 'req-backups', label: 'Erasures survive restores', when: { PERSONAL: ['yes'], ERASURE: ['delete', 'anonymise'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a backup taken before an erasure is restored',
      action: 're-apply every erasure recorded since the backup was taken before the restored store serves a request, and let backups expire after {{BACKUP_DAYS}} days',
      rationale: 'Backups cannot be edited, so they are put "beyond use" until they expire (ICO, right to erasure); a restore must not bring erased people back (GDPR Art. 17).',
      scenario: { label: 'Restore keeps erasures', given: 'a backup taken before a person was erased', when: 'the backup is restored', then: 'the person is erased again before the store serves its first request' },
    },
    {
      id: 'req-anonymise', label: 'Anonymised for good', when: { PERSONAL: ['yes'], ERASURE: ['anonymise'] }, ears_type: 'ubiquitous',
      action: 'replace direct identifiers with random values without keeping any mapping, and generalise the remaining quasi-identifiers (birth date, postcode, gender) until every combination of them occurs in at least 5 records',
      rationale: 'Anonymous data is outside the GDPR only when the person can no longer be identified by any reasonably likely means (Recital 26); pseudonymised data with a key is still personal (Art. 4(5)). k-anonymity of 5 is a common floor (Article 29 Working Party, Opinion 05/2014 on anonymisation techniques).',
      scenario: { label: 'No one singled out', given: 'the anonymised records of erased people', when: 'they are grouped by birth year, postcode prefix and gender', then: 'no group holds fewer than 5 records and no table maps them back' },
    },
    {
      id: 'req-shred', label: 'Erasure by key destruction', when: { PERSONAL: ['yes'], ERASURE: ['crypto'] }, ears_type: 'event-driven',
      trigger: 'a person\'s erasure request is accepted, or their data passes its retention period',
      action: 'destroy the person\'s data key within 24 hours, and its copies in key backups within {{BACKUP_DAYS}} days, so that their fields in every store, event, log and backup can no longer be decrypted',
      rationale: 'Encrypted data whose key no longer exists cannot be read by anyone, which reaches backups and event streams that cannot be edited (GDPR Art. 17, ICO on erasure of backups).',
      scenario: { label: 'Key destroyed', given: 'a person whose fields are in the store, an event stream and last night\'s backup', when: 'their erasure is accepted and 24 hours pass', then: 'their key is gone and decrypting any of those copies fails' },
    },
    {
      id: 'req-protect', label: 'Protected at rest and in transit', when: PERSONAL, ears_type: 'ubiquitous',
      action: 'encrypt personal data in transit with TLS 1.2 or later and at rest with AES-256, give staff access to it only through roles that need it, and review those roles every 6 months',
      rationale: 'Security of processing (GDPR Art. 32(1)(a), (b)) and integrity and confidentiality (Art. 5(1)(f)); encryption also decides whether a breach must be told to the people affected (Art. 34(3)(a)).',
      scenario: { label: 'Encrypted everywhere', given: 'the store, its replicas and backups', when: 'their encryption settings and the roles with read access are listed', then: 'all are encrypted with AES-256, connections refuse TLS below 1.2, and every role with access was reviewed in the last 6 months' },
    },
    {
      id: 'req-breach', label: 'Breaches reported in time', when: PERSONAL, ears_type: 'event-driven',
      trigger: 'a breach of personal data is detected',
      action: 'notify the supervisory authority within 72 hours of becoming aware of it, unless it is unlikely to result in a risk to people, tell the people affected without undue delay when the risk is high, and record every breach in the breach register',
      rationale: 'GDPR Art. 33(1) sets 72 hours for the notification, Art. 34 the duty to tell the people affected, Art. 33(5) the register of all breaches.',
      scenario: { label: 'Breach reported', given: 'a log export with e-mail addresses found on a public bucket', when: 'it is reported to the on-call team', then: 'the authority is notified within 72 hours and the breach is in the register with its facts, effects and remedy' },
    },
    {
      id: 'req-region-eu', label: 'Kept in the EU/EEA', when: { PERSONAL: ['yes'], REGION: ['eu'] }, ears_type: 'ubiquitous',
      action: 'store and process personal data only in EU/EEA regions, with backups, logs, support tools and every processor included',
      rationale: 'No transfer outside the EU/EEA, so none of the conditions of GDPR Chapter V (Art. 44-49) has to be met or proven.',
      scenario: { label: 'Nothing leaves the EU', given: 'the deployment, its backups and every processor in the register', when: 'their regions and countries are listed', then: 'all are in the EU/EEA' },
    },
    {
      id: 'req-region-adequate', label: 'Only to adequate countries', when: { PERSONAL: ['yes'], REGION: ['adequate'] }, ears_type: 'ubiquitous',
      action: 'transfer personal data outside the EU/EEA only to countries covered by an adequacy decision of the European Commission, and list every processor with its country in the processor register',
      rationale: 'A transfer on the basis of an adequacy decision needs no further authorisation (GDPR Art. 45(1)); the register is part of the record of processing (Art. 30(1)(e)).',
      scenario: { label: 'Only adequate countries', given: 'the processor register', when: 'it is checked against the Commission\'s adequacy list', then: 'every processor outside the EU/EEA is in a country on that list' },
    },
    {
      id: 'req-region-scc', label: 'Transfers under safeguards', when: { PERSONAL: ['yes'], REGION: ['any'] }, ears_type: 'event-driven',
      trigger: 'personal data is to be sent to a processor in a country outside the EU/EEA without an adequacy decision',
      action: 'sign the Commission\'s standard contractual clauses and complete a transfer impact assessment before the first transfer, record both in the processor register, and review the assessment every 12 months',
      rationale: 'Without an adequacy decision a transfer needs appropriate safeguards (GDPR Art. 46(2)(c)) and an assessment of the destination\'s law (CJEU C-311/18 Schrems II, EDPB Recommendations 01/2020).',
      scenario: { label: 'Transfer safeguarded', given: 'a new support tool hosted outside the EU/EEA and adequate countries', when: 'it is to receive customer data', then: 'no data is sent before its clauses and impact assessment are in the processor register' },
    },
    {
      id: 'req-special', label: 'Special categories guarded', when: { PERSONAL: ['yes'], SPECIAL: ['yes'] }, ears_type: 'ubiquitous',
      action: 'process special-category data only under an Art. 9(2) condition recorded per person, encrypt those fields at field level with keys only the services that need them can use, and log every read with the reader, the time and the purpose, keeping the log 12 months',
      rationale: 'Special categories may be processed only under an exception of GDPR Art. 9(2), most often explicit consent; field-level encryption and read logs are the appropriate measures of Art. 32 for data whose leak harms most.',
      scenario: { label: 'Health field guarded', given: 'a record with a diagnosis', when: 'a service without the key and then a clinician\'s service read it', then: 'the first gets only ciphertext; the second reads it and the read is logged with reader, time and purpose' },
    },
    {
      id: 'req-dpia', label: 'Impact assessed first', when: { PERSONAL: ['yes'], SPECIAL: ['yes'] }, ears_type: 'event-driven',
      trigger: 'a change adds a new purpose, store or recipient for special-category data',
      action: 'complete and approve a data protection impact assessment, with the data protection officer\'s advice, before the change is deployed',
      rationale: 'Large-scale processing of special categories requires a DPIA before it starts (GDPR Art. 35(1), (3)(b)), with the DPO consulted (Art. 35(2)).',
      scenario: { label: 'No DPIA, no deploy', given: 'a change that sends health data to a new analytics store', when: 'it is to be deployed', then: 'the deployment waits until its DPIA is approved' },
    },
    {
      id: 'req-purpose', label: 'Used only for its purpose', when: { PERSONAL: ['yes'], BASIS: ['contract'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a service the record of processing does not list for a field\'s purpose tries to read it',
      action: 'refuse the read through the database role or API it uses, and log the attempt',
      rationale: 'Data collected for a contract may not be reused for unrelated purposes (purpose limitation, GDPR Art. 5(1)(b), Art. 6(1)(b), (4)); access rights enforce what the record states.',
      scenario: { label: 'Other purpose refused', given: 'the marketing service, which the record does not list for order addresses', when: 'it queries the order addresses', then: 'the query is refused and logged' },
    },
    {
      id: 'req-consent', label: 'Consent provable and revocable', when: { PERSONAL: ['yes'], BASIS: ['consent'] }, ears_type: 'event-driven',
      trigger: 'a person gives or withdraws consent for a purpose',
      action: 'record it with the purpose, the version of the wording shown, the time and the channel, and on withdrawal stop processing for that purpose within 24 hours, with withdrawing taking no more steps than giving',
      rationale: 'The controller must be able to demonstrate consent (GDPR Art. 7(1)), and withdrawing it must be as easy as giving it (Art. 7(3); EDPB Guidelines 05/2020 on consent).',
      scenario: { label: 'Consent withdrawn', given: 'a person who consented to personalised offers with wording version 3', when: 'they withdraw it in one click', then: 'the record shows both events with version and channel, and no offer is personalised for them after 24 hours' },
    },
    {
      id: 'req-objection', label: 'Objections honoured', when: { PERSONAL: ['yes'], BASIS: ['legitimate'] }, ears_type: 'event-driven',
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
      id: 'adr-delete', label: 'Personal data erased by deletion', when: { PERSONAL: ['yes'], ERASURE: ['delete'] },
      decision: 'Personal data is kept only in the stores and fields the record of processing names, each field classified in the schema (a column comment or a data-catalogue tag in OpenMetadata or DataHub). Lawful basis: {{BASIS}}. Location: {{REGION}}. Erasure is deletion: one erasure routine knows every store; it publishes a PersonErased event that each owning service handles by deleting the person\'s rows (ON DELETE CASCADE where the schema allows), replacing them with a tombstone where invoices must stay. Logs carry user ids rather than names or addresses and are kept no longer than {{ERASE_DAYS}} days in the log store (Loki or OpenSearch retention). Backups expire after {{BACKUP_DAYS}} days and a restore replays the erasure ledger before serving. Unused data is erased after {{RETENTION_MONTHS}} months by a daily job. Choose deletion over crypto-shredding when the copies are few and known and backups are short-lived.',
      consequences: '• Erasure is simple to understand and to prove: the rows are gone.\n• Every new store, cache or export must join the erasure routine, or it leaks the people erased.\n• Erased people live on in backups for up to {{BACKUP_DAYS}} days; the erasure ledger is what keeps them from coming back on a restore.\n• Records the business needs later (revenue per month) must be aggregated before the deletion.',
      alternatives: '1. Anonymisation in place: keeps the history for statistics, but anonymisation must hold against re-identification.\n2. Crypto-shredding: reaches backups and streams at once, at the cost of a key per person and a key service on every read.\n3. Handling requests by hand: slow, error-prone and hard to prove.',
    },
    {
      id: 'adr-anonymise', label: 'Personal data erased by anonymisation', when: { PERSONAL: ['yes'], ERASURE: ['anonymise'] },
      decision: 'Personal data is kept only in the stores and fields the record of processing names, each field classified in the schema (a column comment or a data-catalogue tag in OpenMetadata or DataHub). Lawful basis: {{BASIS}}. Location: {{REGION}}. Erasure is anonymisation in place: direct identifiers (name, e-mail, phone, address, IP, external ids) are overwritten with random values and no mapping is kept; quasi-identifiers are generalised (birth date to year, postcode to its first two characters) until every combination occurs at least 5 times, which a dbt test checks; free-text fields are cleared. Logs carry user ids only and are kept no longer than {{ERASE_DAYS}} days. Backups expire after {{BACKUP_DAYS}} days and a restore replays the erasure ledger before serving. Unused data is anonymised after {{RETENTION_MONTHS}} months by a daily job. Use ARX or sdcMicro to measure re-identification risk when the quasi-identifiers change. Choose anonymisation when orders, revenue or usage history must outlive the person.',
      consequences: '• History stays usable for reporting and accounting without anyone in it.\n• Anonymisation that can be undone is pseudonymisation and still personal data: the k-anonymity check and the removal of free text are not optional.\n• Each new column must be classified as identifier, quasi-identifier or neither, or anonymisation misses it.\n• Backups still hold the original records until they expire after {{BACKUP_DAYS}} days.',
      alternatives: '1. Deletion in every store: simplest to prove, loses the history.\n2. Crypto-shredding: reaches backups at once, but the records become unreadable rather than anonymous.\n3. Pseudonymisation with a kept key: reversible, so it erases nothing (GDPR Art. 4(5)).',
    },
    {
      id: 'adr-crypto', label: 'Personal data erased by crypto-shredding', when: { PERSONAL: ['yes'], ERASURE: ['crypto'] },
      decision: 'Personal data is kept only in the stores and fields the record of processing names, each field classified in the schema. Lawful basis: {{BASIS}}. Location: {{REGION}}. Every personal field is encrypted in the application with a data key of its own per person (envelope encryption, AES-256-GCM), the data keys wrapped by a key in a key management service: AWS KMS, Google Cloud KMS or Azure Key Vault on that cloud, HashiCorp Vault (Transit) on premises or across clouds; libraries such as AWS Encryption SDK or Google Tink do the envelope work. Erasure destroys the person\'s data key within 24 hours, which makes their fields in every store, event, log and backup unreadable; key backups expire after {{BACKUP_DAYS}} days. Unused data is shredded the same way after {{RETENTION_MONTHS}} months. Searchable fields (e-mail for sign-in) are kept as keyed hashes (HMAC) next to the ciphertext.',
      consequences: '• One key deletion erases a person everywhere, immutable backups and event streams included.\n• Every read of a personal field decrypts: a key cache and the key service\'s availability are on the hot path.\n• Searching, sorting and joining on encrypted fields is not possible; keyed hashes cover exact matches only.\n• A lost key store loses everyone\'s data: the key service needs its own backup and recovery, shorter-lived than {{BACKUP_DAYS}} days for destroyed keys.',
      alternatives: '1. Deletion in every store: no key service, but backups and streams keep the person until they expire.\n2. Anonymisation in place: keeps readable history, but must hold against re-identification.\n3. One key per store (transparent disk encryption): protects against stolen disks, erases no one.',
    },
    {
      id: 'adr-special', label: 'Special categories encrypted and logged', when: { PERSONAL: ['yes'], SPECIAL: ['yes'] },
      context: `${FORCES} Here the store keeps special-category data (GDPR Art. 9), whose leak harms most and whose processing is forbidden unless an exception applies.`,
      decision: 'Special-category fields are kept in their own tables or documents, encrypted at field level (pgcrypto or application-side envelope encryption with keys in the key management service) with keys only the services named in the record of processing may use. Each person\'s Art. 9(2) condition, usually explicit consent, is recorded with its date. Every read of these fields is logged with reader, time and purpose (pgAudit for direct database access, the service\'s own audit log otherwise) and the log is kept 12 months. A data protection impact assessment is approved before any new purpose, store or recipient, and the change that brings one links it.',
      consequences: '• A leak of the main tables or a backup does not expose the special categories.\n• Analytics on these fields needs its own approved purpose and key, which slows ad-hoc analysis on purpose.\n• Read logs grow with use and are themselves personal data with a 12-month retention.\n• The DPIA becomes a release gate for changes that touch these fields.',
      alternatives: '1. Treat them like other personal data: simpler, but falls short of Art. 9 and Art. 32 for the data whose leak harms most.\n2. A separate system for special categories only: the strongest separation, but a second system to run and integrate.',
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
      id: 'ff-retention', label: 'Retention and erasure on time', when: PERSONAL, category: 'operational', implements: ['adr-delete', 'adr-anonymise', 'adr-crypto'],
      threshold: '0 personal records unused for more than {{RETENTION_MONTHS}} months, and 0 erasure requests open for more than {{ERASE_DAYS}} days',
      description: 'A daily data test returns the records past retention and the erasure requests past their deadline; any row fails it and alerts the data owner.',
      tool: 'dbt (a singular data test, run daily by the scheduler)',
      language: 'sql',
      snippet: `-- tests/personal_data_on_time.sql: every row returned is a failure
select 'past retention' as problem, cast(customer_id as text) as id
from {{ ref('customers') }}
where last_used_at < now() - interval '{{RETENTION_MONTHS}} months'
  and erased_at is null
  and legal_hold is not true
union all
select 'erasure overdue', cast(request_id as text)
from {{ ref('erasure_requests') }}
where completed_at is null
  and accepted_at < now() - interval '{{ERASE_DAYS}} days'`,
    },
    {
      id: 'ff-record', label: 'Every field classified', when: PERSONAL, category: 'structural', implements: ['adr-delete', 'adr-anonymise', 'adr-crypto'],
      threshold: '0 columns in the migrated schema without a classification (personal or not-personal) in their comment',
      description: 'In CI, after the migrations run against an empty database, a query lists the columns without a classification; a new column fails the build until it is classified, and a personal one until the record of processing names it.',
      tool: 'psql in the CI pipeline, against the migrated schema',
      language: 'sql',
      snippet: `-- fails the build when it returns a row
select c.table_name, c.column_name
from information_schema.columns c
join pg_class t on t.relname = c.table_name
join pg_namespace n on n.oid = t.relnamespace and n.nspname = c.table_schema
left join pg_description d on d.objoid = t.oid and d.objsubid = c.ordinal_position
where c.table_schema = 'public'
  and coalesce(d.description, '') !~ '^(personal|not-personal)( |:|$)';`,
    },
    {
      id: 'ff-pii-scan', label: 'Personal data where declared', category: 'structural', implements: ['adr-delete', 'adr-anonymise', 'adr-crypto', 'adr-no-personal'],
      threshold: '0 personal data findings with a score of 0.6 or more in a day of logs and a sample of rows outside the fields classified as personal',
      description: 'A nightly job exports a day of logs and a sample of rows from the fields not classified as personal and scans them for e-mail addresses, phone numbers, IP addresses, card numbers, IBANs and names; it reports the place and kind of each finding, never the value.',
      tool: 'Microsoft Presidio (presidio-analyzer)',
      language: 'python',
      snippet: `# scan.py <file>: exits 1 when the file holds personal data
import sys
from presidio_analyzer import AnalyzerEngine

ENTITIES = ["EMAIL_ADDRESS", "PHONE_NUMBER", "IP_ADDRESS", "CREDIT_CARD", "IBAN_CODE", "PERSON"]
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
      id: 'ff-erasure', label: 'Erasure reaches every store', when: { PERSONAL: ['yes'], ERASURE: ['delete', 'anonymise'] }, category: 'structural', implements: ['adr-delete', 'adr-anonymise'],
      threshold: '0 occurrences of an erased person\'s identifiers in any store after the erasure routine, and 0 after a restore of an older backup',
      description: 'An integration test seeds one person with a unique e-mail across every store the record of processing names, runs the erasure routine, and searches each store for the e-mail and the person\'s id; it then restores a backup taken before the erasure and searches again after the ledger replay.',
      tool: 'Vitest with Testcontainers (PostgreSQL and the other stores of the deployment)',
      language: 'ts',
      snippet: `it('erases a person from every store, and keeps them erased after a restore', async () => {
  const email = \`erase-\${crypto.randomUUID()}@example.test\`
  const person = await seedEverywhere({ email })          // account, orders, tickets, search index
  const backup = await takeBackup()
  await erasure.run(person.id)
  for (const store of stores) expect(await store.find(email, person.id)).toEqual([])
  await restore(backup)                                     // replays the erasure ledger before serving
  for (const store of stores) expect(await store.find(email, person.id)).toEqual([])
})`,
    },
    {
      id: 'ff-k-anonymity', label: 'Anonymised records not singled out', when: { PERSONAL: ['yes'], ERASURE: ['anonymise'] }, category: 'operational', implements: ['adr-anonymise'],
      threshold: 'Every combination of quasi-identifiers among anonymised records occurs in at least 5 records (k ≥ 5)',
      description: 'A daily data test groups the anonymised records by their quasi-identifiers and returns every group smaller than 5.',
      tool: 'dbt (a singular data test)',
      language: 'sql',
      snippet: `-- tests/anonymised_k5.sql: every row returned is a group that singles people out
select birth_year, postcode_prefix, gender, count(*) as k
from {{ ref('customers') }}
where anonymised_at is not null
group by birth_year, postcode_prefix, gender
having count(*) < 5`,
    },
    {
      id: 'ff-shred', label: 'Shredded data unreadable', when: { PERSONAL: ['yes'], ERASURE: ['crypto'] }, category: 'structural', implements: ['adr-crypto'],
      threshold: 'After an erasure, 0 of the person\'s encrypted fields decrypt in the store, the event stream or a backup, and their key is scheduled for deletion within 24 hours',
      description: 'An integration test against a local KMS writes a person\'s fields, copies the ciphertext as a backup would, erases the person and expects the key to be pending deletion and every decryption to fail.',
      tool: 'Vitest with LocalStack (AWS KMS) or a Vault dev server',
      language: 'ts',
      snippet: `it('makes every copy of an erased person unreadable', async () => {
  const person = await createPerson({ email: 'shred@example.test' })
  const copies = [await store.rawFields(person.id), await events.rawFields(person.id)]  // ciphertext, as backups hold it
  await erasure.run(person.id)
  const key = await kms.send(new DescribeKeyCommand({ KeyId: person.keyId }))
  expect(key.KeyMetadata?.KeyState).toBe('PendingDeletion')
  for (const fields of copies) await expect(decryptFields(fields)).rejects.toThrow()
})`,
    },
    {
      id: 'ff-region', label: 'Deployed in EU regions', when: { PERSONAL: ['yes'], REGION: ['eu'] }, category: 'structural', implements: ['adr-delete', 'adr-anonymise', 'adr-crypto'],
      threshold: '0 providers, backup copies or processors outside EU/EEA regions in the infrastructure plan and the processor register',
      description: 'In CI the Terraform plan (terraform show -json) is checked by a policy that fails on any provider or backup copy destination outside the allowed EU regions; the same run checks processors.yaml, the processor register.',
      tool: 'Open Policy Agent (conftest)',
      language: 'rego',
      snippet: `package main
import rego.v1

eu_regions := {"eu-central-1", "eu-central-2", "eu-west-1", "eu-west-3", "eu-north-1", "eu-south-1", "eu-south-2"}

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
  not regex.match("arn:aws:backup:eu-", copy.destination_vault_arn)
  msg := sprintf("backup plan %s copies outside the EU", [r.address])
}`,
    },
    {
      id: 'ff-adequacy', label: 'Processors in adequate countries', when: { PERSONAL: ['yes'], REGION: ['adequate'] }, category: 'process', implements: ['adr-delete', 'adr-anonymise', 'adr-crypto'],
      threshold: '0 processors in the register outside the EU/EEA and the countries with an adequacy decision',
      description: 'In CI a policy checks processors.yaml, the processor register kept in the repository, against the EU/EEA and the adequacy list; the list is updated when the Commission adopts or withdraws a decision.',
      tool: 'Open Policy Agent (conftest)',
      language: 'rego',
      snippet: `package main
import rego.v1

eea := {"AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO"}
# Adequacy decisions (GDPR Art. 45); US only for companies certified under the Data Privacy Framework
adequate := {"AD","AR","CA","FO","GG","IL","IM","JP","JE","NZ","KR","CH","GB","UY","US"}

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
      id: 'ff-scc', label: 'Transfers have clauses and assessment', when: { PERSONAL: ['yes'], REGION: ['any'] }, category: 'process', implements: ['adr-delete', 'adr-anonymise', 'adr-crypto'],
      threshold: '0 processors outside the EU/EEA without signed standard contractual clauses and a transfer impact assessment reviewed in the last 12 months',
      description: 'In CI a policy checks processors.yaml, the processor register: every processor outside the EU/EEA needs the date its clauses were signed and the date of its transfer impact assessment, not older than 12 months.',
      tool: 'Open Policy Agent (conftest)',
      language: 'rego',
      snippet: `package main
import rego.v1

eea := {"AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO"}
year_ns := 365 * 24 * 60 * 60 * 1000000000

deny contains msg if {
  some p in input.processors
  not p.country in eea
  not p.scc_signed
  msg := sprintf("processor %s in %s has no standard contractual clauses", [p.name, p.country])
}

deny contains msg if {
  some p in input.processors
  not p.country in eea
  time.now_ns() - time.parse_rfc3339_ns(sprintf("%sT00:00:00Z", [p.tia_reviewed])) > year_ns
  msg := sprintf("processor %s: transfer impact assessment older than 12 months", [p.name])
}`,
    },
    {
      id: 'ff-special', label: 'Special fields encrypted', when: { PERSONAL: ['yes'], SPECIAL: ['yes'] }, category: 'structural', implements: ['adr-special'],
      threshold: 'Every column classified as special category is stored as ciphertext (bytea), and 0 roles outside the record of processing may read it',
      description: 'A database test run in CI after the migrations asserts that each special-category column holds ciphertext and that only the listed roles have SELECT on its table, and that pgAudit logs reads of it.',
      tool: 'pgTAP (run with pg_prove)',
      language: 'sql',
      snippet: `BEGIN;
SELECT plan(4);
SELECT col_type_is('health', 'conditions', 'diagnosis', 'bytea', 'diagnosis is stored encrypted');
SELECT table_privs_are('health', 'conditions', 'care_service', ARRAY['SELECT', 'INSERT', 'UPDATE']);
SELECT table_privs_are('health', 'conditions', 'reporting', ARRAY[]::text[], 'reporting cannot read diagnoses');
SELECT ok(current_setting('pgaudit.log') ~ 'read', 'pgAudit logs reads');
SELECT * FROM finish();
ROLLBACK;`,
    },
  ],
}

export default pack
