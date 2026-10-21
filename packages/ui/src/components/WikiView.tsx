import React, { createContext, useContext, useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import {
  GROUP_TYPE,
  isPlacementAllowed,
  resolveEarsSubject,
  composeEarsSentence,
  requirementStatePhrase,
  parseEarsSentence,
  earsActionIsClause,
  refLabels,
  relationTypeForProse,
  NODE_TYPE_CATEGORIES,
  CUSTOM_CATEGORY,
  nodeTypeCategory,
  propertyText,
  relationPhrase,
  countedNoun,
  typeNoun,
  firstParagraph,
  PropertyDef,
  type WizardLink,
} from '@radical/common/metamodel'
import { useOutsideClick } from '../hooks/useOutsideClick'
import { WikiMenu, type WikiMenuItem, type WikiMenuPage } from './WikiMenu'
import { fieldTitle, wikiSearchHit, type WikiSearchHit } from './wikiSearch'
import { elementFromLine, writtenLines } from './wikiWrite'
import { EarsQuickEntry } from './EarsQuickEntry'
import { MockupWireframe } from './MockupWireframe'
import { MarkdownText } from './MarkdownText'
import { RefPicker } from './RefPicker'
import { wireframeDataUri } from '@radical/common/wireframe'
import {
  C4Node,
  C4Relation,
  C4ElementType,
  NODE_COLORS,
  NODE_FG,
  nodeTypeSize,
  TYPE_LABELS,
  TYPE_ICON_PATHS,
} from '@radical/common/c4'
import { wikiDepthOf } from '@radical/common/c4'
import { newElementFilters, viewShownNodes } from '@radical/common/viewPipeline'
import { createWikiDocument, type WikiBlock, type WikiDocument, type WikiRelationGroup } from '@radical/common/wikiDocument'

type Metamodel = ReturnType<typeof useDiagramStore.getState>['metamodel']
type AddNode = ReturnType<typeof useDiagramStore.getState>['addNode']
type AddRelation = ReturnType<typeof useDiagramStore.getState>['addRelation']
type UpdateNode = ReturnType<typeof useDiagramStore.getState>['updateNode']
type UpdateRelation = ReturnType<typeof useDiagramStore.getState>['updateRelation']
type TypeMeta = (type: string) => { label: string; color: string; fg: string; iconPath: string }

type TypeOption = { id: string; label: string; color: string }

// All node types known to the document, preferring the metamodel and falling
// back to the built-in C4 type list when no metamodel is present.
function allNodeTypeIds(metamodel: Metamodel): string[] {
  const fromMeta = metamodel?.nodeTypes ? Object.keys(metamodel.nodeTypes) : []
  if (fromMeta.length) return fromMeta
  return Object.keys(TYPE_LABELS)
}

// Node types that may be created as a child of `parent` (undefined → root),
// where it stands in the model: a group holds only what its place allows.
function childTypeOptions(
  metamodel: Metamodel,
  parent: C4Node | undefined,
  nodes: Record<string, C4Node>,
  typeMeta: TypeMeta,
): TypeOption[] {
  return allNodeTypeIds(metamodel)
    .filter((t) => isPlacementAllowed(metamodel, t, parent, nodes))
    .map((t) => ({ id: t, label: typeMeta(t).label, color: typeMeta(t).color }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// Resolve display metadata for a node type, preferring the document metamodel
// (supports custom types) and falling back to the built-in C4 constants.
function useTypeMeta(): TypeMeta {
  const metamodel = useDiagramStore((s) => s.metamodel)
  return useMemo(() => {
    return (type: string) => {
      const def = metamodel?.nodeTypes?.[type]
      return {
        label: def?.label ?? TYPE_LABELS[type as C4ElementType] ?? type,
        color: def?.color ?? NODE_COLORS[type as C4ElementType] ?? '#334155',
        fg: def?.fg ?? NODE_FG[type as C4ElementType] ?? '#fff',
        iconPath: def?.iconPath ?? TYPE_ICON_PATHS[type as C4ElementType] ?? '',
      }
    }
  }, [metamodel])
}

function TypeChip({ type, typeMeta }: { type: string; typeMeta: TypeMeta }): React.ReactElement {
  const meta = typeMeta(type)
  return (
    <span
      className="wiki-chip"
      style={{ background: `${meta.color}1f`, color: meta.color, borderColor: `${meta.color}55` }}
    >
      {meta.iconPath && (
        <svg viewBox="0 0 16 16" width="11" height="11" fill={meta.color}>
          <path d={meta.iconPath} />
        </svg>
      )}
      {meta.label}
    </span>
  )
}

// ─── Add menu (dropdown picker used to create nodes / relations) ─────────────

type AddMenuOption = { id: string; label: string; color?: string; sub?: string }

function AddMenu({
  label,
  options,
  emptyHint,
  onPick,
  variant = 'default',
}: {
  label: string
  options: AddMenuOption[]
  emptyHint?: string
  onPick: (id: string) => void
  variant?: 'default' | 'ghost'
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement | null>(null)
  useOutsideClick([ref], open, () => setOpen(false))

  const lower = query.trim().toLowerCase()
  const filtered = lower
    ? options.filter((o) => o.label.toLowerCase().includes(lower) || o.sub?.toLowerCase().includes(lower))
    : options

  return (
    <div className="wiki-add" ref={ref}>
      <button
        className={`wiki-add-btn ${variant === 'ghost' ? 'ghost' : ''}`}
        onClick={() => {
          setOpen((o) => !o)
          setQuery('')
        }}
      >
        <span className="wiki-add-plus">+</span>
        {label}
      </button>
      {open && (
        <div className="wiki-add-menu">
          {options.length > 6 && (
            <input
              className="wiki-add-search"
              placeholder="Search…"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className="wiki-add-list">
            {filtered.length === 0 ? (
              <div className="wiki-add-empty">{emptyHint ?? 'Nothing available'}</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  className="wiki-add-item"
                  onClick={() => {
                    onPick(o.id)
                    setOpen(false)
                  }}
                >
                  {o.color && <span className="wiki-add-dot" style={{ background: o.color }} />}
                  <span className="wiki-add-item-label">{o.label}</span>
                  {o.sub && <span className="wiki-add-item-sub">{o.sub}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── What can be done with an element ────────────────────────────────────────

// The element a menu is about and, when it was asked for on a link in a
// sentence about relations, that relation and the element the sentence is
// about (whose page edits it).
interface MenuTarget {
  nodeId?: string
  relation?: { id: string; ownerId: string }
}

type MenuPoint = { x: number; y: number; alignRight?: boolean }

// What the pages need from the view to act on the model: its one menu, the
// two editors that a menu opens in the page (a relation's line, the facts in
// the infobox), and the elements a line written under a heading stands for.
interface WikiActions {
  readOnly: boolean
  openMenu: (target: MenuTarget, at: MenuPoint) => void
  /** Add an element of `type` for each line, as children of `under` (null:
   *  at the top of the model). Returns the ids of the ones added. */
  write: (type: string, lines: string[], under: C4Node | null) => string[]
  editingRelation: { ownerId: string; relationId: string } | null
  setEditingRelation: (editing: { ownerId: string; relationId: string } | null) => void
  factsFor: string | null
  setFactsFor: (nodeId: string | null) => void
}

const WikiActionsContext = createContext<WikiActions | null>(null)

/** One content projection for the navigation, pages and glossary, also
 *  consumed by headless wiki exporters. Editing and presentation stay here. */
const WikiDocumentContext = createContext<WikiDocument | null>(null)

function useWikiActions(): WikiActions {
  const actions = useContext(WikiActionsContext)
  if (!actions) throw new Error('WikiActionsContext is missing')
  return actions
}

// Open the menu where a right click landed. A designer's only: a reader has
// nothing to do with an element but open it, and text being edited keeps the
// browser's own menu (copy, paste).
function menuOnRightClick(actions: WikiActions, target: MenuTarget): (e: React.MouseEvent) => void {
  return (e) => {
    if (actions.readOnly) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    e.preventDefault()
    e.stopPropagation()
    actions.openMenu(target, { x: e.clientX, y: e.clientY })
  }
}

// Open the menu under the button that asks for it: from its left edge, or
// from its right one for a button at the right of the page.
function menuUnderButton(
  actions: WikiActions,
  target: MenuTarget,
  alignRight = false,
): (e: React.MouseEvent<HTMLElement>) => void {
  return (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    actions.openMenu(target, { x: alignRight ? box.right : box.left, y: box.bottom + 4, alignRight })
  }
}

// Node types that may be created as a child of `node`: via allowedParents
// normally, or via the hierarchyRelation's allowedPairs (whichever types may
// derive from this node's type) when its type nests by a relation. Such a
// child sits beside `node`, in its container, and must be allowed there.
function childTypesOf(node: C4Node, nodes: Record<string, C4Node>, metamodel: Metamodel, typeMeta: TypeMeta): TypeOption[] {
  const hierarchy = metamodel?.nodeTypes[node.type]?.hierarchyRelation
  if (!hierarchy) return childTypeOptions(metamodel, node, nodes, typeMeta)
  const fromTypes = new Set(
    (metamodel?.relationTypes[hierarchy]?.allowedPairs ?? []).filter((p) => p.to === node.type).map((p) => p.from),
  )
  const container = node.parentId ? nodes[node.parentId] : undefined
  return [...fromTypes]
    .filter((t) => isPlacementAllowed(metamodel, t, container, nodes))
    .map((t) => ({ id: t, label: typeMeta(t).label, color: typeMeta(t).color }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// A way a new relation of `node` can read: a relation type from one of its
// ends ("Uses", "Used by"), with the elements it may then name.
interface RelationReading {
  key: string
  typeId: string | undefined
  direction: 'out' | 'in'
  text: string
  partners: C4Node[]
}

// A page or chapter for each of hundreds of elements (Multi page) asked
// the whole model for its relations and children: an index per model
// answers them, built once (frozen data: Studio's and the Hub's stores).
const touchingIndex = new WeakMap<object, Map<string, C4Relation[]>>()

/** The relations with `id` at either end, in the model's order. */
function relationsTouching(relations: Record<string, C4Relation>, id: string): C4Relation[] {
  if (!Object.isFrozen(relations)) return Object.values(relations).filter((r) => r.sourceId === id || r.targetId === id)
  let index = touchingIndex.get(relations)
  if (!index) {
    index = new Map()
    const add = (key: string, r: C4Relation) => { const list = index!.get(key); if (list) list.push(r); else index!.set(key, [r]) }
    for (const r of Object.values(relations)) {
      add(r.sourceId, r)
      if (r.targetId !== r.sourceId) add(r.targetId, r)
    }
    touchingIndex.set(relations, index)
  }
  return index.get(id) ?? []
}

function relationReadingsOf(
  node: C4Node,
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  visibleSet: Set<string> | null,
  metamodel: Metamodel,
): RelationReading[] {
  const others = Object.values(nodes).filter((n) => n.id !== node.id && (!visibleSet || visibleSet.has(n.id)))
  // What the element is already related to, by type and direction: a
  // sentence does not name an element twice.
  const related = new Set<string>()
  for (const r of Object.values(relations)) {
    const type = relationTypeForProse(r, nodes, metamodel ?? undefined) ?? ''
    if (r.sourceId === node.id) related.add(`out:${type}:${r.targetId}`)
    if (r.targetId === node.id) related.add(`in:${type}:${r.sourceId}`)
  }
  const defs = Object.values(metamodel?.relationTypes ?? {})
  // A model without relation types has one kind of relation, either way.
  if (defs.length === 0) {
    return (['out', 'in'] as const).map((direction) => ({
      key: direction,
      typeId: undefined,
      direction,
      text: relationPhrase(undefined, direction).text,
      partners: others.filter((n) => !related.has(`${direction}::${n.id}`)),
    }))
  }
  const readings: RelationReading[] = []
  for (const def of defs) {
    for (const direction of ['out', 'in'] as const) {
      const partners = others.filter((n) => {
        if (related.has(`${direction}:${def.id}:${n.id}`)) return false
        const [from, to] = direction === 'out' ? [node.type, n.type] : [n.type, node.type]
        return def.allowedPairs.length === 0 || def.allowedPairs.some((pair) => pair.from === from && pair.to === to)
      })
      if (partners.length === 0) continue
      const phrase = relationPhrase(def, direction)
      readings.push({
        key: `${direction}:${def.id}`,
        typeId: def.id,
        direction,
        text: phrase.reads ? capitalise(phrase.text) : `← ${def.label}`,
        partners,
      })
    }
  }
  return readings
}

export function WikiView(): React.ReactElement {
  const views = useDiagramStore((s) => s.views)
  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  const c4Relations = useDiagramStore((s) => s.c4Relations)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const updateNode = useDiagramStore((s) => s.updateNode)
  const updateRelation = useDiagramStore((s) => s.updateRelation)
  const requestCreateNode = useDiagramStore((s) => s.requestCreateNode)
  const addNodes = useDiagramStore((s) => s.addNodes)
  const removeNode = useDiagramStore((s) => s.removeNode)
  const addRelation = useDiagramStore((s) => s.addRelation)
  const removeRelation = useDiagramStore((s) => s.removeRelation)
  const pushNotification = useDiagramStore((s) => s.pushNotification)
  const setWikiFocus = useDiagramStore((s) => s.setWikiFocus)
  const setWikiPageMode = useDiagramStore((s) => s.setWikiPageMode)
  const appMode = useDiagramStore((s) => s.appMode)

  const readOnly = appMode !== 'designer'
  const typeMeta = useTypeMeta()

  const view = activeViewId ? views[activeViewId] : null
  const focusId = view?.wikiFocusId ?? null
  const pageMode = view?.wikiPageMode ?? 'single'

  const [filter, setFilter] = useState('')

  // How many levels 'multi' page mode embeds inline: the view's Depth, set
  // in its properties.
  const multiPageDepth = wikiDepthOf(view)

  const wikiDocument = useMemo(
    () => createWikiDocument(view, { nodes: c4Nodes, relations: c4Relations, metamodel }),
    [view, c4Nodes, c4Relations, metamodel],
  )
  const shownSet = wikiDocument.visibleSet
  const nodeList = wikiDocument.nodeList
  const childrenOf = wikiDocument.navigationChildren
  const glossary = focusId === GLOSSARY_FOCUS
  const focusNode = focusId && !glossary ? c4Nodes[focusId] : null
  const focus = focusNode && (!shownSet || shownSet.has(focusNode.id)) ? focusNode : null

  const goTo = (id: string | null) => {
    if (view) setWikiFocus(view.id, id)
  }

  const typeOrder = useMemo(() => allNodeTypeIds(metamodel), [metamodel])

  // The one menu of the view, and the editors a menu opens in a page.
  const [menu, setMenu] = useState<{ target: MenuTarget; at: MenuPoint } | null>(null)
  const [editingRelation, setEditingRelation] = useState<WikiActions['editingRelation']>(null)
  const [factsFor, setFactsFor] = useState<string | null>(null)
  // The elements written in a line under a heading: no wizard and no change
  // of page, so that the next one can be written at once. Where they go
  // follows from the page, as "Add child" of its menu has it.
  const writeElements: WikiActions['write'] = (type, lines, under) => {
    const hierarchy = under ? metamodel?.nodeTypes[under.type]?.hierarchyRelation : undefined
    const parentId = under ? (hierarchy ? under.parentId : under.id) : undefined
    const links: WizardLink[] = under && hierarchy ? [{ relationType: hierarchy, direction: 'out', otherId: under.id }] : []
    // The values the view's filter asks for, as the table gives them; what
    // the line says wins (a sentence's own EARS type).
    const filtered = newElementFilters(view ?? undefined, { nodes: c4Nodes, relations: c4Relations, metamodel }, type, under ? { node: under, link: links[0] } : undefined)
    const ids = addNodes(lines.map((line) => ({
      node: {
        type: type as C4ElementType,
        description: '',
        technology: '',
        collapsed: false,
        external: false,
        ...filtered?.properties,
        ...elementFromLine(type, line),
        parentId,
        x: 0,
        y: 0,
        ...nodeTypeSize(type, metamodel),
      },
      links,
    })))
    // Not lost from sight without a word, as in the table.
    const s = useDiagramStore.getState()
    const shown = viewShownNodes(s.activeViewId ? s.views[s.activeViewId] : undefined, s.c4Nodes, s.c4Relations)
    const hidden = shown ? ids.filter((id) => !shown.has(id)) : []
    if (hidden.length === 1) pushNotification(`${s.c4Nodes[hidden[0]]?.label ?? 'It'} was added, but this view's filter does not show it.`, 'warning')
    else if (hidden.length > 1) pushNotification(`${hidden.length} elements were added, but this view's filter does not show them.`, 'warning')
    return ids
  }

  const actions: WikiActions = {
    readOnly,
    openMenu: (target, at) => setMenu({ target, at }),
    write: writeElements,
    editingRelation,
    setEditingRelation,
    factsFor,
    setFactsFor,
  }

  // Create a node of `type` (optionally inside `parentId`), then navigate to
  // it — once its wizard finishes, when the type has one. requestCreateNode
  // validates metamodel rules and emits its own error toast on failure.
  // `link` is created along with the node (and offered pre-checked by the
  // wizard) — e.g. the hierarchyRelation edge for a Requirement "deriving
  // from" the one it's a child of (see WikiElementPage's onCreateChild).
  const createNode = (type: string, parentId: string | undefined, link?: WizardLink) => {
    const def = metamodel?.nodeTypes[type]
    const label = `New ${def?.label ?? TYPE_LABELS[type as C4ElementType] ?? type}`
    const size = nodeTypeSize(type, metamodel)
    requestCreateNode({
      type: type as C4ElementType,
      label,
      description: '',
      technology: '',
      collapsed: false,
      external: false,
      parentId,
      x: 0,
      y: 0,
      ...size,
    }, {
      links: link ? [link] : [],
      onCreated: (id) => {
        const created = useDiagramStore.getState().c4Nodes[id]?.label ?? label
        pushNotification(`${created} added.`, 'info')
        goTo(id)
      },
    })
  }

  const deleteNode = (id: string) => {
    const target = c4Nodes[id]
    if (!target) return
    const kids = Object.values(c4Nodes).filter((n) => n.parentId === id)
    const extra = kids.length ? ` and its ${kids.length} child element${kids.length === 1 ? '' : 's'}` : ''
    if (!window.confirm(`Delete "${target.label}"${extra}? This cannot be undone from here.`)) return
    const parentId = target.parentId ?? null
    removeNode(id)
    pushNotification(`"${target.label}" deleted.`, 'info')
    if (focusId === id || (focusId && !c4Nodes[focusId])) goTo(parentId)
  }

  const createRelation = (sourceId: string, targetId: string, relationType?: string) => {
    addRelation({ sourceId, targetId, ...(relationType ? { relationType } : {}) })
  }

  const deleteRelation = (id: string) => {
    removeRelation(id)
  }

  if (!view) {
    return (
      <div className="wiki-view">
        <div className="wiki-empty">No active view.</div>
      </div>
    )
  }

  // Elements by type as the pages list them, for the lists of a menu.
  const byTypeThenName = (a: C4Node, b: C4Node): number => {
    const rank = (type: string): number => (typeOrder.indexOf(type) < 0 ? typeOrder.length : typeOrder.indexOf(type))
    return rank(a.type) - rank(b.type) || a.label.localeCompare(b.label)
  }

  // "Add relationship", in two steps that read as the sentence the page
  // will then write: how the relation reads from this element ("Uses…",
  // "Constrained by…"), then the element it names.
  const relationshipPage = (node: C4Node): WikiMenuPage => ({
    title: 'Add relationship',
    emptyHint: 'No relation is allowed from here',
    items: relationReadingsOf(node, c4Nodes, c4Relations, shownSet, metamodel).map((reading) => ({
      id: reading.key,
      label: `${reading.text}…`,
      page: () => ({
        title: reading.text,
        items: [...reading.partners].sort(byTypeThenName).map((other) => ({
          id: other.id,
          label: other.label,
          color: typeMeta(other.type).color,
          group: capitalise(typeNoun(typeMeta(other.type).label, true)),
          onSelect: () =>
            reading.direction === 'out'
              ? createRelation(node.id, other.id, reading.typeId)
              : createRelation(other.id, node.id, reading.typeId),
        })),
      }),
    })),
  })

  const menuPage = (target: MenuTarget): WikiMenuPage => {
    const node = target.nodeId ? c4Nodes[target.nodeId] : undefined
    const items: WikiMenuItem[] = []
    const relation = target.relation
    if (relation) {
      items.push({
        id: 'relation-edit',
        label: 'Edit relationship',
        onSelect: () => setEditingRelation({ ownerId: relation.ownerId, relationId: relation.id }),
      })
      items.push({ id: 'relation-remove', label: 'Remove relationship', danger: true, onSelect: () => deleteRelation(relation.id) })
    }
    if (node && node.id !== focusId) {
      items.push({
        id: 'open',
        label: relation ? `Open ${node.label}` : 'Open page',
        separated: true,
        onSelect: () => goTo(node.id),
      })
    }
    if (node && !relation) {
      const categoryRank = (type: string): number => NODE_TYPE_CATEGORIES.findIndex((c) => c.types.includes(type))
      const childTypes = childTypesOf(node, c4Nodes, metamodel, typeMeta).sort((a, b) => categoryRank(a.id) - categoryRank(b.id))
      if (childTypes.length > 0) {
        items.push({
          id: 'add-child',
          label: 'Add child',
          separated: true,
          page: () => ({
            title: 'Add child',
            items: childTypes.map((type) => ({
              id: type.id,
              label: type.label,
              color: type.color,
              group: nodeTypeCategory(type.id).label,
              onSelect: () => {
                // A type that nests by a relation (a requirement under a
                // need) becomes a child through that relation, in the same
                // container as `node`; any other is placed inside `node`.
                const hierarchy = metamodel?.nodeTypes[node.type]?.hierarchyRelation
                if (hierarchy) createNode(type.id, node.parentId, { relationType: hierarchy, direction: 'out', otherId: node.id })
                else createNode(type.id, node.id)
              },
            })),
          }),
        })
      }
      items.push({
        id: 'add-relationship',
        label: 'Add relationship',
        separated: childTypes.length === 0,
        page: () => relationshipPage(node),
      })
      items.push({
        id: 'facts',
        label: 'Edit facts',
        onSelect: () => {
          if (focusId !== node.id) goTo(node.id)
          setFactsFor(node.id)
        },
      })
      items.push({ id: 'delete', label: 'Delete', danger: true, separated: true, onSelect: () => deleteNode(node.id) })
    }
    return { items }
  }

  return (
    <WikiActionsContext.Provider value={actions}>
    <WikiDocumentContext.Provider value={wikiDocument}>
    <div className="wiki-view">
      <WikiNav
        filter={filter}
        setFilter={setFilter}
        childrenOf={childrenOf}
        nodes={c4Nodes}
        relations={c4Relations}
        metamodel={metamodel}
        typeOrder={typeOrder}
        focusId={focusId}
        onSelect={goTo}
        typeMeta={typeMeta}
      />
      <div className="wiki-page">
        <div className="wiki-page-mode-toggle">
          <button
            className={pageMode === 'single' ? 'active' : ''}
            onClick={() => view && setWikiPageMode(view.id, 'single')}
            title="One element per page: its children are named and linked"
          >
            Single page
          </button>
          <button
            className={pageMode === 'multi' ? 'active' : ''}
            onClick={() => view && setWikiPageMode(view.id, 'multi')}
            title="One article: the children are chapters of this page"
          >
            Multi page
          </button>
        </div>
        {glossary ? (
          <WikiGlossary
            metamodel={metamodel}
            typeMeta={typeMeta}
          />
        ) : focus ? (
          <WikiElementPage
            key={focus.id}
            node={focus}
            nodes={c4Nodes}
            relations={c4Relations}
            visibleSet={shownSet}
            metamodel={metamodel}
            updateNode={updateNode}
            updateRelation={updateRelation}
            onNavigate={goTo}
            onDeleteRelation={deleteRelation}
            readOnly={readOnly}
            typeMeta={typeMeta}
            pageMode={pageMode}
            remainingDepth={multiPageDepth}
          />
        ) : (
          <WikiOverview
            roots={childrenOf['__root__'] ?? []}
            nodes={c4Nodes}
            relations={c4Relations}
            visibleSet={shownSet}
            metamodel={metamodel}
            updateNode={updateNode}
            updateRelation={updateRelation}
            onNavigate={goTo}
            onCreateRoot={(type) => createNode(type, undefined)}
            onDeleteRelation={deleteRelation}
            readOnly={readOnly}
            totalNodes={nodeList.length}
            totalRelations={Object.keys(c4Relations).length}
            typeMeta={typeMeta}
            pageMode={pageMode}
            remainingDepth={multiPageDepth}
          />
        )}
      </div>
      {menu && !readOnly && (
        <WikiMenu
          // A menu asked for elsewhere is a new menu, not this one moved.
          key={`${menu.at.x}:${menu.at.y}:${menu.target.nodeId ?? ''}:${menu.target.relation?.id ?? ''}`}
          at={menu.at}
          root={menuPage(menu.target)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
    </WikiDocumentContext.Provider>
    </WikiActionsContext.Provider>
  )
}

// ─── Navigation (left column) ────────────────────────────────────────────────

// A group (GROUP_TYPE) is how a model is divided, not a kind of thing in it:
// the wiki speaks of a group by its name and description and never calls it
// a group.

// The page that is not about an element: the wiki's glossary. It is a focus
// like any other, so it has an address and is remembered with the view.
const GLOSSARY_FOCUS = '_glossary'
// The glossary entry a link to the glossary asked for, until the page shows it.
let pendingGlossaryEntry: string | null = null
const glossaryEntryId = (kind: 'type' | 'relation', id: string): string => `wiki-g-${kind}-${id}`

// The elements at the top of the model have this in place of a parent.
const NAV_ROOT = '__root__'
// Up to this many children of one type are listed straight under their
// parent, and a group of a type is open to begin with.
const NAV_PLAIN_LIST = 12
const typeGroupKey = (parentId: string, type: string): string => `${parentId}:${type}`

// The pages of the wiki as a tree, laid out as the articles are, at every
// level: groups first, under their own names, then the other elements under
// a row for each type with its count ("Requirements 46"), in the order of
// the metamodel's types. A branch is closed until it is opened or the page
// being read is inside it, so a large model is a short list.
function WikiNav({
  filter,
  setFilter,
  childrenOf,
  nodes,
  relations,
  metamodel,
  typeOrder,
  focusId,
  onSelect,
  typeMeta,
}: {
  filter: string
  setFilter: (v: string) => void
  childrenOf: Record<string, C4Node[]>
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  metamodel: Metamodel
  /** Node type ids in the order of the metamodel. */
  typeOrder: string[]
  focusId: string | null
  onSelect: (id: string | null) => void
  typeMeta: TypeMeta
}): React.ReactElement {
  const actions = useWikiActions()
  // What is open in the tree: a branch, by the id of its element, or a group
  // of one type inside a branch ("Requirements" under a group), by
  // `typeGroupKey`. The page being read is always in the tree: what leads to
  // it is open unless the reader closed it by hand.
  const [byHand, setByHand] = useState<ReadonlyMap<string, boolean>>(() => new Map())
  const lower = filter.trim().toLowerCase()
  const aroundFocus = useMemo(() => {
    const keys = new Set<string>()
    for (let id: string | undefined = focusId ?? undefined; id && nodes[id] && !keys.has(id); id = nodes[id].parentId ?? undefined) {
      keys.add(id)
      keys.add(typeGroupKey(nodes[id].parentId ?? NAV_ROOT, nodes[id].type))
    }
    return keys
  }, [focusId, nodes])
  const isOpen = (key: string, byDefault = false): boolean => byHand.get(key) ?? (aroundFocus.has(key) || byDefault)

  // The pages the search finds: by name, or by what the page says.
  const hits = useMemo(() => {
    const found = new Map<string, WikiSearchHit>()
    if (!lower) return found
    for (const list of Object.values(childrenOf)) {
      for (const n of list) {
        const hit = wikiSearchHit(n, lower, nodes, relations, metamodel)
        if (hit) found.set(n.id, hit)
      }
    }
    return found
  }, [lower, childrenOf, nodes, relations, metamodel])
  const toggle = (key: string, byDefault = false): void =>
    setByHand((prev) => new Map(prev).set(key, !isOpen(key, byDefault)))

  // Bring the page being read into sight when it changes.
  const treeRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    treeRef.current?.querySelector('.wiki-nav-item.active')?.scrollIntoView({ block: 'nearest' })
  }, [focusId])

  const rank = (type: string): number => {
    const i = typeOrder.indexOf(type)
    return i < 0 ? typeOrder.length : i
  }
  const byName = (a: C4Node, b: C4Node): number => a.label.localeCompare(b.label)

  // The pages under `parentId`, as the articles list them: groups first,
  // under their own names, then the other elements under a row for each
  // type with its count. The rows are left out where they would only add a
  // level: under an element whose few children are all of one type.
  const renderChildren = (parentId: string, depth: number): React.ReactNode[] => {
    const kids = childrenOf[parentId] ?? []
    const out: React.ReactNode[] = kids.filter((n) => n.type === GROUP_TYPE).sort(byName).map((n) => renderNode(n, depth))
    const typed = kids.filter((n) => n.type !== GROUP_TYPE)
    const types = [...new Set(typed.map((n) => n.type))].sort((a, b) => rank(a) - rank(b))
    const atRoot = parentId === NAV_ROOT
    if (!atRoot && types.length < 2 && typed.length <= NAV_PLAIN_LIST) {
      return [...out, ...typed.sort(byName).map((n) => renderNode(n, depth))]
    }
    for (const type of types) {
      const items = typed.filter((n) => n.type === type).sort(byName)
      const key = typeGroupKey(parentId, type)
      // A short list is open to begin with; a long one waits to be opened.
      const byDefault = atRoot || typed.length <= NAV_PLAIN_LIST
      const open = lower ? true : isOpen(key, byDefault)
      const rendered = open ? items.map((n) => renderNode(n, depth + 1)) : []
      // A type the search leaves nothing in is not shown.
      if (lower && rendered.every((r) => !r)) continue
      out.push(
        <div className="wiki-nav-section" key={key}>
          <button
            className="wiki-nav-section-head"
            style={{ paddingLeft: 10 + depth * 13 }}
            aria-expanded={open}
            onClick={() => toggle(key, byDefault)}
          >
            <span className={`wiki-nav-section-chevron ${open ? '' : 'collapsed'}`}>▾</span>
            {typeNoun(typeMeta(type).label, true)}
            <span className="wiki-nav-section-count">{items.length}</span>
          </button>
          {rendered}
        </div>,
      )
    }
    return out
  }

  const renderNode = (n: C4Node, depth: number): React.ReactNode => {
    const hit = hits.get(n.id)
    const matches = !lower || !!hit
    const hasKids = (childrenOf[n.id]?.length ?? 0) > 0
    // While searching, every branch with a match in it is shown open.
    const open = lower ? true : isOpen(n.id)
    const childNodes = open && hasKids ? renderChildren(n.id, depth + 1) : []
    if (lower && !matches && !childNodes.some(Boolean)) return null
    const meta = typeMeta(n.type)
    return (
      <div key={n.id}>
        <div
          className="wiki-nav-row"
          style={{ paddingLeft: 4 + depth * 13 }}
          onContextMenu={menuOnRightClick(actions, { nodeId: n.id })}
        >
          {hasKids ? (
            <button
              className="wiki-nav-toggle"
              aria-expanded={open}
              aria-label={`${open ? 'Collapse' : 'Expand'} ${n.label}`}
              onClick={() => toggle(n.id)}
            >
              <span className={`wiki-nav-section-chevron ${open ? '' : 'collapsed'}`}>▾</span>
            </button>
          ) : (
            <span className="wiki-nav-toggle" />
          )}
          {/* While searching, a page that is listed only because it leads
              to a match is quieter than the matches themselves. */}
          <button
            className={`wiki-nav-item ${focusId === n.id ? 'active' : ''} ${hit ? 'match' : lower ? 'path' : ''}`}
            onClick={() => onSelect(n.id)}
            title={n.label}
          >
            <span className="wiki-nav-dot" style={{ background: meta.color }} />
            <span className="wiki-nav-text">
              {hit && hit.nameAt >= 0 ? (
                <>
                  {n.label.slice(0, hit.nameAt)}
                  <mark className="wiki-nav-mark">{n.label.slice(hit.nameAt, hit.nameAt + lower.length)}</mark>
                  {n.label.slice(hit.nameAt + lower.length)}
                </>
              ) : (
                n.label
              )}
            </span>
          </button>
        </div>
        {/* Found by what its page says: the words around the match. */}
        {hit?.snippet && (
          <button
            className="wiki-nav-snippet"
            tabIndex={-1}
            style={{ paddingLeft: 42 + depth * 13 }}
            onClick={() => onSelect(n.id)}
          >
            {hit.snippet.field && <span className="wiki-nav-snippet-field">{hit.snippet.field}: </span>}
            {hit.snippet.before}
            <mark className="wiki-nav-mark">{hit.snippet.match}</mark>
            {hit.snippet.after}
          </button>
        )}
        {childNodes}
      </div>
    )
  }

  const tree = renderChildren(NAV_ROOT, 0)
  return (
    <div className="wiki-nav">
      {/* First, as the glossary is last: the page about the whole model. */}
      <button
        className={`wiki-nav-item wiki-nav-home wiki-nav-front ${focusId === null ? 'active' : ''}`}
        title="The whole model, from its top"
        onClick={() => onSelect(null)}
      >
        <span className="wiki-nav-text">Overview</span>
      </button>
      <div className="wiki-nav-head">
        Pages
        {byHand.size > 0 && (
          <button
            className="wiki-nav-reset"
            title="Close every branch but the one that leads to the page being read"
            onClick={() => setByHand(new Map())}
          >
            collapse
          </button>
        )}
      </div>
      <input
        type="search"
        className="wiki-nav-search"
        placeholder="Search pages…"
        aria-label="Search pages"
        title="Searches the names of the pages and what they say"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onKeyDown={(e) => {
          // Enter opens the first page found.
          if (e.key === 'Enter') treeRef.current?.querySelector<HTMLElement>('.wiki-nav-item.match')?.click()
        }}
      />
      <div className="wiki-nav-tree" ref={treeRef}>
        {tree}
        {lower && !tree.some(Boolean) && <div className="wiki-nav-empty">No page matches “{filter.trim()}”.</div>}
      </div>
      {/* Last, as an appendix is: what the words of the pages above mean. */}
      <button
        className={`wiki-nav-item wiki-nav-home wiki-nav-appendix ${focusId === GLOSSARY_FOCUS ? 'active' : ''}`}
        title="The kinds of element and relation this model is written in"
        onClick={() => onSelect(GLOSSARY_FOCUS)}
      >
        <span className="wiki-nav-text">Glossary</span>
      </button>
    </div>
  )
}

// ─── Overview page ───────────────────────────────────────────────────────────

// A link inside a sentence. A <button> is one box that never breaks across
// lines, so a long name would jump to the next line whole; this wraps like
// the words around it.
function WikiTextLink({ className = '', onOpen, children }: {
  className?: string
  onOpen: () => void
  children: React.ReactNode
}): React.ReactElement {
  return (
    <span
      role="link"
      tabIndex={0}
      className={`wiki-link ${className}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
    >
      {children}
    </span>
  )
}

// "A, B and C": the way a sentence lists things.
function proseList(items: React.ReactElement[]): React.ReactNode[] {
  return items.flatMap((item, i) => (i === 0 ? [item] : [i === items.length - 1 ? ' and ' : ', ', item]))
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// What a page says about an element it only mentions: the start of its
// description, or the sentence of a requirement that has none (both Markdown).
function partSummary(node: C4Node, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): string {
  const text = firstParagraph(node.description)
  if (text || node.type !== 'requirement') return text
  const { sentence, complete } = composeEarsSentence(
    node as unknown as Record<string, unknown>,
    resolveEarsSubject(node.id, relations, nodes),
    requirementStatePhrase(node, nodes, relations) || undefined,
  )
  return complete ? sentence : ''
}

function wireframeOf(node: C4Node): string | undefined {
  const wireframe = (node as unknown as Record<string, unknown>).wireframe
  return node.type === 'mockup' && typeof wireframe === 'string' ? wireframe : undefined
}

// An element named in running text: a link to its page. For a designer a
// right click opens the element's menu, and so does a button that shows on
// hover and takes no room in the line.
function WikiPartRef({ node, onOpen }: { node: C4Node; onOpen: () => void }): React.ReactElement {
  const actions = useWikiActions()
  const target: MenuTarget = { nodeId: node.id }
  return (
    <span className="wiki-ref" onContextMenu={menuOnRightClick(actions, target)}>
      <WikiTextLink className="wiki-part-name" onOpen={onOpen}>{node.label}</WikiTextLink>
      {!actions.readOnly && (
        <button
          className="wiki-ref-btn"
          title="What can be done with this element"
          aria-haspopup="menu"
          aria-label={`Actions for ${node.label}`}
          onClick={menuUnderButton(actions, target)}
        >
          <span>⋯</span>
        </button>
      )}
    </span>
  )
}

// A group of elements that a page only names. A few get a paragraph each,
// opening with the name; more than that are a run of links, and a long run
// shows its start until it is asked for the rest.
const PARAGRAPH_EACH = 6
const LINK_RUN = 24
// A run only a little longer than that is shown whole: hiding its last few
// links would save nothing.
const LINK_RUN_SLACK = 12

function WikiPartList({ parts, paragraphs = false, nodes, relations, onNavigate }: {
  parts: C4Node[]
  /** A paragraph each, however many there are. */
  paragraphs?: boolean
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  onNavigate: (id: string) => void
}): React.ReactElement {
  const [all, setAll] = useState(false)
  const ref = (n: C4Node): React.ReactElement => (
    <WikiPartRef key={n.id} node={n} onOpen={() => onNavigate(n.id)} />
  )
  if (!paragraphs && parts.length > PARAGRAPH_EACH) {
    const foldable = parts.length > LINK_RUN + LINK_RUN_SLACK
    const shown = all || !foldable ? parts : parts.slice(0, LINK_RUN)
    return (
      <p className="wiki-text wiki-link-run">
        {shown.flatMap((n, i) => (i === 0 ? [ref(n)] : [<span className="wiki-link-run-sep" key={`sep-${n.id}`}> · </span>, ref(n)]))}
        {foldable && (
          <>
            {' '}
            <button className="wiki-tool" aria-expanded={all} onClick={() => setAll((on) => !on)}>
              {all ? 'show fewer' : `show all ${parts.length}`}
            </button>
          </>
        )}
      </p>
    )
  }
  return (
    <>
      {parts.map((n) => {
        const summary = partSummary(n, nodes, relations)
        const wireframe = wireframeOf(n)
        return (
          <p className="wiki-text wiki-part" key={n.id}>
            {ref(n)}
            {summary && <> — <MarkdownText inline text={summary} /></>}
            {wireframe && <img className="wiki-card-thumb" src={wireframeDataUri(wireframe)} alt="" />}
          </p>
        )
      })}
    </>
  )
}

// The elements under a page or a chapter (an element's children, the
// overview's roots), always grouped by type under a heading with their
// count: "Requirements (12)", "Scenarios (5)", in the order of the
// metamodel's types. The elements of a type are written out as chapters a
// level below its heading (`renderChapter`, in Multi page mode) or only
// named and linked. Groups come first and take the place of such a heading
// themselves: each is a chapter at the heading's level, or a paragraph that
// opens with its name and goes on with its description.
//
// For a designer a group of a type ends with a line to write the next
// element in (`writeUnder`), and the page or chapter with the types it has
// none of yet (`starters`): choosing one opens its heading with such a line.
function WikiChildren({
  parts,
  level,
  idPrefix,
  nodes,
  relations,
  metamodel,
  typeMeta,
  onNavigate,
  renderChapter,
  writeUnder,
  starters,
  startHint = 'Add',
}: {
  parts: C4Node[]
  /** The heading level of a group; its chapters are one below. */
  level: number
  idPrefix: string
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  metamodel: Metamodel
  typeMeta: TypeMeta
  onNavigate: (id: string) => void
  renderChapter?: (node: C4Node, level: number) => React.ReactNode
  /** The element whose children these are, or null for the top of the
   *  model: what is written here is added to it. Left out, nothing is. */
  writeUnder?: C4Node | null
  /** Offer the types that have no element here yet: all of them on the
   *  element's own page, in a chapter all but more of its own type (a
   *  requirement refined into requirements is written on its page), so
   *  that an article of many chapters is not a list of offers. */
  starters?: 'page' | 'chapter'
  /** What the offer of those types opens with. */
  startHint?: string
}): React.ReactElement {
  const actions = useWikiActions()
  const order = allNodeTypeIds(metamodel)
  const rank = (type: string): number => (order.indexOf(type) < 0 ? order.length : order.indexOf(type))
  // The types that may be written here. A group is how the model is
  // divided, not something a line of text names: it is added from the menu.
  const writable = writeUnder === undefined || actions.readOnly
    ? []
    : (writeUnder ? childTypesOf(writeUnder, nodes, metamodel, typeMeta) : childTypeOptions(metamodel, undefined, nodes, typeMeta))
        .filter((t) => t.id !== GROUP_TYPE)
        .sort((a, b) => rank(a.id) - rank(b.id))
  // The headings opened to write the first element of a type under.
  const [started, setStarted] = useState<string[]>([])
  // What has been written here since the page opened, by type. It stays
  // under the rest of its group in the order of writing, each written out,
  // so that a list grows where it is being written: in order of name the
  // next line would land somewhere among the others, or out of sight.
  const [written, setWritten] = useState<Record<string, string[]>>({})
  const groups = parts.filter((n) => n.type === GROUP_TYPE)
  const types = [...new Set([...parts.map((n) => n.type), ...started])]
    .filter((type) => type !== GROUP_TYPE)
    .sort((a, b) => rank(a) - rank(b))
  const toStart = starters
    ? writable.filter((t) => !types.includes(t.id) && (starters === 'page' || t.id !== writeUnder?.type))
    : []
  const Heading = `h${Math.min(level, 6)}` as 'h2'
  return (
    <>
      {groups.length > 0 && renderChapter && groups.map((n) => renderChapter(n, level))}
      {groups.length > 0 && !renderChapter && (
        <div className="wiki-block">
          <WikiPartList
            parts={groups}
            paragraphs
            nodes={nodes}
            relations={relations}
            onNavigate={onNavigate}
          />
        </div>
      )}
      {types.map((type) => {
        const group = parts.filter((n) => n.type === type)
        const fresh = (written[type] ?? []).map((id) => group.find((n) => n.id === id)).filter((n): n is C4Node => !!n)
        const settled = fresh.length > 0 ? group.filter((n) => !fresh.includes(n)) : group
        const title = capitalise(typeNoun(typeMeta(type).label, true))
        return (
          <section className="wiki-block wiki-group" key={type}>
            <Heading
              id={`${idPrefix}-type-${type}`}
              className="wiki-heading"
              data-toc={title}
              {...(group.length > 0 ? { 'data-toc-count': group.length } : {})}
              data-level={level}
            >
              {title}{group.length > 0 && <> <span className="wiki-heading-count">({group.length})</span></>}
            </Heading>
            {/* What the type is. A page says it once, where it first names
                the type (see useFirstMentions). */}
            {metamodel?.nodeTypes[type]?.description && (
              <p className="wiki-hatnote" data-first-mention={type}>{metamodel.nodeTypes[type].description}</p>
            )}
            {renderChapter ? (
              [...settled, ...fresh].map((n) => renderChapter(n, level + 1))
            ) : (
              <>
                {settled.length > 0 && (
                  <WikiPartList
                    parts={settled}
                    nodes={nodes}
                    relations={relations}
                    onNavigate={onNavigate}
                  />
                )}
                {fresh.length > 0 && (
                  <WikiPartList
                    parts={fresh}
                    paragraphs
                    nodes={nodes}
                    relations={relations}
                    onNavigate={onNavigate}
                  />
                )}
              </>
            )}
            {writeUnder !== undefined && writable.some((t) => t.id === type) && (
              <WikiWriteLine
                type={type}
                typeLabel={typeMeta(type).label}
                under={writeUnder}
                autoFocus={started.includes(type) && group.length === 0}
                onWritten={(ids) => setWritten((before) => ({ ...before, [type]: [...(before[type] ?? []), ...ids] }))}
              />
            )}
          </section>
        )
      })}
      {toStart.length > 0 && (
        <WikiStartRow
          hint={startHint}
          types={toStart}
          under={writeUnder ?? null}
          nodes={nodes}
          metamodel={metamodel}
          folded={starters === 'chapter'}
          onStart={(type) => setStarted((open) => [...open, type])}
        />
      )}
    </>
  )
}

// The types a page or chapter has no element of yet, each a link that opens
// its heading to write the first one under. A few are a line of links. Of
// many, the line names the ones the element's peers already hold (a new
// group beside groups of needs and requirements is offered those) and keeps
// the rest behind "more"; with no peers to go by, they are listed by the
// category the palette has them in, which a chapter shows only when asked.
const START_LINE = 6

function WikiStartRow({ hint, types, under, nodes, metamodel, folded, onStart }: {
  hint: string
  types: TypeOption[]
  under: C4Node | null
  nodes: Record<string, C4Node>
  metamodel: Metamodel
  folded: boolean
  onStart: (type: string) => void
}): React.ReactElement {
  const [all, setAll] = useState(false)
  // What the elements like this one, in the same place, are made of.
  const usedByPeers = useMemo(() => {
    const used = new Set<string>()
    if (!under || types.length <= START_LINE) return used
    const peers = new Set(
      Object.values(nodes)
        .filter((n) => n.id !== under.id && n.type === under.type && (n.parentId ?? null) === (under.parentId ?? null))
        .map((n) => n.id),
    )
    for (const n of Object.values(nodes)) {
      if (n.parentId && peers.has(n.parentId)) used.add(n.type)
    }
    return used
  }, [nodes, under, types.length])

  const first = types.length <= START_LINE ? types : types.filter((t) => usedByPeers.has(t.id))
  const rest = types.filter((t) => !first.includes(t))
  const listed = rest.length > 0 && (all || (first.length === 0 && !folded))
  const categories = [...NODE_TYPE_CATEGORIES, { ...CUSTOM_CATEGORY, types: [] as string[] }]
    .map((category) => ({
      ...category,
      types: rest.filter((t) => nodeTypeCategory(t.id).id === category.id),
    }))
    .filter((category) => category.types.length > 0)

  const links = (of: TypeOption[]): React.ReactNode =>
    of.map((t, i) => (
      // The dot stays with the name before it: no line starts with one.
      <React.Fragment key={t.id}>
        <span className="wiki-write-start-type">
          <button
            className="wiki-link"
            title={metamodel?.nodeTypes[t.id]?.description}
            onClick={() => {
              // The list has done its work: what is left is offered folded again.
              setAll(false)
              onStart(t.id)
            }}
          >
            {capitalise(typeNoun(t.label, true))}
          </button>
          {i < of.length - 1 && <span className="wiki-link-run-sep"> ·</span>}
        </span>{' '}
      </React.Fragment>
    ))

  return (
    <div className="wiki-write-start">
      <p className="wiki-write-start-line">
        <span className="wiki-write-start-hint">{hint}:</span>{' '}
        {links(first)}
        {rest.length > 0 && !listed && (
          <button className="wiki-tool" aria-expanded={false} onClick={() => setAll(true)}>
            {first.length > 0 ? 'more' : 'choose what'}
          </button>
        )}
      </p>
      {listed && (
        <dl className="wiki-write-start-list">
          {categories.map((category) => (
            <React.Fragment key={category.id}>
              <dt>{category.label}</dt>
              <dd>{links(category.types)}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}

// The line a group of elements ends with for a designer: what is typed in
// it and entered becomes the next element of the group, right above, and
// the line stays for the one after. A requirement is written as its
// sentence, anything else is named. A pasted list is an element for each of
// its lines, once that is confirmed.
const WRITE_PREVIEW = 5

function WikiWriteLine({ type, typeLabel, under, autoFocus = false, onWritten }: {
  type: string
  typeLabel: string
  under: C4Node | null
  autoFocus?: boolean
  /** The ids of the elements the line has just added. */
  onWritten: (ids: string[]) => void
}): React.ReactElement {
  const actions = useWikiActions()
  const [draft, setDraft] = useState('')
  const [pasted, setPasted] = useState<string[] | null>(null)
  const [writes, setWrites] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])
  useEffect(() => {
    if (pasted) confirmRef.current?.focus()
  }, [pasted])
  // What was written is now above the line and has pushed it down, a whole
  // chapter at a time in Multi page: the line stays where it can be seen.
  // A frame later, once the page has settled (its contents box may grow).
  useEffect(() => {
    if (writes === 0) return
    const frame = requestAnimationFrame(() => inputRef.current?.scrollIntoView({ block: 'nearest' }))
    return () => cancelAnimationFrame(frame)
  }, [writes])

  const write = (lines: string[]): boolean => {
    const ids = actions.write(type, lines, under)
    if (ids.length === 0) return false
    onWritten(ids)
    setWrites((n) => n + 1)
    return true
  }
  const enter = (): void => {
    const lines = writtenLines(draft)
    if (lines.length === 0) return
    if (!write(lines)) return
    setDraft('')
    if (inputRef.current) inputRef.current.style.height = ''
  }
  const closePasted = (): void => {
    setPasted(null)
    inputRef.current?.focus()
  }

  const noun = typeNoun(typeLabel)
  return (
    <div className="wiki-write">
      <textarea
        ref={inputRef}
        className="wiki-write-input"
        rows={1}
        value={draft}
        aria-label={`Write a ${noun}`}
        placeholder={
          type === 'requirement'
            ? 'Write a requirement: “When a payment fails, the system shall tell the customer”'
            : `Name a new ${noun}`
        }
        onChange={(e) => {
          setDraft(e.target.value)
          autoSize(e.target)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            enter()
          }
          if (e.key === 'Escape') {
            setDraft('')
            e.currentTarget.blur()
          }
        }}
        onPaste={(e) => {
          const lines = writtenLines(e.clipboardData.getData('text/plain'))
          if (lines.length < 2) return
          e.preventDefault()
          setPasted(lines)
        }}
      />
      <span className="wiki-write-hint">Enter adds it. Paste a list to add one for each line.</span>
      {pasted && (
        <div
          className="wiki-write-pasted"
          role="group"
          aria-label="Pasted lines"
          onKeyDown={(e) => {
            if (e.key === 'Escape') closePasted()
          }}
        >
          <ol className="wiki-write-preview">
            {pasted.slice(0, WRITE_PREVIEW).map((line, i) => (
              <li key={i}>{elementFromLine(type, line).label}</li>
            ))}
          </ol>
          {pasted.length > WRITE_PREVIEW && (
            <p className="wiki-write-more">and {pasted.length - WRITE_PREVIEW} more</p>
          )}
          <div className="wiki-write-actions">
            <button
              ref={confirmRef}
              className="wiki-add-btn"
              onClick={() => {
                if (write(pasted)) closePasted()
              }}
            >
              Add {countedNoun(pasted.length, [typeLabel])}
            </button>
            <button className="wiki-tool" onClick={closePasted}>cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function WikiOverview({
  roots,
  nodes,
  relations,
  visibleSet,
  metamodel,
  updateNode,
  updateRelation,
  onNavigate,
  onCreateRoot,
  onDeleteRelation,
  readOnly,
  totalNodes,
  totalRelations,
  typeMeta,
  pageMode,
  remainingDepth = 1,
}: {
  roots: C4Node[]
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  visibleSet: Set<string> | null
  metamodel: Metamodel
  updateNode: UpdateNode
  updateRelation: UpdateRelation
  onNavigate: (id: string) => void
  onCreateRoot: (type: string) => void
  onDeleteRelation: (id: string) => void
  readOnly: boolean
  totalNodes: number
  totalRelations: number
  typeMeta: TypeMeta
  /** Mirrors WikiElementPage's pageMode — 'multi' embeds each root element's
   *  full content inline on the Overview page instead of naming them. */
  pageMode: 'single' | 'multi'
  remainingDepth?: number
}): React.ReactElement {
  const rootTypes = useMemo(
    () => childTypeOptions(metamodel, undefined, nodes, typeMeta),
    [metamodel, typeMeta],
  )
  const articleRef = useRef<HTMLElement | null>(null)
  useFirstMentions(articleRef)
  return (
    <article className="wiki-doc" ref={articleRef}>
      <header className="wiki-doc-header">
        <div className="wiki-title-row">
          <h1 className="wiki-title">Overview</h1>
          {!readOnly && (
            <AddMenu
              label="Add element"
              options={rootTypes}
              emptyHint="No root types in metamodel"
              onPick={onCreateRoot}
            />
          )}
        </div>
        <p className="wiki-byline">
          {totalNodes} element{totalNodes === 1 ? '' : 's'} · {totalRelations} relation
          {totalRelations === 1 ? '' : 's'}
        </p>
      </header>
      {roots.length === 0 && readOnly ? (
        <p className="wiki-muted">No elements yet.</p>
      ) : (
        <>
          <WikiToc rootRef={articleRef} />
          <WikiChildren
            parts={roots}
            level={2}
            idPrefix="wiki-h-overview"
            nodes={nodes}
            relations={relations}
            metamodel={metamodel}
            typeMeta={typeMeta}
            onNavigate={onNavigate}
            writeUnder={null}
            starters="page"
            startHint={roots.length === 0 ? 'Nothing is written yet. Start with' : 'Add'}
            renderChapter={pageMode === 'multi' && remainingDepth > 0 ? (n, level) => (
              <WikiElementPage
                key={n.id}
                node={n}
                nodes={nodes}
                relations={relations}
                visibleSet={visibleSet}
                metamodel={metamodel}
                updateNode={updateNode}
                updateRelation={updateRelation}
                onNavigate={onNavigate}
                onDeleteRelation={onDeleteRelation}
                readOnly={readOnly}
                typeMeta={typeMeta}
                pageMode={pageMode}
                level={level}
                remainingDepth={remainingDepth - 1}
              />
            ) : undefined}
          />
        </>
      )}
    </article>
  )
}

// ─── Self-description ────────────────────────────────────────────────────────

// A page explains each kind of element once: of the notes that carry
// `data-first-mention`, only the first for each value stays in sight. The
// notes are rendered wherever a type gets a heading, at any depth; which of
// them comes first is known only once the whole article is on the page.
function useFirstMentions(rootRef: React.RefObject<HTMLElement | null>): void {
  // No dependencies: the notes follow whatever the article last rendered.
  useLayoutEffect(() => {
    const seen = new Set<string>()
    for (const el of rootRef.current?.querySelectorAll<HTMLElement>('[data-first-mention]') ?? []) {
      const key = el.dataset.firstMention ?? ''
      el.hidden = seen.has(key)
      seen.add(key)
    }
  })
}

// The glossary: the kinds of element and relation the pages of this wiki
// are written in, each with what the metamodel says it is, so that a reader
// needs nothing but the wiki to read the model. It lists what this view
// uses, and names the rest of the metamodel at its end.
function WikiGlossary({
  metamodel,
  typeMeta,
}: {
  metamodel: Metamodel
  typeMeta: TypeMeta
}): React.ReactElement {
  const articleRef = useRef<HTMLElement | null>(null)

  const wikiDocument = useContext(WikiDocumentContext)
  if (!wikiDocument) throw new Error('WikiDocumentContext is missing')
  const { typeCounts, relationCounts } = wikiDocument.glossary

  // Element types by the sections of the palette, then custom ones.
  const typeIds = allNodeTypeIds(metamodel)
  const categories = [
    ...NODE_TYPE_CATEGORIES.map((c) => ({ id: c.id, label: c.label, types: c.types.filter((t) => typeIds.includes(t)) })),
    { ...CUSTOM_CATEGORY, types: typeIds.filter((t) => !NODE_TYPE_CATEGORIES.some((c) => c.types.includes(t))) },
  ]
  const relationDefs = Object.values(metamodel?.relationTypes ?? {})
  const unusedTypes = typeIds.filter((t) => !typeCounts.has(t))
  const unusedRelations = relationDefs.filter((r) => !relationCounts.has(r.id))

  // Jump to the entry a link asked for.
  useEffect(() => {
    if (!pendingGlossaryEntry) return
    document.getElementById(pendingGlossaryEntry)?.scrollIntoView({ block: 'center' })
    pendingGlossaryEntry = null
  })

  const noun = (type: string): string => typeNoun(typeMeta(type).label, true)
  return (
    <article className="wiki-doc" ref={articleRef}>
      <header className="wiki-doc-header">
        <div className="wiki-title-row">
          <h1 className="wiki-title">Glossary</h1>
        </div>
        <p className="wiki-byline">
          The kinds of element and relation this model is written in
          {metamodel?.name ? `, as its metamodel (${metamodel.name}) defines them` : ''}.
        </p>
      </header>
      <WikiToc rootRef={articleRef} />

      {categories.map((category) => {
        const used = category.types.filter((t) => typeCounts.has(t))
        if (used.length === 0) return null
        return (
          <section className="wiki-block" key={category.id}>
            <h2 id={`wiki-g-category-${category.id}`} className="wiki-heading" data-toc={category.label} data-level={2}>
              {category.label}
            </h2>
            {used.map((type) => {
              const def = metamodel?.nodeTypes[type]
              const meta = typeMeta(type)
              const fields = (def?.properties ?? []).filter((p) => p.key !== 'description').map((p) => fieldTitle(p.label))
              return (
                <p className="wiki-text wiki-term-entry" id={glossaryEntryId('type', type)} key={type} style={{ ['--type-color' as string]: meta.color }}>
                  <span className="wiki-byline-type wiki-term-name">
                    {meta.iconPath && (
                      <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                        <path d={meta.iconPath} />
                      </svg>
                    )}
                    {meta.label}
                  </span>
                  <span className="wiki-heading-count"> ({typeCounts.get(type)})</span>
                  {' — '}
                  {def?.description ?? <span className="wiki-muted">The metamodel does not say what this is.</span>}
                  {fields.length > 0 && <span className="wiki-term-more"> Fields: {fields.join(', ')}.</span>}
                </p>
              )
            })}
          </section>
        )
      })}

      {relationCounts.size > 0 && (
        <section className="wiki-block">
          <h2 id="wiki-g-relations" className="wiki-heading" data-toc="Relations" data-level={2}>Relations</h2>
          <p className="wiki-hatnote">
            A relation has a direction. A page reads it from the element it is about: by its name from the
            source, by its name read back from the target.
          </p>
          {relationDefs.filter((r) => relationCounts.has(r.id)).map((def) => {
            const from = [...new Set(def.allowedPairs.map((pair) => pair.from))].map(noun)
            const to = [...new Set(def.allowedPairs.map((pair) => pair.to))].map(noun)
            const forward = relationPhrase(def, 'out').text
            const back = relationPhrase(def, 'in')
            return (
              <p className="wiki-text wiki-term-entry" id={glossaryEntryId('relation', def.id)} key={def.id}>
                <span className="wiki-term-name">{def.label}</span>
                <span className="wiki-heading-count"> ({relationCounts.get(def.id)})</span>
                {' — '}
                {def.description ?? <span className="wiki-muted">The metamodel does not say what this means.</span>}
                <span className="wiki-term-more">
                  {' '}Reads “{forward}”{back.reads ? <>, and back “{back.text}”</> : ''}.
                  {from.length > 0 && <> From {from.join(', ')} to {to.join(', ')}.</>}
                </span>
              </p>
            )
          })}
        </section>
      )}

      {(unusedTypes.length > 0 || unusedRelations.length > 0) && (
        <section className="wiki-block">
          <h2 id="wiki-g-unused" className="wiki-heading" data-toc="Not used here" data-level={2}>Not used here</h2>
          <p className="wiki-text wiki-term-more">
            The metamodel has more than this view uses.
            {unusedTypes.length > 0 && <> Elements: {unusedTypes.map((t) => typeMeta(t).label).join(', ')}.</>}
            {unusedRelations.length > 0 && <> Relations: {unusedRelations.map((r) => r.label).join(', ')}.</>}
          </p>
        </section>
      )}
    </article>
  )
}

// ─── Contents box ────────────────────────────────────────────────────────────

interface TocEntry { id: string; label: string; level: number; number: string; count?: string }

// The deepest heading the contents box lists (the page title is level 1).
const TOC_MAX_LEVEL = 4
// A contents box longer than this drops its deepest level, and again, down
// to the chapters right under the title: it is a way into the page, not a
// second copy of it.
const TOC_MAX_ENTRIES = 30

// The headings of an article, read from what is on the page (every heading
// that carries `data-toc`), numbered by their nesting: 1, 1.1, 1.2, 2.
function readToc(root: HTMLElement): TocEntry[] {
  let headings = [...root.querySelectorAll<HTMLElement>('[data-toc]')]
    .map((el) => ({ id: el.id, label: el.dataset.toc ?? '', level: Number(el.dataset.level), count: el.dataset.tocCount }))
    .filter((e) => e.level <= TOC_MAX_LEVEL)
  for (let max = TOC_MAX_LEVEL; headings.length > TOC_MAX_ENTRIES && max > 2; max--) {
    headings = headings.filter((e) => e.level < max)
  }
  const counters: number[] = []
  return headings.map((e) => {
    const depth = e.level - 2
    counters.length = depth + 1
    for (let i = 0; i < depth; i++) counters[i] ??= 1
    counters[depth] = (counters[depth] ?? 0) + 1
    return { ...e, number: counters.join('.') }
  })
}

// "Contents", as an encyclopedia article has it under its lead: the chapters
// of the page, each a jump to its heading. Left out of a page too short to
// need one.
function WikiToc({ rootRef }: { rootRef: React.RefObject<HTMLElement | null> }): React.ReactElement | null {
  const [entries, setEntries] = useState<TocEntry[]>([])
  // No dependencies: the headings follow whatever the article last rendered.
  useLayoutEffect(() => {
    if (!rootRef.current) return
    const next = readToc(rootRef.current)
    setEntries((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  })
  // Two headings are worth a box only when they stand for many chapters.
  if (entries.length < 3 && !(entries.length === 2 && entries.some((e) => e.count))) return null
  return (
    <nav className={`wiki-toc ${entries.length > 12 ? 'wide' : ''}`} aria-label="Contents">
      <div className="wiki-toc-title">Contents</div>
      <div className="wiki-toc-list">
        {entries.map((e) => (
          <button
            key={e.id}
            className="wiki-toc-item"
            style={{ paddingLeft: (e.level - 2) * 18 }}
            onClick={() => document.getElementById(e.id)?.scrollIntoView({ block: 'start' })}
          >
            <span className="wiki-toc-number">{e.number}</span>
            {e.label}
            {e.count && <span className="wiki-toc-count"> ({e.count})</span>}
          </button>
        ))}
      </div>
    </nav>
  )
}

// ─── Element page ────────────────────────────────────────────────────────────

function WikiElementPage({
  node,
  nodes,
  relations,
  visibleSet,
  metamodel,
  updateNode,
  updateRelation,
  onNavigate,
  onDeleteRelation,
  readOnly,
  typeMeta,
  pageMode,
  level = 1,
  chapterOf,
  remainingDepth = 1,
}: {
  node: C4Node
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  visibleSet: Set<string> | null
  metamodel: Metamodel
  updateNode: UpdateNode
  updateRelation: UpdateRelation
  onNavigate: (id: string) => void
  onDeleteRelation: (id: string) => void
  readOnly: boolean
  typeMeta: TypeMeta
  /** 'single' (default) = children are named and linked. 'multi' = each
   *  direct child is a chapter of this same article. */
  pageMode: 'single' | 'multi'
  /** The level of the element's heading: 1 for the page's own element (its
   *  title), 2 and deeper for an element written as a chapter of another's
   *  page in 'multi' page mode. A chapter has no breadcrumb, infobox or
   *  contents box, and its long fields are run-in paragraphs, not headings. */
  level?: number
  /** For a chapter, the element whose page it is written into. */
  chapterOf?: string
  /** How many more levels 'multi' page mode may still embed inline, from
   *  here down — the view's Depth (its properties) at the top
   *  level, decremented by one on each embedded recursion. 0 = show this
   *  node's own children as preview cards even in 'multi' mode (the depth
   *  budget is spent). Defaults to 1 for any caller that doesn't pass it. */
  remainingDepth?: number
}): React.ReactElement {
  const embedded = level > 1
  const actions = useWikiActions()
  const articleRef = useRef<HTMLElement | null>(null)
  // A chapter has no article of its own: `articleRef` is then never set.
  useFirstMentions(articleRef)
  const wikiDocument = useContext(WikiDocumentContext)
  if (!wikiDocument) throw new Error('WikiDocumentContext is missing')
  const page = useMemo(() => wikiDocument.page(node.id, chapterOf), [wikiDocument, node.id, chapterOf])
  const { breadcrumb, ownRelations, bylineFacts, parent } = page
  const nodeTypeDef = metamodel?.nodeTypes[node.type]
  const facts = page.facts.map((field) => field.definition)
  const earsStarted = page.requirement?.started ?? false

  // Only the page's own infobox edits the parent: not a chapter, nor a
  // read-only page (each chapter of Multi page went through the whole model).
  const parentCandidates = useMemo(
    () =>
      embedded || readOnly ? [] : Object.values(nodes)
        .filter((n) => n.id !== node.id && isPlacementAllowed(metamodel, node.type, n, nodes))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [nodes, node, metamodel, embedded, readOnly],
  )

  const meta = typeMeta(node.type)
  const getVal = (key: string) => (node as unknown as Record<string, unknown>)[key]

  const expandChildren = pageMode === 'multi' && remainingDepth > 0

  const headingId = `wiki-h-${node.id}`
  const Heading = `h${Math.min(level, 6)}` as 'h1'
  const SubHeading = `h${Math.min(level + 1, 6)}` as 'h2'

  const Root = embedded ? 'section' : 'article'
  // The byline says what the element is and where; of a group there is
  // nothing to say that its name and the path above do not.
  const isGroup = node.type === GROUP_TYPE
  const showByline = !isGroup
  const toGlossary = (): void => {
    pendingGlossaryEntry = glossaryEntryId('type', node.type)
    onNavigate(GLOSSARY_FOCUS)
  }
  // The infobox lists the facts that are set; "Edit facts" in the element's
  // menu opens it with every fact and its editor, also when none is set yet.
  const canEditFacts = !readOnly && !embedded && (facts.length > 0 || parentCandidates.length > 0)
  const factsOpen = canEditFacts && actions.factsFor === node.id
  // The bracketed links beside the heading: [open] on a chapter and, for a
  // designer, [edit] with the menu of the element (which a right click on
  // the heading opens too).
  const menuTarget: MenuTarget = { nodeId: node.id }
  const tools = (
    <span className="wiki-tools">
      {embedded && (
        <button
          className="wiki-tool"
          title="Open this element on its own page"
          aria-label={`Open ${node.label}`}
          onClick={() => onNavigate(node.id)}
        >
          open
        </button>
      )}
      {!readOnly && (
        <button
          className="wiki-tool"
          title="What can be added to or done with this element"
          aria-haspopup="menu"
          aria-label={`Edit ${node.label}`}
          onClick={menuUnderButton(actions, menuTarget, true)}
        >
          edit
        </button>
      )}
    </span>
  )
  // The box that takes a requirement typed as one sentence is for writing
  // it: once the sentence is whole, its parts are edited in place.
  const earsSubject = page.requirement?.subject
  const earsState = page.requirement?.state
  const earsComplete = page.requirement?.complete ?? false
  const renderBlock = (block: WikiBlock): React.ReactNode => {
    switch (block.kind) {
      case 'lead': {
        return (!readOnly || block.field.text) ? (
          <InlineText
            multiline
            className="wiki-lead"
            value={String(getVal(block.field.definition.key) ?? '')}
            placeholder="Add a description…"
            readOnly={readOnly}
            onCommit={(v) =>
              updateNode(node.id, { [block.field.definition.key]: v } as Parameters<UpdateNode>[1])
            }
          />
        ) : null
      }
      case 'requirement': {
        return (earsStarted || (!embedded && !readOnly)) ? (
          <div className="wiki-ears-sentence">
            <EarsSentenceEditor
              node={node as unknown as Record<string, unknown>}
              nodeId={node.id}
              subject={earsSubject}
              statePhrase={earsState}
              readOnly={readOnly}
              updateNode={(id, patch) => updateNode(id, patch as Parameters<UpdateNode>[1])}
            />
            {!embedded && !earsComplete && (
              <EarsQuickEntry
                nodeId={node.id}
                subject={earsSubject}
                readOnly={readOnly}
                updateNode={(id, patch) => updateNode(id, patch as Parameters<UpdateNode>[1])}
              />
            )}
          </div>
        ) : null
      }
      case 'relations': {
        return (
          <WikiRelations
            node={node}
            relations={ownRelations}
            sentences={block.groups}
            nodes={nodes}
            metamodel={metamodel}
            readOnly={readOnly}
            onNavigate={onNavigate}
            updateRelation={updateRelation}
            onDeleteRelation={onDeleteRelation}
            typeMeta={typeMeta}
          />
        )
      }
      case 'contents': {
        return !embedded ? <WikiToc rootRef={articleRef} /> : null
      }
      case 'wireframe': {
        return (
          <MockupWireframe
            nodeId={node.id}
            readOnly={readOnly}
            className="wiki-block mockup-wf"
            heading={embedded ? null : (
              <SubHeading id={`${headingId}-wireframe`} className="wiki-heading" data-toc="Wireframe" data-level={level + 1}>
                Wireframe
              </SubHeading>
            )}
          />
        )
      }
      case 'section': {
        if ((readOnly || embedded) && !block.field.text) return null
        const p = block.field.definition
        const title = block.field.title
        const value = String(getVal(p.key) ?? '')
        const field = (
          <InlineText
            multiline={p.type === 'textarea'}
            className="wiki-prose"
            value={value}
            placeholder={`Add ${title.toLowerCase()}…`}
            readOnly={readOnly}
            onCommit={(v) =>
              updateNode(node.id, { [p.key]: v } as Parameters<UpdateNode>[1])
            }
          />
        )
        return embedded ? (
          <div className="wiki-runin">
            <span className="wiki-runin-label">{title}{/^[a-z]/.test(value.trim()) ? ' ' : '. '}</span>
            {field}
          </div>
        ) : (
          <section className="wiki-block">
            <SubHeading id={`${headingId}-${p.key}`} className="wiki-heading" data-toc={title} data-level={level + 1}>
              {title}
            </SubHeading>
            {field}
          </section>
        )
      }
      case 'children': {
        return (block.nodes.length > 0 || !readOnly) ? (
          <WikiChildren
            parts={block.nodes}
            level={level + 1}
            idPrefix={headingId}
            nodes={nodes}
            relations={relations}
            metamodel={metamodel}
            typeMeta={typeMeta}
            onNavigate={onNavigate}
            writeUnder={node}
            starters={embedded ? 'chapter' : 'page'}
            renderChapter={expandChildren ? (c, chapterLevel) => (
              <WikiElementPage
                key={c.id}
                node={c}
                nodes={nodes}
                relations={relations}
                visibleSet={visibleSet}
                metamodel={metamodel}
                updateNode={updateNode}
                updateRelation={updateRelation}
                onNavigate={onNavigate}
                onDeleteRelation={onDeleteRelation}
                readOnly={readOnly}
                typeMeta={typeMeta}
                pageMode={pageMode}
                level={chapterLevel}
                chapterOf={node.id}
                remainingDepth={remainingDepth - 1}
              />
            ) : undefined}
          />
        ) : null
      }
    }
  }
  return (
    <Root
      className={embedded ? 'wiki-section' : 'wiki-doc'}
      ref={embedded ? undefined : articleRef}
      style={{ ['--type-color' as string]: meta.color }}
    >
      {/* Above the title: where the page is and, for a designer, what can
          be added to or done with its element. */}
      {!embedded && (
        <div className="wiki-topbar">
          <nav className="wiki-breadcrumb">
            {breadcrumb.map((b, i) => (
              <React.Fragment key={b.id}>
                {i > 0 && <span className="wiki-breadcrumb-sep">›</span>}
                {b.id === node.id ? (
                  <span className="wiki-breadcrumb-current">{b.label}</span>
                ) : (
                  <button className="wiki-link" onClick={() => onNavigate(b.id)}>
                    {b.label}
                  </button>
                )}
              </React.Fragment>
            ))}
          </nav>
          {tools}
        </div>
      )}

      <header className={embedded ? 'wiki-section-head' : 'wiki-doc-header'}>
        <div className="wiki-title-row" onContextMenu={menuOnRightClick(actions, menuTarget)}>
          <Heading
            id={headingId}
            className={embedded ? 'wiki-heading' : 'wiki-title'}
            {...(embedded ? { 'data-toc': node.label, 'data-level': level } : {})}
          >
            <InlineText
              className="wiki-heading-text"
              value={node.label}
              placeholder="Untitled element"
              readOnly={readOnly}
              onCommit={(v) => updateNode(node.id, { label: v })}
            />
          </Heading>
          {embedded && tools}
        </div>
        {/* What the element is: on its own page with where it sits, in a
            chapter with its short facts (the page has an infobox for those). */}
        {showByline && (
          <p className="wiki-byline">
            <span
              role="link"
              tabIndex={0}
              className="wiki-byline-type wiki-term"
              title={nodeTypeDef?.description ? `${nodeTypeDef.description} (Glossary)` : 'Glossary'}
              onClick={toGlossary}
              onKeyDown={(e) => {
                if (e.key === 'Enter') toGlossary()
              }}
            >
              {meta.iconPath && (
                <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                  <path d={meta.iconPath} />
                </svg>
              )}
              {meta.label}
            </span>
            {parent && !embedded && (
              <>
                {' in '}
                <WikiTextLink onOpen={() => onNavigate(parent.id)}>{parent.label}</WikiTextLink>
              </>
            )}
            {embedded && bylineFacts.map((f) => (
              <React.Fragment key={f.key}>
                <span className="wiki-byline-sep"> · </span>
                {f.label && <span className="wiki-byline-key">{f.label} </span>}
                {f.text}
              </React.Fragment>
            ))}
          </p>
        )}
      </header>

      {!embedded && (
        <WikiInfobox
          node={node}
          meta={meta}
          parent={parent}
          parentCandidates={parentCandidates}
          facts={facts}
          nodes={nodes}
          editing={factsOpen}
          onDone={() => actions.setFactsFor(null)}
          updateNode={updateNode}
          onNavigate={onNavigate}
        />
      )}

      {page.blocks.map((block) => (
        <React.Fragment key={block.kind === 'section' ? `section:${block.field.definition.key}` : block.kind}>
          {renderBlock(block)}
        </React.Fragment>
      ))}
    </Root>
  )
}

// ─── Infobox ─────────────────────────────────────────────────────────────────

// The box beside the lead of an element's page, as an encyclopedia article
// has it: what the element is, where it sits and its short facts. It lists
// the facts that are set, and is left out when none is. A designer opens it
// from [edit facts]: it then lists every fact, set or not, with its editor.
function WikiInfobox({
  node,
  meta,
  parent,
  parentCandidates,
  facts,
  nodes,
  editing,
  onDone,
  updateNode,
  onNavigate,
}: {
  node: C4Node
  meta: ReturnType<TypeMeta>
  parent: C4Node | undefined
  parentCandidates: C4Node[]
  facts: PropertyDef[]
  nodes: Record<string, C4Node>
  editing: boolean
  onDone: () => void
  updateNode: UpdateNode
  onNavigate: (id: string) => void
}): React.ReactElement | null {
  const values = node as unknown as Record<string, unknown>
  const edit = editing
  const rows = edit ? facts : facts.filter((p) => propertyText(p, values[p.key], nodes))
  const showParent = edit ? parentCandidates.length > 0 : !!parent
  // With no fact to show, the byline has already said everything.
  if (rows.length === 0 && !edit) return null
  return (
    <aside className="wiki-infobox" aria-label="Facts">
      <div className="wiki-infobox-title">{node.label}</div>
      <div className="wiki-infobox-type">
        {meta.iconPath && (
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d={meta.iconPath} />
          </svg>
        )}
        {meta.label}
      </div>
      {(showParent || rows.length > 0) && (
        <dl className="wiki-infobox-rows">
          {showParent && (
            <div className="wiki-infobox-row">
              <dt>Parent</dt>
              <dd>
                {edit ? (
                  <InlineSelect
                    value={node.parentId ?? ''}
                    options={[
                      { value: '', label: '— none —' },
                      ...parentCandidates.map((n) => ({ value: n.id, label: n.label })),
                    ]}
                    display={parent ? <span>{parent.label}</span> : <span className="wiki-muted">none</span>}
                    onCommit={(v) => updateNode(node.id, { parentId: v || undefined })}
                  />
                ) : (
                  parent && <WikiTextLink onOpen={() => onNavigate(parent.id)}>{parent.label}</WikiTextLink>
                )}
              </dd>
            </div>
          )}
          {rows.map((p) => (
            <div className="wiki-infobox-row" key={p.key}>
              <dt>{fieldTitle(p.label)}</dt>
              <dd>
                {edit ? (
                  <WikiFactValue
                    def={p}
                    value={values[p.key]}
                    onCommit={(v) => updateNode(node.id, { [p.key]: v } as Parameters<UpdateNode>[1])}
                  />
                ) : (
                  // A boolean is listed only when set: "yes" says it.
                  p.type === 'boolean' ? 'yes' : propertyText(p, values[p.key], nodes)
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {edit && (
        <div className="wiki-infobox-foot">
          <button className="wiki-tool" aria-label="Done editing facts" onClick={onDone}>done</button>
        </div>
      )}
    </aside>
  )
}

// ─── Relations as sentences ──────────────────────────────────────────────────

// The most elements a sentence lists before it folds into a count.
const LONG_SENTENCE = 6

// The relations of a page's element, one sentence for each direction and
// relation type: "Uses Accounts Service (checks balance, gRPC) and Event Bus.
// Constrained by ADR-001." A designer opens one of them from its pencil (or
// its bracket) to edit it in the line below the paragraph.
function WikiRelations({
  node,
  relations,
  sentences,
  nodes,
  metamodel,
  readOnly,
  onNavigate,
  updateRelation,
  onDeleteRelation,
  typeMeta,
}: {
  node: C4Node
  relations: C4Relation[]
  sentences: WikiRelationGroup[]
  nodes: Record<string, C4Node>
  metamodel: Metamodel
  readOnly: boolean
  onNavigate: (id: string) => void
  updateRelation: UpdateRelation
  onDeleteRelation: (id: string) => void
  typeMeta: TypeMeta
}): React.ReactElement | null {
  const actions = useWikiActions()
  // The relation being edited in the line under this paragraph.
  const editingId = actions.editingRelation?.ownerId === node.id ? actions.editingRelation.relationId : null
  const setEditingId = (id: string | null): void =>
    actions.setEditingRelation(id ? { ownerId: node.id, relationId: id } : null)
  const editing = editingId ? relations.find((r) => r.id === editingId) : undefined
  // The sentences whose full list is shown although it is long.
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(() => new Set())
  if (sentences.length === 0) return null

  return (
    <div className="wiki-block wiki-relations">
      <p className="wiki-text">
        {sentences.map((s) => {
          const def = s.typeId ? metamodel?.relationTypes[s.typeId] : undefined
          const key = `${s.direction}:${s.typeId ?? ''}`
          // A sentence that would list more than a few elements says how
          // many there are instead ("Satisfies 24 requirements"), and
          // [show] writes it out.
          const long = s.relations.length > LONG_SENTENCE
          const folded = long && !unfolded.has(key)
          const toggleFold = (): void => setUnfolded((prev) => {
            const next = new Set(prev)
            if (!next.delete(key)) next.add(key)
            return next
          })
          const others = s.relations
            .map((r) => nodes[s.direction === 'out' ? r.targetId : r.sourceId])
            .filter((n): n is C4Node => !!n)
          return (
            <span className="wiki-rel-sentence" key={key}>
              {/* A type with no inverse label cannot open a sentence from
                  this end: name it and point back at the sources instead. */}
              <span className={def?.description ? 'wiki-term' : undefined} title={def?.description}>
                {s.label}
              </span>
              {' '}
              {folded && countedNoun(s.relations.length, others.map((n) => typeMeta(n.type).label))}
              {!folded && proseList(s.entries.map(({ relation: r, other, details }) => {
                const toggle = (): void => setEditingId(editingId === r.id ? null : r.id)
                const target: MenuTarget = { nodeId: other?.id, relation: { id: r.id, ownerId: node.id } }
                return (
                  <span
                    className={`wiki-ref ${editingId === r.id ? 'editing' : ''}`}
                    key={r.id}
                    onContextMenu={menuOnRightClick(actions, target)}
                  >
                    {other ? (
                      <WikiTextLink onOpen={() => onNavigate(other.id)}>{other.label}</WikiTextLink>
                    ) : (
                      <span className="wiki-muted">(missing)</span>
                    )}
                    {details.length > 0 && (
                      <span
                        className={`wiki-rel-detail ${readOnly ? '' : 'editable'}`}
                        onClick={readOnly ? undefined : toggle}
                      >
                        {' '}({details.join(', ')})
                      </span>
                    )}
                    {!readOnly && (
                      <button
                        className="wiki-ref-btn"
                        title="Edit or remove this relationship, or open the element"
                        aria-haspopup="menu"
                        aria-label={`Actions for the relationship with ${other?.label ?? 'a missing element'}`}
                        onClick={menuUnderButton(actions, target)}
                      >
                        <span>⋯</span>
                      </button>
                    )}
                  </span>
                )
              }))}
              {long && (
                <>
                  {' '}
                  <button className="wiki-tool" aria-expanded={!folded} onClick={toggleFold}>
                    {folded ? 'show' : 'hide'}
                  </button>
                </>
              )}
              {'. '}
            </span>
          )
        })}
      </p>
      {editing && !readOnly && (
        <div className="wiki-rel-editor">
          <WikiRelationLine
            direction={editing.sourceId === node.id ? 'out' : 'in'}
            otherNode={nodes[editing.sourceId === node.id ? editing.targetId : editing.sourceId]}
            relation={editing}
            nodes={nodes}
            metamodel={metamodel}
            readOnly={readOnly}
            onNavigate={onNavigate}
            updateRelation={updateRelation}
            onDeleteRelation={onDeleteRelation}
            typeMeta={typeMeta}
          />
          <button className="wiki-quiet-btn" onClick={() => setEditingId(null)}>Done</button>
        </div>
      )}
    </div>
  )
}

// ─── Relation line (the editor of one relation) ──────────────────────────────

function WikiRelationLine({
  direction,
  otherNode,
  relation,
  nodes,
  metamodel,
  readOnly,
  onNavigate,
  updateRelation,
  onDeleteRelation,
  typeMeta,
}: {
  direction: 'in' | 'out'
  otherNode: C4Node | undefined
  relation: C4Relation
  nodes: Record<string, C4Node>
  metamodel: Metamodel
  readOnly: boolean
  onNavigate: (id: string) => void
  updateRelation: UpdateRelation
  onDeleteRelation: (id: string) => void
  typeMeta: TypeMeta
}): React.ReactElement {
  const relTypeDef = relation.relationType
    ? metamodel?.relationTypes[relation.relationType]
    : undefined
  const srcNode = nodes[relation.sourceId]
  const dstNode = nodes[relation.targetId]
  const compatibleTypes = useMemo(
    () =>
      metamodel
        ? Object.values(metamodel.relationTypes).filter(
            (rt) =>
              rt.allowedPairs.length === 0 ||
              rt.allowedPairs.some((p) => p.from === srcNode?.type && p.to === dstNode?.type),
          )
        : [],
    [metamodel, srcNode, dstNode],
  )
  const relMetaProps = relTypeDef?.properties ?? []
  const getVal = (key: string) => (relation as unknown as Record<string, unknown>)[key]

  return (
    <div className="wiki-rel">
      <span className={`wiki-rel-arrow ${direction}`}>{direction === 'out' ? '→' : '←'}</span>
      <div className="wiki-rel-main">
        <div className="wiki-rel-head">
          <span className="wiki-rel-verb">
            {relTypeDef?.label ?? (direction === 'out' ? 'relates to' : 'related from')}
          </span>
          {otherNode ? (
            <button className="wiki-link wiki-rel-target" onClick={() => onNavigate(otherNode.id)}>
              {otherNode.label}
            </button>
          ) : (
            <span className="wiki-muted">(missing)</span>
          )}
          {otherNode && <TypeChip type={otherNode.type} typeMeta={typeMeta} />}
        </div>

        <div className="wiki-rel-attrs">
          <InlineText
            className="wiki-rel-label"
            value={relation.label ?? ''}
            placeholder={readOnly ? '' : 'add label'}
            readOnly={readOnly}
            onCommit={(v) => updateRelation(relation.id, { label: v })}
          />

          {compatibleTypes.length > 1 && (
            <span className="wiki-rel-pill">
              <InlineSelect
                value={relation.relationType ?? ''}
                readOnly={readOnly}
                options={[
                  { value: '', label: 'generic' },
                  ...compatibleTypes.map((rt) => ({ value: rt.id, label: rt.label })),
                ]}
                display={<span>{relTypeDef?.label ?? 'generic'}</span>}
                onCommit={(v) =>
                  updateRelation(relation.id, {
                    relationType: v || undefined,
                  } as Parameters<UpdateRelation>[1])
                }
              />
            </span>
          )}

          {relMetaProps.length > 0
            ? relMetaProps.map((p) => (
                <span className="wiki-rel-attr" key={p.key}>
                  <span className="wiki-rel-attr-key">{p.label}:</span>{' '}
                  <WikiFactValue
                    def={p}
                    value={getVal(p.key)}
                    readOnly={readOnly}
                    inline
                    onCommit={(v) =>
                      updateRelation(relation.id, {
                        [p.key]: v,
                      } as Parameters<UpdateRelation>[1])
                    }
                  />
                </span>
              ))
            : !relTypeDef &&
              (relation.technology || !readOnly) && (
                <span className="wiki-rel-attr">
                  <span className="wiki-rel-attr-key">Tech:</span>{' '}
                  <InlineText
                    value={relation.technology ?? ''}
                    placeholder="add"
                    readOnly={readOnly}
                    onCommit={(v) => updateRelation(relation.id, { technology: v })}
                  />
                </span>
              )}
        </div>
      </div>
      {!readOnly && (
        <button
          className="wiki-rel-del"
          title="Remove relationship"
          aria-label="Remove relationship"
          onClick={() => onDeleteRelation(relation.id)}
        >
          ×
        </button>
      )}
    </div>
  )
}

// ─── Infobox / inline fact value (display-first, edit on click) ──────────────

/** A reference property: the labels of the nodes it points at, or a picker. */
function WikiRefValue({ def, value, readOnly, onCommit }: {
  def: PropertyDef
  value: unknown
  readOnly: boolean
  onCommit: (v: string | string[]) => void
}): React.ReactElement {
  const nodes = useDiagramStore((s) => s.c4Nodes)
  if (readOnly) {
    const labels = refLabels(value, nodes)
    return labels.length ? <span>{labels.join(', ')}</span> : <span className="wiki-muted">—</span>
  }
  return <RefPicker def={def} value={value} onChange={onCommit} className="wiki-ref-input" />
}

function WikiFactValue({
  def,
  value,
  readOnly = false,
  inline = false,
  onCommit,
}: {
  def: PropertyDef
  value: unknown
  readOnly?: boolean
  inline?: boolean
  onCommit: (v: string | number | boolean | string[]) => void
}): React.ReactElement {
  if (def.type === 'ref') return <WikiRefValue def={def} value={value} readOnly={readOnly} onCommit={onCommit} />

  if (def.type === 'boolean') {
    const on = Boolean(value)
    return (
      <button
        className={`wiki-bool ${on ? 'on' : 'off'}`}
        disabled={readOnly}
        onClick={() => !readOnly && onCommit(!on)}
      >
        {on ? 'Yes' : 'No'}
      </button>
    )
  }

  if (def.type === 'enum' && def.options) {
    const cur = String(value ?? '')
    return (
      <InlineSelect
        value={cur}
        readOnly={readOnly}
        options={[
          { value: '', label: '—' },
          ...def.options.map((o) => ({ value: o, label: o })),
        ]}
        display={
          cur ? (
            <span className={`wiki-enum-pill enum-${cur}`}>{cur}</span>
          ) : (
            <span className="wiki-muted">—</span>
          )
        }
        onCommit={(v) => onCommit(v)}
      />
    )
  }

  return (
    <InlineText
      className={inline ? '' : 'wiki-fact-text'}
      value={value == null ? '' : String(value)}
      placeholder={readOnly ? '—' : 'add'}
      readOnly={readOnly}
      onCommit={(v) => onCommit(def.type === 'number' ? Number(v) : v)}
    />
  )
}

// ─── EARS inline sentence editor ─────────────────────────────────────────────

interface EarsSentenceEditorProps {
  node: Record<string, unknown>
  nodeId: string
  subject?: string
  /** "the Order is Confirmed": the state the requirement points at. */
  statePhrase?: string
  readOnly?: boolean
  updateNode: (id: string, patch: Record<string, unknown>) => void
}

function EarsSlot({
  value,
  placeholder,
  fieldKey,
  nodeId,
  readOnly,
  updateNode,
}: {
  value: string
  placeholder: string
  fieldKey: string
  nodeId: string
  readOnly?: boolean
  updateNode: (id: string, patch: Record<string, unknown>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])

  if (readOnly || !editing) {
    return (
      <span
        className={`ears-slot ${value ? 'ears-slot-filled' : 'ears-slot-empty'}`}
        onClick={() => !readOnly && setEditing(true)}
        title={readOnly ? undefined : `Click to edit: ${placeholder}`}
      >
        {value || placeholder}
      </span>
    )
  }

  return (
    <input
      ref={ref}
      className="ears-slot-input"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false)
        if (draft !== value) updateNode(nodeId, { [fieldKey]: draft || undefined })
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.currentTarget.blur() }
        if (e.key === 'Escape') { setDraft(value); setEditing(false) }
      }}
    />
  )
}

function EarsSentenceEditor({ node, nodeId, subject: subjectProp, statePhrase, readOnly, updateNode }: EarsSentenceEditorProps) {
  // The sentence is also edited whole, as the text it is: its parts are read
  // from it again, which is how its pattern changes ("When" to "While").
  const [rewriting, setRewriting] = useState(false)
  const [draft, setDraft] = useState('')
  const rewriteRef = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = rewriteRef.current
    if (!rewriting || !el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    autoSize(el)
  }, [rewriting])
  const rewrite = (): void => {
    const parsed = parseEarsSentence(draft, subjectProp)
    setRewriting(false)
    if (!parsed.action) return
    // Every part is set, the ones the new sentence has not are cleared. A
    // "While" rewritten to something else than the state's phrase no longer
    // points at the state.
    const keepsState = !!statePhrase && (parsed.precondition ?? '').trim().toLowerCase() === statePhrase.toLowerCase()
    updateNode(nodeId, {
      ears_type: parsed.ears_type,
      action: parsed.action,
      trigger: parsed.trigger,
      precondition: parsed.precondition,
      unwanted_condition: parsed.unwanted_condition,
      feature: parsed.feature,
      ...(statePhrase && !keepsState ? { precondition_state: undefined } : {}),
    })
  }

  const earsType = String(node.ears_type ?? 'ubiquitous')
  const subject = subjectProp || 'the system'
  const action = String(node.action ?? '')
  const trigger = String(node.trigger ?? '')
  const precondition = statePhrase || String(node.precondition ?? '')
  const unwanted = String(node.unwanted_condition ?? '')
  const feature = String(node.feature ?? '')

  const slot = (val: string, placeholder: string, key: string) => (
    <EarsSlot
      value={val}
      placeholder={placeholder}
      fieldKey={key}
      nodeId={nodeId}
      readOnly={readOnly}
      updateNode={updateNode}
    />
  )

  // An action that is a clause of its own ("The wiki view shall show …")
  // is the whole of what follows the condition: no subject and no second
  // "shall" before it, and no second full stop after.
  const ownClause = earsActionIsClause(action)
  const fullStop = action.trim().endsWith('.') ? null : <span className="ears-fixed">.</span>
  const shallClause = ownClause ? (
    <>
      {slot(action, '‹action›', 'action')}
      {fullStop}
    </>
  ) : (
    <>
      <span className="ears-subject">{subject}</span>
      <span className="ears-fixed"> shall </span>
      {slot(action, '‹action›', 'action')}
      {fullStop}
    </>
  )

  let content: React.ReactNode
  switch (earsType) {
    case 'event-driven':
      content = (
        <>
          <span className="ears-fixed">When </span>
          {slot(trigger, '‹trigger›', 'trigger')}
          <span className="ears-fixed">, </span>
          {shallClause}
        </>
      )
      break
    case 'state-driven':
      content = (
        <>
          <span className="ears-fixed">While </span>
          {statePhrase ? <span className="ears-fixed" title="The state it points at (While in state)">{statePhrase}</span> : slot(precondition, '‹precondition›', 'precondition')}
          <span className="ears-fixed">, </span>
          {shallClause}
        </>
      )
      break
    case 'unwanted-behaviour':
      content = (
        <>
          <span className="ears-fixed">If </span>
          {slot(unwanted, '‹condition›', 'unwanted_condition')}
          <span className="ears-fixed">, then </span>
          {shallClause}
        </>
      )
      break
    case 'optional':
      content = (
        <>
          <span className="ears-fixed">Where </span>
          {slot(feature, '‹feature›', 'feature')}
          <span className="ears-fixed">, </span>
          {shallClause}
        </>
      )
      break
    case 'complex': {
      // The conditions the requirement has, in the order a sentence gives
      // them. With none yet, the two that most often go together stand as
      // holes to fill.
      const all = [
        { word: 'while', value: precondition, hole: '‹precondition›', key: 'precondition' },
        { word: 'when', value: trigger, hole: '‹trigger›', key: 'trigger' },
        { word: 'if', value: unwanted, hole: '‹condition›', key: 'unwanted_condition' },
        { word: 'where', value: feature, hole: '‹feature›', key: 'feature' },
      ]
      const set = all.filter((c) => c.value)
      const clauses = set.length > 0 ? set : all.slice(0, 2)
      content = (
        <>
          {clauses.map((c, i) => (
            <React.Fragment key={c.key}>
              <span className="ears-fixed">{i === 0 ? capitalise(c.word) : c.word} </span>
              {slot(c.value, c.hole, c.key)}
              <span className="ears-fixed">, </span>
            </React.Fragment>
          ))}
          {shallClause}
        </>
      )
      break
    }
    default: // ubiquitous
      content = ownClause ? shallClause : (
        <>
          <span className="ears-subject">{subject.charAt(0).toUpperCase() + subject.slice(1)}</span>
          <span className="ears-fixed"> shall </span>
          {slot(action, '‹action›', 'action')}
          {fullStop}
        </>
      )
  }

  if (rewriting && !readOnly) {
    return (
      <blockquote className="ears-sentence ears-editable ears-rewriting">
        <textarea
          ref={rewriteRef}
          className="wiki-inline-input wiki-inline-textarea"
          aria-label="The requirement as one sentence"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            autoSize(e.target)
          }}
          onBlur={() => setRewriting(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setRewriting(false)
            if (e.key === 'Enter') {
              e.preventDefault()
              rewrite()
            }
          }}
        />
        <span className="wiki-write-hint">Enter reads the sentence into its parts again. Esc leaves it as it was.</span>
      </blockquote>
    )
  }

  return (
    <blockquote className="ears-sentence ears-editable">
      {content}
      {!readOnly && (
        <button
          className="wiki-tool ears-rewrite"
          title="Write the whole sentence again: its parts are read from it"
          aria-label="Rewrite the sentence"
          onClick={() => {
            const { sentence, complete } = composeEarsSentence(node, subjectProp, statePhrase)
            // A pattern with holes in it is no sentence to start from.
            setDraft(complete ? sentence : '')
            setRewriting(true)
          }}
        >
          rewrite
        </button>
      )}
    </blockquote>
  )
}

// ─── Inline editors ──────────────────────────────────────────────────────────

function InlineText({
  value,
  placeholder = '',
  className = '',
  multiline = false,
  readOnly = false,
  onCommit,
}: {
  value: string
  placeholder?: string
  className?: string
  multiline?: boolean
  readOnly?: boolean
  onCommit: (v: string) => void
}): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useLayoutEffect(() => {
    if (editing && inputRef.current) {
      const el = inputRef.current
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
      if (multiline) autoSize(el as HTMLTextAreaElement)
    }
  }, [editing, multiline])

  const commit = () => {
    setEditing(false)
    if (draft !== value) onCommit(draft)
  }
  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (editing && !readOnly) {
    return multiline ? (
      <textarea
        ref={(el) => (inputRef.current = el)}
        className={`wiki-inline-input wiki-inline-textarea ${className}`}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          autoSize(e.target)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel()
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit()
        }}
      />
    ) : (
      <input
        ref={(el) => (inputRef.current = el)}
        className={`wiki-inline-input ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel()
          if (e.key === 'Enter') commit()
        }}
      />
    )
  }

  const empty = value.trim() === ''
  const viewClass = `wiki-inline-view ${className} ${empty ? 'empty' : ''} ${readOnly ? 'readonly' : ''}`
  const edit = () => !readOnly && setEditing(true)
  // A multiline field is a long field, so Markdown (markdown.ts): read
  // rendered, edited as written.
  if (multiline && !empty) {
    return (
      <div className={`${viewClass} wiki-md`} onClick={edit} title={readOnly ? undefined : 'Click to edit'}>
        <MarkdownText text={value} />
      </div>
    )
  }
  return (
    <span className={viewClass} onClick={edit} title={readOnly ? undefined : 'Click to edit'}>
      {empty ? placeholder : value}
    </span>
  )
}

function InlineSelect({
  value,
  options,
  display,
  readOnly = false,
  onCommit,
}: {
  value: string
  options: { value: string; label: string }[]
  display: React.ReactNode
  readOnly?: boolean
  onCommit: (v: string) => void
}): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLSelectElement | null>(null)

  useLayoutEffect(() => {
    if (editing && ref.current) ref.current.focus()
  }, [editing])

  if (editing && !readOnly) {
    return (
      <select
        ref={ref}
        className="wiki-inline-input wiki-inline-select"
        value={value}
        onChange={(e) => {
          onCommit(e.target.value)
          setEditing(false)
        }}
        onBlur={() => setEditing(false)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <span
      className={`wiki-inline-view ${readOnly ? 'readonly' : ''}`}
      onClick={() => !readOnly && setEditing(true)}
      title={readOnly ? undefined : 'Click to edit'}
    >
      {display}
    </span>
  )
}

function autoSize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
