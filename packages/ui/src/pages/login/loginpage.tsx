import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Form, Input, Typography, Modal } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { UserHelpService } from '@nihal-ice-factory/shared-services';
import { CreateUserModel, UserLoginModel, UserRole, CommonResponse, ResetPassowordModel } from '@nihal-ice-factory/shared-models';
import './login.css';

const { Title, Text } = Typography;

interface Credentials {
  email: string;
  password: string;
  username?: string;
}

interface ForgotPasswordData {
  email: string;
  otp: string;
  newPassword: string;
}

const LoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotPasswordModal, setIsForgotPasswordModal] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [form] = Form.useForm<Credentials>();
  const [forgotPasswordForm] = Form.useForm<ForgotPasswordData>();
  const userService = new UserHelpService();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = Cookies.get('accessToken');
    const role = Cookies.get('userRole')?.toUpperCase();
    if (accessToken) {
      if (role === UserRole.ADMIN) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [navigate]);

  const handleSubmit = async (values: Credentials) => {
    setIsLoading(true);
    try {
      if (isRegisterMode) {
        const requestModel: CreateUserModel = {
          email: values.email,
          password: values.password,
          username: values.username!,
          role: UserRole.USER,
        };
        const response: CommonResponse = await userService.createUser(requestModel);

        if (response.status && response.errorCode === 201) {
          Modal.success({
            title: 'Registration Successful',
            content: 'Your account has been created successfully! Please login.',
            onOk: () => {
              form.resetFields();
              setIsRegisterMode(false);
            },
          });
        } else {
          throw new Error(response.internalMessage || 'Registration failed');
        }
      } else {
        const requestModel: UserLoginModel = {
          email: values.email,
          password: values.password,
        };
        const response: CommonResponse = await userService.loginUser(requestModel);

        if (response.status && response.errorCode === 200 && response.data?.accessToken) {
          Cookies.set('accessToken', response.data.accessToken, { expires: 7, secure: true, sameSite: 'Strict' });
          Cookies.set('userRole', response.data.user.role, { expires: 7, secure: true, sameSite: 'Strict' });

          Modal.success({
            title: 'Login Successful',
            content: 'You have been logged in successfully!',
            onOk: () => {
              form.resetFields();
              const role = response.data.user.role.toUpperCase();
              if (role === UserRole.ADMIN) {
                navigate('/dashboard', { replace: true });
              } else {
                navigate('/', { replace: true });
              }
            },
          });
        } else {
          throw new Error(response.internalMessage || 'Invalid credentials');
        }
      }
    } catch (error: any) {
      Modal.error({
        title: isRegisterMode ? 'Registration Error' : 'Login Error',
        content: error.message || `An error occurred during ${isRegisterMode ? 'registration' : 'login'}.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (values: ForgotPasswordData) => {
    setIsLoading(true);
    try {
      if (forgotPasswordStep === 'email') {
        // Mock OTP sending (replace with actual API if available)
        Modal.success({
          title: 'OTP Sent',
          content: 'An OTP has been sent to your email.',
          onOk: () => {
            forgotPasswordForm.setFieldsValue({ otp: '', newPassword: '' });
            setForgotPasswordStep('otp');
          },
        });
      } else if (forgotPasswordStep === 'otp') {
        // Mock OTP verification (proceed to reset)
        setForgotPasswordStep('reset');
      } else {
        const requestModel: ResetPassowordModel = {
          email: values.email,
          otp: values.otp,
          newPassword: values.newPassword,
        };
        const response: CommonResponse = await userService.resetPassword(requestModel);

        if (response.status && response.errorCode === 200) {
          Modal.success({
            title: 'Password Reset Successful',
            content: 'Your password has been reset successfully! Please login.',
            onOk: () => {
              forgotPasswordForm.resetFields();
              setIsForgotPasswordModal(false);
              setForgotPasswordStep('email');
            },
          });
        } else if (response.errorCode === 404) {
          throw new Error('Email not found. Please check your email address.');
        } else if (response.errorCode === 401) {
          throw new Error('Invalid or expired OTP.');
        } else {
          throw new Error(response.internalMessage || 'Password reset failed.');
        }
      }
    } catch (error: any) {
      Modal.error({
        title: 'Password Reset Error',
        content: error.message || 'An error occurred while resetting your password.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsRegisterMode(!isRegisterMode);
    form.resetFields();
  };

  const openForgotPasswordModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsForgotPasswordModal(true);
    forgotPasswordForm.resetFields();
    setForgotPasswordStep('email');
  };

  return (
    <motion.div
      className="login-container"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="form-container">
        <motion.div variants={childVariants} style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={3} className="title">
            {isRegisterMode ? 'Create Account' : 'Welcome Back'}
          </Title>
          <Text className="subtitle">
            {isRegisterMode ? 'Sign up to get started' : 'Sign in to continue'}
          </Text>
        </motion.div>

        <Form form={form} onFinish={handleSubmit} layout="vertical" className="form">
          <motion.div variants={childVariants}>
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
            >
              <motion.div variants={inputVariants} whileFocus="focus" className="input-container">
                <Input prefix={<UserOutlined />} placeholder="Email address" size="large" />
              </motion.div>
            </Form.Item>
          </motion.div>

          {isRegisterMode && (
            <motion.div variants={childVariants}>
              <Form.Item
                name="username"
                rules={[{ required: true, message: 'Please input your username!' }]}
              >
              <motion.div variants={inputVariants} whileFocus="focus" className="input-container">
                <Input prefix={<UserOutlined />} placeholder="Username" size="large" />
              </motion.div>
            </Form.Item>
          </motion.div>
        )}

        <motion.div variants={childVariants}>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Please input your password!' },
              ...(isRegisterMode
                ? [
                    {
                      pattern: /^(?=(.*[a-z]){2,})(?=(.*[A-Z]){1,})(?=(.*\d){1,})(?=(.*[@$!%*?&#_+\-/]){2,})[A-Za-z\d@$!%*?&#_+\-/]{8,}$/,
                      message: 'Password must meet complexity requirements!',
                    },
                  ]
                : []),
            ]}
          >
            <motion.div variants={inputVariants} whileFocus="focus" className="input-container">
              <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </motion.div>
          </Form.Item>
        </motion.div>

        {!isRegisterMode && (
          <motion.div
            variants={childVariants}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <a href="#" className="forgot-password" onClick={openForgotPasswordModal}>
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
          <Button type="link" onClick={toggleMode} style={{ padding: 0 }}>
            {isRegisterMode ? 'Sign In' : 'Sign Up'}
          </Button>
        </Text>
      </motion.div>
    </motion.div>

    {/* Forgot Password Modal */}
    <Modal
      title={forgotPasswordStep === 'email' ? 'Forgot Password' : forgotPasswordStep === 'otp' ? 'Enter OTP' : 'Reset Password'}
      open={isForgotPasswordModal}
      onCancel={() => {
        setIsForgotPasswordModal(false);
        setForgotPasswordStep('email');
        forgotPasswordForm.resetFields();
      }}
      footer={null}
    >
      <Form form={forgotPasswordForm} onFinish={handleForgotPassword} layout="vertical">
        {forgotPasswordStep === 'email' && (
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Email address" size="large" />
          </Form.Item>
        )}

        {forgotPasswordStep === 'otp' && (
          <Form.Item
            name="otp"
            rules={[{ required: true, message: 'Please input the OTP!' }]}
          >
            <Input prefix={<LockOutlined />} placeholder="OTP" size="large" />
          </Form.Item>
        )}

        {forgotPasswordStep === 'reset' && (
          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: 'Please input your new password!' },
              {
                pattern: /^(?=(.*[a-z]){2,})(?=(.*[A-Z]){1,})(?=(.*\d){1,})(?=(.*[@$!%*?&#_+\-/]){2,})[A-Za-z\d@$!%*?&#_+\-/]{8,}$/,
                message: 'Password must meet complexity requirements!',
              },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="New Password" size="large" />
          </Form.Item>
        )}

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={isLoading}
            disabled={isLoading}
            block
          >
            {forgotPasswordStep === 'email' ? 'Send OTP' : forgotPasswordStep === 'otp' ? 'Verify OTP' : 'Reset Password'}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  </motion.div>
);
};

// Variants (unchanged)
const containerVariants = {
hidden: { opacity: 0, y: 50 },
visible: {
  opacity: 1,
  y: 0,
  transition: { duration: 0.8, ease: 'easeOut', when: 'beforeChildren', staggerChildren: 0.2 },
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

export default LoginPage;