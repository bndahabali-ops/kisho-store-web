import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'categoryTranslate',
  standalone: true
})
export class CategoryTranslatePipe implements PipeTransform {
  private readonly arToEnMap: Record<string, string> = {
    'تيشيرتات': 'T-SHIRTS',
    'هوديز': 'HOODIES',
    'قمصان': 'POLO SHIRTS',
    'اكسسوارات': 'ACCESSORIES',
    'كابات': 'ACCESSORIES'
  };

  private readonly enToArMap: Record<string, string> = {
    'tshirts': 'تيشيرتات',
    't-shirts': 'تيشيرتات',
    'hoodies': 'هوديز',
    'polo': 'قمصان',
    'polo-shirts': 'قمصان',
    'accessories': 'اكسسوارات'
  };

  transform(category: any, lang: 'ar' | 'en' = 'en'): string {
    if (!category) return '';

    // If it's a bilingual object
    if (category && typeof category === 'object') {
      if (lang === 'ar') {
        return category.nameAr || category.slug || '';
      }
      return category.nameEn || category.slug || '';
    }

    // If it's a legacy string (e.g. Arabic)
    const categoryStr = String(category).trim();
    const categoryLower = categoryStr.toLowerCase();
    
    if (lang === 'en') {
      // Try mapping Arabic to English
      return this.arToEnMap[categoryStr] || this.arToEnMap[categoryLower] || categoryStr.toUpperCase();
    } else {
      // Try mapping English to Arabic
      return this.enToArMap[categoryLower] || categoryStr;
    }
  }
}
