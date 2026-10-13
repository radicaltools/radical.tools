import React, { createContext, useContext, useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import {
  isParentAllowed,
  isPropertyVisible,
  resolveEarsSubject,
  composeEarsSentence,
  earsActionIsClause,
  refLabels,
  relationSentences,
  relationDetails,
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
import { EarsQuickEntry } from './EarsQuickEntry'
import { MockupWireframe } from './MockupWireframe'
import { RefPicker } from './RefPicker'
import { wireframeDataUri } from '@radical/common/wireframe'
import { loadStudioSettings, STUDIO_SETTINGS_CHANGED_EVENT } from '../studioSettings'
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

// Node types that may be created as a child of `parentType` (undefined → root).
function childTypeOptions(
  metamodel: Metamodel,
  parentType: string | undefined,
  typeMeta: TypeMeta,
): TypeOption[] {
  return allNodeTypeIds(metamodel)
    .filter((t) => isParentAllowed(metamodel, t, parentType))
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

// What the pages need from the view to act on the model: its one menu, and
// the two editors that a menu opens in the page (a relation's line, the
// facts in the infobox).
interface WikiActions {
  readOnly: boolean
  openMenu: (target: MenuTarget, at: MenuPoint) => void
  editingRelation: { ownerId: string; relationId: string } | null
  setEditingRelation: (editing: { ownerId: string; relationId: string } | null) => void
  factsFor: string | null
  setFactsFor: (nodeId: string | null) => void
}

const WikiActionsContext = createContext<WikiActions | null>(null)

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
// derive from this node's type) when its type nests by a relation.
function childTypesOf(node: C4Node, metamodel: Metamodel, typeMeta: TypeMeta): TypeOption[] {
  const hierarchy = metamodel?.nodeTypes[node.type]?.hierarchyRelation
  if (!hierarchy) return childTypeOptions(metamodel, node.type, typeMeta)
  const fromTypes = new Set(
    (metamodel?.relationTypes[hierarchy]?.allowedPairs ?? []).filter((p) => p.to === node.type).map((p) => p.from),
  )
  return [...fromTypes]
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

  // Studio-wide preference (see components/Toolbar.tsx's "Wiki multi-page
  // depth" control) — how many levels 'multi' page mode embeds inline.
  const [multiPageDepth, setMultiPageDepth] = useState(() => loadStudioSettings().wikiMultiPageDepth)
  useEffect(() => {
    const onChange = (): void => setMultiPageDepth(loadStudioSettings().wikiMultiPageDepth)
    window.addEventListener(STUDIO_SETTINGS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(STUDIO_SETTINGS_CHANGED_EVENT, onChange)
  }, [])

  // Respect the right-panel visibility filter: a view's nodeIds defines the
  // visible set (empty = show all). Ancestors are included so the hierarchy
  // stays navigable, mirroring the canvas/treemap behaviour.
  const visibleSet = useMemo<Set<string> | null>(() => {
    if (!view || view.nodeIds.length === 0) return null
    const result = new Set<string>()
    for (const id of view.nodeIds) {
      let cur: string | undefined = id
      while (cur && c4Nodes[cur]) {
        result.add(cur)
        cur = c4Nodes[cur].parentId ?? undefined
      }
    }
    return result
  }, [view, c4Nodes])

  const glossary = focusId === GLOSSARY_FOCUS
  const focusNode = focusId && !glossary ? c4Nodes[focusId] : null
  const focus = focusNode && (!visibleSet || visibleSet.has(focusNode.id)) ? focusNode : null

  const nodeList = useMemo(
    () => Object.values(c4Nodes).filter((n) => !visibleSet || visibleSet.has(n.id)),
    [c4Nodes, visibleSet],
  )

  const childrenOf = useMemo(() => {
    const map: Record<string, C4Node[]> = {}
    for (const n of nodeList) {
      const key = n.parentId ?? '__root__'
      ;(map[key] ??= []).push(n)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.label.localeCompare(b.label))
    }
    return map
  }, [nodeList])

  const goTo = (id: string | null) => {
    if (view) setWikiFocus(view.id, id)
  }

  const typeOrder = useMemo(() => allNodeTypeIds(metamodel), [metamodel])

  // The one menu of the view, and the editors a menu opens in a page.
  const [menu, setMenu] = useState<{ target: MenuTarget; at: MenuPoint } | null>(null)
  const [editingRelation, setEditingRelation] = useState<WikiActions['editingRelation']>(null)
  const [factsFor, setFactsFor] = useState<string | null>(null)
  const actions: WikiActions = {
    readOnly,
    openMenu: (target, at) => setMenu({ target, at }),
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
    items: relationReadingsOf(node, c4Nodes, c4Relations, visibleSet, metamodel).map((reading) => ({
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
      const childTypes = childTypesOf(node, metamodel, typeMeta).sort((a, b) => categoryRank(a.id) - categoryRank(b.id))
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
            nodeList={nodeList}
            nodes={c4Nodes}
            relations={c4Relations}
            visibleSet={visibleSet}
            metamodel={metamodel}
            typeMeta={typeMeta}
          />
        ) : focus ? (
          <WikiElementPage
            key={focus.id}
            node={focus}
            nodes={c4Nodes}
            relations={c4Relations}
            visibleSet={visibleSet}
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
            visibleSet={visibleSet}
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
    </WikiActionsContext.Provider>
  )
}

// ─── Navigation (left column) ────────────────────────────────────────────────

// A group is how a model is divided, not a kind of thing in it: the wiki
// speaks of a group by its name and description and never calls it a group.
const GROUP_TYPE = 'group'

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
// description, or the sentence of a requirement that has none.
function partSummary(node: C4Node, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): string {
  const text = firstParagraph(node.description)
  if (text || node.type !== 'requirement') return text
  const { sentence, complete } = composeEarsSentence(
    node as unknown as Record<string, unknown>,
    resolveEarsSubject(node.id, relations, nodes),
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
            {summary && <> — {summary}</>}
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
}): React.ReactElement {
  const order = allNodeTypeIds(metamodel)
  const rank = (type: string): number => (order.indexOf(type) < 0 ? order.length : order.indexOf(type))
  const groups = parts.filter((n) => n.type === GROUP_TYPE)
  const types = [...new Set(parts.map((n) => n.type))]
    .filter((type) => type !== GROUP_TYPE)
    .sort((a, b) => rank(a) - rank(b))
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
        const title = capitalise(typeNoun(typeMeta(type).label, true))
        return (
          <section className="wiki-block wiki-group" key={type}>
            <Heading
              id={`${idPrefix}-type-${type}`}
              className="wiki-heading"
              data-toc={title}
              data-toc-count={group.length}
              data-level={level}
            >
              {title} <span className="wiki-heading-count">({group.length})</span>
            </Heading>
            {/* What the type is. A page says it once, where it first names
                the type (see useFirstMentions). */}
            {metamodel?.nodeTypes[type]?.description && (
              <p className="wiki-hatnote" data-first-mention={type}>{metamodel.nodeTypes[type].description}</p>
            )}
            {renderChapter ? (
              group.map((n) => renderChapter(n, level + 1))
            ) : (
              <WikiPartList
                parts={group}
                nodes={nodes}
                relations={relations}
                onNavigate={onNavigate}
              />
            )}
          </section>
        )
      })}
    </>
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
    () => childTypeOptions(metamodel, undefined, typeMeta),
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
      {roots.length === 0 ? (
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
  nodeList,
  nodes,
  relations,
  visibleSet,
  metamodel,
  typeMeta,
}: {
  nodeList: C4Node[]
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  visibleSet: Set<string> | null
  metamodel: Metamodel
  typeMeta: TypeMeta
}): React.ReactElement {
  const articleRef = useRef<HTMLElement | null>(null)

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of nodeList) counts.set(n.type, (counts.get(n.type) ?? 0) + 1)
    return counts
  }, [nodeList])
  const relationCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of Object.values(relations)) {
      if (visibleSet && !(visibleSet.has(r.sourceId) && visibleSet.has(r.targetId))) continue
      const type = relationTypeForProse(r, nodes, metamodel ?? undefined)
      if (type) counts.set(type, (counts.get(type) ?? 0) + 1)
    }
    return counts
  }, [relations, nodes, visibleSet, metamodel])

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

