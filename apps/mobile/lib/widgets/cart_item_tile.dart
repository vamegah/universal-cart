import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/cart_item.dart';
import '../providers/cart_provider.dart';

class CartItemTile extends StatelessWidget {
  final CartItem item;

  const CartItemTile({super.key, required this.item});

  double _confidencePercent() {
    final confidence = item.matchConfidence;
    if (confidence == null) return 0;
    return confidence <= 1 ? confidence * 100 : confidence;
  }

  Color _matchColor(BuildContext context) {
    switch ((item.matchType ?? 'none').toLowerCase()) {
      case 'exact':
        return Colors.green.shade700;
      case 'close':
        return Colors.amber.shade800;
      case 'similar':
      case 'substitute':
        return Colors.deepOrange.shade700;
      default:
        return Theme.of(context).colorScheme.onSurfaceVariant;
    }
  }

  Color _matchBackground(BuildContext context) {
    switch ((item.matchType ?? 'none').toLowerCase()) {
      case 'exact':
        return Colors.green.shade50;
      case 'close':
        return Colors.amber.shade50;
      case 'similar':
      case 'substitute':
        return Colors.deepOrange.shade50;
      default:
        return Theme.of(context).colorScheme.surfaceContainerHighest;
    }
  }

  Future<void> _updateQuantity(BuildContext context, int quantity) async {
    try {
      await context.read<CartProvider>().updateQuantity(item.id, quantity);
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Quantity update failed: $error')),
      );
    }
  }

  Future<void> _remove(BuildContext context) async {
    try {
      await context.read<CartProvider>().removeItem(item.id);
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Remove failed: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _ProductImage(imageUrl: item.imageUrl),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.productName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.sourceRetailer} · \$${item.price.toStringAsFixed(2)}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  if (item.matchedStore != null) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Chip(
                          label: Text('Matched: ${item.matchedStore}'),
                          visualDensity: VisualDensity.compact,
                          backgroundColor: Colors.green.shade50,
                        ),
                        Chip(
                          label: Text(
                            '${item.matchType ?? 'none'} ${_confidencePercent().round()}%',
                          ),
                          visualDensity: VisualDensity.compact,
                          backgroundColor: _matchBackground(context),
                          labelStyle: TextStyle(
                            color: _matchColor(context),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      IconButton(
                        tooltip: 'Decrease quantity',
                        icon: const Icon(Icons.remove_circle_outline),
                        onPressed: item.quantity <= 1
                            ? null
                            : () => _updateQuantity(context, item.quantity - 1),
                      ),
                      SizedBox(
                        width: 36,
                        child: Text(
                          item.quantity.toString(),
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Increase quantity',
                        icon: const Icon(Icons.add_circle_outline),
                        onPressed: () =>
                            _updateQuantity(context, item.quantity + 1),
                      ),
                      const Spacer(),
                      IconButton(
                        tooltip: 'Remove item',
                        icon: const Icon(Icons.delete_outline),
                        color: Colors.red.shade700,
                        onPressed: () => _remove(context),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductImage extends StatelessWidget {
  final String? imageUrl;

  const _ProductImage({required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    final url = imageUrl;
    if (url == null || url.isEmpty) {
      return Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(Icons.inventory_2_outlined, color: Colors.grey.shade600),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(
        url,
        width: 72,
        height: 72,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Container(
          width: 72,
          height: 72,
          color: Colors.grey.shade100,
          child: Icon(Icons.broken_image_outlined, color: Colors.grey.shade600),
        ),
      ),
    );
  }
}
