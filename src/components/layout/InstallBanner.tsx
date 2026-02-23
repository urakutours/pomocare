import { useState } from 'react';
import { X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useI18n } from '@/contexts/I18nContext';

export function InstallBanner() {
  const { isInstallable, promptInstall } = useInstallPrompt();
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || dismissed) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-tiffany text-white pl-5 pr-3 py-2.5 rounded-lg shadow-md z-50">
      <button
        onClick={promptInstall}
        className="text-sm font-medium hover:underline whitespace-nowrap"
      >
        {t.installApp}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
        aria-label="Close"
      >
        <X size={15} />
      </button>
    </div>
  );
}
