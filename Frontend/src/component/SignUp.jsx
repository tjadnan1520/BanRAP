import React, { useState } from 'react';
import '../styles/SignUp.css';
import logo from '../assets/logo_BDRap.png';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api.js';

function SignUp() {
  const navigate = useNavigate();
  const [step, setStep] = useState('registration'); // 'registration' or 'otp'
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'TRAVELLER',
    agreeToTerms: false,
  });
  const [otp, setOtp] = useState('');
  const [registrationData, setRegistrationData] = useState(null);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateBangladeshiPhone = (phone) => {
    // Accept formats: 01XXXXXXXXXX, +8801XXXXXXXXXX, 880 1XXXXXXXXXX
    const bdPhoneRegex = /^(?:\+?880|0)1[3-9]\d{8}$/;
    return bdPhoneRegex.test(phone.replace(/\s|-/g, ''));
  };

  const formatBangladeshiPhone = (phone) => {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
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

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validateBangladeshiPhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid Bangladeshi phone number (e.g., 01712345678)';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and numbers';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.role) {
      newErrors.role = 'Please select a role';
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Format phone number before sending
      const formattedPhone = formatBangladeshiPhone(formData.phone);
      const submissionData = {
        email: formData.email,
        name: `${formData.firstName} ${formData.lastName}`,
        phone: formattedPhone,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        role: formData.role
      };

      const response = await authAPI.register(submissionData);

      if (response.success) {
        setSuccessMessage('Verification code sent to your email. Please enter the OTP.');
        // Store registration data for OTP verification
        setRegistrationData({
          email: response.data.email,
          name: `${formData.firstName} ${formData.lastName}`,
          phone: formattedPhone,
          password: formData.password,
          role: formData.role
        });
        // Move to OTP verification step
        setTimeout(() => {
          setStep('otp');
          setSuccessMessage('');
        }, 1500);
      }
    } catch (error) {
      console.error('Sign up error:', error);
      setErrors({ general: error.message || 'Sign up failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      setErrors({ otp: 'Please enter a valid 6-digit OTP' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.verifyRegistrationOTP(
        registrationData.email,
        registrationData.phone,
        otp,
        registrationData.password,
        registrationData.name,
        registrationData.role
      );

      if (response.success) {
        setSuccessMessage('Registration completed successfully! Redirecting to login...');
        // Store only user info (NOT token - token is in secure httpOnly cookie)
        const userData = {
          email: response.data.email,
          name: response.data.name,
          phone: response.data.phone,
          role: response.data.role
        };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setErrors({ otp: error.message || 'OTP verification failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-wrapper">
        {/* Left Section - Logo & Branding */}
        <div className="signup-left">
          <div className="signup-logo-section">
            <img src={logo} alt="BDRap Logo" className="signup-logo" />
            <h1>{step === 'registration' ? 'Create Account' : 'Verify Email'}</h1>
            <p>{step === 'registration' ? 'Join BDRap and help improve road safety' : 'Enter the verification code sent to your email'}</p>
          </div>
        </div>

        {/* Right Section - Sign Up Form */}
        <div className="signup-right">
          <div className="signup-form-container">
            {step === 'registration' ? (
              <>
                <h2>Sign Up</h2>
                <p className="signup-subtitle">Create a new account to get started</p>

                {errors.general && <div className="error-box">{errors.general}</div>}
                {successMessage && <div className="success-box">{successMessage}</div>}

                <form onSubmit={handleSubmit}>
              {/* First Name Field */}
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Enter your first name"
                  className={errors.firstName ? 'input-error' : ''}
                />
                {errors.firstName && <span className="error-message">{errors.firstName}</span>}
              </div>

              {/* Last Name Field */}
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Enter your last name"
                  className={errors.lastName ? 'input-error' : ''}
                />
                {errors.lastName && <span className="error-message">{errors.lastName}</span>}
              </div>

              {/* Email Field */}
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  className={errors.email ? 'input-error' : ''}
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              {/* Phone Number Field */}
              <div className="form-group">
                <label htmlFor="phone">Phone Number (Bangladesh)</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="01712345678 or +8801712345678"
                  className={errors.phone ? 'input-error' : ''}
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
                <p className="phone-hint">Format: 01XXXXXXXXXX (11 digits starting with 01)</p>
              </div>

              {/* Role Selection */}
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className={errors.role ? 'input-error' : ''}
                >
                  <option value="TRAVELLER">Traveller</option>
                  <option value="ANNOTATOR">Annotator</option>
                </select>
                {errors.role && <span className="error-message">{errors.role}</span>}
              </div>

              {/* Password Field */}
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Create a strong password"
                    className={errors.password ? 'input-error' : ''}
                  />
                  <button
                    type="button"
                    className="show-password-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.password && <span className="error-message">{errors.password}</span>}
                <p className="password-hint">At least 8 characters with uppercase, lowercase, and numbers</p>
              </div>

              {/* Confirm Password Field */}
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    className={errors.confirmPassword ? 'input-error' : ''}
                  />
                  <button
                    type="button"
                    className="show-password-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
              </div>

              {/* Terms & Conditions */}
              <div className="form-group terms-group">
                <label className="terms-checkbox">
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={handleChange}
                  />
                  <span>I agree to the <a href="#terms" className="terms-link">Terms and Conditions</a></span>
                </label>
                {errors.agreeToTerms && <span className="error-message">{errors.agreeToTerms}</span>}
              </div>

              {/* Submit Button */}
              <button type="submit" className="signup-button" disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            {/* Login Link */}
            <div className="login-section">
              <p>Already have an account? <Link to="/login" className="login-link">Log in here</Link></p>
            </div>
              </>
            ) : (
              <>
                <h2>Verify Email</h2>
                <p className="signup-subtitle">Enter the OTP sent to {registrationData?.email}</p>

                {errors.otp && <div className="error-box">{errors.otp}</div>}
                {successMessage && <div className="success-box">{successMessage}</div>}

                <form onSubmit={handleOTPSubmit}>
                  {/* OTP Input */}
                  <div className="form-group">
                    <label htmlFor="otp">One-Time Password (OTP)</label>
                    <input
                      type="text"
                      id="otp"
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                        if (errors.otp) {
                          setErrors(prev => ({ ...prev, otp: '' }));
                        }
                      }}
                      placeholder="Enter 6-digit OTP"
                      maxLength="6"
                      className={errors.otp ? 'input-error' : ''}
                      autoComplete="off"
                    />
                    {errors.otp && <span className="error-message">{errors.otp}</span>}
                  </div>

                  {/* OTP sent via email - check your inbox */}

                  {/* Submit Button */}
                  <button type="submit" className="signup-button" disabled={isLoading}>
                    {isLoading ? 'Verifying...' : 'Verify and Complete Registration'}
                  </button>
                </form>

                {/* Back Button */}
                <div className="back-section">
                  <button 
                    type="button"
                    className="back-button"
                    onClick={() => {
                      setStep('registration');
                      setOtp('');
                      setRegistrationData(null);
                      setErrors({});
                    }}
                  >
                    ← Back to Registration
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
