/**
 * Amazon Associates 多地域設定
 *
 * 各地域ごとに独立したアソシエイトプログラムに参加し、トラッキングIDを
 * ここに設定する。登録前の地域は trackingId を null にすると、その地域の
 * ユーザーには「PomoCare Pro 誘導」にフォールバックされる。
 *
 * 有効化するには:
 *   1. https://affiliate.amazon.co.jp/ 等で登録
 *   2. 取得したトラッキングID (例: pomocare-22) を下記に設定
 *   3. 必要に応じて products を地域向けに調整
 */

import type { Language } from '@/i18n';

export type AffiliateRegion = 'jp' | 'us' | 'uk' | 'de' | 'fr' | 'it' | 'es' | 'br';

/** Amazon 商品 1 件（ASIN ベース or キーワード検索） */
export interface AffiliateProduct {
  /** 表示用の安定キー（React key に使用） */
  id: string;
  /** 商品カテゴリ。内部タグ付け用 */
  category: 'book' | 'subscription' | 'gadget';
  /** ASIN 指定（優先）。指定時は `/dp/{ASIN}` に遷移 */
  asin?: string;
  /** ASIN が無い場合のキーワード検索。`/s?k={keyword}` に遷移 */
  keyword?: string;
  /** 表示タイトル（短め・1行に収まる長さ） */
  title: string;
  /** 著者名・補足（オプション） */
  subtitle?: string;
  /** 絵文字アイコン（画像利用は著作権リスクがあるため絵文字で統一） */
  emoji: string;
}

/** 地域ごとの Amazon 設定 */
export interface AffiliateConfig {
  region: AffiliateRegion;
  /** Amazon のホスト名（例: amazon.co.jp） */
  host: string;
  /**
   * アソシエイトのトラッキングID。
   * null = 未登録 → バナーは PomoCare Pro 誘導にフォールバック
   */
  trackingId: string | null;
  /** この地域で表示する商品リスト（ローテーション表示） */
  products: AffiliateProduct[];
}

/** 言語コード → 地域のマッピング */
export const LOCALE_TO_REGION: Record<Language, AffiliateRegion> = {
  ja: 'jp',
  en: 'us',
  de: 'de',
  fr: 'fr',
  it: 'it',
  es: 'es',
  pt: 'br',
};

// ---------------------------------------------------------------------------
// 地域別の設定 — トラッキングID は登録完了後に差し込む
// ---------------------------------------------------------------------------

/** 日本 — 登録済み ✅ */
const JP: AffiliateConfig = {
  region: 'jp',
  host: 'amazon.co.jp',
  trackingId: 'pomocare-22',
  products: [
    {
      id: 'jp-deep-work',
      category: 'book',
      asin: '4478068496',
      title: 'ディープ・ワーク',
      subtitle: '大事なことに集中するための技法',
      emoji: '📚',
    },
    {
      id: 'jp-pomodoro-original',
      category: 'book',
      keyword: 'ポモドーロテクニック',
      title: 'ポモドーロ・テクニック',
      subtitle: '集中力を最大化する時間術',
      emoji: '🍅',
    },
    {
      id: 'jp-essentialism',
      category: 'book',
      asin: 'B00Z5SZFJE',
      title: 'エッセンシャル思考',
      subtitle: '最少の時間で成果を最大にする',
      emoji: '🎯',
    },
    {
      id: 'jp-timetechniques',
      category: 'book',
      asin: '4295402125',
      title: '時間術大全',
      subtitle: '人生の生産性を高める技法',
      emoji: '⏱️',
    },
    {
      id: 'jp-kindle-unlimited',
      category: 'subscription',
      keyword: 'Kindle Unlimited',
      title: 'Kindle Unlimited',
      subtitle: '200万冊以上が読み放題',
      emoji: '📖',
    },
    {
      id: 'jp-audible',
      category: 'subscription',
      keyword: 'Audible 無料体験',
      title: 'Audible',
      subtitle: '聴く読書で移動時間も有効活用',
      emoji: '🎧',
    },
  ],
};

/** 米国 */
const US: AffiliateConfig = {
  region: 'us',
  host: 'amazon.com',
  trackingId: null, // TODO: Amazon Associates US 登録後に差し替え (例: 'pomocare-20')
  products: [
    {
      id: 'us-deep-work',
      category: 'book',
      asin: '1455586692',
      title: 'Deep Work',
      subtitle: 'Rules for Focused Success',
      emoji: '📚',
    },
    {
      id: 'us-pomodoro-cirillo',
      category: 'book',
      asin: '1524760706',
      title: 'The Pomodoro Technique',
      subtitle: 'by Francesco Cirillo',
      emoji: '🍅',
    },
    {
      id: 'us-atomic-habits',
      category: 'book',
      asin: '0735211299',
      title: 'Atomic Habits',
      subtitle: 'Build good habits & break bad ones',
      emoji: '⚡',
    },
    {
      id: 'us-essentialism',
      category: 'book',
      asin: '0804137382',
      title: 'Essentialism',
      subtitle: 'The Disciplined Pursuit of Less',
      emoji: '🎯',
    },
    {
      id: 'us-kindle-unlimited',
      category: 'subscription',
      keyword: 'Kindle Unlimited',
      title: 'Kindle Unlimited',
      subtitle: 'Millions of titles, free trial',
      emoji: '📖',
    },
  ],
};

