// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'database.dart';

// ignore_for_file: type=lint
class $LocalInspectionsTable extends LocalInspections
    with TableInfo<$LocalInspectionsTable, LocalInspection> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalInspectionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ownerMeta = const VerificationMeta('owner');
  @override
  late final GeneratedColumn<String> owner = GeneratedColumn<String>(
    'owner',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _templateJsonMeta = const VerificationMeta(
    'templateJson',
  );
  @override
  late final GeneratedColumn<String> templateJson = GeneratedColumn<String>(
    'template_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _vehicleJsonMeta = const VerificationMeta(
    'vehicleJson',
  );
  @override
  late final GeneratedColumn<String> vehicleJson = GeneratedColumn<String>(
    'vehicle_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _serverVersionMeta = const VerificationMeta(
    'serverVersion',
  );
  @override
  late final GeneratedColumn<int> serverVersion = GeneratedColumn<int>(
    'server_version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    owner,
    payload,
    templateJson,
    vehicleJson,
    serverVersion,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_inspections';
  @override
  VerificationContext validateIntegrity(
    Insertable<LocalInspection> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner')) {
      context.handle(
        _ownerMeta,
        owner.isAcceptableOrUnknown(data['owner']!, _ownerMeta),
      );
    } else if (isInserting) {
      context.missing(_ownerMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('template_json')) {
      context.handle(
        _templateJsonMeta,
        templateJson.isAcceptableOrUnknown(
          data['template_json']!,
          _templateJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_templateJsonMeta);
    }
    if (data.containsKey('vehicle_json')) {
      context.handle(
        _vehicleJsonMeta,
        vehicleJson.isAcceptableOrUnknown(
          data['vehicle_json']!,
          _vehicleJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_vehicleJsonMeta);
    }
    if (data.containsKey('server_version')) {
      context.handle(
        _serverVersionMeta,
        serverVersion.isAcceptableOrUnknown(
          data['server_version']!,
          _serverVersionMeta,
        ),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  LocalInspection map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalInspection(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      owner: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}owner'],
      )!,
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
      templateJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}template_json'],
      )!,
      vehicleJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}vehicle_json'],
      )!,
      serverVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}server_version'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $LocalInspectionsTable createAlias(String alias) {
    return $LocalInspectionsTable(attachedDatabase, alias);
  }
}

