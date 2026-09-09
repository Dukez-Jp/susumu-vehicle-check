import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as path;
import 'package:uuid/uuid.dart';
import '../domain.dart';

// Only OS evidence of ENOENT / Windows file-or-path-not-found is absence.
// Permission errors and generic I/O failures must never discard a camera entry.
bool fileIsDefinitivelyMissing(FileSystemException error) =>
    error.osError?.errorCode == 2 ||
    Platform.isWindows && error.osError?.errorCode == 3;

class PhotoArtifact {
  PhotoArtifact(this.metadata, this.filePath);
  final Json metadata;
  final String filePath;
}

class PhotoStore {
  PhotoStore(this.root);
  final Directory root;
  Future<PhotoArtifact?> findPreserved({
    required String owner,
    required String inspectionId,
    required String itemId,
    required String artifactId,
  }) async {
    for (final id in [inspectionId, itemId, artifactId]) {
      if (!RegExp(r'^[a-zA-Z0-9_-]+$').hasMatch(id)) {
        throw const FormatException('Identificador inválido.');
      }
    }
    final directory = path.join(
      root.path,
      sha256.convert(utf8.encode(owner)).toString(),
      inspectionId,
      itemId,
    );
    for (final extension in ['jpg', 'png']) {
      final target = File(path.join(directory, '$artifactId.$extension'));
      try {
        final metadata =
            jsonDecode(await File('${target.path}.json').readAsString())
                as Json;
        if (metadata['id'] != artifactId ||
            metadata['inspectionId'] != inspectionId ||
            metadata['itemId'] != itemId ||
            metadata['kind'] != 'Original') {
          throw StateError(
            'Manifesto de captura divergente; arquivo preservado para revisão.',
          );
        }
        if (await target.length() == metadata['sizeBytes'] &&
            (await sha256.bind(target.openRead()).first).toString() ==
                metadata['sha256']) {
          return PhotoArtifact(metadata, target.path);
        }
      } on FileSystemException catch (error) {
        if (!fileIsDefinitivelyMissing(error)) rethrow;
      }
    }
    return null;
  }

