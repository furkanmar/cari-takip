import 'package:flutter/material.dart';
import '../models/company.dart';
import '../services/company_service.dart';
import '../core/formatters.dart';
import 'company_detail_screen.dart';
import 'add_company_sheet.dart';
import 'settings_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _service = CompanyService();
  List<Company> _companies = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _companies = await _service.getAll();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  double get _totalReceivable => _companies.fold(0, (s, c) => s + c.totalReceivable);
  double get _totalPayable => _companies.fold(0, (s, c) => s + c.totalPayable);
  double get _netBalance => _totalReceivable - _totalPayable;

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
                      child: Row(children: [
                        const Text('Şirketler', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(20)),
                          child: Text('${_companies.length}', style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w600, fontSize: 12)),
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
                            (_, i) => _CompanyTile(company: _companies[i], onRefresh: _load),
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
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Row(children: [
          Expanded(child: _SummaryCard(title: 'Alacak', amount: _totalReceivable, color: const Color(0xFF059669))),
          const SizedBox(width: 12),
          Expanded(child: _SummaryCard(title: 'Verecek', amount: _totalPayable, color: const Color(0xFFDC2626))),
        ]),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: _netBalance >= 0 ? const Color(0xFF2563EB) : const Color(0xFFDC2626),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Net Bakiye', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text(formatMoneyAbs(_netBalance), style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
            Text(_netBalance >= 0 ? 'Alacaklısın' : 'Vereceksin', style: const TextStyle(color: Colors.white70, fontSize: 12)),
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
  const _CompanyTile({required this.company, required this.onRefresh});

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
    return Padding(
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
          onLongPress: () => _showEditSheet(context),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
            child: Row(children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(12)),
                child: Center(child: Text(company.name[0].toUpperCase(), style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold, fontSize: 18))),
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(company.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: Color(0xFF0F172A))),
                if (company.taxNumber != null || company.phone != null)
                  Text(company.taxNumber ?? company.phone ?? '', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
              ])),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(
                  '${net >= 0 ? '+' : ''}${formatMoney(net)}',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: net >= 0 ? const Color(0xFF059669) : const Color(0xFFDC2626)),
                ),
                Text('A: ${formatMoney(company.totalReceivable)}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
              ]),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right_rounded, color: Color(0xFFCBD5E1)),
            ]),
          ),
        ),
      ),
    );
  }
}
