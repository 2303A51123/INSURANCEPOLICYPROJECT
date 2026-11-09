/**
 * Insurance Policy and Claims Management System
 * Frontend SPA Application Logic
 * Student: PUVATI VAMSHI VARDHAN RAO | Enrolment No: 2303A51123
 */

// Global Application State
let appState = {
  currentRole: 'Admin', // 'Admin', 'Policy Agent', 'Policy Holder', 'Claims Officer'
  currentScreen: 'screen-dashboard',
  products: [],
  users: [],
  policies: [],
  premiums: [],
  claims: [],
  auditLogs: [],
  selectedFile: null,
  charts: {
    claims: null,
    premiums: null
  }
};

// API Base URL
const API_BASE = '/api';

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
  initializeDateFields();
  loadAllData();
  highlightActiveNav('screen-dashboard');
  verifySession();
});

// -------------------------------------------------------------
// LOGIN SESSION (login.html / register.html create the session)
// -------------------------------------------------------------
async function verifySession() {
  let token = null;
  try { token = localStorage.getItem('insursync_token'); } catch (e) { /* ignore */ }
  if (!token) return logout();

  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return logout();
    const { user } = await res.json();

    const nameEl = document.getElementById('authUserName');
    if (nameEl) nameEl.innerText = user.name;

    // Start in the role the user registered with
    const roleSelect = document.getElementById('roleSwitcher');
    if (roleSelect && user.role && user.role !== 'Admin') {
      roleSelect.value = user.role;
      switchRole(user.role, true);
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }
}

function logout() {
  try {
    localStorage.removeItem('insursync_token');
    localStorage.removeItem('insursync_user');
  } catch (e) { /* ignore */ }
  window.location.replace('login.html');
}

function initializeDateFields() {
  const today = new Date().toISOString().split('T')[0];
  const incidentInput = document.getElementById('claimIncidentDate');
  if (incidentInput) incidentInput.value = today;

  const policyStartDate = document.getElementById('issStartDate');
  if (policyStartDate) policyStartDate.value = today;
}

// -------------------------------------------------------------
// DATA LOADING AND API INTEGRATION
// -------------------------------------------------------------
async function loadAllData() {
  try {
    await Promise.all([
      loadDashboardData(),
      loadProducts(),
      loadUsers(),
      loadPolicies(),
      loadPremiums(),
      loadClaims(),
      loadAuditLogs()
    ]);
  } catch (err) {
    showToast('Failed to load initial data: ' + err.message, 'error');
  }
}

