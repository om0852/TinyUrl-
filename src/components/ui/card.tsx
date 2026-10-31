import React from "react";

export function Card({ 
  className = "", 
  children, 
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border-[0.5px] border-outline-variant bg-card text-card-foreground transition-colors duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ 
  className = "", 
  children, 
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col space-y-1 p-[15px] pb-[10px] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ 
  className = "", 
  children, 
  ...props 
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-[14px] font-semibold text-foreground leading-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ 
  className = "", 
  children, 
  ...props 
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`text-xs text-muted-foreground ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ 
  className = "", 
  children, 
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-[15px] pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ 
  className = "", 
  children, 
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center p-[15px] pt-0 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
