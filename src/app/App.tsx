import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "../lib/ThemeContext";
import { ClerkProvider } from "@clerk/clerk-react";

// Get Publishable Key from environment or fallback key for Clerk App app_3HuZRwtbZLLkRdVouzpjzVA04UJ
const PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  "pk_test_Y2xldmVyLWFscGFjYS01NC5jbGVyay5hY2NvdW50cy5kZXYk";

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </ClerkProvider>
  );
}
