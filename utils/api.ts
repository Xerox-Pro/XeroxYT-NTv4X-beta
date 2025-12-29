
import type { Video, VideoDetails, Channel, ChannelDetails, ApiPlaylist, Comment, PlaylistDetails, SearchResults, HomeVideo, HomePlaylist, ChannelHomeData, CommunityPost, CommentResponse, StreamData } from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('ja');

// --- CONSTANTS ---
const API_MIRRORS = [
    'https://xeroxyt-nt-apiv1-0ydt.onrender.com',
    'https://xeroxyt-nt-apiv1.onrender.com',
    'https://xeroxyt-nt-apiv1-5vsz.onrender.com',
    'https://xeroxyt-nt-apiv1-m28t.onrender.com'
];

// Initialize with a random mirror
let currentApiBase = API_MIRRORS[Math.floor(Math.random() * API_MIRRORS.length)];

// Function to switch to the next mirror in case of failure
const switchApiMirror = () => {
    const currentIndex = API_MIRRORS.indexOf(currentApiBase);
    const nextIndex = (currentIndex + 1) % API_MIRRORS.length;
    currentApiBase = API_MIRRORS[nextIndex];
    console.warn(`API Mirror switched to: ${currentApiBase}`);
};

// Export the current base URL getter for other components if needed
export const getApiBaseUrl = () => currentApiBase;
// Maintain backward compatibility for imports, though dynamic now
export const API_BASE_URL = currentApiBase; 

const SIAWASE_API_BASE = "https://siawaseok-inv.sytes.net/api";

// Helper to get proxied video URL
export const getProxiedStreamUrl = (url: string): string => {
    if (!url) return '';
    return `${currentApiBase}/api/video-proxy?url=${encodeURIComponent(url)}`;
};

// --- CACHING LOGIC ---
const CACHE_TTL = 365 * 24 * 60 * 60 * 1000; 

interface CacheItem {
    data: any;
    expiry: number;
}

const cache = {
    get: (key: string): any | null => {
        try {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;
            const item: CacheItem = JSON.parse(itemStr);
            return item;
        } catch (error) {
            console.error(`Cache read error for key "${key}":`, error);
            return null;
        }
    },
    set: (key: string, value: any, ttl: number = CACHE_TTL): void => {
        try {
            if (value === undefined) return;
            const item: CacheItem = { data: value, expiry: new Date().getTime() + ttl };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
            console.error(`Cache write error for key "${key}":`, error);
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                console.warn("LocalStorage quota exceeded. Clearing old cache keys...");
                try {
                    const keysToRemove: string[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && (
                            k.startsWith('video-details-') || 
                            k.startsWith('search-') || 
                            k.startsWith('channel-') || 
                            k.startsWith('playlist-') ||
                            k.startsWith('comments-') ||
                            k.startsWith('home-feed-') ||
                            k.startsWith('stream-data-')
                        )) {
                            keysToRemove.push(k);
                        }
                    }
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                    
                    try {
                        localStorage.setItem(key, JSON.stringify({ data: value, expiry: new Date().getTime() + ttl }));
                    } catch (retryError) {
                        console.error("Retry failed. Item too large to cache.", retryError);
                    }
                } catch (cleanupError) {
                    console.error("Error during cache cleanup", cleanupError);
                }
            }
        }
    },
};

export const getCachedData = (key: string): any | null => {
    return cache.get(key)?.data || null;
};

async function fetchWithCache<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl: number = CACHE_TTL
): Promise<T> {
    const cachedItem = cache.get(key);
    const now = new Date().getTime();
    
    if (cachedItem && ttl > 0 && now < cachedItem.expiry) {
        return cachedItem.data as T;
    }

    if (!navigator.onLine && cachedItem) {
        return cachedItem.data as T;
    }

    try {
        const data = await fetcher();
        cache.set(key, data, ttl === 0 ? CACHE_TTL : ttl); 
        return data;
    } catch (error) {
        if (cachedItem) {
            return cachedItem.data as T;
        }
        throw error;
    }
}


// --- HELPER FUNCTIONS ---

