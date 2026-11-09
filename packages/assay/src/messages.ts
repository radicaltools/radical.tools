// ─── Radical Assay: the messages a unit publishes and consumes ───────────────
//
// A unit's code puts messages on a topic, a queue or an exchange, or of a
// type a bus routes by its type, and another unit's code takes them off: a
// call between the two that neither names (link.ts joins them by channel).
// Java is read through its syntax tree (ADR Assay reads code through syntax
// trees): Spring Kafka's @KafkaListener and KafkaTemplate.send, Spring AMQP's
// @RabbitListener and RabbitTemplate.convertAndSend, Spring Cloud Stream's
// @StreamListener, StreamBridge.send and the bindings its configuration names.
// Other languages by their calls: kafkajs, amqplib, pika, kafka-python,
// Confluent.Kafka, kafka-go and sarama; .NET handlers of a message type
// (IConsumer<T>, IIntegrationEventHandler<T>, IHandleMessages<T>) and the
// units that create such a message.

import { extname } from 'node:path'
import type { MessageFact, Unit } from './facts'
import { GENERATED, RepoFiles, TEST_FILE, lineAt, owner } from './files'
import { springSettings } from './spring'
import { childrenOf, literal, parse, type Node } from './syntax'

type Found = Omit<MessageFact, 'id' | 'unit' | 'evidence'> & { line: number }

/** The string arguments of a Java annotation (topics = "a", queues = {"a", "b"}, "x"), by the names asked. */
function annotationStrings(args: Node | null, names: string[]): string[] {
  const out: string[] = []
  for (const arg of args?.namedChildren ?? []) {
    if (!arg) continue
    const key = arg.type === 'element_value_pair' ? arg.childForFieldName('key')?.text : undefined
    if (key !== undefined && !names.includes(key)) continue
    const value = arg.type === 'element_value_pair' ? arg.childForFieldName('value') : arg
    out.push(...(value?.type === 'string_literal' ? [value] : value?.type === 'element_value_array_initializer' ? childrenOf(value, 'string_literal') : []).map(literal))
  }
  return out
}

/** Java: listeners by their annotations, senders by their calls, each on its line. */
function java(text: string, bindings: Map<string, string>): Found[] {
  const out: Found[] = []
  const destination = (binding: string): string => bindings.get(binding) ?? binding
  const walk = (node: Node): void => {
    if (/annotation$/.test(node.type)) {
      const name = node.childForFieldName('name')?.text.split('.').pop() ?? ''
      const args = node.childForFieldName('arguments')
      const line = node.startPosition.row + 1
      if (name === 'KafkaListener') for (const t of annotationStrings(args, ['topics', 'value'])) out.push({ role: 'consumes', channel: t, via: 'Kafka', line })
      if (name === 'RabbitListener') for (const q of annotationStrings(args, ['queues', 'value'])) out.push({ role: 'consumes', channel: q, via: 'RabbitMQ', line })
      if (name === 'JmsListener') for (const d of annotationStrings(args, ['destination'])) out.push({ role: 'consumes', channel: d, via: 'JMS', line })
      if (name === 'StreamListener') {
        // @StreamListener("input"), or Sink.INPUT / Processor.INPUT: the binding named input.
        const named = annotationStrings(args, ['value', 'target'])
        const binding = named[0] ?? (/\bINPUT\b/.test(args?.text ?? '') ? 'input' : undefined)
        if (binding) out.push({ role: 'consumes', channel: destination(binding), via: 'Spring Cloud Stream', line })
      }
    }
    if (node.type === 'method_invocation') {
      const method = node.childForFieldName('name')?.text ?? ''
      const on = node.childForFieldName('object')?.text ?? ''
      const first = node.childForFieldName('arguments')?.namedChildren[0]
      const string = first?.type === 'string_literal' ? literal(first) : undefined
      const line = node.startPosition.row + 1
      if (string && method === 'send' && /kafka/i.test(on)) out.push({ role: 'publishes', channel: string, via: 'Kafka', line })
      if (string && /^(convertAndSend|send)$/.test(method) && /rabbit|amqp/i.test(on)) out.push({ role: 'publishes', channel: string, via: 'RabbitMQ', line })
      if (string && method === 'send' && /streamBridge/i.test(on)) out.push({ role: 'publishes', channel: destination(string), via: 'Spring Cloud Stream', line })
      // source.output().send(…): the binding named output.
      if (method === 'send' && /\.output\(\)$/.test(on)) out.push({ role: 'publishes', channel: destination('output'), via: 'Spring Cloud Stream', line })
    }
    for (const child of node.namedChildren) if (child) walk(child)
  }
  walk(parse('java', text).rootNode)
  return out
}

