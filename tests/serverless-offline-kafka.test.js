const { spawn } = require('child_process');
const { Writable } = require('stream');
const onExit = require('signal-exit');
const { Kafka } = require('kafkajs');
const { getSplitLinesTransform } = require('./utils'); // um transform stream que separa linhas por \n
const path = require('path');

const KAFKA_BROKER = 'localhost:9092';
const TOPIC = 'local.topic.test';

const kafka = new Kafka({
  clientId: 'test-client',
  brokers: [KAFKA_BROKER],
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
});

let handledCount = 0;

serverless.stdout.pipe(getSplitLinesTransform()).pipe(
  new Writable({
    objectMode: true,
    write(line, enc, cb) {
      if (/Listening for Kafka events/.test(line)) {
        sendKafkaMessages();
      }

      if (/handled .* with \d+ records/.test(line)) {
        handledCount++;
        if (handledCount === 1) {
          serverless.kill();
        }
      }

      cb();
    },
  })
);

serverless.on('close', (code) => {
  console.log(`[test] Process exited with code ${code}`);
  process.exit(code);
});

onExit((_code, signal) => {
  if (signal) serverless.kill(signal);
});