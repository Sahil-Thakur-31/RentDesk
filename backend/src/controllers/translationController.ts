import { asyncHandler } from '../utils/asyncHandler';
import { translateTexts } from '../services/translationService';

export const translateBundle = asyncHandler(async (req, res) => {
  const language = String(req.body?.language || 'en');
  const texts = Array.isArray(req.body?.texts) ? req.body.texts : [];
  const translations = await translateTexts(language, texts.map((entry: unknown) => String(entry || '')));

  res.json({
    language,
    translations
  });
});
