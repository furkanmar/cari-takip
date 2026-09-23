import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'constants.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;

  ApiClient._internal() {
    dio = Dio(BaseOptions(
      baseUrl: kApiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      contentType: 'application/json',
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('accessToken');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Aynı anda 401 alan birden çok istek tek bir refresh'i paylaşır.
          // Backend refresh token'ı her kullanımda döndürdüğü (rotasyon) için
          // aynı token'la iki paralel refresh, ikincisinin reddedilmesine ve
          // kullanıcının çıkış yaptırılmasına yol açardı.
          _refreshing ??=
              _refreshAccessToken().whenComplete(() => _refreshing = null);
          final newAccess = await _refreshing;
          if (newAccess != null) {
            try {
              final opts = error.requestOptions;
              opts.headers['Authorization'] = 'Bearer $newAccess';
              final retryRes = await dio.fetch(opts);
              return handler.resolve(retryRes);
            } on DioException catch (e) {
              return handler.next(e);
            }
          }
        }
        handler.next(error);
      },
    ));
  }

  Future<String?>? _refreshing;

  /// Yeni access token döner; refresh başarısızsa token'ları temizleyip null döner.
  Future<String?> _refreshAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString('userId');
    final refreshToken = prefs.getString('refreshToken');
    if (userId == null || refreshToken == null) return null;

    try {
      // Refresh isteği için yeni Dio örneği kullan (sonsuz döngüyü önler)
      final refreshDio = Dio(BaseOptions(
        baseUrl: kApiBaseUrl,
        contentType: 'application/json',
      ));
      final res = await refreshDio.post('/auth/refresh', data: {
        'userId': userId,
        'refreshToken': refreshToken,
      });

      final newAccess = res.data['accessToken'] as String;
      final newRefresh = res.data['refreshToken'] as String;
      await prefs.setString('accessToken', newAccess);
      await prefs.setString('refreshToken', newRefresh);
      return newAccess;
    } catch (_) {
      // Refresh da başarısız — token'ları temizle
      await prefs.remove('accessToken');
      await prefs.remove('refreshToken');
      await prefs.remove('userId');
      return null;
    }
  }
}

final apiClient = ApiClient().dio;