const MESSAGE_TYPE = /\b(?:IConsumer|IIntegrationEventHandler|IHandleMessages|IEventHandler)<\s*(\w+)\s*>/g
/** A file's handlers of a bus: IConsumer<T> is MassTransit's only where the file uses MassTransit (nopCommerce's is an
 *  in-process event of one application). */
const busTypes = (text: string): string[] => [...text.matchAll(MESSAGE_TYPE)].filter((m) => !m[0].startsWith('IConsumer') || /\busing\s+MassTransit\b|\bConsumeContext</.test(text)).map((m) => m[1])

/** Other languages by their calls: what each line publishes or consumes. */
/** What names a channel where the code names it by a constant: a JavaScript object's members (ORDER_EVENTS.CREATED),
 *  a constant or variable of the file, a setting the repository's .env files give (settings.KAFKA_TOPIC). */
interface Names { repo: Map<string, string>; env: Map<string, string> }

/** A channel argument as written: a string literal, or a name the file, the repository or its .env files give a value. */
function channel(arg: string | undefined, text: string, names: Names, depth = 0): string | undefined {
  if (!arg) return undefined
  const quoted = /^\s*(['"`])([\w.:*>/-]+)\1\s*$/.exec(arg)?.[2]
  if (quoted) return quoted
  const name = arg.trim()
  if (!/^[A-Za-z_][\w.]*$/.test(name)) return undefined
  const known = names.repo.get(name) ?? names.env.get(name.replace(/^(settings|config|env|process\.env|os\.environ)\./, ''))
  if (known) return known
  if (depth > 2) return undefined
  // A constant, a variable or a parameter's default of the file: NAME = "x", topic: str = settings.KAFKA_TOPIC.
  const local = new RegExp(`\\b${name.replace(/\./g, '\\.')}\\s*(?::\\s*[\\w\\[\\]]+)?\\s*:?=\\s*([^,)\\n]+)`).exec(text)?.[1]
  return local && local.trim() !== name ? channel(local, text, names, depth + 1) : undefined
}

const ARG = String.raw`((?:['"\`][\w.:*>/-]+['"\`])|[A-Za-z_][\w.]*)`

function byText(text: string, ext: string, consumed: Set<string>, names: Names): Found[] {
  const out: Found[] = []
  const add = (role: Found['role'], channel: string, via: string, index: number): void => { out.push({ role, channel, via, line: lineAt(text, index) }) }
  const named = (role: Found['role'], arg: string, via: string, index: number): void => { const c = channel(arg, text, names); if (c) add(role, c, via, index) }
  if (/^\.[cm]?[jt]sx?$/.test(ext)) {
    // NestJS: a client's emit or send of a pattern, and the handlers of a pattern.
    for (const m of text.matchAll(new RegExp(String.raw`\b\w*(?:kafka|client|broker|producer|bus)\w*\.(?:emit|send)\(\s*${ARG}`, 'gi'))) named('publishes', m[1], 'NestJS', m.index!)
    for (const m of text.matchAll(new RegExp(String.raw`@(?:EventPattern|MessagePattern)\(\s*${ARG}`, 'g'))) named('consumes', m[1], 'NestJS', m.index!)
    for (const m of text.matchAll(/\.send\(\s*\{\s*topic\s*:\s*['"`]([\w.-]+)['"`]/g)) add('publishes', m[1], 'Kafka', m.index!)
    for (const m of text.matchAll(/\.subscribe\(\s*\{\s*topics?\s*:\s*\[?\s*['"`]([\w.-]+)['"`]/g)) add('consumes', m[1], 'Kafka', m.index!)
    for (const m of text.matchAll(/\.(sendToQueue|publish)\(\s*['"`]([\w.-]+)['"`]/g)) add('publishes', m[2], 'RabbitMQ', m.index!)
    for (const m of text.matchAll(/\.consume\(\s*['"`]([\w.-]+)['"`]/g)) add('consumes', m[1], 'RabbitMQ', m.index!)
  }
  if (ext === '.py') {
    for (const m of text.matchAll(/\bbasic_publish\(([^)]*)\)/g)) {
      const exchange = /\bexchange\s*=\s*['"]([\w.-]*)['"]/.exec(m[1])?.[1]
      const key = /\brouting_key\s*=\s*['"]([\w.-]+)['"]/.exec(m[1])?.[1]
      const channel = exchange || key
      if (channel) add('publishes', channel, 'RabbitMQ', m.index!)
    }
    for (const m of text.matchAll(/\bbasic_consume\([^)]*\bqueue\s*=\s*['"]([\w.-]+)['"]/g)) add('consumes', m[1], 'RabbitMQ', m.index!)
    for (const m of text.matchAll(/\bproducer\.send\(\s*['"]([\w.-]+)['"]/g)) add('publishes', m[1], 'Kafka', m.index!)
    for (const m of text.matchAll(/\bKafkaConsumer\(\s*['"]([\w.-]+)['"]/g)) add('consumes', m[1], 'Kafka', m.index!)
    // FastStream: @broker.subscriber("topic"), @broker.publisher("topic"), broker.publish(msg, "topic" or topic=…).
    for (const m of text.matchAll(new RegExp(String.raw`@\w+(?:\.\w+)*\.subscriber\(\s*${ARG}`, 'g'))) named('consumes', m[1], 'FastStream', m.index!)
    for (const m of text.matchAll(new RegExp(String.raw`@\w+(?:\.\w+)*\.publisher\(\s*${ARG}`, 'g'))) named('publishes', m[1], 'FastStream', m.index!)
    for (const m of text.matchAll(new RegExp(String.raw`\bbroker\.publish\((?:[^()]|\([^()]*\))*?(?:,\s*|\btopic\s*=\s*|\bqueue\s*=\s*|\bsubject\s*=\s*)${ARG}\s*[,)]`, 'g'))) named('publishes', m[1], 'FastStream', m.index!)
  }
  if (ext === '.go' && /"github\.com\/nats-io\/nats\.go/.test(text)) {
    // NATS: subjects published, requested and subscribed, JetStream's too; a service's endpoints (micro).
    for (const m of text.matchAll(new RegExp(String.raw`\.(?:Publish|PublishMsg|PublishAsync|Request|RequestWithContext)\(\s*(?:ctx\s*,\s*)?${ARG}`, 'g'))) named('publishes', m[1], 'NATS', m.index!)
    for (const m of text.matchAll(new RegExp(String.raw`\.(?:Subscribe|QueueSubscribe|SubscribeSync|QueueSubscribeSync|ChanSubscribe|ChanQueueSubscribe|PullSubscribe)\(\s*${ARG}`, 'g'))) named('consumes', m[1], 'NATS', m.index!)
    for (const m of text.matchAll(/\bSubject\s*:\s*"([\w.*>-]+)"/g)) add('consumes', m[1], 'NATS', m.index!)
    const groups = new Map([...text.matchAll(new RegExp(String.raw`\b(\w+)\s*:?=\s*\w+\.AddGroup\(\s*${ARG}`, 'g'))].map((m) => [m[1], channel(m[2], text, names)]))
    for (const m of text.matchAll(new RegExp(String.raw`\b(\w+)\.AddEndpoint\(\s*${ARG}`, 'g'))) {
      const endpoint = channel(m[2], text, names)
      const group = groups.get(m[1])
      if (endpoint && !/micro\.WithEndpointSubject/.test(text.slice(m.index!, m.index! + 300).split('\n')[0])) add('consumes', group ? `${group}.${endpoint}` : endpoint, 'NATS', m.index!)
    }
  }
  if (ext === '.go') {
    for (const m of text.matchAll(/\b(Writer|WriterConfig|ProducerMessage)\s*\{[^}]*?\bTopic\s*:\s*"([\w.-]+)"/g)) add('publishes', m[2], 'Kafka', m.index!)
    for (const m of text.matchAll(/\b(Reader|ReaderConfig)\s*\{[^}]*?\bTopic\s*:\s*"([\w.-]+)"/g)) add('consumes', m[2], 'Kafka', m.index!)
    for (const m of text.matchAll(/\bConsumePartition\(\s*"([\w.-]+)"/g)) add('consumes', m[1], 'Kafka', m.index!)
  }
  if (ext === '.cs') {
    for (const m of text.matchAll(/\.ProduceAsync\(\s*"([\w.-]+)"|\.Produce\(\s*"([\w.-]+)"/g)) add('publishes', m[1] ?? m[2], 'Kafka', m.index!)
    for (const m of text.matchAll(/\.Subscribe\(\s*"([\w.-]+)"/g)) add('consumes', m[1], 'Kafka', m.index!)
    for (const m of text.matchAll(MESSAGE_TYPE)) if (busTypes(text).includes(m[1])) add('consumes', m[1], 'message bus', m.index!)
    // A message of a type some unit handles is created to be published (it may be stored first and sent by an outbox).
    for (const m of text.matchAll(/\bnew\s+(\w+)\s*\(/g)) if (consumed.has(m[1])) add('publishes', m[1], 'message bus', m.index!)
  }
  return out.sort((a, b) => a.line - b.line)
}

/** The messages the repository's units publish and consume, each with its file and line. */
export function readMessages(files: RepoFiles, repo: string, units: Unit[]): MessageFact[] {
  const out: MessageFact[] = []
  const seen = new Set<string>()
  const sources = files.list.filter((f) => /\.(java|[cm]?[jt]sx?|py|go|cs)$/.test(f) && !TEST_FILE.test(f) && !GENERATED.test(f))
  // The message types any unit handles: a type a .NET bus routes by.
  const consumed = new Set(sources.filter((f) => f.endsWith('.cs')).flatMap((f) => busTypes(files.read(f))))
  // The names a channel may be given by: JavaScript objects of constants anywhere in the repository, and its .env files.
  const names: Names = { repo: new Map(), env: new Map() }
  for (const f of sources.filter((x) => /\.[cm]?[jt]sx?$/.test(x))) {
    const text = files.read(f)
    for (const o of text.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=\s*\{([^{}]*)\}/g)) {
      for (const k of o[2].matchAll(/\b([A-Z][A-Z0-9_]*)\s*:\s*['"`]([^'"`\n]+)['"`]/g)) names.repo.set(`${o[1]}.${k[1]}`, k[2])
    }
  }
  // Go's string constants and variables of a package, by name and as pkg.Name; one a name gives two values is none.
  const ambiguous = new Set<string>()
  for (const f of sources.filter((x) => x.endsWith('.go'))) {
    const pkg = f.split('/').slice(-2, -1)[0]
    for (const m of files.read(f).matchAll(/^\s*(?:const\s+|var\s+)?([A-Za-z_]\w*)\s*(?:string\s*)?=\s*"([^"\n]+)"/gm)) {
      for (const key of [m[1], `${pkg}.${m[1]}`]) {
        if (names.repo.has(key) && names.repo.get(key) !== m[2]) ambiguous.add(key)
        else names.repo.set(key, m[2])
      }
    }
  }
  for (const key of ambiguous) names.repo.delete(key)
  for (const f of files.list.filter((x) => /(^|\/)\.env(\.[\w-]+)?$/.test(x))) {
    for (const m of files.read(f).matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*["']?([^"'#\s]+)/gm)) if (!names.env.has(m[1])) names.env.set(m[1], m[2])
  }
  const bindingsOf = new Map<string, Map<string, string>>()
  for (const file of sources) {
    const unit = owner(units, file)
    if (!unit) continue
    const text = files.read(file)
    if (!text) continue
    const ext = extname(file).toLowerCase()
    let found: Found[]
    if (ext === '.java') {
      if (!/Listener|send\(|convertAndSend|StreamBridge|output\(\)/.test(text)) continue
      // Spring Cloud Stream's bindings and the destinations its configuration gives them.
      if (!bindingsOf.has(unit.id)) bindingsOf.set(unit.id, new Map(springSettings(files, units, unit, /^spring\.cloud\.stream\.bindings\.[\w-]+\.destination$/).map((s) => [s.key.split('.')[4], s.value])))
      found = java(text, bindingsOf.get(unit.id)!)
    } else found = byText(text, ext, consumed, names)
    for (const f of found) {
      const id = `${repo}:message:${unit.path}:${f.role}:${f.channel}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push({ id, unit: unit.id, role: f.role, channel: f.channel, via: f.via, evidence: { file, line: f.line } })
    }
  }
  // A binding a unit's configuration names without code naming it: its role by its name (input, orders-in-0; output, orders-out-0).
  for (const unit of units) {
    for (const s of springSettings(files, units, unit, /^spring\.cloud\.stream\.bindings\.[\w-]+\.destination$/)) {
      const binding = s.key.split('.')[4]
      const role = /^input$|-in-\d+$/.test(binding) ? 'consumes' : /^output$|-out-\d+$/.test(binding) ? 'publishes' : undefined
      const id = role && `${repo}:message:${unit.path}:${role}:${s.value}`
      if (!role || !id || seen.has(id)) continue
      seen.add(id)
      out.push({ id, unit: unit.id, role, channel: s.value, via: 'Spring Cloud Stream', evidence: { file: s.file, line: s.line } })
    }
  }
  return out
}
