// ─── Radical Assay over MCP ──────────────────────────────────────────────────
// Finds the model in existing code (ADR Radical Assay). The server is bound
// to the central model's folder; the code repositories are local directories
// the user names. assay_start reads and links their facts (@radical/assay)
// and writes each repository's .radical/assay/facts.json. The agent then
// hands the server plans: assay_apply checks a plan against the facts, writes
// its observed and inferred elements and relations with the model tools (so
// the metamodel's rules hold), maps them in each code repository's
// .radical/radical.json and keeps their evidence in the central repository's
// .radical/assay/run.json, never in the model. Requirements are hypotheses:
// each comes back as a proposal, with the scenarios that verify it from the
// tests, and is written only when the user accepts it (assay_answer). Sources
// of documents (folders, .zip files, public links) are kept as text in the
// central repository's .radical/assay/sources/; the needs and decisions the
// agent draws from them are proposals too. Entities, processes and state
// machines are written as they are applied: entities observed on their
// tables, processes and state machines inferred (ADR Assay writes the
// domain, processes and lifecycles it reads); a scenario drawn from code
// gets a pending test where its unit has a test framework. assay_read gives
// the agent the lines of any file of the run, so an agent with no files of
// its own cites.
//
// One run per server; assay_start begins a new one. The run lives in memory;
// what it wrote stays in the model and the files.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative } from 'node:path'
import {
  FACTS_FILE, FACT_LISTS, FOLDER_FACTS_DIR, SOURCES_DIR, UNPACKED_DIR, checkPlan, prepareSyntax, cleanPath, decodeText, factsFileOf, describeFacts, describeSources, extractRepository, factIndex, ignored, inside,
  GIT, isRepository, linkRepositories, parsePlan, SKIPPED, within, repositoriesIn, serializeFacts, sourceOrigin, takeSources,
  accessReaderOf, emptyFacts, formWireframe, pageOf, pathTest, pathTestFile, pathTestId, stateName, stepLabel, tableName, testSkeleton, testUnitFor,
  type Citation, type FactIndex, type Link, type PathFact, type Skeleton, type PlanDecision, type PlanNeed, type Plan, type PlanRequirement, type PlanStep, type RepositoryFacts, type RoutineFact, type ScreenFact, type StateFact, type TableFact, type TestFact, type Unit,
} from '@radical/assay'
import MDBReader from 'mdb-reader'
import { Explorer, type ExploreAction } from './explore'
import { runTool, type ToolDef, type ToolResult, type ToolRunContext } from '@radical/common/ai/tools'
import type { ModelFacade } from '@radical/common/ai/modelFacade'
import { REPOSITORY_FILE, parseRepositoryFile, serializeRepositoryFile, type RepositoryFile } from '@radical/common/repositoryMapping'

/** Stored routines with each package's members folded into the package's row: a member by its id, name in the
 *  package, kind and line (with its file where the package's is another), and the tables and routines it uses. */
function foldPackages(routines: RoutineFact[]): Array<RoutineFact | (RoutineFact & { members: unknown[] })> {
  const packages = new Map(routines.filter((r) => r.kind === 'package').map((r) => [`${r.unit ?? ''}|${r.name}`, { ...r, members: [] as unknown[] }]))
  const out: Array<RoutineFact | (RoutineFact & { members: unknown[] })> = []
  for (const r of routines) {
    if (r.kind === 'package') { out.push(packages.get(`${r.unit ?? ''}|${r.name}`)!); continue }
    const pkg = r.name.includes('.') ? packages.get(`${r.unit ?? ''}|${r.name.split('.')[0]}`) : undefined
    if (!pkg) { out.push(r); continue }
    pkg.members.push({ id: r.id, name: r.name.split('.').slice(1).join('.'), kind: r.kind, line: r.evidence.file === pkg.evidence.file ? r.evidence.line : `${r.evidence.file}:${r.evidence.line}`, ...(r.reads?.length ? { reads: r.reads } : {}), ...(r.writes?.length ? { writes: r.writes } : {}), ...(r.calls?.length ? { calls: r.calls } : {}) })
  }
  return out
}

/** Reads the Access files of the code: their tables, columns and relationships. */
const ACCESS = accessReaderOf(MDBReader)

/** The evidence of what a run wrote, from the central repository's root. */
export const RUN_FILE = '.radical/assay/run.json'
const RUN_FORMAT = 'radical-assay-run/1'

const posix = (path: string): string => path.split('\\').join('/')

/** The address of the central model's repository others clone it from: its origin remote, or none. */
function centralAddress(root: string): string | undefined {
  try {
    return execFileSync('git', [...GIT, 'remote', 'get-url', 'origin'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || undefined
  } catch {
    return undefined
  }
}

/** Links of loopback, link-local and private addresses are fetched only when the server runs with RADICAL_ASSAY_PRIVATE_LINKS=1. */
const SOURCE_OPTIONS = { get allowPrivate() { return process.env.RADICAL_ASSAY_PRIVATE_LINKS === '1' } }

/** The longest answer of assay_start and the size of a page of assay_facts, in characters: an agent's client keeps a
 *  longer tool answer out of its view. */
const START_MAX = 18_000
const PAGE_MAX = 20_000

/** The whole flow, for assay_procedure's answer and the `assay` prompt. */
export const ASSAY_PROCEDURE = [
  'Radical Assay finds the model in existing code, new or old (npm, Maven, Gradle, Go, .NET, Python, VB6, Dockerfiles; docker-compose,',
  'Kubernetes, Aspire; OpenAPI, gRPC; connection strings, SQL and ORM classes, stored routines): C4 elements from the repositories\' units and the links',
  'between them, the needs and decisions its documents state, the domain from its tables, its processes from its entry points, the',
  'lifecycles of what it keeps from its statuses, then requirements with the scenarios that verify them from the tests or the code,',
  'and those the documents state that no test checks. This server\'s model folder is the central model; the code is in local directories',
  '(repositories already cloned, folders, .zip files), the documentation in folders, .zip files or public links.',
  '1. (Done once assay_start has answered: go on with step 2.) Ask the user for the code repositories\' directories (a directory that holds several repositories stands for each of them;',
  '   a folder of code with no .git, or a .zip file of code, is one too) and, when their test reports are not in each',
  '   repository\'s reports/, where they are. Ask also for documentation: folders, .zip files or public links (pages behind a',
  '   login: the user exports them, as PDF, HTML or Markdown, into a folder or a .zip). Then assay_start with directories and',
  '   sources; more documentation can come later with assay_add_sources.',
  '2. C4 stage. Read what assay_start lists: per repository its units (stack, app, library or tests), the services its',
  '   deployment runs (docker-compose, Kubernetes, Aspire), its databases, its groups (a .sln, a VB6 .vbg), then the links',
  '   (package and project references, http, gRPC, addresses, depends_on, data), counted by kind: assay_facts lists them (kind',
  '   links), a page at a time, and gives a repository\'s or a',
  '   unit\'s details; assay_read lists a folder\'s files and reads a file\'s lines; assay_search finds the lines that hold a text. search_model for what the central model',
  '   already holds; get_model_summary for the types it allows. Propose to the user how the units group into software',
  '   systems (a group, a deployment, a product name or the documents hint at it; one system unless the code or the',
  '   documents show more, or the user says otherwise; a system may cite the document lines that name it), and wait for',
  '   the answer. Then make one plan: a system per group; a container (a webapp for a browser front end) per app unit; per',
  '   library unit a component: inside the container that uses it, or, when several use it, inside a group of the system',
  '   (named, say, "Shared libraries"), with a relation from it to each container that bundles it labelled "bundled into"',
  '   (code built in, not a call at run time; the package link backs it either way); a database element per database fact',
  '   or database service (and, where SQL files declare tables no connection string reaches, one database, inferred,',
  '   citing those table facts), a queue per queue',
  '   service, a cache as a database; units of kind tests are no elements. Services of role observability (tracing,',
  '   metrics, logs) stay out unless the user wants them. People (person elements) only where the documents name them,',
  '   inferred, citing the lines. Relations of type interacts from the links, directed from the caller to what it calls,',
  '   labelled with what one does with the other (follow the model\'s own direction where it already has relations); a',
  '   data link\'s via names the deployed service the database runs on: the one database element stands for both, built',
  '   from the database fact and citing the service (with no via, relate to the database only); a message link (a unit',
  '   publishing on a topic, queue or message type another consumes) is a relation from the publisher to the consumer',
  '   labelled with the channel, asynchronous, beside each one\'s relation to the queue it uses. Units of stack sql (a',
  '   database\'s projects: a Sqitch project, the schemas or the PL/SQL library a repository of scripts holds) are the',
  '   database their scripts build, a database element, not a container: those of one repository installed into one',
  '   database (a library and its extras, the sample schemas of one instance) are one element built from all of them, its',
  '   description naming each; demos and examples of a library stay out unless the user wants them, as tests do. Stored',
  '   routines (assay_facts with kind "routines"): a package is a component inside the database element that holds it',
  '   (technology: its dialect, PL/SQL package; observed, citing its routine fact), its members named in its description;',
  '   procedures, functions and triggers outside a package are no elements: the database element names them in its',
  '   description (triggers with their tables), citing their facts; a routine in no unit\'s folder is the database\'s its',
  '   callers connect to. The routine links of one caller to one package\'s component, or to one database for routines',
  '   outside a package, are one relation, labelled with what it calls ("calls tic_open, tic_close and 2 more"), observed,',
  '   citing the links (a call in a string the page only shows is no call: leave it out); a routine known only from the',
  '   calls (called) is held by the database the caller connects to. A database\'s own code calls out too: its address',
  '   links (a package\'s URL) are relations from the package\'s component, or the database, to the service, and the',
  '   routine links from one package to another (its members calling the other\'s) are relations between their',
  '   components, labelled with what one calls. A database built from units of stack sql is observed: the units state',
  '   it. A deployed service of role other with no unit (a reverse proxy, a backup job) is a container built from its',
  '   service fact where it is in the requests\' path or uses a database, else it stays out. The',
  '   System context view shows systems and people only: relate each person to the system they use, and a system to',
  '   another where a link crosses them, inferred, citing those links (or, with no link, the address facts and the code',
  '   that show the call). What the documents name but no code shows (a',
  '   database, a service) is no element: tell the user, and let a decision or requirement say so. A group is inferred.',
  '   Reuse elements the model has, by id, instead of adding them again. Every element and relation cites the facts it',
  '   rests on (facts) and is observed when a',
  '   fact states it (an element: a unit, an API, a service, a database; a relation: a dependency, an observed link; a',
  '   component a dependency alone names is inferred, citing it) or inferred when concluded',
  '   (a system grouping units, an http, gRPC or address link); an element built from units lists them in units (a system',
  '   cites the units it groups in facts, not units, which map folders), and a',
  '   relation\'s links must join the units of its two ends. Code no reader covers (COBOL, Delphi, PowerBuilder, …: a',
  '   repository with 0 units, or a part of one) you read yourself: cite the code an inferred element or relation rests on',
  '   (citations: repository, file, lines and the text quoted from them, at least 8 characters, which the server checks is',
  '   there) and name the folders an element is built in (paths). Only facts back an observed claim. assay_apply it; a',
  '   refused plan comes back with every problem: fix them and apply again. Then show the user what was written, make views',
  '   of the C4 viewpoints (create_view with viewpoint "System context", "Containers", "Components") and smart_layout them.',
  '3. Explore stage, when the user has the web application running on this machine, on a test database (ask for its address',
  '   and the repository that builds it; skip the stage otherwise). assay_explore opens it and starts a path named for what a',
  '   user does; assay_explore_act clicks, fills, selects, checks, presses or goes to an address, by the references of the',
  '   screen it returns. Take the paths a user takes: signing in, the main lists and details, creating and changing what the',
  '   application keeps; one path per task, starting each with assay_explore. Where a path shows its outcome (an order\'s',
  '   status, a message), expect that text (assay_explore_act expect): the path\'s test checks it, not only where it went.',
  '   Each path starts signed out in a fresh session, as its test will: a path behind the sign-in signs in first. Fill forms with plausible test data. Another',
  '   host and controls that pay or delete an account are refused: leave them. Then one plan: a mockup per page that',
  '   matters (a page is a route with its numbers as {id}: /orders/1 and /orders/2 are one page; mockups: label as a user',
  '   would call it, screen: one of its screens, description from the screen\'s text, presentedBy the webapp that renders',
  '   it, parent its system); the server joins the pages in the order of each path with navigates-to. People the sign-in',
  '   screens show are person elements, inferred, citing those screens (facts). Make a view of the mockups (create_view;',
  '   the viewpoint for screens where the metamodel has one). A defect the application shows (a password in its address,',
  '   an error page) is an unwanted-behaviour requirement nothing satisfies yet, citing the screen, for the next stage.',
  '   A desktop VB6 application needs no running: its forms are screens already (assay_facts with kind "screens": caption,',
  '   controls with their roles and captions, the forms its code opens and from which control). One plan of mockups for the',
  '   forms a user works with (splash, about and message boxes left out): label as a user would call it, screen: the form\'s',
  '   screen fact, description of what the user does there, presentedBy the container, parent its system; the server draws',
  '   each wireframe from the form and joins the mockups where one form\'s code opens another (navigates-to).',
  '4. Documents stage, when the run has documents (the sources\' and the repositories\' own: README, docs, ADR records;',
  '   assay_facts with kind "documents"). Read them with assay_read and draw from them, citing the lines (citations): needs',
  '   (what people asked for, in their words: one need per thing asked for, a sentence or a short passage, with label,',
  '   description, properties.kind, parent the system it concerns) and decisions (ADRs: decisions, with properties',
  '   context, decision, consequences, alternatives; status accepted when the document records the decision as made,',
  '   proposed when it only weighs it or you cannot tell, and then ask the user which it is; constrains: the C4 elements it',
  '   applies to). A document says what someone meant, not what the code does: everything from it is a',
  '   proposal or an inferred claim, never observed. Apply them in small plans and ask the user about each proposal, one at',
  '   a time; the needs answered here are what the requirements of the next stage derive from.',
  '5. Domain stage, when the run has tables (assay_facts with kind "tables": their columns, and the table each foreign key',
  '   references, where a schema or an ORM class declares them; the tables code only names have neither). One plan: a domain',
  '   per system (elements: type domain, inferred, citing its tables, at the root or in a group: a domain is never inside a',
  '   system; named for the business area, not the system\'s own name), and entities: one',
  '   per table of the repository\'s own, every one, a page type or a settings table of a CMS too (tables: its table facts,',
  '   the SQL\'s and the ORM class\'s of one table together; label as the business calls it, in the singular; parent the',
  '   domain). Only join tables of two others, logs and framework tables are no entities. An entity whose table\'s foreign key references an aggregate it belongs to (an',
  '   order line, an order) is kind entity, partOf that one; one that refers to another aggregate references it (to,',
  '   cardinality one). Only a foreign key backs these: the server refuses one no foreign key states; a reference only the',
  '   code shows (a join, a lookup by a column) goes in relations instead: relationType references, inferred, citing the',
  '   code. The server writes',
  '   the entities observed and relates each element of the run built from a unit whose code names the table to it',
  '   (realises), or, where none does, the element holding the stored routines that use it (a package\'s component, else',
  '   the database). Make a view of them (create_view with viewpoint "Domain model").',
  '6. Processes stage. Read the entry points (assay_facts with kind "entries": routes, VB6 forms, menu items and buttons',
  '   with their Click handlers, scheduled jobs, message handlers), the explored paths and the code behind them (assay_read',
  '   at the handler\'s line), and write what a user or the system does from start to end: one process per task a person',
  '   or a clock starts (placing an order, closing the day), its steps in order, a step per thing done (facts: the entry',
  '   point, path, screen or table fact it rests on, or citations of the code; a step made of steps may rest on them',
  '   alone), performedBy the person or the element',
  '   that does it, mockups the mockups that show it, repeat and condition where the code loops or branches, nested steps',
  '   where one is made of several. Not every route is a process: those that serve a task together are its steps. One plan',
  '   (processes, parent the system); the server writes them directly, inferred, no proposal. Make a view of each',
  '   (create_view with viewpoint "Process").',
  '7. State machines stage, for each entity with a status (assay_facts with kind "states": the values an enum, CHECK,',
  '   ENUM or a table\'s flags give, and the lines that set each value). Read those lines (assay_read) and write its lifecycle: states (one per',
  '   value; value: the fact\'s value when the label is the business word; kind final for one nothing leaves), initial',
  '   (the state a new one starts in: the fact\'s default, else where the code creates it), transitions (from, to, event: what happens, in words;',
  '   guard and actions where the code tests or does something; each rests on a line that sets its target, which the',
  '   server finds in the state fact, or on citations of the code that moves it), entity, facts the state facts. The',
  '   server writes it directly, inferred, the lifecycle of its entity, implemented by the elements built from the units',
  '   whose code sets its values (or implementedBy). A state no fact holds needs citations of the code that names it.',
  '   When no line sets the values (the fact lists none) and no code you read moves them, write the states and the',
  '   initial only, no transition the code does not show, and say so in the machine\'s description: an order of the',
  '   values is a guess, not a lifecycle (assay_apply and get_issues then warn its states cannot be reached: that is so,',
  '   leave those warnings).',
  '   A status kept in flags or nullable dates is a state fact of flags (its values each flag and its negation: dead, not',
  '   dead; paid, not paid): a state takes one as its value (Alive: value "not dead"), and the lines that set or clear a',
  '   flag back the transitions. A machine with no state fact at all rests on citations of the code that names its',
  '   states, the machine\'s own and each state\'s. Make a view of each (create_view with viewpoint "State machine").',
  '8. Scenarios stage. For each unit with tests (assay_facts with unit and kind "tests"), group its tests by the behaviour they',
  '   check (a describe block, a file), read the test code where the titles do not say enough, and write for each group a',
  '   requirement in EARS (what the code does, as the tests show it; satisfiedBy the element of that unit; need: the need it',
  '   serves, a need key of the plan, a need proposal still waiting or a need of the model, else it derives from the run\'s',
  '   need Found in the code) with the scenarios that verify it (given, when, then; tests: the test facts; paths: the explored',
  '   paths that show it, which become Playwright tests of its repository when the user accepts it). Each test fact',
  '   has a status: a scenario rests only on tests that passed, or not run (a database\'s utPLSQL or pgTAP test its code',
  '   declares, which no report names: its title is what it checks, and its unit\'s database is the element), or on explored',
  '   paths (paths) that show the behaviour, as',
  '   when a unit test fails or checks nothing while the application does it. Write the EARS fields without their keyword',
  '   (trigger: "a customer opens an order", not "When …"). Then the behaviours a user or another system relies on that no',
  '   test checks (the processes\' steps, what is stored, the transitions of a lifecycle; not every routine), and those',
  '   whose tests failed or were skipped and that no path shows: a requirement each, satisfiedBy the element whose code',
  '   does it, with scenarios drawn from the code (given, when, then; citations: the lines that do it). Accepted, such a',
  '   scenario is written, and where the unit that builds its element has a test framework (the unit lines say "tests',
  '   with …"), the server writes a pending test of it into that repository and binds it; a VB6 unit, or one with none,',
  '   gets the scenario only. Tell the user when tests do not pass. A defect you find in the code (SQL joined from input, a',
  '   password in the source) is an unwanted-behaviour requirement nothing satisfies yet, citing the lines around it but',
  '   quoting never the secret itself (.radical/assay/run.json keeps only the text you quote). Then the requirements',
  '   the documents state that no test checks: no scenarios, citations of the document, satisfiedBy the element that',
  '   builds it, or none when no code does (the model then shows it unsatisfied, a gap; give it a parent). Put them in',
  '   plans of a few requirements each and assay_apply them. Each comes back as a proposal: show it to the user with its',
  '   scenarios, ask whether to add it, change it (assay_answer changes: label, properties, need, parent) or leave it out,',
  '   one at a time, and pass the answer to assay_answer. A requirement a process meets names it (processes): accepted,',
  '   the process satisfies it. Then make the views that show them: create_view with viewpoint "Specification" (the',
  '   requirements with their scenarios) and "Requirement coverage" (which are verified, which are not).',
  '9. get_issues with concerns "brief" (the concern packs\' questions in full take a large model\'s whole answer): fix what',
  '   breaks the metamodel; the concerns it lists are the user\'s to settle later (Forge, forge_import_hub_concept), not',
  '   Assay\'s. Then assay_finish: what the run wrote, and the proposals still waiting.',
].join('\n')

const CITATION_SCHEMA = {
  type: 'object',
  description: 'Lines of a repository\'s or source\'s file you quote. The server checks the text is in those lines, spacing aside.',
  properties: {
    repository: { type: 'string', description: 'The repository\'s or source\'s name, as assay_start lists it.' },
    file: { type: 'string', description: 'From the repository\'s root (a source\'s: as its document facts name it).' },
    lines: { type: 'array', items: { type: 'number' }, description: '[first, last], from 1; at most 40 lines.' },
    text: { type: 'string', description: 'Words of those lines, as written there.' },
  },
  required: ['repository', 'file', 'lines', 'text'],
  additionalProperties: false,
}

const PATH_SCHEMA = {
  type: 'object',
  properties: { repository: { type: 'string' }, path: { type: 'string', description: 'A folder (or file) from the repository\'s root.' } },
  required: ['repository', 'path'],
  additionalProperties: false,
}

/** A step of a process; its own steps are of this shape too. */
const STEP_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    label: { type: 'string', description: 'What is done, as a verb phrase: "Enter the items".' },
    description: { type: 'string' },
    performedBy: { type: 'string', description: 'The person or element that does it: a key or an id.' },
    mockups: { type: 'array', items: { type: 'string' }, description: 'The mockups that show it: keys or ids.' },
    repeat: { type: 'string', enum: ['1', '0..1', '1..n', '0..n'] },
    condition: { type: 'string', description: 'for each …, while …, if …' },
    children: { type: 'string', enum: ['sequence', 'choice', 'concurrent'], description: 'How its own steps run.' },
    steps: { type: 'array', items: { type: 'object' }, description: 'Its own steps, in order, of this same shape.' },
    facts: { type: 'array', items: { type: 'string' }, description: 'The entry points, explored paths, screens or other facts it rests on.' },
    citations: { type: 'array', items: CITATION_SCHEMA },
  },
  required: ['key', 'label'],
  additionalProperties: false,
}

