import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRepository, linkRepositories } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-large-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const routes = (facts: ReturnType<typeof extractRepository>) => facts.entries.filter((e) => e.kind === 'route').map((e) => [e.unit.split(':unit:')[1], e.name])

describe('radical assay: what large repositories hold', () => {
  it("reads a Go module's shared packages as its main app's, its gorilla/mux routes under their subrouters, no down migration", () => {
    const facts = extractRepository(repo('chat', {
      'server/go.mod': 'module example.com/chat/server\n\ngo 1.22\n',
      'server/cmd/chat/main.go': 'package main\n\nimport "example.com/chat/server/api"\n\nfunc main() { api.Init() }\n',
      'server/cmd/chatctl/main.go': 'package main\n\nfunc main() {}\n',
      'server/api/api.go': 'package api\n\nimport "example.com/chat/server/store"\n\nfunc (a *API) Init(r *mux.Router) {\n\ta.Routes.Root = r.PathPrefix("/api/v1").Subrouter()\n\ta.Routes.Users = a.Routes.Root.PathPrefix("/users").Subrouter()\n\tstore.Open()\n}\n',
      'server/api/user.go': 'package api\n\nfunc (a *API) InitUser() {\n\ta.Routes.Users.Handle("", a.Handler(createUser)).Methods(http.MethodPost)\n\ta.Routes.Users.Handle("/{id}", a.Handler(getUser)).Methods("GET")\n\t// a.Routes.Users.Handle("/old", a.Handler(old))\n}\n',
      'server/store/store.go': 'package store\n\nfunc Open() {}\n',
      'server/db/migrations/000001_create_users.up.sql': 'CREATE TABLE users (id varchar(26) PRIMARY KEY);\n',
      'server/db/migrations/000001_create_users.down.sql': 'DROP TABLE users;\n',
      'server/db/migrations/000002_create_posts.up.sql': 'CREATE TABLE posts (id varchar(26) PRIMARY KEY);\n',
      'server/db/migrations/000003_drop_posts.down.sql': 'DROP TABLE posts;\n',
    }))
    expect(facts.units.map((u) => [u.path, u.shares])).toEqual([['server/cmd/chat', ['server']], ['server/cmd/chatctl', undefined]])
    expect(routes(facts)).toEqual([['server/cmd/chat', 'POST /api/v1/users'], ['server/cmd/chat', 'GET /api/v1/users/{id}']])
    expect(facts.tables.map((t) => [t.unit.split(':unit:')[1], t.table])).toEqual([['server/cmd/chat', 'users'], ['server/cmd/chat', 'posts']])
  })

  it("leaves tooling's folders out, builds a folder of tests for tests, and reads $(SolutionDir) and Django's urls.py", () => {
    const facts = extractRepository(repo('shop', {
      '.github/actions/report/package.json': '{ "name": "report", "scripts": { "start": "node index.js" } }',
      '.cursor/package.json': '{ "name": "cursor-rules", "scripts": { "start": "node x.js" } }',
      'plugin_api_tests/test_kv_plugin/go.mod': 'module example.com/kv\n\ngo 1.22\n',
      'plugin_api_tests/test_kv_plugin/main.go': 'package main\n\nfunc main() {}\n',
      'src/Shop.sln': 'Project("{FAE04EC0}") = "Shop.Web", "Presentation\\Shop.Web\\Shop.Web.csproj", "{1}"\nProject("{FAE04EC0}") = "Shop.Plugin.Tax", "Plugins\\Shop.Plugin.Tax\\Shop.Plugin.Tax.csproj", "{2}"\n',
      'src/Presentation/Shop.Web/Shop.Web.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>',
      'src/Plugins/Shop.Plugin.Tax/Shop.Plugin.Tax.csproj': '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><ProjectReference Include="$(SolutionDir)\\Presentation\\Shop.Web\\Shop.Web.csproj" /></ItemGroup></Project>',
      'src/Plugins/Shop.Plugin.Tax/TaxConsumer.cs': 'using Shop.Services.Events;\npublic class TaxConsumer : IConsumer<OrderPlacedEvent>\n{\n}\n',
      'src/Presentation/Shop.Web/OrderService.cs': 'public class OrderService\n{\n    public void Place() { events.Publish(new OrderPlacedEvent()); }\n}\n',
      'store/manage.py': 'import django\n',
      'store/requirements.txt': 'django\n',
      'store/store/urls.py': 'urlpatterns = [\n    path("graphql/", GraphQLView.as_view()),\n    re_path(\n        r"^orders/(?P<pk>\\d+)/$", order,\n    ),\n    path("admin/", include("admin.urls")),\n]\n',
    }))
    expect(facts.units.map((u) => [u.path, u.kind])).toEqual([
      ['plugin_api_tests/test_kv_plugin', 'tests'], ['src/Plugins/Shop.Plugin.Tax', 'library'], ['src/Presentation/Shop.Web', 'app'], ['store', 'app'],
    ])
    expect(facts.dependencies.filter((d) => d.target).map((d) => [d.unit.split(':unit:')[1], d.target!.split(':unit:')[1]])).toEqual([['src/Plugins/Shop.Plugin.Tax', 'src/Presentation/Shop.Web']])
    expect(facts.notes).toEqual([])
    expect(linkRepositories([facts]).filter((l) => l.kind === 'message')).toEqual([])
    expect(routes(facts)).toEqual([['store', 'ALL /graphql'], ['store', 'ALL /orders/{pk}']])
  })
})
