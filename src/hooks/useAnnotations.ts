import { useState, useCallback } from 'react';
import type { 
  PlayerMarker, 
  DistanceMeasurement, 
  MovementTrail, 
  CalibrationPoint,
  VideoClip 
} from '@/types/annotation';

export const useAnnotations = () => {
  const [players, setPlayers] = useState<PlayerMarker[]>([]);
  const [distances, setDistances] = useState<DistanceMeasurement[]>([]);
  const [trails, setTrails] = useState<MovementTrail[]>([]);
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [pendingVideoPoint, setPendingVideoPoint] = useState<{ x: number; y: number } | null>(null);

  // History for undo/redo
  const [history, setHistory] = useState<{ players: PlayerMarker[]; distances: DistanceMeasurement[]; trails: MovementTrail[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const saveToHistory = useCallback(() => {
    const state = { players, distances, trails };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), state]);
    setHistoryIndex(prev => prev + 1);
  }, [players, distances, trails, historyIndex]);

  const addPlayer = useCallback((player: PlayerMarker) => {
    saveToHistory();
    setPlayers(prev => [...prev, player]);
  }, [saveToHistory]);

  const addDistance = useCallback((distance: DistanceMeasurement) => {
    saveToHistory();
    setDistances(prev => [...prev, distance]);
  }, [saveToHistory]);

  const addTrail = useCallback((trail: MovementTrail) => {
    saveToHistory();
    setTrails(prev => [...prev, trail]);
  }, [saveToHistory]);

  const addCalibrationPoint = useCallback((videoX: number, videoY: number, pitchX: number, pitchY: number) => {
    setCalibrationPoints(prev => [...prev, { videoX, videoY, pitchX, pitchY }]);
  }, []);

  const removeCalibrationPoint = useCallback((index: number) => {
    setCalibrationPoints(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearCalibration = useCallback(() => {
    setCalibrationPoints([]);
    setPendingVideoPoint(null);
  }, []);

  const addClip = useCallback((clip: VideoClip) => {
    setClips(prev => [...prev, clip]);
  }, []);

  const deleteClip = useCallback((id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
  }, []);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setPlayers(prevState.players);
      setDistances(prevState.distances);
      setTrails(prevState.trails);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setPlayers(nextState.players);
      setDistances(nextState.distances);
      setTrails(nextState.trails);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

  const clearAll = useCallback(() => {
    saveToHistory();
    setPlayers([]);
    setDistances([]);
    setTrails([]);
  }, [saveToHistory]);

  const exportAnnotations = useCallback(() => {
    const data = {
      players,
      distances,
      trails,
      calibrationPoints,
      clips,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soccer-annotations-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [players, distances, trails, calibrationPoints, clips]);

  return {
    players,
    distances,
    trails,
    calibrationPoints,
    clips,
    pendingVideoPoint,
    setPendingVideoPoint,
    addPlayer,
    addDistance,
    addTrail,
    addCalibrationPoint,
    removeCalibrationPoint,
    clearCalibration,
    addClip,
    deleteClip,
    undo,
    redo,
    clearAll,
    exportAnnotations,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  };
};
