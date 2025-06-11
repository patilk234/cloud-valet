import React, { useState } from 'react';
import { Card, Layout, Menu, Spin, Alert, Table } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlayCircleOutlined, PoweroffOutlined, ReloadOutlined, DisconnectOutlined } from '@ant-design/icons';
import Navbar from './Navbar';

const { Sider, Content } = Layout;

const Dashboard = ({ username }) => {
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState('vms');
  const [vmLoading, setVmLoading] = useState(false);
  const [vmError, setVmError] = useState(null);
  const [vms, setVms] = useState([]);

  const handleLogout = async () => {
    await fetch('/logout', { credentials: 'include' });
    navigate('/login');
  };

  const handleRefresh = () => {
    setVmLoading(true);
    setVmError(null);
    fetch('/azure/vms', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch VMs');
        return res.json();
      })
      .then(data => {
        const vmList = Array.isArray(data) ? data : (Array.isArray(data.vms) ? data.vms : []);
        setVms(vmList);
        setVmLoading(false);
      })
      .catch(err => {
        setVmError(err.message || 'Failed to fetch VMs');
        setVmLoading(false);
      });
  };

  React.useEffect(() => {
    if (selectedKey === 'vms') {
      setVmLoading(true);
      setVmError(null);
      fetch('/azure/vms', { credentials: 'include' })
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch VMs');
          return res.json();
        })
        .then(data => {
          // Support both {vms: [...]} and [...] for backward compatibility
          const vmList = Array.isArray(data) ? data : (Array.isArray(data.vms) ? data.vms : []);
          setVms(vmList);
          setVmLoading(false);
        })
        .catch(err => {
          setVmError(err.message || 'Failed to fetch VMs');
          setVmLoading(false);
        });
    }
  }, [selectedKey]);

  let mainContent;
  if (selectedKey === 'vms') {
    const columns = [
      { title: 'Name', dataIndex: 'name', key: 'name' },
      { title: 'Resource Group', dataIndex: 'resourceGroup', key: 'resourceGroup' },
      { title: 'Location', dataIndex: 'location', key: 'location' },
      { title: 'Status', dataIndex: 'status', key: 'status' },
      {
        title: 'Action',
        key: 'action',
        render: (_, vm) => (
          <div style={{ display: 'flex', gap: 12 }}>
            <span title="Start VM">
              <PlayCircleOutlined style={{ fontSize: 22, color: '#52c41a', cursor: 'pointer' }} />
            </span>
            <span title="Deallocate VM">
              <PoweroffOutlined style={{ fontSize: 22, color: '#faad14', cursor: 'pointer' }} />
            </span>
            <span title="PowerOff">
              <DisconnectOutlined style={{ fontSize: 22, color: '#d46b08', cursor: 'pointer' }} />
            </span>
          </div>
        ),
      },
    ];
    mainContent = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ margin: 0, flex: 1 }}>Virtual Machines</h1>
          <ReloadOutlined
            title="Refresh VM list"
            style={{ fontSize: 24, color: '#1890ff', cursor: 'pointer', marginLeft: 12 }}
            onClick={handleRefresh}
            spin={vmLoading}
          />
        </div>
        {vmLoading ? (
          <Spin tip="Loading VMs..." />
        ) : vmError ? (
          <Alert type="error" message={vmError} showIcon />
        ) : vms.length === 0 ? (
          <Card title="No Virtual Machines found" style={{ width: 400, margin: '0 auto' }}>
            <p>No VMs were found for your Azure account.</p>
          </Card>
        ) : (
          <Table
            dataSource={vms.map((vm, i) => ({ key: i, ...vm }))}
            columns={columns}
            pagination={{ pageSize: 8 }}
          />
        )}
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
