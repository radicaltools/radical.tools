import { describe, it, expect } from 'vitest'
import { parseStructurizrDsl } from '../src/formats/structurizrDsl'
import { builtInC4Metamodel, validateModel } from '../src/metamodel'

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

const byLabel = (r: ReturnType<typeof parseStructurizrDsl>, label: string) => r.nodes.find((n) => n.label === label)
const rel = (r: ReturnType<typeof parseStructurizrDsl>, label: string) => {
  const x = r.relations.find((y) => y.label === label)
  return x ? [r.nodes.find((n) => n.id === x.sourceId)?.label, r.nodes.find((n) => n.id === x.targetId)?.label] : undefined
}

// Item 178: with !identifiers hierarchical, relationships joined the wrong
// elements, or none, when two systems had parts with the same names.
describe('hierarchical identifiers', () => {
  const hier = `workspace "Shop" {
    !identifiers hierarchical
    model {
        customer = person "Customer"
        orders = softwareSystem "Orders" {
            api = container "Orders API" {
                controller = component "Order Controller"
                repository = component "Order Repository"
            }
            db = container "Orders DB" "" "PostgreSQL" "Database"
        }
        payments = softwareSystem "Payments" {
            api = container "Payments API" {
                controller = component "Payment Controller"
                repository = component "Payment Repository"
            }
            db = container "Payments DB" "" "PostgreSQL" "Database"
        }
        customer -> orders.api.controller "Places orders using" "HTTPS"
        orders.api.controller -> orders.api.repository "Saves orders with"
        orders.api.repository -> orders.db "Reads from and writes to" "JDBC"
        orders.api.controller -> payments.api.controller "Requests payment from" "HTTPS"
        payments.api.controller -> payments.api.repository "Saves payments with"
        payments.api.repository -> payments.db "Reads and writes" "SQL"
    }
}`

  it('joins each relationship to the elements its path names', () => {
    const r = parseStructurizrDsl(hier)
    expect(r.relations).toHaveLength(6)
    expect(rel(r, 'Places orders using')).toEqual(['Customer', 'Order Controller'])
    expect(rel(r, 'Saves orders with')).toEqual(['Order Controller', 'Order Repository'])
    expect(rel(r, 'Reads from and writes to')).toEqual(['Order Repository', 'Orders DB'])
    expect(rel(r, 'Requests payment from')).toEqual(['Order Controller', 'Payment Controller'])
    expect(rel(r, 'Saves payments with')).toEqual(['Payment Controller', 'Payment Repository'])
    expect(rel(r, 'Reads and writes')).toEqual(['Payment Repository', 'Payments DB'])
    expect(r.notRead).toEqual([])
  })

  it('tells a top-level element from a nested one with the same name, and reads names relative to a block', () => {
    const r = parseStructurizrDsl(`workspace "Same names" {
    !identifiers hierarchical
    model {
        email = softwareSystem "E-mail System" "Sends e-mails" "External"
        bank = softwareSystem "Internet Banking" {
            api = container "API" {
                email = component "E-mail Component"
                -> email "Logs to"
            }
            web = container "Web" {
                this -> api "Calls"
            }
        }
        bank.api.email -> email "Sends e-mail using"
    }
}`)
    expect(rel(r, 'Sends e-mail using')).toEqual(['E-mail Component', 'E-mail System'])
    // Inside API's block, "email" is API's own component.
    expect(rel(r, 'Logs to')).toEqual(['API', 'E-mail Component'])
    expect(rel(r, 'Calls')).toEqual(['Web', 'API'])
  })

  it('says which relationships name no element, and a name two elements share', () => {
    const r = parseStructurizrDsl(hier.replace('customer -> orders.api.controller', 'customer -> api').replace('payments.api.repository -> payments.db', 'payments.api.repository -> nowhere'))
    expect(r.relations).toHaveLength(4)
    expect(r.notRead.join(' ')).toMatch(/2 relationships name an element.*customer -> api.*nowhere/)
  })
})

