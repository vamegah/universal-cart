import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/cart_provider.dart';
import '../services/api_service.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _targetController = TextEditingController();
  List<Map<String, dynamic>> _alerts = [];
  bool _isLoading = true;
  bool _isSaving = false;
  String _alertType = 'price_drop';
  String? _selectedProductId;

  static const _alertTypes = [
    {'value': 'price_drop', 'label': 'Price drop'},
    {'value': 'restock', 'label': 'Restock'},
    {'value': 'transfer_opportunity', 'label': 'Transfer opportunity'},
    {'value': 'promo_expiration', 'label': 'Promo expiration'},
    {'value': 'card_offer', 'label': 'Card offer'},
  ];

  @override
  void initState() {
    super.initState();
    _loadAlerts();
  }

  @override
  void dispose() {
    _targetController.dispose();
    super.dispose();
  }

  Future<void> _loadAlerts() async {
    setState(() => _isLoading = true);
    try {
      final alerts = await _api.getAlerts();
      if (!mounted) return;
      setState(() {
        _alerts = alerts;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Alerts failed to load: $error')),
      );
    }
  }

  Future<void> _createAlert() async {
    final productId = _selectedProductId;
    if (productId == null || productId.isEmpty) return;

    setState(() => _isSaving = true);
    try {
      final targetText = _targetController.text.trim();
      await _api.createAlert(
        productId: productId,
        alertType: _alertType,
        targetPrice:
            targetText.isEmpty ? null : double.tryParse(targetText),
      );
      _targetController.clear();
      await _loadAlerts();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Alert saved')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Alert save failed: $error')),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _deleteAlert(String alertId) async {
    try {
      await _api.deleteAlert(alertId);
      await _loadAlerts();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Alert deleted')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Delete failed: $error')),
      );
    }
  }

  void _openCreateSheet() {
    final cartItems = context.read<CartProvider>().items;
    if (cartItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add a cart product before creating alerts.')),
      );
      return;
    }

    _selectedProductId ??= cartItems.first.productId;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom + 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Create alert',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    value: _selectedProductId,
                    decoration: const InputDecoration(
                      labelText: 'Product',
                      border: OutlineInputBorder(),
                    ),
                    items: cartItems
                        .where((item) => item.productId != null)
                        .map(
                          (item) => DropdownMenuItem(
                            value: item.productId,
                            child: Text(
                              item.productName,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      setSheetState(() => _selectedProductId = value);
                    },
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _alertType,
                    decoration: const InputDecoration(
                      labelText: 'Alert type',
                      border: OutlineInputBorder(),
                    ),
                    items: _alertTypes
                        .map(
                          (type) => DropdownMenuItem(
                            value: type['value'],
                            child: Text(type['label']!),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      setSheetState(() => _alertType = value ?? 'price_drop');
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _targetController,
                    decoration: const InputDecoration(
                      labelText: 'Target price',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _isSaving
                        ? null
                        : () async {
                            await _createAlert();
                            if (mounted) Navigator.pop(context);
                          },
                    child: Text(_isSaving ? 'Saving...' : 'Save alert'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  String _alertLabel(String value) {
    return _alertTypes.firstWhere(
      (type) => type['value'] == value,
      orElse: () => {'label': value},
    )['label']!;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alerts')),
      floatingActionButton: FloatingActionButton(
        onPressed: _openCreateSheet,
        child: const Icon(Icons.add_alert_outlined),
      ),
      body: RefreshIndicator(
        onRefresh: _loadAlerts,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _alerts.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 160),
                      Center(child: Text('No alert subscriptions yet.')),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _alerts.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final alert = _alerts[index];
                      final product = alert['product'] is Map
                          ? Map<String, dynamic>.from(alert['product'] as Map)
                          : <String, dynamic>{};
                      final targetPrice = alert['targetPrice'];
                      return Card(
                        child: ListTile(
                          title: Text(product['name']?.toString() ?? 'Product alert'),
                          subtitle: Text(
                            '${_alertLabel(alert['alertType']?.toString() ?? '')} - ${alert['status'] ?? 'active'}'
                            '${targetPrice == null ? '' : '\nTarget \$${(targetPrice as num).toStringAsFixed(2)}'}',
                          ),
                          isThreeLine: targetPrice != null,
                          trailing: IconButton(
                            tooltip: 'Delete alert',
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () => _deleteAlert(alert['id'].toString()),
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
