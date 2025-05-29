
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useFestivals } from '../contexts/FestivalsContext';
import { FestivalCard } from './FestivalCard';
import { FestivalModal } from './FestivalModal';
import { FestivalInfo } from '../types';
import { Search, Calendar as CalendarIcon, Download as DownloadIconLucide, Save, FolderOpen, AlertTriangle, CheckCircle, Upload } from 'lucide-react'; // Added Upload
import { PERSIAN_MONTH_NAMES_WITH_ALL } from '../constants';
import { parseJalaliDate, toJalaali, formatJalaliDate, jalaaliToday, formatGregorianDate, toGregorian } from '../utils/dateConverter';
import JSZip from 'jszip';
import { LoadingSpinner } from './LoadingSpinner';
import { canUseFileSystemAccessApi, saveFestivalsToFileSystem, loadFestivalsFromFileSystem, readJsonFromFile, FileSystemAccessResult } from '../services/fileSystemAccessService';


export const FestivalList: React.FC = () => {
  const { festivals, isLoading: contextIsLoading, replaceAllFestivals } = useFestivals();
  const [selectedFestival, setSelectedFestival] = useState<FestivalInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShamsiMonth, setSelectedShamsiMonth] = useState<number>(0);
  const [isZippingSources, setIsZippingSources] = useState(false);

  const [isFileApiAvailable, setIsFileApiAvailable] = useState(false);
  const [fileOperationLoading, setFileOperationLoading] = useState(false);
  const [fileOpMessage, setFileOpMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const mobileUploadInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    setIsFileApiAvailable(canUseFileSystemAccessApi());
  }, []);

  const handleEdit = (festival: FestivalInfo) => {
    setSelectedFestival(festival);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFestival(null);
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const getDaysRemainingForReport = (festival: FestivalInfo) => {
    let deadline: Date | null = null;
    if (festival.submissionDeadlineGregorian) {
        try {
            const [year, month, day] = festival.submissionDeadlineGregorian.split('-').map(Number);
            deadline = new Date(year, month - 1, day); 
             if (isNaN(deadline.getTime())) deadline = null;
        } catch (e) { deadline = null; }
    } else if (festival.submissionDeadlinePersian) {
        try {
            const jDate = parseJalaliDate(festival.submissionDeadlinePersian);
            if (jDate) {
                const gregorianDate = toGregorian(jDate.jy, jDate.jm, jDate.jd);
                deadline = new Date(gregorianDate.gy, gregorianDate.gm - 1, gregorianDate.gd); 
                 if (isNaN(deadline.getTime())) deadline = null;
            }
        } catch (e) { deadline = null; }
    }

    if (!deadline) return { text: "نامشخص", color: "gray" };

    const today = new Date();
    today.setHours(0,0,0,0);
    deadline.setHours(0,0,0,0);

    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: "مهلت تمام شده", color: "red" };
    if (diffDays === 0) return { text: "امروز آخرین مهلت!", color: "orange" };
    if (diffDays < 3) return { text: `${diffDays} روز باقی مانده`, color: "darkred" };
    if (diffDays <= 10) return { text: `${diffDays} روز باقی مانده`, color: "goldenrod" };
    return { text: `${diffDays} روز باقی مانده`, color: "green" };
  };


  const handleExportReport = () => {
    if (selectedShamsiMonth === 0 || filteredFestivals.length === 0) {
      alert("لطفاً یک ماه خاص با جشنواره‌های موجود را برای تهیه گزارش انتخاب کنید.");
      return;
    }

    const today = jalaaliToday();
    const reportTitle = `گزارش فراخوان‌های ${PERSIAN_MONTH_NAMES_WITH_ALL[selectedShamsiMonth]} ${today.jy}`;
    
    let reportContent = `
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${reportTitle}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap">
          <style>
            body { font-family: 'Vazirmatn', sans-serif; direction: rtl; background-color: #f9fafb; padding: 20px; color: #1f2937; }
            .report-container { max-width: 800px; margin: 0 auto; background-color: white; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .report-header { text-align: center; margin-bottom: 24px; color: #047857; font-size: 1.75rem; font-weight: bold; }
            .festival-item { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px; padding: 16px; background-color: #ffffff; }
            .festival-title { font-size: 1.25rem; font-weight: 600; color: #065f46; margin-bottom: 8px; }
            .detail-item { margin-bottom: 8px; font-size: 0.9rem; }
            .detail-label { font-weight: 500; color: #4b5563; margin-left: 6px; }
            .detail-value { color: #1f2937; }
            .topics-container span { display: inline-block; background-color: #d1fae5; color: #065f46; padding: 2px 8px; margin: 2px; border-radius: 12px; font-size: 0.75rem; }
            a { color: #059669; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .download-link { display: inline-block; padding: 6px 12px; background-color: #047857; color: white; text-decoration: none; border-radius: 4px; font-size: 0.8rem; margin-top: 8px; }
            .download-link:hover { background-color: #065f46; }
            .text-download-link { background-color: #0ea5e9; }
            .text-download-link:hover { background-color: #0284c7; }
          </style>
           <script>
            function downloadDataUrlForFile(dataUrl, filename) {
              if (!dataUrl) return;
              const link = document.createElement('a');
              link.href = dataUrl;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
            function downloadDataUrlForText(textContent, filename) {
              if (textContent === undefined || textContent === null) return;
              // Decode URI component for textContent, as it might be encoded if passed via template literal
              const decodedText = decodeURIComponent(textContent);
              const blob = new Blob([decodedText], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }
          </script>
        </head>
        <body>
          <div class="report-container">
            <h1 class="report-header">${reportTitle}</h1>
    `;

    filteredFestivals.forEach(festival => {
      const deadlineStatusReport = getDaysRemainingForReport(festival);
      const deadlineColorMap: Record<string, string> = {
        "red": "#c53030", 
        "darkred": "#9b2c2c",
        "orange": "#dd6b20", 
        "goldenrod": "#d69e2e", 
        "green": "#2f855a", 
        "gray": "#718096"  
      };

      let displayDeadline = "نامشخص";
      if (festival.submissionDeadlinePersian) {
        displayDeadline = formatJalaliDate(festival.submissionDeadlinePersian) + " شمسی";
      } else if (festival.submissionDeadlineGregorian) {
        try {
          const [gy, gm, gd] = festival.submissionDeadlineGregorian.split('-').map(Number);
          const jalaliConverted = toJalaali(gy, gm, gd);
          displayDeadline = formatGregorianDate(festival.submissionDeadlineGregorian) + ` میلادی (تبدیل شده: ${formatJalaliDate(`${jalaliConverted.jy}/${jalaliConverted.jm}/${jalaliConverted.jd}`)} شمسی)`;
        } catch (e) {
          displayDeadline = formatGregorianDate(festival.submissionDeadlineGregorian) + " میلادی (خطا در تبدیل به شمسی)";
        }
      }

      reportContent += `
        <div class="festival-item">
          <h2 class="festival-title">${festival.festivalName || 'فراخوان بدون نام'}</h2>
          ${festival.objectives ? `<div class="detail-item"><strong class="detail-label">اهداف:</strong><span class="detail-value whitespace-pre-wrap">${festival.objectives}</span></div>` : ''}
          ${festival.topics && festival.topics.length > 0 ? `<div class="detail-item"><strong class="detail-label">موضوعات:</strong><div class="topics-container detail-value">${festival.topics.map(t => `<span>${t}</span>`).join('')}</div></div>` : ''}
          <div class="detail-item"><strong class="detail-label">مهلت ارسال:</strong><span class="detail-value">${displayDeadline}</span></div>
          <div class="detail-item"><strong class="detail-label">وضعیت:</strong><span class="detail-value" style="color: ${deadlineColorMap[deadlineStatusReport.color] || '#1f2937'}; font-weight: ${['red', 'darkred', 'orange'].includes(deadlineStatusReport.color) ? 'bold' : 'normal'};">${deadlineStatusReport.text}</span></div>
          ${festival.maxPhotos ? `<div class="detail-item"><strong class="detail-label">حداکثر عکس:</strong><span class="detail-value">${festival.maxPhotos}</span></div>` : ''}
          ${festival.imageSize ? `<div class="detail-item"><strong class="detail-label">مشخصات تصویر:</strong><span class="detail-value whitespace-pre-wrap">${festival.imageSize}</span></div>` : ''}
          ${festival.submissionMethod ? `<div class="detail-item"><strong class="detail-label">روش ارسال:</strong><span class="detail-value">${(festival.submissionMethod.trim().startsWith('http') || festival.submissionMethod.trim().startsWith('mailto:')) ? `<a href="${festival.submissionMethod.trim()}" target="_blank">${festival.submissionMethod.trim()}</a>` : festival.submissionMethod}</span></div>` : ''}
      `;
      
      if (festival.sourceDataUrl && (festival.fileType === 'application/pdf' || festival.fileType?.startsWith('image/'))) {
        const safeFileName = festival.fileName ? festival.fileName.replace(/'/g, "\\'") : 'فایل_اصلی';
        const downloadFileName = festival.sourceFiles && festival.sourceFiles.length > 0 ? festival.sourceFiles[0].name.replace(/'/g, "\\'") : safeFileName;
        reportContent += `
          <div style="margin-top: 8px;">
            <a href="#" onclick="downloadDataUrlForFile('${festival.sourceDataUrl}', '${downloadFileName}')" class="download-link">
              دانلود فایل اصلی (${downloadFileName || 'فایل'})
            </a>
          </div>
        `;
      }
      else if (festival.fileType === 'text/plain' && festival.extractedText) {
        const textFileName = festival.festivalName ? `${festival.festivalName.replace(/[^a-z0-9آ-ی_.-]/gi, '_')}.txt` : 'متن_ورودی.txt';
        const safeExtractedText = encodeURIComponent(festival.extractedText);
        reportContent += `
          <div style="margin-top: 8px;">
            <a href="#" onclick="downloadDataUrlForText('${safeExtractedText}', '${textFileName}')" class="download-link text-download-link">
              دانلود متن ورودی (${textFileName})
            </a>
          </div>
        `;
      }
      reportContent += `</div>`;
    });

    reportContent += `
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([reportContent], { type: 'text/html' });
    const reportFileUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    const reportFileName = `گزارش_فراخوان_${PERSIAN_MONTH_NAMES_WITH_ALL[selectedShamsiMonth].replace(' ','_')}_${today.jy}.html`;
    downloadLink.href = reportFileUrl;
    downloadLink.download = reportFileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    const reportWindow = window.open(reportFileUrl, '_blank');
    if (!reportWindow) {
      alert("مرورگر شما از باز کردن پنجره جدید جلوگیری کرد. لطفاً pop-up blocker را غیرفعال کنید و دوباره امتحان کنید. فایل گزارش برای دانلود آماده شده است.");
    }
  };

  const sanitizeFilename = (name: string): string => {
    return name.replace(/[^a-z0-9آ-ی_\-\.\s]/gi, '_').replace(/_{2,}/g, '_').trim() || 'untitled';
  };
  

  const handleExportSourceFilesZip = async () => {
    if (selectedShamsiMonth === 0 || filteredFestivals.length === 0) {
      alert("لطفاً یک ماه خاص با جشنواره‌های موجود را برای تهیه فایل ZIP انتخاب کنید.");
      return;
    }
    if (isZippingSources) return;

    setIsZippingSources(true);
    try {
      const zip = new JSZip();
      const today = jalaaliToday();
      const monthName = PERSIAN_MONTH_NAMES_WITH_ALL[selectedShamsiMonth].replace(' ', '_');
      const mainZipFolderName = `فراخوان‌های_${monthName}_${today.jy}`;

      for (const festival of filteredFestivals) {
        if (festival.fileType === 'text/plain' && festival.extractedText) {
          const textFilename = sanitizeFilename(festival.festivalName ? `${festival.festivalName}.txt` : `متن_ورودی_${festival.id.substring(0,8)}.txt`);
          zip.file(textFilename, festival.extractedText);
        } else if (festival.sourceFiles && festival.sourceFiles.length > 0) {
          if (festival.sourceFiles.length > 1) {
            const festivalFolderName = sanitizeFilename(festival.festivalName || festival.id);
            const festivalFolder = zip.folder(festivalFolderName);
            if (!festivalFolder) throw new Error(`Failed to create folder for ${festivalFolderName}`);

            for (const fileData of festival.sourceFiles) {
              if (fileData.dataUrl.startsWith('data:')) {
                const base64Data = fileData.dataUrl.split(',')[1];
                if (base64Data) {
                  festivalFolder.file(sanitizeFilename(fileData.name), base64Data, { base64: true });
                } else {
                  console.warn(`Could not extract base64 data for ${fileData.name} in ${festival.festivalName}`);
                }
              }
            }
          } else { 
            const fileData = festival.sourceFiles[0];
            if (fileData.dataUrl.startsWith('data:')) {
              const base64Data = fileData.dataUrl.split(',')[1];
              if (base64Data) {
                zip.file(sanitizeFilename(fileData.name), base64Data, { base64: true });
              } else {
                console.warn(`Could not extract base64 data for ${fileData.name}`);
              }
            }
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = zipUrl;
      downloadLink.download = `${mainZipFolderName}.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(zipUrl);

    } catch (error) {
      console.error("Error creating ZIP file:", error);
      alert(`خطا در ایجاد فایل ZIP: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsZippingSources(false);
    }
  };

  const handleSaveDataToSystem = async () => {
    setFileOperationLoading(true);
    setFileOpMessage(null);
    const result = await saveFestivalsToFileSystem(festivals);
    if (result.success) {
      setFileOpMessage({ type: 'success', text: result.message });
    } else {
      setFileOpMessage({ type: 'error', text: result.message });
    }
    setFileOperationLoading(false);
  };

  const handleLoadDataFromSystem = async () => {
    const confirmation = window.confirm(
      "بارگذاری اطلاعات از فایل، تمام اطلاعات فعلی موجود در برنامه را پاک کرده و با اطلاعات فایل جایگزین می‌کند. آیا مطمئن هستید؟"
    );
    if (!confirmation) return;

    setFileOperationLoading(true);
    setFileOpMessage(null);
    const result = await loadFestivalsFromFileSystem();
    if (result.success && result.data) {
      replaceAllFestivals(result.data);
      setFileOpMessage({ type: 'success', text: result.message });
    } else {
      setFileOpMessage({ type: 'error', text: result.message });
    }
    setFileOperationLoading(false);
  };
  
  const handleDownloadBackupJson = () => {
    if (festivals.length === 0) {
      setFileOpMessage({ type: 'error', text: 'هیچ اطلاعاتی برای دانلود وجود ندارد.' });
      setTimeout(() => setFileOpMessage(null), 3000);
      return;
    }
    setFileOperationLoading(true);
    setFileOpMessage(null);
    try {
      const jsonString = JSON.stringify(festivals, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      const today = jalaaliToday();
      link.download = `festivals_backup_${today.jy}-${String(today.jm).padStart(2, '0')}-${String(today.jd).padStart(2, '0')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
      setFileOpMessage({ type: 'success', text: 'فایل پشتیبان با موفقیت آماده دانلود شد.' });
    } catch (error: any) {
      console.error('Error creating JSON backup:', error);
      setFileOpMessage({ type: 'error', text: `خطا در ایجاد فایل پشتیبان JSON: ${error.message}` });
    } finally {
      setFileOperationLoading(false);
      setTimeout(() => setFileOpMessage(null), 3000);
    }
  };

  const handleUploadBackupJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmation = window.confirm(
      "بارگذاری اطلاعات از فایل، تمام اطلاعات فعلی موجود در برنامه را پاک کرده و با اطلاعات فایل جایگزین می‌کند. آیا مطمئن هستید؟"
    );
    if (!confirmation) {
      if (mobileUploadInputRef.current) mobileUploadInputRef.current.value = '';
      return;
    }

    setFileOperationLoading(true);
    setFileOpMessage(null);
    
    const result = await readJsonFromFile(file);

    if (result.success && result.data) {
      replaceAllFestivals(result.data);
      setFileOpMessage({ type: 'success', text: result.message });
    } else {
      setFileOpMessage({ type: 'error', text: result.message });
    }
    setFileOperationLoading(false);
    if (mobileUploadInputRef.current) mobileUploadInputRef.current.value = ''; // Reset file input
    setTimeout(() => setFileOpMessage(null), 5000);
  };


  const filteredFestivals = useMemo(() => {
    let festivalsToDisplay = [...festivals];

    if (selectedShamsiMonth > 0) {
      festivalsToDisplay = festivalsToDisplay.filter(f => {
        let festivalMonth: number | null = null;
        if (f.submissionDeadlinePersian) {
          const parsed = parseJalaliDate(f.submissionDeadlinePersian);
          if (parsed) festivalMonth = parsed.jm;
        } else if (f.submissionDeadlineGregorian) {
          try {
            const [gy, gm, gd] = f.submissionDeadlineGregorian.split('-').map(Number);
            const jalali = toJalaali(gy, gm, gd);
            festivalMonth = jalali.jm;
          } catch (e) { /* console.error("Error converting Gregorian to Jalali for month filter:", e); */ }
        }
        return festivalMonth === selectedShamsiMonth;
      });
    }

    const searchWords = searchTerm.toLowerCase().split(' ').filter(word => word.length > 0);
    if (searchWords.length > 0) {
      festivalsToDisplay = festivalsToDisplay.filter(f => {
        return searchWords.some(word =>
          f.festivalName?.toLowerCase().includes(word) ||
          f.topics?.some(t => t.toLowerCase().includes(word)) ||
          f.objectives?.toLowerCase().includes(word)
        );
      });
    }
    
    return festivalsToDisplay.sort((a, b) => {
      const parsedAJalali = a.submissionDeadlinePersian ? parseJalaliDate(a.submissionDeadlinePersian) : null;
      let dateA: Date | null = null;
      if (a.submissionDeadlineGregorian) {
          try { const [y,m,d] = a.submissionDeadlineGregorian.split('-').map(Number); dateA = new Date(y,m-1,d); if(isNaN(dateA.getTime())) dateA = null; } catch(e){ dateA = null; }
      } else if (parsedAJalali) {
          try { const g = toGregorian(parsedAJalali.jy, parsedAJalali.jm, parsedAJalali.jd); dateA = new Date(g.gy, g.gm-1, g.gd); if(isNaN(dateA.getTime())) dateA = null;} catch(e){ dateA = null; }
      }
      
      const parsedBJalali = b.submissionDeadlinePersian ? parseJalaliDate(b.submissionDeadlinePersian) : null;
      let dateB: Date | null = null;
      if (b.submissionDeadlineGregorian) {
          try { const [y,m,d] = b.submissionDeadlineGregorian.split('-').map(Number); dateB = new Date(y,m-1,d); if(isNaN(dateB.getTime())) dateB = null; } catch(e){ dateB = null; }
      } else if (parsedBJalali) {
          try { const g = toGregorian(parsedBJalali.jy, parsedBJalali.jm, parsedBJalali.jd); dateB = new Date(g.gy, g.gm-1, g.gd); if(isNaN(dateB.getTime())) dateB = null; } catch(e){ dateB = null; }
      }

      if (dateA && dateB) return dateA.getTime() - dateB.getTime();
      if (dateA) return -1; 
      if (dateB) return 1;
      return (a.festivalName || "").localeCompare(b.festivalName || "");
    });

  }, [festivals, searchTerm, selectedShamsiMonth]);


  if (contextIsLoading && festivals.length === 0) {
    return <div className="text-center py-10 text-gray-500">در حال بارگذاری لیست فراخوان‌ها...</div>;
  }

  if (festivals.length === 0 && !contextIsLoading) {
    return (
        <div className="w-full">
            <h2 className="text-3xl font-semibold text-teal-700 mb-6 text-center">لیست فراخوان‌های عکاسی</h2>
             <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row gap-4 items-center justify-center">
                {isFileApiAvailable ? (
                  <>
                    <button
                      onClick={handleSaveDataToSystem}
                      disabled={fileOperationLoading || festivals.length === 0}
                      className="w-full sm:w-auto px-4 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                      title={festivals.length === 0 ? "هیچ اطلاعاتی برای ذخیره وجود ندارد" : "ذخیره کلیه اطلاعات روی سیستم"}
                    >
                      {fileOperationLoading && <LoadingSpinner size="5" className="me-2" />}
                      <Save size={18} className="me-2" />
                      ذخیره اطلاعات روی سیستم
                    </button>
                    <button
                      onClick={handleLoadDataFromSystem}
                      disabled={fileOperationLoading}
                      className="w-full sm:w-auto px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                      title="بارگذاری اطلاعات از فایل پشتیبان"
                    >
                      {fileOperationLoading && <LoadingSpinner size="5" className="me-2" />}
                      <FolderOpen size={18} className="me-2" />
                      بارگذاری اطلاعات از سیستم
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleDownloadBackupJson}
                      disabled={fileOperationLoading || festivals.length === 0}
                      className="w-full sm:w-auto px-4 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                      title={festivals.length === 0 ? "هیچ اطلاعاتی برای دانلود وجود ندارد" : "دانلود فایل پشتیبان JSON"}
                    >
                      {fileOperationLoading && <LoadingSpinner size="5" className="me-2" />}
                      <DownloadIconLucide size={18} className="me-2" />
                      دانلود پشتیبان (JSON)
                    </button>
                    <label
                      htmlFor="upload-backup-input"
                      className={`w-full sm:w-auto px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-colors flex items-center justify-center cursor-pointer ${fileOperationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="بارگذاری پشتیبان از فایل JSON"
                    >
                       {fileOperationLoading && <LoadingSpinner size="5" className="me-2" />}
                      <Upload size={18} className="me-2" />
                      بارگذاری پشتیبان (JSON)
                    </label>
                    <input
                      type="file"
                      id="upload-backup-input"
                      ref={mobileUploadInputRef}
                      className="hidden"
                      accept=".json,application/json"
                      onChange={handleUploadBackupJson}
                      disabled={fileOperationLoading}
                    />
                  </>
                )}
            </div>
            {fileOpMessage && (
              <div className={`p-3 my-4 rounded-md text-sm text-center ${fileOpMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {fileOpMessage.type === 'success' ? <CheckCircle className="inline me-2 h-5 w-5" /> : <AlertTriangle className="inline me-2 h-5 w-5" />}
                {fileOpMessage.text}
              </div>
            )}
            <div className="text-center py-10 text-gray-500">هنوز هیچ فراخوانی اضافه نشده است. یک فایل جدید بارگذاری کنید تا شروع کنید!</div>
        </div>
    );
  }
  
  const canExportReport = selectedShamsiMonth > 0 && filteredFestivals.length > 0;
  const canExportSourceFilesZip = selectedShamsiMonth > 0 && filteredFestivals.length > 0;


  return (
    <div className="w-full">
      <h2 className="text-3xl font-semibold text-teal-700 mb-6 text-center">لیست فراخوان‌های عکاسی</h2>
      
      <div className="mb-4 p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row flex-wrap gap-4 items-center">
        <div className="relative flex-grow w-full sm:w-auto min-w-[200px]">
          <input 
            type="text"
            placeholder="جستجو بر اساس نام، موضوع یا اهداف..."
            className="w-full p-3 ps-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow bg-white text-gray-900 placeholder-gray-500"
            value={searchTerm}
            onChange={handleSearchChange}
            aria-label="متن جستجو"
          />
          <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div>
        <div className="relative w-full sm:w-auto min-w-[180px]">
          <select
            className="w-full p-3 ps-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 appearance-none bg-white text-gray-900 transition-shadow"
            value={selectedShamsiMonth}
            onChange={(e) => setSelectedShamsiMonth(Number(e.target.value))}
            aria-label="فیلتر بر اساس ماه شمسی"
          >
            {PERSIAN_MONTH_NAMES_WITH_ALL.map((monthName, index) => (
              <option key={index} value={index}>{monthName}</option> 
            ))}
          </select>
          <CalendarIcon className="absolute start-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
      </div>
      
      <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row gap-4 items-center justify-center">
         <button
          onClick={handleExportReport}
          disabled={!canExportReport || isZippingSources || fileOperationLoading}
          className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          title={!canExportReport ? "برای تهیه گزارش، یک ماه خاص با جشنواره‌های موجود انتخاب کنید" : `تهیه گزارش برای ${PERSIAN_MONTH_NAMES_WITH_ALL[selectedShamsiMonth]}`}
        >
          تهیه گزارش {selectedShamsiMonth > 0 ? `(${PERSIAN_MONTH_NAMES_WITH_ALL[selectedShamsiMonth]})` : ''}
        </button>
        <button
          onClick={handleExportSourceFilesZip}
          disabled={!canExportSourceFilesZip || isZippingSources || fileOperationLoading}
          className="w-full sm:w-auto px-4 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          title={!canExportSourceFilesZip ? "برای دانلود فایل‌های منبع، یک ماه خاص با جشنواره‌های موجود انتخاب کنید" : (isZippingSources ? "در حال آماده‌سازی فایل ZIP..." :`دانلود فایل‌های منبع ${PERSIAN_MONTH_NAMES_WITH_ALL[selectedShamsiMonth]}`)}
        >
          {isZippingSources ? (
            <LoadingSpinner size="5" className="me-2" />
          ) : (
            <DownloadIconLucide size={18} className="me-2" />
          )}
          {isZippingSources ? "در حال ایجاد ZIP..." : `دانلود فایل‌های منبع ${selectedShamsiMonth > 0 ? `(${PERSIAN_MONTH_NAMES_WITH_ALL[selectedShamsiMonth]})` : ''}`}
        </button>
      </div>

      <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row gap-4 items-center justify-center">
        {isFileApiAvailable ? (
          <>
            <button
              onClick={handleSaveDataToSystem}
              disabled={fileOperationLoading || festivals.length === 0}
              className="w-full sm:w-auto px-4 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              title={festivals.length === 0 ? "هیچ اطلاعاتی برای ذخیره وجود ندارد" : "ذخیره کلیه اطلاعات روی سیستم"}
            >
              {fileOperationLoading && <LoadingSpinner size="5" className="me-2" />}
              <Save size={18} className="me-2" />
              ذخیره اطلاعات روی سیستم
            </button>
            <button
              onClick={handleLoadDataFromSystem}
              disabled={fileOperationLoading}
              className="w-full sm:w-auto px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              title="بارگذاری اطلاعات از فایل پشتیبان"
            >
              {fileOperationLoading && <LoadingSpinner size="5" className="me-2" />}
              <FolderOpen size={18} className="me-2" />
              بارگذاری اطلاعات از سیستم
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleDownloadBackupJson}
              disabled={fileOperationLoading || festivals.length === 0}
              className="w-full sm:w-auto px-4 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              title={festivals.length === 0 ? "هیچ اطلاعاتی برای دانلود وجود ندارد" : "دانلود فایل پشتیبان JSON"}
            >
              {fileOperationLoading && <LoadingSpinner size="5" className="me-2" />}
              <DownloadIconLucide size={18} className="me-2" />
              دانلود پشتیبان (JSON)
            </button>
            <label
              htmlFor="upload-backup-input"
              className={`w-full sm:w-auto px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-colors flex items-center justify-center cursor-pointer ${fileOperationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="بارگذاری پشتیبان از فایل JSON"
            >
               {fileOperationLoading && <LoadingSpinner size="5" className="me-2" />}
              <Upload size={18} className="me-2" />
              بارگذاری پشتیبان (JSON)
            </label>
            <input
              type="file"
              id="upload-backup-input"
              ref={mobileUploadInputRef}
              className="hidden"
              accept=".json,application/json"
              onChange={handleUploadBackupJson}
              disabled={fileOperationLoading}
            />
          </>
        )}
      </div>
       {fileOpMessage && (
        <div className={`p-3 mb-4 rounded-md text-sm text-center ${fileOpMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {fileOpMessage.type === 'success' ? <CheckCircle className="inline me-2 h-5 w-5" /> : <AlertTriangle className="inline me-2 h-5 w-5" />}
          {fileOpMessage.text}
        </div>
      )}


      {filteredFestivals.length === 0 && (searchTerm || selectedShamsiMonth > 0) && (
        <div className="text-center py-10 text-gray-500">هیچ فراخوانی با معیارهای جستجو/فیلتر شما مطابقت ندارد.</div>
      )}

      <div className="space-y-6">
        {filteredFestivals.map(festival => (
          <FestivalCard key={festival.id} festival={festival} onEdit={handleEdit} />
        ))}
      </div>
      {selectedFestival && (
        <FestivalModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          festivalData={selectedFestival}
          isEditing={true}
        />
      )}
    </div>
  );
};
