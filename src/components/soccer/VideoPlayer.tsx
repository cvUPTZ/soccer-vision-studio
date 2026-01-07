import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ChevronLeft, 
  ChevronRight,
  Maximize,
  Volume2
} from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  onTimeUpdate?: (time: number) => void;
  onLoadedMetadata?: (duration: number, width: number, height: number) => void;
}

export interface VideoPlayerRef {
  getCurrentTime: () => number;
  seekTo: (time: number) => void;
  pause: () => void;
  play: () => void;
  getVideoElement: () => HTMLVideoElement | null;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ src, onTimeUpdate, onLoadedMetadata }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [playbackRate, setPlaybackRate] = React.useState(1);

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => videoRef.current?.currentTime || 0,
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      pause: () => videoRef.current?.pause(),
      play: () => videoRef.current?.play(),
      getVideoElement: () => videoRef.current,
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleTimeUpdate = () => {
        setCurrentTime(video.currentTime);
        onTimeUpdate?.(video.currentTime);
      };

      const handleLoadedMetadata = () => {
        setDuration(video.duration);
        onLoadedMetadata?.(video.duration, video.videoWidth, video.videoHeight);
      };

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
      };
    }, [onTimeUpdate, onLoadedMetadata]);

    const togglePlay = () => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play();
        }
      }
    };

    const stepFrame = (direction: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime += direction * (1 / 30); // Assuming 30fps
      }
    };

    const skip = (seconds: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime += seconds;
      }
    };

    const handleSeek = (value: number[]) => {
      if (videoRef.current) {
        videoRef.current.currentTime = value[0];
      }
    };

    const changePlaybackRate = () => {
      const rates = [0.25, 0.5, 1, 1.5, 2];
      const currentIndex = rates.indexOf(playbackRate);
      const nextIndex = (currentIndex + 1) % rates.length;
      const newRate = rates[nextIndex];
      setPlaybackRate(newRate);
      if (videoRef.current) {
        videoRef.current.playbackRate = newRate;
      }
    };

    const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      const frames = Math.floor((time % 1) * 30);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    };

    return (
      <div className="flex flex-col bg-card rounded-lg overflow-hidden">
        <div className="relative">
          <video
            ref={videoRef}
            src={src}
            className="w-full aspect-video bg-black"
            onClick={togglePlay}
          />
        </div>
        
        {/* Timeline */}
        <div className="px-4 py-2 bg-muted/50">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.033}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-t border-border">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => skip(-10)}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => stepFrame(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={togglePlay} className="h-10 w-10">
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => stepFrame(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => skip(10)}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <Button variant="ghost" size="sm" onClick={changePlaybackRate} className="text-xs">
              {playbackRate}x
            </Button>
            <Button variant="ghost" size="icon">
              <Volume2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
