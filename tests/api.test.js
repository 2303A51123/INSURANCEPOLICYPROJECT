/**
 * Automated Test Suite for Insurance Policy & Claims Management System
 * Course: DevOps & Full Stack (Academic Year: 2026-2027)
 * Student: PUVATI VAMSHI VARDHAN RAO | Enrolment No: 2303A51123
 *
 * In-Process End-to-End API Test Harness
 * Tests all 10 Screens/Capabilities & 4 Mandatory Reports without network binding
 */

process.env.NODE_ENV = 'test';
const { EventEmitter } = require('events');
const { handleRequest, db } = require('../backend/server.js');

// Mock HTTP Request/Response Dispatcher
function dispatchMockRequest(url, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.url = url;
    req.method = method;
    req.headers = { 'content-type': 'application/json' };

    let statusCode = 200;
    let headers = {};
    let responseBody = '';

    const res = {
      writeHead: (code, hdrs) => {
        statusCode = code;
        headers = hdrs || {};
      },
      end: (data) => {
        if (data) responseBody += data;
        let parsed = responseBody;
        try {
          parsed = JSON.parse(responseBody);
        } catch (e) {}
        resolve({ statusCode, headers, body: parsed });
      }
    };

    handleRequest(req, res);

    if (body) {
      req.emit('data', JSON.stringify(body));
    }
    req.emit('end');
  });
}

