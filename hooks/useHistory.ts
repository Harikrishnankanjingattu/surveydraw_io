
import { useState, useCallback } from 'react';

export function useHistory<T>(initialState: T) {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [index, setIndex] = useState(0);

  const state = history[index];

  const push = useCallback((newState: T) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, index + 1);
      return [...newHistory, newState];
    });
    setIndex(prev => prev + 1);
  }, [index]);

  const replace = useCallback((newState: T) => {
    setHistory(prev => {
      const newHistory = [...prev];
      newHistory[index] = newState;
      return newHistory;
    });
  }, [index]);

  const undo = useCallback(() => {
    if (index > 0) {
      setIndex(prev => prev - 1);
    }
  }, [index]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      setIndex(prev => prev + 1);
    }
  }, [index, history.length]);

  return { state, push, replace, undo, redo, canUndo: index > 0, canRedo: index < history.length - 1 };
}
