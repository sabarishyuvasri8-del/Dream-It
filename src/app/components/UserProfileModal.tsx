import React from "react";
import { UserProfile } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { X } from "lucide-react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 animate-in fade-in"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="relative w-full max-w-4xl max-h-full overflow-y-auto custom-scrollbar rounded-3xl"
        style={{ backgroundColor: "var(--m-bg)", border: "1px solid var(--m-border)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer"
          style={{ color: "var(--m-text)" }}
          aria-label="Close Profile"
        >
          <X size={20} />
        </button>
        <div className="p-6">
          <UserProfile
            appearance={{
              baseTheme: dark,
              variables: {
                colorPrimary: "var(--m-primary)",
                colorBackground: "var(--m-bg)",
                colorText: "var(--m-text)",
                colorTextSecondary: "var(--m-text-sub)",
                colorInputBackground: "var(--m-surface)",
                colorBorder: "var(--m-border)",
              },
              elements: {
                card: "shadow-none bg-transparent",
                navbar: "hidden md:block",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
