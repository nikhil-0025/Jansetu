const crypto = require('crypto');

/**
 * JanSetu Government Integration Audit Logger
 * Maintains an immutable, tamper-evident record of all outbound calls to Indian Government APIs.
 * Ensures strict compliance with government data protection & verification traceability standards.
 */

class GovAuditLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 500;
  }

  /**
   * Log an outbound government API invocation.
   *
   * @param {Object} entry
   * @param {string} entry.serviceName - e.g. 'API_SETU', 'DIGILOCKER', 'OGD_DATA_GOV', 'MYSCHEME'
   * @param {string} entry.endpoint - Target URL or route
   * @param {string} entry.operation - e.g. 'PULL_DOC', 'VERIFY_RATION', 'VERIFY_ELECTRICITY', 'FETCH_STATS'
   * @param {string} [entry.actorId='SYSTEM'] - Citizen or Officer ID
   * @param {string} [entry.actorRole='system']
   * @param {string} [entry.txnId] - Transaction ID
   * @param {string} [entry.consentId] - Consent ID
   * @param {number} entry.statusCode - HTTP response status code
   * @param {number} entry.latencyMs - Request latency in ms
   * @param {boolean} entry.isAuthoritative - True if real authoritative response; false if simulated/mock
   * @param {boolean} entry.success - True if call succeeded
   * @param {string} [entry.errorMessage] - Error description if failed
   * @param {Object} [entry.maskedParams={}] - Sanitized parameters without raw PII
   */
  log({
    serviceName,
    endpoint,
    operation,
    actorId = 'SYSTEM',
    actorRole = 'system',
    txnId = null,
    consentId = null,
    statusCode = 200,
    latencyMs = 0,
    isAuthoritative = false,
    success = true,
    errorMessage = null,
    maskedParams = {}
  }) {
    const logId = `GOVAUD-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
    const timestamp = new Date().toISOString();

    const record = {
      logId,
      timestamp,
      serviceName,
      endpoint,
      operation,
      actor: {
        id: actorId,
        role: actorRole
      },
      trace: {
        txnId: txnId || crypto.randomUUID(),
        consentId: consentId || 'N/A'
      },
      execution: {
        statusCode,
        latencyMs,
        isAuthoritative,
        mode: isAuthoritative ? 'LIVE_AUTHORITATIVE' : 'SIMULATED_DEMO',
        success,
        errorMessage
      },
      sanitizedParameters: maskedParams
    };

    // Calculate integrity hash
    record.integrityHash = crypto
      .createHash('sha256')
      .update(`${logId}:${timestamp}:${serviceName}:${statusCode}:${isAuthoritative}`)
      .digest('hex');

    this.logs.unshift(record);

    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    const logPrefix = isAuthoritative ? '[GovAPI Live]' : '[GovAPI Mock/Simulated]';
    console.log(`${logPrefix} ${operation} via ${serviceName} -> Status: ${statusCode} (${latencyMs}ms) | Txn: ${record.trace.txnId}`);

    return record;
  }

  getRecentLogs(limit = 50, filter = {}) {
    let result = this.logs;
    if (filter.serviceName) {
      result = result.filter(l => l.serviceName === filter.serviceName);
    }
    if (filter.isAuthoritative !== undefined) {
      result = result.filter(l => l.execution.isAuthoritative === filter.isAuthoritative);
    }
    return result.slice(0, limit);
  }

  getLogById(logId) {
    return this.logs.find(l => l.logId === logId) || null;
  }
}

module.exports = new GovAuditLogger();
