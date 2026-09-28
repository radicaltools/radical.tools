/**
 * Product layer of the sample model — everything above the C4 architecture:
 * EARS requirements (with a `derives` decomposition), Gherkin scenarios that
 * verify them, and one screen flow per actor made of Mockup nodes carrying
 * low-fi SVG wireframes.
 *
 * The wireframes follow the same rules the AI wireframe generator is prompted
 * with (src/renderer/src/ai/mockupWireframe.ts): 400×300 viewBox, grayscale,
 * one accent colour, only rect / line / circle / path / polygon / text / g —
 * so they pass sanitizeWireframeSvg unchanged and look like a model that was
 * run through "Generate wireframe".
 *
 * Used by tools/generate-sample.js.
 */
'use strict'

// ── Wireframe primitives ──────────────────────────────────────────────────────

const ACCENT = '#2563eb'

const TONES = {
  gray:  { bg: '#f3f4f6', fg: '#374151' },
  blue:  { bg: '#dbeafe', fg: '#1e40af' },
  green: { bg: '#dcfce7', fg: '#166534' },
  amber: { bg: '#fef3c7', fg: '#92400e' },
  red:   { bg: '#fee2e2', fg: '#991b1b' },
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Rough text width for sans-serif at a given font size. */
function textW(s, size) {
  return Math.round(String(s).length * size * 0.56)
}

function t(x, y, s, o = {}) {
  return `<text x="${x}" y="${y}" font-size="${o.size || 8}" fill="${o.fill || '#333'}"` +
    `${o.bold ? ' font-weight="bold"' : ''}${o.anchor ? ` text-anchor="${o.anchor}"` : ''}>${esc(s)}</text>`
}

function r(x, y, w, h, o = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${o.rx ? ` rx="${o.rx}"` : ''} fill="${o.fill || '#fff'}"` +
    `${o.stroke ? ` stroke="${o.stroke}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`
}

function ln(x1, y1, x2, y2, stroke = '#e5e7eb') {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}"/>`
}

function c(cx, cy, rad, o = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${o.fill || 'none'}"${o.stroke ? ` stroke="${o.stroke}"` : ''}` +
    `${o.width ? ` stroke-width="${o.width}"` : ''}/>`
}

function p(d, o = {}) {
  return `<path d="${d}" fill="${o.fill || 'none'}"${o.stroke ? ` stroke="${o.stroke}"` : ''}${o.width ? ` stroke-width="${o.width}"` : ''}/>`
}

/** Grey placeholder bar standing in for body copy. */
function bar(x, y, w) {
  return r(x, y, w, 5, { rx: 2, fill: '#e5e7eb' })
}

function svg(parts) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" font-family="sans-serif">' +
    r(0, 0, 400, 300) + parts.flat(Infinity).filter(Boolean).join('') + '</svg>'
}

// ── Wireframe widgets ─────────────────────────────────────────────────────────

/** App bar: logo + brand on the left, nav links right-aligned, active one accented. */
function header(brand, nav, active) {
  const out = [r(0, 0, 400, 30, { fill: '#f3f4f6', stroke: '#333' }), r(10, 8, 14, 14, { rx: 3, fill: '#ccc' }), t(30, 20, brand, { size: 11, bold: true })]
  let x = 388
  for (const item of [...nav].reverse()) {
    const on = item === active
    out.push(t(x, 19, item, { size: 9, fill: on ? ACCENT : '#666', bold: on, anchor: 'end' }))
    if (on) out.push(ln(x - textW(item, 9), 29, x, 29, ACCENT))
    x -= textW(item, 9) + 14
  }
  return out
}

function h1(x, y, s) {
  return t(x, y, s, { size: 13, bold: true })
}

function label(x, y, s) {
  return t(x, y, s, { size: 8, fill: '#666' })
}

function button(x, y, w, text, kind = 'secondary') {
  const style = {
    primary:   { fill: ACCENT, stroke: ACCENT, fg: '#fff' },
    secondary: { fill: '#fff', stroke: '#999', fg: '#333' },
    danger:    { fill: '#fff', stroke: '#991b1b', fg: '#991b1b' },
  }[kind]
  return [r(x, y, w, 20, { rx: 3, fill: style.fill, stroke: style.stroke }), t(x + w / 2, y + 13, text, { size: 9, bold: true, fill: style.fg, anchor: 'middle' })]
}

/** Labelled text input; `o.select` adds a dropdown caret, `o.ok` a green tick. */
function input(x, y, w, caption, value, o = {}) {
  const out = [label(x, y, caption), r(x, y + 4, w, 18, { rx: 2, stroke: '#999' })]
  out.push(value ? t(x + 6, y + 16, value, { size: 9 }) : bar(x + 6, y + 11, Math.min(80, w - 20)))
  if (o.select) out.push(`<polygon points="${x + w - 12},${y + 11} ${x + w - 6},${y + 11} ${x + w - 9},${y + 15}" fill="#666"/>`)
  if (o.ok) out.push(p(`M${x + w - 14} ${y + 13}l3 3 6-6`, { stroke: '#166534', width: 1.5 }))
  return out
}

function card(x, y, w, h, caption, value, sub) {
  const out = [r(x, y, w, h, { rx: 3, fill: '#fafafa', stroke: '#ccc' }), label(x + 10, y + 15, caption), t(x + 10, y + 32, value, { size: 13, bold: true })]
  if (sub) out.push(t(x + 10, y + h - 7, sub, { size: 7, fill: '#666' }))
  return out
}

