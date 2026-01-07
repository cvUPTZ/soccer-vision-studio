import { useState, useCallback } from 'react';
import type { CalibrationPoint } from '@/types/annotation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useHomography = () => {
  const [homographyMatrix, setHomographyMatrix] = useState<number[][] | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);

  const calibrate = useCallback(async (points: CalibrationPoint[]) => {
    if (points.length < 4) {
      toast.error('At least 4 calibration points are required');
      return false;
    }

    setIsCalibrating(true);

    try {
      const { data, error } = await supabase.functions.invoke('homography', {
        body: {
          video_points: points.map(p => [p.videoX, p.videoY]),
          pitch_points: points.map(p => [p.pitchX, p.pitchY]),
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;

      if (data.success) {
        setHomographyMatrix(data.matrix);
        setIsCalibrated(true);
        toast.success(`Calibration successful! Error: ${data.reprojection_error}m`);
        return true;
      } else {
        throw new Error(data.error || 'Calibration failed');
      }
    } catch (error) {
      console.error('Calibration error:', error);
      toast.error('Calibration failed. Please check your points.');
      return false;
    } finally {
      setIsCalibrating(false);
    }
  }, []);

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
    if (!homographyMatrix) {
      // Fallback: estimate based on pixels
      return Math.round(Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 10);
    }

    try {
      const { data, error } = await supabase.functions.invoke('homography', {
        body: {
          point1: [x1, y1],
          point2: [x2, y2],
          matrix: homographyMatrix,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;

      if (data.success) {
        return data.distance;
      }
    } catch (error) {
      console.error('Distance calculation error:', error);
    }

    // Local fallback calculation
    const p1 = transformPoint(x1, y1);
    const p2 = transformPoint(x2, y2);

    if (!p1 || !p2) {
      return Math.round(Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 10);
    }

    return Math.round(Math.sqrt(Math.pow(p2.pitchX - p1.pitchX, 2) + Math.pow(p2.pitchY - p1.pitchY, 2)));
  }, [homographyMatrix, transformPoint]);

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
