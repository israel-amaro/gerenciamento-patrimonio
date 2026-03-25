const Button = ({
  children,
  variant = "default",
  size = "default",
  className = "",
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:opacity-50";

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
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = (props) => (
  <input
    className="flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
    {...props}
  />
);

const Select = ({ children, ...props }) => (
  <select
    className="flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
    {...props}
  >
    {children}
  </select>
);

const Card = ({ children, className = "" }) => (
  <div className={`border rounded-lg bg-card text-card-foreground shadow-sm ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ children, className = "" }) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>
);

const CardTitle = ({ children, className = "" }) => (
  <h3 className={`font-semibold leading-none tracking-tight ${className}`}>{children}</h3>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`p-6 pt-0 ${className}`}>{children}</div>
);

const Badge = ({ children, variant = "default", className = "" }) => {
  const variants = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    outline: "bg-transparent text-foreground border-border"
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};