import type { PackSpec, When } from '../../src/packSpec'

const STANDARDS = ['adr-asvs-l1', 'adr-asvs-l2', 'adr-cert-misra']
const WEB: When = { STANDARD: ['asvs-l1', 'asvs-l2'] }
const WEB_ADRS = ['adr-asvs-l1', 'adr-asvs-l2']
const SAST_RUNS: When = { SAST: ['pr-blocking', 'scheduled'] }
const FORCES = 'Code is written for this element every week, by people who are thinking about the feature, not about the attacker. The forces: the same few vulnerability classes (injection, broken access control, cross-site scripting, unsafe deserialisation, memory corruption in unmanaged code) account for most breaches year after year, and every one of them is a pattern a tool can find; a standard nobody can check against becomes a document nobody reads; validation spread over every layer is validation nobody owns, while validation nowhere lets a string reach the query; static analysis that blocks the merge stops new flaws but stalls work on a false positive, and analysis that only reports fills a queue nobody empties; dynamic testing finds what the running system exposes, but only in an environment someone deploys to; and a finding without a deadline or a signed acceptance is a finding that stays open. What goes into the build (dependencies, base images) is decided in Software supply chain, credentials in Secrets, who may call what in Authentication and Authorization; this concern is about the code itself.'

const pack: PackSpec = {
  id: 'concern-secure-coding',
  name: 'Secure coding',
  group: 'security',
  description: 'How the code itself is kept free of the common vulnerability classes: the standard it is held to, where input is validated and output encoded, how static and dynamic security testing runs, and what happens to a finding.',
  tags: ['security', 'secure-coding', 'owasp', 'asvs', 'sast', 'dast', 'input-validation'],
  concern: {
    id: 'secure-coding',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code is written for these elements, so the standard it is held to, where input is validated, how it is tested for vulnerabilities and what happens to a finding has to be decided.',
  },
  sources: [
    { title: 'OWASP Application Security Verification Standard (ASVS) 4.0.3 and 5.0', url: 'https://owasp.org/www-project-application-security-verification-standard/' },
    { title: 'OWASP Top 10:2021', url: 'https://owasp.org/Top10/' },
    { title: 'OWASP Input Validation Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html' },
    { title: 'OWASP SQL Injection Prevention Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html' },
    { title: 'OWASP Cross Site Scripting Prevention Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html' },
    { title: 'OWASP Top 10 Proactive Controls', url: 'https://owasp.org/www-project-proactive-controls/' },
    { title: 'SEI CERT Coding Standards (C, C++, Java)', url: 'https://wiki.sei.cmu.edu/confluence/display/seccode' },
    { title: 'MISRA C:2023, Guidelines for the use of the C language in critical systems', url: 'https://misra.org.uk/' },
    { title: 'NIST SP 800-218, Secure Software Development Framework (SSDF) 1.1', url: 'https://csrc.nist.gov/pubs/sp/800/218/final' },
    { title: 'GitHub CodeQL documentation', url: 'https://codeql.github.com/docs/' },
    { title: 'OWASP ZAP documentation', url: 'https://www.zaproxy.org/docs/' },
    { title: 'Threat Modeling Manifesto', url: 'https://www.threatmodelingmanifesto.org/' },
  ],
  questions: [
    {
      key: 'STANDARD', title: 'Standard', label: 'Which standard is the code held to?',
      hint: 'The standard decides what "secure" means for a change: a list of controls a tool can verify, the same plus a threat model per feature, or a language rule set for code where a wrong index is a remote code execution.',
      default: 'asvs-l1',
      options: [
        { value: 'asvs-l1', label: 'OWASP ASVS level 1', description: 'The ASVS Level 1 controls: the ones that can be verified automatically or with a black-box test, mapped to lint rules, tests and scanners. Pick it for most applications: anything without personal, financial or health data, as the floor every element reaches.' },
        { value: 'asvs-l2', label: 'OWASP ASVS level 2 with a threat model per feature', description: 'ASVS Level 2: everything in Level 1, plus design-level controls and a threat model (STRIDE) kept beside each feature and updated with every new trust boundary. Pick it for applications handling personal, financial or health data, or where a flaw in one feature\'s design would be a reportable incident.' },
        { value: 'cert-misra', label: 'a language coding standard (SEI CERT or MISRA)', description: 'SEI CERT C/C++ or Java, or MISRA C:2023, checked by a compliant analyser in CI: bounds checks, no banned functions, integer overflow handled, deviations recorded. Pick it for embedded, safety-related or systems-level code in C, C++ or Rust-with-unsafe, where memory corruption is the vulnerability class that matters.' },
      ],
    },
    {
      key: 'INPUT', title: 'Input', label: 'Where is input validated?',
      hint: 'Validation at one boundary gives the inside typed values and one place to look; validation everywhere is what a library needs when it does not know who calls it.',
      default: 'boundary-schema',
      options: [
        { value: 'boundary-schema', label: 'once at the boundary, against a schema', description: 'Every request, message and file is validated against a declared schema (zod or valibot, Pydantic, Bean Validation or JSON Schema) before any handler runs; the inside trusts the typed values. Pick it for services and web apps with a clear boundary (HTTP, a queue consumer, a file import).' },
        { value: 'everywhere', label: 'defensively, at every layer', description: 'Every exported function and handler checks its own arguments for type, range, length and allowed values. Pick it for libraries, SDKs and code called from many places, where no single boundary exists; it costs duplicated checks and needs discipline about what each layer owns.' },
      ],
    },
    {
      key: 'SAST', title: 'Static analysis', label: 'How does static application security testing run?',
      hint: 'A scanner on the pull request finds the flaw while the author still remembers the code; a scheduled one finds it later and hands it to a queue.',
      default: 'pr-blocking',
      options: [
        { value: 'pr-blocking', label: 'on every pull request, high findings block the merge', description: 'Semgrep (p/owasp-top-ten, p/default), CodeQL security-extended and the language\'s scanner (Bandit, gosec, SpotBugs find-sec-bugs) run as required checks; a high or critical finding without a reviewed suppression stops the merge. Pick it for anything reached from the internet or holding personal data.' },
        { value: 'scheduled', label: 'nightly or weekly, findings triaged within a deadline', description: 'The same scanners run on a schedule over the default branch, and every new finding gets an owner and a deadline from a triage queue. Pick it for a codebase with a large backlog of findings you are working through, or where the scanners are too slow or noisy for the pull request; move to blocking once the queue is empty.' },
        { value: 'none', label: 'none, code review only', description: 'No scanner; reviewers check against the standard\'s checklist. Pick it only for small internal tools with no outside callers and no personal data, and record it so that the first external caller supersedes this decision.' },
      ],
    },
    {
      key: 'DAST', title: 'Dynamic testing', label: 'How does dynamic security testing run?',
      hint: 'Static analysis sees the code; a dynamic scan sees what the deployed system exposes: headers, cookies, error pages, forgotten routes.',
      default: 'pipeline',
      options: [
        { value: 'pipeline', label: 'against each deployed environment in the pipeline', description: 'An OWASP ZAP baseline scan (or API scan from the OpenAPI document) runs against every environment the pipeline deploys to, and a high alert fails the deployment\'s check. Pick it when the pipeline deploys to an environment it can reach, which is most pipelines.' },
        { value: 'periodic', label: 'on a schedule: a ZAP full scan or a penetration test', description: 'A ZAP full scan runs on a schedule against staging, and a penetration test is commissioned on a longer one; findings enter the same deadlines. Pick it when deployments are rare or the pipeline cannot reach the running system.' },
        { value: 'none', label: 'none', description: 'No dynamic testing. Pick it only for an element with no HTTP or network surface of its own (a batch job, a library), where fuzzing or unit tests cover its inputs instead.' },
      ],
    },
    {
      key: 'FINDINGS', title: 'Findings', label: 'What happens to a security finding?',
      hint: 'A deadline by severity turns a finding into work; a signed acceptance with an expiry date is the only honest way to leave one open.',
      default: 'sla',
      options: [
        { value: 'sla', label: 'fixed within a deadline by severity', description: 'Every finding (scanner, pentest, review, bug bounty) is fixed within its severity\'s deadline, and the main branch\'s build fails on an overdue one. Pick it when the team can fix what the scanners find; it is the simplest rule and the hardest to argue with.' },
        { value: 'risk-accepted', label: 'fixed within a deadline, or accepted in writing until a date', description: 'The same deadlines, but a finding may be left open with a written risk acceptance in a register, signed by the owner and a second person from security, that expires. Pick it for codebases with findings nobody can fix in time (a vendor library, a legacy module slated for replacement); every acceptance comes up again when it expires.' },
      ],
    },
  ],
  details: [
    { key: 'CRITICAL_DAYS', label: 'Days to fix a critical finding', default: '2', number: true },
    { key: 'HIGH_DAYS', label: 'Days to fix a high finding', default: '7', number: true },
    { key: 'MEDIUM_DAYS', label: 'Days to fix a medium finding', default: '30', number: true },
    { key: 'ACCEPTANCE_DAYS', label: 'Most days a risk acceptance stays valid', default: '90', number: true },
    { key: 'SAST_MINUTES', label: 'Within how many minutes must the static analysis of a pull request finish?', default: '10', number: true },
    { key: 'DAST_DAYS', label: 'Most days between dynamic tests of the production configuration', default: '90', number: true },
    { key: 'THREAT_MODEL_TRIGGER', label: 'Which changes require the threat model to be updated?', default: 'a new endpoint, a new data store, a new trust boundary' },
  ],
  need: {
    label: 'The code has no known class of hole',
    text: 'The element\'s own code must not let an attacker inject a query or a command, run their script in another user\'s browser, read or change data they may not, deserialise their objects or overrun a buffer. Developers must know which standard a change is held to, where input is checked and output encoded, and a tool must tell them on the pull request when they slipped, before a reviewer and long before an attacker. A finding, from a scanner, a test or a report, must be fixed by a deadline or accepted in writing by someone who may accept it, for a limited time.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-param-queries', label: 'Queries are parameterised', ears_type: 'ubiquitous',
      action: 'pass every value that reaches a database, directory, OS command or interpreter as a bound parameter of a prepared statement or through the ORM\'s query builder, and build 0 queries or commands by string concatenation or interpolation',
      rationale: 'Injection is OWASP Top 10 A03:2021; a parameterised query keeps data from ever being parsed as code, whatever the input holds, and is the one defence that needs no judgement per call site (OWASP SQL Injection Prevention Cheat Sheet, Option 1; ASVS 4.0.3 V5.3.4, V5.3.8).',
      scenario: { label: 'Injection goes nowhere', given: 'a request whose search field holds \' OR 1=1 --', when: 'it is handled', then: 'the database receives the string as a bound parameter, the query returns no extra rows, and the lint finds 0 string-built queries in the code' },
    },
    {
      id: 'req-output-encoding', label: 'Output encoded by the template engine', when: WEB, ears_type: 'ubiquitous',
      action: 'render every value in HTML, attributes, JavaScript, CSS and URLs through the template engine\'s contextual auto-escaping (React, Jinja2 and Django templates with autoescape on, Thymeleaf, Razor), and write to 0 raw-HTML sinks (innerHTML, dangerouslySetInnerHTML, |safe, Html.Raw) from data that came from outside, with a sanitiser (DOMPurify) as the only exception for rich text',
      rationale: 'Cross-site scripting is the oldest entry in the Top 10 and is prevented by encoding at the output, in the context the value lands in, which the template engine does on every value when nobody bypasses it (OWASP XSS Prevention Cheat Sheet; ASVS 4.0.3 V5.3.1, V5.3.3).',
      scenario: { label: 'Script rendered as text', given: 'a user whose display name is <script>alert(1)</script>', when: 'a page that shows the name is rendered', then: 'the response holds the name entity-encoded, no script runs, and the lint finds 0 raw-HTML sinks fed from request or database data' },
    },
    {
      id: 'req-input-boundary', label: 'Input validated at the boundary', when: { INPUT: ['boundary-schema'] }, ears_type: 'event-driven',
      trigger: 'a request, message or file arrives at the element\'s boundary',
      action: 'validate it against a declared schema (zod or valibot, Pydantic, Bean Validation or JSON Schema) that refuses unknown fields, before any handler runs; reject an invalid one with status 400 (or the protocol\'s equivalent) that names every failing field and carries no stack trace; and let code inside the boundary work with the typed, validated values only',
      rationale: 'Validation in one place with a schema is validation someone can read and test; naming the field makes rejections usable for honest clients and gives attackers nothing they did not send (OWASP Input Validation Cheat Sheet: allow-list validation at the boundary; ASVS 4.0.3 V5.1.3, V5.1.4; Proactive Controls C5).',
      scenario: { label: 'Malformed request named', given: 'a POST /orders with quantity "two" and an unknown field "extra"', when: 'it arrives', then: 'the answer is 400 and names quantity and extra, no handler ran, and the body holds no stack trace or class name' },
    },
    {
      id: 'req-input-everywhere', label: 'Every layer checks its arguments', when: { INPUT: ['everywhere'] }, ears_type: 'ubiquitous',
      action: 'check the arguments of every exported function and every message handler for type, range, length and allowed values before using them, fail with a typed error that names the argument, and never assume a caller in the same process has validated them',
      rationale: 'A library or shared module has as many boundaries as callers; a check it does not do itself depends on every caller doing it (OWASP Input Validation Cheat Sheet; SEI CERT API00-C, MSC08-J: validate arguments of exported functions).',
      scenario: { label: 'Bad argument refused', given: 'an exported function that takes a length', when: 'it is called with -1 and with 2^31', then: 'both calls fail with a typed error naming the argument and nothing is read or written' },
    },
    {
      id: 'req-no-dynamic-code', label: 'Dangerous constructs banned by lint', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a change introduces eval or new Function, OS command execution with an interpolated string, deserialisation of untrusted data (pickle, ObjectInputStream, BinaryFormatter), a regular expression or a file path built from input, or a function the standard bans',
      action: 'fail the lint of the pull request naming the file and line, unless a reviewed suppression with the reason is written beside it',
      rationale: 'Code built from data is injection by another name, and deserialising untrusted objects is remote code execution in most runtimes; a ban enforced by lint costs nothing per review (OWASP Top 10 A03:2021 and A08:2021; ASVS 4.0.3 V5.2.4, V5.5.1, V5.5.3; Proactive Controls C5).',
      scenario: { label: 'eval refused', given: 'a pull request that adds eval(req.query.expr) and a child_process.exec with a template string', when: 'the lint runs', then: 'it fails naming both lines and the pull request cannot merge' },
    },
    {
      id: 'req-framework-defaults', label: 'Framework defenses on by default', when: WEB, ears_type: 'ubiquitous',
      action: 'take CSRF protection, CORS, cookie flags (Secure, HttpOnly, SameSite) and the security headers from the framework\'s middleware configured once at start (helmet and a CSRF middleware for Express, Spring Security\'s defaults, Django\'s SecurityMiddleware and CsrfViewMiddleware, ASP.NET Core antiforgery), with the framework\'s strict modes on, and write 0 hand-rolled replacements; where a gateway sets the headers, set none in the code that conflict',
      rationale: 'The framework\'s security middleware is reviewed by more people than any hand-rolled version and is wrong only where it is turned off (Proactive Controls C2, Leverage Security Frameworks and Libraries; OWASP Top 10 A05:2021; ASVS 4.0.3 V4.2.2, V14.4, V14.5).',
      scenario: { label: 'Forged request refused', given: 'the element started with its production configuration', when: 'a state-changing request arrives without the CSRF token and a response is inspected', then: 'the request is refused with 403, and the response carries the middleware\'s headers and cookie flags' },
    },
    {
      id: 'req-sast-pr', label: 'Static analysis on every change', when: { SAST: ['pr-blocking'] }, ears_type: 'event-driven',
      trigger: 'a pull request is opened or updated',
      action: 'run static application security testing (Semgrep with p/owasp-top-ten and p/default, CodeQL security-extended, and the language\'s scanner: Bandit, gosec or SpotBugs find-sec-bugs) within {{SAST_MINUTES}} minutes, and block the merge on any high or critical finding not covered by a reviewed suppression',
      rationale: 'A flaw found on the pull request is fixed by its author in minutes; the same flaw found later is a ticket (NIST SSDF PW.7, PW.8; GitHub CodeQL documentation: code scanning as a required check).',
      scenario: { label: 'High finding blocks merge', given: 'a pull request that adds a SQL query built from a request parameter', when: 'its checks run', then: 'the static analysis reports it as high within {{SAST_MINUTES}} minutes and the pull request cannot merge' },
    },
    {
      id: 'req-sast-scheduled', label: 'Scheduled findings triaged', when: { SAST: ['scheduled'] }, ears_type: 'event-driven',
      trigger: 'the scheduled static analysis reports a new high or critical finding',
      action: 'give it an owner from the triage queue within 1 working day, after which the deadline of its severity runs, and show the queue\'s age on the team\'s dashboard',
      rationale: 'A scheduled scan without triage produces a list nobody owns; the working-day limit on triage keeps the deadlines meaningful (NIST SSDF RV.1, RV.2).',
      scenario: { label: 'Finding gets an owner', given: 'a nightly scan that reports a new high finding', when: '1 working day has passed', then: 'the finding has an owner and a due date {{HIGH_DAYS}} days from the report' },
    },
    {
      id: 'req-dast-pipeline', label: 'Deployed environments scanned', when: { DAST: ['pipeline'] }, ears_type: 'event-driven',
      trigger: 'a build is deployed to an environment of the pipeline (ephemeral, staging or production)',
      action: 'run an OWASP ZAP baseline scan, or the API scan from the OpenAPI document, against it within 30 minutes, fail the deployment\'s check on a high alert, and keep the report with the build',
      rationale: 'What the running system exposes (missing headers, verbose errors, forgotten routes, reflected input) is visible only to a scan of the running system (OWASP ZAP documentation: baseline and API scans; NIST SSDF PW.8).',
      scenario: { label: 'Reflected input caught', given: 'a build that reflects a query parameter into a page unencoded', when: 'it is deployed to the ephemeral environment', then: 'the ZAP scan reports a high alert within 30 minutes and the deployment\'s check fails' },
    },
    {
      id: 'req-dast-periodic', label: 'Dynamic tests stay recent', when: { DAST: ['periodic'] }, ears_type: 'state-driven',
      precondition: 'the last dynamic test (a ZAP full scan or a penetration test) of the production configuration is more than {{DAST_DAYS}} days old',
      action: 'run or commission a new one within 14 days, and put each of its high and critical findings under the deadlines of its severity',
      rationale: 'A dynamic test ages with every release; a bound on its age is what keeps "we had a pentest" from meaning one from three years ago (NIST SSDF PW.8; OWASP ZAP documentation: full scan).',
      scenario: { label: 'Stale test renewed', given: 'a production configuration whose last ZAP full scan is {{DAST_DAYS}} days old', when: 'the age check runs', then: 'it fails, and within 14 days a new report is on file with its findings tracked' },
    },
    {
      id: 'req-findings-sla', label: 'Findings fixed by deadline', when: { FINDINGS: ['sla'] }, ears_type: 'state-driven',
      precondition: 'an open security finding (static analysis, dynamic scan, penetration test, review or report) is older than its deadline: {{CRITICAL_DAYS}} days for critical, {{HIGH_DAYS}} for high, {{MEDIUM_DAYS}} for medium',
      action: 'fail the main branch\'s build and the release, naming the finding, until it is fixed',
      rationale: 'A deadline the build enforces is the only one that holds under delivery pressure (NIST SSDF RV.2; OWASP Top 10 A06:2021 for the same rule on dependencies, decided in Software supply chain).',
      scenario: { label: 'Overdue finding stops release', given: 'a high finding opened {{HIGH_DAYS}} days ago and still open', when: 'the main branch builds', then: 'the build fails naming the finding and no release is made' },
    },
    {
      id: 'req-risk-accepted', label: 'Open findings accepted in writing', when: { FINDINGS: ['risk-accepted'] }, ears_type: 'state-driven',
      precondition: 'a security finding cannot be fixed within its deadline ({{CRITICAL_DAYS}} days for critical, {{HIGH_DAYS}} for high, {{MEDIUM_DAYS}} for medium)',
      action: 'keep it open only with a risk acceptance in the register that names the finding, the owner, a second approver from security, the reason and the compensating controls, and expires after at most {{ACCEPTANCE_DAYS}} days; fail the main branch\'s build on an overdue finding without a valid acceptance and on an expired acceptance',
      rationale: 'A written acceptance with an expiry date keeps the decision visible and brings it back for a new one; an open finding without one is a decision nobody made (NIST SSDF RV.2.2; Threat Modeling Manifesto: a dialogue about risk, recorded).',
      scenario: { label: 'Acceptance expires', given: 'a high finding accepted {{ACCEPTANCE_DAYS}} days ago with a reason and two signatures', when: 'the main branch builds the next day', then: 'the build fails naming the finding and its expired acceptance' },
    },
    {
      id: 'req-authz-tests', label: 'Negative tests on sensitive paths', ears_type: 'ubiquitous',
      action: 'cover every authorization-sensitive operation (reading or changing another user\'s or tenant\'s data, admin functions, object ids taken from the request) with negative tests that call it as the wrong user, the wrong tenant and anonymously and expect 403 or 404 and 401, kept in the pull-request suite',
      rationale: 'Broken access control is OWASP Top 10 A01:2021 and no scanner finds it, because the code is correct for the right user; only a test that is the wrong user does (ASVS 4.0.3 V4.1.1, V4.1.3; the rules themselves are decided in Authorization).',
      scenario: { label: 'Wrong user refused', given: 'order 42 that belongs to customer A', when: 'customer B and an anonymous caller GET /orders/42', then: 'customer B gets 404 or 403, the anonymous caller 401, and the test runs in the pull-request suite' },
    },
    {
      id: 'req-threat-model', label: 'Threat model per feature', when: { STANDARD: ['asvs-l2'] }, ears_type: 'event-driven',
      trigger: 'a change adds {{THREAT_MODEL_TRIGGER}}',
      action: 'update the feature\'s threat model (a STRIDE table in threat-model.md beside the code: asset, threat, mitigation, status) in the same pull request, with every threat mitigated or carried as a finding under its deadline, and have it reviewed before the merge',
      rationale: 'Level 2 asks for design-level controls, which no scanner verifies; a threat model kept beside the code and changed with it is the lightest form that stays true (ASVS 4.0.3 V1.1.2; Threat Modeling Manifesto: continuous, with the people who build the system).',
      scenario: { label: 'New endpoint modelled', given: 'a pull request that adds a public endpoint to a feature', when: 'it is reviewed', then: 'it changes the feature\'s threat-model.md with rows for the endpoint, the check finds every STRIDE category and 0 unmitigated rows, and a reviewer approved the table' },
    },
    {
      id: 'req-memory-safety', label: 'Memory safety rules', when: { STANDARD: ['cert-misra'] }, ears_type: 'ubiquitous',
      action: 'check every array index and buffer length before use, use only bounded string and memory functions (snprintf, strlcpy or strncpy_s, memcpy with a checked length), check integer arithmetic on sizes and indices for overflow, run the tests under AddressSanitizer and UndefinedBehaviorSanitizer, and ban gets, strcpy, strcat, sprintf, scanf without field widths, system and alloca by the analyser, with every deviation recorded',
      rationale: 'In unmanaged code the vulnerability class that matters is memory corruption, and the standards name the rules that prevent it (SEI CERT ARR30-C, STR31-C, INT30-C, ENV33-C; MISRA C:2023 Rule 21.6, Rule 21.8, Directive 4.11, Directive 4.14).',
      scenario: { label: 'Overflow refused', given: 'a function that copies a caller-supplied string into a fixed buffer', when: 'it is called with a string longer than the buffer under AddressSanitizer', then: 'the copy is truncated or refused with an error, the sanitizer reports 0 overflows, and the analyser flags 0 banned functions' },
    },
  ],
  adrs: [
    {
      id: 'adr-asvs-l1', label: 'OWASP ASVS level 1, verified by tools', when: { STANDARD: ['asvs-l1'] },
      decision: 'The code is held to OWASP ASVS Level 1 (4.0.3, moving to 5.0), and every Level 1 control is mapped to a lint rule, a test or a scanner rather than to a document. Data reaches the database only through parameterised queries or the ORM\'s query builder; output goes through the template engine\'s auto-escaping and raw-HTML sinks are banned by lint; eval, dynamic code, shell commands with interpolated strings and deserialisation of untrusted data are banned by lint (eslint-plugin-security with no-eval and react/no-danger, Bandit, gosec, SpotBugs find-sec-bugs by language); CSRF, CORS, cookie flags and security headers come from the framework\'s middleware with secure defaults. Input is {{INPUT}}. Static analysis: {{SAST}} (Semgrep with p/owasp-top-ten and p/default, CodeQL security-extended). Dynamic testing: {{DAST}} (OWASP ZAP). Findings are {{FINDINGS}}: critical within {{CRITICAL_DAYS}} days, high {{HIGH_DAYS}}, medium {{MEDIUM_DAYS}}. Authorization-sensitive paths have negative tests. Dependencies and base images are decided in Software supply chain, credentials in Secrets, who may call what in Authentication and Authorization.',
      consequences: '• Most of the standard is checked on every change by tools; a reviewer checks the rest from a short list.\n• Level 1 verifies code, not design: a feature with a flawed design passes if its code is clean, which is what Level 2\'s threat model adds.\n• Lint bans are blunt: the reporting query built from an allow-list of column names needs a suppression with a reason, and reviewers must read suppressions.\n• Needs a framework with auto-escaping and security middleware; hand-rolled HTTP handling has to add both.',
      alternatives: '1. ASVS Level 2: adds a threat model per feature and design-level controls; the right bar for personal, financial or health data.\n2. A language coding standard (SEI CERT, MISRA): for C, C++ and embedded code, where the classes of flaw are different.\n3. The OWASP Top 10 as the only checklist: an awareness document, too coarse to map to checks.',
    },
    {
      id: 'adr-asvs-l2', label: 'OWASP ASVS level 2 with a threat model per feature', when: { STANDARD: ['asvs-l2'] },
      decision: 'The code is held to OWASP ASVS Level 2 (4.0.3, moving to 5.0): every Level 1 control is mapped to a lint rule, a test or a scanner, and the design-level controls are carried by a threat model per feature, a STRIDE table in threat-model.md beside the feature\'s code, updated in the same pull request whenever a change adds {{THREAT_MODEL_TRIGGER}}, and reviewed before the merge; a check fails the build when a feature has no threat model or an unmitigated row. Data reaches the database only through parameterised queries or the ORM\'s query builder; output goes through the template engine\'s auto-escaping and raw-HTML sinks are banned by lint; eval, dynamic code, shell commands with interpolated strings and deserialisation of untrusted data are banned by lint (eslint-plugin-security, Bandit, gosec, SpotBugs find-sec-bugs by language); CSRF, CORS, cookie flags and security headers come from the framework\'s middleware. Input is {{INPUT}}. Static analysis: {{SAST}} (Semgrep with p/owasp-top-ten and p/default, CodeQL security-extended). Dynamic testing: {{DAST}} (OWASP ZAP). Findings are {{FINDINGS}}: critical within {{CRITICAL_DAYS}} days, high {{HIGH_DAYS}}, medium {{MEDIUM_DAYS}}. Authorization-sensitive paths have negative tests. Dependencies and base images are decided in Software supply chain, credentials in Secrets, who may call what in Authentication and Authorization.',
      consequences: '• Design flaws (a missing check on a new trust boundary, a data store nobody thought about) are found at the pull request, where they are cheap.\n• Every feature carries a threat model that must be kept true; a stale one is worse than none, so the check and the review are not optional.\n• Costs an hour or two per new trust boundary from the people who build the feature, not from a security team.\n• Level 2 also expects a verification by someone other than the author per release; plan a review or a penetration test cycle for it.',
      alternatives: '1. ASVS Level 1: the same tools without the threat model; enough where a design flaw is not a reportable incident.\n2. ASVS Level 3: adds verification of every control by a reviewer and architecture-level requirements; for systems where a breach endangers life or critical infrastructure.\n3. A threat model for the whole system once a year: cheaper, and stale by the second release.',
    },
    {
      id: 'adr-cert-misra', label: 'A language coding standard checked by an analyser', when: { STANDARD: ['cert-misra'] },
      decision: 'The code is held to a language coding standard: SEI CERT C/C++ (or CERT Java) for application and systems code, MISRA C:2023 where a safety standard or a customer asks for it. Compliance is checked by an analyser in CI, not by reading: clang-tidy with the cert-*, bugprone-* and clang-analyzer-* checks as errors, cppcheck with the MISRA add-on, or a certified analyser (PC-lint Plus, Polyspace, Coverity) where the safety case needs one; the compiler runs with -Wall -Wextra -Werror, -fstack-protector-strong and _FORTIFY_SOURCE=2, and the tests under AddressSanitizer and UndefinedBehaviorSanitizer. Every array index and buffer length is checked, only bounded string functions are used, integer arithmetic on sizes is checked for overflow, and gets, strcpy, strcat, sprintf, scanf without widths, system and alloca are banned by the analyser; each deviation is recorded with its justification in a deviation record the analyser reads. Input is {{INPUT}}. Static analysis: {{SAST}} (the analyser above, with Semgrep and CodeQL for C/C++ where available). Dynamic testing: {{DAST}} (OWASP ZAP where there is an HTTP surface; libFuzzer or AFL++ over every parser otherwise). Findings are {{FINDINGS}}: critical within {{CRITICAL_DAYS}} days, high {{HIGH_DAYS}}, medium {{MEDIUM_DAYS}}. Dependencies and toolchains are decided in Software supply chain, credentials in Secrets.',
      consequences: '• The flaws that matter in unmanaged code (overruns, overflows, use after free) are caught by the analyser and the sanitizers, not by the customer.\n• The analyser reports many findings on an existing codebase; adopt it with a baseline and fix new code first, or the warnings are ignored.\n• MISRA\'s rules forbid constructs application developers use daily; deviations need a record and a reviewer, which takes time and a person who owns the standard.\n• A certified analyser costs licences; clang-tidy and cppcheck cover most of CERT and much of MISRA for free.',
      alternatives: '1. ASVS Level 1 or 2: the web application classes of flaw; wrong for code where the problem is memory.\n2. Rewriting in a memory-safe language (Rust, Go): removes the class rather than checking for it; a project, not a rule.\n3. Sanitizers and fuzzing only, no coding standard: finds what the tests reach, and nothing in the paths they do not.',
    },
  ],
  fitness: [
    {
      id: 'ff-semgrep', label: 'Semgrep on the code', when: SAST_RUNS, category: 'structural', implements: STANDARDS,
      threshold: '0 findings of severity ERROR from p/owasp-top-ten and p/default; the run finishes within {{SAST_MINUTES}} minutes',
      description: 'Semgrep runs the OWASP Top Ten and default rulesets and exits non-zero on an ERROR-severity finding; on the pull request it is a required check with a hard timeout, on a schedule it uploads SARIF to code scanning, where the findings get owners.',
      tool: 'Semgrep (semgrep scan with p/owasp-top-ten and p/default)',
      language: 'yaml',
      snippet: `# .github/workflows/semgrep.yml
name: semgrep
on:
  pull_request:                        # blocking variant: a required check
  schedule: [{ cron: '0 3 * * *' }]    # scheduled variant: findings to the queue
jobs:
  semgrep:
    runs-on: ubuntu-latest
    timeout-minutes: {{SAST_MINUTES}}
    container: { image: semgrep/semgrep:1.90.0 }
    steps:
      - uses: actions/checkout@v4
      - run: semgrep scan --config p/owasp-top-ten --config p/default --config .semgrep
          --severity ERROR --error --sarif --output semgrep.sarif
      - if: always()
        uses: github/codeql-action/upload-sarif@v3
        with: { sarif_file: semgrep.sarif }`,
    },
    {
      id: 'ff-codeql', label: 'CodeQL security-extended', when: SAST_RUNS, category: 'structural', implements: STANDARDS,
      threshold: '0 open code scanning alerts of severity high or critical on the pull request; the CodeQL check is required for merging',
      description: 'CodeQL analyses every supported language of the repository with the security-extended query suite; code scanning\'s pull-request check is set to fail on high or above and is a required status check in branch protection.',
      tool: 'GitHub CodeQL (github/codeql-action)',
      language: 'yaml',
      snippet: `# .github/workflows/codeql.yml
name: codeql
on:
  pull_request: { branches: [main] }
  push: { branches: [main] }
permissions: { contents: read, security-events: write }
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy: { matrix: { language: [javascript-typescript, python, cpp] } }
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with: { languages: \${{ matrix.language }}, queries: security-extended }
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
# Settings > Code security > Code scanning: "Check failure: High or higher";
# branch protection requires the "CodeQL" check`,
    },
    {
      id: 'ff-language-scanner', label: 'The language\'s security scanner', when: SAST_RUNS, category: 'structural', implements: STANDARDS,
      threshold: '0 high-severity, medium-confidence-or-better findings from the language\'s scanner outside its suppressions, each suppression with a comment',
      description: 'Bandit (Python) and gosec (Go) run in the same job as Semgrep with their configuration in the repository, so their suppressions are reviewed like code; the JVM uses SpotBugs with find-sec-bugs, .NET the Security Code Scan analyzers.',
      tool: 'Bandit and gosec (SpotBugs find-sec-bugs, Security Code Scan for other stacks)',
      language: 'toml',
      snippet: `# pyproject.toml
[tool.bandit]
exclude_dirs = ["tests", ".venv"]
skips = []                      # every skip needs a reviewed reason here
# CI: bandit -c pyproject.toml -r src --severity-level high --confidence-level medium
#     (exits 1 on a finding; suppress a line with  # nosec B608: <reason>)

# Go, in the same job:
#   gosec -severity high -confidence medium -fmt sarif -out gosec.sarif ./...
#     (exits 1 on a finding; suppress with  // #nosec G201 -- <reason>)`,
    },
    {
      id: 'ff-eslint-security', label: 'ESLint bans dangerous constructs', when: WEB, category: 'structural', implements: WEB_ADRS,
      threshold: '0 errors from eslint-plugin-security, no-eval, no-implied-eval, no-new-func and react/no-danger; the lint is a required check',
      description: 'The flat ESLint configuration turns the security plugin\'s rules and the core eval rules into errors and bans raw HTML in React; a disable comment needs a description, which eslint-comments/require-description enforces. Python and Java get the same bans from Bandit (B307 eval, B301 pickle) and find-sec-bugs.',
      tool: 'ESLint with eslint-plugin-security and eslint-plugin-react',
      language: 'js',
      snippet: `// eslint.config.js
import security from 'eslint-plugin-security'
import react from 'eslint-plugin-react'
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs'

export default [
  security.configs.recommended,
  comments.recommended,
  {
    plugins: { react },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-child-process': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-non-literal-fs-filename': 'error',
      'react/no-danger': 'error',
      'no-restricted-properties': ['error', { object: 'document', property: 'write' }],
      '@eslint-community/eslint-comments/require-description': 'error',
    },
  },
]`,
    },
    {
      id: 'ff-sqli-lint', label: 'No string-built queries', category: 'structural', implements: STANDARDS,
      threshold: '0 queries built by concatenation or interpolation in the code; the rule is ERROR severity and part of the pull-request lint',
      description: 'A Semgrep rule kept in the repository matches query calls whose SQL is a template literal with an expression, a concatenation or a format call, and fails the pull request. SonarQube rules S2077 (formatted SQL) and S3649 (SQL injection) do the same for Java and C#, Bandit B608 for Python.',
      tool: 'Semgrep (a repository rule) and SonarQube S2077 / S3649',
      language: 'yaml',
      snippet: `# .semgrep/sql-string-built.yml   (run with: semgrep scan --config .semgrep --error)
rules:
  - id: sql-string-built
    message: SQL built from a string; bind the value as a parameter (ADR Secure coding)
    severity: ERROR
    languages: [javascript, typescript]
    metadata: { cwe: "CWE-89", owasp: "A03:2021" }
    patterns:
      - pattern-either:
          - pattern: $DB.query(\`...\${$X}...\`, ...)
          - pattern: $DB.query($A + $B, ...)
          - pattern: $DB.query(\`...\`.concat(...), ...)
          - pattern: $DB.raw(\`...\${$X}...\`)
          - pattern: $KNEX.whereRaw(\`...\${$X}...\`)
      - metavariable-regex: { metavariable: $DB, regex: (?i)(db|pool|client|conn|sequelize|knex|prisma) }`,
    },
    {
      id: 'ff-zap-baseline', label: 'ZAP scan of each deployment', when: { DAST: ['pipeline'] }, category: 'operational', implements: STANDARDS,
      threshold: '0 ZAP alerts at level FAIL against every environment the pipeline deploys to; the scan finishes within 30 minutes of the deployment',
      description: 'A workflow listens for successful deployments and runs the ZAP baseline scan against the environment\'s URL; the rules file raises the alerts that must block (injection, missing CSP, cookie flags) to FAIL and turns known noise to IGNORE with a comment. APIs use zaproxy/action-api-scan with the OpenAPI document.',
      tool: 'OWASP ZAP (zaproxy/action-baseline)',
      language: 'yaml',
      snippet: `# .github/workflows/dast.yml
name: dast
on: [deployment_status]
jobs:
  zap:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: zaproxy/action-baseline@v0.14.0
        with:
          target: \${{ github.event.deployment_status.environment_url }}
          rules_file_name: .zap/rules.tsv
          cmd_options: '-a -j'          # alpha rules, AJAX spider
          fail_action: true
          allow_issue_writing: false
# .zap/rules.tsv (id<TAB>action<TAB>comment):
# 40018	FAIL	SQL Injection
# 10038	FAIL	Content Security Policy header missing
# 10054	FAIL	Cookie without SameSite`,
    },
    {
      id: 'ff-dast-age', label: 'Dynamic test not older than the limit', when: { DAST: ['periodic'] }, category: 'process', implements: STANDARDS,
      threshold: 'The newest ZAP full scan or penetration test report of the production configuration is at most {{DAST_DAYS}} days old and holds 0 open high or critical alerts',
      description: 'A quarterly workflow runs the ZAP full scan against staging and commits its report to security/dast/; a daily check fails when the newest report (scan or penetration test, named by date) is older than the limit or still holds high alerts.',
      tool: 'OWASP ZAP (zaproxy/action-full-scan) and a check over the reports',
      language: 'bash',
      snippet: `# the scan (workflow on a cron, e.g. '0 3 1 */3 *'):
#   - uses: zaproxy/action-full-scan@v0.12.0
#     with: { target: https://staging.shop.example, cmd_options: '-J report.json', fail_action: false }
#   then: cp report.json "security/dast/$(date +%F)-zap-staging.json" and commit
# the daily check:
latest=$(ls security/dast/*.json | sort | tail -1)     # YYYY-MM-DD-<scope>.json
report_date=$(basename "$latest" | cut -c1-10)
age=$(( ( $(date +%s) - $(date -d "$report_date" +%s) ) / 86400 ))
[ "$age" -le {{DAST_DAYS}} ] || { echo "newest dynamic test $report_date is $age days old"; exit 1; }
jq -e '[.site[].alerts[] | select((.riskcode | tonumber) >= 3)] | length == 0' "$latest" \\
  || { echo "$latest still holds high alerts"; exit 1; }`,
    },
    {
      id: 'ff-input-400', label: 'Malformed input answered 400 with the field', when: { INPUT: ['boundary-schema'] }, category: 'structural', implements: STANDARDS,
      threshold: '100 % of the element\'s operations answer 400 naming the failing field to a wrong type, an unknown field and an out-of-range value, with no stack trace in the body',
      description: 'A test sends each operation a body with a wrong type, an unknown field and an out-of-range value and expects 400 with the field\'s path in the errors and no stack trace; the zod schemas are strict, so unknown fields are refused. With Pydantic, model_config = ConfigDict(extra=\'forbid\') and an exception handler that maps the validation error to 400 with its loc.',
      tool: 'Vitest with supertest over zod schemas (pytest with FastAPI\'s TestClient over Pydantic)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { app } from '../src/app'

describe.each([
  [{ quantity: 'two', email: 'a@b.example' }, 'quantity'],          // wrong type
  [{ quantity: 1, email: 'a@b.example', extra: 'x' }, 'extra'],     // unknown field: schema is strict
  [{ quantity: 10_001, email: 'a@b.example' }, 'quantity'],         // out of range
])('POST /orders with %j', (body, field) => {
  it(\`answers 400 naming \${field}\`, async () => {
    const res = await request(app).post('/orders').send(body).expect(400)
    expect(res.body.errors.map((e: { path: string }) => e.path)).toContain(field)
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules|\\bat \\w+ \\(/)   // no stack trace
  })
})`,
    },
    {
      id: 'ff-findings-sla', label: 'No finding past its deadline', when: { FINDINGS: ['sla'] }, category: 'operational', implements: STANDARDS,
      threshold: '0 open code scanning alerts older than {{CRITICAL_DAYS}} days (critical), {{HIGH_DAYS}} days (high) or {{MEDIUM_DAYS}} days (medium)',
      description: 'A job on the main branch reads the repository\'s open code scanning alerts (Semgrep, CodeQL, ZAP and the language scanners all upload SARIF there) and fails on any past its severity\'s deadline, naming the rule and the file. Penetration test findings are filed as alerts through a SARIF upload so the same check covers them.',
      tool: 'GitHub code scanning alerts API through the GitHub CLI',
      language: 'bash',
      snippet: `gh api --paginate "/repos/$REPO/code-scanning/alerts?state=open&per_page=100" | jq -e \\
  --argjson crit {{CRITICAL_DAYS}} --argjson high {{HIGH_DAYS}} --argjson med {{MEDIUM_DAYS}} '
  [.[] | {sev: .rule.security_severity_level, age: ((now - (.created_at | fromdateiso8601)) / 86400),
          rule: .rule.id, file: .most_recent_instance.location.path}
       | select((.sev == "critical" and .age > $crit) or (.sev == "high" and .age > $high)
                or (.sev == "medium" and .age > $med))]
  | if length > 0 then (map("\\(.rule) \\(.file) \\(.sev) \\(.age | floor)d") | join("\\n") | halt_error(1)) else true end'`,
    },
    {
      id: 'ff-risk-register', label: 'Risk acceptances complete and current', when: { FINDINGS: ['risk-accepted'] }, category: 'process', implements: STANDARDS,
      threshold: '0 overdue findings without a valid acceptance; 0 acceptances without owner, second approver, reason and expiry, expired, or valid longer than {{ACCEPTANCE_DAYS}} days',
      description: 'A test over the register security/risk-acceptances.yaml fails on an incomplete, self-approved, expired or over-long acceptance; the deadline job over the code scanning alerts skips only the alerts the register names, so an overdue finding without an acceptance still fails the build.',
      tool: 'Vitest over the risk register',
      language: 'ts',
      snippet: `import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { expect, it } from 'vitest'

// security/risk-acceptances.yaml:
// - { finding: "CodeQL js/sql-injection src/report.ts:42", owner: "ola", approver: "sec-team/marek",
//     reason: "allow-listed column names; module replaced in Q1", controls: "WAF rule 942100", accepted: 2026-10-01, expires: 2026-12-30 }
type Acceptance = { finding: string; owner: string; approver: string; reason: string; accepted: string; expires: string }
const register: Acceptance[] = parse(readFileSync('security/risk-acceptances.yaml', 'utf8')) ?? []
const DAY = 86_400_000

it('every risk acceptance is complete, approved by a second person and current', () => {
  const bad = register.filter((r) =>
    !r.finding || !r.owner || !r.approver || r.owner === r.approver || !r.reason
    || Date.parse(r.expires) < Date.now()
    || (Date.parse(r.expires) - Date.parse(r.accepted)) / DAY > {{ACCEPTANCE_DAYS}})
  expect(bad.map((r) => r.finding)).toEqual([])
})`,
    },
    {
      id: 'ff-clang-tidy', label: 'CERT and MISRA checks as errors', when: { STANDARD: ['cert-misra'] }, category: 'structural', implements: ['adr-cert-misra'],
      threshold: '0 warnings from the cert-*, bugprone-* and clang-analyzer-* checks and 0 MISRA violations outside recorded deviations; the build fails on any',
      description: 'clang-tidy runs over the compilation database with the CERT, bugprone and analyzer checks as errors and the unsafe-functions check naming the banned functions; cppcheck\'s MISRA add-on runs beside it with the rule texts, and suppressions live in a deviation file reviewed like code. The tests run under the sanitizers in a second configuration.',
      tool: 'clang-tidy and cppcheck --addon=misra (PC-lint Plus or Polyspace where the safety case needs a certified analyser)',
      language: 'yaml',
      snippet: `# .clang-tidy   (CI: run-clang-tidy -p build -quiet; exits non-zero on an error)
Checks: >
  -*, cert-*, bugprone-*, clang-analyzer-*, misc-*,
  cppcoreguidelines-pro-bounds-array-to-pointer-decay,
  cppcoreguidelines-pro-bounds-constant-array-index
WarningsAsErrors: 'cert-*,bugprone-*,clang-analyzer-*'
CheckOptions:
  - { key: bugprone-unsafe-functions.ReportDefaultFunctions, value: true }
  - { key: bugprone-unsafe-functions.CustomFunctions,
      value: '^::gets$,fgets,;^::strcpy$,strlcpy,;^::strcat$,strlcat,;^::sprintf$,snprintf,;^::system$,,;^::alloca$,,' }
# MISRA C:2023, in the same job:
#   cppcheck --addon=misra.json --enable=warning,style --error-exitcode=1 \\
#            --suppressions-list=misra-deviations.txt --project=build/compile_commands.json
# sanitizers: cmake -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer" && ctest`,
    },
    {
      id: 'ff-threat-model', label: 'Every feature has a current threat model', when: { STANDARD: ['asvs-l2'] }, category: 'process', implements: ['adr-asvs-l2'],
      threshold: '100 % of feature directories hold a threat-model.md with a row for each STRIDE category and 0 rows with status open or unmitigated',
      description: 'A check in the pull-request pipeline walks the feature directories and fails when one has no threat-model.md, its table lacks a STRIDE category, or a row is still open; a CODEOWNERS entry for threat-model.md makes a security reviewer\'s approval required when it changes.',
      tool: 'A shell check in CI with CODEOWNERS',
      language: 'bash',
      snippet: `# fails when a feature has no threat model, a STRIDE category is missing, or a threat is unmitigated
status=0
for feature in src/features/*/; do
  tm="\${feature}threat-model.md"
  [ -f "$tm" ] || { echo "$feature: no threat-model.md"; status=1; continue; }
  for category in Spoofing Tampering Repudiation "Information disclosure" "Denial of service" "Elevation of privilege"; do
    grep -qi "^| *$category" "$tm" || { echo "$tm: no row for $category"; status=1; }
  done
  if grep -qiE '\\| *(open|unmitigated) *\\|' "$tm"; then echo "$tm: unmitigated threat"; status=1; fi
done
exit $status
# CODEOWNERS:  **/threat-model.md  @our-org/security-reviewers`,
    },
  ],
}

export default pack
