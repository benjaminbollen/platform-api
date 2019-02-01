'use strict';
/**
 * Cron to fund eth by chainOwner.
 *
 * @module executables/funding/byChainOwner/originChainSpecific
 *
 * This cron expects originChainId as a parameter in the params.
 */
const program = require('commander');

const rootPrefix = '../../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  TransferEth = require(rootPrefix + '/lib/transfer/Eth'),
  CronBase = require(rootPrefix + '/executables/CronBase'),
  GetEthBalance = require(rootPrefix + '/lib/getBalance/Eth'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  chainAddressConstants = require(rootPrefix + '/lib/globalConstant/chainAddress'),
  cronProcessesConstants = require(rootPrefix + '/lib/globalConstant/cronProcesses'),
  environmentInfoConstants = require(rootPrefix + '/lib/globalConstant/environmentInfo'),
  ChainAddressCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/ChainAddress');

program.option('--cronProcessId <cronProcessId>', 'Cron table process ID').parse(process.argv);

program.on('--help', function() {
  logger.log('');
  logger.log('  Example:');
  logger.log('');
  logger.log('    node executables/funding/byChainOwner/originChainSpecific --cronProcessId 9');
  logger.log('');
  logger.log('');
});

if (!program.cronProcessId) {
  program.help();
  process.exit(1);
}

// Declare variables.
const flowsForMinimumBalance = basicHelper.convertToBigNumber(coreConstants.FLOWS_FOR_MINIMUM_BALANCE),
  flowsForTransferBalance = basicHelper.convertToBigNumber(coreConstants.FLOWS_FOR_TRANSFER_BALANCE),
  flowsForGranterMinimumBalance = basicHelper.convertToBigNumber(coreConstants.FLOWS_FOR_GRANTER_ECONOMY_SETUP),
  flowsForChainOwnerMinimumBalance = basicHelper.convertToBigNumber(coreConstants.FLOWS_FOR_CHAIN_OWNER_ECONOMY_SETUP);

// Config for addresses which need to be funded.
const fundingConfig = {
  [chainAddressConstants.originDeployerKind]: '0.53591',
  [chainAddressConstants.stOrgContractOwnerKind]: '0.00355',
  [chainAddressConstants.stOrgContractAdminKind]: '0.00000',
  [chainAddressConstants.originDefaultBTOrgContractAdminKind]: '0.00240',
  [chainAddressConstants.originDefaultBTOrgContractWorkerKind]: '0.00172',
  [chainAddressConstants.stContractOwnerKind]: '0.03141',
  [chainAddressConstants.stContractAdminKind]: '0.00071',
  [chainAddressConstants.masterInternalFunderKind]: '0.01160',
  [chainAddressConstants.originGranterKind]: '0.00000'
};

/**
 * Class to fund eth by chain owner.
 *
 * @class
 */
class FundByChainOwnerOriginChainSpecific extends CronBase {
  /**
   * Constructor to fund eth by chain owner.
   *
   * @constructor
   */
  constructor(params) {
    super(params);

    const oThis = this;

    oThis.canExit = true;
  }

  /**
   * Cron kind
   *
   * @return {String}
   *
   * @private
   */
  get _cronKind() {
    return cronProcessesConstants.fundByChainOwnerOriginChainSpecific;
  }

  /**
   * Validate and sanitize
   *
   * @return {Promise<never>}
   *
   * @private
   */
  async _validateAndSanitize() {
    const oThis = this;

    if (!oThis.originChainId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'e_f_bco_ocs_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: { originChainId: oThis.originChainId }
        })
      );
    }
  }

  /**
   * Pending tasks done
   *
   * @return {Boolean}
   *
   * @private
   */
  _pendingTasksDone() {
    const oThis = this;

    return oThis.canExit;
  }

  /**
   * Start the cron.
   *
   * @return {Promise<void>}
   *
   * @private
   */
  async _start() {
    const oThis = this;

    logger.step('Fetching addresses which need to be funded.');
    await oThis._fetchAddresses();

    logger.step('Fetching balances of addresses.');
    await oThis._fetchBalances();

    logger.step('Checking if addresses are eligible for transfer.');
    await oThis._checkIfEligibleForTransfer();

    logger.step('Transferring amount.');
    await oThis._transfer();

    logger.step('Cron completed.');
  }

  /**
   * Fetch addresses which need to be funded.
   *
   * @return {Promise<never>}
   *
   * @private
   */
  async _fetchAddresses() {
    const oThis = this;

    // Fetch all addresses associated with origin chain id.
    let chainAddressCacheObj = new ChainAddressCache({ associatedAuxChainId: 0 }),
      chainAddressesRsp = await chainAddressCacheObj.fetch();

    if (chainAddressesRsp.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'e_f_bco_ocs_2',
          api_error_identifier: 'something_went_wrong'
        })
      );
    }

    oThis.masterInternalFunderAddress = chainAddressesRsp.data[chainAddressConstants.masterInternalFunderKind].address;

    const originDeployerAddress = chainAddressesRsp.data[chainAddressConstants.originDeployerKind].address,
      stOrgContractOwnerAddress = chainAddressesRsp.data[chainAddressConstants.stOrgContractOwnerKind].address,
      stOrgContractAdminAddress = chainAddressesRsp.data[chainAddressConstants.stOrgContractAdminKind].address,
      originDefaultBTOrgContractAdminAddress =
        chainAddressesRsp.data[chainAddressConstants.originDefaultBTOrgContractAdminKind].address,
      originDefaultBTOrgContractWorkerAddress =
        chainAddressesRsp.data[chainAddressConstants.originDefaultBTOrgContractWorkerKind].address;

    // Addresses whose balances need to be fetched.
    oThis.addresses = [
      oThis.masterInternalFunderAddress,
      originDeployerAddress,
      stOrgContractOwnerAddress,
      stOrgContractAdminAddress,
      originDefaultBTOrgContractAdminAddress,
      originDefaultBTOrgContractWorkerAddress
    ];

    // Add addresses mapped to their kind.
    oThis.kindToAddressMap = {
      [chainAddressConstants.originDeployerKind]: originDeployerAddress,
      [chainAddressConstants.stOrgContractOwnerKind]: stOrgContractOwnerAddress,
      [chainAddressConstants.stOrgContractAdminKind]: stOrgContractAdminAddress,
      [chainAddressConstants.originDefaultBTOrgContractAdminKind]: originDefaultBTOrgContractAdminAddress,
      [chainAddressConstants.originDefaultBTOrgContractWorkerKind]: originDefaultBTOrgContractWorkerAddress,
      [chainAddressConstants.masterInternalFunderKind]: oThis.masterInternalFunderAddress
    };

    // If environment is not production and subEnvironment is main, then fetch two more addresses.
    if (
      coreConstants.environment !== environmentInfoConstants.environment.production &&
      coreConstants.subEnvironment === environmentInfoConstants.subEnvironment.main
    ) {
      // Fetch addresses.
      oThis.granterAddress = chainAddressesRsp.data[chainAddressConstants.originGranterKind].address;
      const stContractOwnerAddress = chainAddressesRsp.data[chainAddressConstants.stContractOwnerKind].address,
        stContractAdminAddress = chainAddressesRsp.data[chainAddressConstants.stContractAdminKind].address;

      // Add addresses to the array of addresses whose balance is to be fetched.
      oThis.addresses.push.apply(oThis.addresses, [
        oThis.granterAddress,
        stContractOwnerAddress,
        stContractAdminAddress
      ]);

      // Add addresses mapped to their kind.
      oThis.kindToAddressMap[[chainAddressConstants.originGranterKind]] = oThis.granterAddress;
      oThis.kindToAddressMap[[chainAddressConstants.stContractOwnerKind]] = stContractOwnerAddress;
      oThis.kindToAddressMap[[chainAddressConstants.stContractAdminKind]] = stContractAdminAddress;
    }
  }

  /**
   * Fetch balances for all the addresses.
   *
   * @return {Promise<void>}
   *
   * @private
   */
  async _fetchBalances() {
    const oThis = this;

    // Fetch eth balances
    const getEthBalance = new GetEthBalance({
      originChainId: oThis.originChainId,
      addresses: oThis.addresses
    });

    oThis.addressesToBalanceMap = await getEthBalance.perform();
  }

  /**
   * Check which addresses are eligible to get funds and prepare params for transfer.
   *
   * @private
   */
  _checkIfEligibleForTransfer() {
    const oThis = this;

    oThis.transferDetails = [];

    // Loop over oThis.kindToAddressMap.
    for (let addressKind in oThis.kindToAddressMap) {
      let address = oThis.kindToAddressMap[addressKind],
        addressMinimumBalance = basicHelper.convertToBigNumber(fundingConfig[addressKind]),
        addressCurrentBalance = basicHelper.convertToBigNumber(oThis.addressesToBalanceMap[address]);

      // If addressKind is granter or chainOwner and it has less than threshold balance, send an error email.
      if (
        (addressKind === [chainAddressConstants.originGranterKind] &&
          addressCurrentBalance.lt(
            basicHelper.convertToWei(addressMinimumBalance.mul(flowsForGranterMinimumBalance))
          )) ||
        (addressKind === [chainAddressConstants.masterInternalFunderKind] &&
          addressCurrentBalance.lt(
            basicHelper.convertToWei(addressMinimumBalance.mul(flowsForChainOwnerMinimumBalance))
          ))
      ) {
        logger.warn('addressKind ' + addressKind + ' has low balance on chainId: ' + oThis.originChainId);
        logger.notify(
          'e_f_bco_ocs_4',
          'Low balance of addressKind: ' + addressKind + '. on chainId: ',
          +oThis.originChainId
        );
      }

      // If address current balance is less thant the stipulated amount, these addresses need to be funded.
      else if (addressCurrentBalance.lt(basicHelper.convertToWei(addressMinimumBalance.mul(flowsForMinimumBalance)))) {
        let params = {
          from: oThis.masterInternalFunderAddress,
          to: address,
          amountInWei: basicHelper.convertToWei(addressMinimumBalance.mul(flowsForTransferBalance)).toString(10)
        };
        oThis.transferDetails.push(params);
      }
    }
  }

  /**
   * Transfer eth.
   *
   * @return {Promise<void>}
   *
   * @private
   */
  async _transfer() {
    const oThis = this;

    oThis.canExit = false;

    if (oThis.transferDetails.length > 0) {
      const transferEth = new TransferEth({
        originChainId: oThis.originChainId,
        transferDetails: oThis.transferDetails
      });

      await transferEth.perform();
    }
    oThis.canExit = true;
  }
}

logger.log('Starting cron to fund eth by chainOwner.');

new FundByChainOwnerOriginChainSpecific({ cronProcessId: +program.cronProcessId })
  .perform()
  .then(function() {
    process.emit('SIGINT');
  })
  .catch(function() {
    process.emit('SIGINT');
  });
