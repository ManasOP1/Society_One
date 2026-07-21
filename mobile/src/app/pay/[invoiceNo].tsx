import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { apiErrorMessage } from '@/api/client';
import type { PaymentMode, PayResponse } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useInvoice, usePayInvoice } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { PaymentSuccessAnimation } from '@/components/payments/payment-success-animation';
import { isRazorpayCheckoutAvailable } from '@/utils/razorpay-checkout';
import { formatDate, formatINR, formatMonth } from '@/utils/format';

const RESIDENT_MODES: { mode: PaymentMode; icon: keyof typeof Feather.glyphMap; hint: string }[] = [
  { mode: 'UPI', icon: 'smartphone', hint: 'Google Pay, PhonePe, Paytm' },
  { mode: 'Credit Card', icon: 'credit-card', hint: 'Visa, Mastercard, RuPay' },
  { mode: 'Debit Card', icon: 'credit-card', hint: 'Visa, Mastercard, RuPay' },
  { mode: 'Net Banking', icon: 'globe', hint: 'All major banks' },
  { mode: 'Wallet', icon: 'shopping-bag', hint: 'Amazon Pay, Mobikwik' },
];

const ADMIN_MODES: { mode: PaymentMode; icon: keyof typeof Feather.glyphMap; hint: string }[] = [
  { mode: 'UPI', icon: 'smartphone', hint: 'Resident paid via UPI at office / QR' },
  { mode: 'Cash', icon: 'dollar-sign', hint: 'Cash collected at society office' },
  { mode: 'Cheque', icon: 'file-text', hint: 'Cheque deposited to society account' },
  { mode: 'Net Banking', icon: 'globe', hint: 'NEFT / IMPS / RTGS transfer' },
  { mode: 'Other', icon: 'more-horizontal', hint: 'Manual adjustment or other mode' },
];

export default function PayScreen() {
  const { invoiceNo } = useLocalSearchParams<{ invoiceNo: string }>();
  const theme = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const invoice = useInvoice(invoiceNo ?? '');
  const payMutation = usePayInvoice();

  // null = untouched → default to the full outstanding amount once loaded.
  const [amountInput, setAmountInput] = useState<string | null>(null);
  const [mode, setMode] = useState<PaymentMode>('UPI');
  const [result, setResult] = useState<PayResponse | null>(null);
  const amountText = amountInput ?? (invoice.data ? String(invoice.data.outstanding) : '');
  const setAmountText = setAmountInput;
  const modes = isAdmin ? ADMIN_MODES : RESIDENT_MODES;

  if (result) {
    return <PaymentSuccess result={result} />;
  }

  if (invoice.isPending) {
    return (
      <Screen>
        <Skeleton height={120} radius={Radius.lg} />
        <Skeleton height={220} radius={Radius.lg} />
      </Screen>
    );
  }

  if (invoice.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState message={apiErrorMessage(invoice.error)} onRetry={() => invoice.refetch()} />
      </Screen>
    );
  }

  const inv = invoice.data;
  if (inv.outstanding <= 0 || inv.status === 'Cancelled') {
    return (
      <Screen scroll={false}>
        <ErrorState message={inv.status === 'Cancelled' ? 'This invoice has been cancelled.' : 'This invoice is already paid in full.'} />
      </Screen>
    );
  }

  const amount = Number(amountText.replace(/[^0-9.]/g, ''));
  const amountValid = Number.isFinite(amount) && amount > 0 && amount <= inv.outstanding;

  async function handlePay() {
    if (!amountValid || payMutation.isPending) return;
    try {
      const response = await payMutation.mutateAsync({ invoiceNo: inv.invoiceNo, amount, mode });
      setResult(response);
    } catch {
      // error surfaced via payMutation.error below
    }
  }

  return (
    <Screen>
      {/* Dark "Total Pending" hero (reference design) */}
      <Card dark style={styles.hero}>
        <AppText variant="body" style={{ color: theme.textSecondaryOnDark }}>
          {isAdmin ? 'Outstanding for flat' : 'Total Pending'}
        </AppText>
        <AppText variant="display" style={{ color: theme.textOnDark }}>
          {formatINR(inv.outstanding)}
        </AppText>
        <View style={styles.heroRows}>
          <View style={styles.summaryRow}>
            <AppText variant="body" style={{ color: theme.textSecondaryOnDark }}>
              Maintenance Fee
            </AppText>
            <AppText variant="bodySemi" style={{ color: theme.textOnDark }}>
              {formatINR(Math.min(inv.outstanding, inv.maintenanceSubtotal))}
            </AppText>
          </View>
          {inv.outstanding - inv.maintenanceSubtotal > 0 ? (
            <View style={styles.summaryRow}>
              <AppText variant="body" style={{ color: theme.textSecondaryOnDark }}>
                Arrears & Penalty
              </AppText>
              <AppText variant="bodySemi" style={{ color: theme.textOnDark }}>
                {formatINR(inv.outstanding - Math.min(inv.outstanding, inv.maintenanceSubtotal))}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="caption" style={{ color: theme.textSecondaryOnDark }}>
          {formatMonth(inv.month)} · {inv.invoiceNo} · Due {formatDate(inv.dueDate)}
        </AppText>
      </Card>

      {/* Amount */}
      <Card style={{ gap: Spacing.one }}>
        <AppText variant="label">Amount to pay</AppText>
        <View style={[styles.amountBox, { borderColor: amountValid ? theme.border : theme.error }]}>
          <AppText variant="title" color="textSecondary">
            ₹
          </AppText>
          <TextInput
            style={[styles.amountInput, { color: theme.text }]}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
        {!amountValid && amountText ? (
          <AppText variant="caption" style={{ color: theme.error }}>
            Enter an amount between ₹1 and {formatINR(inv.outstanding)}
          </AppText>
        ) : null}
        <View style={styles.presetRow}>
          <Pressable
            style={[styles.preset, { borderColor: theme.border }]}
            onPress={() => setAmountText(String(inv.outstanding))}>
            <AppText variant="caption">Full · {formatINR(inv.outstanding)}</AppText>
          </Pressable>
          <Pressable
            style={[styles.preset, { borderColor: theme.border }]}
            onPress={() => setAmountText(String(Math.ceil(inv.outstanding / 2)))}>
            <AppText variant="caption">Half · {formatINR(Math.ceil(inv.outstanding / 2))}</AppText>
          </Pressable>
        </View>
      </Card>

      {/* Payment method — dark rows with lime check (reference design) */}
      <AppText variant="heading" style={{ marginTop: Spacing.half }}>
        {isAdmin ? 'Collection Mode' : 'Payment Method'}
      </AppText>
      <View style={{ gap: Spacing.one }}>
        {modes.map(({ mode: m, icon, hint }) => {
          const active = m === mode;
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              onPress={() => setMode(m)}
              style={[
                styles.modeRow,
                { backgroundColor: theme.surfaceDark },
                active && { borderColor: theme.accent },
              ]}>
              <View style={[styles.modeIcon, { backgroundColor: theme.cardOnDark }]}>
                <Feather name={icon} size={17} color={theme.textOnDark} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <AppText variant="bodySemi" style={{ color: theme.textOnDark }}>
                  {m}
                </AppText>
                <AppText variant="caption" style={{ color: theme.textSecondaryOnDark }} numberOfLines={1}>
                  {hint}
                </AppText>
              </View>
              {active ? (
                <View style={[styles.modeCheck, { backgroundColor: theme.accent }]}>
                  <Feather name="check" size={13} color={theme.onAccent} />
                </View>
              ) : (
                <Feather name="chevron-right" size={18} color={theme.textSecondaryOnDark} />
              )}
            </Pressable>
          );
        })}
      </View>

      {payMutation.isError ? (
        <View style={[styles.errorBox, { backgroundColor: theme.errorSoft }]}>
          <Feather name="alert-circle" size={16} color={theme.error} />
          <AppText variant="caption" style={{ color: theme.error, flex: 1 }}>
            {apiErrorMessage(payMutation.error)}
          </AppText>
        </View>
      ) : null}

      <Button
        title={
          amountValid
            ? `${isAdmin ? 'Record payment' : 'Pay'} ${formatINR(amount)}`
            : isAdmin
              ? 'Record payment'
              : 'Pay'
        }
        variant="secondary"
        loading={payMutation.isPending}
        disabled={!amountValid}
        icon={<Feather name="lock" size={16} color={theme.onAccent} />}
        onPress={handlePay}
      />
      <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
        {isAdmin
          ? 'Recording a collection updates the invoice and creates an auditable receipt.'
          : isRazorpayCheckoutAvailable()
            ? 'Secured by Razorpay · UPI, cards & net banking'
            : 'Build with `expo run:android` to enable Razorpay Checkout (not available in Expo Go).'}
      </AppText>
    </Screen>
  );
}

