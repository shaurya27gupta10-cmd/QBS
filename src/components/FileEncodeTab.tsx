import { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import { 
  FolderLock, Upload, Image, Video, Music, FileText, 
  File, Eye, EyeOff, Play, Pause, Download, Share2, 
  RotateCcw, QrCode, AlertCircle, CheckCircle2, 
  FlaskConical, Check, X, ShieldCheck, AlertTriangle 
} from 'lucide-react';
import { FileCategory, GeneratedSound, QrCodeData } from '../types';
import { encryptFile, inspectPayloadInfo, decryptFilePayload } from '../lib/crypto';
import { synthesizeFskPcm, buildWavFile, generateFilename, extractPayloadFromWav } from '../lib/audioCodec';
import { generateEncryptedQrCode } from '../lib/qr';
import { AudioVisualizer } from './AudioVisualizer';

interface FileEncodeTabProps {
  onTestDecode: (blob: Blob, filename: string, payload: Uint8Array) => void;
}

// Limits
const WARN_THRESHOLD_BYTES = 2.5 * 1024 * 1024; // 2.5 MB warning
const MAX_BROWSER_BYTES = 25 * 1024 * 1024;     // 25 MB max in-browser

export function FileEncodeTab({ onTestDecode }: FileEncodeTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FileCategory>('all');

  // Warning state for large files
  const [showLargeFileWarning, setShowLargeFileWarning] = useState(false);
  const [acknowledgedWarning, setAcknowledgedWarning] = useState(false);

  // Password state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Generation & Progress State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Result Sound State
  const [generatedSound, setGeneratedSound] = useState<GeneratedSound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [soundDuration, setSoundDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // QR Code State
  const [qrModalOpen, setQrModalOpen] = useState(false);
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
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
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

  // Handle incoming file selection
  const processSelectedFile = async (selectedFile: File) => {
    setError(null);
    setTestResult({ status: 'idle' });
    setGeneratedSound(null);
    setAcknowledgedWarning(false);
    setShowLargeFileWarning(false);

    // Hard limit check
    if (selectedFile.size > MAX_BROWSER_BYTES) {
      setError('This file is too large for browser-only processing. Please choose a smaller file (under 25 MB).');
      return;
    }

    // Large file advisory
    if (selectedFile.size > WARN_THRESHOLD_BYTES) {
      setShowLargeFileWarning(true);
    }

    setFile(selectedFile);

    // Create safe preview
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const newPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(newPreviewUrl);

    // Read file bytes
    try {
      const buffer = await selectedFile.arrayBuffer();
      setFileBytes(new Uint8Array(buffer));
    } catch (err) {
      setError('Unable to read selected file into memory.');
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => {
    setIsDragOver(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  // Trigger file picker with chosen category
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

  // Main File Encryption & Audio Generation
  const handleGenerateSound = async () => {
    setError(null);
    setTestResult({ status: 'idle' });

    if (!file || !fileBytes) {
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
    setProgressPercent(5);
    setProgressStep('Reading file...');

    try {
      await new Promise((r) => setTimeout(r, 120));

      // 1. Encrypt file into QBSF container
      setProgressPercent(25);
      setProgressStep('Encrypting file with AES-256-GCM...');

      const payload = await encryptFile(
        fileBytes,
        file.name,
        file.type || 'application/octet-stream',
        password,
        (step, pct) => {
          setProgressStep(step);
          // Scale pct between 25 and 65
          setProgressPercent(Math.floor(25 + (pct / 100) * 40));
        }
      );

      // 2. Synthesize audio
      setProgressPercent(75);
      setProgressStep('Encoding secure sound...');
      await new Promise((r) => setTimeout(r, 150));

      const { pcmSamples, durationSeconds } = synthesizeFskPcm(payload);

      // 3. Build RIFF/WAV file containing exact payload in 'qbsd' chunk
      setProgressPercent(90);
      setProgressStep('Finalizing lossless WAV container...');
      const wavBlob = buildWavFile(pcmSamples, payload);
      const url = URL.createObjectURL(wavBlob);
      const filename = generateFilename(new Date(), 'wav');

      // Create audio buffer for visualizer
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await wavBlob.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      // Generate QR Code if applicable
      const qrRes = await generateEncryptedQrCode(payload);
      setQrCodeData({
        dataUrl: qrRes.dataUrl || '',
        isSelfContained: qrRes.fitsQr,
        fitsQr: qrRes.fitsQr,
        payloadSize: payload.length,
        warning: qrRes.warning,
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
        fileMetadata: {
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          originalSizeBytes: file.size,
        },
      };

      setGeneratedSound(soundResult);
      setProgressPercent(100);
      setProgressStep('Complete');
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while encrypting the file.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Test Decode In-Memory with Byte-for-Byte Comparison
  const handleRunCompatibilityTest = async () => {
    if (!generatedSound || !fileBytes || !password) return;

    setTestResult({ status: 'verifying', message: 'Testing audio demodulation & file recovery...' });

    try {
      // Step 1: Read arrayBuffer from generated WAV blob
      const arrayBuffer = await generatedSound.blob.arrayBuffer();

      // Step 2: Extract payload from RIFF WAV container
      const extractedPayload = extractPayloadFromWav(arrayBuffer);

      // Step 3: Decrypt file payload
      const decryptedResult = await decryptFilePayload(extractedPayload, password);

      // Step 4: Byte-by-byte comparison
      if (decryptedResult.data.length !== fileBytes.length) {
        setTestResult({
          status: 'failed',
          message: `✕ Verification failed: Decrypted size (${decryptedResult.data.length} bytes) does not match original size (${fileBytes.length} bytes).`,
        });
        return;
      }

      let match = true;
      for (let i = 0; i < fileBytes.length; i++) {
        if (decryptedResult.data[i] !== fileBytes[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        setTestResult({
          status: 'success',
          message: `✓ File integrity verified: Decrypted ${decryptedResult.filename} (${formatBytes(decryptedResult.sizeBytes)}) matches original file byte-for-byte.`,
        });
      } else {
        setTestResult({
          status: 'failed',
          message: '✕ Verification failed: Decrypted byte stream differs from original file.',
        });
      }

      // Revoke temporary test URL
      URL.revokeObjectURL(decryptedResult.objectUrl);
    } catch (testErr: unknown) {
      console.error(testErr);
      setTestResult({
        status: 'failed',
        message: testErr instanceof Error ? testErr.message : '✕ Verification failed during playback demodulation.',
      });
    }
  };

  // Download Sound File
  const handleDownload = () => {
    if (!generatedSound) return;
    const a = document.createElement('a');
    a.href = generatedSound.url;
    a.download = generatedSound.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Share Sound
  const handleShare = async () => {
    if (!generatedSound) return;
    try {
      const shareFile = new File([generatedSound.blob], generatedSound.filename, {
        type: 'audio/wav',
      });
      if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
        await navigator.share({
          files: [shareFile],
          title: 'QBS Secure Sound',
          text: `Encrypted file sound (${file?.name}): Play or decode with QBS Secure Sound.`,
        });
      } else {
        handleDownload();
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handleDownload();
      }
    }
  };

  // Reset form
  const handleReset = () => {
    if (generatedSound?.url) URL.revokeObjectURL(generatedSound.url);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setFileBytes(null);
    setPreviewUrl(null);
    setGeneratedSound(null);
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setTestResult({ status: 'idle' });
    setShowLargeFileWarning(false);
  };

  // Estimate calculations
  const originalSize = file ? file.size : 0;
  const estimatedPayloadSize = originalSize + 120; // 120 bytes container overhead
  const estimatedSoundSize = Math.max(originalSize + 300000, 320000); // WAV header + FSK audio + payload chunk

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
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => openFilePicker('all')}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/50'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                <Upload className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-slate-900">
                  Drop your file here
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
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors"
                >
                  <FolderLock className="w-3.5 h-3.5" />
                  <span>Choose File</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 pt-2">
                Images, Videos, Audio, PDF, Documents &amp; Binaries &bull; Up to 25 MB
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
              <File className="w-3.5 h-3.5 text-blue-600" />
              <span>📁 Other</span>
            </button>
          </div>
        </div>
      ) : (
        /* Selected File Card & Previews */
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
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
                  <File className="w-5 h-5" />
                )}
              </div>
              <div className="truncate">
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {file.name}
                </h4>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">{formatBytes(file.size)}</span>
                  <span>&bull;</span>
                  <span className="truncate">{file.type || 'Binary / Data'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 p-1 rounded-md transition-colors"
              title="Remove selected file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Type-Specific Preview */}
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
              ) : file.type.startsWith('video/') ? (
                <video
                  src={previewUrl}
                  controls
                  className="w-full max-h-60 rounded-lg bg-black"
                />
              ) : file.type.startsWith('audio/') ? (
                <audio
                  src={previewUrl}
                  controls
                  className="w-full mt-1"
                />
              ) : (
                <div className="flex items-center gap-3 py-2 px-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-600">
                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="truncate">Document ready for client-side encryption.</span>
                </div>
              )}
            </div>
          )}

          {/* Size Calculation & Warning */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="font-semibold text-slate-800">Estimated Dimensions:</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Original File:</span>
                <span className="font-bold text-slate-900">{formatBytes(originalSize)}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Encrypted Payload:</span>
                <span className="font-bold text-slate-900">{formatBytes(estimatedPayloadSize)}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Estimated QBS Sound:</span>
                <span className="font-bold text-blue-700">{formatBytes(estimatedSoundSize)}</span>
              </div>
            </div>

            {/* Warning for large files */}
            {showLargeFileWarning && !acknowledgedWarning && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Large file detected ({formatBytes(file.size)})</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Encoding this file into a sound may create a larger audio file. QBS Sound is best suited for small/medium files.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAcknowledgedWarning(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-semibold text-xs hover:bg-amber-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Inputs (shown once file is selected) */}
      {file && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Password */}
            <div>
              <label htmlFor="file-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
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

          {/* Generate Button & Progress */}
          {!generatedSound && (
            <div className="pt-2">
              <button
                id="file-generate-sound-btn"
                type="button"
                onClick={handleGenerateSound}
                disabled={isProcessing || !file || !password || password !== confirmPassword}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-base shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[48px]"
              >
                <FolderLock className="w-5 h-5" />
                <span>Generate Secure Sound</span>
              </button>

              {/* Progress Indicator */}
              {isProcessing && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>{progressStep}</span>
                    <span className="text-blue-600">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="font-medium leading-relaxed">{error}</p>
        </div>
      )}

      {/* Generated Secure Sound Results */}
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

          {/* File Information Specs */}
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
              onClick={handleDownload}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>Download Sound (.wav)</span>
            </button>

            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm transition-colors min-h-[44px]"
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
              onClick={handleRunCompatibilityTest}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs sm:text-sm transition-colors min-h-[44px]"
            >
              <FlaskConical className="w-4 h-4" />
              <span>🧪 Test Decode</span>
            </button>
          </div>

          {/* Verification Test Result Banner */}
          {testResult.status !== 'idle' && (
            <div className={`p-4 rounded-xl border text-xs sm:text-sm font-medium ${
              testResult.status === 'verifying'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : testResult.status === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <span>{testResult.message}</span>
                {testResult.status === 'success' && (
                  <button
                    onClick={() => onTestDecode(generatedSound.blob, generatedSound.filename, generatedSound.rawPayload)}
                    className="ml-2 text-xs font-bold text-emerald-900 underline hover:no-underline whitespace-nowrap"
                  >
                    Open in Decoder &rarr;
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Reset / Encode Another */}
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

      {/* QR Code Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Encrypted QR Code
              </h3>
              <button
                onClick={() => setQrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {qrCodeData?.fitsQr && qrCodeData.dataUrl ? (
              <div className="space-y-3 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                  <img
                    src={qrCodeData.dataUrl}
                    alt="Encrypted QR Code"
                    className="w-60 h-60 mx-auto"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Self-contained encrypted payload ({formatBytes(qrCodeData.payloadSize)}). Contains no password.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2 text-xs text-amber-900">
                <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
                <p className="font-bold text-sm">
                  QR Code is not suitable for this file size.
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Use the QBS Secure Sound file (.wav) to transmit and decode this file reliably.
                </p>
              </div>
            )}

            <button
              onClick={() => setQrModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Security Statement */}
      <div className="p-4 rounded-xl bg-slate-100/60 border border-slate-200 flex items-center gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>Your file is encrypted locally before it is converted into QBS Secure Sound.</span>
      </div>
    </div>
  );
}
