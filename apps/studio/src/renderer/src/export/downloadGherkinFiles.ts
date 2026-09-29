import type { GherkinFile } from '@radical/common/formats/exportGherkin'

/** Triggers a browser download for each file, staggered so Safari/Firefox
 *  don't drop downloads fired in the same tick (mirrors the pattern in
 *  documentStore.ts's defaultWebDownloader). */
export function downloadGherkinFiles(files: GherkinFile[]): void {
  files.forEach((file, i) => {
    setTimeout(() => {
      const blob = new Blob([file.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        try { document.body.removeChild(a) } catch { /* already gone */ }
        URL.revokeObjectURL(url)
      }, 1000)
    }, i * 250)
  })
}
