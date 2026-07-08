import 'package:flutter/material.dart';
import '../models/company.dart';
import '../services/company_service.dart';
import '../core/formatters.dart';
import 'company_detail_screen.dart';
import 'add_company_sheet.dart';
import 'settings_screen.dart';
import 'balance_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _service = CompanyService();
  List<Company> _companies = [];
  bool _loading = true;
  bool _showArchived = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _companies = await _service.getAll(includeArchived: _showArchived);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  // Summary sadece arşivlenmemiş firmaları sayar
  List<Company> get _activeCompanies => _companies.where((c) => !c.isArchived).toList();

  double get _totalReceivable => _activeCompanies.fold(0, (s, c) => s + c.totalReceivable);
  double get _totalPayable => _activeCompanies.fold(0, (s, c) => s + c.totalPayable);
  // net > 0 = biz borçluyuz
  double get _netBalance => _totalReceivable - _totalPayable;

  Future<void> _archiveCompany(Company c) async {
    if (c.isArchived) {
      await _service.unarchive(c.id);
    } else {
      await _service.archive(c.id);
    }
    _load();
  }

  Future<void> _deleteCompany(BuildContext context, Company c) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Şirketi Sil'),
        content: Text('${c.name} şirketini ve tüm işlemlerini silmek istediğinize emin misiniz?'),
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
      await _service.delete(c.id);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(color: const Color(0xFF2563EB), borderRadius: BorderRadius.circular(8)),
            child: const Center(child: Text('CT', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
          ),
          const SizedBox(width: 10),
          const Text('Cari Takip', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        ]),
        actions: [
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_rounded, color: Color(0xFF059669)),
            tooltip: 'Bakiye',
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BalanceScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.settings_rounded, color: Color(0xFF64748B)),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final added = await showModalBottomSheet<bool>(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            builder: (_) => const AddCompanySheet(),
          );
          if (added == true) _load();
        },
        backgroundColor: const Color(0xFF2563EB),
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Şirket Ekle', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(child: _buildSummary()),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        Row(children: [
                          const Text('Şirketler', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(20)),
                            child: Text('${_companies.length}', style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w600, fontSize: 12)),
                          ),
                        ]),
                        GestureDetector(
                          onTap: () {
                            setState(() => _showArchived = !_showArchived);
                            _load();
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: _showArchived ? const Color(0xFFFFF7ED) : Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: _showArchived ? const Color(0xFFFB923C) : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Row(children: [
                              Icon(Icons.archive_outlined, size: 14,
                                color: _showArchived ? const Color(0xFFF97316) : const Color(0xFF64748B)),
                              const SizedBox(width: 4),
                              Text(
                                _showArchived ? 'Arşiv Görünüyor' : 'Arşivi Göster',
                                style: TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w600,
                                  color: _showArchived ? const Color(0xFFF97316) : const Color(0xFF64748B),
                                ),
                              ),
                            ]),
                          ),
                        ),
                      ]),
                    ),
                  ),
                  _companies.isEmpty
                      ? SliverFillRemaining(
                          child: Center(
                            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                              const Text('🏢', style: TextStyle(fontSize: 48)),
                              const SizedBox(height: 12),
                              const Text('Henüz şirket eklenmedi', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                            ]),
                          ),
                        )
                      : SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (_, i) => _CompanyTile(
                              company: _companies[i],
                              onRefresh: _load,
                              onArchive: () => _archiveCompany(_companies[i]),
                              onDelete: () => _deleteCompany(context, _companies[i]),
                            ),
                            childCount: _companies.length,
                          ),
                        ),
                  const SliverPadding(padding: EdgeInsets.only(bottom: 90)),
                ],
              ),
      ),
    );
  }

  Widget _buildSummary() {
    final net = _netBalance;
    // net > 0 = biz borçluyuz = KIRMIZI
    final isDebt = net > 0;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(children: [
          Expanded(child: _SummaryCard(
            title: 'Borç +',
            amount: _totalReceivable,
            color: const Color(0xFFDC2626),
          )),
          const SizedBox(width: 12),
          Expanded(child: _SummaryCard(
            title: 'Borç -',
            amount: _totalPayable,
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
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Net Borç', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text(formatMoneyAbs(net), style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
            Text(isDebt ? 'Borçlusun' : 'Kapatıldı', style: const TextStyle(color: Colors.white70, fontSize: 12)),
          ]),
        ),
      ]),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String title;
  final double amount;
  final Color color;
  const _SummaryCard({required this.title, required this.amount, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Text(formatMoney(amount), style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.bold)),
      ]),
    );
  }
}

class _CompanyTile extends StatelessWidget {
  final Company company;
  final VoidCallback onRefresh;
  final VoidCallback onArchive;
  final VoidCallback onDelete;
  const _CompanyTile({
    required this.company,
    required this.onRefresh,
    required this.onArchive,
    required this.onDelete,
  });

  void _showEditSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AddCompanySheet(existing: company),
    ).then((updated) { if (updated == true) onRefresh(); });
  }

  @override
  Widget build(BuildContext context) {
    final net = company.netBalance;
    // net > 0 = biz borçluyuz = KIRMIZI
    final isDebt = net > 0;

    return Opacity(
      opacity: company.isArchived ? 0.6 : 1.0,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () async {
              await Navigator.push(context, MaterialPageRoute(builder: (_) => CompanyDetailScreen(companyId: company.id)));
              onRefresh();
            },
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(12)),
                  child: Center(child: Text(company.name[0].toUpperCase(),
                    style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold, fontSize: 18))),
                ),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(
                      child: Text(company.name,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: Color(0xFF0F172A))),
                    ),
                    if (company.isArchived) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFFB923C)),
                        ),
                        child: const Text('Arşiv', style: TextStyle(color: Color(0xFFF97316), fontSize: 10, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ]),
                  if (company.taxNumber != null || company.phone != null)
                    Text(company.taxNumber ?? company.phone ?? '',
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                ])),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(
                    '${isDebt ? '+' : '-'}${formatMoneyAbs(net)}',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16,
                      color: isDebt ? const Color(0xFFDC2626) : const Color(0xFF059669)),
                  ),
                  Text(
                    'B+: ${formatMoney(company.totalReceivable)}',
                    style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                  ),
                ]),
                const SizedBox(width: 4),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert_rounded, color: Color(0xFFCBD5E1), size: 20),
                  onSelected: (value) {
                    if (value == 'edit') _showEditSheet(context);
                    if (value == 'archive') onArchive();
                    if (value == 'delete') onDelete();
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'edit', child: Row(children: [
                      Icon(Icons.edit_outlined, size: 16, color: Color(0xFF64748B)),
                      SizedBox(width: 8),
                      Text('Düzenle'),
                    ])),
                    PopupMenuItem(value: 'archive', child: Row(children: [
                      Icon(company.isArchived ? Icons.unarchive_outlined : Icons.archive_outlined,
                        size: 16, color: const Color(0xFFF97316)),
                      const SizedBox(width: 8),
                      Text(company.isArchived ? 'Arşivden Çıkar' : 'Arşivle'),
                    ])),
                    const PopupMenuItem(value: 'delete', child: Row(children: [
                      Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFFDC2626)),
                      SizedBox(width: 8),
                      Text('Sil', style: TextStyle(color: Color(0xFFDC2626))),
                    ])),
                  ],
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