const PLAN_SCHEMA = {
  type: 'object',
  description: 'What you found, citing the run\'s facts by id. Keys name the plan\'s items for each other and for later calls (they become tempIds).',
  properties: {
    elements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          type: { type: 'string', description: 'A node type of the metamodel: system, container, component, webapp, database, queue, person, …' },
          label: { type: 'string' },
          description: { type: 'string' },
          technology: { type: 'string' },
          external: { type: 'boolean' },
          parent: { type: 'string', description: 'A key of this plan or an id (or earlier key) of the model.' },
          units: { type: 'array', items: { type: 'string' }, description: 'The unit facts it is built from; their folders go into the repository\'s .radical/radical.json.' },
          paths: { type: 'array', items: PATH_SCHEMA, description: 'Folders it is built in that are no unit (code Assay reads no units of); they go into the repository\'s .radical/radical.json.' },
          facts: { type: 'array', items: { type: 'string' }, description: 'The fact ids it rests on.' },
          citations: { type: 'array', items: CITATION_SCHEMA, description: 'Code or document lines you quote, for an inferred element.' },
          confidence: { type: 'string', enum: ['observed', 'inferred'] },
        },
        required: ['key', 'type', 'label', 'confidence'],
        additionalProperties: false,
      },
    },
    relations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          relationType: { type: 'string' },
          label: { type: 'string' },
          technology: { type: 'string' },
          properties: { type: 'object', description: 'The relation type\'s properties, as the metamodel has them (a references\' cardinality, …).' },
          facts: { type: 'array', items: { type: 'string' } },
          citations: { type: 'array', items: CITATION_SCHEMA, description: 'Code or document lines you quote, for an inferred relation.' },
          confidence: { type: 'string', enum: ['observed', 'inferred'] },
        },
        required: ['from', 'to', 'confidence'],
        additionalProperties: false,
      },
    },
    requirements: {
      type: 'array',
      description: 'Hypotheses: each comes back as a proposal for the user and is written only when accepted.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          properties: { type: 'object', description: 'ears_type, action ("the system shall …") and the fields its EARS type needs (trigger, precondition, …), rationale.' },
          satisfiedBy: { type: 'string', description: 'The element whose code the tests exercise: a key or an id. Leave it out for a requirement drawn from documents that no code builds yet: the model then shows it unsatisfied, as it is.' },
          parent: { type: 'string', description: 'Where to put it and its scenarios (a system, domain or group). Default: the system holding satisfiedBy, else the model\'s root.' },
          need: { type: 'string', description: 'The need it derives from: a key of a need of this plan or of an earlier one still waiting, or an id of the model. Default: the run\'s need "Found in the code".' },
          processes: { type: 'array', items: { type: 'string' }, description: 'The processes that meet it (keys or ids): accepted, each satisfies it.' },
          facts: { type: 'array', items: { type: 'string' } },
          citations: { type: 'array', items: CITATION_SCHEMA, description: 'Code or documents you quote; a requirement drawn from documents has no scenarios.' },
          scenarios: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                label: { type: 'string' },
                given: { type: 'string' },
                when: { type: 'string' },
                then: { type: 'string' },
                tests: { type: 'array', items: { type: 'string' }, description: 'The test facts that check it.' },
                paths: { type: 'array', items: { type: 'string' }, description: 'Paths explored in the running application that show it (assay_explore): accepted, each is written as a Playwright test into its repository\'s e2e/assay/ and bound to the scenario.' },
                citations: { type: 'array', items: CITATION_SCHEMA, description: 'The code it is drawn from, when no test or path shows it: accepted, a pending test of it is written where the unit that builds its element has a test framework.' },
              },
              required: ['key', 'label', 'given', 'when', 'then'],
              additionalProperties: false,
            },
          },
        },
        required: ['key', 'label', 'properties'],
        additionalProperties: false,
      },
    },
    needs: {
      type: 'array',
      description: 'Hypotheses drawn from documents: what people asked for. Each comes back as a proposal.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          description: { type: 'string', description: 'What the document states, in its words where it can be.' },
          parent: { type: 'string' },
          properties: { type: 'object', description: 'kind (brief, user-story, stakeholder-note, meeting-notes, regulation, other) and source.' },
          facts: { type: 'array', items: { type: 'string' }, description: 'The document facts it rests on.' },
          citations: { type: 'array', items: CITATION_SCHEMA },
        },
        required: ['key', 'label', 'description'],
        additionalProperties: false,
      },
    },
    mockups: {
      type: 'array',
      description: 'Screens of the explored application, written as observed mockups; the screens of a path are joined by navigates-to in its order.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string', description: 'The screen\'s name, as a user would call it.' },
          screen: { type: 'string', description: 'The screen fact it is built from (assay_explore\'s answers).' },
          description: { type: 'string', description: 'What the user sees and does on it.' },
          parent: { type: 'string', description: 'A system, domain or group: a key or an id.' },
          presentedBy: { type: 'string', description: 'The element that renders it (a webapp, container, component or system): a key or an id.' },
        },
        required: ['key', 'label', 'screen'],
        additionalProperties: false,
      },
    },
    entities: {
      type: 'array',
      description: 'Every table of the repository\'s own but join tables, logs and framework tables, as entities of a domain: written observed. A relation between two rests on a foreign key of their tables.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string', description: 'As the business calls it, in the singular.' },
          description: { type: 'string', description: 'Default: its table, where it is declared and its columns.' },
          kind: { type: 'string', enum: ['aggregate-root', 'entity'], description: 'entity: a part of another\'s aggregate (with partOf). Default aggregate-root.' },
          tables: { type: 'array', items: { type: 'string' }, description: 'The table facts it is (one table: its SQL\'s and its ORM class\'s facts).' },
          parent: { type: 'string', description: 'Its domain: a key or an id.' },
          partOf: { type: 'string', description: 'The entity whose aggregate it belongs to: a foreign key of its tables references that one\'s.' },
          references: {
            type: 'array',
            items: { type: 'object', properties: { to: { type: 'string' }, cardinality: { type: 'string', enum: ['one', 'many'] }, description: { type: 'string' } }, required: ['to'], additionalProperties: false },
            description: 'The aggregates it refers to: a foreign key of its tables references each one\'s.',
          },
        },
        required: ['key', 'label', 'tables'],
        additionalProperties: false,
      },
    },
    processes: {
      type: 'array',
      description: 'What a user or the system does from start to end, step by step, from the entry points, paths and code: written directly, inferred.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          description: { type: 'string' },
          parent: { type: 'string', description: 'A system, domain or group: a key or an id.' },
          children: { type: 'string', enum: ['sequence', 'choice', 'concurrent'] },
          steps: { type: 'array', items: STEP_SCHEMA, description: 'In order.' },
          facts: { type: 'array', items: { type: 'string' } },
          citations: { type: 'array', items: CITATION_SCHEMA },
        },
        required: ['key', 'label', 'steps'],
        additionalProperties: false,
      },
    },
    stateMachines: {
      type: 'array',
      description: 'The lifecycle of an entity from its status values and the code that sets them: written directly, inferred.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string', description: 'Default style: "<Entity> lifecycle".' },
          description: { type: 'string' },
          parent: { type: 'string', description: 'Default: the domain of its entity.' },
          entity: { type: 'string', description: 'The entity: a key or an id.' },
          facts: { type: 'array', items: { type: 'string' }, description: 'The state facts its states are the values of.' },
          citations: { type: 'array', items: CITATION_SCHEMA, description: 'With no state fact: the code that keeps its status (a flag, a nullable date).' },
          initial: { type: 'string', description: 'The key of the state a new one starts in.' },
          states: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                label: { type: 'string' },
                kind: { type: 'string', enum: ['normal', 'final'] },
                description: { type: 'string' },
                value: { type: 'string', description: 'The state fact\'s value it is, when its label is another word.' },
                citations: { type: 'array', items: CITATION_SCHEMA, description: 'For a state no state fact holds: the code that names it.' },
              },
              required: ['key', 'label'],
              additionalProperties: false,
            },
          },
          transitions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                from: { type: 'string', description: 'A state key.' },
                to: { type: 'string', description: 'A state key.' },
                event: { type: 'string', description: 'What happens, in words: one event of the machine per name.' },
                guard: { type: 'string' },
                actions: { type: 'string' },
                facts: { type: 'array', items: { type: 'string' } },
                citations: { type: 'array', items: CITATION_SCHEMA, description: 'The code that makes it, unless a line the state facts name sets its target.' },
              },
              required: ['from', 'to'],
              additionalProperties: false,
            },
          },
          implementedBy: { type: 'array', items: { type: 'string' }, description: 'The elements that run it. Default: those built from the units whose code sets its values.' },
        },
        required: ['key', 'label', 'entity', 'initial', 'states', 'transitions'],
        additionalProperties: false,
      },
    },
    decisions: {
      type: 'array',
      description: 'Hypotheses drawn from documents: decisions recorded in them, as ADRs. Each comes back as a proposal.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          properties: { type: 'object', description: 'context, decision, consequences, alternatives, status (as the document gives it; default proposed), date.' },
          constrains: { type: 'array', items: { type: 'string' }, description: 'The C4 elements it applies to: keys of this or an earlier plan, or ids of the model.' },
          parent: { type: 'string' },
          facts: { type: 'array', items: { type: 'string' } },
          citations: { type: 'array', items: CITATION_SCHEMA },
        },
        required: ['key', 'label', 'properties'],
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
}

