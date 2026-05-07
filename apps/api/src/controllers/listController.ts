import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { getOrCreateCart, addItemToCart } from '../services/cartService';
import { recordAuditEvent } from '../services/auditService';

// ─── item-level editing ───────────────────────────────────────────────────────

export async function addSavedListItem(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  const productId = String(req.body?.productId || '').trim();
  const sourceRetailer = String(req.body?.sourceRetailer || '').trim();
  const quantity = Math.max(1, Math.min(99, Number(req.body?.quantity ?? 1)));

  if (!productId || !sourceRetailer) {
    return res.status(400).json({ error: 'productId and sourceRetailer are required' });
  }

  const access = await findListAccess(id, userId);
  if (!access) return res.status(404).json({ error: 'Saved list not found' });
  if (!access.canWrite) return res.status(403).json({ error: 'Contributor access required to edit this list' });
  const list = access.list;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const existing = await prisma.savedListItem.findFirst({
    where: { listId: id, productId, sourceRetailer },
  });

  const item = existing
    ? await prisma.savedListItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity, updatedByUserId: userId },
        include: includeSavedListItem(),
      })
    : await prisma.savedListItem.create({
        data: { listId: id, productId, sourceRetailer, quantity, addedByUserId: userId, updatedByUserId: userId },
        include: includeSavedListItem(),
      });

  await prisma.savedList.update({ where: { id }, data: { updatedAt: new Date() } });
  await recordAuditEvent({
    userId,
    action: 'list.item_added',
    entityType: 'saved_list',
    entityId: id,
    summary: `Added ${product.name} to saved list ${list.name}`,
    metadata: { productId, sourceRetailer, quantity, addedByUserId: userId },
  });

  return res.status(existing ? 200 : 201).json({ item });
}

export async function updateSavedListItem(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id, itemId } = req.params;

  const access = await findListAccess(id, userId);
  if (!access) return res.status(404).json({ error: 'Saved list not found' });
  if (!access.canWrite) return res.status(403).json({ error: 'Contributor access required to edit this list' });
  const list = access.list;

  const existing = await prisma.savedListItem.findFirst({ where: { id: itemId, listId: id } });
  if (!existing) return res.status(404).json({ error: 'Item not found in list' });

  const data: { quantity?: number; updatedByUserId: string; approvedByUserId?: string; approvedAt?: Date } = { updatedByUserId: userId };
  if (req.body?.quantity !== undefined) {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ error: 'quantity must be an integer between 1 and 99' });
    }
    data.quantity = quantity;
  }

  if (req.body?.approved === true) {
    data.approvedByUserId = userId;
    data.approvedAt = new Date();
  }

  const item = await prisma.savedListItem.update({
    where: { id: itemId },
    data,
    include: includeSavedListItem(),
  });

  await prisma.savedList.update({ where: { id }, data: { updatedAt: new Date() } });
  await recordAuditEvent({
    userId,
    action: 'list.item_updated',
    entityType: 'saved_list',
    entityId: id,
    summary: `Updated item in saved list ${list.name}`,
    metadata: { itemId, quantity: data.quantity, updatedByUserId: userId, approvedByUserId: data.approvedByUserId || null },
  });

  return res.json({ item });
}

export async function removeSavedListItem(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id, itemId } = req.params;

  const access = await findListAccess(id, userId);
  if (!access) return res.status(404).json({ error: 'Saved list not found' });
  if (!access.canWrite) return res.status(403).json({ error: 'Contributor access required to edit this list' });
  const list = access.list;

  const existing = await prisma.savedListItem.findFirst({ where: { id: itemId, listId: id } });
  if (!existing) return res.status(404).json({ error: 'Item not found in list' });

  await prisma.savedListItem.delete({ where: { id: itemId } });
  await prisma.savedList.update({ where: { id }, data: { updatedAt: new Date() } });
  await recordAuditEvent({
    userId,
    action: 'list.item_removed',
    entityType: 'saved_list',
    entityId: id,
    summary: `Removed item from saved list ${list.name}`,
    metadata: { itemId },
  });

  return res.status(204).send();
}

function includeListItems() {
  return {
    user: { select: { id: true, email: true } },
    items: {
      include: includeSavedListItem(true),
      orderBy: { createdAt: 'asc' as const },
    },
    shares: {
      include: {
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'asc' as const },
    },
  };
}

function includeSavedListItem(includeRetailerProducts = false) {
  return {
    product: includeRetailerProducts
      ? { include: { retailerProducts: true } }
      : true,
    addedByUser: { select: { id: true, email: true } },
    updatedByUser: { select: { id: true, email: true } },
    approvedByUser: { select: { id: true, email: true } },
  };
}

