import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeProduct(url: string): Promise<any> {
  const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(response.data);
  // Generic fallback: try to get h1 as title and any price-like text
  const name = $('h1').first().text().trim();
  const priceText = $('body').text().match(/\$\d+(?:\.\d{2})?/);
  const price = priceText ? parseFloat(priceText[0].replace('$', '')) : 0;
  const sku = url.split('/').pop() || '';
  const imageUrl = $('img').first().attr('src');
  return { name, price, sku, imageUrl };
}