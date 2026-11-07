import { describe, expect, it } from 'vitest'
import { testSkeleton, testUnitFor, type RepositoryFacts, type Unit } from '../src/index'

const unit = (path: string, stack: Unit['stack'], extra: Partial<Unit> = {}): Unit => ({
  id: `r:unit:${path}`, name: path, path, stack, kind: 'app', why: '', technology: [], evidence: { file: 'x', line: 1 }, ...extra,
})
const SCENARIOS = [
  { label: 'Order marked paid', given: 'a new order', when: 'its payment arrives', then: 'it is paid', from: 'src/Orders.java:40-44' },
  { label: 'Order marked paid', given: 'a paid order', when: 'the payment arrives again', then: 'nothing changes' },
]

describe('radical assay: pending tests of scenarios from the code', () => {
  it('writes one pending test per scenario for each framework, with the ids its reports name', () => {
    const junit = testSkeleton(unit('orders', 'maven'), 'junit5', 'Record a payment', SCENARIOS, '2026-11-07')
    expect(junit.file).toBe('orders/src/test/java/assay/RecordAPaymentTest.java')
    expect(junit.tests).toEqual(['assay.RecordAPaymentTest', 'assay.RecordAPaymentTest'])
    expect(junit.content).toContain('  @Disabled("Written by Radical Assay from the code: write the test")\n  @DisplayName("Order marked paid")\n  void orderMarkedPaid() {')
    // A second scenario of the same name gets a method of its own.
    expect(junit.content).toContain('void orderMarkedPaid2() {')
    expect(junit.content).toContain('Given a new order, when its payment arrives, then it is paid. (From src/Orders.java:40-44.)')

    const pytest = testSkeleton(unit('.', 'python'), 'pytest', 'Record a payment', SCENARIOS.slice(0, 1), '2026-11-07')
    expect([pytest.file, pytest.tests]).toEqual(['tests/assay/test_record_a_payment.py', ['tests.assay.test_record_a_payment']])
    expect(pytest.content).toContain('@pytest.mark.skip(reason="Written by Radical Assay from the code: write the test")\ndef test_order_marked_paid():')

    const xunit = testSkeleton(unit('Shop.Tests', 'dotnet', { kind: 'tests' }), 'xunit', 'Record a payment', SCENARIOS.slice(0, 1), '2026-11-07')
    expect([xunit.file, xunit.tests]).toEqual(['Shop.Tests/Assay/RecordAPaymentTests.cs', ['Assay.RecordAPaymentTests']])
    expect(xunit.content).toContain('    [Fact(Skip = "Written by Radical Assay from the code: write the test")]\n    public void OrderMarkedPaid()')

    const jest = testSkeleton(unit('web', 'npm'), 'jest', 'Record a payment', SCENARIOS.slice(0, 1), '2026-11-07')
    expect([jest.file, jest.tests]).toEqual(['web/tests/assay/record-a-payment.test.js', ['web/tests/assay/record-a-payment.test.js › Record a payment › Order marked paid']])
    expect(jest.content).not.toContain('import')
    expect(jest.content).toContain('  test.todo("Order marked paid")')
  })

  it('finds the unit that runs the tests: its own framework, a test project referencing it, else a root that tests', () => {
    const app = unit('Shop', 'dotnet')
    const tests = unit('Shop.Tests', 'dotnet', { kind: 'tests', testFramework: 'xunit' })
    const facts = { units: [app, tests], dependencies: [{ id: 'd', unit: tests.id, package: 'Shop', target: app.id, evidence: { file: 'x', line: 1 } }] } as unknown as RepositoryFacts
    expect(testUnitFor(app, facts)).toBe(tests)
    const web = unit('web', 'npm')
    const root = unit('.', 'npm', { testFramework: 'vitest' })
    expect(testUnitFor(web, { units: [root, web], dependencies: [] } as unknown as RepositoryFacts)).toBe(root)
    expect(testUnitFor(unit('.', 'vb6'), { units: [], dependencies: [] } as unknown as RepositoryFacts)).toBeUndefined()
  })
})
