import React, { useState } from 'react';
import { X, Check, MapPin, LogIn, LogOut, Copy, UserCheck, Sparkles, RefreshCw } from 'lucide-react';
import { User, UserLocation } from '../types';
import { loginWithGoogle, logoutUser } from '../utils/auth';

interface UserProfileModalProps {
  currentUser: User;
  onClose: () => void;
  onSave: (updates: { 
    name: string; 
    avatar: string; 
    status: 'online' | 'away' | 'busy' | 'offline'; 
    customStatus: string;
    location?: UserLocation;
  }) => void;
  onSwitchPersona?: (personaKey: string) => void;
}

const PRESET_AVATARS = [
  { id: 'elie', label: 'Elie (Founder)', url: '/src/assets/images/avatar_elie_1790670827487.jpg' },
  { id: 'lead', label: 'Elena (Tech Lead)', url: '/src/assets/images/avatar_tech_lead_1790668646558.jpg' },
  { id: 'designer', label: 'Marcus (Product Designer)', url: '/src/assets/images/avatar_designer_1790668663121.jpg' },
  { id: 'dev', label: 'Kenji (Architect)', url: '/src/assets/images/avatar_developer_1790668686679.jpg' },
];

const PRESET_LOCATIONS: UserLocation[] = [
  { city: 'Kigali', country: 'Rwanda', flag: '🇷🇼', timezone: 'Africa/Kigali', lat: -1.9441, lng: 30.0619 },
  { city: 'Berlin', country: 'Germany', flag: '🇩🇪', timezone: 'Europe/Berlin', lat: 52.5200, lng: 13.4050 },
  { city: 'New York', country: 'United States', flag: '🇺🇸', timezone: 'America/New_York', lat: 40.7128, lng: -74.0060 },
  { city: 'Tokyo', country: 'Japan', flag: '🇯🇵', timezone: 'Asia/Tokyo', lat: 35.6762, lng: 139.6503 },
  { city: 'London', country: 'United Kingdom', flag: '🇬🇧', timezone: 'Europe/London', lat: 51.5074, lng: -0.1278 },
  { city: 'Dubai', country: 'UAE', flag: '🇦🇪', timezone: 'Asia/Dubai', lat: 25.2048, lng: 55.2708 },
  { city: 'São Paulo', country: 'Brazil', flag: '🇧🇷', timezone: 'America/Sao_Paulo', lat: -23.5505, lng: -46.6333 },
  { city: 'Nairobi', country: 'Kenya', flag: '🇰🇪', timezone: 'Africa/Nairobi', lat: -1.2921, lng: 36.8219 },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  currentUser,
  onClose,
  onSave,
  onSwitchPersona,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [status, setStatus] = useState<'online' | 'away' | 'busy'>(
    currentUser.status === 'in-call' ? 'online' : (currentUser.status === 'offline' ? 'online' : currentUser.status)
  );
  const [customStatus, setCustomStatus] = useState(currentUser.customStatus || '');
  const [selectedLocation, setSelectedLocation] = useState<UserLocation>(
    currentUser.location || PRESET_LOCATIONS[0]
  );
  const [copiedId, setCopiedId] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      avatar,
      status,
      customStatus: customStatus.trim(),
      location: selectedLocation,
    });
    onClose();
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsAuthLoading(true);
      setAuthError(null);
      const user = await loginWithGoogle();
      if (user) {
        if (user.displayName) setName(user.displayName);
        if (user.photoURL) setAvatar(user.photoURL);
        onSave({
          name: user.displayName || name,
          avatar: user.photoURL || avatar,
          status: 'online',
          customStatus: customStatus || '⚡ Connected via Google Auth',
          location: selectedLocation,
        });
      }
    } catch (e: any) {
      setAuthError(e.message || 'Google Sign-In failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      onSave({
        name,
        avatar,
        status: 'offline',
        customStatus: 'Logged out',
        location: selectedLocation,
      });
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentUser.id).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative my-8 space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            User Account & Profile
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your authenticated identity, worldwide presence, and profile details.
          </p>
        </div>

        {/* Firebase Authentication Card */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Firebase Account:</span>
            {currentUser.email ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1 truncate max-w-[200px]">
                <UserCheck className="w-3.5 h-3.5" />
                <span className="truncate">{currentUser.email}</span>
              </span>
            ) : (
              <span className="text-slate-400 font-medium">Guest / Profile Mode</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
              <span className="font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 truncate">
                ID: {currentUser.id.substring(0, 16)}...
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                title="Copy User ID"
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {currentUser.email ? (
              <button
                type="button"
                onClick={handleLogout}
                className="px-2.5 py-1 text-xs text-red-400 hover:bg-red-950/40 border border-red-900/50 rounded-lg flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isAuthLoading}
                className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-600" />
                <span>{isAuthLoading ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>

          {authError && (
            <p className="text-[11px] text-red-400">{authError}</p>
          )}
        </div>

        {/* Form for Profile Updates */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Avatar</label>
            <div className="flex items-center gap-3">
              {PRESET_AVATARS.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setAvatar(p.url)}
                  className={`relative cursor-pointer rounded-full p-0.5 border-2 transition-transform hover:scale-105 ${
                    avatar === p.url ? 'border-blue-500 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  title={p.label}
                >
                  <img
                    src={p.url}
                    alt={p.label}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  {avatar === p.url && (
                    <div className="absolute inset-0 bg-blue-500/20 rounded-full flex items-center justify-center text-white">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Elie Manirakiza"
              required
              maxLength={80}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Custom Status Message */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Custom Tagline / Status</label>
            <input
              type="text"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="e.g. 🌍 Connecting from Kigali · Tech Enthusiast"
              maxLength={120}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Availability Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Presence Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(['online', 'away', 'busy'] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-colors flex items-center justify-center gap-2 ${
                    status === s
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      s === 'online' ? 'bg-emerald-500' : s === 'away' ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                  />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>

          {/* World Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span>Location Coordinates</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-950 rounded-xl border border-slate-800">
              {PRESET_LOCATIONS.map((loc) => {
                const isSelected = selectedLocation.city === loc.city;
                return (
                  <button
                    type="button"
                    key={loc.city}
                    onClick={() => setSelectedLocation(loc)}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs transition-colors text-left ${
                      isSelected
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span>{loc.flag}</span>
                    <span className="truncate">{loc.city}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Persona Switcher Quick Test */}
          {onSwitchPersona && (
            <div className="pt-2 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Quick Test Personas (Multi-device / tabs):</span>
                <span className="text-[10px] text-blue-400">Instant switch</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => onSwitchPersona('elie')}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-slate-300 flex items-center gap-1.5 truncate"
                >
                  <span>🇷🇼</span>
                  <span className="truncate">Elie (Kigali)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchPersona('designer')}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-slate-300 flex items-center gap-1.5 truncate"
                >
                  <span>🇺🇸</span>
                  <span className="truncate">Marcus (New York)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchPersona('lead')}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-slate-300 flex items-center gap-1.5 truncate"
                >
                  <span>🇩🇪</span>
                  <span className="truncate">Elena (Berlin)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchPersona('tokyo')}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-slate-300 flex items-center gap-1.5 truncate"
                >
                  <span>🇯🇵</span>
                  <span className="truncate">Kenji (Tokyo)</span>
                </button>
              </div>
            </div>
          )}

          {/* Submit */}
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
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
