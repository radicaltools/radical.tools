// ─── Radical Forge over MCP ─────────────────────────────────────────────────
// Studio's Forge wizard (RadicalForgeModal.tsx) calls its own provider for
// every step. Here the MCP client's model is the one that thinks, so each
// forge_* tool hands it what the wizard would have sent its provider — the
// same stage prompts, clarifying-question prompt, Hub candidates and wireframe
// prompt from @radical/common/ai/forge — and keeps the run's state: the need,
// the answers, the stage summaries and what each stage added (so Regenerate
// replaces it). The client builds the model with the ordinary catalogue tools.
//
// One run per server; forge_start begins a new one. The run lives in memory:
// after a restart, forge_start with the run's needId starts over from the
// same need.
//
// Each stage's elements are filed into the run's view structure, which the
// client asks the user for before forge_start: Radical (views of the
// metamodel's viewpoints in the folders Conceptual, Logical and Governance,
// made as they fill) or the layer canvases. On a canvas they get a place
// beside what the view already shows, and the client is told to ask the user
// how to arrange them (forge_arrange).
//
// A stage may close gaps in earlier stages (see the gaps block of the stage
// prompts), but only by proposing it: forge_propose_refinement checks the
// proposal and returns exactly what it would write, the agent asks the user,
// and forge_answer_refinement applies it if they accept. While a stage is
// open, guard refuses the catalogue tools' direct writes to earlier stages
// (and every write while a proposal waits for its answer). The run keeps the
// model as it was before each stage, so forge_complete_stage reports what
// the stage refined beside the gaps left, and Regenerate undoes the previous
// attempt's refinements as well as its additions.

import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FORGE_ARRANGEMENTS,
  FORGE_STAGES,
  FORGE_VIEW_NAMES,
  PRIMARY_TYPE_IDS_FOR_STAGE,
  PROPOSAL_INPUT_PROPERTIES,
  RADICAL_FOLDERS,
  acceptedRefinements,
  applyProposal,
  arrangeForgeGroup,
  buildClarifyPrompt,
  buildForgeStagePrompt,
  buildPriorStagesBlock,
  buildWireframePrompt,
  defaultForgeStructure,
  describeForgeStructure,
  dropEmptyForgeViews,
  openForgeStageViews,
  describeProposal,
  describeRefinement,
  fileIntoForgeViews,
  forgeArrangeGroups,
  forgeGaps,
  forgeHubCandidates,
  formatClarificationAnswers,
  formatForgeGaps,
  formatProposal,
  idsAddedSince,
  modelIdsOf,
  needLabelFromDescription,
  describeForgeLanguages,
  forgeLanguageRules,
  FORGE_MODEL_LANGUAGE,
  type ForgeLanguages,
  outermostNodes,
  parseProposal,
  radicalViewpoints,
  refinementGuard,
  rejectRefinements,
  snapshotOf,
  stageRefinements,
  type ClarifyStageQuestion,
  type FiledNodes,
  type ForgeHubCandidates,
  type ForgeArrangement,
  type ForgeProposal,
  type ForgeRefinement,
  type ForgeStageId,
  type ForgeStructure,
  type ModelIds,
  type ModelSnapshot,
} from '@radical/common/ai/forge'
import { buildMetamodelMessage } from '@radical/common/ai/metamodelContext'
import type { ModelFacade } from '@radical/common/ai/modelFacade'
import { AI_MODELLING_RULES, buildContextMessage } from '@radical/common/ai/systemPrompt'
import type { ToolDef, ToolResult, ToolRunContext } from '@radical/common/ai/tools'
import type { C4Node, DiagramData } from '@radical/common/c4'
import type { Metamodel } from '@radical/common/metamodel'
import { runPipeline } from '@radical/common/viewPipeline'
import { buildGherkinFiles } from '@radical/common/formats/exportGherkin'
import { docToConcept, type HubConceptSummary, type HubRadicalDoc } from '@radical/common/hubFormat'
import { buildConceptInsert } from '@radical/common/hubImport'
import { sanitizeWireframeSvg } from '@radical/common/wireframe'
import type { ForgeRunStatus } from '@radical/common/formats/forgeRunStatus'
import { CATALOGUE_DIR, buildIndex, readCatalogue } from '@radical/hub-catalogue'
import { createBatchPlacer } from '@radical/layout/geometry'

const STAGE_IDS = FORGE_STAGES.map((stage) => stage.id)

/** The whole flow, for forge_start's answer and the `forge` prompt. */
export const FORGE_PROCEDURE = [
  'Radical Forge turns a free-text description into EARS requirements, a domain model, fitness functions,',
  'Gherkin scenarios, state machines, processes, UI mockups and a C4 model, one reviewed stage at a time, and',
  'ends with a review of the whole model, in this order:',
  FORGE_STAGES.map((stage) => `${stage.title} (${stage.id})`).join(' → ') + '.',
  '1. Before anything is modelled, ask the user, first:',
  '   - Which language to talk in, and which language to write the model in. Offer the language the description is',
  `     written in for the talk and ${FORGE_MODEL_LANGUAGE} for the model as the defaults.`,
  '   Then ask for the view structure of the run, and offer:',
  '   - Radical (the default): a view of each of the metamodel\'s viewpoints, in the folders Conceptual, Logical and',
  '     Governance as in radical.tools\' own model, each made once something lands in it. List the viewpoints by',
  '     folder (radicalViewpoints below) and ask whether to leave any out.',
  `   - Layer canvases: ${Object.values(FORGE_VIEW_NAMES).join(', ')}, which list the elements a stage adds.`,
  '   Then forge_start with the description, or the id of an existing need, and the languages and views as the',
  '   user chose. The description is kept in the model as a need. From then on talk to the user in the one language',
  '   and write the model in the other.',
  '2. For each stage, in order:',
  '   a. forge_clarify: read it and ask the user the clarifying questions it calls for, if any, including which',
  '      Hub concepts you pick from its candidates to apply. Wait for the answers.',
  '   b. forge_generate with those answers and the Hub concepts the user kept. It returns the stage task:',
  '      carry it out with the model tools (add_node, add_relation, update_node, search_model, …).',
  '      A stage may also close gaps in earlier stages within the description (a requirement or scenario a',
  '      process shows is missing, a wrong name), but only by proposing it: forge_propose_refinement returns',
  '      exactly what it would write; show the user that, ask whether to add it (they may reply), wait for',
  '      the answer and pass it to forge_answer_refinement. Writing to earlier stages directly is refused.',
  '   c. get_issues, and fix what the stage broke (a state machine without an initial state, an unreachable',
  '      state, …). Then forge_complete_stage with a short summary of what you created, refined and why. It',
  '      also lists the gaps the model has now; the next stage gets them.',
  '   d. Show the user what the stage added and ask them: keep its new elements in a row, a column or a grid',
  '      on their view? Run Smart Layout on that view? Do what they choose with forge_arrange. Then ask whether',
  '      to continue, regenerate the stage (forge_generate with regenerate: true, which first removes what the',
  '      stage added) or finish here.',
  '   After the mockups stage, offer to draw the wireframes (forge_wireframe). A Hub match can also be',
  '   imported as it is with forge_import_hub_concept.',
  '3. forge_finish: what each stage added, and the Gherkin .feature files of the scenarios.',
].join('\n')

