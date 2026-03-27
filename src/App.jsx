import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import RoleRoute from "./routes/RoleRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AssetsPage from "./pages/AssetsPage";
import BoxesPage from "./pages/BoxesPage";
import LabsPage from "./pages/LabsPage";
import LoansPage from "./pages/LoansPage";
import ChecklistsPage from "./pages/ChecklistsPage";
import AuditsPage from "./pages/AuditsPage";
import IncidentsPage from "./pages/IncidentsPage";
import ReportsPage from "./pages/ReportsPage";
import PublicAssetPage from "./pages/PublicAssetPage";
import PublicBoxPage from "./pages/PublicBoxPage";
import PublicLabPage from "./pages/PublicLabPage";

const App = () => (
  <Routes>
    <Route path="/admin/login" element={<LoginPage />} />
    <Route path="/scan/:assetId" element={<PublicAssetPage />} />
    <Route path="/scan/asset/:assetId" element={<PublicAssetPage />} />
    <Route path="/scan/box/:boxId" element={<PublicBoxPage />} />
    <Route path="/scan/lab/:labId" element={<PublicLabPage />} />
    <Route path="/app/audits/:assetId" element={<PublicAssetPage />} />
    <Route path="/app" element={<AppLayout />}>
      <Route index element={<Navigate to="/app/loans" replace />} />
      <Route path="dashboard" element={<RoleRoute roles={["admin"]}><DashboardPage /></RoleRoute>} />
      <Route path="assets" element={<RoleRoute roles={["admin"]}><AssetsPage /></RoleRoute>} />
      <Route path="boxes" element={<RoleRoute roles={["admin"]}><BoxesPage /></RoleRoute>} />
      <Route path="labs" element={<RoleRoute roles={["admin"]}><LabsPage /></RoleRoute>} />
      <Route path="loans" element={<LoansPage />} />
      <Route path="checklists" element={<ChecklistsPage />} />
      <Route path="audits" element={<RoleRoute roles={["admin"]}><AuditsPage /></RoleRoute>} />
      <Route path="audits/manual/:assetId" element={<RoleRoute roles={["admin"]}><AuditsPage /></RoleRoute>} />
      <Route path="incidents" element={<RoleRoute roles={["admin"]}><IncidentsPage /></RoleRoute>} />
      <Route path="reports" element={<RoleRoute roles={["admin"]}><ReportsPage /></RoleRoute>} />
    </Route>
    <Route path="*" element={<Navigate to="/app/loans" replace />} />
  </Routes>
);

export default App;
