// ─── Radical Assay: pending tests of scenarios found in the code ─────────────
//
// A scenario the agent drew from code that no test checks is written into
// the model; where the unit that builds it has a test framework, Assay also
// writes a pending test of it (ADR Assay writes the domain, processes and
// lifecycles it reads): one file per requirement, one test per scenario,
// each skipped until the team writes its body. The test ids it returns are
// what .radical/radical.json binds: a JavaScript test by its file and
// titles, a JUnit, pytest or .NET test by its class, as their reports name it.

import type { RepositoryFacts, TestFramework, Unit } from './facts'

export interface SkeletonScenario {
  label: string
  given: string
  when: string
  then: string
  /** The code it was drawn from: file and lines, for the reader. */
  from?: string
}

export interface Skeleton {
  /** From the repository's root. */
  file: string
  content: string
  /** The test id of each scenario, in their order. */
  tests: string[]
}

/** The unit whose test framework runs a pending test of `unit`'s code: its own, a test project that references it, else a root that runs the tests. */
export function testUnitFor(unit: Unit, facts: RepositoryFacts): Unit | undefined {
  if (unit.testFramework) return unit
  return facts.units.find((u) => u.kind === 'tests' && u.testFramework && facts.dependencies.some((d) => d.unit === u.id && d.target === unit.id))
    ?? facts.units.find((u) => u.path === '.' && u.testFramework && u.stack === unit.stack)
}

const words = (text: string): string[] => text.normalize('NFKD').replace(/[^\w\s-]/g, ' ').split(/[\s_-]+/).filter(Boolean)
const kebab = (text: string): string => words(text).join('-').toLowerCase() || 'requirement'
const snake = (text: string): string => words(text).join('_').toLowerCase() || 'scenario'
const pascal = (text: string): string => {
  const name = words(text).map((w) => w[0].toUpperCase() + w.slice(1)).join('')
  return /^\d/.test(name) ? `R${name}` : name || 'Requirement'
}
const camel = (text: string): string => ((p) => p[0].toLowerCase() + p.slice(1))(pascal(text))
/** Names unique among `taken`: a second "pays" is "pays2". */
const unique = (names: string[]): string[] => names.map((n, i) => (names.indexOf(n) === i ? n : `${n}${names.slice(0, i).filter((x) => x === n).length + 1}`))

const sentence = (s: SkeletonScenario): string => `Given ${s.given}, when ${s.when}, then ${s.then}.${s.from ? ` (From ${s.from}.)` : ''}`
const REASON = 'Written by Radical Assay from the code: write the test'

