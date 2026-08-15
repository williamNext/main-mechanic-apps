import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAdminFilters } from '../../src/admin/filters.js';
import { HttpError, type ErrorCode } from '../../src/errors.js';

describe('parseAdminFilters', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to the current Sao Paulo month through today', () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-15T15:30:00.000Z');

    const filters = parseAdminFilters({});

    expect({ from: filters.from, to: filters.to }).toEqual({ from: '2026-08-01', to: '2026-08-15' });
  });

  it('uses the previous Sao Paulo day when UTC has crossed midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-01T01:30:00.000Z');

    const filters = parseAdminFilters({});

    expect({ from: filters.from, to: filters.to }).toEqual({ from: '2026-07-01', to: '2026-07-31' });
  });

  it('rejects an inverted range with INVALID_DATE_RANGE mapped to 400', () => {
    const code: ErrorCode = 'INVALID_DATE_RANGE';

    try {
      parseAdminFilters({ from: '2026-08-16', to: '2026-08-15' });
      expect.fail('expected parseAdminFilters to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ status: 400, message: 'invalid date range', code });
    }
  });

  it('defaults page to 1 and pageSize to 20', () => {
    const filters = parseAdminFilters({ from: '2026-08-01', to: '2026-08-15' });

    expect({ page: filters.page, pageSize: filters.pageSize }).toEqual({ page: 1, pageSize: 20 });
    expect({ status: filters.status, search: filters.search }).toEqual({ status: 'all', search: '' });
  });

  it('caps pageSize at 100', () => {
    const filters = parseAdminFilters({ from: '2026-08-01', to: '2026-08-15', pageSize: '500' });

    expect(filters.pageSize).toBe(100);
  });

  it('accepts seeded mechanic ids as trimmed opaque strings', () => {
    const filters = parseAdminFilters({
      from: '2026-08-01',
      to: '2026-08-15',
      mechanicId: '  seed-mechanic-1  ',
    });

    expect(filters.mechanicId).toBe('seed-mechanic-1');
  });

  it('rejects an empty mechanicId after trimming', () => {
    expect(() =>
      parseAdminFilters({ from: '2026-08-01', to: '2026-08-15', mechanicId: '   ' }),
    ).toThrowError(HttpError);
  });

  it('rejects a malformed pageSize instead of clamping it upward', () => {
    expect(() => parseAdminFilters({ from: '2026-08-01', to: '2026-08-15', pageSize: '0' })).toThrowError(HttpError);
  });

  it.each(['zero', 'negative', 'non-numeric'] as const)('rejects a %s malformed page value', (kind) => {
    const page = kind === 'zero' ? '0' : kind === 'negative' ? '-1' : 'many';

    try {
      parseAdminFilters({ from: '2026-08-01', to: '2026-08-15', page });
      expect.fail('expected parseAdminFilters to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    }
  });
});
