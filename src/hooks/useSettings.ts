import { useState, useEffect, useCallback } from 'react';
import type { PomodoroSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';
import type { StorageService } from '@/services/storage/types';

export function useSettings(storage: StorageService) {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    storage.getSettings().then((s) => {
      setSettings(s);
      setIsLoaded(true);
    });
  }, [storage]);

  const updateSettings = useCallback(
    async (newSettings: PomodoroSettings) => {
      setSettings(newSettings);
      await storage.saveSettings(newSettings);
    },
    [storage],
  );

  return { settings, updateSettings, isLoaded };
}
