'use strict';

class BatchAccumulator {
  constructor({ batchSize, flushWindowMs, onFlush, onError }) {
    this.batchSize = Math.max(1, batchSize || 1);
    this.flushWindowMs = Math.max(0, flushWindowMs || 0);
    this.onFlush = onFlush;
    this.onError = onError;
    this.buffer = [];
    this.timer = null;
    this.queue = Promise.resolve();
  }

  async add(record) {
    this.buffer.push(record);

    if (this.buffer.length >= this.batchSize) {
      return this.flush();
    }

    this.#scheduleFlushWindow();
    return Promise.resolve();
  }

  async flush() {
    return this.#enqueue(async () => {
      this.#clearTimer();
      if (this.buffer.length < this.batchSize) {
        this.#scheduleFlushWindow();
        return;
      }

      const batch = this.buffer.splice(0, this.batchSize);
      await this.onFlush(batch);
      this.#scheduleFlushWindow();
    });
  }

  async flushAll() {
    return this.#enqueue(async () => {
      this.#clearTimer();
      while (this.buffer.length > 0) {
        const batch = this.buffer.splice(0, this.batchSize);
        await this.onFlush(batch);
      }
    });
  }

  async close() {
    await this.flushAll();
    this.#clearTimer();
  }

  #enqueue(work) {
    this.queue = this.queue.then(work).catch((error) => {
      if (typeof this.onError === 'function') {
        this.onError(error);
      }
    });

    return this.queue;
  }

  #scheduleFlushWindow() {
    if (this.flushWindowMs <= 0 || this.timer || this.buffer.length === 0) {
      return;
    }

    this.timer = setTimeout(() => {
      this.flushAll().catch((error) => {
        if (typeof this.onError === 'function') {
          this.onError(error);
        }
      });
    }, this.flushWindowMs);

    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  #clearTimer() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}

module.exports = BatchAccumulator;
