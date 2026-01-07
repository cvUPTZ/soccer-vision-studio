import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, Circle, Rect, Line, Path, Group, FabricText, Triangle, Polygon, FabricObject, TPointerEventInfo } from 'fabric';
import type { AnnotationTool, PlayerMarker, DistanceMeasurement, MovementTrail, CalibrationPoint } from '@/types/annotation';
import { toast } from 'sonner';

// Extend FabricObject to include custom data
interface CustomFabricObject extends FabricObject {
  data?: { type: string; id?: string };
}

interface AnnotationCanvasProps {
  width: number;
  height: number;
  activeTool: AnnotationTool;
  activeColor: string;
  teamColors: { home: string; away: string };
  onPlayerAdd: (player: PlayerMarker) => void;
  onDistanceAdd: (distance: DistanceMeasurement) => void;
  onTrailAdd: (trail: MovementTrail) => void;
  onSpotlightAdd: (spotlight: { id: string; x: number; y: number; color: string }) => void;
  onCalibrationPointAdd: (point: { videoX: number; videoY: number }) => void;
  calibrationPoints: CalibrationPoint[];
  homographyMatrix: number[][] | null;
  calculateDistance?: (x1: number, y1: number, x2: number, y2: number) => Promise<number>;
  strokeWidth?: number;
  trailType?: 'trace' | 'future';
}

// ============= HOMOGRAPHY TRANSFORMATION HELPERS =============

// Compute inverse of 3x3 homography matrix
const invertHomography = (H: number[][]): number[][] | null => {
  const [[a, b, c], [d, e, f], [g, h, i]] = H;
  
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-10) return null;
  
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
};

// Transform video coordinates to field (pitch) coordinates
const videoToField = (
  videoX: number, 
  videoY: number, 
  H: number[][]
): { x: number; y: number } | null => {
  const [[a, b, c], [d, e, f], [g, h, i]] = H;
  const w = g * videoX + h * videoY + i;
  
  if (Math.abs(w) < 1e-10) return null;
  
  return {
    x: (a * videoX + b * videoY + c) / w,
    y: (d * videoX + e * videoY + f) / w,
  };
};

// Transform field (pitch) coordinates to video coordinates using inverse homography
const fieldToVideo = (
  fieldX: number, 
  fieldY: number, 
  invH: number[][]
): { x: number; y: number } | null => {
  const w = invH[2][0] * fieldX + invH[2][1] * fieldY + invH[2][2];
  if (Math.abs(w) < 1e-10) return null;
  
  return {
    x: (invH[0][0] * fieldX + invH[0][1] * fieldY + invH[0][2]) / w,
    y: (invH[1][0] * fieldX + invH[1][1] * fieldY + invH[1][2]) / w,
  };
};

// ============= PERSPECTIVE SHAPE CREATORS =============

/**
 * Create a ground-level ellipse (flat on the grass surface)
 * Takes center point and a second point to define the ellipse size/shape
 * The ellipse is created in field space and projected back to video
 */
const createGroundEllipse = (
  videoCenterX: number,
  videoCenterY: number,
  videoEdgeX: number,
  videoEdgeY: number,
  H: number[][] | null,
  color: string,
  strokeWidth: number = 3
): Path | Circle => {
  if (!H) {
    // Fallback: simple perspective ellipse based on Y position
    const scale = 0.4 + (videoCenterY / 600) * 0.6;
    const radiusX = Math.abs(videoEdgeX - videoCenterX);
    const radiusY = Math.abs(videoEdgeY - videoCenterY) * scale * 0.5; // Flatten for perspective
    
    // Create ellipse as a path
    const numPoints = 48;
    const points: { x: number; y: number }[] = [];
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const px = videoCenterX + Math.cos(angle) * radiusX;
      const py = videoCenterY + Math.sin(angle) * radiusY;
      points.push({ x: px, y: py });
    }
    
    let pathData = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathData += ` L ${points[i].x} ${points[i].y}`;
    }
    pathData += ' Z';
    
    return new Path(pathData, {
      fill: 'transparent',
      stroke: color,
      strokeWidth: strokeWidth,
      selectable: true,
    });
  }

  const invH = invertHomography(H);
  if (!invH) {
    return createGroundEllipse(videoCenterX, videoCenterY, videoEdgeX, videoEdgeY, null, color, strokeWidth);
  }

  // Transform center and edge to field coordinates
  const fieldCenter = videoToField(videoCenterX, videoCenterY, H);
  const fieldEdge = videoToField(videoEdgeX, videoEdgeY, H);
  
  if (!fieldCenter || !fieldEdge) {
    return createGroundEllipse(videoCenterX, videoCenterY, videoEdgeX, videoEdgeY, null, color, strokeWidth);
  }

  // Calculate ellipse radii in field space (meters)
  const radiusX = Math.abs(fieldEdge.x - fieldCenter.x);
  const radiusY = Math.abs(fieldEdge.y - fieldCenter.y);
  
  // Use the larger dimension if one is zero
  const effectiveRadiusX = radiusX > 0.1 ? radiusX : Math.max(radiusX, radiusY);
  const effectiveRadiusY = radiusY > 0.1 ? radiusY : Math.max(radiusX, radiusY);

  // Generate ellipse points on the field plane
  const numPoints = 64;
  const videoPoints: { x: number; y: number }[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const fieldX = fieldCenter.x + Math.cos(angle) * effectiveRadiusX;
    const fieldY = fieldCenter.y + Math.sin(angle) * effectiveRadiusY;
    
    // Project field point back to video
    const videoPoint = fieldToVideo(fieldX, fieldY, invH);
    if (videoPoint) {
      videoPoints.push(videoPoint);
    }
  }

  if (videoPoints.length < 3) {
    return createGroundEllipse(videoCenterX, videoCenterY, videoEdgeX, videoEdgeY, null, color, strokeWidth);
  }

  // Create smooth curved path through points
  let pathData = `M ${videoPoints[0].x} ${videoPoints[0].y}`;
  for (let i = 1; i < videoPoints.length; i++) {
    pathData += ` L ${videoPoints[i].x} ${videoPoints[i].y}`;
  }
  pathData += ' Z';

  return new Path(pathData, {
    fill: 'transparent',
    stroke: color,
    strokeWidth: strokeWidth,
    selectable: true,
  });
};

