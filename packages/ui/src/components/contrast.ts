// Text drawn on a colour the model picks (a type's chip): WCAG 2.2 SC 1.4.3
// asks 4.5:1 between small text and what it stands on. The type's colour is
// kept as far as it can be: the fill is deepened (under light text) or
// lightened (under dark text) only as much as the text needs.

const MIN = 4.5

function channels(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number): number => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** The contrast ratio of two #rrggbb colours (1 to 21); 0 if either is not one. */
export function contrastRatio(a: string, b: string): number {
  const ca = channels(a)
  const cb = channels(b)
  if (!ca || !cb) return 0
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const toHex = (c: number[]): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

/** `fill` as text `fg` can be read on: deepened towards black under light
 *  text, lightened towards white under dark text, in small steps, until
 *  the two reach 4.5:1. A colour that is not #rrggbb is given back as it is. */
export function legibleFill(fill: string, fg: string): string {
  const c = channels(fill)
  const t = channels(fg)
  if (!c || !t || contrastRatio(fill, fg) >= MIN) return fill
  const toward = luminance(t) > 0.5 ? 0 : 255
  for (let step = 1; step <= 20; step++) {
    const k = step * 0.05
    const mixed = toHex(c.map((v) => v + (toward - v) * k))
    if (contrastRatio(mixed, fg) >= MIN) return mixed
  }
  return toward === 0 ? '#000000' : '#ffffff'
}
