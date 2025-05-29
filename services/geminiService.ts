
import { GoogleGenAI, GenerateContentResponse, Part, GroundingChunk } from "@google/genai";
import { GEMINI_MODEL_TEXT, GEMINI_MODEL_VISION } from '../constants';
import { ExtractedData, FestivalInfo } from "../types";
import { normalizeSubmissionUrl } from '../utils/urlUtils'; 
import { convertPersianToWesternNumerals } from "../utils/persianTools";

// Ensure API_KEY is available. In a real build setup, this would be handled by environment variables.
// For this context, we assume `process.env.API_KEY` is made available.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set. Please ensure the API_KEY environment variable is available.");
  // Optionally, throw an error or disable AI features if the key is missing.
  // throw new Error("API_KEY for Gemini is not set.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const GENERAL_ANALYSIS_TOPIC_VALUE = "__GENERAL__";

const cleanJsonString = (jsonStr: string): string => {
  let cleaned = jsonStr.trim();
  // Remove Markdown code block fences (```json ... ``` or ``` ... ```)
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = cleaned.match(fenceRegex);
  if (match && match[2]) {
    cleaned = match[2].trim();
  }
  return cleaned;
};

export async function extractTextFromImageViaGemini(base64ImageData: string, mimeType: string): Promise<string> {
  if (!ai) throw new Error("Gemini API client not initialized. API_KEY might be missing.");
  
  const imagePart: Part = {
    inlineData: {
      mimeType: mimeType, // e.g., 'image/jpeg', 'image/png'
      data: base64ImageData,
    },
  };
  const textPart: Part = {
    text: "Extract all visible text from this image. The text might be in English or Persian. Prioritize accuracy and return only the extracted text.",
  };

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_VISION, // Use a model that supports vision
      contents: { parts: [imagePart, textPart] },
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error extracting text from image via Gemini:", error);
    throw new Error(`Gemini API error during image text extraction: ${error instanceof Error ? error.message : String(error)}`);
  }
}


