import 'camera.dart';
import 'database.dart';
import 'editor.dart';
import 'photos.dart';
import 'session.dart';

class RecoveryService {
  RecoveryService(this.db, this.sessions, this.photos);
  final AppDatabase db;
  final SessionManager sessions;
  final PhotoStore photos;
  final List<String> warnings = [];
  Future<int> recoverFiles() async {
    final session = sessions.current;
    if (session == null || !session.editable(sessions.now)) return 0;
    final existing = (await db.photos(
      session.owner,
    )).map((photo) => photo.id).toSet();
    var count = 0;
    for (final artifact in await photos.recoverable(
      session.owner,
      knownIds: existing,
    )) {
      if (existing.contains(artifact.metadata['id'])) continue;
      await sessions.assertEditable(session.owner);
      final draft = await db.draftById(
        session.owner,
        artifact.metadata['inspectionId'] as String,
      );
      if (draft == null || draft.finalized) {
        warnings.add(
          'Foto recuperável ${artifact.metadata['id']} requer revisão: rascunho ausente ou finalizado. O arquivo foi preservado.',
        );
        continue;
      }
      final editor = DraftEditor(db, sessions, session.owner, draft);
      try {
        await editor.attach(artifact.metadata, artifact.filePath);
        count++;
      } catch (error) {
        warnings.add(
          'Foto ${artifact.metadata['id']} preservada, mas não vinculada: $error',
        );
      } finally {
        editor.dispose();
      }
    }
    return count;
  }

  Future<void> recoverCamera() async {
    final result = await CameraService(db, photos).recover();
    if (result?.owner == sessions.current?.owner && result?.warning != null) {
      warnings.add(result!.warning!);
    }
    final owner = sessions.current?.owner;
    if (owner == null) return;
    final diagnostics = await db.cached('camera-diagnostics|$owner');
    final count = (diagnostics?['entries'] as List? ?? []).length;
    if (count > 0) {
      warnings.add(
        '$count captura(s) anterior(es) desta sessão ficaram sem arquivo recuperável. Confira as fotos e fotografe novamente. Diagnóstico preservado para suporte.',
      );
    }
  }
}
