import { en } from './en';
import { ja } from './ja';
import { es } from './es';
import { pt } from './pt';
import { de } from './de';
import { fr } from './fr';
import { it } from './it';
import type { Language, Translations } from './types';

export type { Language, Translations };
export { SUPPORTED_LANGUAGES } from './types';

const translations: Record<Language, Translations> = { en, ja, es, pt, de, fr, it };

export function getTranslations(lang: Language): Translations {
  return translations[lang];
}
