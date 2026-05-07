import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:universal_cart_mobile/providers/cart_provider.dart';
import 'package:universal_cart_mobile/screens/account_screen.dart';
import 'package:universal_cart_mobile/screens/alerts_screen.dart';
import 'package:universal_cart_mobile/widgets/import_form.dart';
import 'package:universal_cart_mobile/widgets/cart_item_tile.dart';
import 'cart_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cartProvider = Provider.of<CartProvider>(context);
    final recentItems = cartProvider.items.take(3).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Universal Cart'),
        actions: [
          if (cartProvider.isAuthenticated)
            IconButton(
              tooltip: 'Alerts',
              icon: const Icon(Icons.notifications_none),
              onPressed: () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => const AlertsScreen())),
            ),
          if (cartProvider.isAuthenticated)
            IconButton(
              tooltip: 'Sync cart',
              icon: cartProvider.isSyncing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.sync),
              onPressed: cartProvider.isSyncing
                  ? null
                  : () async {
                      try {
                        await context.read<CartProvider>().syncCart();
                      } catch (error) {
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Sync failed: $error')),
                        );
                      }
                    },
            ),
          IconButton(
            tooltip: 'Account',
            icon: Icon(cartProvider.isAuthenticated
                ? Icons.account_circle
                : Icons.login),
            onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const AccountScreen())),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: cartProvider.isLoading
            ? const Center(child: CircularProgressIndicator())
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!cartProvider.isAuthenticated) ...[
                    _SignInPrompt(
                      onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const AccountScreen())),
                    ),
                    const SizedBox(height: 16),
                  ],
                  const ImportForm(),
                  if (cartProvider.preferredStore != null) ...[
                    const SizedBox(height: 8),
                    Chip(
                      avatar: const Icon(Icons.storefront, size: 18),
                      label: Text(
                          'Preferred store: ${cartProvider.preferredStore}'),
                    ),
                  ],
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Your Cart (${cartProvider.items.length})',
                          style: const TextStyle(
                              fontSize: 20, fontWeight: FontWeight.bold)),
                      if (cartProvider.items.isNotEmpty)
                        TextButton(
                          onPressed: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const CartScreen())),
                          child: const Text('View all'),
                        ),
                    ],
                  ),
                  if (cartProvider.items.isEmpty)
                    const Expanded(
                        child: Center(
                            child:
                                Text('No items yet. Import a product above.')))
                  else
                    Expanded(
                      child: ListView.builder(
                        itemCount: recentItems.length,
                        itemBuilder: (ctx, i) =>
                            CartItemTile(item: recentItems[i]),
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

class _SignInPrompt extends StatelessWidget {
  final VoidCallback onTap;

  const _SignInPrompt({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.primaryContainer,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              const Icon(Icons.lock_outline),
              const SizedBox(width: 12),
              const Expanded(
                  child: Text(
                      'Sign in to import products and sync your backend cart.')),
              TextButton(onPressed: onTap, child: const Text('Sign in')),
            ],
          ),
        ),
      ),
    );
  }
}
