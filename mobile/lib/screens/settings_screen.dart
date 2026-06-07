import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/api_client.dart';
import '../providers/auth_provider.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  // Profil
  final _profileKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _emailCtrl;
  final _profilePwdCtrl = TextEditingController();
  bool _profileSaving = false;
  String? _profileError;
  String? _profileSuccess;

  // Şifre
  final _pwdKey = GlobalKey<FormState>();
  final _currentPwdCtrl = TextEditingController();
  final _newPwdCtrl = TextEditingController();
  final _confirmPwdCtrl = TextEditingController();
  bool _pwdSaving = false;
  String? _pwdError;
  String? _pwdSuccess;

  Map<String, dynamic>? _user;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController();
    _emailCtrl = TextEditingController();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final res = await apiClient.get('/users/me');
      _user = res.data as Map<String, dynamic>;
      _nameCtrl.text = _user!['fullName'] ?? '';
      _emailCtrl.text = _user!['email'] ?? '';
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _profilePwdCtrl.dispose();
    _currentPwdCtrl.dispose();
    _newPwdCtrl.dispose();
    _confirmPwdCtrl.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    if (!_profileKey.currentState!.validate()) return;
    setState(() { _profileSaving = true; _profileError = null; _profileSuccess = null; });
    try {
      final emailChanged = _emailCtrl.text.trim().toLowerCase() != _user?['email'];
      await apiClient.put('/users/me', data: {
        'fullName': _nameCtrl.text.trim(),
        if (emailChanged) 'email': _emailCtrl.text.trim().toLowerCase(),
        if (emailChanged && _profilePwdCtrl.text.isNotEmpty) 'currentPassword': _profilePwdCtrl.text,
      });
      _profilePwdCtrl.clear();
      await _loadProfile();
      setState(() => _profileSuccess = 'Profil güncellendi.');
    } catch (e) {
      setState(() => _profileError = _extractError(e));
    } finally {
      if (mounted) setState(() => _profileSaving = false);
    }
  }

  Future<void> _savePassword() async {
    if (!_pwdKey.currentState!.validate()) return;
    if (_newPwdCtrl.text != _confirmPwdCtrl.text) {
      setState(() => _pwdError = 'Yeni şifreler eşleşmiyor.');
      return;
    }
    setState(() { _pwdSaving = true; _pwdError = null; _pwdSuccess = null; });
    try {
      await apiClient.put('/users/me', data: {
        'currentPassword': _currentPwdCtrl.text,
        'newPassword': _newPwdCtrl.text,
      });
      _currentPwdCtrl.clear();
      _newPwdCtrl.clear();
      _confirmPwdCtrl.clear();
      setState(() => _pwdSuccess = 'Şifre güncellendi.');
    } catch (e) {
      setState(() => _pwdError = _extractError(e));
    } finally {
      if (mounted) setState(() => _pwdSaving = false);
    }
  }

  String _extractError(dynamic e) {
    try {
      final data = (e as dynamic).response?.data;
      if (data is Map) {
        final msg = data['message'];
        if (msg is List) return msg.join(', ');
        if (msg is String) return msg;
      }
    } catch (_) {}
    return 'Hata oluştu. Tekrar deneyin.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ayarlar', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          TextButton.icon(
            onPressed: () async {
              await context.read<AuthProvider>().logout();
              if (mounted) Navigator.pushAndRemoveUntil(
                context, MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
            },
            icon: const Icon(Icons.logout_rounded, size: 16, color: Color(0xFFDC2626)),
            label: const Text('Çıkış', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildSection(
                  title: 'Profil Bilgileri',
                  child: Form(
                    key: _profileKey,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      if (_profileSuccess != null) _successBanner(_profileSuccess!),
                      if (_profileError != null) _errorBanner(_profileError!),
                      TextFormField(
                        controller: _nameCtrl,
                        decoration: const InputDecoration(labelText: 'Ad Soyad'),
                        validator: (v) => v!.trim().isEmpty ? 'Ad Soyad gerekli' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(labelText: 'E-posta'),
                        validator: (v) => v!.trim().isEmpty ? 'E-posta gerekli' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _profilePwdCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Mevcut Şifre',
                          hintText: 'E-posta değişikliği için gerekli',
                        ),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _profileSaving ? null : _saveProfile,
                        child: _profileSaving
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('Güncelle'),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 16),
                _buildSection(
                  title: 'Şifre Değiştir',
                  child: Form(
                    key: _pwdKey,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      if (_pwdSuccess != null) _successBanner(_pwdSuccess!),
                      if (_pwdError != null) _errorBanner(_pwdError!),
                      TextFormField(
                        controller: _currentPwdCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Mevcut Şifre'),
                        validator: (v) => v!.isEmpty ? 'Mevcut şifre gerekli' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _newPwdCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Yeni Şifre'),
                        validator: (v) => v!.length < 6 ? 'En az 6 karakter' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _confirmPwdCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Yeni Şifre (Tekrar)'),
                        validator: (v) => v!.isEmpty ? 'Şifre tekrarı gerekli' : null,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _pwdSaving ? null : _savePassword,
                        child: _pwdSaving
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('Şifreyi Güncelle'),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
    );
  }

  Widget _buildSection({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
        const SizedBox(height: 16),
        child,
      ]),
    );
  }

  Widget _successBanner(String text) => Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(10)),
    child: Text(text, style: const TextStyle(color: Color(0xFF059669), fontSize: 13)),
  );

  Widget _errorBanner(String text) => Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10)),
    child: Text(text, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
  );
}