export const formatJapaneseNumber = (raw: number | string): string => {
  if (!raw && raw !== 0) return '0';
  const str = String(raw).trim();

  if (str.match(/[万億]/)) {
      return str.replace(/[^0-9.万億]/g, '');
  }
  
  if (str.match(/[MK]/)) {
      return str.replace(/[^0-9.MK]/g, '');
  }

  const cleanStr = str.replace(/[^0-9.]/g, '');
  if (!cleanStr) return '0';
  
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return '0';
  
  if (num >= 100000000) {
      return `${(num / 100000000).toFixed(1).replace(/\.0$/, '')}億`;
  }
  if (num >= 10000) {
      return `${(num / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  }
  return num.toLocaleString();
};

export const formatJapaneseDate = (dateText: string): string => {
  if (!dateText) return '';
  if (!dateText.includes('ago')) {
    return dateText;
  }
  const match = dateText.match(/(\d+)\s+(year|month|week|day|hour|minute|second)s?/);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2] as 'year'|'month'|'day'|'hour'|'minute'|'second';
    return dayjs().subtract(num, unit).fromNow();
  }
  return dateText;
};

export const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const parseDuration = (iso: string, text: string): number => {
    if (iso) {
        const matches = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (matches) {
            const h = parseInt(matches[1] || '0', 10);
            const m = parseInt(matches[2] || '0', 10);
            const s = parseInt(matches[3] || '0', 10);
            return h * 3600 + m * 60 + s;
        }
    }
    if (text) {
         const parts = text.split(':').map(p => parseInt(p, 10));
         if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
         if (parts.length === 2) return parts[0] * 60 + parts[1];
         if (parts.length === 1) return parts[0];
    }
    return 0;
}

export const linkify = (text: string): string => {
    if (!text) return '';
    const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+)/g;
    return text.replace(urlRegex, (url) => {
        const href = url.startsWith('www.') ? `http://${url}` : url;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-yt-blue hover:underline break-all">${url}</a>`;
    });
};

// --- API FETCHER & PROXY CONFIG ---

const smartFetch = async (url: string, options: RequestInit = {}): Promise<any> => {
    // @ts-ignore - google object exists in GAS environment
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            google.script.run
                .withSuccessHandler((res: any) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            const data = JSON.parse(res.body);
                            resolve({
                                ok: true,
                                json: async () => data,
                                text: async () => res.body
                            });
                        } catch (e) {
                             // Fallback for non-JSON response
                             resolve({
                                ok: true,
                                json: async () => ({}),
                                text: async () => res.body
                            });
                        }
                    } else {
                        reject(new Error(`GAS Fetch Failed: ${res.status} ${res.body}`));
                    }
                })
                .withFailureHandler((err: any) => {
                    reject(err);
                })
                .proxyApi(url);
        });
    } else {
        // Fallback for local development
        return fetch(url, options);
    }
};

const apiFetch = async (endpoint: string, options: RequestInit = {}, retries = API_MIRRORS.length): Promise<any> => {
    const headers = { ...options.headers };
    // Use the currently selected active mirror
    const url = `${currentApiBase}/api/${endpoint}`;

    try {
        // Use smartFetch to utilize GAS proxy if available
        const response = await smartFetch(url, { ...options, headers });
        const text = await response.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error(`Server returned non-JSON: ${text.slice(0, 50)}...`);
        }

        if (!response.ok) {
            throw new Error(data.error || `Request failed for ${endpoint} with status ${response.status}`);
        }
        return data;
    } catch (err: any) {
        console.warn(`Request failed for ${url}:`, err.message);
        
        // Failover logic
        if (retries > 0) {
            switchApiMirror();
            // Retry with the new mirror
            return apiFetch(endpoint, options, retries - 1);
        }
        throw err;
    }
};

let playerConfigParams: string | null = null;
export async function getPlayerConfig(): Promise<string> {
    if (playerConfigParams) return playerConfigParams;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    return fetchWithCache('player-config', async () => {
        const response = await fetch('https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json');
        const config = await response.json();
        const decodedParams = (config.params || '').replace(/&amp;/g, '&');
        playerConfigParams = decodedParams;
        return decodedParams;
    }, ONE_DAY_MS); 
}

