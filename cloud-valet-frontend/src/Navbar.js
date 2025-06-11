import React from 'react';
import { Menu, Button } from 'antd';
import { HomeOutlined, SettingOutlined, BulbOutlined, BulbFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const Navbar = ({ onLogout, username, darkMode, setDarkMode }) => {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      background: '#001529',
      padding: '0 24px',
      height: 64,
      color: 'white',
      boxShadow: '0 2px 8px #f0f1f2',
      zIndex: 1000
    }}>
      <div style={{ fontWeight: 'bold', fontSize: 22, marginRight: 32, color: 'white', letterSpacing: 1 }}>
        <span role="img" aria-label="logo" style={{ marginRight: 8 }}>☁️</span> Cloud Valet
      </div>
      <Menu
        theme="dark"
        mode="horizontal"
        selectable={false}
        style={{ background: 'transparent', flex: 1 }}
        items={[
          {
            key: 'home',
            icon: <HomeOutlined />,
            label: 'Home',
            onClick: () => navigate('/dashboard'),
          },
          {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Settings',
            onClick: () => navigate('/settings'),
          },
        ]}
      />
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ marginRight: 16 }}>
          <span
            style={{ cursor: 'pointer', fontSize: 22 }}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? <BulbFilled style={{ color: '#ffd700' }} /> : <BulbOutlined style={{ color: '#fff' }} />}
          </span>
        </span>
        {username && <span style={{ marginRight: 16, fontWeight: 500, color: 'white' }}>Hello, {username}</span>}
        <Button type="primary" onClick={onLogout} style={{ marginLeft: 8 }}>
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Navbar;
