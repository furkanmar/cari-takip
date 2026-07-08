import 'package:flutter/material.dart';
import '../models/balance_entry.dart';
import '../models/company.dart';
import '../services/balance_service.dart';
import '../services/company_service.dart';
import '../core/formatters.dart';
import 'add_balance_entry_sheet.dart';

class BalanceScreen extends StatefulWidget {
  const BalanceScreen({super.key});

  @override
  State<BalanceScreen> createState() => _BalanceScreenState();
}

class _BalanceScreenState extends State<BalanceScreen> {
  final _balanceService = BalanceService();
  final _companyService = CompanyService();
  List<BalanceEntry> _entries = [];
  List<Company> _companies = [];
  bool _loading = true;

  // Filtreler
  BalanceEntryType? _filterType;
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
        _balanceService.getAll(),
        _companyService.getAll(),
      ]);
      _entries = results[0] as List<BalanceEntry>;
      _companies = results[1] as List<Company>;
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  // Tüm kayıtlar üzerinden toplam hesapla (filtre uygulanmaz)
  double get _totalReceived =>
      _entries.where((e) => e.type == BalanceEntryType.received).fold(0, (s, e) => s + e.amount);

  double get _totalPaid =>
      _entries.where((e) => e.type == BalanceEntryType.paid).fold(0, (s, e) => s + e.amount);

  double get _currentBalance => _totalReceived - _totalPaid;

  double get _unpaidDebt => _companies.fold(0, (s, c) {
    final debt = c.totalReceivable - c.totalPayable;
    return s + (debt > 0 ? debt : 0);
  });

  double get _projectedBalance => _currentBalance - _unpaidDebt;

  // Filtrelenmiş liste
  List<BalanceEntry> get _filtered {
    return _entries.where((e) {
      if (_filterType != null && e.type != _filterType) return false;
      if (_filterStart != null) {
        final d = DateTime.tryParse(e.date);
        if (d == null || d.isBefore(_filterStart!)) return false;
      }
      if (_filterEnd != null) {
        final d = DateTime.tryParse(e.date);
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

  Future<void> _editEntry(BalanceEntry entry) async {
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AddBalanceEntrySheet(existing: entry),
    );
    if (updated == true) _load();
  }

  Future<void> _deleteEntry(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Hareketi Sil'),
        content: const Text('Bu hareketi silmek istediğinize emin misiniz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('İptal')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sil', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await _balanceService.delete(id);
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
    final filtered = _filtered;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bakiye', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final added = await showModalBottomSheet<bool>(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            builder: (_) => const AddBalanceEntrySheet(),
          );
          if (added == true) _load();
        },
        backgroundColor: const Color(0xFF059669),
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Hareket Ekle', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(child: _buildSummary()),
                  SliverToBoxAdapter(child: _buildFilterBar()),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                      child: Row(children: [
                        Text('Hareketler (${filtered.length})',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
                        const SizedBox(width: 8),
                        if (_hasFilter)
                          GestureDetector(
                            onTap: _clearFilters,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(20)),
                              child: const Text('Temizle', style: TextStyle(color: Color(0xFF2563EB), fontSize: 11, fontWeight: FontWeight.w600)),
                            ),
                          ),
                      ]),
                    ),
                  ),
                  filtered.isEmpty
                      ? SliverFillRemaining(
                          child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            const Text('💰', style: TextStyle(fontSize: 48)),
                            const SizedBox(height: 12),
                            Text(
                              _hasFilter ? 'Filtreye uygun hareket yok' : 'Henüz hareket eklenmedi',
                              style: const TextStyle(color: Color(0xFF64748B)),
                            ),
                          ])),
                        )
                      : SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (_, i) => _BalanceEntryTile(
                              entry: filtered[i],
                              onEdit: _editEntry,
                              onDelete: _deleteEntry,
                            ),
                            childCount: filtered.length,
                          ),
                        ),
                  const SliverPadding(padding: EdgeInsets.only(bottom: 90)),
                ],
              ),
      ),
    );
  }

  Widget _buildFilterBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
      child: Column(children: [
        Row(children: [
          _FilterChip(label: 'Tümü', active: _filterType == null,
            onTap: () => setState(() => _filterType = null)),
          const SizedBox(width: 8),
          _FilterChip(label: 'Bakiye +', active: _filterType == BalanceEntryType.received,
            activeColor: const Color(0xFF059669),
            onTap: () => setState(() => _filterType =
              _filterType == BalanceEntryType.received ? null : BalanceEntryType.received)),
          const SizedBox(width: 8),
          _FilterChip(label: 'Bakiye -', active: _filterType == BalanceEntryType.paid,
            activeColor: const Color(0xFFDC2626),
            onTap: () => setState(() => _filterType =
              _filterType == BalanceEntryType.paid ? null : BalanceEntryType.paid)),
        ]),
        const SizedBox(height: 8),
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

  Widget _buildSummary() {
    final current = _currentBalance;
    final projected = _projectedBalance;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(children: [
          Expanded(child: _InfoCard(
            title: 'Bakiye +',
            value: formatMoney(_totalReceived),
            color: const Color(0xFF059669),
            icon: Icons.trending_up_rounded,
          )),
          const SizedBox(width: 12),
          Expanded(child: _InfoCard(
            title: 'Bakiye -',
            value: formatMoney(_totalPaid),
            color: const Color(0xFFDC2626),
            icon: Icons.trending_down_rounded,
          )),
        ]),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: current >= 0 ? const Color(0xFF2563EB) : const Color(0xFFDC2626),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Mevcut Bakiye', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(formatMoneyAbs(current), style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold)),
            ]),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(20)),
              child: Text(current >= 0 ? 'Kasada' : 'Açık',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12)),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Ödenmemiş Borçlar', style: TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text('${_companies.where((c) => c.totalReceivable > c.totalPayable).length} firma',
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10)),
              const SizedBox(height: 6),
              Text(formatMoney(_unpaidDebt), style: const TextStyle(color: Color(0xFFF97316), fontSize: 16, fontWeight: FontWeight.bold)),
            ]),
          )),
          const SizedBox(width: 12),
          Expanded(child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: projected >= 0 ? const Color(0xFF059669) : const Color(0xFFDC2626),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Gerçekleşmemiş', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text('Borçlar ödenseydi', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 10)),
              const SizedBox(height: 6),
              Text(
                '${projected >= 0 ? '' : '-'}${formatMoney(projected.abs())}',
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ]),
          )),
        ]),
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

