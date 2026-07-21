import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useInvoice, useSocietySettings } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { invoiceDocumentHtml } from '@/utils/invoice-document-html';
import { formatINR } from '@/utils/format';
import { sharePdf } from '@/utils/pdf';

export default function InvoiceDetailScreen() {
  const { invoiceNo } = useLocalSearchParams<{ invoiceNo: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const invoice = useInvoice(invoiceNo ?? '');
  const settings = useSocietySettings();
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const html = useMemo(() => {
    if (!invoice.data || !settings.data) return '';
    return invoiceDocumentHtml(invoice.data, settings.data);
  }, [invoice.data, settings.data]);

  async function handleShare() {
    if (!html) return;
    setSharing(true);
    setShareError(null);
    try {
      await sharePdf(html, `${invoice.data!.invoiceNo}.pdf`);
    } catch (error) {
      setShareError(apiErrorMessage(error));
    } finally {
      setSharing(false);
    }
  }

  if (invoice.isPending || settings.isPending) {
    return (
      <Screen>
        <Skeleton height={110} radius={Radius.lg} />
        <Skeleton height={720} radius={Radius.lg} />
        <Skeleton height={52} radius={Radius.md} />
      </Screen>
    );
  }

  if (invoice.isError || settings.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState
          message={apiErrorMessage(invoice.error ?? settings.error)}
          onRetry={() => {
            invoice.refetch();
            settings.refetch();
          }}
        />
      </Screen>
    );
  }

  const inv = invoice.data;
  const canPay = inv.outstanding > 0 && inv.status !== 'Cancelled';

  return (
    <Screen contentStyle={styles.screen}>
      <Card style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="title">{inv.invoiceNo}</AppText>
            <AppText variant="caption" color="textSecondary">
              Payable {formatINR(inv.totalAmount)}
              {inv.paidAmount > 0 ? ` · Outstanding ${formatINR(inv.outstanding)}` : ''}
            </AppText>
          </View>
          <StatusBadge status={inv.status} />
        </View>
      </Card>

      <InvoiceDocumentView html={html} style={styles.document} />

      {shareError ? (
        <AppText variant="caption" style={{ color: theme.error, textAlign: 'center' }}>
          {shareError}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {canPay ? (
          <Button
            title={`${isAdmin ? 'Record payment' : 'Pay'} ${formatINR(inv.outstanding)}`}
            icon={<Feather name="zap" size={18} color={theme.onPrimary} />}
            onPress={() => router.push({ pathname: '/pay/[invoiceNo]', params: { invoiceNo: inv.invoiceNo } })}
          />
        ) : null}
        <Button
          title="Share PDF"
          variant={canPay ? 'outline' : 'primary'}
          loading={sharing}
          icon={<Feather name="share-2" size={18} color={canPay ? theme.text : theme.onPrimary} />}
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
  document: { minHeight: 760 },
  actions: { gap: Spacing.onehalf },
});
