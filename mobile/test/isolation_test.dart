import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:susumu_vehicle_check/data/api.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/photos.dart';
import 'package:susumu_vehicle_check/data/session.dart';
import 'package:susumu_vehicle_check/data/sync.dart';
import 'fixtures.dart';
import 'session_test.dart' show MemorySecrets;

void main() {
  test(
    'blocked aggregate keeps frozen head and tail while another advances',
    () async {
      final db = AppDatabase(NativeDatabase.memory());
      final a = draft();
      await db.saveDraft('owner', a);
      final head = (await db.claimNext('owner'))!;
      await db.recordFailure('owner', head.id, 'conflict', true);
      a.inspection['notes'] = 'later';
      await db.saveDraft('owner', a);
      final b = draft()..inspection['id'] = 'inspection-2';
      await db.saveDraft('owner', b);
      expect((await db.claimNext('owner'))?.inspectionId, b.id);
      expect((await db.queue('owner')).first.payload, head.payload);
      await db.close();
    },
  );

  test(
    'permanent rejection and bad photo do not starve independent work',
    () async {
      final db = AppDatabase(NativeDatabase.memory());
      final dir = await Directory.systemTemp.createTemp('susumu-isolation-');
      final now = DateTime.now();
      final user = {'id': 'owner', 'active': true, 'role': 'Inspector'};
      final calls = <String>[];
      var uploads = 0;
      final sessions = SessionManager(
        db,
        MemorySecrets(),
        factory: (server, token) => ApiClient(
          server,
          token,
          client: MockClient((r) async {
            if (r.url.path.endsWith('/auth/me')) {
              return http.Response(jsonEncode(user), 200);
            }
            if (r.url.path.endsWith('/sync/inspections')) {
              final body = jsonDecode(r.body);
              final id = body['inspection']['id'] as String;
              calls.add(id);
              if (id == 'inspection-1') {
                return http.Response('{"detail":"rejected"}', 422);
              }
              return http.Response(
                jsonEncode({'inspectionId': id, 'version': 1}),
                200,
              );
            }
            uploads++;
            return http.Response('{}', uploads == 1 ? 422 : 200);
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
      final store = PhotoStore(dir);
      final a = draft()..setAnswer('item-1', status: 'OK', value: 5);
      for (var i = 0; i < 2; i++) {
        final p = await store.preserve(
          owner: owner,
          inspectionId: a.id,
          itemId: 'item-1',
          bytes: Uint8List.fromList([255, 216, 255, i]),
        );
        a.setAnswer(
          'item-1',
          photoIds: [
            ...List<String>.from(a.answer('item-1')!['photoIds']),
            p.metadata['id'] as String,
          ],
        );
        await db.attachPhoto(owner, a, p.metadata, p.filePath);
      }
      // Previously accepted declaration remains uploadable even if a later operation is rejected.
      await db.cache('declared|$owner|${a.id}', {
        'photoIds': a.answer('item-1')!['photoIds'],
      });
      await db.saveDraft(owner, draft()..inspection['id'] = 'inspection-2');
      final sync = SyncEngine(db, sessions);
      await sync.run();
      expect(calls, ['inspection-1', 'inspection-2']);
      expect((await db.queue(owner)).single.blocked, isTrue);
      expect(uploads, 2);
      final photos = await db.photos(owner);
      expect(photos.where((p) => p.uploaded).length, 1);
      expect(photos.where((p) => p.error != null).length, 1);
      expect(sync.message, contains('revisão'));
      sync.dispose();
      sessions.dispose();
      await db.close();
      await dir.delete(recursive: true);
    },
  );
}
