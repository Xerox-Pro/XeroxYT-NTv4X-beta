
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
    syncData: () => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('xerox_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    // Helper to construct URL for Express API
    const buildUrl = (action: string, params: Record<string, string>) => {
        const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
        const searchParams = new URLSearchParams(params);
        // Express backend uses route paths (e.g. /login), not query param routing
        return `${baseUrl}/${action}?${searchParams.toString()}`;
    };

    const login = async (id: string, pw: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const url = buildUrl('login', { userid: id, pw: pw });
            const res = await fetch(url);
            
            // Handle HTTP errors (e.g., 401 Unauthorized)
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `Login failed: ${res.status}`);
            }

            const data = await res.json();

            if (data.status === 'success') {
                const loggedInUser = { id, password: pw };
                setUser(loggedInUser);
                localStorage.setItem('xerox_user', JSON.stringify(loggedInUser));
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
            const res = await fetch(url);
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.message || `Signup failed: ${res.status}`);
            }

            const data = await res.json();
            
            // Backend returns { message: "Success: ... users created." }
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

    const syncData = async () => {
        if (!user || !user.password) return;
        setIsLoading(true);
        
        try {
            // Gather Local Data
            const searchHistory: string[] = JSON.parse(localStorage.getItem('searchHistory') || '[]');
            const history: any[] = JSON.parse(localStorage.getItem('videoHistory') || '[]');
            const shortsHistory: any[] = JSON.parse(localStorage.getItem('shortsHistory') || '[]');
            const subscriptions: any[] = JSON.parse(localStorage.getItem('subscribedChannels') || '[]');

            // Format for API (Comma separated strings)
            // Increased limit slightly as Render/Express can handle longer URLs than GAS
            const limit = 50;
            
            const sanitize = (s: string) => s.replace(/,/g, ''); // Simple comma sanitization

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
            const res = await fetch(url);
            
            if (!res.ok) {
                 const errData = await res.json().catch(() => ({}));
                 throw new Error(errData.error || `Sync failed: ${res.status}`);
            }

            const data = await res.json();
            
            // Backend returns { message: "Success", items: ... }
            if (data.message === 'Success') {
                alert('同期が完了しました。');
            } else {
                throw new Error('Sync failed: ' + (data.error || JSON.stringify(data)));
            }

        } catch (err: any) {
            console.error(err);
            alert('同期に失敗しました: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, signup, logout, syncData, isLoading, error }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
