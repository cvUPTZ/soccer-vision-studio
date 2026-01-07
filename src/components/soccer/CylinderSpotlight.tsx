import React, { useRef, useEffect } from 'react';

interface CylinderSpotlightProps {
  x: number;
  y: number;
  color: string;
  radius?: number;
  height?: number;
  opacity?: number;
}

export const CylinderSpotlight: React.FC<CylinderSpotlightProps> = ({
  x,
  y,
  color,
  radius = 30,
  height = 80,
  opacity = 0.6,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height - radius;

    // Parse color to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 255, g: 0, b: 0 };
    };

    const rgb = hexToRgb(color);

    // Draw the cylinder sides with gradient
    const gradient = ctx.createLinearGradient(centerX - radius, 0, centerX + radius, 0);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    gradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.5})`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`);
    gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.5})`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

    // Draw cylinder body (trapezoid shape for perspective)
    const topWidth = radius * 0.7; // Narrower at top for perspective
    const bottomWidth = radius;
    
    ctx.beginPath();
    ctx.moveTo(centerX - bottomWidth, centerY);
    ctx.lineTo(centerX - topWidth, centerY - height);
    ctx.lineTo(centerX + topWidth, centerY - height);
    ctx.lineTo(centerX + bottomWidth, centerY);
    ctx.closePath();
    
    // Fill with gradient
    const bodyGradient = ctx.createLinearGradient(0, centerY - height, 0, centerY);
    bodyGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.3})`);
    bodyGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`);
    ctx.fillStyle = bodyGradient;
    ctx.fill();

    // Draw bottom ellipse (base of cylinder)
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, bottomWidth, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.8})`;
    ctx.fill();
    
    // Draw edge glow
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw top ellipse (top of cylinder)
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - height, topWidth, radius * 0.2, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw vertical edge lines
    ctx.beginPath();
    ctx.moveTo(centerX - bottomWidth, centerY);
    ctx.lineTo(centerX - topWidth, centerY - height);
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.8})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + bottomWidth, centerY);
    ctx.lineTo(centerX + topWidth, centerY - height);
    ctx.stroke();

  }, [color, radius, height, opacity]);

  return (
    <canvas
      ref={canvasRef}
      width={radius * 3}
      height={height + radius}
      style={{
        position: 'absolute',
        left: x - (radius * 1.5),
        top: y - height - (radius * 0.3),
        pointerEvents: 'none',
      }}
    />
  );
};
