import React, { useState } from 'react';
import { X, Hash, Video, Users, Sparkles, Check, Globe2, Shield, Lock } from 'lucide-react';
import { User } from '../types';

interface CreateChannelModalProps {
  onClose: () => void;
  onCreate: (roomData: {
    name: string;
    description: string;
    type: 'text' | 'voice-video';
    isCustomGroup: boolean;
    isPrivate?: boolean;
    requiresApproval?: boolean;
    icon?: string;
    category?: string;
    memberIds?: string[];
  }) => void;
  availableUsers?: User[];
  currentUserId?: string;
}

const PRESET_ICONS = ['💬', '🚀', '🌍', '🎨', '⚡', '🎮', '💡', '🎵', '☕', '🔥', '🎙️', '🤖', '👥', '🌐'];
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
  const [isPrivate, setIsPrivate] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

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
      isPrivate: kind === 'group' ? isPrivate : false,
      requiresApproval: kind === 'group' ? requiresApproval : false,
      icon: selectedIcon,
      category,
      memberIds: kind === 'group' ? [currentUserId || '', ...selectedMemberIds].filter(Boolean) : [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
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
            Connect people across continents with real-time text, voice notes, and live video stages.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Format */}
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
                  <div className="text-[11px] text-slate-500">Open global channel discoverable by all users.</div>
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
                  <div className="text-[11px] text-slate-500">Manageable group with invitation & approval rules.</div>
                </div>
              </button>
            </div>
          </div>

          {/* Group Privacy & Join Options */}
          {kind === 'group' && (
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Private Group
                  </span>
                  <p className="text-[10px] text-slate-400">Only authorized members can view and send messages</p>
                </div>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                <div>
                  <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    Require Admin Approval to Join
                  </span>
                  <p className="text-[10px] text-slate-400">New joiners must submit a request for admin review</p>
                </div>
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                />
              </div>
            </div>
          )}

          {/* Communication Medium */}
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
                  <div className="text-[10px] text-slate-500">Persistent chat, images, voice notes</div>
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
                  <div className="text-[10px] text-slate-500">24/7 video and audio stage</div>
                </div>
              </button>
            </div>
          </div>

          {/* Name & Icon */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              {kind === 'group' ? 'Group Name' : 'Channel Name'}
            </label>
            <div className="flex items-center gap-1 overflow-x-auto py-1">
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

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">{selectedIcon}</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === 'group' ? 'e.g. Pan-Africa Tech Network' : 'e.g. global-dialogue'}
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
                placeholder="Brief purpose"
                maxLength={200}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* If Custom Group: Select initial members */}
          {kind === 'group' && otherUsers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Initial Members</label>
                <span className="text-[10px] text-slate-400">
                  {selectedMemberIds.length} selected
                </span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 bg-slate-950 border border-slate-800 rounded-xl p-2">
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
                          {user.username && (
                            <span className="text-[10px] text-slate-500 truncate block">@{user.username}</span>
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

          {/* Footer Buttons */}
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
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <span>{kind === 'group' ? 'Create Group' : 'Create Channel'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