/**
 * Create a perspective-correct circle:
 * 1. User clicks at video position → transform to field coordinates
 * 2. Create circle points on the field plane (real meters)
 * 3. Project all points back to video → creates ellipse/warped shape
 */
const createPerspectiveCircle = (
  videoCenterX: number,
  videoCenterY: number,
  radiusMeters: number,
  H: number[][] | null,
  color: string,
  fill: boolean = false
): Path | Circle => {
  if (!H) {
    // Fallback: simple Y-based scaling
    const scale = 0.4 + (videoCenterY / 600) * 0.6;
    return new Circle({
      left: videoCenterX,
      top: videoCenterY,
      radius: radiusMeters * 10 * scale,
      fill: fill ? `${color}33` : 'transparent',
      stroke: color,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
    });
  }

  const invH = invertHomography(H);
  if (!invH) {
    return new Circle({
      left: videoCenterX,
      top: videoCenterY,
      radius: radiusMeters * 5,
      fill: fill ? `${color}33` : 'transparent',
      stroke: color,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
    });
  }

  // Step 1: Transform click position to field coordinates
  const fieldCenter = videoToField(videoCenterX, videoCenterY, H);
  if (!fieldCenter) {
    return new Circle({
      left: videoCenterX,
      top: videoCenterY,
      radius: radiusMeters * 5,
      fill: fill ? `${color}33` : 'transparent',
      stroke: color,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
    });
  }

  // Step 2: Generate circle points on the field plane (in real meters)
  const numPoints = 48;
  const videoPoints: { x: number; y: number }[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const fieldX = fieldCenter.x + Math.cos(angle) * radiusMeters;
    const fieldY = fieldCenter.y + Math.sin(angle) * radiusMeters;
    
    // Step 3: Project field point back to video
    const videoPoint = fieldToVideo(fieldX, fieldY, invH);
    if (videoPoint) {
      videoPoints.push(videoPoint);
    }
  }

  if (videoPoints.length < 3) {
    return new Circle({
      left: videoCenterX,
      top: videoCenterY,
      radius: radiusMeters * 5,
      fill: fill ? `${color}33` : 'transparent',
      stroke: color,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
    });
  }

  // Step 4: Create smooth curved path through points
  let pathData = `M ${videoPoints[0].x} ${videoPoints[0].y}`;
  for (let i = 1; i < videoPoints.length; i++) {
    pathData += ` L ${videoPoints[i].x} ${videoPoints[i].y}`;
  }
  pathData += ' Z';

  return new Path(pathData, {
    fill: fill ? `${color}33` : 'transparent',
    stroke: color,
    strokeWidth: 2,
    selectable: true,
  });
};

/**
 * Create a perspective-correct rectangle:
 * 1. Two clicks define corners in video space
 * 2. Transform both to field coordinates
 * 3. Create rectangle on field plane
 * 4. Project all 4 corners back to video → creates trapezoid
 */
