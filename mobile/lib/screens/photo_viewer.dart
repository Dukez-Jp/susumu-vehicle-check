import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';

class PhotoViewer extends StatelessWidget {
  const PhotoViewer({super.key, this.file, this.bytes, required this.title});
  final File? file;
  final Future<Uint8List>? bytes;
  final String title;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title)),
    backgroundColor: const Color(0xff172622),
    body: SafeArea(
      child: Center(
        child: file != null
            ? InteractiveViewer(
                maxScale: 8,
                child: Image.file(
                  file!,
                  errorBuilder: (_, error, _) => Text(
                    '$error',
                    style: const TextStyle(color: Colors.white),
                  ),
                ),
              )
            : FutureBuilder<Uint8List>(
                future: bytes,
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'Foto indisponível: ${snapshot.error}',
                        style: const TextStyle(color: Colors.white),
                      ),
                    );
                  }
                  if (!snapshot.hasData) {
                    return const CircularProgressIndicator();
                  }
                  return InteractiveViewer(
                    maxScale: 8,
                    child: Image.memory(snapshot.data!),
                  );
                },
              ),
      ),
    ),
  );
}
