import type { PackSpec } from '../../src/packSpec'

const DECISIONS = ['adr-adr-repo', 'adr-model', 'adr-wiki']
const FORCES = 'Code lives in this element and will be read, changed and operated by people who were not there when it was written, and by the same people a year later. The forces: a decision that is not written down is re-argued at every change, or quietly reversed; documentation kept away from the code is not updated when the code is, and a page that was true once reads as if it still were; generated reference is always current but says what, never why; a wiki reaches readers who never open a repository, at the price of living where no review and no build can check it; a diagram drawn once drifts from the system it shows the moment the next pull request merges; and every page costs time to keep, so the set has to be small enough that it is kept. The snippets assume one repository layout: source in src/, tests in test/, documentation in docs/ (diagrams in docs/diagrams/), and in a monorepo one directory per workspace under packages/.'

const pack: PackSpec = {
  id: 'concern-code-documentation',
  name: 'Code documentation',
  group: 'coding',
  description: 'What about the element is written down, where it lives and how it stays true: the decisions, the API reference, the README of each module, the documentation site, and the diagrams or the architecture model.',
  tags: ['maintainability', 'documentation', 'adr', 'docs as code', 'api docs', 'diagrams', 'readme'],
  concern: {
    id: 'code-documentation',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements, so what is written down about it, where, and how it is kept true has to be decided; one decision usually covers a whole repository and is bound to every element built from it.',
  },
  sources: [
    { title: 'Michael Nygard: Documenting Architecture Decisions', url: 'https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions' },
    { title: 'MADR: Markdown Any Decision Records', url: 'https://adr.github.io/madr/' },
    { title: 'Simon Brown: The C4 model for visualising software architecture', url: 'https://c4model.com/' },
    { title: 'Write the Docs: Docs as Code', url: 'https://www.writethedocs.org/guide/docs-as-code/' },
    { title: 'Diátaxis: a systematic approach to technical documentation', url: 'https://diataxis.fr/' },
    { title: 'Google developer documentation style guide', url: 'https://developers.google.com/style' },
    { title: 'OpenAPI Specification', url: 'https://spec.openapis.org/oas/latest.html' },
    { title: 'ISO/IEC 25010, Maintainability: analysability', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
    { title: 'lychee link checker', url: 'https://lychee.cli.rs/' },
    { title: 'MkDocs: strict builds and configuration', url: 'https://www.mkdocs.org/user-guide/configuration/' },
    { title: 'Python documentation: doctest', url: 'https://docs.python.org/3/library/doctest.html' },
  ],
  questions: [
    {
      key: 'DECISIONS', title: 'Decisions', label: 'Where are architecture decisions recorded?',
      hint: 'A decision that is not written down is re-argued at every change. Where the record lives decides who reads it, who reviews it, and whether anything checks that it is still true.',
      default: 'adr-repo',
      options: [
        { value: 'adr-repo', label: 'decision records as files in the repository', description: 'One Markdown file per decision in the repository, in the MADR format (YAML front matter with status, date and decision-makers; sections for context, options, outcome and consequences), reviewed in the pull request with the code that implements it. Pick it when the people who need the decisions are the people who open the repository, and you want the record versioned and reviewed like code.' },
        { value: 'model', label: 'decisions in an architecture model next to the code', description: 'Decisions live in an architecture model kept in the repository (a radical.tools Markdown folder, or Structurizr DSL with its ADR tooling), each linked to the elements it constrains and to the requirements and checks behind it, and a CI job checks the model. Pick it when you already keep a C4 model or want decisions, diagrams and requirements to be one connected thing rather than three folders.' },
        { value: 'wiki', label: 'a decision log in a wiki or document space', description: 'Decisions are pages in Confluence, Notion or a similar space, from one template, with an index page per system and a link from the repository. Pick it when most readers (product, operations, architecture board, auditors) never open a repository and need to find and comment on decisions where they already work.' },
      ],
    },
    {
      key: 'API_DOCS', title: 'API reference', label: 'How is the API documented?',
      hint: 'Generated reference is always current but says what, never why; a written guide explains, but goes stale unless its examples are run. An HTTP contract and a library\'s reference are generated from different sources, so they are different answers here.',
      default: 'generated',
      options: [
        { value: 'generated', label: 'generated from the OpenAPI contract on every build', description: 'An HTTP API documented by its OpenAPI contract: the contract file (or the one generated from annotations) is the source of truth, rendered as a site (Redoc, Swagger UI) on every release, with a check that the contract and the running code agree. Pick it for any HTTP API other teams or customers call.' },
        { value: 'reference', label: 'generated from the code\'s doc comments on every build', description: 'A library or SDK documented by its doc comments: TSDoc, Javadoc or docstrings rendered by TypeDoc, Javadoc or Sphinx into a reference site published with each release, with warnings as errors. Pick it for a published package with no HTTP contract.' },
        { value: 'written', label: 'a hand-written guide in the repository, with examples run by tests', description: 'A guide written for readers (how to authenticate, the three calls that matter, the error model), kept next to the code, whose code examples are executed in CI (doctests, executed Markdown snippets). Pick it for a library or SDK where a tutorial beats a reference, and someone owns the text.' },
        { value: 'none', label: 'no public API; internal types documented in code only', description: 'Nothing outside the team calls the element; its exported types and functions carry doc comments and nothing is published. Pick it for a web app or a batch job with no callers, so that no one builds a reference nobody reads.' },
      ],
    },
    {
      key: 'READMES', title: 'READMEs', label: 'Where does a newcomer read how to run and test a module?',
      hint: 'The README is read more than any other page; what it must say decides whether a new person runs the module on day one or asks.',
      default: 'per-module',
      options: [
        { value: 'per-module', label: 'a README in every package, module or service', description: 'Every package, module or service directory holds a README with the same sections (purpose, how to run, how to test, who owns it), and a check fails when one is missing or a section is absent. Pick it for a monorepo or any repository with more than one deployable or publishable unit.' },
        { value: 'root-only', label: 'one README at the repository root', description: 'One README at the root explains how to run and test the whole repository and holds a table of its modules with a line of purpose and an owner each. Pick it for a single-purpose repository where per-module READMEs would repeat the same text.' },
      ],
    },
    {
      key: 'DOCS_SITE', title: 'Documentation', label: 'Where is the longer documentation kept and published?',
      hint: 'Documentation that lives in the repository is reviewed and built with the code and can fail the build on a broken link; documentation outside it reaches more readers, and only a scheduled job over the space\'s API checks it.',
      default: 'docs-as-code',
      options: [
        { value: 'docs-as-code', label: 'docs as code in the repository, built and published in CI', description: 'Markdown or AsciiDoc in the repository, organised by Diátaxis (tutorials, how-to guides, reference, explanation), built by Docusaurus, MkDocs or Antora on every pull request and published on merge; a broken link or a warning fails the build. Pick it when the writers are the developers and the readers are developers or operators.' },
        { value: 'external', label: 'kept and published outside the repository', description: 'Documentation lives in Confluence, Notion, GitBook or a help-centre product, written by people who do not work in the repository, with a link from the README and the release it describes on each page. Pick it when technical writers or support own the documentation, or the readers are end users.' },
      ],
    },
    {
      key: 'DIAGRAMS', title: 'Diagrams', label: 'How are the architecture diagrams kept?',
      hint: 'A diagram drawn once is out of date after the next merge; a diagram rendered from a model or from text in the repository changes in the pull request that changes the system.',
      default: 'model',
      options: [
        { value: 'model', label: 'rendered from a model or diagram-as-code in the repository', description: 'Diagrams are rendered from a model or text kept in the repository (radical.tools, Structurizr DSL, PlantUML with C4-PlantUML, Mermaid) and reviewed in the pull request with the change they show. Pick it by default: the diagram is a diff, and a check can tell when code changed and the diagram did not.' },
        { value: 'images', label: 'hand-drawn images, dated, in the docs folder', description: 'Diagrams are drawn in draw.io or Excalidraw and kept as images in docs/diagrams, each with its editable source file next to it and a caption with its date and author on the page that shows it. Pick it for a small system with one or two diagrams, or sketches whose value is the conversation, not the record.' },
      ],
    },
  ],
  details: [
    { key: 'ADR_DAYS', label: 'How many days may a decision record stay in status proposed?', default: '14', number: true },
    { key: 'ADR_DIR', label: 'Which directory holds the decision records?', default: 'docs/adr' },
    { key: 'MODEL_DIR', label: 'Which folder holds the architecture model?', default: 'architecture' },
    { key: 'README_SECTIONS', label: 'Which sections must every README have (comma-separated headings)?', default: 'Purpose, Run, Test, Owner' },
    { key: 'DOC_COMMENT_COVERAGE_PCT', label: 'What share of the exported symbols must carry doc comments (%)?', default: '90', number: true },
    { key: 'LINK_CHECK_MINUTES', label: 'Within how many minutes must the documentation build, link check included, finish?', default: '5', number: true },
    { key: 'MAX_DOC_AGE_DAYS', label: 'After how many days without review is a documentation page or diagram stale?', default: '365', number: true },
  ],
  need: {
    label: 'The element can be understood without asking',
    text: 'People who did not write the element have to change it, run it and reason about it: a new team member, an on-call engineer at night, a reviewer in another team, the author a year later. They need to find why it is built the way it is, what it offers to its callers, how to run and test each part, and how its parts fit together, and what they find has to be true today, not when it was written. ISO 25010 calls this analysability; in practice it is the difference between a change that takes an afternoon and one that takes a week of archaeology.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-adr-recorded', label: 'Significant decisions are recorded', ears_type: 'event-driven',
      trigger: 'an architecturally significant decision is made (a new or removed dependency, external service or data store, a protocol or format other systems rely on, a security or data-handling choice, or going against an earlier decision)',
      action: 'record it as one decision record with a title, status, date, context, decision and consequences, in: {{DECISIONS}}, and move the record out of status proposed (to accepted or rejected) within {{ADR_DAYS}} days',
      rationale: 'A decision that is not written down is re-argued at every change or reversed without anyone noticing; the fields are the minimum that lets a later reader judge whether the context still holds, and a record left proposed is a decision nobody made (Nygard, Documenting Architecture Decisions; MADR).',
      scenario: { label: 'Decision gets a complete record', given: 'a decision record created for a new external service', when: 'the decision check runs on the pull request', then: 'the record has title, status, date, context, decision and consequences, and the check fails on a record left in proposed for more than {{ADR_DAYS}} days' },
    },
    {
      id: 'req-adr-supersede', label: 'Superseded decisions link forward', ears_type: 'event-driven',
      trigger: 'a new decision replaces or amends an earlier one',
      action: 'mark the earlier record as superseded with a link to the new record, and leave the earlier record in place rather than deleting or rewriting it',
      rationale: 'The old record explains code that is still there; a reader who finds it must be sent to the current decision (Nygard: records are immutable, status superseded).',
      scenario: { label: 'Old decision points to the new', given: 'an accepted decision record', when: 'a new decision replaces it and the decision check runs', then: 'the old record reads superseded and links to a record that exists; a superseded record with no link, or a link to a missing record, fails the check' },
    },
    {
      id: 'req-adr-with-code', label: 'Decision reviewed with its code', when: { DECISIONS: ['adr-repo', 'model'] }, ears_type: 'ubiquitous',
      action: 'keep the decision record in the repository and change it in the same pull request as the first code that implements the decision, so that the reviewer of the code reviews the decision',
      rationale: 'A decision reviewed with its code gets the same scrutiny as the code and is versioned with it; one reviewed elsewhere is approved by people who do not see what it costs (Nygard; Write the Docs, Docs as Code).',
      scenario: { label: 'Decision and code in one pull request', given: 'a change that implements a new decision', when: 'its pull request is reviewed', then: 'the diff holds both the decision record and the code, and the reviewer refuses a record merged ahead of the code' },
      unchecked: 'the reviewer of each pull request checks that a new or changed decision record arrives with the code that implements it; no tool can tell which change implements which decision',
    },
    {
      id: 'req-adr-linked', label: 'Decisions linked to what they constrain', when: { DECISIONS: ['model'] }, ears_type: 'ubiquitous',
      action: 'link every decision in the model to at least one element it constrains and, where one exists, to the automated check that enforces it, and fail the CI check on an accepted decision without date, context, decision or consequences, or on a decision that settles a concern for no element',
      rationale: 'In a model a decision is only useful if a reader of an element can reach it from that element; an unlinked decision is a file in a different folder with extra steps (C4 model; the rules adr-incomplete and concern-unbound of radical check).',
      scenario: { label: 'Unbound decision fails the check', given: 'the architecture model with a decision marked with a concern that constrains no element', when: 'the CI check runs with those rules raised to errors in check.json', then: 'it fails naming the decision, and passes once the decision constrains an element' },
    },
    {
      id: 'req-adr-wiki-index', label: 'Decision log is findable from the code', when: { DECISIONS: ['wiki'] }, ears_type: 'ubiquitous',
      action: 'keep one decision log index page per system linking every decision page, make every decision page from the same template with status and date properties, and link the index from the repository README',
      rationale: 'Pages outside the repository are found only through links; without an index and a link from the code, the log is what the person who wrote it remembers (Nygard; Google developer documentation style guide on navigation).',
      scenario: { label: 'Decision reached from the code', given: 'a decision page in the space', when: 'the weekly decision-log job runs', then: 'the page has status and date properties, the index page links it, and the README links the index; a page missing from the index fails the job' },
    },
    {
      id: 'req-api-regenerated', label: 'Contract and code agree on every build', when: { API_DOCS: ['generated'] }, ears_type: 'event-driven',
      trigger: 'a pull request is built',
      action: 'generate the OpenAPI specification from the running code, compare it with the contract file in the repository, and fail the build when they differ in any path, operation, parameter, schema or response',
      rationale: 'A contract file that drifts from the code documents an API that does not exist, and the reference rendered from it is wrong on the day it is published (OpenAPI Specification; what may change between versions is the API evolution concern\'s decision).',
      scenario: { label: 'Drift fails the build', given: 'a contract file and code that adds a response field without updating it', when: 'the pull request is built', then: 'the drift check fails naming the field, and passes once contract and code agree' },
    },
    {
      id: 'req-reference-built', label: 'Reference builds clean and is published', when: { API_DOCS: ['reference'] }, ears_type: 'event-driven',
      trigger: 'a pull request is built, or a release is made',
      action: 'build the API reference from the doc comments with warnings treated as errors (an unresolved link or an undocumented export is a warning) and, on a release, publish it under the release version',
      rationale: 'A generated reference is only as current as its last build, and a warning ignored today is a blank page or a dead link in the published site (Google developer documentation style guide on API reference; Write the Docs, Docs as Code).',
      scenario: { label: 'Broken link fails the reference build', given: 'a doc comment with a {@link} to a renamed symbol', when: 'the pull request is built', then: 'the reference build fails naming the comment, and the release job publishes only a build with 0 warnings' },
    },
    {
      id: 'req-doc-comments', label: 'Exported symbols carry doc comments', ears_type: 'ubiquitous',
      action: 'carry a doc comment with a one-line summary on at least {{DOC_COMMENT_COVERAGE_PCT}}% of the exported or public symbols of the element, measured on every pull request, with the undocumented ones listed',
      rationale: 'Whether or not a reference is published, a symbol without a comment is a blank page for the next reader; a threshold on the whole keeps the gate from blocking every typo while the number is brought up (Google developer documentation style guide on API reference comments; ISO 25010 analysability).',
      scenario: { label: 'Coverage below the threshold refused', given: 'a pull request exporting a new function without a doc comment that takes coverage below {{DOC_COMMENT_COVERAGE_PCT}}%', when: 'the doc-comment test runs', then: 'it fails with the coverage and names the function' },
    },
    {
      id: 'req-examples-run', label: 'Examples in the docs are executed', when: { API_DOCS: ['written'] }, ears_type: 'ubiquitous',
      action: 'execute every code example in the API guide as a test on each pull request, and fail the build when an example throws or does not compile, or, where the tool compares output (Python doctest), prints something other than what the guide shows',
      rationale: 'A written guide stays true only if its examples are run; an example that nobody runs is the first thing to break and the last to be noticed (Write the Docs, Docs as Code; Python doctest).',
      scenario: { label: 'Broken example fails the build', given: 'a guide whose example calls a function that was renamed', when: 'the pull request runs its tests', then: 'the example test fails naming the guide and the example' },
    },
    {
      id: 'req-readme-per-module', label: 'Every module has its README', when: { READMES: ['per-module'] }, ears_type: 'ubiquitous',
      action: 'hold a README.md in every package, module or service directory with the sections {{README_SECTIONS}}, and fail the build when a directory lacks the file or a section',
      rationale: 'The README is the page read first and most; the same sections everywhere let a newcomer run and test any module without asking who owns it (Google developer documentation style guide; Write the Docs on READMEs).',
      scenario: { label: 'Module without README fails', given: 'a new package directory added without a README.md', when: 'the build runs', then: 'the README check fails naming the directory, and passes once the file holds {{README_SECTIONS}}' },
    },
    {
      id: 'req-readme-root', label: 'Root README lists every module', when: { READMES: ['root-only'] }, ears_type: 'ubiquitous',
      action: 'hold in the root README a table with one row per module directory naming its purpose and its owner, and fail the build when a module directory has no row or a row names a directory that no longer exists',
      rationale: 'With one README, the table is the only place a newcomer learns what a directory is for and who to ask; a module missing from it is invisible (Google developer documentation style guide).',
      scenario: { label: 'Unlisted module fails', given: 'a new module directory not in the root README table', when: 'the build runs', then: 'the README check fails naming the directory' },
    },
    {
      id: 'req-links', label: 'Broken links fail the docs build', when: { DOCS_SITE: ['docs-as-code'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a page of the documentation holds a link to a page, anchor or URL that does not resolve, or the site generator reports a warning',
      action: 'fail the documentation build on the pull request, naming the page and the link, within {{LINK_CHECK_MINUTES}} minutes',
      rationale: 'A broken link is the reader\'s first sign that nobody maintains the page; a build that fails on one keeps the whole site trustworthy at the cost of one fix per pull request (Write the Docs, Docs as Code; lychee).',
      scenario: { label: 'Broken link stops the merge', given: 'a pull request that renames a page other pages link to', when: 'the documentation build runs', then: 'it fails within {{LINK_CHECK_MINUTES}} minutes naming each page with a broken link' },
    },
    {
      id: 'req-external-versioned', label: 'External docs name their release and owner', when: { DOCS_SITE: ['external'] }, ears_type: 'ubiquitous',
      action: 'link the documentation space from the repository README, and carry on every page of the space the properties release (the release it describes), owner and reviewed (the date of the last review)',
      rationale: 'Documentation outside the repository is not built with the code, so the only guard against describing a version that no longer runs is naming the release on the page, and the only guard against abandonment is an owner (Google developer documentation style guide on versioned documentation).',
      scenario: { label: 'Page names its release', given: 'the pages of the documentation space', when: 'the weekly page job reads their properties', then: 'every page has release, owner and reviewed, and the README links the space; a page without one of them fails the job' },
    },
    {
      id: 'req-doc-owner', label: 'Pages have an owner and a review date', ears_type: 'state-driven',
      precondition: 'a page of the documentation (in the docs folder, or in the external space) has no owner, no review date, or a review date older than {{MAX_DOC_AGE_DAYS}} days',
      action: 'fail the stale-page check naming the page and its owner, so that the page is re-dated after a review or removed',
      rationale: 'A page nobody owns is a page nobody updates; a review date makes "is this still true?" a question with an answer instead of a guess (Google developer documentation style guide; Write the Docs on documentation maintenance).',
      scenario: { label: 'Stale page reported', given: 'a page whose review date is {{MAX_DOC_AGE_DAYS}} days old plus one', when: 'the stale-page check runs', then: 'it fails naming the page and its owner, and passes once the page is re-dated or removed' },
    },
    {
      id: 'req-diagram-same-pr', label: 'Diagrams change with the code', when: { DIAGRAMS: ['model'] }, ears_type: 'event-driven',
      trigger: 'a pull request changes the structure of a diagrammed module (a new or removed container, component, dependency between modules, data store or external call)',
      action: 'change the model or diagram source in the same pull request, and fail the check when the source under a diagrammed module changes structure and the model folder {{MODEL_DIR}} does not change',
      rationale: 'A diagram kept as text or a model is a diff; the pull request that changes the system is the one moment the author knows what changed (Simon Brown, C4 model and diagrams as code).',
      scenario: { label: 'Structural change without diagram fails', given: 'a pull request adding a call to a new external service without touching {{MODEL_DIR}}', when: 'the diagram check runs', then: 'it fails naming the module, and passes once the model shows the new call' },
    },
    {
      id: 'req-diagram-dated', label: 'Image diagrams are dated with their source', when: { DIAGRAMS: ['images'] }, ears_type: 'ubiquitous',
      action: 'keep every diagram image in docs/diagrams with its editable source file (.drawio or .excalidraw) next to it and a caption with its date and author on the page that shows it, and fail the check on a diagram whose caption date is older than {{MAX_DOC_AGE_DAYS}} days',
      rationale: 'An image cannot be diffed, so the date tells a reader how far to trust it and the source file lets the next person change it instead of redrawing (Simon Brown, C4 model: notation and dating of diagrams).',
      scenario: { label: 'Undated diagram fails the check', given: 'a diagram image added without a source file or a dated caption', when: 'the docs check runs', then: 'it fails naming the image, and passes once the source file and a caption with date and author are present' },
    },
  ],
  adrs: [
    {
      id: 'adr-adr-repo', label: 'Decision records as files in the repository', when: { DECISIONS: ['adr-repo'] },
      decision: 'Every architecturally significant decision is one Markdown file in {{ADR_DIR}}, numbered and named NNNN-title.md, copied from the template in the same directory in the MADR format: YAML front matter with status, date and decision-makers (and superseded-by on a superseded record), then the sections Context and Problem Statement, Considered Options, Decision Outcome and Consequences. A record leaves status proposed within {{ADR_DAYS}} days. The record is changed in the pull request of the first code that implements it, reviewed by the same reviewers; a superseding record sets the old one\'s status to superseded with a link, and old records are never rewritten. A test over the front matter runs in CI. API reference: {{API_DOCS}}. READMEs: {{READMES}}. Documentation: {{DOCS_SITE}}. Diagrams: {{DIAGRAMS}}.',
      consequences: '• Decisions are versioned, reviewed and searched like code, and travel with the repository when it is forked or archived.\n• Readers who do not open the repository (product, operations, auditors) need a published copy: the docs site renders the folder.\n• The template guarantees fields, not quality: a record with a one-line context passes the test and still explains nothing; reviewers have to read it.\n• Decisions spanning several repositories live in one of them or in a shared one, and the others link to it.',
      alternatives: '1. Decisions in an architecture model next to the code: links each decision to the elements it constrains and lets CI check them together, but needs the model to exist and be kept.\n2. A decision log in a wiki: reaches readers outside the repository, but no review with the code and only a scheduled job checks it.\n3. Decisions in commit messages or pull request descriptions: already written, but unsearchable by topic, and commit messages are folded when the branch is squashed.',
    },
    {
      id: 'adr-model', label: 'Decisions in the architecture model next to the code', when: { DECISIONS: ['model'] },
      decision: 'Decisions are elements of the architecture model kept in {{MODEL_DIR}} in the repository: with radical.tools, ADR nodes in the Markdown folder with status, date, context, decision, consequences and alternatives, linked with constrains to the containers and components they bind, with derives to the requirements behind them and with implements from the fitness functions that enforce them; `radical check {{MODEL_DIR}}` runs in CI with the rules adr-incomplete and concern-unbound raised to errors in check.json, and a script fails a decision left proposed for more than {{ADR_DAYS}} days. With Structurizr, ADRs in the workspace\'s decisions folder shown in its ADR view, validated by the CLI. A decision is changed in the same pull request as the first code that implements it; a superseding decision links the old one (radical check reports a superseded decision nothing supersedes) and leaves it in place. API reference: {{API_DOCS}}. READMEs: {{READMES}}. Documentation: {{DOCS_SITE}}. Diagrams: {{DIAGRAMS}}.',
      consequences: '• A reader of an element reaches its decisions, requirements and checks from the element, and a decision without a subject is an error, not a forgotten file.\n• The model has to be kept: a team that stops updating it has stale decisions and stale diagrams at once.\n• The model folder is reviewable as text, but the tool is one more thing to install for reading and editing (CLI, Studio or an editor for the DSL).\n• Decisions are published as part of the model, not as a page on their own; readers outside the repository need the rendered site or a viewer.',
      alternatives: '1. Decision records as plain files in {{ADR_DIR}}: no tool to learn, but the link from a decision to what it constrains is prose and nothing checks it.\n2. A decision log in a wiki: reaches readers outside the repository, but no review with the code and only a scheduled job checks it.\n3. Decisions both in the model and in a wiki: two copies drift; keep one and link to it.',
    },
    {
      id: 'adr-wiki', label: 'A decision log in a wiki or document space', when: { DECISIONS: ['wiki'] },
      context: `${FORCES} Here most readers never open the repository: decisions have to be found, read and commented on in the space where those readers already work.`,
      decision: 'Decisions are pages in the team\'s space (Confluence with the Decision template, or a Notion database with the same fields), labelled decision, with the content properties status (proposed, accepted, superseded) and date and, on a superseded page, superseded-by: title, decision-makers, context, decision, consequences, options considered. One decision log index page per system links every decision page; the repository README links the index. A page leaves proposed within {{ADR_DAYS}} days; superseding sets the old page\'s status and the superseded-by property, and old pages are not edited. A weekly job over the space\'s REST API fails on a page missing a property, a page left proposed too long, and a decision not linked from the index. API reference: {{API_DOCS}}. READMEs: {{READMES}}. Documentation: {{DOCS_SITE}}. Diagrams: {{DIAGRAMS}}.',
      consequences: '• Product, operations and an architecture board read and comment where they already are, with the space\'s search and notifications.\n• The decision is not reviewed with the code: the reviewer of the pull request has to open the page, and a code change that contradicts a decision is caught by people, not by a check.\n• The space is outside version control: history is the page history, and an export is needed when the space is moved or shut.\n• Links from code to pages break when pages move; the job catches missing pages, not moved ones.',
      alternatives: '1. Decision records as files in {{ADR_DIR}}: reviewed with the code and versioned, but invisible to readers who do not open repositories unless published.\n2. Decisions in an architecture model next to the code: connected and checked, but the furthest from readers who live in the wiki.\n3. Files in the repository published to the wiki by a job: one source and both audiences, at the cost of a job to keep and comments that land on the copy.',
    },
  ],
  fitness: [
    {
      id: 'ff-adr-lint', label: 'Decision records are well-formed', when: { DECISIONS: ['adr-repo'] }, category: 'structural', implements: ['adr-adr-repo'],
      checks: ['req-adr-recorded', 'req-adr-supersede'],
      threshold: 'Every file in {{ADR_DIR}} has a status from the list, a date and the Context, Decision Outcome and Consequences sections; every superseded record names an existing record in superseded-by; 0 records in status proposed older than {{ADR_DAYS}} days',
      description: 'A test reads the front matter and the headings of every record in {{ADR_DIR}}, checks the required fields and sections and that each superseded-by link points at an existing record, and fails on a record left in proposed past the deadline. An unquoted date in YAML front matter is parsed by gray-matter as a Date object, so the test normalises it before matching. The same test in Python is a pytest over python-frontmatter.',
      tool: 'Vitest with gray-matter (a test over the ADR folder); pytest with python-frontmatter for Python',
      language: 'ts',
      snippet: `import { readdirSync, readFileSync } from 'node:fs'
import matter from 'gray-matter'
import { expect, it } from 'vitest'

const DIR = '{{ADR_DIR}}'
const DAYS = {{ADR_DAYS}}
const SECTIONS = ['## Context', '## Decision Outcome', '## Consequences']
const files = readdirSync(DIR).filter((f) => /^\\d{4}-.+\\.md$/.test(f))
// gray-matter turns an unquoted "date: 2026-10-01" into a Date; keep YYYY-MM-DD either way
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''))

it.each(files)('%s is a well-formed decision record', (file) => {
  const { data, content } = matter(readFileSync(\`\${DIR}/\${file}\`, 'utf8'))
  expect(['proposed', 'accepted', 'rejected', 'superseded', 'deprecated'], \`\${file}: status\`).toContain(data.status)
  expect(iso(data.date), \`\${file}: date\`).toMatch(/^\\d{4}-\\d{2}-\\d{2}$/)
  for (const s of SECTIONS) expect(content, \`\${file} lacks "\${s}"\`).toContain(s)
  if (data.status === 'superseded') expect(files, \`\${file}: superseded-by\`).toContain(String(data['superseded-by']))
  if (data.status === 'proposed') expect((Date.now() - Date.parse(iso(data.date))) / 86_400_000, \`\${file} is proposed too long\`).toBeLessThanOrEqual(DAYS)
})`,
    },
    {
      id: 'ff-radical-check', label: 'Architecture model checked in CI', when: { DECISIONS: ['model'] }, category: 'structural', implements: ['adr-model'],
      checks: ['req-adr-recorded', 'req-adr-supersede', 'req-adr-linked'],
      threshold: '`radical check {{MODEL_DIR}}` reports 0 errors on every pull request with adr-incomplete, adr-superseded-unlinked and concern-unbound raised to errors in check.json; 0 decisions in status proposed older than {{ADR_DAYS}} days',
      description: 'The CI job runs the model check against the test reports of the same run: an accepted decision without date, context, decision or consequences (adr-incomplete), a superseded decision nothing supersedes (adr-superseded-unlinked), a decision marked with a concern that constrains no element (concern-unbound), and a fitness function naming a test that did not run each fail the pull request once check.json sets those rules to error. A second step reads the decision files of the Markdown folder and fails one left proposed past {{ADR_DAYS}} days. With Structurizr, the CLI\'s validate command on the workspace plays the role of the model check.',
      tool: 'radical CLI in GitHub Actions',
      language: 'yaml',
      snippet: `# .github/workflows/architecture.yml
name: architecture model
on: [pull_request, push]
jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4.2.2        # pin by commit SHA in your repository
      - uses: actions/setup-node@v4.1.0      # pin by commit SHA in your repository
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm test -- --reporter=junit --outputFile=reports/junit.xml
      # check.json in the model folder: "rules": { "adr-incomplete": "error", "adr-superseded-unlinked": "error", "concern-unbound": "error" }
      - run: npx radical check {{MODEL_DIR}} --report reports
      - name: no decision left proposed for more than {{ADR_DAYS}} days
        run: |
          limit=$(date -u -d '{{ADR_DAYS}} days ago' +%F)
          stale=$(grep -rlE '^status: *"?proposed"?' {{MODEL_DIR}}/nodes --include='*.md' | while read -r f; do   # the folder quotes its values
            d=$(grep -m1 -oE '^date: *"?[0-9]{4}-[0-9]{2}-[0-9]{2}' "$f" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
            if [ -n "$d" ] && [ "$d" \\< "$limit" ]; then echo "$f (proposed since $d)"; fi; done)
          [ -z "$stale" ] || { echo "decisions proposed for more than {{ADR_DAYS}} days:"; echo "$stale"; exit 1; }`,
    },
    {
      id: 'ff-wiki-log', label: 'Decision log complete in the wiki', when: { DECISIONS: ['wiki'] }, category: 'process', implements: ['adr-wiki'],
      checks: ['req-adr-recorded', 'req-adr-supersede', 'req-adr-wiki-index'],
      threshold: '0 decision pages without a status and a date property; 0 superseded pages without a superseded-by property; 0 pages in status proposed older than {{ADR_DAYS}} days; 0 decision pages not linked from the index page; the README links the space',
      description: 'A weekly job lists the pages labelled decision in the space through the Confluence REST API with their content properties (expand=metadata.properties), fails on a page missing a status or date, a superseded page without superseded-by, or a page left proposed past the deadline, then reads the index page\'s storage body and fails on a decision page it does not link (Confluence stores a page link as ri:content-title="<title>"). The job fails on the first gap; what it prints is the list to fix.',
      tool: 'Confluence REST API with curl and jq (scheduled job on a GNU/Linux runner, for date -d)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# weekly: decision pages with their status, date and superseded-by properties
set -euo pipefail
SPACE=ARCH; INDEX_PAGE_ID=123456789; DAYS={{ADR_DAYS}}
auth=(-u "$CONFLUENCE_USER:$CONFLUENCE_TOKEN")
curl -sf "\${auth[@]}" "$CONFLUENCE_URL/wiki/rest/api/content/search?cql=space=$SPACE+and+label=decision&expand=metadata.properties&limit=200" \\
  | jq -r '.results[] | [.id, .title, (.metadata.properties.status.value // "MISSING"), (.metadata.properties.date.value // "MISSING"), (.metadata.properties["superseded-by"].value // "")] | @tsv' > decisions.tsv
limit=$(date -u -d "$DAYS days ago" +%F); bad=0
while IFS=$'\\t' read -r id title status date by; do
  if [ "$status" = MISSING ] || [ "$date" = MISSING ]; then echo "no status or date: $title"; bad=1; fi
  if [ "$status" = superseded ] && [ -z "$by" ]; then echo "superseded without superseded-by: $title"; bad=1; fi
  if [ "$status" = proposed ] && [ "$date" \\< "$limit" ]; then echo "proposed since $date: $title"; bad=1; fi
done < decisions.tsv
# every decision page is linked from the index page, and the README links the space
index=$(curl -sf "\${auth[@]}" "$CONFLUENCE_URL/wiki/rest/api/content/$INDEX_PAGE_ID?expand=body.storage" | jq -r .body.storage.value)
while IFS=$'\\t' read -r id title rest; do
  grep -qF "ri:content-title=\\"$title\\"" <<< "$index" || { echo "not on the index: $title"; bad=1; }
done < decisions.tsv
grep -qF "$CONFLUENCE_URL/wiki/spaces/$SPACE" README.md || { echo "README does not link the decision space"; bad=1; }
exit $bad`,
    },
    {
      id: 'ff-readme-sections', label: 'Every module has its README sections', when: { READMES: ['per-module'] }, category: 'structural', implements: DECISIONS,
      checks: ['req-readme-per-module'],
      threshold: 'Every workspace or module directory holds README.md with the headings {{README_SECTIONS}}; 0 directories without',
      description: 'A test lists the module directories from the workspace configuration (package.json workspaces, or the services folder), not from a list kept by hand, and expects a README.md with every required heading in each; a new module fails the test until it has one. The same test in Python walks the packages with pathlib under pytest.',
      tool: 'Vitest (a test over the workspaces); pytest with pathlib for Python',
      language: 'ts',
      snippet: `import { existsSync, globSync, readFileSync } from 'node:fs'   // globSync: Node 22 or later (tinyglobby before that)
import { expect, it } from 'vitest'

const SECTIONS = '{{README_SECTIONS}}'.split(/,\\s*/)
const workspaces: string[] = JSON.parse(readFileSync('package.json', 'utf8')).workspaces
const dirs = workspaces.flatMap((w) => globSync(w))

it.each(dirs)('%s has a README with the required sections', (dir) => {
  const file = \`\${dir}/README.md\`
  expect(existsSync(file), \`\${file} is missing\`).toBe(true)
  const headings = readFileSync(file, 'utf8').match(/^#{1,3} .+$/gm) ?? []
  for (const s of SECTIONS) expect(headings.some((h) => h.toLowerCase().includes(s.toLowerCase())), \`\${file} lacks "\${s}"\`).toBe(true)
})`,
    },
    {
      id: 'ff-readme-table', label: 'Root README lists every module', when: { READMES: ['root-only'] }, category: 'structural', implements: DECISIONS,
      checks: ['req-readme-root'],
      threshold: 'Every module directory under src has a row in the root README\'s module table with purpose and owner; 0 rows naming a directory that no longer exists',
      description: 'A test reads the module table of the root README (one row per directory: | `src/name` | purpose | owner |) and compares it with the module directories of the repository both ways: a directory without a row and a row without a directory each fail it.',
      tool: 'Vitest (a test over README.md); pytest with pathlib for Python',
      language: 'ts',
      snippet: `import { readdirSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const readme = readFileSync('README.md', 'utf8')
const rows = [...readme.matchAll(/^\\| \`?(src\\/[\\w-]+)\`? \\| (.+?) \\| (.+?) \\|$/gm)]   // | dir | purpose | owner |
const listed = new Map(rows.map((r) => [r[1], { purpose: r[2].trim(), owner: r[3].trim() }]))
const dirs = readdirSync('src', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => \`src/\${d.name}\`)

it('every module is in the table, with purpose and owner', () => {
  expect(dirs.filter((d) => !listed.has(d))).toEqual([])
  for (const [dir, row] of listed) expect(row.purpose && row.owner, \`\${dir} lacks purpose or owner\`).toBeTruthy()
})
it('no row names a module that is gone', () => {
  expect([...listed.keys()].filter((d) => !dirs.includes(d))).toEqual([])
})`,
    },
    {
      id: 'ff-doc-comments', label: 'Doc comments on the exported symbols', category: 'structural', implements: DECISIONS,
      checks: ['req-doc-comments'],
      threshold: 'At least {{DOC_COMMENT_COVERAGE_PCT}}% of the exported functions, classes, interfaces, type aliases and variables under src carry a doc comment; the test lists the ones that do not',
      description: 'A test opens the TypeScript program from tsconfig.json, walks the exported declarations of every file under src, counts the ones with a JSDoc comment and fails below the threshold, printing the undocumented symbols with their file. For Python, interrogate measures docstring coverage of the public API and fails under the same number; for Java, the javadoc doclint run of the build reports undocumented public members. Where the Code quality gate decision enforces a linter, eslint-plugin-jsdoc\'s require-jsdoc rule also refuses a new export without a comment on the changed lines.',
      tool: 'Vitest with the TypeScript compiler API; interrogate for Python; javadoc -Xdoclint for Java',
      language: 'ts',
      snippet: `// test/doc-comments.test.ts
import ts from 'typescript'
import { expect, it } from 'vitest'

const MIN_PCT = {{DOC_COMMENT_COVERAGE_PCT}}
const { config } = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
const { fileNames, options } = ts.parseJsonConfigFileContent(config, ts.sys, '.')
const program = ts.createProgram(fileNames.filter((f) => f.startsWith('src/') || f.includes('/src/')), options)
const checker = program.getTypeChecker()

it(\`at least \${MIN_PCT}% of the exported symbols carry a doc comment\`, () => {
  const missing: string[] = []
  let total = 0
  for (const file of program.getSourceFiles()) {
    if (file.isDeclarationFile || !program.getRootFileNames().includes(file.fileName)) continue
    const module = checker.getSymbolAtLocation(file)
    for (const symbol of module ? checker.getExportsOfModule(module) : []) {
      const decl = symbol.declarations?.[0]
      if (!decl) continue
      total++
      if (!ts.getJSDocCommentsAndTags(decl).length) missing.push(\`\${file.fileName}: \${symbol.name}\`)
    }
  }
  const pct = total ? ((total - missing.length) * 100) / total : 100
  expect(pct, \`\${pct.toFixed(1)}% documented; without a comment:\\n\${missing.join('\\n')}\`).toBeGreaterThanOrEqual(MIN_PCT)
})
// Python: interrogate --fail-under {{DOC_COMMENT_COVERAGE_PCT}} src`,
    },
    {
      id: 'ff-reference-build', label: 'API reference builds without warnings', when: { API_DOCS: ['reference'] }, category: 'process', implements: DECISIONS,
      checks: ['req-reference-built'],
      threshold: 'The reference builds on every pull request with 0 warnings (an unresolved link or an undocumented export is a warning) and is published with each release under its version',
      description: 'TypeDoc runs with warnings treated as errors, so a broken {@link} or an export without a comment fails the pull request; Sphinx does the same with `sphinx-build -W --keep-going`. The release job runs the same command and publishes the output under the release version (includeVersion puts it in the site). The file is typedoc.json; package.json holds the script "docs:api": "typedoc", which CI runs on every pull request and the release job runs to publish docs/api. Python: sphinx-build -W --keep-going -b html docs docs/_build.',
      tool: 'TypeDoc; Sphinx for Python',
      language: 'json',
      snippet: `{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": ["src/index.ts"],
  "out": "docs/api",
  "treatWarningsAsErrors": true,
  "validation": { "notExported": true, "invalidLink": true, "notDocumented": true },
  "requiredToBeDocumented": ["Function", "Class", "Interface", "TypeAlias", "Method"],
  "includeVersion": true
}`,
    },
    {
      id: 'ff-contract-drift', label: 'Contract and code agree', when: { API_DOCS: ['generated'] }, category: 'structural', implements: DECISIONS,
      checks: ['req-api-regenerated'],
      threshold: '0 differences in paths, operations, parameters, schemas or responses between the OpenAPI contract in the repository and the specification the running code serves, on every pull request',
      description: 'The pipeline starts the element, fetches the specification it generates from its routes and compares it with the contract file in the repository with oasdiff; any difference outside descriptions, examples and titles fails the build, so the contract, the reference rendered from it and the code cannot drift apart. Whether a difference may be released at all is the API evolution concern\'s decision; this check only keeps the documentation true.',
      tool: 'oasdiff',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI step: the contract in the repository is what the code serves
set -euo pipefail
npm start & PID=$!
until curl -sf http://localhost:3000/openapi.json > generated.json; do sleep 1; done
kill $PID
# any difference in paths, parameters, schemas or responses fails
oasdiff diff openapi.yaml generated.json --fail-on-diff --exclude-elements description,examples,title
# and a breaking change is reported on its own for the API evolution review
oasdiff breaking openapi.yaml generated.json --fail-on ERR`,
    },
    {
      id: 'ff-doctest', label: 'Examples in the guide run', when: { API_DOCS: ['written'] }, category: 'process', implements: DECISIONS,
      checks: ['req-examples-run'],
      threshold: 'Every code example in the API guide is executed on each pull request; 0 examples throwing, and for Python 0 examples whose output differs from the guide',
      description: 'markdown-doctest executes every fenced js and es6 block of the guide with the package imported and fails on an exception; it does not compare output, so an example states what it expects with assert. For Python, `pytest --doctest-modules --doctest-glob="docs/*.md"` runs the doctests in docstrings and Markdown and does compare the output. Examples that need a server run against a test instance started by the job; an example that cannot run is marked <!-- skip-example --> and reviewed as such.',
      tool: 'markdown-doctest; pytest --doctest-modules for Python',
      language: 'js',
      snippet: `// .markdown-doctest-setup.js
const assert = require('node:assert')
const sdk = require('./dist')
module.exports = {
  require: { '@shop/sdk': sdk, assert },                        // what the examples import
  globals: { client: sdk.createClient({ baseUrl: process.env.API_URL }) },
  regexRequire: { '^@shop/sdk/(.+)$': (m, sub) => require(\`./dist/\${sub}\`) },
}
// package.json: "test:docs": "markdown-doctest docs/api/*.md README.md"
// an example that states its result:  const order = await client.orders.get('o-1'); assert.equal(order.status, 'paid')
// Python: pytest --doctest-modules --doctest-glob="docs/*.md" src docs`,
    },
    {
      id: 'ff-docs-build', label: 'Docs build strictly with links checked', when: { DOCS_SITE: ['docs-as-code'] }, category: 'process', implements: DECISIONS,
      checks: ['req-links'],
      threshold: 'The documentation builds in strict mode with 0 warnings and lychee finds 0 broken links or anchors, within {{LINK_CHECK_MINUTES}} minutes, on every pull request',
      description: 'The docs job builds the site with warnings as errors (`mkdocs build --strict`, or Docusaurus with onBrokenLinks: "throw") and runs lychee over the Markdown and the built HTML with fragments checked; the job has a timeout of {{LINK_CHECK_MINUTES}} minutes and is a required check.',
      tool: 'MkDocs (--strict) with lychee in GitHub Actions',
      language: 'yaml',
      snippet: `# .github/workflows/docs.yml
name: docs
on: [pull_request]
jobs:
  docs:
    runs-on: ubuntu-latest
    timeout-minutes: {{LINK_CHECK_MINUTES}}
    steps:
      - uses: actions/checkout@v4.2.2          # pin by commit SHA in your repository
      - uses: actions/setup-python@v5.3.0      # pin by commit SHA in your repository
        with: { python-version: '3.12' }
      - run: pip install mkdocs-material && mkdocs build --strict   # Docusaurus: onBrokenLinks: 'throw'
      - uses: lycheeverse/lychee-action@v2.0.2  # pin by commit SHA in your repository
        with:
          args: --no-progress --include-fragments --exclude-path site/assets 'docs/**/*.md' 'site/**/*.html'
          fail: true`,
    },
    {
      id: 'ff-stale-pages', label: 'No page without owner or past review', when: { DOCS_SITE: ['docs-as-code'] }, category: 'process', implements: DECISIONS,
      checks: ['req-doc-owner'],
      threshold: 'Every page under docs has owner and reviewed in its front matter; 0 pages with a reviewed date older than {{MAX_DOC_AGE_DAYS}} days',
      description: 'A test over the docs folder reads each page\'s front matter and fails on a page without an owner or review date, or with a review date older than {{MAX_DOC_AGE_DAYS}} days, naming the page and its owner. An unquoted date is parsed by gray-matter as a Date object, so the test normalises it before matching. Run on every pull request and weekly on the main branch, so a page goes stale on a schedule, not unnoticed.',
      tool: 'Vitest with gray-matter (a test over the docs folder); pytest with python-frontmatter for Python',
      language: 'ts',
      snippet: `import { globSync, readFileSync } from 'node:fs'   // globSync: Node 22 or later (tinyglobby before that)
import matter from 'gray-matter'
import { expect, it } from 'vitest'

const MAX_DAYS = {{MAX_DOC_AGE_DAYS}}
const pages = globSync('docs/**/*.md')
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''))

it.each(pages)('%s has an owner and a recent review date', (page) => {
  const { data } = matter(readFileSync(page, 'utf8'))   // --- owner: team-orders  reviewed: 2026-10-01 ---
  expect(data.owner, \`\${page} has no owner\`).toBeTruthy()
  const reviewed = iso(data.reviewed)
  expect(reviewed, \`\${page} has no review date\`).toMatch(/^\\d{4}-\\d{2}-\\d{2}$/)
  expect((Date.now() - Date.parse(reviewed)) / 86_400_000, \`\${page} (owner \${data.owner}) was last reviewed on \${reviewed}\`).toBeLessThanOrEqual(MAX_DAYS)
})`,
    },
    {
      id: 'ff-external-pages', label: 'External pages name release, owner and review date', when: { DOCS_SITE: ['external'] }, category: 'process', implements: DECISIONS,
      checks: ['req-external-versioned', 'req-doc-owner'],
      threshold: 'Every page of the documentation space has the content properties release, owner and reviewed; 0 pages with reviewed older than {{MAX_DOC_AGE_DAYS}} days; the README links the space',
      description: 'A weekly job lists the pages of the documentation space through the Confluence REST API with their content properties (expand=metadata.properties) and fails on a page without release, owner or reviewed, or reviewed older than {{MAX_DOC_AGE_DAYS}} days, naming the page and its owner; it also fails when the README does not link the space. Notion and GitBook have the same shape through their APIs (database properties, page metadata).',
      tool: 'Confluence REST API with curl and jq (scheduled job on a GNU/Linux runner, for date -d)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# weekly: every documentation page names its release, owner and review date
set -euo pipefail
SPACE=DOCS; MAX_DAYS={{MAX_DOC_AGE_DAYS}}
limit=$(date -u -d "$MAX_DAYS days ago" +%F); bad=0
while IFS=$'\\t' read -r title release owner reviewed; do
  if [ "$release" = MISSING ] || [ "$owner" = MISSING ] || [ "$reviewed" = MISSING ]; then echo "missing release, owner or reviewed: $title"; bad=1; fi
  if [ "$reviewed" != MISSING ] && [ "$reviewed" \\< "$limit" ]; then echo "stale since $reviewed (owner $owner): $title"; bad=1; fi
done < <(curl -sf -u "$CONFLUENCE_USER:$CONFLUENCE_TOKEN" \\
  "$CONFLUENCE_URL/wiki/rest/api/content/search?cql=space=$SPACE+and+type=page&expand=metadata.properties&limit=200" \\
  | jq -r '.results[] | [.title, (.metadata.properties.release.value // "MISSING"), (.metadata.properties.owner.value // "MISSING"), (.metadata.properties.reviewed.value // "MISSING")] | @tsv')
grep -qF "$CONFLUENCE_URL/wiki/spaces/$SPACE" README.md || { echo "README does not link the documentation space"; bad=1; }
exit $bad`,
    },
    {
      id: 'ff-diagram-drift', label: 'Structural change touches the model', when: { DIAGRAMS: ['model'] }, category: 'process', implements: DECISIONS,
      checks: ['req-diagram-same-pr'],
      threshold: '0 pull requests that add or remove a dependency, service client or data store under a diagrammed module without a change in {{MODEL_DIR}}',
      description: 'A CI step lists the files a pull request changes; when a dependency manifest, a client of another service or a data-store configuration under a diagrammed module changed and nothing under {{MODEL_DIR}} did, the step fails with the list, and the author either updates the model or explains in the pull request why the structure did not change. With Structurizr or PlantUML the diagram source folder takes the model folder\'s place. The checkout needs the base branch (fetch-depth: 0, as the quality gate\'s job does) for merge-base.',
      tool: 'git diff --name-only (CI script)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI: a change to the structure of a diagrammed module changes the model too (checkout with fetch-depth: 0)
set -euo pipefail
MODEL='{{MODEL_DIR}}'
BASE=$(git merge-base "origin/\${GITHUB_BASE_REF:-main}" HEAD)
changed=$(git diff --name-only "$BASE"...HEAD)
# files that change the structure: dependency manifests, service clients, data-store config
structural=$(grep -E '^(apps|packages|services)/[^/]+/(package\\.json|pom\\.xml|go\\.mod|requirements\\.txt|src/(clients|adapters|infra)/.*|src/.*(Client|Repository|Gateway)\\.[a-z]+)$' <<< "$changed" || true)
if [ -n "$structural" ] && ! grep -q "^$MODEL/" <<< "$changed"; then
  echo "These files change the structure of a diagrammed module, but $MODEL/ did not change:"; echo "$structural"
  echo "Update the model in this pull request (radical check lists what is missing) or explain why the structure is the same."
  exit 1
fi`,
    },
    {
      id: 'ff-diagram-images', label: 'Image diagrams have a source and a dated caption', when: { DIAGRAMS: ['images'] }, category: 'structural', implements: DECISIONS,
      checks: ['req-diagram-dated'],
      threshold: 'Every image under docs/diagrams has a sibling .drawio or .excalidraw file and a caption "Drawn YYYY-MM-DD by <author>" on the line after the page that embeds it; 0 captions older than {{MAX_DOC_AGE_DAYS}} days',
      description: 'A test lists the images under docs/diagrams, expects the editable source next to each, finds the Markdown page that embeds the image and reads the caption on the line after the embed (*Drawn 2026-10-01 by A. Nowak*), and fails on a missing source, a missing or malformed caption, or a date older than {{MAX_DOC_AGE_DAYS}} days.',
      tool: 'Vitest (a test over docs/diagrams); pytest with pathlib for Python',
      language: 'ts',
      snippet: `import { existsSync, globSync, readFileSync } from 'node:fs'   // globSync: Node 22 or later (tinyglobby before that)
import { basename } from 'node:path'
import { expect, it } from 'vitest'

const MAX_DAYS = {{MAX_DOC_AGE_DAYS}}
const images = globSync('docs/diagrams/*.{png,svg}')
const pages = globSync('docs/**/*.md').map((p) => readFileSync(p, 'utf8').split('\\n'))
const CAPTION = /^\\*?(Drawn|Updated) (\\d{4}-\\d{2}-\\d{2}) by .+/

it.each(images)('%s has an editable source and a dated caption', (image) => {
  const stem = image.replace(/\\.(png|svg)$/, '')
  expect(existsSync(\`\${stem}.drawio\`) || existsSync(\`\${stem}.excalidraw\`), \`\${image} has no .drawio or .excalidraw next to it\`).toBe(true)
  const caption = pages.flatMap((lines) => lines.flatMap((l, i) => (l.includes(\`](\`) && l.includes(basename(image)) ? [lines[i + 1] ?? ''] : [])))
    .map((l) => l.match(CAPTION)).find(Boolean)
  expect(caption, \`\${image}: no page embeds it with a caption "Drawn YYYY-MM-DD by <author>" on the next line\`).toBeTruthy()
  expect((Date.now() - Date.parse(caption![2])) / 86_400_000, \`\${image} was drawn on \${caption![2]}: review or remove it\`).toBeLessThanOrEqual(MAX_DAYS)
})`,
    },
  ],
}

export default pack
