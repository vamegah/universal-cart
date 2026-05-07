import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:universal_cart_mobile/providers/cart_provider.dart';

class MatchSelector extends StatefulWidget {
  final VoidCallback onMatchComplete;
  const MatchSelector({super.key, required this.onMatchComplete});

  @override
  State<MatchSelector> createState() => _MatchSelectorState();
}

class _MatchSelectorState extends State<MatchSelector> {
  String _selectedStore = '';
  bool _isMatching = false;
  int _matchedCount = 0;

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

  Future<void> _match() async {
    if (_selectedStore.isEmpty) return;
    setState(() {
      _isMatching = true;
      _matchedCount = 0;
    });
    final cartProvider = Provider.of<CartProvider>(context, listen: false);
    int success = 0;
    for (final item in cartProvider.items) {
      try {
        final result = await cartProvider.matchItem(item, _selectedStore);
        if (result['retailerProduct'] != null) {
          try {
            await cartProvider.saveSelectedMatch(item, _selectedStore, result);
            success++;
          } catch (e) {
            final retailerProduct = result['retailerProduct'];
            cartProvider.setMatch(
              item.id,
              _selectedStore,
              retailerProduct['id'] as String,
              sku: retailerProduct['retailerSku'] as String?,
              url: retailerProduct['url'] as String?,
              matchType: result['matchType'] as String?,
              confidence: (result['confidence'] as num?)?.toDouble(),
            );
            debugPrint(
                'Save selected match failed for ${item.productName}: $e');
          }
        }
      } catch (e) {
        debugPrint('Match failed for ${item.productName}: $e');
      }
    }
    setState(() {
      _matchedCount = success;
      _isMatching = false;
    });
    widget.onMatchComplete();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Optimize with your preferred store',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                value: _selectedStore.isEmpty ? null : _selectedStore,
                hint: const Text('Select store'),
                items: CartProvider.supportedStores
                    .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                    .toList(),
                onChanged: (v) => setState(() => _selectedStore = v!),
                decoration: const InputDecoration(border: OutlineInputBorder()),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: _isMatching ? null : _match,
              style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
              child: _isMatching
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Find Matches'),
            ),
          ],
        ),
        if (_matchedCount > 0) const SizedBox(height: 8),
        if (_matchedCount > 0)
          Text('$_matchedCount items matched',
              style: const TextStyle(color: Colors.green)),
      ],
    );
  }
}
