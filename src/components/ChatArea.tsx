import React, { useState, useRef, useEffect } from 'react';
import { 
  Phone, 
  Video, 
  Send, 
  Paperclip, 
  Smile, 
  Mic, 
  MicOff, 
  Square, 
  Play, 
  Pause, 
  Reply, 
  X, 
  Image as ImageIcon,
  Film,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  Zap,
  RefreshCw,
  Users,
  Radio,
  Sparkles,
  Trash2,
  ArrowLeft,
  Check,
  CheckCheck,
  Settings,
  Lock,
  UserPlus,
  Clock,
  Camera,
  Maximize2
} from 'lucide-react';
import { Message, User, Room, GroupInvitation } from '../types';
import { formatLastSeen } from '../utils/userSync';
import { DEFAULT_AVATAR } from '../utils/photoUpload';
import { uploadChatMediaWithHandle, uploadChatMedia, formatBytes, detectMediaType } from '../utils/mediaUpload';
import { getConversationId } from '../utils/messageSync';

export interface QueuedMediaItem {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video' | 'file' | 'audio';
  fileName: string;
  fileSize: number;
  originalSize?: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  speedFormatted?: string;
  timeRemainingFormatted?: string;
  uploadedUrl?: string;
  speedMs?: number;
  dataUrl?: string;
  errorMessage?: string;
  cancelHandle?: () => void;
  filePromise?: Promise<string>;
}

