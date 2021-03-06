'use strict';

const rootPrefix = '../../../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  workflowStepConstants = require(rootPrefix + '/lib/globalConstant/workflowStep');

class TestWorkflowStepS1 {
  constructor() {}

  async perform(stepDetails) {
    console.log('working into S1');
    await basicHelper.sleep(1000);
    console.log('Completed S1');

    return responseHelper.successWithData({
      taskStatus: workflowStepConstants.taskDone,
      taskResponseData: { testRespHash: 'hdjskal123zxfnm 1' }
    });
  }
}

module.exports = TestWorkflowStepS1;
