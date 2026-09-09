import 'dart:io';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:susumu_vehicle_check/app.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/photos.dart';
import 'package:susumu_vehicle_check/data/session.dart';
import 'package:susumu_vehicle_check/data/sync.dart';
import 'fixtures.dart';
import 'session_test.dart' show MemorySecrets;

void main() {
  testWidgets(
    'offline home searches cached vehicle and resumes persisted inspection',
    (tester) async {
      final db = AppDatabase(NativeDatabase.memory());
      final now = DateTime.utc(2026, 9, 9);
      final sessions = SessionManager(db, MemorySecrets(), clock: () => now);
      sessions.current = Session(
        'https://test.example',
        'expired',
        {
          'id': 'owner',
          'name': 'Mecânico',
          'active': true,
          'role': 'Inspector',
        },
        now.subtract(const Duration(minutes: 1)),
        now.add(const Duration(hours: 72)),
      );
      sessions.bootstrap = {
        'vehicles': [vehicle()],
        'templates': [template()],
      };
      await db.saveDraft(sessions.current!.owner, draft());
      final sync = SyncEngine(db, sessions);
      await tester.pumpWidget(
        SusumuApp(
          db: db,
          sessions: sessions,
          sync: sync,
          photos: PhotoStore(Directory.systemTemp),
        ),
      );
      await tester.pumpAndSettle();
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 100)),
      );
      await tester.pumpAndSettle();
      expect(find.text('Minha oficina'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('vehicle-search')), '714');
      await tester.pumpAndSettle();
      expect(find.textContaining('DEV-714'), findsWidgets);
      await tester.tap(find.text('Continuar inspeção').first);
      await tester.pumpAndSettle();
      expect(find.text('Pressão'), findsOneWidget);
      await tester.tap(find.byKey(const Key('item-1-OK')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('item-1-measurement')), '5');
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Finalizar inspeção'),
        300,
        scrollable: find
            .descendant(
              of: find.byKey(const Key('inspection-scroll')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(find.text('Finalizar inspeção'), findsOneWidget);
      await tester.tap(find.text('Finalizar inspeção'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmar finalização'));
      await tester.pumpAndSettle();
      expect(
        (await db.drafts(sessions.current!.owner)).single.finalized,
        isTrue,
      );
      await tester.binding.setSurfaceSize(const Size(1200, 800));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await sessions.logout();
      await tester.pumpAndSettle();
      expect(find.text('Entrar na oficina'), findsOneWidget);
      expect(find.text('Inspeção finalizada'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.binding.setSurfaceSize(null);
      await tester.pumpWidget(const SizedBox.shrink());
      sync.dispose();
      sessions.dispose();
      await db.close();
    },
  );
}