// --- DATA MAPPING HELPERS ---
export const mapYoutubeiVideoToVideo = (item: any): Video | null => {
    if (!item) return null;

    if (item.type === 'ShortsLockupView' || (item.on_tap_endpoint?.payload?.videoId && item.overlay_metadata)) {
         const videoId = item.on_tap_endpoint?.payload?.videoId;
         if (!videoId) return null;

         const title = item.overlay_metadata?.primary_text?.text || item.accessibility_text?.split(',')[0] || 'Shorts';
         let rawViews = item.overlay_metadata?.secondary_text?.text || '';
         if (!rawViews && item.accessibility_text) {
             const match = item.accessibility_text.match(/, (.*?) 回視聴/);
             if (match) rawViews = match[1] + ' 回視聴';
         }

         let thumb = item.on_tap_endpoint?.payload?.thumbnail?.thumbnails?.[0]?.url;
         if (!thumb && item.thumbnail && item.thumbnail.length > 0) {
             thumb = item.thumbnail[0].url;
         }
         
         return {
            id: videoId,
            thumbnailUrl: thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: '',
            isoDuration: 'PT1M',
            title: title,
            channelName: '',
            channelId: '',
            channelAvatarUrl: '',
            views: rawViews,
            uploadedAt: '',
            descriptionSnippet: '',
            isLive: false
         };
    }

    // Support both 'id' (typical) and 'video_id' (search response)
    const videoId = item.id || item.videoId || item.content_id || item.video_id;
    if (!videoId || typeof videoId !== 'string') return null;

    const title = item.title?.text ?? 
                  item.title?.simpleText ?? 
                  item.metadata?.title?.text ?? 
                  item.title ?? 
                  '無題の動画';

    const thumbs = item.thumbnails || item.thumbnail || item.content_image;
    let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`; 
    if (Array.isArray(thumbs) && thumbs.length > 0) {
        thumbnailUrl = thumbs[0].url;
    } else if (thumbs?.url) {
        thumbnailUrl = thumbs.url;
    }
    if (thumbnailUrl) thumbnailUrl = thumbnailUrl.split('?')[0];

    const durationOverlay = (item.thumbnail_overlays || []).find((o: any) => o.type === 'ThumbnailOverlayTimeStatus');
    // Support 'length_text' from search response
    const duration = item.duration?.text ?? 
                     item.length?.simpleText ?? 
                     item.length_text?.text ??
                     durationOverlay?.text ?? 
                     '';
    const isoDuration = `PT${item.duration?.seconds ?? 0}S`;

    let views = '視聴回数不明';
    let rawViews = '';
    let uploadedAt = '';

    if (item.view_count?.text || item.short_view_count?.text) {
        rawViews = item.view_count?.text ?? item.short_view_count?.text;
    } else if (item.views?.text) {
        rawViews = item.views.text; 
    }
    
    const metadata_rows = item.metadata?.metadata?.metadata_rows;
    if (Array.isArray(metadata_rows) && metadata_rows.length > 1) {
        if (metadata_rows[1]?.metadata_parts?.[0]?.text?.text) {
            rawViews = metadata_rows[1].metadata_parts[0].text.text;
        }
        if (metadata_rows[1]?.metadata_parts?.[1]?.text?.text) {
            uploadedAt = metadata_rows[1].metadata_parts[1].text.text;
        }
    } else {
        uploadedAt = item.published?.text ?? '';
    }

    if (rawViews) {
        const formatted = formatJapaneseNumber(rawViews);
        // If it already contains '回視聴' (e.g. search response), don't double add
        if (rawViews.includes('回視聴')) {
            views = rawViews;
        } else {
            views = formatted + '回視聴';
        }
    }

    const author = item.author || item.channel;
    let channelName = author?.name ?? '不明なチャンネル';
    let channelId = author?.id ?? '';
    let channelAvatarUrl = author?.thumbnails?.[0]?.url ?? '';

    if (Array.isArray(metadata_rows) && metadata_rows.length > 0) {
        if (metadata_rows[0]?.metadata_parts?.[0]?.text?.text) {
            channelName = metadata_rows[0].metadata_parts[0].text.text;
        }
    }

    const descriptionSnippet = item.description_snippet?.text ?? '';

    let isLive = false;
    if (item.badges?.some((b: any) => b.metadataBadgeRenderer?.label === 'LIVE' || b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW')) {
        isLive = true;
    }
    if (item.thumbnail_overlays?.some((o: any) => o.thumbnailOverlayTimeStatusRenderer?.style === 'LIVE')) {
        isLive = true;
    }

    return {
        id: videoId,
        thumbnailUrl: thumbnailUrl,
        duration: duration,
        isoDuration: isoDuration,
        title: title,
        channelName: channelName,
        channelId: channelId,
        channelAvatarUrl: channelAvatarUrl,
        views: views,
        uploadedAt: formatJapaneseDate(uploadedAt),
        descriptionSnippet: descriptionSnippet,
        isLive: isLive
    };
};

const mapYoutubeiChannelToChannel = (item: any): Channel | null => {
    if(!item?.id) return null;
    
    let thumbnails = item.thumbnails || item.author?.thumbnails || item.avatar || [];
    if (!Array.isArray(thumbnails) && typeof thumbnails === 'object' && thumbnails.url) {
        thumbnails = [thumbnails];
    }

    let avatarUrl = '';
    if (Array.isArray(thumbnails) && thumbnails.length > 0) {
        const bestThumb = thumbnails[0]; 
        avatarUrl = bestThumb.url;
        if (avatarUrl) avatarUrl = avatarUrl.split('?')[0];
    }
    
    if (!avatarUrl) {
        avatarUrl = 'https://www.gstatic.com/youtube/img/creator/avatar/default_64.svg';
    }

    return {
        id: item.id,
        name: item.name || item.author?.name || item.title?.text || 'No Name',
        avatarUrl: avatarUrl,
        subscriberCount: item.subscriber_count?.text || item.video_count?.text || ''
    };
}

const mapYoutubeiPlaylistToPlaylist = (item: any): ApiPlaylist | null => {
    if(!item?.id && !item?.content_id) return null;
    return {
        id: item.id || item.content_id,
        title: item.title?.text || item.title,
        thumbnailUrl: item.thumbnails?.[0]?.url || item.thumbnail?.[0]?.url,
        videoCount: parseInt(item.video_count?.text?.replace(/[^0-9]/g, '') || '0'),
        author: item.author?.name,
        authorId: item.author?.id
    };
}


export interface StreamUrls {
    video_url: string;
    audio_url?: string;
}
  
export async function getStreamUrls(videoId: string): Promise<StreamUrls> {
    const raw = await getRawStreamData(videoId);
    return {
        video_url: raw.streamingUrl || '',
        audio_url: raw.audioOnlyFormat?.url
    };
}

export async function getRawStreamData(videoId: string): Promise<StreamData> {
    // New endpoint structure using apiFetch which cycles mirrors
    return fetchWithCache(`stream-data-v3-${videoId}`, async () => {
        const data = await apiFetch(`stream/${videoId}`);
        
        const result: StreamData = {
            streamingUrl: null,
            streamType: 'mp4',
            combinedFormats: [],
            audioOnlyFormat: null,
            separate1080p: null
        };

        // Extract 360p from formats
        const formats = Array.isArray(data.formats) ? data.formats : [];
        const format360 = formats.find((f: any) => f.quality === '360p');
        
        // Prioritize 360p as requested, fallback to API provided streamingUrl
        if (format360 && format360.url) {
            result.streamingUrl = format360.url;
        } else if (data.streamingUrl) {
            result.streamingUrl = data.streamingUrl;
        } else if (formats.length > 0) {
            result.streamingUrl = formats[0].url;
        }

        // Map formats for download modal
        result.combinedFormats = formats.map((f: any) => ({
            quality: f.quality || 'Unknown',
            container: f.container || 'mp4',
            url: f.url,
            isVideoOnly: false // Combined formats typically have audio
        }));

        // Audio
        if (data.audioUrl) {
            result.audioOnlyFormat = {
                quality: 'best',
                container: 'm4a', // Assuming standard audio container
                url: data.audioUrl
            };
        }

        return result;
    }, 60 * 60 * 1000); // 1 hour cache
}

export const mapHomeVideoToVideo = (homeVideo: HomeVideo, channelData?: Partial<ChannelDetails>): Video => {
    return {
        id: homeVideo.videoId,
        title: homeVideo.title,
        thumbnailUrl: homeVideo.thumbnail || `https://i.ytimg.com/vi/${homeVideo.videoId}/mqdefault.jpg`,
        duration: homeVideo.duration || '',
        isoDuration: '',
        channelName: homeVideo.author || channelData?.name || '',
        channelId: channelData?.id || '',
        channelAvatarUrl: homeVideo.icon || channelData?.avatarUrl || '',
        views: formatJapaneseNumber(homeVideo.viewCount || '') + '回視聴',
        uploadedAt: homeVideo.published || '',
        descriptionSnippet: homeVideo.description || '',
    };
};

