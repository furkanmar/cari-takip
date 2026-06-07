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
  }

  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('accessToken') != null;
  }

  Future<Map<String, dynamic>> getProfile() async {
    final res = await apiClient.get('/users/me');
    return res.data;
  }

  Future<void> _saveTokens(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', data['accessToken']);
    await prefs.setString('refreshToken', data['refreshToken']);
  }
}
