/**
 * End-to-end smoke against local Nest with perf endpoints.
 * Uses demo society admin credentials from seed if available via env, else prints failures.
 */
const BASE = process.env.API_BASE || 'http://localhost:4000/api/v1';

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

(async () => {
  const health = await req('GET', '/health');
  console.log('health', health.status, health.data);

  // Try common admin login shapes used by SocietyOne
  const loginAttempts = [
    { email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD },
    { email: 'admin@societyone.test', password: 'Admin@123' },
    { email: 'admin@demo.societyone', password: 'password123' },
  ].filter((x) => x.email && x.password);

  let token = null;
  let user = null;
  for (const creds of loginAttempts) {
    // Admin email login path
    let r = await req('POST', '/auth/login', {
      email: creds.email,
      password: creds.password,
    });
    if (r.status >= 400) {
      r = await req('POST', '/auth/admin/login', creds);
    }
    console.log('login try', creds.email, r.status);
    if (r.status < 400 && (r.data.accessToken || r.data.access_token)) {
      token = r.data.accessToken || r.data.access_token;
      user = r.data.user;
      break;
    }
  }

  if (!token) {
    console.log('NO_TOKEN — cannot auth smoke; check login paths');
    process.exit(2);
  }

  const societyId = user?.societyId || process.env.SMOKE_SOCIETY_ID;
  console.log('auth ok', { role: user?.role, societyId });

  const checks = [
    ['GET', '/dashboard'],
    ['GET', `/reports/monthly-series?societyId=${societyId}&limit=6`],
    ['GET', `/reports/collection?societyId=${societyId}`],
    ['GET', `/invoices?limit=20`],
    ['GET', `/invoices?limit=5&cursor=`],
    ['GET', `/members?societyId=${societyId}&limit=20`],
    ['GET', `/visitors?societyId=${societyId}&limit=20`],
    ['GET', `/receipts?limit=20`],
  ];

  for (const [method, path] of checks) {
    const r = await req(method, path, null, token);
    const summary =
      r.data && typeof r.data === 'object'
        ? {
            keys: Object.keys(r.data).slice(0, 8),
            source: r.data.source,
            outstandingTotal: r.data.outstandingTotal,
            seriesLen: r.data.series?.length,
            rows: Array.isArray(r.data) ? r.data.length : r.data.data?.length,
            meta: r.data.meta,
          }
        : r.data;
    console.log(method, path, '→', r.status, JSON.stringify(summary));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
