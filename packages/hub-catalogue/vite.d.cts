import type { Plugin } from 'vite'

/** Serves the catalogue under /hub/ in dev and emits it at build time.
 *  `hubDir` defaults to the catalogue shipped with this package. */
export declare function hubCataloguePlugin(opts?: { hubDir?: string }): Promise<Plugin>
