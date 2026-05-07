import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:universal_cart_mobile/providers/cart_provider.dart';
import 'package:universal_cart_mobile/screens/home_screen.dart';
import 'package:universal_cart_mobile/screens/share_import_screen.dart';
import 'package:universal_cart_mobile/services/share_handler_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final _shareHandler = ShareHandlerService();
  final _navigatorKey = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    _shareHandler.init();
    _shareHandler.urlStream.listen(_onSharedUrl);
  }

  @override
  void dispose() {
    _shareHandler.dispose();
    super.dispose();
  }

  void _onSharedUrl(String url) {
    _navigatorKey.currentState?.push(
      MaterialPageRoute(builder: (_) => ShareImportScreen(sharedUrl: url)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => CartProvider(),
      child: MaterialApp(
        title: 'Universal Cart',
        theme: ThemeData(primarySwatch: Colors.blue),
        navigatorKey: _navigatorKey,
        home: const HomeScreen(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
