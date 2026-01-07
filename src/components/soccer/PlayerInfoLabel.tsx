import React from 'react';
import { Check, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlayerInfoLabelProps {
  number: string;
  name: string;
  speed?: number;
  speedUnit?: 'km/h' | 'mph';
  color: string;
  onConfirm?: () => void;
  onDelete?: () => void;
  onMore?: () => void;
  showControls?: boolean;
}

export const PlayerInfoLabel: React.FC<PlayerInfoLabelProps> = ({
  number,
  name,
  speed,
  speedUnit = 'km/h',
  color,
  onConfirm,
  onDelete,
  onMore,
  showControls = true,
}) => {
  const displaySpeed = speedUnit === 'mph' && speed 
    ? (speed * 0.621371).toFixed(1) 
    : speed?.toFixed(1);

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
        className="px-3 py-1.5 rounded text-white text-sm font-medium shadow-lg"
        style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold">{number}</span>
          <span className="text-gray-200">{name}</span>
        </div>
        {speed !== undefined && (
          <div className="text-center text-xs text-gray-300 mt-0.5">
            {displaySpeed} {speedUnit}
          </div>
        )}
      </div>
    </div>
  );
};
