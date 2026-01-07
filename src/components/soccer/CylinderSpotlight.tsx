import React, { useRef, useEffect } from "react";

/**
 * TACTICAL SPOTLIGHT STYLES FOR SOCCER VIDEO ANALYSIS
 *
 * Professional spotlights used in Metrica Play, Hudl, Wyscout, etc.
 * These are the ACTUAL spotlight types used in tactical analysis.
 */

export type SpotlightType =
  | "circle" // Simple circle highlight (most common)
  | "glow" // Glowing halo effect
  | "pulse" // Pulsing attention grabber
  | "ring" // Ring/donut shape
  | "cone" // Cone of vision/space
  | "gradient"; // Soft gradient fade

interface TacticalSpotlightProps {
  x: number;
  y: number;
  color?: string;
  type?: SpotlightType;
  size?: number;
  intensity?: number;
  animate?: boolean;
}

export const TacticalSpotlight: React.FC<TacticalSpotlightProps> = ({
  x,
  y,
  color = "#34e89e",
  type = "glow",
  size = 80,
  intensity = 0.6,
  animate = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = (timestamp: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (animate) {
        timeRef.current = timestamp;
      }

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Parse color
      const rgb = hexToRgb(color);

      switch (type) {
        case "circle":
          drawCircleSpotlight(ctx, centerX, centerY, size, rgb, intensity);
          break;
        case "glow":
          drawGlowSpotlight(ctx, centerX, centerY, size, rgb, intensity, animate ? timeRef.current : 0);
          break;
        case "pulse":
          drawPulseSpotlight(ctx, centerX, centerY, size, rgb, intensity, timeRef.current);
          break;
        case "ring":
          drawRingSpotlight(ctx, centerX, centerY, size, rgb, intensity);
          break;
        case "cone":
          drawConeSpotlight(ctx, centerX, centerY, size, rgb, intensity);
          break;
        case "gradient":
          drawGradientSpotlight(ctx, centerX, centerY, size, rgb, intensity);
          break;
      }

      if (animate) {
        animationRef.current = requestAnimationFrame(render);
      }
    };

    render(0);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [color, type, size, intensity, animate]);

  const canvasSize = size * 3;

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      style={{
        position: "absolute",
        left: x - canvasSize / 2,
        top: y - canvasSize / 2,
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
};

// ============= SPOTLIGHT DRAWING FUNCTIONS =============

/**
 * Simple circle with border - most common in tactical analysis
 */
function drawCircleSpotlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rgb: { r: number; g: number; b: number },
  intensity: number,
) {
  // Fill
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.3})`;
  ctx.fill();

  // Border
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/**
 * Glowing halo effect - professional highlight
 */
function drawGlowSpotlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rgb: { r: number; g: number; b: number },
  intensity: number,
  time: number,
) {
  const pulseIntensity = animate ? 0.85 + Math.sin(time * 0.003) * 0.15 : 1;

  // Outer glow layers
  for (let i = 3; i >= 0; i--) {
    const layerSize = size + i * 15;
    const layerAlpha = (intensity * 0.2 * pulseIntensity) / (i + 1);

    const gradient = ctx.createRadialGradient(x, y, size * 0.5, x, y, layerSize);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${layerAlpha})`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

    ctx.beginPath();
    ctx.arc(x, y, layerSize, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // Core
  ctx.beginPath();
  ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.4 * pulseIntensity})`;
  ctx.fill();

  // Ring
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * pulseIntensity})`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/**
 * Pulsing spotlight - attention grabbing
 */
function drawPulseSpotlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rgb: { r: number; g: number; b: number },
  intensity: number,
  time: number,
) {
  const pulse = 0.7 + Math.sin(time * 0.004) * 0.3;
  const currentSize = size * pulse;

  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, currentSize + 10, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * (1 - pulse * 0.5)})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Main circle
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, currentSize);
  gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.5 * pulse})`);
  gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.3 * pulse})`);
  gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

  ctx.beginPath();
  ctx.arc(x, y, currentSize, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

/**
 * Ring/donut spotlight - emphasizes area without blocking view
 */
function drawRingSpotlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rgb: { r: number; g: number; b: number },
  intensity: number,
) {
  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`;
  ctx.lineWidth = 8;
  ctx.stroke();

  // Inner shadow
  ctx.beginPath();
  ctx.arc(x, y, size - 10, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.3})`;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Outer glow
  ctx.beginPath();
  ctx.arc(x, y, size + 5, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.5})`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/**
 * Cone spotlight - shows direction/vision
 */
function drawConeSpotlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rgb: { r: number; g: number; b: number },
  intensity: number,
) {
  const coneAngle = Math.PI / 3; // 60 degrees
  const coneLength = size * 1.5;

  // Cone gradient
  const gradient = ctx.createRadialGradient(x, y, 0, x, y - coneLength / 2, coneLength);
  gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.5})`);
  gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

  // Draw cone
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, coneLength, -Math.PI / 2 - coneAngle / 2, -Math.PI / 2 + coneAngle / 2);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Cone edges
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.6})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Base circle
  ctx.beginPath();
  ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.8})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Soft gradient spotlight - subtle emphasis
 */
function drawGradientSpotlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rgb: { r: number; g: number; b: number },
  intensity: number,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
  gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.6})`);
  gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.3})`);
  gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

// ============= HELPERS =============

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 52, g: 232, b: 158 }; // Default teal
}

// ============= USAGE EXAMPLES =============

export const SpotlightExamples: React.FC = () => {
  return (
    <div style={{ position: "relative", width: "800px", height: "600px", background: "#1a1a2e" }}>
      {/* Highlight attacking player */}
      <TacticalSpotlight x={200} y={150} type="glow" color="#34e89e" size={60} animate />

      {/* Show defensive zone */}
      <TacticalSpotlight x={400} y={300} type="circle" color="#e74c3c" size={100} />

      {/* Pulse on key moment */}
      <TacticalSpotlight x={600} y={200} type="pulse" color="#f39c12" size={50} animate />

      {/* Ring around space */}
      <TacticalSpotlight x={300} y={450} type="ring" color="#3498db" size={80} />

      {/* Player vision cone */}
      <TacticalSpotlight x={500} y={500} type="cone" color="#9b59b6" size={70} />
    </div>
  );
};
