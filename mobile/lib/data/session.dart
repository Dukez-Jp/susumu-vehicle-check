import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';
import '../domain.dart';
import 'api.dart';
import 'database.dart';

abstract interface class SecretStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class AndroidSecretStore implements SecretStore {
  final FlutterSecureStorage storage = const FlutterSecureStorage();
  @override
  Future<String?> read(String key) => storage.read(key: key);
  @override
  Future<void> write(String key, String value) =>
      storage.write(key: key, value: value);
  @override
  Future<void> delete(String key) => storage.delete(key: key);
}

class Session {
  Session(
    this.server,
    this.token,
    this.user,
    this.expiresAt,
    this.offlineUntil,
  );
  final String server, token;
  final Json user;
  final DateTime expiresAt, offlineUntil;
  String get owner =>
      '$server|${user['id']}|${user['companyId']}|${user['locationId']}';
  bool editable(DateTime now) =>
      user['active'] == true &&
      now.isBefore(offlineUntil) &&
      ['Inspector', 'Supervisor', 'Administrator'].contains(user['role']);
  bool onlineValid(DateTime now) =>
      user['active'] == true && now.isBefore(expiresAt);
  Json toJson() => {
    'server': server,
    'token': token,
    'user': user,
    'expiresAt': expiresAt.toIso8601String(),
    'offlineUntil': offlineUntil.toIso8601String(),
  };
  factory Session.fromJson(Json value) => Session(
    value['server'] as String,
    value['token'] as String,
    value['user'] as Json,
    DateTime.parse(value['expiresAt'] as String),
    DateTime.parse(value['offlineUntil'] as String),
  );
}

typedef ApiFactory = ApiClient Function(String server, String token);

class SessionManager extends ChangeNotifier {
  SessionManager(
    this.db,
    this.secrets, {
    ApiFactory? factory,
    DateTime Function()? clock,
  }) : factory = factory ?? ((server, token) => ApiClient(server, token)),
       clock = clock ?? DateTime.now;
  final AppDatabase db;
  final SecretStore secrets;
  final ApiFactory factory;
  final DateTime Function() clock;
  Session? current;
  String server = '', deviceId = '';
  Json? bootstrap;
  DateTime? _lastSeen;
  int generation = 0;
  DateTime get now {
    final current = clock().toUtc();
    return _lastSeen != null && _lastSeen!.isAfter(current)
        ? _lastSeen!
        : current;
  }

  Future<void> restore() async {
    server = await secrets.read('server') ?? '';
    deviceId = await secrets.read('deviceId') ?? const Uuid().v4();
    await secrets.write('deviceId', deviceId);
    _lastSeen = DateTime.tryParse(await secrets.read('lastSeen') ?? '');
    final serialized = await secrets.read('session');
    if (serialized != null) {
      current = Session.fromJson(jsonDecode(serialized) as Json);
      bootstrap = await db.cached('bootstrap|${current!.owner}');
    }
    await _observeTime();
    notifyListeners();
  }

  Future<void> _observeTime() async {
    _lastSeen = now;
    await secrets.write('lastSeen', _lastSeen!.toIso8601String());
  }

  Future<void> recordAuthorizedActivity(DateTime authorizedAt) async {
    if (_lastSeen == null || authorizedAt.isAfter(_lastSeen!)) {
      _lastSeen = authorizedAt;
    }
    await secrets.write('lastSeen', _lastSeen!.toIso8601String());
  }

  Future<void> login(String url, String username, String password) async {
    final origin = normalizeServer(
      url,
      allowDevHttp:
          !kReleaseMode && const bool.fromEnvironment('ALLOW_HTTP_DEV'),
    );
    final loginApi = factory(origin, '');
    Json response;
    try {
      response = await loginApi.login(username.trim(), password, deviceId);
    } finally {
      loginApi.close();
    }
    final session = Session(
      origin,
      response['accessToken'] as String,
      response['user'] as Json,
      DateTime.parse(response['expiresAt'] as String),
      DateTime.parse(response['offlineUntil'] as String),
    );
    final api = factory(origin, session.token);
    Json data;
    try {
      data = await api.bootstrap();
    } finally {
      api.close();
    }
    if (data['user']['id'] != session.user['id'] ||
        data['user']['active'] != true) {
      throw StateError('Conta indisponível.');
    }
    final localLimit = clock().toUtc().add(const Duration(hours: 72));
    final bounded = Session(
      origin,
      session.token,
      data['user'] as Json,
      session.expiresAt,
      session.offlineUntil.isBefore(localLimit)
          ? session.offlineUntil
          : localLimit,
    );
    await db.cache('bootstrap|${bounded.owner}', data);
    await secrets.write('server', origin);
    await secrets.write('session', jsonEncode(bounded.toJson()));
    // Online authentication is the only way to reset clock-rollback high-water state.
    _lastSeen = clock().toUtc();
    await _observeTime();
    server = origin;
    current = bounded;
    bootstrap = data;
    generation++;
    notifyListeners();
  }

  Future<void> logout() async {
    current = null;
    bootstrap = null;
    generation++;
    notifyListeners();
    await secrets.delete('session');
  }

  Future<void> refreshBootstrap() async {
    final session = current;
    if (session == null || !session.onlineValid(now)) {
      throw StateError('Entre novamente para atualizar o catálogo.');
    }
    final start = generation, api = factory(session.server, session.token);
    try {
      final data = await api.bootstrap();
      if (generation != start) return;
      final user = data['user'] as Json;
      if (user['active'] != true ||
          [
            'id',
            'role',
            'companyId',
            'locationId',
          ].any((field) => user[field] != session.user[field])) {
        await logout();
        throw StateError(
          'Permissões alteradas; entre novamente. Seus rascunhos foram preservados.',
        );
      }
      await db.cache('bootstrap|${session.owner}', data);
      bootstrap = data;
      notifyListeners();
    } on ApiException catch (error) {
      if (error.status == 401 && generation == start) await logout();
      rethrow;
    } finally {
      api.close();
    }
  }

  Future<void> assertEditable(String owner) async {
    final session = current;
    if (session == null || session.owner != owner || !session.editable(now)) {
      throw StateError(
        'Sessão offline vencida ou sem permissão. Entre novamente; seus registros estão preservados.',
      );
    }
    await _observeTime();
    if (current?.owner != owner) throw StateError('Sessão alterada.');
  }
}
