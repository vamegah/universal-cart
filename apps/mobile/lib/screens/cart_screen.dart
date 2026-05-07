import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:universal_cart_mobile/providers/cart_provider.dart';
import 'package:universal_cart_mobile/widgets/cart_item_tile.dart';
import 'package:universal_cart_mobile/widgets/match_selector.dart';
import 'checkout_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  bool _matchCompleted = false;

  @override
  Widget build(BuildContext context) {
    final cartProvider = Provider.of<CartProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Cart'),
        actions: [
          IconButton(
            tooltip: 'Sync cart',
            icon: cartProvider.isSyncing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.sync),
            onPressed: cartProvider.isAuthenticated && !cartProvider.isSyncing
                ? () async {
                    try {
                      await context.read<CartProvider>().syncCart();
                    } catch (error) {
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Sync failed: $error')),
                      );
                    }
                  }
                : null,
          ),
        ],
      ),
      body: cartProvider.items.isEmpty
          ? const Center(child: Text('Cart is empty'))
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    itemCount: cartProvider.items.length,
                    padding: const EdgeInsets.all(12),
                    itemBuilder: (ctx, i) =>
                        CartItemTile(item: cartProvider.items[i]),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(blurRadius: 4, color: Colors.grey.shade200)
                    ],
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Total:',
                              style: TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.bold)),
                          Text('\$${cartProvider.total.toStringAsFixed(2)}',
                              style: const TextStyle(fontSize: 18)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ElevatedButton(
                        onPressed: () async {
                          try {
                            await context.read<CartProvider>().clearCart();
                          } catch (error) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                  content: Text('Clear cart failed: $error')),
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red),
                        child: const Text('Clear Cart'),
                      ),
                      const SizedBox(height: 16),
                      MatchSelector(
                          onMatchComplete: () =>
                              setState(() => _matchCompleted = true)),
                      if (_matchCompleted)
                        Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: ElevatedButton(
                            onPressed: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => const CheckoutScreen())),
                            style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green),
                            child: const Text('Proceed to Checkout'),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
