// Explicit integration runner. Not collected by `flutter test` without this path.
// Requires an isolated localhost DEV API and synthetic account environment values.
import 'dart:convert';
import 'dart:io';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uuid/uuid.dart';
import 'package:susumu_vehicle_check/domain.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/editor.dart';
import 'package:susumu_vehicle_check/data/photos.dart';
import 'package:susumu_vehicle_check/data/session.dart';
import 'package:susumu_vehicle_check/data/sync.dart';
import 'session_test.dart' show MemorySecrets;

void main() {
  test(
    'real DEV API accepts durable mobile draft photos finalization retry and history',
    () async {
      final server = Platform.environment['SUSUMU_TEST_API'] ?? '';
      final username = Platform.environment['SUSUMU_TEST_USER'] ?? '';
      final password = Platform.environment['SUSUMU_TEST_PASSWORD'] ?? '';
      if (![
            'localhost',
            '127.0.0.1',
            '::1',
          ].contains(Uri.tryParse(server)?.host) ||
          username.isEmpty ||
          password.isEmpty) {
        throw StateError(
          'Set SUSUMU_TEST_API to localhost and SUSUMU_TEST_USER/PASSWORD to an isolated synthetic DEV account.',
        );
      }
      final directory = await Directory.systemTemp.createTemp(
        'susumu-live-contract-',
      );
      final db = AppDatabase(
        NativeDatabase(File('${directory.path}/client.sqlite')),
      );
      final sessions = SessionManager(db, MemorySecrets());
      final sync = SyncEngine(db, sessions);
      addTearDown(() async {
        sync.dispose();
        sessions.dispose();
        await db.close();
        await directory.delete(recursive: true);
      });
      await sessions.restore();
      await sessions.login(server, username, password);
      final session = sessions.current!;
      final vehicles = (sessions.bootstrap!['vehicles'] as List).cast<Json>();
      final vehicle = vehicles.firstWhere((v) => v['internalNumber'] == '714');
      final templates =
          (sessions.bootstrap!['templates'] as List)
              .cast<Json>()
              .where(
                (t) =>
                    t['published'] == true &&
                    t['vehicleType'] == vehicle['type'],
              )
              .toList()
            ..sort(
              (a, b) => (b['version'] as int).compareTo(a['version'] as int),
            );
      final draft = InspectionDraft.create(
        id: const Uuid().v4(),
        vehicle: vehicle,
        template: templates.first,
        deviceId: sessions.deviceId,
        now: sessions.now,
      );
      draft.inspection['notes'] = 'SYNTHETIC MOBILE API CONTRACT TEST';
      await db.saveDraft(session.owner, draft);
      await sync.run();
      expect(await db.queue(session.owner), isEmpty, reason: sync.message);
      final editor = DraftEditor(db, sessions, session.owner, draft);
      addTearDown(editor.dispose);
      for (final item in draft.definitions) {
        editor.edit(
          (value) => value.setAnswer(
            item['id'] as String,
            status: 'OK',
            value: item['responseType'] == 'measurement'
                ? (item['minValue'] as num? ?? 1)
                : null,
          ),
        );
      }
      await editor.flush();
      final photos = PhotoStore(Directory('${directory.path}/photos'));
      final png = base64Decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgsGn6DwACvAG+NhMWvQAAAABJRU5ErkJggg==',
      );
      final original = await photos.preserve(
        owner: session.owner,
        inspectionId: draft.id,
        itemId: draft.definitions.first['id'] as String,
        bytes: png,
      );
      await editor.attach(original.metadata, original.filePath);
      final annotation = await photos.preserve(
        owner: session.owner,
        inspectionId: draft.id,
        itemId: draft.definitions.first['id'] as String,
        bytes: png,
        kind: 'Annotation',
        originalPhotoId: original.metadata['id'] as String,
      );
      await editor.attach(annotation.metadata, annotation.filePath);
      final signature = await photos.preserve(
        owner: session.owner,
        inspectionId: draft.id,
        itemId: null,
        bytes: png,
        kind: 'Signature',
      );
      await editor.attach(signature.metadata, signature.filePath);
      await sync.run();
      expect(await db.queue(session.owner), isEmpty, reason: sync.message);
      expect(
        (await db.photos(session.owner)).every((photo) => photo.uploaded),
        isTrue,
        reason: sync.message,
      );
      await editor.finalize();
      final finalOperation = (await db.queue(session.owner)).single;
      await sync.run();
      expect(await db.queue(session.owner), isEmpty, reason: sync.message);
      final api = sessions.factory(session.server, session.token);
      try {
        final replay = await api.sync(finalOperation.payload);
        expect(replay['state'], 'Finalized');
        expect(
          replay['version'],
          (jsonDecode(finalOperation.payload)['expectedVersion'] as int) + 1,
        );
        final detail = await api.inspection(draft.id);
        expect(detail['state'], 'Finalized');
        expect(detail['photoUploadState'], 'Complete');
        final history = await api.history(vehicle['id'] as String);
        expect(history.any((row) => row['id'] == draft.id), isTrue);
      } finally {
        api.close();
      }
    },
  );
}
