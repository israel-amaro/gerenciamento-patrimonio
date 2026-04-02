import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoadingState } from "./components/ui";
import AppLayout from "./layout/AppLayout";
import RoleRoute from "./routes/RoleRoute";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AssetsPage = lazy(() => import("./pages/AssetsPage"));
const BoxesPage = lazy(() => import("./pages/BoxesPage"));
const LabsPage = lazy(() => import("./pages/LabsPage"));
const RoomsPage = lazy(() => import("./pages/RoomsPage"));
const LoansPage = lazy(() => import("./pages/LoansPage"));
const ChecklistsPage = lazy(() => import("./pages/ChecklistsPage"));
const AuditsPage = lazy(() => import("./pages/AuditsPage"));
const IncidentsPage = lazy(() => import("./pages/IncidentsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const PublicAssetPage = lazy(() => import("./pages/PublicAssetPage"));
const PublicBoxPage = lazy(() => import("./pages/PublicBoxPage"));
const PublicLabPage = lazy(() => import("./pages/PublicLabPage"));

const App = () => (
  <Suspense fallback={<div className="p-6"><LoadingState label="Carregando página..." /></div>}>
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
        <Route path="rooms" element={<RoleRoute roles={["admin"]}><RoomsPage /></RoleRoute>} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="checklists" element={<ChecklistsPage />} />
        <Route path="audits" element={<RoleRoute roles={["admin"]}><AuditsPage /></RoleRoute>} />
        <Route path="audits/manual/:assetId" element={<RoleRoute roles={["admin"]}><AuditsPage /></RoleRoute>} />
        <Route path="incidents" element={<RoleRoute roles={["admin"]}><IncidentsPage /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute roles={["admin"]}><ReportsPage /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/app/loans" replace />} />
    </Routes>
  </Suspense>
);

export default App;
