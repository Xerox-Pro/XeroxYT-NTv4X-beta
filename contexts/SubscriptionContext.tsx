
import React, { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import type { Channel } from '../types';
import { usePreference } from './PreferenceContext';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  subscribedChannels: Channel[];
  subscribe: (channel: Channel) => void;
  unsubscribe: (channelId: string) => void;
  isSubscribed: (channelId: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { notifyAction } = usePreference();
  const { syncAction } = useAuth();
  const isInitialized = useRef(false);

  const [subscribedChannels, setSubscribedChannels] = useState<Channel[]>(() => {
    try {
      const item = window.localStorage.getItem('subscribedChannels');
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  });

  useEffect(() => {
      isInitialized.current = true;
  }, []);

  useEffect(() => {
    if (!isInitialized.current) return;
    try {
      window.localStorage.setItem('subscribedChannels', JSON.stringify(subscribedChannels));
    } catch (error) {
      console.error(error);
    }
  }, [subscribedChannels]);

  const subscribe = (channel: Channel) => {
    setSubscribedChannels(prev => {
      if (prev.some(c => c.id === channel.id)) {
        return prev;
      }
      return [...prev, channel];
    });
    notifyAction();
    // Auto-sync single item
    syncAction({ category: 'subscription', item: channel });
  };

  const unsubscribe = (channelId: string) => {
    setSubscribedChannels(prev => prev.filter(c => c.id !== channelId));
    notifyAction();
    // Unsubscribe is hard to sync with current append-only backend logic, 
    // we rely on syncRecent or reload for state consistency if needed, 
    // or assume "last write wins" isn't fully supported for deletions.
  };

  const isSubscribed = (channelId: string) => {
    return subscribedChannels.some(c => c.id === channelId);
  };

  return (
    <SubscriptionContext.Provider value={{ subscribedChannels, subscribe, unsubscribe, isSubscribed }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
