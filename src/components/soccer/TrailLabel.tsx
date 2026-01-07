import React, { useState } from 'react';
import { Check, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TrailLabelProps {
  label: string;
  color: string;
  type: 'trace' | 'future';
  onLabelChange?: (newLabel: string) => void;
  onConfirm?: () => void;
  onDelete?: () => void;
  onMore?: () => void;
  showControls?: boolean;
}

export const TrailLabel: React.FC<TrailLabelProps> = ({
  label,
  color,
  type,
  onLabelChange,
  onConfirm,
  onDelete,
  onMore,
  showControls = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(label);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== label) {
      onLabelChange?.(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(label);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {showControls && (
        <div className="flex items-center gap-1 mb-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 bg-primary text-primary-foreground hover:bg-primary/90 rounded"
            onClick={onConfirm}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 bg-muted text-muted-foreground hover:bg-muted/90 rounded"
            onClick={onMore}
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div 
        className="flex items-center gap-2 px-3 py-1.5 rounded text-white text-sm font-medium shadow-lg cursor-pointer"
        style={{ backgroundColor: 'rgba(30,41,59,0.95)' }}
        onDoubleClick={handleDoubleClick}
      >
        <div 
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: color }}
        />
        {isEditing ? (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="h-5 w-24 text-xs bg-transparent border-none p-0 focus-visible:ring-0"
            autoFocus
          />
        ) : (
          <span>{type === 'future' ? 'Future Trail' : label || 'Trace'}</span>
        )}
      </div>
    </div>
  );
};
