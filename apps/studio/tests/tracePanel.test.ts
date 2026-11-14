import { describe, expect, it } from 'vitest'
import { repositoryPath, repositoryRootOf, vscodeLink } from '../src/renderer/src/components/inspector/TracePanel'

describe('verification path: the link to a test', () => {
  it('finds the repository from the model folder', () => {
    expect(repositoryRootOf('/Users/me/shop/.radical/model')).toBe('/Users/me/shop')
    expect(repositoryRootOf('/Users/me/shop/architecture/')).toBe('/Users/me/shop')
    expect(repositoryRootOf('C:\\Users\\me\\shop\\.radical\\model')).toBe('C:/Users/me/shop')
    // A folder picked in the browser has no path.
    expect(repositoryRootOf('model')).toBeNull()
    expect(repositoryRootOf(undefined)).toBeNull()
  })

  it('names the test file from the repository root, also when CI ran it elsewhere', () => {
    expect(repositoryPath('/home/runner/work/shop/shop/tests/pay.test.ts', 'tests/pay.test.ts')).toBe('tests/pay.test.ts')
    expect(repositoryPath('tests/pay.test.ts', 'tests/pay.test.ts')).toBe('tests/pay.test.ts')
    // A directory id: the case's file under it.
    expect(repositoryPath('/ci/shop/apps/e2e/tests/a.spec.ts', 'apps/e2e/')).toBe('apps/e2e/tests/a.spec.ts')
    expect(repositoryPath('/elsewhere/x.test.ts', 'tests/pay.test.ts')).toBeNull()
  })

  it('opens the file at the line in VS Code', () => {
    expect(vscodeLink('/Users/me/my shop', 'tests/pay.test.ts', 12)).toBe('vscode://file/Users/me/my%20shop/tests/pay.test.ts:12')
    expect(vscodeLink('C:/Users/me/shop', 'tests/pay.test.ts')).toBe('vscode://file/C:/Users/me/shop/tests/pay.test.ts')
  })
})
