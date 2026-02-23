import { useState } from 'react';
import { BarChart3, Settings, LogOut, Crown } from 'lucide-react';
import logoSvg from '/icons/logo.svg';
import logoDarkSvg from '/icons/logo_dark.svg';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';

interface HeaderProps {
  onLogoClick: () => void;
  onStatsClick: () => void;
  onSettingsClick: () => void;
}

export function Header({ onLogoClick, onStatsClick, onSettingsClick }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const tierLabel = user?.tier === 'pro' ? t.planPro : user?.tier === 'standard' ? t.planStandard : t.planFree;
  const isPaid = user?.tier === 'standard' || user?.tier === 'pro';

  const handleSignOut = async () => {
    setShowUserMenu(false);
    await signOut();
  };

  return (
    <>
      <div className="flex justify-between items-center mb-8 landscape:mb-2 titlebar-drag">
        <button onClick={onLogoClick} className="hover:opacity-70 transition-opacity titlebar-no-drag">
          <img src={logoSvg} alt="PomoCare" className="h-6 dark:hidden" />
          <img src={logoDarkSvg} alt="PomoCare" className="h-6 hidden dark:block" />
        </button>
        <div className="flex gap-2 items-center">
          <button
            onClick={onStatsClick}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors titlebar-no-drag"
          >
            <BarChart3 size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={onSettingsClick}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors titlebar-no-drag"
          >
            <Settings size={20} className="text-gray-600 dark:text-gray-400" />
          </button>

          {/* Auth button */}
          {user ? (
            <div className="relative titlebar-no-drag">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="w-8 h-8 rounded-full overflow-hidden border-2 border-tiffany hover:opacity-80 transition-opacity flex items-center justify-center bg-tiffany text-white text-xs font-semibold"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName ?? 'User'} className="w-full h-full object-cover" />
                ) : (
                  <span>{(user.displayName ?? user.email ?? 'U')[0].toUpperCase()}</span>
                )}
              </button>

              {showUserMenu && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  {/* Menu */}
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-neutral-700 border border-gray-200 dark:border-neutral-600 rounded-xl shadow-lg w-48 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-neutral-600">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                        {user.displayName ?? user.email ?? 'User'}
                      </p>
                      {user.email && user.displayName && (
                        <p className="text-xs text-gray-400 dark:text-gray-400 truncate">{user.email}</p>
                      )}
                      <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${isPaid ? 'bg-tiffany/15 text-tiffany' : 'bg-gray-100 dark:bg-neutral-600 text-gray-500 dark:text-gray-400'}`}>
                        {tierLabel}
                      </span>
                    </div>
                    {!isPaid && (
                      <button
                        onClick={() => { setShowUserMenu(false); setShowUpgrade(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-tiffany hover:bg-tiffany/5 transition-colors"
                      >
                        <Crown size={14} />
                        {t.upgradeCta}
                      </button>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600 transition-colors"
                    >
                      <LogOut size={14} />
                      {t.authLogout}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="titlebar-no-drag px-3 py-1.5 text-xs font-medium text-white bg-tiffany hover:bg-tiffany-hover rounded-lg transition-colors"
            >
              {t.authLogin}
            </button>
          )}
        </div>
      </div>

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      {showUpgrade && <UpgradePrompt onClose={() => setShowUpgrade(false)} />}
    </>
  );
}
