import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/cart_provider.dart';

class ImportForm extends StatefulWidget {
  const ImportForm({super.key});

  @override
  State<ImportForm> createState() => _ImportFormState();
}

class _ImportFormState extends State<ImportForm> {
  final _controller = TextEditingController();
  bool _isImporting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final url = _controller.text.trim();
    if (url.isEmpty || _isImporting) return;

    final cartProvider = context.read<CartProvider>();
    if (!cartProvider.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in before importing products.')),
      );
      return;
    }

    setState(() => _isImporting = true);
    try {
      await cartProvider.addProductFromUrl(url);
      _controller.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Product added to your cart.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Import failed: $error')),
      );
    } finally {
      if (mounted) setState(() => _isImporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAuthenticated = context
        .select<CartProvider, bool>((provider) => provider.isAuthenticated);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _controller,
          enabled: isAuthenticated && !_isImporting,
          keyboardType: TextInputType.url,
          textInputAction: TextInputAction.go,
          decoration: InputDecoration(
            border: const OutlineInputBorder(),
            labelText: 'Product URL',
            hintText: isAuthenticated
                ? 'Paste a supported retailer link'
                : 'Sign in to import',
            suffixIcon: IconButton(
              tooltip: 'Import',
              icon: _isImporting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add_shopping_cart),
              onPressed: isAuthenticated && !_isImporting ? _submit : null,
            ),
          ),
          onSubmitted: (_) => _submit(),
        ),
      ],
    );
  }
}
