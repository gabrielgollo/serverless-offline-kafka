'use strict';

function validateSecretPayload(payload) {
  if (!payload || typeof payload.username !== 'string' || typeof payload.password !== 'string') {
    throw new Error(
      'Invalid authentication payload. Expected an object containing string fields "username" and "password".'
    );
  }
}

async function resolveSaslConfig(authConfig, serverless, logger) {
  if (!authConfig) {
    return null;
  }

  if (typeof authConfig === 'string') {
    if (!authConfig.includes('arn:aws:secretsmanager')) {
      throw new Error(
        'Invalid saslScram512Auth value. When using a string, an AWS Secrets Manager ARN is expected.'
      );
    }

    logger.info(`Resolving Kafka auth credentials from AWS Secrets Manager: ${authConfig}`);
    const awsProvider = serverless?.providers?.aws;
    if (!awsProvider || typeof awsProvider.getSecretValue !== 'function') {
      throw new Error(
        'AWS provider is not available in Serverless context. Cannot resolve SASL credentials from secret ARN.'
      );
    }

    const secret = await awsProvider.getSecretValue(authConfig);
    const secretPayload = JSON.parse(secret.SecretString || '{}');
    validateSecretPayload(secretPayload);

    return {
      mechanism: 'scram-sha-512',
      username: secretPayload.username,
      password: secretPayload.password,
    };
  }

  if (typeof authConfig === 'object') {
    validateSecretPayload(authConfig);
    logger.info('Using inline Kafka authentication configuration for SASL/SCRAM-512.');
    return {
      mechanism: 'scram-sha-512',
      username: authConfig.username,
      password: authConfig.password,
    };
  }

  throw new Error('Invalid saslScram512Auth configuration. Expected an object or AWS secret ARN string.');
}

module.exports = {
  resolveSaslConfig,
};
