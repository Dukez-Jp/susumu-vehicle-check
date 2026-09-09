import 'dart:convert';
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
  test('legacy omitted and null options allow all five optional decisions', () {
    for (final explicitNull in [false, true]) {
      for (final status in [
        'OK',
        'Attention',
        'Repair',
        'Critical',
        'NotApplicable',
      ]) {
        final value = draft()..setAnswer('item-1', status: status, value: 5);
        value.definitions.single['required'] = false;
        if (explicitNull) value.definitions.single['allowedStatuses'] = null;
        expect(
          value.validationErrors(),
          isEmpty,
          reason: '$explicitNull/$status',
        );
      }
    }
  });

  test(
    'status and measurement finalization reject choices outside pinned options',
    () {
      for (final responseType in ['status', 'measurement']) {
        final value = draft()
          ..setAnswer(
            'item-1',
            status: 'NotApplicable',
            notes: 'Retomar depois',
          );
        value.definitions.single
          ..['responseType'] = responseType
          ..['allowedStatuses'] = ['OK', 'Critical'];
        expect(() => value.finalize(DateTime.now()), throwsStateError);
        expect(value.finalized, isFalse);
        expect(value.answer('item-1')!['status'], 'NotApplicable');
        expect(value.answer('item-1')!['notes'], 'Retomar depois');
        value.setAnswer('item-1', status: 'Attention', value: 5);
        expect(value.validationErrors(), isNotEmpty);
        value.setAnswer('item-1', status: 'Critical');
        expect(value.validationErrors(), isEmpty);
        value.finalize(DateTime.now());
        expect(value.finalized, isTrue);
      }
    },
  );

  test(
    'required item accepts explicit allowed N/A but rejects absence and disallowed N/A',
    () {
      final value = draft();
      value.definitions.single['allowedStatuses'] = ['OK', 'NotApplicable'];
      expect(value.validationErrors(), isNotEmpty);
      expect(() => value.finalize(DateTime.now()), throwsStateError);
      value.setAnswer('item-1', status: 'NotApplicable');
      expect(value.validationErrors(), isEmpty);
      value.definitions.single['allowedStatuses'] = ['OK'];
      expect(() => value.finalize(DateTime.now()), throwsStateError);
      expect(value.answer('item-1')!['status'], 'NotApplicable');
      value.definitions.single['allowedStatuses'] = ['OK', 'NotApplicable'];
      value.finalize(DateTime.now());
      expect(value.finalized, isTrue);
      expect(value.answer('item-1')!['status'], 'NotApplicable');
      expect(value.answer('item-1')!['value'], isNull);
    },
  );

  test('explicit empty options never fall back to all statuses', () {
    final value = draft()..setAnswer('item-1', status: 'OK', value: 5);
    value.definitions.single['allowedStatuses'] = <String>[];
    expect(() => value.finalize(DateTime.now()), throwsStateError);
  });

  test(
    'pinned options and invalid draft survive reopen without rewriting attempted bytes',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'susumu-options-',
      );
      final file = File('${directory.path}/options.sqlite');
      var db = AppDatabase(NativeDatabase(file));
      const owner = 'https://test.example|owner';
      try {
        final value = draft()..setAnswer('item-1', status: 'NotApplicable');
        value.definitions.single['allowedStatuses'] = ['OK', 'Critical'];
        await db.cache('bootstrap|$owner', {
          'templates': [value.template],
        });
        await db.saveDraft(owner, value);
        final attempted = (await db.claimNext(owner))!;
        value.definitions.single['allowedStatuses'] = ['Attention'];
        await db.cache('bootstrap|$owner', {
          'templates': [value.template],
        });
        await db.close();
        db = AppDatabase(NativeDatabase(file));
        final restored = (await db.drafts(owner)).single;
        expect(restored.definitions.single['allowedStatuses'], [
          'OK',
          'Critical',
        ]);
        expect(restored.answer('item-1')!['status'], 'NotApplicable');
        expect(restored.validationErrors(), isNotEmpty);
        expect(
          (await db.cached(
            'bootstrap|$owner',
          ))!['templates'][0]['sections'][0]['items'][0]['allowedStatuses'],
          ['Attention'],
        );
        restored.setAnswer('item-1', status: 'OK', value: 5);
        restored.finalize(DateTime.now());
        await db.saveDraft(owner, restored);
        final queue = await db.queue(owner);
        expect(queue, hasLength(2));
        expect(queue.first.id, attempted.id);
        expect(queue.first.payload, attempted.payload);
        expect(
          jsonDecode(queue.last.payload)['inspection']['state'],
          'Finalized',
        );
        expect(
          jsonDecode(queue.first.payload)['inspection']['items'][0]['status'],
          'NotApplicable',
        );
      } finally {
        await db.close();
        await directory.delete(recursive: true);
      }
    },
  );

  testWidgets(
    'offline pinned subset hides other choices and requires explicit replacement of old N/A',
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
      final value = draft()
        ..setAnswer('item-1', status: 'NotApplicable', value: 5);
      value.definitions.single['allowedStatuses'] = ['OK', 'Critical'];
      await db.saveDraft(sessions.current!.owner, value);
      final sync = SyncEngine(db, sessions);
      await tester.binding.setSurfaceSize(const Size(1200, 950));
      try {
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
        await tester.tap(find.text('Continuar inspeção').first);
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('item-1-OK')), findsOneWidget);
        expect(find.byKey(const Key('item-1-Critical')), findsOneWidget);
        expect(find.byKey(const Key('item-1-Attention')), findsNothing);
        expect(find.byKey(const Key('item-1-Repair')), findsNothing);
        expect(find.byKey(const Key('item-1-NotApplicable')), findsNothing);
        expect(find.textContaining('N/A não é permitido'), findsOneWidget);
        expect(
          (await db.drafts(
            sessions.current!.owner,
          )).single.answer('item-1')!['status'],
          'NotApplicable',
        );
        await tester.tap(find.byKey(const Key('item-1-OK')));
        await tester.pumpAndSettle();
        expect(find.textContaining('N/A não é permitido'), findsNothing);
        expect(
          (await db.drafts(
            sessions.current!.owner,
          )).single.answer('item-1')!['value'],
          5,
        );
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
        await tester.tap(find.text('Finalizar inspeção'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Confirmar finalização'));
        await tester.pumpAndSettle();
        expect(
          (await db.drafts(sessions.current!.owner)).single.finalized,
          isTrue,
        );
        expect(tester.takeException(), isNull);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.binding.setSurfaceSize(null);
        sync.dispose();
        sessions.dispose();
        await db.close();
      }
    },
  );
}
