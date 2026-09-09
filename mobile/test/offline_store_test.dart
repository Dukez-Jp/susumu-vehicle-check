import 'dart:convert';
import 'dart:io';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'fixtures.dart';

void main() {
  late Directory directory;
  late AppDatabase db;
  const owner = 'https://test.example|inspector-1';
  setUp(() async {
    directory = await Directory.systemTemp.createTemp('susumu-test-');
    db = AppDatabase(NativeDatabase(File('${directory.path}/local.sqlite')));
  });
  tearDown(() async {
    await db.close();
    await directory.delete(recursive: true);
  });

  test(
    'committed draft and outbox survive closing and reopening SQLite',
    () async {
      await db.saveDraft(owner, draft());
      await db.close();
      db = AppDatabase(NativeDatabase(File('${directory.path}/local.sqlite')));
      expect((await db.drafts(owner)).single.inspection['templateVersion'], 3);
      expect(
        (await db.queue(owner)).single.payload.contains('inspection-1'),
        isTrue,
      );
    },
  );
  test('only acknowledged snapshot declares server photo IDs', () async {
    final value = draft()
      ..setAnswer('item-1', status: 'OK', value: 5, photoIds: ['photo-1']);
    await db.saveDraft(owner, value);
    final operation = (await db.claimNext(owner))!;
    value.setAnswer('item-1', photoIds: ['photo-1', 'photo-2']);
    await db.saveDraft(owner, value);
    await db.acknowledge(owner, operation.id, 1);
    expect((await db.cached('declared|$owner|inspection-1'))?['photoIds'], [
      'photo-1',
    ]);
  });
  test(
    'incomplete odometer autosaves but waits for input without poisoning network queue',
    () async {
      final value = draft()..inspection['odometerKm'] = null;
      await db.saveDraft(owner, value);
      expect((await db.drafts(owner)).single.inspection['odometerKm'], isNull);
      expect(await db.claimNext(owner), isNull);
      value.inspection['odometerKm'] = 1201;
      await db.saveDraft(owner, value);
      final operation = (await db.claimNext(owner))!;
      expect(jsonDecode(operation.payload)['expectedVersion'], 0);
      expect(jsonDecode(operation.payload)['inspection']['odometerKm'], 1201);
    },
  );
  test(
    'partial numeric text survives reopen locally and never contaminates API DTO',
    () async {
      final value = draft()
        ..setMeasurementText('item-1', '-')
        ..setOdometerText('1201.0');
      await db.saveDraft(owner, value);
      await db.close();
      db = AppDatabase(NativeDatabase(File('${directory.path}/local.sqlite')));
      final restored = (await db.drafts(owner)).single;
      expect(restored.inputText('measurement:item-1'), '-');
      expect(restored.inputText('odometerKm'), '1201.0');
      final payload = jsonDecode(
        (await db.queue(owner)).single.payload,
      )['inspection'];
      expect(payload.containsKey('_input'), isFalse);
      expect(payload['odometerKm'], isA<int>());
    },
  );
  test('outbox failure rolls aggregate back in the same transaction', () async {
    await db.customSelect('SELECT 1').get();
    await db.customStatement(
      "CREATE TRIGGER fail_queue BEFORE INSERT ON pending_operations BEGIN SELECT RAISE(ABORT, 'disk failure'); END",
    );
    await expectLater(db.saveDraft(owner, draft()), throwsA(anything));
    expect(await db.drafts(owner), isEmpty);
  });
  test(
    'an attempted request remains byte stable while later autosaves chain versions',
    () async {
      await db.saveDraft(owner, draft());
      final first = await db.claimNext(owner);
      final edited = draft()..inspection['notes'] = 'Depois da tentativa';
      await db.saveDraft(owner, edited);
      final queue = await db.queue(owner);
      expect(queue.length, 2);
      expect(queue.first.payload, first!.payload);
      expect(jsonDecode(queue.last.payload)['expectedVersion'], 1);
      await db.recordFailure(owner, first.id, 'Sem rede', false);
      expect((await db.claimNext(owner))!.payload, first.payload);
    },
  );
  test(
    'unsent typing coalesces without duplicating revision or losing text',
    () async {
      await db.saveDraft(owner, draft());
      final edited = draft()..inspection['notes'] = 'Texto completo';
      await db.saveDraft(owner, edited);
      final queue = await db.queue(owner);
      expect(queue.length, 1);
      expect(
        jsonDecode(queue.single.payload)['inspection']['notes'],
        'Texto completo',
      );
      expect(jsonDecode(queue.single.payload)['expectedVersion'], 0);
    },
  );
  test(
    'acknowledging an older operation never overwrites a newer local edit',
    () async {
      await db.saveDraft(owner, draft());
      final first = (await db.claimNext(owner))!;
      await db.saveDraft(owner, draft()..inspection['notes'] = 'Ainda local');
      await db.acknowledge(owner, first.id, 1);
      expect(
        (await db.drafts(owner)).single.inspection['notes'],
        'Ainda local',
      );
      expect((await db.queue(owner)).length, 1);
    },
  );
  test(
    'a different owner cannot read change acknowledge or send pending work',
    () async {
      await db.saveDraft(owner, draft());
      expect(await db.drafts('other'), isEmpty);
      expect(await db.queue('other'), isEmpty);
      expect(await db.claimNext('other'), isNull);
      await expectLater(
        db.saveDraft('other', draft()),
        throwsA(isA<StateError>()),
      );
      final operation = (await db.queue(owner)).single;
      await expectLater(
        db.acknowledge('other', operation.id, 1),
        throwsA(isA<StateError>()),
      );
      expect((await db.queue(owner)).length, 1);
    },
  );
  test(
    'finalization blocks missing and out of range measurements and later changes',
    () async {
      final value = draft();
      expect(value.validationErrors(), isNotEmpty);
      value.setAnswer('item-1', status: 'OK', value: 11);
      expect(value.validationErrors(), isNotEmpty);
      value.setAnswer('item-1', status: 'OK', value: 5);
      expect(value.validationErrors(), isEmpty);
      value.finalize(DateTime.utc(2026, 9, 9, 1));
      await db.saveDraft(owner, value);
      await expectLater(
        db.saveDraft(owner, draft()),
        throwsA(isA<StateError>()),
      );
      expect((await db.drafts(owner)).single.finalized, isTrue);
    },
  );
  test(
    'conflict blocks that inspection without silently discarding its payload',
    () async {
      await db.saveDraft(owner, draft());
      final operation = (await db.claimNext(owner))!;
      await db.recordFailure(owner, operation.id, 'Conflito no servidor', true);
      expect(await db.claimNext(owner), isNull);
      expect((await db.queue(owner)).single.payload, operation.payload);
      expect((await db.queue(owner)).single.blocked, isTrue);
    },
  );
}
