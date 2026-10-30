import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  MapPin, 
  LogIn, 
  LogOut, 
  Copy, 
  UserCheck, 
  Sparkles, 
  AtSign, 
  CheckCheck,
  UserPlus,
  Loader2,
  Camera,
  Upload,
  Trash2,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { User, UserLocation } from '../types';
import { loginWithGoogle, logoutUser, checkUsernameAvailable, validateUsername } from '../utils/auth';
import { 
  validateImageFile, 
  removeUserProfilePhoto, 
  DEFAULT_AVATAR 
} from '../utils/photoUpload';
import { ProfilePhotoCropperModal } from './ProfilePhotoCropperModal';

interface UserProfileModalProps {
  currentUser: User;
  onClose: () => void;
  onSave: (updates: { 
    name: string; 
    username?: string;
    avatar: string; 
    status: 'online' | 'away' | 'busy' | 'offline'; 
    customStatus: string;
    readReceiptsEnabled?: boolean;
    location?: UserLocation;
  }) => void;
  onSwitchPersona?: (personaKey: string) => void;
  onOpenAuthModal?: () => void;
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
  onOpenAuthModal,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [username, setUsername] = useState(currentUser.username || '');
  const [avatar, setAvatar] = useState(currentUser.avatar || DEFAULT_AVATAR);
  const [status, setStatus] = useState<'online' | 'away' | 'busy' | 'offline'>(
    currentUser.status === 'in-call' ? 'online' : (currentUser.status === 'offline' ? 'online' : currentUser.status)
  );
  const [customStatus, setCustomStatus] = useState(currentUser.customStatus || '');
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(
    currentUser.readReceiptsEnabled !== false
  );
  const [selectedLocation, setSelectedLocation] = useState<UserLocation>(
    currentUser.location || PRESET_LOCATIONS[0]
  );
  const [copiedId, setCopiedId] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Photo Upload & Preview State
  // Photo Upload & Interactive Cropper State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Username availability check
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{ available: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!username.trim() || username.trim() === currentUser.username) {
      setUsernameStatus(null);
      return;
    }

    const { valid, error } = validateUsername(username);
    if (!valid) {
      setUsernameStatus({ available: false, message: error || 'Invalid username' });
      return;
    }

    setUsernameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(username);
        setUsernameStatus({
          available,
          message: available ? `@${username} is available` : `@${username} is already taken`,
        });
      } catch {
        setUsernameStatus(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [username, currentUser.username]);

  // Handle image file selection (Gallery / File picker / Camera)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoMessage(null);

    // Validate image format and 5MB size limit
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setPhotoMessage({ text: validation.error || 'Invalid image file.', type: 'error' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Open interactive crop & reposition modal immediately
    setCropperFile(file);
    setIsCropperOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Callback when interactive crop upload completes
  const handleCropperSuccess = (newAvatarUrl: string) => {
    setAvatar(newAvatarUrl);
    setPhotoMessage({
      text: 'Profile photo uploaded and updated successfully in high resolution!',
      type: 'success',
    });

    // Synchronize immediately to active session
    onSave({
      name: name.trim(),
      username: username.trim() || undefined,
      avatar: newAvatarUrl,
      status,
      customStatus: customStatus.trim(),
      readReceiptsEnabled,
      location: selectedLocation,
    });
  };

  // Remove photo (revert to clean default avatar)
  const handleRemovePhoto = async () => {
    setIsRemovingPhoto(true);
    setPhotoMessage(null);
    try {
      const defaultUrl = await removeUserProfilePhoto(currentUser.id);
      setAvatar(defaultUrl);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setPhotoMessage({
        text: 'Profile photo removed. Reverted to default avatar.',
        type: 'success',
      });

      onSave({
        name: name.trim(),
        username: username.trim() || undefined,
        avatar: defaultUrl,
        status,
        customStatus: customStatus.trim(),
        readReceiptsEnabled,
        location: selectedLocation,
      });
    } catch (err: any) {
      setPhotoMessage({
        text: err.message || 'Failed to remove photo.',
        type: 'error',
      });
    } finally {
      setIsRemovingPhoto(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (usernameStatus && !usernameStatus.available) {
      setAuthError('Please choose an available username before saving.');
      return;
    }

    onSave({
      name: name.trim(),
      username: username.trim() || undefined,
      avatar,
      status,
      customStatus: customStatus.trim(),
      readReceiptsEnabled,
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
          username: username.trim() || undefined,
          avatar: user.photoURL || avatar,
          status: 'online',
          customStatus: customStatus || '⚡ Connected via Google Auth',
          readReceiptsEnabled,
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
        username,
        avatar,
        status: 'offline',
        customStatus: 'Logged out',
        readReceiptsEnabled,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative my-auto space-y-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            Edit Profile & Photo
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload your custom profile photo, customize your identity, username, and real-time presence.
          </p>
        </div>

        {/* Notifications / Feedback Banner */}
        {photoMessage && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 shrink-0 ${
            photoMessage.type === 'success' 
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}>
            {photoMessage.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{photoMessage.text}</span>
          </div>
        )}

        {/* SECTION 1: PROFILE PHOTO UPLOAD & MANAGEMENT */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              <span>Profile Photo</span>
            </label>
            <span className="text-[10px] text-slate-400">JPG, PNG, WebP · Max 5MB</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Avatar Preview Box */}
            <div className="relative shrink-0">
              <img
                src={avatar}
                alt="Profile Avatar"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-700 shadow-md transition-all"
              />
              <span
                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                  status === 'online' ? 'bg-emerald-500' : status === 'away' ? 'bg-amber-500' : 'bg-red-500'
                }`}
              />
            </div>

            {/* Upload Buttons & Options */}
            <div className="flex-1 space-y-2 text-center sm:text-left w-full">
              {/* Hidden file input supporting gallery, files, and camera capture */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRemovingPhoto}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{avatar !== DEFAULT_AVATAR ? 'Change / Re-Crop Photo' : 'Upload Profile Photo'}</span>
                </button>

                {avatar !== DEFAULT_AVATAR && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isRemovingPhoto}
                    className="px-2.5 py-1.5 border border-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                    title="Remove custom photo and reset to default"
                  >
                    {isRemovingPhoto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                High-definition WebP & JPEG with aspect-ratio preservation. You can reposition and zoom before saving.
              </p>
            </div>
          </div>

          {/* Quick Preset Avatars Alternative */}
          <div className="pt-2 border-t border-slate-800/80">
            <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Or choose a team persona:</label>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {PRESET_AVATARS.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setAvatar(p.url);
                  }}
                  className={`relative cursor-pointer rounded-full p-0.5 border-2 transition-transform hover:scale-105 shrink-0 ${
                    avatar === p.url ? 'border-blue-500 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  title={p.label}
                >
                  <img
                    src={p.url}
                    alt={p.label}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  {avatar === p.url && (
                    <div className="absolute inset-0 bg-blue-500/20 rounded-full flex items-center justify-center text-white">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Authentication Card */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Account Status:</span>
            {currentUser.email ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1 truncate max-w-[200px]">
                <UserCheck className="w-3.5 h-3.5" />
                <span className="truncate">{currentUser.email}</span>
              </span>
            ) : (
              <span className="text-slate-400 font-medium">Session Active</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
              <span className="font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 truncate">
                UID: {currentUser.id.substring(0, 14)}...
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

            <div className="flex items-center gap-1.5">
              {onOpenAuthModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuthModal();
                  }}
                  className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-1 transition-colors font-medium shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register / Sign In</span>
                </button>
              )}

              {currentUser.email ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2 py-1 text-xs text-red-400 hover:bg-red-950/40 border border-red-900/50 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isAuthLoading}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs rounded-lg flex items-center gap-1 shadow transition-colors"
                >
                  <LogIn className="w-3 h-3 text-blue-600" />
                  <span>Google</span>
                </button>
              )}
            </div>
          </div>

          {authError && (
            <p className="text-[11px] text-red-400">{authError}</p>
          )}
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 overflow-y-auto pr-1 flex-1">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Elie Manirakiza"
              required
              maxLength={80}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Unique Username */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">Unique Username</label>
              {usernameChecking && (
                <span className="text-[10px] text-blue-400 flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> checking
                </span>
              )}
              {usernameStatus && (
                <span className={`text-[10px] font-medium ${usernameStatus.available ? 'text-emerald-400' : 'text-red-400'}`}>
                  {usernameStatus.message}
                </span>
              )}
            </div>
            <div className="relative">
              <AtSign className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, ''))}
                placeholder="e.g. elie_kigali"
                maxLength={30}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Custom Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Status Message / Tagline</label>
            <input
              type="text"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="e.g. 🌍 Building Elie Chat · Kigali, Rwanda"
              maxLength={120}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Presence Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Presence Status</label>
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

          {/* Read Receipts Privacy Setting */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-xs font-medium text-slate-200">Send Read Receipts</span>
                <p className="text-[10px] text-slate-500">Show double-check status when you read messages</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={readReceiptsEnabled}
              onChange={(e) => setReadReceiptsEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
            />
          </div>

          {/* Location Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span>World Location (for Map Tab)</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-950 rounded-xl border border-slate-800">
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

          {/* Multi-Persona Switcher for Testing */}
          {onSwitchPersona && (
            <div className="pt-2 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
                <span>Multi-Account Testing Personas:</span>
                <span className="text-[10px] text-blue-400">1-click switch</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => onSwitchPersona('elie')}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-slate-300 flex items-center gap-1.5 truncate"
                >
                  <span>🇷🇼</span>
                  <span className="truncate">Elie (Founder)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchPersona('designer')}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-slate-300 flex items-center gap-1.5 truncate"
                >
                  <span>🇺🇸</span>
                  <span className="truncate">Marcus (Designer)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchPersona('lead')}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-slate-300 flex items-center gap-1.5 truncate"
                >
                  <span>🇩🇪</span>
                  <span className="truncate">Elena (Lead)</span>
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
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-colors shadow-md shadow-blue-500/20"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Interactive Photo Cropper & Repositioner */}
      <ProfilePhotoCropperModal
        isOpen={isCropperOpen}
        file={cropperFile}
        userId={currentUser.id}
        onClose={() => {
          setIsCropperOpen(false);
          setCropperFile(null);
        }}
        onUploadSuccess={handleCropperSuccess}
      />
    </div>
  );
};
