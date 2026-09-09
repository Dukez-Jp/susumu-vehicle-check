import 'dart:convert';

typedef Json = Map<String, dynamic>;
Json copyJson(Json value) => jsonDecode(jsonEncode(value)) as Json;

const statuses = {
  'OK': 'OK',
  'Attention': 'Atenção',
  'Repair': 'Reparar',
  'Critical': 'Crítico',
  'NotApplicable': 'N/A',
};

Map<String, String> statusChoices(Json definition) {
  final configured = definition['allowedStatuses'];
  if (configured == null) return statuses;
  return Map.fromEntries(
    statuses.entries.where(
      (entry) => configured is List && configured.contains(entry.key),
    ),
  );
}

String? statusSelectionError(Json definition, Object? selected) {
  if (!statuses.containsKey(selected)) return 'Escolha um status.';
  if (!statusChoices(definition).containsKey(selected)) {
    return '${statuses[selected]} não é permitido nesta versão do checklist. Escolha uma das opções disponíveis.';
  }
  return null;
}

const _unchanged = Object();

String notesForServer(Json inspection) {
  final notes = inspection['notes'] as String? ?? '';
  final recovery = inspection['_recovery'] as Json?;
  if (recovery == null) return notes;
  final trace =
      'Cópia para revisão da inspeção ${recovery['sourceId']}. Motivo: ${recovery['reason']}';
  return notes.contains(trace) ? notes : '$notes\n\n$trace';
}

String? pendingInputReason(Json inspection) {
  final odometer = inspection['odometerKm'];
  if (odometer is! num ||
      !odometer.isFinite ||
      odometer < 0 ||
      odometer > 2147483647 ||
      odometer != odometer.truncateToDouble()) {
    return 'Complete a quilometragem inteira antes de enviar.';
  }
  if (notesForServer(inspection).length > 4000) {
    return 'Observação geral excede 4000 caracteres.';
  }
  if ((inspection['correctionReason'] as String? ?? '').length > 1000) {
    return 'Motivo excede 1000 caracteres.';
  }
  for (final item in inspection['items'] as List) {
    if ((item['notes'] as String? ?? '').length > 2000) {
      return 'Observação de item excede 2000 caracteres.';
    }
    final value = item['value'];
    if (value is num && !measurementPrecisionValid(value)) {
      return 'Medição aceita até 4 casas decimais e 14 algarismos inteiros.';
    }
  }
  return null;
}

bool measurementPrecisionValid(num value) =>
    value.isFinite &&
    value.abs() < 1e14 &&
    ((value * 10000) - (value * 10000).round()).abs() < 0.000001;

class InspectionDraft {
  InspectionDraft reviewCopy(
    String newId,
    String deviceId,
    String reason,
    DateTime now,
  ) {
    if (newId == id || reason.trim().isEmpty || reason.trim().length > 1000) {
      throw ArgumentError(
        'Informe motivo de até 1000 caracteres e uma nova identidade.',
      );
    }
    final result = InspectionDraft.create(
      id: newId,
      vehicle: vehicle,
      template: template,
      deviceId: deviceId,
      now: now,
    );
    result.inspection['items'] = (copyJson(inspection)['items'] as List).map((
      item,
    ) {
      item['photoIds'] = <String>[];
      return item;
    }).toList();
    result.inspection['odometerKm'] = inspection['odometerKm'];
    if (inspection['_input'] != null) {
      result.inspection['_input'] = copyJson(inspection['_input'] as Json);
    }
    result.inspection['notes'] =
        '${inspection['notes'] ?? ''}\n\nCópia para revisão da inspeção $id. Motivo: ${reason.trim()}';
    result.inspection['_recovery'] = {
      'sourceId': id,
      'reason': reason.trim(),
      'historyReviewed': false,
    };
    return result;
  }

  String? inputText(String key) =>
      (inspection['_input'] as Json?)?[key] as String?;
  void setOdometerText(String text) {
    (inspection.putIfAbsent('_input', () => <String, dynamic>{})
            as Json)['odometerKm'] =
        text;
    final number = num.tryParse(text.replaceAll(',', '.'));
    inspection['odometerKm'] = number?.isFinite == true ? number : null;
  }

  void setMeasurementText(String id, String text) {
    (inspection.putIfAbsent('_input', () => <String, dynamic>{})
            as Json)['measurement:$id'] =
        text;
    final number = num.tryParse(text.replaceAll(',', '.'));
    setAnswer(id, value: number?.isFinite == true ? number : null);
  }

  InspectionDraft correction(
    String newId,
    String deviceId,
    String reason,
    DateTime now,
  ) {
    if (!finalized) {
      throw StateError('Somente inspeções finalizadas geram correções.');
    }
    if (reason.trim().isEmpty || newId == id) {
      throw ArgumentError(
        'Informe motivo e uma nova identidade para a correção.',
      );
    }
    final result = InspectionDraft.create(
      id: newId,
      vehicle: vehicle,
      template: template,
      deviceId: deviceId,
      now: now,
    );
    result.inspection['items'] = (copyJson(inspection)['items'] as List).map((
      item,
    ) {
      item['photoIds'] = <String>[];
      return item;
    }).toList();
    result.inspection['notes'] = inspection['notes'];
    result.inspection['odometerKm'] = inspection['odometerKm'];
    result.inspection['supersedesInspectionId'] = id;
    result.inspection['correctionReason'] = reason.trim();
    return result;
  }

