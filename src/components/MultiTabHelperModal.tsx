import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, Users, Globe2, CheckCircle2, RefreshCw } from 'lucide-react';

interface MultiTabHelperModalProps {
  onClose: () => void;
  selfPeerId?: string;
  onSwitchPersona?: (personaKey: string) => void;
}

export const MultiTabHelperModal: React.FC<MultiTabHelperModalProps> = ({
  onClose,
  selfPeerId,
  onSwitchPersona,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPersona, setCopiedPersona] = useState<string | null>(null);

  const getPersonaUrl = (persona: 'elie' | 'designer' | 'lead' | 'tokyo') => {
    const url = new URL(window.location.href);
    url.searchParams.set('persona', persona);
    url.searchParams.set('tab', Date.now().toString());
    return url.toString();
  };

  const handleCopyPeerId = () => {
    if (!selfPeerId) return;
    navigator.clipboard.writeText(selfPeerId).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const handleCopyLink = (persona: 'elie' | 'designer' | 'lead' | 'tokyo', e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getPersonaUrl(persona);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedPersona(persona);
      setTimeout(() => setCopiedPersona(null), 2000);
    });
  };

  const handleOpenTab = (persona: 'elie' | 'designer' | 'lead' | 'tokyo') => {
    const url = getPersonaUrl(persona);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-blue-400" />
            P2P Public Cloud Mesh & Testing
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Connected to the free public PeerJS cloud server for signaling. Open another tab or connect a different device anywhere in the world to test real-time P2P direct messaging and live calls:
          </p>
        </div>

        {/* Current Dynamic Peer ID Banner */}
        {selfPeerId && (
          <div className="p-3 rounded-xl bg-slate-950 border border-blue-900/60 flex items-center justify-between">
            <div className="truncate mr-2">
              <span className="text-[10px] uppercase font-semibold text-blue-400 block tracking-wider">
                My Public PeerJS ID
              </span>
              <code className="text-xs font-mono text-slate-200 truncate block">
                {selfPeerId}
              </code>
            </div>
            <button
              onClick={handleCopyPeerId}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-xs font-medium border border-blue-500/40 shrink-0 transition-colors"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Personas to test */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Connect as another peer:</span>
            <span className="text-[10px] text-slate-400">Click to open or switch</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Elena */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-slate-800/60 text-left transition-all flex items-center justify-between group">
              <div
                className="flex items-center gap-2.5 cursor-pointer flex-1 truncate"
                onClick={() => handleOpenTab('lead')}
                title="Open in new window"
              >
                <img
                  src="/src/assets/images/avatar_tech_lead_1790668646558.jpg"
                  alt="Elena"
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div className="truncate">
                  <div className="text-xs font-semibold text-white truncate">Elena Rostova</div>
                  <div className="text-[10px] text-slate-400 truncate">🇩🇪 Berlin, Germany</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                  onClick={(e) => handleCopyLink('lead', e)}
                  title="Copy link"
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  {copiedPersona === 'lead' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                {onSwitchPersona && (
                  <button
                    onClick={() => onSwitchPersona('lead')}
                    title="Switch persona in this tab"
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleOpenTab('lead')}
                  title="Open in new tab"
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Marcus */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-slate-800/60 text-left transition-all flex items-center justify-between group">
              <div
                className="flex items-center gap-2.5 cursor-pointer flex-1 truncate"
                onClick={() => handleOpenTab('designer')}
                title="Open in new window"
              >
                <img
                  src="/src/assets/images/avatar_designer_1790668663121.jpg"
                  alt="Marcus"
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div className="truncate">
                  <div className="text-xs font-semibold text-white truncate">Marcus Vance</div>
                  <div className="text-[10px] text-slate-400 truncate">🇺🇸 New York, USA</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                  onClick={(e) => handleCopyLink('designer', e)}
                  title="Copy link"
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  {copiedPersona === 'designer' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                {onSwitchPersona && (
                  <button
                    onClick={() => onSwitchPersona('designer')}
                    title="Switch persona in this tab"
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleOpenTab('designer')}
                  title="Open in new tab"
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Kenji */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-slate-800/60 text-left transition-all flex items-center justify-between group">
              <div
                className="flex items-center gap-2.5 cursor-pointer flex-1 truncate"
                onClick={() => handleOpenTab('tokyo')}
                title="Open in new window"
              >
                <img
                  src="/src/assets/images/avatar_developer_1790668686679.jpg"
                  alt="Kenji"
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div className="truncate">
                  <div className="text-xs font-semibold text-white truncate">Kenji Sato</div>
                  <div className="text-[10px] text-slate-400 truncate">🇯🇵 Tokyo, Japan</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                  onClick={(e) => handleCopyLink('tokyo', e)}
                  title="Copy link"
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  {copiedPersona === 'tokyo' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                {onSwitchPersona && (
                  <button
                    onClick={() => onSwitchPersona('tokyo')}
                    title="Switch persona in this tab"
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleOpenTab('tokyo')}
                  title="Open in new tab"
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Elie */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-slate-800/60 text-left transition-all flex items-center justify-between group">
              <div
                className="flex items-center gap-2.5 cursor-pointer flex-1 truncate"
                onClick={() => handleOpenTab('elie')}
                title="Open in new window"
              >
                <img
                  src="/src/assets/images/avatar_elie_1790670827487.jpg"
                  alt="Elie"
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div className="truncate">
                  <div className="text-xs font-semibold text-white truncate">Elie Manirakiza</div>
                  <div className="text-[10px] text-slate-400 truncate">🇷🇼 Kigali, Rwanda (Host)</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                  onClick={(e) => handleCopyLink('elie', e)}
                  title="Copy link"
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  {copiedPersona === 'elie' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                {onSwitchPersona && (
                  <button
                    onClick={() => onSwitchPersona('elie')}
                    title="Switch persona in this tab"
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleOpenTab('elie')}
                  title="Open in new tab"
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs space-y-2 text-slate-300">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Public PeerJS Cloud Mesh:</span>
          </div>
          <ul className="space-y-1 text-slate-400 text-[11px] list-disc list-inside">
            <li>Dynamic Peer ID registration on public PeerJS server (0.peerjs.com).</li>
            <li>Automatic cross-device peer discovery with zero server requirement.</li>
            <li>When another peer connects, they instantly show up online in Direct Messages.</li>
          </ul>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
