import { describe, it, expect } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { currentRoute, describeRoute, parseHash, formatRoute, placeGone, type Route } from '../src/renderer/src/route'
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

  it('round-trips the Inspector tab and the selected element, in one form', () => {
    const inspector: Route = { doc: 'md:/repo/architecture', mode: 'inspector', view: 'v-arch', tab: 'branch', el: 'api' }
    const hash = formatRoute(inspector)
    expect(hash).toBe('#/d/md%3A%2Frepo%2Farchitecture/m/inspector/v/v-arch/t/branch/e/api')
    expect(parseHash(hash)).toEqual(inspector)
    expect(formatRoute(parseHash(hash)!)).toBe(hash)
    // On a canvas: the selection, after the view and before a milestone.
    const canvas: Route = { mode: 'designer', view: 'v-arch', el: 'api', snap: 's1' }
    expect(formatRoute(canvas)).toBe('#/m/designer/v/v-arch/e/api/s/s1')
    expect(parseHash(formatRoute(canvas))).toEqual(canvas)
    // A tab names nothing outside the Inspector, nor an unknown one.
    expect(formatRoute({ mode: 'designer', view: 'v-arch', tab: 'model' })).toBe('#/m/designer/v/v-arch')
    expect(parseHash('#/m/inspector/v/v-arch/t/nope')?.tab).toBeUndefined()
    // A link from before This branch was Changes still opens it.
    expect(parseHash('#/m/inspector/v/v-arch/t/changes/e/api')).toMatchObject({ tab: 'branch', el: 'api' })
    expect(parseHash('#/m/inspector/v/v-arch/t/overview')?.tab).toBe('overview')
    expect(parseHash('#/m/designer/v/v-arch/t/model')?.tab).toBeUndefined()
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
