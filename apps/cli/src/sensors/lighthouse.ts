// Lab Web Vitals from Lighthouse's own reports: the result JSON (LHR) that
// `lighthouse --output json` writes and that Lighthouse CI keeps in
// .lighthouseci/lhr-*.json, one a run. Values are the median of the runs of
// one page on one device (Lighthouse CI runs a page several times, since one
// lab run varies), then the worst page of each device, which a pack's
// condition states (`web.lab.lcp.max{device=mobile} <= 2500 ms`).

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { SensorAdapter, SensorValue } from './types'

const DEFAULT_INPUT = '.lighthouseci'

/** The audits read, by the metric they give: their numericValue, in the
 *  audit's own unit (milliseconds; CLS has none; bytes for the weight). */
const AUDITS: Array<{ metric: string; audit: string; unit?: string }> = [
  { metric: 'web.lab.lcp', audit: 'largest-contentful-paint', unit: 'ms' },
  { metric: 'web.lab.fcp', audit: 'first-contentful-paint', unit: 'ms' },
  { metric: 'web.lab.tbt', audit: 'total-blocking-time', unit: 'ms' },
  { metric: 'web.lab.speed_index', audit: 'speed-index', unit: 'ms' },
  { metric: 'web.lab.cls', audit: 'cumulative-layout-shift' },
  // Only timespan reports (a user flow's interactions) have it.
  { metric: 'web.lab.inp', audit: 'interaction-to-next-paint', unit: 'ms' },
  { metric: 'web.lab.bytes', audit: 'total-byte-weight', unit: 'B' },
]

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

interface Audit { numericValue?: unknown; details?: { items?: Array<{ resourceType?: unknown; transferSize?: unknown }> } }
interface Lhr {
  lighthouseVersion: string
  requestedUrl?: string
  finalUrl?: string
  finalDisplayedUrl?: string
  runtimeError?: { code?: string; message?: string }
  configSettings?: { formFactor?: string; emulatedFormFactor?: string }
  audits: Record<string, Audit | undefined>
  categories?: Record<string, { score?: unknown } | undefined>
}

const isLhr = (data: unknown): data is Lhr => !!data && typeof data === 'object'
  && typeof (data as Lhr).lighthouseVersion === 'string' && !!(data as Lhr).audits && typeof (data as Lhr).audits === 'object'

