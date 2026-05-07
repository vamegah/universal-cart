import React from 'react';

const storeColors: Record<string, string> = {
  Amazon: 'bg-orange-100 text-orange-800',
  Walmart: 'bg-blue-100 text-blue-800',
  Target: 'bg-red-100 text-red-800',
  "Macy's": 'bg-purple-100 text-purple-800',
  default: 'bg-gray-100 text-gray-800',
};

export const StoreBadge: React.FC<{ storeName: string }> = ({ storeName }) => {
  const colorClass = storeColors[storeName] || storeColors.default;
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {storeName}
    </span>
  );
};