class _InfoCard extends StatelessWidget {
  final String title;
  final String value;
  final Color color;
  final IconData icon;
  const _InfoCard({required this.title, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFE2E8F0)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(title, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
      ]),
      const SizedBox(height: 6),
      Text(value, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.bold)),
    ]),
  );
}

class _BalanceEntryTile extends StatelessWidget {
  final BalanceEntry entry;
  final Function(BalanceEntry) onEdit;
  final Function(String) onDelete;
  const _BalanceEntryTile({required this.entry, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final isReceived = entry.type == BalanceEntryType.received;
    final balance = entry.runningBalance;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: entry.isOverdue ? const Color(0xFFFECACA) : const Color(0xFFE2E8F0),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: isReceived ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isReceived ? Icons.add_rounded : Icons.remove_rounded,
                color: isReceived ? const Color(0xFF059669) : const Color(0xFFDC2626),
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(entry.description, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFF0F172A))),
              const SizedBox(height: 2),
              Row(children: [
                Text(entry.date, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                if (entry.dueDate != null) ...[
                  const Text(' · ', style: TextStyle(color: Color(0xFF94A3B8))),
                  Icon(Icons.schedule_rounded, size: 11,
                    color: entry.isOverdue ? const Color(0xFFDC2626) : const Color(0xFF94A3B8)),
                  const SizedBox(width: 2),
                  Text(entry.dueDate!,
                    style: TextStyle(fontSize: 11,
                      color: entry.isOverdue ? const Color(0xFFDC2626) : const Color(0xFF94A3B8),
                      fontWeight: entry.isOverdue ? FontWeight.w600 : FontWeight.normal)),
                ],
                if (entry.invoiceFileName != null) ...[
                  const Text(' · ', style: TextStyle(color: Color(0xFF94A3B8))),
                  const Icon(Icons.attach_file_rounded, size: 12, color: Color(0xFF2563EB)),
                ],
              ]),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(
                formatMoney(entry.amount),
                style: TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 14,
                  color: isReceived ? const Color(0xFF059669) : const Color(0xFFDC2626),
                ),
              ),
              Text(
                formatMoneyAbs(balance),
                style: TextStyle(
                  fontSize: 11,
                  color: balance >= 0 ? const Color(0xFF2563EB) : const Color(0xFFDC2626),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ]),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: () => onEdit(entry),
              child: const Icon(Icons.edit_outlined, color: Color(0xFFCBD5E1), size: 20),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => onDelete(entry.id),
              child: const Icon(Icons.delete_outline_rounded, color: Color(0xFFCBD5E1), size: 20),
            ),
          ]),
        ),
      ),
    );
  }
}
