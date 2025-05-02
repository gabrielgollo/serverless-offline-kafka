const { spawn } = require('child_process');
const { Writable } = require('stream');
const onExit = require('signal-exit');
const { Kafka } = require('kafkajs');
const { getSplitLinesTransform } = require('./utils');
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

  console.log('[test] Enviando mensagens para o Kafka...');
  await producer.send({
    topic: TOPIC,
    messages: [
      { key: 'key1', value: JSON.stringify({ code: '1', message: 'test1' }) },
      { key: 'key2', value: JSON.stringify({ code: '2', message: 'test2' }) },
      { key: 'key3', value: JSON.stringify({ code: '3', message: 'test3' }) },
    ],
  });

  await producer.disconnect();
  console.log('[test] Mensagens enviadas com sucesso.');
}

console.log('[test] Iniciando processo serverless...');

const serverless = spawn('npm', ['run', 'start'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: ['pipe', 'pipe', 'pipe'],
});

let handledCount = 0;
let timeout = setTimeout(() => {
  console.error('[test] ❌ Timeout atingido. Encerrando processo.');
  serverless.kill();
  process.exit(1);
}, 20000); // 20 segundos

serverless.stdout.pipe(getSplitLinesTransform()).pipe(
  new Writable({
    objectMode: true,
    write(line, enc, cb) {
      console.log(`[serverless] ${line}`);

      if (/Listening for Kafka events/.test(line)) {
        console.log('[test] Detecção de que o serverless está pronto. Enviando mensagens Kafka...');
        sendKafkaMessages().catch(console.error);
      }

      if (/handled .* with \d+ records/.test(line)) {
        handledCount++;
        console.log(`[test] Evento processado (${handledCount})`);

        if (handledCount === 1) {
          clearTimeout(timeout);
          console.log('[test] ✅ Teste concluído com sucesso.');
          serverless.kill();
        }
      }

      cb();
    },
  })
);

serverless.on('close', (code) => {
  console.log(`[test] Processo finalizado com código ${code}`);
  process.exit(code);
});

onExit((_code, signal) => {
  if (signal) serverless.kill(signal);
});
