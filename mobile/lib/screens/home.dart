import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../domain.dart';
import '../data/database.dart';
import '../data/photos.dart';
import '../data/session.dart';
import '../data/sync.dart';
import '../data/recovery.dart';
import 'inspection.dart';
import 'queue.dart';
import 'history.dart';
import 'scanner.dart';
import 'retained_work.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.db,
    required this.sessions,
    required this.sync,
    required this.photos,
  });
  final AppDatabase db;
  final SessionManager sessions;
  final SyncEngine sync;
  final PhotoStore photos;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String search = '';
  final searchController = TextEditingController();
  List<InspectionDraft> drafts = [];
  int pending = 0;
  String? error;
  bool loading = true;
  late final Future<void> recoveryFinished;
  String get owner => widget.sessions.current!.owner;
  @override
  void initState() {
    super.initState();
    reload();
    widget.sync.addListener(syncChanged);
    recoveryFinished = recover();
  }

  Future<void> recover() async {
    try {
      final recovery = RecoveryService(
        widget.db,
        widget.sessions,
        widget.photos,
      );
      try {
        await recovery.recoverCamera();
      } catch (cameraError) {
        recovery.warnings.add('Recuperação da câmera pendente: $cameraError');
      }
      final recovered = await recovery.recoverFiles();
      if (recovered > 0) await reload();
      if (mounted) {
        setState(
          () => error = recovery.warnings.isEmpty
              ? null
              : recovery.warnings.join('\n'),
        );
      }
    } catch (e) {
      if (mounted) setState(() => error = 'Recuperação de foto pendente: $e');
    }
  }

  @override
  void dispose() {
    widget.sync.removeListener(syncChanged);
    searchController.dispose();
    super.dispose();
  }

  void syncChanged() {
    if (mounted) {
      setState(() {});
      if (!widget.sync.running) reload();
    }
  }

  Future<void> reload() async {
    try {
      final result = await widget.db.drafts(owner);
      final queue = await widget.db.queue(owner);
      if (mounted) {
        setState(() {
          drafts = result;
          pending = queue.length;
          loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          loading = false;
        });
      }
    }
  }

  void showError(Object e) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          duration: const Duration(seconds: 8),
        ),
      );
    }
  }

  Future<void> open(InspectionDraft draft) async {
    await recoveryFinished;
    final latest = await widget.db.draftById(owner, draft.id);
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => InspectionScreen(
          db: widget.db,
          sessions: widget.sessions,
          sync: widget.sync,
          photos: widget.photos,
          owner: owner,
          draft: latest ?? draft,
        ),
      ),
    );
    if (!mounted) return;
    await recover();
    await reload();
  }

  Future<void> start(Json vehicle) async {
    try {
      await recoveryFinished;
      await widget.sessions.assertEditable(owner);
      final templates =
          (widget.sessions.bootstrap?['templates'] as List? ?? [])
              .cast<Json>()
              .where(
                (t) =>
                    t['published'] == true &&
                    t['vehicleType'] == vehicle['type'],
              )
              .toList()
            ..sort(
              (a, b) => (b['version'] as int).compareTo(a['version'] as int),
            );
      if (templates.isEmpty) {
        throw StateError(
          'Nenhum checklist publicado para ${vehicle['type']}. Atualize o catálogo ou solicite um template ao supervisor.',
        );
      }
      Json selected = templates.first;
      var odometer = '${vehicle['currentOdometerKm'] ?? 0}';
      if (!mounted) return;
      final proceed = await showDialog<bool>(
        context: context,
        builder: (context) => StatefulBuilder(
          builder: (context, setDialog) => AlertDialog(
            scrollable: true,
            title: Text('Novo check-in • ${vehicle['internalNumber']}'),
            content: SizedBox(
              width: 480,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: selected['id'] as String,
                    decoration: const InputDecoration(
                      labelText: 'Checklist publicado',
                    ),
                    items: templates
                        .map(
                          (t) => DropdownMenuItem(
                            value: t['id'] as String,
                            child: Text('${t['name']} • v${t['version']}'),
                          ),
                        )
                        .toList(),
                    onChanged: (id) => setDialog(
                      () =>
                          selected = templates.firstWhere((t) => t['id'] == id),
                    ),
                  ),
                  const SizedBox(height: 20),
                  TextFormField(
                    initialValue: odometer,
                    onChanged: (value) => odometer = value,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Quilometragem atual',
                      suffixText: 'km',
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Iniciar inspeção'),
              ),
            ],
          ),
        ),
      );
      final mileage = num.tryParse(odometer.replaceAll(',', '.'));
      if (proceed != true) return;
      if (mileage == null ||
          !mileage.isFinite ||
          mileage != mileage.truncateToDouble() ||
          mileage < (vehicle['currentOdometerKm'] as num? ?? 0)) {
        throw StateError('Quilometragem inválida ou inferior à registrada.');
      }
      final draft = InspectionDraft.create(
        id: const Uuid().v4(),
        vehicle: vehicle,
        template: selected,
        deviceId: widget.sessions.deviceId,
        now: widget.sessions.now,
      )..inspection['odometerKm'] = mileage;
      await widget.sessions.assertEditable(owner);
      await widget.db.saveDraft(owner, draft);
      widget.sync.start();
      if (mounted) await open(draft);
    } catch (e) {
      showError(e);
    }
  }

  Future<void> refresh() async {
    try {
      await widget.sessions.refreshBootstrap();
      await reload();
    } catch (e) {
      showError(e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.sessions.current!;
    final vehicles = (widget.sessions.bootstrap?['vehicles'] as List? ?? [])
        .cast<Json>()
        .where(
          (v) =>
              v['active'] == true &&
              [v['id'], v['internalNumber'], v['plate']].any(
                (s) => '$s'.toLowerCase().contains(search.toLowerCase().trim()),
              ),
        )
        .toList();
    final activeDrafts = drafts.where((d) => !d.finalized).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'SUSUMU  /  VEHICLE CHECK',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20),
        ),
        actions: [
          IconButton(
            tooltip: 'Atualizar veículos e checklists',
            onPressed: refresh,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Sair preservando rascunhos',
            onPressed: () async {
              await widget.sessions.logout();
            },
            icon: const Icon(Icons.logout),
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: refresh,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              RetainedWorkNotice(db: widget.db, owner: owner),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Minha oficina',
                          style: Theme.of(context).textTheme.headlineLarge,
                        ),
                        Text(
                          '${session.user['name']} • ${const {'Inspector': 'Inspetor', 'Supervisor': 'Supervisor', 'Administrator': 'Administrador', 'Office': 'Escritório'}[session.user['role']] ?? session.user['role']}',
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ],
                    ),
                  ),
                  Chip(
                    avatar: Icon(
                      session.onlineValid(widget.sessions.now)
                          ? Icons.cloud_queue
                          : Icons.cloud_off,
                      size: 20,
                    ),
                    label: Text(
                      session.onlineValid(widget.sessions.now)
                          ? 'Sessão ativa'
                          : 'Modo offline',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Card(
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 10,
                  ),
                  leading: widget.sync.running
                      ? const CircularProgressIndicator()
                      : const Icon(Icons.cloud_sync_outlined, size: 32),
                  title: Text(widget.sync.message),
                  subtitle: Text(
                    '$pending operação(ões) pendente(s) • ${activeDrafts.length} rascunho(s)',
                  ),
                  trailing: IconButton(
                    tooltip: 'Ver fila e conflitos',
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) => QueueScreen(
                          db: widget.db,
                          sessions: widget.sessions,
                          sync: widget.sync,
                          photos: widget.photos,
                        ),
                      ),
                    ),
                    icon: const Icon(Icons.chevron_right),
                  ),
                ),
              ),
              if (!session.editable(widget.sessions.now))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    'Entre novamente para editar. Inspeções locais preservadas.',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              if (error != null)
                Text(
                  error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              const SizedBox(height: 24),
              TextField(
                key: const Key('vehicle-search'),
                controller: searchController,
                onChanged: (text) => setState(() => search = text),
                decoration: InputDecoration(
                  labelText: 'Pesquisar veículo',
                  hintText: 'Número interno, placa ou ID',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: IconButton(
                    tooltip: 'Ler QR Code',
                    onPressed: () async {
                      final text = await Navigator.push<String>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ScannerScreen(),
                        ),
                      );
                      if (text != null && mounted) {
                        setState(() {
                          search = text;
                          searchController.text = text;
                        });
                      }
                    },
                    icon: const Icon(Icons.qr_code_scanner),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              LayoutBuilder(
                builder: (context, constraints) {
                  final wide = constraints.maxWidth >= 900;
                  final vehicleList = Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Veículos',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 12),
                      if (vehicles.isEmpty)
                        const Card(
                          child: Padding(
                            padding: EdgeInsets.all(24),
                            child: Text(
                              'Nenhum veículo encontrado no catálogo local.',
                            ),
                          ),
                        ),
                      ...vehicles.map(
                        (v) => Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.local_shipping_outlined,
                                      size: 36,
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${v['internalNumber']} • ${v['plate']}',
                                            style: const TextStyle(
                                              fontSize: 22,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                          Text(
                                            '${v['type']} • ${v['currentOdometerKm']} km',
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 20),
                                Wrap(
                                  spacing: 12,
                                  runSpacing: 12,
                                  children: [
                                    FilledButton.icon(
                                      onPressed:
                                          session.editable(widget.sessions.now)
                                          ? () => start(v)
                                          : null,
                                      icon: const Icon(Icons.add_task),
                                      label: const Text('Novo check-in'),
                                    ),
                                    OutlinedButton.icon(
                                      onPressed: () => Navigator.push(
                                        context,
                                        MaterialPageRoute<void>(
                                          builder: (_) => HistoryScreen(
                                            db: widget.db,
                                            sessions: widget.sessions,
                                            sync: widget.sync,
                                            photos: widget.photos,
                                            vehicle: v,
                                          ),
                                        ),
                                      ),
                                      icon: const Icon(Icons.history),
                                      label: const Text('Histórico'),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                  final resume = Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Retomar trabalho',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 12),
                      if (loading) const LinearProgressIndicator(),
                      if (!loading && activeDrafts.isEmpty)
                        const Card(
                          child: Padding(
                            padding: EdgeInsets.all(24),
                            child: Text(
                              'Nenhum rascunho neste usuário. Inicie um check-in para começar.',
                            ),
                          ),
                        ),
                      ...activeDrafts.map(
                        (d) => Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${d.vehicle['internalNumber']} • ${d.vehicle['plate']}',
                                  style: const TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  '${d.template['name']} • v${d.template['version']}',
                                ),
                                const SizedBox(height: 16),
                                FilledButton.tonalIcon(
                                  onPressed: () => open(d),
                                  icon: const Icon(Icons.play_arrow),
                                  label: const Text('Continuar inspeção'),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                  return wide
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(flex: 3, child: vehicleList),
                            const SizedBox(width: 24),
                            Expanded(flex: 2, child: resume),
                          ],
                        )
                      : Column(
                          children: [
                            resume,
                            const SizedBox(height: 24),
                            vehicleList,
                          ],
                        );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
