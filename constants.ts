
export const APP_TITLE = "دستیار هوشمند فراخوان‌های عکاسی";
export const GEMINI_MODEL_TEXT = "gemini-2.5-flash-preview-04-17";
export const GEMINI_MODEL_VISION = "gemini-2.5-flash-preview-04-17"; // Or specific vision model if different and better for OCR

export const AUTH_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzxTyIDUg_c1OGDoAkbf7zK9CSw58dxO4AOS2n-JXZaJmL53spamSwcMAfDnHEZbsM-gQ/exec";

export const PERSIAN_MONTH_NAMES = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

// Used for month filter dropdown, index 0 is "All Months"
export const PERSIAN_MONTH_NAMES_WITH_ALL = [
  "همه ماه‌ها", ...PERSIAN_MONTH_NAMES
];


export const PERSIAN_WEEK_DAYS_SHORT = [
  "ش", "ی", "د", "س", "چ", "پ", "ج" // شنبه تا جمعه
];