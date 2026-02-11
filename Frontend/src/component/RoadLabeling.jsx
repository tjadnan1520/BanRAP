import React from 'react';
import { useLocation } from 'react-router-dom';
import MapSelection from './MapSelection';

const RoadLabeling = () => {
  const location = useLocation();
  const complaintData = location.state?.complaintData || null;

  // This component now renders MapSelection with optional complaint data
  return <MapSelection complaintData={complaintData} />;
};

export default RoadLabeling;
