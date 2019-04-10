/**
 * Deploy simpleToken
 *
 * @module tools/chainSetup/origin/simpleToken/Deploy
 */

const OSTBase = require('@ostdotcom/base'),
  InstanceComposer = OSTBase.InstanceComposer;

const rootPrefix = '../../../..',
  CoreAbis = require(rootPrefix + '/config/CoreAbis'),
  CoreBins = require(rootPrefix + '/config/CoreBins'),
  DeployerKlass = require(rootPrefix + '/tools/helpers/Deploy'),
  ChainAddressModel = require(rootPrefix + '/app/models/mysql/ChainAddress'),
  UpdateStakeCurrenciesTable = require(rootPrefix + '/lib/UpdateStakeCurrenciesTable'),
  ChainAddressCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/ChainAddress'),
  SetupSimpleTokenBase = require(rootPrefix + '/tools/chainSetup/origin/simpleToken/Base'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  contractConstants = require(rootPrefix + '/lib/globalConstant/contract'),
  chainAddressConstants = require(rootPrefix + '/lib/globalConstant/chainAddress'),
  chainSetupConstants = require(rootPrefix + '/lib/globalConstant/chainSetupLogs');

/**
 * Class to deploy simple token.
 *
 * @class DeploySimpleToken
 */
class DeploySimpleToken extends SetupSimpleTokenBase {
  /**
   * Constructor to deploy simple token.
   *
   * @param {object} params
   * @param {string} params.signerAddress: address who signs Tx
   * @param {string} params.signerKey: private key of signerAddress
   *
   * @augments SetupSimpleTokenBase
   *
   * @constructor
   */
  constructor(params) {
    super(params);
  }

  /**
   * AsyncPerform
   *
   * @ignore
   * @return {Promise}
   */
  async asyncPerform() {
    const oThis = this;

    await oThis.setGasPrice();

    oThis.addKeyToWallet();

    const deployerResponse = await oThis._deployContract();

    oThis.removeKeyFromWallet();

    await oThis._insertIntoChainSetupLogs(chainSetupConstants.deployBaseContractStepKind, deployerResponse);

    await oThis._insertIntoChainAddress(deployerResponse);

    return deployerResponse;
  }

  /**
   * Deploy contract
   *
   * @return {Promise<*>}
   * @private
   */
  async _deployContract() {
    const oThis = this;

    const nonceRsp = await oThis.fetchNonce(oThis.signerAddress);

    const deployParams = {
      deployerAddr: oThis.signerAddress,
      gasPrice: oThis.gasPrice,
      gas: contractConstants.deploySimpleTokenGas,
      web3Provider: oThis.web3Instance,
      contractBin: CoreBins.simpleToken,
      contractAbi: CoreAbis.simpleToken,
      nonce: nonceRsp.data.nonce
    };

    const deployerObj = new DeployerKlass(deployParams),
      deployerResponse = await deployerObj.perform().catch(function(errorResponse) {
        logger.error(errorResponse);

        return errorResponse;
      });

    deployerResponse.debugOptions = {
      inputParams: {
        signerAddress: oThis.signerAddress
      },
      processedParams: {}
    };

    return deployerResponse;
  }

  /**
   * Insert simple token contract address into chain address.
   *
   * @param {object} deployerResponse
   *
   * @return {Promise<*>}
   * @private
   */
  async _insertIntoChainAddress(deployerResponse) {
    const oThis = this;

    if (deployerResponse.isFailure()) {
      return deployerResponse;
    }

    await new ChainAddressModel().insertAddress({
      address: deployerResponse.data.contractAddress,
      associatedAuxChainId: 0,
      addressKind: chainAddressConstants.stContractKind,
      deployedChainId: oThis.configStrategyObject.originChainId,
      deployedChainKind: coreConstants.originChainKind,
      status: chainAddressConstants.activeStatus
    });

    // Clear chain address cache.
    await new ChainAddressCache({ associatedAuxChainId: 0 }).clear();
  }
}

InstanceComposer.registerAsShadowableClass(DeploySimpleToken, coreConstants.icNameSpace, 'DeploySimpleToken');

module.exports = DeploySimpleToken;
