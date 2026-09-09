import 'dart:ui' as ui;
import 'package:flutter/material.dart';

class SignatureScreen extends StatefulWidget {
  const SignatureScreen({super.key});
  @override
  State<SignatureScreen> createState() => _SignatureScreenState();
}

class _SignatureScreenState extends State<SignatureScreen> {
  final strokes = <List<Offset>>[];
  int? pointer;
  bool saving = false;
  String? error;
  bool get hasInk => strokes.any((stroke) => stroke.length > 1);
  Future<void> save() async {
    if (!hasInk || saving) return;
    setState(() => saving = true);
    try {
      final recorder = ui.PictureRecorder();
      SignaturePainter(strokes).paint(Canvas(recorder), const Size(1200, 400));
      final picture = recorder.endRecording();
      final image = await picture.toImage(1200, 400);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      picture.dispose();
      if (bytes == null) {
        throw StateError('Não foi possível gravar a assinatura.');
      }
      if (mounted) Navigator.pop(context, bytes.buffer.asUint8List());
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Assinatura da inspeção')),
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Assine com a S Pen ou com o dedo. Confira antes de salvar; a assinatura será preservada como uma imagem separada.',
            ),
            const SizedBox(height: 24),
            Expanded(
              child: Center(
                child: AspectRatio(
                  aspectRatio: 3,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: Colors.blueGrey),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: LayoutBuilder(
                      builder: (context, constraints) => Semantics(
                        label: 'Área de assinatura por toque ou caneta',
                        child: Listener(
                          key: const Key('signature-pad'),
                          behavior: HitTestBehavior.opaque,
                          onPointerDown: (event) {
                            if (saving || pointer != null) return;
                            pointer = event.pointer;
                            setState(
                              () => strokes.add([
                                Offset(
                                  event.localPosition.dx / constraints.maxWidth,
                                  event.localPosition.dy /
                                      constraints.maxHeight,
                                ),
                              ]),
                            );
                          },
                          onPointerMove: (event) {
                            if (event.pointer != pointer || strokes.isEmpty) {
                              return;
                            }
                            setState(
                              () => strokes.last.add(
                                Offset(
                                  (event.localPosition.dx /
                                          constraints.maxWidth)
                                      .clamp(0, 1),
                                  (event.localPosition.dy /
                                          constraints.maxHeight)
                                      .clamp(0, 1),
                                ),
                              ),
                            );
                          },
                          onPointerUp: (_) => pointer = null,
                          onPointerCancel: (_) => pointer = null,
                          child: CustomPaint(
                            painter: SignaturePainter(strokes),
                            size: Size.infinite,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            if (error != null)
              Text(error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 24),
            Wrap(
              spacing: 16,
              runSpacing: 12,
              alignment: WrapAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed: saving
                      ? null
                      : () => setState(() => strokes.clear()),
                  icon: const Icon(Icons.clear),
                  label: const Text('Limpar'),
                ),
                FilledButton.icon(
                  onPressed: hasInk && !saving ? save : null,
                  icon: const Icon(Icons.draw),
                  label: Text(saving ? 'Salvando…' : 'Salvar assinatura'),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class SignaturePainter extends CustomPainter {
  SignaturePainter(this.strokes);
  final List<List<Offset>> strokes;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawColor(Colors.white, BlendMode.src);
    final paint = Paint()
      ..color = const Color(0xff142d29)
      ..strokeWidth = size.height * .007
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    for (final stroke in strokes) {
      final points = stroke
          .map((p) => Offset(p.dx * size.width, p.dy * size.height))
          .toList();
      if (points.length == 1) {
        canvas.drawPoints(ui.PointMode.points, points, paint);
      } else {
        canvas.drawPath(Path()..addPolygon(points, false), paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant SignaturePainter oldDelegate) => true;
}
