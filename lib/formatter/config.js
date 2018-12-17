'use strict';
/**
 * Config formatter
 *
 * @module lib/formatter/config
 */
const rootPrefix = '../..',
  OSTBase = require("@openstfoundation/openst-base"),
  InstanceComposer = OSTBase.InstanceComposer,
  cacheManagementConstants = require(rootPrefix + '/lib/globalConstant/cacheManagement');

/**
 * Class for config formatter
 *
 * @class
 */
class ConfigFormatter {
  /**
   * Constructor for config formatter
   *
   * @param {Object} configStrategy
   * @param {Object} instanceComposer
   * @constructor
   */
  constructor(configStrategy, instanceComposer) {
    const oThis = this;
    let chainIdConfigMap = {};
    for (let i = 0; i < configStrategy.chains.length; i++) {
      let currConfig = configStrategy.chains[i];

      chainIdConfigMap[currConfig.chainId] = currConfig;
    }
    oThis.chainIdConfigMap = chainIdConfigMap;
  }

  /**
   * Get config for a particular chain id
   *
   * @param {Number} chainId: chain Id to find config for
   * @returns {Object}: config for a particular chain id
   */
  configFor(chainId) {
    const oThis = this;

    return oThis.chainIdConfigMap[chainId];
  }

  /**
   * Format cache config
   *
   * @returns {Object}: returns formatted config
   */
  formatCacheConfig(config) {
    
    return config;
  }

  /**
   * Format storage config
   *
   * @param {Object} config: config to format
   * @returns {Object}: returns formatted config
   */
  formatStorageConfig(config) {

    return config
  }
  /**
   * return extra column config for a given table name
   *
   * @param {Object} tableIdentifier
   *
   * @returns {Object}
   */
  getExtraColumnConfigFor(tableIdentifier) {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy,
      extraStorageColumns = configStrategy['extraStorageColumns'] || {};
    return extraStorageColumns[tableIdentifier] || {};
  }
}

InstanceComposer.registerAsObject(ConfigFormatter, 'saas::SaasNamespace', 'configFormatter', true);

module.exports = ConfigFormatter;