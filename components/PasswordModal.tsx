import React, { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';
import { Lock, LogIn, AlertCircle } from 'lucide-react';

export const PasswordModal: React.FC = () => {
  const [password, setPassword] = useState('');
  const { login, loginError, isLoadingAuth } = useAuth(); // Assuming isLoadingAuth might be relevant for login button state
  const [isAttemptingLogin, setIsAttemptingLogin] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isAttemptingLogin) return;
    setIsAttemptingLogin(true);
    try {
      await login(password);
    } catch (err) {
      // login function internally sets loginError, so specific catch here might be redundant
      // unless login itself throws, which it doesn't seem to based on its current implementation.
      console.error("Error during login attempt:", err);
    } finally {
      setIsAttemptingLogin(false);
      // Password might be cleared after attempt, or not, based on UX preference.
      // For now, let's clear it on failed attempt if there's an error.
      if (loginError) { 
        setPassword(''); // Clear password only if there was an error with this attempt.
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all p-6 sm:p-8">
        <div className="text-center mb-6">
          <Lock className="mx-auto h-12 w-12 text-teal-600 mb-3" />
          <h2 className="text-2xl font-bold text-gray-800">ورود به دستیار هوشمند</h2>
          <p className="text-sm text-gray-500 mt-1">برای دسترسی به برنامه، لطفاً رمز عبور خود را وارد کنید.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password-input" className="sr-only">
              رمز عبور
            </label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="رمز عبور"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition text-gray-900 placeholder-gray-500 text-center"
              disabled={isAttemptingLogin}
            />
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm flex items-center">
              <AlertCircle size={20} className="me-2 flex-shrink-0" />
              <span className="flex-grow">{loginError}</span>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isAttemptingLogin || isLoadingAuth || !password.trim()}
              className="w-full flex items-center justify-center px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isAttemptingLogin ? (
                <LoadingSpinner size="5" color="text-white" />
              ) : (
                <>
                  <LogIn size={20} className="me-2" />
                  ورود
                </>
              )}
            </button>
          </div>
        </form>
         <p className="text-xs text-gray-400 mt-6 text-center">
            هر رمز عبور به مدت ۲۴ ساعت از اولین استفاده معتبر است.
        </p>
      </div>
    </div>
  );
};
