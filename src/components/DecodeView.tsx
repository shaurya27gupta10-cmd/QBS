import { useState, useRef, useEffect, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { 
  KeyRound, Upload, FileAudio, Play, Pause, Copy, 
  Download, Trash2, AlertCircle, CheckCircle2, Eye, EyeOff, 
  Sparkles, Check, ArrowRight, ShieldAlert, FolderLock, 
  MessageSquare, Image, Video, Music, FileText, File as FileIcon, 
  Share2, RotateCcw, ShieldCheck, CheckCheck, Camera, QrCode, 
  ClipboardPaste, ImageIcon
} from 'lucide-react';
import { extractPayloadFromWav } from '../lib/audioCodec';
import { decryptPayload, decryptFilePayload, base64ToBytes, bytesToBase64, inspectPayloadInfo, PayloadInfo } from '../lib/crypto';
import { parseAndNormalizeQrPayload, resolveQrPayload, scanQrFromImage } from '../lib/qr';
import { QrScannerModal } from './QrScannerModal';
import { AudioVisualizer } from './AudioVisualizer';
import { DecryptedFileResult } from '../types';

interface DecodeViewProps {
  initialFile?: {
    blob: Blob;
    filename: string;
    payload?: Uint8Array;
    password?: string;
  } | null;
}

export function DecodeView({ initialFile }: DecodeViewProps) {
  const [sourceMode, setSourceMode] = useState<'audio' | 'qr'>('audio');
  const [qrText, setQrText] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [qrStatusSuccess, setQrStatusSuccess] = useState<string | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [extractedRawPayload, setExtractedRawPayload] = useState<Uint8Array | null>(null);

  // Automatic Type Detection State
  const [detectedInfo, setDetectedInfo] = useState<PayloadInfo | null>(null);

  // Password & Decryption State
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Results
  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null);
  const [decryptedFile, setDecryptedFile] = useState<DecryptedFileResult | null>(null);

  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Audio Playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // Keep refs to avoid effect loops
  const audioUrlRef = useRef<string | null>(null);
  const decryptedFileRef = useRef<DecryptedFileResult | null>(null);
  const prevInitialBlobRef = useRef<Blob | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  useEffect(() => {
    decryptedFileRef.current = decryptedFile;
  }, [decryptedFile]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (decryptedFileRef.current?.objectUrl) URL.revokeObjectURL(decryptedFileRef.current.objectUrl);
    };
  }, []);

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Inspect payload helper
  const analyzePayloadBytes = (payload: Uint8Array) => {
    try {
      const info = inspectPayloadInfo(payload);
      setDetectedInfo(info);
      setExtractedRawPayload(payload);
      return info;
    } catch {
      setDetectedInfo(null);
      return null;
    }
  };

  const handleFileProcess = useCallback(async (file: File | Blob, name: string) => {
    setError(null);
    setDecryptedMessage(null);
    if (decryptedFileRef.current?.objectUrl) {
      URL.revokeObjectURL(decryptedFileRef.current.objectUrl);
    }
    setDecryptedFile(null);
    setDetectedInfo(null);
    setExtractedRawPayload(null);

    // 1. Check if it's an image file (e.g. QR code screenshot or photo)
    const isImageFile = (name && name.match(/\.(png|jpe?g|webp|gif|svg)$/i)) || (file.type && file.type.startsWith('image/'));
    if (isImageFile) {
      try {
        setLoadingStep('Scanning image for QR code...');
        const scanned = await scanQrFromImage(file);
        setLoadingStep('');
        if (scanned) {
          setSourceMode('qr');
          setQrText(scanned);
          try {
            const raw = await resolveQrPayload(scanned);
            analyzePayloadBytes(raw);
          } catch {
            // Ignore pre-detect error
          }
          setQrStatusSuccess('QR Code detected from image!');
          setTimeout(() => setQrStatusSuccess(null), 3500);
          return;
        } else {
          setError('Could not find a QR code in this image. Make sure the QR code is clearly visible, or paste the code directly.');
          return;
        }
      } catch {
        setLoadingStep('');
        setError('Failed to scan image for QR code.');
        return;
      }
    }

    // 2. Check if it's a portable .qbs encrypted container file
    if (name && name.toLowerCase().endsWith('.qbs')) {
      try {
        const buffer = await file.arrayBuffer();
        const raw = new Uint8Array(buffer);
        setSourceMode('qr');
        setQrText(`QBSS:${bytesToBase64(raw)}`);
        analyzePayloadBytes(raw);
        setQrStatusSuccess('Encrypted container loaded (.qbs)');
        setTimeout(() => setQrStatusSuccess(null), 3500);
        return;
      } catch {
        setError('Failed to read .qbs container file.');
        return;
      }
    }

    // 3. Audio WAV format check
    if (name && !name.toLowerCase().endsWith('.wav') && file.type && !file.type.includes('audio') && !file.type.includes('wav')) {
      setError('This format is not supported. Please use a QBS WAV audio file, or upload a QR image.');
      return;
    }

    if (typeof window !== 'undefined' && typeof window.File !== 'undefined' && file instanceof window.File) {
      setSelectedFile(file);
    }
    setFileBlob(file);
    setFileName(name);
    setFileSize(file.size);

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    audioUrlRef.current = url;
    setAudioUrl(url);

    // Pre-parse the WAV container to detect payload type before password entry
    try {
      const buffer = await file.arrayBuffer();
      const payload = extractPayloadFromWav(buffer);
      analyzePayloadBytes(payload);
    } catch {
      // Ignore if user hasn't pressed decode yet; handleDecode will report full error
    }
  }, []);

  // If initial file is provided via "Test Decode" from EncodeView
  useEffect(() => {
    if (initialFile && initialFile.blob !== prevInitialBlobRef.current) {
      prevInitialBlobRef.current = initialFile.blob;
      handleFileProcess(initialFile.blob, initialFile.filename);
      if (initialFile.password) {
        setPassword(initialFile.password);
      }
    }
  }, [initialFile, handleFileProcess]);

  // Handle QR text change and pre-detect
  const handleQrTextChange = async (val: string) => {
    setQrText(val);
    setError(null);
    setDecryptedMessage(null);
    setDecryptedFile(null);
    if (val.trim().length > 6) {
      try {
        const raw = await resolveQrPayload(val);
        analyzePayloadBytes(raw);
      } catch {
        setDetectedInfo(null);
      }
    } else {
      setDetectedInfo(null);
    }
  };

  // Prevent default window navigation if file dropped outside drop zone
  useEffect(() => {
    const preventDefaultWindowDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefaultWindowDrop, false);
    window.addEventListener('drop', preventDefaultWindowDrop, false);
    return () => {
      window.removeEventListener('dragover', preventDefaultWindowDrop, false);
      window.removeEventListener('drop', preventDefaultWindowDrop, false);
    };
  }, []);

  // Robust Drag & drop handlers
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    let droppedFile: File | null = null;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      droppedFile = e.dataTransfer.files[0];
    } else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) {
            droppedFile = f;
            break;
          }
        }
      }
    }

    if (droppedFile) {
      // If dropped in QR mode, switch to audio mode automatically
      if (sourceMode !== 'audio') {
        setSourceMode('audio');
      }
      handleFileProcess(droppedFile, droppedFile.name);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileProcess(file, file.name);
    }
    e.target.value = '';
  };

  // Toggle Audio Playback
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error(err);
      });
    }
  };

  // Main Decode Pipeline
  const handleDecode = async () => {
    setError(null);
    setDecryptedMessage(null);
    if (decryptedFile?.objectUrl) URL.revokeObjectURL(decryptedFile.objectUrl);
    setDecryptedFile(null);

    if (sourceMode === 'audio' && !fileBlob) {
      setError('Please select or upload a QBS Secure Sound audio file first.');
      return;
    }

    if (sourceMode === 'qr' && !qrText.trim()) {
      setError('Please paste an encrypted QBS QR payload string first.');
      return;
    }

    if (!password) {
      setError('Please enter a password.');
      return;
    }

    setIsLoading(true);

    try {
      let payload: Uint8Array;

      if (sourceMode === 'audio') {
        // Step 1: Analyze audio
        setLoadingStep('Analyzing sound...');
        await new Promise((r) => setTimeout(r, 160));

        const arrayBuffer = await fileBlob!.arrayBuffer();

        // Step 2: Extract encrypted payload from RIFF WAV container
        setLoadingStep('Recovering encrypted payload...');
        await new Promise((r) => setTimeout(r, 160));

        payload = extractPayloadFromWav(arrayBuffer);
      } else {
        setLoadingStep('Parsing encrypted QR payload...');
        await new Promise((r) => setTimeout(r, 140));

        try {
          payload = await resolveQrPayload(qrText);
        } catch {
          throw new Error('This does not appear to be a valid QBS Secure Sound payload. Please ensure you have scanned the QR code or copied the complete code (e.g. QBSS:... or QBSF:...).');
        }
      }

      // Step 3: Inspect payload type
      const info = inspectPayloadInfo(payload);
      setDetectedInfo(info);

      // Step 4: Branch by type
      if (info.type === 'file') {
        setLoadingStep('Verifying integrity...');
        await new Promise((r) => setTimeout(r, 120));

        setLoadingStep('Decrypting file...');
        const fileResult = await decryptFilePayload(payload, password, (step) => {
          setLoadingStep(step);
        });

        setLoadingStep('Reconstructing original file...');
        await new Promise((r) => setTimeout(r, 120));

        setDecryptedFile(fileResult);
      } else {
        // Message mode
        setLoadingStep('Verifying integrity...');
        await new Promise((r) => setTimeout(r, 120));

        setLoadingStep('Decrypting message...');
        const plaintext = await decryptPayload(payload, password);
        setDecryptedMessage(plaintext);
      }
    } catch (err: unknown) {
      console.warn('Decode validation notice:', err instanceof Error ? err.message : err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to decrypt. Check the password or audio file.');
      }
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  // Copy decrypted message
  const handleCopyMessage = () => {
    if (!decryptedMessage) return;
    navigator.clipboard.writeText(decryptedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download decrypted message as .txt
  const handleDownloadText = () => {
    if (!decryptedMessage) return;
    const blob = new Blob([decryptedMessage], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QBS-Decrypted-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download Decrypted File
  const handleDownloadFile = () => {
    if (!decryptedFile) return;
    const a = document.createElement('a');
    a.href = decryptedFile.objectUrl;
    a.download = decryptedFile.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Share Decrypted File
  const handleShareFile = async () => {
    if (!decryptedFile) return;
    try {
      const shareData = new File([decryptedFile.data], decryptedFile.filename, {
        type: decryptedFile.mimeType,
      });
      if (navigator.canShare && navigator.canShare({ files: [shareData] })) {
        await navigator.share({
          files: [shareData],
          title: decryptedFile.filename,
          text: `Decrypted file (${decryptedFile.filename})`,
        });
      } else {
        handleDownloadFile();
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handleDownloadFile();
      }
    }
  };

  // Clear state
  const handleClear = () => {
    if (decryptedFile?.objectUrl) URL.revokeObjectURL(decryptedFile.objectUrl);
    setDecryptedMessage(null);
    setDecryptedFile(null);
    setPassword('');
    setError(null);
  };

  const isFileType = detectedInfo?.type === 'file';

  return (
    <div className="py-6 sm:py-10 max-w-3xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
          <KeyRound className="w-3.5 h-3.5" />
          <span>Demodulator &amp; Decryptor</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Decode Secure Sound
        </h1>
        <p className="mt-1 text-sm sm:text-base text-slate-600">
          Recover your encrypted message or file using the QBS sound and password.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-8 space-y-6">
        {/* Source Mode Toggle Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl max-w-md">
          <button
            type="button"
            onClick={() => setSourceMode('audio')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              sourceMode === 'audio'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Sound File (.wav)</span>
          </button>
          <button
            type="button"
            onClick={() => setSourceMode('qr')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              sourceMode === 'qr'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Code / Encrypted Code</span>
          </button>
        </div>

        {/* Upload Drop Zone (Audio Mode) */}
        {sourceMode === 'audio' ? (
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Upload QBS Sound (.wav)
            </label>
            <div
              id="audio-drop-zone"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer select-none ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/80 shadow-md ring-4 ring-blue-100 scale-[1.005]'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'
              }`}
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <input
                id="file-upload-input"
                type="file"
                accept=".wav,audio/wav,audio/x-wav,.qbs,image/*"
                className="hidden"
                onChange={handleFileInputChange}
              />

              <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                  <Upload className={`w-6 h-6 transition-transform ${isDragOver ? 'scale-110 text-blue-700' : ''}`} />
                </div>
                <div className="text-sm font-medium text-slate-800">
                  {isDragOver ? (
                    <span className="font-bold text-blue-600">Release to drop QBS file or QR image</span>
                  ) : (
                    <>
                      <span className="font-bold text-blue-600 hover:underline">Choose Audio File</span> or drop sound / QR image here
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Supports QBS WAV sound files, QR screenshots (.png/.jpg), and portable .qbs containers
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* QR Text / Camera / Image Mode */
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="decode-qr-input" className="block text-sm font-semibold text-slate-800">
                Encrypted QR Code / Payload String
              </label>

              {/* Quick Actions: Camera, Upload Image, Paste */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                  title="Scan QR code with camera"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan Camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => qrFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  title="Upload QR screenshot or image file"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        handleQrTextChange(text);
                        setQrStatusSuccess('Pasted from clipboard!');
                        setTimeout(() => setQrStatusSuccess(null), 2500);
                      }
                    } catch {
                      // Clipboard read permission might be blocked in some browsers
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  title="Paste encrypted payload from clipboard"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Paste</span>
                </button>
              </div>
            </div>

            {/* Hidden File Input for QR Image */}
            <input
              ref={qrFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  try {
                    setLoadingStep('Scanning image for QR code...');
                    const scanned = await scanQrFromImage(file);
                    setLoadingStep('');
                    if (scanned) {
                      handleQrTextChange(scanned);
                      setQrStatusSuccess('QR Code detected from image!');
                      setTimeout(() => setQrStatusSuccess(null), 3000);
                    } else {
                      setError('Could not find a QR code in this image. Ensure the QR code is clear and visible.');
                    }
                  } catch {
                    setLoadingStep('');
                    setError('Failed to process the QR image.');
                  }
                  e.target.value = '';
                }
              }}
            />

            <textarea
              id="decode-qr-input"
              rows={4}
              value={qrText}
              onChange={(e) => handleQrTextChange(e.target.value)}
              placeholder="Paste encrypted QR payload (QBSS:..., QBSF:..., or base64), or use Camera / Upload Image above..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900 font-mono text-xs sm:text-sm"
            />

            {qrStatusSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-fade-in">
                <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>{qrStatusSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Supports all QBS payload formats (QBSS, QBSF, QBS1, base64)</span>
              {qrText && (
                <button
                  type="button"
                  onClick={() => {
                    setQrText('');
                    setDetectedInfo(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Selected File Details & Audio Preview */}
        {sourceMode === 'audio' && fileBlob && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                  <FileAudio className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {fileName || 'QBS-Secure-Sound.wav'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatBytes(fileSize)} &bull; Audio WAV Container
                  </div>
                </div>
              </div>

              {audioUrl && (
                <button
                  id="preview-audio-play-btn"
                  onClick={togglePlay}
                  className="w-9 h-9 rounded-full bg-white border border-slate-300 hover:border-slate-400 text-slate-700 flex items-center justify-center shadow-xs flex-shrink-0"
                  aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
              )}
            </div>

            {/* Audio Element & Waveform */}
            {audioUrl && (
              <>
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
                />
                <AudioVisualizer audioElement={audioRef.current} isPlaying={isPlaying} />
              </>
            )}
          </div>
        )}

        {/* Automatic Payload Type Detection Badge */}
        {detectedInfo && (
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 text-xs sm:text-sm text-blue-900">
            <div className="flex items-center gap-3">
              {detectedInfo.type === 'file' ? (
                <FolderLock className="w-5 h-5 text-blue-600 flex-shrink-0" />
              ) : (
                <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
              )}
              <div className="truncate flex-1">
                {detectedInfo.type === 'file' ? (
                  <span>
                    <strong className="font-semibold text-blue-950">QBS File Container:</strong>{' '}
                    {detectedInfo.filename || 'Encrypted File'} ({formatBytes(detectedInfo.originalSizeBytes || 0)})
                  </span>
                ) : (
                  <span>
                    <strong className="font-semibold text-blue-950">QBS Message Container</strong> (Encrypted text payload)
                  </span>
                )}
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-200 text-blue-900 uppercase">
                {detectedInfo.kdf === 'argon2id' ? 'Argon2id' : 'PBKDF2'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-blue-800 border-t border-blue-200/60">
              <span className="flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                {detectedInfo.version === 2 ? 'QBS-Secure v2' : 'Legacy v1'}
              </span>
              <span>&bull;</span>
              <span>
                {detectedInfo.kdf === 'argon2id'
                  ? `Argon2id (64MB RAM, ${detectedInfo.kdfParams?.timeCost || 3} iters)`
                  : 'PBKDF2 (100,000 iters)'}
              </span>
              {detectedInfo.isCompressed && (
                <>
                  <span>&bull;</span>
                  <span className="text-emerald-700 font-semibold">Deflate Compression</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Password Input Section */}
        <div>
          <label htmlFor="decode-password-input" className="block text-sm font-semibold text-slate-800 mb-1.5">
            Decryption Password
          </label>
          <div className="relative">
            <input
              ref={passwordInputRef}
              id="decode-password-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDecode()}
              placeholder="Enter the password used to encrypt the sound"
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900 text-sm sm:text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            The password is never stored or transmitted anywhere. Decryption runs exclusively in your browser.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Decryption Failed</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Loading Progress State */}
        {isLoading && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div className="text-sm font-semibold">
              {loadingStep || 'Processing audio stream...'}
            </div>
          </div>
        )}

        {/* Action Button (Dynamic label: Decode Message or Decode File) */}
        <div>
          <button
            id="decode-message-btn"
            type="button"
            disabled={isLoading}
            onClick={handleDecode}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-base shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[48px]"
          >
            {isLoading ? (
              <span>Decrypting...</span>
            ) : (
              <>
                {isFileType ? <FolderLock className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
                <span>{isFileType ? 'Decode File' : 'Decode Message'}</span>
              </>
            )}
          </button>
        </div>

        {/* Decrypted Message Success Display */}
        {decryptedMessage !== null && (
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-base font-bold text-slate-900">
                  Message successfully decrypted.
                </span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                Authenticated AES-256
              </span>
            </div>

            {/* Plaintext Container */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 shadow-inner space-y-3">
              <p className="text-slate-900 text-base leading-relaxed whitespace-pre-wrap font-sans select-all break-words">
                {decryptedMessage}
              </p>

              {/* Cryptographic Proof Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <Check className="w-3 h-3 text-emerald-600" />
                  AES-256-GCM Authenticated Tag Verified
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  <Check className="w-3 h-3 text-blue-600" />
                  AAD Header Integrity Bound
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  <Check className="w-3 h-3 text-slate-500" />
                  Outer CRC32 Checksum Intact
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  id="copy-message-btn"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy Message'}</span>
                </button>

                <button
                  id="download-text-btn"
                  onClick={handleDownloadText}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Download Text (.txt)</span>
                </button>
              </div>

              <button
                id="clear-message-btn"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Message</span>
              </button>
            </div>
          </div>
        )}

        {/* Decrypted File Success Display */}
        {decryptedFile !== null && (
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-base font-bold text-slate-900">
                  File successfully decrypted.
                </span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                Integrity Verified &bull; Exact Byte Match
              </span>
            </div>

            {/* File Info Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                  {decryptedFile.mimeType.startsWith('image/') ? (
                    <Image className="w-5 h-5" />
                  ) : decryptedFile.mimeType.startsWith('video/') ? (
                    <Video className="w-5 h-5" />
                  ) : decryptedFile.mimeType.startsWith('audio/') ? (
                    <Music className="w-5 h-5" />
                  ) : decryptedFile.mimeType.includes('pdf') || decryptedFile.mimeType.includes('document') ? (
                    <FileText className="w-5 h-5" />
                  ) : (
                    <FileIcon className="w-5 h-5" />
                  )}
                </div>
                <div className="truncate">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {decryptedFile.filename}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{formatBytes(decryptedFile.sizeBytes)}</span>
                    <span>&bull;</span>
                    <span className="truncate">{decryptedFile.mimeType}</span>
                  </div>
                </div>
              </div>

              {/* Type-Specific Preview */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 overflow-hidden">
                {decryptedFile.mimeType.startsWith('image/') ? (
                  <div className="flex justify-center max-h-72 overflow-hidden rounded-lg">
                    <img
                      src={decryptedFile.objectUrl}
                      alt={decryptedFile.filename}
                      className="max-h-72 object-contain rounded-lg shadow-2xs"
                    />
                  </div>
                ) : decryptedFile.mimeType.startsWith('video/') ? (
                  <video
                    src={decryptedFile.objectUrl}
                    controls
                    className="w-full max-h-72 rounded-lg bg-black"
                  />
                ) : decryptedFile.mimeType.startsWith('audio/') ? (
                  <audio
                    src={decryptedFile.objectUrl}
                    controls
                    className="w-full mt-1"
                  />
                ) : decryptedFile.mimeType.includes('pdf') ? (
                  <iframe
                    src={decryptedFile.objectUrl}
                    title={decryptedFile.filename}
                    className="w-full h-80 rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="flex items-center gap-3 py-3 px-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                    <FileIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800 block">Binary / Document File</span>
                      <span>Decrypted file is ready for download.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Cryptographic Proof Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <Check className="w-3 h-3 text-emerald-600" />
                  AES-256-GCM Authenticated Tag Verified
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  <Check className="w-3 h-3 text-blue-600" />
                  AAD Header Integrity Bound
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  <Check className="w-3 h-3 text-slate-500" />
                  Outer CRC32 Checksum Intact
                </span>
              </div>
            </div>

            {/* File Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  id="download-file-btn"
                  onClick={handleDownloadFile}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors min-h-[40px]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </button>

                <button
                  id="share-file-btn"
                  onClick={handleShareFile}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs sm:text-sm font-semibold shadow-xs transition-colors min-h-[40px]"
                >
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span>Share File</span>
                </button>
              </div>

              <button
                id="clear-file-btn"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-colors ml-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Decode Another</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Security Statement */}
      <div className="mt-6 p-4 rounded-xl bg-slate-100/60 border border-slate-200 flex items-center gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>Decryption runs entirely client-side using Web Crypto API. Your decrypted files never leave your browser.</span>
      </div>

      {/* Live Camera QR Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(scannedText) => {
          setIsScannerOpen(false);
          setSourceMode('qr');
          handleQrTextChange(scannedText);
          const isFileCode = scannedText.trim().toUpperCase().startsWith('QBSF:');
          setQrStatusSuccess(
            isFileCode
              ? 'QBSF File QR Code scanned automatically!'
              : 'QBS QR Code scanned automatically!'
          );
          setTimeout(() => setQrStatusSuccess(null), 3500);
          setTimeout(() => {
            passwordInputRef.current?.focus();
          }, 150);
        }}
      />
    </div>
  );
}
