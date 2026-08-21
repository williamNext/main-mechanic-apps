import { describe, expect, test } from 'vitest';

import { Colors, getStatusColor } from '../src';

describe('getStatusColor', () => {
  test.each([
    ['confirmado', '#181f21'],
    ['nao_finalizado', '#ff6b00'],
    ['acabado', '#e8e8e8'],
    ['cancelado', '#ba1a1a'],
    ['desconhecido', '#747879'],
  ])('maps %s to %s', (status, expected) => {
    expect(getStatusColor(status, Colors.light)).toBe(expected);
  });
});
