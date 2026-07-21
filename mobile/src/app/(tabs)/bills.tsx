import { Feather } from '@expo/vector-icons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { apiErrorMessage } from '@/api/client';
import type { Invoice, Receipt } from '@/api/types';
import {
  MonthFilter,
  PaymentsFilterCard,
  StatusFilter,
} from '@/components/payments/filter-panel';
import { AppText } from '@/components/ui/app-text';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListScreen, Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Brand, Radius, Spacing, softShadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useInvoices, useReceipts } from '@/hooks/queries';
import { isInitialLoad } from '@/hooks/query-ui';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatINR, formatMonthShort } from '@/utils/format';

const TABS = ['Invoices', 'Receipts'] as const;

export default function BillsScreen() {
  const params = useLocalSearchParams<{ tab?: string; q?: string }>();
  const [tab, setTab] = useState<(typeof TABS)[number]>(params.tab === 'Receipts' ? 'Receipts' : 'Invoices');

  const [lastParamTab, setLastParamTab] = useState(params.tab);
  if (params.tab !== lastParamTab) {
    setLastParamTab(params.tab);
    if (params.tab === 'Receipts' || params.tab === 'Invoices') setTab(params.tab);
  }

  return tab === 'Invoices' ? (
    <InvoicesTab tab={tab} setTab={setTab} initialQuery={params.q} />
  ) : (
    <ReceiptsTab tab={tab} setTab={setTab} initialQuery={params.q} />
  );
}

type TabProps = {
  tab: (typeof TABS)[number];
  setTab: (t: (typeof TABS)[number]) => void;
  initialQuery?: string;
};

function ScreenHeader({
  tab,
  setTab,
  isAdmin,
}: {
  tab: (typeof TABS)[number];
  setTab: (t: (typeof TABS)[number]) => void;
  isAdmin: boolean;
}) {
  return (
    <View style={styles.headerBlock}>
      <View>
        <AppText variant="title">{isAdmin ? 'Collections' : 'Payments'}</AppText>
        <AppText variant="caption" color="textSecondary">
          {isAdmin
            ? 'Track invoices, collections and receipts'
            : 'Pay dues and view your billing history'}
        </AppText>
      </View>
      <Segmented options={TABS} value={tab} onChange={setTab} />
    </View>
  );
}

function yearsFrom(months: string[]): string[] {
  return [...new Set(months.map((value) => value.slice(0, 4)).filter(Boolean))].sort().reverse();
}

function TotalPendingCard({ invoices, isAdmin }: { invoices: Invoice[]; isAdmin: boolean }) {
  const theme = useTheme();
  const router = useRouter();

  const pending = invoices.filter((i) => i.outstanding > 0 && i.status !== 'Cancelled');
  const total = pending.reduce((sum, i) => sum + i.outstanding, 0);
  if (total <= 0) return null;

  const maintenance = Math.min(
    total,
    pending.reduce((sum, i) => sum + i.maintenanceSubtotal, 0)
  );
  const arrears = total - maintenance;
  const nextDue = [...pending].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  return (
    <Card dark style={[heroStyles.card, softShadow]}>
      <AppText variant="body" style={{ color: theme.textSecondaryOnDark }}>
        Total Pending
      </AppText>
      <AppText variant="display" style={{ color: theme.textOnDark, fontSize: 36, lineHeight: 42 }}>
        {formatINR(total)}
      </AppText>
      <View style={heroStyles.rows}>
        <View style={heroStyles.row}>
          <AppText variant="body" style={{ color: theme.textSecondaryOnDark }}>
            Maintenance fee
          </AppText>
          <AppText variant="bodySemi" style={{ color: theme.textOnDark }}>
            {formatINR(maintenance)}
          </AppText>
        </View>
        {arrears > 0 ? (
          <View style={heroStyles.row}>
            <AppText variant="body" style={{ color: theme.textSecondaryOnDark }}>
              Arrears & penalty
            </AppText>
            <AppText variant="bodySemi" style={{ color: theme.textOnDark }}>
              {formatINR(arrears)}
            </AppText>
          </View>
        ) : null}
      </View>
      <Button
        title={`${isAdmin ? 'Record' : 'Pay'} ${formatINR(nextDue.outstanding)}`}
        variant="secondary"
        onPress={() => router.push({ pathname: '/pay/[invoiceNo]', params: { invoiceNo: nextDue.invoiceNo } })}
      />
    </Card>
  );
}

