import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';

/// Listens for URLs shared into the app from the OS share sheet.
/// Emits each shared URL as a [String] on [urlStream].
class ShareHandlerService {
  final _controller = StreamController<String>.broadcast();
  StreamSubscription<List<SharedMediaFile>>? _intentSub;
  StreamSubscription<List<SharedMediaFile>>? _initialSub;

  Stream<String> get urlStream => _controller.stream;

  void init() {
    // URLs shared while the app is already running.
    _intentSub = ReceiveSharingIntent.instance
        .getMediaStream()
        .listen(_handleFiles, onError: (e) => debugPrint('Share stream error: $e'));

    // URL that launched the app cold from the share sheet.
    _initialSub = ReceiveSharingIntent.instance
        .getInitialMedia()
        .asStream()
        .listen(_handleFiles);
  }

  void _handleFiles(List<SharedMediaFile> files) {
    for (final file in files) {
      final value = file.path.trim();
      if (_isUrl(value)) {
        _controller.add(value);
      }
    }
    if (files.isNotEmpty) {
      ReceiveSharingIntent.instance.reset();
    }
  }

  bool _isUrl(String value) =>
      value.startsWith('http://') || value.startsWith('https://');

  void dispose() {
    _intentSub?.cancel();
    _initialSub?.cancel();
    _controller.close();
  }
}
