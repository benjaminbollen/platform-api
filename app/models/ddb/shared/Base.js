'use strict';
/**
 * Base class for shared models
 *
 * @module app/models/ddb/shared/Base
 */
const rootPrefix = '../../../..',
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  BaseModel = require(rootPrefix + '/app/models/ddb/Base'),
  storageConstants = require(rootPrefix + '/lib/globalConstant/storage');

// Following require(s) for registering into instance composer
require(rootPrefix + '/lib/providers/storage');

/**
 * Class for base class of shared models
 *
 * @constructor
 */
class SharedBaseKlass extends BaseModel {
  /**
   * Constructor for Base class for shared models
   *
   * @augments BaseModel
   *
   * @param {Object} params
   * @param {Number} params.consistentRead: (1,0)
   *
   * @constructor
   */
  constructor(params) {
    super(params);

    const oThis = this,
      storageProvider = oThis.ic().getInstanceFor(coreConstants.icNameSpace, 'storageProvider'),
      openSTStorage = storageProvider.getInstance(storageConstants.shared);

    oThis.ddbServiceObj = openSTStorage.dynamoDBService;

    oThis.shardHelper = new openSTStorage.model.ShardHelper({
      table_schema: oThis.tableSchema(),
      shard_name: oThis.tableName()
    });
  }

  /**
   * Create shard
   *
   * @returns {Promise<result>}
   */
  createTable() {
    const oThis = this;

    return oThis.shardHelper.createShard();
  }
}

module.exports = SharedBaseKlass;