function PaymentSuccess({ result }: { result: PayResponse }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.successHero}>
        <PaymentSuccessAnimation />
        <AppText variant="title" style={{ textAlign: 'center', marginTop: Spacing.two }}>
          Payment Successful
        </AppText>
        <AppText variant="display" style={{ color: theme.success }}>
          {formatINR(result.receipt.totalPaid)}
        </AppText>
        <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          {formatMonth(result.receipt.month)} maintenance · {result.receipt.paymentMode}
        </AppText>
      </View>

      <Card style={{ gap: Spacing.one }}>
        <SuccessRow label="Receipt No" value={result.receipt.receiptNo} />
        <SuccessRow label="Invoice No" value={result.receipt.invoiceNo} />
        <SuccessRow label="Reference / UTR" value={result.utr} />
        <SuccessRow label="Date" value={formatDate(result.receipt.paymentDate)} />
        <SuccessRow
          label="Remaining Balance"
          value={result.invoice.outstanding > 0 ? formatINR(result.invoice.outstanding) : 'Fully paid'}
        />
      </Card>

      <Button
        title="View Receipt"
        icon={<Feather name="file-text" size={18} color={theme.onPrimary} />}
        onPress={() =>
          router.replace({ pathname: '/receipt/[receiptNo]', params: { receiptNo: result.receipt.receiptNo } })
        }
      />
      <Button title="Done" variant="outline" onPress={() => router.dismissTo('/(tabs)')} />
    </Screen>
  );
}

function SuccessRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant="body" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodySemi">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.half,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontFamily: Fonts.bold,
    minHeight: 60,
  },
  presetRow: { flexDirection: 'row', gap: Spacing.one },
  preset: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.onehalf,
    paddingVertical: 6,
  },
  hero: { gap: Spacing.half, padding: Spacing.three },
  heroRows: { gap: Spacing.one, marginTop: Spacing.onehalf, marginBottom: Spacing.onehalf },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.onehalf,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: Radius.md + 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.onehalf,
    minHeight: 64,
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCheck: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.onehalf,
    borderRadius: Radius.sm,
  },
  successHero: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.three },
});
