
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';

interface HlsVideoPlayerProps {
  src: string;
  type?: string;
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
  playsInline?: boolean;
}

const HlsVideoPlayer = forwardRef<HTMLVideoElement, HlsVideoPlayerProps>(
  ({ src, type, autoPlay = true, controls = true, className, playsInline = true }, ref) => {
    const internalVideoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Forward the ref to the parent if provided, otherwise use internal ref
    useImperativeHandle(ref, () => internalVideoRef.current!);

    useEffect(() => {
      const video = internalVideoRef.current;
      if (!video) return;

      // Reset error on src change
      setError(null);

      const handleHlsError = (_event: any, data: any) => {
          if (data.fatal) {
              switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                      console.error("HLS Network Error:", data);
                      if(hlsRef.current) hlsRef.current.startLoad();
                      setError("ネットワークエラーが発生しました。");
                      break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                      console.warn("HLS Media Error, recovering...", data);
                      if(hlsRef.current) hlsRef.current.recoverMediaError();
                      break;
                  default:
                      console.error("HLS Fatal Error:", data);
                      if(hlsRef.current) hlsRef.current.destroy();
                      setError("再生エラーが発生しました。");
                      break;
              }
          }
      };

      if (Hls.isSupported()) {
        const hls = new Hls({
          xhrSetup: function (xhr, url) {
              // Some proxies might require specific headers
          }
        });
        hlsRef.current = hls;
        
        hls.loadSource(src); // Direct SRC, parent handles proxy
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoPlay) {
              video.play().catch(e => console.warn("Autoplay prevented:", e));
          }
        });

        hls.on(Hls.Events.ERROR, handleHlsError);

        return () => {
          hls.destroy();
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = src; // Direct SRC

        if (autoPlay) {
          video.addEventListener('loadedmetadata', () => {
            video.play().catch(e => console.warn("Autoplay prevented:", e));
          });
        }
        // Basic native error handling
        video.addEventListener('error', (e) => {
            console.error("Native Video Error", e);
            setError("再生できませんでした。");
        });
      } else {
          // Attempt to play anyway (MP4 fallback)
          video.src = src; // Direct SRC
          if (autoPlay) {
             video.play().catch(() => {});
          }
      }
    }, [src, autoPlay]);

    return (
      <div className={`relative w-full h-full bg-black ${className || ''}`}>
          {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 text-white p-4 text-center">
                  <div>
                      <p className="mb-2 font-bold text-red-500">エラー</p>
                      <p className="text-sm">{error}</p>
                  </div>
              </div>
          )}
          <video
              ref={internalVideoRef}
              controls={controls}
              autoPlay={autoPlay}
              className="w-full h-full object-contain"
              playsInline={playsInline}
              data-v-a03ccfac="" 
          />
      </div>
    );
  }
);

HlsVideoPlayer.displayName = 'HlsVideoPlayer';

export default HlsVideoPlayer;
