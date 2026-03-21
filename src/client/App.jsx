import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import TopicHub from './pages/TopicHub.jsx'
import Pipeline from './pages/Pipeline.jsx'
import KnowledgeBase from './pages/KnowledgeBase.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/topics" replace />} />
          <Route path="topics" element={<TopicHub />} />
          <Route path="pipeline/:topicId" element={<Pipeline />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
