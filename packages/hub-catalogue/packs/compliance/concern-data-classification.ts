import type { PackSpec } from '../../src/packSpec'

const SCHEMES = ['adr-four', 'adr-three', 'adr-regulated']
const FORCES = 'This store keeps data, and the protection it needs depends on what it holds. The forces: a level nobody records is a level everyone guesses, usually too low for a store someone else filled; too many levels are applied inconsistently, too few put card numbers in the same class as the canteen menu; levels go stale as stores gain columns, exports and copies; the most sensitive data leaves through integrations added for good reasons (a CRM, an e-mail service, an analytics tool), one relation at a time; and auditors and regulators ask which stores are in scope of which rule, which needs one list. How data of each level is encrypted is decided in the Encryption pack, what personal data needs (lawful basis, retention, erasure, where it is kept) in the Personal data pack, credentials in the Secrets pack, and who read restricted data is logged as the Audit trail pack decides.'
const FLOW_CHECK = 'For every store at the highest level it takes the store, the elements that contain it and every element with an interacts relation to it (external ones aside), and looks at each interacts relation, in either direction, between one of them and an element marked external: true. Relations count both ways, because a call from outside brings data back.'

const pack: PackSpec = {
  id: 'concern-data-classification',
  name: 'Data classification',
  group: 'compliance',
  description: 'Which classification levels the organisation uses, who assigns them, where the level of each database and queue is recorded, whether sensitive data is looked for, and where data of the highest level may go. The flow rule is checked on the architecture model itself.',
  tags: ['compliance', 'data-classification', 'iso-27001', 'data-inventory', 'data-flows', 'sensitive-data-discovery'],
  concern: {
    id: 'data-classification',
    trigger: 'LIST NODES WHERE (type = "database" OR type = "queue") AND external != true',
    why: 'these elements keep data, so which classification level it carries, who sets it and where data of each level may go has to be decided.',
  },
  sources: [
    { title: 'ISO/IEC 27001:2022, Information security management systems (Annex A 5.12 Classification of information, 5.13 Labelling of information, 5.14 Information transfer)', url: 'https://www.iso.org/standard/27001' },
    { title: 'NIST FIPS 199, Standards for Security Categorization of Federal Information and Information Systems', url: 'https://csrc.nist.gov/pubs/fips/199/final' },
    { title: 'NIST SP 800-60 Vol. 1 Rev. 1, Guide for Mapping Types of Information and Information Systems to Security Categories', url: 'https://csrc.nist.gov/pubs/sp/800/60/v1/r1/final' },
    { title: 'UK Government Security Classifications', url: 'https://www.gov.uk/government/publications/government-security-classifications' },
    { title: 'Regulation (EU) 2016/679 (GDPR), Article 9 (special categories) and Article 28 (processors)', url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj' },
    { title: 'PCI Security Standards Council, PCI DSS document library', url: 'https://www.pcisecuritystandards.org/document_library/' },
    { title: 'Amazon Macie: supported storage classes and formats', url: 'https://docs.aws.amazon.com/macie/latest/user/discovery-supported-storage.html' },
    { title: 'Google Cloud Sensitive Data Protection: data profiles', url: 'https://docs.cloud.google.com/sensitive-data-protection/docs/data-profiles' },
    { title: 'Microsoft Purview: data classification in Data Map', url: 'https://learn.microsoft.com/en-us/purview/data-map-classification' },
    { title: 'OpenMetadata: classification', url: 'https://docs.open-metadata.org/latest/how-to-guides/data-governance/classification' },
    { title: 'AWS Config managed rule required-tags', url: 'https://docs.aws.amazon.com/config/latest/developerguide/required-tags.html' },
  ],
  questions: [
    {
      key: 'SCHEME', title: 'Levels', label: 'Which classification levels does the organisation use?',
      hint: 'The levels are the vocabulary every other rule is written in: who may read, where data may be copied, where it may go. ISO/IEC 27001 asks for a classification scheme (Annex A 5.12) and labels that follow it (5.13), and leaves the levels to you. The answer holds for the whole organisation: every store gets one level from the same list.',
      default: 'four',
      options: [
        { value: 'four', label: 'four levels (public, internal, confidential, restricted)', description: 'Public may be published; internal is for staff and contractors; confidential for named roles; restricted for named people, where a leak means severe harm or a regulatory or contractual breach. The common practice under ISO/IEC 27001. Pick it when some data (card numbers, health records, credentials, trade secrets) needs a stricter regime than the rest of what is confidential.' },
        { value: 'three', label: 'three levels (public, internal, confidential)', description: 'Public, internal, and confidential for everything sensitive. Pick it for a smaller organisation where all sensitive data gets the same treatment: fewer levels are applied more consistently, and confidential is then the highest level.' },
        { value: 'regulated', label: 'four levels with regulated categories', description: 'The four levels, and on each store the regulated categories it holds: personal data, special-category data (GDPR Art. 9), health data and cardholder data (PCI DSS), each setting the lowest level the store may have. Pick it when rules beyond general confidentiality apply, so that the stores in scope of each one come from a single list.' },
      ],
    },
    {
      key: 'RECORD', title: 'Where recorded', label: 'Where is each store\'s level recorded?',
      hint: 'A data inventory in the repository names every database and queue of the architecture model with its level and owner, so the model can be checked against it in every answer. This decides whether the level also travels with the data, where the people and tools that handle it see it.',
      default: 'inventory',
      options: [
        { value: 'inventory', label: 'the inventory in the repository alone', description: 'data-inventory.json next to the architecture model is the one record, changed through pull requests. Pick it when the stores number in tens rather than hundreds and no data catalogue is in use.' },
        { value: 'catalogue', label: 'the inventory and a data catalogue', description: 'Each store\'s database or topic in the catalogue (OpenMetadata, DataHub, Microsoft Purview or Collibra) carries the level as a tag, which a nightly check compares with the inventory. Pick it when analysts and data engineers find data through a catalogue, so they see the level where they look. The check is written for OpenMetadata.' },
        { value: 'tags', label: 'the inventory and tags on the cloud resources', description: 'Each database instance, bucket, table and stream carries a data-classification tag with its level, required by an AWS Config rule (the built-in Require a tag policy on Azure) and compared with the inventory nightly. Pick it when access policies, cost reports or scanners should act on the level. The checks are written for AWS.' },
      ],
    },
    {
      key: 'DISCOVERY', title: 'Discovery', label: 'Is sensitive data looked for automatically?',
      hint: 'A level is what the owner believes the store holds; a scanner finds the card numbers in a store declared internal. Scanners sample and miss things, so they back the owners up and never replace them.',
      default: 'owners',
      options: [
        { value: 'scanner', label: 'the cloud provider\'s scanner', description: 'Amazon Macie (S3 only: databases are exported to S3 as Parquet to be scanned), Google Cloud Sensitive Data Protection discovery (BigQuery, Cloud SQL, Cloud Storage) or Microsoft Purview Data Map scans (Azure SQL, storage) look for credentials, financial and personal data, and a daily check compares what they find with the store\'s level. Pick it when stores hold free text, files or exports that people fill, where undeclared data lands. The check is written for Macie.' },
        { value: 'owners', label: 'no scanner, the owners\' declaration alone', description: 'Each owner states what the store holds and confirms it at every review; nothing looks inside. Pick it when the schemas are typed and narrow (no free text, no uploaded files) or a scanner costs more than the risk; the decision records that nothing looks.' },
      ],
    },
    {
      key: 'FLOW', title: 'Highest level outside', label: 'Where may data of the highest level go?',
      hint: 'The architecture model shows which elements reach each store and which of them talk to systems outside the organisation; a check reads the model and the inventory together, so a relation that could carry the most sensitive data outside fails the build that adds it. The highest level is restricted with four levels and confidential with three.',
      default: 'agreement',
      options: [
        { value: 'never', label: 'nowhere outside the organisation', description: 'No external system receives data of the highest level; a relation to one from such a store, or from an element that reads or writes it, is listed as carrying none of it. Pick it when nothing at that level needs to leave (ledgers, credentials, trade secrets) and the build should prove it.' },
        { value: 'agreement', label: 'to external systems under a signed agreement, encrypted', description: 'A flow to an external system is allowed when the inventory lists it with the agreement that covers it (a data processing agreement under GDPR Art. 28 when personal data is in it), the date that agreement ends and the encrypted channel it uses. Pick it when processors are part of the service: a payment provider, e-mail delivery, a hosted CRM.' },
      ],
    },
  ],
  details: [
    { key: 'REVIEW_MONTHS', label: 'Within how many months must each store\'s level be reviewed again?', default: '12', number: true },
    { key: 'APPROVERS', label: 'Which CODEOWNERS team approves changes to the data inventory?', default: '@your-org/data-governance' },
  ],
  need: {
    label: 'Every store\'s data has a known level',
    text: 'The system keeps data in databases and queues, and not all of it is equally sensitive. Each store needs a level from one scheme the organisation shares, an owner who answers for it, and rules for where data of each level may go, so that the most sensitive data is not copied to a partner or a tool because nobody knew what it was. What counts as personal, special-category, health or cardholder data is a legal reading the organisation makes (its DPO or compliance officer); the pack decides how the answer is recorded and enforced. The snippets assume the architecture model as a Markdown folder under architecture/ (nodes/**/*.md and relations.json), the inventory as data-inventory.json at the repository root, naming each database and queue by its label in the model, the scripts under scripts/ run by Node 20 with js-yaml, and GitHub as the code host.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-classified', label: 'Every store classified', ears_type: 'ubiquitous',
      action: 'name every database and queue of the architecture model that is not external in data-inventory.json by its label, with one level of the decided scheme, an owner, the kinds of data it holds and the date of its last review, and fail the build of a change that adds a store without its entry',
      rationale: 'Classification has to cover every asset and be kept with it (ISO/IEC 27001 Annex A 5.12); categorising per kind of information and system is how FIPS 199 and NIST SP 800-60 do it. Checked in the build that adds a store, the list cannot fall behind the model.',
      scenario: { label: 'New store needs a level', given: 'a change that adds a queue to the architecture model', when: 'the build runs', then: 'it fails naming the queue until data-inventory.json has its entry with a level, an owner, what it holds and a review date' },
    },
    {
      id: 'req-handling', label: 'Each level has handling rules', ears_type: 'ubiquitous',
      action: 'keep, for every level in data-inventory.json, written handling rules saying who may read data of that level, where it may be copied and whether it may leave the organisation',
      rationale: 'A level is only a word until the procedures that follow from it are written down (ISO/IEC 27001 Annex A 5.13, labelling and handling according to the scheme).',
      scenario: { label: 'Level without rules refused', given: 'the inventory with a level whose handling text is empty', when: 'the build runs', then: 'it fails naming the level' },
    },
    {
      id: 'req-approval', label: 'Level changes approved', ears_type: 'event-driven',
      trigger: 'a pull request adds, removes or changes a store\'s entry in data-inventory.json',
      action: 'require the approval of {{APPROVERS}} before it merges',
      rationale: 'The owner proposes the level and a second party agrees; a level lowered quietly is how restricted data ends up in an internal tool (ISO/IEC 27001 Annex A 5.12: the scheme is owned and kept).',
      scenario: { label: 'Lowering needs approval', given: 'a pull request that lowers a store from restricted to internal', when: 'only the author\'s team has approved it', then: 'it cannot merge until {{APPROVERS}} approves' },
    },
    {
      id: 'req-review', label: 'Levels reviewed on time', ears_type: 'state-driven',
      precondition: 'a store\'s entry has not been reviewed for {{REVIEW_MONTHS}} months',
      action: 'fail the nightly classification check, naming the store and its owner, until the owner confirms or changes its level and what it holds',
      rationale: 'Stores gain columns, exports and uses, and their level drifts with them; classification is to be revisited over the data\'s life (ISO/IEC 27001 Annex A 5.12).',
      scenario: { label: 'Overdue review reported', given: 'a store last reviewed {{REVIEW_MONTHS}} months and one day ago', when: 'the nightly check runs', then: 'it fails naming the store and its owner' },
    },
    {
      id: 'req-flow-never', label: 'Highest level never leaves', when: { FLOW: ['never'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a relation in the architecture model connects an external element with a store of the highest level, with an element that contains such a store, or with an element that reads or writes one',
      action: 'fail the build of that change unless data-inventory.json lists the flow as carrying none of the store\'s data, with the reason',
      rationale: 'The model already shows every path to the outside; checking it in the build that draws the relation stops the integration before it is built, and rules for transfers to outside parties are what ISO/IEC 27001 Annex A 5.14 asks for.',
      scenario: { label: 'New outside relation fails', given: 'a store at the highest level read by an element of the model', when: 'a change adds a relation from that element to an external system', then: 'the build fails naming the store, the external system and the relation, until the flow is listed as carrying none of the store\'s data' },
    },
    {
      id: 'req-flow-agreement', label: 'Highest level leaves only under agreement', when: { FLOW: ['agreement'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a relation in the architecture model connects an external element with a store of the highest level, with an element that contains such a store, or with an element that reads or writes one',
      action: 'fail the build unless data-inventory.json lists the flow either as carrying none of the store\'s data, or with the agreement that covers it, an end date still in the future, and the encrypted channel it uses',
      rationale: 'Processing by a processor has to be governed by a contract (GDPR Art. 28(3)), and transfers to outside parties need agreements (ISO/IEC 27001 Annex A 5.14); listing each flow with its agreement keeps the two in one place, and an ended agreement fails the build.',
      scenario: { label: 'Flow needs a live agreement', given: 'a store at the highest level whose reader calls an external system', when: 'the flow is missing from the inventory, and again when its agreement has ended', then: 'the build fails both times, naming the store, the external system and the relation' },
    },
    {
      id: 'req-categories', label: 'Regulated categories set the floor', when: { SCHEME: ['regulated'] }, ears_type: 'ubiquitous',
      action: 'list, for every store, the regulated categories it holds (personal, special-category, health, cardholder, or an empty list), and keep a store with special-category, health or cardholder data at restricted and one with personal data at confidential or above',
      rationale: 'Special categories of personal data carry a stricter regime of their own (GDPR Art. 9), as do cardholder data (PCI DSS) and health data; the stores in scope of each rule then come from one list.',
      scenario: { label: 'Category below its floor refused', given: 'a store classified internal', when: 'its entry lists cardholder data', then: 'the build fails saying the store must be restricted' },
    },
    {
      id: 'req-catalogue', label: 'Catalogue shows the level', when: { RECORD: ['catalogue'] }, ears_type: 'ubiquitous',
      action: 'carry each store\'s level as a DataClassification tag on its database or topic in the data catalogue, the same level as in the inventory, with a mismatch reported by the next nightly check',
      rationale: 'People find data through the catalogue, so the level has to be there, and labels follow the scheme wherever the data is shown (ISO/IEC 27001 Annex A 5.13; OpenMetadata classification).',
      scenario: { label: 'Catalogue and inventory agree', given: 'a store restricted in the inventory and tagged internal in the catalogue', when: 'the nightly check runs', then: 'it fails naming the store and both levels' },
    },
    {
      id: 'req-tags', label: 'Cloud resources tagged with the level', when: { RECORD: ['tags'] }, ears_type: 'ubiquitous',
      action: 'tag every cloud resource of a store (database instance, bucket, table, queue, stream) with data-classification set to its level, the same level as in the inventory, with a resource missing the tag or carrying another level reported within 1 day',
      rationale: 'Access policies, cost reports and scanners act on tags, so the label has to be on the resource itself (ISO/IEC 27001 Annex A 5.13); AWS Config\'s required-tags rule finds resources without it.',
      scenario: { label: 'Untagged resource reported', given: 'a store\'s bucket without the data-classification tag, and its database tagged with another level than the inventory\'s', when: 'the nightly checks run', then: 'both resources are reported with their store and the check fails' },
    },
    {
      id: 'req-discovery', label: 'Undeclared sensitive data found', when: { DISCOVERY: ['scanner'] }, ears_type: 'event-driven',
      trigger: 'the scanner finds credentials, financial or personal data in a store classified public or internal',
      action: 'report the store, the kind of data and the object to the store\'s owner within 1 day, and again every day until the store is reclassified or the data removed',
      rationale: 'Owners declare what they believe a store holds; a scanner finds what actually landed there (Amazon Macie, Google Cloud Sensitive Data Protection, Microsoft Purview Data Map), and a store whose content outgrew its level is a store under-protected (ISO/IEC 27001 Annex A 5.12).',
      scenario: { label: 'Card numbers in an internal store', given: 'a store classified internal whose export bucket gets a file with card numbers', when: 'the scanner analyses it and the daily check runs', then: 'the check fails naming the bucket, the finding type and the object' },
    },
  ],
  adrs: [
    {
      id: 'adr-four', label: 'Four classification levels', when: { SCHEME: ['four'] },
      decision: 'Every database and queue is classified at one of four levels, by the harm if its data leaked or was changed: public (none: it may be published), internal (limited harm: staff and contractors), confidential (serious harm: named roles), restricted (severe harm, or a regulatory or contractual breach: named people); limited, serious and severe are the FIPS 199 low, moderate and high impact. The most sensitive data a store holds sets its level. The store\'s owner (the product owner of the team that runs it) assigns the level, and {{APPROVERS}} approve every change to it through CODEOWNERS on data-inventory.json. That file lists the levels lowest first with their handling rules, and names each database and queue of the architecture model by its label with its level, owner, what it holds and the date of its last review, at most {{REVIEW_MONTHS}} months ago. The level is recorded in {{RECORD}}. Discovery: {{DISCOVERY}}. Restricted data goes {{FLOW}}, as the decision on flows says. How each level is encrypted is the Encryption pack\'s decision, and who read restricted data is logged as the Audit trail pack decides.',
      consequences: '• The few stores that need it get a stricter regime than confidential, without dragging every confidential store along.\n• Four levels need judgment between confidential and restricted; the handling rules must draw that line with examples, or people will pick by habit.\n• The inventory is one more file to keep in step with the model; the build keeps them together, so a store cannot merge without its level.\n• The levels say what the data is; the controls each level needs (encryption, access, logging) are decided in other packs and have to name the level.',
      alternatives: '1. Three levels: simpler, but card numbers and health records share a regime with every confidential spreadsheet.\n2. The UK Government Security Classifications (OFFICIAL, SECRET, TOP SECRET): made for government information; almost all business data would be OFFICIAL and the scheme would tell nothing apart.\n3. Levels kept on a wiki page: nothing keeps them in step with the stores.',
    },
    {
      id: 'adr-three', label: 'Three classification levels', when: { SCHEME: ['three'] },
      decision: 'Every database and queue is classified at one of three levels, by the harm if its data leaked or was changed: public (none: it may be published), internal (limited harm: staff and contractors), confidential (serious or severe harm, or a regulatory or contractual breach: named roles); limited corresponds to the FIPS 199 low impact, confidential covers moderate and high. The most sensitive data a store holds sets its level. The store\'s owner (the product owner of the team that runs it) assigns the level, and {{APPROVERS}} approve every change to it through CODEOWNERS on data-inventory.json. That file lists the levels lowest first with their handling rules, and names each database and queue of the architecture model by its label with its level, owner, what it holds and the date of its last review, at most {{REVIEW_MONTHS}} months ago. The level is recorded in {{RECORD}}. Discovery: {{DISCOVERY}}. Confidential data goes {{FLOW}}, as the decision on flows says. How each level is encrypted is the Encryption pack\'s decision, and who read confidential data is logged as the Audit trail pack decides.',
      consequences: '• Fewer judgment calls: three levels are applied more consistently than four.\n• Card numbers, health data and credentials share the confidential regime with every other confidential store, so that regime has to be strict enough for the worst of them, and costs the rest.\n• The flow rule covers all confidential data, so more relations to outside systems have to be listed.\n• The inventory is one more file to keep in step with the model; the build keeps them together.',
      alternatives: '1. Four levels: a restricted level for the few stores that need more, at the price of one more judgment call.\n2. Two levels (public and internal): too coarse to say which stores need more than staff access.\n3. Levels kept on a wiki page: nothing keeps them in step with the stores.',
    },
    {
      id: 'adr-regulated', label: 'Four levels with regulated categories', when: { SCHEME: ['regulated'] },
      decision: 'Every database and queue is classified at one of four levels, by the harm if its data leaked or was changed: public (none), internal (limited harm: staff and contractors), confidential (serious harm: named roles), restricted (severe harm, or a regulatory or contractual breach: named people); limited, serious and severe are the FIPS 199 low, moderate and high impact. Each store also lists the regulated categories it holds: personal data, special-category data (GDPR Art. 9: racial or ethnic origin, political opinions, religious or philosophical beliefs, trade union membership, genetic data, biometric data used to identify a person, health, sex life or sexual orientation), health data under other rules, and cardholder data (PCI DSS). Special-category, health and cardholder data make a store restricted; personal data at least confidential. What personal and special-category data need beyond their level is the Personal data pack\'s decision; the category marks the store as in scope. The store\'s owner assigns level and categories, and {{APPROVERS}} approve every change through CODEOWNERS on data-inventory.json, which names each database and queue of the architecture model by its label with its level, categories, owner, what it holds and the date of its last review, at most {{REVIEW_MONTHS}} months ago. The level is recorded in {{RECORD}}. Discovery: {{DISCOVERY}}. Restricted data goes {{FLOW}}, as the decision on flows says. Encryption per level is the Encryption pack\'s decision; who read restricted data is logged as the Audit trail pack decides.',
      consequences: '• The stores in scope of the GDPR, PCI DSS or health rules come from one list, which is what an auditor asks for first.\n• Two attributes per store instead of one, and the floors make a store with a single card number restricted.\n• Which data falls in which category is a legal reading the DPO or compliance officer gives; the inventory records it and does not decide it.\n• The inventory is one more file to keep in step with the model; the build keeps them together.',
      alternatives: '1. Four levels without categories: simpler, but the scope of each regulation has to be rebuilt by hand for each audit.\n2. Categories without levels: tells which law applies but not how to handle data no law names (trade secrets, credentials).\n3. The categories kept only in the record of processing: covers personal data, not cardholder or other regulated data.',
    },
    {
      id: 'adr-flow-never', label: 'Highest-level data stays inside', when: { FLOW: ['never'] },
      decision: `No data of the highest level (restricted with four levels, confidential with three) is sent to a system outside the organisation. A check in CI reads the architecture model and data-inventory.json together. ${FLOW_CHECK} The build fails for each such relation unless the inventory lists the flow (store and external element by their labels) with "data": "none" and the reason. An integration that would carry such data needs the data reclassified first, or this decision superseded. Copies to our own systems (a reporting database, a queue) are stores of their own and get the level of what they hold.`,
      consequences: '• The build shows each path to the outside as soon as the relation is drawn, before the integration is built.\n• The check over-approximates: an element that reads a restricted store and calls a mail service is flagged even when the call carries none of that data, and someone has to say so in the inventory, where a reviewer reads it.\n• It is as good as the model: a relation that is not drawn is not checked, so the model has to show every integration.\n• Processors that would need the data (payment providers, CRMs, support tools) are ruled out at this level.',
      alternatives: '1. External systems under a signed agreement: realistic when processors are part of the service, and more to keep track of.\n2. A data loss prevention tool on outbound traffic: catches what the model misses, but only after the integration is built and only for traffic it can read.\n3. A review by hand at design time: nothing keeps the next relation honest.',
    },
    {
      id: 'adr-flow-agreement', label: 'Highest-level data leaves only under agreement', when: { FLOW: ['agreement'] },
      decision: `Data of the highest level (restricted with four levels, confidential with three) goes to a system outside the organisation only when data-inventory.json lists the flow: the store and the external element by their labels in the model, the data it carries, the agreement that covers it (a data processing agreement under GDPR Art. 28 when personal data is in it, a data-sharing or confidentiality agreement otherwise), the date that agreement ends, and the encrypted channel it uses, named as the Encryption pack decides. A check in CI reads the architecture model and the inventory together. ${FLOW_CHECK} The build fails for each such relation whose flow is not listed, or whose agreement has ended; a flow that carries none of the store's data is listed with "data": "none" and the reason. The owner of each flow renews its agreement before the end date.`,
      consequences: '• Every outside party holding the most sensitive data appears in one list with its agreement: the list a DPO or an auditor asks for.\n• An agreement that ends turns the build red on that day, so renewals have to be tracked ahead of it.\n• The check over-approximates: an element that reads a restricted store and calls a mail service is flagged even when the call carries none of that data, and someone has to say so in the inventory.\n• It is as good as the model: a relation that is not drawn is not checked.\n• The check reads the agreement\'s reference and end date, not its content; whether it covers the data is the DPO\'s reading.',
      alternatives: '1. Nowhere outside the organisation: the simplest to prove, and it rules out processors.\n2. A vendor register in a GRC tool without a link to the model: the register and the system drift apart.\n3. A data loss prevention tool on outbound traffic: catches what the model misses, but only after the integration is built.',
    },
  ],
  fitness: [
    {
      id: 'ff-inventory', label: 'Every store in the inventory', characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: SCHEMES, checks: ['req-classified', 'req-handling'],
      threshold: '0 databases or queues of the model (not external) without an entry with a level of the scheme, an owner, what it holds and a review date; 0 entries naming no store of the model; 0 levels without handling rules',
      description: 'A Node script in CI reads the front matter of every node file under architecture/nodes, takes the databases and queues not marked external, and checks each against data-inventory.json by its label; it also fails on an entry whose store is gone from the model and on a level whose handling rules are empty.',
      tool: 'Node 20 with js-yaml, a step of the pull-request workflow',
      language: 'js',
      snippet: `// scripts/check-data-inventory.mjs, run from the repository root in CI: node scripts/check-data-inventory.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'

const [dir = 'architecture', file = 'data-inventory.json'] = process.argv.slice(2)
const inventory = JSON.parse(readFileSync(file, 'utf8'))
const levels = inventory.levels.map((l) => l.name)
const problems = inventory.levels.filter((l) => !l.handling?.trim()).map((l) => \`level \${l.name} has no handling rules\`)
const stores = readdirSync(join(dir, 'nodes'), { recursive: true }).filter((f) => f.endsWith('.md'))
  .map((f) => yaml.load(readFileSync(join(dir, 'nodes', f), 'utf8').split(/^---$/m)[1]))
  .filter((n) => (n.type === 'database' || n.type === 'queue') && n.external !== true)
for (const store of stores) {
  const entry = inventory.stores.find((e) => e.element === store.label)
  if (!entry) problems.push(\`\${store.label}: no entry in \${file}\`)
  else if (!levels.includes(entry.level) || !entry.owner || !entry.holds?.length || !/^\\d{4}-\\d{2}-\\d{2}$/.test(entry.reviewed ?? ''))
    problems.push(\`\${store.label}: needs a level (\${levels.join(', ')}), an owner, what it holds and a reviewed date\`)
}
for (const entry of inventory.stores)
  if (!stores.some((s) => s.label === entry.element)) problems.push(\`\${entry.element}: in \${file} but no database or queue of the model\`)
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-review', label: 'Levels reviewed in time', characteristic: 'security', scope: 'atomic', cadence: 'temporal', every: '365d', invocation: 'manual', implements: SCHEMES, checks: ['req-review'],
      threshold: '0 inventory entries whose review date is more than {{REVIEW_MONTHS}} months old',
      description: 'A nightly job compares each entry\'s reviewed date with today minus {{REVIEW_MONTHS}} months and fails, listing each overdue store with its owner, so the owner confirms or changes the level and what the store holds and updates the date in a pull request.',
      tool: 'bash with jq and GNU date in a scheduled GitHub Actions job',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# nightly: every store's classification reviewed within {{REVIEW_MONTHS}} months
set -euo pipefail
cutoff=$(date -u -d "-{{REVIEW_MONTHS}} months" +%F)   # GNU date, as on ubuntu-latest runners
overdue=$(jq -r --arg cutoff "$cutoff" \\
  '.stores[] | select(.reviewed < $cutoff) | "\\(.element): owner \\(.owner), last reviewed \\(.reviewed)"' data-inventory.json)
[ -z "$overdue" ] || { echo "classification reviews overdue:"; echo "$overdue"; exit 1; }`,
    },
    {
      id: 'ff-approval', label: 'Inventory owned by the approvers', characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: SCHEMES, checks: ['req-approval'],
      threshold: 'CODEOWNERS gives /data-inventory.json to {{APPROVERS}}, has 0 errors, and a ruleset on main requires a code owner\'s review',
      description: 'A job reads CODEOWNERS for the inventory\'s line, asks GitHub whether CODEOWNERS has errors (an unknown team makes the line silently void), and checks that the rules on main include a pull_request rule with require_code_owner_review. The rest of the ruleset is the Code review and branching pack\'s.',
      tool: 'GitHub CLI (gh api: codeowners/errors and rules/branches/main)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI on main and nightly: changes to the inventory need {{APPROVERS}}
set -euo pipefail
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
grep -Eq '^/data-inventory\\.json[[:space:]]+.*{{APPROVERS}}' .github/CODEOWNERS \\
  || { echo "CODEOWNERS does not give /data-inventory.json to {{APPROVERS}}"; exit 1; }
[ "$(gh api "repos/$repo/codeowners/errors" -q '.errors | length')" = 0 ] \\
  || { echo "CODEOWNERS has errors: gh api repos/$repo/codeowners/errors"; exit 1; }
[ "$(gh api "repos/$repo/rules/branches/main" -q '[.[] | select(.type == "pull_request") | .parameters.require_code_owner_review] | any')" = true ] \\
  || { echo "no ruleset on main requires a code owner's review"; exit 1; }`,
    },
    {
      id: 'ff-flow-never', label: 'No path from the highest level outside', when: { FLOW: ['never'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-flow-never'], checks: ['req-flow-never'],
      threshold: '0 interacts relations between an external element and a store of the highest level, an element containing it, or an element reading or writing it, unless listed in the inventory with "data": "none"',
      description: `A Node script in the pull-request build reads architecture/nodes (front matter: id, type, label, external; a node's children are in its folder), architecture/relations.json and data-inventory.json. ${FLOW_CHECK} Each such relation fails the build unless the inventory's flows list it with "data": "none", and the message names the store, the external element and the relation.`,
      tool: 'Node 20 with js-yaml, a step of the pull-request workflow (beside radical check, if the model is checked there too)',
      language: 'js',
      snippet: `// scripts/check-data-flows.mjs, run from the repository root in CI: node scripts/check-data-flows.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import yaml from 'js-yaml'
const read = (f) => readFileSync(f, 'utf8')
const inventory = JSON.parse(read('data-inventory.json'))
const nodes = readdirSync('architecture/nodes', { recursive: true }).filter((f) => f.endsWith('.md')).map((f) => ({
  ...yaml.load(read(join('architecture/nodes', f)).split(/^---$/m)[1]), folder: f.endsWith('_index.md') ? dirname(f) : f.slice(0, -3) }))
const byId = new Map(nodes.map((n) => [n.id, n]))
const parentOf = (n) => nodes.find((p) => p.folder === dirname(n.folder))   // a node's children live in its folder
const links = JSON.parse(read('architecture/relations.json')).filter((r) => r.relationType === 'interacts')
  .flatMap((r) => [[r.sourceId, r.targetId, r], [r.targetId, r.sourceId, r]])   // both ways: a call brings data back too
const top = inventory.levels.at(-1).name   // levels are listed lowest first
const allowed = (store, to) => (inventory.flows ?? []).some((f) => f.store === store && f.to === to && f.data === 'none')
for (const entry of inventory.stores.filter((e) => e.level === top)) {
  const store = nodes.find((n) => n.label === entry.element && ['database', 'queue'].includes(n.type))
  const near = new Set()   // the store, what holds it, and what reads or writes it
  for (let n = store; n; n = parentOf(n)) near.add(n.id)
  for (const [a, b] of links) if (a === store?.id && !byId.get(b)?.external) near.add(b)
  for (const [a, b, r] of links) if (near.has(a) && byId.get(b)?.external && !allowed(entry.element, byId.get(b).label)) {
    console.error(\`\${entry.element} (\${top}) can reach \${byId.get(b).label} through "\${byId.get(r.sourceId).label} → \${byId.get(r.targetId).label}" with no allowed flow in data-inventory.json\`)
    process.exitCode = 1
  }
}`,
    },
    {
      id: 'ff-flow-agreement', label: 'Every path outside under a live agreement', when: { FLOW: ['agreement'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-flow-agreement'], checks: ['req-flow-agreement'],
      threshold: '0 interacts relations between an external element and a store of the highest level, an element containing it, or an element reading or writing it, without a listed flow that carries no data or names an agreement, an end date after today and a channel',
      description: `A Node script in the pull-request build, and nightly so that an agreement ending turns it red, reads architecture/nodes (front matter: id, type, label, external; a node's children are in its folder), architecture/relations.json and data-inventory.json. ${FLOW_CHECK} Each such relation fails unless the inventory's flows list it with "data": "none", or with an agreement, an until date in the future and a channel; the message names the store, the external element and the relation.`,
      tool: 'Node 20 with js-yaml, a step of the pull-request workflow and of a nightly job',
      language: 'js',
      snippet: `// scripts/check-data-flows.mjs, run from the repository root in CI: node scripts/check-data-flows.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import yaml from 'js-yaml'
const read = (f) => readFileSync(f, 'utf8')
const inventory = JSON.parse(read('data-inventory.json'))
const nodes = readdirSync('architecture/nodes', { recursive: true }).filter((f) => f.endsWith('.md')).map((f) => ({
  ...yaml.load(read(join('architecture/nodes', f)).split(/^---$/m)[1]), folder: f.endsWith('_index.md') ? dirname(f) : f.slice(0, -3) }))
const byId = new Map(nodes.map((n) => [n.id, n]))
const parentOf = (n) => nodes.find((p) => p.folder === dirname(n.folder))   // a node's children live in its folder
const links = JSON.parse(read('architecture/relations.json')).filter((r) => r.relationType === 'interacts')
  .flatMap((r) => [[r.sourceId, r.targetId, r], [r.targetId, r.sourceId, r]])   // both ways: a call brings data back too
const top = inventory.levels.at(-1).name   // levels are listed lowest first
const allowed = (store, to) => (inventory.flows ?? []).some((f) => f.store === store && f.to === to &&
  (f.data === 'none' || (f.agreement && f.channel && Date.parse(f.until) > Date.now())))
for (const entry of inventory.stores.filter((e) => e.level === top)) {
  const store = nodes.find((n) => n.label === entry.element && ['database', 'queue'].includes(n.type))
  const near = new Set()   // the store, what holds it, and what reads or writes it
  for (let n = store; n; n = parentOf(n)) near.add(n.id)
  for (const [a, b] of links) if (a === store?.id && !byId.get(b)?.external) near.add(b)
  for (const [a, b, r] of links) if (near.has(a) && byId.get(b)?.external && !allowed(entry.element, byId.get(b).label)) {
    console.error(\`\${entry.element} (\${top}) can reach \${byId.get(b).label} through "\${byId.get(r.sourceId).label} → \${byId.get(r.targetId).label}" with no allowed flow in data-inventory.json\`)
    process.exitCode = 1
  }
}`,
    },
    {
      id: 'ff-categories', label: 'Categories at or above their floor', when: { SCHEME: ['regulated'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-regulated'], checks: ['req-categories'],
      threshold: '0 entries without a categories list; 0 unknown categories; 0 stores below the floor of a category they hold (special-category, health, cardholder: restricted; personal: confidential)',
      description: 'A Node script in CI reads data-inventory.json and fails on an entry with no categories list, a category outside the four, or a level below the lowest its categories allow.',
      tool: 'Node 20, a step of the pull-request workflow',
      language: 'js',
      snippet: `// scripts/check-data-categories.mjs: the lowest level each regulated category allows
import { readFileSync } from 'node:fs'

const inventory = JSON.parse(readFileSync('data-inventory.json', 'utf8'))
const FLOOR = { personal: 'confidential', 'special-category': 'restricted', health: 'restricted', cardholder: 'restricted' }
const rank = (level) => inventory.levels.findIndex((l) => l.name === level)
const problems = inventory.stores.flatMap((s) => !Array.isArray(s.categories)
  ? [\`\${s.element}: no categories (an empty list when it holds none of \${Object.keys(FLOOR).join(', ')})\`]
  : s.categories.map((c) => !(c in FLOOR) ? \`\${s.element}: unknown category \${c}\`
    : rank(s.level) < rank(FLOOR[c]) ? \`\${s.element}: holds \${c} data, so it is at least \${FLOOR[c]}, not \${s.level}\` : '').filter(Boolean))
if (problems.length) { console.error(problems.join('\\n')); process.exit(1) }`,
    },
    {
      id: 'ff-catalogue', label: 'Catalogue level equals the inventory', when: { RECORD: ['catalogue'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: SCHEMES, checks: ['req-catalogue'],
      threshold: '0 stores whose database or topic in OpenMetadata lacks the DataClassification tag of the inventory\'s level or carries another one',
      description: 'A nightly job reads each store\'s catalogue entity and fully qualified name from the inventory (catalogue.entity is databases or topics), fetches it from the OpenMetadata API with its tags, and compares the tags of the DataClassification classification (one tag per level, named as the level) with the inventory. With DataHub, Microsoft Purview or Collibra, the same comparison runs against their APIs.',
      tool: 'bash with curl and jq against the OpenMetadata REST API (GET /api/v1/databases/name/{fqn} and /api/v1/topics/name/{fqn} with fields=tags)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# nightly: the DataClassification tag in OpenMetadata equals the inventory's level ($OM_URL, $OM_TOKEN: a bot's token)
set -euo pipefail
fail=0
while IFS=$'\\t' read -r element level entity fqn; do
  tags=$(curl -fsS -H "Authorization: Bearer $OM_TOKEN" "$OM_URL/api/v1/$entity/name/$fqn?fields=tags" \\
    | jq -r '[.tags[].tagFQN | select(startswith("DataClassification."))] | join(",")')
  [ "$tags" = "DataClassification.$level" ] \\
    || { echo "$element: the catalogue has '\${tags:-no level}', the inventory $level"; fail=1; }
done < <(jq -r '.stores[] | [.element, .level, .catalogue.entity, .catalogue.fqn] | @tsv' data-inventory.json)
exit $fail`,
    },
    {
      id: 'ff-tags-required', label: 'Store resources carry the tag', when: { RECORD: ['tags'] }, characteristic: 'security', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: SCHEMES, checks: ['req-tags'],
      threshold: '0 NON_COMPLIANT resources for the data-classification-tag Config rule (RDS instances, DynamoDB tables, S3 buckets, Redshift clusters)',
      description: 'An AWS Config managed rule (REQUIRED_TAGS) evaluates every RDS instance, DynamoDB table, S3 bucket and Redshift cluster for a data-classification tag when it changes, and a nightly job fails while any is non-compliant. The rule reports and does not block creation. Queues and streams (SQS, Kinesis, MSK) are outside the rule\'s resource types and are covered by the nightly comparison with the inventory. On Azure the built-in Require a tag on resources policy does this job.',
      tool: 'Terraform (aws_config_config_rule) and the AWS CLI (configservice get-compliance-details-by-config-rule)',
      language: 'hcl',
      snippet: `# infra/data-classification.tf: the store resources AWS Config can evaluate must carry the tag
resource "aws_config_config_rule" "data_classification_tag" {
  name = "data-classification-tag"
  source {
    owner             = "AWS"
    source_identifier = "REQUIRED_TAGS"
  }
  input_parameters = jsonencode({ tag1Key = "data-classification" }) # its value is compared with the inventory nightly
  scope {
    compliance_resource_types = ["AWS::RDS::DBInstance", "AWS::DynamoDB::Table", "AWS::S3::Bucket", "AWS::Redshift::Cluster"]
  }
  depends_on = [aws_config_configuration_recorder.main]
}
# nightly in CI, failing while any of them lacks the tag:
#   missing=$(aws configservice get-compliance-details-by-config-rule --config-rule-name data-classification-tag \\
#     --compliance-types NON_COMPLIANT --output text \\
#     --query "EvaluationResults[].EvaluationResultIdentifier.EvaluationResultQualifier.[ResourceType, ResourceId]")
#   [ -z "$missing" ] || { echo "resources without a data-classification tag:"; echo "$missing"; exit 1; }`,
    },
    {
      id: 'ff-tags-match', label: 'Tags equal the inventory', when: { RECORD: ['tags'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: SCHEMES, checks: ['req-tags'],
      threshold: '0 resources listed in the inventory whose data-classification tag is missing or differs from the store\'s level',
      description: 'A nightly job takes every resource ARN the inventory lists for a store (resources: database instances, buckets, tables, queues, streams) and reads its tags with the Resource Groups Tagging API; a resource that has never been tagged is not returned at all, so it reports as None. The API is regional: the job runs once per region the stores live in.',
      tool: 'bash with jq and the AWS CLI (resourcegroupstaggingapi get-resources --resource-arn-list)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# nightly, per region: every resource the inventory lists carries data-classification = its level
set -euo pipefail
fail=0
while IFS=$'\\t' read -r element level arn; do
  got=$(aws resourcegroupstaggingapi get-resources --resource-arn-list "$arn" --output text \\
    --query "ResourceTagMappingList[0].Tags[?Key=='data-classification'].Value | [0]")
  [ "$got" = "$level" ] || { echo "$element: $arn is tagged '$got', the inventory says $level"; fail=1; }
done < <(jq -r '.stores[] | .element as $e | .level as $l | .resources[]? | [$e, $l, .] | @tsv' data-inventory.json)
exit $fail`,
    },
    {
      id: 'ff-discovery', label: 'No sensitive data in low-level stores', when: { DISCOVERY: ['scanner'] }, characteristic: 'security', scope: 'holistic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: SCHEMES, checks: ['req-discovery'],
      threshold: '0 Macie sensitive-data findings created in the last 24 hours in an S3 bucket of a store classified public or internal',
      description: 'Macie\'s automated sensitive data discovery runs over the S3 buckets; database contents reach it as RDS or Aurora snapshot exports (Parquet) and DynamoDB table exports in buckets the inventory lists under the store\'s resources. A daily job asks Macie for sensitive-data findings (category CLASSIFICATION) of the last day in the buckets of stores classified public or internal, prints bucket, finding type and object, and fails, so the owner is told the same day. On Google Cloud the job reads Sensitive Data Protection data profiles instead, on Azure the classifications of Purview Data Map scans.',
      tool: 'bash with jq and the AWS CLI (macie2 list-findings and get-findings)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# daily: sensitive-data findings of the last 24 hours in buckets of stores classified public or internal
set -euo pipefail
buckets=$(jq -c '[.stores[] | select(.level == "public" or .level == "internal") | .resources[]?
  | select(startswith("arn:aws:s3:::")) | ltrimstr("arn:aws:s3:::")] | .[:50]' data-inventory.json)
[ "$buckets" = "[]" ] && exit 0
since=$(( ($(date +%s) - 86400) * 1000 ))   # Unix time in milliseconds, as the Macie API takes it
criteria="{\\"criterion\\":{\\"category\\":{\\"eq\\":[\\"CLASSIFICATION\\"]},\\"createdAt\\":{\\"gte\\":$since},\\"resourcesAffected.s3Bucket.name\\":{\\"eq\\":$buckets}}}"
ids=$(aws macie2 list-findings --finding-criteria "$criteria" --query 'findingIds[:50]' --output json)
[ "$ids" = "[]" ] && exit 0
aws macie2 get-findings --finding-ids $(jq -r '.[]' <<< "$ids") --output text \\
  --query 'findings[].[resourcesAffected.s3Bucket.name, type, resourcesAffected.s3Object.key]'
echo "sensitive data in stores classified public or internal: tell each owner, then reclassify the store or remove the data"
exit 1`,
    },
  ],
}

export default pack
