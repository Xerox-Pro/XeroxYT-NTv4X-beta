
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { getVideoDetails, getPlayerConfig, getComments, getVideosByIds, getRawStreamData } from '../utils/api';
import type { VideoDetails, Video, Comment, Channel, CommentResponse } from '../types';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useHistory } from '../contexts/HistoryContext';
import { usePlaylist } from '../contexts/PlaylistContext';
import { usePreference } from '../contexts/PreferenceContext';
import VideoPlayerPageSkeleton from '../components/skeletons/VideoPlayerPageSkeleton';
import PlaylistModal from '../components/PlaylistModal';
import DownloadModal from '../components/DownloadModal';
import CommentComponent from '../components/Comment';
import PlaylistPanel from '../components/PlaylistPanel';
import RelatedVideoCard from '../components/RelatedVideoCard';
import { LikeIcon, SaveIcon, DownloadIcon, DislikeIcon, ChevronRightIcon, TuneIcon, SpeedIcon, ChatIcon, ShareIcon } from '../components/icons/Icons';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import HlsVideoPlayer from '../components/HlsVideoPlayer';

const TheaterIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className="fill-current text-black dark:text-white">
        <path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8z"/>
    </svg>
);

const VideoPlayerPage: React.FC = () => {
    const { videoId } = useParams<{ videoId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const playlistId = searchParams.get('list');

    const initialVideo = location.state?.video as Video | undefined;

    const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    
    const [isCommentsLoading, setIsCommentsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
    const [playlistVideos, setPlaylistVideos] = useState<Video[]>([]);
    const [isCollaboratorMenuOpen, setIsCollaboratorMenuOpen] = useState(false);
    const collaboratorMenuRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    const [commentsContinuation, setCommentsContinuation] = useState<string | undefined>(undefined);
    const [isFetchingMoreComments, setIsFetchingMoreComments] = useState(false);
    
    const [isControlsOpen, setIsControlsOpen] = useState(false);
    const controlsRef = useRef<HTMLDivElement>(null);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [transposeLevel, setTransposeLevel] = useState(0); 
    
    const [showLiveChat, setShowLiveChat] = useState(false);
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const [commentSort, setCommentSort] = useState<'top' | 'newest'>('top');
    const [playerParams, setPlayerParams] = useState<string>('');

    const [isShuffle, setIsShuffle] = useState(searchParams.get('shuffle') === '1');
    const [isLoop, setIsLoop] = useState(searchParams.get('loop') === '1');

    const [shuffledVideos, setShuffledVideos] = useState<Video[]>([]);
    const shuffleSeedRef = useRef<string | null>(null);

    const { defaultPlayerMode, setDefaultPlayerMode } = usePreference();
    const [streamData, setStreamData] = useState<any>(null);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isStreamDataLoading, setIsStreamDataLoading] = useState(false);
    
    const { isSubscribed, subscribe, unsubscribe } = useSubscription();
    const { addVideoToHistory } = useHistory();
    const { playlists, reorderVideosInPlaylist } = usePlaylist();

    const currentPlaylist = useMemo(() => {
        if (!playlistId) return null;
        return playlists.find(p => p.id === playlistId) || null;
    }, [playlistId, playlists]);

    useEffect(() => {
        setIsShuffle(searchParams.get('shuffle') === '1');
        setIsLoop(searchParams.get('loop') === '1');
    }, [searchParams]);
    
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const paramsString = await getPlayerConfig();
                const params = new URLSearchParams(paramsString);
                params.set('autoplay', '1');
                setPlayerParams(params.toString());
            } catch (error) {
                console.error("Failed to fetch player config, using defaults", error);
                setPlayerParams('autoplay=1&rel=0');
            }
        };
        fetchConfig();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (collaboratorMenuRef.current && !collaboratorMenuRef.current.contains(event.target as Node)) {
                setIsCollaboratorMenuOpen(false);
            }
            if (controlsRef.current && !controlsRef.current.contains(event.target as Node)) {
                setIsControlsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== "https://www.youtube.com" && event.origin !== "https://www.youtubeeducation.com") return;

            try {
                const data = JSON.parse(event.data);
                if (data.event === 'infoDelivery' && data.info?.videoData?.videoId) {
                    const newId = data.info.videoData.videoId;
                    if (newId && newId !== videoId) {
                        const newParams = new URLSearchParams(searchParams);
                        navigate(`/watch/${newId}?${newParams.toString()}`, { replace: true });
                    }
                }
            } catch (e) {}
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [videoId, searchParams, navigate]);

    useEffect(() => {
        const fetchPlaylistVideos = async () => {
            if (currentPlaylist) {
                if (currentPlaylist.videoIds.length > 0) {
                    const fetchedVideos = await getVideosByIds(currentPlaylist.videoIds);
                    const videoMap = new Map(fetchedVideos.map(v => [v.id, v]));
                    const orderedVideos = currentPlaylist.videoIds.map(id => videoMap.get(id)).filter((v): v is Video => !!v);
                    setPlaylistVideos(orderedVideos);
                } else {
                    setPlaylistVideos([]);
                }
            } else {
                 setPlaylistVideos([]);
            }
        };
        fetchPlaylistVideos();
    }, [currentPlaylist]);

    useEffect(() => {
        if (!isShuffle || !playlistId) {
            setShuffledVideos([]);
            shuffleSeedRef.current = null;
            return;
        }
        if (shuffleSeedRef.current === playlistId && shuffledVideos.length > 0) {
            return;
        }
        if (playlistVideos.length > 0) {
            const currentIndex = playlistVideos.findIndex(v => v.id === videoId);
            const newOrder = [...playlistVideos];
            if (currentIndex !== -1) {
                const current = newOrder[currentIndex];
                newOrder.splice(currentIndex, 1);
                newOrder.sort(() => Math.random() - 0.5);
                newOrder.unshift(current);
            } else {
                 newOrder.sort(() => Math.random() - 0.5);
            }
            setShuffledVideos(newOrder);
            shuffleSeedRef.current = playlistId;
        }
    }, [isShuffle, playlistVideos, videoId, playlistId, shuffledVideos.length]);

    const fetchStreamDataIfNeeded = useCallback(async () => {
        if (streamData || !videoId || isStreamDataLoading) return;
        setIsStreamDataLoading(true);
        try {
            const data = await getRawStreamData(videoId);
            setStreamData(data);
        } catch (e) {
            console.error("Failed to fetch stream data", e);
        } finally {
            setIsStreamDataLoading(false);
        }
    }, [videoId, streamData, isStreamDataLoading]);

    useEffect(() => {
        if (defaultPlayerMode === 'stream' && videoId) {
            fetchStreamDataIfNeeded();
        }
    }, [defaultPlayerMode, videoId, fetchStreamDataIfNeeded]);

    useEffect(() => {
        let isMounted = true;
        
        if (initialVideo && initialVideo.id === videoId) {
             setVideoDetails({
                ...initialVideo,
                description: '',
                likes: '',
                dislikes: '',
                channel: {
                    id: initialVideo.channelId,
                    name: initialVideo.channelName,
                    avatarUrl: initialVideo.channelAvatarUrl,
                    subscriberCount: ''
                },
                relatedVideos: [],
                isLive: initialVideo.isLive || false
            } as VideoDetails);
            setIsLoading(false);
        } else {
            setVideoDetails(null);
            setIsLoading(true);
        }
        
        setError(null);
        setComments([]);
        setCommentsContinuation(undefined);
        setRelatedVideos([]);
        setStreamData(null);
        setIsDownloadModalOpen(false);
        setIsCommentsLoading(true);
        setShowLiveChat(false); 
        setPlaybackSpeed(1.0);
        setTransposeLevel(0);
        setCommentSort('top'); 
        window.scrollTo(0, 0);

        const fetchVideoData = async () => {
            if (!videoId) return;

            getVideoDetails(videoId)
                .then(details => {
                    if (isMounted) {
                        if (initialVideo && initialVideo.id === videoId && initialVideo.views && (details.views === '0回視聴' || details.views === '視聴回数不明' || details.views === '0回' || details.views.startsWith('0'))) {
                             details.views = initialVideo.views;
                        }

                        setVideoDetails(details);
                        if(details.isLive) setShowLiveChat(true); 
                        
                        if (details.relatedVideos && details.relatedVideos.length > 0) {
                            setRelatedVideos(details.relatedVideos);
                        }
                        addVideoToHistory(details);
                        setIsLoading(false);
                    }
                })
                .catch(err => {
                    if (isMounted) {
                        setVideoDetails(prev => {
                            if (!prev) {
                                setError(err.message || '動画の読み込みに失敗しました。');
                            }
                            return prev;
                        });
                        setIsLoading(false);
                    }
                });

            const loadComments = async () => {
                try {
                    let accComments: Comment[] = [];
                    let token: string | undefined = undefined;
                    
                    const res1 = await getComments(videoId, 'top');
                    accComments = res1.comments;
                    token = res1.continuation;

                    while (accComments.length < 50 && token && isMounted) {
                        const resNext: CommentResponse = await getComments(videoId, 'top', token);
                        if (!resNext.comments || resNext.comments.length === 0) break;
                        accComments = [...accComments, ...resNext.comments];
                        token = resNext.continuation;
                    }

                    if (isMounted) {
                        setComments(accComments);
                        setCommentsContinuation(token);
                    }
                } catch (err) {
                    console.warn("Failed to fetch comments", err);
                } finally {
                    if (isMounted) setIsCommentsLoading(false);
                }
            };
            
            loadComments();
        };
        fetchVideoData();
        return () => { isMounted = false; };
    }, [videoId, addVideoToHistory]); 
    
    const fetchMoreComments = useCallback(async () => {
        if (!videoId || !commentsContinuation || isFetchingMoreComments) return;
        setIsFetchingMoreComments(true);
        try {
            const res = await getComments(videoId, commentSort, commentsContinuation);
            setComments(prev => [...prev, ...res.comments]);
            setCommentsContinuation(res.continuation);
        } catch (e) {
            console.error("Failed to load more comments", e);
        } finally {
            setIsFetchingMoreComments(false);
        }
    }, [videoId, commentsContinuation, isFetchingMoreComments, commentSort]);

    const commentsLoaderRef = useInfiniteScroll(fetchMoreComments, !!commentsContinuation, isFetchingMoreComments);

    const handleCommentSortChange = (newSort: 'top' | 'newest') => {
        if (newSort === commentSort || !videoId) return;
        setCommentSort(newSort);
        setIsCommentsLoading(true);
        setComments([]);
        setCommentsContinuation(undefined);
        getComments(videoId, newSort)
            .then(res => {
                setComments(res.comments);
                setCommentsContinuation(res.continuation);
            })
            .catch(e => console.error(e))
            .finally(() => setIsCommentsLoading(false));
    };

    const navigateToNextVideo = useCallback(() => {
        if (!currentPlaylist || playlistVideos.length === 0) return;
        const currentList = isShuffle ? shuffledVideos : playlistVideos;
        if (currentList.length === 0) return;
        const currentIndex = currentList.findIndex(v => v.id === videoId);
        let nextIndex = currentIndex !== -1 ? currentIndex + 1 : 0;
        if (nextIndex >= currentList.length) {
            if (isLoop) nextIndex = 0; else return;
        }
        const nextVideo = currentList[nextIndex];
        if (nextVideo) {
             const newParams = new URLSearchParams(searchParams);
             if (isShuffle) newParams.set('shuffle', '1');
             if (isLoop) newParams.set('loop', '1');
             navigate(`/watch/${nextVideo.id}?${newParams.toString()}`);
        }
    }, [currentPlaylist, playlistVideos, isShuffle, shuffledVideos, videoId, isLoop, navigate, searchParams]);

    const iframeSrc = useMemo(() => {
        if (!videoDetails?.id || !playerParams) return '';
        
        let src = `https://www.youtubeeducation.com/embed/${videoDetails.id}`;
        let params = playerParams.startsWith('?') ? playerParams.substring(1) : playerParams;
        if (!params.includes('enablejsapi')) params += '&enablejsapi=1';
        if (!params.includes('origin')) params += `&origin=${encodeURIComponent(window.location.origin)}`;
        if (!params.includes('autoplay')) params += '&autoplay=1';

        const activeList = isShuffle ? shuffledVideos : playlistVideos;
        
        if (activeList.length > 0) {
            const currentIndex = activeList.findIndex(v => v.id === videoId);
            if (currentIndex !== -1) {
                const nextVideos = activeList.slice(currentIndex + 1);
                let playlistIds: string[] = [];
                
                if (isLoop) {
                    const prevVideos = activeList.slice(0, currentIndex);
                    playlistIds = [...nextVideos, ...prevVideos, activeList[currentIndex]].map(v => v.id).slice(0, 100);
                } else {
                    playlistIds = nextVideos.map(v => v.id).slice(0, 100);
                }

                if (playlistIds.length > 0) {
                    params += `&playlist=${playlistIds.join(',')}`;
                }
            }
        } else {
            if (isLoop) {
                params += `&playlist=${videoDetails.id}`;
            }
        }
        
        if (isLoop) {
             if (!params.includes('loop=1')) params += '&loop=1';
        }

        return `${src}?${params}`;
    }, [videoDetails, playerParams, isLoop, isShuffle, playlistVideos, shuffledVideos, videoId]);

    const updateUrlParams = (key: string, value: string | null) => {
        const newSearchParams = new URLSearchParams(searchParams);
        if (value === null) newSearchParams.delete(key);
        else newSearchParams.set(key, value);
        setSearchParams(newSearchParams, { replace: true });
    };

    const toggleShuffle = () => {
        const newShuffleState = !isShuffle;
        setIsShuffle(newShuffleState);
        updateUrlParams('shuffle', newShuffleState ? '1' : null);
        if (newShuffleState) shuffleSeedRef.current = null;
    };

    const toggleLoop = () => {
        const newLoopState = !isLoop;
        setIsLoop(newLoopState);
        updateUrlParams('loop', newLoopState ? '1' : null);
    };

    const handlePlaylistReorder = (startIndex: number, endIndex: number) => {
        if (!playlistId) return;
        reorderVideosInPlaylist(playlistId, startIndex, endIndex);
    };

    const handleDownloadClick = () => {
        setIsDownloadModalOpen(true);
        if (!streamData && !isStreamDataLoading) {
            fetchStreamDataIfNeeded();
        }
    };

    const handleShareClick = () => {
        navigator.clipboard.writeText(window.location.href);
        alert('リンクをコピーしました');
    };
    
    const applyPlaybackSettings = (speed: number, transpose: number) => {
        setPlaybackSpeed(speed);
        setTransposeLevel(transpose);

        if (defaultPlayerMode === 'player' && iframeRef.current && iframeRef.current.contentWindow) {
            const targetSpeed = Math.min(Math.max(speed, 0.25), 2.0); 
            iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: 'setPlaybackRate', args: [targetSpeed] }), '*'
            );
        }
    };

    const handleSpeedChange = (val: number) => applyPlaybackSettings(val, transposeLevel);

    if (isLoading) return <VideoPlayerPageSkeleton />;
    if (error && !videoDetails) return <div className="p-4 text-center text-red-500">{error}</div>;
    if (!videoDetails) return null;
    
    const mainChannel = videoDetails.collaborators && videoDetails.collaborators.length > 0 ? videoDetails.collaborators[0] : videoDetails.channel;
    const subscribed = isSubscribed(mainChannel.id);
    const handleSubscriptionToggle = () => subscribed ? unsubscribe(mainChannel.id) : subscribe(mainChannel);

    const videoForPlaylistModal: Video = {
      id: videoDetails.id, title: videoDetails.title, thumbnailUrl: videoDetails.thumbnailUrl,
      channelName: mainChannel.name, channelId: mainChannel.id, duration: videoDetails.duration, isoDuration: videoDetails.isoDuration,
      views: videoDetails.views, uploadedAt: videoDetails.uploadedAt, channelAvatarUrl: mainChannel.avatarUrl,
    };

    const hasCollaborators = videoDetails.collaborators && videoDetails.collaborators.length > 1;
    const collaboratorsList = videoDetails.collaborators || [];
    const commentCountDisplay = videoDetails.commentCount ? videoDetails.commentCount + '件のコメント' : (comments.length > 0 ? `${comments.length.toLocaleString()}件以上のコメント` : 'コメント');

    return (
        <div className={`flex flex-col gap-6 mx-auto pt-2 md:pt-6 px-4 md:px-6 justify-center ${isTheaterMode ? 'w-full max-w-full' : 'max-w-[1750px] lg:flex-row'}`}>
            <div className={`flex-1 min-w-0 ${isTheaterMode ? 'max-w-full' : 'max-w-full'}`}>
                <div className={`w-full bg-yt-black rounded-xl overflow-hidden shadow-lg relative z-10 ${isTheaterMode ? 'h-[75vh]' : 'aspect-video'}`}>
                    {defaultPlayerMode === 'player' ? (
                        playerParams && videoId && (
                            <iframe ref={iframeRef} src={iframeSrc} key={iframeSrc} title={videoDetails.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
                        )
                    ) : (
                        streamData?.streamingUrl ? (
                            <HlsVideoPlayer 
                                src={streamData.streamingUrl} 
                                autoPlay 
                                className="w-full h-full"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-white gap-4 bg-black">
                                {isStreamDataLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white"></div>
                                        <p>ストリームを準備中...</p>
                                    </>
                                ) : (
                                    <>
                                        <p>ストリームの読み込みに失敗しました。</p>
                                        <button onClick={fetchStreamDataIfNeeded} className="px-4 py-2 bg-yt-blue rounded-full">再試行</button>
                                    </>
                                )}
                            </div>
                        )
                    )}
                </div>

                <div className="">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mt-3 mb-2">
                         <h1 className="text-lg md:text-xl font-bold text-black dark:text-white break-words flex-1">{videoDetails.title}</h1>
                        <div className="flex bg-yt-light dark:bg-yt-light-black rounded-lg p-1 flex-shrink-0 self-start">
                            <button className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${defaultPlayerMode === 'player' ? 'bg-white dark:bg-yt-spec-20 text-black dark:text-white shadow-sm' : 'text-yt-light-gray hover:text-black dark:hover:text-white'}`} onClick={() => setDefaultPlayerMode('player')}>Player</button>
                            <button className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${defaultPlayerMode === 'stream' ? 'bg-white dark:bg-yt-spec-20 text-black dark:text-white shadow-sm' : 'text-yt-light-gray hover:text-black dark:hover:text-white'}`} onClick={() => setDefaultPlayerMode('stream')}>Stream</button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="flex items-center min-w-0">
                                <Link to={`/channel/${mainChannel.id}`} className="flex-shrink-0">
                                    <img 
                                        src={mainChannel.avatarUrl || 'https://www.gstatic.com/youtube/img/creator/avatar/default_64.svg'} 
                                        alt={mainChannel.name} 
                                        className="w-10 h-10 rounded-full object-cover" 
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://www.gstatic.com/youtube/img/creator/avatar/default_64.svg';
                                        }}
                                    />
                                </Link>
                                <div className="flex flex-col ml-3 mr-4 min-w-0 relative" ref={collaboratorMenuRef}>
                                    {hasCollaborators ? (
                                        <>
                                            <div className="flex items-center cursor-pointer hover:opacity-80 group select-none" onClick={() => setIsCollaboratorMenuOpen(!isCollaboratorMenuOpen)}>
                                                <span className="font-bold text-base text-black dark:text-white whitespace-nowrap">{mainChannel.name} 他</span>
                                                <div className={`transform transition-transform duration-200 ${isCollaboratorMenuOpen ? 'rotate-90' : ''}`}><ChevronRightIcon /></div>
                                            </div>
                                            {isCollaboratorMenuOpen && (
                                                <div className="absolute top-full left-0 mt-2 w-64 bg-yt-white dark:bg-yt-light-black rounded-lg shadow-xl border border-yt-spec-light-20 dark:border-yt-spec-20 z-50 overflow-hidden">
                                                    <div className="px-4 py-2 text-xs font-bold text-yt-light-gray border-b border-yt-spec-light-20 dark:border-yt-spec-20">チャンネルを選択</div>
                                                    <div className="max-h-60 overflow-y-auto">
                                                        {collaboratorsList.map(collab => (
                                                            <Link key={collab.id} to={`/channel/${collab.id}`} className="flex items-center px-4 py-3 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10" onClick={() => setIsCollaboratorMenuOpen(false)}>
                                                                <img 
                                                                    src={collab.avatarUrl || 'https://www.gstatic.com/youtube/img/creator/avatar/default_64.svg'} 
                                                                    alt={collab.name} 
                                                                    className="w-8 h-8 rounded-full mr-3" 
                                                                    onError={(e) => {
                                                                        e.currentTarget.src = 'https://www.gstatic.com/youtube/img/creator/avatar/default_64.svg';
                                                                    }}
                                                                />
                                                                <div><p className="text-sm font-semibold text-black dark:text-white">{collab.name}</p></div>
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <Link to={`/channel/${mainChannel.id}`} className="font-bold text-base text-black dark:text-white hover:text-opacity-80 block">{mainChannel.name}</Link>
                                    )}
                                    <span className="text-xs text-yt-light-gray truncate block">{mainChannel.subscriberCount}</span>
                                </div>
                            </div>
                            <button onClick={handleSubscriptionToggle} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${subscribed ? 'bg-yt-light dark:bg-[#272727] text-black dark:text-white hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f]' : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'}`}>{subscribed ? '登録済み' : 'チャンネル登録'}</button>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0 relative">
                            <div className="flex items-center bg-yt-light dark:bg-[#272727] rounded-full h-9 hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors flex-shrink-0">
                                <button className="flex items-center px-3 sm:px-4 h-full border-r border-yt-light-gray/20 gap-2"><LikeIcon /><span className="text-sm font-semibold">{videoDetails.likes}</span></button>
                                <button className="px-3 h-full rounded-r-full"><DislikeIcon /></button>
                            </div>
                            <button onClick={() => setShowLiveChat(prev => !prev)} className={`flex items-center justify-center rounded-full w-9 h-9 transition-colors flex-shrink-0 ${showLiveChat ? 'bg-yt-light dark:bg-[#272727] text-yt-blue' : 'bg-yt-light dark:bg-[#272727] text-black dark:text-white hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f]'}`} title="ライブチャット表示"><ChatIcon /></button>
                            
                            <button onClick={handleShareClick} className="flex items-center justify-center bg-yt-light dark:bg-[#272727] rounded-full w-9 h-9 hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors flex-shrink-0" title="共有"><ShareIcon /></button>
                            <button onClick={handleDownloadClick} className="flex items-center justify-center bg-yt-light dark:bg-[#272727] rounded-full w-9 h-9 hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors flex-shrink-0" title="ダウンロード"><DownloadIcon /></button>
                            <button onClick={() => setIsPlaylistModalOpen(true)} className="flex items-center justify-center bg-yt-light dark:bg-[#272727] rounded-full w-9 h-9 hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors flex-shrink-0" title="保存"><SaveIcon /></button>
                            
                            <button 
                                onClick={() => setIsTheaterMode(!isTheaterMode)}
                                className={`flex items-center justify-center rounded-full w-9 h-9 transition-colors flex-shrink-0 ${isTheaterMode ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-yt-light dark:bg-[#272727] text-black dark:text-white hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f]'}`}
                                title="シアターモード"
                            >
                                <TheaterIcon />
                            </button>

                            <div className="relative" ref={controlsRef}>
                                <button onClick={() => setIsControlsOpen(!isControlsOpen)} className={`flex items-center justify-center rounded-full w-9 h-9 transition-colors flex-shrink-0 ${isControlsOpen ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-yt-light dark:bg-[#272727] text-black dark:text-white hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f]'}`} title="再生コントロール"><TuneIcon /></button>
                                {isControlsOpen && (
                                    <div className="absolute bottom-full right-0 mb-2 w-72 bg-yt-white dark:bg-yt-light-black rounded-xl shadow-xl border border-yt-spec-light-20 dark:border-yt-spec-20 p-4 z-50 animate-scale-in">
                                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-yt-spec-light-20 dark:border-yt-spec-20">
                                            <h3 className="font-bold text-sm">再生コントロール</h3>
                                        </div>
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-sm text-yt-light-gray"><SpeedIcon /> 速度</div>
                                                <span className="font-bold text-sm">{playbackSpeed.toFixed(2)}x</span>
                                            </div>
                                            <input type="range" min="0.25" max="4.0" step="0.05" value={playbackSpeed} onChange={(e) => handleSpeedChange(parseFloat(e.target.value))} className="w-full accent-yt-blue h-1 bg-yt-light-gray rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={`mt-4 bg-yt-spec-light-10 dark:bg-yt-dark-gray p-3 rounded-xl text-sm cursor-pointer hover:bg-yt-spec-light-20 dark:hover:bg-yt-gray transition-colors ${isDescriptionExpanded ? '' : 'h-24 overflow-hidden relative'}`} onClick={() => setIsDescriptionExpanded(prev => !prev)}>
                        <div className="font-bold mb-2 text-black dark:text-white">{videoDetails.views}  •  {videoDetails.uploadedAt}</div>
                        <div className="whitespace-pre-wrap break-words text-black dark:text-white overflow-hidden">
                            <div dangerouslySetInnerHTML={{ __html: videoDetails.description }} />
                        </div>
                        {!isDescriptionExpanded && <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-yt-spec-light-10 dark:from-yt-dark-gray to-transparent flex items-end p-3 font-semibold">もっと見る</div>}
                        {isDescriptionExpanded && <div className="font-semibold mt-2">一部を表示</div>}
                    </div>

                    <div className="mt-6 hidden lg:block">
                        {!showLiveChat && (
                            <>
                                <div className="flex flex-col mb-6">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-xl font-bold">{commentCountDisplay}</h2>
                                        <div className="flex gap-1 ml-4">
                                            <button onClick={() => handleCommentSortChange('top')} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${commentSort === 'top' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-yt-light-gray hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10'}`}>おすすめ順</button>
                                            <button onClick={() => handleCommentSortChange('newest')} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${commentSort === 'newest' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-yt-light-gray hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10'}`}>新しい順</button>
                                        </div>
                                    </div>
                                </div>
                                {isCommentsLoading ? <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yt-blue"></div></div> : comments.length > 0 ? (
                                    <div className="space-y-4">
                                        {comments.map((comment, idx) => <CommentComponent key={`${comment.comment_id}-${idx}`} comment={comment} />)}
                                        {commentsContinuation && (
                                            <div ref={commentsLoaderRef} className="h-10 flex justify-center items-center">
                                                {isFetchingMoreComments && <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-yt-blue"></div>}
                                            </div>
                                        )}
                                    </div>
                                ) : <div className="py-4 text-yt-light-gray">コメントはありません。</div>}
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {isPlaylistModalOpen && <PlaylistModal isOpen={isPlaylistModalOpen} onClose={() => setIsPlaylistModalOpen(false)} video={videoForPlaylistModal} />}
            <DownloadModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} streamData={streamData} isLoading={isStreamDataLoading} onRetry={fetchStreamDataIfNeeded}/>
            
            {currentPlaylist && playlistVideos.length > 0 && (
                <div className="w-full lg:w-[400px] xl:w-[450px] flex-shrink-0 mt-6 lg:mt-0">
                    <PlaylistPanel
                        playlist={currentPlaylist}
                        videos={playlistVideos}
                        currentVideoId={videoId || ''}
                        isShuffle={isShuffle}
                        isLoop={isLoop}
                        toggleShuffle={toggleShuffle}
                        toggleLoop={toggleLoop}
                        onReorder={handlePlaylistReorder}
                        authorName={currentPlaylist.authorName}
                    />
                </div>
            )}

            {!currentPlaylist && (
                <div className="w-full lg:w-[350px] xl:w-[400px] flex-shrink-0 mt-6 lg:mt-0">
                    <div className="flex flex-col space-y-3">
                        {relatedVideos.map((video, index) => (
                            <RelatedVideoCard key={`${video.id}-${index}`} video={video} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoPlayerPage;
