'use strict';
/**
 * Cache for workflow status. This cache class is used only to clear cache. KIT-API sets this cache.
 * This cache contains an aggregated status of workflowsteps and workflows table data
 *
 * @module lib/kitSaasSharedCacheManagement/WorkflowStatus
 */
const rootPrefix = '../..',
  BaseCacheManagement = require(rootPrefix + '/lib/kitSaasSharedCacheManagement/Base');

/**
 * Class for workflow status cache
 *
 * @class
 */
class WorkflowStatus extends BaseCacheManagement {
  /**
   * Constructor for workflow status cache
   *
   * @param {Object} params - cache key generation & expiry related params
   *
   * @constructor
   */
  constructor(params) {
    super(params);

    const oThis = this;

    oThis.workflowId = params.workflowId;

    // Call sub class method to set cache key using params provided
    oThis._setCacheKeySuffix();

    // Call sub class method to set cache expiry using params provided
    oThis._setCacheExpiry();

    // Call sub class method to set cache implementer using params provided
    oThis._setCacheImplementer();
  }

  /**
   * Set cache key
   *
   * @return {String}
   */
  _setCacheKeySuffix() {
    const oThis = this;
    oThis.cacheKeySuffix = 'c_d_s_' + oThis.workflowId;
  }

  /**
   * Set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  _setCacheExpiry() {
    const oThis = this;
    oThis.cacheExpiry = 300; // 5 minutes ;
  }

  /**
   * This function should never be called. This cache should only be used to clear from saas-api.
   */
  async _fetchDataFromSource() {
    throw 'This function is not supported in saas-api';
  }
}

module.exports = WorkflowStatus;