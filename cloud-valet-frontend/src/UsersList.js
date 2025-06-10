import React, { useEffect, useState } from 'react';
import { Table, Spin, Alert, Button, Popconfirm, message, Modal, Form, Input } from 'antd';
import { EditOutlined, SettingOutlined } from '@ant-design/icons';
import { Dropdown, Menu } from 'antd';

const UsersList = ({ refreshKey }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    fetch('/users/', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      })
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [refreshKey]);

  const handleDelete = async (username) => {
    try {
      const response = await fetch(`/users/${username}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        setUsers(users.filter(u => u.username !== username));
        message.success('User deleted successfully');
      } else {
        message.error('Failed to delete user');
      }
    } catch {
      message.error('Failed to delete user');
    }
  };

  const handleEdit = async (user) => {
    setEditModalOpen(true);
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/users/${user.username}`, { credentials: 'include' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch user details: ${res.status} ${text}`);
      }
      const data = await res.json();
      setEditUser(data);
      editForm.setFieldsValue({ username: data.username, email: data.email });
    } catch (err) {
      setEditError(err.message);
      // Don't close the modal, show error inside modal
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditOk = async () => {
    try {
      const values = await editForm.validateFields();
      // Map username to new_username for backend compatibility
      const payload = { new_username: values.username, email: values.email };
      const response = await fetch(`/users/${editUser.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(payload).toString(),
        credentials: 'include',
      });
      if (response.ok) {
        setUsers(users.map(u => u.username === editUser.username ? { ...u, ...values } : u));
        message.success('User updated successfully');
        setEditModalOpen(false);
      } else {
        const data = await response.json();
        let errorMsg = 'Failed to update user';
        if (data.detail) {
          if (typeof data.detail === 'string') {
            errorMsg = data.detail;
          } else if (Array.isArray(data.detail)) {
            errorMsg = data.detail.map(e => e.msg).join('; ');
          }
        }
        message.error(errorMsg);
      }
    } catch {
      // validation error
    }
  };

  // Permissions dropdown menu
  const handlePermissionChange = async (permission, user) => {
    try {
      const payload = { new_username: user.username, email: user.email, permission };
      const response = await fetch(`/users/${user.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(payload).toString(),
        credentials: 'include',
      });
      if (response.ok) {
        setUsers(users.map(u => u.username === user.username ? { ...u, permission } : u));
        message.success('Permission updated successfully');
      } else {
        const data = await response.json();
        let errorMsg = 'Failed to update permission';
        if (data.detail) {
          if (typeof data.detail === 'string') {
            errorMsg = data.detail;
          } else if (Array.isArray(data.detail)) {
            errorMsg = data.detail.map(e => e.msg).join('; ');
          }
        }
        message.error(errorMsg);
      }
    } catch {
      message.error('Failed to update permission');
    }
  };

  const permissionsMenu = (user) => (
    <Menu onClick={({ key }) => handlePermissionChange(key, user)}>
      <Menu.Item key="Read">Read</Menu.Item>
      <Menu.Item key="Write">Write</Menu.Item>
      <Menu.Item key="Admin">Admin</Menu.Item>
    </Menu>
  );

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchText.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchText.toLowerCase()))
  );

  if (loading) return <Spin />;
  if (error) return <Alert type="error" message={error} />;

  return (
    <>
      <Input.Search
        placeholder="Search users by username or email"
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 300 }}
        allowClear
      />
      <Table
        dataSource={filteredUsers}
        columns={[
          { 
            title: 'Username', 
            dataIndex: 'username', 
            key: 'username',
            sorter: (a, b) => a.username.localeCompare(b.username),
            sortDirections: ['ascend', 'descend'],
          },
          { 
            title: 'Email', 
            dataIndex: 'email', 
            key: 'email',
            sorter: (a, b) => a.email.localeCompare(b.email),
            sortDirections: ['ascend', 'descend'],
          },
          { 
            title: 'Permission', 
            dataIndex: 'permission', 
            key: 'permission',
            sorter: (a, b) => a.permission.localeCompare(b.permission),
            sortDirections: ['ascend', 'descend'],
          },
          {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
              <>
                <Button size="small" onClick={() => handleEdit(record)} style={{ marginRight: 8 }} icon={<EditOutlined />} title="Edit Profile" />
                <Dropdown overlay={permissionsMenu(record)} trigger={["click"]}>
                  <Button size="small" icon={<SettingOutlined />} title="Permissions" style={{ marginRight: 8 }} />
                </Dropdown>
                <Popconfirm
                  title={`Delete user '${record.username}'?`}
                  onConfirm={() => handleDelete(record.username)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button danger size="small">Delete</Button>
                </Popconfirm>
              </>
            ),
          },
        ]}
        rowKey="username"
        pagination={{
          defaultPageSize: 10,
          pageSizeOptions: ['10', '25', '50', '75', '100'],
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
        }}
      />
      <Modal
        title="Edit User Profile"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditError(null); }}
        onOk={handleEditOk}
        okText="Update"
        destroyOnHidden
        confirmLoading={editLoading}
      >
        {editError && <Alert type="error" message={editError} showIcon style={{ marginBottom: 16 }} />}
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Please enter username' }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}> 
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default UsersList;
