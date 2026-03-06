'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCustomConfig, normalizeKafkaEventConfig } = require('../../src/config');

test('normalizeCustomConfig should apply defaults', () => {
  const config = normalizeCustomConfig();

  assert.equal(config.autoCreateTopics, true);
  assert.equal(config.ssl, false);
  assert.equal(config.disableSaslAuth, false);
  assert.equal(config.batchSize, 1);
  assert.equal(config.maximumBatchingWindowInSeconds, 0);
});

test('normalizeCustomConfig should keep valid explicit values', () => {
  const config = normalizeCustomConfig({
    autoCreateTopics: false,
    ssl: true,
    disableSaslAuth: true,
    clientId: 'local-client',
    defaultConsumerGroupId: 'local-group',
    batchSize: 3,
    maximumBatchingWindowInSeconds: 7,
  });

  assert.equal(config.autoCreateTopics, false);
  assert.equal(config.ssl, true);
  assert.equal(config.disableSaslAuth, true);
  assert.equal(config.clientId, 'local-client');
  assert.equal(config.defaultConsumerGroupId, 'local-group');
  assert.equal(config.batchSize, 3);
  assert.equal(config.maximumBatchingWindowInSeconds, 7);
});

test('normalizeKafkaEventConfig should support aliases and fallback values', () => {
  const config = normalizeKafkaEventConfig(
    'myFunction',
    {
      topicName: 'orders',
      brokers: ['localhost:9092'],
    },
    {
      batchSize: 10,
      maximumBatchingWindowInSeconds: 2,
      defaultConsumerGroupId: 'default-group',
    }
  );

  assert.equal(config.topic, 'orders');
  assert.deepEqual(config.bootstrapServers, ['localhost:9092']);
  assert.equal(config.batchSize, 10);
  assert.equal(config.maximumBatchingWindowInSeconds, 2);
  assert.equal(config.consumerGroupId, 'default-group');
});

test('normalizeKafkaEventConfig should throw if topic is missing', () => {
  assert.throws(() => {
    normalizeKafkaEventConfig(
      'myFunction',
      {
        bootstrapServers: ['localhost:9092'],
      },
      { batchSize: 1, maximumBatchingWindowInSeconds: 0, defaultConsumerGroupId: 'g1' }
    );
  }, /topic/);
});

test('normalizeKafkaEventConfig should return null for disabled event', () => {
  const result = normalizeKafkaEventConfig(
    'myFunction',
    {
      enable: false,
      topic: 'orders',
      bootstrapServers: ['localhost:9092'],
    },
    { batchSize: 1, maximumBatchingWindowInSeconds: 0, defaultConsumerGroupId: 'g1' }
  );

  assert.equal(result, null);
});
