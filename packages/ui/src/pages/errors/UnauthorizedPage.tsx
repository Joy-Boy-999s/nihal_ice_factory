import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components';
import { useAuth } from '../../lib/auth';
import './errors.css';

const LockShieldIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 2 3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2Z" />
    <rect x="9" y="11" width="6" height="5" rx="1" />
    <path d="M12 11V8.5a1.5 1.5 0 0 0-3 0" />
  </svg>
);

const HomeIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
    <path d="M9 21V12h6v9" />
  </svg>
);

const ArrowLeftIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M19 12H5" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuth();

  const displayRole = role === 'ADMIN' ? 'Administrator' : 'Operator';

  return (
    <div className="error-page">
      <div className="error-page__dots" aria-hidden />
      <div className="error-page__inner">
        {/* Animated orb with shield icon */}
        <div className="error-page__orb" aria-hidden>
          <span className="error-page__orb-ring error-page__orb-ring--outer" />
          <span className="error-page__orb-ring error-page__orb-ring--inner" />
          <span className="error-page__orb-icon">
            <LockShieldIcon />
          </span>
        </div>

        {/* Error code */}
        <p className="error-page__code" aria-label="Error 403">403</p>

        {/* Heading */}
        <h1 className="error-page__title">Access denied</h1>

        {/* Role badge */}
        <div className="error-page__role-badge" aria-live="polite">
          Signed in as <strong style={{ marginLeft: 4 }}>{displayRole}</strong>
        </div>

        {/* Description */}
        <p className="error-page__description">
          You don&apos;t have permission to view this page. This section is
          restricted to users with a higher access level. If you believe this is
          a mistake, please contact your administrator.
        </p>

        {/* Actions */}
        <div className="error-page__actions">
          <Button
            variant="ghost"
            size="md"
            onClick={() => navigate(-1)}
            leftIcon={<ArrowLeftIcon />}
          >
            Go back
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/', { replace: true })}
            leftIcon={<HomeIcon />}
          >
            Back to home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