const createPerspectiveRectangle = (
  videoStartX: number,
  videoStartY: number,
  videoEndX: number,
  videoEndY: number,
  H: number[][] | null,
  color: string
): Polygon | Rect => {
  if (!H) {
    // Fallback: simple perspective scaling
    const minY = Math.min(videoStartY, videoEndY);
    const maxY = Math.max(videoStartY, videoEndY);
    const minX = Math.min(videoStartX, videoEndX);
    const maxX = Math.max(videoStartX, videoEndX);
    
    const topScale = 0.6 + (minY / 600) * 0.4;
    const bottomScale = 0.6 + (maxY / 600) * 0.4;
    
    const centerX = (minX + maxX) / 2;
    const topWidth = (maxX - minX) * topScale;
    const bottomWidth = (maxX - minX) * bottomScale;
    
    const points = [
      { x: centerX - topWidth / 2, y: minY },
      { x: centerX + topWidth / 2, y: minY },
      { x: centerX + bottomWidth / 2, y: maxY },
      { x: centerX - bottomWidth / 2, y: maxY },
    ];
    
    return new Polygon(points, {
      fill: `${color}33`,
      stroke: color,
      strokeWidth: 2,
      selectable: true,
    });
  }

  const invH = invertHomography(H);
  if (!invH) {
    return new Rect({
      left: Math.min(videoStartX, videoEndX),
      top: Math.min(videoStartY, videoEndY),
      width: Math.abs(videoEndX - videoStartX),
      height: Math.abs(videoEndY - videoStartY),
      fill: `${color}33`,
      stroke: color,
      strokeWidth: 2,
      selectable: true,
    });
  }

  // Step 1: Transform video corners to field
  const fieldStart = videoToField(videoStartX, videoStartY, H);
  const fieldEnd = videoToField(videoEndX, videoEndY, H);
  
  if (!fieldStart || !fieldEnd) {
    return new Rect({
      left: Math.min(videoStartX, videoEndX),
      top: Math.min(videoStartY, videoEndY),
      width: Math.abs(videoEndX - videoStartX),
      height: Math.abs(videoEndY - videoStartY),
      fill: `${color}33`,
      stroke: color,
      strokeWidth: 2,
      selectable: true,
    });
  }

  // Step 2: Create rectangle corners on field plane
  const fieldMinX = Math.min(fieldStart.x, fieldEnd.x);
  const fieldMaxX = Math.max(fieldStart.x, fieldEnd.x);
  const fieldMinY = Math.min(fieldStart.y, fieldEnd.y);
  const fieldMaxY = Math.max(fieldStart.y, fieldEnd.y);
  
  const fieldCorners = [
    { x: fieldMinX, y: fieldMinY }, // top-left on field
    { x: fieldMaxX, y: fieldMinY }, // top-right on field
    { x: fieldMaxX, y: fieldMaxY }, // bottom-right on field
    { x: fieldMinX, y: fieldMaxY }, // bottom-left on field
  ];

  // Step 3: Project all field corners back to video
  const videoCorners: { x: number; y: number }[] = [];
  for (const fc of fieldCorners) {
    const vc = fieldToVideo(fc.x, fc.y, invH);
    if (!vc) {
      return new Rect({
        left: Math.min(videoStartX, videoEndX),
        top: Math.min(videoStartY, videoEndY),
        width: Math.abs(videoEndX - videoStartX),
        height: Math.abs(videoEndY - videoStartY),
        fill: `${color}33`,
        stroke: color,
        strokeWidth: 2,
        selectable: true,
      });
    }
    videoCorners.push(vc);
  }

  return new Polygon(videoCorners, {
    fill: `${color}33`,
    stroke: color,
    strokeWidth: 2,
    selectable: true,
  });
};

/**
 * Create perspective-correct spotlight (3D cylinder on field):
 * 1. Click position → field coordinates
 * 2. Create cylinder base ellipse on field
 * 3. Project to video → properly warped ellipse
 */
