// What an adapter gets to talk to the system: plain HTTP and one way to
// turn an HTTP answer into the result every adapter function returns.
export function makeHttp(base) {
  const request = async (method, path, body, headers = {}) => {
    const r = await fetch(base + path, {
      method,
      headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: r.status, body: json };
  };
  const reasonOf = (status) => (status === 404 ? 'not_found' : status >= 500 ? 'unavailable' : 'rejected');
  return {
    request,
    // 2xx → { ok: true, value: map(body) }; 404 → not_found; 5xx → unavailable; anything else → rejected
    result: (res, map = (b) => b) => (res.status >= 200 && res.status < 300 ? { ok: true, value: map(res.body) } : { ok: false, reason: reasonOf(res.status) }),
    unsupported: () => ({ ok: false, reason: 'unsupported' }),
  };
}
