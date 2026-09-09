import 'package:flutter/material.dart';
import '../data/session.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.sessions});
  final SessionManager sessions;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late final TextEditingController server = TextEditingController(
    text: widget.sessions.server,
  );
  final username = TextEditingController(), password = TextEditingController();
  bool busy = false, visible = false;
  String? error;
  @override
  void dispose() {
    server.dispose();
    username.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> login() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.sessions.login(server.text, username.text, password.text);
      password.clear();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(
                  Icons.fact_check_outlined,
                  size: 64,
                  color: Color(0xff146655),
                ),
                const SizedBox(height: 20),
                Text(
                  'SUSUMU',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const Text(
                  'VEHICLE CHECK',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    letterSpacing: 3,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 32),
                const Text(
                  'Sua oficina, conectada.',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Entre online uma vez. Continue inspecionando sem Wi-Fi por até 72 horas.',
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: server,
                  enabled: !busy,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: 'Servidor HTTPS',
                    hintText: 'https://oficina.exemplo.jp',
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: username,
                  enabled: !busy,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: 'Usuário',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: password,
                  enabled: !busy,
                  obscureText: !visible,
                  autocorrect: false,
                  enableSuggestions: false,
                  onSubmitted: (_) => busy ? null : login(),
                  decoration: InputDecoration(
                    labelText: 'Senha',
                    prefixIcon: const Icon(Icons.key_outlined),
                    suffixIcon: IconButton(
                      tooltip: visible ? 'Ocultar senha' : 'Mostrar senha',
                      onPressed: () => setState(() => visible = !visible),
                      icon: Icon(
                        visible ? Icons.visibility_off : Icons.visibility,
                      ),
                    ),
                  ),
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Semantics(
                      liveRegion: true,
                      child: Text(
                        error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: busy ? null : login,
                  icon: busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.login),
                  label: Text(busy ? 'Entrando…' : 'Entrar na oficina'),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Os rascunhos deste tablet são preservados ao sair da conta.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