async function loadDashboardData() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const stats = await res.json();

    document.getElementById('statActivePolicies').innerText = stats.activePolicies ?? 0;
    document.getElementById('statPremiumCollected').innerText = `₹${(stats.totalPremiumCollected || 0).toLocaleString('en-IN')}`;
    document.getElementById('statPendingClaims').innerText = stats.pendingClaims ?? 0;
    document.getElementById('statSettlementRatio').innerText = `${stats.settlementRatio ?? 0}%`;

    // Render Recent Activities
    const list = document.getElementById('recentActivityList');
    if (list && stats.recentActivity) {
      list.innerHTML = stats.recentActivity.map(act => `
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
          <div class="flex items-center space-x-3">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            <div>
              <p class="font-bold text-slate-800">${act.action} <span class="font-normal text-slate-500">by ${act.user}</span></p>
              <p class="text-slate-500">${act.details}</p>
            </div>
          </div>
          <span class="text-slate-400 mono">${new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      `).join('');
    }

    renderCharts(stats);
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function renderCharts(stats) {
  // Chart 1: Claims Distribution
  const claimsCanvas = document.getElementById('claimsChart');
  if (claimsCanvas) {
    if (appState.charts.claims) appState.charts.claims.destroy();

    const pending = stats.pendingClaims || 0;
    const approved = stats.approvedClaims || 0;
    const settled = stats.settledClaims || 0;
    const rejected = stats.rejectedClaims || 0;

    appState.charts.claims = new Chart(claimsCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Pending Review', 'Approved', 'Settled', 'Rejected'],
        datasets: [{
          data: [pending, approved, settled, rejected],
          backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }

  // Chart 2: Premium Collections vs Outstanding
  const premiumCanvas = document.getElementById('premiumChart');
  if (premiumCanvas) {
    if (appState.charts.premiums) appState.charts.premiums.destroy();

    const collected = stats.totalPremiumCollected || 0;
    const pending = stats.totalPremiumPending || 0;

    appState.charts.premiums = new Chart(premiumCanvas, {
      type: 'bar',
      data: {
        labels: ['Collected Revenue', 'Outstanding / Dues'],
        datasets: [{
          label: 'Amount in ₹',
          data: [collected, pending],
          backgroundColor: ['#10b981', '#f59e0b'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => '₹' + (value / 1000) + 'k'
            }
          }
        }
      }
    });
  }
}

// -------------------------------------------------------------
// USER MANAGEMENT
// -------------------------------------------------------------
async function loadUsers() {
  const res = await fetch(`${API_BASE}/users`);
  appState.users = await res.json();
  renderUsersTable();
  populateDropdowns();
}

function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  tbody.innerHTML = appState.users.map(u => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="px-4 py-3 font-semibold text-slate-800 mono">${u.id}</td>
      <td class="px-4 py-3 font-medium text-slate-900">${u.name}</td>
      <td class="px-4 py-3 text-slate-600">${u.email}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${getRoleBadgeClass(u.role)}">
          ${u.role}
        </span>
      </td>
      <td class="px-4 py-3 text-slate-600 mono">${u.phone || 'N/A'}</td>
      <td class="px-4 py-3 text-slate-600">${u.department || u.address || 'Operations'}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          ${u.status}
        </span>
      </td>
    </tr>
  `).join('');
}

function getRoleBadgeClass(role) {
  switch (role) {
    case 'Admin': return 'badge-admin';
    case 'Policy Agent': return 'badge-agent';
    case 'Policy Holder': return 'badge-holder';
    case 'Claims Officer': return 'badge-claims';
    default: return 'bg-slate-100 text-slate-700';
  }
}

// -------------------------------------------------------------
// INSURANCE PRODUCTS
// -------------------------------------------------------------
async function loadProducts() {
  const res = await fetch(`${API_BASE}/products`);
  appState.products = await res.json();
  renderProductsGrid();
  populateDropdowns();
}

function renderProductsGrid() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  grid.innerHTML = appState.products.map(p => `
    <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative">
      <div class="flex justify-between items-start mb-3">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">${p.category}</span>
          <h3 class="text-lg font-bold text-slate-900 mt-1">${p.name}</h3>
          <span class="text-xs text-slate-400 mono">${p.id}</span>
        </div>
        <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">${p.status}</span>
      </div>
      <p class="text-xs text-slate-600 mb-4 line-clamp-2">${p.description}</p>
      <div class="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs mb-4">
        <div>
          <span class="text-slate-400 block text-[10px] uppercase font-bold">Sum Insured</span>
          <span class="font-bold text-slate-800">₹${p.sumInsured.toLocaleString('en-IN')}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px] uppercase font-bold">Base Premium</span>
          <span class="font-bold text-emerald-600">₹${p.basePremium.toLocaleString('en-IN')}/yr</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px] uppercase font-bold">Deductible</span>
          <span class="font-bold text-slate-800">₹${(p.deductible || 0).toLocaleString('en-IN')}</span>
        </div>
      </div>
      <div class="flex justify-between items-center pt-2 border-t border-slate-100">
        <span class="text-xs text-slate-400">Tenure: ${p.tenureMonths} Months</span>
        <button onclick="quickIssueForProduct('${p.id}')" class="px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold text-xs rounded-lg hover:bg-blue-100">
          Issue Plan →
        </button>
      </div>
    </div>
  `).join('');
}

// -------------------------------------------------------------
// POLICIES AND REGISTRATION
// -------------------------------------------------------------
async function loadPolicies() {
  const res = await fetch(`${API_BASE}/policies`);
  appState.policies = await res.json();
  renderPoliciesTable();
  renderMyPolicies();
  populateDropdowns();
}

function renderPoliciesTable() {
  const tbody = document.getElementById('policiesTableBody');
  if (!tbody) return;

  tbody.innerHTML = appState.policies.map(pol => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="px-4 py-3 font-semibold text-blue-600 mono">${pol.id}</td>
      <td class="px-4 py-3 font-medium text-slate-900">${pol.productName}</td>
      <td class="px-4 py-3 text-slate-700 font-medium">${pol.policyHolderName}</td>
      <td class="px-4 py-3 font-semibold text-slate-800">₹${pol.sumInsured.toLocaleString('en-IN')}</td>
      <td class="px-4 py-3 font-semibold text-emerald-600">₹${pol.annualPremium.toLocaleString('en-IN')}</td>
      <td class="px-4 py-3 text-slate-600 text-xs mono">${pol.endDate}</td>
      <td class="px-4 py-3 text-slate-600 text-xs">${pol.agentName}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(pol.status)}">
          ${pol.status}
        </span>
      </td>
      <td class="px-4 py-3 text-right">
        <button onclick="viewPolicyCertificate('${pol.id}')" class="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200">
          📜 View
        </button>
      </td>
    </tr>
  `).join('');
}

