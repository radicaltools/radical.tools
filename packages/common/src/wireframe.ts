// ─── Mockup wireframes ───────────────────────────────────────────────────────
// A Mockup node may carry a low-fi SVG wireframe in its `wireframe` property.
// The SVG is only ever rendered through an <img> data URI (see MockupNode),
// which never runs scripts or fetches external resources; sanitizeWireframeSvg
// still strips the obvious active content so the stored markup is inert even
// if something later inlines it.

export const WIREFRAME_WIDTH = 400
export const WIREFRAME_HEIGHT = 300

/** Upper bound on stored markup — keeps a model full of mockups from turning
 *  into megabytes of eagerly-loaded frontmatter. */
export const MAX_WIREFRAME_CHARS = 20_000

/** Pulls the first <svg>…</svg> out of a model response and strips active
 *  content. Returns null when the response has no usable SVG. */
export function sanitizeWireframeSvg(text: string): string | null {
  const match = text.match(/<svg[\s\S]*?<\/svg>/i)
  if (!match) return null
  let svg = match[0]
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '')
  if (!/\sxmlns=/.test(svg.slice(0, svg.indexOf('>')))) {
    svg = svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  }
  if (svg.length > MAX_WIREFRAME_CHARS) return null
  return svg
}

/** Data URI for rendering a stored wireframe through <img>. */
export function wireframeDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
