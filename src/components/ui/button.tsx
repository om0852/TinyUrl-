import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg" | "icon";
}

export function Button({
  className = "",
  variant = "primary",
  size = "default",
  children,
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center font-medium rounded-lg transition-all select-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  
  const variants = {
    primary: "bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] hover:brightness-110",
    secondary: "bg-muted text-foreground hover:bg-muted/80 active:scale-[0.98]",
    outline: "border border-border/60 bg-background/50 hover:bg-muted hover:text-foreground text-foreground active:scale-[0.98]",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]",
    destructive: "bg-destructive text-white hover:bg-destructive/90 shadow-lg shadow-destructive/20 active:scale-[0.98]",
  };

  const sizes = {
    sm: "h-8 px-2.5 text-xs",
    default: "h-9 px-4 text-xs sm:text-sm",
    lg: "h-10 px-5 text-sm",
    icon: "h-8 w-8 p-0",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
