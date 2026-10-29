import type { PackSpec } from '../../src/packSpec'

const LEVELS = ['adr-sev4', 'adr-three', 'adr-itsm']
const TOOL = 'The incident tool is incident.io: severities, incident types, roles and the custom fields Customer facing (Yes or No), Caused by deployment (the GitHub deployment id) and DORA major incident (Yes or No), and the timestamp Resolved at, set when the incident leaves its active statuses. Every incident gets a Slack or Microsoft Teams channel of its own and is announced in one #incidents channel. PagerDuty Incident Management, FireHydrant, Rootly and Grafana IRM offer the same records, and the checks name their equivalents. Opsgenie is not an option: Atlassian ended its sale on 4 June 2025 and ends its support on 5 April 2027, moving its users to Jira Service Management or Compass.'
const SHARED = 'An incident classified as major under the EU Digital Operational Resilience Act is put on the highest level for as long as it is major, whatever else its impact suggests, and the field DORA major incident says so; whether it is major, the thresholds and the reporting deadlines are the EU DORA pack\'s. A security alert from the detection the Security event logging and detection pack decides becomes an incident of type Security once the person triaging it confirms it: a private incident, on the same levels by impact. An incident that may be a breach of personal data brings in the data protection officer at declaration, and the breach is assessed and notified as the Personal data pack decides. When in doubt between two levels, the higher one is taken and corrected later. The levels, their examples and what each sets off are written in docs/incidents/severity.md.'
const FORCES = 'This system serves customers, and some day it fails them: an outage, wrong results, a leak. The forces: in the first minutes nobody knows how bad it is, and an argument about severity costs the time the fix needs; the engineer who knows the system best is the worst person to also coordinate, update the business and answer customers; customers forgive an outage they were told about more readily than one they discovered, and silence is filled with guesses; a regulator may need a report within hours of an incident becoming major; and an incident nobody learns from comes back, while a review that looks for someone to blame teaches people to hide the next one. Who is paged and how alerts are routed is the Observability pack\'s; the availability objective and its error budget the Availability pack\'s; how a release is rolled back the Deployment pack\'s; how a failed deployment is counted the Delivery metrics pack\'s; the classification and reporting of major ICT-related incidents to the authority the EU DORA pack\'s; what is detected as a security event the Security event logging and detection pack\'s; and the assessment and notification of a breach of personal data the Personal data pack\'s.'

