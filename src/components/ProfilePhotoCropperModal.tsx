import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Move, 
  Check, 
  X, 
  Loader2, 
  Sparkles, 
  ShieldCheck,
  Crop
} from 'lucide-react';
import { 
  cropAndOptimizeImage, 
  uploadUserProfilePhoto, 
  OptimizedImageResult 
} from '../utils/photoUpload';

interface ProfilePhotoCropperModalProps {
  isOpen: boolean;
  file: File | null;
  userId: string;
  onClose: () => void;
  onUploadSuccess: (newAvatarUrl: string) => void;
}

const VIEWPORT_SIZE = 260; // preview box width/height in px

export const ProfilePhotoCropperModal: React.FC<ProfilePhotoCropperModalProps> = ({
  isOpen,
  file,
  userId,
  onClose,
  onUploadSuccess,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Cropping parameters
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);

  // Drag interaction state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [optimizedPreview, setOptimizedPreview] = useState<OptimizedImageResult | null>(null);

  // Load selected file into memory as ObjectURL immediately (0ms delay)
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      setImageSrc(objectUrl);
      setZoom(1.0);
      setPanX(0);
      setPanY(0);
      setRotation(0);
      setErrorMessage(null);
    };
    img.onerror = () => {
      setErrorMessage('Could not load the selected image. Please try a different picture.');
    };
    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // Compute live crop calculation for sharpness and size estimate
  useEffect(() => {
    if (!imageSrc || naturalSize.width === 0) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const result = await cropAndOptimizeImage(
          imageSrc,
          { panX, panY, zoom, rotation, containerSize: VIEWPORT_SIZE },
          640,
          0.88
        );
        if (isMounted) {
          setOptimizedPreview(result);
        }
      } catch (err) {
        // silent preview calculation fallback
      }
    }, 120);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [imageSrc, panX, panY, zoom, rotation, naturalSize]);

  // Mouse & Touch Drag Event Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX,
      panY,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    // Max drag boundaries to keep photo in aperture
    const maxBound = (VIEWPORT_SIZE * zoom) / 1.5;
    const newPanX = Math.max(-maxBound, Math.min(maxBound, dragStartRef.current.panX + dx));
    const newPanY = Math.max(-maxBound, Math.min(maxBound, dragStartRef.current.panY + dy));

    setPanX(newPanX);
    setPanY(newPanY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Quick reset
  const handleReset = () => {
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
    setRotation(0);
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Perform upload to Firebase Storage and update Firestore
  const handleUploadAndSave = async () => {
    if (!imageSrc || isUploading) return;

    setIsUploading(true);
    setUploadProgress(10);
    setErrorMessage(null);

    try {
      // 1. Generate final high-definition cropped image (up to 640x640)
      const cropped = await cropAndOptimizeImage(
        imageSrc,
        { panX, panY, zoom, rotation, containerSize: VIEWPORT_SIZE },
        640,
        0.88
      );

      // 2. Upload to Firebase Storage with Cache-Control headers
      const downloadUrl = await uploadUserProfilePhoto({
        userId,
        blob: cropped.blob,
        format: cropped.format,
        dataUrlFallback: cropped.dataUrl,
        onProgress: (pct) => setUploadProgress(pct),
      });

      // 3. Notify parent component with new avatar URL
      onUploadSuccess(downloadUrl);
      onClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorMessage(err.message || 'Failed to upload photo. Please check your network and try again.');
      setIsUploading(false);
    }
  };

  if (!isOpen || !file || !imageSrc) return null;

  // Base dimensions calculation to preserve aspect ratio
  const baseScale = Math.max(
    VIEWPORT_SIZE / naturalSize.width,
    VIEWPORT_SIZE / naturalSize.height
  ) || 1;
  const currentWidth = naturalSize.width * baseScale * zoom;
  const currentHeight = naturalSize.height * baseScale * zoom;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative my-auto space-y-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="text-left">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Crop className="w-4 h-4 text-blue-400" />
              Crop & Position Photo
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Drag to reposition your face and zoom for clear resolution.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-left">
            {errorMessage}
          </div>
        )}

        {/* Interactive Viewport Area */}
        <div className="flex flex-col items-center justify-center py-1">
          <div 
            className="relative overflow-hidden rounded-2xl bg-slate-950 border-2 border-slate-700 cursor-grab active:cursor-grabbing touch-none select-none shadow-inner"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* The Image being transformed */}
            <div
              className="absolute pointer-events-none transition-transform duration-75 will-change-transform"
              style={{
                width: currentWidth,
                height: currentHeight,
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) rotate(${rotation}deg)`,
              }}
            >
              <img
                src={imageSrc}
                alt="Source preview"
                className="w-full h-full object-cover select-none pointer-events-none"
                draggable={false}
              />
            </div>

            {/* Circular Vignette Overlay Mask */}
            <div className="absolute inset-0 pointer-events-none ring-1 ring-white/10">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <defs>
                  <mask id="avatar-crop-mask">
                    <rect width="100" height="100" fill="white" />
                    <circle cx="50" cy="50" r="46" fill="black" />
                  </mask>
                </defs>
                <rect 
                  width="100" 
                  height="100" 
                  fill="rgba(2, 6, 23, 0.65)" 
                  mask="url(#avatar-crop-mask)" 
                />
                {/* Visual Circle Guide */}
                <circle 
                  cx="50" 
                  cy="50" 
                  r="46" 
                  fill="none" 
                  stroke="rgba(59, 130, 246, 0.8)" 
                  strokeWidth="1" 
                  strokeDasharray="3 3"
                />
              </svg>
            </div>

            {/* Reposition Hint Icon */}
            <div className="absolute bottom-2 right-2 bg-slate-950/70 backdrop-blur-sm text-slate-300 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 pointer-events-none border border-slate-800">
              <Move className="w-3 h-3 text-blue-400" />
              <span>Drag to move</span>
            </div>
          </div>
        </div>

        {/* Cropping Controls (Zoom & Rotation) */}
        <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
          {/* Zoom Slider */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(1.0, Math.round((prev - 0.2) * 10) / 10))}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3.0, Math.round((prev + 0.2) * 10) / 10))}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono text-slate-400 w-9 text-right">
              {zoom.toFixed(1)}x
            </span>
          </div>

          {/* Secondary Controls: Rotate & Reset */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                title="Rotate 90 degrees"
              >
                <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                <span>Rotate 90°</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] transition-colors"
                title="Reset crop and position"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Quality & Size Specs */}
            {optimizedPreview && (
              <div className="text-[10px] text-slate-400 font-medium">
                <span className="text-blue-400 uppercase font-semibold">{optimizedPreview.format}</span> · {optimizedPreview.width}×{optimizedPreview.height}px · ~{optimizedPreview.sizeKB}KB
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar during upload */}
        {isUploading && (
          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-blue-400 font-semibold flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Fast Cloud Upload in progress...
              </span>
              <span className="text-slate-300 font-mono">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUploadAndSave}
            disabled={isUploading}
            className="flex-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Photo...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save & Upload Photo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
