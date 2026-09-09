import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../domain.dart';
import '../data/database.dart';
import '../data/camera.dart';
import '../data/editor.dart';
import '../data/photos.dart';
import '../data/session.dart';
import '../data/sync.dart';
import 'annotation.dart';
import 'photo_viewer.dart';
import 'signature.dart';

class InspectionScreen extends StatefulWidget {
  const InspectionScreen({
    super.key,
    required this.db,
    required this.sessions,
    required this.sync,
    required this.photos,
    required this.owner,
    required this.draft,
  });
  final AppDatabase db;
  final SessionManager sessions;
  final SyncEngine sync;
  final PhotoStore photos;
  final String owner;
  final InspectionDraft draft;
  @override
  State<InspectionScreen> createState() => _InspectionScreenState();
}

class _InspectionScreenState extends State<InspectionScreen> {
  late final DraftEditor editor = DraftEditor(
    widget.db,
    widget.sessions,
    widget.owner,
    widget.draft,
  );
  int section = 0;
  bool cameraBusy = false, leaving = false;
  List<LocalPhoto> photos = [];
  bool get editable =>
      !editor.draft.finalized &&
      !editor.finalizing &&
      !cameraBusy &&
      widget.sessions.current?.owner == widget.owner &&
      widget.sessions.current!.editable(widget.sessions.now);
  @override
  void initState() {
    super.initState();
    editor.addListener(changed);
    loadPhotos();
  }

  @override
  void dispose() {
    editor.removeListener(changed);
    editor.dispose();
    super.dispose();
  }

  void changed() {
    if (mounted) setState(() {});
  }

