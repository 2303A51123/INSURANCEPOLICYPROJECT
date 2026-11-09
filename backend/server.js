/**
 * Insurance Policy and Claims Management System
 * DevOps & Full Stack Course Project (Academic Year: 2026-2027)
 * Student: PUVATI VAMSHI VARDHAN RAO | Enrolment No: 2303A51123
 *
 * Backend Server: Zero external runtime dependencies (Node.js standard library)
 * RESTful API Engine, Static Asset Server, and Real-time Persistence Layer
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');
const PUBLIC_DIR = path.join(__dirname, '..', 'frontend', 'public');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-Memory Database Cache with Persistence
let db = {
  products: [],
  users: [],
  policies: [],
  premiums: [],
  claims: [],
  auditLogs: []
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
      console.log('✅ Database loaded successfully from:', DB_FILE);
    } else {
      console.warn('⚠️ database.json not found, using empty state.');
    }
  } catch (err) {
    console.error('❌ Failed to load database.json:', err.message);
  }
}

function saveDatabase() {
  if (process.env.NODE_ENV === 'test') return;

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Failed to save database.json:', err.message);
  }
}

function addAuditLog(user, action, details) {
  const logEntry = {
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString(),
    user: user || 'System',
    action,
    details
  };
  db.auditLogs.unshift(logEntry);
  if (db.auditLogs.length > 200) db.auditLogs.pop();
  saveDatabase();
}

// Initial DB load
loadDatabase();

// -------------------------------------------------------------
// AUTHENTICATION (login / register) - Node crypto only, no dependencies
// Accounts are stored separately (db.accounts) so the existing
// users / roles data shown in the application is never altered.
// -------------------------------------------------------------
const VALID_ROLES = ['Admin', 'Policy Agent', 'Policy Holder', 'Claims Officer'];
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function ensureAuthStore() {
  if (!Array.isArray(db.accounts)) db.accounts = [];
  if (!db.authSecret) db.authSecret = crypto.randomBytes(32).toString('hex');
}
ensureAuthStore();

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function signToken(account) {
  const payload = Buffer.from(JSON.stringify({
    sub: account.id,
    exp: Date.now() + TOKEN_TTL_MS
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', db.authSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', db.authSecret).update(payload).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return db.accounts.find(acc => acc.id === data.sub) || null;
  } catch (err) {
    return null;
  }
}

function publicAccount(acc) {
  return { id: acc.id, name: acc.name, email: acc.email, role: acc.role };
}

// MIME Types Map
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain'
};

// Helper: send JSON response
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Helper: parse JSON request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

// Server handler logic
async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    // -------------------------------------------------------------
    // REST API ROUTES
    // -------------------------------------------------------------

    // 0. Authentication: register / login / session check
    if (pathname === '/api/auth/register' && method === 'POST') {
      ensureAuthStore();
      const body = await parseBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const role = VALID_ROLES.includes(body.role) ? body.role : 'Policy Holder';

      if (name.length < 2) return sendJSON(res, 400, { error: 'Please enter your full name.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJSON(res, 400, { error: 'Please enter a valid email address.' });
      if (password.length < 6) return sendJSON(res, 400, { error: 'Password must be at least 6 characters.' });
      if (db.accounts.some(a => a.email === email)) return sendJSON(res, 409, { error: 'An account with this email already exists. Please sign in.' });

      const salt = crypto.randomBytes(16).toString('hex');
      const account = {
        id: `ACC-${String(db.accounts.length + 1).padStart(3, '0')}`,
        name,
        email,
        role,
        salt,
        passwordHash: hashPassword(password, salt),
        createdAt: new Date().toISOString()
      };
      db.accounts.push(account);
      addAuditLog(name, 'ACCOUNT_REGISTERED', `New ${role} account registered: ${email}`);
      saveDatabase();
      return sendJSON(res, 201, { token: signToken(account), user: publicAccount(account) });
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      ensureAuthStore();
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const account = db.accounts.find(a => a.email === email);

      let ok = false;
      if (account) {
        const candidate = Buffer.from(hashPassword(password, account.salt), 'hex');
        const stored = Buffer.from(account.passwordHash, 'hex');
        ok = candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
      }
      if (!ok) return sendJSON(res, 401, { error: 'Invalid email or password.' });

      addAuditLog(account.name, 'ACCOUNT_LOGIN', `Signed in as ${account.role}`);
      saveDatabase();
      return sendJSON(res, 200, { token: signToken(account), user: publicAccount(account) });
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const header = req.headers && req.headers['authorization'] || '';
      const account = verifyToken(header.replace(/^Bearer\s+/i, ''));
      if (!account) return sendJSON(res, 401, { error: 'Session expired. Please sign in again.' });
      return sendJSON(res, 200, { user: publicAccount(account) });
    }

    // 1. Health & System Metadata
    if (pathname === '/api/health' || pathname === '/api/status') {
      return sendJSON(res, 200, {
        status: 'UP',
        timestamp: new Date().toISOString(),
        student: 'PUVATI VAMSHI VARDHAN RAO',
        enrolmentNo: '2303A51123',
        project: 'Insurance Policy and Claims Management System',
        academicYear: '2026-2027',
        records: {
          products: db.products.length,
          users: db.users.length,
          policies: db.policies.length,
          premiums: db.premiums.length,
          claims: db.claims.length
        }
      });
    }

    // 2. Executive Dashboard Stats
    if (pathname === '/api/stats' && method === 'GET') {
      const totalPolicies = db.policies.length;
      const activePolicies = db.policies.filter(p => p.status === 'Active').length;
      const pendingRenewalPolicies = db.policies.filter(p => p.status === 'Pending Renewal').length;

      const totalClaims = db.claims.length;
      const pendingClaims = db.claims.filter(c => c.status === 'Submitted' || c.status === 'Under Review').length;
      const approvedClaims = db.claims.filter(c => c.status === 'Approved').length;
      const settledClaims = db.claims.filter(c => c.status === 'Settled').length;
      const rejectedClaims = db.claims.filter(c => c.status === 'Rejected').length;

      const totalClaimAmount = db.claims.reduce((acc, c) => acc + (Number(c.claimAmount) || 0), 0);
      const totalSettledAmount = db.claims.reduce((acc, c) => acc + (Number(c.settledAmount) || 0), 0);

      const totalPremiumCollected = db.premiums
        .filter(p => p.status === 'Paid')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

      const totalPremiumPending = db.premiums
        .filter(p => p.status === 'Pending' || p.status === 'Overdue')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

      const settlementRatio = totalClaims > 0
        ? Math.round((settledClaims / totalClaims) * 100)
        : 0;

      return sendJSON(res, 200, {
        totalPolicies,
        activePolicies,
        pendingRenewalPolicies,
        totalClaims,
        pendingClaims,
        approvedClaims,
        settledClaims,
        rejectedClaims,
        totalClaimAmount,
        totalSettledAmount,
        totalPremiumCollected,
        totalPremiumPending,
        settlementRatio,
        recentActivity: db.auditLogs.slice(0, 6)
      });
    }

    // 3. Products Endpoints
    if (pathname === '/api/products' && method === 'GET') {
      return sendJSON(res, 200, db.products);
    }

    if (pathname === '/api/products' && method === 'POST') {
      const body = await parseBody(req);
      const newProduct = {
        id: `PROD-${Math.floor(100 + Math.random() * 900)}`,
        name: body.name || 'Unnamed Product',
        category: body.category || 'General',
        description: body.description || '',
        sumInsured: Number(body.sumInsured) || 100000,
        basePremium: Number(body.basePremium) || 5000,
        tenureMonths: Number(body.tenureMonths) || 12,
        deductible: Number(body.deductible) || 0,
        status: body.status || 'Active'
      };
      db.products.push(newProduct);
      addAuditLog(body.operator || 'Admin', 'PRODUCT_CREATED', `Added product: ${newProduct.name} (${newProduct.id})`);
      saveDatabase();
      return sendJSON(res, 201, newProduct);
    }

    if (pathname.startsWith('/api/products/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.products = db.products.filter(p => p.id !== id);
      addAuditLog('Admin', 'PRODUCT_DELETED', `Deleted product ID: ${id}`);
      saveDatabase();
      return sendJSON(res, 200, { message: 'Product deleted' });
    }

    // 4. Users Endpoints
    if (pathname === '/api/users' && method === 'GET') {
      return sendJSON(res, 200, db.users);
    }

    if (pathname === '/api/users' && method === 'POST') {
      const body = await parseBody(req);
      const newUser = {
        id: `USR-${String(db.users.length + 1).padStart(3, '0')}`,
        name: body.name,
        email: body.email,
        role: body.role || 'Policy Holder',
        phone: body.phone || '0000000000',
        status: 'Active',
        department: body.department || 'Retail',
        pan: body.pan || ''
      };
      db.users.push(newUser);
      addAuditLog(body.operator || 'Admin', 'USER_CREATED', `Created user ${newUser.name} with role ${newUser.role}`);
      saveDatabase();
      return sendJSON(res, 201, newUser);
    }

    // 5. Policies Endpoints
    if (pathname === '/api/policies' && method === 'GET') {
      const holderId = parsedUrl.searchParams.get('holderId');
      if (holderId) {
        return sendJSON(res, 200, db.policies.filter(p => p.policyHolderId === holderId));
      }
      return sendJSON(res, 200, db.policies);
    }

    if (pathname === '/api/policies' && method === 'POST') {
      const body = await parseBody(req);
      const product = db.products.find(pr => pr.id === body.productId) || { name: 'Custom Policy', sumInsured: 500000 };
      const holder = db.users.find(u => u.id === body.policyHolderId) || { name: body.policyHolderName || 'Customer' };
      const agent = db.users.find(u => u.id === body.agentId) || { name: body.agentName || 'Alex Agent' };

      const newPolicy = {
        id: `POL-2026-${String(db.policies.length + 1).padStart(3, '0')}`,
        productId: body.productId,
        productName: product.name,
        policyHolderId: body.policyHolderId,
        policyHolderName: holder.name,
        agentId: body.agentId || 'USR-002',
        agentName: agent.name,
        sumInsured: Number(body.sumInsured) || product.sumInsured,
        annualPremium: Number(body.annualPremium) || product.basePremium,
        paymentFrequency: body.paymentFrequency || 'Annually',
        startDate: body.startDate || new Date().toISOString().split('T')[0],
        endDate: body.endDate || '2027-01-01',
        status: 'Active',
        nominee: body.nominee || 'Beneficiary',
        vehicleNumber: body.vehicleNumber || null,
        propertyAddress: body.propertyAddress || null,
        createdDate: new Date().toISOString()
      };

      db.policies.push(newPolicy);

      // Auto-generate first premium schedule
      const firstPremium = {
        id: `PRM-${Math.floor(9000 + Math.random() * 999)}`,
        policyId: newPolicy.id,
        policyHolderId: newPolicy.policyHolderId,
        policyHolderName: newPolicy.policyHolderName,
        amount: newPolicy.annualPremium,
        dueDate: newPolicy.startDate,
        paidDate: new Date().toISOString(),
        paymentMode: body.initialPaymentMode || 'Net Banking',
        transactionRef: `TXN-INIT-${Math.floor(100000 + Math.random() * 900000)}`,
        receiptNumber: `REC-2026-${Math.floor(100 + Math.random() * 900)}`,
        status: 'Paid'
      };
      db.premiums.push(firstPremium);

      addAuditLog(newPolicy.agentName, 'POLICY_ISSUED', `Issued policy ${newPolicy.id} (${newPolicy.productName}) to ${newPolicy.policyHolderName}`);
      saveDatabase();
      return sendJSON(res, 201, newPolicy);
    }

    // 6. Premiums Endpoints
    if (pathname === '/api/premiums' && method === 'GET') {
      const policyId = parsedUrl.searchParams.get('policyId');
      const holderId = parsedUrl.searchParams.get('holderId');
      let list = db.premiums;
      if (policyId) list = list.filter(p => p.policyId === policyId);
      if (holderId) list = list.filter(p => p.policyHolderId === holderId);
      return sendJSON(res, 200, list);
    }

    if (pathname === '/api/premiums/pay' && method === 'POST') {
      const body = await parseBody(req);
      const premium = db.premiums.find(p => p.id === body.premiumId);
      if (!premium) {
        return sendJSON(res, 404, { error: 'Premium record not found' });
      }

      premium.status = 'Paid';
      premium.paidDate = new Date().toISOString();
      premium.paymentMode = body.paymentMode || 'Credit Card';
      premium.transactionRef = `TXN-PAY-${Math.floor(100000 + Math.random() * 900000)}`;
      premium.receiptNumber = `REC-2026-${Math.floor(500 + Math.random() * 499)}`;

      addAuditLog(premium.policyHolderName, 'PREMIUM_PAID', `Collected ₹${premium.amount} for ${premium.policyId} via ${premium.paymentMode}`);
      saveDatabase();
      return sendJSON(res, 200, { success: true, premium });
    }

    // 7. Claims Endpoints
    if (pathname === '/api/claims' && method === 'GET') {
      const holderId = parsedUrl.searchParams.get('holderId');
      const status = parsedUrl.searchParams.get('status');
      let list = db.claims;
      if (holderId) list = list.filter(c => c.policyHolderId === holderId);
      if (status) list = list.filter(c => c.status.toLowerCase() === status.toLowerCase());
      return sendJSON(res, 200, list);
    }

    if (pathname === '/api/claims' && method === 'POST') {
      const body = await parseBody(req);
      const policy = db.policies.find(p => p.id === body.policyId) || {};
      const newClaim = {
        id: `CLM-2026-${String(db.claims.length + 1).padStart(3, '0')}`,
        policyId: body.policyId,
        productName: policy.productName || 'Insurance Product',
        policyHolderId: policy.policyHolderId || body.policyHolderId || 'USR-003',
        policyHolderName: policy.policyHolderName || body.policyHolderName || 'Policy Holder',
        incidentDate: body.incidentDate || new Date().toISOString().split('T')[0],
        claimAmount: Number(body.claimAmount) || 10000,
        incidentType: body.incidentType || 'General Incident',
        description: body.description || '',
        hospitalName: body.hospitalName || 'Authorized Service Partner',
        documents: body.documents || [
          {
            name: body.uploadedDocName || 'Claim_Supporting_Document.pdf',
            size: '1.5 MB',
            type: 'application/pdf',
            uploadDate: new Date().toISOString().split('T')[0]
          }
        ],
        status: 'Submitted',
        submissionDate: new Date().toISOString(),
        assignedOfficerId: null,
        assignedOfficerName: 'Unassigned',
        reviewNotes: 'Claim lodged and queued for assessment.',
        settledAmount: 0,
        settlementDate: null,
        settlementTransactionRef: null
      };

      db.claims.push(newClaim);
      addAuditLog(newClaim.policyHolderName, 'CLAIM_SUBMITTED', `Filed claim ${newClaim.id} for ₹${newClaim.claimAmount} under ${newClaim.policyId}`);
      saveDatabase();
      return sendJSON(res, 201, newClaim);
    }

    // Assign claim to officer
    if (pathname.match(/^\/api\/claims\/([^\/]+)\/assign$/) && method === 'PUT') {
      const claimId = pathname.split('/')[3];
      const body = await parseBody(req);
      const claim = db.claims.find(c => c.id === claimId);
      if (!claim) return sendJSON(res, 404, { error: 'Claim not found' });

      claim.assignedOfficerId = body.officerId || 'USR-004';
      claim.assignedOfficerName = body.officerName || 'Casey Officer';
      claim.status = 'Under Review';
      claim.reviewNotes = body.notes || 'Assigned to Claims Officer for review.';

      addAuditLog(claim.assignedOfficerName, 'CLAIM_ASSIGNED', `Assigned ${claim.id} to ${claim.assignedOfficerName}`);
      saveDatabase();
      return sendJSON(res, 200, claim);
    }

    // Review / Settle / Reject claim
    if (pathname.match(/^\/api\/claims\/([^\/]+)\/decision$/) && method === 'PUT') {
      const claimId = pathname.split('/')[3];
      const body = await parseBody(req);
      const claim = db.claims.find(c => c.id === claimId);
      if (!claim) return sendJSON(res, 404, { error: 'Claim not found' });

      claim.status = body.decision; // 'Approved', 'Rejected', 'Settled'
      claim.reviewNotes = body.reviewNotes || claim.reviewNotes;
      claim.assignedOfficerName = body.officerName || claim.assignedOfficerName || 'Casey Officer';

      if (body.decision === 'Settled' || body.decision === 'Approved') {
        claim.settledAmount = Number(body.settledAmount) || Number(claim.claimAmount);
        claim.settlementDate = new Date().toISOString();
        claim.settlementTransactionRef = body.settlementTransactionRef || `SET-NEFT-${Math.floor(100000 + Math.random() * 900000)}`;
      } else if (body.decision === 'Rejected') {
        claim.settledAmount = 0;
        claim.settlementDate = new Date().toISOString();
        claim.settlementTransactionRef = 'N/A';
      }

      addAuditLog(claim.assignedOfficerName, `CLAIM_${body.decision.toUpperCase()}`, `Claim ${claim.id} marked ${body.decision}. Settled: ₹${claim.settledAmount}`);
      saveDatabase();
      return sendJSON(res, 200, claim);
    }

    // 8. MANDATORY REPORTS API ENDPOINTS (As specified in requirement document)
    // Mandatory Report 1: Policy Register Report
    if (pathname === '/api/reports/policy-register' && method === 'GET') {
      const report = db.policies.map(p => ({
        policyId: p.id,
        productName: p.productName,
        policyHolder: p.policyHolderName,
        agent: p.agentName,
        sumInsured: p.sumInsured,
        premium: p.annualPremium,
        frequency: p.paymentFrequency,
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status
      }));
      return sendJSON(res, 200, {
        reportName: 'Policy Register Report',
        generatedAt: new Date().toISOString(),
        totalCount: report.length,
        totalCoverageValue: report.reduce((sum, r) => sum + r.sumInsured, 0),
        data: report
      });
    }

    // Mandatory Report 2: Claims Status Report
    if (pathname === '/api/reports/claims-status' && method === 'GET') {
      const statusSummary = {
        Submitted: 0,
        'Under Review': 0,
        Approved: 0,
        Settled: 0,
        Rejected: 0
      };
      db.claims.forEach(c => {
        if (statusSummary[c.status] !== undefined) statusSummary[c.status]++;
      });

      const report = db.claims.map(c => ({
        claimId: c.id,
        policyId: c.policyId,
        product: c.productName,
        holder: c.policyHolderName,
        incidentDate: c.incidentDate,
        claimedAmount: c.claimAmount,
        status: c.status,
        submissionDate: c.submissionDate,
        assignedOfficer: c.assignedOfficerName,
        settledAmount: c.settledAmount
      }));

      return sendJSON(res, 200, {
        reportName: 'Claims Status Report',
        generatedAt: new Date().toISOString(),
        summary: statusSummary,
        totalClaims: report.length,
        data: report
      });
    }

    // Mandatory Report 3: Premium Collection Report
    if (pathname === '/api/reports/premium-collection' && method === 'GET') {
      const paidPremiums = db.premiums.filter(p => p.status === 'Paid');
      const pendingPremiums = db.premiums.filter(p => p.status === 'Pending' || p.status === 'Overdue');

      const totalCollected = paidPremiums.reduce((sum, p) => sum + p.amount, 0);
      const totalOutstanding = pendingPremiums.reduce((sum, p) => sum + p.amount, 0);

      const report = db.premiums.map(p => ({
        premiumId: p.id,
        policyId: p.policyId,
        holder: p.policyHolderName,
        amount: p.amount,
        dueDate: p.dueDate,
        paidDate: p.paidDate || 'Pending',
        paymentMode: p.paymentMode || 'N/A',
        receiptNumber: p.receiptNumber || 'N/A',
        status: p.status
      }));

      return sendJSON(res, 200, {
        reportName: 'Premium Collection Report',
        generatedAt: new Date().toISOString(),
        totalCollected,
        totalOutstanding,
        collectionRate: Math.round((totalCollected / (totalCollected + totalOutstanding || 1)) * 100),
        data: report
      });
    }

    // Mandatory Report 4: Claim Settlement Report
    if (pathname === '/api/reports/claim-settlement' && method === 'GET') {
      const settledClaims = db.claims.filter(c => c.status === 'Settled' || c.status === 'Approved');
      const totalClaimed = settledClaims.reduce((sum, c) => sum + c.claimAmount, 0);
      const totalSettled = settledClaims.reduce((sum, c) => sum + c.settledAmount, 0);

      const report = settledClaims.map(c => ({
        claimId: c.id,
        policyId: c.policyId,
        holder: c.policyHolderName,
        incidentType: c.incidentType,
        claimedAmount: c.claimAmount,
        settledAmount: c.settledAmount,
        settlementDate: c.settlementDate,
        officer: c.assignedOfficerName,
        transactionRef: c.settlementTransactionRef,
        notes: c.reviewNotes
      }));

      return sendJSON(res, 200, {
        reportName: 'Claim Settlement Report',
        generatedAt: new Date().toISOString(),
        settledCount: settledClaims.length,
        totalClaimed,
        totalSettled,
        savingsFromAdjudication: totalClaimed - totalSettled,
        data: report
      });
    }

    // 9. Audit Logs Endpoint
    if (pathname === '/api/audit-logs' && method === 'GET') {
      return sendJSON(res, 200, db.auditLogs);
    }

    // 10. File Upload Simulation / Mock Handling for claims
    if (pathname === '/api/upload' && method === 'POST') {
      const body = await parseBody(req);
      const filename = body.name || `claim_doc_${Date.now()}.pdf`;
      return sendJSON(res, 200, {
        success: true,
        document: {
          name: filename,
          size: body.size || '1.2 MB',
          type: body.type || 'application/pdf',
          uploadDate: new Date().toISOString().split('T')[0]
        }
      });
    }

    // -------------------------------------------------------------
    // STATIC FILE SERVING FOR FRONTEND
    // -------------------------------------------------------------
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // Normalize path to prevent directory traversal
    filePath = path.normalize(filePath);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Access Denied');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA client-side routing
        const indexFile = path.join(PUBLIC_DIR, 'index.html');
        if (fs.existsSync(indexFile)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          return fs.createReadStream(indexFile).pipe(res);
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

  } catch (error) {
    console.error('Server error:', error);
    sendJSON(res, 500, { error: 'Internal Server Error', message: error.message });
  }
}

// Server instance
const server = http.createServer(handleRequest);

// Only listen if not imported by tests
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=============================================================`);
    console.log(`  🛡️ INSURANCE POLICY & CLAIMS MANAGEMENT SYSTEM`);
    console.log(`  Student: PUVATI VAMSHI VARDHAN RAO | Enrolment: 2303A51123`);
    console.log(`  Course: DevOps & Full Stack (2026-2027)`);
    console.log(`  Server listening on: http://localhost:${PORT}`);
    console.log(`=============================================================`);
  });
}

module.exports = { server, handleRequest, db, loadDatabase, saveDatabase };
