import { describe, it, expect } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { currentRoute, describeRoute, parseHash, formatRoute, placeGone, stepAddsEntry, type Route } from '../src/renderer/src/route'
import { stepIndex, type NavState } from '../src/renderer/src/navHistory'

describe('route parse/format', () => {
  it('formats mode + view', () => {
    expect(formatRoute({ mode: 'designer', view: 'all' })).toBe('#/m/designer/v/all')
  })

  it('omits focus on All elements, includes it on a real view', () => {
    expect(formatRoute({ mode: 'viewer', view: 'all', focus: 'n1' })).toBe('#/m/viewer/v/all')
    expect(formatRoute({ mode: 'viewer', view: 'view-1', focus: 'n1' })).toBe(
      '#/m/viewer/v/view-1/f/n1',
    )
  })

  it('includes the optional doc segment', () => {
    expect(formatRoute({ doc: 'ls:abc', mode: 'designer', view: 'v2' })).toBe(
      '#/d/ls%3Aabc/m/designer/v/v2',
    )
  })

  it('round-trips an fs doc path with slashes', () => {
    const r: Route = { doc: 'fs:/Users/me/model.c4.json', mode: 'presenter', view: 'wiki-1', focus: 'el-9' }
    const parsed = parseHash(formatRoute(r))
    expect(parsed).toEqual(r)
  })

  it('encodes an active milestone (snapshot)', () => {
    expect(formatRoute({ mode: 'designer', view: 'view-1', snap: 'snap-3' })).toBe(
      '#/m/designer/v/view-1/s/snap-3',
    )
    expect(parseHash('#/m/designer/v/view-1/s/snap-3')).toMatchObject({ snap: 'snap-3' })
  })

  it('encodes presentation playback only when playing', () => {
    // play flag absent → pres/slide dropped
    expect(formatRoute({ mode: 'presenter', view: 'all', pres: 'p1', slide: 2 })).toBe(
      '#/m/presenter/v/all',
    )
    // playing → full presentation segment
    const r: Route = { mode: 'presenter', view: 'all', pres: 'p1', play: true, slide: 2 }
    expect(formatRoute(r)).toBe('#/m/presenter/v/all/p/p1/play/1/sl/2')
    expect(parseHash('#/m/presenter/v/all/p/p1/play/1/sl/2')).toMatchObject({
      pres: 'p1',
      play: true,
      slide: 2,
    })
  })

  it('round-trips milestone + presentation together', () => {
    const r: Route = {
      doc: 'ls:abc',
      mode: 'presenter',
      view: 'view-1',
      snap: 'snap-9',
      pres: 'pres-2',
      play: true,
      slide: 0,
    }
    expect(parseHash(formatRoute(r))).toEqual(r)
  })

  it('parses null for empty / non-route hashes', () => {
    expect(parseHash('')).toBeNull()
    expect(parseHash('#')).toBeNull()
    expect(parseHash('#/')).toBeNull()
  })

  it('defaults an unknown mode to designer', () => {
    expect(parseHash('#/m/bogus/v/all')).toEqual({
      doc: undefined,
      mode: 'designer',
      view: 'all',
      focus: undefined,
    })
  })

  it('opens a link to the All elements canvas of before on All elements', () => {
    expect(parseHash('#/m/designer/v/canvas')).toMatchObject({ view: 'all' })
    expect(parseHash('#/m/designer')).toMatchObject({ view: 'all' })
  })

  it('round-trips the Inspector\'s tab, its path and the selected element, in one form', () => {
    const panel: Route = { doc: 'md:/repo/architecture', mode: 'viewer', view: 'v-arch', panel: 'branch', el: 'api' }
    const hash = formatRoute(panel)
    expect(hash).toBe('#/d/md%3A%2Frepo%2Farchitecture/m/viewer/v/v-arch/i/branch/e/api')
    expect(parseHash(hash)).toEqual(panel)
    expect(formatRoute(parseHash(hash)!)).toBe(hash)
    // On a canvas: the selection, after the view and before a milestone.
    const canvas: Route = { mode: 'designer', view: 'v-arch', el: 'api', snap: 's1' }
    expect(formatRoute(canvas)).toBe('#/m/designer/v/v-arch/e/api/s/s1')
    expect(parseHash(formatRoute(canvas))).toEqual(canvas)
    // An unknown tab names no panel: the route leaves it as it is.
    expect(parseHash('#/m/designer/v/v-arch/i/nope')?.panel).toBeUndefined()
    // The verification path on screen, after the tab; only with the panel.
    const path: Route = { mode: 'designer', view: 'v-arch', panel: 'implementation', trace: 'req' }
    expect(formatRoute(path)).toBe('#/m/designer/v/v-arch/i/implementation/tr/req')
    expect(parseHash(formatRoute(path))).toEqual(path)
    expect(parseHash('#/m/designer/v/v-arch/tr/req')?.trace).toBeUndefined()
    expect(formatRoute({ mode: 'designer', view: 'v-arch', trace: 'req' })).toBe('#/m/designer/v/v-arch')
  })

  it('opens a link to the Inspector perspective of before in Viewer, with the Inspector on its tab', () => {
    expect(parseHash('#/m/inspector/v/v-arch/t/model')).toEqual({ mode: 'viewer', view: 'v-arch', panel: 'model' })
    expect(parseHash('#/m/inspector/v/v-arch')).toMatchObject({ mode: 'viewer', panel: 'overview' })
    expect(parseHash('#/m/inspector/v/v-arch/t/nope')).toMatchObject({ mode: 'viewer', panel: 'overview' })
    // This branch was Changes once; its element was the card open there.
    expect(parseHash('#/m/inspector/v/v-arch/t/changes/e/api')).toMatchObject({ panel: 'branch', el: 'api' })
    expect(parseHash('#/m/inspector/v/v-arch/t/model/e/api')?.el).toBeUndefined()
    expect(parseHash('#/m/inspector/v/v-arch/t/implementation/tr/req')).toMatchObject({ panel: 'implementation', trace: 'req' })
    // Its Settings tab is Check settings… now.
    expect(parseHash('#/m/inspector/v/v-arch/t/settings')).toMatchObject({ mode: 'viewer', panel: 'overview', checkSettings: true })
    expect(formatRoute(parseHash('#/m/inspector/v/v-arch/t/model')!)).toBe('#/m/viewer/v/v-arch/i/model')
  })

  it('parses doc + mode + view + focus', () => {
    expect(parseHash('#/d/ls%3Aabc/m/viewer/v/view-1/f/n1')).toEqual({
      doc: 'ls:abc',
      mode: 'viewer',
      view: 'view-1',
      focus: 'n1',
    })
  })
})

