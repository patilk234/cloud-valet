import React, { useState } from 'react';
import { Modal, Form, Input, message, Select } from 'antd';

const AddUserModal = ({ open, onClose, onUserAdded }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      // Always send permission, default to 'Read' if not set
      if (!values.permission) values.permission = 'Read';
      const response = await fetch('/users/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values).toString(),
        credentials: 'include',
      });
      if (response.ok) {
        message.success('User added successfully');
        form.resetFields();
        onUserAdded();
        onClose();
      } else {
        const data = await response.json();
        message.error(data.detail || 'Failed to add user');
      }
    } catch (err) {
      // Validation error or network error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Add User"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      okText="Add"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Please enter username' }]}> 
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}> 
          <Input />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please enter password' }]}> 
          <Input.Password />
        </Form.Item>
        <Form.Item name="permission" label="Permission" initialValue="Read">
          <Select>
            <Select.Option value="Read">Read</Select.Option>
            <Select.Option value="Write">Write</Select.Option>
            <Select.Option value="Admin">Admin</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddUserModal;
