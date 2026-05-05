import { create } from 'zustand';

type TableState = {
  tableId: string | null;
  sessionId: string | null;
  setContext: (payload: { tableId: string; sessionId: string }) => void;
  clear: () => void;
};

export const useTableStore = create<TableState>((set) => ({
  tableId: null,
  sessionId: null,
  setContext: ({ tableId, sessionId }) => set({ tableId, sessionId }),
  clear: () => set({ tableId: null, sessionId: null }),
}));
