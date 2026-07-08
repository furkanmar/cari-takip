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

  // Filtreler
  TransactionType? _filterType;
  DateTime? _filterStart;
  DateTime? _filterEnd;

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

  List<Transaction> get _filtered {
    return _transactions.where((tx) {
      if (_filterType != null && tx.type != _filterType) return false;
      if (_filterStart != null) {
        final d = DateTime.tryParse(tx.date);
        if (d == null || d.isBefore(_filterStart!)) return false;
      }
      if (_filterEnd != null) {
        final d = DateTime.tryParse(tx.date);
        if (d == null || d.isAfter(_filterEnd!.add(const Duration(days: 1)))) return false;
      }
      return true;
    }).toList();
  }

  bool get _hasFilter => _filterType != null || _filterStart != null || _filterEnd != null;

  void _clearFilters() => setState(() {
    _filterType = null;
    _filterStart = null;
    _filterEnd = null;
  });

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

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';

  Future<void> _pickDate({required bool isStart}) async {
    final d = await showDatePicker(
      context: context,
      initialDate: (isStart ? _filterStart : _filterEnd) ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (d != null) setState(() => isStart ? _filterStart = d : _filterEnd = d);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_company == null) return const Scaffold(body: Center(child: Text('Şirket bulunamadı')));

    final net = _company!.netBalance;
    final filtered = _filtered;

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
            SliverToBoxAdapter(child: _buildFilterBar()),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: Row(children: [
                  Text('İşlem Geçmişi (${filtered.length})',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
                  if (_hasFilter) ...[
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: _clearFilters,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(20)),
                        child: const Text('Temizle', style: TextStyle(color: Color(0xFF2563EB), fontSize: 11, fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ],
                ]),
              ),
            ),
            filtered.isEmpty
                ? SliverFillRemaining(
                    child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      const Text('📋', style: TextStyle(fontSize: 48)),
                      const SizedBox(height: 12),
                      Text(
                        _hasFilter ? 'Filtreye uygun işlem yok' : 'Henüz işlem eklenmedi',
                        style: const TextStyle(color: Color(0xFF64748B)),
                      ),
                    ])),
                  )
                : SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => _TransactionTile(
                        transaction: filtered[i],
                        onDelete: _deleteTransaction,
                        onEdit: _editTransaction,
                      ),
                      childCount: filtered.length,
                    ),
                  ),
            const SliverPadding(padding: EdgeInsets.only(bottom: 32)),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
      child: Column(children: [
        // Tür filtresi
        Row(children: [
          _FilterChip(label: 'Tümü', active: _filterType == null,
            onTap: () => setState(() => _filterType = null)),
          const SizedBox(width: 8),
          _FilterChip(label: 'Borç +', active: _filterType == TransactionType.receivable,
            activeColor: const Color(0xFFDC2626),
            onTap: () => setState(() => _filterType =
              _filterType == TransactionType.receivable ? null : TransactionType.receivable)),
          const SizedBox(width: 8),
          _FilterChip(label: 'Borç -', active: _filterType == TransactionType.payable,
            activeColor: const Color(0xFF059669),
            onTap: () => setState(() => _filterType =
              _filterType == TransactionType.payable ? null : TransactionType.payable)),
        ]),
        const SizedBox(height: 8),
        // Tarih aralığı
        Row(children: [
          Expanded(child: _DateFilterButton(
            label: 'Başlangıç',
            value: _filterStart != null ? _formatDate(_filterStart!) : null,
            onTap: () => _pickDate(isStart: true),
            onClear: _filterStart != null ? () => setState(() => _filterStart = null) : null,
          )),
          const SizedBox(width: 8),
          Expanded(child: _DateFilterButton(
            label: 'Bitiş',
            value: _filterEnd != null ? _formatDate(_filterEnd!) : null,
            onTap: () => _pickDate(isStart: false),
            onClear: _filterEnd != null ? () => setState(() => _filterEnd = null) : null,
          )),
        ]),
      ]),
    );
  }

  Widget _buildSummary(double net) {
    // net > 0 = biz borçluyuz = KIRMIZI
    final isDebt = net > 0;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(children: [
          Expanded(child: _Card(
            title: 'Borç +',
            value: formatMoney(_company!.totalReceivable),
            color: const Color(0xFFDC2626),
          )),
          const SizedBox(width: 12),
          Expanded(child: _Card(
            title: 'Borç -',
            value: formatMoney(_company!.totalPayable),
            color: const Color(0xFF059669),
          )),
        ]),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isDebt ? const Color(0xFFDC2626) : const Color(0xFF059669),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Net Borç', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(formatMoneyAbs(net), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
            ]),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(20)),
              child: Text(isDebt ? 'Borçlusun' : 'Kapatıldı',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12)),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool active;
  final Color activeColor;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.active, required this.onTap, this.activeColor = const Color(0xFF2563EB)});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: active ? activeColor : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: active ? activeColor : const Color(0xFFE2E8F0)),
      ),
      child: Text(label, style: TextStyle(
        color: active ? Colors.white : const Color(0xFF64748B),
        fontSize: 12, fontWeight: FontWeight.w600,
      )),
    ),
  );
}

