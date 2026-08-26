process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.QR_SIGNING_SECRET = process.env.QR_SIGNING_SECRET || 'test-qr-signing-secret';
process.env.NODE_ENV = 'test';

export {};
