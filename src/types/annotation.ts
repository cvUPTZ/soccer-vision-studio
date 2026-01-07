export type AnnotationTool = 
  | 'select' 
  | 'player' 
  | 'distance' 
  | 'trail' 
  | 'arrow' 
  | 'rectangle' 
  | 'circle' 
  | 'freehand'
  | 'calibrate';

export interface PlayerMarker {
  id: string;
  x: number;
  y: number;
  name: string;
  number: string;
  teamColor: string;
  pitchX?: number;
  pitchY?: number;
}

export interface DistanceMeasurement {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  distance?: number; // in meters
}

export interface MovementTrail {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  playerId?: string;
}

export interface CalibrationPoint {
  videoX: number;
  videoY: number;
  pitchX: number;
  pitchY: number;
}

export interface HomographyMatrix {
  matrix: number[][];
  calibrationPoints: CalibrationPoint[];
}

export interface VideoClip {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
}

export interface AnnotationState {
  players: PlayerMarker[];
  distances: DistanceMeasurement[];
  trails: MovementTrail[];
  calibration: CalibrationPoint[];
  homographyMatrix: HomographyMatrix | null;
}
