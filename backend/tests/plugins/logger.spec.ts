import { Writable } from 'node:stream';

import Fastify from 'fastify';
import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loggerPlugin } from '../../src/plugins/logger';

class LogCollector extends Writable {
  private buffer = '';
  public readonly logs: string[] = [];

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.buffer += chunk.toString();
    let newlineIndex = this.buffer.indexOf('\n');

    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      if (line.trim().length > 0) {
        this.logs.push(line);
      }
      this.buffer = this.buffer.slice(newlineIndex + 1);
      newlineIndex = this.buffer.indexOf('\n');
    }

    callback();
  }
}

describe('logger plugin', () => {
  let app!: ReturnType<typeof Fastify>;
  let collector: LogCollector;

  beforeEach(async () => {
    collector = new LogCollector();
    const logger = pino({ level: 'info', base: undefined }, collector);

    app = Fastify({ logger });
    await app.register(loggerPlugin);

    app.get('/sensitive', async () => ({ ok: true }));

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    collector.end();
  });

  it('does not include sensitive headers in request logs', async () => {
    await app.inject({
      method: 'GET',
      url: '/sensitive',
      headers: {
        authorization: 'Bearer extremely-secret-token',
        cookie: 'refreshToken=top-secret-cookie',
      },
    });

    const entries = collector.logs.map((line) => JSON.parse(line));

    expect(entries.length).toBeGreaterThanOrEqual(2);
    entries.forEach((entry) => {
      const serialized = JSON.stringify(entry);
      expect(serialized).not.toContain('extremely-secret-token');
      expect(serialized).not.toContain('top-secret-cookie');
    });
  });
});
