import { describe, expect, it } from 'vitest'
import { checkModel } from '../src/check'
import { hardValues, needAnswers, quoteFragments } from '../src/check/rules'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const derives = (id: string, sourceId: string, targetId: string, quote?: string): C4Relation =>
  ({ id, relationType: 'derives', sourceId, targetId, ...(quote !== undefined ? { quote } : {}) }) as C4Relation
const req = (id: string, label: string) => node(id, 'requirement', label, { ears_type: 'ubiquitous', action: label })

const NEED = 'From Tomek: I need to know what our goods cost us.\n\nQ: What does a product never received at a cost show?\nA: No average (null, not zero), and its   stock is worth 0.\n\nQ: At what cost do returns come back?\nA: Returns come back at the current average.\n\nQ: A list of all products?\nA: Not decided, your choice. (no requirement)'

function model(): DiagramData {
  return {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [node('cost', 'need', 'Cost of goods', { description: NEED }), req('value', 'Show stock value'), req('worth', 'Stock worth nothing'), req('bare', 'Average cost')],
    relations: [
      derives('d1', 'value', 'cost', '"No average (null, not zero)"\n… its stock is worth 0.'),
      derives('d2', 'worth', 'cost', 'stock is worth nothing'),
      derives('d3', 'bare', 'cost'),
    ],
  }
}
const found = (data: DiagramData) => checkModel(data).findings.filter((f) => f.rule.startsWith('derives-') || f.rule === 'need-answer-unquoted')
  .map((f) => [f.rule, f.relationId ?? f.nodeId, f.severity ?? null, f.message])

describe('quotes on derives', () => {
  it('checks each quote against its need and names the answers no requirement quotes (Quotes of a need checked)', () => {
    const result = found(model())
    expect(result.map((f) => [f[0], f[1]])).toEqual([
      ['derives-quote-missing', 'd3'],
      ['derives-quote-not-in-need', 'd2'],
      ['need-answer-unquoted', 'cost'],
    ])
    expect(result[1][3]).toBe('Requirement "Stock worth nothing" quotes "stock is worth nothing", which need "Cost of goods" does not say.')
    expect(result[2][3]).toContain('"Returns come back at the current average."')
    const check = checkModel(model())
    expect(check.findings.find((f) => f.rule === 'derives-quote-not-in-need')!.severity ?? 'error').toBe('error')
    expect(check.ok).toBe(false)

    // Quoting the answer about returns settles it; a model without needs says nothing.
    const data = model()
    Object.assign(data.relations.find((r) => r.id === 'd3')!, { quote: 'returns come back at the current average' })
    data.relations = data.relations.filter((r) => r.id !== 'd2')
    expect(found(data)).toEqual([])
  })

  it('reads fragments line by line, quotation marks and ellipses aside, and answers from A: to the next Q:', () => {
    expect(quoteFragments('"No average"\n\n… worth 0.\nfirst ... second')).toEqual([['no average'], ['worth 0.'], ['first', 'second']])
    expect(needAnswers('intro\nQ: one?\nA: yes\nand more\nQ: two?\n**A:** no')).toEqual(['yes\nand more', 'no'])
  })
})

describe('hard values of a quote and its requirement', () => {
  const NEEDQA = 'From Tomek.\n\nQ: A product never received at a cost?\nA: No average (null, not zero), and its stock is worth 0.\n\nQ: Refusals?\nA: Not decided, your choice. (no requirement)'
  function valueModel(action: string, extra: Record<string, unknown> = {}): DiagramData {
    return {
      metamodel: builtInGovernanceMetamodel(),
      nodes: [node('cost', 'need', 'Cost of goods', { description: NEEDQA }), node('value', 'requirement', 'Show stock value', { ears_type: 'ubiquitous', action, ...extra })],
      relations: [derives('d', 'value', 'cost', 'No average (null, not zero), and its stock is worth 0.')],
    }
  }
  const values = (data: DiagramData) => checkModel(data).findings.filter((f) => f.rule === 'quote-value-missing' || f.rule === 'requirement-value-unquoted').map((f) => [f.rule, f.message])

  it('finds a value the quote says and the requirement does not, and one the requirement says that no quote says (Values of a quote checked)', () => {
    // The benchmark's case: the client said worth 0, the requirement says null.
    expect(values(valueModel('show the stock value of each product, null without an average'))).toEqual([
      ['quote-value-missing', 'Requirement "Show stock value" does not say "0", which the words it quotes from "Cost of goods" say.'],
    ])
    expect(values(valueModel('show the average (null without one) and the stock value, 0 without an average'))).toEqual([])
    // A value of its own: reported, unless the rationale names it.
    const own = valueModel('show the average (null without one) and the stock value, 0 without an average; refuse a bad value with `409`')
    expect(values(own)).toEqual([['requirement-value-unquoted', 'Requirement "Show stock value" says "409", which none of the words it quotes say: correct it to what the person said, or say in its rationale that it is the model\'s decision.']])
    expect(values(valueModel('show the average (null without one) and the stock value, 0 without an average; refuse a bad value with `409`', { rationale: 'Refusing with 409 is our decision.' }))).toEqual([])
  })

  it('checks no values of a quote of a whole need that holds no answer, and those of a whole need with answers', () => {
    const brief = 'Callers read lists over HTTP (Zalando rule 158).'
    const data: DiagramData = {
      metamodel: builtInGovernanceMetamodel(),
      nodes: [node('n', 'need', 'Lists', { description: brief }), node('r', 'requirement', 'Pages are bounded', { ears_type: 'ubiquitous', action: 'return at most 100 items a page' })],
      relations: [derives('d', 'r', 'n', brief)],
    }
    expect(values(data)).toEqual([])
    const whole = valueModel('show the stock value of each product, null without an average')
    whole.relations[0] = derives('d', 'value', 'cost', NEEDQA)
    expect(values(whole).map((f) => f[0])).toEqual(['quote-value-missing'])
  })

  it('reads numbers in digits and words, percentages, null and identifiers', () => {
    expect([...hardValues('worth 0, fifteen minutes, 70 %, 12.30 €, 1,000 units, `MAIN`, "expired", null')].sort())
      .toEqual(['0', '1000', '12.3', '15', '70%', 'expired', 'main', 'null'].sort())
  })
})
