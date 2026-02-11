import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Labeling.css';
import { annotatorAPI } from '../utils/api.js';

// Distance options
const DISTANCE_OPTIONS = ['0-1', '1-5', '5-10', '10+'];
const LEFT_OBJECTS = ['METAL', 'CONCRETE', 'BUS', 'TRUCK', 'RESIDUAL'];
const RIGHT_OBJECTS = ['METAL', 'CONCRETE', 'BUS', 'TRUCK', 'RESIDUAL'];
const INTERSECTION_TYPES = ['4-leg', '4-leg-signalised', '3-leg', 'roundabout', '3-leg-signalised', 'railway-crossing', 'merge-lane'];
const INTERSECTION_QUALITIES = ['poor', 'adequate', 'not-applicable'];
const CHANNELISATION_OPTIONS = ['not-present', 'present'];
const SPEED_LIMIT_OPTIONS = ['present', 'not-present'];
const SPEED_MANAGEMENT_OPTIONS = ['20', '30', '40', '50', '60', '80'];

const Labeling = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const satelliteMapRef = useRef(null);
  const staticMapRef = useRef(null);
  const satelliteMapInstance = useRef(null);
  const staticMapInstance = useRef(null);
  
  // Refs for markers and polylines
  const satelliteMarkersRef = useRef([]);
  const staticMarkersRef = useRef([]);
  const satellitePolylineRef = useRef(null);
  const staticPolylineRef = useRef(null);
  
  // Ref to track roadSegments for closure access
  const roadSegmentsRef = useRef([]);
  const mapsReadyRef = useRef(false);

  const [road, setRoad] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState({ lat: 23.8103, lng: 90.4441 });
  const [roadSegments, setRoadSegments] = useState([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [selectedTab, setSelectedTab] = useState('Roadside');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Complaint mode state
  const [isComplaintMode, setIsComplaintMode] = useState(false);
  const [complaintData, setComplaintData] = useState(null);

  // Label data
  const [roadsideData, setRoadsideData] = useState({
    leftObject: null,
    rightObject: null,
    distanceObject: null,
  });

  const [intersectionData, setIntersectionData] = useState({
    type: null,
    quality: null,
    channelisation: null,
  });

  const [speedData, setSpeedData] = useState({
    speedLimit: null,
    management: null,
  });

  // Initialize with location state
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (!user) {
      navigate('/login');
      return;
    }

    // Check for complaint mode
    if (location.state?.complaintData) {
      setIsComplaintMode(true);
      setComplaintData(location.state.complaintData);
      console.log('Complaint mode enabled:', location.state.complaintData);
    }

    // Try to get road from location state first, then fallback to localStorage
    let roadData = location.state?.road;
    let locationData = location.state?.selectedLocation;

    console.log('Location state:', location.state);
    console.log('Road from location state:', roadData);

    if (!roadData) {
      const savedRoad = localStorage.getItem('currentRoad');
      console.log('Saved road from localStorage:', savedRoad);
      if (savedRoad) {
        try {
          roadData = JSON.parse(savedRoad);
          console.log('Parsed road from localStorage:', roadData);
        } catch (e) {
          console.error('Error parsing saved road:', e);
        }
      }
    }

    if (!locationData) {
      const savedLocation = localStorage.getItem('selectedLocation');
      if (savedLocation) {
        try {
          locationData = JSON.parse(savedLocation);
        } catch (e) {
          console.error('Error parsing saved location:', e);
        }
      }
    }

    if (roadData) {
      console.log('Setting road data with segments:', roadData.segments);
      setRoad(roadData);
      
      // Priority for exact location: 1) selectedLocation from state (which is now startPoint), 2) road.startPoint
      let exactLocation = locationData; // This is the actual startPoint passed from MapSelection
      
      if (!exactLocation && roadData.startPoint) {
        exactLocation = roadData.startPoint;
        console.log('Using road.startPoint as exactLocation:', exactLocation);
      }
      
      if (roadData.segments && roadData.segments.length > 0) {
        console.log('Found real segments:', roadData.segments);
        setRoadSegments(roadData.segments);
        
        // If still no exact location, use first segment's startPoint
        if (!exactLocation && roadData.segments[0]?.startPoint) {
          exactLocation = roadData.segments[0].startPoint;
          console.log('Using first segment startPoint as exactLocation:', exactLocation);
        }
      } else {
        // No segments available - must fetch real segments from API
        console.warn('No segments found in road data. Attempting to fetch from API...');
        fetchSegmentsFromAPI(roadData.roadID);
      }
      
      // Set the exact location
      if (exactLocation) {
        console.log('Setting EXACT location:', exactLocation);
        setSelectedLocation(exactLocation);
        localStorage.setItem('selectedLocation', JSON.stringify(exactLocation));
      }
      
      // Save to localStorage for persistence
      localStorage.setItem('currentRoad', JSON.stringify(roadData));
    } else {
      console.warn('No road data found');
    }

    loadGoogleMapsAPI();
  }, [navigate, location]);

  // Sync roadSegments ref with state so closures can access latest value
  useEffect(() => {
    roadSegmentsRef.current = roadSegments;
    console.log('roadSegmentsRef updated:', roadSegments.length, 'segments');
    
    // If maps are ready but we just got segments, update now
    if (mapsReadyRef.current && roadSegments.length > 0) {
      console.log('Maps ready and segments loaded, triggering update');
      updateSegmentOnMaps();
    }
  }, [roadSegments]);

  // Fetch segments from API if not provided
  const fetchSegmentsFromAPI = async (roadID) => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/annotator/roads', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const data = await response.json();
      console.log('Segments API response:', data);

      if (data.success && data.data?.roads && data.data.roads.length > 0) {
        // Find the road and get its segments
        const road = data.data.roads.find(r => r.roadID === roadID);
        if (road && road.segments && road.segments.length > 0) {
          console.log('Fetched real segments from API:', road.segments);
          setRoadSegments(road.segments);
          // Update the road data with segments
          const updatedRoad = { ...road, road };
          localStorage.setItem('currentRoad', JSON.stringify(updatedRoad));
          setMessage({
            type: 'success',
            text: `Loaded ${road.segments.length} segments for ${road.roadName}`
          });
        } else {
          console.error('Road not found or has no segments:', roadID);
          setMessage({
            type: 'error',
            text: 'Road segments not available. Please select a different road.'
          });
        }
      } else {
        console.error('No roads found from API');
        setMessage({
          type: 'error',
          text: 'Unable to load road segments. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error fetching segments:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load segments. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load Google Maps API
  const loadGoogleMapsAPI = () => {
    if (document.getElementById('gmap-script-labeling')) {
      setTimeout(() => initializeMaps(), 500);
      return;
    }

    const script = document.createElement('script');
    script.id = 'gmap-script-labeling';
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyB41DRUbKWJHPxaFjMAwdrzWzbVKartNGg&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('Google Maps API loaded for Labeling');
      setTimeout(() => initializeMaps(), 800);
    };
    
    script.onerror = () => {
      console.error('Failed to load Google Maps API');
      setMessage({
        type: 'error',
        text: 'Failed to load maps. Please refresh the page.'
      });
    };
    
    document.head.appendChild(script);
  };

  const initializeMaps = () => {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps API not loaded');
      setMessage({
        type: 'error',
        text: 'Google Maps not available. Please refresh.'
      });
      return;
    }

    try {
      // Get current segment for positioning - use REF to avoid stale closure
      const segments = roadSegmentsRef.current;
      const currentSeg = segments[currentSegmentIndex];
      
      console.log('initializeMaps - segments from ref:', segments.length, 'current index:', currentSegmentIndex);
      
      // Try to get center from: 1) current segment, 2) road's first segment, 3) road's startPoint, 4) default location
      let mapCenter = selectedLocation;
      if (currentSeg?.startPoint) {
        // Calculate center of the segment
        const centerLat = (currentSeg.startPoint.lat + currentSeg.endPoint.lat) / 2;
        const centerLng = (currentSeg.startPoint.lng + currentSeg.endPoint.lng) / 2;
        mapCenter = { lat: centerLat, lng: centerLng };
        console.log('Using current segment center:', mapCenter);
      } else if (segments[0]?.startPoint) {
        const seg = segments[0];
        const centerLat = (seg.startPoint.lat + seg.endPoint.lat) / 2;
        const centerLng = (seg.startPoint.lng + seg.endPoint.lng) / 2;
        mapCenter = { lat: centerLat, lng: centerLng };
        console.log('Using ref first segment center:', mapCenter);
      } else if (road?.segments?.[0]?.startPoint) {
        const seg = road.segments[0];
        const centerLat = (seg.startPoint.lat + seg.endPoint.lat) / 2;
        const centerLng = (seg.startPoint.lng + seg.endPoint.lng) / 2;
        mapCenter = { lat: centerLat, lng: centerLng };;
        console.log('Using road first segment center:', mapCenter);
      } else if (road?.startPoint) {
        mapCenter = road.startPoint;
        console.log('Using road startPoint:', mapCenter);
      }

      // Satellite map (3D view)
      if (satelliteMapRef.current && !satelliteMapInstance.current) {
        const satRect = satelliteMapRef.current.getBoundingClientRect();
        console.log('Satellite map container:', { width: satRect.width, height: satRect.height });
        
        if (satRect.width > 0 && satRect.height > 0) {
          satelliteMapInstance.current = new window.google.maps.Map(satelliteMapRef.current, {
            center: mapCenter,
            zoom: 18,
            mapTypeId: window.google.maps.MapTypeId.SATELLITE,
            mapTypeControl: true,
            zoomControl: true,
            fullscreenControl: true,
            streetViewControl: true, // Enable pegman for Street View
            tilt: 45, // Enable 3D tilt for satellite view
          });
          console.log('Satellite map initialized at:', mapCenter);
          
          // Configure Street View panorama for proper pegman functionality
          const streetViewPanorama = satelliteMapInstance.current.getStreetView();
          streetViewPanorama.setOptions({
            enableCloseButton: true,
            addressControl: true,
            linksControl: true,
            panControl: true,
            zoomControl: true,
            motionTracking: false,
            motionTrackingControl: false
          });
          
          // Listen for Street View visibility changes
          streetViewPanorama.addListener('visible_changed', () => {
            const isVisible = streetViewPanorama.getVisible();
            console.log('Street View visible:', isVisible);
            if (isVisible) {
              const position = streetViewPanorama.getPosition();
              console.log('Street View opened at:', position?.lat(), position?.lng());
            }
          });
          
          // Initialize Street View Service for coverage checking
          const streetViewService = new window.google.maps.StreetViewService();
          
          // Add click listener to open Street View at clicked location
          satelliteMapInstance.current.addListener('dblclick', (event) => {
            const clickedLocation = event.latLng;
            console.log('Double-clicked at:', clickedLocation.lat(), clickedLocation.lng());
            
            // Check for Street View coverage within 50 meters
            streetViewService.getPanorama({
              location: clickedLocation,
              radius: 50,
              preference: window.google.maps.StreetViewPreference.NEAREST
            }, (data, status) => {
              if (status === window.google.maps.StreetViewStatus.OK) {
                console.log('Street View panorama found:', data.location.latLng.lat(), data.location.latLng.lng());
                streetViewPanorama.setPosition(data.location.latLng);
                streetViewPanorama.setPov({
                  heading: 0,
                  pitch: 0
                });
                streetViewPanorama.setVisible(true);
              } else {
                console.log('No Street View coverage at this location');
                setMessage({
                  type: 'info',
                  text: 'No Street View available at this location. Try zooming to roads with blue lines.'
                });
                setTimeout(() => setMessage(null), 3000);
              }
            });
          });
        } else {
          console.warn('Satellite map container not ready, retrying...');
          setTimeout(() => initializeMaps(), 500);
          return;
        }
      }

      // Static/Regular map (2D view)
      if (staticMapRef.current && !staticMapInstance.current) {
        const staticRect = staticMapRef.current.getBoundingClientRect();
        console.log('Static map container:', { width: staticRect.width, height: staticRect.height });
        
        if (staticRect.width > 0 && staticRect.height > 0) {
          staticMapInstance.current = new window.google.maps.Map(staticMapRef.current, {
            center: mapCenter,
            zoom: 18,
            mapTypeId: window.google.maps.MapTypeId.ROADMAP,
            mapTypeControl: true,
            zoomControl: true,
            fullscreenControl: true,
            streetViewControl: false,
          });
          console.log('Static map initialized');
        } else {
          console.warn('Static map container not ready, retrying...');
          setTimeout(() => initializeMaps(), 500);
          return;
        }
      }

      // Mark maps as ready and update segment markers
      if (satelliteMapInstance.current && staticMapInstance.current) {
        mapsReadyRef.current = true;
        console.log('Both maps ready, mapsReadyRef set to true');
        
        // If we have segments, update now; otherwise wait for segments to load
        if (roadSegmentsRef.current.length > 0) {
          console.log('Segments available, updating maps immediately');
          updateSegmentOnMaps();
        } else {
          console.log('Waiting for segments to load before updating maps');
        }
      }
    } catch (error) {
      console.error('Error initializing maps:', error);
      setMessage({
        type: 'error',
        text: 'Error initializing maps: ' + error.message
      });
    }
  };

  // Clear existing markers and polylines
  const clearMapOverlays = () => {
    // Clear satellite markers
    satelliteMarkersRef.current.forEach(marker => marker.setMap(null));
    satelliteMarkersRef.current = [];
    
    // Clear static markers
    staticMarkersRef.current.forEach(marker => marker.setMap(null));
    staticMarkersRef.current = [];
    
    // Clear polylines
    if (satellitePolylineRef.current) {
      satellitePolylineRef.current.setMap(null);
      satellitePolylineRef.current = null;
    }
    if (staticPolylineRef.current) {
      staticPolylineRef.current.setMap(null);
      staticPolylineRef.current = null;
    }
  };

  // Update segment markers and path on both maps
  const updateSegmentOnMaps = () => {
    const segments = roadSegmentsRef.current;
    if (!window.google || !segments || segments.length === 0) {
      console.log('updateSegmentOnMaps - no segments available:', segments?.length);
      return;
    }
    
    const currentSeg = segments[currentSegmentIndex];
    if (!currentSeg || !currentSeg.startPoint || !currentSeg.endPoint) {
      console.warn('Current segment missing start/end points:', currentSeg);
      return;
    }

    console.log('updateSegmentOnMaps - drawing segment', currentSegmentIndex + 1, 'of', segments.length);

    clearMapOverlays();

    const { startPoint, endPoint, path } = currentSeg;
    
    // Create path for polyline - use segment path if available, otherwise straight line
    const polylinePath = path && path.length > 0 ? path : [startPoint, endPoint];

    // Add markers and polyline to Satellite Map
    if (satelliteMapInstance.current) {
      // Start marker (Green A)
      const satStartMarker = new window.google.maps.Marker({
        position: startPoint,
        map: satelliteMapInstance.current,
        title: 'Segment Start',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3
        },
        label: {
          text: 'A',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 'bold'
        }
      });
      satelliteMarkersRef.current.push(satStartMarker);

      // End marker (Red B)
      const satEndMarker = new window.google.maps.Marker({
        position: endPoint,
        map: satelliteMapInstance.current,
        title: 'Segment End',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3
        },
        label: {
          text: 'B',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 'bold'
        }
      });
      satelliteMarkersRef.current.push(satEndMarker);

      // Polyline showing the path
      satellitePolylineRef.current = new window.google.maps.Polyline({
        path: polylinePath,
        geodesic: true,
        strokeColor: '#fbbf24',
        strokeOpacity: 1,
        strokeWeight: 5,
        map: satelliteMapInstance.current
      });

      // Fit bounds to show the entire segment path
      const satBounds = new window.google.maps.LatLngBounds();
      polylinePath.forEach(point => satBounds.extend(point));
      satelliteMapInstance.current.fitBounds(satBounds, { padding: 60 });
      
      // Ensure appropriate zoom level after fitBounds
      window.google.maps.event.addListenerOnce(satelliteMapInstance.current, 'idle', () => {
        const zoom = satelliteMapInstance.current.getZoom();
        if (zoom > 19) satelliteMapInstance.current.setZoom(19);
        if (zoom < 16) satelliteMapInstance.current.setZoom(16);
      });
    }

    // Add markers and polyline to Static Map
    if (staticMapInstance.current) {
      // Start marker (Green A)
      const staticStartMarker = new window.google.maps.Marker({
        position: startPoint,
        map: staticMapInstance.current,
        title: 'Segment Start',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3
        },
        label: {
          text: 'A',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 'bold'
        }
      });
      staticMarkersRef.current.push(staticStartMarker);

      // End marker (Red B)
      const staticEndMarker = new window.google.maps.Marker({
        position: endPoint,
        map: staticMapInstance.current,
        title: 'Segment End',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3
        },
        label: {
          text: 'B',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 'bold'
        }
      });
      staticMarkersRef.current.push(staticEndMarker);

      // Polyline showing the path
      staticPolylineRef.current = new window.google.maps.Polyline({
        path: polylinePath,
        geodesic: true,
        strokeColor: '#0066cc',
        strokeOpacity: 1,
        strokeWeight: 5,
        map: staticMapInstance.current
      });

      // Fit bounds to show the entire segment path
      const staticBounds = new window.google.maps.LatLngBounds();
      polylinePath.forEach(point => staticBounds.extend(point));
      staticMapInstance.current.fitBounds(staticBounds, { padding: 60 });
      
      // Ensure appropriate zoom level after fitBounds
      window.google.maps.event.addListenerOnce(staticMapInstance.current, 'idle', () => {
        const zoom = staticMapInstance.current.getZoom();
        if (zoom > 19) staticMapInstance.current.setZoom(19);
        if (zoom < 16) staticMapInstance.current.setZoom(16);
      });
    }

    // Update selected location to segment center
    const centerLat = (startPoint.lat + endPoint.lat) / 2;
    const centerLng = (startPoint.lng + endPoint.lng) / 2;
    setSelectedLocation({ lat: centerLat, lng: centerLng });
    console.log('Maps centered on segment:', currentSegmentIndex + 1, 'at', { lat: centerLat, lng: centerLng });
  };

  // Update maps when segment changes
  useEffect(() => {
    if (satelliteMapInstance.current && staticMapInstance.current && roadSegments.length > 0) {
      console.log('Updating maps for segment', currentSegmentIndex + 1, 'of', roadSegments.length);
      updateSegmentOnMaps();
    }
  }, [currentSegmentIndex, roadSegments]);

  // Re-center maps when road data becomes available
  useEffect(() => {
    if (road && road.segments && road.segments.length > 0) {
      // If maps exist but weren't properly centered, update them now
      if (satelliteMapInstance.current && staticMapInstance.current) {
        console.log('Road data loaded, re-centering maps on first segment');
        updateSegmentOnMaps();
      }
    }
  }, [road]);

  // Handle label changes
  const handleRoadsideChange = (field, value) => {
    setRoadsideData(prev => ({ ...prev, [field]: value }));
  };

  const handleIntersectionChange = (field, value) => {
    setIntersectionData(prev => ({ ...prev, [field]: value }));
  };

  const handleSpeedChange = (field, value) => {
    setSpeedData(prev => ({ ...prev, [field]: value }));
  };

  // Save labels
  const handleSaveSegmentLabels = async () => {
    // Validate segments exist
    if (!roadSegments || roadSegments.length === 0) {
      setMessage({ 
        type: 'error', 
        text: 'No segments available. Please return to map selection and choose a valid road.' 
      });
      return;
    }

    if (!road || !roadSegments[currentSegmentIndex]) {
      setMessage({ type: 'error', text: 'Please select a road and segment' });
      return;
    }

    // Additional validation for segment ID format
    const segment = roadSegments[currentSegmentIndex];
    const isValidSegmentID = segment.segmentID && typeof segment.segmentID === 'string' && segment.segmentID.length > 0;
    if (!isValidSegmentID) {
      setMessage({ 
        type: 'error', 
        text: 'Invalid segment ID. Road segments may not have been loaded properly. Please refresh and try again.' 
      });
      console.error('Invalid segment ID detected:', segment);
      return;
    }

    setLoading(true);
    try {
      const labelPayload = {
        segmentID: segment.segmentID,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        roadsideData: {
          leftObject: roadsideData.leftObject,
          rightObject: roadsideData.rightObject,
          distanceObject: roadsideData.distanceObject,
        },
        intersectionData: {
          type: intersectionData.type,
          quality: intersectionData.quality,
          channelisation: intersectionData.channelisation,
        },
        speedData: {
          speedLimit: speedData.speedLimit,
          management: speedData.management,
        },
      };

      console.log('Submitting label with payload:', labelPayload);
      
      let response;
      
      // Use complaint-specific API if in complaint mode
      if (isComplaintMode && complaintData) {
        console.log('Submitting complaint label for feedback ID:', complaintData.feedbackID);
        response = await annotatorAPI.submitComplaintLabel({
          feedbackID: complaintData.feedbackID,
          segmentID: segment.segmentID,
          labelData: {
            roadside: roadsideData,
            intersection: intersectionData,
            speed: speedData
          },
          annotatorRemarks: `Relabeled for complaint: ${complaintData.description || 'No description'}`
        });
      } else {
        response = await annotatorAPI.submitLabel(labelPayload);
      }
      
      console.log('Label submission response:', response);

      if (response.success) {
        if (isComplaintMode) {
          setMessage({
            type: 'success',
            text: `✓ Complaint label submitted for review! Returning to dashboard...`
          });
          setTimeout(() => {
            navigate('/analyst-dashboard', { state: { refreshData: true } });
          }, 2000);
        } else {
          setMessage({
            type: 'success',
            text: `✓ Labels saved for segment ${currentSegmentIndex + 1}!`
          });

          // Move to next segment
          if (currentSegmentIndex < roadSegments.length - 1) {
            setTimeout(() => {
              setCurrentSegmentIndex(currentSegmentIndex + 1);
              resetSegmentLabels();
              setMessage({ type: '', text: '' });
            }, 1500);
          } else {
            // Allow option to continue labeling the same road or go to dashboard
            setMessage({ type: 'success', text: 'All segments labeled successfully! You can continue labeling or go back.' });
            setTimeout(() => {
              // Stay on this page - don't force navigation
              setCurrentSegmentIndex(0);
              resetSegmentLabels();
              setMessage({ type: 'success', text: 'Ready to label the same road again or go back to map.' });
            }, 3000);
          }
        }
      } else {
        // Handle error response from backend
        console.error('Error response from server:', response);
        setMessage({ 
          type: 'error', 
          text: response.message || 'Failed to save labels. Please try again.' 
        });
      }
    } catch (error) {
      console.error('Failed to save labels:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        data: error.data
      });
      
      // Show detailed error message
      const errorMessage = error.data?.message || error.message || 'Failed to save labels. Please try again.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const resetSegmentLabels = () => {
    setRoadsideData({ leftObject: null, rightObject: null, distanceObject: null });
    setIntersectionData({ type: null, quality: null, channelisation: null });
    setSpeedData({ speedLimit: null, management: null });
  };

  if (!road) {
    return (
      <div className="labeling-container">
        <div className="loading-message">
          <p>Loading road data... If this persists, please go back and select a road.</p>
          <button className="back-to-map-btn" onClick={() => navigate('/road-labeling')}>
            ← Back to Map Selection
          </button>
        </div>
      </div>
    );
  }

  const currentSegment = roadSegments[currentSegmentIndex];

  return (
    <div className="labeling-container">
      {message.text && (
        <div className={`dashboard-message ${message.type}-box`}>
          {message.text}
        </div>
      )}

      <div className="labeling-content">
        {/* Maps Section - Top 50% */}
        <div className="maps-section">
          <div className="maps-header">
            <h3>Segment {currentSegmentIndex + 1}: {currentSegment?.segmentName || 'Loading...'}</h3>
            <div className="segment-info">
              <span className="info-badge">📏 {currentSegment?.distance || 0}m</span>
              <span className="info-badge start">A: Start</span>
              <span className="info-badge end">B: End</span>
            </div>
          </div>

          <div className="maps-grid">
            <div className="map-container">
              <div className="map-title">🛰️ 3D Satellite View</div>
              <div ref={satelliteMapRef} className="map"></div>
            </div>
            <div className="map-container">
              <div className="map-title">🗺️ 2D Street Map</div>
              <div ref={staticMapRef} className="map"></div>
            </div>
          </div>

          {/* Segment Navigation */}
          <div className="segment-navigation">
            <button 
              className="nav-btn prev"
              onClick={() => setCurrentSegmentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentSegmentIndex === 0}
            >
              ← Previous
            </button>
            <div className="segment-dots">
              {roadSegments.map((_, idx) => (
                <button
                  key={idx}
                  className={`dot ${idx === currentSegmentIndex ? 'active' : ''}`}
                  onClick={() => setCurrentSegmentIndex(idx)}
                  title={`Segment ${idx + 1}`}
                />
              ))}
            </div>
            <button 
              className="nav-btn next"
              onClick={() => setCurrentSegmentIndex(prev => Math.min(roadSegments.length - 1, prev + 1))}
              disabled={currentSegmentIndex === roadSegments.length - 1}
            >
              Next →
            </button>
          </div>
        </div>

        {/* Labeling Section - Bottom 50% */}
        <div className="labeling-section">
          {/* Section Buttons */}
          <div className="section-buttons">
            <button
              className={`section-btn ${selectedTab === 'Roadside' ? 'active' : ''}`}
              onClick={() => setSelectedTab('Roadside')}
            >
              Roadside
            </button>
            <button
              className={`section-btn ${selectedTab === 'Intersection' ? 'active' : ''}`}
              onClick={() => setSelectedTab('Intersection')}
            >
              Intersection
            </button>
            <button
              className={`section-btn ${selectedTab === 'Speed' ? 'active' : ''}`}
              onClick={() => setSelectedTab('Speed')}
            >
              Speed
            </button>
          </div>

          {/* Form Content */}
          <div className="form-content">
            {selectedTab === 'Roadside' && (
              <div className="form-section">
                <h3>🛣️ Roadside Features</h3>

                <div className="form-group">
                  <label>Left Object Type</label>
                  <div className="button-group">
                    {LEFT_OBJECTS.map(obj => (
                      <button
                        key={obj}
                        className={`option-btn ${roadsideData.leftObject === obj ? 'active' : ''}`}
                        onClick={() => handleRoadsideChange('leftObject', roadsideData.leftObject === obj ? null : obj)}
                      >
                        {obj}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Right Object Type</label>
                  <div className="button-group">
                    {RIGHT_OBJECTS.map(obj => (
                      <button
                        key={obj}
                        className={`option-btn ${roadsideData.rightObject === obj ? 'active' : ''}`}
                        onClick={() => handleRoadsideChange('rightObject', roadsideData.rightObject === obj ? null : obj)}
                      >
                        {obj}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Distance to Objects (km)</label>
                  <div className="button-group">
                    {DISTANCE_OPTIONS.map(dist => (
                      <button
                        key={dist}
                        className={`option-btn ${roadsideData.distanceObject === dist ? 'active' : ''}`}
                        onClick={() => handleRoadsideChange('distanceObject', roadsideData.distanceObject === dist ? null : dist)}
                      >
                        {dist}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'Intersection' && (
              <div className="form-section">
                <h3>🤝 Intersection Features</h3>

                <div className="form-group">
                  <label>Intersection Type</label>
                  <div className="button-group">
                    {INTERSECTION_TYPES.map(type => (
                      <button
                        key={type}
                        className={`option-btn ${intersectionData.type === type ? 'active' : ''}`}
                        onClick={() => handleIntersectionChange('type', intersectionData.type === type ? null : type)}
                      >
                        {type.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Quality</label>
                  <div className="button-group">
                    {INTERSECTION_QUALITIES.map(quality => (
                      <button
                        key={quality}
                        className={`option-btn ${intersectionData.quality === quality ? 'active' : ''}`}
                        onClick={() => handleIntersectionChange('quality', intersectionData.quality === quality ? null : quality)}
                      >
                        {quality.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Channelisation</label>
                  <div className="button-group">
                    {CHANNELISATION_OPTIONS.map(chan => (
                      <button
                        key={chan}
                        className={`option-btn ${intersectionData.channelisation === chan ? 'active' : ''}`}
                        onClick={() => handleIntersectionChange('channelisation', intersectionData.channelisation === chan ? null : chan)}
                      >
                        {chan.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'Speed' && (
              <div className="form-section">
                <h3>⚡ Speed Features</h3>

                <div className="form-group">
                  <label>Speed Limit</label>
                  <div className="button-group">
                    {SPEED_LIMIT_OPTIONS.map(option => (
                      <button
                        key={option}
                        className={`option-btn ${speedData.speedLimit === option ? 'active' : ''}`}
                        onClick={() => handleSpeedChange('speedLimit', speedData.speedLimit === option ? null : option)}
                      >
                        {option.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Speed Management (km/h)</label>
                  <div className="button-group">
                    {SPEED_MANAGEMENT_OPTIONS.map(speed => (
                      <button
                        key={speed}
                        className={`option-btn ${speedData.management === speed ? 'active' : ''}`}
                        onClick={() => handleSpeedChange('management', speedData.management === speed ? null : speed)}
                      >
                        {speed} km/h
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="labeling-actions">
            <button
              className="action-btn save-btn"
              onClick={handleSaveSegmentLabels}
              disabled={loading || !roadSegments || roadSegments.length === 0}
              title={!roadSegments || roadSegments.length === 0 ? 'Road segments not loaded. Please return and select a valid road.' : ''}
            >
              {loading ? 'Saving...' : `Save Segment ${currentSegmentIndex + 1}`}
            </button>
          </div>
        </div>
      </div>

      {/* Back Button at Bottom */}
      <div className="bottom-back-bar">
        <button className="back-to-map-btn" onClick={() => navigate('/road-labeling')}>
          ← Back to Map Selection
        </button>
      </div>
    </div>
  );
};

export default Labeling;
