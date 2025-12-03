import React from 'react';

// ACHADY Logo Component
// Icon: Magnifying glass with a lightning bolt inside
export const AchadyLogo: React.FC<{ size?: 'sm' | 'md' | 'lg', showText?: boolean, className?: string }> = ({ 
  size = 'md', 
  showText = true,
  className = ''
}) => {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl"
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-achady-purple to-achady-blue text-white shadow-lg shadow-brand-500/30 ${sizeClasses[size]}`}>
        {/* Custom SVG: Magnifying Glass + Bolt */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[60%] h-[60%]">
          <circle cx="11" cy="11" r="7" className="opacity-90" />
          <path d="M20 20 L16 16" className="opacity-90" />
          <path d="M11 7v4h2l-2 5" strokeWidth="2" className="fill-white/20" />
        </svg>
      </div>
      {showText && (
        <span className={`font-display font-bold tracking-tight text-slate-900 ${textSizes[size]}`}>
          ACHADY
        </span>
      )}
    </div>
  );
};

// Card Component - Premium Style
// White background, subtle shadow, rounded corners (16px)
export const Card: React.FC<{
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}> = ({ title, icon, children, action, className = '', noPadding = false }) => (
  <div className={`bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-achady-gray/50 overflow-hidden hover:shadow-[0_8px_30px_rgba(122,83,255,0.08)] transition-all duration-300 ${className}`}>
    {(title || action) && (
      <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center bg-white">
        <div className="flex items-center gap-3">
          {icon && <div className="text-achady-purple">{icon}</div>}
          {title && <h3 className="font-display font-semibold text-lg text-achady-text tracking-tight">{title}</h3>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className={noPadding ? '' : 'p-6'}>{children}</div>
  </div>
);

// Button Component - Gradient & Modern
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  fullWidth,
  className = '', 
  children, 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed rounded-xl";
  
  const variants = {
    primary: "bg-gradient-to-r from-achady-purple to-achady-blue hover:from-[#6A45EB] hover:to-[#2233DD] text-white shadow-lg shadow-brand-500/25 border border-transparent",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-achady-purple shadow-sm",
    danger: "bg-white text-achady-error border border-red-100 hover:bg-red-50 hover:border-red-200",
    ghost: "bg-transparent text-slate-500 hover:text-achady-purple hover:bg-brand-50"
  };

  const sizes = {
    sm: "text-xs px-3 py-2",
    md: "text-sm px-5 py-2.5",
    lg: "text-base px-6 py-3.5"
  };

  return (
    <button 
      className={`
        ${baseStyles} 
        ${variants[variant]} 
        ${sizes[size]} 
        ${fullWidth ? 'w-full' : ''} 
        ${className}
      `}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
};

// Input Component - Clean & Focus
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-600 mb-2 ml-1">{label}</label>}
    <div className="relative">
      {icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          {icon}
        </div>
      )}
      <input
        className={`
          w-full rounded-xl border bg-white text-slate-900 placeholder:text-slate-400
          focus:outline-none focus:ring-2 focus:ring-achady-purple/20 focus:border-achady-purple transition-all duration-200
          ${icon ? 'pl-10 px-4' : 'px-4'} py-2.5
          ${error ? 'border-achady-error focus:ring-red-200' : 'border-slate-200'}
          ${className}
        `}
        {...props}
      />
    </div>
    {error && <p className="mt-1.5 ml-1 text-xs text-achady-error font-medium">{error}</p>}
  </div>
);

// Toggle Switch - Modern
export const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <div className="flex items-center justify-between cursor-pointer group" onClick={() => onChange(!checked)}>
    <div className="mr-4">
      {label && <div className="text-sm font-medium text-slate-800 group-hover:text-achady-purple transition-colors">{label}</div>}
      {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
    </div>
    <div className={`
      relative w-12 h-7 rounded-full transition-colors duration-300 ease-in-out border-2 border-transparent
      ${checked ? 'bg-gradient-to-r from-achady-purple to-achady-blue' : 'bg-slate-200'}
    `}>
      <div className={`
        absolute left-0 top-0.5 bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${checked ? 'translate-x-6' : 'translate-x-0.5'}
      `} />
    </div>
  </div>
);