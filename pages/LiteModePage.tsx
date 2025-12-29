
import React, { useState, useRef, useEffect } from 'react';
import { usePreference } from '../contexts/PreferenceContext';
import { getRawStreamData, getPlayerConfig, API_BASE_URL } from '../utils/api';

const LiteModePage: React.FC = () => {
    const { toggleLiteMode } = usePreference();
    const [urlInput, setUrlInput] = useState('');
    const [videoId, setVideoId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState<'embed' | 'stream' | 'download' | null>(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [streamData, setStreamData] = useState<any | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    
    const [activeView, setActiveView] = useState<'none' | 'player' | 'download'>('none');
    
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const progressInterval = useRef<any>(null);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const extractYouTubeVideoId = (url: string) => {
        const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        return match ? match[1] : null;
    };

    const startFakeProgress = () => {
        setProgress(0);
        if (progressInterval.current) clearInterval(progressInterval.current);
        progressInterval.current = setInterval(() => {
            setProgress(prev => {
                if (prev < 95) {
                    const next = prev + Math.floor(Math.random() * 5) + 1;
                    return next > 95 ? 95 : next;
                }
                return prev;
            });
        }, 200);
    };

    const stopFakeProgress = () => {
        if (progressInterval.current) clearInterval(progressInterval.current);
        setProgress(100);
    };

    const handleAction = async (actionType: 'embed' | 'stream' | 'download') => {
        const vId = extractYouTubeVideoId(urlInput);
        if (!vId) {
            setError('無効なYouTubeリンクです。');
            setActiveView('none');
            return;
        }

        if (vId !== videoId) {
            setStreamData(null);
            setVideoId(vId);
        }

        setError(null);
        setIsLoading(true);
        setLoadingAction(actionType);
        startFakeProgress();

        try {
            if (actionType === 'embed') {
                setActiveView('player');
                // Construct Invidious URL and use direct link as requested
                const embedUrl = `https://invidious.nerdvpn.de/embed/${vId}`;
                
                if (playerContainerRef.current) {
                    playerContainerRef.current.innerHTML = `<iframe width="100%" height="100%" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="aspect-ratio: 16/9; border-radius: 8px;"></iframe>`;
                }
            } else {
                let data = streamData;
                
                if (!data || vId !== videoId) {
                    try {
                        data = await getRawStreamData(vId);
                        setStreamData(data);
                    } catch (fetchErr) {
                        throw new Error('オフラインです。キャッシュされたデータが見つかりませんでした。');
                    }
                }

                if (actionType === 'stream') {
                    setActiveView('player');
                    setTimeout(() => createStreamPlayer(data, playerContainerRef.current), 0);
                } else if (actionType === 'download') {
                    setActiveView('download');
                }
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'エラーが発生しました');
            setActiveView('none');
        } finally {
            stopFakeProgress();
            setTimeout(() => {
                setIsLoading(false);
                setLoadingAction(null);
            }, 500);
        }
    };

    const createStreamPlayer = (data: any, container: HTMLDivElement | null) => {
        if (!container) return;
        
        container.innerHTML = '';

        let url = data.streamingUrl; 
        
        if (!url && data.combinedFormats) {
            const format = data.combinedFormats.find((f: any) => f.quality === '360p' || f.quality === '720p');
            if (format) url = format.url;
        }

        if (!url) {
            setError('ストリーミング可能な動画ソースが見つかりませんでした。');
            return;
        }

        // Use direct URL instead of proxy as requested
        const videoSrc = url;

        const video = document.createElement('video');
        video.setAttribute('data-v-a03ccfac', ''); 
        video.controls = true;
        video.autoplay = true;
        video.style.width = "100%";
        video.style.borderRadius = "8px";
        video.style.aspectRatio = "16/9";
        video.style.backgroundColor = "#000";
        video.src = videoSrc;
        video.setAttribute('type', 'application/x-mpegURL');
        
        container.appendChild(video);
        video.play().catch(e => console.warn("Autoplay prevented:", e));
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setUrlInput(text);
        } catch (err) { console.error('クリップボードの読み取りに失敗しました。', err); }
    };

    return (
        <div className="min-h-screen bg-[#f7f8fa] flex flex-col items-center justify-center p-4 font-sans text-[#333]">
            <div className="bg-white shadow-[0_4px_32px_rgba(0,0,0,0.08)] rounded-[18px] p-8 md:p-10 w-full max-w-[680px] text-center relative overflow-hidden">
                {!isOnline && (
                    <div className="absolute top-0 left-0 right-0 bg-gray-500 text-white text-xs font-bold py-1">
                        オフラインモード (キャッシュ利用可能)
                    </div>
                )}
                <div className="text-[2.6rem] font-bold text-[#3c3e4e] mb-2 tracking-wide mt-2">XeroxYT LiteV2</div>
                <div className="text-[#667085] text-[1.05rem] mb-2">動画を高画質・高速で再生・ダウンロード</div>
                <div className="text-[#667085] text-sm mb-8">ストリーミング・ダウンロードは360p固定になっています</div>
                <div className="flex flex-col md:flex-row gap-2 mb-4 w-full">
                    <input 
                        type="text" 
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="YouTubeのURLを入力" 
                        className="flex-1 p-3 border-[1.5px] border-[#e0e3eb] rounded-[10px] text-[1.1rem] outline-none focus:border-[#7c3aed] transition-colors text-black"
                    />
                    <div className="flex gap-2">
                        <button onClick={handlePaste} className="bg-[#e0e3eb] border-none rounded-[8px] px-4 py-2 text-[1.1rem] cursor-pointer text-[#555] hover:bg-[#ccc] hover:text-black min-w-[80px]">Paste</button>
                        <button onClick={() => { setUrlInput(''); setActiveView('none'); setError(null); }} className="bg-[#e0e3eb] border-none rounded-[8px] px-4 py-2 text-[1.1rem] cursor-pointer text-[#555] hover:bg-[#ccc] hover:text-black">×</button>
                    </div>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-6">
                    <button 
                        onClick={() => handleAction('embed')} 
                        className="bg-[#7c3aed] text-white border-none rounded-[8px] px-6 py-3 text-[1.1rem] font-semibold cursor-pointer shadow-[0_2px_8px_rgba(124,58,237,0.06)] hover:bg-[#5e3fd7] disabled:opacity-50"
                    >
                        {isLoading && loadingAction === 'embed' ? `処理中... ${progress}%` : 'youtube player'}
                    </button>
                    <button 
                        onClick={() => handleAction('stream')} 
                        disabled={isLoading}
                        className="bg-[#7c3aed] text-white border-none rounded-[8px] px-6 py-3 text-[1.1rem] font-semibold cursor-pointer shadow-[0_2px_8px_rgba(124,58,237,0.06)] hover:bg-[#5e3fd7] disabled:opacity-50"
                    >
                        {isLoading && loadingAction === 'stream' ? `処理中... ${progress}%` : 'ストリーミング'}
                    </button>
                    <button 
                        onClick={() => handleAction('download')} 
                        disabled={isLoading}
                        className="bg-[#10b981] text-white border-none rounded-[8px] px-6 py-3 text-[1.1rem] font-semibold cursor-pointer shadow-[0_2px_8px_rgba(16,185,129,0.06)] hover:bg-[#059669] disabled:opacity-50"
                    >
                        {isLoading && loadingAction === 'download' ? `処理中... ${progress}%` : 'ダウンロード'}
                    </button>
                </div>
                {error && <div className="text-[#d32f2f] mt-4 text-[0.97em] bg-red-50 p-2 rounded">{error}</div>}
                <div ref={playerContainerRef} className={`mt-6 w-full ${activeView === 'player' ? 'block' : 'hidden'}`}></div>
                {activeView === 'download' && streamData && (
                    <div className="mt-8 text-left">
                        <h3 className="text-center text-[#3c3e4e] text-xl font-bold mb-4">Download Links</h3>
                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                            {streamData.separate1080p?.video?.url && (
                                <a href={streamData.separate1080p.video.url} target="_blank" rel="noreferrer" className="block bg-[#f7f8fa] border-[1.5px] border-[#e0e3eb] rounded-[8px] p-3 text-[#333] font-medium hover:bg-[#e9ecf0] transition-colors break-all">
                                    Download Video 1080p (映像のみ) (MP4)
                                </a>
                            )}
                            {streamData.combinedFormats && streamData.combinedFormats.map((format: any, index: number) => {
                                const quality = format.quality || 'Unknown';
                                const url = format.url;
                                if (!url) return null;
                                return (
                                    <a key={index} href={url} target="_blank" rel="noreferrer" className="block bg-[#f7f8fa] border-[1.5px] border-[#e0e3eb] rounded-[8px] p-3 text-[#333] font-medium hover:bg-[#e9ecf0] transition-colors break-all">
                                        Download Video {quality} (音声あり) (MP4)
                                    </a>
                                );
                            })}
                            {streamData.audioOnlyFormat?.url && (
                                <>
                                    <h4 className="mt-4 font-bold text-[#333]">オーディオ (音声のみ)</h4>
                                    <a href={streamData.audioOnlyFormat.url} target="_blank" rel="noreferrer" className="block bg-[#f7f8fa] border-[1.5px] border-[#e0e3eb] rounded-[8px] p-3 text-[#333] font-medium hover:bg-[#e9ecf0] transition-colors break-all">
                                        Download Audio {streamData.audioOnlyFormat.quality || ''} (M4A)
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                )}
                <div className="mt-12 pt-6 border-t border-[#e0e3eb]">
                    <button onClick={toggleLiteMode} className="text-[#667085] hover:text-[#333] underline cursor-pointer text-sm">通常モードに戻る</button>
                </div>
            </div>
        </div>
    );
};

export default LiteModePage;
