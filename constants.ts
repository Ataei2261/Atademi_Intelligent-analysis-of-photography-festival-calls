
export const APP_TITLE = "دستیار هوشمند فراخوان‌های عکاسی";
export const GEMINI_MODEL_TEXT = "gemini-2.5-flash-preview-04-17";
export const GEMINI_MODEL_VISION = "gemini-2.5-flash-preview-04-17"; // Or specific vision model if different and better for OCR

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

export const VALID_PASSWORDS: Record<string, string> = {
  "z93HsnW8": "User 01",
  "r28XpQvK": "User 02",
  "Lm74vNsA": "User 03",
  "pQx91Kjb": "User 04",
  "tV38cmZo": "User 05",
  "dF65oWnL": "User 06",
  "eM79qxHa": "User 07",
  "yK82sLwP": "User 08",
  "bT94hZyX": "User 09",
  "vA47xnGc": "User 10",
  "sL19jqKv": "User 11",
  "mX32fBaY": "User 12",
  "qN76plJw": "User 13",
  "uK03zYbC": "User 14",
  "wT62xMna": "User 15",
  "aE95slRk": "User 16",
  "fL10mvQp": "User 17",
  "nY87xdZh": "User 18",
  "gR73jcWx": "User 19",
  "xV21bpTk": "User 20",
  "oC44nsYa": "User 21",
  "iJ99qLpM": "User 22",
  "cT36mbNv": "User 23",
  "jE02xnKv": "User 24",
  "hZ68pwLa": "User 25",
  "lK55tyQc": "User 26",
  "bM20zwPk": "User 27",
  "pY13kxLb": "User 28",
  "uW96sjZv": "User 29",
  "zD70cpNx": "User 30",
  "aR29mfKw": "User 31",
  "tV17qxZy": "User 32",
  "eL54bwPa": "User 33",
  "mK80cyQv": "User 34",
  "qN39xpLl": "User 35",
  "wC64znTa": "User 36",
  "vF08lwKb": "User 37",
  "yJ77bkXn": "User 38",
  "gH22zpQw": "User 39",
  "dA91nyLb": "User 40"
};

export const PASSWORD_EXPIRY_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
