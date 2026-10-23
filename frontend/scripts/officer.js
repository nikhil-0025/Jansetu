// JanSetu Government Officer Portal Client Logic

let officerDashboardData = null;
let activeSeparationForReview = null;
let activeAppForReview = null;

document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();

  const token = api.getToken();
  const user = api.getUser();

  if (!token || !user) {
    window.location.href = '/login.html?portal=officer';
    return;
  }

  if (!['officer', 'admin'].includes(user.role)) {
    window.location.href = '/dashboard.html';
    return;
  }

  document.getElementById('headerOfficerName').textContent = `${user.officerName || 'Verification Officer'} (${user.userId})`;

  await refreshOfficerData();
});

// Full Refresh of Officer Data
async function refreshOfficerData() {
  try {
    const [dashRes, sepRes, dupRes, appsRes, docsRes, corrRes, auditRes, signupsRes] = await Promise.all([
      api.getOfficerDashboard(),
      api.getSeparationRequests(),
      api.getDuplicateClaims(),
      api.getApplications(),
      api.getDocuments(),
      api.getProfileCorrections(),
      api.getAuditLogs(),
      api.getPendingRegistrations().catch(() => ({ registrations: [] }))
    ]);

    officerDashboardData = {
      metrics: dashRes.metrics,
      separations: sepRes.requests,
      duplicates: dupRes.duplicateClaims,
      applications: appsRes.applications,
      documents: docsRes.documents,
      corrections: corrRes.corrections,
      auditLogs: auditRes.auditLogs,
      signups: (signupsRes && signupsRes.registrations) || []
    };

    updateKPICounters();
    renderSeparationQueue();
    renderDuplicateQueue();
    renderApplicationsQueue();
    renderDocumentsQueue();
    renderCorrectionsQueue();
    renderSignupsQueue();
    renderAuditLogs();

    lucide.createIcons();
  } catch (err) {
    console.error('Failed to load officer data:', err);
    showToast('Failed to load verification queues: ' + err.message, 'error');
  }
}

// Update Top Metric Counters
function updateKPICounters() {
  const m = officerDashboardData.metrics || {};
  document.getElementById('kpiHouseholds').textContent = m.totalHouseholds || 1;
  document.getElementById('kpiCitizens').textContent = m.totalCitizens || 4;
  document.getElementById('kpiSeparations').textContent = m.pendingSeparations || 0;
  document.getElementById('kpiDuplicates').textContent = m.duplicateAlerts || 0;
  document.getElementById('kpiPendingApps').textContent = m.pendingApplications || 0;
  document.getElementById('kpiPendingDocs').textContent = m.pendingDocuments || 0;

  // Tab counters
  document.getElementById('countSepTab').textContent = m.pendingSeparations || 0;
  document.getElementById('countDupTab').textContent = m.duplicateAlerts || 0;
  document.getElementById('countAppsTab').textContent = m.pendingApplications || 0;
  document.getElementById('countDocsTab').textContent = m.pendingDocuments || 0;
  document.getElementById('countCorrTab').textContent = m.pendingCorrections || 0;
  const signupsTabEl = document.getElementById('countSignupsTab');
  if (signupsTabEl) signupsTabEl.textContent = (officerDashboardData.signups || []).length;
}

