import { Download, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, Icon } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";

const items = [
  { label: "Dashboard", path: "/app/dashboard", icon: "layout-dashboard", roles: ["admin"] },
  { label: "Ativos", path: "/app/assets", icon: "laptop", roles: ["admin"] },
  { label: "Carrinhos", path: "/app/boxes", icon: "package", roles: ["admin"] },
  { label: "Laboratórios", path: "/app/labs", icon: "clipboard-check", roles: ["admin"] },
  { label: "Salas", path: "/app/rooms", icon: "door-open", roles: ["admin"] },
  { label: "Empréstimos", path: "/app/loans", icon: "arrow-right-left" },
  { label: "Checklist Rápido", path: "/app/checklists", icon: "clipboard-check" },
  { label: "Auditoria técnica", path: "/app/audits", icon: "scan-line", roles: ["admin"] },
  { label: "Defeitos", path: "/app/incidents", icon: "alert-triangle", roles: ["admin"] },
  { label: "Relatórios", path: "/app/reports", icon: "file-text", roles: ["admin"] }
];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isAdmin, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalling(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const visibleItems = items.filter((item) => {
    if (!item.roles) {
      return true;
    }

    if (isAdmin) {
      return true;
    }

    return item.roles.includes(profile?.role);
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/app/loans", { replace: true });
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    setInstalling(true);

    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  const sidebar = (
    <aside className="flex h-full w-[280px] max-w-[80vw] flex-col border-r bg-card">
      <div className="flex h-16 items-center justify-between border-b px-5">
        <span className="text-lg font-bold tracking-tight text-primary">EquipControl</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {visibleItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon name={item.icon} className={isActive ? "text-primary" : ""} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4 text-xs uppercase text-muted-foreground">
        {loading ? "Carregando" : isAdmin ? profile?.role || "admin" : "Público"}
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background md:flex">
      <div className="hidden md:block md:h-screen md:shrink-0">
        {sidebar}
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu"
          />
          <div className="relative h-full">
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center justify-between gap-2 border-b bg-card px-4 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-base font-semibold text-primary">EquipControl</span>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {deferredPrompt ? (
              <Button type="button" variant="outline" onClick={handleInstall} disabled={installing}>
                <Download className="mr-2 h-4 w-4" />
                {installing ? "Instalando..." : "Instalar app"}
              </Button>
            ) : null}

            {!loading && isAdmin ? (
              <>
                <Button variant="ghost" className="max-w-[220px] items-center gap-2 overflow-hidden text-ellipsis">
                  <Icon name="user-circle" />
                  <span className="truncate">{profile?.full_name || "Administrador"}</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sair">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : !loading ? (
              <Button variant="ghost" onClick={() => navigate("/admin/login")}>
                Área admin
              </Button>
            ) : null}
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
