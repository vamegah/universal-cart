import axios from 'axios';
import * as cheerio from 'cheerio';
import { RetailerClient } from './index';

export class AmazonClient implements RetailerClient {
  async fetchProduct(url: string) {
    // In production, use Amazon Product Advertising API or scraping
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(response.data);
    const name = $('#productTitle').text().trim();
    const price = parseFloat($('.a-price-whole').first().text().replace(',', '')) || 0;
    const sku = url.match(/\/dp\/([A-Z0-9]+)/)?.[1] || '';
    const imageUrl = $('#imgTagWrapperId img').attr('src');
    return { name, price, sku, imageUrl };
  }
  async addToCart(productId: string, quantity: number) {
    // Simulate add to cart URL
    return `https://amazon.com/gp/cart/add.html?ASIN.1=${productId}&Quantity.1=${quantity}`;
  }
}