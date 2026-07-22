import { useWindowDimensions, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
  html: string;
  style?: ViewStyle;
};

/**
 * Renders the formal invoice/receipt HTML document — responsive on all screen sizes.
 */
export function InvoiceDocumentView({ html, style }: Props) {
  const { width, height } = useWindowDimensions();
  const frameWidth = Math.max(280, width - 32);
  const docHeight = Math.max(420, Math.min(Math.round(height * 0.58), 780));

  if (Platform.OS === 'web') {
    const Iframe = 'iframe' as unknown as React.ComponentType<{
      srcDoc: string;
      title: string;
      style: React.CSSProperties;
    }>;
    return (
      <View style={[styles.frame, { minHeight: docHeight, width: frameWidth }, style]}>
        <Iframe
          srcDoc={html}
          title="Document"
          style={{ width: '100%', minHeight: docHeight, border: 'none', backgroundColor: '#fff' }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.frame, { minHeight: docHeight, width: frameWidth }, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled
        showsVerticalScrollIndicator
        showsHorizontalScrollIndicator={false}
        style={[styles.webview, { minHeight: docHeight, width: frameWidth }]}
        nestedScrollEnabled
        scalesPageToFit
        setBuiltInZoomControls
        setDisplayZoomControls={false}
        androidLayerType="hardware"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    maxWidth: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
