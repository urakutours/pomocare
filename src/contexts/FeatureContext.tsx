import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { FEATURE_FLAGS, type FeatureFlags } from '@/config/features';

const FeatureContext = createContext<FeatureFlags>(FEATURE_FLAGS.free);

export function FeatureProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const tier = user?.tier ?? 'free';
  const flags = FEATURE_FLAGS[tier];

  return (
    <FeatureContext.Provider value={flags}>
      {children}
    </FeatureContext.Provider>
  );
}

export const useFeatures = () => useContext(FeatureContext);
