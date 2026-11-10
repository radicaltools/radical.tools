import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkPlan, extractRepository, factIndex, linkRepositories, parsePlan } from '../src/index'
import { pgtapTests } from '../src/dbtests'
import { databaseTestPlace, testSkeleton } from '../src/skeleton'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-dbtests-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const tests = (facts: ReturnType<typeof extractRepository>) => facts.tests.map((t) => [t.test, t.status, t.unit?.split(':unit:')[1], t.evidence.line])

describe('radical assay: the tests a database declares', () => {
  it("reads a utPLSQL suite's tests by their suite, contexts and descriptions, not run, a disabled one skipped, and keeps its packages out of the routines", () => {
    const facts = extractRepository(repo('hr', {
      'db/hr_api.pks': 'CREATE OR REPLACE PACKAGE hr_api AS\n  PROCEDURE raise_salary(p_id NUMBER);\nEND hr_api;\n/\n',
      'db/hr_api.pkb': 'CREATE OR REPLACE PACKAGE BODY hr_api AS\n  PROCEDURE raise_salary(p_id NUMBER) IS\n  BEGIN\n    UPDATE employees SET salary = salary * 1.1 WHERE id = p_id;\n  END raise_salary;\nEND hr_api;\n/\n',
      'db/tables.sql': 'CREATE TABLE employees (id NUMBER(6) PRIMARY KEY, salary NUMBER(8,2));\n',
      'db/test/test_hr_api.pks': [
        'create or replace package test_hr_api as',
        '  --%suite(Raising salaries)',
        '  --%suitepath(hr)',
        '',
        '  --%beforeall',
        '  procedure setup;',
        '',
        '  --%test(Raises by ten percent)',
        '  procedure raises_by_ten;',
        '',
        '  --%context(An unknown employee)',
        '',
        '    --%test',
        '    --%throws(-20001)',
        '    procedure fails_for_unknown;',
        '',
        '    --%test(Changes nothing)',
        '    --%disabled(waiting for the audit table)',
        '    procedure changes_nothing;',
        '',
        '  --%endcontext',
        'end;',
        '/',
        '',
      ].join('\n'),
      'db/test/test_hr_api.pkb': [
        'create or replace package body test_hr_api as',
        '  procedure setup is begin null; end;',
        '  procedure raises_by_ten is begin hr_api.raise_salary(1); end;',
        '  procedure fails_for_unknown is begin hr_api.raise_salary(-1); end;',
        '  procedure changes_nothing is',
        '  begin',
        "    execute immediate q'[create or replace package tmp_suite as",
        '      --%suite(Built in a string)',
        '      --%test(Not a test of the file)',
        '      procedure no_test;',
        "    end;]';",
        '  end;',
        'end;',
        '/',
        '',
      ].join('\n'),
      'db/old_style.pks': 'create or replace package demo as\n  -- %suite\n  -- %displayname(Demo of old annotations)\n\n  -- %test\n  -- %displayname(A passing test)\n  procedure passes;\nend;\n/\n',
    }))
    expect(tests(facts)).toEqual([
      ['db/old_style.pks › Demo of old annotations › A passing test', 'not run', 'db', 5],
      ['db/test/test_hr_api.pks › Raising salaries › Raises by ten percent', 'not run', 'db', 8],
      ['db/test/test_hr_api.pks › Raising salaries › An unknown employee › fails_for_unknown', 'not run', 'db', 13],
      ['db/test/test_hr_api.pks › Raising salaries › An unknown employee › Changes nothing', 'skipped', 'db', 17],
    ])
    expect(facts.units.map((u) => [u.path, u.testFramework])).toEqual([['db', 'utplsql']])
    expect(facts.routines.map((r) => r.name).sort()).toEqual(['hr_api', 'hr_api.raise_salary'])
  })

  it("reads a pgTAP script's assertions by their descriptions, else their numbers, and its test functions by name, in the unit whose routines they test", () => {
    const facts = extractRepository(repo('game', {
      'schema/sqitch.plan': '%project=game\n\nfunction-register 2026-01-01T00:00:00Z dev <d@x> # players\n',
      'schema/deploy/function-register.sql': "CREATE TABLE player (id SERIAL PRIMARY KEY, username text);\nCREATE OR REPLACE FUNCTION register_player(name text) RETURNS integer AS $$ BEGIN INSERT INTO player (username) VALUES (name); RETURN 1; END $$ LANGUAGE plpgsql;\n",
      'tests/010_registration.sql': [
        "\\i tests/_prelude.sql",
        'SELECT plan(5);',
        "SELECT lives_ok($$SELECT register_player('t_alice')$$, 'register_player creates a player');",
        "SELECT throws_like($$SELECT register_player('Robert''; DROP TABLE player;--')$$, '%username must be%', 'username with SQL in it rejected');",
        'SELECT has_table(\'player\');',
        "SELECT is((SELECT count(*)::int FROM player), 1);",
        '-- SELECT ok(false, \'commented out\');',
        "SELECT throws_ok('SELECT register_player(NULL)', '23502');",
        'SELECT * FROM finish();',
        'ROLLBACK;',
        '',
      ].join('\n'),
      'tests/020_functions.sql': [
        'CREATE OR REPLACE FUNCTION test_register_twice() RETURNS SETOF TEXT AS $$',
        "BEGIN RETURN NEXT is(register_player('a'), 1, 'first'); END $$ LANGUAGE plpgsql;",
        'SELECT * FROM runtests();',
        '',
      ].join('\n'),
    }))
    expect(tests(facts)).toEqual([
      ['tests/010_registration.sql › register_player creates a player', 'not run', 'schema', 3],
      ['tests/010_registration.sql › username with SQL in it rejected', 'not run', 'schema', 4],
      ['tests/010_registration.sql › #3', 'not run', 'schema', 5],
      ['tests/010_registration.sql › #4', 'not run', 'schema', 6],
      ['tests/010_registration.sql › #5', 'not run', 'schema', 8],
      ['tests/020_functions.sql › test_register_twice', 'not run', 'schema', 1],
    ])
    expect(facts.units.find((u) => u.path === 'schema')?.testFramework).toBe('pgtap')
    expect(facts.routines.map((r) => r.name)).toEqual(['register_player'])
  })

  it('takes a not-run database test for a scenario, and writes a pending test of a scenario drawn from the code for utPLSQL and pgTAP', () => {
    const dir = repo('game', {
      'schema/sqitch.plan': '%project=game\n\nfunction-register 2026-01-01T00:00:00Z dev <d@x> # players\n',
      'schema/deploy/function-register.sql': "CREATE OR REPLACE FUNCTION register_player(name text) RETURNS integer AS $$ BEGIN RETURN 1; END $$ LANGUAGE plpgsql;\n",
      'tests/_prelude.sql': "SET search_path = public;\n",
      'tests/010_registration.sql': "\\i tests/_prelude.sql\nSELECT plan(1);\nSELECT lives_ok($$SELECT register_player('a')$$, 'register_player creates a player');\nSELECT * FROM finish();\n",
      'tests/020_ships.sql': "\\i tests/_prelude.sql\nBEGIN;\nSELECT plan(1);\nSELECT pass('ships');\nSELECT * FROM finish();\n",
    })
    const facts = extractRepository(dir)
    const { plan } = parsePlan({
      elements: [{ key: 'db', type: 'database', label: 'Game', units: ['game:unit:schema'], facts: ['game:unit:schema'], confidence: 'observed' }],
      requirements: [{ key: 'r', label: 'Register players', satisfiedBy: 'db', properties: { ears_type: 'ubiquitous', action: 'the game shall register players' },
        scenarios: [{ key: 's', label: 'Registered', given: 'a name', when: 'it registers', then: 'a player exists', tests: ['game:test:tests/010_registration.sql › register_player creates a player'] }] }],
    })
    expect(checkPlan(plan, factIndex([facts], linkRepositories([facts])), () => false)).toEqual([])

    const unit = facts.units.find((u) => u.path === 'schema')!
    const scenarios = [{ label: "A name with SQL in it is refused", given: 'a name holding a quote', when: 'it registers', then: 'it is refused', from: 'schema/deploy/function-register.sql:1' }]
    // Beside the unit's tests, named and headed as they are, each scenario a test skipped, which every runner passes.
    const place = databaseTestPlace(unit, facts, (f) => readFileSync(join(dir, f), 'utf8'))
    expect(place).toEqual({ folder: 'tests', header: ['\\i tests/_prelude.sql'], numbered: true, ext: '.sql' })
    const pg = testSkeleton(unit, 'pgtap', 'Register players', scenarios, '2026-11-10', place)
    expect(pg.file).toBe('tests/990_assay_register_players.sql')
    expect(pgtapTests(pg.content, pg.file).map((t) => [`${t.file} › ${t.titles.join(' › ')}`, t.skipped])).toEqual(pg.tests.map((t) => [t, true]))
    expect(pg.content).toContain("\\i tests/_prelude.sql\nSELECT plan(1);")
    expect(pg.content).toContain("SELECT skip('A name with SQL in it is refused');")
    expect(testSkeleton(unit, 'pgtap', 'Register players', scenarios, '2026-11-10').file).toBe('schema/tests/assay/register-players.sql')
    const ut = testSkeleton(unit, 'utplsql', 'Register players', scenarios, '2026-11-10')
    expect(ut.file).toBe('schema/tests/assay/test_register_players.sql')
    expect(ut.tests).toEqual(['schema/tests/assay/test_register_players.sql › Register players › A name with SQL in it is refused'])
    expect(ut.content).toContain('  --%test(A name with SQL in it is refused)\n  --%disabled(Written by Radical Assay from the code: write the test)\n  procedure a_name_with_sql_in_it_is_refus;')
  })
  it('reads a Perl distribution on PostgreSQL, a Supabase project, a framework a repository ships, and a schema its installer resets first', () => {
    const perl = extractRepository(repo('manager', {
      'Build.PL': "my $build = Module::Build::DB->new(\n  module_name => 'PGXN::Manager',\n  requires => { 'DBI' => '1.6', 'Plack' => '0.99' },\n);\n",
      'bin/pgxn_manager': '#!/usr/bin/perl\n',
      'conf/local.json': '{ "dbi": { "dsn": "dbi:Pg:dbname=pgxn_manager" } }\n',
      'sql/01-users.sql': "CREATE TABLE users (nickname text PRIMARY KEY);\nCREATE FUNCTION update_user(nick text) RETURNS boolean AS $$ BEGIN RETURN true; END $$ LANGUAGE plpgsql;\nCREATE FUNCTION _test_set_admin(nick text) RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;\n",
      'lib/PGXN/Manager/Controller.pm': "package PGXN::Manager::Controller;\nsub update {\n  $dbh->selectcol_arrayref(\n    q{SELECT update_user(\n      nick := ?\n    )}, undef, $nick);\n}\n1;\n",
      't/lib/TxnTest.pm': "package TxnTest;\nsub admin { $dbh->do('SELECT _test_set_admin(?)', undef, 'admin') }\n1;\n",
    }))
    expect(perl.units.map((u) => [u.path, u.stack, u.name, u.kind])).toEqual([['.', 'perl', 'PGXN::Manager', 'app']])
    expect(perl.databases.map((d) => [d.engine, d.name])).toEqual([['PostgreSQL', 'pgxn_manager']])
    expect(perl.routineCalls.map((c) => [c.routine, c.evidence.file, c.evidence.line])).toEqual([['update_user', 'lib/PGXN/Manager/Controller.pm', 4]])

    const supabase = extractRepository(repo('starter', {
      'supabase/config.toml': 'project_id = "basejump"\n[api]\nport = 54321\n',
      'supabase/migrations/20240101_accounts.sql': 'CREATE TABLE basejump.accounts (id uuid PRIMARY KEY);\nCREATE FUNCTION basejump.current_user_account_role() RETURNS text AS $$ SELECT 1 $$ LANGUAGE sql;\n',
      'supabase/tests/database/01-accounts.sql': "BEGIN;\nSELECT plan(1);\nSELECT has_table('basejump', 'accounts', 'accounts table exists');\nSELECT * FROM finish();\nROLLBACK;\n",
    }))
    expect(supabase.units.map((u) => [u.path, u.stack, u.name, u.testFramework])).toEqual([['supabase', 'sql', 'basejump', 'pgtap']])
    expect(supabase.tables.map((t) => t.table)).toEqual(['accounts'])
    expect(supabase.tests.map((t) => t.test)).toEqual(['supabase/tests/database/01-accounts.sql › accounts table exists'])

    const shipped = extractRepository(repo('billing', {
      'db/src/pkg_bill.pks': 'CREATE OR REPLACE PACKAGE pkg_bill AS\n  PROCEDURE run;\nEND pkg_bill;\n/\n',
      'db/test/utPLSQL-3.1.7/source/core/ut_utils.pks': 'create or replace package ut_utils as\n  procedure debug;\nend;\n/\n',
      'db/test/utPLSQL-3.1.7/test/test_ut_utils.pks': 'create or replace package test_ut_utils as\n  --%suite\n  --%test\n  procedure works;\nend;\n/\n',
      'db/test/test_pkg_bill.pks': 'create or replace package test_pkg_bill as\n  --%suite\n\n  --%test\n  procedure runs;\nend;\n/\n',
      'db/install/cleanup.sql': 'drop package pkg_bill;\ndrop table bills;\n',
      'db/install/install.sql': '@cleanup.sql\n@../src/pkg_bill.pks\n@bills.sql\ngrant create session, create trigger to &app_user;\n',
      'db/install/bills.sql': 'CREATE TABLE bills (id NUMBER(9));\n',
    }))
    expect(shipped.tests.map((t) => t.test)).toEqual(['db/test/test_pkg_bill.pks › test_pkg_bill › runs'])
    expect(shipped.routines.map((r) => r.name).sort()).toEqual(['pkg_bill', 'pkg_bill.run'])
    expect(shipped.tables.map((t) => t.table)).toEqual(['bills'])
  })
})
