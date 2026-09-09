import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'data/database.dart';
import 'data/photos.dart';
import 'data/session.dart';
import 'data/sync.dart';
import 'screens/home.dart';
import 'screens/login.dart';

class SusumuApp extends StatelessWidget {
  const SusumuApp({
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
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: sessions,
    builder: (context, _) => MaterialApp(
      key: ValueKey(sessions.generation),
      debugShowCheckedModeBanner: false,
      title: 'Susumu Vehicle Check',
      locale: const Locale('pt', 'BR'),
      supportedLocales: const [Locale('pt', 'BR')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: ThemeData(
        fontFamily: 'Roboto',
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xff146655),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xfff2f4f1),
        textTheme: const TextTheme(
          headlineLarge: TextStyle(fontSize: 34, fontWeight: FontWeight.w800),
          headlineSmall: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
          bodyLarge: TextStyle(fontSize: 18),
          bodyMedium: TextStyle(fontSize: 16),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xff102f2b),
          foregroundColor: Colors.white,
          toolbarHeight: 80,
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            minimumSize: const Size(56, 56),
            textStyle: const TextStyle(
              fontFamily: 'Roboto',
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(minimumSize: const Size(56, 56)),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          contentPadding: const EdgeInsets.all(18),
        ),
      ),
      home: sessions.current == null
          ? LoginScreen(sessions: sessions)
          : HomeScreen(db: db, sessions: sessions, sync: sync, photos: photos),
    ),
  );
}
