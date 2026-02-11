import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import prisma from './src/config/prisma.js';
import { errorHandler } from './src/middleware/authMiddleware.js';
import { startOTPCleanupJob } from './src/utils/otpCleanup.js';
import { 
  securityHeaders, 
  securityAudit, 
  apiLimiter 
} from './src/middleware/securityMiddleware.js';

// Import routes
import authRoutes from './src/routes/authRoutes.js';
import travellerRoutes from './src/routes/travellerRoutes.js';
import annotatorRoutes from './src/routes/annotatorRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';

// Load environment variables
dotenv.config();

const app = express();

// Apply security headers first
app.use(securityHeaders);

// Apply security audit logging
app.use(securityAudit);

// Apply general rate limiting
app.use(apiLimiter);

// Middleware - CORS configuration with credentials
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5174', // Allow alt port during development
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files from public folder

// Homepage endpoint
app.get('/homepage', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to BanRAP Backend',
    description: 'Road Safety Assessment Program API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      traveller: '/api/traveller',
      annotator: '/api/annotator',
      admin: '/api/admin'
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/traveller', travellerRoutes);
app.use('/api/annotator', annotatorRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✓ Database connected successfully');

    // Start OTP cleanup job
    const cleanupJobId = startOTPCleanupJob();
    console.log('✓ OTP cleanup job started');

    app.listen(PORT, () => {
      console.log(`✓ Server is running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV}`);
      console.log(`

  Homepage: http://localhost:${PORT}/homepage       
  Health: http://localhost:${PORT}/health            
      `);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n✓ Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Catch unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

startServer();

export default app;
