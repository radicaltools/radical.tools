// Fake payment providers A and B, driven by the tests through `state`.
// Each also serves a statement of the money that moved in a period: the
// succeeded charges and the refunds in `state`, by their time `at`.
import http from 'node:http';

const read = (req) => new Promise((resolve) => {
  let s = '';
  req.on('data', (c) => (s += c));
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { resolve({}); } });
});
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const listen = (server) => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));

export async function startProviders() {
  const state = { mode: 'succeed', refundMode: 'succeed', statementMode: 'succeed', charges: [], refunds: [], n: 0 };
  const reset = () => { state.mode = 'succeed'; state.refundMode = 'succeed'; state.statementMode = 'succeed'; state.charges.length = 0; state.refunds.length = 0; };
  const stamp = () => new Date().toISOString();
  // The entries of one provider in a period: from inclusive, to exclusive; a missing bound is open.
  const within = (list, via, url) => {
    const from = url.searchParams.get('from'); const to = url.searchParams.get('to');
    const t = (x) => new Date(x).getTime();
    return list.filter((e) => e.via === via && (!from || t(e.at) >= t(from)) && (!to || t(e.at) < t(to)));
  };

  const a = http.createServer(async (req, res) => {
    const body = await read(req);
    const url = new URL(req.url, 'http://provider');
    if (req.method === 'GET' && url.pathname === '/statement') {
      if (state.statementMode === 'fail') return send(res, 503, { error: 'unavailable' });
      return send(res, 200, { entries: [
        ...within(state.charges, 'a', url).filter((c) => c.status === 'succeed').map((c) => ({ type: 'charge', chargeId: c.chargeId, amountCents: c.amountCents, reference: c.reference, at: c.at })),
        ...within(state.refunds, 'a', url).map((r) => ({ type: 'refund', refundId: r.refundId, chargeId: r.chargeId, amountCents: r.amountCents, at: r.at })),
      ] });
    }
    if (req.method === 'POST' && req.url === '/charges') {
      if (state.mode === 'fail') return send(res, 503, { error: 'unavailable' });
      const chargeId = `ch_${++state.n}`;
      state.charges.push({ via: 'a', chargeId, amountCents: body.amountCents, reference: body.reference, status: state.mode, at: stamp() });
      return send(res, 201, { chargeId, status: state.mode === 'decline' ? 'declined' : 'succeeded' });
    }
    if (req.method === 'POST' && req.url === '/refunds') {
      if (state.refundMode === 'fail') return send(res, 503, { error: 'unavailable' });
      const refundId = `re_${++state.n}`;
      state.refunds.push({ via: 'a', refundId, chargeId: body.chargeId, amountCents: body.amountCents, at: stamp() });
      return send(res, 201, { refundId, status: 'succeeded' });
    }
    send(res, 404, { error: 'not_found' });
  });

  const b = http.createServer(async (req, res) => {
    const body = await read(req);
    const refund = req.url.match(/^\/v2\/payments\/([^/]+)\/refunds$/);
    const url = new URL(req.url, 'http://provider');
    if (req.method === 'GET' && url.pathname === '/v2/transactions') {
      if (state.statementMode === 'fail') return send(res, 503, { error: 'unavailable' });
      const amount = (value) => ({ value, currency: 'EUR' });
      return send(res, 200, { items: [
        ...within(state.charges, 'b', url).filter((c) => c.status === 'succeed').map((c) => ({ kind: 'payment', id: c.chargeId, amount: amount(c.amountCents), orderRef: c.reference, time: c.at })),
        ...within(state.refunds, 'b', url).map((r) => ({ kind: 'refund', id: r.refundId, paymentId: r.chargeId, amount: amount(r.amountCents), time: r.at })),
      ] });
    }
    if (req.method === 'POST' && req.url === '/v2/payments') {
      if (state.mode === 'fail') return send(res, 503, { error: 'unavailable' });
      const id = `pay_${++state.n}`;
      state.charges.push({ via: 'b', chargeId: id, amountCents: body.amount?.value, currency: body.amount?.currency, reference: body.orderRef, status: state.mode, at: stamp() });
      return send(res, 200, { id, outcome: state.mode === 'decline' ? 'refused' : 'approved' });
    }
    if (req.method === 'POST' && refund) {
      if (state.refundMode === 'fail') return send(res, 503, { error: 'unavailable' });
      const id = `rf_${++state.n}`;
      state.refunds.push({ via: 'b', refundId: id, chargeId: refund[1], amountCents: body.amount?.value, currency: body.amount?.currency, at: stamp() });
      return send(res, 200, { id, outcome: 'approved' });
    }
    send(res, 404, { error: 'not_found' });
  });

  const [pa, pb] = [await listen(a), await listen(b)];
  return {
    state, reset,
    urlA: `http://127.0.0.1:${pa}`, urlB: `http://127.0.0.1:${pb}`,
    close: () => { a.close(); b.close(); a.closeAllConnections?.(); b.closeAllConnections?.(); },
  };
}