const stageEnum = { type: 'string', enum: STAGE_IDS }

export const FORGE_TOOL_DEFS: ToolDef[] = [
  {
    name: 'forge_start',
    description: 'Start a Radical Forge run (replacing any earlier run): turn a free-text system description into requirements, a domain model, fitness functions, Gherkin scenarios, state machines, processes, mockups and a C4 model in reviewed stages that also fill gaps in the ones before, then a review of the whole model. Stores the description as a `need` node (or uses an existing need) and explains the steps. Ask the user first which languages to talk and model in (languages), then for the view structure (views).',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'The system in plain language: who uses it, what it does, the main flows and constraints. With needId, replaces that need\'s text.' },
        needId: { type: 'string', description: 'Start from an existing `need` node instead (find them with search_model: LIST NODES WHERE type = "need").' },
        languages: {
          type: 'object',
          description: 'The languages the user chose for the run.',
          properties: {
            conversation: { type: 'string', description: 'The language to talk to the user in, e.g. "Polish". Omit for the language the description is written in.' },
            model: { type: 'string', description: `The language to write the model's labels, descriptions and texts in, e.g. "English". Omit for ${FORGE_MODEL_LANGUAGE}.` },
          },
          additionalProperties: false,
        },
        views: {
          type: 'object',
          description: 'The view structure the user chose. Omit for the default: Radical when the metamodel has viewpoints, unless the model already has the layer canvases of a run.',
          properties: {
            structure: { type: 'string', enum: ['radical', 'layers'], description: `radical: a view of each viewpoint in the folder radical.tools' own model keeps it in (${[...new Set(Object.values(RADICAL_FOLDERS))].join(', ')}), made once it shows something; layers: the canvases ${Object.values(FORGE_VIEW_NAMES).join(', ')}.` },
            viewpoints: { type: 'array', items: { type: 'string' }, description: 'With radical: the ids of the viewpoints to have views of. Omit for every viewpoint the radical model has a folder for.' },
          },
          required: ['structure'],
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'forge_clarify',
    description: 'Before generating a Forge stage: returns what to clarify with the user first and the stage\'s Hub candidates to pick from. Ask the user, then call forge_generate with the answers.',
    inputSchema: {
      type: 'object',
      properties: { stage: { ...stageEnum, description: 'The next stage of the run, or one already generated (to regenerate it with new answers).' } },
      required: ['stage'],
      additionalProperties: false,
    },
  },
  {
    name: 'forge_generate',
    description: 'Begin a Forge stage: returns the stage task (rules, metamodel, current model, prompt) to carry out with the model tools, then call forge_complete_stage. regenerate: true first removes everything the stage added last time.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: stageEnum,
        answers: {
          type: 'array',
          description: 'The user\'s answers to your clarifying questions. Leave out questions the user skipped.',
          items: {
            type: 'object',
            properties: { question: { type: 'string' }, answer: { type: 'string' } },
            required: ['question', 'answer'],
            additionalProperties: false,
          },
        },
        hubConcepts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ids of this stage\'s Hub candidates (from forge_clarify) the user wants applied: the ones you picked and the user kept. Omit to apply the few best keyword matches; [] applies none.',
        },
        regenerate: { type: 'boolean', description: 'Required to run a stage again: removes what its previous run added first.' },
      },
      required: ['stage'],
      additionalProperties: false,
    },
  },
  {
    name: 'forge_complete_stage',
    description: 'Finish the Forge stage begun with forge_generate: records your summary (later stages get it) and reports what the stage added.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: stageEnum,
        summary: { type: 'string', description: '1-3 sentences: what you created and why.' },
      },
      required: ['stage', 'summary'],
      additionalProperties: false,
    },
  },
  {
    name: 'forge_propose_refinement',
    description: 'While a Forge stage is open: propose adding to or correcting what an earlier stage made. Writes nothing: checks that the changes would apply and returns exactly what they write, for you to show the user and ask whether to add it. Then call forge_answer_refinement with their answer. One finding per proposal.',
    inputSchema: {
      type: 'object',
      properties: { stage: { ...stageEnum, description: 'The open stage.' }, ...PROPOSAL_INPUT_PROPERTIES },
      required: ['stage', 'reason', 'changes'],
      additionalProperties: false,
    },
  },
  {
    name: 'forge_answer_refinement',
    description: 'The user\'s answer to the proposal forge_propose_refinement returned: accept applies all of its changes, otherwise nothing is written. Pass their reply too, if they gave one; follow it.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: stageEnum,
        proposal: { type: 'string', description: 'The proposal\'s id, as forge_propose_refinement returned it.' },
        accept: { type: 'boolean', description: 'true when the user wants it added.' },
        reply: { type: 'string', description: 'What the user said about it, in their words, if anything.' },
      },
      required: ['stage', 'proposal', 'accept'],
      additionalProperties: false,
    },
  },
  {
    name: 'forge_arrange',
    description: 'After a completed Forge stage, as the user chose: keep the stage\'s new elements in a row, a column or a grid on the canvas views of the run that show them, and/or run Smart Layout on those views. Ask the user first.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: stageEnum,
        align: { type: 'string', enum: FORGE_ARRANGEMENTS, description: 'row and column keep the elements in the order they were created; grid fills a landscape grid row by row. Every later layout keeps it.' },
        smartLayout: { type: 'boolean', description: 'Run Smart Layout on the views the stage added to, after aligning.' },
      },
      required: ['stage'],
      additionalProperties: false,
    },
  },
  {
    name: 'forge_wireframe',
    description: 'Low-fi wireframe of a `mockup` node. Without svg: returns the drawing brief built from the requirements, scenarios and screens around it. With svg: stores that wireframe on the mockup.',
    inputSchema: {
      type: 'object',
      properties: {
        mockupId: { type: 'string' },
        svg: { type: 'string', description: 'The wireframe: one <svg> element following the brief\'s output rules.' },
      },
      required: ['mockupId'],
      additionalProperties: false,
    },
  },
  {
    name: 'forge_import_hub_concept',
    description: 'Import a Hub catalogue concept (pattern, ADR, fitness function, requirement or blueprint) into the model as it is, beside the existing elements, as Forge\'s Import button does.',
    inputSchema: {
      type: 'object',
      properties: { conceptId: { type: 'string', description: 'A Hub concept id, e.g. from forge_clarify\'s candidates.' } },
      required: ['conceptId'],
      additionalProperties: false,
    },
  },
  {
    name: 'forge_finish',
    description: 'End the Forge run: what each stage added (or that it was skipped) and the Gherkin .feature files built from the scenarios in the model.',
    inputSchema: {
      type: 'object',
      properties: {
        gherkinDir: { type: 'string', description: 'Write the .feature files to this folder (absolute, or relative to the server\'s working directory). Omit to get their contents back instead.' },
      },
      additionalProperties: false,
    },
  },
]

