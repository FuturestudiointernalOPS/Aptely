import { getServerLocale, t } from "@/lib/i18n";

export default async function GlobalLoading() {
  const locale = await getServerLocale();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        <span className="text-gray-400 text-sm">{t(locale, "common.loading", "Loading...")}</span>
      </div>
    </div>
  );
}
