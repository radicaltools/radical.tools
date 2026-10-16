import { test, expect } from '../../support/fixtures'

// A Multi page article of hundreds of chapters is drawn whole: scrolled to
// its end, the last chapter is there. (content-visibility on the chapters
// made scrolling smoother but put the end elsewhere: a chapter not drawn
// yet has only a guessed height, and a need's chapter holds ten others.)

function largeSpecification(): string {
  const nodes: object[] = [], relations: object[] = []
  for (let n = 0; n < 30; n++) {
    nodes.push({ id: `n${n}`, type: 'need', label: `Need ${String(n).padStart(2, '0')}`, description: `What stakeholders said, part ${n}.`, x: 0, y: 0, width: 160, height: 60, collapsed: false })
    for (let r = 0; r < 10; r++) {
      const id = `r${n}_${r}`
      nodes.push({ id, type: 'requirement', label: `Requirement ${String(n).padStart(2, '0')}.${r}`, description: '', x: 0, y: 0, width: 160, height: 60, collapsed: false, ears_type: 'ubiquitous', action: `The system shall do ${n}.${r}.`, rationale: 'Because the need says so, at some length, so that each chapter has a paragraph or two to lay out.' })
      relations.push({ id: `d${n}_${r}`, sourceId: id, targetId: `n${n}`, relationType: 'derives' })
    }
  }
  const view = {
    id: 'v-spec', name: 'Specification', kind: 'wiki', nodeIds: [], positions: {}, wikiPageMode: 'multi', wikiDepth: 2,
    pipeline: { levels: [{ ways: [{ types: ['need'] }] }, { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] }] },
  }
  return JSON.stringify({ nodes, relations, views: [view], metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} } })
}

test('a long Multi page article draws the chapters scrolled to, at the end and back at the top', async ({ page, studio }) => {
  await studio.seedDocument(largeSpecification())
  await studio.open('v-spec')
  const heading = (name: string) => page.locator('.wiki-page').getByRole('heading', { name, exact: true })
  await expect(heading('Need 00')).toBeInViewport()
  // The element that scrolls the article.
  const scroll = (to: 'end' | 'top') => page.locator('.wiki-page').evaluate((el, where) => {
    let s: HTMLElement | null = el as HTMLElement
    while (s && s.scrollHeight <= s.clientHeight + 1) s = s.parentElement
    if (s) s.scrollTop = where === 'end' ? s.scrollHeight : 0
  }, to)
  await scroll('end')
  await expect(heading('Requirement 29.9')).toBeInViewport()
  await expect(page.locator('.wiki-page').getByText('The system shall do 29.9.')).toBeInViewport()
  await scroll('top')
  await expect(heading('Need 00')).toBeInViewport()
})