export const ASSAY_TOOL_DEFS: ToolDef[] = [
  {
    name: 'assay_start',
    description: 'Start a Radical Assay run (replacing any earlier run): find the model in existing code. Reads the facts of the code repositories in the directories given (units of every stack Assay reads, their dependencies, deployments, APIs, addresses, databases, documents, tests from reports), each with its file and line, writes them to each repository\'s .radical/assay/facts.json, links the units across repositories, takes the sources of documents given, and returns what it found in brief (assay_facts gives the rest, assay_procedure the steps). The model this server is bound to is the central model.',
    inputSchema: {
      type: 'object',
      properties: {
        directories: { type: 'array', items: { type: 'string' }, description: 'The code, absolute or from the central model\'s repository: a repository, a directory holding repositories directly inside it, a folder of code with no repository inside, or a .zip file of code (unpacked into .radical/assay/unpacked/).' },
        reports: { type: 'object', description: 'Per repository name, its test reports (files or directories, from its root). Default: each repository\'s reports/ when it has one.' },
        sources: { type: 'array', items: { type: 'string' }, description: 'Documentation: folders, files, .zip files (absolute or from the central model\'s repository) or public http(s) links, kept as text in .radical/assay/sources/.' },
      },
      required: ['directories'],
      additionalProperties: false,
    },
  },
  {
    name: 'assay_procedure',
    description: 'The steps of a Radical Assay run, stage by stage, from the C4 model to the requirements: what to read, what to ask the user and what to hand back as a plan. Read it once assay_start has answered.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'assay_add_sources',
    description: 'Add sources of documents to the Assay run: folders, files, .zip files or public http(s) links. Each document is kept as text in the central repository\'s .radical/assay/sources/ (HTML as Markdown, a PDF\'s text) and listed as a document fact with its title and headings. A link that asks for a login is refused: the user exports its pages into a folder or a .zip instead.',
    inputSchema: {
      type: 'object',
      properties: { sources: { type: 'array', items: { type: 'string' } } },
      required: ['sources'],
      additionalProperties: false,
    },
  },
  {
    name: 'assay_read',
    description: 'Lines of a file of the Assay run\'s repositories or sources, numbered, to read and cite: at most 400 at once. Given a folder (or no file), it lists the files below it instead, 400 at a time, so you can find what to read.',
    inputSchema: {
      type: 'object',
      properties: {
        repository: { type: 'string', description: 'A repository\'s or source\'s name.' },
        file: { type: 'string', description: 'A file or a folder, from its root, as its facts name it. Default: its root folder.' },
        from: { type: 'number', description: 'The first line (or, for a folder, the first file listed), from 1. Default 1.' },
        to: { type: 'number', description: 'The last line. Default from + 399.' },
      },
      required: ['repository'],
      additionalProperties: false,
    },
  },
  {
    name: 'assay_search',
    description: 'The lines of a repository\'s or source\'s files that hold a text (or match a regular expression), each with its file and line, to find what to read with assay_read: where a connection is opened, a form named, a port set. At most 100 lines.',
    inputSchema: {
      type: 'object',
      properties: {
        repository: { type: 'string', description: 'A repository\'s or source\'s name.' },
        pattern: { type: 'string', description: 'The text to find, case aside.' },
        regex: { type: 'boolean', description: 'pattern is a regular expression.' },
        path: { type: 'string', description: 'Only this folder or file, from the root.' },
      },
      required: ['repository', 'pattern'],
      additionalProperties: false,
    },
  },
  {
    name: 'assay_explore',
    description: 'Open a web application running on this machine (localhost, a loopback address or a .localhost name; run it on a test database) in a browser the server drives, and start a path through it named for what a user does (Sign in, Place an order). Each path starts in a fresh browser session, signed out, as its test will; what it creates or changes is done for real, on the test database. Returns the screen: its address, title, headings and each control with a reference (e1, e2, …), its role and its name; its screenshot is kept in .radical/assay/explore/. Act on it with assay_explore_act. Each path is a fact of the run: its screens can become mockups, and a requirement\'s scenario can rest on it, written as a Playwright test into the repository when the user accepts it.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Where the path starts, e.g. http://localhost:5173/.' },
        path: { type: 'string', description: 'The path\'s name: what the user does along it.' },
        repository: { type: 'string', description: 'The code repository of the run that builds the application: its e2e/assay/ gets the path\'s test.' },
      },
      required: ['url', 'path', 'repository'],
      additionalProperties: false,
    },
  },
  {
    name: 'assay_explore_act',
    description: 'Do one thing on the current screen of the explored application, as the next step of the current path: click, fill (value: the text), select (value: the option), check, or press (value: a key such as Enter) the control with that reference, or goto (value: an address or route of the same application); or expect (value: a text the current screen shows, the outcome a scenario names: the path\'s test asserts it). Returns the screen it leads to. Another host\'s address, and a control whose name says it pays, buys, transfers money or deletes or closes an account, are refused.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['click', 'fill', 'select', 'check', 'press', 'goto', 'expect'] },
        ref: { type: 'string', description: 'The control\'s reference on the current screen (none for goto).' },
        value: { type: 'string' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  },
  {
    name: 'assay_facts',
    description: 'The facts of the Assay run, to cite in a plan: a repository\'s, source\'s or unit\'s units, dependencies, APIs, services, addresses, databases, tests, documents, or the links. Long lists come a page at a time.',
    inputSchema: {
      type: 'object',
      properties: {
        repository: { type: 'string', description: 'A repository\'s or source\'s name.' },
        unit: { type: 'string', description: 'A unit fact\'s id.' },
        kind: { type: 'string', enum: [...FACT_LISTS, 'links'] },
        offset: { type: 'number' },
        limit: { type: 'number', description: 'At most this many (default 200); a page holds about 20 KB at most, and says where the next starts.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'assay_apply',
    description: 'Hand the server a plan of what you found. It refuses the whole plan, naming every problem, when an item cites no fact or a fact the run lacks, quotes what the file does not hold, an observed item cites nothing that states it (or a document), an entity relation no foreign key states, or the metamodel forbids it; otherwise it writes the elements, relations, mockups, entities, processes and state machines into the central model, maps them in each code repository\'s .radical/radical.json (implements: the units\' folders), keeps their evidence in .radical/assay/run.json, and returns each requirement, need and decision as a proposal for the user.',
    inputSchema: { type: 'object', properties: { plan: PLAN_SCHEMA }, required: ['plan'], additionalProperties: false },
  },
  {
    name: 'assay_answer',
    description: 'The user\'s answer to an Assay proposal. An accepted requirement is written whole, derived from its need (else the run\'s need "Found in the code"), satisfied by its element and verified by its scenarios, whose tests go into their repository\'s .radical/radical.json verifies (a scenario drawn from the code gets a pending test, where the unit that builds its element has a test framework); an accepted need or decision is written as a need or an ADR, the ADR constraining what it names. Changes come first: a new label, properties merged into the proposed ones, a need\'s description, a requirement\'s need. Rejected, nothing of it is written.',
    inputSchema: {
      type: 'object',
      properties: {
        proposal: { type: 'string', description: 'The proposal\'s id (P1, P2, …).' },
        accept: { type: 'boolean' },
        changes: { type: 'object', properties: { label: { type: 'string' }, properties: { type: 'object' }, description: { type: 'string' }, need: { type: 'string', description: 'For a requirement: the need it derives from, an id of the model or a need proposal (P3).' }, parent: { type: 'string', description: 'Where to put it: a system, domain or group, an id or a key.' } }, additionalProperties: false, description: 'What the user changed in it.' },
      },
      required: ['proposal', 'accept'],
      additionalProperties: false,
    },
  },
  {
    name: 'assay_finish',
    description: 'What the Assay run wrote (elements, relations, requirements, scenarios, needs, decisions, the files), and the proposals still waiting for an answer.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

export const ASSAY_TOOLS = new Set(ASSAY_TOOL_DEFS.map((tool) => tool.name))

/** The unit an element written is built from: a unit it cites, else the unit whose scripts create a stored routine it
 *  cites (a package's component inside its database). */
function unitOfWritten(run: Run, w: Written): string | undefined {
  return w.facts.find((f) => run.facts.get(f)?.kind === 'unit')
    ?? w.facts.map((f) => run.facts.get(f)).filter((f) => f?.kind === 'routine').map((f) => (f!.fact as RoutineFact).unit).find((u) => !!u)
}

/** One assay_* call's result. `commit` updates the run once the call's
 *  changes are on disk; `afterWrite` then writes the files beside the model
 *  and says what it wrote. */
export interface AssayResult extends ToolResult {
  readOnly?: boolean
  commit?: () => void
  afterWrite?: () => Promise<string>
}

interface Written {
  id: string
  key: string
  kind: 'element' | 'relation' | 'requirement' | 'scenario' | 'need' | 'decision' | 'mockup' | 'entity' | 'process' | 'step' | 'state-machine' | 'state' | 'event'
  label: string
  confidence: 'observed' | 'inferred' | 'hypothesis'
  facts: string[]
  /** Code the agent quoted for it. */
  citations?: Citation[]
  /** For a proposal: whether the user accepted it as proposed or changed it. */
  accepted?: 'as-proposed' | 'changed'
  /** For a transition: a line of the code sets its target (sets), or only a quotation backs it (quoted). */
  basis?: 'sets' | 'quoted'
}

/** A hypothesis waiting for the user: a requirement (with its scenarios), or a need or decision drawn from documents. */
type Proposal = {
  id: string
  status: 'waiting' | 'accepted' | 'rejected'
  /** Where to put it, as the plan named it: found when the proposal is answered. */
  parent?: string
  /** The model's id once accepted. */
  written?: string
} & (
  /** satisfiedBy as the plan named it; its need a proposal of the run (by id) or a need of the model. */
  | { kind: 'requirement'; requirement: PlanRequirement; satisfiedBy?: string; needProposal?: string; need?: string }
  | { kind: 'need'; need: PlanNeed }
  /** What it constrains, as the plan named it. */
  | { kind: 'decision'; decision: PlanDecision; constrains: string[] }
)

const keyOf = (p: Proposal): string => p.kind === 'requirement' ? p.requirement.key : p.kind === 'need' ? p.need.key : p.decision.key
const labelOf = (p: Proposal): string => p.kind === 'requirement' ? p.requirement.label : p.kind === 'need' ? p.need.label : p.decision.label

interface Run {
  /** The central repository's root and the model folder in it. */
  root: string
  modelPath: string
  repositories: RepositoryFacts[]
  /** Sources of documents, kept in the central repository's SOURCES_DIR. */
  sources: RepositoryFacts[]
  links: Link[]
  facts: FactIndex
  written: Written[]
  proposals: Proposal[]
  needId?: string
  /** The Explore stage's session: the screens and paths seen, and the browser that sees them. */
  explore?: { facts: RepositoryFacts; explorer: Explorer }
  /** The mockup written for each page (pageOf a screen's route), and the mockups joined by navigates-to already. */
  mockupOf: Map<string, string>
  navigated: Set<string>
  /** The Playwright tests written into the repositories. */
  testsWritten: string[]
  /** The pending tests written for scenarios drawn from the code. */
  skeletons: string[]
}

/** What a call writes beside the model: the elements' folders, the scenarios' tests, the explored paths' and pending tests. */
interface FileChanges {
  implements: Map<string, Array<{ repository: string; path: string }>>
  verifies: Map<string, string[]>
  pathTests?: Array<{ scenario: string; path: PathFact }>
  skeletons?: Array<{ repository: string; scenarios: string[] } & Skeleton>
}

/** The config written beside the Explore stage's tests, when a repository has none there. */
const PLAYWRIGHT_CONFIG = `// Written by Radical Assay beside the tests of the paths it explored.
// Run: npx playwright test -c e2e/assay (E2E_BASE_URL: where the application runs).
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  use: { baseURL: process.env.E2E_BASE_URL },
})
`

/** Where the central repository keeps the Explore stage's screenshots. */
export const EXPLORE_DIR = '.radical/assay/explore'

/** `n` things, singular for one. */
const plural = (n: number, one: string): string => `${n} ${one}${n === 1 ? '' : 's'}`

const ok = (resultText: string, extra: Partial<AssayResult> = {}): AssayResult => ({ ok: true, resultText, ...extra })
const refused = (resultText: string): AssayResult => ({ ok: false, resultText })

/** Runs a model tool; its refusal, or null. The facade keeps its last
 *  refusal and counts them, so only a new one counts; its own words say why
 *  (the parents the metamodel allows), the tool's are general. */
async function attempt(tool: string, args: Record<string, unknown>, ctx: ToolRunContext, facade: ModelFacade): Promise<string | null> {
  const before = facade.refusals
  const result = await runTool(tool, args, ctx)
  const said = facade.refusals !== before ? facade.lastError : null
  return result.ok ? said : said ?? result.resultText
}

export class Assay {
  private run: Run | null = null
  /** The labels of the entities the last plan wrote that no element realises. */
  private unrealised: string[] = []

  /** `folder`: the bound model folder; `root`: its repository's root. */
  constructor(private readonly folder: string, private readonly root: () => Promise<string>) {}

  async call(name: string, input: unknown, ctx: ToolRunContext, facade: ModelFacade): Promise<AssayResult> {
    if (name === 'assay_start') return this.start(input)
    if (name === 'assay_procedure') return ok(ASSAY_PROCEDURE, { readOnly: true })
    const run = this.run
    if (!run) return refused(`${name}: no Assay run; start one with assay_start`)
    if (name === 'assay_facts') return this.factsOf(run, input)
    if (name === 'assay_add_sources') return this.addSources(run, input)
    if (name === 'assay_read') return this.read(run, input)
    if (name === 'assay_search') return this.search(run, input)
    if (name === 'assay_explore' || name === 'assay_explore_act') return this.explore(run, name, input)
    if (name === 'assay_apply') return this.apply(run, input, ctx, facade)
    if (name === 'assay_answer') return this.answer(run, input, ctx, facade)
    if (name === 'assay_finish') return ok(this.summary(run), { readOnly: true })
    return refused(`Unknown tool ${name}`)
  }

  /** Every fact of the run by id: its repositories', its sources' and what the Explore stage saw. */
  private indexOf(run: Run): FactIndex {
    return factIndex([...run.repositories, ...run.sources, ...(run.explore ? [run.explore.facts] : [])], run.links)
  }

  private async explore(run: Run, name: string, input: unknown): Promise<AssayResult> {
    const { url, path, repository, action, ref, value } = (input ?? {}) as Record<string, unknown>
    if (!run.explore) {
      if (name !== 'assay_explore') return refused(`${name}: no application is open: start a path with assay_explore`)
      const taken = new Set([...run.repositories, ...run.sources].map((r) => r.repository))
      let session = 'explore'
      for (let i = 2; taken.has(session); i++) session = `explore-${i}`
      const dir = join(run.root, EXPLORE_DIR)
      ignored(dir)
      const facts = emptyFacts(session, dir)
      run.explore = { facts, explorer: new Explorer(facts, dir, run.root, { browser: process.env.RADICAL_ASSAY_BROWSER }) }
    }
    const { facts, explorer } = run.explore
    let got
    if (name === 'assay_explore') {
      if (typeof url !== 'string' || !url) return refused('assay_explore: url must be the address the path starts at')
      if (typeof path !== 'string' || !path.trim()) return refused('assay_explore: path must name what the user does along it')
      if (!run.repositories.some((r) => r.repository === repository)) return refused(`assay_explore: repository must be a code repository of the run (${run.repositories.map((r) => r.repository).join(', ')})`)
      got = await explorer.open(url, path.trim(), repository as string)
    } else {
      const actions: ExploreAction[] = ['click', 'fill', 'select', 'check', 'press', 'goto', 'expect']
      if (!actions.includes(action as ExploreAction)) return refused(`assay_explore_act: action must be one of ${actions.join(', ')}`)
      if (value !== undefined && typeof value !== 'string') return refused('assay_explore_act: value must be text')
      got = await explorer.act(action as ExploreAction, typeof ref === 'string' ? ref : undefined, value as string | undefined)
    }
    run.facts = this.indexOf(run)
    if ('problem' in got) return refused(`${name}: ${got.problem}`)
    return ok(`${'note' in got && got.note ? `Note: ${got.note}\n` : ''}${Explorer.describe(got.screen, got.path, run.root, facts.dir)}`, { readOnly: true })
  }

  private async start(input: unknown): Promise<AssayResult> {
    await this.run?.explore?.explorer.close()
    const { directories, reports, sources } = (input ?? {}) as { directories?: unknown; reports?: unknown; sources?: unknown }
    if (!Array.isArray(directories) || !directories.length || !directories.every((d) => typeof d === 'string' && d.trim())) {
      return refused('assay_start: directories must list the code repositories\' directories')
    }
    if (reports !== undefined && (!reports || typeof reports !== 'object' || Array.isArray(reports))) return refused('assay_start: reports must map a repository\'s name to its test reports')
    if (sources !== undefined && !(Array.isArray(sources) && sources.every((x) => typeof x === 'string' && x.trim()))) return refused('assay_start: sources must list folders, files, .zip files or links')
    const root = await this.root()
    let found
    try {
      if ((directories as string[]).some((d) => /\.zip$/i.test(d))) ignored(join(root, UNPACKED_DIR))
      found = repositoriesIn(directories as string[], root, join(root, UNPACKED_DIR))
    } catch (error) {
      return refused(`assay_start: ${(error as Error).message}`)
    }
    if (!found.dirs.length) return refused(`assay_start: no code in ${(directories as string[]).join(', ')} (Assay clones nothing)`)
    const byRepo = (reports ?? {}) as Record<string, unknown>
    // The grammars the readers parse code with, loaded once.
    await prepareSyntax()
    const repositories: RepositoryFacts[] = []
    for (const dir of found.dirs) {
      const own = byRepo[basename(dir)]
      const facts = extractRepository(dir, { access: ACCESS, ...(Array.isArray(own) ? { reports: own.filter((r): r is string => typeof r === 'string') } : {}) })
      repositories.push(facts)
      // A folder of code is left as it was: its facts are kept in the central repository.
      const file = factsFileOf(dir, facts.repository, root)
      try {
        if (!isRepository(dir)) ignored(join(root, FOLDER_FACTS_DIR))
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, serializeFacts(facts))
      } catch (error) {
        facts.notes.push(`${posix(relative(root, file))} not written: ${(error as Error).message}`)
      }
    }
    const links = linkRepositories(repositories)
    const taken = await takeSources((sources ?? []) as string[], root, new Set(repositories.map((r) => r.repository)), SOURCE_OPTIONS)
    this.run = { root, modelPath: posix(relative(root, this.folder)) || '.', repositories, sources: taken.sources, links, facts: factIndex([...repositories, ...taken.sources], links), written: [], proposals: [], mockupOf: new Map(), navigated: new Set(), testsWritten: [], skeletons: [] }
    const lines = [
      `Assay run on ${repositories.length} repositor${repositories.length === 1 ? 'y' : 'ies'}${taken.sources.length ? ` and ${taken.sources.length} source${taken.sources.length === 1 ? '' : 's'} of documents` : ''}; the central model is ${this.run.modelPath} in ${root}.`,
      ...(found.empty.length ? [`Nothing in: ${found.empty.join(', ')}.`] : []),
      ...found.notes,
      ...repositories.filter((r) => !isRepository(r.dir)).map((r) => `${r.repository} is no git repository: nothing is written into it (its facts: ${posix(relative(root, factsFileOf(r.dir, r.repository, root)))}).`),
      ...taken.problems.map((p) => `Source not taken: ${p}`),
      '',
      ...describeFacts(repositories, links, root, true),
      ...(taken.sources.length ? ['', 'Sources:', ...describeSources(taken.sources, root)] : []),
    ]
    // An agent's client keeps a long answer out of its view: the rest is a call of assay_facts away.
    const text = lines.join('\n')
    const cut = text.length > START_MAX ? `${text.slice(0, text.lastIndexOf('\n', START_MAX))}\n… (the rest: assay_facts per repository)` : text
    return ok(`${cut}\n\nNext: assay_procedure gives the steps, stage by stage.`, { readOnly: true })
  }

  private async addSources(run: Run, input: unknown): Promise<AssayResult> {
    const { sources } = (input ?? {}) as { sources?: unknown }
    if (!Array.isArray(sources) || !sources.length || !sources.every((x) => typeof x === 'string' && x.trim())) return refused('assay_add_sources: sources must list folders, files, .zip files or links')
    // A source given again replaces its copy.
    const origins = new Set((sources as string[]).map((x) => sourceOrigin(x, run.root)))
    const again = new Set(run.sources.filter((x) => x.origin && origins.has(x.origin)).map((x) => x.repository))
    const taken = await takeSources(sources as string[], run.root, new Set([...run.repositories, ...run.sources.filter((x) => !again.has(x.repository))].map((r) => r.repository)), SOURCE_OPTIONS)
    if (!taken.sources.length) return refused(`assay_add_sources: no source taken:\n${taken.problems.map((p) => `- ${p}`).join('\n')}`)
    return ok([
      `Took ${taken.sources.length} source${taken.sources.length === 1 ? '' : 's'} of documents:`,
      ...describeSources(taken.sources, run.root),
      ...taken.problems.map((p) => `Source not taken: ${p}`),
    ].join('\n'), {
      readOnly: true,
      commit: () => {
        run.sources = [...run.sources.filter((x) => !taken.sources.some((t) => t.repository === x.repository)), ...taken.sources]
        run.facts = this.indexOf(run)
      },
    })
  }

  /** At most this many lines come back at once, of a file of at most READ_BYTES. */
  private static readonly READ_LINES = 400
  private static readonly READ_BYTES = 20_000_000
  /** A folder holding more files of one kind than this is listed as one line. */
  private static readonly FOLD = 25

  private read(run: Run, input: unknown): AssayResult {
    const { repository, file, from, to } = (input ?? {}) as { repository?: unknown; file?: unknown; from?: unknown; to?: unknown }
    const all = [...run.repositories, ...run.sources]
    const repo = all.find((r) => r.repository === repository)
    if (!repo) return refused(`assay_read: no repository or source ${String(repository)} in the run (${all.map((r) => r.repository).join(', ')})`)
    const asked = file === undefined || file === '' ? '.' : file
    const path = typeof asked === 'string' ? inside(repo.dir, asked) : null
    if (path && statSync(path).isDirectory()) return this.listFolder(repo.repository, path, String(asked), from)
    if (!path || !statSync(path).isFile()) return refused(`assay_read: ${repo.repository} has no file ${String(file)}`)
    if (statSync(path).size > Assay.READ_BYTES) return refused(`assay_read: ${repo.repository}/${file} is bigger than ${Assay.READ_BYTES / 1e6} MB`)
    const lines = decodeText(readFileSync(path)).split(/\r?\n/)
    const first = Math.max(1, Number.isInteger(from) ? from as number : 1)
    if (Number.isInteger(to) && (to as number) < first) return refused(`assay_read: to (${String(to)}) comes before from (${first})`)
    const last = Math.min(lines.length, first + Assay.READ_LINES - 1, Number.isInteger(to) ? to as number : Infinity)
    if (first > lines.length) return refused(`assay_read: ${repo.repository}/${file} has ${lines.length} lines`)
    const width = String(last).length
    return ok([
      `${repo.repository}/${file}, lines ${first}–${last} of ${lines.length}${last < lines.length ? ` (next: from ${last + 1})` : ''}:`,
      ...lines.slice(first - 1, last).map((l, i) => `${String(first + i).padStart(width)}  ${l}`),
    ].join('\n'), { readOnly: true })
  }

  /** The files below `dir` (a folder of a repository or source), hidden ones and what builds make left out, a page at a time. */
  private listFolder(repository: string, dir: string, asked: string, from: unknown): AssayResult {
    const files: string[] = []
    const walk = (at: string): void => {
      for (const d of readdirSync(join(dir, at), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (d.name.startsWith('.') || (d.isDirectory() && SKIPPED.has(d.name))) continue
        const rel = at ? `${at}/${d.name}` : d.name
        if (d.isDirectory()) walk(rel)
        else if (d.isFile()) files.push(rel)
      }
    }
    walk('')
    // A folder of many files of one kind (a game's maps, a site's images) is one line: its data, not its code.
    const keyOf = (f: string) => `${f.includes('/') ? f.slice(0, f.lastIndexOf('/') + 1) : ''}*${extname(f).toLowerCase()}`
    const groups = new Map<string, string[]>()
    for (const f of files) groups.set(keyOf(f), [...(groups.get(keyOf(f)) ?? []), f])
    const lines: string[] = []
    const folded = new Set<string>()
    for (const f of files) {
      const key = keyOf(f)
      const group = groups.get(key)!
      if (group.length <= Assay.FOLD) { lines.push(f); continue }
      if (folded.has(key)) continue
      folded.add(key)
      const name = (x: string) => x.slice(x.lastIndexOf('/') + 1)
      lines.push(`${key} (${group.length} files, ${name(group[0])} … ${name(group[group.length - 1])})`)
    }
    const first = Math.max(1, Number.isInteger(from) ? from as number : 1)
    const page = lines.slice(first - 1, first - 1 + Assay.READ_LINES)
    const prefix = asked === '.' ? '' : `${asked.replace(/\/+$/, '')}/`
    return ok([
      `${repository}/${prefix || ''}: ${files.length} file${files.length === 1 ? '' : 's'}${lines.length ? `, lines ${first}–${first + page.length - 1} of ${lines.length}` : ''}${first - 1 + page.length < lines.length ? ` (next: from ${first + page.length})` : ''}; a folder of more than ${Assay.FOLD} files of one kind is one line:`,
      ...page.map((f) => `${prefix}${f}`),
    ].join('\n'), { readOnly: true })
  }

  /** At most this many matches come back from one search. */
  private static readonly SEARCH_HITS = 100

  /** The lines of a repository's or source's files that hold `pattern`, with their files and line numbers. */
  private search(run: Run, input: unknown): AssayResult {
    const { repository, pattern, path, regex } = (input ?? {}) as { repository?: unknown; pattern?: unknown; path?: unknown; regex?: unknown }
    const all = [...run.repositories, ...run.sources]
    const repo = all.find((r) => r.repository === repository)
    if (!repo) return refused(`assay_search: no repository or source ${String(repository)} in the run (${all.map((r) => r.repository).join(', ')})`)
    if (typeof pattern !== 'string' || !pattern) return refused('assay_search: pattern must be the text to find')
    let re: RegExp
    try { re = new RegExp(regex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } catch (error) { return refused(`assay_search: ${(error as Error).message}`) }
    const under = typeof path === 'string' && path ? inside(repo.dir, path) : repo.dir
    if (!under) return refused(`assay_search: ${repo.repository} has no ${String(path)}`)
    const hits: string[] = []
    let total = 0
    const scan = (full: string): void => {
      if (statSync(full).size > 2_000_000) return
      const bytes = readFileSync(full)
      if (bytes.subarray(0, 8000).includes(0)) return
      const rel = posix(relative(repo.dir, full))
      decodeText(bytes).split(/\r?\n/).forEach((line, i) => {
        if (!re.test(line)) return
        total++
        if (hits.length < Assay.SEARCH_HITS) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 200)}`)
      })
    }
    const walk = (at: string): void => {
      for (const d of readdirSync(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (d.name.startsWith('.') || (d.isDirectory() && SKIPPED.has(d.name))) continue
        const full = join(at, d.name)
        if (d.isDirectory()) walk(full)
        else if (d.isFile()) scan(full)
      }
    }
    if (statSync(under).isFile()) scan(under)
    else walk(under)
    return ok([`${total} line${total === 1 ? '' : 's'} hold ${regex ? `/${pattern}/` : `"${pattern}"`}${total > hits.length ? ` (the first ${hits.length} shown)` : ''}:`, ...hits].join('\n'), { readOnly: true })
  }

  private factsOf(run: Run, input: unknown): AssayResult {
    const { repository, unit, kind, offset, limit } = (input ?? {}) as { repository?: string; unit?: string; kind?: string; offset?: number; limit?: number }
    const every = [...run.repositories, ...run.sources, ...(run.explore ? [run.explore.facts] : [])]
    let repos = repository ? every.filter((r) => r.repository === repository) : every
    // The paths explored in an application are also the facts of the repository that builds it.
    if (repository && run.explore && repos.length && repos[0] !== run.explore.facts) {
      const paths = run.explore.facts.paths.filter((x) => x.repository === repository)
      const seen = new Set(paths.flatMap((x) => x.steps.map((st) => st.to)))
      if (paths.length) repos = [{ ...repos[0], paths, screens: run.explore.facts.screens.filter((x) => seen.has(x.id)) }]
    }
    if (repository && !repos.length) return refused(`assay_facts: no repository or source ${repository} in the run (${every.map((r) => r.repository).join(', ')})`)
    if (unit && run.facts.get(unit)?.kind !== 'unit') return refused(`assay_facts: ${unit} is no unit of the run`)
    const all: string[] = [...FACT_LISTS, 'links']
    if (kind !== undefined && !all.includes(kind)) return refused(`assay_facts: kind ${String(kind)} is none of ${all.join(', ')}`)
    const kinds = kind ? [kind] : all
    const rows: unknown[] = []
    for (const k of kinds) {
      if (k === 'links') {
        rows.push(...run.links.filter((l) => (!unit || l.from === unit || l.to === unit) && (!repository || repos.some((r) => [l.from, l.to].some((u) => u.startsWith(`${r.repository}:`))))).map((l) => ({ fact: 'link', ...l })))
        continue
      }
      for (const r of repos) {
        const list = (r as unknown as Record<string, Array<{ unit?: string; id: string }>>)[k] ?? []
        // A unit's facts: its own, a service it runs, an address its service's environment names.
        const runs = new Set(r.services.filter((s) => s.unit === unit).map((s) => s.id))
        const mine = (f: { id: string; unit?: string; service?: string; units?: string[] }) =>
          !unit || (k === 'units' ? f.id === unit : f.unit === unit || (!!f.service && runs.has(f.service)) || (k === 'groups' && !!f.units?.includes(unit)))
        // A form's layout is the wireframe's, not the agent's: its size and how many controls it has.
        const shown = (f: Record<string, unknown>) => (k === 'screens' && f.form ? { ...f, form: { width: (f.form as { width: number }).width, height: (f.form as { height: number }).height, controls: (f.form as { controls: unknown[] }).controls.length } } : f)
        // A package's members fold into its row, each short (a library of 56 packages lists 830 routines).
        const folded = k === 'routines' ? foldPackages(list.filter(mine) as unknown as RoutineFact[]) : list.filter(mine)
        rows.push(...folded.map((f) => ({ fact: { addresses: 'address', dependencies: 'dependency', entries: 'entry' }[k] ?? k.replace(/s$/, ''), ...shown(f as unknown as Record<string, unknown>) })))
      }
    }
    const from = Math.max(0, offset ?? 0)
    // At most `limit` facts, and about PAGE_MAX characters of them (at least one).
    const page: typeof rows = []
    let size = 0
    for (const row of rows.slice(from, from + Math.max(1, limit ?? 200))) {
      size += JSON.stringify(row).length + 1
      if (page.length && size > PAGE_MAX) break
      page.push(row)
    }
    return ok(JSON.stringify({ total: rows.length, offset: from, facts: page, ...(from + page.length < rows.length ? { next: from + page.length } : {}) }), { readOnly: true })
  }

  private async apply(run: Run, input: unknown, ctx: ToolRunContext, facade: ModelFacade): Promise<AssayResult> {
    const { plan, problems } = parsePlan((input as { plan?: unknown } | undefined)?.plan)
    // The keys of waiting proposals are taken: accepting one makes them ids.
    const waiting = new Set(run.proposals.filter((p) => p.status === 'waiting').flatMap((p) => [keyOf(p), ...(p.kind === 'requirement' ? (p.requirement.scenarios ?? []).map((s) => s.key) : [])]))
    const known = (id: string): boolean => waiting.has(id) || !!facade.getNodes()[ctx.resolveId(id)]
    // What an element an earlier plan wrote is built from and rests on, to tie a relation to it.
    const factsOf = (id: string): string[] => run.written.find((w) => w.id === ctx.resolveId(id))?.facts ?? []
    const waitingNeeds = new Set(run.proposals.filter((p) => p.status === 'waiting' && p.kind === 'need').map(keyOf))
    const typeOf = (id: string): string | undefined => facade.getNodes()[ctx.resolveId(id)]?.type
    problems.push(...checkPlan(plan, run.facts, known, run.repositories, factsOf, { sources: run.sources, typeOf, waitingNeeds }))
    if (problems.length) return refused(`assay_apply: the plan is refused, nothing was written:\n${problems.map((p) => `- ${p}`).join('\n')}`)

    // Parents before their children, then the relations; every failure is
    // collected, and any one refuses the whole plan (nothing is committed).
    const failures: string[] = []
    const written: Written[] = []
    const pending = [...plan.elements]
    const keys = new Set(plan.elements.map((e) => e.key))
    while (pending.length) {
      const at = pending.findIndex((e) => !e.parent || !keys.has(e.parent) || written.some((w) => w.key === e.parent) || failures.length)
      const e = pending.splice(at < 0 ? 0 : at, 1)[0]
      const error = await attempt('add_node', {
        tempId: e.key, type: e.type, label: e.label,
        ...(e.parent ? { parentId: e.parent } : {}),
        ...(e.description ? { description: e.description } : {}),
        ...(e.technology ? { technology: e.technology } : {}),
        ...(e.external !== undefined ? { external: e.external } : {}),
      }, ctx, facade)
      if (error) { failures.push(`elements "${e.key}" (${e.label}): ${error}`); continue }
      written.push({ id: ctx.resolveId(e.key), key: e.key, kind: 'element', label: e.label, confidence: e.confidence, facts: [...new Set([...(e.units ?? []), ...(e.facts ?? [])])], ...(e.citations?.length ? { citations: e.citations } : {}) })
    }
    // Screens the server saw are observed mockups; a path's screens follow one another.
    const mockupOf = new Map(run.mockupOf)
    for (const m of plan.mockups) {
      const screen = run.facts.get(m.screen)!.fact as ScreenFact
      const error = await attempt('add_node', {
        tempId: m.key, type: 'mockup', label: m.label,
        ...(m.parent ? { parentId: m.parent } : {}),
        // The page, not one visit of it: no query (it may hold what was typed), numbers as {id}; a form by its name.
        properties: { screen: screen.source === 'form' ? screen.route : pageOf(screen.route), ...(m.description ? { description: m.description } : {}) },
      }, ctx, facade)
      if (error) { failures.push(`mockups "${m.key}" (${m.label}): ${error}`); continue }
      const id = ctx.resolveId(m.key)
      // A form's mockup is drawn from its controls at their positions (ADR Assay reads desktop screens from their form files).
      const wireframe = screen.source === 'form' ? formWireframe(screen) : null
      if (wireframe) facade.updateNode(id, { wireframe } as Parameters<ModelFacade['updateNode']>[1])
      mockupOf.set(screen.source === 'form' ? screen.id : pageOf(screen.route), id)
      written.push({ id, key: m.key, kind: 'mockup', label: m.label, confidence: 'observed', facts: [m.screen] })
      if (m.presentedBy) {
        const before = new Set(Object.keys(facade.getRelations()))
        const presented = await attempt('add_relation', { sourceId: m.key, targetId: m.presentedBy, relationType: 'presented-by' }, ctx, facade)
        if (presented) failures.push(`mockups "${m.key}" presented by ${m.presentedBy}: ${presented}`)
        else written.push({ id: Object.keys(facade.getRelations()).find((rid) => !before.has(rid)) ?? '', key: `${m.key}->${m.presentedBy}`, kind: 'relation', label: 'presented by', confidence: 'observed', facts: [m.screen] })
      }
    }
    const navigated = new Set(run.navigated)
    // A form's code opening another joins their mockups, labelled with what the user does to open it.
    for (const [screenId, from] of mockupOf) {
      const screen = run.facts.get(screenId)?.fact as ScreenFact | undefined
      if (screen?.source !== 'form') continue
      for (const open of screen.opens ?? []) {
        const target = `${screenId.slice(0, screenId.lastIndexOf(':') + 1)}${open.form}`
        const to = mockupOf.get(target)
        if (!to || to === from || navigated.has(`${from}->${to}`)) continue
        const control = screen.controls.find((c) => c.ref === open.via || c.ref.startsWith(`${open.via}(`))
        // Closing, saving or going back to the form that opens this one is no navigation.
        const opener = (run.facts.get(target)?.fact as ScreenFact | undefined)?.opens?.some((o) => o.form.toLowerCase() === screen.route.toLowerCase())
        const BACK = /^(?:cmd|btn|mnu|img|lbl|command)?_?(?:close|back|cancel|exit|return|done|save|quit|salir|cerrar|volver|regresar)/i
        if (opener && (BACK.test(open.via ?? '') || BACK.test((control?.name ?? '').replace(/^[^A-Za-z]+/, '')))) continue
        const name = control ? `"${control.name}"` : open.via ?? 'the form'
        const label = open.key ? `presses a key in ${name}` : `${control?.role === 'menuitem' ? 'chooses' : 'clicks'} ${name}`
        const before = new Set(Object.keys(facade.getRelations()))
        const error = await attempt('add_relation', { sourceId: from, targetId: to, relationType: 'navigates-to', properties: { description: label } }, ctx, facade)
        if (error) { failures.push(`navigates-to from ${screen.route} to ${open.form}: ${error}`); continue }
        navigated.add(`${from}->${to}`)
        written.push({ id: Object.keys(facade.getRelations()).find((rid) => !before.has(rid)) ?? '', key: `${from}->${to}`, kind: 'relation', label, confidence: 'observed', facts: [screenId] })
      }
    }
    // A mockup stands for its page, whichever screen of it a path reached.
    const screenOf = new Map((run.explore?.facts.screens ?? []).map((x) => [x.id, x]))
    const pageAt = (id: string) => pageOf(screenOf.get(id)?.route ?? '')
    const planned = new Set(plan.mockups.map((m) => pageAt(m.screen)))
    for (const path of run.explore?.facts.paths ?? []) {
      // Along the path, from one page that has a mockup to the next that has another: what led there is the step reaching it.
      let at: { mockup: string; page: string } | undefined
      for (const step of path.steps) {
        const to = mockupOf.get(pageAt(step.to))
        if (!to) continue
        const from = at
        at = { mockup: to, page: pageAt(step.to) }
        if (!from || from.mockup === to || navigated.has(`${from.mockup}->${to}`)) continue
        if (!planned.has(from.page) && !planned.has(at.page)) continue
        const before = new Set(Object.keys(facade.getRelations()))
        const error = await attempt('add_relation', { sourceId: from.mockup, targetId: to, relationType: 'navigates-to', properties: { description: stepLabel(step) } }, ctx, facade)
        if (error) { failures.push(`navigates-to for "${path.name}": ${error}`); continue }
        navigated.add(`${from.mockup}->${to}`)
        written.push({ id: Object.keys(facade.getRelations()).find((rid) => !before.has(rid)) ?? '', key: `${from.mockup}->${to}`, kind: 'relation', label: stepLabel(step), confidence: 'observed', facts: [path.id] })
      }
    }
    await this.writeDomain(run, plan, ctx, facade, written, failures)
    // The relations last: they may join any element, mockup or entity of the plan.
    for (const r of plan.relations) {
      const before = new Set(Object.keys(facade.getRelations()))
      const error = await attempt('add_relation', {
        sourceId: r.from, targetId: r.to,
        ...(r.relationType ? { relationType: r.relationType } : {}),
        ...(r.label ? { label: r.label } : {}),
        ...(r.technology ? { technology: r.technology } : {}),
        ...(r.properties && Object.keys(r.properties).length ? { properties: r.properties } : {}),
      }, ctx, facade)
      if (error) { failures.push(`relations ${r.from} → ${r.to}: ${error}`); continue }
      const id = Object.keys(facade.getRelations()).find((rid) => !before.has(rid)) ?? ''
      written.push({ id, key: `${r.from}->${r.to}`, kind: 'relation', label: r.label ?? r.relationType ?? 'relation', confidence: r.confidence, facts: r.facts ?? [], ...(r.citations?.length ? { citations: r.citations } : {}) })
    }
    if (failures.length) return refused(`assay_apply: the plan is refused, nothing was written:\n${failures.map((f) => `- ${f}`).join('\n')}`)

    // Needs and decisions first: a requirement may name a need of the same plan.
    const proposals: Proposal[] = []
    const next = (): string => `P${run.proposals.length + proposals.length + 1}`
    // What a proposal names is kept as named, and found when it is answered.
    const place = (parent?: string) => (parent ? { parent } : {})
    for (const need of plan.needs) proposals.push({ id: next(), kind: 'need', need, ...place(need.parent), status: 'waiting' })
    for (const decision of plan.decisions) proposals.push({ id: next(), kind: 'decision', decision, constrains: decision.constrains ?? [], ...place(decision.parent), status: 'waiting' })
    for (const req of plan.requirements) {
      // Its need: this plan's, else the latest waiting one of that key, else the model's.
      const needProposal = req.need ? (proposals.find((x) => x.kind === 'need' && x.need.key === req.need) ?? [...run.proposals].reverse().find((x) => x.status === 'waiting' && x.kind === 'need' && x.need.key === req.need))?.id : undefined
      proposals.push({ id: next(), kind: 'requirement', requirement: { ...req, scenarios: req.scenarios ?? [] }, ...(req.satisfiedBy ? { satisfiedBy: req.satisfiedBy } : {}), ...(needProposal ? { needProposal } : req.need ? { need: req.need } : {}), ...place(req.parent), status: 'waiting' })
    }
    const nodes = facade.getNodes()
    const label = (id: string) => nodes[ctx.resolveId(id)]?.label ?? id
    // Where each element is built: its units' folders and the folders the plan names.
    const built = new Map<string, Array<{ repository: string; path: string }>>()
    for (const e of plan.elements) {
      const at = [
        ...(e.units ?? []).map((u) => ({ repository: run.facts.get(u)!.repository!, path: (run.facts.get(u)!.fact as Unit).path })),
        ...(e.paths ?? []).map((p) => ({ repository: p.repository, path: cleanPath(p.path) })),
      ]
      if (at.length) built.set(ctx.resolveId(e.key), at)
    }
    const lines = [
      `Wrote ${[
        plural(written.filter((w) => w.kind === 'element').length, 'element'),
        ...(plan.mockups.length ? [plural(written.filter((w) => w.kind === 'mockup').length, 'mockup')] : []),
        ...(plan.entities.length ? [plural(written.filter((w) => w.kind === 'entity').length, 'entity').replace(/entitys$/, 'entities')] : []),
        ...(plan.processes.length ? [`${plural(written.filter((w) => w.kind === 'process').length, 'process').replace(/processs$/, 'processes')} of ${plural(written.filter((w) => w.kind === 'step').length, 'step')}`] : []),
        ...(plan.stateMachines.length ? [`${plural(written.filter((w) => w.kind === 'state-machine').length, 'state machine')} of ${plural(written.filter((w) => w.kind === 'state' && !w.key.endsWith(':initial')).length, 'state')}`] : []),
      ].join(', ')} and ${plural(written.filter((w) => w.kind === 'relation').length, 'relation')} into the central model${plan.processes.length || plan.stateMachines.length ? ' (processes and state machines inferred, as read from the code: no proposal)' : ''}.`,
      ...(this.unrealised.length ? [`No element realises ${this.unrealised.map((x) => `"${x}`).join(', ')}: no unit's code names their tables (a schema file is no use of them), though a stored routine may use them, and no element of the run holds those. Relate the element that holds or uses their data yourself (the database holding those routines, a container calling them), inferred, citing the code or the routine facts, if one does.`] : []),
      ...(written.some((w) => w.basis) ? [`Transitions: ${written.filter((w) => w.basis === 'sets').length} rest on a line of the code that sets their target, ${written.filter((w) => w.basis === 'quoted').length} on a quotation the server could not match to such a line in the state facts${plan.stateMachines.every((m) => !(m.facts ?? []).length) ? ' (the machines cite no state fact: that is expected)' : ''} (marked "quoted" in ${RUN_FILE}: read them again if the quotation does not show the target set).`] : []),
      ...(proposals.length ? ['', `${proposals.length} proposal${proposals.length === 1 ? '' : 's'} for the user, written only when accepted (assay_answer):`, ...proposals.map((p) => this.describe(p, label, run, proposals))] : []),
    ]
    return ok(lines.join('\n'), {
      // Only proposals: nothing of the model changes.
      readOnly: !written.length,
      commit: () => {
        run.written.push(...written)
        run.proposals.push(...proposals)
        run.mockupOf = mockupOf
        run.navigated = navigated
      },
      afterWrite: async () => this.writeFiles(run, { implements: built, verifies: new Map() }, nodes),
    })
  }

  /** Writes a plan's entities, processes and state machines into `written`, every failure into `failures`:
   *  entities observed on their tables, joined by the foreign keys checkPlan found and realised by the elements
   *  built from the units whose code names their tables; processes and state machines inferred, as read. */
  private async writeDomain(run: Run, plan: Plan, ctx: ToolRunContext, facade: ModelFacade, written: Written[], failures: string[]): Promise<void> {
    const add = async (args: Record<string, unknown>, what: string, record: Omit<Written, 'id' | 'key'>): Promise<boolean> => {
      const error = await attempt('add_node', args, ctx, facade)
      if (error) { failures.push(`${what}: ${error}`); return false }
      written.push({ id: ctx.resolveId(args.tempId as string), key: args.tempId as string, ...record, ...(record.citations?.length ? {} : { citations: undefined }) })
      return true
    }
    const relate = async (from: string, to: string, relationType: string, what: string, extra: { label?: string; properties?: Record<string, unknown>; facts?: string[]; citations?: Citation[]; confidence?: Written['confidence']; basis?: Written['basis'] } = {}): Promise<void> => {
      const before = new Set(Object.keys(facade.getRelations()))
      const error = await attempt('add_relation', { sourceId: from, targetId: to, relationType, ...(extra.label ? { label: extra.label } : {}), ...(extra.properties && Object.keys(extra.properties).length ? { properties: extra.properties } : {}) }, ctx, facade)
      if (error) { failures.push(`${what}: ${error}`); return }
      written.push({ id: Object.keys(facade.getRelations()).find((rid) => !before.has(rid)) ?? '', key: `${from}->${to}`, kind: 'relation', label: extra.label ?? relationType, confidence: extra.confidence ?? 'inferred', facts: extra.facts ?? [], ...(extra.citations?.length ? { citations: extra.citations } : {}), ...(extra.basis ? { basis: extra.basis } : {}) })
    }
    const table = (id: string): TableFact | undefined => (run.facts.get(id)?.kind === 'table' ? run.facts.get(id)!.fact as TableFact : undefined)
    /** The containers, components, web applications and databases of the run built from `unit` (or citing the fact). */
    const builtFrom = (unit: string): string[] => [...new Set([...run.written, ...written]
      .filter((w) => w.kind === 'element' && w.facts.includes(unit) && ['container', 'component', 'webapp', 'database'].includes(facade.getNodes()[w.id]?.type ?? ''))
      .map((w) => w.id))]

    for (const e of plan.entities) {
      const tables = e.tables.map(table).filter((t): t is TableFact => !!t)
      // By default, what the code says of it: its table, where it is declared, its columns.
      const description = e.description ?? tables.map((t) => `Table ${t.table}${t.declared ? ` (${t.declared}, ${t.evidence.file}:${t.evidence.line})` : ''}${t.columns?.length ? `: ${t.columns.map((c) => c.name).join(', ')}` : ''}.`).join(' ')
      await add({ tempId: e.key, type: 'entity', label: e.label, ...(e.parent ? { parentId: e.parent } : {}), ...(description ? { description } : {}), properties: { kind: e.kind ?? (e.partOf ? 'entity' : 'aggregate-root') } },
        `entities "${e.key}" (${e.label})`, { kind: 'entity', label: e.label, confidence: 'observed', facts: e.tables })
    }
    const realised = new Set<string>()
    // Entities no element realises, for the answer: no unit's code names their tables.
    this.unrealised = []
    for (const e of plan.entities) {
      // Only a foreign key joins two entities (checkPlan): the tables that hold it are the evidence.
      if (e.partOf) await relate(e.key, e.partOf, 'part-of', `entities "${e.key}" part of ${e.partOf}`, { confidence: 'observed', facts: e.tables })
      for (const r of e.references ?? []) {
        await relate(e.key, r.to, 'references', `entities "${e.key}" references ${r.to}`, { confidence: 'observed', facts: e.tables, properties: { cardinality: r.cardinality ?? 'one', ...(r.description ? { description: r.description } : {}) } })
      }
      // Every element built from a unit whose code names one of its tables realises it.
      const names = new Set(e.tables.map((id) => tableName(table(id)?.table ?? '')))
      // A schema file alone names it nowhere a unit uses it.
      const named = [...run.facts.values()].filter((f) => f.kind === 'table' && (f.fact as TableFact).inCode && names.has(tableName((f.fact as TableFact).table))).map((f) => f.fact as TableFact)
      // The stored routines that write its tables hold its data: the elements holding them (a package's component, else
      // the database built from their unit) realise it, beside a unit's code naming it. Where no unit's code names it,
      // the routines that only read it say where it is used too.
      const coded = named.some((t) => builtFrom(t.unit).length)
      const routines = [...run.facts.values()].filter((f) => f.kind === 'routine').map((f) => f.fact as RoutineFact)
        .filter((r) => [...(r.writes ?? []), ...(coded ? [] : r.reads ?? [])].some((t) => names.has(tableName(t))))
      const holders = new Map<string, string[]>()
      for (const r of routines) {
        // A package's member is held by the element citing the package.
        const pkg = r.name.includes('.') ? `${r.id.slice(0, r.id.length - r.name.length)}${r.name.split('.')[0]}` : undefined
        const held = [...builtFrom(r.id), ...(pkg ? builtFrom(pkg) : [])]
        for (const element of held.length ? held : r.unit ? builtFrom(r.unit) : []) holders.set(element, [...(holders.get(element) ?? []), r.id])
      }
      for (const [element, ids] of holders) {
        if (realised.has(`${element}->${e.key}`)) continue
        realised.add(`${element}->${e.key}`)
        await relate(element, e.key, 'realises', `${facade.getNodes()[element]?.label} realises "${e.label}"`, { confidence: 'observed', facts: ids })
      }
      if (!coded && !holders.size) {
        const used = [...new Set(routines.map((r) => r.name))]
        this.unrealised.push(used.length ? `${e.label}" (its tables used by the stored routines ${used.slice(0, 6).join(', ')}${used.length > 6 ? ', …' : ''})` : `${e.label}"`)
      }
      for (const unit of new Set(named.map((t) => t.unit))) {
        for (const element of builtFrom(unit)) {
          if (realised.has(`${element}->${e.key}`)) continue
          realised.add(`${element}->${e.key}`)
          await relate(element, e.key, 'realises', `${facade.getNodes()[element]?.label} realises "${e.label}"`, { confidence: 'observed', facts: named.filter((t) => t.unit === unit).map((t) => t.id) })
        }
      }
    }

    const steps = async (list: PlanStep[], parent: string, what: string): Promise<void> => {
      for (const [i, st] of list.entries()) {
        const props = { order: i + 1, ...(st.repeat ? { repeat: st.repeat } : {}), ...(st.condition ? { condition: st.condition } : {}), ...(st.children ? { children: st.children } : {}) }
        if (!await add({ tempId: st.key, type: 'step', label: st.label, parentId: parent, ...(st.description ? { description: st.description } : {}), properties: props },
          `${what}, step "${st.key}" (${st.label})`, { kind: 'step', label: st.label, confidence: 'inferred', facts: st.facts ?? [], citations: st.citations })) continue
        if (st.performedBy) await relate(st.key, st.performedBy, 'performed-by', `step "${st.key}" performed by ${st.performedBy}`, { facts: st.facts })
        for (const m of st.mockups ?? []) await relate(m, st.key, 'illustrates', `mockup ${m} illustrates step "${st.key}"`, { facts: st.facts })
        if (st.steps?.length) await steps(st.steps, st.key, what)
      }
    }
    for (const p of plan.processes) {
      // After the processes beside it.
      const parent = p.parent ? ctx.resolveId(p.parent) : undefined
      const order = Object.values(facade.getNodes()).filter((n) => n.type === 'process' && (n.parentId ?? undefined) === parent).length + 1
      if (!await add({ tempId: p.key, type: 'process', label: p.label, ...(p.parent ? { parentId: p.parent } : {}), ...(p.description ? { description: p.description } : {}), properties: { order, ...(p.children ? { children: p.children } : {}) } },
        `processes "${p.key}" (${p.label})`, { kind: 'process', label: p.label, confidence: 'inferred', facts: p.facts ?? [], citations: p.citations })) continue
      await steps(p.steps, p.key, `processes "${p.key}"`)
    }

    for (const m of plan.stateMachines) {
      // In its entity's domain unless the plan says otherwise.
      const parent = m.parent ?? plan.entities.find((e) => e.key === m.entity)?.parent ?? facade.getNodes()[ctx.resolveId(m.entity)]?.parentId ?? undefined
      const stateFacts = (m.facts ?? []).map((id) => run.facts.get(id)).filter((f) => f?.kind === 'state').map((f) => f!.fact as StateFact)
      if (!await add({ tempId: m.key, type: 'state-machine', label: m.label, ...(parent ? { parentId: parent } : {}), ...(m.description ? { description: m.description } : {}) },
        `stateMachines "${m.key}" (${m.label})`, { kind: 'state-machine', label: m.label, confidence: 'inferred', facts: m.facts ?? [], citations: m.citations })) continue
      const start = `${m.key}:initial`
      await add({ tempId: start, type: 'pseudostate', label: 'Start', parentId: m.key, properties: { kind: 'initial' } }, `stateMachines "${m.key}", its start`, { kind: 'state', label: 'Start', confidence: 'inferred', facts: [] })
      for (const st of m.states) {
        await add({ tempId: st.key, type: 'state', label: st.label, parentId: m.key, ...(st.description ? { description: st.description } : {}), properties: { kind: st.kind ?? 'normal' } },
          `stateMachines "${m.key}", state "${st.key}" (${st.label})`, { kind: 'state', label: st.label, confidence: 'inferred', facts: st.citations?.length ? [] : m.facts ?? [], citations: st.citations })
      }
      // One event per name, inside the machine.
      const events = new Map<string, string>()
      for (const t of m.transitions) {
        if (!t.event || events.has(t.event)) continue
        const key = `${m.key}:event:${events.size + 1}`
        if (await add({ tempId: key, type: 'event', label: t.event, parentId: m.key }, `stateMachines "${m.key}", event "${t.event}"`, { kind: 'event', label: t.event, confidence: 'inferred', facts: [] })) events.set(t.event, key)
      }
      await relate(start, m.initial, 'transition', `stateMachines "${m.key}", its start`, { facts: m.facts })
      const valueOf = (k: string): string => stateName(((st) => st?.value ?? st?.label ?? '')(m.states.find((x) => x.key === k)))
      for (const t of m.transitions) {
        // The state facts whose lines set its target back it, beside what it cites.
        const sets = stateFacts.filter((f) => f.sets.some((x) => stateName(x.value) === valueOf(t.to))).map((f) => f.id)
        const properties = { ...(t.event && events.has(t.event) ? { event: events.get(t.event) } : {}), ...(t.guard ? { guard: t.guard } : {}), ...(t.actions ? { actions: t.actions } : {}) }
        // What backs it, kept apart in the evidence: a line that sets its target, or a quotation alone.
        await relate(t.from, t.to, 'transition', `stateMachines "${m.key}", transition ${t.from} → ${t.to}`, { ...(t.event ? { label: t.event } : {}), properties, facts: [...new Set([...(t.facts ?? []), ...sets])], citations: t.citations, basis: sets.length ? 'sets' : 'quoted' })
      }
      await relate(m.key, m.entity, 'lifecycle-of', `stateMachines "${m.key}" lifecycle of ${m.entity}`, { facts: m.facts })
      // What runs it: the elements built from the units whose code sets its values; none when no code does.
      const units = stateFacts.flatMap((f) => f.sets.map((x) => x.unit))
      for (const element of m.implementedBy ?? [...new Set(units.flatMap(builtFrom))]) {
        await relate(element, m.key, 'implements', `${facade.getNodes()[ctx.resolveId(element)]?.label ?? element} implements "${m.label}"`, { facts: m.facts })
      }
    }
  }

  /** A proposal as the user is to see it; what it names by the model's labels, or by the proposals still waiting. */
  private describe(p: Proposal, named: (id: string) => string, run: Run, pending: Proposal[] = []): string {
    const label = (ref: string): string => {
      const shown = named(ref)
      if (shown !== ref) return shown
      const waiting = [...run.proposals, ...pending].filter((x) => x.status === 'waiting' && keyOf(x) === ref).pop()
      return waiting ? `${waiting.id} "${labelOf(waiting)}"` : ref
    }
    const quoted = (citations?: Citation[]) => (citations ?? []).map((c) => `    from ${c.repository}/${c.file}:${c.lines[0]}${c.lines[1] !== c.lines[0] ? `-${c.lines[1]}` : ''}: "${(([t]) => (t.length > 160 ? `${t.slice(0, 159)}…` : t))([c.text.replace(/\s+/g, ' ')])}"`)
    if (p.kind === 'need') return [`- ${p.id}: need "${p.need.label}": ${p.need.description}`, ...quoted(p.need.citations)].join('\n')
    if (p.kind === 'decision') {
      const d = p.decision.properties as Record<string, string | undefined>
      return [
        `- ${p.id}: decision (ADR) "${p.decision.label}"${d.status ? `, ${d.status}` : ''}${p.constrains.length ? `, constrains ${p.constrains.map(label).join(', ')}` : ''}: ${d.decision}`,
        ...(d.context ? [`    context: ${d.context}`] : []),
        ...(d.consequences ? [`    consequences: ${d.consequences}`] : []),
        ...quoted(p.decision.citations),
      ].join('\n')
    }
    const r = p.requirement
    const props = r.properties as Record<string, string | undefined>
    // A clause given with its own keyword (When the customer …) is not given it twice.
    const bare = (text: string | undefined, keyword: RegExp) => text?.replace(keyword, '')
    const ears = [
      props.feature && `Where ${bare(props.feature, /^where\s+/i)},`,
      props.precondition && `while ${bare(props.precondition, /^while\s+/i)},`,
      props.trigger && `when ${bare(props.trigger, /^when\s+/i)},`,
      props.unwanted_condition && `if ${bare(props.unwanted_condition, /^if\s+/i)}, then`,
      // After a clause, "The game server shall …" reads "the game server shall …".
      props.action && (props.feature || props.precondition || props.trigger || props.unwanted_condition) ? props.action.replace(/^The\b/, 'the') : props.action,
    ].filter(Boolean).join(' ')
    const need = p.needProposal ?? (p.need ? label(p.need) : undefined)
    return [
      `- ${p.id}: requirement "${r.label}" (${props.ears_type ?? 'ubiquitous'}), ${p.satisfiedBy ? `satisfied by ${label(p.satisfiedBy)}` : 'satisfied by nothing yet'}${r.processes?.length ? ` and the process${r.processes.length === 1 ? '' : 'es'} ${r.processes.map(label).join(', ')}` : ''}${need ? `, derived from ${need}` : ''}: ${ears}`,
      ...(props.rationale ? [`    rationale: ${props.rationale}`] : []),
      ...r.scenarios.map((s) => `    scenario "${s.label}": given ${s.given}, when ${s.when}, then ${s.then}${s.tests?.length ? `; tests: ${s.tests.map((t) => (run.facts.get(t)?.fact as TestFact | undefined)?.test ?? t).join('; ')}` : ''}${s.paths?.length ? `; explored paths, each written as a Playwright test when accepted: ${s.paths.map((x) => `"${(run.facts.get(x)?.fact as PathFact | undefined)?.name ?? x}"`).join(', ')}` : ''}${!s.tests?.length && !s.paths?.length && s.citations?.length ? `; drawn from the code (${s.citations.map((c) => `${c.repository}/${c.file}:${c.lines[0]}`).join(', ')}): no test checks it; ${this.pendingTestNote(run, p.satisfiedBy, pending)}` : ''}`),
      ...(r.scenarios.length ? [] : ['    no scenario: it rests on what it cites (code, screens or documents), not on tests that pass']),
      ...quoted(r.citations),
    ].join('\n')
  }

  private async answer(run: Run, input: unknown, ctx: ToolRunContext, facade: ModelFacade): Promise<AssayResult> {
    const { proposal, accept, changes } = (input ?? {}) as { proposal?: unknown; accept?: unknown; changes?: { label?: unknown; properties?: unknown; description?: unknown; need?: unknown; parent?: unknown } }
    const p = run.proposals.find((x) => x.id === proposal)
    if (!p) return refused(`assay_answer: no proposal ${String(proposal)}; the waiting ones: ${run.proposals.filter((x) => x.status === 'waiting').map((x) => x.id).join(', ') || 'none'}`)
    if (p.status !== 'waiting') return refused(`assay_answer: ${p.id} was ${p.status} already`)
    if (typeof accept !== 'boolean') return refused('assay_answer: accept must be true or false')
    if (!accept) return ok(`${p.id} left out: nothing of it was written.`, { readOnly: true, commit: () => { p.status = 'rejected' } })

    const nodes = facade.getNodes()
    const failures: string[] = []
    const step = async (tool: string, args: Record<string, unknown>, what: string): Promise<boolean> => {
      const error = await attempt(tool, args, ctx, facade)
      if (error) { failures.push(`${what}: ${error}`); return false }
      return true
    }
    const written: Written[] = []
    const original = p.kind === 'requirement' ? p.requirement : p.kind === 'need' ? p.need : p.decision
    const label = typeof changes?.label === 'string' && changes.label.trim() ? changes.label.trim() : original.label
    const given = (original as { properties?: Record<string, unknown> }).properties ?? {}
    const properties = changes?.properties && typeof changes.properties === 'object' ? { ...given, ...(changes.properties as Record<string, unknown>) } : given
    const accepted = (changed: boolean): Written['accepted'] => (label !== original.label || changed || JSON.stringify(properties) !== JSON.stringify(given) ? 'changed' : 'as-proposed')
    // What it names, found now: a proposal it names must have been accepted.
    const where = (ref: string): string | { problem: string } => {
      const id = ctx.resolveId(ref)
      if (nodes[id]) return id
      const waiting = [...run.proposals].reverse().find((x) => x.status === 'waiting' && x !== p && (keyOf(x) === ref || (x.kind === 'requirement' && x.requirement.scenarios.some((sc) => sc.key === ref))))
      return { problem: waiting ? `it names ${waiting.id} ("${labelOf(waiting)}"); answer ${waiting.id} first` : `it names ${ref}, which is not in the model` }
    }
    const found = (ref: string | undefined): string | undefined | { problem: string } => (ref === undefined ? undefined : where(ref))
    const parentOf = found(typeof changes?.parent === 'string' ? changes.parent : p.parent)
    if (typeof parentOf === 'object') return refused(`assay_answer: ${p.id}: its place: ${parentOf.problem}`)
    const placed = parentOf ? { parentId: parentOf } : {}

    if (p.kind === 'need') {
      const description = typeof changes?.description === 'string' && changes.description.trim() ? changes.description.trim() : p.need.description
      const props = { kind: 'other', source: `Radical Assay, ${new Date().toISOString().slice(0, 10)}`, ...properties }
      if (await step('add_node', { tempId: p.need.key, type: 'need', label, description, properties: props, ...placed }, `need "${label}"`)) {
        written.push({ id: ctx.resolveId(p.need.key), key: p.need.key, kind: 'need', label, confidence: 'hypothesis', facts: p.need.facts ?? [], ...(p.need.citations?.length ? { citations: p.need.citations } : {}), accepted: accepted(description !== p.need.description) })
      }
    } else if (p.kind === 'decision') {
      const targets: string[] = []
      for (const ref of p.constrains) {
        const target = where(ref)
        if (typeof target === 'object') return refused(`assay_answer: ${p.id} constrains ${ref}: ${target.problem}`)
        targets.push(target)
      }
      const props = { status: 'proposed', ...properties }
      if (await step('add_node', { tempId: p.decision.key, type: 'adr', label, properties: props, ...placed }, `decision "${label}"`)) {
        written.push({ id: ctx.resolveId(p.decision.key), key: p.decision.key, kind: 'decision', label, confidence: 'hypothesis', facts: p.decision.facts ?? [], ...(p.decision.citations?.length ? { citations: p.decision.citations } : {}), accepted: accepted(false) })
        for (const target of targets) await step('add_relation', { sourceId: p.decision.key, targetId: target, relationType: 'constrains' }, `it constrains ${nodes[target].label}`)
      }
    } else {
      const satisfiedBy = p.satisfiedBy === undefined ? undefined : where(p.satisfiedBy)
      if (typeof satisfiedBy === 'object') return refused(`assay_answer: ${p.id}'s element: ${satisfiedBy.problem}`)
      // Its need: a proposal of the run (answered first), a need of the model, else the run's need Found in the code.
      let needId: string | undefined
      let note = ''
      // The user may name its need: a need of the model, or a need proposal of the run (P3).
      const named = typeof changes?.need === 'string' ? changes.need : undefined
      const asked = named ? run.proposals.find((x) => x.id === named && x.kind === 'need') : undefined
      if (named && !asked) {
        const need = where(named)
        if (typeof need === 'object') return refused(`assay_answer: ${p.id}'s need: ${need.problem}`)
        if (nodes[need]?.type !== 'need') return refused(`assay_answer: ${p.id}'s need: ${named} is no need`)
        needId = need
      } else if (asked || p.needProposal) {
        const from = asked ?? run.proposals.find((x) => x.id === p.needProposal)!
        if (from.status === 'waiting') return refused(`assay_answer: ${p.id} derives from ${from.id} ("${labelOf(from)}"); answer ${from.id} first`)
        if (from.status === 'accepted') needId = from.written
        else note = ` Its need ${from.id} was left out, so it derives from the run's need Found in the code.`
      } else if (p.need) {
        const need = where(p.need)
        if (typeof need === 'object') return refused(`assay_answer: ${p.id}'s need: ${need.problem}`)
        needId = need
      }
      // Its place: the one asked for, else the system that holds its element (else the root).
      let parent = parentOf as string | undefined
      if (!parent) for (let at: string | undefined = satisfiedBy as string | undefined; at; at = nodes[at]?.parentId) if (nodes[at]?.type === 'system') { parent = at; break }
      const r = p.requirement
      let foundNeed: string | undefined
      if (!needId) {
        needId = run.needId && nodes[run.needId] ? run.needId : undefined
        if (!needId) {
          const names = run.repositories.map((x) => x.repository).join(', ')
          const needKey = `assay-need-${Date.now()}`
          if (await step('add_node', {
            // At the root: a run's requirements may be of several systems.
            tempId: needKey, type: 'need', label: 'Found in the code',
            description: `Requirements Radical Assay found in the code and tests of ${names}, each accepted by the user one by one. The tests and code each rests on are in ${RUN_FILE}.`,
            properties: { kind: 'other', source: `Radical Assay, ${new Date().toISOString().slice(0, 10)}` },
          }, 'the need')) {
            needId = foundNeed = ctx.resolveId(needKey)
            written.push({ id: needId, key: 'need', kind: 'need', label: 'Found in the code', confidence: 'hypothesis', facts: [] })
          }
        }
      }
      if (await step('add_node', { tempId: r.key, type: 'requirement', label, properties, ...(parent ? { parentId: parent } : {}) }, `requirement "${label}"`)) {
        const facts = [...new Set([...(r.facts ?? []), ...r.scenarios.flatMap((s) => [...(s.tests ?? []), ...(s.paths ?? [])])])]
        written.push({ id: ctx.resolveId(r.key), key: r.key, kind: 'requirement', label, confidence: 'hypothesis', facts, ...(r.citations?.length ? { citations: r.citations } : {}), accepted: accepted(false) })
        if (needId) await step('add_relation', { sourceId: r.key, targetId: needId, relationType: 'derives' }, 'derives from its need')
        if (satisfiedBy) await step('add_relation', { sourceId: satisfiedBy, targetId: r.key, relationType: 'satisfies' }, `${nodes[satisfiedBy].label} satisfies it`)
        // The processes that meet it, as the plan named them.
        for (const ref of r.processes ?? []) {
          const process = where(ref)
          if (typeof process === 'object') { failures.push(`its process: ${process.problem}`); continue }
          if (await step('add_relation', { sourceId: process, targetId: r.key, relationType: 'satisfies' }, `process ${nodes[process]?.label ?? ref} satisfies it`)) {
            written.push({ id: Object.values(facade.getRelations()).find((x) => x.sourceId === process && x.targetId === ctx.resolveId(r.key))?.id ?? '', key: `${ref}->${r.key}`, kind: 'relation', label: 'satisfies', confidence: 'inferred', facts: [] })
          }
        }
        for (const sc of r.scenarios) {
          if (!await step('add_node', { tempId: sc.key, type: 'scenario', label: sc.label, properties: { given: sc.given, when: sc.when, then: sc.then }, ...(parent ? { parentId: parent } : {}) }, `scenario "${sc.label}"`)) continue
          written.push({ id: ctx.resolveId(sc.key), key: sc.key, kind: 'scenario', label: sc.label, confidence: 'hypothesis', facts: [...(sc.tests ?? []), ...(sc.paths ?? [])], ...(sc.citations?.length ? { citations: sc.citations } : {}) })
          await step('add_relation', { sourceId: sc.key, targetId: r.key, relationType: 'verifies' }, `scenario "${sc.label}" verifies it`)
        }
      }
      if (failures.length) return refused(`assay_answer: ${p.id} could not be written, nothing was:\n${failures.map((f) => `- ${f}`).join('\n')}`)
      const verifies = new Map(r.scenarios.map((sc) => [ctx.resolveId(sc.key), sc.tests ?? []]))
      // An explored path becomes a test of the repository that builds the application.
      const pathTests = r.scenarios.flatMap((sc) => (sc.paths ?? []).map((id) => ({ scenario: ctx.resolveId(sc.key), path: run.facts.get(id)!.fact as PathFact })))
      // A scenario drawn from the code gets a pending test, where the unit that builds its element has a test framework.
      const fromCode = r.scenarios.filter((sc) => !sc.tests?.length && !sc.paths?.length && sc.citations?.length)
      const pending = fromCode.length ? this.skeletonFor(run, satisfiedBy as string | undefined, label, fromCode.map((sc) => ({ ...sc, id: ctx.resolveId(sc.key) }))) : undefined
      if (pending && 'note' in pending) note += ` ${pending.note}`
      const after = facade.getNodes()
      return ok(`${p.id} added: requirement "${label}" (${ctx.resolveId(r.key)}) with ${r.scenarios.length} scenario${r.scenarios.length === 1 ? '' : 's'}${parent ? ` in ${after[parent]?.label}` : ''}.${note}`, {
        commit: () => {
          p.status = 'accepted'
          p.written = ctx.resolveId(r.key)
          run.written.push(...written)
          if (foundNeed) run.needId = foundNeed
        },
        afterWrite: async () => this.writeFiles(run, { implements: new Map(), verifies, pathTests, ...(pending && 'file' in pending ? { skeletons: [pending] } : {}) }, after),
      })
    }
    if (failures.length) return refused(`assay_answer: ${p.id} could not be written, nothing was:\n${failures.map((f) => `- ${f}`).join('\n')}`)
    const after = facade.getNodes()
    const id = ctx.resolveId(keyOf(p))
    return ok(`${p.id} added: ${p.kind === 'need' ? 'need' : 'decision (ADR)'} "${label}" (${id})${parentOf ? ` in ${after[parentOf as string]?.label}` : ''}; later plans name it by this id or by its key.`, {
      commit: () => {
        p.status = 'accepted'
        p.written = id
        run.written.push(...written)
      },
      afterWrite: async () => this.writeFiles(run, { implements: new Map(), verifies: new Map() }, after),
    })
  }

  /** What becomes of a scenario drawn from the code, as a proposal says it: its element named by a key or an id. */
  private pendingTestNote(run: Run, element: string | undefined, pending: Proposal[]): string {
    const built = element ? run.written.find((w) => w.id === element || w.key === element) : undefined
    const unitId = built && unitOfWritten(run, built)
    if (built && !unitId) return `${built.label} is built from no unit of this run: accepted, the scenario only`
    if (!unitId || pending.some((x) => x.kind === 'requirement' && x.requirement.key === element)) return 'a pending test is written when accepted, where its unit has a test framework'
    const unit = run.facts.get(unitId)!.fact as Unit
    const repository = run.repositories.find((r) => r.repository === run.facts.get(unitId)!.repository)
    const tester = repository && testUnitFor(unit, repository)
    return tester?.testFramework ? `accepted, a pending ${tester.testFramework} test of it is written into ${repository!.repository}` : `${unit.name} (${unit.stack}) has no test framework Assay writes tests for: accepted, the scenario only`
  }

  /** The pending test of the scenarios drawn from the code, for the unit that builds `element`; or why there is none. */
  private skeletonFor(run: Run, element: string | undefined, requirement: string, scenarios: Array<{ id: string; label: string; given: string; when: string; then: string; citations?: Citation[] }>): ({ repository: string; scenarios: string[] } & Skeleton) | { note: string } {
    const none = (why: string) => ({ note: `Its scenario${scenarios.length === 1 ? '' : 's'} from the code ${scenarios.length === 1 ? 'has' : 'have'} no pending test: ${why}.` })
    const built = element ? run.written.find((w) => w.id === element) : undefined
    const unitId = built && unitOfWritten(run, built)
    if (!element) return none('nothing satisfies it yet')
    if (!unitId) return none('the element that satisfies it is built from no unit of this run')
    const unit = run.facts.get(unitId)!.fact as Unit
    const repository = run.repositories.find((r) => r.repository === run.facts.get(unitId)!.repository)
    if (!repository) return none(`${unitId} is in no code repository of the run`)
    const tester = testUnitFor(unit, repository)
    if (!tester?.testFramework) return none(`${unit.name} (${unit.stack}) has no test framework Assay writes tests for`)
    const from = (c: Citation) => `${c.file}:${c.lines[0]}${c.lines[1] !== c.lines[0] ? `-${c.lines[1]}` : ''}`
    const skeleton = testSkeleton(tester, tester.testFramework, requirement, scenarios.map((sc) => ({ label: sc.label, given: sc.given, when: sc.when, then: sc.then, ...(sc.citations?.length ? { from: sc.citations.map(from).join(', ') } : {}) })), new Date().toISOString().slice(0, 10))
    return { repository: repository.repository, scenarios: scenarios.map((sc) => sc.id), ...skeleton }
  }

  /** Writes the files beside the model and says what it wrote; never
   *  throws, so a write the model already has is never reported as refused. */
  private async writeFiles(run: Run, map: FileChanges, nodes: Record<string, { label: string }>): Promise<string> {
    try {
      return await this.writeMapping(run, map, nodes)
    } catch (error) {
      return `\nFiles not written: ${(error as Error).message}. The model has what the call wrote.`
    }
  }

  /** Writes the code repositories' .radical/radical.json entries and the
   *  central repository's run file; says what it wrote. */
  private async writeMapping(run: Run, map: FileChanges, nodes: Record<string, { label: string }>): Promise<string> {
    const byRepo = new Map<string, { implements: Map<string, string[]>; verifies: Map<string, string[]> }>()
    const entry = (repo: string) => byRepo.get(repo) ?? byRepo.set(repo, { implements: new Map(), verifies: new Map() }).get(repo)!
    for (const [id, places] of map.implements) {
      for (const { repository, path } of places) {
        const paths = entry(repository).implements
        paths.set(id, [...new Set([...(paths.get(id) ?? []), path])])
      }
    }
    for (const [id, tests] of map.verifies) {
      for (const t of tests) {
        const f = run.facts.get(t)
        if (!f?.repository) continue
        const list = entry(f.repository).verifies
        list.set(id, [...new Set([...(list.get(id) ?? []), (f.fact as TestFact).test])])
      }
    }
    const notes: string[] = []
    // An explored path's test goes into e2e/assay/ of the repository that builds the application, and nowhere else.
    const screens = new Map((run.explore?.facts.screens ?? []).map((x) => [x.id, x]))
    for (const { scenario, path } of map.pathTests ?? []) {
      const dir = run.repositories.find((r) => r.repository === path.repository)?.dir
      if (!dir || !isRepository(dir)) { notes.push(`${path.repository} is no git repository: the test of "${path.name}" is not written`); continue }
      const file = join(dir, pathTestFile(path))
      if (!within(join(dir, 'e2e', 'assay'), file)) { notes.push(`the test of "${path.name}" would land outside e2e/assay/: not written`); continue }
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, pathTest(path, screens, new Date().toISOString().slice(0, 10)))
      // A config beside the tests, so they run as they are: npx playwright test -c e2e/assay.
      const config = join(dir, 'e2e', 'assay', 'playwright.config.ts')
      if (!existsSync(config)) await writeFile(config, PLAYWRIGHT_CONFIG)
      notes.push(`${path.repository}/${pathTestFile(path)} (run: npx playwright test -c e2e/assay, with @playwright/test installed, E2E_BASE_URL${path.steps.some((x) => x.secret) ? ' and E2E_PASSWORD' : ''})`)
      run.testsWritten.push(`${path.repository}/${pathTestFile(path)}`)
      const list = entry(path.repository).verifies
      list.set(scenario, [...new Set([...(list.get(scenario) ?? []), pathTestId(path)])])
    }
    // A pending test goes into the repository whose unit has the test framework; one the team has already is kept.
    for (const sk of map.skeletons ?? []) {
      const dir = run.repositories.find((r) => r.repository === sk.repository)?.dir
      if (!dir || !isRepository(dir)) { notes.push(`${sk.repository} is no git repository: the pending test ${sk.file} is not written`); continue }
      const file = join(dir, sk.file)
      if (!within(dir, file)) { notes.push(`${sk.file} would land outside ${sk.repository}: not written`); continue }
      if (existsSync(file)) notes.push(`${sk.repository}/${sk.file} is there already: kept as it is`)
      else {
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, sk.content)
        notes.push(`${sk.repository}/${sk.file} (pending tests: write their bodies)`)
        run.skeletons.push(`${sk.repository}/${sk.file}`)
      }
      const list = entry(sk.repository).verifies
      sk.scenarios.forEach((scenario, i) => list.set(scenario, [...new Set([...(list.get(scenario) ?? []), sk.tests[i]])]))
    }
    for (const [repo, changes] of byRepo) {
      const dir = run.repositories.find((r) => r.repository === repo)?.dir
      if (!dir) { notes.push(`${repo} is no code repository of the run: nothing is mapped in it`); continue }
      // A folder of code, or a .zip file's, is no repository to declare anything.
      if (!isRepository(dir)) { notes.push(`${repo} is no git repository: its ${REPOSITORY_FILE} is not written`); continue }
      const file = join(dir, REPOSITORY_FILE)
      try {
        let repository: RepositoryFile = { implements: [], verifies: [] }
        try { repository = parseRepositoryFile(await readFile(file, 'utf8'), file) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
        for (const [element, paths] of changes.implements) {
          const at = repository.implements.findIndex((m) => m.element === element)
          const next = { element, name: nodes[element]?.label, paths: at < 0 ? paths : [...new Set([...repository.implements[at].paths, ...paths])] }
          if (at < 0) repository.implements.push(next)
          else repository.implements[at] = next
        }
        for (const [element, tests] of changes.verifies) {
          const at = repository.verifies.findIndex((v) => v.element === element)
          const next = { element, name: nodes[element]?.label, tests: at < 0 ? tests : [...new Set([...repository.verifies[at].tests, ...tests])] }
          if (at < 0) repository.verifies.push(next)
          else repository.verifies[at] = next
        }
        // The central model's repository by its address (ADR One system model across repositories): its origin, else its path from here.
        if (dir !== run.root) repository.model = { ...repository.model, repo: centralAddress(run.root) ?? (posix(relative(dir, run.root)) || '.') }
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, serializeRepositoryFile(repository))
        notes.push(`${repo}/${REPOSITORY_FILE}: ${changes.implements.size ? `${changes.implements.size} implemented` : ''}${changes.implements.size && changes.verifies.size ? ', ' : ''}${changes.verifies.size ? `${changes.verifies.size} verified` : ''}`)
      } catch (error) {
        notes.push(`${repo}/${REPOSITORY_FILE} not written: ${(error as Error).message}`)
      }
    }
    try {
      await this.writeRunFile(run)
      notes.push(`evidence in ${RUN_FILE}`)
    } catch (error) {
      notes.push(`${RUN_FILE} not written: ${(error as Error).message}`)
    }
    return notes.length ? `\nFiles: ${notes.join('; ')}.` : ''
  }

  /** The evidence of everything the run wrote, merged by id into what earlier runs left. */
  private async writeRunFile(run: Run): Promise<void> {
    const file = join(run.root, RUN_FILE)
    let earlier: Written[] = []
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8')) as { format?: string; written?: Written[] }
      if (parsed.format === RUN_FORMAT && Array.isArray(parsed.written)) earlier = parsed.written
    } catch {
      // None yet, or unreadable: this run's is written.
    }
    const ids = new Set(run.written.map((w) => w.id))
    const evidence = (id: string) => {
      const f = run.facts.get(id)
      const at = (f?.fact as { evidence?: { file: string; line: number } } | undefined)?.evidence
      return { fact: id, ...(f?.repository ? { repository: f.repository } : {}), ...(at ? { file: at.file, line: at.line } : {}) }
    }
    const out = {
      format: RUN_FORMAT,
      repositories: run.repositories.map((r) => ({ name: r.repository, dir: posix(relative(run.root, r.dir)) || '.', ...(r.commit ? { commit: r.commit } : {}) })),
      ...(run.sources.length ? { sources: run.sources.map((r) => ({ name: r.repository, dir: posix(relative(run.root, r.dir)), origin: r.origin })) } : {}),
      written: [...earlier.filter((w) => !ids.has(w.id)), ...run.written.map(({ citations, ...w }) => ({
        ...w,
        evidence: [
          ...w.facts.map(evidence),
          ...(citations ?? []).map((c) => ({ quote: c.text, repository: c.repository, file: c.file, line: c.lines[0], lines: c.lines })),
        ],
      }))],
    }
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, `${JSON.stringify(out, null, 2)}\n`)
  }

  private summary(run: Run): string {
    const count = (kind: Written['kind']) => run.written.filter((w) => w.kind === kind).length
    const waiting = run.proposals.filter((p) => p.status === 'waiting')
    return [
      `Assay run on ${run.repositories.map((r) => r.repository).join(', ')}${run.sources.length ? ` with ${run.sources.length} source${run.sources.length === 1 ? '' : 's'} of documents (${run.sources.map((r) => r.repository).join(', ')})` : ''}: wrote ${count('element')} elements and ${count('relation')} relations between them, ${count('requirement')} requirements, ${count('scenario')} scenarios, ${run.written.filter((w) => w.kind === 'need' && w.key !== 'need').length} needs from documents${run.needId ? ' and the need Found in the code' : ''} and ${count('decision')} decisions into ${run.modelPath}; each requirement, scenario, need and decision with its own relations (satisfies, verifies, derives, constrains).`,
      ...(count('mockup') && !run.explore ? [`Mockups: ${count('mockup')}, from the forms.`] : []),
      ...(['entity', 'process', 'state-machine'].some((k) => count(k as Written['kind'])) ? [`Domain: ${plural(count('entity'), 'entity').replace(/entitys$/, 'entities')}; ${plural(count('process'), 'process').replace(/processs$/, 'processes')} of ${plural(count('step'), 'step')} and ${plural(count('state-machine'), 'state machine')}, inferred.`] : []),
      ...(run.skeletons.length ? [`Pending tests written for scenarios drawn from the code: ${[...new Set(run.skeletons)].join(', ')}.`] : []),
      ...(run.explore ? [`Explored: ${run.explore.facts.paths.length} paths, ${run.explore.facts.screens.length} screens; ${run.written.filter((w) => w.kind === 'mockup').length} mockups written${run.testsWritten.length ? `, Playwright tests written: ${[...new Set(run.testsWritten)].join(', ')}` : ''}.`] : []),
      `Proposals: ${run.proposals.filter((p) => p.status === 'accepted').length} accepted, ${run.proposals.filter((p) => p.status === 'rejected').length} left out, ${waiting.length} waiting${waiting.length ? ` (${waiting.map((p) => `${p.id} "${labelOf(p)}"`).join(', ')})` : ''}.`,
      `Evidence: ${RUN_FILE}; facts: ${FACTS_FILE} in each repository; mapping: ${REPOSITORY_FILE} in each repository Assay wrote to.`,
    ].join('\n')
  }
}
