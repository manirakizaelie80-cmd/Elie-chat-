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
  Clock
} from 'lucide-react';
import { Message, User, Room } from '../types';
import { formatLastSeen } from '../utils/userSync';
import { DEFAULT_AVATAR } from '../utils/photoUpload';

interface ChatAreaProps {
  currentUser: User;
  currentRoom: Room | null;
  directUser: User | null;
  messages: Message[];
  typingUsers: { userId: string; userName: string }[];
  onSendMessage: (payload: {
    text: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'file';
    voiceAudio?: string;
    voiceDuration?: number;
    replyTo?: { id: string; senderName: string; text: string };
  }) => void;
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
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '🚀', '👀'];

export const ChatArea: React.FC<ChatAreaProps> = ({
  currentUser,
  currentRoom,
  directUser,
  messages,
  typingUsers,
  onSendMessage,
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
}) => {
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  // Voice Recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Audio Playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUsers.length]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    onSendTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onSendTyping(false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!inputText.trim() && !attachedImage) return;

    onSendMessage({
      text: inputText.trim(),
      mediaUrl: attachedImage || undefined,
      mediaType: attachedImage ? 'image' : undefined,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            text: replyingTo.text,
          }
        : undefined,
    });

    setInputText('');
    setAttachedImage(null);
    setReplyingTo(null);
    setShowEmojiPicker(null);
    onSendTyping(false);
  };

  // Image file attachment upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Voice note recording
  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Audio recording not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          onSendMessage({
            text: '🎤 Voice message',
            voiceAudio: base64Audio,
            voiceDuration: recordingDuration,
          });
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone access denied for voice note', err);
      alert('Could not access microphone for voice message. Please enable microphone permissions.');
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
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
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

  const isRoom = Boolean(currentRoom);
  const isRoomMember = !isRoom || !currentRoom?.isPrivate || (
    currentRoom.createdById === currentUser.id ||
    (Array.isArray(currentRoom.memberIds) && currentRoom.memberIds.includes(currentUser.id)) ||
    (Array.isArray(currentRoom.adminIds) && currentRoom.adminIds.includes(currentUser.id))
  );
  const targetTitle = isRoom ? currentRoom?.name : directUser?.name;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Image Preview Lightbox */}
      {previewImageUrl && (
        <div 
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer animate-in fade-in"
        >
          <button 
            onClick={() => setPreviewImageUrl(null)}
            className="absolute top-4 right-4 p-2 text-white bg-slate-800/80 rounded-full hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
          <img 
            src={previewImageUrl} 
            alt="Enlarged preview" 
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
          />
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

      {/* Message Feed / Private Lock Screen */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3.5">
        {isRoom && !isRoomMember ? (
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
          messages.map((msg) => {
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
                    {/* Attached Image */}
                    {msg.mediaUrl && (
                      <div className="mb-2 overflow-hidden rounded-lg">
                        <img
                          src={msg.mediaUrl}
                          alt="Attachment"
                          className="max-h-60 rounded-lg object-cover w-full hover:opacity-95 transition-opacity cursor-pointer"
                          onClick={() => setPreviewImageUrl(msg.mediaUrl!)}
                        />
                      </div>
                    )}

                    {/* Voice Message Player */}
                    {msg.voiceAudio ? (
                      <div className="flex items-center gap-3 py-1">
                        <button
                          onClick={() => togglePlayAudio(msg.id, msg.voiceAudio!)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                            isMe ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                          }`}
                        >
                          {playingAudioId === msg.id ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-1 h-5">
                            {[12, 24, 18, 28, 14, 22, 10, 26, 16, 20].map((h, i) => (
                              <span
                                key={i}
                                style={{ height: `${h}px` }}
                                className={`w-1 rounded-full ${
                                  playingAudioId === msg.id
                                    ? isMe ? 'bg-white animate-pulse' : 'bg-blue-400 animate-pulse'
                                    : isMe ? 'bg-white/60' : 'bg-slate-500'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] tabular-nums opacity-80">
                            {msg.voiceDuration ? `0:${msg.voiceDuration.toString().padStart(2, '0')}` : 'Voice Note'}
                          </span>
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
          })
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
          {/* Attached Image Preview */}
          {attachedImage && (
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-3">
              <div className="relative">
                <img
                  src={attachedImage}
                  alt="Attached preview"
                  className="w-16 h-16 object-cover rounded-md border border-slate-700"
                />
                <button
                  onClick={() => setAttachedImage(null)}
                  className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-500 shadow"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <span className="text-xs text-slate-400">Image attached. Press Send or hit Enter.</span>
            </div>
          )}

          {/* Voice Recording Bar */}
          {isRecordingVoice ? (
            <div className="p-3 bg-red-950/40 border-t border-red-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span>Recording Voice Message: 0:{recordingDuration.toString().padStart(2, '0')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => stopVoiceRecording(false)}
                  className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => stopVoiceRecording(true)}
                  className="px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-500 text-xs font-semibold flex items-center gap-1 shadow-sm"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Send Voice</span>
                </button>
              </div>
            </div>
          ) : (
            /* Input Composer Bar */
            <div className="p-2.5 md:p-3 border-t border-slate-800 bg-slate-900/80">
              <div className="flex items-end gap-1.5 md:gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5 md:p-2 focus-within:border-blue-500 transition-colors">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Attach Image Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach image"
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                {/* Voice Record Button */}
                <button
                  onClick={startVoiceRecording}
                  title="Record voice message"
                  className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Textarea */}
                <textarea
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
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
                  disabled={!inputText.trim() && !attachedImage}
                  title="Send message (Enter)"
                  className={`p-1.5 md:p-2 rounded-lg transition-colors shrink-0 ${
                    inputText.trim() || attachedImage
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
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
    </div>
  );
};
