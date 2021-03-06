const express = require('express'),
  router = express.Router();

const rootPrefix = '../..',
  WebhookFormatter = require(rootPrefix + '/lib/formatter/entity/Webhook'),
  WebhookListMetaFormatter = require(rootPrefix + '/lib/formatter/meta/WebhookList'),
  routeHelper = require(rootPrefix + '/routes/helper'),
  sanitizer = require(rootPrefix + '/helpers/sanitizer'),
  apiName = require(rootPrefix + '/lib/globalConstant/apiName'),
  resultType = require(rootPrefix + '/lib/globalConstant/resultType');

// Following require(s) for registering into instance composer.
require(rootPrefix + '/app/services/webhooks/modify/Create');
require(rootPrefix + '/app/services/webhooks/modify/Update');
require(rootPrefix + '/app/services/webhooks/Get');
require(rootPrefix + '/app/services/webhooks/GetAll');
require(rootPrefix + '/app/services/webhooks/Delete');

/* Create webhook */
router.post('/', sanitizer.sanitizeDynamicUrlParams, function(req, res, next) {
  req.decodedParams.apiName = apiName.createWebhook;
  req.decodedParams.clientConfigStrategyRequired = true;

  const dataFormatterFunc = async function(serviceResponse) {
    const webhookFormattedRsp = await new WebhookFormatter(serviceResponse.data[resultType.webhook]).perform();
    serviceResponse.data = {
      result_type: resultType.webhook,
      [resultType.webhook]: webhookFormattedRsp.data
    };
  };

  Promise.resolve(routeHelper.perform(req, res, next, 'CreateWebhook', 'r_v2_w_1', null, dataFormatterFunc));
});

/* Update webhook */
router.post('/:webhook_id', sanitizer.sanitizeDynamicUrlParams, function(req, res, next) {
  req.decodedParams.apiName = apiName.updateWebhook;
  req.decodedParams.webhook_id = req.params.webhook_id;
  req.decodedParams.clientConfigStrategyRequired = true;

  const dataFormatterFunc = async function(serviceResponse) {
    const webhookFormattedRsp = await new WebhookFormatter(serviceResponse.data[resultType.webhook]).perform();
    serviceResponse.data = {
      result_type: resultType.webhook,
      [resultType.webhook]: webhookFormattedRsp.data
    };
  };

  Promise.resolve(routeHelper.perform(req, res, next, 'UpdateWebhook', 'r_v2_w_2', null, dataFormatterFunc));
});

/* Get webhook */
router.get('/:webhook_id', sanitizer.sanitizeDynamicUrlParams, function(req, res, next) {
  req.decodedParams.apiName = apiName.getWebhook;
  req.decodedParams.webhook_id = req.params.webhook_id;
  req.decodedParams.clientConfigStrategyRequired = true;

  const dataFormatterFunc = async function(serviceResponse) {
    const webhookFormattedRsp = await new WebhookFormatter(serviceResponse.data[resultType.webhook]).perform();
    serviceResponse.data = {
      result_type: resultType.webhook,
      [resultType.webhook]: webhookFormattedRsp.data
    };
  };

  Promise.resolve(routeHelper.perform(req, res, next, 'GetWebhook', 'r_v2_w_3', null, dataFormatterFunc));
});

/* Delete a webhook */
router.delete('/:webhook_id', sanitizer.sanitizeDynamicUrlParams, function(req, res, next) {
  req.decodedParams.apiName = apiName.deleteWebhook;
  req.decodedParams.clientConfigStrategyRequired = true;
  req.decodedParams.webhook_id = req.params.webhook_id;

  const dataFormatterFunc = async function(serviceResponse) {
    const webhookFormattedRsp = await new WebhookFormatter(serviceResponse.data[resultType.webhook]).perform();
    serviceResponse.data = {
      result_type: resultType.webhook,
      [resultType.webhook]: webhookFormattedRsp.data
    };
  };

  Promise.resolve(routeHelper.perform(req, res, next, 'DeleteWebhook', 'r_v2_w_4', null, dataFormatterFunc));
});

/* Get all webhooks */
router.get('/', sanitizer.sanitizeDynamicUrlParams, function(req, res, next) {
  req.decodedParams.apiName = apiName.getAllWebhook;
  req.decodedParams.clientConfigStrategyRequired = true;

  const dataFormatterFunc = async function(serviceResponse) {
    const webhooks = serviceResponse.data[resultType.webhooks],
      formattedWebhooks = [],
      metaPayload = await new WebhookListMetaFormatter(serviceResponse.data).perform().data;

    for (let index in webhooks) {
      formattedWebhooks.push(await new WebhookFormatter(webhooks[index]).perform().data);
    }

    serviceResponse.data = {
      result_type: resultType.webhooks,
      [resultType.webhooks]: formattedWebhooks,
      [resultType.meta]: metaPayload
    };
  };

  Promise.resolve(routeHelper.perform(req, res, next, 'GetAllWebhook', 'r_v2_w_5', null, dataFormatterFunc));
});

module.exports = router;
