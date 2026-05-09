import { Routes, Route, Navigate } from 'react-router-dom';
import InterviewPage from './pages/InterviewPage';
import PreviewPage from './pages/PreviewPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InterviewPage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
