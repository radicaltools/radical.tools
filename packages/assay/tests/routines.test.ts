import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkPlan, extractRepository, factIndex, linkRepositories, parsePlan } from '../src/index'
import { describeFacts } from '../src/describe'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-routines-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const routines = (facts: ReturnType<typeof extractRepository>) => facts.routines.filter((r) => !r.called).map((r) => [r.unit?.split(':unit:')[1], r.name, r.kind, r.evidence.line])

describe('radical assay: stored routines and the code calling them', () => {
  it("reads a repository of an Oracle schema alone: its tables and its PL/SQL, a package's members, a procedure, a trigger, and what each touches", () => {
    const facts = extractRepository(repo('hr', {
      'db/hr_tables.sql': [
        'CREATE TABLE departments (',
        '  department_id NUMBER(4) PRIMARY KEY,',
        '  department_name VARCHAR2(30) NOT NULL',
        ');',
        'CREATE TABLE employees (',
        '  employee_id NUMBER(6) PRIMARY KEY,',
        '  department_id NUMBER(4)',
        ');',
        'ALTER TABLE employees ADD ( CONSTRAINT emp_dept_fk FOREIGN KEY (department_id) REFERENCES departments );',
        'CREATE GLOBAL TEMPORARY TABLE emp_staging ( employee_id NUMBER(6) ) ON COMMIT DELETE ROWS;',
        'CREATE TABLE job_history ( employee_id NUMBER(6), start_date DATE );',
        '',
      ].join('\n'),
      'db/emp_pkg.pks': 'CREATE OR REPLACE PACKAGE emp_pkg AS\n  PROCEDURE hire(p_id NUMBER, p_dept NUMBER);\n  FUNCTION headcount(p_dept NUMBER) RETURN NUMBER;\nEND emp_pkg;\n/\n',
      'db/emp_pkg.pkb': [
        'CREATE OR REPLACE PACKAGE BODY emp_pkg AS',
        '  PROCEDURE hire(p_id NUMBER, p_dept NUMBER) IS',
        '  BEGIN',
        "    INSERT INTO employees (employee_id, department_id) VALUES (p_id, p_dept); -- not FROM jobs",
        '  END hire;',
        '  FUNCTION headcount(p_dept NUMBER) RETURN NUMBER IS',
        '    n NUMBER;',
        '  BEGIN',
        '    SELECT COUNT(*) INTO n FROM employees WHERE department_id = p_dept;',
        '    RETURN n;',
        '  END headcount;',
        'END emp_pkg;',
        '/',
        'CREATE OR REPLACE PROCEDURE transfer(p_id NUMBER, p_dept NUMBER) AS',
        'BEGIN',
        "  UPDATE employees SET department_id = p_dept WHERE employee_id = p_id;",
        '  emp_pkg.hire(p_id, p_dept);',
        'END;',
        '/',
        'CREATE OR REPLACE TRIGGER update_job_history',
        '  AFTER UPDATE OF department_id ON employees FOR EACH ROW',
        'BEGIN',
        '  INSERT INTO job_history (employee_id, start_date) VALUES (:old.employee_id, SYSDATE);',
        'END;',
        '/',
        '',
      ].join('\n'),
    }))
    expect(facts.units.map((u) => [u.path, u.stack])).toEqual([['db', 'sql']])
    expect(facts.tables.map((t) => t.table).sort()).toEqual(['departments', 'emp_staging', 'employees', 'job_history'])
    expect(facts.tables.find((t) => t.table === 'employees')?.references?.map((r) => [r.column, r.table])).toEqual([['department_id', 'departments']])
    expect(routines(facts)).toEqual([
      ['db', 'emp_pkg', 'package', 1], ['db', 'emp_pkg.hire', 'procedure', 2], ['db', 'emp_pkg.headcount', 'function', 6],
      ['db', 'transfer', 'procedure', 14], ['db', 'update_job_history', 'trigger', 20],
    ])
    const of = (name: string) => facts.routines.find((r) => r.name === name)!
    expect([of('emp_pkg.hire').writes, of('emp_pkg.headcount').reads, of('transfer').writes, of('transfer').calls, of('update_job_history').table, of('update_job_history').writes, of('emp_pkg').dialect])
      .toEqual([['employees'], ['employees'], ['employees'], ['emp_pkg.hire'], 'employees', ['job_history'], 'Oracle'])
  })

  it("reads SQL Server's procedures, PostgreSQL's functions and triggers, and MySQL's procedures", () => {
    const facts = extractRepository(repo('shops', {
      'mssql/orders.sql': 'CREATE TABLE dbo.orders (id INT IDENTITY(1,1) PRIMARY KEY, status NVARCHAR(20));\nGO\nCREATE OR ALTER PROCEDURE dbo.usp_close_order @id INT AS\nBEGIN\n  UPDATE dbo.orders SET status = N\'closed\' WHERE id = @id;\nEND\nGO\n',
      'pg/schema.sql': 'CREATE TABLE film (film_id SERIAL PRIMARY KEY, last_update TIMESTAMP);\nCREATE OR REPLACE FUNCTION last_updated() RETURNS trigger AS $$\nBEGIN\n  NEW.last_update = now();\n  RETURN NEW;\nEND $$ LANGUAGE plpgsql;\nCREATE TRIGGER last_updated BEFORE UPDATE ON film FOR EACH ROW EXECUTE FUNCTION last_updated();\n',
      'mysql/rewards.sql': 'CREATE TABLE payment (payment_id INT AUTO_INCREMENT PRIMARY KEY, amount DECIMAL(5,2));\nDELIMITER //\nCREATE PROCEDURE rewards_report(IN min_amount DECIMAL(5,2))\nBEGIN\n  SELECT * FROM payment WHERE amount > min_amount;\nEND //\nDELIMITER ;\n',
    }))
    expect(routines(facts)).toEqual([
      ['mssql', 'usp_close_order', 'procedure', 3],
      ['mysql', 'rewards_report', 'procedure', 3],
      ['pg', 'last_updated', 'function', 2], ['pg', 'last_updated', 'trigger', 7],
    ])
    expect(facts.routines.find((r) => r.name === 'usp_close_order')?.writes).toEqual(['orders'])
    expect(facts.routines.find((r) => r.kind === 'trigger')).toMatchObject({ table: 'film', calls: ['last_updated'], dialect: 'PostgreSQL' })
  })

  it("links the code calling a routine to it: JDBC, Spring's SimpleJdbcCall, JPA, ADO.NET, Dapper, VB6, Python, and one the database holds", () => {
    const facts = extractRepository(repo('calls', {
      'db/pkg.pks': 'CREATE OR REPLACE PACKAGE hr_api AS\n  PROCEDURE raise_salary(p_id NUMBER);\nEND hr_api;\n/\n',
      'java/pom.xml': '<project><artifactId>java</artifactId></project>',
      'java/src/main/java/a/Hr.java': [
        'package a;',
        'class Hr {',
        '  void raise() { conn.prepareCall("{call hr_api.raise_salary(?)}"); }',
        '  void report() { new SimpleJdbcCall(dataSource).withCatalogName("REPORTS").withProcedureName("MONTHLY_TOTALS").execute(params); }',
        '  @Procedure(procedureName = "audit_login") void audit(String user);',
        '  void plsql() { conn.prepareCall("BEGIN :r := hr_api.raise_salary(:id); END;"); }',
        '}',
        '',
      ].join('\n'),
      'net/Shop.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
      'net/Orders.cs': 'class Orders {\n  void Close() {\n    var cmd = new SqlCommand("dbo.usp_close_order", conn);\n    cmd.CommandType = CommandType.StoredProcedure;\n  }\n  void List() => conn.Query<Order>("usp_list_orders", new { id }, commandType: CommandType.StoredProcedure);\n}\n',
      'vb/Shop.vbp': 'Type=Exe\r\nModule=modDb; modDb.bas\r\nName="Shop"\r\n',
      'vb/modDb.bas': 'Attribute VB_Name = "modDb"\r\nSub Post()\r\n  cmd.CommandText = "sp_post_invoice"\r\n  cmd.CommandType = adCmdStoredProc\r\nEnd Sub\r\n',
      'py/requirements.txt': 'oracledb\n',
      'py/main.py': 'cursor.callproc("billing.close_month", [2026, 11])\nlabel = "Call us"\n',
      'java/src/main/resources/mappers/HrMapper.xml': '<mapper namespace="a.HrMapper">\n  <update id="close" statementType="CALLABLE">{call hr_api.close_month(#{id})}</update>\n</mapper>\n',
    }))
    expect(facts.routineCalls.map((c) => [c.unit.split(':unit:')[1], c.routine, c.via])).toEqual([
      ['java', 'hr_api.raise_salary', 'JDBC'], ['java', 'reports.monthly_totals', 'Spring SimpleJdbcCall'], ['java', 'audit_login', 'JPA'],
      ['java', 'hr_api.close_month', 'JDBC'],
      ['net', 'dbo.usp_close_order', 'ADO.NET'], ['net', 'usp_list_orders', 'ADO.NET'],
      ['py', 'billing.close_month', 'DB-API'],
      ['vb', 'sp_post_invoice', 'ADO'],
    ])
    const links = linkRepositories([facts]).filter((l) => l.kind === 'routine').map((l) => [l.from.split(':unit:')[1], l.to.split(':routine:').pop()])
    expect(links).toContainEqual(['java', 'db:hr_api.raise_salary'])
    // Beside the units' code, the package is the database's: no unit's.
    expect(facts.routines.find((r) => r.name === 'hr_api.raise_salary')).toMatchObject({ kind: 'procedure' })
    expect(facts.routines.find((r) => r.name === 'hr_api.raise_salary')?.unit).toBeUndefined()
    expect(facts.routines.filter((r) => r.called).map((r) => r.name).sort()).toEqual(['audit_login', 'billing.close_month', 'dbo.usp_close_order', 'hr_api.close_month', 'reports.monthly_totals', 'sp_post_invoice', 'usp_list_orders'])
    // A plan relates the caller to the database holding the routine, on the routine link.
    const all = linkRepositories([facts])
    const link = all.find((l) => l.kind === 'routine' && l.to.endsWith(':hr_api.raise_salary'))!
    const { plan } = parsePlan({
      elements: [
        { key: 'java', type: 'container', label: 'Java app', units: ['calls:unit:java'], facts: ['calls:unit:java'], confidence: 'observed' },
        { key: 'hr', type: 'database', label: 'HR database', facts: [link.to], confidence: 'inferred' },
      ],
      relations: [
        { from: 'java', to: 'hr', relationType: 'interacts', label: 'calls hr_api.raise_salary', facts: [link.id], confidence: 'observed' },
        // The call of another routine, which the HR database does not hold, backs no relation to it.
        { from: 'java', to: 'hr', relationType: 'interacts', label: 'calls audit_login', facts: [all.find((l) => l.to.endsWith(':audit_login'))!.id], confidence: 'observed' },
      ],
    })
    expect(checkPlan(plan, factIndex([facts], all), () => false)).toEqual([
      'relations[1] (java → hr): the links and dependencies it cites join neither of its ends to the other',
      'relations[1] (java → hr): observed, but cites no dependency or observed link that states it',
    ])
  })

  it("reads a package's members only, not their local subprograms, past strings holding -- and q'[…]', and a database's final state", () => {
    const facts = extractRepository(repo('lib', {
      'ora/pdf.pkb': [
        'CREATE OR REPLACE PACKAGE BODY pdf AS',
        '  FUNCTION header RETURN VARCHAR2 IS',
        "    l_xsl VARCHAR2(200) := '<xsl:stylesheet>",
        "      <!-- -- not a comment -->",
        "    </xsl:stylesheet>';",
        "    l_q VARCHAR2(20) := q'[it's]';",
        '    PROCEDURE show_line IS',
        '    BEGIN',
        "      l_q := CASE WHEN l_q IS NULL THEN 'a' ELSE CASE WHEN 1 = 1 THEN 'b' END END;",
        '    END show_line;',
        '  BEGIN',
        '    show_line;',
        '    RETURN l_xsl;',
        '  END header;',
        '  PROCEDURE add_page IS',
        '  BEGIN',
        '    NULL;',
        '  END add_page;',
        'END pdf;',
        '/',
        '',
      ].join('\n'),
      'ora/install.sql': '@helpers.sql\nCREATE TABLE pages (id NUMBER(6));\nDROP PACKAGE xdb.install_helper;\n',
      'ora/helpers.sql': 'CREATE OR REPLACE PACKAGE install_helper AS\n  PROCEDURE run;\nEND install_helper;\n/\n',
      'ora/zz_teardown.sql': 'DROP TABLE pages;\nDROP PACKAGE pdf;\n',
      'demos/pdf_demo.sql': 'CREATE TABLE demo_log (id NUMBER(6));\nBEGIN\n  pdf.add_page;\n  INSERT INTO demo_log VALUES (1);\nEND;\n/\n',
    }))
    expect(routines(facts).map((r) => r[1])).toEqual(['pdf', 'pdf.header', 'pdf.add_page'])
    expect(facts.tables.map((t) => t.table)).toEqual(['demo_log', 'pages'])
    expect(facts.routineCalls.map((c) => [c.unit.split(':unit:')[1], c.routine])).toEqual([['demos', 'pdf.add_page']])
    expect(linkRepositories([facts]).filter((l) => l.to.endsWith(':unit:ora')).map((l) => [l.kind, l.from.split(':unit:')[1]])).toEqual([['routine', 'demos']])
  })

  it("reads Oracle's schemas referencing each other's tables, a Sqitch project beside the apps, PGDATABASE, and the functions a query selects", () => {
    const schemas = extractRepository(repo('schemas', {
      'hr/hr_cre.sql': 'CREATE TABLE employees (employee_id NUMBER(6) PRIMARY KEY);\n',
      'hr/hr_drop.sql': 'DROP TABLE employees;\n',
      'oe/oe_cre.sql': [
        'CREATE TABLE orders (order_id NUMBER(12), sales_rep_id NUMBER(6));',
        'CREATE TABLE categories_tab OF category_typ;',
        'ALTER TABLE orders ADD ( CONSTRAINT orders_pk PRIMARY KEY (order_id), CONSTRAINT orders_rep_fk FOREIGN KEY (sales_rep_id) REFERENCES hr.employees(employee_id) );',
        '',
      ].join('\n'),
      'oe/doe.sql': 'DROP TABLE orders;\nDROP TABLE categories_tab;\n',
    }))
    expect(schemas.tables.map((t) => [t.unit.split(':unit:')[1], t.table]).sort()).toEqual([['hr', 'employees'], ['oe', 'categories_tab'], ['oe', 'orders']])
    expect(linkRepositories([schemas]).map((l) => [l.kind, l.from.split(':unit:')[1], l.to.split(':unit:')[1]])).toEqual([['data', 'oe', 'hr']])

    const game = extractRepository(repo('game', {
      'schema/sqitch.plan': '%project=game\n\nplayers 2026-01-01T00:00:00Z dev <dev@example.com>\n',
      'schema/deploy/players.sql': [
        'CREATE TABLE player (id SERIAL PRIMARY KEY);',
        'CREATE TABLE event (id BIGINT) PARTITION BY RANGE (id);',
        'CREATE TABLE event_default PARTITION OF event DEFAULT;',
        'CREATE SEQUENCE tic_seq;',
        'CREATE FUNCTION register_player(name TEXT) RETURNS INTEGER AS $$ BEGIN INSERT INTO player DEFAULT VALUES; RETURN 1; END $$ LANGUAGE plpgsql;',
        '',
      ].join('\n'),
      'schema/revert/players.sql': 'DROP TABLE player;\nDROP FUNCTION register_player;\n',
      'tic/go.mod': 'module example.com/tic\n\ngo 1.22\n\nrequire github.com/jackc/pgx/v5 v5.6.0\n',
      'tic/main.go': 'package main\n\nfunc main() {\n\tconn.QueryRow(ctx, "SELECT last_value FROM tic_seq")\n\tconn.Exec(ctx, "SELECT register_player($1), count(*) FROM player", name)\n\tconn.QueryRow(ctx, "SELECT planet INTO target FROM player")\n}\n',
      'docker/compose.yml': 'services:\n  tic:\n    build:\n      context: ../tic\n    environment:\n      PGHOST: /var/run/postgresql\n      PGDATABASE: game\n',
      'web/package.json': '{ "name": "web", "scripts": { "start": "vite" } }',
      'web/src/seo.ts': "export const ld = { '@context': 'https://schema.org' }\n",
    }))
    expect(game.units.map((u) => [u.path, u.stack])).toEqual([['schema', 'sql'], ['tic', 'go'], ['web', 'npm']])
    // (The code naming a table holds it too: tic's player.)
    expect(game.tables.map((t) => [t.unit.split(':unit:')[1], t.table]).sort()).toEqual([['schema', 'event'], ['schema', 'event_default'], ['schema', 'player'], ['tic', 'player']])
    expect(game.databases.map((d) => [d.unit?.split(':unit:')[1], d.engine, d.name])).toEqual([['tic', 'PostgreSQL', 'game']])
    expect(game.routineCalls.map((c) => [c.unit.split(':unit:')[1], c.routine, c.via])).toEqual([['tic', 'register_player', 'SQL function']])
    expect(linkRepositories([game]).filter((l) => l.kind === 'address')).toEqual([])
  })

  it("reads an Ant project, the routine names a constant holds, and no SQL in a VB comment, an annotation or a caption", () => {
    const facts = extractRepository(repo('apps', {
      'ant/build.xml': '<?xml version="1.0"?>\n<project name="Payroll" default="default" basedir=".">\n  <import file="nbproject/build-impl.xml"/>\n</project>\n',
      'ant/nbproject/project.xml': '<project/>',
      'ant/nbproject/project.properties': 'file.reference.ojdbc6.jar=lib/ojdbc6.jar\nmain.class=pay.Main\n',
      'ant/src/pay/Dao.java': [
        'package pay;',
        'interface Names { String F_RAISE = "F_RAISE_SALARY"; }',
        'class Dao {',
        '  void raise() { new SimpleJdbcCall(ds).withFunctionName(Names.F_RAISE).execute(); }',
        '  @Tool(description = "List the owners") void owners() { }',
        '  static final String CAPTION = "Call failed (%1)";',
        '}',
        '',
      ].join('\n'),
      'ant/src/jdbc.properties': 'url=jdbc:oracle:thin:@localhost:1521:XE\n',
      'vb/App.vbp': 'Type=Exe\r\nModule=modMain; modMain.bas\r\nName="App"\r\n',
      'vb/modMain.bas': 'Attribute VB_Name = "modMain"\r\nSub Main()\r\n  \' Call OldRoutine(1)\r\n  Select Case cmd\r\n    Case "/PASSWORD"\r\n      Call frmPassword.Show(1)\r\n  End Select\r\nEnd Sub\r\n',
    }))
    expect(facts.units.map((u) => [u.path, u.stack, u.kind])).toEqual([['ant', 'ant', 'app'], ['vb', 'vb6', 'app']])
    expect(facts.routineCalls.map((c) => [c.unit.split(':unit:')[1], c.routine, c.via])).toEqual([['ant', 'f_raise_salary', 'Spring SimpleJdbcCall']])
    expect(facts.databases.map((d) => [d.engine, d.name])).toEqual([['Oracle', 'XE']])
  })

  it("resolves the names Spring code gives a routine: a variable, a package configured through a getter, a StoredProcedure subclass, a named query, and no call in a comment or a page's markup", () => {
    const facts = extractRepository(repo('hr', {
      'pom.xml': '<project><artifactId>hr</artifactId></project>',
      'src/main/resources/hr.pkg.properties': 'pkg.name=HR_UTILS\n',
      'src/main/java/hr/PkgConfig.java': 'class PkgConfig {\n  @Value("${pkg.name}")\n  private String pkgName;\n  public String getPkgName() { return pkgName; }\n}\n',
      'src/main/java/hr/Regions.java': [
        'class Regions {',
        '  List<Region> all() {',
        '    final String procedure_name = "GET_REGIONS";',
        '    return new SimpleJdbcCall(ds).withCatalogName(pkgCfg.getPkgName()).withProcedureName(procedure_name).execute();',
        '  }',
        '  void remove() { conn.prepareCall("begin ? := hr_utils.remove_employees(?); end;"); }',
        '  // conn.prepareCall("{call hr_utils.old_api(?)}");',
        '  protected abstract class Departments extends StoredProcedure {',
        '    protected final static String PROCEDURE = "GET_DEPARTMENTS";',
        '    Departments() { final String strStmt = Joiner.on(".").join(pkgCfg.getPkgName(), PROCEDURE); setSql(strStmt); }',
        '  }',
        '}',
        '',
      ].join('\n'),
      'src/main/java/hr/Employee.java': '@NamedStoredProcedureQuery(name = "addEmployee", procedureName = "EMPLOYEEPROCEDURE", parameters = { @StoredProcedureParameter(mode = ParameterMode.IN, name = "p_id", type = Long.class) })\nclass Employee {}\n',
      'src/main/java/hr/Procedures.java': 'class Procedures {\n  void add() { em.createNamedStoredProcedureQuery("addEmployee").execute(); }\n}\n',
      'web/package.json': '{ "name": "web", "scripts": { "start": "vite" } }',
      'web/src/routes/+page.svelte': '<script>\n  const run = () => db.query("SELECT refuel_ship(1)");\n</script>\n<Pin sql="SELECT attack(1, 2)" />\n',
      'db/game.sql': 'CREATE FUNCTION refuel_ship(id INT) RETURNS INT AS $$ BEGIN RETURN 1; END $$ LANGUAGE plpgsql;\nCREATE FUNCTION attack(a INT, b INT) RETURNS INT AS $$ BEGIN RETURN 1; END $$ LANGUAGE plpgsql;\n',
    }))
    expect(facts.routineCalls.map((c) => [c.unit.split(':unit:')[1], c.routine, c.via]).sort()).toEqual([
      ['.', 'employeeprocedure', 'JPA'], ['.', 'hr_utils.get_departments', 'Spring StoredProcedure'], ['.', 'hr_utils.get_regions', 'Spring SimpleJdbcCall'],
      ['.', 'hr_utils.remove_employees', 'PL/SQL block'], ['web', 'refuel_ship', 'SQL function'],
    ])
  })

  it("reads a library of SQL alone by its top folders, its examples, a runner's drops, the code of a coverage folder, and no developer tooling", () => {
    const facts = extractRepository(repo('utlib', {
      'source/install.sql': '@@core/ut.pks\n@@core/ut.pkb\n@@core/coverage/ut_coverage.pks\n',
      'source/core/ut.pks': 'CREATE OR REPLACE PACKAGE ut AS\n  PROCEDURE run;\nEND;\n/\n',
      'source/core/ut.pkb': [
        'CREATE OR REPLACE PACKAGE BODY ut AS',
        '  -- $$NO_OP disables the calls',
        '  PROCEDURE run IS',
        '  BEGIN',
        '    $if $$no_op $then',
        '      null;',
        '    $else',
        '      ut_coverage.coverage_start;',
        '    $end',
        '  END run;',
        'END;',
        '/',
        '',
      ].join('\n'),
      'source/core/coverage/ut_coverage.pks': 'CREATE OR REPLACE PACKAGE ut_coverage AS\n  PROCEDURE coverage_start;\nEND;\n/\n',
      'source/core/coverage/report.html': '<html><a href="https://example.com/x">x</a></html>',
      'source/uninstall.sql': 'DROP PACKAGE ut;\nDROP PACKAGE ut_coverage;\n',
      'examples/award_bonus/run.sql': '@@award_bonus.prc\nexec ut.run;\n@@drop_award_bonus.sql\n',
      'examples/award_bonus/award_bonus.prc': 'CREATE OR REPLACE PROCEDURE award_bonus AS BEGIN NULL; END;\n/\n',
      'examples/award_bonus/drop_award_bonus.sql': 'DROP PROCEDURE award_bonus;\n',
      'examples/rooms/run_remove_rooms_test.sql': 'CREATE TABLE rooms (id NUMBER(6));\n',
      'development/mystats/mystats_pkg.sql': 'CREATE OR REPLACE PACKAGE mystats_pkg AS\n  PROCEDURE ms_start;\nEND;\n/\n',
    }))
    expect(facts.units.map((u) => u.path)).toEqual(['examples', 'source'])
    expect(routines(facts).map((r) => r[1]).sort()).toEqual(['ut', 'ut.run', 'ut_coverage', 'ut_coverage.coverage_start'])
    expect(facts.routines.find((r) => r.name === 'ut.run')?.calls).toEqual(['ut_coverage.coverage_start'])
    expect(facts.tables.map((t) => t.table)).toEqual(['rooms'])
    expect(linkRepositories([facts]).map((l) => [l.kind, l.from.split(':unit:')[1], l.to.split(':unit:')[1]])).toContainEqual(['routine', 'examples', 'source'])
  })

  it('follows a Sqitch project in its plan: columns added and dropped, reworks and reverts aside, a routine to its statement, flags set the PL/pgSQL way, SvelteKit routes, and a backup job no database', () => {
    const facts = extractRepository(repo('game', {
      'schema/sqitch.plan': '%project=game\n\ntable-player 2026-01-01T00:00:00Z dev <d@x> # players\nplayer-drop_password [table-player] 2026-01-02T00:00:00Z dev <d@x> # no passwords\nprocedure-tic 2026-01-03T00:00:00Z dev <d@x> # the clock\n',
      'schema/deploy/table-player.sql': 'CREATE TABLE player (id SERIAL PRIMARY KEY, password CHAR(40), approved BOOLEAN NOT NULL DEFAULT false);\n',
      'schema/deploy/player-drop_password.sql': 'ALTER TABLE player DROP COLUMN password;\nALTER TABLE player ADD COLUMN shared boolean NOT NULL DEFAULT false;\n',
      'schema/deploy/procedure-tic.sql': [
        'CREATE OR REPLACE PROCEDURE tic_open() AS $$ BEGIN NULL; END $$ LANGUAGE plpgsql;',
        'CREATE OR REPLACE PROCEDURE tic_close() AS $$',
        'BEGIN',
        "  UPDATE player SET approved = 't';",
        'END $$ LANGUAGE plpgsql;',
        'REVOKE ALL ON PROCEDURE tic_open() FROM PUBLIC;',
        'CREATE OR REPLACE FUNCTION player_changed() RETURNS trigger AS $$',
        'BEGIN',
        "  -- the referee approves them with UPDATE player SET approved = true",
        "  NEW.approved := 'f';",
        '  RETURN NEW;',
        'END $$ LANGUAGE plpgsql;',
        '',
      ].join('\n'),
      'schema/deploy/procedure-tic@v1.0.sql': 'CREATE OR REPLACE PROCEDURE tic_legacy() AS $$ BEGIN NULL; END $$ LANGUAGE plpgsql;\n',
      'schema/revert/table-player.sql': 'DROP TABLE player;\n',
      'web/package.json': '{ "name": "web", "scripts": { "start": "vite" }, "devDependencies": { "@sveltejs/kit": "2.0.0" } }',
      'web/src/routes/(public)/fleet/[id]/+page.svelte': '<h1>Fleet</h1>\n',
      'web/src/routes/api/sql/+server.ts': 'export const POST = async () => new Response()\n',
      'web/src/lib/seo.ts': "export const REPO = 'https://github.com/game/game'\n",
      'docker/compose.yml': 'services:\n  web:\n    build:\n      context: ../web\n    environment:\n      PGHOST: db\n      PGDATABASE: game\n  backup:\n    image: postgres:16\n    entrypoint: ["/bin/sh", "/backup.sh"]\n    environment:\n      PGHOST: db\n',
    }))
    expect(facts.tables.find((t) => t.table === 'player')?.columns?.map((c) => [c.name, c.file])).toEqual([['id', undefined], ['approved', undefined], ['shared', 'schema/deploy/player-drop_password.sql']])
    expect(routines(facts).map((r) => r[1])).toEqual(['tic_open', 'tic_close', 'player_changed'])
    expect(facts.routines.find((r) => r.name === 'tic_close')).toMatchObject({ writes: ['player'] })
    expect(facts.routines.find((r) => r.name === 'tic_close')?.calls).toBeUndefined()
    expect(facts.states.find((s) => s.table === 'player')?.sets.map((x) => [x.value, x.line])).toEqual([['approved', 4], ['not approved', 10]])
    expect(facts.entries.map((e) => e.name)).toEqual(['GET /fleet/{id}', 'POST /api/sql'])
    expect(facts.urls).toEqual([])
    expect(facts.databases.map((d) => [d.unit?.split(':unit:')[1], d.name, d.evidence.line])).toEqual([['web', 'game', 7]])
  })

  it("reads Entity Framework's tables from its migrations' snapshot, SQLite named in code, and the services an Oracle package calls", () => {
    const facts = extractRepository(repo('apps', {
      'pets/Pets.csproj': '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="3.0.0" /></ItemGroup></Project>',
      'pets/Program.cs': 'class PetContext : DbContext {\n  public DbSet<Pet> Pets { get; set; }\n  public DbSet<PetCount> PetCounts { get; set; }\n  protected override void OnConfiguring(DbContextOptionsBuilder options) => options.UseSqlite("Data Source=pets.db");\n}\npublic class Pet { public int Id { get; set; } }\npublic class PetCount { public int Count { get; set; } }\n',
      'pets/Migrations/PetContextModelSnapshot.cs': 'modelBuilder.Entity("Pets.Pet", b => { b.ToTable("Pets"); });\n',
    }))
    expect(facts.tables.map((t) => t.table)).toEqual(['Pets'])
    expect(facts.databases.map((d) => [d.engine, d.name])).toEqual([['SQLite', 'pets.db']])
    // A library of PL/SQL calls the services its packages name, no page's link or namespace.
    const library = extractRepository(repo('lib', {
      'ora/slack_util_pkg.pkb': [
        'CREATE OR REPLACE PACKAGE BODY slack_util_pkg AS',
        "  g_url CONSTANT VARCHAR2(100) := 'https://hooks.slack.com/services/';",
        "  g_ns CONSTANT VARCHAR2(100) := 'http://schemas.microsoft.com/exchange/services';",
        '  PROCEDURE help IS BEGIN',
        "    htp.anchor('http://www.google.com/search?q=x', 'Google');",
        '  END help;',
        'END;',
        '/',
        '',
      ].join('\n'),
    }))
    expect(library.addresses.map((a) => [a.unit?.split(':unit:')[1], a.host])).toEqual([['ora', 'hooks.slack.com']])
  })

  it('reads the Oracle database a JDBC URL, a TNS descriptor, an Easy Connect string and makedsn name', () => {
    const facts = extractRepository(repo('ora', {
      'svc/pom.xml': '<project><artifactId>svc</artifactId></project>',
      'svc/src/main/resources/application.properties': 'spring.datasource.url=jdbc:oracle:thin:@//dbhost.corp:1521/ORCLPDB1\nlegacy.url=jdbc:oracle:thin:@olddb:1521:LEGACY\n',
      'net/Billing.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
      'net/appsettings.json': '{ "ConnectionStrings": { "Billing": "User Id=billing;Password=x;Data Source=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=billing-db)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=BILLPDB)))" } }',
      'py/requirements.txt': 'oracledb\n',
      'py/main.py': 'conn = oracledb.connect(user="u", password=pw, dsn="reports-db:1521/REPORTS")\nold = cx_Oracle.makedsn("archive-db", 1521, service_name="ARCH")\n',
    }))
    expect(facts.databases.map((d) => [d.unit?.split(':unit:')[1], d.engine, d.server, d.name]).sort()).toEqual([
      ['net', 'Oracle', 'billing-db', 'BILLPDB'],
      ['py', 'Oracle', 'archive-db', 'ARCH'], ['py', 'Oracle', 'reports-db', 'REPORTS'],
      ['svc', 'Oracle', 'dbhost.corp', 'ORCLPDB1'], ['svc', 'Oracle', 'olddb', 'LEGACY'],
    ])
  })
  it("runs a Sqitch change's reworked script where the plan first has it, reads a flag set only by := or an UPDATE's SET, and no query a page only shows", () => {
    const facts = extractRepository(repo('game', {
      'schema/sqitch.plan': '%project=game\n\ntable-ship 2026-01-01T00:00:00Z dev <d@x> # ships\ntrigger-destroy_ship [table-ship] 2026-01-02T00:00:00Z dev <d@x> # destroy\nfunction-get_player_id 2026-01-02T00:00:00Z dev <d@x> # who\ndata-missions 2026-01-02T00:00:00Z dev <d@x> # hints\n@v1.0 2026-01-03T00:00:00Z dev <d@x> # first release\n\ntrigger-destroy_ship [trigger-destroy_ship@v1.0] 2026-01-04T00:00:00Z dev <d@x> # no cache\n',
      'schema/deploy/table-ship.sql': 'CREATE TABLE ship (id SERIAL PRIMARY KEY, current_health integer, destroyed boolean NOT NULL DEFAULT false);\n',
      'schema/deploy/trigger-destroy_ship@v1.0.sql': [
        'CREATE OR REPLACE FUNCTION destroy_ship() RETURNS trigger AS $$ BEGIN DELETE FROM ships_near; RETURN NEW; END $$ LANGUAGE plpgsql;',
        'CREATE TRIGGER destroy_ship AFTER UPDATE ON ship FOR EACH ROW EXECUTE PROCEDURE destroy_ship();',
        '',
      ].join('\n'),
      'schema/deploy/trigger-destroy_ship.sql': [
        'CREATE OR REPLACE FUNCTION destroy_ship() RETURNS trigger AS $$',
        'BEGIN',
        '  UPDATE ship SET destroyed = true',
        '  WHERE id = NEW.id AND current_health <= 0;',
        '  SELECT 1 FROM ship S WHERE S.current_health > 0',
        "    AND S.destroyed='f';",
        '  RETURN NEW;',
        'END $$ LANGUAGE plpgsql;',
        '',
      ].join('\n'),
      'schema/deploy/function-get_player_id.sql': 'CREATE OR REPLACE FUNCTION get_player_id(name) RETURNS integer AS $get_player_id$\n  SELECT 1;\n$get_player_id$ LANGUAGE sql;\n'
        + ['current_round', 'refuel_ship', 'attack'].map((f) => `CREATE OR REPLACE FUNCTION ${f}() RETURNS integer AS $$ BEGIN RETURN 1; END $$ LANGUAGE plpgsql;\n`).join(''),
      'schema/deploy/data-missions.sql': "INSERT INTO mission VALUES (1,\n 'Revive a ship: UPDATE ship SET destroyed = false; then wait');\n",
      'web/package.json': '{ "name": "web", "scripts": { "start": "vite" }, "dependencies": { "pg": "8.0.0" }, "devDependencies": { "@sveltejs/kit": "2.0.0" } }',
      'web/src/routes/play/+page.svelte': [
        '<script lang="ts">',
        "  const starters = [['Prices', 'SELECT * FROM price_list;'], ['Refuel', 'SELECT refuel_ship(1);']];",
        '  function describe(e) {',
        "    switch (e.action) { case 'ATTACK': return `SELECT attack(${e.id});` }",
        '  }',
        "  async function load() { await runSql('SELECT current_round();') }",
        '</script>',
        '<Pin sql="SELECT attack(ship, id) FROM ships_in_range;" />',
        '<button onclick={() => quick(`SELECT refuel_ship(${selected.id});`)}>Refuel</button>',
        '',
      ].join('\n'),
    }))
    expect(facts.routines.filter((r) => r.name === 'destroy_ship').map((r) => [r.kind, r.evidence.file, r.evidence.line])).toEqual([
      ['function', 'schema/deploy/trigger-destroy_ship.sql', 1], ['trigger', 'schema/deploy/trigger-destroy_ship@v1.0.sql', 2],
    ])
    expect(facts.routines.find((r) => r.name === 'destroy_ship' && r.kind === 'function')).toMatchObject({ writes: ['ship'] })
    expect(facts.routines.find((r) => r.name === 'get_player_id')?.dialect).toBe('PostgreSQL')
    expect(facts.states.find((s) => s.table === 'ship')?.sets.map((x) => [x.value, x.file, x.line])).toEqual([['destroyed', 'schema/deploy/trigger-destroy_ship.sql', 3]])
    expect(facts.routineCalls.map((c) => [c.routine, c.evidence.line])).toEqual([['current_round', 6], ['refuel_ship', 9]])
    expect(facts.tables.filter((t) => !t.declared).map((t) => t.table)).toEqual([])
  })

  it('links a stored package to the packages its members call, and counts the members in their packages\' rows', () => {
    const facts = extractRepository(repo('lib', {
      'ora/http_util_pkg.pks': 'CREATE OR REPLACE PACKAGE http_util_pkg AS\n  FUNCTION get_blob(p_url VARCHAR2) RETURN BLOB;\nEND http_util_pkg;\n/\n',
      'ora/http_util_pkg.pkb': 'CREATE OR REPLACE PACKAGE BODY http_util_pkg AS\n  FUNCTION get_blob(p_url VARCHAR2) RETURN BLOB IS\n  BEGIN\n    RETURN NULL;\n  END get_blob;\nEND http_util_pkg;\n/\n',
      'ora/s3_pkg.pks': 'CREATE OR REPLACE PACKAGE s3_pkg AS\n  FUNCTION get_object(p_key VARCHAR2) RETURN BLOB;\nEND s3_pkg;\n/\n',
      'ora/s3_pkg.pkb': 'CREATE OR REPLACE PACKAGE BODY s3_pkg AS\n  FUNCTION get_object(p_key VARCHAR2) RETURN BLOB IS\n  BEGIN\n    RETURN http_util_pkg.get_blob(p_key);\n  END get_object;\nEND s3_pkg;\n/\n',
    }))
    expect(linkRepositories([facts]).filter((l) => l.kind === 'routine').map((l) => [l.from.split(':routine:')[1], l.to.split(':routine:')[1], l.detail])).toEqual([
      ['ora:s3_pkg', 'ora:http_util_pkg', 'calls http_util_pkg.get_blob'],
    ])
    expect(describeFacts([facts], [], facts.dir)[0]).toContain('2 stored routines (with 2 package members in their packages\' rows)')
  })
})
