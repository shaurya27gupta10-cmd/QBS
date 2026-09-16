import { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import { 
  FolderLock, Upload, Image, Video, Music, FileText, 
  File as FileIcon, Eye, EyeOff, Play, Pause, Download, Share2, 
  RotateCcw, QrCode, AlertCircle, CheckCircle2, 
  FlaskConical, Check, X, ShieldCheck, AlertTriangle, Copy, ExternalLink,
  HardDrive, Cpu, Sliders, CheckCircle, Ban
} from 'lucide-react';
import { FileCategory, GeneratedSound, QrCodeData } from '../types';
import { encryptFile, inspectPayloadInfo, decryptFilePayload, bytesToBase64 } from '../lib/crypto';
import { synthesizeFskPcm, buildWavFile, generateFilename, extractPayloadFromWav } from '../lib/audioCodec';
import { generateEncryptedQrCode } from '../lib/qr';
import { 
  encryptFileStream, 
  DEFAULT_CHUNK_SIZE, 
  MIN_CHUNK_SIZE, 
  MAX_CHUNK_SIZE, 
  isFileSystemAccessSupported, 
  StreamEncryptResult 
} from '../lib/streamingCrypto';
import { AudioVisualizer } from './AudioVisualizer';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { ShareModal } from './ShareModal';
import { QrModal } from './QrModal';

interface FileEncodeTabProps {
  onTestDecode: (blob: Blob, filename: string, payload?: Uint8Array, password?: string) => void;
}

// Small audio threshold for FSK modulation (files above this use high-performance streaming QBS container)
const MAX_AUDIO_SOUND_BYTES = 5 * 1024 * 1024; // 5 MB

export function FileEncodeTab({ onTestDecode }: FileEncodeTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FileCategory>('all');

  // Encryption mode: 'stream_qbs' (high-performance chunked QBS file) or 'sound_wav' (carrier audio sound)
  const [encryptionMode, setEncryptionMode] = useState<'stream_qbs' | 'sound_wav'>('stream_qbs');

  // Chunk configuration (Default 16 MB as requested)
  const [chunkSize, setChunkSize] = useState<number>(DEFAULT_CHUNK_SIZE);
  const [saveDirectToDisk, setSaveDirectToDisk] = useState<boolean>(true);

  // Password state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Processing & Progress State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [processedBytes, setProcessedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [chunkStatus, setChunkStatus] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Cancellation Controller
  const abortControllerRef = useRef<AbortController | null>(null);

  // Results
  const [streamResult, setStreamResult] = useState<StreamEncryptResult | null>(null);
  const [generatedSound, setGeneratedSound] = useState<GeneratedSound | null>(null);

  // Audio Player State (when in sound_wav mode)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [soundDuration, setSoundDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // QR Code & Share State
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<QrCodeData | null>(null);

  // In-browser byte-for-byte verification test
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'verifying' | 'success' | 'failed';
    message?: string;
  }>({ status: 'idle' });

  // Cleanup object URLs on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (generatedSound?.url) URL.revokeObjectURL(generatedSound.url);
    };
  }, [previewUrl, generatedSound]);

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Category filter map
  const getCategoryAccept = (category: FileCategory): string => {
    switch (category) {
      case 'image':
        return 'image/*';
      case 'video':
        return 'video/*';
      case 'audio':
        return 'audio/*';
      case 'document':
        return '.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
      default:
        return '*/*';
    }
  };

  // Handle incoming file selection (Zero memory duplication: does not read whole buffer into state)
  const processSelectedFile = (selectedFile: File) => {
    setError(null);
    setTestResult({ status: 'idle' });
    setStreamResult(null);
    setGeneratedSound(null);
    setProgressPercent(0);
    setProcessedBytes(0);
    setTotalBytes(selectedFile.size);

    setFile(selectedFile);

    // If file is large (> 5 MB), enforce streaming QBS container mode
    if (selectedFile.size > MAX_AUDIO_SOUND_BYTES) {
      setEncryptionMode('stream_qbs');
    }

    // Only create object URL for small media files (< 25 MB) to avoid browser video engine OOM
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (selectedFile.size <= 25 * 1024 * 1024 && (selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('audio/'))) {
      const newPreviewUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(newPreviewUrl);
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

  // Drag & drop handlers
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
      processSelectedFile(droppedFile);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const openFilePicker = (category: FileCategory) => {
    setActiveCategory(category);
    const input = document.getElementById('file-picker-input') as HTMLInputElement;
    if (input) {
      input.accept = getCategoryAccept(category);
      input.click();
    }
  };

  // Audio playback controls
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setSoundDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // User Cancel Operation
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setProgressStep('Encryption cancelled.');
    setError('Operation cancelled by user.');
  };

  // Main Encryption Orchestrator
  const handleStartEncryption = async () => {
    setError(null);
    setTestResult({ status: 'idle' });
    setStreamResult(null);
    setGeneratedSound(null);

    if (!file) {
      setError('Please select a file to encrypt first.');
      return;
    }

    if (!password) {
      setError('Please enter an encryption password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (password.length < 6) {
      setError('For strong security, please use a password with at least 6 characters.');
      return;
    }

    setIsProcessing(true);
    setProgressPercent(0);
    setProcessedBytes(0);
    setTotalBytes(file.size);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Check if we should execute Streaming QBS Encryption or Carrier Sound
    if (encryptionMode === 'stream_qbs' || file.size > MAX_AUDIO_SOUND_BYTES) {
      try {
        let writable: FileSystemWritableFileStream | undefined;

        // If File System Access API is supported and selected, prompt user to select destination file
        if (saveDirectToDisk && isFileSystemAccessSupported()) {
          try {
            setProgressStep('Selecting destination on disk...');
            const handle = await (window as unknown as { 
              showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle> 
            }).showSaveFilePicker({
              suggestedName: `${file.name}.qbs`,
              types: [
                {
                  description: 'QBS Secure Encrypted Container',
                  accept: { 'application/octet-stream': ['.qbs'] },
                },
              ],
            });
            writable = await handle.createWritable();
          } catch (pickerErr: unknown) {
            // User closed the file save picker dialog without choosing
            if (pickerErr instanceof DOMException && pickerErr.name === 'AbortError') {
              setIsProcessing(false);
              return;
            }
            // If picker failed for permissions, continue with compatible in-browser blob fallback
            console.warn('File System Access picker fell back:', pickerErr);
          }
        }

        const result = await encryptFileStream({
          file,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          password,
          chunkSize,
          signal: abortController.signal,
          writable,
          onProgress: (prog) => {
            setProgressPercent(prog.percent);
            setProcessedBytes(prog.processedBytes);
            setTotalBytes(prog.totalBytes);
            setProgressStep(prog.step);
            setChunkStatus({ current: prog.currentChunk, total: prog.totalChunks });
          },
        });

        setStreamResult(result);
        setProgressPercent(100);
        setProgressStep('Encryption complete.');
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setError('Encryption cancelled by user.');
        } else if (err instanceof Error) {
          if (err.message.includes('Quota') || err.message.includes('allocation') || err.message.includes('out of memory')) {
            setError('Insufficient memory. Try using a smaller chunk size (e.g. 8 MB) or choose Direct to Disk.');
          } else {
            setError(err.message);
          }
        } else {
          setError('An unexpected error occurred during streaming encryption.');
        }
      } finally {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
    } else {
      // Small file: Carrier Audio Sound Mode (.wav)
      try {
        setProgressStep('Reading file slice for audio modulation...');
        setProgressPercent(10);

        const sliceBuffer = await file.arrayBuffer();
        const fileBytes = new Uint8Array(sliceBuffer);

        setProgressStep('Encrypting file with AES-256-GCM...');
        setProgressPercent(30);

        const payload = await encryptFile(
          fileBytes,
          file.name,
          file.type || 'application/octet-stream',
          password,
          (step, pct) => {
            setProgressStep(step);
            setProgressPercent(Math.floor(25 + (pct / 100) * 40));
          }
        );

        setProgressPercent(75);
        setProgressStep('Synthesizing FSK audio carrier...');
        await new Promise((r) => setTimeout(r, 60));

        const { pcmSamples, durationSeconds } = synthesizeFskPcm(payload);

        setProgressPercent(90);
        setProgressStep('Finalizing lossless WAV container...');
        const wavBlob = buildWavFile(pcmSamples, payload);
        const url = URL.createObjectURL(wavBlob);
        const filename = generateFilename(new Date(), 'wav');

        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const arrayBuffer = await wavBlob.arrayBuffer();
        const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        const qrRes = await generateEncryptedQrCode(payload, file.name);
        setQrCodeData({
          dataUrl: qrRes.dataUrl || '',
          isSelfContained: qrRes.fitsQr,
          fitsQr: qrRes.fitsQr,
          payloadSize: payload.length,
          warning: qrRes.warning,
          qrPayloadString: qrRes.qrPayloadString,
          isMultiPart: qrRes.isMultiPart,
          frameCount: qrRes.frameCount,
          frames: qrRes.frames,
        });

        const soundResult: GeneratedSound = {
          blob: wavBlob,
          url,
          filename,
          durationSeconds,
          payloadSizeBytes: payload.length,
          audioBuffer: decodedBuffer,
          rawPayload: payload,
          timestamp: Date.now(),
          payloadType: 'file',
          kdfType: 'argon2id',
          isCompressed: true,
          fileMetadata: {
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
            originalSizeBytes: file.size,
          },
        };

        setGeneratedSound(soundResult);
        setProgressPercent(100);
        setProgressStep('Sound ready');
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to generate secure sound file.');
        }
      } finally {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
    }
  };

  // Download Streamed QBS File
  const handleDownloadStreamQbs = () => {
    if (!streamResult?.blob) return;
    const a = document.createElement('a');
    const url = URL.createObjectURL(streamResult.blob);
    a.href = url;
    a.download = streamResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // Download Sound File
  const handleDownloadSound = () => {
    if (!generatedSound) return;
    const a = document.createElement('a');
    a.href = generatedSound.url;
    a.download = generatedSound.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Reset form
  const handleReset = () => {
    if (generatedSound?.url) URL.revokeObjectURL(generatedSound.url);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setStreamResult(null);
    setGeneratedSound(null);
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setProgressPercent(0);
    setProcessedBytes(0);
    setTotalBytes(0);
    setTestResult({ status: 'idle' });
  };

  const originalSize = file ? file.size : 0;
  const isLargeFile = originalSize > MAX_AUDIO_SOUND_BYTES;

  return (
    <div className="space-y-6">
      <input
        id="file-picker-input"
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Upload Drop Zone Card */}
      {!file ? (
        <div className="space-y-4">
          <div
            id="file-drop-zone"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => openFilePicker('all')}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer select-none ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/80 shadow-md ring-4 ring-blue-100 scale-[1.005]'
                : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/50'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                <Upload className={`w-7 h-7 transition-transform ${isDragOver ? 'scale-110 text-blue-700' : ''}`} />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-slate-900">
                  {isDragOver ? 'Release to drop file here' : 'Drop your file here'}
                </p>
                <p className="text-xs text-slate-500">
                  or
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openFilePicker('all');
                  }}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors pointer-events-auto"
                >
                  <FolderLock className="w-3.5 h-3.5" />
                  <span>Choose File</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 pt-2 flex items-center gap-1.5 justify-center flex-wrap">
                <span>Any size supported &bull; Scalable up to 5 GB+ with 16 MB Chunked Streaming</span>
              </p>
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-semibold text-slate-500 mr-1">Filter by:</span>
            <button
              type="button"
              onClick={() => openFilePicker('image')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-medium transition-colors"
            >
              <Image className="w-3.5 h-3.5 text-blue-600" />
              <span>📷 Photo</span>
            </button>
            <button
              type="button"
              onClick={() => openFilePicker('video')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-medium transition-colors"
            >
              <Video className="w-3.5 h-3.5 text-blue-600" />
              <span>🎥 Video</span>
            </button>
            <button
              type="button"
              onClick={() => openFilePicker('audio')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-medium transition-colors"
            >
              <Music className="w-3.5 h-3.5 text-blue-600" />
              <span>🎵 Audio</span>
            </button>
            <button
              type="button"
              onClick={() => openFilePicker('document')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-medium transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>📄 Document</span>
            </button>
            <button
              type="button"
              onClick={() => openFilePicker('other')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-medium transition-colors"
            >
              <FileIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>📁 Other / ISO / Zip</span>
            </button>
          </div>
        </div>
      ) : (
        /* Selected File Card */
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-white rounded-2xl border p-5 space-y-4 shadow-xs transition-all relative ${
            isDragOver ? 'border-blue-500 ring-4 ring-blue-100 bg-blue-50/20' : 'border-slate-200'
          }`}
        >
          {isDragOver && (
            <div className="absolute inset-0 bg-blue-50/90 border-2 border-blue-500 border-dashed rounded-2xl z-10 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
              <Upload className="w-8 h-8 text-blue-600 animate-bounce mb-2" />
              <p className="text-sm font-bold text-blue-900">Drop new file to replace selection</p>
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 overflow-hidden">
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                {file.type.startsWith('image/') ? (
                  <Image className="w-5 h-5" />
                ) : file.type.startsWith('video/') ? (
                  <Video className="w-5 h-5" />
                ) : file.type.startsWith('audio/') ? (
                  <Music className="w-5 h-5" />
                ) : file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text') ? (
                  <FileText className="w-5 h-5" />
                ) : (
                  <FileIcon className="w-5 h-5" />
                )}
              </div>
              <div className="truncate">
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {file.name}
                </h4>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">{formatBytes(file.size)}</span>
                  <span>&bull;</span>
                  <span className="truncate">{file.type || 'Binary Stream'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              disabled={isProcessing}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 p-1 rounded-md transition-colors disabled:opacity-40"
              title="Remove selected file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Type-Specific Preview (for small images/audio) */}
          {previewUrl && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-hidden">
              {file.type.startsWith('image/') ? (
                <div className="flex justify-center max-h-56 overflow-hidden rounded-lg">
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="max-h-56 object-contain rounded-lg shadow-2xs"
                  />
                </div>
              ) : file.type.startsWith('audio/') ? (
                <audio
                  src={previewUrl}
                  controls
                  className="w-full mt-1"
                />
              ) : null}
            </div>
          )}

          {/* Engine & Mode Selection */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-blue-600" />
                <span>Encryption Engine &amp; Container</span>
              </span>
              {isLargeFile && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold text-[10px]">
                  Large File Optimized
                </span>
              )}
            </div>

            {/* Mode selection if small file */}
            {!isLargeFile ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEncryptionMode('stream_qbs')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    encryptionMode === 'stream_qbs'
                      ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold text-xs">Encrypted QBS File (.qbs)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">High-speed chunked AES-GCM stream.</div>
                </button>

                <button
                  type="button"
                  onClick={() => setEncryptionMode('sound_wav')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    encryptionMode === 'sound_wav'
                      ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold text-xs">QBS Secure Sound (.wav)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Carrier sound modulated at 44.1 kHz.</div>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-blue-900 text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                  <span>Streaming Engine Activated for {formatBytes(file.size)}</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Files above 5 MB are processed in streaming chunks. The browser only keeps one 16 MB chunk in RAM at a time, eliminating crashes on 1 GB, 2 GB, and 5 GB+ files.
                </p>
              </div>
            )}

            {/* Configurable Chunk Size & Direct Disk Option */}
            {(encryptionMode === 'stream_qbs' || isLargeFile) && (
              <div className="pt-1 border-t border-slate-200/80 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label htmlFor="chunk-size-select" className="text-slate-600 font-medium text-[11px] flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                    <span>Chunk Size:</span>
                  </label>
                  <select
                    id="chunk-size-select"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    disabled={isProcessing}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value={4 * 1024 * 1024}>4 MB (Lowest RAM / Mobile)</option>
                    <option value={8 * 1024 * 1024}>8 MB (Mobile &amp; Tablets)</option>
                    <option value={16 * 1024 * 1024}>16 MB (Recommended Default)</option>
                    <option value={32 * 1024 * 1024}>32 MB (High Throughput Desktop)</option>
                  </select>
                </div>

                {isFileSystemAccessSupported() && (
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={saveDirectToDisk}
                      onChange={(e) => setSaveDirectToDisk(e.target.checked)}
                      disabled={isProcessing}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex items-center gap-1 font-medium">
                      <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                      <span>Direct-to-Disk Stream (Streams straight to hard drive with 0 RAM buildup)</span>
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Inputs (shown once file is selected) */}
      {file && !streamResult && !generatedSound && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Password */}
            <div>
              <label htmlFor="file-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Encryption Password
              </label>
              <div className="relative">
                <input
                  id="file-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter strong password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900 text-sm"
                  disabled={isProcessing}
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
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="file-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="file-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900 text-sm"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Validation Feedback */}
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-red-600 font-medium">
              Passwords do not match.
            </p>
          )}

          {/* Password Strength & Entropy Meter */}
          <PasswordStrengthIndicator
            password={password}
            onSelectPassphrase={(gen) => {
              setPassword(gen);
              setConfirmPassword(gen);
            }}
          />

          {/* Generate Button & Dynamic Progress */}
          <div className="pt-2">
            {!isProcessing ? (
              <button
                id="file-generate-sound-btn"
                type="button"
                onClick={handleStartEncryption}
                disabled={!file || !password || password !== confirmPassword}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-base shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[48px]"
              >
                <FolderLock className="w-5 h-5" />
                <span>
                  {encryptionMode === 'sound_wav' && !isLargeFile 
                    ? 'Generate Secure Sound (.wav)' 
                    : `Encrypt File (${formatBytes(file.size)})`}
                </span>
              </button>
            ) : (
              /* Active Progress with Percentage, Processed Size, and Cancel Button */
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span className="truncate pr-2">{progressStep}</span>
                  <span className="text-blue-700 font-mono font-bold text-sm whitespace-nowrap">
                    {progressPercent}%
                  </span>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${Math.max(progressPercent, 2)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                  <span className="font-mono">
                    {formatBytes(processedBytes)} / {formatBytes(totalBytes)}
                  </span>
                  {chunkStatus.total > 0 && (
                    <span className="text-slate-500">
                      Chunk {chunkStatus.current} of {chunkStatus.total} ({formatBytes(chunkSize)}/chunk)
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-xs transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Encryption Notice</p>
            <p className="leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Result Card: Streamed QBS File Result */}
      {streamResult && (
        <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5 sm:p-7 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {streamResult.isDirectToDisk 
                  ? 'Saved Directly to Disk' 
                  : 'QBS Encrypted Container Ready'}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {formatBytes(streamResult.encryptedSizeBytes)}
            </div>
          </div>

          {/* Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Original File</span>
              <span className="font-bold text-slate-800 truncate block">{file?.name}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Original Size</span>
              <span className="font-bold text-slate-800">{formatBytes(streamResult.originalSizeBytes)}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Cipher / Protocol</span>
              <span className="font-bold text-blue-700">AES-256-GCM (Stream)</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Authentication</span>
              <span className="font-bold text-slate-800">Per-Chunk AEAD Tag</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!streamResult.isDirectToDisk && streamResult.blob && (
              <button
                onClick={handleDownloadStreamQbs}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                <span>Download Encrypted File ({streamResult.filename})</span>
              </button>
            )}

            {streamResult.blob && (
              <button
                onClick={() => onTestDecode(streamResult.blob!, streamResult.filename, undefined, password)}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs sm:text-sm transition-colors min-h-[44px]"
              >
                <FlaskConical className="w-4 h-4" />
                <span>🧪 Open in Decoder</span>
              </button>
            )}

            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm transition-colors min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Encrypt Another File</span>
            </button>
          </div>
        </div>
      )}

      {/* Result Card: Carrier Sound WAV Result (for small files) */}
      {generatedSound && (
        <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5 sm:p-7 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>QBS Secure Sound Ready</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {formatBytes(generatedSound.blob.size)}
            </div>
          </div>

          {/* Waveform Telemetry Visualizer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>Acoustic Waveform Telemetry</span>
              <span>{soundDuration > 0 ? soundDuration.toFixed(1) : generatedSound.durationSeconds.toFixed(1)}s</span>
            </div>
            <AudioVisualizer
              audioElement={audioRef.current}
              isPlaying={isPlaying}
            />
          </div>

          {/* Audio Player Controls */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm flex-shrink-0 focus:outline-none transition-transform active:scale-95"
              aria-label={isPlaying ? 'Pause sound' : 'Play sound'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <div className="flex-1 w-full space-y-1">
              <input
                type="range"
                min={0}
                max={soundDuration || generatedSound.durationSeconds || 1}
                step={0.01}
                value={currentTime}
                onChange={handleSeek}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>{currentTime.toFixed(1)}s</span>
                <span>{(soundDuration || generatedSound.durationSeconds).toFixed(1)}s</span>
              </div>
            </div>

            <audio
              ref={audioRef}
              src={generatedSound.url}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleAudioEnded}
              className="hidden"
            />
          </div>

          {/* Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Original File</span>
              <span className="font-bold text-slate-800 truncate block">{file?.name}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Payload Type</span>
              <span className="font-bold text-blue-700">QBSF (File)</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Cipher / Hash</span>
              <span className="font-bold text-slate-800">AES-256-GCM</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Sound Format</span>
              <span className="font-bold text-slate-800">RIFF WAV (44.1kHz)</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleDownloadSound}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>Download Sound (.wav)</span>
            </button>

            <button
              onClick={() => setShareModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm transition-colors min-h-[44px]"
              title="Share QR code, audio sound, or encrypted payload"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>

            <button
              onClick={() => setQrModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm transition-colors min-h-[44px]"
            >
              <QrCode className="w-4 h-4" />
              <span>QR Code</span>
            </button>

            <button
              onClick={() => onTestDecode(generatedSound.blob, generatedSound.filename, generatedSound.rawPayload, password)}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs sm:text-sm transition-colors min-h-[44px]"
            >
              <FlaskConical className="w-4 h-4" />
              <span>🧪 Open in Decoder</span>
            </button>
          </div>

          {/* Reset */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Encode another file</span>
            </button>
            <span className="text-[11px] text-slate-400">
              Plaintext file and password are never stored.
            </span>
          </div>
        </div>
      )}

      {/* Modals for QR / Share */}
      {qrModalOpen && generatedSound && (
        <QrModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          qrCodeData={qrCodeData}
          rawPayload={generatedSound.rawPayload}
          filename={file?.name || 'file'}
          onOpenInDecoder={() => {
            setQrModalOpen(false);
            onTestDecode(generatedSound.blob, generatedSound.filename, generatedSound.rawPayload, password);
          }}
        />
      )}

      {generatedSound && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          title={`Share Encrypted File (${file?.name})`}
          filename={generatedSound.filename}
          soundBlob={generatedSound.blob}
          rawPayload={generatedSound.rawPayload}
          qrDataUrl={qrCodeData?.dataUrl}
          fitsQr={qrCodeData?.fitsQr}
          qrPayloadString={qrCodeData?.qrPayloadString || `QBSF:${bytesToBase64(generatedSound.rawPayload)}`}
          isMultiPart={qrCodeData?.isMultiPart}
          frameCount={qrCodeData?.frameCount}
          onOpenInDecoder={() => onTestDecode(generatedSound.blob, generatedSound.filename, generatedSound.rawPayload, password)}
          onOpenQrModal={() => setQrModalOpen(true)}
        />
      )}

      {/* Security Guarantee Notice */}
      <div className="p-4 rounded-xl bg-slate-100/60 border border-slate-200 flex items-center gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>100% Client-Side Web Crypto AES-256-GCM &bull; No servers &bull; Zero memory bloat for files up to 5 GB+</span>
      </div>
    </div>
  );
}
