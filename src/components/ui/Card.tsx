import type { ReactNode, CSSProperties } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export function Card({ children, className = "", onClick, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all duration-200 ${
        onClick ? "cursor-pointer active:scale-[0.99]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
