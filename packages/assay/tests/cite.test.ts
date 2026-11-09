import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkPlan, extractRepository, factIndex, parsePlan } from '../src/index'
import { legacy } from './shop'

function run() {
  const repos = [extractRepository(join(legacy(), 'billing-vb6'))]
  return { repos, facts: factIndex(repos) }
}

const QUOTE = { repository: 'billing-vb6', file: 'Billing.vbp', lines: [1, 1], text: 'Type=Exe' }
const DB = { repository: 'billing-vb6', file: 'src/modDb.bas', lines: [5, 6], text: 'cn.Open   "Provider=SQLOLEDB;Data Source=SQL01;Initial Catalog=Billing;Integrated Security=SSPI"' }

describe('radical assay: code cited by the agent', () => {
  it('reads a VB6 project as a unit, its database and the tables its SQL names', () => {
    const { repos } = run()
    const [r] = repos
    expect(r.units).toEqual([expect.objectContaining({ id: 'billing-vb6:unit:.', name: 'Billing', stack: 'vb6', kind: 'app', technology: ['ADO', 'VB6'], evidence: { file: 'Billing.vbp', line: 8 } })])
    expect(r.databases).toEqual([{ id: 'billing-vb6:db:.:SQL Server/Billing', unit: 'billing-vb6:unit:.', engine: 'SQL Server', server: 'SQL01', name: 'Billing', evidence: { file: 'src/modDb.bas', line: 6 } }])
    expect(r.tables.map((t) => [t.table, t.evidence])).toEqual([['Invoices', { file: 'src/modDb.bas', line: 11 }]])
    expect(r.notes).toEqual([])
  })

  it('takes a quotation found in those lines, spacing aside, as evidence of an inferred claim, and checks the folders named', () => {
    const { repos, facts } = run()
    const { plan } = parsePlan({
      elements: [
        { key: 'billing', type: 'container', label: 'Billing', technology: 'VB6', paths: [{ repository: 'billing-vb6', path: '.' }], facts: [], citations: [QUOTE], confidence: 'inferred' },
        { key: 'db', type: 'database', label: 'Billing database', technology: 'SQL Server', citations: [DB], confidence: 'inferred' },
      ],
      relations: [{ from: 'billing', to: 'db', relationType: 'interacts', citations: [DB], confidence: 'inferred' }],
    })
    expect(checkPlan(plan, facts, () => false, repos)).toEqual([])
  })

  it('names every quotation it does not find, and refuses one for an observed claim', () => {
    const { repos, facts } = run()
    const { plan } = parsePlan({
      elements: [
        { key: 'a', type: 'container', label: 'A', citations: [{ ...QUOTE, text: 'Type=OleDll' }], confidence: 'inferred' },
        { key: 'b', type: 'container', label: 'B', citations: [{ ...QUOTE, lines: [1, 40] }, { ...QUOTE, file: '../outside.vbp' }, { ...QUOTE, repository: 'nowhere' }], confidence: 'inferred' },
        { key: 'c', type: 'container', label: 'C', facts: [], citations: [QUOTE], confidence: 'observed' },
        { key: 'd', type: 'container', label: 'D', paths: [{ repository: 'billing-vb6', path: 'bin' }], citations: [QUOTE], confidence: 'inferred' },
        { key: 'e', type: 'container', label: 'E', confidence: 'inferred' },
      ],
    })
    expect(checkPlan(plan, facts, () => false, repos)).toEqual([
      'elements[0] (A): cites billing-vb6/Billing.vbp:1-1, whose lines do not hold "Type=OleDll"',
      'elements[1] (B): cites billing-vb6/Billing.vbp:1-40, but the file has 9 lines',
      'elements[1] (B): cites billing-vb6/../outside.vbp, which the repository does not have',
      'elements[1] (B): cites repository nowhere, which is not one of the run\'s',
      'elements[2] (C): observed, so it rests on facts; a citation backs only an inferred claim: drop its citations, or mark it inferred',
      'elements[2] (C): facts must list the ids of the facts it rests on',
      'elements[2] (C): observed, but cites no unit, API, service, database or stored routine fact that states it',
      'elements[3] (D): names billing-vb6/bin, which the repository does not have',
      'elements[4] (E): facts must list the ids of the facts it rests on, or citations the code or documents it quotes',
    ])
  })

  it('refuses a quotation too short to say anything, or cut out of a word', () => {
    const { repos, facts } = run()
    const { plan } = parsePlan({ elements: [
      { key: 'a', type: 'container', label: 'A', citations: [{ ...QUOTE, text: 'Exe' }], confidence: 'inferred' },
      { key: 'b', type: 'container', label: 'B', citations: [{ ...QUOTE, text: 'ype=Exe' }], confidence: 'inferred' },
      { key: 'c', type: 'database', label: 'C', citations: [{ ...DB, lines: [6, 6], text: 'Data Source=SQL01;Initial' }], confidence: 'inferred' },
    ] })
    expect(checkPlan(plan, facts, () => false, repos)).toEqual([
      'elements[0] (A): cites billing-vb6/Billing.vbp:1-1 with "Exe": quote at least 8 characters of it',
      'elements[1] (B): cites billing-vb6/Billing.vbp:1-1 with "ype=Exe": quote at least 8 characters of it',
    ])
    const { plan: cut } = parsePlan({ elements: [{ key: 'd', type: 'database', label: 'D', citations: [{ ...DB, lines: [6, 6], text: 'ider=SQLOLEDB;Data Source' }], confidence: 'inferred' }] })
    expect(checkPlan(cut, facts, () => false, repos)).toEqual(['elements[0] (D): cites billing-vb6/src/modDb.bas:6-6, whose lines do not hold "ider=SQLOLEDB;Data Source"'])
  })
})
