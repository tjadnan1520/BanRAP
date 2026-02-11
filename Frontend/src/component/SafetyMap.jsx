import React, { useState, useEffect, useRef } from 'react';
import { travellerAPI } from '../utils/api.js';
import '../styles/SafetyMap.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const SafetyMap = ({ onClose }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const searchInputRef = useRef(null);
  const searchAutocomplete = useRef(null);
  const searchMarker = useRef(null);
  const ratingMarkersRef = useRef([]);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [error, setError] = useState('');
  const [roads, setRoads] = useState([]);
  const [roadsLoading, setRoadsLoading] = useState(true);
  const [ratings, setRatings] = useState({});

  // Load Google Maps API
  useEffect(() => {
    if (window.google && window.google.maps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('Google Maps API loaded for safety map');
      setMapLoaded(true);
    };

    script.onerror = () => {
      setError('Failed to load Google Maps. Please refresh the page.');
    };

    document.head.appendChild(script);
  }, []);

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

  // Load roads and segments with ratings
  const loadRoadsWithRatings = async () => {
    try {
      setRoadsLoading(true);
      const response = await travellerAPI.getRoads();
      const roadsData = response.data || [];
      console.log('Roads data from API:', roadsData);
      setRoads(roadsData);
      
      // Calculate ratings for ROADS ONLY - one marker per road at center
      const ratingsMap = {};
      roadsData.forEach(road => {
        if (road.segments && Array.isArray(road.segments)) {
          // Collect all starRatings from all segments of this road
          let totalRating = 0;
          let ratingCount = 0;
          let totalRiskScore = 0;
          let totalSafetyScore = 0;
          let riskCount = 0;
          let safetyCount = 0;
          
          road.segments.forEach((segment) => {
            // Get ratings from starRatings array (calculated by the star rating algorithm)
            if (segment.starRatings && segment.starRatings.length > 0) {
              segment.starRatings.forEach(sr => {
                totalRating += sr.ratingValue;
                ratingCount++;
                
                if (sr.riskScore !== null && sr.riskScore !== undefined) {
                  totalRiskScore += sr.riskScore;
                  riskCount++;
                }
                if (sr.safetyScore !== null && sr.safetyScore !== undefined) {
                  totalSafetyScore += sr.safetyScore;
                  safetyCount++;
                }
              });
            }
          });
          
          // Only add road to map if it has ratings from the star rating algorithm
          if (ratingCount > 0) {
            // Calculate ROAD CENTER from road's own coordinates (rStartCoord/rEndCoord)
            const roadStart = parseCoords(road.rStartCoord);
            const roadEnd = parseCoords(road.rEndCoord);
            const roadCenter = getMidpoint(roadStart, roadEnd);
            
            if (roadCenter) {
              const avgRating = totalRating / ratingCount;
              const avgRiskScore = riskCount > 0 ? totalRiskScore / riskCount : null;
              const avgSafetyScore = safetyCount > 0 ? totalSafetyScore / safetyCount : null;
              
              console.log(`Road ${road.roadName}: avgRating=${avgRating.toFixed(2)}, center=(${roadCenter.lat.toFixed(6)}, ${roadCenter.lng.toFixed(6)}), segmentsRated=${ratingCount}`);
              
              // Store ONLY road-level rating (one marker per road)
              ratingsMap[road.roadID] = {
                rating: avgRating,
                riskScore: avgRiskScore,
                safetyScore: avgSafetyScore,
                lat: roadCenter.lat,
                lng: roadCenter.lng,
                roadName: road.roadName,
                roadID: road.roadID,
                isRoad: true,
                segmentCount: road.segments.length,
                ratedSegments: ratingCount
              };
            }
          }
        }
      });
      
      console.log('Final ratings map (roads only):', ratingsMap);
      setRatings(ratingsMap);
    } catch (error) {
      console.error('Failed to load roads:', error);
      setRoads([]);
    } finally {
      setRoadsLoading(false);
    }
  };

  // Get color based on rating
  const getRatingColor = (rating) => {
    if (rating >= 3.5) {
      return { color: '#2ed573', label: 'Safe', hex: '#2ed573' }; // Green
    } else if (rating >= 2.5) {
      return { color: '#ffa502', label: 'Moderate', hex: '#ffa502' }; // Orange/Yellow
    } else {
      return { color: '#ff4757', label: 'Caution', hex: '#ff4757' }; // Red
    }
  };

  // Create star marker SVG
  const createStarMarker = (color) => {
    const svg = `
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
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
    for (let i = 0; i < fullStars; i++) {
      stars += '★';
    }
    if (halfStar) {
      stars += '☆';
    }
    for (let i = 0; i < emptyStars; i++) {
      stars += '☆';
    }
    return stars;
  };

  // Create Google Maps-style info window content
  const createInfoWindowContent = (data, colorInfo) => {
    const starsHtml = generateStarIcons(data.rating);
    
    return `
      <div class="gm-style-info-window" style="font-family: 'Roboto', Arial, sans-serif; max-width: 280px; padding: 0; margin: 0; overflow: hidden;">
        <!-- Header with colored status bar -->
        <div style="background: ${colorInfo.hex}; color: white; padding: 12px 16px; margin: -8px -8px 0 -8px;">
          <div style="font-size: 16px; font-weight: 500; margin-bottom: 4px;">${data.roadName}</div>
          <div style="font-size: 13px; opacity: 0.95; display: flex; align-items: center; gap: 6px;">
            <span style="letter-spacing: 2px; font-size: 14px;">${starsHtml}</span>
            <span>${data.rating.toFixed(1)}</span>
          </div>
        </div>
        
        <!-- Content body -->
        <div style="padding: 12px 16px; margin: 0 -8px -8px -8px; background: #fff;">
          <!-- Safety Status -->
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${colorInfo.hex}; margin-right: 8px;"></div>
            <span style="font-size: 14px; font-weight: 500; color: ${colorInfo.hex};">${colorInfo.label}</span>
          </div>
          
          <!-- Details -->
          <div style="border-top: 1px solid #eee; padding-top: 10px; font-size: 13px; color: #5f6368;">
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#5f6368" style="margin-right: 8px;">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
              </svg>
              <span>${data.segmentCount} segment${data.segmentCount > 1 ? 's' : ''} total</span>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${colorInfo.hex}" style="margin-right: 8px;">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
              <span>${data.ratedSegments || 1} rating${(data.ratedSegments || 1) > 1 ? 's' : ''} applied</span>
            </div>
            
            ${data.riskScore !== null && data.riskScore !== undefined ? `
              <div style="display: flex; align-items: center; margin-bottom: 6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#5f6368" style="margin-right: 8px;">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                <span>Risk Score: ${data.riskScore.toFixed(2)}</span>
              </div>
            ` : ''}
            
            ${data.safetyScore !== null && data.safetyScore !== undefined ? `
              <div style="display: flex; align-items: center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#5f6368" style="margin-right: 8px;">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                </svg>
                <span>Safety Score: ${data.safetyScore.toFixed(2)}</span>
              </div>
            ` : ''}
          </div>
          
          <!-- Footer with coordinates (small text) -->
          <div style="border-top: 1px solid #eee; margin-top: 10px; padding-top: 8px; font-size: 11px; color: #9aa0a6;">
            📍 Center: ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}
          </div>
        </div>
      </div>
    `;
  };

  // Add rating markers to map - ONE marker per road at center
  const addRatingMarkers = () => {
    if (!mapInstance.current) return;

    // Clear existing markers
    ratingMarkersRef.current.forEach(marker => marker.setMap(null));
    ratingMarkersRef.current = [];

    // Add ONE marker per road at the road's center coordinates
    Object.entries(ratings).forEach(([roadID, data]) => {
      const colorInfo = getRatingColor(data.rating);
      
      const marker = new window.google.maps.Marker({
        position: { lat: data.lat, lng: data.lng },
        map: mapInstance.current,
        title: `${data.roadName} - Rating: ${data.rating.toFixed(1)}/5.0`,
        icon: {
          url: createStarMarker(colorInfo.hex),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 20),
        },
        zIndex: 100,
      });

      // Create Google Maps-style info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: createInfoWindowContent(data, colorInfo),
        maxWidth: 300,
      });

      marker.addListener('click', () => {
        // Close any open info windows
        ratingMarkersRef.current.forEach(m => {
          if (m.infoWindow) m.infoWindow.close();
        });
        infoWindow.open(mapInstance.current, marker);
      });
      
      marker.infoWindow = infoWindow;
      ratingMarkersRef.current.push(marker);
    });
  };

  // Initialize map
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
        center: { lat: 23.8103, lng: 90.4125 }, // Dhaka center
        zoom: 12,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: false,
      });

      initializeSearchAutocomplete();
      // Markers will be added by the useEffect watching ratings
    } catch (err) {
      console.error('Error creating map:', err);
      setError('Error initializing map');
    }
  };

  // Initialize search autocomplete
  const initializeSearchAutocomplete = () => {
    if (!searchInputRef.current || !window.google || !window.google.maps) return;

    searchAutocomplete.current = new window.google.maps.places.Autocomplete(
      searchInputRef.current,
      { types: ['geocode', 'establishment'] }
    );

    searchAutocomplete.current.addListener('place_changed', () => {
      const place = searchAutocomplete.current.getPlace();
      
      if (place.geometry && place.geometry.location) {
        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };

        // Center map on the selected place
        mapInstance.current.setCenter(location);
        mapInstance.current.setZoom(16);

        // Remove previous search marker if exists
        if (searchMarker.current) {
          searchMarker.current.setMap(null);
        }

        // Add marker for the searched location
        searchMarker.current = new window.google.maps.Marker({
          position: location,
          map: mapInstance.current,
          title: place.name || place.formatted_address,
          icon: {
            path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 6,
          },
          animation: window.google.maps.Animation.DROP,
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 10px; min-width: 150px;">
              <h3 style="margin: 0 0 8px 0; color: #4285F4;">${place.name || 'Selected Location'}</h3>
              <p style="margin: 4px 0; font-size: 13px; color: #666;">${place.formatted_address || ''}</p>
            </div>
          `,
        });

        searchMarker.current.addListener('click', () => {
          infoWindow.open(mapInstance.current, searchMarker.current);
        });

        // Open info window immediately
        infoWindow.open(mapInstance.current, searchMarker.current);
      }
    });
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchLocation(e.target.value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchLocation('');
    if (searchMarker.current) {
      searchMarker.current.setMap(null);
      searchMarker.current = null;
    }
    // Reset to default location
    if (mapInstance.current) {
      mapInstance.current.setCenter({ lat: 23.8103, lng: 90.4125 });
      mapInstance.current.setZoom(12);
    }
  };

  // Load roads data when component mounts
  useEffect(() => {
    loadRoadsWithRatings();
    // Refresh data every 30 seconds to catch newly labeled segments
    const interval = setInterval(() => {
      loadRoadsWithRatings();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Initialize map when loaded
  useEffect(() => {
    if (mapLoaded) {
      setTimeout(() => initializeSafetyMap(), 500);
    }
  }, [mapLoaded]);

  // Add or update markers when ratings load or map initializes
  useEffect(() => {
    if (mapInstance.current && Object.keys(ratings).length > 0) {
      // Use setTimeout to debounce rapid calls
      const timer = setTimeout(() => {
        console.log('Adding markers with ratings:', Object.keys(ratings).length);
        addRatingMarkers();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [ratings, mapLoaded]);

  return (
    <div className="safety-map-wrapper">
      <div className="safety-map-header">
        <h2>🗺️ Safety Map</h2>
        <p>View road safety ratings and search locations</p>
        <button 
          className="refresh-map-btn"
          onClick={loadRoadsWithRatings}
          disabled={roadsLoading}
          title="Refresh ratings"
        >
          🔄 Refresh
        </button>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      {error && <div className="map-error">{error}</div>}

      <div className="safety-map-search">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search for a place..."
            value={searchLocation}
            onChange={handleSearchChange}
            className="search-input"
          />
          {searchLocation && (
            <button className="clear-search-btn" onClick={clearSearch}>
              ×
            </button>
          )}
        </div>
      </div>

      <div className="safety-map-container">
        {roadsLoading && (
          <div className="map-loading">
            <p>Loading road data...</p>
          </div>
        )}
        <div ref={mapRef} className="safety-map"></div>
        
        {/* Google Maps-style Floating Legend */}
        <div className="map-floating-legend">
          <div className="legend-header">
            <span className="legend-icon">★</span>
            <span className="legend-title">Safety Ratings</span>
          </div>
          <div className="legend-items">
            <div className="legend-item-row">
              <div className="legend-marker" style={{ backgroundColor: '#2ed573' }}>★</div>
              <div className="legend-text">
                <span className="legend-label">Safe</span>
                <span className="legend-range">3.5 - 5.0</span>
              </div>
            </div>
            <div className="legend-item-row">
              <div className="legend-marker" style={{ backgroundColor: '#ffa502' }}>★</div>
              <div className="legend-text">
                <span className="legend-label">Moderate</span>
                <span className="legend-range">2.5 - 3.49</span>
              </div>
            </div>
            <div className="legend-item-row">
              <div className="legend-marker" style={{ backgroundColor: '#ff4757' }}>★</div>
              <div className="legend-text">
                <span className="legend-label">Caution</span>
                <span className="legend-range">0 - 2.49</span>
              </div>
            </div>
          </div>
          {Object.keys(ratings).filter(k => ratings[k].isRoad).length > 0 && (
            <div className="legend-stats">
              <span>{Object.keys(ratings).filter(k => ratings[k].isRoad).length} road(s) rated</span>
            </div>
          )}
          {Object.keys(ratings).length === 0 && !roadsLoading && (
            <div className="legend-empty">
              No labeled roads yet
            </div>
          )}
        </div>
      </div>

      <div className="map-info">
        <p>⭐ Star markers show safety ratings from labeled segments. Ratings updated every 30 seconds. Click "Refresh" to update immediately.</p>
      </div>
    </div>
  );
};

export default SafetyMap;
