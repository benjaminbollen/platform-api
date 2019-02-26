'use strict';
/**
 * Branded token mint router
 *
 * @module lib/workflow/stakeAndMint/brandedToken/Router
 */
const rootPrefix = '../../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  util = require(rootPrefix + '/lib/util'),
  workflowConstants = require(rootPrefix + '/lib/globalConstant/workflow'),
  WorkflowRouterBase = require(rootPrefix + '/lib/workflow/RouterBase'),
  workflowStepConstants = require(rootPrefix + '/lib/globalConstant/workflowStep'),
  btStakeAndMintStepsConfig = require(rootPrefix + '/lib/workflow/stakeAndMint/brandedToken/stepsConfig'),
  FetchStakeRequestHash = require(rootPrefix + '/lib/stakeAndMint/brandedToken/FetchStakeRequestHash'),
  RecordStakerTx = require(rootPrefix + '/lib/stakeAndMint/brandedToken/RecordStakerTx'),
  AcceptStakeByWorker = require(rootPrefix + '/lib/stakeAndMint/brandedToken/AcceptStakeRequest'),
  CheckMintStatus = require(rootPrefix + '/lib/stakeAndMint/brandedToken/CheckMintStatus'),
  CommitStateRoot = require(rootPrefix + '/lib/stateRootSync/CommitStateRoot'),
  UpdateStateRootCommits = require(rootPrefix + '/lib/stateRootSync/UpdateStateRootCommits'),
  ProgressStake = require(rootPrefix + '/lib/stakeAndMint/brandedToken/ProgressStake'),
  ProgressMint = require(rootPrefix + '/lib/stakeAndMint/brandedToken/ProgressMint'),
  ProveGateway = require(rootPrefix + '/lib/stakeAndMint/brandedToken/ProveGateway'),
  ConfirmStakeIntent = require(rootPrefix + '/lib/stakeAndMint/brandedToken/ConfirmStakeIntent'),
  FetchStakeIntentMessage = require(rootPrefix + '/lib/stakeAndMint/common/FetchStakeIntentMessageHash'),
  chainAddressConstants = require(rootPrefix + '/lib/globalConstant/chainAddress'),
  ChainAddressCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/ChainAddress'),
  CheckGatewayComposerAllowance = require(rootPrefix + '/lib/stakeAndMint/brandedToken/CheckGatewayComposerAllowance');

/**
 * Class for branded token mint router
 *
 * @class
 */
class BtStakeAndMintRouter extends WorkflowRouterBase {
  /**
   * Constructor for branded token mint router
   *
   * @params {Object} params
   * @params {String} params.workflowKind
   *
   * @augments WorkflowRouterBase
   *
   * @constructor
   */
  constructor(params) {
    params['workflowKind'] = workflowConstants.btStakeAndMintKind; // Assign workflowKind.

    super(params);

    const oThis = this;
    oThis.isRetrialAttempt = params.isRetrialAttempt || 0;
  }

  /**
   * Fetch current step config for every router.
   *
   * @private
   */
  _fetchCurrentStepConfig() {
    const oThis = this;

    oThis.currentStepConfig = btStakeAndMintStepsConfig[oThis.stepKind];
  }

