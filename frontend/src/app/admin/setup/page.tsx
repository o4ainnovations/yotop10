'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { API } from '@/lib/api';
import { toast } from '@/lib/toast';

function AdminSetupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlToken = searchParams?.get('token') || '';

  const [token, setToken] = useState(urlToken);
  const [tokenSubmitted, setTokenSubmitted] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setChecking(false);
        return;
      }

      try {
        const result = await API.adminValidateSetupToken(token) as { valid: boolean };
        setValidToken(result.valid);
        if (result.valid) {
          setTokenSubmitted(true);
          router.replace('/admin/setup');
        } else {
          setError('This setup token is invalid or has already been used.');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Validation failed';
        setError(msg.includes('UNAUTHORIZED') ? 'Authentication required. The server may be misconfigured.' :
              msg.includes('INVALID') ? 'This setup token is invalid or has already been used.' :
              msg.includes('EXPIRED') ? 'This setup token has expired.' :
              'Validation failed. Please check the server configuration.');
        setValidToken(false);
      } finally {
        setChecking(false);
      }
    };

    if (urlToken) {
      validateToken();
    } else {
      setChecking(false);
    }
  }, [urlToken, token, router]);

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setChecking(true);

    try {
      const result = await API.adminValidateSetupToken(token) as { valid: boolean };
      setValidToken(result.valid);
      setTokenSubmitted(true);
      if (result.valid) router.replace('/admin/setup');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Validation failed';
      setError(msg.includes('UNAUTHORIZED') ? 'Authentication required. Server may be misconfigured.' :
            msg.includes('INVALID') ? 'This setup token is invalid or has already been used.' :
            msg.includes('EXPIRED') ? 'This setup token has expired.' :
            'Invalid or expired token');
      setValidToken(false);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await API.adminSetup(token, username, password);
      toast.success('Admin account created. You are now logged in.');
      router.push('/admin');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Setup failed';
      setError(msg.includes('TOKEN_INVALID') ? 'Setup token is invalid or already used.' :
            msg.includes('VALIDATION') ? 'Username or password does not meet requirements.' :
            'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <div>Loading...</div>;

  if (!urlToken && !tokenSubmitted) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
        <h1>Admin Setup</h1>
        <p>Enter the setup token generated from the server command line.</p>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <form onSubmit={handleTokenSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label>Setup Token:</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              required
              autoComplete="off"
            />
          </div>
          <button type="submit" disabled={checking} style={{ padding: '10px 20px', width: '100%' }}>
            Validate Token
          </button>
        </form>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
        <h1>Invalid Setup Token</h1>
        <p>The setup token is invalid or has expired.</p>
        <p>Generate a new token from the server command line.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
      <h1>Setup Admin Account</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Username:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
            autoComplete="username"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
            autoComplete="new-password"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Confirm Password:</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: '10px 20px', width: '100%' }}
        >
          {loading ? 'Setting up...' : 'Create Admin Account'}
        </button>
      </form>
    </div>
  );
}

export default function AdminSetupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminSetupContent />
    </Suspense>
  );
}
