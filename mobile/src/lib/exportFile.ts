import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { Alert } from 'react-native';
import api from './api';
import { renderReceiptHtml, type ReceiptData } from './receipt';

export const shareReceipt = async (data: ReceiptData, portfolioName?: string) => {
  try {
    const html = renderReceiptHtml(data, portfolioName);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: data.title });
    } else {
      Alert.alert('Receipt ready', `Saved to ${uri}`);
    }
  } catch (err: any) {
    Alert.alert('Unable to generate receipt', err?.message || 'Please try again.');
  }
};

export const downloadAndShareReport = async (
  path: string,
  params: Record<string, string>,
  fileName: string,
  format: 'pdf' | 'excel'
) => {
  try {
    const response = await api.get(path, { params: { ...params, format }, responseType: 'arraybuffer' });
    const bytes = new Uint8Array(response.data as ArrayBuffer);
    const file = new File(new Directory(Paths.cache), fileName);
    if (file.exists) file.delete();
    file.write(bytes);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: fileName
      });
    } else {
      Alert.alert('Report ready', `Saved to ${file.uri}`);
    }
  } catch (err: any) {
    let message = err?.response?.data?.message || err?.message || 'Unable to download this report.';
    if (err?.response?.data instanceof ArrayBuffer) {
      try {
        const text = new TextDecoder().decode(err.response.data);
        const parsed = JSON.parse(text);
        message = parsed?.message || message;
      } catch {
        // keep fallback message
      }
    }
    Alert.alert('Unable to download report', message);
  }
};
