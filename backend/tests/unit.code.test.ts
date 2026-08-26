import { generateOtpCode } from '../src/common/utils/code.util';

describe('code.util.generateOtpCode', () => {
  it('generates a 6-digit numeric string by default', () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generates codes of requested length', () => {
    expect(generateOtpCode(4)).toMatch(/^\d{4}$/);
    expect(generateOtpCode(8)).toMatch(/^\d{8}$/);
  });

  it('produces different codes on successive calls (random)', () => {
    const set = new Set(Array.from({ length: 20 }, () => generateOtpCode()));
    expect(set.size).toBeGreaterThan(1);
  });

  it('never generates a code with leading zero for 6 digits (range 100000-999999)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtpCode(6);
      expect(code[0]).not.toBe('0');
      expect(parseInt(code, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code, 10)).toBeLessThan(1000000);
    }
  });
});