export async function getChannelHome(channelId: string): Promise<ChannelHomeData> {
    return fetchWithCache(`channel-home-${channelId}`, async () => {
        // Use smartFetch for the external API via GAS proxy
        const response = await smartFetch(`${SIAWASE_API_BASE}/channel/${channelId}`);
        return await response.json();
    });
}

// --- EXPORTED API FUNCTIONS ---

export async function getSearchSuggestions(query: string): Promise<string[]> {
    if (!query.trim()) return [];
    try {
        const data = await apiFetch(`suggest?q=${encodeURIComponent(query)}`);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error("Suggestion fetch failed", e);
        return [];
    }
}

export async function getRecommendedVideos(): Promise<{ videos: Video[] }> {
    return fetchWithCache('home-feed-videos', async () => {
        const params = new URLSearchParams();
        params.set('q', 'おすすめ'); 
        params.set('page', '1');
        params.set('sort_by', 'rating'); 
        
        try {
            const data = await apiFetch(`search?${params.toString()}`);
            const videos = Array.isArray(data.videos) 
                ? data.videos.map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null) 
                : [];
            return { videos };
        } catch (e) {
            console.error("Search-based home feed failed", e);
            return { videos: [] };
        }
    }, 0); 
}

export async function searchVideos(query: string, pageToken = '1', channelId?: string, sortBy?: string): Promise<SearchResults> {
    const cacheKey = `search-${query}-${pageToken}-${channelId || 'all'}-${sortBy || 'relevance'}`;
    return fetchWithCache(cacheKey, async () => {
        const params = new URLSearchParams();
        params.set('q', query);
        params.set('page', pageToken);
        
        if (sortBy) {
            params.set('sort_by', sortBy);
        }
        
        const data = await apiFetch(`search?${params.toString()}`);
        
        const videos: Video[] = Array.isArray(data.videos) ? data.videos.map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null) : [];
        const shorts: Video[] = Array.isArray(data.shorts) ? data.shorts.map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null) : [];
        const channels: Channel[] = Array.isArray(data.channels) ? data.channels.map(mapYoutubeiChannelToChannel).filter((c): c is Channel => c !== null) : [];
        const playlists: ApiPlaylist[] = Array.isArray(data.playlists) ? data.playlists.map(mapYoutubeiPlaylistToPlaylist).filter((p): p is ApiPlaylist => p !== null) : [];

        let filteredVideos = videos;
        if (channelId) {
            filteredVideos = videos.filter(v => v.channelId === channelId);
        }
        return { videos: filteredVideos, shorts, channels, playlists, nextPageToken: data.nextPageToken };
    });
}