function renderMyPolicies() {
  const grid = document.getElementById('myPoliciesGrid');
  if (!grid) return;

  // Filter for Jamie Customer (the sample policy holder)
  const holderPolicies = appState.policies.filter(p => p.policyHolderId === 'USR-003');

  if (holderPolicies.length === 0) {
    grid.innerHTML = `<div class="col-span-2 p-8 text-center text-slate-400 bg-white rounded-xl border">No active policies found.</div>`;
    return;
  }

  grid.innerHTML = holderPolicies.map(pol => `
    <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div class="flex justify-between items-start mb-2">
        <div>
          <span class="text-xs font-bold text-blue-700 mono bg-blue-50 px-2 py-0.5 rounded">${pol.id}</span>
          <h3 class="text-base font-bold text-slate-900 mt-1">${pol.productName}</h3>
        </div>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusBadgeClass(pol.status)}">${pol.status}</span>
      </div>
      <div class="space-y-1.5 my-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
        <div class="flex justify-between">
          <span class="text-slate-400">Sum Assured:</span>
          <span class="font-bold text-slate-800">₹${pol.sumInsured.toLocaleString('en-IN')}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">Annual Premium:</span>
          <span class="font-bold text-emerald-600">₹${pol.annualPremium.toLocaleString('en-IN')} (${pol.paymentFrequency})</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">Nominee / Beneficiary:</span>
          <span class="font-medium text-slate-800">${pol.nominee || 'Nominee Assigned'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">Coverage Validity:</span>
          <span class="font-medium text-slate-800 mono">${pol.startDate} to ${pol.endDate}</span>
        </div>
      </div>
      <div class="flex justify-between items-center pt-2">
        <button onclick="viewPolicyCertificate('${pol.id}')" class="text-xs font-semibold text-blue-600 hover:underline">
          Download Certificate
        </button>
        <button onclick="navigateTo('screen-submit-claim')" class="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
          File Claim
        </button>
      </div>
    </div>
  `).join('');
}

// -------------------------------------------------------------
// PREMIUMS AND BILLING
// -------------------------------------------------------------
async function loadPremiums() {
  const res = await fetch(`${API_BASE}/premiums`);
  appState.premiums = await res.json();
  renderPremiumsTable();
}