  void showError(Object error) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          duration: const Duration(seconds: 10),
        ),
      );
    }
  }

  Future<void> loadPhotos() async {
    final result = await widget.db.photos(
      widget.owner,
      inspectionId: editor.draft.id,
    );
    if (mounted) setState(() => photos = result);
  }

  void edit(void Function(InspectionDraft) change) {
    try {
      editor.edit(change);
      widget.sync.start();
    } catch (e) {
      showError(e);
    }
  }

  Future<void> leave() async {
    if (cameraBusy || editor.finalizing) return;
    try {
      await editor.flush();
      if (mounted) {
        setState(() => leaving = true);
        Navigator.pop(context);
      }
    } catch (e) {
      showError(
        'Há alterações ainda não salvas. Use “Tentar salvar” antes de sair. $e',
      );
    }
  }

  Future<void> capture(String itemId) async {
    setState(() => cameraBusy = true);
    try {
      await editor.flush();
      await widget.sessions.assertEditable(widget.owner);
      final result = await CameraService(widget.db, widget.photos).capture(
        owner: widget.owner,
        inspectionId: editor.draft.id,
        itemId: itemId,
        authorize: () => widget.sessions.assertEditable(widget.owner),
      );
      for (final artifact in result.artifacts) {
        await editor.attach(artifact.metadata, artifact.filePath);
      }
      if (result.warning != null) showError(result.warning!);
      await loadPhotos();
      widget.sync.start();
    } catch (e) {
      showError(e);
    } finally {
      if (mounted) setState(() => cameraBusy = false);
    }
  }

  Future<void> annotate(LocalPhoto photo) async {
    final metadata = jsonDecode(photo.metadata) as Json;
    if (metadata['kind'] != 'Original') return;
    try {
      await editor.flush();
      if (!mounted) return;
      final bytes = await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => AnnotationScreen(file: File(photo.filePath)),
        ),
      );
      if (bytes == null) return;
      if (mounted) setState(() => cameraBusy = true);
      final artifact = await widget.photos.preserve(
        owner: widget.owner,
        inspectionId: editor.draft.id,
        itemId: metadata['itemId'] as String,
        bytes: bytes,
        kind: 'Annotation',
        originalPhotoId: photo.id,
      );
      await editor.attach(artifact.metadata, artifact.filePath);
      await loadPhotos();
      widget.sync.start();
    } catch (e) {
      showError(e);
    } finally {
      if (mounted) setState(() => cameraBusy = false);
    }
  }

  Future<void> finalize() async {
    final errors = editor.draft.validationErrors();
    if (errors.isNotEmpty) {
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Complete a inspeção'),
          content: SingleChildScrollView(child: Text(errors.join('\n\n'))),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Revisar itens'),
            ),
          ],
        ),
      );
      return;
    }
    final problems = (editor.draft.inspection['items'] as List)
        .where((a) => ['Attention', 'Repair', 'Critical'].contains(a['status']))
        .length;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Finalizar inspeção?'),
        content: Text(
          '$problems item(ns) requer(em) atenção.\n\nApós finalizar, este registro fica imutável. As fotos pendentes serão enviadas quando houver conexão.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Voltar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirmar finalização'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await editor.finalize();
        widget.sync.start();
      } catch (e) {
        showError(e);
      }
    }
  }

  Future<void> correction() async {
    var text = '';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const Text('Nova correção'),
        content: SizedBox(
          width: 480,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'A correção recebe um novo ID. O histórico original permanece intacto. Capture novas fotos nos itens que precisam de evidência atualizada.',
              ),
              const SizedBox(height: 20),
              TextField(
                onChanged: (value) => text = value,
                minLines: 2,
                maxLines: 4,
                maxLength: 1000,
                decoration: const InputDecoration(
                  labelText: 'Motivo da correção',
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
            child: const Text('Criar rascunho'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.sessions.assertEditable(widget.owner);
      final value = editor.draft.correction(
        const Uuid().v4(),
        widget.sessions.deviceId,
        text,
        widget.sessions.now,
      );
      await widget.db.saveDraft(widget.owner, value);
      widget.sync.start();
      if (mounted) {
        await Navigator.push(
          context,
          MaterialPageRoute<void>(
            builder: (_) => InspectionScreen(
              db: widget.db,
              sessions: widget.sessions,
              sync: widget.sync,
              photos: widget.photos,
              owner: widget.owner,
              draft: value,
            ),
          ),
        );
      }
    } catch (e) {
      showError(e);
    }
  }

  Future<void> sign() async {
    try {
      await editor.flush();
      if (!mounted) return;
      final bytes = await Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const SignatureScreen()),
      );
      if (bytes == null) return;
      if (mounted) setState(() => cameraBusy = true);
      final artifact = await widget.photos.preserve(
        owner: widget.owner,
        inspectionId: editor.draft.id,
        itemId: null,
        bytes: bytes,
        kind: 'Signature',
      );
      await editor.attach(artifact.metadata, artifact.filePath);
      await loadPhotos();
      widget.sync.start();
    } catch (e) {
      showError(e);
    } finally {
      if (mounted) setState(() => cameraBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final draft = editor.draft;
    final sections = (draft.template['sections'] as List).cast<Json>();
    final answered = (draft.inspection['items'] as List)
        .where((i) => statuses.containsKey(i['status']))
        .length;
    final total = draft.definitions.length;
    final body = ListView(
      key: const Key('inspection-scroll'),
      padding: const EdgeInsets.all(24),
      children: [
        Text(
          '${draft.vehicle['internalNumber']} • ${draft.vehicle['plate']}',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        Text('${draft.template['name']} • versão ${draft.template['version']}'),
        const SizedBox(height: 16),
        Wrap(
          spacing: 20,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SizedBox(
              width: 230,
              child: TextFormField(
                key: const Key('odometer'),
                initialValue:
                    draft.inputText('odometerKm') ??
                    '${draft.inspection['odometerKm'] ?? ''}',
                enabled: editable,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Quilometragem',
                  suffixText: 'km',
                ),
                onChanged: (text) => edit((d) => d.setOdometerText(text)),
              ),
            ),
            Text('$answered de $total itens respondidos'),
          ],
        ),
        const SizedBox(height: 16),
        LinearProgressIndicator(
          value: total == 0 ? 0 : answered / total,
          minHeight: 8,
          borderRadius: BorderRadius.circular(8),
        ),
        const SizedBox(height: 24),
        if (sections.isNotEmpty)
          Text(
            sections[section]['title'] as String,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
        const SizedBox(height: 16),
        if (sections.isNotEmpty)
          for (final item in (sections[section]['items'] as List).cast<Json>())
            itemCard(item),
        TextFormField(
          key: const Key('inspection-notes'),
          initialValue: draft.inspection['notes'] as String? ?? '',
          enabled: editable,
          minLines: 2,
          maxLines: 5,
          maxLength: 4000,
          decoration: const InputDecoration(labelText: 'Observações gerais'),
          onChanged: (text) => edit((d) => d.inspection['notes'] = text),
        ),
        const SizedBox(height: 32),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  draft.template['requiresSignature'] == true
                      ? 'Assinatura obrigatória'
                      : 'Assinatura opcional',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                if (draft.inspection['signaturePhotoId'] == null)
                  OutlinedButton.icon(
                    onPressed: editable ? sign : null,
                    icon: const Icon(Icons.draw_outlined),
                    label: const Text('Assinar inspeção'),
                  )
                else ...[
                  const Text('Assinatura preservada no tablet'),
                  for (final photo in photos.where(
                    (p) => p.id == draft.inspection['signaturePhotoId'],
                  ))
                    TextButton.icon(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) => PhotoViewer(
                            file: File(photo.filePath),
                            title: 'Assinatura preservada',
                          ),
                        ),
                      ),
                      icon: const Icon(Icons.visibility_outlined),
                      label: Text(
                        photo.uploaded
                            ? 'Ver assinatura • enviada'
                            : 'Ver assinatura • envio pendente',
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        if (draft.inspection['_recovery'] != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Cópia para revisão • origem ${(draft.inspection['_recovery'] as Json)['sourceId']}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const Text(
                    'A origem pode já constar no servidor. Consulte o histórico antes de finalizar para evitar registros duplicados. O original permanece preservado. Confira as fotos e obtenha nova assinatura quando aplicável.',
                  ),
                  if (((draft.inspection['_recovery']
                                  as Json)['photoCopyFailures']
                              as int? ??
                          0) >
                      0)
                    Text(
                      '${(draft.inspection['_recovery'] as Json)['photoCopyFailures']} foto(s) não copiadas. Revise os anexos; os originais permanecem na inspeção de origem.',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text(
                      'Conferi o histórico do servidor e revisei esta cópia',
                    ),
                    value:
                        (draft.inspection['_recovery']
                            as Json)['historyReviewed'] ==
                        true,
                    onChanged: editable
                        ? (value) => edit(
                            (d) =>
                                (d.inspection['_recovery']
                                        as Json)['historyReviewed'] =
                                    value == true,
                          )
                        : null,
                  ),
                ],
              ),
            ),
          ),
        if (!draft.finalized)
          FilledButton.icon(
            onPressed: editable ? finalize : null,
            icon: const Icon(Icons.verified_outlined),
            label: const Text('Finalizar inspeção'),
          ),
        if (draft.finalized)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'Inspeção finalizada e preservada. Consulte a fila para confirmar o envio das fotos.',
              ),
            ),
          ),
        if (draft.finalized &&
            widget.sessions.current?.editable(widget.sessions.now) == true)
          OutlinedButton.icon(
            onPressed: correction,
            icon: const Icon(Icons.note_add_outlined),
            label: const Text('Criar correção com histórico'),
          ),
        const SizedBox(height: 32),
      ],
    );
    return PopScope(
      canPop: leaving,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) leave();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            tooltip: 'Voltar após salvar',
            onPressed: leave,
            icon: const Icon(Icons.arrow_back),
          ),
          title: Text(
            draft.finalized ? 'Inspeção finalizada' : 'Inspeção em andamento',
          ),
        ),
        body: SafeArea(
          child: Column(
            children: [
              Container(
                width: double.infinity,
                color: editor.error != null
                    ? const Color(0xffffe1df)
                    : const Color(0xffdceee5),
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
                child: Wrap(
                  spacing: 16,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Icon(
                      editor.error != null
                          ? Icons.error_outline
                          : editor.saving
                          ? Icons.save_outlined
                          : Icons.check_circle_outline,
                    ),
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        editor.error ??
                            (editor.saving
                                ? 'Salvando no tablet…'
                                : cameraBusy
                                ? 'Preservando foto…'
                                : 'Salvo no tablet'),
                      ),
                    ),
                    if (editor.error != null)
                      OutlinedButton(
                        onPressed: () async {
                          try {
                            await editor.retry();
                          } catch (e) {
                            showError(e);
                          }
                        },
                        child: const Text('Tentar salvar'),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final navigation = [
                      for (var i = 0; i < sections.length; i++)
                        Padding(
                          padding: const EdgeInsets.all(6),
                          child: ChoiceChip(
                            showCheckmark: false,
                            selected: section == i,
                            label: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Text('${i + 1}. ${sections[i]['title']}'),
                            ),
                            onSelected: (_) => setState(() => section = i),
                          ),
                        ),
                    ];
                    return constraints.maxWidth >= 1000
                        ? Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              SizedBox(
                                width: 250,
                                child: ListView(
                                  padding: const EdgeInsets.all(12),
                                  children: navigation,
                                ),
                              ),
                              const VerticalDivider(width: 1),
                              Expanded(child: body),
                            ],
                          )
                        : Column(
                            children: [
                              SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: Row(children: navigation),
                              ),
                              Expanded(child: body),
                            ],
                          );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget itemCard(Json item) {
    final id = item['id'] as String,
        answer = editor.draft.answer(item['id'] as String);
    final statusError = answer?['status'] == null
        ? null
        : statusSelectionError(item, answer!['status']);
    final attached = photos
        .where((p) => (jsonDecode(p.metadata) as Json)['itemId'] == id)
        .toList();
    return Card(
      margin: const EdgeInsets.only(bottom: 20),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '${item['label']}',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            if (item['required'] == true)
              const Text(
                'Obrigatório',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: statusChoices(item).entries.map((status) {
                final colors = {
                  'OK': const Color(0xffd8eedf),
                  'Attention': const Color(0xffffe6ac),
                  'Repair': const Color(0xffffd2b6),
                  'Critical': const Color(0xffffbcb8),
                  'NotApplicable': const Color(0xffdce3e8),
                };
                return ChoiceChip(
                  key: Key('$id-${status.key}'),
                  selected: answer?['status'] == status.key,
                  selectedColor: colors[status.key],
                  label: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: 13,
                      horizontal: 5,
                    ),
                    child: Text(
                      status.value,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  onSelected: editable
                      ? (_) => edit((d) => d.setAnswer(id, status: status.key))
                      : null,
                );
              }).toList(),
            ),
            if (!editor.draft.finalized && statusError != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  statusError,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            if (item['responseType'] == 'measurement')
              Padding(
                padding: const EdgeInsets.only(top: 20),
                child: TextFormField(
                  key: Key('$id-measurement'),
                  initialValue:
                      editor.draft.inputText('measurement:$id') ??
                      answer?['value']?.toString() ??
                      '',
                  enabled: editable,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                    signed: true,
                  ),
                  decoration: InputDecoration(
                    labelText: 'Medição',
                    suffixText: item['unit'] as String?,
                    helperText:
                        'Faixa de entrada: ${item['minValue'] ?? '—'} a ${item['maxValue'] ?? '—'}',
                  ),
                  onChanged: (text) =>
                      edit((d) => d.setMeasurementText(id, text)),
                ),
              ),
            const SizedBox(height: 20),
            TextFormField(
              key: Key('$id-notes'),
              initialValue: answer?['notes'] as String? ?? '',
              enabled: editable,
              minLines: 1,
              maxLines: 4,
              maxLength: 2000,
              decoration: const InputDecoration(
                labelText: 'Observação do item',
              ),
              onChanged: (text) => edit((d) => d.setAnswer(id, notes: text)),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                for (final photo in attached)
                  SizedBox(
                    width: 160,
                    child: Column(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: GestureDetector(
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute<void>(
                                builder: (_) => PhotoViewer(
                                  file: File(photo.filePath),
                                  title: 'Foto da inspeção',
                                ),
                              ),
                            ),
                            child: Image.file(
                              File(photo.filePath),
                              width: 160,
                              height: 110,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => const SizedBox(
                                height: 110,
                                child: Center(
                                  child: Text('Arquivo indisponível'),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Text(
                          (jsonDecode(photo.metadata) as Json)['kind'] ==
                                  'Original'
                              ? 'Original'
                              : 'Cópia anotada',
                        ),
                        if (editable &&
                            (jsonDecode(photo.metadata) as Json)['kind'] ==
                                'Original')
                          TextButton.icon(
                            onPressed: () => annotate(photo),
                            icon: const Icon(Icons.draw_outlined),
                            label: const Text('Anotar'),
                          ),
                      ],
                    ),
                  ),
                if (editable)
                  OutlinedButton.icon(
                    onPressed: () => capture(id),
                    icon: const Icon(Icons.camera_alt_outlined),
                    label: const Text('Tirar foto'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
