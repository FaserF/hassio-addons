import { logger } from '../../logger.js';

class DeadLetterQueue {
  constructor() {
    this.queue = [];
    this.timer = null;
  }

  enqueue(taskFn, retries = 3) {
    this.queue.push({ taskFn, retries, attempts: 0 });
    this.process();
  }

  async process() {
    if (this.timer || this.queue.length === 0) return;

    const item = this.queue.shift();
    try {
      await item.taskFn();
    } catch (err) {
      item.attempts += 1;
      if (item.attempts < item.retries) {
        logger.warn(
          { attempt: item.attempts, error: err.message },
          '⚠️ Retrying failed bridge task via Dead Letter Queue'
        );
        this.queue.push(item);
      } else {
        logger.error(
          { error: err.message },
          '❌ Bridge task failed permanently after maximum retries'
        );
      }
    }

    if (this.queue.length > 0) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.process();
      }, 2000);
    }
  }
}

export const dlq = new DeadLetterQueue();