/** The reports in a file: an LHR, or each step of a user flow's result. */
function reportsIn(data: unknown): Lhr[] {
  if (isLhr(data)) return [data]
  const steps = (data as { steps?: unknown } | null)?.steps
  if (Array.isArray(steps)) return steps.map((s) => (s as { lhr?: unknown })?.lhr).filter(isLhr)
  return []
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** The page a report measured: path and query of the URL it ended on. */
function pageOf(lhr: Lhr, file: string): string {
  const url = lhr.finalDisplayedUrl ?? lhr.finalUrl ?? lhr.requestedUrl
  if (!url) throw new Error(`${file}: the report names no URL (finalDisplayedUrl, finalUrl, requestedUrl)`)
  try {
    const u = new URL(url)
    return `${u.pathname}${u.search}`
  } catch {
    return url
  }
}

const deviceOf = (lhr: Lhr): string => (lhr.configSettings?.formFactor ?? lhr.configSettings?.emulatedFormFactor) === 'desktop' ? 'desktop' : 'mobile'

/** One report's values: metric name (with the category of a score) → value. */
function valuesOf(lhr: Lhr): Array<{ metric: string; value: number; unit?: string; category?: string }> {
  const out: Array<{ metric: string; value: number; unit?: string; category?: string }> = []
  for (const a of AUDITS) {
    const value = lhr.audits[a.audit]?.numericValue
    if (finite(value)) out.push({ metric: a.metric, value, ...(a.unit ? { unit: a.unit } : {}) })
  }
  const items = lhr.audits['resource-summary']?.details?.items
  const script = Array.isArray(items) ? items.find((i) => i?.resourceType === 'script')?.transferSize : undefined
  if (finite(script)) out.push({ metric: 'web.lab.script_bytes', value: script, unit: 'B' })
  for (const category of CATEGORIES) {
    const score = lhr.categories?.[category]?.score
    if (finite(score)) out.push({ metric: 'web.lab.score', value: Math.round(score * 100), category })
  }
  return out
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

const round = (n: number): number => Math.round(n * 1000) / 1000

/** The report files given: files as they are, every *.json of a directory
 *  that is a report (Lighthouse CI's manifest.json and the like left out). */
async function readReports(inputs: string[], cwd: string): Promise<Array<{ file: string; lhr: Lhr }>> {
  const out: Array<{ file: string; lhr: Lhr }> = []
  const parse = async (path: string, shown: string): Promise<unknown> => {
    const text = await readFile(path, 'utf8')
    try { return JSON.parse(text) } catch (error) {
      throw new Error(`${shown} is no JSON: ${(error as Error).message}`)
    }
  }
  for (const input of inputs) {
    const path = resolve(cwd, input)
    const kind = await stat(path).then((s) => (s.isDirectory() ? 'dir' : 'file'), () => null)
    if (!kind) throw new Error(`cannot read ${input}: no such file or directory${input === DEFAULT_INPUT ? ' (run Lighthouse CI first, or name the reports)' : ''}`)
    if (kind === 'file') {
      const reports = reportsIn(await parse(path, input))
      if (!reports.length) throw new Error(`${input} is no Lighthouse report (no lighthouseVersion and audits)`)
      out.push(...reports.map((lhr) => ({ file: input, lhr })))
      continue
    }
    for (const name of (await readdir(path)).filter((f) => f.endsWith('.json')).sort()) {
      const shown = join(input, name)
      out.push(...reportsIn(await parse(join(path, name), shown)).map((lhr) => ({ file: shown, lhr })))
    }
  }
  return out
}

/** The measurements of a set of reports: the median per page and device,
 *  then the largest (a score: smallest) of those per device. */
function lighthouseValues(reports: Array<{ file: string; lhr: Lhr }>): SensorValue[] {
  type Key = string
  const series = new Map<Key, { metric: string; unit?: string; labels: Record<string, string>; values: number[] }>()
  for (const { file, lhr } of reports) {
    if (lhr.runtimeError?.code) continue
    const labels = { page: pageOf(lhr, file), device: deviceOf(lhr) }
    for (const v of valuesOf(lhr)) {
      const l: Record<string, string> = v.category ? { ...labels, category: v.category } : labels
      const key = JSON.stringify([v.metric, l.page, l.device, v.category ?? ''])
      const s = series.get(key) ?? { metric: v.metric, ...(v.unit ? { unit: v.unit } : {}), labels: l, values: [] as number[] }
      s.values.push(v.value)
      series.set(key, s)
    }
  }
  const perPage: SensorValue[] = [...series.values()].map((s) => ({ metric: s.metric, value: round(median(s.values)), ...(s.unit ? { unit: s.unit } : {}), labels: s.labels }))
  const across = new Map<Key, SensorValue>()
  for (const v of perPage) {
    const { page: _page, ...labels } = v.labels ?? {}
    const score = v.metric === 'web.lab.score'
    const metric = `${v.metric}.${score ? 'min' : 'max'}`
    const key = JSON.stringify([metric, labels.device, labels.category ?? ''])
    const at = across.get(key)
    if (!at || (score ? v.value < at.value : v.value > at.value)) across.set(key, { metric, value: v.value, ...(v.unit ? { unit: v.unit } : {}), labels })
  }
  return [...perPage, ...across.values()]
}

/** A cut-down Lighthouse 12 navigation report, as Lighthouse CI writes it. */
function fixtureLhr(o: { url: string; device: 'mobile' | 'desktop'; fetchTime: string; lcp: number; fcp: number; tbt: number; si: number; cls: number; bytes: number; script: number; scores: [number, number, number, number] }): string {
  const ms = (id: string, title: string, value: number, score: number) => ({ id, title, score, scoreDisplayMode: 'numeric', numericValue: value, numericUnit: 'millisecond', displayValue: `${(value / 1000).toFixed(1)} s` })
  return JSON.stringify({
    lighthouseVersion: '12.2.1',
    requestedUrl: o.url,
    mainDocumentUrl: o.url,
    finalDisplayedUrl: o.url,
    finalUrl: o.url,
    fetchTime: o.fetchTime,
    gatherMode: 'navigation',
    runWarnings: [],
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
    configSettings: { output: ['json'], formFactor: o.device, throttlingMethod: 'simulate', screenEmulation: o.device === 'mobile' ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false } : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, onlyCategories: null },
    audits: {
      'first-contentful-paint': ms('first-contentful-paint', 'First Contentful Paint', o.fcp, 0.9),
      'largest-contentful-paint': ms('largest-contentful-paint', 'Largest Contentful Paint', o.lcp, 0.7),
      'total-blocking-time': { ...ms('total-blocking-time', 'Total Blocking Time', o.tbt, 0.8), displayValue: `${o.tbt} ms` },
      'speed-index': ms('speed-index', 'Speed Index', o.si, 0.85),
      'cumulative-layout-shift': { id: 'cumulative-layout-shift', title: 'Cumulative Layout Shift', score: 0.95, scoreDisplayMode: 'numeric', numericValue: o.cls, numericUnit: 'unitless', displayValue: String(o.cls) },
      'total-byte-weight': { id: 'total-byte-weight', title: 'Avoids enormous network payloads', score: 1, scoreDisplayMode: 'numeric', numericValue: o.bytes, numericUnit: 'byte', displayValue: `Total size was ${Math.round(o.bytes / 1024)} KiB` },
      'resource-summary': {
        id: 'resource-summary', title: 'Keep request counts low and transfer sizes small', score: null, scoreDisplayMode: 'informative',
        details: { type: 'table', items: [
          { resourceType: 'total', label: 'Total', requestCount: 24, transferSize: o.bytes },
          { resourceType: 'script', label: 'Script', requestCount: 9, transferSize: o.script },
          { resourceType: 'stylesheet', label: 'Stylesheet', requestCount: 2, transferSize: 18_204 },
        ] },
      },
    },
    categories: {
      performance: { id: 'performance', title: 'Performance', score: o.scores[0] },
      accessibility: { id: 'accessibility', title: 'Accessibility', score: o.scores[1] },
      'best-practices': { id: 'best-practices', title: 'Best Practices', score: o.scores[2] },
      seo: { id: 'seo', title: 'SEO', score: o.scores[3] },
    },
  })
}

export const lighthouseAdapter: SensorAdapter = {
  name: 'lighthouse',
  description: 'reads Lighthouse result JSON (LHR) files, e.g. Lighthouse CI\'s .lighthouseci, as lab Web Vitals per page and device',
  usage: `radical sense lighthouse [<file>|<dir>]…

  Reads Lighthouse results (LHR, \`lighthouse --output json\`, or a user flow's
  result) from the files named, or every *.json report in the directories
  named (other JSON there, such as Lighthouse CI's manifest.json, is left
  out); with none, from ${DEFAULT_INPUT} (where \`lhci collect\` writes).
  Run it once a page several times: each value is the median of the runs of
  one page on one device, labelled page (path and query of the final URL,
  e.g. /pricing) and device (mobile or desktop, the report's formFactor):
    web.lab.lcp, web.lab.fcp, web.lab.tbt, web.lab.speed_index (ms),
    web.lab.cls, web.lab.inp (ms; only timespan reports measure it),
    web.lab.bytes, web.lab.script_bytes (B, all and script transfer size),
    web.lab.score{category=performance|accessibility|best-practices|seo} (0-100)
  and across the pages, labelled only device (and category):
    web.lab.<metric>.max of each metric above, web.lab.score.min
  so a condition states the worst page:
    web.lab.lcp.max{device=mobile} <= 2500 ms
  A report with a runtime error is left out.`,
  async measure({ args, cwd }) {
    const inputs = args.length ? args : [DEFAULT_INPUT]
    const reports = await readReports(inputs, cwd)
    if (!reports.length) throw new Error(`no Lighthouse report in ${inputs.join(', ')}`)
    const values = lighthouseValues(reports)
    if (!values.length) throw new Error(`the Lighthouse reports in ${inputs.join(', ')} measured nothing (each has a runtime error)`)
    return values
  },
  fixture: {
    // Lighthouse CI's output: three mobile runs of /, one desktop run of /,
    // one mobile run of /pricing, beside its manifest and assertion results.
    args: [],
    files: {
      '.lighthouseci/lhr-1732435200001.json': fixtureLhr({ url: 'https://example.com/', device: 'mobile', fetchTime: '2026-11-24T08:00:01.000Z', lcp: 2400, fcp: 1500, tbt: 180, si: 3000, cls: 0.02, bytes: 820_000, script: 310_000, scores: [0.86, 0.95, 1, 0.92] }),
      '.lighthouseci/lhr-1732435200002.json': fixtureLhr({ url: 'https://example.com/', device: 'mobile', fetchTime: '2026-11-24T08:00:15.000Z', lcp: 3100, fcp: 1700, tbt: 260, si: 3600, cls: 0.05, bytes: 830_000, script: 312_000, scores: [0.78, 0.95, 1, 0.92] }),
      '.lighthouseci/lhr-1732435200003.json': fixtureLhr({ url: 'https://example.com/', device: 'mobile', fetchTime: '2026-11-24T08:00:29.000Z', lcp: 2800, fcp: 1600, tbt: 220, si: 3300, cls: 0.03, bytes: 825_000, script: 311_000, scores: [0.82, 0.95, 1, 0.92] }),
      '.lighthouseci/lhr-1732435200004.json': fixtureLhr({ url: 'https://example.com/', device: 'desktop', fetchTime: '2026-11-24T08:00:43.000Z', lcp: 900, fcp: 500, tbt: 40, si: 1100, cls: 0.01, bytes: 815_000, script: 309_000, scores: [0.99, 0.95, 1, 0.92] }),
      '.lighthouseci/lhr-1732435200005.json': fixtureLhr({ url: 'https://example.com/pricing?plan=team', device: 'mobile', fetchTime: '2026-11-24T08:00:57.000Z', lcp: 3500, fcp: 1400, tbt: 150, si: 3900, cls: 0.12, bytes: 1_240_000, script: 450_000, scores: [0.74, 0.88, 0.96, 1] }),
      '.lighthouseci/manifest.json': JSON.stringify([{ url: 'https://example.com/', isRepresentativeRun: true, jsonPath: '.lighthouseci/lhr-1732435200003.json', htmlPath: '.lighthouseci/lhr-1732435200003.html', summary: { performance: 0.82, accessibility: 0.95, 'best-practices': 1, seo: 0.92 } }]),
      '.lighthouseci/assertion-results.json': JSON.stringify([]),
    },
  },
}
