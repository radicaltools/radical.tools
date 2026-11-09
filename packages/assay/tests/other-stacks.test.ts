import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRepository, linkRepositories } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-stacks-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const units = (facts: ReturnType<typeof extractRepository>) => facts.units.map((u) => [u.path, u.stack, u.kind])
const refs = (facts: ReturnType<typeof extractRepository>) => facts.dependencies.filter((d) => d.target).map((d) => [d.unit.split(':unit:')[1], d.target!.split(':unit:')[1]])
const tables = (facts: ReturnType<typeof extractRepository>) => facts.tables.map((t) => t.table).sort()

describe('radical assay: Ruby, Elixir, Rust, Kotlin and what compose interpolates', () => {
  it('reads a Rails app, an Elixir umbrella and a Cargo workspace as their projects, and tooling as no unit', () => {
    const rails = extractRepository(repo('ledger', {
      Gemfile: 'source "https://rubygems.org"\ngem "rails", "~> 7.2"\ngem "pg"\n',
      'config/application.rb': 'module Ledger\n  class Application < Rails::Application\n  end\nend\n',
      'package.json': '{ "name": "ledger", "private": true, "devDependencies": { "@biomejs/biome": "1.9.4" } }',
      'app/models/account.rb': 'class Account < ApplicationRecord\nend\n',
    }))
    expect(units(rails)).toEqual([['.', 'ruby', 'app']])
    expect(rails.units[0].aliases).toContain('ledger')

    const elixir = extractRepository(repo('umbrella', {
      'mix.exs': 'defmodule Umbrella.MixProject do\n  def project do\n    [apps_path: "apps", deps: []]\n  end\nend\n',
      'apps/web/mix.exs': 'defmodule Web.MixProject do\n  def project, do: [app: :web, deps: deps()]\n  def application, do: [mod: {Web.Application, []}]\n  defp deps do\n    [\n      {:phoenix, "~> 1.7"},\n      {:core, in_umbrella: true}\n    ]\n  end\nend\n',
      'apps/core/mix.exs': 'defmodule Core.MixProject do\n  def project, do: [app: :core, deps: deps()]\n  defp deps do\n    [{:ecto_sql, "~> 3.10"}]\n  end\nend\n',
    }))
    expect(units(elixir)).toEqual([['apps/core', 'elixir', 'library'], ['apps/web', 'elixir', 'app']])
    expect(refs(elixir)).toEqual([['apps/web', 'apps/core']])

    const rust = extractRepository(repo('crates', {
      'Cargo.toml': '[workspace]\nmembers = ["api", "domain"]\n',
      'api/Cargo.toml': '[package]\nname = "api"\n\n[dependencies]\nactix-web = "4"\ndomain = { path = "../domain" }\n',
      'api/src/main.rs': 'fn main() {}\n',
      'domain/Cargo.toml': '[package]\nname = "domain"\n\n[dependencies]\nserde = "1"\n',
      'domain/src/lib.rs': 'pub fn f() {}\n',
      'tools/go.mod': 'module example.com/tools\n\ngo 1.22\n',
      'tools/tools.go': '//go:build tools\n\npackage tools\n\nimport _ "github.com/google/addlicense"\n',
    }))
    expect(units(rust)).toEqual([['api', 'rust', 'app'], ['domain', 'rust', 'library']])
    expect(refs(rust)).toEqual([['api', 'domain']])
  })

  it("reads a Gradle build's project dependencies by type-safe accessor and those its convention plugins add", () => {
    const facts = extractRepository(repo('android', {
      'settings.gradle.kts': 'enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")\ninclude(":app")\ninclude(":core:data-test")\ninclude(":core:ui")\ninclude(":feature:news")\n',
      'build.gradle.kts': 'plugins {\n    alias(libs.plugins.android.application) apply false\n}\n',
      'app/build.gradle.kts': 'plugins {\n    alias(libs.plugins.android.application)\n}\ndependencies {\n    implementation(projects.feature.news)\n    testImplementation(projects.core.dataTest)\n}\n',
      'core/data-test/build.gradle.kts': 'plugins {\n    alias(libs.plugins.android.library)\n}\n',
      'core/ui/build.gradle.kts': 'plugins {\n    alias(libs.plugins.android.library)\n}\n',
      'feature/news/build.gradle.kts': 'plugins {\n    alias(libs.plugins.nia.feature.impl)\n}\n',
      'build-logic/settings.gradle.kts': 'rootProject.name = "build-logic"\ninclude(":convention")\n',
      'build-logic/convention/build.gradle.kts': 'gradlePlugin {\n    plugins {\n        register("featureImpl") {\n            id = libs.plugins.nia.feature.impl.get().pluginId\n            implementationClass = "FeatureImplConventionPlugin"\n        }\n    }\n}\n',
      'build-logic/convention/src/main/kotlin/FeatureImplConventionPlugin.kt': 'class FeatureImplConventionPlugin : Plugin<Project> {\n    override fun apply(target: Project) {\n        dependencies {\n            "implementation"(project(":core:ui"))\n        }\n    }\n}\n',
    }))
    expect(refs(facts).sort()).toEqual([['app', 'core/data-test'], ['app', 'feature/news'], ['feature/news', 'core/ui']])
  })

  it("reads Rails' database.yml and schema.rb, and no database of a CI pipeline", () => {
    const facts = extractRepository(repo('ledger', {
      Gemfile: 'gem "rails"\n',
      'config/application.rb': 'module Ledger\nend\n',
      'config/database.yml': 'default: &default\n  adapter: postgresql\n  host: <%= ENV.fetch("DB_HOST") { "127.0.0.1" } %>\n\ndevelopment:\n  <<: *default\n  database: <%= ENV.fetch("POSTGRES_DB") { "ledger_development" } %>\n\nproduction:\n  <<: *default\n  database: <%= ENV.fetch("POSTGRES_DB") { "ledger_production" } %>\n',
      '.github/workflows/ci.yml': 'jobs:\n  test:\n    env:\n      DATABASE_URL: postgres://postgres:postgres@localhost:5432\n',
      'db/schema.rb': 'ActiveRecord::Schema[7.2].define(version: 2025_01_01) do\n  create_table "families", id: :uuid, force: :cascade do |t|\n    t.string "name"\n  end\n\n  create_table "accounts", id: :uuid, force: :cascade do |t|\n    t.uuid "family_id", null: false\n    t.string "name"\n    t.index ["family_id"], name: "index_accounts_on_family_id"\n  end\n\n  add_foreign_key "accounts", "families"\nend\n',
      'db/migrate/20240101_drop_issues.rb': 'class DropIssues < ActiveRecord::Migration[7.2]\n  def up\n    execute "DELETE FROM issues WHERE id > 0"\n  end\nend\n',
    }))
    expect(facts.databases.map((d) => [d.engine, d.server, d.name])).toEqual([['PostgreSQL', '127.0.0.1', 'ledger_production']])
    expect(tables(facts)).toEqual(['accounts', 'families'])
    expect(facts.tables.find((t) => t.table === 'accounts')?.columns?.map((c) => c.name)).toEqual(['family_id', 'name'])
    expect(facts.tables.find((t) => t.table === 'accounts')?.references?.map((r) => r.table)).toEqual(['families'])
  })

  it("replays Ecto's migrations, the SQL they execute or load by name included, over a dump of their time", () => {
    const facts = extractRepository(repo('stats', {
      'mix.exs': 'defmodule Stats.MixProject do\n  def project, do: [app: :stats, deps: deps()]\n  def application, do: [mod: {Stats.Application, []}]\n  defp deps do\n    [{:ecto_sql, "~> 3.10"}, {:oban, "~> 2.17"}]\n  end\nend\n',
      'config/runtime.exs': 'ch_url = get_env("CLICKHOUSE_DATABASE_URL", "http://events_db:8123/stats_events")\n',
      'priv/repo/structure.sql': 'CREATE TABLE public.invitations (id bigint);\n',
      'priv/repo/migrations/20200101000000_create_sites.exs': 'defmodule M1 do\n  use Ecto.Migration\n  def change do\n    create table(:sites) do\n      add :domain, :string\n    end\n    create table(:invitations)\n  end\nend\n',
      'priv/repo/migrations/20210101000000_teams.exs': 'defmodule M2 do\n  use Ecto.Migration\n  def up do\n    rename table(:sites), to: table(:domains)\n    drop table(:invitations)\n    Oban.Migrations.up(version: 12)\n  end\n  def down do\n    create table(:invitations)\n  end\nend\n',
      'priv/ingest_repo/migrations/20220101000000_events.exs': 'defmodule M3 do\n  use Ecto.Migration\n  def change do\n    execute """\n    CREATE TABLE IF NOT EXISTS events (site_id UInt64) ENGINE = MergeTree()\n    """,\n    """\n    DROP TABLE IF EXISTS events\n    """\n    execute unwrap("create-sessions", cluster?: false)\n  end\nend\n',
      'priv/data_migrations/sql/create-sessions.sql.eex': 'CREATE TABLE IF NOT EXISTS sessions (site_id UInt64) ENGINE = MergeTree()\n',
    }))
    expect(tables(facts)).toEqual(['domains', 'events', 'oban_jobs', 'oban_peers', 'sessions'])
    expect(facts.databases.map((d) => [d.engine, d.server, d.name])).toEqual([['ClickHouse', 'events_db', 'stats_events']])
  })

  it("reads an Android app's Room database and its entities' tables", () => {
    const facts = extractRepository(repo('news', {
      'settings.gradle.kts': 'include(":core:database")\n',
      'core/database/build.gradle.kts': 'plugins {\n    alias(libs.plugins.android.library)\n}\n',
      'core/database/src/main/kotlin/DatabaseModule.kt': 'object DatabaseModule {\n    fun db(context: Context): NewsDatabase = Room.databaseBuilder(\n        context,\n        NewsDatabase::class.java,\n        "news-database",\n    ).build()\n}\n',
      'core/database/src/main/kotlin/TopicEntity.kt': 'import androidx.room.Entity\n\n@Entity(\n    tableName = "topics",\n)\ndata class TopicEntity(\n    @PrimaryKey val id: String,\n)\n',
      'core/database/src/main/kotlin/NewsTopicCrossRef.kt': 'import androidx.room.Entity\nimport androidx.room.ForeignKey\n\n@Entity(\n    tableName = "news_topics",\n    primaryKeys = ["news_id", "topic_id"],\n    foreignKeys = [\n        ForeignKey(\n            entity = TopicEntity::class,\n            parentColumns = ["id"],\n            childColumns = ["topic_id"],\n        ),\n    ],\n)\ndata class NewsTopicCrossRef(val news_id: String, val topic_id: String)\n',
    }))
    expect(facts.databases.map((d) => [d.engine, d.name])).toEqual([['SQLite', 'news-database']])
    expect(tables(facts)).toEqual(['news_topics', 'topics'])
    expect(facts.tables.find((t) => t.table === 'news_topics')?.references?.map((r) => [r.column, r.table])).toEqual([['topic_id', 'topics']])
  })

  it("reads what a compose file takes from its .env: the Dockerfile a service builds and the addresses it passes by name", () => {
    const facts = extractRepository(repo('demo', {
      'package.json': '{ "name": "demo", "private": true, "devDependencies": { "markdownlint-cli": "^0.50.0" } }',
      '.env': 'CART_PORT=7070\nCART_ADDR=cart:${CART_PORT}\nCART_DOCKERFILE=./src/cart/Dockerfile\nCHECKOUT_DOCKERFILE=./src/checkout/Dockerfile\nKAFKA_DOCKERFILE=./src/kafka/Dockerfile\n',
      'compose.yaml': 'services:\n  cart:\n    build:\n      context: ./\n      dockerfile: ${CART_DOCKERFILE}\n  checkout:\n    build:\n      context: ./\n      dockerfile: ${CHECKOUT_DOCKERFILE}\n    environment:\n      - CART_ADDR\n      - OPAMP_ENDPOINT=http://opamp-server:4320\n  kafka:\n    build:\n      context: ./\n      dockerfile: ${KAFKA_DOCKERFILE}\n  opamp-server:\n    image: example/opamp-server\n',
      'src/cart/package.json': '{ "name": "cart", "scripts": { "start": "node index.js" } }',
      'src/cart/Dockerfile': 'FROM node:20\nCOPY src/cart .\n',
      'src/checkout/go.mod': 'module example.com/checkout\n\ngo 1.22\n',
      'src/checkout/main.go': 'package main\n\nfunc main() {}\n',
      'src/checkout/Dockerfile': 'FROM golang:1.22\nCOPY src/checkout .\n',
      'src/kafka/Dockerfile': 'FROM apache/kafka:4.0\nADD https://example.com/agent.jar /tmp/agent.jar\n',
    }))
    expect(units(facts)).toEqual([['src/cart', 'npm', 'app'], ['src/checkout', 'go', 'app'], ['src/kafka', 'docker', 'app']])
    expect(facts.services.map((s) => [s.name, s.unit?.split(':unit:')[1], s.role])).toEqual([['cart', 'src/cart', 'app'], ['checkout', 'src/checkout', 'app'], ['kafka', 'src/kafka', 'app'], ['opamp-server', undefined, 'observability']])
    const links = linkRepositories([facts]).filter((l) => l.kind !== 'runtime').map((l) => [l.kind, l.from.split(':').pop(), l.to.split(':').pop()])
    expect(links).toContainEqual(['address', 'src/checkout', 'src/cart'])
  })

  it('reads tables an attribute names over a DbSet, SQLite and Access by their files, and a schema by the services using its database', () => {
    const shop = extractRepository(repo('shop', {
      'src/Discount/Discount.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><ItemGroup><PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="8.0.0" /></ItemGroup></Project>',
      'src/Discount/appsettings.json': '{ "ConnectionStrings": { "Database": "Data Source=discountdb" } }',
      'src/Accounting/Accounting.csproj': '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" /></ItemGroup></Project>',
      'src/Accounting/Entities.cs': '[Table("orderitem", Schema = "accounting")]\n[PrimaryKey(nameof(Id))]\ninternal class OrderItemEntity\n{\n    public string Id { get; set; }\n}\n',
      'src/Accounting/Context.cs': 'internal class Db : DbContext\n{\n    public DbSet<OrderItemEntity> CartItems { get; set; }\n}\n',
      'src/catalog/go.mod': 'module example.com/catalog\n\ngo 1.22\n',
      'src/catalog/main.go': 'package main\n\nfunc main() {}\n',
      'src/postgresql/init.sql': 'CREATE DATABASE astronomy_db;\n\\connect astronomy_db\nCREATE TABLE catalog.products (id text);\n',
      'compose.yaml': 'services:\n  catalog:\n    build: ./src/catalog\n    environment:\n      - DB_CONNECTION_STRING=postgres://user:pw@astronomy-db:5432/astronomy_db\n  astronomy-db:\n    image: postgres:17\n    volumes:\n      - ./src/postgresql/init.sql:/docker-entrypoint-initdb.d/init.sql\n',
    }))
    expect(tables(shop)).toEqual(['orderitem', 'products'])
    expect(shop.tables.find((t) => t.table === 'products')?.unit).toBe('shop:unit:src/catalog')
    expect(shop.databases.filter((d) => d.engine === 'SQLite').map((d) => [d.unit?.split(':unit:')[1], d.name])).toEqual([['src/Discount', 'discountdb']])

    const pharmacy = extractRepository(repo('pharmacy', {
      'Pharmacy.vbp': 'Type=Exe\r\nDesigner=DataEnvironment1.Dsr\r\nName="Pharmacy"\r\n',
      'DataEnvironment1.Dsr': 'Begin {C0E45035-5775-11D0-B388-00A0C9055D8E} DataEnvironment1\r\n      ConnectionSource=   "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=E:\\Pharmacy 3\\pharmacy.dll;Mode=ReadWrite;Persist Security Info=False"\r\nEnd\r\n',
    }))
    expect(pharmacy.databases.map((d) => [d.engine, d.name])).toEqual([['Access', 'pharmacy.dll']])
  })
})
