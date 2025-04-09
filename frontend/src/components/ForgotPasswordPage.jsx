import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import './Auth.css';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { isLoading, forgotPassword } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('Email field cannot be empty.');
      setMessage('');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      setMessage('');
      return;
    }

    try {
      await forgotPassword(email);
      setIsSubmitted(true);
      setMessage('Password reset link has been sent to your email.');
      setError('');
    } catch (err) {
      setError('Failed to send reset link. Please try again later.');
      setMessage('');
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="forgot-password-form">
            <h2>Forgot Password</h2>
            <p>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}

            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <Link to="/login" className="back-link">
              Back to Login
            </Link>
          </form>
        ) : (
          <div className="submitted-message">
            <h2>Check Your Email</h2>
            <p>
              A password reset link has been sent to <strong>{email}</strong>.
              Please check your inbox and follow the instructions.
            </p>
            <Link to="/login" className="back-link">
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
