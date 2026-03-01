'use strict';

const { DEFAULT_CUSTOM_CONFIG } = require('./constants');

function asBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function asPositiveInteger(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function ensureStringList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function normalizeCustomConfig(rawConfig) {
  const raw = rawConfig || {};

  return {
    autoCreateTopics: asBoolean(raw.autoCreateTopics, DEFAULT_CUSTOM_CONFIG.autoCreateTopics),
    ssl: asBoolean(raw.ssl, DEFAULT_CUSTOM_CONFIG.ssl),
    clientId:
      typeof raw.clientId === 'string' && raw.clientId.trim().length > 0
        ? raw.clientId
        : DEFAULT_CUSTOM_CONFIG.clientId,
    defaultConsumerGroupId:
      typeof raw.defaultConsumerGroupId === 'string' && raw.defaultConsumerGroupId.trim().length > 0
        ? raw.defaultConsumerGroupId
        : DEFAULT_CUSTOM_CONFIG.defaultConsumerGroupId,
    sessionTimeout: asPositiveInteger(raw.sessionTimeout, DEFAULT_CUSTOM_CONFIG.sessionTimeout),
    heartbeatInterval: asPositiveInteger(raw.heartbeatInterval, DEFAULT_CUSTOM_CONFIG.heartbeatInterval),
    batchSize: asPositiveInteger(raw.batchSize, DEFAULT_CUSTOM_CONFIG.batchSize),
    maximumBatchingWindowInSeconds: asPositiveInteger(
      raw.maximumBatchingWindowInSeconds,
      DEFAULT_CUSTOM_CONFIG.maximumBatchingWindowInSeconds
    ),
  };
}

function normalizeKafkaEventConfig(functionKey, eventConfig, customConfig) {
  const raw = eventConfig || {};
  const topic = raw.topic || raw.topicName;
  const bootstrapServers = ensureStringList(raw.bootstrapServers || raw.brokers);

  if (raw.enabled === false || raw.enable === false) {
    return null;
  }

  if (typeof topic !== 'string' || topic.trim().length === 0) {
    throw new Error(
      `Invalid kafka event configuration for function "${functionKey}": "topic" (or "topicName") is required.`
    );
  }

  if (bootstrapServers.length === 0) {
    throw new Error(
      `Invalid kafka event configuration for function "${functionKey}" and topic "${topic}": ` +
        '"bootstrapServers" (or "brokers") must contain at least one broker.'
    );
  }

  const batchSize = asPositiveInteger(raw.batchSize, customConfig.batchSize || 1) || 1;
  const maximumBatchingWindowInSeconds = asPositiveInteger(
    raw.maximumBatchingWindowInSeconds,
    customConfig.maximumBatchingWindowInSeconds || 0
  );

  return {
    topic,
    bootstrapServers,
    startingPosition: raw.startingPosition,
    consumerGroupId: raw.consumerGroupId || customConfig.defaultConsumerGroupId,
    batchSize,
    maximumBatchingWindowInSeconds,
    accessConfigurations: raw.accessConfigurations || {},
  };
}

module.exports = {
  normalizeCustomConfig,
  normalizeKafkaEventConfig,
};
