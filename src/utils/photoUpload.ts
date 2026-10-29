import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';

export const DEFAULT_AVATAR = '/src/assets/images/avatar_elie_1790670827487.jpg';

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate image file format and size
 * Supports: JPG, JPEG, PNG, WebP up to 10MB
 */
export function validateImageFile(file: File): ImageValidationResult {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  const maxBytes = 10 * 1024 * 1024; // 10MB

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
      error: 'Invalid file format. Please upload a JPG, JPEG, PNG, or WebP image.',
    };
  }

  // Size check
  if (file.size > maxBytes) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeInMB}MB). Maximum allowed size is 10MB.`,
    };
  }

  return { valid: true };
}

/**
 * Automatically center-crop and compress an image file to an optimized square avatar
 * Default size: 400x400 pixels at 0.85 quality (~35-65KB output)
 */
export async function compressAndCropImage(
  file: File,
  targetSize = 400,
  quality = 0.85
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return reject(new Error('Failed to create canvas context.'));
          }

          // Enable high quality image scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Calculate center-crop coordinates
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          // Draw cropped & scaled image
          ctx.drawImage(
            img,
            startX,
            startY,
            minDim,
            minDim,
            0,
            0,
            targetSize,
            targetSize
          );

          // Generate preview data URL
          const dataUrl = canvas.toDataURL('image/jpeg', quality);

          // Generate binary Blob for Firebase Storage
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ blob, dataUrl });
              } else {
                reject(new Error('Failed to create image blob.'));
              }
            },
            'image/jpeg',
            quality
          );
        } catch (err) {
          reject(err);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Upload profile photo to Firebase Storage and update user profile in Firestore
 * Includes real-time progress callbacks and fallback to compact data URL if Storage bucket is offline
 */
export async function uploadUserProfilePhoto(params: {
  userId: string;
  blob: Blob;
  dataUrlFallback?: string;
  onProgress?: (progressPct: number) => void;
}): Promise<string> {
  const { userId, blob, dataUrlFallback, onProgress } = params;

  if (!userId) {
    throw new Error('User ID is required to upload profile photo.');
  }

  const timestamp = Date.now();
  const filePath = `profile_photos/${userId}/avatar_${timestamp}.jpg`;
  const storageRef = ref(storage, filePath);

  let finalUrl = '';

  try {
    // 1. Upload to Firebase Storage
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: String(timestamp),
      },
    });

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress(pct);
          }
        },
        (error) => {
          console.warn('Firebase Storage upload warning, attempting fallback:', error);
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
    console.warn('Direct Firebase Storage upload encountered an issue. Using optimized canvas fallback.', storageError);
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
