import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRepository, linkRepositories } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-cloud-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  execFileSync('git', ['add', '-A'], { cwd: dir })
  return dir
}

const pom = (artifact: string, ...deps: string[]) => `<project><artifactId>${artifact}</artifactId><dependencies>${deps.map((d) => `<dependency><groupId>org.springframework.cloud</groupId><artifactId>${d}</artifactId></dependency>`).join('')}</dependencies></project>`
const boot = (pkg: string) => `package ${pkg};\n@SpringBootApplication\npublic class App { public static void main(String[] a) { SpringApplication.run(App.class, a); } }\n`
const links = (facts: ReturnType<typeof extractRepository>) => linkRepositories([facts]).map((l) => [l.kind, l.from.split(/:unit:|:service:/).pop(), l.to.split(/:unit:|:service:/).pop()])

describe('radical assay: Spring Cloud and compose as they run', () => {
  it("links a client of Eureka, a config server, Kafka or RabbitMQ that names none to the repository's only one, apps only", () => {
    const facts = extractRepository(repo('cloud', {
      'registry/pom.xml': pom('registry', 'spring-cloud-starter-netflix-eureka-server'),
      'registry/src/main/java/r/App.java': boot('r'),
      'config/pom.xml': pom('config', 'spring-cloud-config-server', 'spring-cloud-starter-netflix-eureka-client'),
      'config/src/main/java/c/App.java': boot('c'),
      'orders/pom.xml': pom('orders', 'spring-cloud-starter-netflix-eureka-client', 'spring-cloud-starter-config', 'spring-kafka'),
      'orders/src/main/java/o/App.java': boot('o'),
      'shared/pom.xml': pom('shared', 'spring-kafka'),
      'docker-compose.yml': 'services:\n  kafka:\n    image: bitnami/kafka:3.7\n  zookeeper:\n    image: zookeeper:3.9\n',
    }))
    expect(links(facts).filter(([kind]) => kind === 'address').sort()).toEqual([
      ['address', 'config', 'registry'],
      ['address', 'orders', 'config'],
      ['address', 'orders', 'kafka'],
      ['address', 'orders', 'registry'],
    ])
    const two = extractRepository(repo('two', {
      'a/pom.xml': pom('a', 'spring-cloud-starter-netflix-eureka-server'),
      'b/pom.xml': pom('b', 'spring-cloud-starter-netflix-eureka-server'),
      'c/pom.xml': pom('c', 'spring-cloud-starter-netflix-eureka-client'),
      'c/src/main/java/c/App.java': boot('c'),
    }))
    expect(links(two)).toEqual([])
  })

  it('notes a config server that serves its configuration from another repository', () => {
    const facts = extractRepository(repo('basics', {
      'config-server/pom.xml': pom('config-server', 'spring-cloud-config-server'),
      'config-server/src/main/resources/application.yml': 'spring:\n  cloud:\n    config:\n      server:\n        git:\n          uri: https://github.com/acme/basics-config\nserver:\n  port: 8888\n',
    }))
    expect(facts.notes).toContain("config-server/src/main/resources/application.yml:6 serves its clients' configuration from https://github.com/acme/basics-config, another repository: give it to Assay too, to read the addresses and ports it sets")
  })

  it("reads compose's first format with its links, and a service's image named for a unit with a prefix", () => {
    const facts = extractRepository(repo('netflix', {
      'docker-compose.yml': 'rabbitmq:\n  image: rabbitmq:3-management\nconfig-server:\n  image: acme/basic-config-server\n  links:\n    - "rabbitmq"\nvalkey-cart:\n  image: valkey/valkey:7\n',
      'config-server/pom.xml': pom('config-server', 'spring-cloud-config-server'),
      'config-server/src/main/java/c/App.java': boot('c'),
      'cart/pom.xml': pom('cart'),
      'cart/src/main/java/k/App.java': boot('k'),
    }))
    expect(facts.services.map((s) => [s.name, s.unit?.split(':unit:')[1]])).toEqual([['rabbitmq', undefined], ['config-server', 'config-server'], ['valkey-cart', undefined]])
    expect(links(facts)).toContainEqual(['runtime', 'config-server', 'rabbitmq'])
  })

  it("reads deployment written into build/, and the services a Prometheus configuration scrapes", () => {
    const facts = extractRepository(repo('sample', {
      'build/docker/docker-compose.yml': 'services:\n  api-gateway:\n    build: ../../api-gateway\n',
      'build/classes/Generated.java': 'class Generated {}\n',
      'api-gateway/pom.xml': pom('api-gateway'),
      'api-gateway/src/main/java/g/App.java': boot('g'),
      'prometheus/Dockerfile': 'FROM prom/prometheus\nCOPY prometheus.yml /etc/prometheus/\n',
      'prometheus/prometheus.yml': "scrape_configs:\n- job_name: api-gateway\n  static_configs:\n  - targets: ['api-gateway:8080']\n",
    }))
    expect(facts.services.map((s) => [s.name, s.unit?.split(':unit:')[1]])).toEqual([['api-gateway', 'api-gateway']])
    expect(links(facts)).toContainEqual(['address', 'prometheus', 'api-gateway'])
  })

  it('reads a host a Spring placeholder defaults to', () => {
    const facts = extractRepository(repo('shop', {
      'order/pom.xml': pom('order'),
      'order/src/main/java/o/CatalogClient.java': 'package o;\npublic class CatalogClient {\n  public CatalogClient(@Value("${catalog.service.host:catalog}") String host, @Value("${catalog.service.port:8080}") long port) { }\n}\n',
      'catalog/pom.xml': pom('catalog'),
      'catalog/src/main/java/c/App.java': boot('c'),
    }))
    expect(facts.addresses.map((a) => [a.host, a.evidence.line])).toContainEqual(['catalog', 3])
    expect(links(facts)).toContainEqual(['address', 'order', 'catalog'])
  })
})
