import React from 'react';
import type { PlayerMarker, CalibrationPoint } from '@/types/annotation';

interface PitchDiagramProps {
  players: PlayerMarker[];
  calibrationPoints: CalibrationPoint[];
  calibrationMode?: boolean;
  onPitchClick?: (x: number, y: number) => void;
  selectedCalibrationIndex?: number;
}

// Standard pitch dimensions in meters
const PITCH_WIDTH = 105;
const PITCH_HEIGHT = 68;
const SVG_WIDTH = 420;
const SVG_HEIGHT = 272;

// Calibration reference points (in meters from top-left)
export const PITCH_REFERENCE_POINTS = [
  { x: 0, y: 0, label: 'Top-Left Corner' },
  { x: PITCH_WIDTH, y: 0, label: 'Top-Right Corner' },
  { x: PITCH_WIDTH, y: PITCH_HEIGHT, label: 'Bottom-Right Corner' },
  { x: 0, y: PITCH_HEIGHT, label: 'Bottom-Left Corner' },
  { x: PITCH_WIDTH / 2, y: 0, label: 'Top Center' },
  { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT, label: 'Bottom Center' },
  { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2, label: 'Center Spot' },
  { x: 11, y: PITCH_HEIGHT / 2, label: 'Left Penalty Spot' },
  { x: PITCH_WIDTH - 11, y: PITCH_HEIGHT / 2, label: 'Right Penalty Spot' },
];

export const PitchDiagram: React.FC<PitchDiagramProps> = ({
  players,
  calibrationPoints,
  calibrationMode,
  onPitchClick,
  selectedCalibrationIndex,
}) => {
  const toSvgX = (meters: number) => (meters / PITCH_WIDTH) * SVG_WIDTH;
  const toSvgY = (meters: number) => (meters / PITCH_HEIGHT) * SVG_HEIGHT;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPitchClick || !calibrationMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PITCH_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * PITCH_HEIGHT;
    onPitchClick(x, y);
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold mb-2 text-foreground">2D Tactical View</h3>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full bg-emerald-600 rounded cursor-crosshair"
        onClick={handleClick}
      >
        {/* Pitch outline */}
        <rect x="2" y="2" width={SVG_WIDTH - 4} height={SVG_HEIGHT - 4} fill="none" stroke="white" strokeWidth="2" />
        
        {/* Center line */}
        <line x1={SVG_WIDTH / 2} y1="2" x2={SVG_WIDTH / 2} y2={SVG_HEIGHT - 2} stroke="white" strokeWidth="2" />
        
        {/* Center circle */}
        <circle cx={SVG_WIDTH / 2} cy={SVG_HEIGHT / 2} r={toSvgX(9.15)} fill="none" stroke="white" strokeWidth="2" />
        
        {/* Center spot */}
        <circle cx={SVG_WIDTH / 2} cy={SVG_HEIGHT / 2} r="3" fill="white" />
        
        {/* Left penalty area */}
        <rect x="2" y={toSvgY(13.84)} width={toSvgX(16.5)} height={toSvgY(40.32)} fill="none" stroke="white" strokeWidth="2" />
        
        {/* Left goal area */}
        <rect x="2" y={toSvgY(24.84)} width={toSvgX(5.5)} height={toSvgY(18.32)} fill="none" stroke="white" strokeWidth="2" />
        
        {/* Left penalty spot */}
        <circle cx={toSvgX(11)} cy={SVG_HEIGHT / 2} r="3" fill="white" />
        
        {/* Right penalty area */}
        <rect x={SVG_WIDTH - 2 - toSvgX(16.5)} y={toSvgY(13.84)} width={toSvgX(16.5)} height={toSvgY(40.32)} fill="none" stroke="white" strokeWidth="2" />
        
        {/* Right goal area */}
        <rect x={SVG_WIDTH - 2 - toSvgX(5.5)} y={toSvgY(24.84)} width={toSvgX(5.5)} height={toSvgY(18.32)} fill="none" stroke="white" strokeWidth="2" />
        
        {/* Right penalty spot */}
        <circle cx={SVG_WIDTH - toSvgX(11)} cy={SVG_HEIGHT / 2} r="3" fill="white" />

        {/* Calibration reference points */}
        {calibrationMode && PITCH_REFERENCE_POINTS.map((point, index) => {
          const isUsed = calibrationPoints.some(cp => cp.pitchX === point.x && cp.pitchY === point.y);
          const isSelected = selectedCalibrationIndex !== undefined && 
            calibrationPoints[selectedCalibrationIndex]?.pitchX === point.x &&
            calibrationPoints[selectedCalibrationIndex]?.pitchY === point.y;
          
          return (
            <g key={index}>
              <circle
                cx={toSvgX(point.x)}
                cy={toSvgY(point.y)}
                r="8"
                fill={isUsed ? '#22c55e' : isSelected ? '#eab308' : '#3b82f6'}
                stroke="white"
                strokeWidth="2"
                className="cursor-pointer hover:opacity-80"
                onClick={(e) => {
                  e.stopPropagation();
                  onPitchClick?.(point.x, point.y);
                }}
              />
              <text
                x={toSvgX(point.x)}
                y={toSvgY(point.y) - 12}
                textAnchor="middle"
                className="text-[10px] fill-white font-medium"
              >
                {index + 1}
              </text>
            </g>
          );
        })}

        {/* Player markers */}
        {!calibrationMode && players.map((player) => {
          if (player.pitchX === undefined || player.pitchY === undefined) return null;
          return (
            <g key={player.id}>
              <circle
                cx={toSvgX(player.pitchX)}
                cy={toSvgY(player.pitchY)}
                r="10"
                fill={player.teamColor}
                stroke="white"
                strokeWidth="2"
              />
              <text
                x={toSvgX(player.pitchX)}
                y={toSvgY(player.pitchY) + 4}
                textAnchor="middle"
                className="text-[10px] fill-white font-bold"
              >
                {player.number}
              </text>
            </g>
          );
        })}
      </svg>
      
      {calibrationMode && (
        <p className="text-xs text-muted-foreground mt-2">
          Click on reference points to set their video positions
        </p>
      )}
    </div>
  );
};
