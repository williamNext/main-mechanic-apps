import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/index.js';

const VALID_SECRET = 'a'.repeat(32);

describe('loadConfig', () => {
  it('throws naming DB_PATH when DB_PATH is missing', () => {
    expect(() =>
      loadConfig({ JWT_SECRET: VALID_SECRET }),
    ).toThrowError(/DB_PATH/);
  });

  it('throws naming JWT_SECRET when JWT_SECRET is missing', () => {
    expect(() =>
      loadConfig({ DB_PATH: './data/dev.sqlite' }),
    ).toThrowError(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is 31 characters, succeeds at 32', () => {
    expect(() =>
      loadConfig({ DB_PATH: './data/dev.sqlite', JWT_SECRET: 'a'.repeat(31) }),
    ).toThrowError(/JWT_SECRET/);

    expect(() =>
      loadConfig({ DB_PATH: './data/dev.sqlite', JWT_SECRET: 'a'.repeat(32) }),
    ).not.toThrow();
  });

  it('defaults PORT to 3000 when omitted, coerces string to number when supplied', () => {
    const withoutPort = loadConfig({ DB_PATH: './data/dev.sqlite', JWT_SECRET: VALID_SECRET });
    expect(withoutPort.PORT).toBe(3000);

    const withPort = loadConfig({
      DB_PATH: './data/dev.sqlite',
      JWT_SECRET: VALID_SECRET,
      PORT: '8080',
    });
    expect(withPort.PORT).toBe(8080);
  });

  it('defaults JWT_EXPIRY_SECONDS to 2592000 when omitted', () => {
    const config = loadConfig({ DB_PATH: './data/dev.sqlite', JWT_SECRET: VALID_SECRET });
    expect(config.JWT_EXPIRY_SECONDS).toBe(2592000);
  });
});
