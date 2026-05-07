class Product {
  final String id;
  final String? cartItemId;
  final String? retailerProductId;
  final String? retailerSku;
  final String sourceRetailer;
  final String productName;
  final double price;
  final String? imageUrl;
  final String url;
  final String? brand;
  final String? model;
  final String? upc;
  final String? category;

  Product({
    required this.id,
    this.cartItemId,
    this.retailerProductId,
    this.retailerSku,
    required this.sourceRetailer,
    required this.productName,
    required this.price,
    this.imageUrl,
    required this.url,
    this.brand,
    this.model,
    this.upc,
    this.category,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: _readString(json['id']) ?? '',
      cartItemId: _readString(json['cartItemId']),
      retailerProductId: _readString(json['retailerProductId']),
      retailerSku: _readString(json['retailerSku']),
      sourceRetailer: _readString(json['sourceRetailer']) ?? '',
      productName: _readString(json['productName']) ?? 'Unnamed product',
      price: _readDouble(json['price']),
      imageUrl: _readString(json['imageUrl']),
      url: _readString(json['url']) ?? '',
      brand: _readString(json['brand']),
      model: _readString(json['model']),
      upc: _readString(json['upc']),
      category: _readString(json['category']),
    );
  }
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
