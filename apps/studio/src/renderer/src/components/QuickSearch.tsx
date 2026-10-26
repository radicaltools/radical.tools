import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { useOutsideClick } from '@radical/ui/hooks/useOutsideClick'
import { runAIPrompt } from '../ai/runner'
import { loadAISettings } from '../ai/settings'
import { getAdapter, listAdapters } from '../ai/registry'
import { useDiagramFacade } from '../ai/useDiagramFacade'
import { AIReportLine } from './AIReportLine'
import { openAISettings } from './AISettingsModal'
import type { AISettings, ChatMessage, TokenUsage } from '../ai/types'
import type { ApplyReport } from '@radical/common/ai/diagramFacade'
import { forgeRunClientName, forgeRunCurrentStage } from '@radical/common/formats/forgeRunStatus'
import { agentForgePhase, useAgentForgeStore } from '../persistence/agentForge'
import { useFollowAgentStore } from '../persistence/followAgent'
import { pickViewFor, showOnPage, viewNodeSets as viewNodeSetsOf } from '../navigation'
import { keysTakenByDialog } from './dialogKeys'
import { FORGE_NEEDS_AI } from '../ai/settings'
import { KIND_PREFIXES, SEARCH_KINDS, foldText, parseSearch, searchModel, searchSuggestions, type Mark, type SearchData, type SearchHit, type SearchKind } from '@radical/common/search'
import type { DiagramView } from '@radical/common/c4'
import type { Metamodel } from '@radical/common/metamodel'
import { revealViewFolder, useLeftPanelSection } from '@radical/ui/components/RightPanel'
import { availableCommands, useCommands, type Command } from '../commands'
import { goTo, sinceText, useNavHistory, type NavEntry } from '../navHistory'
import { dropPendingMode, placeGone } from '../route'
import { openFindInView } from './FindInView'

/**
 * Cmd/Ctrl+P quick-search palette.
 *
 * Searches every kind of place in the model (views and their folders,
 * elements, relations, sequences, presentations and their slides,
 * milestones) with @radical/common/search, in sections with their counts;
 * prefixes narrow it, and `>` lists the commands (commands.ts). Picking a
 * result goes there (and pans + zooms onto an element, so the user can find
 * "Payment Service" in a 60-node diagram in one keystroke). Nothing typed,
 * it lists the places visited last.
 *
 * Lives outside the canvas so it is always reachable, no matter which mode
 * (designer / viewer / presenter) the user is in.
 */