interface ChatAreaProps {
  currentUser: User;
  currentRoom: Room | null;
  directUser: User | null;
  messages: Message[];
  typingUsers: { userId: string; userName: string }[];
  onSendMessage: (payload: {
    id?: string;
    text: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'file' | 'audio';
    fileName?: string;
    fileSize?: number;
    voiceAudio?: string;
    voiceDuration?: number;
    replyTo?: { id: string; senderName: string; text: string };
    status?: 'sending' | 'sent';
  }) => string | Promise<string> | void;
  onUpdateMessage?: (messageId: string, updates: Partial<Message>) => void;
  onSendReaction: (messageId: string, emoji: string) => void;
  onSendTyping: (isTyping: boolean) => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onJoinRoomCall?: () => void;
  onDeleteRoom?: (roomId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onBackToSidebar?: () => void;
  onOpenGroupManagement?: (room: Room, initialTab?: 'details' | 'invite' | 'requests' | 'invitations') => void;
  onRequestJoinGroup?: (room: Room) => void;
  hasPendingJoinRequest?: boolean;
  pendingInvitation?: GroupInvitation;
  onRespondInvitation?: (inv: GroupInvitation, accept: boolean) => void;
  hasMoreMessages?: boolean;
  onLoadEarlierMessages?: () => void;
  isLoadingEarlier?: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '🚀', '👀'];

function getBestAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  currentUser,
  currentRoom,
  directUser,
  messages,
  typingUsers,
  onSendMessage,
  onUpdateMessage,
  onSendReaction,
  onSendTyping,
  onStartCall,
  onJoinRoomCall,
  onDeleteRoom,
  onDeleteMessage,
  onBackToSidebar,
  onOpenGroupManagement,
  onRequestJoinGroup,
  hasPendingJoinRequest = false,
  pendingInvitation,
  onRespondInvitation,
  hasMoreMessages = false,
  onLoadEarlierMessages,
  isLoadingEarlier = false,
}) => {
  const isRoom = Boolean(currentRoom);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [attachedQueue, setAttachedQueue] = useState<QueuedMediaItem[]>([]);
  const [isPendingAutoSend, setIsPendingAutoSend] = useState(false);
  const [activeMediaModal, setActiveMediaModal] = useState<{
    url: string;
    type: 'video' | 'image';
    fileName?: string;
    fileSize?: number;
  } | null>(null);

  // Close media modal on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeMediaModal) {
        setActiveMediaModal(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activeMediaModal]);

  const pendingSendRef = useRef<{
    text: string;
    replyTo?: { id: string; senderName: string; text: string };
  } | null>(null);

  // Hidden File Inputs
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Voice Recording state with real-time audio spectrum visualizer
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([0.2, 0.4, 0.6, 0.3, 0.5, 0.7, 0.4, 0.8, 0.5, 0.3, 0.6, 0.4, 0.7, 0.5, 0.3, 0.2]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const chosenMimeTypeRef = useRef<string>('');

  // Audio Playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUsers.length]);

  // Handle typing debounce with 3-second throttle to conserve write quota
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 3000) {
      lastTypingSentRef.current = now;
      onSendTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onSendTyping(false);
      lastTypingSentRef.current = 0;
    }, 2500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Multi-file upload queue worker with MAX_CONCURRENT = 2
  useEffect(() => {
    const MAX_CONCURRENT = 2;
    const currentlyUploading = attachedQueue.filter((item) => item.status === 'uploading').length;
    if (currentlyUploading >= MAX_CONCURRENT) return;

    const nextPending = attachedQueue.find((item) => item.status === 'pending');
    if (!nextPending) return;

    const convId = isRoom ? `room__${currentRoom?.id}` : getConversationId(currentUser.id, directUser?.id || '', false);

    const handle = uploadChatMediaWithHandle({
      file: nextPending.file,
      conversationId: convId,
      userId: currentUser.id,
      onProgress: (ev) => {
        setAttachedQueue((prev) =>
          prev.map((item) =>
            item.id === nextPending.id
              ? {
                  ...item,
                  progress: ev.pct,
                  speedFormatted: ev.speedFormatted,
                  timeRemainingFormatted: ev.timeRemainingFormatted,
                }
              : item
          )
        );
      },
    });

    const filePromise = handle.promise.then((res) => res.mediaUrl);

    setAttachedQueue((prev) =>
      prev.map((item) =>
        item.id === nextPending.id
          ? {
              ...item,
              status: 'uploading',
              cancelHandle: handle.cancel,
              filePromise,
            }
          : item
      )
    );

    handle.promise
      .then((res) => {
        setAttachedQueue((prev) =>
          prev.map((item) =>
            item.id === nextPending.id
              ? {
                  ...item,
                  status: 'completed',
                  progress: 100,
                  uploadedUrl: res.mediaUrl,
                  fileSize: res.fileSize,
                  originalSize: res.originalSize,
                  speedMs: res.speedMs,
                }
              : item
          )
        );
      })
      .catch((err: any) => {
        if (err.message?.includes('cancelled')) {
          setAttachedQueue((prev) => prev.filter((item) => item.id !== nextPending.id));
        } else {
          setAttachedQueue((prev) =>
            prev.map((item) =>
              item.id === nextPending.id
                ? {
                    ...item,
                    status: 'error',
                    errorMessage: err.message || 'Upload failed. Tap retry.',
                  }
                : item
            )
          );
        }
      });
  }, [attachedQueue, isRoom, currentRoom?.id, currentUser.id, directUser?.id]);

  // Auto-send when queued items finish uploading
  useEffect(() => {
    if (!isPendingAutoSend || attachedQueue.length === 0) return;

    const hasIncomplete = attachedQueue.some((item) => item.status === 'pending' || item.status === 'uploading');
    if (hasIncomplete) return;

    const completedItems = attachedQueue.filter((item) => item.status === 'completed' && item.uploadedUrl);
    if (completedItems.length > 0 && pendingSendRef.current) {
      const pending = pendingSendRef.current;
      pendingSendRef.current = null;
      setIsPendingAutoSend(false);

      completedItems.forEach((item, index) => {
        onSendMessage({
          text: index === 0 ? pending.text : '',
          mediaUrl: item.uploadedUrl,
          mediaType: item.type,
          fileName: item.fileName,
          fileSize: item.fileSize,
          replyTo: index === 0 ? pending.replyTo : undefined,
        });
      });

      setAttachedQueue([]);
    } else {
      setIsPendingAutoSend(false);
    }
  }, [attachedQueue, isPendingAutoSend, onSendMessage]);

  // Helpers to add files to staging queue with permanent dataUrl preparation
  const addFilesToQueue = (files: File[]) => {
    if (!files || files.length === 0) return;
    const newItems: QueuedMediaItem[] = files.map((file) => {
      const detectedType = detectMediaType(file);
      const instantLocalUrl = URL.createObjectURL(file);
      const itemId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Read small files (< 1.5MB) to permanent DataURL in background (< 30ms)
      if (file.size < 1.5 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setAttachedQueue((prev) =>
              prev.map((it) => (it.id === itemId ? { ...it, dataUrl: reader.result as string } : it))
            );
          }
        };
        reader.readAsDataURL(file);
      }

      return {
        id: itemId,
        file,
        previewUrl: instantLocalUrl,
        type: detectedType,
        fileName: file.name,
        fileSize: file.size,
        status: 'pending',
        progress: 0,
      };
    });
    setAttachedQueue((prev) => [...prev, ...newItems]);
  };

  // Clipboard paste support (e.g. screenshots & copied photos)
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addFilesToQueue(imageFiles);
    }
  };

  // Drag and Drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer?.files?.length) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  // Instant Send: Dispatches messages optimistically in microseconds (< 0.1ms)
  const handleSend = () => {
    const hasText = Boolean(inputText.trim());
    const hasAttachments = attachedQueue.length > 0;
    if (!hasText && !hasAttachments) return;

    const currentText = inputText.trim();
    const replyContext = replyingTo
      ? {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          text: replyingTo.text,
        }
      : undefined;

    // Reset input composer immediately
    setInputText('');
    setReplyingTo(null);
    setShowEmojiPicker(null);
    setIsPendingAutoSend(false);
    pendingSendRef.current = null;
    onSendTyping(false);

    if (hasAttachments) {
      const allCompleted = attachedQueue.every((item) => item.status === 'completed' && Boolean(item.uploadedUrl));

      if (!allCompleted) {
        // Queue message to automatically dispatch the instant all attachments finish uploading
        pendingSendRef.current = {
          text: currentText,
          replyTo: replyContext,
        };
        setIsPendingAutoSend(true);
        return;
      }

      // If all attachments are already completed, dispatch immediately with permanent Storage URLs!
      const itemsToDispatch = [...attachedQueue];
      setAttachedQueue([]);
      setIsPendingAutoSend(false);
      pendingSendRef.current = null;

      itemsToDispatch.forEach((item, index) => {
        const optimisticMsgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        onSendMessage({
          id: optimisticMsgId,
          text: index === 0 ? currentText : '',
          mediaUrl: item.uploadedUrl,
          mediaType: item.type,
          fileName: item.fileName,
          fileSize: item.fileSize,
          replyTo: index === 0 ? replyContext : undefined,
          status: 'sent',
        });
      });
    } else if (hasText) {
      onSendMessage({
        text: currentText,
        replyTo: replyContext,
        status: 'sent',
      });
    }
  };

  // Multi-File selection handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    addFilesToQueue(Array.from(fileList));
    e.target.value = '';
  };

  const handleCancelAttachment = (id: string) => {
    const item = attachedQueue.find((q) => q.id === id);
    if (item && item.cancelHandle) {
      try {
        item.cancelHandle();
      } catch (e) {
        // Ignored
      }
    }
    setAttachedQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const handleRetryAttachment = (id: string) => {
    setAttachedQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              status: 'pending',
              errorMessage: undefined,
              progress: 0,
            }
          : q
      )
    );
  };

  // Microphone Voice Note Recording with Real-Time Audio Visualizer & Instant Optimistic Send
  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Microphone recording is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = getBestAudioMimeType();
      chosenMimeTypeRef.current = mimeType;
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Set up AudioContext AnalyserNode for real-time live visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const updateVisualizer = () => {
            if (!analyserRef.current) return;
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);

            const samples: number[] = [];
            const step = Math.max(1, Math.floor(dataArray.length / 16));
            for (let i = 0; i < 16; i++) {
              const val = dataArray[i * step] || 0;
              samples.push(Math.max(0.15, val / 255));
            }
            setAudioLevels(samples);
            animFrameRef.current = requestAnimationFrame(updateVisualizer);
          };
          animFrameRef.current = requestAnimationFrame(updateVisualizer);
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext visualizer note:', audioCtxErr);
      }

      mediaRecorder.onstop = async () => {
        // Clean up visualizer & stream
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        analyserRef.current = null;
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) return;

        const actualMime = chosenMimeTypeRef.current || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        
        // Exact duration in seconds
        const elapsedMs = performance.now() - recordingStartTimeRef.current;
        const durationSec = Math.max(1, Math.round(elapsedMs / 1000));

        const optimisticMsgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const convId = isRoom ? `room__${currentRoom?.id}` : getConversationId(currentUser.id, directUser?.id || '', false);

        // Read audioBlob directly to permanent DataURL in ~5ms
        const reader = new FileReader();
        reader.onloadend = async () => {
          const permanentAudioUrl = (reader.result as string) || URL.createObjectURL(audioBlob);

          // 1. Dispatch immediately to chat feed & Firestore so both sender & receiver hear it permanently!
          onSendMessage({
            id: optimisticMsgId,
            text: '🎤 Voice note',
            mediaUrl: permanentAudioUrl,
            mediaType: 'audio',
            voiceAudio: permanentAudioUrl,
            voiceDuration: durationSec,
            status: 'sent',
          });

          // 2. High-speed background cloud upload to Firebase Storage for CDN URL
          const extension = actualMime.includes('mp4') ? 'mp4' : actualMime.includes('ogg') ? 'ogg' : 'webm';
          const audioFile = new File([audioBlob], `voicenote_${Date.now()}.${extension}`, { type: actualMime });

          try {
            const res = await uploadChatMedia({
              file: audioFile,
              conversationId: convId,
              userId: currentUser.id,
            });

            if (res.mediaUrl && onUpdateMessage) {
              onUpdateMessage(optimisticMsgId, {
                mediaUrl: res.mediaUrl,
                voiceAudio: res.mediaUrl,
                status: 'sent',
              });
            }
          } catch (uploadErr) {
            console.warn('Voice note CDN upload fallback (already permanent via DataURL):', uploadErr);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      // Start recording with 200ms timeslices for smooth audio collection
      mediaRecorder.start(200);
      recordingStartTimeRef.current = performance.now();
      setIsRecordingVoice(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        const sec = Math.round((performance.now() - recordingStartTimeRef.current) / 1000);
        setRecordingDuration(sec);
      }, 500);
    } catch (err) {
      console.warn('Microphone error:', err);
      alert('Could not access microphone for voice message. Please ensure microphone permissions are granted.');
    }
  };

  const stopVoiceRecording = (send: boolean) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (send) {
        mediaRecorderRef.current.stop();
      } else {
        audioChunksRef.current = [];
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
      }
    }
    setIsRecordingVoice(false);
  };

  // Audio Playback
  const togglePlayAudio = (messageId: string, audioUrl: string) => {
    if (playingAudioId === messageId) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingAudioId(null);
      audio.play();
      setPlayingAudioId(messageId);
    }
  };

  const isRoomMember = !isRoom || !currentRoom?.isPrivate || (
    currentRoom.createdById === currentUser.id ||
    (Array.isArray(currentRoom.memberIds) && currentRoom.memberIds.includes(currentUser.id)) ||
    (Array.isArray(currentRoom.adminIds) && currentRoom.adminIds.includes(currentUser.id))
  );
  const isInvited = Boolean(pendingInvitation);
  const canAccessHistory = isRoomMember || isInvited;
  const targetTitle = isRoom ? currentRoom?.name : directUser?.name;

  return (
    <div 
      className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Instant Upload Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-blue-950/85 backdrop-blur-sm border-2 border-dashed border-blue-400 flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <div className="p-5 rounded-2xl bg-blue-900/70 border border-blue-500/50 text-blue-200 flex flex-col items-center gap-2 shadow-2xl">
            <ImageIcon className="w-10 h-10 text-blue-400 animate-bounce" />
            <p className="text-base font-bold text-white">Drop photos or files here</p>
            <p className="text-xs text-blue-300">Instant microsecond upload & preview</p>
          </div>
        </div>
      )}


      {/* Chat Header */}
      <div className="h-14 border-b border-slate-800 px-3 md:px-4 flex items-center justify-between bg-slate-900/60 shrink-0 z-10">
        <div className="flex items-center gap-2 md:gap-3 truncate flex-1 min-w-0 mr-2">
          {/* Mobile Back Button to return to sidebar */}
          {onBackToSidebar && (
            <button
              onClick={onBackToSidebar}
              className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {isRoom ? (
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-500/30">
              {currentRoom?.icon ? (
                <span>{currentRoom.icon}</span>
              ) : currentRoom?.isCustomGroup ? (
                <Users className="w-4 h-4 text-purple-400" />
              ) : currentRoom?.type === 'voice-video' ? (
                <Video className="w-4 h-4 text-emerald-400" />
              ) : (
                '#'
              )}
            </div>
          ) : (
            <div className="relative shrink-0">
              {directUser?.avatar ? (
                <img
                  src={directUser.avatar}
                  alt={directUser.name}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs">
                  {directUser?.name[0] || 'U'}
                </div>
              )}
              {directUser && (
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                    directUser.status === 'online'
                      ? 'bg-emerald-500'
                      : directUser.status === 'in-call'
                      ? 'bg-purple-500'
                      : directUser.status === 'away'
                      ? 'bg-amber-500'
                      : 'bg-slate-600'
                  }`}
                />
              )}
            </div>
          )}

          <div className="truncate flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5 truncate">
              <h2 className="text-sm font-semibold text-white tracking-tight truncate">
                {targetTitle || 'Elie Chat'}
              </h2>
              {isRoom && currentRoom?.isPrivate && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-0.5 shrink-0">
                  <Lock className="w-2.5 h-2.5" /> Private
                </span>
              )}
              {isRoom && currentRoom?.isCustomGroup && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 shrink-0">
                  Group
                </span>
              )}
              {!isRoom && directUser?.location && (
                <span className="text-xs text-slate-400 shrink-0">
                  {directUser.location.flag} {directUser.location.city}
                </span>
              )}
            </div>

            {/* Subtitle presence & description */}
            <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
              {isRoom ? (
                <>
                  <span className="truncate">{currentRoom?.description || 'Active Channel'}</span>
                  {currentRoom?.type === 'voice-video' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-400 font-medium">Live Stage</span>
                    </>
                  )}
                </>
              ) : directUser ? (
                <div className="flex items-center gap-1 truncate">
                  {directUser.status === 'online' ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Online
                    </span>
                  ) : directUser.status === 'in-call' ? (
                    <span className="text-purple-400 font-medium">In Call</span>
                  ) : directUser.status === 'away' ? (
                    <span className="text-amber-400">Away</span>
                  ) : (
                    <span className="text-slate-500">
                      {formatLastSeen(directUser.lastSeen)}
                    </span>
                  )}
                  {directUser.customStatus && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="truncate text-slate-400">{directUser.customStatus}</span>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Action Buttons: Voice / Video Call & Invite / Details */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {/* Invite Member action: visible and accessible to EVERY active member */}
          {isRoom && currentRoom && isRoomMember && onOpenGroupManagement && (
            <button
              onClick={() => onOpenGroupManagement(currentRoom, 'invite')}
              title="Invite registered users to this group"
              className="p-1.5 px-2.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Invite</span>
            </button>
          )}

          {isRoom && currentRoom && onOpenGroupManagement && (
            <button
              onClick={() => onOpenGroupManagement(currentRoom, 'details')}
              title="Group settings & members"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors flex items-center gap-1 text-xs"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Details</span>
            </button>
          )}

          {isRoom && currentRoom && currentRoom.createdById === currentUser.id && onDeleteRoom && (
            <button
              onClick={() => {
                if (window.confirm(`Delete "${currentRoom.name}"?`)) {
                  onDeleteRoom(currentRoom.id);
                }
              }}
              title="Delete room"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700/60 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Voice and Video Call actions are restricted to authorized active members */}
          {isRoomMember && (
            currentRoom?.activeCall ? (
              <button
                onClick={onJoinRoomCall}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors whitespace-nowrap animate-pulse"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Join Live Stage</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => onStartCall('audio')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                  title="Start Voice Call"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Voice Call</span>
                </button>

                <button
                  onClick={() => onStartCall('video')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                  title="Start Video Call"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Video Call</span>
                </button>
              </>
            )
          )}
        </div>
      </div>

      {/* Top Banner when viewing as an invited user */}
      {isRoom && !isRoomMember && isInvited && pendingInvitation && onRespondInvitation && (
        <div className="bg-purple-950/80 border-b border-purple-500/40 p-2.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs z-10 shrink-0">
          <div className="flex items-center gap-2.5 text-purple-200 min-w-0">
            <span className="text-lg shrink-0">📨</span>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">
                Invited to "{currentRoom?.name}" by {pendingInvitation.inviterName}
              </p>
              <p className="text-[11px] text-purple-300">
                You can review all previous messages below. Accept the invitation to join and chat.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onRespondInvitation(pendingInvitation, false)}
              className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg font-medium transition-colors"
            >
              Decline
            </button>
            <button
              onClick={() => onRespondInvitation(pendingInvitation, true)}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve & Join</span>
            </button>
          </div>
        </div>
      )}

      {/* Message Feed / Private Lock Screen */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3.5">
        {isRoom && !canAccessHistory ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-xl">
              <Lock className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-950/60 border border-purple-500/40 text-[11px] text-purple-300 font-semibold mb-1">
                <Lock className="w-3 h-3" /> Private Group
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">{currentRoom?.name}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {currentRoom?.description || 'This is a private group.'}
              </p>
              <p className="text-[11px] text-slate-500">
                Messages, voice recordings, attachments, and call stages are restricted exclusively to approved active members.
              </p>
            </div>

            {hasPendingJoinRequest ? (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs font-medium">
                <Clock className="w-4 h-4 animate-pulse text-amber-400 shrink-0" />
                <span>Your join request is pending review by an authorized administrator.</span>
              </div>
            ) : onRequestJoinGroup && currentRoom ? (
              <button
                onClick={() => onRequestJoinGroup(currentRoom)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Request to Join Group</span>
              </button>
            ) : null}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs py-10 space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-2">
              <Users className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-300 text-sm">No messages yet</p>
            <p className="max-w-xs text-slate-400">
              Send a real-time message, attach an image, record a voice note, or start a voice/video call!
            </p>
          </div>
        ) : (
          <>
            {hasMoreMessages && onLoadEarlierMessages && (
              <div className="flex justify-center pb-2 pt-1">
                <button
                  type="button"
                  onClick={onLoadEarlierMessages}
                  disabled={isLoadingEarlier}
                  className="px-3.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full text-[11px] font-medium border border-slate-700/60 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isLoadingEarlier ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                      <span>Loading earlier messages...</span>
                    </>
                  ) : (
                    <>
                      <span>↑ Load earlier messages</span>
                    </>
                  )}
                </button>
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              const timeString = new Date(msg.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className="shrink-0 self-end">
                  {msg.senderAvatar ? (
                    <img
                      src={msg.senderAvatar}
                      alt={msg.senderName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold border border-slate-700">
                      {msg.senderName[0] || 'U'}
                    </div>
                  )}
                </div>

                {/* Content Bubble */}
                <div className={`max-w-[85%] sm:max-w-[75%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender Metadata */}
                  <div className={`flex items-center gap-1.5 text-[10px] md:text-[11px] text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className="font-medium text-slate-300">{msg.senderName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{timeString}</span>
                  </div>

                  {/* Reply Quote Preview */}
                  {msg.replyTo && (
                    <div className="text-[11px] px-2.5 py-1 rounded bg-slate-800/80 border-l-2 border-blue-500 text-slate-400 truncate">
                      <span className="font-medium text-slate-300">{msg.replyTo.senderName}:</span>{' '}
                      {msg.replyTo.text}
                    </div>
                  )}

                  {/* Message Body */}
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed break-words relative group ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-slate-800/95 text-slate-100 rounded-bl-none border border-slate-700/60'
                    }`}
                  >
                    {/* Attached Media: Image, Video, or File */}
                    {msg.mediaUrl && (
                      <div className="mb-2 overflow-hidden rounded-xl">
                        {msg.mediaType === 'video' ? (
                          <div className="rounded-xl overflow-hidden bg-black shadow-lg border border-slate-700/60 group/vid">
                            <div className="relative bg-black flex items-center justify-center">
                              <video
                                src={msg.mediaUrl}
                                controls
                                playsInline
                                preload="metadata"
                                className="max-h-80 w-full rounded-t-xl object-contain bg-black"
                              />
                            </div>
                            <div className="px-3 py-2 bg-slate-900/95 text-[11px] text-slate-300 flex items-center justify-between border-t border-slate-800 gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="truncate font-medium text-slate-200">{msg.fileName || 'Video'}</span>
                                {msg.fileSize && (
                                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                    · {formatBytes(msg.fileSize)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveMediaModal({
                                      url: msg.mediaUrl!,
                                      type: 'video',
                                      fileName: msg.fileName,
                                      fileSize: msg.fileSize,
                                    })
                                  }
                                  title="Expand / Fullscreen player"
                                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                                <a
                                  href={msg.mediaUrl}
                                  download={msg.fileName || `video_${msg.id}.mp4`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Download video"
                                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        ) : msg.mediaType === 'file' ? (
                          <a
                            href={msg.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={msg.fileName || 'attachment'}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                              isMe
                                ? 'bg-blue-700/80 border-blue-400/40 text-white hover:bg-blue-700'
                                : 'bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-850'
                            }`}
                          >
                            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300 shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="font-semibold text-xs truncate">{msg.fileName || 'Document Attachment'}</p>
                              <p className="text-[10px] opacity-75">
                                {msg.fileSize ? formatBytes(msg.fileSize) : 'Download Attachment'}
                              </p>
                            </div>
                            <div className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 shrink-0">
                              <Download className="w-4 h-4" />
                            </div>
                          </a>
                        ) : (
                          /* Image with Instant Local Rendering & Background Syncing Indicator */
                          <div className="overflow-hidden rounded-xl relative group">
                            <img
                              src={msg.mediaUrl}
                              alt={msg.fileName || 'Attachment'}
                              loading="lazy"
                              className="max-h-72 rounded-xl object-cover w-full hover:opacity-95 transition-opacity cursor-pointer shadow-md"
                              onClick={() =>
                                setActiveMediaModal({
                                  url: msg.mediaUrl!,
                                  type: 'image',
                                  fileName: msg.fileName,
                                  fileSize: msg.fileSize,
                                })
                              }
                            />
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveMediaModal({
                                    url: msg.mediaUrl!,
                                    type: 'image',
                                    fileName: msg.fileName,
                                    fileSize: msg.fileSize,
                                  })
                                }
                                className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white shadow-md backdrop-blur-sm transition-colors"
                                title="Expand image"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={msg.mediaUrl}
                                download={msg.fileName || `photo_${msg.id}.jpg`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white shadow-md backdrop-blur-sm transition-colors"
                                title="Download image"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            {msg.status === 'sending' && (
                              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center">
                                <div className="bg-slate-900/90 border border-slate-700/80 rounded-full px-2.5 py-1 text-[11px] font-medium text-blue-300 flex items-center gap-1.5 shadow-lg">
                                  <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                                  <span>Syncing...</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Voice Message Player */}
                    {msg.voiceAudio ? (
                      <div className="flex items-center gap-3 py-1 min-w-[180px] sm:min-w-[210px]">
                        <button
                          onClick={() => togglePlayAudio(msg.id, msg.voiceAudio!)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-sm ${
                            isMe ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                          }`}
                        >
                          {playingAudioId === msg.id ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5 fill-current" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 h-5">
                            {[12, 24, 18, 28, 14, 22, 10, 26, 16, 20].map((h, i) => (
                              <span
                                key={i}
                                style={{ height: `${h}px` }}
                                className={`w-1 rounded-full transition-all duration-150 ${
                                  playingAudioId === msg.id
                                    ? isMe ? 'bg-white animate-pulse' : 'bg-blue-400 animate-pulse'
                                    : isMe ? 'bg-white/60' : 'bg-slate-500'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[10px] tabular-nums opacity-85 mt-0.5">
                            <span>{msg.voiceDuration ? `0:${msg.voiceDuration.toString().padStart(2, '0')}` : 'Voice Note'}</span>
                            {msg.status === 'sending' && (
                              <span className="text-blue-200 animate-pulse text-[9px] font-medium">Syncing...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {/* Accurate Delivery & Read Receipts for own messages */}
                    {isMe && (
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px]">
                        {msg.status === 'read' ? (
                          <span 
                            className="flex items-center gap-0.5 text-sky-300 font-semibold" 
                            title={msg.readAt ? `Read ${new Date(msg.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Read'}
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                          </span>
                        ) : msg.status === 'delivered' ? (
                          <span 
                            className="flex items-center gap-0.5 text-slate-300" 
                            title="Delivered"
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-slate-300" />
                          </span>
                        ) : msg.status === 'sending' ? (
                          <span 
                            className="flex items-center gap-1 text-blue-200 font-medium" 
                            title="Instant Local Preview · Syncing to Cloud"
                          >
                            <Loader2 className="w-3 h-3 animate-spin text-blue-300" />
                            <span>Instant</span>
                          </span>
                        ) : (
                          <span 
                            className="flex items-center gap-0.5 text-slate-400" 
                            title="Sent"
                          >
                            <Check className="w-3.5 h-3.5 text-slate-400" />
                          </span>
                        )}
                      </div>
                    )}

                    {/* Floating Quick Action Overlay */}
                    <div
                      className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900/95 border border-slate-700 rounded-lg p-1 shadow-md z-10 ${
                        isMe ? '-left-18' : '-right-18'
                      }`}
                    >
                      <button
                        onClick={() => setReplyingTo(msg)}
                        title="Reply"
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                      >
                        <Reply className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                        title="React"
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                      >
                        <Smile className="w-3 h-3" />
                      </button>
                      {isMe && onDeleteMessage && (
                        <button
                          onClick={() => onDeleteMessage(msg.id)}
                          title="Delete message"
                          className="p-1 hover:bg-red-950/60 rounded text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Emoji Reaction Popover */}
                    {showEmojiPicker === msg.id && (
                      <div className="absolute z-20 bottom-full left-0 mb-1 bg-slate-900 border border-slate-700 rounded-xl p-1.5 shadow-xl flex items-center gap-1">
                        {COMMON_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              onSendReaction(msg.id, emoji);
                              setShowEmojiPicker(null);
                            }}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-sm hover:scale-125 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reaction Badges */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                        const hasReacted = userIds.includes(currentUser.id);
                        return (
                          <button
                            key={emoji}
                            onClick={() => onSendReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                              hasReacted
                                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
                                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 border border-slate-700/50'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="tabular-nums">{userIds.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1.5 text-xs text-slate-400 flex items-center gap-1.5 italic bg-slate-900/40 border-t border-slate-800/40">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
          <span>
            {typingUsers.map((u) => u.userName).join(', ')}{' '}
            {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}

      {/* Replying Banner */}
      {replyingTo && (
        <div className="px-4 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="truncate mr-2">
            <span className="text-slate-500 font-medium">Replying to </span>
            <span className="text-blue-400 font-semibold">{replyingTo.senderName}: </span>
            <span className="truncate">{replyingTo.text}</span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Only authorized active members can type, attach, or record messages */}
      {isRoomMember && (
        <>
          {/* Auto-send Queue Banner */}
          {isPendingAutoSend && (
            <div className="px-4 py-1.5 bg-blue-950/70 border-t border-blue-900/60 flex items-center justify-between text-xs text-blue-300 animate-pulse">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>⚡ Message queued — will dispatch as soon as upload finishes (&lt; 3s)...</span>
              </div>
              <button
                onClick={() => {
                  setIsPendingAutoSend(false);
                  pendingSendRef.current = null;
                }}
                className="p-0.5 hover:bg-blue-900/50 rounded text-blue-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Attached Media Staging Queue Tray */}
          {attachedQueue.length > 0 && (
            <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Attachments ({attachedQueue.filter((i) => i.status === 'completed').length}/{attachedQueue.length} ready)</span>
                </span>
                {attachedQueue.length > 1 && (
                  <button
                    onClick={() => {
                      attachedQueue.forEach((i) => i.cancelHandle?.());
                      setAttachedQueue([]);
                      setIsPendingAutoSend(false);
                      pendingSendRef.current = null;
                    }}
                    className="text-slate-400 hover:text-red-400 text-[10px] transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {attachedQueue.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {item.type === 'image' && (
                      <img
                        src={item.previewUrl}
                        alt="Preview"
                        className="w-11 h-11 object-cover rounded-lg border border-slate-800 shrink-0"
                      />
                    )}
                    {item.type === 'video' && (
                      <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-black border border-indigo-700/80 shrink-0 flex items-center justify-center">
                        <video
                          src={item.previewUrl}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                          <Play className="w-3.5 h-3.5 text-white fill-white/80" />
                        </div>
                      </div>
                    )}
                    {item.type === 'file' && (
                      <div className="w-11 h-11 rounded-lg bg-amber-950/60 border border-amber-800 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-amber-400" />
                      </div>
                    )}
                    {item.type === 'audio' && (
                      <div className="w-11 h-11 rounded-lg bg-emerald-950/60 border border-emerald-800 flex items-center justify-center shrink-0">
                        <Mic className="w-5 h-5 text-emerald-400" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {item.type}
                        </span>
                        <p className="text-xs font-medium text-slate-200 truncate max-w-[180px] md:max-w-xs">
                          {item.fileName}
                        </p>
                        {item.speedMs && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                            <Zap className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            {(item.speedMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>

                      {/* Progress and status details */}
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        {item.status === 'completed' ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-400 inline" />
                            Ready · {formatBytes(item.fileSize)}
                            {item.originalSize && item.originalSize > item.fileSize && (
                              <span className="text-slate-500 font-normal">
                                ({Math.round((1 - item.fileSize / item.originalSize) * 100)}% compressed)
                              </span>
                            )}
                          </span>
                        ) : item.status === 'uploading' ? (
                          <div className="flex items-center gap-2 text-blue-400 font-medium w-full">
                            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                            <span>{item.progress}%</span>
                            {item.speedFormatted && <span>· {item.speedFormatted}</span>}
                            {item.timeRemainingFormatted && <span className="text-slate-400">· {item.timeRemainingFormatted}</span>}
                          </div>
                        ) : item.status === 'pending' ? (
                          <span className="text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 inline" />
                            Queued ({formatBytes(item.fileSize)})
                          </span>
                        ) : (
                          <span className="text-red-400 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 inline" />
                            {item.errorMessage || 'Failed'}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar for uploading item */}
                      {item.status === 'uploading' && (
                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-150 ease-out"
                            style={{ width: `${Math.max(5, item.progress)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions: Retry or Cancel */}
                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === 'error' && (
                      <button
                        onClick={() => handleRetryAttachment(item.id)}
                        title="Retry upload"
                        className="px-2 py-1 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleCancelAttachment(item.id)}
                      title="Cancel / remove"
                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-red-300 rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Real-Time Microphone Voice Recording Bar with Live Frequency Visualizer */}
          {isRecordingVoice ? (
            <div className="p-3 bg-red-950/50 border-t border-red-900/60 flex items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="tabular-nums">0:{recordingDuration.toString().padStart(2, '0')}</span>
                  <span className="text-[11px] text-red-300/80 font-normal hidden sm:inline">· Live Mic</span>
                </div>

                {/* Live Real-Time Audio Spectrum Waveform Visualizer */}
                <div className="flex items-center gap-1 h-7 px-2.5 py-1 bg-red-950/80 rounded-lg border border-red-800/60 shrink-0">
                  {audioLevels.map((lvl, idx) => (
                    <div
                      key={idx}
                      style={{ height: `${Math.max(4, Math.round(lvl * 24))}px` }}
                      className="w-1 bg-gradient-to-t from-red-500 to-amber-400 rounded-full transition-all duration-75"
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => stopVoiceRecording(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                  title="Discard voice recording"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Discard</span>
                </button>
                <button
                  onClick={() => stopVoiceRecording(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-red-900/40 active:scale-95 transition-all"
                  title="Send voice note immediately in microseconds"
                >
                  <Send className="w-3.5 h-3.5 fill-current" />
                  <span>Send Voice</span>
                </button>
              </div>
            </div>
          ) : (
            /* Input Composer Bar */
            <div className="p-2.5 md:p-3 border-t border-slate-800 bg-slate-900/80">
              <div className="flex items-end gap-1.5 md:gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5 md:p-2 focus-within:border-blue-500 transition-colors">
                {/* Hidden File & Camera Inputs */}
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  accept="video/*,video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv,.m4v"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={docInputRef}
                  accept="*/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Media Attachment Action Buttons */}
                <div className="flex items-center gap-0.5">
                  {/* Photo / Gallery */}
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    title="Send images (instant microsecond render, multi-select)"
                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  {/* Camera Snap */}
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    title="Take photo with camera"
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  {/* Video */}
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    title="Send video (high-speed upload)"
                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                  >
                    <Film className="w-4 h-4" />
                  </button>

                  {/* Document / File */}
                  <button
                    onClick={() => docInputRef.current?.click()}
                    title="Attach files or documents (instant render, multi-select)"
                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Voice Note Recording */}
                  <button
                    onClick={startVoiceRecording}
                    title="Record voice note (live mic visualizer & instant dispatch)"
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>

                {/* Textarea with Clipboard Paste Support */}
                <textarea
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={
                    isRoom
                      ? `Message #${currentRoom?.name}...`
                      : `Message ${directUser?.name || 'peer'}...`
                  }
                  rows={1}
                  className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 resize-none focus:outline-none max-h-28 py-1 leading-relaxed"
                />

                {/* Emoji Quick Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(showEmojiPicker === 'input' ? null : 'input')}
                    title="Add emoji"
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  {showEmojiPicker === 'input' && (
                    <div className="absolute right-0 bottom-full mb-2 bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-2xl flex items-center gap-1 z-30">
                      {COMMON_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setInputText((prev) => prev + emoji);
                            setShowEmojiPicker(null);
                          }}
                          className="p-1 text-base hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() && attachedQueue.length === 0}
                  title="Send message (Enter)"
                  className={`p-1.5 md:p-2 rounded-lg transition-all shrink-0 ${
                    inputText.trim() || attachedQueue.length > 0
                      ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 active:scale-95'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* If invited to this private group, prompt to accept at the bottom to start chatting */}
      {isRoom && !isRoomMember && isInvited && pendingInvitation && onRespondInvitation && (
        <div className="p-3 bg-slate-900 border-t border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Lock className="w-4 h-4 text-purple-400 shrink-0" />
            <span>You are viewing past chat history. Accept the invitation to send messages and make calls.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onRespondInvitation(pendingInvitation, false)}
              className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg font-medium transition-colors"
            >
              Decline
            </button>
            <button
              onClick={() => onRespondInvitation(pendingInvitation, true)}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept & Join</span>
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Video & Image Theater Modal */}
      {activeMediaModal && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6"
          onClick={() => setActiveMediaModal(null)}
        >
          {/* Top Bar with Media Title, Download & Close */}
          <div
            className="w-full max-w-4xl flex items-center justify-between pb-3 text-slate-200 border-b border-slate-800/80 mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800 text-indigo-400">
                {activeMediaModal.type === 'video' ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
              </span>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold truncate text-white">
                  {activeMediaModal.fileName || (activeMediaModal.type === 'video' ? 'Video Player' : 'Image Preview')}
                </p>
                {activeMediaModal.fileSize && (
                  <p className="text-[11px] text-slate-400 font-mono">
                    {formatBytes(activeMediaModal.fileSize)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={activeMediaModal.url}
                download={activeMediaModal.fileName || (activeMediaModal.type === 'video' ? 'video.mp4' : 'image.jpg')}
                target="_blank"
                rel="noopener noreferrer"
                title="Download file"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveMediaModal(null)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Media Player Container */}
          <div
            className="w-full max-w-4xl max-h-[82vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black/90 shadow-2xl border border-slate-800 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {activeMediaModal.type === 'video' ? (
              <video
                src={activeMediaModal.url}
                controls
                autoPlay
                playsInline
                className="max-h-[80vh] w-full object-contain rounded-xl"
              />
            ) : (
              <img
                src={activeMediaModal.url}
                alt={activeMediaModal.fileName || 'Preview'}
                className="max-h-[80vh] max-w-full object-contain rounded-xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
