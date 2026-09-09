import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:susumu_vehicle_check/screens/signature.dart';

void main() {
  testWidgets(
    'signature pad rejects blank and exports a separate PNG after a stroke',
    (tester) async {
      Uint8List? saved;
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: FilledButton(
                onPressed: () async {
                  saved = await Navigator.push<Uint8List>(
                    context,
                    MaterialPageRoute(builder: (_) => const SignatureScreen()),
                  );
                },
                child: const Text('Assinar'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Assinar'));
      await tester.pumpAndSettle();
      final save = find.widgetWithText(FilledButton, 'Salvar assinatura');
      expect(tester.widget<FilledButton>(save).onPressed, isNull);
      await tester.drag(
        find.byKey(const Key('signature-pad')),
        const Offset(150, 60),
      );
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(save).onPressed, isNotNull);
      await tester.tap(save);
      await tester.pumpAndSettle();
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 100)),
      );
      await tester.pumpAndSettle();
      expect(saved!.take(8), [137, 80, 78, 71, 13, 10, 26, 10]);
    },
  );
}