const heroStyles = StyleSheet.create({
  card: { gap: Spacing.half, padding: Spacing.three },
  rows: { gap: Spacing.one, marginTop: Spacing.onehalf, marginBottom: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

/* ------------------------------- Invoices ------------------------------- */

function InvoicesTab({ tab, setTab, initialQuery }: TabProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [status, setStatus] = useState<StatusFilter>('All');
  const [year, setYear] = useState('All');
  const [month, setMonth] = useState<MonthFilter>('All');
  const [query, setQuery] = useState(initialQuery ?? '');

  const [lastParamQuery, setLastParamQuery] = useState(initialQuery);
  if (initialQuery !== lastParamQuery) {
    setLastParamQuery(initialQuery);
    if (initialQuery !== undefined) setQuery(initialQuery);
  }

  const invoices = useInvoices({});
  const years = useMemo(() => yearsFrom((invoices.data ?? []).map((i) => i.month)), [invoices.data]);

  const periodInvoices = useMemo(
    () =>
      (invoices.data ?? []).filter(
        (i) =>
          (year === 'All' || String(i.year) === year) &&
          (month === 'All' || i.month.slice(5, 7) === month)
      ),
    [invoices.data, year, month]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return periodInvoices.filter(
      (i) =>
        (status === 'All' || i.status === status) &&
        (!q ||
          i.invoiceNo.toLowerCase().includes(q) ||
          i.ownerName.toLowerCase().includes(q) ||
          `${i.wing}-${i.flatNo}`.toLowerCase().includes(q) ||
          i.status.toLowerCase().includes(q) ||
          String(i.totalAmount).includes(q))
    );
  }, [periodInvoices, status, query]);

  const activeFilters =
    (status !== 'All' ? 1 : 0) + (year !== 'All' ? 1 : 0) + (month !== 'All' ? 1 : 0) + (query.trim() ? 1 : 0);

  const clearFilters = () => {
    setStatus('All');
    setYear('All');
    setMonth('All');
    setQuery('');
  };

  const header = (
    <View style={styles.headerBlock}>
      <ScreenHeader tab={tab} setTab={setTab} isAdmin={isAdmin} />
      {invoices.data ? <TotalPendingCard invoices={periodInvoices} isAdmin={isAdmin} /> : null}
      <PaymentsFilterCard
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search by invoice no., flat or amount"
        showStatus
        status={status}
        onStatusChange={setStatus}
        year={year}
        month={month}
        years={years}
        onYearChange={setYear}
        onMonthChange={setMonth}
        resultCount={filtered.length}
        activeFilters={activeFilters}
        onClearFilters={clearFilters}
      />
      {filtered.length > 0 ? (
        <AppText variant="label" color="textSecondary">
          Invoices
        </AppText>
      ) : null}
    </View>
  );

  if (isInitialLoad(invoices) || invoices.isError) {
    return (
      <Screen topInset tabbed>
        <ScreenHeader tab={tab} setTab={setTab} isAdmin={isAdmin} />
        {isInitialLoad(invoices) ? (
          <ListSkeleton rows={5} />
        ) : (
          <ErrorState message={apiErrorMessage(invoices.error)} onRetry={() => invoices.refetch()} />
        )}
      </Screen>
    );
  }

  return (
    <ListScreen
      data={filtered}
      keyExtractor={(invoice) => invoice.id}
      renderItem={({ item }) => <InvoiceRow invoice={item} showResident={isAdmin} />}
      header={header}
      empty={
        <EmptyState
          icon="file-text"
          title="No invoices found"
          message={
            activeFilters > 0
              ? 'Try changing the status, period or search above.'
              : 'Your maintenance invoices will appear here.'
          }
        />
      }
    />
  );
}

function InvoiceRow({ invoice, showResident }: { invoice: Invoice; showResident: boolean }) {
  const theme = useTheme();
  const emphasizeOutstanding = invoice.outstanding > 0 && invoice.status !== 'Cancelled';

  return (
    <Link href={{ pathname: '/invoice/[invoiceNo]', params: { invoiceNo: invoice.invoiceNo } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`Invoice ${invoice.invoiceNo}`}>
        <Card style={[styles.rowCard, softShadow]}>
          <View style={styles.rowTop}>
            <View style={[styles.rowIcon, { backgroundColor: theme.primarySoft }]}>
              <Feather name="file-text" size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodySemi">{formatMonthShort(invoice.month)} maintenance</AppText>
              <AppText variant="caption" color="textSecondary">
                {showResident
                  ? `${invoice.ownerName} · Wing ${invoice.wing}, Flat ${invoice.flatNo}`
                  : invoice.invoiceNo}
              </AppText>
            </View>
            <StatusBadge status={invoice.status} />
          </View>
          <View style={[styles.rowBottom, { borderTopColor: theme.border }]}>
            <View style={{ gap: 2 }}>
              <AppText variant="caption" color="textSecondary">
                Due {formatDate(invoice.dueDate)}
              </AppText>
              {showResident ? (
                <AppText variant="caption" color="textSecondary">
                  {invoice.invoiceNo}
                </AppText>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <AppText variant="heading" style={emphasizeOutstanding ? { color: theme.error } : undefined}>
                {formatINR(emphasizeOutstanding ? invoice.outstanding : invoice.totalAmount)}
              </AppText>
              {emphasizeOutstanding ? (
                <AppText variant="caption" color="textSecondary">
                  of {formatINR(invoice.totalAmount)}
                </AppText>
              ) : null}
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

/* ------------------------------- Receipts ------------------------------- */

function ReceiptsTab({ tab, setTab, initialQuery }: TabProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const receipts = useReceipts();
  const [year, setYear] = useState('All');
  const [month, setMonth] = useState<MonthFilter>('All');
  const [query, setQuery] = useState(initialQuery ?? '');

  const [lastParamQuery, setLastParamQuery] = useState(initialQuery);
  if (initialQuery !== lastParamQuery) {
    setLastParamQuery(initialQuery);
    if (initialQuery !== undefined) setQuery(initialQuery);
  }

  const years = useMemo(() => yearsFrom((receipts.data ?? []).map((r) => r.month)), [receipts.data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (receipts.data ?? []).filter(
      (r) =>
        (year === 'All' || r.month.slice(0, 4) === year) &&
        (month === 'All' || r.month.slice(5, 7) === month) &&
        (!q ||
          r.receiptNo.toLowerCase().includes(q) ||
          r.invoiceNo.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.paymentMode.toLowerCase().includes(q) ||
          String(r.totalPaid).includes(q))
    );
  }, [receipts.data, year, month, query]);

  const activeFilters = (year !== 'All' ? 1 : 0) + (month !== 'All' ? 1 : 0) + (query.trim() ? 1 : 0);
  const clearFilters = () => {
    setYear('All');
    setMonth('All');
    setQuery('');
  };

  const totalPaid = filtered.reduce((sum, r) => sum + r.totalPaid, 0);

  const header = (
    <View style={styles.headerBlock}>
      <ScreenHeader tab={tab} setTab={setTab} isAdmin={isAdmin} />
      {filtered.length > 0 ? (
        <Card style={[styles.receiptSummary, softShadow]}>
          <AppText variant="caption" color="textSecondary">
            Total in this view
          </AppText>
          <AppText variant="title" style={{ color: Brand.ink }}>
            {formatINR(totalPaid)}
          </AppText>
        </Card>
      ) : null}
      <PaymentsFilterCard
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search by receipt no., invoice or amount"
        year={year}
        month={month}
        years={years}
        onYearChange={setYear}
        onMonthChange={setMonth}
        resultCount={filtered.length}
        activeFilters={activeFilters}
        onClearFilters={clearFilters}
      />
      {filtered.length > 0 ? (
        <AppText variant="label" color="textSecondary">
          Receipts
        </AppText>
      ) : null}
    </View>
  );

  if (isInitialLoad(receipts) || receipts.isError) {
    return (
      <Screen topInset tabbed>
        <ScreenHeader tab={tab} setTab={setTab} isAdmin={isAdmin} />
        {isInitialLoad(receipts) ? (
          <ListSkeleton rows={5} />
        ) : (
          <ErrorState message={apiErrorMessage(receipts.error)} onRetry={() => receipts.refetch()} />
        )}
      </Screen>
    );
  }

  return (
    <ListScreen
      data={filtered}
      keyExtractor={(receipt) => receipt.id}
      renderItem={({ item }) => <ReceiptRow receipt={item} showResident={isAdmin} />}
      header={header}
      empty={
        <EmptyState
          icon="credit-card"
          title="No receipts found"
          message={
            activeFilters > 0
              ? 'Try changing the period or search above.'
              : 'Receipts appear here after you pay an invoice.'
          }
        />
      }
    />
  );
}

function ReceiptRow({ receipt, showResident }: { receipt: Receipt; showResident: boolean }) {
  const theme = useTheme();
  return (
    <Link href={{ pathname: '/receipt/[receiptNo]', params: { receiptNo: receipt.receiptNo } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`Receipt ${receipt.receiptNo}`}>
        <Card style={[styles.rowCard, softShadow]}>
          <View style={styles.rowTop}>
            <View style={[styles.rowIcon, { backgroundColor: theme.successSoft }]}>
              <Feather name="check-circle" size={20} color={theme.success} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodySemi">
                {showResident
                  ? `${receipt.ownerName} · Wing ${receipt.wing}, Flat ${receipt.flatNo}`
                  : receipt.receiptNo}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {formatMonthShort(receipt.month)} · {receipt.paymentMode}
              </AppText>
            </View>
            <AppText variant="heading" style={{ color: theme.success }}>
              {formatINR(receipt.totalPaid)}
            </AppText>
          </View>
          <View style={[styles.rowBottom, { borderTopColor: theme.border }]}>
            <AppText variant="caption" color="textSecondary">
              Paid on {formatDate(receipt.paymentDate)}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {showResident ? receipt.receiptNo : `Invoice ${receipt.invoiceNo}`}
            </AppText>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: Spacing.two },
  receiptSummary: {
    gap: 4,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two + Spacing.half,
  },
  rowCard: { gap: Spacing.onehalf, padding: Spacing.two },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.onehalf },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.onehalf,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