function badge(x, y, text, tone = 'gray') {
  const { bg, fg } = TONES[tone]
  return [r(x, y - 8, textW(text, 7) + 10, 11, { rx: 5, fill: bg }), t(x + 5, y, text, { size: 7, fill: fg, bold: true })]
}

/**
 * Table with a shaded header row. `cols` are [label, xOffset] pairs; a cell is
 * a string, `null` (grey bar), `{ badge, tone }`, `{ text, fill }` or
 * `{ score }` (risk bar 0..1).
 */
function table(x, y, w, cols, rows, rowH = 18) {
  // All-blank column labels = key / value list without a header row.
  const headH = cols.some(([text]) => text) ? 18 : 0
  const out = headH ? [r(x, y, w, headH, { fill: '#f3f4f6' })] : [ln(x, y, x + w, y)]
  if (headH) for (const [text, dx] of cols) out.push(t(x + dx + 6, y + 12, text, { bold: true }))
  rows.forEach((row, i) => {
    const top = y + headH + i * rowH
    const base = top + rowH / 2 + 3
    row.forEach((cell, j) => {
      const cx = x + cols[j][1] + 6
      const colW = (j + 1 < cols.length ? cols[j + 1][1] : w) - cols[j][1] - 16
      if (cell == null) out.push(bar(cx, base - 5, Math.min(colW, 50 + ((i + j) % 3) * 20)))
      else if (typeof cell === 'string') out.push(t(cx, base, cell))
      else if (cell.badge) out.push(badge(cx, base, cell.badge, cell.tone))
      else if (cell.score != null) {
        const tone = cell.score >= 0.85 ? '#991b1b' : cell.score >= 0.6 ? '#92400e' : '#666'
        out.push(r(cx, base - 6, 40, 6, { rx: 3, fill: '#e5e7eb' }), r(cx, base - 6, Math.round(40 * cell.score), 6, { rx: 3, fill: tone }),
          t(cx + 46, base, cell.score.toFixed(2), { fill: tone, bold: cell.score >= 0.85 }))
      } else out.push(t(cx, base, cell.text, { fill: cell.fill, bold: cell.bold }))
    })
    out.push(ln(x, top + rowH, x + w, top + rowH))
  })
  return out
}

/** Wizard progress: numbered dots joined by a line, done / current / todo. */
function steps(x, y, w, names, current) {
  const gap = w / (names.length - 1)
  const out = [ln(x, y, x + w, y, '#ccc')]
  names.forEach((name, i) => {
    const cx = Math.round(x + i * gap)
    const done = i < current
    const on = i === current
    out.push(c(cx, y, 7, { fill: done ? ACCENT : '#fff', stroke: done || on ? ACCENT : '#ccc', width: on ? 2 : 1 }))
    out.push(t(cx, y + 3, done ? '✓' : String(i + 1), { size: 7, bold: true, fill: done ? '#fff' : on ? ACCENT : '#999', anchor: 'middle' }))
    out.push(t(cx, y + 18, name, { size: 7, fill: on ? ACCENT : '#666', bold: on, anchor: 'middle' }))
  })
  return out
}

function alert(x, y, w, h, tone, title, lines) {
  const { bg, fg } = TONES[tone]
  const titleY = lines.length ? y + 15 : Math.round(y + h / 2 + 3)
  const out = [r(x, y, w, h, { rx: 3, fill: bg, stroke: fg }), t(x + 10, titleY, title, { size: 9, bold: true, fill: fg })]
  lines.forEach((l, i) => out.push(l == null ? bar(x + 10, y + 24 + i * 11, w - 60 - i * 30) : t(x + 10, y + 29 + i * 11, l, { fill: fg })))
  return out
}

/** Big status icon: tick (green), clock (amber). */
function statusIcon(cx, cy, kind) {
  if (kind === 'ok') return [c(cx, cy, 20, { fill: TONES.green.bg, stroke: TONES.green.fg, width: 2 }), p(`M${cx - 9} ${cy}l6 6 12-12`, { stroke: TONES.green.fg, width: 3 })]
  return [c(cx, cy, 20, { fill: TONES.amber.bg, stroke: TONES.amber.fg, width: 2 }), p(`M${cx} ${cy - 10}v10l7 5`, { stroke: TONES.amber.fg, width: 2.5 })]
}

// ── Screens ───────────────────────────────────────────────────────────────────

const CUSTOMER_NAV = ['Accounts', 'Payments', 'Cards', 'Help']
const BUSINESS_NAV = ['Dashboard', 'Payments', 'Approvals', 'Reports']
const OPS_NAV = ['Cases', 'Customers', 'Audit']
const TRANSFER_STEPS = ['Details', 'Review', 'Authorise', 'Done']

