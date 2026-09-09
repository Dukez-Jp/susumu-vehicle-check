// Optional rendering evidence, not golden-image assertions or production fixtures.
import 'dart:io';
import 'dart:ui' as ui;
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:susumu_vehicle_check/app.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/photos.dart';
import 'package:susumu_vehicle_check/data/session.dart';
import 'package:susumu_vehicle_check/data/sync.dart';
import 'fixtures.dart';
import 'session_test.dart' show MemorySecrets;

void main() {
  testWidgets('render tablet landscape and portrait with synthetic test fixtures', (
    tester,
  ) async {
    final sdk = Platform.environment['SUSUMU_FLUTTER_ROOT'];
    if (sdk == null) {
      throw StateError(
        'Set SUSUMU_FLUTTER_ROOT to the local Flutter SDK for bundled Roboto fonts.',
      );
    }
    await tester.runAsync(() async {
      final fonts = FontLoader('Roboto')
        ..addFont(
          File(
            '$sdk/bin/cache/artifacts/material_fonts/roboto-regular.ttf',
          ).readAsBytes().then(ByteData.sublistView),
        )
        ..addFont(
          File(
            '$sdk/bin/cache/artifacts/material_fonts/roboto-bold.ttf',
          ).readAsBytes().then(ByteData.sublistView),
        );
      await fonts.load();
      final icons = FontLoader('MaterialIcons')
        ..addFont(
          File(
            '$sdk/bin/cache/artifacts/material_fonts/materialicons-regular.otf',
          ).readAsBytes().then(ByteData.sublistView),
        );
      await icons.load();
    });
    final db = AppDatabase(NativeDatabase.memory()), now = DateTime.now();
    final sessions = SessionManager(db, MemorySecrets());
    sessions.current = Session(
      'https://dev.example',
      'expired',
      {
        'id': 'demo',
        'name': 'Mecânico • ambiente de teste',
        'active': true,
        'role': 'Inspector',
      },
      now.subtract(const Duration(hours: 1)),
      now.add(const Duration(hours: 72)),
    );
    sessions.bootstrap = {
      'vehicles': [vehicle()],
      'templates': [template()],
    };
    await db.saveDraft(sessions.current!.owner, draft());
    final sync = SyncEngine(db, sessions), boundaryKey = GlobalKey();
    await tester.binding.setSurfaceSize(const Size(1200, 800));
    await tester.pumpWidget(
      RepaintBoundary(
        key: boundaryKey,
        child: SusumuApp(
          db: db,
          sessions: sessions,
          sync: sync,
          photos: PhotoStore(Directory.systemTemp),
        ),
      ),
    );
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 150)),
    );
    await tester.pumpAndSettle();
    Future<void> capture(String name) async {
      await tester.runAsync(() async {
        final boundary =
            boundaryKey.currentContext!.findRenderObject()!
                as RenderRepaintBoundary;
        final image = await boundary.toImage();
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await Directory('artifacts/mobile-ui').create(recursive: true);
        await File(
          'artifacts/mobile-ui/$name.png',
        ).writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }

    await capture('tablet-home-landscape');
    await tester.tap(find.text('Continuar inspeção'));
    await tester.pumpAndSettle();
    await capture('tablet-inspection-landscape');
    await tester.binding.setSurfaceSize(const Size(800, 1100));
    await tester.pumpAndSettle();
    await capture('tablet-inspection-portrait');
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.binding.setSurfaceSize(null);
    sync.dispose();
    sessions.dispose();
    await db.close();
  });
}