/** 英国 */
const UK: AffiliateConfig = {
  region: 'uk',
  host: 'amazon.co.uk',
  trackingId: null, // TODO: Amazon Associates UK 登録後に差し替え (例: 'pomocare-21')
  products: [
    {
      id: 'uk-deep-work',
      category: 'book',
      asin: '0349411905',
      title: 'Deep Work',
      subtitle: 'Rules for Focused Success',
      emoji: '📚',
    },
    {
      id: 'uk-atomic-habits',
      category: 'book',
      asin: '1847941834',
      title: 'Atomic Habits',
      subtitle: 'Tiny changes, remarkable results',
      emoji: '⚡',
    },
    {
      id: 'uk-essentialism',
      category: 'book',
      asin: '0753555158',
      title: 'Essentialism',
      subtitle: 'The Disciplined Pursuit of Less',
      emoji: '🎯',
    },
  ],
};

/** ドイツ（他 EU 国の初期リストとしても使用可能） */
const DE: AffiliateConfig = {
  region: 'de',
  host: 'amazon.de',
  trackingId: null,
  products: [
    {
      id: 'de-deep-work',
      category: 'book',
      keyword: 'Deep Work Cal Newport',
      title: 'Deep Work',
      subtitle: 'Konzentriert arbeiten',
      emoji: '📚',
    },
    {
      id: 'de-pomodoro',
      category: 'book',
      keyword: 'Pomodoro Technik',
      title: 'Pomodoro-Technik',
      subtitle: 'Zeitmanagement',
      emoji: '🍅',
    },
  ],
};

const FR: AffiliateConfig = {
  region: 'fr',
  host: 'amazon.fr',
  trackingId: null,
  products: [
    {
      id: 'fr-deep-work',
      category: 'book',
      keyword: 'Deep Work Cal Newport',
      title: 'Deep Work',
      subtitle: 'Concentration maximale',
      emoji: '📚',
    },
    {
      id: 'fr-pomodoro',
      category: 'book',
      keyword: 'Technique Pomodoro',
      title: 'Technique Pomodoro',
      subtitle: 'Gestion du temps',
      emoji: '🍅',
    },
  ],
};

const IT: AffiliateConfig = {
  region: 'it',
  host: 'amazon.it',
  trackingId: null,
  products: [
    {
      id: 'it-pomodoro',
      category: 'book',
      keyword: 'Tecnica del Pomodoro',
      title: 'Tecnica del Pomodoro',
      subtitle: 'Francesco Cirillo',
      emoji: '🍅',
    },
    {
      id: 'it-deep-work',
      category: 'book',
      keyword: 'Deep Work Cal Newport',
      title: 'Deep Work',
      subtitle: 'Lavora in profondità',
      emoji: '📚',
    },
  ],
};

const ES: AffiliateConfig = {
  region: 'es',
  host: 'amazon.es',
  trackingId: null,
  products: [
    {
      id: 'es-deep-work',
      category: 'book',
      keyword: 'Deep Work Cal Newport',
      title: 'Deep Work',
      subtitle: 'Concentración intensa',
      emoji: '📚',
    },
    {
      id: 'es-pomodoro',
      category: 'book',
      keyword: 'Tecnica Pomodoro',
      title: 'Técnica Pomodoro',
      subtitle: 'Gestión del tiempo',
      emoji: '🍅',
    },
  ],
};

const BR: AffiliateConfig = {
  region: 'br',
  host: 'amazon.com.br',
  trackingId: null,
  products: [
    {
      id: 'br-deep-work',
      category: 'book',
      keyword: 'Deep Work Cal Newport',
      title: 'Trabalho Focado',
      subtitle: 'Cal Newport',
      emoji: '📚',
    },
  ],
};

const CONFIGS: Record<AffiliateRegion, AffiliateConfig> = {
  jp: JP,
  us: US,
  uk: UK,
  de: DE,
  fr: FR,
  it: IT,
  es: ES,
  br: BR,
};

/** 言語から Amazon 設定を解決する */
export function getAffiliateConfig(language: Language): AffiliateConfig {
  const region = LOCALE_TO_REGION[language];
  return CONFIGS[region];
}

/** トラッキングID が設定済みかどうか */
export function hasAffiliateTrackingId(config: AffiliateConfig): boolean {
  return !!config.trackingId;
}

/**
 * 指定商品への Amazon アフィリエイトリンクを生成する。
 * ASIN があれば `/dp/{ASIN}?tag=...`、なければ `/s?k={keyword}&tag=...`。
 */
export function buildAffiliateUrl(
  config: AffiliateConfig,
  product: AffiliateProduct,
): string {
  if (!config.trackingId) {
    // 呼び出し側で trackingId チェック済みを想定。安全のためのフォールバック。
    return `https://${config.host}`;
  }
  const tag = encodeURIComponent(config.trackingId);
  if (product.asin) {
    return `https://${config.host}/dp/${product.asin}?tag=${tag}`;
  }
  if (product.keyword) {
    return `https://${config.host}/s?k=${encodeURIComponent(product.keyword)}&tag=${tag}`;
  }
  // どちらも未指定なら Amazon トップ
  return `https://${config.host}/?tag=${tag}`;
}

/**
 * 擬似ランダムで商品を選ぶ（セッション内で安定させたい場合は外でメモ化する）。
 * 日付 + 商品数で変化させるので「毎ロードで変わりすぎる」を防ぐ。
 */
export function pickRotatingProduct(
  config: AffiliateConfig,
  rotationSeed?: number,
): AffiliateProduct | null {
  if (config.products.length === 0) return null;
  const seed =
    rotationSeed ?? Math.floor(Date.now() / (1000 * 60 * 60)); // 1時間単位で変化
  const idx = seed % config.products.length;
  return config.products[idx];
}
