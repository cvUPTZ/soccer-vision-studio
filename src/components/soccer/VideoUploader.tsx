import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Link, Video } from 'lucide-react';

interface VideoUploaderProps {
  onVideoSelect: (url: string) => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideoSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = React.useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onVideoSelect(url);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onVideoSelect(urlInput.trim());
      setUrlInput('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-card rounded-lg border-2 border-dashed border-border p-8">
      <Video className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">Load a Video</h2>
      <p className="text-muted-foreground mb-6 text-center">
        Upload a video file or provide a URL to start annotating
      </p>

      <div className="flex flex-col gap-4 w-full max-w-md">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="default"
          size="lg"
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          <Upload className="h-5 w-5 mr-2" />
          Upload Video File
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Enter video URL..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
          />
          <Button variant="outline" onClick={handleUrlSubmit}>
            <Link className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Supported formats: MP4, WebM, MOV
        </p>
      </div>
    </div>
  );
};
