import { create } from 'zustand';
import { 
  Task, 
  NoteEntry, 
  Subject, 
  ScheduleItem, 
  GradeEntry, 
  Flashcard,
  Friendship,
  SharedNote
} from './supabase';

type Setter<T> = T | ((prev: T) => T);

interface AppState {
  tasks: Task[];
  setTasks: (updater: Setter<Task[]>) => void;
  
  notes: NoteEntry[];
  setNotes: (updater: Setter<NoteEntry[]>) => void;
  
  subjects: Subject[];
  setSubjects: (updater: Setter<Subject[]>) => void;
  
  scheduleItems: ScheduleItem[];
  setScheduleItems: (updater: Setter<ScheduleItem[]>) => void;
  
  grades: GradeEntry[];
  setGrades: (updater: Setter<GradeEntry[]>) => void;
  
  flashcards: Flashcard[];
  setFlashcards: (updater: Setter<Flashcard[]>) => void;
  
  friends: Friendship[];
  setFriends: (updater: Setter<Friendship[]>) => void;

  pendingFriendRequests: Friendship[];
  setPendingFriendRequests: (updater: Setter<Friendship[]>) => void;

  pendingShares: SharedNote[];
  setPendingShares: (updater: Setter<SharedNote[]>) => void;

  activeNote: NoteEntry | null;
  setActiveNote: (updater: Setter<NoteEntry | null>) => void;
  noteDraft: string;
  setNoteDraft: (updater: Setter<string>) => void;
  noteTitleDraft: string;
  setNoteTitleDraft: (updater: Setter<string>) => void;
  noteSubjectFilter: number | null;
  setNoteSubjectFilter: (updater: Setter<number | null>) => void;
  noteSubjectId: number;
  setNoteSubjectId: (updater: Setter<number>) => void;
  noteSearchQuery: string;
  setNoteSearchQuery: (updater: Setter<string>) => void;
  noteMode: "edit" | "preview";
  setNoteMode: (updater: Setter<"edit" | "preview">) => void;
  isSummarizingNote: boolean;
  setIsSummarizingNote: (updater: Setter<boolean>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tasks: [],
  setTasks: (updater) => set((state) => ({ 
    tasks: typeof updater === 'function' ? (updater as any)(state.tasks) : updater 
  })),
  
  notes: [],
  setNotes: (updater) => set((state) => ({ 
    notes: typeof updater === 'function' ? (updater as any)(state.notes) : updater 
  })),
  
  subjects: [],
  setSubjects: (updater) => set((state) => ({ 
    subjects: typeof updater === 'function' ? (updater as any)(state.subjects) : updater 
  })),
  
  scheduleItems: [],
  setScheduleItems: (updater) => set((state) => ({ 
    scheduleItems: typeof updater === 'function' ? (updater as any)(state.scheduleItems) : updater 
  })),
  
  grades: [],
  setGrades: (updater) => set((state) => ({ 
    grades: typeof updater === 'function' ? (updater as any)(state.grades) : updater 
  })),
  
  flashcards: [],
  setFlashcards: (updater) => set((state) => ({ 
    flashcards: typeof updater === 'function' ? (updater as any)(state.flashcards) : updater 
  })),
  
  friends: [],
  setFriends: (updater) => set((state) => ({ 
    friends: typeof updater === 'function' ? (updater as any)(state.friends) : updater 
  })),

  pendingFriendRequests: [],
  setPendingFriendRequests: (updater) => set((state) => ({ 
    pendingFriendRequests: typeof updater === 'function' ? (updater as any)(state.pendingFriendRequests) : updater 
  })),

  pendingShares: [],
  setPendingShares: (updater) => set((state) => ({ 
    pendingShares: typeof updater === 'function' ? (updater as any)(state.pendingShares) : updater 
  })),

  activeNote: null,
  setActiveNote: (updater) => set((state) => ({ activeNote: typeof updater === 'function' ? (updater as any)(state.activeNote) : updater })),
  noteDraft: "",
  setNoteDraft: (updater) => set((state) => ({ noteDraft: typeof updater === 'function' ? (updater as any)(state.noteDraft) : updater })),
  noteTitleDraft: "",
  setNoteTitleDraft: (updater) => set((state) => ({ noteTitleDraft: typeof updater === 'function' ? (updater as any)(state.noteTitleDraft) : updater })),
  noteSubjectFilter: null,
  setNoteSubjectFilter: (updater) => set((state) => ({ noteSubjectFilter: typeof updater === 'function' ? (updater as any)(state.noteSubjectFilter) : updater })),
  noteSubjectId: 0,
  setNoteSubjectId: (updater) => set((state) => ({ noteSubjectId: typeof updater === 'function' ? (updater as any)(state.noteSubjectId) : updater })),
  noteSearchQuery: "",
  setNoteSearchQuery: (updater) => set((state) => ({ noteSearchQuery: typeof updater === 'function' ? (updater as any)(state.noteSearchQuery) : updater })),
  noteMode: "edit",
  setNoteMode: (updater) => set((state) => ({ noteMode: typeof updater === 'function' ? (updater as any)(state.noteMode) : updater })),
  isSummarizingNote: false,
  setIsSummarizingNote: (updater) => set((state) => ({ isSummarizingNote: typeof updater === 'function' ? (updater as any)(state.isSummarizingNote) : updater })),
}));
