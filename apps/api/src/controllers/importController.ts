import { Request, Response } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { addItemToCart } from '../services/cartService';
import { ProductSearchResult } from '../integrations/baseAdapter';
import { getRetailerDefinition, getRetailerDefinitionByName, getRetailerDefinitions } from '../integrations/registry';
import { recordAuditEvent } from '../services/auditService';
import { inferSellerTrustDefaults } from '../services/sellerTrustService';
import { normalizeImportedProductData } from '../services/productNormalizationService';
import { getRetailerActionBlockReason, isRetailerActionAllowed } from '../services/complianceService';
import { RetailerRequestError, runRetailerRequest } from '../services/retailerRequestService';

type ImportedProductData = ProductSearchResult & {
  sellerName?: string;
  isAuthorizedSeller?: boolean;
  returnWindowDays?: number | null;
  warrantySupport?: boolean;
  customerRating?: number | null;
  counterfeitRisk?: string;
};

function mergeAttributes(existing: unknown, incoming: unknown) {
  const existingObject = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  const incomingObject = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {};
  const merged = { ...(existingObject as Record<string, any>), ...(incomingObject as Record<string, any>) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

async function upsertImportedProduct(retailerName: string, productData: ImportedProductData) {
  productData = normalizeImportedProductData(retailerName, productData);

  let product = null;
  if (productData.upc) {
    product = await prisma.product.findUnique({
      where: { upc: productData.upc },
    });
  }
  if (!product && productData.brand && productData.model) {
    product = await prisma.product.findFirst({
      where: {
        brand: productData.brand,
        model: productData.model,
      },
    });
  }
  if (!product && productData.name) {
    product = await prisma.product.findFirst({
      where: productData.brand
        ? {
            name: productData.name,
            brand: productData.brand,
          }
        : { name: productData.name },
    });
  }
  if (!product && productData.name && productData.brand) {
    product = await prisma.product.findFirst({
      where: { name: productData.name },
    });
  }

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: productData.name,
        brand: productData.brand,
        model: productData.model,
        upc: productData.upc,
        category: productData.category,
        imageUrl: productData.image,
        attributes: mergeAttributes(undefined, productData.attributes),
        rawMetadata: productData.rawMetadata || undefined,
      },
    });
  } else {
    product = await prisma.product.update({
      where: { id: product.id },
      data: {
        brand: productData.brand || product.brand,
        model: productData.model || product.model,
        upc: productData.upc || product.upc,
        category: productData.category || product.category,
        imageUrl: productData.image || product.imageUrl,
        attributes: mergeAttributes(product.attributes, productData.attributes),
        rawMetadata: productData.rawMetadata || undefined,
      },
    });
  }

  const retailerSku = productData.sku || productData.sourceUrl;
  const trustDefaults = inferSellerTrustDefaults(retailerName);
  const retailerProduct = await prisma.retailerProduct.upsert({
    where: {
      retailerName_retailerSku: {
        retailerName,
        retailerSku,
      },
    },
    update: {
      productId: product.id,
      price: productData.price,
      url: productData.sourceUrl,
      inStock: !String(productData.availability || '').toLowerCase().includes('outofstock'),
      sellerName: productData.sellerName || trustDefaults.sellerName,
      isAuthorizedSeller: productData.isAuthorizedSeller ?? trustDefaults.isAuthorizedSeller,
      returnWindowDays: productData.returnWindowDays ?? trustDefaults.returnWindowDays,
      warrantySupport: productData.warrantySupport ?? trustDefaults.warrantySupport,
      customerRating: productData.customerRating ?? trustDefaults.customerRating,
      counterfeitRisk: productData.counterfeitRisk || trustDefaults.counterfeitRisk,
      lastUpdated: new Date(),
    },
    create: {
      productId: product.id,
      retailerName,
      retailerSku,
      price: productData.price,
      url: productData.sourceUrl,
      inStock: !String(productData.availability || '').toLowerCase().includes('outofstock'),
      sellerName: productData.sellerName || trustDefaults.sellerName,
      isAuthorizedSeller: productData.isAuthorizedSeller ?? trustDefaults.isAuthorizedSeller,
      returnWindowDays: productData.returnWindowDays ?? trustDefaults.returnWindowDays,
      warrantySupport: productData.warrantySupport ?? trustDefaults.warrantySupport,
      customerRating: productData.customerRating ?? trustDefaults.customerRating,
      counterfeitRisk: productData.counterfeitRisk || trustDefaults.counterfeitRisk,
    },
  });

  return { product, retailerProduct };
}

