import React from 'react';

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };
  return (
    <div className="flex justify-center items-center">
      <div className={`${sizes[size]} border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin`} />
    </div>
  );
};