const { getGovApiConfig } = require('../config/govApiConfig');
const { CONNECTION_STATES } = require('../types/connectionStates');
const auditLogger = require('../services/auditLogger');
const mockAdapter = require('../adapters/mockAdapter');

/**
 * myScheme National Welfare Catalog Discovery Client
 * Synchronizes official criteria, required documentation, and rules.
 */
class MySchemeClient {
  constructor() {
    this.serviceId = 'MYSCHEME-NATIONAL-CATALOG';
  }

  getConnectionState() {
    const config = getGovApiConfig();
    if (config.mode.forceMock) return CONNECTION_STATES.DEMO_MODE;
    if (config.myScheme.apiKey) {
      return CONNECTION_STATES.CONNECTED;
    }
    return CONNECTION_STATES.DEMO_MODE;
  }

  /**
   * Fetches official welfare scheme catalog.
   */
  async fetchSchemesCatalog({ category, search, actorId = 'SYSTEM', actorRole = 'system' } = {}) {
    const config = getGovApiConfig();
    const state = this.getConnectionState();

    if (state === CONNECTION_STATES.DEMO_MODE) {
      const start = Date.now();
      const mockResult = await mockAdapter.mockFetchMySchemeCatalog();

      auditLogger.log({
        serviceName: this.serviceId,
        endpoint: `${config.myScheme.baseUrl}/api/v1/schemes`,
        operation: 'FETCH_SCHEME_CATALOG',
        actorId,
        actorRole,
        statusCode: 200,
        latencyMs: Date.now() - start,
        isAuthoritative: false,
        success: true,
        maskedParams: { category: category || 'ALL', search: search || 'NONE' }
      });

      return mockResult;
    }

    // Live endpoint logic
    const start = Date.now();
    try {
      const url = `${config.myScheme.catalogApiUrl}/schemes`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${config.myScheme.apiKey}`
        },
        signal: AbortSignal.timeout(config.mode.timeoutMs)
      });

      const latency = Date.now() - start;
      const data = await res.json();

      auditLogger.log({
        serviceName: this.serviceId,
        endpoint: url,
        operation: 'FETCH_SCHEME_CATALOG',
        actorId,
        actorRole,
        statusCode: res.status,
        latencyMs: latency,
        isAuthoritative: res.ok,
        success: res.ok,
        maskedParams: { category, search }
      });

      if (!res.ok) {
        return await mockAdapter.mockFetchMySchemeCatalog();
      }

      return {
        ...data,
        metadata: {
          isAuthoritative: true,
          isSimulated: false,
          dataSource: 'MYSCHEME_OFFICIAL_MARKETPLACE',
          serviceName: this.serviceId,
          fetchedAt: new Date().toISOString()
        }
      };
    } catch (err) {
      console.warn(`[myScheme Client Error: ${err.message}] Using mock fallback.`);
      return await mockAdapter.mockFetchMySchemeCatalog();
    }
  }
}

module.exports = new MySchemeClient();