const createPerspectiveSpotlight = (
  videoCenterX: number,
  videoCenterY: number,
  H: number[][] | null,
  color: string,
  baseRadiusMeters: number = 1.5 // Default 1.5m radius
): Group => {
  if (!H) {
    // Fallback: Y-based scaling
    const scale = 0.4 + (videoCenterY / 600) * 0.6;
    const baseRadius = 30 * scale;
    const topRadius = baseRadius * 0.6;
    const height = 80 * scale;
    const ellipseRatio = 0.3 + (videoCenterY / 600) * 0.2;

    const pathData = `
      M ${-baseRadius} 0
      L ${-topRadius} ${-height}
      L ${topRadius} ${-height}
      L ${baseRadius} 0
      Z
    `;
    
    const sides = new Path(pathData, {
      fill: `${color}22`,
      stroke: color,
      strokeWidth: 2,
      originX: 'center',
      originY: 'bottom',
    });

    const baseEllipse = new Circle({
      radius: baseRadius,
      fill: `${color}11`,
      stroke: color,
      strokeWidth: 3,
      originX: 'center',
      originY: 'center',
      scaleY: ellipseRatio,
    });

    const topEllipse = new Circle({
      radius: topRadius,
      fill: 'transparent',
      stroke: color,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      scaleY: ellipseRatio * 0.7,
      top: -height,
    });

    return new Group([sides, baseEllipse, topEllipse], {
      left: videoCenterX,
      top: videoCenterY,
      originX: 'center',
      originY: 'bottom',
    });
  }

  const invH = invertHomography(H);
  if (!invH) {
    return createPerspectiveSpotlight(videoCenterX, videoCenterY, null, color);
  }

  // Step 1: Get field position
  const fieldCenter = videoToField(videoCenterX, videoCenterY, H);
  if (!fieldCenter) {
    return createPerspectiveSpotlight(videoCenterX, videoCenterY, null, color);
  }

  // Step 2: Create base ellipse on field (circle in field space)
  const numPoints = 32;
  const baseVideoPoints: { x: number; y: number }[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const fieldX = fieldCenter.x + Math.cos(angle) * baseRadiusMeters;
    const fieldY = fieldCenter.y + Math.sin(angle) * baseRadiusMeters;
    
    const videoPoint = fieldToVideo(fieldX, fieldY, invH);
    if (videoPoint) {
      baseVideoPoints.push(videoPoint);
    }
  }

  if (baseVideoPoints.length < 8) {
    return createPerspectiveSpotlight(videoCenterX, videoCenterY, null, color);
  }

  // Create base ellipse path
  let basePath = `M ${baseVideoPoints[0].x} ${baseVideoPoints[0].y}`;
  for (let i = 1; i < baseVideoPoints.length; i++) {
    basePath += ` L ${baseVideoPoints[i].x} ${baseVideoPoints[i].y}`;
  }
  basePath += ' Z';

  const baseShape = new Path(basePath, {
    fill: `${color}33`,
    stroke: color,
    strokeWidth: 3,
    selectable: false,
  });

  // Calculate cylinder height in video space (project upward)
  // We'll create sides by finding the bounds of the base
  const minX = Math.min(...baseVideoPoints.map(p => p.x));
  const maxX = Math.max(...baseVideoPoints.map(p => p.x));
  const minY = Math.min(...baseVideoPoints.map(p => p.y));
  const baseWidth = maxX - minX;
  const cylinderHeight = baseWidth * 1.5; // Proportional height
  
  // Create top ellipse (smaller, higher up)
  const topScale = 0.5;
  const topCenterY = minY - cylinderHeight;
  const topVideoPoints: { x: number; y: number }[] = baseVideoPoints.map(p => ({
    x: videoCenterX + (p.x - videoCenterX) * topScale,
    y: topCenterY + (p.y - minY) * topScale * 0.3,
  }));

  let topPath = `M ${topVideoPoints[0].x} ${topVideoPoints[0].y}`;
  for (let i = 1; i < topVideoPoints.length; i++) {
    topPath += ` L ${topVideoPoints[i].x} ${topVideoPoints[i].y}`;
  }
  topPath += ' Z';

  const topShape = new Path(topPath, {
    fill: 'transparent',
    stroke: color,
    strokeWidth: 2,
    selectable: false,
  });

  // Create side lines connecting base to top
  const leftIdx = baseVideoPoints.reduce((min, p, i, arr) => p.x < arr[min].x ? i : min, 0);
  const rightIdx = baseVideoPoints.reduce((max, p, i, arr) => p.x > arr[max].x ? i : max, 0);
  
  const sidesPath = `
    M ${baseVideoPoints[leftIdx].x} ${baseVideoPoints[leftIdx].y}
    L ${topVideoPoints[leftIdx].x} ${topVideoPoints[leftIdx].y}
    M ${baseVideoPoints[rightIdx].x} ${baseVideoPoints[rightIdx].y}
    L ${topVideoPoints[rightIdx].x} ${topVideoPoints[rightIdx].y}
  `;

  const sidesShape = new Path(sidesPath, {
    fill: 'transparent',
    stroke: color,
    strokeWidth: 2,
    selectable: false,
  });

  // Create filled trapezoid for sides
  const fillPath = `
    M ${baseVideoPoints[leftIdx].x} ${baseVideoPoints[leftIdx].y}
    L ${topVideoPoints[leftIdx].x} ${topVideoPoints[leftIdx].y}
    L ${topVideoPoints[rightIdx].x} ${topVideoPoints[rightIdx].y}
    L ${baseVideoPoints[rightIdx].x} ${baseVideoPoints[rightIdx].y}
    Z
  `;

  const fillShape = new Path(fillPath, {
    fill: `${color}15`,
    stroke: 'transparent',
    selectable: false,
  });

  return new Group([fillShape, baseShape, sidesShape, topShape], {
    left: 0,
    top: 0,
    selectable: true,
  });
};

/**
 * Create perspective-correct player marker with ring outline (like in reference image)
 */
