import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRepository, linkRepositories } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-messages-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const pom = (artifact: string, dep = 'spring-kafka') => `<project><artifactId>${artifact}</artifactId><dependencies><dependency><artifactId>${dep}</artifactId></dependency></dependencies></project>`
const messages = (facts: ReturnType<typeof extractRepository>) => facts.messages.map((m) => [m.unit.split(':unit:')[1], m.role, m.channel, m.evidence.line])
const flows = (facts: ReturnType<typeof extractRepository>) => linkRepositories([facts]).filter((l) => l.kind === 'message').map((l) => [l.from.split(':unit:')[1], l.to.split(':unit:')[1], l.detail])

describe('radical assay: the messages units exchange', () => {
  it('reads what Spring Kafka publishes and its listeners consume, none in a comment, and links them by topic', () => {
    const facts = extractRepository(repo('shop', {
      'order/pom.xml': pom('order'),
      'order/src/main/java/o/OrderService.java': 'package o;\npublic class OrderService {\n  public void order(Order o) {\n    kafkaTemplate.send("order", o.getId() + "created", o);\n  }\n}\n',
      'shipping/pom.xml': pom('shipping'),
      'shipping/src/main/java/s/OrderListener.java': 'package s;\npublic class OrderListener {\n  @KafkaListener(topics = "order")\n  public void order(Order o) { }\n  // @KafkaListener(topics = "returns")\n}\n',
      'invoicing/pom.xml': pom('invoicing'),
      'invoicing/src/main/java/i/OrderListener.java': 'package i;\npublic class OrderListener {\n  @KafkaListener(topics = {"order"}, groupId = "invoicing")\n  public void order(Order o) { }\n}\n',
    }))
    expect(messages(facts)).toEqual([['invoicing', 'consumes', 'order', 3], ['order', 'publishes', 'order', 4], ['shipping', 'consumes', 'order', 3]])
    expect(flows(facts)).toEqual([['order', 'invoicing', 'Kafka order'], ['order', 'shipping', 'Kafka order']])
  })

  it("reads Spring Cloud Stream's bindings to the destinations its configuration gives them", () => {
    const facts = extractRepository(repo('todo', {
      'reminder/pom.xml': pom('reminder', 'spring-cloud-starter-stream-rabbit'),
      'reminder/src/main/resources/application.properties': 'spring.application.name=reminder\nspring.cloud.stream.bindings.output.destination=todo-mail\n',
      'reminder/src/main/java/r/Reminder.java': 'package r;\npublic class Reminder {\n  public void remind(Todo t) {\n    source.output().send(MessageBuilder.withPayload(t).build());\n  }\n}\n',
      'mailer/pom.xml': pom('mailer', 'spring-cloud-starter-stream-rabbit'),
      'mailer/src/main/resources/application.yml': 'spring:\n  cloud:\n    stream:\n      bindings:\n        input:\n          destination: todo-mail\n',
      'mailer/src/main/java/m/EventInput.java': 'package m;\npublic class EventInput {\n  @StreamListener(Sink.INPUT)\n  public void mail(Todo t) { }\n}\n',
    }))
    expect(flows(facts)).toEqual([['reminder', 'mailer', 'Spring Cloud Stream todo-mail']])
  })

  it('reads a .NET bus by message type, and kafkajs and pika by their calls', () => {
    const facts = extractRepository(repo('bus', {
      'src/Ordering/Ordering.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>',
      'src/Ordering/OrderService.cs': 'public class OrderService\n{\n    public async Task Start(Order o)\n    {\n        await events.AddAndSaveEventAsync(new OrderStartedIntegrationEvent(o.BuyerId));\n    }\n}\n',
      'src/Basket/Basket.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>',
      'src/Basket/OrderStartedHandler.cs': 'public class OrderStartedHandler : IIntegrationEventHandler<OrderStartedIntegrationEvent>\n{\n}\n',
      'payments/package.json': '{ "name": "payments", "dependencies": { "kafkajs": "2.2.4" } }',
      'payments/index.js': "await producer.send({ topic: 'payments', messages: [m] })\n",
      'ledger/requirements.txt': 'pika\n',
      'ledger/main.py': "channel.basic_consume(queue='payments', on_message_callback=book)\nchannel.basic_publish(exchange='', routing_key='booked', body=b)\n",
    }))
    expect(messages(facts)).toEqual([
      ['ledger', 'consumes', 'payments', 1], ['ledger', 'publishes', 'booked', 2],
      ['payments', 'publishes', 'payments', 1],
      ['src/Basket', 'consumes', 'OrderStartedIntegrationEvent', 1], ['src/Ordering', 'publishes', 'OrderStartedIntegrationEvent', 5],
    ])
    expect(flows(facts)).toEqual([['payments', 'ledger', 'Kafka payments'], ['src/Ordering', 'src/Basket', 'message bus OrderStartedIntegrationEvent']])
  })
})
