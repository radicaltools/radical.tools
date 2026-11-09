import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRepository, linkRepositories } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-brokers-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const links = (facts: ReturnType<typeof extractRepository>, kind?: string) => linkRepositories([facts]).filter((l) => !kind || l.kind === kind)
  .map((l) => [l.kind, l.from.split(/:unit:/).pop(), l.to.split(/:unit:|:service:/).pop()])

describe('radical assay: brokers and their messages, in any stack', () => {
  it('reads NATS subjects in Go, constants of another file and wildcards included, and the broker its clients assume', () => {
    const facts = extractRepository(repo('orders', {
      'go.mod': 'module example.com/orders\n\ngo 1.22\n\nrequire github.com/nats-io/nats.go v1.37.0\n',
      'ordersvc/main.go': 'package main\n\nimport "github.com/nats-io/nats.go"\n\nfunc main() {\n\tnc, _ := nats.Connect(nats.DefaultURL)\n\tjs, _ := nc.JetStream()\n\tjs.Publish(subjectCreated, data)\n}\n',
      'ordersvc/subjects.go': 'package main\n\nconst (\n\tsubjectCreated = "ORDERS.created"\n)\n',
      'paymentsvc/main.go': 'package main\n\nimport "github.com/nats-io/nats.go"\n\nfunc main() {\n\tnc, _ := nats.Connect(nats.DefaultURL)\n\tjs, _ := nc.JetStream()\n\tjs.QueueSubscribe("ORDERS.created", "payment", handle)\n}\n',
      'monitor/main.go': 'package main\n\nimport "github.com/nats-io/nats.go"\n\nfunc main() {\n\tnc, _ := nats.Connect(nats.DefaultURL)\n\tnc.Subscribe("ORDERS.*", show)\n}\n',
      'tools/nats-cli/main.go': 'package main\n\nfunc main() {}\n',
    }))
    expect(facts.services.map((s) => [s.name, s.assumed])).toEqual([['nats', true]])
    expect(links(facts, 'message').sort()).toEqual([['message', 'ordersvc', 'monitor'], ['message', 'ordersvc', 'paymentsvc']])
    expect(links(facts, 'address').map((l) => l[1]).sort()).toEqual(['monitor', 'ordersvc', 'paymentsvc'])
  })

  it("reads NestJS's emits and patterns by a shared constant, FastStream's topics from .env, and kafkajs's broker", () => {
    const facts = extractRepository(repo('shop', {
      'common/package.json': '{ "name": "@shop/common" }',
      'common/src/kafka.ts': "export const ORDER_EVENTS = {\n  CREATED: 'Order.Created',\n}\n",
      'orders/package.json': '{ "name": "orders", "scripts": { "start": "nest start" }, "dependencies": { "kafkajs": "2.2.4" } }',
      'orders/src/app.service.ts': 'export class AppService {\n  create() {\n    this.kafkaClient.emit(ORDER_EVENTS.CREATED, { value: order })\n  }\n}\n',
      'shipping/package.json': '{ "name": "shipping", "scripts": { "start": "nest start" }, "dependencies": { "kafkajs": "2.2.4" } }',
      'shipping/src/app.controller.ts': 'export class AppController {\n  @EventPattern(ORDER_EVENTS.CREATED)\n  ship(data) { }\n}\n',
      'docker-compose.yml': 'services:\n  kafka:\n    image: confluentinc/cp-kafka:7.6.0\n  kafka-topics:\n    image: confluentinc/cp-kafka:7.6.0\n',
      '.env.example': 'KAFKA_TOPIC=notifications\n',
      'pub/pyproject.toml': '[project]\nname = "pub"\ndependencies = ["faststream"]\n',
      'pub/main.py': 'async def publish(n, topic: str = settings.KAFKA_TOPIC):\n    await router.broker.publish(n.to_dict(), topic=topic)\n',
      'sub/pyproject.toml': '[project]\nname = "sub"\ndependencies = ["faststream"]\n',
      'sub/main.py': '@router.subscriber(settings.KAFKA_TOPIC)\nasync def handle(n):\n    pass\n',
    }))
    expect(links(facts, 'message').sort()).toEqual([['message', 'orders', 'shipping'], ['message', 'pub', 'sub']])
    expect(links(facts, 'address').filter((l) => l[2] === 'kafka').map((l) => l[1]).sort()).toEqual(['orders', 'pub', 'shipping', 'sub'])
  })

  it("gives each Go program the dependencies its packages import, and reads the program a Dockerfile's go build builds and a tracked build/ folder", () => {
    const facts = extractRepository(repo('financing', {
      'go.mod': 'module example.com/financing\n\ngo 1.22\n\nrequire (\n\tgithub.com/rabbitmq/amqp091-go v1.10.0\n\tgithub.com/jackc/pgx/v5 v5.6.0\n)\n',
      'cmd/commandsd/main.go': 'package main\n\nimport "example.com/financing/pkg/bus"\n\nfunc main() { bus.Run() }\n',
      'cmd/queriesd/main.go': 'package main\n\nimport "github.com/jackc/pgx/v5"\n\nfunc main() { pgx.Connect() }\n',
      'pkg/bus/bus.go': 'package bus\n\nimport amqp "github.com/rabbitmq/amqp091-go"\n\nfunc Run() { amqp.Dial("") }\n',
      'build/commandsd/Dockerfile': 'FROM golang:1.22 AS builder\nCOPY . .\nRUN CGO_ENABLED=0 go build ./cmd/commandsd/...\n',
      'build/postgres/create_tables.sql': 'CREATE TABLE events (id bigint);\n',
      'docker-compose.yml': 'services:\n  commands:\n    build:\n      context: .\n      dockerfile: ./build/commandsd/Dockerfile\n  rabbitmq:\n    image: rabbitmq:3-management\n',
    }))
    expect(facts.dependencies.filter((d) => !d.target).map((d) => [d.unit.split(':unit:')[1], d.package]).sort()).toEqual([['cmd/commandsd', 'github.com/rabbitmq/amqp091-go'], ['cmd/queriesd', 'github.com/jackc/pgx/v5']])
    expect(facts.services.map((s) => [s.name, s.unit?.split(':unit:')[1]])).toEqual([['commands', 'cmd/commandsd'], ['rabbitmq', undefined]])
    expect(facts.tables.map((t) => t.table)).toEqual(['events'])
    expect(links(facts, 'address')).toEqual([['address', 'cmd/commandsd', 'rabbitmq']])
  })

  it("builds a Go module's shared code with the program named as it is, and names no unit by a public subdomain's first label", () => {
    const facts = extractRepository(repo('chat', {
      'server/go.mod': 'module example.com/chat/server/v8\n\ngo 1.22\n',
      'server/cmd/chat/main.go': 'package main\n\nfunc main() {}\n',
      'server/cmd/chatctl/main.go': 'package main\n\nimport (\n\t"example.com/chat/server/v8/app"\n\t"example.com/chat/server/v8/store"\n)\n\nfunc main() { app.X(); store.Y() }\n',
      'server/app/app.go': 'package app\n\nfunc X() {}\n',
      'server/store/store.go': 'package store\n\nfunc Y() {}\n',
      'api/package.json': '{ "name": "api", "scripts": { "start": "redoc" }, "homepage": "https://api.github.com/x" }',
      'api/server.js': "fetch('https://api.github.com/repos/x')\n",
      'server/testdata/config.json': '{ "SqlSettings": { "DataSource": "postgres://u:p@localhost/mattermost_test" } }',
    }))
    expect(facts.units.filter((u) => u.shares).map((u) => u.path)).toEqual(['server/cmd/chat'])
    expect(links(facts)).toEqual([])
    expect(facts.databases).toEqual([])
  })
})
