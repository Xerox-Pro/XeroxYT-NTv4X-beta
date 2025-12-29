
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';

// API Base URL (Render)
const API_BASE_URL = "https://xerox-login-api.onrender.com";

interface User {
    id: string;
    password?: string; 
}

// Data payload type for single action sync
export interface SyncPayload {
    category: 'search' | 'history' | 'shorts' | 'subscription';
    item: any; // string for search, Video/Channel object for others
}

interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    login: (id: string, pw: string) => Promise<void>;
    signup: (id: string, pw: string) => Promise<void>;
    logout: () => void;
    syncAction: (payload: SyncPayload) => Promise<void>;
    syncRecent: () => Promise<void>;
    fetchUserData: () => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to handle fetch via GAS proxy if available
const smartFetch = async (url: string): Promise<any> => {
    // @ts-ignore
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
                            catch (e) { return {}; }
                        },
                        text: async () => res.body
                    });
                })
                .withFailureHandler((err: any) => reject(new Error("GAS Proxy Error: " + err)))
                .proxyApi(url);
        });
    } else {
        return fetch(url);
    }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('xerox_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse user", e);
            }
        }
    }, []);

    const buildUrl = (action: string, params: Record<string, string>) => {
        const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
        const searchParams = new URLSearchParams(params);
        return `${baseUrl}/${action}?${searchParams.toString()}`;
    };

    const login = async (id: string, pw: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const url = buildUrl('login', { userid: id, pw: pw });
            const res = await smartFetch(url);
            const data = await res.json();

            if (data.status === 'success') {
                const loggedInUser = { id, password: pw };
                setUser(loggedInUser);
                localStorage.setItem('xerox_user', JSON.stringify(loggedInUser));
                
                await fetchUserDataInternal(id, pw);
                window.location.reload();
            } else {
                throw new Error(data.message || 'Login failed');
            }
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
            const data = await res.json();
            
            if (data.message && (data.message.includes('Success') || data.message.includes('created'))) {
                 await login(id, pw);
            } else {
                 throw new Error(data.error || 'Signup failed');
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
        window.location.reload();
    };

    // Robust fetcher that safely reconstructs objects
    const fetchUserDataInternal = async (id: string, pw: string) => {
        const url = buildUrl('readalluserdate', { userid: id, pw: pw });
        const res = await smartFetch(url);
        const json = await res.json();

        // The API returns the raw JSON file content directly or wrapped in `data`
        let items: any[] = [];
        if (json && Array.isArray(json.data)) {
            items = json.data;
        } else if (Array.isArray(json)) {
            items = json;
        }

        if (!items || items.length === 0) return;

        const newSearchHistory: string[] = [];
        const newVideoHistory: any[] = [];
        const newShortsHistory: any[] = [];
        const newSubscriptions: any[] = [];

        const seenIds = {
            video: new Set(),
            shorts: new Set(),
            sub: new Set()
        };

        // Process in reverse to restore order if API appends new items to end
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (!item || !item.category) continue;

            try {
                if (item.category === 'search') {
                    if (item.word && typeof item.word === 'string' && !newSearchHistory.includes(item.word)) {
                        newSearchHistory.push(item.word);
                    }
                } else if (item.category === 'histry') {
                    if (item.id && !seenIds.video.has(item.id)) {
                        seenIds.video.add(item.id);
                        newVideoHistory.push({
                            id: item.id,
                            title: item.text || 'No Title',
                            thumbnailUrl: `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
                            channelName: '履歴',
                            channelId: '',
                            channelAvatarUrl: '',
                            views: '',
                            uploadedAt: '',
                            duration: '',
                            isoDuration: ''
                        });
                    }
                } else if (item.category === 'shorthistry') {
                    if (item.id && !seenIds.shorts.has(item.id)) {
                        seenIds.shorts.add(item.id);
                        newShortsHistory.push({
                            id: item.id,
                            title: item.text || 'No Title',
                            thumbnailUrl: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
                            channelName: '履歴',
                            channelId: '',
                            views: '',
                            uploadedAt: '',
                            duration: ''
                        });
                    }
                } else if (item.category === 'subscription') {
                    if (item.id && !seenIds.sub.has(item.id)) {
                        seenIds.sub.add(item.id);
                        
                        // NEW: Try to find icon from various potential keys including 'subscriptionimage'
                        let avatarUrl = item.subscriptionimage || item.image || item.icon || item.avatar || 'https://www.gstatic.com/youtube/img/creator/avatar/default_64.svg';
                        
                        newSubscriptions.push({
                            id: item.id,
                            name: item.name || 'Unknown Channel',
                            avatarUrl: avatarUrl,
                            subscriberCount: ''
                        });
                    }
                }
            } catch (e) {
                console.warn("Skipping malformed item", item);
            }
        }

        // Safely update LocalStorage
        if(newSearchHistory.length > 0) localStorage.setItem('searchHistory', JSON.stringify(newSearchHistory));
        if(newVideoHistory.length > 0) localStorage.setItem('videoHistory', JSON.stringify(newVideoHistory));
        if(newShortsHistory.length > 0) localStorage.setItem('shortsHistory', JSON.stringify(newShortsHistory));
        if(newSubscriptions.length > 0) localStorage.setItem('subscribedChannels', JSON.stringify(newSubscriptions));
    };

    const fetchUserData = async () => {
        if (!user || !user.password) return;
        setIsLoading(true);
        try {
            await fetchUserDataInternal(user.id, user.password);
            alert('データを同期しました。サイトを再読み込みしてください。');
            window.location.reload();
        } catch (e: any) {
            console.error(e);
            alert('データの取得に失敗しました。');
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to safely truncate strings for URL
    const safeStr = (s: string) => {
        if (!s) return '';
        // Replace commas to avoid API parsing issues (server splits by comma)
        let cleaned = s.replace(/,/g, ' ');
        // Aggressively truncate to 30 chars to avoid encoded URL length limits in GAS (2000 chars)
        if (cleaned.length > 30) cleaned = cleaned.substring(0, 30) + '...';
        return cleaned;
    };

    const syncAction = useCallback(async (payload: SyncPayload) => {
        if (!user || !user.password) return;

        const params: Record<string, string> = {
            userid: user.id,
            pw: user.password
        };

        try {
            if (payload.category === 'search') {
                params.searchID = safeStr(payload.item);
            } else if (payload.category === 'history') {
                params.histryid = payload.item.id;
                params.test = safeStr(payload.item.title);
            } else if (payload.category === 'shorts') {
                params.shorthistryID = payload.item.id;
                params.shorthistrytext = safeStr(payload.item.title);
            } else if (payload.category === 'subscription') {
                params.subscriptionID = payload.item.id;
                params.subscriptionname = safeStr(payload.item.name);
                // NEW: Send icon URL if available to preserve it
                if (payload.item.avatarUrl) {
                    params.subscriptionimage = payload.item.avatarUrl;
                }
            }

            const url = buildUrl('writealldeta', params);
            // Fire and forget (silent)
            await smartFetch(url);
        } catch (e) {
            console.error("Auto-sync failed", e);
        }
    }, [user]);

    // Manually sync recent items (Split requests to keep URL short)
    const syncRecent = async () => {
        if (!user || !user.password) return;
        setIsLoading(true);
        try {
            const search = JSON.parse(localStorage.getItem('searchHistory') || '[]');
            const history = JSON.parse(localStorage.getItem('videoHistory') || '[]');
            const shorts = JSON.parse(localStorage.getItem('shortsHistory') || '[]');
            const subs = JSON.parse(localStorage.getItem('subscribedChannels') || '[]');

            // Limit per request to stay SAFE under 2000 chars even with encoding
            const limit = 3; 

            // 1. Sync Search
            if (search.length > 0) {
                const url = buildUrl('writealldeta', {
                    userid: user.id,
                    pw: user.password,
                    searchID: search.slice(0, 10).map(safeStr).join(',') // Search terms are usually short, can send more
                });
                await smartFetch(url);
            }

            // 2. Sync History
            if (history.length > 0) {
                const url = buildUrl('writealldeta', {
                    userid: user.id,
                    pw: user.password,
                    histryid: history.slice(0, limit).map((v: any) => v.id).join(','),
                    test: history.slice(0, limit).map((v: any) => safeStr(v.title)).join(',')
                });
                await smartFetch(url);
            }

            // 3. Sync Shorts
            if (shorts.length > 0) {
                const url = buildUrl('writealldeta', {
                    userid: user.id,
                    pw: user.password,
                    shorthistryID: shorts.slice(0, limit).map((v: any) => v.id).join(','),
                    shorthistrytext: shorts.slice(0, limit).map((v: any) => safeStr(v.title)).join(',')
                });
                await smartFetch(url);
            }

            // 4. Sync Subs
            if (subs.length > 0) {
                const url = buildUrl('writealldeta', {
                    userid: user.id,
                    pw: user.password,
                    subscriptionID: subs.slice(0, limit).map((c: any) => c.id).join(','),
                    subscriptionname: subs.slice(0, limit).map((c: any) => safeStr(c.name)).join(','),
                    // Try sending icons
                    subscriptionimage: subs.slice(0, limit).map((c: any) => c.avatarUrl || '').join(',')
                });
                await smartFetch(url);
            }

            alert('最新データのクラウド保存が完了しました。');
        } catch (e: any) {
            console.error(e);
            alert('一部のデータの保存に失敗しました: ' + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, signup, logout, syncAction, syncRecent, fetchUserData, isLoading, error }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
