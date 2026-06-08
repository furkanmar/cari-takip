enum TransactionType { receivable, payable }

class Transaction {
  final String id;
  final String companyId;
  final String date;
  final String? dueDate;
  final String description;
  final TransactionType type;
  final double amount;
  final double runningBalance;
  final String? invoiceUrl;
  final String? invoiceFileName;

  Transaction({
    required this.id,
    required this.companyId,
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

  factory Transaction.fromJson(Map<String, dynamic> json) => Transaction(
        id: json['id'],
        companyId: json['companyId'],
        date: json['date'],
        dueDate: json['dueDate'],
        description: json['description'],
        type: json['type'] == 'receivable'
            ? TransactionType.receivable
            : TransactionType.payable,
        amount: double.tryParse(json['amount'].toString()) ?? 0,
        runningBalance: double.tryParse(json['runningBalance'].toString()) ?? 0,
        invoiceUrl: json['invoiceUrl'],
        invoiceFileName: json['invoiceFileName'],
      );
}
