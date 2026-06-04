import dotenv from 'dotenv';
dotenv.config();

export const SECURITY_CONFIG = {
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_12345',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_12345',
  JWT_ACCESS_EXPIRY: '15m',
  JWT_REFRESH_EXPIRY: '7d',
  JWT_REFRESH_COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  BCRYPT_ROUNDS: 12,
  PASSWORD_MIN_LENGTH: 8,
};
