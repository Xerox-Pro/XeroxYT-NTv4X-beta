
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import type { Video } from '../types';
import { usePreference } from './PreferenceContext';
import { useAuth } from './AuthContext';

interface HistoryContextType {
  history: Video[];
  shortsHistory: Video[];
  addVideoToHistory: (video: Video) => void;
  addShortToHistory: (video: Video) => void;
  clearHistory: () => void;
  removeVideosFromHistory: (videoIds: string[]) => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

const HISTORY_KEY = 'videoHistory';
const SHORTS_HISTORY_KEY = 'shortsHistory';
const MAX_HISTORY_LENGTH = 200;

export const HistoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { notifyAction, isGuestMode } = usePreference();
  const { syncAction } = useAuth();
  const isInitialized = useRef(false);

  const [history, setHistory] = useState<Video[]>([]);
  const [shortsHistory, setShortsHistory] = useState<Video[]>([]);

  // Initial Read
  useEffect(() => {
      try {
          const item = window.localStorage.getItem(HISTORY_KEY);
          if (item) setHistory(JSON.parse(item));
          
          const shortsItem = window.localStorage.getItem(SHORTS_HISTORY_KEY);
          if (shortsItem) setShortsHistory(JSON.parse(shortsItem));
      } catch (error) {
          console.error("Failed to parse history from localStorage", error);
      } finally {
          isInitialized.current = true;
      }
  }, []);

  // Sync Write
  useEffect(() => {
    if (!isInitialized.current) return;
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("Failed to save history to localStorage", error);
    }
  }, [history]);

  useEffect(() => {
    if (!isInitialized.current) return;
    try {
      window.localStorage.setItem(SHORTS_HISTORY_KEY, JSON.stringify(shortsHistory));
    } catch (error) {
      console.error("Failed to save shorts history to localStorage", error);
    }
  }, [shortsHistory]);

  const addVideoToHistory = useCallback((video: Video) => {
    if (isGuestMode) return; 

    setHistory(prev => {
      // Avoid duplicates at the top
      if (prev.length > 0 && prev[0].id === video.id) return prev;
      const newHistory = [video, ...prev.filter(v => v.id !== video.id)];
      return newHistory.slice(0, MAX_HISTORY_LENGTH);
    });
    notifyAction();
    
    // Auto-sync single item
    syncAction({ category: 'history', item: video });
  }, [notifyAction, isGuestMode, syncAction]);

  const addShortToHistory = useCallback((video: Video) => {
    if (isGuestMode) return;

    setShortsHistory(prev => {
      if (prev.length > 0 && prev[0].id === video.id) return prev;
      const newHistory = [video, ...prev.filter(v => v.id !== video.id)];
      return newHistory.slice(0, MAX_HISTORY_LENGTH);
    });
    notifyAction();
    
    // Auto-sync single item
    syncAction({ category: 'shorts', item: video });
  }, [notifyAction, isGuestMode, syncAction]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setShortsHistory([]);
    notifyAction();
    // Clearing history on cloud isn't supported by 'writealldeta' easily without a reset flag, 
    // so we just clear locally. The user can use "Reset Data" in settings if needed.
  }, [notifyAction]);

  const removeVideosFromHistory = useCallback((videoIds: string[]) => {
    setHistory(prev => prev.filter(video => !videoIds.includes(video.id)));
    setShortsHistory(prev => prev.filter(video => !videoIds.includes(video.id)));
    notifyAction();
  }, [notifyAction]);

  return (
    <HistoryContext.Provider value={{ history, shortsHistory, addVideoToHistory, addShortToHistory, clearHistory, removeVideosFromHistory }}>
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = (): HistoryContextType => {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};
