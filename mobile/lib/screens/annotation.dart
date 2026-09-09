import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';

class InkStroke {
  InkStroke(this.color, this.width, this.points);
  final Color color;
  final double width;
  final List<Offset> points;
}

class AnnotationScreen extends StatefulWidget {
  const AnnotationScreen({super.key, required this.file});
  final File file;
  @override
  State<AnnotationScreen> createState() => _AnnotationScreenState();
}

class _AnnotationScreenState extends State<AnnotationScreen> {
  ui.Image? original;
  final strokes = <InkStroke>[];
  Color color = Colors.red;
  double width = .006;
  bool busy = false;
  String? error;
  int? pointer;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final codec = await ui.instantiateImageCodec(
        await widget.file.readAsBytes(),
      );
      final frame = await codec.getNextFrame();
      codec.dispose();
      if (mounted) setState(() => original = frame.image);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  @override
  void dispose() {
    original?.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (original == null || busy) return;
    setState(() => busy = true);
    try {
      final image = original!, recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      InkPainter(
        image,
        strokes,
      ).paint(canvas, Size(image.width.toDouble(), image.height.toDouble()));
      final picture = recorder.endRecording();
      final result = await picture.toImage(image.width, image.height);
      final bytes = await result.toByteData(format: ui.ImageByteFormat.png);
      result.dispose();
      picture.dispose();
      if (bytes == null) throw StateError('Não foi possível gerar a cópia.');
      if (mounted) Navigator.pop(context, bytes.buffer.asUint8List());
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Anotar cópia da foto')),
    body: SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Text('Toque ou S Pen • original preservado'),
                for (final c in [
                  Colors.red,
                  Colors.amber,
                  Colors.blue,
                  Colors.white,
                ])
                  IconButton.filledTonal(
                    tooltip:
                        'Cor ${c == Colors.red
                            ? 'vermelha'
                            : c == Colors.amber
                            ? 'amarela'
                            : c == Colors.blue
                            ? 'azul'
                            : 'branca'}',
                    onPressed: () => setState(() => color = c),
                    icon: Icon(
                      color == c ? Icons.radio_button_checked : Icons.circle,
                      color: c,
                    ),
                  ),
                IconButton(
                  tooltip: 'Desfazer último traço',
                  onPressed: strokes.isEmpty
                      ? null
                      : () => setState(() => strokes.removeLast()),
                  icon: const Icon(Icons.undo),
                ),
                SizedBox(
                  width: 160,
                  child: Slider(
                    value: width,
                    min: .002,
                    max: .025,
                    onChanged: (v) => setState(() => width = v),
                  ),
                ),
                FilledButton.icon(
                  onPressed: busy ? null : save,
                  icon: const Icon(Icons.save_as_outlined),
                  label: Text(busy ? 'Salvando…' : 'Salvar cópia'),
                ),
              ],
            ),
          ),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          Expanded(
            child: Container(
              color: const Color(0xff172622),
              child: original == null
                  ? const Center(child: CircularProgressIndicator())
                  : Center(
                      child: AspectRatio(
                        aspectRatio: original!.width / original!.height,
                        child: LayoutBuilder(
                          builder: (context, constraints) => Listener(
                            onPointerDown: (event) {
                              if (busy || pointer != null) return;
                              pointer = event.pointer;
                              setState(
                                () => strokes.add(
                                  InkStroke(color, width, [
                                    Offset(
                                      (event.localPosition.dx /
                                              constraints.maxWidth)
                                          .clamp(0, 1),
                                      (event.localPosition.dy /
                                              constraints.maxHeight)
                                          .clamp(0, 1),
                                    ),
                                  ]),
                                ),
                              );
                            },
                            onPointerMove: (event) {
                              if (event.pointer != pointer || strokes.isEmpty) {
                                return;
                              }
                              setState(
                                () => strokes.last.points.add(
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
                              painter: InkPainter(original!, strokes),
                              size: Size.infinite,
                            ),
                          ),
                        ),
                      ),
                    ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.all(12),
            child: Text(
              'A anotação será uma nova imagem PNG vinculada ao original.',
            ),
          ),
        ],
      ),
    ),
  );
}

class InkPainter extends CustomPainter {
  InkPainter(this.original, this.strokes);
  final ui.Image original;
  final List<InkStroke> strokes;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawImageRect(
      original,
      Rect.fromLTWH(
        0,
        0,
        original.width.toDouble(),
        original.height.toDouble(),
      ),
      Offset.zero & size,
      Paint(),
    );
    for (final stroke in strokes) {
      final paint = Paint()
        ..color = stroke.color
        ..strokeWidth = stroke.width * size.shortestSide
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;
      final points = stroke.points
          .map((point) => Offset(point.dx * size.width, point.dy * size.height))
          .toList();
      if (points.length == 1) {
        canvas.drawPoints(ui.PointMode.points, points, paint);
        continue;
      }
      final path = Path()..addPolygon(points, false);
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant InkPainter oldDelegate) => true;
}
