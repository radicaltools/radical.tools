import { describe, it, expect } from 'vitest'
import { parseStructurizrDsl } from '../src/formats/structurizrDsl'

// The import used to drop parts of a workspace without a word.

const workspace = (extra = '', mailBody = ''): string => `workspace "Shop" "An online shop" {
    model {
        customer = person "Customer" "Buys things"
        shop = softwareSystem "Shop" "Sells things" {
            ${extra}
            web = container "Web App" "Storefront" "React"
            api = container "API" "Orders API" "Node.js"
            db = container "Orders DB" "Stores orders" "PostgreSQL" "Database"
        }
        mail = softwareSystem "Mail Provider" "Sends email" "External"${mailBody}
        customer -> web "Browses" // a comment
        web -> api "Calls" "JSON/HTTPS"
        api -> db "Reads orders" "SQL"
        api -> mail "Sends email via" "SMTP" /* another */
    }
}`

const counts = (src: string): [number, number] => {
  const r = parseStructurizrDsl(src)
  return [r.nodes.length, r.relations.length]
}

describe('Structurizr DSL import', () => {
  it('reads the whole workspace', () => {
    expect(counts(workspace())).toEqual([6, 4])
  })

  it('keeps going after a URL: "//" inside a string is no comment', () => {
    // Comments were stripped before the strings were read: the URL cut its
    // line, the string stayed open, and only 2 elements and no relation
    // were left.
    expect(counts(workspace('url "https://shop.example.com"'))).toEqual([6, 4])
    const r = parseStructurizrDsl(workspace('description "See https://docs.example.com/shop for more"'))
    expect(r.relations).toHaveLength(4)
  })

  it('keeps two relationships between the same pair when they say different things', () => {
    const r = parseStructurizrDsl(workspace().replace('api -> db "Reads orders" "SQL"', 'api -> db "Reads orders" "SQL"\n        api -> db "Writes orders" "SQL"'))
    expect(r.relations.map((x) => x.label)).toEqual(expect.arrayContaining(['Reads orders', 'Writes orders']))
    expect(r.relations).toHaveLength(5)
  })

  it('reads a relationship with an implied source inside an element', () => {
    const r = parseStructurizrDsl(workspace('', ' {\n            -> customer "Emails receipts to"\n        }'))
    const sent = r.relations.find((x) => x.label === 'Emails receipts to')
    expect(sent).toBeDefined()
    expect(r.nodes.find((n) => n.id === sent!.sourceId)?.label).toBe('Mail Provider')
    expect(r.nodes.find((n) => n.id === sent!.targetId)?.label).toBe('Customer')
  })
})