export async function getExternalRelatedVideos(videoId: string): Promise<Video[]> {
    // This function is kept for backward compatibility if called elsewhere, but VideoPlayerPage now uses getVideoDetails directly
    const cacheKey = `ext-related-${videoId}`;
    return fetchWithCache(cacheKey, async () => {
        try {
            const response = await fetch(`https://siawaseok.duckdns.org/api/video2/${videoId}`);
            if (!response.ok) return [];
            
            const data = await response.json();
            const items = data['Related-videos']?.relatedVideos || [];
            
            return items.map((item: any) => ({
                id: item.videoId,
                title: item.title,
                thumbnailUrl: item.thumbnail,
                duration: item.duration || '',
                isoDuration: '',
                channelName: item.channelName || '',
                channelId: '',
                channelAvatarUrl: item.channelAvatar || '',
                views: item.viewCountText || '',
                uploadedAt: item.publishedTimeText || '',
                descriptionSnippet: '',
                isLive: false
            }));
        } catch (e) {
            console.warn("Failed to fetch external related videos:", e);
            return [];
        }
    }, 0);
}

export async function getVideoDetails(videoId: string): Promise<VideoDetails> {
    return fetchWithCache(`video-details-v4-${videoId}`, async () => {
        // Use the new endpoint structure with API Mirrors
        const data = await apiFetch(`video?id=${videoId}`);

        if (!data) {
             throw new Error('動画の読み込みに失敗しました。');
        }

        // Map basic info
        const title = data.primary_info?.title?.text || 'No Title';
        const views = data.primary_info?.view_count?.view_count?.text || '';
        const uploadedAt = data.primary_info?.relative_date?.text || data.primary_info?.published?.text || '';
        
        // Map Author
        let owner = data.secondary_info?.owner;
        let channelName = owner?.author?.name || 'Unknown';
        let channelId = owner?.author?.id || '';
        let channelAvatarUrl = owner?.author?.thumbnails?.[0]?.url || '';
        let subscriberCount = owner?.subscriber_count?.text || '';

        const collaborators: Channel[] = [];
        
        // Handle Collaborators (Dialog)
        const dialog = owner?.author?.endpoint?.showDialogCommand?.panelLoadingStrategy?.inlineContent?.dialogViewModel;
        if (dialog) {
             const listItems = dialog.customContent?.listViewModel?.listItems;
             if (listItems && Array.isArray(listItems)) {
                 for (const item of listItems) {
                     const vm = item.listItemViewModel;
                     if (!vm) continue;
                     
                     const cName = vm.title?.content || '';
                     const cId = vm.title?.commandRuns?.[0]?.onTap?.innertubeCommand?.browseEndpoint?.browseId;
                     let cSub = vm.subtitle?.content || '';
                     
                     // Clean up sub count if it contains extra text
                     // e.g., "‎⁨@Nanatsukaze_⁩ • ⁨チャンネル登録者数 4.47万人⁩"
                     const subMatch = cSub.match(/チャンネル登録者数\s+(.*)/);
                     if (subMatch) {
                         // Remove closing unicode characters if any (like POP directional formatting)
                         cSub = subMatch[1].replace(/[\u2000-\u206F]/g, '').trim(); 
                     }

                     if (cId && cName) {
                         collaborators.push({
                             id: cId,
                             name: cName,
                             avatarUrl: '', // Will fetch below
                             subscriberCount: cSub
                         });
                     }
                 }
             }
        }

        // Fix N/A Owner or missing avatars for collaborators
        if (collaborators.length > 0) {
             await Promise.all(collaborators.map(async (c) => {
                 try {
                     const cDetails = await getChannelDetails(c.id);
                     c.avatarUrl = cDetails.avatarUrl || 'https://www.gstatic.com/youtube/img/creator/avatar/default_64.svg';
                     // Use the cleaner sub count from details if available
                     if (cDetails.subscriberCount) c.subscriberCount = cDetails.subscriberCount;
                 } catch (e) {
                     console.warn(`Failed to fetch details for collaborator ${c.name}`, e);
                     c.avatarUrl = 'https://www.gstatic.com/youtube/img/creator/avatar/default_64.svg';
                 }
             }));

             // If main owner is broken (N/A), use the first collaborator
             if (channelName === 'N/A' || channelId === 'N/A' || !channelId) {
                 const main = collaborators[0];
                 channelName = main.name;
                 channelId = main.id;
                 channelAvatarUrl = main.avatarUrl;
                 subscriberCount = main.subscriberCount;
             }
        }

        // Map Description
        const description = data.secondary_info?.description?.text || '';
        
        // Map Likes
        const likes = data.basic_info?.like_count ? String(data.basic_info.like_count) : '';

        // Map Related Videos (watch_next_feed)
        const relatedVideos: Video[] = [];
        const rawRelated = data.watch_next_feed || [];
        
        for (const item of rawRelated) {
            if (item.type === 'LockupView' && item.content_type === 'VIDEO') {
                 const rId = item.content_id;
                 const rTitle = item.metadata?.title?.text || '';
                 
                 // Extract Metadata rows
                 const rows = item.metadata?.metadata?.metadata_rows || [];
                 let rChannelName = '';
                 let rViews = '';
                 let rUploadedAt = '';
                 
                 if (rows.length > 0 && rows[0].metadata_parts?.length > 0) {
                     rChannelName = rows[0].metadata_parts[0].text?.text || '';
                 }
                 if (rows.length > 1 && rows[1].metadata_parts?.length > 0) {
                     rViews = rows[1].metadata_parts[0].text?.text || '';
                     if (rows[1].metadata_parts.length > 1) {
                         rUploadedAt = rows[1].metadata_parts[1].text?.text || '';
                     }
                 }

                 const rThumb = item.content_image?.image?.[0]?.url;
                 const rDuration = item.content_image?.overlays?.[0]?.badges?.[0]?.text || '';

                 if (rId) {
                     relatedVideos.push({
                         id: rId,
                         title: rTitle,
                         thumbnailUrl: rThumb || `https://i.ytimg.com/vi/${rId}/mqdefault.jpg`,
                         duration: rDuration,
                         isoDuration: '', // Not provided in this format
                         channelName: rChannelName,
                         channelId: '', 
                         channelAvatarUrl: '', // Not always available in related feed
                         views: rViews,
                         uploadedAt: rUploadedAt,
                         descriptionSnippet: '',
                         isLive: false
                     });
                 }
            }
        }

        const details: VideoDetails = {
            id: videoId,
            title: title,
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: '', 
            isoDuration: '',
            channelName: channelName,
            channelId: channelId,
            channelAvatarUrl: channelAvatarUrl,
            views: views,
            uploadedAt: uploadedAt,
            description: description,
            likes: likes,
            dislikes: '0',
            commentCount: '', 
            channel: {
                id: channelId,
                name: channelName,
                avatarUrl: channelAvatarUrl,
                subscriberCount: subscriberCount
            },
            collaborators: collaborators, 
            relatedVideos: relatedVideos,
            isLive: false,
        };
        return details;
    });
}

