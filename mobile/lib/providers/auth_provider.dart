import 'package:flutter/material.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final _service = AuthService();
  Map<String, dynamic>? user;
  bool loading = false;

  Future<bool> checkLogin() async => _service.isLoggedIn();

  Future<void> login(String email, String password) async {
    await _service.login(email, password);
    await _loadProfile();
  }

  Future<void> register(String fullName, String email, String password) async {
    await _service.register(fullName, email, password);
    await _loadProfile();
  }

  Future<void> logout() async {
    await _service.logout();
    user = null;
    notifyListeners();
  }

  Future<void> _loadProfile() async {
    user = await _service.getProfile();
    notifyListeners();
  }
}
