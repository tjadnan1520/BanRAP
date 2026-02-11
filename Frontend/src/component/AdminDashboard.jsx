import React, { useState, useEffect, useRef, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AdminDashboard.css';
import { adminAPI, api } from '../utils/api.js';
import LabelReview from './LabelReview';
import SafetyNavigation from './SafetyNavigation';
import SafetyMap from './SafetyMap';

// Error Boundary Component to prevent white screen crashes
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AdminDashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#666' }}>{this.state.error?.message || 'An error occurred'}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AdminDashboardContent = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('navigation');
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Navigation State
  const [navigationData, setNavigationData] = useState({
    startLocation: '',
    destination: '',
    alerts: []
  });

  // Labeling Review State
  const [labelingSubmissions, setLabelingSubmissions] = useState([]);

  // Analyst Management State
  const [analystList, setAnalystList] = useState([]);
  const [suspendedAnnotators, setSuspendedAnnotators] = useState([]);
  const [warningAnnotators, setWarningAnnotators] = useState([]);
  const [trainingRemarks, setTrainingRemarks] = useState({});
  const [annotatorLoading, setAnnotatorLoading] = useState(false);
  
  // All Annotators State
  const [allAnnotators, setAllAnnotators] = useState([]);
  const [selectedAnnotator, setSelectedAnnotator] = useState(null);
  const [annotatorSearchEmail, setAnnotatorSearchEmail] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Complaints State
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [assignAnnotatorEmail, setAssignAnnotatorEmail] = useState('');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [showComplaintMap, setShowComplaintMap] = useState(false);
  const [complaintMapReady, setComplaintMapReady] = useState(false);
  
  // Complaint Map State
  const complaintMapRef = useRef(null);
  const complaintMapInstance = useRef(null);
  const complaintMarker = useRef(null);

  const [showAddAnalyst, setShowAddAnalyst] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [newAnalyst, setNewAnalyst] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });

  const [suspensionData, setSuspensionData] = useState({
    analystId: null,
    reason: '',
    showForm: false
  });

  const [reviewData, setReviewData] = useState({
    submissionId: null,
    action: '',
    comment: '',
    showForm: false
  });

  // Safety Map State
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [roads, setRoads] = useState([]);
  const [roadRatings, setRoadRatings] = useState({});

  // Check user role on mount
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      try {
        const parsedUser = JSON.parse(user);
        if (parsedUser.role !== 'ADMIN') {
          navigate('/');
        }
        setCurrentUser(parsedUser);
        // Load admin dashboard data
        loadDashboardData();
      } catch (e) {
        console.error('Error parsing user:', e);
        navigate('/');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  // Load dashboard data from API
  const loadDashboardData = async () => {
    try {
      const response = await adminAPI.getDashboard();
      setLabelingSubmissions(response.data?.labelingSubmissions || []);
      setAnalystList(response.data?.analysts || []);
      // Load suspended annotators
      await loadSuspendedAnnotators();
      // Load roads for safety map
      loadRoads();
      // Load complaints
      loadComplaints();
      // Load all annotators for assignment
      loadAllAnnotatorsForAssignment();
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Initialize with empty data if API fails
      setLabelingSubmissions([]);
      setAnalystList([]);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Load suspended annotators for management
  const loadSuspendedAnnotators = async () => {
    try {
      setAnnotatorLoading(true);
      const response = await api.get('/api/admin/annotators/suspended');
      if (response.success) {
        setSuspendedAnnotators(response.data.suspended || []);
        setWarningAnnotators(response.data.warning || []);
      }
    } catch (error) {
      console.error('Failed to load suspended annotators:', error);
    } finally {
      setAnnotatorLoading(false);
    }
  };

  // Load complaints/feedbacks
  const loadComplaints = async () => {
    try {
      setComplaintsLoading(true);
      const response = await adminAPI.getComplaints();
      if (response.success) {
        setComplaints(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load complaints:', error);
      setComplaints([]);
    } finally {
      setComplaintsLoading(false);
    }
  };

  // Parse coordinates from complaint or fallback to segment/road coordinates
  const parseCoordinates = (coordinates) => {
    if (!coordinates) return null;
    try {
      if (typeof coordinates === 'string') {
        return JSON.parse(coordinates);
      }
      return coordinates;
    } catch (e) {
      console.error('Failed to parse coordinates:', e);
      return null;
    }
  };

  // Get complaint location coordinates with fallback
  const getComplaintCoordinates = (complaint) => {
    if (!complaint) return null;
    
    try {
      // First try complaint coordinates
      let coords = parseCoordinates(complaint.coordinates);
      if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') return coords;

      // Fallback to segment start coordinates
      if (complaint.segment?.sStartCoord) {
        coords = parseCoordinates(complaint.segment.sStartCoord);
        if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') return coords;
      }

      // Fallback to road start coordinates
      if (complaint.road?.rStartCoord) {
        coords = parseCoordinates(complaint.road.rStartCoord);
        if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') return coords;
      }
    } catch (e) {
      console.error('Error getting complaint coordinates:', e);
    }

    return null;
  };

  // Initialize complaint location map
  const initializeComplaintMap = (complaint) => {
    if (!complaintMapRef.current || !window.google || !window.google.maps) {
      console.log('Map ref or Google Maps not available');
      return;
    }

    const coords = getComplaintCoordinates(complaint);
    const defaultCenter = { lat: 23.8103, lng: 90.4125 }; // Dhaka
    const center = coords ? { lat: coords.lat, lng: coords.lng } : defaultCenter;

    try {
      complaintMapInstance.current = new window.google.maps.Map(complaintMapRef.current, {
        center: center,
        zoom: 16,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: false,
      });

      // Mark map as ready
      setComplaintMapReady(true);

      // Remove previous marker if exists
      if (complaintMarker.current) {
        complaintMarker.current.setMap(null);
      }

      // Add marker for complaint location
      if (coords) {
        complaintMarker.current = new window.google.maps.Marker({
          position: center,
          map: complaintMapInstance.current,
          title: complaint.title || 'Complaint Location',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#e74c3c',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
            scale: 12,
          },
          animation: window.google.maps.Animation.DROP,
        });

        // Info window with complaint details
        const infoContent = `
          <div style="padding: 12px; min-width: 250px; max-width: 350px;">
            <h3 style="margin: 0 0 10px 0; color: #e74c3c; font-size: 16px;">⚠️ ${complaint.title || 'Complaint'}</h3>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Road:</strong> ${complaint.road?.roadName || 'Unknown'}</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Status:</strong> <span style="color: ${complaint.status === 'RESOLVED' ? '#27ae60' : complaint.status === 'IN_PROGRESS' ? '#f39c12' : '#e74c3c'}">${complaint.status || 'PENDING'}</span></p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Issue:</strong></p>
            <p style="margin: 4px 0; font-size: 12px; color: #666; background: #f9f9f9; padding: 8px; border-radius: 4px;">${complaint.description || 'No description'}</p>
            <p style="margin: 8px 0 0 0; font-size: 11px; color: #888;">📍 ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}</p>
          </div>
        `;

        const infoWindow = new window.google.maps.InfoWindow({
          content: infoContent,
        });

        complaintMarker.current.addListener('click', () => {
          infoWindow.open(complaintMapInstance.current, complaintMarker.current);
        });

        // Open info window immediately
        infoWindow.open(complaintMapInstance.current, complaintMarker.current);
      }
    } catch (error) {
      console.error('Error creating complaint map:', error);
    }
  };

  // Handle viewing complaint on map
  const handleViewComplaintOnMap = (complaint) => {
    try {
      console.log('Opening complaint modal for:', complaint);
      if (!complaint) {
        console.error('No complaint provided');
        return;
      }
      // Reset map ready state for new complaint
      setComplaintMapReady(false);
      setSelectedComplaint(complaint);
      setShowComplaintMap(true);
      
      // Load Google Maps if not loaded, then initialize
      if (!window.google || !window.google.maps) {
        loadGoogleMaps(() => {
          // Callback after maps load - initialize with delay for DOM
          setTimeout(() => initializeComplaintMap(complaint), 500);
        });
      } else {
        // Maps already loaded, initialize after DOM renders
        setTimeout(() => initializeComplaintMap(complaint), 300);
      }
    } catch (error) {
      console.error('Error opening complaint modal:', error);
    }
  };

  // Initialize complaint map when showing (backup trigger)
  useEffect(() => {
    if (showComplaintMap && selectedComplaint && window.google && window.google.maps) {
      setTimeout(() => initializeComplaintMap(selectedComplaint), 400);
    }
  }, [showComplaintMap, selectedComplaint, mapLoaded]);

  // Load all annotators for assignment
  const loadAllAnnotatorsForAssignment = async () => {
    try {
      const response = await adminAPI.getAllAnnotators();
      if (response.success && response.data) {
        // Backend returns { annotators: [...], total: n }
        const annotatorsList = Array.isArray(response.data.annotators) 
          ? response.data.annotators 
          : Array.isArray(response.data) 
            ? response.data 
            : [];
        setAllAnnotators(annotatorsList);
      } else {
        setAllAnnotators([]);
      }
    } catch (error) {
      console.error('Failed to load annotators:', error);
      setAllAnnotators([]);
    }
  };

  // Assign complaint to annotator
  const handleAssignComplaint = async (feedbackID) => {
    if (!assignAnnotatorEmail) {
      alert('Please select an annotator');
      return;
    }

    try {
      setLoading(true);
      const response = await adminAPI.assignComplaint(
        feedbackID,
        assignAnnotatorEmail,
        1,
        adminRemarks
      );
      
      if (response.success) {
        alert('Complaint assigned successfully!');
        // Close modal and cleanup
        setShowComplaintMap(false);
        setSelectedComplaint(null);
        setAssignAnnotatorEmail('');
        setAdminRemarks('');
        setComplaintMapReady(false);
        // Cleanup map
        if (complaintMarker.current) {
          complaintMarker.current.setMap(null);
        }
        complaintMapInstance.current = null;
        // Reload complaints
        await loadComplaints();
      }
    } catch (error) {
      console.error('Failed to assign complaint:', error);
      alert('Failed to assign complaint: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Load all available roads for safety map
  const loadRoads = async () => {
    try {
      const response = await adminAPI.getRoads();
      const roadsList = response.data || [];
      setRoads(roadsList);
      
      // Fetch ratings for each road
      const ratings = {};
      for (const road of roadsList) {
        try {
          const ratingResponse = await adminAPI.getRoadRating(road.roadID);
          ratings[road.roadID] = ratingResponse.data;
        } catch (error) {
          console.warn(`Failed to load rating for road ${road.roadID}:`, error);
          ratings[road.roadID] = { overallRating: 0 };
        }
      }
      setRoadRatings(ratings);
    } catch (error) {
      console.error('Failed to load roads:', error);
      setRoads([]);
      setRoadRatings({});
    }
  };

  // Load Google Maps API
  const loadGoogleMaps = (callback) => {
    if (window.google && window.google.maps) {
      setMapLoaded(true);
      if (callback) callback();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        setMapLoaded(true);
        if (callback) callback();
      });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyB41DRUbKWJHPxaFjMAwdrzWzbVKartNGg&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('Google Maps API loaded');
      setMapLoaded(true);
      if (callback) callback();
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
          
          // Get rating from the roadRatings state
          const roadRating = roadRatings[road.roadID];
          const safetyRating = roadRating?.overallRating || 0;
          
          let markerColor;
          let statusText;
          if (safetyRating >= 4) {
            markerColor = '#2d7f2d'; // Green for safe
            statusText = 'Safe';
          } else if (safetyRating >= 2.5) {
            markerColor = '#ff9800'; // Orange for moderate
            statusText = 'Moderate';
          } else if (safetyRating > 0) {
            markerColor = '#d32f2f'; // Red for dangerous
            statusText = 'Dangerous';
          } else {
            markerColor = '#9e9e9e'; // Gray for not rated
            statusText = 'Not Rated';
          }

          const marker = new window.google.maps.Marker({
            position: { lat, lng },
            map: mapInstance.current,
            title: `${road.roadName} - Rating: ${safetyRating.toFixed(1)}`,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: markerColor,
              fillOpacity: 0.85,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 8
            }
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 12px; min-width: 250px; font-family: Arial, sans-serif;">
                <h3 style="margin: 0 0 10px 0; color: #0066cc; font-size: 14px;">${road.roadName}</h3>
                <p style="margin: 4px 0; font-size: 13px;"><strong>Segment:</strong> ${segment.segmentName || 'N/A'}</p>
                <p style="margin: 4px 0; font-size: 13px;"><strong>Safety Rating:</strong> ${safetyRating > 0 ? safetyRating.toFixed(1) : 'N/A'} / 5.0 ⭐</p>
                <p style="margin: 4px 0; font-size: 13px; color: ${markerColor}; font-weight: bold;"><strong>Status:</strong> ${statusText}</p>
                ${roadRating?.totalLabels ? `<p style="margin: 4px 0; font-size: 12px; color: #666;"><strong>Labels:</strong> ${roadRating.totalLabels}</p>` : ''}
                ${roadRating?.isVerified ? `<p style="margin: 4px 0; font-size: 12px; color: green;">✓ Verified</p>` : `<p style="margin: 4px 0; font-size: 12px; color: #ff9800;">⏳ Pending</p>`}
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

  // Update markers when roads data changes or ratings update
  useEffect(() => {
    if (activeTab === 'safety-map' && mapInstance.current && roads.length > 0) {
      addSafetyMarkers();
    }
  }, [roads, roadRatings, activeTab]);

  // Handle adding training remarks
  const handleAddTrainingRemarks = async (annotatorID) => {
    const remarks = trainingRemarks[annotatorID];
    if (!remarks || !remarks.trim()) {
      alert('Please enter training remarks');
      return;
    }

    try {
      setAnnotatorLoading(true);
      const response = await api.post('/api/admin/annotators/training-remarks', {
        annotatorID,
        remarks
      });
      if (response.success) {
        alert('Training remarks added successfully!');
        setTrainingRemarks(prev => ({ ...prev, [annotatorID]: '' }));
        await loadSuspendedAnnotators();
      }
    } catch (error) {
      console.error('Failed to add training remarks:', error);
      alert('Failed to add training remarks: ' + (error.message || 'Unknown error'));
    } finally {
      setAnnotatorLoading(false);
    }
  };

  // Handle reactivating annotator
  const handleReactivateAnnotator = async (annotatorID) => {
    if (!confirm('Are you sure you want to reactivate this annotator? Their penalty will be reset.')) {
      return;
    }

    try {
      setAnnotatorLoading(true);
      const response = await api.post('/api/admin/annotators/reactivate', {
        annotatorID
      });
      if (response.success) {
        alert('Annotator reactivated successfully!');
        await loadSuspendedAnnotators();
        // Refresh all annotators list if search was done
        if (allAnnotators.length > 0) {
          await searchAnnotators(annotatorSearchEmail);
        }
      }
    } catch (error) {
      console.error('Failed to reactivate annotator:', error);
      alert('Failed to reactivate annotator: ' + (error.message || 'Unknown error'));
    } finally {
      setAnnotatorLoading(false);
    }
  };

  // Search all annotators
  const searchAnnotators = async (searchTerm = '') => {
    try {
      setSearchLoading(true);
      const queryParam = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
      const response = await api.get(`/api/admin/annotators/all${queryParam}`);
      if (response.success) {
        setAllAnnotators(response.data.annotators || []);
      }
    } catch (error) {
      console.error('Failed to search annotators:', error);
      setAllAnnotators([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle search input change with debounce
  const handleAnnotatorSearch = (e) => {
    const value = e.target.value;
    setAnnotatorSearchEmail(value);
    // Debounce search
    clearTimeout(window.annotatorSearchTimeout);
    window.annotatorSearchTimeout = setTimeout(() => {
      searchAnnotators(value);
    }, 300);
  };

  // Load all annotators when section is first accessed
  const handleLoadAllAnnotators = () => {
    if (allAnnotators.length === 0) {
      searchAnnotators('');
    }
  };

  // Navigation Handlers
  const handleNavigationChange = (e) => {
    const { name, value } = e.target;
    setNavigationData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNavigationSubmit = (e) => {
    e.preventDefault();
    if (!navigationData.startLocation.trim() || !navigationData.destination.trim()) {
      alert('Please fill in all navigation fields');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setNavigationData(prev => ({
        ...prev,
        alerts: [
          {
            type: 'info',
            message: `Calculating safest route from ${navigationData.startLocation} to ${navigationData.destination}...`,
            timestamp: new Date().toLocaleTimeString()
          }
        ]
      }));
      setLoading(false);
    }, 1500);
  };

  // Labeling Review Handlers
  const handleReviewSubmit = (submissionId, action, comment) => {
    if (action === 'reject' && !comment.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setLabelingSubmissions(prev =>
      prev.map(sub =>
        sub.id === submissionId
          ? {
            ...sub,
            status: action === 'approve' ? 'approved' : 'rejected',
            reviewComment: comment
          }
          : sub
      )
    );

    // Notify analyst (in real app, send notification/email)
    const submission = labelingSubmissions.find(s => s.id === submissionId);
    console.log(`Notification sent to ${submission.analystEmail}: Labeling ${action}ed. Comment: ${comment}`);

    setReviewData({
      submissionId: null,
      action: '',
      comment: '',
      showForm: false
    });
  };

  // Analyst Management Handlers
  const handleAddAnalyst = (e) => {
    e.preventDefault();
    if (!newAnalyst.firstName.trim() || !newAnalyst.lastName.trim() || 
        !newAnalyst.email.trim() || !newAnalyst.password.trim()) {
      alert('Please fill in all fields');
      return;
    }

    const analyst = {
      id: analystList.length + 1,
      firstName: newAnalyst.firstName,
      lastName: newAnalyst.lastName,
      email: newAnalyst.email,
      status: 'active',
      joiningDate: new Date().toISOString().split('T')[0],
      totalLabelings: 0,
      suspensionReason: ''
    };

    setAnalystList(prev => [...prev, analyst]);
    setNewAnalyst({ firstName: '', lastName: '', email: '', password: '' });
    setShowAddAnalyst(false);

    // In real app, send notification to new analyst
    console.log(`New analyst added: ${analyst.email}`);
  };

  const handleSuspendAnalyst = (analystId, reason) => {
    if (!reason.trim()) {
      alert('Please provide a suspension reason');
      return;
    }

    setAnalystList(prev =>
      prev.map(analyst =>
        analyst.id === analystId
          ? { ...analyst, status: 'suspended', suspensionReason: reason }
          : analyst
      )
    );

    const analyst = analystList.find(a => a.id === analystId);
    console.log(`Notification sent to ${analyst.email}: Account suspended. Reason: ${reason}`);

    setSuspensionData({
      analystId: null,
      reason: '',
      showForm: false
    });
  };

  const handleRemoveSuspension = (analystId, reason) => {
    if (!reason.trim()) {
      alert('Please provide a reason for removal');
      return;
    }

    setAnalystList(prev =>
      prev.map(analyst =>
        analyst.id === analystId
          ? { ...analyst, status: 'active', suspensionReason: '' }
          : analyst
      )
    );

    const analyst = analystList.find(a => a.id === analystId);
    console.log(`Notification sent to ${analyst.email}: Suspension removed. Reason: ${reason}`);

    setSuspensionData({
      analystId: null,
      reason: '',
      showForm: false
    });
  };

  if (!currentUser) {
    return <div className="admin-loading">Loading...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Administrator Dashboard</h1>
        <p>Welcome, {currentUser.name || currentUser.firstName || 'Admin'} {currentUser.lastName || ''}</p>
      </div>

      {/* Tab Navigation */}
      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'navigation' ? 'active' : ''}`}
          onClick={() => setActiveTab('navigation')}
        >
          Safety Navigation
        </button>
        <button
          className={`tab-btn ${activeTab === 'labeling' ? 'active' : ''}`}
          onClick={() => setActiveTab('labeling')}
        >
          Labeling Review
        </button>
        <button
          className={`tab-btn ${activeTab === 'analysts' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysts')}
        >
          Analyst Management
        </button>
        <button
          className={`tab-btn ${activeTab === 'safety-map' ? 'active' : ''}`}
          onClick={() => setActiveTab('safety-map')}
        >
          View Safety Map
        </button>
        <button
          className={`tab-btn ${activeTab === 'complaints' ? 'active' : ''}`}
          onClick={() => setActiveTab('complaints')}
        >
          Complaints
        </button>
      </div>

      {/* Navigation Tab */}
      {activeTab === 'navigation' && (
        <SafetyNavigation />
      )}

      {/* Labeling Review Tab */}
      {activeTab === 'labeling' && (
        <LabelReview />
      )}

      {/* Analyst Management Tab */}
      {activeTab === 'analysts' && (
        <section className="admin-section">
          <div className="section-card">
            <div className="analysts-header">
              <h2>👥 Analyst Management</h2>
              <button
                className="btn-refresh"
                onClick={loadSuspendedAnnotators}
                disabled={annotatorLoading}
              >
                🔄 Refresh
              </button>
            </div>

            {/* Suspended Annotators Section */}
            {suspendedAnnotators.length > 0 && (
              <div className="suspended-section">
                <h3 className="suspended-title">
                  🚫 Suspended Annotators 
                  <span className="count-badge danger">{suspendedAnnotators.length}</span>
                </h3>
                <p className="section-description">These annotators have been suspended due to 3+ rejected labels. Please provide training remarks.</p>
                
                <div className="suspended-list">
                  {suspendedAnnotators.map(annotator => (
                    <div key={annotator.annotatorID} className="annotator-card suspended">
                      <div className="annotator-header">
                        <div className="annotator-info">
                          <h4>{annotator.user?.name || 'Unknown'}</h4>
                          <p className="email">{annotator.email}</p>
                          <p className="phone">📞 {annotator.user?.phone || 'N/A'}</p>
                        </div>
                        <div className="annotator-stats">
                          <span className="penalty-badge">Penalty: {annotator.penaltyScore}</span>
                          <span className="status-badge suspended">SUSPENDED</span>
                        </div>
                      </div>
                      
                      {annotator.suspendedAt && (
                        <p className="suspended-date">
                          Suspended on: {new Date(annotator.suspendedAt).toLocaleDateString()}
                        </p>
                      )}

                      {annotator.suspensionRemarks && (
                        <div className="existing-remarks">
                          <strong>Training Remarks:</strong> {annotator.suspensionRemarks}
                        </div>
                      )}

                      <div className="training-form">
                        <textarea
                          placeholder="Enter training remarks for this annotator..."
                          value={trainingRemarks[annotator.annotatorID] || ''}
                          onChange={(e) => setTrainingRemarks(prev => ({
                            ...prev,
                            [annotator.annotatorID]: e.target.value
                          }))}
                          rows="3"
                        />
                        <div className="annotator-actions">
                          <button
                            className="btn-training"
                            onClick={() => handleAddTrainingRemarks(annotator.annotatorID)}
                            disabled={annotatorLoading}
                          >
                            📝 Add Training Remarks
                          </button>
                          <button
                            className="btn-reactivate"
                            onClick={() => handleReactivateAnnotator(annotator.annotatorID)}
                            disabled={annotatorLoading}
                          >
                            ✅ Reactivate Annotator
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning Annotators Section */}
            {warningAnnotators.length > 0 && (
              <div className="warning-section">
                <h3 className="warning-title">
                  ⚠️ Warning - High Penalty Annotators
                  <span className="count-badge warning">{warningAnnotators.length}</span>
                </h3>
                <p className="section-description">These annotators have 2+ penalties and are at risk of suspension.</p>
                
                <div className="warning-list">
                  {warningAnnotators.map(annotator => (
                    <div key={annotator.annotatorID} className="annotator-card warning">
                      <div className="annotator-header">
                        <div className="annotator-info">
                          <h4>{annotator.user?.name || 'Unknown'}</h4>
                          <p className="email">{annotator.email}</p>
                        </div>
                        <div className="annotator-stats">
                          <span className="penalty-badge warning">Penalty: {annotator.penaltyScore}/3</span>
                          <span className="status-badge warning">AT RISK</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Suspended Annotators Message */}
            {suspendedAnnotators.length === 0 && warningAnnotators.length === 0 && (
              <div className="no-issues">
                <p>✅ No suspended or at-risk annotators at the moment.</p>
              </div>
            )}

            {/* All Registered Annotators Section */}
            <div className="analysts-divider">
              <h3>📋 All Registered Annotators</h3>
              <button
                className="btn-load-all"
                onClick={handleLoadAllAnnotators}
                disabled={searchLoading}
              >
                {searchLoading ? 'Loading...' : '🔄 Load All Annotators'}
              </button>
            </div>

            <div className="search-box">
              <input
                type="text"
                value={annotatorSearchEmail}
                onChange={handleAnnotatorSearch}
                placeholder="🔍 Search annotator by email or name..."
                className="search-input"
              />
              {annotatorSearchEmail && (
                <button
                  className="search-clear"
                  onClick={() => {
                    setAnnotatorSearchEmail('');
                    searchAnnotators('');
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {searchLoading && (
              <div className="loading-indicator">
                <p>Searching annotators...</p>
              </div>
            )}

            {/* Annotators List */}
            {allAnnotators.length > 0 && (
              <div className="all-annotators-list">
                <p className="results-count">Found {allAnnotators.length} annotator(s)</p>
                {allAnnotators.map(annotator => (
                  <div 
                    key={annotator.annotatorID} 
                    className={`annotator-search-card ${selectedAnnotator?.annotatorID === annotator.annotatorID ? 'expanded' : ''}`}
                    onClick={() => setSelectedAnnotator(
                      selectedAnnotator?.annotatorID === annotator.annotatorID ? null : annotator
                    )}
                  >
                    <div className="annotator-summary">
                      <div className="annotator-basic-info">
                        <h4>{annotator.name}</h4>
                        <p className="email">{annotator.email}</p>
                      </div>
                      <div className="annotator-quick-stats">
                        <span className={`penalty-indicator ${annotator.penaltyScore >= 3 ? 'high' : annotator.penaltyScore >= 2 ? 'medium' : 'low'}`}>
                          Penalty: {annotator.penaltyScore}/3
                        </span>
                        {annotator.isSuspended && (
                          <span className="suspended-indicator">SUSPENDED</span>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedAnnotator?.annotatorID === annotator.annotatorID && (
                      <div className="annotator-details-expanded">
                        <div className="details-grid">
                          <div className="detail-card">
                            <h5>📧 Contact Information</h5>
                            <p><strong>Email:</strong> {annotator.email}</p>
                            <p><strong>Phone:</strong> {annotator.phone}</p>
                            <p><strong>Work Area:</strong> {annotator.workArea}</p>
                            <p><strong>Joined:</strong> {new Date(annotator.joinedAt).toLocaleDateString()}</p>
                          </div>
                          
                          <div className="detail-card">
                            <h5>📊 Labeling Statistics</h5>
                            <div className="stats-grid">
                              <div className="stat-item">
                                <span className="stat-value">{annotator.statistics.totalLabels}</span>
                                <span className="stat-label">Total Labels</span>
                              </div>
                              <div className="stat-item verified">
                                <span className="stat-value">{annotator.statistics.verifiedLabels}</span>
                                <span className="stat-label">Approved</span>
                              </div>
                              <div className="stat-item pending">
                                <span className="stat-value">{annotator.statistics.pendingLabels}</span>
                                <span className="stat-label">Pending</span>
                              </div>
                              <div className="stat-item rate">
                                <span className="stat-value">{annotator.statistics.approvalRate}%</span>
                                <span className="stat-label">Approval Rate</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="detail-card">
                            <h5>⚠️ Penalty Status</h5>
                            <div className="penalty-details">
                              <div className={`penalty-score-display ${annotator.penaltyScore >= 3 ? 'critical' : annotator.penaltyScore >= 2 ? 'warning' : 'good'}`}>
                                <span className="score">{annotator.penaltyScore}</span>
                                <span className="max">/3</span>
                              </div>
                              <p className="penalty-status-text">
                                {annotator.penaltyScore === 0 && '✅ No penalties - Good standing'}
                                {annotator.penaltyScore === 1 && '⚡ 1 penalty - Minor concern'}
                                {annotator.penaltyScore === 2 && '⚠️ 2 penalties - At risk of suspension'}
                                {annotator.penaltyScore >= 3 && '🚫 Suspended - Needs training'}
                              </p>
                              {annotator.isSuspended && annotator.suspendedAt && (
                                <p className="suspended-since">
                                  Suspended since: {new Date(annotator.suspendedAt).toLocaleDateString()}
                                </p>
                              )}
                              {annotator.suspensionRemarks && (
                                <div className="suspension-remarks">
                                  <strong>Training Remarks:</strong> {annotator.suspensionRemarks}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions for this annotator */}
                        {annotator.isSuspended && (
                          <div className="annotator-detail-actions">
                            <textarea
                              placeholder="Enter training remarks..."
                              value={trainingRemarks[annotator.annotatorID] || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                setTrainingRemarks(prev => ({
                                  ...prev,
                                  [annotator.annotatorID]: e.target.value
                                }));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              rows="2"
                            />
                            <div className="action-buttons">
                              <button
                                className="btn-training"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddTrainingRemarks(annotator.annotatorID);
                                }}
                                disabled={annotatorLoading}
                              >
                                📝 Add Remarks
                              </button>
                              <button
                                className="btn-reactivate"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReactivateAnnotator(annotator.annotatorID);
                                }}
                                disabled={annotatorLoading}
                              >
                                ✅ Reactivate
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* No results message */}
            {!searchLoading && allAnnotators.length === 0 && annotatorSearchEmail && (
              <div className="no-results">
                <p>No annotators found matching "{annotatorSearchEmail}"</p>
              </div>
            )}

            {!searchLoading && allAnnotators.length === 0 && !annotatorSearchEmail && (
              <div className="no-results">
                <p>Click "Load All Annotators" or search by email to find annotators.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Safety Map Tab */}
      {activeTab === 'safety-map' && (
        <SafetyMap />
      )}

      {/* Complaints Management Tab */}
      {activeTab === 'complaints' && (
        <section className="admin-section">
          <div className="section-card">
            <div className="analysts-header">
              <h2>📢 Road Complaints</h2>
              <button
                className="btn-refresh"
                onClick={loadComplaints}
                disabled={complaintsLoading}
              >
                🔄 Refresh
              </button>
            </div>

            {complaintsLoading ? (
              <div className="loading">Loading complaints...</div>
            ) : complaints.length === 0 ? (
              <div className="no-data">
                <p>No complaints found.</p>
              </div>
            ) : (
              <div className="complaints-list">
                {complaints.map((complaint) => (
                  <div 
                    key={complaint.feedbackID} 
                    className={`complaint-card ${selectedComplaint?.feedbackID === complaint.feedbackID ? 'selected' : ''}`}
                    onClick={() => handleViewComplaintOnMap(complaint)}
                  >
                    <div className="complaint-header">
                      <span className={`complaint-status ${(complaint.status || 'pending').toLowerCase()}`}>
                        {complaint.status || 'PENDING'}
                      </span>
                      <span className="complaint-date">
                        {complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : 'Unknown date'}
                      </span>
                    </div>
                    <div className="complaint-body">
                      <p><strong>Road:</strong> {complaint.road?.roadName || complaint.roadName || 'Unknown Road'}</p>
                      <p><strong>Segment:</strong> {complaint.segment?.segmentLabel || complaint.segmentLabel || 'N/A'}</p>
                      <p><strong>From:</strong> {complaint.user?.email || complaint.userEmail || 'Unknown'}</p>
                      <p><strong>Issue:</strong> {complaint.description || complaint.comment || 'No description'}</p>
                    </div>
                    <div className="complaint-actions">
                      <button className="btn-view-map" onClick={(e) => {
                        e.stopPropagation();
                        handleViewComplaintOnMap(complaint);
                      }}>
                        📍 View on Map
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Complaint Detail Modal with Map */}
      {showComplaintMap && selectedComplaint && (
        <div 
          className="complaint-modal-overlay" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowComplaintMap(false);
              setSelectedComplaint(null);
              setComplaintMapReady(false);
            }
          }}
        >
          <div 
            className="complaint-modal" 
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '1100px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="complaint-modal-header">
              <h3>⚠️ Complaint Details</h3>
              <button 
                className="modal-close-btn" 
                onClick={() => {
                  setShowComplaintMap(false);
                  setSelectedComplaint(null);
                  setAssignAnnotatorEmail('');
                  setAdminRemarks('');
                  setComplaintMapReady(false);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="complaint-modal-content">
              {/* Left side - Map */}
              <div className="complaint-map-section">
                <h4>📍 Complaint Location</h4>
                <div style={{ position: 'relative', minHeight: '350px' }}>
                  <div ref={complaintMapRef} className="complaint-location-map" style={{ minHeight: '350px', width: '100%' }}></div>
                  {!complaintMapReady && (
                    <div className="map-loading-placeholder" style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#f5f5f5',
                      borderRadius: '12px',
                      zIndex: 1
                    }}>
                      <p>Loading map...</p>
                    </div>
                  )}
                </div>
                <p className="coordinates-display">
                  {(() => {
                    try {
                      const coords = getComplaintCoordinates(selectedComplaint);
                      if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
                        return `Coordinates: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
                      }
                      return 'No coordinates available';
                    } catch (e) {
                      console.error('Coordinate error:', e);
                      return 'Error loading coordinates';
                    }
                  })()}
                </p>
              </div>
              
              {/* Right side - Details & Assignment */}
              <div className="complaint-details-section">
                <div className="complaint-info-card">
                  <h4>📋 Issue Information</h4>
                  <div className="info-row">
                    <span className="info-label">Title:</span>
                    <span className="info-value">{selectedComplaint.title || 'Road Issue'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Road:</span>
                    <span className="info-value">{selectedComplaint.road?.roadName || 'Unknown'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Segment:</span>
                    <span className="info-value">{selectedComplaint.segment?.segmentLabel || 'N/A'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Submitted By:</span>
                    <span className="info-value">{selectedComplaint.user?.name || selectedComplaint.user?.email || 'Unknown'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <span className={`status-badge ${(selectedComplaint.status || 'pending').toLowerCase()}`}>
                      {selectedComplaint.status || 'PENDING'}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Date:</span>
                    <span className="info-value">{selectedComplaint.createdAt ? new Date(selectedComplaint.createdAt).toLocaleString() : 'Unknown'}</span>
                  </div>
                  
                  <div className="issue-description">
                    <span className="info-label">Issue Description:</span>
                    <div className="description-box">
                      {selectedComplaint.description || 'No description provided'}
                    </div>
                  </div>
                </div>

                {/* Assignment Section - only show if not resolved */}
                {selectedComplaint.status !== 'RESOLVED' && (
                  <div className="assignment-card">
                    <h4>👤 Assign to Annotator</h4>
                    <div className="form-group">
                      <label>Select Annotator:</label>
                      <select
                        value={assignAnnotatorEmail}
                        onChange={(e) => setAssignAnnotatorEmail(e.target.value)}
                        className="annotator-select"
                      >
                        <option value="">-- Select an Annotator --</option>
                        {Array.isArray(allAnnotators) && allAnnotators.filter(a => !a.isSuspended).map((annotator) => (
                          <option key={annotator.annotatorID || annotator.email} value={annotator.email}>
                            {annotator.name || annotator.email} - Penalty: {annotator.penaltyScore || 0}/3
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Admin Remarks (Optional):</label>
                      <textarea
                        value={adminRemarks}
                        onChange={(e) => setAdminRemarks(e.target.value)}
                        placeholder="Add instructions or notes for the annotator..."
                        rows={3}
                      />
                    </div>
                    <div className="modal-action-buttons">
                      <button
                        className="btn-assign"
                        onClick={() => handleAssignComplaint(selectedComplaint.feedbackID)}
                        disabled={loading || !assignAnnotatorEmail}
                      >
                        {loading ? 'Assigning...' : '✅ Assign Complaint'}
                      </button>
                    </div>
                  </div>
                )}

                {selectedComplaint.status === 'RESOLVED' && (
                  <div className="resolved-card">
                    <p className="resolved-message">✅ This complaint has been resolved</p>
                  </div>
                )}

                {selectedComplaint.status === 'IN_PROGRESS' && (
                  <div className="in-progress-card">
                    <p className="in-progress-message">🔄 This complaint is being handled</p>
                    {selectedComplaint.assignedAnnotatorID && (
                      <p>
                        <strong>Assigned To:</strong> {
                          allAnnotators.find(a => a.annotatorID === selectedComplaint.assignedAnnotatorID)?.name || 
                          selectedComplaint.assignedAnnotatorID
                        }
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrap with ErrorBoundary
const AdminDashboard = () => (
  <ErrorBoundary>
    <AdminDashboardContent />
  </ErrorBoundary>
);

export default AdminDashboard;
