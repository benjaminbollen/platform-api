'use strict';

const OSTBase = require('@openstfoundation/openst-base');

const rootPrefix = '../..',
  CronBase = require(rootPrefix + '/executables/CronBase'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  sharedRabbitMqProvider = require(rootPrefix + '/lib/providers/sharedNotification'),
  connectionTimeoutConst = require(rootPrefix + '/lib/globalConstant/connectionTimeout');

class SubscriberBase extends CronBase {
  /**
   * Subscriber base constructor
   *
   * @param params {object}
   * @param params.cronProcessId {number}
   */
  constructor(params) {
    super(params);

    const oThis = this;

    oThis.unAckCount = 0;
    oThis.consumerTag = null;
  }

  /**
   * start the actual functionality of the cron
   *
   * @returns {Promise<void>}
   * @private
   */
  async _start() {
    const oThis = this;

    await oThis._beforeSubscribe();

    // Initialize certain variables.
    await oThis._startSubscription();
  }

  _validateAndSanitize() {
    const oThis = this;

    if (!oThis.prefetchCount) {
      logger.error('Prefetch count un-available in cron params in the database.');
      process.emit('SIGINT');
    }

    if (oThis.prefetchCount < 0) {
      logger.error('Prefetch count is invalid.');
      process.emit('SIGINT');
    }

    logger.step('common validations done.');

    oThis._specificValidations();

    logger.step('specific validations done.');
  }

  /**
   * Promise queue manager
   *
   * @returns {OSTBase.OSTPromise.QueueManager}
   */
  get PromiseQueueManager() {
    const oThis = this;

    // trying to ensure that there is only one _PromiseQueueManager;
    if (oThis._PromiseQueueManager) return oThis._PromiseQueueManager;

    oThis._PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(
      function(...args) {
        // Promise executor should be a static method by itself. We declared an unnamed function
        // which was a static method, and promiseExecutor was passed in the same scope as that
        // of the class with oThis preserved.
        oThis._promiseExecutor(...args);
      },
      {
        name: oThis._processNamePrefix + '_promise_queue_manager',
        timeoutInMilliSecs: oThis.timeoutInMilliSecs,
        maxZombieCount: Math.round(oThis.prefetchCount * 0.25),
        onMaxZombieCountReached: oThis.onMaxZombieCountReached
      }
    );

    return oThis._PromiseQueueManager;
  }

  /**
   * Start subscription.
   *
   * @returns {Promise<void>}
   */
  async _startSubscription() {
    const oThis = this;

    const openStNotification = await sharedRabbitMqProvider.getInstance({
      connectionWaitSeconds: connectionTimeoutConst.crons,
      switchConnectionWaitSeconds: connectionTimeoutConst.switchConnectionCrons
    });
    openStNotification.subscribeEvent
      .rabbit(
        oThis._topicsToSubscribe,
        {
          queue: oThis._queueName,
          ackRequired: oThis.ackRequired,
          prefetch: oThis.prefetchCount
        },
        function(params) {
          // Promise is required to be returned to manually ack messages in RMQ
          return oThis.PromiseQueueManager.createPromise(params);
        },
        function(consumerTag) {
          oThis.consumerTag = consumerTag;
        }
      )
      .catch(function(error) {
        logger.error('Error in subscription', error);
        oThis._ostRmqError();
      });
  }

  /**
   * This method executes the promises.
   *
   * @param onResolve
   * @param onReject
   * @param {String} messageParams
   *
   * @returns {*}
   *
   * @private
   */
  _promiseExecutor(onResolve, onReject, messageParams) {
    const oThis = this;

    oThis
      ._processMessage(messageParams)
      .then(function() {
        oThis.unAckCount--;
        onResolve();
      })
      .catch(function(error) {
        oThis.unAckCount--;
        logger.error(
          'e_bs_w_5',
          'Error in token transfer parsing. unAckCount ->',
          oThis.unAckCount,
          'Error: ',
          error,
          'Params: ',
          messageParams
        );
        onResolve();
      });
  }

  _ostRmqError(err) {
    logger.info('ostRmqError occurred.', err);
    process.emit('SIGINT');
  }

  /**
   * This function checks if there are any pending tasks left or not.
   *
   * @returns {Boolean}
   */
  _pendingTasksDone() {
    const oThis = this;

    if (oThis.unAckCount !== oThis.PromiseQueueManager.getPendingCount()) {
      logger.error('ERROR :: unAckCount and pending counts are not in sync.');
    }
    return !oThis.PromiseQueueManager.getPendingCount() && !oThis.unAckCount;
  }

  get timeoutInMilliSecs() {
    return 3 * 60 * 1000; // By default the time out is 3 minutes
  }

  get ackRequired() {
    return 1;
  }

  onMaxZombieCountReached() {
    logger.warn('e_r_sb_1', 'maxZombieCount reached. Triggering SIGTERM.');
    // Trigger gracefully shutdown of process.
    process.kill(process.pid, 'SIGTERM');
  }

  get _topicsToSubscribe() {
    throw 'sub class to implement.';
  }

  get _queueName() {
    throw 'sub class to implement.';
  }

  get _processNamePrefix() {
    throw 'sub class to implement.';
  }

  _specificValidations() {
    throw 'sub class to implement.';
  }

  _processMessage() {
    throw 'sub class to implement.';
  }
}

module.exports = SubscriberBase;