import type { PackSpec, When } from '../../src/packSpec'

const MAIN = ['adr-file', 'adr-tool', 'adr-store']
const JOB: When = { SCHEDULE: ['file', 'tool'] }
const HELD: When = { HOLD: ['flag'] }
const FORCES = 'This store keeps business records: invoices, contracts, payments, accounting entries. The forces: tax, commercial and sector law and contracts require some of them to be kept for years, counted from an event (the end of the fiscal year, the end of a contract), and a record deleted early cannot be produced for a tax audit or a court; data protection law requires data about people to go once it is no longer needed (GDPR Art. 5(1)(e)), so keeping everything forever is not safe either; a lawsuit, an investigation or an audit can require records to be preserved past their period, and a job that deletes on schedule knows nothing of it unless it is told; a person may ask to be erased while the law still requires their invoices; and records spread into replicas, caches, search indexes, exports and backups that a delete in the primary store does not reach. Personal data that is not a business record, and erasure on request, are decided in the Personal data pack; how long backups are kept, in the Backup and recovery pack; how long audit records are kept, in the Audit trail pack.'

const pack: PackSpec = {
  id: 'concern-retention',
  name: 'Retention and deletion',
  group: 'compliance',
  description: 'How long each kind of business record is kept and on what legal basis, how a legal hold stops its deletion, what happens when a person asks to erase a record the law still requires, and how records go when their period ends.',
  tags: ['compliance', 'retention', 'records-management', 'legal-hold', 'deletion', 'gdpr'],
  concern: {
    id: 'retention',
    trigger: 'LIST NODES WHERE type = "database" AND external != true',
    why: 'these stores keep business records, so how long each kind is kept, what stops its deletion and how it goes at the end has to be decided.',
  },
  sources: [
    { title: 'Regulation (EU) 2016/679 (GDPR), Articles 4(5), 5, 17(3) and 18, and Recital 26 (text quoted at gdpr-info.eu)', url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj' },
    { title: 'German Federal Data Protection Act (BDSG), Section 35: restriction in place of erasure (official English translation)', url: 'https://www.gesetze-im-internet.de/englisch_bdsg/englisch_bdsg.html' },
    { title: 'ISO 15489-1:2016, Records management: Concepts and principles', url: 'https://www.iso.org/standard/62542.html' },
    { title: 'NIST SP 800-88 Rev. 2, Guidelines for Media Sanitization (cryptographic erase)', url: 'https://csrc.nist.gov/pubs/sp/800/88/r2/final' },
    { title: 'Amazon S3 User Guide: Expiring objects (S3 Lifecycle)', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html' },
    { title: 'Amazon S3 User Guide: Locking objects with Object Lock (legal holds)', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html' },
    { title: 'AWS KMS API Reference: ScheduleKeyDeletion', url: 'https://docs.aws.amazon.com/kms/latest/APIReference/API_ScheduleKeyDeletion.html' },
    { title: 'pg_partman documentation: retention in part_config', url: 'https://github.com/pgpartman/pg_partman/blob/development/doc/pg_partman.md' },
    { title: 'Microsoft Purview Records Management', url: 'https://learn.microsoft.com/en-us/purview/records-management' },
    { title: 'Microsoft Graph v1.0: retentionLabel resource type', url: 'https://learn.microsoft.com/en-us/graph/api/resources/security-retentionlabel?view=graph-rest-1.0' },
    { title: 'OpenText Information Archive', url: 'https://www.opentext.com/products/infoarchive' },
  ],
  questions: [
    {
      key: 'SCHEDULE', title: 'Schedule', label: 'Where does the retention schedule live?',
      hint: 'The schedule says, for each kind of record, where it is kept, on what legal basis, for how long and from which event the period counts. Where it lives decides who changes it, how the deletion reads it and what an auditor is shown (ISO 15489-1: records controls and disposition).',
      default: 'file',
      options: [
        { value: 'file', label: 'a schedule file in the repository', description: 'retention/schedule.json holds one row per table: record category, legal basis, period, the event it counts from, owner and date of the last legal review; a daily deletion job reads it, and changes go through a pull request the records owner approves. Pick it when the system owns its records and the organisation runs no records-management tool; most product teams can run it.' },
        { value: 'tool', label: 'a records-management tool', description: 'The categories, periods and triggers live in the organisation\'s records-management tool, such as Microsoft Purview Records Management (retention labels in a file plan) or OpenText Information Archive; the repository maps each table to a category and a daily deletion job applies its period. Pick it when the organisation already runs such a tool and a records manager owns the schedule for all its systems.' },
        { value: 'store', label: 'each store\'s own lifecycle configuration', description: 'No schedule outside the stores: each period is set where the data lives, as pg_partman retention on time-partitioned tables, S3 lifecycle rules, DynamoDB or MongoDB TTL. Pick it only when every kind of record is kept a fixed time from a date it carries, sits in tables or buckets of its own, and a hold may cover a whole table or a single object.' },
      ],
    },
    {
      key: 'DELETE', title: 'Disposal', label: 'How do records go when their period ends?',
      hint: 'A delete in the primary store does not reach backups, archives or event streams that cannot be edited; this decides what is left in them and for how long. Only with a schedule file or a records-management tool: with each store\'s own lifecycle configuration, the store deletes. Erasing a person\'s data on request is decided in the Personal data pack.',
      default: 'hard',
      options: [
        { value: 'hard', label: 'deletion by a scheduled job', description: 'A daily job deletes the expired rows in batches, with their dependent rows, search entries and cached copies; backups age out as the Backup and recovery pack keeps them. Pick it by default, when backups are kept for weeks rather than years.' },
        { value: 'crypto', label: 'crypto-shredding of a key per record group', description: 'Each record group (one category and fiscal year) is encrypted under a key of its own; at the end of the period the job deletes the rows and destroys the key, which makes every copy unreadable, backups and archives included. Pick it when copies are kept for years or cannot be edited (locked backups, event logs, archives) and you run a key management service.' },
        { value: 'aggregate', label: 'anonymised totals, then deletion', description: 'Before the rows are deleted, the job rolls them up into totals per month and category with no identifier and no group of fewer than 5 records. Pick it when finance or analytics need the history (revenue per month, volumes) after the records themselves must go.' },
      ],
    },
    {
      key: 'HOLD', title: 'Legal hold', label: 'Can disposal be stopped for a lawsuit, an investigation or an audit?',
      hint: 'When a dispute or an investigation is expected, the records that may matter have to be preserved, even past their period; a deletion that does not know about it destroys evidence. With each store\'s own lifecycle configuration, a hold covers a single object version (S3 Object Lock) or a whole table, never one row.',
      default: 'flag',
      options: [
        { value: 'flag', label: 'a legal hold set by named roles', description: 'A hold names a matter and covers records, a record group or a category; disposal skips everything it covers until it is lifted, and only named roles may set or lift one. Pick it for any system whose records could matter in a dispute or an audit, which is most that keep invoices or contracts.' },
        { value: 'none', label: 'no legal hold', description: 'Disposal is never suspended for a single matter; a preservation request stops disposal of whole categories by a reviewed change. Pick it only when the records have no evidential value, or the organisation preserves evidence elsewhere (an eDiscovery export) and accepts that risk; the decision records it.' },
      ],
    },
    {
      key: 'CONFLICT', title: 'Erasure vs. keeping', label: 'What happens when a person asks to be erased but the law still requires their records?',
      hint: 'Erasure does not apply to what a legal obligation requires keeping (GDPR Art. 17(3)(b)), but what is kept may then serve that obligation only (Art. 5(1)(b)). Erasing everything else is the Personal data pack\'s; this decides what the kept records look like until their period ends.',
      default: 'restrict',
      options: [
        { value: 'restrict', label: 'restriction until the period ends', description: 'The kept records stay as they are, marked restricted: only the compliance role can read them, and only to meet the obligation (a tax audit, a court order); at the end of the period they go with the rest. Pick it by default, and whenever the law requires the record kept as issued, as tax rules usually do for an invoice.' },
        { value: 'pseudonymise', label: 'pseudonymisation of the kept records', description: 'The person\'s name, address and contact details in the kept records are replaced with a pseudonym now; the link back is kept apart, readable only by the compliance role, and destroyed with the records. Pick it when the kept facts (amounts, dates) are still used in daily work such as reporting, and the compliance officer confirms that the law does not require the record kept as issued.' },
      ],
    },
  ],
  details: [
    { key: 'DISPOSE_DAYS', label: 'Within how many days after its period ends is a record disposed of?', default: '30', number: true },
    { key: 'REVIEW_MONTHS', label: 'How often does the compliance officer review the periods (months)? (schedule file or records-management tool only)', default: '12', number: true },
    { key: 'HOLD_ROLES', label: 'Who may set and lift a legal hold? (a legal hold set by named roles only)', default: 'legal counsel, compliance officer' },
    { key: 'ACCOUNTING_YEARS', label: 'Invoices and accounting records: kept how many years after the end of the fiscal year they belong to? (an example; set it from your legal reading)', default: '10', number: true },
    { key: 'CONTRACT_YEARS', label: 'Contracts: kept how many years after the contract ends? (an example; set it from your legal reading)', default: '6', number: true },
    { key: 'TRANSACTION_YEARS', label: 'Payment transactions: kept how many years after the transaction date? (an example; set it from your legal reading)', default: '5', number: true },
  ],
  need: {
    label: 'Records kept as long as required, and no longer',
    text: 'The system keeps business records that law or contract requires for a set period, and must keep each one exactly that long: not deleted before its period ends or while a legal hold covers it, and disposed of in every copy once the period is over, including when the person it concerns asked to be erased in the meantime. Which law applies and which period follows from it is the organisation\'s legal reading, made by its compliance officer or data protection officer; the periods in this pack are examples to set, and nothing in it is legal advice. The snippets assume PostgreSQL with the schema owned by the migrator role and disposal run as the retention_job role, the deletion job in src/retention (job.ts exports runDisposal, holds.ts the legal holds) with its tests under tests/retention, the schedule and its companions under retention/ (schedule.json, labels.json, holds.json, transient-tables.txt listing the tables that hold no records), and the buckets that hold records named in RECORD_BUCKETS by the infrastructure code.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-schedule', label: 'Every table has a schedule row', when: { SCHEDULE: ['file'] }, ears_type: 'ubiquitous',
      action: 'keep one row in retention/schedule.json for every table, naming its record category, legal basis, period in years, the event the period counts from, its owner and the date of its last legal review, no older than {{REVIEW_MONTHS}} months, or category "none" with the reason it holds no records; and change the file only through a pull request the records owner approves',
      rationale: 'A record without a written period is kept forever or deleted by guesswork; storage limitation (GDPR Art. 5(1)(e)) and disposition by an authorised rule (ISO 15489-1) both need the period where the deletion job reads it, and accountability (Art. 5(2)) needs to show who set it and when.',
      scenario: { label: 'New table needs a row', given: 'a migration that adds a table', when: 'the change is built', then: 'the build fails until retention/schedule.json has a complete row for the table, reviewed within {{REVIEW_MONTHS}} months' },
    },
    {
      id: 'req-tool-mapping', label: 'Every table maps to a label', when: { SCHEDULE: ['tool'] }, ears_type: 'ubiquitous',
      action: 'map every table in retention/schedule.json to a retention label of the records-management tool and to the date column its period counts from, or to category "none" with the reason it holds no records, and keep the tool\'s labels exported to retention/labels.json no more than {{REVIEW_MONTHS}} months ago',
      rationale: 'The tool owns the periods but not the tables; a table that maps to no label, or to one the tool no longer has, is kept forever or disposed of by guesswork (ISO 15489-1; GDPR Art. 5(1)(e)).',
      scenario: { label: 'Unmapped table refused', given: 'a migration that adds a table, and a row whose label is no longer in the export', when: 'the change is built', then: 'the build fails naming both tables' },
    },
    {
      id: 'req-store-config', label: 'Every table and bucket has its period', when: { SCHEDULE: ['store'] }, ears_type: 'ubiquitous',
      action: 'set the period of every table and bucket that holds records in the store\'s own configuration (pg_partman retention with expired partitions dropped, an S3 lifecycle expiration rule), and hold no row longer than its period plus one partition interval and {{DISPOSE_DAYS}} days',
      rationale: 'With no schedule outside the stores, the configuration is the schedule: a table without it keeps everything forever (GDPR Art. 5(1)(e)). pg_partman keeps every partition while retention is NULL and by default only detaches expired ones (pg_partman documentation).',
      scenario: { label: 'Table without a period refused', given: 'a migration that adds a records table without pg_partman retention', when: 'the configuration check runs', then: 'it fails until the table has a retention, drops expired partitions and holds no row past its period plus one partition and {{DISPOSE_DAYS}} days' },
    },
    {
      id: 'req-dispose', label: 'Expired records disposed of', ears_type: 'event-driven',
      trigger: 'the retention period of a record ends, counted from the event its schedule names (the end of the fiscal year it belongs to, the end of a contract, the date of a transaction)',
      action: 'dispose of it within {{DISPOSE_DAYS}} days in the primary store, its replicas, caches and search indexes, and in the exports the system keeps, unless a legal hold covers it',
      rationale: 'Storage limitation (GDPR Art. 5(1)(e)) for records about people, and disposition as a records process of its own (ISO 15489-1). Backups are not edited: they age out as the Backup and recovery pack keeps them.',
      scenario: { label: 'Expired invoice disposed of', given: 'an invoice whose period ended and one whose period has not', when: 'disposal runs', then: 'within {{DISPOSE_DAYS}} days the first is gone from the store, its replicas, caches and search index, and the second is untouched' },
    },
    {
      id: 'req-not-early', label: 'Nothing deleted early', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an application, script or person other than disposal tries to delete or truncate records before their period ends',
      action: 'refuse it, because no login role but the one that runs disposal and the one that owns the schema may delete from or truncate a table that holds records',
      rationale: 'A record deleted early cannot be produced when the obligation that required it is invoked; a missing privilege stops what a code review misses.',
      scenario: { label: 'Early delete refused', given: 'the application\'s database role', when: 'it deletes a row from the invoices table', then: 'the database refuses it with a permission error' },
    },
    {
      id: 'req-fail-closed', label: 'Unknown means keep', when: JOB, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the schedule cannot be read, or a table that holds rows has no row in it',
      action: 'dispose of nothing from that table, or from any table when the schedule cannot be read, and alert the records owner the same day',
      rationale: 'A deletion job that guesses a default period destroys records that may still be required; doing nothing and saying so costs only a few days of storage.',
      scenario: { label: 'Unknown table left alone', given: 'a table without a schedule row holding 50-year-old rows, and an expired invoice', when: 'disposal runs, and runs again with the schedule missing', then: 'no row of the unknown table is deleted, the second run deletes nothing at all, and the records owner is alerted' },
    },
    {
      id: 'req-overdue', label: 'Overdue records reported', when: JOB, ears_type: 'ubiquitous',
      action: 'report every week, per table, the records whose period ended more than {{DISPOSE_DAYS}} days ago and that no legal hold covers, and open a ticket for the records owner when any table has one',
      rationale: 'A deletion job that silently stopped looks like one that works; the report is the evidence that disposal happens, which accountability asks for (GDPR Art. 5(2)).',
      scenario: { label: 'Stalled disposal noticed', given: 'a deletion job that has failed for two weeks', when: 'the weekly report runs', then: 'it lists the tables with overdue records and opens a ticket for the records owner' },
    },
    {
      id: 'req-hold', label: 'Held records kept', when: { ...HELD, ...JOB }, ears_type: 'state-driven',
      precondition: 'a legal hold covers a record, its record group or its category',
      action: 'keep the record unchanged past the end of its period, skip it in every disposal run, and dispose of it in the first run after the last hold on it is lifted if its period has ended',
      rationale: 'Records that may matter in an expected dispute or investigation must not be destroyed while it lasts; as with an S3 Object Lock legal hold, the hold is independent of the retention period and has no end date until it is lifted (Amazon S3 Object Lock).',
      scenario: { label: 'Held invoice survives', given: 'two expired invoices, one under a legal hold', when: 'disposal runs, the hold is lifted, and disposal runs again', then: 'the first run disposes only of the invoice without a hold; the second disposes of the other' },
    },
    {
      id: 'req-hold-roles', label: 'Holds only by named roles', when: HELD, ears_type: 'event-driven',
      trigger: 'someone sets or lifts a legal hold',
      action: 'accept it only from {{HOLD_ROLES}}, with a matter reference and the records, groups, categories, tables or objects it covers, and record who did it and when in the audit trail',
      rationale: 'A hold anyone can lift is not a hold, and one anyone can set stops disposal without a reason; S3 likewise lets only principals with s3:PutObjectLegalHold place or remove one (Amazon S3 Object Lock).',
      scenario: { label: 'Hold by the right people', given: 'a support engineer and someone in one of: {{HOLD_ROLES}}', when: 'each tries to set a hold and then to lift it', then: 'only the second succeeds, and the audit trail holds the matter, the scope, who and when' },
    },
    {
      id: 'req-hold-store', label: 'Stores stop for a hold', when: { ...HELD, SCHEDULE: ['store'] }, ears_type: 'ubiquitous',
      action: 'hold an object by an S3 Object Lock legal hold on its version, and a table by setting its pg_partman retention to none and listing it with its matter in retention/holds.json',
      rationale: 'With the periods in the stores, the stores themselves have to stop: S3 Lifecycle takes no action on noncurrent versions under Object Lock and refuses a permanent delete of a held version (Amazon S3 documentation); pg_partman drops nothing while retention is NULL (pg_partman documentation).',
      scenario: { label: 'Held object survives', given: 'an object version under a legal hold in a bucket with an expiration rule', when: 'someone deletes that version by its version id', then: 'the delete is refused with 403 Access Denied and the version remains' },
    },
    {
      id: 'req-conflict-restrict', label: 'Kept records restricted', when: { CONFLICT: ['restrict'] }, ears_type: 'event-driven',
      trigger: 'a person\'s erasure request is accepted and covers records the schedule still requires',
      action: 'keep those records unchanged but restricted, readable only by the compliance role and only to meet the obligation, tell the person which categories are kept, on what legal basis and until when, and dispose of them with the rest when their period ends',
      rationale: 'The right to erasure does not apply to what a legal obligation requires (GDPR Art. 17(3)(b)), and what is kept may not be used for other purposes (Art. 5(1)(b)). Some national laws put restriction of processing (Art. 18) in place of erasure here: Germany\'s BDSG Section 35(3) does so where erasure would conflict with retention periods set by statute or contract.',
      scenario: { label: 'Invoice kept, but locked away', given: 'a customer with an invoice still in its period, orders and a support ticket', when: 'their erasure request is accepted', then: 'support and reporting no longer reach the invoice, the compliance role still can, and the answer to the person names invoices, their legal basis and the date they go' },
    },
    {
      id: 'req-conflict-pseudo', label: 'Kept records pseudonymised', when: { CONFLICT: ['pseudonymise'] }, ears_type: 'event-driven',
      trigger: 'a person\'s erasure request is accepted and covers records the schedule still requires',
      action: 'replace the person\'s name, address and contact details in those records with a pseudonym when the rest of their data is erased, keep the link from pseudonym to person in a separate table only the compliance role can read, tell the person which categories are kept, on what legal basis and until when, and destroy the link and the records together when the period ends',
      rationale: 'The right to erasure does not apply to what a legal obligation requires (GDPR Art. 17(3)(b)); pseudonymised data stays personal data while the additional information exists (Art. 4(5), Recital 26), so the link is kept apart, guarded and destroyed with the records.',
      scenario: { label: 'Kept invoice names nobody', given: 'a customer with an invoice still in its period, orders and a support ticket', when: 'their erasure request is accepted', then: 'the kept invoice rows carry a pseudonym instead of name, address and contact details, only the compliance role can resolve it, and the answer to the person names invoices, their legal basis and the date they go' },
    },
    {
      id: 'req-shred', label: 'Group key destroyed', when: { ...JOB, DELETE: ['crypto'] }, ears_type: 'event-driven',
      trigger: 'the period of a record group (one category and fiscal year) ends and no legal hold covers any record of it',
      action: 'delete the group\'s rows and schedule its key for deletion within {{DISPOSE_DAYS}} days, with the shortest waiting period the key service allows, so that no copy of the group in a backup, archive or event stream can be decrypted after it',
      rationale: 'Data whose key is destroyed cannot be read by anyone, and the method reaches copies the job cannot edit; NIST SP 800-88 Rev. 2 treats cryptographic erase as a sanitisation method. AWS KMS keeps a key 7 to 30 days after its deletion is scheduled (AWS KMS ScheduleKeyDeletion).',
      scenario: { label: 'Group key destroyed', given: 'the invoices of a fiscal year whose period ended, in the store and in last month\'s backup', when: 'disposal runs', then: 'the rows are gone, the group\'s key is pending deletion, and once it is deleted the backup copy cannot be decrypted' },
    },
    {
      id: 'req-aggregate', label: 'History kept as safe totals', when: { ...JOB, DELETE: ['aggregate'] }, ears_type: 'event-driven',
      trigger: 'records reach the end of their period',
      action: 'roll them up into totals per month and category that carry no identifier of a person, customer or record, merge groups of fewer than 5 records into the month\'s "other" row and leave out an "other" row still below 5, then delete the records',
      rationale: 'Totals that cannot be linked to a person are anonymous and outside data protection law (GDPR Recital 26), and keep the history finance needs; a group of a handful of records can single out one customer.',
      scenario: { label: 'History kept, records gone', given: 'a month of expired invoices in which one customer has the only 2 invoices of a category', when: 'disposal runs', then: 'the month\'s totals exist with no group below 5, those 2 invoices are counted in "other" or left out, and no invoice row of that month remains' },
    },
  ],
  adrs: [
    {
      id: 'adr-file', label: 'A retention schedule file in the repository', when: { SCHEDULE: ['file'] },
      decision: 'The retention schedule is a file in the repository, retention/schedule.json: one row per table with the record category, the legal basis, the period in years, the event it counts from (the end of the fiscal year of a date column, or the date itself), the owner and the date of the last legal review; tables that hold no records (sessions, carts, outboxes) have a row with category "none" and the reason. The compliance officer reviews every row at least every {{REVIEW_MONTHS}} months, and CODEOWNERS makes the records owner approve every change. The first rows are examples the compliance officer confirms or changes: invoices and accounting records {{ACCOUNTING_YEARS}} years after the end of the fiscal year they belong to, contracts {{CONTRACT_YEARS}} years after the contract ends, payment transactions {{TRANSACTION_YEARS}} years after the transaction date. A daily job in src/retention, running as the retention_job role, the only login role besides the schema owner that may delete from record tables, reads the file, disposes of expired records within {{DISPOSE_DAYS}} days by {{DELETE}}, deletes nothing from a table without a row, and writes the schedule it applied to the retention_schedule table for the weekly report. Buckets that hold records get S3 lifecycle rules derived from the same rows. Legal hold: {{HOLD}}. An erasure request that meets a duty to keep: {{CONFLICT}}.',
      consequences: '• The schedule is reviewed like code: every change has an author, an approver and a date, which is what an auditor asks for.\n• The periods are the organisation\'s legal reading written down; when the law changes someone has to change the file, and the review date shows when that last happened.\n• Only this system\'s records are covered; an organisation with many systems ends up with one schedule per repository unless a records manager consolidates them.\n• Backups hold expired records until they age out as the Backup and recovery pack keeps them, and a restore brings them back until the next run; the restore runbook runs the job before the store serves.\n• S3 lifecycle rules count days from an object\'s creation, so a period from the end of the fiscal year is either a dated rule per year prefix (invoices/2026/) or the period plus one year.',
      alternatives: '1. A records-management tool: one schedule for the whole organisation, owned by a records manager, but one more system to keep in step.\n2. Periods only in each store\'s lifecycle configuration: nothing to run, but no legal basis or trigger beside the period and no per-record holds.\n3. A constant per table in the code: no review trail, and invisible to the compliance officer.',
    },
    {
      id: 'adr-tool', label: 'The retention schedule in a records-management tool', when: { SCHEDULE: ['tool'] },
      decision: 'The retention schedule lives in the organisation\'s records-management tool: Microsoft Purview Records Management, where each category is a retention label in the file plan with its period and its trigger (date created or an event), or OpenText Information Archive where records are archived out of the application. The repository holds only the mapping, retention/schedule.json: one row per table with the tool\'s label and the date column the period counts from, or category "none" with the reason. Purview\'s Graph API for retention labels (GET /security/labels/retentionLabels) accepts delegated permissions only, so the records manager exports the labels to retention/labels.json after every change and at least every {{REVIEW_MONTHS}} months, in a pull request the build checks against the mapping; the job never calls the tool at run time. The first labels are examples the compliance officer confirms or changes: invoices and accounting records {{ACCOUNTING_YEARS}} years after the end of the fiscal year, contracts {{CONTRACT_YEARS}} years after the contract ends, payment transactions {{TRANSACTION_YEARS}} years after the transaction date. A daily job in src/retention, running as the retention_job role, applies each label\'s period, disposes of expired records within {{DISPOSE_DAYS}} days by {{DELETE}}, deletes nothing from a table without a label, and writes the schedule it applied to the retention_schedule table for the weekly report. Legal hold: {{HOLD}}. An erasure request that meets a duty to keep: {{CONFLICT}}.',
      consequences: '• One schedule for the whole organisation, owned by the records manager, with the tool\'s own review and disposition records.\n• Purview governs documents and mail in Microsoft 365; it does not reach this system\'s database, so the job still disposes and the tool only supplies the periods.\n• The export is a manual step: a label changed in the tool takes effect here only when the export is committed, and the build fails when it is older than {{REVIEW_MONTHS}} months.\n• Backups hold expired records until they age out as the Backup and recovery pack keeps them; the restore runbook runs the job before the store serves.\n• A licence for the tool and a records manager who owns it.',
      alternatives: '1. A schedule file in the repository: simple and reviewed like code, but one per system and no records manager in the loop.\n2. Calling the tool from the job at run time: always current, but Purview\'s label API grants no application permission, and disposal would stop when the tool is down.\n3. Periods only in each store\'s lifecycle configuration: nothing to integrate, but no basis or trigger recorded.',
    },
    {
      id: 'adr-store', label: 'Periods in each store\'s lifecycle configuration', when: { SCHEDULE: ['store'] },
      decision: 'Periods are set where the data lives and nowhere else. PostgreSQL tables that hold records are partitioned by the date their period counts from with pg_partman, each with retention set to its period and retention_keep_table false, so that expired partitions are dropped, not detached; pg_partman\'s maintenance (run_maintenance_proc) runs hourly from its background worker or pg_cron as the schema owner, the only login role that may drop them, and no application role may delete from or truncate a records table. Buckets get S3 lifecycle rules (Expiration, and NoncurrentVersionExpiration where versioning is on); DynamoDB tables a TTL attribute; MongoDB collections a TTL index. The first periods are examples the compliance officer confirms or changes: invoices and accounting records {{ACCOUNTING_YEARS}} years after the end of the fiscal year, contracts {{CONTRACT_YEARS}} years after the contract ends, payment transactions {{TRANSACTION_YEARS}} years after the transaction date; the fiscal-year and contract triggers become a date column holding the end of the fiscal year or of the contract, which the partitions follow. The legal basis of each period is written beside it in the migration and the infrastructure code. Legal hold: {{HOLD}}. An erasure request that meets a duty to keep: {{CONFLICT}}.',
      consequences: '• Nothing to run and watch besides the stores themselves.\n• Disposal is coarse: a partition goes only when all of its rows have expired, so records stay up to one partition interval past their period, and S3 removes expired objects asynchronously.\n• There is no single place an auditor can read the schedule; the periods are spread over migrations and infrastructure code.\n• A hold covers an object version or a whole table, never one row; a held table keeps every partition.\n• Backups hold expired records until they age out as the Backup and recovery pack keeps them.',
      alternatives: '1. A schedule file read by a deletion job: per-record holds, basis and trigger recorded, at the cost of a job to run and watch.\n2. A records-management tool: one schedule for the organisation, owned by a records manager.\n3. Deleting by hand once a year: forgotten in the first busy year.',
    },
    {
      id: 'adr-hard', label: 'Expired records deleted by a scheduled job', when: { ...JOB, DELETE: ['hard'] },
      decision: 'Expired records are deleted by the daily job in batches of at most 10,000 rows per transaction, children before parents (ON DELETE CASCADE where the schema allows), with their search-index entries and cache keys removed in the same run; the job logs the count per table and category, never the content. Exports the system keeps (reports, files for partners) follow the schedule of their source. Backups are not edited: they age out as the Backup and recovery pack keeps them.',
      consequences: '• Simple, and complete in the primary store, its replicas and the search index.\n• Expired records live on in backups until they age out, and in any copy the job does not know about.\n• Large deletes cause table bloat and replication lag; batches and an off-peak window limit them.',
      alternatives: '1. Crypto-shredding: reaches backups within days, at the cost of a key per group and a key service.\n2. Soft delete (a deleted_at flag): nothing is disposed of; it fails the period.',
    },
    {
      id: 'adr-shred', label: 'Expired records crypto-shredded', when: { ...JOB, DELETE: ['crypto'] },
      decision: 'Each record group, one category and fiscal year, is encrypted in the application with data keys generated under a key of its own in the key service (AWS KMS, Google Cloud KMS or Azure Key Vault on that cloud, HashiCorp Vault Transit elsewhere), through an envelope library (AWS Encryption SDK, Google Tink); in AWS KMS the key is named alias/records/<category>/<fiscal year>. At the end of a group\'s period, if no legal hold covers any of its records, the job deletes the rows, schedules the key for deletion with the shortest waiting period the service allows (7 days in AWS KMS), and logs the group with the key\'s id in disposal_log; from then on every copy of the group (backups, replicas, archives, event streams) is unreadable. Only the job\'s role may schedule key deletion; the key policy denies it to everyone else. Search indexes hold no encrypted field in clear.',
      consequences: '• Disposal reaches copies the job cannot edit, locked backups included, within days of the period\'s end.\n• A key lost early loses a whole year of a category; the key policy is what prevents it.\n• One hold on one record keeps its whole group\'s key.\n• Every read decrypts: some latency, and the key service is on the read path.\n• Encrypted fields cannot be searched or sorted in the database; keyed hashes (HMAC) carry what must be looked up.',
      alternatives: '1. Deletion by a scheduled job: simpler; backups keep the records until they age out.\n2. A key per record: the finest erasure, but one key per row costs more in a key service than the data is worth.',
    },
    {
      id: 'adr-aggregate', label: 'Expired records rolled up, then deleted', when: { ...JOB, DELETE: ['aggregate'] },
      decision: 'Before expired records are deleted, the job rolls them up into tables named <source>_totals (record count and amounts per month, category, region and currency) with no identifier of a person, customer or record; groups of fewer than 5 records are merged into the month\'s "other" row, and an "other" row still below 5 is left out. The records are deleted in the same transaction, with their search entries and cache keys. Periods past the retention are analysed only from the totals.',
      consequences: '• Finance and analytics keep the history (revenue per month, volumes) after the records go.\n• The totals are fixed at disposal: a question nobody thought of then cannot be answered later.\n• Small groups are blurred into "other" or lost.\n• Expired records live on in backups until they age out.',
      alternatives: '1. Deletion by a scheduled job without totals: simpler, and the history goes with the records.\n2. Anonymising rows in place: keeps detail, but the rows of rare customers can still single them out.',
    },
    {
      id: 'adr-hold', label: 'Legal holds set by named roles', when: HELD,
      decision: 'A legal hold is a row in the legal_hold table: the matter reference, its scope (a record, a record group or a category), who set it and when, who lifted it and when. The deletion job skips everything an open hold covers and disposes of it in the first run after the last hold on it is lifted, if its period has ended. Only {{HOLD_ROLES}} may set or lift a hold: the hold API checks the role, no other role may write to legal_hold, and every change goes to the audit trail. In buckets with Object Lock, a held object version also gets an S3 Object Lock legal hold, which neither a lifecycle rule nor a permanent delete can remove. With each store\'s own lifecycle configuration there is no job to skip anything: an object version is held by Object Lock alone, and a table by setting its pg_partman retention to none and listing it with its matter in retention/holds.json; only {{HOLD_ROLES}} hold s3:PutObjectLegalHold.',
      consequences: '• Disposal and preservation are one mechanism, so the job cannot forget a hold.\n• Holds outlive their reason unless someone lifts them; the legal team reviews open holds with each matter\'s status.\n• With crypto-shredding a hold on one record keeps its whole group\'s key, so a hold names records unless the matter needs more.\n• A table held in pg_partman keeps every partition, expired or not, until the hold is lifted.',
      alternatives: '1. No legal hold: simpler, and the first lawsuit stops disposal of whole categories by hand.\n2. Copying held records to a separate preservation store: disposal stays simple, but the copies drift from the originals and are one more store of personal data.',
    },
    {
      id: 'adr-no-hold', label: 'No legal hold', when: { HOLD: ['none'] },
      decision: 'There is no legal hold: disposal is never suspended for a single matter. A preservation request is answered by stopping disposal of the categories concerned (their schedule rows or the stores\' lifecycle rules) by a change the compliance officer approves, until the matter is closed. This holds while the records have no evidential value beyond what is exported to an eDiscovery tool; the first matter that needs records preserved in place supersedes this decision.',
      consequences: '• Nothing to build, and nothing that can keep a record by mistake.\n• A preservation request stops disposal of whole categories, keeping everything in them past its period until the matter is closed.\n• Stopping by hand is slow and easy to forget to undo; while a stop lasts the weekly overdue report and the bucket lifecycle check fail, which is the reminder, and the records owner notes the matter on the ticket.',
      alternatives: '1. A legal hold set by named roles: precise, at the cost of a table, an API and a check in the job.\n2. An export to an eDiscovery tool at the start of each matter: preservation outside the system, but the export must be complete, and the originals still go on schedule.',
    },
    {
      id: 'adr-restrict', label: 'Records kept for an obligation are restricted', when: { CONFLICT: ['restrict'] },
      decision: 'When an accepted erasure request covers records the schedule still requires, those records stay unchanged and are marked restricted (restricted_until, the end of their period, and the request\'s id). PostgreSQL row-level security hides restricted rows from every role but compliance, and the compliance role reads them only for a named obligation (a tax audit, a court order), each read written to the audit trail. The answer to the person, sent by the Personal data pack\'s erasure process, lists each kept category, its legal basis and the date it goes. At the end of their period the records go with the rest.',
      consequences: '• The record stays exactly as issued, which is what tax and commercial rules usually ask of an invoice.\n• Every reader of these tables runs under row-level security; anything that bypasses it (a superuser, a replica or export without the policies) breaks the restriction.\n• The person\'s name stays in the store for years, visible to the compliance role.',
      alternatives: '1. Pseudonymisation of the kept records: daily work keeps using them, but the record no longer stands as issued.\n2. Moving the kept records to an archive store: cleanly out of reach, at the cost of one more store to secure and dispose of.',
    },
    {
      id: 'adr-pseudonymise', label: 'Records kept for an obligation are pseudonymised', when: { CONFLICT: ['pseudonymise'] },
      decision: 'When an accepted erasure request covers records the schedule still requires, the person\'s name, address, e-mail and phone in those records are replaced with a random pseudonym when the rest of their data is erased. The link from pseudonym to the original values is kept in a separate table that only the compliance role can read, used only to produce a record for a named obligation, each use written to the audit trail. A document the law requires kept as issued (the invoice PDF) stays in storage only the compliance role can read. The answer to the person lists each kept category, its legal basis and the date it goes; at the end of the period the link and the records go together.',
      consequences: '• Daily work (reports, reconciliation) keeps using the kept records without seeing whose they are.\n• Pseudonymised data is still personal data while the link exists: the link table needs the protection of the original.\n• Two things to dispose of at the period\'s end, the records and the link.\n• Whether a pseudonymised working copy meets the obligation is a legal reading; the compliance officer confirms it per category.',
      alternatives: '1. Restriction until the period ends: the record stays as issued, and daily work loses it.\n2. Erasing despite the obligation: breaks the obligation; not an option.',
    },
  ],
  fitness: [
    {
      id: 'ff-coverage', label: 'Every table in the schedule', when: { SCHEDULE: ['file'] }, category: 'structural', implements: ['adr-file'], checks: ['req-schedule'],
      threshold: 'Every table in the migrated schema has exactly 1 row in retention/schedule.json with category, basis, period, trigger, date column and owner, reviewed within {{REVIEW_MONTHS}} months, or category "none" with a reason',
      description: 'In CI, after the migrations run against an empty database, a script lists the tables and looks each up in retention/schedule.json; a new table fails the build until it has a complete row, and a row whose last legal review is older than {{REVIEW_MONTHS}} months fails it too, which makes the review a date in the file rather than a promise.',
      tool: 'psql and jq in the CI pipeline (GNU date), against the migrated schema',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
since=$(date -u -d '-{{REVIEW_MONTHS}} months' +%F)
fail=0
for table in $(psql "$DATABASE_URL" -Atc "select tablename from pg_tables where schemaname = 'public'"); do
  jq -e --arg t "$table" --arg since "$since" '
    [.[] | select(.table == $t)] | length == 1 and (.[0] |
      (.category == "none" and (.reason | length > 0)) or
      (.category and .basis and .years > 0 and (.from == "fiscal-year-end" or .from == "date")
        and .column and .owner and .reviewed >= $since))' \\
    retention/schedule.json > /dev/null || { echo "$table: no complete schedule row reviewed since $since"; fail=1; }
done
exit $fail`,
    },
    {
      id: 'ff-tool-mapping', label: 'Every table mapped to an exported label', when: { SCHEDULE: ['tool'] }, category: 'structural', implements: ['adr-tool'], checks: ['req-tool-mapping'],
      threshold: 'retention/labels.json committed within {{REVIEW_MONTHS}} months; every table in the migrated schema has exactly 1 row mapping it to a date column and a label in that export with a retention period in days, or category "none" with a reason',
      description: 'The records manager exports the labels with Microsoft Graph PowerShell (signed in with the delegated permission RecordsManagement.Read.All, the only kind the API accepts) and commits the file; CI checks its age from git history (checkout with fetch-depth 0) and every table against the mapping. A label kept forever (retentionDurationForever, no days) fails, as does a table mapped to a label the export no longer has. With more labels than one page, follow @odata.nextLink when exporting.',
      tool: 'Microsoft Graph PowerShell (Invoke-MgGraphRequest) for the export; psql, jq and git in the CI pipeline',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# export, by the records manager:
#   Connect-MgGraph -Scopes RecordsManagement.Read.All
#   Invoke-MgGraphRequest -Method GET -Uri '/v1.0/security/labels/retentionLabels' -OutputFilePath retention/labels.json
set -euo pipefail
exported=$(git log -1 --format=%cs -- retention/labels.json)
[[ "$exported" > "$(date -u -d '-{{REVIEW_MONTHS}} months' +%F)" ]] || { echo "labels last exported on '$exported'"; exit 1; }
fail=0
for table in $(psql "$DATABASE_URL" -Atc "select tablename from pg_tables where schemaname = 'public'"); do
  jq -e --arg t "$table" --slurpfile labels retention/labels.json '
    [.[] | select(.table == $t)] | length == 1 and (.[0] as $row |
      ($row.category == "none" and ($row.reason | length > 0)) or
      ($row.column and ($labels[0].value | any(.displayName == $row.label and .retentionDuration.days != null))))' \\
    retention/schedule.json > /dev/null || { echo "$table: not mapped to a date column and an exported label"; fail=1; }
done
exit $fail`,
    },
    {
      id: 'ff-store-config', label: 'Every table partitioned with a retention', when: { SCHEDULE: ['store'] }, category: 'structural', implements: ['adr-store'], checks: ['req-store-config', 'req-dispose'],
      threshold: 'Every records table in the schema has pg_partman retention with retention_keep_table false, or is listed with a matter in retention/holds.json; 0 rows older than retention plus one partition interval plus {{DISPOSE_DAYS}} days',
      description: 'A script run in CI against the migrated schema, and daily against production with a read-only role, joins every table (partitions left out, transient tables skipped) to partman.part_config; a table without retention fails unless it is held, a table that only detaches expired partitions fails, and any row older than its period plus one partition and {{DISPOSE_DAYS}} days means maintenance has stopped.',
      tool: 'psql and jq, against PostgreSQL with pg_partman 5',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
held() { jq -e --arg t "$1" 'any(.[]; .table == $t and (.matter | length > 0))' retention/holds.json > /dev/null; }
fail=0
while IFS='|' read -r table control interval retention keep; do
  grep -qxF "\${table#public.}" retention/transient-tables.txt && continue
  if [ -z "$retention" ]; then held "$table" || { echo "$table: no pg_partman retention"; fail=1; }; continue; fi
  [ "$keep" = false ] || { echo "$table: expired partitions are kept, not dropped"; fail=1; }
  late=$(psql "$DATABASE_URL" -Atc "select count(*) from $table where $control < now() - interval '$retention' - interval '$interval' - interval '{{DISPOSE_DAYS}} days'")
  [ "$late" = 0 ] || { echo "$table: $late rows past their period"; fail=1; }
done < <(psql "$DATABASE_URL" -At -c "
  select t.schemaname || '.' || t.tablename, coalesce(c.control, ''), coalesce(c.partition_interval, ''),
         coalesce(c.retention, ''), coalesce(c.retention_keep_table::text, '')
  from pg_tables t
  left join partman.part_config c on c.parent_table = t.schemaname || '.' || t.tablename
  where t.schemaname = 'public'
    and not exists (select 1 from pg_inherits i where i.inhrelid = (quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass)")
exit $fail`,
    },
    {
      id: 'ff-bucket-lifecycle', label: 'Every records bucket expires its objects', category: 'structural', implements: [...MAIN, 'adr-no-hold'], checks: ['req-dispose'],
      threshold: 'Every bucket in RECORD_BUCKETS has an enabled lifecycle rule that expires objects (Days or Date), and, when versioning is on, one that removes noncurrent versions within {{DISPOSE_DAYS}} days',
      description: 'A scheduled job and the infrastructure pipeline read each records bucket\'s lifecycle configuration. In a versioned bucket an Expiration action only adds a delete marker, so without NoncurrentVersionExpiration the record stays as a noncurrent version for ever; versions under Object Lock are left alone by lifecycle, which is how held objects survive. A bucket with no configuration at all answers NoSuchLifecycleConfiguration and fails. Without legal holds, a rule disabled to preserve records for a matter fails this check for as long as it is off.',
      tool: 'AWS CLI v2 (s3api get-bucket-lifecycle-configuration, get-bucket-versioning) and jq',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
fail=0
for bucket in $RECORD_BUCKETS; do
  rules=$(aws s3api get-bucket-lifecycle-configuration --bucket "$bucket" --output json 2>/dev/null) || { echo "$bucket: no lifecycle configuration"; fail=1; continue; }
  echo "$rules" | jq -e 'any(.Rules[]; .Status == "Enabled" and ((.Expiration.Days // 0) > 0 or .Expiration.Date != null))' > /dev/null \\
    || { echo "$bucket: no enabled rule expires objects"; fail=1; }
  if [ "$(aws s3api get-bucket-versioning --bucket "$bucket" --query Status --output text)" = Enabled ]; then
    echo "$rules" | jq -e --argjson d {{DISPOSE_DAYS}} 'any(.Rules[]; .Status == "Enabled" and (.NoncurrentVersionExpiration.NoncurrentDays // 100000) <= $d)' > /dev/null \\
      || { echo "$bucket: noncurrent versions are not removed within {{DISPOSE_DAYS}} days"; fail=1; }
  fi
done
exit $fail`,
    },
    {
      id: 'ff-disposal-job', label: 'Disposal removes the expired and nothing else', when: JOB, category: 'structural', implements: ['adr-file', 'adr-tool', 'adr-hard', 'adr-shred', 'adr-aggregate'], checks: ['req-dispose', 'req-fail-closed'],
      threshold: 'An invoice past its period plus {{DISPOSE_DAYS}} days is disposed of in 1 run; an invoice in its period, every row of a table without a schedule row, and every row when the schedule is missing remain; 1 alert for the unknown table',
      description: 'An integration test runs the real job against PostgreSQL in a container with the repository\'s schedule. expectDisposed checks what the disposal decision promises: the row and its search entry gone, and with crypto-shredding the group\'s key pending deletion, or with totals the row folded into them. The fiscal years are computed from today, so the test keeps working as years pass.',
      tool: 'Vitest with Testcontainers (@testcontainers/postgresql); for the JVM: JUnit 5 with Testcontainers',
      language: 'ts',
      snippet: `import { beforeEach, expect, it } from 'vitest'
import { runDisposal } from '../../src/retention/job'
import { alerts, db, expectDisposed, resetDb } from './fixtures'
const inYear = (yearsAgo: number) => new Date(Date.UTC(new Date().getUTCFullYear() - yearsAgo, 0, 15))
beforeEach(resetDb)

it('disposes of an expired invoice and keeps one in its period', async () => {
  const expired = await db.invoices.insert({ issuedAt: inYear({{ACCOUNTING_YEARS}} + 2) })
  const current = await db.invoices.insert({ issuedAt: inYear({{ACCOUNTING_YEARS}} - 1) })
  await runDisposal({ now: new Date() })
  await expectDisposed('invoices', expired.id)
  expect(await db.invoices.find(current.id)).toBeDefined()
})
it('deletes nothing from a table without a schedule row, and says so', async () => {
  await db.query('create table unscheduled_notes (id serial primary key, created_at timestamptz)')
  await db.query("insert into unscheduled_notes (created_at) values (now() - interval '50 years')")
  await runDisposal({ now: new Date() })
  expect((await db.query('select count(*)::int as n from unscheduled_notes')).rows[0].n).toBe(1)
  expect(alerts()).toContainEqual(expect.objectContaining({ table: 'unscheduled_notes' }))
})
it('deletes nothing at all when the schedule cannot be read', async () => {
  const expired = await db.invoices.insert({ issuedAt: inYear({{ACCOUNTING_YEARS}} + 2) })
  await expect(runDisposal({ now: new Date(), schedulePath: 'retention/missing.json' })).rejects.toThrow()
  expect(await db.invoices.find(expired.id)).toBeDefined()
})`,
    },
    {
      id: 'ff-overdue', label: 'Weekly report of overdue records', when: JOB, category: 'operational', implements: ['adr-file', 'adr-tool', 'adr-no-hold'], checks: ['req-overdue'],
      threshold: '0 records, per table in retention_schedule, whose period ended more than {{DISPOSE_DAYS}} days ago and that no open legal hold covers; above 0 the job fails and opens a ticket for the records owner',
      description: 'A weekly job, independent of the deletion job\'s code, reads the schedule the job last applied (the retention_schedule table: table, period, the event it counts from, date column) and counts the overdue rows of each table with a read-only role; where the legal_hold table exists, rows under an open hold are left out. It assumes a calendar fiscal year; shift the date_trunc for another. The scheduler turns a failed run into a ticket.',
      tool: 'psql in a scheduled job (Kubernetes CronJob, GitHub Actions schedule)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
hold=""
[ "$(psql "$DATABASE_URL" -Atc "select to_regclass('public.legal_hold') is not null")" = t ] &&
  hold="and not exists (select 1 from legal_hold h where h.table_name = '%s' and (h.record_id is null or h.record_id = r.id::text) and h.lifted_at is null)"
total=0
while IFS='|' read -r table period start_from column; do
  start=$column
  [ "$start_from" = fiscal-year-end ] && start="date_trunc('year', $column) + interval '1 year'"
  n=$(psql "$DATABASE_URL" -Atc "select count(*) from $table r where $start + interval '$period' + interval '{{DISPOSE_DAYS}} days' < now() $(printf "$hold" "$table")")
  echo "$table: $n records overdue"
  total=$((total + n))
done < <(psql "$DATABASE_URL" -At -c "select table_name, period, start_from, date_column from retention_schedule where category <> 'none'")
[ "$total" -eq 0 ]`,
    },
    {
      id: 'ff-no-early-delete', label: 'Only disposal can delete records', category: 'structural', implements: MAIN, checks: ['req-not-early'],
      threshold: '0 login roles other than migrator and retention_job (superusers aside) with DELETE or TRUNCATE on any table or partition not listed in retention/transient-tables.txt',
      description: 'In CI against the migrated schema with the production roles created, and weekly against production, a query asks PostgreSQL itself whether each login role can delete from or truncate each table, ownership and inherited grants included; a grant added for convenience fails the build. Superusers can always delete and are kept to the platform team. With each store\'s own lifecycle configuration there is no retention_job role and the schema owner runs pg_partman\'s maintenance.',
      tool: 'psql and awk in the CI pipeline',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
found=$(psql "$DATABASE_URL" -AtF ' ' -c "
  select c.relname, r.rolname, p.privilege
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  cross join pg_roles r
  cross join (values ('DELETE'), ('TRUNCATE')) as p(privilege)
  where c.relkind in ('r', 'p') and r.rolcanlogin and not r.rolsuper
    and r.rolname not in ('migrator', 'retention_job')
    and has_table_privilege(r.oid, c.oid, p.privilege)" |
  awk 'NR == FNR { transient[$1]; next } !($1 in transient)' retention/transient-tables.txt -)
[ -z "$found" ] || { printf 'roles that can remove records before their period ends:\\n%s\\n' "$found"; exit 1; }`,
    },
    {
      id: 'ff-hold', label: 'Holds keep records and only named roles set them', when: { ...HELD, ...JOB }, category: 'structural', implements: ['adr-hold'], checks: ['req-hold', 'req-hold-roles'],
      threshold: 'An expired invoice under an open hold survives a disposal run and is disposed of in the first run after the lift; holds set or lifted by a role outside {{HOLD_ROLES}} are refused (0 accepted); 1 audit record per accepted change',
      description: 'An integration test against PostgreSQL in a container sets a hold as one of the named roles, runs disposal, lifts the hold, runs it again, and tries both as a support engineer; the audit trail is read back for the matter and the actor.',
      tool: 'Vitest with Testcontainers (@testcontainers/postgresql); for the JVM: JUnit 5 with Testcontainers',
      language: 'ts',
      snippet: `import { beforeEach, expect, it } from 'vitest'
import { runDisposal } from '../../src/retention/job'
import { holds } from '../../src/retention/holds'
import { actor, auditTrail, db, expectDisposed, resetDb } from './fixtures'
const ALLOWED = '{{HOLD_ROLES}}'.split(/,\\s*/)
const expiredAt = () => new Date(Date.UTC(new Date().getUTCFullYear() - ({{ACCOUNTING_YEARS}} + 2), 0, 15))
beforeEach(resetDb)

it('keeps held records past their period and disposes of them after the lift', async () => {
  const held = await db.invoices.insert({ issuedAt: expiredAt() })
  const hold = await holds.set(actor(ALLOWED[0]), { matter: 'LIT-2026-014', records: [{ table: 'invoices', id: held.id }] })
  await runDisposal({ now: new Date() })
  expect(await db.invoices.find(held.id)).toBeDefined()
  await holds.lift(actor(ALLOWED[0]), hold.id)
  await runDisposal({ now: new Date() })
  await expectDisposed('invoices', held.id)
})
it('lets only the named roles set and lift a hold, and audits it', async () => {
  const scope = { matter: 'LIT-2026-015', category: 'contracts' }
  await expect(holds.set(actor('support engineer'), scope)).rejects.toThrow(/forbidden/i)
  const hold = await holds.set(actor(ALLOWED[0]), scope)
  await expect(holds.lift(actor('support engineer'), hold.id)).rejects.toThrow(/forbidden/i)
  expect(await auditTrail.find({ subject: hold.id })).toContainEqual(expect.objectContaining({ action: 'legal-hold.set', matter: 'LIT-2026-015', actor: ALLOWED[0] }))
})`,
    },
    {
      id: 'ff-hold-store', label: 'Held objects cannot be deleted', when: { ...HELD, SCHEDULE: ['store'] }, category: 'operational', implements: ['adr-hold'], checks: ['req-hold-store', 'req-hold-roles'],
      threshold: 'A permanent delete of a held object version is refused; after the lift it succeeds; 0 IAM roles outside retention/hold-roles.txt are allowed s3:PutObjectLegalHold on the records buckets',
      description: 'A monthly drill, and a run after every IAM change, against a records bucket of the staging account (Object Lock on): it holds a test object, tries to delete the version, lifts the hold and deletes it, then asks the IAM policy simulator which roles may place or lift legal holds. retention/hold-roles.txt lists the ARNs of the roles that {{HOLD_ROLES}} assume. Held tables are checked by the configuration check through retention/holds.json.',
      tool: 'AWS CLI v2 (s3api put-object-legal-hold, delete-object; iam simulate-principal-policy)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
bucket=$HOLD_DRILL_BUCKET
echo drill > held.txt
version=$(aws s3api put-object --bucket "$bucket" --key drill/held.txt --body held.txt --query VersionId --output text)
aws s3api put-object-legal-hold --bucket "$bucket" --key drill/held.txt --version-id "$version" --legal-hold Status=ON
if aws s3api delete-object --bucket "$bucket" --key drill/held.txt --version-id "$version" 2>/dev/null; then
  echo "a held version was deleted"; exit 1
fi
aws s3api put-object-legal-hold --bucket "$bucket" --key drill/held.txt --version-id "$version" --legal-hold Status=OFF
aws s3api delete-object --bucket "$bucket" --key drill/held.txt --version-id "$version" > /dev/null
for role in $(aws iam list-roles --query 'Roles[].Arn' --output text); do
  decision=$(aws iam simulate-principal-policy --policy-source-arn "$role" --action-names s3:PutObjectLegalHold \\
    --resource-arns "arn:aws:s3:::$bucket/drill/held.txt" --query 'EvaluationResults[0].EvalDecision' --output text)
  [ "$decision" != allowed ] || grep -qxF "$role" retention/hold-roles.txt || { echo "$role may set or lift legal holds"; exit 1; }
done`,
    },
    {
      id: 'ff-conflict', label: 'Erased person, kept records out of reach', category: 'structural', implements: [...MAIN, 'adr-restrict', 'adr-pseudonymise'], checks: ['req-conflict-restrict', 'req-conflict-pseudo'],
      threshold: 'After an accepted erasure, 0 kept records reachable by the person through the support and reporting roles; 1 kept invoice readable by the compliance role for an obligation; the answer to the person lists the kept category with its basis and date',
      description: 'An integration test creates a customer with an invoice in its period, orders and a ticket, accepts their erasure through the Personal data pack\'s erasure process, and checks what each role can still find: whether the invoice is restricted or pseudonymised, support and reporting cannot tie it to the person and the compliance role can still produce it.',
      tool: 'Vitest with Testcontainers (@testcontainers/postgresql); for the JVM: JUnit 5 with Testcontainers',
      language: 'ts',
      snippet: `import { expect, it } from 'vitest'
import { acceptErasure } from '../../src/privacy/erasure'
import { asRole, customerWith } from './fixtures'

it('keeps what the law requires, for that obligation only', async () => {
  const person = await customerWith({ invoices: 1, orders: 2, tickets: 1 })
  const answer = await acceptErasure(person.id)
  expect(await asRole('support').search(person.email)).toEqual([])
  expect(await asRole('reporting').invoicesOf(person.id)).toEqual([])
  const kept = await asRole('compliance').invoicesOf(person.id, { obligation: 'tax-audit' })
  expect(kept).toHaveLength(1)
  expect(answer.kept).toEqual([{ category: 'invoices', basis: expect.any(String), until: kept[0].retainUntil }])
})`,
    },
    {
      id: 'ff-shred-keys', label: 'Keys of disposed groups destroyed', when: { ...JOB, DELETE: ['crypto'] }, category: 'operational', implements: ['adr-shred'], checks: ['req-shred'],
      threshold: '0 record groups disposed of more than 1 day ago whose KMS key is in any state but PendingDeletion or deleted; every pending deletion date within 30 days of the disposal',
      description: 'A daily job reads the groups the deletion job logged in disposal_log (group, key id, time) and asks AWS KMS for each key\'s state; a key still enabled means the group\'s copies in backups and archives are still readable. A deleted key answers NotFoundException, which counts as done.',
      tool: 'AWS CLI v2 (kms describe-key) and psql in a scheduled job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
fail=0
while IFS='|' read -r group key disposed; do
  meta=$(aws kms describe-key --key-id "$key" --output json 2> err.txt) || {
    grep -q NotFoundException err.txt && continue
    echo "$group: $(cat err.txt)"; fail=1; continue
  }
  state=$(echo "$meta" | jq -r .KeyMetadata.KeyState)
  [ "$state" = PendingDeletion ] || { echo "$group: key $key is $state"; fail=1; continue; }
  deletion=$(date -u -d "$(echo "$meta" | jq -r .KeyMetadata.DeletionDate)" +%s)   # AWS CLI v2 prints ISO 8601
  [ "$deletion" -le $((disposed + 30 * 86400)) ] || { echo "$group: key deleted only at $deletion"; fail=1; }
done < <(psql "$DATABASE_URL" -At -c "select group_key, key_id, extract(epoch from disposed_at)::bigint from disposal_log where disposed_at < now() - interval '1 day'")
exit $fail`,
    },
    {
      id: 'ff-aggregates', label: 'Totals identify no one', when: { ...JOB, DELETE: ['aggregate'] }, category: 'structural', implements: ['adr-aggregate'], checks: ['req-aggregate'],
      threshold: '0 rows in any *_totals table with a record count below 5; 0 columns in them outside month, category, region, currency, record_count, net_amount, tax_amount',
      description: 'A query run in CI against the migrated schema and daily after disposal returns every small group and every column that could carry an identifier; a new column in a totals table fails until it is added to the list on purpose. That expired rows are actually gone is the weekly report\'s job.',
      tool: 'psql (a SQL check that fails on any row; or the same query as a dbt singular test)',
      language: 'sql',
      snippet: `-- every row returned is a failure
select 'group of fewer than 5 records' as problem, category || ' ' || month::text as detail
from invoice_totals
where record_count < 5
union all
select 'column that may identify someone', table_name || '.' || column_name
from information_schema.columns
where table_schema = 'public' and table_name like '%\\_totals'
  and column_name not in ('month', 'category', 'region', 'currency', 'record_count', 'net_amount', 'tax_amount');`,
    },
  ],
}

export default pack