  InspectionDraft(this.inspection, this.template, this.vehicle);
  factory InspectionDraft.create({
    required String id,
    required Json vehicle,
    required Json template,
    required String deviceId,
    required DateTime now,
  }) => InspectionDraft(
    {
      'id': id,
      'vehicleId': vehicle['id'],
      'templateId': template['id'],
      'templateVersion': template['version'],
      'deviceId': deviceId,
      'odometerKm': vehicle['currentOdometerKm'] ?? 0,
      'state': 'Draft',
      'startedAt': now.toUtc().toIso8601String(),
      'finalizedAt': null,
      'items': <Json>[],
      'notes': '',
      'supersedesInspectionId': null,
      'correctionReason': null,
      'signaturePhotoId': null,
      'version': 0,
    },
    copyJson(template),
    copyJson(vehicle),
  );
  final Json inspection;
  final Json template;
  final Json vehicle;
  bool get finalized => inspection['state'] == 'Finalized';
  String get id => inspection['id'] as String;
  List<Json> get definitions => (template['sections'] as List)
      .expand((s) => (s['items'] as List).cast<Json>())
      .toList();
  Json? answer(String id) => (inspection['items'] as List)
      .cast<Json>()
      .where((a) => a['itemId'] == id)
      .firstOrNull;
  void setAnswer(
    String id, {
    String? status,
    Object? value = _unchanged,
    String? notes,
    List<String>? photoIds,
  }) {
    if (finalized) throw StateError('Inspeção finalizada é imutável.');
    if (!definitions.any((d) => d['id'] == id)) {
      throw ArgumentError('Item desconhecido.');
    }
    var item = answer(id);
    if (item == null) {
      item = {
        'itemId': id,
        'status': null,
        'value': null,
        'notes': '',
        'photoIds': <String>[],
      };
      (inspection['items'] as List).add(item);
    }
    if (status != null) {
      if (!statuses.containsKey(status)) {
        throw ArgumentError('Status inválido.');
      }
      item['status'] = status;
    }
    if (!identical(value, _unchanged)) {
      if (value != null && value is! num) {
        throw ArgumentError('Medição deve ser numérica.');
      }
      item['value'] = value;
    }
    if (notes != null) item['notes'] = notes;
    if (photoIds != null) item['photoIds'] = photoIds;
  }

  List<String> validationErrors() {
    final errors = <String>[];
    if (inspection['_recovery'] != null &&
        (inspection['_recovery'] as Json)['historyReviewed'] != true) {
      errors.add(
        'Confira o histórico do servidor e confirme a revisão antes de finalizar esta cópia.',
      );
    }
    if (template['requiresSignature'] == true &&
        (inspection['signaturePhotoId'] as String? ?? '').isEmpty) {
      errors.add('Assinatura obrigatória: assine antes de finalizar.');
    }
    final inputError = pendingInputReason(inspection);
    if (inputError != null) errors.add(inputError);
    final odometer = inspection['odometerKm'];
    if (odometer is! num ||
        !odometer.isFinite ||
        odometer != odometer.truncateToDouble() ||
        odometer < 0 ||
        odometer < (vehicle['currentOdometerKm'] as num? ?? 0)) {
      errors.add('Quilometragem deve ser válida e não pode diminuir.');
    }
    if (odometer is num &&
        odometer - (vehicle['currentOdometerKm'] as num? ?? 0) > 200000) {
      errors.add(
        'Avanço de quilometragem excede 200000 km; confira o catálogo e a leitura.',
      );
    }
    for (final definition in definitions) {
      final response = answer(definition['id'] as String);
      final label = definition['label'];
      if (response == null && definition['required'] != true) continue;
      final statusError = statusSelectionError(definition, response?['status']);
      if (statusError != null) {
        errors.add('$label: $statusError');
        continue;
      }
      if (definition['responseType'] == 'measurement' &&
          response!['status'] != 'NotApplicable') {
        final value = response['value'];
        if (value is! num || !value.isFinite) {
          errors.add('$label: informe uma medição.');
          continue;
        }
        if (definition['minValue'] != null && value < definition['minValue']) {
          errors.add('$label: abaixo do limite ${definition['minValue']}.');
        }
        if (definition['maxValue'] != null && value > definition['maxValue']) {
          errors.add('$label: acima do limite ${definition['maxValue']}.');
        }
      }
    }
    return errors;
  }

  void finalize(DateTime now) {
    if (finalized) throw StateError('Inspeção já finalizada.');
    final errors = validationErrors();
    if (errors.isNotEmpty) throw StateError(errors.join('\n'));
    inspection['state'] = 'Finalized';
    inspection['finalizedAt'] = now.toUtc().toIso8601String();
  }
}
