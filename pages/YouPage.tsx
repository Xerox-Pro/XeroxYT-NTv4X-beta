
import React, { useState, useEffect, useRef } from 'react';
// FIX: Use named import for Link from react-router-dom
import { Link } from 'react-router-dom';
import { usePlaylist } from '../contexts/PlaylistContext';
import { getVideosByIds } from '../utils/api';
import type { Playlist } from '../types';
import { PlaylistIcon, PlayIcon, AddToPlaylistIcon, CheckIcon, CloseIcon } from '../components/icons/Icons';

const YouPage: React.FC = () => {
    const { playlists, createPlaylist } = usePlaylist();
    const [playlistThumbnails, setPlaylistThumbnails] = useState<Record<string, string>>({});
    
    // Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isCreating && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isCreating]);

    useEffect(() => {
        const fetchThumbnails = async () => {
            const videoIdsToFetch = playlists
                .map(p => p.videoIds[0])
                .filter((id): id is string => !!id);
            
            if (videoIdsToFetch.length > 0) {
                const videos = await getVideosByIds(videoIdsToFetch);
                const thumbnails: Record<string, string> = {};
                const videoMap = new Map(videos.map(v => [v.id, v.thumbnailUrl]));

                playlists.forEach(p => {
                    if (p.videoIds.length > 0) {
                        const thumb = videoMap.get(p.videoIds[0]);
                        if (thumb) {
                            thumbnails[p.id] = thumb;
                        }
                    }
                });
                setPlaylistThumbnails(thumbnails);
            }
        };

        fetchThumbnails();
    }, [playlists]);

    const handleStartCreate = () => {
        setIsCreating(true);
        setNewPlaylistName('');
    };

    const handleConfirmCreate = () => {
        if (newPlaylistName.trim()) {
            createPlaylist(newPlaylistName.trim());
            setIsCreating(false);
            setNewPlaylistName('');
        }
    };

    const handleCancelCreate = () => {
        setIsCreating(false);
        setNewPlaylistName('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirmCreate();
        } else if (e.key === 'Escape') {
            handleCancelCreate();
        }
    };

    return (
        <div className="container mx-auto px-4 py-6 pb-24">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-black dark:text-white">プレイリスト</h1>
                {!isCreating && (
                    <button 
                        onClick={handleStartCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-yt-light dark:bg-yt-dark-gray hover:bg-gray-200 dark:hover:bg-yt-gray rounded-full transition-colors text-sm font-semibold text-black dark:text-white"
                    >
                        <AddToPlaylistIcon />
                        <span>新規作成</span>
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="mb-6 p-4 bg-yt-light dark:bg-yt-dark-gray rounded-xl border border-yt-spec-light-20 dark:border-yt-spec-20 animate-fade-in-main">
                    <h3 className="text-sm font-bold mb-2 text-black dark:text-white">新しいプレイリスト</h3>
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="名前を入力..."
                            className="flex-1 bg-white dark:bg-black border border-yt-spec-light-20 dark:border-yt-spec-20 rounded-lg px-3 py-2 outline-none focus:border-yt-blue text-black dark:text-white"
                        />
                        <button 
                            onClick={handleConfirmCreate}
                            disabled={!newPlaylistName.trim()}
                            className="p-2 bg-yt-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="作成"
                        >
                            <CheckIcon className="w-6 h-6 fill-current text-white" />
                        </button>
                        <button 
                            onClick={handleCancelCreate}
                            className="p-2 bg-gray-300 dark:bg-yt-spec-20 text-black dark:text-white rounded-lg hover:opacity-80"
                            title="キャンセル"
                        >
                            <CloseIcon />
                        </button>
                    </div>
                </div>
            )}
            
            {playlists.length === 0 && !isCreating ? (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-yt-spec-light-20 dark:border-yt-spec-20 rounded-xl">
                    <p className="text-yt-light-gray mb-4">作成したプレイリストはありません。</p>
                    <button 
                        onClick={handleStartCreate}
                        className="text-yt-blue hover:underline"
                    >
                        新しいプレイリストを作成する
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {playlists.map(playlist => {
                        const firstVideoId = playlist.videoIds[0];
                        const playAllLink = firstVideoId 
                            ? `/watch/${firstVideoId}?list=${playlist.id}`
                            : `/playlist/${playlist.id}`;
                        
                        return (
                            <div key={playlist.id} className="flex flex-col sm:flex-row gap-4">
                                <Link to={playAllLink} className="relative sm:w-80 flex-shrink-0 group">
                                    <div className="relative aspect-video bg-yt-dark-gray rounded-lg overflow-hidden">
                                        {playlistThumbnails[playlist.id] ? (
                                            <img src={playlistThumbnails[playlist.id]} alt={playlist.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-yt-gray">
                                                <PlaylistIcon className="w-12 h-12 text-yt-light-gray" />
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white px-2 py-1 text-sm font-semibold flex items-center justify-center">
                                            <PlaylistIcon className="w-5 h-5" />
                                            <span className="ml-2">{playlist.videoIds.length} 本の動画</span>
                                        </div>
                                         {firstVideoId && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                                                <PlayIcon className="w-6 h-6 fill-current text-white" />
                                                <span>すべて再生</span>
                                            </div>
                                        )}
                                    </div>
                                </Link>
                                <div className="flex-1 py-2 min-w-0">
                                    <Link to={`/playlist/${playlist.id}`}>
                                        <h2 className="text-xl font-semibold line-clamp-2 hover:text-opacity-80 text-black dark:text-white">{playlist.name}</h2>
                                    </Link>
                                    <p className="text-sm text-yt-light-gray mt-1">{playlist.authorName}</p>
                                    <Link to={`/playlist/${playlist.id}`} className="text-sm text-yt-light-gray hover:text-black dark:hover:text-white mt-3 inline-block">
                                        プレイリスト全体を表示
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default YouPage;
