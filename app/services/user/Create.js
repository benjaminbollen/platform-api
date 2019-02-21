'use strict';
/**
 * This service helps in adding Token User in our System
 *
 * Note:- if token id is provided in parameter,
 */

const uuidV4 = require('uuid/v4'),
  OSTBase = require('@openstfoundation/openst-base'),
  InstanceComposer = OSTBase.InstanceComposer;

const rootPrefix = '../../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  ServiceBase = require(rootPrefix + '/app/services/Base'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  shardConst = require(rootPrefix + '/lib/globalConstant/shard'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  shardConstant = require(rootPrefix + '/lib/globalConstant/shard'),
  localCipher = require(rootPrefix + '/lib/encryptors/localCipher'),
  resultType = require(rootPrefix + '/lib/globalConstant/resultType'),
  tokenUserConstants = require(rootPrefix + '/lib/globalConstant/tokenUser'),
  ConfigStrategyObject = require(rootPrefix + '/helpers/configStrategy/Object'),
  AddressesEncryptor = require(rootPrefix + '/lib/encryptors/AddressesEncryptor');

require(rootPrefix + '/lib/cacheManagement/shared/AvailableShard');
require(rootPrefix + '/lib/cacheManagement/chain/TokenShardNumber');
require(rootPrefix + '/app/models/ddb/sharded/User');
require(rootPrefix + '/lib/cacheManagement/chain/UserSaltEncryptorKey');

class Create extends ServiceBase {
  /**
   * @constructor
   *
   * @param params
   * @param {Number} params.client_id - client Id
   * @param {String} params.kind - Kind (Company/User)
   * @param {Number} [params.token_id] - token Id
   */
  constructor(params) {
    super(params);

    const oThis = this;

    oThis.clientId = params.client_id;
    oThis.tokenId = params.token_id;
    oThis.kind = params.kind;

    oThis.shardNumbersMap = {};
    oThis.userSaltEncrypted = null;
    oThis.configStrategyObj = null;
  }

  /**
   * perform - perform user creation
   *
   * @return {Promise<void>}
   */
  async _asyncPerform() {
    const oThis = this;

    if (!oThis.tokenId) {
      await oThis._fetchTokenDetails();
    }

    oThis.userId = uuidV4();

    await oThis._allocateShards();

    await oThis._generateUserSalt();

    return oThis.createUser();
  }

  /**
   * _allocateShards - allocate shards
   *
   * @private
   */
  async _allocateShards() {
    const oThis = this;

    let AvailableShardCache = oThis.ic().getShadowedClassFor(coreConstants.icNameSpace, 'AvailableShardsCache'),
      availableShardCache = new AvailableShardCache();

    let response = await availableShardCache.fetch(),
      allAvailableShards = response.data,
      availableShardsForChain = allAvailableShards[oThis._configStrategyObject.auxChainId];

    let r1 = basicHelper.getRandomNumber(0, availableShardsForChain[shardConstant.deviceEntityKind].length - 1),
      r2 = basicHelper.getRandomNumber(0, availableShardsForChain[shardConstant.sessionEntityKind].length - 1);
    // let r3 = basicHelper.getRandomNumber(0, availableShardsForChain[shardConstant.recoveryAddressEntityKind].length - 1);

    oThis.shardNumbersMap[shardConstant.deviceEntityKind] = availableShardsForChain[shardConstant.deviceEntityKind][r1];
    oThis.shardNumbersMap[shardConstant.sessionEntityKind] =
      availableShardsForChain[shardConstant.sessionEntityKind][r2];
    // oThis.shardNumbersMap[shardConstant.recoveryAddressEntityKind] = availableShards[shardConstant.recoveryAddressEntityKind][r3];
  }

  /**
   * Generate salt for user
   *
   * @returns {Promise<void>}
   * @private
   */
  async _generateUserSalt() {
    const oThis = this;

    let UserSaltEncryptorKeyCache = oThis
        .ic()
        .getShadowedClassFor(coreConstants.icNameSpace, 'UserSaltEncryptorKeyCache'),
      encryptionSaltResp = await new UserSaltEncryptorKeyCache({ tokenId: oThis.tokenId }).fetchDecryptedData();

    let encryptionSalt = encryptionSaltResp.data.encryption_salt_d,
      userSalt = localCipher.generateRandomSalt();

    oThis.userSaltEncrypted = await new AddressesEncryptor({ encryptionSaltD: encryptionSalt }).encrypt(userSalt);
  }

  /**
   * createUser - Creates new user
   *
   * @return {Promise<string>}
   */
  async createUser() {
    const oThis = this,
      TokenShardNumbers = oThis.ic().getShadowedClassFor(coreConstants.icNameSpace, 'TokenShardNumbersCache'),
      tokenShardNumbers = new TokenShardNumbers({ tokenId: oThis.tokenId });

    let shardNumbers = await tokenShardNumbers.fetch();

    let timeInSecs = Math.floor(Date.now() / 1000);

    let params = {
      tokenId: oThis.tokenId,
      userId: oThis.userId,
      kind: oThis.kind,
      salt: oThis.userSaltEncrypted,
      deviceShardNumber: oThis.shardNumbersMap[shardConst.deviceEntityKind],
      sessionShardNumber: oThis.shardNumbersMap[shardConst.sessionEntityKind],
      status: tokenUserConstants.createdStatus,
      updatedTimestamp: timeInSecs
    };

    if (oThis.tokenHolderAddress) {
      params['tokenHolderAddress'] = oThis.tokenHolderAddress;
    }

    if (oThis.multisigAddress) {
      params['multisigAddress'] = oThis.multisigAddress;
    }

    let User = oThis.ic().getShadowedClassFor(coreConstants.icNameSpace, 'UserModel'),
      user = new User({ shardNumber: shardNumbers.data[shardConst.userEntityKind] });

    let insertRsp = await user.insertUser(params);

    if (insertRsp.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_u_c_1',
          api_error_identifier: 'something_went_wrong'
        })
      );
    }

    // NOTE: As base library change the params values, reverse sanitize the data
    return responseHelper.successWithData({ [resultType.user]: user._sanitizeRowFromDynamo(params) });
  }

  /**
   * Object of config strategy class
   *
   * @return {Object}
   */
  get _configStrategyObject() {
    const oThis = this;

    if (oThis.configStrategyObj) return oThis.configStrategyObj;

    oThis.configStrategyObj = new ConfigStrategyObject(oThis.ic().configStrategy);

    return oThis.configStrategyObj;
  }
}

InstanceComposer.registerAsShadowableClass(Create, coreConstants.icNameSpace, 'CreateUser');

module.exports = {};
