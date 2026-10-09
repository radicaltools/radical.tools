// ─── Radical Forge stage prompts ────────────────────────────────────────────
// Radical Forge walks a free-text system description through seven sequential
// AI generation stages — requirements → domain model → fitness functions →
// Gherkin scenarios → state machines → UI mockups → C4 model. In Studio each stage is a normal
// `runAIPrompt` call, so a later stage sees everything an earlier stage
// created (via buildContextMessage in ../systemPrompt.ts), same as any
// multi-turn chat; over MCP the client's own model runs the stage with the
// same prompt (apps/mcp/src/forge.ts). No new AI infrastructure: these are
// just task-scoped prompt strings.
//
// C4 deliberately runs LAST: the behavior/quality spec (requirements,
// fitness functions, scenarios, screens) is nailed down first, and the architecture
// follows from it rather than the other way around. This changes how
// fitness functions link back — with no C4 elements to `constrains` yet,
// they're linked from the requirement side via `traces-to` instead; once C4
// runs last, it links the elements it creates to matching fitness-fns via
// `constrains` (see the governance metamodel preset for why the relation
// only goes fitness-fn/adr/requirement → C4-element, never the reverse).
//
// Mockups are part of that spec, so they come before C4: the screens a user
// needs shape the front-end decomposition, not the other way around. Same
// trick as fitness functions — with no webapp to point at yet, `presented-by`
// (mockup → webapp/container) is added by the C4 stage once the elements
// exist. The mockups stage only creates the mockup nodes and their links;
// wireframes are drawn by a separate per-mockup call (./wireframe.ts),
// triggered from the wizard.
//
// The domain model comes right after the requirements, which are its source:
// the domains (bounded contexts) and the entities the requirements talk
// about, how entities form aggregates (`part-of`) and refer to each other
// (`references`), and how domains relate (the context map). Later stages
// then speak its language: scenarios name its entities, the state machines
// stage picks the entities with a lifecycle from it, and C4 maps elements to
// its domains and entities (`realises`).
//
// State machines come between scenarios and mockups: a Gherkin scenario is
// close to a transition already (Given the source state, When the event,
// Then the target state and its effect), and the states of an entity the
// user sees are what its screens show. Only entities with a real lifecycle
// get one, often none at all: the stage links each machine to its entity
// from the domain model (`lifecycle-of`), adding the entity if it is missing. Nothing runs it yet, so the C4 stage adds the
// elements that implement the machine and own the entity (`implements`,
// `realises`, and `emits` for the events elements publish).

import type { HubConceptSummary } from '../../hubFormat'

export type ForgeStageId = 'requirements' | 'domain' | 'fitness' | 'scenarios' | 'states' | 'c4' | 'mockups'

export interface ForgeStage {
  id: ForgeStageId
  title: string
  /** Shown in the wizard UI above the Generate button. */
  blurb: string
}

/** The node type(s) each stage is actually meant to create — used to scope
 *  the metamodel context message down to full detail for these (plus
 *  whatever's already in the diagram) and abbreviated for the rest (see
 *  @radical/common/ai/metamodelContext's `buildMetamodelMessage`). */
export const PRIMARY_TYPE_IDS_FOR_STAGE: Record<ForgeStageId, string[]> = {
  requirements: ['requirement'],
  domain: ['domain', 'entity'],
  fitness: ['fitness-fn'],
  scenarios: ['scenario'],
  states: ['entity', 'state-machine', 'state', 'pseudostate', 'event'],
  mockups: ['mockup'],
  c4: ['person', 'system', 'container', 'component', 'database', 'webapp', 'queue', 'domain', 'group'],
}

export const FORGE_STAGES: ForgeStage[] = [
  {
    id: 'requirements',
    title: 'Requirements',
    blurb: 'Extract functional requirements from the description, written as EARS statements.',
  },
  {
    id: 'domain',
    title: 'Domain model',
    blurb: 'Find the domains and the entities the requirements talk about: aggregates, how entities refer to each other, and how the domains relate.',
  },
  {
    id: 'fitness',
    title: 'Fitness functions',
    blurb: 'Propose measurable guardrails (fitness functions) constraining those requirements.',
  },
  {
    id: 'scenarios',
    title: 'Gherkin scenarios',
    blurb: 'Write Given/When/Then scenarios that verify each requirement.',
  },
  {
    id: 'states',
    title: 'State machines',
    blurb: 'Model the lifecycle of the entities that have one as event-driven state machines, from the scenarios that move them.',
  },
  {
    id: 'mockups',
    title: 'Mockups',
    blurb: 'Sketch the user-facing screens that illustrate the requirements and scenarios, then draw low-fi wireframes for them.',
  },
  {
    id: 'c4',
    title: 'C4 model',
    blurb: 'Derive the system/container/component structure that satisfies the spec above.',
  },
]

