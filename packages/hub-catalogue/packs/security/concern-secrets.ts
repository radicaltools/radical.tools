import type { PackSpec } from '../../src/packSpec'

const FORCES = 'This element uses credentials (passwords, API keys, tokens, certificates) to reach databases and outside systems. The forces: credentials put in code, images, build logs or tickets are copied far more widely than anyone tracks, and git history keeps them after they are deleted; a credential shared between elements widens every leak; one that is never changed stays valid after the people who saw it have left; a person who can read every production secret is a target in their own right; and when one leaks it has to be revoked in minutes, without stopping the system and without guessing where else it was used. Snippets assume Kubernetes manifests rendered under manifests/ (workloads labelled app.kubernetes.io/part-of=shop in the production namespace), Terraform under infra/ read with terraform show -json, AWS as the platform where one is named, and GitHub as the code host.'
const ADRS = ['adr-manager', 'adr-identity', 'adr-env']
const STORED = { STORE: ['manager', 'identity'] }

const pack: PackSpec = {
  id: 'concern-secrets',
  name: 'Secrets',
  group: 'security',
  description: 'Credentials for databases and outside systems: where they are kept, who can read them, how often they change, how leaks are caught and what happens when one leaks.',
  tags: ['security', 'secrets', 'credentials', 'rotation', 'secret-scanning'],
  concern: {
    id: 'secrets',
    trigger: 'LIST RELATIONS WHERE source.external != true AND (target.type = "database" OR target.type = "queue" OR target.external = true) AND (source.type = "system" OR source.type = "container" OR source.type = "webapp" OR source.type = "component")',
    applyTo: 'source',
    why: 'these elements use credentials for databases, queues or outside systems, so where those are kept, who sees them and how they change has to be decided.',
  },
  sources: [
    { title: 'OWASP Secrets Management Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html' },
    { title: 'OWASP ASVS 4.0.3, V2.10 Service Authentication, V6.4 Secret Management, V7.1 Log Content', url: 'https://owasp.org/www-project-application-security-verification-standard/' },
    { title: 'NIST SP 800-57 Part 1 Rev. 5, Recommendation for Key Management (cryptoperiods)', url: 'https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final' },
    { title: 'Gitleaks', url: 'https://github.com/gitleaks/gitleaks' },
    { title: 'GitHub Docs: Secret scanning and push protection', url: 'https://docs.github.com/en/code-security/secret-scanning' },
  ],
  questions: [
    {
      key: 'STORE', title: 'Where kept', label: 'Where are the credentials kept?',
      hint: 'The best credential is one that does not exist; the next best is one kept in a single place that logs every read.',
      default: 'manager',
      options: [
        { value: 'manager', label: 'a secrets manager', description: 'HashiCorp Vault, AWS Secrets Manager, Azure Key Vault or Google Secret Manager: read at run time with the element\'s own identity, every read logged, rotation built in. Pick it when the element needs passwords or API keys that the platform cannot replace with an identity.' },
        { value: 'identity', label: 'the platform\'s workload identity', description: 'AWS IAM roles for service accounts, Azure managed identities, GCP workload identity, SPIFFE: short-lived tokens issued to the running element, nothing stored. Pick it when the databases and services it calls accept those identities (RDS/Aurora IAM auth, Azure SQL with Entra ID, Cloud SQL IAM); static keys of outside systems still go in a secrets manager.' },
        { value: 'env', label: 'environment variables set by the deployment', description: 'Values kept encrypted in the deployment\'s own store (Kubernetes Secrets with encryption at rest, Sealed Secrets, SOPS, the CI system\'s encrypted variables) and set at start. Pick it for a small system on a platform without a secrets manager; values show in process listings and crash dumps, and rotation is a redeploy by a person following a runbook, not by the store.' },
      ],
    },
    {
      key: 'ROTATION', title: 'Rotation', label: 'How are stored credentials rotated?',
      hint: 'A credential nobody can rotate without an outage is never rotated; the same goes for the leak response, which is a rotation under pressure.',
      default: 'automatic',
      options: [
        { value: 'automatic', label: 'automatically, by the store, with two valid versions during the switch', description: 'The store creates the new credential, the element picks it up, and the old one is revoked only when nothing uses it (AWS Secrets Manager rotation, Vault database secrets engine, Key Vault rotation policies). Pick it when the store and the target (database, cloud API) support it, which most do. Not with environment variables set by the deployment: that store rotates nothing.' },
        { value: 'runbook', label: 'by a person following a runbook', description: 'An owner rotates on a schedule, reminded by an alert, following written steps. Pick it for keys an outside system issues by hand (a partner portal, a payment provider), for credentials set by the deployment, or when the store cannot rotate them.' },
      ],
    },
    {
      key: 'ACCESS', title: 'Who may read', label: 'Who may read production secrets?',
      hint: 'Every person who can read a secret is a way to leak it; the fewer standing readers, the less a stolen laptop or a departure costs.',
      default: 'breakglass',
      options: [
        { value: 'breakglass', label: 'only the workloads; people through break-glass', description: 'No person has standing read access; in an emergency a person reads one secret after a second person approves, and that secret is rotated afterwards. Pick it for production with payment, health or personal data, or any regulated system.' },
        { value: 'jit', label: 'on-call engineers, just in time', description: 'Engineers request read access to one secret for a few hours, approved by a second person (Vault control groups, AWS IAM Identity Center temporary elevation, Entra PIM). Pick it when the team debugs production often enough that break-glass would become routine.' },
        { value: 'team', label: 'the owning team', description: 'Members of the team that owns the element can read its secrets, every read logged. Pick it for a small team without a second approver at hand, and accept rotating on every departure.' },
      ],
    },
    {
      key: 'SCANNING', title: 'Leak scanning', label: 'Where are leaked credentials caught?',
      hint: 'A secret pushed to a shared repository has leaked, even if the commit is reverted: catching it before the push is cheaper than revoking it after.',
      default: 'push',
      options: [
        { value: 'push', label: 'before the push, at the code host', description: 'The code host refuses a push that contains a secret (GitHub push protection, GitLab secret push protection), and CI scans as well. Pick it when your code host offers it; it stops the leak before anyone else has a copy.' },
        { value: 'ci', label: 'in CI, blocking the merge', description: 'Gitleaks or TruffleHog run on every pull request and the merge is blocked on a finding; developers may add the same scanner as a pre-commit hook. Pick it when the code host has no push protection; the secret has reached the server and must be rotated.' },
        { value: 'scheduled', label: 'in a scheduled scan of history and images', description: 'A nightly job scans the whole history, built images and CI logs and opens a finding for the owner. Pick it for an old repository with many findings to work through first; move to blocking once it is clean.' },
      ],
    },
  ],
  details: [
    { key: 'ROTATE_DAYS', label: 'How often are stored credentials rotated (days)?', default: '90', number: true },
    { key: 'REVOKE_MINUTES', label: 'How fast must an exposed credential stop working (minutes)?', default: '60', number: true },
  ],
  need: {
    label: 'Credentials stay secret',
    text: 'The system uses passwords, keys and tokens to reach its databases, queues and outside systems. They end up in code, images, logs, tickets and laptops; they are shared between elements and never changed; people who left can still read them; and when one leaks, nobody knows where else it was used or how to change it without an outage.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-no-repo', label: 'No credential in code', ears_type: 'ubiquitous',
      action: 'keep no credential in source code, its git history, container images, infrastructure state, CI output or application logs, and obtain each one at run time through {{STORE}}',
      rationale: 'Repositories, images and logs are copied far more widely than anyone tracks, and history keeps a secret after it is deleted (ASVS 2.10.4, 7.1.1; OWASP Secrets Management Cheat Sheet: Centralize and Standardize, CI/CD).',
      scenario: { label: 'Repository clean', given: 'the repository with its full history, the built images and the last day of CI logs', when: 'they are scanned with the secret scanner', then: '0 secrets are found outside the scanner\'s allow-list of test fixtures' },
    },
    {
      id: 'req-own', label: 'Own credentials per element', ears_type: 'ubiquitous',
      action: 'use credentials of its own in each environment, with only the rights it needs, shared with no other element and no person',
      rationale: 'A leak then reaches one element in one environment, with only what it may do; a shared credential cannot be revoked without stopping everyone who uses it (ASVS 1.2.1, 2.10.1; OWASP Secrets Management Cheat Sheet: Access Control).',
      scenario: { label: 'Nothing shared', given: 'the secrets every workload of the system may read', when: 'they are listed per workload', then: 'no secret is readable by two workloads, and none by a wildcard' },
    },
    {
      id: 'req-leak', label: 'Leaks revoked fast', ears_type: 'event-driven',
      trigger: 'a credential is found exposed (a scanner finding, a provider\'s leak notice, a report or a lost device)',
      action: 'revoke it within {{REVOKE_MINUTES}} minutes, put a new one in place without downtime, rotate the credentials kept beside it, and review every use of it since the exposure in the store\'s and the target\'s logs',
      rationale: 'Exposed credentials are found and used by automated scanners soon after they appear; a practised revocation is the only bound on the damage (OWASP Secrets Management Cheat Sheet: Incident Response, Revocation).',
      scenario: { label: 'Leaked key revoked', given: 'a production credential reported as pasted in a public place', when: 'the leak runbook is followed', then: 'within {{REVOKE_MINUTES}} minutes the credential no longer works, the element runs on its replacement with no failed requests, and its uses since the exposure are listed' },
      unchecked: 'a leak drill the element\'s owner runs once a quarter on a staging credential, timed against {{REVOKE_MINUTES}} minutes and recorded; no tool can run it.',
    },
    {
      id: 'req-audit', label: 'Secret access audited', ears_type: 'ubiquitous',
      action: 'record every read and change of a production secret by a person, with who, when, which secret and the approval, keep the records for at least 12 months, and never record the secret\'s value',
      rationale: 'After a leak, the record of who could and did read the secret decides what has to be rotated and who has to be asked (ASVS 6.4.1, 7.1.1).',
      scenario: { label: 'Read leaves a record', given: 'a production secret', when: 'a person reads it and changes it', then: 'the audit log holds both events with person, time, secret name and approval, and not the value' },
    },
    {
      id: 'req-manager', label: 'Read from the manager', when: { STORE: ['manager'] }, ears_type: 'event-driven',
      trigger: 'the element starts or its credential lease is about to expire',
      action: 'fetch the credential from the secrets manager with the element\'s own platform identity, keep it only in memory, and refresh it before it expires without a restart',
      rationale: 'The manager is the one place to audit, rotate and revoke only if the element reads from it rather than copying values into files or variables (OWASP Secrets Management Cheat Sheet: Centralize and Standardize, Handling Secrets in Memory).',
      scenario: { label: 'Credential refreshed', given: 'a running element whose database credential is replaced in the secrets manager', when: 'its lease expires', then: 'the element uses the new credential with no restart and no failed request, and nothing on its disk holds either value' },
    },
    {
      id: 'req-workload', label: 'Short-lived credentials', when: { STORE: ['identity'] }, ears_type: 'ubiquitous',
      action: 'authenticate to databases and cloud services with the platform\'s workload identity, using tokens that expire within 1 hour, and keep static keys only for outside systems that accept nothing else, in a secrets manager',
      rationale: 'A credential that expires within the hour is worth little when stolen and needs no rotation (OWASP Secrets Management Cheat Sheet: Secret Lifecycle, Expiration).',
      scenario: { label: 'No stored secret', given: 'the element\'s deployment manifests', when: 'every reference to a Secret is listed', then: 'only the allow-listed keys of outside systems appear; databases and cloud services are reached by the identity alone' },
    },
    {
      id: 'req-env', label: 'Variables never shown', when: { STORE: ['env'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the element logs its configuration, fails with a crash report or serves a diagnostic endpoint',
      action: 'leave out or mask every variable that holds a credential',
      rationale: 'Environment variables travel into crash dumps, debug pages and support bundles; masking is what keeps them from being logged (ASVS 7.1.1, 14.3.2; OWASP Secrets Management Cheat Sheet: Environment Variables).',
      scenario: { label: 'Crash hides secrets', given: 'the element running with its database password in an environment variable', when: 'it crashes and its configuration endpoint is called', then: 'neither the crash report nor the endpoint shows the password' },
    },
    {
      id: 'req-env-store', label: 'Deployment store encrypted', when: { STORE: ['env'] }, ears_type: 'ubiquitous',
      action: 'keep the values encrypted at rest in the deployment\'s store, so that the cluster\'s or the CI system\'s backing store never holds them in clear',
      rationale: 'A Kubernetes Secret is base64, not encryption; without envelope encryption anyone with the etcd backup has every credential (OWASP Secrets Management Cheat Sheet: Kubernetes).',
      scenario: { label: 'Store encrypted', given: 'the production cluster', when: 'its encryption configuration is read', then: 'Secrets are listed among the resources encrypted with a KMS key' },
    },
    {
      id: 'req-rotate-auto', label: 'Rotation is automatic', when: { ROTATION: ['automatic'] }, ears_type: 'event-driven',
      trigger: 'a stored credential is {{ROTATE_DAYS}} days old',
      action: 'create its successor, switch every instance to it, and revoke the old one only when nothing uses it, with 0 failed requests',
      rationale: 'A rotation nobody has to do gets done; two valid versions during the switch avoid the outage that makes teams postpone it (NIST SP 800-57 Pt 1, 5.3 Cryptoperiods; OWASP Secrets Management Cheat Sheet: Automate Secrets Management, Rotation).',
      scenario: { label: 'Rotation without downtime', given: 'a credential {{ROTATE_DAYS}} days old and traffic flowing', when: 'the store rotates it', then: 'no request fails and the old credential is refused afterwards' },
    },
    {
      id: 'req-rotate-runbook', label: 'Overdue rotation alerted', when: { ROTATION: ['runbook'] }, ears_type: 'state-driven',
      precondition: 'a stored credential is older than {{ROTATE_DAYS}} days',
      action: 'alert its named owner every working day until it is rotated by the runbook, which states the steps, the order and how to roll back',
      rationale: 'Rotation by hand happens only when someone is reminded and has written steps; the alert makes an overdue credential visible (NIST SP 800-57 Pt 1, 5.3).',
      scenario: { label: 'Overdue key alerted', given: 'a partner API key created {{ROTATE_DAYS}} days ago', when: 'the daily check runs', then: 'the owner is alerted, and the alert stops once the key is replaced by following the runbook' },
    },
    {
      id: 'req-breakglass', label: 'People read via break-glass', when: { ACCESS: ['breakglass'] }, ears_type: 'event-driven',
      trigger: 'a person requests to read a production secret',
      action: 'allow it only through the break-glass procedure, after a second person approves, alert the security channel within 5 minutes of the read, and rotate the secret within 24 hours',
      rationale: 'With no standing human readers, a stolen laptop or a departure exposes nothing; the rotation afterwards makes the emergency read harmless (OWASP Secrets Management Cheat Sheet: Access Control).',
      scenario: { label: 'Emergency read', given: 'an engineer without access to production secrets', when: 'they read one through break-glass with a second person\'s approval', then: 'the security channel is alerted within 5 minutes and the secret is rotated within 24 hours' },
    },
    {
      id: 'req-jit', label: 'Access granted just in time', when: { ACCESS: ['jit'] }, ears_type: 'event-driven',
      trigger: 'an on-call engineer requests read access to a production secret',
      action: 'grant access to that one secret for at most 4 hours after a second person approves, withdraw it automatically when the time is up, and alert the security channel within 5 minutes of each read',
      rationale: 'Access that ends by itself does not pile up; the approval puts a second pair of eyes on every read (OWASP Secrets Management Cheat Sheet: Access Control).',
      scenario: { label: 'Access expires', given: 'an on-call engineer granted read access to one secret', when: 'they read it, and 4 hours pass', then: 'the read is alerted within 5 minutes, and afterwards the engineer can no longer read it, and could never read any other secret' },
    },
    {
      id: 'req-team', label: 'Rotated when people leave', when: { ACCESS: ['team'] }, ears_type: 'event-driven',
      trigger: 'a person who could read the element\'s production secrets leaves the team',
      action: 'withdraw their access the same day and rotate every secret they could read within 7 days',
      rationale: 'Standing access means every former member still knows the secrets; rotating on departure is the price of that access (OWASP Secrets Management Cheat Sheet: Rotation, Access Control).',
      scenario: { label: 'Departure rotates', given: 'a team member who could read three production secrets', when: 'they leave the team', then: 'their access is gone that day and all three secrets are replaced within 7 days' },
      unchecked: 'the leaver checklist the team lead runs on the day of each departure (access withdrawn, secrets rotated within 7 days), confirmed by the quarterly access review; departures are known to people, not to a tool.',
    },
    {
      id: 'req-scan-push', label: 'Secrets refused at push', when: { SCANNING: ['push'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a push to the code host contains a credential',
      action: 'refuse the push and name the file and line, and record any bypass with its reason for review within 1 day',
      rationale: 'A secret refused before the push never reaches a shared copy and needs no rotation (GitHub Docs, push protection; OWASP Secrets Management Cheat Sheet: Detection).',
      scenario: { label: 'Push refused', given: 'a commit that adds a cloud access key to a configuration file', when: 'it is pushed, and once pushed with a bypass', then: 'the code host refuses it and names the file and line; the bypass is an alert that is reviewed within 1 day' },
    },
    {
      id: 'req-scan-ci', label: 'Secrets block the merge', when: { SCANNING: ['ci'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request adds a credential in any of its commits',
      action: 'fail its required check so that it cannot merge, and treat the credential as exposed',
      rationale: 'Without push protection the secret has reached the server, so the merge gate keeps it out of the main line and the leak runbook revokes it (OWASP Secrets Management Cheat Sheet: Detection; Gitleaks).',
      scenario: { label: 'Merge blocked', given: 'a pull request whose second commit adds a database password and whose third removes it', when: 'its checks run', then: 'the secret check fails and the pull request cannot merge' },
    },
    {
      id: 'req-scan-scheduled', label: 'Leaks found within a day', when: { SCANNING: ['scheduled'] }, ears_type: 'event-driven',
      trigger: 'a credential is committed, built into an image or written to a CI log',
      action: 'report it to the element\'s owner by the next nightly scan, and have it revoked or recorded as a false positive before the scan after that',
      rationale: 'A scheduled scan over the whole history finds what was there before scanning began; the deadline turns findings into revocations (OWASP Secrets Management Cheat Sheet: Detection).',
      scenario: { label: 'Nightly scan reports', given: 'a credential committed to a branch during the day', when: 'the nightly scan runs, and the next one', then: 'the owner has a finding by the morning naming the commit and file, and the second scan fails while it is not revoked or recorded' },
    },
  ],
  adrs: [
    {
      id: 'adr-manager', label: 'Credentials in a secrets manager', when: { STORE: ['manager'] },
      decision: 'Credentials are kept in a secrets manager and read at run time with the element\'s own platform identity; each element has its own in each environment, with only the rights it needs. Rotation: {{ROTATION}}, at least every {{ROTATE_DAYS}} days; an exposed credential stops working within {{REVOKE_MINUTES}} minutes. Production secrets may be read by {{ACCESS}}. Leaked credentials are caught {{SCANNING}}. Choosing the manager: the one the platform offers (AWS Secrets Manager, Azure Key Vault, Google Secret Manager) when the system runs on one cloud; HashiCorp Vault or OpenBao when it spans clouds or on-premises, or needs dynamic database credentials; judge by rotation support for the databases used, audit log export and cost per secret and per call.',
      consequences: '• One place to audit reads, rotate and revoke.\n• The secrets manager is on the start path: elements cache credentials in memory and survive its short outages.\n• Rotation needs elements that pick up a new credential without restarting, or rolling restarts.\n• Local development needs its own secrets, never copies of production ones.',
      alternatives: '1. Workload identity: nothing stored at all, but every database and service used must accept it.\n2. Environment variables from the deployment: no extra service, but values leak into dumps and change only with a redeploy.\n3. Encrypted files in the repository (SOPS, git-crypt): versioned with the code, but every reader of the key reads every secret and history keeps old values.',
    },
    {
      id: 'adr-identity', label: 'Workload identity, no stored secrets', when: { STORE: ['identity'] },
      decision: 'Elements authenticate with the platform\'s workload identity (IAM roles for service accounts, Azure managed identities, GCP workload identity federation, or SPIFFE/SPIRE across platforms) and get tokens that expire within an hour; no password or key is stored for databases and cloud services. Each identity has only the rights its element needs. Outside systems that need a static key are the exception: those keys live in the platform\'s secrets manager, on an allow-list, rotated at least every {{ROTATE_DAYS}} days ({{ROTATION}}, where the issuer allows it; a key a partner issues by hand follows its runbook). Exposed keys stop working within {{REVOKE_MINUTES}} minutes. Production secrets may be read by {{ACCESS}}. Leaked credentials are caught {{SCANNING}}.',
      consequences: '• Nothing long-lived to leak or rotate for databases and cloud services.\n• Needs support in the platform and in every database and service used; some (older drivers, third-party SaaS) do not have it.\n• Local development needs identities of its own, for example per developer through the cloud CLI.\n• Rights are reviewed in the platform\'s policies, which become as important as the code.',
      alternatives: '1. A secrets manager for every credential: works with anything, but every credential is a stored secret to rotate.\n2. Environment variables from the deployment: simplest, and the weakest.',
    },
    {
      id: 'adr-env', label: 'Credentials in the deployment', when: { STORE: ['env'] },
      decision: 'Credentials are kept encrypted in the deployment\'s store (Kubernetes Secrets with encryption at rest, Sealed Secrets or SOPS-encrypted manifests, or the CI system\'s encrypted variables) and set as environment variables at start; each element has its own, with only the rights it needs, and masks them in logs, crash reports and diagnostics. Rotation: {{ROTATION}}, at least every {{ROTATE_DAYS}} days, with a rolling redeploy that records the rotation on the Secret; an exposed credential stops working within {{REVOKE_MINUTES}} minutes. Production secrets may be read by {{ACCESS}}. Leaked credentials are caught {{SCANNING}}. Move to a secrets manager when there are more than a handful of credentials or rotation by redeploy becomes a burden.',
      consequences: '• No extra service to run or pay for.\n• Values show in process listings, crash dumps and to anyone who can describe the deployment.\n• Rotation means a redeploy, and there is no central log of who read what beyond the platform\'s audit log.',
      alternatives: '1. A secrets manager: central audit and rotation, one more service on the start path.\n2. Workload identity: nothing stored, needs platform and database support.',
    },
  ],
  fitness: [
    {
      id: 'ff-scan-push', label: 'Push protection on', when: { SCANNING: ['push'] }, category: 'process', implements: ADRS, checks: ['req-scan-push'],
      threshold: '100 % of the organisation\'s repositories have secret scanning and push protection enabled; 0 open alerts created by a bypass more than 1 day ago',
      description: 'A scheduled job lists the organisation\'s repositories through the GitHub API and fails when one has secret scanning or push protection turned off; it then lists the open secret scanning alerts that came from a bypass and fails on one older than a day, which is a bypass nobody has reviewed and resolved.',
      tool: 'GitHub CLI against the GitHub REST API (for GitLab: the secret push protection setting and its audit events, read from its API the same way)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
gh api --paginate "/orgs/$ORG/repos?per_page=100" \\
  --jq '.[] | select(.archived | not)
        | select(.security_and_analysis.secret_scanning.status != "enabled"
              or .security_and_analysis.secret_scanning_push_protection.status != "enabled")
        | .full_name' > unprotected.txt
test ! -s unprotected.txt || { echo "repositories without secret scanning or push protection:"; cat unprotected.txt; exit 1; }

gh api --paginate "/orgs/$ORG/secret-scanning/alerts?state=open&is_bypassed=true&per_page=100" \\
  --jq '.[] | select((.push_protection_bypassed_at | fromdateiso8601) < (now - 86400))
        | "\\(.repository.full_name) #\\(.number) bypassed by \\(.push_protection_bypassed_by.login) at \\(.push_protection_bypassed_at)"' > unreviewed.txt
test ! -s unreviewed.txt || { echo "bypasses older than a day, not reviewed:"; cat unreviewed.txt; exit 1; }`,
    },
    {
      id: 'ff-scan-ci', label: 'Secret scan in CI', when: { SCANNING: ['push', 'ci'] }, category: 'structural', implements: ADRS, checks: ['req-scan-ci', 'req-no-repo'],
      threshold: '0 secrets found in the commits of a pull request; the check is required for merging',
      description: 'Gitleaks scans every commit of each pull request and is a required status check, so a pull request that adds a secret, even one removed in a later commit, cannot merge.',
      tool: 'Gitleaks',
      language: 'yaml',
      snippet: `# .github/workflows/secrets.yml
name: secrets
on: [pull_request]
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
        with: { fetch-depth: 0 }
      - name: Scan the pull request's commits
        run: |
          docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.27.2 \\
            git /repo --log-opts="origin/\${{ github.base_ref }}..HEAD" --redact --exit-code 1`,
    },
    {
      id: 'ff-scan-history', label: 'Nightly history, logs and images', when: { SCANNING: ['scheduled'] }, category: 'process', implements: ADRS, checks: ['req-scan-scheduled', 'req-no-repo'],
      threshold: 'The nightly job fails on every finding in the git history, the previous day\'s CI logs or the built images that is not yet closed; a finding is closed by revoking the secret and recording its fingerprint with the review, so none stays open past the next run',
      description: 'A nightly job scans the full git history and the previous day\'s CI logs with Gitleaks and the latest built images with TruffleHog; a finding is closed by revoking the credential and adding its fingerprint to .gitleaksignore (a false positive, likewise), so the job keeps failing, and the owner keeps being told, until that happens.',
      tool: 'Gitleaks and TruffleHog with the GitHub CLI',
      language: 'yaml',
      snippet: `# .github/workflows/secrets-nightly.yml
name: secrets-nightly
on:
  schedule: [{ cron: '0 2 * * *' }]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.2.2   # pin by commit SHA in your repository
        with: { fetch-depth: 0 }
      - name: Git history (closed findings are in .gitleaksignore with their review)
        run: docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.27.2 git /repo --redact --exit-code 1
      - name: Yesterday's CI logs
        env: { GH_TOKEN: "\${{ github.token }}" }
        run: |
          mkdir -p ci-logs
          for id in $(gh run list --created "$(date -u -d yesterday +%F)" --limit 200 --json databaseId --jq '.[].databaseId'); do
            gh run view "$id" --log > "ci-logs/$id.txt" || true
          done
          docker run --rm -v "$PWD/ci-logs:/logs" zricethezav/gitleaks:v8.27.2 dir /logs --redact --exit-code 1
      - name: Built images
        run: docker run --rm trufflesecurity/trufflehog:3.99.7 docker --image "$IMAGE" --only-verified --fail`,
    },
    {
      id: 'ff-age-manager', label: 'No secret past its rotation period', when: STORED, category: 'operational', implements: ['adr-manager', 'adr-identity'], checks: ['req-rotate-runbook'],
      threshold: '0 secrets in the secrets manager last rotated more than {{ROTATE_DAYS}} days ago',
      description: 'AWS Config evaluates every secret in AWS Secrets Manager and reports one not rotated within {{ROTATE_DAYS}} days, whether the store or a person rotates it; the non-compliant list is the daily alert to the owners.',
      tool: 'AWS Config managed rule SECRETSMANAGER_SECRET_PERIODIC_ROTATION (for Vault: a scheduled job over the secrets\' metadata updated_time; for Key Vault: the secrets\' attributes.updated)',
      language: 'hcl',
      snippet: `resource "aws_config_config_rule" "secret_rotated" {
  name = "secret-rotated-within-{{ROTATE_DAYS}}-days"
  source {
    owner             = "AWS"
    source_identifier = "SECRETSMANAGER_SECRET_PERIODIC_ROTATION"
  }
  input_parameters = jsonencode({ maxDaysSinceRotation = "{{ROTATE_DAYS}}" })
}`,
    },
    {
      id: 'ff-rotation-enabled', label: 'Rotation is on', when: { STORE: ['manager', 'identity'], ROTATION: ['automatic'] }, category: 'operational', implements: ['adr-manager', 'adr-identity'], checks: ['req-rotate-auto'],
      threshold: '0 secrets in the secrets manager without automatic rotation configured',
      description: 'AWS Config reports every secret in AWS Secrets Manager that has no rotation configured, which with automatic rotation decided means a secret that will never be rotated.',
      tool: 'AWS Config managed rule SECRETSMANAGER_ROTATION_ENABLED_CHECK (for Vault: a scheduled job over the database secrets engine roles; for Key Vault: az keyvault secret show, the rotation policy)',
      language: 'hcl',
      snippet: `resource "aws_config_config_rule" "secret_rotation_enabled" {
  name = "secret-rotation-enabled"
  source {
    owner             = "AWS"
    source_identifier = "SECRETSMANAGER_ROTATION_ENABLED_CHECK"
  }
}`,
    },
    {
      id: 'ff-refresh', label: 'Rotation without a restart', when: { STORE: ['manager'] }, category: 'operational', implements: ['adr-manager'], checks: ['req-manager', 'req-rotate-auto'],
      threshold: 'With traffic flowing, a new secret version put in the manager is in use before the old credential is revoked; 0 failed requests and 0 restarts; nothing on the element\'s disk holds either value',
      description: 'An integration test runs the element against a database and a secrets manager in containers, keeps requests flowing, puts a new credential version (the alternate database user, as a rotation does), waits one lease, revokes the old credential and counts failures; it then searches the container\'s file system for both values.',
      tool: 'Vitest with Testcontainers (PostgreSQL, LocalStack Secrets Manager) (or the test runner of your stack)',
      language: 'ts',
      snippet: `import { SecretsManagerClient, PutSecretValueCommand } from '@aws-sdk/client-secrets-manager'

it('picks up a rotated credential without a restart or a failed request', async () => {
  const sm = new SecretsManagerClient({ endpoint: localstack.getConnectionUri() })   // the element reads shop/db from here
  const traffic = keepCalling(element, '/orders', { seconds: 3 * LEASE_SECONDS })   // continuous requests, counts failures
  await sm.send(new PutSecretValueCommand({ SecretId: 'shop/db', SecretString: JSON.stringify({ user: 'shop_b', password: 'rotated' }) }))
  await sleep((LEASE_SECONDS + 1) * 1000)
  await db.query("alter user shop_a with password 'revoked'")                          // the old credential stops working
  const { failed, restarts } = await traffic
  expect(failed).toBe(0)
  expect(restarts).toBe(0)
  const disk = await element.exec(['grep', '-rl', '-e', 'rotated', '-e', 'revoked', '/'])
  expect(disk.output.trim()).toBe('')
})`,
    },
    {
      id: 'ff-no-static', label: 'No stored database secrets', when: { STORE: ['identity'] }, category: 'structural', implements: ['adr-identity'], checks: ['req-workload'],
      threshold: '0 workloads (Deployments, StatefulSets, DaemonSets, Jobs, CronJobs) that take a credential from a Kubernetes Secret through env, envFrom or a volume, outside the allow-list of outside-system keys',
      description: 'A Conftest policy over the rendered manifests fails when a workload reads an environment variable, an environment block or a volume from a Secret that is not on the allow-list, which would mean a stored credential came back.',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `# conftest test --combine manifests/
package main

import rego.v1

allowed := {"partner-api-key"}   # keys of outside systems that accept nothing else

docs contains d if { some f in input; is_array(f.contents); some d in f.contents }
docs contains d if { some f in input; not is_array(f.contents); d := f.contents }

podspec(d) := d.spec.template.spec if d.kind in {"Deployment", "StatefulSet", "DaemonSet", "Job"}
podspec(d) := d.spec.jobTemplate.spec.template.spec if d.kind == "CronJob"

secrets_of(d) := union({
  {s | some c in podspec(d).containers; some e in c.env; s := e.valueFrom.secretKeyRef.name},
  {s | some c in podspec(d).containers; some e in c.envFrom; s := e.secretRef.name},
  {s | some v in podspec(d).volumes; s := v.secret.secretName},
})

deny contains msg if {
  some d in docs
  some s in secrets_of(d)
  not allowed[s]
  msg := sprintf("%s %s reads secret %s: use the workload identity", [d.kind, d.metadata.name, s])
}`,
    },
    {
      id: 'ff-age-env', label: 'Deployment secrets rotated', when: { STORE: ['env'] }, category: 'operational', implements: ['adr-env'], checks: ['req-rotate-auto', 'req-rotate-runbook'],
      threshold: '0 Secrets in the production namespace rotated (or, never rotated, created) more than {{ROTATE_DAYS}} days ago',
      description: 'A scheduled job lists the Kubernetes Secrets the elements read and fails on any whose rotation annotation (written by the rotation runbook or pipeline on every rotation; the creation time counts when there is none) is older than {{ROTATE_DAYS}} days; the list is the daily alert to the owners.',
      tool: 'kubectl and jq',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
max_age=$(( {{ROTATE_DAYS}} * 86400 ))
# the rotation writes the annotation secrets.acme.io/rotated-at (RFC 3339) on the Secret it replaces in place
kubectl get secrets -n production -l app.kubernetes.io/part-of=shop -o json \\
  | jq -r --argjson max "$max_age" '.items[]
      | ((.metadata.annotations["secrets.acme.io/rotated-at"] // .metadata.creationTimestamp) | fromdateiso8601) as $rotated
      | select((now - $rotated) > $max)
      | .metadata.name' > stale.txt
test ! -s stale.txt || { echo "Secrets past rotation:"; cat stale.txt; exit 1; }`,
    },
    {
      id: 'ff-human-reads', label: 'Human reads alerted', when: { ACCESS: ['breakglass', 'jit'] }, category: 'operational', implements: ADRS, checks: ['req-audit', 'req-breakglass', 'req-jit'],
      threshold: '100 % of reads of a production secret by a person raise an alert within 5 minutes to the security channel, where each is matched with its approval; the trail that records them is kept for 400 days',
      description: 'A CloudWatch Logs metric filter on the CloudTrail log group counts GetSecretValue calls by anything but the workloads\' roles (an IAM user, or an assumed role not named workload-*; read-only events never reach EventBridge, so the log group is the source) and an alarm with a one-minute period pages the security channel; the log group keeps 400 days. On Vault, the audit device feeds the same alert.',
      tool: 'AWS CloudTrail delivered to CloudWatch Logs, a metric filter and an alarm (Terraform); for Vault: the audit device and the same alert in your log system',
      language: 'hcl',
      snippet: `resource "aws_cloudwatch_log_group" "cloudtrail" {
  name              = "cloudtrail"
  retention_in_days = 400
}

resource "aws_cloudwatch_log_metric_filter" "human_secret_reads" {
  name           = "human-secret-reads"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name   # the trail delivers management events here
  pattern        = "{ ($.eventSource = \\"secretsmanager.amazonaws.com\\") && ($.eventName = \\"GetSecretValue\\") && (($.userIdentity.type = \\"IAMUser\\") || (($.userIdentity.type = \\"AssumedRole\\") && ($.userIdentity.sessionContext.sessionIssuer.userName != \\"workload-*\\"))) }"
  metric_transformation {
    name      = "HumanSecretReads"
    namespace = "Secrets"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "human_secret_read" {
  alarm_name          = "human-secret-read"
  namespace           = "Secrets"
  metric_name         = "HumanSecretReads"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.security_channel.arn]   # each alert is matched with its approval
}`,
    },
    {
      id: 'ff-read-log', label: 'Team reads logged and reported', when: { ACCESS: ['team'] }, category: 'operational', implements: ADRS, checks: ['req-audit'],
      threshold: 'Every read of a production secret by a person is in the trail with who, when and which secret; the trail is kept for 400 days; the owning team gets the day\'s reads every morning',
      description: 'A CloudWatch Logs metric filter on the CloudTrail log group counts GetSecretValue calls by people (an IAM user, or an assumed role not named workload-*), a daily alarm reports them to the team\'s channel, and the log group keeps 400 days. On Vault, the audit device feeds the same report.',
      tool: 'AWS CloudTrail delivered to CloudWatch Logs, a metric filter and a daily alarm (Terraform); for Vault: the audit device and a daily query in your log system',
      language: 'hcl',
      snippet: `resource "aws_cloudwatch_log_group" "cloudtrail" {
  name              = "cloudtrail"
  retention_in_days = 400
}

resource "aws_cloudwatch_log_metric_filter" "human_secret_reads" {
  name           = "human-secret-reads"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ ($.eventSource = \\"secretsmanager.amazonaws.com\\") && ($.eventName = \\"GetSecretValue\\") && (($.userIdentity.type = \\"IAMUser\\") || (($.userIdentity.type = \\"AssumedRole\\") && ($.userIdentity.sessionContext.sessionIssuer.userName != \\"workload-*\\"))) }"
  metric_transformation {
    name      = "HumanSecretReads"
    namespace = "Secrets"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "daily_secret_reads" {
  alarm_name          = "secret-reads-yesterday"
  namespace           = "Secrets"
  metric_name         = "HumanSecretReads"
  statistic           = "Sum"
  period              = 86400
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.team_channel.arn]   # the team reads the list each morning
}`,
    },
    {
      id: 'ff-own-manager', label: 'No secret shared between workloads', when: STORED, category: 'structural', implements: ['adr-manager', 'adr-identity'], checks: ['req-own'],
      threshold: '0 secrets readable by two IAM policies in the plan; 0 policies that may read secrets by wildcard',
      description: 'A Conftest policy over the Terraform plan parses every IAM policy document, collects the secret ARNs each may GetSecretValue on, and fails when one ARN appears in two policies (two workloads sharing a credential) or when a policy reads by wildcard.',
      tool: 'Conftest (Open Policy Agent) over terraform show -json (AWS; for Vault: the policies\' path grants, for Key Vault: RBAC assignments, checked the same way)',
      language: 'rego',
      snippet: `package main

import rego.v1

as_set(x) := {x} if is_string(x)
as_set(x) := {v | some v in x} if is_array(x)

policies contains rc if {
  some rc in input.resource_changes
  rc.type in {"aws_iam_role_policy", "aws_iam_policy"}
  is_string(rc.change.after.policy)
}

reads(rc) := {r |
  some s in json.unmarshal(rc.change.after.policy).Statement
  s.Effect == "Allow"
  some a in as_set(s.Action)
  a in {"secretsmanager:GetSecretValue", "secretsmanager:*"}
  some r in as_set(s.Resource)
}

deny contains msg if {
  some rc in policies
  some r in reads(rc)
  contains(r, "*")
  msg := sprintf("%s may read secrets by wildcard %s", [rc.address, r])
}

deny contains msg if {
  some a in policies
  some b in policies
  a.address < b.address
  some r in reads(a) & reads(b)
  msg := sprintf("secret %s is readable by both %s and %s", [r, a.address, b.address])
}`,
    },
    {
      id: 'ff-own-env', label: 'No Secret shared between workloads', when: { STORE: ['env'] }, category: 'structural', implements: ['adr-env'], checks: ['req-own'],
      threshold: '0 Kubernetes Secrets referenced (env, envFrom or volume) by two workloads in the rendered manifests',
      description: 'A Conftest policy over all rendered manifests at once collects the Secrets each workload references and fails when two workloads reference the same one, which is a credential shared between elements.',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `# conftest test --combine manifests/
package main

import rego.v1

docs contains d if { some f in input; is_array(f.contents); some d in f.contents }
docs contains d if { some f in input; not is_array(f.contents); d := f.contents }

podspec(d) := d.spec.template.spec if d.kind in {"Deployment", "StatefulSet", "DaemonSet", "Job"}
podspec(d) := d.spec.jobTemplate.spec.template.spec if d.kind == "CronJob"

secrets_of(d) := union({
  {s | some c in podspec(d).containers; some e in c.env; s := e.valueFrom.secretKeyRef.name},
  {s | some c in podspec(d).containers; some e in c.envFrom; s := e.secretRef.name},
  {s | some v in podspec(d).volumes; s := v.secret.secretName},
})

name(d) := sprintf("%s/%s/%s", [object.get(d.metadata, "namespace", "default"), d.kind, d.metadata.name])

deny contains msg if {
  some a in docs
  some b in docs
  name(a) < name(b)
  some s in secrets_of(a) & secrets_of(b)
  msg := sprintf("secret %s is used by both %s and %s", [s, name(a), name(b)])
}`,
    },
    {
      id: 'ff-env-masked', label: 'Variables masked', when: { STORE: ['env'] }, category: 'structural', implements: ['adr-env'], checks: ['req-env'],
      threshold: 'The configuration endpoint, a crash report and the captured logs contain 0 occurrences of a credential\'s value',
      description: 'A test runs the element with a known password in its environment, reads the configuration endpoint, provokes a crash report and searches both and the captured logs for the value.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../src/app'

it('shows no credential in the configuration endpoint, crash reports or logs', async () => {
  const password = process.env.DB_PASSWORD!
  const res = await request(app).get('/internal/config').expect(200)
  expect(JSON.stringify(res.body)).not.toContain(password)
  const report = await crashReportOf(() => { throw new Error('simulated crash') })   // the element's crash report handler
  expect(report).not.toContain(password)
  expect(capturedLogs()).not.toContain(password)
})`,
    },
    {
      id: 'ff-env-encrypted', label: 'Deployment store encrypted', when: { STORE: ['env'] }, category: 'structural', implements: ['adr-env'], checks: ['req-env-store'],
      threshold: 'The production cluster lists secrets among the resources encrypted with a KMS key; the check fails otherwise',
      description: 'A scheduled job reads the cluster\'s encryption configuration and fails when Kubernetes Secrets are not envelope-encrypted with a KMS key.',
      tool: 'AWS CLI for EKS (for GKE: gcloud container clusters describe, databaseEncryption.state must be ENCRYPTED; for AKS: az aks show, securityProfile.azureKeyVaultKms.enabled; for Sealed Secrets or SOPS: the plain Secret never exists in git, which the secret scan checks)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
aws eks describe-cluster --name "$CLUSTER" --query 'cluster.encryptionConfig[].resources[]' --output text | grep -qw secrets \\
  || { echo "cluster $CLUSTER does not encrypt Secrets at rest with a KMS key"; exit 1; }`,
    },
  ],
}

export default pack
