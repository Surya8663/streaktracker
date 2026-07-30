import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { APP_NAME } from '@streaktrack/shared';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setError(null);
      setSubmitting(true);
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fillQuickUser = (userEmail: string, pass: string) => {
    setEmail(userEmail);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-amber-400 p-0.5 shadow-md">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white">
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-2xl font-black text-transparent">
                ST
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome to {APP_NAME}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to track your daily habits and streaks
          </p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/50"
        >
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 rounded-2xl bg-rose-50 p-4 text-xs font-medium text-rose-600 border border-rose-100"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@streaktrack.app"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg focus:ring-4 focus:ring-indigo-200 disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Selectors for testing */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <p className="text-center text-xs font-medium text-slate-400 mb-3">
              Quick Login (Seeded Accounts)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fillQuickUser('surya@streaktrack.app', 'surya123')}
                className="cursor-pointer rounded-xl border border-amber-200/70 bg-amber-50/60 p-2.5 text-center text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100/70"
              >
                👤 Surya
              </button>
              <button
                type="button"
                onClick={() => fillQuickUser('gomathi@streaktrack.app', 'gomathi123')}
                className="cursor-pointer rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-2.5 text-center text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-100/70"
              >
                👤 Gomathi
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
