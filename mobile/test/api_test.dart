import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:susumu_vehicle_check/data/api.dart';

class HeaderOnlyClient extends http.BaseClient {
  final body = StreamController<List<int>>();
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    await request.finalize().drain<void>();
    return http.StreamedResponse(body.stream, 200);
  }

  @override
  void close() {
    unawaited(body.close());
  }
}

void main() {
  test(
    'multipart timeout bounds response body after server sends headers then stalls',
    () async {
      final directory = await Directory.systemTemp.createTemp(
            'susumu-timeout-',
          ),
          client = HeaderOnlyClient();
      final file = await File(
        '${directory.path}/photo.png',
      ).writeAsBytes([137, 80, 78, 71]);
      final api = ApiClient(
        'https://test.example',
        'token',
        client: client,
        uploadTimeout: const Duration(milliseconds: 10),
      );
      try {
        await expectLater(
          api
              .upload({
                'inspectionId': 'one',
                'id': 'photo',
                'contentType': 'image/png',
              }, file)
              .timeout(
                const Duration(milliseconds: 250),
                onTimeout: () =>
                    throw StateError('Upload response body is unbounded'),
              ),
          throwsA(isA<TimeoutException>()),
        );
      } finally {
        api.close();
        await directory.delete(recursive: true);
      }
    },
  );
  test('rejects insecure URLs credentials and non-origin server paths', () {
    expect(() => normalizeServer('http://example.com'), throwsFormatException);
    expect(
      () => normalizeServer('https://user:pass@example.com'),
      throwsFormatException,
    );
    expect(
      () => normalizeServer('https://example.com/api'),
      throwsFormatException,
    );
    expect(normalizeServer('https://example.com/'), 'https://example.com');
  });
  test('sync sends frozen JSON unchanged and reports server conflict', () async {
    const body =
        '{"operationId":"op-1","expectedVersion":0,"inspection":{"id":"one"}}';
    final api = ApiClient(
      'https://example.com',
      'token',
      client: MockClient((request) async {
        expect(request.url.path, '/api/v1/sync/inspections');
        expect(request.headers['authorization'], 'Bearer token');
        expect(request.body, body);
        return http.Response(
          jsonEncode({'title': 'Conflito', 'detail': 'Versão divergente'}),
          409,
        );
      }),
    );
    await expectLater(
      api.sync(body),
      throwsA(isA<ApiException>().having((e) => e.status, 'status', 409)),
    );
  });
  test(
    'HTML gateway failures have a useful error rather than JSON crash',
    () async {
      final api = ApiClient(
        'https://example.com',
        'token',
        client: MockClient(
          (_) async => http.Response('<html>gateway</html>', 502),
        ),
      );
      await expectLater(
        api.bootstrap(),
        throwsA(isA<ApiException>().having((e) => e.status, 'status', 502)),
      );
    },
  );
}
