'use strict';
/**
 * Fetch OST Current price in given currency from coin market cap and set in price oracle.
 *
 * @module app/services/conversionRates/UpdatePricePoints
 */

const requestPromise = require('request-promise'),
  OpenStOracle = require('@ostdotcom/ost-price-oracle'),
  PriceOracleHelper = OpenStOracle.PriceOracleHelper,
  exchangeUrl = 'https://api.coinmarketcap.com/v1/ticker/simple-token';

const rootPrefix = '../../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  web3Provider = require(rootPrefix + '/lib/providers/web3'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  contractConstants = require(rootPrefix + '/lib/globalConstant/contract'),
  chainConfigProvider = require(rootPrefix + '/lib/providers/chainConfig'),
  ChainAddressModel = require(rootPrefix + '/app/models/mysql/ChainAddress'),
  chainAddressConst = require(rootPrefix + '/lib/globalConstant/chainAddress'),
  SubmitTransaction = require(rootPrefix + '/lib/transactions/SignSubmitTrxOnChain'),
  conversionRateConstants = require(rootPrefix + '/lib/globalConstant/conversionRates'),
  OstPricePointsCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/OstPricePoint'),
  CurrencyConversionRateModel = require(rootPrefix + '/app/models/mysql/CurrencyConversionRate');

/**
 * Class to update price points in currency conversion table.
 *
 * @class
 */
class UpdatePricePoints {
  /**
   * Fetch OST Current price
   *
   * @param {Object} params
   * @param {String/Number} params.auxChainId
   * @param {String} params.quoteCurrency: Currency to fetch price in. eg: (USD or EUR)
   *
   * @constructor
   */
  constructor(params) {
    const oThis = this;

    oThis.auxChainId = params.auxChainId;
    oThis.quoteCurrency = params.quoteCurrency || conversionRateConstants.USD;

    oThis.currentTime = Math.floor(new Date().getTime() / 1000);
    oThis.currentOstValue = null;
    oThis.maxRetryCountForVerifyPriceInContract = 100;
  }

  /**
   * Main performer.
   *
   * @return {Promise<>}
   */
  perform() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error('app/services/conversionRates/UpdatePricePoints.js::perform::catch');
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'a_s_cr_upp_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  }

  /**
   * Async perform.
   *
   * @return {Promise<>}
   */
  async asyncPerform() {
    const oThis = this;

    // Parse CoinMarketCap API response
    await oThis._fetchPriceFromAPI();

    // Insert current ost value in database
    let insertResponse = await new CurrencyConversionRateModel()
      .insert({
        chain_id: oThis.auxChainId,
        base_currency: conversionRateConstants.invertedBaseCurrencies[oThis.currentOstValue.baseCurrency],
        quote_currency: conversionRateConstants.invertedQuoteCurrencies[oThis.currentOstValue.quoteCurrency],
        conversion_rate: oThis.currentOstValue.conversionRate,
        timestamp: oThis.currentOstValue.timestamp,
        status: conversionRateConstants.invertedStatuses[oThis.currentOstValue.status]
      })
      .fire();

    if (!insertResponse) {
      logger.error('Error while inserting data in table');
      return Promise.reject();
    }

    oThis.dbRowId = insertResponse.insertId;

    // Fetch all relevant addresses.
    await oThis._fetchAddress();

    // Create web3Instance.
    await oThis._setWeb3Instance();

    // Set current price in contract
    let contractResponse = await oThis._setPriceInContract();
    if (contractResponse.isFailure()) {
      logger.notify('a_s_cr_upp_2', 'Error while setting price in contract.', contractResponse);
      return;
    }

    let transactionHash = contractResponse.data.transactionHash;

    // Update transaction hash
    let updateTransactionResponse = await new CurrencyConversionRateModel().updateTransactionHash(
      oThis.dbRowId,
      transactionHash
    );
    if (!updateTransactionResponse) {
      logger.error('Error while updating transactionHash in table.');
      return Promise.reject();
    }

    // Keep on checking for a price in contract whether its set to new value.
    await oThis._compareContractPrice();

    return Promise.resolve();
  }

  /**
   * Parse Response from coinmarketcap
   *
   * Sets currentOstValue
   */
  async _fetchPriceFromAPI() {
    const oThis = this;
    let url = exchangeUrl + '?convert=' + oThis.quoteCurrency;

    // Make CoinMarketCap API call.
    let response = await requestPromise(url);

    try {
      let ostValue = JSON.parse(response)[0];
      logger.debug('OST Value From CoinMarketCap:', ostValue);
      if (!ostValue || ostValue.symbol !== conversionRateConstants.OST) {
        logger.notify('a_s_cr_upp_3', 'Invalid OST Value', response);

        return;
      }
      let pricePoint = ostValue['price_' + oThis.quoteCurrency.toLowerCase()];
      if (!pricePoint || pricePoint < 0) {
        logger.notify('a_s_cr_upp_4', 'Invalid OST Price', response);

        return;
      }

      oThis.currentOstValue = {
        baseCurrency: conversionRateConstants.OST,
        quoteCurrency: oThis.quoteCurrency,
        conversionRate: pricePoint,
        timestamp: oThis.currentTime,
        status: conversionRateConstants.inProcess
      };
    } catch (err) {
      logger.notify('a_s_cr_upp_5', 'Invalid Response from CoinMarket', response);
    }
  }

