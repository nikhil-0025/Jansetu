// JanSetu Citizen Dashboard Logic (Client Controller)

let currentHousehold = null;
let currentMembers = [];
let currentRelationships = [];
let allSchemes = [];
let allApplications = [];
let allDocuments = [];
let currentNotifications = [];

// Sensitive Information Privacy Masking State
const sensitiveData = {};
const sensitiveVisibility = {};
let allSensitiveVisible = false;

function setSensitiveField(fieldId, rawValue, maskedValue) {
  sensitiveData[fieldId] = { raw: rawValue, masked: maskedValue };
  if (sensitiveVisibility[fieldId] === undefined) {
    sensitiveVisibility[fieldId] = false; // default masked
  }
  updateSensitiveFieldDisplay(fieldId);
}

function updateSensitiveFieldDisplay(fieldId) {
  const el = document.getElementById(fieldId);
  const icon = document.getElementById(`${fieldId}-icon`);
  const data = sensitiveData[fieldId];
  if (!el || !data) return;

  const isVisible = sensitiveVisibility[fieldId];
  el.textContent = isVisible ? data.raw : data.masked;
  if (icon) {
    icon.setAttribute('data-lucide', isVisible ? 'eye-off' : 'eye');
  }
}

function toggleSensitiveField(fieldId) {
  sensitiveVisibility[fieldId] = !sensitiveVisibility[fieldId];
  updateSensitiveFieldDisplay(fieldId);
  if (window.lucide) lucide.createIcons();
}

function toggleAllSensitiveInfo() {
  allSensitiveVisible = !allSensitiveVisible;
  Object.keys(sensitiveData).forEach(fieldId => {
    sensitiveVisibility[fieldId] = allSensitiveVisible;
    updateSensitiveFieldDisplay(fieldId);
  });
  const btnText = document.getElementById('masterToggleText');
  const btnIcon = document.getElementById('masterToggleIcon');
  if (btnText) btnText.textContent = allSensitiveVisible ? 'Hide All IDs' : 'Show All IDs';
  if (btnIcon) btnIcon.setAttribute('data-lucide', allSensitiveVisible ? 'eye-off' : 'eye');
  if (window.lucide) lucide.createIcons();
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  
  const token = api.getToken();
  const user = api.getUser();

  if (!token || !user) {
    window.location.href = '/login.html?portal=citizen';
    return;
  }

  // Redirect officers to officer dashboard
  if (user.role !== 'citizen') {
    window.location.href = '/officer.html';
    return;
  }

  await loadSystemStatus();
  await refreshDashboardData();

  // Set today's date for separation form default
  const sepDateInput = document.getElementById('sepDate');
  if (sepDateInput) {
    sepDateInput.value = new Date().toISOString().split('T')[0];
  }

  // Explicit event listener binding for all Add Member triggers
  document.querySelectorAll('button[onclick*="openAddMemberModal"], a[onclick*="openAddMemberModal"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openAddMemberModal();
    });
  });
});

// Load System & DB Mode
async function loadSystemStatus() {
  try {
    const status = await api.getSystemStatus();
    const tag = document.getElementById('systemModeTag');
    if (tag && status.dbStatus) {
      tag.textContent = status.dbStatus.connected ? 'MongoDB Live' : 'Demo Local Store Mode';
    }
  } catch (err) {
    console.warn('System status check failed:', err);
  }
}

// Full Dashboard Data Refresh
async function refreshDashboardData() {
  const user = api.getUser();
  const familyId = user.familyId || 'FAM-1001';

  try {
    // 1. Fetch Household & Members
    const [hhRes, memRes] = await Promise.all([
      api.getHousehold(familyId),
      api.getHouseholdMembers(familyId)
    ]);

    currentHousehold = hhRes.household;
    currentMembers = memRes.members;
    currentRelationships = memRes.relationships;

    // 2. Fetch Schemes, Applications, Documents
    const [schemesRes, appsRes, docsRes, notifsRes] = await Promise.all([
      api.getSchemes(),
      api.getApplications(),
      api.getDocuments(),
      api.getNotifications()
    ]);

    allSchemes = schemesRes.schemes;
    allApplications = appsRes.applications;
    allDocuments = docsRes.documents;

    // Render all UI components
    updateHeaderAndBanner();
    renderOverviewSchemes();
    renderRecentApplications();
    renderSidebarWidgets();
    renderAllSchemesTab();
    renderApplicationsTable();
    renderDocumentVault();
    renderFamilyMembersTab();
    renderSeparationTab();
    renderCorrectionsTab();
    renderNotifications(notifsRes.notifications);

    lucide.createIcons();
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    showToast('Failed to load dashboard data: ' + err.message, 'error');
  }
}

// Update Top Header & Welcome Banner
function updateHeaderAndBanner() {
  const user = api.getUser();
  if (!currentHousehold) return;

  const headMember = currentMembers.find(m => m.citizenId === currentHousehold.headCitizenId) || currentMembers[0];
  const famId = currentHousehold.familyId || 'FAM-1001';
  const citId = headMember ? headMember.citizenId : 'CIT-1001';
  const dwellRef = `${currentHousehold.dwellingReference || 'D-104'} (${currentHousehold.dwellingType || 'Kutcha'})`;

  document.getElementById('welcomeCitizenName').textContent = headMember ? headMember.fullName : 'Citizen';

  setSensitiveField('headerFamilyId', famId, 'FAM-••••');
  setSensitiveField('bannerFamilyId', famId, 'FAM-••••');
  setSensitiveField('bannerCitizenId', citId, 'CIT-••••');
  setSensitiveField('bannerDwellingRef', dwellRef, 'D-••• (Kutcha)');

  const bannerStatusText = document.getElementById('bannerStatusText');
  if (bannerStatusText) {
    bannerStatusText.textContent = `${currentHousehold.verificationStatus || 'Verified'} Household`;
  }

  // Update quick cards badges
  const cSchemes = document.getElementById('countSchemesBadge');
  const cApps = document.getElementById('countAppsBadge');
  const cDocs = document.getElementById('countDocsBadge');
  const cFamily = document.getElementById('countFamilyBadge');

  if (cSchemes) cSchemes.textContent = `${allSchemes.length} Schemes`;
  if (cApps) cApps.textContent = `${allApplications.length} Recorded`;
  if (cDocs) cDocs.textContent = `${allDocuments.length} Vault Docs`;
  if (cFamily) cFamily.textContent = `${currentMembers.length} Members`;
}

// Helper: Category Badge Styling
function getCategoryBadgeClass(category) {
  if (!category) return 'cat-badge-default';
  const c = category.toLowerCase();
  if (c.includes('housing')) return 'cat-badge-housing';
  if (c.includes('agri')) return 'cat-badge-agriculture';
  if (c.includes('health')) return 'cat-badge-healthcare';
  if (c.includes('food')) return 'cat-badge-food-security';
  if (c.includes('energy') || c.includes('fuel') || c.includes('ujjwala')) return 'cat-badge-energy';
  if (c.includes('skill')) return 'cat-badge-skills';
  if (c.includes('social') || c.includes('pension')) return 'cat-badge-social-security';
  if (c.includes('financial') || c.includes('urban') || c.includes('svanidhi')) return 'cat-badge-financial-inclusion';
  return 'cat-badge-default';
}

function getCategoryIcon(category) {
  if (!category) return 'award';
  const c = category.toLowerCase();
  if (c.includes('housing')) return 'home';
  if (c.includes('agri')) return 'sprout';
  if (c.includes('health')) return 'activity';
  if (c.includes('food')) return 'shopping-bag';
  if (c.includes('energy') || c.includes('fuel')) return 'flame';
  if (c.includes('skill')) return 'award';
  if (c.includes('social') || c.includes('pension')) return 'shield';
  if (c.includes('financial') || c.includes('urban') || c.includes('svanidhi')) return 'briefcase';
  return 'award';
}

// Generate Unified Modern Scheme Card with Visual Preview
function createSchemeCardHtml(s) {
  const catClass = getCategoryBadgeClass(s.category);
  const catIcon = getCategoryIcon(s.category);
  const imgUrl = s.imageUrl || '/assets/schemes/fallback.svg';
  const imgAlt = s.imageAlt || `${s.name} preview illustration`;
  const ministry = s.ministry || s.department || 'Government of India';
  const coverage = s.stateCoverage || 'Pan-India';
  const verifiedDate = s.lastVerifiedDate || '2026-10-24';
  const officialUrl = s.officialUrl || '#';

  return `
    <div class="scheme-card" data-category="${s.category}" data-coverage="${coverage}" data-scheme-id="${s.schemeId}">
      <!-- Top: Relevant Visual Preview Image -->
      <div class="scheme-card-media">
        <img class="scheme-card-img" 
             src="${imgUrl}" 
             alt="${imgAlt}" 
             loading="lazy" 
             onerror="this.onerror=null; this.src='/assets/schemes/fallback.svg';">
        <div class="scheme-media-badges">
          <span class="scheme-cat-badge ${catClass}">
            <i data-lucide="${catIcon}" style="width:12px;height:12px;"></i> ${s.category}
          </span>
          <span class="scheme-type-badge">${s.benefitType}</span>
        </div>
      </div>

      <!-- Card Body -->
      <div class="scheme-card-body">
        <div class="scheme-title">${s.name}</div>
        <div class="scheme-hindi-title">${s.nameHindi || ''}</div>
        <div class="scheme-ministry-subtitle">
          <i data-lucide="building" style="width:11px;height:11px;flex-shrink:0;"></i>
          <span>${ministry}</span>
        </div>

        <div class="scheme-source-pill" title="Source: ${s.sourceUrl || 'Official Department Portal'}">
          <i data-lucide="shield-check" style="width:11px; height:11px; color:#16a34a;"></i>
          <span>Verified: ${verifiedDate}</span>
          <span style="color:#94a3b8;">•</span>
          <span style="color:#0284c7; font-weight:600;">${coverage}</span>
        </div>

        <div class="scheme-desc">${s.description}</div>

        ${s.eligibilityPreview ? `
          <div class="scheme-eligibility-preview">
            <i data-lucide="shield-check" class="elig-icon"></i>
            <div class="elig-text">
              <strong>Eligibility:</strong> ${s.eligibilityPreview}
            </div>
          </div>
        ` : ''}

        <div class="scheme-meta">
          <div>
            <span style="color:var(--text-muted); font-size:0.75rem;">Benefit:</span><br>
            <span class="scheme-benefit-badge">${s.benefitAmount || 'Financial Assistance'}</span>
          </div>
          <div style="text-align:right;">
            <span style="color:var(--text-muted); font-size:0.75rem;">Documents:</span><br>
            <strong style="font-size:0.78rem; color:#475569;">${s.requiredDocuments ? s.requiredDocuments.length + ' required' : 'Standard KYC'}</strong>
          </div>
        </div>

        <div class="scheme-actions">
          <button onclick="openSchemeDetailsModal('${s.schemeId}')" class="btn btn-details btn-sm" style="flex:1;" title="View Complete Scheme Details & Documents">
            <i data-lucide="info" style="width:13px;height:13px;"></i> Details
          </button>
          <a href="${officialUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-official-link" style="flex:1; justify-content:center;" title="Open Authoritative Government Portal">
            <i data-lucide="external-link" style="width:12px;height:12px;"></i> Official Link
          </a>
          <button onclick="checkEligibilityLive('${s.schemeId}')" class="btn btn-secondary btn-sm" style="flex:1;" title="Check Live Eligibility Rules">
            <i data-lucide="check-circle" style="width:13px;height:13px;"></i> Check
          </button>
          <button onclick="openApplyForScheme('${s.schemeId}')" class="btn btn-primary btn-sm" style="flex:1;" title="Record Scheme Claim in JanSetu">
            <i data-lucide="send" style="width:13px;height:13px;"></i> Apply
          </button>
        </div>
      </div>
    </div>
  `;
}

