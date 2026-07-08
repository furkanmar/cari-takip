class Company {
  final String id;
  final String name;
  final String? taxNumber;
  final String? phone;
  final String? email;
  final String? address;
  final double totalReceivable;
  final double totalPayable;
  final bool isArchived;

  Company({
    required this.id,
    required this.name,
    this.taxNumber,
    this.phone,
    this.email,
    this.address,
    required this.totalReceivable,
    required this.totalPayable,
    this.isArchived = false,
  });

  // net > 0 = biz borçluyuz
  double get netBalance => totalReceivable - totalPayable;

  factory Company.fromJson(Map<String, dynamic> json) => Company(
        id: json['id'],
        name: json['name'],
        taxNumber: json['taxNumber'],
        phone: json['phone'],
        email: json['email'],
        address: json['address'],
        totalReceivable: double.tryParse(json['totalReceivable'].toString()) ?? 0,
        totalPayable: double.tryParse(json['totalPayable'].toString()) ?? 0,
        isArchived: json['isArchived'] == true,
      );
}
