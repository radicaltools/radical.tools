import type { PackSpec, When } from '../../src/packSpec'

const COPIED: When = { METHOD: ['sync', 'pitr', 'snapshot'] }
const ALL_ADRS = ['adr-sync', 'adr-pitr', 'adr-snapshot', 'adr-rebuild']
const COPY_ADRS = ['adr-sync', 'adr-pitr', 'adr-snapshot']
const FORCES = 'This store keeps data that the system cannot work without. The forces: stores are lost to broken disks, bad deployments, mistaken deletes, ransomware and region outages, and replication copies the mistakes as faithfully as the data; the less data may be lost (the recovery point objective, RPO) and the faster it must be back (the recovery time objective, RTO), the more every write and every month costs; copies in the same account and region go down, or get encrypted, together with the store; and a backup that has never been restored is a hope, not a copy.'

const pack: PackSpec = {
  id: 'concern-backup-recovery',
  name: 'Backup and recovery',
  group: 'data',
  description: 'When a store is lost: how much data may go with it, how fast it comes back, where the copies are kept, and the drill that proves it.',
  tags: ['reliability', 'backup', 'disaster-recovery', 'rpo', 'rto', 'ransomware'],
  concern: {
    id: 'backup-recovery',
    trigger: 'LIST NODES WHERE type = "database" AND external != true',
    why: 'these stores hold what may not be recomputable, so how much may be lost, how fast it comes back and where the copies are kept has to be decided.',
  },
  sources: [
    { title: 'Google SRE book, chapter 26: Data Integrity: What You Read Is What You Wrote', url: 'https://sre.google/sre-book/data-integrity/' },
    { title: 'AWS whitepaper: Disaster Recovery of Workloads on AWS: Recovery in the Cloud', url: 'https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-workloads-on-aws.html' },
    { title: 'AWS Well-Architected Framework, Reliability Pillar (REL09 back up data, REL13 plan for disaster recovery)', url: 'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html' },
    { title: 'Azure Well-Architected Framework: Develop a disaster recovery plan', url: 'https://learn.microsoft.com/en-us/azure/well-architected/reliability/disaster-recovery' },
    { title: 'CISA #StopRansomware Guide (offline, immutable backups)', url: 'https://www.cisa.gov/stopransomware/ransomware-guide' },
  ],
  questions: [
    {
      key: 'METHOD', title: 'Copies', label: 'How is the store copied?',
      hint: 'The method decides the recovery point: how much committed data may be lost. Pick the cheapest one that meets the RPO below.',
      default: 'pitr',
      options: [
        { value: 'sync', label: 'synchronous replication', description: 'Every write is acknowledged only once a second zone or region has it, and backups still cover mistakes. Pick it when the RPO is 0: payments, ledgers, anything a customer was told is saved and cannot be redone.' },
        { value: 'pitr', label: 'continuous backup with point-in-time recovery', description: 'The write-ahead log is archived continuously, so the store restores to any second of the retention period. Pick it when a few minutes of loss is acceptable, which suits most transactional stores; managed databases offer it built in.' },
        { value: 'snapshot', label: 'scheduled snapshots', description: 'A consistent snapshot every few hours or every night. Pick it when the RPO is hours or more and the lost changes can be redone or re-imported, as for back-office or reference data.' },
        { value: 'rebuild', label: 'rebuilt from its sources', description: 'A cache, search index, read model or projection that can be rebuilt from the stores or event log it is derived from. Pick it only when nothing is written to it first and the rebuild fits in the RTO.' },
      ],
    },
    {
      key: 'COPIES', title: 'Copy location', label: 'Where are the copies kept?',
      hint: 'A copy that the same credentials can delete, or that sits in the same region, is lost together with the store; the 3-2-1 rule asks for three copies on two kinds of media, one of them off-site.',
      default: 'vault',
      options: [
        { value: 'vault', label: 'in another account and region, locked', description: 'Copies go to a backup vault in a separate account and region, under a compliance-mode lock (write once, read many) that nobody can lift before they expire. Pick it for any production store on a cloud: it is what survives ransomware and a stolen administrator credential.' },
        { value: 'region', label: 'in another region of the same account', description: 'Copies go to a second region with deletion protection and an alert on every deletion. Pick it when a separate account is not possible yet and the risk accepted is an attacker with administrator rights.' },
        { value: 'offline', label: 'offline at a second site', description: 'A copy on tape or removable disks, disconnected after writing and kept at a second site under separate administration. Pick it for on-premises systems, or as the third copy where regulation demands an air gap.' },
      ],
    },
    {
      key: 'DR', title: 'Region outage', label: 'What happens when the whole region or site is lost?',
      hint: 'The disaster recovery strategy decides the RTO for the worst case: from hours (backup and restore) to minutes (warm standby). Its cost rises in the same order.',
      default: 'restore',
      options: [
        { value: 'restore', label: 'backup and restore in a second region', description: 'Infrastructure is recreated from code and the store restored from its copies in a second region. Pick it when an RTO of hours for a region loss is acceptable; it costs little more than the copies.' },
        { value: 'standby', label: 'a warm standby in a second region', description: 'A replica runs in the second region all the time, with the rest of the system scaled down beside it, and is promoted on failover. Pick it when a region loss must be recovered within minutes to an hour.' },
        { value: 'single', label: 'one region, across zones', description: 'The store survives the loss of a zone, but a region outage is waited out. Pick it when the business accepts that, and it is written down where customers can see it (the service level agreement).' },
      ],
    },
    {
      key: 'DRILL', title: 'Restore drill', label: 'How is recovery proven?',
      hint: 'Recovery that is not exercised fails when it is needed: an expired credential, a missing step, a restore slower than anyone thought.',
      default: 'auto',
      options: [
        { value: 'auto', label: 'an automated restore test every week', description: 'A scheduled pipeline restores (or rebuilds) the latest copy into an isolated environment, checks the data and measures the time. Pick it when the restore can be scripted end to end, which managed databases and pgBackRest allow.' },
        { value: 'manual', label: 'a restore drill by the team every quarter', description: 'People follow the runbook to restore into a clean environment, record the time and fix the runbook. Pick it when the restore needs human steps (tapes, approvals, a second site), or as the first step before automating.' },
      ],
    },
  ],
  details: [
    { key: 'RPO_MINUTES', label: 'How many minutes of committed data may be lost (RPO)?', default: '15', number: true },
    { key: 'RTO_MINUTES', label: 'How many minutes may the store be down after a loss (RTO)?', default: '60', number: true },
    { key: 'RETAIN_DAYS', label: 'For how many days are copies kept?', default: '35', number: true },
  ],
  need: {
    label: 'Data survives a disaster',
    text: 'Stores get lost: a broken disk, a deleted table, a bad migration, ransomware, a region down. How much data may be lost, how fast the system is back, whether the copies survive the same attack, and whether they actually restore are decisions that are usually tested only on the day they are needed.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-sync', label: 'Writes stored twice', when: { METHOD: ['sync'] }, ears_type: 'ubiquitous',
      action: 'acknowledge a write only after it is durable in two availability zones or regions, so that losing one loses no acknowledged write',
      rationale: 'An RPO of zero is reachable only with synchronous replication; asynchronous replicas lose what was in flight (AWS DR whitepaper, multi-site strategies; PostgreSQL synchronous_commit).',
      scenario: { label: 'Primary lost, nothing lost', given: 'writes acknowledged to clients under load', when: 'the primary is stopped without warning', then: 'every acknowledged write is on the promoted replica' },
    },
    {
      id: 'req-pitr', label: 'Point-in-time restore', when: { METHOD: ['pitr'] }, ears_type: 'ubiquitous',
      action: 'archive the write-ahead log continuously so the store restores to any second of the last {{RETAIN_DAYS}} days, with the newest archived change never more than {{RPO_MINUTES}} minutes old',
      rationale: 'Continuous archiving bounds the loss to the archive delay and gives a way back from a mistake made an hour ago (PostgreSQL docs, Continuous Archiving and Point-in-Time Recovery; AWS REL09-BP03).',
      scenario: { label: 'Restored to the minute', given: 'a table deleted by mistake at a known time', when: 'the store is restored to one minute before', then: 'the table is back with its data, and no more than {{RPO_MINUTES}} minutes of other changes are missing' },
    },
    {
      id: 'req-snapshot', label: 'Snapshots on schedule', when: { METHOD: ['snapshot'] }, ears_type: 'ubiquitous',
      action: 'take an application-consistent snapshot at least every {{RPO_MINUTES}} minutes and keep each for {{RETAIN_DAYS}} days',
      rationale: 'The snapshot interval is the recovery point; the retention is the time to notice a silent corruption before the last good copy expires (Google SRE book, ch. 26; AWS REL09-BP03).',
      scenario: { label: 'Last snapshot restores', given: 'the newest snapshot', when: 'it is restored into a clean environment', then: 'the store holds the data of no more than {{RPO_MINUTES}} minutes before the snapshot ran' },
    },
    {
      id: 'req-recover', label: 'Back within the limit', when: COPIED, ears_type: 'event-driven',
      trigger: 'the store is lost, or a mistake or an attack destroys or corrupts its data',
      action: 'restore service from its copies within {{RTO_MINUTES}} minutes, losing no more than {{RPO_MINUTES}} minutes of committed writes',
      rationale: 'RTO and RPO are the recovery objectives the business sets for downtime and data loss (AWS REL13-BP01); replication alone does not undo a mistaken delete, which needs a copy from before it.',
      scenario: { label: 'Store restored in time', given: 'the store in a test environment with known data', when: 'it is destroyed and restored from its copies', then: 'service is back within {{RTO_MINUTES}} minutes and no more than {{RPO_MINUTES}} minutes of writes are missing' },
    },
    {
      id: 'req-copy-alert', label: 'Failed copies noticed', when: COPIED, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a backup, a log archive or replication fails, or the newest copy is older than {{RPO_MINUTES}} minutes',
      action: 'page the on-call engineer within 15 minutes',
      rationale: 'Backups fail silently for months unless their age is watched; the age of the newest copy is the RPO actually held (Google SRE book, ch. 26).',
      scenario: { label: 'Stale copy pages', given: 'a backup job whose credentials have expired', when: 'the newest copy grows older than {{RPO_MINUTES}} minutes', then: 'the on-call engineer is paged within 15 minutes' },
    },
    {
      id: 'req-copies-vault', label: 'Copies locked away', when: { METHOD: ['sync', 'pitr', 'snapshot'], COPIES: ['vault'] }, ears_type: 'ubiquitous',
      action: 'keep the copies in a separate account and region, under a compliance-mode lock that prevents deleting or changing them for {{RETAIN_DAYS}} days, encrypted with a key held in that account',
      rationale: 'Ransomware and stolen administrator credentials reach every copy that the same identity can delete; a write-once lock in another account is the off-site copy of the 3-2-1 rule (CISA #StopRansomware Guide; AWS REL09-BP02).',
      scenario: { label: 'Copies out of reach', given: 'the store\'s account fully taken over', when: 'the attacker tries to delete or overwrite the copies', then: 'every attempt is refused until the copies expire after {{RETAIN_DAYS}} days' },
    },
    {
      id: 'req-copies-region', label: 'Copies in another region', when: { METHOD: ['sync', 'pitr', 'snapshot'], COPIES: ['region'] }, ears_type: 'ubiquitous',
      action: 'copy every backup to a second region within 60 minutes of taking it, keep it {{RETAIN_DAYS}} days with deletion protection, and alert the on-call engineer within 5 minutes of any copy being deleted',
      rationale: 'A copy in the same region goes down with it (AWS DR whitepaper, backup and restore); deletion protection and an alert are what is left when the account is shared.',
      scenario: { label: 'Deleted copy noticed', given: 'copies in the second region', when: 'someone deletes one', then: 'the on-call engineer is alerted within 5 minutes' },
    },
    {
      id: 'req-copies-offline', label: 'Offline copy at a second site', when: { METHOD: ['sync', 'pitr', 'snapshot'], COPIES: ['offline'] }, ears_type: 'ubiquitous',
      action: 'write a copy at least every 24 hours to media that are disconnected after writing and kept at a second site under separate administration, and keep each for {{RETAIN_DAYS}} days',
      rationale: 'An air-gapped copy cannot be reached by an attacker on the network (CISA #StopRansomware Guide: maintain offline, encrypted backups); the 3-2-1 rule asks for one copy off-site.',
      scenario: { label: 'Air-gapped copy restores', given: 'the newest offline copy, brought back from the second site', when: 'it is restored into an isolated environment', then: 'the store holds the data of its day' },
    },
    {
      id: 'req-dr-restore', label: 'Restored in a second region', when: { METHOD: ['sync', 'pitr', 'snapshot'], DR: ['restore'] }, ears_type: 'event-driven',
      trigger: 'the primary region or site becomes unavailable',
      action: 'recreate the infrastructure from code in the second region and restore the store there from its copies, within the region RTO the service level agreement states (at most 24 hours)',
      rationale: 'Backup and restore is the cheapest disaster recovery strategy, with an RTO of hours (AWS DR whitepaper, REL13-BP02); it works only if the infrastructure is code.',
      scenario: { label: 'Region rebuilt', given: 'the primary region marked unavailable in a test', when: 'the recovery runbook is started', then: 'the store serves from the second region within the stated region RTO' },
    },
    {
      id: 'req-dr-standby', label: 'Standby takes over', when: { METHOD: ['sync', 'pitr', 'snapshot'], DR: ['standby'] }, ears_type: 'event-driven',
      trigger: 'the primary region or site becomes unavailable',
      action: 'promote the standby in the second region and serve from it within {{RTO_MINUTES}} minutes, its replication lag kept under {{RPO_MINUTES}} minutes while both are healthy',
      rationale: 'A warm standby brings the region RTO down to minutes (AWS DR whitepaper, pilot light and warm standby; REL13-BP02); replication lag is the RPO of a region loss.',
      scenario: { label: 'Region failover', given: 'the standby replicating with a lag under {{RPO_MINUTES}} minutes', when: 'the primary region is cut off in a failover test', then: 'the standby serves within {{RTO_MINUTES}} minutes' },
    },
    {
      id: 'req-dr-single', label: 'Zone loss survived', when: { METHOD: ['sync', 'pitr', 'snapshot'], DR: ['single'] }, ears_type: 'state-driven',
      precondition: 'while one availability zone of the store\'s region is unavailable',
      action: 'keep serving from the other zones within {{RTO_MINUTES}} minutes, and state in the service level agreement that a loss of the whole region is waited out',
      rationale: 'A single region with zone redundancy covers the common failures; a region outage is then an accepted risk, which customers must be told (Azure Well-Architected, disaster recovery; AWS REL10).',
      scenario: { label: 'Zone lost', given: 'the store across two zones', when: 'one zone is cut off in a test', then: 'it serves from the other within {{RTO_MINUTES}} minutes' },
    },
    {
      id: 'req-rebuild', label: 'Rebuilt from sources', when: { METHOD: ['rebuild'] }, ears_type: 'event-driven',
      trigger: 'the store is lost or found corrupted',
      action: 'rebuild it from its sources, in this or a second region, within {{RTO_MINUTES}} minutes, and serve nothing from it until the rebuild has caught up with the sources',
      rationale: 'Data that can be reproduced from sources needs no backup if it can be reproduced in time (AWS REL09-BP01).',
      scenario: { label: 'Projection rebuilt', given: 'the store emptied in a test environment', when: 'the rebuild runs', then: 'within {{RTO_MINUTES}} minutes it holds what the sources say' },
    },
    {
      id: 'req-derived', label: 'Nothing only here', when: { METHOD: ['rebuild'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'code other than the rebuild or projection process tries to write to the store',
      action: 'refuse the write, so that nothing exists only in the store',
      rationale: 'A rebuilt store loses whatever was written to it first; keeping it derived is what makes having no backup safe.',
      scenario: { label: 'Direct write refused', given: 'the store\'s database role', when: 'a service other than the projector writes to it', then: 'the write is refused' },
    },
    {
      id: 'req-drill-auto', label: 'Weekly automated restore', when: { DRILL: ['auto'] }, ears_type: 'event-driven',
      trigger: 'a week has passed since the last restore test',
      action: 'restore or rebuild the latest copy automatically into an isolated environment, check row counts, the newest timestamp and a sample of records, and alert the owner when it fails or takes longer than {{RTO_MINUTES}} minutes',
      rationale: 'Nobody wants backups, they want restores: only a restore that is exercised is known to work (Google SRE book, ch. 26; AWS REL09-BP04 periodic recovery).',
      scenario: { label: 'Weekly restore passes', given: 'the scheduled restore test', when: 'it runs', then: 'the restored store passes the data checks within {{RTO_MINUTES}} minutes, or the owner is alerted' },
    },
    {
      id: 'req-drill-manual', label: 'Quarterly restore drill', when: { DRILL: ['manual'] }, ears_type: 'event-driven',
      trigger: 'a quarter has passed since the last restore drill',
      action: 'have someone other than the runbook\'s author restore or rebuild the store into a clean environment by following the runbook, record the time taken and the age of the data, and correct the runbook within 14 days',
      rationale: 'A drill by someone who did not write the runbook finds the steps only its author knows (Google SRE book, ch. 26; AWS REL13-BP03 test disaster recovery).',
      scenario: { label: 'Drill recorded', given: 'the runbook and an engineer who did not write it', when: 'the quarterly drill is run', then: 'the drill record shows the time taken against {{RTO_MINUTES}} minutes, the data age, and the runbook fixes' },
    },
  ],
  adrs: [
    {
      id: 'adr-sync', label: 'Synchronous replication and backups', when: { METHOD: ['sync'] },
      decision: 'Writes are replicated synchronously and acknowledged only when a second zone or region has them: PostgreSQL with synchronous_standby_names and synchronous_commit = on (managed by Patroni or CloudNativePG), or a managed service that does it (Amazon Aurora, Azure SQL Business Critical, Cloud SQL high availability; Spanner or CockroachDB across regions). Replication copies mistakes, so continuous backups with point-in-time recovery cover them, kept {{RETAIN_DAYS}} days {{COPIES}}. Region loss: {{DR}}. Service comes back within {{RTO_MINUTES}} minutes. Proven by {{DRILL}}. Choose a managed service unless the database must run on premises; choose cross-region synchronous replication only when the added latency of every write (tens of milliseconds) is acceptable.',
      consequences: '• No acknowledged write is lost when a zone (or region) is.\n• Every write waits for the second copy: higher latency, and writes stop if no synchronous standby is available.\n• Twice the database cost, plus the backups that still guard against mistakes.\n• Failover must be automatic and tested, or the zero RPO comes with a long RTO.',
      alternatives: '1. Continuous backup with point-in-time recovery: minutes of loss, cheaper and faster writes.\n2. Asynchronous replication: fast writes, but what was in flight is lost on failover.\n3. Scheduled snapshots: hours of loss.',
    },
    {
      id: 'adr-pitr', label: 'Point-in-time recovery', when: { METHOD: ['pitr'] },
      decision: 'The store archives its write-ahead log continuously and restores to any second of the last {{RETAIN_DAYS}} days, the newest archived change no older than {{RPO_MINUTES}} minutes: the managed service\'s point-in-time recovery (Amazon RDS and Aurora automated backups, Azure Database for PostgreSQL, Cloud SQL, MongoDB Atlas continuous backup), or pgBackRest or WAL-G to object storage for self-managed PostgreSQL. Copies are kept {{COPIES}}. Region loss: {{DR}}. Service comes back within {{RTO_MINUTES}} minutes. Proven by {{DRILL}}. Choose the managed service\'s own feature when there is one; pgBackRest when you run PostgreSQL yourself and need parallel restore and verification.',
      consequences: '• At most {{RPO_MINUTES}} minutes of loss, and a way back from a mistake to the second before it.\n• Cheap: most managed databases include it.\n• Restoring a large store replays a lot of log: the restore time must be measured, not assumed, against {{RTO_MINUTES}} minutes.\n• Copies to another account or region are a separate step the managed feature does not always do.',
      alternatives: '1. Synchronous replication: no loss, slower and dearer writes, and still needs backups.\n2. Scheduled snapshots: simpler, hours of loss.',
    },
    {
      id: 'adr-snapshot', label: 'Scheduled snapshots', when: { METHOD: ['snapshot'] },
      decision: 'The store is snapshotted at least every {{RPO_MINUTES}} minutes and each snapshot is kept {{RETAIN_DAYS}} days, {{COPIES}}: AWS Backup or Azure Backup plans for managed stores and volumes, Velero for Kubernetes volumes, pg_dump or mysqldump for small databases. Snapshots are taken application-consistent (quiesced or from the database\'s own tool). Region loss: {{DR}}. Service comes back within {{RTO_MINUTES}} minutes. Proven by {{DRILL}}. The changes since the last snapshot are lost and must be redone or re-imported; the owner of the data agrees to that.',
      consequences: '• Simple and cheap to run.\n• Up to {{RPO_MINUTES}} minutes of changes is lost: the business must be able to redo them.\n• Crash-consistent volume snapshots of a running database may not restore: consistency must be checked in the drill.',
      alternatives: '1. Point-in-time recovery: minutes of loss for little more.\n2. Synchronous replication: no loss, far dearer.',
    },
    {
      id: 'adr-rebuild', label: 'Rebuilt, not backed up', when: { METHOD: ['rebuild'] },
      decision: 'The store holds only what is derived from its sources (a cache, a search index such as Elasticsearch or OpenSearch, a read model fed from an event log kept long enough to replay); it has no backups. Only the projection process may write to it, which its database role enforces. When it is lost it is rebuilt within {{RTO_MINUTES}} minutes by replaying the sources; the sources themselves are backed up under their own decision. Proven by {{DRILL}}.',
      consequences: '• No backups to keep or lock.\n• Anything written only here would be lost: the store must stay derived.\n• Rebuild time grows with the sources: when it nears {{RTO_MINUTES}} minutes, snapshot the store as well or rebuild in parallel.\n• While it rebuilds, what depends on it is degraded or down.',
      alternatives: '1. Back it up anyway: a faster recovery when the rebuild cannot meet the time.\n2. Keep a warm second copy: instant recovery, double the cost.',
    },
  ],
  fitness: [
    {
      id: 'ff-sync', label: 'Synchronous standby attached', when: { METHOD: ['sync'] }, category: 'operational', implements: ['adr-sync'],
      threshold: 'At least 1 standby in sync or quorum state at every moment; a page after 1 minute without one',
      description: 'The database exporter counts the standbys replicating synchronously; Prometheus pages when there is none, because writes then either stop or lose their second copy.',
      tool: 'Prometheus with sql_exporter',
      language: 'yaml',
      snippet: `# sql_exporter collector
collector_name: replication
metrics:
  - metric_name: pg_sync_standbys
    type: gauge
    help: 'Standbys replicating synchronously'
    values: [n]
    query: |
      SELECT count(*) AS n FROM pg_stat_replication WHERE sync_state IN ('sync', 'quorum')
---
# Prometheus alerting rule
groups:
  - name: backup-recovery
    rules:
      - alert: NoSynchronousStandby
        expr: pg_sync_standbys < 1
        for: 1m
        labels: { severity: page }`,
    },
    {
      id: 'ff-rpo', label: 'Newest copy within the RPO', when: COPIED, category: 'operational', implements: COPY_ADRS,
      threshold: 'The newest recoverable copy is never older than {{RPO_MINUTES}} minutes for more than 5 minutes',
      description: 'The backup job pushes the time of its last success (for point-in-time recovery, the exporter reports the last archived log segment); Prometheus pages when the newest copy is older than the RPO, which also catches a job that silently stopped.',
      tool: 'Prometheus (Pushgateway for backup jobs)',
      language: 'yaml',
      snippet: `groups:
  - name: backup-recovery
    rules:
      - alert: RecoveryPointTooOld
        # backup_last_success_timestamp_seconds: pushed by the backup job, or
        # pg_stat_archiver.last_archived_time exported for point-in-time recovery
        expr: time() - backup_last_success_timestamp_seconds{store="orders"} > {{RPO_MINUTES}} * 60
        for: 5m
        labels: { severity: page }
        annotations:
          summary: 'The newest copy of {{ $labels.store }} is older than {{RPO_MINUTES}} minutes'`,
    },
    {
      id: 'ff-vault', label: 'Copies locked in another account', when: { METHOD: ['sync', 'pitr', 'snapshot'], COPIES: ['vault'] }, category: 'structural', implements: COPY_ADRS,
      threshold: 'Every backup plan copies to a vault under a compliance-mode lock of at least {{RETAIN_DAYS}} days; 0 plans without a copy',
      description: 'In CI the Terraform plan (terraform show -json) is checked: a vault lock must exist in compliance mode with the retention, and every backup rule must copy to the vault in the other account.',
      tool: 'Open Policy Agent (conftest) on the Terraform plan',
      language: 'rego',
      snippet: `package main
import rego.v1

locks := [r | some r in input.resource_changes; r.type == "aws_backup_vault_lock_configuration"]

deny contains "no backup vault is locked (AWS Backup Vault Lock)" if count(locks) == 0

deny contains msg if {
  some l in locks
  l.change.after.min_retention_days < {{RETAIN_DAYS}}
  msg := sprintf("%s locks copies for fewer than {{RETAIN_DAYS}} days", [l.address])
}

deny contains msg if {
  some l in locks
  not l.change.after.changeable_for_days   # without it the lock is governance mode, which an administrator can lift
  msg := sprintf("%s is not in compliance mode", [l.address])
}

deny contains msg if {
  some r in input.resource_changes
  r.type == "aws_backup_plan"
  some rule in r.change.after.rule
  count(rule.copy_action) == 0
  msg := sprintf("%s rule %s copies nothing to the locked vault", [r.address, rule.rule_name])
}`,
    },
    {
      id: 'ff-copy-region', label: 'Copies leave the region', when: { METHOD: ['sync', 'pitr', 'snapshot'], COPIES: ['region'] }, category: 'structural', implements: COPY_ADRS,
      threshold: '0 backup rules without a copy to a vault outside the primary region',
      description: 'In CI the Terraform plan is checked: every backup rule must copy to a vault whose ARN names another region. Deletions of copies are alerted by an EventBridge rule on the backup vault events, set up beside it.',
      tool: 'Open Policy Agent (conftest) on the Terraform plan',
      language: 'rego',
      snippet: `package main
import rego.v1

primary := "eu-central-1"

copies_elsewhere(rule) if {
  some c in rule.copy_action
  not contains(c.destination_vault_arn, sprintf(":%s:", [primary]))
}

deny contains msg if {
  some r in input.resource_changes
  r.type == "aws_backup_plan"
  some rule in r.change.after.rule
  not copies_elsewhere(rule)
  msg := sprintf("%s rule %s keeps its copies in %s", [r.address, rule.rule_name, primary])
}`,
    },
    {
      id: 'ff-offline', label: 'Offline copy fresh', when: { METHOD: ['sync', 'pitr', 'snapshot'], COPIES: ['offline'] }, category: 'process', implements: COPY_ADRS,
      threshold: 'The newest offline copy, written and disconnected, is never older than 26 hours',
      description: 'The job that writes the offline copy pushes its success time after the media are verified and ejected; Prometheus alerts when it is older than a day and a margin.',
      tool: 'Prometheus (Pushgateway)',
      language: 'yaml',
      snippet: `groups:
  - name: backup-recovery
    rules:
      - alert: OfflineCopyTooOld
        expr: time() - offline_copy_last_success_timestamp_seconds{store="orders"} > 26 * 3600
        for: 15m
        labels: { severity: ticket }
        annotations:
          summary: 'No verified offline copy of {{ $labels.store }} in the last 26 hours'`,
    },
    {
      id: 'ff-dr-policy', label: 'Region recovery assessed', when: { METHOD: ['sync', 'pitr', 'snapshot'], DR: ['restore', 'standby'] }, category: 'operational', implements: COPY_ADRS,
      threshold: 'The resiliency assessment of the latest release meets the policy (RPO {{RPO_MINUTES}} minutes, RTO {{RTO_MINUTES}} minutes) for zone, hardware, software and region disruptions',
      description: 'A resiliency policy states the objectives; each release is assessed against it and the pipeline fails unless the assessment says the policy is met. On Azure, a test failover with Azure Site Recovery plays the same part.',
      tool: 'AWS Resilience Hub (AWS CLI)',
      language: 'sh',
      snippet: `RPO=$(( {{RPO_MINUTES}} * 60 )); RTO=$(( {{RTO_MINUTES}} * 60 ))
aws resiliencehub create-resiliency-policy --policy-name orders-store --tier Critical \\
  --policy "{\\"AZ\\":{\\"rpoInSecs\\":$RPO,\\"rtoInSecs\\":$RTO},\\"Hardware\\":{\\"rpoInSecs\\":$RPO,\\"rtoInSecs\\":$RTO},\\"Software\\":{\\"rpoInSecs\\":$RPO,\\"rtoInSecs\\":$RTO},\\"Region\\":{\\"rpoInSecs\\":$RPO,\\"rtoInSecs\\":$RTO}}"

# in the release pipeline, after the assessment of the new version has finished:
STATUS=$(aws resiliencehub describe-app-assessment --assessment-arn "$ASSESSMENT_ARN" \\
  --query 'assessment.complianceStatus' --output text)
test "$STATUS" = "PolicyMet" || { echo "recovery objectives not met: $STATUS"; exit 1; }`,
    },
    {
      id: 'ff-zones', label: 'Store spans zones', when: { METHOD: ['sync', 'pitr', 'snapshot'], DR: ['single'] }, category: 'structural', implements: COPY_ADRS,
      threshold: '0 database instances in the Terraform plan without Multi-AZ',
      description: 'In CI the Terraform plan is checked: every database instance must run across availability zones, since a zone loss is the failure this decision promises to survive.',
      tool: 'Open Policy Agent (conftest) on the Terraform plan',
      language: 'rego',
      snippet: `package main
import rego.v1

deny contains msg if {
  some r in input.resource_changes
  r.type == "aws_db_instance"
  not r.change.after.multi_az
  msg := sprintf("%s runs in one availability zone", [r.address])
}`,
    },
    {
      id: 'ff-derived', label: 'Only the projector writes', when: { METHOD: ['rebuild'] }, category: 'structural', implements: ['adr-rebuild'],
      threshold: '0 modules outside the projection that import the store\'s write client',
      description: 'A dependency rule fails the build when code outside the projection imports the store\'s client, which would let something be written that the rebuild cannot bring back. The store\'s database role grants writes to the projector only.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'store-is-derived',
    comment: 'ADR Rebuilt, not backed up: only the projection writes to the store',
    severity: 'error',
    from: { pathNot: '^src/projection/' },
    to: { path: '^src/stores/search/writer' },
  }],
}`,
    },
    {
      id: 'ff-drill-auto', label: 'Weekly restore test', when: { DRILL: ['auto'] }, category: 'operational', implements: ALL_ADRS,
      threshold: 'A restore (or rebuild) into an isolated environment every week, passing the data checks within {{RTO_MINUTES}} minutes, with data no older than {{RPO_MINUTES}} minutes',
      description: 'A scheduled workflow restores the latest copy (or rebuilds from the sources) into a throwaway environment, runs the data checks and tears it down; the job\'s timeout is the RTO, so a slow restore fails it. AWS Backup restore testing can do the same for stores it backs up.',
      tool: 'GitHub Actions (scheduled workflow)',
      language: 'yaml',
      snippet: `# .github/workflows/restore-drill.yml
name: restore-drill
on:
  schedule: [{ cron: '0 3 * * 1' }]   # every Monday, 03:00 UTC
  workflow_dispatch: {}
jobs:
  restore:
    runs-on: ubuntu-latest
    timeout-minutes: {{RTO_MINUTES}}
    steps:
      - uses: actions/checkout@v4
      - name: Restore the latest copy into a clean environment
        run: ./ops/recover.sh --target "drill-$GITHUB_RUN_ID" --latest
      - name: Check row counts, newest timestamp and a sample of records
        run: ./ops/verify.sh --target "drill-$GITHUB_RUN_ID" --max-age-minutes {{RPO_MINUTES}}
      - name: Tear down
        if: always()
        run: ./ops/teardown.sh "drill-$GITHUB_RUN_ID"`,
    },
    {
      id: 'ff-drill-manual', label: 'Quarterly drill on record', when: { DRILL: ['manual'] }, category: 'process', implements: ALL_ADRS,
      threshold: 'The newest drill record is at most 92 days old and its restore took no more than {{RTO_MINUTES}} minutes',
      description: 'Each drill is recorded as docs/drills/YYYY-MM-DD.md with a "minutes:" line; a daily scheduled job fails, and notifies the owner, when the newest record is too old or too slow.',
      tool: 'GitHub Actions (scheduled workflow)',
      language: 'yaml',
      snippet: `# .github/workflows/drill-overdue.yml
name: drill-overdue
on:
  schedule: [{ cron: '0 7 * * *' }]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          latest=$(ls docs/drills/*.md | sort | tail -n 1)
          age=$(( ( $(date +%s) - $(date -d "$(basename "$latest" .md)" +%s) ) / 86400 ))
          minutes=$(grep -m1 '^minutes:' "$latest" | awk '{print $2}')
          echo "last drill $latest: $age days ago, $minutes minutes"
          test "$age" -le 92 && test "$minutes" -le {{RTO_MINUTES}}`,
    },
  ],
}

export default pack
