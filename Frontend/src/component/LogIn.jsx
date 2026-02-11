import React, { useState } from 'react';
import '../styles/LogIn.css';
import logo from '../assets/logo_BDRap.png';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api.js';

function LogIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      console.log('Logging in with:', { email, password });
      const response = await authAPI.login(email, password);
      
      console.log('Login response:', response);
      
      if (response && response.success) {
        setSuccessMessage(response.message);
        
        // Store user info and token
        const userData = {
          email: response.data.email,
          name: response.data.name,
          role: response.data.role,
          phone: response.data.phone
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userData));
        if (response.data.token) {
          localStorage.setItem('authToken', response.data.token);
        }
        localStorage.setItem('rememberMe', rememberMe);
        
        // Dispatch custom event to notify Header of login immediately
        window.dispatchEvent(new Event('userLoggedIn'));
        
        // Show success message then redirect
        setTimeout(() => {
          const role = response.data.role.toLowerCase();
          if (role === 'traveller') {
            navigate('/dashboard');
          } else if (role === 'annotator') {
            navigate('/analyst-dashboard');
          } else if (role === 'admin') {
            navigate('/admin-dashboard');
          } else {
            navigate('/');
          }
        }, 1500);
      } else {
        // Handle API returning success: false
        const errorMsg = response?.message || 'Invalid credentials. Please try again.';
        console.error('Login failed:', errorMsg);
        setErrors({ general: errorMsg });
      }
    } catch (error) {
      console.error('Login error caught:', error);
      const errorMsg = error?.data?.message || error?.message || 'Login failed. Please try again.';
      console.error('Error message:', errorMsg);
      setErrors({ general: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* Left Section - Logo & Branding */}
        <div className="login-left">
          <div className="logo-section">
            <img src={logo} alt="BDRap Logo" className="login-logo" />
            <h1>Welcome to banRAP</h1>
            <p>A Road Labeling, Star Rating and Safety Aware Navigation System</p>
          </div>
        </div>

        {/* Right Section - Login Form */}
        <div className="login-right">
          <div className="login-form-container">
            <h2>Log In</h2>

            {errors.general && <div className="error-box">{errors.general}</div>}
            {successMessage && <div className="success-box">{successMessage}</div>}

            <form onSubmit={handleSubmit}>
              {/* Email Field */}
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
                  placeholder="Enter your email"
                  className={errors.email ? 'input-error' : ''}
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              {/* Password Field */}
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) {
                        setErrors({ ...errors, password: '' });
                      }
                    }}
                    placeholder="Enter your password"
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
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="form-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <Link to="/forgot-password" className="forgot-password">Forgot password?</Link>
              </div>

              {/* Submit Button */}
              <button type="submit" className="login-button" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Log In'}
              </button>
            </form>

            {/* Sign Up Link */}
            <div className="signup-section">
              <p>Don't have an account? <Link to="/signup" className="signup-link">Sign up here</Link></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogIn;