'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { API } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';

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

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="text-white/40 text-sm">Validating token...</div>
      </div>
    );
  }

  if (!urlToken && !tokenSubmitted) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
          <div className="text-center">
            <Icon name="Key" size={32} className="text-orange-400 mx-auto mb-2" />
            <h1 className="text-white text-lg font-bold">Admin Setup</h1>
            <p className="text-white/40 text-xs mt-1">Enter the setup token from the server</p>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleTokenSubmit} className="space-y-3">
            <div>
              <label className="block text-white/60 text-3xs font-semibold mb-1">
                Setup Token
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 outline-none focus:border-orange-500/50 transition-colors"
                placeholder="paste token here"
                required
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              disabled={checking}
              className="w-full py-2.5 rounded-lg text-white text-sm font-semibold bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 transition-all cursor-pointer disabled:opacity-50 min-h-11"
            >
              Validate Token
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5 text-center">
          <Icon name="ShieldOff" size={32} className="text-red-400 mx-auto mb-2" />
          <h1 className="text-white text-lg font-bold">Invalid Token</h1>
          <p className="text-white/40 text-xs">
            The setup token is invalid or has expired. Generate a new one from the server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="text-center">
          <Icon name="UserPlus" size={32} className="text-orange-400 mx-auto mb-2" />
          <h1 className="text-white text-lg font-bold">Create Admin Account</h1>
          <p className="text-white/40 text-xs mt-1">Set your credentials</p>
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-white/60 text-3xs font-semibold mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 outline-none focus:border-orange-500/50 transition-colors"
              placeholder="admin"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-white/60 text-3xs font-semibold mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 outline-none focus:border-orange-500/50 transition-colors"
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-white/60 text-3xs font-semibold mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 outline-none focus:border-orange-500/50 transition-colors"
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-white text-sm font-semibold bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 transition-all cursor-pointer disabled:opacity-50 min-h-11"
          >
            {loading ? 'Creating account...' : 'Create Admin Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SetupClient() {
  return (
    <Suspense fallback={null}>
      <AdminSetupContent />
    </Suspense>
  );
}
