import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ children, className = '', padding = 'md' }) => {
  const paddings = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-7',
  };
  return (
    <div className={`bg-white rounded-lg shadow border ${paddings[padding]} ${className}`}>
      {children}
    </div>
  );
};