import { useMemo, useState } from 'react';
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
  const minHeight = Math.max(520, Math.min(Math.round(height * 0.72), 960));
  const [contentHeight, setContentHeight] = useState(minHeight);
  const injectedJavaScript = useMemo(
    () => `
      (function() {
        const postHeight = function() {
          const root = document.documentElement;
          const body = document.body;
          const next = Math.max(
            body ? body.scrollHeight : 0,
            root ? root.scrollHeight : 0,
            body ? body.offsetHeight : 0,
            root ? root.offsetHeight : 0
          );
          window.ReactNativeWebView?.postMessage(String(next));
        };
        postHeight();
        window.addEventListener('load', postHeight);
        setTimeout(postHeight, 150);
        setTimeout(postHeight, 500);
      })();
      true;
    `,
    []
  );

  if (Platform.OS === 'web') {
    const Iframe = 'iframe' as unknown as React.ComponentType<{
      srcDoc: string;
      title: string;
      style: React.CSSProperties;
    }>;
    return (
      <View style={[styles.frame, { minHeight, width: frameWidth }, style]}>
        <Iframe
          srcDoc={html}
          title="Document"
          style={{ width: '100%', minHeight, border: 'none', backgroundColor: '#fff' }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.frame, { minHeight: contentHeight, width: frameWidth }, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled={false}
        showsVerticalScrollIndicator
        showsHorizontalScrollIndicator={false}
        style={[styles.webview, { height: contentHeight, width: frameWidth }]}
        scalesPageToFit
        setBuiltInZoomControls
        setDisplayZoomControls={false}
        androidLayerType="hardware"
        injectedJavaScript={injectedJavaScript}
        onMessage={(event) => {
          const next = Number(event.nativeEvent.data);
          if (!Number.isFinite(next) || next <= 0) return;
          setContentHeight(Math.max(minHeight, Math.min(next + 12, 2200)));
        }}
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
