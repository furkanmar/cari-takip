import 'package:flutter/material.dart';
import '../models/company.dart';
import '../models/transaction.dart';
import '../services/company_service.dart';
import '../services/transaction_service.dart';
import '../core/formatters.dart';
import 'add_transaction_sheet.dart';

class CompanyDetailScreen extends StatefulWidget {
  final String companyId;
  const CompanyDetailScreen({super.key, required this.companyId});

  @override
  State<CompanyDetailScreen> createState() => _CompanyDetailScreenState();
}

class _CompanyDetailScreenState extends State<CompanyDetailScreen> {
  final _companyService = CompanyService();
  final _txService = TransactionService();
  Company? _company;
  List<Transaction> _transactions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _companyService.getOne(widget.companyId),
        _txService.getAll(widget.companyId),
      ]);
      _company = results[0] as Company;
      _transactions = results[1] as List<Transaction>;
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _editTransaction(Transaction tx) async {
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AddTransactionSheet(companyId: widget.companyId, existing: tx),
    );
    if (updated == true) _load();
  }

  Future<void> _deleteTransaction(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('İşlemi Sil'),
        content: const Text('Bu işlemi silmek istediğinize emin misiniz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('İptal')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Sil', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      await _txService.delete(id);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_company == null) return const Scaffold(body: Center(child: Text('Şirket bulunamadı')));

    final net = _company!.netBalance;

    return Scaffold(
      appBar: AppBar(
        title: Text(_company!.name, style: const TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton.icon(
              onPressed: () async {
                final added = await showModalBottomSheet<bool>(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => AddTransactionSheet(companyId: widget.companyId),
                );
                if (added == true) _load();
              },
              icon: const Icon(Icons.add, size: 18),
              label: const Text('İşlem', style: TextStyle(fontWeight: FontWeight.w600)),
              style: TextButton.styleFrom(foregroundColor: const Color(0xFF2563EB)),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _buildSummary(net)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Text('İşlem Geçmişi (${_transactions.length})',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
              ),
            ),
            _transactions.isEmpty
                ? SliverFillRemaining(
                    child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      const Text('📋', style: TextStyle(fontSize: 48)),
                      const SizedBox(height: 12),
                      const Text('Henüz işlem eklenmedi', style: TextStyle(color: Color(0xFF64748B))),
                    ])),
                  )
                : SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => _TransactionTile(
                        transaction: _transactions[i],
                        onDelete: _deleteTransaction,
                        onEdit: _editTransaction,
                      ),
                      childCount: _transactions.length,
                    ),
                  ),
            const SliverPadding(padding: EdgeInsets.only(bottom: 32)),
          ],
        ),
      ),
    );
  }

  Widget _buildSummary(double net) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(children: [
          Expanded(child: _Card(title: 'Alacak', value: formatMoney(_company!.totalReceivable), color: const Color(0xFF059669))),
          const SizedBox(width: 12),
          Expanded(child: _Card(title: 'Verecek', value: formatMoney(_company!.totalPayable), color: const Color(0xFFDC2626))),
        ]),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: net >= 0 ? const Color(0xFF2563EB) : const Color(0xFFDC2626),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Net Bakiye', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(formatMoneyAbs(net), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
            ]),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(20)),
              child: Text(net >= 0 ? 'Alacaklısın' : 'Vereceksin', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12)),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _Card extends StatelessWidget {
  final String title, value;
  final Color color;
  const _Card({required this.title, required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w600)),
      const SizedBox(height: 6),
      Text(value, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.bold)),
    ]),
  );
}

class _TransactionTile extends StatelessWidget {
  final Transaction transaction;
  final Function(String) onDelete;
  final Function(Transaction) onEdit;
  const _TransactionTile({required this.transaction, required this.onDelete, required this.onEdit});

  @override
  Widget build(BuildContext context) {
    final isReceivable = transaction.type == TransactionType.receivable;
    final balance = transaction.runningBalance;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: isReceivable ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isReceivable ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                color: isReceivable ? const Color(0xFF059669) : const Color(0xFFDC2626),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(transaction.description, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFF0F172A))),
              const SizedBox(height: 2),
              Row(children: [
                Text(transaction.date, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                if (transaction.invoiceFileName != null) ...[
                  const Text(' · ', style: TextStyle(color: Color(0xFF94A3B8))),
                  const Icon(Icons.attach_file_rounded, size: 12, color: Color(0xFF2563EB)),
                  Text(transaction.invoiceFileName!, style: const TextStyle(color: Color(0xFF2563EB), fontSize: 11)),
                ],
              ]),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(
                '${isReceivable ? '+' : '-'}${formatMoney(transaction.amount)}',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: isReceivable ? const Color(0xFF059669) : const Color(0xFFDC2626)),
              ),
              Text(
                formatMoney(balance),
                style: TextStyle(fontSize: 11, color: balance >= 0 ? const Color(0xFF2563EB) : const Color(0xFFDC2626), fontWeight: FontWeight.w500),
              ),
            ]),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: () => onEdit(transaction),
              child: const Icon(Icons.edit_outlined, color: Color(0xFFCBD5E1), size: 20),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => onDelete(transaction.id),
              child: const Icon(Icons.delete_outline_rounded, color: Color(0xFFCBD5E1), size: 20),
            ),
          ]),
        ),
      ),
    );
  }
}
