export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: Currency[] = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "XOF", symbol: "CFA", name: "CFA Franc BCEAO" },
  { code: "XAF", symbol: "FCFA", name: "CFA Franc BEAC" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "ARS", symbol: "AR$", name: "Argentine Peso" },
  { code: "CLP", symbol: "CL$", name: "Chilean Peso" },
  { code: "COP", symbol: "CO$", name: "Colombian Peso" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "TWD", symbol: "NT$", name: "Taiwan Dollar" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
  { code: "RON", symbol: "lei", name: "Romanian Leu" },
  { code: "BGN", symbol: "лв", name: "Bulgarian Lev" },
  { code: "HRK", symbol: "kn", name: "Croatian Kuna" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "EGP", symbol: "E£", name: "Egyptian Pound" },
  { code: "MAD", symbol: "MAD", name: "Moroccan Dirham" },
  { code: "TND", symbol: "DT", name: "Tunisian Dinar" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
  { code: "QAR", symbol: "QR", name: "Qatari Riyal" },
  { code: "KWD", symbol: "KD", name: "Kuwaiti Dinar" },
  { code: "BHD", symbol: "BD", name: "Bahraini Dinar" },
  { code: "ILS", symbol: "₪", name: "Israeli Shekel" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee" },
  { code: "UAH", symbol: "₴", name: "Ukrainian Hryvnia" },
  { code: "PEN", symbol: "S/.", name: "Peruvian Sol" },
  { code: "UYU", symbol: "$U", name: "Uruguayan Peso" },
  { code: "DZD", symbol: "DA", name: "Algerian Dinar" },
  { code: "ISK", symbol: "kr", name: "Icelandic Króna" },
];

export function formatSalary(amount: number | null, currency: string, locale: string): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}
