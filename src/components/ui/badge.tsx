import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "success" | "warning" | "destructive" | "info" | "outline" | "muted";
}

export function Badge({
  className = "",
  variant = "primary",
  children,
  ...props
}: BadgeProps) {
  const base = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider leading-none select-none";

  const variants = {
    primary: "bg-primary/10 text-primary-ink border border-primary-strong/20",
    success: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-700 border border-amber-500/20",
    destructive: "bg-red-500/10 text-red-600 border border-red-500/20",
    info: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
    outline: "border border-outline-variant text-muted-foreground",
    muted: "bg-muted/40 text-muted-foreground border border-outline-variant",
  };

  return (
    <span className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
