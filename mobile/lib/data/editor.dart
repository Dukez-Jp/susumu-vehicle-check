import 'dart:async';
import 'package:flutter/foundation.dart';
import '../domain.dart';
import 'database.dart';
import 'session.dart';

class DraftEditor extends ChangeNotifier {
  DraftEditor(this.db, this.sessions, this.owner, this.draft);
  final AppDatabase db;
  final SessionManager sessions;
  final String owner;
  InspectionDraft draft;
  Future<void> _pending = Future.value();
  int _revision = 0;
  bool saving = false, finalizing = false;
  String? error;
  bool _disposed = false;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void edit(void Function(InspectionDraft) change) {
    if (draft.finalized ||
        finalizing ||
        sessions.current?.owner != owner ||
        !sessions.current!.editable(sessions.now)) {
      throw StateError('Inspeção indisponível para edição.');
    }
    change(draft);
    final authorizedAt = sessions.now;
    final snapshot = InspectionDraft(
      copyJson(draft.inspection),
      copyJson(draft.template),
      copyJson(draft.vehicle),
    );
    final revision = ++_revision;
    saving = true;
    error = null;
    _notify();
    _pending = _pending.then((_) async {
      try {
        // Authorization was checked when the user entered this snapshot. Finish
        // its private local commit even if logout happens before the I/O starts.
        await db.saveDraft(owner, snapshot);
        await sessions.recordAuthorizedActivity(authorizedAt);
        if (revision == _revision) error = null;
      } catch (e) {
        error = 'Não foi possível salvar no tablet: $e';
      } finally {
        if (revision == _revision) saving = false;
        _notify();
      }
    });
  }

  Future<void> flush() async {
    await _pending;
    if (error != null) throw StateError(error!);
  }

  Future<void> retry() async {
    await _pending;
    await sessions.assertEditable(owner);
    saving = true;
    _notify();
    try {
      await db.saveDraft(owner, draft);
      error = null;
    } catch (e) {
      error = e.toString();
      rethrow;
    } finally {
      saving = false;
      _notify();
    }
  }

  Future<void> finalize() async {
    await flush();
    await sessions.assertEditable(owner);
    finalizing = true;
    _notify();
    final snapshot = InspectionDraft(
      copyJson(draft.inspection),
      copyJson(draft.template),
      copyJson(draft.vehicle),
    );
    try {
      snapshot.finalize(sessions.now);
      await db.saveDraft(owner, snapshot);
      draft = snapshot;
      error = null;
    } catch (e) {
      error = 'Finalização não salva: $e';
      rethrow;
    } finally {
      finalizing = false;
      _notify();
    }
  }

  Future<void> attach(Json metadata, String filePath) async {
    await flush();
    await sessions.assertEditable(owner);
    finalizing = true;
    _notify();
    final snapshot = InspectionDraft(
      copyJson(draft.inspection),
      copyJson(draft.template),
      copyJson(draft.vehicle),
    );
    try {
      if (metadata['kind'] == 'Signature') {
        if (snapshot.inspection['signaturePhotoId'] != null) {
          throw StateError(
            'A assinatura já foi preservada. Crie uma correção para assinar novamente.',
          );
        }
        snapshot.inspection['signaturePhotoId'] = metadata['id'];
      } else {
        final itemId = metadata['itemId'] as String;
        final ids = List<String>.from(
          snapshot.answer(itemId)?['photoIds'] as List? ?? [],
        );
        if (!ids.contains(metadata['id'])) ids.add(metadata['id'] as String);
        snapshot.setAnswer(itemId, photoIds: ids);
      }
      await db.attachPhoto(owner, snapshot, metadata, filePath);
      draft = snapshot;
      error = null;
    } catch (e) {
      error = 'Foto preservada, mas vínculo não salvo: $e';
      rethrow;
    } finally {
      finalizing = false;
      _notify();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
