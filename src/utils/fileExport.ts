import { NativeModules, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_MIME_TYPE = 'text/csv';
const CSV_BOM = '\uFEFF';

export type FileExportMethod = 'browser' | 'downloads' | 'share-sheet' | 'app-storage';

export interface FileExportResult {
  fileName: string;
  uri?: string;
  method: FileExportMethod;
  title: string;
  message: string;
}

export type CsvExportResult = FileExportResult;

type LadDownloadsModule = {
  saveBase64File?: (fileName: string, mimeType: string, base64Data: string) => Promise<string>;
};

const cleanFileName = (fileName: string, fallbackExtension: string) =>
  (fileName.trim() || `lad-export-${Date.now()}.${fallbackExtension}`)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ');

const ensureExtension = (fileName: string, extension: string) =>
  fileName.toLowerCase().endsWith(`.${extension}`) ? fileName : `${fileName}.${extension}`;

const base64ToUint8Array = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const textToBase64 = (text: string) => {
  if (typeof btoa !== 'function') {
    throw new Error('This device cannot encode the export file.');
  }
  return btoa(unescape(encodeURIComponent(text)));
};

const saveBase64File = async (
  fileName: string,
  mimeType: string,
  base64Data: string,
  dialogTitle: string,
): Promise<FileExportResult> => {
  if (Platform.OS === 'web') {
    const blob = new Blob([base64ToUint8Array(base64Data)], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return {
      fileName,
      method: 'browser',
      title: 'Download started',
      message: `${fileName} is downloading.`,
    };
  }

  const nativeDownloads = NativeModules.LadDownloads as LadDownloadsModule | undefined;
  if (Platform.OS === 'android' && nativeDownloads?.saveBase64File) {
    const uri = await nativeDownloads.saveBase64File(fileName, mimeType, base64Data);
    return {
      fileName,
      uri,
      method: 'downloads',
      title: 'Downloaded',
      message: `${fileName} was saved directly to Downloads.`,
    };
  }

  const FileSystem = await import('expo-file-system/legacy');
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('File downloads are not available on this device.');
  }
  const uri = `${directory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64Data, { encoding: FileSystem.EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType,
      UTI: mimeType === XLSX_MIME_TYPE ? 'org.openxmlformats.spreadsheetml.sheet' : 'public.comma-separated-values-text',
      dialogTitle,
    });
    return {
      fileName,
      uri,
      method: 'share-sheet',
      title: 'Export ready',
      message: `Choose where to save or share ${fileName}.`,
    };
  }

  return {
    fileName,
    uri,
    method: 'app-storage',
    title: 'Saved in app storage',
    message: `${fileName} was saved inside the app storage.`,
  };
};

export async function exportXlsxRowsFile(
  fileName: string,
  sheetName: string,
  rows: unknown[][],
  dialogTitle = 'Save Excel export',
): Promise<FileExportResult> {
  const safeFileName = cleanFileName(ensureExtension(fileName, 'xlsx'), 'xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31) || 'Export');
  const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  return saveBase64File(safeFileName, XLSX_MIME_TYPE, base64, dialogTitle);
}

export async function exportCsvFile(fileName: string, csv: string, dialogTitle = 'Save CSV export'): Promise<FileExportResult> {
  const safeFileName = cleanFileName(ensureExtension(fileName, 'csv'), 'csv');
  const contents = csv.startsWith(CSV_BOM) ? csv : `${CSV_BOM}${csv}`;

  if (Platform.OS === 'web') {
    const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return {
      fileName: safeFileName,
      method: 'browser',
      title: 'Download started',
      message: `${safeFileName} is downloading.`,
    };
  }

  return saveBase64File(safeFileName, CSV_MIME_TYPE, textToBase64(contents), dialogTitle);
}