const TECH_TYPES: ReadonlySet<string> = new Set([
  'container',
  'component',
  'database',
  'webapp',
  'queue',
])

// Free-text fields that read as short, scannable metadata (e.g.
// "Technology: React", "Date: 2024-01") and therefore belong in the
// at-a-glance infobox rather than the main body. Every other `text` field is
// treated as substantive content and rendered as a prose section so it does
// not get buried in the sidebar (e.g. a Fitness Function's success criteria).
const INFOBOX_TEXT_KEYS: ReadonlySet<string> = new Set([
  'technology',
  'date',
  'version',
  'owner',
  'author',
  'team',
  'url',
  'link',
  'repo',
  'repository',
  'reference',
  'ref',
  'tags',
  'tag',
])

// A property is an "infobox fact" when it is a short classifier — enums,
// booleans, numbers, and the curated short-text metadata above. Substantive
// text/textarea content stays in the main body.
function isInfoboxFact(p: PropertyDef): boolean {
  if (p.type === 'enum' || p.type === 'boolean' || p.type === 'number' || p.type === 'ref') return true
  if (p.type === 'text') return INFOBOX_TEXT_KEYS.has(p.key)
  return false
}

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
   *  here down — the Studio-wide "Wiki multi-page depth" setting at the top
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
  // Types that nest via a relation instead of canvas containment (e.g. a
  // Requirement "derives" from the one it decomposes — allowedParents can't
  // express that, since containment and this relation are different things).
  const hierarchyRelationType = metamodel?.nodeTypes[node.type]?.hierarchyRelation

  const breadcrumb = useMemo(() => {
    const chain: C4Node[] = []
    let cur: C4Node | undefined = node
    const seen = new Set<string>()
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      chain.unshift(cur)
      cur = cur.parentId ? nodes[cur.parentId] : undefined
    }
    return chain
  }, [node, nodes])

  const children = useMemo(
    () =>
      hierarchyRelationType
        ? Object.values(relations)
            .filter((r) => r.relationType === hierarchyRelationType && r.targetId === node.id)
            .map((r) => nodes[r.sourceId])
            .filter((n): n is C4Node => !!n && (!visibleSet || visibleSet.has(n.id)))
            .sort((a, b) => a.label.localeCompare(b.label))
        : Object.values(nodes)
            .filter((n) => n.parentId === node.id && (!visibleSet || visibleSet.has(n.id)))
            .sort((a, b) => a.label.localeCompare(b.label)),
    [nodes, relations, node.id, visibleSet, hierarchyRelationType],
  )

  // The relations the page writes about. The ones that make an element a
  // child of this one are left out: the children paragraph already says so.
  const ownRelations = useMemo(
    () =>
      Object.values(relations).filter((r) => {
        if (r.sourceId === node.id) {
          // Nor does a chapter repeat that it belongs to the page it is on.
          if (chapterOf && r.targetId === chapterOf && r.relationType === hierarchyRelationType) return false
          return !visibleSet || visibleSet.has(r.targetId)
        }
        if (r.targetId !== node.id) return false
        if (hierarchyRelationType && r.relationType === hierarchyRelationType) return false
        return !visibleSet || visibleSet.has(r.sourceId)
      }),
    [relations, node.id, visibleSet, hierarchyRelationType, chapterOf],
  )

  const nodeTypeDef = metamodel?.nodeTypes[node.type]
  // For requirements, EARS sentence fields are edited inline in the sentence editor
  const earsSentenceKeys = new Set(['trigger', 'precondition', 'unwanted_condition', 'feature', 'action'])
  const allProps = useMemo(
    () => (nodeTypeDef?.properties ?? []).filter(
      (p) => p.key !== 'label'
        && isPropertyVisible(p, node as unknown as Record<string, unknown>)
        && !(node.type === 'requirement' && earsSentenceKeys.has(p.key))
    ),
    [nodeTypeDef, node],
  )

  // Split metamodel props so the page reads like a document:
  //  • lead     — the primary description (textarea), shown under the title
  //  • sections — substantive content (other textareas + long-form text
  //               fields like "Success criteria") rendered as prose sections
  //  • facts    — short classifiers (enum/boolean/number + short-text
  //               metadata) written into the byline under the title
  const { leadProp, sectionProps, factProps } = useMemo(() => {
    let lead: PropertyDef | undefined
    const sections: PropertyDef[] = []
    const facts: PropertyDef[] = []
    for (const p of allProps) {
      if (isInfoboxFact(p)) {
        facts.push(p)
      } else if (!lead && p.type === 'textarea' && p.key === 'description') {
        lead = p
      } else {
        sections.push(p)
      }
    }
    return { leadProp: lead, sectionProps: sections, factProps: facts }
  }, [allProps])

  // Fallback fields when the document carries no metamodel for this type.
  const hasMeta = !!nodeTypeDef
  const fallbackLead: PropertyDef | undefined = hasMeta
    ? leadProp
    : { key: 'description', label: 'Description', type: 'textarea' }
  const fallbackFacts: PropertyDef[] = hasMeta
    ? factProps
    : [
        ...(TECH_TYPES.has(node.type)
          ? [{ key: 'technology', label: 'Technology', type: 'text' as const }]
          : []),
        { key: 'external', label: 'External', type: 'boolean' as const },
      ]

  const parentCandidates = useMemo(
    () =>
      Object.values(nodes)
        .filter((n) => n.id !== node.id && isParentAllowed(metamodel, node.type, n.type))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [nodes, node, metamodel],
  )

  const meta = typeMeta(node.type)
  const parent = node.parentId ? nodes[node.parentId] : undefined
  const getVal = (key: string) => (node as unknown as Record<string, unknown>)[key]
  const lead = fallbackLead

  // The facts that have something to say, as the byline writes them. The
  // technology and a set boolean ("external") stand without their label.
  const facts = hasMeta ? factProps : fallbackFacts
  const bylineFacts = facts
    .map((p) => ({
      key: p.key,
      label: p.type === 'boolean' || p.key === 'technology' ? '' : typeNoun(p.label),
      text: propertyText(p, getVal(p.key), nodes),
    }))
    .filter((f) => f.text)

  const expandChildren = pageMode === 'multi' && remainingDepth > 0

  const headingId = `wiki-h-${node.id}`
  const Heading = `h${Math.min(level, 6)}` as 'h1'
  const SubHeading = `h${Math.min(level + 1, 6)}` as 'h2'
  // A reader is not shown the long fields left empty, and a chapter never is:
  // they are filled in on the element's own page.
  const shownSections = (hasMeta ? sectionProps : []).filter(
    (p) => (!readOnly && !embedded) || String(getVal(p.key) ?? '').trim(),
  )

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
  const earsSubject = node.type === 'requirement' ? resolveEarsSubject(node.id, relations, nodes) : undefined
  const earsComplete = node.type === 'requirement'
    && composeEarsSentence(node as unknown as Record<string, unknown>, earsSubject).complete
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

      {lead && (!readOnly || String(getVal(lead.key) ?? '').trim()) && (
        <InlineText
          multiline
          className="wiki-lead"
          value={String(getVal(lead.key) ?? '')}
          placeholder="Add a description…"
          readOnly={readOnly}
          onCommit={(v) =>
            updateNode(node.id, { [lead.key]: v } as Parameters<UpdateNode>[1])
          }
        />
      )}
      {node.type === 'requirement' && (
        <div className="wiki-ears-sentence">
          <EarsSentenceEditor
            node={node as unknown as Record<string, unknown>}
            nodeId={node.id}
            subject={earsSubject}
            readOnly={readOnly}
            updateNode={(id, patch) => updateNode(id, patch as Parameters<UpdateNode>[1])}
          />
          {!embedded && !earsComplete && (
            <EarsQuickEntry
              nodeId={node.id}
              readOnly={readOnly}
              updateNode={(id, patch) => updateNode(id, patch as Parameters<UpdateNode>[1])}
            />
          )}
        </div>
      )}

      <WikiRelations
        node={node}
        relations={ownRelations}
        nodes={nodes}
        metamodel={metamodel}
        readOnly={readOnly}
        onNavigate={onNavigate}
        updateRelation={updateRelation}
        onDeleteRelation={onDeleteRelation}
        typeMeta={typeMeta}
      />

      {!embedded && <WikiToc rootRef={articleRef} />}

      {node.type === 'mockup' && (
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
      )}

      {/* Long fields: sections of the element's own page, run-in paragraphs
          ("Rationale. …") in a chapter, so that the headings of an article
          stay the elements it is about. */}
      {shownSections.map((p) => {
        const title = fieldTitle(p.label)
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
          <div className="wiki-runin" key={p.key}>
            {/* "Given a model with…" reads on from its label; "Rationale.
                Regulators ask…" starts a sentence of its own. */}
            <span className="wiki-runin-label">{title}{/^[a-z]/.test(value.trim()) ? ' ' : '. '}</span>
            {field}
          </div>
        ) : (
          <section className="wiki-block" key={p.key}>
            <SubHeading id={`${headingId}-${p.key}`} className="wiki-heading" data-toc={title} data-level={level + 1}>
              {title}
            </SubHeading>
            {field}
          </section>
        )
      })}

      {/* Children, grouped by type: chapters of this article, or named
          and linked. */}
      {children.length > 0 && (
        <WikiChildren
          parts={children}
          level={level + 1}
          idPrefix={headingId}
          nodes={nodes}
          relations={relations}
          metamodel={metamodel}
          typeMeta={typeMeta}
          onNavigate={onNavigate}
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
      )}
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
  nodes: Record<string, C4Node>
  metamodel: Metamodel
  readOnly: boolean
  onNavigate: (id: string) => void
  updateRelation: UpdateRelation
  onDeleteRelation: (id: string) => void
  typeMeta: TypeMeta
}): React.ReactElement | null {
  const sentences = useMemo(
    () => relationSentences(node.id, relations, nodes, metamodel ?? undefined),
    [node.id, relations, nodes, metamodel],
  )
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
          const phrase = capitalise(s.phrase.text)
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
                {s.phrase.reads ? phrase : `← ${phrase}:`}
              </span>
              {' '}
              {folded && countedNoun(s.relations.length, others.map((n) => typeMeta(n.type).label))}
              {!folded && proseList(s.relations.map((r) => {
                const other = nodes[s.direction === 'out' ? r.targetId : r.sourceId]
                const details = relationDetails(r, def, nodes)
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

function EarsSentenceEditor({ node, nodeId, subject: subjectProp, readOnly, updateNode }: EarsSentenceEditorProps) {
  const earsType = String(node.ears_type ?? 'ubiquitous')
  const subject = subjectProp || 'the system'
  const action = String(node.action ?? '')
  const trigger = String(node.trigger ?? '')
  const precondition = String(node.precondition ?? '')
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
          {slot(precondition, '‹precondition›', 'precondition')}
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
    case 'complex':
      content = (
        <>
          <span className="ears-fixed">While </span>
          {slot(precondition, '‹precondition›', 'precondition')}
          <span className="ears-fixed">, when </span>
          {slot(trigger, '‹trigger›', 'trigger')}
          {unwanted || feature ? (
            <>
              {unwanted && (<><span className="ears-fixed">, if </span>{slot(unwanted, '‹condition›', 'unwanted_condition')}</>)}
              {feature && (<><span className="ears-fixed">, where </span>{slot(feature, '‹feature›', 'feature')}</>)}
            </>
          ) : null}
          <span className="ears-fixed">, </span>
          {shallClause}
        </>
      )
      break
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

  return (
    <blockquote className="ears-sentence ears-editable">
      {content}
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
  return (
    <span
      className={`wiki-inline-view ${className} ${empty ? 'empty' : ''} ${
        readOnly ? 'readonly' : ''
      }`}
      onClick={() => !readOnly && setEditing(true)}
      title={readOnly ? undefined : 'Click to edit'}
    >
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
