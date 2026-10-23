const { getGovApiConfig } = require('../config/govApiConfig');
const { CONNECTION_STATES } = require('../types/connectionStates');
const auditLogger = require('../services/auditLogger');
const mockAdapter = require('../adapters/mockAdapter');

/**
 * Open Government Data (OGD) Platform India (data.gov.in) Client
 *
 * Fetches public datasets, scheme statistics, and district allocations.
 * Strictly PUBLIC OPEN DATA: Contains zero Personally Identifiable Information (PII).
 */
class OgdDataGovClient {
  constructor() {
    this.serviceId = 'OGD-DATA-GOV-PUBLIC-SCHEMES';
  }

  getConnectionState() {
    const config = getGovApiConfig();
    if (config.mode.forceMock) return CONNECTION_STATES.DEMO_MODE;
    if (config.ogdDataGov.apiKey) {
      return CONNECTION_STATES.CONNECTED;
    }
    return CONNECTION_STATES.DEMO_MODE;
  }

  /**
   * Fetches public welfare scheme dataset records.
   */
  async fetchResource({
    resourceId,
    limit = 5,
    filters = {},
    actorId = 'SYSTEM',
    actorRole = 'system'
  }) {
    const config = getGovApiConfig();
    const state = this.getConnectionState();
    const targetResource = resourceId || config.ogdDataGov.nfsaResourceId;

    // In DEMO_MODE, return simulated public dataset
    if (state === CONNECTION_STATES.DEMO_MODE) {
      const start = Date.now();
      const mockResult = await mockAdapter.mockFetchOgdStats({ resourceId: targetResource, limit });

      auditLogger.log({
        serviceName: this.serviceId,
        endpoint: `https://api.data.gov.in/resource/${targetResource}`,
        operation: 'FETCH_PUBLIC_DATASET',
        actorId,
        actorRole,
        statusCode: 200,
        latencyMs: Date.now() - start,
        isAuthoritative: false,
        success: true,
        maskedParams: { resourceId: targetResource, limit }
      });

      return mockResult;
    }

    // LIVE HTTP GET CALL
    const url = new URL(`${config.ogdDataGov.baseUrl}/${targetResource}`);
    url.searchParams.append('api-key', config.ogdDataGov.apiKey);
    url.searchParams.append('format', 'json');
    url.searchParams.append('limit', limit.toString());

    Object.entries(filters).forEach(([k, v]) => {
      url.searchParams.append(`filters[${k}]`, v);
    });

    const start = Date.now();
    try {
      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(config.mode.timeoutMs)
      });

      const latency = Date.now() - start;
      const data = await res.json();

      auditLogger.log({
        serviceName: this.serviceId,
        endpoint: url.origin + url.pathname,
        operation: 'FETCH_PUBLIC_DATASET',
        actorId,
        actorRole,
        statusCode: res.status,
        latencyMs: latency,
        isAuthoritative: res.ok,
        success: res.ok,
        maskedParams: { resourceId: targetResource, limit }
      });

      if (!res.ok) {
        console.warn(`[data.gov.in Error ${res.status}] Falling back to simulated dataset.`);
        return await mockAdapter.mockFetchOgdStats({ resourceId: targetResource, limit });
      }

      return {
        ...data,
        metadata: {
          isAuthoritative: true,
          isSimulated: false,
          dataSource: 'DATA_GOV_IN_OPEN_GOVERNMENT_PLATFORM',
          serviceName: this.serviceId,
          fetchedAt: new Date().toISOString()
        }
      };
    } catch (err) {
      console.warn(`[data.gov.in Request Failed: ${err.message}] Using mock fallback.`);
      return await mockAdapter.mockFetchOgdStats({ resourceId: targetResource, limit });
    }
  }
}

module.exports = new OgdDataGovClient();
