'use strict';

const rootPrefix = '..',
  configStrategyConstants = require(rootPrefix + '/lib/globalConstant/configStrategy');

let configTemplate = {'entitiesMap': {}, 'rootLevelEntities': {}};

configTemplate['rootLevelEntities'][configStrategyConstants.memcached] = "memcachedEntity";
configTemplate['rootLevelEntities'][configStrategyConstants.nonceMemcached] = "memcachedEntity";
configTemplate['rootLevelEntities'][configStrategyConstants.dynamodb] = "dynamodbEntity";
configTemplate['rootLevelEntities'][configStrategyConstants.inMemoryCache] = "inMemoryCacheEntity";
configTemplate['rootLevelEntities'][configStrategyConstants.originGeth] = "originGethEntity";
configTemplate['rootLevelEntities'][configStrategyConstants.auxGeth] = "auxGethEntity";
configTemplate['rootLevelEntities'][configStrategyConstants.elasticSearch] = "elasticSearchEntity";
configTemplate['rootLevelEntities'][configStrategyConstants.rabbitmq] = "rabbitmqEntity";
configTemplate['rootLevelEntities'][configStrategyConstants.sharedRabbitmq] = "sharedRabbitmqEntity";

configTemplate['entitiesMap'] = {

  memcachedEntity : {
    entityType: 'object',
    entitiesPresent: {
      engine: "engineEntity",
      servers: "serversEntity",
      defaultTtl: "defaultTtlEntity",
      consistentBehavior: "consistentBehaviorEntity"
    }
  },
  engineEntity: {
    entityType: 'string'
  },
  serversEntity: {
    entityType: 'array',
    entitiesPresent: 'serverEntity' //For an array entity this array will contain entity types which that array will hold
  },
  serverEntity: {
    entityType: 'string'
  },
  defaultTtlEntity: {
    entityType: 'number'
  },
  consistentBehaviorEntity: {
    entityType: 'string'
  },
  inMemoryCacheEntity: {
    entityType: 'object',
    entitiesPresent: {
      engine: "engineEntity",
      defaultTtl: "defaultTtlEntity",
      namespace: "namespaceEntity",
      consistentBehavior: "consistentBehaviorEntity"
    }
  },
  namespaceEntity: {
    entityType: 'string'
  },


  dynamodbEntity: {
    entityType: 'object',
    entitiesPresent: {
      endpoint: 'endpointEntity',
      region: 'regionEntity',
      apiKey: 'apiKeyEntity',
      apiSecret: 'apiSecretEntity',
      apiVersion: 'apiVersionEntity',
      enableSsl: 'enableSslEntity',
      tablePrefix: 'tablePrefixEntity',
      enableLogging: 'enableLoggingEntity',
      enableAutoscaling: 'enableAutoscalingEntity',
      maxRetryCount: 'maxRetryCountEntity',
      autoScaling: 'autoScalingEntity'
    }
  },
  endpointEntity: {
    entityType: 'string'
  },
  regionEntity: {
    entityType: 'string'
  },
  apiKeyEntity: {
    entityType: 'string'
  },
  apiSecretEntity: {
    entityType: 'string'
  },
  apiVersionEntity: {
    entityType: 'string'
  },
  enableSslEntity: {
    entityType: 'string'
  },
  tablePrefixEntity: {
    entityType: 'string'
  },
  enableLoggingEntity: {
    entityType: 'string'
  },
  enableAutoscalingEntity: {
    entityType: 'string'
  },
  maxRetryCountEntity: {
    entityType: 'string'
  },
  autoScalingEntity: {
    entityType: 'object',
    entitiesPresent: {
      endpoint: 'endpointEntity',
      region: 'regionEntity',
      apiKey: 'apiKeyEntity',
      apiSecret: 'apiSecretEntity',
      apiVersion: 'apiVersionEntity',
      enableSsl: 'enableSslEntity'
    }
  },

  originGethEntity: {
    entityType: 'object',
    entitiesPresent: {
      rpcProvider: 'rpcProviderEntity',
      rpcProviders: 'rpcProvidersEntity',
      wsProvider: 'wsProviderEntity',
      wsProviders: 'wsProvidersEntity',
      chainId: 'chainIdEntity',
      client: "gethClientEntity"
    }
  },
  rpcProviderEntity: {
    entityType: 'string'
  },
  rpcProvidersEntity: {
    entityType: 'array',
    entitiesPresent: 'rpcProviderEntity'
  },
  wsProviderEntity: {
    entityType: 'string'
  },
  wsProvidersEntity: {
    entityType: 'array',
    entitiesPresent: 'wsProviderEntity'
  },
  chainIdEntity: {
    entityType: 'number'
  },
  gethClientEntity: {
    entityType: 'string'
  },
  auxGethEntity: {
    entityType: 'object',
    entitiesPresent: {
      readOnly: 'auxGethProvidersEntity',
      readWrite: "auxGethProvidersEntity",
      chainId: 'chainIdEntity',
      client: 'gethClientEntity'
    }
  },
  auxGethProvidersEntity: {
    entityType: 'object',
    entitiesPresent: {
      rpcProvider: 'rpcProviderEntity',
      rpcProviders: 'rpcProvidersEntity',
      wsProvider: 'wsProviderEntity',
      wsProviders: 'wsProvidersEntity',
    }
  },

  elasticSearchEntity: {
    entityType: 'object',
    entitiesPresent: {
      host: 'hostEntity',
      accessKey: 'accessKeyEntity',
      region: 'regionEntity',
      secretKey: 'secretKeyEntity'
    }
  },
  hostEntity: {
    entityType: 'string'
  },
  accessKeyEntity: {
    entityType: 'string'
  },
  secretKeyEntity: {
    entityType: 'string'
  },

  sharedRabbitmqEntity: {
    entityType: 'object',
    entitiesPresent: {
      username: 'usernameEntity',
      password: 'passwordEntity',
      host: 'hostEntity',
      port: 'portEntity',
      heartbeats: 'heartbeatsEntity',
      clusterNodes: 'clusterNodesEntity'
    }
  },
  rabbitmqEntity: {
    entityType: 'object',
    entitiesPresent: {
      username: 'usernameEntity',
      password: 'passwordEntity',
      host: 'hostEntity',
      port: 'portEntity',
      heartbeats: 'heartbeatsEntity',
      clusterNodes: 'clusterNodesEntity'
    }
  },
  usernameEntity: {
    entityType: 'string'
  },
  passwordEntity: {
    entityType: 'string'
  },
  portEntity: {
    entityType: 'string'
  },
  heartbeatsEntity: {
    entityType: 'string'
  },
  clusterNodesEntity:{
    entityType: 'array',
    entitiesPresent: 'clusterNodeEntity'
  },
  clusterNodeEntity: {
    entityType: 'string'
  }

};


module.exports = configTemplate;