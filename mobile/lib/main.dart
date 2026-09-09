import 'dart:io';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import 'app.dart';
import 'data/database.dart';
import 'data/photos.dart';
import 'data/session.dart';
import 'data/sync.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    final directory = await getApplicationSupportDirectory();
    final db = AppDatabase(
      NativeDatabase.createInBackground(
        File(path.join(directory.path, 'susumu-v1.sqlite')),
      ),
    );
    final sessions = SessionManager(db, AndroidSecretStore());
    await sessions.restore();
    final photos = PhotoStore(Directory(path.join(directory.path, 'photos')));
    final sync = SyncEngine(db, sessions);
    sessions.addListener(sync.start);
    sync.start();
    runApp(SusumuApp(db: db, sessions: sessions, sync: sync, photos: photos));
  } catch (error) {
    runApp(
      MaterialApp(
        home: Scaffold(
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.storage, size: 64),
                  const SizedBox(height: 24),
                  const Text(
                    'Não foi possível abrir o armazenamento seguro.',
                    style: TextStyle(fontSize: 24),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Libere espaço ou contate o suporte. Não desinstale o aplicativo nem limpe seus dados; existem registros que precisam ser preservados.',
                  ),
                  const SizedBox(height: 16),
                  Text('$error'),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