async function findAccessibleList(listId: string, userId: string) {
  return prisma.savedList.findFirst({
    where: {
      id: listId,
      OR: [{ userId }, { shares: { some: { userId } } }],
    },
    include: { items: true },
  });
}

async function findListAccess(listId: string, userId: string) {
  const list = await prisma.savedList.findFirst({
    where: {
      id: listId,
      OR: [{ userId }, { shares: { some: { userId } } }],
    },
    include: includeListItems(),
  });
  if (!list) return null;

  const share = list.shares.find((entry: any) => entry.userId === userId);
  const role = list.userId === userId ? 'owner' : share?.role || 'viewer';
  return {
    list,
    role,
    canWrite: role === 'owner' || role === 'contributor',
  };
}

async function findOwnedList(listId: string, userId: string) {
  return prisma.savedList.findFirst({
    where: { id: listId, userId },
    include: includeListItems(),
  });
}

export async function listSavedLists(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const lists = await prisma.savedList.findMany({
    where: {
      OR: [{ userId }, { shares: { some: { userId } } }],
    },
    include: includeListItems(),
    orderBy: { updatedAt: 'desc' },
  });
  return res.json({ lists });
}

export async function getSavedList(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  const access = await findListAccess(id, userId);
  if (!access) return res.status(404).json({ error: 'Saved list not found' });

  return res.json({
    list: access.list,
    access: {
      role: access.role,
      canWrite: access.canWrite,
    },
  });
}

