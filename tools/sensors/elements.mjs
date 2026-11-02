// Where the elements of architecture/ are built in this repository: the
// mapping of the model onto the code, which the model leaves to the
// repository (ADR Fitness functions measure each element their decision
// constrains). The sensors of radical.sensors.json get an element in
// --context and look it up here. Keyed by element id; the label is for
// people. A sensor fails for an element missing here, naming it.

/** Each element: the workspaces that build it ('*' all of them), and the
 *  folders that hold its own files, where one workspace builds two. */
export const ELEMENTS = {
  '974cc763-a121-4f53-a92d-18a64562a0c9': { label: 'radical.tools', workspaces: '*' },
  '8c66e024-79f9-42d0-86cd-843cefd2a7ef': { label: 'CLI', workspaces: ['apps/cli'] },
  'c681fcc0-29ea-49b4-827a-2b2db809a513': { label: 'MCP server', workspaces: ['apps/mcp'] },
  '7ab5d665-387a-42c1-9aa6-55815b1f55f7': { label: 'Studio', workspaces: ['apps/studio'], folders: ['apps/studio/src/renderer'] },
  '60fb9531-8072-4f6d-804d-4a00a373a6ba': { label: 'Desktop app', workspaces: ['apps/studio'], folders: ['apps/studio/build', 'apps/studio/src/main'] },
  '9617df9e-ab47-46c4-920c-4347b186eb0d': { label: 'VS Code extension', workspaces: ['apps/vscode'] },
  '49fa95f2-b9ea-4884-9372-581264580278': { label: 'Website and manual', workspaces: ['apps/web'] },
  '7a893e48-dc84-4f06-a189-e507c7427e3a': { label: 'Architecture Hub', workspaces: ['apps/hub'] },
  'ff9c535a-4924-4b30-b055-0a329c542dea': { label: '@radical/common', workspaces: ['packages/common'] },
}

/** The --context radical sense run gives a sensor, or null without one. */
export function sensorContext(argv = process.argv.slice(2)) {
  const i = argv.indexOf('--context')
  return i < 0 ? null : JSON.parse(argv[i + 1])
}

/** The context's element and where it is built; exits 2, naming the
 *  element, when this file has no place for it. */
export function measuredElement(context) {
  const element = context?.element
  if (!element) fail('no element in --context: run this sensor with radical sense run')
  const place = ELEMENTS[element.id]
  if (!place) fail(`no place for ${element.type} "${element.label}" (${element.id}) in tools/sensors/elements.mjs`, 2)
  return { ...element, ...place, folders: place.folders ?? (place.workspaces === '*' ? ['.'] : place.workspaces) }
}

/** Says what is wrong and exits with `code`. */
export function fail(message, code = 1) {
  console.error(message)
  process.exit(code)
}
