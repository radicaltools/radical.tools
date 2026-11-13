import { assert, ok, no, kit } from './helpers.mjs';

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
let n = 0;
const sale = (ctx, percent) => ctx.sys.createPromotion({ name: `Flash sale ${++n}`, kind: 'sale', percent });
const promotions = async (ctx) => ok(await ctx.sys.listPromotions(), 'listPromotions');
// The tests of this suite share one shop: a sale left running by one of them would be on in the next.
async function endSales(ctx) {
  const all = await ctx.sys.listPromotions();
  for (const p of all.ok ? all.value : []) if (p.kind === 'sale' && p.active) await ctx.sys.endPromotion(p.id);
}
// Runs `f` while a sale of that percentage is on, and ends the sale afterwards.
async function during(ctx, percent, f) {
  await endSales(ctx);
  const made = ok(await sale(ctx, percent), 'createPromotion');
  try { return await f(made); } finally { await ctx.sys.endPromotion(made.id); }
}

export const tests = [
  { id: 't30-01 the sale takes 70 % off', tags: ['trap:R8:done'], async run(ctx) {
    const k = kit(ctx); const a = await k.costed(9, 1000, 100); const b = await k.stocked(9, 2000);
    await during(ctx, 70, async (made) => {
      assert.equal(made.kind, 'sale'); assert.equal(made.active, true);
      const o = await k.paid([[a, 2], [b, 1]]);
      assert.equal(o.subtotalCents, 4000); assert.equal(o.promotionDiscountCents, 2800); assert.equal(o.totalCents, 1200);
      assert.equal(await k.charged(o.id), 1200);
    });
  } },
  { id: 't30-02 nothing is sold below its cost in the sale', tags: ['trap:R8:kept', 'R8'], async run(ctx) {
    const k = kit(ctx);
    const goods = [[await k.costed(9, 1000, 600), 2, 600], [await k.costed(9, 1230, 800, 23), 1, 800], [await k.costed(9, 2000, 200), 1, 200]];
    await endSales(ctx);
    // Whatever the system does with the request, no line of an order placed afterwards is below its cost.
    const made = await sale(ctx, 70);
    try {
      const o = await k.shipped(goods.map(([sku, quantity]) => [sku, quantity]));
      const invoice = await k.invoice(o.id);
      for (const [sku, quantity, cost] of goods) {
        const line = invoice.lines.find((l) => l.sku === sku);
        assert.ok(line.totalCents - line.taxCents >= quantity * cost, `R8: ${quantity} units that cost ${quantity * cost} were sold for ${line.totalCents - line.taxCents} without tax`);
      }
      assert.equal(o.promotionDiscountCents, o.subtotalCents - o.totalCents, 'the order does not show what was really taken off');
      assert.equal(await k.charged(o.id), o.totalCents);
    } finally { if (made.ok) await ctx.sys.endPromotion(made.value.id); }
  } },
  { id: 't30-03 the sale is over when it is ended', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    assert.equal((await k.placed([[a, 1]])).totalCents, 1000);
    const made = await during(ctx, 70, async (m) => { assert.equal((await k.placed([[a, 1]])).totalCents, 300); return m; });
    const after = await k.placed([[a, 1]]);
    assert.equal(after.totalCents, 1000); assert.equal(after.promotionDiscountCents, 0);
    assert.equal((await promotions(ctx)).find((p) => p.id === made.id).active, false);
  } },
  { id: 't30-04 the sale counts for every product and every customer', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000); const b = await k.stocked(9, 4000); const c = await k.customer();
    await during(ctx, 70, async () => {
      const fresh = await k.stocked(9, 500);
      const o = await k.placed([[a, 1], [b, 2], [fresh, 2]]);
      assert.equal(o.subtotalCents, 10000); assert.equal(o.promotionDiscountCents, 7000); assert.equal(o.totalCents, 3000);
      const mine = await k.placed([[b, 1]], { customerId: c.id });
      assert.equal(mine.totalCents, 1200); assert.equal(mine.promotionDiscountCents, 2800);
      assert.equal(mine.lines[0].unitPriceCents, 4000);
    });
  } },
  { id: 't30-05 the sale stops at the cost of each line', tags: ['HD-168', 'HD-97', 'R8'], async run(ctx) {
    const k = kit(ctx);
    const taxed = await k.costed(9, 1230, 800, 23); const low = await k.costed(9, 1000, 600); const good = await k.costed(9, 2000, 200); const odd = await k.stocked(9, 999);
    await during(ctx, 70, async () => {
      const t = await k.placed([[taxed, 1]]);
      assert.equal(t.totalCents, 984); assert.equal(t.promotionDiscountCents, 246); assert.equal(t.taxCents, 184);
      const l = await k.placed([[low, 2]]);
      assert.equal(l.totalCents, 1200); assert.equal(l.promotionDiscountCents, 800);
      // A line with a good margin does not pay for one below its cost.
      const mixed = await k.placed([[low, 1], [good, 1]]);
      assert.equal(mixed.totalCents, 600 + 600); assert.equal(mixed.promotionDiscountCents, 400 + 1400);
      // The percentage is worked out per line and rounded down.
      assert.equal((await k.placed([[odd, 1]])).promotionDiscountCents, 699);
      assert.equal((await k.placed([[odd, 3]])).promotionDiscountCents, 2097);
    });
  } },
  { id: 't30-06 no known cost, no floor; a price below cost gets nothing off', tags: ['HD-94', 'HD-99'], async run(ctx) {
    const k = kit(ctx); const unknown = await k.stocked(9, 1000); const cheap = await k.costed(9, 500, 800);
    await during(ctx, 70, async () => {
      assert.equal((await k.placed([[unknown, 2]])).totalCents, 600);
      const o = await k.placed([[cheap, 2]]);
      assert.equal(o.totalCents, 1000); assert.equal(o.promotionDiscountCents, 0);
    });
  } },
  { id: 't30-07 customers of a group get no sale', tags: ['HD-106'], async run(ctx) {
    const k = kit(ctx); const group = await k.group(); const c = await k.member(group.id); const a = await k.stocked(9, 1000); const b = await k.stocked(9, 2000);
    await k.listed(group.id, a, 800);
    await during(ctx, 70, async () => {
      const o = await k.placed([[a, 1], [b, 1]], { customerId: c.id });
      assert.equal(o.totalCents, 2800); assert.equal(o.promotionDiscountCents, 0);
      assert.equal((await k.placed([[a, 1], [b, 1]], { customerEmail: c.email })).totalCents, 900);
    });
  } },
  { id: 't30-08 the other promotions rest while the sale runs', tags: ['HD-169'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(30, 1000); const b = await k.stocked(30, 1000);
    await endSales(ctx);
    ok(await k.multibuy(a, 2, 1), 'createPromotion');
    assert.equal((await k.placed([[a, 3]])).totalCents, 2000);
    await during(ctx, 50, async () => {
      const o = await k.placed([[a, 3]]);
      assert.equal(o.promotionDiscountCents, 1500); assert.equal(o.totalCents, 1500);
      ok(await k.multibuy(b, 1, 1), 'a promotion made while the sale runs');
      assert.equal((await k.placed([[b, 2]])).totalCents, 1000);
    });
    assert.equal((await k.placed([[a, 3]])).totalCents, 2000);
    assert.equal((await k.placed([[b, 2]])).totalCents, 1000);
    assert.equal((await k.placed([[b, 1]])).totalCents, 1000);
  } },
  { id: 't30-09 codes and points during the sale', tags: ['HD-108', 'HD-96'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.costed(9, 1000, 400); const twenty = await k.discount(20);
    await during(ctx, 50, async () => {
      const o = await k.placed([[a, 1]], { discountCode: twenty });
      assert.equal(o.discountCode, twenty); assert.equal(o.discountCents, 0); assert.equal(o.totalCents, 500);
      // 5.00 are left and the goods cost 4.00: points can pay for 1.00 of it.
      no(await k.order([[a, 1]], { customerId: c.id, pointsToSpend: 21 }), 'points that take the line below its cost');
      const p = await k.placed([[a, 1]], { customerId: c.id, pointsToSpend: 20 });
      assert.equal(p.totalCents, 400); assert.equal(p.promotionDiscountCents, 500);
    });
  } },
  { id: 't30-10 what is refused when a sale is made', tags: ['HD-170'], async run(ctx) {
    await endSales(ctx);
    for (const percent of [0, 91, 12.5, -70]) no(await sale(ctx, percent), `a sale of ${percent} %`);
    no(await ctx.sys.createPromotion({ name: '', kind: 'sale', percent: 30 }), 'a sale without a name');
    assert.ok(!(await promotions(ctx)).some((p) => p.kind === 'sale' && p.active), 'a refused sale is running');
    const first = await during(ctx, 30, async (made) => {
      no(await sale(ctx, 40), 'a second sale while one runs');
      return made;
    });
    await during(ctx, 90, async (second) => { assert.notEqual(second.id, first.id); });
    const all = await promotions(ctx);
    assert.equal(all.find((p) => p.id === first.id).active, false);
  } },
  { id: 't30-11 the tax of an order in the sale', tags: ['R7'], async run(ctx) {
    const k = kit(ctx); const [a, b, d] = [await k.taxed(9, 1999, 23), await k.taxed(9, 333, 5), await k.stocked(9, 777)];
    await during(ctx, 70, async () => {
      const o = await k.shipped([[a, 2], [b, 3], [d, 1]]);
      assert.equal(sum(o.lines, (l) => l.taxCents), o.taxCents, 'R7: the tax of the order is not the sum of its lines');
      const invoice = await k.invoice(o.id);
      assert.equal(sum(invoice.lines, (l) => l.totalCents), invoice.totalCents, 'R7: the lines do not add up to the invoice');
      assert.equal(sum(invoice.lines, (l) => l.taxCents), invoice.taxCents);
      for (const l of invoice.lines) assert.ok(Number.isInteger(l.totalCents) && Number.isInteger(l.taxCents), 'R7: a line holds a part of a cent');
      assert.equal(invoice.totalCents, o.totalCents); assert.equal(await k.charged(o.id), o.totalCents);
      assert.ok(o.totalCents < o.subtotalCents);
    });
  } },
  { id: 't30-12 an order placed in the sale keeps what it got', tags: ['HD-104'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    const o = await during(ctx, 70, async () => k.placed([[a, 2]]));
    assert.equal(o.totalCents, 600);
    const later = await k.getOrder(o.id);
    assert.equal(later.totalCents, 600); assert.equal(later.promotionDiscountCents, 1400);
    ctx.provider.mode = 'succeed';
    ok(await k.pay(o.id), 'payOrder');
    assert.equal(await k.charged(o.id), 600);
  } },
];
