import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Camera,
  RefreshCw,
  AlertCircle,
  Image as ImageIcon,
  Check
} from 'lucide-react';
import { scanQrFromImage, scanQrFromVideo } from '../lib/qr';

function playScanBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 clear chime
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // AudioContext blocked without user gesture
  }
}

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (payloadText: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [detectedSuccess, setDetectedSuccess] = useState<boolean>(false);
  const [multiPartProgress, setMultiPartProgress] = useState<{ current: number; total: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isHandledRef = useRef<boolean>(false);
  const partsMapRef = useRef<Map<number, string>>(new Map());

  // Stop camera stream cleanly
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Start camera stream
  const startCamera = async () => {
    stopCamera();
    isHandledRef.current = false;
    partsMapRef.current.clear();
    setMultiPartProgress(null);
    setCameraError(null);
    setDetectedSuccess(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCamera(false);
      setCameraError('Camera access is not supported by your browser environment. You can upload a QR image instead.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        await videoRef.current.play();
        setIsScanning(true);
        requestScanFrame();
      }
    } catch (err: unknown) {
      console.warn('Camera stream notice:', err);
      const errMsg = (err as Error).name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in browser settings or upload a QR image.'
        : 'Unable to access camera. You can upload a QR code image/screenshot below.';
      setCameraError(errMsg);
      setIsScanning(false);
    }
  };

  // Process a scanned raw code text automatically
  const handleScannedData = (scannedCode: string) => {
    if (isHandledRef.current) return;

    // Check if this is a multi-part QR frame (QBSP:idx/total:data)
    const multiMatch = scannedCode.match(/^QBSP\s*:\s*(\d+)\s*\/\s*(\d+)\s*:\s*([\s\S]+)$/i);
    if (multiMatch) {
      const idx = parseInt(multiMatch[1], 10);
      const total = parseInt(multiMatch[2], 10);
      const chunk = multiMatch[3];

      if (!partsMapRef.current.has(idx)) {
        partsMapRef.current.set(idx, chunk);
        try {
          navigator.vibrate?.(40);
        } catch {
          // ignore
        }
      }

      setMultiPartProgress({ current: partsMapRef.current.size, total });

      // If all parts have arrived, assemble them!
      if (partsMapRef.current.size >= total) {
        isHandledRef.current = true;
        playScanBeep();
        try {
          navigator.vibrate?.(80);
        } catch {
          // ignore
        }

        let assembled = '';
        for (let i = 1; i <= total; i++) {
          assembled += partsMapRef.current.get(i) || '';
        }

        setDetectedSuccess(true);
        stopCamera();

        setTimeout(() => {
          onScanSuccess(assembled);
          onClose();
        }, 300);
      }
      return;
    }

    // Standard single QR code
    isHandledRef.current = true;

    // Instant acoustic + haptic feedback
    playScanBeep();
    try {
      navigator.vibrate?.(60);
    } catch {
      // ignore
    }

    setDetectedSuccess(true);
    stopCamera();

    // Automatically load into decoder and dismiss modal
    setTimeout(() => {
      onScanSuccess(scannedCode);
      onClose();
    }, 250);
  };

  // Fast continuous scan loop
  const requestScanFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current || isHandledRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState >= 2) {
      const scannedCode = await scanQrFromVideo(video, canvas);
      if (scannedCode && !isHandledRef.current) {
        handleScannedData(scannedCode);
        return;
      }
    }

    if (!isHandledRef.current) {
      animationFrameRef.current = requestAnimationFrame(requestScanFrame);
    }
  };

  // Handle image file selection
  const handleImageUpload = async (file: File) => {
    setIsProcessingImage(true);
    setCameraError(null);

    try {
      const code = await scanQrFromImage(file);
      if (code) {
        handleScannedData(code);
      } else {
        setCameraError('No valid QR code found in this image. Please ensure the QR code is clearly visible.');
      }
    } catch {
      setCameraError('Failed to read image. Please try another image.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Scan Encrypted QR Code
              </h3>
              <p className="text-xs text-slate-500">
                Instant Automatic Detection
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport / Scanner Frame */}
        <div className="relative aspect-square w-full max-w-[340px] mx-auto rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${isScanning ? 'block' : 'hidden'}`}
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Overlay Box */}
          {isScanning && !detectedSuccess && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-3/4 h-3/4 border-2 border-blue-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] animate-pulse">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                {/* Aiming crosshair */}
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-blue-400/60 shadow-[0_0_8px_rgba(96,165,250,0.9)]" />
              </div>
            </div>
          )}

          {/* Detection Success Banner */}
          {detectedSuccess && (
            <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 p-4 text-center animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg animate-bounce">
                <Check className="w-7 h-7 text-white stroke-[3]" />
              </div>
              <p className="font-bold text-base text-emerald-100">QR Code Detected!</p>
              <p className="text-xs text-emerald-200/90">Loading automatically into decoder...</p>
            </div>
          )}

          {/* Fallback / Camera Error Message */}
          {(!isScanning || cameraError) && !detectedSuccess && (
            <div className="p-5 text-center text-slate-300 space-y-3">
              <Camera className="w-10 h-10 text-slate-500 mx-auto" />
              <p className="text-xs text-slate-400 max-w-[260px] mx-auto leading-relaxed">
                {cameraError || 'Camera unavailable. Please upload a screenshot or photo of the QR code below.'}
              </p>
              {hasCamera && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
              )}
            </div>
          )}

          {/* Scanning Guidance Badge or Multi-Part Progress */}
          {isScanning && !detectedSuccess && (
            <div className="absolute bottom-3 inset-x-3 flex justify-center pointer-events-none">
              {multiPartProgress ? (
                <span className="px-3 py-1.5 rounded-full bg-blue-900/90 backdrop-blur-md text-[11px] font-bold text-cyan-200 border border-cyan-500/50 shadow-lg animate-pulse">
                  Captured {multiPartProgress.current} / {multiPartProgress.total} parts &bull; Keep camera pointed!
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-[11px] font-medium text-slate-200 border border-slate-700/60 shadow-lg">
                  Automatic scan active &bull; Point at QBS QR code
                </span>
              )}
            </div>
          )}
        </div>

        {/* Alternative: Upload Image of QR code */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleImageUpload(e.target.files[0]);
              }
              e.target.value = '';
            }}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessingImage}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-semibold transition-colors"
            >
              <ImageIcon className="w-4 h-4 text-blue-600" />
              <span>{isProcessingImage ? 'Analyzing Image...' : 'Upload QR Image / Photo'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
