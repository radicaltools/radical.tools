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

  it('reads what follows an enterprise block, as part of the model', () => {
    // The enterprise's closing brace ended the model: Big Bank plc came in
    // with its 18 elements and none of its 26 relationships.
    const r = parseStructurizrDsl(`workspace "Bank" {
    model {
        customer = person "Customer"
        enterprise "Big Bank plc" {
            staff = person "Staff"
            bank = softwareSystem "Banking" {
                api = container "API"
            }
        }
        customer -> bank "Uses"
        staff -> api "Runs"
    }
}`)
    expect(r.nodes.map((n) => n.label)).toEqual(['Customer', 'Staff', 'Banking', 'API'])
    expect(r.nodes.find((n) => n.label === 'Staff')?.parentId).toBeUndefined()
    expect(r.relations.map((x) => x.label)).toEqual(['Uses', 'Runs'])
  })

  it('reads what follows a relationship with a block of its own', () => {
    const src = workspace().replace('customer -> web "Browses" // a comment', 'customer -> web "Browses" "HTTPS" {\n            tags "Sync"\n        }')
    expect(counts(src)).toEqual([6, 4])
    const inside = workspace('-> customer "Notifies" {\n                tags "Async"\n            }')
    expect(counts(inside)).toEqual([6, 5])
  })

  it('skips a deployment environment and any other block with a name', () => {
    const src = workspace().replace('    }\n}', `
        deploymentEnvironment "Live" {
            deploymentNode "Server" "" "Ubuntu" {
                live = containerInstance api
                lb = infrastructureNode "Load balancer"
                lb -> live "Forwards to"
            }
        }
        customer -> api "Calls directly"
    }
}`)
    const r = parseStructurizrDsl(src)
    expect(r.nodes).toHaveLength(6)
    expect(r.relations.map((x) => x.label)).toEqual(['Browses', 'Calls', 'Reads orders', 'Sends email via', 'Calls directly'])
  })

  it('reads a # line as a comment, not as words', () => {
    // "# the person who buys" added a Person "person".
    const src = workspace().replace('customer = person', '# the person who buys\n        customer = person')
    const r = parseStructurizrDsl(src)
    expect(r.nodes.map((n) => n.label)).not.toContain('person')
    expect(counts(src)).toEqual([6, 4])
    // A colour in a style is no comment.
    expect(counts(src.replace('    }\n}', '    }\n    views {\n        styles {\n            element "Person" {\n                background #08427b\n            }\n        }\n    }\n}'))).toEqual([6, 4])
  })
})
