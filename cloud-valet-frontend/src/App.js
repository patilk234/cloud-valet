import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import Settings from './Settings';
import ProtectedRoute from './ProtectedRoute';
import 'antd/dist/reset.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    // Persist dark mode in localStorage
    const stored = localStorage.getItem('cloudvalet-darkmode');
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('cloudvalet-darkmode', darkMode);
    document.body.classList.toggle('dark-theme', darkMode);
  }, [darkMode]);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/users/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  if (loading) return null; // or a spinner

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard username={user?.username} permission={user?.permission} darkMode={darkMode} setDarkMode={setDarkMode} />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings username={user?.username} permission={user?.permission} darkMode={darkMode} setDarkMode={setDarkMode} />
          </ProtectedRoute>
        } />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