// Render Separation Queue (Core Feature)
function renderSeparationQueue() {
  const container = document.getElementById('separationQueueContainer');
  if (!container) return;

  const seps = officerDashboardData.separations || [];

  if (seps.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <i data-lucide="check-circle" style="width: 36px; height: 36px; color: var(--success-text); margin-bottom: 8px;"></i>
        <p>No household separation requests currently pending review.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = seps.map(s => {
    const isPending = s.status === 'Pending Verification';
    const movingNames = s.movingMembers ? s.movingMembers.map(m => m.name).join(', ') : s.movingCitizenIds.join(', ');

    return `
      <div class="card" style="padding: 20px; margin-bottom: 16px; border-left: 5px solid ${isPending ? '#ea580c' : (s.status === 'Approved' ? '#16a34a' : '#ef4444')};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
          <div>
            <span class="badge ${isPending ? 'badge-warning' : (s.status === 'Approved' ? 'badge-verified' : 'badge-danger')}">
              ${s.status}
            </span>
            <strong style="color: var(--primary); font-size: 1.05rem; margin-left: 8px;">Request ID: ${s.requestId}</strong>
          </div>
          <div>
            ${isPending ? `
              <button onclick="openSeparationReviewModal('${s.requestId}')" class="btn btn-saffron btn-sm">
                <i data-lucide="check-square"></i> Review & Render Decision
              </button>
            ` : `
              <span style="font-size:0.8rem; color:var(--text-muted);">Reviewed: ${s.officerReview?.decision}</span>
            `}
          </div>
        </div>

        <!-- Side-by-side comparison pane -->
        <div class="comparison-box">
          <div class="comparison-pane">
            <h5>Original Household Record</h5>
            <div style="font-size: 0.825rem; line-height: 1.5; color: var(--text-main);">
              <strong>Family ID:</strong> ${s.originalFamilyId}<br>
              <strong>Initiator:</strong> ${s.initiatorName || s.initiatorCitizenId}<br>
              <strong>Separation Date:</strong> ${s.separationDate}
            </div>
          </div>
          <div class="comparison-pane" style="background: #fffbeb; border-color: #fde68a;">
            <h5 style="color: #92400e;">Proposed Independent Household</h5>
            <div style="font-size: 0.825rem; line-height: 1.5; color: #78350f;">
              <strong>Moving Member(s):</strong> ${movingNames}<br>
              <strong>Proposed Address:</strong> ${s.newAddress ? `${s.newAddress.line1}, ${s.newAddress.district}` : 'Ward 3, Rampur'}<br>
              <strong>New Dwelling Ref:</strong> ${s.newDwellingReference || 'D-210'}<br>
              <strong>Assigned Family ID:</strong> <strong>${s.generatedNewFamilyId || 'Assigned on Approval'}</strong>
            </div>
          </div>
        </div>

        <div style="font-size: 0.825rem; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <strong>Applicant Reason:</strong> ${s.reason}<br>
          ${s.officerReview ? `
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; color: #166534;">
              <strong>Official Decision:</strong> ${s.officerReview.decision} — ${s.officerReview.mandatoryReason || s.officerReview.remarks}
              <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">(${new Date(s.officerReview.reviewedAt).toLocaleString()})</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Render Duplicate Claims Queue (Core Feature)
function renderDuplicateQueue() {
  const container = document.getElementById('duplicateClaimsContainer');
  if (!container) return;

  const duplicates = officerDashboardData.duplicates || [];

  if (duplicates.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <i data-lucide="shield-check" style="width: 36px; height: 36px; color: var(--success-text); margin-bottom: 8px;"></i>
        <p>Zero potential duplicate benefit flags detected. All current claims satisfy cross-referencing checks.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = duplicates.map(app => {
    const dup = app.duplicateCheckResult || {};

    return `
      <div class="card" style="padding: 20px; margin-bottom: 16px; border-left: 5px solid #dc2626;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <div>
            <span class="badge badge-danger">FLAG: ${dup.flagType || 'DUPLICATE_CLAIM'}</span>
            <strong style="color:var(--primary); font-size:1.05rem; margin-left:8px;">App ID: ${app.applicationId}</strong>
          </div>
          <button onclick="openAppReviewModal('${app.applicationId}')" class="btn btn-primary btn-sm">
            <i data-lucide="edit-3"></i> Adjudicate Claim
          </button>
        </div>

        <div style="font-size: 0.9rem; margin-bottom: 10px;">
          <strong>Scheme:</strong> ${app.schemeName} (${app.benefitType} Scheme)<br>
          <strong>Applicant:</strong> ${app.applicantName} (${app.applicantCitizenId}) • <strong>Household:</strong> ${app.familyId} (Dwelling: ${app.dwellingReference || 'N/A'})
        </div>

        <!-- Explainability Box -->
        <div class="duplicate-explain-card">
          <h4>
            <i data-lucide="alert-octagon"></i>
            Explainable Cross-Reference Finding
          </h4>
          <p>${dup.explanation}</p>
          <div style="margin-top: 8px; font-size: 0.78rem; font-weight: 700; color: #9a3412;">
            Recommended Officer Inspection: ${dup.officerActionRecommended || 'Verify physical separation and dwelling independence.'}
          </div>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Current Application Status: <span class="badge badge-warning">${app.status}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Render All Applications Queue
function renderApplicationsQueue() {
  const tbody = document.getElementById('officerAppsTableBody');
  if (!tbody) return;

  const apps = officerDashboardData.applications || [];

  tbody.innerHTML = apps.map(app => {
    let statusClass = 'badge-submitted';
    if (app.status === 'Approved') statusClass = 'badge-approved';
    if (app.status === 'Rejected') statusClass = 'badge-rejected';

    const hasDup = app.duplicateCheckResult && app.duplicateCheckResult.isPotentialDuplicate;

    return `
      <tr>
        <td><strong>${app.applicationId}</strong></td>
        <td>${app.schemeName}</td>
        <td><span class="badge ${app.benefitType === 'Household' ? 'badge-saffron' : 'badge-info'}">${app.benefitType}</span></td>
        <td>${app.applicantName}</td>
        <td>${app.familyId}</td>
        <td>${app.dwellingReference || 'N/A'}</td>
        <td>
          <span style="font-size:0.75rem;">${app.eligibilityAssessment ? app.eligibilityAssessment.status : 'Pending'}</span>
          ${hasDup ? `<br><span class="badge badge-danger" style="font-size:0.65rem;">Duplicate Flag</span>` : ''}
        </td>
        <td><span class="badge ${statusClass}">${app.status}</span></td>
        <td>
          <button onclick="openAppReviewModal('${app.applicationId}')" class="btn btn-secondary btn-sm">
            Review
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Documents Queue
function renderDocumentsQueue() {
  const container = document.getElementById('officerDocsContainer');
  if (!container) return;

  const docs = officerDashboardData.documents || [];

  container.innerHTML = docs.map(d => {
    const isPending = d.verificationStatus === 'Pending Verification';

    return `
      <div class="card" style="padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <span class="badge ${d.verificationStatus === 'Verified' ? 'badge-verified' : (d.verificationStatus === 'Rejected' ? 'badge-danger' : 'badge-warning')}">
              ${d.verificationStatus}
            </span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${d.documentId}</span>
          </div>

          <h4 style="font-size: 0.95rem; color: var(--primary); margin-bottom: 4px;">${d.title}</h4>
          <div style="font-size: 0.78rem; color: var(--accent-saffron); font-weight: 600; margin-bottom: 8px;">
            ${d.documentType} • ${d.scope}
          </div>

          <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.45;">
            Ref: <strong>${d.maskedReferenceNo || 'N/A'}</strong><br>
            Issuer: ${d.issuingAuthority || 'Govt. of UP'}<br>
            Target: <strong>${d.citizenId || d.familyId}</strong>
          </div>
        </div>

        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-color); display: flex; gap: 8px;">
          ${isPending ? `
            <button onclick="handleVerifyDoc('${d.documentId}', 'Verified')" class="btn btn-success btn-sm" style="flex:1;">
              <i data-lucide="check"></i> Verify
            </button>
            <button onclick="handleVerifyDoc('${d.documentId}', 'Rejected')" class="btn btn-danger btn-sm" style="flex:1;">
              <i data-lucide="x"></i> Reject
            </button>
          ` : `
            <span style="font-size: 0.75rem; color: var(--text-muted);">${d.officerRemarks || 'Verification completed'}</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// Render Profile Corrections Queue
function renderCorrectionsQueue() {
  const container = document.getElementById('officerCorrectionsContainer');
  if (!container) return;

  const corrs = officerDashboardData.corrections || [];

  // Update tab counter for pending corrections
  const countBadge = document.getElementById('countCorrTab');
  if (countBadge) {
    const pendingCount = corrs.filter(c => c.status === 'Pending' || c.status === 'Pending Verification' || c.status === 'Under Review' || c.status === 'Additional Evidence Required').length;
    countBadge.textContent = pendingCount;
  }

  if (corrs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 48px 20px; color: var(--text-muted); background: #f8fafc; border-radius: 8px; border: 1px dashed var(--border-color);">
        <i data-lucide="check-circle" style="width: 36px; height: 36px; color: var(--success-text); margin-bottom: 8px;"></i>
        <div style="font-weight: 600; font-size: 1rem; color: var(--primary);">No Profile Correction Requests in Queue</div>
        <div style="font-size: 0.825rem; margin-top: 4px;">All citizen profile change requests have been audited and resolved.</div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = corrs.map(c => {
    let statusBadgeClass = 'badge-pending';
    let borderColor = '#f59e0b';

    if (c.status === 'Approved') {
      statusBadgeClass = 'badge-verified';
      borderColor = '#16a34a';
    } else if (c.status === 'Rejected') {
      statusBadgeClass = 'badge-danger';
      borderColor = '#dc2626';
    } else if (c.status === 'Additional Evidence Required') {
      statusBadgeClass = 'badge-warning';
      borderColor = '#ea580c';
    } else if (c.status === 'Under Review') {
      statusBadgeClass = 'badge-info';
      borderColor = '#3b82f6';
    }

    const docTypeLabel = c.documentType === 'Other' && c.otherDocumentType
      ? `Other: ${c.otherDocumentType}`
      : (c.documentType || 'Official Document');

    const formattedDate = c.createdAt
      ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Recently';

    const docUrl = api.getCorrectionDocumentUrl(c.requestId);
    const isResolved = c.status === 'Approved' || c.status === 'Rejected';

    return `
      <div class="card" style="padding: 20px; margin-bottom: 16px; border-left: 5px solid ${borderColor}; background: #ffffff; box-shadow: var(--shadow-sm);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom: 12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:700; color:var(--primary); font-size:1rem;">${c.requestId}</span>
              <span style="font-size:0.8rem; color:var(--text-muted);">&bull; Submitted ${formattedDate}</span>
            </div>
            <div style="font-size: 0.875rem; color: #1e293b; margin-top: 3px;">
              Citizen: <strong>${c.citizenName || c.citizenId}</strong> &bull; Citizen ID: <code>${c.citizenId}</code> &bull; Family ID: <code>${c.familyId || 'FAM-1001'}</code>
            </div>
          </div>
          <span class="badge ${statusBadgeClass}">${c.status}</span>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 0.85rem;">
            <div>
              <span style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Field to Correct</span>
              <strong style="color: var(--primary); font-size: 0.95rem;">${c.fieldToCorrect}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Recorded Current Value</span>
              <span style="color: #64748b; text-decoration: line-through;">${c.currentValue || 'None recorded'}</span>
            </div>
            <div>
              <span style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Requested Legal Value</span>
              <strong style="color: #15803d; font-size: 0.95rem;">${c.requestedValue || c.proposedValue}</strong>
            </div>
          </div>
        </div>

        <div style="font-size: 0.85rem; color: #334155; margin-bottom: 12px;">
          <strong>Citizen's Reason:</strong> <em>"${c.reason}"</em>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 0.825rem;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background: #ef4444; color: #fff; font-size: 0.7rem; font-weight: 700; padding: 2px 5px; border-radius: 3px;">PDF EVIDENCE</span>
            <span style="color: #1e3a8a;"><strong>${docTypeLabel}</strong> ${c.fileSize ? `(${(c.fileSize / 1024).toFixed(1)} KB)` : ''}</span>
            ${c.originalFilename ? `<span style="color: var(--text-muted); font-size: 0.75rem;">(${c.originalFilename})</span>` : ''}
          </div>
          <a href="${docUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size: 0.775rem; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="external-link" style="width: 14px; height: 14px;"></i> Open PDF Directly
          </a>
        </div>

        ${c.officerReview || c.officerComment ? `
          <div style="background: #f8fafc; border-left: 3px solid ${borderColor}; padding: 8px 12px; border-radius: 4px; font-size: 0.825rem; margin-bottom: 12px;">
            <strong>Officer Findings:</strong> ${c.officerComment || c.officerReview?.officerRemarks}
            ${c.reviewedAt ? `<span style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 2px;">Recorded on ${new Date(c.reviewedAt).toLocaleString('en-IN')} by ${c.reviewedBy || 'Verification Officer'}</span>` : ''}
          </div>
        ` : ''}

        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button onclick="openCorrectionReviewModal('${c.requestId}')" class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
            <i data-lucide="file-search" style="width:14px; height:14px;"></i>
            ${isResolved ? 'Inspect Details & Audit Trail' : 'Inspect Evidence & Record Decision'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Render Audit Logs
function renderAuditLogs() {
  const tbody = document.getElementById('auditLogsTableBody');
  if (!tbody) return;

  const logs = officerDashboardData.auditLogs || [];

  tbody.innerHTML = logs.map(l => `
    <tr>
      <td><code style="font-size:0.75rem;">${l.logId}</code></td>
      <td style="font-size:0.75rem; color:var(--text-muted);">${new Date(l.timestamp).toLocaleString()}</td>
      <td><strong>${l.actorId}</strong></td>
      <td><span class="badge badge-neutral">${l.actorRole}</span></td>
      <td><span class="badge badge-saffron" style="font-size:0.7rem;">${l.action}</span></td>
      <td>${l.targetEntity} (${l.targetEntityId})</td>
      <td style="font-size:0.8rem;">${l.details}</td>
    </tr>
  `).join('');
}

// Render Pending Citizen Registrations Queue
function renderSignupsQueue() {
  const tbody = document.getElementById('signupsTableBody');
  if (!tbody) return;

  const signups = officerDashboardData.signups || [];

  if (signups.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-muted);">
          <i data-lucide="check-circle" style="width: 32px; height: 32px; color: var(--success-text); margin-bottom: 8px;"></i>
          <div>No citizen self-registrations currently pending officer review.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = signups.map(s => {
    const vd = s.verificationDetails || {};
    const isReviewReq = s.verificationStatus === 'review_required' || vd.requiresManualReview;
    const certBadge = isReviewReq
      ? `<span class="badge badge-warning">Review Required</span>`
      : `<span class="badge badge-success">Valid (Simulated)</span>`;

    return `
      <tr>
        <td>
          <strong>${s.userId}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${new Date(s.createdAt).toLocaleDateString()}</div>
        </td>
        <td>
          <div style="font-weight:600; color:var(--primary);">${s.fullName || s.userId}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">DOB: ${s.dateOfBirth || 'N/A'}</div>
        </td>
        <td>
          <div style="font-size:0.82rem;">${s.district || 'Sevapuri'}, ${s.state || 'UP'}</div>
        </td>
        <td>
          <div><strong>${vd.certificateType || 'Certificate'}</strong></div>
          <code style="font-size:0.75rem;">${vd.certificateId || 'N/A'}</code>
          <div style="margin-top:2px;">${certBadge}</div>
        </td>
        <td>
          <span class="badge badge-neutral" style="font-size:0.7rem;">Synthetic Dataset (80 Recs)</span>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Simulated Record: ${vd.recordId || 'N/A'}</div>
        </td>
        <td>
          <span class="badge ${s.status === 'pending' ? 'badge-warning' : 'badge-neutral'}">
            ${(s.status || 'pending').toUpperCase()}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button onclick="reviewRegistration('${s.userId}', 'approve')" class="btn btn-primary btn-sm" style="padding:4px 8px; font-size:0.78rem;">
              <i data-lucide="check"></i> Approve
            </button>
            <button onclick="reviewRegistration('${s.userId}', 'reject')" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.78rem; color:#dc2626; border-color:#fca5a5;">
              <i data-lucide="x"></i> Reject
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function reviewRegistration(userId, decision) {
  const actionText = decision === 'approve' ? 'Approve' : 'Reject';
  const defaultRemarks = decision === 'approve'
    ? 'Identity & supporting synthetic certificate verified by block officer.'
    : 'Identity details unverified or inconsistent.';
  const remarks = prompt(`Enter official remarks to ${actionText} registration for ${userId}:`, defaultRemarks);
  if (remarks === null) return;

  try {
    const res = await api.reviewPendingRegistration(userId, { decision, remarks });
    if (res.success) {
      showToast(res.message, decision === 'approve' ? 'success' : 'info');
      await refreshOfficerData();
    } else {
      showToast(res.message || 'Operation failed', 'error');
    }
  } catch (err) {
    showToast(`Failed to ${actionText} registration: ${err.message}`, 'error');
  }
}

// Tab Switching
function switchOfficerTab(tabName) {
  document.querySelectorAll('.officer-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.officer-view').forEach(v => {
    v.classList.remove('active');
    v.style.display = 'none';
  });

  const btn = document.getElementById(`otab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  const view = document.getElementById(`oview${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);

  if (btn) btn.classList.add('active');
  if (view) {
    view.classList.add('active');
    view.style.display = 'block';
  }

  if (tabName === 'govapi') {
    refreshGovServicesStatus();
  }
}

// Separation Review Modal (Scenario A Execution)
function openSeparationReviewModal(requestId) {
  activeSeparationForReview = requestId;
  const req = (officerDashboardData.separations || []).find(s => s.requestId === requestId);
  if (!req) return;

  const movingNames = req.movingMembers ? req.movingMembers.map(m => m.name).join(', ') : req.movingCitizenIds.join(', ');

  document.getElementById('separationReviewDetails').innerHTML = `
    <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; font-size: 0.85rem; line-height: 1.5; margin-bottom: 12px;">
      <div><strong>Separation Request ID:</strong> ${req.requestId}</div>
      <div><strong>Original Household:</strong> ${req.originalFamilyId}</div>
      <div><strong>Moving Citizens:</strong> ${movingNames} (${req.movingCitizenIds.join(', ')})</div>
      <div><strong>Proposed Address:</strong> ${req.newAddress?.line1}, ${req.newAddress?.district}</div>
      <div><strong>Dwelling Ref:</strong> ${req.newDwellingReference || 'D-210'}</div>
      <div><strong>Stated Reason:</strong> ${req.reason}</div>
      <div style="margin-top: 8px; color: #166534; font-weight: 600;">
        ✨ On Approval: A new internal Household ID (e.g. FAM-2002) is generated atomically. Citizen IDs, accounts, and kinship bonds remain intact. No government benefits are auto-transferred.
      </div>
    </div>
  `;

  openModal('reviewSeparationModal');
}

async function submitSeparationReview(e) {
  e.preventDefault();
  const decision = document.getElementById('sepDecisionSelect').value;
  const mandatoryReason = document.getElementById('sepMandatoryReason').value.trim();
  const btn = document.getElementById('btnSubmitSepReview');

  if (!mandatoryReason) {
    showToast('A mandatory reason is required for statutory separation orders.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Processing legal order...';

  try {
    const res = await api.reviewSeparationRequest(activeSeparationForReview, {
      decision,
      mandatoryReason
    });

    showToast(res.message, 'success');
    closeModal('reviewSeparationModal');
    btn.disabled = false;
    btn.textContent = 'Record Official Decision';

    await refreshOfficerData();

    if (decision === 'Approved' && res.details) {
      alert(`🎉 SEPARATION APPROVED!\n\nNew Household Family ID: ${res.details.newFamilyId}\nSeparated Citizens: [${res.details.movingCitizenIds.join(', ')}]\n\nNote: Permanent Citizen IDs and family bonds are preserved! No government welfare benefits have been auto-granted.`);
    }
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Record Official Decision';
  }
}

// Application Review Modal
function openAppReviewModal(appId) {
  activeAppForReview = appId;
  const app = (officerDashboardData.applications || []).find(a => a.applicationId === appId);
  if (!app) return;

  const hasDup = app.duplicateCheckResult && app.duplicateCheckResult.isPotentialDuplicate;

  document.getElementById('appReviewDetails').innerHTML = `
    <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; line-height: 1.5;">
      <div><strong>Application ID:</strong> ${app.applicationId}</div>
      <div><strong>Scheme:</strong> ${app.schemeName} (${app.benefitType})</div>
      <div><strong>Applicant:</strong> ${app.applicantName} (${app.applicantCitizenId})</div>
      <div><strong>Household:</strong> ${app.familyId} (Dwelling: ${app.dwellingReference || 'N/A'})</div>
      ${hasDup ? `
        <div style="margin-top: 8px; padding: 10px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; color: #9a3412;">
          <strong>⚠️ DUPLICATE CLAIM WARNING:</strong><br>${app.duplicateCheckResult.explanation}
        </div>
      ` : ''}
    </div>
  `;

  openModal('reviewAppModal');
}

async function submitAppReview(e) {
  e.preventDefault();
  const decision = document.getElementById('appDecisionSelect').value;
  const remarks = document.getElementById('appRemarks').value.trim();
  const btn = document.getElementById('btnSubmitAppReview');

  btn.disabled = true;
  btn.textContent = 'Submitting decision...';

  try {
    const res = await api.reviewApplication(activeAppForReview, { decision, remarks });
    showToast(res.message, 'success');
    closeModal('reviewAppModal');
    btn.disabled = false;
    btn.textContent = 'Submit Decision';

    await refreshOfficerData();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Decision';
  }
}

// Document Verification Quick Actions
async function handleVerifyDoc(docId, status) {
  const remarks = prompt(`Enter officer verification remark for document ${docId}:`, status === 'Verified' ? 'Document verified against government records.' : 'Incomplete seal or illegible scan.');
  if (remarks === null) return;

  try {
    const res = await api.verifyDocument(docId, { status, remarks });
    showToast(res.message, 'success');
    await refreshOfficerData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Profile Correction Inspection & Review Modal
async function openCorrectionReviewModal(requestId) {
  let c = (officerDashboardData.corrections || []).find(x => x.requestId === requestId);
  if (!c) {
    try {
      const res = await api.getProfileCorrection(requestId);
      c = res.correction;
    } catch (err) {
      showToast(`Unable to load request: ${err.message}`, 'error');
      return;
    }
  }

  document.getElementById('ocorrTargetRequestId').value = c.requestId;
  document.getElementById('ocorrDisplayId').textContent = c.requestId;
  document.getElementById('ocorrSubmissionDate').textContent = `Submitted ${c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}`;

  // Status badge
  const badge = document.getElementById('ocorrCurrentStatusBadge');
  badge.textContent = c.status;
  if (c.status === 'Approved') {
    badge.className = 'badge badge-verified';
  } else if (c.status === 'Rejected') {
    badge.className = 'badge badge-danger';
  } else if (c.status === 'Additional Evidence Required') {
    badge.className = 'badge badge-warning';
  } else if (c.status === 'Under Review') {
    badge.className = 'badge badge-info';
  } else {
    badge.className = 'badge badge-pending';
  }

  // Citizen & household
  document.getElementById('ocorrCitizenName').textContent = `${c.citizenName || c.citizenId} (${c.citizenId})`;
  document.getElementById('ocorrFamilyId').textContent = c.familyId || 'FAM-1001';

  // Field details
  document.getElementById('ocorrField').textContent = c.fieldToCorrect;
  document.getElementById('ocorrCurrentVal').textContent = c.currentValue || 'None recorded';
  document.getElementById('ocorrRequestedVal').textContent = c.requestedValue || c.proposedValue;
  document.getElementById('ocorrReasonText').textContent = `"${c.reason}"`;

  // Supporting evidence
  const docTypeLabel = c.documentType === 'Other' && c.otherDocumentType
    ? `Other: ${c.otherDocumentType}`
    : (c.documentType || 'Official Supporting Proof');
  document.getElementById('ocorrDocTypeDisplay').textContent = docTypeLabel;
  const sizeFormatted = c.fileSize ? `${(c.fileSize / 1024).toFixed(1)} KB` : 'Verified PDF';
  document.getElementById('ocorrDocMetaDisplay').textContent = `${c.originalFilename || 'supporting_proof.pdf'} • ${sizeFormatted} • Uploaded ${c.uploadedAt ? new Date(c.uploadedAt).toLocaleString('en-IN') : 'Recently'}`;

  // Protected PDF URL with bearer token
  const docUrl = api.getCorrectionDocumentUrl(c.requestId);
  const openBtn = document.getElementById('ocorrOpenPdfBtn');
  if (openBtn) openBtn.href = docUrl;
  const dlLink = document.getElementById('ocorrPdfDownloadLink');
  if (dlLink) dlLink.href = docUrl;

  const iframe = document.getElementById('ocorrPdfIframe');
  const fallback = document.getElementById('ocorrPdfFallback');
  if (iframe) {
    iframe.style.display = 'block';
    if (fallback) fallback.style.display = 'none';
    iframe.src = docUrl;
    iframe.onerror = () => {
      iframe.style.display = 'none';
      if (fallback) fallback.style.display = 'block';
    };
  }

  // Review history
  const historySec = document.getElementById('ocorrReviewHistorySection');
  const historyList = document.getElementById('ocorrReviewHistoryList');
  if (c.reviewHistory && c.reviewHistory.length > 0) {
    historySec.style.display = 'block';
    historyList.innerHTML = c.reviewHistory.map(h => `
      <div style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <div>
          <strong>${h.decision}</strong> by <span>${h.reviewedBy || 'Officer'}</span>
          <div style="color: #475569; margin-top: 2px;"><em>${h.officerRemarks}</em></div>
        </div>
        <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(h.reviewedAt).toLocaleString('en-IN')}</span>
      </div>
    `).join('');
  } else {
    historySec.style.display = 'none';
    historyList.innerHTML = '';
  }

  // Decision selector and remarks
  const decisionSelect = document.getElementById('ocorrDecisionSelect');
  if (c.status === 'Approved' || c.status === 'Rejected' || c.status === 'Additional Evidence Required') {
    decisionSelect.value = c.status;
  } else {
    decisionSelect.value = 'Approved';
  }

  const remarksInput = document.getElementById('ocorrRemarks');
  remarksInput.value = c.officerComment || (c.officerReview ? c.officerReview.officerRemarks : '');

  handleOcorrDecisionChange();
  openModal('reviewCorrectionModal');
  if (window.lucide) lucide.createIcons();
}

function handleOcorrDecisionChange() {
  const decision = document.getElementById('ocorrDecisionSelect').value;
  const remarks = document.getElementById('ocorrRemarks');
  const mandatoryTag = document.getElementById('ocorrRemarksMandatory');
  const helper = document.getElementById('ocorrRemarksHelper');

  if (decision === 'Rejected') {
    mandatoryTag.textContent = '* Mandatory for Rejection';
    mandatoryTag.style.color = '#dc2626';
    remarks.required = true;
    if (!remarks.value || remarks.value.includes('authenticated') || remarks.value.includes('Approved')) {
      remarks.value = 'Documentary evidence does not substantiate legal change. Rejected in accordance with JanSetu identity guidelines.';
    }
    helper.textContent = 'Rejection will preserve the existing citizen profile value unchanged.';
  } else if (decision === 'Additional Evidence Required') {
    mandatoryTag.textContent = '* Mandatory for Evidence Request';
    mandatoryTag.style.color = '#d97706';
    remarks.required = true;
    if (!remarks.value || remarks.value.includes('authenticated') || remarks.value.includes('Approved')) {
      remarks.value = 'Supporting document is unclear or lacks statutory authority. Please upload a clear official gazette or municipal certificate.';
    }
    helper.textContent = 'Citizen will be notified to upload replacement/higher-tier proof.';
  } else if (decision === 'Under Review') {
    mandatoryTag.textContent = '(Optional)';
    mandatoryTag.style.color = 'var(--text-muted)';
    remarks.required = false;
    if (!remarks.value) {
      remarks.value = 'Referred for sub-divisional verification and scrutiny.';
    }
    helper.textContent = 'Status will be updated to Under Review pending field verification.';
  } else {
    // Approved
    mandatoryTag.textContent = '(Optional)';
    mandatoryTag.style.color = 'var(--text-muted)';
    remarks.required = false;
    if (!remarks.value || remarks.value.includes('Rejected') || remarks.value.includes('unclear')) {
      remarks.value = 'Supporting legal document authenticated. Profile correction verified and approved.';
    }
    helper.textContent = 'Approval will immediately update the official JanSetu profile record.';
  }
}

async function submitCorrectionDecision(e) {
  e.preventDefault();
  const requestId = document.getElementById('ocorrTargetRequestId').value;
  const decision = document.getElementById('ocorrDecisionSelect').value;
  const remarks = document.getElementById('ocorrRemarks').value.trim();
  const btn = document.getElementById('btnSubmitCorrReview');

  if ((decision === 'Rejected' || decision === 'Additional Evidence Required') && !remarks) {
    showToast(`Officer review remarks are mandatory when selecting '${decision}'.`, 'error');
    document.getElementById('ocorrRemarks').focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Recording Determination...';

  try {
    const res = await api.reviewProfileCorrection(requestId, { decision, remarks });
    showToast(res.message || `Correction request ${requestId} marked as ${decision}.`, 'success');
    closeModal('reviewCorrectionModal');

    // Reset iframe to release file handle / view
    const iframe = document.getElementById('ocorrPdfIframe');
    if (iframe) iframe.src = 'about:blank';

    btn.disabled = false;
    btn.textContent = 'Record Official Determination';

    await refreshOfficerData();
    renderCorrectionsQueue();
  } catch (err) {
    console.error('Correction review error:', err);
    showToast(err.message || 'Failed to record decision.', 'error');
    btn.disabled = false;
    btn.textContent = 'Record Official Determination';
  }
}

// Profile Correction Quick Actions (legacy fallback)
async function handleReviewCorrection(requestId, decision) {
  openCorrectionReviewModal(requestId);
  document.getElementById('ocorrDecisionSelect').value = decision;
  handleOcorrDecisionChange();
}

function handleOfficerLogout() {
  api.clearAuth();
  showToast('Signed out of Government Portal.', 'info');
  setTimeout(() => window.location.href = '/login.html?portal=officer', 400);
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

// ==============================================================================
// GOVERNMENT API GATEWAY & INTEGRATION CENTER (Scenario & Gov Delivery)
// ==============================================================================

async function refreshGovServicesStatus() {
  try {
    const [statusRes, invRes, auditRes] = await Promise.all([
      api.getGovServicesStatus().catch(err => ({ services: [], stateSummary: {} })),
      api.getGovInventory().catch(err => ({ inventory: [] })),
      api.getGovAuditLogs(15).catch(err => ({ auditLogs: [] }))
    ]);

    renderGovCards(statusRes.services || []);
    renderGovInventory(invRes.inventory || []);
    renderGovAuditLogs(auditRes.auditLogs || []);

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Failed to load government services:', err);
    showToast('Failed to refresh Government API gateway: ' + err.message, 'error');
  }
}

function renderGovCards(services) {
  const container = document.getElementById('govServicesCardsGrid');
  if (!container) return;

  if (services.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">No services loaded.</div>`;
    return;
  }

  const badgeColors = {
    'Connected': { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
    'Sandbox': { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
    'Awaiting Approval': { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    'Unavailable': { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
    'Demo Mode': { bg: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe' }
  };

  container.innerHTML = services.map(s => {
    const style = badgeColors[s.connectionState] || badgeColors['Demo Mode'];
    return `
      <div class="card" style="padding: 18px; border-top: 4px solid ${style.text};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">${s.portal}</span>
          <span style="background: ${style.bg}; color: ${style.text}; border: 1px solid ${style.border}; padding: 3px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">
            ${s.connectionState}
          </span>
        </div>
        <h4 style="font-size: 1rem; color: var(--primary); margin-bottom: 6px;">${s.name}</h4>
        <div style="font-size: 0.775rem; color: var(--text-muted); margin-bottom: 12px; font-family: monospace; word-break: break-all;">
          ${s.endpoint}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; border-top: 1px solid #f1f5f9; padding-top: 8px;">
          <span style="color: #64748b;">${s.category}</span>
          <span style="font-weight: 600; color: ${s.requiresConsent ? '#ea580c' : '#16a34a'};">
            ${s.requiresConsent ? '🔒 Electronic Consent Required' : '🌐 Public Open Access'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function renderGovInventory(inventory) {
  const tbody = document.getElementById('govInventoryTableBody');
  if (!tbody) return;

  if (inventory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No inventory records.</td></tr>`;
    return;
  }

  tbody.innerHTML = inventory.map(item => `
    <tr>
      <td style="font-family: monospace; font-weight: 700; color: var(--primary); font-size: 0.8rem;">
        ${item.id}
      </td>
      <td>
        <div style="font-weight: 600; color: var(--text-main); font-size: 0.85rem;">${item.name}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
          ${item.publisher} (${item.portalSource})
        </div>
        <div style="font-size: 0.725rem; color: #475569; margin-top: 4px; line-height: 1.35;">
          ${item.purpose}
        </div>
      </td>
      <td>
        <span class="badge ${item.category === 'PUBLIC_OPEN_DATASET' ? 'badge-info' : 'badge-warning'}" style="font-size: 0.725rem;">
          ${item.category === 'PUBLIC_OPEN_DATASET' ? 'Public Open Data (Zero PII)' : 'Citizen PII / Verification'}
        </span>
      </td>
      <td style="font-size: 0.775rem;">
        <strong>${item.authentication.type}</strong>
        <div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 2px;">
          Secrets stored in backend .env only
        </div>
      </td>
      <td style="font-size: 0.75rem;">
        ${item.consentRequirements.isMandatory 
          ? `<span style="color: #c2410c; font-weight: 600;">DPDP Act Consent Mandatory</span><div style="font-size: 0.7rem; color: var(--text-muted);">${item.consentRequirements.consentStructure}</div>` 
          : `<span style="color: #15803d; font-weight: 600;">Not Required (Public Data)</span>`}
      </td>
      <td style="font-size: 0.75rem;">
        <div style="font-weight: 600; color: #1e40af;">${item.approvalRequirements.statusInJanSetu}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${item.approvalRequirements.entityType}</div>
      </td>
    </tr>
  `).join('');
}

function renderGovAuditLogs(logs) {
  const tbody = document.getElementById('govAuditTableBody');
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">No government requests logged yet. Trigger a test from above.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(l => {
    const isAuth = l.execution.isAuthoritative;
    return `
      <tr>
        <td style="font-size: 0.75rem; white-space: nowrap;">
          <strong>${l.logId}</strong>
          <div style="color: var(--text-muted);">${new Date(l.timestamp).toLocaleTimeString('en-IN')}</div>
        </td>
        <td>
          <span style="font-weight: 600; color: var(--primary); font-size: 0.8rem;">${l.operation}</span>
          <div style="font-size: 0.725rem; color: var(--text-muted); font-family: monospace;">${l.serviceName}</div>
        </td>
        <td style="font-size: 0.8rem;">
          ${l.actor.id} (${l.actor.role})
        </td>
        <td style="font-family: monospace; font-size: 0.725rem; color: #475569;">
          ${l.trace.txnId ? l.trace.txnId.substring(0, 14) + '...' : 'N/A'}
        </td>
        <td>
          <span class="badge ${isAuth ? 'badge-success' : 'badge-purple'}" style="font-size: 0.7rem;">
            ${isAuth ? 'LIVE AUTHORITATIVE' : 'SIMULATED (DEMO ADAPTER)'}
          </span>
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">HTTP ${l.execution.statusCode}</div>
        </td>
        <td style="font-size: 0.775rem; font-weight: 600;">
          ${l.execution.latencyMs} ms
        </td>
        <td style="font-family: monospace; font-size: 0.675rem; color: #94a3b8;">
          ${l.integrityHash.substring(0, 16)}...
        </td>
      </tr>
    `;
  }).join('');
}

async function runGovTest(testType) {
  const wrap = document.getElementById('govConsoleOutputWrap');
  const header = document.getElementById('govConsoleHeader');
  const badge = document.getElementById('govConsoleBadge');
  const pre = document.getElementById('govConsolePre');

  wrap.style.display = 'block';
  header.textContent = `Executing ${testType.toUpperCase()} Test Request...`;
  badge.textContent = 'RUNNING...';
  badge.style.background = '#3b82f6';
  pre.textContent = 'Contacting Indian Government Gateway Layer...';

  try {
    let res = null;

    if (testType === 'ration') {
      res = await api.verifyGovRationCard({
        rationCardNo: 'UP-VAR-2023-9182741',
        citizenId: 'CIT-1001',
        citizenName: 'Rahul Sharma',
        state: 'UP'
      });
      header.textContent = 'e-PDS Ration Card Verification (Food & Civil Supplies)';
    } else if (testType === 'electricity') {
      res = await api.verifyGovElectricity({
        consumerNumber: '1029384756',
        premisesAddress: 'House No. 42B, Shanti Nagar, Sevapuri, Varanasi',
        citizenId: 'CIT-1002',
        citizenName: 'Amit Sharma'
      });
      header.textContent = 'DISCOM Electricity Dwelling Verification (UPPCL)';
    } else if (testType === 'digilocker') {
      res = await api.pullGovDigiLockerDoc({
        docType: 'incme',
        referenceNo: 'INC-UP-2025-44921',
        citizenName: 'Rahul Sharma',
        citizenId: 'CIT-1001'
      });
      header.textContent = 'DigiLocker Digital Certificate Pull & Verification';
    } else if (testType === 'ogd') {
      res = await api.getOgdPublicStats('limit=3');
      header.textContent = 'Open Government Data Platform India (data.gov.in)';
    } else if (testType === 'myscheme') {
      res = await api.getMySchemeCatalog();
      header.textContent = 'myScheme National Welfare Discovery Catalog';
    }

    const isAuth = res.result?.metadata?.isAuthoritative || res.stats?.metadata?.isAuthoritative || res.catalog?.metadata?.isAuthoritative;
    badge.textContent = isAuth ? 'AUTHORITATIVE GOVERNMENT RESULT' : 'SIMULATED DEMO ADAPTER RESULT (NON-AUTHORITATIVE)';
    badge.style.background = isAuth ? '#16a34a' : '#7e22ce';

    pre.textContent = JSON.stringify(res, null, 2);
    showToast('Government test executed successfully.', 'success');

    // Refresh audit trail
    await refreshGovServicesStatus();
  } catch (err) {
    badge.textContent = 'ERROR / UNAVAILABLE';
    badge.style.background = '#dc2626';
    pre.textContent = `Error executing test: ${err.message}`;
    showToast('Gateway test error: ' + err.message, 'error');
  }
}
