import React, { useState } from 'react';
import { X, Hash, Video, Users, Sparkles, Check, Globe2, Shield } from 'lucide-react';
import { User } from '../types';

interface CreateChannelModalProps {
  onClose: () => void;
  onCreate: (roomData: {
    name: string;
    description: string;
    type: 'text' | 'voice-video';
    isCustomGroup: boolean;
    icon?: string;
    category?: string;
    memberIds?: string[];
  }) => void;
  availableUsers?: User[];
  currentUserId?: string;
}

const PRESET_ICONS = ['💬', '🚀', '🌍', '🎨', '⚡', '🎮', '💡', '🎵', '☕', '🔥', '🎙️', '🤖'];

const PRESET_CATEGORIES = ['General', 'Engineering', 'Design', 'Community', 'Gaming', 'Hangout'];

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  onClose,
  onCreate,
  availableUsers = [],
  currentUserId,
}) => {
  const [kind, setKind] = useState<'channel' | 'group'>('channel');
  const [type, setType] = useState<'text' | 'voice-video'>('text');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('💬');
  const [category, setCategory] = useState('Community');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Other users available to add to group
  const otherUsers = availableUsers.filter((u) => u.id !== currentUserId);

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreate({
      name: name.trim(),
      description: description.trim(),
      type,
      isCustomGroup: kind === 'group',
      icon: selectedIcon,
      category,
      memberIds: kind === 'group' ? [currentUserId || '', ...selectedMemberIds].filter(Boolean) : [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            Create Channel or Group
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Create a custom group or topic channel accessible to people worldwide in real time.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Channel vs Group */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Format</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setKind('channel');
                  if (!selectedIcon || selectedIcon === '👥') setSelectedIcon('💬');
                }}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  kind === 'channel'
                    ? 'bg-blue-600/20 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe2 className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Public Channel</div>
                  <div className="text-[11px] text-slate-500">Open community channel visible to all peers.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setKind('group');
                  setSelectedIcon('👥');
                }}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  kind === 'group'
                    ? 'bg-purple-600/20 border-purple-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4 mt-0.5 text-purple-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Custom Group</div>
                  <div className="text-[11px] text-slate-500">Private squad with selected peers & members.</div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Medium (Text vs Live Stage) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Communication Medium</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setType('text')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors ${
                  type === 'text'
                    ? 'bg-blue-600/20 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Hash className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Text & Media</div>
                  <div className="text-[10px] text-slate-500">Chat, voice notes & files</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('voice-video')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors ${
                  type === 'voice-video'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Live Stage & Call</div>
                  <div className="text-[10px] text-slate-500">24/7 video & audio stage</div>
                </div>
              </button>
            </div>
          </div>

          {/* Icon and Name */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              {kind === 'group' ? 'Group Name' : 'Channel Name'}
            </label>
            <div className="flex items-center gap-2">
              {/* Icon Picker Pop */}
              <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
                {PRESET_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedIcon(emoji)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 transition-transform ${
                      selectedIcon === emoji
                        ? 'bg-blue-600/30 border border-blue-400 scale-110'
                        : 'bg-slate-950 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">{selectedIcon}</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  kind === 'group'
                    ? 'e.g. Frontend Core Squad or Kigali Tech Circle'
                    : 'e.g. cross-border-collab or mobile-dev'
                }
                required
                maxLength={80}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Description & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {PRESET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief purpose or topic"
                maxLength={200}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* If Custom Group: Select Members */}
          {kind === 'group' && otherUsers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Add Peers to Group</label>
                <span className="text-[10px] text-slate-400">
                  {selectedMemberIds.length} selected
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 bg-slate-950 border border-slate-800 rounded-xl p-2">
                {otherUsers.map((user) => {
                  const isSelected = selectedMemberIds.includes(user.id);
                  return (
                    <div
                      key={user.id}
                      onClick={() => toggleMember(user.id)}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-purple-950/40 text-purple-200 border border-purple-500/30'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <img
                          src={user.avatar || '/src/assets/images/avatar_elie_1790670827487.jpg'}
                          alt={user.name}
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                        <div className="truncate">
                          <span className="font-medium truncate block">{user.name}</span>
                          {user.location && (
                            <span className="text-[10px] text-slate-500 truncate block">
                              {user.location.flag} {user.location.city}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                          isSelected
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>{kind === 'group' ? 'Create Group' : 'Create Channel'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
