
import React, { useState, useCallback } from 'react';
import { useFestivals } from '../contexts/FestivalsContext';
import { FestivalInfo, ExtractedData, FestivalSourceFile } from '../types';
import { extractTextFromPdf, fileToBase64 } from '../services/fileProcessingService';
import { extractTextFromImageViaGemini, extractFestivalInfoFromTextViaGemini } from '../services/geminiService';
import { UploadCloud, FileText, Type, AlertCircle, CheckCircle, X, Image as ImageIcon, AlertTriangle, Edit2 } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { FestivalModal } from './FestivalModal';

const MIN_CHARS_FOR_IMAGE_TEXT = 30;
const MIN_CHARS_FOR_INPUT_TEXT = 50;

interface ProcessingWarning {
  type: 'shortImageText' | 'shortInputText';
  message: string;
  dataToProcess?: string; // Store the extracted text or input text here
}

export const FileUploadArea: React.FC = () => {
  const { addFestival, setIsLoading, isLoading } = useFestivals();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]); 
  const [pdfPreview, setPdfPreview] = useState<boolean>(false); 
  const [textInput, setTextInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [processingWarning, setProcessingWarning] = useState<ProcessingWarning | null>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [initialModalData, setInitialModalData] = useState<Partial<FestivalInfo> | null>(null);

  const resetInputState = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setPdfPreview(false);
    setTextInput('');
    setError(null);
    setProcessingMessage(null);
    setProcessingWarning(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Clear previous general error/processing messages and text input
    setError(null);
    setProcessingMessage(null);
    setProcessingWarning(null);
    setTextInput(''); // Clear text input as file input takes precedence

    const files = event.target.files;
    const currentFileInput = event.target;

    if (files && files.length > 0) {
      // Clear previous file-specific states before processing new ones
      setSelectedFiles([]);
      setFilePreviews([]);
      setPdfPreview(false);

      const newFilesArray = Array.from(files);
      const validImageTypes = ['image/jpeg', 'image/png'];
      const validPdfType = 'application/pdf';

      const isPdfSelected = newFilesArray.some(f => f.type === validPdfType);
      const areAllImages = newFilesArray.every(f => validImageTypes.includes(f.type));

      if (isPdfSelected && newFilesArray.length > 1) {
        setError('فقط یک فایل PDF قابل انتخاب است. برای بارگذاری چندین فایل، همه باید تصویر باشند.');
        setSelectedFiles([]); setFilePreviews([]); setPdfPreview(false);
        if (currentFileInput) currentFileInput.value = ''; // Clear the actual input element
        return;
      }
      if (isPdfSelected && newFilesArray.length === 1) {
        setSelectedFiles(newFilesArray);
        setFilePreviews([]); 
        setPdfPreview(true);
      } else if (areAllImages && newFilesArray.length > 0) {
        setSelectedFiles(newFilesArray);
        const previews: string[] = [];
        for (const file of newFilesArray) {
          try {
            const base64 = await fileToBase64(file);
            previews.push(base64);
          } catch (err) {
            setError(`خطا در خواندن فایل ${file.name}`);
            setSelectedFiles([]); setFilePreviews([]); setPdfPreview(false);
            if (currentFileInput) currentFileInput.value = ''; // Clear the actual input element
            return;
          }
        }
        setFilePreviews(previews);
        setPdfPreview(false);
      } else if (newFilesArray.length > 0) { 
        setError('ترکیب فایل نامعتبر است. لطفاً یا یک فایل PDF، یا یک یا چند فایل تصویر (JPG/PNG) انتخاب کنید.');
        setSelectedFiles([]); setFilePreviews([]); setPdfPreview(false);
        if (currentFileInput) currentFileInput.value = ''; // Clear the actual input element
        return;
      }
      // Successfully processed files, file input element value remains for now
    } else {
      // No files selected (e.g., user cancelled file dialog)
      setSelectedFiles([]);
      setFilePreviews([]);
      setPdfPreview(false);
    }
  };
  
  const handleTextInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    // When text input changes, clear file selections and related states, including the file input element
    setSelectedFiles([]);
    setFilePreviews([]);
    setPdfPreview(false);
    setError(null); 
    setProcessingMessage(null);
    setProcessingWarning(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = ''; // Clear the actual file input element

    setTextInput(event.target.value);
  };

  const _actuallyProcessData = async (data: string, source: 'file' | 'text', originalFileNameForText?: string) => {
    setIsLoading(true);
    setError(null);
    setProcessingWarning(null);
    setProcessingMessage('در حال تحلیل متن و استخراج اطلاعات با Gemini...');

    try {
      const festivalInfoFileName = source === 'file' 
        ? (selectedFiles.length > 1 ? `${selectedFiles[0].name} (+${selectedFiles.length - 1} تصویر دیگر)` : selectedFiles[0].name)
        : (originalFileNameForText || "متن ورودی کاربر.txt");

      const structuredInfo: ExtractedData = await extractFestivalInfoFromTextViaGemini(data, festivalInfoFileName);
      
      let newFestival: Partial<FestivalInfo> = {
        id: crypto.randomUUID(),
        extractedText: data,
        ...structuredInfo,
      };

      if (source === 'file') {
        newFestival = {
          ...newFestival,
          fileName: festivalInfoFileName,
          fileType: selectedFiles.length > 1 ? 'image/multiple' : selectedFiles[0].type,
          filePreview: pdfPreview ? 'pdf' : (filePreviews.length > 0 ? filePreviews[0] : undefined),
          sourceDataUrl: pdfPreview ? await fileToBase64(selectedFiles[0]) : (filePreviews.length > 0 ? filePreviews[0] : undefined),
          sourceFiles: await Promise.all(selectedFiles.map(async (file, idx) => ({
            name: file.name,
            dataUrl: pdfPreview ? await fileToBase64(file) : filePreviews[idx], // Use existing previews for images
            type: file.type,
          }))),
        };
      } else { // source === 'text'
         newFestival = {
          ...newFestival,
          fileName: festivalInfoFileName,
          fileType: "text/plain",
          filePreview: "text_input",
          sourceDataUrl: undefined,
          sourceFiles: [],
        };
      }
      
      setInitialModalData(newFestival);
      setShowModal(true);
      setProcessingMessage('اطلاعات با موفقیت استخراج شد. لطفاً بررسی و ذخیره کنید.');

    } catch (err: any) {
      console.error("Error processing data with Gemini:", err);
      setError(`خطا در پردازش اطلاعات: ${err.message}`);
      setProcessingMessage(null);
    } finally {
      setIsLoading(false);
    }
  };


  const processFile = useCallback(async () => {
    if (selectedFiles.length === 0) {
      setError('لطفاً ابتدا یک یا چند فایل را انتخاب کنید.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProcessingWarning(null);
    setProcessingMessage('در حال آماده‌سازی فایل(ها)...');

    try {
      let extractedText: string | undefined;
      
      if (pdfPreview && selectedFiles.length === 1) {
        const pdfFile = selectedFiles[0];
        setProcessingMessage('در حال استخراج متن از PDF...');
        extractedText = await extractTextFromPdf(pdfFile);
      } else if (filePreviews.length > 0 && selectedFiles.length > 0) {
        setProcessingMessage(`در حال استخراج متن از ${selectedFiles.length} تصویر با Gemini...`);
        const allTexts: string[] = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const imageFile = selectedFiles[i];
          const base64PreviewDataUrl = filePreviews[i];
          const base64DataForGemini = base64PreviewDataUrl.split(',')[1];
          const textFromOneImage = await extractTextFromImageViaGemini(base64DataForGemini, imageFile.type);
          allTexts.push(textFromOneImage);
        }
        extractedText = allTexts.join('\n\n--- متن تصویر بعدی ---\n\n');
        
        if (selectedFiles.length > 0 && selectedFiles[0].type.startsWith('image/') && (!extractedText || extractedText.trim().length < MIN_CHARS_FOR_IMAGE_TEXT)) {
          setProcessingWarning({ 
            type: 'shortImageText', 
            message: 'متن بسیار کمی از تصویر(های) انتخاب شده استخراج شد. این تصویر(ها) ممکن است برای تحلیل فراخوان مناسب نباشد.',
            dataToProcess: extractedText || ""
          });
          setIsLoading(false);
          setProcessingMessage(null);
          return;
        }
      } else {
        throw new Error('نوع فایل پشتیبانی نمی‌شود یا فایلی انتخاب نشده.');
      }
      
      if (!extractedText || extractedText.trim().length === 0) {
        if (pdfPreview) {
          throw new Error('متنی از فایل PDF استخراج نشد. ممکن است خالی باشد یا متن قابل تشخیصی نداشته باشد.');
        }
      }
      
      await _actuallyProcessData(extractedText, 'file');

    } catch (err: any) {
      console.error("Error processing file(s):", err);
      setError(`خطا در پردازش فایل(ها): ${err.message}`);
      setProcessingMessage(null);
      setIsLoading(false);
    }
  }, [selectedFiles, filePreviews, pdfPreview, setIsLoading]);

  const processTextInput = useCallback(async () => {
    const trimmedText = textInput.trim();
    if (!trimmedText) {
      setError('لطفاً ابتدا متنی را وارد کنید.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProcessingWarning(null);
    
    if (trimmedText.length < MIN_CHARS_FOR_INPUT_TEXT) {
      setProcessingWarning({
        type: 'shortInputText',
        message: 'متن وارد شده بسیار کوتاه است. ممکن است برای تحلیل دقیق اطلاعات کافی نباشد.',
        dataToProcess: textInput 
      });
      setIsLoading(false);
      return;
    }
    
    await _actuallyProcessData(textInput, 'text');

  }, [textInput, setIsLoading]);

  const handleProceedWithWarning = () => {
    if (processingWarning?.dataToProcess !== undefined) {
      _actuallyProcessData(processingWarning.dataToProcess, processingWarning.type === 'shortImageText' ? 'file' : 'text', "متن ورودی کاربر (کوتاه).txt");
    }
    setProcessingWarning(null);
  };

  const handleCancelWarning = () => {
    resetInputState(); // This will clear the file input element as well
  };

  const handleSaveFromModal = (festivalData: FestivalInfo) => {
    addFestival(festivalData);
    setShowModal(false);
    resetInputState(); // Clear all inputs after successful save
    setProcessingMessage('فراخوان با موفقیت اضافه شد.');
     setTimeout(() => setProcessingMessage(null), 3000);
  };

  const handleCancelModal = () => {
    setShowModal(false);
    setInitialModalData(null);
    // Do not resetInputState here if user might want to retry with same file/text.
    // However, if the modal was for a *new* entry that was cancelled, clearing inputs might be desired.
    // For now, keeping inputs intact after modal cancel. resetInputState() can be called if explicit clear is needed.
  };


  return (
    <div className="w-full p-6 bg-white rounded-xl shadow-xl">
      <h2 className="text-2xl font-semibold text-teal-700 mb-6 text-center">بارگذاری یا ورود اطلاعات فراخوان</h2>
      
      {!processingWarning && !showModal && (
        <>
          <div className="mb-6">
            <label htmlFor="file-upload" className="cursor-pointer group">
              <div className={`w-full h-40 border-2 border-dashed rounded-lg flex flex-col justify-center items-center transition-colors group-hover:border-teal-500 group-hover:bg-teal-50 ${pdfPreview || filePreviews.length > 0 ? 'border-teal-400 bg-teal-50' : 'border-gray-300'}`}>
                {isLoading && selectedFiles.length > 0 ? (
                  <LoadingSpinner size="8" />
                ) : pdfPreview ? (
                    <FileText className="h-16 w-16 text-red-500 mb-2" />
                ) : filePreviews.length > 0 ? (
                    <div className="w-full h-full p-2 overflow-x-auto whitespace-nowrap flex items-center gap-2">
                        {filePreviews.map((previewUrl, index) => (
                            <img key={index} src={previewUrl} alt={`پیش‌نمایش ${index + 1}`} className="h-28 w-auto object-contain rounded border border-gray-300 shadow-sm inline-block" />
                        ))}
                    </div>
                ) : (
                  <>
                    <UploadCloud className="h-12 w-12 text-gray-400 group-hover:text-teal-500 mb-2 transition-colors" />
                    <p className="text-gray-500 group-hover:text-teal-600 text-sm">فایل PDF یا یک/چند تصویر (JPG/PNG) را بکشید و رها کنید یا کلیک کنید</p>
                  </>
                )}
              </div>
            </label>
            <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
          </div>

          {selectedFiles.length > 0 && (
            <div className="mb-4 text-sm text-gray-700 text-center">
              {selectedFiles.length === 1 ? (
                <>فایل انتخاب شده: <span className="font-semibold">{selectedFiles[0].name}</span> ({Math.round(selectedFiles[0].size / 1024)} KB)</>
              ) : (
                <>{selectedFiles.length} فایل تصویری انتخاب شده.</>
              )}
               <button onClick={resetInputState} className="ms-2 text-xs text-red-500 hover:text-red-700">(پاک کردن انتخاب)</button>
            </div>
          )}
          
          <div className="my-6 flex items-center">
            <hr className="flex-grow border-t border-gray-300"/>
            <span className="px-3 text-gray-500 text-sm">یا</span>
            <hr className="flex-grow border-t border-gray-300"/>
          </div>

          <div className="mb-6">
            <label htmlFor="text-input-area" className="block text-sm font-medium text-gray-700 mb-2 text-center">
              متن فراخوان را اینجا وارد یا پیست کنید:
            </label>
            <textarea
              id="text-input-area"
              value={textInput}
              onChange={handleTextInputChange}
              placeholder="مثال: فراخوان مسابقه عکاسی «نگاهی به شهر من» با موضوعات معماری، زندگی شهری و طبیعت شهری برگزار می‌شود. مهلت ارسال آثار تا تاریخ ۱۴۰۳/۰۸/۱۵..."
              rows={6}
              className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
              disabled={isLoading}
            />
          </div>
        </>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center text-sm">
          <AlertCircle className="h-5 w-5 me-2" /> {error}
           <button onClick={() => setError(null)} className="ms-auto text-red-700 hover:text-red-900">
            <X size={18} />
          </button>
        </div>
      )}
      {processingMessage && !error && !isLoading && !processingWarning && (
         <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center text-sm">
          <CheckCircle className="h-5 w-5 me-2" /> {processingMessage}
           <button onClick={() => setProcessingMessage(null)} className="ms-auto text-green-700 hover:text-green-900">
            <X size={18} />
          </button>
        </div>
      )}
       {isLoading && processingMessage && !processingWarning && (
        <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded-md flex items-center text-sm">
          <LoadingSpinner size="5" className="me-2"/> {processingMessage}
        </div>
      )}

      {processingWarning && !isLoading && (
        <div className="p-4 mb-4 bg-yellow-100 border-r-4 border-yellow-500 text-yellow-800 rounded-md shadow">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 me-3 text-yellow-600 flex-shrink-0" />
            <div className="flex-grow">
              <p className="font-bold">توجه!</p>
              <p className="text-sm">{processingWarning.message}</p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={handleProceedWithWarning}
                  className="px-4 py-1.5 bg-yellow-500 text-white text-sm font-semibold rounded-md hover:bg-yellow-600 transition-colors"
                >
                  ادامه با همین {processingWarning.type === 'shortImageText' ? 'فایل' : 'متن'}
                </button>
                <button
                  onClick={handleCancelWarning}
                  className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 transition-colors"
                >
                  {processingWarning.type === 'shortImageText' ? 'لغو و انتخاب فایل جدید' : 'لغو و ویرایش متن'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!processingWarning && !showModal && (
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <button
            onClick={processFile}
            disabled={selectedFiles.length === 0 || isLoading}
            className="flex-1 px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:text-gray-700 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading && selectedFiles.length > 0 ? <LoadingSpinner /> : <UploadCloud className="me-2 h-5 w-5" />}
            پردازش فایل(ها)
          </button>
          <button
            onClick={processTextInput}
            disabled={textInput.trim() === '' || isLoading}
            className="flex-1 px-6 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 transition-colors disabled:bg-gray-400 disabled:text-gray-700 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading && textInput.trim() !== '' ? <LoadingSpinner /> : <Type className="me-2 h-5 w-5" />}
            پردازش متن وارد شده
          </button>
        </div>
      )}


      {showModal && initialModalData && (
        <FestivalModal
          isOpen={showModal}
          onClose={handleCancelModal}
          festivalData={initialModalData}
          onSave={handleSaveFromModal}
        />
      )}
    </div>
  );
};
