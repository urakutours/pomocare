import { useRef, useCallback } from 'react';

export function useNotification() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback(() => {
    audioRef.current?.play();
  }, []);

  return { audioRef, playSound };
}
