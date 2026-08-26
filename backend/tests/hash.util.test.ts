import { hashPassword, comparePassword } from '../src/common/utils/hash.util';

describe('hash.util', () => {
  it('hashes a password into a non-reversible bcrypt hash', async () => {
    const hash = await hashPassword('password123');

    expect(hash).not.toBe('password123');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('produces a different hash for the same password each time (salted)', async () => {
    const a = await hashPassword('password123');
    const b = await hashPassword('password123');

    expect(a).not.toBe(b);
  });

  it('compares the correct password successfully', async () => {
    const hash = await hashPassword('password123');

    await expect(comparePassword('password123', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('password123');

    await expect(comparePassword('wrong-password', hash)).resolves.toBe(false);
  });
});
