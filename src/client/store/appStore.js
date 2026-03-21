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
}))

export default useAppStore
