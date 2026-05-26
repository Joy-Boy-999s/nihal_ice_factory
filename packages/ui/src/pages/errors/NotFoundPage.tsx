import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components';
import './errors.css';

const SearchOffIcon: React.FC = () => (
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
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="9" y1="9" x2="13" y2="13" />
    <line x1="13" y1="9" x2="9" y2="13" />
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

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="error-page">
      <div className="error-page__dots" aria-hidden />
      <div className="error-page__inner">
        {/* Animated orb with icon */}
        <div className="error-page__orb" aria-hidden>
          <span className="error-page__orb-ring error-page__orb-ring--outer" />
          <span className="error-page__orb-ring error-page__orb-ring--inner" />
          <span className="error-page__orb-icon">
            <SearchOffIcon />
          </span>
        </div>

        {/* Error code */}
        <p className="error-page__code" aria-label="Error 404">404</p>

        {/* Heading */}
        <h1 className="error-page__title">Page not found</h1>

        {/* Description */}
        <p className="error-page__description">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved. Double-check the URL or navigate back to a known page.
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

export default NotFoundPage;
