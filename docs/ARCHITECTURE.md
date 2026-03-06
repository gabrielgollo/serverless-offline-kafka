# Architecture

## Goal

`serverless-offline-kafka` bridges Kafka topics and local Lambda handlers during `serverless offline`.

The plugin keeps event payloads compatible with AWS `SelfManagedKafka` shape and manages consumer lifecycle with Serverless hooks.

## Module layout

- `src/plugin.js`
  - Main orchestration class and Serverless hooks
  - Creates lambda runtime from `serverless-offline`
  - Starts/stops Kafka consumers and batch processors
- `src/config.js`
  - Normalizes plugin config and kafka event config
  - Validates required fields and applies defaults
- `src/auth.js`
  - Resolves SASL/SCRAM credentials from inline config or AWS Secrets Manager ARN
  - Accepts single-item array wrappers for compatibility with YAML/variable resolution
  - Skips auth resolution entirely when `custom.serverless-offline-kafka.disableSaslAuth` is `true`
- `src/event-payload.js`
  - Converts KafkaJS messages into Lambda-compatible kafka records
- `src/batch-accumulator.js`
  - Handles batch size and optional time window flush
- `src/logger.js`
  - Provides consistent log prefix and warning/error formatting

## Runtime flow

1. Hook `offline:start:init` calls `start()`
2. Plugin creates `serverless-offline` lambda runtime with all service functions
3. Plugin scans service functions and collects kafka events
4. For each kafka event:
   - normalize config
   - resolve auth (if configured and not disabled by `disableSaslAuth`)
   - initialize Kafka consumer
   - subscribe to topic
   - process each message into batching pipeline
5. On flush:
   - build lambda event payload
   - invoke local handler via `runHandler()`
6. Hook `offline:start:end` calls `stop()`
7. Plugin flushes pending batches and disconnects consumers

## Design decisions

- Keep hook entrypoint thin and delegate behavior to small modules
- Validate configuration early and fail with actionable messages
- Keep integration test for behavior with real Kafka
- Keep unit tests for deterministic pieces (config, batching, payload mapping)

## Operational considerations

- `autoCreateTopics` is intended for local debugging and testing
- If multiple kafka events exist, each gets an isolated consumer runtime
- Batch flush can happen by size or timeout (`maximumBatchingWindowInSeconds`)
