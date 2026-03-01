'use strict';

const { LOG_PREFIX } = require('./constants');

class Logger {
  constructor(serverless) {
    this.serverless = serverless;
  }

  info(message) {
    this.serverless.cli.log(`${LOG_PREFIX} ${message}`);
  }

  warn(message) {
    this.serverless.cli.log(`${LOG_PREFIX} [warn] ${message}`);
  }

  error(message) {
    this.serverless.cli.log(`${LOG_PREFIX} [error] ${message}`);
  }
}

module.exports = Logger;
