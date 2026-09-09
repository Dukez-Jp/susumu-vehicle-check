import 'package:flutter/material.dart';
import '../domain.dart';
import '../data/database.dart';
import '../data/api.dart';
import '../data/photos.dart';
import '../data/session.dart';
import '../data/sync.dart';
import 'inspection.dart';
import 'photo_viewer.dart';

String historyDate(Object? value) {
  final date = DateTime.tryParse('$value')?.toLocal();
  if (date == null) return 'Data indisponível';
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(date.day)}/${two(date.month)}/${date.year} ${two(date.hour)}:${two(date.minute)}';
}

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({
    super.key,
    required this.db,
    required this.sessions,
    required this.sync,
    required this.photos,
    required this.vehicle,
  });
  final AppDatabase db;
  final SessionManager sessions;
  final SyncEngine sync;
  final PhotoStore photos;
  final Json vehicle;
  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<InspectionDraft> local = [];
  List<Json> remote = [];
  String? warning;
  bool loading = false,
      loadingMore = false,
      hasMore = true,
      openingDetail = false;
  int nextOffset = 0;
  late final owner = widget.sessions.current!.owner;
  late final generation = widget.sessions.generation;
  bool get active =>
      mounted &&
      widget.sessions.current?.owner == owner &&
      widget.sessions.generation == generation;
  String get cacheKey => 'history|$owner|${widget.vehicle['id']}';
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    if (loading || loadingMore || !active) return;
    final session = widget.sessions.current!;
    setState(() => loading = true);
    try {
      local = (await widget.db.drafts(session.owner))
          .where((d) => d.inspection['vehicleId'] == widget.vehicle['id'])
          .toList();
      final cached = await widget.db.cached(cacheKey);
      remote = (cached?['inspections'] as List? ?? []).cast<Json>();
      nextOffset = cached?['nextOffset'] as int? ?? remote.length;
      hasMore =
          cached?['hasMore'] as bool? ?? remote.length >= 100 || cached == null;
      if (!active) return;
      if (!session.onlineValid(widget.sessions.now)) {
        warning =
            'Somente registros locais e páginas já salvas. Entre novamente para consultar o servidor; o histórico completo não está garantido offline.';
        return;
      }
      await fetchPage(session, append: false);
    } catch (e) {
      await reportError(e);
    } finally {
      if (active) setState(() => loading = false);
    }
  }

  Future<void> loadMore() async {
    if (loading || loadingMore || !active || !hasMore) return;
    final session = widget.sessions.current!;
    if (!session.onlineValid(widget.sessions.now)) {
      setState(
        () => warning =
            'Somente registros locais e páginas já salvas. Entre novamente para buscar outra página.',
      );
      return;
    }
    setState(() => loadingMore = true);
    try {
      await fetchPage(session, append: true);
    } catch (e) {
      await reportError(e);
    } finally {
      if (active) setState(() => loadingMore = false);
    }
  }

  Future<void> reportError(Object error) async {
    if (!active) return;
    if (error is ApiException && error.status == 401) {
      await widget.sessions.logout();
      return;
    }
    warning =
        'Não foi possível consultar o servidor. Páginas já carregadas foram preservadas. Tente novamente. $error';
  }

  Future<void> fetchPage(Session session, {required bool append}) async {
    final api = widget.sessions.factory(session.server, session.token);
    try {
      final offset = append ? nextOffset : 0;
      final page = await api.history(
        widget.vehicle['id'] as String,
        offset: offset,
        limit: 100,
      );
      if (!active) return;
      final merged = <String, Json>{
        for (final row in append ? remote : <Json>[]) row['id'] as String: row,
        for (final row in page) row['id'] as String: row,
      }.values.toList();
      final following = offset + page.length;
      final more = page.length == 100;
      await widget.db.cache(cacheKey, {
        'inspections': merged,
        'nextOffset': following,
        'hasMore': more,
        'fetchedAt': widget.sessions.now.toIso8601String(),
      });
      if (!active) return;
      remote = merged;
      nextOffset = following;
      hasMore = more;
      warning = null;
    } finally {
      api.close();
    }
  }

  Future<void> details(Json inspection) async {
    if (!active || openingDetail) return;
    setState(() => openingDetail = true);
    try {
      final detailKey = 'inspection|$owner|${inspection['id']}';
      Json detail = await widget.db.cached(detailKey) ?? inspection;
      if (!active) return;
      final session = widget.sessions.current!;
      if (session.onlineValid(widget.sessions.now)) {
        final api = widget.sessions.factory(session.server, session.token);
        try {
          detail = await api.inspection(inspection['id'] as String);
          if (!active) return;
          await widget.db.cache(detailKey, detail);
        } catch (e) {
          await reportError(e);
        } finally {
          api.close();
        }
      }
      if (!active) return;
      final definition = await pinnedTemplate(detail, session);
      if (!mounted || !active) return;
      final definitions = <String, Json>{
        for (final section in definition?['sections'] as List? ?? [])
          for (final item in section['items'] as List)
            item['id'] as String: item as Json,
      };
      final answers = (detail['items'] as List? ?? []).cast<Json>();
      setState(() => openingDetail = false);
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(
            'Inspeção • ${detail['state'] == 'Finalized' ? 'Finalizada' : 'Rascunho'}',
          ),
          content: SizedBox(
            width: 700,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    definition == null
                        ? 'Checklist v${detail['templateVersion']} • definição não armazenada no tablet'
                        : '${definition['name']} • v${definition['version']}',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  if (definition == null)
                    const Text(
                      'Conecte-se para buscar a definição exata desta versão. Os nomes e as unidades dos itens não estão disponíveis offline.',
                    ),
                  Text(
                    'Autor: ${detail['createdByName'] ?? '—'}\nInício: ${historyDate(detail['startedAt'])}\nQuilometragem: ${detail['odometerKm']} km\nFotos: ${detail['photoUploadState'] == 'Complete' ? 'Completas' : 'Pendentes'}',
                  ),
                  const Divider(),
                  for (var index = 0; index < answers.length; index++)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            definitions[answers[index]['itemId']]?['label']
                                    as String? ??
                                'Item ${index + 1} (definição não disponível)',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          Text(
                            '${statuses[answers[index]['status']] ?? answers[index]['status']} • ${answers[index]['value'] ?? '—'} ${definitions[answers[index]['itemId']]?['unit'] ?? ''}',
                          ),
                          if ((answers[index]['notes'] as String? ?? '')
                              .isNotEmpty)
                            Text(answers[index]['notes'] as String),
                        ],
                      ),
                    ),
                  Text(detail['notes'] as String? ?? ''),
                  ExpansionTile(
                    title: const Text('Referências para suporte'),
                    children: [
                      SelectableText(
                        'Inspeção: ${detail['id']}\nTemplate: ${detail['templateId']} / v${detail['templateVersion']}',
                      ),
                    ],
                  ),
                  for (final photo
                      in (detail['photos'] as List? ?? []).cast<Json>())
                    TextButton.icon(
                      onPressed: () => viewPhoto(detail, photo),
                      icon: const Icon(Icons.photo_outlined),
                      label: Text(
                        photo['kind'] == 'Original'
                            ? 'Ver foto original'
                            : 'Ver ${photo['kind']}',
                      ),
                    ),
                ],
              ),
            ),
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Fechar'),
            ),
          ],
        ),
      );
    } catch (error) {
      await reportError(error);
      if (active) setState(() {});
    } finally {
      if (active) setState(() => openingDetail = false);
    }
  }

  Future<Json?> pinnedTemplate(Json detail, Session session) async {
    final id = detail['templateId'], version = detail['templateVersion'];
    bool matches(Json template) =>
        template['id'] == id && template['version'] == version;
    final key = 'template|$owner|$id|$version';
    final cached = await widget.db.cached(key);
    if (cached != null && matches(cached)) return cached;
    final candidates = <Json>[
      ...(widget.sessions.bootstrap?['templates'] as List? ?? []).cast<Json>(),
      ...local.map((d) => d.template),
    ];
    final existing = candidates.where(matches).firstOrNull;
    if (existing != null) {
      await widget.db.cache(key, existing);
      return existing;
    }
    if (!session.onlineValid(widget.sessions.now) || !active) return null;
    final api = widget.sessions.factory(session.server, session.token);
    try {
      final template = await api.template(id as String);
      if (!active) return null;
      if (!matches(template)) {
        throw StateError('Servidor retornou outra versão do checklist.');
      }
      await widget.db.cache(key, template);
      return template;
    } catch (error) {
      await reportError(error);
      return null;
    } finally {
      api.close();
    }
  }

  Future<void> viewPhoto(Json inspection, Json photo) async {
    final session = widget.sessions.current;
    if (session == null || !session.onlineValid(widget.sessions.now)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Entre online para carregar esta foto do servidor.'),
        ),
      );
      return;
    }
    final api = widget.sessions.factory(session.server, session.token);
    try {
      await Navigator.push(
        context,
        MaterialPageRoute<void>(
          builder: (_) => PhotoViewer(
            bytes: api
                .photoBytes(inspection['id'] as String, photo['id'] as String)
                .catchError((Object error) async {
                  await reportError(error);
                  throw error;
                }),
            title: photo['kind'] == 'Original'
                ? 'Foto original'
                : photo['kind'] == 'Signature'
                ? 'Assinatura'
                : 'Foto anotada',
          ),
        ),
      );
    } finally {
      api.close();
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text('Histórico • ${widget.vehicle['internalNumber']}'),
      actions: [
        IconButton(
          tooltip: 'Atualizar histórico',
          onPressed: loading || loadingMore ? null : load,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: Column(
      children: [
        if (warning != null)
          Padding(padding: const EdgeInsets.all(16), child: Text(warning!)),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              if (loading || openingDetail) const LinearProgressIndicator(),
              Text(
                'Neste tablet',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              if (local.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('Nenhuma inspeção local para este veículo.'),
                ),
              for (final draft in local)
                Card(
                  key: Key('history-local-${draft.id}'),
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(16),
                    leading: Icon(
                      draft.finalized
                          ? Icons.verified_outlined
                          : Icons.edit_note,
                    ),
                    title: Text(
                      '${draft.finalized ? 'Finalizada' : 'Rascunho'} • ${draft.inspection['odometerKm']} km',
                    ),
                    subtitle: Text(
                      '${historyDate(draft.inspection['startedAt'])}\n${draft.template['name']} v${draft.template['version']}',
                    ),
                    trailing: remote.any((row) => row['id'] == draft.id)
                        ? IconButton(
                            tooltip: 'Ver registro no servidor',
                            onPressed: () => details(
                              remote.firstWhere((row) => row['id'] == draft.id),
                            ),
                            icon: const Icon(Icons.cloud_done_outlined),
                          )
                        : const Icon(Icons.chevron_right),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) => InspectionScreen(
                          db: widget.db,
                          sessions: widget.sessions,
                          sync: widget.sync,
                          photos: widget.photos,
                          owner: widget.sessions.current!.owner,
                          draft: draft,
                        ),
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 24),
              Text(
                'Servidor',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              if (remote.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('Nenhum registro do servidor disponível.'),
                ),
              for (final inspection in remote.where(
                (row) => !local.any((d) => d.id == row['id']),
              ))
                Card(
                  key: Key('history-remote-${inspection['id']}'),
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(16),
                    leading: const Icon(Icons.cloud_done_outlined),
                    title: Text(
                      '${inspection['state'] == 'Finalized' ? 'Finalizada' : 'Rascunho'} • ${inspection['odometerKm']} km',
                    ),
                    subtitle: Text(
                      '${historyDate(inspection['startedAt'])}\n${inspection['createdByName'] ?? ''} • Fotos ${inspection['photoUploadState'] == 'Complete' ? 'completas' : 'pendentes'}',
                    ),
                    onTap: () => details(inspection),
                  ),
                ),
              const SizedBox(height: 16),
              Text(
                '${remote.length} registro(s) do servidor carregado(s). Registros com o mesmo ID no tablet aparecem uma única vez.',
              ),
              const SizedBox(height: 12),
              if (hasMore)
                FilledButton.icon(
                  key: const Key('history-load-more'),
                  onPressed:
                      loading ||
                          loadingMore ||
                          widget.sessions.current?.onlineValid(
                                widget.sessions.now,
                              ) !=
                              true
                      ? null
                      : loadMore,
                  icon: loadingMore
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.expand_more),
                  label: Text(
                    loadingMore
                        ? 'Carregando página…'
                        : 'Carregar mais registros',
                  ),
                )
              else
                const Text(
                  'Sem outra página nesta consulta. Atualize para consultar novos registros. Somente as páginas carregadas ficam disponíveis offline.',
                ),
            ],
          ),
        ),
      ],
    ),
  );
}