function renderPremiumsTable() {
  const tbody = document.getElementById('premiumsTableBody');
  if (!tbody) return;

  tbody.innerHTML = appState.premiums.map(p => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="px-4 py-3 font-semibold text-slate-800 mono">${p.id}</td>
      <td class="px-4 py-3 text-blue-600 mono">${p.policyId}</td>
      <td class="px-4 py-3 font-medium text-slate-900">${p.policyHolderName}</td>
      <td class="px-4 py-3 font-bold text-slate-800">₹${p.amount.toLocaleString('en-IN')}</td>
      <td class="px-4 py-3 text-slate-600 text-xs mono">${p.dueDate}</td>
      <td class="px-4 py-3 text-slate-600 text-xs">${p.paymentMode || '—'}</td>
      <td class="px-4 py-3 text-slate-500 text-xs mono">${p.transactionRef || '—'}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(p.status)}">
          ${p.status}
        </span>
      </td>
      <td class="px-4 py-3 text-right">
        ${p.status === 'Paid'
          ? `<button onclick="viewReceipt('${p.id}')" class="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100">🧾 Receipt</button>`
          : `<button onclick="openPayModal('${p.id}', '${p.policyId}', '${p.policyHolderName}', ${p.amount})" class="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm">💳 Pay Now</button>`
        }
      </td>
    </tr>
  `).join('');
}

// -------------------------------------------------------------
// CLAIMS MANAGEMENT & WORKBENCH
// -------------------------------------------------------------
async function loadClaims() {
  const res = await fetch(`${API_BASE}/claims`);
  appState.claims = await res.json();
  loadClaimsReviewData();
}

function loadClaimsReviewData() {
  const list = document.getElementById('claimsReviewList');
  if (!list) return;

  const filter = document.getElementById('claimsFilterStatus')?.value;
  let filtered = appState.claims;
  if (filter) {
    filtered = filtered.filter(c => c.status === filter);
  }

  if (filtered.length === 0) {
    list.innerHTML = `<div class="p-8 text-center text-slate-400 bg-white rounded-xl border">No claims matching selected filter.</div>`;
    return;
  }

  list.innerHTML = filtered.map(c => `
    <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <div class="flex items-center space-x-2">
            <span class="font-bold text-slate-900">${c.id}</span>
            <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded mono">${c.policyId}</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${getStatusBadgeClass(c.status)}">${c.status}</span>
          </div>
          <h4 class="font-semibold text-slate-800 text-sm mt-1">${c.incidentType}</h4>
        </div>
        <div class="text-right mt-2 sm:mt-0">
          <span class="text-xs text-slate-400 block">Claimed Amount</span>
          <span class="text-lg font-bold text-slate-900">₹${Number(c.claimAmount).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div class="bg-slate-50 p-3 rounded-lg text-xs space-y-1.5 border border-slate-100">
        <p class="text-slate-700"><strong>Policyholder:</strong> ${c.policyHolderName} | <strong>Incident Date:</strong> <span class="mono">${c.incidentDate}</span></p>
        <p class="text-slate-700"><strong>Hospital / Workshop:</strong> ${c.hospitalName || 'N/A'}</p>
        <p class="text-slate-600"><strong>Narrative:</strong> ${c.description}</p>
        <div class="flex items-center space-x-2 pt-1 border-t border-slate-200">
          <span class="text-slate-500 font-semibold">Attached Evidences:</span>
          ${c.documents && c.documents.length > 0
            ? c.documents.map(d => `<span class="bg-white px-2 py-0.5 rounded border border-slate-200 text-blue-600 mono">📄 ${d.name} (${d.size})</span>`).join(' ')
            : `<span class="text-slate-400">No documents</span>`
          }
        </div>
      </div>

      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 border-t border-slate-100 text-xs">
        <div>
          <span class="text-slate-500">Assigned Officer:</span>
          <span class="font-semibold text-slate-800">${c.assignedOfficerName || 'Unassigned'}</span>
          ${c.settledAmount > 0 ? `<span class="ml-3 text-emerald-700 font-bold">Approved Payout: ₹${c.settledAmount.toLocaleString('en-IN')}</span>` : ''}
        </div>
        <div class="mt-2 sm:mt-0 flex space-x-2">
          ${c.status === 'Submitted'
            ? `<button onclick="assignClaimToOfficer('${c.id}')" class="px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100">📋 Take Up for Review</button>`
            : ''
          }
          ${c.status === 'Under Review' || c.status === 'Submitted'
            ? `<button onclick="openDecisionModal('${c.id}')" class="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm">⚖️ Adjudicate & Settle</button>`
            : `<button onclick="openDecisionModal('${c.id}')" class="px-3 py-1.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200">🔍 View Details</button>`
          }
        </div>
      </div>
    </div>
  `).join('');
}

// -------------------------------------------------------------
// MANDATORY REPORTS GENERATION & CSV EXPORT
// -------------------------------------------------------------
async function loadReports() {
  await Promise.all([
    renderPolicyRegisterReport(),
    renderClaimsStatusReport(),
    renderPremiumCollectionReport(),
    renderClaimSettlementReport()
  ]);
}

async function renderPolicyRegisterReport() {
  const tbody = document.getElementById('repPolicyRegisterBody');
  if (!tbody) return;

  const res = await fetch(`${API_BASE}/reports/policy-register`);
  const json = await res.json();

  tbody.innerHTML = json.data.map(r => `
    <tr class="hover:bg-slate-50">
      <td class="px-4 py-3 font-semibold text-blue-600 mono">${r.policyId}</td>
      <td class="px-4 py-3 font-medium text-slate-900">${r.productName}</td>
      <td class="px-4 py-3 text-slate-800">${r.policyHolder}</td>
      <td class="px-4 py-3 text-slate-600">${r.agent}</td>
      <td class="px-4 py-3 font-semibold text-slate-800">₹${r.sumInsured.toLocaleString('en-IN')}</td>
      <td class="px-4 py-3 text-emerald-600 font-bold">₹${r.premium.toLocaleString('en-IN')}</td>
      <td class="px-4 py-3 text-xs mono text-slate-500">${r.startDate} to ${r.endDate}</td>
      <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(r.status)}">${r.status}</span></td>
    </tr>
  `).join('');
}

async function renderClaimsStatusReport() {
  const tbody = document.getElementById('repClaimsStatusBody');
  if (!tbody) return;

  const res = await fetch(`${API_BASE}/reports/claims-status`);
  const json = await res.json();

  tbody.innerHTML = json.data.map(r => `
    <tr class="hover:bg-slate-50">
      <td class="px-4 py-3 font-semibold text-blue-600 mono">${r.claimId}</td>
      <td class="px-4 py-3 text-slate-600 mono">${r.policyId}</td>
      <td class="px-4 py-3 text-slate-800 font-medium">${r.holder}</td>
      <td class="px-4 py-3 text-xs mono text-slate-500">${r.incidentDate}</td>
      <td class="px-4 py-3 font-bold text-slate-800">₹${r.claimedAmount.toLocaleString('en-IN')}</td>
      <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(r.status)}">${r.status}</span></td>
      <td class="px-4 py-3 text-slate-600">${r.assignedOfficer || 'Unassigned'}</td>
      <td class="px-4 py-3 font-bold text-emerald-600">₹${(r.settledAmount || 0).toLocaleString('en-IN')}</td>
    </tr>
  `).join('');
}

async function renderPremiumCollectionReport() {
  const tbody = document.getElementById('repPremiumCollectionBody');
  if (!tbody) return;

  const res = await fetch(`${API_BASE}/reports/premium-collection`);
  const json = await res.json();

  tbody.innerHTML = json.data.map(r => `
    <tr class="hover:bg-slate-50">
      <td class="px-4 py-3 font-semibold text-slate-800 mono">${r.premiumId}</td>
      <td class="px-4 py-3 text-blue-600 mono">${r.policyId}</td>
      <td class="px-4 py-3 text-slate-800">${r.holder}</td>
      <td class="px-4 py-3 font-bold text-slate-800">₹${r.amount.toLocaleString('en-IN')}</td>
      <td class="px-4 py-3 text-xs mono text-slate-500">${r.dueDate}</td>
      <td class="px-4 py-3 text-slate-600">${r.paymentMode}</td>
      <td class="px-4 py-3 text-slate-500 mono">${r.receiptNumber}</td>
      <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(r.status)}">${r.status}</span></td>
    </tr>
  `).join('');
}

async function renderClaimSettlementReport() {
  const tbody = document.getElementById('repClaimSettlementBody');
  if (!tbody) return;

  const res = await fetch(`${API_BASE}/reports/claim-settlement`);
  const json = await res.json();

  tbody.innerHTML = json.data.map(r => `
    <tr class="hover:bg-slate-50">
      <td class="px-4 py-3 font-semibold text-blue-600 mono">${r.claimId}</td>
      <td class="px-4 py-3 text-slate-600 mono">${r.policyId}</td>
      <td class="px-4 py-3 text-slate-800">${r.holder}</td>
      <td class="px-4 py-3 font-semibold text-slate-800">₹${r.claimedAmount.toLocaleString('en-IN')}</td>
      <td class="px-4 py-3 font-bold text-emerald-600">₹${r.settledAmount.toLocaleString('en-IN')}</td>
      <td class="px-4 py-3 text-xs mono text-slate-500">${r.settlementDate ? new Date(r.settlementDate).toLocaleDateString() : '—'}</td>
      <td class="px-4 py-3 text-slate-600">${r.officer}</td>
      <td class="px-4 py-3 text-slate-500 mono">${r.transactionRef || '—'}</td>
    </tr>
  `).join('');
}

function switchReportTab(tabId) {
  document.querySelectorAll('.report-tab').forEach(b => {
    b.classList.remove('border-blue-600', 'text-blue-600');
    b.classList.add('border-transparent', 'text-slate-500');
  });
  document.getElementById(`tab-${tabId}`).classList.remove('border-transparent', 'text-slate-500');
  document.getElementById(`tab-${tabId}`).classList.add('border-blue-600', 'text-blue-600');

  document.querySelectorAll('.report-view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${tabId}`).classList.remove('hidden');
}

function exportTableToCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;

  let csv = [];
  const rows = table.querySelectorAll('tr');

  for (let i = 0; i < rows.length; i++) {
    const row = [], cols = rows[i].querySelectorAll('td, th');
    for (let j = 0; j < cols.length; j++) {
      let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, '').replace(/(\s\s+)/g, ' ');
      data = data.replace(/"/g, '""');
      row.push('"' + data + '"');
    }
    csv.push(row.join(','));
  }

  const csvFile = new Blob([csv.join('\n')], { type: 'text/csv' });
  const downloadLink = document.createElement('a');
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  showToast(`Exported ${filename} successfully!`, 'success');
}

// -------------------------------------------------------------
// AUDIT LOG
// -------------------------------------------------------------
async function loadAuditLogs() {
  const res = await fetch(`${API_BASE}/audit-logs`);
  appState.auditLogs = await res.json();

  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  tbody.innerHTML = appState.auditLogs.map(l => `
    <tr class="hover:bg-slate-50">
      <td class="px-4 py-2.5 font-bold text-slate-800">${l.id}</td>
      <td class="px-4 py-2.5 text-slate-500">${new Date(l.timestamp).toLocaleString()}</td>
      <td class="px-4 py-2.5 text-blue-700 font-semibold">${l.user}</td>
      <td class="px-4 py-2.5"><span class="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">${l.action}</span></td>
      <td class="px-4 py-2.5 text-slate-600 font-mono">${l.details}</td>
    </tr>
  `).join('');
}

// -------------------------------------------------------------
// FORM HANDLERS & ACTIONS
// -------------------------------------------------------------
async function handleProductSubmit(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('prodName').value,
    category: document.getElementById('prodCategory').value,
    tenureMonths: document.getElementById('prodTenure').value,
    sumInsured: document.getElementById('prodSum').value,
    basePremium: document.getElementById('prodPremium').value,
    description: document.getElementById('prodDesc').value,
    operator: appState.currentRole
  };

  try {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('Product added successfully!', 'success');
      closeModal('modal-add-product');
      document.getElementById('addProductForm').reset();
      loadProducts();
      loadDashboardData();
    }
  } catch (err) {
    showToast('Failed to add product: ' + err.message, 'error');
  }
}

