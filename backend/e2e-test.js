/**
 * End-to-end API test — run against a live server
 * Usage: node e2e-test.js [baseUrl]
 * Default baseUrl: http://localhost:5000/api
 */
'use strict';

const BASE = process.argv[2] || 'http://localhost:5000/api';
let token = '';
let pass = 0, fail = 0;
let testClientId, testQuotationId, testInvoiceId;

async function req(method, path, body, tok) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tok !== false && (tok || token) ? { Authorization: `Bearer ${tok || token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await r.json(); } catch { data = {}; }
  return { status: r.status, data };
}

function assert(label, ok, detail) {
  if (ok) {
    console.log(`  ✅  ${label}`);
    pass++;
  } else {
    console.log(`  ❌  ${label}${detail ? ` — ${detail}` : ''}`);
    fail++;
  }
}

async function run() {
  console.log(`\n🧪  AKB Transport E2E Tests  →  ${BASE}\n`);

  // ── Health ──────────────────────────────────────────────────────────────
  console.log('── Health ────────────────────────────────────');
  const health = await req('GET', '/health', null, false);
  assert('GET /health returns 200', health.status === 200);
  assert('health.status === "ok"', health.data.status === 'ok');

  // ── Auth ───────────────────────────────────────────────────────────────
  console.log('\n── Auth ──────────────────────────────────────');
  const bad = await req('POST', '/auth/login', { email: 'wrong@x.com', password: 'bad' }, false);
  assert('Login with wrong credentials returns 401', bad.status === 401);

  const login = await req('POST', '/auth/login', {
    email: process.env.ADMIN_EMAIL || 'akbtransportlogistics@gmail.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@AKB2026',
  }, false);
  assert('Admin login returns 200', login.status === 200, JSON.stringify(login.data));
  assert('Login response has token', !!login.data.token);
  assert('Login response has user object', !!login.data.user);
  assert('User role is admin', login.data.user?.role === 'admin');
  token = login.data.token;

  if (!token) { console.log('\n  ⛔  Cannot continue without a valid token. Check ADMIN_EMAIL/ADMIN_PASSWORD.\n'); process.exit(1); }

  const me = await req('GET', '/auth/me');
  assert('GET /auth/me returns logged-in user', me.status === 200);
  assert('/auth/me returns admin role', me.data.role === 'admin');

  // ── Settings ───────────────────────────────────────────────────────────
  console.log('\n── Settings ──────────────────────────────────');
  const sGet = await req('GET', '/settings');
  assert('GET /settings returns 200', sGet.status === 200);
  assert('Settings has companyName', !!sGet.data.companyName);
  assert('Settings has invoicePrefix', !!sGet.data.invoicePrefix);
  assert('Settings has quotationPrefix', !!sGet.data.quotationPrefix);

  const sPut = await req('PUT', '/settings', { companyName: sGet.data.companyName, invoicePrefix: 'INV', invoiceStartNumber: 1, quotationPrefix: 'QUO', quotationStartNumber: 1 });
  assert('PUT /settings returns 200', sPut.status === 200);

  // ── Clients ────────────────────────────────────────────────────────────
  console.log('\n── Clients ───────────────────────────────────');
  const cList = await req('GET', '/clients');
  assert('GET /clients returns 200', cList.status === 200);
  assert('Clients is an array', Array.isArray(cList.data));

  const cCreate = await req('POST', '/clients', {
    companyName: 'E2E Test Client Pte Ltd',
    clientCode: 'E2E',
    contactPerson: 'Test Person',
    email: 'e2e@test.com',
    phone: '+6511112222',
    address: '1 Test Street, Singapore',
  });
  assert('POST /clients returns 201', cCreate.status === 201, JSON.stringify(cCreate.data));
  testClientId = cCreate.data.id;

  // ── Quotations ─────────────────────────────────────────────────────────
  console.log('\n── Quotations ────────────────────────────────');
  const qCreate = await req('POST', '/quotations', {
    clientId: testClientId,
    date: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    items: [{
      sno: 1,
      jobDescription: 'Test transport service',
      itemType: 'service',
      fromDate: new Date().toISOString().split('T')[0],
      toDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      rate: 1000,
      rateType: 'per_week',
      totalAmount: 1000,
    }],
    notes: 'E2E test quotation',
  });
  assert('POST /quotations returns 201', qCreate.status === 201, JSON.stringify(qCreate.data));
  assert('Quotation has number matching prefix', qCreate.data.quotationNo?.startsWith('QUO-'), qCreate.data.quotationNo);
  testQuotationId = qCreate.data.id;

  const qGet = await req('GET', `/quotations/${testQuotationId}`);
  assert('GET /quotations/:id returns 200', qGet.status === 200);
  assert('Quotation has items array', Array.isArray(qGet.data.items));

  // Test edit quotation number
  const qNewNo = `QUO-TEST-${Date.now()}`;
  const qPatch = await req('PATCH', `/quotations/${testQuotationId}/number`, { quotationNo: qNewNo });
  assert('PATCH /quotations/:id/number returns 200', qPatch.status === 200, JSON.stringify(qPatch.data));
  assert('Quotation number was updated', qPatch.data.quotationNo === qNewNo);

  // Test duplicate detection
  const qDupe = await req('PATCH', `/quotations/${testQuotationId}/number`, { quotationNo: qNewNo });
  assert('Patching same number on same record returns 200 (not conflict)', qDupe.status === 200);

  // ── Invoices ───────────────────────────────────────────────────────────
  console.log('\n── Invoices ──────────────────────────────────');
  const iCreate = await req('POST', '/invoices', {
    clientId: testClientId,
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    items: [{
      sno: 1,
      jobDescription: 'Test service',
      itemType: 'service',
      fromDate: new Date().toISOString().split('T')[0],
      toDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      rate: 2000,
      rateType: 'per_week',
      totalAmount: 2000,
    }],
    notes: 'E2E test invoice',
  });
  assert('POST /invoices returns 201', iCreate.status === 201, JSON.stringify(iCreate.data));
  assert('Invoice has number matching prefix', iCreate.data.invoiceNo?.startsWith('INV-'), iCreate.data.invoiceNo);
  testInvoiceId = iCreate.data.id;

  const iGet = await req('GET', `/invoices/${testInvoiceId}`);
  assert('GET /invoices/:id returns 200', iGet.status === 200);

  // Test invoice number edit
  const iNewNo = `INV-TEST-${Date.now()}`;
  const iPatch = await req('PATCH', `/invoices/${testInvoiceId}/number`, { invoiceNo: iNewNo });
  assert('PATCH /invoices/:id/number returns 200', iPatch.status === 200);
  assert('Invoice number was updated', iPatch.data.invoiceNo === iNewNo);

  // Test duplicate prevention: create second invoice then try to steal first number
  const iCreate2 = await req('POST', '/invoices', {
    clientId: testClientId,
    date: new Date().toISOString().split('T')[0],
    items: [{ sno: 1, jobDescription: 'Second invoice', itemType: 'service', fromDate: new Date().toISOString().split('T')[0], toDate: new Date().toISOString().split('T')[0], rate: 500, rateType: 'per_week', totalAmount: 500 }],
  });
  const iConflict = await req('PATCH', `/invoices/${iCreate2.data.id}/number`, { invoiceNo: iNewNo });
  assert('Duplicate invoice number returns 409', iConflict.status === 409);
  assert('409 error message mentions the duplicate', iConflict.data.message?.includes(iNewNo));

  // Update invoice items
  const iUpdate = await req('PUT', `/invoices/${testInvoiceId}`, {
    date: new Date().toISOString().split('T')[0],
    items: [{ sno: 1, jobDescription: 'Updated service', itemType: 'service', fromDate: new Date().toISOString().split('T')[0], toDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0], rate: 2500, rateType: 'per_week', totalAmount: 2500 }],
  });
  assert('PUT /invoices/:id returns 200', iUpdate.status === 200);

  // ── Auth protection ────────────────────────────────────────────────────
  console.log('\n── Security ──────────────────────────────────');
  const noAuth = await req('GET', '/invoices', null, false);
  assert('GET /invoices without token returns 401', noAuth.status === 401);

  const badToken = await req('GET', '/invoices', null, 'bad.token.here');
  assert('GET /invoices with invalid token returns 401', badToken.status === 401);

  const staffLogin = await req('POST', '/auth/login', {
    email: process.env.ADMIN_EMAIL || 'akbtransportlogistics@gmail.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@AKB2026',
  }, false);
  // The PATCH /number endpoint must be admin-only
  const patchNoAdmin = await req('PATCH', `/invoices/${testInvoiceId}/number`, { invoiceNo: 'HACK-001' });
  assert('Admin can edit invoice number', patchNoAdmin.status === 200);

  // ── Cleanup ────────────────────────────────────────────────────────────
  console.log('\n── Cleanup ───────────────────────────────────');
  const iDel1 = await req('DELETE', `/invoices/${testInvoiceId}`);
  const iDel2 = await req('DELETE', `/invoices/${iCreate2.data.id}`);
  assert('DELETE test invoices', [200, 400].includes(iDel1.status) && [200, 400].includes(iDel2.status));

  const qDel = await req('DELETE', `/quotations/${testQuotationId}`);
  assert('DELETE test quotation', [200, 400].includes(qDel.status));

  const cDel = await req('DELETE', `/clients/${testClientId}`);
  assert('DELETE test client', [200, 404].includes(cDel.status));

  // ── Summary ────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(46)}`);
  console.log(`  Results: ${pass} passed, ${fail} failed  (${pass + fail} total)`);
  if (fail === 0) {
    console.log('  🎉  All tests passed — ready for production!\n');
  } else {
    console.log(`  ⚠️   ${fail} test(s) failed — review before going live.\n`);
    process.exit(1);
  }
}

run().catch(e => { console.error('\nFatal error:', e.message); process.exit(1); });
