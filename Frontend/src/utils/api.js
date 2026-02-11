/**
 * API Service for BanRAP Frontend
 * Handles all HTTP requests to the backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * Make an API request
 * @param {string} endpoint - API endpoint path (e.g., '/api/auth/login')
 * @param {object} options - Request options (method, body, headers)
 * @returns {Promise<object>} - API response
 */
const apiRequest = async (endpoint, options = {}) => {
  const { method = 'GET', body = null, headers = {} } = options;

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    credentials: 'include' // Enable sending cookies with requests
  };

  // Add Authorization header if token exists in localStorage
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // Add body for POST, PUT, PATCH requests
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.body = JSON.stringify(body);
  }

  try {
    console.log(`[API] ${method} ${endpoint}`, { body });
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    console.log(`[API Response] ${method} ${endpoint} - Status: ${response.status}`, { data });

    if (!response.ok) {
      console.error(`[API Error] ${method} ${endpoint} - ${response.status}:`, data);
      throw {
        status: response.status,
        message: data.message || 'An error occurred',
        data
      };
    }

    return data;
  } catch (error) {
    console.error(`[API Error] ${method} ${endpoint}:`, error);
    throw error;
  }
};

/**
 * Authentication Endpoints
 */
export const authAPI = {
  // Register a new user
  register: (userData) => 
    apiRequest('/api/auth/registration', {
      method: 'POST',
      body: {
        email: userData.email,
        name: userData.name,
        phone: userData.phone || '',
        password: userData.password,
        confirmPassword: userData.confirmPassword,
        role: userData.role
      }
    }),

  // Verify registration OTP
  verifyRegistrationOTP: (email, phone, otp, password, name, role) =>
    apiRequest('/api/auth/verify-registration-otp', {
      method: 'POST',
      body: { email, phone, otp, password, name, role }
    }),

  // Login user
  login: (email, password) =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    }),

  // Logout user
  logout: () =>
    apiRequest('/api/auth/logout', {
      method: 'POST'
    }),

  // Forgot password
  forgotPassword: (email, phone) =>
    apiRequest('/api/auth/forgetpassword', {
      method: 'POST',
      body: { email, phone }
    }),

  // Reset password
  resetPassword: (email, otp, newPassword, confirmPassword) =>
    apiRequest('/api/auth/resetpassword', {
      method: 'POST',
      body: { email, otp, newPassword, confirmPassword }
    })
};

/**
 * Traveller Endpoints
 */
export const travellerAPI = {
  // Get traveller dashboard data
  getDashboard: () =>
    apiRequest('/api/traveller/dashboard'),

  // Get all roads and segments for selection
  getRoads: () =>
    apiRequest('/api/traveller/map'),

  // Get roads with coordinates for feedback map
  getRoadsForFeedback: () =>
    apiRequest('/api/traveller/roads-for-feedback'),

  // Get road details by segment ID
  getRoadDetails: (segmentID) =>
    apiRequest(`/api/traveller/route?segmentID=${segmentID}`),

  // Get road ratings
  getRoadRatings: () =>
    apiRequest('/api/traveller/ratings'),

  // Submit road feedback/complaint
  submitFeedback: (feedbackData) =>
    apiRequest('/api/traveller/feedback', {
      method: 'POST',
      body: feedbackData
    }),

  // Get my complaints history
  getMyComplaints: () =>
    apiRequest('/api/traveller/complaints'),

  // Get notifications
  getNotifications: () =>
    apiRequest('/api/traveller/notifications'),

  // Get user profile
  getProfile: () =>
    apiRequest('/api/traveller/profile')
};

/**
 * Annotator Endpoints
 */