/** Formats Hub catalogue matches (see ./hubMatches.ts) as prior-art
 *  guidance: the model is told to apply the principles these concepts
 *  embody — proven decomposition/coupling patterns, ADR precedent, fitness-
 *  function thresholds — rather than re-deriving everything from scratch,
 *  while being explicit that only a real add_node call creates a node (so
 *  it doesn't just claim to have "imported" one in prose). */
function buildHubGuidanceBlock(hubMatches: HubConceptSummary[] | undefined): string {
  if (!hubMatches?.length) return ''
  const lines = hubMatches.map((c) => {
    const tags = c.tags.length ? ` (tags: ${c.tags.join(', ')})` : ''
    return `- [${c.category}] ${c.name}: ${c.description}${tags}`
  })
  return [
    '',
    'Relevant prior art already in the Hub catalogue — apply these principles',
    '(proven decomposition/coupling patterns, ADR precedent, fitness-function',
    'thresholds) where they fit this system, and reference one by name in a',
    "node's `description` when you follow it. Do not claim to have \"imported\"",
    'one in prose — only a real add_node/add_relation call creates something:',
    ...lines,
  ].join('\n')
}

/** Formats a compact synopsis of earlier stages in this run — replaces
 *  carrying their full verbatim tool-call transcripts forward (which
 *  `RadicalForgeModal.tsx` used to do via a growing `history` array). The
 *  live diagram-context message (../systemPrompt.ts's `buildContextMessage`)
 *  already re-sends the complete, authoritative current model state fresh
 *  every round, so replaying raw tool calls on top of that was mostly
 *  redundant — this keeps just the "what was decided and why" that a fresh
 *  state dump can't carry on its own. */
export function buildPriorStagesBlock(summaries: { title: string; summary: string }[]): string {
  const withText = summaries.filter((s) => s.summary.trim())
  if (!withText.length) return ''
  return [
    '',
    'Summary of earlier stages in this run (the full current model state is',
    'given separately above — this is just what each stage decided and why):',
    ...withText.map((s) => `- ${s.title}: ${s.summary.trim()}`),
  ].join('\n')
}

/** Formats the user's answers to the pre-stage clarifying questions (see
 *  ./clarify.ts) as a block the model should treat as authoritative —
 *  it asked, the user answered, so these override any conflicting guess it
 *  would otherwise make from the free-text description alone. */
function buildClarificationsBlock(clarifications: string | undefined): string {
  if (!clarifications?.trim()) return ''
  return [
    '',
    "User's answers to your clarifying questions — treat these as authoritative:",
    clarifications.trim(),
  ].join('\n')
}

/** The `need` node holding this run's description (see RadicalForgeModal's
 *  ensureNeed) — the requirements stage links what it extracts back to it. */
export interface ForgeNeedRef {
  id: string
  label: string
}

const NEED_LABEL_MAX = 60

/** A short label for the `need` node that stores a Forge description: its
 *  first non-empty line with Markdown heading/list markers stripped, cut at
 *  a word boundary when longer than NEED_LABEL_MAX. */