const pack: PackSpec = {
  id: 'concern-incident-management',
  name: 'Incident management',
  group: 'operability',
  description: 'What happens once something has gone wrong: how an incident is declared and classified by severity, who leads it, how customers and stakeholders are told, how it is closed, and how the team learns from it. The snippets are Node 20 scripts over the incident.io API, Atlassian Statuspage and the GitHub Deployments API, and a bash check of the severity definitions.',
  tags: ['operability', 'incident management', 'severity', 'incident command', 'status page', 'postmortem'],
  concern: {
    id: 'incident-management',
    trigger: 'LIST NODES WHERE type = "system" AND external != true',
    why: 'this system serves people who notice when it fails, so how an incident is declared, led, communicated and learned from has to be decided.',
  },
  sources: [
    { title: 'Google, Site Reliability Engineering, chapter 14: Managing Incidents', url: 'https://sre.google/sre-book/managing-incidents/' },
    { title: 'Google, Site Reliability Engineering, chapter 15: Postmortem Culture: Learning from Failure', url: 'https://sre.google/sre-book/postmortem-culture/' },
    { title: 'PagerDuty Incident Response: Severity Levels', url: 'https://response.pagerduty.com/before/severity_levels/' },
    { title: 'PagerDuty Incident Response: Incident Commander', url: 'https://response.pagerduty.com/training/incident_commander/' },
    { title: 'PagerDuty Incident Response: Postmortem Process', url: 'https://response.pagerduty.com/after/post_mortem_process/' },
    { title: 'Atlassian Incident Management Handbook: Responding to an incident', url: 'https://www.atlassian.com/incident-management/handbook/incident-response' },
    { title: 'Atlassian Incident Management Handbook: Postmortems', url: 'https://www.atlassian.com/incident-management/handbook/postmortems' },
    { title: 'Atlassian: Understanding incident severity levels', url: 'https://www.atlassian.com/incident-management/kpis/severity-levels' },
    { title: 'ITIL 4 Practice Guide: Incident Management (Axelos)', url: 'https://www.axelos.com/resource-hub/practice/incident-management-itil-4-practice-guide' },
    { title: 'ServiceNow: Define priority lookup rules (priority from impact and urgency)', url: 'https://www.servicenow.com/docs/r/it-service-management/incident-management/def-prio-lookup-rules.html' },
    { title: 'incident.io API reference (OpenAPI: incidents, severities, incident updates, follow-ups, post-mortem documents)', url: 'https://docs.incident.io/api-reference' },
    { title: 'Atlassian Statuspage REST API', url: 'https://developer.statuspage.io/' },
    { title: 'GitHub REST API: deployment statuses', url: 'https://docs.github.com/en/rest/deployments/statuses' },
    { title: 'Atlassian: Opsgenie end of sale and end of support', url: 'https://www.atlassian.com/licensing/opsgenie' },
    { title: 'Commission Delegated Regulation (EU) 2024/1772: criteria for classifying ICT-related incidents and materiality thresholds for major incidents', url: 'https://eur-lex.europa.eu/eli/reg_del/2024/1772/oj' },
    { title: 'Regulation (EU) 2016/679 (GDPR), Article 33: notification of a personal data breach', url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj' },
  ],
  questions: [
    {
      key: 'SEVERITY', title: 'Severity', label: 'How are incidents classified by severity?',
      hint: 'The level decides everything that follows: who is woken, who leads, whether customers are told and whether a postmortem is written. Each scheme defines its levels by customer impact with examples; the two highest levels are the top severities that get the full response. How a major incident under the EU DORA rules maps is decided here for every scheme; its classification stays in the EU DORA pack.',
      default: 'sev4',
      options: [
        { value: 'sev4', label: 'four severity levels by customer impact (SEV1 to SEV4)', description: 'SEV1 all or most customers cannot use a core function or data is lost or leaked; SEV2 some customers cannot; SEV3 a minor function is degraded with a workaround; SEV4 no customer impact yet, a risk to act on in working hours. SEV1 and SEV2 are the top severities. Pick it for a product team running its own services: enough levels to separate waking someone from the next working day, few enough to choose in seconds.' },
        { value: 'three', label: 'three levels (critical, major, minor)', description: 'Critical very high impact (a full outage, a data breach), major significant impact for some customers, minor low impact handled in working hours: incident.io\'s default levels and Atlassian\'s three-level scale. Critical and major are the top severities. Pick it for a small team or a first incident process, where a fourth level would only be argued about.' },
        { value: 'itsm', label: 'the ITIL priority of the ITSM tool (P1 to P5)', description: 'The priority comes from the ITSM tool\'s impact and urgency matrix (ITIL 4 incident management; ServiceNow\'s priority lookup rules give P1 Critical to P5 Planning), and the response uses the same five levels. P1 and P2 are the top severities. Pick it when the organisation already runs ServiceNow or Jira Service Management with that matrix and the service desk opens incidents there.' },
      ],
    },
    {
      key: 'COMMAND', title: 'Leadership', label: 'Who leads an incident of the top severities?',
      hint: 'Coordinating and fixing are two jobs; under pressure one person doing both does neither well. Incidents below the top severities are always led by the on-call engineer.',
      default: 'commander',
      options: [
        { value: 'commander', label: 'an incident commander from a rota, apart from those fixing it', description: 'A trained commander is paged from a rota of their own, takes the lead role, coordinates, decides and sees that people are told, and changes nothing in the system; the on-call engineers and the experts they call do the fixing (Google SRE incident command; PagerDuty\'s Incident Commander). Pick it when at least four people can be trained for the rota and outages cross teams or last hours.' },
        { value: 'oncall', label: 'the on-call engineer who was paged', description: 'The paged engineer leads the incident and names a teammate to handle communication for a top-severity one, handing the lead over explicitly when it outgrows them or the shift ends. Pick it for one team that owns the whole system, where a separate rota would be the same few people.' },
      ],
    },
    {
      key: 'COMMS', title: 'Communication', label: 'How are customers told?',
      hint: 'Stakeholders inside get regular updates in the incident tool either way; this decides how customers learn of an incident that affects them. The Observability pack\'s working-hours alerting and the Availability pack\'s announced maintenance window both assume a public status page.',
      default: 'statuspage',
      options: [
        { value: 'statuspage', label: 'a public status page', description: 'Every customer-facing incident is published on a status page (Atlassian Statuspage, Instatus, Better Stack or incident.io Status Pages) within minutes and updated on a fixed cadence until it is resolved; customers subscribe for e-mail or webhook notices. Pick it for products with many customers, or whenever the Observability pack alerts only in working hours or the Availability pack announces maintenance windows.' },
        { value: 'direct', label: 'direct messages to the affected customers', description: 'Support tells the affected customers by e-mail or in the product, from the incident\'s list of who is affected, and tells them again when it is over; there is no public page. Pick it for a few business customers with named contacts and contracts, where a public page would show more than any one customer needs, and only when no other pack relies on a status page.' },
      ],
    },
    {
      key: 'POSTMORTEM', title: 'Learning', label: 'How does the team learn from an incident of the top severities?',
      hint: 'Postmortems pay off only when they are written soon, blame nobody, and their actions are finished. Actions from either way are tracked to closure.',
      default: 'blameless',
      options: [
        { value: 'blameless', label: 'a blameless postmortem with tracked actions', description: 'Every top-severity incident gets a written postmortem within a week of being resolved (impact, timeline, contributing factors, actions), discussed in a meeting with the responders and naming no one as the cause; its actions are tracked to closure (Google SRE postmortem culture; PagerDuty and Atlassian postmortems). Pick it by default, and always when incidents cross teams or customers ask for a report.' },
        { value: 'retro', label: 'a short review in the next team retrospective', description: 'The team reviews each top-severity incident in its next retrospective, writes the outcome into the incident and closes it; actions are tracked as with a postmortem. Pick it for one small team with few incidents, where a separate document and meeting would be ceremony; supersede it when the same incident comes back.' },
      ],
    },
  ],
  details: [
    { key: 'DECLARE_MINUTES', label: 'Within how many minutes of the first sign of customer impact is an incident declared?', default: '15', number: true },
    { key: 'COMMAND_MINUTES', label: 'Within how many minutes of declaring a top-severity incident is its lead assigned?', default: '15', number: true },
    { key: 'STATUS_MINUTES', label: 'Within how many minutes of declaring a customer-facing incident are customers told?', default: '15', number: true },
    { key: 'UPDATE_MINUTES', label: 'How many minutes may pass between two updates on a live top-severity incident?', default: '30', number: true },
    { key: 'POSTMORTEM_DAYS', label: 'Within how many days of resolution is the postmortem completed? (a blameless postmortem only)', default: '7', number: true },
    { key: 'RETRO_DAYS', label: 'Within how many days of resolution is the incident reviewed in a retrospective? (a review in the retrospective only)', default: '14', number: true },
    { key: 'ACTION_DAYS', label: 'Within how many days is an action from a postmortem or review done or dropped with a reason?', default: '56', number: true },
  ],
  need: {
    label: 'Incidents are handled and learned from',
    text: 'When the system fails its customers, the team has to recognise it quickly, agree how bad it is, put one person in charge, keep customers and the business told, get service back, and make the same failure less likely. Without an agreed process every incident is improvised, the loudest guess sets the severity, the best engineer is buried in messages, and the lessons are lost. The checks assume the severity definitions in docs/incidents/severity.md and Node 20 scripts under scripts/incidents/ that a daily CI job runs with read-only keys for incident.io (INCIDENT_IO_API_KEY), Atlassian Statuspage (STATUSPAGE_API_KEY, STATUSPAGE_PAGE_ID) and GitHub (GITHUB_TOKEN).',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-classify', label: 'Incidents classified by severity', ears_type: 'ubiquitous',
      action: 'classify every incident at declaration on {{SEVERITY}}, as docs/incidents/severity.md defines each level by its impact with examples, take the higher level when in doubt, record it in the incident tool and change it there as the impact becomes known',
      rationale: 'Levels agreed before the incident end the argument during it, and choosing the higher one when unsure costs less than an under-staffed response (PagerDuty, Severity Levels; Atlassian, Understanding incident severity levels).',
      scenario: { label: 'Severity defined and set', given: 'the severity definitions and an incident declared without a level', when: 'the definitions are checked and the daily incident check runs', then: 'each level has its impact, examples, response and review written down, and the incident without a level is reported' },
    },
    {
      id: 'req-declare', label: 'Incidents declared early', ears_type: 'event-driven',
      trigger: 'an alert routed as the Observability pack decides, a customer report or an engineer\'s own observation shows customer impact, or a problem needs a second team or is still unsolved after an hour of concentrated work',
      action: 'declare an incident in the incident tool within {{DECLARE_MINUTES}} minutes, with a level and a channel of its own named after the incident\'s reference',
      rationale: 'Google SRE declares an incident when a second team is needed, customers see the outage, or an hour of analysis has not solved it; declaring early and standing down is cheaper than organising late (Site Reliability Engineering, chapter 14).',
      scenario: { label: 'Customer report declared', given: 'a customer report that checkout fails', when: '{{DECLARE_MINUTES}} minutes have passed', then: 'an incident exists in the incident tool with a level and its own channel, and the daily check finds none without them' },
    },
    {
      id: 'req-dora', label: 'DORA major incidents at the highest level', ears_type: 'event-driven',
      trigger: 'an incident is classified as major under the EU Digital Operational Resilience Act, as the EU DORA pack decides',
      action: 'put it on the highest level of the scheme for as long as it stays major, and mark it in the incident\'s field DORA major incident',
      rationale: 'A major ICT-related incident affects critical services and meets the materiality thresholds (Delegated Regulation (EU) 2024/1772); its reports are due within hours, so the response must be the fullest one, and the level must not hide it.',
      scenario: { label: 'Major incident raised', given: 'an incident on the second level', when: 'it is classified as major under DORA', then: 'it is on the highest level, its field DORA major incident says Yes, and the daily check reports any major one below the highest level' },
    },
    {
      id: 'req-security', label: 'Confirmed security alerts become private incidents', ears_type: 'event-driven',
      trigger: 'the person triaging a security alert from the detection the Security event logging and detection pack decides confirms it',
      action: 'declare it as an incident of type Security that only invited responders can see, on the same levels by impact',
      rationale: 'A security incident needs the same command and communication as an outage, but its details must not reach everyone with access to the incident tool while an attacker may still be inside (Atlassian, Responding to an incident).',
      scenario: { label: 'Security incident private', given: 'a confirmed alert of credential stuffing', when: 'it is declared', then: 'it is an incident of type Security, private to the invited responders, with a level, and the daily check reports any Security incident that is not private' },
    },
    {
      id: 'req-commander', label: 'A commander leads', when: { COMMAND: ['commander'] }, ears_type: 'event-driven',
      trigger: 'an incident on one of the two highest levels is declared',
      action: 'page the commander rota and give the incident\'s lead role to the commander within {{COMMAND_MINUTES}} minutes; the commander coordinates, decides and sees that people are told, makes no change to the system, and hands command over only by reassigning the role',
      rationale: 'Separating command from the hands-on work keeps someone looking at the whole incident; a recorded handover keeps it clear who leads (Site Reliability Engineering, chapter 14; PagerDuty, Incident Commander).',
      scenario: { label: 'Commander takes the lead', given: 'an incident declared on the highest level', when: '{{COMMAND_MINUTES}} minutes have passed', then: 'a commander from the rota holds the lead role, the engineers fixing it hold other roles, and the daily check finds no top-severity incident without a lead' },
    },
    {
      id: 'req-oncall-lead', label: 'The on-call engineer leads', when: { COMMAND: ['oncall'] }, ears_type: 'event-driven',
      trigger: 'an incident on one of the two highest levels is declared',
      action: 'give the incident\'s lead role to the paged on-call engineer within {{COMMAND_MINUTES}} minutes, have them name a teammate for communication, and record every handover by reassigning the role',
      rationale: 'In one small team the on-call engineer knows the most; naming a communicator keeps the updates from waiting on the fix, and a recorded handover keeps it clear who leads (Site Reliability Engineering, chapter 14).',
      scenario: { label: 'On-call engineer takes the lead', given: 'an incident declared on the second level at night', when: '{{COMMAND_MINUTES}} minutes have passed', then: 'the paged engineer holds the lead role, a teammate handles communication, and the daily check finds no top-severity incident without a lead' },
    },
    {
      id: 'req-status-page', label: 'Status page tells customers', when: { COMMS: ['statuspage'] }, ears_type: 'event-driven',
      trigger: 'an incident with customer impact is declared',
      action: 'publish an incident on the public status page within {{STATUS_MINUTES}} minutes of the declaration, link it in the incident\'s field Status page incident, update it at least every {{UPDATE_MINUTES}} minutes and resolve it when the impact ends',
      rationale: 'Telling customers quickly that the problem is known, and when they will hear more, builds trust and cuts the support load (Atlassian, Responding to an incident).',
      scenario: { label: 'Customers see the incident', given: 'an incident marked customer facing', when: 'it runs for an hour and is resolved', then: 'the linked status page incident was created within {{STATUS_MINUTES}} minutes of the declaration, no two updates are more than {{UPDATE_MINUTES}} minutes apart, and it is resolved' },
    },
    {
      id: 'req-direct', label: 'Affected customers told directly', when: { COMMS: ['direct'] }, ears_type: 'event-driven',
      trigger: 'an incident with customer impact is declared',
      action: 'tell the affected customers\' named contacts by e-mail or in the product within {{STATUS_MINUTES}} minutes of the declaration, record the time in the incident\'s timestamp Customers notified at, and tell them again when the impact ends',
      rationale: 'Without a public page, a customer hears only what support sends; recording the time is how the team shows it did (Atlassian, Responding to an incident).',
      scenario: { label: 'Customers told in time', given: 'an incident marked customer facing', when: '{{STATUS_MINUTES}} minutes have passed', then: 'the timestamp Customers notified at is set no later than {{STATUS_MINUTES}} minutes after the declaration, or the daily check reports it' },
    },
    {
      id: 'req-stakeholders', label: 'Stakeholders updated on a cadence', ears_type: 'state-driven',
      precondition: 'an incident on one of the two highest levels is live',
      action: 'post an update in the incident tool, announced in #incidents, at least every {{UPDATE_MINUTES}} minutes, with the impact, the current status, the next steps and when the next update comes',
      rationale: 'Regular updates with the time of the next one stop stakeholders from interrupting the responders to ask (Site Reliability Engineering, chapter 14: the communication role; Atlassian, Responding to an incident).',
      scenario: { label: 'Updates keep coming', given: 'a live incident on the highest level', when: 'two hours pass before it is resolved', then: 'no two of its updates, counted from the declaration to the resolution, are more than {{UPDATE_MINUTES}} minutes apart' },
    },
    {
      id: 'req-deploy-failure', label: 'Failed deployments marked at close-out', ears_type: 'event-driven',
      trigger: 'an incident caused by a production deployment is resolved by an intervention other than a rollback or hotfix deployment, such as a feature flag or a setting switched off',
      action: 'record the deployment in the incident\'s field Caused by deployment and post a failure status on that deployment in the GitHub Deployments API within 1 working day, naming the incident and the intervention, as the Delivery metrics pack counts failures; rollback and hotfix deploy jobs post it themselves',
      rationale: 'The Delivery metrics pack counts a deployment as failed when it needed immediate intervention, from the failure status on the deployment; an intervention without a deployment is seen only if the incident process marks it (GitHub REST API: deployment statuses).',
      scenario: { label: 'Flag switched off marks the deployment', given: 'deployment 41 that broke checkout, fixed by switching its feature flag off', when: 'the incident is resolved and 1 working day passes', then: 'deployment 41 carries a failure status naming the incident and the flag, and the incident\'s field Caused by deployment says 41' },
    },
    {
      id: 'req-postmortem', label: 'Blameless postmortem', when: { POSTMORTEM: ['blameless'] }, ears_type: 'event-driven',
      trigger: 'an incident on one of the two highest levels is resolved',
      action: 'complete a blameless postmortem within {{POSTMORTEM_DAYS}} days, with the impact, the timeline, the contributing factors and the actions, discussed with the responders and naming no person as the cause',
      rationale: 'A postmortem written soon, by people who are not afraid of it, finds the contributing causes; PagerDuty schedules it within days and Atlassian requires it for severity 1 and 2 (Site Reliability Engineering, chapter 15; PagerDuty, Postmortem Process; Atlassian, Postmortems).',
      scenario: { label: 'Postmortem done in time', given: 'an incident on the highest level, resolved', when: '{{POSTMORTEM_DAYS}} days have passed', then: 'its postmortem document is completed, and the daily check reports any top-severity incident without one' },
    },
    {
      id: 'req-retro', label: 'Reviewed in the retrospective', when: { POSTMORTEM: ['retro'] }, ears_type: 'event-driven',
      trigger: 'an incident on one of the two highest levels is resolved',
      action: 'review it in the team\'s next retrospective within {{RETRO_DAYS}} days, write the outcome and the actions into the incident, and close it',
      rationale: 'Even a short review, held while the incident is fresh, turns it into actions; closing the incident is the record that it was held (Site Reliability Engineering, chapter 15).',
      scenario: { label: 'Review closes the incident', given: 'an incident on the second level, resolved', when: '{{RETRO_DAYS}} days have passed', then: 'it is closed with the review\'s outcome, and the daily check reports any top-severity incident still open' },
    },
    {
      id: 'req-actions', label: 'Actions tracked to closure', ears_type: 'ubiquitous',
      action: 'record every action from a postmortem or review as a follow-up in the incident tool, synced to the team\'s issue tracker, with one owner, and finish it, or mark it not doing with the reason, within {{ACTION_DAYS}} days',
      rationale: 'An action without an owner and a deadline is a wish; Atlassian holds its priority actions to an objective of 4 or 8 weeks with reminders and reports (Atlassian, Postmortems; PagerDuty, Postmortem Process).',
      scenario: { label: 'Old action reported', given: 'a follow-up outstanding for more than {{ACTION_DAYS}} days and one without an owner', when: 'the daily check runs', then: 'both are reported and the check fails' },
    },
  ],
  adrs: [
    {
      id: 'adr-sev4', label: 'Four severity levels by customer impact', when: { SEVERITY: ['sev4'] },
      decision: `Incidents are classified on four levels by customer impact. SEV1: a core function (checkout, payment, sign-in) fails for all or most customers, or data is lost or leaked; for example every order fails. SEV2: a core function fails or is wrong for some customers, or the error budget burns at the fast rate; for example orders from one region fail. SEV3: a minor function is degraded and a workaround exists; for example order history loads slowly. SEV4: no customer impact yet, a risk to act on in working hours; for example a certificate expiring in 7 days. SEV1 and SEV2 are the top severities: they are paged at any hour, get a lead within {{COMMAND_MINUTES}} minutes, an update at least every {{UPDATE_MINUTES}} minutes and a review; SEV3 and SEV4 wait for working hours. ${SHARED} ${TOOL}`,
      consequences: '• Four levels separate waking someone (SEV1, SEV2) from the next working day (SEV3, SEV4) with one level of nuance on each side.\n• The examples have to be kept current as the product changes, or the levels drift into argument again.\n• incident.io starts with three levels; renaming them and adding a fourth is a settings change, and every report filtered by level follows it.\n• Comparing with teams on another scheme needs a mapping.',
      alternatives: '1. Three levels (critical, major, minor): fewer choices, but a degraded minor function and a risk with no impact share a level.\n2. Five levels as PagerDuty uses (SEV-1 to SEV-5): a separate level for cosmetic issues, which belong in the backlog rather than the incident tool.\n3. The ITSM tool\'s priority (P1 to P5): fits a service desk, but mixes urgency into what should say how bad the impact is.',
    },
    {
      id: 'adr-three', label: 'Three severity levels', when: { SEVERITY: ['three'] },
      decision: `Incidents are classified on three levels, incident.io's defaults and Atlassian's scale. Critical: very high impact, a core function down for all or most customers, or data lost or leaked; for example checkout fails for everyone. Major: significant impact, a core function down or wrong for some customers, sometimes with a workaround; for example payments by one card scheme fail. Minor: low impact that most customers will not notice, handled in working hours; for example a report is a day late. Critical and major are the top severities: they are paged at any hour, get a lead within {{COMMAND_MINUTES}} minutes, an update at least every {{UPDATE_MINUTES}} minutes and a review; minor waits for working hours. ${SHARED} ${TOOL}`,
      consequences: '• The choice is quick and incident.io needs no change of its levels.\n• Minor covers both a degraded function and a risk with no impact yet, so its response time has to suit both.\n• Two of three levels are top severities, so the full response, the postmortem included, runs often; the line between major and minor carries the cost.\n• A fourth level later means re-reading old incidents to compare.',
      alternatives: '1. Four levels (SEV1 to SEV4): separates a risk without impact from a degraded function, at the cost of one more choice.\n2. The ITSM tool\'s priority (P1 to P5): fits a service desk, but five levels are more than a small team can tell apart.',
    },
    {
      id: 'adr-itsm', label: 'Severity is the ITSM priority', when: { SEVERITY: ['itsm'] },
      decision: `Incidents carry the priority of the ITSM tool, set from its impact and urgency matrix as ITIL 4 incident management describes and ServiceNow's priority lookup rules implement: impact and urgency each High, Medium or Low give P1 Critical (High and High), P2 High, P3 Moderate, P4 Low and P5 Planning (Low and Low); docs/incidents/severity.md gives the matrix and an example for each priority (P1: checkout fails for everyone; P2: payments by one card scheme fail; P3: order history slow; P4: one report a day late; P5: a cosmetic fault). P1 and P2 are the top severities: they are paged at any hour, get a lead within {{COMMAND_MINUTES}} minutes, an update at least every {{UPDATE_MINUTES}} minutes and a review; P3 to P5 stay with the service desk's queue. The service desk raises incidents in ServiceNow or Jira Service Management; a P1 or P2 there becomes an incident.io alert through incident.io's ServiceNow alert source (from Jira Service Management, through an automation rule calling a custom HTTP alert source), which declares the response with the same priority, and the ITSM ticket stays the record of the ITIL process. ${SHARED} ${TOOL}`,
      consequences: '• One priority across the service desk and engineering; reports to IT management need no mapping.\n• Urgency is part of the priority, so an incident with little impact but a deadline can land on P2 and be paged; the matrix has to be tuned with that in mind.\n• Two tools hold the incident (the ITSM ticket and the response in incident.io), and their priorities must be kept in step by the integration.\n• Five levels are more than responders can tell apart at 3 a.m.; the matrix decides, not the responder.',
      alternatives: '1. Four severity levels by customer impact: simpler for engineers, but the service desk then maps between two schemes.\n2. Running the whole response in the ITSM tool (Jira Service Management\'s major incident features): one tool, but the checks here read incident.io and would need rewriting against its REST API.',
    },
    {
      id: 'adr-commander', label: 'An incident commander leads top-severity incidents', when: { COMMAND: ['commander'] },
      decision: 'Incidents on the two highest levels are led by an incident commander from a commander rota of at least four trained people, kept as an incident.io On-call schedule apart from the engineers\' rota (a PagerDuty schedule works the same) and paged automatically when such an incident is declared. The commander takes incident.io\'s Incident Lead role, renamed Incident Commander, within {{COMMAND_MINUTES}} minutes; coordinates, decides, keeps the incident\'s timeline and sees that updates go out, or names a communications lead; and changes nothing in the system: the on-call engineers and the experts they call in hold the other roles and do the fixing. Command passes only by reassigning the role, announced in the channel. Incidents on lower levels are led by the on-call engineer. Commanders are trained by shadowing two incidents and leading one under supervision.',
      consequences: '• Someone always looks at the whole incident, and the engineers fixing it are spared the messages.\n• A second rota costs pay and training; with fewer than four people it burns them out.\n• A commander who does not know the system depends on the experts and must resist fixing it themselves.\n• The handover is visible in the role history, so it is always clear who leads.',
      alternatives: '1. The on-call engineer leads: no second rota, but the person who knows the system best is also the one answering everyone.\n2. A manager leads: authority without training, and managers on call for every incident is a rota by another name.',
    },
    {
      id: 'adr-oncall-lead', label: 'The on-call engineer leads', when: { COMMAND: ['oncall'] },
      decision: 'The on-call engineer who was paged leads every incident and takes incident.io\'s lead role within {{COMMAND_MINUTES}} minutes. For an incident on the two highest levels they name a teammate as communications lead, who posts the updates and talks to support, so the updates do not wait for the fix. The lead passes to someone else only by reassigning the role, announced in the channel: at the end of a shift, or when the incident outgrows one person and a second engineer or the team lead takes over the coordination.',
      consequences: '• No second rota: the team that owns the system runs its incidents.\n• The lead is also the most likely person to fix it, so coordination suffers in a long or cross-team incident; the handover is the escape.\n• A communications lead from the team takes someone else away from their work for the incident.\n• When incidents grow beyond one team, this decision should be superseded by a commander rota.',
      alternatives: '1. An incident commander from a rota: clearer command, at the cost of a second rota and training.\n2. Whoever notices leads: fast to start, but nobody is sure who is in charge an hour later.',
    },
    {
      id: 'adr-statuspage', label: 'Customers learn from a public status page', when: { COMMS: ['statuspage'] },
      decision: 'Customers learn of incidents from a public status page on Atlassian Statuspage, with one component per customer-facing service and subscriptions by e-mail and webhook (Instatus, Better Stack or incident.io Status Pages serve as well). An incident with customer impact is marked Customer facing in incident.io and published on the status page within {{STATUS_MINUTES}} minutes of being declared, linked in the incident\'s custom field Status page incident (a link), updated at least every {{UPDATE_MINUTES}} minutes in one or two plain sentences that say what customers notice and when they will hear next, and resolved when the impact ends. Where the Observability pack routes alerts to the status page outside working hours, that automatic post is the first one. Inside the company, every incident has its own channel and every update on the top levels is posted in incident.io and announced in #incidents, at least every {{UPDATE_MINUTES}} minutes.',
      consequences: '• Customers and support find the state of an incident in one place, and support answers with a link.\n• The page is public: a competitor and the press see every incident too, and the wording needs care.\n• Someone in each incident must post to it on time; incident.io\'s Statuspage integration or its own status pages can post from the incident.\n• A status page that is green during an outage costs more trust than having none, so the page must not depend on the system it reports on.',
      alternatives: '1. Direct messages to the affected customers: private, but each customer depends on support finding them, and nothing is visible to prospects.\n2. Social media posts only: reach without control, and no history for customers to look up.',
    },
    {
      id: 'adr-direct', label: 'Affected customers are told directly', when: { COMMS: ['direct'] },
      decision: 'There is no public status page. An incident with customer impact is marked Customer facing in incident.io and lists the affected customers; support tells their named contacts by e-mail from the support tool (Zendesk, Intercom or Freshdesk) or by a banner in the product within {{STATUS_MINUTES}} minutes of the declaration, records the time in the incident\'s manual timestamp Customers notified at, updates them when anything they notice changes, and tells them when the impact ends. Inside the company, every incident has its own channel and every update on the top levels is posted in incident.io and announced in #incidents, at least every {{UPDATE_MINUTES}} minutes. This decision assumes the Observability pack does not rely on a status page outside working hours and the Availability pack announces no maintenance windows on one; either would need this decision superseded.',
      consequences: '• Each customer hears only about what affects them, in words chosen for them.\n• Support has to find the affected contacts within minutes, which needs the list of customers per service to be ready before the incident.\n• Customers who were not told and are affected anyway have nowhere to look.\n• A growing customer base makes this slower with every customer; a status page is the next step.',
      alternatives: '1. A public status page: one place for everyone, at the cost of public visibility.\n2. Telling customers only on request: least effort, and the customers learn that silence means nothing is known.',
    },
    {
      id: 'adr-blameless', label: 'Blameless postmortems with tracked actions', when: { POSTMORTEM: ['blameless'] },
      decision: 'Every incident on the two highest levels gets a blameless postmortem in incident.io\'s post-mortem documents, from one template: summary, customer impact, timeline, contributing factors (never a person as the cause), what went well, and actions. The lead names an owner at resolution; the owner holds a meeting with the responders and marks the document completed within {{POSTMORTEM_DAYS}} days of resolution; the engineering manager reviews it. Lower levels get one on request, or when the Google SRE triggers apply (data loss, a rollback or other on-call intervention, a monitoring failure). Each action becomes a follow-up in incident.io, synced to Jira or Linear, with one owner, and is done or marked not doing with the reason within {{ACTION_DAYS}} days. When the Availability pack calls for a postmortem because the error budget is spent, it uses the same template and the same follow-ups.',
      consequences: '• Contributing causes are found while they are fresh, and the document becomes the record customers and auditors can be given.\n• A postmortem takes a few hours of several people per top-severity incident.\n• Blamelessness has to be defended by managers in every review, or people start hiding mistakes.\n• Follow-ups compete with feature work; the deadline makes the trade-off visible instead of silent.',
      alternatives: '1. A short review in the team retrospective: lighter, but shallow for incidents that cross teams.\n2. A root-cause report by the person who caused it: fast, and it teaches everyone to hide the next one.',
    },
    {
      id: 'adr-retro', label: 'Incidents reviewed in the team retrospective', when: { POSTMORTEM: ['retro'] },
      decision: 'Each incident on the two highest levels is reviewed in the team\'s next retrospective, within {{RETRO_DAYS}} days of resolution: what happened, what helped, what got in the way and what to change, without naming a person as the cause. The outcome is written into the incident in incident.io, the incident is closed after the review, and each action becomes a follow-up synced to Jira or Linear, with one owner, done or marked not doing with the reason within {{ACTION_DAYS}} days. An incident that crosses teams, or the second incident with the same cause, gets a written postmortem instead.',
      consequences: '• No separate document or meeting; the lessons stay with the team that runs the system.\n• The review is as deep as a retrospective allows, which can be too shallow for a long or complex incident.\n• Nothing written is there to give a customer or an auditor who asks for an incident report.\n• Actions are still tracked, so the team does not lose them in the retrospective board.',
      alternatives: '1. A blameless postmortem with tracked actions: deeper and written down, at a few hours per incident.\n2. No review: cheapest, and the same incident returns.',
    },
  ],
  fitness: [
    {
      id: 'ff-severity-defined', label: 'Severity levels defined in the runbook', category: 'structural', implements: LEVELS, checks: ['req-classify'],
      threshold: 'docs/incidents/severity.md has at least 3 levels, each with Impact, Examples, Response and Review lines, and the sections Levels, Top severities, DORA major incidents and Security incidents',
      description: 'A CI step runs on every change to the repository and fails when the severity definitions lose a level, a level loses its impact, examples, response or review, or the sections on the top severities, DORA major incidents and security incidents are missing. Each level is a ### heading under ## Levels.',
      tool: 'bash with awk and grep in a CI step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI, on every change: docs/incidents/severity.md defines each level with its impact, examples, response and review
set -euo pipefail
f=docs/incidents/severity.md
awk '
  BEGIN { split("Impact: Examples: Response: Review:", need, " ") }
  function check(   k) { levels++; for (k in need) if (index(seen, need[k]) == 0) { print FILENAME ": level " name " has no " need[k]; bad = 1 } }
  /^## /  { if (name != "") check(); name = ""; next }
  /^### / { if (name != "") check(); name = substr($0, 5); seen = ""; next }
  /^(Impact|Examples|Response|Review):/ { seen = seen " " $1 }
  END { if (name != "") check(); if (levels < 3) { print FILENAME ": fewer than 3 levels"; bad = 1 }; exit bad }
' "$f"
for section in '## Levels' '## Top severities' '## DORA major incidents' '## Security incidents'; do
  grep -qx "$section" "$f" || { echo "$f: no section \\"$section\\""; exit 1; }
done`,
    },
    {
      id: 'ff-declared', label: 'Incidents declared completely', category: 'operational', implements: LEVELS, checks: ['req-classify', 'req-declare', 'req-dora', 'req-security'],
      threshold: '0 incidents of the last 90 days without a level or a channel; 0 marked DORA major incident below the highest level; 0 of type Security that are not private',
      description: 'A daily CI job reads the incidents of the last 90 days from the incident.io API (declined, merged and canceled ones left out) and fails on an incident without a severity or a Slack or Teams channel, a DORA major incident below the highest severity rank, or a Security incident whose visibility is not private. The first file is the small API module the other incident checks import; the two highest severity ranks of /v1/severities are the top severities, whichever scheme was chosen.',
      tool: 'Node 20 over the incident.io API (GET /v2/incidents, /v1/severities); for PagerDuty, GET /incidents with priority and the incident\'s custom fields',
      language: 'js',
      snippet: `// scripts/incidents/api.mjs: shared by the incident checks (Node 20; INCIDENT_IO_API_KEY is a read-only key)
const headers = { Authorization: \`Bearer \${process.env.INCIDENT_IO_API_KEY}\` }
const get = async (path) => { const r = await fetch(\`https://api.incident.io\${path}\`, { headers }); if (!r.ok) throw new Error(\`\${path}: \${r.status}\`); return r.json() }
export async function list(path, key, out = [], after = '') {
  const body = await get(\`\${path}\${path.includes('?') ? '&' : '?'}page_size=250\${after && \`&after=\${after}\`}\`)
  out.push(...body[key])
  return body[key].length < 250 ? out : list(path, key, out, body.pagination_meta.after)
}
const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)   // the last 90 days, declined, merged and canceled left out
export const incidents = async () => (await list(\`/v2/incidents?created_at[gte]=\${since}\`, 'incidents')).filter((i) => !['declined', 'merged', 'canceled'].includes(i.incident_status.category))
const ranks = (await get('/v1/severities')).severities.map((s) => s.rank).sort((a, b) => b - a)
export const top = (i) => i.severity?.rank >= ranks[1], highest = (i) => i.severity?.rank === ranks[0]   // the two highest levels; the highest
export const field = (i, name) => i.custom_field_entries.find((e) => e.custom_field.name === name)?.values[0]
export const stamp = (i, name) => Date.parse(i.incident_timestamp_values?.find((t) => t.incident_timestamp.name === name)?.value?.value ?? '') || undefined

// scripts/incidents/declared.mjs
import { field, highest, incidents } from './api.mjs'
const problems = []
for (const i of await incidents()) {
  if (!i.severity) problems.push(\`\${i.reference}: no severity\`)
  if (!i.slack_channel_id && !i.ms_teams_channel_url) problems.push(\`\${i.reference}: no incident channel\`)
  if (field(i, 'DORA major incident')?.value_option?.value === 'Yes' && !highest(i)) problems.push(\`\${i.reference}: DORA major incident below the highest level\`)
  if (i.incident_type?.name === 'Security' && i.visibility !== 'private') problems.push(\`\${i.reference}: security incident is not private\`)
}
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-lead', label: 'Top-severity incidents have a lead', category: 'process', implements: [...LEVELS, 'adr-commander', 'adr-oncall-lead'], checks: ['req-commander', 'req-oncall-lead'],
      threshold: '0 incidents of the last 90 days on the two highest levels without an assignee in the lead role',
      description: 'A daily CI job reads the incidents on the two highest levels and fails on any whose lead role (incident.io\'s role of type lead, named Incident Commander or Incident Lead as decided) has no assignee.',
      tool: 'Node 20 over the incident.io API (incident_role_assignments of GET /v2/incidents); for PagerDuty, the incident\'s responders and roles',
      language: 'js',
      snippet: `// scripts/incidents/lead.mjs
import { incidents, top } from './api.mjs'
const leaderless = (await incidents()).filter(top)
  .filter((i) => !i.incident_role_assignments.some((a) => a.role.role_type === 'lead' && a.assignee))
if (leaderless.length) {
  console.error(\`top-severity incidents without a lead (the commander or the on-call engineer): \${leaderless.map((i) => i.reference).join(', ')}\`)
  process.exit(1)
}`,
    },
    {
      id: 'ff-status-page', label: 'Status page in time and kept current', when: { COMMS: ['statuspage'] }, category: 'operational', implements: ['adr-statuspage'], checks: ['req-status-page'],
      threshold: '0 customer-facing incidents of the last 90 days without a linked status page incident, published later than {{STATUS_MINUTES}} minutes after the declaration, or with more than {{UPDATE_MINUTES}} minutes between two status page updates before it was resolved',
      description: 'A daily CI job reads the incidents marked Customer facing, follows each one\'s field Status page incident to the Statuspage incident, and compares its created_at with the declaration and the times of its incident_updates up to resolved_at (or now, while it is open).',
      tool: 'Node 20 over the incident.io API and the Atlassian Statuspage REST API (GET /v1/pages/{page_id}/incidents/{incident_id}); for incident.io Status Pages, GET /v2/status_page_incidents',
      language: 'js',
      snippet: `// scripts/incidents/status-page.mjs (STATUSPAGE_API_KEY, STATUSPAGE_PAGE_ID: Atlassian Statuspage)
import { field, incidents } from './api.mjs'
const STATUS_MINUTES = {{STATUS_MINUTES}}, UPDATE_MINUTES = {{UPDATE_MINUTES}}
const page = (id) => fetch(\`https://api.statuspage.io/v1/pages/\${process.env.STATUSPAGE_PAGE_ID}/incidents/\${id}\`,
  { headers: { Authorization: \`OAuth \${process.env.STATUSPAGE_API_KEY}\` } }).then((r) => (r.ok ? r.json() : undefined))
const problems = []
for (const i of await incidents()) {
  if (field(i, 'Customer facing')?.value_option?.value !== 'Yes') continue
  const link = field(i, 'Status page incident')?.value_link
  const sp = link && (await page(link.split('/').filter(Boolean).pop()))
  if (!sp) { problems.push(\`\${i.reference}: customer-facing, but no status page incident linked\`); continue }
  if (Date.parse(sp.created_at) - Date.parse(i.created_at) > STATUS_MINUTES * 60_000) problems.push(\`\${i.reference}: status page later than \${STATUS_MINUTES} min\`)
  const times = [...sp.incident_updates.map((u) => Date.parse(u.created_at)), Date.parse(sp.resolved_at ?? new Date().toISOString())].sort((a, b) => a - b)
  if (times.some((t, n) => n > 0 && t - times[n - 1] > UPDATE_MINUTES * 60_000)) problems.push(\`\${i.reference}: a gap of more than \${UPDATE_MINUTES} min between status page updates\`)
}
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-customers-told', label: 'Affected customers told in time', when: { COMMS: ['direct'] }, category: 'process', implements: ['adr-direct'], checks: ['req-direct'],
      threshold: '0 customer-facing incidents of the last 90 days whose timestamp Customers notified at is more than {{STATUS_MINUTES}} minutes after the declaration, or unset once that time has passed',
      description: 'A daily CI job reads the incidents marked Customer facing and compares the manual timestamp Customers notified at with the time the incident was declared.',
      tool: 'Node 20 over the incident.io API (incident_timestamp_values of GET /v2/incidents)',
      language: 'js',
      snippet: `// scripts/incidents/customers-told.mjs
import { field, incidents, stamp } from './api.mjs'
const STATUS_MINUTES = {{STATUS_MINUTES}}
const late = (await incidents())
  .filter((i) => field(i, 'Customer facing')?.value_option?.value === 'Yes')
  .filter((i) => {
    const told = stamp(i, 'Customers notified at') ?? Date.now()
    return told - Date.parse(i.created_at) > STATUS_MINUTES * 60_000
  })
if (late.length) {
  console.error(\`affected customers told later than \${STATUS_MINUTES} min after declaration, or not yet: \${late.map((i) => i.reference).join(', ')}\`)
  process.exit(1)
}`,
    },
    {
      id: 'ff-updates', label: 'Updates on a cadence', category: 'process', implements: [...LEVELS, 'adr-statuspage', 'adr-direct'], checks: ['req-stakeholders'],
      threshold: '0 incidents of the last 90 days on the two highest levels with more than {{UPDATE_MINUTES}} minutes between two updates, counted from the declaration to Resolved at (or now)',
      description: 'A daily CI job lists the incident updates of each incident on the two highest levels and fails when the longest gap between the declaration, the updates and the resolution exceeds the cadence.',
      tool: 'Node 20 over the incident.io API (GET /v2/incident_updates); for PagerDuty, GET /incidents/{id}/status_updates',
      language: 'js',
      snippet: `// scripts/incidents/updates.mjs
import { incidents, list, stamp, top } from './api.mjs'
const UPDATE_MINUTES = {{UPDATE_MINUTES}}
const problems = []
for (const i of (await incidents()).filter(top)) {
  const updates = await list(\`/v2/incident_updates?incident_id=\${i.id}\`, 'incident_updates')
  const end = stamp(i, 'Resolved at') ?? Date.now()
  const times = [Date.parse(i.created_at), ...updates.map((u) => Date.parse(u.created_at)).filter((t) => t < end), end].sort((a, b) => a - b)
  const gap = Math.max(...times.slice(1).map((t, n) => t - times[n]))
  if (gap > UPDATE_MINUTES * 60_000) problems.push(\`\${i.reference}: \${Math.round(gap / 60_000)} min without an update\`)
}
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-deploy-marked', label: 'Deployments that caused incidents marked failed', category: 'holistic', implements: LEVELS, checks: ['req-deploy-failure'],
      threshold: '0 incidents resolved more than 3 days ago (1 working day, a weekend included) whose field Caused by deployment names a deployment without a failure status',
      description: 'A daily CI job reads the incidents whose field Caused by deployment is set and that were resolved more than 3 days ago, and fails when that GitHub deployment carries no failure status: the record the Delivery metrics pack counts failed deployments and recovery from.',
      tool: 'Node 20 over the incident.io API and the GitHub REST API (GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses)',
      language: 'js',
      snippet: `// scripts/incidents/deployment-failure.mjs (GITHUB_TOKEN with deployments:read, GITHUB_REPOSITORY=owner/repo)
import { field, incidents, stamp } from './api.mjs'
const statuses = (id) => fetch(\`https://api.github.com/repos/\${process.env.GITHUB_REPOSITORY}/deployments/\${id}/statuses?per_page=100\`,
  { headers: { Authorization: \`Bearer \${process.env.GITHUB_TOKEN}\`, Accept: 'application/vnd.github+json' } }).then((r) => r.json())
const problems = []
for (const i of await incidents()) {
  const deployment = field(i, 'Caused by deployment')?.value_text?.trim()
  const resolved = stamp(i, 'Resolved at')
  if (!deployment || !resolved || Date.now() - resolved < 3 * 86_400_000) continue   // 1 working day, a weekend included
  const list = await statuses(deployment)
  if (!Array.isArray(list) || !list.some((s) => s.state === 'failure'))
    problems.push(\`\${i.reference}: deployment \${deployment} caused it but carries no failure status (Delivery metrics pack)\`)
}
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-postmortem', label: 'Postmortems completed in time', when: { POSTMORTEM: ['blameless'] }, category: 'process', implements: ['adr-blameless'], checks: ['req-postmortem'],
      threshold: '0 incidents on the two highest levels resolved more than {{POSTMORTEM_DAYS}} days ago without a post-mortem document in status completed',
      description: 'A daily CI job reads the incidents on the two highest levels whose Resolved at is more than {{POSTMORTEM_DAYS}} days ago and lists their post-mortem documents; one in status completed is required.',
      tool: 'Node 20 over the incident.io API (GET /v1/postmortem_documents?incident_id=…); for PagerDuty, the postmortem linked from the incident',
      language: 'js',
      snippet: `// scripts/incidents/postmortem.mjs
import { incidents, list, stamp, top } from './api.mjs'
const POSTMORTEM_DAYS = {{POSTMORTEM_DAYS}}
const problems = []
for (const i of (await incidents()).filter(top)) {
  const resolved = stamp(i, 'Resolved at')
  if (!resolved || Date.now() - resolved < POSTMORTEM_DAYS * 86_400_000) continue
  const documents = await list(\`/v1/postmortem_documents?incident_id=\${i.id}\`, 'postmortem_documents')
  if (!documents.some((d) => d.status === 'completed')) problems.push(\`\${i.reference}: resolved \${POSTMORTEM_DAYS}+ days ago, no completed postmortem\`)
}
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-review', label: 'Incidents closed after the review', when: { POSTMORTEM: ['retro'] }, category: 'process', implements: ['adr-retro'], checks: ['req-retro'],
      threshold: '0 incidents on the two highest levels resolved more than {{RETRO_DAYS}} days ago that are not closed',
      description: 'A daily CI job reads the incidents on the two highest levels whose Resolved at is more than {{RETRO_DAYS}} days ago and fails on any whose status is not in the closed category, which the team sets after the retrospective has reviewed it.',
      tool: 'Node 20 over the incident.io API (incident_status.category of GET /v2/incidents)',
      language: 'js',
      snippet: `// scripts/incidents/review.mjs
import { incidents, stamp, top } from './api.mjs'
const RETRO_DAYS = {{RETRO_DAYS}}
const open = (await incidents()).filter(top).filter((i) => {
  const resolved = stamp(i, 'Resolved at')
  return resolved && Date.now() - resolved > RETRO_DAYS * 86_400_000 && i.incident_status.category !== 'closed'
})
if (open.length) {
  console.error(\`resolved more than \${RETRO_DAYS} days ago and not closed after the retrospective: \${open.map((i) => i.reference).join(', ')}\`)
  process.exit(1)
}`,
    },
    {
      id: 'ff-actions', label: 'Actions done in time', category: 'process', implements: [...LEVELS, 'adr-blameless', 'adr-retro'], checks: ['req-actions'],
      threshold: '0 outstanding follow-ups created more than {{ACTION_DAYS}} days ago; 0 outstanding follow-ups without an assignee or team',
      description: 'A daily CI job lists the follow-ups of the last year and fails on an outstanding one older than the deadline or without an owner. A follow-up marked not doing counts as closed; the reason is in its description.',
      tool: 'Node 20 over the incident.io API (GET /v3/follow_ups); for Jira, a JQL search on the postmortem action issues',
      language: 'js',
      snippet: `// scripts/incidents/actions.mjs
import { list } from './api.mjs'
const ACTION_DAYS = {{ACTION_DAYS}}
const since = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
const open = (await list(\`/v3/follow_ups?created_at[gte]=\${since}\`, 'follow_ups')).filter((f) => f.status === 'outstanding')
const problems = [
  ...open.filter((f) => Date.now() - Date.parse(f.created_at) > ACTION_DAYS * 86_400_000).map((f) => \`\${f.title}: open for more than \${ACTION_DAYS} days\`),
  ...open.filter((f) => !f.assignee && !f.assignee_team).map((f) => \`\${f.title}: no owner\`),
]
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
  ],
}

export default pack
