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
  const docHeight = Math.max(480, Math.min(height * 0.62, 920));

  if (Platform.OS === 'web') {
    const Iframe = 'iframe' as unknown as React.ComponentType<{
      srcDoc: string;
      title: string;
      style: React.CSSProperties;
    }>;
    return (
      <View style={[styles.frame, { minHeight: docHeight }, style]}>
        <Iframe
          srcDoc={html}
          title="Document"
          style={{ width: '100%', minHeight: docHeight, border: 'none', backgroundColor: '#fff' }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.frame, { minHeight: docHeight, width: width - 32 }, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        style={[styles.webview, { minHeight: docHeight }]}
        nestedScrollEnabled
        scalesPageToFit
        setBuiltInZoomControls={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
