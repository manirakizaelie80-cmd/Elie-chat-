import React from 'react';
import { 
  Radio, 
  MessageSquare, 
  Video, 
  Users, 
  PhoneCall, 
  ExternalLink, 
  UserCircle2, 
  CheckCircle2, 
  AlertCircle,
  Globe2 
} from 'lucide-react';
import { User, ViewTab, ActiveCall } from '../types';

interface TopNavProps {
  currentUser: User;
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  activeCalls: ActiveCall[];
  onOpenProfile: () => void;
  onOpenMultiTab: () => void;
  isConnected: boolean;
  onlineCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  activeCalls,
  onOpenProfile,
  onOpenMultiTab,
  isConnected,
  onlineCount,
}) => {
  const ongoingCallsCount = activeCalls.length;

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950 px-4 md:px-6 flex items-center justify-between shrink-0 select-none">
      {/* Zone 1: Single text element wordmark with subtle status marker */}
      <div className="flex items-center gap-3">
        <a 
          href="/" 
          onClick={(e) => { e.preventDefault(); setActiveTab('chats'); }}
          className="text-lg font-bold tracking-tight text-white hover:text-blue-400 transition-colors flex items-center gap-2"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          Elie Chat
        </a>

        {/* Network status and location pill */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 pl-2 border-l border-slate-800">
          {isConnected ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Global Mesh Live</span>
              <span aria-hidden="true">·</span>
              <span>{onlineCount} {onlineCount === 1 ? 'peer' : 'peers'}</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>Connecting...</span>
            </>
          )}
        </div>
      </div>

      {/* Zone 2: Clean single-line text navigation links */}
      <nav className="flex items-center gap-1 md:gap-3 text-xs md:text-sm font-medium">
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'chats'
              ? 'text-white bg-slate-800'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>All Chats</span>
        </button>

        <button
          onClick={() => setActiveTab('world-map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'world-map'
              ? 'text-blue-300 bg-blue-950/70 border border-blue-800'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Globe2 className="w-3.5 h-3.5 text-blue-400" />
          <span>World Map</span>
        </button>

        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'rooms'
              ? 'text-white bg-slate-800'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Global Stages</span>
        </button>

        <button
          onClick={() => setActiveTab('direct')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'direct'
              ? 'text-white bg-slate-800'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Direct 1-on-1</span>
        </button>

        {ongoingCallsCount > 0 && (
          <button
            onClick={() => setActiveTab('active-calls')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'active-calls'
                ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800'
                : 'text-emerald-400 hover:bg-slate-900'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
            <span>Active Calls ({ongoingCallsCount})</span>
          </button>
        )}
      </nav>

      {/* Zone 3: 1-2 Primary actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Test Multi-User Button */}
        <button
          onClick={onOpenMultiTab}
          title="Open another session in new window to test cross-continental calls"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
        >
          <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
          <span>Cross-World Call Test</span>
        </button>

        {/* User Profile Trigger with Location Flag */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2 p-1.5 md:px-2.5 md:py-1 rounded-lg hover:bg-slate-900 text-slate-200 transition-colors"
          title="Edit profile & world location"
        >
          <div className="relative">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover border border-slate-700"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                {currentUser.name[0] || 'U'}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                currentUser.status === 'online'
                  ? 'bg-emerald-500'
                  : currentUser.status === 'in-call'
                  ? 'bg-purple-500'
                  : 'bg-amber-500'
              }`}
            />
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-medium text-slate-200 truncate max-w-[100px]">
              {currentUser.name}
            </span>
            <span className="text-[10px] text-slate-400">
              {currentUser.location?.flag || '🇷🇼'} {currentUser.location?.city || 'Kigali'}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};

