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
    <Screen contentStyle={styles.screen}>
      <Card style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="title">{rcpt.receiptNo}</AppText>
            <AppText variant="caption" color="textSecondary">
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
          variant="outline"
          style={styles.half}
          loading={downloading}
          icon={<Feather name="download" size={18} color={theme.primary} />}
          onPress={handleDownload}
        />
        <Button
          title="Share"
          variant="outline"
          style={styles.half}
          loading={sharing}
          icon={<Feather name="share-2" size={18} color={theme.primary} />}
          onPress={handleShare}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: Spacing.two },
  summary: { gap: Spacing.one },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.one },
  half: { flex: 1 },
});