const createPerspectivePlayerMarker = (
  videoX: number,
  videoY: number,
  playerNumber: string,
  color: string,
  H: number[][] | null,
  baseRadiusMeters: number = 0.8, // Player ring ~0.8m radius
  showRing: boolean = true,
  ringColor: string = '#000000'
): Group => {
  let scale = 0.5 + (videoY / 600) * 0.5;
  let visualRadius = 20 * scale;

  if (H) {
    const invH = invertHomography(H);
    if (invH) {
      const fieldCenter = videoToField(videoX, videoY, H);
      if (fieldCenter) {
        const testPoint = fieldToVideo(fieldCenter.x + baseRadiusMeters, fieldCenter.y, invH);
        if (testPoint) {
          visualRadius = Math.max(12, Math.min(40, Math.abs(testPoint.x - videoX)));
          scale = visualRadius / 20;
        }
      }
    }
  }

  const elements: FabricObject[] = [];

  // Outer ring (black circle outline like in reference)
  if (showRing) {
    const outerRing = new Circle({
      radius: visualRadius,
      fill: 'transparent',
      stroke: ringColor,
      strokeWidth: 3 * scale,
      originX: 'center',
      originY: 'center',
    });
    elements.push(outerRing);

    // Inner highlight ring
    const innerRing = new Circle({
      radius: visualRadius * 0.85,
      fill: 'transparent',
      stroke: `${ringColor}66`,
      strokeWidth: 2 * scale,
      originX: 'center',
      originY: 'center',
    });
    elements.push(innerRing);
  }

  // Small colored dot in center (optional, for team identification)
  const centerDot = new Circle({
    radius: visualRadius * 0.2,
    fill: color,
    stroke: 'transparent',
    originX: 'center',
    originY: 'center',
  });
  elements.push(centerDot);

  return new Group(elements, {
    left: videoX,
    top: videoY,
    originX: 'center',
    originY: 'center',
  });
};

/**
 * Create player marker with full label (number, name, speed)
 */
const createPlayerWithLabel = (
  videoX: number,
  videoY: number,
  playerNumber: string,
  playerName: string,
  color: string,
  H: number[][] | null,
  speed?: number
): Group => {
  let scale = 0.5 + (videoY / 600) * 0.5;
  let visualRadius = 20 * scale;

  if (H) {
    const invH = invertHomography(H);
    if (invH) {
      const fieldCenter = videoToField(videoX, videoY, H);
      if (fieldCenter) {
        const testPoint = fieldToVideo(fieldCenter.x + 0.8, fieldCenter.y, invH);
        if (testPoint) {
          visualRadius = Math.max(12, Math.min(40, Math.abs(testPoint.x - videoX)));
          scale = visualRadius / 20;
        }
      }
    }
  }

  const elements: FabricObject[] = [];

  // Player ring
  const ring = new Circle({
    radius: visualRadius,
    fill: 'transparent',
    stroke: '#000000',
    strokeWidth: 3 * scale,
    originX: 'center',
    originY: 'center',
  });
  elements.push(ring);

  // Label background
  const labelWidth = 80 * scale;
  const labelHeight = speed !== undefined ? 32 * scale : 22 * scale;
  const labelY = visualRadius + 8 * scale;

  const labelBg = new Rect({
    left: -labelWidth / 2,
    top: labelY,
    width: labelWidth,
    height: labelHeight,
    fill: 'rgba(0,0,0,0.85)',
    rx: 4 * scale,
    ry: 4 * scale,
  });
  elements.push(labelBg);

  // Player number and name
  const nameText = new FabricText(`${playerNumber}  ${playerName}`, {
    left: 0,
    top: labelY + 5 * scale,
    fontSize: 10 * scale,
    fill: '#ffffff',
    fontWeight: 'bold',
    originX: 'center',
  });
  elements.push(nameText);

  // Speed if available
  if (speed !== undefined) {
    const speedText = new FabricText(`${speed.toFixed(1)} km/h`, {
      left: 0,
      top: labelY + 18 * scale,
      fontSize: 8 * scale,
      fill: '#9ca3af',
      originX: 'center',
    });
    elements.push(speedText);
  }

  return new Group(elements, {
    left: videoX,
    top: videoY,
    originX: 'center',
    originY: 'center',
  });
};
/**
 * Create perspective-correct arrow:
 * Project start and end to field, then back to video
 */
const createPerspectiveArrow = (
  videoStartX: number,
  videoStartY: number,
  videoEndX: number,
  videoEndY: number,
  H: number[][] | null,
  color: string
): { line: Line; head: Triangle } => {
  // Get scale based on end position (where arrowhead is)
  let scale = 1;
  if (H) {
    const invH = invertHomography(H);
    if (invH) {
      const fieldEnd = videoToField(videoEndX, videoEndY, H);
      if (fieldEnd) {
        const testPoint = fieldToVideo(fieldEnd.x + 0.5, fieldEnd.y, invH);
        if (testPoint) {
          scale = Math.max(0.4, Math.min(1.5, Math.abs(testPoint.x - videoEndX) / 10));
        }
      }
    }
  } else {
    scale = 0.5 + (videoEndY / 600) * 0.5;
  }

  const arrowLine = new Line([videoStartX, videoStartY, videoEndX, videoEndY], {
    stroke: color,
    strokeWidth: 3 * scale,
    selectable: true,
  });

  const angle = Math.atan2(videoEndY - videoStartY, videoEndX - videoStartX);
  const headLength = 15 * scale;

  const arrowHead = new Triangle({
    left: videoEndX,
    top: videoEndY,
    width: headLength,
    height: headLength,
    fill: color,
    angle: (angle * 180) / Math.PI + 90,
    originX: 'center',
    originY: 'center',
    selectable: false,
  });

  return { line: arrowLine, head: arrowHead };
};

