
import React, { useState, useCallback, useRef, DragEvent } from 'react';
import { useFestivals } from '../contexts/FestivalsContext';
import { FestivalInfo, ExtractedData, FestivalSourceFile } from '../types';
import { extractTextFromPdf, fileToBase64 } from '../services/fileProcessingService';
import { extractTextFromImageViaGemini, extractFestivalInfoFromTextViaGemini } from '../services/geminiService';
import { UploadCloud, FileText, Type, AlertCircle, CheckCircle, X, Image as ImageIcon, AlertTriangle, Edit2, XCircle, RefreshCw } from 'lucide-react';
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
  const { addFestival, isLoading: contextIsLoading } = useFestivals();
  const [isSelfProcessing, setIsSelfProcessing] = useState<boolean>(false);
  const [isAttemptingCancel, setIsAttemptingCancel] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]); 
  const [pdfPreview, setPdfPreview] = useState<boolean>(false); 
  const [textInput, setTextInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [processingWarning, setProcessingWarning] = useState<ProcessingWarning | null>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [initialModalData, setInitialModalData] = useState<Partial<FestivalInfo> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const currentOperationAbortControllerRef = useRef<AbortController | null>(null);


  const resetInputState = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setPdfPreview(false);
    setTextInput('');
    setError(null);
    setProcessingMessage(null);
    setProcessingWarning(null);
    setIsAttemptingCancel(false); 
    setIsDragging(false);
    if (currentOperationAbortControllerRef.current) {
        currentOperationAbortControllerRef.current.abort();
        currentOperationAbortControllerRef.current = null;
    }
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };
  
  const handleCancelProcessing = () => {
    if (currentOperationAbortControllerRef.current && !isAttemptingCancel) {
      setIsAttemptingCancel(true);
      setProcessingMessage("درخواست لغو ارسال شد. منتظر پاسخ سرویس..."); 
      currentOperationAbortControllerRef.current.abort();
    }
  };

  const processAndSetFiles = async (files: FileList | null, sourceElement?: HTMLInputElement) => {
    setError(null);
    setProcessingMessage(null);
    setProcessingWarning(null);
    setIsAttemptingCancel(false);
    setTextInput(''); 
    if (currentOperationAbortControllerRef.current) {
        currentOperationAbortControllerRef.current.abort();
        currentOperationAbortControllerRef.current = null;
    }

    if (files && files.length > 0) {
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
        if (sourceElement) sourceElement.value = ''; 
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
            if (sourceElement) sourceElement.value = ''; 
            return;
          }
        }
        setFilePreviews(previews);
        setPdfPreview(false);
      } else if (newFilesArray.length > 0) { 
        setError('ترکیب فایل نامعتبر است. لطفاً یا یک فایل PDF، یا یک یا چند فایل تصویر (JPG/PNG) انتخاب کنید.');
        setSelectedFiles([]); setFilePreviews([]); setPdfPreview(false);
        if (sourceElement) sourceElement.value = ''; 
        return;
      }
    } else {
      setSelectedFiles([]);
      setFilePreviews([]);
      setPdfPreview(false);
    }
  };


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    processAndSetFiles(event.target.files, event.target);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // Check if the leave target is outside the dropzone bounds
    const dropzone = event.currentTarget;
    if (!dropzone.contains(event.relatedTarget as Node)) {
        setIsDragging(false);
    }
  };
  
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // This is necessary to allow dropping
    if (!isDragging) setIsDragging(true); // Ensure dragging state is true
  };
  
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const files = event.dataTransfer.files;
    processAndSetFiles(files);
    // Clear the file input value if files were dropped, as the input itself didn't change
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  
  const handleTextInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setPdfPreview(false);
    setError(null); 
    setProcessingMessage(null);
    setProcessingWarning(null);
    setIsAttemptingCancel(false);
    if (currentOperationAbortControllerRef.current) {
        currentOperationAbortControllerRef.current.abort();
        currentOperationAbortControllerRef.current = null;
    }
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = ''; 

    setTextInput(event.target.value);
  };

  const _actuallyProcessData = async (data: string, source: 'file' | 'text', signal: AbortSignal, originalFileNameForText?: string) => {
    setIsSelfProcessing(true);
    setError(null);
    setProcessingWarning(null);
    if (!isAttemptingCancel) {
        setProcessingMessage('در حال تحلیل متن و استخراج اطلاعات با Gemini...');
    }

    try {
      const festivalInfoFileName = source === 'file' 
        ? (selectedFiles.length > 1 ? `${selectedFiles[0].name} (+${selectedFiles.length - 1} تصویر دیگر)` : selectedFiles[0].name)
        : (originalFileNameForText || "متن ورودی کاربر.txt");

      const structuredInfo: ExtractedData = await extractFestivalInfoFromTextViaGemini(data, festivalInfoFileName, signal);
      
      if (signal.aborted) {
        throw new DOMException('Operation aborted by user after Gemini extraction', 'AbortError');
      }

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
            dataUrl: pdfPreview ? await fileToBase64(file) : filePreviews[idx], 
            type: file.type,
          }))),
        };
      } else { 
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
      const knownAbortMessages = [
        'Operation aborted by user', 
        'Operation aborted by user post-API call', 
        'Operation aborted by user after Gemini extraction'
      ];

      if (err.name === 'AbortError' || (typeof err.message === 'string' && (knownAbortMessages.includes(err.message) || err.message.includes("Operation aborted")))) {
        setError('عملیات پردازش توسط کاربر لغو شد.');
        setProcessingMessage(null);
      } else {
        let displayError = `خطا در پردازش اطلاعات: ${err.message}`;
        if (err.message && typeof err.message === 'string' && 
            (err.message.toLowerCase().includes('api_key') || err.message.toLowerCase().includes('api key')) && 
            (err.message.toLowerCase().includes('environment variables') || err.message.toLowerCase().includes('missing') || err.message.toLowerCase().includes('not initialized'))) {
          displayError = "خطا در ارتباط با سرویس هوش مصنوعی: کلید API مورد نیاز به درستی در محیط برنامه تنظیم نشده است. اگر از Vercel یا پلتفرم مشابهی استفاده می‌کنید، لطفاً مطمئن شوید متغیر محیطی API_KEY در تنظیمات پروژه شما برای محیط صحیح (Production/Preview) تعریف شده است. برای اطلاعات بیشتر، کنسول مرورگر (F12) و لاگ‌های سمت سرور را بررسی کنید.";
        } else if (err.message && typeof err.message === 'string' && err.message.includes("Operation aborted")) { 
             displayError = `خطا در پردازش اطلاعات: ${err.message}`; 
        }
        setError(displayError);
        setProcessingMessage(null);
      }
    } finally {
      setIsSelfProcessing(false);
      setIsAttemptingCancel(false); 
      currentOperationAbortControllerRef.current = null;
    }
  };


  const processFile = useCallback(async () => {
    if (selectedFiles.length === 0) {
      setError('لطفاً ابتدا یک یا چند فایل را انتخاب کنید.');
      return;
    }
    
    const controller = new AbortController();
    currentOperationAbortControllerRef.current = controller;


    setIsSelfProcessing(true);
    setError(null);
    setProcessingWarning(null);
     if (!isAttemptingCancel) {
        setProcessingMessage('در حال آماده‌سازی فایل(ها)...');
    }

    try {
      let extractedText: string | undefined;
      
      if (pdfPreview && selectedFiles.length === 1) {
        const pdfFile = selectedFiles[0];
         if (!isAttemptingCancel) setProcessingMessage('در حال استخراج متن از PDF...');
        extractedText = await extractTextFromPdf(pdfFile); 
        if (controller.signal.aborted) throw new DOMException('Operation aborted during PDF processing', 'AbortError');
      } else if (filePreviews.length > 0 && selectedFiles.length > 0) {
         if (!isAttemptingCancel) setProcessingMessage(`در حال استخراج متن از ${selectedFiles.length} تصویر با Gemini...`);
        const allTexts: string[] = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          if (controller.signal.aborted) throw new DOMException('Operation aborted during image loop', 'AbortError');
          const imageFile = selectedFiles[i];
          const base64PreviewDataUrl = filePreviews[i];
          const base64DataForGemini = base64PreviewDataUrl.split(',')[1];
          const textFromOneImage = await extractTextFromImageViaGemini(base64DataForGemini, imageFile.type, controller.signal);
          allTexts.push(textFromOneImage);
        }
        extractedText = allTexts.join('\n\n--- متن تصویر بعدی ---\n\n');
        
        if (selectedFiles.length > 0 && selectedFiles[0].type.startsWith('image/') && (!extractedText || extractedText.trim().length < MIN_CHARS_FOR_IMAGE_TEXT)) {
          setProcessingWarning({ 
            type: 'shortImageText', 
            message: 'متن بسیار کمی از تصویر(های) انتخاب شده استخراج شد. این تصویر(ها) ممکن است برای تحلیل فراخوان مناسب نباشد.',
            dataToProcess: extractedText || ""
          });
          setIsSelfProcessing(false); 
          setProcessingMessage(null);
          currentOperationAbortControllerRef.current = null; 
          setIsAttemptingCancel(false); 
          return;
        }
      } else {
        throw new Error('نوع فایل پشتیبانی نمی‌شود یا فایلی انتخاب نشده.');
      }
      
      if (controller.signal.aborted) throw new DOMException('Operation aborted before final processing', 'AbortError');

      if (!extractedText || extractedText.trim().length === 0) {
        if (pdfPreview) {
          throw new Error('متنی از فایل PDF استخراج نشد. ممکن است خالی باشد یا متن قابل تشخیصی نداشته باشد.');
        }
      }
      
      await _actuallyProcessData(extractedText, 'file', controller.signal);

    } catch (err: any) {
      console.error("Error processing file(s):", err);
      const knownFileAbortMessages = [
        'Operation aborted by user',
        'Operation aborted by user post-API call',
        'Operation aborted during PDF processing',
        'Operation aborted during image loop',
        'Operation aborted before final processing'
      ];
      if (err.name === 'AbortError' || (typeof err.message === 'string' && (knownFileAbortMessages.includes(err.message) || err.message.includes("Operation aborted")))) {
        setError('عملیات پردازش توسط کاربر لغو شد.');
        setProcessingMessage(null);
      } else {
        let displayError = `خطا در پردازش فایل(ها): ${err.message}`;
        if (err.message && typeof err.message === 'string' && 
            (err.message.toLowerCase().includes('api_key') || err.message.toLowerCase().includes('api key')) && 
            (err.message.toLowerCase().includes('environment variables') || err.message.toLowerCase().includes('missing') || err.message.toLowerCase().includes('not initialized'))) {
          displayError = "خطا در ارتباط با سرویس هوش مصنوعی: کلید API مورد نیاز به درستی در محیط برنامه تنظیم نشده است. اگر از Vercel یا پلتفرم مشابهی استفاده می‌کنید، لطفاً مطمئن شوید متغیر محیطی API_KEY در تنظیمات پروژه شما برای محیط صحیح (Production/Preview) تعریف شده است. برای اطلاعات بیشتر، کنسول مرورگر (F12) و لاگ‌های سمت سرور را بررسی کنید.";
        } else if (err.message && typeof err.message === 'string' && err.message.includes("Operation aborted")) { 
            displayError = `خطا در پردازش فایل(ها): ${err.message}`; 
        }
        setError(displayError);
        setProcessingMessage(null);
      }
    } finally {
        setIsSelfProcessing(false);
        setIsAttemptingCancel(false);
        currentOperationAbortControllerRef.current = null;
    }
  }, [selectedFiles, filePreviews, pdfPreview, isAttemptingCancel]); 

  const processTextInput = useCallback(async () => {
    const trimmedText = textInput.trim();
    if (!trimmedText) {
      setError('لطفاً ابتدا متنی را وارد کنید.');
      return;
    }
    
    const controller = new AbortController();
    currentOperationAbortControllerRef.current = controller;

    setIsSelfProcessing(true);
    setError(null);
    setProcessingWarning(null);
    
    if (trimmedText.length < MIN_CHARS_FOR_INPUT_TEXT) {
      setProcessingWarning({
        type: 'shortInputText',
        message: 'متن وارد شده بسیار کوتاه است. ممکن است برای تحلیل دقیق اطلاعات کافی نباشد.',
        dataToProcess: textInput 
      });
      setIsSelfProcessing(false); 
      currentOperationAbortControllerRef.current = null; 
      setIsAttemptingCancel(false); 
      return;
    }
    
    await _actuallyProcessData(textInput, 'text', controller.signal);

  }, [textInput, isAttemptingCancel]); 

  const handleProceedWithWarning = () => {
    if (processingWarning?.dataToProcess !== undefined) {
      const controller = new AbortController();
      currentOperationAbortControllerRef.current = controller;
      setIsAttemptingCancel(false); 
      _actuallyProcessData(processingWarning.dataToProcess, processingWarning.type === 'shortImageText' ? 'file' : 'text', controller.signal, "متن ورودی کاربر (کوتاه).txt");
    }
    setProcessingWarning(null);
  };

  const handleCancelWarning = () => {
    resetInputState(); 
  };

  const handleSaveFromModal = (festivalData: FestivalInfo) => {
    addFestival(festivalData);
    setShowModal(false);
    resetInputState(); 
    setProcessingMessage('فراخوان با موفقیت اضافه شد.');
     setTimeout(() => setProcessingMessage(null), 3000);
  };

  const handleCancelModal = () => {
    setShowModal(false);
    setInitialModalData(null);
  };

  const isErrorRetryable = error && 
                           (error.includes("لغو شد") || 
                            error.includes("Operation aborted") || 
                            (error.includes("Gemini API") &&  
                             !error.toLowerCase().includes("api_key") && 
                             !error.toLowerCase().includes("api key") && 
                             !error.toLowerCase().includes("environment") &&
                             !error.toLowerCase().includes("not initialized")) ||
                            (error.toLowerCase().includes("failed to fetch") || error.toLowerCase().includes("networkerror")) 
                           );

  const currentLoadingState = isSelfProcessing || contextIsLoading;
  
  const dropZoneBaseClasses = "w-full h-40 border-2 border-dashed rounded-lg flex flex-col justify-center items-center transition-colors group-hover:border-teal-500 group-hover:bg-teal-50";
  const dropZoneActiveClasses = isDragging ? 'border-green-500 bg-green-50' : (pdfPreview || filePreviews.length > 0 ? 'border-teal-400 bg-teal-50' : 'border-gray-300');


  return (
    <div className="w-full p-6 bg-white rounded-xl shadow-xl">
      <h2 className="text-2xl font-semibold text-teal-700 mb-6 text-center">بارگذاری یا ورود اطلاعات فراخوان</h2>
      
      {!processingWarning && !showModal && (
        <>
          <div className="mb-6">
            <label htmlFor="file-upload" className="cursor-pointer group">
              <div 
                className={`${dropZoneBaseClasses} ${dropZoneActiveClasses}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isSelfProcessing && selectedFiles.length > 0 && processingMessage && !isAttemptingCancel ? ( 
                   <div className="flex flex-col items-center text-teal-600">
                    <LoadingSpinner size="8" />
                  </div>
                ) : pdfPreview ? (
                    <FileText className="h-16 w-16 text-red-500 mb-2 pointer-events-none" />
                ) : filePreviews.length > 0 ? (
                    <div className="w-full h-full p-2 overflow-x-auto whitespace-nowrap flex items-center gap-2 pointer-events-none">
                        {filePreviews.map((previewUrl, index) => (
                            <img key={index} src={previewUrl} alt={`پیش‌نمایش ${index + 1}`} className="h-28 w-auto object-contain rounded border border-gray-300 shadow-sm inline-block" />
                        ))}
                    </div>
                ) : isDragging ? (
                    <>
                        <UploadCloud className="h-12 w-12 text-green-500 mb-2 pointer-events-none" />
                        <p className="text-green-600 text-sm pointer-events-none">فایل(ها) را اینجا رها کنید</p>
                    </>
                ) : (
                  <>
                    <UploadCloud className="h-12 w-12 text-gray-400 group-hover:text-teal-500 mb-2 pointer-events-none" />
                    <p className="text-gray-500 group-hover:text-teal-600 text-sm pointer-events-none">فایل PDF یا یک/چند تصویر (JPG/PNG) را بکشید و رها کنید یا کلیک کنید</p>
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
              disabled={currentLoadingState}
            />
          </div>
        </>
      )}

      {error && !isSelfProcessing && ( 
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center text-sm">
          <AlertCircle className="h-5 w-5 me-2 flex-shrink-0" /> 
          <span className="flex-grow whitespace-pre-wrap">{error}</span>
          {isErrorRetryable ? (
            <button
              onClick={() => {
                setError(null); 
                if (selectedFiles.length > 0) {
                  processFile();
                } else if (textInput.trim() !== '') {
                  processTextInput();
                } else {
                  setError("ابتدا فایل یا متنی را برای پردازش مجدد انتخاب/وارد کنید.");
                }
              }}
              className="ms-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 flex items-center"
              title="تلاش مجدد برای پردازش"
            >
              <RefreshCw size={14} className="me-1" /> تلاش مجدد
            </button>
          ) : (
            <button onClick={() => { setError(null); if(isSelfProcessing) {handleCancelProcessing();} }} className="ms-auto text-red-700 hover:text-red-900 flex-shrink-0 p-1">
              <X size={18} />
            </button>
          )}
        </div>
      )}
      {processingMessage && !error && !isSelfProcessing && !processingWarning && ( 
         <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center text-sm">
          <CheckCircle className="h-5 w-5 me-2" /> {processingMessage}
           <button onClick={() => setProcessingMessage(null)} className="ms-auto text-green-700 hover:text-green-900 p-1">
            <X size={18} />
          </button>
        </div>
      )}
       {isSelfProcessing && processingMessage && !processingWarning && ( 
        <div className={`mb-4 p-3 rounded-md flex items-center text-sm ${isAttemptingCancel ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
          <LoadingSpinner size="5" className={`me-2 ${isAttemptingCancel ? 'text-orange-600' : 'text-blue-600'}`} />
          <span className="flex-grow">{processingMessage}</span>
           {!isAttemptingCancel ? (
              <button 
                onClick={handleCancelProcessing} 
                className="ms-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded hover:bg-red-600 flex items-center"
                title="لغو عملیات"
              >
                <XCircle size={14} className="me-1" /> لغو
              </button>
            ) : (
              <button
                disabled
                className="ms-2 px-2 py-0.5 bg-gray-400 text-gray-700 text-xs rounded flex items-center cursor-not-allowed"
                title="لغو در جریان است"
              >
                <LoadingSpinner size="4" color="text-gray-700" className="me-1 animate-none" /> 
                لغو در جریان...
              </button>
            )}
        </div>
      )}

      {processingWarning && !isSelfProcessing && (
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
            id="tour-process-file-button"
            onClick={processFile}
            disabled={selectedFiles.length === 0 || currentLoadingState || isAttemptingCancel}
            className="flex-1 px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:text-gray-700 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSelfProcessing && selectedFiles.length > 0 && !isAttemptingCancel ? <LoadingSpinner /> : <UploadCloud className="me-2 h-5 w-5" />}
            پردازش فایل(ها)
          </button>
          <button
            onClick={processTextInput}
            disabled={textInput.trim() === '' || currentLoadingState || isAttemptingCancel}
            className="flex-1 px-6 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 transition-colors disabled:bg-gray-400 disabled:text-gray-700 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSelfProcessing && textInput.trim() !== '' && !isAttemptingCancel ? <LoadingSpinner /> : <Type className="me-2 h-5 w-5" />}
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
