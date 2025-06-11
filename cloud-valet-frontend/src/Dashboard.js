import React, { useState } from 'react';
import { Card, Layout, Menu, Spin, Alert, Table, Input, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlayCircleOutlined, PoweroffOutlined, ReloadOutlined, DisconnectOutlined, RedoOutlined } from '@ant-design/icons';
import Navbar from './Navbar';

const { Sider, Content } = Layout;

const Dashboard = ({ username, permission, darkMode, setDarkMode }) => {
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState('vms');
  const [vmLoading, setVmLoading] = useState(false);
  const [vmError, setVmError] = useState(null);
  const [vms, setVms] = useState([]);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState({});

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

  // VM action handler
  const handleVmAction = (vm, action) => {
    const actionLabels = {
      start: 'Start',
      deallocate: 'Deallocate',
      poweroff: 'Power Off',
      restart: 'Restart',
    };
    Modal.confirm({
      title: `Confirm ${actionLabels[action]} VM`,
      content: `Are you sure you want to ${actionLabels[action].toLowerCase()} VM '${vm.name}'?`,
      okText: actionLabels[action],
      okType: action === 'start' ? 'primary' : 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        setActionLoading(prev => ({ ...prev, [vm.name]: action }));
        fetch('/azure/vm/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: vm.name,
            resourceGroup: vm.resourceGroup,
            action,
          }),
        })
          .then(res => {
            if (!res.ok) throw new Error('Failed to perform action');
            handleRefresh();
          })
          .catch(err => {
            setVmError(err.message || 'Failed to perform action');
          })
          .finally(() => {
            setActionLoading(prev => ({ ...prev, [vm.name]: null }));
          });
      },
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

  // Filtered VMs based on search
  const filteredVms = vms.filter(vm => {
    const q = search.toLowerCase();
    return (
      vm.name?.toLowerCase().includes(q) ||
      vm.resourceGroup?.toLowerCase().includes(q) ||
      vm.location?.toLowerCase().includes(q) ||
      vm.status?.toLowerCase().includes(q)
    );
  });

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
        render: (_, vm) => {
          // Normalize status for logic
          const status = (vm.status || '').toLowerCase();
          const isRunning = status === 'vm running' || status === 'running';
          const isDeallocated = status === 'vm deallocated' || status === 'deallocated';
          const isStopped = status === 'vm stopped' || status === 'stopped' || status === 'poweroff' || status === 'vm stopped (deallocated)';

          // Button enable/disable logic
          const disableStart = isRunning;
          const disableDeallocate = isDeallocated;
          const disablePoweroff = isDeallocated || isStopped;
          const disableRestart = isDeallocated || isStopped;

          return (
            <div style={{ display: 'flex', gap: 12 }}>
              <span title="Start VM">
                <PlayCircleOutlined
                  style={{ fontSize: 22, color: disableStart ? '#aaa' : '#52c41a', cursor: disableStart || actionLoading[vm.name] ? 'not-allowed' : 'pointer', opacity: disableStart || actionLoading[vm.name] ? 0.5 : 1 }}
                  onClick={() => !disableStart && !actionLoading[vm.name] && handleVmAction(vm, 'start')}
                  spin={actionLoading[vm.name] === 'start'}
                />
              </span>
              <span title="Deallocate VM">
                <PoweroffOutlined
                  style={{ fontSize: 22, color: disableDeallocate ? '#aaa' : '#faad14', cursor: disableDeallocate || actionLoading[vm.name] ? 'not-allowed' : 'pointer', opacity: disableDeallocate || actionLoading[vm.name] ? 0.5 : 1 }}
                  onClick={() => !disableDeallocate && !actionLoading[vm.name] && handleVmAction(vm, 'deallocate')}
                  spin={actionLoading[vm.name] === 'deallocate'}
                />
              </span>
              <span title="PowerOff">
                <DisconnectOutlined
                  style={{ fontSize: 22, color: disablePoweroff ? '#aaa' : '#d46b08', cursor: disablePoweroff || actionLoading[vm.name] ? 'not-allowed' : 'pointer', opacity: disablePoweroff || actionLoading[vm.name] ? 0.5 : 1 }}
                  onClick={() => !disablePoweroff && !actionLoading[vm.name] && handleVmAction(vm, 'poweroff')}
                  spin={actionLoading[vm.name] === 'poweroff'}
                />
              </span>
              <span title="Restart VM">
                <RedoOutlined
                  style={{ fontSize: 22, color: disableRestart ? '#aaa' : '#1890ff', cursor: disableRestart || actionLoading[vm.name] ? 'not-allowed' : 'pointer', opacity: disableRestart || actionLoading[vm.name] ? 0.5 : 1 }}
                  onClick={() => !disableRestart && !actionLoading[vm.name] && handleVmAction(vm, 'restart')}
                  spin={actionLoading[vm.name] === 'restart'}
                />
              </span>
            </div>
          );
        },
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
        <Input.Search
          placeholder="Search VMs..."
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 16, maxWidth: 400 }}
        />
        {vmLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <Spin tip="Loading VMs..." />
          </div>
        ) : vmError ? (
          <Alert type="error" message={vmError} showIcon />
        ) : filteredVms.length === 0 ? (
          <Card title="No Virtual Machines found" style={{ width: 400, margin: '0 auto' }}>
            <p>No VMs were found for your Azure account.</p>
          </Card>
        ) : (
          <Table
            dataSource={filteredVms.map((vm, i) => ({ key: i, ...vm }))}
            columns={columns}
            pagination={{
              pageSize: 10,
              total: filteredVms.length,
              showSizeChanger: true,
              pageSizeOptions: [10, 25, 50, 75, 100],
              showTotal: (total) => `Total ${total} VMs`,
            }}
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
      <Navbar onLogout={handleLogout} username={username} darkMode={darkMode} setDarkMode={setDarkMode} />
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={240} style={{ background: darkMode ? '#181818' : '#fff', borderRight: darkMode ? '1px solid #222' : '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: '100%', borderRight: 0, background: darkMode ? '#181818' : '#fff', color: darkMode ? '#fff' : undefined }}
            onSelect={({ key }) => setSelectedKey(key)}
            items={[
              { key: 'vms', label: 'Virtual Machines' },
              { key: 'schedule', label: 'Power Schedule' },
              { key: 'tags', label: 'Tags' },
            ]}
          />
        </Sider>
        <Layout style={{ background: darkMode ? '#181818' : '#fff' }}>
          <Content style={{ margin: 24, minHeight: 280, color: darkMode ? '#fff' : undefined }}>
            {mainContent}
          </Content>
        </Layout>
      </Layout>
    </>
  );
};

export default Dashboard;
