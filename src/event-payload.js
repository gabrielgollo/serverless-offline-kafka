'use strict';

function toBase64(value) {
  if (value === undefined || value === null) return null;
  if (Buffer.isBuffer(value)) return value.toString('base64');
  return Buffer.from(String(value)).toString('base64');
}

function toHeaderByteArray(value) {
  if (value === undefined || value === null) return [];
  if (Buffer.isBuffer(value)) return Array.from(value);
  if (Array.isArray(value)) return value;
  return Array.from(Buffer.from(String(value)));
}

function mapKafkaMessageToRecord(message) {
  const headers = Object.entries(message.headers || {}).map(([headerKey, headerValue]) => ({
    [headerKey]: toHeaderByteArray(headerValue),
  }));

  return {
    key: toBase64(message.key),
    value: toBase64(message.value),
    offset: message.offset,
    headers,
  };
}

function buildLambdaKafkaEvent({ topic, bootstrapServers, records }) {
  const now = Date.now();

  return {
    eventSource: 'SelfManagedKafka',
    bootstrapServers: bootstrapServers.join(','),
    records: {
      [topic]: records.map((record, index) => ({
        topic,
        partition: 0,
        offset: record.offset || String(index),
        timestamp: now,
        timestampType: 'CREATE_TIME',
        key: record.key,
        value: record.value,
        headers: record.headers,
      })),
    },
  };
}

module.exports = {
  buildLambdaKafkaEvent,
  mapKafkaMessageToRecord,
};
