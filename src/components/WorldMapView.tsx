import React, { useState, useEffect } from 'react';
import { 
  Globe2, 
  Phone, 
  Video, 
  MessageSquare, 
  Clock, 
  MapPin, 
  Compass, 
  Radio, 
  Users, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { User, Room } from '../types';

interface WorldMapViewProps {
  currentUser: User;
  users: User[];
  onStartCall: (targetUser: User, type: 'audio' | 'video') => void;
  onSelectDirectUser: (userId: string) => void;
  onJoinRoomCall: (room: Room) => void;
  worldStageRoom?: Room;
}

interface WorldLocationPoint {
  id: string;
  name: string;
  city: string;
  country: string;
  flag: string;
  timezone: string;
  lat: number;
  lng: number;
  user?: User;
}

const GLOBAL_HUBS: WorldLocationPoint[] = [
  {
    id: 'kigali',
    name: 'Elie Manirakiza (Host)',
    city: 'Kigali',
    country: 'Rwanda',
    flag: '🇷🇼',
    timezone: 'Africa/Kigali',
    lat: -1.9441,
    lng: 30.0619,
  },
  {
    id: 'berlin',
    name: 'Elena Rostova',
    city: 'Berlin',
    country: 'Germany',
    flag: '🇩🇪',
    timezone: 'Europe/Berlin',
    lat: 52.5200,
    lng: 13.4050,
  },
  {
    id: 'nyc',
    name: 'Marcus Vance',
    city: 'New York',
    country: 'United States',
    flag: '🇺🇸',
    timezone: 'America/New_York',
    lat: 40.7128,
    lng: -74.0060,
  },
  {
    id: 'tokyo',
    name: 'Kenji Sato',
    city: 'Tokyo',
    country: 'Japan',
    flag: '🇯🇵',
    timezone: 'Asia/Tokyo',
    lat: 35.6762,
    lng: 139.6503,
  },
  {
    id: 'london',
    name: 'Sophie Clark',
    city: 'London',
    country: 'United Kingdom',
    flag: '🇬🇧',
    timezone: 'Europe/London',
    lat: 51.5074,
    lng: -0.1278,
  },
  {
    id: 'dubai',
    name: 'Aaliyah Al-Maktoum',
    city: 'Dubai',
    country: 'United Arab Emirates',
    flag: '🇦🇪',
    timezone: 'Asia/Dubai',
    lat: 25.2048,
    lng: 55.2708,
  },
  {
    id: 'saopaulo',
    name: 'Lucas Silva',
    city: 'São Paulo',
    country: 'Brazil',
    flag: '🇧🇷',
    timezone: 'America/Sao_Paulo',
    lat: -23.5505,
    lng: -46.6333,
  }
];

// Calculate approximate great-circle distance between two coordinates in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Convert Lat/Lng to percentage coordinates on an equirectangular world map
function projectCoordinates(lat: number, lng: number) {
  const x = ((lng + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { x: Math.max(5, Math.min(95, x)), y: Math.max(8, Math.min(92, y)) };
}

export const WorldMapView: React.FC<WorldMapViewProps> = ({
  currentUser,
  users,
  onStartCall,
  onSelectDirectUser,
  onJoinRoomCall,
  worldStageRoom,
}) => {
  const [selectedHub, setSelectedHub] = useState<WorldLocationPoint>(GLOBAL_HUBS[0]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clocks every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getLocalTime = (tz: string) => {
    try {
      return currentTime.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return currentTime.toLocaleTimeString();
    }
  };

  const userLat = currentUser.location?.lat ?? -1.9441;
  const userLng = currentUser.location?.lng ?? 30.0619;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden select-none">
      {/* World Map Header & Live World Time Ribbon */}
      <div className="border-b border-slate-800 bg-slate-900/80 px-4 md:px-6 py-3 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">
              Elie Chat · Global Connect
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30">
              Worldwide Mesh
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time peer-to-peer connection bridging communities across Africa, Europe, Americas & Asia.
          </p>
        </div>

        {/* Global Video Stage Join CTA */}
        {worldStageRoom && (
          <button
            onClick={() => onJoinRoomCall(worldStageRoom)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-500/20 transition-all self-start md:self-auto"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-300" />
            <span>Join 24/7 World Video Stage</span>
          </button>
        )}
      </div>

      {/* World Timezones Ticker Bar */}
      <div className="border-b border-slate-800/80 bg-slate-950 px-4 md:px-6 py-2 overflow-x-auto flex items-center gap-4 text-xs shrink-0">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Clock className="w-3 h-3 text-blue-400" />
          World Clocks:
        </span>
        {GLOBAL_HUBS.map((hub) => (
          <div
            key={hub.id}
            onClick={() => setSelectedHub(hub)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer transition-colors shrink-0 ${
              selectedHub.id === hub.id
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span>{hub.flag}</span>
            <span className="font-medium">{hub.city}</span>
            <span className="font-mono text-[11px] text-blue-300 tabular-nums">
              {getLocalTime(hub.timezone)}
            </span>
          </div>
        ))}
      </div>

      {/* Main Interactive Map & Detail Hub */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 md:p-6 gap-4">
        {/* World Map Graphical Canvas */}
        <div className="flex-1 bg-slate-900/70 border border-slate-800 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-2xl p-4">
          {/* Subtle stylized world map SVG backdrop */}
          <div className="absolute inset-0 opacity-25 pointer-events-none flex items-center justify-center">
            <svg
              viewBox="0 0 1000 500"
              className="w-full h-full object-contain"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="0.75"
            >
              {/* Simplified World Coastlines */}
              {/* North & South America */}
              <path d="M150,80 Q200,60 250,90 T280,180 T260,260 T310,340 T320,440 T270,390 T230,280 T170,160 Z" />
              {/* Europe & Africa */}
              <path d="M480,90 Q530,70 560,110 T540,170 T570,260 T560,370 T510,430 T480,310 T460,200 T470,120 Z" />
              {/* Asia & Australia */}
              <path d="M600,80 Q750,70 850,120 T890,200 T780,260 T700,280 T800,370 T860,430 T750,420 T670,310 T580,180 Z" />
              {/* Latitude lines */}
              <line x1="0" y1="125" x2="1000" y2="125" stroke="#1e293b" strokeDasharray="4 4" />
              <line x1="0" y1="250" x2="1000" y2="250" stroke="#334155" strokeWidth="1" />
              <line x1="0" y1="375" x2="1000" y2="375" stroke="#1e293b" strokeDasharray="4 4" />
              {/* Longitude lines */}
              <line x1="250" y1="0" x2="250" y2="500" stroke="#1e293b" strokeDasharray="4 4" />
              <line x1="500" y1="0" x2="500" y2="500" stroke="#334155" strokeWidth="1" />
              <line x1="750" y1="0" x2="750" y2="500" stroke="#1e293b" strokeDasharray="4 4" />
            </svg>
          </div>

          {/* Interactive World Location Hub Pins */}
          <div className="absolute inset-0">
            {GLOBAL_HUBS.map((hub) => {
              const pos = projectCoordinates(hub.lat, hub.lng);
              const isSelected = selectedHub.id === hub.id;
              const isCurrentUserHub =
                (currentUser.location?.city || 'Kigali').toLowerCase() === hub.city.toLowerCase();

              return (
                <div
                  key={hub.id}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  onClick={() => setSelectedHub(hub)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                >
                  {/* Glowing Radar Pulse */}
                  <span
                    className={`absolute -inset-2 rounded-full animate-ping opacity-60 ${
                      isSelected ? 'bg-blue-400' : 'bg-emerald-400'
                    }`}
                  />
                  <div
                    className={`relative flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold shadow-lg transition-transform group-hover:scale-110 border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-500/50'
                        : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <span>{hub.flag}</span>
                    <span className="hidden sm:inline text-[11px] whitespace-nowrap">{hub.city}</span>
                    {isCurrentUserHub && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Map Overlay Footer Tag */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>Global Equirectangular Projection</span>
            </span>
            <span className="text-slate-500">Live WebRTC Mesh Routing</span>
          </div>
        </div>

        {/* Selected Location Card & Actions Drawer */}
        <div className="w-full lg:w-96 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedHub.flag}</span>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {selectedHub.city}, {selectedHub.country}
                  </h3>
                  <p className="text-xs text-slate-400">{selectedHub.name}</p>
                </div>
              </div>
            </div>

            {/* Key Location Metrics */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Local Time:
                </span>
                <span className="font-semibold text-white font-mono tabular-nums">
                  {getLocalTime(selectedHub.timezone)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  Distance from you:
                </span>
                <span className="font-semibold text-white font-mono tabular-nums">
                  {calculateDistance(userLat, userLng, selectedHub.lat, selectedHub.lng).toLocaleString()}{' '}
                  km
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-purple-400" />
                  Connection Mode:
                </span>
                <span className="font-medium text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  P2P Encrypted Audio/Video
                </span>
              </div>
            </div>

            {/* Hub description */}
            <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              {selectedHub.id === 'kigali' && (
                <p>
                  🇷🇼 <strong>Kigali Hub:</strong> Founded by Elie Manirakiza. The central heartbeat of Elie Chat connecting Rwanda, East Africa, and innovators worldwide with zero latency.
                </p>
              )}
              {selectedHub.id === 'berlin' && (
                <p>
                  🇩🇪 <strong>Berlin Hub:</strong> Led by Elena Rostova. European engineering center powering real-time WebRTC mesh bridges across borders.
                </p>
              )}
              {selectedHub.id === 'nyc' && (
                <p>
                  🇺🇸 <strong>New York Hub:</strong> Led by Marcus Vance. Bridging North American designers, creators, and engineers with Africa and Europe.
                </p>
              )}
              {selectedHub.id === 'tokyo' && (
                <p>
                  🇯🇵 <strong>Tokyo Hub:</strong> Bridging East Asia and Pacific time zones for 24/7 global collaboration and cultural exchange.
                </p>
              )}
              {selectedHub.id !== 'kigali' && selectedHub.id !== 'berlin' && selectedHub.id !== 'nyc' && selectedHub.id !== 'tokyo' && (
                <p>
                  Active worldwide node connecting people and teams with live voice and video.
                </p>
              )}
            </div>
          </div>

          {/* Action CTAs: Direct Voice Call / Video Call / Message */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const targetUser = users.find((u) => u.name.toLowerCase().includes(selectedHub.name.split(' ')[0].toLowerCase())) || {
                    id: `user-${selectedHub.id}`,
                    name: selectedHub.name,
                    avatar: '',
                    status: 'online',
                    lastActive: Date.now(),
                  };
                  onStartCall(targetUser, 'audio');
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Voice Call</span>
              </button>

              <button
                onClick={() => {
                  const targetUser = users.find((u) => u.name.toLowerCase().includes(selectedHub.name.split(' ')[0].toLowerCase())) || {
                    id: `user-${selectedHub.id}`,
                    name: selectedHub.name,
                    avatar: '',
                    status: 'online',
                    lastActive: Date.now(),
                  };
                  onStartCall(targetUser, 'video');
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/30 transition-colors"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video Call</span>
              </button>
            </div>

            <button
              onClick={() => {
                const targetUser = users.find((u) => u.name.toLowerCase().includes(selectedHub.name.split(' ')[0].toLowerCase()));
                if (targetUser) {
                  onSelectDirectUser(targetUser.id);
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>Open Direct Chat with {selectedHub.name.split(' ')[0]}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
