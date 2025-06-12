import React, { useState } from 'react';
import { Layout, Menu, Button, Modal, Select, message, List, Avatar, Pagination } from 'antd';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import UsersList from './UsersList';
import AddUserModal from './AddUserModal';

const { Sider, Content } = Layout;

const API_BASE = "http://localhost:8000";

const Settings = ({ username, permission, darkMode, setDarkMode = () => {} }) => {
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
  const [providerForm, setProviderForm] = useState({
    clientId: '',
    tenantId: '',
    clientSecret: ''
  });
  const [providerSaved, setProviderSaved] = useState(false);
  const [providerEditMode, setProviderEditMode] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    // Fetch provider info from backend
    const fetchProvider = async () => {
      try {
        const res = await fetch(`${API_BASE}/provider/azure`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.clientId || data.tenantId || data.clientSecret) {
            setProviderForm(data);
            setProviderSaved(true);
            setProviderEditMode(false); // ensure not in edit mode after fetch
          }
        }
      } catch {}
    };
    fetchProvider();

    // Fetch email for profile
    if (username) {
      fetch(`/users/${username}`)
        .then(res => res.json())
        .then(data => setUserEmail(data.email || ''));
    }
  }, [username]);

  function handleProviderChange(e) {
    setProviderForm({ ...providerForm, [e.target.name]: e.target.value });
  }
  async function handleProviderSave() {
    const formData = new FormData();
    formData.append('client_id', providerForm.clientId);
    formData.append('tenant_id', providerForm.tenantId);
    formData.append('client_secret', providerForm.clientSecret);
    try {
      const res = await fetch(`${API_BASE}/provider/azure`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (res.ok) {
        setProviderSaved(true);
        setProviderEditMode(false);
        message.success('Azure App Credentials saved securely!');
      } else {
        message.error('Failed to save credentials');
      }
    } catch {
      message.error('Failed to save credentials');
    }
  }
  function handleProviderEdit() {
    setProviderSaved(false);
    setProviderEditMode(true); // Enable editing when Edit is clicked
    setProviderForm({ ...providerForm }); // force re-render if needed
  }

  const handlePasswordUpdate = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      message.error('Please fill all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      message.error('New passwords do not match');
      return;
    }
    const res = await fetch(`/users/${username}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      credentials: 'include',
    });
    if (res.ok) {
      message.success('Password updated successfully');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } else {
      const data = await res.json();
      message.error(data.detail || 'Failed to update password');
    }
  };

  return (
    <div>
      <Navbar onLogout={handleLogout} username={username} darkMode={darkMode} setDarkMode={setDarkMode} />
      <Layout style={{ minHeight: '100vh', background: darkMode ? '#181818' : '#fff' }}>
        <Sider width={240} style={{ background: darkMode ? '#181818' : '#fff', borderRight: darkMode ? '1px solid #222' : '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: '100%', borderRight: 0, background: darkMode ? '#181818' : '#fff', color: darkMode ? '#fff' : undefined }}
            onClick={({ key }) => setSelectedKey(key)}
            items={[
              ...(userPermission === 'Admin' ? [
                { key: 'users', label: <span style={{ color: darkMode ? '#fff' : undefined }}>Users</span> },
                { key: 'permissions', label: <span style={{ color: darkMode ? '#fff' : undefined }}>Permissions</span> },
                { key: 'provider', label: <span style={{ color: darkMode ? '#fff' : undefined }}>Provider</span> },
              ] : []),
              { key: 'profile', label: <span style={{ color: darkMode ? '#fff' : undefined }}>Profile</span> },
              { key: 'about', label: <span style={{ color: darkMode ? '#fff' : undefined }}>About Us</span> },
            ]}
          />
        </Sider>
        <Layout style={{ background: darkMode ? '#181818' : '#fff' }}>
          <Content style={{ margin: 24, minHeight: 280, color: darkMode ? '#fff' : undefined }}>
            {selectedKey === 'users' && (
              userPermission === 'Admin' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ color: darkMode ? '#fff' : undefined }}>Users</h2>
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
                  <h2 style={{ margin: 0, marginBottom: 8, color: darkMode ? '#fff' : undefined }}>Permissions</h2>
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
                      <h3 style={{ color: darkMode ? '#fff' : undefined }}>Users with {selectedPermission} Permission</h3>
                      <input
                        type="text"
                        placeholder="Search users by name or email"
                        value={permissionSearch || ''}
                        onChange={e => {
                          setPermissionSearch(e.target.value);
                          setPermissionPage(1); // Reset to first page on search
                        }}
                        style={{ marginBottom: 16, width: 320, padding: 8, borderRadius: 4, border: '1px solid #d9d9d9', background: darkMode ? '#333' : '#fff', color: darkMode ? '#fff' : undefined }}
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
                              title={<span style={{ fontWeight: 500, color: darkMode ? '#fff' : undefined }}>{u.username}</span>}
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
            {selectedKey === 'provider' && userPermission === 'Admin' && (
              <div>
                <h2 style={{ color: darkMode ? '#fff' : undefined }}>Provider</h2>
                <div style={{ padding: 24, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', maxWidth: 480 }}>
                  <h3 style={{ color: darkMode ? '#fff' : undefined }}>Azure App Credentials</h3>
                  <div
                    autoComplete="off"
                  >
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ color: darkMode ? '#fff' : undefined }}><b>Application (client) ID</b></label>
                      <input
                        type="text"
                        name="clientId"
                        value={providerForm.clientId}
                        onChange={handleProviderChange}
                        disabled={!providerEditMode}
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #d9d9d9', marginTop: 4, background: darkMode ? '#333' : '#fff', color: darkMode ? '#fff' : undefined }}
                        required
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ color: darkMode ? '#fff' : undefined }}><b>Directory (tenant) ID</b></label>
                      <input
                        type="text"
                        name="tenantId"
                        value={providerForm.tenantId}
                        onChange={handleProviderChange}
                        disabled={!providerEditMode}
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #d9d9d9', marginTop: 4, background: darkMode ? '#333' : '#fff', color: darkMode ? '#fff' : undefined }}
                        required
                      />
                    </div>
                    <div style={{ marginBottom: 24 }}>
                      <label htmlFor="clientSecret" style={{ color: darkMode ? '#fff' : undefined }}><b>Client Secret</b></label>
                      <input
                        id="clientSecret"
                        type="password"
                        name="clientSecret"
                        value={providerForm.clientSecret}
                        onChange={handleProviderChange}
                        disabled={!providerEditMode}
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #d9d9d9', marginTop: 4, background: darkMode ? '#333' : '#fff', color: darkMode ? '#fff' : undefined }}
                        required
                      />
                      {/* UI hint for client secret status */}
                      <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                        {providerSaved && !providerEditMode
                          ? 'Client secret is set.'
                          : 'Enter to update client secret.'}
                      </div>
                    </div>
                    {!providerSaved ? (
                      <button type="button" onClick={handleProviderSave} style={{ width: '100%', padding: 10, background: '#1677ff', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>
                        Save
                      </button>
                    ) : (
                      <button type="button" onClick={handleProviderEdit} style={{ width: '100%', padding: 10, background: '#faad14', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {selectedKey === 'profile' && (
              <div style={{ maxWidth: 400, margin: '0 auto', background: darkMode ? '#222' : '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: 32 }}>
                <h2 style={{ color: darkMode ? '#fff' : undefined }}>Profile</h2>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ color: darkMode ? '#fff' : undefined }}><b>Username</b></label>
                  <input type="text" value={username || ''} disabled style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #d9d9d9', background: '#eee', color: '#888', marginTop: 4 }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ color: darkMode ? '#fff' : undefined }}><b>Email</b></label>
                  <input type="text" value={userEmail || ''} disabled style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #d9d9d9', background: '#eee', color: '#888', marginTop: 4 }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ color: darkMode ? '#fff' : undefined }}><b>Old Password</b></label>
                  <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #d9d9d9', background: darkMode ? '#333' : '#fff', color: darkMode ? '#fff' : undefined, marginTop: 4 }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ color: darkMode ? '#fff' : undefined }}><b>New Password</b></label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #d9d9d9', background: darkMode ? '#333' : '#fff', color: darkMode ? '#fff' : undefined, marginTop: 4 }} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ color: darkMode ? '#fff' : undefined }}><b>Confirm New Password</b></label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #d9d9d9', background: darkMode ? '#333' : '#fff', color: darkMode ? '#fff' : undefined, marginTop: 4 }} />
                </div>
                <Button type="primary" block onClick={handlePasswordUpdate}>Update Password</Button>
              </div>
            )}
            {selectedKey === 'about' && (
              <div>
                <h2 style={{ color: darkMode ? '#fff' : undefined }}>About Us</h2>
                <p style={{ color: darkMode ? '#fff' : undefined }}>
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
        destroyOnHidden
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
