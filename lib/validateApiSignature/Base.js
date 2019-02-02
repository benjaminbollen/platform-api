'use strict';

/*
  * Validate signature of Api request
  *
  * * Author: Puneet
  * * Date: 21/02/2019
  * * Reviewed by:
*/

const queryString = require('query-string');

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  CommonValidators = require(rootPrefix + '/lib/validators/Common'),
  environmentInfo = require(rootPrefix + '/lib/globalConstant/environmentInfo'),
  apiVersions = require(rootPrefix + '/lib/globalConstant/apiVersions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

class Base {
  /**
   * Constructor
   *
   * @param {Object} params
   * @param {Object} params.inputParams - Params sent in API call
   * @param {String} params.requestPath - path of the url called
   *
   * @constructor
   */
  constructor(params) {
    const oThis = this;

    oThis.inputParams = params.inputParams;
    oThis.reqPath = params.requestPath;

    oThis.currentTimestamp = null;
  }

  /**
   *
   * @return {Promise}
   */
  perform() {
    const oThis = this;

    return oThis._asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return Promise.resolve(
          responseHelper.error({
            internal_error_identifier: 'l_vas_b_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: { error: error.toString() }
          })
        );
      }
    });
  }

  /***
   * Perform validation
   *
   * @return {Promise}
   * @private
   */
  async _asyncPerform() {
    const oThis = this;

    await oThis._validateParams();

    await oThis._validateRequestTime();

    return oThis._validateSignature();
  }

  /**
   * Validate presence of Mandatory params
   *
   * @return {Promise}
   */
  async _validateParams() {
    const oThis = this,
      paramErrors = [];

    if (oThis.inputParams['signature_kind'] !== oThis._signatureKind) {
      paramErrors.push('invalid_signature_kind');
    }

    if (!CommonValidators.validateTimestamp(oThis.inputParams['request_timestamp'])) {
      paramErrors.push('invalid_request_timestamp');
    }

    if (!CommonValidators.validateApiRequestPath(oThis.reqPath)) {
      paramErrors.push('invalid_request_path');
    }

    if (paramErrors.length > 0) {
      return oThis._validationError('l_vas_b_1', paramErrors);
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }

  /**
   * Validate Request Time
   *
   * @return {*}
   */
  _validateRequestTime() {
    const oThis = this;

    let currentTime = Math.floor(new Date().getTime() / 1000);

    // API signature is valid for 10 seconds
    if (currentTime > parseInt(oThis.inputParams['request_timestamp']) + 10) {
      return oThis._validationError('l_vas_b_2', ['expired_request_timestamp']);
    }

    return Promise.resolve(responseHelper.successWithData());
  }

  /**
   *
   * @param {string} code
   * @param {array} paramErrors
   *
   * @return {Promise}
   */
  _validationError(code, paramErrors) {
    const oThis = this;
    return Promise.reject(
      responseHelper.error({
        internal_error_identifier: code,
        api_error_identifier: 'invalid_params',
        params_error_identifiers: paramErrors,
        error_config: errorConfig,
        debug_options: {
          inputParams: oThis.inputParams
        }
      })
    );
  }

  /**
   *
   * @return {number}
   * @private
   */
  _currentTimeStamp() {
    const oThis = this;
    if (oThis.currentTimestamp) return oThis.currentTimestamp;
    oThis.currentTimestamp = Math.floor(new Date().getTime() / 1000);
    return oThis.currentTimestamp;
  }

  /**
   *
   * Generate String to Sign
   *
   * @return {string}
   * @private
   */
  get _stringToSign() {
    const oThis = this;

    delete oThis.inputParams.signature;

    let queryParamsString = queryString.stringify(oThis.inputParams, { arrayFormat: 'bracket' }).replace(/%20/g, '+');

    // remove version prefix & sub-env specific prefix from URL
    let regexExpressionStr = `\/${environmentInfo.urlPrefix}\/v[0-9.]*`,
      regexExpressionObj = new RegExp(regexExpressionStr);

    return oThis.reqPath.replace(regexExpressionObj, '') + '?' + queryParamsString;
  }

  get _signatureKind() {
    throw 'sub class to implement';
  }
}

module.exports = Base;