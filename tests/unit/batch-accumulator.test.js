'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const BatchAccumulator = require('../../src/batch-accumulator');

test('BatchAccumulator should flush when reaching batch size', async () => {
  const flushed = [];
  const batcher = new BatchAccumulator({
    batchSize: 2,
    flushWindowMs: 0,
    onFlush: async (batch) => {
      flushed.push(batch);
    },
  });

  await batcher.add({ id: 1 });
  await batcher.add({ id: 2 });
  await batcher.close();

  assert.equal(flushed.length, 1);
  assert.deepEqual(flushed[0], [{ id: 1 }, { id: 2 }]);
});

test('BatchAccumulator should flush pending records by timeout window', async () => {
  const flushed = [];
  const batcher = new BatchAccumulator({
    batchSize: 10,
    flushWindowMs: 30,
    onFlush: async (batch) => {
      flushed.push(batch);
    },
  });

  await batcher.add({ id: 1 });
  await new Promise((resolve) => setTimeout(resolve, 80));
  await batcher.close();

  assert.equal(flushed.length, 1);
  assert.deepEqual(flushed[0], [{ id: 1 }]);
});

test('BatchAccumulator should flush all remaining records when closing', async () => {
  const flushed = [];
  const batcher = new BatchAccumulator({
    batchSize: 3,
    flushWindowMs: 0,
    onFlush: async (batch) => {
      flushed.push(batch);
    },
  });

  await batcher.add({ id: 1 });
  await batcher.add({ id: 2 });
  await batcher.close();

  assert.equal(flushed.length, 1);
  assert.deepEqual(flushed[0], [{ id: 1 }, { id: 2 }]);
});
