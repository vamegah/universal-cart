// src/routes/cart.ts
import { Router } from 'express';
import { getCart, addItem, clearCart, deleteItem, updateQuantity } from '../controllers/cartController';
import { requireAuth } from '../middleware/auth';
const router = Router();
router.use(requireAuth);
router.get('/', getCart);
router.delete('/', clearCart);
router.post('/items', addItem);
router.delete('/items/:id', deleteItem);
router.put('/items/:id/quantity', updateQuantity);
export default router;
