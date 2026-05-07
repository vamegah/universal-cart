import { clearAuthToken, getStoredAuthToken, login, logout, refreshSession, signup } from '@/services/api';
import { useRouter } from 'next/router';
import React from 'react';
import { useEffect, useState } from 'react';

export default function AccountPage() {
  const router = useRouter();
  const emailInputId = 'account-email';
  const passwordInputId = 'account-password';
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!getStoredAuthToken()) return;
    refreshSession()
      .then((response) => setCurrentUser(response.user))
      .catch(() => clearAuthToken());
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = mode === 'login' ? await login(email, password) : await signup(email, password);
      setCurrentUser(response.user);
      await router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
  };

  if (currentUser) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-2">Account</h1>
        <p className="text-sm text-gray-600 mb-6">{currentUser.email}</p>
        <button onClick={handleLogout} className="w-full border border-red-200 text-red-600 rounded-lg py-2 hover:bg-red-50">
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
      <h1 className="text-2xl font-bold mb-6">{mode === 'login' ? 'Log in' : 'Create account'}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={emailInputId} className="block text-sm font-medium mb-1">Email</label>
          <input
            id={emailInputId}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full border rounded-lg px-4 py-2"
            autoComplete="email"
            aria-describedby={error ? 'account-error' : undefined}
            required
          />
        </div>
        <div>
          <label htmlFor={passwordInputId} className="block text-sm font-medium mb-1">Password</label>
          <input
            id={passwordInputId}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full border rounded-lg px-4 py-2"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            aria-describedby={error ? 'account-error' : undefined}
            minLength={8}
            required
          />
        </div>
        {error && <p id="account-error" role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={isSubmitting} className="w-full bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 disabled:opacity-50">
          {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        className="w-full text-sm text-blue-600 mt-4 hover:underline"
      >
        {mode === 'login' ? 'Create a new account' : 'Use an existing account'}
      </button>
    </div>
  );
}
