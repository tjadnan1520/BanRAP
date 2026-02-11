import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/TravelerDashboard.css';
import { travellerAPI } from '../utils/api.js';
import SafetyNavigation from './SafetyNavigation';
import SafetyMap from './SafetyMap';

const TravelerDashboard = () => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  
  // Complaint map refs
  const complaintMapRef = useRef(null);
  const complaintMapInstance = useRef(null);
  const complaintMarkerRef = useRef(null);
  const searchBoxRef = useRef(null);
  const searchInputRef = useRef(null);
  
  const [activeCard, setActiveCard] = useState('feedback');
  const [currentUser, setCurrentUser] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [complaintMapReady, setComplaintMapReady] = useState(false);
  const [myComplaints, setMyComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [feedbackData, setFeedbackData] = useState({
    location: '',
    rating: 5,
    comment: '',
  });
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [roads, setRoads] = useState([]);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [selectedRoadDetails, setSelectedRoadDetails] = useState(null);
  const [navigationData, setNavigationData] = useState({
    startLocation: '',
    endLocation: '',
    realTimeAlerts: false,
  });
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Check if user is logged in and load dashboard data
  useEffect(() => {
    const currentUserData = localStorage.getItem('currentUser');
    if (!currentUserData) {
      navigate('/login');
      return;
    }
    
    const user = JSON.parse(currentUserData);
    setCurrentUser(user);
    
    // Load traveller dashboard data and roads
    loadDashboardData();
    loadRoads();
    loadMyComplaints();
  }, [navigate]);

  // Load traveller dashboard data from API
  const loadDashboardData = async () => {
    try {
      const response = await travellerAPI.getDashboard();
      setDashboardData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Still show the dashboard with empty data if API fails
      setDashboardData(null);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Load my complaints history
  const loadMyComplaints = async () => {
    try {
      setComplaintsLoading(true);
      const response = await travellerAPI.getMyComplaints();
      if (response.success) {
        setMyComplaints(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load complaints:', error);
      setMyComplaints([]);
    } finally {
      setComplaintsLoading(false);
    }
  };

  // Load all available roads
  const loadRoads = async () => {
    try {
      const response = await travellerAPI.getRoads();
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
      setMessage({ type: 'error', text: 'Failed to load maps. Please refresh the page.' });
    };
    
    document.head.appendChild(script);
  };

  // Initialize safety map
  const initializeSafetyMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) return;
    if (mapInstance.current) return; // Already initialized

    const rect = mapRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setTimeout(() => initializeSafetyMap(), 300);
      return;
    }

    try {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 23.8103, lng: 90.4125 }, // Dhaka center
        zoom: 12,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: false,
      });

      // Add road safety markers
      addSafetyMarkers();
    } catch (error) {
      console.error('Error creating map:', error);
      setMessage({ type: 'error', text: 'Error initializing map' });
    }
  };

  // Add safety markers for roads
  const addSafetyMarkers = () => {
    if (!mapInstance.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add markers for each road segment
    roads.forEach(road => {
      if (road.segments) {
        road.segments.forEach(segment => {
          // Use segment coordinates if available, otherwise use road's default location
          const lat = segment.latitude || road.latitude || 23.8103 + (Math.random() - 0.5) * 0.1;
          const lng = segment.longitude || road.longitude || 90.4125 + (Math.random() - 0.5) * 0.1;
          
          // Determine safety color based on rating
          const safetyRating = segment.safetyRating || segment.averageRating || Math.random() * 5;
          let markerColor;
          if (safetyRating >= 4) {
            markerColor = 'green'; // Safe
          } else if (safetyRating >= 2.5) {
            markerColor = 'orange'; // Moderate
          } else {
            markerColor = 'red'; // Unsafe
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

          // Add info window
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

  // Initialize map when safety-map or feedback tab is active
  useEffect(() => {
    if (activeCard === 'safety-map' || activeCard === 'feedback') {
      loadGoogleMaps();
    }
  }, [activeCard]);

  // Initialize map after Google Maps is loaded and tab is active
  useEffect(() => {
    if (activeCard === 'safety-map' && mapLoaded) {
      setTimeout(() => initializeSafetyMap(), 300);
    }
  }, [activeCard, mapLoaded]);

  // Update markers when roads data changes
  useEffect(() => {
    if (activeCard === 'safety-map' && mapInstance.current && roads.length > 0) {
      addSafetyMarkers();
    }
  }, [roads, activeCard]);

  // Initialize complaint map with search
  const initializeComplaintMap = () => {
    if (!complaintMapRef.current || !window.google || !window.google.maps) return;
    if (complaintMapInstance.current) return;

    const rect = complaintMapRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setTimeout(() => initializeComplaintMap(), 300);
      return;
    }

    try {
      // Create map centered on Dhaka University area
      complaintMapInstance.current = new window.google.maps.Map(complaintMapRef.current, {
        center: { lat: 23.7335, lng: 90.3925 },
        zoom: 15,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: false,
      });

      // Initialize search box
      if (searchInputRef.current) {
        searchBoxRef.current = new window.google.maps.places.SearchBox(searchInputRef.current);
        
        // Bias search results to map's viewport
        complaintMapInstance.current.addListener('bounds_changed', () => {
          searchBoxRef.current.setBounds(complaintMapInstance.current.getBounds());
        });

        // Handle place selection from search
        searchBoxRef.current.addListener('places_changed', () => {
          const places = searchBoxRef.current.getPlaces();
          if (places.length === 0) return;

          const place = places[0];
          if (!place.geometry || !place.geometry.location) return;

          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          };

          // Update map and marker
          complaintMapInstance.current.setCenter(location);
          complaintMapInstance.current.setZoom(17);
          updateComplaintMarker(location, place.formatted_address || place.name);
          
          // Find nearest road/segment
          findNearestRoad(location);
        });
      }

      // Handle map click
      complaintMapInstance.current.addListener('click', (e) => {
        const location = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng()
        };
        
        updateComplaintMarker(location);
        findNearestRoad(location);
      });

      setComplaintMapReady(true);
    } catch (error) {
      console.error('Error creating complaint map:', error);
      setMessage({ type: 'error', text: 'Error initializing map' });
    }
  };

  // Update marker on complaint map
  const updateComplaintMarker = (location, address = null) => {
    // Remove existing marker
    if (complaintMarkerRef.current) {
      complaintMarkerRef.current.setMap(null);
    }

    // Create new marker
    complaintMarkerRef.current = new window.google.maps.Marker({
      position: location,
      map: complaintMapInstance.current,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#ff4757',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
        scale: 12
      }
    });

    // Handle marker drag
    complaintMarkerRef.current.addListener('dragend', (e) => {
      const newLocation = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng()
      };
      findNearestRoad(newLocation);
    });

    setSelectedCoordinates(location);
    
    // Update location field with address or coordinates
    if (address) {
      setFeedbackData(prev => ({
        ...prev,
        location: address
      }));
    } else {
      setFeedbackData(prev => ({
        ...prev,
        location: `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      }));
    }
  };

  // Find nearest road/segment to a location
  const findNearestRoad = async (location) => {
    setSelectedCoordinates(location);
    
    // For now, use any existing segment for the complaint
    // In a production app, you would query the backend for the nearest segment
    let nearestRoad = null;
    let nearestSegment = null;
    let minDistance = Infinity;

    roads.forEach(road => {
      if (road.segments) {
        road.segments.forEach(segment => {
          // Try to parse segment coordinates
          let segLat = segment.latitude;
          let segLng = segment.longitude;
          
          if (segment.sStartCoord) {
            try {
              const coords = JSON.parse(segment.sStartCoord);
              segLat = coords.lat;
              segLng = coords.lng;
            } catch (e) {}
          }

          if (segLat && segLng) {
            const distance = calculateDistance(location.lat, location.lng, segLat, segLng);
            if (distance < minDistance) {
              minDistance = distance;
              nearestRoad = road;
              nearestSegment = segment;
            }
          }
        });
      }
    });

    if (nearestSegment && minDistance < 5000) { // Within 5km
      setSelectedRoad(nearestSegment.segmentID);
      setSelectedRoadDetails({
        ...nearestSegment,
        road: nearestRoad
      });
      setFeedbackData(prev => ({
        ...prev,
        location: `${nearestRoad.roadName} - Near selected point`
      }));
    } else {
      // No nearby road found, still allow complaint with coordinates
      setSelectedRoad('CUSTOM_LOCATION');
      setSelectedRoadDetails(null);
    }
  };

  // Calculate distance between two points (in meters)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Initialize complaint map when feedback tab is active
  useEffect(() => {
    if (activeCard === 'feedback' && mapLoaded && !complaintMapInstance.current) {
      setTimeout(() => initializeComplaintMap(), 300);
    }
  }, [activeCard, mapLoaded]);

  // Refresh complaint map
  const refreshComplaintMap = () => {
    // Clear existing map instance and marker
    if (complaintMarkerRef.current) {
      complaintMarkerRef.current.setMap(null);
      complaintMarkerRef.current = null;
    }
    if (complaintMapInstance.current) {
      complaintMapInstance.current = null;
    }
    searchBoxRef.current = null;
    setComplaintMapReady(false);
    setSelectedCoordinates(null);
    setSelectedRoadDetails(null);
    
    // Reinitialize after a short delay
    setTimeout(() => initializeComplaintMap(), 300);
  };

  // Handle road selection (legacy - kept for compatibility)
  const handleRoadChange = async (e) => {
    const segmentID = e.target.value;
    setSelectedRoad(segmentID);
    
    if (!segmentID) {
      setSelectedRoadDetails(null);
      setFeedbackData(prev => ({
        ...prev,
        location: ''
      }));
      return;
    }

    try {
      const response = await travellerAPI.getRoadDetails(segmentID);
      const roadDetails = response.data;
      setSelectedRoadDetails(roadDetails);
      
      // Auto-populate location with road name and segment
      const roadName = roadDetails.road?.roadName || 'Unknown Road';
      const segmentInfo = roadDetails.segmentName || segmentID;
      setFeedbackData(prev => ({
        ...prev,
        location: `${roadName} - ${segmentInfo}`
      }));
    } catch (error) {
      console.error('Failed to load road details:', error);
      setMessage({ type: 'error', text: 'Failed to load road details' });
    }
  };

  // Handle feedback form changes
  const handleFeedbackChange = (e) => {
    const { name, value } = e.target;
    setFeedbackData({
      ...feedbackData,
      [name]: value,
    });
  };

  // Handle navigation form changes
  const handleNavigationChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNavigationData({
      ...navigationData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  // Submit feedback
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedCoordinates) {
      setMessage({ type: 'error', text: 'Please select a location on the map' });
      return;
    }
    
    if (!feedbackData.comment.trim()) {
      setMessage({ type: 'error', text: 'Please enter a complaint description' });
      return;
    }

    setLoading(true);
    try {
      // Get road and segment info if available
      const roadID = selectedRoadDetails?.road?.roadID || selectedRoadDetails?.roadID || null;
      const segmentID = selectedRoad && selectedRoad !== 'CUSTOM_LOCATION' ? selectedRoad : null;
      
      // Use selected coordinates from map
      const coordinates = selectedCoordinates;

      // Validate coordinates
      if (!coordinates || !coordinates.lat || !coordinates.lng) {
        throw new Error('Invalid coordinates selected. Please try again.');
      }

      console.log('Submitting feedback with:', {
        description: feedbackData.comment,
        coordinates: coordinates,
        location: feedbackData.location,
        segmentID,
        roadID
      });

      // Submit complaint - only description and coordinates are required
      const response = await travellerAPI.submitFeedback({
        description: feedbackData.comment,
        coordinates: coordinates,
        location: feedbackData.location || `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`,
        segmentID: segmentID,
        roadID: roadID,
        feedbackType: 'COMPLAINT'
      });
      
      setMessage({
        type: 'success',
        text: response.message || 'Complaint submitted successfully! Admin will review and assign an analyst.',
      });
      setFeedbackSubmitted(true);
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setFeedbackData({
          location: '',
          rating: 5,
          comment: '',
        });
        setSelectedRoad(null);
        setSelectedRoadDetails(null);
        setSelectedCoordinates(null);
        if (complaintMarkerRef.current) {
          complaintMarkerRef.current.setMap(null);
          complaintMarkerRef.current = null;
        }
        setFeedbackSubmitted(false);
        setMessage({ type: '', text: '' });
      }, 2000);
    } catch (error) {
      console.error('Complaint submission error:', error);
      const errorMessage = error.message || (error.data?.message) || 'Error submitting complaint. Please try again.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Start safety navigation
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
      // Call API to start navigation
      const response = await travellerAPI.submitFeedback({
        location: `${navigationData.startLocation} to ${navigationData.endLocation}`,
        comment: `Navigation route from ${navigationData.startLocation} to ${navigationData.endLocation}`,
        realTimeAlerts: navigationData.realTimeAlerts
      });

      setMessage({
        type: 'success',
        text: `Navigation started from ${navigationData.startLocation} to ${navigationData.endLocation}.`,
      });
      setNavigationStarted(true);

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
    } catch (error) {
      console.error('Navigation error:', error);
      setMessage({ type: 'error', text: error.message || 'Error starting navigation. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="traveler-dashboard-container">
      <div className="dashboard-content">
        <div className="dashboard-header">
          <h1>Traveler Dashboard</h1>
          <p>Welcome back! Report road issues and use safety-aware navigation</p>
        </div>

        {message.text && (
          <div className={`dashboard-message ${message.type}-box`}>
            {message.text}
          </div>
        )}

        {/* Card Selection Tabs */}
        <div className="dashboard-tabs">
          <button
            className={`tab-button ${activeCard === 'feedback' ? 'active' : ''}`}
            onClick={() => {
              setActiveCard('feedback');
              setMessage({ type: '', text: '' });
            }}
          >
            Report Issue
          </button>
          <button
            className={`tab-button ${activeCard === 'my-complaints' ? 'active' : ''}`}
            onClick={() => {
              setActiveCard('my-complaints');
              setMessage({ type: '', text: '' });
              loadMyComplaints();
            }}
          >
            My Complaints
          </button>
          <button
            className={`tab-button ${activeCard === 'navigation' ? 'active' : ''}`}
            onClick={() => {
              setActiveCard('navigation');
              setMessage({ type: '', text: '' });
            }}
          >
            Safety Aware Navigation
          </button>
          <button
            className={`tab-button ${activeCard === 'safety-map' ? 'active' : ''}`}
            onClick={() => {
              setActiveCard('safety-map');
              setMessage({ type: '', text: '' });
            }}
          >
            View Safety Map
          </button>
        </div>

        {/* Feedback Card */}
        {activeCard === 'feedback' && (
          <div className="dashboard-card feedback-card">
            <div className="card-header">
              <h2>Report Road Issue</h2>
              <p>Select a road segment and describe the issue</p>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="feedback-form">
              {/* Map with Search */}
              <div className="form-group">
                <label>Select Location on Map *</label>
                <p className="help-text">Search for a place or click on the map to select the location of the issue</p>
                
                {/* Search Box */}
                <div className="map-search-container">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="🔍 Search for a location..."
                    className="map-search-input"
                  />
                </div>
                
                {/* Map */}
                <div className="map-container-wrapper">
                  <div ref={complaintMapRef} className="complaint-map"></div>
                  <button 
                    type="button"
                    className="map-refresh-btn"
                    onClick={refreshComplaintMap}
                    title="Refresh Map"
                  >
                    ⟳ Refresh Map
                  </button>
                </div>
                
                {/* Selected Location Display */}
                {selectedCoordinates && (
                  <div className="selected-location-info">
                    <span className="location-pin">📍</span>
                    <span className="location-text">
                      {feedbackData.location || `${selectedCoordinates.lat.toFixed(6)}, ${selectedCoordinates.lng.toFixed(6)}`}
                    </span>
                    {selectedRoadDetails && (
                      <span className="road-match">
                        <br />Nearest Road: <strong>{selectedRoadDetails.road?.roadName}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Complaint Description */}
              <div className="form-group">
                <label htmlFor="comment">Describe the Issue *</label>
                <textarea
                  id="comment"
                  name="comment"
                  value={feedbackData.comment}
                  onChange={handleFeedbackChange}
                  placeholder="Describe the road safety issue or labeling concern..."
                  className="form-textarea"
                  rows={5}
                  required
                />
              </div>

              <button
                type="submit"
                className="submit-button"
                disabled={loading || feedbackSubmitted || (!selectedRoad && !selectedCoordinates)}
              >
                {loading ? 'Submitting...' : feedbackSubmitted ? '✓ Submitted' : 'Submit Complaint'}
              </button>
            </form>
          </div>
        )}

        {/* My Complaints Card */}
        {activeCard === 'my-complaints' && (
          <div className="dashboard-card complaints-card">
            <div className="card-header">
              <h2>My Complaints</h2>
              <p>Track the status of your reported issues</p>
              <button 
                className="refresh-btn"
                onClick={loadMyComplaints}
                disabled={complaintsLoading}
              >
                Refresh
              </button>
            </div>

            {complaintsLoading ? (
              <div className="loading-state">Loading complaints...</div>
            ) : myComplaints.length === 0 ? (
              <div className="empty-state">
                <p>You haven't submitted any complaints yet.</p>
                <button 
                  className="action-button"
                  onClick={() => setActiveCard('feedback')}
                >
                  Report an Issue
                </button>
              </div>
            ) : (
              <div className="my-complaints-list">
                {myComplaints.map((complaint) => (
                  <div 
                    key={complaint.feedbackID} 
                    className={`my-complaint-card ${complaint.status?.toLowerCase()}`}
                  >
                    <div className="complaint-card-header">
                      <h3>{complaint.road?.roadName || 'Unknown Road'}</h3>
                      <span className={`complaint-status ${complaint.status?.toLowerCase()}`}> 
                        {complaint.status === 'PENDING' && 'Pending'}
                        {complaint.status === 'IN_PROGRESS' && 'Being Reviewed'}
                        {complaint.status === 'RESOLVED' && 'Resolved'}
                      </span>
                    </div>
                    <div className="complaint-card-body">
                      <p><strong>Segment:</strong> {complaint.segment?.segmentLabel || 'N/A'}</p>
                      <p><strong>Date:</strong> {new Date(complaint.createdAt).toLocaleDateString()}</p>
                      <p className="complaint-description">
                        <strong>Your Report:</strong> {complaint.description}
                      </p>
                    </div>
                    {complaint.status === 'RESOLVED' && (
                      <div className="resolved-message">
                        <p>Your complaint has been resolved! The road has been relabeled.</p>
                      </div>
                    )}
                    {complaint.status === 'IN_PROGRESS' && (
                      <div className="in-progress-message">
                        <p>An annotator has been assigned to review this issue.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Safety Aware Navigation Card */}
        {activeCard === 'navigation' && (
          <SafetyNavigation />
        )}

        {/* Safety Map Card */}
        {activeCard === 'safety-map' && (
          <SafetyMap />
        )}
      </div>
    </div>
  );
};

export default TravelerDashboard;
