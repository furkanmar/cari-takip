import 'package:intl/intl.dart';

final _currencyFmt = NumberFormat('#,##0.00', 'tr_TR');

String formatMoney(double amount) => '₺${_currencyFmt.format(amount)}';

String formatMoneyAbs(double amount) => '₺${_currencyFmt.format(amount.abs())}';
