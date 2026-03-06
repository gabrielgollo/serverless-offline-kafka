'use strict';

const { spawn } = require('child_process');
const { Writable } = require('stream');
const onExit = require('signal-exit');
const { Kafka } = require('kafkajs');
const path = require('path');
const { getSplitLinesTransform } = require('./utils');

const KAFKA_BROKER = process.env.KAFKA_BROKER || '127.0.0.1:9092';
const TOPIC = 'local.topic.test';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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

const serverless = spawn(npmCommand, ['run', 'start'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
  detached: process.platform !== 'win32',
});

let handledCount = 0;
let kafkaSent = false;
let hasFailed = false;
let completedSuccessfully = false;
let shutdownRequested = false;
let forceExitTimer = null;

function scheduleForcedExit(exitCode) {
  if (forceExitTimer) {
    return;
  }

  forceExitTimer = setTimeout(() => {
    process.stderr.write('[test] Forced exit after waiting for serverless shutdown.\n');
    process.exit(exitCode);
  }, 10000);
}

function requestServerlessShutdown({ reason, exitCode }) {
  if (shutdownRequested) {
    return;
  }

  shutdownRequested = true;
  clearTimeout(timeout);
  process.stderr.write(`[test] Requesting serverless shutdown (${reason}).\n`);
  scheduleForcedExit(exitCode);

  if (process.platform !== 'win32' && typeof serverless.pid === 'number') {
    try {
      process.kill(-serverless.pid, 'SIGTERM');
    } catch (_error) {
      serverless.kill('SIGTERM');
    }

    const killTimer = setTimeout(() => {
      if (serverless.exitCode === null) {
        try {
          process.kill(-serverless.pid, 'SIGKILL');
        } catch (_error) {
          serverless.kill('SIGKILL');
        }
      }
    }, 3000);

    if (typeof killTimer.unref === 'function') {
      killTimer.unref();
    }

    return;
  }

  serverless.kill('SIGTERM');
}

const timeout = setTimeout(() => {
  hasFailed = true;
  process.stderr.write(
    `[test] Timeout waiting for kafka flow. kafkaSent=${kafkaSent}, handledCount=${handledCount}\n`
  );
  requestServerlessShutdown({ reason: 'timeout', exitCode: 1 });
}, 60000);

async function processServerlessLine(line) {
  if (/Listening for Kafka events/.test(line) && !kafkaSent) {
    kafkaSent = true;
    await sendKafkaMessages();
  }

  if (/handled .* with \d+ records/.test(line)) {
    handledCount += 1;
    if (handledCount >= 1) {
      completedSuccessfully = true;
      requestServerlessShutdown({ reason: 'integration-finished', exitCode: 0 });
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
  if (forceExitTimer) {
    clearTimeout(forceExitTimer);
    forceExitTimer = null;
  }

  if (hasFailed) {
    process.exit(1);
  }

  if (completedSuccessfully) {
    process.exit(0);
  }

  const normalizedCode = code === null ? 0 : code;
  process.exit(normalizedCode);
});

serverless.on('error', (error) => {
  hasFailed = true;
  process.stderr.write(`[test] Failed to start serverless process: ${error.message}\n`);
  requestServerlessShutdown({ reason: 'spawn-error', exitCode: 1 });
});

onExit((_code, signal) => {
  if (signal) {
    requestServerlessShutdown({ reason: `parent-signal-${signal}`, exitCode: 1 });
  }
});