// Render Overview Schemes Cards
function renderOverviewSchemes() {
  const container = document.getElementById('overviewSchemesGrid');
  if (!container) return;

  container.innerHTML = allSchemes.slice(0, 4).map(s => createSchemeCardHtml(s)).join('');
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

// Render Recent Applications Tracker
function renderRecentApplications() {
  const container = document.getElementById('recentApplicationsList');
  if (!container) return;

  if (allApplications.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        No welfare applications submitted yet. Click "New Application" to apply for a scheme.
      </div>
    `;
    return;
  }

  container.innerHTML = allApplications.slice(0, 3).map(app => {
    let statusClass = 'badge-submitted';
    if (app.status === 'Approved') statusClass = 'badge-approved';
    if (app.status === 'Rejected') statusClass = 'badge-rejected';
    if (app.status === 'Additional Information Required') statusClass = 'badge-warning';

    const hasDuplicateFlag = app.duplicateCheckResult && app.duplicateCheckResult.isPotentialDuplicate;

    return `
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="color: var(--primary); font-size: 0.95rem;">${app.schemeName}</strong>
            <span class="badge ${statusClass}">${app.status}</span>
            ${hasDuplicateFlag ? `<span class="badge badge-danger" title="${app.duplicateCheckResult.explanation}">⚠️ Potential Duplicate</span>` : ''}
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
            Tracking ID: <strong>${app.applicationId}</strong> • Applicant: <strong>${app.applicantName}</strong> (${app.applicantCitizenId}) • Filed: ${new Date(app.submittedAt).toLocaleDateString()}
          </div>
        </div>
        <button onclick="viewApplicationDetail('${app.applicationId}')" class="btn btn-secondary btn-sm">
          <i data-lucide="eye" style="width:14px;height:14px;"></i> View Details
        </button>
      </div>
    `;
  }).join('');
}

// Render Sidebar Widgets
function renderSidebarWidgets() {
  if (!currentHousehold) return;

  const head = currentMembers.find(m => m.citizenId === currentHousehold.headCitizenId) || currentMembers[0];
  
  const famId = currentHousehold.familyId || 'FAM-1001';
  const dwellRef = currentHousehold.dwellingReference || 'D-104';
  const rcNo = currentHousehold.rationCardNumber || 'RC-UP-2024-98421';

  setSensitiveField('infoFamilyId', famId, 'FAM-••••');
  document.getElementById('infoHeadName').textContent = head ? head.fullName : 'Rahul Sharma';
  setSensitiveField('infoDwellingRef', dwellRef, 'D-•••');
  document.getElementById('infoDwellingType').textContent = currentHousehold.dwellingType || 'Kutcha';
  setSensitiveField('infoRationCard', rcNo, 'RC-UP-••••-••••');
  document.getElementById('infoIncomeCat').textContent = `${currentHousehold.incomeCategory || 'BPL'} (₹${currentHousehold.annualIncome?.toLocaleString('en-IN') || '1,20,000'}/yr)`;
  
  const addr = currentHousehold.address;
  if (addr) {
    document.getElementById('infoAddress').textContent = `${addr.district}, ${addr.state} - ${addr.pincode}`;
  }

  // Pending documents list in sidebar
  const pendingDocs = allDocuments.filter(d => d.verificationStatus === 'Pending Verification');
  const sidePendingCount = document.getElementById('sidePendingDocCount');
  const sidePendingList = document.getElementById('sidePendingDocsList');

  if (sidePendingCount) {
    sidePendingCount.textContent = `${pendingDocs.length} Pending`;
  }

  if (sidePendingList) {
    if (pendingDocs.length === 0) {
      sidePendingList.innerHTML = `<div style="color:var(--success-text); padding: 8px 0;">✅ All uploaded documents are verified!</div>`;
    } else {
      sidePendingList.innerHTML = pendingDocs.map(d => `
        <div style="padding: 6px 0; border-bottom: 1px dashed var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <span style="color:var(--text-main); font-weight: 500;">${d.documentType}</span>
          <span class="badge badge-warning" style="font-size:0.65rem;">Pending</span>
        </div>
      `).join('');
    }
  }
}

// Render All Schemes Tab
function renderAllSchemesTab() {
  const container = document.getElementById('allSchemesGrid');
  if (!container) return;

  container.innerHTML = allSchemes.map(s => createSchemeCardHtml(s)).join('');
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

// Render Applications Table
function renderApplicationsTable() {
  const tbody = document.getElementById('applicationsTableBody');
  if (!tbody) return;

  if (allApplications.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No recorded applications</td></tr>`;
    return;
  }

  tbody.innerHTML = allApplications.map(app => {
    let statusBadge = `<span class="badge badge-submitted">${app.status}</span>`;
    if (app.status === 'Approved') statusBadge = `<span class="badge badge-approved">Approved</span>`;
    if (app.status === 'Rejected') statusBadge = `<span class="badge badge-rejected">Rejected</span>`;
    if (app.status === 'Additional Information Required') statusBadge = `<span class="badge badge-warning">More Info Req</span>`;

    const dupBadge = app.duplicateCheckResult && app.duplicateCheckResult.isPotentialDuplicate
      ? `<span class="badge badge-danger">⚠️ Potential Duplicate</span>`
      : `<span class="badge badge-verified">Clear</span>`;

    return `
      <tr>
        <td><strong>${app.applicationId}</strong></td>
        <td>${app.schemeName}</td>
        <td><span class="badge ${app.benefitType === 'Household' ? 'badge-saffron' : 'badge-info'}">${app.benefitType}</span></td>
        <td>${app.applicantName} <div style="font-size:0.75rem; color:var(--text-muted);">${app.applicantCitizenId}</div></td>
        <td>${app.dwellingReference || 'N/A'}</td>
        <td>${statusBadge}</td>
        <td>${dupBadge}</td>
        <td>
          <button onclick="viewApplicationDetail('${app.applicationId}')" class="btn btn-secondary btn-sm">
            <i data-lucide="eye" style="width:12px;height:12px;"></i> View
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Document Vault
function renderDocumentVault() {
  const container = document.getElementById('documentVaultGrid');
  if (!container) return;

  if (allDocuments.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No documents in vault. Click "Upload New Document" to register one.</div>`;
    return;
  }

  container.innerHTML = allDocuments.map(doc => {
    let statusBadge = `<span class="badge badge-verified"><i data-lucide="check-circle" style="width:10px;height:10px;"></i> Verified</span>`;
    if (doc.verificationStatus === 'Pending Verification') {
      statusBadge = `<span class="badge badge-warning"><i data-lucide="clock" style="width:10px;height:10px;"></i> Pending Review</span>`;
    } else if (doc.verificationStatus === 'Rejected') {
      statusBadge = `<span class="badge badge-danger"><i data-lucide="x-circle" style="width:10px;height:10px;"></i> Rejected</span>`;
    }

    return `
      <div class="card" style="padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: #eff6ff; color: #2563eb; display:flex; align-items:center; justify-content:center;">
              <i data-lucide="file-text"></i>
            </div>
            ${statusBadge}
          </div>
          <h4 style="font-size: 0.95rem; margin-bottom: 4px; color: var(--primary);">${doc.title}</h4>
          <div style="font-size: 0.78rem; color: var(--accent-saffron); font-weight: 600; margin-bottom: 8px;">
            ${doc.documentType} • <span style="color:var(--text-muted);">${doc.scope} Level</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.45;">
            Ref: <strong>${doc.maskedReferenceNo || 'N/A'}</strong><br>
            Issuer: ${doc.issuingAuthority || 'Govt. of UP'}<br>
            ${doc.citizenName ? `Citizen: <strong>${doc.citizenName}</strong>` : `Household: <strong>${doc.familyId}</strong>`}
          </div>
          ${doc.officerRemarks ? `
            <div style="margin-top: 8px; padding: 6px 8px; background: #f8fafc; border-radius: 6px; font-size: 0.75rem; color: var(--text-muted); border: 1px solid #e2e8f0;">
              <strong>Officer Note:</strong> ${doc.officerRemarks}
            </div>
          ` : ''}
        </div>

        <div style="margin-top: 14px; pt-2; border-top: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size: 0.75rem; color: var(--text-muted);">${doc.fileSize || 'PDF'}</span>
          <button onclick="previewDocument('${doc.documentId}')" class="btn btn-secondary btn-sm" style="font-size: 0.75rem;">
            <i data-lucide="external-link" style="width:12px;height:12px;"></i> View Document
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Render Family Members Tab & Interactive SVG Graph
function renderFamilyMembersTab() {
  if (!currentHousehold) return;

  const tbody = document.getElementById('familyMembersTableBody');
  const familyTableId = document.getElementById('familyTableId');
  if (familyTableId) familyTableId.textContent = currentHousehold.familyId;

  const headerId = document.getElementById('familyHeaderId');
  if (headerId) headerId.textContent = currentHousehold.familyId;

  const headMember = currentMembers.find(m => m.citizenId === currentHousehold.headCitizenId) || currentMembers[0];
  const headerHeadName = document.getElementById('familyHeaderHeadName');
  if (headerHeadName) headerHeadName.textContent = headMember ? headMember.fullName : 'Not specified';

  const headerMemberCount = document.getElementById('familyHeaderMemberCount');
  if (headerMemberCount) headerMemberCount.textContent = currentMembers.length;

  const headerDwelling = document.getElementById('familyHeaderDwelling');
  if (headerDwelling) headerDwelling.textContent = currentHousehold.dwellingReference || 'D-104';

  if (tbody) {
    if (currentMembers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No members registered in this household.</td></tr>`;
    } else {
      tbody.innerHTML = currentMembers.map(m => {
        const isHead = m.isHeadOfFamily || m.citizenId === currentHousehold.headCitizenId;

        // Resolve relationship to household head
        let relType = isHead ? 'Self (Head)' : 'Member';
        if (!isHead && currentRelationships) {
          const foundRel = currentRelationships.find(r => 
            r.isActive !== false && (
              (r.citizenId1 === m.citizenId && r.citizenId2 === currentHousehold.headCitizenId) ||
              (r.citizenId2 === m.citizenId && r.citizenId1 === currentHousehold.headCitizenId)
            )
          );
          if (foundRel) {
            relType = foundRel.relationshipType;
          }
        }

        // Verification Status Badge
        let statusBadge = `<span class="badge badge-verified" title="Officially verified"><i data-lucide="check-circle" style="width:11px;height:11px;"></i> Verified</span>`;
        if (m.verificationStatus === 'Pending Verification' || !m.verificationStatus) {
          statusBadge = `<span class="badge badge-warning" title="Simulated verification match pending officer review"><i data-lucide="clock" style="width:11px;height:11px;"></i> Pending Review</span>`;
        } else if (m.verificationStatus === 'Under Review') {
          statusBadge = `<span class="badge badge-warning" title="Under officer review"><i data-lucide="search" style="width:11px;height:11px;"></i> In Review</span>`;
        } else if (m.verificationStatus === 'Rejected') {
          statusBadge = `<span class="badge badge-danger" title="Verification rejected"><i data-lucide="x-circle" style="width:11px;height:11px;"></i> Rejected</span>`;
        }

        return `
          <tr>
            <td><strong style="color:var(--primary);">${m.citizenId}</strong></td>
            <td>
              <strong>${m.fullName}</strong>
              ${isHead ? `<span class="badge badge-saffron" style="margin-left:6px; font-size:0.65rem;">Head</span>` : ''}
            </td>
            <td><span class="badge badge-info" style="font-size:0.75rem;">${relType}</span></td>
            <td>${m.age || 0} yrs • ${m.gender}</td>
            <td>${statusBadge}</td>
            <td>${m.occupation || 'Resident'}</td>
            <td>${m.isFarmer ? `🌾 Farmer (${m.landholdingHectares || 0} Ha)` : 'Non-Farmer'}</td>
            <td>
              <div style="display:flex; gap:6px; align-items:center;">
                <button onclick="viewMemberDetails('${m.citizenId}')" class="btn btn-secondary btn-sm" title="View full member details">
                  <i data-lucide="eye" style="width:12px;height:12px;"></i> Details
                </button>
                <button onclick="openCorrectionForCitizen('${m.citizenId}')" class="btn btn-secondary btn-sm" title="Request profile correction">
                  <i data-lucide="edit-3" style="width:12px;height:12px;"></i> Correct
                </button>
                ${!isHead ? `
                  <button onclick="openRemoveMemberModal('${m.citizenId}')" class="btn btn-danger btn-sm" title="Remove member from household">
                    <i data-lucide="user-minus" style="width:12px;height:12px;"></i>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Render SVG Relationship Tree Graph
  renderFamilyTree('familyTreeSvgContainer', currentMembers, currentRelationships);
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Open Add Member Modal
function openAddMemberModal() {
  try {
    const form = document.getElementById('addMemberForm');
    if (form) form.reset();
    const landWrap = document.getElementById('addMemLandWrap');
    if (landWrap) landWrap.style.display = 'none';
    const btn = document.getElementById('btnAddMemberSubmit');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add to Household';
    }
  } catch (err) {
    console.warn('Error preparing add member modal:', err);
  }
  openModal('addMemberModal');
}
window.openAddMemberModal = openAddMemberModal;

// Toggle Land Field based on Farmer Checkbox
function toggleFarmerLandField() {
  const isFarmer = document.getElementById('addMemIsFarmer')?.checked;
  const landWrap = document.getElementById('addMemLandWrap');
  if (landWrap) {
    landWrap.style.display = isFarmer ? 'block' : 'none';
  }
}

// Handle Add Member Form Submit
async function handleAddMemberSubmit(e) {
  e.preventDefault();
  if (!currentHousehold) {
    showToast('No active household session found.', 'error');
    return;
  }

  const btn = document.getElementById('btnAddMemberSubmit');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Adding member...';
  }

  const fullName = document.getElementById('addMemFullName').value.trim();
  const dob = document.getElementById('addMemDob').value;
  const gender = document.getElementById('addMemGender').value;
  const relationship = document.getElementById('addMemRelationship').value;
  const occupation = document.getElementById('addMemOccupation').value.trim();
  const education = document.getElementById('addMemEducation').value.trim();
  const category = document.getElementById('addMemCategory').value;
  const isFarmer = document.getElementById('addMemIsFarmer').checked;
  const landholdingHectares = Number(document.getElementById('addMemLandholding')?.value) || 0;
  const hasDisability = document.getElementById('addMemHasDisability').checked;
  const certificateType = document.getElementById('addMemCertType').value;
  const certificateId = document.getElementById('addMemCertId').value.trim();

  try {
    const res = await api.addHouseholdMember(currentHousehold.familyId, {
      fullName,
      dob,
      gender,
      relationship,
      occupation,
      education,
      category,
      isFarmer,
      landholdingHectares,
      hasDisability,
      certificateType: certificateType || undefined,
      certificateId: certificateId || undefined
    });

    closeModal('addMemberModal');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add to Household';
    }

    showToast(`Family member ${fullName} (${res.member.citizenId}) added in 'Pending Verification' status!`, 'success');
    if (res.syntheticMatch) {
      showToast('Simulated Match: Identity matched synthetic test dataset. Pending official officer approval.', 'info');
    }

    await refreshDashboardData();
    renderFamilyMembersTab();
    if (typeof renderFamilyTree === 'function') {
      renderFamilyTree('familyTreeSvgContainer', currentMembers, currentRelationships);
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add to Household';
    }
    showToast(err.message, 'error');
  }
}

// Helper to toggle IDs within member details modal
window.toggleModalSensitiveField = function(elId, realVal, maskedVal) {
  const el = document.getElementById(elId);
  const icon = document.getElementById(`${elId}-icon`);
  if (!el) return;
  const isHidden = el.textContent.includes('•') || el.textContent.includes('*');
  el.textContent = isHidden ? realVal : maskedVal;
  if (icon) {
    icon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
    if (window.lucide) lucide.createIcons();
  }
};

// View Member Details Modal (Interactive Profile, Documents & Schemes)
async function viewMemberDetails(citizenId) {
  if (!currentHousehold) return;

  const content = document.getElementById('memDetailContent');
  const title = document.getElementById('memDetailModalTitle');
  if (content) content.innerHTML = '<div style="padding:24px; text-align:center;">Loading member details...</div>';
  openModal('memberDetailsModal');

  try {
    const res = await api.getHouseholdMember(currentHousehold.familyId, citizenId);
    const m = res.member;
    const rels = res.relationships || [];
    const history = res.membershipHistory || [];
    const audit = res.auditTrail || [];

    if (title) title.textContent = `Member Profile: ${m.fullName}`;

    let statusBadge = `<span class="badge badge-verified"><i data-lucide="check-circle" style="width:12px;height:12px;"></i> Verified Member</span>`;
    if (m.verificationStatus === 'Pending Verification' || !m.verificationStatus) {
      statusBadge = `<span class="badge badge-warning"><i data-lucide="clock" style="width:12px;height:12px;"></i> Pending Review</span>`;
    } else if (m.verificationStatus === 'Under Review') {
      statusBadge = `<span class="badge badge-warning"><i data-lucide="search" style="width:12px;height:12px;"></i> Under Officer Review</span>`;
    } else if (m.verificationStatus === 'Rejected') {
      statusBadge = `<span class="badge badge-danger"><i data-lucide="x-circle" style="width:12px;height:12px;"></i> Rejected</span>`;
    }

    const verificationNote = m.verificationDetails?.note || 'Standard profile review.';
    const isSimulated = m.verificationDetails?.isSimulated ? 'Simulated Test Record (Fictional)' : 'Live Mode';
    const syntheticMatch = m.verificationDetails?.syntheticVerificationMatch ? '✅ Matched Synthetic Dataset' : 'Self-Declared / Pending Match';

    // 1. Linked Documents for this member
    const memberDocs = (allDocuments || []).filter(d => 
      d.citizenId === citizenId || 
      (d.metadata && d.metadata.citizenId === citizenId) || 
      (d.uploadedBy === citizenId) ||
      (d.documentName && d.documentName.toLowerCase().includes(m.fullName.toLowerCase()))
    );

    let docsHtml = '';
    if (memberDocs.length > 0) {
      docsHtml = memberDocs.map(d => `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <div style="font-weight:600; font-size:0.85rem; color:var(--primary); display:flex; align-items:center; gap:6px;">
              <i data-lucide="file-text" style="width:14px; height:14px; color:#2563eb;"></i>
              ${d.documentType || d.documentName}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
              Doc ID: <code>${d.documentId}</code> • ${d.fileFormat || 'PDF'} • ${new Date(d.uploadedAt).toLocaleDateString()}
            </div>
          </div>
          <div>
            <span class="badge ${d.verificationStatus === 'Verified' ? 'badge-verified' : 'badge-warning'}" style="font-size:0.72rem;">
              ${d.verificationStatus}
            </span>
          </div>
        </div>
      `).join('');
    } else {
      docsHtml = `
        <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; padding:14px; text-align:center; font-size:0.8rem; color:var(--text-muted);">
          No documents uploaded for ${m.fullName} yet.
          <div style="margin-top:8px;">
            <button type="button" onclick="closeModal('memberDetailsModal'); openUploadDocModal();" class="btn btn-secondary btn-sm" style="font-size:0.75rem;">
              <i data-lucide="upload" style="width:12px;height:12px;"></i> Upload Member Document
            </button>
          </div>
        </div>
      `;
    }

    // 2. Welfare Schemes & Entitlements for this member
    const memberSchemes = [];
    if (m.isFarmer) {
      memberSchemes.push({
        name: 'PM-KISAN Samman Nidhi',
        tag: 'Individual Entitlement',
        badge: 'badge-verified',
        benefit: '₹6,000 / year direct benefit transfer in 3 quad-monthly installments',
        action: "closeModal('memberDetailsModal'); checkEligibilityLive('SCH-PM-KISAN');"
      });
    }
    if (m.isHeadOfFamily && currentHousehold.dwellingType === 'Kutcha') {
      memberSchemes.push({
        name: 'Pradhan Mantri Awas Yojana (PMAY-G)',
        tag: 'Household Housing Grant',
        badge: 'badge-saffron',
        benefit: '₹1,20,000 pucca housing grant for homeless/kutcha dwellings',
        action: "closeModal('memberDetailsModal'); checkEligibilityLive('SCH-PMAY-G');"
      });
    }
    if (m.occupation === 'Student' || m.age < 22) {
      memberSchemes.push({
        name: 'National Pre-Matric / Post-Matric Scholarship',
        tag: 'Education Welfare',
        badge: 'badge-info',
        benefit: 'Annual education stipend, tuition reimbursement and book support',
        action: "closeModal('memberDetailsModal'); switchTab('schemes');"
      });
    }
    if (m.age >= 60) {
      memberSchemes.push({
        name: 'Indira Gandhi National Old Age Pension (IGNOAPS)',
        tag: 'Social Security',
        badge: 'badge-verified',
        benefit: 'Monthly old age pension of ₹1,000 directly to bank account',
        action: "closeModal('memberDetailsModal'); switchTab('schemes');"
      });
    }
    if (m.hasDisability) {
      memberSchemes.push({
        name: 'Divyangjan Disability Welfare Support',
        tag: 'Special Assistance',
        badge: 'badge-saffron',
        benefit: 'Monthly financial assistance, assistive aids & travel concessions',
        action: "closeModal('memberDetailsModal'); switchTab('schemes');"
      });
    }
    // Universal Household Schemes
    memberSchemes.push({
      name: 'Ayushman Bharat PM-JAY Health Protection',
      tag: 'Household Health Entitlement',
      badge: 'badge-verified',
      benefit: '₹5,00,000 annual cashless health cover per family for secondary & tertiary hospitalization',
      action: "closeModal('memberDetailsModal'); switchTab('schemes');"
    });
    memberSchemes.push({
      name: 'NFSA National Food Security Antyodaya',
      tag: 'Food Security Quota',
      badge: 'badge-verified',
      benefit: '35 kg monthly subsidized foodgrain allocation via Fair Price Shop',
      action: "closeModal('memberDetailsModal'); switchTab('schemes');"
    });

    const schemesHtml = memberSchemes.map(s => `
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong style="color:var(--primary); font-size:0.875rem;">${s.name}</strong>
            <span class="badge ${s.badge}" style="font-size:0.65rem;">${s.tag}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px; line-height:1.35;">${s.benefit}</div>
        </div>
        <button type="button" onclick="${s.action}" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 10px; white-space:nowrap;">
          Check Entitlement
        </button>
      </div>
    `).join('');

    // 3. Relationships & History
    const relationshipList = rels.map(r => {
      const otherId = r.citizenId1 === citizenId ? r.citizenId2 : r.citizenId1;
      const otherCit = currentMembers.find(c => c.citizenId === otherId);
      return `<li><strong>${r.relationshipType}</strong> to ${otherCit ? otherCit.fullName : otherId} (<code>${otherId}</code>)</li>`;
    }).join('') || '<li>Household member</li>';

    const historyList = history.map(h => `
      <div style="font-size:0.78rem; padding:6px 0; border-bottom:1px dashed #e2e8f0;">
        Joined <strong>${h.familyId}</strong> on ${new Date(h.startDate).toLocaleDateString()}
        ${h.endDate ? ` • Exited: ${new Date(h.endDate).toLocaleDateString()} (${h.exitReason || 'Relocated'})` : ' • <strong>Current Household</strong>'}
      </div>
    `).join('') || '<div style="font-size:0.8rem; color:#64748b;">No prior household moves recorded.</div>';

    // Masked values for IDs
    const rawCitId = m.citizenId || 'CIT-1001';
    const maskedCitId = 'CIT-••••';
    const rawAadhaar = m.maskedAadhaar || 'XXXX-XXXX-9842';
    const maskedAadhaar = 'XXXX-XXXX-••••';
    const rawFamId = m.currentFamilyId || currentHousehold.familyId;
    const maskedFamId = 'FAM-••••';

    content.innerHTML = `
      <!-- Member Overview Header Box -->
      <div style="background: linear-gradient(135deg, #0f284e 0%, #1e3a8a 100%); color:#ffffff; border-radius:10px; padding:18px 20px; margin-bottom:18px; box-shadow:0 4px 12px rgba(15,40,78,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:1.8rem;">${m.gender === 'Female' ? '👩' : (m.age < 18 ? '👦' : '👨')}</span>
              <div>
                <h3 style="font-size:1.25rem; margin:0; color:#fed7aa; display:flex; align-items:center; gap:8px;">
                  ${m.fullName}
                  ${m.isHeadOfFamily ? '<span class="badge badge-saffron" style="font-size:0.65rem;">Head of Family</span>' : ''}
                </h3>
                <div style="font-size:0.8rem; color:#cbd5e1; margin-top:2px;">
                  ${m.age || 0} years old • ${m.gender} • ${m.occupation || 'Resident'}
                </div>
              </div>
            </div>
          </div>
          <div>${statusBadge}</div>
        </div>

        <!-- IDs Row with Eye Mask Toggles -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-top:16px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.15);">
          <!-- Citizen ID -->
          <div style="background:rgba(255,255,255,0.1); border-radius:6px; padding:8px 12px; font-size:0.78rem;">
            <div style="color:#cbd5e1; font-size:0.7rem;">Citizen ID:</div>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:2px;">
              <strong id="modalMemCitId" style="color:#ffffff; font-family:monospace; font-size:0.85rem;">${maskedCitId}</strong>
              <button type="button" class="eye-toggle-btn" onclick="toggleModalSensitiveField('modalMemCitId', '${rawCitId}', '${maskedCitId}')" title="Toggle Citizen ID">
                <i data-lucide="eye" id="modalMemCitId-icon" style="width:13px;height:13px;"></i>
              </button>
            </div>
          </div>

          <!-- Masked Aadhaar -->
          <div style="background:rgba(255,255,255,0.1); border-radius:6px; padding:8px 12px; font-size:0.78rem;">
            <div style="color:#cbd5e1; font-size:0.7rem;">Aadhaar Ref:</div>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:2px;">
              <strong id="modalMemAadhaar" style="color:#ffffff; font-family:monospace; font-size:0.85rem;">${maskedAadhaar}</strong>
              <button type="button" class="eye-toggle-btn" onclick="toggleModalSensitiveField('modalMemAadhaar', '${rawAadhaar}', '${maskedAadhaar}')" title="Toggle Aadhaar">
                <i data-lucide="eye" id="modalMemAadhaar-icon" style="width:13px;height:13px;"></i>
              </button>
            </div>
          </div>

          <!-- Family ID -->
          <div style="background:rgba(255,255,255,0.1); border-radius:6px; padding:8px 12px; font-size:0.78rem;">
            <div style="color:#cbd5e1; font-size:0.7rem;">Household Family ID:</div>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:2px;">
              <strong id="modalMemFamId" style="color:#ffffff; font-family:monospace; font-size:0.85rem;">${maskedFamId}</strong>
              <button type="button" class="eye-toggle-btn" onclick="toggleModalSensitiveField('modalMemFamId', '${rawFamId}', '${maskedFamId}')" title="Toggle Family ID">
                <i data-lucide="eye" id="modalMemFamId-icon" style="width:13px;height:13px;"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Demographics & Attributes Grid -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:18px;">
        <h4 style="font-size:0.88rem; color:var(--primary); margin-bottom:10px; display:flex; align-items:center; gap:6px;">
          <i data-lucide="user-check" style="width:15px;height:15px;color:#2563eb;"></i>
          Demographic & Socio-Economic Details
        </h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.825rem;">
          <div><span style="color:var(--text-muted);">Date of Birth:</span> <strong>${m.dob} (${m.age || 0} yrs)</strong></div>
          <div><span style="color:var(--text-muted);">Gender:</span> <strong>${m.gender}</strong></div>
          <div><span style="color:var(--text-muted);">Occupation:</span> <strong>${m.occupation || 'Resident'}</strong></div>
          <div><span style="color:var(--text-muted);">Education:</span> <strong>${m.education || 'Not Specified'}</strong></div>
          <div><span style="color:var(--text-muted);">Social Category:</span> <strong>${m.category || 'General'}</strong></div>
          <div><span style="color:var(--text-muted);">Farmer Status:</span> <strong>${m.isFarmer ? `🌾 Farmer (${m.landholdingHectares || 0} Ha)` : 'Non-Farmer'}</strong></div>
          <div><span style="color:var(--text-muted);">Disability:</span> <strong>${m.hasDisability ? 'Benchmark Disability' : 'None'}</strong></div>
          <div><span style="color:var(--text-muted);">Headship:</span> <strong>${m.isHeadOfFamily ? 'Head of Household' : 'Household Member'}</strong></div>
        </div>
      </div>

      <!-- SECTION 1: Member's Linked Documents -->
      <div style="margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h4 style="font-size:0.9rem; color:var(--primary); margin:0; display:flex; align-items:center; gap:6px;">
            <i data-lucide="folder-lock" style="width:15px;height:15px;color:#d97706;"></i>
            Linked Official Documents (${memberDocs.length})
          </h4>
          <button type="button" onclick="closeModal('memberDetailsModal'); openUploadDocModal();" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:3px 8px;">
            <i data-lucide="plus" style="width:11px;height:11px;"></i> Upload Document
          </button>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
          ${docsHtml}
        </div>
      </div>

      <!-- SECTION 2: Member's Eligible Schemes & Entitlements -->
      <div style="margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h4 style="font-size:0.9rem; color:var(--primary); margin:0; display:flex; align-items:center; gap:6px;">
            <i data-lucide="award" style="width:15px;height:15px;color:#16a34a;"></i>
            Welfare Schemes & Entitlements (${memberSchemes.length})
          </h4>
          <span style="font-size:0.72rem; color:var(--text-muted);">Evaluated for ${m.fullName}</span>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
          ${schemesHtml}
        </div>
      </div>

      <!-- SECTION 3: Relationships & History -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px;">
        <div>
          <h4 style="font-size:0.85rem; color:var(--primary); margin-bottom:6px;">Household Relationships</h4>
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; font-size:0.8rem; max-height:130px; overflow-y:auto;">
            <ul style="margin:0; padding-left:16px;">${relationshipList}</ul>
          </div>
        </div>

        <div>
          <h4 style="font-size:0.85rem; color:var(--primary); margin-bottom:6px;">Membership History</h4>
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; font-size:0.8rem; max-height:130px; overflow-y:auto;">
            ${historyList}
          </div>
        </div>
      </div>

      <!-- SECTION 4: Direct Action Desk for this member -->
      <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <strong style="color:#9a3412; font-size:0.825rem;">Member Service Actions:</strong>
          <div style="font-size:0.75rem; color:#78350f;">Request profile corrections, upload certificates, or initiate household separation.</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" onclick="closeModal('memberDetailsModal'); openCorrectionForCitizen('${m.citizenId}');" class="btn btn-secondary btn-sm" style="font-size:0.75rem;">
            <i data-lucide="edit-3" style="width:12px;height:12px;"></i> Correct Profile
          </button>
          ${!m.isHeadOfFamily && m.age >= 18 ? `
            <button type="button" onclick="closeModal('memberDetailsModal'); switchTab('separation'); openSeparationWizard();" class="btn btn-saffron btn-sm" style="font-size:0.75rem;">
              <i data-lucide="git-branch" style="width:12px;height:12px;"></i> Request Separation
            </button>
          ` : ''}
          ${!m.isHeadOfFamily ? `
            <button type="button" onclick="closeModal('memberDetailsModal'); openRemoveMemberModal('${m.citizenId}');" class="btn btn-danger btn-sm" style="font-size:0.75rem;">
              <i data-lucide="user-minus" style="width:12px;height:12px;"></i> Remove
            </button>
          ` : ''}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    content.innerHTML = `<div style="padding:20px; text-align:center; color:var(--danger-text);">Failed to load member details: ${err.message}</div>`;
  }
}

// Open Remove Member Modal
function openRemoveMemberModal(citizenId) {
  if (!currentHousehold) return;
  const m = currentMembers.find(c => c.citizenId === citizenId);
  if (!m) {
    showToast('Member not found.', 'error');
    return;
  }

  if (m.isHeadOfFamily || m.citizenId === currentHousehold.headCitizenId) {
    showToast('Cannot remove the household head. Use Household Separation or transfer headship before removal.', 'error');
    return;
  }

  document.getElementById('removeMemberCitizenId').value = citizenId;
  document.getElementById('removeMemberNameDisplay').textContent = m.fullName;
  document.getElementById('removeMemberIdDisplay').textContent = citizenId;
  document.getElementById('removeMemberFamilyDisplay').textContent = currentHousehold.familyId;
  document.getElementById('removeMemberReason').value = '';
  const wrap = document.getElementById('removeMemberOtherReasonWrap');
  if (wrap) wrap.style.display = 'none';

  openModal('removeMemberModal');
}

// Handle Remove Member Submit
async function handleRemoveMemberSubmit(e) {
  e.preventDefault();
  if (!currentHousehold) return;

  const citizenId = document.getElementById('removeMemberCitizenId').value;
  let reason = document.getElementById('removeMemberReason').value;
  if (reason.startsWith('Other')) {
    const otherDetails = document.getElementById('removeMemberOtherReason')?.value.trim();
    reason = otherDetails ? `Other: ${otherDetails}` : 'Other';
  }

  const btn = document.getElementById('btnConfirmRemoveMember');
  btn.disabled = true;
  btn.textContent = 'Removing member...';

  try {
    const res = await api.removeHouseholdMember(currentHousehold.familyId, citizenId, reason);
    closeModal('removeMemberModal');
    btn.disabled = false;
    btn.textContent = 'Confirm Removal';

    showToast(res.message, 'success');
    await refreshDashboardData();
    renderFamilyMembersTab();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Confirm Removal';
    showToast(err.message, 'error');
  }
}

// Render Household Separation Tab
async function renderSeparationTab() {
  const container = document.getElementById('separationRequestsContainer');
  if (!container) return;

  try {
    const res = await api.getSeparationRequests();
    const requests = res.requests;

    if (requests.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 36px; background: #ffffff; border-radius: 10px; border: 1px dashed var(--border-color);">
          <div style="font-size: 2rem; margin-bottom: 8px;">👨‍👩‍👦 ➔ 🏠 🏠</div>
          <h4 style="color: var(--primary); margin-bottom: 6px;">No Active Household Separation Requests</h4>
          <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 500px; margin: 0 auto 16px;">
            Adult members moving to a separate residence can request official household separation to receive an independent Family ID while keeping their Citizen ID and family bonds intact.
          </p>
          <button onclick="openSeparationWizard()" class="btn btn-saffron btn-sm">
            <i data-lucide="git-branch"></i> Start Separation Request
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = requests.map(r => {
      let statusBadge = `<span class="badge badge-pending">Pending Officer Review</span>`;
      if (r.status === 'Approved') {
        statusBadge = `<span class="badge badge-verified">Approved • Separate Household Established</span>`;
      } else if (r.status === 'Rejected') {
        statusBadge = `<span class="badge badge-danger">Rejected</span>`;
      }

      const movingNames = r.movingMembers ? r.movingMembers.map(m => m.name).join(', ') : r.movingCitizenIds.join(', ');

      return `
        <div class="card" style="padding: 20px; margin-bottom: 16px; border-left: 4px solid ${r.status === 'Approved' ? '#16a34a' : (r.status === 'Rejected' ? '#dc2626' : '#ea580c')};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
            <div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Tracking ID:</span>
              <strong style="color: var(--primary); font-size: 1rem; margin-left: 4px;">${r.requestId}</strong>
            </div>
            ${statusBadge}
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; font-size: 0.85rem; margin-bottom: 12px;">
            <div>
              <span style="color: var(--text-muted);">Moving Member(s):</span><br>
              <strong>${movingNames}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted);">Proposed New Address:</span><br>
              <strong>${r.newAddress ? `${r.newAddress.line1}, ${r.newAddress.district}` : 'Ward 3, Rampur'}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted);">Separation Date:</span><br>
              <strong>${r.separationDate}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted);">Internal Family ID:</span><br>
              <strong style="color: ${r.generatedNewFamilyId ? '#16a34a' : 'var(--secondary)'};">${r.generatedNewFamilyId || 'Assigned Upon Official Approval'}</strong>
            </div>
          </div>

          <div style="font-size: 0.8rem; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="margin-bottom: 6px;"><strong>Separation Grounds:</strong> ${r.reason}</div>
            ${r.officerReview ? `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; color: ${r.officerReview.decision === 'Approved' ? '#166534' : '#991b1b'};">
                <strong>Officer Decision (${r.officerReview.decision}):</strong> ${r.officerReview.mandatoryReason || r.officerReview.remarks}
                <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">— Verified by ${r.officerReview.officerName}</span>
              </div>
            ` : ''}
            ${r.status === 'Approved' ? `
              <div style="margin-top: 10px; padding: 10px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0; font-size: 0.78rem; color: #166534;">
                <div style="font-weight: 700; margin-bottom: 4px;">🏡 New Independent Household Active: ${r.generatedNewFamilyId}</div>
                <div>• Separated citizens now appear in the new household's family tree.</div>
                <div>• Stable Citizen IDs and individual personal profiles are preserved.</div>
                <div>• New account credentials: User ID <code>${r.generatedNewFamilyId}</code> (Default Password: <code>citizen123</code>).</div>
                <div style="margin-top: 4px; font-size: 0.73rem; color: #64748b;">
                  <em>Disclaimer: Local JanSetu System Household ID (Not an official National Family ID). Separation does not grant automatic welfare benefits or alter official state records.</em>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load separations:', err);
  }
}

// Render Profile Corrections Tab
async function renderCorrectionsTab() {
  const container = document.getElementById('correctionsListContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 24px; color: var(--text-muted);">
      <div class="spinner" style="margin: 0 auto 10px auto;"></div>
      Loading official correction requests...
    </div>
  `;

  try {
    const res = await api.getProfileCorrections();
    const corrections = res.corrections || [];

    if (corrections.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted); background: #f8fafc; border-radius: 8px; border: 1px dashed var(--border-color);">
          <i data-lucide="file-text" style="width: 36px; height: 36px; color: var(--text-light); margin-bottom: 8px;"></i>
          <div style="font-weight: 600; font-size: 0.95rem; color: var(--primary);">No Profile Correction Requests Lodged</div>
          <div style="font-size: 0.825rem; margin-top: 4px;">Click "Request New Correction" above if any official citizen profile record needs legal updating.</div>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = corrections.map(c => {
      let statusBadgeClass = 'badge-pending';
      let borderLeftColor = '#f59e0b';

      if (c.status === 'Approved') {
        statusBadgeClass = 'badge-verified';
        borderLeftColor = '#16a34a';
      } else if (c.status === 'Rejected') {
        statusBadgeClass = 'badge-danger';
        borderLeftColor = '#dc2626';
      } else if (c.status === 'Additional Evidence Required') {
        statusBadgeClass = 'badge-warning';
        borderLeftColor = '#ea580c';
      } else if (c.status === 'Under Review') {
        statusBadgeClass = 'badge-info';
        borderLeftColor = '#3b82f6';
      }

      const docLabel = c.documentType === 'Other' && c.otherDocumentType 
        ? `Other: ${c.otherDocumentType}` 
        : (c.documentType || 'Official Document');

      const officerRemarks = c.officerComment || (c.officerReview ? c.officerReview.officerRemarks : null);
      const docUrl = api.getCorrectionDocumentUrl(c.requestId);
      const submissionDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently';

      return `
        <div class="card" style="padding: 18px; margin-bottom: 16px; border-left: 5px solid ${borderLeftColor}; background: #fff; box-shadow: var(--shadow-sm);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px; margin-bottom: 10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:700; color:var(--primary); font-size:0.95rem;">${c.requestId}</span>
                <span style="font-size:0.8rem; color:var(--text-muted);">&bull; Submitted ${submissionDate}</span>
              </div>
              <div style="font-size: 0.85rem; color: #334155; margin-top: 2px;">
                Citizen: <strong>${c.citizenName || c.citizenId}</strong> <span style="color:var(--text-muted);">(${c.citizenId})</span>
              </div>
            </div>
            <span class="badge ${statusBadgeClass}">${c.status}</span>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom: 12px; font-size: 0.85rem;">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
              <div>
                <span style="color:var(--text-muted); font-size:0.775rem; text-transform:uppercase; letter-spacing:0.5px; display:block;">Field to Correct</span>
                <strong style="color:var(--primary); font-size:0.9rem;">${c.fieldToCorrect}</strong>
              </div>
              <div>
                <span style="color:var(--text-muted); font-size:0.775rem; text-transform:uppercase; letter-spacing:0.5px; display:block;">Recorded Current Value</span>
                <span style="color:#64748b; text-decoration: line-through;">${c.currentValue || 'None recorded'}</span>
              </div>
              <div>
                <span style="color:var(--text-muted); font-size:0.775rem; text-transform:uppercase; letter-spacing:0.5px; display:block;">Requested New Value</span>
                <strong style="color:#15803d; font-size:0.9rem;">${c.requestedValue || c.proposedValue}</strong>
              </div>
            </div>
          </div>

          <div style="font-size: 0.85rem; color: #475569; margin-bottom: 12px;">
            <strong>Reason for Correction:</strong> ${c.reason}
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:#f1f5f9; padding:8px 12px; border-radius:6px; font-size:0.825rem;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="background:#ef4444; color:#fff; font-size:0.7rem; font-weight:700; padding:2px 5px; border-radius:3px;">PDF</span>
              <span>Evidence: <strong>${docLabel}</strong> ${c.fileSize ? `(${(c.fileSize / 1024).toFixed(1)} KB)` : ''}</span>
            </div>
            <a href="${docUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size:0.775rem; display:inline-flex; align-items:center; gap:4px;">
              <i data-lucide="external-link" style="width:14px; height:14px;"></i> View Attached PDF
            </a>
          </div>

          ${c.status === 'Additional Evidence Required' ? `
            <div style="margin-top:12px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:12px;">
              <div style="font-weight:700; color:#92400e; font-size:0.85rem; display:flex; align-items:center; gap:6px;">
                <i data-lucide="alert-circle" style="width:16px; height:16px; color:#d97706;"></i> Action Required: Officer Requested Additional Evidence
              </div>
              <div style="font-size:0.825rem; color:#78350f; margin-top:4px;">
                Officer Remarks: ${officerRemarks || 'Please submit a clearer or more authoritative proof certificate.'}
              </div>
              <div style="margin-top:8px;">
                <button onclick="openResubmitCorrection('${c.requestId}')" class="btn btn-saffron btn-sm" style="font-size:0.8rem;">
                  <i data-lucide="upload"></i> Resubmit Supporting PDF Document
                </button>
              </div>
            </div>
          ` : officerRemarks ? `
            <div style="margin-top:12px; background:#f8fafc; border-left:3px solid ${c.status === 'Approved' ? '#16a34a' : '#dc2626'}; padding:8px 12px; font-size:0.825rem;">
              <span style="font-weight:600; color:var(--primary);">Officer Review Remarks:</span>
              <span style="color:#334155;"> ${officerRemarks}</span>
              ${c.reviewedAt ? `<span style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:2px;">Reviewed on ${new Date(c.reviewedAt).toLocaleDateString('en-IN')}</span>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Failed to load corrections:', err);
    container.innerHTML = `
      <div style="text-align: center; padding: 24px; color: #dc2626; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
        <i data-lucide="alert-triangle" style="width: 28px; height: 28px; margin-bottom: 6px;"></i>
        <div style="font-weight: 600;">Unable to Load Profile Corrections</div>
        <div style="font-size: 0.8rem; margin-top: 4px;">${err.message || 'Please check your connection or sign in again.'}</div>
        <button onclick="renderCorrectionsTab()" class="btn btn-secondary btn-sm" style="margin-top: 10px;">Retry</button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

// Tab Switching Helper
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.remove('active');
    view.style.display = 'none';
  });

  const targetBtn = document.getElementById(`tabBtn${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  const targetView = document.getElementById(`view${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);

  if (targetBtn) targetBtn.classList.add('active');
  if (targetView) {
    targetView.classList.add('active');
    targetView.style.display = 'block';
  }

  // If opening family tab, re-render SVG
  if (tabName === 'family') {
    setTimeout(() => {
      renderFamilyTree('familyTreeSvgContainer', currentMembers, currentRelationships);
    }, 100);
  }

  window.scrollTo({ top: 380, behavior: 'smooth' });
}

// Filter Schemes Live
// Open Scheme Details Modal with Visual Preview & Official Attribution
function openSchemeDetailsModal(schemeId) {
  const scheme = allSchemes.find(s => s.schemeId === schemeId);
  if (!scheme) return;

  const titleEl = document.getElementById('detailModalSchemeName');
  if (titleEl) titleEl.textContent = scheme.name;

  const hindiEl = document.getElementById('detailModalSchemeHindi');
  if (hindiEl) hindiEl.textContent = scheme.nameHindi || '';

  const ministryEl = document.getElementById('detailModalMinistry');
  if (ministryEl) {
    ministryEl.textContent = `${scheme.ministry || 'Government of India'}${scheme.department ? ' • ' + scheme.department : ''}`;
  }

  const catEl = document.getElementById('detailModalCategory');
  if (catEl) catEl.textContent = scheme.category;

  const typeEl = document.getElementById('detailModalBenefitType');
  if (typeEl) typeEl.textContent = `${scheme.benefitType} Benefit`;

  const covBadge = document.getElementById('detailModalCoverageBadge');
  if (covBadge) covBadge.textContent = scheme.stateCoverage || 'Pan-India';

  const descEl = document.getElementById('detailModalDesc');
  if (descEl) descEl.textContent = scheme.description;

  const benefitEl = document.getElementById('detailModalBenefitAmount');
  if (benefitEl) benefitEl.textContent = scheme.benefitAmount || 'Financial Assistance';

  const beneEl = document.getElementById('detailModalBeneficiaries');
  if (beneEl) beneEl.textContent = scheme.targetBeneficiaries || 'Eligible Citizens / Households';

  const appProcEl = document.getElementById('detailModalAppProcess');
  if (appProcEl) appProcEl.textContent = scheme.applicationProcess || 'Official Online Portal / Gram Panchayat';

  const covEl = document.getElementById('detailModalCoverage');
  if (covEl) covEl.textContent = scheme.stateCoverage || 'Pan-India';

  const sourceLink = document.getElementById('detailModalSourceLink');
  if (sourceLink) {
    sourceLink.href = scheme.sourceUrl || scheme.officialUrl || '#';
    sourceLink.textContent = scheme.sourceUrl ? 'myScheme / Department Reference' : 'Official Portal';
  }

  const lastVerEl = document.getElementById('detailModalLastVerified');
  if (lastVerEl) lastVerEl.textContent = scheme.lastVerifiedDate || '2026-10-24';

  const extLink = document.getElementById('detailModalOfficialExternalLink');
  if (extLink) extLink.href = scheme.officialUrl || '#';

  const imgEl = document.getElementById('detailModalImg');
  if (imgEl) {
    imgEl.src = scheme.imageUrl || '/assets/schemes/fallback.svg';
    imgEl.alt = scheme.imageAlt || scheme.name;
  }

  const eligEl = document.getElementById('detailModalEligibility');
  if (eligEl) {
    eligEl.textContent = scheme.eligibilityPreview || 'Subject to statutory verification of household records and supporting certificates.';
  }

  const docsList = document.getElementById('detailModalDocsList');
  if (docsList) {
    if (scheme.requiredDocuments && scheme.requiredDocuments.length > 0) {
      docsList.innerHTML = scheme.requiredDocuments.map(d => `
        <li style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
          <i data-lucide="file-check" style="width:14px; height:14px; color:#2563eb; flex-shrink:0;"></i>
          <span>${d}</span>
        </li>
      `).join('');
    } else {
      docsList.innerHTML = `<li>Standard KYC documentation</li>`;
    }
  }

  const btnCheck = document.getElementById('detailModalBtnCheckElig');
  if (btnCheck) {
    btnCheck.onclick = () => {
      closeModal('schemeDetailsModal');
      checkEligibilityLive(scheme.schemeId);
    };
  }

  const btnApply = document.getElementById('detailModalBtnApply');
  if (btnApply) {
    btnApply.onclick = () => {
      closeModal('schemeDetailsModal');
      openApplyForScheme(scheme.schemeId);
    };
  }

  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
  openModal('schemeDetailsModal');
}

// Current Filter States
let currentOverviewCategory = 'all';
let currentCatalogueCategory = 'all';

// Filter Schemes Live (Overview Tab)
function filterSchemesLive() {
  const query = (document.getElementById('schemeSearchInput')?.value || '').toLowerCase().trim();
  const locationFilter = (document.getElementById('schemeLocationFilter')?.value || 'all').toLowerCase();
  const cards = document.querySelectorAll('#overviewSchemesGrid .scheme-card');

  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    const cat = (card.getAttribute('data-category') || '').toLowerCase();
    const cov = (card.getAttribute('data-coverage') || '').toLowerCase();

    const matchesQuery = !query || text.includes(query);
    const matchesCat = currentOverviewCategory === 'all' || cat.includes(currentOverviewCategory.toLowerCase());
    const matchesLoc = locationFilter === 'all' || cov.includes(locationFilter) || cov.includes('pan-india');

    card.style.display = (matchesQuery && matchesCat && matchesLoc) ? 'flex' : 'none';
  });
}

function filterSchemeCategory(cat) {
  currentOverviewCategory = cat;
  document.querySelectorAll('.search-filter-bar .cat-chip').forEach(c => c.classList.remove('active'));
  if (window.event && window.event.target) {
    window.event.target.classList.add('active');
  }
  filterSchemesLive();
}

// Filter Schemes Live (Catalogue Tab)
function filterCatalogueLive() {
  const query = (document.getElementById('catalogueSearchInput')?.value || '').toLowerCase().trim();
  const locationFilter = (document.getElementById('catalogueLocationFilter')?.value || 'all').toLowerCase();
  const cards = document.querySelectorAll('#allSchemesGrid .scheme-card');

  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    const cat = (card.getAttribute('data-category') || '').toLowerCase();
    const cov = (card.getAttribute('data-coverage') || '').toLowerCase();

    const matchesQuery = !query || text.includes(query);
    const matchesCat = currentCatalogueCategory === 'all' || cat.includes(currentCatalogueCategory.toLowerCase());
    const matchesLoc = locationFilter === 'all' || cov.includes(locationFilter) || cov.includes('pan-india');

    card.style.display = (matchesQuery && matchesCat && matchesLoc) ? 'flex' : 'none';
  });
}

function filterCatalogueCategory(cat, el) {
  currentCatalogueCategory = cat;
  document.querySelectorAll('.cat-chip-cat').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  filterCatalogueLive();
}

// Interactive Eligibility Finder UI Functions
function openEligibilityFinderModal() {
  openModal('eligibilityFinderModal');
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function prefillFinderFromHousehold() {
  if (!currentHousehold) {
    showToast('No active household session to pre-fill from.', 'info');
    return;
  }

  const head = currentMembers.find(m => m.citizenId === currentHousehold.headCitizenId) || currentMembers[0];
  if (head && head.dateOfBirth) {
    const birthYear = new Date(head.dateOfBirth).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;
    if (age > 0) document.getElementById('finderAge').value = age;
    if (head.gender) document.getElementById('finderGender').value = head.gender;
  }

  if (currentHousehold.annualIncome) {
    document.getElementById('finderIncome').value = currentHousehold.annualIncome;
  }

  if (currentHousehold.dwellingType) {
    document.getElementById('finderDwelling').value = currentHousehold.dwellingType;
  }

  showToast('Prefilled non-PII parameters from current household profile', 'success');
}

async function handleRunFinder(e) {
  if (e) e.preventDefault();

  const criteria = {
    age: parseInt(document.getElementById('finderAge').value, 10) || 30,
    gender: document.getElementById('finderGender').value || 'Male',
    occupation: document.getElementById('finderOccupation').value || 'General / Salaried',
    annualIncome: parseInt(document.getElementById('finderIncome').value, 10) || 120000,
    dwellingType: document.getElementById('finderDwelling').value || 'Kutcha',
    hasLpgConnection: document.getElementById('finderLpg').value === 'true'
  };

  const loadingEl = document.getElementById('finderLoading');
  const resultsArea = document.getElementById('finderResultsArea');
  const resultsList = document.getElementById('finderResultsList');
  const badgeEl = document.getElementById('finderSummaryBadge');

  loadingEl.style.display = 'block';
  resultsArea.style.display = 'none';

  try {
    const res = await api.evaluateEligibilityFinder(criteria);
    loadingEl.style.display = 'none';
    resultsArea.style.display = 'block';

    const evaluations = res.evaluations || [];
    const eligibleCount = evaluations.filter(ev => ev.status === 'Potentially Eligible').length;
    badgeEl.textContent = `${eligibleCount} of ${evaluations.length} Potentially Eligible`;

    if (evaluations.length === 0) {
      resultsList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">No schemes evaluated.</div>`;
      return;
    }

    resultsList.innerHTML = evaluations.map(ev => {
      let cardClass = 'ineligible';
      let icon = 'alert-circle';
      let statusColor = '#64748b';

      if (ev.status === 'Potentially Eligible') {
        cardClass = 'eligible';
        icon = 'check-circle-2';
        statusColor = '#16a34a';
      } else if (ev.status === 'Data or Documents Required') {
        cardClass = 'data-required';
        icon = 'help-circle';
        statusColor = '#d97706';
      }

      const passedList = (ev.passedConditions || []).map(c => `<li><span style="color:#16a34a;">✔</span> ${c}</li>`).join('');
      const unmetList = (ev.unmetConditions || []).map(c => `<li><span style="color:#dc2626;">✖</span> ${c}</li>`).join('');
      const unknownList = (ev.unknownConditions || []).map(c => `<li><span style="color:#d97706;">❓</span> ${c}</li>`).join('');

      return `
        <div class="finder-result-card ${cardClass}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
            <div>
              <h5 style="margin:0; font-size:0.95rem; color:var(--primary); font-weight:700;">${ev.schemeName}</h5>
              <div style="font-size:0.75rem; color:#64748b; font-weight:500;">${ev.ministry || ''} • ${ev.benefitType} Entitlement</div>
            </div>
            <div style="display:inline-flex; align-items:center; gap:5px; font-weight:700; font-size:0.8rem; color:${statusColor};">
              <i data-lucide="${icon}" style="width:14px; height:14px;"></i>
              <span>${ev.status}</span>
            </div>
          </div>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:4px 0 8px;">${ev.explanation || ''}</p>
          
          <div style="font-size:0.78rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:8px; background:rgba(255,255,255,0.7); padding:8px 10px; border-radius:6px; border:1px solid #e2e8f0; margin-bottom:8px;">
            <div>
              <strong style="color:#334155;">Evaluated Conditions:</strong>
              <ul style="list-style:none; padding-left:0; margin:4px 0 0; line-height:1.45;">
                ${passedList}
                ${unmetList}
                ${unknownList}
              </ul>
            </div>
            <div>
              <strong style="color:#334155;">Benefit & Official Channel:</strong>
              <div style="margin-top:4px; color:#475569;">
                Benefit: <strong>${ev.benefitAmount || 'Financial Support'}</strong><br>
                Mode: ${ev.applicationProcess || 'Official Portal'}<br>
                Coverage: <strong>${ev.stateCoverage || 'Pan-India'}</strong>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <a href="${ev.officialUrl || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-official-link" title="Open Official Portal">
              <i data-lucide="external-link" style="width:12px; height:12px;"></i> Official Application Portal
            </a>
            <button onclick="closeModal('eligibilityFinderModal'); openSchemeDetailsModal('${ev.schemeId}')" class="btn btn-secondary btn-sm">
              <i data-lucide="info" style="width:12px; height:12px;"></i> View Scheme Details
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  } catch (err) {
    loadingEl.style.display = 'none';
    showToast('Failed to evaluate eligibility: ' + err.message, 'error');
  }
}

// Live Eligibility & Duplicate Check
let selectedSchemeForApply = null;
async function checkEligibilityLive(schemeId) {
  const scheme = allSchemes.find(s => s.schemeId === schemeId);
  if (!scheme) return;

  selectedSchemeForApply = schemeId;

  // Use Head Citizen by default
  const citizenId = currentHousehold.headCitizenId;

  showToast(`Evaluating eligibility rules & checking duplicate claims for ${scheme.name}...`, 'info');

  try {
    const res = await api.checkEligibility(schemeId, {
      familyId: currentHousehold.familyId,
      citizenId: citizenId
    });

    document.getElementById('eligModalSchemeName').textContent = scheme.name;

    const banner = document.getElementById('eligibilityStatusBanner');
    const passedList = document.getElementById('passedConditionsList');
    const failedList = document.getElementById('failedConditionsList');
    const failedContainer = document.getElementById('failedConditionsContainer');
    const missingList = document.getElementById('missingDocsList');
    const missingContainer = document.getElementById('missingDocsContainer');
    const duplicateBox = document.getElementById('duplicateAlertBox');

    // Populate Passed conditions
    passedList.innerHTML = res.eligibility.passedConditions.map(c => `<li>✅ ${c}</li>`).join('');

    // Populate Failed conditions
    if (res.eligibility.failedConditions.length > 0) {
      failedContainer.style.display = 'block';
      failedList.innerHTML = res.eligibility.failedConditions.map(c => `<li>❌ ${c}</li>`).join('');
    } else {
      failedContainer.style.display = 'none';
    }

    // Populate Missing Docs
    if (res.eligibility.missingDocuments.length > 0) {
      missingContainer.style.display = 'block';
      missingList.innerHTML = res.eligibility.missingDocuments.map(d => `<li>📄 ${d}</li>`).join('');
    } else {
      missingContainer.style.display = 'none';
    }

    // Handle Duplicate Warning Box
    if (res.duplicateCheck && res.duplicateCheck.isPotentialDuplicate) {
      duplicateBox.style.display = 'block';
      document.getElementById('duplicateAlertTitle').textContent = `POTENTIAL DUPLICATE CLAIM WARNING (${res.duplicateCheck.flagType})`;
      document.getElementById('duplicateAlertExplanation').textContent = res.duplicateCheck.explanation;
      document.getElementById('duplicateOfficerAction').textContent = `Officer Instruction: ${res.duplicateCheck.officerActionRecommended}`;

      banner.style.background = '#fef2f2';
      banner.style.color = '#b91c1c';
      banner.style.border = '1px solid #fca5a5';
      banner.innerHTML = `⚠️ Overall Assessment: Potential Duplicate — Human Officer Verification Required`;
    } else if (res.eligibility.status === 'Potentially Eligible') {
      duplicateBox.style.display = 'none';
      banner.style.background = '#ecfdf5';
      banner.style.color = '#15803d';
      banner.style.border = '1px solid #86efac';
      banner.innerHTML = `✅ Overall Assessment: Potentially Eligible Under Demonstration Rules`;
    } else {
      duplicateBox.style.display = 'none';
      banner.style.background = '#fffbeb';
      banner.style.color = '#b45309';
      banner.style.border = '1px solid #fcd34d';
      banner.innerHTML = `ℹ️ Overall Assessment: ${res.eligibility.status} (${res.eligibility.explanation})`;
    }

    openModal('eligibilityModal');
  } catch (err) {
    showToast('Failed to check eligibility: ' + err.message, 'error');
  }
}

function handleProceedFromEligModal() {
  closeModal('eligibilityModal');
  if (selectedSchemeForApply) {
    openApplyForScheme(selectedSchemeForApply);
  }
}

// Direct Application Submission Modal
function openApplyModal() {
  populateApplyModalOptions();
  openModal('applyModal');
}

function openApplyForScheme(schemeId) {
  populateApplyModalOptions();
  document.getElementById('applySchemeSelect').value = schemeId;
  openModal('applyModal');
}

function populateApplyModalOptions() {
  const schemeSelect = document.getElementById('applySchemeSelect');
  const citizenSelect = document.getElementById('applyCitizenSelect');

  schemeSelect.innerHTML = allSchemes.map(s => `
    <option value="${s.schemeId}">${s.name} (${s.benefitType} Scheme)</option>
  `).join('');

  citizenSelect.innerHTML = currentMembers.map(m => `
    <option value="${m.citizenId}">${m.fullName} (${m.citizenId} • ${m.age}y • ${m.occupation || 'Resident'})</option>
  `).join('');
}

function handleApplySchemeChange() {
  // Can adapt citizen select if needed
}

async function handleApplySubmit(e) {
  e.preventDefault();
  const schemeId = document.getElementById('applySchemeSelect').value;
  const applicantCitizenId = document.getElementById('applyCitizenSelect').value;
  const btn = document.getElementById('btnSubmitApp');

  btn.disabled = true;
  btn.textContent = 'Submitting application...';

  try {
    const res = await api.submitApplication({ schemeId, applicantCitizenId });
    showToast(`Application ${res.application.applicationId} submitted successfully! Status: ${res.application.status}`, 'success');
    closeModal('applyModal');
    btn.disabled = false;
    btn.textContent = 'Submit Application';

    await refreshDashboardData();

    if (res.application.duplicateCheckResult && res.application.duplicateCheckResult.isPotentialDuplicate) {
      showToast(`Notice: Application was flagged for potential duplicate claim (${res.application.duplicateCheckResult.flagType}). It has been queued for human officer review.`, 'warning');
    }

    switchTab('applications');
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Application';
  }
}

// View Application Detail Modal
function viewApplicationDetail(appId) {
  const app = allApplications.find(a => a.applicationId === appId);
  if (!app) return;

  const dupExplain = app.duplicateCheckResult && app.duplicateCheckResult.isPotentialDuplicate
    ? `⚠️ Duplicate Claim Flag: ${app.duplicateCheckResult.explanation}`
    : `✅ Duplicate Check: No conflicting claims found.`;

  alert(`APPLICATION DETAILS: ${app.applicationId}\n\nScheme: ${app.schemeName}\nApplicant: ${app.applicantName} (${app.applicantCitizenId})\nHousehold: ${app.familyId}\nDwelling: ${app.dwellingReference || 'N/A'}\nCurrent Status: ${app.status}\n\n${dupExplain}\n\nOfficer Review: ${app.officerReview ? `${app.officerReview.decision} - ${app.officerReview.remarks} (by ${app.officerReview.officerName})` : 'Pending administrative verification.'}`);
}

// Household Separation Wizard Modal (Core Feature)
function openSeparationWizard() {
  const container = document.getElementById('separationMemberCheckboxes');
  if (!container) return;

  // Populate checkboxes with members EXCEPT head of family
  container.innerHTML = currentMembers.map(m => {
    return `
      <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 0.85rem; padding: 6px; background: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0;">
        <input type="checkbox" name="movingMember" value="${m.citizenId}" ${m.citizenId === 'CIT-1002' ? 'checked' : ''}>
        <div>
          <strong>${m.fullName}</strong> (${m.citizenId}) — ${m.age} yrs, ${m.occupation || 'Resident'}
          ${m.isHeadOfFamily ? `<span class="badge badge-saffron" style="font-size:0.65rem; margin-left:6px;">Current Head</span>` : ''}
        </div>
      </label>
    `;
  }).join('');

  openModal('separationModal');
}

async function handleSeparationSubmit(e) {
  e.preventDefault();
  const checkboxes = document.querySelectorAll('input[name="movingMember"]:checked');
  const movingCitizenIds = Array.from(checkboxes).map(c => c.value);

  if (movingCitizenIds.length === 0) {
    showToast('Please select at least one member to move to the new household.', 'warning');
    return;
  }

  if (movingCitizenIds.length >= currentMembers.length) {
    showToast('At least one member must remain in the original household.', 'warning');
    return;
  }

  const newAddress = {
    line1: document.getElementById('sepAddressLine1').value,
    district: document.getElementById('sepDistrict').value,
    state: 'Uttar Pradesh',
    pincode: document.getElementById('sepPincode').value
  };

  const newDwellingReference = document.getElementById('sepDwellingRef').value;
  const separationDate = document.getElementById('sepDate').value;
  const reason = document.getElementById('sepReason').value;
  const btn = document.getElementById('btnSubmitSeparation');

  btn.disabled = true;
  btn.textContent = 'Lodging separation request...';

  try {
    const res = await api.submitSeparationRequest({
      originalFamilyId: currentHousehold.familyId,
      movingCitizenIds,
      newAddress,
      newDwellingReference,
      separationDate,
      reason
    });

    showToast(`Household separation request ${res.request.requestId} submitted! Status: Pending Verification.`, 'success');
    closeModal('separationModal');
    btn.disabled = false;
    btn.textContent = 'Submit Separation Request';

    await refreshDashboardData();
    switchTab('separation');
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Separation Request';
  }
}

// Document Upload Modal
function openUploadDocModal() {
  const citizenSelect = document.getElementById('docCitizenSelect');
  if (citizenSelect) {
    citizenSelect.innerHTML = currentMembers.map(m => `
      <option value="${m.citizenId}">${m.fullName} (${m.citizenId})</option>
    `).join('');
  }
  openModal('uploadDocModal');
}

function handleDocScopeChange() {
  const scope = document.getElementById('docScope').value;
  const wrap = document.getElementById('docCitizenWrap');
  if (scope === 'Individual') {
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
  }
}

async function handleDocUpload(e) {
  e.preventDefault();
  const title = document.getElementById('docTitle').value;
  const documentType = document.getElementById('docTypeSelect').value;
  const scope = document.getElementById('docScope').value;
  const citizenId = scope === 'Individual' ? document.getElementById('docCitizenSelect').value : null;
  const fileInput = document.getElementById('docFile');
  const btn = document.getElementById('btnUploadDocSubmit');

  btn.disabled = true;
  btn.textContent = 'Uploading to vault...';

  try {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('documentType', documentType);
    formData.append('scope', scope);
    if (citizenId) formData.append('citizenId', citizenId);
    formData.append('familyId', currentHousehold.familyId);
    if (fileInput.files[0]) {
      formData.append('file', fileInput.files[0]);
    }

    const res = await api.uploadDocument(formData);
    showToast(`Document '${title}' registered successfully in vault! Status: Pending Verification.`, 'success');
    closeModal('uploadDocModal');
    btn.disabled = false;
    btn.textContent = 'Upload to Vault';

    await refreshDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Upload to Vault';
  }
}

function previewDocument(docId) {
  const doc = allDocuments.find(d => d.documentId === docId);
  if (!doc) return;

  alert(`DOCUMENT PREVIEW: ${doc.title}\n\nDocument ID: ${doc.documentId}\nType: ${doc.documentType}\nScope: ${doc.scope}\nReference: ${doc.maskedReferenceNo || 'N/A'}\nStatus: ${doc.verificationStatus}\nIssuing Authority: ${doc.issuingAuthority}\nOfficer Remarks: ${doc.officerRemarks || 'None'}`);
}

// Profile & Name Correction Modal (Scenario F)
function openCorrectionModal() {
  populateCorrectionModal();
  document.getElementById('corrResubmitRequestId').value = '';
  document.getElementById('corrResubmitNotice').style.display = 'none';
  document.getElementById('corrModalTitle').textContent = 'Official Profile Correction Request';
  document.getElementById('btnSubmitCorr').textContent = 'Submit for Officer Verification';
  document.getElementById('corrCitizenSelect').disabled = false;
  document.getElementById('corrFieldSelect').disabled = false;
  openModal('correctionModal');
}

function openCorrectionForCitizen(citizenId) {
  openCorrectionModal();
  document.getElementById('corrCitizenSelect').value = citizenId;
  handleCorrCitizenChange();
}

function populateCorrectionModal() {
  const select = document.getElementById('corrCitizenSelect');
  if (select && currentMembers && currentMembers.length > 0) {
    select.innerHTML = currentMembers.map(m => `
      <option value="${m.citizenId}">${m.fullName} (${m.citizenId})</option>
    `).join('');
  }
  
  // Reset other doc type
  const docTypeSelect = document.getElementById('corrDocTypeSelect');
  if (docTypeSelect) docTypeSelect.value = '';
  const otherWrap = document.getElementById('corrOtherDocTypeWrap');
  if (otherWrap) otherWrap.style.display = 'none';
  const otherInput = document.getElementById('corrOtherDocType');
  if (otherInput) {
    otherInput.value = '';
    otherInput.required = false;
  }

  // Reset file upload
  removeCorrFile();

  // Reset proposed & reason
  const proposed = document.getElementById('corrProposedValue');
  if (proposed) proposed.value = '';
  const reason = document.getElementById('corrReason');
  if (reason) reason.value = '';

  handleCorrCitizenChange();
}

function handleCorrCitizenChange() {
  const citizenSelect = document.getElementById('corrCitizenSelect');
  if (!citizenSelect) return;
  const citizenId = citizenSelect.value;
  const cit = (currentMembers || []).find(m => m.citizenId === citizenId);
  const field = document.getElementById('corrFieldSelect').value;
  const currInput = document.getElementById('corrCurrentValue');
  
  if (cit && currInput) {
    currInput.value = cit[field] !== undefined && cit[field] !== null ? String(cit[field]) : 'Not specified';
  }
}

function handleCorrFieldChange() {
  handleCorrCitizenChange();
}

function handleCorrDocTypeChange() {
  const docType = document.getElementById('corrDocTypeSelect').value;
  const otherWrap = document.getElementById('corrOtherDocTypeWrap');
  const otherInput = document.getElementById('corrOtherDocType');
  
  if (docType === 'Other') {
    otherWrap.style.display = 'block';
    otherInput.required = true;
    otherInput.focus();
  } else {
    otherWrap.style.display = 'none';
    otherInput.required = false;
    otherInput.value = '';
  }
}

function triggerCorrFileInput() {
  const fileInput = document.getElementById('corrDocFile');
  if (fileInput) fileInput.click();
}

function handleCorrFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  const errBox = document.getElementById('corrFileError');
  errBox.style.display = 'none';
  errBox.textContent = '';

  if (!file) {
    removeCorrFile();
    return;
  }

  // 1. PDF Extension & MIME Validation
  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
  if (!isPdf) {
    errBox.textContent = 'Invalid file format: Supporting evidence must be a PDF document (.pdf).';
    errBox.style.display = 'block';
    event.target.value = '';
    removeCorrFile();
    return;
  }

  // 2. Configurable Max Size Check (5 MB)
  const MAX_SIZE_BYTES = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    errBox.textContent = `File too large: ${sizeMb} MB exceeds the permitted 5 MB limit. Please select a compressed PDF.`;
    errBox.style.display = 'block';
    event.target.value = '';
    removeCorrFile();
    return;
  }

  // 3. Empty File Check
  if (file.size === 0) {
    errBox.textContent = 'Empty file rejected: The selected document contains 0 bytes.';
    errBox.style.display = 'block';
    event.target.value = '';
    removeCorrFile();
    return;
  }

  // Update Preview Card
  document.getElementById('corrFileName').textContent = file.name;
  const sizeFormatted = file.size > 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    : `${(file.size / 1024).toFixed(1)} KB`;
  document.getElementById('corrFileSize').textContent = `${sizeFormatted} • Genuine PDF Ready`;

  document.getElementById('corrUploadDropzone').style.display = 'none';
  document.getElementById('corrFilePreviewCard').style.display = 'block';
  if (window.lucide) lucide.createIcons();
}

function removeCorrFile() {
  const fileInput = document.getElementById('corrDocFile');
  if (fileInput) fileInput.value = '';
  const dropzone = document.getElementById('corrUploadDropzone');
  if (dropzone) dropzone.style.display = 'block';
  const preview = document.getElementById('corrFilePreviewCard');
  if (preview) preview.style.display = 'none';
  const errBox = document.getElementById('corrFileError');
  if (errBox) {
    errBox.textContent = '';
    errBox.style.display = 'none';
  }
}

async function openResubmitCorrection(requestId) {
  try {
    const res = await api.getProfileCorrection(requestId);
    const c = res.correction;

    populateCorrectionModal();
    document.getElementById('corrResubmitRequestId').value = c.requestId;
    document.getElementById('corrResubmitNotice').style.display = 'block';
    document.getElementById('corrModalTitle').textContent = `Resubmit Supporting PDF — ${c.requestId}`;
    document.getElementById('btnSubmitCorr').textContent = 'Upload Updated PDF Evidence';

    // Pre-populate values
    const citizenSelect = document.getElementById('corrCitizenSelect');
    if (citizenSelect) {
      citizenSelect.value = c.citizenId;
      citizenSelect.disabled = true; // Lock citizen selection during resubmission
    }
    const fieldSelect = document.getElementById('corrFieldSelect');
    if (fieldSelect) {
      fieldSelect.value = c.fieldToCorrect;
      fieldSelect.disabled = true; // Lock field selection
    }
    document.getElementById('corrCurrentValue').value = c.currentValue || '';
    document.getElementById('corrProposedValue').value = c.requestedValue || c.proposedValue || '';
    document.getElementById('corrReason').value = c.reason || '';

    if (c.documentType) {
      document.getElementById('corrDocTypeSelect').value = c.documentType;
      handleCorrDocTypeChange();
      if (c.documentType === 'Other' && c.otherDocumentType) {
        document.getElementById('corrOtherDocType').value = c.otherDocumentType;
      }
    }

    openModal('correctionModal');
  } catch (err) {
    showToast(`Failed to load request for resubmission: ${err.message}`, 'error');
  }
}

async function handleCorrectionSubmit(e) {
  e.preventDefault();
  const citizenId = document.getElementById('corrCitizenSelect').value;
  const fieldToCorrect = document.getElementById('corrFieldSelect').value;
  const proposedValue = document.getElementById('corrProposedValue').value.trim();
  const reason = document.getElementById('corrReason').value.trim();
  const documentType = document.getElementById('corrDocTypeSelect').value;
  const otherDocumentType = (document.getElementById('corrOtherDocType').value || '').trim();
  const resubmitId = document.getElementById('corrResubmitRequestId').value;

  const fileInput = document.getElementById('corrDocFile');
  const file = fileInput.files && fileInput.files[0];
  const errBox = document.getElementById('corrFileError');

  // Validate file requirement
  if (!file) {
    errBox.textContent = 'Supporting PDF document is required for review. Please attach a valid file.';
    errBox.style.display = 'block';
    showToast('Supporting PDF document is required for review.', 'error');
    return;
  }

  // Validate other document name
  if (documentType === 'Other' && !otherDocumentType) {
    showToast('Please specify the document type in "Specify Document Type".', 'error');
    document.getElementById('corrOtherDocType').focus();
    return;
  }

  const btn = document.getElementById('btnSubmitCorr');
  btn.disabled = true;
  btn.textContent = resubmitId ? 'Uploading updated proof...' : 'Submitting correction & PDF...';

  try {
    const formData = new FormData();
    formData.append('citizenId', citizenId);
    formData.append('fieldToCorrect', fieldToCorrect);
    formData.append('requestedValue', proposedValue);
    formData.append('proposedValue', proposedValue);
    formData.append('reason', reason);
    formData.append('documentType', documentType);
    if (documentType === 'Other') {
      formData.append('otherDocumentType', otherDocumentType);
    }
    formData.append('supportingDocument', file);

    let res;
    if (resubmitId) {
      res = await api.resubmitProfileCorrection(resubmitId, formData);
      showToast(`Updated evidence submitted for ${resubmitId}. Status updated to Pending Review.`, 'success');
    } else {
      res = await api.submitProfileCorrection(formData);
      showToast(`Correction request ${res.requestId || res.correction.requestId} lodged successfully with supporting PDF.`, 'success');
    }

    closeModal('correctionModal');
    btn.disabled = false;
    btn.textContent = 'Submit for Officer Verification';

    // Re-enable disabled selects if any
    document.getElementById('corrCitizenSelect').disabled = false;
    document.getElementById('corrFieldSelect').disabled = false;

    await refreshDashboardData();
    switchTab('profile');
    renderCorrectionsTab();
  } catch (err) {
    console.error('Correction submit error:', err);
    showToast(err.message || 'Submission failed.', 'error');
    btn.disabled = false;
    btn.textContent = resubmitId ? 'Upload Updated PDF Evidence' : 'Submit for Officer Verification';
  }
}

// Notifications Drawer & Dropdown
function toggleNotifications() {
  const dropdown = document.getElementById('notifDropdown');
  if (!dropdown) return;
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function renderNotifications(notifs) {
  currentNotifications = notifs || [];
  const badge = document.getElementById('notifBadge');
  const countText = document.getElementById('notifCountText');
  const list = document.getElementById('notifList');

  const unread = currentNotifications.filter(n => !n.isRead);

  if (badge) {
    if (unread.length > 0) {
      badge.style.display = 'flex';
      badge.textContent = unread.length;
    } else {
      badge.style.display = 'none';
    }
  }

  if (countText) {
    countText.textContent = `${unread.length} Unread`;
  }

  if (list) {
    if (currentNotifications.length === 0) {
      list.innerHTML = `<div style="padding:14px; text-align:center; color:var(--text-muted); font-size:0.8rem;">No notifications recorded.</div>`;
    } else {
      list.innerHTML = currentNotifications.map(n => `
        <div class="notif-item" onclick="handleNotificationClick('${n.notificationId}')" style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-size: 0.8rem; background: ${n.isRead ? '#ffffff' : '#f0fdf4'}; border-left: 3px solid ${n.isRead ? 'transparent' : '#16a34a'}; border-radius: 6px; margin-bottom: 4px; cursor: pointer;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div style="font-weight: 700; color: var(--primary); margin-bottom: 2px;">
              ${!n.isRead ? '🟢 ' : ''}${n.title}
            </div>
            <span style="font-size: 0.65rem; color: #94a3b8; white-space: nowrap;">${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style="color: var(--text-muted); line-height: 1.35; margin-top: 2px;">${n.message}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
            <span class="badge ${n.isRead ? 'badge-neutral' : 'badge-saffron'}" style="font-size: 0.65rem;">${n.category || 'Alert'}</span>
            <span style="font-size: 0.7rem; color: #2563eb; font-weight: 600;">Click to read &rarr;</span>
          </div>
        </div>
      `).join('');
    }
  }
}

// Handle Click on Individual Notification
async function handleNotificationClick(notifId) {
  const notif = currentNotifications.find(n => n.notificationId === notifId);
  if (!notif) return;

  // Mark as read locally and on server
  if (!notif.isRead) {
    notif.isRead = true;
    try {
      await api.markNotificationRead(notifId);
    } catch (err) {
      console.warn('Failed to mark notification read on backend:', err);
    }
  }

  // Update badge and list
  renderNotifications(currentNotifications);

  // Populate detail modal
  const title = document.getElementById('notifModalTitle');
  const heading = document.getElementById('notifModalHeading');
  const body = document.getElementById('notifModalBody');
  const cat = document.getElementById('notifModalCategory');
  const time = document.getElementById('notifModalTime');
  const actionBtn = document.getElementById('notifModalActionBtn');

  if (title) title.textContent = 'Notification Alert';
  if (heading) heading.textContent = notif.title;
  if (body) body.textContent = notif.message;
  if (cat) cat.textContent = notif.category || 'General Alert';
  if (time) time.textContent = new Date(notif.createdAt).toLocaleString();

  if (actionBtn) {
    const msg = (notif.message || '').toLowerCase();
    const c = notif.category || '';
    if (c === 'Separation' || msg.includes('separation')) {
      actionBtn.style.display = 'inline-block';
      actionBtn.textContent = 'View Separation Status';
      actionBtn.onclick = () => { closeModal('notifDetailModal'); switchTab('separation'); };
    } else if (c === 'Correction' || msg.includes('correction')) {
      actionBtn.style.display = 'inline-block';
      actionBtn.textContent = 'View Profile Corrections';
      actionBtn.onclick = () => { closeModal('notifDetailModal'); switchTab('profile'); };
    } else if (c === 'Application' || msg.includes('application')) {
      actionBtn.style.display = 'inline-block';
      actionBtn.textContent = 'Track Applications';
      actionBtn.onclick = () => { closeModal('notifDetailModal'); switchTab('applications'); };
    } else if (c === 'Document' || msg.includes('document')) {
      actionBtn.style.display = 'inline-block';
      actionBtn.textContent = 'Open Document Vault';
      actionBtn.onclick = () => { closeModal('notifDetailModal'); switchTab('documents'); };
    } else {
      actionBtn.style.display = 'none';
    }
  }

  openModal('notifDetailModal');
}

// Mark All Notifications as Read
async function markAllNotificationsAsRead() {
  try {
    await api.markAllNotificationsRead();
    currentNotifications.forEach(n => n.isRead = true);
    renderNotifications(currentNotifications);
    showToast('All notifications marked as read.', 'success');
  } catch (err) {
    showToast('Failed to mark notifications read: ' + err.message, 'error');
  }
}

// Grievance & Appeal Modal
function openGrievanceModal() {
  const form = document.getElementById('grievanceForm');
  if (form) form.reset();
  openModal('grievanceModal');
}

async function handleGrievanceSubmit(e) {
  e.preventDefault();
  const category = document.getElementById('grievanceCategory').value;
  const subject = document.getElementById('grievanceSubject').value.trim();
  const description = document.getElementById('grievanceDescription').value.trim();

  const btn = document.getElementById('btnSubmitGrievance');
  btn.disabled = true;
  btn.textContent = 'Submitting Appeal...';

  try {
    closeModal('grievanceModal');
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send" style="width: 14px; height: 14px;"></i> Submit Appeal';

    showToast(`Grievance Appeal '${subject}' lodged successfully! Grievance Ref: GRV-${Date.now().toString().slice(-6)}. Block Grievance Officer has been notified.`, 'success');
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send" style="width: 14px; height: 14px;"></i> Submit Appeal';
    showToast('Failed to submit grievance: ' + err.message, 'error');
  }
}

// Modal Utility Helpers
function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    document.querySelectorAll('.modal-overlay.active').forEach(activeM => {
      if (activeM.id !== id) closeModal(activeM.id);
    });

    m.classList.add('active');
    m.style.setProperty('display', 'flex', 'important');
    m.style.setProperty('visibility', 'visible', 'important');
    m.style.setProperty('opacity', '1', 'important');
    m.style.setProperty('pointer-events', 'auto', 'important');
    m.style.setProperty('z-index', '100000', 'important');
    if (window.lucide && typeof lucide.createIcons === 'function') {
      try { lucide.createIcons(); } catch(e){}
    }
  } else {
    console.warn(`[JanSetu] Modal with id '${id}' not found in DOM.`);
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('active');
    m.style.setProperty('display', 'none', 'important');
    m.style.setProperty('visibility', 'hidden', 'important');
    m.style.setProperty('opacity', '0', 'important');
    m.style.setProperty('pointer-events', 'none', 'important');
  }
}

// Global modal backdrop click dismiss
document.addEventListener('click', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
    closeModal(e.target.id);
  }
});

// Global escape key to close active modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    activeModals.forEach(m => closeModal(m.id));
  }
});

function toggleAssistant() {
  const drawer = document.getElementById('assistantDrawer');
  if (drawer) drawer.classList.toggle('active');
}

function handleLogout() {
  api.clearAuth();
  showToast('Signed out successfully.', 'info');
  setTimeout(() => window.location.href = '/login.html', 400);
}

// Expose key dashboard controllers globally on window
window.toggleSensitiveField = toggleSensitiveField;
window.toggleAllSensitiveInfo = toggleAllSensitiveInfo;
window.openAddMemberModal = openAddMemberModal;
window.handleAddMemberSubmit = handleAddMemberSubmit;
window.toggleFarmerLandField = toggleFarmerLandField;
window.viewMemberDetails = viewMemberDetails;
window.openRemoveMemberModal = openRemoveMemberModal;
window.handleRemoveMemberSubmit = handleRemoveMemberSubmit;
window.toggleNotifications = toggleNotifications;
window.handleNotificationClick = handleNotificationClick;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.openGrievanceModal = openGrievanceModal;
window.handleGrievanceSubmit = handleGrievanceSubmit;
window.openModal = openModal;
window.closeModal = closeModal;
