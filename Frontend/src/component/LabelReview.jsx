import React, { useState, useEffect, useRef } from 'react';
import '../styles/LabelReview.css';
import { api } from '../utils/api';

const LabelReview = () => {
  const [pendingLabels, setPendingLabels] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [selectedLabels, setSelectedLabels] = useState([]); // For bulk selection
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    fetchPendingLabels();
  }, []);

  // Initialize satellite map when a label is selected
  useEffect(() => {
    if (selectedLabel && selectedLabel.latitude && selectedLabel.longitude) {
      initializeSatelliteMap();
    }
  }, [selectedLabel]);

  const initializeSatelliteMap = () => {
    if (!mapRef.current || !selectedLabel?.latitude || !selectedLabel?.longitude) return;

    // Load Google Maps API if not already loaded
    if (!window.google || !window.google.maps) {
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyB41DRUbKWJHPxaFjMAwdrzWzbVKartNGg&callback=initReviewMap`;
        script.async = true;
        script.defer = true;
        window.initReviewMap = () => {
          setTimeout(() => createMap(), 300);
        };
        document.head.appendChild(script);
      } else {
        setTimeout(() => createMap(), 500);
      }
    } else {
      setTimeout(() => createMap(), 100);
    }
  };

  const createMap = () => {
    if (!mapRef.current || !selectedLabel?.latitude || !selectedLabel?.longitude) return;
    
    const rect = mapRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setTimeout(() => createMap(), 300);
      return;
    }

    try {
      const position = {
        lat: parseFloat(selectedLabel.latitude),
        lng: parseFloat(selectedLabel.longitude)
      };

      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: position,
        zoom: 18,
        mapTypeId: 'satellite',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
      });

      new window.google.maps.Marker({
        position: position,
        map: mapInstanceRef.current,
        title: 'Label Location'
      });
    } catch (err) {
      console.error('Error creating map:', err);
    }
  };

  const fetchPendingLabels = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/labels/pending');
      if (response.success) {
        setPendingLabels(response.data);
      }
      setError('');
    } catch (err) {
      setError('Failed to fetch pending labels: ' + (err.message || 'Unknown error'));
      setPendingLabels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedLabel) return;
    
    try {
      setApproving(true);
      const response = await api.post('/api/admin/labels/approve', {
        labelID: selectedLabel.labelID
      });

      if (response.success) {
        setSuccess('Label approved successfully!');
        setPendingLabels(pendingLabels.filter(l => l.labelID !== selectedLabel.labelID));
        setSelectedLabel(null);
        setRemarks('');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Failed to approve label: ' + (err.message || 'Unknown error'));
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedLabel) return;

    try {
      setRejecting(true);
      const response = await api.post('/api/admin/labels/reject', {
        labelID: selectedLabel.labelID,
        remarks: remarks || null
      });

      if (response.success) {
        setSuccess('Label rejected and deleted successfully!');
        setPendingLabels(pendingLabels.filter(l => l.labelID !== selectedLabel.labelID));
        setSelectedLabels(selectedLabels.filter(id => id !== selectedLabel.labelID));
        setSelectedLabel(null);
        setRemarks('');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Failed to reject label: ' + (err.message || 'Unknown error'));
    } finally {
      setRejecting(false);
    }
  };

  // Toggle label selection for bulk operations
  const toggleLabelSelection = (labelID) => {
    setSelectedLabels(prev => 
      prev.includes(labelID) 
        ? prev.filter(id => id !== labelID)
        : [...prev, labelID]
    );
  };

  // Select/Deselect all labels
  const toggleSelectAll = () => {
    if (selectedLabels.length === pendingLabels.length) {
      setSelectedLabels([]);
    } else {
      setSelectedLabels(pendingLabels.map(l => l.labelID));
    }
  };

  // Bulk approve all selected labels
  const handleBulkApprove = async () => {
    if (selectedLabels.length === 0) return;

    try {
      setBulkApproving(true);
      setError('');
      let approvedCount = 0;
      let failedCount = 0;

      for (const labelID of selectedLabels) {
        try {
          const response = await api.post('/api/admin/labels/approve', { labelID });
          if (response.success) {
            approvedCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
        }
      }

      // Refresh the list
      await fetchPendingLabels();
      setSelectedLabels([]);
      setSelectedLabel(null);
      
      if (approvedCount > 0) {
        setSuccess(`${approvedCount} label(s) approved successfully!${failedCount > 0 ? ` ${failedCount} failed.` : ''}`);
        setTimeout(() => setSuccess(''), 3000);
      }
      if (failedCount > 0 && approvedCount === 0) {
        setError(`Failed to approve ${failedCount} label(s)`);
      }
    } catch (err) {
      setError('Bulk approve failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBulkApproving(false);
    }
  };

  // Bulk reject all selected labels
  const handleBulkReject = async () => {
    if (selectedLabels.length === 0) return;

    try {
      setBulkRejecting(true);
      setError('');
      let rejectedCount = 0;
      let failedCount = 0;

      for (const labelID of selectedLabels) {
        try {
          const response = await api.post('/api/admin/labels/reject', { labelID, remarks: remarks || null });
          if (response.success) {
            rejectedCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
        }
      }

      // Refresh the list
      await fetchPendingLabels();
      setSelectedLabels([]);
      setSelectedLabel(null);
      setRemarks('');
      
      if (rejectedCount > 0) {
        setSuccess(`${rejectedCount} label(s) rejected successfully!${failedCount > 0 ? ` ${failedCount} failed.` : ''}`);
        setTimeout(() => setSuccess(''), 3000);
      }
      if (failedCount > 0 && rejectedCount === 0) {
        setError(`Failed to reject ${failedCount} label(s)`);
      }
    } catch (err) {
      setError('Bulk reject failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBulkRejecting(false);
    }
  };

  const calculateMapCenter = (labels) => {
    if (!labels || labels.length === 0) return { lat: 23.8103, lng: 90.4125 };
    
    let totalLat = 0, totalLng = 0;
    labels.forEach(label => {
      if (label.latitude) totalLat += label.latitude;
      if (label.longitude) totalLng += label.longitude;
    });
    
    return {
      lat: totalLat / labels.length,
      lng: totalLng / labels.length
    };
  };

  const getMapURL = (lat, lng) => {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=400x300&markers=color:red%7C${lat},${lng}&key=AIzaSyB41DRUbKWJHPxaFjMAwdrzWzbVKartNGg`;
  };

  if (loading) {
    return <div className="label-review-container"><p>Loading pending labels...</p></div>;
  }

  return (
    <div className="label-review-container">
      <div className="review-header">
        <h1>Label Review Dashboard</h1>
        <div className="header-actions">
          <button 
            className="refresh-btn"
            onClick={fetchPendingLabels}
            disabled={loading}
            title="Refresh pending labels"
          >
            🔄 Refresh
          </button>
          {pendingLabels.length > 0 && (
            <span className="pending-badge">{pendingLabels.length} Pending</span>
          )}
        </div>
      </div>
      
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="label-review-content">
        {/* Pending Labels List */}
        <div className="pending-labels-section">
          <div className="section-header">
            <h2>Pending Labels {pendingLabels.length > 0 && <span className="count-badge">{pendingLabels.length}</span>}</h2>
            {pendingLabels.length > 0 && (
              <div className="bulk-controls">
                <label className="select-all-label">
                  <input
                    type="checkbox"
                    checked={selectedLabels.length === pendingLabels.length && pendingLabels.length > 0}
                    onChange={toggleSelectAll}
                  />
                  Select All
                </label>
              </div>
            )}
          </div>
          
          {/* Bulk Action Buttons */}
          {selectedLabels.length > 0 && (
            <div className="bulk-actions">
              <span className="selected-count">{selectedLabels.length} selected</span>
              <button 
                className="btn btn-bulk-approve"
                onClick={handleBulkApprove}
                disabled={bulkApproving || bulkRejecting}
              >
                {bulkApproving ? 'Approving...' : `Approve All (${selectedLabels.length})`}
              </button>
              <button 
                className="btn btn-bulk-reject"
                onClick={handleBulkReject}
                disabled={bulkApproving || bulkRejecting}
              >
                {bulkRejecting ? 'Rejecting...' : `Reject All (${selectedLabels.length})`}
              </button>
            </div>
          )}

          {pendingLabels.length === 0 ? (
            <p className="no-labels">No pending labels for review</p>
          ) : (
            <div className="labels-list">
              {pendingLabels.map((label) => (
                <div
                  key={label.labelID}
                  className={`label-item ${selectedLabel?.labelID === label.labelID ? 'selected' : ''} ${selectedLabels.includes(label.labelID) ? 'bulk-selected' : ''}`}
                >
                  <div className="label-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={selectedLabels.includes(label.labelID)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleLabelSelection(label.labelID);
                      }}
                      className="label-checkbox"
                    />
                  </div>
                  <div 
                    className="label-content"
                    onClick={() => {
                      setSelectedLabel(label);
                      setRemarks('');
                    }}
                  >
                    <div className="label-header">
                      <h4>{label.segment?.road?.roadName || 'Unknown Road'}</h4>
                      <span className="label-date">
                        {new Date(label.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="label-details">
                      <p><strong>Annotator:</strong> {label.annotator?.email || 'Unknown'}</p>
                      <p><strong>Location:</strong> {label.latitude?.toFixed(4)}, {label.longitude?.toFixed(4)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Label Review Details */}
        {selectedLabel && (
          <div className="label-details-section">
            <h2>Label Details Review</h2>
            
            {/* Satellite Map Display */}
            <div className="map-container">
              <h3>Location (Satellite View)</h3>
              <div className="coordinates">
                <p><strong>Latitude:</strong> {selectedLabel.latitude}</p>
                <p><strong>Longitude:</strong> {selectedLabel.longitude}</p>
              </div>
              <div className="review-map" ref={mapRef}>
                {(!selectedLabel.latitude || !selectedLabel.longitude) && (
                  <div className="map-placeholder">
                    <p>No coordinates available for this label</p>
                  </div>
                )}
              </div>
            </div>

            {/* Label Data */}
            <div className="label-data">
              <h3>Label Information</h3>
              
              {selectedLabel.roadside && (
                <div className="data-section">
                  <h4>Roadside</h4>
                  <div className="data-grid">
                    <div><strong>Left Object:</strong> {selectedLabel.roadside.leftObject || 'N/A'}</div>
                    <div><strong>Right Object:</strong> {selectedLabel.roadside.rightObject || 'N/A'}</div>
                    <div><strong>Distance to Object:</strong> {selectedLabel.roadside.distanceObject || 'N/A'}</div>
                  </div>
                </div>
              )}

              {selectedLabel.intersection && (
                <div className="data-section">
                  <h4>Intersection</h4>
                  <div className="data-grid">
                    <div><strong>Type:</strong> {selectedLabel.intersection.type || 'N/A'}</div>
                    <div><strong>Quality:</strong> {selectedLabel.intersection.quality || 'N/A'}</div>
                    <div><strong>Channelisation:</strong> {selectedLabel.intersection.channelisation || 'N/A'}</div>
                  </div>
                </div>
              )}

              {selectedLabel.speed && (
                <div className="data-section">
                  <h4>Speed</h4>
                  <div className="data-grid">
                    <div><strong>Speed Limit:</strong> {selectedLabel.speed.speedLimit || 'N/A'}</div>
                    <div><strong>Management:</strong> {selectedLabel.speed.management || 'N/A'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Remarks Input */}
            <div className="remarks-section">
              <h3>Remarks (Optional)</h3>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks for rejection or additional comments..."
                rows="4"
                className="remarks-textarea"
              />
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className="btn btn-approve"
                onClick={handleApprove}
                disabled={approving}
              >
                {approving ? 'Approving...' : 'Approve'}
              </button>
              <button
                className="btn btn-reject"
                onClick={handleReject}
                disabled={rejecting}
              >
                {rejecting ? 'Rejecting...' : 'Reject'}
              </button>
              <button
                className="btn btn-cancel"
                onClick={() => {
                  setSelectedLabel(null);
                  setRemarks('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabelReview;
