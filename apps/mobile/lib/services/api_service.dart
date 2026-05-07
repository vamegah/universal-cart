import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/cart_item.dart';
import '../models/product.dart';
import 'storage_service.dart';

class ApiException implements Exception {
  final String message;
  final int statusCode;

  ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}

class UnauthorizedException extends ApiException {
  UnauthorizedException(String message, int statusCode)
      : super(message, statusCode);
}

class ApiService {
  static const String baseUrl = String.fromEnvironment(
    'UNIVERSAL_CART_API_URL',
    defaultValue: 'http://localhost:3001/api',
  );

  final StorageService _storage = StorageService();

  Future<Map<String, String>> _headers() async {
    final token = await _storage.loadAuthToken();
    return {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  Future<void> saveAuthToken(String token) => _storage.saveAuthToken(token);
  Future<void> clearAuthToken() => _storage.clearAuthToken();

  Future<Map<String, dynamic>> _decodeObject(http.Response response) async {
    final dynamic decoded =
        response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    final data = decoded is Map<String, dynamic>
        ? decoded
        : Map<String, dynamic>.from(decoded as Map);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    }

    final message = data['error']?.toString() ??
        data['message']?.toString() ??
        'Request failed (${response.statusCode})';
    if (response.statusCode == 401) {
      throw UnauthorizedException(message, response.statusCode);
    }
    throw ApiException(message, response.statusCode);
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final response =
        await http.get(Uri.parse('$baseUrl$path'), headers: await _headers());
    return _decodeObject(response);
  }

  Future<Map<String, dynamic>> _post(
      String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return _decodeObject(response);
  }

  Future<Map<String, dynamic>> _put(
      String path, Map<String, dynamic> body) async {
    final response = await http.put(
      Uri.parse('$baseUrl$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return _decodeObject(response);
  }

  Future<void> _delete(String path) async {
    final response = await http.delete(Uri.parse('$baseUrl$path'),
        headers: await _headers());
    if (response.statusCode >= 200 && response.statusCode < 300) return;
    await _decodeObject(response);
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final data =
        await _post('/auth/login', {'email': email, 'password': password});
    final token = data['token']?.toString();
    if (token == null || token.isEmpty) {
      throw ApiException('Login response did not include a token', 500);
    }
    await saveAuthToken(token);
    return data;
  }

  Future<Map<String, dynamic>> signup(String email, String password) async {
    final data =
        await _post('/auth/signup', {'email': email, 'password': password});
    final token = data['token']?.toString();
    if (token == null || token.isEmpty) {
      throw ApiException('Signup response did not include a token', 500);
    }
    await saveAuthToken(token);
    return data;
  }

  Future<Map<String, dynamic>> currentUser() => _get('/auth/me');

  Future<Map<String, dynamic>> refreshSession() async {
    final data = await _post('/auth/refresh', {});
    final token = data['token']?.toString();
    if (token == null || token.isEmpty) {
      throw ApiException('Refresh response did not include a token', 500);
    }
    await saveAuthToken(token);
    return data;
  }

  Future<void> logout() async {
    try {
      await _post('/auth/logout', {});
    } catch (_) {
      // Local sign-out should still succeed when the token is expired or offline.
    } finally {
      await clearAuthToken();
    }
  }

  Future<Map<String, dynamic>> getProfile() => _get('/profile');

  Future<Map<String, dynamic>> savePreferences({String? defaultStore}) {
    return _put('/profile/preferences', {
      'defaultStore': defaultStore,
    });
  }

  Future<List<CartItem>> getCart() async {
    final data = await _get('/cart');
    final items = data['items'] is List ? data['items'] as List : const [];
    return items
        .map((item) =>
            CartItem.fromApiCartItem(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<Product> importProduct(String url) async {
    final data = await _post('/import/url', {'url': url});
    return Product.fromJson(data);
  }

  Future<void> removeCartItem(String id) => _delete('/cart/items/$id');

  Future<void> updateCartItemQuantity(String id, int quantity) async {
    await _put('/cart/items/$id/quantity', {'quantity': quantity});
  }

  Future<void> clearRemoteCart() async {
    await _delete('/cart');
  }

  Future<Map<String, dynamic>> matchProduct(
      CartItem item, String preferredStore) async {
    return _post('/match', {
      'product': item.toMatchRequest(),
      'preferredStore': preferredStore,
    });
  }

  Future<Map<String, dynamic>> saveSelectedMatch(
    String cartItemId,
    String retailerProductId,
    String matchType,
    double confidence,
  ) async {
    return _post('/match/select', {
      'cartItemId': cartItemId,
      'retailerProductId': retailerProductId,
      'matchType': matchType,
      'confidence': confidence,
    });
  }

  Future<String> getCartRedirectUrl(List<CartItem> items, String store) async {
    final data = await _post('/checkout/redirect', {
      'items': items.map((i) => i.toJson()).toList(),
      'store': store,
    });
    return data['redirectUrl'].toString();
  }

  Future<List<Map<String, dynamic>>> getAlerts() async {
    final data = await _get('/alerts');
    final alerts = data['alerts'] is List ? data['alerts'] as List : const [];
    return alerts
        .map((alert) => Map<String, dynamic>.from(alert as Map))
        .toList();
  }

  Future<Map<String, dynamic>> createAlert({
    required String productId,
    required String alertType,
    double? targetPrice,
  }) async {
    final data = await _post('/alerts', {
      'productId': productId,
      'alertType': alertType,
      'targetPrice': targetPrice,
    });
    return Map<String, dynamic>.from(data['alert'] as Map);
  }

  Future<void> deleteAlert(String alertId) => _delete('/alerts/$alertId');

  Future<Map<String, dynamic>> optimizeCart(List<CartItem> items) async {
    final stores = <String>{
      for (final item in items) item.sourceRetailer,
      for (final item in items)
        if (item.matchedStore != null && item.matchedStore!.isNotEmpty)
          item.matchedStore!,
    }.toList();

    final optimizerItems = items.map((item) {
      final options = <String, Map<String, dynamic>>{};
      for (final store in stores) {
        if (store == item.sourceRetailer) {
          options[store] = {
            'price': item.price * item.quantity,
            'shipping': 0,
            'tax': 0,
            'rewards': 0,
            'available': true,
            'category': item.category,
            'matchType': 'exact',
          };
        }
        if (store == item.matchedStore) {
          options[store] = {
            'price': (item.matchedPrice ?? item.price) * item.quantity,
            'shipping': 0,
            'tax': 0,
            'rewards': 0,
            'available': true,
            'category': item.category,
            'matchType': item.matchType,
          };
        }
      }
      return {
        'itemId': item.id,
        'category': item.category,
        'matchType': item.matchType,
        'costs': <String, dynamic>{},
        'options': options,
      };
    }).toList();

    return _post('/optimize', {
      'items': optimizerItems,
      'userStores': stores,
      'shippingThresholds': [
        {'store': 'Amazon', 'threshold': 35, 'shippingCost': 6, 'gapTolerance': 20},
        {'store': 'Walmart', 'threshold': 35, 'shippingCost': 6, 'gapTolerance': 20},
        {'store': 'Target', 'threshold': 35, 'shippingCost': 6, 'gapTolerance': 20},
        {'store': 'BestBuy', 'threshold': 35, 'shippingCost': 7, 'gapTolerance': 20},
        {'store': "Macy's", 'threshold': 49, 'shippingCost': 10, 'gapTolerance': 25},
      ].where((threshold) => stores.contains(threshold['store'])).toList(),
    });
  }
}
