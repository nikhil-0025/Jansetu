// JanSetu Frontend API Client
const API_BASE = '/api';

const api = {
  getToken: () => localStorage.getItem('jansetu_token'),
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem('jansetu_user')) || null;
    } catch {
      return null;
    }
  },
  setAuth: (token, user) => {
    localStorage.setItem('jansetu_token', token);
    localStorage.setItem('jansetu_user', JSON.stringify(user));
  },
  clearAuth: () => {
    localStorage.removeItem('jansetu_token');
    localStorage.removeItem('jansetu_user');
  },

  request: async (endpoint, options = {}) => {
    const headers = options.headers || {};
    const token = api.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          api.clearAuth();
          window.location.href = '/login.html';
        }
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  },

  // Auth
  login: (credentials) => api.request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  signup: (data) => api.request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  verifyCertificate: (data) => api.request('/auth/verify-certificate', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => api.request('/auth/me'),
  resetDemo: () => api.request('/auth/reset-demo', { method: 'POST' }),
  getSystemStatus: () => api.request('/auth/system-status'),

  // Households
  getHousehold: (familyId) => api.request(`/households/${familyId}`),
  getHouseholdMembers: (familyId) => api.request(`/households/${familyId}/members`),
  getHouseholdMember: (familyId, citizenId) => api.request(`/households/${familyId}/members/${citizenId}`),
  addHouseholdMember: (familyId, data) => api.request(`/households/${familyId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  updateHouseholdMember: (familyId, citizenId, data) => api.request(`/households/${familyId}/members/${citizenId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeHouseholdMember: (familyId, citizenId, reason) => api.request(`/households/${familyId}/members/${citizenId}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
  getHouseholdHistory: (familyId) => api.request(`/households/${familyId}/history`),
  getHouseholdBenefits: (familyId) => api.request(`/households/${familyId}/benefits`),

  // Citizens
  getCitizen: (citizenId) => api.request(`/citizens/${citizenId}`),
  getCitizenRelationships: (citizenId) => api.request(`/citizens/${citizenId}/relationships`),

  // Documents
  getDocuments: (params = '') => api.request(`/documents${params ? '?' + params : ''}`),
  uploadDocument: (formData) => api.request('/documents', { method: 'POST', body: formData }),
  verifyDocument: (docId, data) => api.request(`/documents/${docId}/verification`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Schemes
  getSchemes: (params = '') => api.request(`/schemes${params ? '?' + params : ''}`),
  getScheme: (schemeId) => api.request(`/schemes/${schemeId}`),
  checkEligibility: (schemeId, data) => api.request(`/schemes/${schemeId}/check-eligibility`, { method: 'POST', body: JSON.stringify(data) }),

  // Applications
  getApplications: (params = '') => api.request(`/applications${params ? '?' + params : ''}`),
  getApplication: (appId) => api.request(`/applications/${appId}`),
  submitApplication: (data) => api.request('/applications', { method: 'POST', body: JSON.stringify(data) }),
  reviewApplication: (appId, data) => api.request(`/applications/${appId}/review`, { method: 'POST', body: JSON.stringify(data) }),

  // Separation
  getSeparationRequests: () => api.request('/separation-requests'),
  getSeparationRequest: (requestId) => api.request(`/separation-requests/${requestId}`),
  submitSeparationRequest: (data) => api.request('/separation-requests', { method: 'POST', body: JSON.stringify(data) }),
  reviewSeparationRequest: (requestId, data) => api.request(`/separation-requests/${requestId}/review`, { method: 'POST', body: JSON.stringify(data) }),

  // Profile Corrections
  getProfileCorrections: () => api.request('/profile-corrections'),
  getProfileCorrection: (requestId) => api.request(`/profile-corrections/${requestId}`),
  submitProfileCorrection: (data) => api.request('/profile-corrections', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
  resubmitProfileCorrection: (requestId, data) => api.request(`/profile-corrections/${requestId}/resubmit`, { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
  reviewProfileCorrection: (requestId, data) => api.request(`/profile-corrections/${requestId}/review`, { method: 'POST', body: JSON.stringify(data) }),
  getCorrectionDocumentUrl: (requestId) => `${API_BASE}/profile-corrections/${requestId}/document?token=${encodeURIComponent(api.getToken() || '')}`,

  // Officer / Admin
  getOfficerDashboard: () => api.request('/admin/dashboard'),
  getDuplicateClaims: () => api.request('/admin/duplicate-claims'),
  getAuditLogs: () => api.request('/admin/audit-logs'),
  getPendingRegistrations: () => api.request('/admin/pending-registrations'),
  reviewPendingRegistration: (userId, data) => api.request(`/admin/pending-registrations/${userId}/review`, { method: 'POST', body: JSON.stringify(data) }),

  // Notifications
  getNotifications: () => api.request('/notifications'),
  markNotificationRead: (notifId) => api.request(`/notifications/${notifId}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => api.request('/notifications/read-all', { method: 'POST' }),

  // Assistant
  askAssistant: (data) => api.request('/assistant/chat', { method: 'POST', body: JSON.stringify(data) }),

  // Government API Integrations
  getGovServicesStatus: () => api.request('/government-services/status'),
  getGovInventory: () => api.request('/government-services/inventory'),
  getGovAuditLogs: (limit = 20) => api.request(`/government-services/audit-logs?limit=${limit}`),
  verifyGovRationCard: (data) => api.request('/government-services/digilocker/verify-ration', { method: 'POST', body: JSON.stringify(data) }),
  verifyGovElectricity: (data) => api.request('/government-services/digilocker/verify-electricity', { method: 'POST', body: JSON.stringify(data) }),
  pullGovDigiLockerDoc: (data) => api.request('/government-services/digilocker/pull-doc', { method: 'POST', body: JSON.stringify(data) }),
  getOgdPublicStats: (params = '') => api.request(`/government-services/ogd/stats${params ? '?' + params : ''}`),
  getMySchemeCatalog: (params = '') => api.request(`/government-services/myscheme/catalog${params ? '?' + params : ''}`)
};

// Global Toast System
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div style="flex:1;">
      <div style="font-weight:600; margin-bottom:2px;">
        ${type === 'success' ? 'Success' : type === 'error' ? 'Notice / Alert' : 'Information'}
      </div>
      <div>${message}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:16px;">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}
