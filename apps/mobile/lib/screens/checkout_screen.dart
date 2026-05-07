import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:universal_cart_mobile/providers/cart_provider.dart';
import 'package:universal_cart_mobile/services/api_service.dart';
import 'package:url_launcher/url_launcher.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _selectedStore = '';
  bool _isLoading = false;
  bool _isOptimizing = false;
  Map<String, dynamic>? _splitPlan;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final preferredStore = context.read<CartProvider>().preferredStore;
    if (_selectedStore.isEmpty &&
        preferredStore != null &&
        CartProvider.supportedStores.contains(preferredStore)) {
      _selectedStore = preferredStore;
    }
  }

  Future<void> _checkout() async {
    if (_selectedStore.isEmpty) return;
    setState(() => _isLoading = true);
    try {
      final api = ApiService();
      final redirectUrl = await api.getCartRedirectUrl(
        Provider.of<CartProvider>(context, listen: false).items,
        _selectedStore,
      );
      if (await canLaunchUrl(Uri.parse(redirectUrl))) {
        await launchUrl(Uri.parse(redirectUrl),
            mode: LaunchMode.externalApplication);
      } else {
        throw 'Could not launch $redirectUrl';
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Checkout failed: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _optimize() async {
    final items = context.read<CartProvider>().items;
    if (items.isEmpty) return;
    setState(() => _isOptimizing = true);
    try {
      final plan = await ApiService().optimizeCart(items);
      if (!mounted) return;
      setState(() => _splitPlan = plan);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Optimization failed: $error')),
      );
    } finally {
      if (mounted) setState(() => _isOptimizing = false);
    }
  }

  Map<String, List<Map<String, dynamic>>> _assignmentsByStore() {
    final assignments = _splitPlan?['assignments'] is List
        ? _splitPlan!['assignments'] as List
        : const [];
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final raw in assignments) {
      final assignment = Map<String, dynamic>.from(raw as Map);
      final store = assignment['store']?.toString() ?? 'Store';
      grouped.putIfAbsent(store, () => []).add(assignment);
    }
    return grouped;
  }

  Widget _buildSplitPlan(CartProvider cartProvider) {
    final plan = _splitPlan;
    if (plan == null) {
      return const SizedBox.shrink();
    }

    final storeTotals = plan['storeTotals'] is Map
        ? Map<String, dynamic>.from(plan['storeTotals'] as Map)
        : <String, dynamic>{};
    final totalCost = plan['totalCost'] is num
        ? (plan['totalCost'] as num).toDouble()
        : cartProvider.total;
    final grouped = _assignmentsByStore();

    return Card(
      margin: const EdgeInsets.only(top: 12, bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Split plan',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                Text('\$${totalCost.toStringAsFixed(2)}'),
              ],
            ),
            const SizedBox(height: 8),
            ...grouped.entries.map((entry) {
              final storeTotal = storeTotals[entry.key] is num
                  ? (storeTotals[entry.key] as num).toDouble()
                  : 0.0;
              return Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${entry.key} - \$${storeTotal.toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    ...entry.value.map((assignment) {
                      final item = cartProvider.items.firstWhere(
                        (cartItem) => cartItem.id == assignment['itemId'],
                        orElse: () => cartProvider.items.first,
                      );
                      final cost = assignment['totalCost'] is num
                          ? (assignment['totalCost'] as num).toDouble()
                          : 0.0;
                      return Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          '${item.productName} - \$${cost.toStringAsFixed(2)}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cartProvider = Provider.of<CartProvider>(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            const Text('Order Summary',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Expanded(
              child: ListView.builder(
                itemCount: cartProvider.items.length,
                itemBuilder: (ctx, i) {
                  final item = cartProvider.items[i];
                  return ListTile(
                    title: Text(item.productName),
                    subtitle: Text(
                        '${item.quantity} x \$${item.price.toStringAsFixed(2)}'),
                    trailing: item.matchedStore != null
                        ? Chip(
                            label: Text('-> ${item.matchedStore}'),
                            backgroundColor: Colors.green.shade100)
                        : null,
                  );
                },
              ),
            ),
            const Divider(),
            _buildSplitPlan(cartProvider),
            Text(
              'Total: \$${cartProvider.total.toStringAsFixed(2)}',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _selectedStore.isEmpty ? null : _selectedStore,
              hint: const Text('Select store with your card'),
              items: CartProvider.supportedStores
                  .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                  .toList(),
              onChanged: (v) => setState(() => _selectedStore = v!),
              decoration: const InputDecoration(border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _isOptimizing ? null : _optimize,
              icon: _isOptimizing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.account_tree_outlined),
              label: Text(_isOptimizing ? 'Optimizing...' : 'Optimize split plan'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _isLoading ? null : _checkout,
              style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(50)),
              child: _isLoading
                  ? const CircularProgressIndicator()
                  : const Text('Checkout with Selected Store'),
            ),
          ],
        ),
      ),
    );
  }
}
