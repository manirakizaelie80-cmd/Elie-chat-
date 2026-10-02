import React from 'react';
import { X, ExternalLink, Users, Video, Phone, CheckCircle2, Globe2 } from 'lucide-react';

interface MultiTabHelperModalProps {
  onClose: () => void;
}

export const MultiTabHelperModal: React.FC<MultiTabHelperModalProps> = ({ onClose }) => {
  const openTestTab = (persona: 'elie' | 'designer' | 'lead' | 'tokyo') => {
    const url = new URL(window.location.href);
    url.searchParams.set('persona', persona);
    url.searchParams.set('tab', Date.now().toString());
    window.open(url.toString(), '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-blue-400" />
            Testing Cross-World Real-Time Calls
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Elie Chat connects people living in different locations around the world. Open another window as someone in Berlin, New York, or Tokyo to test cross-continental calls, video stages, and real-time messaging:
          </p>
        </div>

        {/* Personas to open */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Open a second window as:</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => openTestTab('elie')}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-slate-800/60 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="/src/assets/images/avatar_elie_1790670827487.jpg"
                  alt="Elie"
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <div className="text-xs font-semibold text-white">Elie Manirakiza</div>
                  <div className="text-[10px] text-slate-400">🇷🇼 Kigali, Rwanda (Host)</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
            </button>

            <button
              onClick={() => openTestTab('lead')}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-slate-800/60 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="/src/assets/images/avatar_tech_lead_1790668646558.jpg"
                  alt="Elena"
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <div className="text-xs font-semibold text-white">Elena Rostova</div>
                  <div className="text-[10px] text-slate-400">🇩🇪 Berlin, Germany</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
            </button>

            <button
              onClick={() => openTestTab('designer')}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-slate-800/60 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="/src/assets/images/avatar_designer_1790668663121.jpg"
                  alt="Marcus"
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <div className="text-xs font-semibold text-white">Marcus Vance</div>
                  <div className="text-[10px] text-slate-400">🇺🇸 New York, USA</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
            </button>

            <button
              onClick={() => openTestTab('tokyo')}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-slate-800/60 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="/src/assets/images/avatar_developer_1790668686679.jpg"
                  alt="Kenji"
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <div className="text-xs font-semibold text-white">Kenji Sato</div>
                  <div className="text-[10px] text-slate-400">🇯🇵 Tokyo, Japan</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
            </button>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs space-y-2 text-slate-300">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Cross-World Features:</span>
          </div>
          <ul className="space-y-1.5 text-slate-400 text-[11px] list-disc list-inside">
            <li><strong className="text-slate-200">World Map & Clocks:</strong> View live pins of everyone connected around the globe with their local time zones and distances.</li>
            <li><strong className="text-slate-200">1-on-1 Across Continents:</strong> Ring Elie in Kigali from New York or Berlin with HD audio and video.</li>
            <li><strong className="text-slate-200">24/7 World Video Stage:</strong> Multi-user group video room connecting different time zones concurrently.</li>
            <li><strong className="text-slate-200">Voice Notes & Rich Media:</strong> Record voice clips with waveforms and exchange attachments.</li>
          </ul>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors"
          >
            Explore World Chat
          </button>
        </div>
      </div>
    </div>
  );
};
