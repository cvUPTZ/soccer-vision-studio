import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Trash2, Bookmark } from 'lucide-react';
import type { VideoClip } from '@/types/annotation';

interface ClipManagerProps {
  clips: VideoClip[];
  currentTime: number;
  onAddClip: (clip: VideoClip) => void;
  onDeleteClip: (id: string) => void;
  onSeekToClip: (time: number) => void;
}

export const ClipManager: React.FC<ClipManagerProps> = ({
  clips,
  currentTime,
  onAddClip,
  onDeleteClip,
  onSeekToClip,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [clipName, setClipName] = useState('');
  const [clipStart, setClipStart] = useState(0);

  const startAddingClip = () => {
    setClipStart(currentTime);
    setClipName(`Clip ${clips.length + 1}`);
    setIsAdding(true);
  };

  const confirmAddClip = () => {
    onAddClip({
      id: `clip-${Date.now()}`,
      name: clipName,
      startTime: clipStart,
      endTime: currentTime,
    });
    setIsAdding(false);
    setClipName('');
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Clips</CardTitle>
          <Badge variant="outline">{clips.length} clips</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdding ? (
          <div className="space-y-2 p-2 bg-muted rounded-lg">
            <Input
              value={clipName}
              onChange={(e) => setClipName(e.target.value)}
              placeholder="Clip name..."
              className="h-8 text-sm"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bookmark className="h-3 w-3" />
              <span>{formatTime(clipStart)} - {formatTime(currentTime)}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmAddClip} className="flex-1">
                Save Clip
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={startAddingClip}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Mark Clip Start
          </Button>
        )}

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {clips.map((clip, index) => (
            <div
              key={clip.id}
              className="flex items-center justify-between p-2 bg-muted/50 rounded hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {index + 1}/{clips.length}
                </span>
                <div>
                  <p className="text-sm font-medium">{clip.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onSeekToClip(clip.startTime)}
                >
                  <Play className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onDeleteClip(clip.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {clips.length === 0 && !isAdding && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No clips saved yet. Mark important moments!
          </p>
        )}
      </CardContent>
    </Card>
  );
};
