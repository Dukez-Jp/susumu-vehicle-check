import 'dart:convert';
import 'dart:io';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:susumu_vehicle_check/data/api.dart';
import 'package:susumu_vehicle_check/app.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/photos.dart';
import 'package:susumu_vehicle_check/data/session.dart';
import 'package:susumu_vehicle_check/data/sync.dart';
import 'package:susumu_vehicle_check/screens/history.dart';
import 'fixtures.dart';
import 'session_test.dart' show MemorySecrets;

void main() {
  testWidgets(
    'rejected historical template request revokes the session and removes report routes',
    (tester) async {
      final db = AppDatabase(NativeDatabase.memory());
      final now = DateTime.now();
      final user = {
        'id': 'A',
        'name': 'Mecânico',
        'active': true,
        'role': 'Inspector',
      };
      final inspection = {
        'id': 'historical',
        'templateId': 'template-1',
        'templateVersion': 3,
        'state': 'Finalized',
        'startedAt': '2026-09-09T10:20:00Z',
        'odometerKm': 1400,
        'items': [],
        'photos': [],
      };
      final sessions = SessionManager(
        db,
        MemorySecrets(),
        factory: (server, token) => ApiClient(
          server,
          token,
          client: MockClient(
            (request) async => request.url.path.contains('/templates/')
                ? http.Response('{}', 401)
                : http.Response(
                    jsonEncode(
                      request.url.path.endsWith('/historical')
                          ? inspection
                          : [inspection],
                    ),
                    200,
                  ),
          ),
        ),
      );
      sessions.current = Session(
        'https://test.example',
        'token',
        user,
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      sessions.bootstrap = {
        'vehicles': [vehicle()],
        'templates': [],
      };
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
      await tester.ensureVisible(find.text('Histórico'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Histórico'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('history-remote-historical')));
      await tester.pumpAndSettle();
      expect(sessions.current, isNull);
      expect(find.text('Entrar na oficina'), findsOneWidget);
      expect(find.byType(AlertDialog), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      sync.dispose();
      sessions.dispose();
      await db.close();
    },
  );
  testWidgets(
    'historical detail resolves and caches exact template labels and units for offline viewing',
    (tester) async {
      final db = AppDatabase(NativeDatabase.memory());
      final now = DateTime.now();
      final user = {'id': 'A', 'active': true, 'role': 'Inspector'};
      final inspection = {
        'id': 'historical',
        'templateId': 'template-1',
        'templateVersion': 3,
        'state': 'Finalized',
        'startedAt': '2026-09-09T10:20:00Z',
        'odometerKm': 1400,
        'items': [
          {
            'itemId': 'item-1',
            'status': 'OK',
            'value': 5,
            'notes': 'Conferido',
          },
        ],
        'photos': [],
        'notes': '',
      };
      final paths = <String>[];
      final sessions = SessionManager(
        db,
        MemorySecrets(),
        factory: (server, token) => ApiClient(
          server,
          token,
          client: MockClient((request) async {
            paths.add(request.url.path);
            return http.Response(
              jsonEncode(
                request.url.path.endsWith('/templates/template-1')
                    ? template()
                    : request.url.path.endsWith('/inspections/historical')
                    ? inspection
                    : [inspection],
              ),
              200,
              headers: {'content-type': 'application/json; charset=utf-8'},
            );
          }),
        ),
      );
      sessions.current = Session(
        'https://test.example',
        'token',
        user,
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      final sync = SyncEngine(db, sessions);
      Widget screen() => MaterialApp(
        home: HistoryScreen(
          db: db,
          sessions: sessions,
          sync: sync,
          photos: PhotoStore(Directory.systemTemp),
          vehicle: vehicle(),
        ),
      );
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('history-remote-historical')));
      await tester.pumpAndSettle();
      expect(
        find.text('Pressão'),
        findsOneWidget,
        reason:
            'Paths: $paths; text: ${tester.widgetList<Text>(find.byType(Text)).map((t) => t.data).join(' | ')}',
      );
      expect(find.textContaining('5 bar'), findsOneWidget);
      expect(find.text('Segurança • v3'), findsOneWidget);
      expect(find.textContaining('09/09/2026'), findsWidgets);
      expect(paths, contains('/api/v1/templates/template-1'));
      expect(
        await db.cached('template|${sessions.current!.owner}|template-1|3'),
        isNotNull,
      );
      final fetched = paths.length;
      await tester.pumpWidget(const SizedBox.shrink());
      sessions.current = Session(
        'https://test.example',
        'token',
        user,
        now.subtract(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('history-remote-historical')));
      await tester.pumpAndSettle();
      expect(find.text('Pressão'), findsOneWidget);
      expect(paths.length, fetched);
      await tester.pumpWidget(const SizedBox.shrink());
      await db.removeCache('template|${sessions.current!.owner}|template-1|3');
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('history-remote-historical')));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('definição não armazenada no tablet'),
        findsOneWidget,
      );
      expect(find.text('Item 1 (definição não disponível)'), findsOneWidget);
      expect(find.text('item-1'), findsNothing);
      expect(paths.length, fetched);
      await tester.pumpWidget(const SizedBox.shrink());
      sync.dispose();
      sessions.dispose();
      await db.close();
    },
  );
  testWidgets(
    'history paginates real offsets, retries without losing pages, deduplicates local IDs and reopens offline',
    (tester) async {
      final db = AppDatabase(NativeDatabase.memory());
      final now = DateTime.now();
      final requests = <int>[];
      var fail = true;
      final user = {'id': 'A', 'active': true, 'role': 'Inspector'};
      final sessions = SessionManager(
        db,
        MemorySecrets(),
        factory: (server, token) => ApiClient(
          server,
          token,
          client: MockClient((request) async {
            expect(request.url.path, '/api/v1/inspections');
            expect(request.url.queryParameters['vehicleId'], 'vehicle-1');
            expect(request.url.queryParameters['limit'], '100');
            final offset = int.parse(request.url.queryParameters['offset']!);
            requests.add(offset);
            if (offset == 100 && fail) {
              fail = false;
              throw const SocketException('offline');
            }
            Map<String, dynamic> row(int n) => {
              'id': n == 0 ? 'inspection-1' : 'remote-$n',
              'odometerKm': 1200 + n,
              'state': 'Finalized',
              'startedAt': now.toIso8601String(),
              'createdByName': 'SYNTHETIC',
              'photoUploadState': 'Complete',
            };
            return http.Response(
              jsonEncode(
                offset == 0 ? List.generate(100, row) : [row(99), row(100)],
              ),
              200,
            );
          }),
        ),
      );
      sessions.current = Session(
        'https://test.example',
        'token',
        user,
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      final owner = sessions.current!.owner;
      await db.saveDraft(owner, draft());
      final sync = SyncEngine(db, sessions);
      Widget screen() => MaterialApp(
        home: HistoryScreen(
          db: db,
          sessions: sessions,
          sync: sync,
          photos: PhotoStore(Directory.systemTemp),
          vehicle: vehicle(),
        ),
      );
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      expect(requests, [0]);
      expect(
        find.byKey(const Key('history-local-inspection-1')),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('history-remote-inspection-1')),
        findsNothing,
      );
      await tester.scrollUntilVisible(
        find.byKey(const Key('history-load-more')),
        800,
        maxScrolls: 100,
      );
      await tester.tap(find.byKey(const Key('history-load-more')));
      await tester.pumpAndSettle();
      expect(requests, [0, 100]);
      expect(
        find.textContaining('Páginas já carregadas foram preservadas'),
        findsOneWidget,
      );
      await tester.scrollUntilVisible(
        find.byKey(const Key('history-load-more')),
        400,
      );
      await tester.tap(find.byKey(const Key('history-load-more')));
      await tester.pumpAndSettle();
      expect(requests, [0, 100, 100]);
      await tester.scrollUntilVisible(
        find.textContaining('101 registro(s) do servidor carregado(s)'),
        400,
      );
      expect(
        find.textContaining('101 registro(s) do servidor carregado(s)'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('history-load-more')), findsNothing);
      final cached = (await db.cached('history|$owner|vehicle-1'))!;
      expect((cached['inspections'] as List).length, 101);
      expect(cached['nextOffset'], 102);
      await tester.pumpWidget(const SizedBox.shrink());
      sessions.current = Session(
        'https://test.example',
        'token',
        user,
        now.subtract(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      await tester.pumpWidget(screen());
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Somente registros locais e páginas já salvas'),
        findsOneWidget,
      );
      expect(requests, [0, 100, 100]);
      await tester.pumpWidget(const SizedBox.shrink());
      sync.dispose();
      sessions.dispose();
      await db.close();
    },
  );
}
