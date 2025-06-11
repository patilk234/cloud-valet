import React, { useState } from 'react';
import { Card, Layout, Menu } from 'antd';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';

const { Sider, Content } = Layout;

const Dashboard = ({ username }) => {
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState('vms');

  const handleLogout = async () => {
    await fetch('/logout', { credentials: 'include' });
    navigate('/login');
  };

  let mainContent;
  if (selectedKey === 'vms') {
    mainContent = (
      <>
        <h1>Virtual Machines</h1>
        <Card title="Dashboard" style={{ width: 400, margin: '0 auto' }}>
          <p>Welcome to Cloud Valet Dashboard!</p>
          <p>Here you will see your list of Virtual Machines.</p>
        </Card>
      </>
    );
  } else if (selectedKey === 'schedule') {
    mainContent = (
      <>
        <h1>Power Schedule</h1>
        <Card title="Power Schedule" style={{ width: 400, margin: '0 auto' }}>
          <p>Manage and view your VM power schedules here.</p>
        </Card>
      </>
    );
  } else if (selectedKey === 'tags') {
    mainContent = (
      <>
        <h1>Tags</h1>
        <Card title="Tags" style={{ width: 400, margin: '0 auto' }}>
          <p>Organize your resources with tags.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <Navbar onLogout={handleLogout} username={username} />
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={240} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: '100%', borderRight: 0 }}
            onSelect={({ key }) => setSelectedKey(key)}
            items={[
              { key: 'vms', label: 'Virtual Machines' },
              { key: 'schedule', label: 'Power Schedule' },
              { key: 'tags', label: 'Tags' },
            ]}
          />
        </Sider>
        <Layout style={{ background: '#fff' }}>
          <Content style={{ margin: 24, minHeight: 280 }}>
            {mainContent}
          </Content>
        </Layout>
      </Layout>
    </>
  );
};

export default Dashboard;
