import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserHelpService } from '@nihal-ice-factory/shared-services';
import {
  CreateUserModel,
  UserLoginModel,
  UserRole,
  CommonResponse,
  ResetPassowordModel,
} from '@nihal-ice-factory/shared-models';
import { Button, Field, Input, Modal, useToast } from '../../components';
import { login, isAuthenticated, isAdmin, isCustomer } from '../../lib/auth';
import { SnowflakeIcon, MailIcon, LockIcon, UserIcon } from '../../layout/nav-icons';
import './login.css';

// ── Typed shape of what the login endpoint returns inside `data` ──────────
interface LoginPayload {
  accessToken: string;
  user: { role: string };
}

/** Minimal typed shape for network / API errors in catch blocks. */
interface CatchError {
  message?: string;
}

type Mode = 'login' | 'register';
type ForgotStep = 'email' | 'otp' | 'reset';

const PASSWORD_RE =
  /^(?=(.*[a-z]){2,})(?=(.*[A-Z]){1,})(?=(.*\d){1,})(?=(.*[@$!%*?&#_+\-/]){2,})[A-Za-z\d@$!%*?&#_+\-/]{8,}$/;

interface FormState {
  email: string;
  username: string;
  password: string;
}

interface FormErrors {
  email?: string;
  username?: string;
  password?: string;
}

const initialForm: FormState = { email: '', username: '', password: '' };

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email');
  const [forgotForm, setForgotForm] = useState({ email: '', otp: '', newPassword: '' });
  const [forgotError, setForgotError] = useState<string | null>(null);

  const [userService] = useState(() => new UserHelpService());

  useEffect(() => {
    if (isAuthenticated()) {
      if (isAdmin()) navigate('/dashboard', { replace: true });
      else if (isCustomer()) navigate('/shop', { replace: true });
      else navigate('/', { replace: true });
    }
  }, [navigate]);

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((err) => ({ ...err, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.email) next.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email';
    if (!form.password) next.password = 'Password is required';
    else if (mode === 'register' && !PASSWORD_RE.test(form.password)) {
      next.password =
        'Must be at least 8 characters with uppercase, lowercase, a digit, and a symbol';
    }
    if (mode === 'register' && !form.username) next.username = 'Username is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'register') {
        const req: CreateUserModel = {
          email: form.email,
          password: form.password,
          username: form.username,
          role: UserRole.CUSTOMER,
        };
        const res: CommonResponse = await userService.registerCustomer(req);
        if (res.status && res.errorCode === 201) {
          toast.success('Account created. Please sign in.');
          setMode('login');
          setForm(initialForm);
        } else {
          throw new Error(res.internalMessage || 'Registration failed');
        }
      } else {
        const req: UserLoginModel = { email: form.email, password: form.password };
        const res: CommonResponse = await userService.loginUser(req);
        if (res.status && res.errorCode === 200) {
          const payload = res.data as unknown as LoginPayload;
          login(payload.accessToken, payload.user.role);
          toast.success('Signed in successfully');
          const role = String(payload.user.role).toUpperCase();
          const dest = role === 'ADMIN' ? '/dashboard' : role === 'CUSTOMER' ? '/shop' : '/';
          navigate(dest, { replace: true });
        } else {
          throw new Error(res.internalMessage || 'Invalid credentials');
        }
      }
    } catch (err) {
      toast.error((err as CatchError).message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setLoading(true);
    try {
      if (forgotStep === 'email') {
        if (!forgotForm.email) throw new Error('Email is required');
        toast.success('OTP sent to your email');
        setForgotStep('otp');
      } else if (forgotStep === 'otp') {
        if (!forgotForm.otp) throw new Error('OTP is required');
        setForgotStep('reset');
      } else {
        if (!PASSWORD_RE.test(forgotForm.newPassword))
          throw new Error('Password must be at least 8 characters with uppercase, lowercase, a digit, and a symbol');
        const req: ResetPassowordModel = {
          email: forgotForm.email,
          otp: forgotForm.otp,
          newPassword: forgotForm.newPassword,
        };
        const res: CommonResponse = await userService.resetPassword(req);
        if (res.status && res.errorCode === 200) {
          toast.success('Password reset successfully');
          setShowForgot(false);
          setForgotStep('email');
          setForgotForm({ email: '', otp: '', newPassword: '' });
        } else {
          throw new Error(res.internalMessage || 'Reset failed');
        }
      }
    } catch (err) {
      setForgotError((err as CatchError).message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">
          <div className="login-page__brand-logo">
            <SnowflakeIcon width={26} height={26} />
          </div>
          <div>
            <h1 className="login-page__brand-title">Nihal Ice Factory</h1>
            <p className="login-page__brand-subtitle">ERP Operations Suite</p>
          </div>
        </div>

        <h2 className="login-page__title">
          {mode === 'register' ? 'Create customer account' : 'Welcome back'}
        </h2>
        <p className="login-page__subtitle">
          {mode === 'register'
            ? 'Sign up to order ice online and pay instantly.'
            : 'Sign in to continue.'}
        </p>

        <form className="login-page__form" onSubmit={handleSubmit} noValidate>
          <Field label="Email" error={errors.email} required>
            <Input
              type="email"
              value={form.email}
              onChange={setField('email')}
              placeholder="you@example.com"
              invalid={!!errors.email}
              autoComplete="email"
              leftIcon={<MailIcon width={16} height={16} />}
            />
          </Field>

          {mode === 'register' && (
            <Field label="Username" error={errors.username} required>
              <Input
                value={form.username}
                onChange={setField('username')}
                placeholder="yourname"
                invalid={!!errors.username}
                autoComplete="username"
                leftIcon={<UserIcon width={16} height={16} />}
              />
            </Field>
          )}

          <Field label="Password" error={errors.password} required>
            <Input
              type="password"
              value={form.password}
              onChange={setField('password')}
              placeholder="••••••••"
              invalid={!!errors.password}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              leftIcon={<LockIcon width={16} height={16} />}
            />
          </Field>

          {mode === 'login' && (
            <div className="login-page__forgot">
              <button
                type="button"
                className="login-page__link"
                onClick={() => {
                  setShowForgot(true);
                  setForgotStep('email');
                  setForgotForm({ email: '', otp: '', newPassword: '' });
                  setForgotError(null);
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          <Button type="submit" size="lg" block loading={loading}>
            {mode === 'register' ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="login-page__switch">
          {mode === 'register' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            className="login-page__link"
            onClick={() => {
              setMode(mode === 'register' ? 'login' : 'register');
              setErrors({});
              setForm(initialForm);
            }}
          >
            {mode === 'register' ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>

      <Modal
        open={showForgot}
        onClose={() => setShowForgot(false)}
        title={
          forgotStep === 'email'
            ? 'Forgot password'
            : forgotStep === 'otp'
            ? 'Enter OTP'
            : 'Reset password'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForgot(false)}>
              Cancel
            </Button>
            <Button onClick={handleForgot} loading={loading}>
              {forgotStep === 'email'
                ? 'Send OTP'
                : forgotStep === 'otp'
                ? 'Verify OTP'
                : 'Reset password'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleForgot} className="login-page__forgot-form">
          {forgotStep === 'email' && (
            <Field label="Email" required>
              <Input
                type="email"
                value={forgotForm.email}
                onChange={(e) =>
                  setForgotForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="you@example.com"
              />
            </Field>
          )}
          {forgotStep === 'otp' && (
            <Field label="OTP" required>
              <Input
                value={forgotForm.otp}
                onChange={(e) => setForgotForm((f) => ({ ...f, otp: e.target.value }))}
                placeholder="6-digit code"
              />
            </Field>
          )}
          {forgotStep === 'reset' && (
            <Field label="New password" required>
              <Input
                type="password"
                value={forgotForm.newPassword}
                onChange={(e) =>
                  setForgotForm((f) => ({ ...f, newPassword: e.target.value }))
                }
                placeholder="••••••••"
              />
            </Field>
          )}
          {forgotError && <div className="login-page__form-error">{forgotError}</div>}
        </form>
      </Modal>
    </div>
  );
};

export default LoginPage;
