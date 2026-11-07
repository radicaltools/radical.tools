import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkPlan, extractRepository, factIndex, linkRepositories, parsePlan } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-domain-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const SCHEMA = `# The shop's tables
CREATE TABLE customers (
  id INTEGER PRIMARY KEY, # the key
  email VARCHAR(200) NOT NULL UNIQUE
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'paid', 'shipped')),
  total DECIMAL(10, 2)
);

CREATE TABLE order_lines (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  sku VARCHAR(40),
  CONSTRAINT pk_lines UNIQUE (order_id, sku)
);

ALTER TABLE order_lines ADD CONSTRAINT fk_lines_order FOREIGN KEY (order_id) REFERENCES orders (id);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  order_id INTEGER,
  state ENUM('pending', 'captured', 'refunded'),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
`

const ORDER_JAVA = `package shop;

import jakarta.persistence.*;

@Entity
@Table(name = "orders")
public class Order {
  @Id
  @GeneratedValue
  private Long id;

  @ManyToOne
  @JoinColumn(name = "customer_id")
  private Customer customer;

  @Enumerated(EnumType.STRING)
  private OrderState state;

  @OneToMany(mappedBy = "order")
  private List<OrderLine> lines;

  private static final long serialVersionUID = 1L;

  public void pay() {
    this.state = OrderState.PAID;
  }
}
`

