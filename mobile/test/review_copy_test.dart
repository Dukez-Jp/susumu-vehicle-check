import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/photos.dart';
import 'package:susumu_vehicle_check/data/review_copy.dart';
import 'package:susumu_vehicle_check/data/session.dart';
import 'fixtures.dart';
import 'session_test.dart' show MemorySecrets;

void main() {
  test(
    'review provenance never truncates original notes and excess text waits locally',
    () async {
      final source = draft()..inspection['notes'] = 'x' * 4000;
      final copy = source.reviewCopy(
        'new-id',
        'device',
        'Conferir',
        DateTime.now(),
      );
      expect(
        copy.inspection['notes'],
        startsWith(source.inspection['notes'] as String),
      );
      expect(copy.validationErrors().join(), contains('4000'));
      source.inspection['odometerKm'] = 300000;
      expect(source.validationErrors().join(), contains('200000'));
    },
  );
  test(
    'review copy keeps sealed source and frozen rejection, clones image identities, requires history review',
    () async {
      final db = AppDatabase(NativeDatabase.memory());
      final dir = await Directory.systemTemp.createTemp('susumu-review-');
      final store = PhotoStore(dir);
      final sessions = SessionManager(db, MemorySecrets());
      final now = DateTime.now();
      sessions.current = Session(
        'https://test.example',
        'token',
        {'id': 'A', 'active': true, 'role': 'Inspector'},
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      final owner = sessions.current!.owner;
      final source = draft()..setAnswer('item-1', status: 'OK', value: 5);
      final original = await store.preserve(
        owner: owner,
        inspectionId: source.id,
        itemId: 'item-1',
        bytes: Uint8List.fromList([255, 216, 255, 1]),
      );
      source.setAnswer('item-1', photoIds: [original.metadata['id'] as String]);
      await db.attachPhoto(owner, source, original.metadata, original.filePath);
      final annotation = await store.preserve(
        owner: owner,
        inspectionId: source.id,
        itemId: 'item-1',
        bytes: Uint8List.fromList([255, 216, 255, 2]),
        kind: 'Annotation',
        originalPhotoId: original.metadata['id'] as String,
      );
      source.setAnswer(
        'item-1',
        photoIds: [
          original.metadata['id'] as String,
          annotation.metadata['id'] as String,
        ],
      );
      await db.attachPhoto(
        owner,
        source,
        annotation.metadata,
        annotation.filePath,
      );
      final signature = await store.preserve(
        owner: owner,
        inspectionId: source.id,
        itemId: null,
        bytes: Uint8List.fromList([255, 216, 255, 3]),
        kind: 'Signature',
      );
      source.inspection['signaturePhotoId'] = signature.metadata['id'];
      await db.attachPhoto(
        owner,
        source,
        signature.metadata,
        signature.filePath,
      );
      source.finalize(now);
      await db.saveDraft(owner, source);
      final head = (await db.claimNext(owner))!;
      await db.recordFailure(owner, head.id, 'server rejection', true);
      final originalJson = jsonEncode(
        (await db.draftById(owner, source.id))!.inspection,
      );
      final service = ReviewCopyService(db, sessions, store);
      final result = await service.create(source.id, 'Conferir quilometragem');
      expect(result.draft.id, isNot(source.id));
      expect(result.draft.finalized, isFalse);
      expect(result.draft.inspection['supersedesInspectionId'], isNull);
      expect(result.draft.inspection['signaturePhotoId'], isNull);
      expect(result.draft.inspection['notes'], contains(source.id));
      expect(result.draft.validationErrors().join(), contains('histórico'));
      expect(
        jsonEncode((await db.draftById(owner, source.id))!.inspection),
        originalJson,
      );
      expect((await db.queue(owner)).first.payload, head.payload);
      final copiedPhotos = await db.photos(
        owner,
        inspectionId: result.draft.id,
      );
      expect(copiedPhotos.length, 2);
      final copied = copiedPhotos.firstWhere(
        (p) => jsonDecode(p.metadata)['kind'] == 'Original',
      );
      final copiedAnnotation = copiedPhotos.firstWhere(
        (p) => jsonDecode(p.metadata)['kind'] == 'Annotation',
      );
      expect(
        jsonDecode(copiedAnnotation.metadata)['originalPhotoId'],
        copied.id,
      );
      expect(copied.id, isNot(original.metadata['id']));
      expect(
        await File(copied.filePath).readAsBytes(),
        await File(original.filePath).readAsBytes(),
      );
      result.draft.inspection['notes'] = 'Texto revisado pelo operador';
      await db.saveDraft(owner, result.draft);
      final payload = jsonDecode(
        (await db.queue(owner)).last.payload,
      )['inspection'];
      expect(payload['notes'], contains(source.id));
      expect(payload.containsKey('_recovery'), isFalse);
      await sessions.logout();
      sessions.current = Session(
        'https://test.example',
        'token',
        {'id': 'B', 'active': true, 'role': 'Inspector'},
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      await expectLater(
        service.create(source.id, 'other owner'),
        throwsStateError,
      );
      expect(await db.hasOtherSessionWork(sessions.current!.owner), isTrue);
      sessions.dispose();
      await db.close();
      await dir.delete(recursive: true);
    },
  );
}
