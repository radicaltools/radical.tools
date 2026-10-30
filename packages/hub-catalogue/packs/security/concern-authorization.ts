import type { PackSpec, When } from '../../src/packSpec'

const PERMISSIONS: When = { MODEL: ['roles', 'relations', 'attributes'] }
const MODEL_ADRS = ['adr-roles', 'adr-relations', 'adr-attributes']
const FORCES = 'People and other systems use this element with different rights. The forces: most access-control flaws are not broken sign-ins but a check missing at one operation, or a check on the type of record and not on the record itself (OWASP API1:2023, broken object level authorization); anything the interface hides can still be called; checks scattered through the code drift apart, while a central policy adds a dependency on the request path; administrators and support staff need more than everyone else, and standing privileges are what attackers look for; and permissions accumulate as people change jobs and keep what they had.'

const pack: PackSpec = {
  id: 'concern-authorization',
  name: 'Authorization',
  group: 'security',
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
    { title: 'NIST SP 800-162, Guide to Attribute Based Access Control (ABAC) Definition and Considerations', url: 'https://csrc.nist.gov/pubs/sp/800/162/upd2/final' },
    { title: 'NIST SP 800-53 Rev. 5, Security and Privacy Controls (AC-2, AC-6, AU-9)', url: 'https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final' },
    { title: 'Open Policy Agent documentation', url: 'https://www.openpolicyagent.org/docs/latest/' },
    { title: 'Google Zanzibar: Consistent, Global Authorization System (2019)', url: 'https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/' },
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
        { value: 'flat', label: 'one level of access for every caller', description: 'Every signed-in caller may do everything. Pick it only while nothing the element offers is meant for some callers only, such as an internal tool for one small team; the next two questions are then moot.' },
      ],
    },
    {
      key: 'ENFORCE', title: 'Decision point', label: 'Where are permissions decided?',
      hint: 'Checks spread through handlers drift apart; a policy decision point keeps them in one place at the price of a dependency on the request path. Only when permissions are given (not with one level of access for every caller).',
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
      hint: 'People change jobs and keep what they had; without a mechanism to take permissions back, every account ends up with more than it needs. Only when permissions are given (not with one level of access for every caller).',
      default: 'periodic',
      options: [
        { value: 'periodic', label: 'periodic reviews', description: 'Owners confirm each grant on a cadence and leavers are removed by a process. Pick it when grants are given by hand in the application, or an auditor asks for access reviews (SOX, ISO 27001 A.5.18).' },
        { value: 'directory', label: 'directory sync', description: 'Grants come only from groups in the identity provider (SCIM or group claims), so joiners, movers and leavers follow the HR system automatically. Pick it when every user is in a corporate directory that is kept up to date.' },
      ],
    },
  ],
  details: [
    { key: 'REVIEW_DAYS', label: 'How often are grants reviewed (days)? (periodic reviews only)', default: '90', number: true },
    { key: 'ELEVATION_HOURS', label: 'How long may an elevation last (hours)? (just-in-time elevation only)', default: '4', number: true },
  ],
  need: {
    label: 'Everyone sees only theirs',
    text: 'People with different jobs, and other systems, use the same element. Each may see and change only what their role, their relation to the record or the policy allows: a check missing at one operation, a check only in the interface, a record fetched by an id the caller should not know, or a list that shows what the detail would refuse each lets data out. Administrators and support need more than everyone else without holding it all the time, and permissions must be taken back when people change jobs or leave. The snippets assume the application under src/ (src/app exports the router\'s table, src/authz the permission code) and the tests under tests/ with their fixtures in tests/authz.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-deny', label: 'Unpermitted calls refused', when: PERMISSIONS, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a caller asks for data or an action its permissions do not grant',
      action: 'refuse it with 403 (or 404 for a record the caller may not know of) before any part of the operation runs, and record the refusal with the caller, the operation and the record',
      rationale: 'The refusal must not run half the operation or tell an attacker what exists, and repeated refusals are a signal worth alerting on (ASVS V4.1, V7.1; OWASP Authorization Cheat Sheet).',
      scenario: { label: 'Unpermitted call refused', given: 'a caller without the permission to delete orders', when: 'it calls the delete operation directly, without the interface', then: 'the call is refused with 403, the order stays, and the refusal is in the audit trail' },
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
      id: 'req-named-admins', label: 'Few named administrators', when: { ADMIN: ['standing'] }, ears_type: 'ubiquitous',
      action: 'keep at most 5 administrator accounts, each tied to a named person and signing in with phishing-resistant MFA, and confirm the list every 30 days',
      rationale: 'With standing rights the number of holders and the strength of their sign-in are the only controls left (NIST SP 800-63B AAL3, ASVS V4.3.1).',
      scenario: { label: 'Admin list bounded', given: 'the list of administrator accounts', when: 'a sixth account is granted administrator rights, or one has no phishing-resistant MFA', then: 'the grant is refused, or the account is flagged until MFA is enrolled' },
    },
    {
      id: 'req-admin-audit', label: 'Privileged actions audited', when: { ADMIN: ['jit', 'standing'] }, ears_type: 'ubiquitous',
      action: 'record every action taken with administrator rights with the person, the time, the target and the ticket or reason, in the audit trail, which the administrators cannot change and whose store and retention the Audit trail pack decides',
      rationale: 'Privileged actions are the ones that most need a trail an administrator cannot edit afterwards (ASVS V7.1, V4.3; NIST SP 800-53 AU-9).',
      scenario: { label: 'Admin action leaves a trail', given: 'an administrator', when: 'they change a customer\'s data and then try to delete its audit record', then: 'the action is in the audit trail with person, time, target and reason, and the deletion is refused' },
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
      decision: 'Users get roles and roles get permissions (NIST core RBAC with static separation of duty), kept in one permission matrix: operation × role, versioned with the code. Every operation checks its permission on the server, on the record it touches as well as its type; anything without a rule is refused. Permissions are decided {{ENFORCE}}; they are taken back through {{REVIEW}}. Keep the roles under about 20: when an exception would become a role, it is a sign that relationships or attributes are needed. Production access: {{ADMIN}}.',
      consequences: '• One matrix to read, review and test: a test can call every operation as every role.\n• Rules that depend on the record (only the owner may edit) do not fit roles and need an explicit check per operation.\n• Role explosion when every exception becomes a role.\n• Separation of duties can be checked when roles are granted.',
      alternatives: '1. Relationships (ReBAC): expresses ownership and sharing, harder to review as a whole.\n2. Attribute policies (ABAC): precise, but the attributes have to be kept fresh.\n3. One level of access for every caller: only right while nothing is meant for some users.',
    },
    {
      id: 'adr-relations', label: 'Permissions by relationship', when: { MODEL: ['relations'] },
      decision: 'Access follows from relationships between callers and records (owner, editor, viewer, member of the team or parent folder), modelled as a Zanzibar-style authorization model: object types, relations and the rules that derive one relation from another. Permissions are decided {{ENFORCE}}: with a policy engine, OpenFGA (CNCF, simple to run) or SpiceDB (stronger consistency options, Postgres or Spanner backends) holds the relationship tuples, chosen by the consistency and scale needed; in code, a relationship table queried by one authorization module. Every check names the record; lists ask for the records the caller may see (ListObjects or a filtered query). A removed relationship takes effect within 10 seconds, and a caller\'s own change is never evaluated against an older snapshot (a consistency token from the write is passed to the check). Permissions are taken back through {{REVIEW}}. Production access: {{ADMIN}}.',
      consequences: '• Sharing, ownership and nested folders or teams are expressed directly, without a role per case.\n• Relationship tuples are a second source of truth beside the domain data and must be written in the same change as it (outbox or transactional write).\n• Lists of what a caller may see are expensive on large graphs and need their own design.\n• A stale read can grant just-removed access: consistency tokens are needed.',
      alternatives: '1. Roles (RBAC): simpler to review, cannot express "shared with me".\n2. Attribute policies (ABAC): good for rules over data, awkward for sharing and nesting.\n3. Access control lists per record: simple, but hard to change for a whole team or folder.',
    },
    {
      id: 'adr-attributes', label: 'Permissions by attribute policy', when: { MODEL: ['attributes'] },
      decision: 'Permissions are policies over attributes of the caller (department, region, clearance), the record (owner, classification, region) and the request (time, network, assurance level), written as policy as code. Permissions are decided {{ENFORCE}}: with a policy engine, Open Policy Agent (Rego, general purpose, sidecar or library) or Cedar with Amazon Verified Permissions (typed, analysable policies, managed on AWS), chosen by the platform and whether policies must be provably analysable; in code, Casbin or CASL. Attributes come from named sources with a freshness limit of 15 minutes, and a missing or stale attribute denies. Permissions are taken back through {{REVIEW}}. Production access: {{ADMIN}}.',
      consequences: '• Rules such as "own region, working hours only" are written once, not as roles per region.\n• Every attribute is an input to keep correct and fresh: a wrong department is a wrong decision.\n• Policies are code: they need tests and review of their own.\n• Who may see what is harder to answer for an auditor than with a role matrix.',
      alternatives: '1. Roles (RBAC): easy to review, but a role per region or classification explodes.\n2. Relationships (ReBAC): better for sharing, weaker for rules over data.\n3. One level of access for every caller: only right while nothing is meant for some users.',
    },
    {
      id: 'adr-flat', label: 'One level of access', when: { MODEL: ['flat'] },
      context: `${FORCES} Here nobody needs more than anyone else: the element offers the same to every signed-in caller.`,
      decision: 'Every signed-in caller may do everything the element offers; there are no roles or permissions in the application, so no decision point and no review of grants are needed. Anything meant for some callers only stays out of it until this decision is superseded. Production access: {{ADMIN}}.',
      consequences: '• Nothing to manage, test or review in the application.\n• The first feature for some callers only needs this decision superseded first.\n• Who signs in is the only boundary: authentication carries all the weight.',
      alternatives: '1. Roles, added when the first restricted feature comes.\n2. Two roles (user, administrator) from the start: little cost now, but an untested boundary until something needs it.',
    },
    {
      id: 'adr-in-code', label: 'Permissions decided in code', when: { ...PERMISSIONS, ENFORCE: ['code'] },
      decision: 'Each service decides permissions in one authorization module, called from one place in the request pipeline (middleware, filter or policy attribute), never from scattered checks in handlers. Use the framework\'s mechanism: Spring Security method security, ASP.NET Core authorization policies, Pundit or Action Policy (Rails), CASL or Casbin (Node). A static rule fails the build for any route that does not go through the module: Semgrep for Express-style routers, ArchUnit for Spring (every request mapping annotated with PreAuthorize), a Roslyn analyzer for ASP.NET Core, a RuboCop cop for Rails.',
      consequences: '• No extra service on the request path; decisions take microseconds.\n• Rules change and ship with the code that needs them.\n• Each service has its own module: with more services or languages, the rules drift apart.\n• Security cannot change a rule without a release of the service.',
      alternatives: '1. A central policy engine (OPA, Cedar, OpenFGA): one place for every service, but a dependency on every request.\n2. Checks only at the API gateway: coarse, cannot see the record, and every internal call bypasses them.',
    },
    {
      id: 'adr-engine', label: 'Permissions decided by a policy engine', when: { ...PERMISSIONS, ENFORCE: ['engine'] },
      decision: 'A policy decision point outside the service code answers every permission check; services only enforce its answer (PEP/PDP). Choose by the model: Open Policy Agent for roles and attribute rules across many services and languages (sidecar or embedded, Rego); Cedar with Amazon Verified Permissions for typed, analysable policies on AWS; OpenFGA or SpiceDB for relationships. The decision point runs next to the services (sidecar or same host) so a check stays under 10 ms at p99; when it does not answer within 50 ms the request is refused. Policies live in their own repository, are tested in CI and released as versioned bundles that reach every decision point within 5 minutes; every decision is logged with the policy version.',
      consequences: '• One place for every service\'s rules, in one language, reviewable by security.\n• The decision point is on every request path: it needs the same availability as the services, and an outage refuses requests.\n• Policies need data (roles, relationships, attributes) pushed to or fetched by the engine.\n• Decision logs answer "why was this allowed" after an incident.',
      alternatives: '1. Authorization in the service code: no extra dependency, but rules drift apart across services.\n2. Checks only at the API gateway: coarse, cannot see the record.\n3. A managed authorization service (Auth0 FGA, Permit.io): less to run, more to pay per check and a vendor on the request path.',
    },
    {
      id: 'adr-review-periodic', label: 'Grants taken back by periodic reviews', when: { ...PERMISSIONS, REVIEW: ['periodic'] },
      decision: 'Every grant has an owner who confirms it every {{REVIEW_DAYS}} days; a grant not confirmed within 14 days of the review is removed. Leavers reported by HR lose every grant within 24 hours, movers within 5 working days. The grants table keeps the owner and the last review date, and a daily job lists what is overdue and opens a ticket for the owner.',
      consequences: '• Works with grants given by hand in the application and with any identity provider.\n• Owner time every cycle: the number of grants to confirm grows with the number of users and permissions, so the cadence is a cost.\n• Between reviews a leaver keeps access unless HR reports them: the leaver process is the real control.',
      alternatives: '1. Directory sync: no reviews to run, but every user must be in a directory that HR keeps right.\n2. No reviews: the cheapest, until the audit asks who may do what and why.',
    },
    {
      id: 'adr-review-directory', label: 'Grants follow the directory', when: { ...PERMISSIONS, REVIEW: ['directory'] },
      decision: 'Permissions are derived only from groups in the identity provider, delivered by SCIM provisioning or group claims; nothing is granted by hand in the application. A change in the directory reaches the permissions within 60 minutes, and a disabled account loses every permission in the same time. An hourly job compares the grants with the directory and fails on any grant without a group behind it.',
      consequences: '• Joiners, movers and leavers follow the HR system without a review cycle.\n• Every user must be in the directory: contractors and partners need an account there too.\n• The group model in the directory becomes the permission model, owned together with IT.',
      alternatives: '1. Periodic reviews: no directory needed, owner time every cycle.\n2. Both: directory groups for the standard permissions, reviews for the exceptions granted by hand.',
    },
    {
      id: 'adr-jit', label: 'Just-in-time privileged access', when: { ADMIN: ['jit'] },
      decision: 'Nobody holds standing administrator rights in production. Operators request elevation with a ticket reference; a second person approves it; it expires after at most {{ELEVATION_HOURS}} hours. Use the platform\'s mechanism: Microsoft Entra Privileged Identity Management, AWS IAM Identity Center with temporary elevated access, Google Cloud Privileged Access Manager, or Teleport or HashiCorp Boundary for hosts and databases, chosen by where the infrastructure runs. One sealed break-glass account per environment, its credential split or in a safe, alerts on use and is rotated after it. Every privileged action is recorded in the audit trail, which the administrators cannot change; its store, tamper evidence and retention are decided in the Audit trail pack. Actions on the cloud\'s control plane reach it through the provider\'s own log (a CloudTrail trail with log file validation, or the Azure Activity Log) delivered to storage the administrators cannot change, kept for the audit trail\'s retention and never under 365 days.',
      consequences: '• A phished operator account gives nothing in production by itself.\n• Emergencies need an approver awake, or the break-glass path.\n• Every elevation leaves a record of who, why and for how long.\n• The elevation tool is itself a critical system to protect.',
      alternatives: '1. Named standing administrators: simpler, but the rights are there for whoever takes the account.\n2. No direct access at all: the strongest, but every support need must be built into the product first.',
    },
    {
      id: 'adr-standing', label: 'Named standing administrators', when: { ADMIN: ['standing'] },
      decision: 'At most 5 named people hold administrator rights in production all the time; each signs in with phishing-resistant MFA (FIDO2 security key or platform passkey), and the list is confirmed every 30 days. Every privileged action is recorded in the audit trail, which the administrators cannot change; its store, tamper evidence and retention are decided in the Audit trail pack. Actions on the cloud\'s control plane reach it through the provider\'s own log (a CloudTrail trail with log file validation, or the Azure Activity Log) delivered to storage the administrators cannot change, kept for the audit trail\'s retention and never under 365 days. Revisit when the team grows past 10 people or the data becomes regulated: just-in-time elevation is then the next step.',
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
      id: 'ff-matrix', label: 'Permission matrix enforced', when: PERMISSIONS, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: [...MODEL_ADRS, 'adr-in-code', 'adr-engine'], checks: ['req-deny', 'req-default-deny', 'req-object'],
      threshold: 'Every operation called as every role or rule case gives the expected answer, and with another user\'s record ids returns 403 or 404; 0 mismatches and 0 operations without an entry in the expected matrix',
      description: 'A test lists the operations from the router (not from a list kept by hand), fails on any operation the expected matrix does not name, calls each as a caller of every role or rule case, and compares allowed or refused with the matrix; it also calls each operation that takes an id with the id of a record of another user, and checks that a refusal left a log entry with caller, operation and record.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack: JUnit with MockMvc, xUnit with WebApplicationFactory, RSpec request specs)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app, routes } from '../src/app'          // routes: the router's table
import { EXPECTED } from './authz/expected'       // "METHOD path" -> roles allowed
import { CASES, tokenFor, otherUsersRecord, refusalsLogged } from './authz/fixtures'

describe.each(routes)('$method $path', (route) => {
  const key = \`\${route.method} \${route.path}\`
  it('is in the expected matrix', () => {
    expect(EXPECTED).toHaveProperty(key)
  })
  it.each(CASES)('as %s gives the expected answer', async (who) => {
    const res = await request(app)[route.method.toLowerCase()](route.example)
      .set('Authorization', \`Bearer \${await tokenFor(who)}\`)
    const allowed = EXPECTED[key]?.includes(who) ?? false
    expect([403, 404].includes(res.status)).toBe(!allowed)
    if (!allowed) expect(await refusalsLogged({ caller: who, operation: key })).toBeGreaterThan(0)
  })
  it.runIf(route.path.includes(':id'))('refuses another user\\'s record', async () => {
    const res = await request(app)[route.method.toLowerCase()](route.path.replace(':id', await otherUsersRecord()))
      .set('Authorization', \`Bearer \${await tokenFor('owner')}\`)
    expect([403, 404]).toContain(res.status)
  })
})`,
    },
    {
      id: 'ff-route-guard', label: 'Every route guarded', when: { ...PERMISSIONS, ENFORCE: ['code'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-in-code'], checks: ['req-default-deny'],
      threshold: '0 routes registered without the authorize middleware',
      description: 'A static rule runs on every pull request and fails on a route registered without going through the authorization module, so a check cannot be forgotten in a handler. The rule below is the Express-style form ($ROUTER limited to app, router and *Router, so map.get or axios.get do not match); routes mounted with router.use are checked where they are defined.',
      tool: 'Semgrep (Express-style routers); for Spring: ArchUnit methods().that().areAnnotatedWith(RequestMapping.class).should().beAnnotatedWith(PreAuthorize.class); for ASP.NET Core: a Roslyn analyzer over [Authorize]; for Rails: a RuboCop cop over verify_authorized',
      language: 'yaml',
      snippet: `rules:
  - id: route-without-authorize
    languages: [typescript, javascript]
    severity: ERROR
    message: Every route goes through authorize(); ADR "Permissions decided in code"
    patterns:
      - pattern-either:
          - pattern: $ROUTER.$METHOD($PATH, ...)
          - pattern: $ROUTER.route($PATH).$METHOD(...)
      - metavariable-regex:
          metavariable: $ROUTER
          regex: ^(app|router|[A-Za-z]+Router)$
      - metavariable-regex:
          metavariable: $METHOD
          regex: ^(get|post|put|patch|delete|all)$
      - pattern-not: $ROUTER.$METHOD($PATH, ..., authorize(...), ...)
      - pattern-not: $ROUTER.route($PATH).$METHOD(..., authorize(...), ...)`,
    },
    {
      id: 'ff-policy-tests', label: 'Policies tested', when: { MODEL: ['roles', 'attributes'], ENFORCE: ['engine'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-engine', 'adr-roles', 'adr-attributes'], checks: ['req-policy-release'],
      threshold: '0 failing policy tests and at least 90% policy coverage before a bundle is released',
      description: 'Every policy has unit tests next to it, including the default deny and a missing attribute; CI runs them with coverage and refuses to publish the bundle below the threshold.',
      tool: 'Open Policy Agent (opa test --coverage --threshold 90); with Cedar: cedar validate and the Cedar test suite of Amazon Verified Permissions in CI',
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

test_missing_region_denied if {
	not authz.allow with input as {"user": {"roles": ["manager"]}, "action": "order:read", "resource": {"type": "order", "region": "eu"}}
}

test_unknown_action_denied if {
	not authz.allow with input as {"user": {"roles": ["admin"]}, "action": "order:unknown", "resource": {"type": "order"}}
}`,
    },
    {
      id: 'ff-policy-rollout', label: 'Policy bundle reaches every decision point', when: { ...PERMISSIONS, ENFORCE: ['engine'] }, characteristic: 'security', scope: 'holistic', cadence: 'triggered', trigger: 'release', invocation: 'automated', implements: ['adr-engine'], checks: ['req-policy-release'],
      threshold: 'Every decision point reports the released bundle revision within 5 minutes of the release; 0 decision log entries without a bundle revision',
      description: 'After the bundle is published, the release pipeline polls the status API of every decision point until each reports the new revision, failing after 5 minutes, then reads a sample of the decision log and fails on an entry without the bundles.<name>.revision field.',
      tool: 'bash with curl and jq in the release pipeline (OPA status API; for Cedar or OpenFGA, the equivalent version endpoint of the engine)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# PDPS: the decision points' base URLs; REVISION: the revision just published; BUNDLE: its name
set -euo pipefail
deadline=$(( $(date +%s) + 300 ))
for pdp in $PDPS; do
  until [ "$(curl -sf "$pdp/v1/status" | jq -r ".result.bundles[\\"$BUNDLE\\"].active_revision")" = "$REVISION" ]; do
    [ "$(date +%s)" -lt "$deadline" ] || { echo "$pdp did not load $REVISION within 5 minutes"; exit 1; }
    sleep 5
  done
done
# a sample of the decision log, one JSON event per line
missing=$(tail -n 100 "$DECISION_LOG" | jq -c "select(.bundles[\\"$BUNDLE\\"].revision == null)" | wc -l)
[ "$missing" -eq 0 ] || { echo "$missing decision log entries carry no policy version"; exit 1; }`,
    },
    {
      id: 'ff-relation-tests', label: 'Relationship model tested', when: { MODEL: ['relations'], ENFORCE: ['engine'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-engine', 'adr-relations'], checks: ['req-policy-release'],
      threshold: '0 failing assertions over the authorization model, run on every change of the model',
      description: 'The authorization model has a test file with tuples and expected checks, owners, team members and strangers included; CI runs it on every change to the model.',
      tool: 'OpenFGA CLI (fga model test); with SpiceDB: zed validate over a validation file',
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
      id: 'ff-sod', label: 'Conflicting roles refused', when: { MODEL: ['roles'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-roles'], checks: ['req-sod'],
      threshold: 'Every pair on the separation-of-duties list is refused when granted to one account, and the attempt is recorded; 0 pairs granted',
      description: 'A test reads the separation-of-duties pairs from the code, grants the first role of each pair to a fresh account, tries to grant the second, and expects a refusal and a recorded attempt.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../src/app'
import { SEPARATION_OF_DUTIES } from '../src/authz/roles'   // [['payee-creator', 'payment-approver'], ...]
import { tokenFor, createAccount, grantAttempts } from './authz/fixtures'

describe.each(SEPARATION_OF_DUTIES)('%s and %s', (first, second) => {
  it('cannot both be held by one account', async () => {
    const account = await createAccount({ roles: [first] })
    const res = await request(app).post(\`/accounts/\${account.id}/roles\`).send({ role: second })
      .set('Authorization', \`Bearer \${await tokenFor('administrator')}\`)
    expect(res.status).toBe(409)
    expect(await grantAttempts({ account: account.id, role: second, refused: true })).toHaveLength(1)
  })
})`,
    },
    {
      id: 'ff-unshare', label: 'Unsharing takes effect in time', when: { MODEL: ['relations'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-relations'], checks: ['req-relation-revoke'],
      threshold: 'A record is refused within 10 seconds of the relationship that granted it being removed; a check made with the write\'s consistency token is refused at once',
      description: 'An integration test shares a document with a user through a team, removes the user from the team, polls the document until it is refused (failing past 10 seconds), and checks that a request carrying the consistency token of the removal is refused on the first try.',
      tool: 'Vitest with supertest against the service and its relationship store (OpenFGA, SpiceDB or the relationship table)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../src/app'
import { seedTeamShare, tokenFor, sleep } from './authz/fixtures'

it('closes a document within 10 seconds of the member being removed', async () => {
  const { doc, member, team, admin } = await seedTeamShare()
  const removal = await request(app).delete(\`/teams/\${team.id}/members/\${member.id}\`).set('Authorization', \`Bearer \${await tokenFor(admin)}\`)
  expect(removal.status).toBe(204)
  const token = removal.headers['x-consistency-token']           // the write's token, from the relationship store
  const atOnce = await request(app).get(\`/documents/\${doc.id}\`).set('Authorization', \`Bearer \${await tokenFor(member)}\`).set('X-Consistency-Token', token)
  expect([403, 404]).toContain(atOnce.status)
  const started = Date.now()
  while ((await request(app).get(\`/documents/\${doc.id}\`).set('Authorization', \`Bearer \${await tokenFor(member)}\`)).status === 200) {
    expect(Date.now() - started).toBeLessThan(10_000)
    await sleep(500)
  }
})`,
    },
    {
      id: 'ff-missing-attribute', label: 'Missing attributes deny', when: { MODEL: ['attributes'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-attributes'], checks: ['req-attributes'],
      threshold: 'A request from a user without an attribute the policy reads, or with one refreshed more than 15 minutes ago, is refused and the log names the attribute; 0 such requests allowed',
      description: 'An integration test creates a user without a region, and one whose region was last refreshed 16 minutes ago, asks for a record each and expects 403 with a log entry naming the attribute.',
      tool: 'Vitest with supertest, the attribute source seeded by the test (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../src/app'
import { userWithAttributes, tokenFor, decisionLog } from './authz/fixtures'

it.each([
  ['no region', {}],
  ['a stale region', { region: 'eu', refreshedAt: new Date(Date.now() - 16 * 60_000) }],
])('refuses a user with %s and names the attribute', async (_, attributes) => {
  const user = await userWithAttributes(attributes)
  const res = await request(app).get('/orders/1').set('Authorization', \`Bearer \${await tokenFor(user)}\`)
  expect(res.status).toBe(403)
  expect(await decisionLog.last({ user: user.id })).toMatchObject({ decision: 'deny', attribute: 'region' })
})`,
    },
    {
      id: 'ff-fail-closed', label: 'Engine outage refuses', when: { ...PERMISSIONS, ENFORCE: ['engine'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-engine'], checks: ['req-pdp-down'],
      threshold: '100% of protected calls refused while the decision point is down; p99 decision time under 10 ms over 200 calls while it is up',
      description: 'An integration test starts the service with its decision point, times 200 allowed calls and checks the p99, then stops the decision point and calls protected operations as a caller with every permission, expecting each to be refused.',
      tool: 'Testcontainers with Vitest',
      language: 'ts',
      snippet: `import { GenericContainer } from 'testcontainers'
import { startService, protectedRoutes } from './authz/service'

it('answers fast while the engine is up and refuses everything while it is down', async () => {
  const pdp = await new GenericContainer('openpolicyagent/opa:latest') // pin a version in your repository
    .withExposedPorts(8181).withCommand(['run', '--server', '--addr', ':8181']).start()
  const app = await startService({ pdpUrl: \`http://\${pdp.getHost()}:\${pdp.getMappedPort(8181)}\` })
  const times: number[] = []
  for (let i = 0; i < 200; i++) {
    const started = performance.now()
    expect((await app.call(protectedRoutes[0], { as: 'superuser' })).status).toBe(200)
    times.push(performance.now() - started)
  }
  times.sort((a, b) => a - b)
  expect(times[Math.floor(times.length * 0.99)]).toBeLessThan(10)
  await pdp.stop()
  for (const route of protectedRoutes) {
    const res = await app.call(route, { as: 'superuser' })
    expect([403, 503]).toContain(res.status)
  }
})`,
    },
    {
      id: 'ff-stale-grants', label: 'No overdue grants', when: { ...PERMISSIONS, REVIEW: ['periodic'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-review-periodic'], checks: ['req-review', 'req-leaver'],
      threshold: '0 grants unreviewed for more than {{REVIEW_DAYS}} + 14 days; 0 grants of leavers older than 24 hours',
      description: 'A scheduled CI job runs a query over the grants every day and fails, printing the rows and opening a ticket for the owner, when a grant is overdue for review or belongs to a person who has left.',
      tool: 'psql in a scheduled CI job (bash)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
overdue=$(psql "$DATABASE_URL" -Atc "
  select g.account_id || ' ' || g.permission || ' reviewed ' || coalesce(g.last_reviewed_at::text, 'never') || ' left ' || coalesce(p.left_at::text, '-')
  from grants g
  join people p on p.account_id = g.account_id
  where g.last_reviewed_at < now() - interval '{{REVIEW_DAYS}} days' - interval '14 days'
     or (p.left_at is not null and p.left_at < now() - interval '24 hours')")
[ -z "$overdue" ] || { echo "$overdue"; exit 1; }`,
    },
    {
      id: 'ff-directory-sync', label: 'Grants match the directory', when: { ...PERMISSIONS, REVIEW: ['directory'] }, characteristic: 'security', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: ['adr-review-directory'], checks: ['req-directory'],
      threshold: '0 grants without a directory group behind them; 0 grants of disabled accounts older than 60 minutes',
      description: 'A scheduled job compares the grants with the directory\'s groups every hour and fails, printing the rows, on any grant that no group explains, or that belongs to an account the directory has disabled.',
      tool: 'psql in a scheduled CI job (bash); the directory_* tables are filled by the SCIM endpoint',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
stray=$(psql "$DATABASE_URL" -Atc "
  select g.account_id || ' ' || g.permission
  from grants g
  left join directory_group_members m on m.account_id = g.account_id and m.group_name = g.source_group
  left join directory_accounts a on a.account_id = g.account_id
  where m.account_id is null
     or (a.disabled_at is not null and a.disabled_at < now() - interval '60 minutes')")
[ -z "$stray" ] || { echo "$stray"; exit 1; }`,
    },
    {
      id: 'ff-standing-admins', label: 'No standing admins', when: { ADMIN: ['jit'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-jit'], checks: ['req-elevation'],
      threshold: '0 people holding administrator rights outside an active, approved elevation',
      description: 'A scheduled query over the cloud account lists IAM users with an administrator policy attached directly, through a group or inline, and IAM Identity Center assignments of administrator permission sets to a person or group; every row is compared with the elevation tool\'s active requests, and any without one is a standing right that bypasses elevation. Use the equivalent tables for Azure (azuread_user, azure_role_assignment) or Google Cloud (gcp_iam_policy).',
      tool: 'Steampipe (AWS plugin), in a scheduled CI job that fails when the query returns a row not matched by an active elevation',
      language: 'sql',
      snippet: `-- every row is a standing administrator right unless the elevation tool lists it as active
with admin_policies as (
  select unnest(array['arn:aws:iam::aws:policy/AdministratorAccess', 'arn:aws:iam::aws:policy/PowerUserAccess']) as arn
),
admin_sets as (
  select mpa.permission_set_arn
  from aws_ssoadmin_managed_policy_attachment mpa
  join aws_ssoadmin_permission_set ps on ps.arn = mpa.permission_set_arn
  where mpa.managed_policy_arn in (select arn from admin_policies)
)
select 'iam user ' || u.name as holder
from aws_iam_user u
where exists (select 1 from admin_policies p where u.attached_policy_arns ? p.arn)
   or exists (select 1 from jsonb_array_elements(u.inline_policies) ip
              where ip -> 'PolicyDocument' -> 'Statement' @> '[{"Effect": "Allow", "Action": "*"}]')
union all
select 'iam group ' || g.name || ' member ' || (m ->> 'UserName')
from aws_iam_group g, jsonb_array_elements(g.users) m
where exists (select 1 from admin_policies p where g.attached_policy_arns ? p.arn)
union all
select 'identity center ' || a.principal_type || ' ' || a.principal_id || ' in account ' || a.target_account_id
from aws_ssoadmin_account_assignment a
where a.permission_set_arn in (select permission_set_arn from admin_sets)
  and a.target_account_id = '123456789012';   -- the production account`,
    },
    {
      id: 'ff-break-glass', label: 'Break-glass use alerts', when: { ADMIN: ['jit'] }, characteristic: 'security', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: ['adr-jit'], checks: ['req-break-glass'],
      threshold: 'A sign-in with the break-glass account raises a page to the security owner within 5 minutes; the credential\'s last rotation is at most 24 hours after its last use',
      description: 'An EventBridge rule matches console sign-ins by the break-glass user from CloudTrail and sends them to the paging topic; a quarterly drill signs in with the account in a non-production environment and times the page. The same scheduled job that counts administrators compares the account\'s password_last_used with its password last changed date.',
      tool: 'Terraform (aws_cloudwatch_event_rule on CloudTrail sign-in events, SNS to the pager); on Azure: an Entra ID sign-in log alert rule for the account; on Google Cloud: a log-based alert on the service account',
      language: 'hcl',
      snippet: `resource "aws_cloudwatch_event_rule" "break_glass_used" {
  name        = "break-glass-used"
  description = "ADR Just-in-time privileged access: page on any use of the sealed account"
  event_pattern = jsonencode({
    source        = ["aws.signin"]
    "detail-type" = ["AWS Console Sign In via CloudTrail"]
    detail = {
      eventName    = ["ConsoleLogin"]
      userIdentity = { userName = [var.break_glass_user_name] }
    }
  })
}

resource "aws_cloudwatch_event_target" "break_glass_page" {
  rule = aws_cloudwatch_event_rule.break_glass_used.name
  arn  = var.security_pager_topic_arn   # SNS topic wired to the on-call tool
}`,
    },
    {
      id: 'ff-admin-list', label: 'Admins few and strong', when: { ADMIN: ['standing'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-standing'], checks: ['req-named-admins'],
      threshold: 'At most 5 administrator accounts, 0 of them without a FIDO security key registered',
      description: 'A scheduled query counts the people with administrator rights and lists those without a FIDO security key among their MFA devices (serial numbers of security keys are :u2f/ ARNs); the job fails above 5 accounts or on any without one. A passkey registered as a FIDO key appears the same way; a virtual MFA device does not count.',
      tool: 'Steampipe (AWS plugin), in a scheduled CI job; for Azure: azuread_user with authentication methods, for Google Workspace: the users report with isEnforcedIn2Sv and security keys',
      language: 'sql',
      snippet: `select
  count(*) as admins,
  count(*) filter (where not exists (
    select 1 from jsonb_array_elements(coalesce(mfa_devices, '[]'::jsonb)) d
    where d ->> 'SerialNumber' like '%:u2f/%'
  )) as without_security_key
from aws_iam_user
where attached_policy_arns ? 'arn:aws:iam::aws:policy/AdministratorAccess';
-- the job fails when admins > 5 or without_security_key > 0`,
    },
    {
      id: 'ff-audit-immutable', label: 'Audit log cannot be changed', when: { ADMIN: ['jit', 'standing'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-jit', 'adr-standing'], checks: ['req-admin-audit'],
      threshold: 'The CloudTrail trail has log file validation on and writes to a bucket with Object Lock in compliance mode for at least 365 days, a floor below the audit trail\'s retention; 0 trails without both',
      description: 'A policy over the Terraform plan in CI fails when the CloudTrail trail has no log file validation, or its bucket has no Object Lock configuration in compliance mode with a default retention (in days or years) of at least 365 days, so that no administrator can delete or edit an entry within the retention. 365 days is only a floor: the retention itself is the one the Audit trail pack decides, and the bucket is set to it.',
      tool: 'Conftest on the Terraform plan (AWS form; on Azure check the storage account\'s immutability policy, on Google Cloud the bucket\'s retention policy with locked = true)',
      language: 'rego',
      snippet: `package main

import rego.v1

trails := [r | some r in input.resource_changes; r.type == "aws_cloudtrail"]
locks := [r | some r in input.resource_changes; r.type == "aws_s3_bucket_object_lock_configuration"]

deny contains "no CloudTrail trail in the plan" if count(trails) == 0

deny contains msg if {
	some t in trails
	not t.change.after.enable_log_file_validation
	msg := sprintf("%s has no log file validation", [t.address])
}

deny contains "no Object Lock configuration on the audit bucket" if count(locks) == 0

deny contains msg if {
	some l in locks
	some rule in l.change.after.rule
	some retention in rule.default_retention
	not retention.mode == "COMPLIANCE"
	msg := sprintf("%s is not in compliance mode", [l.address])
}

deny contains msg if {
	some l in locks
	some rule in l.change.after.rule
	some retention in rule.default_retention
	number_or_zero(retention.years) * 365 + number_or_zero(retention.days) < 365
	msg := sprintf("%s keeps the audit log for fewer than 365 days, the floor below the audit trail's retention", [l.address])
}

number_or_zero(x) := x if is_number(x)

number_or_zero(x) := 0 if not is_number(x)`,
    },
    {
      id: 'ff-no-data-access', label: 'No person reaches data', when: { ADMIN: ['none'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-no-direct'], checks: ['req-no-direct'],
      threshold: '0 infrastructure changes that give a person access to a production data store',
      description: 'A policy runs over every Terraform plan in CI and refuses a change that gives a user or group data-store actions or a wildcard inline, or attaches an administrator or data-store managed policy to a user or group; service roles are not touched.',
      tool: 'Conftest on the Terraform plan (AWS form; for Azure check azurerm_role_assignment with a user principal, for Google Cloud google_project_iam_member with user: or group: members)',
      language: 'rego',
      snippet: `package main

import rego.v1

human_inline := {"aws_iam_user_policy", "aws_iam_group_policy"}
human_attachment := {"aws_iam_user_policy_attachment", "aws_iam_group_policy_attachment"}
data_policies := {
	"arn:aws:iam::aws:policy/AdministratorAccess", "arn:aws:iam::aws:policy/PowerUserAccess",
	"arn:aws:iam::aws:policy/AmazonRDSFullAccess", "arn:aws:iam::aws:policy/AmazonS3FullAccess",
	"arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess", "arn:aws:iam::aws:policy/SecretsManagerReadWrite",
}

deny contains msg if {
	some r in input.resource_changes
	human_inline[r.type]
	some s in json.unmarshal(r.change.after.policy).Statement
	some a in actions(s)
	regex.match("^(\\\\*|rds[a-z-]*:|dynamodb:|s3:|secretsmanager:)", a)
	msg := sprintf("%s gives a person direct access to production data (%s)", [r.address, a])
}

deny contains msg if {
	some r in input.resource_changes
	human_attachment[r.type]
	data_policies[r.change.after.policy_arn]
	msg := sprintf("%s attaches %s to a person or group", [r.address, r.change.after.policy_arn])
}

deny contains msg if {
	some r in input.resource_changes
	r.type == "aws_iam_policy_attachment"
	count(array.concat(object.get(r.change.after, "users", []), object.get(r.change.after, "groups", []))) > 0
	msg := sprintf("%s attaches a policy to users or groups", [r.address])
}

actions(s) := s.Action if is_array(s.Action)

actions(s) := [s.Action] if is_string(s.Action)`,
    },
    {
      id: 'ff-flat', label: 'No permission checks creep in', when: { MODEL: ['flat'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-flat'], checks: ['req-flat'],
      threshold: '0 imports of an authorization library or role check in the application code',
      description: 'A dependency rule fails the build when the code imports an authorization library, which would mean a restricted feature arrived without its decision.',
      tool: 'dependency-cruiser (or the equivalent for your stack: ArchUnit, NetArchTest, a RuboCop custom cop)',
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