describe('radical assay: tables and their structure', () => {
  it("records each table's columns and the table each foreign key references, from SQL and an ORM class", () => {
    const facts = extractRepository(repo('shop', {
      'package.json': JSON.stringify({ name: 'shop', scripts: { start: 'node server.js' } }),
      'db/schema.sql': SCHEMA,
      'server.js': "const db = require('./db')\ndb.query('SELECT * FROM orders WHERE id = ?')\n",
    }))
    const byName = new Map(facts.tables.map((t) => [t.table, t]))
    expect([...byName.keys()].sort()).toEqual(['customers', 'order_lines', 'orders', 'payments'])
    const orders = byName.get('orders')!
    // Declared where it is created, though the code names it too.
    expect([orders.declared, orders.evidence, orders.inCode]).toEqual(['SQL', { file: 'db/schema.sql', line: 7 }, true])
    // A table only the schema names is used by no code of the unit.
    expect(byName.get('customers')!.inCode).toBeUndefined()
    expect(orders.columns!.map((c) => [c.name, c.type, c.line])).toEqual([['id', 'INTEGER', 8], ['customer_id', 'INTEGER', 9], ['status', 'VARCHAR(20)', 10], ['total', 'DECIMAL(10, 2)', 11]])
    expect(orders.references).toEqual([{ column: 'customer_id', table: 'customers', line: 9 }])
    // A MySQL comment hides no column after it.
    expect(byName.get('customers')!.columns!.map((c) => c.name)).toEqual(['id', 'email'])
    // A constraint is no column; ALTER TABLE adds its foreign key.
    expect(byName.get('order_lines')!.columns!.map((c) => c.name)).toEqual(['id', 'order_id', 'sku'])
    expect(byName.get('order_lines')!.references).toEqual([{ column: 'order_id', table: 'orders', line: 21 }])
    expect(byName.get('payments')!.references).toEqual([{ column: 'order_id', table: 'orders', line: 27 }])
  })

  it('reads JPA, Django, SQLAlchemy, TypeORM, Entity Framework Core and Prisma classes as the tables they map', () => {
    const java = extractRepository(repo('orders-java', {
      'pom.xml': '<project><groupId>shop</groupId><artifactId>orders</artifactId><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency></dependencies></project>',
      'src/main/java/shop/Order.java': ORDER_JAVA,
      'src/main/java/shop/Customer.java': 'package shop;\n\n@Entity\npublic class Customer {\n  @Id private Long id;\n  private String email;\n}\n',
    }))
    const order = java.tables.find((t) => t.table === 'orders')!
    expect([order.declared, order.evidence.line]).toEqual(['JPA', 7])
    expect(order.columns!.map((c) => [c.name, c.type])).toEqual([['id', 'Long'], ['state', 'OrderState']])
    expect(order.references).toEqual([{ column: 'customer_id', table: 'customer', line: 14 }])
    expect(java.tables.find((t) => t.table === 'customer')!.columns!.map((c) => c.name)).toEqual(['id', 'email'])

    const python = extractRepository(repo('py-shop', {
      'requirements.txt': 'django\nsqlalchemy\n',
      'manage.py': '',
      'orders/models.py': [
        'from django.db import models', '',
        'class Customer(models.Model):', '    email = models.EmailField()', '',
        'class Order(models.Model):', '    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)',
        '    status = models.CharField(max_length=20, choices=OrderStatus.choices)', '    tags = models.ManyToManyField("Tag")', '',
        '    class Meta:', '        db_table = "shop_orders"', '',
      ].join('\n'),
      'billing/tables.py': [
        'class Invoice(Base):', '    __tablename__ = "invoices"', '    id = Column(Integer, primary_key=True)',
        '    order_id: Mapped[int] = mapped_column(ForeignKey("shop_orders.id"))', '    order = relationship("Order")', '',
      ].join('\n'),
    }))
    const tables = new Map(python.tables.map((t) => [t.table, t]))
    expect([...tables.keys()].sort()).toEqual(['invoices', 'orders_customer', 'shop_orders'])
    expect(tables.get('shop_orders')!.references).toEqual([{ column: 'customer_id', table: 'orders_customer', line: 7 }])
    expect(tables.get('shop_orders')!.columns!.map((c) => [c.name, c.type])).toEqual([['status', 'OrderStatus']])
    expect([tables.get('invoices')!.declared, tables.get('invoices')!.references]).toEqual(['SQLAlchemy', [{ column: 'order_id', table: 'shop_orders', line: 4 }]])

    const ts = extractRepository(repo('ts-shop', {
      'package.json': JSON.stringify({ name: 'ts-shop', dependencies: { typeorm: '1', '@prisma/client': '1' } }),
      'src/order.entity.ts': [
        "import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm'", '',
        "@Entity('orders')", 'export class Order {', '  @PrimaryGeneratedColumn()', '  id: number', '',
        '  @ManyToOne(() => Customer, (c) => c.orders)', '  customer: Customer', '', '  @Column()', '  status: OrderStatus', '', '  note?: string', '}', '',
      ].join('\n'),
      'prisma/schema.prisma': [
        'model Customer {', '  id    Int     @id', '  email String', '  orders Order[]', '  @@map("customers")', '}', '',
        'model Invoice {', '  id      Int      @id', '  customer Customer @relation(fields: [customerId], references: [id])', '  customerId Int', '  state   InvoiceState', '}', '',
        'enum InvoiceState {', '  OPEN', '  PAID', '}', '',
      ].join('\n'),
    }))
    const typeorm = ts.tables.find((t) => t.table === 'orders')!
    expect([typeorm.declared, typeorm.columns!.map((c) => c.name), typeorm.references]).toEqual(['TypeORM', ['id', 'status'], [{ column: 'customerId', table: 'customers', line: 9 }]])
    const invoice = ts.tables.find((t) => t.table === 'Invoice')!
    expect([invoice.declared, invoice.columns!.map((c) => c.name), invoice.references]).toEqual(['Prisma', ['id', 'customerId', 'state'], [{ column: 'customerId', table: 'customers', line: 10 }]])

    const cs = extractRepository(repo('cs-shop', {
      'Shop/Shop.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><ItemGroup><PackageReference Include="Microsoft.EntityFrameworkCore" /></ItemGroup></Project>',
      'Shop/ShopContext.cs': 'public class ShopContext : DbContext {\n  public DbSet<Order> Orders { get; set; }\n  public DbSet<Customer> Customers { get; set; }\n}\n',
      'Shop/Order.cs': 'public class Order {\n  public int Id { get; set; }\n  public int CustomerId { get; set; }\n  public Customer Customer { get; set; }\n  public List<OrderLine> Lines { get; set; }\n}\n',
      'Shop/Customer.cs': 'public class Customer {\n  public int Id { get; set; }\n  public string Email { get; set; }\n}\n',
    }))
    const efOrder = cs.tables.find((t) => t.table === 'Orders')!
    expect([efOrder.declared, efOrder.columns!.map((c) => c.name), efOrder.references]).toEqual(['Entity Framework Core', ['Id', 'CustomerId'], [{ column: 'CustomerId', table: 'Customers', line: 4 }]])
  })
})

