'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSaslConfig } = require('../../src/auth');

function createLogger() {
  return {
    info: () => {},
  };
}

test('resolveSaslConfig should resolve secret from single-item ARN array', async () => {
  const arn = 'arn:aws:secretsmanager:us-east-1:000000000000:secret:orders-monitoring-local-*';
  const serverless = {
    providers: {
      aws: {
        getSecretValue: async (secretArn) => {
          assert.equal(secretArn, arn);
          return {
            SecretString: JSON.stringify({
              username: 'kafka-user',
              password: 'kafka-password',
            }),
          };
        },
      },
    },
  };

  const result = await resolveSaslConfig([arn], serverless, createLogger());

  assert.deepEqual(result, {
    mechanism: 'scram-sha-512',
    username: 'kafka-user',
    password: 'kafka-password',
  });
});

test('resolveSaslConfig should resolve inline credentials from single-item array', async () => {
  const result = await resolveSaslConfig(
    [
      {
        username: 'local-user',
        password: 'local-pass',
      },
    ],
    {},
    createLogger()
  );

  assert.deepEqual(result, {
    mechanism: 'scram-sha-512',
    username: 'local-user',
    password: 'local-pass',
  });
});

test('resolveSaslConfig should reject arrays with more than one item', async () => {
  await assert.rejects(
    resolveSaslConfig(['arn:aws:secretsmanager:us-east-1:1:secret:a', 'arn:aws:secretsmanager:us-east-1:1:secret:b']),
    /exactly one item/
  );
});

test('resolveSaslConfig should skip auth resolution when disableSaslAuth is true', async () => {
  let getSecretValueCalled = false;
  const serverless = {
    providers: {
      aws: {
        getSecretValue: async () => {
          getSecretValueCalled = true;
          return {
            SecretString: JSON.stringify({ username: 'ignored', password: 'ignored' }),
          };
        },
      },
    },
  };

  const result = await resolveSaslConfig(
    'arn:aws:secretsmanager:us-east-1:000000000000:secret:orders-monitoring-local-*',
    serverless,
    createLogger(),
    { disableSaslAuth: true }
  );

  assert.equal(result, null);
  assert.equal(getSecretValueCalled, false);
});