  Future<void> _cameraTail = Future.value();
  Future<T> serializeCamera<T>(Future<T> Function() operation) {
    final result = _cameraTail.then((_) => operation());
    _cameraTail = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace _) {},
    );
    return result;
  }

  Future<PhotoArtifact> preserve({
    required String owner,
    required String inspectionId,
    required String? itemId,
    required Uint8List bytes,
    String kind = 'Original',
    String? originalPhotoId,
    String? artifactId,
  }) async {
    if (bytes.length > 15 * 1024 * 1024) {
      throw const FormatException(
        'Foto excede 15 MiB. O original não será reduzido automaticamente.',
      );
    }
    final jpeg =
        bytes.length >= 3 &&
        bytes[0] == 255 &&
        bytes[1] == 216 &&
        bytes[2] == 255;
    final png =
        bytes.length >= 8 &&
        bytes.take(8).join(',') == '137,80,78,71,13,10,26,10';
    if (!jpeg && !png) {
      throw const FormatException('Somente fotos JPEG ou PNG são aceitas.');
    }
    if (!['Original', 'Annotation', 'Signature'].contains(kind) ||
        kind == 'Annotation' && originalPhotoId == null) {
      throw const FormatException('Vínculo da foto inválido.');
    }
    if ((kind == 'Signature' && (itemId != null || originalPhotoId != null)) ||
        (kind != 'Signature' && itemId == null)) {
      throw const FormatException('Vínculo de assinatura inválido.');
    }
    for (final id in [inspectionId, ?itemId, ?artifactId]) {
      if (!RegExp(r'^[a-zA-Z0-9_-]+$').hasMatch(id)) {
        throw const FormatException('Identificador inválido.');
      }
    }
    final id = artifactId ?? const Uuid().v4();
    final directory = Directory(
      path.join(
        root.path,
        sha256.convert(utf8.encode(owner)).toString(),
        inspectionId,
        itemId ?? 'signature',
      ),
    );
    await directory.create(recursive: true);
    final target = File(
      path.join(directory.path, '$id.${png ? 'png' : 'jpg'}'),
    );
    final metadata = <String, dynamic>{
      'id': id,
      'inspectionId': inspectionId,
      'itemId': itemId,
      'kind': kind,
      'originalPhotoId': originalPhotoId,
      'contentType': png ? 'image/png' : 'image/jpeg',
      'sha256': sha256.convert(bytes).toString(),
      'sizeBytes': bytes.length,
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      'uploaded': false,
    };
    final sidecar = File('${target.path}.json');
    if (await sidecar.exists()) {
      final previous = jsonDecode(await sidecar.readAsString()) as Json;
      for (final key in [
        'id',
        'inspectionId',
        'itemId',
        'kind',
        'originalPhotoId',
        'sha256',
        'sizeBytes',
      ]) {
        if (previous[key] != metadata[key]) {
          throw StateError(
            'Identidade da foto já existe com conteúdo diferente.',
          );
        }
      }
      // Retry after process death keeps the exact original ID and metadata.
      if (await target.exists()) {
        if ((await sha256.bind(target.openRead()).first).toString() !=
            previous['sha256']) {
          throw StateError(
            'Original divergiu. Arquivo preservado para revisão; não será sobrescrito.',
          );
        }
        return PhotoArtifact(previous, target.path);
      }
      await _commitFile(target, bytes);
      return PhotoArtifact(previous, target.path);
    }
    // An immutable sidecar permits recovery if the app stops between file flush and DB commit.
    await File(
      '${target.path}.json',
    ).writeAsString(jsonEncode(metadata), flush: true);
    await _commitFile(target, bytes);
    return PhotoArtifact(metadata, target.path);
  }

  Future<void> _commitFile(File target, Uint8List bytes) async {
    // A failed write can leave only a staging file; an immutable original becomes
    // visible after its full bytes have been flushed in the same directory.
    final staging = File('${target.path}.partial');
    await staging.writeAsBytes(bytes, flush: true);
    if (await target.exists()) {
      throw StateError('Foto já existe e não será sobrescrita.');
    }
    await staging.rename(target.path);
  }

  Future<void> quarantine({
    required String owner,
    required String id,
    required Uint8List bytes,
    required Json context,
  }) async {
    if (!RegExp(r'^[a-zA-Z0-9_-]+$').hasMatch(id)) {
      throw const FormatException('Identificador inválido.');
    }
    final directory = Directory(
      path.join(
        root.path,
        'quarantine',
        sha256.convert(utf8.encode(owner)).toString(),
      ),
    );
    await directory.create(recursive: true);
    final file = File(path.join(directory.path, '$id.bin'));
    final digest = sha256.convert(bytes).toString();
    if (await file.exists() &&
        (await sha256.bind(file.openRead()).first).toString() != digest) {
      throw StateError('Arquivo em quarentena divergiu.');
    }
    await file.writeAsBytes(bytes, flush: true);
    await File('${file.path}.json').writeAsString(
      jsonEncode({...context, 'sha256': digest, 'sizeBytes': bytes.length}),
      flush: true,
    );
  }

  Future<List<PhotoArtifact>> recoverable(
    String owner, {
    Set<String> knownIds = const {},
  }) async {
    final directory = Directory(
      path.join(root.path, sha256.convert(utf8.encode(owner)).toString()),
    );
    if (!await directory.exists()) return [];
    final artifacts = <PhotoArtifact>[];
    await for (final entry in directory.list(
      recursive: true,
      followLinks: false,
    )) {
      if (entry is File && entry.path.endsWith('.json')) {
        final target = File(entry.path.substring(0, entry.path.length - 5));
        if (!await target.exists()) continue;
        final metadata = jsonDecode(await entry.readAsString()) as Json;
        if (knownIds.contains(metadata['id'])) continue;
        final digest = await sha256.bind(target.openRead()).first;
        if (digest.toString() == metadata['sha256']) {
          artifacts.add(PhotoArtifact(metadata, target.path));
        }
      }
    }
    artifacts.sort(
      (a, b) => (a.metadata['kind'] == 'Original' ? 0 : 1).compareTo(
        b.metadata['kind'] == 'Original' ? 0 : 1,
      ),
    );
    return artifacts;
  }
}