describe('radical assay: status values', () => {
  it('records the values a status takes and the lines that set each, from code and from SQL', () => {
    const facts = extractRepository(repo('shop', {
      'package.json': JSON.stringify({ name: 'shop', scripts: { start: 'node server.js' } }),
      'db/schema.sql': SCHEMA,
      'src/orders.ts': [
        "export type OrderStatus = 'new' | 'paid' | 'shipped'", '',
        'export function pay(order: { status: OrderStatus }) {', "  if (order.status === 'new') {", "    order.status = 'paid'", '  }', '}', '',
        'export function ship(order: { status: OrderStatus }) {', "  order.status = 'shipped'", '}', '',
        "export const fresh = () => ({ status: 'new' as OrderStatus })", '',
      ].join('\n'),
      'src/payments.ts': "export const capture = (db: Db, id: number) => db.run(\"UPDATE payments SET state = 'captured' WHERE id = ?\", id)\n",
    }))
    const byName = new Map(facts.states.map((s) => [s.name, s]))
    const order = byName.get('OrderStatus')!
    expect([order.values, order.evidence]).toEqual([['new', 'paid', 'shipped'], { file: 'src/orders.ts', line: 1 }])
    // The comparison is no setting; the assignments and the literal are.
    expect(order.sets.map((x) => [x.value, x.file, x.line])).toEqual([['paid', 'src/orders.ts', 5], ['shipped', 'src/orders.ts', 10], ['new', 'src/orders.ts', 13]])
    // The SQL's own: the column's CHECK and a MySQL ENUM, each with its table and column.
    const status = facts.states.find((s) => s.table === 'orders')!
    expect([status.name, status.column, status.values, status.initial, status.evidence.line]).toEqual(['status', 'status', ['new', 'paid', 'shipped'], 'new', 10])
    const payment = facts.states.find((s) => s.table === 'payments')!
    expect([payment.values, payment.sets.map((x) => [x.value, x.file, x.line])]).toEqual([['pending', 'captured', 'refunded'], [['captured', 'src/payments.ts', 1]]])
  })

  it('reads enums named for a state in Java, C#, Python and VB6, and the column whose type one is', () => {
    const facts = extractRepository(repo('orders-java', {
      'pom.xml': '<project><artifactId>orders</artifactId></project>',
      'src/main/java/shop/Order.java': ORDER_JAVA,
      'src/main/java/shop/OrderState.java': 'package shop;\n\npublic enum OrderState {\n  NEW("new"),\n  PAID("paid"),\n  CANCELLED("cancelled");\n\n  private final String code;\n  OrderState(String code) { this.code = code; }\n}\n',
      'src/main/java/shop/Color.java': 'public enum Color { RED, GREEN }\n',
    }))
    expect(facts.states.map((s) => [s.name, s.values, s.table, s.column, s.sets.map((x) => [x.value, x.line])])).toEqual([
      ['OrderState', ['NEW', 'PAID', 'CANCELLED'], 'orders', 'state', [['PAID', 25]]],
    ])
    const others = extractRepository(repo('mixed', {
      'Billing/Billing.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
      'Billing/InvoiceStatus.cs': 'public enum InvoiceStatus { Draft, Sent = 2, Paid }\n',
      'Billing/Invoice.cs': 'public class Invoice {\n  public void Send() {\n    Status = InvoiceStatus.Sent;\n  }\n}\n',
      'tickets/requirements.txt': 'flask\n',
      'tickets/app.py': 'from enum import Enum\n\nclass TicketState(str, Enum):\n    OPEN = "open"\n    CLOSED = "closed"\n\ndef close(t):\n    t.state = TicketState.CLOSED\n',
      'pos/POS.vbp': 'Type=Exe\r\nModule=Types; Types.bas\r\nName="POS"\r\n',
      'pos/Types.bas': "Public Enum SaleState\r\n  ssOpen = 0\r\n  ssClosed = 1 ' paid\r\nEnd Enum\r\n",
    }))
    expect(others.states.map((s) => [s.name, s.values, s.sets.map((x) => [x.value, x.file, x.line])])).toEqual([
      ['InvoiceStatus', ['Draft', 'Sent', 'Paid'], [['Sent', 'Billing/Invoice.cs', 3]]],
      ['SaleState', ['ssOpen', 'ssClosed'], []],
      ['TicketState', ['OPEN', 'CLOSED'], [['CLOSED', 'tickets/app.py', 8]]],
    ])
  })
})

