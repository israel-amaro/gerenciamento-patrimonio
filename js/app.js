const { HashRouter: Router, Routes, Route } = ReactRouterDOM;

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route
      path="/app/*"
      element={
        <AppLayout>
          <Routes>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="assets" element={<Assets />} />
            <Route path="boxes" element={<Boxes />} />
            <Route path="loans" element={<Loans />} />
            <Route path="checklists" element={<Checklists />} />
            <Route path="audits" element={<Audits />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/app/dashboard" />} />
          </Routes>
        </AppLayout>
      }
    />
    <Route path="*" element={<Navigate to="/login" />} />
  </Routes>
);

const App = () => {
  React.useEffect(() => {
    lucide.createIcons();
  });

  return (
    <Router>
      <AppRoutes />
    </Router>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);