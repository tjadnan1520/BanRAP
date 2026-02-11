import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/AnalystDashboard.css';
import { annotatorAPI } from '../utils/api.js';
import SafetyNavigation from './SafetyNavigation';
import SafetyMap from './SafetyMap';

const AnalystDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('labeling');
  const [currentUser, setCurrentUser] = useState(null);
  const [labeledRoads, setLabeledRoads] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [assignedComplaints, setAssignedComplaints] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Navigation state
  const [navigationData, setNavigationData] = useState({
    startLocation: '',
    endLocation: '',
    realTimeAlerts: false,
  });

  const [navigationStarted, setNavigationStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Safety Map State
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [roads, setRoads] = useState([]);

  // Check if user is logged in and is annotator
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (!user) {
      navigate('/login');
      return;
    }
    
    const userData = JSON.parse(user);
    if (userData.role !== 'ANNOTATOR') {
      navigate('/');
      return;
    }
    
    setCurrentUser(userData);
    loadDashboardData();
  }, [navigate]);

  // Refresh data when coming from labeling
  useEffect(() => {
    if (location.state?.refreshData) {
      loadDashboardData();
    }
  }, [location.state]);

  // Load dashboard data from API
  const loadDashboardData = async () => {
    try {
      const response = await annotatorAPI.getDashboard();
      setLabeledRoads(response.data?.labeledRoads || []);
      setComplaints(response.data?.complaints || []);
      // Load roads for safety map
      loadRoads();
      // Load assigned complaints
      loadAssignedComplaints();
      // Load notifications
      loadNotifications();
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Initialize with empty data if API fails
      setLabeledRoads([]);
      setComplaints([]);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Load assigned complaints from API
  const loadAssignedComplaints = async () => {
    try {
      setComplaintsLoading(true);
      const response = await annotatorAPI.getAssignedComplaints();
      if (response.success) {
        setAssignedComplaints(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load assigned complaints:', error);
      setAssignedComplaints([]);
    } finally {
      setComplaintsLoading(false);
    }
  };

  // Load notifications
  const loadNotifications = async () => {
    try {
      const response = await annotatorAPI.getNotifications();
      if (response.success) {
        setNotifications(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  // Handle relabel complaint - navigate to labeling with pre-selected road/segment
  const handleRelabelComplaint = (complaint) => {
    // Navigate to road labeling with complaint data
    navigate('/road-labeling', {
      state: {
        complaintData: {
          feedbackID: complaint.feedbackID,
          roadID: complaint.roadID,
          segmentID: complaint.segmentID,
          roadName: complaint.road?.roadName || complaint.roadName,
          segmentLabel: complaint.segment?.segmentLabel || complaint.segmentLabel,
          coordinates: complaint.coordinates,
          adminRemarks: complaint.adminRemarks,
          description: complaint.description || complaint.comment
        }
      }
    });
  };

  // Load all available roads for safety map
  const loadRoads = async () => {
    try {
      const response = await annotatorAPI.getRoadsToAnnotate();
      setRoads(response.data || []);
    } catch (error) {
      console.error('Failed to load roads:', error);
      setRoads([]);
    }
  };

  // Load Google Maps API
  const loadGoogleMaps = () => {
    if (window.google && window.google.maps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('Google Maps API loaded');
      setMapLoaded(true);
    };
    
    script.onerror = () => {
      console.error('Failed to load Google Maps API');
    };
    
    document.head.appendChild(script);
  };

  // Initialize safety map
  const initializeSafetyMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) return;
    if (mapInstance.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setTimeout(() => initializeSafetyMap(), 300);
      return;
    }

    try {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 23.8103, lng: 90.4125 },
        zoom: 12,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: false,
      });

      addSafetyMarkers();
    } catch (error) {
      console.error('Error creating map:', error);
    }
  };

  // Add safety markers for roads
  const addSafetyMarkers = () => {
    if (!mapInstance.current) return;

    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    roads.forEach(road => {
      if (road.segments) {
        road.segments.forEach(segment => {
          const lat = segment.latitude || road.latitude || 23.8103 + (Math.random() - 0.5) * 0.1;
          const lng = segment.longitude || road.longitude || 90.4125 + (Math.random() - 0.5) * 0.1;
          
          const safetyRating = segment.safetyRating || segment.averageRating || Math.random() * 5;
          let markerColor;
          if (safetyRating >= 4) {
            markerColor = 'green';
          } else if (safetyRating >= 2.5) {
            markerColor = 'orange';
          } else {
            markerColor = 'red';
          }

          const marker = new window.google.maps.Marker({
            position: { lat, lng },
            map: mapInstance.current,
            title: `${road.roadName} - ${segment.segmentName || 'Segment'}`,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: markerColor,
              fillOpacity: 0.8,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 10
            }
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 10px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; color: #0066cc;">${road.roadName}</h3>
                <p style="margin: 4px 0;"><strong>Segment:</strong> ${segment.segmentName || 'N/A'}</p>
                <p style="margin: 4px 0;"><strong>Safety Rating:</strong> ${safetyRating.toFixed(1)} / 5.0</p>
                <p style="margin: 4px 0; color: ${markerColor};"><strong>Status:</strong> ${safetyRating >= 4 ? 'Safe' : safetyRating >= 2.5 ? 'Moderate' : 'Caution'}</p>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(mapInstance.current, marker);
          });

          markersRef.current.push(marker);
        });
      }
    });
  };

  // Initialize map when safety-map tab is active
  useEffect(() => {
    if (activeTab === 'safety-map') {
      loadGoogleMaps();
    }
  }, [activeTab]);

  // Initialize map after Google Maps is loaded and tab is active
  useEffect(() => {
    if (activeTab === 'safety-map' && mapLoaded) {
      setTimeout(() => initializeSafetyMap(), 300);
    }
  }, [activeTab, mapLoaded]);

  // Update markers when roads data changes
  useEffect(() => {
    if (activeTab === 'safety-map' && mapInstance.current && roads.length > 0) {
      addSafetyMarkers();
    }
  }, [roads, activeTab]);

  // Handle image upload for feedback
  const handleNavigationChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNavigationData({
      ...navigationData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  // Submit navigation
  const handleNavigationSubmit = async (e) => {
    e.preventDefault();

    if (!navigationData.startLocation.trim()) {
      setMessage({ type: 'error', text: 'Please enter start location' });
      return;
    }

    if (!navigationData.endLocation.trim()) {
      setMessage({ type: 'error', text: 'Please enter destination' });
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      setTimeout(() => {
        setMessage({
          type: 'success',
          text: `Navigation started from ${navigationData.startLocation} to ${navigationData.endLocation}.`,
        });
        setNavigationStarted(true);
        setLoading(false);

        // Reset after 2 seconds
        setTimeout(() => {
          setNavigationData({
            startLocation: '',
            endLocation: '',
            realTimeAlerts: false,
          });
          setNavigationStarted(false);
          setMessage({ type: '', text: '' });
        }, 2000);
      }, 1000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Error starting navigation. Please try again.' });
      setLoading(false);
    }
  };

  const handleStartLabeling = () => {
    navigate('/road-labeling');
  };

  const handleResolveComplaint = (complaintId) => {
    setComplaints(complaints.map(c => 
      c.id === complaintId ? { ...c, status: 'resolved' } : c
    ));
  };

  if (!currentUser) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="analyst-dashboard-container">
      <div className="dashboard-content">
        <div className="dashboard-header">
          <h1>📊 Analyst Dashboard</h1>
          <p>Welcome, {currentUser.firstName}! Manage road labeling and complaints</p>
        </div>

        {/* Tab Navigation */}
        <div className="dashboard-tabs">
          <button
            className={`tab-button ${activeTab === 'navigation' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('navigation');
              setMessage({ type: '', text: '' });
            }}
          >
            Safety Navigation
          </button>
          <button
            className={`tab-button ${activeTab === 'labeling' ? 'active' : ''}`}
            onClick={() => setActiveTab('labeling')}
          >
            Road Labeling
          </button>
          <button
            className={`tab-button ${activeTab === 'complaints' ? 'active' : ''}`}
            onClick={() => setActiveTab('complaints')}
          >
            Complaints & Remarks
          </button>
          <button
            className={`tab-button ${activeTab === 'safety-map' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('safety-map');
              setMessage({ type: '', text: '' });
            }}
          >
            View Safety Map
          </button>
        </div>

        {message.text && (
          <div className={`dashboard-message ${message.type}-box`}>
            {message.text}
          </div>
        )}

        {/* Safety Aware Navigation Tab */}
        {activeTab === 'navigation' && (
          <SafetyNavigation />
        )}

        {/* Road Labeling Tab */}
        {activeTab === 'labeling' && (
          <div className="tab-content labeling-content">
            <div className="labeling-header">
              <h2>Road Labeling Management</h2>
              <p>Select and label road segments with detailed information</p>
            </div>

            <div className="labeling-grid">
              {/* Start Labeling Card */}
              <div className="labeling-card">
                <h3>Start New Labeling</h3>
                <p>Begin labeling a new road segment with 3D and 2D maps</p>
                <button className="action-button" onClick={handleStartLabeling}>
                  Start Labeling
                </button>
              </div>

              {/* Recent Labels Card */}
              <div className="labeling-card">
                <h3>Recent Labeled Roads</h3>
                <p>{labeledRoads.length} roads labeled this month</p>
                <div className="recent-list">
                  {labeledRoads.length === 0 ? (
                    <p className="empty-message">No labeled roads yet</p>
                  ) : (
                    labeledRoads.map((road) => (
                      <div key={road.id} className="recent-item">
                        <span>{road.name}</span>
                        <span className="date">{road.date}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Statistics Card */}
              <div className="labeling-card">
                <h3>Labeling Statistics</h3>
                <div className="stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Roads</span>
                    <span className="stat-value">{labeledRoads.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Pending Review</span>
                    <span className="stat-value">{labeledRoads.filter(r => r.status === 'pending').length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Completed</span>
                    <span className="stat-value">{labeledRoads.filter(r => r.status === 'verified').length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="tab-content complaints-content">
            <div className="complaints-header">
              <h2>📢 Assigned Complaints</h2>
              <p>Road issues assigned to you for relabeling</p>
              <button 
                className="refresh-btn" 
                onClick={loadAssignedComplaints}
                disabled={complaintsLoading}
              >
                🔄 Refresh
              </button>
            </div>

            {complaintsLoading ? (
              <div className="loading-state">Loading complaints...</div>
            ) : assignedComplaints.length === 0 ? (
              <div className="empty-state">
                <p>✓ No assigned complaints. Great job!</p>
              </div>
            ) : (
              <div className="assigned-complaints-grid">
                {assignedComplaints.map((complaint) => (
                  <div
                    key={complaint.feedbackID}
                    className={`assigned-complaint-card ${complaint.status?.toLowerCase()}`}
                  >
                    <div className="complaint-card-header">
                      <h3>{complaint.road?.roadName || complaint.roadName || 'Unknown Road'}</h3>
                      <span className={`status-badge ${complaint.status?.toLowerCase()}`}>
                        {complaint.status === 'IN_PROGRESS' ? '🔄 In Progress' : 
                         complaint.status === 'RESOLVED' ? '✓ Resolved' : '⏳ Pending'}
                      </span>
                    </div>
                    
                    <div className="complaint-card-body">
                      <div className="complaint-info">
                        <p><strong>Segment:</strong> {complaint.segment?.segmentLabel || complaint.segmentLabel || 'N/A'}</p>
                        <p><strong>Reported By:</strong> {complaint.user?.email || 'Unknown'}</p>
                        <p><strong>Date:</strong> {new Date(complaint.createdAt).toLocaleDateString()}</p>
                      </div>
                      
                      <div className="complaint-description-box">
                        <strong>Issue Description:</strong>
                        <p>{complaint.description || complaint.comment || 'No description provided'}</p>
                      </div>
                      
                      {complaint.adminRemarks && (
                        <div className="admin-remarks-box">
                          <strong>Admin Remarks:</strong>
                          <p>{complaint.adminRemarks}</p>
                        </div>
                      )}
                    </div>
                    
                    {complaint.status !== 'RESOLVED' && (
                      <div className="complaint-card-actions">
                        <button
                          className="relabel-btn"
                          onClick={() => handleRelabelComplaint(complaint)}
                        >
                          🏷️ Relabel This Road
                        </button>
                      </div>
                    )}
                    
                    {complaint.status === 'RESOLVED' && (
                      <div className="resolved-banner">
                        ✅ This complaint has been resolved
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Notifications Section */}
            {notifications.length > 0 && (
              <div className="notifications-section">
                <h3>🔔 Recent Notifications</h3>
                <div className="notifications-list">
                  {notifications.filter(n => n.type === 'COMPLAINT_ASSIGNED').slice(0, 5).map((notif) => (
                    <div key={notif.notificationID} className={`notification-item ${notif.isRead ? 'read' : 'unread'}`}>
                      <div className="notification-content">
                        <p>{notif.message}</p>
                        <span className="notification-date">
                          {new Date(notif.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Safety Map Tab */}
        {activeTab === 'safety-map' && (
          <SafetyMap />
        )}
      </div>
    </div>
  );
};

export default AnalystDashboard;