export async function getComments(videoId: string, sortBy: 'top' | 'newest' = 'top', continuation?: string): Promise<CommentResponse> {
    const cacheKey = `comments-${videoId}-${sortBy}-${continuation || 'init'}`;
    return fetchWithCache(cacheKey, async () => {
        const params = new URLSearchParams();
        params.set('id', videoId);
        if (sortBy === 'newest') params.set('sort_by', 'newest');
        if (continuation) params.set('continuation', continuation);
        
        const data = await apiFetch(`comments?${params.toString()}`);
        return {
            comments: (data.comments as Comment[]) ?? [],
            continuation: data.continuation
        };
    }, 60 * 1000);
}

export async function getVideosByIds(videoIds: string[]): Promise<Video[]> {
    if (videoIds.length === 0) return [];
    const promises = videoIds.map(id => getVideoDetails(id).catch(err => {
        console.warn(`Failed to fetch video ${id}`, err);
        return null;
    }));
    const results = await Promise.all(promises);
    return results.filter((v): v is Video => v !== null);
}

export async function getChannelDetails(channelId: string): Promise<ChannelDetails> {
    return fetchWithCache(`channel-details-${channelId}`, async () => {
        const data = await apiFetch(`channel?id=${channelId}`);
        const channelMeta = data.channel;
        if (!channelMeta) throw new Error(`Channel with ID ${channelId} not found.`);

        let avatarUrl = '';
        if (typeof channelMeta.avatar === 'string') {
            avatarUrl = channelMeta.avatar;
        } else if (Array.isArray(channelMeta.avatar) && channelMeta.avatar.length > 0) {
            avatarUrl = channelMeta.avatar[0].url;
        } else if (typeof channelMeta.avatar === 'object' && channelMeta.avatar?.url) {
            avatarUrl = channelMeta.avatar.url;
        }

        return {
            id: channelId,
            name: channelMeta.name ?? 'No Name',
            avatarUrl: avatarUrl,
            subscriberCount: channelMeta.subscriberCount ?? '非公開',
            bannerUrl: channelMeta.banner?.url || channelMeta.banner,
            description: channelMeta.description ?? '',
            videoCount: parseInt(channelMeta.videoCount?.replace(/,/g, '') ?? '0'),
            handle: channelMeta.name,
        };
    });
}

