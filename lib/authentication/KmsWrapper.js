'use strict';

/*
 * Wrapper for AWS KMS
 *
 * @module lib/authentication/KmsWrapper
 *
 * * Author: Pankaj
 * * Date: 16/01/2018
 * * Reviewed by:
 */

require('https').globalAgent.keepAlive = true;

const AWS = require('aws-sdk');

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  kms = require(rootPrefix + '/lib/globalConstant/kms');

AWS.config.httpOptions.keepAlive = true;
AWS.config.httpOptions.disableProgressEvents = false;

/**
 * KMS Wrapper to use for encryption and decryption.
 *
 * @Constructor
 * @param purpose - this is the purpose for accessing the KMS service
 */
const KmsWrapper = function(purpose) {
  const oThis = this;

  oThis.purpose = purpose;
};

const _private = {
  // Load AWS credentials
  loadAWSCredentials: function() {
    return {
      accessKeyId: coreConstants.KMS_AWS_ACCESS_KEY,
      secretAccessKey: coreConstants.KMS_AWS_SECRET_KEY,
      region: coreConstants.KMS_AWS_REGION
    };
  },

  // Get Key for different purposes
  getKey: function(purpose) {
    if (purpose === kms.clientValidationPurpose) {
      return coreConstants.KMS_API_KEY_ID;
    } else if (purpose === kms.managedAddressPurpose) {
      return coreConstants.KMS_KNOWN_ADDR_KEY_ID;
    } else if (purpose === kms.configStrategyPurpose) {
      return coreConstants.KMS_CONFIG_STRATEGY_KEY_ID;
    } else if (purpose === kms.userScryptSaltPurpose) {
      return coreConstants.KMS_KNOWN_ADDR_KEY_ID;
    } else {
      throw `unsupported purpose: ${purpose}`;
    }
  }
};

KmsWrapper.prototype = {
  /**
   * Encrypt data using KMS key
   *
   * @param {String} data - Data to encrypt
   * @return {Promise<any>}
   *
   * @response {CiphertextBlob: Encrypted Blob}
   */
  encrypt: function(data) {
    const oThis = this;

    var kms = new AWS.KMS(_private.loadAWSCredentials());
    var params = {
      KeyId: _private.getKey(oThis.purpose),
      Plaintext: data
    };

    return new Promise(function(onResolve, onReject) {
      kms.encrypt(params, function(err, encryptedData) {
        if (err) {
          onReject(err);
        } else {
          onResolve(encryptedData);
        }
      });
    });
  },

  /**
   * Decrypt Encrypted String using KMS
   *
   * @param {String} encryptedString - Encrypted String to decrypt
   * @return {Promise<any>}
   *
   * @response {Plaintext: Plain text can be used as salt}
   *
   */
  decrypt: function(encryptedString) {
    const oThis = this;

    var kms = new AWS.KMS(_private.loadAWSCredentials());
    var params = {
      CiphertextBlob: encryptedString
    };

    return new Promise(function(onResolve, onReject) {
      kms.decrypt(params, function(err, decryptedData) {
        if (err) {
          onReject(err);
        } else {
          onResolve(decryptedData);
        }
      });
    });
  },

  /**
   * Generate New Data Key for usage as local salt
   *
   * @return {Promise<Object>}
   *
   * @response {CiphertextBlob: Encrypted Blob, Plaintext: Plain text can be used as salt}
   */
  generateDataKey: function() {
    const oThis = this;

    var kms = new AWS.KMS(_private.loadAWSCredentials());
    var params = {
      KeyId: _private.getKey(oThis.purpose),
      KeySpec: 'AES_256'
    };

    return new Promise(function(onResolve, onReject) {
      kms.generateDataKey(params, function(err, response) {
        if (err) {
          onReject(err);
        } else {
          onResolve(response);
        }
      });
    });
  }
};

module.exports = KmsWrapper;
