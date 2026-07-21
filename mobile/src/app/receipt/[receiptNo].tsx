import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { apiErrorMessage } from '@/api/client';
import { SocietyLogo } from '@/components/society-logo';
import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useReceipt, useSocietySettings } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { amountInWords } from '@/utils/amount-in-words';
import { formatDate, formatINR, formatMonth } from '@/utils/format';
import { receiptHtml, sharePdf } from '@/utils/pdf';

export default function ReceiptDetailScreen() {
  const { receiptNo } = useLocalSearchParams<{ receiptNo: string }>();
  const theme = useTheme();
  const receipt = useReceipt(receiptNo ?? '');
  const settings = useSocietySettings();
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  async function handleShare() {
    if (!receipt.data || !settings.data) return;
    setSharing(true);
    setShareError(null);
    try {
      await sharePdf(receiptHtml(receipt.data, settings.data), `${receipt.data.receiptNo}.pdf`);
    } catch (error) {
      setShareError(apiErrorMessage(error));
    } finally {
      setSharing(false);
    }
  }

  if (receipt.isPending || settings.isPending) {
    return (
      <Screen>
        <Skeleton height={110} radius={Radius.lg} />
        <Skeleton height={280} radius={Radius.lg} />
        <Skeleton height={52} radius={Radius.md} />
      </Screen>
    );
  }

  if (receipt.isError || settings.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState
          message={apiErrorMessage(receipt.error ?? settings.error)}
          onRetry={() => {
            receipt.refetch();
            settings.refetch();
          }}
        />
      </Screen>
    );
  }

  const rcpt = receipt.data;

  return (
    <Screen>
      {/* Society header */}
      <Card style={styles.societyHeader}>
        <SocietyLogo settings={settings.data} size={56} />
        <View style={{ flex: 1 }}>
          <AppText variant="heading" style={{ color: theme.primary }}>
            {rcpt.societyName}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {settings.data.address}
          </AppText>
        </View>
      </Card>

      {/* Amount hero */}
      <Card style={styles.hero}>
        <View style={[styles.successCircle, { backgroundColor: theme.successSoft }]}>
          <Feather name="check" size={30} color={theme.success} />
        </View>
        <AppText variant="display" style={{ color: theme.success }}>
          {formatINR(rcpt.totalPaid)}
        </AppText>
        <Badge label="PAID" tone="success" />
        <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
          {amountInWords(rcpt.totalPaid)}
        </AppText>
      </Card>

      {/* Details */}
      <Card style={{ gap: Spacing.onehalf }}>
        <DetailRow label="Receipt No" value={rcpt.receiptNo} />
        <DetailRow label="Against Invoice" value={rcpt.invoiceNo} />
        <DetailRow label="For Month" value={formatMonth(rcpt.month)} />
        <DetailRow label="Received From" value={rcpt.ownerName} />
        <DetailRow label="Flat" value={`${rcpt.flatNo}${rcpt.wing ? ` · Wing ${rcpt.wing}` : ''}`} />
        <DetailRow label="Payment Date" value={formatDate(rcpt.paymentDate)} />
        <DetailRow label="Payment Mode" value={rcpt.paymentMode} />
        <DetailRow label="Reference / UTR" value={rcpt.utr} />
        <DetailRow label="Bank" value={rcpt.bank} />
        <DetailRow label="Collected By" value={rcpt.collectedBy} />
      </Card>

      {shareError ? (
        <AppText variant="caption" style={{ color: theme.error, textAlign: 'center' }}>
          {shareError}
        </AppText>
      ) : null}

      <Button
        title="Share PDF"
        loading={sharing}
        icon={<Feather name="share-2" size={18} color={theme.onPrimary} />}
        onPress={handleShare}
      />
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <AppText variant="body" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodySemi" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  societyHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.onehalf },
  hero: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.three },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
