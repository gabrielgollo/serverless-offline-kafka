'use strict';
const { Kafka } = require('kafkajs');

const DEFAULT_CUSTOM_CONFIG = {
  autoCreateTopics: true,
  ssl: false
}

class ServerlessOfflineKafka {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.customConfig = serverless.service?.custom?.['serverless-offline-kafka'] || DEFAULT_CUSTOM_CONFIG
    this.options = options;
    this.consumers = [];
    this.lambda = null;
    this.bootstrapServers = [];

    this.hooks = {
      'offline:start:init': this.start.bind(this),
      'offline:start:end': this.stop.bind(this),
    };
  }

  async start() {
    await this._createLambdas();
    await this._startKafkaConsumers();
    this.serverless.cli.log('[serverless-offline-kafka] ✅ has started');
    this.serverless.cli.log('[serverless-offline-kafka] ✅🐶 Listening for Kafka events');
  }

  async stop() {
    await Promise.all(this.consumers.map(c => c.disconnect()));
    this.serverless.cli.log('[serverless-offline-kafka] ❌ has stopped');
    this.serverless.cli.log('[serverless-offline-kafka] ❌🐶 Stopped listening for Kafka events');
  }

  async _createLambdas() {
    const { default: Lambda } = await import('serverless-offline/lambda');
    this.lambda = new Lambda(this.serverless, this.options);

    const functionKeys = this.serverless.service.getAllFunctions();
    const lambdaDefs = functionKeys.map(functionKey => ({
      functionKey,
      functionDefinition: this.serverless.service.getFunction(functionKey),
    }));

    this.lambda.create(lambdaDefs);
  }

  async initializeKafkaAdmin(kafka, cfg) {
    if (this.customConfig.autoCreateTopics) {
        const admin = kafka.admin();
        await admin.connect();
        const existingTopics = await admin.listTopics();

        if (!existingTopics.includes(cfg.topic)) {
            await admin.createTopics({
                topics: [{ topic: cfg.topic, numPartitions: 1, replicationFactor: 1 }],
            });
            this.serverless.cli.log(`[serverless-offline-kafka] 🧱 Created topic "${cfg.topic}"`);
        }

        await admin.disconnect();
    }
}

  async _startKafkaConsumers() {
    const { functions } = this.serverless.service;

    for (const [functionKey, fnDef] of Object.entries(functions)) {
      const kafkaEvents = (fnDef.events || []).filter(e => e.kafka);

      for (const { kafka: eventConfig } of kafkaEvents) {
        await this._startKafkaConsumer(functionKey, eventConfig);
      }
    }
  }

  async _startKafkaConsumer(functionKey, cfg) {
    const kafkaConfig = {
      brokers: Array.isArray(cfg.bootstrapServers)
        ? cfg.bootstrapServers
        : [cfg.bootstrapServers],
        ssl: this.customConfig.ssl
    };
    this.bootstrapServers = kafkaConfig.brokers;

    const auth = cfg.accessConfigurations?.saslScram512Auth;
    if (auth) {
      if (typeof auth === 'string' && auth.includes('arn:aws:secretsmanager')) {
        this.serverless.cli.log(`[serverless-offline-kafka] Trying to use AWS Secrets Manager for authentication: ${auth}`);
        
        const secret = await this.serverless.providers.aws.getSecretValue(auth);
        const secretData = JSON.parse(secret.SecretString);
        kafkaConfig.sasl = {
          mechanism: 'scram-sha-512',
          username: secretData.username,
          password: secretData.password,
        };
      } else{
        this.serverless.cli.log(`[serverless-offline-kafka] Trying to use provided authentication configuration`);
        if (typeof auth.username !== 'string' || typeof auth.password !== 'string') {
          throw new Error('Invalid authentication configuration for Kafka consumer. Username and password must be strings.');
        }
        kafkaConfig.sasl = {
          mechanism: 'scram-sha-512',
          username: auth.username,
          password: auth.password,
        };
      }

    }

    const kafka = new Kafka(kafkaConfig);

    // Set up auto-creation of topics if enabled
    await this.initializeKafkaAdmin(kafka, cfg);

    const consumer = kafka.consumer({
      groupId: cfg.consumerGroupId || 'serverless-offline-kafka',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    
    await consumer.connect();
    await consumer.subscribe({
      topic: cfg.topic,
      fromBeginning: cfg.startingPosition === 'TRIM_HORIZON',
    });

    const batchSize = cfg.batchSize || 1;
    const buffer = [];

    await consumer.run({
      eachMessage: async ({ message }) => {
        buffer.push({
          key: message.key ? message.key.toString('base64') : null,
          value: message.value ? message.value.toString('base64') : null,
          offset: message.offset,
          headers: Object.entries(message.headers).map(([key, value]) => ({
            [key]: Array.from(value).map((v) => typeof v === 'number' ? v : v.charCodeAt(0))
          })),
        });

        if (buffer.length >= batchSize) {
          const batch = buffer.splice(0, batchSize);
          await this._invokeLambda(functionKey, batch, cfg.topic);
        }
      },
    });

    this.consumers.push(consumer);
    this.serverless.cli.log(`[serverless-offline-kafka] 🎧 Listening on topic "${cfg.topic}"`);
  }

  async _invokeLambda(functionKey, records, topic) {
    const now = Date.now();

    const event = {
      eventSource: "SelfManagedKafka",
      bootstrapServers: this.bootstrapServers.join(','),
      records: {
        [topic]: records.map((r, i) => ({
          topic,
          partition: 0,
          offset: r.offset || `${i}`,
          timestamp: now,
          timestampType: "CREATE_TIME",
          key: r.key,
          value: r.value,
          headers: r.headers,
        })),
      },
    };

    try {
      const lambdaFn = this.lambda.get(functionKey);
      lambdaFn.setEvent(event);
      await lambdaFn.runHandler();

      this.serverless.cli.log(`[serverless-offline-kafka] ✅ handled ${functionKey} with ${records.length} records`);
    } catch (err) {
      this.serverless.cli.log(`[serverless-offline-kafka] ❌ error handling ${functionKey}: ${err.message}`);
    }
  }
}

module.exports = ServerlessOfflineKafka;


