
import React, { useState, useCallback } from 'react';
import { FestivalInfo, FestivalImageAnalysis } from '../types';
import { Calendar, Edit, Trash2, FileText, Tag, Clock, Image as LucideImage, Link as LinkIcon, Maximize, ChevronDown, ChevronUp, Target, Download, Brain, Zap, ExternalLink, AlertCircle, UploadCloud, CameraOff, Info as InfoIcon, Star, ListChecks, Layers, MessageSquare, Edit3, FilePlus } from 'lucide-react';
import { useFestivals } from '../contexts/FestivalsContext';
import { formatJalaliDate, parseJalaliDate, toGregorian, toJalaali } from '../utils/dateConverter';
import { ConfirmationModal } from './ConfirmationModal';
import { getSmartFestivalAnalysisViaGemini, analyzeImageForFestivalViaGemini, GENERAL_ANALYSIS_TOPIC_VALUE } from '../services/geminiService';
import { LoadingSpinner } from './LoadingSpinner';
import { fileToBase64 } from '../services/fileProcessingService';


interface FestivalCardProps {
  festival: FestivalInfo;
  onEdit: (festival: FestivalInfo) => void;
}

const MAX_PHOTOS_FOR_ANALYSIS = 10;

export const FestivalCard: React.FC<FestivalCardProps> = ({ festival, onEdit }) => {
  const { deleteFestival, updateFestival } = useFestivals();
  const [isOpen, setIsOpen] = useState(false);
  const [isSmartAnalysisOpen, setIsSmartAnalysisOpen] = useState(false);
  const [isImageAnalysisSectionOpen, setIsImageAnalysisSectionOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [festivalIdToDelete, setFestivalIdToDelete] = useState<string | null>(null);
  
  const [selectedImagesForAnalysis, setSelectedImagesForAnalysis] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUserDescriptions, setImageUserDescriptions] = useState<string[]>([]);
  const [imageAnalysisError, setImageAnalysisError] = useState<string | null>(null);
  const [selectedAnalysisTopic, setSelectedAnalysisTopic] = useState<string>("تحلیل کلی بر اساس تمام موارد");


  const toggleOpen = (event: React.MouseEvent<HTMLDivElement>) => {
    const targetElement = event.target as HTMLElement;
    if (targetElement.closest('button') || targetElement.closest('a') || targetElement.closest('input') || targetElement.closest('select') || targetElement.closest('textarea') || targetElement.closest('details') || targetElement.closest('summary')) {
      return; 
    }
    if (event.currentTarget.contains(targetElement) && targetElement.closest('.festival-card-header-clickable-area')) {
      setIsOpen(!isOpen);
    }
  };
  
  const handleFetchSmartAnalysis = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (festival.isAnalyzing || festival.smartAnalysis) return;

    const festivalToUpdate: FestivalInfo = { ...festival, isAnalyzing: true, analysisError: undefined };
    updateFestival(festivalToUpdate);

    try {
      const { analysisText, sourceUrls } = await getSmartFestivalAnalysisViaGemini(
        festival.festivalName,
        festival.topics,
        festival.objectives,
        festival.userNotesForSmartAnalysis // Pass user notes
      );
      updateFestival({ 
        ...festivalToUpdate, 
        smartAnalysis: analysisText, 
        analysisSourceUrls: sourceUrls, 
        isAnalyzing: false 
      });
      setIsSmartAnalysisOpen(true); 
    } catch (err: any) {
      console.error("Failed to fetch smart analysis:", err);
      updateFestival({ ...festivalToUpdate, analysisError: err.message || "خطا در دریافت تحلیل", isAnalyzing: false });
    }
  };


  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(festival);
  };

  const handleDeleteRequest = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFestivalIdToDelete(festival.id);
    setShowConfirmModal(true);
  };

  const confirmDeletion = () => {
    if (festivalIdToDelete) {
      deleteFestival(festivalIdToDelete);
    }
  };
  
  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (festival.fileType === 'text/plain') {
      if (festival.extractedText) {
        const blob = new Blob([festival.extractedText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = festival.festivalName ? `${festival.festivalName.replace(/[^a-z0-9آ-ی_.-]/gi, '_')}.txt` : 'متن_فراخوان.txt';
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        alert('متن برای دانلود موجود نیست.');
      }
    } else if (festival.sourceDataUrl) {
      const link = document.createElement('a');
      link.href = festival.sourceDataUrl;
      link.download = festival.fileName || 'فایل_فراخوان';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert('فایل منبع برای دانلود موجود نیست.');
    }
  };

  const canDownload = (): boolean => {
    if (festival.fileType === 'text/plain') {
      return !!festival.extractedText;
    }
    return !!festival.sourceDataUrl;
  };

  const handleDownloadAnalysisAsTxt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!festival.smartAnalysis) {
      alert("تحلیلی برای دانلود وجود ندارد.");
      return;
    }

    try {
      let contentToDownload = festival.smartAnalysis;
      if (festival.userNotesForSmartAnalysis) {
        contentToDownload = `یادداشت‌های کاربر برای تحلیل:\n${festival.userNotesForSmartAnalysis}\n\n---\n\nتحلیل هوشمند جشنواره:\n${festival.smartAnalysis}`;
      }

      const blob = new Blob([contentToDownload], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const txtFileName = `تحلیل_هوشمند_${(festival.festivalName || 'فراخوان').replace(/[^a-z0-9آ-ی_.-]/gi, '_')}.txt`;
      link.download = txtFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating TXT for analysis:", error);
      alert(`خطا در ایجاد فایل TXT: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleImageFilesForAnalysisChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setImageAnalysisError(null);
    const files = event.target.files;
    if (files && files.length > 0) {
        if (files.length > MAX_PHOTOS_FOR_ANALYSIS) {
            setImageAnalysisError(`حداکثر ${MAX_PHOTOS_FOR_ANALYSIS} تصویر قابل انتخاب است.`);
            setSelectedImagesForAnalysis([]);
            setImagePreviews([]);
            setImageUserDescriptions([]);
            event.target.value = ''; 
            return;
        }
        const validImageTypes = ['image/jpeg', 'image/png'];
        const newFilesArray = Array.from(files).filter(file => validImageTypes.includes(file.type));

        if (newFilesArray.length !== files.length) {
            setImageAnalysisError('فقط فایل‌های JPG یا PNG مجاز هستند. برخی فایل‌ها نادیده گرفته شدند.');
        }
        if (newFilesArray.length === 0 && files.length > 0) {
             setImageAnalysisError('هیچ فایل تصویر معتبری (JPG/PNG) انتخاب نشد.');
        }
        
        setSelectedImagesForAnalysis(newFilesArray);
        setImageUserDescriptions(new Array(newFilesArray.length).fill('')); // Initialize descriptions
        const previewsPromise = newFilesArray.map(file => fileToBase64(file));
        const previews = await Promise.all(previewsPromise);
        setImagePreviews(previews);
    } else {
        setSelectedImagesForAnalysis([]);
        setImagePreviews([]);
        setImageUserDescriptions([]);
    }
  };

  const handleImageDescriptionChange = (index: number, description: string) => {
    const newDescriptions = [...imageUserDescriptions];
    newDescriptions[index] = description;
    setImageUserDescriptions(newDescriptions);
  };


  const handleStartImageAnalysis = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImagesForAnalysis.length === 0 || !festival.smartAnalysis) return;

    updateFestival({ ...festival, isAnalyzingFestivalImages: true, analyzedFestivalImages: [] }); 

    const newAnalyzedImages: FestivalImageAnalysis[] = [];

    const focusedTopicForGemini = (selectedAnalysisTopic === "تحلیل کلی بر اساس تمام موارد" || selectedAnalysisTopic.trim() === "") 
                                  ? GENERAL_ANALYSIS_TOPIC_VALUE 
                                  : selectedAnalysisTopic;

    for (let i = 0; i < selectedImagesForAnalysis.length; i++) {
        const file = selectedImagesForAnalysis[i];
        const imageDataUrl = imagePreviews[i];
        const userDescription = imageUserDescriptions[i];
        
        const tempImageAnalysisEntry: FestivalImageAnalysis = {
            id: crypto.randomUUID(),
            sourceImageName: file.name,
            sourceImageType: file.type,
            sourceImageDataUrl: imageDataUrl,
            userDescription: userDescription || undefined,
            isAnalyzingImage: true,
        };
        newAnalyzedImages.push(tempImageAnalysisEntry);
        updateFestival({ ...festival, isAnalyzingFestivalImages: true, analyzedFestivalImages: [...newAnalyzedImages] });

        try {
            const base64Data = imageDataUrl.split(',')[1];
            const analysisResult = await analyzeImageForFestivalViaGemini(
                base64Data,
                file.type,
                {
                    festivalName: festival.festivalName,
                    topics: festival.topics,
                    objectives: festival.objectives,
                    smartAnalysisText: festival.smartAnalysis!,
                    focusedTopic: focusedTopicForGemini,
                    userImageDescription: userDescription || undefined
                }
            );
            
            newAnalyzedImages[i] = {
                ...tempImageAnalysisEntry,
                geminiAnalysisText: analysisResult.imageCritique,
                geminiScore: analysisResult.suitabilityScoreOutOf10,
                geminiScoreReasoning: analysisResult.scoreReasoning,
                editingCritiqueAndSuggestions: analysisResult.editingCritiqueAndSuggestions,
                isAnalyzingImage: false,
            };

        } catch (err: any) {
            console.error(`Error analyzing image ${file.name}:`, err);
            newAnalyzedImages[i] = {
                ...tempImageAnalysisEntry,
                imageAnalysisError: err.message || "خطا در تحلیل تصویر",
                isAnalyzingImage: false,
            };
        }
        updateFestival({ ...festival, isAnalyzingFestivalImages: true, analyzedFestivalImages: [...newAnalyzedImages] });
    }
    updateFestival({ ...festival, isAnalyzingFestivalImages: false, analyzedFestivalImages: newAnalyzedImages });
    setSelectedImagesForAnalysis([]); 
    setImagePreviews([]);
    setImageUserDescriptions([]);
    setImageAnalysisError(null); 
  };

  const handleDeleteAnalyzedImage = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();
    const updatedAnalyzedImages = festival.analyzedFestivalImages?.filter(img => img.id !== imageId) || [];
    updateFestival({ ...festival, analyzedFestivalImages: updatedAnalyzedImages });
  };


  const getDaysRemaining = () => {
    let deadline: Date | null = null;
    if (festival.submissionDeadlineGregorian) {
        try {
            const [year, month, day] = festival.submissionDeadlineGregorian.split('-').map(Number);
            deadline = new Date(year, month - 1, day);
        } catch (e) { console.error("Error parsing Gregorian deadline for card:", e); deadline = null; }
    } else if (festival.submissionDeadlinePersian) {
        try {
            const jDate = parseJalaliDate(festival.submissionDeadlinePersian);
            if (jDate) {
                const gDate = toGregorian(jDate.jy, jDate.jm, jDate.jd);
                deadline = new Date(gDate.gy, gDate.gm - 1, gDate.gd);
            }
        } catch (e) { console.error("Error parsing Persian deadline for card:", e); deadline = null; }
    }

    if (!deadline) return { text: "نامشخص", color: "text-gray-500" };

    const today = new Date();
    today.setHours(0,0,0,0);
    deadline.setHours(0,0,0,0);

    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: "مهلت تمام شده", color: "text-red-700 font-semibold" };
    if (diffDays === 0) return { text: "امروز آخرین مهلت!", color: "text-orange-600 font-bold" };
    if (diffDays < 3) return { text: `${diffDays} روز باقی مانده`, color: "text-red-600 font-semibold" };
    if (diffDays <= 10) return { text: `${diffDays} روز باقی مانده`, color: "text-yellow-600 font-semibold" };
    return { text: `${diffDays} روز باقی مانده`, color: "text-green-600" };
  };

  const deadlineStatus = getDaysRemaining();

  const renderDetail = (IconComponent: React.ElementType, label: string, value?: string | string[] | number | null, isLink: boolean = false) => {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
    
    let displayValue: React.ReactNode;
    if (Array.isArray(value)) {
      displayValue = (
        <div className="block"> 
          {value.map((item, index) => (
            <span key={index} className="inline-block bg-teal-100 text-teal-700 text-xs font-medium me-2 mb-1 px-2.5 py-0.5 rounded-full">
              {item}
            </span>
          ))}
        </div>
      );
    } else if (isLink && typeof value === 'string') {
      const trimmedValue = value.trim();
      if (trimmedValue.startsWith('http') || trimmedValue.startsWith('mailto:')) {
        displayValue = (
          <a href={trimmedValue} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline break-all">
            {trimmedValue} <LinkIcon size={14} className="inline ms-1" />
          </a>
        );
      } else {
        displayValue = <span className="text-gray-700 break-words whitespace-pre-wrap">{String(value)}</span>; 
      }
    } else { 
      displayValue = <span className="text-gray-700 break-words whitespace-pre-wrap">{String(value)}</span>;
    }

    return (
      <div className="flex items-start mb-3 mt-2">
        <IconComponent className="h-5 w-5 text-teal-600 me-3 mt-1 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          {displayValue}
        </div>
      </div>
    );
  };

  let primaryDeadlineDisplay: React.ReactNode = null;

  if (festival.submissionDeadlinePersian) {
    primaryDeadlineDisplay = <p className="text-gray-700">{formatJalaliDate(festival.submissionDeadlinePersian)} شمسی</p>;
  } else if (festival.submissionDeadlineGregorian) {
    try {
        const [gy, gm, gd] = festival.submissionDeadlineGregorian.split('-').map(Number);
        const jalali = toJalaali(gy, gm, gd);
        primaryDeadlineDisplay = <p className="text-gray-700">{formatJalaliDate( `${jalali.jy}/${jalali.jm}/${jalali.jd}` )} شمسی</p>;
    } catch (e) {
        console.error("Error converting Gregorian to Jalali for card display:", e);
        primaryDeadlineDisplay = <p className="text-gray-500 italic">خطا در تاریخ</p>;
    }
  } else {
    primaryDeadlineDisplay = <p className="text-gray-500 italic">مهلت نامشخص</p>;
  }

  const sortedAnalyzedImages = festival.analyzedFestivalImages
    ?.slice() 
    .sort((a, b) => (b.geminiScore ?? -1) - (a.geminiScore ?? -1));

  const topScoringImages = sortedAnalyzedImages?.filter(img => img.geminiScore && img.geminiScore >= 7) 
                                               .map(img => img.sourceImageName);


  return (
    <>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col transition-all duration-300 ease-in-out hover:shadow-xl">
        <div 
          className="p-5 cursor-pointer festival-card-header-clickable-area" 
          onClick={toggleOpen} 
          role="button" 
          tabIndex={0} 
          aria-expanded={isOpen} 
          aria-controls={`festival-details-${festival.id}`}
        >
          <div className="flex justify-between items-start mb-1">
            <h3 className="text-xl font-bold text-teal-700 truncate flex-grow" title={festival.festivalName}>
              {festival.festivalName || 'فراخوان بدون نام'}
            </h3>
            {isOpen ? <ChevronUp size={20} className="text-teal-600 ms-2 flex-shrink-0" /> : <ChevronDown size={20} className="text-teal-600 ms-2 flex-shrink-0" />}
          </div>
          <p className="text-xs text-gray-500 mb-3 truncate" title={festival.fileName}>
            فایل: {festival.fileName}
          </p>
          
          <div className="flex items-start">
            <Calendar className="h-5 w-5 text-teal-600 me-3 mt-1 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-500">مهلت ارسال</p>
              {primaryDeadlineDisplay}
              {(festival.submissionDeadlineGregorian || festival.submissionDeadlinePersian) && (
                <p className={`text-sm mt-0.5 ${deadlineStatus.color}`}>{deadlineStatus.text}</p>
              )}
            </div>
          </div>
        </div>

        {isOpen && (
          <div id={`festival-details-${festival.id}`} className="px-5 pb-5 border-t border-gray-200">
            {festival.filePreview && festival.filePreview !== 'pdf' && festival.filePreview !== 'text_input' && (
              <img src={festival.filePreview} alt={festival.festivalName || 'پیش‌نمایش'} className="w-full h-40 object-cover rounded-md my-3 border" />
            )}
            {festival.filePreview === 'pdf' && (
               <div className="w-full h-40 bg-gray-100 flex items-center justify-center rounded-md my-3 border">
                 <FileText className="h-20 w-20 text-red-500" />
               </div>
            )}
            {renderDetail(Target, "اهداف جشنواره", festival.objectives)}
            {renderDetail(Tag, "موضوعات / دسته‌بندی‌ها", festival.topics)}
            {renderDetail(Maximize, "حداکثر تعداد عکس", festival.maxPhotos)}
            {renderDetail(LucideImage, "مشخصات تصویر", festival.imageSize)}
            {renderDetail(LinkIcon, "روش ارسال / لینک", festival.submissionMethod, true)}
          </div>
        )}
        
        <div className="px-5 pt-3 pb-3 border-t border-gray-200">
            <div 
                className="flex justify-between items-center cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setIsSmartAnalysisOpen(!isSmartAnalysisOpen); }}
                role="button"
                tabIndex={0}
                aria-expanded={isSmartAnalysisOpen}
                aria-controls={`smart-analysis-${festival.id}`}
            >
                <h4 className="text-md font-semibold text-purple-700 flex items-center">
                    <Brain size={18} className="me-2" /> تحلیل هوشمند جشنواره
                </h4>
                {isSmartAnalysisOpen ? <ChevronUp size={20} className="text-purple-600" /> : <ChevronDown size={20} className="text-purple-600" />}
            </div>

            {isSmartAnalysisOpen && (
                 <div id={`smart-analysis-${festival.id}`} className="mt-3 space-y-3">
                    {festival.isAnalyzing && (
                        <div className="flex items-center justify-center p-4 text-purple-600">
                            <LoadingSpinner size="6" color="text-purple-600" className="me-2" />
                            در حال دریافت تحلیل هوشمند...
                        </div>
                    )}
                    {festival.analysisError && !festival.isAnalyzing && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm flex items-center">
                            <AlertCircle size={18} className="me-2 flex-shrink-0" />
                            <div>
                                <p className="font-medium">خطا در تحلیل:</p>
                                <p>{festival.analysisError}</p>
                                <button 
                                    onClick={handleFetchSmartAnalysis} 
                                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                                >
                                    دوباره تلاش کنید
                                </button>
                            </div>
                        </div>
                    )}
                    {festival.userNotesForSmartAnalysis && !festival.isAnalyzing && (
                         <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                            <h5 className="text-sm font-semibold text-yellow-800 flex items-center mb-1">
                                <FilePlus size={16} className="me-2" /> یادداشت‌های شما برای این تحلیل:
                            </h5>
                            <p className="text-xs text-yellow-700 whitespace-pre-wrap">
                                {festival.userNotesForSmartAnalysis}
                            </p>
                        </div>
                    )}
                    {festival.smartAnalysis && !festival.isAnalyzing && (
                        <>
                            <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap p-3 bg-purple-50 rounded-md border border-purple-200">
                                {festival.smartAnalysis.split('\n').map((line, index) => {
                                    if (line.match(/^\*\*.+:\*\*$/)) {
                                      return <strong key={index} className="block my-1 text-purple-700">{line.substring(2, line.length - 2)}</strong>;
                                    }
                                    if (line.startsWith('**') && line.endsWith('**')) {
                                        return <strong key={index} className="block my-1 text-purple-700">{line.substring(2, line.length - 2)}</strong>;
                                    }
                                    if (line.startsWith('* ')) {
                                        return <li key={index} className="ms-4 list-disc list-inside">{line.substring(2)}</li>;
                                    }
                                    return <p key={index} className="my-1">{line}</p>;
                                 })}
                            </div>
                            <button
                                onClick={handleDownloadAnalysisAsTxt}
                                className="w-full mt-2 px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-sm hover:bg-sky-700 transition-colors flex items-center justify-center text-sm"
                                title="دانلود تحلیل به صورت فایل TXT (شامل یادداشت‌های شما در صورت وجود)"
                            >
                                <Download size={16} className="me-2" /> دانلود تحلیل (TXT)
                            </button>
                        </>
                    )}
                    {festival.analysisSourceUrls && festival.analysisSourceUrls.length > 0 && !festival.isAnalyzing && (
                        <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                            <p className="text-xs font-medium text-gray-600 mb-1">منابع استفاده شده در تحلیل:</p>
                            <ul className="space-y-1">
                                {festival.analysisSourceUrls.map((source, index) => (
                                <li key={index} className="text-xs">
                                    <a 
                                        href={source.uri} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                                        title={source.uri}
                                    >
                                    <ExternalLink size={12} className="me-1 flex-shrink-0" />
                                    <span className="truncate">{source.title || source.uri}</span>
                                    </a>
                                </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {!festival.smartAnalysis && !festival.isAnalyzing && !festival.analysisError && (
                        <button
                            onClick={handleFetchSmartAnalysis}
                            className="w-full mt-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-sm hover:bg-purple-700 transition-colors flex items-center justify-center text-sm"
                        >
                            <Zap size={16} className="me-2" /> دریافت تحلیل هوشمند
                        </button>
                    )}
                 </div>
            )}
        </div>

        {festival.smartAnalysis && !festival.isAnalyzing && (
          <div className="px-5 pt-3 pb-5 border-t border-gray-200">
            <div 
                className="flex justify-between items-center cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setIsImageAnalysisSectionOpen(!isImageAnalysisSectionOpen); }}
                role="button"
                tabIndex={0}
                aria-expanded={isImageAnalysisSectionOpen}
                aria-controls={`image-analysis-user-${festival.id}`}
            >
                <h4 className="text-md font-semibold text-indigo-700 flex items-center">
                    <ListChecks size={18} className="me-2" /> تحلیل عکس‌های شما برای این جشنواره
                </h4>
                {isImageAnalysisSectionOpen ? <ChevronUp size={20} className="text-indigo-600" /> : <ChevronDown size={20} className="text-indigo-600" />}
            </div>

            {isImageAnalysisSectionOpen && (
              <div id={`image-analysis-user-${festival.id}`} className="mt-4 space-y-4">
                {/* Topic selection: Input with Datalist */}
                {(festival.topics && festival.topics.length > 0) && (
                    <div className="mb-3">
                        <label htmlFor={`analysis-topic-input-${festival.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                            <Layers size={16} className="inline me-2 text-indigo-600" />
                            تحلیل بر اساس کدام موضوع؟ (از لیست انتخاب کنید یا موضوع خود را تایپ نمایید)
                        </label>
                        <input
                            type="text"
                            id={`analysis-topic-input-${festival.id}`}
                            list={`analysis-topic-datalist-${festival.id}`}
                            value={selectedAnalysisTopic}
                            onChange={(e) => setSelectedAnalysisTopic(e.target.value)}
                            placeholder="انتخاب/تایپ موضوع (خالی برای تحلیل کلی)"
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white text-gray-900 placeholder-gray-500"
                            disabled={festival.isAnalyzingFestivalImages}
                        />
                        <datalist id={`analysis-topic-datalist-${festival.id}`}>
                            <option value="تحلیل کلی بر اساس تمام موارد" />
                            {festival.topics.map(topic => (
                                <option key={topic} value={topic} />
                            ))}
                        </datalist>
                    </div>
                )}
                <div>
                  <label htmlFor={`image-upload-${festival.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                    بارگذاری تصاویر برای تحلیل (حداکثر {MAX_PHOTOS_FOR_ANALYSIS} عکس، JPG/PNG):
                  </label>
                  <input
                    type="file"
                    id={`image-upload-${festival.id}`}
                    multiple
                    accept="image/jpeg,image/png"
                    onChange={handleImageFilesForAnalysisChange}
                    className="block w-full text-sm text-gray-500 file:me-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                    disabled={festival.isAnalyzingFestivalImages || selectedImagesForAnalysis.length >= MAX_PHOTOS_FOR_ANALYSIS}
                  />
                   {imageAnalysisError && <p className="text-xs text-red-500 mt-1">{imageAnalysisError}</p>}
                </div>

                {imagePreviews.length > 0 && (
                    <div className="mt-3 space-y-4">
                        {imagePreviews.map((preview, index) => (
                            <div key={`preview-desc-${index}`} className="p-2 border rounded-md bg-indigo-50">
                                <div className="flex flex-col sm:flex-row gap-2 items-start">
                                    <img src={preview} alt={`Preview ${index + 1}`} className="h-20 w-20 object-cover rounded border border-gray-300 flex-shrink-0" />
                                    <div className="flex-grow">
                                        <label htmlFor={`img-desc-${index}-${festival.id}`} className="block text-xs font-medium text-gray-700 mb-0.5">
                                            توضیح اختیاری برای "{selectedImagesForAnalysis[index]?.name}" (حداکثر ۲۰۰ کاراکتر):
                                        </label>
                                        <textarea
                                            id={`img-desc-${index}-${festival.id}`}
                                            value={imageUserDescriptions[index]}
                                            onChange={(e) => handleImageDescriptionChange(index, e.target.value)}
                                            placeholder="مثال: این عکس با تکنیک نوردهی طولانی در شب گرفته شده تا حرکت را نشان دهد..."
                                            rows={2}
                                            maxLength={200}
                                            className="w-full p-1.5 border border-gray-300 rounded-md shadow-sm text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-500"
                                            disabled={festival.isAnalyzingFestivalImages}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}


                <button
                    onClick={handleStartImageAnalysis}
                    disabled={selectedImagesForAnalysis.length === 0 || festival.isAnalyzingFestivalImages || !festival.smartAnalysis}
                    className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-sm hover:bg-indigo-700 transition-colors flex items-center justify-center text-sm disabled:bg-gray-400"
                >
                    {festival.isAnalyzingFestivalImages ? <LoadingSpinner size="5" className="me-2" /> : <UploadCloud size={16} className="me-2" />}
                    {festival.isAnalyzingFestivalImages ? 'در حال تحلیل عکس‌ها...' : `شروع تحلیل ${selectedImagesForAnalysis.length > 0 ? selectedImagesForAnalysis.length : ''} عکس`}
                </button>

                {sortedAnalyzedImages && sortedAnalyzedImages.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h5 className="text-sm font-semibold text-gray-800">نتایج تحلیل عکس‌ها:</h5>
                    {topScoringImages && topScoringImages.length > 0 && (
                       <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                           <InfoIcon size={16} className="inline me-1" /> 
                           بر اساس تحلیل، عکس‌(های) زیر بیشترین شانس موفقیت را دارند: <strong>{topScoringImages.join(', ')}</strong>
                       </div>
                    )}
                    {sortedAnalyzedImages.map(imgAnalysis => (
                      <div key={imgAnalysis.id} className="p-3 border rounded-md bg-gray-50 relative">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <img src={imgAnalysis.sourceImageDataUrl} alt={imgAnalysis.sourceImageName} className="w-full sm:w-24 h-auto sm:h-24 object-cover rounded border"/>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-indigo-700 truncate" title={imgAnalysis.sourceImageName}>{imgAnalysis.sourceImageName}</p>
                            {imgAnalysis.userDescription && (
                                <p className="text-xs text-gray-600 mt-0.5 mb-1 italic bg-gray-100 p-1 rounded border border-gray-200">
                                    <MessageSquare size={12} className="inline me-1 opacity-70"/>توضیح شما: {imgAnalysis.userDescription}
                                </p>
                            )}
                            {imgAnalysis.isAnalyzingImage && (
                              <div className="flex items-center text-sm text-indigo-600 mt-1">
                                <LoadingSpinner size="4" className="me-1" color="text-indigo-600" /> در حال تحلیل...
                              </div>
                            )}
                            {imgAnalysis.imageAnalysisError && !imgAnalysis.isAnalyzingImage && (
                               <div className="text-xs text-red-600 mt-1 bg-red-50 p-1 rounded flex items-center"><AlertCircle size={12} className="me-1"/> خطا: {imgAnalysis.imageAnalysisError}</div>
                            )}
                            {imgAnalysis.geminiScore !== undefined && !imgAnalysis.isAnalyzingImage && (
                              <p className="text-sm font-bold text-amber-600 my-1 flex items-center">
                                <Star size={16} className="me-1 text-amber-500" /> امتیاز: {imgAnalysis.geminiScore} / 10
                              </p>
                            )}
                            {imgAnalysis.geminiAnalysisText && !imgAnalysis.isAnalyzingImage && (
                                <details className="text-xs text-gray-700">
                                    <summary className="cursor-pointer hover:text-indigo-600">مشاهده نقد کلی عکس</summary>
                                    <div className="mt-1 whitespace-pre-wrap bg-white p-2 rounded border text-indigo-900">
                                        <p><strong>نقد کلی:</strong> {imgAnalysis.geminiAnalysisText}</p>
                                        {imgAnalysis.geminiScoreReasoning && <p className="mt-1"><strong>دلیل امتیاز:</strong> {imgAnalysis.geminiScoreReasoning}</p>}
                                    </div>
                                </details>
                            )}
                             {imgAnalysis.editingCritiqueAndSuggestions && !imgAnalysis.isAnalyzingImage && (
                                <details className="text-xs text-gray-700 mt-2">
                                    <summary className="cursor-pointer hover:text-green-700 text-green-600 font-medium flex items-center">
                                      <Edit3 size={14} className="me-1" /> نقد و پیشنهادات ویرایش
                                      </summary>
                                    <div className="mt-1 whitespace-pre-wrap bg-green-50 p-2 rounded border border-green-200 text-green-900">
                                        {imgAnalysis.editingCritiqueAndSuggestions.split('\n').map((line, idx) => {
                                            if (line.match(/^\s*([a-zA-Z\d۰-۹]+[.)])\s+/)) { // Matches "1.", "a)", "ب.", etc.
                                                return <p key={idx} className="ms-2 my-0.5">{line}</p>;
                                            }
                                            if (line.toLowerCase().includes("نقد ویرایش فعلی عکس") || line.toLowerCase().includes("critique of current editing")) {
                                                return <strong key={idx} className="block my-1 text-green-700">{line.replace(/Critique of current editing:?/i, 'نقد ویرایش فعلی عکس:')}</strong>;
                                            }
                                             if (line.toLowerCase().includes("پیشنهادات دقیق برای بهتر شدن ویرایش") || line.toLowerCase().includes("specific suggestions for improving the edit")) {
                                                return <strong key={idx} className="block my-1 text-green-700">{line.replace(/Specific suggestions for improving the edit:?/i, 'پیشنهادات دقیق برای بهتر شدن ویرایش:')}</strong>;
                                            }
                                            return <p key={idx} className="my-0.5">{line}</p>;
                                        })}
                                    </div>
                                </details>
                            )}
                          </div>
                        </div>
                        {!imgAnalysis.isAnalyzingImage && (
                             <button 
                                onClick={(e) => handleDeleteAnalyzedImage(e, imgAnalysis.id)} 
                                className="absolute top-2 start-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full transition-colors"
                                title="حذف این تحلیل عکس"
                                aria-label={`حذف تحلیل عکس ${imgAnalysis.sourceImageName}`}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                 {festival.analyzedFestivalImages && festival.analyzedFestivalImages.length === 0 && !festival.isAnalyzingFestivalImages && selectedImagesForAnalysis.length === 0 && (
                    <p className="text-center text-xs text-gray-500 mt-2">هنوز عکسی برای تحلیل بارگذاری نشده است.</p>
                )}
              </div>
            )}
          </div>
        )}


        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end space-s-2 mt-auto">
          <button
            onClick={handleDownloadClick}
            disabled={!canDownload()}
            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-full transition-colors disabled:text-gray-400 disabled:hover:bg-transparent"
            title="دانلود فایل اصلی یا متن"
            aria-label={`دانلود منبع فراخوان ${festival.festivalName || 'بدون نام'}`}
          >
            <Download size={20} />
          </button>
          <button
            onClick={handleEditClick}
            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors"
            title="ویرایش"
            aria-label={`ویرایش فراخوان ${festival.festivalName || 'بدون نام'}`}
          >
            <Edit size={20} />
          </button>
          <button
            onClick={handleDeleteRequest} 
            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full transition-colors"
            title="حذف"
            aria-label={`حذف فراخوان ${festival.festivalName || 'بدون نام'}`}
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setFestivalIdToDelete(null);
        }}
        onConfirm={confirmDeletion}
        title="تایید حذف فراخوان"
        message={
          <>
            <p>آیا از حذف فراخوان مطمئن هستید؟</p>
            <p className="font-semibold mt-1">{festival.festivalName || 'فراخوان بدون نام'}</p>
            <p className="text-xs text-gray-500 mt-2">این عملیات قابل بازگشت نیست.</p>
          </>
        }
      />
    </>
  );
};