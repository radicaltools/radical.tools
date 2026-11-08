import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRepository, linkRepositories } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-values-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const vb = (lines: string[]) => `${lines.join('\r\n')}\r\n`
const pom = (artifact: string) => `<project><artifactId>${artifact}</artifactId><dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency><dependency><artifactId>spring-cloud-starter-netflix-eureka-client</artifactId></dependency></dependencies></project>`
const boot = (pkg: string) => `package ${pkg};\n@SpringBootApplication\npublic class App { public static void main(String[] a) { SpringApplication.run(App.class, a); } }\n`

describe('radical assay: what values, frameworks and runner images hide', () => {
  it("links a VB6 client to the server by a port that reaches the socket through a record, a variable and a constant", () => {
    const facts = extractRepository(repo('mud', {
      'Client/Mirage.vbp': vb(['Type=Exe', 'Module=modDatabase; modDatabase.bas', 'Module=modGeneral; modGeneral.bas', 'Module=modClientTCP; modClientTCP.bas', 'Name="Mirage"']),
      'Client/modDatabase.bas': vb(['Attribute VB_Name = "modDatabase"', 'Sub LoadDataFile()', '    If Not FileExist("data\\config.dat") Then', '        GameData.IP = "127.0.0.1"', '        GameData.Port = 7777', '    End If', 'End Sub']),
      'Client/modGeneral.bas': vb(['Attribute VB_Name = "modGeneral"', 'Public GAME_IP As String', 'Public GAME_PORT As Integer', 'Sub Main()', '    GAME_IP = Trim$(GameData.IP)', '    GAME_PORT = GameData.Port', 'End Sub']),
      'Client/modClientTCP.bas': vb(['Attribute VB_Name = "modClientTCP"', 'Sub TcpInit()', '    frmMainGame.Socket.RemoteHost = GAME_IP', '    frmMainGame.Socket.RemotePort = GAME_PORT', 'End Sub', 'Function ConnectToServer() As Boolean', '    With frmMainGame.Socket', '        .Close', '        .Connect', '    End With', 'End Function']),
      'Server/Server.vbp': vb(['Type=Exe', 'Module=modConstants; modConstants.bas', 'Module=modGeneral; modGeneral.bas', 'Name="Server"']),
      'Server/modConstants.bas': vb(['Attribute VB_Name = "modConstants"', "Public Const GAME_PORT = 7777 ' Run off What Port?"]),
      'Server/modGeneral.bas': vb(['Attribute VB_Name = "modGeneral"', 'Sub InitServer()', '    frmServer.Socket(0).LocalPort = GAME_PORT', '    frmServer.Socket(0).Listen', 'End Sub']),
    }))
    expect(facts.units.find((u) => u.path === 'Server')?.ports).toEqual([7777])
    expect(linkRepositories([facts]).map((l) => [l.kind, l.from, l.to])).toEqual([['address', 'mud:unit:Client', 'mud:unit:Server']])
  })

  it("reads a connection string's database from the variables and settings that build it, and a placeholder's from the dump", () => {
    const shop = extractRepository(repo('shop', {
      'Shop.vbp': vb(['Type=Exe', 'Module=modDB; modDB.bas', 'Name="Shop"']),
      'modDB.bas': vb([
        'Attribute VB_Name = "modDB"',
        'Sub IniciaBaseDatos()',
        '    DBservidor = ReadIni(App.Path & "\\data\\shop.ini", "MySQL", "server")',
        '    DBnombre = ReadIni(App.Path & "\\data\\shop.ini", "MySQL", "db")',
        'End Sub',
        'Sub ABRIR_DB()',
        '    DBConnectionString = "Driver={MySQL ODBC 3.51 Driver};Server=" & DBservidor & ";Port=3306;Database=" & DBnombre & ";User=" & DBusuario & ";Option=3;"',
        '    conn.Open DBConnectionString',
        'End Sub',
      ]),
      'data/shop.ini': vb(['[General]', 'Name=Shop', '', '[mySQL]', 'use=no', 'server= ""', 'db= ""', '', 'server = "192.168.0.105"', 'db = "services_cell_store"']),
    }))
    expect(shop.databases.map((d) => [d.engine, d.server, d.name])).toEqual([['MySQL', '192.168.0.105', 'services_cell_store']])

    const presence = extractRepository(repo('presence', {
      'Src/RFID/Presence.vbp': vb(['Type=Exe', 'Module=Module2; Module2.bas', 'Name="Presence"']),
      'Src/RFID/Module2.bas': vb([
        'Attribute VB_Name = "Module2"',
        'Sub Conn()',
        '    server = "sql12.freemysqlhosting.net"',
        '    dbName = "YOUR DATABASE NAME"',
        '    CN.Open "Driver={MySQL ODBC 8.0 ANSI Driver};Server=" & server _',
        '        & ";Port=3306;Database=" & dbName & ";Option=3;"',
        '    MyRecSet.Open "SELECT * FROM pengguna", CN',
        'End Sub',
      ]),
      'Assets/database/rfid_bot.sql': '-- phpMyAdmin SQL Dump\n-- Host: 127.0.0.1\n-- Database: `rfid_bot`\n\nCREATE TABLE `pengguna` (\n  `id` int(11) NOT NULL\n) ENGINE=InnoDB;\n',
    }))
    expect(presence.databases.map((d) => [d.engine, d.server, d.name])).toEqual([['MySQL', 'sql12.freemysqlhosting.net', 'rfid_bot']])
  })

  it("reads a config server's files as its clients' configuration, a gateway's routes and a Feign client's name as calls", () => {
    const facts = extractRepository(repo('piggy', {
      'pom.xml': '<project><artifactId>piggy</artifactId><packaging>pom</packaging><modules><module>config</module><module>registry</module><module>gateway</module><module>account-service</module><module>auth-service</module></modules></project>',
      'config/pom.xml': pom('config'),
      'config/src/main/java/piggy/config/App.java': boot('piggy.config').replace('@SpringBootApplication', '@SpringBootApplication\n@EnableConfigServer'),
      'config/src/main/resources/application.yml': 'spring:\n  cloud:\n    config:\n      server:\n        native:\n          search-locations: classpath:/shared\n  profiles:\n     active: native\nserver:\n  port: 8888\n',
      'config/src/main/resources/shared/application.yml': 'eureka:\n  client:\n    serviceUrl:\n      defaultZone: http://registry:8761/eureka/\n',
      'config/src/main/resources/shared/gateway.yml': 'zuul:\n  routes:\n    auth-service:\n        path: /uaa/**\n        url: http://auth-service:5000\n    account-service:\n        path: /accounts/**\n        serviceId: account-service\n',
      'config/src/main/resources/shared/account-service.yml': 'server:\n  port: 6000\n',
      ...Object.fromEntries(['registry', 'gateway', 'account-service', 'auth-service'].flatMap((name) => [
        [`${name}/pom.xml`, pom(name)],
        [`${name}/src/main/java/piggy/App.java`, boot('piggy')],
        [`${name}/src/main/resources/bootstrap.yml`, `spring:\n  application:\n    name: ${name}\n  cloud:\n    config:\n      uri: http://config:8888\n`],
      ])),
      'account-service/src/main/java/piggy/AuthServiceClient.java': 'package piggy;\n@FeignClient(name = "auth-service")\npublic interface AuthServiceClient {\n  @RequestMapping(method = RequestMethod.POST, value = "/uaa/users")\n  void createUser(User user);\n}\n',
    }))
    const calls = linkRepositories([facts]).filter((l) => l.kind === 'address').map((l) => `${l.from.split(':unit:')[1]} → ${l.to.split(':unit:')[1]}`)
    expect([...new Set(calls)].sort()).toEqual([
      'account-service → auth-service', 'account-service → config', 'account-service → registry',
      'auth-service → config', 'auth-service → registry',
      'gateway → account-service', 'gateway → auth-service', 'gateway → config', 'gateway → registry',
      'registry → config',
    ])
    expect(facts.units.find((u) => u.path === 'account-service')?.ports).toEqual([6000])
  })

  it('reads Django models of Wagtail and Doctrine entities as tables by their frameworks\' names', () => {
    const django = extractRepository(repo('bakery', {
      'requirements.txt': 'Django>=5.0\nwagtail>=7.0\n',
      'manage.py': 'import os\nos.environ.setdefault("DJANGO_SETTINGS_MODULE", "bakery.settings")\n',
      'bakery/breads/models.py': [
        'from django.db import models',
        'from modelcluster.models import ClusterableModel',
        'from wagtail.models import Orderable, Page',
        '',
        'class Country(models.Model):',
        '    title = models.CharField(max_length=100)',
        '',
        'class BreadIngredient(Orderable, DraftStateMixin, RevisionMixin, models.Model):',
        '    name = models.CharField(max_length=255)',
        '',
        'class BreadPage(Page):',
        '    introduction = models.TextField(blank=True)',
        '    origin = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True)',
        '    ingredients = ParentalManyToManyField("BreadIngredient", blank=True)',
        '',
        'class BreadsIndexPage(Page):',
        '    pass',
        '',
        'class Dated(models.Model):',
        '    created = models.DateTimeField()',
        '',
        '    class Meta:',
        '        abstract = True',
        '',
        'class Baker(',
        '    Dated,',
        '    ClusterableModel,',
        '):',
        '    first_name = models.CharField("First name", max_length=254)',
        '',
        'class IngredientBlock(StructBlock):',
        '    name = CharBlock()',
        '',
      ].join('\n'),
    }))
    expect(django.tables.map((t) => t.table).sort()).toEqual(['breads_baker', 'breads_breadingredient', 'breads_breadpage', 'breads_breadpage_ingredients', 'breads_breadsindexpage', 'breads_country'])
    expect(django.tables.find((t) => t.table === 'breads_breadpage')!.references?.map((r) => [r.column, r.table])).toEqual([['origin_id', 'breads_country']])

    const doctrine = extractRepository(repo('blog', {
      'composer.json': JSON.stringify({ require: { 'doctrine/orm': '^3', 'symfony/framework-bundle': '^7' } }),
      'public/index.php': '<?php\n',
      'src/Entity/Post.php': [
        '<?php',
        'namespace App\\Entity;',
        'use Doctrine\\ORM\\Mapping as ORM;',
        '',
        '#[ORM\\Entity(repositoryClass: PostRepository::class)]',
        "#[ORM\\Table(name: 'symfony_demo_post')]",
        'class Post',
        '{',
        '    #[ORM\\Id]',
        '    #[ORM\\Column(type: Types::INTEGER)]',
        '    private ?int $id = null;',
        '',
        '    #[ORM\\Column(type: Types::STRING)]',
        '    private ?string $publishedAt = null;',
        '',
        '    #[ORM\\ManyToOne(targetEntity: User::class)]',
        '    #[ORM\\JoinColumn(nullable: false)]',
        '    private ?User $author = null;',
        '',
        "    #[ORM\\ManyToMany(targetEntity: Tag::class, cascade: ['persist'])]",
        "    #[ORM\\JoinTable(name: 'symfony_demo_post_tag')]",
        '    private Collection $tags;',
        '}',
      ].join('\n'),
      'src/Entity/User.php': "<?php\nnamespace App\\Entity;\nuse Doctrine\\ORM\\Mapping as ORM;\n\n#[ORM\\Entity]\n#[ORM\\Table(name: 'symfony_demo_user')]\nclass User\n{\n    #[ORM\\Column(type: Types::STRING)]\n    private ?string $fullName = null;\n}\n",
      'src/Entity/BlogTag.php': '<?php\nnamespace App\\Entity;\nuse Doctrine\\ORM\\Mapping as ORM;\n\n#[ORM\\Entity]\nclass BlogTag\n{\n    #[ORM\\Column(type: Types::STRING, unique: true)]\n    private string $name;\n}\n',
    }))
    expect(doctrine.tables.map((t) => t.table).sort()).toEqual(['blog_tag', 'symfony_demo_post', 'symfony_demo_post_tag', 'symfony_demo_user'])
    const post = doctrine.tables.find((t) => t.table === 'symfony_demo_post')!
    expect(post.columns?.map((c) => c.name)).toEqual(['id', 'published_at'])
    expect(post.references?.map((r) => [r.column, r.table])).toEqual([['author_id', 'symfony_demo_user']])
  })

  it("reads no database from a commented setting, an SQLite URL's file, and a compose service's database despite its password's variable", () => {
    const symfony = extractRepository(repo('demo', {
      'composer.json': JSON.stringify({ require: { 'symfony/framework-bundle': '^7' } }),
      'public/index.php': '<?php\n',
      '.env': [
        '###> doctrine/doctrine-bundle ###',
        'DATABASE_URL="sqlite:///%kernel.project_dir%/data/database.sqlite"',
        '# DATABASE_URL="mysql://app:!ChangeMe!@127.0.0.1:3306/app?serverVersion=8.0.32&charset=utf8mb4"',
        '# DATABASE_URL="postgresql://app:!ChangeMe!@127.0.0.1:5432/app?serverVersion=16&charset=utf8"',
        '###< doctrine/doctrine-bundle ###',
      ].join('\n'),
      'config/packages/cache.yaml': 'framework:\n    cache:\n        # Redis\n        #app: cache.adapter.redis\n        #default_redis_provider: redis://localhost\n',
    }))
    expect(symfony.databases.map((d) => [d.engine, d.name])).toEqual([['SQLite', 'database.sqlite']])

    const fastapi = extractRepository(repo('template', {
      'backend/pyproject.toml': '[project]\nname = "app"\ndependencies = ["fastapi[standard]", "sqlmodel"]\n',
      'backend/Dockerfile': 'FROM python:3.12\nCOPY ./backend/app /app/app\nCMD ["fastapi", "run", "app/main.py"]\n',
      'backend/app/main.py': 'from fastapi import FastAPI\napp = FastAPI()\n',
      'compose.yml': [
        'services:',
        '  db:',
        '    image: postgres:18',
        '    environment:',
        '      - POSTGRES_DB=app',
        '  backend:',
        '    image: backend:latest',
        '    environment:',
        '      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:?Variable not set}@db:5432/app',
        '    build:',
        '      context: .',
        '      dockerfile: backend/Dockerfile',
        '',
      ].join('\n'),
    }))
    expect(fastapi.databases.filter((d) => d.unit).map((d) => [d.unit, d.engine, d.server, d.name])).toEqual([['template:unit:backend', 'PostgreSQL', 'db', 'app']])
  })

  it('links a front end to the unit whose compose service publishes the local port its address gives by default', () => {
    const facts = extractRepository(repo('ww', {
      'web/package.json': JSON.stringify({ name: 'web', scripts: { serve: 'vue-cli-service serve' } }),
      'web/src/repositories/user.js': "import UsersApi from './clients/users'\nconst users = new UsersApi()\nusers.basePath = `http://localhost:${process.env.VUE_APP_USERS_HTTP_PORT || 3002}/api`\n",
      'users/go.mod': 'module github.com/acme/ww/users\n\ngo 1.25.0\n',
      'users/main.go': 'package main\n\nfunc main() {}\n',
      'users/Dockerfile': 'FROM golang:1.25\nCOPY . .\nRUN go build -o /users\n',
      'docker-compose.yml': 'services:\n  users-http:\n    build:\n      context: users\n    ports:\n      - "127.0.0.1:3002:8080"\n',
    }))
    expect(facts.units.find((u) => u.path === 'users')?.ports).toEqual([3002])
    expect(linkRepositories([facts]).map((l) => [l.kind, l.from, l.to])).toEqual([['address', 'ww:unit:web', 'ww:unit:users']])
  })

  it('reads no unit of a workspace root, a vendored library or a runner image, and a Go module required by its replace as a dependency', () => {
    const facts = extractRepository(repo('ws', {
      'pyproject.toml': '[tool.uv.workspace]\nmembers = ["backend"]\n\n[dependency-groups]\ndev = ["ruff"]\n',
      'backend/pyproject.toml': '[project]\nname = "app"\ndependencies = ["fastapi"]\n',
      'backend/app/main.py': 'from fastapi import FastAPI\napp = FastAPI()\n',
      'src/WebApp/WebApp.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web" />\n',
      'src/WebApp/wwwroot/lib/bootstrap/package.json': JSON.stringify({ name: 'bootstrap', scripts: { dist: 'npm run css' } }),
      'src/WebApp/wwwroot/lib/bootstrap/composer.json': JSON.stringify({ name: 'twbs/bootstrap' }),
      'web/package.json': JSON.stringify({ name: 'web', scripts: { serve: 'vue-cli-service serve' } }),
      'docker/web/Dockerfile': 'FROM node:24-alpine\nADD start.sh /\nRUN chmod +x /start.sh\nCMD ["/start.sh"]\n',
      'docker/web/start.sh': '#!/bin/sh\nnpm install\nnpm run serve\n',
      'docker-compose.yml': 'services:\n  web:\n    build:\n      context: docker/web\n    working_dir: /web\n    volumes:\n      - ./web:/web\n      - /web/node_modules/\n',
      'internal/common/go.mod': 'module github.com/acme/ww/internal/common\n\ngo 1.25.0\n\nrequire github.com/go-chi/chi/v5 v5.3.2\n',
      'internal/common/server/http.go': 'package server\n',
      'internal/trainer/go.mod': 'module github.com/acme/ww/internal/trainer\n\ngo 1.25.0\n\nrequire (\n\tgithub.com/acme/ww/internal/common v0.0.0-00010101000000-000000000000\n\tgithub.com/go-chi/chi/v5 v5.3.2\n)\n\nreplace github.com/acme/ww/internal/common => ../common/\n',
      'internal/trainer/main.go': 'package main\n\nfunc main() {}\n',
    }))
    expect(facts.units.map((u) => u.path).sort()).toEqual(['backend', 'internal/common', 'internal/trainer', 'src/WebApp', 'web'])
    expect(facts.services.find((s) => s.name === 'web')?.unit).toBe('ws:unit:web')
    expect(facts.dependencies.filter((d) => d.target).map((d) => [d.unit, d.target])).toEqual([['ws:unit:internal/trainer', 'ws:unit:internal/common']])
  })
})
