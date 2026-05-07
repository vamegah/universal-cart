import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/cart_item.dart';

class StorageService {
  static const String _cartKey = 'universal_cart';
  static const String _authTokenKey = 'universal_cart_auth_token';

  Future<void> saveCart(List<CartItem> items) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = items.map((i) => i.toJson()).toList();
    await prefs.setString(_cartKey, jsonEncode(jsonList));
  }

  Future<List<CartItem>> loadCart() async {
    final prefs = await SharedPreferences.getInstance();
    final String? jsonString = prefs.getString(_cartKey);
    if (jsonString == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonString);
    return jsonList.map((j) => CartItem.fromJson(j)).toList();
  }

  Future<void> clearCart() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cartKey);
  }

  Future<void> saveAuthToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_authTokenKey, token);
  }

  Future<String?> loadAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_authTokenKey);
  }

  Future<void> clearAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_authTokenKey);
  }
}
