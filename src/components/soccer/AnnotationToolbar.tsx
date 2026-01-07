import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  MousePointer, 
  User, 
  Ruler, 
  MoveRight, 
  ArrowRight,
  Square,
  Circle,
  Pencil,
  Grid3X3,
  Trash2,
  Download,
  Undo,
  Redo,
  Lightbulb,
  TrendingUp
} from 'lucide-react';
import type { AnnotationTool } from '@/types/annotation';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  isCalibrated: boolean;
  trailType?: 'trace' | 'future';
  onTrailTypeChange?: (type: 'trace' | 'future') => void;
}

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  activeTool,
  onToolChange,
  onClear,
  onUndo,
  onRedo,
  onExport,
  isCalibrated,
  trailType = 'trace',
  onTrailTypeChange,
}) => {
  const tools: { id: AnnotationTool; icon: React.ReactNode; label: string; requiresCalibration?: boolean }[] = [
    { id: 'select', icon: <MousePointer className="h-4 w-4" />, label: 'Select' },
    { id: 'calibrate', icon: <Grid3X3 className="h-4 w-4" />, label: 'Calibrate' },
    { id: 'player', icon: <User className="h-4 w-4" />, label: 'Player Marker' },
    { id: 'spotlight', icon: <Lightbulb className="h-4 w-4" />, label: 'Cylinder Spotlight' },
    { id: 'distance', icon: <Ruler className="h-4 w-4" />, label: 'Distance', requiresCalibration: true },
    { id: 'trail', icon: <MoveRight className="h-4 w-4" />, label: 'Trace Trail' },
    { id: 'arrow', icon: <ArrowRight className="h-4 w-4" />, label: 'Arrow' },
    { id: 'rectangle', icon: <Square className="h-4 w-4" />, label: 'Rectangle Zone' },
    { id: 'circle', icon: <Circle className="h-4 w-4" />, label: 'Circle Zone' },
    { id: 'freehand', icon: <Pencil className="h-4 w-4" />, label: 'Freehand' },
  ];

  return (
    <div className="flex items-center gap-1 p-2 bg-card rounded-lg border border-border">
      {tools.map((tool) => (
        <Button
          key={tool.id}
          variant={activeTool === tool.id ? 'default' : 'ghost'}
          size="icon"
          onClick={() => onToolChange(tool.id)}
          title={tool.label}
          disabled={tool.requiresCalibration && !isCalibrated}
          className={cn(
            "relative",
            tool.id === 'calibrate' && !isCalibrated && "ring-2 ring-primary ring-offset-2"
          )}
        >
          {tool.icon}
        </Button>
      ))}
      
      {/* Trail Type Toggle (show when trail tool is active) */}
      {activeTool === 'trail' && (
        <>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <ToggleGroup 
            type="single" 
            value={trailType}
            onValueChange={(v) => v && onTrailTypeChange?.(v as 'trace' | 'future')}
            className="gap-0"
          >
            <ToggleGroupItem 
              value="trace" 
              className="h-8 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              title="Trace (past movement)"
            >
              <MoveRight className="h-3 w-3 mr-1" />
              Trace
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="future" 
              className="h-8 px-3 text-xs data-[state=on]:bg-orange-500 data-[state=on]:text-white"
              title="Future (predicted movement)"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              Future
            </ToggleGroupItem>
          </ToggleGroup>
        </>
      )}
      
      <Separator orientation="vertical" className="h-6 mx-2" />
      
      <Button variant="ghost" size="icon" onClick={onUndo} title="Undo">
        <Undo className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onRedo} title="Redo">
        <Redo className="h-4 w-4" />
      </Button>
      
      <Separator orientation="vertical" className="h-6 mx-2" />
      
      <Button variant="ghost" size="icon" onClick={onClear} title="Clear All">
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onExport} title="Export">
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
};
