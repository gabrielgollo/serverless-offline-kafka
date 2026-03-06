'use strict';

function validateSecretPayload(payload) {
  if (!payload || typeof payload.username !== 'string' || typeof payload.password !== 'string') {
    throw new Error(
      'Invalid authentication payload. Expected an object containing string fields "username" and "password".'
    );
  }
}

function normalizeAuthConfigInput(authConfig) {
  if (!Array.isArray(authConfig)) {
    return authConfig;
  }

  if (authConfig.length !== 1) {
    throw new Error(
      'Invalid saslScram512Auth configuration. When using an array, provide exactly one item.'
    );
  }

  return authConfig[0];
}

async function resolveSaslConfig(authConfig, serverless, logger, options = {}) {
  if (options.disableSaslAuth === true) {
    logger?.info('SASL auth is disabled by configuration. Ignoring saslScram512Auth.');
    return null;
  }

  const normalizedAuthConfig = normalizeAuthConfigInput(authConfig);

  if (!normalizedAuthConfig) {
    return null;
  }

  if (typeof normalizedAuthConfig === 'string') {
    if (!normalizedAuthConfig.includes('arn:aws:secretsmanager')) {
      throw new Error(
        'Invalid saslScram512Auth value. When using a string, an AWS Secrets Manager ARN is expected.'
      );
    }

    logger.info(`Resolving Kafka auth credentials from AWS Secrets Manager: ${normalizedAuthConfig}`);
    const awsProvider = serverless?.providers?.aws;
    if (!awsProvider || typeof awsProvider.getSecretValue !== 'function') {
      throw new Error(
        'AWS provider is not available in Serverless context. Cannot resolve SASL credentials from secret ARN.'
      );
    }

    const secret = await awsProvider.getSecretValue(normalizedAuthConfig);
    const secretPayload = JSON.parse(secret.SecretString || '{}');
    validateSecretPayload(secretPayload);

    return {
      mechanism: 'scram-sha-512',
      username: secretPayload.username,
      password: secretPayload.password,
    };
  }

  if (typeof normalizedAuthConfig === 'object') {
    validateSecretPayload(normalizedAuthConfig);
    logger.info('Using inline Kafka authentication configuration for SASL/SCRAM-512.');
    return {
      mechanism: 'scram-sha-512',
      username: normalizedAuthConfig.username,
      password: normalizedAuthConfig.password,
    };
  }

  throw new Error('Invalid saslScram512Auth configuration. Expected an object or AWS secret ARN string.');
}

module.exports = {
  resolveSaslConfig,
};