const WIREFRAMES = {
  'mk-accounts': () => svg([
    header('Nova Bank', CUSTOMER_NAV, 'Accounts'),
    h1(16, 54, 'Good morning, Anna'),
    card(16, 64, 180, 46, 'Current account · DE89 …3000', '€4,218.40', 'Available — ledger as of 09:41'),
    card(204, 64, 180, 46, 'Savings', '€12,050.00', '1.9% AER'),
    t(16, 132, 'Recent activity', { size: 10, bold: true }),
    table(16, 140, 368, [['Date', 0], ['Description', 60], ['Amount', 280]], [
      ['26 Sep', 'Card — Green Grocer', { text: '−42.10' }],
      ['25 Sep', 'Salary — Acme GmbH', { text: '+3,200.00', fill: '#166534' }],
      ['22 Sep', null, null],
      ['19 Sep', 'Transfer to savings', { text: '−500.00' }],
    ]),
    button(16, 262, 120, 'Statements'),
    button(264, 262, 120, 'New transfer', 'primary'),
  ]),

  'mk-transfer': () => svg([
    header('Nova Bank', CUSTOMER_NAV, 'Payments'),
    h1(16, 54, 'New transfer'),
    steps(150, 50, 230, TRANSFER_STEPS, 0),
    input(16, 86, 368, 'From', 'Current account · €4,218.40', { select: true }),
    input(16, 122, 176, 'Recipient name', 'Jonas Weber'),
    input(208, 122, 176, 'IBAN', 'US21 CITI 0021 0000 1234', { ok: true }),
    input(16, 158, 176, 'Amount', '1,000.00'),
    input(208, 158, 80, 'Currency', 'USD', { select: true }),
    input(16, 194, 368, 'Reference', 'Invoice 2026-114'),
    label(16, 240, 'Cross-border payments show the rate and fees on the next step.'),
    button(16, 262, 100, 'Cancel'),
    button(284, 262, 100, 'Continue', 'primary'),
  ]),

  'mk-review': () => svg([
    header('Nova Bank', CUSTOMER_NAV, 'Payments'),
    h1(16, 54, 'Review transfer'),
    steps(150, 50, 230, TRANSFER_STEPS, 1),
    r(16, 78, 368, 58, { rx: 3, fill: '#fafafa', stroke: '#ccc' }),
    label(28, 94, 'You send'), t(28, 116, '€1,000.00', { size: 16, bold: true }),
    p('M186 107h26m-6-5 6 5-6 5', { stroke: '#666', width: 1.5 }),
    label(232, 94, 'Jonas Weber receives'), t(232, 116, '$1,082.40', { size: 16, bold: true, fill: ACCENT }),
    table(16, 146, 368, [['', 0], ['', 200]], [
      ['Exchange rate', '1 EUR = 1.0824 USD'],
      ['Fee', '€4.50'],
      [{ text: 'Total debited', bold: true }, { text: '€1,004.50', bold: true }],
      ['Expected arrival', 'Tue, 30 Sep 2026'],
    ]),
    badge(16, 244, 'Rate locked · 0:27', 'amber'),
    button(16, 262, 100, 'Back'),
    button(254, 262, 130, 'Confirm & authorise', 'primary'),
  ]),

  'mk-sca': () => svg([
    r(125, 6, 150, 288, { rx: 18, stroke: '#333' }),
    r(180, 13, 40, 6, { rx: 3, fill: '#ccc' }),
    t(200, 44, 'Nova Bank', { size: 9, bold: true, anchor: 'middle' }),
    t(200, 70, 'Approve payment?', { size: 12, bold: true, anchor: 'middle' }),
    t(200, 98, '€1,004.50', { size: 18, bold: true, anchor: 'middle' }),
    t(200, 114, 'to Jonas Weber · US21 …1234', { size: 7, fill: '#666', anchor: 'middle' }),
    c(200, 160, 26, { stroke: ACCENT, width: 2 }),
    p('M190 152v-4h4m12 0h4v4m0 16v4h-4m-12 0h-4v-4m7-10v4m6-4v4m-7 7c2 2 6 2 8 0', { stroke: ACCENT, width: 1.5 }),
    t(200, 202, 'Confirm with Face ID', { size: 8, fill: '#666', anchor: 'middle' }),
    button(140, 222, 120, 'Approve', 'primary'),
    button(140, 250, 120, 'Decline', 'danger'),
    t(200, 284, 'Expires in 4:52', { size: 7, fill: '#999', anchor: 'middle' }),
  ]),

  'mk-done': () => svg([
    header('Nova Bank', CUSTOMER_NAV, 'Payments'),
    steps(150, 50, 230, TRANSFER_STEPS, 3),
    statusIcon(200, 104, 'ok'),
    t(200, 146, 'Payment submitted', { size: 14, bold: true, anchor: 'middle' }),
    t(200, 162, '€1,004.50 to Jonas Weber is on its way.', { size: 9, fill: '#666', anchor: 'middle' }),
    table(76, 176, 248, [['', 0], ['', 110]], [
      ['Reference', 'PAY-2026-09-000184'],
      ['Status', { badge: 'Accepted', tone: 'green' }],
      ['Expected settlement', 'Tue, 30 Sep 2026'],
    ]),
    button(76, 262, 120, 'Download receipt'),
    button(204, 262, 120, 'Back to accounts', 'primary'),
  ]),

  'mk-hold': () => svg([
    header('Nova Bank', CUSTOMER_NAV, 'Payments'),
    statusIcon(200, 66, 'hold'),
    t(200, 108, 'We are checking this payment', { size: 14, bold: true, anchor: 'middle' }),
    t(200, 124, '€1,004.50 to Jonas Weber is on hold — nothing has left your account.', { size: 8, fill: '#666', anchor: 'middle' }),
    alert(40, 136, 320, 64, 'amber', 'What happens next', [
      '1. Our fraud team reviews the payment, usually within 2 hours.',
      '2. If it is genuine we release it and notify you in the app.',
      '3. If not, the payment is cancelled and fully refunded.',
    ]),
    table(40, 216, 320, [['', 0], ['', 120]], [
      ['Case reference', 'CASE-88412'],
      ['Status', { badge: 'On hold', tone: 'amber' }],
    ], 16),
    button(40, 270, 150, 'Contact support'),
    button(210, 270, 150, 'Back to accounts', 'primary'),
  ]),

  'mk-treasury': () => svg([
    header('Nova Business', BUSINESS_NAV, 'Dashboard'),
    h1(16, 54, 'Treasury — Acme GmbH'),
    badge(300, 51, '2 batches to approve', 'amber'),
    card(16, 64, 118, 46, 'Operating · EUR', '€1.84M'),
    card(141, 64, 118, 46, 'Payroll · EUR', '€412.5k'),
    card(266, 64, 118, 46, 'USD account', '$286.0k'),
    t(16, 130, 'Cash position — last 14 days', { size: 10, bold: true }),
    r(16, 136, 368, 92, { fill: '#fafafa', stroke: '#ccc' }),
    ...[38, 44, 41, 52, 58, 55, 61, 49, 46, 57, 63, 66, 60, 70].map((v, i) =>
      r(28 + i * 25, 222 - v, 15, v, { fill: i === 13 ? ACCENT : '#ccc' })),
    ln(16, 222, 384, 222, '#999'),
    button(16, 262, 120, 'Download report'),
    button(254, 262, 130, 'Upload bulk file', 'primary'),
  ]),

  'mk-bulk-upload': () => svg([
    header('Nova Business', BUSINESS_NAV, 'Payments'),
    h1(16, 54, 'Upload bulk payments'),
    r(16, 66, 368, 76, { rx: 4, fill: '#fafafa', stroke: '#999', dash: '5 3' }),
    p('M200 80v22m-8-14 8-8 8 8M188 110h24', { stroke: '#666', width: 1.5 }),
    t(200, 126, 'Drop an ISO 20022 pain.001 or CSV file here', { size: 9, anchor: 'middle' }),
    t(200, 137, 'or browse — max. 10,000 payments per file', { size: 7, fill: '#666', anchor: 'middle' }),
    r(16, 150, 368, 26, { rx: 3, stroke: '#ccc' }),
    r(24, 156, 12, 14, { rx: 1, fill: '#ccc' }),
    t(44, 166, 'payroll-2026-09.xml', { size: 9, bold: true }),
    t(154, 166, '248 payments · €240,118.00', { size: 8, fill: '#666' }),
    badge(318, 166, 'Uploaded', 'green'),
    input(16, 190, 176, 'Debit account', 'Payroll · EUR', { select: true }),
    input(208, 190, 176, 'Execution date', '30 Sep 2026'),
    button(16, 262, 100, 'Cancel'),
    button(284, 262, 100, 'Validate file', 'primary'),
  ]),

  'mk-bulk-validate': () => svg([
    header('Nova Business', BUSINESS_NAV, 'Payments'),
    h1(16, 54, 'Validation report — payroll-2026-09'),
    card(16, 64, 118, 42, 'Payments in file', '248'),
    card(141, 64, 118, 42, 'Valid', '245'),
    card(266, 64, 118, 42, 'Errors', '3'),
    alert(16, 114, 368, 30, 'red', '3 lines must be fixed — no payment is released until the batch is valid.', []),
    table(16, 152, 368, [['Line', 0], ['Beneficiary', 36], ['IBAN', 146], ['Error', 256]], [
      ['17', 'M. Keller', 'DE44 5001 …', { text: 'Invalid checksum', fill: '#991b1b' }],
      ['92', 'L. Novak', 'SI56 1910 …', { text: 'Duplicate reference', fill: '#991b1b' }],
      ['203', null, 'FR76 3000 …', { text: 'Amount is zero', fill: '#991b1b' }],
    ]),
    button(16, 262, 120, 'Fix & re-upload'),
    button(234, 262, 150, 'Submit 245 for approval', 'primary'),
  ]),

  'mk-approvals': () => svg([
    header('Nova Business', BUSINESS_NAV, 'Approvals'),
    h1(16, 54, 'Approvals'),
    t(16, 70, 'Batches over €100,000 need a second authorised signatory.', { size: 8, fill: '#666' }),
    table(16, 80, 368, [['Batch', 0], ['Amount', 104], ['Created by', 176], ['Status', 256]], [
      ['payroll-2026-09', '€240,118', 'T. Braun', { badge: 'Needs 2nd signatory', tone: 'amber' }],
      ['suppliers-w39', '€86,420', 'T. Braun', { badge: 'Ready', tone: 'blue' }],
      ['refunds-0926', '€3,910', 'K. Lang', { badge: 'Approved', tone: 'green' }],
    ], 22),
    r(16, 176, 368, 60, { rx: 3, fill: '#fafafa', stroke: '#ccc' }),
    t(26, 192, 'payroll-2026-09 · 245 payments · execution 30 Sep', { size: 9, bold: true }),
    t(26, 206, '1st approval: T. Braun, 28 Sep 10:02', { fill: '#666' }),
    t(26, 220, '2nd approval: required from another signatory', { fill: '#92400e' }),
    button(16, 262, 100, 'Reject', 'danger'),
    button(284, 262, 100, 'Approve', 'primary'),
  ]),

  'mk-case-queue': () => svg([
    header('Nova Back Office', OPS_NAV, 'Cases'),
    h1(16, 54, 'Fraud cases'),
    badge(96, 51, 'Open · 14', 'blue'),
    badge(150, 51, 'SLA breach · 1', 'red'),
    input(264, 38, 120, '', 'Search case, IBAN…'),
    table(16, 68, 368, [['Case', 0], ['Customer', 68], ['Amount', 160], ['Risk', 222], ['SLA', 318]], [
      [{ text: 'CASE-88412', fill: ACCENT }, 'Anna Schmidt', '€1,004.50', { score: 0.91 }, { text: '1h 12m' }],
      [{ text: 'CASE-88409', fill: ACCENT }, 'Pavel Horak', '€7,800.00', { score: 0.87 }, { text: 'overdue', fill: '#991b1b', bold: true }],
      [{ text: 'CASE-88398', fill: ACCENT }, null, '€215.00', { score: 0.72 }, { text: '3h 40m' }],
      [{ text: 'CASE-88390', fill: ACCENT }, 'Lea Martin', '€49.99', { score: 0.64 }, { text: '5h 05m' }],
      [{ text: 'CASE-88377', fill: ACCENT }, null, '€2,300.00', { score: 0.61 }, { text: '6h 30m' }],
    ], 22),
    label(16, 214, 'Sorted by risk score, then SLA. Scores above 0.85 hold the payment automatically.'),
    button(284, 262, 100, 'Open case', 'primary'),
  ]),

  'mk-case-review': () => svg([
    header('Nova Back Office', OPS_NAV, 'Cases'),
    h1(16, 54, 'CASE-88412'),
    badge(106, 51, 'Payment on hold', 'amber'),
    r(16, 64, 176, 112, { rx: 3, fill: '#fafafa', stroke: '#ccc' }),
    t(26, 80, 'Payment', { size: 9, bold: true }),
    ...[['Amount', '€1,004.50 → $1,082.40'], ['Payee', 'Jonas Weber (new)'], ['IBAN', 'US21 CITI …1234'], ['Channel', 'Web · SCA approved'], ['Customer', 'Anna Schmidt']]
      .flatMap(([k, v], i) => [label(26, 96 + i * 16, k), t(76, 96 + i * 16, v)]),
    r(200, 64, 184, 112, { rx: 3, fill: '#fafafa', stroke: '#ccc' }),
    t(210, 80, 'Risk score', { size: 9, bold: true }),
    t(374, 80, '0.91', { size: 11, bold: true, fill: '#991b1b', anchor: 'end' }),
    ...[['New payee', 0.34], ['Unusual amount', 0.28], ['New device', 0.19], ['Foreign IBAN', 0.10]]
      .flatMap(([k, v], i) => [label(210, 98 + i * 18, k), r(290, 92 + i * 18, 80, 6, { rx: 3, fill: '#e5e7eb' }), r(290, 92 + i * 18, Math.round(80 * v / 0.34), 6, { rx: 3, fill: '#991b1b' })]),
    input(16, 190, 368, 'Decision note (recorded in the audit trail)', 'Customer confirmed payee by phone — invoice matches.'),
    button(16, 262, 110, 'View customer'),
    button(152, 262, 110, 'Reject & refund', 'danger'),
    button(274, 262, 110, 'Release payment', 'primary'),
  ]),

  'mk-customer-360': () => svg([
    header('Nova Back Office', OPS_NAV, 'Customers'),
    c(34, 58, 16, { fill: '#e5e7eb' }),
    t(58, 55, 'Anna Schmidt', { size: 13, bold: true }),
    t(58, 68, 'Customer since 2019 · Retail · Berlin', { size: 8, fill: '#666' }),
    badge(248, 56, 'KYC verified', 'green'),
    badge(314, 56, 'AML clear', 'green'),
    t(16, 98, 'Accounts', { size: 10, bold: true }),
    table(16, 104, 180, [['Account', 0], ['Balance', 100]], [
      ['Current', '€4,218.40'],
      ['Savings', '€12,050.00'],
    ]),
    t(212, 98, 'Identity checks', { size: 10, bold: true }),
    table(212, 104, 172, [['Check', 0], ['Result', 100]], [
      ['ID document', { badge: 'Passed', tone: 'green' }],
      ['Sanctions list', { badge: 'No match', tone: 'green' }],
    ]),
    t(16, 178, 'Case history', { size: 10, bold: true }),
    ln(24, 188, 24, 244, '#ccc'),
    ...[['28 Sep', 'CASE-88412 opened — score 0.91', '#92400e'], ['02 Jun', 'CASE-71020 released — false positive', '#166534'], ['14 Jan', 'Onboarded — KYC & AML screening passed', '#166534']]
      .flatMap(([d, s, col], i) => [c(24, 192 + i * 24, 4, { fill: col }), t(36, 195 + i * 24, d, { bold: true }), t(74, 195 + i * 24, s)]),
    button(284, 262, 100, 'Back to case', 'primary'),
  ]),
}

