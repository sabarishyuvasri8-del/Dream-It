import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, CheckCircle2, RefreshCw } from 'lucide-react';
import { subscribeNetworkStatus } from '../../lib/pwa';

interface OfflineSyncIndicatorProps {
  onSync: () => Promise<void> | void;
  isSaving?: boolean;
}

export function OfflineSyncIndicator({ onSync, isSaving }: OfflineSyncIndicatorProps) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((online) => {
      setIsOnline(online);

      if (online && wasOffline.current) {
        // Just came back online!
        setJustReconnected(true);
        onSync();

        const timer = setTimeout(() => {
          setJustReconnected(false);
        }, 4000);
        return () => clearTimeout(timer);
      }

      if (!online) {
        wasOffline.current = true;
      }
    });

    return () => unsubscribe();
  }, [onSync]);

  if (isOnline && !justReconnected) {
    return null;
  }

  return (
    <div className="flex items-center">
      {justReconnected ? (
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-sm transition-all duration-300 animate-in fade-in"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
            color: '#10b981'
          }}
        >
          <CheckCircle2 size={12} className="animate-bounce" />
          <span>Synced to Supabase</span>
        </div>
      ) : (
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-sm transition-all duration-300 animate-pulse"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            color: '#f59e0b'
          }}
          title="You are offline. Note edits and Pomodoro focus minutes are saved locally in your browser and will automatically sync to Supabase when you reconnect."
        >
          <WifiOff size={12} />
          <span>Offline Mode (Auto-Saved)</span>
          {isSaving && <RefreshCw size={10} className="animate-spin ml-1" />}
        </div>
      )}
    </div>
  );
}
