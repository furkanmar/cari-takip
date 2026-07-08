import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../models/balance_entry.dart';

class BalanceService {
  Future<List<BalanceEntry>> getAll() async {
    final res = await apiClient.get('/balance');
    return (res.data as List).map((e) => BalanceEntry.fromJson(e)).toList();
  }

  Future<BalanceEntry> create({
    required String date,
    String? dueDate,
    required String description,
    required BalanceEntryType type,
    required double amount,
    String? invoicePath,
    String? invoiceName,
  }) async {
    final formData = FormData.fromMap({
      'date': date,
      if (dueDate != null && dueDate.isNotEmpty) 'dueDate': dueDate,
      'description': description,
      'type': type == BalanceEntryType.received ? 'received' : 'paid',
      'amount': amount.toString(),
      if (invoicePath != null)
        'invoice': await MultipartFile.fromFile(invoicePath, filename: invoiceName),
    });

    final res = await apiClient.post(
      '/balance',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
    return BalanceEntry.fromJson(res.data);
  }

  Future<BalanceEntry> update({
    required String id,
    required String date,
    String? dueDate,
    required String description,
    required BalanceEntryType type,
    required double amount,
  }) async {
    final res = await apiClient.put('/balance/$id', data: {
      'date': date,
      if (dueDate != null && dueDate.isNotEmpty) 'dueDate': dueDate,
      'description': description,
      'type': type == BalanceEntryType.received ? 'received' : 'paid',
      'amount': amount,
    });
    return BalanceEntry.fromJson(res.data);
  }

  Future<void> delete(String id) async {
    await apiClient.delete('/balance/$id');
  }
}