describe('radical assay: status flags', () => {
  it('records a lifecycle kept in boolean flags and nullable dates, and the lines that set and clear each', () => {
    const facts = extractRepository(repo('game', {
      'Server.vbp': 'Type=Exe\r\nModule=modUser; modUser.bas\r\nName="Server"\r\n',
      'db/schema.sql': [
        'CREATE TABLE user (', '  id INT PRIMARY KEY,', '  is_dead BOOLEAN NOT NULL DEFAULT FALSE,', '  is_ban TINYINT(1) NOT NULL DEFAULT 0,',
        '  is_admin_note VARCHAR(20),', '  created_at DATETIME,', '  level INT NOT NULL', ');', '',
        'CREATE TABLE invoices (', '  id INT PRIMARY KEY,', '  PaidOn DATETIME NULL,', '  DueDate DATETIME NULL,', '  IssuedOn DATETIME NOT NULL,', '  shipped_at timestamp', ');', '',
      ].join('\n'),
      'modUser.bas': [
        'Attribute VB_Name = "modUser"', 'Public Sub Kill(ByVal id As Long)', '  db.Execute "UPDATE user SET is_dead = 1 WHERE id = " & id',
        'End Sub', 'Public Sub Revive(rs As Recordset)', '  rs!is_dead = 0', '  If rs!is_ban = 1 Then Exit Sub', 'End Sub',
        'Public Sub Pay(rs As Recordset)', '  rs("PaidOn") = Now', 'End Sub', '',
      ].join('\r\n'),
    }))
    const flags = facts.states.filter((s) => s.flags)
    expect(flags.map((s) => [s.id, s.name, s.table, s.values, s.flags!.map((f) => [f.column, f.value])])).toEqual([
      ['game:state:.:user.flags', 'user flags', 'user', ['dead', 'not dead', 'ban', 'not ban'], [['is_dead', 'dead'], ['is_ban', 'ban']]],
      ['game:state:.:invoices.flags', 'invoices flags', 'invoices', ['paid', 'not paid', 'shipped', 'not shipped'], [['PaidOn', 'paid'], ['shipped_at', 'shipped']]],
    ])
    // A comparison sets nothing; a date when the row was made, or one due, is no event of its lifecycle.
    expect(flags[0].sets.map((x) => [x.value, x.file, x.line])).toEqual([['dead', 'modUser.bas', 3], ['not dead', 'modUser.bas', 6]])
    expect(flags[1].sets.map((x) => [x.value, x.line])).toEqual([['paid', 10]])
  })
})

