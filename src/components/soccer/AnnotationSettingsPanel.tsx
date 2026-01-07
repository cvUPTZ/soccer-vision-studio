import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Undo2, Layers, Settings2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface AnnotationSettingsPanelProps {
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  showDistances: boolean;
  onShowDistancesChange: (show: boolean) => void;
  speedUnit: 'km/h' | 'mph';
  onSpeedUnitChange: (unit: 'km/h' | 'mph') => void;
  autoplayClips: boolean;
  onAutoplayClipsChange: (autoplay: boolean) => void;
  touchMode: boolean;
  onTouchModeChange: (touch: boolean) => void;
  resumePauseManually: boolean;
  onResumePauseManuallyChange: (manual: boolean) => void;
  onDeleteSelected?: () => void;
  onUndo?: () => void;
}

export const AnnotationSettingsPanel: React.FC<AnnotationSettingsPanelProps> = ({
  strokeWidth,
  onStrokeWidthChange,
  showDistances,
  onShowDistancesChange,
  speedUnit,
  onSpeedUnitChange,
  autoplayClips,
  onAutoplayClipsChange,
  touchMode,
  onTouchModeChange,
  resumePauseManually,
  onResumePauseManuallyChange,
  onDeleteSelected,
  onUndo,
}) => {
  return (
    <div className="space-y-2">
      {/* Shape Settings */}
      <Card className="bg-card/95 backdrop-blur border-border/50">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-2">
            <Settings2 className="h-3 w-3" />
            Shape
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Width</Label>
              <span className="text-xs text-muted-foreground">{strokeWidth}px</span>
            </div>
            <Slider
              value={[strokeWidth]}
              min={1}
              max={10}
              step={1}
              onValueChange={(v) => onStrokeWidthChange(v[0])}
              className="w-full"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Distance</Label>
            <Switch
              checked={showDistances}
              onCheckedChange={onShowDistancesChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDeleteSelected}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start h-8"
          onClick={onUndo}
        >
          <Undo2 className="h-4 w-4 mr-2" />
          Undo
        </Button>
      </div>

      {/* Settings Toggles */}
      <Card className="bg-card/95 backdrop-blur border-border/50">
        <CardContent className="py-3 px-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Resume Pause manually</Label>
            <Switch
              checked={resumePauseManually}
              onCheckedChange={onResumePauseManuallyChange}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Touch Mode</Label>
            <Switch
              checked={touchMode}
              onCheckedChange={onTouchModeChange}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Speed Unit</Label>
            <ToggleGroup 
              type="single" 
              value={speedUnit}
              onValueChange={(v) => v && onSpeedUnitChange(v as 'km/h' | 'mph')}
              className="gap-0"
            >
              <ToggleGroupItem 
                value="km/h" 
                className="h-6 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                km/h
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="mph" 
                className="h-6 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                mph
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Autoplay Clips</Label>
            <Switch
              checked={autoplayClips}
              onCheckedChange={onAutoplayClipsChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Layers Toggle */}
      <Button variant="outline" size="sm" className="w-full justify-start h-8">
        <Layers className="h-4 w-4 mr-2" />
        Layers
      </Button>
    </div>
  );
};