async function handlePolicySubmit(e) {
  e.preventDefault();
  const payload = {
    productId: document.getElementById('issProdSelect').value,
    policyHolderId: document.getElementById('issHolderSelect').value,
    sumInsured: document.getElementById('issSumInsured').value,
    annualPremium: document.getElementById('issPremium').value,
    startDate: document.getElementById('issStartDate').value,
    paymentFrequency: document.getElementById('issFrequency').value,
    nominee: document.getElementById('issNominee').value,
    agentId: 'USR-002',
    agentName: 'Alex Agent'
  };

  try {
    const res = await fetch(`${API_BASE}/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('Policy issued successfully!', 'success');
      closeModal('modal-issue-policy');
      document.getElementById('issuePolicyForm').reset();
      loadPolicies();
      loadPremiums();
      loadDashboardData();
    }
  } catch (err) {
    showToast('Failed to issue policy: ' + err.message, 'error');
  }
}

function handleDocumentSelection(e) {
  const file = e.target.files[0];
  if (file) {
    appState.selectedFile = file;
    document.getElementById('selectedDocName').innerText = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    document.getElementById('selectedDocPreview').classList.remove('hidden');
  }
}

async function handleClaimSubmit(e) {
  e.preventDefault();
  const payload = {
    policyId: document.getElementById('claimPolicySelect').value,
    incidentDate: document.getElementById('claimIncidentDate').value,
    claimAmount: document.getElementById('claimAmount').value,
    incidentType: document.getElementById('claimIncidentType').value,
    hospitalName: document.getElementById('claimHospitalName').value,
    description: document.getElementById('claimDescription').value,
    uploadedDocName: appState.selectedFile ? appState.selectedFile.name : 'Medical_Invoice_Bill.pdf'
  };

  try {
    const res = await fetch(`${API_BASE}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('Claim submitted successfully! It is now in queue for review.', 'success');
      document.getElementById('newClaimForm').reset();
      document.getElementById('selectedDocPreview').classList.add('hidden');
      appState.selectedFile = null;
      loadClaims();
      loadDashboardData();
      navigateTo('screen-claims-review');
    }
  } catch (err) {
    showToast('Failed to submit claim: ' + err.message, 'error');
  }
}

async function assignClaimToOfficer(claimId) {
  try {
    const res = await fetch(`${API_BASE}/claims/${claimId}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        officerId: 'USR-004',
        officerName: 'Casey Officer',
        notes: 'Assigned to Claims Officer Casey Officer for loss verification.'
      })
    });
    if (res.ok) {
      showToast(`Claim ${claimId} assigned to Casey Officer for review.`, 'success');
      loadClaims();
      loadDashboardData();
    }
  } catch (err) {
    showToast('Error assigning claim: ' + err.message, 'error');
  }
}

function openDecisionModal(claimId) {
  const claim = appState.claims.find(c => c.id === claimId);
  if (!claim) return;

  document.getElementById('decModalHiddenClaimId').value = claim.id;
  document.getElementById('decModalClaimId').innerText = claim.id;
  document.getElementById('decModalHolder').innerText = `${claim.policyHolderName} (${claim.policyId})`;
  document.getElementById('decModalIncident').innerText = claim.incidentType;
  document.getElementById('decModalClaimed').innerText = `₹${Number(claim.claimAmount).toLocaleString('en-IN')}`;
  document.getElementById('decModalSettledAmount').value = claim.settledAmount || claim.claimAmount;
  document.getElementById('decModalNotes').value = claim.reviewNotes || '';

  const docNames = claim.documents ? claim.documents.map(d => d.name).join(', ') : 'None attached';
  document.getElementById('decModalDocList').innerText = docNames;

  toggleSettlementAmountField();
  openModal('modal-claim-decision');
}

function toggleSettlementAmountField() {
  const decision = document.getElementById('decModalDecision').value;
  const group = document.getElementById('decSettledAmountGroup');
  if (decision === 'Rejected') {
    group.classList.add('hidden');
  } else {
    group.classList.remove('hidden');
  }
}

async function handleClaimDecisionSubmit(e) {
  e.preventDefault();
  const claimId = document.getElementById('decModalHiddenClaimId').value;
  const decision = document.getElementById('decModalDecision').value;
  const settledAmount = document.getElementById('decModalSettledAmount').value;
  const reviewNotes = document.getElementById('decModalNotes').value;

  try {
    const res = await fetch(`${API_BASE}/claims/${claimId}/decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        settledAmount,
        reviewNotes,
        officerName: 'Casey Officer (Claims Officer)'
      })
    });
    if (res.ok) {
      showToast(`Claim ${claimId} decision recorded: ${decision}`, 'success');
      closeModal('modal-claim-decision');
      loadClaims();
      loadDashboardData();
    }
  } catch (err) {
    showToast('Failed to record decision: ' + err.message, 'error');
  }
}

