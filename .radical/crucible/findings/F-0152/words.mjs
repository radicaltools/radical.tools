// A need with one answer and one requirement quoting it, built through the MCP server; then radical check.
import { mcp, freshFolder, cli } from './lib.mjs'
export const WORD_RULES = ['derives-quote-missing', 'derives-quote-not-in-need', 'quote-value-missing', 'quote-value-differs', 'requirement-value-unquoted', 'scenario-value-missing', 'example-not-in-scenario', 'need-answer-unquoted', 'need-answer-changed']
const strip = (t) => t.replace(/^Created (node|relation)[^.]*\.( Relation ID: [^.]*\.)? Changed: .*?Revision: \w+\.\s*/, '')
/** Returns { report: what the MCP server said on the derives write, check: the word findings of radical check }. */
export async function quoteCase(name, { answer, action, ears = 'ubiquitous', extra = {} }) {
  const f = freshFolder(name)
  const m = await mcp(f)
  try {
    await m.call('get_model_summary')
    await m.call('add_node', { tempId: 'need', type: 'need', label: 'Brief', description: `Q: What did you say?\nA: ${answer}` })
    await m.call('add_node', { tempId: 'req', type: 'requirement', label: 'Requirement', properties: { ears_type: ears, action, ...extra } })
    const r = await m.call('add_relation', { sourceId: 'req', targetId: 'need', relationType: 'derives', properties: { quote: answer } })
    const j = JSON.parse(cli(['check', f, '--format', 'json']).out)
    return { report: strip(r.text), check: j.findings.filter((x) => WORD_RULES.includes(x.rule)).map((x) => `${x.rule}: ${x.message}`) }
  } finally { await m.close() }
}
