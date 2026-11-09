import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRepository } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-syntax-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const routes = (facts: ReturnType<typeof extractRepository>) => facts.entries.filter((e) => e.kind === 'route').map((e) => [e.name, `${e.evidence.file}:${e.evidence.line}`])

describe('radical assay: code read through syntax trees', () => {
  it("reads a Spring controller's routes under its class and context path, and none of a Feign client or a comment", () => {
    const facts = extractRepository(repo('piggy', {
      'account-service/pom.xml': '<project><artifactId>account-service</artifactId><dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>',
      'account-service/src/main/resources/application.yml': 'server:\n  servlet:\n    context-path: /accounts\n  port: 6000\n',
      'account-service/src/main/java/acc/AccountController.java': [
        'package acc;',
        '',
        '@RestController',
        '@RequestMapping("/api")',
        'public class AccountController {',
        '  // @GetMapping("/old")',
        '  @GetMapping(path = "/{name}", produces = "application/json")',
        '  public Account get(@PathVariable String name) { return null; }',
        '',
        '  @RequestMapping(value = { "/current", "/me" }, method = RequestMethod.PUT)',
        '  public void save(@RequestBody Account a) { }',
        '}',
        '',
      ].join('\n'),
      'account-service/src/main/java/acc/AuthServiceClient.java': [
        'package acc;',
        '',
        '@FeignClient(name = "auth-service")',
        'public interface AuthServiceClient {',
        '  @RequestMapping(method = RequestMethod.POST, value = "/uaa/users")',
        '  void createUser(User user);',
        '}',
        '',
      ].join('\n'),
    }))
    expect(routes(facts)).toEqual([
      ['GET /accounts/api/{name}', 'account-service/src/main/java/acc/AccountController.java:7'],
      ['PUT /accounts/api/current', 'account-service/src/main/java/acc/AccountController.java:10'],
      ['PUT /accounts/api/me', 'account-service/src/main/java/acc/AccountController.java:10'],
    ])
  })

  it("reads an ASP.NET Core controller's routes from its class and action templates", () => {
    const facts = extractRepository(repo('pitstop', {
      'src/Workshop/Workshop.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>',
      'src/Workshop/Controllers/WorkshopPlanningController.cs': [
        'namespace Pitstop.Workshop;',
        '',
        '[Route("/api/[controller]")]',
        '[ApiController]',
        'public class WorkshopPlanningController : Controller',
        '{',
        '    [HttpPost]',
        '    [Route("{planningDate}/jobs")]',
        '    public async Task<IActionResult> PlanMaintenanceJobAsync(DateTime planningDate) { return Ok(); }',
        '',
        '    [HttpGet("{id}")]',
        '    public IActionResult Get(string id) => Ok();',
        '',
        '    // [HttpDelete("{id}")]',
        '    [HttpGet("/health")]',
        '    public IActionResult Health() => Ok();',
        '',
        '    [Route("[action]")]',
        '    [HttpGet]',
        '    public async Task<IActionResult> RefreshAsync() => Ok();',
        '}',
        '',
      ].join('\n'),
    }))
    expect(routes(facts)).toEqual([
      ['POST /api/workshopplanning/{planningDate}/jobs', 'src/Workshop/Controllers/WorkshopPlanningController.cs:7'],
      ['GET /api/workshopplanning/{id}', 'src/Workshop/Controllers/WorkshopPlanningController.cs:11'],
      ['GET /health', 'src/Workshop/Controllers/WorkshopPlanningController.cs:15'],
      ['GET /api/workshopplanning/refresh', 'src/Workshop/Controllers/WorkshopPlanningController.cs:19'],
    ])
  })
})
