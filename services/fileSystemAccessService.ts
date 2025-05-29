
import { FestivalInfo } from '../types';

// Type definitions for File System Access API
// These might be available in future versions of TypeScript's lib.dom.d.ts
// For now, we define them manually.

interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: FileSystemWritableFileStreamOptions): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory';
  getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
  removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
  entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
}

interface FileSystemWritableFileStreamOptions {
  keepExistingData?: boolean;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string | WriteParams): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface WriteParams {
  type: 'write' | 'seek' | 'truncate';
  data?: BufferSource | Blob | string;
  position?: number;
  size?: number;
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemGetFileOptions {
  create?: boolean;
}

interface FileSystemGetDirectoryOptions {
  create?: boolean;
}

interface FileSystemRemoveOptions {
  recursive?: boolean;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string | string[]>;
}

interface FilePickerOptions {
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
  id?: string;
  startIn?: WellKnownDirectory | FileSystemHandle;
}

interface OpenFilePickerOptions extends FilePickerOptions {
  multiple?: boolean;
}

interface SaveFilePickerOptions extends FilePickerOptions {
  suggestedName?: string;
}

type WellKnownDirectory =
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos';

// Augment the Window interface
declare global {
  interface Window {
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  }
}


export interface FileSystemAccessResult<T = void> {
  success: boolean;
  message: string;
  data?: T;
}

export function canUseFileSystemAccessApi(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

const DEFAULT_FILE_OPTIONS: SaveFilePickerOptions = { 
  suggestedName: 'festivals_backup.json',
  types: [
    {
      description: 'JSON Files',
      accept: {
        'application/json': ['.json'],
      },
    },
  ],
};

export async function saveFestivalsToFileSystem(festivals: FestivalInfo[]): Promise<FileSystemAccessResult> {
  if (!canUseFileSystemAccessApi()) {
    return { success: false, message: 'مرورگر شما از قابلیت ذخیره مستقیم فایل پشتیبانی نمی‌کند.' };
  }

  try {
    const fileHandle = await window.showSaveFilePicker(DEFAULT_FILE_OPTIONS);
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(festivals, null, 2)); 
    await writable.close();
    return { success: true, message: `اطلاعات با موفقیت در فایل "${fileHandle.name}" ذخیره شد.` };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, message: 'عملیات ذخیره‌سازی توسط کاربر لغو شد.' };
    }
    console.error('Error saving festivals to file system:', error);
    if (error.message && typeof error.message === 'string' && error.message.toLowerCase().includes('cross origin sub frame')) {
      return { 
        success: false, 
        message: 'مرورگر اجازه دسترسی مستقیم به فایل‌ها را در این محیط نداد. این ممکن است به دلیل محدودیت‌های امنیتی (مانند اجرا در یک فریم تو در تو با مبدا متفاوت) باشد.' 
      };
    }
    return { success: false, message: `خطا در ذخیره‌سازی فایل: ${error.message}` };
  }
}

export async function loadFestivalsFromFileSystem(): Promise<FileSystemAccessResult<FestivalInfo[]>> {
  if (!canUseFileSystemAccessApi()) {
    return { success: false, message: 'مرورگر شما از قابلیت بارگذاری مستقیم فایل پشتیبانی نمی‌کند.' };
  }

  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: DEFAULT_FILE_OPTIONS.types, 
      multiple: false,
    });
    const file = await fileHandle.getFile();
    const contents = await file.text();
    const parsedData = JSON.parse(contents);

    if (!Array.isArray(parsedData)) {
      throw new Error('فایل انتخاب شده شامل آرایه‌ای از اطلاعات فراخوان‌ها نیست.');
    }
    const isValidData = parsedData.every(item => typeof item === 'object' && item !== null && 'id' in item && ('festivalName' in item || 'fileName' in item) ); // Loosened check slightly
    if (!isValidData) {
        throw new Error('ساختار داده‌های داخل فایل نامعتبر است. لطفاً مطمئن شوید فایل پشتیبان صحیح را انتخاب کرده‌اید.');
    }

    return { success: true, message: `اطلاعات از فایل "${file.name}" با موفقیت بارگذاری شد.`, data: parsedData as FestivalInfo[] };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, message: 'عملیات بارگذاری توسط کاربر لغو شد.' };
    }
    console.error('Error loading festivals from file system:', error);
     if (error.message && typeof error.message === 'string' && error.message.toLowerCase().includes('cross origin sub frame')) {
      return { 
        success: false, 
        message: 'مرورگر اجازه دسترسی مستقیم به فایل‌ها را در این محیط نداد. این ممکن است به دلیل محدودیت‌های امنیتی (مانند اجرا در یک فریم تو در تو با مبدا متفاوت) باشد.' 
      };
    }
    return { success: false, message: `خطا در بارگذاری فایل: ${error.message}` };
  }
}

export async function readJsonFromFile(file: File): Promise<FileSystemAccessResult<FestivalInfo[]>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const contents = event.target?.result as string;
        if (!contents) {
          throw new Error('فایل خالی است یا قابل خواندن نیست.');
        }
        const parsedData = JSON.parse(contents);

        if (!Array.isArray(parsedData)) {
          throw new Error('فایل انتخاب شده شامل آرایه‌ای از اطلاعات فراخوان‌ها نیست.');
        }
        // Basic validation for FestivalInfo structure
        const isValidData = parsedData.every(
          item => typeof item === 'object' && item !== null && 'id' in item && ('festivalName' in item || 'fileName' in item)
        );
        if (!isValidData) {
          throw new Error('ساختار داده‌های داخل فایل نامعتبر است. لطفاً مطمئن شوید فایل پشتیبان صحیح را انتخاب کرده‌اید.');
        }
        resolve({ success: true, message: `اطلاعات از فایل "${file.name}" با موفقیت بارگذاری و پردازش شد.`, data: parsedData as FestivalInfo[] });
      } catch (error: any) {
        console.error('Error reading or parsing JSON from file:', error);
        resolve({ success: false, message: `خطا در خواندن یا پردازش فایل JSON: ${error.message}` });
      }
    };
    reader.onerror = (eventError) => { // eventError is ProgressEvent<FileReader>
      console.error('FileReader error event:', eventError);
      // The actual error is in reader.error
      const errorMessage = reader.error?.message || 'Unknown FileReader error';
      resolve({ success: false, message: `خطا در خواندن فایل: ${errorMessage}` });
    };
    reader.readAsText(file, 'UTF-8'); // Specify UTF-8 encoding
  });
}
