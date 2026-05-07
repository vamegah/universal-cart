import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/cart_provider.dart';
import 'account_screen.dart';

class ShareImportScreen extends StatefulWidget {
  final String sharedUrl;

  const ShareImportScreen({super.key, required this.sharedUrl});

  @override
  State<ShareImportScreen> createState() => _ShareImportScreenState();
}

class _ShareImportScreenState extends State<ShareImportScreen> {
  _Status _status = _Status.idle;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryImport());
  }

  Future<void> _tryImport() async {
    final cartProvider = context.read<CartProvider>();
    if (!cartProvider.isAuthenticated) {
      setState(() => _status = _Status.needsAuth);
      return;
    }
    await _import();
  }

  Future<void> _import() async {
    setState(() {
      _status = _Status.importing;
      _errorMessage = null;
    });
    try {
      await context.read<CartProvider>().addProductFromUrl(widget.sharedUrl);
      if (!mounted) return;
      setState(() => _status = _Status.success);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _status = _Status.error;
        _errorMessage = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Import Product')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.sharedUrl,
              style: Theme.of(context).textTheme.bodySmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 24),
            _buildBody(context),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    switch (_status) {
      case _Status.importing:
        return const Column(children: [
          CircularProgressIndicator(),
          SizedBox(height: 16),
          Text('Importing product…', textAlign: TextAlign.center),
        ]);

      case _Status.success:
        return Column(children: [
          const Icon(Icons.check_circle, color: Colors.green, size: 48),
          const SizedBox(height: 12),
          const Text('Product added to your cart.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Go to Cart'),
          ),
        ]);

      case _Status.error:
        return Column(children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 48),
          const SizedBox(height: 12),
          Text(_errorMessage ?? 'Import failed.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 24),
          ElevatedButton(onPressed: _import, child: const Text('Retry')),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
        ]);

      case _Status.needsAuth:
        return Column(children: [
          const Icon(Icons.lock_outline, size: 48),
          const SizedBox(height: 12),
          const Text('Sign in to import this product.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16)),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () async {
              await Navigator.push(context,
                  MaterialPageRoute(builder: (_) => const AccountScreen()));
              if (!mounted) return;
              final cartProvider = context.read<CartProvider>();
              if (cartProvider.isAuthenticated) await _import();
            },
            child: const Text('Sign In'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
        ]);

      case _Status.idle:
        return const SizedBox.shrink();
    }
  }
}

enum _Status { idle, importing, success, error, needsAuth }
