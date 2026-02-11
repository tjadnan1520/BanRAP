import express from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware.js';
import {
  getSampleRoads,
  getAnnotatorDashboard,
  getAnnotatorMap,
  selectCoordinatesForLabeling,
  createRoadWithSegments,
  createLabel,
  submitAnnotatorFeedback,
  getAnnotatorRoute,
  getNotifications,
  markNotificationAsRead,
  getAssignedComplaints,
  getComplaintDetails,
  submitComplaintLabel
} from '../controllers/annotatorController.js';

const router = express.Router();

// Public endpoint (no authentication required)
router.get('/roads', getSampleRoads);

// Apply auth middleware to protected annotator routes
router.use(authMiddleware);
router.use(roleMiddleware(['ANNOTATOR']));

router.get('/dashboard', getAnnotatorDashboard);
router.get('/map', getAnnotatorMap);
router.post('/map/select-coordinates', selectCoordinatesForLabeling);
router.post('/map/create-road', createRoadWithSegments);
router.post('/map/label', createLabel);
router.post('/label', createLabel);
router.get('/route', getAnnotatorRoute);
router.post('/feedback', submitAnnotatorFeedback);

// Notification endpoints
router.get('/notifications', getNotifications);
router.post('/notifications/read', markNotificationAsRead);

// Complaint handling endpoints
router.get('/complaints', getAssignedComplaints);
router.get('/complaints/:feedbackID', getComplaintDetails);
router.post('/complaints/label', submitComplaintLabel);

export default router;