export function QuickSearch(): React.ReactElement | null {
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  const c4Relations = useDiagramStore((s) => s.c4Relations)
  const views = useDiagramStore((s) => s.views)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const setActiveView = useDiagramStore((s) => s.setActiveView)
  const selectNode = useDiagramStore((s) => s.selectNode)
  const selectEdge = useDiagramStore((s) => s.selectEdge)
  const setSelectedNodeIds = useDiagramStore((s) => s.setSelectedNodeIds)
  const presentationActive = useDiagramStore((s) => s.presentationActive)
  const sequences = useDiagramStore((s) => s.sequences)
  const presentations = useDiagramStore((s) => s.presentations)
  const snapshots = useDiagramStore((s) => s.snapshots)
  const navEntries = useNavHistory((s) => s.entries)
  const navIndex = useNavHistory((s) => s.index)
  const commandOwners = useCommands((s) => s.owners)

  // An agent's Forge run on this folder (over MCP): the Forge button pulses
  // while it works or waits for the user, and opens a read-only view of it.
  const agentStatus = useAgentForgeStore((s) => s.status)
  const followingAgent = useFollowAgentStore((s) => s.on)
  const [agentNow, setAgentNow] = useState(() => Date.now())
  useEffect(() => {
    if (!agentStatus) return
    setAgentNow(Date.now())
    const timer = setInterval(() => setAgentNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [agentStatus])
  const agentPhase = agentForgePhase(agentStatus, agentNow)
  const agentCurrent = agentStatus ? forgeRunCurrentStage(agentStatus) : undefined
  const agentBadge = agentPhase === 'done' ? '✓'
    : agentPhase === 'paused' ? '‖'
    : agentPhase && agentStatus && agentCurrent ? `${agentStatus.stages.indexOf(agentCurrent) + 1}/${agentStatus.stages.length}`
    : null
  const agentClient = forgeRunClientName(agentStatus?.client)
  const agentForgeTitle = agentPhase === 'working' ? `${agentClient} is running Radical Forge on this model — click to follow it`
    : agentPhase === 'waiting' ? `${agentClient}'s Radical Forge run is waiting for you — click to see where it stands`
    : agentPhase === 'done' ? `${agentClient} finished a Radical Forge run — click to see it`
    : `${agentClient}'s Radical Forge run stopped — click to see where it stands`
  const agentTitle = followingAgent ? `${agentForgeTitle}. Following it on the canvas.` : agentForgeTitle

  const [q, setQ] = useState('')
  const [hover, setHover] = useState(0)
  const [focused, setFocused] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // ── AI agent state ──────────────────────────────────────────────────────
  const [aiSettings, setAiSettings] = useState<AISettings>(() => loadAISettings())
  const [aiBusy, setAiBusy] = useState(false)
  const [aiHistory, setAiHistory] = useState<ChatMessage[]>([])
  const [aiLast, setAiLast] = useState<{ text: string; report?: ApplyReport; error?: string; iterations?: number; usage?: TokenUsage } | null>(null)
  const aiAbortRef = useRef<AbortController | null>(null)

  // Keep AI settings fresh when the user updates them in the modal.
  useEffect(() => {
    const refresh = (): void => setAiSettings(loadAISettings())
    window.addEventListener('storage', refresh)
    window.addEventListener('radical:ai-settings-changed', refresh as EventListener)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('radical:ai-settings-changed', refresh as EventListener)
    }
  }, [])

  // Diagram facade — read fresh from the store on every call so the AI sees
  // the latest state even mid-session.
  const aiDiagram = useDiagramFacade()

  const aiAdapterCfg = aiSettings.providers[aiSettings.active]
  const aiAdapter = getAdapter(aiSettings.active)
  const aiNeedsKey = aiSettings.active !== 'ollama' && !aiAdapterCfg.apiKey
  // The AI agent is only "available" when the user has explicitly enabled
  // the AI feature in settings AND the active provider has the credentials
  // it needs (Ollama: always; cloud providers: API key set). When
  // unavailable we hide every AI-related affordance from the search bar —
  // configuration lives in the logo menu (“AI providers…”).
  const aiConfigured = aiSettings.enabled && !aiNeedsKey
  const aiProviderLabel = listAdapters().find((a) => a.id === aiSettings.active)?.label ?? aiSettings.active
  const aiModelLabel = aiAdapterCfg.model || aiAdapter.defaultModel

  // If the user clears the API key while in AI mode, snap back to search.
  useEffect(() => {
    if (!aiConfigured && aiMode) setAiMode(false)
  }, [aiConfigured, aiMode])

  // Conversation history can carry provider-specific tool_call/tool_result
  // blocks (only Anthropic implements real tool-calling so far — see
  // providers/*.ts). Switching providers mid-session would otherwise replay
  // that shape into an adapter that doesn't understand it, so start fresh.
  const prevActiveProviderRef = useRef(aiSettings.active)
  useEffect(() => {
    if (prevActiveProviderRef.current !== aiSettings.active) {
      prevActiveProviderRef.current = aiSettings.active
      setAiHistory([])
      setAiLast(null)
    }
  }, [aiSettings.active])

  const runAI = useCallback(async (text: string): Promise<void> => {
    const prompt = text.trim()
    if (!prompt || aiBusy) return
    if (aiNeedsKey) {
      setAiLast({ text: '', error: `Set an API key for ${aiProviderLabel} first (“Configure…” in the ✨ menu).` })
      return
    }
    setAiBusy(true)
    setAiLast(null)
    const ctl = new AbortController()
    aiAbortRef.current = ctl
    try {
      const result = await runAIPrompt({
        prompt,
        settings: aiSettings,
        diagram: aiDiagram,
        history: aiHistory,
        signal: ctl.signal,
      })
      setAiHistory((h) => [...h, ...result.history])
      setAiLast({ text: result.summary || 'Done.', report: result.report, iterations: result.iterations, usage: result.usage })
      // Clear the input after a successful run so the next prompt starts fresh.
      setQ('')
      // If the AI issued a focus_node op, animate the camera to that node.
      const focusId = result.report.focusNodeId
      if (focusId) {
        // Slight delay so the canvas has re-rendered after any view / node changes.
        setTimeout(() => {
          const focus = (window as unknown as { __rfFocusNode?: (id: string, opts?: { zoom?: number; duration?: number }) => void }).__rfFocusNode
          focus?.(focusId, { zoom: 1.2, duration: 600 })
        }, 120)
      }
    } catch (err) {
      const msg = (err as Error).message || String(err)
      setAiLast({ text: '', error: msg })
    } finally {
      aiAbortRef.current = null
      setAiBusy(false)
    }
  }, [aiBusy, aiNeedsKey, aiProviderLabel, aiSettings, aiDiagram, aiHistory])

  const cancelAI = useCallback((): void => {
    aiAbortRef.current?.abort()
  }, [])

  // Cmd/Ctrl+P focuses the always-visible search input. Esc clears it and
  // blurs back to the canvas. Disabled during a live presentation — the
  // host browser already binds Cmd+P to "print".
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (presentationActive) return
      const isMac = navigator.platform.toLowerCase().includes('mac')
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        // Behind a dialog (or the metamodel editor) a pick switched the view
        // under it.
        if (keysTakenByDialog(e.target)) return
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        e.preventDefault()
        setQ('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [presentationActive])

  // Expose a global hook so the toolbar (and other UI) can focus the search
  // input without reaching into this component's local state.
  useEffect(() => {
    ;(window as unknown as { __radicalOpenQuickSearch?: () => void }).__radicalOpenQuickSearch = () => {
      if (presentationActive) return
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    return () => {
      delete (window as unknown as { __radicalOpenQuickSearch?: () => void }).__radicalOpenQuickSearch
    }
  }, [presentationActive])

  // Close the dropdown when clicking outside the search bar — but stay
  // mounted so the input remains visible. Also blur the native input so
  // the focus ring goes away (the dropdown was the only "open" UI). Also
  // exits AI mode and dismisses any lingering AI banner so the next click
  // outside fully resets the palette.
  const closeDropdown = useCallback(() => {
    setFocused(false)
    setAiMode(false)
    setAiLast(null)
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur()
    }
  }, [])
  // Hook needs to fire whenever any "open" state is true — otherwise an
  // outside click in AI mode (where focused may already be false) won't be
  // detected and the dropdown stays open.
  useOutsideClick([wrapRef], focused || aiMode || !!aiLast, closeDropdown)

  const pathOf = (id: string): string => {
    const segs: string[] = []
    let cur = c4Nodes[id]
    const seen = new Set<string>()
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      segs.unshift(cur.label || cur.type)
      cur = cur.parentId ? c4Nodes[cur.parentId] : (undefined as unknown as typeof cur)
    }
    return segs.join(' / ')
  }

  // For each view, the elements it shows (its chain's, or its own and their
  // ancestors), so we can answer "which views contain node X?" and
  // pick a sensible fallback view when jumping to a node that isn't in the
  // currently-active one.
  const viewNodeSets = useMemo(() => viewNodeSetsOf(views, c4Nodes, c4Relations, metamodel), [views, c4Nodes, c4Relations, metamodel])

  // Pick a stable view to switch into when the user jumps to a node that
  // isn't visible in the active view: the active view if it already
  // contains the node, else a diagram before a table or wiki, before a
  // matrix or flow, the smallest of each (navigation.pickViewFor), else
  // null (means "no view filter").
  const pickViewForNode = (nodeId: string): string | null => pickViewFor(nodeId, activeViewId, views, viewNodeSets)

  // What the search reads: the model's places, the elements each view
  // shows, and the view shown for `@`.
  const searchData = useMemo<SearchData>(() => ({
    nodes: c4Nodes,
    relations: c4Relations,
    views,
    sequences,
    presentations,
    milestones: snapshots,
    metamodel,
    viewNodes: viewNodeSets,
    current: {
      id: activeViewId,
      name: activeViewId ? (views[activeViewId]?.name ?? 'this view') : 'All elements',
      nodes: activeViewId ? (viewNodeSets[activeViewId] ?? null) : null,
    },
  }), [c4Nodes, c4Relations, views, sequences, presentations, snapshots, metamodel, viewNodeSets, activeViewId])

  const parsed = useMemo(() => parseSearch(q, searchData), [q, searchData])
  const suggestions = useMemo(() => (aiMode ? [] : searchSuggestions(q, searchData)), [aiMode, q, searchData])

  const sections = useMemo<Section[]>(() => {
    if (aiMode) return []
    if (parsed.command) {
      const words = parsed.words
      const list = availableCommands().filter((c) => {
        const text = foldText(`${c.title} ${c.group}`)
        return words.every((w) => text.includes(w))
      })
      return [{ id: 'command', title: 'Commands', count: list.length, items: list.map((command) => ({ key: `cmd:${command.id}`, type: 'command' as const, command })) }]
    }
    if (!q.trim()) {
      // The places visited last, newest first, the one shown left out.
      const seen = new Set<string>()
      const items: Item[] = []
      for (let i = navEntries.length - 1; i >= 0 && items.length < RECENT_MAX; i--) {
        const entry = navEntries[i]
        if (i === navIndex || seen.has(entry.hash) || placeGone(entry)) continue
        seen.add(entry.hash)
        items.push({ key: `recent:${i}`, type: 'recent', entry, index: i })
      }
      return items.length ? [{ id: 'recent', title: 'Recent', count: items.length, items }] : []
    }
    const { hits } = searchModel(searchData, parsed)
    const activeSet = activeViewId ? viewNodeSets[activeViewId] : undefined
    // What the view shown holds comes first among equals.
    const scored = (h: SearchHit): number => h.score + (activeSet && (h.kind === 'element' ? activeSet.has(h.id) : false) ? 8 : 0)
    const byKind = new Map<SearchKind, SearchHit[]>()
    for (const h of hits) {
      const list = byKind.get(h.kind)
      if (list) list.push(h)
      else byKind.set(h.kind, [h])
    }
    const narrowed = !!parsed.kinds
    const out: Array<Section & { best: number }> = []
    for (const kind of SEARCH_KINDS) {
      const list = (byKind.get(kind) ?? []).sort((a, b) => scored(b) - scored(a))
      if (!list.length) continue
      const limit = narrowed ? NARROWED_MAX : SECTION_MAX[kind]
      const items: Item[] = list.slice(0, limit).map((hit) => ({ key: `${kind}:${hit.id}`, type: 'hit', hit }))
      if (list.length > limit && !narrowed) {
        const prefix = KIND_PREFIXES.find((p) => p.kinds.includes(kind))!.prefix
        items.push({ key: `more:${kind}`, type: 'more', label: `List all ${list.length} ${SECTION_TITLES[kind].toLowerCase()}`, query: `${prefix} ${q.trim()}` })
      }
      if (kind === 'element' && list.length >= 2) items.push({ key: 'table', type: 'table', count: list.length })
      out.push({ id: kind, title: SECTION_TITLES[kind], count: list.length, items, best: scored(list[0]) })
    }
    return out.sort((a, b) => b.best - a.best)
  }, [aiMode, parsed, q, searchData, navEntries, navIndex, activeViewId, viewNodeSets, commandOwners]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => sections.flatMap((sec) => sec.items), [sections])

  // Reset hover when the result list shape changes.
  useEffect(() => { setHover(0) }, [q])
  // The highlighted result stays in sight: ↓ moved it under the list's
  // bottom, and Enter opened a result never seen.
  useEffect(() => {
    wrapRef.current?.querySelector('.quick-search-item.active')?.scrollIntoView({ block: 'nearest' })
  }, [hover])

  // The views that show an element, or both ends of a relation.
  const viewsShowing = (hit: SearchHit): string[] => {
    const rel = hit.kind === 'relation' ? c4Relations[hit.id] : undefined
    const out: string[] = []
    for (const [vid, set] of Object.entries(viewNodeSets)) {
      if (rel ? set.has(rel.sourceId) && set.has(rel.targetId) : set.has(hit.id)) out.push(vid)
    }
    return out
  }

  // Open the containers around the target that the view shown has
  // collapsed (the store decides per view, see expandAncestors).
  const expandAncestors = (nodeId: string): void => useDiagramStore.getState().expandAncestors(nodeId)

  const done = (): void => {
    setFocused(false)
    setQ('')
    inputRef.current?.blur()
  }

  // Presenter on a presentation, showing slide `index`; `play` plays it from there.
  const openSlide = (presentationId: string, index: number, play: boolean): void => {
    dropPendingMode()
    const s = useDiagramStore.getState()
    s.setAppMode('presenter')
    s.setActivePresentation(presentationId)
    if (!useDiagramStore.getState().presentationSlides.length) return
    useDiagramStore.getState().previewSlide(index)
    if (play) requestAnimationFrame(() => useDiagramStore.getState().startPresentation())
  }

  // `viewOverride` lets the caller decide where to open the result:
  //   undefined  → smart pick (current view if it has the node, else any view containing it)
  //   null       → open in "all nodes" mode (no active view filter)
  //   string     → open in that specific view id
  const pickHit = (r: SearchHit, viewOverride?: string | null, shift = false): void => {
    done()
    // Bring back the properties card if ✕ hid it, so the freshly-selected
    // object's details show right after jumping.
    const expandRight = (window as unknown as { __radicalExpandRightPanel?: () => void }).__radicalExpandRightPanel
    expandRight?.()
    if (r.kind === 'view') {
      // Just switch the view; no node selection.
      setActiveView(r.id)
      return
    }
    if (r.kind === 'folder') {
      revealViewFolder(r.id)
      return
    }
    if (r.kind === 'sequence') {
      // The flow view that plays it, else the sequence in its list.
      const flow = Object.values(views).find((v) => v.kind === 'dynamic' && v.sequenceId === r.id)
      if (flow) { setActiveView(flow.id); return }
      useLeftPanelSection.setState({ open: 'sequences' })
      window.dispatchEvent(new CustomEvent('radical:show-left-panel'))
      if (useDiagramStore.getState().appMode === 'designer') useDiagramStore.getState().setActiveSequence(r.id)
      return
    }
    if (r.kind === 'presentation') { openSlide(r.id, 0, shift); return }
    if (r.kind === 'slide') { openSlide(r.presentationId!, r.slideIndex ?? 0, shift); return }
    if (r.kind === 'milestone') { useDiagramStore.getState().selectMilestone(r.id); return }
    if (r.kind === 'element') {
      // The same node can be present in many views. If the active view does
      // not show this node, jump to a view that does — otherwise the canvas
      // would not paint the selection ring and pan would do nothing useful.
      const targetView = viewOverride === undefined ? pickViewForNode(r.id) : viewOverride
      const needSwitch = targetView !== activeViewId
      if (needSwitch) setActiveView(targetView)
      // After a view switch React Flow re-renders nodes; defer selection +
      // pan until that settles, otherwise __rfFocusNode can't find the node.
      const apply = (): void => {
        // Expand every collapsed ancestor — otherwise the target node lives
        // inside a folded parent and React Flow can neither show it nor pan
        // to it. Walk from outermost to innermost so each toggle's auto-fit
        // works on already-expanded outer levels.
        expandAncestors(r.id)
        showOnPage(targetView, r.id)
        setSelectedNodeIds([r.id])
        selectNode(r.id)
        requestAnimationFrame(() => {
          const focus = (window as unknown as { __rfFocusNode?: (id: string, opts?: { zoom?: number; duration?: number }) => void }).__rfFocusNode
          focus?.(r.id, { zoom: 1.2, duration: 500 })
        })
      }
      if (needSwitch) setTimeout(apply, 80)
      else requestAnimationFrame(apply)
      return
    }
    // Relation: switch into a view that shows both its ends (a relation is
    // drawn only there; one with its source alone drew another line).
    const rel = c4Relations[r.id]
    if (rel) {
      const targetView = viewOverride === undefined ? pickViewFor([rel.sourceId, rel.targetId], activeViewId, views, viewNodeSets) : viewOverride
      const needSwitch = targetView !== activeViewId
      if (needSwitch) setActiveView(targetView)
      const apply = (): void => {
        // Both endpoints need to be visible — expand collapsed ancestors
        // on either side before centring the camera.
        expandAncestors(rel.sourceId)
        expandAncestors(rel.targetId)
        selectEdge(r.id)
        requestAnimationFrame(() => {
          const focus = (window as unknown as { __rfFocusNode?: (id: string, opts?: { zoom?: number; duration?: number }) => void }).__rfFocusNode
          focus?.(rel.sourceId, { zoom: 1.0, duration: 500 })
        })
      }
      if (needSwitch) setTimeout(apply, 80)
      else requestAnimationFrame(apply)
    } else {
      selectEdge(r.id)
    }
  }

  const pickItem = (item: Item, viewOverride?: string | null, shift = false): void => {
    if (item.type === 'hit') { pickHit(item.hit, viewOverride, shift); return }
    if (item.type === 'more') {
      setQ(item.query)
      setHover(0)
      inputRef.current?.focus()
      return
    }
    const query = q
    done()
    if (item.type === 'table') {
      // All elements, a table, with only what the search found.
      setActiveView(null)
      requestAnimationFrame(() => openFindInView(query, true))
    } else if (item.type === 'recent') {
      goTo(item.index)
    } else {
      item.command.run()
    }
  }

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHover((h) => Math.min(h + 1, Math.max(0, items.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHover((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      // Cmd/Ctrl+Enter → always send to AI agent (when configured).
      e.preventDefault()
      if (aiConfigured) void runAI(q)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // In AI mode plain Enter asks the AI; otherwise it picks the highlighted
      // search result (and falls back to AI when there are no search hits).
      if (aiMode) {
        if (q.trim()) void runAI(q)
        return
      }
      const r = items[hover]
      if (r) pickItem(r, e.shiftKey ? null : undefined, e.shiftKey)
      else if (q.trim() && !parsed.command && aiConfigured) void runAI(q)
    } else if (e.key === 'Tab' && !e.shiftKey && suggestions.length > 0) {
      // Tab takes the first suggestion: a prefix, a view, a type, a value.
      e.preventDefault()
      setQ(suggestions[0].query)
    } else if (e.key === 'Tab' && !e.shiftKey && q.trim() === '' && aiConfigured) {
      // Quick-toggle into AI mode when the input is empty.
      e.preventDefault()
      setAiMode((v) => !v)
    }
  }

  const aiExamples = useMemo(() => [
    'Add a Postgres database used by the Web App',
    'Create a payment system with API gateway and worker',
    'Create a view showing only the payment-related nodes',
    'Show me the Auth Service node',
    'List all technologies used in this model',
    'Summarize the architecture',
    'Create a complete 3-tier web app from scratch',
  ], [])

  // The bar itself is always mounted (so it stays in the top toolbar
  // permanently); the dropdown is the only thing that opens/closes.
  // Keep this early return *after* all hooks to preserve hook order.
  if (presentationActive) return null


  const showDropdown = focused || aiBusy || !!aiLast || aiMode

  return (
    <div
      className={`quick-search-bar${aiMode ? ' ai-mode' : ''}`}
      ref={wrapRef}
      role="search"
      aria-label="Quick search & AI"
    >
      <div className="quick-search-inputrow">
        {aiMode ? (
          <span style={{ flexShrink: 0, fontSize: 14, color: 'var(--accent)' }} aria-hidden>✨</span>
        ) : (
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, flexShrink: 0 }}>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M11 11l3.5 3.5" />
          </svg>
        )}
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setFocused(true) }}
          onFocus={() => setFocused(true)}
          onKeyDown={onInputKey}
          placeholder={
            aiMode
              ? `Ask ${aiProviderLabel} to change the model… (↵ to send)`
              : aiConfigured
                ? 'Search views, elements, slides…  > commands  —  ⌘/Ctrl+↵ to ask AI'
                : 'Search views, elements, slides…  > commands'
          }
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          className={`qs-mode-toggle${aiMode ? ' active' : ''}`}
          title={aiMode ? 'Switch to search mode' : 'Switch to AI mode (Tab on empty input)'}
          aria-pressed={aiMode}
          aria-label="Toggle AI mode"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setAiMode((v) => !v); inputRef.current?.focus() }}
          style={{ display: aiConfigured ? undefined : 'none' }}
        >
          ✨
        </button>
        <button
          type="button"
          className={`qs-forge-toggle${agentPhase ? ` qs-forge-agent qs-forge-${agentPhase}` : ''}`}
          // Studio's own Forge runs on an AI provider: without one the
          // button says how to get one (an agent's run is shown anyway).
          disabled={!agentPhase && !aiConfigured}
          title={agentPhase ? agentTitle : aiConfigured ? 'Open Radical Forge — generate a model from a description' : FORGE_NEEDS_AI}
          aria-label={agentPhase ? 'Show the agent\'s Radical Forge run' : 'Open Radical Forge'}
          data-agent-phase={agentPhase ?? undefined}
          data-following={followingAgent || undefined}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            closeDropdown()
            window.dispatchEvent(new CustomEvent(agentPhase ? 'radical:open-agent-forge' : 'radical:open-forge'))
          }}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9.5 1.5 3 8l1.5 1.5L11 3z" />
            <path d="M9 3l4 4" />
            <path d="M2 14l2.5-2.5" />
            <circle cx="12.5" cy="3.5" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          {agentBadge && <span className="qs-forge-badge" aria-hidden>{agentBadge}</span>}
        </button>
        {aiBusy && (
          <button
            type="button"
            className="quick-search-kbd"
            title="Cancel AI request"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancelAI}
            style={{ cursor: 'pointer' }}
          >
            Cancel
          </button>
        )}
        {!aiBusy && (
          <kbd className="quick-search-kbd" title="Focus search (⌘P / Ctrl+P)">⌘P</kbd>
        )}
      </div>
      {showDropdown && (
        <div className="quick-search-dropdown">
          {/* AI status / last result banner — visible whenever AI is in play */}
          {(aiBusy || aiLast || aiMode) && (
            <div className="qs-ai-banner">
              <div className="qs-ai-banner-row">
                <span className="qs-ai-spark" aria-hidden>✨</span>
                <span className="qs-ai-name">{aiProviderLabel}</span>
                <span className="qs-ai-model">· {aiModelLabel}</span>
                {aiNeedsKey && (
                  <span className="qs-ai-error" style={{ marginLeft: 6 }}>· no API key</span>
                )}
                <span className="qs-ai-spacer" />
                <button
                  className="qs-ai-mini-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => openAISettings()}
                  title="AI providers"
                >
                  Configure
                </button>
                {(aiLast || aiHistory.length > 0) && !aiBusy && (
                  <button
                    className="qs-ai-mini-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setAiLast(null); setAiHistory([]) }}
                    title="Clear AI conversation"
                  >
                    Reset
                  </button>
                )}
              </div>
              {aiBusy && (
                <div className="qs-ai-status"><span className="qs-ai-dot" /> Thinking…</div>
              )}
              {aiLast?.error && (
                <div className="qs-ai-error">Error: {aiLast.error}</div>
              )}
              {aiLast && !aiLast.error && (
                <div className="qs-ai-text">
                  <span style={{ whiteSpace: 'pre-line' }}>{aiLast.text}</span>
                  {aiLast.report && <AIReportLine report={aiLast.report} />}
                  {(aiLast.iterations || aiHistory.length > 0 || aiLast.usage) && (
                    <div className="qs-ai-meta">
                      {aiLast.iterations ? (
                        <span className="qs-ai-meta-pill">
                          ↻ {aiLast.iterations} tool round{aiLast.iterations === 1 ? '' : 's'}
                        </span>
                      ) : null}
                      {aiHistory.length > 0 && (
                        <span className="qs-ai-meta-pill">
                          {aiHistory.length} message{aiHistory.length === 1 ? '' : 's'} in context
                        </span>
                      )}
                      {aiLast.usage && (
                        <span
                          className="qs-ai-meta-pill"
                          title={`${aiLast.usage.inputTokens.toLocaleString()} input + ${aiLast.usage.outputTokens.toLocaleString()} output tokens${aiLast.usage.cachedInputTokens ? ` (${aiLast.usage.cachedInputTokens.toLocaleString()} served from cache)` : ''}`}
                        >
                          {aiLast.usage.inputTokens + aiLast.usage.outputTokens} tokens
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Examples shown when entering AI mode with empty input */}
          {aiMode && q.trim() === '' && !aiBusy && !aiLast && (
            <div className="qs-ai-examples">
              {aiExamples.map((ex) => (
                <button
                  key={ex}
                  className="qs-ai-example"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setQ(ex); inputRef.current?.focus() }}
                  type="button"
                >
                  <span className="qs-ai-example-icon" aria-hidden>›</span>{ex}
                </button>
              ))}
            </div>
          )}

          {/* The prefixes, or what completes the word typed (Tab takes the first). */}
          {!aiMode && !parsed.command && (q.trim() === '' || suggestions.length > 0) && (
            <div className="qs-suggest" aria-label={q.trim() ? 'Suggestions' : 'Prefixes'}>
              {(q.trim() ? suggestions.map((sg) => ({ key: sg.query, label: sg.label, hint: sg.hint, query: sg.query }))
                : PREFIX_CHIPS.map((c) => ({ key: c.prefix, label: c.prefix, hint: c.hint, query: c.prefix }))
              ).map((chip, i) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`qs-suggest-chip${q.trim() && i === 0 ? ' first' : ''}`}
                  title={chip.hint}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setQ(chip.query); inputRef.current?.focus() }}
                >
                  <span className="qs-suggest-label">{chip.label}</span>
                  {chip.hint && <span className="qs-suggest-hint">{chip.hint}</span>}
                </button>
              ))}
              {q.trim() !== '' && <kbd className="qs-suggest-tab">Tab</kbd>}
            </div>
          )}

          <div className="quick-search-results">
            {!aiMode && q.trim() === '' && !aiBusy && !aiLast && (
              <div className="quick-search-hint">
                Type to search. <kbd>↑</kbd> <kbd>↓</kbd> navigate, <kbd>↵</kbd> jump, <kbd>⇧</kbd>+<kbd>↵</kbd> in <em>all nodes</em>, <kbd>&gt;</kbd> commands
                {aiConfigured && (<>, <kbd>⌘</kbd>+<kbd>↵</kbd> ask AI, <kbd>Tab</kbd> AI mode</>)}.
              </div>
            )}
            {!aiMode && q.trim() !== '' && items.length === 0 && suggestions.length === 0 && !aiBusy && (
              <div className="quick-search-hint">
                {parsed.missingView ? <>No view named “{parsed.missingView}”.</> : parsed.command ? 'No command matches.' : 'No matches.'}
                {aiConfigured && !parsed.command ? (<> Press <kbd>⌘</kbd>+<kbd>↵</kbd> (or click below) to ask AI.</>) : null}
              </div>
            )}
            {!aiMode && parsed.scope && q.trim() !== '' && (
              <div className="qs-scope">In <strong>{parsed.scope.name}</strong></div>
            )}
            {(() => {
              let at = -1
              return sections.map((sec) => (
                <div key={sec.id} className="qs-section" role="group" aria-label={sec.title}>
                  <div className="qs-section-head">
                    <span>{sec.title}</span>
                    <span className="qs-section-count">{sec.count}</span>
                  </div>
                  {sec.items.map((item) => {
                    const i = ++at
                    return (
                      <div
                        key={item.key}
                        className={`quick-search-item${i === hover ? ' active' : ''}${item.type === 'more' || item.type === 'table' ? ' qs-item-action' : ''}`}
                        data-kind={item.type === 'hit' ? item.hit.kind : item.type}
                        onMouseEnter={() => setHover(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => pickItem(item, e.shiftKey ? null : undefined, e.shiftKey)}
                        role="button"
                        tabIndex={-1}
                      >
                        <ItemBody item={item} views={views} activeViewId={activeViewId} viewsShowing={viewsShowing} onChip={(vid) => item.type === 'hit' && pickHit(item.hit, vid)} metamodel={metamodel} />
                      </div>
                    )
                  })}
                </div>
              ))
            })()}

            {/* Ask AI action — visible while typing in search mode (only when configured) */}
            {!aiMode && aiConfigured && q.trim() !== '' && !parsed.command && !aiBusy && (
              <div
                className="quick-search-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void runAI(q)}
                role="button"
                tabIndex={-1}
                style={{ borderTop: items.length > 0 ? '1px solid var(--border-subtle)' : undefined }}
                title={aiNeedsKey ? `Set an API key for ${aiProviderLabel} first` : `Ask ${aiProviderLabel} (${aiModelLabel})`}
              >
                <span className="quick-search-kind quick-search-kind-ai">AI</span>
                <span className="quick-search-item-main">
                  <span className="quick-search-item-label">✨ Ask AI: “{q.trim()}”</span>
                  <span className="quick-search-item-sub">
                    {aiNeedsKey ? `Configure → ${aiProviderLabel} (no API key)` : `${aiProviderLabel} · ${aiModelLabel}`}
                  </span>
                </span>
                <kbd className="quick-search-kbd" style={{ marginLeft: 6 }}>⌘↵</kbd>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Results ──────────────────────────────────────────────────────────────────

type Item =
  | { key: string; type: 'hit'; hit: SearchHit }
  | { key: string; type: 'more'; label: string; query: string }
  | { key: string; type: 'table'; count: number }
  | { key: string; type: 'recent'; entry: NavEntry; index: number }
  | { key: string; type: 'command'; command: Command }

interface Section { id: string; title: string; count: number; items: Item[] }

const SECTION_TITLES: Record<SearchKind, string> = {
  view: 'Views', folder: 'Folders', element: 'Elements', relation: 'Relations',
  sequence: 'Sequences', presentation: 'Presentations', slide: 'Slides', milestone: 'Milestones',
}
/** How many hits a section shows before its Show all. */
const SECTION_MAX: Record<SearchKind, number> = {
  view: 5, folder: 3, element: 8, relation: 4, sequence: 3, presentation: 3, slide: 4, milestone: 3,
}
/** Under a prefix: its kind alone, this many. */
const NARROWED_MAX = 60
const RECENT_MAX = 8

const KIND_BADGES: Record<SearchKind, string> = {
  view: 'VIEW', folder: 'FOLDER', element: 'NODE', relation: 'REL', sequence: 'SEQ', presentation: 'DECK', slide: 'SLIDE', milestone: 'MILE',
}

const PREFIX_CHIPS: ReadonlyArray<{ prefix: string; hint: string }> = [
  ...KIND_PREFIXES.map((p) => ({ prefix: p.prefix, hint: `Only ${p.label}` })),
  { prefix: '@', hint: 'In the view shown' },
  { prefix: 'in:', hint: 'In a view, by its name' },
  { prefix: 'type:', hint: 'Of a type' },
  { prefix: '>', hint: 'Commands' },
]

/** `text` with its marked ranges in bold. */
function Marked({ text, marks }: { text: string; marks: Mark[] }): React.ReactElement {
  if (!marks.length) return <>{text}</>
  const parts: React.ReactNode[] = []
  let at = 0
  marks.forEach(([a, b], i) => {
    if (a > at) parts.push(text.slice(at, a))
    parts.push(<mark key={i} className="qs-mark">{text.slice(a, b)}</mark>)
    at = b
  })
  if (at < text.length) parts.push(text.slice(at))
  return <>{parts}</>
}

function ItemBody({ item, views, activeViewId, viewsShowing, onChip, metamodel }: {
  item: Item
  views: Record<string, DiagramView>
  activeViewId: string | null
  viewsShowing: (hit: SearchHit) => string[]
  onChip: (viewId: string | null) => void
  metamodel: Metamodel
}): React.ReactElement {
  if (item.type === 'more' || item.type === 'table') {
    return (
      <>
        <span className="quick-search-kind qs-kind-action" aria-hidden>{item.type === 'table' ? '▦' : '…'}</span>
        <span className="quick-search-item-main">
          <span className="quick-search-item-label">{item.type === 'table' ? `Show all ${item.count} elements in a table` : item.label}</span>
        </span>
      </>
    )
  }
  if (item.type === 'recent') {
    const e = item.entry
    return (
      <>
        <span className="quick-search-kind qs-kind-recent">{e.element ? 'NODE' : 'VIEW'}</span>
        <span className="quick-search-item-main">
          <span className="quick-search-item-label">{e.element?.label ?? e.where}</span>
          <span className="quick-search-item-sub">{[e.element ? e.where : null, e.mode, sinceText(e.at)].filter(Boolean).join(' · ')}</span>
        </span>
      </>
    )
  }
  if (item.type === 'command') {
    return (
      <>
        <span className="quick-search-kind qs-kind-command">{'>'}</span>
        <span className="quick-search-item-main">
          <span className="quick-search-item-label">{item.command.title}</span>
          <span className="quick-search-item-sub">{item.command.group}</span>
        </span>
        {item.command.keys && <kbd className="quick-search-kbd">{item.command.keys}</kbd>}
      </>
    )
  }
  const r = item.hit
  const chips = r.kind === 'element' || r.kind === 'relation' ? viewsShowing(r) : null
  const typeColor = r.kind === 'element' && r.type ? metamodel.nodeTypes[r.type]?.color : undefined
  return (
    <>
      <span className={`quick-search-kind quick-search-kind-${r.kind === 'element' ? 'node' : r.kind === 'relation' ? 'edge' : r.kind}`}
        style={typeColor ? { ['--type-color' as string]: typeColor } : undefined}>
        {KIND_BADGES[r.kind]}
      </span>
      <span className="quick-search-item-main">
        <span className="quick-search-item-label"><Marked text={r.label} marks={r.marks} /></span>
        <span className="quick-search-item-sub">
          {r.snippet
            ? <>{r.snippet.field && <span className="qs-snippet-field">{r.snippet.field}: </span>}<Marked text={r.snippet.text} marks={r.snippet.marks} /></>
            : viewDetail(r, views)}
        </span>
      </span>
      {chips && (
        <span className="quick-search-views" title="Click to open in this scope">
          {/* "All nodes" chip — opens with no active view filter */}
          <span
            className={`quick-search-view-chip all${activeViewId === null ? ' active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); onChip(null) }}
            title="Open in All nodes (no view filter)"
          >
            All
          </span>
          {chips.slice(0, 2).map((vid) => (
            <span
              key={vid}
              className={`quick-search-view-chip${vid === activeViewId ? ' active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); onChip(vid) }}
              title={`Open in view: ${views[vid]?.name ?? vid}`}
            >
              {views[vid]?.name ?? vid}
            </span>
          ))}
          {chips.length > 2 && (
            <span className="quick-search-view-chip more" title={chips.slice(2).map((vid) => views[vid]?.name ?? vid).join(', ')}>+{chips.length - 2}</span>
          )}
          {r.kind === 'element' && chips.length === 0 && (
            <span className="quick-search-view-chip model-only" title="Exists in the model but not in any view">
              model only
            </span>
          )}
        </span>
      )}
    </>
  )
}

/** What a hit's second line says: a view's count of elements, or a group's
 *  views, before its type and folder. */
function viewDetail(r: SearchHit, views: Record<string, DiagramView>): string {
  if (r.kind !== 'view') return r.detail
  const v = views[r.id]
  if (!v) return r.detail
  const members = Object.values(views).filter((x) => x.partOf === v.id).length
  if (r.detail.startsWith('Views per element')) return `Group · ${members} view${members === 1 ? '' : 's'}${r.detail.slice('Views per element'.length)}`
  return r.detail
}