async function runTests() {
  console.log('=============================================================');
  console.log('  🧪 AUTOMATED TEST SUITE: DevOps & Full Stack Project');
  console.log('  Student: PUVATI VAMSHI VARDHAN RAO | Enrolment: 2303A51123');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // 1. Health & Student Metadata Test
  await test('GET /api/health - Validates system status & student metadata', async () => {
    const res = await dispatchMockRequest('/api/health');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (res.body.student !== 'PUVATI VAMSHI VARDHAN RAO') throw new Error('Student name mismatch');
    if (res.body.enrolmentNo !== '2303A51123') throw new Error('Enrolment mismatch');
    if (res.body.status !== 'UP') throw new Error('System status not UP');
  });

  await test('GET /api/policies?holderId= - Filters policies by holder', async () => {
    const allPolicies = await dispatchMockRequest('/api/policies');
    const holderId = allPolicies.body[0].policyHolderId;
    const res = await dispatchMockRequest(`/api/policies?holderId=${encodeURIComponent(holderId)}`);
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!res.body.length || res.body.some(policy => policy.policyHolderId !== holderId)) {
      throw new Error('Policy holder filter returned incorrect records');
    }
  });

  // 2. Executive Dashboard Stats Test
  await test('GET /api/stats - Returns operational KPIs & chart distributions', async () => {
    const res = await dispatchMockRequest('/api/stats');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (typeof res.body.totalPolicies !== 'number') throw new Error('Invalid totalPolicies');
    if (typeof res.body.totalPremiumCollected !== 'number') throw new Error('Invalid totalPremiumCollected');
    if (typeof res.body.settlementRatio !== 'number') throw new Error('Invalid settlementRatio');
  });

  // 3. Mandatory Report 1: Policy Register Report
  await test('GET /api/reports/policy-register - Verifies Mandatory Report 1', async () => {
    const res = await dispatchMockRequest('/api/reports/policy-register');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (res.body.reportName !== 'Policy Register Report') throw new Error('Report name mismatch');
    if (!Array.isArray(res.body.data) || res.body.data.length === 0) throw new Error('Empty report records');
    const first = res.body.data[0];
    if (!first.policyId || !first.sumInsured || !first.startDate) throw new Error('Missing policy fields');
  });

  // 4. Mandatory Report 2: Claims Status Report
  await test('GET /api/reports/claims-status - Verifies Mandatory Report 2', async () => {
    const res = await dispatchMockRequest('/api/reports/claims-status');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (res.body.reportName !== 'Claims Status Report') throw new Error('Report name mismatch');
    if (!res.body.summary || typeof res.body.summary.Submitted !== 'number') throw new Error('Missing status summary');
    if (!Array.isArray(res.body.data)) throw new Error('Empty claims data');
  });

  // 5. Mandatory Report 3: Premium Collection Report
  await test('GET /api/reports/premium-collection - Verifies Mandatory Report 3', async () => {
    const res = await dispatchMockRequest('/api/reports/premium-collection');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (res.body.reportName !== 'Premium Collection Report') throw new Error('Report name mismatch');
    if (typeof res.body.totalCollected !== 'number') throw new Error('Total collected missing');
    if (typeof res.body.collectionRate !== 'number') throw new Error('Collection rate missing');
  });

  // 6. Mandatory Report 4: Claim Settlement Report
  await test('GET /api/reports/claim-settlement - Verifies Mandatory Report 4', async () => {
    const res = await dispatchMockRequest('/api/reports/claim-settlement');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (res.body.reportName !== 'Claim Settlement Report') throw new Error('Report name mismatch');
    if (!Array.isArray(res.body.data)) throw new Error('Settlement report data missing');
    if (typeof res.body.totalSettled !== 'number') throw new Error('Total settled missing');
  });

  // 7. Policy Issuance Workflow
  await test('POST /api/policies - Issues a new policy and schedules premium', async () => {
    const res = await dispatchMockRequest('/api/policies', 'POST', {
      productId: 'PROD-101',
      policyHolderId: 'USR-003',
      sumInsured: 750000,
      annualPremium: 16000,
      paymentFrequency: 'Annually',
      nominee: 'Ramesh Sharma (Spouse)'
    });
    if (res.statusCode !== 201) throw new Error(`Status ${res.statusCode}`);
    if (!res.body.id.startsWith('POL-')) throw new Error('Invalid policy ID');
  });

  // 8. Claim Filing Workflow
  await test('POST /api/claims - Policyholder submits claim with supporting evidence', async () => {
    const res = await dispatchMockRequest('/api/claims', 'POST', {
      policyId: 'POL-2026-001',
      incidentDate: '2026-05-02',
      claimAmount: 28000,
      incidentType: 'Gallbladder Laparoscopic Surgery',
      description: 'Emergency day admission with ultrasound and biopsy.',
      hospitalName: 'Care Hospital Banjara Hills',
      uploadedDocName: 'Discharge_Bill_Care_2026.pdf'
    });
    if (res.statusCode !== 201) throw new Error(`Status ${res.statusCode}`);
    if (res.body.status !== 'Submitted') throw new Error('Initial status must be Submitted');
  });

  // 9. Premium Payment & Receipt Generation Workflow
  await test('POST /api/premiums/pay - Premium collection & receipt generation', async () => {
    const res = await dispatchMockRequest('/api/premiums/pay', 'POST', {
      premiumId: 'PRM-9004',
      paymentMode: 'Net Banking'
    });
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!res.body.premium.receiptNumber) throw new Error('Receipt number missing');
    if (res.body.premium.status !== 'Paid') throw new Error('Status not Paid');
  });

  // 10. Claims Officer Review & Settlement Workflow
  await test('PUT /api/claims/:id/decision - Claims Officer records settlement decision', async () => {
    const claimId = db.claims[0].id;
    const res = await dispatchMockRequest(`/api/claims/${claimId}/decision`, 'PUT', {
      decision: 'Settled',
      settledAmount: 38000,
      reviewNotes: 'Survey verified. Settlement processed via NEFT.',
      settlementTransactionRef: 'SET-NEFT-991122'
    });
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (res.body.status !== 'Settled') throw new Error('Status should be Settled');
    if (res.body.settledAmount !== 38000) throw new Error('Settled amount mismatch');
  });

  // 11. Authentication: register, login, session check
  await test('POST /api/auth/register + /login - Account lifecycle', async () => {
    const email = `test.${Date.now()}@example.com`;
    const reg = await dispatchMockRequest('/api/auth/register', 'POST', {
      name: 'Test User', email, password: 'secret123', role: 'Policy Holder'
    });
    if (reg.statusCode !== 201) throw new Error(`Register status ${reg.statusCode}`);
    if (!reg.body.token || reg.body.user.email !== email) throw new Error('Register response invalid');
    if (reg.body.user.passwordHash) throw new Error('Password hash leaked to client');

    const dup = await dispatchMockRequest('/api/auth/register', 'POST', {
      name: 'Test User', email, password: 'secret123'
    });
    if (dup.statusCode !== 409) throw new Error('Duplicate email should be rejected');

    const bad = await dispatchMockRequest('/api/auth/login', 'POST', { email, password: 'wrong-pass' });
    if (bad.statusCode !== 401) throw new Error('Wrong password should be rejected');

    const ok = await dispatchMockRequest('/api/auth/login', 'POST', { email, password: 'secret123' });
    if (ok.statusCode !== 200 || !ok.body.token) throw new Error('Valid login failed');
  });

  await test('POST /api/auth/register - Rejects weak password and invalid email', async () => {
    const weak = await dispatchMockRequest('/api/auth/register', 'POST', { name: 'Test', email: 'a@b.co', password: '123' });
    if (weak.statusCode !== 400) throw new Error('Short password should be rejected');
    const badMail = await dispatchMockRequest('/api/auth/register', 'POST', { name: 'Test', email: 'not-an-email', password: 'secret123' });
    if (badMail.statusCode !== 400) throw new Error('Invalid email should be rejected');
  });

  console.log(`\n=============================================================`);
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