/** A pending test of each scenario of `requirement`, for `framework`, in `unit`'s folder. */
export function testSkeleton(unit: Unit, framework: TestFramework, requirement: string, scenarios: SkeletonScenario[], date: string): Skeleton {
  const prefix = unit.path === '.' ? '' : `${unit.path}/`
  const header = (comment: string): string => [
    `Written by Radical Assay on ${date}: the scenarios of the requirement "${requirement}",`,
    'drawn from the code, which no test checked. Each test is pending: write its body,',
    'then take away what keeps it from running.',
  ].map((l) => `${comment} ${l}`).join('\n')
  const js = JSON.stringify
  if (framework === 'vitest' || framework === 'jest' || framework === 'mocha') {
    const ts = unit.technology.includes('TypeScript')
    const file = `${prefix}tests/assay/${kebab(requirement)}.test.${ts ? 'ts' : 'js'}`
    const pending = (s: SkeletonScenario) => framework === 'mocha' ? `  it(${js(s.label)})` : `  test.todo(${js(s.label)})`
    const content = [
      header('//'),
      ...(framework === 'vitest' ? [`import { describe, test } from 'vitest'`] : []),
      '',
      `describe(${js(requirement)}, () => {`,
      scenarios.map((s) => `  // ${sentence(s)}\n${pending(s)}`).join('\n\n'),
      '})',
      '',
    ].join('\n')
    return { file, content, tests: scenarios.map((s) => `${file} › ${requirement} › ${s.label}`) }
  }
  if (framework === 'junit5' || framework === 'junit4') {
    const cls = `${pascal(requirement)}Test`
    const file = `${prefix}src/test/java/assay/${cls}.java`
    const methods = unique(scenarios.map((s) => camel(s.label)))
    const five = framework === 'junit5'
    const content = [
      header('//'),
      'package assay;',
      '',
      ...(five ? ['import org.junit.jupiter.api.Disabled;', 'import org.junit.jupiter.api.DisplayName;', 'import org.junit.jupiter.api.Test;'] : ['import org.junit.Ignore;', 'import org.junit.Test;']),
      '',
      ...(five ? [`@DisplayName(${js(requirement)})`] : []),
      `${five ? '' : 'public '}class ${cls} {`,
      scenarios.map((s, i) => [
        `  /** ${s.label}. ${sentence(s)} */`,
        '  @Test',
        five ? `  @Disabled(${js(REASON)})` : `  @Ignore(${js(REASON)})`,
        ...(five ? [`  @DisplayName(${js(s.label)})`] : []),
        `  ${five ? '' : 'public '}void ${methods[i]}() {`,
        '  }',
      ].join('\n')).join('\n\n'),
      '}',
      '',
    ].join('\n')
    return { file, content, tests: scenarios.map(() => `assay.${cls}`) }
  }
  if (framework === 'pytest') {
    const module = `test_${snake(requirement)}`
    const file = `${prefix}tests/assay/${module}.py`
    const names = unique(scenarios.map((s) => `test_${snake(s.label)}`))
    const content = [
      header('#'),
      'import pytest',
      '',
      scenarios.map((s, i) => [
        '',
        `@pytest.mark.skip(reason=${js(REASON)})`,
        `def ${names[i]}():`,
        `    """${s.label.replace(/"""/g, "'''")}. ${sentence(s).replace(/"""/g, "'''")}"""`,
      ].join('\n')).join('\n\n'),
      '',
    ].join('\n')
    return { file, content, tests: scenarios.map(() => `tests.assay.${module}`) }
  }
  // A database's tests: a utPLSQL suite package of disabled tests, a pgTAP script of TODO failures.
  if (framework === 'utplsql') {
    const name = `test_${snake(requirement)}`.slice(0, 30)
    const file = `${prefix}tests/assay/${name}.sql`
    const procedures = unique(scenarios.map((s) => snake(s.label).slice(0, 30)))
    const quoted = (text: string): string => text.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
    const content = [
      header('--'),
      `create or replace package ${name} as`,
      '',
      `  --%suite(${quoted(requirement)})`,
      '',
      ...scenarios.flatMap((s, i) => [`  -- ${sentence(s)}`, `  --%test(${quoted(s.label)})`, `  --%disabled(${REASON})`, `  procedure ${procedures[i]};`, '']),
      `end ${name};`,
      '/',
      '',
      `create or replace package body ${name} as`,
      '',
      ...scenarios.flatMap((s, i) => [`  procedure ${procedures[i]} is`, '  begin', '    null;', `  end ${procedures[i]};`, '']),
      `end ${name};`,
      '/',
      '',
    ].join('\n')
    return { file, content, tests: scenarios.map((s) => `${file} › ${quoted(requirement)} › ${quoted(s.label)}`) }
  }
  if (framework === 'pgtap') {
    const file = `${prefix}tests/assay/${kebab(requirement)}.sql`
    const sq = (text: string): string => `'${text.replace(/'/g, "''")}'`
    const content = [
      header('--'),
      'BEGIN;',
      `SELECT plan(${scenarios.length});`,
      '',
      ...scenarios.flatMap((s) => [`-- ${sentence(s)}`, `SELECT todo(${sq(REASON)}, 1);`, `SELECT fail(${sq(s.label)});`, '']),
      'SELECT * FROM finish();',
      'ROLLBACK;',
      '',
    ].join('\n')
    return { file, content, tests: scenarios.map((s) => `${file} › ${s.label}`) }
  }
  // .NET: xUnit, NUnit, MSTest, in the test project.
  const cls = `${pascal(requirement)}Tests`
  const file = `${prefix}Assay/${cls}.cs`
  const methods = unique(scenarios.map((s) => pascal(s.label)))
  const attribute = { xunit: `[Fact(Skip = ${js(REASON)})]`, nunit: `[Test, Ignore(${js(REASON)})]`, mstest: `[TestMethod, Ignore(${js(REASON)})]` }[framework]
  const using = { xunit: 'using Xunit;', nunit: 'using NUnit.Framework;', mstest: 'using Microsoft.VisualStudio.TestTools.UnitTesting;' }[framework]
  const content = [
    header('//'),
    using,
    '',
    'namespace Assay;',
    '',
    `/// <summary>${requirement.replace(/[<&]/g, ' ')}</summary>`,
    ...(framework === 'nunit' ? ['[TestFixture]'] : framework === 'mstest' ? ['[TestClass]'] : []),
    `public class ${cls}`,
    '{',
    scenarios.map((s, i) => [
      `    /// <summary>${`${s.label}. ${sentence(s)}`.replace(/[<&]/g, ' ')}</summary>`,
      `    ${attribute}`,
      `    public void ${methods[i]}()`,
      '    {',
      '    }',
    ].join('\n')).join('\n\n'),
    '}',
    '',
  ].join('\n')
  return { file, content, tests: scenarios.map(() => `Assay.${cls}`) }
}
