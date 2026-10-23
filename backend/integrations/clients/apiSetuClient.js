const { getGovApiConfig } = require('../config/govApiConfig');
const { CONNECTION_STATES } = require('../types/connectionStates');
const auditLogger = require('../services/auditLogger');
const mockAdapter = require('../adapters/mockAdapter');

/**
 * Base API Setu Client
 * Implements robust HTTP communication with API Setu (apisetu.gov.in / api.apisetu.gov.in).
 * Features:
 * - Header-based authentication (X-APISETU-CLIENTID, X-APISETU-APIKEY)
 * - Strict 6000ms timeout with AbortSignal
 * - Circuit breaker against failing endpoints
 * - Graceful fallback to Mock Adapter when credentials are not present or in DEMO_MODE.
 */

class ApiSetuClient {
  constructor() {
    this.failureCount = 0;
    this.circuitOpenUntil = 0;
  }

  getConnectionState() {
    const config = getGovApiConfig();
    if (config.mode.forceMock) return CONNECTION_STATES.DEMO_MODE;
    if (config.apiSetu.statusOverride) return config.apiSetu.statusOverride;

    const hasCreds = Boolean(config.apiSetu.clientId && config.apiSetu.apiKey);
    if (!hasCreds) {
      return CONNECTION_STATES.DEMO_MODE;
    }

    if (Date.now() < this.circuitOpenUntil) {
      return CONNECTION_STATES.UNAVAILABLE;
    }

    return config.apiSetu.isSandbox ? CONNECTION_STATES.SANDBOX : CONNECTION_STATES.CONNECTED;
  }

  async post(endpointPath, payload, options = {}) {
    const config = getGovApiConfig();
    const state = this.getConnectionState();
    const serviceName = options.serviceName || 'API_SETU';
    const operation = options.operation || 'POST_REQUEST';
    const actorId = options.actorId || 'SYSTEM';
    const actorRole = options.actorRole || 'system';
    const txnId = payload.txnId || null;
    const consentId = payload.consentArtifact?.consent?.consentId || null;

    // Check Circuit Breaker
    if (Date.now() < this.circuitOpenUntil) {
      auditLogger.log({
        serviceName,
        endpoint: endpointPath,
        operation,
        actorId,
        actorRole,
        txnId,
        consentId,
        statusCode: 503,
        latencyMs: 1,
        isAuthoritative: false,
        success: false,
        errorMessage: 'Circuit breaker is OPEN due to repeated upstream connection timeouts.',
        maskedParams: options.maskedParams || {}
      });
      throw new Error(`[API Setu Gateway] Service is temporarily UNAVAILABLE (circuit breaker open).`);
    }

    // If in DEMO_MODE or credentials missing, trigger Mock Adapter
    if (state === CONNECTION_STATES.DEMO_MODE) {
      const start = Date.now();
      let mockResult = null;

      if (options.mockHandler) {
        mockResult = await options.mockHandler();
      } else {
        mockResult = { isSimulated: true, success: true, message: 'Mock response generated.' };
      }

      auditLogger.log({
        serviceName,
        endpoint: endpointPath,
        operation,
        actorId,
        actorRole,
        txnId,
        consentId,
        statusCode: 200,
        latencyMs: Date.now() - start,
        isAuthoritative: false,
        success: true,
        maskedParams: options.maskedParams || {}
      });

      return mockResult;
    }

    // LIVE / SANDBOX REQUEST EXECUTION
    const baseUrl = config.apiSetu.isSandbox ? config.apiSetu.sandboxUrl : config.apiSetu.baseUrl;
    const fullUrl = `${baseUrl}${endpointPath}`;
    const start = Date.now();

    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'X-APISETU-CLIENTID': config.apiSetu.clientId,
          'X-APISETU-APIKEY': config.apiSetu.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.mode.timeoutMs)
      });

      const latency = Date.now() - start;
      const data = await response.json();

      if (!response.ok) {
        this.failureCount++;
        if (this.failureCount >= 3) {
          this.circuitOpenUntil = Date.now() + 60000; // Open for 60 seconds
        }

        auditLogger.log({
          serviceName,
          endpoint: fullUrl,
          operation,
          actorId,
          actorRole,
          txnId,
          consentId,
          statusCode: response.status,
          latencyMs: latency,
          isAuthoritative: false,
          success: false,
          errorMessage: data.message || `HTTP ${response.status} from API Setu`,
          maskedParams: options.maskedParams || {}
        });

        // Safe error throw without exposing internal API keys
        throw new Error(`API Setu Error [${response.status}]: ${data.message || 'Department service rejected request.'}`);
      }

      // Success
      this.failureCount = 0;
      auditLogger.log({
        serviceName,
        endpoint: fullUrl,
        operation,
        actorId,
        actorRole,
        txnId,
        consentId,
        statusCode: 200,
        latencyMs: latency,
        isAuthoritative: true,
        success: true,
        maskedParams: options.maskedParams || {}
      });

      return {
        ...data,
        metadata: {
          isAuthoritative: true,
          isSimulated: false,
          dataSource: 'API_SETU_OFFICIAL_GATEWAY',
          serviceName,
          operation,
          environment: config.apiSetu.isSandbox ? 'SANDBOX' : 'PRODUCTION',
          receivedAt: new Date().toISOString()
        }
      };
    } catch (err) {
      const latency = Date.now() - start;
      this.failureCount++;

      auditLogger.log({
        serviceName,
        endpoint: fullUrl,
        operation,
        actorId,
        actorRole,
        txnId,
        consentId,
        statusCode: 504,
        latencyMs: latency,
        isAuthoritative: false,
        success: false,
        errorMessage: err.message,
        maskedParams: options.maskedParams || {}
      });

      // If network fails and mock fallback is allowed, fall back gracefully with clear simulated label
      console.warn(`[API Setu Client] Live endpoint failed (${err.message}). Falling back to labeled mock adapter.`);
      if (options.mockHandler) {
        return await options.mockHandler();
      }

      throw new Error(`API Setu Gateway communication error: ${err.message}`);
    }
  }
}

module.exports = new ApiSetuClient();
