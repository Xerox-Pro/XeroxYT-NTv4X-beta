
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import { usePreference } from './PreferenceContext';
import { useAuth } from './AuthContext';

interface SearchHistoryContextType {
  searchHistory: string[];
  addSearchTerm: (term: string) => void;
  removeSearchTerms: (terms: string[]) => void;
  clearSearchHistory: () => void;
}

const SearchHistoryContext = createContext<SearchHistoryContextType | undefined>(undefined);

const SEARCH_HISTORY_KEY = 'searchHistory';
const MAX_HISTORY_LENGTH = 50;

export const SearchHistoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { notifyAction, isGuestMode } = usePreference();
  const { triggerAutoSync } = useAuth();
  const isInitialized = useRef(false);

  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const item = window.localStorage.getItem(SEARCH_HISTORY_KEY);
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error("Failed to parse search history from localStorage", error);
      return [];
    }
  });

  useEffect(() => {
      isInitialized.current = true;
  }, []);

  useEffect(() => {
    if (!isInitialized.current) return;
    try {
      window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
      if (!isGuestMode) triggerAutoSync();
    } catch (error) {
      console.error("Failed to save search history to localStorage", error);
    }
  }, [searchHistory, isGuestMode, triggerAutoSync]);

  const addSearchTerm = useCallback((term: string) => {
    if (isGuestMode) return; // Do not save search history in guest mode

    setSearchHistory(prev => {
      const newHistory = [term, ...prev.filter(t => t.toLowerCase() !== term.toLowerCase())];
      return newHistory.slice(0, MAX_HISTORY_LENGTH);
    });
    notifyAction();
  }, [notifyAction, isGuestMode]);

  const removeSearchTerms = useCallback((terms: string[]) => {
    setSearchHistory(prev => prev.filter(t => !terms.includes(t)));
    notifyAction();
  }, [notifyAction]);

  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
    notifyAction();
  }, [notifyAction]);

  return (
    <SearchHistoryContext.Provider value={{ searchHistory, addSearchTerm, removeSearchTerms, clearSearchHistory }}>
      {children}
    </SearchHistoryContext.Provider>
  );
};

export const useSearchHistory = (): SearchHistoryContextType => {
  const context = useContext(SearchHistoryContext);
  if (context === undefined) {
    throw new Error('useSearchHistory must be used within a SearchHistoryProvider');
  }
  return context;
};
