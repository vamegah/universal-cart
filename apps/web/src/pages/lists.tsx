import {
  addSavedListItem,
  createSavedList,
  deleteSavedList,
  getSavedLists,
  renameSavedList,
  removeSavedListItem,
  removeSavedListShare,
  restoreSavedList,
  saveActiveCartAsList,
  shareSavedList,
  updateSavedListItem,
} from '@/services/api';
import { useCart } from '@/hooks/useCart';
import { useEffect, useState } from 'react';

type SavedList = {
  id: string;
  name: string;
  updatedAt: string;
  userId?: string;
  user?: {
    email: string;
  };
  shares?: Array<{
    id: string;
    role: string;
    invitedEmail: string;
    user?: {
      email: string;
    };
  }>;
  items: Array<{
    id: string;
    quantity: number;
    sourceRetailer: string;
    approvedAt?: string;
    addedByUser?: {
      email: string;
    };
    updatedByUser?: {
      email: string;
    };
    approvedByUser?: {
      email: string;
    };
    product?: {
      name: string;
      imageUrl?: string;
    };
  }>;
};

export default function ListsPage() {
  const { hydrateCart, items } = useCart();
  const [lists, setLists] = useState<SavedList[]>([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [sharingListId, setSharingListId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('viewer');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemQty, setEditingItemQty] = useState(1);

  async function loadLists() {
    const data = await getSavedLists();
    setLists(data || []);
  }

  useEffect(() => {
    loadLists().catch((loadError: any) => {
      setError(loadError.response?.status === 401 ? 'Sign in to use saved lists.' : 'Unable to load saved lists.');
    });
  }, []);

  async function saveCart() {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      await saveActiveCartAsList(name || `Saved cart ${new Date().toLocaleDateString()}`);
      setName('');
      await loadLists();
      setStatus('Active cart saved as a reusable list.');
    } catch (saveError: any) {
      setError(saveError.response?.data?.error || 'Unable to save list.');
    } finally {
      setIsBusy(false);
    }
  }

  async function createEmptyList() {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      await createSavedList(name || `Reusable list ${new Date().toLocaleDateString()}`);
      setName('');
      await loadLists();
      setStatus('Reusable list created.');
    } catch (createError: any) {
      setError(createError.response?.data?.error || 'Unable to create list.');
    } finally {
      setIsBusy(false);
    }
  }

  function startRename(list: SavedList) {
    setEditingListId(list.id);
    setEditingName(list.name);
    setError('');
    setStatus('');
  }

  async function saveRename(listId: string) {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      await renameSavedList(listId, editingName);
      setEditingListId(null);
      setEditingName('');
      await loadLists();
      setStatus('Saved list renamed.');
    } catch (renameError: any) {
      setError(renameError.response?.data?.error || 'Unable to rename list.');
    } finally {
      setIsBusy(false);
    }
  }

  async function restoreList(listId: string) {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      await restoreSavedList(listId);
      await hydrateCart();
      setStatus('Saved list added to active cart.');
    } catch (restoreError: any) {
      setError(restoreError.response?.data?.error || 'Unable to restore list.');
    } finally {
      setIsBusy(false);
    }
  }

  async function removeList(listId: string) {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      await deleteSavedList(listId);
      await loadLists();
      setStatus('Saved list deleted.');
    } catch (deleteError: any) {
      setError(deleteError.response?.data?.error || 'Unable to delete list.');
    } finally {
      setIsBusy(false);
    }
  }

  async function shareList(listId: string) {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      await shareSavedList(listId, shareEmail, shareRole);
      setSharingListId(null);
      setShareEmail('');
      setShareRole('viewer');
      await loadLists();
      setStatus('Saved list shared.');
    } catch (shareError: any) {
      setError(shareError.response?.data?.error || 'Unable to share list.');
    } finally {
      setIsBusy(false);
    }
  }

  async function unshareList(listId: string, shareId: string) {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      await removeSavedListShare(listId, shareId);
      await loadLists();
      setStatus('Saved list share removed.');
    } catch (shareError: any) {
      setError(shareError.response?.data?.error || 'Unable to remove share.');
    } finally {
      setIsBusy(false);
    }
  }

  function startEditItem(itemId: string, currentQty: number) {
    setEditingItemId(itemId);
    setEditingItemQty(currentQty);
    setError('');
    setStatus('');
  }

  async function saveItemQty(listId: string, itemId: string) {
    setIsBusy(true);
    try {
      await updateSavedListItem(listId, itemId, { quantity: editingItemQty });
      setEditingItemId(null);
      await loadLists();
      setStatus('Item quantity updated.');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Unable to update item.');
    } finally {
      setIsBusy(false);
    }
  }

  async function approveItem(listId: string, itemId: string) {
    setIsBusy(true);
    try {
      await updateSavedListItem(listId, itemId, { approved: true });
      await loadLists();
      setStatus('Item approved.');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Unable to approve item.');
    } finally {
      setIsBusy(false);
    }
  }

  async function removeItem(listId: string, itemId: string) {
    setIsBusy(true);
    try {
      await removeSavedListItem(listId, itemId);
      await loadLists();
      setStatus('Item removed from list.');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Unable to remove item.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Saved Lists</h1>
      <section className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-semibold mb-3">Create Or Save A List</h2>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="List name"
            className="flex-1 rounded border px-4 py-2"
          />
          <button
            type="button"
            onClick={saveCart}
            disabled={isBusy || items.length === 0}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Save cart
          </button>
          <button
            type="button"
            onClick={createEmptyList}
            disabled={isBusy}
            className="rounded border border-blue-300 px-4 py-2 text-blue-700 disabled:opacity-50"
          >
            Create empty
          </button>
        </div>
        {items.length === 0 && <p className="mt-2 text-sm text-gray-500">Add items to your cart before saving a list.</p>}
      </section>

      {status && <div className="mb-4 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-900">{status}</div>}
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}

      <div className="space-y-4">
        {lists.length === 0 ? (
          <p className="text-gray-500">No saved lists yet.</p>
        ) : (
          lists.map((list) => (
            <article key={list.id} className="rounded-lg bg-white p-5 shadow">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  {editingListId === list.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className="rounded border px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => saveRename(list.id)}
                        disabled={isBusy}
                        className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingListId(null)}
                        disabled={isBusy}
                        className="rounded border px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <h2 className="font-semibold">{list.name}</h2>
                  )}
                  <p className="text-sm text-gray-500">
                    {list.items.length} item{list.items.length === 1 ? '' : 's'} - Updated {new Date(list.updatedAt).toLocaleDateString()}
                  </p>
                  {list.user?.email && <p className="text-xs text-gray-500">Owner: {list.user.email}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startRename(list)}
                    disabled={isBusy || editingListId === list.id}
                    className="rounded border px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => restoreList(list.id)}
                    disabled={isBusy}
                    className="rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    Add to cart
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharingListId(list.id)}
                    disabled={isBusy}
                    className="rounded border px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={() => removeList(list.id)}
                    disabled={isBusy}
                    className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {list.items.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm text-gray-600">
                    {editingItemId === item.id ? (
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[120px]">{item.product?.name || 'Unknown'}</span>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={editingItemQty}
                          onChange={(e) => setEditingItemQty(Number(e.target.value))}
                          className="w-14 rounded border px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => saveItemQty(list.id, item.id)}
                          disabled={isBusy}
                          className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="rounded border px-2 py-1 text-xs text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate">{item.product?.name || 'Unknown product'} x{item.quantity} from {item.sourceRetailer}</p>
                        <p className="text-xs text-gray-400">
                          {item.addedByUser?.email ? `Added by ${item.addedByUser.email}` : 'Added before attribution'}
                          {item.approvedByUser?.email ? ` - Approved by ${item.approvedByUser.email}` : ''}
                        </p>
                      </div>
                    )}
                    {editingItemId !== item.id && (
                      <div className="flex gap-1 ml-2">
                        <button
                          type="button"
                          onClick={() => startEditItem(item.id, item.quantity)}
                          disabled={isBusy}
                          className="rounded border px-2 py-1 text-xs text-gray-600 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(list.id, item.id)}
                          disabled={isBusy}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                        {!item.approvedAt && (
                          <button
                            type="button"
                            onClick={() => approveItem(list.id, item.id)}
                            disabled={isBusy}
                            className="rounded border border-green-300 px-2 py-1 text-xs text-green-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {list.items.length > 4 && (
                  <p className="text-xs text-gray-400 col-span-2">+{list.items.length - 4} more items</p>
                )}
              </div>
              {sharingListId === list.id && (
                <div className="mt-4 grid gap-2 rounded border bg-gray-50 p-3 md:grid-cols-4">
                  <input
                    value={shareEmail}
                    onChange={(event) => setShareEmail(event.target.value)}
                    placeholder="Collaborator email"
                    className="rounded border px-3 py-2 text-sm md:col-span-2"
                  />
                  <select value={shareRole} onChange={(event) => setShareRole(event.target.value)} className="rounded border px-3 py-2 text-sm">
                    <option value="viewer">Viewer</option>
                    <option value="contributor">Contributor</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => shareList(list.id)}
                    disabled={isBusy}
                    className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    Invite
                  </button>
                </div>
              )}
              {list.shares && list.shares.length > 0 && (
                <div className="mt-3 space-y-2">
                  {list.shares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between rounded border px-3 py-2 text-xs text-gray-600">
                      <span>{share.user?.email || share.invitedEmail} - {share.role}</span>
                      <button type="button" onClick={() => unshareList(list.id, share.id)} className="text-red-700">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
