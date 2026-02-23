import { useState } from 'react';
import { authService } from '@/services/auth/AuthService';
import { useI18n } from '@/contexts/I18nContext';

interface EmailActionHandlerProps {
  onDone: () => void;
}

/**
 * Supabase パスワードリセットフォーム
 *
 * Supabase はパスワードリセットリンクをクリックすると
 * PASSWORD_RECOVERY イベントを発火してアプリにリダイレクトする。
 * このコンポーネントで新パスワードを入力させて updateUser で更新する。
 *
 * メール確認は Supabase が自動で処理するためコンポーネント不要。
 */
export function EmailActionHandler({ onDone }: EmailActionHandlerProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<'form' | 'processing' | 'success' | 'error'>('form');
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handlePasswordReset = async () => {
    if (newPassword.length < 6) return;
    try {
      setStatus('processing');
      await authService.confirmPasswordReset('', newPassword);
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Reset failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-tiffany/10 to-white dark:from-neutral-900 dark:to-neutral-800">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-8 w-80 mx-4 text-center">
        {status === 'processing' && (
          <>
            <div className="w-10 h-10 mx-auto mb-4 border-4 border-tiffany border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 dark:text-gray-300">{t.authProcessing}</p>
          </>
        )}

        {status === 'form' && (
          <>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{t.authForgotPasswordTitle}</h3>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t.authPassword}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 mb-4"
            />
            <button
              onClick={handlePasswordReset}
              disabled={newPassword.length < 6}
              className="w-full py-2.5 text-sm font-medium text-white bg-tiffany hover:bg-tiffany-hover rounded-xl disabled:opacity-50 transition-colors"
            >
              {t.authSendResetEmail}
            </button>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 bg-tiffany/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-tiffany" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{t.authPasswordResetDoneTitle}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t.authPasswordResetDoneMessage}</p>
            <button
              onClick={onDone}
              className="w-full py-2.5 text-sm font-medium text-white bg-tiffany hover:bg-tiffany-hover rounded-xl transition-colors"
            >
              {t.authOpenApp}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <button
              onClick={onDone}
              className="w-full py-2.5 text-sm font-medium text-white bg-tiffany hover:bg-tiffany-hover rounded-xl transition-colors"
            >
              {t.authOpenApp}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
