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
import { useInvoice, useSocietySettings } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { invoiceDocumentHtml } from '@/utils/invoice-document-html';
import { formatINR, formatMonth } from '@/utils/format';
import { downloadPdf, sharePdf } from '@/utils/pdf';

export default function InvoiceDetailScreen() {
  const { invoiceNo } = useLocalSearchParams<{ invoiceNo: string }>();
  const theme = useTheme();
  const invoice = useInvoice(invoiceNo ?? '');
  const settings = useSocietySettings();
  const retryInvoice = () => {
    void invoice.refetch();
  };
  const retryAll = () => {
    void invoice.refetch();
    void settings.refetch();
  };
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const html = useMemo(() => {
    if (!invoice.data || !settings.data) return '';
    return invoiceDocumentHtml(invoice.data, settings.data);
  }, [invoice.data, settings.data]);

  async function handleShare() {
    if (!html || !invoice.data) return;
    setSharing(true);
    setActionError(null);
    try {
      await sharePdf(html, `${invoice.data.invoiceNo}.pdf`);
    } catch (error) {
      setActionError(apiErrorMessage(error));
    } finally {
      setSharing(false);
    }
  }

  async function handleDownload() {
    if (!html || !invoice.data) return;
    setDownloading(true);
    setActionError(null);
    try {
      await downloadPdf(html, `${invoice.data.invoiceNo}.pdf`);
    } catch (error) {
      setActionError(apiErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  if (invoice.isPending || settings.isPending) {
    return (
      <Screen>
        <Skeleton height={110} />
        <Skeleton height={520} />
        <Skeleton height={52} />
      </Screen>
    );
  }

  if (invoice.isError || settings.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState
          message={apiErrorMessage(invoice.error ?? settings.error)}
          onRetry={retryAll}
        />
      </Screen>
    );
  }

  const inv = invoice.data;
  if (!inv) {
    return (
      <Screen scroll={false}>
        <ErrorState message="Invoice not found" onRetry={retryInvoice} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.screen}>
      <Card style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryText}>
            <AppText variant="bodySemi" numberOfLines={2} style={styles.invoiceNo}>
              {inv.invoiceNo}
            </AppText>
            <AppText variant="caption" color="textSecondary" numberOfLines={2}>
              {formatMonth(inv.month)} · {formatINR(inv.totalAmount)}
              {inv.outstanding > 0 ? ` · Due ${formatINR(inv.outstanding)}` : ''}
            </AppText>
          </View>
          <StatusBadge status={inv.status} />
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
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  summaryText: { flex: 1, minWidth: 0, gap: 2, paddingRight: Spacing.one },
  invoiceNo: { flexShrink: 1 },
  row: { flexDirection: 'row', gap: Spacing.one, width: '100%' },
  half: { flex: 1, minWidth: 0 },
});