function openPayModal(scheduleId, policyId, holderName, amount) {
  document.getElementById('payModalHiddenId').value = scheduleId;
  document.getElementById('payModalScheduleId').innerText = scheduleId;
  document.getElementById('payModalPolicyId').innerText = policyId;
  document.getElementById('payModalHolder').innerText = holderName;
  document.getElementById('payModalAmount').innerText = `₹${amount.toLocaleString('en-IN')}`;
  openModal('modal-pay-premium');
}

async function handlePremiumPayment(e) {
  e.preventDefault();
  const scheduleId = document.getElementById('payModalHiddenId').value;
  const paymentMode = document.getElementById('payModalMethod').value;

  try {
    const res = await fetch(`${API_BASE}/premiums/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ premiumId: scheduleId, paymentMode })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Payment successful! Receipt generated.', 'success');
      closeModal('modal-pay-premium');
      loadPremiums();
      loadDashboardData();
      viewReceipt(result.premium.id);
    }
  } catch (err) {
    showToast('Payment failed: ' + err.message, 'error');
  }
}

function viewReceipt(premiumId) {
  const p = appState.premiums.find(pr => pr.id === premiumId);
  if (!p) return;

  const content = document.getElementById('receiptContent');
  content.innerHTML = `
    <div class="border-b border-slate-200 pb-3 flex justify-between items-start">
      <div>
        <h2 class="text-base font-bold text-slate-900">INSURSYNC INSURANCE CO.</h2>
        <p class="text-[11px] text-slate-500">Official Premium Payment Receipt</p>
      </div>
      <div class="text-right">
        <span class="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs">PAID & VERIFIED</span>
        <p class="text-[10px] text-slate-400 mt-1 mono">Date: ${new Date(p.paidDate || Date.now()).toLocaleDateString()}</p>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
      <div>
        <span class="text-slate-400 block text-[10px] uppercase">Receipt No:</span>
        <span class="font-bold text-slate-800 mono">${p.receiptNumber}</span>
      </div>
      <div>
        <span class="text-slate-400 block text-[10px] uppercase">Transaction Ref:</span>
        <span class="font-bold text-slate-800 mono">${p.transactionRef}</span>
      </div>
      <div>
        <span class="text-slate-400 block text-[10px] uppercase">Policy Number:</span>
        <span class="font-bold text-blue-700 mono">${p.policyId}</span>
      </div>
      <div>
        <span class="text-slate-400 block text-[10px] uppercase">Policyholder:</span>
        <span class="font-bold text-slate-800">${p.policyHolderName}</span>
      </div>
    </div>
    <div class="border-t border-b border-slate-200 py-2 flex justify-between font-bold text-sm">
      <span>Total Premium Paid:</span>
      <span class="text-emerald-700">₹${p.amount.toLocaleString('en-IN')}</span>
    </div>
    <p class="text-[10px] text-slate-400 text-center">This is a system generated document. No physical signature required.</p>
  `;
  openModal('modal-receipt');
}

function viewPolicyCertificate(policyId) {
  const p = appState.policies.find(pol => pol.id === policyId);
  if (!p) return;

  const content = document.getElementById('policyCertContent');
  content.innerHTML = `
    <div class="border-b-2 border-blue-600 pb-3 flex justify-between items-start">
      <div>
        <h2 class="text-lg font-bold text-slate-900 tracking-tight">CERTIFICATE OF INSURANCE</h2>
        <p class="text-xs text-blue-700 font-semibold">${p.productName}</p>
      </div>
      <div class="text-right">
        <span class="text-xs bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full font-bold">Policy #${p.id}</span>
      </div>
    </div>
    <div class="space-y-3 pt-2">
      <div class="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded border text-xs">
        <div><span class="text-slate-400 block">Insured Name:</span><strong>${p.policyHolderName}</strong></div>
        <div><span class="text-slate-400 block">Issuing Agent:</span><strong>${p.agentName}</strong></div>
        <div><span class="text-slate-400 block">Sum Insured:</span><strong class="text-blue-700">₹${p.sumInsured.toLocaleString('en-IN')}</strong></div>
        <div><span class="text-slate-400 block">Annual Premium:</span><strong class="text-emerald-700">₹${p.annualPremium.toLocaleString('en-IN')}</strong></div>
        <div><span class="text-slate-400 block">Nominee:</span><strong>${p.nominee || 'Beneficiary'}</strong></div>
        <div><span class="text-slate-400 block">Term Validity:</span><strong class="mono">${p.startDate} to ${p.endDate}</strong></div>
      </div>
      <div class="text-[11px] text-slate-500 p-2 bg-amber-50 border border-amber-200 rounded">
        <strong>Terms & Conditions:</strong> Subject to standard claim adjudication guidelines. Claims must be submitted within 30 days of the incident with official supporting records.
      </div>
    </div>
  `;
  openModal('modal-policy-cert');
}

// -------------------------------------------------------------
// HELPER UTILITIES
// -------------------------------------------------------------
function populateDropdowns() {
  // Populate Product select
  const prodSelect = document.getElementById('issProdSelect');
  if (prodSelect) {
    prodSelect.innerHTML = appState.products.map(p => `
      <option value="${p.id}">${p.name} (₹${p.sumInsured.toLocaleString('en-IN')})</option>
    `).join('');
    autoFillPolicyDefaults();
  }

  // Populate Policy Holder select
  const holderSelect = document.getElementById('issHolderSelect');
  if (holderSelect) {
    const holders = appState.users.filter(u => u.role === 'Policy Holder');
    holderSelect.innerHTML = holders.map(h => `
      <option value="${h.id}">${h.name} (${h.id})</option>
    `).join('');
  }

  // Populate Claim Policy select
  const claimPolicySelect = document.getElementById('claimPolicySelect');
  if (claimPolicySelect) {
    claimPolicySelect.innerHTML = appState.policies.map(p => `
      <option value="${p.id}">${p.id} - ${p.productName} (${p.policyHolderName})</option>
    `).join('');
  }
}

function autoFillPolicyDefaults() {
  const prodId = document.getElementById('issProdSelect')?.value;
  const prod = appState.products.find(p => p.id === prodId);
  if (prod) {
    document.getElementById('issSumInsured').value = prod.sumInsured;
    document.getElementById('issPremium').value = prod.basePremium;
  }
}

function quickIssueForProduct(prodId) {
  navigateTo('screen-policies');
  openModal('modal-issue-policy');
  const sel = document.getElementById('issProdSelect');
  if (sel) {
    sel.value = prodId;
    autoFillPolicyDefaults();
  }
}

function filterPoliciesTable() {
  const q = document.getElementById('policySearchInput').value.toLowerCase();
  const rows = document.querySelectorAll('#policiesTableBody tr');
  rows.forEach(r => {
    const text = r.innerText.toLowerCase();
    r.style.display = text.includes(q) ? '' : 'none';
  });
}

function getStatusBadgeClass(status) {
  if (!status) return 'bg-slate-100 text-slate-600';
  const s = status.toLowerCase();
  if (s.includes('active') || s.includes('settled') || s.includes('paid')) return 'status-active';
  if (s.includes('review') || s.includes('pending')) return 'status-under-review';
  if (s.includes('submitted')) return 'status-submitted';
  if (s.includes('rejected') || s.includes('overdue')) return 'status-rejected';
  if (s.includes('approved')) return 'status-approved';
  return 'bg-slate-100 text-slate-600';
}

// -------------------------------------------------------------
// NAVIGATION & MODALS
// -------------------------------------------------------------
function navigateTo(screenId) {
  document.querySelectorAll('.screen-content').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(screenId);
  if (target) target.classList.remove('hidden');

  highlightActiveNav(screenId);
  appState.currentScreen = screenId;

  // Refresh specific views on entry
  if (screenId === 'screen-reports') loadReports();
  if (screenId === 'screen-claims-review') loadClaimsReviewData();
  if (screenId === 'screen-dashboard') loadDashboardData();
}

function highlightActiveNav(screenId) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('bg-blue-50', 'text-blue-700', 'font-bold');
    btn.classList.add('text-slate-700');
  });
  const activeBtn = document.getElementById(`nav-${screenId}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-blue-50', 'text-blue-700', 'font-bold');
    activeBtn.classList.remove('text-slate-700');
  }
}

function switchRole(role, silent = false) {
  appState.currentRole = role;
  const pill = document.getElementById('currentUserPill');
  if (pill) {
    pill.innerText = role;
    pill.className = `text-xs px-2.5 py-1 rounded-full font-bold ${getRoleBadgeClass(role)}`;
  }

  if (!silent) showToast(`Switched active role to: ${role}`, 'info');

  // Intelligent screen redirection based on active role
  if (role === 'Policy Holder') {
    navigateTo('screen-my-policies');
  } else if (role === 'Claims Officer') {
    navigateTo('screen-claims-review');
  } else if (role === 'Policy Agent') {
    navigateTo('screen-policies');
  } else {
    navigateTo('screen-dashboard');
  }
}

function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('hidden');
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');

  if (!container || !msgEl) return;

  msgEl.innerText = message;
  iconEl.innerText = type === 'success' ? '✅' : (type === 'error' ? '⚠️' : 'ℹ️');

  container.classList.remove('hidden');
  setTimeout(() => {
    container.classList.add('hidden');
  }, 3500);
}