// F-0013: History and the ‹ tooltip named an exploration "explore:<uuid>",
// and once it was closed Back went to All elements, a place never visited.
describe('an exploration in the history', () => {
  it('is named by its name, and Back and Forward pass over it once it is closed', () => {
    const s = useDiagramStore.getState
    useDiagramStore.setState({ appMode: 'designer', presentationActive: false } as never)
    const view = s().addView('Canvas')
    s().setActiveView(view)
    const node = Object.values(s().c4Nodes)[0]
    const before = describeRoute(currentRoute())

    s().exploreFrom(node.id)
    const open = describeRoute(currentRoute())
    expect(open.where).toBe(`Explore: ${node.label}`)
    expect(placeGone(open)).toBe(false)

    s().closeExploration()
    const after = describeRoute(currentRoute())
    expect(placeGone(open)).toBe(true)
    expect(placeGone(before)).toBe(false)
    const nav: NavState = { entries: [before, open, after], index: 2 }
    expect(stepIndex(nav, -1, placeGone)).toBe(0)
    expect(stepIndex({ ...nav, index: 0 }, 1, placeGone)).toBe(2)
    expect(stepIndex({ ...nav, index: 0 }, -1, placeGone)).toBeUndefined()
  })
})

describe('one step of the history', () => {
  it('adds an entry when any change in it is a move, whatever Studio wrote in place with it', () => {
    // Routes applied alone are written in place.
    expect(stepAddsEntry(false, true)).toBe(false)
    // A move alone, or with a route Studio applied before or after it, adds an entry.
    expect(stepAddsEntry(false, false)).toBe(true)
    expect(stepAddsEntry(stepAddsEntry(false, true), false)).toBe(true)
    expect(stepAddsEntry(stepAddsEntry(false, false), true)).toBe(true)
  })
})
