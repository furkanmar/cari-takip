import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../models/transaction.dart';
import '../services/transaction_service.dart';

class AddTransactionSheet extends StatefulWidget {
  final String companyId;
  final Transaction? existing;

  const AddTransactionSheet({super.key, required this.companyId, this.existing});

  @override
  State<AddTransactionSheet> createState() => _AddTransactionSheetState();
}

class _AddTransactionSheetState extends State<AddTransactionSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _descCtrl;
  late final TextEditingController _amountCtrl;
  late DateTime _date;
  DateTime? _dueDate;
  late TransactionType _type;
  PlatformFile? _invoice;
  bool _loading = false;
  String? _error;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _descCtrl = TextEditingController(text: e?.description ?? '');
    _amountCtrl = TextEditingController(text: e != null ? e.amount.toStringAsFixed(2) : '');
    _date = e != null ? DateTime.tryParse(e.date) ?? DateTime.now() : DateTime.now();
    _dueDate = e?.dueDate != null ? DateTime.tryParse(e!.dueDate!) : null;
    _type = e?.type ?? TransactionType.receivable;
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';

  String _toIso(DateTime d) => d.toIso8601String().split('T')[0];

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );
    if (result != null) setState(() => _invoice = result.files.first);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      final amount = double.parse(_amountCtrl.text.replaceAll(',', '.'));
      final dueDateStr = _dueDate != null ? _toIso(_dueDate!) : null;

      if (_isEdit) {
        await TransactionService().update(
          id: widget.existing!.id,
          date: _toIso(_date),
          dueDate: dueDateStr,
          description: _descCtrl.text,
          type: _type,
          amount: amount,
        );
      } else {
        await TransactionService().create(
          companyId: widget.companyId,
          date: _toIso(_date),
          dueDate: dueDateStr,
          description: _descCtrl.text,
          type: _type,
          amount: amount,
          invoicePath: _invoice?.path,
          invoiceName: _invoice?.name,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = 'Hata oluştu. Tekrar deneyin.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _datePicker({
    required String label,
    required DateTime? value,
    required bool required,
    required Function(DateTime?) onPicked,
  }) {
    return GestureDetector(
      onTap: () async {
        final d = await showDatePicker(
          context: context,
          initialDate: value ?? DateTime.now(),
          firstDate: DateTime(2000),
          lastDate: DateTime.now().add(const Duration(days: 3650)),
        );
        onPicked(d);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFCBD5E1)),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(
              value != null ? _formatDate(value) : required ? 'Seçin' : 'Opsiyonel',
              style: TextStyle(
                fontSize: 14,
                color: value != null ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
              ),
            ),
          ]),
          Row(children: [
            const Icon(Icons.calendar_today_rounded, size: 16, color: Color(0xFF64748B)),
            if (!required && value != null) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () { onPicked(null); },
                child: const Icon(Icons.close_rounded, size: 16, color: Color(0xFF94A3B8)),
              ),
            ],
          ]),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(24, 16, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),
            Text(_isEdit ? 'İşlemi Düzenle' : 'İşlem Ekle',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF0F172A))),
            const SizedBox(height: 16),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10)),
                child: Text(_error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
              ),
              const SizedBox(height: 12),
            ],
            // Tür seçimi
            Container(
              decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
              child: Row(children: [
                Expanded(child: GestureDetector(
                  onTap: () => setState(() => _type = TransactionType.receivable),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _type == TransactionType.receivable ? const Color(0xFF2563EB) : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text('📈 Alacak', textAlign: TextAlign.center,
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13,
                        color: _type == TransactionType.receivable ? Colors.white : const Color(0xFF64748B))),
                  ),
                )),
                Expanded(child: GestureDetector(
                  onTap: () => setState(() => _type = TransactionType.payable),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _type == TransactionType.payable ? const Color(0xFFDC2626) : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text('📉 Verecek', textAlign: TextAlign.center,
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13,
                        color: _type == TransactionType.payable ? Colors.white : const Color(0xFF64748B))),
                  ),
                )),
              ]),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _datePicker(
                label: 'Tarih',
                value: _date,
                required: true,
                onPicked: (d) { if (d != null) setState(() => _date = d); },
              )),
              const SizedBox(width: 10),
              Expanded(child: _datePicker(
                label: 'Vade',
                value: _dueDate,
                required: false,
                onPicked: (d) => setState(() => _dueDate = d),
              )),
            ]),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(labelText: 'Açıklama'),
              validator: (v) => v!.isEmpty ? 'Açıklama gerekli' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Tutar (₺)', prefixText: '₺ '),
              validator: (v) {
                if (v!.isEmpty) return 'Tutar gerekli';
                if (double.tryParse(v.replaceAll(',', '.')) == null) return 'Geçerli bir tutar girin';
                return null;
              },
            ),
            if (!_isEdit) ...[
              const SizedBox(height: 12),
              GestureDetector(
                onTap: _pickFile,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _invoice != null ? const Color(0xFF2563EB) : const Color(0xFFCBD5E1)),
                  ),
                  child: Row(children: [
                    Icon(_invoice != null ? Icons.attach_file_rounded : Icons.upload_file_rounded,
                      color: _invoice != null ? const Color(0xFF2563EB) : const Color(0xFF64748B), size: 20),
                    const SizedBox(width: 10),
                    Expanded(child: Text(
                      _invoice != null ? _invoice!.name : 'Fatura ekle (opsiyonel)',
                      style: TextStyle(color: _invoice != null ? const Color(0xFF2563EB) : const Color(0xFF94A3B8), fontSize: 14),
                    )),
                    if (_invoice != null)
                      GestureDetector(
                        onTap: () => setState(() => _invoice = null),
                        child: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF94A3B8)),
                      ),
                  ]),
                ),
              ),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text(_isEdit ? 'Güncelle' : 'Kaydet'),
            ),
          ]),
        ),
      ),
    );
  }
}
