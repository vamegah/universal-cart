import { randomUUID } from 'crypto';

export const generateId = () => randomUUID();

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock price extractor (replace with real later)
export function extractPriceFromHtml(html: string): number | null {
  const match = html.match(/\$(\d+(?:\.\d{2})?)/);
  return match ? parseFloat(match[1]) : null;
}