class LocalInspection extends DataClass implements Insertable<LocalInspection> {
  final String id;
  final String owner;
  final String payload;
  final String templateJson;
  final String vehicleJson;
  final int serverVersion;
  final DateTime updatedAt;
  const LocalInspection({
    required this.id,
    required this.owner,
    required this.payload,
    required this.templateJson,
    required this.vehicleJson,
    required this.serverVersion,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner'] = Variable<String>(owner);
    map['payload'] = Variable<String>(payload);
    map['template_json'] = Variable<String>(templateJson);
    map['vehicle_json'] = Variable<String>(vehicleJson);
    map['server_version'] = Variable<int>(serverVersion);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  LocalInspectionsCompanion toCompanion(bool nullToAbsent) {
    return LocalInspectionsCompanion(
      id: Value(id),
      owner: Value(owner),
      payload: Value(payload),
      templateJson: Value(templateJson),
      vehicleJson: Value(vehicleJson),
      serverVersion: Value(serverVersion),
      updatedAt: Value(updatedAt),
    );
  }

  factory LocalInspection.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalInspection(
      id: serializer.fromJson<String>(json['id']),
      owner: serializer.fromJson<String>(json['owner']),
      payload: serializer.fromJson<String>(json['payload']),
      templateJson: serializer.fromJson<String>(json['templateJson']),
      vehicleJson: serializer.fromJson<String>(json['vehicleJson']),
      serverVersion: serializer.fromJson<int>(json['serverVersion']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'owner': serializer.toJson<String>(owner),
      'payload': serializer.toJson<String>(payload),
      'templateJson': serializer.toJson<String>(templateJson),
      'vehicleJson': serializer.toJson<String>(vehicleJson),
      'serverVersion': serializer.toJson<int>(serverVersion),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  LocalInspection copyWith({
    String? id,
    String? owner,
    String? payload,
    String? templateJson,
    String? vehicleJson,
    int? serverVersion,
    DateTime? updatedAt,
  }) => LocalInspection(
    id: id ?? this.id,
    owner: owner ?? this.owner,
    payload: payload ?? this.payload,
    templateJson: templateJson ?? this.templateJson,
    vehicleJson: vehicleJson ?? this.vehicleJson,
    serverVersion: serverVersion ?? this.serverVersion,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  LocalInspection copyWithCompanion(LocalInspectionsCompanion data) {
    return LocalInspection(
      id: data.id.present ? data.id.value : this.id,
      owner: data.owner.present ? data.owner.value : this.owner,
      payload: data.payload.present ? data.payload.value : this.payload,
      templateJson: data.templateJson.present
          ? data.templateJson.value
          : this.templateJson,
      vehicleJson: data.vehicleJson.present
          ? data.vehicleJson.value
          : this.vehicleJson,
      serverVersion: data.serverVersion.present
          ? data.serverVersion.value
          : this.serverVersion,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalInspection(')
          ..write('id: $id, ')
          ..write('owner: $owner, ')
          ..write('payload: $payload, ')
          ..write('templateJson: $templateJson, ')
          ..write('vehicleJson: $vehicleJson, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    owner,
    payload,
    templateJson,
    vehicleJson,
    serverVersion,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalInspection &&
          other.id == this.id &&
          other.owner == this.owner &&
          other.payload == this.payload &&
          other.templateJson == this.templateJson &&
          other.vehicleJson == this.vehicleJson &&
          other.serverVersion == this.serverVersion &&
          other.updatedAt == this.updatedAt);
}

class LocalInspectionsCompanion extends UpdateCompanion<LocalInspection> {
  final Value<String> id;
  final Value<String> owner;
  final Value<String> payload;
  final Value<String> templateJson;
  final Value<String> vehicleJson;
  final Value<int> serverVersion;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const LocalInspectionsCompanion({
    this.id = const Value.absent(),
    this.owner = const Value.absent(),
    this.payload = const Value.absent(),
    this.templateJson = const Value.absent(),
    this.vehicleJson = const Value.absent(),
    this.serverVersion = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalInspectionsCompanion.insert({
    required String id,
    required String owner,
    required String payload,
    required String templateJson,
    required String vehicleJson,
    this.serverVersion = const Value.absent(),
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       owner = Value(owner),
       payload = Value(payload),
       templateJson = Value(templateJson),
       vehicleJson = Value(vehicleJson),
       updatedAt = Value(updatedAt);
  static Insertable<LocalInspection> custom({
    Expression<String>? id,
    Expression<String>? owner,
    Expression<String>? payload,
    Expression<String>? templateJson,
    Expression<String>? vehicleJson,
    Expression<int>? serverVersion,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (owner != null) 'owner': owner,
      if (payload != null) 'payload': payload,
      if (templateJson != null) 'template_json': templateJson,
      if (vehicleJson != null) 'vehicle_json': vehicleJson,
      if (serverVersion != null) 'server_version': serverVersion,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalInspectionsCompanion copyWith({
    Value<String>? id,
    Value<String>? owner,
    Value<String>? payload,
    Value<String>? templateJson,
    Value<String>? vehicleJson,
    Value<int>? serverVersion,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return LocalInspectionsCompanion(
      id: id ?? this.id,
      owner: owner ?? this.owner,
      payload: payload ?? this.payload,
      templateJson: templateJson ?? this.templateJson,
      vehicleJson: vehicleJson ?? this.vehicleJson,
      serverVersion: serverVersion ?? this.serverVersion,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (owner.present) {
      map['owner'] = Variable<String>(owner.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (templateJson.present) {
      map['template_json'] = Variable<String>(templateJson.value);
    }
    if (vehicleJson.present) {
      map['vehicle_json'] = Variable<String>(vehicleJson.value);
    }
    if (serverVersion.present) {
      map['server_version'] = Variable<int>(serverVersion.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalInspectionsCompanion(')
          ..write('id: $id, ')
          ..write('owner: $owner, ')
          ..write('payload: $payload, ')
          ..write('templateJson: $templateJson, ')
          ..write('vehicleJson: $vehicleJson, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PendingOperationsTable extends PendingOperations
    with TableInfo<$PendingOperationsTable, PendingOperation> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PendingOperationsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _sequenceMeta = const VerificationMeta(
    'sequence',
  );
  @override
  late final GeneratedColumn<int> sequence = GeneratedColumn<int>(
    'sequence',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _ownerMeta = const VerificationMeta('owner');
  @override
  late final GeneratedColumn<String> owner = GeneratedColumn<String>(
    'owner',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _inspectionIdMeta = const VerificationMeta(
    'inspectionId',
  );
  @override
  late final GeneratedColumn<String> inspectionId = GeneratedColumn<String>(
    'inspection_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attemptsMeta = const VerificationMeta(
    'attempts',
  );
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
    'attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _blockedMeta = const VerificationMeta(
    'blocked',
  );
  @override
  late final GeneratedColumn<bool> blocked = GeneratedColumn<bool>(
    'blocked',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("blocked" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _errorMeta = const VerificationMeta('error');
  @override
  late final GeneratedColumn<String> error = GeneratedColumn<String>(
    'error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    sequence,
    id,
    owner,
    inspectionId,
    payload,
    attempts,
    blocked,
    error,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'pending_operations';
  @override
  VerificationContext validateIntegrity(
    Insertable<PendingOperation> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('sequence')) {
      context.handle(
        _sequenceMeta,
        sequence.isAcceptableOrUnknown(data['sequence']!, _sequenceMeta),
      );
    }
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner')) {
      context.handle(
        _ownerMeta,
        owner.isAcceptableOrUnknown(data['owner']!, _ownerMeta),
      );
    } else if (isInserting) {
      context.missing(_ownerMeta);
    }
    if (data.containsKey('inspection_id')) {
      context.handle(
        _inspectionIdMeta,
        inspectionId.isAcceptableOrUnknown(
          data['inspection_id']!,
          _inspectionIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_inspectionIdMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('attempts')) {
      context.handle(
        _attemptsMeta,
        attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta),
      );
    }
    if (data.containsKey('blocked')) {
      context.handle(
        _blockedMeta,
        blocked.isAcceptableOrUnknown(data['blocked']!, _blockedMeta),
      );
    }
    if (data.containsKey('error')) {
      context.handle(
        _errorMeta,
        error.isAcceptableOrUnknown(data['error']!, _errorMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {sequence};
  @override
  PendingOperation map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PendingOperation(
      sequence: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sequence'],
      )!,
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      owner: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}owner'],
      )!,
      inspectionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}inspection_id'],
      )!,
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
      attempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempts'],
      )!,
      blocked: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}blocked'],
      )!,
      error: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}error'],
      ),
    );
  }

  @override
  $PendingOperationsTable createAlias(String alias) {
    return $PendingOperationsTable(attachedDatabase, alias);
  }
}

class PendingOperation extends DataClass
    implements Insertable<PendingOperation> {
  final int sequence;
  final String id;
  final String owner;
  final String inspectionId;
  final String payload;
  final int attempts;
  final bool blocked;
  final String? error;
  const PendingOperation({
    required this.sequence,
    required this.id,
    required this.owner,
    required this.inspectionId,
    required this.payload,
    required this.attempts,
    required this.blocked,
    this.error,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['sequence'] = Variable<int>(sequence);
    map['id'] = Variable<String>(id);
    map['owner'] = Variable<String>(owner);
    map['inspection_id'] = Variable<String>(inspectionId);
    map['payload'] = Variable<String>(payload);
    map['attempts'] = Variable<int>(attempts);
    map['blocked'] = Variable<bool>(blocked);
    if (!nullToAbsent || error != null) {
      map['error'] = Variable<String>(error);
    }
    return map;
  }

  PendingOperationsCompanion toCompanion(bool nullToAbsent) {
    return PendingOperationsCompanion(
      sequence: Value(sequence),
      id: Value(id),
      owner: Value(owner),
      inspectionId: Value(inspectionId),
      payload: Value(payload),
      attempts: Value(attempts),
      blocked: Value(blocked),
      error: error == null && nullToAbsent
          ? const Value.absent()
          : Value(error),
    );
  }

  factory PendingOperation.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PendingOperation(
      sequence: serializer.fromJson<int>(json['sequence']),
      id: serializer.fromJson<String>(json['id']),
      owner: serializer.fromJson<String>(json['owner']),
      inspectionId: serializer.fromJson<String>(json['inspectionId']),
      payload: serializer.fromJson<String>(json['payload']),
      attempts: serializer.fromJson<int>(json['attempts']),
      blocked: serializer.fromJson<bool>(json['blocked']),
      error: serializer.fromJson<String?>(json['error']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'sequence': serializer.toJson<int>(sequence),
      'id': serializer.toJson<String>(id),
      'owner': serializer.toJson<String>(owner),
      'inspectionId': serializer.toJson<String>(inspectionId),
      'payload': serializer.toJson<String>(payload),
      'attempts': serializer.toJson<int>(attempts),
      'blocked': serializer.toJson<bool>(blocked),
      'error': serializer.toJson<String?>(error),
    };
  }

  PendingOperation copyWith({
    int? sequence,
    String? id,
    String? owner,
    String? inspectionId,
    String? payload,
    int? attempts,
    bool? blocked,
    Value<String?> error = const Value.absent(),
  }) => PendingOperation(
    sequence: sequence ?? this.sequence,
    id: id ?? this.id,
    owner: owner ?? this.owner,
    inspectionId: inspectionId ?? this.inspectionId,
    payload: payload ?? this.payload,
    attempts: attempts ?? this.attempts,
    blocked: blocked ?? this.blocked,
    error: error.present ? error.value : this.error,
  );
  PendingOperation copyWithCompanion(PendingOperationsCompanion data) {
    return PendingOperation(
      sequence: data.sequence.present ? data.sequence.value : this.sequence,
      id: data.id.present ? data.id.value : this.id,
      owner: data.owner.present ? data.owner.value : this.owner,
      inspectionId: data.inspectionId.present
          ? data.inspectionId.value
          : this.inspectionId,
      payload: data.payload.present ? data.payload.value : this.payload,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      blocked: data.blocked.present ? data.blocked.value : this.blocked,
      error: data.error.present ? data.error.value : this.error,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PendingOperation(')
          ..write('sequence: $sequence, ')
          ..write('id: $id, ')
          ..write('owner: $owner, ')
          ..write('inspectionId: $inspectionId, ')
          ..write('payload: $payload, ')
          ..write('attempts: $attempts, ')
          ..write('blocked: $blocked, ')
          ..write('error: $error')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    sequence,
    id,
    owner,
    inspectionId,
    payload,
    attempts,
    blocked,
    error,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PendingOperation &&
          other.sequence == this.sequence &&
          other.id == this.id &&
          other.owner == this.owner &&
          other.inspectionId == this.inspectionId &&
          other.payload == this.payload &&
          other.attempts == this.attempts &&
          other.blocked == this.blocked &&
          other.error == this.error);
}

class PendingOperationsCompanion extends UpdateCompanion<PendingOperation> {
  final Value<int> sequence;
  final Value<String> id;
  final Value<String> owner;
  final Value<String> inspectionId;
  final Value<String> payload;
  final Value<int> attempts;
  final Value<bool> blocked;
  final Value<String?> error;
  const PendingOperationsCompanion({
    this.sequence = const Value.absent(),
    this.id = const Value.absent(),
    this.owner = const Value.absent(),
    this.inspectionId = const Value.absent(),
    this.payload = const Value.absent(),
    this.attempts = const Value.absent(),
    this.blocked = const Value.absent(),
    this.error = const Value.absent(),
  });
  PendingOperationsCompanion.insert({
    this.sequence = const Value.absent(),
    required String id,
    required String owner,
    required String inspectionId,
    required String payload,
    this.attempts = const Value.absent(),
    this.blocked = const Value.absent(),
    this.error = const Value.absent(),
  }) : id = Value(id),
       owner = Value(owner),
       inspectionId = Value(inspectionId),
       payload = Value(payload);
  static Insertable<PendingOperation> custom({
    Expression<int>? sequence,
    Expression<String>? id,
    Expression<String>? owner,
    Expression<String>? inspectionId,
    Expression<String>? payload,
    Expression<int>? attempts,
    Expression<bool>? blocked,
    Expression<String>? error,
  }) {
    return RawValuesInsertable({
      if (sequence != null) 'sequence': sequence,
      if (id != null) 'id': id,
      if (owner != null) 'owner': owner,
      if (inspectionId != null) 'inspection_id': inspectionId,
      if (payload != null) 'payload': payload,
      if (attempts != null) 'attempts': attempts,
      if (blocked != null) 'blocked': blocked,
      if (error != null) 'error': error,
    });
  }

  PendingOperationsCompanion copyWith({
    Value<int>? sequence,
    Value<String>? id,
    Value<String>? owner,
    Value<String>? inspectionId,
    Value<String>? payload,
    Value<int>? attempts,
    Value<bool>? blocked,
    Value<String?>? error,
  }) {
    return PendingOperationsCompanion(
      sequence: sequence ?? this.sequence,
      id: id ?? this.id,
      owner: owner ?? this.owner,
      inspectionId: inspectionId ?? this.inspectionId,
      payload: payload ?? this.payload,
      attempts: attempts ?? this.attempts,
      blocked: blocked ?? this.blocked,
      error: error ?? this.error,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (sequence.present) {
      map['sequence'] = Variable<int>(sequence.value);
    }
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (owner.present) {
      map['owner'] = Variable<String>(owner.value);
    }
    if (inspectionId.present) {
      map['inspection_id'] = Variable<String>(inspectionId.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (blocked.present) {
      map['blocked'] = Variable<bool>(blocked.value);
    }
    if (error.present) {
      map['error'] = Variable<String>(error.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PendingOperationsCompanion(')
          ..write('sequence: $sequence, ')
          ..write('id: $id, ')
          ..write('owner: $owner, ')
          ..write('inspectionId: $inspectionId, ')
          ..write('payload: $payload, ')
          ..write('attempts: $attempts, ')
          ..write('blocked: $blocked, ')
          ..write('error: $error')
          ..write(')'))
        .toString();
  }
}

class $CachedObjectsTable extends CachedObjects
    with TableInfo<$CachedObjectsTable, CachedObject> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedObjectsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _cacheKeyMeta = const VerificationMeta(
    'cacheKey',
  );
  @override
  late final GeneratedColumn<String> cacheKey = GeneratedColumn<String>(
    'cache_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [cacheKey, payload];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_objects';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedObject> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('cache_key')) {
      context.handle(
        _cacheKeyMeta,
        cacheKey.isAcceptableOrUnknown(data['cache_key']!, _cacheKeyMeta),
      );
    } else if (isInserting) {
      context.missing(_cacheKeyMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {cacheKey};
  @override
  CachedObject map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedObject(
      cacheKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}cache_key'],
      )!,
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
    );
  }

  @override
  $CachedObjectsTable createAlias(String alias) {
    return $CachedObjectsTable(attachedDatabase, alias);
  }
}

class CachedObject extends DataClass implements Insertable<CachedObject> {
  final String cacheKey;
  final String payload;
  const CachedObject({required this.cacheKey, required this.payload});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['cache_key'] = Variable<String>(cacheKey);
    map['payload'] = Variable<String>(payload);
    return map;
  }

  CachedObjectsCompanion toCompanion(bool nullToAbsent) {
    return CachedObjectsCompanion(
      cacheKey: Value(cacheKey),
      payload: Value(payload),
    );
  }

  factory CachedObject.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedObject(
      cacheKey: serializer.fromJson<String>(json['cacheKey']),
      payload: serializer.fromJson<String>(json['payload']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'cacheKey': serializer.toJson<String>(cacheKey),
      'payload': serializer.toJson<String>(payload),
    };
  }

  CachedObject copyWith({String? cacheKey, String? payload}) => CachedObject(
    cacheKey: cacheKey ?? this.cacheKey,
    payload: payload ?? this.payload,
  );
  CachedObject copyWithCompanion(CachedObjectsCompanion data) {
    return CachedObject(
      cacheKey: data.cacheKey.present ? data.cacheKey.value : this.cacheKey,
      payload: data.payload.present ? data.payload.value : this.payload,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedObject(')
          ..write('cacheKey: $cacheKey, ')
          ..write('payload: $payload')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(cacheKey, payload);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedObject &&
          other.cacheKey == this.cacheKey &&
          other.payload == this.payload);
}

class CachedObjectsCompanion extends UpdateCompanion<CachedObject> {
  final Value<String> cacheKey;
  final Value<String> payload;
  final Value<int> rowid;
  const CachedObjectsCompanion({
    this.cacheKey = const Value.absent(),
    this.payload = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedObjectsCompanion.insert({
    required String cacheKey,
    required String payload,
    this.rowid = const Value.absent(),
  }) : cacheKey = Value(cacheKey),
       payload = Value(payload);
  static Insertable<CachedObject> custom({
    Expression<String>? cacheKey,
    Expression<String>? payload,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (cacheKey != null) 'cache_key': cacheKey,
      if (payload != null) 'payload': payload,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedObjectsCompanion copyWith({
    Value<String>? cacheKey,
    Value<String>? payload,
    Value<int>? rowid,
  }) {
    return CachedObjectsCompanion(
      cacheKey: cacheKey ?? this.cacheKey,
      payload: payload ?? this.payload,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (cacheKey.present) {
      map['cache_key'] = Variable<String>(cacheKey.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedObjectsCompanion(')
          ..write('cacheKey: $cacheKey, ')
          ..write('payload: $payload, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LocalPhotosTable extends LocalPhotos
    with TableInfo<$LocalPhotosTable, LocalPhoto> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalPhotosTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ownerMeta = const VerificationMeta('owner');
  @override
  late final GeneratedColumn<String> owner = GeneratedColumn<String>(
    'owner',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _inspectionIdMeta = const VerificationMeta(
    'inspectionId',
  );
  @override
  late final GeneratedColumn<String> inspectionId = GeneratedColumn<String>(
    'inspection_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _metadataMeta = const VerificationMeta(
    'metadata',
  );
  @override
  late final GeneratedColumn<String> metadata = GeneratedColumn<String>(
    'metadata',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _filePathMeta = const VerificationMeta(
    'filePath',
  );
  @override
  late final GeneratedColumn<String> filePath = GeneratedColumn<String>(
    'file_path',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _uploadedMeta = const VerificationMeta(
    'uploaded',
  );
  @override
  late final GeneratedColumn<bool> uploaded = GeneratedColumn<bool>(
    'uploaded',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("uploaded" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _errorMeta = const VerificationMeta('error');
  @override
  late final GeneratedColumn<String> error = GeneratedColumn<String>(
    'error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    owner,
    inspectionId,
    metadata,
    filePath,
    uploaded,
    error,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_photos';
  @override
  VerificationContext validateIntegrity(
    Insertable<LocalPhoto> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner')) {
      context.handle(
        _ownerMeta,
        owner.isAcceptableOrUnknown(data['owner']!, _ownerMeta),
      );
    } else if (isInserting) {
      context.missing(_ownerMeta);
    }
    if (data.containsKey('inspection_id')) {
      context.handle(
        _inspectionIdMeta,
        inspectionId.isAcceptableOrUnknown(
          data['inspection_id']!,
          _inspectionIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_inspectionIdMeta);
    }
    if (data.containsKey('metadata')) {
      context.handle(
        _metadataMeta,
        metadata.isAcceptableOrUnknown(data['metadata']!, _metadataMeta),
      );
    } else if (isInserting) {
      context.missing(_metadataMeta);
    }
    if (data.containsKey('file_path')) {
      context.handle(
        _filePathMeta,
        filePath.isAcceptableOrUnknown(data['file_path']!, _filePathMeta),
      );
    } else if (isInserting) {
      context.missing(_filePathMeta);
    }
    if (data.containsKey('uploaded')) {
      context.handle(
        _uploadedMeta,
        uploaded.isAcceptableOrUnknown(data['uploaded']!, _uploadedMeta),
      );
    }
    if (data.containsKey('error')) {
      context.handle(
        _errorMeta,
        error.isAcceptableOrUnknown(data['error']!, _errorMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  LocalPhoto map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalPhoto(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      owner: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}owner'],
      )!,
      inspectionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}inspection_id'],
      )!,
      metadata: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}metadata'],
      )!,
      filePath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}file_path'],
      )!,
      uploaded: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}uploaded'],
      )!,
      error: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}error'],
      ),
    );
  }

  @override
  $LocalPhotosTable createAlias(String alias) {
    return $LocalPhotosTable(attachedDatabase, alias);
  }
}

class LocalPhoto extends DataClass implements Insertable<LocalPhoto> {
  final String id;
  final String owner;
  final String inspectionId;
  final String metadata;
  final String filePath;
  final bool uploaded;
  final String? error;
  const LocalPhoto({
    required this.id,
    required this.owner,
    required this.inspectionId,
    required this.metadata,
    required this.filePath,
    required this.uploaded,
    this.error,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner'] = Variable<String>(owner);
    map['inspection_id'] = Variable<String>(inspectionId);
    map['metadata'] = Variable<String>(metadata);
    map['file_path'] = Variable<String>(filePath);
    map['uploaded'] = Variable<bool>(uploaded);
    if (!nullToAbsent || error != null) {
      map['error'] = Variable<String>(error);
    }
    return map;
  }

  LocalPhotosCompanion toCompanion(bool nullToAbsent) {
    return LocalPhotosCompanion(
      id: Value(id),
      owner: Value(owner),
      inspectionId: Value(inspectionId),
      metadata: Value(metadata),
      filePath: Value(filePath),
      uploaded: Value(uploaded),
      error: error == null && nullToAbsent
          ? const Value.absent()
          : Value(error),
    );
  }

  factory LocalPhoto.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalPhoto(
      id: serializer.fromJson<String>(json['id']),
      owner: serializer.fromJson<String>(json['owner']),
      inspectionId: serializer.fromJson<String>(json['inspectionId']),
      metadata: serializer.fromJson<String>(json['metadata']),
      filePath: serializer.fromJson<String>(json['filePath']),
      uploaded: serializer.fromJson<bool>(json['uploaded']),
      error: serializer.fromJson<String?>(json['error']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'owner': serializer.toJson<String>(owner),
      'inspectionId': serializer.toJson<String>(inspectionId),
      'metadata': serializer.toJson<String>(metadata),
      'filePath': serializer.toJson<String>(filePath),
      'uploaded': serializer.toJson<bool>(uploaded),
      'error': serializer.toJson<String?>(error),
    };
  }

  LocalPhoto copyWith({
    String? id,
    String? owner,
    String? inspectionId,
    String? metadata,
    String? filePath,
    bool? uploaded,
    Value<String?> error = const Value.absent(),
  }) => LocalPhoto(
    id: id ?? this.id,
    owner: owner ?? this.owner,
    inspectionId: inspectionId ?? this.inspectionId,
    metadata: metadata ?? this.metadata,
    filePath: filePath ?? this.filePath,
    uploaded: uploaded ?? this.uploaded,
    error: error.present ? error.value : this.error,
  );
  LocalPhoto copyWithCompanion(LocalPhotosCompanion data) {
    return LocalPhoto(
      id: data.id.present ? data.id.value : this.id,
      owner: data.owner.present ? data.owner.value : this.owner,
      inspectionId: data.inspectionId.present
          ? data.inspectionId.value
          : this.inspectionId,
      metadata: data.metadata.present ? data.metadata.value : this.metadata,
      filePath: data.filePath.present ? data.filePath.value : this.filePath,
      uploaded: data.uploaded.present ? data.uploaded.value : this.uploaded,
      error: data.error.present ? data.error.value : this.error,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalPhoto(')
          ..write('id: $id, ')
          ..write('owner: $owner, ')
          ..write('inspectionId: $inspectionId, ')
          ..write('metadata: $metadata, ')
          ..write('filePath: $filePath, ')
          ..write('uploaded: $uploaded, ')
          ..write('error: $error')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, owner, inspectionId, metadata, filePath, uploaded, error);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalPhoto &&
          other.id == this.id &&
          other.owner == this.owner &&
          other.inspectionId == this.inspectionId &&
          other.metadata == this.metadata &&
          other.filePath == this.filePath &&
          other.uploaded == this.uploaded &&
          other.error == this.error);
}

class LocalPhotosCompanion extends UpdateCompanion<LocalPhoto> {
  final Value<String> id;
  final Value<String> owner;
  final Value<String> inspectionId;
  final Value<String> metadata;
  final Value<String> filePath;
  final Value<bool> uploaded;
  final Value<String?> error;
  final Value<int> rowid;
  const LocalPhotosCompanion({
    this.id = const Value.absent(),
    this.owner = const Value.absent(),
    this.inspectionId = const Value.absent(),
    this.metadata = const Value.absent(),
    this.filePath = const Value.absent(),
    this.uploaded = const Value.absent(),
    this.error = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalPhotosCompanion.insert({
    required String id,
    required String owner,
    required String inspectionId,
    required String metadata,
    required String filePath,
    this.uploaded = const Value.absent(),
    this.error = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       owner = Value(owner),
       inspectionId = Value(inspectionId),
       metadata = Value(metadata),
       filePath = Value(filePath);
  static Insertable<LocalPhoto> custom({
    Expression<String>? id,
    Expression<String>? owner,
    Expression<String>? inspectionId,
    Expression<String>? metadata,
    Expression<String>? filePath,
    Expression<bool>? uploaded,
    Expression<String>? error,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (owner != null) 'owner': owner,
      if (inspectionId != null) 'inspection_id': inspectionId,
      if (metadata != null) 'metadata': metadata,
      if (filePath != null) 'file_path': filePath,
      if (uploaded != null) 'uploaded': uploaded,
      if (error != null) 'error': error,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalPhotosCompanion copyWith({
    Value<String>? id,
    Value<String>? owner,
    Value<String>? inspectionId,
    Value<String>? metadata,
    Value<String>? filePath,
    Value<bool>? uploaded,
    Value<String?>? error,
    Value<int>? rowid,
  }) {
    return LocalPhotosCompanion(
      id: id ?? this.id,
      owner: owner ?? this.owner,
      inspectionId: inspectionId ?? this.inspectionId,
      metadata: metadata ?? this.metadata,
      filePath: filePath ?? this.filePath,
      uploaded: uploaded ?? this.uploaded,
      error: error ?? this.error,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (owner.present) {
      map['owner'] = Variable<String>(owner.value);
    }
    if (inspectionId.present) {
      map['inspection_id'] = Variable<String>(inspectionId.value);
    }
    if (metadata.present) {
      map['metadata'] = Variable<String>(metadata.value);
    }
    if (filePath.present) {
      map['file_path'] = Variable<String>(filePath.value);
    }
    if (uploaded.present) {
      map['uploaded'] = Variable<bool>(uploaded.value);
    }
    if (error.present) {
      map['error'] = Variable<String>(error.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalPhotosCompanion(')
          ..write('id: $id, ')
          ..write('owner: $owner, ')
          ..write('inspectionId: $inspectionId, ')
          ..write('metadata: $metadata, ')
          ..write('filePath: $filePath, ')
          ..write('uploaded: $uploaded, ')
          ..write('error: $error, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $LocalInspectionsTable localInspections = $LocalInspectionsTable(
    this,
  );
  late final $PendingOperationsTable pendingOperations =
      $PendingOperationsTable(this);
  late final $CachedObjectsTable cachedObjects = $CachedObjectsTable(this);
  late final $LocalPhotosTable localPhotos = $LocalPhotosTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    localInspections,
    pendingOperations,
    cachedObjects,
    localPhotos,
  ];
}

typedef $$LocalInspectionsTableCreateCompanionBuilder =
    LocalInspectionsCompanion Function({
      required String id,
      required String owner,
      required String payload,
      required String templateJson,
      required String vehicleJson,
      Value<int> serverVersion,
      required DateTime updatedAt,
      Value<int> rowid,
    });
typedef $$LocalInspectionsTableUpdateCompanionBuilder =
    LocalInspectionsCompanion Function({
      Value<String> id,
      Value<String> owner,
      Value<String> payload,
      Value<String> templateJson,
      Value<String> vehicleJson,
      Value<int> serverVersion,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$LocalInspectionsTableFilterComposer
    extends Composer<_$AppDatabase, $LocalInspectionsTable> {
  $$LocalInspectionsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get owner => $composableBuilder(
    column: $table.owner,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get templateJson => $composableBuilder(
    column: $table.templateJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get vehicleJson => $composableBuilder(
    column: $table.vehicleJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$LocalInspectionsTableOrderingComposer
    extends Composer<_$AppDatabase, $LocalInspectionsTable> {
  $$LocalInspectionsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get owner => $composableBuilder(
    column: $table.owner,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get templateJson => $composableBuilder(
    column: $table.templateJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get vehicleJson => $composableBuilder(
    column: $table.vehicleJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$LocalInspectionsTableAnnotationComposer
    extends Composer<_$AppDatabase, $LocalInspectionsTable> {
  $$LocalInspectionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get owner =>
      $composableBuilder(column: $table.owner, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<String> get templateJson => $composableBuilder(
    column: $table.templateJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get vehicleJson => $composableBuilder(
    column: $table.vehicleJson,
    builder: (column) => column,
  );

  GeneratedColumn<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$LocalInspectionsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $LocalInspectionsTable,
          LocalInspection,
          $$LocalInspectionsTableFilterComposer,
          $$LocalInspectionsTableOrderingComposer,
          $$LocalInspectionsTableAnnotationComposer,
          $$LocalInspectionsTableCreateCompanionBuilder,
          $$LocalInspectionsTableUpdateCompanionBuilder,
          (
            LocalInspection,
            BaseReferences<
              _$AppDatabase,
              $LocalInspectionsTable,
              LocalInspection
            >,
          ),
          LocalInspection,
          PrefetchHooks Function()
        > {
  $$LocalInspectionsTableTableManager(
    _$AppDatabase db,
    $LocalInspectionsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalInspectionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalInspectionsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LocalInspectionsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> owner = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<String> templateJson = const Value.absent(),
                Value<String> vehicleJson = const Value.absent(),
                Value<int> serverVersion = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalInspectionsCompanion(
                id: id,
                owner: owner,
                payload: payload,
                templateJson: templateJson,
                vehicleJson: vehicleJson,
                serverVersion: serverVersion,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String owner,
                required String payload,
                required String templateJson,
                required String vehicleJson,
                Value<int> serverVersion = const Value.absent(),
                required DateTime updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => LocalInspectionsCompanion.insert(
                id: id,
                owner: owner,
                payload: payload,
                templateJson: templateJson,
                vehicleJson: vehicleJson,
                serverVersion: serverVersion,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$LocalInspectionsTable, LocalInspection>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $LocalInspectionsTable,
                    LocalInspection
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$LocalInspectionsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $LocalInspectionsTable,
      LocalInspection,
      $$LocalInspectionsTableFilterComposer,
      $$LocalInspectionsTableOrderingComposer,
      $$LocalInspectionsTableAnnotationComposer,
      $$LocalInspectionsTableCreateCompanionBuilder,
      $$LocalInspectionsTableUpdateCompanionBuilder,
      (
        LocalInspection,
        BaseReferences<_$AppDatabase, $LocalInspectionsTable, LocalInspection>,
      ),
      LocalInspection,
      PrefetchHooks Function()
    >;
typedef $$PendingOperationsTableCreateCompanionBuilder =
    PendingOperationsCompanion Function({
      Value<int> sequence,
      required String id,
      required String owner,
      required String inspectionId,
      required String payload,
      Value<int> attempts,
      Value<bool> blocked,
      Value<String?> error,
    });
typedef $$PendingOperationsTableUpdateCompanionBuilder =
    PendingOperationsCompanion Function({
      Value<int> sequence,
      Value<String> id,
      Value<String> owner,
      Value<String> inspectionId,
      Value<String> payload,
      Value<int> attempts,
      Value<bool> blocked,
      Value<String?> error,
    });

class $$PendingOperationsTableFilterComposer
    extends Composer<_$AppDatabase, $PendingOperationsTable> {
  $$PendingOperationsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get sequence => $composableBuilder(
    column: $table.sequence,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get owner => $composableBuilder(
    column: $table.owner,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get inspectionId => $composableBuilder(
    column: $table.inspectionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get blocked => $composableBuilder(
    column: $table.blocked,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get error => $composableBuilder(
    column: $table.error,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PendingOperationsTableOrderingComposer
    extends Composer<_$AppDatabase, $PendingOperationsTable> {
  $$PendingOperationsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get sequence => $composableBuilder(
    column: $table.sequence,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get owner => $composableBuilder(
    column: $table.owner,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get inspectionId => $composableBuilder(
    column: $table.inspectionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get blocked => $composableBuilder(
    column: $table.blocked,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get error => $composableBuilder(
    column: $table.error,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PendingOperationsTableAnnotationComposer
    extends Composer<_$AppDatabase, $PendingOperationsTable> {
  $$PendingOperationsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get sequence =>
      $composableBuilder(column: $table.sequence, builder: (column) => column);

  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get owner =>
      $composableBuilder(column: $table.owner, builder: (column) => column);

  GeneratedColumn<String> get inspectionId => $composableBuilder(
    column: $table.inspectionId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<bool> get blocked =>
      $composableBuilder(column: $table.blocked, builder: (column) => column);

  GeneratedColumn<String> get error =>
      $composableBuilder(column: $table.error, builder: (column) => column);
}

class $$PendingOperationsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PendingOperationsTable,
          PendingOperation,
          $$PendingOperationsTableFilterComposer,
          $$PendingOperationsTableOrderingComposer,
          $$PendingOperationsTableAnnotationComposer,
          $$PendingOperationsTableCreateCompanionBuilder,
          $$PendingOperationsTableUpdateCompanionBuilder,
          (
            PendingOperation,
            BaseReferences<
              _$AppDatabase,
              $PendingOperationsTable,
              PendingOperation
            >,
          ),
          PendingOperation,
          PrefetchHooks Function()
        > {
  $$PendingOperationsTableTableManager(
    _$AppDatabase db,
    $PendingOperationsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PendingOperationsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PendingOperationsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PendingOperationsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<int> sequence = const Value.absent(),
                Value<String> id = const Value.absent(),
                Value<String> owner = const Value.absent(),
                Value<String> inspectionId = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<bool> blocked = const Value.absent(),
                Value<String?> error = const Value.absent(),
              }) => PendingOperationsCompanion(
                sequence: sequence,
                id: id,
                owner: owner,
                inspectionId: inspectionId,
                payload: payload,
                attempts: attempts,
                blocked: blocked,
                error: error,
              ),
          createCompanionCallback:
              ({
                Value<int> sequence = const Value.absent(),
                required String id,
                required String owner,
                required String inspectionId,
                required String payload,
                Value<int> attempts = const Value.absent(),
                Value<bool> blocked = const Value.absent(),
                Value<String?> error = const Value.absent(),
              }) => PendingOperationsCompanion.insert(
                sequence: sequence,
                id: id,
                owner: owner,
                inspectionId: inspectionId,
                payload: payload,
                attempts: attempts,
                blocked: blocked,
                error: error,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$PendingOperationsTable, PendingOperation>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $PendingOperationsTable,
                    PendingOperation
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PendingOperationsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PendingOperationsTable,
      PendingOperation,
      $$PendingOperationsTableFilterComposer,
      $$PendingOperationsTableOrderingComposer,
      $$PendingOperationsTableAnnotationComposer,
      $$PendingOperationsTableCreateCompanionBuilder,
      $$PendingOperationsTableUpdateCompanionBuilder,
      (
        PendingOperation,
        BaseReferences<
          _$AppDatabase,
          $PendingOperationsTable,
          PendingOperation
        >,
      ),
      PendingOperation,
      PrefetchHooks Function()
    >;
typedef $$CachedObjectsTableCreateCompanionBuilder =
    CachedObjectsCompanion Function({
      required String cacheKey,
      required String payload,
      Value<int> rowid,
    });
typedef $$CachedObjectsTableUpdateCompanionBuilder =
    CachedObjectsCompanion Function({
      Value<String> cacheKey,
      Value<String> payload,
      Value<int> rowid,
    });

class $$CachedObjectsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedObjectsTable> {
  $$CachedObjectsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get cacheKey => $composableBuilder(
    column: $table.cacheKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedObjectsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedObjectsTable> {
  $$CachedObjectsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get cacheKey => $composableBuilder(
    column: $table.cacheKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedObjectsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedObjectsTable> {
  $$CachedObjectsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get cacheKey =>
      $composableBuilder(column: $table.cacheKey, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);
}

class $$CachedObjectsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedObjectsTable,
          CachedObject,
          $$CachedObjectsTableFilterComposer,
          $$CachedObjectsTableOrderingComposer,
          $$CachedObjectsTableAnnotationComposer,
          $$CachedObjectsTableCreateCompanionBuilder,
          $$CachedObjectsTableUpdateCompanionBuilder,
          (
            CachedObject,
            BaseReferences<_$AppDatabase, $CachedObjectsTable, CachedObject>,
          ),
          CachedObject,
          PrefetchHooks Function()
        > {
  $$CachedObjectsTableTableManager(_$AppDatabase db, $CachedObjectsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedObjectsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedObjectsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedObjectsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> cacheKey = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedObjectsCompanion(
                cacheKey: cacheKey,
                payload: payload,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String cacheKey,
                required String payload,
                Value<int> rowid = const Value.absent(),
              }) => CachedObjectsCompanion.insert(
                cacheKey: cacheKey,
                payload: payload,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedObjectsTable, CachedObject>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CachedObjectsTable,
                    CachedObject
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedObjectsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedObjectsTable,
      CachedObject,
      $$CachedObjectsTableFilterComposer,
      $$CachedObjectsTableOrderingComposer,
      $$CachedObjectsTableAnnotationComposer,
      $$CachedObjectsTableCreateCompanionBuilder,
      $$CachedObjectsTableUpdateCompanionBuilder,
      (
        CachedObject,
        BaseReferences<_$AppDatabase, $CachedObjectsTable, CachedObject>,
      ),
      CachedObject,
      PrefetchHooks Function()
    >;
typedef $$LocalPhotosTableCreateCompanionBuilder =
    LocalPhotosCompanion Function({
      required String id,
      required String owner,
      required String inspectionId,
      required String metadata,
      required String filePath,
      Value<bool> uploaded,
      Value<String?> error,
      Value<int> rowid,
    });
typedef $$LocalPhotosTableUpdateCompanionBuilder =
    LocalPhotosCompanion Function({
      Value<String> id,
      Value<String> owner,
      Value<String> inspectionId,
      Value<String> metadata,
      Value<String> filePath,
      Value<bool> uploaded,
      Value<String?> error,
      Value<int> rowid,
    });

class $$LocalPhotosTableFilterComposer
    extends Composer<_$AppDatabase, $LocalPhotosTable> {
  $$LocalPhotosTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get owner => $composableBuilder(
    column: $table.owner,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get inspectionId => $composableBuilder(
    column: $table.inspectionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get metadata => $composableBuilder(
    column: $table.metadata,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get filePath => $composableBuilder(
    column: $table.filePath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get uploaded => $composableBuilder(
    column: $table.uploaded,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get error => $composableBuilder(
    column: $table.error,
    builder: (column) => ColumnFilters(column),
  );
}

class $$LocalPhotosTableOrderingComposer
    extends Composer<_$AppDatabase, $LocalPhotosTable> {
  $$LocalPhotosTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get owner => $composableBuilder(
    column: $table.owner,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get inspectionId => $composableBuilder(
    column: $table.inspectionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get metadata => $composableBuilder(
    column: $table.metadata,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get filePath => $composableBuilder(
    column: $table.filePath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get uploaded => $composableBuilder(
    column: $table.uploaded,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get error => $composableBuilder(
    column: $table.error,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$LocalPhotosTableAnnotationComposer
    extends Composer<_$AppDatabase, $LocalPhotosTable> {
  $$LocalPhotosTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get owner =>
      $composableBuilder(column: $table.owner, builder: (column) => column);

  GeneratedColumn<String> get inspectionId => $composableBuilder(
    column: $table.inspectionId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get metadata =>
      $composableBuilder(column: $table.metadata, builder: (column) => column);

  GeneratedColumn<String> get filePath =>
      $composableBuilder(column: $table.filePath, builder: (column) => column);

  GeneratedColumn<bool> get uploaded =>
      $composableBuilder(column: $table.uploaded, builder: (column) => column);

  GeneratedColumn<String> get error =>
      $composableBuilder(column: $table.error, builder: (column) => column);
}

class $$LocalPhotosTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $LocalPhotosTable,
          LocalPhoto,
          $$LocalPhotosTableFilterComposer,
          $$LocalPhotosTableOrderingComposer,
          $$LocalPhotosTableAnnotationComposer,
          $$LocalPhotosTableCreateCompanionBuilder,
          $$LocalPhotosTableUpdateCompanionBuilder,
          (
            LocalPhoto,
            BaseReferences<_$AppDatabase, $LocalPhotosTable, LocalPhoto>,
          ),
          LocalPhoto,
          PrefetchHooks Function()
        > {
  $$LocalPhotosTableTableManager(_$AppDatabase db, $LocalPhotosTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalPhotosTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalPhotosTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LocalPhotosTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> owner = const Value.absent(),
                Value<String> inspectionId = const Value.absent(),
                Value<String> metadata = const Value.absent(),
                Value<String> filePath = const Value.absent(),
                Value<bool> uploaded = const Value.absent(),
                Value<String?> error = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalPhotosCompanion(
                id: id,
                owner: owner,
                inspectionId: inspectionId,
                metadata: metadata,
                filePath: filePath,
                uploaded: uploaded,
                error: error,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String owner,
                required String inspectionId,
                required String metadata,
                required String filePath,
                Value<bool> uploaded = const Value.absent(),
                Value<String?> error = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalPhotosCompanion.insert(
                id: id,
                owner: owner,
                inspectionId: inspectionId,
                metadata: metadata,
                filePath: filePath,
                uploaded: uploaded,
                error: error,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$LocalPhotosTable, LocalPhoto>(table),
                  BaseReferences<_$AppDatabase, $LocalPhotosTable, LocalPhoto>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$LocalPhotosTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $LocalPhotosTable,
      LocalPhoto,
      $$LocalPhotosTableFilterComposer,
      $$LocalPhotosTableOrderingComposer,
      $$LocalPhotosTableAnnotationComposer,
      $$LocalPhotosTableCreateCompanionBuilder,
      $$LocalPhotosTableUpdateCompanionBuilder,
      (
        LocalPhoto,
        BaseReferences<_$AppDatabase, $LocalPhotosTable, LocalPhoto>,
      ),
      LocalPhoto,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$LocalInspectionsTableTableManager get localInspections =>
      $$LocalInspectionsTableTableManager(_db, _db.localInspections);
  $$PendingOperationsTableTableManager get pendingOperations =>
      $$PendingOperationsTableTableManager(_db, _db.pendingOperations);
  $$CachedObjectsTableTableManager get cachedObjects =>
      $$CachedObjectsTableTableManager(_db, _db.cachedObjects);
  $$LocalPhotosTableTableManager get localPhotos =>
      $$LocalPhotosTableTableManager(_db, _db.localPhotos);
}
