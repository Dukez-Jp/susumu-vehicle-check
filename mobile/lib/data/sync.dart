import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import '../domain.dart';
import 'api.dart';
import 'database.dart';
import 'session.dart';

class SyncEngine extends ChangeNotifier {
  SyncEngine(this.db, this.sessions);
  final AppDatabase db;
  final SessionManager sessions;
  bool running = false;
  String message = 'Alterações salvas no tablet';
  Timer? _timer;
  int _failures = 0;
  bool _disposed = false;
  void start() {
    _timer?.cancel();
    _timer = Timer(const Duration(seconds: 2), () => run());
  }

  Future<void> run() async {
    if (running || _disposed) return;
    _timer?.cancel();
    final session = sessions.current;
    if (session == null) return;
    if (!session.onlineValid(sessions.now)) {
      message = 'Entre novamente para sincronizar. Rascunhos preservados.';
      notifyListeners();
      return;
    }
    running = true;
    message = 'Sincronizando…';
    notifyListeners();
    final generation = sessions.generation;
    final api = sessions.factory(session.server, session.token);
    bool active() =>
        !_disposed &&
        sessions.generation == generation &&
        sessions.current?.owner == session.owner;
    var progress = 0, failures = 0;
    final deferred = <String>{};
    try {
      final user = await api.me();
      if (user['id'] != session.user['id'] ||
          user['active'] != true ||
          user['role'] != session.user['role'] ||
          (user.containsKey('companyId') &&
              user['companyId'] != session.user['companyId']) ||
          (user.containsKey('locationId') &&
              user['locationId'] != session.user['locationId'])) {
        if (active()) await sessions.logout();
        throw StateError('Permissões alteradas; entre novamente.');
      }
      while (active()) {
        final operation = await db.claimNext(session.owner, excluded: deferred);
        if (operation == null) break;
        if (!active()) break;
        try {
          final result = await api.sync(operation.payload);
          if (result['inspectionId'] != operation.inspectionId) {
            throw StateError('Servidor retornou outra inspeção.');
          }
          await db.acknowledge(
            session.owner,
            operation.id,
            result['version'] as int,
          );
          progress++;
        } catch (error) {
          final permanent =
              error is ApiException &&
                  [400, 403, 404, 409, 413, 415, 422].contains(error.status) ||
              error is StateError;
          await db.recordFailure(
            session.owner,
            operation.id,
            error.toString(),
            permanent,
          );
          if (error is ApiException && error.status == 401) rethrow;
          deferred.add(operation.inspectionId);
          failures++;
        }
      }
      if (!active()) return;
      final photos = await db.photos(session.owner);
      photos.sort(
        (a, b) =>
            ((jsonDecode(a.metadata) as Json)['kind'] == 'Annotation' ? 1 : 0)
                .compareTo(
                  (jsonDecode(b.metadata) as Json)['kind'] == 'Annotation'
                      ? 1
                      : 0,
                ),
      );
      for (final photo in photos.where((p) => !p.uploaded)) {
        if (!active()) break;
        final declaration = await db.cached(
          'declared|${session.owner}|${photo.inspectionId}',
        );
        if (!(declaration?['photoIds'] as List? ?? []).contains(photo.id)) {
          continue;
        }
        try {
          final file = File(photo.filePath),
              metadata = jsonDecode(photo.metadata) as Json;
          if (!await file.exists()) {
            throw StateError('Arquivo de foto não encontrado no tablet.');
          }
          final checksum = await sha256.bind(file.openRead()).first;
          if (checksum.toString() != metadata['sha256']) {
            throw StateError(
              'Checksum da foto divergiu; original preservado para revisão.',
            );
          }
          await api.upload(metadata, file);
          await db.photoResult(session.owner, photo.id, uploaded: true);
          progress++;
        } catch (error) {
          await db.photoResult(
            session.owner,
            photo.id,
            uploaded: false,
            error: error.toString(),
          );
          if (error is ApiException && error.status == 401) rethrow;
          failures++;
        }
      }
      _failures = failures > 0 && progress == 0
          ? (_failures + 1).clamp(1, 5)
          : 0;
      final pendingOperations = await db.queue(session.owner);
      final pendingPhotos = (await db.photos(
        session.owner,
      )).where((p) => !p.uploaded).toList();
      final blocked = pendingOperations.where((p) => p.blocked).length;
      final photoErrors = pendingPhotos.where((p) => p.error != null).length;
      message = blocked > 0 || photoErrors > 0
          ? '$blocked inspeção(ões) para revisão • $photoErrors foto(s) com falha. Demais envios continuam; dados preservados.'
          : pendingOperations.isNotEmpty
          ? '${pendingOperations.length} alteração(ões) aguardando envio ou preenchimento.'
          : pendingPhotos.isNotEmpty
          ? '${pendingPhotos.length} foto(s) aguardando declaração do item/assinatura ou sincronização.'
          : 'Tudo sincronizado';
    } catch (error) {
      _failures = (_failures + 1).clamp(1, 5);
      message = error is ApiException && error.status == 401
          ? 'Entre novamente para sincronizar.'
          : 'Sem sincronizar: $error';
      if (error is ApiException && error.status == 401 && active()) {
        // Rejected credentials revoke the offline session as well as network access.
        await sessions.logout();
      }
    } finally {
      api.close();
      running = false;
      if (!_disposed) {
        notifyListeners();
        _timer = Timer(Duration(seconds: 30 * (1 << _failures)), () => run());
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    super.dispose();
  }
}
