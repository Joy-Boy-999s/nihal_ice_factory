import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Form, Input, Typography, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';
import './login.css';

const { Title, Text } = Typography;

interface Credentials {
  email: string;
  password: string;
}

interface LoginPageProps {
  onSubmit?: (credentials: Credentials, isRegister: boolean) => void;
}

interface ApiResponse {
  token?: string;
  message?: string;
}

const containerVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: 'easeOut',
      when: 'beforeChildren',
      staggerChildren: 0.2,
    },
  },
};

const childVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const buttonVariants = {
  hover: { scale: 1.05, transition: { duration: 0.3 } },
  tap: { scale: 0.95 },
};

const inputVariants = {
  focus: { scale: 1.02, transition: { duration: 0.2 } },
};

const API_BASE_URL = 'http://localhost:3000/auth';

const LoginPage: React.FC<LoginPageProps> = ({
  onSubmit = (credentials: Credentials, isRegister: boolean) =>
    console.log(`${isRegister ? 'Register' : 'Login'} attempted with:`, credentials),
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [form] = Form.useForm<Credentials>();

  const handleSubmit = async (values: Credentials) => {
    setIsLoading(true);
    try {
      const endpoint = isRegisterMode ? '/register' : '/login';
      const response = await axios.post<ApiResponse>(`${API_BASE_URL}${endpoint}`, values);
      
      if (response.data.token) {
        // Store token in localStorage or context as needed
        localStorage.setItem('token', response.data.token);
        message.success(isRegisterMode ? 'Registration successful!' : 'Login successful!');
        onSubmit(values, isRegisterMode);
        form.resetFields();
      } else {
        message.error(response.data.message || 'Operation failed');
      }
    } catch (error: any) {
      console.error(`${isRegisterMode ? 'Registration' : 'Login'} failed:`, error);
      message.error(
        error.response?.data?.message || `Failed to ${isRegisterMode ? 'register' : 'login'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    form.resetFields();
  };

  return (
    <motion.div
      className="login-container"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="form-container"
      >
        <motion.div variants={childVariants} style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={3} className="title">
            {isRegisterMode ? 'Create Account' : 'Welcome Back'}
          </Title>
          <Text className="subtitle">
            {isRegisterMode ? 'Sign up to get started' : 'Sign in to continue'}
          </Text>
        </motion.div>

        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          className="form"
        >
          <motion.div variants={childVariants}>
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
            >
              <motion.div
                variants={inputVariants}
                whileFocus="focus"
                className="input-container"
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Email address"
                  size="large"
                />
              </motion.div>
            </Form.Item>
          </motion.div>

          <motion.div variants={childVariants}>
            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <motion.div
                variants={inputVariants}
                whileFocus="focus"
                className="input-container"
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Password"
                  size="large"
                />
              </motion.div>
            </Form.Item>
          </motion.div>

          {!isRegisterMode && (
            <motion.div
              variants={childVariants}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <a href="#" className="forgot-password">
                Forgot password?
              </a>
            </motion.div>
          )}

          <motion.div variants={childVariants}>
            <Form.Item>
              <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={isLoading}
                  disabled={isLoading}
                  block
                  className="submit-button"
                >
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={isLoading ? 'loading' : isRegisterMode ? 'register' : 'sign-in'}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {isLoading
                        ? isRegisterMode
                          ? 'Registering...'
                          : 'Signing in...'
                        : isRegisterMode
                        ? 'Register'
                        : 'Sign In'}
                    </motion.span>
                  </AnimatePresence>
                </Button>
              </motion.div>
            </Form.Item>
          </motion.div>
        </Form>

        <motion.div variants={childVariants} style={{ textAlign: 'center', marginTop: '16px' }}>
          <Text>
            {isRegisterMode ? 'Already have an account?' : "Don't have an account?"}{' '}
            <a href="#" onClick={toggleMode}>
              {isRegisterMode ? 'Sign In' : 'Sign Up'}
            </a>
          </Text>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default LoginPage;