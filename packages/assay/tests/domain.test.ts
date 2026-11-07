import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRepository } from '../src/index'

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
