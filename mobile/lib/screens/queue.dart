import 'package:flutter/material.dart';
import 'dart:convert';
import '../domain.dart';
import '../data/database.dart';
import '../data/session.dart';
import '../data/sync.dart';
import '../data/photos.dart';
import '../data/review_copy.dart';
import 'inspection.dart';
import 'retained_work.dart';

class QueueScreen extends StatefulWidget {
  const QueueScreen({
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
  State<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends State<QueueScreen> {
  AppDatabase get db => widget.db;
  SessionManager get sessions => widget.sessions;
  SyncEngine get sync => widget.sync;
  bool creating = false;
  Future<void> reviewCopy(String id) async {
    final owner = sessions.current?.owner;
    if (creating || owner == null) return;
    var text = '';
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const Text('Criar cópia para revisão'),
        content: SizedBox(
          width: 500,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'A inspeção original e sua operação rejeitada serão preservadas. A cópia terá outro ID e exigirá nova assinatura. Confira o histórico do servidor: a origem pode já ter sido recebida. Esta ação não é uma correção aceita pelo servidor.',
              ),
              const SizedBox(height: 20),
              TextField(
                onChanged: (value) => text = value,
                maxLength: 1000,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Motivo da revisão',
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
            child: const Text('Criar cópia editável'),
          ),
        ],
      ),
    );
    if (accepted != true || !mounted || sessions.current?.owner != owner) {
      return;
    }
    setState(() => creating = true);
    try {
      final result = await ReviewCopyService(
        db,
        sessions,
        widget.photos,
      ).create(id, text);
      if (!mounted || sessions.current?.owner != owner) return;
      if (result.photoFailures > 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '${result.photoFailures} foto(s) não copiadas. Os originais foram preservados; revise os anexos.',
            ),
          ),
        );
      }
      await Navigator.push(
        context,
        MaterialPageRoute<void>(
          builder: (_) => InspectionScreen(
            db: db,
            sessions: sessions,
            sync: sync,
            photos: widget.photos,
            owner: owner,
            draft: result.draft,
          ),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final owner = sessions.current?.owner;
    if (owner == null) return const Scaffold(body: SizedBox.shrink());
    return AnimatedBuilder(
      animation: sync,
      builder: (context, _) => Scaffold(
        appBar: AppBar(title: const Text('Sincronização')),
        body: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            RetainedWorkNotice(db: db, owner: owner),
            Text(
              sync.message,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: sync.running ? null : sync.run,
              icon: const Icon(Icons.sync),
              label: const Text('Tentar sincronizar agora'),
            ),
            const SizedBox(height: 24),
            const Text(
              'Conflitos bloqueiam somente a inspeção correspondente. Outros envios continuam. A operação original permanece preservada; uma cópia permite revisar os dados com outro ID.',
            ),
            const SizedBox(height: 16),
            FutureBuilder<List<PendingOperation>>(
              future: db.queue(owner),
              builder: (context, snapshot) {
                if (snapshot.hasError) return Text('${snapshot.error}');
                if (!snapshot.hasData) return const LinearProgressIndicator();
                return Column(
                  children: [
                    if (snapshot.data!.isEmpty)
                      const ListTile(
                        leading: Icon(Icons.check_circle_outline),
                        title: Text('Nenhuma inspeção pendente'),
                      ),
                    for (final row in snapshot.data!)
                      Card(
                        child: ListTile(
                          isThreeLine: true,
                          leading: Icon(
                            row.blocked
                                ? Icons.report_problem_outlined
                                : Icons.schedule,
                          ),
                          title: Text(
                            row.blocked
                                ? 'Revisão necessária'
                                : 'Aguardando envio',
                          ),
                          subtitle: Text(
                            'Inspeção ${row.inspectionId}\nTentativas: ${row.attempts}\n${pendingInputReason((jsonDecode(row.payload) as Json)['inspection'] as Json) ?? row.error ?? ''}',
                          ),
                          trailing:
                              row.blocked &&
                                  sessions.current?.editable(sessions.now) ==
                                      true
                              ? IconButton(
                                  tooltip: 'Criar cópia para revisão',
                                  onPressed: creating
                                      ? null
                                      : () => reviewCopy(row.inspectionId),
                                  icon: const Icon(Icons.copy_outlined),
                                )
                              : null,
                        ),
                      ),
                  ],
                );
              },
            ),
            const SizedBox(height: 24),
            Text('Fotos', style: Theme.of(context).textTheme.headlineSmall),
            FutureBuilder<List<LocalPhoto>>(
              future: db.photos(owner),
              builder: (context, snapshot) => Column(
                children: [
                  for (final row in snapshot.data ?? <LocalPhoto>[])
                    ListTile(
                      leading: Icon(
                        row.uploaded
                            ? Icons.cloud_done
                            : Icons.cloud_upload_outlined,
                      ),
                      title: Text(
                        row.uploaded
                            ? '${(jsonDecode(row.metadata) as Json)['kind'] == 'Signature' ? 'Assinatura' : 'Foto'} verificada no servidor'
                            : '${(jsonDecode(row.metadata) as Json)['kind'] == 'Signature' ? 'Assinatura' : 'Foto'} pendente',
                      ),
                      subtitle: Text('${row.id}\n${row.error ?? ''}'),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
