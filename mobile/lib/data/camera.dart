import 'dart:io';
import 'dart:typed_data';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';
import 'database.dart';
import 'photos.dart';

abstract interface class CameraSource {
  bool get supportsRecovery;
  Future<XFile?> pick();
  Future<List<XFile>> retrieveLost();
}

class DeviceCameraSource implements CameraSource {
  @override
  bool get supportsRecovery => Platform.isAndroid;
  @override
  Future<XFile?> pick() => ImagePicker().pickImage(
    source: ImageSource.camera,
    requestFullMetadata: false,
  );
  @override
  Future<List<XFile>> retrieveLost() async {
    final result = await ImagePicker().retrieveLostData();
    if (result.exception != null) throw result.exception!;
    return result.files ?? [];
  }
}

class CameraResult {
  CameraResult(this.owner, this.artifacts, [this.warning]);
  final String owner;
  final List<PhotoArtifact> artifacts;
  final String? warning;
}

// image_picker lost data is global to the app, so its journal and lock must be
// global too. Always drain into the recorded owner's private files, never into
// whichever account happens to be logged in after Android restarts the app.
class CameraService {
  CameraService(
    this.db,
    this.photos, {
    CameraSource? source,
    Future<Uint8List> Function(String)? readSource,
  }) : source = source ?? DeviceCameraSource(),
       readSource = readSource ?? ((path) => File(path).readAsBytes());
  final AppDatabase db;
  final PhotoStore photos;
  final CameraSource source;
  final Future<Uint8List> Function(String) readSource;

  Future<CameraResult?> recover() => photos.serializeCamera(_drain);

  Future<CameraResult> capture({
    required String owner,
    required String inspectionId,
    required String itemId,
    Future<void> Function()? authorize,
  }) => photos.serializeCamera(() async {
    final previous = await _drain();
    if (authorize != null) await authorize();
    final journal = <String, dynamic>{
      'owner': owner,
      'inspectionId': inspectionId,
      'itemId': itemId,
      'captureId': const Uuid().v4(),
    };
    await db.cache('camera', journal);
    XFile? file;
    try {
      file = await source.pick();
    } catch (_) {
      // No returned file exists to preserve. Clear this completed failure so
      // permission denial or camera cancellation cannot permanently trap retake.
      await db.removeCache('camera');
      rethrow;
    }
    journal['paths'] = [if (file != null) file.path];
    await db.cache('camera', journal);
    final result = (await _drain())!;
    if (previous?.owner == owner && previous?.warning != null) {
      return CameraResult(
        owner,
        result.artifacts,
        [previous!.warning, result.warning].whereType<String>().join('\n'),
      );
    }
    return result;
  });

  Future<CameraResult?> _drain() async {
    final journal = await db.cached('camera');
    if (journal == null) return null;
    final owner = journal['owner'] as String;
    journal.putIfAbsent('captureId', () => const Uuid().v4());
    // Pin stable IDs before consuming the global lost-data result.
    await db.cache('camera', journal);
    if (!journal.containsKey('paths')) {
      if (!source.supportsRecovery) {
        throw StateError(
          'Recuperação da câmera exige o tablet Android original.',
        );
      }
      try {
        journal['paths'] = (await source.retrieveLost())
            .map((f) => f.path)
            .toList();
      } catch (_) {
        await db.removeCache('camera');
        return CameraResult(
          owner,
          [],
          'A câmera não retornou um arquivo recuperável. Tente fotografar novamente.',
        );
      }
      await db.cache('camera', journal);
    }
    final artifacts = <PhotoArtifact>[];
    String? warning;
    final paths = List<String>.from(journal['paths'] as List);
    final missingIndices = List<int>.from(
      journal['missingIndices'] as List? ?? [],
    );
    for (var index = 0; index < paths.length; index++) {
      final id = const Uuid().v5(journal['captureId'] as String, '$index');
      if (missingIndices.contains(index)) {
        warning =
            'Uma captura anterior não está mais disponível no cache da câmera e não possui original recuperável. Fotografe novamente; o diagnóstico foi preservado.';
        continue;
      }
      try {
        final preserved = await photos.findPreserved(
          owner: owner,
          inspectionId: journal['inspectionId'] as String,
          itemId: journal['itemId'] as String,
          artifactId: id,
        );
        if (preserved != null) {
          artifacts.add(preserved);
          continue;
        }
        Uint8List bytes;
        try {
          bytes = await readSource(paths[index]);
        } on FileSystemException catch (error) {
          if (!fileIsDefinitivelyMissing(error)) rethrow;
          warning =
              'Uma captura anterior não está mais disponível no cache da câmera e não possui original recuperável. Fotografe novamente; o diagnóstico foi preservado.';
          missingIndices.add(index);
          journal['missingIndices'] = missingIndices;
          // Retain the original index so UUID v5 identities of later entries
          // never shift. Diagnostic and advancement commit together under A.
          await db.transaction(() async {
            final key = 'camera-diagnostics|$owner';
            final diagnostics =
                await db.cached(key) ?? {'entries': <dynamic>[]};
            final entries = diagnostics['entries'] as List;
            if (!entries.any((entry) => entry['id'] == id)) {
              entries.add({
                'id': id,
                'inspectionId': journal['inspectionId'],
                'itemId': journal['itemId'],
                'sourcePath': paths[index],
                'reason': 'SourceMissing',
                'observedAt': DateTime.now().toUtc().toIso8601String(),
              });
            }
            await db.cache(key, diagnostics);
            await db.cache('camera', journal);
          });
          continue;
        }
        try {
          artifacts.add(
            await photos.preserve(
              owner: owner,
              inspectionId: journal['inspectionId'] as String,
              itemId: journal['itemId'] as String,
              bytes: bytes,
              artifactId: id,
            ),
          );
        } on FormatException catch (error) {
          await photos.quarantine(
            owner: owner,
            id: id,
            bytes: bytes,
            context: {...journal, 'reason': error.toString()},
          );
          warning =
              'Arquivo preservado para suporte, mas não pode ser anexado (formato ou tamanho). Tire outra foto.';
        }
      } catch (_) {
        // The returned path remains journaled until preservation succeeds.
        // Do not expose another account's paths, IDs or inspection details.
        throw StateError(
          'Captura anterior aguarda preservação no tablet. Verifique espaço e permissões; não limpe os dados do aplicativo.',
        );
      }
    }
    await db.removeCache('camera');
    return CameraResult(owner, artifacts, warning);
  }
}
