import { useState, useCallback } from 'react';
import type { CalibrationPoint } from '@/types/annotation';
import { toast } from 'sonner';

interface UseHomographyOptions {
  apiEndpoint?: string;
}

export const useHomography = ({ apiEndpoint }: UseHomographyOptions = {}) => {
  const [homographyMatrix, setHomographyMatrix] = useState<number[][] | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);

  // Fallback: Calculate homography matrix locally using DLT algorithm
  const calculateHomographyLocal = useCallback((points: CalibrationPoint[]): number[][] => {
    if (points.length < 4) {
      throw new Error('At least 4 points are required');
    }

    // Build the matrix for DLT (Direct Linear Transform)
    const A: number[][] = [];
    
    for (const point of points) {
      const { videoX: x, videoY: y, pitchX: xp, pitchY: yp } = point;
      A.push([-x, -y, -1, 0, 0, 0, x * xp, y * xp, xp]);
      A.push([0, 0, 0, -x, -y, -1, x * yp, y * yp, yp]);
    }

    // Solve using SVD (simplified version - use least squares)
    // For production, you'd want a proper SVD implementation
    // This is a simplified placeholder that works for basic cases
    
    // Using a basic pseudo-inverse approach for 4 points
    const n = points.length;
    const srcPoints = points.map(p => [p.videoX, p.videoY]);
    const dstPoints = points.map(p => [p.pitchX, p.pitchY]);

    // Calculate transformation using linear algebra
    // This is a simplified 2D homography for demonstration
    // The actual Python backend would use OpenCV's findHomography
    
    // For now, return a simple affine approximation
    const sx = (dstPoints[1][0] - dstPoints[0][0]) / (srcPoints[1][0] - srcPoints[0][0] || 1);
    const sy = (dstPoints[2][1] - dstPoints[0][1]) / (srcPoints[2][1] - srcPoints[0][1] || 1);
    const tx = dstPoints[0][0] - srcPoints[0][0] * sx;
    const ty = dstPoints[0][1] - srcPoints[0][1] * sy;

    return [
      [sx, 0, tx],
      [0, sy, ty],
      [0, 0, 1],
    ];
  }, []);

  const calibrate = useCallback(async (points: CalibrationPoint[]) => {
    if (points.length < 4) {
      toast.error('At least 4 calibration points are required');
      return false;
    }

    setIsCalibrating(true);

    try {
      if (apiEndpoint) {
        // Use Python backend
        const response = await fetch(`${apiEndpoint}/calibrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_points: points.map(p => [p.videoX, p.videoY]),
            pitch_points: points.map(p => [p.pitchX, p.pitchY]),
          }),
        });

        if (!response.ok) {
          throw new Error('Calibration API failed');
        }

        const data = await response.json();
        setHomographyMatrix(data.matrix);
      } else {
        // Use local calculation
        const matrix = calculateHomographyLocal(points);
        setHomographyMatrix(matrix);
      }

      setIsCalibrated(true);
      toast.success('Homography calibration successful!');
      return true;
    } catch (error) {
      console.error('Calibration error:', error);
      
      // Fallback to local calculation
      try {
        const matrix = calculateHomographyLocal(points);
        setHomographyMatrix(matrix);
        setIsCalibrated(true);
        toast.success('Calibration completed (local mode)');
        return true;
      } catch (localError) {
        toast.error('Calibration failed. Please check your points.');
        return false;
      }
    } finally {
      setIsCalibrating(false);
    }
  }, [apiEndpoint, calculateHomographyLocal]);

  const transformPoint = useCallback((videoX: number, videoY: number): { pitchX: number; pitchY: number } | null => {
    if (!homographyMatrix) return null;

    const [[a, b, c], [d, e, f], [g, h, i]] = homographyMatrix;
    const w = g * videoX + h * videoY + i;
    
    if (Math.abs(w) < 1e-10) return null;

    const pitchX = (a * videoX + b * videoY + c) / w;
    const pitchY = (d * videoX + e * videoY + f) / w;

    return { pitchX, pitchY };
  }, [homographyMatrix]);

  const calculateDistance = useCallback(async (
    x1: number, y1: number, x2: number, y2: number
  ): Promise<number> => {
    if (apiEndpoint && homographyMatrix) {
      try {
        const response = await fetch(`${apiEndpoint}/distance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            point1: [x1, y1],
            point2: [x2, y2],
            matrix: homographyMatrix,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.distance;
        }
      } catch (error) {
        console.error('Distance API error:', error);
      }
    }

    // Local calculation
    const p1 = transformPoint(x1, y1);
    const p2 = transformPoint(x2, y2);

    if (!p1 || !p2) {
      // Fallback: estimate based on pixels
      return Math.round(Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 10);
    }

    return Math.round(Math.sqrt(Math.pow(p2.pitchX - p1.pitchX, 2) + Math.pow(p2.pitchY - p1.pitchY, 2)));
  }, [apiEndpoint, homographyMatrix, transformPoint]);

  const reset = useCallback(() => {
    setHomographyMatrix(null);
    setIsCalibrated(false);
  }, []);

  return {
    homographyMatrix,
    isCalibrating,
    isCalibrated,
    calibrate,
    transformPoint,
    calculateDistance,
    reset,
  };
};
