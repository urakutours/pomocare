import { createContext, useContext, useMemo } from 'react';
import { getTranslations } from '@/i18n';
import type { Language, Translations } from '@/i18n';

interface I18nContextValue {
  language: Language;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  t: getTranslations('en'),
});

interface I18nProviderProps {
  language: Language;
  children: React.ReactNode;
}

export function I18nProvider({ language, children }: I18nProviderProps) {
  const value = useMemo<I18nContextValue>(
    () => ({ language, t: getTranslations(language) }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
