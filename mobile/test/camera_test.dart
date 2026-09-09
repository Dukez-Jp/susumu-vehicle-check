import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:susumu_vehicle_check/data/camera.dart';
import 'package:susumu_vehicle_check/data/database.dart';
import 'package:susumu_vehicle_check/data/photos.dart';
import 'package:uuid/uuid.dart';

class FakeCamera implements CameraSource {
  List<XFile> lost = [];
  XFile? next;
  int recovered = 0, opened = 0;
  Completer<XFile?>? pending;
  @override
  bool get supportsRecovery => true;
  @override
  Future<List<XFile>> retrieveLost() async {
    recovered++;
    return lost;
  }

  @override
  Future<XFile?> pick() async {
    opened++;
    return pending == null ? next : pending!.future;
  }
}

void main() {
  late Directory directory;
  late AppDatabase db;
  late PhotoStore store;
  late FakeCamera camera;
  setUp(() async {
    directory = await Directory.systemTemp.createTemp('susumu-camera-');
    db = AppDatabase(NativeDatabase.memory());
    store = PhotoStore(Directory('${directory.path}/private'));
    camera = FakeCamera();
  });
  tearDown(() async {
    await db.close();
    await directory.delete(recursive: true);
  });
  Future<XFile> picture(String name, List<int> bytes) async {
    final file = await File('${directory.path}/$name').writeAsBytes(bytes);
    return XFile(file.path);
  }

  test(
    'source permission error preserves the journal and is not diagnosed as missing',
    () async {
      final file = await picture('protected.jpg', [255, 216, 255, 1]);
      await db.cache('camera', {
        'owner': 'A',
        'inspectionId': 'inspection-a',
        'itemId': 'item-a',
        'paths': [file.path],
      });
      final service = CameraService(
        db,
        store,
        source: camera,
        readSource: (path) async => throw FileSystemException(
          'Permission denied',
          path,
          OSError('Access denied', Platform.isWindows ? 5 : 13),
        ),
      );
      await expectLater(service.recover(), throwsStateError);
      expect((await db.cached('camera'))!['paths'], [file.path]);
      expect(await db.cached('camera-diagnostics|A'), isNull);
      expect(await File(file.path).exists(), isTrue);
    },
  );

  test(
    'missing entry advances once without shifting the UUID of a later write retry',
    () async {
      const captureId = '11111111-1111-4111-8111-111111111111';
      final blocker = await File(
        '${directory.path}/blocked',
      ).writeAsString('target unavailable');
      store = PhotoStore(Directory(blocker.path));
      final valid = await picture('valid.jpg', [255, 216, 255, 2]);
      await db.cache('camera', {
        'owner': 'A',
        'inspectionId': 'inspection-a',
        'itemId': 'item-a',
        'captureId': captureId,
        'paths': ['${directory.path}/gone.jpg', valid.path],
      });
      final service = CameraService(db, store, source: camera);
      await expectLater(service.recover(), throwsStateError);
      expect((await db.cached('camera'))!['missingIndices'], [0]);
      await blocker.delete();
      final result = (await service.recover())!;
      expect(
        result.artifacts.single.metadata['id'],
        const Uuid().v5(captureId, '1'),
      );
      expect(
        ((await db.cached('camera-diagnostics|A'))!['entries'] as List).length,
        1,
      );
      expect(await db.cached('camera'), isNull);
    },
  );

  test(
    'missing A source is diagnosed privately and does not block B capture',
    () async {
      final deleted = await picture('evicted.jpg', [255, 216, 255, 1]);
      await File(deleted.path).delete();
      await db.cache('camera', {
        'owner': 'A',
        'inspectionId': 'inspection-a',
        'itemId': 'item-a',
        'paths': [deleted.path],
      });
      final service = CameraService(db, store, source: camera);
      final result = (await service.recover())!;
      expect(result.artifacts, isEmpty);
      expect(result.warning, contains('não está mais disponível'));
      expect(await db.cached('camera'), isNull);
      final diagnostic = (await db.cached('camera-diagnostics|A'))!;
      expect(
        (diagnostic['entries'] as List).single['sourcePath'],
        deleted.path,
      );
      expect(await db.cached('camera-diagnostics|B'), isNull);
      camera.next = await picture('b-new.jpg', [255, 216, 255, 2]);
      final next = await service.capture(
        owner: 'B',
        inspectionId: 'inspection-b',
        itemId: 'item-b',
      );
      expect(next.warning, isNull);
      expect(next.artifacts.single.metadata['inspectionId'], 'inspection-b');
      expect(await store.recoverable('A'), isEmpty);
    },
  );

  test(
    'already preserved deterministic original recovers even after temporary source is removed',
    () async {
      const captureId = '11111111-1111-4111-8111-111111111111';
      final stableId = const Uuid().v5(captureId, '0');
      final photo = await store.preserve(
        owner: 'A',
        inspectionId: 'inspection-a',
        itemId: 'item-a',
        bytes: Uint8List.fromList([255, 216, 255, 9]),
        artifactId: stableId,
      );
      await db.cache('camera', {
        'owner': 'A',
        'inspectionId': 'inspection-a',
        'itemId': 'item-a',
        'captureId': captureId,
        'paths': ['${directory.path}/gone.jpg'],
      });
      final result = (await CameraService(
        db,
        store,
        source: camera,
      ).recover())!;
      expect(result.artifacts.single.metadata, photo.metadata);
      expect(result.artifacts.single.filePath, photo.filePath);
      expect(result.warning, isNull);
      expect(await db.cached('camera-diagnostics|A'), isNull);
      expect(await db.cached('camera'), isNull);
    },
  );

  test(
    'failed private write retains returned path and retry does not consume lost data',
    () async {
      final blocker = await File(
        '${directory.path}/blocked',
      ).writeAsString('storage unavailable');
      store = PhotoStore(Directory(blocker.path));
      camera.next = await picture('retry.jpg', [255, 216, 255, 8]);
      final service = CameraService(db, store, source: camera);
      await expectLater(
        service.capture(
          owner: 'A',
          inspectionId: 'inspection-a',
          itemId: 'item-a',
        ),
        throwsStateError,
      );
      final journal = (await db.cached('camera'))!;
      expect(journal['paths'], [camera.next!.path]);
      await blocker.delete();
      final recovered = (await service.recover())!;
      expect(recovered.artifacts.length, 1);
      expect(
        recovered.artifacts.single.metadata['id'],
        matches(
          RegExp(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
          ),
        ),
      );
      expect(camera.recovered, 0);
      expect(await service.recover(), isNull);
      expect((await store.recoverable('A')).length, 1);
    },
  );

  test(
    'global lost A capture is preserved privately before B opens camera',
    () async {
      camera.lost = [
        await picture('a.jpg', [255, 216, 255, 1]),
      ];
      camera.next = await picture('b.jpg', [255, 216, 255, 2]);
      await db.cache('camera', {
        'owner': 'A',
        'inspectionId': 'inspection-a',
        'itemId': 'item-a',
      });
      final service = CameraService(db, store, source: camera);
      final result = await service.capture(
        owner: 'B',
        inspectionId: 'inspection-b',
        itemId: 'item-b',
      );
      expect(result.artifacts.single.metadata['inspectionId'], 'inspection-b');
      expect(
        (await store.recoverable('A')).single.metadata['inspectionId'],
        'inspection-a',
      );
      expect(
        (await store.recoverable('B')).single.metadata['inspectionId'],
        'inspection-b',
      );
      expect(await db.cached('camera'), isNull);
      expect(camera.recovered, 1);
    },
  );
  test(
    'unsupported return is quarantined once and own marker clears for retake',
    () async {
      camera.next = await picture('unsupported.heic', [1, 2, 3, 4]);
      final service = CameraService(db, store, source: camera);
      final result = await service.capture(
        owner: 'A',
        inspectionId: 'inspection-a',
        itemId: 'item-a',
      );
      expect(result.warning, isNotNull);
      expect(result.artifacts, isEmpty);
      expect(await db.cached('camera'), isNull);
      final retained = await directory
          .list(recursive: true)
          .where((e) => e.path.endsWith('.bin'))
          .toList();
      expect(
        await File(retained.single.path).readAsBytes(),
        Uint8List.fromList([1, 2, 3, 4]),
      );
      camera.next = await picture('retake.jpg', [255, 216, 255, 3]);
      expect(
        (await service.capture(
          owner: 'A',
          inspectionId: 'inspection-a',
          itemId: 'item-a',
        )).artifacts.length,
        1,
      );
    },
  );
  test(
    'shared lock prevents lost-data drain while another picker is open',
    () async {
      camera.pending = Completer<XFile?>();
      final first = CameraService(
        db,
        store,
        source: camera,
      ).capture(owner: 'A', inspectionId: 'inspection-a', itemId: 'item-a');
      while (camera.opened == 0) {
        await Future<void>.delayed(Duration.zero);
      }
      final recovery = CameraService(db, store, source: camera).recover();
      await Future<void>.delayed(Duration.zero);
      expect(camera.recovered, 0);
      camera.pending!.complete(await picture('a.jpg', [255, 216, 255, 1]));
      await first;
      await recovery;
      expect(camera.recovered, 0);
      expect((await store.recoverable('A')).length, 1);
    },
  );
}
