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
    // A relation without a quote is no finding by default: the goal follows it in percent.
    expect(result.map((f) => [f[0], f[1]])).toEqual([
      ['derives-quote-not-in-need', 'd2'],
      ['need-answer-unquoted', 'cost'],
    ])
    expect(result[0][3]).toBe('Requirement "Stock worth nothing" quotes "stock is worth nothing", which need "Cost of goods" does not say.')
    expect(result[1][3]).toContain('"Returns come back at the current average."')
    const check = checkModel(model())
    expect(check.metrics.find((m) => m.id === 'requirements-quoting-need')).toMatchObject({ count: 2, total: 3, percent: 66 })
    const on = checkModel(model(), { rules: { 'derives-quote-missing': 'warning' } }).findings.filter((f) => f.rule === 'derives-quote-missing')
    expect(on.map((f) => [f.nodeId, f.severity])).toEqual([['bare', 'warning']])
    expect(checkModel(model(), { goals: { 'requirements-quoting-need': { min: 90 } } }).findings.some((f) => f.rule === 'goal-unmet' && /quote their need/.test(f.message))).toBe(true)
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

  it('asks a scenario for the values a requirement takes from its quote (Quoted values reach a scenario)', () => {
    const data = valueModel('show the average (null without one) and the stock value, 0 without an average')
    data.nodes.push(node('sc', 'scenario', 'Stock without cost', { given: 'a product never received at a cost', when: 'its stock level is read', then: 'the average is null' }))
    data.relations.push({ id: 'v', relationType: 'verifies', sourceId: 'sc', targetId: 'value' })
    const found = () => checkModel(data).findings.filter((f) => f.rule === 'scenario-value-missing').map((f) => [f.nodeId, f.message])
    expect(found()).toEqual([['value', 'Requirement "Show stock value" takes "0" from the words it quotes, which its scenario "Stock without cost" does not say: a scenario that checks the requirement names the values the person gave.']])
    Object.assign(data.nodes.find((n) => n.id === 'sc')!, { then: 'the average is null and the stock value is 0' })
    expect(found()).toEqual([])
    // A value of the requirement's own, or a requirement with no scenario, is another rule's.
    Object.assign(data.nodes.find((n) => n.id === 'value')!, { action: 'show the average (null without one) and the stock value, 0 without an average, within 300 ms' })
    expect(found()).toEqual([])
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
    expect([...hardValues('worth 0, fifteen minutes, 70 %, 12.30 €, 1,000 units, `MAIN`, "expired", null when none, without one')].sort())
      .toEqual(['0', '1000', '12.3', '15', '70%', 'expired', 'main', 'null'].sort())
  })
})