class _DateFilterButton extends StatelessWidget {
  final String label;
  final String? value;
  final VoidCallback onTap;
  final VoidCallback? onClear;
  const _DateFilterButton({required this.label, this.value, required this.onTap, this.onClear});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: value != null ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0)),
      ),
      child: Row(children: [
        Icon(Icons.calendar_today_rounded, size: 13,
          color: value != null ? const Color(0xFF2563EB) : const Color(0xFF94A3B8)),
        const SizedBox(width: 6),
        Expanded(child: Text(
          value ?? label,
          style: TextStyle(
            fontSize: 12,
            color: value != null ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
            fontWeight: value != null ? FontWeight.w600 : FontWeight.normal,
          ),
        )),
        if (onClear != null)
          GestureDetector(
            onTap: onClear,
            child: const Icon(Icons.close_rounded, size: 14, color: Color(0xFF94A3B8)),
          ),
      ]),
    ),
  );
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
    // Borç+ (receivable) = kırmızı, Borç- (payable) = yeşil
    final isReceivable = transaction.type == TransactionType.receivable;
    final balance = transaction.runningBalance;

    // Running balance: > 0 borçluyuz = kırmızı, < 0 fazla ödedik = yeşil
    Color balanceColor;
    if (balance > 0) {
      balanceColor = const Color(0xFFDC2626);
    } else if (balance < 0) {
      balanceColor = const Color(0xFF059669);
    } else {
      balanceColor = const Color(0xFF94A3B8);
    }

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
                color: isReceivable ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isReceivable ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                color: isReceivable ? const Color(0xFFDC2626) : const Color(0xFF059669),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(transaction.description, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFF0F172A))),
              const SizedBox(height: 2),
              Row(children: [
                Text(transaction.date, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                if (transaction.dueDate != null) ...[
                  const Text(' · ', style: TextStyle(color: Color(0xFF94A3B8))),
                  Icon(Icons.schedule_rounded, size: 11,
                    color: transaction.isOverdue ? const Color(0xFFDC2626) : const Color(0xFF94A3B8)),
                  const SizedBox(width: 2),
                  Text(transaction.dueDate!,
                    style: TextStyle(fontSize: 11,
                      color: transaction.isOverdue ? const Color(0xFFDC2626) : const Color(0xFF94A3B8),
                      fontWeight: transaction.isOverdue ? FontWeight.w600 : FontWeight.normal)),
                ],
                if (transaction.invoiceFileName != null) ...[
                  const Text(' · ', style: TextStyle(color: Color(0xFF94A3B8))),
                  const Icon(Icons.attach_file_rounded, size: 12, color: Color(0xFF2563EB)),
                  Text(transaction.invoiceFileName!, style: const TextStyle(color: Color(0xFF2563EB), fontSize: 11)),
                ],
              ]),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(
                formatMoney(transaction.amount),
                style: TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 14,
                  color: isReceivable ? const Color(0xFFDC2626) : const Color(0xFF059669),
                ),
              ),
              Text(
                formatMoneyAbs(balance),
                style: TextStyle(fontSize: 11, color: balanceColor, fontWeight: FontWeight.w500),
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
