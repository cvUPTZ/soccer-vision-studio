import React from 'react';
import type { PlayerMarker, DistanceMeasurement, MovementTrail, CalibrationPoint } from '@/types/annotation';

interface PitchDiagramProps {
  players: PlayerMarker[];
  distances: DistanceMeasurement[];
  trails: MovementTrail[];
  calibrationPoints: CalibrationPoint[];
  calibrationMode?: boolean;
  onPitchClick?: (x: number, y: number) => void;
  selectedCalibrationIndex?: number;
  transformPoint?: (videoX: number, videoY: number) => { pitchX: number; pitchY: number } | null;
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
  distances,
  trails,
  calibrationPoints,
  calibrationMode,
  onPitchClick,
  selectedCalibrationIndex,
  transformPoint,
}) => {
  const toSvgX = (meters: number) => (meters / PITCH_WIDTH) * SVG_WIDTH;
  const toSvgY = (meters: number) => (meters / PITCH_HEIGHT) * SVG_HEIGHT;

  // Transform video coordinates to SVG coordinates
  const videoToSvg = (videoX: number, videoY: number) => {
    if (!transformPoint) return null;
    const pitch = transformPoint(videoX, videoY);
    if (!pitch) return null;
    // Clamp to pitch bounds
    const clampedX = Math.max(0, Math.min(PITCH_WIDTH, pitch.pitchX));
    const clampedY = Math.max(0, Math.min(PITCH_HEIGHT, pitch.pitchY));
    return { x: toSvgX(clampedX), y: toSvgY(clampedY) };
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPitchClick || !calibrationMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PITCH_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * PITCH_HEIGHT;
    onPitchClick(x, y);
  };

  // Calculate real distance between two points
  const calculateRealDistance = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.round(Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)));
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold mb-2 text-foreground">2D Tactical View (Bird's Eye)</h3>
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

        {/* Movement trails - transformed to 2D */}
        {!calibrationMode && trails.map((trail) => {
          const transformedPoints = trail.points
            .map(p => videoToSvg(p.x, p.y))
            .filter((p): p is { x: number; y: number } => p !== null);
          
          if (transformedPoints.length < 2) return null;
          
          const pathData = transformedPoints
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
            .join(' ');
          
          // Arrow head at end
          const last = transformedPoints[transformedPoints.length - 1];
          const secondLast = transformedPoints[transformedPoints.length - 2];
          const angle = Math.atan2(last.y - secondLast.y, last.x - secondLast.x);
          
          return (
            <g key={trail.id}>
              <path
                d={pathData}
                fill="none"
                stroke={trail.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polygon
                points={`0,-5 10,0 0,5`}
                fill={trail.color}
                transform={`translate(${last.x}, ${last.y}) rotate(${angle * 180 / Math.PI})`}
              />
            </g>
          );
        })}

        {/* Distance measurements - transformed to 2D with accurate meters */}
        {!calibrationMode && distances.map((dist) => {
          const start = videoToSvg(dist.startX, dist.startY);
          const end = videoToSvg(dist.endX, dist.endY);
          
          if (!start || !end) return null;
          
          // Get the pitch coordinates for accurate distance
          const startPitch = transformPoint?.(dist.startX, dist.startY);
          const endPitch = transformPoint?.(dist.endX, dist.endY);
          
          let realDistance = dist.distance || 0;
          if (startPitch && endPitch) {
            realDistance = calculateRealDistance(startPitch.pitchX, startPitch.pitchY, endPitch.pitchX, endPitch.pitchY);
          }
          
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;
          
          return (
            <g key={dist.id}>
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="#ffffff"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
              <circle cx={start.x} cy={start.y} r="4" fill="#ffffff" />
              <circle cx={end.x} cy={end.y} r="4" fill="#ffffff" />
              <rect
                x={midX - 16}
                y={midY - 10}
                width="32"
                height="16"
                fill="rgba(0,0,0,0.8)"
                rx="3"
              />
              <text
                x={midX}
                y={midY + 4}
                textAnchor="middle"
                className="text-[11px] fill-white font-bold"
              >
                {realDistance}m
              </text>
            </g>
          );
        })}

        {/* Player markers - transformed to 2D */}
        {!calibrationMode && players.map((player) => {
          let svgPos: { x: number; y: number } | null = null;
          
          if (player.pitchX !== undefined && player.pitchY !== undefined) {
            svgPos = { x: toSvgX(player.pitchX), y: toSvgY(player.pitchY) };
          } else {
            svgPos = videoToSvg(player.x, player.y);
          }
          
          if (!svgPos) return null;
          
          return (
            <g key={player.id}>
              <circle
                cx={svgPos.x}
                cy={svgPos.y}
                r="12"
                fill={player.teamColor}
                stroke="white"
                strokeWidth="2"
              />
              <text
                x={svgPos.x}
                y={svgPos.y + 4}
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
      
      {!calibrationMode && (
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>105m × 68m pitch</span>
          <span>{players.length} players • {distances.length} measurements</span>
        </div>
      )}
    </div>
  );
};