// ── Model content ─────────────────────────────────────────────────────────────

function requirement(id, label, x, y, props) {
  return Object.assign({ id, type: 'requirement', label, x, y, width: 200, height: 80, collapsed: false }, props)
}

function scenario(id, label, x, y, props) {
  return Object.assign({ id, type: 'scenario', label, x, y, width: 200, height: 80, collapsed: false }, props)
}

// Screens sit on a fixed grid inside their flow group, in step order — like
// the Hub blueprints — so a journey reads left to right whatever the layout
// engine would make of its back-edges.
const MOCKUP_W = 220
const MOCKUP_H = 190
const COL_STEP = 320
const ROW_STEP = 250
const PAD_X = 30
const PAD_TOP = 110
const PAD_BOTTOM = 30

function cellOf(flow, index) {
  const id = flow.screens[index][0]
  return (flow.grid && flow.grid[id]) || [index, 0]
}

function mockup(flow, index) {
  const [id, label, screen, description] = flow.screens[index]
  const [col, row] = cellOf(flow, index)
  return {
    id, type: 'mockup', label, description, parentId: flow.id, screen,
    x: PAD_X + col * COL_STEP, y: PAD_TOP + row * ROW_STEP, width: MOCKUP_W, height: MOCKUP_H,
    collapsed: false, wireframe: WIREFRAMES[id](),
  }
}

