'use strict';

const rootPrefix = '../../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

class commitStateRoot {
  constructor() {}

  async perform(stepDetails) {
    console.log('working into S5');
    await basicHelper.pauseForMilliSeconds(1000);
    console.log('Completed S5');

    return Promise.resolve(
      responseHelper.successWithData({ taskDone: 0, taskResponseData: { testRespHash: 'hdjskal123zxfnm 5' } })
    );
  }
}

module.exports = commitStateRoot;