// Item 179 and decision D6: the C4 metamodel relates person → person and
// container → component, as Structurizr does; what still does not fit is
// left out and said.
describe('the metamodel the model gets', () => {
  const bank = `workspace "Big Bank plc" {
    model {
        customer = person "Personal Banking Customer" "A customer of the bank." "Customer"
        enterprise "Big Bank plc" {
            supportStaff = person "Customer Service Staff" "" "Bank Staff"
            mainframe = softwaresystem "Mainframe Banking System" "Core banking." "Existing System"
            ibs = softwaresystem "Internet Banking System" {
                spa = container "Single-Page Application" "" "Angular" "Web Browser"
                api = container "API Application" "" "Java" {
                    group "Controllers" {
                        signin = component "Sign In Controller" "" "Spring MVC"
                    }
                    security = component "Security Component" "" "Spring Bean"
                }
                db = container "Database" "" "Oracle" "Database"
            }
        }
        customer -> supportStaff "Asks questions to" "Telephone"
        customer -> ibs "Uses"
        spa -> signin "Makes API calls to" "JSON/HTTPS"
        signin -> security "Uses"
        security -> db "Reads from and writes to" "JDBC"
        ibs -> mainframe "Gets account information from"
        db -> security "Notifies"
    }
}`

  it('imports Big Bank plc with nothing Validation would refuse', () => {
    const r = parseStructurizrDsl(bank)
    const nodes = Object.fromEntries(r.nodes.map((n) => [n.id, n]))
    const relations = Object.fromEntries(r.relations.map((x) => [x.id, x]))
    expect(validateModel(nodes, relations, builtInC4Metamodel()).filter((i) => i.severity === 'error' || /not allowed/.test(i.message))).toEqual([])
    expect(rel(r, 'Asks questions to')).toEqual(['Personal Banking Customer', 'Customer Service Staff'])
    expect(rel(r, 'Makes API calls to')).toEqual(['Single-Page Application', 'Sign In Controller'])
  })

  it('leaves out a group inside a container, keeping what it held, and says so', () => {
    const r = parseStructurizrDsl(bank)
    expect(r.nodes.some((n) => n.type === 'group')).toBe(false)
    expect(byLabel(r, 'Sign In Controller')?.parentId).toBe(byLabel(r, 'API Application')?.id)
    expect(r.notRead.join(' ')).toMatch(/Group "Controllers" was left out.*in "API Application"/)
  })

  it('leaves out a relationship the metamodel does not allow, and says so', () => {
    const r = parseStructurizrDsl(bank)
    expect(rel(r, 'Notifies')).toBeUndefined()
    expect(r.notRead.join(' ')).toMatch(/1 relationship between types the metamodel does not relate was left out: "Database" -> "Security Component" "Notifies"/)
  })

  it('marks an existing or external system external', () => {
    const r = parseStructurizrDsl(bank)
    expect(byLabel(r, 'Mainframe Banking System')?.external).toBe(true)
    expect(byLabel(r, 'Internet Banking System')?.external).toBeUndefined()
  })
})

// Runs 35 to 44: a description or technology given inside an element's
// block was dropped.
describe('what an element says inside its block', () => {
  it('reads description, technology and tags there, and text blocks', () => {
    const r = parseStructurizrDsl(`workspace "W" {
    model {
        user = person "User" """
            Somebody who
            buys things
        """
        shop = softwareSystem "Shop" {
            description "Sells things"
            tags "External System"
            api = container "API" {
                technology "Go"
                description "Takes orders"
            }
        }
        user -> shop "Buys from"
    }
}`)
    expect(byLabel(r, 'User')?.description).toBe('Somebody who\nbuys things')
    expect(byLabel(r, 'Shop')).toMatchObject({ description: 'Sells things', external: true })
    expect(byLabel(r, 'API')).toMatchObject({ description: 'Takes orders', technology: 'Go' })
    expect(r.relations).toHaveLength(1)
  })

  it('reads elements of an archetype as the element they stand for', () => {
    const r = parseStructurizrDsl(`workspace "Archetypes" {
    model {
        archetypes {
            application = container {
                technology "Java"
            }
            datastore = container {
                tags "Database"
            }
            sync = -> {
                tags "Synchronous"
            }
        }
        shop = softwareSystem "Shop" {
            api = application "API"
            db = datastore "DB"
            api --sync-> db "Reads from"
        }
    }
}`)
    expect(byLabel(r, 'API')).toMatchObject({ type: 'container', technology: 'Java' })
    expect(byLabel(r, 'DB')?.type).toBe('database')
    expect(rel(r, 'Reads from')).toEqual(['API', 'DB'])
  })
})

