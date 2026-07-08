enum BalanceEntryType { received, paid }

class BalanceEntry {
  final String id;
  final String date;
  final String? dueDate;
  final String description;
  final BalanceEntryType type;
  final double amount;
  final double runningBalance;
  final String? invoiceUrl;
  final String? invoiceFileName;

  BalanceEntry({
    required this.id,
    required this.date,
    this.dueDate,
    required this.description,
    required this.type,
    required this.amount,
    required this.runningBalance,
    this.invoiceUrl,
    this.invoiceFileName,
  });

  bool get isOverdue {
    if (dueDate == null) return false;
    return dueDate!.compareTo(DateTime.now().toIso8601String().split('T')[0]) < 0;
  }

  factory BalanceEntry.fromJson(Map<String, dynamic> json) => BalanceEntry(
        id: json['id'],
        date: json['date'],
        dueDate: json['dueDate'],
        description: json['description'],
        type: json['type'] == 'received' ? BalanceEntryType.received : BalanceEntryType.paid,
        amount: double.tryParse(json['amount'].toString()) ?? 0,
        runningBalance: double.tryParse(json['runningBalance'].toString()) ?? 0,
        invoiceUrl: json['invoiceUrl'],
        invoiceFileName: json['invoiceFileName'],
      );
}
