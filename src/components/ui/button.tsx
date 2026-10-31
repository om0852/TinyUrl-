import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "soft" | "outline" | "ghost" | "danger" | "destructive";
  size?: "sm" | "default" | "lg" | "icon";
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  className = "",
  variant = "primary",
  size = "default",
  loading = false,
  loadingText,
  leftIcon,
  rightIcon,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center font-medium rounded-md transition-colors select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong/40";
  
  const variants = {
    primary: "bg-primary-container text-on-primary hover:bg-primary active:bg-primary-strong font-medium",
    secondary: "bg-surface-container text-on-surface border-[0.5px] border-outline-variant hover:bg-surface-container-high",
    soft: "bg-primary-fixed/60 text-on-secondary-container hover:bg-primary-fixed font-medium",
    outline: "border-[0.5px] border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container",
    ghost: "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
    danger: "bg-error-container text-error hover:bg-error hover:text-on-error font-medium",
    destructive: "bg-error text-on-error hover:bg-error/90 font-medium",
  };

  const sizes = {
    sm: "h-[28px] px-2.5 text-xs gap-1.5",
    default: "h-[34px] px-[15px] text-xs gap-2",
    lg: "h-[38px] px-5 text-[13px] gap-2.5 font-semibold",
    icon: "h-[34px] w-[34px] p-0 flex items-center justify-center rounded-full",
  };

  const resolvedVariant = variant === "destructive" ? "destructive" : variants[variant] ? variant : "primary";

  return (
    <button
      className={`${base} ${variants[resolvedVariant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-3.5 w-3.5 text-current shrink-0" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
          </svg>
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}

export function SplitButton({
  children,
  onClick,
  onDropdownClick,
  className = "",
  disabled = false
}: {
  children: React.ReactNode;
  onClick: () => void;
  onDropdownClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`inline-flex rounded-md ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="px-3.5 py-2 bg-primary-container text-on-primary rounded-l-md hover:bg-primary transition-colors text-xs font-medium cursor-pointer disabled:opacity-50"
      >
        {children}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onDropdownClick}
        className="px-2 py-2 bg-primary text-on-primary rounded-r-md hover:bg-primary-strong transition-colors flex items-center justify-center cursor-pointer border-l border-on-primary/15 disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>
    </div>
  );
}

export function IconToolbar({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 p-1 bg-[#F4F4F5] rounded-md w-max ${className}`}>
      {children}
    </div>
  );
}
