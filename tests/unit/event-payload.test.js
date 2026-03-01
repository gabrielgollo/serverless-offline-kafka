'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLambdaKafkaEvent, mapKafkaMessageToRecord } = require('../../src/event-payload');

test('mapKafkaMessageToRecord should encode key and value as base64', () => {
  const record = mapKafkaMessageToRecord({
    key: Buffer.from('hello'),
    value: Buffer.from('world'),
    offset: '42',
    headers: {
      source: Buffer.from('local'),
    },
  });

  assert.equal(record.key, Buffer.from('hello').toString('base64'));
  assert.equal(record.value, Buffer.from('world').toString('base64'));
  assert.equal(record.offset, '42');
  assert.deepEqual(record.headers, [{ source: Array.from(Buffer.from('local')) }]);
});

test('buildLambdaKafkaEvent should map topic records payload', () => {
  const event = buildLambdaKafkaEvent({
    topic: 'my-topic',
    bootstrapServers: ['localhost:9092'],
    records: [
      {
        key: Buffer.from('a').toString('base64'),
        value: Buffer.from('b').toString('base64'),
        offset: '7',
        headers: [],
      },
    ],
  });

  assert.equal(event.eventSource, 'SelfManagedKafka');
  assert.equal(event.bootstrapServers, 'localhost:9092');
  assert.equal(Array.isArray(event.records['my-topic']), true);
  assert.equal(event.records['my-topic'][0].offset, '7');
  assert.equal(event.records['my-topic'][0].topic, 'my-topic');
});
