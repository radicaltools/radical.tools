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
// agent draws from them are proposals too. assay_read gives the agent the
// lines of any file of the run, so an agent with no files of its own cites.
//
// One run per server; assay_start begins a new one. The run lives in memory;
// what it wrote stays in the model and the files.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import {
  FACTS_FILE, FACT_LISTS, FOLDER_FACTS_DIR, SOURCES_DIR, UNPACKED_DIR, checkPlan, cleanPath, decodeText, factsFileOf, describeFacts, describeSources, extractRepository, factIndex, ignored, inside,
  GIT, isRepository, linkRepositories, parsePlan, SKIPPED, within, repositoriesIn, serializeFacts, sourceOrigin, takeSources,
  emptyFacts, pageOf, pathTest, pathTestFile, pathTestId, stepLabel,
  type Citation, type FactIndex, type Link, type PathFact, type PlanDecision, type PlanNeed, type PlanRequirement, type RepositoryFacts, type ScreenFact, type TestFact, type Unit,
} from '@radical/assay'
import { Explorer, type ExploreAction } from './explore'
import { runTool, type ToolDef, type ToolResult, type ToolRunContext } from '@radical/common/ai/tools'
import type { ModelFacade } from '@radical/common/ai/modelFacade'
import { REPOSITORY_FILE, parseRepositoryFile, serializeRepositoryFile, type RepositoryFile } from '@radical/common/repositoryMapping'

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

