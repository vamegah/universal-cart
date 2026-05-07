import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../models/cart_item.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class CartProvider extends ChangeNotifier {
  static const supportedStores = [
    'Amazon',
    'Walmart',
    'Target',
    "Macy's",
    'BestBuy',
    'Shopify'
  ];

  final StorageService _storage = StorageService();
  final ApiService _api = ApiService();
  List<CartItem> _items = [];
  bool _isLoading = true;
  bool _isSyncing = false;
  bool _isAuthenticated = false;
  String? _userEmail;
  String? _preferredStore;
  String? _lastError;

  List<CartItem> get items => _items;
  double get total => _items.fold(0, (sum, i) => sum + (i.price * i.quantity));
  bool get isLoading => _isLoading;
  bool get isSyncing => _isSyncing;
  bool get isAuthenticated => _isAuthenticated;
  String? get userEmail => _userEmail;
  String? get preferredStore => _preferredStore;
  String? get lastError => _lastError;

  CartProvider() {
    _initialize();
  }

  Future<void> _initialize() async {
    _items = await _storage.loadCart();
    final token = await _storage.loadAuthToken();
    if (token != null && token.isNotEmpty) {
      try {
        final userResponse = await _api.refreshSession();
        _setUserFromResponse(userResponse);
        _isAuthenticated = true;
        await _loadProfile();
        await syncCart(notify: false);
      } on UnauthorizedException {
        await _api.clearAuthToken();
        _isAuthenticated = false;
        _userEmail = null;
        _preferredStore = null;
      } catch (error) {
        _lastError = error.toString();
      }
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> _persist() async {
    await _storage.saveCart(_items);
  }

  void _setUserFromResponse(Map<String, dynamic> response) {
    final user = response['user'];
    if (user is Map) {
      _userEmail = user['email']?.toString();
    }
  }

  Future<void> _loadProfile() async {
    final profile = await _api.getProfile();
    final preferences = profile['preferences'];
    if (preferences is Map) {
      _preferredStore = preferences['defaultStore']?.toString();
    }
  }

  Future<void> _withRemoteMutation(Future<void> Function() action) async {
    try {
      await action();
      _lastError = null;
    } on UnauthorizedException {
      await logout();
      throw Exception('Your session expired. Please sign in again.');
    } catch (error) {
      _lastError = error.toString();
      rethrow;
    }
  }

  Future<void> login(String email, String password) async {
    _isSyncing = true;
    _lastError = null;
    notifyListeners();
    try {
      final response = await _api.login(email, password);
      _setUserFromResponse(response);
      _isAuthenticated = true;
      await _loadProfile();
      await syncCart(notify: false);
    } catch (error) {
      _lastError = error.toString();
      rethrow;
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  Future<void> signup(String email, String password) async {
    _isSyncing = true;
    _lastError = null;
    notifyListeners();
    try {
      final response = await _api.signup(email, password);
      _setUserFromResponse(response);
      _isAuthenticated = true;
      await _loadProfile();
      await syncCart(notify: false);
    } catch (error) {
      _lastError = error.toString();
      rethrow;
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _api.logout();
    _isAuthenticated = false;
    _userEmail = null;
    _preferredStore = null;
    _items = [];
    await _storage.clearCart();
    notifyListeners();
  }

  Future<void> syncCart({bool notify = true}) async {
    if (!_isAuthenticated) return;
    _isSyncing = true;
    if (notify) notifyListeners();
    try {
      _items = await _api.getCart();
      await _persist();
      _lastError = null;
    } on UnauthorizedException {
      await logout();
      throw Exception('Your session expired. Please sign in again.');
    } catch (error) {
      _lastError = error.toString();
      rethrow;
    } finally {
      _isSyncing = false;
      if (notify) notifyListeners();
    }
  }

  Future<void> savePreferredStore(String? store) async {
    if (!_isAuthenticated) {
      throw Exception('Sign in to save preferences.');
    }
    await _withRemoteMutation(() async {
      await _api.savePreferences(
          defaultStore: store?.isEmpty == true ? null : store);
      _preferredStore = store?.isEmpty == true ? null : store;
    });
    notifyListeners();
  }

  Future<void> addProductFromUrl(String url) async {
    if (!_isAuthenticated) {
      throw Exception('Sign in to import products to your cart.');
    }
    final product = await _api.importProduct(url);
    final newItem = CartItem(
      id: product.cartItemId ?? const Uuid().v4(),
      productId: product.id,
      sourceRetailer: product.sourceRetailer,
      productName: product.productName,
      price: product.price,
      imageUrl: product.imageUrl,
      brand: product.brand,
      model: product.model,
      upc: product.upc,
      category: product.category,
      retailerProductId: product.retailerProductId,
      retailerSku: product.retailerSku,
      sourceUrl: product.url,
    );
    _items.add(newItem);
    await _persist();
    notifyListeners();

    try {
      await syncCart();
    } catch (_) {
      // Keep the imported item visible even if cart hydration is temporarily unavailable.
    }
  }

  Future<void> removeItem(String id) async {
    final snapshot = List<CartItem>.from(_items);
    _items.removeWhere((i) => i.id == id);
    await _persist();
    notifyListeners();

    if (!_isAuthenticated) return;
    try {
      await _api.removeCartItem(id);
    } catch (error) {
      _items = snapshot;
      await _persist();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> updateQuantity(String id, int newQuantity) async {
    final index = _items.indexWhere((i) => i.id == id);
    if (index != -1) {
      final previous = _items[index].quantity;
      final quantity = newQuantity.clamp(1, 99);
      _items[index].quantity = quantity;
      await _persist();
      notifyListeners();

      if (!_isAuthenticated) return;
      try {
        await _api.updateCartItemQuantity(id, quantity);
      } catch (error) {
        _items[index].quantity = previous;
        await _persist();
        notifyListeners();
        rethrow;
      }
    }
  }

  void setMatch(
    String itemId,
    String store,
    String productId, {
    String? sku,
    String? url,
    String? matchType,
    double? confidence,
    double? matchedPrice,
  }) {
    final index = _items.indexWhere((i) => i.id == itemId);
    if (index != -1) {
      _items[index].matchedStore = store;
      _items[index].matchedProductId = productId;
      _items[index].matchedSku = sku;
      _items[index].matchedUrl = url;
      _items[index].matchType = matchType;
      _items[index].matchConfidence = confidence;
      _items[index].matchedPrice = matchedPrice;
      _persist();
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> matchItem(
      CartItem item, String preferredStore) async {
    return await _api.matchProduct(item, preferredStore);
  }

  Future<Map<String, dynamic>> saveSelectedMatch(
    CartItem item,
    String preferredStore,
    Map<String, dynamic> matchResult,
  ) async {
    final retailerProduct = matchResult['retailerProduct'];
    if (retailerProduct == null || retailerProduct['id'] == null) {
      throw Exception('No retailer product selected');
    }

    final selected = await _api.saveSelectedMatch(
      item.id,
      retailerProduct['id'] as String,
      matchResult['matchType'] as String? ?? 'none',
      (matchResult['confidence'] as num?)?.toDouble() ?? 0.0,
    );

    setMatch(
      item.id,
      preferredStore,
      retailerProduct['id'] as String,
      sku: retailerProduct['retailerSku'] as String?,
      url: retailerProduct['url'] as String?,
      matchType: matchResult['matchType'] as String?,
      confidence: (matchResult['confidence'] as num?)?.toDouble(),
      matchedPrice: (retailerProduct['price'] as num?)?.toDouble(),
    );
    return selected;
  }

  Future<void> clearCart() async {
    final snapshot = List<CartItem>.from(_items);
    _items.clear();
    await _persist();
    notifyListeners();

    if (!_isAuthenticated) return;
    try {
      await _api.clearRemoteCart();
    } catch (error) {
      _items = snapshot;
      await _persist();
      notifyListeners();
      rethrow;
    }
  }
}
