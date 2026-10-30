import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, Sparkles, Volume2 } from 'lucide-react';
import { playRingtone, stopRingtone } from '../utils/audioSynth';
import { DEFAULT_AVATAR } from '../utils/photoUpload';

interface IncomingCallModalProps {
  caller: {
    id: string;
    name: string;
    avatar?: string;
  };
  callType: 'audio' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  caller,
  callType,
  onAccept,
  onDecline,
}) => {
  const isVideo = callType === 'video';

  useEffect(() => {
    playRingtone();
    return () => {
      stopRingtone();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className={`bg-slate-900 border ${isVideo ? 'border-blue-500/50' : 'border-emerald-500/50'} rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-6 relative overflow-hidden`}>
        {/* Ambient Top Glow */}
        <div 
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none ${
            isVideo ? 'bg-blue-500' : 'bg-emerald-500'
          }`} 
        />

        {/* Distinctive Call Type Badge Banner */}
        <div className="flex justify-center">
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase border shadow-sm ${
            isVideo 
              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' 
              : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
          }`}>
            {isVideo ? (
              <>
                <Video className="w-4 h-4 text-blue-400 animate-pulse" />
                <span>Incoming Video Call</span>
              </>
            ) : (
              <>
                <Phone className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Incoming Voice Call</span>
              </>
            )}
          </div>
        </div>

        {/* Pulsing Avatar with Wave Rings */}
        <div className="relative inline-block mx-auto py-2">
          <span className={`absolute inset-0 rounded-full animate-ping opacity-30 ${isVideo ? 'bg-blue-500' : 'bg-emerald-500'}`} />
          <span className={`absolute -inset-3 rounded-full animate-pulse opacity-20 ${isVideo ? 'bg-blue-400' : 'bg-emerald-400'}`} />
          {caller.avatar ? (
            <img
              src={caller.avatar}
              alt={caller.name}
              referrerPolicy="no-referrer"
              className={`relative w-24 h-24 rounded-full object-cover border-4 shadow-2xl ${
                isVideo ? 'border-blue-500' : 'border-emerald-500'
              }`}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = DEFAULT_AVATAR;
              }}
            />
          ) : (
            <div className={`relative w-24 h-24 rounded-full text-white flex items-center justify-center text-3xl font-bold shadow-2xl border-4 ${
              isVideo ? 'bg-blue-600 border-blue-400' : 'bg-emerald-600 border-emerald-400'
            }`}>
              {caller.name[0] || 'U'}
            </div>
          )}

          {/* Call Type Icon Badge on Avatar Corner */}
          <div className={`absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center text-white border-2 border-slate-900 shadow-md ${
            isVideo ? 'bg-blue-600' : 'bg-emerald-600'
          }`}>
            {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          </div>
        </div>

        {/* Caller Information */}
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold text-white tracking-tight">{caller.name}</h3>
          <p className="text-xs text-slate-300 font-medium flex items-center justify-center gap-1.5">
            {isVideo ? (
              <span className="text-blue-300">Wants to start an HD video conference with you</span>
            ) : (
              <span className="text-emerald-300">Wants to start a voice call with you</span>
            )}
          </p>
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 pt-1">
            <Volume2 className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
            <span>Ringing...</span>
          </div>
        </div>

        {/* Clear Call Actions (Decline vs Accept with explicit text) */}
        <div className="flex items-center justify-center gap-8 pt-2">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => {
                stopRingtone();
                onDecline();
              }}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-600/30 transition-transform active:scale-95 cursor-pointer"
              title="Decline Call"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => {
                stopRingtone();
                onAccept();
              }}
              className={`w-16 h-16 rounded-full text-white flex items-center justify-center shadow-xl transition-transform active:scale-95 animate-bounce cursor-pointer ${
                isVideo
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/40'
              }`}
              title={isVideo ? 'Answer Video Call' : 'Answer Voice Call'}
            >
              {isVideo ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </button>
            <span className={`text-xs font-semibold ${isVideo ? 'text-blue-400' : 'text-emerald-400'}`}>
              {isVideo ? 'Answer Video' : 'Answer Voice'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