describe('radical assay: entry points', () => {
  it('records HTTP routes, scheduled jobs and message handlers, each with its line, and a unit\'s test framework', () => {
    const node = extractRepository(repo('orders-node', {
      'package.json': JSON.stringify({ name: 'orders', dependencies: { express: '4', 'node-cron': '3' }, devDependencies: { vitest: '4' } }),
      'src/server.ts': [
        "import express from 'express'", "import cron from 'node-cron'", 'const app = express()', 'const router = express.Router()',
        "router.get('/orders/:id', async (req, res) => res.json(await find(req.params.id)))", "router.post('/orders', place)",
        "app.use('/api', router)", "app.get('port')", "cron.schedule('0 3 * * *', purge)", '',
      ].join('\n'),
      'src/client.ts': "export const load = () => api.get('/orders', { params: {} })\n",
    }))
    expect(node.units[0].testFramework).toBe('vitest')
    expect(node.entries.map((e) => [e.kind, e.name, e.detail, e.evidence.line])).toEqual([
      ['route', 'GET /orders/:id', '/orders/:id', 5], ['route', 'POST /orders', '/orders', 6], ['job', 'cron', '0 3 * * *', 9],
    ])

    const spring = extractRepository(repo('orders-spring', {
      'pom.xml': '<project><artifactId>orders</artifactId><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId></dependency></dependencies></project>',
      'src/main/java/shop/OrderController.java': [
        '@RestController', '@RequestMapping("/api/orders")', 'public class OrderController {',
        '  @GetMapping("/{id}")', '  public Order one(@PathVariable long id) { return null; }',
        '  @PostMapping', '  public Order place(@RequestBody Order o) { return o; }',
        '  @Scheduled(cron = "0 0 * * * *")', '  public void expire() {}',
        '  @KafkaListener(topics = "payments")', '  public void onPayment(String m) {}', '}', '',
      ].join('\n'),
    }))
    expect(spring.units[0].testFramework).toBe('junit5')
    expect(spring.entries.map((e) => [e.kind, e.name, e.detail, e.evidence.line])).toEqual([
      ['route', 'GET /api/orders/{id}', '/api/orders/{id}', 4], ['route', 'POST /api/orders', '/api/orders', 6],
      ['job', 'expire', 'cron = "0 0 * * * *"', 8], ['handler', 'onPayment', 'payments', 10],
    ])
  })

  it('takes the test framework of the npm workspace whose root runs its packages\' tests', () => {
    const facts = extractRepository(repo('storefront', {
      'package.json': JSON.stringify({ name: 'storefront', private: true, workspaces: ['apps/*'], devDependencies: { vitest: '4' } }),
      'apps/web/package.json': JSON.stringify({ name: '@storefront/web', scripts: { dev: 'vite' } }),
      'apps/admin/package.json': JSON.stringify({ name: '@storefront/admin', scripts: { dev: 'vite' }, devDependencies: { jest: '29' } }),
    }))
    expect(facts.units.map((u) => [u.name, u.testFramework])).toEqual([['@storefront/admin', 'jest'], ['@storefront/web', 'vitest']])
  })

  it("reads a VB6 server's timers, any control a user clicks and the Handle procedures a Select calls, each with its Case", () => {
    const frm = [
      'VERSION 5.00', 'Begin VB.Form frmMain', '   Caption = "Server"',
      '   Begin VB.Timer AutoSave', '      Interval = 60000', '   End',
      '   Begin AOLibre.uAOButton btnStart', '      TX = "&Start"', '   End',
      '   Begin VB.Image imgLogo', '   End',
      'End', 'Attribute VB_Name = "frmMain"',
      'Private Sub AutoSave_Timer()', '  SaveWorld', 'End Sub', 'Private Sub imgLogo_Click()', 'End Sub', '',
    ].join('\r\n')
    const protocol = [
      'Attribute VB_Name = "Protocol"', 'Public Sub HandleIncomingData(ByVal id As Byte)', '  Select Case id',
      '    Case ClientPacketID.Login', '      Call HandleLogin', '    Case ClientPacketID.Walk: HandleWalk', '  End Select', 'End Sub',
      'Private Sub HandleLogin()', 'End Sub', 'Private Sub HandleWalk()', 'End Sub', 'Private Sub HandleUnused()', 'End Sub', '',
    ].join('\r\n')
    const facts = extractRepository(repo('server', { 'Server.vbp': 'Type=Exe\r\nForm=frmMain.frm\r\nModule=Protocol; Protocol.bas\r\nName="Server"\r\n', 'frmMain.frm': frm, 'Protocol.bas': protocol }))
    expect(facts.entries.filter((e) => e.kind !== 'form').map((e) => [e.kind, e.name, e.detail, e.evidence.line, e.handler?.line])).toEqual([
      ['handler', 'HandleIncomingData', undefined, 2, undefined],
      ['handler', 'HandleLogin', 'ClientPacketID.Login', 9, undefined],
      ['handler', 'HandleWalk', 'ClientPacketID.Walk', 11, undefined],
      ['handler', 'HandleUnused', undefined, 13, undefined],
      ['job', 'AutoSave', 'every 60000 ms', 4, 14],
      ['control', 'btnStart', 'Start', 7, undefined],
      ['control', 'imgLogo', undefined, 10, 17],
    ])
  })

  it("reads a VB6 form's caption, its menu items and buttons with their Click handlers, separators left out", () => {
    const frm = [
      'VERSION 5.00', 'Begin VB.Form frmSales', '   Caption         =   "Sales && Returns"', '   ClientHeight    =   3000',
      '   Begin VB.CommandButton cmdSave', '      Caption         =   "&Save sale"', '   End',
      '   Begin VB.Menu mnuFile', '      Caption         =   "&File"', '      Begin VB.Menu mnuExport', '         Caption         =   "&Export…"', '      End',
      '      Begin VB.Menu mnuSep', '         Caption         =   "-"', '      End', '   End', 'End',
      'Attribute VB_Name = "frmSales"', 'Private Sub Form_Load()', 'End Sub', "Private Sub cmdSave_Click()", "  ' saves", 'End Sub', 'Private Sub mnuExport_Click()', 'End Sub', '',
    ].join('\r\n')
    const facts = extractRepository(repo('pos', { 'POS.vbp': 'Type=Exe\r\nForm=frmSales.frm\r\nName="POS"\r\n', 'frmSales.frm': frm }))
    expect(facts.units[0].testFramework).toBeUndefined()
    expect(facts.entries.map((e) => [e.kind, e.name, e.form, e.detail, e.evidence.line, e.handler?.line])).toEqual([
      ['form', 'frmSales', undefined, 'Sales & Returns', 2, 19],
      ['control', 'cmdSave', 'frmSales', 'Save sale', 5, 21],
      ['menu', 'mnuExport', 'frmSales', 'Export…', 10, 24],
      ['menu', 'mnuFile', 'frmSales', 'File', 8, undefined],
    ])
  })
})

