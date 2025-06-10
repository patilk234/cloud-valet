import React, { useState } from 'react';
import { Layout, Menu, Button, Modal, Select, message, List, Avatar, Pagination } from 'antd';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import UsersList from './UsersList';
import AddUserModal from './AddUserModal';

const { Sider, Content } = Layout;

// Set your backend API base URL here
const API_BASE = "http://localhost:8000";

const Settings = () => {
  const [selectedKey, setSelectedKey] = useState('users');
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [permissionUsers, setPermissionUsers] = useState([]);
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [bulkPermission, setBulkPermission] = useState();
  const [permissionSearch, setPermissionSearch] = useState('');
  const [permissionPage, setPermissionPage] = useState(1);
  const [userPermission, setUserPermission] = useState(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await fetch('/logout', { credentials: 'include' });
    navigate('/login');
  };

  const handleUserAdded = () => {
    setRefreshKey(k => k + 1);
  };

  // Fetch users by permission
  const fetchUsersByPermission = async (permission) => {
    setSelectedPermission(permission);
    try {
      const res = await fetch('/users/', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setPermissionUsers(data.filter(u => (u.permission || 'Read') === permission));
    } catch {
      setPermissionUsers([]);
    }
  };

  // Fetch all users for bulk modify
  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/users/', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setAllUsers(data);
    } catch {
      setAllUsers([]);
    }
  };

  const handleBulkModify = async () => {
    if (!selectedUsers.length || !bulkPermission) {
      message.error('Please select at least one user and a permission');
      return;
    }
    try {
      await Promise.all(selectedUsers.map(async username => {
        const user = allUsers.find(u => u.username === username);
        if (!user) return;
        const payload = { new_username: user.username, email: user.email, permission: bulkPermission };
        await fetch(`/users/${user.username}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(payload).toString(),
          credentials: 'include',
        });
      }));
      message.success('Permissions updated successfully');
      setModifyModalOpen(false);
      setSelectedUsers([]);
      setBulkPermission(undefined);
    } catch {
      message.error('Failed to update permissions');
    }
  };

  React.useEffect(() => {
    // Fetch current user info on mount
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/me`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch user');
        const data = await res.json();
        setUserPermission(data.permission || 'Read');
        console.log('Fetched user permission:', data.permission, 'for user:', data.username);
      } catch (e) {
        setUserPermission('Read'); // fallback
        console.log('Failed to fetch user permission, defaulting to Read', e);
      }
    };
    fetchCurrentUser();
  }, []);

  return (
    <div>
      <Navbar onLogout={handleLogout} />
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={240} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: '100%', borderRight: 0 }}
            onClick={({ key }) => setSelectedKey(key)}
            items={[
              { key: 'users', label: 'Users' },
              { key: 'permissions', label: 'Permissions' },
              { key: 'about', label: 'About Us' },
            ]}
          />
        </Sider>
        <Layout style={{ background: '#fff' }}>
          <Content style={{ margin: 24, minHeight: 280 }}>
            {selectedKey === 'users' && (
              userPermission === 'Admin' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>Users</h2>
                    <Button type="primary" onClick={() => setAddUserOpen(true)}>
                      Add User
                    </Button>
                  </div>
                  <UsersList refreshKey={refreshKey} />
                  <AddUserModal open={addUserOpen} onClose={() => setAddUserOpen(false)} onUserAdded={handleUserAdded} />
                </div>
              ) : (
                <div style={{ padding: 48, textAlign: 'center', color: '#d46b08', fontSize: 18, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  Not enough permissions to view this section.
                </div>
              )
            )}
            {selectedKey === 'permissions' && (
              userPermission === 'Admin' ? (
                <div>
                  <h2 style={{ margin: 0, marginBottom: 8 }}>Permissions</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                    <Button type={selectedPermission === 'Read' ? 'primary' : 'default'} onClick={() => fetchUsersByPermission('Read')}>Read</Button>
                    <Button type={selectedPermission === 'Write' ? 'primary' : 'default'} onClick={() => fetchUsersByPermission('Write')}>Write</Button>
                    <Button type={selectedPermission === 'Admin' ? 'primary' : 'default'} onClick={() => fetchUsersByPermission('Admin')}>Admin</Button>
                    <Button type="primary" onClick={() => { setModifyModalOpen(true); fetchAllUsers(); }} style={{ marginLeft: 'auto' }}>
                      Modify
                    </Button>
                  </div>
                  {selectedPermission && (
                    <div>
                      <h3>Users with {selectedPermission} Permission</h3>
                      <input
                        type="text"
                        placeholder="Search users by name or email"
                        value={permissionSearch || ''}
                        onChange={e => {
                          setPermissionSearch(e.target.value);
                          setPermissionPage(1); // Reset to first page on search
                        }}
                        style={{ marginBottom: 16, width: 320, padding: 8, borderRadius: 4, border: '1px solid #d9d9d9' }}
                      />
                      <List
                        itemLayout="horizontal"
                        dataSource={permissionUsers.filter(u =>
                          (!permissionSearch ||
                            u.username.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                            u.email.toLowerCase().includes(permissionSearch.toLowerCase())
                          )
                        ).slice((permissionPage - 1) * 8, permissionPage * 8)}
                        locale={{ emptyText: <span style={{ color: '#888' }}>No users found.</span> }}
                        renderItem={u => (
                          <List.Item>
                            <List.Item.Meta
                              avatar={<Avatar style={{ backgroundColor: '#1890ff', verticalAlign: 'middle' }}>{u.username[0]?.toUpperCase()}</Avatar>}
                              title={<span style={{ fontWeight: 500 }}>{u.username}</span>}
                              description={<span style={{ color: '#888' }}>{u.email}</span>}
                            />
                          </List.Item>
                        )}
                        style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: 16 }}
                        pagination={false}
                      />
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                        <Pagination
                          current={permissionPage}
                          pageSize={8}
                          total={permissionUsers.filter(u =>
                            (!permissionSearch ||
                              u.username.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                              u.email.toLowerCase().includes(permissionSearch.toLowerCase())
                            )
                          ).length}
                          onChange={setPermissionPage}
                          showSizeChanger={false}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: 48, textAlign: 'center', color: '#d46b08', fontSize: 18, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  Not enough permissions to view this section.
                </div>
              )
            )}
            {selectedKey === 'about' && (
              <div>
                <h2>About Us</h2>
                <p>
                  <b>Cloud Valet</b> is your all-in-one cloud management solution, designed to simplify and secure your cloud operations.<br/>
                  Our mission is to empower users with intuitive tools for managing users, groups, tags, and virtual machines.<br/>
                  <br/>
                  <b>Contact:</b> support@cloudvalet.com
                </p>
                <div style={{ marginTop: 32, color: '#888', fontSize: 14 }}>
                  &copy; {new Date().getFullYear()} Cloud Valet. All rights reserved.
                </div>
              </div>
            )}
          </Content>
        </Layout>
      </Layout>
      <Modal
        title="Bulk Modify Permissions"
        open={modifyModalOpen}
        onCancel={() => setModifyModalOpen(false)}
        onOk={handleBulkModify}
        okText="Update"
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <label><b>Select Users</b></label>
          <Select
            mode="multiple"
            showSearch
            allowClear
            style={{ width: '100%' }}
            placeholder="Type to search and select users"
            value={selectedUsers}
            onChange={setSelectedUsers}
            filterOption={(input, option) => {
              // option can be an object with children as a ReactNode, so use option.label
              const label = typeof option.label === 'string' ? option.label : '';
              return label.toLowerCase().includes(input.toLowerCase());
            }}
            options={allUsers.map(u => ({
              label: `${u.username} (${u.email})`,
              value: u.username
            }))}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label><b>Select Permission</b></label>
          <Select
            style={{ width: '100%' }}
            placeholder="Select permission"
            value={bulkPermission}
            onChange={setBulkPermission}
          >
            <Select.Option value="Read">Read</Select.Option>
            <Select.Option value="Write">Write</Select.Option>
            <Select.Option value="Admin">Admin</Select.Option>
          </Select>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;