describe("reading the person's words", () => {
  const governance = (nodes: C4Node[], relations: C4Relation[]): DiagramData => ({ metamodel: builtInGovernanceMetamodel(), nodes, relations })
  const findings = (data: DiagramData, rules: string[]) => checkModel(data).findings.filter((f) => rules.includes(f.rule)).map((f) => [f.rule, f.relationId ?? f.nodeId, f.message])

  it('reads quotes as whole words, Markdown aside, and answers in their forms (Quotes read as words)', () => {
    const need = node('n', 'need', 'Orders', { description: 'From Tomek.\n\nQ: How many items?\n**A:** An order holds **at most 100** items, _never_ more.\n\nQ: How many warehouses?\n- A: We have 5 warehouses.\n\nQ: Who pays shipping? A: The customer pays shipping.' })
    const data = governance(
      [need, req('within', 'refuse more than 100 items'), req('inside', 'refuse more than 10 items'), req('short', 'show 0'), req('pieces', 'refuse more than 5 items'), req('child', 'refuse more than 100 items in total')],
      [
        derives('d1', 'within', 'n', 'An order holds at most 100 items, never more.'),
        derives('d2', 'inside', 'n', 'at most 10'),
        derives('d3', 'short', 'n', '0'),
        derives('d4', 'pieces', 'n', 'at most … 5 warehouses'),
        derives('d5', 'child', 'within', 'at most 100 items'),
        derives('d6', 'pieces', 'n', 'We have 5 warehouses.'),
      ],
    )
    const result = findings(data, ['derives-quote-not-in-need', 'need-answer-unquoted'])
    expect(result.map((f) => [f[0], f[1]])).toEqual([
      ['derives-quote-not-in-need', 'd2'],
      ['derives-quote-not-in-need', 'd3'],
      ['derives-quote-not-in-need', 'd4'],
      ['derives-quote-not-in-need', 'd5'],
      ['need-answer-unquoted', 'n'],
    ])
    expect(result[1][2]).toContain('too short to say which words')
    expect(result[2][2]).toContain('does not say in that order within one answer')
    expect(result[3][2]).toContain('only a need holds a person\'s words')
    expect(result[4][2]).toContain('"The customer pays shipping."')
    expect(needAnswers('Q: How many? A: At most 20.\nQ1: Where?\nA1: Here.\nQuestion: When?\n> Answer: **Now.**')).toEqual(['At most 20.', 'Here.', '**Now.**'])
  })

  it('reads values in their forms (Values read in their forms)', () => {
    const need = node('n', 'need', 'Rules', { description: 'Q: Discount?\nA: 20 percent off.\nQ: Size?\nA: Twenty-five at most.\nQ: Warehouses?\nA: Only one warehouse for now.\nQ: Basket?\nA: Kept for 15 minutes.\nQ: Payment?\nA: It times out after 30s.' })
    const data = governance(
      [need, req('a', 'take 20% off'), req('b', 'refuse more than 25 items'), req('c', 'keep exactly 1 warehouse'), req('d', 'drop a basket after 900 seconds'), req('e', 'give up on a payment after 60s')],
      [derives('da', 'a', 'n', '20 percent off'), derives('db', 'b', 'n', 'Twenty-five at most'), derives('dc', 'c', 'n', 'Only one warehouse for now'), derives('dd', 'd', 'n', 'Kept for 15 minutes'), derives('de', 'e', 'n', 'It times out after 30s')],
    )
    expect(findings(data, ['quote-value-missing', 'requirement-value-unquoted', 'quote-value-differs'])).toEqual([
      ['quote-value-missing', 'de', 'Requirement "give up on a payment after 60s" does not say "30", which the words it quotes from "Rules" say.'],
      ['requirement-value-unquoted', 'e', 'Requirement "give up on a payment after 60s" says "60", which none of the words it quotes say: correct it to what the person said, or say in its rationale that it is the model\'s decision.'],
    ])
    expect([...hardValues('MUG-BLUE-01 on 2026-03-14 at 9:05, two hundred, 3rd')].sort()).toEqual(['09:05', '200', '2026-03-14', '3'].sort())
  })

  it('keeps the sense of a quoted value (Limits, units and order kept)', () => {
    const need = node('n', 'need', 'Rules', { description: 'Q: Percent?\nA: Up to 90 percent.\nQ: Code?\nA: At most 20 characters.\nQ: Returns?\nA: Within 30 days.\nQ: History?\nA: Oldest first.\nQ: Rounding?\nA: Rounded half up.\nQ: Cost?\nA: The cost is whole cents above zero.' })
    const data = governance(
      [need,
        node('p', 'requirement', 'p', { ears_type: 'unwanted-behaviour', unwanted_condition: 'the percent is 90 or more', action: 'the shop shall refuse the code' }),
        req('c', 'accept a code of at least 20 characters'), req('r', 'refuse a return after 30 minutes'), req('h', 'list the history newest first'), req('o', 'round each line down'),
        node('k', 'requirement', 'k', { ears_type: 'unwanted-behaviour', unwanted_condition: 'a receipt carries a cost that is not a whole number above 0', action: 'the shop shall refuse it' }),
      ],
      [derives('dp', 'p', 'n', 'Up to 90 percent.'), derives('dc', 'c', 'n', 'At most 20 characters.'), derives('dr', 'r', 'n', 'Within 30 days.'), derives('dh', 'h', 'n', 'Oldest first.'), derives('do', 'o', 'n', 'Rounded half up.'), derives('dk', 'k', 'n', 'The cost is whole cents above zero.')],
    )
    const result = findings(data, ['quote-value-differs'])
    expect(result.map((f) => f[1])).toEqual(['dp', 'dc', 'dr', 'dh', 'do'])
    expect(result[0][2]).toBe('Requirement "p" allows below 90 ("90 or more") where the words it quotes from "Rules" allow up to and with 90 ("up to 90"): check on which side of 90 the limit is.')
    expect(result[2][2]).toBe('Requirement "refuse a return after 30 minutes" says "30 minutes" where the words it quotes from "Rules" say "30 days".')
    expect(result[3][2]).toBe('Requirement "list the history newest first" lists newest first where the words it quotes from "Rules" say oldest first.')
    expect(result[4][2]).toBe('Requirement "round each line down" rounds down where the words it quotes from "Rules" say half up.')
  })

  it("asks a scenario for the person's example (Example missing from scenarios)", () => {
    const need = node('n', 'need', 'Cost of goods', { description: 'Q: How is the average worked out?\nA: A moving average. For example, 4 on hand at 4.00 € and 12 received at 6.00 € gives 5.50 €.' })
    const sc = node('sc', 'scenario', 'Average over a delivery', { given: '4 on hand', when: '12 are received', then: 'the average changes' })
    const data = governance([need, req('avg', 'keep a moving average'), sc], [derives('d', 'avg', 'n', 'A moving average.'), { id: 'v', relationType: 'verifies', sourceId: 'sc', targetId: 'avg' } as C4Relation])
    expect(findings(data, ['example-not-in-scenario'])).toEqual([['example-not-in-scenario', 'n', 'Need "Cost of goods" gives the example "For example, 4 on hand at 4.00 € and 12 received at 6.00 € gives 5.50 €.", which no scenario of its requirements holds whole: the closest, "Average over a delivery", does not say "6", "5.5". A scenario with the person\'s own example checks what they meant.']])
    Object.assign(sc, { given: '4 on hand at 400 cents', when: '12 are received at 600 cents', then: 'the average is 550 cents' })
    expect(findings(data, ['example-not-in-scenario'])).toEqual([])
  })

  it('checks a model of 5,000 requirements in under 2 seconds (Word rules on a large model)', () => {
    const nodes: C4Node[] = []; const relations: C4Relation[] = []
    for (let n = 0; n < 200; n++) nodes.push(node(`n${n}`, 'need', `Need ${n}`, { description: Array.from({ length: 25 }, (_, i) => `Q: Limit ${i}?\nA: Thing ${n}-${i} holds at most ${i + 3} items, never more.`).join('\n\n') }))
    for (let r = 0; r < 5000; r++) {
      const n = r % 200; const i = Math.floor(r / 200) % 25
      nodes.push(req(`r${r}`, `refuse more than ${i + 3} items of thing ${n}-${i}`), node(`s${r}`, 'scenario', `S${r}`, { given: `thing ${n}-${i}`, when: `${i + 4} items are ordered`, then: `refused; ${i + 3} are accepted` }))
      relations.push(derives(`d${r}`, `r${r}`, `n${n}`, `Thing ${n}-${i} holds at most ${i + 3} items, never more.`), { id: `v${r}`, relationType: 'verifies', sourceId: `s${r}`, targetId: `r${r}` } as C4Relation)
      if (r % 3 === 0 && r > 0) relations.push(derives(`p${r}`, `r${r}`, `r${r - 1}`))
    }
    const start = performance.now()
    const result = checkModel(governance(nodes, relations))
    expect(performance.now() - start).toBeLessThan(2000)
    expect(result.findings.filter((f) => f.rule.startsWith('quote-') || f.rule.startsWith('derives-quote') || f.rule.endsWith('-value-missing'))).toEqual([])
  })
})
