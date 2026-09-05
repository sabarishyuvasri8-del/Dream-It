import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Sparkles, Share, PlusSquare } from 'lucide-react';
import { promptPWAInstall, subscribePWAInstall, isPWAInstalled, isIOS } from '../../lib/pwa';

const STORAGE_KEY_PWA_DISMISSED = 'dreamit_pwa_install_dismissed_until';

export function PWAInstallBanner() {
  const [canInstall, setCanInstall] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isAlreadyInstalled, setIsAlreadyInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed in standalone mode
    if (isPWAInstalled()) {
      setIsAlreadyInstalled(true);
      return;
    }

    // Check dismissal cooldown (7 days)
    const dismissedUntil = localStorage.getItem(STORAGE_KEY_PWA_DISMISSED);
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      setIsDismissed(true);
    } else {
      setIsDismissed(false);
    }

    const unsubscribe = subscribePWAInstall((installable) => {
      setCanInstall(installable);
    });

    return () => unsubscribe();
  }, []);

  const handleInstallClick = async () => {
    if (isIOS()) {
      setShowIOSModal(true);
      return;
    }

    setIsInstalling(true);
    try {
      const outcome = await promptPWAInstall();
      if (outcome === 'accepted') {
        setIsDismissed(true);
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // Suppress prompt for 7 days
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY_PWA_DISMISSED, String(Date.now() + sevenDaysMs));
  };

  // Do not render if installed or dismissed or cannot install (unless iOS where beforeinstallprompt doesn't fire)
  if (isAlreadyInstalled || isDismissed || (!canInstall && !isIOS())) {
    return null;
  }

  return (
    <>
      <div 
        className="fixed bottom-5 right-5 left-5 md:left-auto md:w-[420px] z-50 rounded-2xl p-4 shadow-2xl border backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--m-surface) 85%, transparent)',
          borderColor: 'color-mix(in srgb, var(--m-primary) 30%, var(--m-border))',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 20px -5px color-mix(in srgb, var(--m-primary) 20%, transparent)'
        }}
      >
        <div className="flex items-start gap-3.5">
          {/* App Logo */}
          <div className="relative shrink-0 mt-0.5">
            <img 
              src="/logo.png" 
              alt="Dream-It App" 
              className="size-11 rounded-xl shadow-md border"
              style={{ borderColor: 'var(--m-border)' }}
            />
            <div 
              className="absolute -bottom-1 -right-1 size-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
              style={{ backgroundColor: 'var(--m-primary)' }}
            >
              ★
            </div>
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--m-text-heading)' }}>
                Install Dream-It App
              </span>
              <span 
                className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: 'color-mix(in srgb, var(--m-primary) 15%, transparent)', color: 'var(--m-primary)' }}
              >
                PWA
              </span>
            </div>
            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--m-text-sub)' }}>
              Add to Home Screen for 1-tap offline note editing, Pomodoro timer & mock tests on your Phone or Chromebook.
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: 'var(--m-primary)', color: 'var(--m-primary-text)' }}
              >
                {isInstalling ? (
                  <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                <span>{isIOS() ? 'Add to Home Screen' : 'Install App'}</span>
              </button>

              <button
                onClick={handleDismiss}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium transition hover:bg-white/5"
                style={{ color: 'var(--m-text-muted)' }}
              >
                Not Now
              </button>
            </div>
          </div>

          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            aria-label="Close install banner"
            className="shrink-0 p-1.5 rounded-lg text-xs opacity-60 hover:opacity-100 transition hover:bg-white/10"
            style={{ color: 'var(--m-text-sub)' }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* iOS Manual Installation Guide Modal */}
      {showIOSModal && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowIOSModal(false)}
        >
          <div 
            className="w-full max-w-sm rounded-3xl p-6 border shadow-2xl space-y-4"
            style={{ backgroundColor: 'var(--m-surface)', borderColor: 'var(--m-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={18} style={{ color: 'var(--m-primary)' }} />
                <h3 className="font-bold text-sm" style={{ color: 'var(--m-text-heading)' }}>
                  Install on iOS Safari
                </h3>
              </div>
              <button 
                onClick={() => setShowIOSModal(false)} 
                className="p-1 rounded-lg opacity-60 hover:opacity-100"
                style={{ color: 'var(--m-text-sub)' }}
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--m-text-sub)' }}>
              Follow these two quick steps to install Dream-It as a full native app icon on your iPhone or iPad:
            </p>

            <div className="space-y-2.5 text-xs font-medium" style={{ color: 'var(--m-text)' }}>
              <div className="flex items-center gap-3 p-3 rounded-2xl border" style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)' }}>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                  <Share size={16} />
                </div>
                <span>1. Tap the <strong>Share</strong> button at the bottom of Safari.</span>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl border" style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)' }}>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                  <PlusSquare size={16} />
                </div>
                <span>2. Scroll down and select <strong>&apos;Add to Home Screen&apos;</strong>.</span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl font-bold text-xs shadow-md"
              style={{ backgroundColor: 'var(--m-primary)', color: 'var(--m-primary-text)' }}
            >
              Got It!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
