import { verifyToken } from '../utils/jwtUtils.js';

export const authMiddleware = (req, res, next) => {
  try {
    // First try to get token from cookie (preferred - secure method)
    let token = req.cookies?.authToken;
    
    // Fallback to Authorization header for backward compatibility
    if (!token) {
      token = req.headers.authorization?.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

export const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Log unauthorized access attempts to admin routes
      if (allowedRoles.includes('ADMIN')) {
        console.warn(`[SECURITY] Unauthorized admin access attempt from user: ${req.user.email}, role: ${req.user.role}`);
      }
      
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Unique constraint violation',
        field: err.meta?.target?.[0]
      });
    }
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
};
