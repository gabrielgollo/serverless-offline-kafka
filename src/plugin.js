'use strict';

const { Kafka } = require('kafkajs');
const BatchAccumulator = require('./batch-accumulator');
const { normalizeCustomConfig, normalizeKafkaEventConfig } = require('./config');
const { resolveSaslConfig } = require('./auth');
const { buildLambdaKafkaEvent, mapKafkaMessageToRecord } = require('./event-payload');
const Logger = require('./logger');
const { PLUGIN_NAME } = require('./constants');

class ServerlessOfflineKafkaPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.logger = new Logger(serverless);
    this.customConfig = normalizeCustomConfig(serverless.service?.custom?.[PLUGIN_NAME]);
    this.lambda = null;
    this.consumerRuntimes = [];

    this.hooks = {
      'offline:start:init': this.start.bind(this),
      'offline:start:end': this.stop.bind(this),
    };
  }

  async start() {
    await this.#createLambdas();
    await this.#startKafkaConsumers();
    this.logger.info('started');
    this.logger.info('Listening for Kafka events');
  }

  async stop() {
    const shutdownResults = await Promise.allSettled(
      this.consumerRuntimes.map(async ({ topic, consumer, batcher }) => {
        await batcher.close();
        await consumer.disconnect();
        this.logger.info(`Stopped listening on topic "${topic}"`);
      })
    );

    for (const result of shutdownResults) {
      if (result.status === 'rejected') {
        this.logger.warn(`Failed to close one Kafka consumer cleanly: ${result.reason?.message || result.reason}`);
      }
    }

    this.consumerRuntimes = [];
    this.logger.info('stopped');
  }

  async #createLambdas() {
    const { default: Lambda } = await import('serverless-offline/lambda');
    this.lambda = new Lambda(this.serverless, this.options);

    const functionKeys = this.serverless.service.getAllFunctions();
    const lambdaDefs = functionKeys.map((functionKey) => ({
      functionKey,
      functionDefinition: this.serverless.service.getFunction(functionKey),
    }));

    await Promise.resolve(this.lambda.create(lambdaDefs));
  }

  async #startKafkaConsumers() {
    const subscriptions = this.#collectKafkaSubscriptions();
    if (subscriptions.length === 0) {
      this.logger.warn('No kafka events found. Plugin loaded but no consumers started.');
      return;
    }

    for (const subscription of subscriptions) {
      await this.#startKafkaConsumer(subscription);
    }
  }

  #collectKafkaSubscriptions() {
    const serviceFunctions = this.serverless.service.functions || {};
    const subscriptions = [];

    for (const [functionKey, functionDefinition] of Object.entries(serviceFunctions)) {
      const events = functionDefinition.events || [];
      for (const event of events) {
        if (!event.kafka) continue;
        const normalizedConfig = normalizeKafkaEventConfig(functionKey, event.kafka, this.customConfig);
        if (!normalizedConfig) continue;
        subscriptions.push({
          functionKey,
          kafkaEventConfig: normalizedConfig,
        });
      }
    }

    return subscriptions;
  }

  async #startKafkaConsumer({ functionKey, kafkaEventConfig }) {
    const kafkaConfig = {
      clientId: `${this.customConfig.clientId}-${functionKey}`,
      brokers: kafkaEventConfig.bootstrapServers,
      ssl: this.customConfig.ssl,
    };

    const saslAuth = await resolveSaslConfig(
      kafkaEventConfig.accessConfigurations?.saslScram512Auth,
      this.serverless,
      this.logger
    );

    if (saslAuth) {
      kafkaConfig.sasl = saslAuth;
    }

    const kafka = new Kafka(kafkaConfig);
    await this.#ensureTopicExists(kafka, kafkaEventConfig.topic);

    const consumer = kafka.consumer({
      groupId: kafkaEventConfig.consumerGroupId,
      sessionTimeout: this.customConfig.sessionTimeout,
      heartbeatInterval: this.customConfig.heartbeatInterval,
    });

    await consumer.connect();
    await consumer.subscribe({
      topic: kafkaEventConfig.topic,
      fromBeginning: kafkaEventConfig.startingPosition === 'TRIM_HORIZON',
    });

    const batcher = new BatchAccumulator({
      batchSize: kafkaEventConfig.batchSize,
      flushWindowMs: kafkaEventConfig.maximumBatchingWindowInSeconds * 1000,
      onFlush: async (records) => {
        await this.#invokeLambda({
          functionKey,
          topic: kafkaEventConfig.topic,
          bootstrapServers: kafkaEventConfig.bootstrapServers,
          records,
        });
      },
      onError: (error) => {
        this.logger.error(
          `Error while batching Kafka messages for function "${functionKey}" on topic "${kafkaEventConfig.topic}": ` +
            `${error?.message || error}`
        );
      },
    });

    await consumer.run({
      eachMessage: async ({ message }) => {
        const record = mapKafkaMessageToRecord(message);
        await batcher.add(record);
      },
    });

    this.consumerRuntimes.push({
      topic: kafkaEventConfig.topic,
      consumer,
      batcher,
    });

    this.logger.info(
      `Listening on topic "${kafkaEventConfig.topic}" for function "${functionKey}" using group "${kafkaEventConfig.consumerGroupId}"`
    );
  }

  async #ensureTopicExists(kafka, topic) {
    if (!this.customConfig.autoCreateTopics) {
      return;
    }

    const admin = kafka.admin();
    await admin.connect();
    try {
      const existingTopics = await admin.listTopics();
      if (!existingTopics.includes(topic)) {
        await admin.createTopics({
          topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
        });
        this.logger.info(`Created topic "${topic}"`);
      }
    } finally {
      await admin.disconnect();
    }
  }

  async #invokeLambda({ functionKey, topic, bootstrapServers, records }) {
    const event = buildLambdaKafkaEvent({
      topic,
      bootstrapServers,
      records,
    });

    try {
      const lambdaFunction = this.lambda.get(functionKey);
      if (!lambdaFunction) {
        throw new Error(`Serverless-offline lambda not found for function "${functionKey}".`);
      }

      lambdaFunction.setEvent(event);
      await lambdaFunction.runHandler();
      this.logger.info(`handled ${functionKey} with ${records.length} records`);
    } catch (error) {
      this.logger.error(`error handling ${functionKey}: ${error.message}`);
    }
  }
}

module.exports = ServerlessOfflineKafkaPlugin;
