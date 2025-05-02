# serverless-offline-kafka

A Serverless Framework plugin that enables local Kafka event simulation for AWS Lambda functions using `serverless-offline`.

[![serverless](https://cdn.prod.website-files.com/60acbb950c4d6606963e1fed/60acbb950c4d66854e3e2013_logo%20serverless%20dark.svg)](http://www.serverless.com)
[![npm version](https://badge.fury.io/js/serverless-offline-kafka.svg)](https://badge.fury.io/js/serverless-offline-kafka)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Note**
>
> Found a bug or want to contribute? Feel free to open an [issue](https://github.com/gabrielgollo/serverless-offline-kafka/issues) or a pull request!

---

## Getting Started

This plugin enables your local Serverless project to handle Kafka messages using `serverless-offline`.

### Features

✅ Supports Kafka events  
✅ Fully compatible with `serverless.yml` event definitions  
✅ Supports mocking of Kafka topics and batch consumption  
✅ Designed to run alongside `serverless-offline`

---

## Example

See the [`examples`](./examples/) folder for usage.

---

## Installation

Install with npm or yarn:

```bash
npm install --save-dev serverless-offline-kafka
# or
yarn add -D serverless-offline-kafka
```

Then, update your serverless.yml:

```yaml
plugins:
  - serverless-offline
  - serverless-offline-kafka # Make sure this is after serverless-offline
```

## Plugin Configuration
```yaml
custom:
  serverless-offline-kafka:
    autoCreateTopics: true # If we can create topics in kafka automatically
    debugPython: true # If we can debug the python process
```

## Usage
```yaml
functions:
  myFunction:
    handler: handler.myFunction
    events:
      - kafka:
            enable: true # If we want to enable the kafka event
            topicName: my-topic # The topic name to consume from
            batch: true # If we want to consume in batch
            startingPosition: LATEST # The starting position of the kafka consumer
            maximumBatchingWindowInSeconds: 10 # The maximum time to wait for a batch to be ready
            batchSize: 100 # The maximum number of messages to consume in a batch
            brokers:
                - localhost:9092 # The kafka broker to connect to
            topicName: my-topic # The topic name to consume from
```