import React, { useState, useEffect, useRef, useCallback } from 'react';
import { travellerAPI } from '../utils/api.js';
import '../styles/SafetyNavigation.css';

const GOOGLE_MAPS_API_KEY = 'AIzaSyB41DRUbKWJHPxaFjMAwdrzWzbVKartNGg';

const SafetyNavigation = ({ onClose }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const directionsService = useRef(null);
  const directionsRenderer = useRef(null);
  const startAutocomplete = useRef(null);
  const endAutocomplete = useRef(null);
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [startLocation, setStartLocation] = useState('Mokarram Bhaban, University of Dhaka');
  const [endLocation, setEndLocation] = useState('');
  const [travelMode, setTravelMode] = useState('DRIVING');
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showDirections, setShowDirections] = useState(false);
  const [roads, setRoads] = useState([]);
  const [ratings, setRatings] = useState({});
  const [routeSafetyRating, setRouteSafetyRating] = useState(null);
  const ratingMarkersRef = useRef([]);

  // Helper function to parse coordinates from JSON string
  const parseCoords = (coordStr) => {
    if (!coordStr) return null;
    try {
      if (typeof coordStr === 'object') return coordStr;
      const parsed = JSON.parse(coordStr);
      return { lat: parseFloat(parsed.lat), lng: parseFloat(parsed.lng) };
    } catch (e) {
      console.warn('Failed to parse coordinates:', coordStr);
      return null;
    }
  };

  // Calculate midpoint between two coordinates
  const getMidpoint = (start, end) => {
    if (!start || !end) return start || end;
    return {
      lat: (start.lat + end.lat) / 2,
      lng: (start.lng + end.lng) / 2
    };
  };

  // Get color and label based on rating
  const getRatingColor = (rating) => {
    if (rating >= 3.5) {
      return { color: '#2ed573', label: 'Safe', hex: '#2ed573' }; // Green
    } else if (rating >= 2.5) {
      return { color: '#ffa502', label: 'Moderate', hex: '#ffa502' }; // Orange
    } else {
      return { color: '#ff4757', label: 'Caution', hex: '#ff4757' }; // Red
    }
  };

  // Get ETA multiplier based on safety rating
  const getETAMultiplier = (rating) => {
    if (rating >= 3.5) {
      return 1.0; // Good - no extra time
    } else if (rating >= 2.5) {
      return 1.225; // Moderate - 22.5% extra time (average of 20-25%)
    } else {
      return 1.55; // Bad - 55% extra time (average of 50-60%)
    }
  };

  // Format adjusted duration
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  };

  // Create star marker SVG
  const createStarMarker = (color) => {
    const svg = `
      <svg width="36" height="36" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow">
            <feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.5"/>
          </filter>
        </defs>
        <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="2" filter="url(#shadow)"/>
        <g transform="translate(20, 20)">
          <polygon points="0,-8 2.4,-2.4 8,-1 4.8,3.2 6.4,8 0,4.8 -6.4,8 -4.8,3.2 -8,-1 -2.4,-2.4" fill="white"/>
        </g>
      </svg>
    `;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  // Generate star icons HTML
  const generateStarIcons = (rating) => {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '★';
    if (halfStar) stars += '☆';
    for (let i = 0; i < emptyStars; i++) stars += '☆';
    return stars;
  };

  // Create info window content for marker
  const createInfoWindowContent = (data, colorInfo) => {
    const starsHtml = generateStarIcons(data.rating);
    const etaMultiplier = getETAMultiplier(data.rating);
    const etaNote = etaMultiplier === 1 ? 'Normal travel time' : 
                   etaMultiplier <= 1.225 ? '+20-25% travel time recommended' : 
                   '+50-60% travel time recommended';
    
    return `
      <div style="font-family: 'Roboto', Arial, sans-serif; max-width: 260px; padding: 0; margin: 0; overflow: hidden;">
        <div style="background: ${colorInfo.hex}; color: white; padding: 10px 14px; margin: -8px -8px 0 -8px;">
          <div style="font-size: 15px; font-weight: 500; margin-bottom: 3px;">${data.roadName}</div>
          <div style="font-size: 12px; opacity: 0.95; display: flex; align-items: center; gap: 5px;">
            <span style="letter-spacing: 2px;">${starsHtml}</span>
            <span>${data.rating.toFixed(1)}</span>
          </div>
        </div>
        <div style="padding: 10px 14px; margin: 0 -8px -8px -8px; background: #fff;">
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${colorInfo.hex}; margin-right: 6px;"></div>
            <span style="font-size: 13px; font-weight: 500; color: ${colorInfo.hex};">${colorInfo.label}</span>
          </div>
          <div style="font-size: 12px; color: #5f6368; padding-top: 8px; border-top: 1px solid #eee;">
            ⏱️ ${etaNote}
          </div>
        </div>
      </div>
    `;
  };

  // Load roads with ratings from API
  const loadRoadsWithRatings = async () => {
    try {
      const response = await travellerAPI.getRoads();
      const roadsData = response.data || [];
      setRoads(roadsData);
      
      // Calculate ratings for ROADS only - one marker per road at center
      const ratingsMap = {};
      roadsData.forEach(road => {
        if (road.segments && Array.isArray(road.segments)) {
          let totalRating = 0;
          let ratingCount = 0;
          
          road.segments.forEach((segment) => {
            if (segment.starRatings && segment.starRatings.length > 0) {
              segment.starRatings.forEach(sr => {
                totalRating += sr.ratingValue;
                ratingCount++;
              });
            }
          });
          
          // Only add road if it has ratings
          if (ratingCount > 0) {
            const roadStart = parseCoords(road.rStartCoord);
            const roadEnd = parseCoords(road.rEndCoord);
            const roadCenter = getMidpoint(roadStart, roadEnd);
            
            if (roadCenter) {
              const avgRating = totalRating / ratingCount;
              ratingsMap[road.roadID] = {
                rating: avgRating,
                lat: roadCenter.lat,
                lng: roadCenter.lng,
                roadName: road.roadName,
                roadID: road.roadID,
                segmentCount: road.segments.length
              };
            }
          }
        }
      });
      
      setRatings(ratingsMap);
      console.log('Navigation - Loaded ratings:', Object.keys(ratingsMap).length, 'roads');
    } catch (error) {
      console.error('Failed to load road ratings:', error);
    }
  };

  // Add rating markers to navigation map
  const addRatingMarkers = useCallback(() => {
    if (!mapInstance.current || Object.keys(ratings).length === 0) return;

    // Clear existing markers
    ratingMarkersRef.current.forEach(marker => marker.setMap(null));
    ratingMarkersRef.current = [];

    // Add markers for each road with ratings
    Object.entries(ratings).forEach(([roadID, data]) => {
      const colorInfo = getRatingColor(data.rating);
      
      const marker = new window.google.maps.Marker({
        position: { lat: data.lat, lng: data.lng },
        map: mapInstance.current,
        title: `${data.roadName} - Rating: ${data.rating.toFixed(1)}/5.0`,
        icon: {
          url: createStarMarker(colorInfo.hex),
          scaledSize: new window.google.maps.Size(36, 36),
          anchor: new window.google.maps.Point(18, 18),
        },
        zIndex: 100,
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: createInfoWindowContent(data, colorInfo),
        maxWidth: 280,
      });

      marker.addListener('click', () => {
        ratingMarkersRef.current.forEach(m => {
          if (m.infoWindow) m.infoWindow.close();
        });
        infoWindow.open(mapInstance.current, marker);
      });
      
      marker.infoWindow = infoWindow;
      ratingMarkersRef.current.push(marker);
    });
  }, [ratings]);

  // Calculate average safety rating along the route
  const calculateRouteSafetyRating = useCallback((routePoints) => {
    if (Object.keys(ratings).length === 0 || !routePoints) return null;
    
    // For simplicity, calculate average of all ratings in the database
    // In a production app, you'd want to match route coordinates to nearby roads
    const allRatings = Object.values(ratings);
    if (allRatings.length === 0) return null;
    
    const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
    return avgRating;
  }, [ratings]);

  // Load Google Maps API
  useEffect(() => {
    if (window.google && window.google.maps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,directions`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('Google Maps API loaded for navigation');
      setMapLoaded(true);
    };

    script.onerror = () => {
      setError('Failed to load Google Maps. Please refresh the page.');
    };

    document.head.appendChild(script);
  }, []);

  // Initialize map and services
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    try {
      // Initialize map centered on Mokarram Bhaban, University of Dhaka
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 23.7335, lng: 90.3925 },
        zoom: 15,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: true,
      });

      // Initialize directions service and renderer
      directionsService.current = new window.google.maps.DirectionsService();
      directionsRenderer.current = new window.google.maps.DirectionsRenderer({
        map: mapInstance.current,
        polylineOptions: {
          strokeColor: '#4285F4',
          strokeWeight: 5,
        },
        suppressMarkers: false,
      });

      // Initialize autocomplete for start location
      if (startInputRef.current) {
        startAutocomplete.current = new window.google.maps.places.Autocomplete(
          startInputRef.current,
          { types: ['geocode', 'establishment'] }
        );
        startAutocomplete.current.addListener('place_changed', () => {
          const place = startAutocomplete.current.getPlace();
          if (place.formatted_address) {
            setStartLocation(place.formatted_address);
          } else if (place.name) {
            setStartLocation(place.name);
          }
        });
      }

      // Initialize autocomplete for end location
      if (endInputRef.current) {
        endAutocomplete.current = new window.google.maps.places.Autocomplete(
          endInputRef.current,
          { types: ['geocode', 'establishment'] }
        );
        endAutocomplete.current.addListener('place_changed', () => {
          const place = endAutocomplete.current.getPlace();
          if (place.formatted_address) {
            setEndLocation(place.formatted_address);
          } else if (place.name) {
            setEndLocation(place.name);
          }
        });
      }

      // Try to get user's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            mapInstance.current.setCenter(pos);
            
            // Reverse geocode to get address
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: pos }, (results, status) => {
              if (status === 'OK' && results[0]) {
                setStartLocation(results[0].formatted_address);
              }
            });
          },
          () => {
            console.log('Geolocation permission denied');
          }
        );
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Error initializing map');
    }
  }, [mapLoaded]);

  // Load road ratings when map is ready
  useEffect(() => {
    if (mapLoaded) {
      loadRoadsWithRatings();
    }
  }, [mapLoaded]);

  // Add rating markers when ratings change
  useEffect(() => {
    if (mapLoaded && Object.keys(ratings).length > 0) {
      addRatingMarkers();
    }
  }, [mapLoaded, ratings, addRatingMarkers]);

  // Calculate route
  const calculateRoute = useCallback(() => {
    if (!startLocation.trim() || !endLocation.trim()) {
      setError('Please enter both start and destination locations');
      return;
    }

    if (!directionsService.current) {
      setError('Map services not ready. Please wait...');
      return;
    }

    setLoading(true);
    setError('');
    setRoutes([]);

    const request = {
      origin: startLocation,
      destination: endLocation,
      travelMode: window.google.maps.TravelMode[travelMode],
      provideRouteAlternatives: true,
      unitSystem: window.google.maps.UnitSystem.METRIC,
    };

    directionsService.current.route(request, (result, status) => {
      setLoading(false);

      if (status === 'OK') {
        // Calculate average safety rating for ETA adjustment
        const allRatings = Object.values(ratings);
        const avgSafetyRating = allRatings.length > 0 
          ? allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length 
          : 3.5; // Default to moderate if no ratings available
        
        setRouteSafetyRating(avgSafetyRating);
        const etaMultiplier = getETAMultiplier(avgSafetyRating);
        
        // Process routes with adjusted ETA
        const processedRoutes = result.routes.map((route, index) => {
          const leg = route.legs[0];
          const originalDuration = leg.duration.value;
          const adjustedDuration = Math.round(originalDuration * etaMultiplier);
          
          return {
            index,
            summary: route.summary,
            distance: leg.distance.text,
            duration: leg.duration.text,
            durationValue: leg.duration.value,
            adjustedDuration: formatDuration(adjustedDuration),
            adjustedDurationValue: adjustedDuration,
            safetyRating: avgSafetyRating,
            etaMultiplier: etaMultiplier,
            startAddress: leg.start_address,
            endAddress: leg.end_address,
            steps: leg.steps.map(step => ({
              instruction: step.instructions,
              distance: step.distance.text,
              duration: step.duration.text,
              travelMode: step.travel_mode,
            })),
            warnings: route.warnings,
            copyrights: route.copyrights,
          };
        });

        // Sort routes by adjusted duration
        processedRoutes.sort((a, b) => a.adjustedDurationValue - b.adjustedDurationValue);

        setRoutes(processedRoutes);
        setSelectedRouteIndex(0);
        setShowDirections(true);

        // Display the first route
        directionsRenderer.current.setDirections(result);
        directionsRenderer.current.setRouteIndex(0);
      } else {
        let errorMessage = 'Could not calculate route. ';
        switch (status) {
          case 'NOT_FOUND':
            errorMessage += 'One or both locations could not be found.';
            break;
          case 'ZERO_RESULTS':
            errorMessage += 'No route found between these locations.';
            break;
          case 'MAX_ROUTE_LENGTH_EXCEEDED':
            errorMessage += 'Route is too long.';
            break;
          default:
            errorMessage += 'Please try different locations.';
        }
        setError(errorMessage);
      }
    });
  }, [startLocation, endLocation, travelMode, ratings]);

  // Select a different route
  const selectRoute = (index) => {
    setSelectedRouteIndex(index);
    if (directionsRenderer.current) {
      directionsRenderer.current.setRouteIndex(index);
    }
  };

  // Start navigation mode
  const startNavigation = () => {
    setNavigationStarted(true);
    setCurrentStep(0);
  };

  // Navigate to next step
  const nextStep = () => {
    if (routes[selectedRouteIndex] && currentStep < routes[selectedRouteIndex].steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Navigate to previous step
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Swap start and end locations
  const swapLocations = () => {
    const temp = startLocation;
    setStartLocation(endLocation);
    setEndLocation(temp);
  };

  // Clear route
  const clearRoute = () => {
    setRoutes([]);
    setShowDirections(false);
    setNavigationStarted(false);
    setCurrentStep(0);
    if (directionsRenderer.current) {
      directionsRenderer.current.setDirections({ routes: [] });
    }
  };

  // Get travel mode icon
  const getTravelModeIcon = (mode) => {
    switch (mode) {
      case 'DRIVING': return '🚗';
      case 'WALKING': return '🚶';
      case 'BICYCLING': return '🚴';
      case 'TRANSIT': return '🚌';
      default: return '🚗';
    }
  };

  return (
    <div className="safety-navigation-container">
      <div className="navigation-panel">
        <div className="panel-header">
          <h2>Safety Navigation</h2>
          {onClose && (
            <button className="close-btn" onClick={onClose}>×</button>
          )}
        </div>

        {/* Travel Mode Selector */}
        <div className="travel-mode-selector">
          {['DRIVING', 'TRANSIT', 'WALKING', 'BICYCLING'].map(mode => (
            <button
              key={mode}
              className={`mode-btn ${travelMode === mode ? 'active' : ''}`}
              onClick={() => setTravelMode(mode)}
              title={mode.toLowerCase()}
            >
              {getTravelModeIcon(mode)}
            </button>
          ))}
        </div>

        {/* Location Inputs */}
        <div className="location-inputs">
          <div className="input-group">
            <span className="input-icon start">●</span>
            <input
              ref={startInputRef}
              type="text"
              placeholder="Choose starting point, or click on the map"
              value={startLocation}
              onChange={(e) => setStartLocation(e.target.value)}
              className="location-input"
            />
          </div>
          
          <button className="swap-btn" onClick={swapLocations} title="Swap locations">
            ⇅
          </button>
          
          <div className="input-group">
            <span className="input-icon end">●</span>
            <input
              ref={endInputRef}
              type="text"
              placeholder="Choose destination"
              value={endLocation}
              onChange={(e) => setEndLocation(e.target.value)}
              className="location-input"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            className="route-btn"
            onClick={calculateRoute}
            disabled={loading || !startLocation || !endLocation}
          >
            {loading ? 'Calculating...' : 'Get Directions'}
          </button>
          {routes.length > 0 && (
            <button className="clear-btn" onClick={clearRoute}>
              Clear
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Route Options */}
        {routes.length > 0 && !navigationStarted && (
          <div className="route-options">
            <h3>Route Options</h3>
            
            {/* Safety Rating Info Banner */}
            {routeSafetyRating && (
              <div className={`safety-rating-banner ${
                routeSafetyRating >= 3.5 ? 'safe' : routeSafetyRating >= 2.5 ? 'moderate' : 'caution'
              }`}>
                <span className="safety-stars">{generateStarIcons(routeSafetyRating)}</span>
                <span className="safety-label">
                  {routeSafetyRating >= 3.5 ? 'Safe Route' : routeSafetyRating >= 2.5 ? 'Moderate Risk' : 'High Risk Route'}
                </span>
                <span className="safety-value">({routeSafetyRating.toFixed(1)}/5.0)</span>
              </div>
            )}
            
            {routes.map((route, index) => (
              <div
                key={index}
                className={`route-option ${selectedRouteIndex === index ? 'selected' : ''}`}
                onClick={() => selectRoute(index)}
              >
                <div className="route-main">
                  <span className="route-icon">{getTravelModeIcon(travelMode)}</span>
                  <div className="route-info">
                    <span className="route-via">via {route.summary}</span>
                    <span className="route-details">
                      {route.distance}
                    </span>
                  </div>
                  <div className="route-duration-container">
                    <span className={`route-duration ${index === 0 ? 'fastest' : ''}`}>
                      {route.adjustedDuration || route.duration}
                    </span>
                    {route.etaMultiplier > 1 && (
                      <span className="original-duration">
                        (was {route.duration})
                      </span>
                    )}
                  </div>
                </div>
                {route.etaMultiplier > 1 && (
                  <div className="route-safety-note">
                    ⏱️ +{Math.round((route.etaMultiplier - 1) * 100)}% safety buffer applied
                  </div>
                )}
                {route.warnings && route.warnings.length > 0 && (
                  <div className="route-warnings">
                    ⚠️ {route.warnings.join(', ')}
                  </div>
                )}
              </div>
            ))}

            <button className="start-nav-btn" onClick={startNavigation}>
              Start Navigation
            </button>
          </div>
        )}

        {/* Turn-by-turn Directions */}
        {navigationStarted && routes[selectedRouteIndex] && (
          <div className="turn-by-turn">
            <div className="nav-header">
              <button className="nav-close" onClick={() => setNavigationStarted(false)}>
                ← Back
              </button>
              <span className="nav-title">
                {routes[selectedRouteIndex].adjustedDuration || routes[selectedRouteIndex].duration} ({routes[selectedRouteIndex].distance})
              </span>
            </div>

            <div className="current-instruction">
              <div
                className="instruction-text"
                dangerouslySetInnerHTML={{
                  __html: routes[selectedRouteIndex].steps[currentStep]?.instruction
                }}
              />
              <div className="instruction-distance">
                {routes[selectedRouteIndex].steps[currentStep]?.distance}
              </div>
            </div>

            <div className="step-navigator">
              <button
                className="step-btn"
                onClick={prevStep}
                disabled={currentStep === 0}
              >
                ← Previous
              </button>
              <span className="step-counter">
                Step {currentStep + 1} of {routes[selectedRouteIndex].steps.length}
              </span>
              <button
                className="step-btn"
                onClick={nextStep}
                disabled={currentStep === routes[selectedRouteIndex].steps.length - 1}
              >
                Next →
              </button>
            </div>

            <div className="all-steps">
              <h4>All Directions</h4>
              {routes[selectedRouteIndex].steps.map((step, index) => (
                <div
                  key={index}
                  className={`step-item ${index === currentStep ? 'current' : ''} ${index < currentStep ? 'completed' : ''}`}
                  onClick={() => setCurrentStep(index)}
                >
                  <span className="step-number">{index + 1}</span>
                  <div
                    className="step-instruction"
                    dangerouslySetInnerHTML={{ __html: step.instruction }}
                  />
                  <span className="step-distance">{step.distance}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="map-container">
        <div ref={mapRef} className="navigation-map"></div>
      </div>
    </div>
  );
};

export default SafetyNavigation;
