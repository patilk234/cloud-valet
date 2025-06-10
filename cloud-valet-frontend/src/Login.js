import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values).toString(),
        credentials: 'include',
      });
      if (response.redirected && response.url.endsWith('/dashboard')) {
        navigate('/dashboard');
      } else {
        const html = await response.text();
        if (html.includes('Invalid credentials')) {
          message.error('Invalid username or password');
        } else {
          message.error('Login failed');
        }
      }
    } catch (err) {
      message.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Card title="Cloud Valet Login" style={{ width: 350 }}>
        <Form name="login" onFinish={onFinish} layout="vertical">
          <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Please input your username!' }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please input your password!' }]}> 
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Log in
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
