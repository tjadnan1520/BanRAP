import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MapSelection.css';

const MapSelection = ({ complaintData }) => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const segmentMarkersRef = useRef([]);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const complaintMarkerRef = useRef(null);

  // Parse complaint coordinates if available
  const getComplaintLocation = () => {
    if (complaintData?.coordinates) {
      try {
        const coords = typeof complaintData.coordinates === 'string' 
          ? JSON.parse(complaintData.coordinates) 
          : complaintData.coordinates;
        if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
          return coords;
        }
      } catch (e) {
        console.error('Error parsing complaint coordinates:', e);
      }
    }
    return null;
  };

  const complaintLocation = getComplaintLocation();
  const [selectedLocation, setSelectedLocation] = useState(
    complaintLocation || { lat: 23.8103, lng: 90.4441 }
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Start and End point selection
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [segments, setSegments] = useState([]);
  const [routePath, setRoutePath] = useState([]); // Full road path from Directions API
  const [selectionMode, setSelectionMode] = useState('idle'); // 'idle', 'selectingStart', 'selectingEnd'
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  
  // Complaint mode state
  const [isComplaintMode, setIsComplaintMode] = useState(false);

  // Initialize map on mount
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (!user) {
      const mockUser = {
        email: 'test@example.com',
        name: 'Test User',
        role: 'annotator',
        phone: '01234567890'
      };
      localStorage.setItem('currentUser', JSON.stringify(mockUser));
    }
    
    // Check if we have complaint data
    if (complaintData) {
      setIsComplaintMode(true);
      setMessage({
        type: 'info',
        text: `Relabeling for complaint: ${complaintData.roadName || 'Road'} - ${complaintData.segmentLabel || 'Segment'}`
      });
    }
    
    // Load Google Maps API with better error handling
    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        console.log('Google Maps already loaded');
        setTimeout(() => initializeMap(), 500);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyB41DRUbKWJHPxaFjMAwdrzWzbVKartNGg&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('Google Maps API loaded successfully');
        setTimeout(() => initializeMap(), 800);
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

    loadGoogleMaps();
  }, [complaintData]);

  // Calculate distance between two points in meters using Haversine formula
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate intermediate point between two coordinates
  const getIntermediatePoint = (start, end, fraction) => {
    const lat = start.lat + (end.lat - start.lat) * fraction;
    const lng = start.lng + (end.lng - start.lng) * fraction;
    return { lat, lng };
  };

  // Get route from Directions API and generate segments along the road
  const getRouteAndGenerateSegments = async (start, end) => {
    if (!window.google || !window.google.maps) {
      setMessage({ type: 'error', text: 'Maps not ready. Please try again.' });
      return;
    }

    // Initialize DirectionsService if not already done
    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new window.google.maps.DirectionsService();
    }

    setCalculatingRoute(true);
    setMessage({ type: '', text: 'Calculating route along road...' });

    const request = {
      origin: start,
      destination: end,
      travelMode: window.google.maps.TravelMode.DRIVING,
    };

    directionsServiceRef.current.route(request, (result, status) => {
      setCalculatingRoute(false);

      if (status === window.google.maps.DirectionsStatus.OK) {
        const route = result.routes[0];
        const leg = route.legs[0];
        
        // Extract all points from the route path
        const path = [];
        route.overview_path.forEach(point => {
          path.push({ lat: point.lat(), lng: point.lng() });
        });
        
        // For more detailed path, use the steps
        const detailedPath = [];
        leg.steps.forEach(step => {
          step.path.forEach(point => {
            detailedPath.push({ lat: point.lat(), lng: point.lng() });
          });
        });

        setRoutePath(detailedPath);
        
        // Generate 100-meter segments along the road path
        const totalDistanceMeters = leg.distance.value;
        const newSegments = generateSegmentsFromPath(detailedPath, totalDistanceMeters);
        setSegments(newSegments);
        
        setMessage({ 
          type: 'success', 
          text: `Route found: ${leg.distance.text} (${newSegments.length} segments)` 
        });
      } else {
        console.error('Directions request failed:', status);
        setMessage({ 
          type: 'error', 
          text: 'Could not find route along roads. Try different points.' 
        });
      }
    });
  };

  // Generate 100-meter segments from the road path
  const generateSegmentsFromPath = (path, totalDistance) => {
    if (path.length < 2) return [];

    const segmentLength = 100; // 100 meters
    const numSegments = Math.ceil(totalDistance / segmentLength);
    const newSegments = [];

    // Calculate cumulative distances along the path
    const cumulativeDistances = [0];
    for (let i = 1; i < path.length; i++) {
      const dist = calculateDistance(
        path[i-1].lat, path[i-1].lng,
        path[i].lat, path[i].lng
      );
      cumulativeDistances.push(cumulativeDistances[i-1] + dist);
    }
    const actualTotalDistance = cumulativeDistances[cumulativeDistances.length - 1];

    // Generate segments
    for (let i = 0; i < numSegments; i++) {
      const startDistance = i * segmentLength;
      const endDistance = Math.min((i + 1) * segmentLength, actualTotalDistance);
      
      const segmentStartPoint = getPointAtDistance(path, cumulativeDistances, startDistance);
      const segmentEndPoint = getPointAtDistance(path, cumulativeDistances, endDistance);
      
      // Get all path points for this segment
      const segmentPath = getPathBetweenDistances(path, cumulativeDistances, startDistance, endDistance);

      newSegments.push({
        segmentID: `SEG_${String(i + 1).padStart(3, '0')}`,
        segmentName: `Segment ${i + 1}`,
        segmentNumber: i + 1,
        startPoint: segmentStartPoint,
        endPoint: segmentEndPoint,
        path: segmentPath,
        distance: Math.round(endDistance - startDistance),
        status: 'pending'
      });
    }
    
    return newSegments;
  };

  // Get the point at a specific distance along the path
  const getPointAtDistance = (path, cumulativeDistances, targetDistance) => {
    for (let i = 1; i < path.length; i++) {
      if (cumulativeDistances[i] >= targetDistance) {
        const prevDist = cumulativeDistances[i-1];
        const segmentDist = cumulativeDistances[i] - prevDist;
        const fraction = segmentDist > 0 ? (targetDistance - prevDist) / segmentDist : 0;
        return getIntermediatePoint(path[i-1], path[i], fraction);
      }
    }
    return path[path.length - 1];
  };

  // Get all path points between two distances
  const getPathBetweenDistances = (path, cumulativeDistances, startDist, endDist) => {
    const result = [];
    const startPoint = getPointAtDistance(path, cumulativeDistances, startDist);
    result.push(startPoint);

    for (let i = 1; i < path.length; i++) {
      if (cumulativeDistances[i] > startDist && cumulativeDistances[i] < endDist) {
        result.push(path[i]);
      }
    }

    const endPoint = getPointAtDistance(path, cumulativeDistances, endDist);
    result.push(endPoint);
    return result;
  };

  // Update map markers and polyline when points change
  const updateMapOverlays = () => {
    if (!mapInstance.current || !window.google) return;

    // Clear existing markers
    if (startMarkerRef.current) {
      startMarkerRef.current.setMap(null);
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.setMap(null);
    }
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }
    segmentMarkersRef.current.forEach(marker => marker.setMap(null));
    segmentMarkersRef.current = [];

    // Add start marker
    if (startPoint) {
      startMarkerRef.current = new window.google.maps.Marker({
        position: startPoint,
        map: mapInstance.current,
        title: 'Start Point',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
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
    }

    // Add end marker
    if (endPoint) {
      endMarkerRef.current = new window.google.maps.Marker({
        position: endPoint,
        map: mapInstance.current,
        title: 'End Point',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
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
    }

    // Draw polyline along the actual road path
    if (routePath.length > 0) {
      polylineRef.current = new window.google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#0066cc',
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map: mapInstance.current
      });

      // Add segment markers along the road path
      segments.forEach((seg, idx) => {
        // Get midpoint of segment path
        const segPath = seg.path || [seg.startPoint, seg.endPoint];
        const midIndex = Math.floor(segPath.length / 2);
        const midPoint = segPath[midIndex] || seg.startPoint;
        
        const marker = new window.google.maps.Marker({
          position: midPoint,
          map: mapInstance.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#fbbf24',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2
          },
          label: {
            text: String(idx + 1),
            color: '#000',
            fontSize: '11px',
            fontWeight: 'bold'
          },
          title: `Segment ${idx + 1} (${seg.distance}m)`
        });
        segmentMarkersRef.current.push(marker);
      });
    }
  };

  // Update overlays when points or segments change
  useEffect(() => {
    updateMapOverlays();
  }, [startPoint, endPoint, segments, routePath]);

  // Set the center of the map as start or end point
  const setPointFromCenter = () => {
    if (!mapInstance.current) return;
    
    const center = mapInstance.current.getCenter();
    const point = { lat: center.lat(), lng: center.lng() };
    
    if (selectionMode === 'selectingStart') {
      setStartPoint(point);
      setSelectionMode('idle');
      setMessage({ type: 'success', text: 'Start point set! Now set the end point.' });
      
      // If end point exists, recalculate route along roads
      if (endPoint) {
        getRouteAndGenerateSegments(point, endPoint);
      }
    } else if (selectionMode === 'selectingEnd') {
      setEndPoint(point);
      setSelectionMode('idle');
      setMessage({ type: 'success', text: 'End point set!' });
      
      // If start point exists, calculate route along roads
      if (startPoint) {
        getRouteAndGenerateSegments(startPoint, point);
      }
    }
  };

  // Update selectedLocation as map moves
  const handleMapCenterChanged = () => {
    if (mapInstance.current) {
      const center = mapInstance.current.getCenter();
      setSelectedLocation({
        lat: center.lat(),
        lng: center.lng()
      });
    }
  };

  const initializeMap = () => {
    console.log('initializeMap called');
    console.log('mapRef.current exists:', !!mapRef.current);
    
    if (!mapRef.current) {
      console.error('mapRef.current is null - container not ready');
      return;
    }

    // Log container dimensions
    const rect = mapRef.current.getBoundingClientRect();
    console.log('Map container dimensions:', {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left
    });

    if (!window.google || !window.google.maps) {
      console.error('Google Maps API not available');
      console.log('window.google:', window.google);
      setMessage({
        type: 'error',
        text: 'Google Maps API not loaded. Please refresh.'
      });
      return;
    }

    try {
      console.log('Creating map instance with center:', selectedLocation);
      
      // Ensure the container has dimensions before creating map
      if (rect.width === 0 || rect.height === 0) {
        console.warn('Map container has zero dimensions, waiting...');
        setTimeout(() => initializeMap(), 500);
        return;
      }

      // Use complaint location if available, otherwise use default
      const mapCenter = complaintLocation || selectedLocation;
      
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: mapCenter,
        zoom: complaintLocation ? 18 : 15, // Zoom in more for complaint location
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: false,
      });

      // Add complaint location marker if we have complaint coordinates
      if (complaintLocation && complaintData) {
        // Remove existing complaint marker if any
        if (complaintMarkerRef.current) {
          complaintMarkerRef.current.setMap(null);
        }
        
        complaintMarkerRef.current = new window.google.maps.Marker({
          position: complaintLocation,
          map: mapInstance.current,
          title: 'Complaint Location',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#e74c3c',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
            scale: 12,
          },
          animation: window.google.maps.Animation.DROP,
          zIndex: 1000,
        });

        // Add info window for complaint marker
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 10px; min-width: 200px;">
              <h4 style="margin: 0 0 8px 0; color: #e74c3c;">📍 Complaint Location</h4>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Road:</strong> ${complaintData?.roadName || 'Unknown'}</p>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">Label the road segment at this location</p>
            </div>
          `
        });

        complaintMarkerRef.current.addListener('click', () => {
          infoWindow.open(mapInstance.current, complaintMarkerRef.current);
        });

        // Open info window automatically
        setTimeout(() => {
          infoWindow.open(mapInstance.current, complaintMarkerRef.current);
        }, 500);
      }

      // Initialize Directions Service for routing along roads
      directionsServiceRef.current = new window.google.maps.DirectionsService();
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true, // We'll use custom markers
        suppressPolylines: true, // We'll draw our own polyline
      });
      directionsRendererRef.current.setMap(mapInstance.current);

      console.log('Map and Directions service created successfully');

      // Add center changed listener to track map position
      mapInstance.current.addListener('center_changed', handleMapCenterChanged);
      mapInstance.current.addListener('idle', handleMapCenterChanged);

      console.log('Map initialization complete');
    } catch (error) {
      console.error('Error creating map:', error);
      setMessage({
        type: 'error',
        text: 'Error initializing map: ' + error.message
      });
    }
  };

  // Ensure map is rendered after DOM is ready
  useEffect(() => {
    if (mapRef.current && window.google && window.google.maps && !mapInstance.current) {
      console.log('DOM ready, initializing map');
      initializeMap();
    }
  }, []);

  // Reset selection
  const resetSelection = () => {
    setStartPoint(null);
    setEndPoint(null);
    setSegments([]);
    setRoutePath([]);
    setSelectionMode('idle');
    setMessage({ type: '', text: '' });
  };

  // Create custom road from segments and proceed to labeling
  const handleCreateCustomRoad = async () => {
    if (segments.length === 0) {
      setMessage({ type: 'error', text: 'Please set start and end points first' });
      return;
    }

    const totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0);
    
    setMessage({ type: 'info', text: 'Saving road to database...' });

    try {
      // First, save the road and segments to the database
      const response = await fetch('http://localhost:5000/api/annotator/map/create-road', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          roadName: 'Custom Road Path',
          startPoint: startPoint,
          endPoint: endPoint,
          segments: segments,
          routePath: routePath,
          totalDistance: totalDistance
        })
      });

      const data = await response.json();
      console.log('Create road API response:', data);

      if (!data.success) {
        setMessage({ type: 'error', text: data.message || 'Failed to save road' });
        return;
      }

      // Use the road data returned from the API (with real database IDs)
      const savedRoad = {
        roadID: data.data.road.roadID,
        roadName: data.data.road.roadName,
        location: `${startPoint.lat.toFixed(4)}, ${startPoint.lng.toFixed(4)}`,
        isVerified: false,
        segments: data.data.segments, // Use segments from DB with real segmentIDs
        routePath: data.data.routePath || routePath,
        startPoint: data.data.road.startPoint || startPoint,
        endPoint: data.data.road.endPoint || endPoint,
        totalDistance: data.data.road.totalDistance || totalDistance
      };

      console.log('Saved road with DB segments:', savedRoad);
      setMessage({ type: 'success', text: `Road saved! Proceeding with ${savedRoad.segments.length} segments...` });
      
      // Use the actual startPoint as the exact location
      const exactLocation = startPoint;
      console.log('Passing exact location (startPoint):', exactLocation);
      
      // Save to localStorage for persistence
      localStorage.setItem('currentRoad', JSON.stringify(savedRoad));
      localStorage.setItem('selectedLocation', JSON.stringify(exactLocation));
      
      setTimeout(() => {
        // Pass complaint data if in complaint mode
        const navState = { 
          road: savedRoad, 
          selectedLocation: exactLocation,
          complaintData: isComplaintMode ? complaintData : null
        };
        navigate('/road-labeling/label', { state: navState });
      }, 500);

    } catch (error) {
      console.error('Error saving road:', error);
      setMessage({ type: 'error', text: 'Failed to save road: ' + error.message });
    }
  };

  // Focus on a specific segment on the map
  const focusSegment = (segment) => {
    if (mapInstance.current && segment.startPoint) {
      // Use the segment path if available, otherwise use start/end points
      const segPath = segment.path || [segment.startPoint, segment.endPoint];
      const midIndex = Math.floor(segPath.length / 2);
      const midPoint = segPath[midIndex] || segment.startPoint;
      
      mapInstance.current.panTo(midPoint);
      mapInstance.current.setZoom(18);
    }
  };

  return (
    <div className="map-selection-container">
      <div className="map-selection-header">
        <div className="header-content">
          <h1>{isComplaintMode ? '🏷️ Relabel Road for Complaint' : 'Select Road Path'}</h1>
          <p className="header-subtitle">
            {isComplaintMode 
              ? 'Label the road segment to resolve the complaint' 
              : 'Use the crosshair to select start and end points'}
          </p>
        </div>
        <button className="back-button" onClick={() => navigate('/analyst-dashboard')}>
          Back
        </button>
      </div>

      {/* Complaint Info Banner */}
      {isComplaintMode && complaintData && complaintData.description && (
        <div className="complaint-info-banner">
          <div className="complaint-banner-content">
            <div className="complaint-description">
              <strong>📢 Issue:</strong> {complaintData.description}
            </div>
          </div>
        </div>
      )}

      {message.text && (
        <div className={`dashboard-message ${message.type}-box`}>
          {message.text}
        </div>
      )}

      <div className="map-selection-content">
        <div className="full-map-wrapper">
          <div ref={mapRef} className="full-map"></div>
          
          {/* Crosshair overlay */}
          <div className="crosshair-overlay">
            <div className="crosshair">
              <div className="crosshair-horizontal"></div>
              <div className="crosshair-vertical"></div>
              <div className="crosshair-center"></div>
            </div>
          </div>

          {/* Point selection buttons */}
          <div className="point-selection-controls">
            <button 
              className={`point-btn start-btn ${selectionMode === 'selectingStart' ? 'active' : ''} ${startPoint ? 'set' : ''}`}
              onClick={() => {
                if (selectionMode === 'selectingStart') {
                  setPointFromCenter();
                } else {
                  setSelectionMode('selectingStart');
                  setMessage({ type: '', text: 'Move the map to position the crosshair at start point, then click again' });
                }
              }}
            >
              {selectionMode === 'selectingStart' ? '✓ Confirm Start' : startPoint ? 'A: Start Set' : 'Set Start Point (A)'}
            </button>
            
            <button 
              className={`point-btn end-btn ${selectionMode === 'selectingEnd' ? 'active' : ''} ${endPoint ? 'set' : ''}`}
              onClick={() => {
                if (selectionMode === 'selectingEnd') {
                  setPointFromCenter();
                } else {
                  setSelectionMode('selectingEnd');
                  setMessage({ type: '', text: 'Move the map to position the crosshair at end point, then click again' });
                }
              }}
            >
              {selectionMode === 'selectingEnd' ? '✓ Confirm End' : endPoint ? 'B: End Set' : 'Set End Point (B)'}
            </button>

            {(startPoint || endPoint) && (
              <button className="point-btn reset-btn" onClick={resetSelection}>
                Reset
              </button>
            )}
          </div>

          {/* Mode indicator */}
          {selectionMode !== 'idle' && (
            <div className="selection-mode-indicator">
              <span className="mode-text">
                {selectionMode === 'selectingStart' ? 'Position crosshair at START point' : 'Position crosshair at END point'}
              </span>
            </div>
          )}

          {/* Calculating route indicator */}
          {calculatingRoute && (
            <div className="calculating-indicator">
              <div className="spinner"></div>
              <span>Calculating route along road...</span>
            </div>
          )}
        </div>

        <div className="road-selection-panel">
          <div className="panel-header">
            <h2>Road Segments</h2>
            <div className="location-info">
              <p><strong>Lat:</strong> {selectedLocation.lat.toFixed(4)}</p>
              <p><strong>Lng:</strong> {selectedLocation.lng.toFixed(4)}</p>
            </div>
          </div>

          {/* Points Info */}
          <div className="points-info">
            <div className={`point-indicator ${startPoint ? 'set' : ''}`}>
              <span className="point-label start">A</span>
              <span className="point-coords">
                {startPoint ? `${startPoint.lat.toFixed(5)}, ${startPoint.lng.toFixed(5)}` : 'Not set'}
              </span>
            </div>
            <div className="path-connector">
              {segments.length > 0 && <span className="distance-label">{segments.reduce((sum, s) => sum + s.distance, 0)}m</span>}
            </div>
            <div className={`point-indicator ${endPoint ? 'set' : ''}`}>
              <span className="point-label end">B</span>
              <span className="point-coords">
                {endPoint ? `${endPoint.lat.toFixed(5)}, ${endPoint.lng.toFixed(5)}` : 'Not set'}
              </span>
            </div>
          </div>

          <div className="roads-list-container">
            {segments.length === 0 ? (
              <div className="empty-segments">
                <div className="empty-icon">📍</div>
                <p className="empty-text">Set start and end points to generate 100m segments</p>
                <ol className="instructions-list">
                  <li>Click "Set Start Point (A)"</li>
                  <li>Move map to position crosshair</li>
                  <li>Click "Confirm Start"</li>
                  <li>Repeat for End Point (B)</li>
                </ol>
              </div>
            ) : (
              <>
                <div className="segments-summary">
                  <span className="summary-item">{segments.length} segments</span>
                  <span className="summary-item">{segments.reduce((sum, s) => sum + s.distance, 0)}m total</span>
                </div>
                <div className="segments-list">
                  {segments.map((segment, index) => (
                    <div 
                      key={segment.segmentID} 
                      className="segment-item"
                      onClick={() => focusSegment(segment)}
                    >
                      <div className="segment-number">{index + 1}</div>
                      <div className="segment-details">
                        <span className="segment-name">{segment.segmentName}</span>
                        <span className="segment-distance">{segment.distance}m</span>
                      </div>
                      <span className={`segment-status ${segment.status}`}>
                        {segment.status === 'pending' ? '⏳' : '✓'}
                      </span>
                    </div>
                  ))}
                </div>
                <button className="proceed-btn" onClick={handleCreateCustomRoad}>
                  Proceed to Labeling →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapSelection;
