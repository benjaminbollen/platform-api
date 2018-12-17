'use strict';
/**
 * Model to get cron process and its details.
 *
 * @module /app/models/mysql/cronProcesses
 */
const rootPrefix = '../../..',
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/mysql/Base'),
  cronProcessesConstant = require(rootPrefix + '/lib/globalConstant/cronProcesses');

const dbName = 'saas_config_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT;

/**
 * Class for cron process model
 *
 * @class
 */
class CronProcessesModel extends ModelBaseKlass{
  /**
   * Constructor for cron process model
   *
   * @constructor
   */
  constructor() {
    super({ dbName: dbName });
    
    const oThis = this;
    
    oThis.tableName = 'cron_processes';
  }
  
  /**
   *
   * @param {Number} id
   * @returns {Promise<>}
   */
  get(id) {
    const oThis = this;

    let response = oThis
      .select(['kind', 'ip_address', 'group_id', 'params', 'status', 'last_start_time', 'last_end_time'])
      .where({ id: id })
      .fire();

    return Promise.resolve(response);
  }

  /**
   * This method inserts an entry in the table.
   *
   * @param {Object} params
   * @param {String} params.kind
   * @param {String} params.ipAddress
   * @param {Number} params.groupId
   * @param {String} params.params
   * @param {String} params.status
   * @param {Number} params.lastStartTime
   * @param {Number} params.lastEndTime
   * @returns {*}
   */
  insertRecord(params) {
    const oThis = this;

    // Perform validations.
    if (
      !params.hasOwnProperty('kind') ||
      !params.hasOwnProperty('ipAddress') ||
      !params.hasOwnProperty('status') ||
      !params.hasOwnProperty('groupId')
    ) {
      throw 'Mandatory parameters are missing.';
    }

    if (typeof params.kind !== 'string' || typeof params.ipAddress !== 'string' || typeof params.status !== 'string') {
      throw TypeError('Insertion parameters are of wrong params types.');
    }
    params.status = cronProcessesConstant.invertedStatuses[params.status];
    params.kind = cronProcessesConstant.invertedKinds[params.kind];

    return oThis.insert(params).fire();
  }

  /**
   * This method updates the last start time and status of an entry.
   *
   * @param {Object} params
   * @param {Number} params.id
   * @param {String} params.kind
   * @param {String} params.newLastStartTime
   * @param {String} params.newStatus
   * @returns {Promise<*>}
   */
  async updateLastStartTimeAndStatus(params) {
    const oThis = this;

    // Perform validations.
    if (
      !params.hasOwnProperty('id') ||
      !params.hasOwnProperty('newLastStartTime') ||
      !params.hasOwnProperty('newStatus') ||
      !params.hasOwnProperty('kind')
    ) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {id, kind, newLastStartTime, newStatus}';
    }

    params.newStatus = cronProcessesConstant.invertedStatuses[params.newStatus];
    params.kind = cronProcessesConstant.invertedKinds[params.kind];

    return oThis
      .update({ last_start_time: params.newLastStartTime, status: params.newStatus })
      .where({ id: params.id })
      .fire();
  }

  /**
   * This method updates the last end time and status of an entry.
   *
   * @param {Object} params
   * @param {Number} params.id
   * @param {Number} params.newLastEndTime
   * @param {String} params.newStatus
   * @returns {Promise<*>}
   */
  async updateLastEndTimeAndStatus(params) {
    const oThis = this;

    // Perform validations.
    if (!params.id || !params.newLastEndTime || !params.newStatus) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {id, new_last_end_time, new_status}';
    }
    params.newStatus = cronProcessesConstant.invertedStatuses[params.newStatus];

    await oThis
      .update({ last_end_time: params.newLastEndTime, status: params.newStatus })
      .where({ id: params.id })
      .fire();
  }
}

module.exports = CronProcessesModel;