import React, { useEffect, useState } from 'react'
import Header from './component/Header.jsx'
import Loader from './component/Loader.jsx'
import LogIn from './component/LogIn.jsx'
import SignUp from './component/SignUp.jsx'
import ForgotPassword from './component/ForgotPassword.jsx'
import HomePage from './component/HomePage.jsx'
import TravelerDashboard from './component/TravelerDashboard.jsx'
import AnalystDashboard from './component/AnalystDashboard.jsx'
import AdminDashboard from './component/AdminDashboard.jsx'
import RoadLabeling from './component/RoadLabeling.jsx'
import Labeling from './component/Labeling.jsx'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate app initialization - you can replace this with actual API calls
    // or other initialization logic
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000) // Show loader for 2 seconds

    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return <Loader />
  }

  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<TravelerDashboard />} />
        <Route path="/login" element={<LogIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<TravelerDashboard />} />
        <Route path="/analyst-dashboard" element={<AnalystDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/road-labeling" element={<RoadLabeling />} />
        <Route path="/road-labeling/label" element={<Labeling />} />
      </Routes>
    </Router>
  )
}

export default App
