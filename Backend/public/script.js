const API_BASE_URL = 'http://localhost:5000';

// Tab Switching
function showTab(tabName) {
  const contents = document.querySelectorAll('.tab-content');
  const buttons = document.querySelectorAll('.tab-btn');

  contents.forEach(content => content.classList.remove('active'));
  buttons.forEach(btn => btn.classList.remove('active'));

  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active');
}

// Helper Functions
function showResult(elementId, data, isSuccess = true) {
  const resultDiv = document.getElementById(elementId);
  resultDiv.classList.add('show');
  resultDiv.className = `result show ${isSuccess ? 'success' : 'error'}`;
  resultDiv.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
}

async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    return { success: false, data: { error: error.message }, status: 0 };
  }
}

// Authentication Functions
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    phone: document.getElementById('regPhone').value,
    password: document.getElementById('regPassword').value,
    confirmPassword: document.getElementById('regConfirmPassword').value,
    role: document.getElementById('regRole').value
  };

  const result = await apiCall('/api/auth/registration', 'POST', data);
  showResult('registerResult', result.data, result.success);
});

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    email: document.getElementById('loginEmail').value,
    password: document.getElementById('loginPassword').value
  };

  const result = await apiCall('/api/auth/login', 'POST', data);
  if (result.success && result.data.token) {
    showResult('loginResult', { ...result.data, message: 'Login successful! Token saved.' }, true);
    localStorage.setItem('token', result.data.token);
  } else {
    showResult('loginResult', result.data, false);
  }
});

document.getElementById('forgotForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    email: document.getElementById('forgotEmail').value
  };

  const result = await apiCall('/api/auth/forgetpassword', 'POST', data);
  showResult('forgotResult', result.data, result.success);
});

document.getElementById('resetForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    email: document.getElementById('resetEmail').value,
    otp: document.getElementById('resetOTP').value,
    newPassword: document.getElementById('resetPassword').value,
    confirmPassword: document.getElementById('resetConfirmPassword').value
  };

  const result = await apiCall('/api/auth/resetpassword', 'POST', data);
  showResult('resetResult', result.data, result.success);
});

// Traveller Functions
async function getTravellerDashboard() {
  const token = document.getElementById('travellerToken').value;
  const result = await apiCall('/api/traveller/dashboard', 'GET', null, token);
  showResult('travellerDashboardResult', result.data, result.success);
}

async function getTravellerMap() {
  const token = document.getElementById('travellerToken2').value;
  const result = await apiCall('/api/traveller/map', 'GET', null, token);
  showResult('travellerMapResult', result.data, result.success);
}

async function getTravellerRoute() {
  const token = document.getElementById('travellerToken3').value;
  const result = await apiCall('/api/traveller/route', 'GET', null, token);
  showResult('travellerRouteResult', result.data, result.success);
}

async function submitTravellerFeedback() {
  const token = document.getElementById('travellerToken4').value;
  const data = {
    roadId: document.getElementById('feedbackRoadId').value,
    feedback: document.getElementById('feedbackText').value,
    rating: parseInt(document.getElementById('feedbackRating').value)
  };

  const result = await apiCall('/api/traveller/feedback', 'POST', data, token);
  showResult('feedbackResult', result.data, result.success);
}

async function getTravellerNotifications() {
  const token = document.getElementById('travellerToken5').value;
  const result = await apiCall('/api/traveller/notifications', 'GET', null, token);
  showResult('notificationsResult', result.data, result.success);
}

// Annotator Functions
async function getAnnotatorDashboard() {
  const token = document.getElementById('annotatorToken').value;
  const result = await apiCall('/api/annotator/dashboard', 'GET', null, token);
  showResult('annotatorDashboardResult', result.data, result.success);
}

async function selectCoordinates() {
  const token = document.getElementById('annotatorToken2').value;
  const roadId = document.getElementById('roadId').value;
  const result = await apiCall(`/api/annotator/select-coordinates/${roadId}`, 'GET', null, token);
  showResult('coordinatesResult', result.data, result.success);
}

async function createLabel() {
  const token = document.getElementById('annotatorToken3').value;
  const data = {
    roadId: document.getElementById('labelRoadId').value,
    latitude: parseFloat(document.getElementById('latitude').value),
    longitude: parseFloat(document.getElementById('longitude').value,),
    description: document.getElementById('labelDescription').value,
    labelType: document.getElementById('labelType').value
  };

  const result = await apiCall('/api/annotator/create-label', 'POST', data, token);
  showResult('labelResult', result.data, result.success);
}

async function submitAnnotatorFeedback() {
  const token = document.getElementById('annotatorToken4').value;
  const data = {
    roadId: document.getElementById('annotatorFeedbackRoadId').value,
    feedback: document.getElementById('annotatorFeedbackText').value
  };

  const result = await apiCall('/api/annotator/feedback', 'POST', data, token);
  showResult('annotatorFeedbackResult', result.data, result.success);
}

// Admin Functions
async function getAdminDashboard() {
  const token = document.getElementById('adminToken').value;
  const result = await apiCall('/api/admin/dashboard', 'GET', null, token);
  showResult('adminDashboardResult', result.data, result.success);
}

async function checkFeedback() {
  const token = document.getElementById('adminToken2').value;
  const result = await apiCall('/api/admin/check-feedback', 'GET', null, token);
  showResult('checkFeedbackResult', result.data, result.success);
}

async function assignFeedback() {
  const token = document.getElementById('adminToken3').value;
  const data = {
    feedbackId: document.getElementById('feedbackId').value,
    annotatorEmail: document.getElementById('annotatorEmail').value
  };

  const result = await apiCall('/api/admin/assign-feedback', 'POST', data, token);
  showResult('assignFeedbackResult', result.data, result.success);
}

async function verifyLabel() {
  const token = document.getElementById('adminToken4').value;
  const data = {
    labelId: document.getElementById('labelIdToVerify').value,
    status: document.getElementById('verificationStatus').value,
    notes: document.getElementById('verificationNotes').value
  };

  const result = await apiCall('/api/admin/verify-label', 'POST', data, token);
  showResult('verifyLabelResult', result.data, result.success);
}

async function restrictAnnotator() {
  const token = document.getElementById('adminToken5').value;
  const data = {
    annotatorEmail: document.getElementById('restrictEmail').value,
    reason: document.getElementById('restrictReason').value
  };

  const result = await apiCall('/api/admin/restrict-annotator', 'POST', data, token);
  showResult('restrictResult', result.data, result.success);
}

async function updateMapWithLabel() {
  const token = document.getElementById('adminToken6').value;
  const labelId = document.getElementById('updateLabelId').value;
  const result = await apiCall(`/api/admin/update-map/${labelId}`, 'POST', {}, token);
  showResult('updateMapResult', result.data, result.success);
}
