
export interface FestivalSourceFile {
  name: string;      // Original name of the file
  dataUrl: string;   // base64 data URL of the file
  type: string;      // MIME type of the file
}

export interface FestivalImageAnalysis {
  id: string; // UUID for this analysis entry
  sourceImageName: string;
  sourceImageType: string;
  sourceImageDataUrl: string; // base64 data URL of the uploaded image for display
  userDescription?: string; // Optional user-provided description for the image

  geminiAnalysisText?: string;
  geminiScore?: number; // e.g., 0-10
  geminiScoreReasoning?: string;
  editingCritiqueAndSuggestions?: string; // Detailed editing critique for high-scoring images

  isAnalyzingImage?: boolean;
  imageAnalysisError?: string;
}

export interface FestivalInfo {
  id: string; // UUID
  fileName: string; // Display name, could be "image1.jpg (+2 more)" for multi-image
  fileType: string; // 'application/pdf', 'image/jpeg', 'image/png', 'text/plain', 'image/multiple'
  filePreview?: 'pdf' | 'text_input' | string; // base64 data URL for images, or 'pdf', or 'text_input'
  
  sourceDataUrl?: string; 
  sourceFiles?: FestivalSourceFile[]; 

  festivalName?: string;
  topics?: string[];
  objectives?: string; 
  maxPhotos?: string | number; 
  submissionDeadlineGregorian?: string; 
  submissionDeadlinePersian?: string; 
  imageSize?: string; 
  submissionMethod?: string; 
  
  extractedText?: string; 
  extractionSourceUrls?: { uri: string; title: string }[]; 

  // Fields for Smart Analysis
  userNotesForSmartAnalysis?: string; // User-provided notes to help with smart analysis
  smartAnalysis?: string;
  analysisSourceUrls?: { uri: string; title: string }[];
  isAnalyzing?: boolean; 
  analysisError?: string; 

  // New fields for individual image analysis against festival criteria
  analyzedFestivalImages?: FestivalImageAnalysis[];
  isAnalyzingFestivalImages?: boolean; // Overall status for the batch analysis of user's images


  // UI state, not persisted typically unless for drafts
  isProcessing?: boolean; // For initial file processing
  error?: string; // For initial file processing errors
}

export interface ExtractedData {
  festivalName?: string;
  topics?: string[];
  objectives?: string; 
  maxPhotos?: string | number;
  submissionDeadlineGregorian?: string;
  submissionDeadlinePersian?: string;
  imageSize?: string;
  submissionMethod?: string;
  extractionSourceUrls?: { uri: string; title: string }[]; 
}

// For jalaali-js conversions
export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export interface GregorianDate {
  gy: number;
  gm: number;
  gd: number;
}

// Authentication Types
export interface PasswordActivationInfo {
  activatedAt: number; // Timestamp of when the password was first activated
  activatedBy: string; // User identifier who activated it
}

export type PasswordActivations = Record<string, PasswordActivationInfo>;

export interface ActiveSession {
  password: string;       // The password used for the current session
  user: string;           // The user identifier for the current session
  sessionStartedAt: number; // Timestamp of when this specific session started
}
