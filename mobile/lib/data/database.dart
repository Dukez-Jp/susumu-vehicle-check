import 'dart:convert';
import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import '../domain.dart';
part 'database.g.dart';

class LocalInspections extends Table {
  TextColumn get id => text()();
  TextColumn get owner => text()();
  TextColumn get payload => text()();
  TextColumn get templateJson => text()();
  TextColumn get vehicleJson => text()();
  IntColumn get serverVersion => integer().withDefault(const Constant(0))();
  DateTimeColumn get updatedAt => dateTime()();
  @override
  Set<Column> get primaryKey => {id};
}

class PendingOperations extends Table {
  IntColumn get sequence => integer().autoIncrement()();
  TextColumn get id => text().unique()();
  TextColumn get owner => text()();
  TextColumn get inspectionId => text()();
  TextColumn get payload => text()();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  BoolColumn get blocked => boolean().withDefault(const Constant(false))();
  TextColumn get error => text().nullable()();
}

class CachedObjects extends Table {
  TextColumn get cacheKey => text()();
  TextColumn get payload => text()();
  @override
  Set<Column> get primaryKey => {cacheKey};
}

class LocalPhotos extends Table {
  TextColumn get id => text()();
  TextColumn get owner => text()();
  TextColumn get inspectionId => text()();
  TextColumn get metadata => text()();
  TextColumn get filePath => text()();
  BoolColumn get uploaded => boolean().withDefault(const Constant(false))();
  TextColumn get error => text().nullable()();
  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(
  tables: [LocalInspections, PendingOperations, CachedObjects, LocalPhotos],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.executor);
  @override
  int get schemaVersion => 1;
  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) => m.createAll(),
    beforeOpen: (_) async {
      await customStatement('PRAGMA foreign_keys = ON');
      await customStatement('PRAGMA synchronous = FULL');
    },
  );
  Future<void> saveDraft(String owner, InspectionDraft draft) {
    // Capture before entering asynchronous transaction: typing must not mutate a queued snapshot.
    final snapshot = InspectionDraft(
      copyJson(draft.inspection),
      copyJson(draft.template),
      copyJson(draft.vehicle),
    );
    return transaction(() async {
      final existing = await (select(
        localInspections,
      )..where((t) => t.id.equals(snapshot.id))).getSingleOrNull();
      if (existing != null && existing.owner != owner) {
        throw StateError('Inspeção pertence a outro usuário.');
      }
      if (existing != null &&
          (jsonDecode(existing.payload) as Json)['state'] == 'Finalized') {
        throw StateError('Inspeção finalizada é imutável.');
      }
      if (snapshot.finalized && snapshot.validationErrors().isNotEmpty) {
        throw StateError('Inspeção incompleta.');
      }
      if (snapshot.finalized &&
          snapshot.inspection['signaturePhotoId'] != null) {
        final signature =
            await (select(localPhotos)..where(
                  (t) =>
                      t.owner.equals(owner) &
                      t.inspectionId.equals(snapshot.id) &
                      t.id.equals(
                        snapshot.inspection['signaturePhotoId'] as String,
                      ),
                ))
                .getSingleOrNull();
        if (signature == null ||
            (jsonDecode(signature.metadata) as Json)['kind'] != 'Signature') {
          throw StateError('Assinatura local não encontrada.');
        }
      }
      final pending =
          await (select(pendingOperations)
                ..where(
                  (t) =>
                      t.owner.equals(owner) &
                      t.inspectionId.equals(snapshot.id),
                )
                ..orderBy([(t) => OrderingTerm.asc(t.sequence)]))
              .get();
      final tail = pending.lastOrNull;
      var expected = (existing?.serverVersion ?? 0) + pending.length;
      if (tail != null && tail.attempts == 0 && !tail.blocked) {
        expected--;
        await (delete(
          pendingOperations,
        )..where((t) => t.id.equals(tail.id) & t.owner.equals(owner))).go();
      }
      final operationId = const Uuid().v4();
      snapshot.inspection['version'] = expected;
      // A draft may be incomplete. Null-status items stay local until an explicit answer is made.
      final wire = copyJson(snapshot.inspection);
      wire['notes'] = notesForServer(wire);
      wire.remove('_input');
      wire.remove('_recovery');
      if (pendingInputReason(wire) == null) {
        wire['odometerKm'] = (wire['odometerKm'] as num).toInt();
      }
      wire['items'] = (wire['items'] as List)
          .where((item) => statuses.containsKey(item['status']))
          .toList();
      await into(localInspections).insertOnConflictUpdate(
        LocalInspectionsCompanion.insert(
          id: snapshot.id,
          owner: owner,
          payload: jsonEncode(snapshot.inspection),
          templateJson: jsonEncode(snapshot.template),
          vehicleJson: jsonEncode(snapshot.vehicle),
          serverVersion: Value(existing?.serverVersion ?? 0),
          updatedAt: DateTime.now().toUtc(),
        ),
      );
      await into(pendingOperations).insert(
        PendingOperationsCompanion.insert(
          id: operationId,
          owner: owner,
          inspectionId: snapshot.id,
          payload: jsonEncode({
            'operationId': operationId,
            'expectedVersion': expected,
            'inspection': wire,
          }),
        ),
      );
    });
  }

  InspectionDraft _draft(LocalInspection row) => InspectionDraft(
    jsonDecode(row.payload) as Json,
    jsonDecode(row.templateJson) as Json,
    jsonDecode(row.vehicleJson) as Json,
  );
  Future<List<InspectionDraft>> drafts(String owner) async =>
      (await (select(localInspections)
                ..where((t) => t.owner.equals(owner))
                ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)]))
              .get())
          .map(_draft)
          .toList();
  // Deliberately expose only a boolean, never identities or inspection details.
  Future<bool> hasOtherSessionWork(String owner) async {
    final rows =
        await (select(localInspections)
              ..where((t) => t.owner.equals(owner).not())
              ..limit(1))
            .get();
    if (rows.isNotEmpty) return true;
    final camera = await cached('camera');
    return camera != null && camera['owner'] != owner;
  }

  Future<InspectionDraft?> draftById(String owner, String id) async {
    final row = await (select(
      localInspections,
    )..where((t) => t.owner.equals(owner) & t.id.equals(id))).getSingleOrNull();
    return row == null ? null : _draft(row);
  }

  Future<List<PendingOperation>> queue(String owner) =>
      (select(pendingOperations)
            ..where((t) => t.owner.equals(owner))
            ..orderBy([(t) => OrderingTerm.asc(t.sequence)]))
          .get();
  Future<PendingOperation?> claimNext(
    String owner, {
    Set<String> excluded = const {},
  }) => transaction(() async {
    final rows = await queue(owner);
    final seen = <String>{...excluded};
    PendingOperation? row;
    for (final candidate in rows) {
      // Only each aggregate's head is eligible. Never skip a failed head to
      // send its tail, but independent inspections can still make progress.
      if (!seen.add(candidate.inspectionId)) continue;
      if (candidate.blocked ||
          pendingInputReason(
                (jsonDecode(candidate.payload) as Json)['inspection'] as Json,
              ) !=
              null) {
        continue;
      }
      row = candidate;
      break;
    }
    if (row == null) return null;
    final selected = row;
    await (update(
      pendingOperations,
    )..where((t) => t.id.equals(selected.id) & t.owner.equals(owner))).write(
      PendingOperationsCompanion(
        attempts: Value(selected.attempts + 1),
        error: const Value(null),
      ),
    );
    return selected;
  });
  Future<void> recordFailure(
    String owner,
    String id,
    String error,
    bool blocked,
  ) async {
    await (update(
      pendingOperations,
    )..where((t) => t.id.equals(id) & t.owner.equals(owner))).write(
      PendingOperationsCompanion(error: Value(error), blocked: Value(blocked)),
    );
  }

  Future<void> acknowledge(String owner, String id, int version) =>
      transaction(() async {
        final operation =
            await (select(pendingOperations)
                  ..where((t) => t.owner.equals(owner) & t.id.equals(id)))
                .getSingleOrNull();
        if (operation == null) {
          throw StateError('Operação não pertence a esta sessão.');
        }
        final expected =
            (jsonDecode(operation.payload) as Json)['expectedVersion'] as int;
        if (version != expected + 1) {
          throw StateError(
            'Servidor respondeu uma versão inesperada; fila preservada.',
          );
        }
        final inspection =
            (jsonDecode(operation.payload) as Json)['inspection'] as Json;
        final declared = (inspection['items'] as List)
            .expand((item) => (item['photoIds'] as List).cast<String>())
            .toSet()
            .toList();
        if (inspection['signaturePhotoId'] != null) {
          declared.add(inspection['signaturePhotoId'] as String);
        }
        await cache('declared|$owner|${operation.inspectionId}', {
          'photoIds': declared,
          'version': version,
        });
        await (update(localInspections)..where(
              (t) =>
                  t.id.equals(operation.inspectionId) & t.owner.equals(owner),
            ))
            .write(LocalInspectionsCompanion(serverVersion: Value(version)));
        await (delete(
          pendingOperations,
        )..where((t) => t.id.equals(id) & t.owner.equals(owner))).go();
      });
  Future<void> cache(String key, Json payload) =>
      into(cachedObjects).insertOnConflictUpdate(
        CachedObjectsCompanion.insert(
          cacheKey: key,
          payload: jsonEncode(payload),
        ),
      );
  Future<Json?> cached(String key) async {
    final row = await (select(
      cachedObjects,
    )..where((t) => t.cacheKey.equals(key))).getSingleOrNull();
    return row == null ? null : jsonDecode(row.payload) as Json;
  }

  Future<void> removeCache(String key) async {
    await (delete(cachedObjects)..where((t) => t.cacheKey.equals(key))).go();
  }

  Future<List<LocalPhoto>> photos(String owner, {String? inspectionId}) =>
      (select(localPhotos)..where(
            (t) =>
                t.owner.equals(owner) &
                (inspectionId == null
                    ? const Constant(true)
                    : t.inspectionId.equals(inspectionId)),
          ))
          .get();
  Future<void> attachPhoto(
    String owner,
    InspectionDraft value,
    Json photo,
    String path,
  ) {
    final draft = InspectionDraft(
      copyJson(value.inspection),
      copyJson(value.template),
      copyJson(value.vehicle),
    );
    final metadata = copyJson(photo);
    return transaction(() async {
      if (metadata['inspectionId'] != draft.id) {
        throw StateError('Foto pertence a outra inspeção.');
      }
      if (metadata['kind'] == 'Signature' &&
          (metadata['itemId'] != null || metadata['originalPhotoId'] != null)) {
        throw StateError('Assinatura deve pertencer à inspeção.');
      }
      if (metadata['kind'] == 'Annotation') {
        final original =
            await (select(localPhotos)..where(
                  (t) =>
                      t.id.equals(metadata['originalPhotoId'] as String) &
                      t.owner.equals(owner) &
                      t.inspectionId.equals(draft.id),
                ))
                .getSingleOrNull();
        if (original == null ||
            (jsonDecode(original.metadata) as Json)['kind'] != 'Original') {
          throw StateError('Foto original ausente.');
        }
      }
      await into(localPhotos).insert(
        LocalPhotosCompanion.insert(
          id: metadata['id'] as String,
          owner: owner,
          inspectionId: draft.id,
          metadata: jsonEncode(metadata),
          filePath: path,
        ),
      );
      await saveDraft(owner, draft);
    });
  }

  Future<void> photoResult(
    String owner,
    String id, {
    required bool uploaded,
    String? error,
  }) async {
    await (update(
      localPhotos,
    )..where((t) => t.id.equals(id) & t.owner.equals(owner))).write(
      LocalPhotosCompanion(uploaded: Value(uploaded), error: Value(error)),
    );
  }
}
