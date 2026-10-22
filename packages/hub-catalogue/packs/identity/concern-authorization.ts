import type { PackSpec, When } from '../../src/packSpec'

const PERMISSIONS: When = { MODEL: ['roles', 'relations', 'attributes'] }
const FORCES = 'People and other systems use this element with different rights. The forces: most access-control flaws are not broken sign-ins but a check missing at one operation, or a check on the type of record and not on the record itself (OWASP API1:2023, broken object level authorization); anything the interface hides can still be called; checks scattered through the code drift apart, while a central policy adds a dependency on the request path; administrators and support staff need more than everyone else, and standing privileges are what attackers look for; and permissions accumulate as people change jobs and keep what they had.'

const pack: PackSpec = {
  id: 'concern-authorization',
  name: 'Authorization',
  group: 'identity',
  description: 'What each caller may see and do: how permissions are modelled, where they are decided, how privileged access is given, and how permissions are taken back.',
  tags: ['security', 'authorization', 'access-control', 'rbac', 'abac', 'rebac', 'policy-as-code'],
  concern: {
    id: 'authorization',
    trigger: 'LIST RELATIONS WHERE (source.type = "person" OR source.external = true) AND target.external != true AND (target.type = "system" OR target.type = "container" OR target.type = "webapp" OR target.type = "component")',
    applyTo: 'target',
    why: 'people or other systems use these elements, so what each of them may see and do has to be decided.',
  },
  sources: [
    { title: 'OWASP ASVS 4.0.3, V4 Access Control', url: 'https://owasp.org/www-project-application-security-verification-standard/' },
    { title: 'OWASP Authorization Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html' },
    { title: 'OWASP API Security Top 10 2023, API1 Broken Object Level Authorization', url: 'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/' },
    { title: 'NIST Role Based Access Control (RBAC) project and standard', url: 'https://csrc.nist.gov/projects/role-based-access-control' },
    { title: 'Open Policy Agent documentation', url: 'https://www.openpolicyagent.org/docs/latest/' },
  ],
  questions: [
    {
      key: 'MODEL', title: 'Permissions', label: 'How are permissions given?',
      hint: 'The permission model decides what a check needs to know: the caller\'s roles, the caller\'s relation to the record, or attributes of both and of the request.',
      default: 'roles',
      options: [
        { value: 'roles', label: 'roles (RBAC)', description: 'A user gets roles, a role gets permissions. Pick it when what someone may do follows from their job and the same role sees the same kind of data, with fewer than about 20 roles.' },
        { value: 'relations', label: 'relationships (ReBAC)', description: 'Access follows from the caller\'s relation to the record: owner, member of the team or folder it belongs to, someone it was shared with. Pick it for documents, projects or workspaces that people share and nest.' },
        { value: 'attributes', label: 'attribute policies (ABAC)', description: 'Rules over attributes of the user, the record and the request (department, region, classification, time). Pick it when rules depend on data the roles cannot hold, such as "only records of their own region, only in working hours".' },
        { value: 'flat', label: 'everyone may do everything', description: 'Every signed-in caller may do everything. Pick it only while nothing the element offers is meant for some callers only, such as an internal tool for one small team.' },
      ],
    },
    {
      key: 'ENFORCE', title: 'Decision point', label: 'Where are permissions decided?',
      hint: 'Checks spread through handlers drift apart; a policy decision point keeps them in one place at the price of a dependency on the request path.',
      default: 'code',
      options: [
        { value: 'code', label: 'in the service code', description: 'One authorization module in each service, built on the framework\'s mechanism (Spring Security, ASP.NET Core policies, Pundit, CASL, Casbin). Pick it for one or a few services in one language, with rules that change with the code.' },
        { value: 'engine', label: 'by a policy engine', description: 'A policy decision point outside the code (Open Policy Agent, Cedar with Amazon Verified Permissions, OpenFGA or SpiceDB) answers every check; the services only enforce. Pick it for many services or languages, for rules owned by security or the business, or for a relationship graph.' },
      ],
    },
    {
      key: 'ADMIN', title: 'Privileged access', label: 'How do administrators and support reach production?',
      hint: 'Standing administrator rights are what attackers look for after a phishing mail; every way to more access needs its own decision and its own trail.',
      default: 'jit',
      options: [
        { value: 'jit', label: 'just-in-time elevation', description: 'Nobody holds administrator rights; they are requested, approved by a second person and expire after a few hours, with a sealed break-glass account for emergencies. Pick it when the element holds personal, financial or customer data, or an audit (ISO 27001, SOC 2) is expected.' },
        { value: 'standing', label: 'named administrators', description: 'A short list of named people hold administrator rights all the time, with phishing-resistant MFA and every action logged. Pick it for a small team where an approver is not always available and the data is of low sensitivity.' },
        { value: 'none', label: 'no direct access', description: 'Nobody reaches production data except through the element\'s own operations, which are authorized and audited like any other. Pick it when support needs are covered by admin screens in the product and infrastructure is fully automated.' },
      ],
    },
    {
      key: 'REVIEW', title: 'Taking back', label: 'How are permissions taken back?',
      hint: 'People change jobs and keep what they had; without a mechanism to take permissions back, every account ends up with more than it needs.',
      default: 'periodic',
      options: [
        { value: 'periodic', label: 'periodic reviews', description: 'Owners confirm each grant on a cadence and leavers are removed by a process. Pick it when grants are given by hand in the application, or an auditor asks for access reviews (SOX, ISO 27001 A.5.18).' },
        { value: 'directory', label: 'directory sync', description: 'Grants come only from groups in the identity provider (SCIM or group claims), so joiners, movers and leavers follow the HR system automatically. Pick it when every user is in a corporate directory that is kept up to date.' },
      ],
    },
  ],
  details: [
    { key: 'REVIEW_DAYS', label: 'How often are grants reviewed (days)?', default: '90', number: true },
    { key: 'ELEVATION_HOURS', label: 'How long may an elevation last (hours)?', default: '4', number: true },
  ],
  need: {
    label: 'Everyone sees only theirs',
    text: 'People with different jobs, and other systems, use the same element. Each may see and change only what their role, their relation to the record or the policy allows: a check missing at one operation, a check only in the interface, a record fetched by an id the caller should not know, or a list that shows what the detail would refuse each lets data out. Administrators and support need more than everyone else without holding it all the time, and permissions must be taken back when people change jobs or leave.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-deny', label: 'Unpermitted calls refused', when: PERMISSIONS, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a caller asks for data or an action its permissions do not grant',
      action: 'refuse it with 403 (or 404 for a record the caller may not know of) before any part of the operation runs, and record the refusal with the caller, the operation and the record',
      rationale: 'The refusal must not run half the operation or tell an attacker what exists, and repeated refusals are a signal worth alerting on (ASVS V4.1, V7.1; OWASP Authorization Cheat Sheet).',
      scenario: { label: 'Unpermitted call refused', given: 'a caller without the permission to delete orders', when: 'it calls the delete operation directly, without the interface', then: 'the call is refused with 403, the order stays, and the refusal is in the log' },
    },
    {
      id: 'req-default-deny', label: 'Denied by default', when: PERMISSIONS, ears_type: 'ubiquitous',
      action: 'decide every permission on the server, refuse any operation that has no rule of its own, and let the interface only hide what the server would refuse',
      rationale: 'Anything the interface hides can still be called, and an operation added without a rule must fail closed, not open (ASVS V4.1.1, V4.1.5).',
      scenario: { label: 'Operation without a rule', given: 'a new operation added without a permission rule', when: 'any caller, an administrator included, calls it', then: 'it is refused and the authorization test fails until a rule is added' },
    },
    {
      id: 'req-object', label: 'Checked on each record', when: PERMISSIONS, ears_type: 'event-driven',
      trigger: 'a request names a record by its id, or lists records',
      action: 'check the caller\'s permission on that very record, not only on its type, and filter lists by the same rule so that 0 records the detail would refuse appear in a list, a search or an export',
      rationale: 'Broken object level authorization is the first risk of the OWASP API Security Top 10 2023 (API1); lists filtered differently from the detail leak the same data.',
      scenario: { label: 'Another user\'s record', given: 'two users, each with an order only they may see', when: 'the first asks for the second\'s order by id, and lists and searches orders', then: 'the detail is refused and neither the list nor the search shows the second\'s order' },
    },
    {
      id: 'req-sod', label: 'Conflicting roles kept apart', when: { MODEL: ['roles'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a grant would give an account two roles on the separation-of-duties list, such as creating a payee and approving a payment',
      action: 'refuse the grant and record the attempt, unless a documented exception approved by a second person exists',
      rationale: 'Static separation of duty is part of the NIST RBAC standard (ANSI INCITS 359); one account holding both halves of a control defeats it.',
      scenario: { label: 'Conflicting role refused', given: 'an account holding the role that creates payees', when: 'an administrator grants it the role that approves payments', then: 'the grant is refused and the attempt is recorded' },
    },
    {
      id: 'req-relation-revoke', label: 'Unsharing takes effect', when: { MODEL: ['relations'] }, ears_type: 'event-driven',
      trigger: 'a relationship that grants access is removed (a record unshared, a member removed from a team, a folder moved)',
      action: 'refuse access that depended on it within 10 seconds, and never evaluate a request against relationships older than the change the caller has just made',
      rationale: 'In a relationship graph a stale read grants access that was just taken away (the "new enemy" problem of Google Zanzibar); consistency tokens bound it.',
      scenario: { label: 'Unshared record closes', given: 'a document shared with a user through a team', when: 'the user is removed from the team and asks for the document 10 seconds later', then: 'the request is refused' },
    },
    {
      id: 'req-attributes', label: 'Unknown attributes deny', when: { MODEL: ['attributes'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an attribute a policy reads is missing, or was last refreshed from its source more than 15 minutes ago',
      action: 'evaluate the policy as deny for that request and record which attribute was missing or stale',
      rationale: 'Attribute policies are only as good as their inputs; a missing department or region must not read as "any" (NIST SP 800-162, attribute freshness).',
      scenario: { label: 'Missing attribute denies', given: 'a policy allowing access to records of the user\'s own region', when: 'a user without a region attribute asks for a record', then: 'the request is refused and the log names the missing attribute' },
    },
    {
      id: 'req-pdp-down', label: 'Policy engine fails closed', when: { ...PERMISSIONS, ENFORCE: ['engine'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the policy decision point cannot be reached or does not answer within 50 milliseconds',
      action: 'refuse the operation, never fall back to allow, and raise an alert when more than 1% of decisions fail in 5 minutes',
      rationale: 'A central decision point is on every request path; failing open would turn an outage into a breach (ASVS V4.1.5, OWASP Authorization Cheat Sheet "deny by default").',
      scenario: { label: 'Engine down', given: 'the policy decision point stopped', when: 'a caller with every permission calls a protected operation', then: 'the call is refused and an alert is raised' },
    },
    {
      id: 'req-policy-release', label: 'Policies tested and versioned', when: { ...PERMISSIONS, ENFORCE: ['engine'] }, ears_type: 'event-driven',
      trigger: 'a policy change is merged',
      action: 'run its policy tests with at least 90% coverage before release, reach every decision point within 5 minutes, and record the policy version in every decision log entry',
      rationale: 'Policies are code that decides access; untested or unversioned, a policy change cannot be reviewed or traced after an incident (OPA decision logs and policy testing).',
      scenario: { label: 'Policy change released', given: 'a merged policy change whose tests pass', when: 'it is released', then: 'every decision point serves it within 5 minutes and decision logs carry its version' },
    },
    {
      id: 'req-review', label: 'Grants reviewed', when: { ...PERMISSIONS, REVIEW: ['periodic'] }, ears_type: 'event-driven',
      trigger: '{{REVIEW_DAYS}} days have passed since the grants of an account were last reviewed',
      action: 'ask the owner of each grant to confirm or remove it, and remove every grant not confirmed within 14 days',
      rationale: 'Rights accumulate as people change jobs; a regular review takes back what is no longer needed (ISO/IEC 27001:2022 A.5.18, ASVS V4.1.3 least privilege).',
      scenario: { label: 'Unconfirmed grant removed', given: 'an account whose grants were last reviewed {{REVIEW_DAYS}} days ago', when: 'the owner does not confirm one of its grants within 14 days', then: 'that grant is removed and the removal is recorded' },
    },
    {
      id: 'req-leaver', label: 'Leavers lose access', when: { ...PERMISSIONS, REVIEW: ['periodic'] }, ears_type: 'event-driven',
      trigger: 'HR or a manager reports that a person has left or moved to another job',
      action: 'remove every grant of a leaver within 24 hours, and every grant a mover no longer needs within 5 working days',
      rationale: 'Leavers who keep access are a common audit finding and an insider risk; the review cadence alone leaves them access for months (ISO/IEC 27001:2022 A.5.18).',
      scenario: { label: 'Leaver loses grants', given: 'a person with three grants', when: 'HR reports that the person has left', then: 'within 24 hours the account holds no grant' },
    },
    {
      id: 'req-directory', label: 'Grants follow the directory', when: { ...PERMISSIONS, REVIEW: ['directory'] }, ears_type: 'event-driven',
      trigger: 'the identity provider adds or removes a person from a group, or disables the account',
      action: 'apply the change to the person\'s permissions within 60 minutes, and give no permission that does not come from a directory group',
      rationale: 'With grants derived from the directory, joiners, movers and leavers follow the HR system; a grant given by hand beside it escapes every review (SCIM, RFC 7644; ASVS V4.1.3).',
      scenario: { label: 'Group removal applies', given: 'a person whose permission comes from a directory group', when: 'the directory removes the person from the group', then: 'within 60 minutes the permission is gone' },
    },
    {
      id: 'req-elevation', label: 'Elevation is approved and expires', when: { ADMIN: ['jit'] }, ears_type: 'event-driven',
      trigger: 'an operator asks for administrator access to production',
      action: 'grant it only after a second person approves it with a ticket reference, and remove it automatically after at most {{ELEVATION_HOURS}} hours',
      rationale: 'Standing privileges are what attackers look for; time-boxed, approved elevation keeps the window small (NIST SP 800-53 AC-2, AC-6; OWASP Authorization Cheat Sheet, least privilege).',
      scenario: { label: 'Elevation expires', given: 'an operator with an approved elevation', when: '{{ELEVATION_HOURS}} hours pass', then: 'the operator holds no administrator right and the elevation is in the audit log' },
    },
    {
      id: 'req-break-glass', label: 'Break-glass use alerts', when: { ADMIN: ['jit'] }, ears_type: 'event-driven',
      trigger: 'the sealed break-glass account is used',
      action: 'alert the security owner within 5 minutes, record every action taken with it, and rotate its credential within 24 hours after use',
      rationale: 'An emergency path that bypasses approval must be loud and short-lived, or it becomes the normal path (NIST SP 800-53 AC-2(2), emergency accounts).',
      scenario: { label: 'Break-glass used', given: 'the sealed break-glass account', when: 'someone signs in with it', then: 'the security owner is alerted within 5 minutes and the credential is rotated within 24 hours' },
    },
    {
      id: 'req-named-admins', label: 'Few named administrators', when: { ADMIN: ['standing'] }, ears_type: 'state-driven',
      precondition: 'an account holds administrator rights',
      action: 'require phishing-resistant MFA for it, keep at most 5 such accounts, each tied to a named person, and confirm the list every 30 days',
      rationale: 'With standing rights the number of holders and the strength of their sign-in are the only controls left (NIST SP 800-63B AAL3, ASVS V4.3.1).',
      scenario: { label: 'Admin list bounded', given: 'the list of administrator accounts', when: 'a sixth account is granted administrator rights, or one has no phishing-resistant MFA', then: 'the grant is refused, or the account is flagged until MFA is enrolled' },
    },
    {
      id: 'req-admin-audit', label: 'Privileged actions audited', when: { ADMIN: ['jit', 'standing'] }, ears_type: 'ubiquitous',
      action: 'record every action taken with administrator rights with the person, the time, the target and the ticket or reason, in a log the administrators cannot change, and keep it for at least 12 months',
      rationale: 'Privileged actions are the ones that most need a trail an administrator cannot edit afterwards (ASVS V7.1, V4.3; NIST SP 800-53 AU-9).',
      scenario: { label: 'Admin action leaves a trail', given: 'an administrator', when: 'they change a customer\'s data and then try to delete the log entry', then: 'the action is in the log with person, time, target and reason, and the deletion is refused' },
    },
    {
      id: 'req-no-direct', label: 'No direct data access', when: { ADMIN: ['none'] }, ears_type: 'ubiquitous',
      action: 'grant no person a credential that reads or writes production data stores directly, and offer support work only through the element\'s own operations, authorized and audited like any other',
      rationale: 'Without a side door, every access to data passes the same checks and the same audit trail (ASVS V4.1.3, least privilege).',
      scenario: { label: 'No side door', given: 'the production infrastructure as deployed', when: 'its access policies are listed', then: '0 persons hold a credential to a production data store' },
    },
    {
      id: 'req-flat', label: 'Same rights for all', when: { MODEL: ['flat'] }, ears_type: 'ubiquitous',
      action: 'let every signed-in caller do everything the element offers, and offer nothing meant for some callers only',
      rationale: 'Without permissions, the safety lies in keeping out what would need them; this makes it a requirement instead of an accident.',
      scenario: { label: 'Nothing for some only', given: 'the operations the element offers', when: 'they are listed', then: 'none is meant for only some of its callers' },
    },
  ],
  adrs: [
    {
      id: 'adr-roles', label: 'Permissions by role', when: { MODEL: ['roles'] },
      decision: 'Users get roles and roles get permissions (NIST core RBAC with static separation of duty), kept in one permission matrix: operation × role, versioned with the code. Every operation checks its permission on the server, on the record it touches as well as its type; anything without a rule is refused. Permissions are decided {{ENFORCE}}; they are taken back through {{REVIEW}}. Keep the roles under about 20: when an exception would become a role, it is a sign that relationships or attributes are needed. Use the framework\'s role mechanism (Spring Security, ASP.NET Core policies, Pundit, CASL) rather than checks of our own.',
      consequences: '• One matrix to read, review and test: a test can call every operation as every role.\n• Rules that depend on the record (only the owner may edit) do not fit roles and need an explicit check per operation.\n• Role explosion when every exception becomes a role.\n• Separation of duties can be checked when roles are granted.',
      alternatives: '1. Relationships (ReBAC): expresses ownership and sharing, harder to review as a whole.\n2. Attribute policies (ABAC): precise, but the attributes have to be kept fresh.\n3. Everyone may do everything: only right while nothing is meant for some users.',
    },
    {
      id: 'adr-relations', label: 'Permissions by relationship', when: { MODEL: ['relations'] },
      decision: 'Access follows from relationships between callers and records (owner, editor, viewer, member of the team or parent folder), modelled as a Zanzibar-style authorization model: object types, relations and the rules that derive one relation from another. Permissions are decided {{ENFORCE}}: with a policy engine, OpenFGA (CNCF, simple to run) or SpiceDB (stronger consistency options, Postgres or Spanner backends) holds the relationship tuples, chosen by the consistency and scale needed; in code, a relationship table queried by one authorization module. Every check names the record; lists ask for the records the caller may see (ListObjects or a filtered query). Permissions are taken back through {{REVIEW}}.',
      consequences: '• Sharing, ownership and nested folders or teams are expressed directly, without a role per case.\n• Relationship tuples are a second source of truth beside the domain data and must be written in the same change as it (outbox or transactional write).\n• Lists of what a caller may see are expensive on large graphs and need their own design.\n• A stale read can grant just-removed access: consistency tokens are needed.',
      alternatives: '1. Roles (RBAC): simpler to review, cannot express "shared with me".\n2. Attribute policies (ABAC): good for rules over data, awkward for sharing and nesting.\n3. Access control lists per record: simple, but hard to change for a whole team or folder.',
    },
    {
      id: 'adr-attributes', label: 'Permissions by attribute policy', when: { MODEL: ['attributes'] },
      decision: 'Permissions are policies over attributes of the caller (department, region, clearance), the record (owner, classification, region) and the request (time, network, assurance level), written as policy as code. Permissions are decided {{ENFORCE}}: with a policy engine, Open Policy Agent (Rego, general purpose, sidecar or library) or Cedar with Amazon Verified Permissions (typed, analysable policies, managed on AWS), chosen by the platform and whether policies must be provably analysable; in code, Casbin or CASL. Attributes come from named sources with a freshness limit, and a missing or stale attribute denies. Permissions are taken back through {{REVIEW}}.',
      consequences: '• Rules such as "own region, working hours only" are written once, not as roles per region.\n• Every attribute is an input to keep correct and fresh: a wrong department is a wrong decision.\n• Policies are code: they need tests and review of their own.\n• Who may see what is harder to answer for an auditor than with a role matrix.',
      alternatives: '1. Roles (RBAC): easy to review, but a role per region or classification explodes.\n2. Relationships (ReBAC): better for sharing, weaker for rules over data.\n3. Everyone may do everything: only right while nothing is meant for some users.',
    },
    {
      id: 'adr-flat', label: 'One level of access', when: { MODEL: ['flat'] },
      context: `${FORCES} Here nobody needs more than anyone else: the element offers the same to every signed-in caller.`,
      decision: 'Every signed-in caller may do everything the element offers; there are no roles or permissions in the application. Anything meant for some callers only stays out of it until this decision is superseded. Production access: {{ADMIN}}.',
      consequences: '• Nothing to manage, test or review in the application.\n• The first feature for some callers only needs this decision superseded first.\n• Who signs in is the only boundary: authentication carries all the weight.',
      alternatives: '1. Roles, added when the first restricted feature comes.\n2. Two roles (user, administrator) from the start: little cost now, but an untested boundary until something needs it.',
    },
    {
      id: 'adr-in-code', label: 'Permissions decided in code', when: { ...PERMISSIONS, ENFORCE: ['code'] },
      decision: 'Each service decides permissions in one authorization module, called from one place in the request pipeline (middleware, filter or policy attribute), never from scattered checks in handlers. Use the framework\'s mechanism: Spring Security method security, ASP.NET Core authorization policies, Pundit or Action Policy (Rails), CASL or Casbin (Node). A static rule fails the build for any route that does not go through the module.',
      consequences: '• No extra service on the request path; decisions take microseconds.\n• Rules change and ship with the code that needs them.\n• Each service has its own module: with more services or languages, the rules drift apart.\n• Security cannot change a rule without a release of the service.',
      alternatives: '1. A central policy engine (OPA, Cedar, OpenFGA): one place for every service, but a dependency on every request.\n2. Checks only at the API gateway: coarse, cannot see the record, and every internal call bypasses them.',
    },
    {
      id: 'adr-engine', label: 'Permissions decided by a policy engine', when: { ...PERMISSIONS, ENFORCE: ['engine'] },
      decision: 'A policy decision point outside the service code answers every permission check; services only enforce its answer (PEP/PDP). Choose by the model: Open Policy Agent for roles and attribute rules across many services and languages (sidecar or embedded, Rego); Cedar with Amazon Verified Permissions for typed, analysable policies on AWS; OpenFGA or SpiceDB for relationships. The decision point runs next to the services (sidecar or same host) so a check stays under 10 ms at p99; when it does not answer within 50 ms the request is refused. Policies live in their own repository, are tested in CI and released as versioned bundles; every decision is logged with the policy version.',
      consequences: '• One place for every service\'s rules, in one language, reviewable by security.\n• The decision point is on every request path: it needs the same availability as the services, and an outage refuses requests.\n• Policies need data (roles, relationships, attributes) pushed to or fetched by the engine.\n• Decision logs answer "why was this allowed" after an incident.',
      alternatives: '1. Authorization in the service code: no extra dependency, but rules drift apart across services.\n2. Checks only at the API gateway: coarse, cannot see the record.\n3. A managed authorization service (Auth0 FGA, Permit.io): less to run, more to pay per check and a vendor on the request path.',
    },
    {
      id: 'adr-jit', label: 'Just-in-time privileged access', when: { ADMIN: ['jit'] },
      decision: 'Nobody holds standing administrator rights in production. Operators request elevation with a ticket reference; a second person approves it; it expires after at most {{ELEVATION_HOURS}} hours. Use the platform\'s mechanism: Microsoft Entra Privileged Identity Management, AWS IAM Identity Center with temporary elevated access, Google Cloud Privileged Access Manager, or Teleport or HashiCorp Boundary for hosts and databases, chosen by where the infrastructure runs. One sealed break-glass account per environment, its credential split or in a safe, alerts on use and is rotated after it.',
      consequences: '• A phished operator account gives nothing in production by itself.\n• Emergencies need an approver awake, or the break-glass path.\n• Every elevation leaves a record of who, why and for how long.\n• The elevation tool is itself a critical system to protect.',
      alternatives: '1. Named standing administrators: simpler, but the rights are there for whoever takes the account.\n2. No direct access at all: the strongest, but every support need must be built into the product first.',
    },
    {
      id: 'adr-standing', label: 'Named standing administrators', when: { ADMIN: ['standing'] },
      decision: 'At most 5 named people hold administrator rights in production all the time; each signs in with phishing-resistant MFA (FIDO2 security key or platform passkey), and the list is confirmed every 30 days. Every privileged action is written to an append-only audit log the administrators cannot change (CloudTrail with S3 Object Lock, Azure Activity Log to an immutable storage account, or the SIEM). Revisit when the team grows past 10 people or the data becomes regulated: just-in-time elevation is then the next step.',
      consequences: '• No approval waits: administrators can act at once.\n• A stolen administrator session is a full compromise until it is noticed.\n• The audit log is the main control, so someone has to read it.',
      alternatives: '1. Just-in-time elevation with approval: smaller window, needs an approver available.\n2. No direct access: support only through the product.',
    },
    {
      id: 'adr-no-direct', label: 'No direct production access', when: { ADMIN: ['none'] },
      decision: 'No person holds a credential that reaches production data stores; infrastructure changes go only through the deployment pipeline (Terraform or Pulumi applied by CI), and support work goes through admin operations of the element itself, authorized and audited like any other operation. A policy check on the infrastructure code fails any change that gives a person access to a data store. Recovering from a broken pipeline is done by the platform\'s own account recovery, documented and rehearsed once a year.',
      consequences: '• No side door: every access to data passes the element\'s own checks and audit.\n• Every support need (a refund, a data fix) must exist as an admin operation before it is needed.\n• Incident response is slower when the pipeline itself is broken.',
      alternatives: '1. Just-in-time elevation: a controlled side door for what the product cannot do yet.\n2. Named standing administrators: fastest, weakest.',
    },
  ],
  fitness: [
    {
      id: 'ff-matrix', label: 'Permission matrix enforced', when: PERMISSIONS, category: 'structural', implements: ['adr-roles', 'adr-relations', 'adr-attributes', 'adr-in-code', 'adr-engine'],
      threshold: 'Every operation called as every role or rule case gives the expected answer, and with another user\'s record ids returns 403 or 404; 0 mismatches',
      description: 'A test lists the operations from the router (not from a list kept by hand), calls each as a caller of every role or rule case, and compares allowed or refused with the expected matrix; it also calls each operation that takes an id with the id of a record of another user. An operation without an entry fails the test.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app, routes } from '../src/app'          // routes: the router's table
import { EXPECTED } from './authz/expected'       // "METHOD path" -> roles allowed
import { CASES, tokenFor, otherUsersRecord } from './authz/fixtures'

describe.each(routes)('$method $path', (route) => {
  it.each(CASES)('as %s gives the expected answer', async (who) => {
    const res = await request(app)[route.method.toLowerCase()](route.example)
      .set('Authorization', \`Bearer \${await tokenFor(who)}\`)
    const allowed = EXPECTED[\`\${route.method} \${route.path}\`]?.includes(who) ?? false
    expect([403, 404].includes(res.status)).toBe(!allowed)
  })
  it.runIf(route.path.includes(':id'))('refuses another user\\'s record', async () => {
    const res = await request(app)[route.method.toLowerCase()](route.path.replace(':id', await otherUsersRecord()))
      .set('Authorization', \`Bearer \${await tokenFor('owner')}\`)
    expect([403, 404]).toContain(res.status)
  })
})`,
    },
    {
      id: 'ff-route-guard', label: 'Every route guarded', when: { ...PERMISSIONS, ENFORCE: ['code'] }, category: 'structural', implements: ['adr-in-code'],
      threshold: '0 routes registered without the authorize middleware',
      description: 'A static rule runs on every pull request and fails on a route registered without going through the authorization module, so a check cannot be forgotten in a handler.',
      tool: 'Semgrep',
      language: 'yaml',
      snippet: `rules:
  - id: route-without-authorize
    languages: [typescript]
    severity: ERROR
    message: Every route goes through authorize(); ADR "Permissions decided in code"
    patterns:
      - pattern: $ROUTER.$METHOD($PATH, ...)
      - metavariable-regex:
          metavariable: $METHOD
          regex: ^(get|post|put|patch|delete)$
      - pattern-not: $ROUTER.$METHOD($PATH, ..., authorize(...), ...)`,
    },
    {
      id: 'ff-policy-tests', label: 'Policies tested', when: { MODEL: ['roles', 'attributes'], ENFORCE: ['engine'] }, category: 'structural', implements: ['adr-engine', 'adr-roles', 'adr-attributes'],
      threshold: '0 failing policy tests and at least 90% policy coverage before a bundle is released',
      description: 'Every policy has unit tests next to it, including the default deny; CI runs them with coverage and refuses to publish the bundle below the threshold.',
      tool: 'Open Policy Agent (opa test --coverage --threshold 90)',
      language: 'rego',
      snippet: `package authz_test

import rego.v1

import data.authz

test_clerk_cannot_delete_order if {
	not authz.allow with input as {"user": {"roles": ["clerk"]}, "action": "order:delete", "resource": {"type": "order", "region": "eu"}}
}

test_other_region_denied if {
	not authz.allow with input as {"user": {"roles": ["manager"], "region": "eu"}, "action": "order:read", "resource": {"type": "order", "region": "us"}}
}

test_unknown_action_denied if {
	not authz.allow with input as {"user": {"roles": ["admin"]}, "action": "order:unknown", "resource": {"type": "order"}}
}`,
    },
    {
      id: 'ff-relation-tests', label: 'Relationship model tested', when: { MODEL: ['relations'], ENFORCE: ['engine'] }, category: 'structural', implements: ['adr-engine', 'adr-relations'],
      threshold: '0 failing assertions over the authorization model, run on every change of the model',
      description: 'The authorization model has a test file with tuples and expected checks, owners, team members and strangers included; CI runs it on every change to the model.',
      tool: 'OpenFGA CLI (fga model test)',
      language: 'yaml',
      snippet: `name: Order sharing
model_file: ./model.fga
tuples:
  - user: user:anne
    relation: owner
    object: order:1
  - user: team:sales#member
    relation: viewer
    object: order:1
  - user: user:bob
    relation: member
    object: team:sales
tests:
  - name: owner edits, team views, strangers see nothing
    check:
      - user: user:anne
        object: order:1
        assertions: { can_edit: true }
      - user: user:bob
        object: order:1
        assertions: { can_view: true, can_edit: false }
      - user: user:eve
        object: order:1
        assertions: { can_view: false }`,
    },
    {
      id: 'ff-fail-closed', label: 'Engine outage refuses', when: { ...PERMISSIONS, ENFORCE: ['engine'] }, category: 'operational', implements: ['adr-engine'],
      threshold: '100% of protected calls refused while the decision point is down; p99 decision time under 10 ms while it is up',
      description: 'An integration test starts the service with its decision point, measures decision latency, then stops the decision point and calls protected operations as a caller with every permission, expecting each to be refused.',
      tool: 'Testcontainers with Vitest',
      language: 'ts',
      snippet: `it('refuses every call while the policy engine is down', async () => {
  const pdp = await new GenericContainer('openpolicyagent/opa:latest').withCommand(['run', '--server']).start()
  const app = await startService({ pdpUrl: \`http://\${pdp.getHost()}:\${pdp.getMappedPort(8181)}\` })
  await pdp.stop()
  for (const route of protectedRoutes) {
    const res = await app.call(route, { as: 'superuser' })
    expect([403, 503]).toContain(res.status)
  }
})`,
    },
    {
      id: 'ff-stale-grants', label: 'No overdue grants', when: { ...PERMISSIONS, REVIEW: ['periodic'] }, category: 'process', implements: ['adr-roles', 'adr-relations', 'adr-attributes'],
      threshold: '0 grants unreviewed for more than {{REVIEW_DAYS}} + 14 days; 0 grants of leavers older than 24 hours',
      description: 'A scheduled CI job runs a query over the grants every day and fails, opening a ticket for the owner, when a grant is overdue for review or belongs to a person who has left.',
      tool: 'psql in a scheduled CI job',
      language: 'sql',
      snippet: `-- fails the job when it returns a row
select g.account_id, g.permission, g.last_reviewed_at, p.left_at
from grants g
join people p on p.account_id = g.account_id
where g.last_reviewed_at < now() - interval '{{REVIEW_DAYS}} days' - interval '14 days'
   or (p.left_at is not null and p.left_at < now() - interval '24 hours');`,
    },
    {
      id: 'ff-directory-sync', label: 'Grants match the directory', when: { ...PERMISSIONS, REVIEW: ['directory'] }, category: 'process', implements: ['adr-roles', 'adr-relations', 'adr-attributes'],
      threshold: '0 grants without a directory group behind them; 0 grants of disabled accounts older than 60 minutes',
      description: 'A scheduled job compares the grants with the directory\'s groups every hour and fails on any grant that no group explains, or that belongs to an account the directory has disabled.',
      tool: 'psql in a scheduled CI job',
      language: 'sql',
      snippet: `-- directory_* tables are filled by the SCIM endpoint; fails when it returns a row
select g.account_id, g.permission
from grants g
left join directory_group_members m on m.account_id = g.account_id and m.group_name = g.source_group
left join directory_accounts a on a.account_id = g.account_id
where m.account_id is null
   or (a.disabled_at is not null and a.disabled_at < now() - interval '60 minutes');`,
    },
    {
      id: 'ff-standing-admins', label: 'No standing admins', when: { ADMIN: ['jit'] }, category: 'operational', implements: ['adr-jit'],
      threshold: '0 people holding administrator rights outside an active, approved elevation',
      description: 'A scheduled query over the cloud account lists the people with administrator policies attached directly; anything returned is a standing right that bypasses elevation. Use the equivalent tables for Azure or Google Cloud.',
      tool: 'Steampipe (AWS plugin)',
      language: 'sql',
      snippet: `-- fails the job when it returns a row
select u.name, u.arn
from aws_iam_user u
where u.attached_policy_arns ? 'arn:aws:iam::aws:policy/AdministratorAccess'
   or u.attached_policy_arns ? 'arn:aws:iam::aws:policy/PowerUserAccess';`,
    },
    {
      id: 'ff-admin-list', label: 'Admins few and strong', when: { ADMIN: ['standing'] }, category: 'operational', implements: ['adr-standing'],
      threshold: 'At most 5 administrator accounts, 0 of them without MFA',
      description: 'A scheduled query counts the people with administrator rights and lists those without MFA; the job fails above 5 accounts or on any without MFA.',
      tool: 'Steampipe (AWS plugin)',
      language: 'sql',
      snippet: `select
  count(*) as admins,
  count(*) filter (where not mfa_enabled) as without_mfa
from aws_iam_user
where attached_policy_arns ? 'arn:aws:iam::aws:policy/AdministratorAccess';
-- the job fails when admins > 5 or without_mfa > 0`,
    },
    {
      id: 'ff-no-data-access', label: 'No person reaches data', when: { ADMIN: ['none'] }, category: 'structural', implements: ['adr-no-direct'],
      threshold: '0 infrastructure changes that give a person access to a production data store',
      description: 'A policy runs over every Terraform plan in CI and refuses a change that attaches data-store actions to a user or group rather than a service role.',
      tool: 'Conftest',
      language: 'rego',
      snippet: `package main

import rego.v1

human_policy := {"aws_iam_user_policy", "aws_iam_group_policy"}

deny contains msg if {
	some r in input.resource_changes
	human_policy[r.type]
	some s in json.unmarshal(r.change.after.policy).Statement
	some a in actions(s)
	regex.match("^(rds-db|dynamodb|s3|secretsmanager):", a)
	msg := sprintf("%s gives a person direct access to production data (%s)", [r.address, a])
}

actions(s) := s.Action if is_array(s.Action)

actions(s) := [s.Action] if is_string(s.Action)`,
    },
    {
      id: 'ff-flat', label: 'No permission checks creep in', when: { MODEL: ['flat'] }, category: 'structural', implements: ['adr-flat'],
      threshold: '0 imports of an authorization library or role check in the application code',
      description: 'A dependency rule fails the build when the code imports an authorization library, which would mean a restricted feature arrived without its decision.',
      tool: 'dependency-cruiser',
      language: 'js',
      snippet: `// .dependency-cruiser.cjs
module.exports = {
  forbidden: [{
    name: 'no-authorization',
    comment: 'ADR One level of access: supersede it before adding permissions',
    severity: 'error',
    from: {},
    to: { path: 'node_modules/(@casl/|casbin|accesscontrol|@openfga/|@permitio/|@cerbos/)' },
  }],
}`,
    },
  ],
}

export default pack
