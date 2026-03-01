'use strict';

const PLUGIN_NAME = 'serverless-offline-kafka';
const LOG_PREFIX = `[${PLUGIN_NAME}]`;

const DEFAULT_CUSTOM_CONFIG = Object.freeze({
  autoCreateTopics: true,
  ssl: false,
  clientId: PLUGIN_NAME,
  defaultConsumerGroupId: PLUGIN_NAME,
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  batchSize: 1,
  maximumBatchingWindowInSeconds: 0,
});

module.exports = {
  DEFAULT_CUSTOM_CONFIG,
  LOG_PREFIX,
  PLUGIN_NAME,
};
