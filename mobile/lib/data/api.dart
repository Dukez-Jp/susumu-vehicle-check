import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../domain.dart';

String normalizeServer(String input, {bool allowDevHttp = false}) {
  final uri = Uri.tryParse(input.trim());
  if (uri == null ||
      uri.host.isEmpty ||
      (uri.scheme != 'https' && !(allowDevHttp && uri.scheme == 'http')) ||
      uri.userInfo.isNotEmpty ||
      uri.hasQuery ||
      uri.hasFragment ||
      (uri.path.isNotEmpty && uri.path != '/')) {
    throw const FormatException(
      'Informe a origem HTTPS do servidor, sem caminho, usuário ou senha.',
    );
  }
  return '${uri.scheme}://${uri.authority}';
}

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient(
    this.server,
    this.token, {
    http.Client? client,
    this.uploadTimeout = const Duration(seconds: 90),
  }) : client = client ?? http.Client();
  final String server;
  final String token;
  final http.Client client;
  final Duration uploadTimeout;
  Uri uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$server/api/v1$path').replace(queryParameters: query);
  Map<String, String> get headers => {
    'accept': 'application/json',
    'content-type': 'application/json',
    if (token.isNotEmpty) 'authorization': 'Bearer $token',
  };
  dynamic decode(http.Response response) {
    dynamic body;
    try {
      body = jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      body = null;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        response.statusCode,
        body is Map
            ? (body['detail'] ?? body['title'] ?? 'Erro ${response.statusCode}')
                  .toString()
            : 'Servidor indisponível (${response.statusCode}).',
      );
    }
    if (body == null) {
      throw ApiException(response.statusCode, 'Resposta inválida do servidor.');
    }
    return body;
  }

  Future<Json> login(String username, String password, String deviceId) async =>
      decode(
            await client
                .post(
                  uri('/auth/login'),
                  headers: headers,
                  body: jsonEncode({
                    'username': username,
                    'password': password,
                    'deviceId': deviceId,
                  }),
                )
                .timeout(const Duration(seconds: 25)),
          )
          as Json;
  Future<Json> sync(String payload) async =>
      decode(
            await client
                .post(uri('/sync/inspections'), headers: headers, body: payload)
                .timeout(const Duration(seconds: 30)),
          )
          as Json;
  Future<Json> bootstrap() async =>
      decode(
            await client
                .get(uri('/bootstrap'), headers: headers)
                .timeout(const Duration(seconds: 25)),
          )
          as Json;
  Future<Json> me() async =>
      decode(
            await client
                .get(uri('/auth/me'), headers: headers)
                .timeout(const Duration(seconds: 20)),
          )
          as Json;
  Future<List<Json>> history(
    String vehicleId, {
    int offset = 0,
    int limit = 100,
  }) async =>
      (decode(
                await client
                    .get(
                      uri('/inspections', {
                        'vehicleId': vehicleId,
                        'offset': '$offset',
                        'limit': '$limit',
                      }),
                      headers: headers,
                    )
                    .timeout(const Duration(seconds: 25)),
              )
              as List)
          .cast<Json>();
  Future<Json> inspection(String id) async =>
      decode(
            await client
                .get(uri('/inspections/$id'), headers: headers)
                .timeout(const Duration(seconds: 25)),
          )
          as Json;
  Future<Json> template(String id) async =>
      decode(
            await client
                .get(uri('/templates/$id'), headers: headers)
                .timeout(const Duration(seconds: 25)),
          )
          as Json;
  Future<Uint8List> photoBytes(String inspectionId, String photoId) async {
    final response = await client
        .get(
          uri('/inspections/$inspectionId/photos/$photoId'),
          headers: headers,
        )
        .timeout(const Duration(seconds: 30));
    if (response.statusCode != 200) {
      decode(response);
      throw ApiException(
        response.statusCode,
        'Não foi possível carregar a foto.',
      );
    }
    return response.bodyBytes;
  }

  Future<Json> upload(Json metadata, File file) async {
    final request = http.MultipartRequest(
      'POST',
      uri('/inspections/${metadata['inspectionId']}/photos/${metadata['id']}'),
    );
    request.headers['authorization'] = 'Bearer $token';
    request.fields['metadata'] = jsonEncode(metadata);
    request.files.add(
      await http.MultipartFile.fromPath(
        'file',
        file.path,
        filename: '${metadata['id']}',
        contentType: MediaType.parse(metadata['contentType'] as String),
      ),
    );
    return decode(
          await client
              .send(request)
              .then(http.Response.fromStream)
              .timeout(uploadTimeout),
        )
        as Json;
  }

  void close() => client.close();
}
