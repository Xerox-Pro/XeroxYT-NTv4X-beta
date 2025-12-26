
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { CloseIcon, LoginIcon, UserIcon, SaveIcon, LogoutIcon, RepeatIcon } from './icons/Icons';

interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
    const { user, login, signup, logout, syncData, fetchUserData, isLoading, error: authError } = useAuth();
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        if (!userId.trim() || !password.trim()) {
            setLocalError('IDとパスワードを入力してください');
            return;
        }

        try {
            if (mode === 'login') {
                await login(userId, password);
                onClose();
            } else {
                await signup(userId, password);
                onClose();
            }
        } catch (e) {
            // Error is handled in context but we can keep modal open
        }
    };

    const handleSync = async () => {
        await syncData();
    };

    const handleReload = async () => {
        if(window.confirm('クラウドから最新データを取得して上書きしますか？\n(現在のローカルの変更は破棄される可能性があります)')) {
            await fetchUserData();
        }
    }

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-yt-white dark:bg-yt-light-black w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-scale-in border border-yt-spec-light-20 dark:border-yt-spec-20" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-4 border-b border-yt-spec-light-20 dark:border-yt-spec-20 flex justify-between items-center bg-yt-light/30 dark:bg-black/20">
                    <h2 className="text-lg font-bold text-black dark:text-white flex items-center gap-2">
                        <UserIcon /> {user ? 'アカウント' : (mode === 'login' ? 'ログイン' : '新規登録')}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-20 transition-colors">
                        <CloseIcon />
                    </button>
                </div>

                <div className="p-6">
                    {user ? (
                        /* Logged In View */
                        <div className="flex flex-col gap-6">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-yt-blue rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3">
                                    {user.id.charAt(0).toUpperCase()}
                                </div>
                                <p className="text-xl font-bold text-black dark:text-white">{user.id}</p>
                                <p className="text-sm text-yt-light-gray">ログイン中</p>
                            </div>

                            <div className="space-y-3">
                                <button 
                                    onClick={handleSync}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? '処理中...' : <><SaveIcon /> データ同期 (クラウドへ保存)</>}
                                </button>

                                <button 
                                    onClick={handleReload}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? '処理中...' : <><RepeatIcon /> 再読み込み (クラウドから取得)</>}
                                </button>
                                
                                <button 
                                    onClick={logout}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-yt-light dark:bg-yt-spec-10 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-bold transition-colors"
                                >
                                    <LogoutIcon /> ログアウト
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Guest View (Login/Signup) */
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {(authError || localError) && (
                                <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg text-sm">
                                    {localError || authError}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-yt-light-gray mb-1 uppercase">ユーザーID</label>
                                <input 
                                    type="text" 
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg bg-yt-light dark:bg-black/40 border border-transparent focus:border-yt-blue outline-none text-black dark:text-white transition-colors"
                                    placeholder="ユーザーIDを入力"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-yt-light-gray mb-1 uppercase">パスワード</label>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg bg-yt-light dark:bg-black/40 border border-transparent focus:border-yt-blue outline-none text-black dark:text-white transition-colors"
                                    placeholder="パスワードを入力"
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isLoading}
                                className="mt-2 w-full py-3 rounded-lg bg-yt-blue text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {isLoading ? '処理中...' : (mode === 'login' ? 'ログイン' : 'アカウント作成')}
                            </button>

                            <div className="mt-2 text-center">
                                <button 
                                    type="button"
                                    onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setLocalError(null); }}
                                    className="text-sm text-yt-light-gray hover:text-yt-blue underline"
                                >
                                    {mode === 'login' ? 'アカウントをお持ちでない方はこちら' : 'すでにアカウントをお持ちの方はこちら'}
                                </button>
                            </div>
                        </form>
                    )}
                    
                    <div className="mt-6 text-center">
                        <p className="text-[10px] text-yt-light-gray opacity-50">
                            ユーザーに関する責任は一切取ることができません
                        </p>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AccountModal;
