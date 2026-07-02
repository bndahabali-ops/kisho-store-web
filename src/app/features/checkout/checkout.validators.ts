/* checkout.validators.ts — English version */
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Egyptian phone: 010/011/012/015 + 8 digits = 11 total
const EGYPTIAN_PHONE_REGEX = /^(010|011|012|015)\d{8}$/;

// Name: letters (Arabic + Latin), spaces, hyphens, dots only
const NAME_REGEX = /^[\u0600-\u06FFa-zA-Z\s\-.]+$/;

export interface ShippingZone {
  name: string;
  value: string;
  fee: number;
  deliveryTime: string;
}

export const SHIPPING_ZONES: ShippingZone[] = [
  { name: 'Metro (مترو)', value: 'Metro', fee: 65, deliveryTime: '24 Hours' },
  { name: 'Cairo (القاهرة)', value: 'Cairo', fee: 75, deliveryTime: '24 Hours' },
  { name: 'Giza (الجيزة)', value: 'Giza', fee: 75, deliveryTime: '24 Hours' },
  { name: 'Cairo/Giza Suburbs (ضواحي القاهرة والجيزة)', value: 'Cairo/Giza Suburbs', fee: 80, deliveryTime: '24 Hours' },
  { name: 'New Cities (العبور، مدينتي، الشروق، بدر، العاشر من رمضان...)', value: 'Cities', fee: 85, deliveryTime: '24 Hours' },
  { name: 'Alexandria (الإسكندرية)', value: 'Alexandria', fee: 90, deliveryTime: '24-48 Hours' },
  { name: 'Ismailia (الإسماعيلية)', value: 'Ismailia', fee: 90, deliveryTime: '24-48 Hours' },
  { name: 'Suez (السويس)', value: 'Suez', fee: 90, deliveryTime: '24-48 Hours' },
  { name: 'Port Said (بورسعيد)', value: 'Port Said', fee: 90, deliveryTime: '24-48 Hours' },
  { name: 'Delta (الدلتا - الدقهلية، قليوبية، الغربية، الشرقية، دمياط...)', value: 'Delta', fee: 95, deliveryTime: '24-48 Hours' },
  { name: 'Upper Egypt (الصعيد - الفيوم، بني سويف، أسيوط، سوهاج...)', value: 'Upper Egypt 1', fee: 105, deliveryTime: '24-48 Hours' },
  { name: 'Coastal/North Coast (مطروح، الغردقة، الساحل الشمالي...)', value: 'Coastal/North Coast', fee: 115, deliveryTime: '24-48 Hours' },
  { name: 'Sharm El Sheikh (شرم الشيخ)', value: 'Sharm El Sheikh', fee: 130, deliveryTime: '24-48 Hours' },
  { name: 'Red Sea & South Sinai (سفاجا، القصير، دهب، الطور...)', value: 'Red Sea & South Sinai', fee: 135, deliveryTime: '24-48 Hours' },
];

export function egyptianPhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').trim().replace(/\s+/g, '');
    if (!value) return null;
    return EGYPTIAN_PHONE_REGEX.test(value)
      ? null
      : { egyptianPhone: 'Must start with 010, 011, 012, or 015 and be 11 digits.' };
  };
}

export function nameValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').trim();
    if (!value) return null;
    return NAME_REGEX.test(value) ? null : { invalidName: 'Name contains invalid characters.' };
  };
}

export function maxLengthTrimmed(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const len = (control.value ?? '').trim().length;
    return len <= max ? null : { maxLengthTrimmed: `Maximum ${max} characters allowed.` };
  };
}

export function getFieldError(control: AbstractControl | null): string | null {
  if (!control || !control.errors || !control.touched) return null;
  const e = control.errors;
  if (e['required'])          return 'This field is required.';
  if (e['email'])             return 'Invalid email address.';
  if (e['egyptianPhone'])     return e['egyptianPhone'];
  if (e['invalidName'])       return e['invalidName'];
  if (e['maxLengthTrimmed'])  return e['maxLengthTrimmed'];
  if (e['maxlength'])         return `Maximum ${e['maxlength'].requiredLength} characters.`;
  if (e['minlength'])         return `Minimum ${e['minlength'].requiredLength} characters.`;
  return 'Invalid value.';
}
