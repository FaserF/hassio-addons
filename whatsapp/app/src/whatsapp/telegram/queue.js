import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../../config.js';
import { logger } from '../../logger.js';

const DLQ_FILE = path.join(DATA_DIR, 'bridge_dlq.json');

class DeadLetterQueue {
  constructor() {
    this.queue = [];
    this.timer = null;
    this.load();
  }

  load() {
    if (fs.existsSync(DLQ_FILE)) {
      try {
        const raw = fs.readFileSync(DLQ_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          this.queue = data;
        }
      } catch (e) {
        logger.error({ error: e.message }, '❌ Failed to load persistent DLQ queue');
      }
    }
  }

  save() {
    try {
      // Store serializable queue items
      const serializable = this.queue.map((item) => ({
        payload: item.payload || null,
        retries: item.retries || 3,
        attempts: item.attempts || 0,
      }));
      fs.writeFileSync(DLQ_FILE, JSON.stringify(serializable, null, 2));
    } catch (e) {
      logger.error({ error: e.message }, '❌ Failed to save persistent DLQ queue');
    }
  }

  enqueue(taskFn, retries = 3, payload = null) {
    this.queue.push({ taskFn, retries, attempts: 0, payload });
    this.save();
    this.process();
  }

  async process() {
    if (this.timer || this.queue.length === 0) return;

    const item = this.queue.shift();
    this.save();
    try {
      if (typeof item.taskFn === 'function') {
        await item.taskFn();
      }
    } catch (err) {
      item.attempts += 1;
      if (item.attempts < item.retries) {
        logger.warn(
          { attempt: item.attempts, error: err.message },
          '⚠️ Retrying failed bridge task via Dead Letter Queue'
        );
        this.queue.push(item);
        this.save();
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
