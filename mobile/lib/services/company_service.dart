import '../core/api_client.dart';
import '../models/company.dart';

class CompanyService {
  Future<List<Company>> getAll() async {
    final res = await apiClient.get('/companies');
    return (res.data as List).map((e) => Company.fromJson(e)).toList();
  }

  Future<Company> getOne(String id) async {
    final res = await apiClient.get('/companies/$id');
    return Company.fromJson(res.data);
  }

  Future<Company> create({
    required String name,
    String? taxNumber,
    String? phone,
    String? email,
    String? address,
  }) async {
    final res = await apiClient.post('/companies', data: {
      'name': name,
      if (taxNumber != null && taxNumber.isNotEmpty) 'taxNumber': taxNumber,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      if (email != null && email.isNotEmpty) 'email': email,
      if (address != null && address.isNotEmpty) 'address': address,
    });
    return Company.fromJson(res.data);
  }

  Future<Company> update({
    required String id,
    required String name,
    String? taxNumber,
    String? phone,
    String? email,
    String? address,
  }) async {
    final res = await apiClient.put('/companies/$id', data: {
      'name': name,
      if (taxNumber != null && taxNumber.isNotEmpty) 'taxNumber': taxNumber,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      if (email != null && email.isNotEmpty) 'email': email,
      if (address != null && address.isNotEmpty) 'address': address,
    });
    return Company.fromJson(res.data);
  }

  Future<void> delete(String id) async {
    await apiClient.delete('/companies/$id');
  }
}
