import dotenv from 'dotenv';

dotenv.config();

export const config = {
  database: {
    url: process.env.DATABASE_URL
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRE || '7d'
  },
  server: {
    port: process.env.PORT || 5000,
    environment: process.env.NODE_ENV || 'development'
  },
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS
  },
  api: {
    googleMapsKey: process.env.GOOGLE_MAPS_API_KEY
  }
};

export const isDevelopment = config.server.environment === 'development';
export const isProduction = config.server.environment === 'production';
