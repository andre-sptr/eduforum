import { useState, useEffect, useRef, useCallback } from 'react';

export const useStoryTimer = (
  storyId: string | undefined, 
  durationMs: number,
  isPaused: boolean,
  onEnd: () => void
) => {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const remainingTimeRef = useRef(durationMs);

  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const animate = useCallback((timestamp: number) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = timestamp; 
    }

    const elapsedTimeSinceResume = timestamp - startTimeRef.current;
    const totalElapsedTime = (durationMs - remainingTimeRef.current) + elapsedTimeSinceResume;

    if (totalElapsedTime >= durationMs) {
      setProgress(100);
      onEndRef.current(); 
    } else {
      const currentProgress = (totalElapsedTime / durationMs) * 100;
      setProgress(currentProgress);
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [durationMs]); 

  const pause = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (startTimeRef.current) {
        const elapsedTime = performance.now() - startTimeRef.current;
        remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsedTime);
      }
      startTimeRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (rafRef.current === null && !isPaused) {
      startTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [animate, isPaused]);

  const reset = useCallback((newDuration: number) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    remainingTimeRef.current = newDuration;
    startTimeRef.current = null;
    setProgress(0);
  }, []);

  useEffect(() => {
    reset(durationMs);
  }, [storyId, durationMs, reset]);

  useEffect(() => {
    if (isPaused) {
      pause();
    } else {
      start();
    }
  }, [isPaused, start, pause, storyId]); 

  useEffect(() => () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  return progress;
};