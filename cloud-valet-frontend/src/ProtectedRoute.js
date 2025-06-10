import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

const API_BASE = "http://localhost:8000";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(`${API_BASE}/users/me`, { credentials: 'include' });
        if (res.ok) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      } catch {
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  if (loading) return null; // or a spinner
  if (!authenticated) return <Navigate to="/login" replace />;
  return children;
}
