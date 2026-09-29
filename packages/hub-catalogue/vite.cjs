// Entry point for Vite configs, in plain CommonJS: the Vite / electron-vite
// config loader hands bare imports to Node, which cannot run this package's
// TypeScript. The plugin itself (src/vite.ts) is loaded through tsx. Vite
// accepts a Promise of a plugin in `plugins`.
const { tsImport } = require('tsx/esm/api')

exports.hubCataloguePlugin = async function hubCataloguePlugin(opts) {
  const mod = await tsImport('./src/vite.ts', __filename)
  return mod.hubCataloguePlugin(opts)
}
