'use strict';
/**
 * Create device.
 *
 * @module app/services/device/Create
 */

const rootPrefix = '../../..',
  OSTBase = require('@openstfoundation/openst-base'),
  ServiceBase = require(rootPrefix + '/app/services/Base'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  CommonValidator = require(rootPrefix + '/lib/validators/Common'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  deviceConstant = require(rootPrefix + '/lib/globalConstant/device'),
  TokenCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/Token'),
  resultType = require(rootPrefix + '/lib/globalConstant/resultType'),
  ConfigStrategyObject = require(rootPrefix + '/helpers/configStrategy/Object');

const InstanceComposer = OSTBase.InstanceComposer;

// Following require(s) for registering into instance composer
require(rootPrefix + '/app/models/ddb/sharded/Device');
require(rootPrefix + '/lib/cacheManagement/chainMulti/TokenUserDetail');

/**
 * Class for CreateDevice
 *
 * @class CreateDevice
 *
 * @param {Integer} params.client_id
 * @param {String} params.user_id - uuid
 * @param {String} params.address
 * @param {String} params.personal_sign_address
 * @param {String} params.device_name
 * @param {String} params.device_uuid
 */
class CreateDevice extends ServiceBase {
  constructor(params) {
    super(params);

    const oThis = this;

    oThis.clientId = params.client_id;
    oThis.userId = params.user_id;
    oThis.walletAddress = params.address;
    oThis.personalSignAddress = params.personal_sign_address;
    oThis.deviceName = params.device_name;
    oThis.deviceUuid = params.device_uuid;

    oThis.tokenId = null;
  }

  /**
   * Main performer method for the class.
   *
   * @returns {Promise<void>}
   */
  perform() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(err) {
      logger.error(' In catch block of lib/device/Create.js');

      return responseHelper.error({
        internal_error_identifier: 'a_s_d_c_1',
        api_error_identifier: 'something_went_wrong',
        debug_options: err,
        error_config: { error: err.toString() }
      });
    });
  }

  /**
   * Async performer.
   *
   * @returns {Promise<*>}
   */
  async asyncPerform() {
    const oThis = this;

    await oThis._validate();

    oThis.tokenId = await oThis._getTokenId();

    oThis._sanitize();

    return await oThis._create();
  }

  /**
   * This method validates input parameters.
   *
   */
  _validate() {
    const oThis = this;
    //&& CommonValidator.validatePersonalSign(oThis.personalSignAddress)
    if (
      CommonValidator.validateUuidV4(oThis.userId) &&
      CommonValidator.validateUuidV4(oThis.deviceUuid) &&
      CommonValidator.validateEthAddress(oThis.walletAddress)
    ) {
      logger.info('Validations Done');
    } else {
      logger.info('Validations Failed');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_d_c_2',
          api_error_identifier: 'something_went_wrong',
          debug_options: {
            userId: oThis.userId,
            deviceUuid: oThis.deviceUuid,
            personalSignAddress: oThis.personalSignAddress,
            walletAddress: oThis.walletAddress
          },
          error_config: {}
        })
      );
    }
  }

  /**
   * Get tokenId from tokens cache using clientId.
   *
   * @returns {Promise<*>}
   * @private
   */
  async _getTokenId() {
    const oThis = this,
      tokenCache = new TokenCache({ clientId: oThis.clientId });
    let tokenCacheResponse = await tokenCache.fetch();
    return tokenCacheResponse.data.id;
  }

  /**
   * Sanitize input parameters.
   *
   */
  _sanitize() {
    const oThis = this;
    oThis.userId = oThis.userId.toLowerCase();
    oThis.personalSignAddress = oThis.personalSignAddress.toLowerCase();
    oThis.walletAddress = oThis.walletAddress.toLowerCase();
  }

  /***
   *
   * config strategy
   *
   * @return {object}
   */
  get _configStrategy() {
    const oThis = this;
    return oThis.ic().configStrategy;
  }

  /***
   *
   * object of config strategy klass
   *
   * @return {object}
   */
  get _configStrategyObject() {
    const oThis = this;
    if (oThis.configStrategyObj) return oThis.configStrategyObj;
    oThis.configStrategyObj = new ConfigStrategyObject(oThis._configStrategy);
    return oThis.configStrategyObj;
  }

  /**
   * This method creates entry into device table.
   *
   * @returns {Promise<*>}
   */
  async _create() {
    const oThis = this,
      TokenUSerDetailsCache = oThis.ic().getShadowedClassFor(coreConstants.icNameSpace, 'TokenUserDetailsCache'),
      tokenUserDetailsCacheObj = new TokenUSerDetailsCache({ tokenId: oThis.tokenId, userIds: [oThis.userId] }),
      cacheFetchRsp = await tokenUserDetailsCacheObj.fetch();

    let userData = cacheFetchRsp.data[oThis.userId];

    let Device = oThis.ic().getShadowedClassFor(coreConstants.icNameSpace, 'DeviceModel'),
      chainId = oThis._configStrategyObject.auxChainId,
      device = new Device({ chainId: chainId, shardNumber: userData['deviceShardNumber'] }),
      params = {
        userId: oThis.userId,
        walletAddress: oThis.walletAddress,
        personalSignAddress: oThis.personalSignAddress,
        deviceUuid: oThis.deviceUuid,
        deviceName: oThis.deviceName,
        status: deviceConstant.registeredStatus,
        updatedTimestamp: Math.floor(new Date().getTime() / 1000)
      };

    await device.create(params);

    logger.info('Entry created in device table with shardNumber ', userData['deviceShardNumber']);

    return responseHelper.successWithData({ [resultType.device]: params });
  }
}

InstanceComposer.registerAsShadowableClass(CreateDevice, coreConstants.icNameSpace, 'CreateDevice');

module.exports = {};
