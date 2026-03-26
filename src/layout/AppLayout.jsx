import { LogOut } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, Icon } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";

const items = [
  { label: "Dashboard", path: "/app/dashboard", icon: "layout-dashboard", roles: ["admin"] },
  { label: "Ativos", path: "/app/assets", icon: "laptop", roles: ["admin"] },
  { label: "Caixas", path: "/app/boxes", icon: "package", roles: ["admin"] },
  { label: "Empréstimos", path: "/app/loans", icon: "arrow-right-left" },
  { label: "Checklist Rápido", path: "/app/checklists", icon: "clipboard-check" },
  { label: "Auditoria Tech", path: "/app/audits", icon: "scan-line", roles: ["admin"] },
  { label: "Defeitos", path: "/app/incidents", icon: "alert-triangle", roles: ["admin"] },
  { label: "Relatórios", path: "/app/reports", icon: "file-text", roles: ["admin"] }
];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isAdmin } = useAuth();
  const visibleItems = items.filter((item) => {
    if (!item.roles) return true;
    if (isAdmin) return true;
    return item.roles.includes(profile?.role);
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/app/loans", { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 border-r bg-card h-full flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b">
          <span className="font-bold text-lg text-primary tracking-tight">EquipControl</span>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon name={item.icon} className={isActive ? "text-primary" : ""} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t text-xs text-muted-foreground uppercase">
          {isAdmin ? (profile?.role || "admin") : "Público"}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex justify-end items-center px-6 shrink-0 gap-2">
          {isAdmin ? (
            <>
              <Button variant="ghost" className="flex items-center gap-2">
                <Icon name="user-circle" />
                {profile?.full_name || "Admin Findes"}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => navigate("/admin/login")}>
              Admin
            </Button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