function group(flow) {
  const cells = flow.screens.map((_, i) => cellOf(flow, i))
  const cols = Math.max(...cells.map(([col]) => col)) + 1
  const rows = Math.max(...cells.map(([, row]) => row)) + 1
  return {
    id: flow.id, type: 'group', label: flow.name, description: flow.description, x: 0, y: 0,
    width: 2 * PAD_X + (cols - 1) * COL_STEP + MOCKUP_W,
    height: PAD_TOP + (rows - 1) * ROW_STEP + MOCKUP_H + PAD_BOTTOM,
    collapsed: false,
  }
}

function gr(id, src, tgt, relationType, label) {
  return { id, sourceId: src, targetId: tgt, relationType, label: label || '', technology: '' }
}

/**
 * The screen flows. `screens` are [id, label, route, description] in step
 * order; `grid` overrides a screen's [col, row] (default: [index, 0]);
 * `nav` are [from, to, trigger] navigates-to edges.
 */
const FLOWS = [
  {
    id: 'flow-customer', name: 'Customer journey — send money abroad',
    description: 'A retail customer sends a cross-border transfer: enter details, review the locked FX quote, approve in the mobile app, then see it sent — or held for a fraud review.',
    screens: [
      ['mk-accounts', 'Accounts Overview', '/accounts', 'Balances and recent activity, read from the immutable ledger — the starting point of every payment.'],
      ['mk-transfer', 'New Transfer', '/payments/new', 'Payee, IBAN (validated as you type), amount and currency. Step 1 of the transfer wizard.'],
      ['mk-review', 'Review & FX Quote', '/payments/:id/review', 'Locked exchange rate, fees and the amount the recipient gets — shown before anything is confirmed.'],
      ['mk-sca', 'Approve in App (SCA)', 'app://sca/challenge', 'Push challenge in the mobile app: the payment is released only after biometric approval on a bound device.'],
      ['mk-done', 'Payment Submitted', '/payments/:id/done', 'Confirmation with reference and expected settlement date, shown within the latency budget.'],
      ['mk-hold', 'Payment On Hold', '/payments/:id/hold', 'Shown when Fraud Detection scores the payment above the threshold — the money has not left the account.'],
    ],
    nav: [
      ['mk-accounts', 'mk-transfer', 'New transfer'],
      ['mk-transfer', 'mk-review', 'Continue'],
      ['mk-review', 'mk-sca', 'Confirm & authorise'],
      ['mk-sca', 'mk-done', 'Approved · risk OK'],
      ['mk-sca', 'mk-hold', 'Approved · risk high'],
      ['mk-done', 'mk-accounts', 'Back to accounts'],
      ['mk-hold', 'mk-accounts', 'Back to accounts'],
    ],
    // the fraud-hold branch goes under the happy-path end state
    grid: { 'mk-hold': [4, 1] },
    presentedBy: { 'mk-sca': 'ctn-mobile' },
    defaultPresenter: 'ctn-web',
  },
  {
    id: 'flow-corporate', name: 'Corporate journey — bulk payroll',
    description: 'A corporate treasurer uploads a payroll file, fixes validation errors and gets the batch through four-eyes approval.',
    screens: [
      ['mk-treasury', 'Treasury Dashboard', '/business', 'Liquidity across accounts, cash-position trend and batches waiting for approval.'],
      ['mk-bulk-upload', 'Bulk Payment Upload', '/business/bulk/new', 'Drop an ISO 20022 pain.001 or CSV file, pick the debit account and execution date.'],
      ['mk-bulk-validate', 'Validation Report', '/business/bulk/:id', 'Every line is validated (IBAN checksum, duplicates, amounts) before anything can be released.'],
      ['mk-approvals', 'Approval Queue', '/business/approvals', 'Four-eyes approval: batches above €100,000 need a second authorised signatory.'],
    ],
    nav: [
      ['mk-treasury', 'mk-bulk-upload', 'Upload bulk file'],
      ['mk-bulk-upload', 'mk-bulk-validate', 'Validate file'],
      ['mk-bulk-validate', 'mk-bulk-upload', 'Fix & re-upload'],
      ['mk-bulk-validate', 'mk-approvals', 'Submit for approval'],
      ['mk-approvals', 'mk-treasury', 'Approve'],
    ],
    presentedBy: {},
    defaultPresenter: 'ctn-web',
  },
  {
    id: 'flow-operator', name: 'Operator journey — fraud case',
    description: 'A bank operator works the fraud queue: opens the riskiest case, checks the customer and releases or rejects the held payment.',
    screens: [
      ['mk-case-queue', 'Fraud Case Queue', '/ops/cases', 'Open cases sorted by risk score and SLA; high scores have already put the payment on hold.'],
      ['mk-case-review', 'Case Review', '/ops/cases/:id', 'Payment details, the signals behind the score and a decision note that goes to the audit trail.'],
      ['mk-customer-360', 'Customer 360', '/ops/customers/:id', 'KYC / AML status, accounts and the customer\'s case history.'],
    ],
    nav: [
      ['mk-case-queue', 'mk-case-review', 'Open case'],
      ['mk-case-review', 'mk-customer-360', 'View customer'],
      ['mk-customer-360', 'mk-case-review', 'Back to case'],
      ['mk-case-review', 'mk-case-queue', 'Release / reject'],
    ],
    presentedBy: {},
    defaultPresenter: 'ctn-backoffice',
  },
]

