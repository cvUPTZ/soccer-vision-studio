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
}

// Helper: Get perspective scale factor based on Y position (objects further up appear smaller)
const getPerspectiveScale = (y: number, height: number, homographyMatrix: number[][] | null): number => {
  if (!homographyMatrix) {
    // Simple linear perspective: objects at top are smaller
    return 0.5 + (y / height) * 0.5;
  }
  
  // Use homography to determine scale
  const [[, , ], [, , ], [g, h, i]] = homographyMatrix;
  const w = g * 0 + h * y + i;
  return Math.max(0.3, Math.min(1.5, 1 / Math.abs(w) * 0.5));
};

// Helper: Transform pitch point back to video coordinates using inverse homography
const pitchToVideo = (
  pitchX: number, 
  pitchY: number, 
  homographyMatrix: number[][]
): { x: number; y: number } | null => {
  // Compute inverse of homography matrix
  const [[a, b, c], [d, e, f], [g, h, i]] = homographyMatrix;
  
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-10) return null;
  
  const invH = [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
  
  const w = invH[2][0] * pitchX + invH[2][1] * pitchY + invH[2][2];
  if (Math.abs(w) < 1e-10) return null;
  
  return {
    x: (invH[0][0] * pitchX + invH[0][1] * pitchY + invH[0][2]) / w,
    y: (invH[1][0] * pitchX + invH[1][1] * pitchY + invH[1][2]) / w,
  };
};

// Helper: Transform video point to pitch coordinates
const videoToPitch = (
  videoX: number, 
  videoY: number, 
  homographyMatrix: number[][]
): { x: number; y: number } | null => {
  const [[a, b, c], [d, e, f], [g, h, i]] = homographyMatrix;
  const w = g * videoX + h * videoY + i;
  
  if (Math.abs(w) < 1e-10) return null;
  
  return {
    x: (a * videoX + b * videoY + c) / w,
    y: (d * videoX + e * videoY + f) / w,
  };
};

// Create a perspective circle (ellipse that follows field perspective)
const createPerspectiveCircle = (
  centerX: number,
  centerY: number,
  radiusMeters: number,
  homographyMatrix: number[][] | null,
  color: string,
  fill: boolean = false
): Path | Circle => {
  if (!homographyMatrix) {
    // Fallback to regular circle with simple perspective
    const scale = 0.5 + (centerY / 600) * 0.5;
    return new Circle({
      left: centerX,
      top: centerY,
      radius: radiusMeters * 10 * scale,
      fill: fill ? `${color}33` : 'transparent',
      stroke: color,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
    });
  }

  // Get pitch coordinates of center
  const pitchCenter = videoToPitch(centerX, centerY, homographyMatrix);
  if (!pitchCenter) {
    return new Circle({
      left: centerX,
      top: centerY,
      radius: radiusMeters * 5,
      fill: fill ? `${color}33` : 'transparent',
      stroke: color,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
    });
  }

  // Generate ellipse points on pitch, then transform back to video
  const numPoints = 32;
  const points: { x: number; y: number }[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const pitchX = pitchCenter.x + Math.cos(angle) * radiusMeters;
    const pitchY = pitchCenter.y + Math.sin(angle) * radiusMeters;
    
    const videoPoint = pitchToVideo(pitchX, pitchY, homographyMatrix);
    if (videoPoint) {
      points.push(videoPoint);
    }
  }

  if (points.length < 3) {
    return new Circle({
      left: centerX,
      top: centerY,
      radius: radiusMeters * 5,
      fill: fill ? `${color}33` : 'transparent',
      stroke: color,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
    });
  }

  // Create path from points
  let pathData = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathData += ` L ${points[i].x} ${points[i].y}`;
  }
  pathData += ' Z';

  return new Path(pathData, {
    fill: fill ? `${color}33` : 'transparent',
    stroke: color,
    strokeWidth: 2,
    selectable: true,
  });
};