describe('radical assay: tests that check nothing', () => {
  it('marks a passing test whose body is empty or asserts nothing, and refuses a scenario resting on it', () => {
    const dir = repo('web', {
      'package.json': JSON.stringify({ name: 'web', scripts: { dev: 'vite' }, devDependencies: { vitest: '4' } }),
      'tests/orders.test.js': [
        "import { describe, expect, it } from 'vitest'", "describe('orders', () => {",
        "  it('shows an order', () => {})", "  it('places an order', async () => { await fetch('/api/orders'); expect(1).toBe(1) })",
        "  it('lists orders', () => {", "    // the list", "    expect(list()).toHaveLength(2)", '  })', '})', '',
      ].join('\n'),
      'reports/unit.json': JSON.stringify({ testResults: [{ name: 'tests/orders.test.js', assertionResults: ['shows an order', 'places an order', 'lists orders'].map((title) => ({ ancestorTitles: ['orders'], title, status: 'passed' })) }] }),
    })
    const facts = extractRepository(dir)
    expect(facts.tests.map((t) => [t.test, t.checksNothing ?? false])).toEqual([
      ['tests/orders.test.js › orders › shows an order', true], ['tests/orders.test.js › orders › places an order', true], ['tests/orders.test.js › orders › lists orders', false],
    ])
    const { plan } = parsePlan({
      elements: [{ key: 'web', type: 'webapp', label: 'Web', units: ['web:unit:.'], facts: ['web:unit:.'], confidence: 'observed' }],
      requirements: [{ key: 'r', label: 'Show an order', satisfiedBy: 'web', properties: { action: 'the web shall show it' }, scenarios: [
        { key: 's1', label: 'Shown', given: 'g', when: 'w', then: 't', tests: ['web:test:tests/orders.test.js › orders › shows an order'] },
        { key: 's2', label: 'Listed', given: 'g', when: 'w', then: 't', tests: ['web:test:tests/orders.test.js › orders › lists orders'] },
      ] }],
    })
    expect(checkPlan(plan, factIndex([facts]), () => false, [facts])).toEqual([
      'requirements[0] (Show an order), scenario 1 (Shown): web:test:tests/orders.test.js › orders › shows an order checks nothing (its body is empty or asserts nothing), so it passes whatever the code does: leave it out of the scenario; rest the scenario on explored paths or on the code it is drawn from (citations), whose pending test the team then writes',
    ])
  })
})

