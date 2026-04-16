import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { authService } from '@/services/auth/AuthService';

interface ChangePasswordModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export function ChangePasswordModal({ onSuccess, onClose }: ChangePasswordModalProps) {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sameAsCurrentConfirmed, setSameAsCurrentConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSameAsCurrent =
    currentPassword.length > 0 && currentPassword === newPassword;

  // Reset sameAsCurrentConfirmed when currentPassword or newPassword changes
  useEffect(() => {
    setSameAsCurrentConfirmed(false);
  }, [currentPassword, newPassword]);

  const isSubmitDisabled =
    loading ||
    !currentPassword ||
    !newPassword ||
    !confirmPassword ||
    (isSameAsCurrent && !sameAsCurrentConfirmed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError(t.authErrorWeakPassword);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.authPasswordMismatch);
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 w-80 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-base">
            {t.authChangePasswordTitle}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Current password */}
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t.authCurrentPassword}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400"
          />

          {/* New password */}
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t.authNewPassword}
            required
            autoComplete="new-password"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400"
          />

          {/* Confirm new password */}
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t.authConfirmPassword}
            required
            autoComplete="new-password"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400"
          />

          {/* Same-as-current warning (Option B: warn but allow) */}
          {isSameAsCurrent && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2.5 space-y-2">
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                {t.authPasswordSameAsCurrent}
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsCurrentConfirmed}
                  onChange={(e) => setSameAsCurrentConfirmed(e.target.checked)}
                  className="mt-0.5 accent-tiffany flex-shrink-0"
                />
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  {t.authUseSameAnyway}
                </span>
              </label>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full py-2.5 text-sm font-medium text-white bg-[#0abab5] hover:bg-[#099d99] rounded-xl disabled:opacity-50 transition-colors"
          >
            {loading ? t.authProcessing : t.authSubmitChangePassword}
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {t.authCancel}
          </button>
        </form>
      </div>
    </div>
  );
}
