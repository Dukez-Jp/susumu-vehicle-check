import 'dart:io';
import 'dart:typed_data';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/photos.dart';
import 'package:susumu_vehicle_check/data/recovery.dart';
import 'package:susumu_vehicle_check/data/session.dart';
import 'fixtures.dart';
import 'session_test.dart' show MemorySecrets;

void main() {
  test(
    'orphan and finalized artifacts do not prevent a valid photo from linking',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'susumu-orphans-',
      );
      final db = AppDatabase(NativeDatabase.memory());
      final sessions = SessionManager(db, MemorySecrets());
      final now = DateTime.now();
      sessions.current = Session(
        'https://test.example',
        'token',
        {'id': 'owner', 'active': true, 'role': 'Inspector'},
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      final owner = sessions.current!.owner;
      final store = PhotoStore(directory);
      final sealed = draft()..inspection['id'] = 'sealed';
      sealed.setAnswer('item-1', status: 'OK', value: 5);
      sealed.finalize(now);
      await db.saveDraft(owner, sealed);
      await db.saveDraft(owner, draft());
      for (final id in ['absent', 'sealed', 'inspection-1']) {
        await store.preserve(
          owner: owner,
          inspectionId: id,
          itemId: 'item-1',
          bytes: Uint8List.fromList([255, 216, 255, 1]),
        );
      }
      final recovery = RecoveryService(db, sessions, store);
      expect(await recovery.recoverFiles(), 1);
      expect((await db.photos(owner)).single.inspectionId, 'inspection-1');
      expect(recovery.warnings.length, 2);
      expect((await store.recoverable(owner)).length, 3);
      sessions.dispose();
      await db.close();
      await directory.delete(recursive: true);
    },
  );
  test(
    'photo flushed before process death is attached exactly once after restart',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'susumu-recovery-',
      );
      final db = AppDatabase(NativeDatabase.memory());
      final sessions = SessionManager(db, MemorySecrets());
      final now = DateTime.now();
      sessions.current = Session(
        'https://test.example',
        'token',
        {'id': 'owner', 'active': true, 'role': 'Inspector'},
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      final owner = sessions.current!.owner;
      final store = PhotoStore(directory);
      await db.saveDraft(
        owner,
        draft()..setAnswer('item-1', status: 'OK', value: 5),
      );
      final photo = await store.preserve(
        owner: owner,
        inspectionId: 'inspection-1',
        itemId: 'item-1',
        bytes: Uint8List.fromList([255, 216, 255, 224, 1]),
      );
      final recovery = RecoveryService(db, sessions, store);
      expect(await recovery.recoverFiles(), 1);
      expect(await recovery.recoverFiles(), 0);
      expect((await db.photos(owner)).single.id, photo.metadata['id']);
      expect((await db.drafts(owner)).single.answer('item-1')!['value'], 5);
      sessions.dispose();
      await db.close();
      await directory.delete(recursive: true);
    },
  );
}
