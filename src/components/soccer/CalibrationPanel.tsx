import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Check, AlertCircle } from 'lucide-react';
import type { CalibrationPoint } from '@/types/annotation';
import { PITCH_REFERENCE_POINTS } from './PitchDiagram';

interface CalibrationPanelProps {
  calibrationPoints: CalibrationPoint[];
  onRemovePoint: (index: number) => void;
  onCalibrate: () => void;
  onClear: () => void;
  isCalibrated: boolean;
  isLoading: boolean;
}

export const CalibrationPanel: React.FC<CalibrationPanelProps> = ({
  calibrationPoints,
  onRemovePoint,
  onCalibrate,
  onClear,
  isCalibrated,
  isLoading,
}) => {
  const minPointsRequired = 4;
  const hasEnoughPoints = calibrationPoints.length >= minPointsRequired;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Homography Calibration</CardTitle>
          {isCalibrated && (
            <Badge variant="default" className="bg-green-500">
              <Check className="h-3 w-3 mr-1" />
              Calibrated
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground">
          <p>Click on reference points in the video, then on the corresponding points in the 2D pitch diagram.</p>
          <p className="mt-1">Minimum {minPointsRequired} points required for calibration.</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Calibration Points</span>
            <Badge variant="outline">
              {calibrationPoints.length} / {minPointsRequired}+
            </Badge>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1">
            {calibrationPoints.map((point, index) => {
              const refPoint = PITCH_REFERENCE_POINTS.find(
                (p) => p.x === point.pitchX && p.y === point.pitchY
              );
              return (
                <div
                  key={index}
                  className="flex items-center justify-between py-1 px-2 bg-muted rounded text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">#{index + 1}</span>
                    <span>{refPoint?.label || `(${point.pitchX.toFixed(1)}, ${point.pitchY.toFixed(1)})`}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRemovePoint(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          {calibrationPoints.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
              <AlertCircle className="h-4 w-4" />
              No calibration points added yet
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onCalibrate}
            disabled={!hasEnoughPoints || isLoading}
            className="flex-1"
            size="sm"
          >
            {isLoading ? 'Calibrating...' : 'Calibrate'}
          </Button>
          <Button
            variant="outline"
            onClick={onClear}
            disabled={calibrationPoints.length === 0}
            size="sm"
          >
            Clear
          </Button>
        </div>

        {!hasEnoughPoints && calibrationPoints.length > 0 && (
          <p className="text-xs text-amber-500">
            Add {minPointsRequired - calibrationPoints.length} more point(s) to enable calibration
          </p>
        )}
      </CardContent>
    </Card>
  );
};
