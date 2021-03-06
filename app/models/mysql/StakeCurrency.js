/**
 * Model for stake currencies table.
 *
 * @module app/models/mysql/StakeCurrency
 */

const rootPrefix = '../../..',
  ModelBase = require(rootPrefix + '/app/models/mysql/Base'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  stakeCurrencyConstants = require(rootPrefix + '/lib/globalConstant/stakeCurrency'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

// Declare variables.
const dbName = 'kit_saas_' + coreConstants.subEnvironment + '_' + coreConstants.environment;

/**
 * Class for stake currencies model.
 *
 * @class StakeCurrency
 */
class StakeCurrency extends ModelBase {
  /**
   * Constructor for stake currencies model.
   *
   * @augments ModelBase
   *
   * @constructor
   */
  constructor() {
    super({ dbName: dbName });

    const oThis = this;

    oThis.tableName = 'stake_currencies';
  }

  /**
   * Format Db data.
   *
   * @param {object} dbRow
   * @param {number} dbRow.id
   * @param {string} dbRow.name
   * @param {string} dbRow.symbol
   * @param {number} dbRow.decimal
   * @param {string} dbRow.contract_address
   * @param {string} dbRow.price_oracle_contract_address
   * @param {string} dbRow.constants
   * @param {string} dbRow.addresses
   * @param {string} dbRow.status
   * @param {string} dbRow.created_at
   * @param {string} dbRow.updated_at
   *
   * @return {object}
   * @private
   */
  static _formatDbData(dbRow) {
    return {
      id: dbRow.id,
      name: dbRow.name,
      symbol: dbRow.symbol,
      decimal: dbRow.decimal,
      contractAddress: dbRow.contract_address,
      constants: JSON.parse(dbRow.constants),
      addresses: JSON.parse(dbRow.addresses),
      status: stakeCurrencyConstants.statuses[dbRow.status],
      createdAt: dbRow.created_at,
      updatedTimestamp: basicHelper.dateToSecondsTimestamp(dbRow.updated_at)
    };
  }

  /**
   * Fetch stake currency details by contract address.
   *
   * @param {string} contractAddress
   *
   * @return {Promise<any>}
   */
  async fetchStakeCurrencyByContractAddress(contractAddress) {
    const oThis = this;

    const dbRow = await oThis
      .select('*')
      .where({ contract_address: contractAddress })
      .fire();

    if (dbRow.length === 0) {
      return Promise.reject(new Error(`No entry found for contractAddress: ${contractAddress}.`));
    }

    return responseHelper.successWithData(StakeCurrency._formatDbData(dbRow[0]));
  }

  /**
   * Fetch stake currency details by stakeCurrencyIds.
   *
   * @param {array<string/number>} stakeCurrencyIds
   *
   * @return {Promise<any>}
   */
  async fetchStakeCurrenciesByIds(stakeCurrencyIds) {
    const oThis = this,
      response = {};

    const dbRows = await oThis
      .select('*')
      .where([' id IN (?)', stakeCurrencyIds])
      .fire();

    if (dbRows.length === 0) {
      return Promise.reject(new Error(`No entries found for stakeCurrencyIds: ${stakeCurrencyIds}.`));
    }

    for (let index = 0; index < dbRows.length; index++) {
      response[dbRows[index].id] = StakeCurrency._formatDbData(dbRows[index]);
    }

    return responseHelper.successWithData(response);
  }

  /**
   * Fetch stake currency details by stakeCurrencySymbols.
   *
   * @param {array<string>} stakeCurrencySymbols
   *
   * @return {Promise<*>}
   */
  async fetchStakeCurrenciesBySymbols(stakeCurrencySymbols) {
    const oThis = this,
      response = {};

    const dbRows = await oThis
      .select('*')
      .where([' symbol IN (?)', stakeCurrencySymbols])
      .fire();

    if (dbRows.length === 0) {
      return Promise.reject(new Error(`No entries found for stakeCurrencySymbols: ${stakeCurrencySymbols}.`));
    }

    for (let index = 0; index < dbRows.length; index++) {
      response[dbRows[index].symbol] = StakeCurrency._formatDbData(dbRows[index]);
    }

    return responseHelper.successWithData(response);
  }
}

module.exports = StakeCurrency;
