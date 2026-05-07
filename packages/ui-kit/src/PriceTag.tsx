import React from 'react';

export const PriceTag: React.FC<{ amount: number; currency?: string }> = ({ amount, currency = '$' }) => {
  return <span className="font-bold text-lg">{currency}{amount.toFixed(2)}</span>;
};