# KAVACH Design Guidelines

## Architecture Decisions

### Authentication
**Auth Required** - Multi-step verification flow:

1. **Language Selection** (First Launch)
   - Present 4+ languages (English, Hindi, Odia, expandable)
   - Full-screen card-based language picker with visual flags/icons
   - Proceed button appears after selection

2. **Phone Verification**
   - Phone number input with country code selector
   - Offline OTP: 6-digit code input with auto-focus
   - Resend OTP button (disabled for 30s countdown)
   - Mock the verification flow for prototype

3. **Bank Account Linking**
   - Phone number auto-match simulation
   - Bank selection dropdown/searchable list
   - Account number display (masked: XXXX 1234)
   - "Link Account" primary action button

4. **Security Setup**
   - Biometric enrollment screen (fingerprint/Face ID)
   - Fallback 6-digit PIN creation with confirmation
   - Link to Aadhaar verification (UI placeholder)

5. **Login Screen** (Return Users)
   - Biometric prompt OR PIN entry
   - "Forgot PIN?" recovery flow
   - Language switcher in top-right corner

### Navigation
**Custom Circular Dashboard Navigation** - Based on the KAVACH UI design:

- **Landing Screen**: Main Dashboard with circular menu (no tab bar)
- **Circular Menu Items** (radial layout around center AI assistant):
  - Send Money
  - QR Scanner
  - Scan Message (Fraud Detection)
  - Account Balance
  - Recent Activity
  - Settings (accessed from top-right hamburger)

- **Floating Elements**:
  - SOS Fraud Button (persistent top-left red button on main screens)
  - Voice Guide Toggle (top-right)
  - Network Status Indicator (Online/Offline toggle)

- **Modals** (overlay navigation):
  - Voice Assistant Interface (center of dashboard, expands on tap)
  - Transaction Details
  - Fraud Alert Dialog

### Screen Specifications

#### 1. Language Selection Screen
- **Layout**: Full-screen, vertical card stack
- **Header**: App logo "KAVACH" centered, no navigation buttons
- **Content**: 
  - Title: "Select Your Language / अपनी भाषा चुनें"
  - 4+ language cards with flag icons and native text
  - Selected state: highlighted border + checkmark
- **Footer**: "Continue" button (enabled after selection)
- **Safe Area**: Top inset = insets.top + Spacing.xl, Bottom inset = insets.bottom + Spacing.xl

#### 2. Phone Verification Screen
- **Layout**: Scrollable form
- **Header**: Transparent with back button (left), language switcher (right)
- **Content**:
  - Heading: "Verify Your Number"
  - Country code dropdown + phone input field
  - "Send OTP" button
  - OTP input section (6 boxes, auto-focus progression)
  - Countdown timer for resend
- **Safe Area**: Top inset = headerHeight + Spacing.xl, Bottom inset = insets.bottom + Spacing.xl

#### 3. Bank Linking Screen
- **Layout**: Scrollable form
- **Header**: Transparent with back button, "Link Bank Account" title
- **Content**:
  - "Phone Match Found" success message with checkmark
  - Bank logo + name display
  - Masked account number (XXXX XXXX XXXX 1234)
  - "Confirm & Link" primary button
- **Safe Area**: Top inset = headerHeight + Spacing.xl, Bottom inset = insets.bottom + Spacing.xl

#### 4. Main Dashboard
- **Layout**: Fixed, non-scrollable circular menu design
- **Header**: Custom transparent header
  - Left: SOS Fraud Button (red, 40x40 circular)
  - Center: "KAVACH" wordmark
  - Right: Voice Guide toggle icon, Network status dot
- **Content**:
  - **Center**: AI Voice Assistant circle (60% screen width)
    - Microphone icon with pulse animation when active
    - "Tap to Speak" hint text below
  - **Circular Menu**: 6 icons positioned radially around center
    - Each icon: 56x56 circular button with drop shadow
    - Labels below each icon (12sp, secondary color)
    - Spacing: 30-40° apart around 180° arc
- **Bottom Mini Dashboard** (fraud stats):
  - 4 metric cards: SMS Scans, Device Health, Transactions, Services
  - Horizontal scroll or 2x2 grid layout
- **Safe Area**: Top inset = headerHeight + Spacing.md, Bottom inset = insets.bottom + Spacing.xl

#### 5. Send Money Screen
- **Layout**: Scrollable form with floating confirmation button
- **Header**: Default navigation with "Send Money" title, cancel (left)
- **Content**:
  - Recipient selection (search contacts or enter UPI ID/phone)
  - Amount input (large, centered numeric keyboard)
  - Note/message field (optional)
  - "Review Payment" button
- **Floating Button**: Bottom-right corner, 56x56 circular
  - Safe area: bottom inset = insets.bottom + Spacing.xl, right = Spacing.xl
