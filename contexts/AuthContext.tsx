
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';

// New Render API Endpoint
const API_BASE_URL = "https://xerox-login-api.onrender.com";

interface User {
    id: string;
    password?: string; 
}

interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    login: (id: string, pw: string) => Promise<void>;
    signup: (id: string, pw: string) => Promise<void>;
    logout: () => void;
    syncData: (silent?: boolean) => Promise<void>;
    fetchUserData: () => Promise<void>;
    triggerAutoSync: () => void;
    isLoading: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to handle fetch via GAS proxy if available, or standard fetch
const smartFetch = async (url: string): Promise<any> => {
    // @ts-ignore - google object exists in GAS environment
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            google.script.run
                .withSuccessHandler((res: any) => {
                    resolve({
                        ok: res.status >= 200 && res.status < 300,
                        status: res.status,
                        json: async () => {
                            try { return JSON.parse(res.body); }
                            catch (e) { throw new Error('Invalid JSON response'); }
                        },
                        text: async () => res.body
                    });
                })
                .withFailureHandler((err: any) => {
                    console.error("GAS Proxy Error:", err);
                    reject(new Error("GAS Proxy Error: " + err));
                })
                .proxyApi(url); // Call the server-side GAS function
        });
    } else {
        // Fallback for local development (might fail CORS if not proxied)
        return fetch(url);
    }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const syncTimeoutRef = useRef<any>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('xerox_user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            // Auto-fetch data on site access if logged in
            fetchUserDataInternal(parsedUser.id, parsedUser.password, true);
        }
    }, []);

    // Helper to construct URL for Express API
    const buildUrl = (action: string, params: Record<string, string>) => {
        const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
        const searchParams = new URLSearchParams(params);
        return `${baseUrl}/${action}?${searchParams.toString()}`;
    };

    const login = async (id: string, pw: string) => {
        setIsLoading(true);
        setError(null);
        try {
            // Login now also fetches data to ensure local state is up to date
            await fetchUserDataInternal(id, pw);
            
            const loggedInUser = { id, password: pw };
            setUser(loggedInUser);
            localStorage.setItem('xerox_user', JSON.stringify(loggedInUser));
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const signup = async (id: string, pw: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const url = buildUrl('newcreateuser', { userid: id, pw: pw });
            const res = await smartFetch(url);
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.message || `Signup failed: ${res.status}`);
            }

            const data = await res.json();
            
            if (data.message && data.message.includes('Success')) {
                 await login(id, pw);
            } else {
                 throw new Error(data.error || data.message || 'Signup failed');
            }
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('xerox_user');
    };

    // Internal function to fetch and apply data (GET)
    const fetchUserDataInternal = async (id: string, pw: string | undefined, isAutoLoad = false) => {
        if (!id || !pw) return;
        try {
            // Correct endpoint for reading data: readalluserdate
            const url = buildUrl('readalluserdate', { userid: id, pw: pw });
            const res = await smartFetch(url);
            
            if (!res.ok) throw new Error('Failed to fetch user data');
            const data = await res.json();

            if (data.status === 'success' && data.data) {
                const userData = data.data;
                const cloudItems = userData.data || [];

                // 1. Prepare Data Containers
                const searchHistory: string[] = [];
                const videoHistoryMap = new Map<string, any>();
                const shortsHistoryMap = new Map<string, any>();
                const subscriptionsMap = new Map<string, any>();

                // 2. Load Local Data to Preserve Metadata if possible
                const localHistory = JSON.parse(localStorage.getItem('videoHistory') || '[]');
                const localShorts = JSON.parse(localStorage.getItem('shortsHistory') || '[]');
                const localSubs = JSON.parse(localStorage.getItem('subscribedChannels') || '[]');

                const localHistoryMap = new Map(localHistory.map((v: any) => [v.id, v]));
                const localShortsMap = new Map(localShorts.map((v: any) => [v.id, v]));
                const localSubsMap = new Map(localSubs.map((c: any) => [c.id, c]));

                // 3. Process Cloud Items with Safety Checks
                cloudItems.forEach((item: any) => {
                    if (item.category === 'search') {
                        searchHistory.push(item.word);
                    }
                    else if (item.category === 'histry') {
                        const local = localHistoryMap.get(item.id);
                        videoHistoryMap.set(item.id, local || {
                            id: item.id,
                            title: item.text || 'No Title',
                            thumbnailUrl: `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
                            channelName: 'Unknown',
                            channelId: '',
                            channelAvatarUrl: '',
                            views: '',
                            uploadedAt: '',
                            duration: '',
                            isoDuration: ''
                        });
                    }
                    else if (item.category === 'shorthistry') {
                        const local = localShortsMap.get(item.id);
                        shortsHistoryMap.set(item.id, local || {
                            id: item.id,
                            title: item.text || 'No Title',
                            thumbnailUrl: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
                            channelName: '',
                            channelId: '',
                            views: '',
                            uploadedAt: '',
                            duration: ''
                        });
                    }
                    else if (item.category === 'subscription') {
                        const local = localSubsMap.get(item.id);
                        subscriptionsMap.set(item.id, local || {
                            id: item.id,
                            name: item.name || 'Unknown Channel',
                            avatarUrl: 'https://www.gstatic.com/youtube/img/creator/avatar/default_64.svg',
                            subscriberCount: ''
                        });
                    }
                });

                // 4. Save to LocalStorage
                const newHistory = Array.from(videoHistoryMap.values());
                const newShorts = Array.from(shortsHistoryMap.values());
                const newSubs = Array.from(subscriptionsMap.values());

                if (searchHistory.length > 0) localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
                if (newHistory.length > 0) localStorage.setItem('videoHistory', JSON.stringify(newHistory));
                if (newShorts.length > 0) localStorage.setItem('shortsHistory', JSON.stringify(newShorts));
                if (newSubs.length > 0) localStorage.setItem('subscribedChannels', JSON.stringify(newSubs));
            }
        } catch (e) {
            console.error("Fetch user data failed", e);
            if (!isAutoLoad) throw e;
        }
    };

    // Public wrapper for fetching data manually (Reload button)
    const fetchUserData = async () => {
        if (!user || !user.password) return;
        setIsLoading(true);
        try {
            await fetchUserDataInternal(user.id, user.password);
            // Force reload to reflect changes
            window.location.reload();
        } catch (e: any) {
            alert('データの取得に失敗しました: ' + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const syncData = useCallback(async (silent = false) => {
        if (!user || !user.password) return;
        if (!silent) setIsLoading(true);
        
        try {
            const searchHistory: string[] = JSON.parse(localStorage.getItem('searchHistory') || '[]');
            const history: any[] = JSON.parse(localStorage.getItem('videoHistory') || '[]');
            const shortsHistory: any[] = JSON.parse(localStorage.getItem('shortsHistory') || '[]');
            const subscriptions: any[] = JSON.parse(localStorage.getItem('subscribedChannels') || '[]');

            const limit = 50;
            const sanitize = (s: string) => s ? s.replace(/,/g, '') : ''; 

            const searchID = searchHistory.slice(0, limit).join(',');
            
            const histryid = history.slice(0, limit).map(v => v.id).join(',');
            const test = history.slice(0, limit).map(v => sanitize(v.title)).join(',');
            
            const shorthistryID = shortsHistory.slice(0, limit).map(v => v.id).join(',');
            const shorthistrytext = shortsHistory.slice(0, limit).map(v => sanitize(v.title)).join(',');

            const subscriptionID = subscriptions.slice(0, limit).map(c => c.id).join(',');
            const subscriptionname = subscriptions.slice(0, limit).map(c => sanitize(c.name)).join(',');

            const params: Record<string, string> = {
                userid: user.id,
                pw: user.password
            };
            
            if(searchID) params.searchID = searchID;
            if(histryid) params.histryid = histryid;
            if(test) params.test = test;
            if(shorthistryID) params.shorthistryID = shorthistryID;
            if(shorthistrytext) params.shorthistrytext = shorthistrytext;
            if(subscriptionID) params.subscriptionID = subscriptionID;
            if(subscriptionname) params.subscriptionname = subscriptionname;

            const url = buildUrl('writealldeta', params);
            
            // Use smartFetch to handle GAS Proxy logic
            // Note: smartFetch resolves a Response-like object, does not support sendBeacon directly
            const res = await smartFetch(url);
            
            if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || `Sync failed: ${res.status}`);
            }
            const data = await res.json();
            if (data.message === 'Success') {
                if (!silent) alert('同期が完了しました。');
            } else {
                throw new Error('Sync failed: ' + (data.error || JSON.stringify(data)));
            }

        } catch (err: any) {
            console.error(err);
            if (!silent) alert('同期に失敗しました: ' + err.message);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [user]);

    // Auto-sync Trigger (Debounced)
    const triggerAutoSync = useCallback(() => {
        if (!user) return;
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        
        syncTimeoutRef.current = setTimeout(() => {
            syncData(true); // Silent sync
        }, 2000); // 2 seconds debounce
    }, [user, syncData]);

    return (
        <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, signup, logout, syncData, fetchUserData, triggerAutoSync, isLoading, error }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