const REQUIREMENTS = [
  requirement('req-psd2', 'PSD2-compliant payments', 0, 0, {
    ears_type: 'ubiquitous',
    action: 'comply with PSD2 for every payment initiated through a digital channel',
    rationale: 'Operating licence condition in the EU; the child requirements break it down into testable behaviour.',
  }),
  requirement('req-sca', 'Strong customer authentication', 0, 0, {
    ears_type: 'event-driven',
    trigger: 'a customer submits a payment above €30',
    action: 'require strong customer authentication with two independent factors before the payment is released',
    rationale: 'PSD2 RTS on SCA. Approving in the bound mobile app covers possession + inherence.',
  }),
  requirement('req-fx-transparency', 'FX & fee transparency', 0, 0, {
    ears_type: 'optional',
    feature: 'a payment is cross-border or in a foreign currency',
    action: 'show the exchange rate, all fees and the amount the recipient receives before the customer confirms',
    rationale: 'PSD2 / Cross-Border Payments Regulation — no hidden mark-ups.',
  }),
  requirement('req-payment-status', 'Instant payment confirmation', 0, 0, {
    ears_type: 'event-driven',
    trigger: 'a payment is accepted for execution',
    action: 'show a confirmation with the payment reference and expected settlement date within 2 seconds',
    rationale: 'Customers retry payments they are unsure about; duplicate payments are the #1 support topic.',
  }),
  requirement('req-fraud-hold', 'Hold high-risk payments', 0, 0, {
    ears_type: 'unwanted-behaviour',
    unwanted_condition: 'the fraud score of a payment exceeds the risk threshold',
    action: 'hold the payment, tell the customer it is under review and open a fraud case for an operator',
    rationale: 'Authorised push-payment fraud is refundable to the customer — stopping it before settlement is far cheaper.',
  }),
  requirement('req-balance-ledger', 'Balances from the ledger', 0, 0, {
    ears_type: 'ubiquitous',
    action: 'derive every displayed balance and statement from the immutable transaction ledger',
    rationale: 'One source of truth: what the customer sees is what the auditor sees.',
  }),
  requirement('req-bulk-validation', 'Validate bulk files up front', 0, 0, {
    ears_type: 'event-driven',
    trigger: 'a corporate client uploads a bulk payment file',
    action: 'validate every line (IBAN checksum, amount, duplicate reference) and report all errors before any payment in the batch is released',
    rationale: 'Partially executed payroll batches are expensive to unwind.',
  }),
  requirement('req-dual-approval', 'Four-eyes approval', 0, 0, {
    ears_type: 'state-driven',
    precondition: 'a bulk batch totals more than €100,000',
    action: 'require approval by a second authorised signatory before the batch is submitted',
    rationale: 'Corporate mandate rules; also an internal-fraud control.',
  }),
  requirement('req-case-audit', 'Auditable case decisions', 0, 0, {
    ears_type: 'ubiquitous',
    action: 'record every operator decision on a fraud case, with reason and timestamp, in an append-only audit trail',
    rationale: 'Regulators ask why a payment was released; the answer has to be reconstructable years later.',
  }),
  requirement('req-kyc', 'KYC before activation', 0, 0, {
    ears_type: 'event-driven',
    trigger: 'a new customer is onboarded',
    action: 'verify identity and screen against sanctions and AML lists before any account is activated',
    rationale: 'AMLD6 — no account may be used before due diligence is complete.',
  }),
]

