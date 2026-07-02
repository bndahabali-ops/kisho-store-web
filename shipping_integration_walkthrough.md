# Dynamic Shipping Fees System Integration Walkthrough

We have integrated a dynamic shipping fees system based on the Egyptian governorate/region pricing sheet. The system updates shipping rates live on the customer checkout screen and records the rates automatically on order creation in the backend database.

---

## 1. Backend Architecture Updates (`kishostore_backend`)

### A. Database Schema Updates (`models/Order.model.js`)
We updated the Mongoose schema to snapshot the selected shipping fee and estimated delivery hours, ensuring historical order data remains pristine:
- Added `shippingFees` (Number) and `estimatedDeliveryTime` (String) to the main `OrderSchema`.
- Added `governorate` (String) and `region` (String) to the sub-document `ShippingAddressSchema`.

### B. Shipping Rate Matching Engine (`utils/shippingLookup.js`)
Created a matching utility containing Egypt's shipping rate tiers. It normalizes inputs (handling trim, casing, and substrings) and matches against both English/Arabic keywords:
- **Metro (مترو):** 65 EGP | 24 Hours
- **Cairo & Giza (القاهرة والجيزة):** 75 EGP | 24 Hours
- **Cairo/Giza Suburbs (ضواحي القاهرة والجيزة):** 80 EGP | 24 Hours
- **New Cities (العبور، مدينتي، الشروق...):** 85 EGP | 24 Hours
- **Alexandria & Canal Cities (الإسكندرية، الإسماعيلية، السويس، بورسعيد):** 90 EGP | 24-48 Hours
- **Delta (الدلتا):** 95 EGP | 24-48 Hours
- **Upper Egypt (الصعيد):** 105 EGP | 24-48 Hours
- **Coastal/North Coast (الساحل والشواطئ):** 115 EGP | 24-48 Hours
- **Sharm El Sheikh (شرم الشيخ):** 130 EGP | 24-48 Hours
- **Red Sea & South Sinai (البحر الأحمر وجنوب سيناء):** 135 EGP | 24-48 Hours

### C. Joi Request Validation (`modules/store/validations/order.validation.js`)
- Updated Joi schema in `shippingAddressSchema` to permit incoming `governorate` and `region` strings.

### D. Transaction Order Service (`modules/store/services/order.service.js`)
- Integrated shipping rate lookup on checkout:
  ```javascript
  const lookupKey = shippingAddress.governorate || shippingAddress.region || shippingAddress.city;
  const { shippingFees, estimatedDeliveryTime } = getShippingRate(lookupKey);
  const totalAmount = parseFloat((itemsPrice + shippingFees).toFixed(2));
  ```
- Saved resolved fees and delivery time attributes directly into the order transaction write.

---

## 2. Customer Frontend Integration (`kisho-web-app`)

### A. TypeScript Interface Alignment (`src/app/core/models/order.model.ts`)
- Added `governorate`, `region`, `shippingFees`, and `estimatedDeliveryTime` types.

### B. Lookup Matrix (`src/app/features/checkout/checkout.validators.ts`)
- Replaced the simple `EGYPTIAN_CITIES` string array with the structured `SHIPPING_ZONES` dictionary.

### C. Reactive State & Logic (`src/app/features/checkout/checkout.component.ts`)
- Added `selectedZoneFee` and `selectedZoneDelivery` reactive signals.
- Created a `grandTotal` computed signal (`cartTotal` + `selectedZoneFee`).
- Listened to the dropdown form value changes to instantly update state:
  ```typescript
  this.checkoutForm.get('shippingAddress.city')?.valueChanges.subscribe(cityValue => {
      const zone = this.shippingZones.find(z => z.value === cityValue);
      this.selectedZoneFee.set(zone ? zone.fee : 0);
      this.selectedZoneDelivery.set(zone ? zone.deliveryTime : '');
  });
  ```
- Mapped selected options to populate the `governorate` and `region` payload fields.

### D. UI Template Rendering (`src/app/features/checkout/checkout.component.html`)
- Updated the city select input to bind to the dynamic `shippingZones` options list.
- Replaced the hardcoded shipping indicator with a live breakdown panel showing:
  - **Subtotal** (sum of products)
  - **Shipping Fees** (live rates with delivery estimates)
  - **Total Price** (live grand total)

---

## 3. Admin Dashboard Models Alignment (`kisho_fronted`)
- Updated the `Order` interface in `src/app/core/services/admin-order.service.ts` to include the same shipping fields, ensuring type alignment and enabling admin panels to access rates seamlessly.
