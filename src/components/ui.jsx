import { classNames } from "../lib/utils";

export function Button({ children, className = "", variant = "default", size = "default", ...props }) {
  return (
    <button
      className={`px-4 py-2 rounded-xl font-medium transition ${
        variant === "secondary" ? "bg-zinc-200 text-zinc-900" : ""
      } ${variant === "ghost" ? "bg-transparent" : ""} ${
        variant === "default" ? "bg-orange-500 text-white" : ""
      } ${size === "icon" ? "p-2" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-3xl shadow-sm ${className}`}>{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}
export 
function SoftCard({ children, className = "" }) {
  return <Card className={classNames("border-0 shadow-sm rounded-[1.5rem] bg-white dark:bg-zinc-900", className)}><CardContent className="p-4">{children}</CardContent></Card>;
}
export 
function SectionTitle({ icon: Icon, title, action }) {
  return <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-[hsl(24_80%_58%)]" /><h2 className="font-bold">{title}</h2></div>{action}</div>;
}
