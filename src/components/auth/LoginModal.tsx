import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';

interface LoginModalProps {
  onClose: () => void;
}

type ModalView = 'signin' | 'signup' | 'forgotPassword' | 'verificationSent' | 'unverified';

export function LoginModal({ onClose }: LoginModalProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resendVerificationEmail, sendPasswordReset } = useAuth();
  const { t } = useI18n();

  const [view, setView] = useState<ModalView>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.authErrorLoginFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (view === 'signin') {
        await signInWithEmail(email, password);
        onClose();
      } else if (view === 'signup') {
        await signUpWithEmail(email, password);
        // Show verification sent modal
        setView('verificationSent');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Invalid login credentials')) {
        setError(t.authErrorInvalidCredential);
      } else if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError(t.authErrorEmailInUse);
      } else if (msg.includes('at least 6 characters') || msg.includes('too short')) {
        setError(t.authErrorWeakPassword);
      } else if (msg.includes('invalid') && msg.includes('email')) {
        setError(t.authErrorInvalidEmail);
      } else {
        setError(view === 'signin' ? t.authErrorLoginFailed : t.authErrorSignupFailed);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      await resendVerificationEmail();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError('');
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setResetEmailSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.authErrorLoginFailed);
    } finally {
      setLoading(false);
    }
  };

  // Verification sent modal
  if (view === 'verificationSent') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 w-80 mx-4 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-12 h-12 mx-auto mb-4 bg-tiffany/10 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-tiffany" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{t.authVerificationSentTitle}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t.authVerificationSentMessage}</p>
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium text-white bg-tiffany hover:bg-tiffany-hover rounded-xl transition-colors"
          >
            {t.authVerificationConfirm}
          </button>
        </div>
      </div>
    );
  }

  // Unverified email modal
  if (view === 'unverified') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 w-80 mx-4 text-center" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{t.authUnverifiedTitle}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t.authUnverifiedMessage}</p>
          <button
            onClick={handleResendVerification}
            disabled={loading}
            className="w-full py-2.5 text-sm font-medium text-white bg-tiffany hover:bg-tiffany-hover rounded-xl disabled:opacity-50 transition-colors mb-2"
          >
            {t.authResendEmail}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {t.authClose}
          </button>
        </div>
      </div>
    );
  }

  // Forgot password view
  if (view === 'forgotPassword') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 w-80 mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-base">{t.authForgotPasswordTitle}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">✕</button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.authForgotPasswordMessage}</p>
          {resetEmailSent ? (
            <div className="text-center">
              <p className="text-sm text-tiffany mb-4">{t.authResetEmailSent}</p>
              <button onClick={onClose} className="w-full py-2.5 text-sm font-medium text-white bg-tiffany hover:bg-tiffany-hover rounded-xl transition-colors">
                {t.authClose}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendPasswordReset} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.authEmail}
                required
                autoComplete="email"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400"
              />
              {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm font-medium text-white bg-tiffany hover:bg-tiffany-hover rounded-xl disabled:opacity-50 transition-colors"
              >
                {loading ? t.authProcessing : t.authSendResetEmail}
              </button>
              <button
                type="button"
                onClick={() => { setView('signin'); setError(''); setResetEmailSent(false); }}
                className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {t.authLogin}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Main login/signup view
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 w-80 mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-base">
            {view === 'signin' ? t.authLogin : t.authSignup}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">✕</button>
        </div>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 dark:border-neutral-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" fillRule="evenodd">
              <path d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </g>
          </svg>
          {t.authLoginWithGoogle}
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200 dark:bg-neutral-600" />
          <span className="text-xs text-gray-400 dark:text-gray-500">{t.authOr}</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-neutral-600" />
        </div>

        {/* Tab switcher */}
        <div className="flex mb-4 bg-gray-100 dark:bg-neutral-700 rounded-xl p-1">
          <button
            onClick={() => { setView('signin'); setError(''); }}
            className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              view === 'signin'
                ? 'bg-white dark:bg-neutral-600 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.authLogin}
          </button>
          <button
            onClick={() => { setView('signup'); setError(''); }}
            className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              view === 'signup'
                ? 'bg-white dark:bg-neutral-600 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.authSignup}
          </button>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.authEmail}
            required
            autoComplete="email"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.authPassword}
            required
            autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400"
          />

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-medium text-white bg-tiffany hover:bg-tiffany-hover rounded-xl disabled:opacity-50 transition-colors"
          >
            {loading ? t.authProcessing : view === 'signin' ? t.authLogin : t.authCreateAccount}
          </button>

          {view === 'signin' && (
            <button
              type="button"
              onClick={() => { setView('forgotPassword'); setError(''); setResetEmailSent(false); }}
              className="w-full text-center text-xs text-gray-400 dark:text-gray-500 hover:text-tiffany transition-colors"
            >
              {t.authForgotPassword}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
