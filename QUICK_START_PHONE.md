# Quick Start: Phone Validation Setup

## Step 1: Install Dependencies

Run this command in your terminal:

```bash
npm install
```

This will install:
- `libphonenumber-js` - Phone validation library
- `react-phone-number-input` - React component with country selector

## Step 2: Test the Feature

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to: **Dashboard → Customers → New Customer**

3. Try creating a customer with different phone formats:
   - **India**: Select India (+91), enter 9876543210
   - **USA**: Select United States (+1), enter 4155552671
   - **UK**: Select United Kingdom (+44), enter 7911123456

4. The phone number will:
   - Show country flag
   - Format automatically as you type
   - Validate for the selected country
   - Store in E.164 format (+919876543210)

## What's Changed?

### ✅ Customer Forms
- New customer creation now has country selector
- Edit customer page updated with phone validation
- Contact picker still works

### ✅ Validation
- Phone numbers must include country code
- Validates against real phone number formats
- Shows clear error messages

### ✅ Storage
- All phone numbers stored in E.164 format
- Example: +919876543210 (not 9876543210)

## Current Default Country

**India (+91)** is set as default.

To change, edit the PhoneInput component calls:
```tsx
<PhoneInput defaultCountry="US" ... />  // For USA
<PhoneInput defaultCountry="GB" ... />  // For UK
```

## What About Existing Customers?

Existing customers with phone numbers **without country codes** will:
1. Display as-is until edited
2. Show validation error when edited
3. Need country code selected to save

### Quick Fix for Existing Data

If all your existing numbers are from India, run this SQL:

```sql
UPDATE customers 
SET mobile = CONCAT('+91', mobile) 
WHERE LENGTH(mobile) = 10 
  AND mobile NOT LIKE '+%';
```

Or for USA:
```sql
UPDATE customers 
SET mobile = CONCAT('+1', mobile) 
WHERE LENGTH(mobile) = 10 
  AND mobile NOT LIKE '+%';
```

## Files You Can Use

### 1. PhoneInput Component
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
      defaultCountry="IN"
    />
  )}
/>
```

### 2. Phone Display Component
```tsx
import { PhoneDisplay } from "@/components/phone-display";

<PhoneDisplay phoneNumber="+919876543210" />
// Shows: 📱 +91 98765 43210
```

### 3. Phone Utilities
```tsx
import { formatPhoneNumber, validatePhoneNumber } from "@/lib/phone-utils";

// Format for display
formatPhoneNumber("+919876543210", "international")  // +91 98765 43210

// Validate
validatePhoneNumber("+919876543210")  // true or false
```

## Common Questions

### Q: Can I use local format without country code?
**A:** No, the validation requires international format with country code for accuracy.

### Q: Will this work for WhatsApp numbers?
**A:** Yes! The same validation can be applied to WhatsApp field.

### Q: What about landline numbers?
**A:** The library validates both mobile and landline numbers per country rules.

### Q: Can users still use the contact picker?
**A:** Yes! The contact picker integration is maintained and works seamlessly.

## Next Steps

### Optional Updates:

1. **Update Employee Forms**
   - Add PhoneInput to employee creation
   - Add PhoneInput to employee edit

2. **Update User Forms**
   - Add PhoneInput to user creation
   - Add PhoneInput to user edit

3. **Display Formatting**
   - Use PhoneDisplay component in customer lists
   - Use PhoneDisplay in employee lists

4. **WhatsApp Field**
   - Add same validation to WhatsApp field
   - Or add a "Use same as mobile" checkbox

## Support

For detailed documentation, see: `docs/PHONE_VALIDATION.md`

For implementation summary, see: `PHONE_VALIDATION_SUMMARY.md`

## That's It! 🎉

Your phone validation is ready to use. Just run `npm install` and test it out!
