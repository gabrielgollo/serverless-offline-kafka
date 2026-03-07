# serverless-offline-kafka

Serverless Framework plugin for local debugging of AWS Lambda functions triggered by Kafka events.

It runs alongside `serverless-offline`, starts Kafka consumers defined in your `serverless.yml`, and invokes local Lambda handlers using a payload compatible with `SelfManagedKafka`.

## Why this plugin

- Keep Kafka event contracts close to real Lambda event shape
- Debug consumers locally before deploying infrastructure
- Reuse your existing `serverless.yml` event configuration
- Run integration tests against real Kafka broker in Docker

## Requirements

- Node.js `>= 18`
- Serverless Framework `>= 3`
- `serverless-offline`
- A reachable Kafka broker (for local tests, use `docker-compose-tests.yml`)

## Installation

Install required plugins:

```bash
npm install --save-dev serverless-offline serverless-offline-kafka@npm:@gabrielgollo/serverless-offline-kafka@^1.0.6
```

Add both plugins in your `package.json` (using npm alias for this plugin):

```json
{
  "devDependencies": {
    "serverless-offline": "^13.9.0",
    "serverless-offline-kafka": "npm:@gabrielgollo/serverless-offline-kafka@^1.0.6"
  }
}
```

In your `serverless.yml`, keep plugin order as shown:

```yaml
plugins:
  - serverless-offline
  - serverless-offline-kafka
```

## Configuration

Plugin-level config goes under `custom.serverless-offline-kafka`.

```yaml
custom:
  serverless-offline-kafka:
    autoCreateTopics: true
    ssl: false
    disableSaslAuth: false
    clientId: serverless-offline-kafka
    defaultConsumerGroupId: serverless-offline-kafka
    sessionTimeout: 30000
    heartbeatInterval: 3000
    batchSize: 1
    maximumBatchingWindowInSeconds: 0
```

### Plugin options

| Option | Type | Default | Description |
|---|---|---|---|
| `autoCreateTopics` | boolean | `true` | Creates topic when missing (single partition, replication factor 1). |
| `ssl` | boolean | `false` | Enables Kafka TLS connection. |
| `disableSaslAuth` | boolean | `false` | Ignores `saslScram512Auth` completely. No SASL config is applied and no AWS Secret Manager lookup is performed. |
| `clientId` | string | `serverless-offline-kafka` | Base KafkaJS client id. Function key is appended per consumer. |
| `defaultConsumerGroupId` | string | `serverless-offline-kafka` | Consumer group fallback for events without explicit `consumerGroupId`. |
| `sessionTimeout` | number | `30000` | Kafka consumer session timeout in ms. |
| `heartbeatInterval` | number | `3000` | Kafka consumer heartbeat interval in ms. |
| `batchSize` | number | `1` | Default max records per Lambda invocation. |
| `maximumBatchingWindowInSeconds` | number | `0` | Default time window to flush incomplete batches. |

### Function event options

```yaml
functions:
  processOrders:
    handler: src/handler.process
    events:
      - kafka:
          topic: local.orders
          bootstrapServers:
            - localhost:9092
          consumerGroupId: local-orders-group
          startingPosition: TRIM_HORIZON
          batchSize: 10
          maximumBatchingWindowInSeconds: 5
          accessConfigurations:
            saslScram512Auth:
              username: my-user
              password: my-password
```

Supported aliases:

- `topicName` (alias of `topic`)
- `brokers` (alias of `bootstrapServers`)
- `enable` or `enabled` set to `false` disables that kafka event

For SASL/SCRAM auth, `saslScram512Auth` supports:

- inline object with `username` and `password`
- AWS Secrets Manager ARN string (requires Serverless AWS provider support)
- single-item array containing either an inline object or an ARN string

Examples:

```yaml
# 1) Inline credentials object
accessConfigurations:
  saslScram512Auth:
    username: my-user
    password: my-password
```

```yaml
# 2) AWS Secrets Manager ARN string
accessConfigurations:
  saslScram512Auth: arn:aws:secretsmanager:us-east-1:000000000000:secret:orders-monitoring-local-*
```

```yaml
# 3) Single-item array (accepted for compatibility with some YAML/variable resolutions)
accessConfigurations:
  saslScram512Auth:
    - arn:aws:secretsmanager:us-east-1:000000000000:secret:orders-monitoring-local-*
```

If an array is used, it must contain exactly one item.

To force local execution without any SASL auth (for example, local Docker Kafka), set:

```yaml
custom:
  serverless-offline-kafka:
    disableSaslAuth: true
```

When `disableSaslAuth` is `true`, the plugin ignores `saslScram512Auth` even if an ARN is configured.

`bootstrapServers` accepts:

- YAML list, for example `["localhost:9092", "localhost:9093"]`
- comma-separated string, for example `"localhost:9092,localhost:9093"`

## Local run

```bash
npm run start
```

Expected startup logs:

- `[serverless-offline-kafka] started`
- `[serverless-offline-kafka] Listening for Kafka events`
- `[serverless-offline-kafka] Listening on topic "<topic>" for function "<fn>" using group "<group>"`

## Development

### Scripts

```bash
npm run lint
npm run test:unit
npm run test:integration
npm test
```

`npm test` executes unit + integration tests.

### Test layout

- `tests/unit`: isolated tests for config, payload mapping, and batching
- `tests/serverless-offline-kafka.test.js`: end-to-end integration with Kafka broker

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module responsibilities and runtime flow.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
