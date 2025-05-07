const { spawn } = require('child_process');
const { Writable } = require('stream');
const onExit = require('signal-exit');
const { Kafka } = require('kafkajs');
const { getSplitLinesTransform } = require('./utils');
const path = require('path');

const KAFKA_BROKER = '127.0.0.1:9092';
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
  shell: true,
});

let handledCount = 0;
let kafkaSent = false;

const timeout = setTimeout(() => {
  console.error('[test] ❌ Timeout atingido. Encerrando processo.');
  serverless.kill();
  process.exit(1);
}, 30000);

// LOG DE STDERR
serverless.stderr.pipe(getSplitLinesTransform()).pipe(
  new Writable({
    objectMode: true,
    write(line, _enc, callback) {
      console.error(`[serverless:stderr] ${line}`);
      callback();
    },
  })
);

// LOG DE STDOUT + CONTROLE DO FLUXO
serverless.stdout.pipe(getSplitLinesTransform()).pipe(
  new Writable({
    objectMode: true,
    async write(line, _enc, callback) {
      try {
        console.log(`[serverless] ${line}`);

        if (/Listening for Kafka events/.test(line) && !kafkaSent) {
          kafkaSent = true;
          console.log('[test] Serverless pronto. Enviando mensagens Kafka...');
          await sendKafkaMessages();
        }

        if (/handled .* with \d+ records/.test(line)) {
          handledCount++;
          console.log(`[test] Evento processado (${handledCount})`);

          if (handledCount >= 1) {
            clearTimeout(timeout);
            console.log('[test] ✅ Teste concluído com sucesso.');
            serverless.kill();
          }
        }

        callback();
      } catch (err) {
        console.error('[test] Erro interno no teste:', err);
        callback(err);
      }
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
