import type { HostCapabilities } from '@radical/host-bridge'

declare global {
  interface Window {
    /** Set by the Electron preload. Read it only through host() in
     *  src/renderer/src/platform/host.ts. */
    electronAPI?: HostCapabilities
  }
}
