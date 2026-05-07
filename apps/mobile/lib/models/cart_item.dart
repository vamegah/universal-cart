class CartItem {
  final String id;
  final String? productId;
  final String sourceRetailer;
  final String productName;
  final double price;
  final String? imageUrl;
  final String? brand;
  final String? model;
  final String? upc;
  final String? category;
  final String? retailerProductId;
  final String? retailerSku;
  final String? sourceUrl;
  int quantity;
  String? matchedStore;
  String? matchedProductId;
  String? matchedSku;
  String? matchedUrl;
  String? matchType;
  double? matchConfidence;
  double? matchedPrice;

  CartItem({
    required this.id,
    this.productId,
    required this.sourceRetailer,
    required this.productName,
    required this.price,
    this.imageUrl,
    this.brand,
    this.model,
    this.upc,
    this.category,
    this.retailerProductId,
    this.retailerSku,
    this.sourceUrl,
    this.quantity = 1,
    this.matchedStore,
    this.matchedProductId,
    this.matchedSku,
    this.matchedUrl,
    this.matchType,
    this.matchConfidence,
    this.matchedPrice,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'productId': productId,
        'sourceRetailer': sourceRetailer,
        'productName': productName,
        'price': price,
        'imageUrl': imageUrl,
        'brand': brand,
        'model': model,
        'upc': upc,
        'category': category,
        'retailerProductId': retailerProductId,
        'retailerSku': retailerSku,
        'sourceUrl': sourceUrl,
        'quantity': quantity,
        'matchedStore': matchedStore,
        'matchedProductId': matchedProductId,
        'matchedSku': matchedSku,
        'matchedUrl': matchedUrl,
        'matchType': matchType,
        'matchConfidence': matchConfidence,
        'matchedPrice': matchedPrice,
      };

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
        id: _readString(json['id']) ?? '',
        productId: _readString(json['productId']),
        sourceRetailer: _readString(json['sourceRetailer']) ?? '',
        productName: _readString(json['productName']) ?? 'Unnamed product',
        price: _readDouble(json['price']),
        imageUrl: _readString(json['imageUrl']),
        brand: _readString(json['brand']),
        model: _readString(json['model']),
        upc: _readString(json['upc']),
        category: _readString(json['category']),
        retailerProductId: _readString(json['retailerProductId']),
        retailerSku: _readString(json['retailerSku']),
        sourceUrl: _readString(json['sourceUrl']),
        quantity: _readInt(json['quantity'], fallback: 1),
        matchedStore: _readString(json['matchedStore']),
        matchedProductId: _readString(json['matchedProductId']),
        matchedSku: _readString(json['matchedSku']),
        matchedUrl: _readString(json['matchedUrl']),
        matchType: _readString(json['matchType']),
        matchConfidence: _nullableDouble(json['matchConfidence']),
        matchedPrice: _nullableDouble(json['matchedPrice']),
      );

  factory CartItem.fromApiCartItem(Map<String, dynamic> json) {
    final product = _readMap(json['product']);
    final sourceRetailer = _readString(json['sourceRetailer']) ?? '';
    final retailerProducts = _readList(product?['retailerProducts']);
    final sourceListing =
        retailerProducts.cast<Map<String, dynamic>?>().firstWhere(
              (listing) =>
                  _readString(listing?['retailerName']) == sourceRetailer,
              orElse: () => retailerProducts.isNotEmpty
                  ? _readMap(retailerProducts.first)
                  : null,
            );
    final matchResults = _readList(json['matchResults']);
    final selectedMatch = matchResults.cast<Map<String, dynamic>?>().firstWhere(
          (match) => match?['isSelected'] == true,
          orElse: () => null,
        );
    final selectedListing = _readMap(selectedMatch?['retailerProduct']);

    return CartItem(
      id: _readString(json['id']) ?? '',
      productId: _readString(json['productId']) ?? _readString(product?['id']),
      sourceRetailer: sourceRetailer,
      productName: _readString(product?['name']) ?? 'Unnamed product',
      price: _readDouble(sourceListing?['price']),
      imageUrl: _readString(product?['imageUrl']),
      brand: _readString(product?['brand']),
      model: _readString(product?['model']),
      upc: _readString(product?['upc']),
      category: _readString(product?['category']),
      retailerProductId: _readString(sourceListing?['id']),
      retailerSku: _readString(sourceListing?['retailerSku']),
      sourceUrl: _readString(sourceListing?['url']),
      quantity: _readInt(json['quantity'], fallback: 1),
      matchedStore: _readString(selectedListing?['retailerName']),
      matchedProductId: _readString(selectedListing?['id']),
      matchedSku: _readString(selectedListing?['retailerSku']),
      matchedUrl: _readString(selectedListing?['url']),
      matchType: _readString(selectedMatch?['matchType']),
      matchConfidence: _nullableDouble(selectedMatch?['confidenceScore']),
      matchedPrice: _nullableDouble(selectedListing?['price']),
    );
  }

  Map<String, dynamic> toMatchRequest() => {
        'id': productId,
        'name': productName,
        'brand': brand,
        'model': model,
        'upc': upc,
        'category': category,
        'sku': retailerSku,
        'price': price,
        'retailer': sourceRetailer,
      };
}

String? _readString(dynamic value) {
  if (value == null) return null;
  final text = value.toString();
  return text.isEmpty ? null : text;
}

double _readDouble(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

double? _nullableDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

int _readInt(dynamic value, {required int fallback}) {
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

Map<String, dynamic>? _readMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

List<dynamic> _readList(dynamic value) {
  if (value is List) return value;
  return const [];
}
