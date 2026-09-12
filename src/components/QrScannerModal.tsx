import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Camera,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Sparkles
} from 'lucide-react';
import { scanQrFromImage, scanQrFromImageData } from '../lib/qr';

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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Scan frame loop
  const requestScanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const scannedCode = scanQrFromImageData(imageData);

      if (scannedCode) {
        // Haptic feedback if available
        try {
          navigator.vibrate?.(50);
        } catch {
          // ignore
        }

        setDetectedSuccess(true);
        stopCamera();
        setTimeout(() => {
          onScanSuccess(scannedCode);
          onClose();
        }, 400);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(requestScanFrame);
  };

  // Handle image file selection
  const handleImageUpload = async (file: File) => {
    setIsProcessingImage(true);
    setCameraError(null);

    try {
      const code = await scanQrFromImage(file);
      if (code) {
        setDetectedSuccess(true);
        stopCamera();
        setTimeout(() => {
          onScanSuccess(code);
          onClose();
        }, 400);
      } else {
        setCameraError('No valid QR code found in this image. Please ensure the QR code is clearly visible.');
      }
    } catch (err: unknown) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
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
                Point your camera at a QBS QR code or upload image
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
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-blue-400/50 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
              </div>
            </div>
          )}

          {/* Detection Success Banner */}
          {detectedSuccess && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 p-4 text-center animate-fade-in">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
              <p className="font-bold text-base text-emerald-100">QR Code Detected!</p>
              <p className="text-xs text-emerald-200/80">Loading into decoder...</p>
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
