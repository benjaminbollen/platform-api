'use strict';

/**
 * This service gets the details of the transactions.
 *
 * @module lib/transactions/GetDetailsFromDDB
 */

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  blockScannerProvider = require(rootPrefix + '/lib/providers/blockScanner'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

class GetTransactionsDetailsFromDDB {
  /**
   * @constructor
   *
   * @param params
   * @param params.chainId {Number} - chainId
   * @param params.transactionHashes {Array} - transactionHashes
   */
  constructor(params) {
    const oThis = this;

    oThis.chainId = params.chainId;
    oThis.transactionHashes = params.transactionHashes;
  }

  /**
   * perform
   * @return {Promise<>}
   */
  perform() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error('lib/transactions/GetDetailsFromDDB::perform::catch');
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'l_t_gtfd_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  }

  /**
   * asyncPerform
   *
   * @return {Promise<any>}
   */
  async asyncPerform() {
    const oThis = this;

    // If chainId is not found
    if (!oThis.chainId) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'l_t_gtfd_2',
          api_error_identifier: 'missing_chain_id',
          debug_options: {}
        })
      );
    }

    // If transaction hashes are not found
    if (!oThis.transactionHashes) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'l_t_gtfd_3',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    return await oThis.getTransactionDetails();
  }

  /**
   * Get Transaction Details
   *
   * @return {Promise<*|result>}
   */
  async getTransactionDetails() {
    const oThis = this;

    let blockScannerObj = await blockScannerProvider.getInstance([oThis.chainId]),
      GetTransaction = blockScannerObj.transaction.Get,
      getTransactionObj = new GetTransaction(oThis.chainId, oThis.transactionHashes),
      getTransactionResponse = await getTransactionObj.perform();

    if (!getTransactionResponse.isSuccess()) {
      logger.error('Unable to fetch txReceipts from DDB.');
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'l_t_gtfd_4',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let txHashToTxReceiptsMap = getTransactionResponse.data;

    return responseHelper.successWithData(txHashToTxReceiptsMap);
  }
}

module.exports = GetTransactionsDetailsFromDDB;