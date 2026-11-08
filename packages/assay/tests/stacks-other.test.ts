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

const EMPTY = '<Project Sdk="Microsoft.NET.Sdk" />\n'

describe('radical assay: what other stacks hide', () => {
  it('reads the project references Directory.Build.targets adds by conditions on the project\'s name and path', () => {
    const facts = extractRepository(repo('meetings', {
      'src/Directory.Build.targets': [
        '<Project>',
        '  <PropertyGroup><DomainPath>$(MSBuildThisFileDirectory)BuildingBlocks\\Domain\\BuildingBlocks.Domain.csproj</DomainPath></PropertyGroup>',
        '  <ItemGroup Condition="$(MSBuildProjectName.EndsWith(\'API\'))">',
        '    <ProjectReference Include="..\\..\\Modules\\**\\Infrastructure\\*.csproj" />',
        '  </ItemGroup>',
        '  <ItemGroup Condition="$(MSBuildProjectFullPath.Contains(\'Modules\')) and $(MSBuildProjectName.EndsWith(\'Application\'))">',
        '    <ProjectReference Include="..\\Domain\\*.csproj" />',
        '    <ProjectReference Include="$(DomainPath)" />',
        '  </ItemGroup>',
        '  <ItemGroup Condition="$(MSBuildProjectFullPath.Contains(\'Modules\')) and $(MSBuildProjectName.EndsWith(\'Infrastructure\'))">',
        '    <ProjectReference Include="..\\Application\\*.csproj" />',
        '  </ItemGroup>',
        '</Project>',
      ].join('\n'),
      'src/API/Meetings.API/Meetings.API.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web" />\n',
      'src/BuildingBlocks/Domain/BuildingBlocks.Domain.csproj': EMPTY,
      'src/Modules/Payments/Domain/Payments.Domain.csproj': EMPTY,
      'src/Modules/Payments/Application/Payments.Application.csproj': EMPTY,
      'src/Modules/Payments/Infrastructure/Payments.Infrastructure.csproj': EMPTY,
    }))
    expect(facts.dependencies.filter((d) => d.target).map((d) => [d.unit.split(':unit:')[1], d.target!.split(':unit:')[1], d.evidence.file]).sort()).toEqual([
      ['src/API/Meetings.API', 'src/Modules/Payments/Infrastructure', 'src/Directory.Build.targets'],
      ['src/Modules/Payments/Application', 'src/BuildingBlocks/Domain', 'src/Directory.Build.targets'],
      ['src/Modules/Payments/Application', 'src/Modules/Payments/Domain', 'src/Directory.Build.targets'],
      ['src/Modules/Payments/Infrastructure', 'src/Modules/Payments/Application', 'src/Directory.Build.targets'],
    ])
  })

  it('reads an Nx project, a database project and a build project as units, and no Dockerfile that builds others or a development container', () => {
    const facts = extractRepository(repo('ws', {
      'nx.json': '{}',
      'package.json': JSON.stringify({ name: 'api', scripts: { start: 'node dist/main.js' } }),
      'e2e/project.json': JSON.stringify({ name: 'e2e', projectType: 'application' }),
      '.devcontainer/Dockerfile': 'FROM node:20\n',
      '.devcontainer/devcontainer.json': '{}',
      'build/_build.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType></PropertyGroup></Project>\n',
      'src/Dockerfile': 'FROM mcr.microsoft.com/dotnet/sdk:8.0\nCOPY ["Api/Api.csproj", "Api/"]\nCOPY . .\n',
      'src/Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web" />\n',
      'src/Database/Dockerfile': 'FROM mcr.microsoft.com/mssql/server:2022-latest\nCOPY ./Db/Scripts/Create.sql /scripts/\nADD entrypoint.sh /\n',
      'src/Database/entrypoint.sh': '/opt/mssql/bin/sqlservr\n',
      'src/Database/Db/Db.sqlproj': '<Project Sdk="MSBuild.Sdk.SqlProj/2.0.0" />\n',
      'src/Database/Db/Scripts/Create.sql': 'CREATE DATABASE [Shop]\n',
      // An application in html/ that its Dockerfile packages is known by the Dockerfile's folder.
      'ratings/Dockerfile': 'FROM php:8-apache\nCOPY html/ /var/www/html/\n',
      'ratings/html/composer.json': JSON.stringify({ require: { 'slim/slim': '^4' } }),
      'ratings/html/index.php': '<?php\n',
    }))
    expect(facts.units.map((u) => [u.path, u.kind]).sort()).toEqual([
      ['.', 'app'], ['build', 'app'], ['e2e', 'tests'], ['ratings', 'app'], ['src/Api', 'app'], ['src/Database', 'app'], ['src/Database/Db', 'library'],
    ])
  })

  it("reads a Laravel application's database from its environment file and its default connection", () => {
    const facts = extractRepository(repo('wiki', {
      'composer.json': JSON.stringify({ name: 'acme/wiki' }),
      'package.json': JSON.stringify({ name: 'wiki', scripts: { dev: 'vite' } }),
      '.env.example': 'APP_NAME=Wiki\nDB_HOST=localhost\nDB_DATABASE=wiki\n',
      'app/Config/database.php': "<?php\nreturn [\n    'default' => env('DB_CONNECTION', 'mysql'),\n];\n",
    }))
    expect(facts.databases.map((d) => [d.engine, d.name, d.evidence.file])).toEqual([['MySQL', 'wiki', '.env.example']])
  })

  it("reads a Prisma datasource whose address the environment gives as a database of its provider's engine", () => {
    const facts = extractRepository(repo('api', {
      'package.json': JSON.stringify({ name: 'api', scripts: { start: 'node main.js' } }),
      'prisma/schema.prisma': 'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\nmodel User {\n  id Int @id\n}\n',
    }))
    expect(facts.databases.map((d) => [d.engine, d.name, d.evidence.file, d.evidence.line])).toEqual([['PostgreSQL', undefined, 'prisma/schema.prisma', 1]])
    expect(linkRepositories([facts]).map((l) => [l.kind, l.to])).toEqual([['data', 'api:db:.:PostgreSQL/']])
  })

  it('reads migrations in their order: a table a later one drops is gone, one it renames has its new name', () => {
    const migration = (body: string, down = "Schema::dropIfExists('books');") => `<?php\nreturn new class extends Migration {\n    public function up(): void\n    {\n${body}\n    }\n    public function down(): void\n    {\n        ${down}\n    }\n};\n`
    const facts = extractRepository(repo('wiki', {
      'composer.json': JSON.stringify({ name: 'acme/wiki' }),
      'database/migrations/2015_01_01_000000_create_books.php': migration([
        "        Schema::create('books', function (Blueprint $table) {",
        '            $table->id();',
        "            $table->string('name');",
        "            $table->foreignId('owner_id')->constrained('users');",
        '            $table->timestamps();',
        '        });',
        "        Schema::create('pages', function (Blueprint $table) {",
        '            $table->increments(\'id\');',
        '        });',
        "        Schema::create('permissions', fn (Blueprint $table) => $table->string('name'));",
      ].join('\n')),
      'database/migrations/2016_01_01_000000_flatten.php': migration("        Schema::rename('permissions', 'role_permissions');\n        Schema::drop('pages');", "Schema::create('pages', function ($table) { $table->id(); });"),
      'prisma/migrations/1_init/migration.sql': 'CREATE TABLE "ArticleTags" ("id" SERIAL PRIMARY KEY);\nCREATE TABLE "Tag" ("id" SERIAL PRIMARY KEY);\n',
      'prisma/migrations/2_tags/migration.sql': 'DROP TABLE "ArticleTags";\n',
    }))
    expect(facts.tables.map((t) => t.table).sort()).toEqual(['Tag', 'books', 'role_permissions'])
    const books = facts.tables.find((t) => t.table === 'books')!
    expect(books.declared).toBe('Laravel')
    expect(books.columns?.map((c) => c.name)).toEqual(['id', 'name', 'owner_id', 'created_at', 'updated_at'])
    expect(books.references).toEqual([{ column: 'owner_id', table: 'users', line: 8 }])
  })

  it('names a table by its schema only where two schemas hold its name, and reads no schema or JPQL entity as a table', () => {
    const facts = extractRepository(repo('meetings', {
      'Meetings.csproj': EMPTY,
      'Structure.sql': [
        'CREATE TABLE [payments].[Payers] ([Id] UNIQUEIDENTIFIER NOT NULL)',
        'GO',
        'CREATE TABLE [payments].InboxMessages ([Id] UNIQUEIDENTIFIER NOT NULL)',
        'GO',
        'CREATE TABLE [meetings].[InboxMessages] ([Id] UNIQUEIDENTIFIER NOT NULL)',
        'GO',
        'CREATE TABLE [app].[Emails] ([Id] UNIQUEIDENTIFIER NOT NULL)',
        'GO',
      ].join('\n'),
      'Emails.cs': 'class EmailSender {\n  const string Sql = "INSERT INTO [app].[Emails] ([Id]) VALUES (@Id)";\n}\n',
      'pom.xml': '<project><artifactId>clinic</artifactId></project>',
      'src/main/java/PetTypeRepository.java': 'interface PetTypeRepository {\n  @Query("SELECT ptype FROM PetType ptype ORDER BY ptype.name")\n  List<PetType> findPetTypes();\n}\n',
    }))
    expect(facts.tables.map((t) => t.table).sort()).toEqual(['Emails', 'Payers', 'meetings.InboxMessages', 'payments.InboxMessages'])
  })
})
