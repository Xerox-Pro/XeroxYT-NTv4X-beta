
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import VideoGrid from '../components/VideoGrid';
import ShortsShelf from '../components/ShortsShelf';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { useHistory } from '../contexts/HistoryContext';
import { usePreference } from '../contexts/PreferenceContext';
import { getXraiRecommendations } from '../utils/recommendation';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import type { Video } from '../types';
import { SearchIcon, SaveIcon, DownloadIcon, RepeatIcon } from '../components/icons/Icons';

const MAX_FEED_VIDEOS = 1200; 
const CACHE_KEY = 'home_feed_cache';
const CACHE_DURATION = 20 * 60 * 1000; // 20 minutes

const HomePage: React.FC = () => {
    const [feed, setFeed] = useState<Video[]>([]);
    const [shortsFeed, setShortsFeed] = useState<Video[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasNextPage, setHasNextPage] = useState(true);
    
    const seenIdsRef = useRef<Set<string>>(new Set());
    const feedLengthRef = useRef(0);

    const { subscribedChannels } = useSubscription();
    const { searchHistory } = useSearchHistory();
    const { history: watchHistory, shortsHistory } = useHistory();
    const { ngKeywords, ngChannels, hiddenVideos, negativeKeywords, exportUserData, importUserData } = usePreference();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        feedLengthRef.current = feed.length;
    }, [feed.length]);

    const isNewUser = useMemo(() => {
        const hasSubscriptions = subscribedChannels.length > 1;
        const hasSearchHistory = searchHistory.length > 0;
        const hasWatchHistory = watchHistory.length > 0;
        return !(hasSubscriptions || hasSearchHistory || hasWatchHistory);
    }, [subscribedChannels, searchHistory, watchHistory]);

    // Save to Cache when feed updates (only if it's the first page)
    useEffect(() => {
        if (feed.length > 0 && page === 1 && !isLoading) {
            const cacheData = {
                timestamp: Date.now(),
                feed,
                shortsFeed
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        }
    }, [feed, shortsFeed, page, isLoading]);

    const loadRecommendations = useCallback(async (pageNum: number, forceRefresh = false) => {
        if (feedLengthRef.current >= MAX_FEED_VIDEOS) {
            setHasNextPage(false);
            setIsFetchingMore(false);
            return;
        }

        const isInitial = pageNum === 1;
        
        // --- Cache Logic ---
        if (isInitial && !forceRefresh) {
            try {
                const cachedRaw = localStorage.getItem(CACHE_KEY);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    const now = Date.now();
                    if (now - cached.timestamp < CACHE_DURATION && cached.feed && cached.feed.length > 0) {
                        setFeed(cached.feed);
                        setShortsFeed(cached.shortsFeed || []);
                        cached.feed.forEach((v: Video) => seenIdsRef.current.add(v.id));
                        setIsLoading(false);
                        return; // Exit, use cache
                    }
                }
            } catch (e) {
                console.error("Cache read error", e);
            }
        }
        // -------------------

        if (isInitial) setIsLoading(true);
        else setIsFetchingMore(true);
        
        try {
            let newVideos: Video[] = [];
            let newShorts: Video[] = [];

            const xraiRes = await getXraiRecommendations({
                searchHistory, watchHistory, shortsHistory, subscribedChannels,
                ngKeywords, ngChannels, hiddenVideos, negativeKeywords,
                page: pageNum
            });
            newVideos = xraiRes.videos;
            newShorts = xraiRes.shorts;
            
            if (newVideos.length === 0 && pageNum > 1) {
                setHasNextPage(false);
                setIsFetchingMore(false);
                return;
            }
            
            const uniqueNewVideos = newVideos.filter(v => !seenIdsRef.current.has(v.id));
            uniqueNewVideos.forEach(v => seenIdsRef.current.add(v.id));

            if (isInitial) {
                setFeed(uniqueNewVideos);
                setShortsFeed(newShorts);
            } else {
                setFeed(prev => {
                    const combined = [...prev, ...uniqueNewVideos];
                    if (combined.length >= MAX_FEED_VIDEOS) {
                         setHasNextPage(false);
                         return combined.slice(0, MAX_FEED_VIDEOS);
                    }
                    return combined;
                });
            }

        } catch (err: any) {
            if (isInitial) setError(err.message || '動画の読み込みに失敗しました。');
            console.error(err);
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [subscribedChannels, searchHistory, watchHistory, shortsHistory, ngKeywords, ngChannels, hiddenVideos, negativeKeywords]);

    useEffect(() => {
        setPage(1);
        // Only reset if we are NOT using cache in loadRecommendations (handled inside)
        // But seenIdsRef needs to be cleared if we are doing a fresh logic run
        // We defer this clear to inside loadRecommendations if not using cache.
        // Actually simpler: Just call load(1).
        loadRecommendations(1);
    }, []); // Run once on mount
    
    const handleRefresh = () => {
        setPage(1);
        setFeed([]);
        setShortsFeed([]);
        seenIdsRef.current.clear();
        setError(null);
        setHasNextPage(true);
        feedLengthRef.current = 0;
        localStorage.removeItem(CACHE_KEY); // Clear cache
        loadRecommendations(1, true); // Force refresh
    };

    const loadMore = () => {
        if (!isFetchingMore && !isLoading && hasNextPage && feedLengthRef.current < MAX_FEED_VIDEOS) {
            const nextPage = page + 1;
            setPage(nextPage);
            loadRecommendations(nextPage);
        }
    };

    const lastElementRef = useInfiniteScroll(loadMore, hasNextPage, isFetchingMore || isLoading);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await importUserData(file);
        }
    };

    if (isNewUser && feed.length === 0 && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in">
                <div className="bg-yt-light dark:bg-yt-spec-10 p-6 rounded-full mb-6">
                    <SearchIcon />
                </div>
                <h2 className="text-2xl font-bold mb-4 text-black dark:text-white">まずは動画を探してみましょう</h2>
                <p className="text-yt-light-gray text-base max-w-lg mb-8 leading-relaxed">
                    検索してチャンネル登録したり、動画を閲覧すると、<br />
                    ここにあなたへのおすすめ動画が表示されるようになります。<br />
                    <br />
                    上の検索バーから、好きなキーワードで検索してみてください！
                </p>
                <div className="flex gap-4">
                    <button 
                        onClick={() => exportUserData()}
                        className="flex items-center gap-2 px-4 py-2 bg-yt-light dark:bg-yt-spec-10 rounded-lg hover:bg-gray-200 dark:hover:bg-yt-spec-20 transition-colors text-sm font-medium"
                    >
                        <DownloadIcon />
                        設定をエクスポート
                    </button>
                    <button 
                        onClick={handleImportClick}
                        className="flex items-center gap-2 px-4 py-2 bg-yt-light dark:bg-yt-spec-10 rounded-lg hover:bg-gray-200 dark:hover:bg-yt-spec-20 transition-colors text-sm font-medium"
                    >
                        <SaveIcon />
                        データを復元
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleFileChange} 
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="pb-10 pt-4">
            {/* Header / Refresh Button */}
            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xl font-bold hidden sm:block">おすすめ</h2>
                <button 
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-3 py-1.5 bg-yt-light dark:bg-yt-spec-10 hover:bg-gray-200 dark:hover:bg-yt-spec-20 rounded-full text-sm font-medium transition-colors ml-auto"
                >
                    <RepeatIcon className="w-4 h-4" />
                    おすすめを再取得
                </button>
            </div>

            {error && <div className="text-red-500 text-center mb-4">{error}</div>}
            
            {(shortsFeed.length > 0) && (
                <div className="mb-8">
                    <ShortsShelf shorts={shortsFeed} isLoading={isLoading && shortsFeed.length === 0} />
                    <hr className="border-yt-spec-light-20 dark:border-yt-spec-20 mt-6" />
                </div>
            )}

            <VideoGrid videos={feed} isLoading={isLoading && feed.length === 0} />

            {isFetchingMore && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8 mt-8">
                    {Array.from({ length: 10 }).map((_, index) => (
                         <div key={index} className="flex flex-col animate-pulse">
                            <div className="w-full aspect-video bg-yt-light dark:bg-yt-dark-gray rounded-xl mb-3"></div>
                            <div className="flex gap-3">
                                <div className="w-9 h-9 rounded-full bg-yt-light dark:bg-yt-dark-gray"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-yt-light dark:bg-yt-dark-gray rounded w-3/4"></div>
                                    <div className="h-4 bg-yt-light dark:bg-yt-dark-gray rounded w-1/2"></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!isLoading && hasNextPage && (
                <div ref={lastElementRef} className="h-20 flex justify-center items-center">
                     {feed.length >= MAX_FEED_VIDEOS && (
                        <p className="text-yt-light-gray text-sm">これ以上の動画は表示されません（上限到達）</p>
                     )}
                </div>
            )}
        </div>
    );
};

export default HomePage;