// The import said nothing about what it dropped (runs 45 to 64, D6).
describe('what the import cannot read', () => {
  it('names a workspace-level !include and still reads the model after it', () => {
    const r = parseStructurizrDsl(`workspace "Include" {
    !identifiers hierarchical
    !include model/people.dsl
    model {
        user = person "User"
        shop = softwareSystem "Shop"
        user -> shop "Uses"
    }
}`)
    expect(r.nodes).toHaveLength(2)
    expect(r.relations).toHaveLength(1)
    expect(r.notRead.join(' ')).toMatch(/!include model\/people\.dsl/)
  })

  it('names extends, deployment, custom elements and views it does not import', () => {
    const r = parseStructurizrDsl(`workspace extends https://example.com/base.json {
  model {
    user = person "User"
    box = element "Box" "Hardware"
    deploymentEnvironment "Live" {
      deploymentNode "Server" {
      }
    }
  }
  views {
    deployment * "Live" "LiveDeployment" {
      include *
    }
  }
}`)
    expect(r.nodes.map((n) => n.label)).toEqual(['User'])
    const said = r.notRead.join(' ')
    expect(said).toMatch(/extends https:\/\/example\.com\/base\.json/)
    expect(said).toMatch(/Custom elements \("Box"\)/)
    expect(said).toMatch(/Deployment environment "Live"/)
    expect(said).toMatch(/Deployment views are not imported/)
  })
})

// D20: the workspace's views come in as Radical views.
describe('views', () => {
  const src = `workspace "Shop" {
    model {
        customer = person "Customer"
        staff = person "Staff"
        shop = softwareSystem "Shop" {
            web = container "Web App"
            api = container "API" {
                orders = component "Orders"
                auth = component "Auth"
            }
            db = container "DB" "" "" "Database"
        }
        mail = softwareSystem "Mail" "" "External"
        other = softwareSystem "Other"
        customer -> web "Browses"
        web -> orders "Calls"
        orders -> auth "Checks"
        orders -> db "Reads"
        auth -> mail "Sends via"
        staff -> other "Uses"
    }
    views {
        systemLandscape "Landscape" {
            include *
            autoLayout
        }
        systemContext shop "Context" {
            include *
        }
        container shop {
            include *
            exclude mail
        }
        component api "Components" {
            include *
            title "API components"
        }
        dynamic api "Ordering" {
            web -> orders "Places an order"
            orders -> auth
            orders -> mail
        }
        filtered "Landscape" include "Element,Person" "Filtered"
        styles {
            element "Person" {
                shape Person
            }
        }
    }
}`
  const r = parseStructurizrDsl(src)
  const labels = (name: string) => r.views.find((v) => v.name === name)?.nodeIds.map((id) => r.nodes.find((n) => n.id === id)?.label)

  it('makes a view of each, named by its title or key, with what include * gives', () => {
    expect(r.views.map((v) => v.name)).toEqual(['Landscape', 'Context', 'Containers of Shop', 'API components', 'Ordering'])
    expect(labels('Landscape')).toEqual(['Customer', 'Staff', 'Shop', 'Mail', 'Other'])
    expect(labels('Context')).toEqual(['Customer', 'Shop', 'Mail'])
    expect(labels('Containers of Shop')).toEqual(['Customer', 'Shop', 'Web App', 'API', 'DB'])
    expect(labels('API components')).toEqual(['Web App', 'API', 'Orders', 'Auth', 'DB', 'Mail'])
    for (const v of r.views) expect(v.positions).toEqual({})
  })

  it('draws an element shown without what it holds folded', () => {
    const shop = byLabel(r, 'Shop')!.id
    expect(r.views.find((v) => v.name === 'Context')?.collapsedNodeIds).toEqual([shop])
    expect(r.views.find((v) => v.name === 'Containers of Shop')?.collapsedNodeIds).toEqual([byLabel(r, 'API')!.id])
  })

  it('makes a dynamic view play a sequence of its steps', () => {
    const v = r.views.find((x) => x.name === 'Ordering')!
    expect(v.kind).toBe('dynamic')
    const seq = r.sequences.find((s) => s.id === v.sequenceId)!
    expect(seq.relationIds.map((id) => r.relations.find((x) => x.id === id)?.label)).toEqual(['Calls', 'Checks'])
    expect(seq.stepDescriptions).toEqual(['Places an order', undefined])
    expect(r.notRead.join(' ')).toMatch(/View "Ordering": 1 step .*orders -> mail/)
    expect(r.notRead.join(' ')).toMatch(/Filtered views are not imported/)
  })
})

