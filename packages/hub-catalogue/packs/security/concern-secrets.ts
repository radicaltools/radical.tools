import type { PackSpec } from '../../src/packSpec'

const FORCES = 'This element uses credentials (passwords, API keys, tokens, certificates) to reach databases and outside systems. The forces: credentials put in code, images, build logs or tickets are copied far more widely than anyone tracks, and git history keeps them after they are deleted; a credential shared between elements widens every leak; one that is never changed stays valid after the people who saw it have left; a person who can read every production secret is a target in their own right; and when one leaks it has to be revoked in minutes, without stopping the system and without guessing where else it was used.'
const ADRS = ['adr-manager', 'adr-identity', 'adr-env']

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
        { value: 'env', label: 'environment variables set by the deployment', description: 'Values kept encrypted in the deployment\'s own store (Kubernetes Secrets with encryption at rest, Sealed Secrets, SOPS, the CI system\'s encrypted variables) and set at start. Pick it for a small system on a platform without a secrets manager; values show in process listings and crash dumps and change only with a redeploy.' },
      ],
    },
    {
      key: 'ROTATION', title: 'Rotation', label: 'How are stored credentials rotated?',
      hint: 'A credential nobody can rotate without an outage is never rotated; the same goes for the leak response, which is a rotation under pressure.',
      default: 'automatic',
      options: [
        { value: 'automatic', label: 'automatically, by the store, with two valid versions during the switch', description: 'The store creates the new credential, the element picks it up, and the old one is revoked only when nothing uses it (AWS Secrets Manager rotation, Vault database secrets engine, Key Vault rotation policies). Pick it when the store and the target (database, cloud API) support it, which most do.' },
        { value: 'runbook', label: 'by a person following a runbook', description: 'An owner rotates on a schedule, reminded by an alert, following written steps. Pick it for keys an outside system issues by hand (a partner portal, a payment provider) or when the store cannot rotate them.' },
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
      action: 'keep no credential in source code, its git history, container images, infrastructure state, CI output or application logs, and load each one at run time from {{STORE}}',
      rationale: 'Repositories, images and logs are copied far more widely than anyone tracks, and history keeps a secret after it is deleted (ASVS 2.10.4, 7.1.1; OWASP Secrets Management Cheat Sheet: Centralize and Standardize, CI/CD).',
      scenario: { label: 'Repository clean', given: 'the repository with its full history, the built images and the last 30 days of CI logs', when: 'they are scanned with the secret scanner', then: '0 secrets are found outside the scanner\'s allow-list of test fixtures' },
    },
    {
      id: 'req-own', label: 'Own credentials per element', ears_type: 'ubiquitous',
      action: 'use credentials of its own in each environment, with only the rights it needs, shared with no other element and no person',
      rationale: 'A leak then reaches one element in one environment, with only what it may do; a shared credential cannot be revoked without stopping everyone who uses it (ASVS 1.2.1, 2.10.1; OWASP Secrets Management Cheat Sheet: Access Control).',
      scenario: { label: 'Narrow rights', given: 'the element\'s production database credential', when: 'it is used to read a table the element does not use, and to connect to the staging database', then: 'both are refused' },
    },
    {
      id: 'req-leak', label: 'Leaks revoked fast', ears_type: 'event-driven',
      trigger: 'a credential is found exposed (a scanner finding, a provider\'s leak notice, a report or a lost device)',
      action: 'revoke it within {{REVOKE_MINUTES}} minutes, put a new one in place without downtime, rotate the credentials kept beside it, and review every use of it since the exposure in the store\'s and the target\'s logs',
      rationale: 'Exposed credentials are found and used by automated scanners soon after they appear; a practised revocation is the only bound on the damage (OWASP Secrets Management Cheat Sheet: Incident Response, Revocation).',
      scenario: { label: 'Leaked key revoked', given: 'a production credential reported as pasted in a public place', when: 'the leak runbook is followed', then: 'within {{REVOKE_MINUTES}} minutes the credential no longer works, the element runs on its replacement with no failed requests, and its uses since the exposure are listed' },
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
      scenario: { label: 'No stored secret', given: 'the element\'s deployment manifests and running configuration', when: 'they are listed', then: 'they hold no password or key, only the identity, and the tokens it uses expire within 1 hour' },
    },
    {
      id: 'req-env', label: 'Variables never shown', when: { STORE: ['env'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the element logs its configuration, fails with a crash report or serves a diagnostic endpoint',
      action: 'leave out or mask every variable that holds a credential, and keep the values encrypted at rest in the deployment\'s store',
      rationale: 'Environment variables travel into crash dumps, debug pages and support bundles; masking is what keeps them from being logged (ASVS 7.1.1, 14.3.2; OWASP Secrets Management Cheat Sheet: Environment Variables).',
      scenario: { label: 'Crash hides secrets', given: 'the element running with its database password in an environment variable', when: 'it crashes and its configuration endpoint is called', then: 'neither the crash report nor the endpoint shows the password' },
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
      id: 'req-breakglass', label: 'People read via break-glass', when: { ACCESS: ['breakglass'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a person needs to read a production secret',
      action: 'allow it only through the break-glass procedure, after a second person approves, alert the security channel within 5 minutes, and rotate the secret within 24 hours',
      rationale: 'With no standing human readers, a stolen laptop or a departure exposes nothing; the rotation afterwards makes the emergency read harmless (OWASP Secrets Management Cheat Sheet: Access Control).',
      scenario: { label: 'Emergency read', given: 'an engineer without access to production secrets', when: 'they read one through break-glass with a second person\'s approval', then: 'the security channel is alerted within 5 minutes and the secret is rotated within 24 hours' },
    },
    {
      id: 'req-jit', label: 'Access granted just in time', when: { ACCESS: ['jit'] }, ears_type: 'event-driven',
      trigger: 'an on-call engineer requests read access to a production secret',
      action: 'grant access to that one secret for at most 4 hours after a second person approves, and withdraw it automatically when the time is up',
      rationale: 'Access that ends by itself does not pile up; the approval puts a second pair of eyes on every read (OWASP Secrets Management Cheat Sheet: Access Control).',
      scenario: { label: 'Access expires', given: 'an on-call engineer granted read access to one secret', when: '4 hours have passed', then: 'the engineer can no longer read it, and could never read any other secret' },
    },
    {
      id: 'req-team', label: 'Rotated when people leave', when: { ACCESS: ['team'] }, ears_type: 'event-driven',
      trigger: 'a person who could read the element\'s production secrets leaves the team',
      action: 'withdraw their access the same day and rotate every secret they could read within 7 days',
      rationale: 'Standing access means every former member still knows the secrets; rotating on departure is the price of that access (OWASP Secrets Management Cheat Sheet: Rotation, Access Control).',
      scenario: { label: 'Departure rotates', given: 'a team member who could read three production secrets', when: 'they leave the team', then: 'their access is gone that day and all three secrets are replaced within 7 days' },
    },
    {
      id: 'req-scan-push', label: 'Secrets refused at push', when: { SCANNING: ['push'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a push to the code host contains a credential',
      action: 'refuse the push and name the file and line, and record any bypass with its reason for review within 1 working day',
      rationale: 'A secret refused before the push never reaches a shared copy and needs no rotation (GitHub Docs, push protection; OWASP Secrets Management Cheat Sheet: Detection).',
      scenario: { label: 'Push refused', given: 'a commit that adds a cloud access key to a configuration file', when: 'it is pushed', then: 'the code host refuses it and names the file and line' },
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
      action: 'report it to the element\'s owner within 24 hours, and have it revoked or marked as a false positive within 1 working day of the report',
      rationale: 'A scheduled scan over the whole history finds what was there before scanning began; the deadline turns findings into revocations (OWASP Secrets Management Cheat Sheet: Detection).',
      scenario: { label: 'Nightly scan reports', given: 'a credential committed to a branch during the day', when: 'the nightly scan runs', then: 'the owner has a finding by the next morning naming the commit and file' },
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
      decision: 'Elements authenticate with the platform\'s workload identity (IAM roles for service accounts, Azure managed identities, GCP workload identity federation, or SPIFFE/SPIRE across platforms) and get tokens that expire within an hour; no password or key is stored for databases and cloud services. Each identity has only the rights its element needs. Outside systems that need a static key are the exception: those keys live in the platform\'s secrets manager, rotation: {{ROTATION}}, at least every {{ROTATE_DAYS}} days. Exposed keys stop working within {{REVOKE_MINUTES}} minutes. Production secrets may be read by {{ACCESS}}. Leaked credentials are caught {{SCANNING}}.',
      consequences: '• Nothing long-lived to leak or rotate for databases and cloud services.\n• Needs support in the platform and in every database and service used; some (older drivers, third-party SaaS) do not have it.\n• Local development needs identities of its own, for example per developer through the cloud CLI.\n• Rights are reviewed in the platform\'s policies, which become as important as the code.',
      alternatives: '1. A secrets manager for every credential: works with anything, but every credential is a stored secret to rotate.\n2. Environment variables from the deployment: simplest, and the weakest.',
    },
    {
      id: 'adr-env', label: 'Credentials in the deployment', when: { STORE: ['env'] },
      decision: 'Credentials are kept encrypted in the deployment\'s store (Kubernetes Secrets with encryption at rest, Sealed Secrets or SOPS-encrypted manifests, or the CI system\'s encrypted variables) and set as environment variables at start; each element has its own, with only the rights it needs, and masks them in logs, crash reports and diagnostics. Rotation: {{ROTATION}}, at least every {{ROTATE_DAYS}} days, with a rolling redeploy; an exposed credential stops working within {{REVOKE_MINUTES}} minutes. Production secrets may be read by {{ACCESS}}. Leaked credentials are caught {{SCANNING}}. Move to a secrets manager when there are more than a handful of credentials or rotation by redeploy becomes a burden.',
      consequences: '• No extra service to run or pay for.\n• Values show in process listings, crash dumps and to anyone who can describe the deployment.\n• Rotation means a redeploy, and there is no central log of who read what beyond the platform\'s audit log.',
      alternatives: '1. A secrets manager: central audit and rotation, one more service on the start path.\n2. Workload identity: nothing stored, needs platform and database support.',
    },
  ],
  fitness: [
    {
      id: 'ff-scan-push', label: 'Push protection on', when: { SCANNING: ['push'] }, category: 'process', implements: ADRS,
      threshold: '100 % of the organisation\'s repositories have secret scanning and push protection enabled; 0 bypasses older than 1 working day without review',
      description: 'A scheduled job lists the organisation\'s repositories through the GitHub API and fails when one has secret scanning or push protection turned off; bypasses are reviewed from the secret scanning alerts.',
      tool: 'GitHub secret scanning push protection, checked with the GitHub CLI',
      language: 'bash',
      snippet: `# fails when a repository has secret scanning or push protection off
gh api --paginate "/orgs/$ORG/repos?per_page=100" \\
  --jq '.[] | select(.archived | not)
        | select(.security_and_analysis.secret_scanning.status != "enabled"
              or .security_and_analysis.secret_scanning_push_protection.status != "enabled")
        | .full_name' > unprotected.txt
test ! -s unprotected.txt || { cat unprotected.txt; exit 1; }`,
    },
    {
      id: 'ff-scan-ci', label: 'Secret scan in CI', when: { SCANNING: ['push', 'ci'] }, category: 'structural', implements: ADRS,
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
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Scan the pull request's commits
        run: |
          docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.18.4 \\
            git /repo --log-opts="origin/\${{ github.base_ref }}..HEAD" --redact --exit-code 1`,
    },
    {
      id: 'ff-scan-history', label: 'Nightly history scan', when: { SCANNING: ['scheduled'] }, category: 'process', implements: ADRS,
      threshold: '0 open findings older than 1 working day across history, images and CI logs',
      description: 'A nightly job scans the full git history with Gitleaks and the latest built images with TruffleHog, and files each finding to the owner; the job fails while a finding stays open past its deadline.',
      tool: 'Gitleaks and TruffleHog',
      language: 'yaml',
      snippet: `# .github/workflows/secrets-nightly.yml
name: secrets-nightly
on:
  schedule: [{ cron: '0 2 * * *' }]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.18.4 git /repo --redact --report-format sarif --report-path /repo/gitleaks.sarif --exit-code 0
      - run: docker run --rm trufflesecurity/trufflehog:3.63.0 docker --image "$IMAGE" --only-verified --fail
      - uses: github/codeql-action/upload-sarif@v3
        with: { sarif_file: gitleaks.sarif }`,
    },
    {
      id: 'ff-age-manager', label: 'Rotation is on', when: { STORE: ['manager', 'identity'] }, category: 'operational', implements: ['adr-manager', 'adr-identity'],
      threshold: '0 secrets in the secrets manager without rotation, or not rotated within {{ROTATE_DAYS}} days',
      description: 'AWS Config evaluates every secret in AWS Secrets Manager against the managed rules and reports one that has no rotation or has not been rotated in time. On Vault or Key Vault, a scheduled job reads the secrets\' metadata and checks the same.',
      tool: 'AWS Config managed rules (secretsmanager-rotation-enabled-check, secretsmanager-secret-periodic-rotation)',
      language: 'hcl',
      snippet: `resource "aws_config_config_rule" "secret_rotated" {
  name = "secret-rotated-within-{{ROTATE_DAYS}}-days"
  source {
    owner             = "AWS"
    source_identifier = "SECRETSMANAGER_SECRET_PERIODIC_ROTATION"
  }
  input_parameters = jsonencode({ maxDaysSinceRotation = "{{ROTATE_DAYS}}" })
}

resource "aws_config_config_rule" "secret_rotation_enabled" {
  name = "secret-rotation-enabled"
  source {
    owner             = "AWS"
    source_identifier = "SECRETSMANAGER_ROTATION_ENABLED_CHECK"
  }
}`,
    },
    {
      id: 'ff-no-static', label: 'No stored database secrets', when: { STORE: ['identity'] }, category: 'structural', implements: ['adr-identity'],
      threshold: '0 workloads that take a credential from a Kubernetes Secret, outside the allow-list of outside-system keys',
      description: 'A Conftest policy over the rendered manifests fails when a workload reads an environment variable or volume from a Secret that is not on the allow-list, which would mean a stored credential came back.',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `package main

import rego.v1

allowed := {"partner-api-key"}

deny contains msg if {
  input.kind == "Deployment"
  some c in input.spec.template.spec.containers
  some e in c.env
  name := e.valueFrom.secretKeyRef.name
  not allowed[name]
  msg := sprintf("%s reads secret %s: use the workload identity", [input.metadata.name, name])
}`,
    },
    {
      id: 'ff-age-env', label: 'Deployment secrets age', when: { STORE: ['env'] }, category: 'operational', implements: ['adr-env'],
      threshold: '0 Secrets in production namespaces older than {{ROTATE_DAYS}} days',
      description: 'A scheduled job lists the Kubernetes Secrets the elements read and fails on any created more than {{ROTATE_DAYS}} days ago, which means it was not rotated.',
      tool: 'kubectl and jq',
      language: 'bash',
      snippet: `max_age=$(( {{ROTATE_DAYS}} * 86400 ))
kubectl get secrets -n production -l app.kubernetes.io/part-of=shop -o json \\
  | jq -r --argjson max "$max_age" '.items[]
      | select((now - (.metadata.creationTimestamp | fromdateiso8601)) > $max)
      | .metadata.name' > stale.txt
test ! -s stale.txt || { echo "Secrets past rotation:"; cat stale.txt; exit 1; }`,
    },
    {
      id: 'ff-human-reads', label: 'Human reads alerted', when: { ACCESS: ['breakglass', 'jit'] }, category: 'operational', implements: ADRS,
      threshold: '100 % of reads of a production secret by a person raise an alert within 5 minutes; 0 reads without an approval record',
      description: 'An EventBridge rule matches reads of secrets in AWS Secrets Manager by anything other than the workloads\' roles and sends them to the security channel, where each is matched with its approval. On Vault, the audit device feeds the same alert.',
      tool: 'AWS CloudTrail with an Amazon EventBridge rule',
      language: 'json',
      snippet: `{
  "source": ["aws.secretsmanager"],
  "detail-type": ["AWS API Call via CloudTrail"],
  "detail": {
    "eventName": ["GetSecretValue"],
    "userIdentity": {
      "sessionContext": {
        "sessionIssuer": {
          "userName": [{ "anything-but": { "prefix": "workload-" } }]
        }
      }
    }
  }
}`,
    },
  ],
}

export default pack
