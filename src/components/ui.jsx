import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle,
  ClipboardCheck,
  DoorOpen,
  Download,
  FileText,
  Laptop,
  LayoutDashboard,
  LoaderCircle,
  Package,
  Plus,
  Printer,
  QrCode,
  ScanLine,
  Search,
  UserCircle
} from "lucide-react";
import { cn } from "../lib/utils";

const iconMap = {
  "alert-triangle": AlertTriangle,
  "arrow-right-left": ArrowRightLeft,
  "check-circle": CheckCircle,
  "clipboard-check": ClipboardCheck,
  "door-open": DoorOpen,
  download: Download,
  "file-text": FileText,
  laptop: Laptop,
  "layout-dashboard": LayoutDashboard,
  package: Package,
  plus: Plus,
  printer: Printer,
  "qr-code": QrCode,
  "scan-line": ScanLine,
  search: Search,
  "user-circle": UserCircle
};

export const Icon = ({ name, className }) => {
  const Component = iconMap[name];
  if (!Component) {
    return null;
  }
  return <Component className={cn("h-5 w-5", className)} />;
};

export const Button = ({ children, variant = "default", size = "default", className = "", ...props }) => {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-white hover:bg-destructive/90",
    outline: "border border-border bg-white text-foreground hover:bg-muted",
    ghost: "hover:bg-muted text-foreground",
    secondary: "bg-muted text-foreground hover:bg-muted/80"
  };

  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    icon: "h-10 w-10"
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input = ({ className, ...props }) => (
  <input
    className={cn(
      "flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50",
      className
    )}
    {...props}
  />
);

export const Select = ({ className, children, ...props }) => (
  <select
    className={cn(
      "flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
);

export const Textarea = ({ className, ...props }) => (
  <textarea
    className={cn(
      "flex min-h-24 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50",
      className
    )}
    {...props}
  />
);

export const Card = ({ children, className = "" }) => (
  <div className={cn("border rounded-lg bg-card text-card-foreground shadow-sm", className)}>{children}</div>
);

export const CardHeader = ({ children, className = "" }) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)}>{children}</div>
);

export const CardTitle = ({ children, className = "" }) => (
  <h3 className={cn("font-semibold leading-none tracking-tight", className)}>{children}</h3>
);

export const CardContent = ({ children, className = "" }) => (
  <div className={cn("p-6 pt-0", className)}>{children}</div>
);

export const Badge = ({ children, variant = "default", className = "" }) => {
  const variants = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    outline: "bg-transparent text-foreground border-border"
  };

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", variants[variant], className)}>
      {children}
    </span>
  );
};

export const FormField = ({ label, children, error }) => (
  <div>
    <label className="text-sm font-medium mb-1 block">{label}</label>
    {children}
    {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
  </div>
);

export const LoadingState = ({ label = "Carregando..." }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <LoaderCircle className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

export const EmptyState = ({ title, description }) => (
  <div className="p-8 text-center text-sm text-muted-foreground">
    <div className="font-medium text-foreground">{title}</div>
    <div className="mt-2">{description}</div>
  </div>
);

export const InlineMessage = ({ tone = "neutral", children }) => {
  const tones = {
    neutral: "bg-muted/40 text-muted-foreground border-border",
    error: "bg-destructive/10 text-destructive border-destructive/20",
    success: "bg-success/10 text-success border-success/20"
  };

  return <div className={cn("rounded-md border px-3 py-2 text-sm", tones[tone])}>{children}</div>;
};
