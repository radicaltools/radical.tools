// ─── Element summary ────────────────────────────────────────────────────────
// What an element says in one line, which means something else for each
// type: a requirement its EARS sentence, a scenario its When → then, an ADR
// its status and the first sentence of its decision, a fitness function what
// it checks and its threshold, a mockup its screen, a C4 element its
// technology and the first sentence of its description. The table view
// shows it beside each name.

import type { C4Node, C4Relation } from './c4'
import { composeEarsSentence, firstParagraph, requirementStatePhrase, resolveEarsSubject } from './metamodel'

/** One line of running text: whitespace and Markdown heading marks folded. */
function line(text: unknown): string {
  return typeof text === 'string' ? firstParagraph(text).replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim() : ''
}

/** The first sentence of a text, as one line. */
function sentence(text: unknown): string {
  const l = line(text)
  const end = l.search(/[.!?](\s|$)/)
  return end >= 0 ? l.slice(0, end + 1) : l
}

function joined(parts: Array<string | false | undefined>, separator: string): string {
  return parts.filter(Boolean).join(separator)
}

/** `node`'s summary; its description's first sentence when its type says
 *  nothing more particular. */
export function nodeSummary(node: C4Node, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): string {
  const p = node as unknown as Record<string, unknown>
  const description = sentence(node.description)
  switch (node.type) {
    case 'requirement': {
      if (!line(p.action)) return description
      return composeEarsSentence(p, resolveEarsSubject(node.id, relations, nodes), requirementStatePhrase(node, nodes, relations) || undefined).sentence
    }
    case 'scenario': {
      // What happens and what follows; the Given is in the properties panel.
      const steps = joined([line(p.when) && `When ${line(p.when)}`, line(p.then) && `then ${line(p.then)}`], ' → ')
      return steps || description
    }
    case 'adr': {
      const decision = sentence(p.decision) || sentence(p.context) || description
      return joined([line(p.status) && capitalise(line(p.status)), decision], ': ')
    }
    case 'fitness-fn':
      return joined([description, line(p.threshold) && `threshold ${line(p.threshold)}`], ' — ')
    case 'mockup':
      return joined([line(p.screen), description], ' — ')
    case 'blueprint':
      return joined([joined([line(p.status) && capitalise(line(p.status)), line(p.domain)], ' · '), description || sentence(p.rationale)], ': ')
    case 'state':
      return description || joined([line(p.entry) && `entry: ${line(p.entry)}`, line(p.do) && `do: ${line(p.do)}`, line(p.exit) && `exit: ${line(p.exit)}`], '; ')
    default:
      return joined([node.technology?.trim() && `[${node.technology.trim()}]`, description], ' ')
  }
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
