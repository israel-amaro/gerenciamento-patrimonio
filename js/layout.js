const { useEffect } = React;
const { Link, useLocation } = ReactRouterDOM;

const Sidebar = () => {
  const loc = useLocation();

  const items = [
    { label: "Dashboard", path: "/app/dashboard", icon: "layout-dashboard" },
    { label: "Ativos", path: "/app/assets", icon: "laptop" },
    { label: "Caixas", path: "/app/boxes", icon: "package" },
    { label: "Empréstimos", path: "/app/loans", icon: "arrow-right-left" },
    { label: "Checklist Rápido", path: "/app/checklists", icon: "clipboard-check" },
    { label: "Auditoria Tech", path: "/app/audits", icon: "scan-line" },
    { label: "Defeitos", path: "/app/incidents", icon: "alert-triangle" },
    { label: "Relatórios", path: "/app/reports", icon: "file-text" }
  ];

  useEffect(() => {
    lucide.createIcons();
  });

  return (
    <aside className="w-64 border-r bg-card h-full flex flex-col shrink-0">
      <div className="h-16 flex items-center px-6 border-b">
        <span className="font-bold text-lg text-primary tracking-tight">EquipControl</span>
      </div>

      <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
        {items.map((it) => {
          const isActive = loc.pathname.startsWith(it.path);

          return (
            <Link
              key={it.path}
              to={it.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <i data-lucide={it.icon} className={isActive ? "text-primary" : ""}></i>
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t text-xs text-muted-foreground">Admin Mode</div>
    </aside>
  );
};

const AppLayout = ({ children }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex justify-end items-center px-6 shrink-0">
          <Button variant="ghost" className="flex items-center gap-2">
            <i data-lucide="user-circle"></i>
            Admin User
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
};