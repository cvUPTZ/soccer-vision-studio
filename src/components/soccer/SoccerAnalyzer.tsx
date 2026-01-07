import React, { useRef, useState, useCallback } from 'react';
import { VideoPlayer, VideoPlayerRef } from './VideoPlayer';
import { AnnotationCanvas } from './AnnotationCanvas';
import { AnnotationToolbar } from './AnnotationToolbar';
import { ColorPicker } from './ColorPicker';
import { PitchDiagram, PITCH_REFERENCE_POINTS } from './PitchDiagram';
import { CalibrationPanel } from './CalibrationPanel';
import { ClipManager } from './ClipManager';
import { VideoUploader } from './VideoUploader';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useHomography } from '@/hooks/useHomography';
import type { AnnotationTool } from '@/types/annotation';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export const SoccerAnalyzer: React.FC = () => {
  const videoRef = useRef<VideoPlayerRef>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [videoDimensions, setVideoDimensions] = useState({ width: 800, height: 450 });
  const [activeTool, setActiveTool] = useState<AnnotationTool>('select');
  const [activeColor, setActiveColor] = useState('#ef4444');
  const [teamColors, setTeamColors] = useState({ home: '#ef4444', away: '#3b82f6' });
  const [currentTime, setCurrentTime] = useState(0);

  const {
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
  } = useAnnotations();

  const {
    homographyMatrix,
    isCalibrating,
    isCalibrated,
    calibrate,
    transformPoint,
    calculateDistance,
    reset: resetHomography,
  } = useHomography();

  const handleVideoLoad = useCallback((duration: number, width: number, height: number) => {
    // Scale to fit container while maintaining aspect ratio
    const maxWidth = 900;
    const scale = Math.min(1, maxWidth / width);
    setVideoDimensions({
      width: width * scale,
      height: height * scale,
    });
  }, []);

  const handleCalibrationPointFromVideo = useCallback((point: { videoX: number; videoY: number }) => {
    if (pendingVideoPoint) {
      toast.warning('Please select a pitch reference point first');
      return;
    }
    setPendingVideoPoint({ x: point.videoX, y: point.videoY });
    toast.info('Now click the corresponding point on the pitch diagram');
  }, [pendingVideoPoint, setPendingVideoPoint]);

  const handlePitchClick = useCallback((pitchX: number, pitchY: number) => {
    if (!pendingVideoPoint) {
      toast.warning('Please click on the video first to mark a calibration point');
      return;
    }

    // Find the nearest reference point
    let nearest = PITCH_REFERENCE_POINTS[0];
    let minDist = Infinity;
    for (const ref of PITCH_REFERENCE_POINTS) {
      const dist = Math.sqrt(Math.pow(ref.x - pitchX, 2) + Math.pow(ref.y - pitchY, 2));
      if (dist < minDist) {
        minDist = dist;
        nearest = ref;
      }
    }

    addCalibrationPoint(pendingVideoPoint.x, pendingVideoPoint.y, nearest.x, nearest.y);
    setPendingVideoPoint(null);
    toast.success(`Calibration point added: ${nearest.label}`);
  }, [pendingVideoPoint, addCalibrationPoint, setPendingVideoPoint]);

  const handleCalibrate = useCallback(async () => {
    const success = await calibrate(calibrationPoints);
    if (success) {
      setActiveTool('select');
    }
  }, [calibrate, calibrationPoints]);

  const handlePlayerAdd = useCallback((player: typeof players[0]) => {
    // Transform to pitch coordinates if calibrated
    if (isCalibrated) {
      const transformed = transformPoint(player.x, player.y);
      if (transformed) {
        player.pitchX = transformed.pitchX;
        player.pitchY = transformed.pitchY;
      }
    }
    addPlayer(player);
  }, [addPlayer, isCalibrated, transformPoint]);

  const handleClearAll = useCallback(() => {
    clearAll();
    clearCalibration();
    resetHomography();
    toast.success('All annotations cleared');
  }, [clearAll, clearCalibration, resetHomography]);

  const handleSeekToClip = useCallback((time: number) => {
    videoRef.current?.seekTo(time);
    videoRef.current?.pause();
  }, []);

  if (!videoSrc) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Soccer Video Analyzer</h1>
            <p className="text-muted-foreground">Professional video analysis and annotation tool</p>
          </div>
          <VideoUploader onVideoSelect={setVideoSrc} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Soccer Video Analyzer</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Home</Label>
              <ColorPicker color={teamColors.home} onChange={(c) => setTeamColors(prev => ({ ...prev, home: c }))} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Away</Label>
              <ColorPicker color={teamColors.away} onChange={(c) => setTeamColors(prev => ({ ...prev, away: c }))} />
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Draw Color</Label>
              <ColorPicker color={activeColor} onChange={setActiveColor} />
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-border bg-muted/30 px-4 py-2">
        <AnnotationToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onClear={handleClearAll}
          onUndo={undo}
          onRedo={redo}
          onExport={exportAnnotations}
          isCalibrated={isCalibrated}
        />
      </div>

      {/* Main Content */}
      <div className="flex gap-4 p-4">
        {/* Video Area */}
        <div className="flex-1 space-y-4">
          <div className="relative" style={{ width: videoDimensions.width }}>
            <VideoPlayer
              ref={videoRef}
              src={videoSrc}
              onTimeUpdate={setCurrentTime}
              onLoadedMetadata={handleVideoLoad}
            />
            <div 
              className="absolute top-0 left-0" 
              style={{ width: videoDimensions.width, height: videoDimensions.height }}
            >
              <AnnotationCanvas
                width={videoDimensions.width}
                height={videoDimensions.height}
                activeTool={activeTool}
                activeColor={activeColor}
                teamColors={teamColors}
                onPlayerAdd={handlePlayerAdd}
                onDistanceAdd={addDistance}
                onTrailAdd={addTrail}
                onCalibrationPointAdd={handleCalibrationPointFromVideo}
                calibrationPoints={calibrationPoints}
                homographyMatrix={homographyMatrix}
                calculateDistance={isCalibrated ? calculateDistance : undefined}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 space-y-4">
          <PitchDiagram
            players={players}
            distances={distances}
            trails={trails}
            calibrationPoints={calibrationPoints}
            calibrationMode={activeTool === 'calibrate'}
            onPitchClick={handlePitchClick}
            selectedCalibrationIndex={pendingVideoPoint ? calibrationPoints.length : undefined}
            transformPoint={isCalibrated ? transformPoint : undefined}
          />

          {activeTool === 'calibrate' && (
            <CalibrationPanel
              calibrationPoints={calibrationPoints}
              onRemovePoint={removeCalibrationPoint}
              onCalibrate={handleCalibrate}
              onClear={() => { clearCalibration(); resetHomography(); }}
              isCalibrated={isCalibrated}
              isLoading={isCalibrating}
            />
          )}

          <ClipManager
            clips={clips}
            currentTime={currentTime}
            onAddClip={addClip}
            onDeleteClip={deleteClip}
            onSeekToClip={handleSeekToClip}
          />

        </div>
      </div>
    </div>
  );
};
