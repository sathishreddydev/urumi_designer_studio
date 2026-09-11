# Phone Number Validation - Country-Wise Implementation

## Overview

This application now supports international phone number validation with proper country code support. Phone numbers are validated using the `libphonenumber-js` library, which ensures accurate validation across different countries.

## Features

- ✅ **International Format Support**: Automatically formats phone numbers with country codes
- ✅ **Country Selection**: Users can select their country from a dropdown
- ✅ **Real-time Validation**: Phone numbers are validated as users type
- ✅ **E.164 Format Storage**: All phone numbers are stored in standard E.164 format (e.g., +919876543210)
- ✅ **Display Formatting**: Numbers are displayed in user-friendly international format
- ✅ **Multiple Countries**: Supports validation for all countries worldwide

## Components

### PhoneInput Component

Located at: `src/components/phone-input.tsx`

A reusable component that combines:
- Country selector (with flags)
- Phone number input field
- Automatic formatting
- Validation feedback

**Usage:**

```tsx
import { PhoneInput } from "@/components/phone-input";
import { Controller } from "react-hook-form";

<Controller
  name="mobile"
  control={control}
  render={({ field }) => (
    <PhoneInput
      value={field.value}
      onChange={(value) => field.onChange(value || "")}
      placeholder="Enter phone number"
      defaultCountry="IN"  // Set your default country
    />
  )}
/>
```

## Validation Rules

### Customer Phone (`mobile` field)
- **Required**: Yes
- **Format**: Must include country code (e.g., +91 for India)
- **Validation**: Uses `isValidPhoneNumber()` from libphonenumber-js
- **Error Message**: "Please enter a valid phone number with country code"

### User Phone (`phone` field)
- **Required**: No (optional)
- **Format**: Must include country code if provided
- **Validation**: Same as customer phone, but allows empty values

### Employee Phone (`phone` field)
- **Required**: Yes
- **Format**: Must include country code
- **Validation**: Same as customer phone

## Utility Functions

Located at: `src/lib/phone-utils.ts`

### `formatPhoneNumber()`
Formats a phone number for display.

```typescript
formatPhoneNumber("+919876543210", "international")
// Returns: "+91 98765 43210"

formatPhoneNumber("+919876543210", "national")
// Returns: "098765 43210"

formatPhoneNumber("+919876543210", "e164")
// Returns: "+919876543210"
```

### `validatePhoneNumber()`
Validates if a phone number is valid.

```typescript
validatePhoneNumber("+919876543210")  // Returns: true
validatePhoneNumber("123")            // Returns: false
```

### `getPhoneCountry()`
Extracts the country code from a phone number.

```typescript
getPhoneCountry("+919876543210")  // Returns: "IN"
getPhoneCountry("+14155552671")   // Returns: "US"
```

## Default Country

The default country is set to **India (IN)** but can be easily changed:

```tsx
<PhoneInput defaultCountry="US" ... />  // For United States
<PhoneInput defaultCountry="GB" ... />  // For United Kingdom
<PhoneInput defaultCountry="AU" ... />  // For Australia
```

## Database Storage

Phone numbers are stored in **E.164 format** in the database:
- Format: `+[country code][number]`
- Example: `+919876543210` (India)
- Example: `+14155552671` (USA)
- Example: `+447911123456` (UK)

This ensures consistency and makes international operations easier.

## Updated Pages

The following pages now use the new phone validation:

1. **Customer Creation** (`src/app/dashboard/customers/new/page.tsx`)
2. **Customer Edit** (`src/app/dashboard/customers/[id]/edit/page.tsx`)
3. **Employee Forms** (Ready to update)
4. **User Forms** (Ready to update)

## Styling

Custom styles are located in `src/styles/phone-input.css` and integrated with the application's design system.

## Dependencies

Added to `package.json`:
- `libphonenumber-js`: ^1.11.14 - Core validation library
- `react-phone-number-input`: ^3.4.8 - React component with country selector

## Installation

After updating the code, run:

```bash
npm install
```

This will install the new phone validation libraries.

## Common Country Codes

| Country       | Code | Example           |
|---------------|------|-------------------|
| India         | +91  | +91 98765 43210   |
| United States | +1   | +1 415 555 2671   |
| United Kingdom| +44  | +44 7911 123456   |
| Australia     | +61  | +61 4 1234 5678   |
| Canada        | +1   | +1 416 555 0123   |
| UAE           | +971 | +971 50 123 4567  |
| Singapore     | +65  | +65 9123 4567     |

## Migration Notes

### Existing Phone Numbers

If you have existing phone numbers in the database without country codes:

1. They will fail validation when edited
2. Users will need to select the correct country and re-enter the number
3. Consider running a migration script to add country codes to existing numbers

### Sample Migration Query

```sql
-- Example for Indian numbers (assuming 10-digit format)
UPDATE customers 
SET mobile = CONCAT('+91', mobile) 
WHERE LENGTH(mobile) = 10 AND mobile NOT LIKE '+%';
```

## Troubleshooting

### "Please enter a valid phone number with country code"

**Solution**: Make sure the country is selected and the number matches that country's format.

### Phone number displays without formatting

**Solution**: Use the `formatPhoneNumber()` utility function to format for display.

### Contact picker not working with new format

**Solution**: The contact picker integration is maintained. Numbers picked from contacts are automatically formatted.

## Future Enhancements

- [ ] Add phone number type detection (mobile vs landline)
- [ ] WhatsApp number validation and integration
- [ ] SMS verification during customer registration
- [ ] Auto-detect country from browser locale
- [ ] Bulk phone number import with validation
