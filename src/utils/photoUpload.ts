import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';

export const DEFAULT_AVATAR = '/src/assets/images/avatar_elie_1790670827487.jpg';

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export interface CropSettings {
  panX: number; // offset in preview coordinate pixels
  panY: number; // offset in preview coordinate pixels
  zoom: number; // scale multiplier, e.g. 1.0 to 3.0
  rotation?: number; // 0, 90, 180, 270 degrees
  containerSize?: number; // viewport size, defaults to 240
}

export interface OptimizedImageResult {
  blob: Blob;
  dataUrl: string;
  format: 'webp' | 'jpeg';
  width: number;
  height: number;
  sizeKB: number;
}

/**
 * Validate image file format and size
 * Supports: JPG, JPEG, PNG, WebP up to 5MB for fast loading
 */
export function validateImageFile(file: File): ImageValidationResult {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  const maxBytes = 5 * 1024 * 1024; // 5MB

  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // Type check
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  const hasValidExt = /\.(jpe?g|png|webp)$/i.test(fileName);

  if (!allowedTypes.includes(fileType) && !hasValidExt) {
    return {
      valid: false,
      error: 'Invalid file format. Please upload a JPG, JPEG, PNG, or WebP picture.',
    };
  }

  // Size check
  if (file.size > maxBytes) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Picture is too large (${sizeInMB}MB). Maximum allowed size is 5MB for fast loading.`,
    };
  }

  return { valid: true };
}

/**
 * Check if the browser supports canvas export to image/webp
 */
let cachedWebPSupport: boolean | null = null;
export function isWebPSupported(): boolean {
  if (cachedWebPSupport !== null) return cachedWebPSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    cachedWebPSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    cachedWebPSupport = false;
  }
  return cachedWebPSupport;
}

/**
 * Load HTMLImageElement from a File or Object/Data URL
 */
export function loadImageElement(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image. Please select a valid picture.'));

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const url = URL.createObjectURL(source);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.src = url;
    }
  });
}

/**
 * High-definition, aspect-ratio preserving Crop and Compress
 * - Respects user pan, zoom, and rotation
 * - Prevents blurriness by rendering at high density (512px to 640px)
 * - Avoids unnatural upscaling of small source images
 * - Exports as high-efficiency WebP with JPEG fallback
 * - Target output size: 100KB–250KB for sub-second uploads
 */
export async function cropAndOptimizeImage(
  imageSource: HTMLImageElement | File | string,
  cropSettings?: CropSettings,
  targetMaxResolution = 640,
  quality = 0.88
): Promise<OptimizedImageResult> {
  const img = imageSource instanceof HTMLImageElement 
    ? imageSource 
    : await loadImageElement(imageSource);

  const containerSize = cropSettings?.containerSize || 240;
  const zoom = cropSettings?.zoom || 1;
  const panX = cropSettings?.panX || 0;
  const panY = cropSettings?.panY || 0;
  const rotation = (cropSettings?.rotation || 0) % 360;

  // Compute base scaling ratio: how the image fits within the container at zoom=1
  // We use object-fit: cover logic as base
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  // Base scale to cover the container square
  const baseScale = Math.max(containerSize / naturalWidth, containerSize / naturalHeight);
  const totalScale = baseScale * zoom;

  // The displayed dimensions in the preview viewport
  const displayedWidth = naturalWidth * totalScale;
  const displayedHeight = naturalHeight * totalScale;

  // Center coordinates in preview space
  const centerX = containerSize / 2 + panX;
  const centerY = containerSize / 2 + panY;

  // Determine output resolution:
  // If the source image cropped area is smaller than targetMaxResolution, do not upscale it
  // to avoid pixelation or artificial blurriness.
  const croppedSourceSize = containerSize / totalScale;
  const outputResolution = Math.min(
    Math.max(Math.round(croppedSourceSize), 320),
    targetMaxResolution
  );

  const canvas = document.createElement('canvas');
  canvas.width = outputResolution;
  canvas.height = outputResolution;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context could not be created.');
  }

  // Enable highest quality bicubic interpolation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Ratio from container space to final canvas space
  const scaleToCanvas = outputResolution / containerSize;

  ctx.save();
  // Move to center of canvas
  ctx.translate(outputResolution / 2, outputResolution / 2);

  // Apply rotation if any
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }

  // Translate by pan offset
  ctx.translate(panX * scaleToCanvas, panY * scaleToCanvas);

  // Draw image centered
  const drawWidth = displayedWidth * scaleToCanvas;
  const drawHeight = displayedHeight * scaleToCanvas;

  ctx.drawImage(
    img,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight
  );

  ctx.restore();

  // Export as WebP where supported, with JPEG fallback
  const preferWebP = isWebPSupported();
  const mimeType = preferWebP ? 'image/webp' : 'image/jpeg';
  const formatName = preferWebP ? 'webp' : 'jpeg';

  const dataUrl = canvas.toDataURL(mimeType, quality);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to generate image blob.'));
      },
      mimeType,
      quality
    );
  });

  const sizeKB = Math.round((blob.size / 1024) * 10) / 10;

  return {
    blob,
    dataUrl,
    format: formatName,
    width: outputResolution,
    height: outputResolution,
    sizeKB,
  };
}

/**
 * Legacy wrapper: center-crops and compresses
 */
export async function compressAndCropImage(
  file: File,
  targetSize = 640,
  quality = 0.88
): Promise<{ blob: Blob; dataUrl: string }> {
  const result = await cropAndOptimizeImage(file, undefined, targetSize, quality);
  return { blob: result.blob, dataUrl: result.dataUrl };
}

/**
 * Upload profile photo to Firebase Storage and update user profile in Firestore
 * - Optimizes caching via Cache-Control header (1 year max-age)
 * - Returns CDN/Storage URL
 * - Updates user profile in Firestore
 * - Reuses user ID without duplicate records
 */
export async function uploadUserProfilePhoto(params: {
  userId: string;
  blob: Blob;
  format?: 'webp' | 'jpeg';
  dataUrlFallback?: string;
  onProgress?: (progressPct: number) => void;
}): Promise<string> {
  const { userId, blob, format = 'webp', dataUrlFallback, onProgress } = params;

  if (!userId) {
    throw new Error('User ID is required to upload profile photo.');
  }

  const timestamp = Date.now();
  const extension = format === 'webp' ? 'webp' : 'jpg';
  const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';
  const filePath = `profile_photos/${userId}/avatar_${timestamp}.${extension}`;
  const storageRef = ref(storage, filePath);

  let finalUrl = '';

  try {
    // 1. Upload to Firebase Storage with Cache-Control headers
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: String(timestamp),
        format,
        sizeBytes: String(blob.size),
      },
    });

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress(Math.min(pct, 98));
          }
        },
        (error) => {
          console.warn('Firebase Storage upload warning:', error);
          reject(error);
        },
        async () => {
          try {
            finalUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve();
          } catch (urlErr) {
            reject(urlErr);
          }
        }
      );
    });
  } catch (storageError) {
    console.warn('Storage upload encountered an issue. Using optimized data URL fallback.', storageError);
    if (dataUrlFallback) {
      finalUrl = dataUrlFallback;
      if (onProgress) onProgress(100);
    } else {
      throw storageError;
    }
  }

  // 2. Persist new avatar URL to authenticated user's record in Firestore
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      avatar: finalUrl,
      lastActive: Date.now(),
    });
  } catch (firestoreError) {
    console.warn('Firestore user avatar update note:', firestoreError);
  }

  // 3. Update active session in localStorage
  try {
    const localUserRaw = localStorage.getItem('syncwave_current_user');
    if (localUserRaw) {
      const localUser = JSON.parse(localUserRaw);
      if (localUser.id === userId) {
        localUser.avatar = finalUrl;
        localStorage.setItem('syncwave_current_user', JSON.stringify(localUser));
      }
    }
  } catch (e) {
    // ignore localStorage errors
  }

  return finalUrl;
}

/**
 * Remove user profile photo and revert to clean default avatar
 */
export async function removeUserProfilePhoto(userId: string): Promise<string> {
  if (!userId) {
    throw new Error('User ID is required to remove profile photo.');
  }

  const defaultAvatar = DEFAULT_AVATAR;

  // 1. Update Firestore
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      avatar: defaultAvatar,
      lastActive: Date.now(),
    });
  } catch (firestoreError) {
    console.warn('Firestore remove avatar note:', firestoreError);
  }

  // 2. Update localStorage
  try {
    const localUserRaw = localStorage.getItem('syncwave_current_user');
    if (localUserRaw) {
      const localUser = JSON.parse(localUserRaw);
      if (localUser.id === userId) {
        localUser.avatar = defaultAvatar;
        localStorage.setItem('syncwave_current_user', JSON.stringify(localUser));
      }
    }
  } catch (e) {
    // ignore
  }

  return defaultAvatar;
}
