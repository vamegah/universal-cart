import axios from 'axios';
import * as cheerio from 'cheerio';
import { RetailerClient } from './index';

export class MacysClient implements RetailerClient {
  async fetchProduct(url: string) {
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(response.data);
    const name = $('.product-name').text().trim() || $('h1').first().text().trim();
    const price = parseFloat($('.price-sales').text().replace('$', '')) || 0;
    const sku = url.match(/\/product\/([^/?]+)/)?.[1] || '';
    const imageUrl = $('.product-image img').attr('src');
    return { name, price, sku, imageUrl };
  }

  async addToCart(productId: string, quantity: number) {
    return `https://macys.com/cart?add=${productId}&qty=${quantity}`;
  }
}
