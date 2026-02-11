import React from 'react';
import { Link } from 'react-router-dom';
import Footer from './Footer';
import '../styles/HomePage.css';

const HomePage = () => {
  return (
    <div className="home-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">banRAP</h1>
            <p className="hero-subtitle">Road Labeling, Star Rating & Safety-Aware Navigation System</p>
            <p className="hero-description">
              Empowering Bangladesh with data-driven road safety assessment and intelligent navigation solutions
            </p>
            <div className="hero-buttons">
              <Link to="/login" className="btn btn-primary">Get Started</Link>
              <button className="btn btn-secondary" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
                Learn More
              </button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section" id="features">
          <div className="features-container">
            <h2 className="section-title">Core Features</h2>
            <div className="features-grid">
              {/* Feature 1: Road Labeling */}
              <div className="feature-card">
                <div className="feature-icon">🗺️</div>
                <h3>Road Labeling Tool</h3>
                <p className="feature-subtitle">Precision Road Assessment</p>
                <p className="feature-description">
                  Interactive mapping tool for analysts to select roads, divide them into 100-meter sections, and label each segment using 2D, 3D, and Street View perspectives.
                </p>
                <ul className="feature-list">
                  <li>✓ Multi-perspective analysis (2D, 3D, Street View)</li>
                  <li>✓ 100-meter segment division</li>
                <li>✓ Comprehensive labeling system</li>
                <li>✓ Real-time data collection</li>
              </ul>
            </div>

            {/* Feature 2: Star Rating */}
            <div className="feature-card">
              <div className="feature-icon">⭐</div>
              <h3>Star Rating System</h3>
              <p className="feature-subtitle">Intelligent Safety Scoring</p>
              <p className="feature-description">
                Advanced algorithm that converts road labels into 1–5 star safety scores based on iRAP-inspired rules, making road risk levels easy to understand.
              </p>
              <ul className="feature-list">
                <li>✓ iRAP-based scoring</li>
                <li>✓ Factors: speed, pedestrians, environment</li>
                <li>✓ Easy-to-understand ratings</li>
                <li>✓ Evidence-based planning</li>
              </ul>
            </div>

            {/* Feature 3: Navigation */}
            <div className="feature-card">
              <div className="feature-icon">🧭</div>
              <h3>Safety-Aware Navigation</h3>
              <p className="feature-subtitle">Smart Route Planning</p>
              <p className="feature-description">
                Intelligent navigation system that prioritizes road safety ratings over speed, guiding users toward safer routes for a better travel experience.
              </p>
              <ul className="feature-list">
                <li>✓ Safety-first routing</li>
                <li>✓ Real-time adjustments</li>
                <li>✓ Community feedback integration</li>
                <li>✓ Risk-aware travel time</li>
              </ul>
            </div>

            {/* Feature 4: User Engagement */}
            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3>Community Engagement</h3>
              <p className="feature-subtitle">Collaborative Safety</p>
              <p className="feature-description">
                Users can explore star-rated roads, report issues, submit feedback, and contribute to improve the national road safety database collectively.
              </p>
              <ul className="feature-list">
                <li>✓ Star-rated road explorer</li>
                <li>✓ Issue reporting system</li>
                <li>✓ Feedback submission</li>
                <li>✓ Database improvement</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* User Roles Section */}
      <section className="roles-section">
        <div className="roles-container">
          <h2 className="section-title">For Different Users</h2>
          <div className="roles-grid">
            {/* Analyst Role */}
            <div className="role-card analyst-role">
              <div className="role-icon">👨‍💼</div>
              <h3>Road Analysts</h3>
              <p>Conduct comprehensive road safety assessments with professional tools.</p>
              <Link to="/login" className="role-btn">Analyst Login</Link>
            </div>

            {/* Traveler Role */}
            <div className="role-card traveler-role">
              <div className="role-icon">🚗</div>
              <h3>Travelers & Users</h3>
              <p>Plan safer journeys with intelligent route recommendations.</p>
              <Link to="/login" className="role-btn">User Login</Link>
            </div>

            {/* Admin Role */}
            <div className="role-card admin-role">
              <div className="role-icon">🔐</div>
              <h3>Administrators</h3>
              <p>Oversee system operations and manage overall platform activities.</p>
              <Link to="/login" className="role-btn">Admin Login</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why BanRAP Section */}
      <section className="why-section">
        <div className="why-container">
          <h2 className="section-title">Why BanRAP?</h2>
          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-number">01</div>
              <h4>Data-Driven Safety</h4>
              <p>Scientifically-backed road safety assessment using proven methodologies.</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-number">02</div>
              <h4>Easy Visualization</h4>
              <p>Simple star ratings help everyone understand road safety at a glance.</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-number">03</div>
              <h4>Community-Driven</h4>
              <p>Collaborative platform where users contribute to road safety improvement.</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-number">04</div>
              <h4>Smart Navigation</h4>
              <p>Advanced routing that prioritizes safety over speed for better outcomes.</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-number">05</div>
              <h4>Evidence-Based Planning</h4>
              <p>Support policy makers with concrete data for infrastructure improvements.</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-number">06</div>
              <h4>National Database</h4>
              <p>Comprehensive road safety information for the entire Bangladesh network.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Ready to Experience Safe Navigation?</h2>
          <p>Join thousands of users making roads safer across Bangladesh</p>
          <div className="cta-buttons">
            <Link to="/signup" className="btn btn-primary btn-large">Sign Up Now</Link>
            <Link to="/login" className="btn btn-secondary btn-large">Log In</Link>
          </div>
        </div>
      </section>

        {/* Stats Section */}
        <section className="stats-section">
          <div className="stats-container">
            <div className="stat-card">
              <div className="stat-number">0</div>
              {/* 10,000+ */}
              <div className="stat-label">Road Segments</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">0</div>
              {/* 1,000+ */}
              <div className="stat-label">Active Users</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">0</div>
              {/* 50+ */}
              <div className="stat-label">Trained Analysts</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">100%</div>
              <div className="stat-label">Safety Focused</div>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;