export async function extractFestivalInfoFromTextViaGemini(text: string, fileName: string): Promise<ExtractedData> {
  if (!ai) throw new Error("Gemini API client not initialized. API_KEY might be missing.");

  const prompt = `
You are an expert system for extracting information from photography contest announcements.
The following text was extracted from a contest announcement file named "${fileName}".
The text might be in English, Persian, or a mix.

Please extract the following information and provide it in a valid JSON object format.
If a field is not found, use null or an empty array/string as appropriate for the field type.

Fields to extract:
- festivalName: string (The official name of the festival or contest. If sourced from English, translate to Persian.)
- objectives: string (The objectives or goals of the festival. **Prioritize clear statements directly from the provided text for this field.** If not found in the text or if the text is ambiguous, use web search to find or clarify. If sourced from English, translate to Persian. If ultimately not found, provide null or empty string.)
- topicsString: string (A single string containing all themes, categories, or sections, separated by commas. e.g., "Nature, Portrait, Street Photography". **Prioritize clear statements directly from the provided text for this field.** If not found in the text or if the text is ambiguous, use web search to find or clarify. If sourced from English, translate to Persian. If ultimately not found, provide an empty string.)
- maxPhotos: string | number (Maximum number of photos a participant can submit. e.g., 5, "up to 10", "Unlimited". If a number, provide as number, otherwise string.)
- submissionDeadlinePersian: string (The submission deadline in YYYY/MM/DD Persian/Jalali format. Prioritize this if the source text explicitly states a Persian/Jalali deadline, e.g., 'آخرین مهلت ... شمسی'.)
- submissionDeadlineGregorian: string (The submission deadline in YYYY-MM-DD Gregorian format. Provide this if found, or if it can be clearly inferred, especially if no Persian date is explicitly stated.)
- imageSize: string (Required image dimensions, resolution, or file size. e.g., "Minimum 3000px on the long edge", "300 DPI", "Max 5MB". If sourced from English, translate to Persian.)
- submissionMethod: string (روش ارسال. بسیار مهم: اگر ارسال از طریق یک وب‌سایت است، فقط URL کامل و مستقیم آن را ارائه دهید (مثال: "https://example.com/submit"). اگر آدرس ایمیل است، فقط خود ایمیل را ارائه دهید (مثال: "contest@example.com"). برای سایر روش‌ها مانند نام یک پلتفرم، پیام‌رسان یا دستورالعمل‌های خاص که شامل لینک مستقیم یا ایمیل نیستند، توضیحی مختصر ارائه دهید (مثال: "از طریق پیام‌رسان تلگرام به آیدی @username"، "از طریق پلتفرم FilmFreeway"، "ارسال پرینت فیزیکی به آدرس X"). در صورت ارائه URL یا ایمیل، از افزودن پیشوندهای توصیفی مانند "ارسال از طریق" یا "ایمیل به" خودداری کنید.)

Here is the text:
---
${text}
---

**Guidance for "objectives" and "topicsString":**
For the 'objectives' and 'topicsString' fields, pay special attention to the text provided above. If these are clearly stated in the uploaded document's text, those statements should be the primary source. Use web search to supplement or clarify these fields *only if* the provided text is missing this information or is highly ambiguous.

**VERY IMPORTANT INSTRUCTION FOR USING WEB SEARCH:**
If the extracted text (especially for fields *other than* 'objectives' and 'topicsString' if they were clear in the document) appears incomplete OR if key information (especially \`submissionDeadlinePersian\` or \`submissionDeadlineGregorian\`) seems missing, incorrect, or ambiguous, AND you identify a website URL (e.g., from \`submissionMethod\` or elsewhere in the text that seems to be the official contest site), **you MUST use your search capabilities to visit that website.**
Your goal is to find the most accurate and current information for all fields.

**For submission deadlines found via web search:** If the website provides a clear deadline (Persian or Gregorian), **that website deadline should be prioritized and used in the JSON output, even if a different deadline was found in the initial text, especially if the website seems more authoritative or up-to-date.** Ensure the dates are in the specified YYYY/MM/DD (Persian) or YYYY-MM-DD (Gregorian) format.

Prioritize information directly from the provided text for other fields if it's clear and complete, but use the website to supplement or correct where necessary. **However, for 'objectives' and 'topicsString', remember to give strong preference to the uploaded document's content if it's clear.**

If you use external web sources to supplement missing or unclear information for 'festivalName', 'objectives', 'topicsString', or 'imageSize', please ensure that:
1. The information is accurately reflected from those sources.
2. If the supplemented information for these specific fields ('festivalName', 'objectives', 'topicsString', 'imageSize') is sourced from English text, provide the final value for these fields in Persian in the JSON output. Deadlines ('submissionDeadlinePersian', 'submissionDeadlineGregorian') and 'submissionMethod' should remain in their original format/language as extracted or specified by the website.

Provide ONLY the JSON object as your response. Ensure the JSON is well-formed and all strings are properly quoted.
Example JSON output:
{
  "festivalName": "مسابقه عکاسی زیبایی طبیعت",
  "objectives": "ترویج آگاهی زیست محیطی از طریق عکاسی.",
  "topicsString": "مناظر, حیات وحش",
  "maxPhotos": 10,
  "submissionDeadlinePersian": "1403/10/11",
  "submissionDeadlineGregorian": "2024-12-31",
  "imageSize": "عرض 2000 پیکسل، 72 DPI، حداکثر 4 مگابایت",
  "submissionMethod": "https://site.com/contest-entry"
}
`;
  let apiResponseText: string | undefined;
  let response: GenerateContentResponse;

  try {
    response = await ai.models.generateContent({
        model: GEMINI_MODEL_TEXT,
        contents: prompt,
        config: {
            // responseMimeType: "application/json", // Removed due to conflict with tools
            tools: [{googleSearch: {}}], // Enable Google Search
        }
    });
    
    apiResponseText = response.text;
    const jsonString = cleanJsonString(apiResponseText);
    
    const rawParsedData = JSON.parse(jsonString) as any; // Parse as any initially
    
    let extractionSourceUrls: { uri: string; title: string }[] = [];
    if (response.candidates && response.candidates[0]?.groundingMetadata?.groundingChunks) {
      extractionSourceUrls = response.candidates[0].groundingMetadata.groundingChunks
        .filter((chunk: GroundingChunk) => chunk.web && chunk.web.uri)
        .map((chunk: GroundingChunk) => ({
          uri: chunk.web!.uri!,
          title: chunk.web!.title || chunk.web!.uri!,
        }));
      // Deduplicate sourceUrls by URI
      extractionSourceUrls = Array.from(new Map(extractionSourceUrls.map(item => [item.uri, item])).values());
    }
    
    const parsedData: ExtractedData = {
        festivalName: rawParsedData.festivalName,
        objectives: rawParsedData.objectives,
        topics: [], // Initialize as empty array
        maxPhotos: typeof rawParsedData.maxPhotos === 'string' 
            ? convertPersianToWesternNumerals(rawParsedData.maxPhotos) 
            : rawParsedData.maxPhotos,
        submissionDeadlineGregorian: convertPersianToWesternNumerals(rawParsedData.submissionDeadlineGregorian),
        submissionDeadlinePersian: convertPersianToWesternNumerals(rawParsedData.submissionDeadlinePersian),
        imageSize: rawParsedData.imageSize,
        submissionMethod: rawParsedData.submissionMethod ? normalizeSubmissionUrl(rawParsedData.submissionMethod) : undefined, // Normalize here
        extractionSourceUrls: extractionSourceUrls.length > 0 ? extractionSourceUrls : undefined,
    };

    if (rawParsedData.topicsString && typeof rawParsedData.topicsString === 'string' && rawParsedData.topicsString.trim() !== "") {
        parsedData.topics = rawParsedData.topicsString.split(',').map((t:string) => t.trim()).filter((t:string) => t);
    }
    
    if (parsedData.maxPhotos && typeof parsedData.maxPhotos === 'string' && /^\d+$/.test(parsedData.maxPhotos)) {
        parsedData.maxPhotos = parseInt(parsedData.maxPhotos, 10);
    }

    return parsedData;

  } catch (error) {
    console.error("Error extracting festival info via Gemini:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("quota") || errorMessage.includes("API key")) {
         throw new Error(`Gemini API error: ${errorMessage}. Please check your API key and usage quota.`);
    }
    if (error instanceof SyntaxError && apiResponseText) {
      throw new Error(`Gemini API error during information extraction: ${errorMessage}. Problematic JSON string: ${cleanJsonString(apiResponseText)}`);
    }
    // Include the Gemini API error message directly if possible
    if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string') {
       const geminiMessage = (error as any).message;
       if (geminiMessage.includes("INVALID_ARGUMENT") || geminiMessage.includes("Tool use with a response mime type")){
         throw new Error(`Gemini API configuration error: ${geminiMessage}`);
       }
    }
    throw new Error(`Gemini API error during information extraction: ${errorMessage}`);
  }
}

