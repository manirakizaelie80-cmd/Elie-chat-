import React from 'react';
import { 
  Bell, 
  Check, 
  X, 
  Users, 
  MessageSquare, 
  UserCheck, 
  UserX, 
  Clock, 
  CheckCheck 
} from 'lucide-react';
import { InAppNotification } from '../types';
import { markNotificationAsRead, markAllNotificationsAsRead } from '../utils/notificationSync';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: InAppNotification[];
  currentUserId: string;
  onSelectNotification: (notif: InAppNotification) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  notifications,
  currentUserId,
  onSelectNotification,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleItemClick = (notif: InAppNotification) => {
    if (!notif.read) {
      markNotificationAsRead(notif.id).catch(console.error);
    }
    onSelectNotification(notif);
    onClose();
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead(currentUserId).catch(console.error);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-transparent" 
        onClick={onClose} 
      />

      <div className="absolute right-2 top-14 mt-1 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-400" />
            <h4 className="text-xs font-semibold text-white">Notifications</h4>
            {unreadCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <Bell className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
              <p className="font-medium text-slate-400">No notifications yet</p>
              <p className="text-[11px] mt-0.5">You will receive alerts here for messages, invitations, and group requests.</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const time = new Date(notif.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3 hover:bg-slate-800/60 cursor-pointer transition-colors flex items-start gap-3 ${
                    !notif.read ? 'bg-blue-950/20' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                    {notif.type === 'invitation' && <Users className="w-4 h-4 text-purple-400" />}
                    {notif.type === 'join_request' && <Clock className="w-4 h-4 text-amber-400" />}
                    {notif.type === 'request_approved' && <UserCheck className="w-4 h-4 text-emerald-400" />}
                    {notif.type === 'request_rejected' && <UserX className="w-4 h-4 text-red-400" />}
                    {notif.type === 'message' && <MessageSquare className="w-4 h-4 text-blue-400" />}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                        {time}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-snug line-clamp-2">
                      {notif.message}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
