'use strict';

const { spawn } = require('child_process');
const { Writable } = require('stream');
const onExit = require('signal-exit');
const { Kafka } = require('kafkajs');
const path = require('path');
const { getSplitLinesTransform } = require('./utils');

const KAFKA_BROKER = process.env.KAFKA_BROKER || '127.0.0.1:9092';
const TOPIC = 'local.topic.test';

const kafka = new Kafka({
  clientId: 'test-client-producer',
  brokers: KAFKA_BROKER.split(',').map((broker) => broker.trim()).filter(Boolean),
});

async function sendKafkaMessages() {
  const producer = kafka.producer();
  await producer.connect();

  await producer.send({
    topic: TOPIC,
    messages: [
      { key: 'key1', value: JSON.stringify({ code: '1', message: 'test1' }) },
      { key: 'key2', value: JSON.stringify({ code: '2', message: 'test2' }) },
      { key: 'key3', value: JSON.stringify({ code: '3', message: 'test3' }) },
    ],
  });

  await producer.disconnect();
}

const serverless = spawn('npm', ['run', 'start'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
});

let handledCount = 0;
let kafkaSent = false;
let hasFailed = false;

const timeout = setTimeout(() => {
  hasFailed = true;
  process.stderr.write(
    `[test] Timeout waiting for kafka flow. kafkaSent=${kafkaSent}, handledCount=${handledCount}\n`
  );
  serverless.kill();
  process.exit(1);
}, 60000);

async function processServerlessLine(line) {
  if (/Listening for Kafka events/.test(line) && !kafkaSent) {
    kafkaSent = true;
    await sendKafkaMessages();
  }

  if (/handled .* with \d+ records/.test(line)) {
    handledCount += 1;
    if (handledCount >= 1) {
      clearTimeout(timeout);
      serverless.kill();
    }
  }
}

serverless.stderr.pipe(getSplitLinesTransform()).pipe(
  new Writable({
    objectMode: true,
    async write(line, _enc, callback) {
      try {
        // Keep stderr visible for CI diagnostics.
        process.stderr.write(`[serverless:stderr] ${line}\n`);
        await processServerlessLine(line);
        callback();
      } catch (error) {
        hasFailed = true;
        callback(error);
      }
    },
  })
);

serverless.stdout.pipe(getSplitLinesTransform()).pipe(
  new Writable({
    objectMode: true,
    async write(line, _enc, callback) {
      try {
        process.stdout.write(`[serverless] ${line}\n`);
        await processServerlessLine(line);
        callback();
      } catch (error) {
        hasFailed = true;
        callback(error);
      }
    },
  })
);

serverless.on('close', (code) => {
  if (hasFailed) {
    process.exit(1);
  }

  const normalizedCode = code === null ? 0 : code;
  process.exit(normalizedCode);
});

onExit((_code, signal) => {
  if (signal) {
    serverless.kill(signal);
  }
});