export async function getSmartFestivalAnalysisViaGemini(
  festivalName: string | undefined,
  topics: string[] | undefined,
  objectives: string | undefined,
  userNotesForSmartAnalysis?: string // New parameter
): Promise<{ analysisText: string; sourceUrls: { uri: string; title: string }[] }> {
  if (!ai) throw new Error("Gemini API client not initialized. API_KEY might be missing.");
  if (!festivalName) throw new Error("Festival name is required for smart analysis.");

  const topicsString = topics && topics.length > 0 ? topics.join(', ') : 'نامشخص';
  const objectivesString = objectives || 'نامشخص';

  let userNotesSection = '';
  if (userNotesForSmartAnalysis && userNotesForSmartAnalysis.trim() !== '') {
    userNotesSection = `
**یادداشت‌های تکمیلی ارائه‌شده توسط کاربر (برای کمک به تحلیل):**
--- START OF USER NOTES ---
${userNotesForSmartAnalysis.trim()}
--- END OF USER NOTES ---
لطفاً از این یادداشت‌ها برای تکمیل درک خود از جشنواره و ارائه تحلیل دقیق‌تر استفاده کنید.
`;
  }

  const prompt = `
شما یک تحلیلگر خبره و بسیار دقیق مسابقات عکاسی هستید.
برای جشنواره‌ای با نام "**${festivalName}**" و با مشخصات زیر:
- موضوعات/دسته‌بندی‌ها: ${topicsString}
- اهداف جشنواره: ${objectivesString}

${userNotesSection}

یک تحلیل جامع و بسیار دقیق ارائه دهید تا مشخص شود چه نوع عکس‌هایی بیشترین شانس موفقیت یا تقدیر در این جشنواره را دارند.
**ضروری است** که از تمام قابلیت‌های جستجوی خود (Google Search) برای یافتن اطلاعات زیر استفاده کنید:
1.  **سوابق دوره‌های پیشین جشنواره "${festivalName}"**: برندگان قبلی، موضوعات پرتکرار در میان آثار برگزیده، سبک‌های عکاسی موفق (مثلاً مستند، پرتره، مفهومی، مینیمال، فاین آرت، و غیره)، و نوع نگاه کلی حاکم بر دوره‌های گذشته را شناسایی کنید.
2.  **داوران جشنواره**: در صورت امکان، لیست داوران فعلی یا دوره‌های اخیر جشنواره را از وب‌سایت رسمی یا منابع معتبر دیگر پیدا کنید. سپس، سبک کاری شخصی داوران، مقالات، مصاحبه‌ها، نمایشگاه‌های انفرادی یا گروهی، و معیارهای داوری اعلام شده توسط آن‌ها (در صورت وجود) را جستجو و تحلیل کنید تا بتوانید نوع نگاه و ترجیحات احتمالی آن‌ها را استنباط نمایید.

**تحلیل نهایی شما باید شامل بخش‌های زیر باشد و هر بخش باید به تفصیل توضیح داده شود:**

\`\`\`text
**تحلیل جامع جشنواره و سوابق:**
[در این بخش، یافته‌های خود از بررسی دوره‌های گذشته جشنواره را ارائه دهید. به الگوهای موضوعی، سبک‌های موفق، عمق مفهومی آثار برگزیده، و اتمسفر کلی آثار برگزیده اشاره کنید. اگر جشنواره‌ای سابقه‌ای ندارد یا اطلاعاتی یافت نشد، این موضوع را ذکر کنید.]

**تحلیل داوران (در صورت امکان):**
[در این بخش، یافته‌های خود در مورد داوران را ارائه دهید. به سبک کاری، زمینه فعالیت، نمایشگاه‌ها، مقالات، و ترجیحات هنری احتمالی هر یک از داوران (در صورت یافتن اطلاعات) اشاره کنید. توضیح دهید که چگونه این موارد می‌توانند بر انتخاب آثار تاثیر بگذارند. اگر اطلاعاتی در مورد داوران پیدا نشد یا تحلیل آن‌ها ممکن نبود، این موضوع را به صراحت بیان کنید.]

**ژانرها و سبک‌های عکاسی پیشنهادی:**
[بر اساس تحلیل سوابق جشنواره، اهداف اعلام‌شده، و (در صورت امکان) نگاه داوران، توضیح دهید که کدام ژانرها (مانند مستند اجتماعی، طبیعت، پرتره، مفهومی، فاین آرت، و ...) و سبک‌های عکاسی (مثلاً مینیمالیسم، سورئالیسم، کلاسیک، مدرن، روایی، انتزاعی، و ...) شانس موفقیت بیشتری دارند. دلایل خود را برای هر پیشنهاد به تفصیل بیان کنید و توضیح دهید که چرا این سبک‌ها با هویت جشنواره همخوانی دارند.]

**ایده‌ها و مفاهیم کلیدی برای عکاسی (دقیق و کاربردی):**
[در این بخش، چندین ایده و مفهوم عکاسی دقیق، خلاقانه و کاربردی ارائه دهید که با تحلیل‌های بالا همسو باشند. برای هر ایده، توضیح دهید که چگونه می‌تواند با اهداف جشنواره، موضوعات، یا نگاه احتمالی داوران ارتباط برقرار کند و چگونه عکاس می‌تواند آن را به شکلی تاثیرگذار اجرا کند. مثال‌ها باید الهام‌بخش و عملی باشند.]

**نکات فنی و اجرایی برجسته:**
[در صورت امکان استنتاج از تحلیل‌ها، به نکات فنی خاصی که ممکن است در این جشنواره مورد توجه قرار گیرند، اشاره کنید. این موارد می‌تواند شامل تاکید بر نورپردازی خاص (طبیعی، مصنوعی، استودیویی)، تکنیک‌های ترکیب‌بندی پیشرفته، اهمیت ویرایش (یا عدم ویرایش افراطی)، کیفیت فنی بالای چاپ یا فایل دیجیتال (وضوح، شارپنس، مدیریت نویز)، و یا نحوه ارائه اثر (مثلاً اهمیت یکپارچگی در مجموعه عکس یا قدرت تک عکس) باشد.]

**اشتباهات رایج / سوءتعبیرهایی که باید از آن‌ها اجتناب کرد:**
[بر اساس تحلیل جشنواره، به اشتباهات رایجی که شرکت‌کنندگان ممکن است مرتکب شوند یا سوءتعبیرهای احتمالی از موضوعات یا اهداف جشنواره که منجر به ارسال آثار نامناسب می‌شود، اشاره کنید. این بخش به عکاسان کمک می‌کند تا از دام‌های احتمالی پرهیز کنند.]

**جمع‌بندی و توصیه‌های نهایی:**
[یک جمع‌بندی کوتاه از مهم‌ترین یافته‌ها و توصیه‌های کلیدی خود را برای عکاسانی که قصد شرکت در این جشنواره را دارند، ارائه دهید. این توصیه‌ها باید عملی و راهگشا باشند.]
\`\`\`

**بسیار مهم:**
- کل پاسخ شما باید **فقط و فقط به زبان فارسی روان و دقیق** باشد.
- از هرگونه عبارت یا جمله مقدماتی یا پایانی خارج از ساختار فوق (مانند "مطمئناً، در اینجا تحلیل شما آمده است:") خودداری کنید. **فقط و فقط متن تحلیل ساختاریافته را برگردانید.**
- برای عنوان هر بخش از فرمت \`**عنوان بخش:**\` (دو ستاره در ابتدا و انتها و یک کالن در آخر) استفاده کنید.
- برای لیست‌ها یا مثال‌ها، از علامت بولت پوینت (\`* \`) استفاده کنید.
- تحلیل شما باید تا حد امکان بر اساس داده‌های واقعی و قابل جستجو باشد. اگر اطلاعاتی یافت نشد، به صراحت ذکر کنید.
`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_TEXT, 
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], 
      },
    });

    const analysisText = response.text.trim();
    let sourceUrls: { uri: string; title: string }[] = [];

    if (response.candidates && response.candidates[0]?.groundingMetadata?.groundingChunks) {
      sourceUrls = response.candidates[0].groundingMetadata.groundingChunks
        .filter((chunk: GroundingChunk) => chunk.web && chunk.web.uri)
        .map((chunk: GroundingChunk) => ({
          uri: chunk.web!.uri!, 
          title: chunk.web!.title || chunk.web!.uri!, 
        }));
    }
    
    const uniqueSourceUrls = Array.from(new Map(sourceUrls.map(item => [item.uri, item])).values());

    return { analysisText, sourceUrls: uniqueSourceUrls };

  } catch (error) {
    console.error("Error getting smart festival analysis via Gemini:", error);
    throw new Error(`Gemini API error during smart analysis: ${error instanceof Error ? error.message : String(error)}`);
  }
}


