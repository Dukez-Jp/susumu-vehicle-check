import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:uuid/uuid.dart';
import '../domain.dart';
import 'database.dart';
import 'editor.dart';
import 'photos.dart';
import 'session.dart';

class ReviewCopyResult {
  ReviewCopyResult(this.draft, this.photoFailures);
  final InspectionDraft draft;
  final int photoFailures;
}

class ReviewCopyService {
  ReviewCopyService(this.db, this.sessions, this.photos);
  final AppDatabase db;
  final SessionManager sessions;
  final PhotoStore photos;
  Future<ReviewCopyResult> create(String sourceId, String reason) async {
    final owner = sessions.current?.owner;
    if (owner == null) throw StateError('Entre novamente.');
    await sessions.assertEditable(owner);
    final copy = await db.transaction(() async {
      final source = await db.draftById(owner, sourceId);
      final operations = await db.queue(owner);
      if (source == null ||
          !operations.any((o) => o.inspectionId == sourceId && o.blocked)) {
        throw StateError('A origem não é uma inspeção bloqueada desta sessão.');
      }
      final result = source.reviewCopy(
        const Uuid().v4(),
        sessions.deviceId,
        reason,
        sessions.now,
      );
      await db.saveDraft(owner, result);
      await db.cache('review-copy|$owner|${result.id}', {
        'sourceId': sourceId,
        'reason': reason.trim(),
      });
      return result;
    });
    // The new draft is durable before copying files. Any interrupted copy stays
    // visible in Resume; original records and their rejected operations are untouched.
    final editor = DraftEditor(db, sessions, owner, copy);
    var failures = 0;
    final mapping = <String, String>{};
    try {
      final originals = await db.photos(owner, inspectionId: sourceId);
      originals.sort(
        (a, b) =>
            ((jsonDecode(a.metadata) as Json)['kind'] == 'Annotation' ? 1 : 0)
                .compareTo(
                  (jsonDecode(b.metadata) as Json)['kind'] == 'Annotation'
                      ? 1
                      : 0,
                ),
      );
      for (final original in originals) {
        final metadata = jsonDecode(original.metadata) as Json;
        if (metadata['kind'] == 'Signature') continue;
        try {
          final bytes = await File(original.filePath).readAsBytes();
          if (sha256.convert(bytes).toString() != metadata['sha256']) {
            throw StateError('Checksum divergiu.');
          }
          final originalId = metadata['originalPhotoId'] as String?;
          if (metadata['kind'] == 'Annotation' &&
              !mapping.containsKey(originalId)) {
            throw StateError('Original não copiado.');
          }
          final artifact = await photos.preserve(
            owner: owner,
            inspectionId: copy.id,
            itemId: metadata['itemId'] as String,
            bytes: bytes,
            kind: metadata['kind'] as String,
            originalPhotoId: originalId == null ? null : mapping[originalId],
          );
          await editor.attach(artifact.metadata, artifact.filePath);
          mapping[original.id] = artifact.metadata['id'] as String;
        } catch (_) {
          failures++;
        }
      }
      if (failures > 0) {
        editor.edit(
          (draft) =>
              (draft.inspection['_recovery'] as Json)['photoCopyFailures'] =
                  failures,
        );
        await editor.flush();
      }
      return ReviewCopyResult(editor.draft, failures);
    } finally {
      editor.dispose();
    }
  }
}
