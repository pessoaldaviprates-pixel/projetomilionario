import { describe, expect, it } from 'vitest';
import { formatBytes } from '@/lib/storage/format';

describe('formatBytes', () => {
  it('formata tamanhos em cada unidade', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB');
  });

  it('omite a casa decimal em valores grandes da mesma unidade', () => {
    expect(formatBytes(1024 * 15)).toBe('15 KB');
  });

  it('trata zero sem quebrar', () => {
    expect(formatBytes(0)).toBe('0 B');
  });
});
