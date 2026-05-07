import axios from 'axios';
import * as cheerio from 'cheerio';
import { RetailerClient } from './index';

export class TargetClient implements RetailerClient {
  async fetchProduct(url: string) {
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(response.data);
    const name = $('[data-test="product-title"]').text().trim();
    const price = parseFloat($('[data-test="product-price"]').text().replace('$', '')) || 0;
    const sku = url.match(/\/dp\/([A-Z0-9]+)/)?.[1] || '';
    const imageUrl = $('img[data-test="product-image"]').attr('src');
    return { name, price, sku, imageUrl };
  }
  async addToCart(productId: string, quantity: number) {
    return `https://target.com/cart?add=${productId}&qty=${quantity}`;
  }
}