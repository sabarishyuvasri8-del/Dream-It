import { useState, useEffect } from "react";
import { X, UserPlus, LogOut, CheckCircle2, Trash2, ArrowRightLeft, User } from "lucide-react";
import { getSavedAccounts, removeSavedAccount, setPendingSwitchAccount, SavedAccount } from "../../lib/account-vault";

interface AccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserName: string;
  currentUserEmail?: string;
  currentUserImageUrl?: string;
  onSignOut: () => void;
}

export default function AccountSwitcherModal({
  isOpen,
  onClose,
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserImageUrl,
  onSignOut,
}: AccountSwitcherModalProps) {
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    if (isOpen) {
      setAccounts(getSavedAccounts());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const otherAccounts = accounts.filter((acc) => acc.id !== currentUserId);

  const handleSwitch = (account: SavedAccount) => {
    setPendingSwitchAccount(account.identifier);
    onClose();
    onSignOut();
  };

  const handleAddNewAccount = () => {
    setPendingSwitchAccount("__new__");
    onClose();
    onSignOut();
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeSavedAccount(id);
    setAccounts(getSavedAccounts());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl transition-all"
        style={{
          backgroundColor: "var(--m-surface-solid)",
          border: "1px solid var(--m-border)",
          color: "var(--m-text)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: "var(--m-border-light)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="size-8 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                color: "var(--m-primary)",
              }}
            >
              <ArrowRightLeft size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
                Switch Account
              </h2>
              <p className="text-[11px]" style={{ color: "var(--m-text-muted)" }}>
                Manage accounts saved on this device
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition hover:opacity-70 cursor-pointer"
            style={{ color: "var(--m-text-muted)" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Current Active Account */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--m-text-muted)" }}>
              Active Account
            </p>
            <div
              className="flex items-center justify-between p-3.5 rounded-2xl border"
              style={{
                backgroundColor: "color-mix(in srgb, var(--m-primary) 8%, transparent)",
                borderColor: "color-mix(in srgb, var(--m-primary) 30%, transparent)",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {currentUserImageUrl ? (
                  <img
                    src={currentUserImageUrl}
                    alt={currentUserName}
                    className="size-10 rounded-full object-cover shrink-0 ring-2 ring-[var(--m-primary)]"
                  />
                ) : (
                  <div
                    className="size-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{
                      backgroundColor: "var(--m-primary)",
                      color: "var(--m-primary-text)",
                    }}
                  >
                    {currentUserName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--m-text-heading)" }}>
                    {currentUserName}
                  </p>
                  {currentUserEmail && (
                    <p className="text-xs truncate" style={{ color: "var(--m-text-muted)" }}>
                      {currentUserEmail}
                    </p>
                  )}
                </div>
              </div>
              <span
                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--m-primary) 20%, transparent)",
                  color: "var(--m-primary)",
                }}
              >
                <CheckCircle2 size={13} />
                <span>Active</span>
              </span>
            </div>
          </div>

          {/* Other Saved Accounts */}
          {otherAccounts.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--m-text-muted)" }}>
                Other Saved Accounts ({otherAccounts.length})
              </p>
              <div className="space-y-2">
                {otherAccounts.map((account) => (
                  <div
                    key={account.id}
                    onClick={() => handleSwitch(account)}
                    className="group flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer hover:scale-[1.01]"
                    style={{
                      backgroundColor: "var(--m-surface)",
                      borderColor: "var(--m-border-light)",
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {account.imageUrl ? (
                        <img
                          src={account.imageUrl}
                          alt={account.name}
                          className="size-9 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="size-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                          style={{
                            backgroundColor: "var(--m-border)",
                            color: "var(--m-text)",
                          }}
                        >
                          {account.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: "var(--m-text-heading)" }}>
                          {account.name}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: "var(--m-text-muted)" }}>
                          @{account.identifier}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSwitch(account)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-90 cursor-pointer"
                        style={{
                          backgroundColor: "var(--m-primary)",
                          color: "var(--m-primary-text)",
                        }}
                      >
                        Switch
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRemove(e, account.id)}
                        className="p-1.5 rounded-xl text-red-500 hover:bg-red-500/10 transition opacity-60 hover:opacity-100 cursor-pointer"
                        title="Remove from this device"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action: Add Another Account */}
          <button
            type="button"
            onClick={handleAddNewAccount}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-dashed text-xs font-bold transition hover:opacity-80 cursor-pointer"
            style={{
              borderColor: "var(--m-border)",
              color: "var(--m-primary)",
              backgroundColor: "color-mix(in srgb, var(--m-primary) 5%, transparent)",
            }}
          >
            <UserPlus size={15} />
            <span>Add another account</span>
          </button>
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t flex items-center justify-between"
          style={{ borderColor: "var(--m-border-light)", backgroundColor: "var(--m-surface)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl hover:opacity-80 transition cursor-pointer"
            style={{ color: "var(--m-text-muted)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl text-red-500 hover:bg-red-500/10 transition cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign out active account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
