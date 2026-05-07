import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSavedListFindFirst = jest.fn<(args: any) => Promise<any>>();
const mockSavedListUpdate = jest.fn<(args: any) => Promise<any>>();
const mockProductFindUnique = jest.fn<(args: any) => Promise<any>>();
const mockSavedListItemFindFirst = jest.fn<(args: any) => Promise<any>>();
const mockSavedListItemCreate = jest.fn<(args: any) => Promise<any>>();
const mockSavedListItemUpdate = jest.fn<(args: any) => Promise<any>>();
const mockSavedListItemDelete = jest.fn<(args: any) => Promise<any>>();
const mockSavedListShareUpsert = jest.fn<(args: any) => Promise<any>>();
const mockSavedListShareFindMany = jest.fn<(args: any) => Promise<any[]>>();
const mockSavedListShareUpdate = jest.fn<(args: any) => Promise<any>>();
const mockUserFindUnique = jest.fn<(args: any) => Promise<any>>();
const mockRecordAuditEvent = jest.fn<() => Promise<void>>();

jest.mock('../../apps/api/src/index', () => ({
  prisma: {
    savedList: {
      findFirst: mockSavedListFindFirst,
      update: mockSavedListUpdate,
    },
    product: {
      findUnique: mockProductFindUnique,
    },
    savedListItem: {
      findFirst: mockSavedListItemFindFirst,
      create: mockSavedListItemCreate,
      update: mockSavedListItemUpdate,
      delete: mockSavedListItemDelete,
    },
    savedListShare: {
      upsert: mockSavedListShareUpsert,
      findMany: mockSavedListShareFindMany,
      update: mockSavedListShareUpdate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

jest.mock('../../apps/api/src/services/cartService', () => ({
  getOrCreateCart: jest.fn(),
  addItemToCart: jest.fn(),
}));

jest.mock('../../apps/api/src/services/auditService', () => ({
  recordAuditEvent: mockRecordAuditEvent,
}));

import {
  acceptSavedListInvite,
  addSavedListItem,
  getSavedList,
  inviteSavedList,
  updateSavedListItem,
} from '../../apps/api/src/controllers/listController';

function mockReq({ userId = 'user-1', params = {}, body = {} }: { userId?: string; params?: any; body?: any }) {
  return { userId, params, body } as any;
}

function mockRes() {
  const res: any = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    send: jest.fn(() => res),
  };
  return res;
}

function listForAccess(role: 'owner' | 'viewer' | 'contributor', userId = 'user-1') {
  return {
    id: 'list-1',
    userId: role === 'owner' ? userId : 'owner-1',
    name: 'Shared Staples',
    items: [],
    shares: role === 'owner' ? [] : [{ id: 'share-1', userId, role, invitedEmail: 'user@example.com' }],
  };
}

describe('listController collaboration access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSavedListUpdate.mockResolvedValue({});
  });

  it('returns access metadata for a single saved list', async () => {
    mockSavedListFindFirst.mockResolvedValue(listForAccess('contributor'));
    const res = mockRes();

    await getSavedList(mockReq({ params: { id: 'list-1' } }), res);

    expect(res.json).toHaveBeenCalledWith({
      list: expect.objectContaining({ id: 'list-1' }),
      access: { role: 'contributor', canWrite: true },
    });
  });

  it('blocks viewers from editing shared saved-list items', async () => {
    mockSavedListFindFirst.mockResolvedValue(listForAccess('viewer'));
    const res = mockRes();

    await addSavedListItem(
      mockReq({
        params: { id: 'list-1' },
        body: { productId: 'product-1', sourceRetailer: 'Amazon', quantity: 1 },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Contributor access required to edit this list' });
    expect(mockProductFindUnique).not.toHaveBeenCalled();
  });

  it('allows contributors to add saved-list items', async () => {
    mockSavedListFindFirst.mockResolvedValue(listForAccess('contributor'));
    mockProductFindUnique.mockResolvedValue({ id: 'product-1', name: 'Coffee' });
    mockSavedListItemFindFirst.mockResolvedValue(null);
    mockSavedListItemCreate.mockResolvedValue({ id: 'item-1', productId: 'product-1', quantity: 2 });
    const res = mockRes();

    await addSavedListItem(
      mockReq({
        params: { id: 'list-1' },
        body: { productId: 'product-1', sourceRetailer: 'Amazon', quantity: 2 },
      }),
      res
    );

    expect(mockSavedListItemCreate).toHaveBeenCalledWith({
      data: {
        listId: 'list-1',
        productId: 'product-1',
        sourceRetailer: 'Amazon',
        quantity: 2,
        addedByUserId: 'user-1',
        updatedByUserId: 'user-1',
      },
      include: expect.objectContaining({
        product: true,
        addedByUser: { select: { id: true, email: true } },
        updatedByUser: { select: { id: true, email: true } },
        approvedByUser: { select: { id: true, email: true } },
      }),
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: expect.objectContaining({ id: 'item-1' }) });
  });

  it('allows owners to update saved-list items', async () => {
    mockSavedListFindFirst.mockResolvedValue(listForAccess('owner'));
    mockSavedListItemFindFirst.mockResolvedValue({ id: 'item-1', listId: 'list-1', quantity: 1 });
    mockSavedListItemUpdate.mockResolvedValue({ id: 'item-1', quantity: 3 });
    const res = mockRes();

    await updateSavedListItem(
      mockReq({
        params: { id: 'list-1', itemId: 'item-1' },
        body: { quantity: 3 },
      }),
      res
    );

    expect(mockSavedListItemUpdate).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 3, updatedByUserId: 'user-1' },
      include: expect.objectContaining({ product: true }),
    });
    expect(res.json).toHaveBeenCalledWith({ item: expect.objectContaining({ quantity: 3 }) });
  });

  it('tracks item approval on saved-list item updates', async () => {
    mockSavedListFindFirst.mockResolvedValue(listForAccess('contributor'));
    mockSavedListItemFindFirst.mockResolvedValue({ id: 'item-1', listId: 'list-1', quantity: 1 });
    mockSavedListItemUpdate.mockResolvedValue({ id: 'item-1', approvedByUserId: 'user-1' });
    const res = mockRes();

    await updateSavedListItem(
      mockReq({
        params: { id: 'list-1', itemId: 'item-1' },
        body: { approved: true },
      }),
      res
    );

    expect(mockSavedListItemUpdate).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        updatedByUserId: 'user-1',
        approvedByUserId: 'user-1',
        approvedAt: expect.any(Date),
      },
      include: expect.objectContaining({ approvedByUser: { select: { id: true, email: true } } }),
    });
  });

  it('creates invite tokens with pending metadata', async () => {
    mockSavedListFindFirst.mockResolvedValue(listForAccess('owner'));
    mockUserFindUnique.mockResolvedValue({ id: 'invitee-1', email: 'friend@example.com' });
    mockSavedListShareUpsert.mockResolvedValue({ id: 'share-1', userId: 'invitee-1', role: 'viewer' });
    const res = mockRes();

    await inviteSavedList(
      mockReq({
        params: { id: 'list-1' },
        body: { email: 'Friend@Example.com', role: 'viewer' },
      }),
      res
    );

    const upsertArgs = mockSavedListShareUpsert.mock.calls[0][0];
    expect(upsertArgs.update.metadata).toMatchObject({
      inviteStatus: 'pending',
      invitedByUserId: 'user-1',
    });
    expect(typeof upsertArgs.update.metadata.inviteToken).toBe('string');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      token: upsertArgs.update.metadata.inviteToken,
      share: expect.objectContaining({ id: 'share-1' }),
    });
  });

  it('accepts a matching invite token for the authenticated user', async () => {
    const list = listForAccess('contributor');
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    mockSavedListShareFindMany.mockResolvedValue([
      {
        id: 'share-1',
        listId: 'list-1',
        role: 'contributor',
        metadata: { inviteToken: 'token-123', inviteStatus: 'pending' },
      },
    ]);
    mockSavedListShareUpdate.mockResolvedValue({
      id: 'share-1',
      listId: 'list-1',
      role: 'contributor',
      metadata: { inviteToken: 'token-123', inviteStatus: 'accepted' },
      list,
    });
    const res = mockRes();

    await acceptSavedListInvite(mockReq({ body: { token: 'token-123' } }), res);

    expect(mockSavedListShareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'share-1' },
        data: {
          metadata: expect.objectContaining({
            inviteToken: 'token-123',
            inviteStatus: 'accepted',
            acceptedAt: expect.any(String),
          }),
        },
      })
    );
    expect(res.json).toHaveBeenCalledWith({
      share: expect.objectContaining({ id: 'share-1' }),
      list,
    });
  });
});
