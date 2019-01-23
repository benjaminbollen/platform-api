'use strict';

const signature = {
  verifySigner: {
    mandatory: [
      {
        parameter: 'client_id',
        validatorMethod: 'validateInteger'
      },
      {
        parameter: 'signer',
        validatorMethod: 'validateEthAddress'
      },
      {
        parameter: 'personal_sign',
        validatorMethod: 'validatePersonalSign'
      },
      {
        parameter: 'message_to_sign',
        validatorMethod: 'validateAlphaNumericString'
      }
    ],
    optional: []
  },
  gatewayComposer: {
    mandatory: [
      {
        parameter: 'token_id',
        validatorMethod: 'validateInteger'
      },
      {
        parameter: 'staker_address',
        validatorMethod: 'validateEthAddress'
      }
    ],
    optional: []
  },
  tokenDeployment: {
    mandatory: [
      {
        parameter: 'token_id',
        validatorMethod: 'validateInteger'
      },
      {
        parameter: 'client_id',
        validatorMethod: 'validateInteger'
      }
    ],
    optional: []
  }
};

module.exports = signature;
