import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export interface ChatMediaUploadResult {
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'file' | 'audio';
  fileName: string;
  fileSize: number;
}

/**
 * Formats byte size into human readable string (e.g. "1.2 MB", "450 KB")
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Determine the chat media category from MIME type or file extension
 */
export function detectMediaType(file: File): 'image' | 'video' | 'file' | 'audio' {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif|svg)$/i.test(name)) {
    return 'image';
  }
  if (type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(name)) {
    return 'video';
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(name)) {
    return 'audio';
  }
  return 'file';
}

/**
 * Upload a media file or document attachment to Firebase Storage
 */
export async function uploadChatMedia(params: {
  file: File;
  conversationId: string;
  userId: string;
  onProgress?: (progressPct: number) => void;
}): Promise<ChatMediaUploadResult> {
  const { file, conversationId, userId, onProgress } = params;

  const mediaType = detectMediaType(file);
  const maxBytes = 50 * 1024 * 1024; // 50MB max limit

  if (file.size > maxBytes) {
    throw new Error(`File is too large (${formatBytes(file.size)}). Maximum upload size is 50MB.`);
  }

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `chat_media/${conversationId}/${timestamp}_${sanitizedName}`;
  const storageRef = ref(storage, filePath);

  let downloadUrl = '';

  try {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: String(timestamp),
        originalName: file.name,
        mediaType,
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
          console.warn('Firebase Storage upload error:', error);
          reject(error);
        },
        async () => {
          try {
            downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve();
          } catch (urlErr) {
            reject(urlErr);
          }
        }
      );
    });
  } catch (storageError) {
    console.warn('Storage upload fallback triggered:', storageError);
    // Client-side DataURL fallback for smaller images and audio
    if (file.size < 4 * 1024 * 1024) {
      downloadUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (onProgress) onProgress(100);
    } else {
      throw storageError;
    }
  }

  return {
    mediaUrl: downloadUrl,
    mediaType,
    fileName: file.name,
    fileSize: file.size,
  };
}
