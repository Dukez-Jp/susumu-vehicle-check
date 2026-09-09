import 'dart:io';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:susumu_vehicle_check/app.dart';
import 'package:susumu_vehicle_check/data/api.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/photos.dart';
import 'package:susumu_vehicle_check/data/session.dart';
import 'package:susumu_vehicle_check/data/sync.dart';
import 'fixtures.dart';
import 'session_test.dart' show MemorySecrets;

void main() {
  testWidgets(
    'other-session notice is generic and revoked queue returns to login',
    (tester) async {
      final db = AppDatabase(NativeDatabase.memory());
      final now = DateTime.now();
      final sessions = SessionManager(
        db,
        MemorySecrets(),
        factory: (server, token) => ApiClient(
          server,
          token,
          client: MockClient((_) async => http.Response('{}', 401)),
        ),
      );
      sessions.current = Session(
        'https://test.example',
        'token',
        {'id': 'A', 'name': 'Mecânico', 'active': true, 'role': 'Inspector'},
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      sessions.bootstrap = {
        'vehicles': [vehicle()],
        'templates': [template()],
      };
      await db.saveDraft(
        'secret-other-owner',
        draft()..inspection['id'] = 'secret-other-inspection',
      );
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
      expect(find.textContaining('outra sessão ou servidor'), findsOneWidget);
      expect(find.textContaining('secret-other'), findsNothing);
      await tester.tap(find.byTooltip('Ver fila e conflitos'));
      await tester.pumpAndSettle();
      expect(find.textContaining('outra sessão ou servidor'), findsOneWidget);
      await sync.run();
      await tester.pumpAndSettle();
      expect(find.text('Entrar na oficina'), findsOneWidget);
      expect(find.text('Tentar sincronizar agora'), findsNothing);
      expect(tester.takeException(), isNull);
      expect(
        (await db.drafts('secret-other-owner')).single.id,
        'secret-other-inspection',
      );
      await tester.pumpWidget(const SizedBox.shrink());
      sync.dispose();
      sessions.dispose();
      await db.close();
    },
  );

  testWidgets(
    'blocked sealed inspection offers an explicit editable review copy',
    (tester) async {
      final db = AppDatabase(NativeDatabase.memory());
      final now = DateTime.now();
      final sessions = SessionManager(db, MemorySecrets());
      sessions.current = Session(
        'https://test.example',
        'token',
        {'id': 'A', 'name': 'Mecânico', 'active': true, 'role': 'Inspector'},
        now.subtract(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      sessions.bootstrap = {
        'vehicles': [vehicle()],
        'templates': [template()],
      };
      final value = draft()..setAnswer('item-1', status: 'OK', value: 5);
      value.finalize(now);
      final owner = sessions.current!.owner;
      await db.saveDraft(owner, value);
      final head = (await db.claimNext(owner))!;
      await db.recordFailure(owner, head.id, 'rejected', true);
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
      await tester.tap(find.byTooltip('Ver fila e conflitos'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Criar cópia para revisão'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Conferir leitura');
      await tester.tap(find.text('Criar cópia editável'));
      await tester.pumpAndSettle();
      expect(find.text('Inspeção em andamento'), findsOneWidget);
      expect((await db.drafts(owner)).length, 2);
      expect((await db.queue(owner)).first.payload, head.payload);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      sync.dispose();
      sessions.dispose();
      await db.close();
    },
  );
}
