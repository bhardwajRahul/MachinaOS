/**
 * Login/Register Page with Dracula theme.
 * Shows login form, or register form if registration is available.
 */

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { dracula } from '../../styles/theme';

const LoginPage: React.FC = () => {
  const { login, register, canRegister, error, isLoading } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError('Email and password are required');
      return;
    }

    if (isRegistering) {
      if (!displayName) {
        setLocalError('Display name is required');
        return;
      }
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters');
        return;
      }
      await register(email, password, displayName);
    } else {
      await login(email, password);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setLocalError(null);
  };

  const displayError = localError || error;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo/Title */}
        <div style={styles.header}>
          <h1 style={styles.title}>MachinaOs</h1>
          <p style={styles.subtitle}>
            {isRegistering ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        {/* Error Message */}
        {displayError && (
          <div style={styles.errorBox}>
            {displayError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {isRegistering && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={styles.input}
                placeholder="Your name"
                disabled={isLoading}
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@example.com"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder={isRegistering ? 'At least 8 characters' : 'Your password'}
              disabled={isLoading}
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.submitButton,
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
            disabled={isLoading}
          >
            {isLoading
              ? 'Please wait...'
              : isRegistering
                ? 'Create Account'
                : 'Sign In'}
          </button>
        </form>

        {/* Toggle Login/Register */}
        {canRegister && (
          <div style={styles.toggleSection}>
            <span style={styles.toggleText}>
              {isRegistering ? 'Already have an account?' : "Don't have an account?"}
            </span>
            <button
              onClick={toggleMode}
              style={styles.toggleButton}
              disabled={isLoading}
            >
              {isRegistering ? 'Sign In' : 'Register'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: dracula.background,
    padding: 20,
  },
  card: {
    backgroundColor: dracula.currentLine,
    borderRadius: 12,
    padding: 40,
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  header: {
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    color: dracula.purple,
    fontSize: 32,
    fontWeight: 700,
    margin: 0,
    marginBottom: 8,
  },
  subtitle: {
    color: dracula.comment,
    fontSize: 14,
    margin: 0,
  },
  errorBox: {
    backgroundColor: `${dracula.red}20`,
    border: `1px solid ${dracula.red}`,
    borderRadius: 6,
    padding: '12px 16px',
    marginBottom: 20,
    color: dracula.red,
    fontSize: 13,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    color: dracula.foreground,
    fontSize: 13,
    fontWeight: 500,
  },
  input: {
    backgroundColor: dracula.background,
    border: `1px solid ${dracula.comment}50`,
    borderRadius: 6,
    padding: '12px 14px',
    fontSize: 14,
    color: dracula.foreground,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  submitButton: {
    backgroundColor: dracula.purple,
    color: dracula.background,
    border: 'none',
    borderRadius: 6,
    padding: '14px 20px',
    fontSize: 15,
    fontWeight: 600,
    marginTop: 8,
    transition: 'opacity 0.2s, transform 0.1s',
  },
  toggleSection: {
    textAlign: 'center',
    marginTop: 24,
    paddingTop: 20,
    borderTop: `1px solid ${dracula.comment}30`,
  },
  toggleText: {
    color: dracula.comment,
    fontSize: 13,
    marginRight: 8,
  },
  toggleButton: {
    background: 'none',
    border: 'none',
    color: dracula.cyan,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
  },
};

export default LoginPage;