export async function getChannelVideos(channelId: string, pageToken = '1', sort: 'latest' | 'popular' | 'oldest' = 'latest'): Promise<{ videos: Video[], nextPageToken?: string }> {
    return fetchWithCache(`channel-videos-${channelId}-${pageToken}-${sort}`, async () => {
        const page = parseInt(pageToken, 10);
        let url = `channel?id=${channelId}&page=${page}`;
        if (sort !== 'latest') url += `&sort=${sort}`;

        const data = await apiFetch(url);
        
        const channelMeta = data.channel;
        let avatarUrl = '';
        if (channelMeta?.avatar) {
            if (typeof channelMeta.avatar === 'string') avatarUrl = channelMeta.avatar;
            else if (Array.isArray(channelMeta.avatar) && channelMeta.avatar.length > 0) avatarUrl = channelMeta.avatar[0].url;
            else if (typeof channelMeta.avatar === 'object' && channelMeta.avatar.url) avatarUrl = channelMeta.avatar.url;
        }

        const videos = data.videos?.map((item: any) => {
            const video = mapYoutubeiVideoToVideo(item);
            if (video) {
                if (channelMeta?.name) video.channelName = channelMeta.name;
                if (channelMeta?.id) video.channelId = channelMeta.id || channelId;
                if (avatarUrl) video.channelAvatarUrl = avatarUrl;
            }
            return video;
        }).filter((v): v is Video => v !== null) ?? [];
        
        const hasMore = videos.length > 0;
        return { videos, nextPageToken: hasMore ? String(page + 1) : undefined };
    }, 0);
}

