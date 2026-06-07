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
          // Refresh token dene
          try {
            final prefs = await SharedPreferences.getInstance();
            final userId = prefs.getString('userId');
            final refreshToken = prefs.getString('refreshToken');

            if (userId != null && refreshToken != null) {
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

              // Orijinal isteği yeni token ile tekrarla
              final opts = error.requestOptions;
              opts.headers['Authorization'] = 'Bearer $newAccess';
              final retryRes = await dio.fetch(opts);
              return handler.resolve(retryRes);
            }
          } catch (_) {
            // Refresh da başarısız — token'ları temizle
            final prefs = await SharedPreferences.getInstance();
            await prefs.remove('accessToken');
            await prefs.remove('refreshToken');
            await prefs.remove('userId');
          }
        }
        handler.next(error);
      },
    ));
  }
}

final apiClient = ApiClient().dio;