// Decided 2026-10-21 (runs 65 to 69): the import named every model
// "Imported diagram" when the workspace had no name after its keyword, and
// read no `name` in its block.
describe('the name the model gets', () => {
  it('is the workspace\'s, after its keyword or in its block, else none (the file\'s)', () => {
    expect(parseStructurizrDsl('workspace "Shop" { model { a = person "A" } }').name).toBe('Shop')
    expect(parseStructurizrDsl('workspace {\n  name "Orders"\n  model { a = person "A" }\n}').name).toBe('Orders')
    expect(parseStructurizrDsl('workspace { model { a = person "A" } }').name).toBe('')
  })
})

// Decided 2026-10-21 (runs 65 to 69): the views left the workspace's groups
// out, which Structurizr draws as boundaries round what they hold.
describe('groups on the views', () => {
  const r = parseStructurizrDsl(`workspace "Groups" {
  model {
    u = person "User"
    group "Core" {
      a = softwareSystem "Alpha" {
        group "Front" {
          web = container "Web"
        }
        api = container "API"
      }
      b = softwareSystem "Beta"
    }
    u -> web "Uses"
    web -> api "Calls"
    api -> b "Reads"
  }
  views {
    systemLandscape "L" {
      include *
    }
    container a "C" {
      include *
    }
    dynamic a "D" {
      u -> web "Opens"
      web -> api "Calls"
    }
  }
}`)
  const labels = (name: string) => r.views.find((v) => v.name === name)?.nodeIds.map((id) => r.nodes.find((n) => n.id === id)?.label)

  it('come in as groups holding their members', () => {
    expect(byLabel(r, 'Alpha')?.parentId).toBe(byLabel(r, 'Core')?.id)
    expect(byLabel(r, 'Web')?.parentId).toBe(byLabel(r, 'Front')?.id)
    expect(byLabel(r, 'Front')?.type).toBe('group')
  })

  it('are drawn round the elements a view shows, up to the element that holds them', () => {
    expect(labels('L')).toEqual(['User', 'Core', 'Alpha', 'Beta'])
    expect(labels('C')).toEqual(['User', 'Core', 'Alpha', 'Front', 'Web', 'API', 'Beta'])
    // A flow draws its participants, no boundaries.
    expect(labels('D')).toEqual(['User', 'Web', 'API'])
    // A group with a member shown is not folded.
    expect(r.views.find((v) => v.name === 'C')?.collapsedNodeIds).toBeUndefined()
  })
})

// Item 246: a step named the second of two relationships between the same
// elements, and the flow played the first, with the step's description as
// its note.
describe('a dynamic step between a pair with two relationships', () => {
  it('plays the relationship its description names', () => {
    const r = parseStructurizrDsl(`workspace "Orders" {
  model {
    shopper = person "Shopper"
    shop = softwareSystem "Shop" {
      api = container "Order API" "" "Java"
      db = container "Order DB" "" "PostgreSQL" "Database"
    }
    shopper -> api "Places orders using" "HTTPS"
    api -> db "Reads orders from" "JDBC"
    api -> db "Writes orders to" "JDBC"
  }
  views {
    dynamic shop "PlaceOrder" {
      shopper -> api "Places orders using"
      api -> db "Writes orders to"
      api -> db "Checks stock"
    }
  }
}`)
    const seq = r.sequences[0]
    expect(seq.relationIds.map((id) => r.relations.find((x) => x.id === id)?.label)).toEqual(['Places orders using', 'Writes orders to', 'Reads orders from'])
    // A description that names neither plays the first, with it as the note.
    expect(seq.stepDescriptions).toEqual([undefined, undefined, 'Checks stock'])
  })
})

