import React, { useState } from 'react';
import '../styles/ForgotPassword.css';
import logo from '../assets/logo_BDRap.png';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api.js';

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Validate Bangladeshi phone number
  const validateBangladeshiPhone = (phoneNumber) => {
    const bdPhoneRegex = /^(?:\+?880|0)1[3-9]\d{8}$/;
    return bdPhoneRegex.test(phoneNumber);
  };

  // Format phone number to standard format
  const formatBangladeshiPhone = (phoneNumber) => {
    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // If starts with +880, remove it and keep the rest
    let normalized = cleaned.startsWith('+880') ? cleaned.substring(4) : cleaned;
    
    // If starts with 880, remove it
    if (normalized.startsWith('880')) {
      normalized = normalized.substring(3);
    }
    
    // If doesn't start with 0, add it
    if (!normalized.startsWith('0')) {
      normalized = '0' + normalized;
    }
    
    return normalized;
  };

  // Validate email and phone
  const validateEmailAndPhone = () => {
    const newErrors = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!validateBangladeshiPhone(phone)) {
      newErrors.phone = 'Please enter a valid Bangladeshi phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate OTP
  const validateOTP = () => {
    const newErrors = {};
    
    if (!otp) {
      newErrors.otp = 'OTP is required';
    } else if (!/^\d{6}$/.test(otp)) {
      newErrors.otp = 'OTP must be 6 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate new password
  const validatePassword = () => {
    const newErrors = {};
    
    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain uppercase, lowercase, and numbers';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Step 1: Email and Phone Verification
  const handleEmailPhoneSubmit = async (e) => {
    e.preventDefault();
    if (!validateEmailAndPhone()) return;

    setLoading(true);
    try {
      const formattedPhone = formatBangladeshiPhone(phone);
      const response = await authAPI.forgotPassword(email, formattedPhone);
      if (response.success) {
        setSuccessMessage(response.message);
        setTimeout(() => {
          setStep(2);
          setSuccessMessage('');
        }, 1500);
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setErrors({ general: error.message || 'Failed to verify. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: OTP Verification
  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    if (!validateOTP()) return;

    setLoading(true);
    try {
      // OTP validation is now combined with password reset in the backend
      setStep(3);
      setErrors({});
    } catch (error) {
      console.error('OTP verification error:', error);
      setErrors({ general: error.message || 'Failed to verify OTP. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 3: Password Reset
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setLoading(true);
    try {
      const response = await authAPI.resetPassword(email, otp, newPassword, confirmPassword);
      if (response.success) {
        setSuccessMessage('Password reset successfully! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setErrors({ general: error.message || 'Failed to reset password. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Back Button
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setErrors({});
      setSuccessMessage('');
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-wrapper">
        {/* Left Section - Logo & Branding */}
        <div className="forgot-password-left">
          <div className="logo-section">
            <img src={logo} alt="BDRap Logo" className="forgot-password-logo" />
            <h1>Reset Password</h1>
            <p>Secure your account with a new password</p>
          </div>
        </div>

        {/* Right Section - Form */}
        <div className="forgot-password-right">
          <div className="forgot-password-form-container">
            {/* Progress Indicator */}
            <div className="progress-indicator">
              <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
                <span>1</span>
                <p>Email</p>
              </div>
              <div className="progress-line"></div>
              <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
                <span>2</span>
                <p>OTP</p>
              </div>
              <div className="progress-line"></div>
              <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
                <span>3</span>
                <p>Password</p>
              </div>
            </div>

            <h2>Reset Your Password</h2>

            {errors.general && <div className="error-box">{errors.general}</div>}
            {successMessage && <div className="success-box">{successMessage}</div>}

            {/* Step 1: Email and Phone Verification */}
            {step === 1 && (
              <form onSubmit={handleEmailPhoneSubmit}>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) {
                        setErrors({ ...errors, email: '' });
                      }
                    }}
                    placeholder="Enter your registered email"
                    className={errors.email ? 'input-error' : ''}
                  />
                  {errors.email && <span className="error-message">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errors.phone) {
                        setErrors({ ...errors, phone: '' });
                      }
                    }}
                    placeholder="Enter your phone (e.g., 01700000000)"
                    className={errors.phone ? 'input-error' : ''}
                  />
                  {errors.phone && <span className="error-message">{errors.phone}</span>}
                  <p className="hint-text">Enter your Bangladeshi phone number</p>
                </div>

                <button type="submit" className="submit-button" disabled={loading}>
                  {loading ? 'Verifying...' : 'Send OTP'}
                </button>
              </form>
            )}

            {/* Step 2: OTP Verification */}
            {step === 2 && (
              <form onSubmit={handleOTPSubmit}>
                <div className="form-group">
                  <label htmlFor="otp">Enter OTP</label>
                  <p className="info-text">We've sent a 6-digit code to {email}</p>
                  <input
                    type="text"
                    id="otp"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.slice(0, 6));
                      if (errors.otp) {
                        setErrors({ ...errors, otp: '' });
                      }
                    }}
                    placeholder="Enter 6-digit OTP"
                    maxLength="6"
                    className={errors.otp ? 'input-error' : ''}
                  />
                  {errors.otp && <span className="error-message">{errors.otp}</span>}
                </div>

                <div className="form-buttons">
                  <button type="button" className="back-button" onClick={handleBack}>
                    Back
                  </button>
                  <button type="submit" className="submit-button" disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: New Password */}
            {step === 3 && (
              <form onSubmit={handlePasswordSubmit}>
                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errors.newPassword) {
                        setErrors({ ...errors, newPassword: '' });
                      }
                    }}
                    placeholder="Enter new password"
                    className={errors.newPassword ? 'input-error' : ''}
                  />
                  {errors.newPassword && <span className="error-message">{errors.newPassword}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) {
                        setErrors({ ...errors, confirmPassword: '' });
                      }
                    }}
                    placeholder="Confirm your password"
                    className={errors.confirmPassword ? 'input-error' : ''}
                  />
                  {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
                </div>

                <div className="form-buttons">
                  <button type="button" className="back-button" onClick={handleBack}>
                    Back
                  </button>
                  <button type="submit" className="submit-button" disabled={loading}>
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}

            {/* Login Link */}
            <div className="login-section">
              <p>Remember your password? <Link to="/login" className="login-link">Back to Login</Link></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;