const SCENARIOS = [
  scenario('sc-sca-approve', 'Payment approved in the mobile app', 0, 0, {
    given: 'Anna has a verified device bound to her account',
    when: 'she submits a €1,000 transfer to a new payee',
    then: 'a push challenge is sent to her mobile app',
    gherkin: 'And the payment is released only after she approves with Face ID\nBut it is cancelled if the challenge expires after 5 minutes',
  }),
  scenario('sc-fx-quote', 'FX quote shown before confirmation', 0, 0, {
    given: 'Anna holds a EUR current account',
    when: 'she sends 1,000.00 USD-equivalent to a US IBAN',
    then: 'the review step shows the rate 1 EUR = 1.0824 USD, a €4.50 fee and $1,082.40 received',
    gherkin: 'And the quoted rate is locked for 30 seconds',
  }),
  scenario('sc-fraud-hold', 'High-risk payment is held', 0, 0, {
    given: 'the fraud hold threshold is 0.85',
    when: 'a payment is scored 0.91 by Fraud Detection',
    then: 'the payment status is "On hold" and no funds leave the account',
    gherkin: 'And the customer sees the "Payment on hold" screen\nAnd a case appears at the top of the operator queue',
  }),
  scenario('sc-bulk-errors', 'Invalid lines block the batch', 0, 0, {
    given: 'a payroll file with 248 payments, 3 of them invalid',
    when: 'the treasurer uploads it',
    then: 'the validation report lists lines 17, 92 and 203 with their errors',
    gherkin: 'And no payment in the batch is released',
  }),
  scenario('sc-dual-approval', 'Same signatory cannot approve twice', 0, 0, {
    given: 'a €240,118 batch already approved by T. Braun',
    when: 'T. Braun tries to approve it again',
    then: 'the approval is rejected',
    gherkin: 'And the batch stays "Needs 2nd signatory"',
  }),
]

