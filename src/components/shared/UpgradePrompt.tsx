import { X } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';

interface UpgradePromptProps {
  onClose: () => void;
}

const LP_URL = 'https://pomocare.com/#pricing';

export function UpgradePrompt({ onClose }: UpgradePromptProps) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-700 rounded-xl shadow-xl w-full max-w-xs p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
        >
          <X size={18} />
        </button>

        <h3 className="text-lg font-bold text-neutral-800 dark:text-white mb-2">
          {t.upgradeTitle}
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
          {t.upgradeDescription}
        </p>

        <div className="space-y-2">
          <a
            href={LP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-2.5 rounded-lg bg-tiffany text-white font-semibold hover:bg-tiffany-hover transition-colors"
          >
            {t.upgradeStandard} — {t.upgradeStandardPrice}
          </a>
          <a
            href={LP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-2.5 rounded-lg border border-tiffany text-tiffany font-semibold hover:bg-tiffany/10 transition-colors"
          >
            {t.upgradePro} — {t.upgradeProPrice}
          </a>
        </div>
      </div>
    </div>
  );
}
