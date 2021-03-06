/**
 * Module to fund granter address with eth, ost and stable coin.
 *
 * @module lib/setup/originChain/FundGranterAddress
 */

const rootPrefix = '../../..',
  TransferEthUsingPK = require(rootPrefix + '/lib/fund/eth/TransferUsingPK'),
  TransferERC20UsingPK = require(rootPrefix + '/lib/fund/erc20/TransferUsingPK'),
  ConfigStrategyHelper = require(rootPrefix + '/helpers/configStrategy/ByChainId'),
  ChainAddressCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/ChainAddress'),
  StakeCurrencyBySymbolCache = require(rootPrefix + '/lib/cacheManagement/kitSaasMulti/StakeCurrencyBySymbol'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  chainAddressConstants = require(rootPrefix + '/lib/globalConstant/chainAddress'),
  configStrategyConstants = require(rootPrefix + '/lib/globalConstant/configStrategy');

/**
 * Class to fund granter address with eth, ost and stable coin.
 *
 * @class FundGranterAddress
 */
class FundGranterAddress {
  /**
   * Constructor to fund granter address with eth / ost / stable coin.
   *
   * @param {string} ethOwnerPrivateKey
   * @param {string} ethAmount
   * @param {string} stakeCurrencySymbol
   * @param {string} stakeCurrencyOwnerPrivateKey
   * @param {string} stakeCurrencyAmount
   *
   * @constructor
   */
  constructor(ethOwnerPrivateKey, ethAmount, stakeCurrencySymbol, stakeCurrencyOwnerPrivateKey, stakeCurrencyAmount) {
    const oThis = this;

    oThis.ethOwnerPrivateKey = ethOwnerPrivateKey;
    oThis.ethAmount = ethAmount;

    oThis.stakeCurrencySymbol = stakeCurrencySymbol;
    oThis.stakeCurrencyOwnerPrivateKey = stakeCurrencyOwnerPrivateKey;
    oThis.stakeCurrencyAmount = stakeCurrencyAmount;
  }

  /**
   * Perform.
   *
   * @return {Promise<result>}
   */
  perform() {
    const oThis = this;

    return oThis._asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      }
      logger.error('lib/setup/originChain/FundGranterAddress.js::perform::catch');
      logger.error(error);

      return responseHelper.error({
        internal_error_identifier: 'l_s_oc_fga_1',
        api_error_identifier: 'unhandled_catch_response',
        debug_options: {}
      });
    });
  }

  /**
   * Async perform.
   *
   * @return {Promise<result>}
   * @private
   */
  async _asyncPerform() {
    const oThis = this;

    if (basicHelper.isMainSubEnvironment()) {
      logger.info('Grants are not allowed in main sub env.');

      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_s_oc_fga_2',
          api_error_identifier: 'something_went_wrong',
          debug_options: ''
        })
      );
    }

    await oThis._getGranterAddress();
    logger.info('originGranterAddress -> ', oThis.originGranterAddress);

    if (oThis.ethOwnerPrivateKey && oThis.ethAmount) {
      logger.step(`* Chain Owner funding granter address with ${oThis.ethAmount} ETH.`);
      await oThis._fundGranterAddressWithEth(); // From master internal funder.
    }

    if (oThis.stakeCurrencySymbol && oThis.stakeCurrencyAmount && oThis.stakeCurrencyOwnerPrivateKey) {
      logger.step(
        `* Stake Currency Owner funding granter address with ${oThis.stakeCurrencyAmount} ${oThis.stakeCurrencySymbol}.`
      );
      await oThis._fundGranterAddressWithStakeCurrency();
    }

    return responseHelper.successWithData({});
  }

  /**
   * Fetch granter address.
   *
   * @sets oThis.originGranterAddress
   *
   * @return {Promise<void>}
   * @private
   */
  async _getGranterAddress() {
    const oThis = this;

    // Fetch all addresses associated with origin chain id.
    const chainAddressCacheObj = new ChainAddressCache({ associatedAuxChainId: 0 }),
      chainAddressesRsp = await chainAddressCacheObj.fetch();

    if (chainAddressesRsp.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_s_oc_fga_3',
          api_error_identifier: 'something_went_wrong'
        })
      );
    }

    oThis.originGranterAddress = chainAddressesRsp.data[chainAddressConstants.originGranterKind].address;
  }

  /**
   * Fund address with eth.
   *
   * @return {Promise<void>}
   * @private
   */
  async _fundGranterAddressWithEth() {
    const oThis = this;

    const providers = await oThis._getProvidersFromConfig(),
      provider = providers[0], // Select one provider from provider endpoints array.
      amountInWei = basicHelper.convertToLowerUnit(String(oThis.ethAmount), coreConstants.ETH_DECIMALS).toString(10); // Transfer amount.

    await new TransferEthUsingPK({
      toAddress: oThis.originGranterAddress,
      fromAddressPrivateKey: oThis.ethOwnerPrivateKey,
      amountInWei: amountInWei,
      originChainId: oThis.chainId,
      provider: provider
    }).perform();
  }

  /**
   * Fund address with ost.
   *
   * @return {Promise<void>}
   * @private
   */
  async _fundGranterAddressWithStakeCurrency() {
    const oThis = this;

    let stakeCurrencyBySymbolCache = new StakeCurrencyBySymbolCache({
      stakeCurrencySymbols: [oThis.stakeCurrencySymbol]
    });

    let response = await stakeCurrencyBySymbolCache.fetch(),
      decimals = response.data[oThis.stakeCurrencySymbol].decimal;

    const providers = await oThis._getProvidersFromConfig(),
      provider = providers[0], // Select one provider from provider endpoints array
      amountInWei = basicHelper.convertToLowerUnit(String(oThis.stakeCurrencyAmount), decimals).toString(10); // Transfer amount

    await new TransferERC20UsingPK({
      toAddress: oThis.originGranterAddress,
      fromAddressPrivateKey: oThis.stakeCurrencyOwnerPrivateKey,
      amountInWei: amountInWei,
      originChainId: oThis.chainId,
      provider: provider,
      tokenSymbol: oThis.stakeCurrencySymbol
    }).perform();
  }

  /**
   * Get providers from config.
   *
   * @sets oThis.chainId
   *
   * @return {Promise<void>}
   * @private
   */
  async _getProvidersFromConfig() {
    const oThis = this;

    const csHelper = new ConfigStrategyHelper(0),
      csResponse = await csHelper.getForKind(configStrategyConstants.originGeth),
      configForChain = csResponse.data[configStrategyConstants.originGeth],
      readWriteConfig = configForChain[configStrategyConstants.gethReadWrite],
      providers = readWriteConfig.wsProvider ? readWriteConfig.wsProviders : readWriteConfig.rpcProviders;

    oThis.chainId = configForChain.chainId;

    return providers;
  }
}

module.exports = FundGranterAddress;
