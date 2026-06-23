import { Routes, Route } from 'react-router'
import CreatePage from './pages/CreatePage'
import PastePage from './pages/PastePage'
import FilePage from './pages/FilePage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<CreatePage />} />
      <Route path="/f/:fileId" element={<FilePage />} />
      <Route path="/:pasteId" element={<PastePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
