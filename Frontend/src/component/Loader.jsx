import React from 'react';
import logo from '../assets/logo_BDRap.png';
import '../styles/Loader.css';

const Loader = () => {
  return (
    <div className="loader-container">
      <div className="loader-content">
        <img src={logo} alt="banRAP Logo" className="loader-logo" />
        <div className="spinner"></div>
        <p className="loader-subtitle">Loading...</p>
      </div>
    </div>
  );
};

export default Loader;