// Create a perspective rectangle (trapezoid following field perspective)
const createPerspectiveRectangle = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  homographyMatrix: number[][] | null,
  color: string
): Polygon | Rect => {
  if (!homographyMatrix) {
    // Simple perspective: make far side narrower
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    
    const topScale = 0.7 + (minY / 600) * 0.3;
    const bottomScale = 0.7 + (maxY / 600) * 0.3;
    
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

  // Transform corners to pitch, create rectangle there, transform back
  const corners = [
    { vx: startX, vy: startY },
    { vx: endX, vy: startY },
    { vx: endX, vy: endY },
    { vx: startX, vy: endY },
  ];
  
  const pitchCorners = corners.map(c => videoToPitch(c.vx, c.vy, homographyMatrix));
  
  if (pitchCorners.some(p => p === null)) {
    return new Rect({
      left: Math.min(startX, endX),
      top: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      fill: `${color}33`,
      stroke: color,
      strokeWidth: 2,
      selectable: true,
    });
  }

  // The corners are already in video space with perspective
  const points = corners.map(c => ({ x: c.vx, y: c.vy }));
  
  return new Polygon(points, {
    fill: `${color}33`,
    stroke: color,
    strokeWidth: 2,
    selectable: true,
  });
};

// Create perspective spotlight (3D cylinder on field)
const createPerspectiveSpotlight = (
  centerX: number,
  centerY: number,
  homographyMatrix: number[][] | null,
  color: string
): Group => {
  const scale = getPerspectiveScale(centerY, 600, homographyMatrix);
  const baseRadius = 30 * scale;
  const topRadius = baseRadius * 0.6;
  const height = 80 * scale;
  const ellipseRatio = 0.3 + (centerY / 600) * 0.2; // More flattened at bottom of screen

  // Create trapezoid sides
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

  // Bottom ellipse (more perspective-correct)
  const baseEllipse = new Circle({
    radius: baseRadius,
    fill: 'transparent',
    stroke: color,
    strokeWidth: 3,
    originX: 'center',
    originY: 'center',
    scaleY: ellipseRatio,
  });

  // Top ellipse
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

  const group = new Group([sides, baseEllipse, topEllipse], {
    left: centerX,
    top: centerY,
    originX: 'center',
    originY: 'bottom',
  });

  return group;
};

// Create perspective player marker
const createPerspectivePlayerMarker = (
  x: number,
  y: number,
  number: string,
  color: string,
  homographyMatrix: number[][] | null
): Group => {
  const scale = getPerspectiveScale(y, 600, homographyMatrix);
  const radius = 15 * scale;
  
  const playerCircle = new Circle({
    radius,
    fill: color,
    stroke: '#ffffff',
    strokeWidth: 2 * scale,
    originX: 'center',
    originY: 'center',
  });

  const playerText = new FabricText(number, {
    fontSize: 14 * scale,
    fill: '#ffffff',
    fontWeight: 'bold',
    originX: 'center',
    originY: 'center',
  });

  return new Group([playerCircle, playerText], {
    left: x,
    top: y,
    originX: 'center',
    originY: 'center',
  });
};

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
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [playerCounter, setPlayerCounter] = useState(1);
  const [isHomeTeam, setIsHomeTeam] = useState(true);

  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

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
  }, []);

  useEffect(() => {
    if (!fabricRef.current) return;
    fabricRef.current.setDimensions({ width, height });
  }, [width, height]);

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

            const midX = (startPoint.x + endPoint.x) / 2;
            const midY = (startPoint.y + endPoint.y) / 2;
            const scale = getPerspectiveScale(midY, height, homographyMatrix);
            
            const label = new FabricText(`${distance}m`, {
              left: midX,
              top: midY - 15 * scale,
              fontSize: 14 * scale,
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
            const scale = getPerspectiveScale(end.y, height, homographyMatrix);

            const arrowLine = new Line([start.x, start.y, end.x, end.y], {
              stroke: activeColor,
              strokeWidth: 3 * scale,
              selectable: true,
            });
            (arrowLine as CustomFabricObject).data = { type: 'arrow' };

            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const headLength = 15 * scale;

            const arrowHead = new Triangle({
              left: end.x,
              top: end.y,
              width: headLength,
              height: headLength,
              fill: activeColor,
              angle: (angle * 180) / Math.PI + 90,
              originX: 'center',
              originY: 'center',
              selectable: false,
            });
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
            const radiusPixels = Math.sqrt(
              Math.pow(pointer.x - start.x, 2) + Math.pow(pointer.y - start.y, 2)
            );
            
            // Convert pixel radius to approximate meters (rough estimate)
            const radiusMeters = radiusPixels / 10;
            
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
    ]
  );

  // Complete trail on double-click
  const handleDoubleClick = useCallback(() => {
    if (activeTool === 'trail' && isDrawing && drawingPoints.length > 1) {
      const canvas = fabricRef.current;
      if (!canvas) return;

      let pathData = `M ${drawingPoints[0].x} ${drawingPoints[0].y}`;
      for (let i = 1; i < drawingPoints.length; i++) {
        pathData += ` L ${drawingPoints[i].x} ${drawingPoints[i].y}`;
      }

      const avgY = drawingPoints.reduce((sum, p) => sum + p.y, 0) / drawingPoints.length;
      const scale = getPerspectiveScale(avgY, height, homographyMatrix);

      const path = new Path(pathData, {
        fill: 'transparent',
        stroke: activeColor,
        strokeWidth: 3 * scale,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: true,
      });
      (path as CustomFabricObject).data = { type: 'trail' };

      const lastTwo = drawingPoints.slice(-2);
      if (lastTwo.length === 2) {
        const endScale = getPerspectiveScale(lastTwo[1].y, height, homographyMatrix);
        const angle = Math.atan2(lastTwo[1].y - lastTwo[0].y, lastTwo[1].x - lastTwo[0].x);
        const arrowHead = new Triangle({
          left: lastTwo[1].x,
          top: lastTwo[1].y,
          width: 12 * endScale,
          height: 12 * endScale,
          fill: activeColor,
          angle: (angle * 180) / Math.PI + 90,
          originX: 'center',
          originY: 'center',
          selectable: false,
        });
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
  }, [activeTool, isDrawing, drawingPoints, activeColor, onTrailAdd, homographyMatrix, height]);

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
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-auto"
      style={{ width, height }}
    />
  );
};

export default AnnotationCanvas;