export const FORGE_TOOLS = new Set(FORGE_TOOL_DEFS.map((tool) => tool.name))
/** Forge tools that never write the folder. */
export const FORGE_READ_ONLY = new Set(['forge_clarify'])

/** One forge_* call's result. `commit` updates the run once the call's
 *  changes are on disk, so a refused write leaves the run as it was. */
export interface ForgeResult extends ToolResult {
  readOnly?: boolean
  /** The model to write, when the call changed more than the facade knows. */
  data?: DiagramData
  commit?: () => void
}

interface StageState {
  status: 'generating' | 'done'
  /** The model's ids when the stage began. */
  before: ModelIds
  /** The model when the stage began, to find what it did to earlier stages. */
  snapshot: ModelSnapshot
  /** The views made for the stage before it began (openForgeStageViews). */
  opened: string[]
  /** What the stage added; set when it is completed. */
  added?: ModelIds
  /** What it did to earlier stages, as the user accepted; set when it is
   *  completed. */
  refinements?: ForgeRefinement[]
  /** Ids of the nodes and relations its accepted proposals added. */
  proposed: Set<string>
  /** What its accepted proposals wrote, as applyProposal lists it: only
   *  that is the stage's refinement, not an edit someone else made in the
   *  meantime. */
  accepted: ForgeRefinement[]
  /** The proposal waiting for the user's answer. */
  pending?: { id: string; proposal: ForgeProposal }
  /** How many proposals it made, and how many the user declined. */
  proposals: number
  declined: number
  summary?: string
  clarifications?: string
  /** Ids of the Hub concepts applied; undefined = the suggested ones. */
  hubConcepts?: string[]
}

interface ForgeRun {
  description: string
  needId?: string
  needLabel?: string
  startedAt: string
  /** forge_finish was called. */
  finished?: boolean
  hub: ForgeHubCandidates
  /** The view structure the user chose. */
  structure: ForgeStructure
  /** The languages the user chose: to talk in, and to write the model in. */
  languages: ForgeLanguages
  clarified: Set<ForgeStageId>
  stages: Partial<Record<ForgeStageId, StageState>>
}

/** The Hub catalogue the build copies next to the bundle (see tsup.config.ts);
 *  from source (tests) it is read where @radical/hub-catalogue keeps it. */
function catalogueDir(): string {
  const bundled = join(dirname(fileURLToPath(import.meta.url)), 'hub-catalogue')
  return existsSync(bundled) ? bundled : CATALOGUE_DIR
}

interface Catalogue {
  summaries: HubConceptSummary[]
  docs: Map<string, HubRadicalDoc>
}

/** Above this, a stage brief points at search_model instead of listing the model. */
const MAX_CONTEXT_CHARS = 60_000
/** Gap between the existing model and an imported Hub concept. */
const IMPORT_GAP = 120

const ok = (resultText: string, extra: Partial<ForgeResult> = {}): ForgeResult => ({ ok: true, resultText, ...extra })
const fail = (resultText: string): ForgeResult => ({ ok: false, resultText })

const stageTitle = (id: ForgeStageId): string => FORGE_STAGES.find((stage) => stage.id === id)!.title