- **Safe Area**: Top inset = Spacing.xl, Bottom inset = insets.bottom + 80

#### 6. QR Scanner Screen
- **Layout**: Full-screen camera view with overlay
- **Header**: Transparent overlay with close (X) button
- **Content**:
  - Camera viewfinder (full height)
  - Scanning frame (white/green border, centered)
  - "Scan QR Code" instruction text
  - Manual entry button at bottom
- **Safe Area**: Top inset = insets.top + Spacing.md

#### 7. Voice Assistant Modal
- **Layout**: Animated expanding modal (center → full screen)
- **Content**:
  - Large waveform visualization during listening
  - Transcribed text display (real-time)
  - Suggested actions chips below transcription
  - "Listening..." / "Processing..." status
  - Close button (top-right)
- **Interaction**: Swipe down to dismiss

## Design System

### Color Palette (from KAVACH UI)
**Primary Colors:**
- Background: `#F5F1E8` (warm beige/cream)
- Primary Action: `#2C5F4F` (deep teal-green)
- Secondary Action: `#7A9B8E` (muted sage)
- SOS/Alert: `#D32F2F` (bright red)

**Accent Colors:**
- Success: `#43A047` (green)
- Warning: `#FB8C00` (orange)
- Info: `#1976D2` (blue)

**Neutrals:**
- Text Primary: `#1A1A1A` (almost black)
- Text Secondary: `#666666` (gray)
- Border: `#D4CFC2` (light taupe)
- Card Background: `#FFFFFF` (white)

### Typography
**Font Family**: System default (San Francisco for iOS, Roboto for Android)

**Text Styles:**
- Heading 1: 28sp, Bold, Text Primary
- Heading 2: 22sp, SemiBold, Text Primary
- Body: 16sp, Regular, Text Primary
- Caption: 14sp, Regular, Text Secondary
- Label: 12sp, Medium, Text Secondary

**Multi-lingual Support:**
- Ensure all text styles support Hindi Devanagari, Odia, and Unicode characters
- Increase line height by 20% for non-Latin scripts

### Spacing System
- XS: 4px
- SM: 8px
- MD: 16px
- LG: 24px
- XL: 32px
- XXL: 48px

### Iconography
- Use Feather icons from `@expo/vector-icons` for standard UI elements
- Custom SVG icons for circular menu items (Send, QR, Scan Message, Balance, Activity)
- Icon sizes: 20px (small), 24px (default), 32px (large), 48px (feature icons)
- Color: Match text primary or use accent colors for actions

### Interactive Elements

**Buttons:**
1. **Primary Button**:
   - Background: Primary Action color
   - Text: White, 16sp, SemiBold
   - Border Radius: 12px
   - Height: 52px
   - Press State: Opacity 0.8 + scale 0.98

2. **Circular Menu Buttons**:
   - Size: 56x56
   - Background: White
   - Drop Shadow: shadowOffset {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2
   - Icon: 24px, Primary Action color
   - Press State: Scale 0.95, slight elevation increase

3. **SOS Button**:
   - Size: 40x40
   - Background: SOS/Alert color
   - Icon: White exclamation or shield
   - Press State: Pulse animation + haptic feedback

**Input Fields:**
- Height: 48px
- Border: 1px solid Border color
- Border Radius: 8px
- Focus State: Border color → Primary Action, 2px width
- Padding: Horizontal 16px

**Cards:**
- Background: Card Background
- Border Radius: 16px
- Padding: 16px
- Shadow: subtle (shadowOffset {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4)

### Accessibility
- **Voice Commands**: Every action on circular menu must be voice-triggerable
- **Color Contrast**: Minimum 4.5:1 ratio for text, 3:1 for interactive elements
- **Touch Targets**: Minimum 44x44 for all touchable elements
- **Screen Reader**: All icons have descriptive labels in selected language
- **Haptic Feedback**: On payment confirmation, SOS activation, errors

### Critical Assets
1. **KAVACH Logo** (SVG)
   - Horizontal wordmark for header
   - Square icon for loading/splash

2. **Bank Logos** (10 major banks)
   - Square format, 48x48
   - Consistent style with slight brand color variation

3. **Language Flags** (4 initial languages)
   - 32x24 rounded rectangle flags

4. **Profile Avatar Placeholders** (3 options)
   - Geometric patterns in Primary/Secondary colors
   - 80x80 circular

5. **Voice Assistant Waveform** (Lottie animation)
   - Smooth, organic wave pattern in Primary Action color

### Security Visual Cues
- **Biometric Icon**: Fingerprint or Face ID glyph, 64x64
- **Secure Connection**: Green lock icon in header when active
- **Fraud Detection Badge**: Shield with checkmark (green) or X (red)
- **Offline Mode Indicator**: Orange dot + "Offline" label in header