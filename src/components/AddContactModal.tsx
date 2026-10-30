import React, { useState } from 'react';
import { 
  X, 
  Search, 
  UserPlus, 
  Check, 
  Clock, 
  AlertCircle, 
  Loader2, 
  Shield, 
  UserCheck, 
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { User, PublicUserProfile } from '../types';
import { searchUserByExactUsername, sendContactRequest } from '../utils/contactSync';
import { DEFAULT_AVATAR } from '../utils/photoUpload';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onOpenChatWithUser?: (userId: string) => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenChatWithUser,
}) => {
  const [queryUsername, setQueryUsername] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchedUser, setSearchedUser] = useState<PublicUserProfile | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = queryUsername.trim().replace(/^@+/, '').toLowerCase();
    if (!clean) return;

    setIsSearching(true);
    setSearchedUser(null);
    setHasSearched(false);
    setFeedback(null);

    try {
      const found = await searchUserByExactUsername(clean);
      setSearchedUser(found);
      setHasSearched(true);
      if (!found) {
        setFeedback({
          text: `No account matches exact username "@${clean}". Double-check spelling.`,
          type: 'info',
        });
      }
    } catch {
      setFeedback({ text: 'Search failed. Please try again.', type: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchedUser) return;
    setIsSending(true);
    setFeedback(null);

    try {
      const result = await sendContactRequest({
        sender: currentUser,
        targetUser: searchedUser,
      });

      if (result.success) {
        setFeedback({ text: result.message, type: 'success' });
      } else {
        setFeedback({ text: result.message, type: 'error' });
      }
    } catch {
      setFeedback({ text: 'Failed to send request.', type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const isAlreadyContact = Boolean(
    searchedUser && currentUser.contacts && currentUser.contacts.includes(searchedUser.id)
  );
  const isSelf = Boolean(searchedUser && searchedUser.id === currentUser.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Find People & Add Contacts</h2>
              <p className="text-[11px] text-slate-400">Connect privately by exact username</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Privacy Note */}
          <div className="p-3 bg-blue-950/30 border border-blue-900/40 rounded-2xl flex items-start gap-2.5 text-xs text-blue-300">
            <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              <strong className="text-blue-200">Zero-Public Discovery:</strong> To protect everyone's privacy, you can only find users by their exact username. No public directories or emails are ever exposed.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Enter Exact Username
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">@</span>
                <input
                  type="text"
                  value={queryUsername}
                  onChange={(e) => setQueryUsername(e.target.value)}
                  placeholder="e.g. elie, marcus_dev"
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={!queryUsername.trim() || isSearching}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shrink-0"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Search</span>
              </button>
            </div>
          </form>

          {/* Feedback Message */}
          {feedback && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              feedback.type === 'success' 
                ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                : feedback.type === 'error'
                ? 'bg-red-950/60 border-red-800/80 text-red-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-300'
            }`}>
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Search Result Card */}
          {searchedUser && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <img
                  src={searchedUser.avatar || DEFAULT_AVATAR}
                  alt={searchedUser.name}
                  className="w-12 h-12 rounded-full object-cover border border-slate-700 shadow-md"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-white truncate">{searchedUser.name}</h3>
                  <p className="text-xs text-blue-400 font-mono">@{searchedUser.username}</p>
                  {searchedUser.customStatus && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{searchedUser.customStatus}</p>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="pt-1">
                {isSelf ? (
                  <div className="p-2 bg-slate-900 rounded-xl text-center text-xs text-slate-400">
                    This is your personal Elie Chat account.
                  </div>
                ) : isAlreadyContact ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      <UserCheck className="w-4 h-4" /> Already in your contacts
                    </span>
                    {onOpenChatWithUser && (
                      <button
                        onClick={() => {
                          onOpenChatWithUser(searchedUser.id);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Open Chat
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleSendRequest}
                    disabled={isSending}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    <span>Send Contact Request</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
