import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  isGenerating?: boolean;
}

export function AudioVisualizer({ audioElement, isPlaying, isGenerating = false }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Setup Web Audio API Analyser
  useEffect(() => {
    if (!audioElement) return;

    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }

      const ctx = audioCtxRef.current;
      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        try {
          if (!sourceRef.current) {
            const source = ctx.createMediaElementSource(audioElement);
            source.connect(analyser);
            analyser.connect(ctx.destination);
            sourceRef.current = source;
          }
        } catch {
          // Source already connected
        }
      }
    } catch {
      // Browser autoplay policy / audio element initialization error
    }
  }, [audioElement]);

  // Render loop on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let step = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      step += 0.05;

      ctx.clearRect(0, 0, width, height);

      // Background subtle grid
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      if (isGenerating) {
        // Generating waveform animation (synthetic FSK pulses)
        ctx.beginPath();
        ctx.strokeStyle = '#2563eb'; // Blue-600
        ctx.lineWidth = 2.5;

        for (let x = 0; x < width; x++) {
          const freq = (x % 30 < 15) ? 0.08 : 0.16; // FSK frequency alternation
          const y = height / 2 + Math.sin(x * freq + step * 3) * (height * 0.32);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (isPlaying && analyserRef.current) {
        // Real-time audio waveform from playing element
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);

        ctx.beginPath();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2.5;

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      } else {
        // Resting telemetry baseline with subtle harmonic ripple
        ctx.beginPath();
        ctx.strokeStyle = '#94a3b8'; // Slate-400
        ctx.lineWidth = 1.5;
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.03 + step * 0.5) * 4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isGenerating]);

  return (
    <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-hidden shadow-inner">
      <canvas
        ref={canvasRef}
        width={600}
        height={80}
        className="w-full h-20 block rounded"
      />
    </div>
  );
}
