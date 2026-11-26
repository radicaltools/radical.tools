// ─── A finding as a person reads it ──────────────────────────────────────────
//
// A finding's sentence is written for a log: its verdict comes last, after
// the element and the whole id of a test ("…› Trend draws noise threshold
// and gear changes failed."), and a person cannot tell where the title of
// the test ends and what is wrong begins. What shows a finding to a person
// reads it by its parts instead: the verdict first, as its rule's name; a
// test by its title, with its file and describes apart; and for the rules
// whose sentence speaks of the check's own workings, what it means.

import { formatAge } from './metrics'
import { testIdParts } from './reports'
import type { RuleFinding } from './rules'

/** Words a rule id spells short. */
const WORDS: Record<string, string> = { adr: 'ADR', adrs: 'ADRs', fn: 'function', json: 'JSON', sm: 'state machine' }
/** Rules whose id reads badly as words. */
const NAMES: Record<string, string> = {
  metamodel: 'Breaks the metamodel',
  'goal-unmet': 'Goal not met',
  'test-unbound': 'Test the model does not name',
  'test-not-run': 'Test did not run',
  'test-not-found': 'Test not found',
  'folder-not-a-node': 'Node file without id or type',
  'folder-json': 'JSON file that does not parse',
  'folder-manifest': 'Folder without its manifest',
  'folder-conflict': 'Git conflict markers',
  'folder-duplicate-id': 'Two files with one id',
}

/** "requirement-without-scenario" → "Requirement without scenario";
 *  `rule/code` keys name their code after the rule. A finding's verdict. */
export function ruleName(key: string): string {
  const [rule, code] = key.split('/')
  const named = NAMES[rule] ?? rule.split('-').map((w) => WORDS[w] ?? w).join(' ')
  const name = named.charAt(0).toUpperCase() + named.slice(1)
  return code ? `${name}: ${code}` : name
}

/** A test id by what a person looks for: its title, and where it is (its
 *  file, then the describes it is in). */
export function testIdentity(id: string): { title: string; where: string } {
  const parts = testIdParts(id).filter(Boolean)
  if (parts.length < 2) return { title: parts[0] ?? id, where: '' }
  return { title: parts[parts.length - 1], where: parts.slice(0, -1).join(' › ') }
}

/** What a finding about a test means, for the outcomes whose sentence
 *  speaks of reports and files; undefined when the verdict says it all. */
export function testFindingNote(f: Pick<RuleFinding, 'asOf'> & { rule: string }, now = Date.now()): string | undefined {
  if (f.rule === 'test-not-run') return 'No test report read here has its file: the test did not run, or its report was not read.'
  if (f.rule === 'test-skipped') return 'The run skipped it, so it checks nothing.'
  if (f.rule === 'test-not-found') {
    return f.asOf
      ? `Not in the test results read ${f.asOf.slice(0, 10)}, ${formatAge(now - Date.parse(f.asOf))} ago: added since, renamed or deleted? Read the results again.`
      : 'Its file ran, with no test of this name in it: renamed or deleted?'
  }
  return undefined
}

/** A rule's description without its marks (what it asks is in bold, for
 *  what draws it): as a terminal prints it. Code marks stay, as written. */
export const plainRuleText = (description: string): string => description.replace(/\*\*/g, '')

/** A finding's sentence by what it quotes: the words and values in
 *  quotation marks, the names in backticks, and the text between them.
 *  What draws it shows the quotes in bold and the names as code. */
export function messageParts(message: string): Array<{ kind: 'text' | 'quote' | 'code'; text: string }> {
  const parts: Array<{ kind: 'text' | 'quote' | 'code'; text: string }> = []
  // A quote ends at its mark before a space, a stop or the end, so that an
  // apostrophe or an inch mark inside the words does not end it.
  const marked = /`([^`\n]+)`|"([^"\n]+)"(?=[\s,.;:)]|$)/g
  let at = 0
  for (const m of message.matchAll(marked)) {
    if (m.index > at) parts.push({ kind: 'text', text: message.slice(at, m.index) })
    parts.push(m[1] !== undefined ? { kind: 'code', text: m[1] } : { kind: 'quote', text: `"${m[2]}"` })
    at = m.index + m[0].length
  }
  if (at < message.length) parts.push({ kind: 'text', text: message.slice(at) })
  return parts
}
