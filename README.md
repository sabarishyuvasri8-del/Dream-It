# Dream It — The Student Life Operating System & AI Study Companion

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database_%26_Realtime-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Clerk](https://img.shields.io/badge/Clerk-Authentication-6C47FF?logo=clerk&logoColor=white)](https://clerk.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-iOS_Ready-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)

> **Dream It** is an all-in-one personal study workstation, focus tracker, finance manager, and collaborative AI study companion built for modern students. Designed offline-first, private-by-default, and packed with high-productivity tools.

---

## Key Features

### 1. Focus & Study Station
* **Smart Pomodoro & Focus Timers:** Customizable work and break intervals with ambient study soundscapes (binaural beats, rain, café ambience).
* **Live Habit & Streak Tracking:** Visual progress metrics, daily consistency streaks, and task management.
* **Snap & Solve:** Quick capture and solution breakdowns for difficult homework problems.

### 2. Markdown Notes & KaTeX Math
* **Rich Markdown Editing:** LaTeX math equation rendering via `KaTeX` (`remark-math` and `rehype-katex`).
* **Auto-Generated Flashcards:** Convert lecture notes into interactive flashcards with one click.
* **Topic-Based Organization:** Categorized notebook hierarchy with search and quick reference tags.

### 3. Spaced Repetition & Exam Simulator
* **Active Recall Flashcards:** 3D interactive flip cards with spaced repetition intervals.
* **Mock Exam Engine:** Generates practice exams, multiple-choice quizzes, timers, and automatic score breakdowns.

### 4. Student Finance & Budget Tracker
* **Cash Flow Analytics:** Track monthly income, study expenses, savings rate, and account balances.
* **Budget Allocations & Goals:** Set savings targets for textbooks, tech gear, or tuition.
* **Financial Simulator & Coaching:** Predictive balance forecasting based on current spending habits.

### 5. Cadence — AI Voice Study Companion
* **Voice-First Tutoring:** Real-time conversational AI tutor for quick concept explanations and memory retention checks.
* **Speech-to-Text Notes:** Convert spoken study summaries directly into structured notes.

### 6. Peer-to-Peer Study Rooms & Calling
* **Ultra-Low Latency WebRTC Calls:** Peer-to-peer 1-on-1 audio and video study sessions.
* **Audio Mixing & Screen Sharing:** Share lecture slides or code with synchronized screen audio and voice.
* **Interactive Reactions:** Floating emojis and in-call text chat powered by Supabase Realtime channels.

### 7. Parental Oversight Portal
* **Parent-Child Link:** Transparent study progress tracking without compromising student privacy.
* **Focus Analytics:** Weekly study hour distribution, subject engagement graphs, and completed milestones.

### 8. High-Performance Offline-First Engine
* **IndexedDB Local Engine:** Native browser offline storage (`dreamit_offline_db`) ensures zero interruptions during spotty Wi-Fi.
* **Automatic Mutation Queue:** Edits made offline are queued and seamlessly synchronized to Supabase the moment you reconnect.

---

## Technology Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + TypeScript | Component-driven UI architecture with strong type safety |
| **Build Tooling** | Vite 6 | Lightning-fast Hot Module Replacement (HMR) and optimized bundling |
| **Styling & Design** | Tailwind CSS 4 + Vanilla CSS | Modern responsive design with custom CSS theme tokens & dark mode |
| **Database & Cloud** | Supabase (PostgreSQL) | Managed cloud database with Row-Level Security (RLS) policies |
| **Realtime Signaling** | Supabase Realtime (WebSockets) | Live state updates, direct messaging, and WebRTC call signaling |
| **Peer-to-Peer Media** | WebRTC + Google STUN | Browser-native encrypted audio/video calling with Opus audio codec |
| **Authentication** | Clerk | Enterprise-grade user sign-in, MFA, and JWT session handling |
| **Local Offline Storage**| IndexedDB | High-capacity asynchronous local persistence via `offline-storage.ts` |
| **Math & Markdown** | KaTeX + React Markdown | High-speed rendering for scientific formulas and academic notes |
| **Data Visualization** | Recharts | Interactive financial and study time analytics charts |
| **Mobile Runtime** | Capacitor 8 | Native iOS build packaging and device API integration |

---

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│                   Dream It Client                      │
│            (React 18 + TypeScript + Vite)              │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
       [Direct Local Save]       [User Auth & Token]
                ▼                        ▼
┌──────────────────────────────┐   ┌───────────┐
│     IndexedDB Storage        │   │   Clerk   │
│    (dreamit_offline_db)      │   │   Auth    │
└───────────────┬──────────────┘   └─────┬─────┘
                │                        │
       [Offline Mutation Sync]    [Verified JWT]
                ▼                        ▼
┌────────────────────────────────────────────────────────┐
│                   Supabase Cloud                       │
│    ├── PostgreSQL (RLS Protected Tables)               │
│    └── Realtime Channels (WebSockets for Chat & Calls) │
└────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sabarishyuvasri8-del/Dream-It.git
   cd Dream-It
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your credentials:
   ```env
   VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Mobile (iOS) Build

Dream It is configured with **Capacitor** to run natively on iOS devices:

```bash
# Build web production assets
npm run build

# Sync assets to the iOS native project
npx cap sync ios

# Open the project in Xcode
npx cap open ios
```

---

## Project Structure

```
├── public/                 # Static assets and icons
├── src/
│   ├── app/
│   │   ├── cadence/        # AI audio tutor & speech recognition
│   │   ├── components/     # UI modals, command palette, study widgets
│   │   │   └── calls/      # WebRTC peer-to-peer audio/video calling hook
│   │   ├── exams/          # Practice exams, test grading, and analytics
│   │   ├── finance/        # Student expense tracker and finance dashboards
│   │   ├── flashcards/     # Spaced-repetition flashcards engine
│   │   ├── three/          # 3D interactive graphics and canvas models
│   │   ├── Dashboard.tsx   # Core study workstation view
│   │   ├── LandingPage.tsx # Public product landing showcase
│   │   ├── ParentDashboard.tsx # Parent oversight dashboard
│   │   └── routes.tsx      # Application routing & authentication guards
│   ├── components/         # Shared UI controls (buttons, inputs, uploads)
│   ├── lib/
│   │   ├── offline-storage.ts # IndexedDB engine & offline mutation queue
│   │   ├── store.ts        # Zustand global client state management
│   │   └── supabase.ts     # Supabase client, RLS queries, and sync logic
│   ├── styles/
│   │   └── theme.css       # Design tokens, color schemes, and themes
│   └── main.tsx            # Application entry point
├── capacitor.config.json   # Capacitor mobile configuration
├── package.json            # Project dependencies and build scripts
└── vite.config.ts          # Vite build pipeline and plugin setup
```

---

## Security & Privacy

* **Zero Training on Student Data:** Audio streams and private notes are never used for AI model training.
* **Row-Level Security (RLS):** All database operations in PostgreSQL are strictly partitioned by Clerk user IDs.
* **Encrypted Calls:** Audio and video calls travel directly peer-to-peer over DTLS/SRTP encryption.

---

## License

This project is licensed under the [MIT License](LICENSE).