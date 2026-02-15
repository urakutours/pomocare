import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useI18n } from '@/contexts/I18nContext';

export function InstallBanner() {
  const { isInstallable, promptInstall } = useInstallPrompt();
  const { t } = useI18n();

  if (!isInstallable) return null;

  return (
    <div
      className="fixed top-5 left-1/2 -translate-x-1/2 bg-tiffany text-white px-6 py-3 rounded-lg shadow-md z-50 cursor-pointer hover:bg-tiffany-hover transition-colors"
      onClick={promptInstall}
    >
      {t.installApp}
    </div>
  );
}
