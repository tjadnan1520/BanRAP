import pp from '../assets/logo_BDRap.png'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import '../styles/Header.css'
import { authAPI } from '../utils/api'

function Header(){ 
    const navigate = useNavigate();
    const location = useLocation();
    const [currentUser, setCurrentUser] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);

    // Function to load user from localStorage
    const loadUser = () => {
        const user = localStorage.getItem('currentUser');
        if (user) {
            try {
                setCurrentUser(JSON.parse(user));
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        } else {
            setCurrentUser(null);
        }
    };

    // Check user on mount and whenever location changes
    useEffect(() => {
        loadUser();
        setShowDropdown(false); // Close dropdown when navigating
    }, [location]);

    // Listen for custom login event
    useEffect(() => {
        const handleUserLogin = () => {
            loadUser();
        };

        window.addEventListener('userLoggedIn', handleUserLogin);
        
        return () => {
            window.removeEventListener('userLoggedIn', handleUserLogin);
        };
    }, []);

    const handleLogout = async () => {
        try {
            // Call backend to clear httpOnly cookie
            await authAPI.logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
        // Clear local storage regardless of API result
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        localStorage.removeItem('rememberMe');
        setCurrentUser(null);
        setShowDropdown(false);
        navigate('/');
    };

    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    return(
        <nav className="navbar">
            <div className="navbar-container">
                <div className="navbar-brand">
                    <img src={pp} alt="BanRAP Logo" className="navbar-logo" />
                    <span className="navbar-title">
                        <span className="brand-ban">ban</span>
                        <span className="brand-rap">RAP</span>
                    </span>
                </div>

                <ul className="navbar-menu">
                    <li className="nav-item"><Link to="/" className="nav-link">Home</Link></li>
                    <li className="nav-item"><a href="#features" className="nav-link">Features</a></li>
                    <li className="nav-item"><a href="#about" className="nav-link">About Us</a></li>
                    <li className="nav-item"><a href="#contact" className="nav-link" onClick={e => {
                        e.preventDefault();
                        document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
                    }}>Contact</a></li>
                    
                    {currentUser && currentUser.role === 'TRAVELLER' && (
                      <li className="nav-item"><Link to="/dashboard" className="nav-link">Traveler Dashboard</Link></li>
                    )}
                    {currentUser && currentUser.role === 'ANNOTATOR' && (
                      <li className="nav-item"><Link to="/analyst-dashboard" className="nav-link">Analyst Dashboard</Link></li>
                    )}
                    {currentUser && currentUser.role === 'ADMIN' && (
                      <li className="nav-item"><Link to="/admin-dashboard" className="nav-link">Admin Dashboard</Link></li>
                    )}
                </ul>

                <div className="navbar-auth">
                    {currentUser ? (
                        <div className="user-profile-container">
                            <button 
                                className="user-profile-btn"
                                onClick={toggleDropdown}
                                title={`${currentUser.firstName} ${currentUser.lastName}`}
                            >
                                <span className="profile-icon">👤</span>
                            </button>
                            {showDropdown && (
                                <div className="dropdown-menu">
                                    <div className="dropdown-header">
                                        <span className="dropdown-name">{currentUser.firstName} {currentUser.lastName}</span>
                                        <span className="dropdown-email">{currentUser.email}</span>
                                        <span className="dropdown-role">{currentUser.role}</span>
                                    </div>
                                    <div className="dropdown-divider"></div>
                                    <button className="dropdown-item" onClick={handleLogout}>
                                        🚪 Log Out
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="auth-buttons">
                            <Link to="/login" className="nav-link-login">Log In</Link>
                            <Link to="/signup" className="nav-link-signup">Sign Up</Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default Header;
