import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { apiErrorMessage } from '@/api/client';
import { InvoiceDocumentView } from '@/components/invoice-document-view';
import { AppText } from '@/components/ui/app-text';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useReceipt, useSocietySettings } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { formatINR } from '@/utils/format';
import { downloadPdf, receiptHtml, sharePdf } from '@/utils/pdf';

export default function ReceiptDetailScreen() {
  const { receiptNo } = useLocalSearchParams<{ receiptNo: string }>();
  const theme = useTheme();
  const receipt = useReceipt(receiptNo ?? '');
  const settings = useSocietySettings();
  const retryReceipt = () => {
    void receipt.refetch();
  };
  const retryAll = () => {
    void receipt.refetch();
    void settings.refetch();
  };
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const html = useMemo(() => {
    if (!receipt.data || !settings.data) return '';
    return receiptHtml(receipt.data, settings.data);
  }, [receipt.data, settings.data]);

  async function handleShare() {
    if (!html || !receipt.data) return;
    setSharing(true);
    setActionError(null);
    try {
      await sharePdf(html, `${receipt.data.receiptNo}.pdf`);
    } catch (error) {
      setActionError(apiErrorMessage(error));
    } finally {
      setSharing(false);
    }
  }

  async function handleDownload() {
    if (!html || !receipt.data) return;
    setDownloading(true);
    setActionError(null);
    try {
      await downloadPdf(html, `${receipt.data.receiptNo}.pdf`);
    } catch (error) {
      setActionError(apiErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  if (receipt.isPending || settings.isPending) {
    return (
      <Screen>
        <Skeleton height={110} />
        <Skeleton height={520} />
        <Skeleton height={52} />
      </Screen>
    );
  }

  if (receipt.isError || settings.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState
          message={apiErrorMessage(receipt.error ?? settings.error)}
          onRetry={retryAll}
        />
      </Screen>
    );
  }

  const rcpt = receipt.data;
  if (!rcpt) {
    return (
      <Screen scroll={false}>
        <ErrorState message="Receipt not found" onRetry={retryReceipt} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.screen}>
      <Card style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryText}>
            <AppText variant="bodySemi" numberOfLines={2}>
              {rcpt.receiptNo}
            </AppText>
            <AppText variant="caption" color="textSecondary" numberOfLines={2}>
              {rcpt.invoiceNo} · {formatINR(rcpt.totalPaid)}
            </AppText>
          </View>
          <StatusBadge status="Paid" />
        </View>
      </Card>

      <InvoiceDocumentView html={html} />

      {actionError ? (
        <AppText variant="caption" style={{ color: theme.error, textAlign: 'center' }}>
          {actionError}
        </AppText>
      ) : null}

      <View style={styles.row}>
        <Button
          title="Download"
          variant="secondary"
          style={styles.half}
          loading={downloading}
          icon={<Feather name="download" size={18} color={theme.onAccent} />}
          onPress={handleDownload}
        />
        <Button
          title="Share"
          variant="outline"
          style={styles.half}
          loading={sharing}
          icon={<Feather name="share-2" size={18} color={theme.text} />}
          onPress={handleShare}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: Spacing.two, paddingBottom: Spacing.three },
  summary: { gap: Spacing.one },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.one },
  summaryText: { flex: 1, minWidth: 0, gap: 2, paddingRight: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.one, width: '100%' },
  half: { flex: 1, minWidth: 0 },
});
