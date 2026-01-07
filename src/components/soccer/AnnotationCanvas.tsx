import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, Circle, Rect, Line, Path, Group, FabricText, Triangle, FabricObject, TPointerEventInfo } from 'fabric';
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

    // Update cursor based on tool
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

    // Remove existing calibration markers
    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      const customObj = obj as CustomFabricObject;
      if (customObj.data?.type === 'calibration') {
        canvas.remove(obj);
      }
    });

    // Add calibration point markers
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
        data: { type: 'calibration' },
      });

      const text = new FabricText(String(index + 1), {
        left: point.videoX - 4,
        top: point.videoY - 6,
        fontSize: 12,
        fill: '#ffffff',
        fontWeight: 'bold',
        selectable: false,
        evented: false,
        data: { type: 'calibration' },
      });

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
          
          // Create player marker circle
          const playerCircle = new Circle({
            radius: 15,
            fill: color,
            stroke: '#ffffff',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
          });

          const playerText = new FabricText(playerNumber, {
            fontSize: 14,
            fill: '#ffffff',
            fontWeight: 'bold',
            originX: 'center',
            originY: 'center',
          });

          const group = new Group([playerCircle, playerText], {
            left: pointer.x,
            top: pointer.y,
            originX: 'center',
            originY: 'center',
          });
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
          // Draw cylinder spotlight effect
          const spotlightId = `spotlight-${Date.now()}`;
          
          // Create the spotlight visual - ellipse base with gradient
          const baseRadius = 25;
          const spotlightHeight = 70;
          
          // Bottom ellipse (base)
          const baseEllipse = new Circle({
            radius: baseRadius,
            fill: 'transparent',
            stroke: activeColor,
            strokeWidth: 3,
            originX: 'center',
            originY: 'center',
            scaleY: 0.4,
          });
          
          // Create trapezoid sides using a path
          const topRadius = baseRadius * 0.6;
          const pathData = `
            M ${-baseRadius} 0
            L ${-topRadius} ${-spotlightHeight}
            L ${topRadius} ${-spotlightHeight}
            L ${baseRadius} 0
            Z
          `;
          
          const sides = new Path(pathData, {
            fill: `${activeColor}22`,
            stroke: activeColor,
            strokeWidth: 2,
            originX: 'center',
            originY: 'bottom',
          });
          
          // Top ellipse
          const topEllipse = new Circle({
            radius: topRadius,
            fill: 'transparent',
            stroke: activeColor,
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
            scaleY: 0.3,
            top: -spotlightHeight,
          });
          
          const spotlightGroup = new Group([sides, baseEllipse, topEllipse], {
            left: pointer.x,
            top: pointer.y,
            originX: 'center',
            originY: 'bottom',
          });
          (spotlightGroup as CustomFabricObject).data = { type: 'spotlight', id: spotlightId };
          
          canvas.add(spotlightGroup);
          canvas.renderAll();
          
          onSpotlightAdd({
            id: spotlightId,
            x: pointer.x,
            y: pointer.y,
            color: activeColor,
          });
          
          toast.success('Spotlight added');
          break;
        }

        case 'distance':
          if (!isDrawing) {
            setIsDrawing(true);
            setDrawingPoints([{ x: pointer.x, y: pointer.y }]);
          } else {
            const startPoint = drawingPoints[0];
            const endPoint = { x: pointer.x, y: pointer.y };

            // Calculate distance if homography is available
            let distance = 0;
            if (calculateDistance) {
              try {
                distance = await calculateDistance(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
              } catch (error) {
                // Fallback: calculate pixel distance and estimate (assuming ~10px = 1m)
                const pixelDist = Math.sqrt(
                  Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2)
                );
                distance = Math.round(pixelDist / 10);
              }
            }

            // Draw the measurement line
            const line = new Line(
              [startPoint.x, startPoint.y, endPoint.x, endPoint.y],
              {
                stroke: activeColor,
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: true,
                data: { type: 'distance' },
              }
            );

            // Add distance label
            const midX = (startPoint.x + endPoint.x) / 2;
            const midY = (startPoint.y + endPoint.y) / 2;
            const label = new FabricText(`${distance}m`, {
              left: midX,
              top: midY - 15,
              fontSize: 14,
              fill: activeColor,
              fontWeight: 'bold',
              backgroundColor: 'rgba(0,0,0,0.7)',
              padding: 4,
              data: { type: 'distance-label' },
            });

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

            // Draw arrow line
            const arrowLine = new Line([start.x, start.y, end.x, end.y], {
              stroke: activeColor,
              strokeWidth: 3,
              selectable: true,
              data: { type: 'arrow' },
            });

            // Calculate arrow head
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const headLength = 15;

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
              data: { type: 'arrow-head' },
            });

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
            const rect = new Rect({
              left: Math.min(start.x, pointer.x),
              top: Math.min(start.y, pointer.y),
              width: Math.abs(pointer.x - start.x),
              height: Math.abs(pointer.y - start.y),
              fill: `${activeColor}33`,
              stroke: activeColor,
              strokeWidth: 2,
              selectable: true,
              data: { type: 'zone-rectangle' },
            });

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
            const radius = Math.sqrt(
              Math.pow(pointer.x - start.x, 2) + Math.pow(pointer.y - start.y, 2)
            );

            const circle = new Circle({
              left: start.x - radius,
              top: start.y - radius,
              radius,
              fill: `${activeColor}33`,
              stroke: activeColor,
              strokeWidth: 2,
              selectable: true,
              data: { type: 'zone-circle' },
            });

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
      onCalibrationPointAdd,
      calculateDistance,
    ]
  );

  // Complete trail on double-click
  const handleDoubleClick = useCallback(() => {
    if (activeTool === 'trail' && isDrawing && drawingPoints.length > 1) {
      const canvas = fabricRef.current;
      if (!canvas) return;

      // Create path from points
      let pathData = `M ${drawingPoints[0].x} ${drawingPoints[0].y}`;
      for (let i = 1; i < drawingPoints.length; i++) {
        pathData += ` L ${drawingPoints[i].x} ${drawingPoints[i].y}`;
      }

      const path = new Path(pathData, {
        fill: 'transparent',
        stroke: activeColor,
        strokeWidth: 3,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: true,
        data: { type: 'trail' },
      });

      // Add arrow at the end
      const lastTwo = drawingPoints.slice(-2);
      if (lastTwo.length === 2) {
        const angle = Math.atan2(lastTwo[1].y - lastTwo[0].y, lastTwo[1].x - lastTwo[0].x);
        const arrowHead = new Triangle({
          left: lastTwo[1].x,
          top: lastTwo[1].y,
          width: 12,
          height: 12,
          fill: activeColor,
          angle: (angle * 180) / Math.PI + 90,
          originX: 'center',
          originY: 'center',
          selectable: false,
          data: { type: 'trail-arrow' },
        });
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
  }, [activeTool, isDrawing, drawingPoints, activeColor, onTrailAdd]);

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

  const clearCanvas = () => {
    if (fabricRef.current) {
      fabricRef.current.clear();
      fabricRef.current.backgroundColor = 'transparent';
      fabricRef.current.renderAll();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-auto"
      style={{ width, height }}
    />
  );
};

export default AnnotationCanvas;
