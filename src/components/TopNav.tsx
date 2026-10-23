import React from 'react';
import { 
  Radio, 
  MessageSquare, 
  Video, 
  Users, 
  PhoneCall, 
  ExternalLink, 
  Menu,
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
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
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
  onToggleMobileSidebar,
  isMobileSidebarOpen,
}) => {
  const ongoingCallsCount = activeCalls.length;

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950 px-3 md:px-6 flex items-center justify-between shrink-0 select-none z-30">
      {/* Zone 1: Branding, Mobile Toggle & Real-Time Presence Indicator */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Toggle Menu"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <a 
          href="/" 
          onClick={(e) => { e.preventDefault(); setActiveTab('chats'); }}
          className="text-base md:text-lg font-bold tracking-tight text-white hover:text-blue-400 transition-colors flex items-center gap-2 truncate shrink-0"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
          <span>Elie Chat</span>
        </a>

        {/* Real-Time Online Users & Network Status Pill */}
        <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 pl-2 border-l border-slate-800 shrink-0">
          {isConnected ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-emerald-400 tabular-nums">
                {onlineCount} {onlineCount === 1 ? 'online' : 'online'}
              </span>
              <span className="hidden sm:inline text-slate-600" aria-hidden="true">·</span>
              <span className="hidden sm:inline text-slate-400">Cloud Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-amber-300">Connecting...</span>
            </div>
          )}
        </div>
      </div>

      {/* Zone 2: Navigation Links (Desktop / Tablet) */}
      <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-xs md:text-sm font-medium">
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
          <span>Direct (1-on-1)</span>
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

      {/* Zone 3: Actions & User Profile */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Multi-Device Testing Helper */}
        <button
          onClick={onOpenMultiTab}
          title="Open test peer or persona in another window/tab"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
        >
          <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden lg:inline">Cross-Device Test</span>
          <span className="lg:hidden">Test</span>
        </button>

        {/* User Profile Button */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2 p-1 md:px-2.5 md:py-1 rounded-lg hover:bg-slate-900 text-slate-200 transition-colors"
          title="Manage account & profile"
        >
          <div className="relative shrink-0">
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
                  : currentUser.status === 'away'
                  ? 'bg-amber-500'
                  : 'bg-slate-500'
              }`}
            />
          </div>
          <div className="hidden lg:flex flex-col text-left truncate max-w-[110px]">
            <span className="text-xs font-medium text-slate-200 truncate">
              {currentUser.name}
            </span>
            <span className="text-[10px] text-slate-400 truncate">
              {currentUser.location?.flag || '🇷🇼'} {currentUser.location?.city || 'Kigali'}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};
