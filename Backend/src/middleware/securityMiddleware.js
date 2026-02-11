import rateLimit from 'express-rate-limit';

// Login rate limiter - strict protection against brute force
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
  handler: (req, res) => {
    console.log(`⚠️  [SECURITY] Brute force attempt detected from IP: ${req.ip}, Email: ${req.body?.email}`);
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again after 15 minutes.'
    });
  }
});

// Registration rate limiter - prevent spam registrations
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour per IP
  message: {
    success: false,
    message: 'Too many registration attempts from this IP. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`⚠️  [SECURITY] Spam registration attempt from IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many registration attempts from this IP. Please try again later.'
    });
  }
});

// General API rate limiter - prevent DDoS
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check and homepage
    return req.path === '/health' || req.path === '/homepage';
  }
});

// Security headers middleware
export const securityHeaders = (req, res, next) => {
  // Disable X-Powered-By header to avoid exposing framework
  res.removeHeader('X-Powered-By');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'"
  );
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // HSTS (HTTP Strict Transport Security) - only in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

// Request logging middleware for security auditing
export const securityAudit = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  const ip = req.ip;
  
  // Log authentication attempts
  if (path === '/api/auth/login' && method === 'POST') {
    const email = req.body?.email || 'unknown';
    console.log(`[AUTH] Login attempt from ${ip} for ${email} at ${timestamp}`);
  }
  
  // Log admin access attempts
  if (path.startsWith('/api/admin') && method !== 'GET') {
    const user = req.user?.email || 'unauthenticated';
    const role = req.user?.role || 'unknown';
    console.log(`[ADMIN] Access from ${user} (${role}) via ${ip} at ${timestamp}: ${method} ${path}`);
  }
  
  next();
};

// Error handler with security in mind (don't expose stack traces to client)
export const secureErrorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err);
  
  // Don't send stack traces to client
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction ? 'Internal server error' : err.message;
  
  res.status(err.status || 500).json({
    success: false,
    message: errorMessage,
    ...(isProduction ? {} : { error: err.stack })
  });
};
