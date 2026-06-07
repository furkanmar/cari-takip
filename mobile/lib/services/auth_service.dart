import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/api_client.dart';

class AuthService {
  Future<void> login(String email, String password) async {
    final res = await apiClient.post('/auth/login', data: {
      'email': email.trim().toLowerCase(),
      'password': password,
    });
    await _saveTokens(res.data);
  }

  Future<void> register(String fullName, String email, String password) async {
    final res = await apiClient.post('/auth/register', data: {
      'fullName': fullName.trim(),
      'email': email.trim().toLowerCase(),
      'password': password,
    });
    await _saveTokens(res.data);
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accessToken');
    await prefs.remove('refreshToken');
    await prefs.remove('userId');
  }

  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('accessToken') != null;
  }

  Future<Map<String, dynamic>> getProfile() async {
    final res = await apiClient.get('/users/me');
    return res.data;
  }

  Future<Map<String, dynamic>> refreshTokens() async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString('userId');
    final refreshToken = prefs.getString('refreshToken');
    if (userId == null || refreshToken == null) throw Exception('No refresh token');
    final res = await apiClient.post('/auth/refresh', data: {
      'userId': userId,
      'refreshToken': refreshToken,
    });
    await _saveTokens(res.data);
    return res.data;
  }

  Future<void> _saveTokens(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', data['accessToken']);
    await prefs.setString('refreshToken', data['refreshToken']);
    // JWT payload'dan userId (sub) çıkar
    final userId = _decodeJwtSub(data['accessToken']);
    if (userId != null) await prefs.setString('userId', userId);
  }

  String? _decodeJwtSub(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload = parts[1];
      // Base64 padding düzelt
      final normalized = base64Url.normalize(payload);
      final decoded = utf8.decode(base64Url.decode(normalized));
      final map = jsonDecode(decoded) as Map<String, dynamic>;
      return map['sub']?.toString();
    } catch (_) {
      return null;
    }
  }
}
