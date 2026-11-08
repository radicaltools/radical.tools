import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRepository, linkRepositories } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-calls-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const calls = (dir: string, kind?: string): string[] => {
  const facts = extractRepository(dir)
  return [...new Set(linkRepositories([facts]).filter((l) => !kind || l.kind === kind).map((l) => `${l.from.split(':unit:')[1]} → ${l.to.includes(':unit:') ? l.to.split(':unit:')[1] : l.to.split(':').slice(1).join(':')}`))].sort()
}

describe('radical assay: calls a unit makes, and calls it does not', () => {
  it("links the unit that calls a library's function making a gRPC client to the service, and not the library's other users", () => {
    const mod = (name: string, requires: string[] = []) => `module github.com/acme/ww/internal/${name}\n\ngo 1.25.0\n${requires.length ? `\nrequire (\n${requires.map((r) => `\tgithub.com/acme/ww/internal/${r} v0.0.0-00010101000000-000000000000\n`).join('')})\n\n${requires.map((r) => `replace github.com/acme/ww/internal/${r} => ../${r}/\n`).join('')}` : ''}`
    const dir = repo('ww', {
      'api/protobuf/trainer.proto': 'syntax = "proto3";\npackage trainer;\nservice TrainerService {\n  rpc IsHourAvailable(IsHourAvailableRequest) returns (IsHourAvailableResponse) {}\n}\n',
      'internal/common/go.mod': mod('common'),
      'internal/common/client/grpc.go': [
        'package client',
        '',
        'import "github.com/acme/ww/internal/common/genproto/trainer"',
        '',
        'func NewTrainerClient() (client trainer.TrainerServiceClient, err error) {',
        '\tconn, err := grpc.Dial(os.Getenv("TRAINER_GRPC_ADDR"))',
        '\treturn trainer.NewTrainerServiceClient(conn), nil',
        '}',
        '',
      ].join('\n'),
      'internal/trainer/go.mod': mod('trainer', ['common']),
      'internal/trainer/main.go': 'package main\n\nimport "github.com/acme/ww/internal/common/genproto/trainer"\n\nfunc main() {\n\ttrainer.RegisterTrainerServiceServer(server, svc)\n}\n',
      'internal/trainings/go.mod': mod('trainings', ['common']),
      'internal/trainings/main.go': 'package main\n\nimport grpcClient "github.com/acme/ww/internal/common/client"\n\nfunc main() {\n\ttrainerClient, err := grpcClient.NewTrainerClient()\n\t_ = trainerClient\n}\n',
      'internal/users/go.mod': mod('users', ['common']),
      'internal/users/main.go': 'package main\n\nimport "github.com/acme/ww/internal/common/server"\n\nfunc main() {\n\tserver.RunHTTPServer()\n}\n',
    })
    expect(calls(dir, 'grpc')).toEqual(['internal/common → internal/trainer', 'internal/trainings → internal/trainer'])
  })

  it("counts a config server's shared setting of a client library only for the units that depend on that library", () => {
    const pom = (artifact: string, deps: string[]) => `<project><artifactId>${artifact}</artifactId><dependencies>${['spring-boot-starter-web', ...deps].map((d) => `<dependency><artifactId>${d}</artifactId></dependency>`).join('')}</dependencies></project>`
    const service = (name: string, deps: string[]) => ({
      [`${name}/pom.xml`]: pom(name, deps),
      [`${name}/src/main/java/piggy/App.java`]: 'package piggy;\n@SpringBootApplication\npublic class App { public static void main(String[] a) { SpringApplication.run(App.class, a); } }\n',
      [`${name}/src/main/resources/bootstrap.yml`]: `spring:\n  application:\n    name: ${name}\n  cloud:\n    config:\n      uri: http://config:8888\n`,
    })
    const dir = repo('piggy', {
      'config/pom.xml': pom('config', ['spring-cloud-config-server']),
      'config/src/main/java/piggy/config/App.java': 'package piggy.config;\n@SpringBootApplication\n@EnableConfigServer\npublic class App {}\n',
      'config/src/main/resources/application.yml': 'spring:\n  cloud:\n    config:\n      server:\n        native:\n          search-locations: classpath:/shared\n',
      'config/src/main/resources/shared/application.yml': [
        'eureka:', '  client:', '    serviceUrl:', '      defaultZone: http://registry:8761/eureka/', '',
        'security:', '  oauth2:', '    resource:', '      user-info-uri: http://auth-service:5000/uaa/users/current', '',
        'spring:', '  rabbitmq:', '    host: rabbitmq', '',
      ].join('\n'),
      'docker-compose.yml': 'services:\n  rabbitmq:\n    image: rabbitmq:3-management\n',
      ...service('account-service', ['spring-cloud-starter-bus-amqp', 'spring-cloud-starter-netflix-eureka-client', 'spring-cloud-starter-oauth2']),
      ...service('gateway', ['spring-cloud-starter-netflix-eureka-client']),
      ...service('auth-service', ['spring-cloud-starter-oauth2', 'spring-cloud-starter-netflix-eureka-client']),
      ...service('registry', ['spring-cloud-starter-netflix-eureka-server']),
    })
    expect(calls(dir, 'address')).toEqual([
      'account-service → auth-service', 'account-service → config', 'account-service → registry', 'account-service → service:rabbitmq',
      'auth-service → config', 'auth-service → registry',
      'gateway → config', 'gateway → registry',
      'registry → config',
    ])
  })

  it('reads no call of a service another depends on only to have it finish first', () => {
    const dir = repo('meetings', {
      'src/Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web" />\n',
      'src/Api/Dockerfile': 'FROM mcr.microsoft.com/dotnet/aspnet:8.0\nCOPY . .\n',
      'src/Migrator/Migrator.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType></PropertyGroup></Project>\n',
      'src/Migrator/Dockerfile': 'FROM mcr.microsoft.com/dotnet/runtime:8.0\nCOPY . .\n',
      'src/Seeder/Seeder.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType></PropertyGroup></Project>\n',
      'src/Seeder/Dockerfile': 'FROM mcr.microsoft.com/dotnet/runtime:8.0\nCOPY . .\n',
      'docker-compose.yml': [
        'services:',
        '  api:',
        '    build: src/Api',
        '    depends_on:',
        '      migrator:',
        '        condition: service_started',
        '      seeder:',
        '        condition: service_completed_successfully',
        '      db:',
        '        condition: service_healthy',
        '  migrator:',
        '    build: src/Migrator',
        '  seeder:',
        '    build: src/Seeder',
        '  db:',
        '    image: mcr.microsoft.com/mssql/server:2022-latest',
        '',
      ].join('\n'),
    })
    expect(calls(dir, 'runtime')).toEqual(['src/Api → db:service:db'])
  })

  it("names a unit or service of the caller's own repository before another repository's, and depends_on only its own", () => {
    const system = (name: string) => extractRepository(repo(name, {
      'api/package.json': JSON.stringify({ name: `${name}-api`, scripts: { start: 'node server.js' }, dependencies: { amqplib: '^0.10' } }),
      'api/server.js': "const amqp = require('amqplib')\namqp.connect(process.env.BROKER || 'amqp://rabbitmq:5672')\n",
      'api/Dockerfile': 'FROM node:20\nCOPY . .\n',
      'docker-compose.yml': 'services:\n  api:\n    build: api\n    depends_on:\n      - rabbitmq\n  rabbitmq:\n    image: rabbitmq:3-management\n',
    }))
    const links = linkRepositories([system('garage'), system('finance')]).filter((l) => l.kind !== 'data')
    expect(links.map((l) => `${l.kind} ${l.from} → ${l.to}`).sort()).toEqual([
      'address finance:unit:api → finance:service:rabbitmq', 'address garage:unit:api → garage:service:rabbitmq',
      'runtime finance:unit:api → finance:service:rabbitmq', 'runtime garage:unit:api → garage:service:rabbitmq',
    ])
  })

  it('leaves a folder to its Python project when its package.json holds tooling alone', () => {
    const facts = extractRepository(repo('bakery', {
      'requirements.txt': 'Django>=5.0\nwagtail>=7.0\n',
      'manage.py': 'import os\n',
      'package.json': JSON.stringify({ name: 'bakery', private: true, devDependencies: { eslint: '^9', prettier: '^3' }, scripts: { 'lint:js': 'eslint .', format: 'prettier --write .' } }),
    }))
    expect(facts.units.map((u) => [u.path, u.stack, u.kind])).toEqual([['.', 'python', 'app']])
  })
})
