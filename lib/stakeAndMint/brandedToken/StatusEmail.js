/**
 * Module for sending token setup status email.
 *
 * @module lib/stakeAndMint/brandedToken/StatusEmail
 */

const rootPrefix = '../../..',
  TokenByClientIdCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/Token'),
  SendTransactionalMail = require(rootPrefix + '/lib/email/hookCreator/SendTransactionalMail'),
  ClientMileStoneHook = require(rootPrefix + '/lib/email/hookCreator/ClientMileStone'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  workflowStepConstants = require(rootPrefix + '/lib/globalConstant/workflowStep'),
  environmentConstants = require(rootPrefix + '/lib/globalConstant/environmentInfo'),
  pepoCampaignsConstants = require(rootPrefix + '/lib/globalConstant/pepoCampaigns'),
  emailServiceConstants = require(rootPrefix + '/lib/globalConstant/emailServiceApiCallHooks');

/**
 * Class for sending token setup status email.
 *
 * @class SendStakeAndMintStatusEmail
 */
class SendStakeAndMintStatusEmail {
  /**
   * Constructor for sending token setup status email.
   *
   * @param {object} params
   * @param {number} params.clientId
   * @param {boolean} params.setupStatus
   *
   * @constructor
   */
  constructor(params) {
    const oThis = this;

    oThis.clientId = params.clientId;
    oThis.setupStatus = params.setupStatus;
  }

  /**
   * Main performer for class.
   *
   * @return {Promise<never>}
   */
  async perform() {
    const oThis = this;

    const tokenCache = new TokenByClientIdCache({
      clientId: oThis.clientId
    });

    const response = await tokenCache.fetch();
    if (!response.data) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_s_e_sse_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: {
            clientId: oThis.clientId
          }
        })
      );
    }

    const templateName =
      oThis.setupStatus === 1
        ? pepoCampaignsConstants.platformStakeAndMintStatusSuccessTemplate
        : pepoCampaignsConstants.platformStakeAndMintStatusFailedTemplate;

    await new SendTransactionalMail({
      receiverEntityId: oThis.clientId,
      receiverEntityKind: emailServiceConstants.clientReceiverEntityKind,
      templateName: templateName,
      templateVars: {
        subject_prefix: basicHelper.isSandboxSubEnvironment() ? 'OST Platform Sandbox' : 'OST Platform',
        url_prefix: environmentConstants.urlPrefix,
        [pepoCampaignsConstants.tokenName]: response.data.name,
        token_id: response.data.id
      }
    }).perform();

    await oThis._createUpdateContactHook();

    return responseHelper.successWithData({
      taskStatus: workflowStepConstants.taskDone
    });
  }

  /**
   * Create update contact hook.
   *
   * @return {Promise<void>}
   * @private
   */
  async _createUpdateContactHook() {
    const oThis = this;

    const clientMileStoneHook = new ClientMileStoneHook({
      receiverEntityId: oThis.clientId,
      receiverEntityKind: emailServiceConstants.clientReceiverEntityKind,
      mileStone: pepoCampaignsConstants.stakeAndMintAttribute
    });

    await clientMileStoneHook.perform();
  }
}

module.exports = SendStakeAndMintStatusEmail;
