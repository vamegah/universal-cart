import { prisma } from '../index';

export async function getOrCreateCart(userId: string) {
  let cart = await prisma.universalCart.findFirst({
    where: { userId, status: 'active' },
    include: { items: { include: { product: { include: { retailerProducts: true } }, matchResults: { include: { retailerProduct: true } } } } },
  });
  if (!cart) {
    cart = await prisma.universalCart.create({
      data: { userId, status: 'active' },
      include: { items: { include: { product: { include: { retailerProducts: true } }, matchResults: { include: { retailerProduct: true } } } } },
    });
  }
  return cart;
}

export async function addItemToCart(userId: string, productId: string, sourceRetailer: string, quantity = 1) {
  const cart = await getOrCreateCart(userId);
  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId, sourceRetailer },
  });
  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  }
  return prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId,
      sourceRetailer,
      quantity,
    },
  });
}

export async function removeCartItem(userId: string, itemId: string) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
  });
  if (!item) throw new Error('Cart item not found');

  await prisma.matchResult.deleteMany({ where: { cartItemId: itemId } });
  return prisma.cartItem.delete({ where: { id: itemId } });
}

export async function getCartItemForUser(userId: string, itemId: string) {
  return prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
  });
}

export async function updateCartItemQuantity(userId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
  });
  if (!item) throw new Error('Cart item not found');

  return prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
}

export async function clearActiveCart(userId: string) {
  const cart = await prisma.universalCart.findFirst({
    where: { userId, status: 'active' },
  });
  if (!cart) return { count: 0 };

  await prisma.matchResult.deleteMany({ where: { cartItem: { cartId: cart.id } } });
  return prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
}
