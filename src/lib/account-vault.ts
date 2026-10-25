/**
 * src/lib/account-vault.ts
 * Device-local Multi-Account Manager running on top of Clerk Authentication.
 * Stores and manages multiple user accounts on this device so users can switch
 * between them seamlessly without requiring Clerk Pro multi-session features.
 */

export interface SavedAccount {
  id: string; // Clerk user ID
  identifier: string; // Username or primary email used to sign in
  name: string; // Full name or display username
  imageUrl?: string;
  lastActiveAt: number;
}

const STORAGE_KEY = "dreamit_saved_accounts_vault_v1";
const PENDING_SWITCH_KEY = "dreamit_pending_switch_account_v1";

/**
 * Retrieves all saved accounts remembered on this device.
 */
export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const accounts: SavedAccount[] = JSON.parse(raw);
    return Array.isArray(accounts)
      ? accounts.sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0))
      : [];
  } catch (err) {
    console.error("Failed to read saved accounts vault:", err);
    return [];
  }
}

/**
 * Adds or updates an account in the local vault.
 */
export function saveAccount(account: SavedAccount): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const existing = getSavedAccounts().filter((a) => a.id !== account.id);
    const updated = [
      {
        ...account,
        lastActiveAt: Date.now(),
      },
      ...existing,
    ].slice(0, 10); // Limit to 10 remembered accounts on device
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save account to vault:", err);
  }
}

/**
 * Removes an account from this device's remembered list.
 */
export function removeSavedAccount(id: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const updated = getSavedAccounts().filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to remove account from vault:", err);
  }
}

/**
 * Sets a pending account identifier for quick-switching.
 */
export function setPendingSwitchAccount(identifier: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(PENDING_SWITCH_KEY, identifier);
  } catch (err) {
    console.error("Failed to set pending switch account:", err);
  }
}

/**
 * Reads and clears any pending account switch identifier.
 */
export function popPendingSwitchAccount(): string | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const val = sessionStorage.getItem(PENDING_SWITCH_KEY);
    if (val) {
      sessionStorage.removeItem(PENDING_SWITCH_KEY);
      return val;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Reads the pending account switch identifier without clearing it.
 */
export function peekPendingSwitchAccount(): string | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    return sessionStorage.getItem(PENDING_SWITCH_KEY);
  } catch (err) {
    return null;
  }
}
