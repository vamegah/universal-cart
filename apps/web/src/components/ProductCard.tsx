import React from 'react';
import Image from 'next/image';

interface Props {
  name: string;
  price: number;
  imageUrl?: string;
  retailer: string;
  onAdd?: () => void;
}

export default function ProductCard({ name, price, imageUrl, retailer, onAdd }: Props) {
  return (
    <div className="border rounded-lg p-4 shadow-sm hover:shadow-md transition">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          width={320}
          height={160}
          className="mb-3 h-40 w-full rounded object-cover"
        />
      ) : (
        <div className="mb-3 h-40 w-full rounded bg-gray-100" aria-hidden="true" />
      )}
      <h3 className="font-semibold line-clamp-2">{name}</h3>
      <p className="text-sm text-gray-500">{retailer}</p>
      <p className="text-lg font-bold mt-2">${price.toFixed(2)}</p>
      {onAdd && (
        <button
          onClick={onAdd}
          className="mt-3 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Add to Cart
        </button>
      )}
    </div>
  );
}