export async function getChannelShorts(channelId: string, sort: 'latest' | 'popular' = 'latest', pageToken = '1'): Promise<{ videos: Video[], nextPageToken?: string }> {
    return fetchWithCache(`channel-shorts-${channelId}-${sort}-${pageToken}`, async () => {
        const page = parseInt(pageToken, 10);
        let url = `channel-shorts?id=${channelId}&sort=${sort}&page=${page}`;
        const data = await apiFetch(url);
        const items = Array.isArray(data) ? data : (data.videos || []);
        const videos = items.map(mapYoutubeiVideoToVideo).filter((v: any): v is Video => v !== null) ?? [];
        const hasMore = videos.length > 0;
        return { videos, nextPageToken: hasMore ? String(page + 1) : undefined };
    }, 5 * 60 * 1000); 
}

export async function getChannelLive(channelId: string): Promise<{ videos: Video[] }> {
    return fetchWithCache(`channel-live-${channelId}`, async () => {
        const data = await apiFetch(`channel-live?id=${channelId}`);
        const items = Array.isArray(data.videos) ? data.videos : [];
        const videos = items.map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null) ?? [];
        return { videos };
    }, 0); 
}

export async function getChannelCommunity(channelId: string): Promise<{ posts: CommunityPost[] }> {
    return fetchWithCache(`channel-community-${channelId}`, async () => {
        const data = await apiFetch(`channel-community?id=${channelId}`);
        const rawPosts = data.posts || [];

        const posts: CommunityPost[] = rawPosts.map((post: any) => {
            let attachment = null;
            if (post.attachment) {
                const type = post.attachment.type;
                if (type === 'BackstageImage') {
                    const images = post.attachment.images || (post.attachment.image ? [post.attachment.image] : []);
                    attachment = { type: 'BackstageImage', images };
                } else if (type === 'PostMultiImage') {
                     const images = post.attachment.images || [];
                     attachment = { type: 'PostMultiImage', images };
                } else if (type === 'Video') {
                    attachment = { 
                        type: 'Video', 
                        videoId: post.attachment.videoId,
                        videoTitle: post.attachment.title,
                        videoThumbnail: post.attachment.thumbnail
                    };
                } else if (type === 'Poll') {
                     attachment = { type: 'Poll', choices: post.attachment.choices };
                } else if (type === 'SharedPost') {
                     attachment = { type: 'SharedPost', postId: post.attachment.postId };
                }
            }

            return {
                id: post.id,
                text: post.text,
                publishedTime: post.publishedTime,
                likeCount: post.likeCount,
                author: {
                    name: post.author?.name || 'Unknown',
                    avatar: post.author?.avatar || ''
                },
                attachment
            };
        });

        return { posts };
    });
}

export async function getChannelPlaylists(channelId: string): Promise<{ playlists: ApiPlaylist[] }> {
    return fetchWithCache(`channel-playlists-${channelId}`, async () => {
        const data = await apiFetch(`channel-playlists?id=${channelId}`);
        const rawPlaylists = data.playlists || [];
        const playlists: ApiPlaylist[] = rawPlaylists
            .map(mapYoutubeiPlaylistToPlaylist)
            .filter((p): p is ApiPlaylist => p !== null);
        return { playlists };
    });
}

export async function getPlaylistDetails(playlistId: string): Promise<PlaylistDetails> {
    return fetchWithCache(`playlist-details-${playlistId}`, async () => {
        const data = await apiFetch(`playlist?id=${playlistId}`);
        if (!data.info?.id) throw new Error(`Playlist with ID ${playlistId} not found.`);
        const videos = (data.videos || []).map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null);
        
        const details = {
            title: data.info.title,
            author: data.info.author?.name ?? '不明',
            authorId: data.info.author?.id ?? '',
            description: data.info.description ?? '',
            videos: videos
        };
        return details;
    });
}
