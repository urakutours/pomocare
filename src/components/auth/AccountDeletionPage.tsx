import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

type DeletionState = 'idle' | 'confirming' | 'processing' | 'done' | 'error';

/**
 * Standalone account deletion page accessible at /account-deletion.
 *
 * Used for Google Play store listing's account deletion URL requirement.
 * Also accessible from within the app (Settings → Delete Account).
 */
export function AccountDeletionPage() {
  const { user, deleteAccount, signInWithGoogle } = useAuth();
  const [state, setState] = useState<DeletionState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDelete = async () => {
    setState('processing');
    setErrorMsg(null);
    try {
      await deleteAccount();
      setState('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error');
      setState('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 py-10 px-4">
      <div className="max-w-xl mx-auto bg-white dark:bg-neutral-800 rounded-xl shadow p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Account Deletion / アカウント削除
        </h1>

        {state === 'done' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-green-700 dark:text-green-400">
              <CheckCircle2 size={24} />
              <p className="font-medium">
                Your account has been deleted / アカウントを削除しました
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              All your personal data, session history, settings, and any active
              subscriptions have been cancelled and removed.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              すべての個人データ、セッション履歴、設定、有効なサブスクリプションを
              キャンセル・削除しました。
            </p>
            <a
              href="/"
              className="inline-block mt-4 px-4 py-2 bg-tiffany text-white rounded-lg hover:bg-tiffany-hover transition"
            >
              Return to PomoCare
            </a>
          </div>
        ) : (
          <>
            <section className="mb-6 space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <p>
                This page allows you to delete your PomoCare account and all
                associated data.
              </p>
              <p>
                このページでは PomoCare アカウントと関連するすべてのデータを削除できます。
              </p>
            </section>

            <section className="mb-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                What will be deleted / 削除されるデータ
              </h2>
              <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <li>Account profile (email, display name, avatar) / アカウント情報</li>
                <li>Pomodoro session history / ポモドーロセッション履歴</li>
                <li>Settings and custom labels / 設定・ラベル</li>
                <li>Push notification subscriptions / プッシュ通知購読</li>
                <li>
                  Active paid subscriptions (cancelled immediately) /
                  有効な有料サブスクリプション（即時解約）
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                Data retention / データ保持期間
              </h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Deletion is processed immediately. Billing records kept by Stripe
                for accounting purposes (transaction history) are retained for up
                to 7 years as required by law, but contain no personally
                identifiable information beyond what Stripe manages independently.
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                削除は即座に処理されます。Stripe が決済の会計記録として保持する
                取引履歴のみ、法律上の義務により最大 7 年間保持されますが、
                Stripe が独立して管理する範囲を超える個人情報は含まれません。
              </p>
            </section>

            {!user ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                  <p>
                    Please sign in first to delete your account. /
                    アカウント削除にはログインが必要です。
                  </p>
                </div>
                <button
                  onClick={() => { void signInWithGoogle(); }}
                  className="w-full px-4 py-2 bg-tiffany text-white rounded-lg hover:bg-tiffany-hover transition"
                >
                  Sign in with Google / Google でログイン
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  If you used email/password sign up, please open the PomoCare
                  app and use Settings → Delete Account.
                </p>
              </div>
            ) : state === 'confirming' ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-800 dark:text-red-200">
                  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                  <p>
                    This action cannot be undone. Are you sure? /
                    この操作は取り消せません。よろしいですか？
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setState('idle')}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 transition"
                  >
                    Cancel / キャンセル
                  </button>
                  <button
                    onClick={() => void handleDelete()}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    Yes, delete my account / はい、削除します
                  </button>
                </div>
              </div>
            ) : state === 'processing' ? (
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <Loader2 size={20} className="animate-spin" />
                <p>Deleting your account... / 削除処理中...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {state === 'error' && errorMsg && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-800 dark:text-red-200">
                    <p className="font-medium mb-1">Error / エラー</p>
                    <p>{errorMsg}</p>
                  </div>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Signed in as: <strong>{user.email ?? user.displayName ?? user.id}</strong>
                </p>
                <button
                  onClick={() => setState('confirming')}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Delete my account / アカウントを削除
                </button>
              </div>
            )}
          </>
        )}

        <footer className="mt-8 pt-6 border-t border-gray-200 dark:border-neutral-700 text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            For questions, contact us at{' '}
            <a href="mailto:support@pomocare.com" className="text-tiffany hover:underline">
              support@pomocare.com
            </a>
          </p>
          <p>
            <a href="https://pomocare.com/privacy/" className="text-tiffany hover:underline">
              Privacy Policy
            </a>
            {' · '}
            <a href="/" className="text-tiffany hover:underline">
              Back to PomoCare
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
