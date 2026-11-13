// The two payment providers behind one interface. Nothing outside the payments
// module reads their configuration or talks to them (R3).
import { ApiError } from '../../errors';

export interface PaymentProvider {
  charge(amountCents: number, orderId: string): Promise<{ chargeId: string; status: 'succeeded' | 'declined' }>;
  refund(chargeId: string, amountCents: number): Promise<void>;
  /** What the provider says it charged and gave back in a period (from inclusive, to exclusive). */
  statement(from: string, to: string): Promise<Statement>;
}
export interface Statement {
  charges: { chargeId: string; amountCents: number; reference: string | null }[];
  refunds: { chargeId: string; amountCents: number }[];
}

const unavailable = () => new ApiError(502, 'payment_provider_unavailable', 'the payment provider is unavailable');

async function post(url: string, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  } catch {
    throw unavailable();
  }
  if (!res.ok) throw unavailable();
  try { return await res.json(); } catch { throw unavailable(); }
}

async function get(url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw unavailable();
  }
  if (!res.ok) throw unavailable();
  try { return await res.json(); } catch { throw unavailable(); }
}
const period = (from: string, to: string) => `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
const list = (v: unknown): any[] => { if (!Array.isArray(v)) throw unavailable(); return v; };

function providerA(base: string): PaymentProvider {
  return {
    async charge(amountCents, orderId) {
      const r = await post(`${base}/charges`, { amountCents, reference: orderId });
      return { chargeId: String(r.chargeId), status: r.status === 'succeeded' ? 'succeeded' : 'declined' };
    },
    async refund(chargeId, amountCents) {
      await post(`${base}/refunds`, { chargeId, amountCents });
    },
    async statement(from, to) {
      const entries = list((await get(`${base}/statement?${period(from, to)}`))?.entries);
      return {
        charges: entries.filter((e) => e.type === 'charge').map((e) => ({ chargeId: String(e.chargeId), amountCents: Number(e.amountCents), reference: e.reference ?? null })),
        refunds: entries.filter((e) => e.type === 'refund').map((e) => ({ chargeId: String(e.chargeId), amountCents: Number(e.amountCents) })),
      };
    },
  };
}

function providerB(base: string): PaymentProvider {
  const amount = (value: number) => ({ value, currency: 'EUR' });
  return {
    async charge(amountCents, orderId) {
      const r = await post(`${base}/v2/payments`, { amount: amount(amountCents), orderRef: orderId });
      return { chargeId: String(r.id), status: r.outcome === 'approved' ? 'succeeded' : 'declined' };
    },
    async refund(chargeId, amountCents) {
      await post(`${base}/v2/payments/${encodeURIComponent(chargeId)}/refunds`, { amount: amount(amountCents) });
    },
    async statement(from, to) {
      const items = list((await get(`${base}/v2/transactions?${period(from, to)}`))?.items);
      return {
        charges: items.filter((e) => e.kind === 'payment').map((e) => ({ chargeId: String(e.id), amountCents: Number(e.amount?.value), reference: e.orderRef ?? null })),
        refunds: items.filter((e) => e.kind === 'refund').map((e) => ({ chargeId: String(e.paymentId), amountCents: Number(e.amount?.value) })),
      };
    },
  };
}

/** Throws on a PAYMENT_PROVIDER other than `a` or `b`, which stops the server at start. */
export function configuredProvider(): PaymentProvider {
  const which = process.env.PAYMENT_PROVIDER ?? 'a';
  const trim = (u: string | undefined) => (u ?? '').replace(/\/+$/, '');
  if (which === 'a') return providerA(trim(process.env.PAYMENT_PROVIDER_URL));
  if (which === 'b') return providerB(trim(process.env.PAYMENT_PROVIDER_B_URL));
  throw new Error(`PAYMENT_PROVIDER must be "a" or "b", got "${which}"`);
}