/**
 * Create perspective-correct trail path
 */
const createPerspectiveTrail = (
  points: { x: number; y: number }[],
  H: number[][] | null,
  color: string
): { path: Path; arrowHead: Triangle | null } => {
  // Calculate average scale from points
  let avgScale = 1;
  if (H) {
    const invH = invertHomography(H);
    if (invH) {
      const scales: number[] = [];
      for (const p of points) {
        const fieldP = videoToField(p.x, p.y, H);
        if (fieldP) {
          const testPoint = fieldToVideo(fieldP.x + 0.5, fieldP.y, invH);
          if (testPoint) {
            scales.push(Math.abs(testPoint.x - p.x) / 10);
          }
        }
      }
      if (scales.length > 0) {
        avgScale = scales.reduce((a, b) => a + b, 0) / scales.length;
        avgScale = Math.max(0.4, Math.min(1.5, avgScale));
      }
    }
  } else {
    const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    avgScale = 0.5 + (avgY / 600) * 0.5;
  }

  let pathData = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathData += ` L ${points[i].x} ${points[i].y}`;
  }

  const path = new Path(pathData, {
    fill: 'transparent',
    stroke: color,
    strokeWidth: 3 * avgScale,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    selectable: true,
  });

  let arrowHead: Triangle | null = null;
  if (points.length >= 2) {
    const lastTwo = points.slice(-2);
    const endScale = H ? avgScale : (0.5 + (lastTwo[1].y / 600) * 0.5);
    const angle = Math.atan2(lastTwo[1].y - lastTwo[0].y, lastTwo[1].x - lastTwo[0].x);
    
    arrowHead = new Triangle({
      left: lastTwo[1].x,
      top: lastTwo[1].y,
      width: 12 * endScale,
      height: 12 * endScale,
      fill: color,
      angle: (angle * 180) / Math.PI + 90,
      originX: 'center',
      originY: 'center',
      selectable: false,
    });
  }

  return { path, arrowHead };
};

