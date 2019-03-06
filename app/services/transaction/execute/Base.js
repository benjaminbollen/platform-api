'use strict';

/**
 * Base Execute Tx service
 *
 * @module app/services/transaction/execute/Base
 */

const uuidv4 = require('uuid/v4'),
  OpenSTJs = require('@openstfoundation/openst.js'),
  TokenHolderHelper = OpenSTJs.Helpers.TokenHolder;

const rootPrefix = '../../../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  resultType = require(rootPrefix + '/lib/globalConstant/resultType'),
  ServiceBase = require(rootPrefix + '/app/services/Base'),
  web3Provider = require(rootPrefix + '/lib/providers/web3'),
  kwcConstant = require(rootPrefix + '/lib/globalConstant/kwc'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  entityConst = require(rootPrefix + '/lib/globalConstant/shard'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  ruleConstants = require(rootPrefix + '/lib/globalConstant/rule'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  errorConstant = require(rootPrefix + '/lib/globalConstant/error'),
  rabbitmqProvider = require(rootPrefix + '/lib/providers/rabbitmq'),
  NonceForSession = require(rootPrefix + '/lib/nonce/get/ForSession'),
  rabbitmqConstant = require(rootPrefix + '/lib/globalConstant/rabbitmq'),
  contractConstants = require(rootPrefix + '/lib/globalConstant/contract'),
  ConfigStrategyObject = require(rootPrefix + '/helpers/configStrategy/Object'),
  tokenAddressConstants = require(rootPrefix + '/lib/globalConstant/tokenAddress'),
  TransactionMetaModel = require(rootPrefix + '/app/models/mysql/TransactionMeta'),
  transactionMetaConst = require(rootPrefix + '/lib/globalConstant/transactionMeta'),
  TokenAddressCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/TokenAddress'),
  connectionTimeoutConst = require(rootPrefix + '/lib/globalConstant/connectionTimeout'),
  PendingTransactionCrud = require(rootPrefix + '/lib/transactions/PendingTransactionCrud'),
  pendingTransactionConstants = require(rootPrefix + '/lib/globalConstant/pendingTransaction'),
  ProcessTokenRuleExecutableData = require(rootPrefix +
    '/lib/executeTransactionManagement/processExecutableData/TokenRule'),
  ProcessPricerRuleExecutableData = require(rootPrefix +
    '/lib/executeTransactionManagement/processExecutableData/PricerRule'),
  TokenRuleDetailsByTokenId = require(rootPrefix + '/lib/cacheManagement/kitSaas/TokenRuleDetailsByTokenId');

require(rootPrefix + '/lib/cacheManagement/chain/TokenShardNumber');
require(rootPrefix + '/app/models/ddb/sharded/Balance');
require(rootPrefix + '/lib/executeTransactionManagement/GetPublishDetails');
require(rootPrefix + '/lib/cacheManagement/chainMulti/UserDetail');

/**
 * Class
 *
 * @class
 */
class ExecuteTxBase extends ServiceBase {
  /**
   * Constructor
   *
   * @param {Object} params
   * @param {String} params.user_id - user_id
   * @param {Number} params.token_id - token id
   * @param {Object} params.client_id - client id
   * @param {String} params.to - rules address
   * @param {Object} params.raw_calldata - raw_calldata
   * @param {Object} [params.meta_property]
   *
   * @constructor
   */
  constructor(params) {
    super(params);

    const oThis = this;

    oThis.userId = params.user_id;
    oThis.tokenId = params.token_id;
    oThis.clientId = params.client_id;
    oThis.toAddress = params.to;
    oThis.rawCalldata = params.raw_calldata;
    oThis.metaProperty = params.meta_property;

    oThis.tokenAddresses = null;
    oThis.erc20Address = null;
    oThis.tokenRuleAddress = null;
    oThis.pricerRuleAddress = null;
    oThis.pricerRuleData = null;
    oThis.sessionKeyAddress = null;
    oThis.pessimisticDebitAmount = null;
    oThis.unsettledDebits = null;
    oThis.transactionUuid = null;
    oThis.ruleId = null;
    oThis.configStrategyObj = null;
    oThis.rmqInstance = null;
    oThis.web3Instance = null;
    oThis.balanceShardNumber = null;
    oThis.tokenHolderAddress = null;
    oThis.gas = null;
    oThis.sessionKeyNonce = null;
    oThis.gasPrice = null;
    oThis.estimatedTransfers = null;
    oThis.failureStatusToUpdateInTxMeta = null;
    oThis.pessimisticAmountDebitted = null;
    oThis.pendingTransactionInserted = null;
    oThis.transactionMetaId = null;
    oThis.token = null;
    oThis.pendingTransactionData = null;
    oThis.callPrefix = null;
    oThis.executableTxData = null;
  }

  /**
   * Main performer method for the class.
   *
   * @returns {Promise<T>}
   */
  perform() {
    const oThis = this;

    return oThis._asyncPerform().catch(async function(err) {
      let customError;
      if (responseHelper.isCustomResult(err)) {
        customError = err;
      } else {
        logger.error(`In catch block of ${__filename}`, err);
        customError = responseHelper.error({
          internal_error_identifier: 's_et_b_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: { error: err.toString() }
        });
      }

      await oThis._revertOperations(customError);

      return customError;
    });
  }

  /**
   * asyncPerform
   *
   * @return {Promise<any>}
   */
  async _asyncPerform() {
    const oThis = this;

    await oThis._validateAndSanitize();

    await oThis._initializeVars();

    await oThis._processExecutableData();

    await oThis._setSessionAddress();

    await oThis._setNonce();

    await oThis._setExecutableTxData();

    await oThis._setSignature();

    await oThis._verifySessionSpendingLimit();

    await oThis._createTransactionMeta();

    await oThis._performPessimisticDebit();

    await oThis._createPendingTransaction();

    await oThis._publishToRMQ();

    return Promise.resolve(
      responseHelper.successWithData({
        [resultType.transaction]: oThis.pendingTransactionData
      })
    );
  }

  /**
   * Initializes web3 and rmq instances and fetches token holder address
   *
   * @return {Promise<void>}
   * @private
   */
  async _initializeVars() {
    const oThis = this;

    oThis.toAddress = basicHelper.sanitizeAddress(oThis.toAddress);
    oThis.gasPrice = contractConstants.auxChainGasPrice;
    oThis.transactionUuid = uuidv4();

    await oThis._setRmqInstance();

    await oThis._setWeb3Instance();

    // fetch token details for client id
    if (oThis.clientId && !oThis.token) {
      logger.debug('oThis.clientId', oThis.clientId, oThis.token);
      await oThis._fetchTokenDetails();
      logger.debug('oThis.token', oThis.clientId, oThis.token);
    }

    await oThis._setTokenAddresses();

    await oThis._setTokenHolderAddress();

    await oThis._setCallPrefix();
  }

  /**
   * Process executable data
   *
   * @private
   */
  async _processExecutableData() {
    const oThis = this;

    let ruleDetails = await oThis._getRulesDetails();

    let response;

    if (oThis.toAddress === oThis.tokenRuleAddress) {
      oThis.ruleId = ruleDetails[ruleConstants.tokenRuleName].ruleId;
      response = await new ProcessTokenRuleExecutableData({
        contractAddress: oThis.tokenRuleAddress,
        web3Instance: oThis.web3Instance,
        tokenHolderAddress: oThis.tokenHolderAddress,
        rawCallData: oThis.rawCalldata
      }).perform();
    } else if (oThis.toAddress === oThis.pricerRuleAddress) {
      oThis.ruleId = ruleDetails[ruleConstants.pricerRuleName].ruleId;
      response = await new ProcessPricerRuleExecutableData({
        contractAddress: oThis.pricerRuleAddress,
        web3Instance: oThis.web3Instance,
        tokenHolderAddress: oThis.tokenHolderAddress,
        auxChainId: oThis.auxChainId,
        conversionFactor: oThis.token.conversionFactor,
        rawCallData: oThis.rawCalldata
      }).perform();
    } else {
      return oThis._validationError('s_et_b_4', ['invalid_to'], {
        toAddress: oThis.toAddress
      });
    }

    if (response.isFailure()) {
      return Promise.reject(response);
    }

    let responseData = response.data;
    oThis.pessimisticDebitAmount = responseData.pessimisticDebitAmount;
    oThis.transferExecutableData = responseData.transferExecutableData;
    oThis.estimatedTransfers = responseData.estimatedTransfers;
    oThis.gas = responseData.gas;

    await oThis._setUserUuidsInEstimatedTransfers(responseData.affectedTokenHolderAddresses);
  }

  /**
   *
   * @param {Array} affectedTokenHolderAddresses
   *
   * @private
   */
  async _setUserUuidsInEstimatedTransfers(affectedTokenHolderAddresses) {
    const oThis = this;
    let UserDetailCache = oThis.ic().getShadowedClassFor(coreConstants.icNameSpace, 'UserDetailCache'),
      userDetailRsp = await new UserDetailCache({
        tokenHolderAddresses: affectedTokenHolderAddresses,
        tokenId: oThis.tokenId
      }).fetch();
    if (userDetailRsp.isFailure()) {
      return Promise.reject(userDetailRsp);
    }
    let userDetailsData = userDetailRsp.data;
    for (let i = 0; i < oThis.estimatedTransfers.length; i++) {
      let estimatedTransfer = oThis.estimatedTransfers[i],
        fromUserId = userDetailsData[estimatedTransfer.fromAddress]['userId'],
        toUserId = userDetailsData[estimatedTransfer.toAddress]['userId'];
      if (fromUserId) {
        estimatedTransfer.fromUserId = fromUserId;
      }
      if (toUserId) {
        estimatedTransfer.toUserId = toUserId;
      }
    }
  }

  /**
   * Perform Pessimistic Debit
   *
   * @private
   */
  async _performPessimisticDebit() {
    const oThis = this;

    await oThis._setBalanceShardNumber();

    let BalanceModel = oThis.ic().getShadowedClassFor(coreConstants.icNameSpace, 'BalanceModel'),
      balanceObj = new BalanceModel({ shardNumber: oThis.balanceShardNumber });

    let balanceUpdateParams = {
      erc20Address: oThis.tokenAddresses[tokenAddressConstants.utilityBrandedTokenContract],
      tokenHolderAddress: oThis.tokenHolderAddress,
      blockChainUnsettleDebits: basicHelper.formatWeiToString(oThis.pessimisticDebitAmount)
    };

    await balanceObj.updateBalance(balanceUpdateParams).catch(function(updateBalanceResponse) {
      logger.error(updateBalanceResponse);
      if (updateBalanceResponse.internalErrorCode.endsWith(errorConstant.insufficientFunds)) {
        return oThis._validationError(`s_et_b_9:${updateBalanceResponse.internalErrorCode}`, ['insufficient_funds'], {
          balanceUpdateParams: balanceUpdateParams
        });
      }
      return updateBalanceResponse;
    });

    oThis.pessimisticAmountDebitted = true;

    oThis.unsettledDebits = [balanceUpdateParams];
  }

  /**
   * Get balance shard for token id
   *
   * @private
   */
  async _setBalanceShardNumber() {
    const oThis = this,
      TokenShardNumbersCache = oThis.ic().getShadowedClassFor(coreConstants.icNameSpace, 'TokenShardNumbersCache');

    let response = await new TokenShardNumbersCache({ tokenId: oThis.tokenId }).fetch();

    let balanceShardNumber = response.data[entityConst.balanceEntityKind];

    if (!balanceShardNumber) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_et_b_6',
          api_error_identifier: 'something_went_wrong',
          debug_options: {
            shards: response.data
          }
        })
      );
    }

    oThis.balanceShardNumber = balanceShardNumber;
  }

  /**
   * create entry in tx meta table.
   *
   * @return {Promise<void>}
   * @private
   */
  async _createTransactionMeta() {
    const oThis = this;

    let createRsp = await new TransactionMetaModel()
      .insert({
        transaction_uuid: oThis.transactionUuid,
        associated_aux_chain_id: oThis.auxChainId,
        token_id: oThis.tokenId,
        status: transactionMetaConst.invertedStatuses[transactionMetaConst.queuedStatus],
        kind: transactionMetaConst.invertedKinds[transactionMetaConst.ruleExecution],
        next_action_at: transactionMetaConst.getNextActionAtFor(transactionMetaConst.queuedStatus),
        session_address: oThis.sessionKeyAddress,
        session_nonce: oThis.sessionKeyNonce
      })
      .fire();

    oThis.transactionMetaId = createRsp.insertId;
  }

  /**
   *
   *
   * @private
   */
  async _rollBackPessimisticDebit() {
    const oThis = this;

    let BalanceModel = oThis.ic().getShadowedClassFor(coreConstants.icNameSpace, 'BalanceModel'),
      balanceObj = new BalanceModel({ shardNumber: oThis.balanceShardNumber });

    let buffer = {
      erc20Address: oThis.tokenAddresses[tokenAddressConstants.utilityBrandedTokenContract],
      tokenHolderAddress: oThis.tokenHolderAddress,
      blockChainUnsettleDebits: basicHelper.formatWeiToString(oThis.pessimisticDebitAmount.mul(-1))
    };

    await balanceObj.updateBalance(buffer);
  }

  /***
   *
   * Create Pending transaction in Db
   *
   * @return {Promise<*>}
   */
  async _createPendingTransaction() {
    const oThis = this,
      currentTimestamp = basicHelper.getCurrentTimestampInSeconds();

    let insertRsp = await new PendingTransactionCrud(oThis.auxChainId).create({
      transactionData: {
        to: oThis.tokenHolderAddress,
        gas: oThis.gas,
        gasPrice: oThis.gasPrice
      },
      unsettledDebits: oThis.unsettledDebits,
      eip1077Signature: oThis.signatureData,
      metaProperty: oThis.metaProperty,
      ruleId: oThis.ruleId,
      transferExecutableData: oThis.transferExecutableData,
      transfers: oThis.estimatedTransfers,
      transactionUuid: oThis.transactionUuid,
      ruleAddress: oThis.toAddress,
      erc20Address: oThis.erc20Address,
      sessionKeyNonce: oThis.sessionKeyNonce,
      sessionKeyAddress: oThis.sessionKeyAddress,
      status: pendingTransactionConstants.createdStatus,
      tokenId: oThis.tokenId,
      toBeSyncedInEs: 1,
      createdTimestamp: currentTimestamp,
      updatedTimestamp: currentTimestamp
    });
    if (insertRsp.isFailure()) {
      return Promise.reject(insertRsp);
    }

    oThis.pendingTransactionInserted = 1;
    oThis.pendingTransactionData = insertRsp.data;
  }

  /**
   * Publish to RMQ
   *
   * @return {Promise<void>}
   * @private
   */
  async _publishToRMQ() {
    const oThis = this,
      ExTxGetPublishDetails = oThis.ic().getShadowedClassFor(coreConstants.icNameSpace, 'ExTxGetPublishDetails'),
      exTxGetPublishDetails = new ExTxGetPublishDetails({
        tokenId: oThis.tokenId,
        ephemeralAddress: oThis.sessionKeyAddress
      });

    let publishDetails = await exTxGetPublishDetails.perform().catch(async function(error) {
      logger.error(`In catch block of exTxGetPublishDetails in file: ${__filename}`, error);
      return Promise.reject(error);
    });

    let messageParams = {
      topics: [publishDetails.topicName],
      publisher: 'OST',
      message: {
        kind: kwcConstant.executeTx,
        payload: {
          tokenAddressId: publishDetails.tokenAddressId,
          transaction_uuid: oThis.transactionUuid,
          transactionMetaId: oThis.transactionMetaId
        }
      }
    };

    let setToRMQ = await oThis.rmqInstance.publishEvent.perform(messageParams);

    if (setToRMQ.isFailure()) {
      oThis.failureStatusToUpdateInTxMeta = transactionMetaConst.queuedFailedStatus;
      return Promise.reject(setToRMQ);
    }

    return setToRMQ;
  }

  /**
   * Revert operations
   *
   * @param customError
   * @return {Promise<void>}
   * @private
   */
  async _revertOperations(customError) {
    const oThis = this;

    if (oThis.pessimisticAmountDebitted) {
      logger.debug('something_went_wrong rolling back pessimistic debited balances');
      await oThis._rollBackPessimisticDebit().catch(async function(rollbackError) {
        // TODO: Mark user balance as dirty
        logger.error(`In catch block of _rollBackPessimisticDebit in file: ${__filename}`, rollbackError);
      });
    }

    if (oThis.pendingTransactionInserted) {
      new PendingTransactionCrud(oThis.chainId)
        .update({
          transactionUuid: oThis.transactionUuid,
          status: pendingTransactionConstants.failedStatus
        })
        .catch(async function(updatePendingTxError) {
          // Do nothing
        });
    }

    if (oThis.transactionMetaId) {
      await new TransactionMetaModel().releaseLockAndMarkStatus({
        status: oThis.failureStatusToUpdateInTxMeta || transactionMetaConst.finalFailedStatus,
        receiptStatus: transactionMetaConst.failureReceiptStatus,
        id: oThis.transactionMetaId,
        debugParams: customError.toHash()
      });
    }

    if (oThis.sessionKeyAddress) {
      await new NonceForSession({
        address: oThis.sessionKeyAddress,
        chainId: oThis.auxChainId
      }).clear();
    }
  }

  /**
   * Create a RabbitMQ instance
   *
   * @return {Promise<void>}
   * @private
   */
  async _setRmqInstance() {
    const oThis = this;
    oThis.rmqInstance = await rabbitmqProvider.getInstance(rabbitmqConstant.auxRabbitmqKind, {
      connectionWaitSeconds: connectionTimeoutConst.crons,
      switchConnectionWaitSeconds: connectionTimeoutConst.switchConnectionCrons,
      auxChainId: oThis.auxChainId
    });
  }

  /**
   * Create auxiliary web3 instance
   *
   * @return {Promise<void>}
   * @private
   */
  async _setWeb3Instance() {
    const oThis = this;
    oThis.web3Instance = await web3Provider.getInstance(oThis._configStrategyObject.auxChainWsProvider).web3WsProvider;
  }

  /**
   * Get Token Rule Details from cache
   *
   * @return {Promise<never>}
   * @private
   */
  async _getRulesDetails() {
    const oThis = this;

    let tokenRuleDetailsCacheRsp = await new TokenRuleDetailsByTokenId({ tokenId: oThis.tokenId }).fetch();

    if (tokenRuleDetailsCacheRsp.isFailure() || !tokenRuleDetailsCacheRsp.data) {
      return Promise.reject(tokenRuleDetailsCacheRsp);
    }

    oThis.tokenRuleAddress = tokenRuleDetailsCacheRsp.data[ruleConstants.tokenRuleName].address;
    oThis.pricerRuleAddress = tokenRuleDetailsCacheRsp.data[ruleConstants.pricerRuleName].address;
    return tokenRuleDetailsCacheRsp.data;
  }

  /**
   * Fetch token addresses from cache
   *
   * @private
   */
  async _setTokenAddresses() {
    const oThis = this;

    let getAddrRsp = await new TokenAddressCache({
      tokenId: oThis.tokenId
    }).fetch();

    if (getAddrRsp.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_et_b_2',
          api_error_identifier: 'something_went_wrong'
        })
      );
    }

    oThis.tokenAddresses = getAddrRsp.data;
    oThis.erc20Address = oThis.tokenAddresses[tokenAddressConstants.utilityBrandedTokenContract];
  }

  /**
   *
   * @param {string} code
   * @param {array} paramErrors
   * @param {object} debugOptions
   *
   * @return {Promise}
   */
  _validationError(code, paramErrors, debugOptions) {
    const oThis = this;
    return Promise.reject(
      responseHelper.paramValidationError({
        internal_error_identifier: code,
        api_error_identifier: 'invalid_params',
        params_error_identifiers: paramErrors,
        debug_options: debugOptions
      })
    );
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

  /**
   * set call prefix
   * @private
   */
  async _setCallPrefix() {
    const oThis = this,
      tokenHolderHelper = new TokenHolderHelper(oThis.web3Instance, oThis.tokenHolderAddress);

    oThis.callPrefix = tokenHolderHelper.getTokenHolderExecuteRuleCallPrefix();
  }

  /**
   * set executable tx data
   * @private
   */
  async _setExecutableTxData() {
    const oThis = this;

    oThis.executableTxData = {
      from: oThis.web3Instance.utils.toChecksumAddress(oThis.tokenHolderAddress), // TH proxy address
      to: oThis.web3Instance.utils.toChecksumAddress(oThis.toAddress), // rule contract address (TR / Pricer)
      data: oThis.transferExecutableData,
      nonce: oThis.sessionKeyNonce,
      callPrefix: oThis.callPrefix
    };
  }

  get auxChainId() {
    const oThis = this;
    return oThis._configStrategyObject.auxChainId;
  }

  async _setTokenHolderAddress() {
    throw 'subclass to implement';
  }

  /**
   *
   * @private
   */
  async _setSessionAddress() {
    throw 'subclass to implement';
  }

  /**
   *
   * @private
   */
  async _setNonce() {
    throw 'subclass to implement';
  }

  async _setSignature() {
    throw 'subclass to implement';
  }

  async _validateAndSanitize() {
    throw 'subclass to implement';
  }

  async _verifySessionSpendingLimit() {
    throw 'subclass to implement';
  }
}

module.exports = ExecuteTxBase;