describe('radical assay: what legacy repositories hide', () => {
  it('reads the database a schema creates, in the engine its dialect shows, and links the program to it', () => {
    const dir = repo('erp', {
      'ERP.vbp': 'Type=Exe\r\nForm=frmMain.frm\r\nName="ERP"\r\n',
      'frmMain.frm': 'VERSION 5.00\r\nBegin VB.Form frmMain\r\nEnd\r\nAttribute VB_Name = "frmMain"\r\nPrivate Sub Form_Load()\r\n  cn.Open "Provider=SQLOLEDB;Data Source=" & server & ";Initial Catalog=" & catalog\r\n  rs.Open "SELECT * FROM items", cn\r\nEnd Sub\r\n',
      'schema.sql': "USE MASTER\r\nGO\r\n--- CREATE DATABASE [commented_out]\r\nCREATE DATABASE [erp_db] COLLATE SQL_Latin1_General_CP1_CI_AS\r\nGO\r\nCREATE TABLE [dbo].[items] ([id] [int] IDENTITY (1, 1) NOT NULL, [name] [nvarchar] (50) NULL)\r\nGO\r\n",
    })
    const facts = extractRepository(dir)
    expect(facts.databases.map((d) => [d.engine, d.name, d.evidence])).toEqual([['SQL Server', 'erp_db', { file: 'schema.sql', line: 4 }]])
    expect(linkRepositories([facts]).map((l) => [l.kind, l.from, l.to])).toEqual([['data', 'erp:unit:.', 'erp:db:.:SQL Server/erp_db']])
  })

  it("leaves out a library's connection templates of several engines, with a note", () => {
    const facts = extractRepository(repo('lib', {
      'Lib.vbp': 'Type=OleDll\r\nClass=cDatabase; cDatabase.cls\r\nName="Lib"\r\n',
      'cDatabase.cls': [
        'Attribute VB_Name = "cDatabase"', 'Public Function Template(kind As Long) As String', '  Select Case kind',
        '    Case 1: Template = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=" & path', '    Case 2: Template = "DRIVER={MySQL ODBC 8.0 Driver};SERVER=" & host',
        '    Case 3: Template = "Provider=SQLOLEDB;Data Source=" & host & ";Initial Catalog=" & db', '  End Select', 'End Function', '',
      ].join('\r\n'),
    }))
    expect(facts.databases).toEqual([])
    expect(facts.notes).toContain('cDatabase.cls holds connection strings of 3 engines (Access, MySQL, SQL Server): a library\'s templates, read as no database')
  })

  it("reads a schema in no unit's folder, in UTF-16, as that of every unit whose code names one of its tables", () => {
    const schema = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('CREATE TABLE [dbo].[Bill] (\r\n  [BillNo] [int] NOT NULL,\r\n  [Amount] [money] NULL\r\n)\r\nGO\r\nCREATE TABLE [dbo].[Rate] ([Metal] [varchar] (10) NULL)\r\nGO\r\n', 'utf16le')])
    const dir = repo('shop', {
      'Shop VB/Shop.vbp': 'Type=Exe\r\nModule=modMain; modMain.bas\r\nName="Shop"\r\n',
      'Shop VB/modMain.bas': 'Attribute VB_Name = "modMain"\r\nSub Main()\r\n  rs.Open "SELECT * FROM Bill", cn\r\nEnd Sub\r\n',
      'Shop Other/Other.vbp': 'Type=Exe\r\nModule=modMain; modMain.bas\r\nName="Other"\r\n',
      'Shop Other/modMain.bas': 'Attribute VB_Name = "modMain"\r\nSub Main()\r\nEnd Sub\r\n',
    })
    writeFileSync(join(dir, 'Shop.sql'), schema)
    const facts = extractRepository(dir)
    expect(facts.tables.map((t) => [t.unit, t.table, t.declared, t.columns?.map((c) => c.name)]).sort()).toEqual([
      ['shop:unit:Shop VB', 'Bill', 'SQL', ['BillNo', 'Amount']], ['shop:unit:Shop VB', 'Rate', 'SQL', ['Metal']],
    ])
  })

  it("leaves out the views and a database's own tables the code names", () => {
    const facts = extractRepository(repo('app', {
      'App.vbp': 'Type=Exe\r\nModule=modMain; modMain.bas\r\nName="App"\r\n',
      'modMain.bas': [
        'Attribute VB_Name = "modMain"', 'Sub Main()', '  rs.Open "SELECT * FROM orders", cn', '  rs.Open "SELECT * FROM order_totals", cn',
        '  rs.Open "SELECT * FROM appview_itemlist", cn', '  rs.Open "SELECT name FROM sysdatabases", cn', '  rs.Open "SELECT name FROM sys.master_files", cn', 'End Sub', '',
      ].join('\r\n'),
      'db/schema.sql': 'CREATE TABLE orders (id INT PRIMARY KEY);\nCREATE VIEW order_totals AS SELECT id FROM orders;\n',
    }))
    expect(facts.tables.map((t) => t.table)).toEqual(['orders'])
  })

  it('reads an Access database DAO opens by a file its code names, and the tables it opens by name', () => {
    const dir = repo('viewer', {
      'Viewer.vbp': 'Type=Exe\r\nModule=modData; modData.bas\r\nName="Viewer"\r\n',
      'modData.bas': [
        'Attribute VB_Name = "modData"', 'Const DB_FILE = "Projects.mdb"', 'Public Sub OpenAll(ByVal sFile As String)',
        '  Set DB = DBEngine.OpenDatabase(App.Path & "\\" & DB_FILE)', '  Set tabItems = DB.OpenRecordset("Items")',
        '  rs.Open "Spells", cn, adOpenStatic, adLockReadOnly, adCmdTable', '  Kill App.Path & "\\temp.mdb"', 'End Sub', '',
      ].join('\r\n'),
      'Projects.mdb': '',
    })
    const facts = extractRepository(dir)
    // A file the repository holds, not one the code makes at run time.
    expect(facts.databases.map((d) => [d.engine, d.name, d.evidence.line])).toEqual([['Access', 'Projects.mdb', 2]])
    expect(linkRepositories([facts]).map((l) => [l.kind, l.to])).toEqual([['data', 'viewer:db:.:Access/Projects.mdb']])
    expect(facts.tables.map((t) => t.table)).toEqual(['Items', 'Spells'])
  })

  it('takes a nameless connection for the Access database the unit names, and reads none from one beside nothing, with a note', () => {
    const named = extractRepository(repo('app', {
      'App.vbp': 'Type=Exe\r\nModule=modData; modData.bas\r\nName="App"\r\n', 'Data.mdb': '',
      'modData.bas': 'Attribute VB_Name = "modData"\r\nSub Main()\r\n  cn.Open "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=" & sPath\r\n  sPath = App.Path & "\\Data.mdb"\r\nEnd Sub\r\n',
    }))
    expect(named.databases.map((d) => [d.engine, d.name])).toEqual([['Access', 'Data.mdb']])
    const none = extractRepository(repo('tool', {
      'Tool.vbp': 'Type=Exe\r\nModule=modData; modData.bas\r\nName="Tool"\r\n',
      'modData.bas': 'Attribute VB_Name = "modData"\r\nSub Main()\r\n  cn.Open "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=" & sPath\r\nEnd Sub\r\n',
    }))
    expect(none.databases).toEqual([])
    expect(none.notes).toContain('modData.bas:3 connects to Access with its database filled in at run time: no database read')
  })

  it("links a client to the server on the port their forms' fields hold, the nearest of several listening on it", () => {
    const field = (name: string, text: string) => `   Begin VB.TextBox ${name}\r\n      Text = "${text}"\r\n   End`
    const form = (name: string, fields: string[], code: string[]) => ['VERSION 5.00', `Begin VB.Form ${name}`, ...fields, 'End', `Attribute VB_Name = "${name}"`, ...code, ''].join('\r\n')
    const files: Record<string, string> = {}
    for (const demo of ['One', 'Two']) {
      files[`${demo}/Master/Master.vbp`] = 'Type=Exe\r\nForm=FMaster.frm\r\nName="Master"\r\n'
      files[`${demo}/Master/FMaster.frm`] = form('FMaster', [field('txtHost', '127.0.0.1'), field('txtPort', '1502'), field('txtReadAddress', '0')], ['Private Sub cmdConnect_Click()', '  m.Connect txtHost.Text, txtPort.Text', 'End Sub'])
      files[`${demo}/Slave/Slave.vbp`] = 'Type=Exe\r\nForm=FSlave.frm\r\nName="Slave"\r\n'
      files[`${demo}/Slave/FSlave.frm`] = form('FSlave', [field('txtTCPPort', '1502'), field('txtSerialPort', 'COM1')], ['Private Sub cmdStart_Click()', '  m_Slave.Start CStr(Val(txtTCPPort.Text))', 'End Sub'])
    }
    const facts = extractRepository(repo('demos', files))
    expect(facts.units.filter((u) => u.ports).map((u) => [u.path, u.ports])).toEqual([['One/Slave', [1502]], ['Two/Slave', [1502]]])
    expect(facts.addresses.map((a) => [a.unit, a.text])).toEqual([['demos:unit:One/Master', 'txtHost=127.0.0.1 txtPort=1502'], ['demos:unit:Two/Master', 'txtHost=127.0.0.1 txtPort=1502']])
    expect(linkRepositories([facts]).map((l) => [l.kind, l.from, l.to])).toEqual([
      ['address', 'demos:unit:One/Master', 'demos:unit:One/Slave'], ['address', 'demos:unit:Two/Master', 'demos:unit:Two/Slave'],
    ])
  })
})
