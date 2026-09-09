import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:susumu_vehicle_check/data/api.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/session.dart';
import 'package:susumu_vehicle_check/data/sync.dart';
import 'package:susumu_vehicle_check/data/photos.dart';
import 'fixtures.dart';
import 'session_test.dart' show MemorySecrets;

void main() {
  test(
    'unanswered item photo waits for its declaration instead of uploading early',
    () async {
      final db = AppDatabase(NativeDatabase.memory());
      final directory = await Directory.systemTemp.createTemp(
        'susumu-sync-photo-',
      );
      final now = DateTime.utc(2026, 9, 9);
      final user = {'id': 'owner', 'active': true, 'role': 'Inspector'};
      var uploads = 0;
      final sessions = SessionManager(
        db,
        MemorySecrets(),
        clock: () => now,
        factory: (server, token) => ApiClient(
          server,
          token,
          client: MockClient((request) async {
            if (request.url.path.endsWith('/auth/me')) {
              return http.Response(jsonEncode(user), 200);
            }
            if (request.url.path.endsWith('/sync/inspections')) {
              return http.Response(
                '{"inspectionId":"inspection-1","version":1}',
                200,
              );
            }
            uploads++;
            return http.Response('{}', 200);
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
      final artifact = await PhotoStore(directory).preserve(
        owner: owner,
        inspectionId: 'inspection-1',
        itemId: 'item-1',
        bytes: Uint8List.fromList([255, 216, 255, 1]),
      );
      final value = draft()
        ..setAnswer('item-1', photoIds: [artifact.metadata['id'] as String]);
      await db.attachPhoto(owner, value, artifact.metadata, artifact.filePath);
      final sync = SyncEngine(db, sessions);
      await sync.run();
      expect(uploads, 0);
      expect((await db.photos(owner)).single.uploaded, isFalse);
      expect(sync.message, contains('aguardando'));
      sync.dispose();
      sessions.dispose();
      await db.close();
      await directory.delete(recursive: true);
    },
  );
  test(
    'retry after lost response sends identical operation once and drains durable queue',
    () async {
      final db = AppDatabase(NativeDatabase.memory());
      final payloads = <String>[];
      final now = DateTime.utc(2026, 9, 9);
      final user = {'id': 'owner', 'active': true, 'role': 'Inspector'};
      final sessions = SessionManager(
        db,
        MemorySecrets(),
        clock: () => now,
        factory: (server, token) => ApiClient(
          server,
          token,
          client: MockClient((r) async {
            if (r.url.path.endsWith('/auth/me')) {
              return http.Response(jsonEncode(user), 200);
            }
            payloads.add(r.body);
            if (payloads.length == 1) {
              throw http.ClientException('response lost');
            }
            return http.Response(
              '{"inspectionId":"inspection-1","version":1,"state":"Draft","receivedAt":"2026-09-09T00:00:00Z","photoUploadState":"Complete"}',
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
      final sync = SyncEngine(db, sessions);
      await db.saveDraft(sessions.current!.owner, draft());
      await sync.run();
      expect((await db.queue(sessions.current!.owner)).length, 1);
      await sync.run();
      expect(payloads.length, 2);
      expect(payloads[0], payloads[1]);
      expect(await db.queue(sessions.current!.owner), isEmpty);
      sync.dispose();
      sessions.dispose();
      await db.close();
    },
  );
  test('expired token never attempts network and preserves queue', () async {
    final db = AppDatabase(NativeDatabase.memory());
    final now = DateTime.utc(2026, 9, 9);
    final sessions = SessionManager(
      db,
      MemorySecrets(),
      clock: () => now,
      factory: (_, _) => throw StateError('must not call network'),
    );
    sessions.current = Session(
      'https://test.example',
      'expired',
      {'id': 'owner', 'active': true, 'role': 'Inspector'},
      now.subtract(const Duration(minutes: 1)),
      now.add(const Duration(hours: 72)),
    );
    final sync = SyncEngine(db, sessions);
    await db.saveDraft(sessions.current!.owner, draft());
    await sync.run();
    expect((await db.queue(sessions.current!.owner)).length, 1);
    expect(sync.message, contains('Entre novamente'));
    sync.dispose();
    sessions.dispose();
    await db.close();
  });
}
