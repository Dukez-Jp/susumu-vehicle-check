import 'dart:convert';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:susumu_vehicle_check/data/api.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/session.dart';
import 'fixtures.dart';

class MemorySecrets implements SecretStore {
  final values = <String, String>{};
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }
}

void main() {
  test('reassigned company or location gets a separate offline partition', () {
    final now = DateTime.utc(2026, 9, 9);
    final first = Session(
      'https://test.example',
      'token',
      {'id': 'same', 'companyId': 'one', 'locationId': 'a'},
      now,
      now,
    );
    final otherLocation = Session(
      'https://test.example',
      'token',
      {'id': 'same', 'companyId': 'one', 'locationId': 'b'},
      now,
      now,
    );
    final otherCompany = Session(
      'https://test.example',
      'token',
      {'id': 'same', 'companyId': 'two', 'locationId': 'a'},
      now,
      now,
    );
    expect(first.owner, isNot(otherLocation.owner));
    expect(first.owner, isNot(otherCompany.owner));
  });
  late AppDatabase db;
  late MemorySecrets secrets;
  late DateTime now;
  late SessionManager manager;
  test(
    'bootstrap permission change revokes offline editing immediately',
    () async {
      manager.dispose();
      manager = SessionManager(
        db,
        secrets,
        clock: () => now,
        factory: (server, token) => ApiClient(
          server,
          token,
          client: MockClient(
            (_) async => http.Response(
              jsonEncode({
                'user': {
                  'id': 'user-1',
                  'active': true,
                  'role': 'Office',
                  'companyId': 'company',
                  'locationId': 'location',
                },
                'vehicles': [],
                'templates': [],
              }),
              200,
            ),
          ),
        ),
      );
      final session = Session(
        'https://test.example',
        'token',
        {
          'id': 'user-1',
          'active': true,
          'role': 'Inspector',
          'companyId': 'company',
          'locationId': 'location',
        },
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      manager.current = session;
      await expectLater(manager.refreshBootstrap(), throwsA(isA<StateError>()));
      expect(manager.current, isNull);
      await expectLater(
        manager.assertEditable(session.owner),
        throwsA(isA<StateError>()),
      );
    },
  );
  final user = {
    'id': 'user-1',
    'name': 'Teste',
    'username': 'test',
    'role': 'Inspector',
    'companyId': 'company',
    'locationId': 'location',
    'active': true,
  };
  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    secrets = MemorySecrets();
    now = DateTime.utc(2026, 9, 9);
    manager = SessionManager(db, secrets, clock: () => now);
  });
  tearDown(() async {
    manager.dispose();
    await db.close();
  });
  test(
    'restores cached offline session but expires drafting after 72 hours',
    () async {
      final session = Session(
        'https://test.example',
        'token',
        user,
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      await secrets.write('session', jsonEncode(session.toJson()));
      await db.cache('bootstrap|${session.owner}', {
        'vehicles': [],
        'templates': [],
        'user': user,
      });
      await manager.restore();
      await manager.assertEditable(session.owner);
      now = now.add(const Duration(hours: 73));
      await expectLater(
        manager.assertEditable(session.owner),
        throwsA(isA<StateError>()),
      );
    },
  );
  test(
    'logout removes token and blocks access while preserving local drafts',
    () async {
      final session = Session(
        'https://test.example',
        'token',
        user,
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      manager.current = session;
      await secrets.write('session', jsonEncode(session.toJson()));
      await db.saveDraft(session.owner, draft());
      await manager.logout();
      expect(await secrets.read('session'), isNull);
      expect(manager.current, isNull);
      await expectLater(
        manager.assertEditable(session.owner),
        throwsA(isA<StateError>()),
      );
      expect((await db.drafts(session.owner)).length, 1);
    },
  );
  test(
    'moving device clock backwards does not extend offline validity',
    () async {
      final session = Session(
        'https://test.example',
        'token',
        user,
        now.add(const Duration(hours: 1)),
        now.add(const Duration(hours: 72)),
      );
      await secrets.write('session', jsonEncode(session.toJson()));
      await secrets.write(
        'lastSeen',
        now.add(const Duration(hours: 73)).toIso8601String(),
      );
      await manager.restore();
      await expectLater(
        manager.assertEditable(session.owner),
        throwsA(isA<StateError>()),
      );
    },
  );
}
