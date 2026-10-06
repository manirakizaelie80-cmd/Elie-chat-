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
  Trash2
} from 'lucide-react';
import { Message, User, Room } from '../types';

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
}) => {
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null); // messageId or 'input'
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  
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
    // reset input
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

        // stop all audio tracks
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
      alert('Could not access microphone for voice message.');
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
        // Cancel without sending
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
  const targetTitle = isRoom ? currentRoom?.name : directUser?.name;
  const targetDesc = isRoom ? currentRoom?.description : (directUser?.customStatus || directUser?.status);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Chat Header */}
      <div className="h-14 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-3 truncate">
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
          ) : directUser?.avatar ? (
            <img
              src={directUser.avatar}
              alt={directUser.name}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
              {directUser?.name[0] || 'U'}
            </div>
          )}

          <div className="truncate">
            <div className="flex items-center gap-1.5 truncate">
              <h2 className="text-sm font-semibold text-white tracking-tight truncate">
                {targetTitle}
              </h2>
              {isRoom && currentRoom?.isCustomGroup && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 shrink-0">
                  Custom Group
                </span>
              )}
              {isRoom && currentRoom?.category && (
                <span className="text-[10px] text-slate-400 hidden sm:inline shrink-0">
                  • {currentRoom.category}
                </span>
              )}
              {!isRoom && directUser?.location && (
                <span className="text-xs text-slate-400 shrink-0">
                  {directUser.location.flag} {directUser.location.city}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
              <span className="truncate">{targetDesc}</span>
              {isRoom && currentRoom?.memberIds && currentRoom.memberIds.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-purple-400 shrink-0">{currentRoom.memberIds.length} members</span>
                </>
              )}
              {!isRoom && directUser?.location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-400">
                    {new Date().toLocaleTimeString('en-US', {
                      timeZone: directUser.location.timezone,
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}{' '}
                    local
                  </span>
                </>
              )}
              {isRoom && currentRoom?.type === 'voice-video' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-blue-400 font-medium">Global Video/Voice Stage</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Voice / Video Call & Delete if Creator */}
        <div className="flex items-center gap-2 shrink-0">
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

          {isRoom && currentRoom?.activeCall ? (
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
          )}
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs py-10 space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-2">
              <Users className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-300 text-sm">No messages yet</p>
            <p className="max-w-xs">Send a text, record a voice note, or start a live voice/video call with the buttons above!</p>
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
                className={`flex gap-3 group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {msg.senderAvatar ? (
                    <img
                      src={msg.senderAvatar}
                      alt={msg.senderName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold border border-slate-700">
                      {msg.senderName[0] || 'U'}
                    </div>
                  )}
                </div>

                {/* Content Bubble */}
                <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender Metadata (No pills, clean unboxed typography) */}
                  <div className={`flex items-center gap-1.5 text-[11px] text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
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
                    className={`p-3 rounded-xl text-xs leading-relaxed break-words relative group ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-slate-800/90 text-slate-200 rounded-tl-none border border-slate-700/60'
                    }`}
                  >
                    {/* Attached Image */}
                    {msg.mediaUrl && (
                      <div className="mb-2 overflow-hidden rounded-lg">
                        <img
                          src={msg.mediaUrl}
                          alt="Attachment"
                          className="max-h-64 rounded-lg object-cover w-full hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(msg.mediaUrl, '_blank')}
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

                    {/* Floating Quick Action Overlay */}
                    <div
                      className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900/90 border border-slate-700 rounded-lg p-1 shadow-md ${
                        isMe ? '-left-16' : '-right-16'
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
                    </div>

                    {/* Emoji Reaction Drawer Popover */}
                    {showEmojiPicker === msg.id && (
                      <div className="absolute z-10 bottom-full left-0 mb-1 bg-slate-900 border border-slate-700 rounded-lg p-1.5 shadow-xl flex items-center gap-1.5">
                        {COMMON_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              onSendReaction(msg.id, emoji);
                              setShowEmojiPicker(null);
                            }}
                            className="p-1 hover:bg-slate-800 rounded text-base hover:scale-125 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reaction Badges */}
                  {Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                        const hasReacted = userIds.includes(currentUser.id);
                        return (
                          <button
                            key={emoji}
                            onClick={() => onSendReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
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
        <div className="px-4 py-1 text-xs text-slate-400 flex items-center gap-1.5 italic bg-slate-900/40 border-t border-slate-800/40">
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
          <span className="text-xs text-slate-400">Image attached. Press send or Enter.</span>
        </div>
      )}

      {/* Voice Recording Overlay Bar */}
      {isRecordingVoice ? (
        <div className="p-3 bg-red-950/40 border-t border-red-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span>Recording Voice Message: 0:{recordingDuration.toString().padStart(2, '0')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => stopVoiceRecording(false)}
              className="px-3 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => stopVoiceRecording(true)}
              className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-500 text-xs font-semibold flex items-center gap-1"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Send Voice</span>
            </button>
          </div>
        </div>
      ) : (
        /* Input Composer Bar */
        <div className="p-3 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-end gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2 focus-within:border-blue-500 transition-colors">
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
              title="Record voice note"
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
                  : `Message ${directUser?.name}...`
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
                <div className="absolute right-0 bottom-full mb-2 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-xl flex items-center gap-1 z-20">
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
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${
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
    </div>
  );
};