  /**
   * Fetch admin/ops address.
   *
   * @return {Promise<void>}
   *
   * @private
   */
  async _fetchAddress() {
    const oThis = this,
      fetchAddressRsp = await new ChainAddressModel().fetchAddresses({
        chainId: oThis.auxChainId,
        kinds: [chainAddressConst.priceOracleOpsAddressKind, chainAddressConst.priceOracleContractKind]
      });

    if (fetchAddressRsp.isSuccess()) {
      oThis.priceOracleOpsAddress = fetchAddressRsp.data.address[chainAddressConst.priceOracleOpsAddressKind];
      oThis.contractAddress = fetchAddressRsp.data.address[chainAddressConst.priceOracleContractKind];
    }
  }

  /**
   * Set web3 instance.
   *
   * @return {Promise<void>}
   *
   * @private
   */
  async _setWeb3Instance() {
    const oThis = this;

    let response = await chainConfigProvider.getFor([oThis.auxChainId]),
      auxChainConfig = response[oThis.auxChainId];

    oThis.wsProvider = auxChainConfig.auxGeth.readWrite.wsProviders[0];
    oThis.web3Instance = web3Provider.getInstance(oThis.wsProvider).web3WsProvider;
  }

  /**
   * Set current price in Price oracle contract
   *
   * @return {Promise<Result>}
   */
  async _setPriceInContract() {
    const oThis = this;

    logger.debug('Price Input for contract:' + oThis.currentOstValue.conversionRate);
    logger.debug('Quote Currency for contract:' + oThis.quoteCurrency);

    let priceResponse = basicHelper.convertToWei(oThis.currentOstValue.conversionRate),
      amountInWei = priceResponse.toString(10);

    logger.debug('Price Point in Wei for contract:' + amountInWei);

    oThis.auxGasPrice = contractConstants.auxChainGasPrice;
    oThis.gas = '50000';

    // Get transaction object.
    let txResponse = new PriceOracleHelper(oThis.web3Instance).setPriceTx(
      oThis.web3Instance,
      conversionRateConstants.OST,
      oThis.quoteCurrency,
      oThis.contractAddress,
      amountInWei,
      oThis.auxGasPrice
    );

    // Prepare params for transaction.
    const encodedABI = txResponse.encodedABI,
      txParams = {
        from: oThis.priceOracleOpsAddress,
        to: oThis.contractAddress,
        value: coreConstants.zeroValue,
        data: encodedABI,
        gas: oThis.gas,
        gasPrice: oThis.auxGasPrice
      };

    // Submit transaction.
    let submitTransactionResponse = await new SubmitTransaction({
      chainId: oThis.auxChainId,
      txOptions: txParams,
      provider: oThis.wsProvider,
      waitTillReceipt: 1
    }).perform();

    if (submitTransactionResponse && submitTransactionResponse.isFailure()) {
      return Promise.reject(submitTransactionResponse);
    }

    // Fetch required attributes.
    const transactionHash = submitTransactionResponse.data.transactionHash,
      transactionReceipt = submitTransactionResponse.data.transactionReceipt;

    logger.win('\t Transaction hash: ', transactionHash);
    logger.win('\t Transaction receipt: ', transactionReceipt);

    return Promise.resolve(responseHelper.successWithData({ transactionHash: transactionHash }));
  }

  /**
   * Compare contract price.
   *
   * @return {Promise<>}
   *
   * @private
   */
  _compareContractPrice() {
    const oThis = this;

    let chainId = oThis.auxChainId,
      dbRowId = oThis.dbRowId,
      conversionRate = oThis.currentOstValue.conversionRate,
      attemptCountForVerifyPriceInContract = 1;

    return new Promise(function(onResolve, onReject) {
      let loopCompareContractPrice = async function() {
        if (attemptCountForVerifyPriceInContract > oThis.maxRetryCountForVerifyPriceInContract) {
          logger.notify('a_s_cr_upp_6', 'Something Is Wrong', {
            dbRowId: dbRowId
          });
          return onReject(`dbRowId: ${dbRowId} maxRetryCountForVerifyPriceInContract reached`);
        }

        let priceInDecimal = await new PriceOracleHelper().decimalPrice(oThis.web3Instance, oThis.contractAddress);

        if (priceInDecimal.isFailure()) {
          logger.notify('a_s_cr_upp_7', 'Error while getting price from contract.', priceInDecimal);
          return onResolve('error');
        } else if (priceInDecimal.isSuccess() && priceInDecimal.data.price == conversionRate) {
          let queryResp = await new CurrencyConversionRateModel().updateStatus(dbRowId, conversionRateConstants.active);
          if (!queryResp) {
            return onResolve('Failed to update status.');
          }

          logger.win('Price point updated in contract.');

          let clearCacheResponse = new OstPricePointsCache({ chainId: chainId }).clear();
          if (!clearCacheResponse) {
            return onResolve('Failed to clear cache.');
          }

          return onResolve('success');
        } else {
          logger.step(
            `dbRowId: ${dbRowId} attemptNo: ${attemptCountForVerifyPriceInContract} price received from contract: ${
              priceInDecimal.data.price
            } but expected was: ${conversionRate}. Waiting for it to match.`
          );

          attemptCountForVerifyPriceInContract += attemptCountForVerifyPriceInContract;

          return setTimeout(loopCompareContractPrice, 10000);
        }
      };
      loopCompareContractPrice();
    });
  }
}

module.exports = UpdatePricePoints;
