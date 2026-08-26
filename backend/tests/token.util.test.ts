import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/common/utils/token.util';
import { config } from '../src/config/app.config';

const payload = { userId: '0196-abc', role: 'customer' };

describe('token.util', () => {
  it('round-trips an access token payload', () => {
    const token = signAccessToken(payload);

    expect(verifyAccessToken(token)).toMatchObject(payload);
  });

  it('round-trips a refresh token payload', () => {
    const token = signRefreshToken(payload);

    expect(verifyRefreshToken(token)).toMatchObject(payload);
  });

  it('signs access and refresh tokens with different secrets', () => {
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // A token signed with one secret must not verify against the other.
    expect(() => verifyAccessToken(refreshToken)).toThrow();
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });

  it('rejects tokens signed with a foreign secret', () => {
    const forged = jwt.sign(payload, 'not-the-real-secret');

    expect(() => verifyAccessToken(forged)).toThrow('invalid signature');
  });

  it('rejects expired access tokens', () => {
    const expired = jwt.sign(payload, config.jwt.accessSecret, { expiresIn: -10 });

    expect(() => verifyAccessToken(expired)).toThrow('jwt expired');
  });

  it('rejects malformed tokens', () => {
    expect(() => verifyAccessToken('garbage')).toThrow();
  });
});