export async function createSavedList(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const name = String(req.body?.name || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const list = await prisma.savedList.create({
    data: { userId, name },
    include: includeListItems(),
  });

  await recordAuditEvent({
    userId,
    action: 'list.created',
    entityType: 'saved_list',
    entityId: list.id,
    summary: `Created saved list ${list.name}`,
  });

  return res.status(201).json({ list });
}

export async function saveActiveCartAsList(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const name = String(req.body?.name || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const cart = await getOrCreateCart(userId);
  const list = await prisma.savedList.create({
    data: {
      userId,
      name,
      items: {
        create: cart.items.map((item) => ({
          productId: item.productId,
          sourceRetailer: item.sourceRetailer,
          quantity: item.quantity,
          addedByUserId: userId,
          updatedByUserId: userId,
        })),
      },
    },
    include: includeListItems(),
  });

  await recordAuditEvent({
    userId,
    action: 'list.created_from_cart',
    entityType: 'saved_list',
    entityId: list.id,
    summary: `Saved active cart as ${list.name}`,
    metadata: { itemCount: list.items.length },
  });

  return res.status(201).json({ list });
}

export async function restoreSavedListToCart(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  const list = await findAccessibleList(id, userId);

  if (!list) return res.status(404).json({ error: 'Saved list not found' });

  for (const item of list.items) {
    await addItemToCart(userId, item.productId, item.sourceRetailer, item.quantity);
  }

  await recordAuditEvent({
    userId,
    action: 'list.restored_to_cart',
    entityType: 'saved_list',
    entityId: list.id,
    summary: `Added ${list.name} to active cart`,
    metadata: { itemCount: list.items.length },
  });

  const cart = await getOrCreateCart(userId);
  return res.json({ cart });
}

export async function renameSavedList(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  const name = String(req.body?.name || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const existing = await findOwnedList(id, userId);
  if (!existing) return res.status(404).json({ error: 'Saved list not found' });

  const list = await prisma.savedList.update({
    where: { id },
    data: { name },
    include: includeListItems(),
  });

  await recordAuditEvent({
    userId,
    action: 'list.renamed',
    entityType: 'saved_list',
    entityId: list.id,
    summary: `Renamed saved list ${existing.name} to ${list.name}`,
  });

  return res.json({ list });
}

export async function deleteSavedList(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  const list = await findOwnedList(id, userId);

  if (!list) return res.status(404).json({ error: 'Saved list not found' });

  await prisma.savedListShare.deleteMany({ where: { listId: id } });
  await prisma.savedListItem.deleteMany({ where: { listId: id } });
  await prisma.savedList.delete({ where: { id } });

  await recordAuditEvent({
    userId,
    action: 'list.deleted',
    entityType: 'saved_list',
    entityId: id,
    summary: `Deleted saved list ${list.name}`,
  });

  return res.status(204).send();
}

export async function shareSavedList(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = String(req.body?.role || 'viewer').trim();

  if (!email) return res.status(400).json({ error: 'email is required' });
  if (!['viewer', 'contributor'].includes(role)) return res.status(400).json({ error: 'unsupported role' });

  const list = await findOwnedList(id, userId);
  if (!list) return res.status(404).json({ error: 'Saved list not found' });

  const invitedUser = await prisma.user.findUnique({ where: { email } });
  if (!invitedUser) return res.status(404).json({ error: 'User with that email must sign up before sharing' });
  if (invitedUser.id === userId) return res.status(400).json({ error: 'Cannot share a list with yourself' });

  const share = await prisma.savedListShare.upsert({
    where: {
      listId_userId: {
        listId: id,
        userId: invitedUser.id,
      },
    },
    update: { role, invitedEmail: email },
    create: {
      listId: id,
      userId: invitedUser.id,
      invitedEmail: email,
      role,
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  });

  await recordAuditEvent({
    userId,
    action: 'list.shared',
    entityType: 'saved_list',
    entityId: id,
    summary: `Shared saved list ${list.name} with ${email}`,
    metadata: { sharedWithUserId: invitedUser.id, email, role },
  });

  return res.status(201).json({ share });
}

export async function inviteSavedList(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = String(req.body?.role || 'viewer').trim();

  if (!email) return res.status(400).json({ error: 'email is required' });
  if (!['viewer', 'contributor'].includes(role)) return res.status(400).json({ error: 'unsupported role' });

  const list = await findOwnedList(id, userId);
  if (!list) return res.status(404).json({ error: 'Saved list not found' });

  const invitedUser = await prisma.user.findUnique({ where: { email } });
  if (!invitedUser) return res.status(404).json({ error: 'User with that email must sign up before inviting' });
  if (invitedUser.id === userId) return res.status(400).json({ error: 'Cannot invite yourself' });

  const token = crypto.randomBytes(24).toString('base64url');
  const metadata = {
    inviteToken: token,
    inviteStatus: 'pending',
    invitedByUserId: userId,
    invitedAt: new Date().toISOString(),
  };

  const share = await prisma.savedListShare.upsert({
    where: {
      listId_userId: {
        listId: id,
        userId: invitedUser.id,
      },
    },
    update: { role, invitedEmail: email, metadata },
    create: {
      listId: id,
      userId: invitedUser.id,
      invitedEmail: email,
      role,
      metadata,
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  });

  await recordAuditEvent({
    userId,
    action: 'list.invite_created',
    entityType: 'saved_list',
    entityId: id,
    summary: `Created invite for saved list ${list.name} to ${email}`,
    metadata: { shareId: share.id, invitedUserId: invitedUser.id, email, role },
  });

  return res.status(201).json({ token, share });
}

export async function acceptSavedListInvite(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const token = String(req.body?.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token is required' });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ error: 'Invalid authenticated user' });

  const shares = await prisma.savedListShare.findMany({
    where: { userId, invitedEmail: user.email },
    include: {
      list: { include: includeListItems() },
      user: { select: { id: true, email: true } },
    },
  });
  const pendingShare = shares.find((share: any) => share.metadata?.inviteToken === token);
  if (!pendingShare) return res.status(404).json({ error: 'Invite not found' });

  const metadata = {
    ...(pendingShare.metadata as Record<string, any>),
    inviteStatus: 'accepted',
    acceptedAt: new Date().toISOString(),
  };

  const share = await prisma.savedListShare.update({
    where: { id: pendingShare.id },
    data: { metadata },
    include: {
      list: { include: includeListItems() },
      user: { select: { id: true, email: true } },
    },
  });

  await recordAuditEvent({
    userId,
    action: 'list.invite_accepted',
    entityType: 'saved_list',
    entityId: share.listId,
    summary: `Accepted invite to saved list ${share.list.name}`,
    metadata: { shareId: share.id, role: share.role },
  });

  return res.json({ share, list: share.list });
}

export async function removeSavedListShare(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id, shareId } = req.params;
  const list = await findOwnedList(id, userId);
  if (!list) return res.status(404).json({ error: 'Saved list not found' });

  const share = await prisma.savedListShare.findFirst({ where: { id: shareId, listId: id } });
  if (!share) return res.status(404).json({ error: 'Share not found' });

  await prisma.savedListShare.delete({ where: { id: shareId } });
  await recordAuditEvent({
    userId,
    action: 'list.share_removed',
    entityType: 'saved_list',
    entityId: id,
    summary: `Removed saved list share from ${share.invitedEmail}`,
    metadata: { shareId, invitedEmail: share.invitedEmail },
  });

  return res.status(204).send();
}
