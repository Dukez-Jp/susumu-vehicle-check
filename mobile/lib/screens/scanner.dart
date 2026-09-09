import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});
  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final controller = MobileScannerController(formats: [BarcodeFormat.qrCode]);
  bool found = false;
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Identificar veículo')),
    body: Column(
      children: [
        const Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Aponte para o QR Code com número interno, placa ou ID do veículo.',
          ),
        ),
        Expanded(
          child: MobileScanner(
            controller: controller,
            onDetect: (capture) {
              final raw = capture.barcodes.firstOrNull?.rawValue;
              if (raw != null && !found) {
                found = true;
                Navigator.pop(context, raw.trim());
              }
            },
            errorBuilder: (context, error) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Câmera indisponível: $error. Volte e pesquise a placa.',
                ),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(24),
          child: OutlinedButton.icon(
            onPressed: () => controller.toggleTorch(),
            icon: const Icon(Icons.flashlight_on),
            label: const Text('Lanterna'),
          ),
        ),
      ],
    ),
  );
}