export async function importProduct(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  let retailerDefinition;
  try {
    retailerDefinition = getRetailerDefinition(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!retailerDefinition) {
    return res.status(422).json({ error: 'Unsupported retailer URL' });
  }

  const adapter = new retailerDefinition.adapter();
  const retailerName = retailerDefinition.name;
  if (!isRetailerActionAllowed(retailerName, 'user_consented_url_import')) {
    return res.status(422).json({ error: getRetailerActionBlockReason(retailerName, 'user_consented_url_import') });
  }

  let productData;
  try {
    productData = await runRetailerRequest(retailerName, 'product import', () => adapter.fetchProduct(url));
  } catch (error) {
    const status = error instanceof RetailerRequestError ? error.statusCode : 502;
    const message =
      error instanceof RetailerRequestError
        ? error.message
        : `Product import failed for ${retailerName}. Try again or paste a different supported product URL.`;
    return res.status(status).json({ error: message, retailer: retailerName, retryable: status === 502 || status === 504 });
  }
  const { product, retailerProduct } = await upsertImportedProduct(retailerName, {
    ...productData,
    sourceUrl: productData.sourceUrl || url,
  });
  const cartItem = await addItemToCart(userId, product.id, retailerName, 1);

  await recordAuditEvent({
    userId,
    action: 'product.imported',
    entityType: 'cart_item',
    entityId: cartItem.id,
    summary: `Imported ${product.name} from ${retailerName}`,
    metadata: {
      productId: product.id,
      retailerProductId: retailerProduct.id,
      sourceRetailer: retailerName,
      url: productData.sourceUrl || url,
      price: productData.price,
      normalized: {
        brand: product.brand,
        model: product.model,
        upc: product.upc,
        category: product.category,
      },
    },
  });

  return res.json({
    id: product.id,
    cartItemId: cartItem.id,
    retailerProductId: retailerProduct.id,
    retailerSku: retailerProduct.retailerSku,
    sourceRetailer: retailerName,
    quantity: cartItem.quantity,
    productName: product.name,
    price: productData.price,
    imageUrl: product.imageUrl,
    url: productData.sourceUrl || url,
    brand: product.brand,
    model: product.model,
    upc: product.upc,
    category: product.category,
    attributes: product.attributes || undefined,
  });
}

export async function searchProducts(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const query = typeof req.body.query === 'string' ? req.body.query.trim() : '';
  const retailer = typeof req.body.retailer === 'string' ? req.body.retailer.trim() : '';

  if (query.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  const retailerDefinitions = retailer
    ? [getRetailerDefinitionByName(retailer)].filter((definition): definition is NonNullable<typeof definition> => Boolean(definition))
    : getRetailerDefinitions();

  if (retailer && retailerDefinitions.length === 0) {
    return res.status(422).json({ error: 'Unsupported retailer' });
  }

  const results: any[] = [];
  const errors: Array<{ retailer: string; error: string }> = [];

  for (const definition of retailerDefinitions) {
    const adapter = new definition.adapter();
    if (!adapter.searchProducts) continue;

    try {
      const found = await runRetailerRequest(definition.name, 'product search', () => adapter.searchProducts!(query));
      for (const [index, productData] of found.entries()) {
        const { product, retailerProduct } = await upsertImportedProduct(definition.name, productData);
        results.push({
          rank: results.length + 1,
          retailerRank: index + 1,
          productId: product.id,
          retailerProductId: retailerProduct.id,
          retailerSku: retailerProduct.retailerSku,
          sourceRetailer: definition.name,
          productName: product.name,
          price: retailerProduct.price,
          imageUrl: product.imageUrl,
          url: retailerProduct.url,
          brand: product.brand,
          model: product.model,
          upc: product.upc,
          category: product.category,
          attributes: product.attributes || undefined,
        });
      }
    } catch (error) {
      errors.push({
        retailer: definition.name,
        error: error instanceof Error ? error.message : 'Search failed',
      });
    }
  }

  await recordAuditEvent({
    userId,
    action: 'product.search',
    entityType: 'product',
    summary: `Searched products for "${query}"`,
    metadata: {
      query,
      retailer: retailer || null,
      resultCount: results.length,
      errors,
    },
  });

  return res.json({
    query,
    retailer: retailer || null,
    results,
    errors,
  });
}
