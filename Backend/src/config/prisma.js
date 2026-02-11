import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'error'
    }
  ]
});

prisma.$on('error', (e) => {
  console.error('Prisma error:', e);
});

// Bangladesh Timezone: UTC+6 (Asia/Dhaka)
const BANGLADESH_TIMEZONE = 'Asia/Dhaka';

// Helper function to convert UTC date to Bangladesh timezone
export const toBangladeshTime = (date) => {
  if (!date) return null;
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return new Date(date.toLocaleString('en-US', { timeZone: BANGLADESH_TIMEZONE }));
};

// Helper function to format date in Bangladeshi format
export const formatBangladeshDate = (date) => {
  if (!date) return null;
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return date.toLocaleString('en-GB', { 
    timeZone: BANGLADESH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

// Middleware to convert all DateTime fields to Bangladesh timezone on query results
prisma.$use(async (params, next) => {
  const result = await next(params);
  
  // Function to recursively convert date fields
  const convertDates = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => convertDates(item));
    }
    
    const converted = { ...obj };
    for (const key of Object.keys(converted)) {
      const value = converted[key];
      if (value instanceof Date) {
        // Convert to Bangladesh timezone and return as ISO string with offset
        converted[key] = new Date(value.getTime() + (6 * 60 * 60 * 1000)); // Add 6 hours for UTC+6
      } else if (value && typeof value === 'object') {
        converted[key] = convertDates(value);
      }
    }
    return converted;
  };
  
  return convertDates(result);
});

export default prisma;