interface ImageAnalysisPayload {
  imageCritique: string;
  suitabilityScoreOutOf10: number;
  scoreReasoning: string;
  editingCritiqueAndSuggestions?: string | null; // Updated to allow null explicitly
}

interface FestivalContextForImageAnalysis {
    festivalName?: string;
    topics?: string[];
    objectives?: string;
    smartAnalysisText: string; 
    focusedTopic?: string; 
    userImageDescription?: string; // Optional user-provided description for the image
}

export async function analyzeImageForFestivalViaGemini(
  base64ImageData: string,
  mimeType: string,
  festivalInfo: FestivalContextForImageAnalysis
): Promise<ImageAnalysisPayload> {
  if (!ai) throw new Error("Gemini API client not initialized. API_KEY might be missing.");
  if (!festivalInfo.smartAnalysisText) throw new Error("Smart festival analysis text is required to analyze the image.");

  const imagePart: Part = {
    inlineData: {
      mimeType: mimeType,
      data: base64ImageData,
    },
  };

  const prompt = `
You are a highly discerning photo contest judge. You have already been provided with a detailed "Smart Festival Analysis" for a specific contest.
Your task is to evaluate the_CURRENT_IMAGE_ (provided as inline data) **strictly based on how well it aligns with that prior "Smart Festival Analysis" AND any specific topic focus mentioned below.**

**Context: Festival Information**
- Festival Name: ${festivalInfo.festivalName || 'N/A'}
- Festival Topics (Overall): ${festivalInfo.topics?.join(', ') || 'N/A'}
- Festival Objectives: ${festivalInfo.objectives || 'N/A'}

**This is the "Smart Festival Analysis" you must use as your primary reference for judging the_CURRENT_IMAGE_:**
--- START OF SMART FESTIVAL ANALYSIS ---
${festivalInfo.smartAnalysisText}
--- END OF SMART FESTIVAL ANALYSIS ---

${ festivalInfo.focusedTopic && festivalInfo.focusedTopic !== GENERAL_ANALYSIS_TOPIC_VALUE ? `
**Specific Focus for this Analysis:**
In addition to the overall "Smart Festival Analysis", pay PARTICULAR ATTENTION to how the_CURRENT_IMAGE_ specifically relates to the following festival topic/theme that the user has selected:
- **Selected Topic Focus: ${festivalInfo.focusedTopic}**

Your critique and score should heavily weigh the image's relevance and execution concerning this **Selected Topic Focus**, while still considering the broader festival analysis. If the image does not align well with the Selected Topic Focus, this should negatively impact the score, even if it's a good image generally.
` : '' }

${festivalInfo.userImageDescription ? `
**User's Description for the_CURRENT_IMAGE_ (توضیحات کاربر برای تصویر فعلی):**
The photographer has provided the following optional description for this image:
"${festivalInfo.userImageDescription}"
Consider this description as potential context or intent behind the photo. It might reveal aspects or connections to the festival's theme, the Smart Analysis, or the Selected Topic Focus (if applicable) that are not immediately apparent from the visual content alone. However, if the image, even with this description, remains clearly misaligned with the festival's core criteria, the description should not override an objective assessment of its suitability. Thematic relevance (as outlined below) remains paramount.
` : ''}

**Your Task for the_CURRENT_IMAGE_:**

**CRITICAL SCORING AND CRITIQUE PRIORITIZATION (بسیار مهم - اولویت‌بندی نقد و نمره):**
The **MOST IMPORTANT FACTOR (مهم‌ترین عامل)** in your critique and score is the_CURRENT_IMAGE_'s **direct relevance and alignment (ارتباط و هم‌سویی مستقیم)** with:
1.  The **festival's core identity (هویت اصلی جشنواره)**: Name (\`${festivalInfo.festivalName || 'N/A'}\`), stated Objectives (\`${festivalInfo.objectives || 'N/A'}\`), and overall Topics (\`${festivalInfo.topics?.join(', ') || 'N/A'}\`).
2.  The insights provided in the **"Smart Festival Analysis" (تحلیل هوشمند جشنواره ارائه‌شده)**.
3.  ${festivalInfo.focusedTopic && festivalInfo.focusedTopic !== GENERAL_ANALYSIS_TOPIC_VALUE ? `And **MOST CRITICALLY (و مهم‌تر از همه)**, its alignment with the **Selected Topic Focus: ${festivalInfo.focusedTopic} (موضوع انتخابی کاربر برای تحلیل: ${festivalInfo.focusedTopic})**.` : `(No specific sub-topic was selected for this image; evaluate against the overall festival criteria - برای این عکس موضوع خاصی انتخاب نشده، بر اساس معیارهای کلی جشنواره ارزیابی کنید.)`}

**A technically flawless image (یک عکس بی‌نقص از نظر فنی) (perfect composition, lighting, editing - ترکیب‌بندی، نورپردازی، ویرایش عالی) that is NOT relevant to the festival's theme/objectives (که با موضوع/اهداف جشنواره مرتبط نیست) (and selected topic focus, if provided - و موضوع انتخابی کاربر، در صورت وجود) MUST receive a LOW score (e.g., 0-3) (باید نمره پایینی بگیرد، مثلا ۰ تا ۳).**
A relevant image with some technical imperfections might still score higher than an irrelevant but technically perfect one. (یک عکس مرتبط با جشنواره اما با ایرادات فنی جزئی، ممکن است نمره بالاتری از یک عکس بی‌ربط اما بی‌نقص فنی بگیرد).

Your critique should first address thematic relevance (نقد شما ابتدا باید به ارتباط موضوعی بپردازد), then discuss conceptual strength, emotional impact, narrative quality (where applicable), and finally technical aspects (composition, aesthetics, editing - سپس جنبه‌های فنی مانند ترکیب‌بندی، زیبایی‌شناسی، ویرایش) in the context of how they serve (or fail to serve) the theme and the festival's likely expectations based on the Smart Analysis (و توضیح دهد که چگونه این جنبه‌های فنی در خدمت موضوع و انتظارات جشنواره (طبق تحلیل هوشمند) هستند یا نیستند).

1.  **Critique the Image (نقد تصویر)**: Provide a concise critique (in Persian - به فارسی) explaining how well the_CURRENT_IMAGE_ aligns with the specific suggestions, themes, styles, technical considerations, and overall guidance mentioned in the "Smart Festival Analysis" above. Address its conceptual strength, emotional impact, and narrative quality (if applicable) in this context. ${festivalInfo.focusedTopic && festivalInfo.focusedTopic !== GENERAL_ANALYSIS_TOPIC_VALUE ? "Crucially, emphasize its alignment (or lack thereof) with the **Selected Topic Focus: " + festivalInfo.focusedTopic + "**." : ""} Highlight strengths and weaknesses *in relation to that analysis (and selected topic if applicable)*. If the user provided a description, briefly acknowledge how it was considered in your critique.
2.  **Score the Image (نمره تصویر)**: Give a numerical score from 0 to 10 (0 = Not at all suitable, 10 = Perfectly suitable - ۰ = اصلا مناسب نیست، ۱۰ = کاملا مناسب است) indicating the image's potential for success in *this specific festival*, based *only* on its alignment with the "Smart Festival Analysis" ${festivalInfo.focusedTopic && festivalInfo.focusedTopic !== GENERAL_ANALYSIS_TOPIC_VALUE ? "and particularly its relevance to the **Selected Topic Focus: " + festivalInfo.focusedTopic + "**" : ""}.
3.  **Reasoning for Score (دلیل نمره)**: Briefly explain (in Persian - به فارسی) the primary reasons for your score, directly linking it to aspects of the "Smart Festival Analysis" ${festivalInfo.focusedTopic && festivalInfo.focusedTopic !== GENERAL_ANALYSIS_TOPIC_VALUE ? "and the **Selected Topic Focus: " + festivalInfo.focusedTopic + "**" : ""}.
4.  **Editing Critique and Suggestions (نقد و پیشنهادات ویرایش)**: This part is conditional. **If, AND ONLY IF, your \`suitabilityScoreOutOf10\` for the_CURRENT_IMAGE_ is 7 or higher**, provide detailed feedback on the image's editing (in Persian). This section should include:
    a.  **نقد ویرایش فعلی عکس (Critique of current editing):** Discuss aspects like color balance, contrast, sharpness, noise reduction, cropping, and any specific techniques used, evaluating their effectiveness and appropriateness for the image and festival context as per the "Smart Festival Analysis".
    b.  **پیشنهادات دقیق برای بهتر شدن ویرایش (Specific suggestions for improving the edit):** Offer actionable, detailed, and structured advice on how the editing could be enhanced to better serve the image's message and align it more closely with the festival's themes (as per the Smart Analysis and selected topic). This should cover (where applicable):
        *   **تنظیمات کلی (Global Adjustments):** مانند نوردهی کلی، کنتراست، تعادل رنگ، وایت بالانس، وضوح کلی.
        *   **تنظیمات موضعی (Local Adjustments):** مانند تکنیک‌های داج و برن برای هدایت چشم یا تاکید بر سوژه، شارپ کردن انتخابی، اصلاحات رنگی یا نوری در بخش‌های خاص تصویر.
        *   **ترکیب‌بندی (Compositional Adjustments):** پیشنهاداتی برای کراپ بهتر (اگر لازم است)، اصلاح پرسپکتیو، یا حذف عناصر پرت‌کننده از طریق ویرایش.
        *   **رنگ و تونالیته (Color and Tonality):** پیشنهاداتی برای بهبود گرادینگ رنگ، تبدیل به سیاه‌وسفید (در صورت تناسب)، یا ایجاد اتمسفر خاص از طریق رنگ.
        *   **تکنیک‌های پیشرفته‌تر (Advanced Techniques) (در صورت تناسب با عکس و جشنواره):** مانند اصلاحات خلاقانه و هنری رنگ، استفاده از فیلترهای دیجیتال خاص، یا تکنیک‌های خاص دیگر که به ارتقای تصویر کمک کند.
        *   **مواردی که در ویرایش باید از آن‌ها اجتناب کرد (Things to avoid in editing for this specific image/festival):** بر اساس ماهیت جشنواره و عکس، به مواردی اشاره کنید که ویرایش بیش از حد یا نامناسب آن‌ها می‌تواند به ضرر عکس تمام شود (مثلاً اغراق در رنگ‌ها در یک جشنواره مستند).
    If the score is below 7, this field (\`editingCritiqueAndSuggestions\`) should be \`null\` or an empty string.

**Output Format (فرمت خروجی):**
Return your response as a **single, valid JSON object (یک شیء JSON واحد و معتبر)** with the following keys:
- \`imageCritique\`: string (Your detailed critique in Persian - نقد دقیق شما به فارسی)
- \`suitabilityScoreOutOf10\`: number (Your score from 0 to 10 - نمره شما از ۰ تا ۱۰)
- \`scoreReasoning\`: string (Your brief reasoning for the score in Persian - توضیح مختصر شما برای نمره به فارسی)
- \`editingCritiqueAndSuggestions\`: string | null (Detailed editing feedback in Persian if score >= 7, otherwise null or empty string - نقد و پیشنهادات ویرایش به فارسی اگر نمره ۷ یا بالاتر باشد، در غیر این صورت null یا رشته خالی)

**Example JSON output (نمونه خروجی JSON):**
\`\`\`json
{
  "imageCritique": "این تصویر به خوبی با بخش «عکاسی مفهومی با تاکید بر مینیمالیسم» که در تحلیل جشنواره ذکر شده، هم‌خوانی دارد. استفاده از فضای منفی هوشمندانه است. با این حال، برای تطابق بیشتر با توصیه «استفاده از رنگ‌های مونوکروم یا پالت محدود» در تحلیل، بهتر بود از رنگ‌های کمتری استفاده می‌شد. اگرچه عکس از نظر فنی خوب است، اما ارتباط مستقیمی با موضوع اصلی جشنواره یعنی 'شادی در حرکت' ندارد. توضیحات کاربر مبنی بر اینکه 'این عکس تلاش دارد سکون قبل از حرکت را نشان دهد' در نظر گرفته شد، اما ارتباط بصری با 'شادی در حرکت' همچنان ضعیف است.",
  "suitabilityScoreOutOf10": 4,
  "scoreReasoning": "هم‌سویی خوب با برخی جنبه‌های تحلیل هوشمند (مفهومی و مینیمالیسم)، اما عدم ارتباط قوی با موضوع اصلی جشنواره ('شادی در حرکت') نمره را کاهش داده است. توضیحات کاربر به درک بهتر نیت کمک کرد اما نتوانست ضعف ارتباط بصری را جبران کند. جنبه‌های فنی قابل قبول هستند اما در خدمت موضوع اصلی نیستند.",
  "editingCritiqueAndSuggestions": null
}
\`\`\`
\`\`\`json
{
  "imageCritique": "این تصویر به شکلی عالی با تحلیل هوشمند جشنواره و موضوع انتخابی 'زندگی شهری در شب' همسو است. نوردهی طولانی به خوبی حرکت و پویایی شهر را به تصویر کشیده و ترکیب‌بندی با استفاده از خطوط هدایتگر، چشم را به سمت مرکز تصویر هدایت می‌کند. قدرت مفهومی آن در نمایش گذر زمان و انرژی شهری بالاست.",
  "suitabilityScoreOutOf10": 8,
  "scoreReasoning": "ارتباط موضوعی بسیار قوی با تمرکز انتخابی و تحلیل کلی. تکنیک عکاسی به خوبی در خدمت مفهوم بوده و اجرای فنی قابل قبول است. عکس تاثیر احساسی خوبی در انتقال حس شب مدرن دارد.",
  "editingCritiqueAndSuggestions": "نقد ویرایش فعلی عکس: ویرایش فعلی از نظر نور و رنگ مناسب است و جزئیات در سایه‌ها و هایلایت‌ها حفظ شده‌اند. کنتراست کلی خوب است و به خوانایی تصویر کمک کرده.\\nپیشنهادات دقیق برای بهتر شدن ویرایش: \\n* تنظیمات کلی: می‌توانید برای تاکید بیشتر بر فضای شب، کمی (بسیار نامحسوس) وایت بالانس را به سمت رنگ‌های سردتر متمایل کنید.\\n* تنظیمات موضعی: خطوط نورانی ماشین‌ها را می‌توان با کمی افزایش selective saturation جذاب‌تر کرد. همچنین، برای ایجاد عمق بیشتر، ساختمان‌های دورتر را با داج کردن جزئی، کمی محوتر نمایش دهید.\\n* ترکیب‌بندی: کراپ فعلی مناسب به نظر می‌رسد.\\n* رنگ و تونالیته: اگر قصد ایجاد اتمسفری سینمایی‌تر دارید، می‌توانید از گرادینت رنگی ملایمی (مثلاً ترکیب آبی تیره و نارنجی) در آسمان و بازتاب نورها استفاده کنید.\\n* مواردی که در ویرایش باید از آن‌ها اجتناب کرد: از شارپ کردن بیش از حد که باعث ایجاد هاله دور لبه‌ها شود، پرهیز کنید. همچنین، افزایش بیش از حد کنتراست در مناطق روشن می‌تواند باعث از دست رفتن جزئیات شود."
}
\`\`\`

**Important (نکات مهم):**
- Your entire response must be in Persian (کل پاسخ شما باید به فارسی باشد).
- The JSON must be perfectly valid (JSON باید کاملا معتبر باشد).
- Do not include any text outside the JSON object (هیچ متنی خارج از شیء JSON قرار ندهید).
- Focus *exclusively* on comparing the_CURRENT_IMAGE_ to the provided "Smart Festival Analysis" (and "Selected Topic Focus" and "User's Description" if applicable). Do not introduce external judging criteria (تمرکز شما منحصراً بر مقایسه تصویر فعلی با «تحلیل هوشمند جشنواره» (و «موضوع انتخابی کاربر» و «توضیحات کاربر» در صورت وجود) باشد. از معیارهای داوری خارجی استفاده نکنید).
`;

  let geminiApiResponse: GenerateContentResponse | undefined; 

  try {
    geminiApiResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_VISION, 
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
      },
    });

    const jsonString = cleanJsonString(geminiApiResponse.text);
    const parsedData = JSON.parse(jsonString) as ImageAnalysisPayload;

    if (typeof parsedData.suitabilityScoreOutOf10 !== 'number' || parsedData.suitabilityScoreOutOf10 < 0 || parsedData.suitabilityScoreOutOf10 > 10) {
        console.warn("Gemini returned an invalid score, defaulting to 0. Raw score:", parsedData.suitabilityScoreOutOf10);
        parsedData.suitabilityScoreOutOf10 = 0; 
    }
    
    if (parsedData.suitabilityScoreOutOf10 < 7) {
        parsedData.editingCritiqueAndSuggestions = null;
    } else if (parsedData.editingCritiqueAndSuggestions === "") { 
        // If Gemini returns empty string for score >=7, make it null for consistency,
        // or consider if prompt needs adjustment if this happens often.
        // For now, this ensures it's either populated string or null.
        parsedData.editingCritiqueAndSuggestions = null; 
    }


    return parsedData;

  } catch (error) {
    console.error("Error analyzing image for festival via Gemini:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
     if (error instanceof SyntaxError) {
      const responseText = geminiApiResponse ? geminiApiResponse.text : "Response text not available (error likely occurred before Gemini response was received or response was undefined).";
      throw new Error(`Gemini API error: Failed to parse JSON response for image analysis. ${errorMessage}. Response text: ${cleanJsonString(responseText)}`);
    }
    throw new Error(`Gemini API error during image analysis for festival: ${errorMessage}`);
  }
}
