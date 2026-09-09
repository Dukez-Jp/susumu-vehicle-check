import 'package:flutter/material.dart';
import '../data/database.dart';

class RetainedWorkNotice extends StatelessWidget {
  const RetainedWorkNotice({super.key, required this.db, required this.owner});
  final AppDatabase db;
  final String owner;
  @override
  Widget build(BuildContext context) => FutureBuilder<bool>(
    future: db.hasOtherSessionWork(owner),
    builder: (context, snapshot) => snapshot.data == true
        ? const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Este tablet também guarda registros de outra sessão ou servidor. Entre nessa sessão ou contate o suporte antes de limpar dados.',
              ),
            ),
          )
        : const SizedBox.shrink(),
  );
}
