'use strict';

/*
 * Cache for fetching token addresses. Extends base cache.
 */

const OSTBase = require('@openstfoundation/openst-base'),
  InstanceComposer = OSTBase.InstanceComposer;

const rootPrefix = '../..',
  BaseCacheManagement = require(rootPrefix + '/lib/cacheManagement/Base'),
  TokenAddress = require(rootPrefix + '/app/models/mysql/TokenAddress'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  cacheManagementConst = require(rootPrefix + '/lib/globalConstant/cacheManagement');

class TokenAddressCache extends BaseCacheManagement {
  /**
   * Constructor
   *
   * @param {Object} params - cache key generation & expiry related params
   *
   * @constructor
   */
  constructor(params) {
    super(params);

    const oThis = this;

    oThis.tokenId = params.tokenId;

    oThis.useObject = true;
    oThis.cacheType = cacheManagementConst.memcached;
    oThis.consistentBehavior = '1';

    // Call sub class method to set cache key using params provided
    oThis._setCacheKey();

    // Call sub class method to set cache expiry using params provided
    oThis._setCacheExpiry();

    // Call sub class method to set cache implementer using params provided
    oThis._setCacheImplementer();
  }

  /**
   * set cache keys
   */
  _setCacheKey() {
    const oThis = this;
    oThis.cacheKey = oThis._cacheKeyPrefix() + 'ta_' + oThis.tokenId;
  }

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   */
  _setCacheExpiry() {
    const oThis = this;
    oThis.cacheExpiry = 3 * 24 * 60 * 60; // 72 hours ;
  }

  /**
   * fetch data from source
   *
   * @return {Result}
   */
  async fetchDataFromSource() {
    const oThis = this;

    return new TokenAddress().fetchAllAddresses({
      tokenId: oThis.tokenId
    });
  }
}

InstanceComposer.registerAsShadowableClass(TokenAddressCache, coreConstants.icNameSpace, 'TokenAddressCache');

module.exports = TokenAddressCache;