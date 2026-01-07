import React, { useState } from 'react';
import { Input } from '@/components/ui/input';

interface ClipNameBadgeProps {
  currentClipIndex: number;
  totalClips: number;
  clipName: string;
  onNameChange?: (newName: string) => void;
}

export const ClipNameBadge: React.FC<ClipNameBadgeProps> = ({
  currentClipIndex,
  totalClips,
  clipName,
  onNameChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(clipName);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(clipName);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== clipName) {
      onNameChange?.(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(clipName);
    }
  };

  return (
    <div 
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur border border-border shadow-lg cursor-pointer"
      onDoubleClick={handleDoubleClick}
    >
      <span className="text-sm font-medium text-muted-foreground">
        {currentClipIndex}/{totalClips}
      </span>
      {isEditing ? (
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="h-5 w-32 text-sm bg-transparent border-none p-0 focus-visible:ring-0"
          autoFocus
        />
      ) : (
        <span className="text-sm font-medium">{clipName || 'Untitled Clip'}</span>
      )}
    </div>
  );
};
