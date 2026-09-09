import 'package:flutter_test/flutter_test.dart';
import 'fixtures.dart';

void main() {
  test(
    'template signature policy blocks finalization until signature is declared',
    () {
      final value = draft()..setAnswer('item-1', status: 'OK', value: 5);
      value.template['requiresSignature'] = true;
      expect(
        value.validationErrors().any((error) => error.contains('Assinatura')),
        isTrue,
      );
      value.inspection['signaturePhotoId'] = 'signature-1';
      expect(value.validationErrors(), isEmpty);
      value.finalize(DateTime.now());
      final correction = value.correction(
        'new-id',
        'device',
        'Nova vistoria',
        DateTime.now(),
      );
      expect(correction.inspection['signaturePhotoId'], isNull);
      expect(
        correction.validationErrors().any(
          (error) => error.contains('Assinatura'),
        ),
        isTrue,
      );
    },
  );
  test(
    'correction creates a new identity with reason and leaves final original untouched',
    () {
      final original = draft()
        ..setAnswer('item-1', status: 'OK', value: 5, photoIds: ['photo-1']);
      original.finalize(DateTime.utc(2026, 9, 9, 1));
      final correction = original.correction(
        'new-id',
        'device-2',
        'Medição revisada',
        DateTime.utc(2026, 9, 9, 2),
      );
      expect(correction.id, 'new-id');
      expect(correction.inspection['supersedesInspectionId'], 'inspection-1');
      expect(correction.inspection['correctionReason'], 'Medição revisada');
      expect(correction.answer('item-1')!['photoIds'], isEmpty);
      expect(original.answer('item-1')!['photoIds'], ['photo-1']);
      expect(original.finalized, isTrue);
      expect(correction.finalized, isFalse);
      expect(
        () => original.correction('new', 'device', '  ', DateTime.now()),
        throwsA(isA<ArgumentError>()),
      );
    },
  );
  test('new inspection pins version and does not invent item responses', () {
    final value = draft();
    expect(value.inspection['templateVersion'], 3);
    expect(value.inspection['items'], isEmpty);
    expect(value.finalized, isFalse);
  });
  test('optional N/A permits omitted measurement and preserves decision', () {
    final value = draft()..setAnswer('item-1', status: 'NotApplicable');
    value.definitions.single['required'] = false;
    expect(value.validationErrors(), isEmpty);
    expect(value.answer('item-1')!['status'], 'NotApplicable');
  });
  test('odometer regression and NaN cannot finalize', () {
    final value = draft()..setAnswer('item-1', status: 'OK', value: 5);
    value.inspection['odometerKm'] = 1199;
    expect(value.validationErrors(), isNotEmpty);
    value.inspection['odometerKm'] = double.nan;
    expect(value.validationErrors(), isNotEmpty);
    value.inspection['odometerKm'] = 1201.5;
    expect(value.validationErrors(), isNotEmpty);
  });
  test(
    'notes status and attachments preserve measurement unless explicitly cleared',
    () {
      final value = draft()..setAnswer('item-1', status: 'OK', value: 5);
      value.setAnswer('item-1', notes: 'Conferido');
      value.setAnswer('item-1', status: 'Attention');
      value.setAnswer('item-1', photoIds: ['photo-1']);
      expect(value.answer('item-1')!['value'], 5);
      value.setAnswer('item-1', value: null);
      expect(value.answer('item-1')!['value'], isNull);
    },
  );
}