/** Relations of the product layer. */
function productRelations() {
  const rels = []

  // Requirement decomposition (child → parent)
  for (const child of ['req-sca', 'req-fx-transparency', 'req-payment-status']) {
    rels.push(gr(`d-${child}`, child, 'req-psd2', 'derives'))
  }

  // Scenarios verify requirements
  for (const [sc, req] of [
    ['sc-sca-approve', 'req-sca'], ['sc-fx-quote', 'req-fx-transparency'], ['sc-fraud-hold', 'req-fraud-hold'],
    ['sc-bulk-errors', 'req-bulk-validation'], ['sc-dual-approval', 'req-dual-approval'],
  ]) rels.push(gr(`v-${sc}`, sc, req, 'verifies'))

  // Architecture elements satisfy requirements
  for (const [el, req] of [
    ['ctn-auth', 'req-sca'], ['ctn-mobile', 'req-sca'], ['comp-fx', 'req-fx-transparency'],
    ['ctn-payments', 'req-payment-status'], ['ctn-fraud', 'req-fraud-hold'], ['ctn-accounts', 'req-balance-ledger'],
    ['ctn-db-tx', 'req-balance-ledger'], ['comp-validator', 'req-bulk-validation'], ['ctn-payments', 'req-dual-approval'],
    ['ctn-backoffice', 'req-case-audit'], ['ctn-accounts', 'req-kyc'],
  ]) rels.push(gr(`s-${el}-${req}`, el, req, 'satisfies'))

  // Requirements trace to the decisions / fitness functions behind them
  for (const [req, gov] of [
    ['req-sca', 'adr-jwt'], ['req-payment-status', 'ff-latency'], ['req-balance-ledger', 'adr-ledger'],
    ['req-balance-ledger', 'ff-ledger'], ['req-case-audit', 'adr-ledger'], ['req-fraud-hold', 'adr-evt'],
  ]) rels.push(gr(`t-${req}-${gov}`, req, gov, 'traces-to'))

  // Accessibility fitness function constrains every UI
  for (const ui of ['ctn-web', 'ctn-mobile', 'ctn-backoffice']) {
    rels.push(gr(`g-ffA11y-${ui}`, 'ff-a11y', ui, 'constrains', 'WCAG 2.2 AA'))
  }

  // Screens: navigation, who renders them, what they illustrate
  for (const flow of FLOWS) {
    for (const [from, to, trigger] of flow.nav) rels.push(gr(`n-${from}-${to}`, from, to, 'navigates-to', trigger))
    for (const [id] of flow.screens) {
      const presenter = flow.presentedBy[id] || flow.defaultPresenter
      rels.push(gr(`pb-${id}`, id, presenter, 'presented-by'))
    }
  }
  for (const [mk, targets] of Object.entries({
    'mk-accounts': ['req-balance-ledger'],
    'mk-transfer': ['req-psd2'],
    'mk-review': ['req-fx-transparency', 'sc-fx-quote'],
    'mk-sca': ['req-sca', 'sc-sca-approve'],
    'mk-done': ['req-payment-status'],
    'mk-hold': ['req-fraud-hold', 'sc-fraud-hold'],
    'mk-treasury': ['req-balance-ledger'],
    'mk-bulk-upload': ['req-bulk-validation'],
    'mk-bulk-validate': ['req-bulk-validation', 'sc-bulk-errors'],
    'mk-approvals': ['req-dual-approval', 'sc-dual-approval'],
    'mk-case-queue': ['req-fraud-hold'],
    'mk-case-review': ['req-case-audit', 'sc-fraud-hold'],
    'mk-customer-360': ['req-kyc'],
  })) {
    for (const target of targets) rels.push(gr(`i-${mk}-${target}`, mk, target, 'illustrates'))
  }

  return rels
}

/** Nodes of the product layer (mockups sit inside their flow group). */
function productNodes() {
  const nodes = [
    {
      id: 'ff-a11y', type: 'fitness-fn', label: 'FF: WCAG 2.2 AA on every UI',
      description: 'Automated accessibility scan of every screen in CI plus a quarterly manual audit.',
      x: 0, y: 0, width: 180, height: 52, collapsed: false,
      category: 'process', threshold: '0 critical / serious axe violations on any release build',
    },
    ...REQUIREMENTS,
    ...SCENARIOS,
  ]
  for (const flow of FLOWS) {
    nodes.push(group(flow))
    flow.screens.forEach((_, i) => nodes.push(mockup(flow, i)))
  }
  return nodes
}

/** One sequence per screen flow: its navigates-to steps in journey order. */
function productSequences() {
  return FLOWS.map((flow) => ({
    id: `seq-${flow.id}`,
    name: flow.name,
    relationIds: flow.nav.map(([from, to]) => `n-${from}-${to}`),
    stepDescriptions: flow.nav.map(([, to, trigger]) => {
      const screen = flow.screens.find(([id]) => id === to)
      return `${trigger} → ${screen[1]}`
    }),
  }))
}

module.exports = {
  FLOWS,
  WIREFRAMES,
  productNodes,
  productRelations,
  productSequences,
  REQUIREMENT_IDS: REQUIREMENTS.map((n) => n.id),
  SCENARIO_IDS: SCENARIOS.map((n) => n.id),
  MOCKUP_IDS: FLOWS.flatMap((f) => f.screens.map(([id]) => id)),
}
