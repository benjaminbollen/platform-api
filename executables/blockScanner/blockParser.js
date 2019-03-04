'use strict';

/**
 * This code acts as a master process to block scanner, which delegates the transactions from a block to
 * Transaction parser processes.
 *
 * Usage: node executables/blockScanner/blockParser.js cronProcessId
 *
 * Command Line Parameters Description:
 * cronProcessId: used for ensuring that no other process with the same cronProcessId can run on a given machine.
 *
 * @module executables/blockScanner/blockParser
 */
const program = require('commander');

const rootPrefix = '../..',
  PublisherBase = require(rootPrefix + '/executables/rabbitmq/PublisherBase'),
  StrategyByChainHelper = require(rootPrefix + '/helpers/configStrategy/ByChainId'),
  BlockParserPendingTask = require(rootPrefix + '/app/models/mysql/BlockParserPendingTask'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  web3InteractFactory = require(rootPrefix + '/lib/providers/web3'),
  rabbitmqProvider = require(rootPrefix + '/lib/providers/rabbitmq'),
  rabbitmqConstant = require(rootPrefix + '/lib/globalConstant/rabbitmq'),
  blockScannerProvider = require(rootPrefix + '/lib/providers/blockScanner'),
  cronProcessesConstants = require(rootPrefix + '/lib/globalConstant/cronProcesses'),
  configStrategyConstants = require(rootPrefix + '/lib/globalConstant/configStrategy'),
  connectionTimeoutConst = require(rootPrefix + '/lib/globalConstant/connectionTimeout');

program.option('--cronProcessId <cronProcessId>', 'Cron table process ID').parse(process.argv);

program.on('--help', function() {
  logger.log('');
  logger.log('  Example:');
  logger.log('');
  logger.log('    node executables/blockScanner/blockParser.js --cronProcessId 1');
  logger.log('');
  logger.log('');
});

if (!program.cronProcessId) {
  program.help();
  process.exit(1);
}

const FAILURE_CODE = -1,
  MAX_TXS_PER_WORKER = 60,
  MIN_TXS_PER_WORKER = 10;

/**
 * Class for Block parser
 *
 * @class
 */
class BlockParserExecutable extends PublisherBase {
  /**
   * Constructor for transaction parser
   *
   * @param {Object} params
   * @param {Number} params.cronProcessId: cron_processes table id
   *
   * @constructor
   */
  constructor(params) {
    super(params);

    const oThis = this;

    oThis.canExit = true; // Denotes whether process can exit or not.
  }

  /**
   * Start cron related processing
   *
   * @return {Promise<void>}
   * @private
   */
  async _start() {
    const oThis = this;

    // Validate whether chainId exists in the chains table.
    await oThis._validateChainId();

    // Warm up web3 pool.
    await oThis.warmUpWeb3Pool();

    // Parse blocks.
    await oThis.parseBlocks();
  }

  /**
   * Sanitizes and validates the input parameters. ChainId is not validated here as it is already validated
   * before calling the perform method of the class.
   *
   * @private
   */
  _specificValidations() {
    const oThis = this;

    // Validate startBlockNumber.
    if (oThis.startBlockNumber === null || oThis.startBlockNumber === undefined) {
      logger.warn('startBlockNumber is unavailable. Block parser would select highest block available in the DB.');
    }
    if (oThis.startBlockNumber && oThis.startBlockNumber < -1) {
      logger.error('Invalid startBlockNumber. Exiting the cron.');
      process.emit('SIGINT');
    }

    // Validate endBlockNumber.
    if (oThis.endBlockNumber === null || oThis.endBlockNumber === undefined) {
      logger.warn('endBlockNumber is unavailable. Block parser would not stop automatically.');
    }
    if (oThis.endBlockNumber && oThis.endBlockNumber < -1) {
      logger.error('Invalid endBlockNumber. Exiting the cron.');
      process.emit('SIGINT');
    }

    // Validate intentionalBlockDelay
    if (oThis.intentionalBlockDelay < 0) {
      logger.error('Invalid intentionalBlockDelay. Exiting the cron.');
      process.emit('SIGINT');
    }

    logger.step('All validations done.');
  }

  /**
   * This method validates whether the chainId passed actually exists in the chains
   * table in DynamoDB or not. This method internally initialises certain services
   * sets some variables as well.
   *
   * @private
   *
   * @returns {Promise<void>}
   */
  async _validateChainId() {
    const oThis = this;

    // Fetch config strategy for chain id
    const strategyByChainHelperObj = new StrategyByChainHelper(oThis.chainId),
      configStrategyResp = await strategyByChainHelperObj.getComplete();

    // If config strategy not found, then emit SIGINT
    if (configStrategyResp.isFailure()) {
      logger.error('Could not fetch configStrategy. Exiting the process.');
      process.emit('SIGINT');
    }
    const configStrategy = configStrategyResp.data;

    // Check if it is origin chain
    oThis.isOriginChain = configStrategy[configStrategyConstants.originGeth].chainId == oThis.chainId;

    // Fetching wsProviders for warmUpWeb3Pool method.
    oThis.wsProviders = oThis.isOriginChain
      ? configStrategy.originGeth.readOnly.wsProviders
      : configStrategy.auxGeth.readOnly.wsProviders;

    oThis.blockGenerationTime = oThis.isOriginChain
      ? configStrategy.originGeth.blockGenerationTime
      : configStrategy.auxGeth.blockGenerationTime;

    // Get blockScanner object.
    const blockScannerObj = await blockScannerProvider.getInstance([oThis.chainId]);

    // Get ChainModel.
    const ChainModel = blockScannerObj.model.Chain,
      chainExists = await new ChainModel({}).checkIfChainIdExists(oThis.chainId);

    if (!chainExists) {
      logger.error('ChainId does not exist in the chains table.');
      process.emit('SIGINT');
    }

    // Initialize certain variables.
    oThis._init(blockScannerObj);

    logger.step('ChainID exists in chains table in dynamoDB.');
  }

  /**
   * Warm up web3 pool.
   *
   * @returns {Promise<void>}
   */
  async warmUpWeb3Pool() {
    const oThis = this;

    let web3PoolSize = coreConstants.OST_WEB3_POOL_SIZE;

    for (let index = 0; index < oThis.wsProviders.length; index++) {
      let provider = oThis.wsProviders[index];
      for (let i = 0; i < web3PoolSize; i++) {
        web3InteractFactory.getInstance(provider);
      }
    }

    logger.step('Web3 pool warmed up.');
  }

  /**
   * Initializes block parser service and blockToProcess.
   *
   * @param {Object} blockScannerObj
   *
   * @private
   */
  _init(blockScannerObj) {
    const oThis = this;

    // Initialize BlockParser.
    oThis.BlockParserExecutable = blockScannerObj.block.Parser;
    oThis.PendingTransactionModel = blockScannerObj.model.PendingTransaction;

    // Initialize blockToProcess.
    if (oThis.startBlockNumber >= 0) {
      oThis.blockToProcess = oThis.startBlockNumber;
    } else {
      oThis.blockToProcess = null;
    }

    logger.step('Services initialised.');
  }

  /**
   * This method parses the blocks.
   *
   * @returns {Promise<void>}
   */
  async parseBlocks() {
    const oThis = this;

    while (true) {
      if ((oThis.endBlockNumber >= 0 && oThis.blockToProcess > oThis.endBlockNumber) || oThis.stopPickingUpNewWork) {
        oThis.canExit = true;
        break;
      }
      oThis.canExit = false;

      let blockParser, blockParserResponse;

      // If blockToProcess is null, don't pass that.
      if (oThis.blockToProcess === null) {
        blockParser = new oThis.BlockParserExecutable(oThis.chainId, {
          blockDelay: oThis.intentionalBlockDelay
        });
        blockParserResponse = await blockParser.perform();
      } else {
        blockParser = new oThis.BlockParserExecutable(oThis.chainId, {
          blockDelay: oThis.intentionalBlockDelay,
          blockToProcess: oThis.blockToProcess
        });
        blockParserResponse = await blockParser.perform();
      }

      if (blockParserResponse.isSuccess()) {
        // Load the obtained block level data into variables
        let blockParserData = blockParserResponse.data,
          rawCurrentBlock = blockParserData.rawCurrentBlock || {},
          nodesWithBlock = blockParserData.nodesWithBlock,
          currentBlock = blockParserData.currentBlock,
          nextBlockToProcess = blockParserData.nextBlockToProcess,
          transactions = rawCurrentBlock.transactions || [];

        // If current block is not same as nextBlockToProcess, it means there
        // are more blocks to process; so sleep time is less.
        if (currentBlock && currentBlock !== nextBlockToProcess) {
          // If the block contains transactions, distribute those transactions.
          if (transactions.length > 0) {
            await oThis._distributeTransactions(rawCurrentBlock, nodesWithBlock);
          }
          logger.step('Current Processed block: ', currentBlock, 'with Tx Count: ', transactions.length);
          await oThis.sleep(10);
        } else {
          await oThis.sleep(oThis.blockGenerationTime * 1000);
        }

        oThis.blockToProcess = nextBlockToProcess;
      } else {
        // If blockParser returns an error then sleep for 10 ms and try again.
        await oThis.sleep(10);
      }

      oThis.canExit = true;
    }
  }

  /**
   * This method distributes the transactions to transaction parser workers.
   *
   * @param {Object} rawCurrentBlock
   * @param {Array} nodesWithBlock
   *
   * @returns {Promise<number>}
   */
  async _distributeTransactions(rawCurrentBlock, nodesWithBlock) {
    const oThis = this;

    let blockHash = rawCurrentBlock.hash,
      blockNumber = rawCurrentBlock.number,
      transactionsInCurrentBlock = await oThis._intersectPendingTransactions(rawCurrentBlock.transactions),
      totalTransactionCount = transactionsInCurrentBlock.length,
      perBatchCount = totalTransactionCount / nodesWithBlock.length,
      offset = 0;

    // Capping the per batch count both sides.
    perBatchCount = perBatchCount > MAX_TXS_PER_WORKER ? MAX_TXS_PER_WORKER : perBatchCount;
    perBatchCount = perBatchCount < MIN_TXS_PER_WORKER ? MIN_TXS_PER_WORKER : perBatchCount;

    let noOfBatches = parseInt(totalTransactionCount / perBatchCount);
    noOfBatches += totalTransactionCount % perBatchCount ? 1 : 0;

    logger.log('====Batch count', noOfBatches, '====Txs per batch', perBatchCount);

    let loopCount = 0;

    while (loopCount < noOfBatches) {
      let batchedTxHashes = transactionsInCurrentBlock.slice(offset, offset + perBatchCount);

      offset = offset + perBatchCount;

      if (batchedTxHashes.length === 0) break;

      let blockParserTaskObj = new BlockParserPendingTask(),
        insertedRecord = await blockParserTaskObj.insertTask(oThis.chainId, blockNumber, batchedTxHashes);

      let messageParams = {
        topics: oThis._topicsToPublish,
        publisher: oThis._publisher,
        message: {
          kind: oThis._messageKind,
          payload: {
            chainId: oThis.chainId,
            blockHash: blockHash,
            taskId: insertedRecord.insertId,
            nodes: nodesWithBlock
          }
        }
      };

      // get RMQ instance from instance cache
      let ostNotification = await rabbitmqProvider.getInstance(rabbitmqConstant.globalRabbitmqKind, {
          connectionWaitSeconds: connectionTimeoutConst.crons,
          switchConnectionWaitSeconds: connectionTimeoutConst.switchConnectionCrons
        }),
        setToRMQ = await ostNotification.publishEvent.perform(messageParams);

      // If could not set to RMQ run in async.
      if (setToRMQ.isFailure() || setToRMQ.data.publishedToRmq === 0) {
        logger.error("====Couldn't publish the message to RMQ====");
        return FAILURE_CODE;
      }

      logger.debug('===Published======batchedTxHashes', batchedTxHashes, '====from block: ', blockNumber);
      logger.log('====Published', batchedTxHashes.length, 'transactions', '====from block: ', blockNumber);
      loopCount++;
    }
  }

  /**
   * This method intersect block transactions with Pending transactions for Origin chain.
   *
   * @param {Array} blockTransactions
   *
   * @returns {Promise<Array>}
   */
  async _intersectPendingTransactions(blockTransactions) {
    const oThis = this;

    if (!oThis.isOriginChain) return blockTransactions;

    // In case of origin chain add transactions only if they are present in Pending transactions.
    let pendingTransactionModel = new oThis.PendingTransactionModel({
        chainId: oThis.chainId
      }),
      transactionHashes = blockTransactions,
      intersectData = [];

    while (true) {
      let batchedTransactionHashes = transactionHashes.splice(0, 50);
      if (batchedTransactionHashes.length <= 0) {
        break;
      }
      let pendingTransactionRsp = await pendingTransactionModel.getPendingTransactionsWithHashes(
          oThis.chainId,
          batchedTransactionHashes
        ),
        pendingTransactionsMap = pendingTransactionRsp.data;

      for (let txHash in pendingTransactionsMap) {
        intersectData.push(txHash);
      }
    }

    return intersectData;
  }

  /**
   * topics to publish
   *
   * @return {*[]}
   * @private
   */
  get _topicsToPublish() {
    const oThis = this;

    return ['transaction_parser_' + oThis.chainId];
  }

  /**
   * Publisher
   *
   * @return {string}
   * @private
   */
  get _publisher() {
    return 'OST';
  }

  /**
   * Message Kind
   *
   * @return {string}
   * @private
   */
  get _messageKind() {
    return 'background_job';
  }

  /**
   * Cron Kind
   *
   * @return {string}
   * @private
   */
  get _cronKind() {
    return cronProcessesConstants.blockParser;
  }
}

logger.step('Block parser process started.');

new BlockParserExecutable({ cronProcessId: +program.cronProcessId }).perform();

setInterval(function() {
  logger.info('Ending the process. Sending SIGINT.');
  process.emit('SIGINT');
}, 30 * 60 * 1000);
