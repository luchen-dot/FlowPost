import { create } from 'zustand'

const useAppStore = create((set) => ({
  // Topics list
  topics: [],
  setTopics: (topics) => set({ topics }),
  addTopic: (topic) => set((state) => ({ topics: [topic, ...state.topics] })),
  updateTopic: (id, updates) =>
    set((state) => ({
      topics: state.topics.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTopic: (id) =>
    set((state) => ({ topics: state.topics.filter((t) => t.id !== id) })),

  // Current post being edited
  currentPost: null,
  setCurrentPost: (post) => set({ currentPost: post }),
  updateCurrentPost: (updates) =>
    set((state) => ({
      currentPost: state.currentPost ? { ...state.currentPost, ...updates } : null,
    })),

  // AI settings cache
  aiSettings: [],
  setAiSettings: (settings) => set({ aiSettings: settings }),
  activeProvider: null,
  setActiveProvider: (p) => set({ activeProvider: p }),

  // Knowledge base
  kbFeeds: [],
  kbFeedsTotal: 0,
  setKbFeeds: (feeds, total) => set({ kbFeeds: feeds, kbFeedsTotal: total }),

  kbDocs: [],
  setKbDocs: (docs) => set({ kbDocs: docs }),

  kbSuggestions: [],
  setKbSuggestions: (s) => set({ kbSuggestions: s }),

  kbConfig: null,
  setKbConfig: (cfg) => set({ kbConfig: cfg }),

  kbSyncing: false,
  setKbSyncing: (v) => set({ kbSyncing: v }),
}))

export default useAppStore
