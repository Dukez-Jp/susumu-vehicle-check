import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:susumu_vehicle_check/data/photos.dart';

void main() {
  late Directory directory;
  late PhotoStore store;
  setUp(() async {
    directory = await Directory.systemTemp.createTemp('susumu-photos-');
    store = PhotoStore(directory);
  });
  tearDown(() async {
    await directory.delete(recursive: true);
  });
  test(
    'stable retry reuses original metadata but never overwrites a divergent original',
    () async {
      final bytes = Uint8List.fromList([255, 216, 255, 1]);
      Future<PhotoArtifact> preserve() => store.preserve(
        owner: 'A',
        inspectionId: 'inspection',
        itemId: 'item',
        bytes: bytes,
        artifactId: 'stable-id',
      );
      final first = await preserve();
      expect((await preserve()).metadata, first.metadata);
      final changed = Uint8List.fromList([255, 216, 255, 2]);
      await File(first.filePath).writeAsBytes(changed);
      await expectLater(preserve(), throwsStateError);
      expect(await File(first.filePath).readAsBytes(), changed);
    },
  );
  test(
    'original remains byte-identical when separate annotation is stored',
    () async {
      final original = Uint8List.fromList([255, 216, 255, 224, 1, 2, 3]);
      final photo = await store.preserve(
        owner: 'owner',
        inspectionId: 'inspection',
        itemId: 'item',
        bytes: original,
      );
      final annotation = await store.preserve(
        owner: 'owner',
        inspectionId: 'inspection',
        itemId: 'item',
        bytes: Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10, 9]),
        kind: 'Annotation',
        originalPhotoId: photo.metadata['id'] as String,
      );
      expect(await File(photo.filePath).readAsBytes(), original);
      expect(annotation.filePath, isNot(photo.filePath));
      expect(annotation.metadata['originalPhotoId'], photo.metadata['id']);
      expect(await File('${photo.filePath}.json').exists(), isTrue);
    },
  );
  test('rejects unapproved bytes and oversize images before writing', () async {
    await expectLater(
      store.preserve(
        owner: 'owner',
        inspectionId: 'inspection',
        itemId: 'item',
        bytes: Uint8List.fromList([1, 2, 3]),
      ),
      throwsFormatException,
    );
    await expectLater(
      store.preserve(
        owner: 'owner',
        inspectionId: 'inspection',
        itemId: 'item',
        bytes: Uint8List(15 * 1024 * 1024 + 1),
      ),
      throwsFormatException,
    );
    expect(await directory.list(recursive: true).toList(), isEmpty);
  });
}
