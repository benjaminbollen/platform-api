'use strict';

/**
 * Class to get client config strategy details from cache. Extends the baseCache class.
 *
 * @module /lib/sharedCacheMultiManagement/configStrategy
 */

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/sharedCacheMultiManagement/base'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/mysql/ConfigStrategy'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  util = require(rootPrefix + '/lib/util'),
  cacheManagementConst = require(rootPrefix + '/lib/globalConstant/cacheManagement');

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 */
class ConfigStrategyCache extends baseCache{

  constructor(params) {
    super(params);

    const oThis = this;

    oThis.strategyIds = params['strategyIds'];
    oThis.cacheType = cacheManagementConst.inMemory;
    oThis.consistentBehavior = '0';

    // Call sub class method to set cache key using params provided
    oThis.setCacheKeys();

    // Call sub class method to set cache expiry using params provided
    oThis.setCacheExpiry();

    // Call sub class method to set cache implementer using params provided
    oThis.setCacheImplementer();
  }

  /**
   * set cache key
   *
   * @return {Object}
   */
  setCacheKeys() {
    const oThis = this;

    oThis.cacheKeys = {};

    for (let i = 0; i < oThis.strategyIds.length; i++) {
      oThis.cacheKeys[oThis._cacheKeyPrefix() + 'cs_sd_' + oThis.strategyIds[i]] = oThis.strategyIds[i].toString();
    }
    oThis.invertedCacheKeys = util.invert(oThis.cacheKeys);

    return oThis.cacheKeys;
  }

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry() {
    const oThis = this;

    oThis.cacheExpiry = 86400; // 24 hours

    return oThis.cacheExpiry;
  }

  async fetchDataFromSource(cacheMissStrategyIds) {
    const oThis = this;

    if (!cacheMissStrategyIds) {
      return responseHelper.error({
        internal_error_identifier: 'cmm_eca_1_config_strategy',
        api_error_identifier: 'blank_addresses',
        error_config: errorConfig
      });
    }

    const queryResponse = await new ConfigStrategyModel().getByIds(cacheMissStrategyIds);

    if (!queryResponse) {
      return responseHelper.error({
        internal_error_identifier: 'cmm_eca_2',
        api_error_identifier: 'no_data_found',
        error_config: errorConfig
      });
    }

    return responseHelper.successWithData(queryResponse);
  }


}

module.exports = ConfigStrategyCache;