function countByType(nodes: Record<string, C4Node>, ids: string[]): string {
  const counts = new Map<string, number>()
  for (const id of ids) {
    const type = nodes[id]?.type
    if (type) counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return [...counts].map(([type, n]) => `${type} ${n}`).join(', ')
}

/** The languages forge_start was given; a string says what is wrong with them. */
function languagesArg(raw: unknown): ForgeLanguages | string {
  if (raw === undefined) return {}
  if (!raw || typeof raw !== 'object') return 'languages must be an object with conversation and/or model'
  const languages: ForgeLanguages = {}
  for (const key of ['conversation', 'model'] as const) {
    const value = (raw as Record<string, unknown>)[key]
    if (value === undefined) continue
    if (typeof value !== 'string') return `languages.${key} must be the name of a language`
    if (value.trim()) languages[key] = value.trim()
  }
  return languages
}

/** The view structure forge_start was given, or the default; a string says
 *  what is wrong with it. */
function structureArg(raw: unknown, metamodel: Metamodel | undefined, facade: ModelFacade): ForgeStructure | string {
  if (raw === undefined) return defaultForgeStructure(metamodel, facade.getViews?.())
  const views = raw as { structure?: unknown; viewpoints?: unknown }
  if (views.structure === 'layers') return { kind: 'layers' }
  if (views.structure !== 'radical') return 'views.structure must be "radical" or "layers"'
  const choices = radicalViewpoints(metamodel)
  if (!choices.length) return 'this metamodel has no viewpoints; use views: { structure: "layers" }'
  if (views.viewpoints === undefined) return { kind: 'radical', viewpoints: choices.filter((c) => c.chosen).map((c) => c.id) }
  if (!Array.isArray(views.viewpoints)) return 'views.viewpoints must be a list of viewpoint ids'
  const unknown = views.viewpoints.filter((v) => !choices.some((c) => c.id === v))
  if (unknown.length) return `no viewpoint ${unknown.map((v) => `"${String(v)}"`).join(', ')}; the viewpoints are ${choices.map((c) => c.id).join(', ')}`
  const wanted = new Set(views.viewpoints as string[])
  return { kind: 'radical', viewpoints: choices.filter((c) => wanted.has(c.id)).map((c) => c.id) }
}

/** What filing did to the views, a line each for those it made or added to. */
function viewLines(filed: FiledNodes[]): string[] {
  return filed.filter((f) => f.made || f.nodeIds.length).map((f) => {
    const what = f.made ? `Made the view ${f.viewName} (${f.viewId})` : `${f.viewName} (${f.viewId})`
    const shows = f.nodeIds.length ? ` shows ${f.nodeIds.length} new element${f.nodeIds.length === 1 ? '' : 's'}` : ''
    const laysOut = f.canvas ? '' : '; it lays itself out'
    return `${what}${f.made && shows ? ';' : ''}${shows}${laysOut}.`
  })
}

/** Gives the nodes just filed into canvases that have no place there yet a
 *  place, since a view keeps its own positions: the outermost in a landscape
 *  block beside what the view already showed (what it lists, or what its
 *  chain shows), the rest where they sit inside their parent. A node the
 *  view already has a place for (it showed while the stage ran, and was
 *  laid out there) keeps it. Mutates and returns `data`. */
function placeInViews(data: DiagramData, filed: FiledNodes[], metamodel: Metamodel | undefined): DiagramData {
  for (const { viewId, nodeIds, canvas } of filed) {
    const view = data.views?.find((v) => v.id === viewId)
    if (!view || !canvas) continue
    const fresh = new Set(nodeIds.filter((id) => !view.positions[id]))
    if (!fresh.size) continue
    const nodes: Record<string, C4Node> = Object.fromEntries(data.nodes.map((n) => [n.id, { ...n, ...view.positions[n.id] }]))
    const shown = new Set<string>()
    const before = view.nodeIds.length || !metamodel
      ? view.nodeIds
      : runPipeline(view, { nodes: Object.fromEntries(data.nodes.map((n) => [n.id, n])), relations: data.relations, metamodel }).nodes.map((n) => n.id)
    for (const id of before) {
      if (fresh.has(id)) continue
      for (let cur: string | undefined = id; cur && nodes[cur] && !shown.has(cur); cur = nodes[cur].parentId) shown.add(cur)
    }
    const place = createBatchPlacer(() => nodes, () => shown)
    for (const id of outermostNodes(nodes, [...fresh])) {
      const { x, y } = place(nodes[id].parentId)
      nodes[id] = { ...nodes[id], x, y }
    }
    for (const id of fresh) {
      const { x, y, width, height } = nodes[id]
      view.positions[id] = { x, y, width, height }
    }
  }
  return data
}

export class Forge {
  private run: ForgeRun | null = null
  private catalogue: Catalogue | null = null

  private hub(): Catalogue {
    if (!this.catalogue) {
      const entries = readCatalogue(catalogueDir())
      this.catalogue = {
        summaries: buildIndex(entries),
        docs: new Map(entries.map(({ doc }) => [doc.hub.id, doc])),
      }
    }
    return this.catalogue
  }

  async call(name: string, input: unknown, ctx: ToolRunContext, facade: ModelFacade): Promise<ForgeResult> {
    const args = (input ?? {}) as Record<string, unknown>
    switch (name) {
      case 'forge_start': return this.start(args, ctx, facade)
      case 'forge_clarify': return this.clarify(args)
      case 'forge_generate': return this.generate(args, facade)
      case 'forge_complete_stage': return this.complete(args, facade)
      case 'forge_propose_refinement': return this.propose(args, ctx, facade)
      case 'forge_answer_refinement': return this.answer(args, ctx)
      case 'forge_arrange': return this.arrange(args, facade)
      case 'forge_wireframe': return this.wireframe(args, ctx, facade)
      case 'forge_import_hub_concept': return this.importConcept(args, facade)
      case 'forge_finish': return this.finish(args, facade)
      default: return fail(`Unknown tool ${name}`)
    }
  }

  private stageArg(args: Record<string, unknown>, tool: string): ForgeStageId | string {
    const stage = args.stage
    if (typeof stage !== 'string' || !STAGE_IDS.includes(stage as ForgeStageId)) {
      return `${tool}: stage must be one of ${STAGE_IDS.join(', ')}`
    }
    return stage as ForgeStageId
  }

  /** Why `stage` cannot be clarified or generated now, or null. */
  private blocked(run: ForgeRun, stage: ForgeStageId): string | null {
    const generating = STAGE_IDS.find((id) => run.stages[id]?.status === 'generating' && id !== stage)
    if (generating) return `The ${stageTitle(generating)} stage is still open; finish it with forge_complete_stage first.`
    const missing = STAGE_IDS.slice(0, STAGE_IDS.indexOf(stage)).find((id) => run.stages[id]?.status !== 'done')
    if (missing) return `Stages run in order: generate ${stageTitle(missing)} (${missing}) first.`
    return null
  }

  private start(args: Record<string, unknown>, ctx: ToolRunContext, facade: ModelFacade): ForgeResult {
    const typed = typeof args.description === 'string' ? args.description.trim() : ''
    const needId = typeof args.needId === 'string' && args.needId ? ctx.resolveId(args.needId) : undefined
    const metamodel = facade.getMetamodel?.()
    const structure = structureArg(args.views, metamodel, facade)
    if (typeof structure === 'string') return fail(`forge_start: ${structure}`)
    const languages = languagesArg(args.languages)
    if (typeof languages === 'string') return fail(`forge_start: ${languages}`)
    let description = typed
    let need: string | undefined
    let readOnly = true
    if (needId) {
      const node = facade.getNodes()[needId]
      if (!node || node.type !== 'need') return fail(`forge_start: "${args.needId}" is not a need node`)
      description = typed || (node.description ?? '').trim()
      if (!description) return fail('forge_start: that need has no text; pass a description')
      // As in the wizard, an edited description is saved back to the need.
      if (typed && (node.description ?? '').trim() !== typed) {
        facade.updateNode(needId, { description: typed })
        readOnly = false
      }
      need = needId
    } else {
      if (!description) return fail('forge_start: pass a description or a needId')
      const def = metamodel?.nodeTypes.need
      // Metamodels without the governance `need` type run Forge without storing the description.
      if (def) {
        need = facade.addNode({
          type: 'need',
          label: needLabelFromDescription(description),
          description,
          kind: 'brief',
          source: 'Radical Forge',
          collapsed: false,
          ...ctx.placeNext(),
          width: def.width ?? 200,
          height: def.height ?? 80,
        } as Omit<C4Node, 'id'>)
        if (!need) return fail(`forge_start: ${facade.lastError ?? 'could not add the need'}`)
        readOnly = false
      }
    }
    // The run's views start with the need: Conceptual, or the views of the
    // viewpoints that show it (Traceability, Specification).
    let data: DiagramData | undefined
    let filed: FiledNodes[] = []
    if (need) {
      filed = fileIntoForgeViews(facade, [need], undefined, structure)
      if (filed.some((f) => f.nodeIds.length || f.made)) {
        data = placeInViews(facade.toDiagramData(), filed, metamodel)
        readOnly = false
      }
    }
    const run: ForgeRun = {
      description,
      needId: need,
      needLabel: need ? facade.getNodes()[need]?.label : undefined,
      startedAt: new Date().toISOString(),
      hub: forgeHubCandidates(this.hub().summaries, description, metamodel?.id),
      structure,
      languages,
      clarified: new Set(),
      stages: {},
    }
    const lines = [
      need ? `Forge run started. The description is the need ${need}.` : 'Forge run started. This metamodel has no need type, so the description is not stored in the model.',
      `Languages: ${describeForgeLanguages(languages)}.`,
      `View structure: ${describeForgeStructure(structure, metamodel)}`,
      ...viewLines(filed),
      '',
      FORGE_PROCEDURE,
      '',
      'Stages:',
      ...FORGE_STAGES.map((stage, i) => `${i + 1}. ${stage.title} (${stage.id}): ${stage.blurb}`),
      '',
      `Next: forge_clarify with stage "${STAGE_IDS[0]}".`,
    ]
    return ok(lines.join('\n'), { readOnly, data, commit: () => { this.run = run } })
  }

  private clarify(args: Record<string, unknown>): ForgeResult {
    const run = this.run
    if (!run) return fail('forge_clarify: no Forge run; call forge_start first')
    const stage = this.stageArg(args, 'forge_clarify')
    if (!STAGE_IDS.includes(stage as ForgeStageId)) return fail(stage)
    const id = stage as ForgeStageId
    const blocked = this.blocked(run, id)
    if (blocked) return fail(`forge_clarify: ${blocked}`)
    const candidates = run.hub.stages[id]?.candidates ?? []
    const priorQA = STAGE_IDS.slice(0, STAGE_IDS.indexOf(id))
      .map((prior) => run.stages[prior]?.clarifications ?? '')
      .filter(Boolean)
      .join('\n\n')
    const lines = [buildClarifyPrompt(stageTitle(id), run.description, candidates, priorQA, 'ask'), '', ...forgeLanguageRules(run.languages)]
    if (id === 'c4' && run.hub.blueprint) {
      lines.push('', `The blueprint ${run.hub.blueprint.id} fits the whole description; offering it to import as a skeleton (forge_import_hub_concept) is a good first pick.`)
    }
    lines.push('', `Then call forge_generate with stage "${id}"${candidates.length ? ', the answers and hubConcepts' : ' and the answers'}.`)
    return ok(lines.join('\n'), { readOnly: true, commit: () => { run.clarified.add(id) } })
  }

  private generate(args: Record<string, unknown>, facade: ModelFacade): ForgeResult {
    const run = this.run
    if (!run) return fail('forge_generate: no Forge run; call forge_start first')
    const stage = this.stageArg(args, 'forge_generate')
    if (!STAGE_IDS.includes(stage as ForgeStageId)) return fail(stage)
    const id = stage as ForgeStageId
    const blocked = this.blocked(run, id)
    if (blocked) return fail(`forge_generate: ${blocked}`)
    const previous = run.stages[id]
    if (previous && args.regenerate !== true) {
      return fail(`forge_generate: the ${stageTitle(id)} stage has already run; pass regenerate: true to replace what it added`)
    }
    if (!previous && !run.clarified.has(id)) return fail(`forge_generate: call forge_clarify for "${id}" first`)

    // Answers: new ones replace the stage's earlier answers.
    let clarifications = previous?.clarifications
    if (args.answers !== undefined) {
      if (!Array.isArray(args.answers)) return fail('forge_generate: answers must be an array')
      const questions: ClarifyStageQuestion[] = []
      const answers: Record<string, string> = {}
      args.answers.forEach((item, i) => {
        const { question, answer } = (item ?? {}) as { question?: unknown; answer?: unknown }
        if (typeof question !== 'string' || typeof answer !== 'string') return
        questions.push({ id: `q${i}`, question, kind: 'text' })
        answers[`q${i}`] = answer
      })
      clarifications = formatClarificationAnswers(questions, answers)
    }
    const { candidates = [], suggested = [] } = run.hub.stages[id] ?? {}
    let hubConcepts = previous?.hubConcepts
    if (args.hubConcepts !== undefined) {
      if (!Array.isArray(args.hubConcepts) || args.hubConcepts.some((c) => typeof c !== 'string')) {
        return fail('forge_generate: hubConcepts must be an array of concept ids')
      }
      const unknown = (args.hubConcepts as string[]).filter((c) => !candidates.some((m) => m.id === c))
      if (unknown.length) {
        return fail(`forge_generate: not a Hub candidate of this stage: ${unknown.join(', ')}. See forge_clarify for the candidates${candidates.length ? '' : ' (this stage has none)'}.`)
      }
      hubConcepts = args.hubConcepts as string[]
    }

    // Regenerate replaces the previous attempt instead of adding a second copy.
    let readOnly = true
    if (previous) {
      // Its changes to earlier stages first, while what it added is still there.
      const refinements = previous.refinements ?? acceptedRefinements(stageRefinements(id, previous.snapshot, snapshotOf(facade)), previous.accepted)
      if (rejectRefinements(facade, refinements).length) readOnly = false
      const added = previous.added ?? idsAddedSince(previous.before, this.ids(facade))
      for (const viewId of added.views) if (facade.getViews?.()[viewId]) { facade.removeView?.(viewId); readOnly = false }
      for (const relId of added.relations) if (facade.getRelations()[relId]) { facade.removeRelation(relId); readOnly = false }
      for (const nodeId of added.nodes) if (facade.getNodes()[nodeId]) { facade.removeNode(nodeId); readOnly = false }
    }

    // The stage's views first, so that its elements show up in them as
    // they are added (Studio, open on the folder, can follow them there).
    const before = this.ids(facade)
    const opened = openForgeStageViews(facade, id, run.structure)
    if (opened.length) readOnly = false
    const views = facade.getViews?.() ?? {}
    const openedNames = opened.map((v) => views[v]?.name).filter(Boolean)

    const nodes = facade.getNodes()
    const effectiveMatches = hubConcepts
      ? hubConcepts.map((c) => candidates.find((m) => m.id === c)!).filter(Boolean)
      : suggested
    const stageIdx = STAGE_IDS.indexOf(id)
    const priorSummaries = buildPriorStagesBlock(
      FORGE_STAGES.slice(0, stageIdx).map((s) => ({ title: s.title, summary: run.stages[s.id]?.summary ?? '' })),
    )
    const needNode = run.needId ? nodes[run.needId] : undefined
    const gaps = forgeGaps(STAGE_IDS.slice(0, stageIdx), nodes, facade.getRelations(), facade.getMetamodel?.())
    const prompt = buildForgeStagePrompt(id, run.description, effectiveMatches, clarifications, priorSummaries,
      needNode ? { id: needNode.id, label: needNode.label } : undefined, formatForgeGaps(gaps), 'forge_propose_refinement')
    const metamodelMessage = buildMetamodelMessage(facade.getMetamodel?.(), new Set(PRIMARY_TYPE_IDS_FOR_STAGE[id]), nodes)
    let context = buildContextMessage(nodes, facade.getRelations(), null, facade.getViews?.())
    if (context.length > MAX_CONTEXT_CHARS) {
      context = `The model has ${Object.keys(nodes).length} nodes and ${Object.keys(facade.getRelations()).length} relations, too many to list here. Look up what this stage needs with search_model, e.g. LIST NODES WHERE type = "requirement".`
    }
    const brief = [
      `Radical Forge — stage ${stageIdx + 1} of ${STAGE_IDS.length}: ${stageTitle(id)}${previous ? ' (regenerating; what it added before has been removed)' : ''}`,
      FORGE_STAGES[stageIdx].blurb,
      ...(openedNames.length ? [`Made the stage's views before it begins: ${openedNames.join(', ')}. What you add shows up in them as you add it.`] : []),
      '',
      'Carry out the task at the end with the model tools (add_node, add_relation, update_node, move_node, search_model, …).',
      'A Forge stage only builds the model: do not change the metamodel, presentations or milestones.',
      ...(id === 'requirements' ? [] : [`What an earlier stage lacks you propose with forge_propose_refinement (stage "${id}"), show the user exactly what it returns, and pass their answer to forge_answer_refinement before you go on.`]),
      `When the stage is done, call forge_complete_stage with stage "${id}" and a 1-3 sentence summary of what you created, refined and why.`,
      '',
      'Rules:',
      ...[...forgeLanguageRules(run.languages), ...AI_MODELLING_RULES].map((rule) => `- ${rule}`),
      '',
      metamodelMessage,
      '',
      context,
      '',
      prompt,
    ].join('\n')

    const state: StageState = {
      status: 'generating', before, opened, snapshot: snapshotOf(facade), clarifications, hubConcepts,
      proposed: new Set(), accepted: [], proposals: 0, declined: 0,
    }
    return ok(brief, { readOnly, commit: () => { run.stages[id] = state } })
  }

  private complete(args: Record<string, unknown>, facade: ModelFacade): ForgeResult {
    const run = this.run
    if (!run) return fail('forge_complete_stage: no Forge run; call forge_start first')
    const stage = this.stageArg(args, 'forge_complete_stage')
    if (!STAGE_IDS.includes(stage as ForgeStageId)) return fail(stage)
    const id = stage as ForgeStageId
    const state = run.stages[id]
    if (state?.status !== 'generating') return fail(`forge_complete_stage: the ${stageTitle(id)} stage is not open; begin it with forge_generate`)
    if (state.pending) return fail(`forge_complete_stage: proposal ${state.pending.id} waits for the user's answer; ask them and call forge_answer_refinement first`)
    const summary = typeof args.summary === 'string' && args.summary.trim() ? args.summary.trim() : 'Done.'
    const all = idsAddedSince(state.before, this.ids(facade))
    const refinements = acceptedRefinements(stageRefinements(id, state.snapshot, snapshotOf(facade)), state.accepted)
    // What an accepted refinement added is the refinement's: counted as
    // added too, forge_finish reported it twice. Filed into views all the same.
    const refined = new Set(refinements.filter((r) => r.change === 'added').map((r) => r.id))
    const added = { ...all, nodes: all.nodes.filter((n) => !refined.has(n)), relations: all.relations.filter((r) => !refined.has(r)) }
    const filed = fileIntoForgeViews(facade, all.nodes, id, run.structure)
    // The views made for the stage that it left empty go again.
    const dropped = dropEmptyForgeViews(facade, state.opened)
    added.views = added.views.filter((v) => !dropped.includes(v))
    const nodes = facade.getNodes()
    const byType = countByType(nodes, added.nodes)
    const lines = [
      `${stageTitle(id)} done: +${added.nodes.length} nodes${byType ? ` (${byType})` : ''}, +${added.relations.length} relations, +${added.views.length} views.`,
    ]
    lines.push(...viewLines(filed))
    if (refinements.length) {
      lines.push(`It refined earlier stages as the user accepted (${refinements.length}):`, ...refinements.map((r) => `- ${describeRefinement(r)}`))
    }
    if (state.declined) lines.push(`The user declined ${state.declined} of its ${state.proposals} proposals.`)
    const gaps = forgeGaps(STAGE_IDS.slice(0, STAGE_IDS.indexOf(id) + 1), nodes, facade.getRelations(), facade.getMetamodel?.())
    if (gaps.length) {
      lines.push(`Gaps the model has now (${gaps.length}), by the rules of the stages done; ${id === 'review' ? 'tell the user which stay open' : 'the next stage gets them'}:`, ...formatForgeGaps(gaps))
    }
    if (id === 'mockups') {
      const mockups = Object.values(nodes).filter((n) => n.type === 'mockup')
      const missing = mockups.filter((n) => !(n as unknown as Record<string, unknown>).wireframe)
      if (missing.length) {
        lines.push(
          `${missing.length} of ${mockups.length} mockups have no wireframe. Offer to draw them: for each, forge_wireframe with its mockupId returns the brief; draw the SVG and call forge_wireframe again with it.`,
          ...missing.map((n) => `- ${n.id} ${n.label}`),
        )
      }
    }
    const groups = forgeArrangeGroups(facade, added.nodes, id, run.structure)
    const alignable = groups.filter((g) => g.nodeIds.length >= 2)
    const viewNames = groups.map((g) => g.viewName).join(' and ')
    if (groups.length) {
      lines.push(`Now show the user what this stage added and ask them:${alignable.length ? `\n- Keep its ${alignable.map((g) => `${g.nodeIds.length} new elements on ${g.viewName}`).join(' and ')} in a row, a column or a grid?` : ''}\n- Run Smart Layout on ${viewNames}?`)
      lines.push(`Do what they choose with forge_arrange (stage "${id}"${alignable.length ? ', align and/or smartLayout: true' : ', smartLayout: true'}).`)
    }
    const next = STAGE_IDS[STAGE_IDS.indexOf(id) + 1]
    lines.push(next
      ? `${groups.length ? 'Then' : 'Next: show the user what this stage added and'} ask whether to continue with ${stageTitle(next)} (forge_clarify with stage "${next}"), regenerate this stage (forge_generate with regenerate: true) or finish here (forge_finish).`
      : `This was the last stage. ${groups.length ? 'Then' : 'Show the user what it added and'} ask whether to regenerate it (forge_generate with regenerate: true) or finish (forge_finish).`)
    // A view of a viewpoint lists nothing (it shows what its chain gives):
    // made now, it is a change all the same.
    const changed = dropped.length > 0 || filed.some((f) => (f.canvas && f.nodeIds.length) || f.made)
    return ok(lines.join('\n'), {
      readOnly: !changed,
      data: changed ? placeInViews(facade.toDiagramData(), filed, facade.getMetamodel?.()) : undefined,
      commit: () => { run.stages[id] = { ...state, status: 'done', added, refinements, summary } },
    })
  }

  /** The open stage a proposal belongs to, or why there is none. */
  private openStage(args: Record<string, unknown>, tool: string): { id: ForgeStageId; state: StageState } | string {
    const run = this.run
    if (!run) return `${tool}: no Forge run; call forge_start first`
    const stage = this.stageArg(args, tool)
    if (!STAGE_IDS.includes(stage as ForgeStageId)) return stage
    const id = stage as ForgeStageId
    const state = run.stages[id]
    if (state?.status !== 'generating') return `${tool}: the ${stageTitle(id)} stage is not open; a stage proposes refinements while it runs`
    return { id, state }
  }

  private async propose(args: Record<string, unknown>, ctx: ToolRunContext, facade: ModelFacade): Promise<ForgeResult> {
    const open = this.openStage(args, 'forge_propose_refinement')
    if (typeof open === 'string') return fail(open)
    const { id, state } = open
    if (state.pending) return fail(`forge_propose_refinement: proposal ${state.pending.id} still waits for the user's answer; call forge_answer_refinement first`)
    const proposal = parseProposal(args)
    if (typeof proposal === 'string') return fail(`forge_propose_refinement: ${proposal}`)
    const lines = describeProposal(proposal, facade.getNodes(), facade.getRelations(), ctx.resolveId)
    // A trial on this call's copy of the model, which is not saved: the user
    // is asked only about a proposal that applies. Its tempIds stay its own.
    const trialIds = new Map<string, string>()
    const trial = await applyProposal(proposal, {
      ...ctx,
      resolveId: (tempId) => trialIds.get(tempId) ?? ctx.resolveId(tempId),
      registerTempId: (tempId, realId) => { trialIds.set(tempId, realId) },
    })
    if (!trial.ok) return fail(`forge_propose_refinement: ${trial.text} Fix the proposal before you ask the user.`)
    const proposalId = `p${state.proposals + 1}`
    const text = [
      `Proposal ${proposalId}: nothing is written yet. Show the user exactly this, ask whether to add it, and wait for the answer; they may also reply.`,
      '',
      formatProposal(proposal, lines),
      '',
      `Then call forge_answer_refinement with stage "${id}", proposal "${proposalId}", accept true or false, and their reply if they gave one. Until then the model tools write nothing.`,
    ].join('\n')
    return ok(text, { readOnly: true, commit: () => { state.pending = { id: proposalId, proposal }; state.proposals++ } })
  }

  private async answer(args: Record<string, unknown>, ctx: ToolRunContext): Promise<ForgeResult> {
    const open = this.openStage(args, 'forge_answer_refinement')
    if (typeof open === 'string') return fail(open)
    const { state } = open
    const pending = state.pending
    if (!pending) return fail('forge_answer_refinement: no proposal waits for an answer; propose one with forge_propose_refinement')
    if (args.proposal !== pending.id) return fail(`forge_answer_refinement: the open proposal is ${pending.id}, not ${String(args.proposal)}`)
    if (typeof args.accept !== 'boolean') return fail('forge_answer_refinement: accept must be true or false')
    const reply = typeof args.reply === 'string' && args.reply.trim() ? ` The user replied: "${args.reply.trim()}". Follow it.` : ''
    if (!args.accept) {
      return ok(`Not added; nothing was written. Do not propose it again.${reply}`, {
        readOnly: true,
        commit: () => { state.pending = undefined; state.declined++ },
      })
    }
    const outcome = await applyProposal(pending.proposal, ctx)
    if (!outcome.ok) return fail(`forge_answer_refinement: ${outcome.text}`)
    return ok(`Added ${pending.id}. ${outcome.text}${reply}`, {
      commit: () => {
        state.pending = undefined
        for (const added of outcome.added) state.proposed.add(added)
        state.accepted.push(...outcome.refinements)
      },
    })
  }

  /** Why a catalogue tool call may not run now, or null: while a stage is
   *  open it may not write to earlier stages, and while a proposal waits
   *  for its answer nothing is written. */
  guard(name: string, input: unknown, ctx: ToolRunContext): string | null {
    const run = this.run
    if (!run) return null
    const id = STAGE_IDS.find((stage) => run.stages[stage]?.status === 'generating')
    const state = id ? run.stages[id] : undefined
    if (!id || !state) return null
    if (state.pending) return `${name}: proposal ${state.pending.id} waits for the user's answer; ask them and call forge_answer_refinement first.`
    return refinementGuard({ stage: id, before: state.snapshot, proposed: state.proposed }, name, input, ctx.resolveId, 'forge_propose_refinement')
  }

  private async arrange(args: Record<string, unknown>, facade: ModelFacade): Promise<ForgeResult> {
    const run = this.run
    if (!run) return fail('forge_arrange: no Forge run; call forge_start first')
    const stage = this.stageArg(args, 'forge_arrange')
    if (!STAGE_IDS.includes(stage as ForgeStageId)) return fail(stage)
    const id = stage as ForgeStageId
    const state = run.stages[id]
    if (state?.status !== 'done' || !state.added) return fail(`forge_arrange: complete the ${stageTitle(id)} stage first (forge_complete_stage)`)
    if (args.align !== undefined && !FORGE_ARRANGEMENTS.includes(args.align as ForgeArrangement)) {
      return fail(`forge_arrange: align must be one of ${FORGE_ARRANGEMENTS.join(', ')}`)
    }
    if (args.smartLayout !== undefined && typeof args.smartLayout !== 'boolean') return fail('forge_arrange: smartLayout must be true or false')
    const align = args.align as ForgeArrangement | undefined
    if (!align && args.smartLayout !== true) return fail('forge_arrange: pass align, smartLayout: true, or both')
    const groups = forgeArrangeGroups(facade, state.added.nodes, id, run.structure)
    if (!groups.length) return fail(`forge_arrange: the ${stageTitle(id)} stage added nothing that is on a canvas view of the run`)
    const lines: string[] = []
    if (align) {
      for (const group of groups) {
        if (group.nodeIds.length < 2) { lines.push(`${group.viewName}: one new element, nothing to align.`); continue }
        const outcome = arrangeForgeGroup(facade, group, align)
        if (!outcome.ok) return fail(`forge_arrange: ${outcome.text}`)
        lines.push(outcome.text)
      }
    }
    if (args.smartLayout === true) {
      if (!facade.runLayout) return fail('forge_arrange: Smart Layout is not available here')
      for (const viewId of new Set(groups.map((g) => g.viewId))) {
        const outcome = await facade.runLayout(viewId)
        if (!outcome.ok) return fail(`forge_arrange: ${outcome.text}`)
        lines.push(outcome.text)
      }
    }
    return ok(lines.join('\n'))
  }

  private wireframe(args: Record<string, unknown>, ctx: ToolRunContext, facade: ModelFacade): ForgeResult {
    if (typeof args.mockupId !== 'string' || !args.mockupId) return fail('forge_wireframe: mockupId is required')
    const id = ctx.resolveId(args.mockupId)
    const node = facade.getNodes()[id]
    if (!node || node.type !== 'mockup') return fail(`forge_wireframe: "${args.mockupId}" is not a mockup node`)
    if (args.svg === undefined) {
      const brief = buildWireframePrompt(id, facade.getNodes(), facade.getRelations())
      const language = this.run ? `\n\nWrite the wireframe's texts in ${this.run.languages.model ?? FORGE_MODEL_LANGUAGE}.` : ''
      return ok(`${brief}${language}\n\nThen call forge_wireframe again with mockupId "${id}" and the svg.`, { readOnly: true })
    }
    const svg = typeof args.svg === 'string' ? sanitizeWireframeSvg(args.svg) : null
    if (!svg) return fail('forge_wireframe: not a usable SVG wireframe; follow the output rules of the brief (one <svg> element, allowed elements only, compact)')
    facade.updateNode(id, { wireframe: svg } as Partial<C4Node>)
    return ok(`Stored the wireframe of ${node.label}.`)
  }

  private importConcept(args: Record<string, unknown>, facade: ModelFacade): ForgeResult {
    if (typeof args.conceptId !== 'string' || !args.conceptId) return fail('forge_import_hub_concept: conceptId is required')
    const doc = this.hub().docs.get(args.conceptId)
    if (!doc) return fail(`forge_import_hub_concept: no Hub concept "${args.conceptId}"`)
    const concept = docToConcept(doc)
    const data = facade.toDiagramData()
    // Beside the model's top-level elements, top-aligned with them.
    const roots = data.nodes.filter((n) => !n.parentId)
    const right = roots.length ? Math.max(...roots.map((n) => n.x + n.width)) + IMPORT_GAP : 0
    const top = roots.length ? Math.min(...roots.map((n) => n.y)) : 0
    const insert = buildConceptInsert(concept, {
      newId: () => crypto.randomUUID(),
      place: () => ({ x: right, y: top }),
      takenNames: { views: (data.views ?? []).map((v) => v.name), sequences: (data.sequences ?? []).map((q) => q.name) },
    })
    data.nodes.push(...Object.values(insert.nodes))
    data.relations.push(...Object.values(insert.relations))
    if (Object.keys(insert.sequences).length) data.sequences = [...(data.sequences ?? []), ...Object.values(insert.sequences)]
    if (insert.views.length) data.views = [...(data.views ?? []), ...insert.views]
    if (insert.template) data.hubTemplates = { ...(data.hubTemplates ?? {}), [insert.template.id]: insert.template.record }
    const added = Object.values(insert.nodes).map((n) => `- ${n.id} ${n.type} "${n.label}"`)
    return ok([
      `Imported ${concept.name}: +${added.length} nodes, +${Object.keys(insert.relations).length} relations, +${insert.views.length} views.`,
      ...added,
    ].join('\n'), { data })
  }

  private async finish(args: Record<string, unknown>, facade: ModelFacade): Promise<ForgeResult> {
    const run = this.run
    if (!run) return fail('forge_finish: no Forge run; call forge_start first')
    const lines = FORGE_STAGES.map((stage) => {
      const state = run.stages[stage.id]
      if (!state) return `- ${stage.title}: skipped`
      if (state.status === 'generating') return `- ${stage.title}: begun but not completed`
      const refined = state.refinements?.length ? ` · ${state.refinements.length} refinements of earlier stages accepted` : ''
      return `- ${stage.title}: +${state.added!.nodes.length} nodes · +${state.added!.relations.length} relations${refined}`
    })
    const files = buildGherkinFiles(facade.getNodes(), facade.getRelations())
    lines.push('')
    if (!files.length) {
      lines.push('No Gherkin scenarios in the model, so there are no .feature files.')
    } else if (typeof args.gherkinDir === 'string' && args.gherkinDir) {
      const dir = resolve(args.gherkinDir)
      await mkdir(dir, { recursive: true })
      for (const file of files) await writeFile(join(dir, file.filename), file.content)
      lines.push(`Wrote ${files.length} .feature files to ${dir}:`, ...files.map((f) => `- ${f.filename}`))
    } else {
      lines.push(`${files.length} .feature files (pass gherkinDir to write them):`)
      for (const file of files) lines.push('', `--- ${file.filename}`, file.content)
    }
    lines.push('', `The elements are in the run's views (${describeForgeStructure(run.structure, facade.getMetamodel?.())}); smart_layout with a viewId arranges a canvas.`)
    return ok(lines.join('\n'), { readOnly: true, commit: () => { run.finished = true } })
  }

  /** Where the run stands, for Studio (see forgeRunStatus); null without a
   *  run. `closing` marks a run the server is leaving unfinished. */
  status(closing = false): Omit<ForgeRunStatus, 'version' | 'updatedAt'> | null {
    const run = this.run
    if (!run) return null
    return {
      ...(run.needId && run.needLabel ? { need: { id: run.needId, label: run.needLabel } } : {}),
      startedAt: run.startedAt,
      state: run.finished ? 'finished' : closing ? 'closed' : 'active',
      stages: FORGE_STAGES.map((stage) => {
        const state = run.stages[stage.id]
        if (state?.status === 'done') {
          return {
            id: stage.id,
            status: 'done' as const,
            ...(state.summary ? { summary: state.summary } : {}),
            added: { nodes: state.added?.nodes.length ?? 0, relations: state.added?.relations.length ?? 0 },
            ...(state.refinements?.length ? { refined: state.refinements.length } : {}),
          }
        }
        if (state?.status === 'generating') return { id: stage.id, status: 'generating' as const, ...(state.pending ? { asking: true } : {}) }
        return { id: stage.id, status: run.clarified.has(stage.id) ? 'clarifying' as const : 'pending' as const }
      }),
    }
  }

  private ids(facade: ModelFacade): ModelIds {
    return modelIdsOf({ nodes: facade.getNodes(), relations: facade.getRelations(), views: facade.getViews?.() ?? {} })
  }
}
