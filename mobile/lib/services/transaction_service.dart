import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../models/transaction.dart';

class TransactionService {
  Future<List<Transaction>> getAll(String companyId) async {
    final res = await apiClient.get('/transactions', queryParameters: {'companyId': companyId});
    return (res.data as List).map((e) => Transaction.fromJson(e)).toList();
  }

  Future<Transaction> create({
    required String companyId,
    required String date,
    required String description,
    required TransactionType type,
    required double amount,
    String? invoicePath,
    String? invoiceName,
  }) async {
    final formData = FormData.fromMap({
      'companyId': companyId,
      'date': date,
      'description': description,
      'type': type == TransactionType.receivable ? 'receivable' : 'payable',
      'amount': amount.toString(),
      if (invoicePath != null)
        'invoice': await MultipartFile.fromFile(invoicePath, filename: invoiceName),
    });

    final res = await apiClient.post(
      '/transactions',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
    return Transaction.fromJson(res.data);
  }

  Future<Transaction> update({
    required String id,
    required String date,
    required String description,
    required TransactionType type,
    required double amount,
  }) async {
    final res = await apiClient.put('/transactions/$id', data: {
      'date': date,
      'description': description,
      'type': type == TransactionType.receivable ? 'receivable' : 'payable',
      'amount': amount,
    });
    return Transaction.fromJson(res.data);
  }

  Future<void> delete(String id) async {
    await apiClient.delete('/transactions/$id');
  }
}
