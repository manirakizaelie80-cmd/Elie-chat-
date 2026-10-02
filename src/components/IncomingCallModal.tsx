import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, Sparkles } from 'lucide-react';
import { playRingtone, stopRingtone } from '../utils/audioSynth';

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
  useEffect(() => {
    playRingtone();
    return () => {
      stopRingtone();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-6">
        {/* Pulsing Avatar */}
        <div className="relative inline-block mx-auto">
          <span className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
          <span className="absolute -inset-2 rounded-full bg-blue-500/10 animate-pulse" />
          {caller.avatar ? (
            <img
              src={caller.avatar}
              alt={caller.name}
              referrerPolicy="no-referrer"
              className="relative w-20 h-20 rounded-full object-cover border-2 border-blue-500 shadow-xl"
            />
          ) : (
            <div className="relative w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-xl">
              {caller.name[0] || 'U'}
            </div>
          )}
        </div>

        {/* Text Details */}
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white tracking-tight">{caller.name}</h3>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
            {callType === 'video' ? (
              <>
                <Video className="w-3.5 h-3.5 text-blue-400" />
                <span>Incoming Video Call...</span>
              </>
            ) : (
              <>
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Incoming Voice Call...</span>
              </>
            )}
          </p>
        </div>

        {/* Call Actions */}
        <div className="flex items-center justify-center gap-6 pt-2">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => {
                stopRingtone();
                onDecline();
              }}
              className="w-14 h-14 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-transform active:scale-95"
              title="Decline"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[11px] font-medium text-slate-400">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => {
                stopRingtone();
                onAccept();
              }}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-transform active:scale-95 animate-bounce"
              title="Accept Call"
            >
              {callType === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </button>
            <span className="text-[11px] font-medium text-emerald-400">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};
