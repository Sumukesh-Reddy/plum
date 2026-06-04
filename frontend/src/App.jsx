import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import UploadClaim from './pages/UploadClaim';
import ClaimResult from './pages/ClaimResult';
import ClaimHistory from './pages/ClaimHistory';
import PolicyConfig from './pages/PolicyConfig';
import EvaluationMetrics from './pages/EvaluationMetrics';

export default function App() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/upload"     element={<UploadClaim />} />
          <Route path="/result/:id" element={<ClaimResult />} />
          <Route path="/claims/:id" element={<ClaimResult />} />
          <Route path="/history"    element={<ClaimHistory />} />
          <Route path="/policy"     element={<PolicyConfig />} />
          <Route path="/metrics"    element={<EvaluationMetrics />} />
        </Routes>
      </main>
    </div>
  );
}