  /**
   * Perform step.
   *
   * @return {Promise<*>}
   *
   * @private
   */
  async _performStep() {
    const oThis = this;

    switch (oThis.stepKind) {
      case workflowStepConstants.btStakeAndMintInit:
        return oThis._initializeBTStakeMint();

      case workflowStepConstants.approveGatewayComposerTrx:
        oThis.requestParams.transactionHash = oThis.requestParams.approveTransactionHash;
        return new RecordStakerTx(oThis.requestParams).perform(oThis._currentStepPayloadForPendingTrx());

      case workflowStepConstants.checkGatewayComposerAllowance:
        return new CheckGatewayComposerAllowance(oThis.requestParams).perform();

      case workflowStepConstants.recordRequestStakeTx:
        oThis.requestParams.transactionHash = oThis.requestParams.requestStakeTransactionHash;
        return new RecordStakerTx(oThis.requestParams).perform(oThis._currentStepPayloadForPendingTrx());

      case workflowStepConstants.fetchStakeRequestHash:
        return new FetchStakeRequestHash(oThis.requestParams).perform();

      case workflowStepConstants.acceptStake:
        return new AcceptStakeByWorker(oThis.requestParams).perform(oThis._currentStepPayloadForPendingTrx());

      case workflowStepConstants.checkStakeStatus:
      case workflowStepConstants.checkProveGatewayStatus:
      case workflowStepConstants.checkConfirmStakeStatus:
      case workflowStepConstants.checkProgressStakeStatus:
      case workflowStepConstants.checkProgressMintStatus:
        let stepParams = {};
        Object.assign(stepParams, oThis.requestParams, { currentStep: oThis.stepKind });
        return new CheckMintStatus(stepParams).perform();

      case workflowStepConstants.fetchStakeIntentMessageHash:
        return new FetchStakeIntentMessage(oThis.requestParams).perform();

      case workflowStepConstants.commitStateRoot:
        if (oThis.isRetrialAttempt) {
          Object.assign(oThis.requestParams, { isRetrialAttempt: oThis.isRetrialAttempt });
        }
        return new CommitStateRoot(oThis.requestParams).perform(oThis._currentStepPayloadForPendingTrx());

      // Update status in state root commit history
      case workflowStepConstants.updateCommittedStateRootInfo:
        return new UpdateStateRootCommits(oThis.requestParams).perform();

      case workflowStepConstants.proveGatewayOnCoGateway:
        Object.assign(oThis.requestParams, { currentWorkflowId: oThis.workflowId });
        return new ProveGateway(oThis.requestParams).perform(oThis._currentStepPayloadForPendingTrx());

      case workflowStepConstants.confirmStakeIntent:
        return new ConfirmStakeIntent(oThis.requestParams).perform(oThis._currentStepPayloadForPendingTrx());

      case workflowStepConstants.progressStake:
        return new ProgressStake(oThis.requestParams).perform(oThis._currentStepPayloadForPendingTrx());

      case workflowStepConstants.progressMint:
        return new ProgressMint(oThis.requestParams).perform(oThis._currentStepPayloadForPendingTrx());

      case workflowStepConstants.markSuccess:
        logger.step('*** Mark branded token stake and mint as success');
        return oThis.handleSuccess();

      case workflowStepConstants.markFailure:
        logger.step('*** Mark branded token stake and mint as failed');
        return oThis.handleFailure();

      default:
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'e_wr_snm_btr_1',
            api_error_identifier: 'something_went_wrong',
            debug_options: { parentStepId: oThis.parentStepId }
          })
        );
    }
  }

  /**
   * Get next step configs.
   *
   * @param nextStep
   *
   * @return {*}
   */
  getNextStepConfigs(nextStep) {
    return btStakeAndMintStepsConfig[nextStep];
  }

  /**
   * SHA Hash to uniquely identify workflow, to avoid same commits
   *
   * @returns {String}
   *
   * @private
   */
  _uniqueWorkflowHash() {
    const oThis = this;

    let uniqueStr = oThis.chainId + '_';
    uniqueStr += oThis.requestParams.approveTransactionHash + '_';
    uniqueStr += oThis.requestParams.requestStakeTransactionHash;

    return util.createSha256Digest(uniqueStr);
  }

  /**
   * Initialize stake and mint BT
   *
   * @returns {String}
   *
   * @private
   */
  async _initializeBTStakeMint() {
    const oThis = this;

    // Fetch all addresses associated to auxChainId.
    let chainAddressCacheObj = new ChainAddressCache({ associatedAuxChainId: oThis.requestParams.auxChainId }),
      chainAddressesRsp = await chainAddressCacheObj.fetch();

    if (chainAddressesRsp.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'e_wr_snm_btr_2',
          api_error_identifier: 'something_went_wrong'
        })
      );
    }

    Object.assign(oThis.requestParams, {
      facilitator: chainAddressesRsp.data[chainAddressConstants.interChainFacilitatorKind].address
    });

    return oThis.insertInitStep();
  }
}

module.exports = BtStakeAndMintRouter;