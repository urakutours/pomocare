export const SUPPORTED_LANGUAGES = ['en', 'ja', 'es', 'pt', 'de', 'fr', 'it'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export interface Translations {
  // Language metadata
  languageName: string;

  // Header
  appTitle: string;

  // Timer
  restMode: string;
  longBreakMode: string;

  // Settings
  settings: string;
  activeTimeLabel: string;
  restTimeLabel: string;
  longBreakTimeLabel: string;
  longBreakIntervalLabel: string;
  customMessageLabel: string;
  languageLabel: string;
  applySettings: string;
  customInput: string;
  presetSettingsLabel: string;
  activePresetsLabel: string;
  restPresetsLabel: string;
  addPreset: string;
  restOffLabel: string;
  themeLabel: string;
  themeLight: string;
  themeGray: string;
  themeDark: string;

  // Alarm settings
  alarmLabel: string;
  alarmSoundBell: string;
  alarmSoundDigital: string;
  alarmSoundChime: string;
  alarmSoundKitchen: string;
  alarmSoundClassic: string;
  alarmSoundGentle: string;
  alarmSoundSoft: string;
  alarmSoundNone: string;
  alarmRepeatLabel: string;

  // Labels
  labelsLabel: string;
  labelNote: string;
  labelNotePlaceholder: string;
  labelSelectPlaceholder: string;
  addNewLabel: string;
  labelStats: string;
  allLabels: string;
  addLabel: string;
  activeLabelLabel: string;
  noLabel: string;
  labelDuration: string;
  labelDurationNone: string;

  // Session edit menu
  sessionChangeLabel: string;
  sessionEditNote: string;
  sessionDelete: string;
  sessionDeleteConfirm: string;

  // Focus mode confirmations
  confirmCompleteSession: string;
  confirmComplete: string;
  confirmResetTimer: string;
  confirmReset: string;

  // CSV import
  csvImportTitle: string;
  csvImportDescription: string;
  csvImportButton: string;
  csvImportModalDropzone: string;
  csvImportModalOr: string;
  csvImportModalSelectFile: string;
  csvImportModalCancel: string;

  // Data reset
  dataResetTitle: string;
  dataResetDescription: string;
  dataResetButton: string;
  dataResetConfirm1: string;
  dataResetConfirm2: string;
  dataResetCancel: string;

  // Stats
  weeklyStats: string;
  weekly: string;
  monthly: string;
  yearly: string;
  today: string;
  thisWeek: string;
  totalTime: string;
  sessions: string;
  previousWeek: string;
  nextWeek: string;
  previousMonth: string;
  nextMonth: string;
  previousYear: string;
  nextYear: string;
  exportCsv: string;
  csvExportTitle: string;
  csvExportDescription: string;

  // Settings tabs
  settingsTabGeneral: string;
  settingsTabLabels: string;
  settingsTabPresets: string;

  // Install banner
  installApp: string;

  // Days of week (Mon-Sun)
  days: readonly [string, string, string, string, string, string, string];

  // Months
  months: readonly [string, string, string, string, string, string, string, string, string, string, string, string];

  // Default custom message
  defaultCustomMessage: string;

  // Auth
  authLogin: string;
  authSignup: string;
  authLogout: string;
  authLoginWithGoogle: string;
  authOr: string;
  authEmail: string;
  authPassword: string;
  authForgotPassword: string;
  authCreateAccount: string;
  authProcessing: string;
  authErrorInvalidCredential: string;
  authErrorEmailInUse: string;
  authErrorWeakPassword: string;
  authErrorInvalidEmail: string;
  authErrorLoginFailed: string;
  authErrorSignupFailed: string;
  authVerificationSentTitle: string;
  authVerificationSentMessage: string;
  authVerificationConfirm: string;
  authUnverifiedTitle: string;
  authUnverifiedMessage: string;
  authResendEmail: string;
  authClose: string;
  authForgotPasswordTitle: string;
  authForgotPasswordMessage: string;
  authSendResetEmail: string;
  authResetEmailSent: string;
  authEmailVerifiedTitle: string;
  authEmailVerifiedMessage: string;
  authOpenApp: string;
  authPasswordResetDoneTitle: string;
  authPasswordResetDoneMessage: string;
  authDeleteAccount: string;
  authDeleteAccountConfirm: string;
  authDeleteAccountSuccess: string;

  // Loading
  loadingMessage: string;

  // Label menu
  labelChangeColor: string;
  labelRename: string;
  labelDelete: string;

  // Label creation
  labelNamePlaceholder: string;

  // Stats display mode
  statsSets: string;
  statsTime: string;

  // Upgrade / Tier
  upgradeTitle: string;
  upgradeDescription: string;
  upgradeStandard: string;
  upgradePro: string;
  upgradeStandardPrice: string;
  upgradeProPrice: string;
  upgradeRequired: string;
  freeLabelLimit: string;
  planFree: string;
  planStandard: string;
  planPro: string;
  upgradeCta: string;

  // Payment / Checkout
  paymentSuccess: string;
  paymentSuccessStandard: string;
  paymentSuccessPro: string;
  paymentCancelled: string;
  checkoutLoginRequired: string;
  checkoutProcessing: string;
  checkoutError: string;

}
