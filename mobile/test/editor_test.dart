import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/editor.dart';
import 'package:susumu_vehicle_check/data/session.dart';
import 'fixtures.dart';
import 'session_test.dart' show MemorySecrets;

void main() {
  late AppDatabase db;
  late SessionManager sessions;
  late DraftEditor editor;
  test(
    'logout preserves already authorized keystrokes but blocks new edits',
    () async {
      editor.edit(
        (d) => d.inspection['notes'] = 'Última observação antes de sair',
      );
      await sessions.logout();
      await editor.flush();
      expect(
        (await db.drafts(editor.owner)).single.inspection['notes'],
        'Última observação antes de sair',
      );
      expect(
        () => editor.edit((d) => d.inspection['notes'] = 'Depois de sair'),
        throwsA(isA<StateError>()),
      );
    },
  );
  test(
    'signature persists transactionally without inventing a checklist item',
    () async {
      final metadata = {
        'id': 'signature-1',
        'inspectionId': 'inspection-1',
        'itemId': null,
        'kind': 'Signature',
        'originalPhotoId': null,
        'contentType': 'image/png',
        'sha256': 'abc',
        'sizeBytes': 50,
        'createdAt': '2026-09-09T00:00:00Z',
        'uploaded': false,
      };
      await editor.attach(metadata, 'private/signature.png');
      expect(
        (await db.drafts(editor.owner)).single.inspection['signaturePhotoId'],
        'signature-1',
      );
      expect(
        (await db.drafts(editor.owner)).single.inspection['items'],
        isEmpty,
      );
      expect((await db.photos(editor.owner)).single.id, 'signature-1');
    },
  );
  setUp(() async {
    db = AppDatabase(NativeDatabase.memory());
    final now = DateTime.utc(2026, 9, 9);
    sessions = SessionManager(db, MemorySecrets(), clock: () => now);
    sessions.current = Session(
      'https://test.example',
      'token',
      {'id': 'user', 'active': true, 'role': 'Inspector'},
      now.add(const Duration(hours: 1)),
      now.add(const Duration(hours: 72)),
    );
    editor = DraftEditor(db, sessions, sessions.current!.owner, draft());
    await db.saveDraft(editor.owner, editor.draft);
  });
  tearDown(() async {
    editor.dispose();
    sessions.dispose();
    await db.close();
  });
  test(
    'fast typing persists the final complete text before Saved state',
    () async {
      editor.edit((d) => d.inspection['notes'] = 'a');
      editor.edit((d) => d.inspection['notes'] = 'ab');
      editor.edit((d) => d.inspection['notes'] = 'abc');
      expect(editor.saving, isTrue);
      await editor.flush();
      expect((await db.drafts(editor.owner)).single.inspection['notes'], 'abc');
      expect(editor.saving, isFalse);
      expect(editor.error, isNull);
    },
  );
  test(
    'disk failure during finalization leaves editable draft and visible error',
    () async {
      editor.edit((d) => d.setAnswer('item-1', status: 'OK', value: 5));
      await editor.flush();
      await db.customStatement(
        "CREATE TRIGGER fail_queue BEFORE INSERT ON pending_operations BEGIN SELECT RAISE(ABORT, 'disk full'); END",
      );
      await expectLater(editor.finalize(), throwsA(anything));
      expect(editor.draft.finalized, isFalse);
      expect((await db.drafts(editor.owner)).single.finalized, isFalse);
      expect(editor.error, isNotNull);
    },
  );
}
