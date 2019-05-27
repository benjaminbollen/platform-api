'use strict';
/**
 * This is model for workflow_setup table.
 *
 * @module app/models/mysql/WebhookEndpoint
 */
const rootPrefix = '../../..',
  ModelBase = require(rootPrefix + '/app/models/mysql/Base'),
  coreConstants = require(rootPrefix + '/config/coreConstants');

// Declare variables.
const dbName = 'kit_saas_' + coreConstants.subEnvironment + '_' + coreConstants.environment,
  statuses = tokenConstants.statuses,
  invertedStatuses = util.invert(statuses);

/**
 * Class for workflow step model
 *
 * @class
 */
class WebhookEndpoint extends ModelBase {
  /**
   * Constructor for workflow step model
   *
   * @constructor
   */
  constructor() {
    super({ dbName: dbName });

    const oThis = this;

    oThis.tableName = 'webhook_endpoints';
  }
}

module.exports = WebhookEndpoint;
