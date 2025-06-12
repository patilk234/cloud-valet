import React, { useState, useRef } from 'react';
import { Card, Layout, Menu, Spin, Alert, Table, Input, Modal, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlayCircleOutlined, PoweroffOutlined, ReloadOutlined, DisconnectOutlined, RedoOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import Navbar from './Navbar';

const { Sider, Content } = Layout;

const NotificationPanel = ({ visible, notifications, onClose, onClearAll, onDelete }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: visible ? 0 : '-40%',
      width: '30vw',
      minWidth: 320,
      maxWidth: 480,
      height: '100vh',
      background: '#fff',
      boxShadow: '-2px 0 16px rgba(0,0,0,0.15)',
      zIndex: 2000,
      transition: 'right 0.3s',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: 20, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#001529', color: '#fff' }}>
        <span style={{ fontWeight: 600, fontSize: 18 }}>Notifications</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {notifications.length > 0 && (
            <Button icon={<DeleteOutlined />} danger size="small" onClick={onClearAll} style={{ marginRight: 8 }}>
              Clear All
            </Button>
          )}
          <span style={{ cursor: 'pointer', fontSize: 20 }} onClick={onClose}><CloseOutlined /></span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#fafafa' }}>
        {notifications.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', marginTop: 48 }}>No notifications</div>
        ) : notifications.map((n, i) => (
          <div key={n.id} data-testid={`notification-${n.id}`} style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16, padding: 16, position: 'relative', borderLeft: '4px solid #ffd700' }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>{n.message}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{n.time}</div>
            <span style={{ position: 'absolute', top: 8, right: 8, cursor: 'pointer', color: '#888' }} onClick={() => onDelete(n.id)}><CloseOutlined /></span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Dashboard = ({ username, permission, darkMode, setDarkMode }) => {
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState('vms');
  const [vmLoading, setVmLoading] = useState(false);
  const [vmError, setVmError] = useState(null);
  const [vms, setVms] = useState({});
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedVms, setSelectedVms] = useState([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [bulkActionModal, setBulkActionModal] = useState(false);
  const notificationId = useRef(0);
  // Sorting state
  const [sorter, setSorter] = useState({ field: null, order: null });

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
        // Convert to object keyed by name
        const vmObj = {};
        vmList.forEach(vm => { if (vm.name) vmObj[vm.name] = vm; });
        setVms(vmObj);
        setVmLoading(false);
      })
      .catch(err => {
        setVmError(err.message || 'Failed to fetch VMs');
        setVmLoading(false);
      });
  };

  // Helper to add notification
  const addNotification = (msg) => {
    setNotifications((prev) => [
      { id: ++notificationId.current, message: msg, time: new Date().toLocaleString() },
      ...prev
    ]);
  };

  // Fix action past tense for notification
  const actionPastTense = {
    start: 'Started',
    deallocate: 'Deallocated',
    poweroff: 'Powered Off',
    restart: 'Restarted',
  };

  // Permission-based access
  const isWriteOrAdmin = permission === 'Write' || permission === 'Admin';

  // VM action handler
  const handleVmAction = (vm, action) => {
    // Allow both Write and Admin users to perform actions
    if (!(permission === 'Write' || permission === 'Admin')) return; // Block action for read-only users
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
            return res.json();
          })
          .then(updatedVm => {
            setVms(prev => ({ ...prev, [updatedVm.name]: updatedVm }));
            addNotification(`${updatedVm.name} ${actionPastTense[action]}`);
          })
          .catch(err => {
            setVmError(err.message || 'Failed to perform action');
            addNotification(`${vm.name} ${actionPastTense[action] || action} failed`);
          })
          .finally(() => {
            setActionLoading(prev => ({ ...prev, [vm.name]: null }));
          });
      },
    });
  };

  // Bulk action handler (per-VM parallel, immediate update)
  const handleBulkAction = (action) => {
    // Allow both Write and Admin users to perform actions
    if (!(permission === 'Write' || permission === 'Admin')) return; // Block action for read-only users
    Modal.confirm({
      title: `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)} for ${selectedVms.length} VMs`,
      content: `Are you sure you want to ${action} the selected VMs?`,
      okText: action.charAt(0).toUpperCase() + action.slice(1),
      okType: action === 'start' ? 'primary' : 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        Modal.destroyAll();
        const hide = message.loading(`Performing ${action} on ${selectedVms.length} VMs...`, 0);
        setActionLoading((prev) => {
          const loading = { ...prev };
          selectedVms.forEach((name) => (loading[name] = action));
          return loading;
        });
        // Track notifications to force state update after all
        let completed = 0;
        const total = selectedVms.length;
        selectedVms.forEach((name) => {
          const vm = vms[name];
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
            .then((res) => {
              if (!res.ok) throw new Error('Failed to perform action');
              return res.json();
            })
            .then((updatedVm) => {
              setVms((prev) => ({ ...prev, [updatedVm.name]: updatedVm }));
              addNotification(`${updatedVm.name} ${actionPastTense[action]}`);
            })
            .catch((err) => {
              setVmError(err.message || 'Failed to perform action');
              addNotification(`${vm.name} ${actionPastTense[action] || action} failed`);
            })
            .finally(() => {
              setActionLoading((prev) => ({ ...prev, [vm.name]: null }));
              completed++;
              if (completed === total) {
                // Force notifications state update to flush for tests
                setNotifications((prev) => [...prev]);
                hide();
              }
            });
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
          const vmList = Array.isArray(data) ? data : (Array.isArray(data.vms) ? data.vms : []);
          const vmObj = {};
          vmList.forEach(vm => { if (vm.name) vmObj[vm.name] = vm; });
          setVms(vmObj);
          setVmLoading(false);
        })
        .catch(err => {
          setVmError(err.message || 'Failed to fetch VMs');
          setVmLoading(false);
        });
    }
  }, [selectedKey]);

  // Filtered VMs based on search
  let filteredVms = Object.values(vms).filter(vm => {
    const q = search.toLowerCase();
    return (
      vm.name?.toLowerCase().includes(q) ||
      vm.resourceGroup?.toLowerCase().includes(q) ||
      vm.location?.toLowerCase().includes(q) ||
      vm.status?.toLowerCase().includes(q)
    );
  });
  if (sorter.field && sorter.order) {
    filteredVms = filteredVms.slice().sort((a, b) => {
      const aVal = a[sorter.field] || '';
      const bVal = b[sorter.field] || '';
      if (aVal < bVal) return sorter.order === 'ascend' ? -1 : 1;
      if (aVal > bVal) return sorter.order === 'ascend' ? 1 : -1;
      return 0;
    });
  }

  let mainContent;
  if (selectedKey === 'vms') {
    const columns = [
      { title: 'Name', dataIndex: 'name', key: 'name', sorter: true },
      { title: 'Resource Group', dataIndex: 'resourceGroup', key: 'resourceGroup', sorter: true },
      { title: 'Location', dataIndex: 'location', key: 'location', sorter: true },
      { title: 'Status', dataIndex: 'status', key: 'status', sorter: true },
      permission === 'read' ? null : {
        title: 'Action',
        key: 'action',
        render: (_, vm) => {
          if (!isWriteOrAdmin) return null; // Hide action buttons for read-only
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
    ].filter(Boolean);
    mainContent = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 8 }}>
          <h1 style={{ margin: 0, flex: 1 }}>Virtual Machines</h1>
          {/* Group Select and Bulk Action buttons in a flex row for alignment */}
          {(permission === 'Write' || permission === 'Admin') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                type={selectMode ? 'default' : 'primary'}
                onClick={() => {
                  setSelectMode((m) => !m);
                  setSelectedVms([]);
                }}
              >
                {selectMode ? 'Cancel' : 'Select'}
              </Button>
              <Button
                type="primary"
                disabled={!selectMode || selectedVms.length === 0}
                onClick={() => setBulkActionModal(true)}
              >
                Bulk Action
              </Button>
            </div>
          )}
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
        ) : (
          <Table
            dataSource={filteredVms}
            columns={columns}
            rowKey="name"
            rowSelection={
              permission === 'Write' || permission === 'Admin'
                ? {
                    selectedRowKeys: selectedVms,
                    onChange: setSelectedVms,
                    columnTitle: () => (
                      <input
                        type="checkbox"
                        data-testid="bulk-select-all"
                        checked={
                          filteredVms.length > 0 && selectedVms.length === filteredVms.length
                        }
                        disabled={
                          !selectMode || filteredVms.length === 0
                        }
                        onChange={e => {
                          if (e.target.checked) setSelectedVms(filteredVms.map(vm => vm.name));
                          else setSelectedVms([]);
                        }}
                      />
                    ),
                    getCheckboxProps: () => ({ disabled: !selectMode }),
                  }
                : undefined
            }
            pagination={{
              pageSize: 10,
              total: filteredVms.length,
              showSizeChanger: true,
              pageSizeOptions: [10, 25, 50, 75, 100],
              showTotal: (total) => `Total ${total} VMs`,
            }}
            onChange={(pagination, filters, sorterObj) => {
              if (sorterObj && sorterObj.field && sorterObj.order) {
                setSorter({ field: sorterObj.field, order: sorterObj.order });
              } else {
                setSorter({ field: null, order: null });
              }
            }}
            locale={{
              emptyText: (
                <Card title="No Virtual Machines found" style={{ width: 400, margin: '0 auto' }}>
                  <p>No VMs were found for your Azure account.</p>
                </Card>
              ),
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
      <Navbar
        onLogout={handleLogout}
        username={username}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onShowNotifications={() => setNotificationPanelOpen(true)}
        notificationCount={notifications.length}
      />
      <NotificationPanel
        visible={notificationPanelOpen}
        notifications={notifications}
        onClose={() => setNotificationPanelOpen(false)}
        onClearAll={() => setNotifications([])}
        onDelete={id => setNotifications(notifications => notifications.filter(n => n.id !== id))}
      />
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
      {/* Bulk Action Modal - only render when open and for Write/Admin users */}
      {(permission === 'Write' || permission === 'Admin') && bulkActionModal && (
        <Modal
          title="Bulk Action"
          open={bulkActionModal}
          onCancel={() => setBulkActionModal(false)}
          footer={null}
          destroyOnClose
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Button
              data-testid="bulk-action-start"
              icon={<PlayCircleOutlined />}
              disabled={selectedVms.length === 0}
              onClick={() => { setBulkActionModal(false); handleBulkAction('start'); }}
              block
            >
              Start
            </Button>
            <Button
              data-testid="bulk-action-deallocate"
              icon={<PoweroffOutlined />}
              disabled={selectedVms.length === 0}
              onClick={() => { setBulkActionModal(false); handleBulkAction('deallocate'); }}
              block
            >
              Deallocate
            </Button>
            <Button
              data-testid="bulk-action-poweroff"
              icon={<DisconnectOutlined />}
              disabled={selectedVms.length === 0}
              onClick={() => { setBulkActionModal(false); handleBulkAction('poweroff'); }}
              block
            >
              PowerOff
            </Button>
            <Button
              data-testid="bulk-action-restart"
              icon={<RedoOutlined />}
              disabled={selectedVms.length === 0}
              onClick={() => { setBulkActionModal(false); handleBulkAction('restart'); }}
              block
            >
              <span>Restart</span>
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default Dashboard;
