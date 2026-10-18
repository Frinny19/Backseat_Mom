import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Saves text to a temporary file and opens the share sheet. */
export async function shareText(name: string, content: string, mimeType: string, uti: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: name });
}

/** Renders HTML to a PDF and opens the share sheet (print dialog on the web). */
export async function sharePdf(name: string, html: string) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const file = new File(uri);
  const named = new File(Paths.cache, name);
  if (named.exists) named.delete();
  file.move(named);
  await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
}