export const annotatorAPI = {
  // Get annotation dashboard
  getDashboard: () =>
    apiRequest('/api/annotator/dashboard'),

  // Get roads to annotate
  getRoadsToAnnotate: () =>
    apiRequest('/api/annotator/roads'),

  // Submit annotation
  submitAnnotation: (roadId, annotationData) =>
    apiRequest(`/api/annotator/roads/${roadId}/annotate`, {
      method: 'POST',
      body: annotationData
    }),

  // Submit label for a segment
  submitLabel: (labelData) =>
    apiRequest('/api/annotator/label', {
      method: 'POST',
      body: labelData
    }),

  // Get annotation statistics
  getStatistics: () =>
    apiRequest('/api/annotator/statistics'),

  // Get notifications
  getNotifications: () =>
    apiRequest('/api/annotator/notifications'),

  // Mark notification as read
  markNotificationRead: (notificationID) =>
    apiRequest('/api/annotator/notifications/read', {
      method: 'POST',
      body: { notificationID }
    }),

  // Get assigned complaints
  getAssignedComplaints: () =>
    apiRequest('/api/annotator/complaints'),

  // Get complaint details
  getComplaintDetails: (feedbackID) =>
    apiRequest(`/api/annotator/complaints/${feedbackID}`),

  // Submit label for complaint (relabeling)
  submitComplaintLabel: (data) =>
    apiRequest('/api/annotator/complaints/label', {
      method: 'POST',
      body: data
    })
};

/**
 * Admin Endpoints
 */
export const adminAPI = {
  // Get admin dashboard
  getDashboard: () =>
    apiRequest('/api/admin/dashboard'),

  // Get all users
  getUsers: () =>
    apiRequest('/api/admin/users'),

  // Get all roads
  getRoads: () =>
    apiRequest('/api/admin/roads'),

  // Get system statistics
  getStatistics: () =>
    apiRequest('/api/admin/statistics'),

  // Approve/reject annotations
  reviewAnnotation: (annotationId, status) =>
    apiRequest(`/api/admin/annotations/${annotationId}`, {
      method: 'PUT',
      body: { status }
    }),

  // Get pending labels for review
  getPendingLabels: () =>
    apiRequest('/api/admin/labels/pending'),

  // Approve label review (with optional feedbackID for complaint resolution)
  approveLabel: (labelID, feedbackID = null) =>
    apiRequest('/api/admin/labels/approve', {
      method: 'POST',
      body: { labelID, feedbackID }
    }),

  // Reject label review
  rejectLabel: (labelID, remarks) =>
    apiRequest('/api/admin/labels/reject', {
      method: 'POST',
      body: { labelID, remarks }
    }),

  // Get all complaints/feedbacks
  getComplaints: (status = null) =>
    apiRequest(`/api/admin/feedback${status ? `?status=${status}` : ''}`),

  // Assign complaint to annotator
  assignComplaint: (feedbackID, annotatorEmail, priority = 1, adminRemarks = null) =>
    apiRequest('/api/admin/assign-feedback', {
      method: 'POST',
      body: { feedbackID, annotatorEmail, priority, adminRemarks }
    }),

  // Get all annotators
  getAllAnnotators: () =>
    apiRequest('/api/admin/annotators'),

  // Get suspended annotators
  getSuspendedAnnotators: () =>
    apiRequest('/api/admin/annotators/suspended'),

  // Get road star rating
  getRoadRating: (roadID) =>
    apiRequest(`/api/admin/road/${roadID}/rating`)
};

/**
 * Generic API object for simple get/post operations
 */
export const api = {
  get: (endpoint) =>
    apiRequest(endpoint, { method: 'GET' }),

  post: (endpoint, body) =>
    apiRequest(endpoint, { method: 'POST', body }),

  put: (endpoint, body) =>
    apiRequest(endpoint, { method: 'PUT', body }),

  delete: (endpoint) =>
    apiRequest(endpoint, { method: 'DELETE' })
};

/**
 * Health check
 */
export const healthCheck = () =>
  apiRequest('/health');

export default {
  authAPI,
  travellerAPI,
  annotatorAPI,
  adminAPI,
  healthCheck,
  apiRequest
};
