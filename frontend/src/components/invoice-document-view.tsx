import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
  html: string;
  style?: ViewStyle;
};

/**
 * Renders the formal invoice HTML document — same layout as the admin console.
 */
export function InvoiceDocumentView({ html, style }: Props) {
  if (Platform.OS === 'web') {
    const Iframe = 'iframe' as unknown as React.ComponentType<{
      srcDoc: string;
      title: string;
      style: React.CSSProperties;
    }>;
    return (
      <View style={[styles.frame, style]}>
        <Iframe
          srcDoc={html}
          title="Invoice"
          style={{ width: '100%', minHeight: 900, border: 'none', backgroundColor: '#fff' }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.frame, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.webview}
        nestedScrollEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    minHeight: 720,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    minHeight: 720,
    backgroundColor: '#fff',
  },
});
