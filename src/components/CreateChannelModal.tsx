import React, { useState } from 'react';
import { X, Hash, Video } from 'lucide-react';

interface CreateChannelModalProps {
  onClose: () => void;
  onCreate: (name: string, description: string, isVoiceVideo: boolean) => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isVoiceVideo, setIsVoiceVideo] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim(), isVoiceVideo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold text-white mb-4">Create Channel / Room</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Room Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsVoiceVideo(false)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-colors ${
                  !isVoiceVideo
                    ? 'bg-blue-600/20 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Hash className="w-4 h-4 mt-0.5 text-blue-400" />
                <div>
                  <div className="text-xs font-semibold">Text Channel</div>
                  <div className="text-[11px] text-slate-500">Post messages, images, and voice notes.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsVoiceVideo(true)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-colors ${
                  isVoiceVideo
                    ? 'bg-blue-600/20 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-4 h-4 mt-0.5 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold">Live Stage Room</div>
                  <div className="text-[11px] text-slate-500">Group voice and video call conference.</div>
                </div>
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Channel Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. mobile-engineering or gaming-lounge"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
