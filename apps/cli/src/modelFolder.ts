import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { CRUCIBLE_FILE, CRUCIBLE_FINDINGS, OLD_CRUCIBLE_FILE, OLD_CRUCIBLE_FINDINGS, findModelFolder, findRepositoryFile, repositoryFileRoot, repositoryRoot } from '@radical/node-files/repositoryLayout'

/** The model folder a command works on, as the user would name it: the one
 *  named; else the working directory when it is one, the repository's
 *  .radical/model, or architecture/ of the old layout; else the
 *  working directory, which the command then reports is none. */
export async function modelFolderArg(given: string | undefined, cwd: string): Promise<string> {
  if (given !== undefined) return given
  const found = await findModelFolder(cwd)
  return found ? relative(cwd, found) || '.' : '.'
}

/** Crucible's plan: the file named, else .radical/crucible/crucible.json or
 *  the old layout's crucible.json found from the working directory up; the
 *  folder its paths are from (the repository's root for one under
 *  .radical/); and its findings folder by default. Without a plan, the
 *  findings folder there is, the new one when there is neither. */
export async function crucibleConfig(given: string | undefined, cwd: string): Promise<{ file: string; root: string; findings: string }> {
  const found = given !== undefined ? resolve(cwd, given) : (await findRepositoryFile(cwd, CRUCIBLE_FILE, OLD_CRUCIBLE_FILE))?.path
  if (found === undefined) {
    const root = await repositoryRoot(cwd) ?? resolve(cwd)
    const old = existsSync(join(root, OLD_CRUCIBLE_FINDINGS)) && !existsSync(join(root, CRUCIBLE_FINDINGS))
    return { file: join(root, CRUCIBLE_FILE), root, findings: old ? OLD_CRUCIBLE_FINDINGS : CRUCIBLE_FINDINGS }
  }
  const root = repositoryFileRoot(found)
  return { file: found, root, findings: root === dirname(found) ? OLD_CRUCIBLE_FINDINGS : CRUCIBLE_FINDINGS }
}