// ============= MAIN COMPONENT =============

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  width,
  height,
  activeTool,
  activeColor,
  teamColors,
  onPlayerAdd,
  onDistanceAdd,
  onTrailAdd,
  onSpotlightAdd,
  onCalibrationPointAdd,
  calibrationPoints,
  homographyMatrix,
  calculateDistance,
  strokeWidth = 3,
  trailType = 'trace',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [playerCounter, setPlayerCounter] = useState(1);
  const [isHomeTeam, setIsHomeTeam] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Dispose existing canvas if any
    if (fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      selection: activeTool === 'select',
      backgroundColor: 'transparent',
    });

    fabricRef.current = canvas;

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [width, height]); // Recreate on dimension change

  // Dimensions are now handled in the canvas creation effect

  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;

    canvas.selection = activeTool === 'select';
    canvas.isDrawingMode = activeTool === 'freehand';

    if (activeTool === 'freehand' && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = 3;
    }

    const cursorMap: Record<AnnotationTool, string> = {
      select: 'default',
      player: 'crosshair',
      spotlight: 'crosshair',
      distance: 'crosshair',
      trail: 'crosshair',
      arrow: 'crosshair',
      rectangle: 'crosshair',
      circle: 'crosshair',
      ellipse: 'crosshair',
      freehand: 'crosshair',
      calibrate: 'crosshair',
    };
    canvas.defaultCursor = cursorMap[activeTool];
    canvas.hoverCursor = cursorMap[activeTool];
  }, [activeTool, activeColor]);

  // Draw calibration points on canvas
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;

    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      const customObj = obj as CustomFabricObject;
      if (customObj.data?.type === 'calibration') {
        canvas.remove(obj);
      }
    });

    calibrationPoints.forEach((point, index) => {
      const circle = new Circle({
        left: point.videoX - 8,
        top: point.videoY - 8,
        radius: 8,
        fill: '#22c55e',
        stroke: '#ffffff',
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      (circle as CustomFabricObject).data = { type: 'calibration' };

      const text = new FabricText(String(index + 1), {
        left: point.videoX - 4,
        top: point.videoY - 6,
        fontSize: 12,
        fill: '#ffffff',
        fontWeight: 'bold',
        selectable: false,
        evented: false,
      });
      (text as CustomFabricObject).data = { type: 'calibration' };

      canvas.add(circle);
      canvas.add(text);
    });

    canvas.renderAll();
  }, [calibrationPoints]);

  const handleCanvasClick = useCallback(
    async (e: TPointerEventInfo) => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const pointer = canvas.getPointer(e.e);

      switch (activeTool) {
        case 'calibrate':
          onCalibrationPointAdd({ videoX: pointer.x, videoY: pointer.y });
          break;

        case 'player': {
          const color = isHomeTeam ? teamColors.home : teamColors.away;
          const playerNumber = String(playerCounter);
          
          const group = createPerspectivePlayerMarker(
            pointer.x,
            pointer.y,
            playerNumber,
            color,
            homographyMatrix
          );
          (group as CustomFabricObject).data = { type: 'player', id: `player-${Date.now()}` };

          canvas.add(group);
          canvas.renderAll();

          const player: PlayerMarker = {
            id: `player-${Date.now()}`,
            x: pointer.x,
            y: pointer.y,
            name: `Player ${playerCounter}`,
            number: playerNumber,
            teamColor: color,
          };

          onPlayerAdd(player);
          setPlayerCounter((prev) => prev + 1);
          setIsHomeTeam((prev) => !prev);
          break;
        }

        case 'spotlight': {
          const spotlightId = `spotlight-${Date.now()}`;
          const spotlightGroup = createPerspectiveSpotlight(
            pointer.x,
            pointer.y,
            homographyMatrix,
            activeColor
          );
          (spotlightGroup as CustomFabricObject).data = { type: 'spotlight', id: spotlightId };

          canvas.add(spotlightGroup);
          canvas.renderAll();

          onSpotlightAdd({
            id: spotlightId,
            x: pointer.x,
            y: pointer.y,
            color: activeColor,
          });

          toast.success('Perspective spotlight added');
          break;
        }

        case 'distance':
          if (!isDrawing) {
            setIsDrawing(true);
            setDrawingPoints([{ x: pointer.x, y: pointer.y }]);
          } else {
            const startPoint = drawingPoints[0];
            const endPoint = { x: pointer.x, y: pointer.y };

            let distance = 0;
            if (calculateDistance) {
              try {
                distance = await calculateDistance(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
              } catch (error) {
                const pixelDist = Math.sqrt(
                  Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2)
                );
                distance = Math.round(pixelDist / 10);
              }
            }

            const line = new Line(
              [startPoint.x, startPoint.y, endPoint.x, endPoint.y],
              {
                stroke: activeColor,
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: true,
              }
            );
            (line as CustomFabricObject).data = { type: 'distance' };

            // Scale label based on field position
            let labelScale = 1;
            if (homographyMatrix) {
              const invH = invertHomography(homographyMatrix);
              if (invH) {
                const midY = (startPoint.y + endPoint.y) / 2;
                const midX = (startPoint.x + endPoint.x) / 2;
                const fieldMid = videoToField(midX, midY, homographyMatrix);
                if (fieldMid) {
                  const testPoint = fieldToVideo(fieldMid.x + 0.5, fieldMid.y, invH);
                  if (testPoint) {
                    labelScale = Math.max(0.5, Math.min(1.2, Math.abs(testPoint.x - midX) / 10));
                  }
                }
              }
            } else {
              const midY = (startPoint.y + endPoint.y) / 2;
              labelScale = 0.6 + (midY / height) * 0.4;
            }

            const midX = (startPoint.x + endPoint.x) / 2;
            const midY = (startPoint.y + endPoint.y) / 2;
            
            const label = new FabricText(`${distance}m`, {
              left: midX,
              top: midY - 15 * labelScale,
              fontSize: 14 * labelScale,
              fill: activeColor,
              fontWeight: 'bold',
              backgroundColor: 'rgba(0,0,0,0.7)',
              padding: 4,
            });
            (label as CustomFabricObject).data = { type: 'distance-label' };

            canvas.add(line);
            canvas.add(label);
            canvas.renderAll();

            onDistanceAdd({
              id: `distance-${Date.now()}`,
              startX: startPoint.x,
              startY: startPoint.y,
              endX: endPoint.x,
              endY: endPoint.y,
              distance,
            });

            setIsDrawing(false);
            setDrawingPoints([]);
          }
          break;

        case 'trail':
          if (!isDrawing) {
            setIsDrawing(true);
            setDrawingPoints([{ x: pointer.x, y: pointer.y }]);
          } else {
            setDrawingPoints((prev) => [...prev, { x: pointer.x, y: pointer.y }]);
          }
          break;

        case 'arrow': {
          if (!isDrawing) {
            setIsDrawing(true);
            setDrawingPoints([{ x: pointer.x, y: pointer.y }]);
          } else {
            const start = drawingPoints[0];
            const end = { x: pointer.x, y: pointer.y };

            const { line: arrowLine, head: arrowHead } = createPerspectiveArrow(
              start.x,
              start.y,
              end.x,
              end.y,
              homographyMatrix,
              activeColor
            );
            (arrowLine as CustomFabricObject).data = { type: 'arrow' };
            (arrowHead as CustomFabricObject).data = { type: 'arrow-head' };

            canvas.add(arrowLine);
            canvas.add(arrowHead);
            canvas.renderAll();

            setIsDrawing(false);
            setDrawingPoints([]);
          }
          break;
        }

        case 'rectangle': {
          if (!isDrawing) {
            setIsDrawing(true);
            setDrawingPoints([{ x: pointer.x, y: pointer.y }]);
          } else {
            const start = drawingPoints[0];
            const rect = createPerspectiveRectangle(
              start.x,
              start.y,
              pointer.x,
              pointer.y,
              homographyMatrix,
              activeColor
            );
            (rect as CustomFabricObject).data = { type: 'zone-rectangle' };

            canvas.add(rect);
            canvas.renderAll();

            setIsDrawing(false);
            setDrawingPoints([]);
          }
          break;
        }

        case 'circle': {
          if (!isDrawing) {
            setIsDrawing(true);
            setDrawingPoints([{ x: pointer.x, y: pointer.y }]);
          } else {
            const start = drawingPoints[0];
            
            // Calculate radius in field meters if calibrated
            let radiusMeters = 3; // Default 3m
            if (homographyMatrix) {
              const fieldStart = videoToField(start.x, start.y, homographyMatrix);
              const fieldEnd = videoToField(pointer.x, pointer.y, homographyMatrix);
              if (fieldStart && fieldEnd) {
                radiusMeters = Math.sqrt(
                  Math.pow(fieldEnd.x - fieldStart.x, 2) + 
                  Math.pow(fieldEnd.y - fieldStart.y, 2)
                );
              }
            } else {
              const pixelRadius = Math.sqrt(
                Math.pow(pointer.x - start.x, 2) + Math.pow(pointer.y - start.y, 2)
              );
              radiusMeters = pixelRadius / 15; // Rough estimate
            }
            
            const circle = createPerspectiveCircle(
              start.x,
              start.y,
              radiusMeters,
              homographyMatrix,
              activeColor,
              true
            );
            (circle as CustomFabricObject).data = { type: 'zone-circle' };

            canvas.add(circle);
            canvas.renderAll();

            setIsDrawing(false);
            setDrawingPoints([]);
          }
          break;
        }

        case 'ellipse': {
          if (!isDrawing) {
            setIsDrawing(true);
            setDrawingPoints([{ x: pointer.x, y: pointer.y }]);
          } else {
            const start = drawingPoints[0];
            
            const ellipse = createGroundEllipse(
              start.x,
              start.y,
              pointer.x,
              pointer.y,
              homographyMatrix,
              activeColor,
              strokeWidth || 3
            );
            (ellipse as CustomFabricObject).data = { type: 'ground-ellipse' };

            canvas.add(ellipse);
            canvas.renderAll();

            setIsDrawing(false);
            setDrawingPoints([]);
            toast.success('Ground ellipse added');
          }
          break;
        }
      }
    },
    [
      activeTool,
      activeColor,
      isDrawing,
      drawingPoints,
      teamColors,
      playerCounter,
      isHomeTeam,
      onPlayerAdd,
      onDistanceAdd,
      onSpotlightAdd,
      onCalibrationPointAdd,
      calculateDistance,
      homographyMatrix,
      height,
      strokeWidth,
    ]
  );

  // Complete trail on double-click
  const handleDoubleClick = useCallback(() => {
    if (activeTool === 'trail' && isDrawing && drawingPoints.length > 1) {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const { path, arrowHead } = createPerspectiveTrail(
        drawingPoints,
        homographyMatrix,
        activeColor
      );
      (path as CustomFabricObject).data = { type: 'trail' };

      if (arrowHead) {
        (arrowHead as CustomFabricObject).data = { type: 'trail-arrow' };
        canvas.add(arrowHead);
      }

      canvas.add(path);
      canvas.renderAll();

      onTrailAdd({
        id: `trail-${Date.now()}`,
        points: drawingPoints,
        color: activeColor,
      });

      setIsDrawing(false);
      setDrawingPoints([]);
      toast.success('Movement trail created');
    }
  }, [activeTool, isDrawing, drawingPoints, activeColor, onTrailAdd, homographyMatrix]);

  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;

    canvas.on('mouse:down', handleCanvasClick);
    canvas.on('mouse:dblclick', handleDoubleClick);

    return () => {
      canvas.off('mouse:down', handleCanvasClick);
      canvas.off('mouse:dblclick', handleDoubleClick);
    };
  }, [handleCanvasClick, handleDoubleClick]);

  return (
    <div style={{ width, height, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
      />
    </div>
  );
};

export default AnnotationCanvas;
