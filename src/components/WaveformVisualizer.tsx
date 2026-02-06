import { useEffect, useRef, useState } from "react";

interface WaveformVisualizerProps {
  isActive: boolean;
  className?: string;
}

const WaveformVisualizer = ({ isActive, className = "" }: WaveformVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [bars] = useState(() => Array.from({ length: 12 }, () => Math.random() * 0.5 + 0.1));
  const barsRef = useRef(bars);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = width / (barsRef.current.length * 2);
      const gap = barWidth;

      ctx.clearRect(0, 0, width, height);

      if (isActive) {
        // Animate bars
        barsRef.current = barsRef.current.map((bar) => {
          const target = Math.random() * 0.8 + 0.2;
          return bar + (target - bar) * 0.15;
        });
      } else {
        // Settle to minimal
        barsRef.current = barsRef.current.map((bar) => bar * 0.95);
      }

      barsRef.current.forEach((bar, i) => {
        const x = i * (barWidth + gap) + gap / 2;
        const barHeight = bar * height * 0.8;
        const y = (height - barHeight) / 2;

        // Create gradient
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, isActive ? "rgba(59, 130, 246, 0.8)" : "rgba(148, 163, 184, 0.4)");
        gradient.addColorStop(1, isActive ? "rgba(37, 99, 235, 0.6)" : "rgba(148, 163, 184, 0.2)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={80}
      height={32}
      className={`${className}`}
      aria-hidden="true"
    />
  );
};

export default WaveformVisualizer;
