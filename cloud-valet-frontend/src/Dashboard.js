import React from 'react';
import { Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';

const Dashboard = ({ username }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await fetch('/logout', { credentials: 'include' });
    navigate('/login');
  };

  return (
    <div>
      <Navbar onLogout={handleLogout} username={username} />
      <div style={{ padding: 32 }}>
        <h1>Welcome to Cloud Valet Dashboard</h1>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
          <Card title="Dashboard" style={{ width: 400 }}>
            <p>Welcome to Cloud Valet Dashboard!</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
