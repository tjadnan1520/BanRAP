import express from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware.js';
import {
  getTravellerDashboard,
  getTravellerMap,
  getTravellerRoute,
  submitTravellerFeedback,
  getTravellerNotifications,
  getMyComplaints,
  getRoadsForFeedback
} from '../controllers/travellerController.js';

const router = express.Router();

// Map endpoint is accessible by all authenticated roles (Admin, Annotator, Traveller)
router.get('/map', authMiddleware, roleMiddleware(['ADMIN', 'ANNOTATOR', 'TRAVELLER']), getTravellerMap);

// Apply traveller-only middleware to remaining routes
router.use(authMiddleware);
router.use(roleMiddleware(['TRAVELLER']));

router.get('/dashboard', getTravellerDashboard);
router.get('/route', getTravellerRoute);
router.post('/feedback', submitTravellerFeedback);
router.get('/notifications', getTravellerNotifications);
router.get('/complaints', getMyComplaints);
router.get('/roads-for-feedback', getRoadsForFeedback);

export default router;
