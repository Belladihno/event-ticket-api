import { generateOtpCode } from '../src/common/utils/code.util';
import { generateId } from '../src/common/utils/uuid.util';

describe('code.util', () => {
  it('generates a 6-digit numeric code by default', () => {
    const code = generateOtpCode();

    expect(code).toMatch(/^\d{6}$/);
  });

  it('honours a custom length', () => {
    expect(generateOtpCode(4)).toMatch(/^\d{4}$/);
    expect(generateOtpCode(8)).toMatch(/^\d{8}$/);
  });

  it('generates codes within the length range across many samples', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe('uuid.util', () => {
  it('generates valid UUIDv7 strings', () => {
    const id = generateId();

    // UUID v7 has the version nibble "7" and RFC variant bits ("8"–"b").
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates unique ids and time-sortable ones', () => {
    const first = generateId();
    const second = generateId();

    expect(first).not.toBe(second);
    // v7 embeds a millisecond timestamp — lexicographic order follows time.
    expect(BigInt(`0x${first.replace(/-/g, '').slice(0, 12)}`)).toBeLessThanOrEqual(
      BigInt(`0x${second.replace(/-/g, '').slice(0, 12)}`),
    );
  });
});
