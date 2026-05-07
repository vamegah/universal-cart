import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/cart_provider.dart';
import '../services/api_service.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSignup = false;
  bool _isSubmitting = false;
  String? _selectedStore;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _authenticate() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty || _isSubmitting) return;

    setState(() => _isSubmitting = true);
    try {
      final provider = context.read<CartProvider>();
      if (_isSignup) {
        await provider.signup(email, password);
      } else {
        await provider.login(email, password);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_isSignup ? 'Account created.' : 'Signed in.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Authentication failed: $error')),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _savePreferredStore() async {
    setState(() => _isSubmitting = true);
    try {
      await context.read<CartProvider>().savePreferredStore(_selectedStore);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Preferences saved.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Preference update failed: $error')),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CartProvider>();
    if (_selectedStore == null &&
        CartProvider.supportedStores.contains(provider.preferredStore)) {
      _selectedStore = provider.preferredStore;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (provider.isAuthenticated)
            _SignedInPanel(
              email: provider.userEmail,
              preferredStore: _selectedStore,
              isSubmitting: _isSubmitting || provider.isSyncing,
              onStoreChanged: (value) => setState(() => _selectedStore = value),
              onSave: _savePreferredStore,
              onRefresh: () async {
                try {
                  await context.read<CartProvider>().syncCart();
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Cart synced.')),
                  );
                } catch (error) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Sync failed: $error')),
                  );
                }
              },
              onLogout: () => context.read<CartProvider>().logout(),
            )
          else
            _AuthForm(
              emailController: _emailController,
              passwordController: _passwordController,
              isSignup: _isSignup,
              isSubmitting: _isSubmitting,
              onModeChanged: (value) => setState(() => _isSignup = value),
              onSubmit: _authenticate,
            ),
        ],
      ),
    );
  }
}

class _AuthForm extends StatelessWidget {
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final bool isSignup;
  final bool isSubmitting;
  final ValueChanged<bool> onModeChanged;
  final VoidCallback onSubmit;

  const _AuthForm({
    required this.emailController,
    required this.passwordController,
    required this.isSignup,
    required this.isSubmitting,
    required this.onModeChanged,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          isSignup ? 'Create your account' : 'Sign in',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 16),
        SegmentedButton<bool>(
          segments: const [
            ButtonSegment(
                value: false, label: Text('Sign in'), icon: Icon(Icons.login)),
            ButtonSegment(
                value: true,
                label: Text('Sign up'),
                icon: Icon(Icons.person_add_alt)),
          ],
          selected: {isSignup},
          onSelectionChanged: isSubmitting
              ? null
              : (selection) => onModeChanged(selection.first),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: emailController,
          enabled: !isSubmitting,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Email',
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: passwordController,
          enabled: !isSubmitting,
          obscureText: true,
          autofillHints: const [AutofillHints.password],
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Password',
          ),
          onSubmitted: (_) => onSubmit(),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: isSubmitting ? null : onSubmit,
          icon: isSubmitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : Icon(isSignup ? Icons.person_add_alt : Icons.login),
          label: Text(isSignup ? 'Create Account' : 'Sign In'),
        ),
      ],
    );
  }
}

class _SignedInPanel extends StatelessWidget {
  final String? email;
  final String? preferredStore;
  final bool isSubmitting;
  final ValueChanged<String?> onStoreChanged;
  final VoidCallback onSave;
  final VoidCallback onRefresh;
  final VoidCallback onLogout;

  const _SignedInPanel({
    required this.email,
    required this.preferredStore,
    required this.isSubmitting,
    required this.onStoreChanged,
    required this.onSave,
    required this.onRefresh,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const CircleAvatar(child: Icon(Icons.person_outline)),
          title: Text(email ?? 'Signed in'),
          subtitle: const Text(
            'Cart and preferences sync with the backend account.',
          ),
        ),
        const SizedBox(height: 8),
        InputDecorator(
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'API endpoint',
          ),
          child: Text(ApiService.baseUrl),
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          value: CartProvider.supportedStores.contains(preferredStore)
              ? preferredStore
              : null,
          items: CartProvider.supportedStores
              .map(
                  (store) => DropdownMenuItem(value: store, child: Text(store)))
              .toList(),
          onChanged: isSubmitting ? null : onStoreChanged,
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Preferred store',
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: isSubmitting ? null : onSave,
          icon: const Icon(Icons.save_outlined),
          label: const Text('Save Preferences'),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: isSubmitting ? null : onRefresh,
          icon: const Icon(Icons.sync),
          label: const Text('Sync Cart'),
        ),
        const SizedBox(height: 8),
        TextButton.icon(
          onPressed: isSubmitting ? null : onLogout,
          icon: const Icon(Icons.logout),
          label: const Text('Sign Out'),
        ),
      ],
    );
  }
}