/** The whole flow, for assay_start's answer and the `assay` prompt. */
export const ASSAY_PROCEDURE = [
  'Radical Assay finds the model in existing code, new or old (npm, Maven, Gradle, Go, .NET, Python, VB6, Dockerfiles; docker-compose,',
  'Kubernetes, Aspire; OpenAPI, gRPC; connection strings and SQL): C4 elements from the repositories\' units and the links between them,',
  'the needs and decisions its documents state, then requirements with the scenarios that verify them from the tests, and those the',
  'documents state that no test checks. This server\'s model folder is the central model; the code is in local directories',
  '(repositories already cloned, folders, .zip files), the documentation in folders, .zip files or public links.',
  '1. (Done when you read this in assay_start\'s answer: go on with step 2.) Ask the user for the code repositories\' directories (a directory that holds several repositories stands for each of them;',
  '   a folder of code with no .git, or a .zip file of code, is one too) and, when their test reports are not in each',
  '   repository\'s reports/, where they are. Ask also for documentation: folders, .zip files or public links (pages behind a',
  '   login: the user exports them, as PDF, HTML or Markdown, into a folder or a .zip). Then assay_start with directories and',
  '   sources; more documentation can come later with assay_add_sources.',
  '2. C4 stage. Read what assay_start lists: per repository its units (stack, app, library or tests), the services its',
  '   deployment runs (docker-compose, Kubernetes, Aspire), its databases, its groups (a .sln, a VB6 .vbg), then the links',
  '   (package and project references, http, gRPC, addresses, depends_on, data). assay_facts gives a repository\'s or a',
  '   unit\'s details; assay_read lists a folder\'s files and reads a file\'s lines. search_model for what the central model',
  '   already holds; get_model_summary for the types it allows. Propose to the user how the units group into software',
  '   systems (a group, a deployment, a product name or the documents hint at it; one system unless the code or the',
  '   documents show more, or the user says otherwise; a system may cite the document lines that name it), and wait for',
  '   the answer. Then make one plan: a system per group; a container (a webapp for a browser front end) per app unit; per',
  '   library unit a component: inside the container that uses it, or, when several use it, inside a group of the system',
  '   (named, say, "Shared libraries"), with a relation from it to each container that bundles it labelled "bundled into"',
  '   (code built in, not a call at run time; the package link backs it either way); a database element per database fact',
  '   or database service, a queue per queue',
  '   service, a cache as a database; units of kind tests are no elements. Services of role observability (tracing,',
  '   metrics, logs) stay out unless the user wants them. People (person elements) only where the documents name them,',
  '   inferred, citing the lines. Relations of type interacts from the links, directed from the caller to what it calls,',
  '   labelled with what one does with the other (follow the model\'s own direction where it already has relations); a',
  '   data link\'s via names the deployed service the database runs on (with no via, relate to the database only). The',
  '   System context view shows systems and people only: relate each person to the system they use, and a system to',
  '   another where a link crosses them, inferred, citing those links. What the documents name but no code shows (a',
  '   database, a service) is no element: tell the user, and let a decision or requirement say so. A group is inferred.',
  '   Reuse elements the model has, by id, instead of adding them again. Every element and relation cites the facts it',
  '   rests on (facts) and is observed when a',
  '   fact states it (a unit, an API, a service, a database, a dependency, an observed link) or inferred when concluded',
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
  '   application keeps; one path per task, starting each with assay_explore. Each path starts signed out in a fresh',
  '   session, as its test will: a path behind the sign-in signs in first. Fill forms with plausible test data. Another',
  '   host and controls that pay or delete an account are refused: leave them. Then one plan: a mockup per page that',
  '   matters (a page is a route with its numbers as {id}: /orders/1 and /orders/2 are one page; mockups: label as a user',
  '   would call it, screen: one of its screens, description from the screen\'s text, presentedBy the webapp that renders',
  '   it, parent its system); the server joins the pages in the order of each path with navigates-to. People the sign-in',
  '   screens show are person elements, inferred, citing those screens (facts). Make a view of the mockups (create_view;',
  '   the viewpoint for screens where the metamodel has one). A defect the application shows (a password in its address,',
  '   an error page) is an unwanted-behaviour requirement nothing satisfies yet, citing the screen, for the next stage.',
  '4. Documents stage, when the run has documents (the sources\' and the repositories\' own: README, docs, ADR records;',
  '   assay_facts with kind "documents"). Read them with assay_read and draw from them, citing the lines (citations): needs',
  '   (what people asked for, in their words: one need per thing asked for, a sentence or a short passage, with label,',
  '   description, properties.kind, parent the system it concerns) and decisions (ADRs: decisions, with properties',
  '   context, decision, consequences, alternatives; status accepted when the document records the decision as made,',
  '   proposed when it only weighs it or you cannot tell, and then ask the user which it is; constrains: the C4 elements it',
  '   applies to). A document says what someone meant, not what the code does: everything from it is a',
  '   proposal or an inferred claim, never observed. Apply them in small plans and ask the user about each proposal, one at',
  '   a time; the needs answered here are what the requirements of the next stage derive from.',
  '5. Scenarios stage. For each unit with tests (assay_facts with unit and kind "tests"), group its tests by the behaviour they',
  '   check (a describe block, a file), read the test code where the titles do not say enough, and write for each group a',
  '   requirement in EARS (what the code does, as the tests show it; satisfiedBy the element of that unit; need: the need it',
  '   serves, a need key of the plan, a need proposal still waiting or a need of the model, else it derives from the run\'s',
  '   need Found in the code) with the scenarios that verify it (given, when, then; tests: the test facts; paths: the explored',
  '   paths that show it, which become Playwright tests of its repository when the user accepts it). Each test fact',
  '   has a status: a scenario rests only on tests that passed, or on explored paths (paths) that show the behaviour, as',
  '   when a unit test fails or checks nothing while the application does it. Write the EARS fields without their keyword',
  '   (trigger: "a customer opens an order", not "When …"). A behaviour whose tests failed or were skipped, and that no',
  '   explored path shows, is no scenario: propose its requirement with no scenarios, citing the code it is drawn from,',
  '   and tell the user its tests do not pass; so may behaviour the code shows that no test checks. Then the requirements',
  '   the documents state that no test checks: no scenarios, citations of the document, satisfiedBy the element that',
  '   builds it, or none when no code does (the model then shows it unsatisfied, a gap; give it a parent). Put them in',
  '   plans of a few requirements each and assay_apply them. Each comes back as a proposal: show it to the user with its',
  '   scenarios, ask whether to add it, change it (assay_answer changes: label, properties, need, parent) or leave it out,',
  '   one at a time, and pass the answer to assay_answer.',
  '6. get_issues with concerns "brief" (the concern packs\' questions in full take a large model\'s whole answer): fix what',
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
    description: 'Start a Radical Assay run (replacing any earlier run): find the model in existing code. Reads the facts of the code repositories in the directories given (units of every stack Assay reads, their dependencies, deployments, APIs, addresses, databases, documents, tests from reports), each with its file and line, writes them to each repository\'s .radical/assay/facts.json, links the units across repositories, takes the sources of documents given, and returns what it found and the steps. The model this server is bound to is the central model.',
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
    description: 'Do one thing on the current screen of the explored application, as the next step of the current path: click, fill (value: the text), select (value: the option), check, or press (value: a key such as Enter) the control with that reference, or goto (value: an address or route of the same application). Returns the screen it leads to. Another host\'s address, and a control whose name says it pays, buys, transfers money or deletes or closes an account, are refused.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['click', 'fill', 'select', 'check', 'press', 'goto'] },
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
        limit: { type: 'number', description: 'Default 200.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'assay_apply',
    description: 'Hand the server a plan of what you found. It refuses the whole plan, naming every problem, when an item cites no fact or a fact the run lacks, quotes what the file does not hold, an observed item cites nothing that states it (or a document), or the metamodel forbids it; otherwise it writes the elements and relations into the central model, maps them in each code repository\'s .radical/radical.json (implements: the units\' folders), keeps their evidence in .radical/assay/run.json, and returns each requirement, need and decision as a proposal for the user.',
    inputSchema: { type: 'object', properties: { plan: PLAN_SCHEMA }, required: ['plan'], additionalProperties: false },
  },
  {
    name: 'assay_answer',
    description: 'The user\'s answer to an Assay proposal. An accepted requirement is written whole, derived from its need (else the run\'s need "Found in the code"), satisfied by its element and verified by its scenarios, whose tests go into their repository\'s .radical/radical.json verifies; an accepted need or decision is written as a need or an ADR, the ADR constraining what it names. Changes come first: a new label, properties merged into the proposed ones, a need\'s description, a requirement\'s need. Rejected, nothing of it is written.',
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
  kind: 'element' | 'relation' | 'requirement' | 'scenario' | 'need' | 'decision' | 'mockup'
  label: string
  confidence: 'observed' | 'inferred' | 'hypothesis'
  facts: string[]
  /** Code the agent quoted for it. */
  citations?: Citation[]
  /** For a proposal: whether the user accepted it as proposed or changed it. */
  accepted?: 'as-proposed' | 'changed'
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

  /** `folder`: the bound model folder; `root`: its repository's root. */
  constructor(private readonly folder: string, private readonly root: () => Promise<string>) {}

  async call(name: string, input: unknown, ctx: ToolRunContext, facade: ModelFacade): Promise<AssayResult> {
    if (name === 'assay_start') return this.start(input)
    const run = this.run
    if (!run) return refused(`${name}: no Assay run; start one with assay_start`)
    if (name === 'assay_facts') return this.factsOf(run, input)
    if (name === 'assay_add_sources') return this.addSources(run, input)
    if (name === 'assay_read') return this.read(run, input)
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
      const actions: ExploreAction[] = ['click', 'fill', 'select', 'check', 'press', 'goto']
      if (!actions.includes(action as ExploreAction)) return refused(`assay_explore_act: action must be one of ${actions.join(', ')}`)
      if (value !== undefined && typeof value !== 'string') return refused('assay_explore_act: value must be text')
      got = await explorer.act(action as ExploreAction, typeof ref === 'string' ? ref : undefined, value as string | undefined)
    }
    run.facts = this.indexOf(run)
    if ('problem' in got) return refused(`${name}: ${got.problem}`)
    return ok(Explorer.describe(got.screen, got.path, run.root, facts.dir), { readOnly: true })
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
    const repositories: RepositoryFacts[] = []
    for (const dir of found.dirs) {
      const own = byRepo[basename(dir)]
      const facts = extractRepository(dir, Array.isArray(own) ? { reports: own.filter((r): r is string => typeof r === 'string') } : {})
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
    this.run = { root, modelPath: posix(relative(root, this.folder)) || '.', repositories, sources: taken.sources, links, facts: factIndex([...repositories, ...taken.sources], links), written: [], proposals: [], mockupOf: new Map(), navigated: new Set(), testsWritten: [] }
    const lines = [
      `Assay run on ${repositories.length} repositor${repositories.length === 1 ? 'y' : 'ies'}${taken.sources.length ? ` and ${taken.sources.length} source${taken.sources.length === 1 ? '' : 's'} of documents` : ''}; the central model is ${this.run.modelPath} in ${root}.`,
      ...(found.empty.length ? [`Nothing in: ${found.empty.join(', ')}.`] : []),
      ...found.notes,
      ...repositories.filter((r) => !isRepository(r.dir)).map((r) => `${r.repository} is no git repository: nothing is written into it (its facts: ${posix(relative(root, factsFileOf(r.dir, r.repository, root)))}).`),
      ...taken.problems.map((p) => `Source not taken: ${p}`),
      '',
      ...describeFacts(repositories, links, root),
      ...(taken.sources.length ? ['', 'Sources:', ...describeSources(taken.sources, root)] : []),
      '',
      ASSAY_PROCEDURE,
    ]
    return ok(lines.join('\n'), { readOnly: true })
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
    const first = Math.max(1, Number.isInteger(from) ? from as number : 1)
    const page = files.slice(first - 1, first - 1 + Assay.READ_LINES)
    const prefix = asked === '.' ? '' : `${asked.replace(/\/+$/, '')}/`
    return ok([
      `${repository}/${prefix || ''}: ${files.length} file${files.length === 1 ? '' : 's'}${files.length ? `, ${first}–${first + page.length - 1} listed` : ''}${first - 1 + page.length < files.length ? ` (next: from ${first + page.length})` : ''}:`,
      ...page.map((f) => `${prefix}${f}`),
    ].join('\n'), { readOnly: true })
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
        rows.push(...list.filter(mine).map((f) => ({ fact: { addresses: 'address', dependencies: 'dependency' }[k] ?? k.replace(/s$/, ''), ...f })))
      }
    }
    const from = Math.max(0, offset ?? 0)
    const page = rows.slice(from, from + Math.max(1, limit ?? 200))
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
    for (const r of plan.relations) {
      const before = new Set(Object.keys(facade.getRelations()))
      const error = await attempt('add_relation', {
        sourceId: r.from, targetId: r.to,
        ...(r.relationType ? { relationType: r.relationType } : {}),
        ...(r.label ? { label: r.label } : {}),
        ...(r.technology ? { technology: r.technology } : {}),
      }, ctx, facade)
      if (error) { failures.push(`relations ${r.from} → ${r.to}: ${error}`); continue }
      const id = Object.keys(facade.getRelations()).find((rid) => !before.has(rid)) ?? ''
      written.push({ id, key: `${r.from}->${r.to}`, kind: 'relation', label: r.label ?? r.relationType ?? 'relation', confidence: r.confidence, facts: r.facts ?? [], ...(r.citations?.length ? { citations: r.citations } : {}) })
    }
    // Screens the server saw are observed mockups; a path's screens follow one another.
    const mockupOf = new Map(run.mockupOf)
    for (const m of plan.mockups) {
      const screen = run.facts.get(m.screen)!.fact as ScreenFact
      const error = await attempt('add_node', {
        tempId: m.key, type: 'mockup', label: m.label,
        ...(m.parent ? { parentId: m.parent } : {}),
        // The page, not one visit of it: no query (it may hold what was typed), numbers as {id}.
        properties: { screen: pageOf(screen.route), ...(m.description ? { description: m.description } : {}) },
      }, ctx, facade)
      if (error) { failures.push(`mockups "${m.key}" (${m.label}): ${error}`); continue }
      const id = ctx.resolveId(m.key)
      mockupOf.set(pageOf(screen.route), id)
      written.push({ id, key: m.key, kind: 'mockup', label: m.label, confidence: 'observed', facts: [m.screen] })
      if (m.presentedBy) {
        const before = new Set(Object.keys(facade.getRelations()))
        const presented = await attempt('add_relation', { sourceId: m.key, targetId: m.presentedBy, relationType: 'presented-by' }, ctx, facade)
        if (presented) failures.push(`mockups "${m.key}" presented by ${m.presentedBy}: ${presented}`)
        else written.push({ id: Object.keys(facade.getRelations()).find((rid) => !before.has(rid)) ?? '', key: `${m.key}->${m.presentedBy}`, kind: 'relation', label: 'presented by', confidence: 'observed', facts: [m.screen] })
      }
    }
    const navigated = new Set(run.navigated)
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
      `Wrote ${plural(written.filter((w) => w.kind === 'element').length, 'element')}${plan.mockups.length ? `, ${plural(written.filter((w) => w.kind === 'mockup').length, 'mockup')}` : ''} and ${plural(written.filter((w) => w.kind === 'relation').length, 'relation')} into the central model.`,
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
      props.action,
    ].filter(Boolean).join(' ')
    const need = p.needProposal ?? (p.need ? label(p.need) : undefined)
    return [
      `- ${p.id}: requirement "${r.label}" (${props.ears_type ?? 'ubiquitous'}), ${p.satisfiedBy ? `satisfied by ${label(p.satisfiedBy)}` : 'satisfied by nothing yet'}${need ? `, derived from ${need}` : ''}: ${ears}`,
      ...(props.rationale ? [`    rationale: ${props.rationale}`] : []),
      ...r.scenarios.map((s) => `    scenario "${s.label}": given ${s.given}, when ${s.when}, then ${s.then}${s.tests?.length ? `; tests: ${s.tests.map((t) => (run.facts.get(t)?.fact as TestFact | undefined)?.test ?? t).join('; ')}` : ''}${s.paths?.length ? `; explored paths, each written as a Playwright test when accepted: ${s.paths.map((x) => `"${(run.facts.get(x)?.fact as PathFact | undefined)?.name ?? x}"`).join(', ')}` : ''}`),
      ...(r.scenarios.length ? [] : ['    no scenario: it rests on the code or documents it cites, not on tests that pass']),
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
            tempId: needKey, type: 'need', label: 'Found in the code', ...(parent ? { parentId: parent } : {}),
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
        for (const sc of r.scenarios) {
          if (!await step('add_node', { tempId: sc.key, type: 'scenario', label: sc.label, properties: { given: sc.given, when: sc.when, then: sc.then }, ...(parent ? { parentId: parent } : {}) }, `scenario "${sc.label}"`)) continue
          written.push({ id: ctx.resolveId(sc.key), key: sc.key, kind: 'scenario', label: sc.label, confidence: 'hypothesis', facts: [...(sc.tests ?? []), ...(sc.paths ?? [])] })
          await step('add_relation', { sourceId: sc.key, targetId: r.key, relationType: 'verifies' }, `scenario "${sc.label}" verifies it`)
        }
      }
      if (failures.length) return refused(`assay_answer: ${p.id} could not be written, nothing was:\n${failures.map((f) => `- ${f}`).join('\n')}`)
      const verifies = new Map(r.scenarios.map((sc) => [ctx.resolveId(sc.key), sc.tests ?? []]))
      // An explored path becomes a test of the repository that builds the application.
      const pathTests = r.scenarios.flatMap((sc) => (sc.paths ?? []).map((id) => ({ scenario: ctx.resolveId(sc.key), path: run.facts.get(id)!.fact as PathFact })))
      const after = facade.getNodes()
      return ok(`${p.id} added: requirement "${label}" (${ctx.resolveId(r.key)}) with ${r.scenarios.length} scenario${r.scenarios.length === 1 ? '' : 's'}${parent ? ` in ${after[parent]?.label}` : ''}.${note}`, {
        commit: () => {
          p.status = 'accepted'
          p.written = ctx.resolveId(r.key)
          run.written.push(...written)
          if (foundNeed) run.needId = foundNeed
        },
        afterWrite: async () => this.writeFiles(run, { implements: new Map(), verifies, pathTests }, after),
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

  /** Writes the files beside the model and says what it wrote; never
   *  throws, so a write the model already has is never reported as refused. */
  private async writeFiles(run: Run, map: { implements: Map<string, Array<{ repository: string; path: string }>>; verifies: Map<string, string[]>; pathTests?: Array<{ scenario: string; path: PathFact }> }, nodes: Record<string, { label: string }>): Promise<string> {
    try {
      return await this.writeMapping(run, map, nodes)
    } catch (error) {
      return `\nFiles not written: ${(error as Error).message}. The model has what the call wrote.`
    }
  }

  /** Writes the code repositories' .radical/radical.json entries and the
   *  central repository's run file; says what it wrote. */
  private async writeMapping(run: Run, map: { implements: Map<string, Array<{ repository: string; path: string }>>; verifies: Map<string, string[]>; pathTests?: Array<{ scenario: string; path: PathFact }> }, nodes: Record<string, { label: string }>): Promise<string> {
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
      ...(run.explore ? [`Explored: ${run.explore.facts.paths.length} paths, ${run.explore.facts.screens.length} screens; ${run.written.filter((w) => w.kind === 'mockup').length} mockups written${run.testsWritten.length ? `, Playwright tests written: ${[...new Set(run.testsWritten)].join(', ')}` : ''}.`] : []),
      `Proposals: ${run.proposals.filter((p) => p.status === 'accepted').length} accepted, ${run.proposals.filter((p) => p.status === 'rejected').length} left out, ${waiting.length} waiting${waiting.length ? ` (${waiting.map((p) => `${p.id} "${labelOf(p)}"`).join(', ')})` : ''}.`,
      `Evidence: ${RUN_FILE}; facts: ${FACTS_FILE} in each repository; mapping: ${REPOSITORY_FILE} in each repository Assay wrote to.`,
    ].join('\n')
  }
}