export function needLabelFromDescription(description: string): string {
  const first = description
    .split('\n')
    .map((l) => l.replace(/^\s*(#+|[-*+]|\d+[.)])\s+/, '').trim())
    .find(Boolean)
  if (!first) return 'Forge brief'
  if (first.length <= NEED_LABEL_MAX) return first.replace(/[.:;,]+$/, '')
  const cut = first.slice(0, NEED_LABEL_MAX)
  const space = cut.lastIndexOf(' ')
  return `${(space > NEED_LABEL_MAX / 2 ? cut.slice(0, space) : cut).replace(/[.:;,]+$/, '')}…`
}

/** Builds the task instruction for one stage. `description` is the original
 *  free-text system description the user provided in the Input step — later
 *  stages still get it for grounding, even though the requirements/model it
 *  implies are by then already in the live diagram (and thus in `history`).
 *  `hubMatches` are the same Hub suggestions shown in the wizard UI for this
 *  stage (see RadicalForgeModal.tsx, or forge_clarify over MCP) — generation and what the user sees
 *  stay the same set, no separate "what did the AI see" mystery.
 *  `clarifications` is the formatted Q&A from the pre-stage clarify step
 *  (./clarify.ts), when the user answered any. `priorStageSummaries`
 *  is the pre-formatted output of `buildPriorStagesBlock` above. `need` is
 *  the node the description is stored in, when the metamodel has that type. */
export function buildForgeStagePrompt(
  stageId: ForgeStageId,
  description: string,
  hubMatches?: HubConceptSummary[],
  clarifications?: string,
  priorStageSummaries?: string,
  need?: ForgeNeedRef,
): string {
  const descBlock = [
    'Original system description (provided by the user in the Radical Forge wizard):',
    '"""',
    description.trim(),
    '"""',
    priorStageSummaries,
    buildHubGuidanceBlock(hubMatches),
    buildClarificationsBlock(clarifications),
  ].filter(Boolean).join('\n')

  switch (stageId) {
    case 'requirements':
      return [
        descBlock,
        '',
        'Task: read the description above and extract its functional requirements as',
        '`requirement` nodes (EARS). Pick the right `ears_type` per requirement — do not',
        'default everything to "ubiquitous". Keep each requirement scoped to one',
        'behaviour; split compound sentences into several requirements and, where one',
        'clearly refines another, link child → parent with a `derives` relation.',
        'Create only requirement nodes in this stage — no systems, containers, fitness',
        'functions, or scenarios yet.',
        ...(need
          ? [
              '',
              `The description is stored in the model as the \`need\` node "${need.label}"`,
              `(id ${need.id}). Link every top-level requirement you create to it with a`,
              '`derives` relation FROM the requirement TO that need; a requirement that',
              'derives from another requirement links only to its parent requirement.',
              'Do not edit the need node itself.',
            ]
          : []),
      ].join('\n')

    case 'domain':
      return [
        descBlock,
        '',
        'Task: build the domain model the requirements already in the model talk',
        'about, in their own words (the ubiquitous language).',
        '1. Add a `domain` node for each bounded context: a part of the business',
        '   with its own language and rules (usually 1-4; a small system may have',
        '   one). Set `kind`: core for what sets the system apart, supporting for what',
        '   it needs but buys no edge, generic for what any system has (users,',
        '   billing). Nest a subdomain only where one clearly splits.',
        '2. Inside each domain, add an `entity` node for each thing with an identity',
        '   that the requirements create, change or look up (a reservation, a',
        '   customer, a product). Set `kind` "aggregate-root" for one that is changed',
        '   as a whole and keeps its own rules, "entity" for a part that only lives',
        '   inside one (an order line), and link the part to its root with `part-of`',
        '   (entity → aggregate root). Plain values (an address, an amount) are not',
        '   entities: mention them in the `description` of the entity that holds them.',
        '   Use `description` to define the term in one or two sentences.',
        '3. Where one aggregate refers to another (a reservation is for a customer),',
        '   link them with `references` (entity → entity), with `cardinality` one or',
        '   many. Aggregates refer to each other only by reference, never by `part-of`.',
        '4. Map how the domains relate: `depends-on` (domain → domain it needs) or',
        '   `partnership` with its `pattern` (customer-supplier, anti-corruption-layer,',
        '   …) where the kind of relationship matters.',
        '5. Link each entity to the requirement(s) that are about it with',
        '   `satisfies` (entity → requirement).',
        '',
        'Name entities in the singular, as the requirements do. No systems,',
        'containers, state machines or scenarios yet.',
      ].join('\n')

    case 'c4':
      return [
        descBlock,
        '',
        'Task: using the requirements, domain model, fitness functions, Gherkin',
        'scenarios, state machines and UI mockups already in the model, plus the',
        'description above, derive the C4',
        'structure — the people/systems/containers/components involved — and the',
        'relations between them. This is the last stage: the behavior and quality',
        'spec is already fully formed, so let the architecture follow from it rather',
        'than guessing ahead of it — e.g. a fitness function with a tight latency',
        'threshold, a scenario implying an async flow, or a set of screens implying a',
        'separate admin front-end should visibly shape how you decompose the system.',
        'Link each element to the requirement(s) it satisfies with a `satisfies`',
        'relation, AND link each existing `fitness-fn` node to whichever new element(s)',
        'it actually constrains with a `constrains` relation, AND link each existing',
        '`mockup` node to the webapp or container that renders it with a',
        '`presented-by` relation FROM the mockup TO that element, AND link the',
        'element that runs each existing `state-machine` to it with `implements`',
        '(element → machine), the element that owns the data of each `entity` to it',
        'with `realises` (element → entity), each system or container that serves a',
        '`domain` to it with `realises` (element → domain), and each element that publishes one of',
        'the `event` nodes to it with `emits` (all only become possible now that',
        'real elements exist to point at). Do not invent',
        'requirements at this stage; if the description implies something not yet',
        'covered by a requirement, model the C4 element anyway but leave it unlinked',
        'rather than fabricating a requirement here.',
      ].join('\n')

    case 'fitness':
      return [
        descBlock,
        '',
        'Task: propose fitness functions (`fitness-fn` nodes) that constrain the',
        'requirements already in the model — measurable guardrails for things like',
        'latency, availability, coupling, security posture, or delivery flow implied',
        'by the description. Set `category` and a concrete `threshold` for each. No',
        'systems/containers exist yet (C4 runs later, once this spec is settled), so',
        'link each fitness function to the requirement(s) it constrains with a',
        '`traces-to` relation FROM the requirement TO the fitness function (the',
        'reverse direction isn\'t valid in the metamodel) rather than `constrains`.',
      ].join('\n')

    case 'scenarios':
      return [
        descBlock,
        '',
        'Task: for each `requirement` node already in the model, write 1-3 Gherkin',
        '`scenario` nodes covering its main path and, where it matters, an edge case',
        'or unwanted-behaviour case. Fill `given`/`when`/`then` with concrete steps (not',
        'placeholders) and use the `gherkin` field only for extra `And`/`But` steps.',
        'Link each scenario to the requirement it exercises with a `verifies` relation.',
        'Speak the domain model\'s language: call things in the steps by the names',
        'of its `entity` nodes.',
      ].join('\n')

    case 'states':
      return [
        descBlock,
        '',
        'Task: find the entities in the requirements and scenarios already in the',
        'model that have a real lifecycle — something that moves through named states',
        'over time in response to events (an order, a payment, a booking, a ticket).',
        'Model each as a `state-machine` (usually 1-3; plain create/read/update/delete',
        'data has no lifecycle worth one). If none has, create nothing and say so in',
        'your summary.',
        '',
        'For each machine, in this order:',
        '1. Take its entity from the domain model (add an `entity` node to its',
        '   `domain` only if it is missing), add the `state-machine` at the root and',
        '   link it to the entity with `lifecycle-of` (machine → entity; one machine',
        '   per entity), then add an `event`',
        '   node inside the machine for each thing that happens to the entity (a user action,',
        '   a message from another system, a timeout: set `source` external, internal',
        '   or timer). Name events in PascalCase, e.g. PaymentReceived.',
        '2. Add its `state` nodes inside it. Nest states only where a group of states',
        '   shares an exit (e.g. any of them can be cancelled): the shared transition',
        '   then leaves the compound state. Use kind "parallel" only for things that',
        '   truly progress at once (each child state is a region). Mark end states',
        '   kind "final". Use `entry`/`exit`/`do` for what the system does in a state.',
        '3. Give the machine and every compound state that is not parallel one',
        '   `pseudostate` of kind "initial" with one transition to its default child',
        '   state (each region of a parallel state gets its own).',
        '4. Derive the transitions from the scenarios: Given is the source state, When',
        '   is the event, Then is the target state and its effect. Add each as a',
        '   relation of type "transition" whose `properties` hold `event` (the id or',
        '   tempId of the event node), a `guard` where the scenario has a condition,',
        '   `actions` for its effect, and `raises` (event ids) for events it publishes.',
        '   Two transitions from one state on the same event need different guards.',
        '   Cover the unwanted-behaviour scenarios too (declines, timeouts, cancels).',
        '5. Link each scenario that moves the entity to the machine with `verifies`',
        '   (scenario → state-machine), and the machine to the requirements it',
        '   implements with `satisfies` (state-machine → requirement).',
        '',
        'Every state must be reachable from the initial state. No systems or',
        'containers exist yet: the C4 stage links each machine to the element that',
        'owns it, so do not create any here.',
      ].join('\n')

    case 'mockups':
      return [
        descBlock,
        '',
        'Task: identify the key user-facing screens implied by the requirements and',
        'scenarios already in the model — only where a person interacts through a UI;',
        'skip machine-to-machine / API-only behaviour. Create one `mockup` node per',
        'screen (typically 3-8; fold small variations such as an error state into the',
        'screen they belong to). Set `screen` to its route or screen name and',
        '`description` to what the user sees and does there. Leave `link` empty.',
        'Link each mockup to the requirement(s) and scenario(s) it covers with',
        '`illustrates` (mockup → requirement / scenario), and model the main navigation',
        'between screens with `navigates-to` (mockup → mockup), using the relation',
        'label for the user action that triggers it (e.g. "Pay"). Where a screen shows',
        'an entity in one of its states (an order awaiting payment), also link the',
        'mockup to that `state` with `illustrates`. No systems or',
        'containers exist yet (C4 runs next and will link each screen to the front-end',
        'that renders it), so do not create any here. Do not draw wireframes here —',
        'they are generated separately from these nodes. If the system has no user',
        'interface at all, create no mockups and say so in your summary.',
      ].join('\n')
  }
}
