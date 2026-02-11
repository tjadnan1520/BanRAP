import express from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware.js';
import {
  getAdminDashboard,
  getAdminMap,
  restrictAnnotator,
  checkFeedback,
  assignFeedbackToAnnotator,
  verifyLabel,
  updateMapWithLabel,
  submitAdminFeedback,
  getAdminRoute,
  seedTestData,
  getPendingLabelsForReview,
  approveLabelReview,
  rejectLabelReview,
  getSuspendedAnnotators,
  addTrainingRemarks,
  reactivateAnnotator,
  getAllAnnotators,
  getRoadRating
} from '../controllers/adminController.js';

const router = express.Router();

// Strict protection: Admin routes require both authentication AND authorization
// All routes must be explicitly called by authenticated admin users only
router.use((req, res, next) => {
  // Check if user is trying to access admin routes without auth
  if (!req.headers.authorization && !req.cookies?.authToken) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  next();
});

// Apply auth middleware to all admin routes
router.use(authMiddleware);

// Apply strict role middleware - only ADMIN role allowed
router.use(roleMiddleware(['ADMIN']));

// Secure admin endpoints - protected by middleware above
router.get('/dashboard', getAdminDashboard);
router.get('/map', getAdminMap);
router.post('/restrict', restrictAnnotator);
router.get('/checkfeedback', checkFeedback);
router.post('/checkfeedback/assign', assignFeedbackToAnnotator);
router.post('/verifylabel', verifyLabel);
router.post('/updatemap', updateMapWithLabel);
router.get('/route', getAdminRoute);
router.post('/feedback', submitAdminFeedback);
router.post('/seed-test-data', seedTestData);

// Label review endpoints
router.get('/labels/pending', getPendingLabelsForReview);
router.post('/labels/approve', approveLabelReview);
router.post('/labels/reject', rejectLabelReview);

// Feedback/Complaint endpoints
router.get('/feedback', checkFeedback);
router.post('/assign-feedback', assignFeedbackToAnnotator);

// Annotator management endpoints (suspended/penalty)
router.get('/annotators/suspended', getSuspendedAnnotators);
router.get('/annotators', getAllAnnotators);
router.get('/annotators/all', getAllAnnotators);
router.post('/annotators/training-remarks', addTrainingRemarks);
router.post('/annotators/reactivate', reactivateAnnotator);

// Road rating endpoint
router.get('/road/:roadID/rating', getRoadRating);

export default router;
