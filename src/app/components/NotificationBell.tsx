import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  collection, query, where, orderBy, limit,
  onSnapshot, updateDoc, doc, writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Bell } from 'lucide-react';

interface NotificationDoc {
  id: string;
  studentId: string;
  uid: string;
  type: 'risk_alert' | 'appointment' | 'intervention' | 'mentor';
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
}

interface NotificationBellProps {
  /** 'up' opens the panel above the bell (for sidebar footer); 'down' opens below (for top header) */
  position?: 'up' | 'down';
}

const TYPE_ICON: Record<string, string> = {
  risk_alert:   '⚠️',
  appointment:  '📅',
  intervention: '📋',
  mentor:       '👨‍🏫',
};

function timeAgo(ts: any): string {
  if (!ts?.toDate) return 'just now';
  const diff = Date.now() - ts.toDate().getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function NotificationBell({ position = 'down' }: NotificationBellProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Real-time listener — only for student role
  useEffect(() => {
    if (user?.role !== 'student' || !user?.id) return;
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(10),
    );
    return onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationDoc)));
    });
  }, [user?.id, user?.role]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (user?.role !== 'student') return null;

  const unread = notifications.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const markAllRead = async () => {
    const batch = writeBatch(db);
    notifications.filter((n) => !n.read).forEach((n) => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const panelClass = position === 'up'
    ? 'absolute left-full bottom-0 ml-2'
    : 'absolute right-0 top-full mt-2';

  return (
    <div className="relative flex-shrink-0" ref={wrapperRef}>
      {/* Bell button */}
      <button
        onClick={() => {
          if (user?.role === 'student') navigate('/student/alerts');
          else setOpen((o) => !o);
        }}
        className="relative h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={`${panelClass} w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <p className="text-sm font-semibold text-gray-800">Notifications</p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.read) markRead(n.id); }}
                  className={`px-4 py-3 flex gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !n.read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <span className="text-base flex-shrink-0 mt-0.5 leading-none">
                    {TYPE_ICON[n.type] ?? '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate text-gray-800">{n.title}</p>
                      {!n.read && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
