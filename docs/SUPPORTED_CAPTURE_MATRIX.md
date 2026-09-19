# Supported capture matrix

## Paid-pilot baseline

| Surface         | Supported baseline                                                 | Limits that must be tested before contract                                               |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Desktop browser | Current and previous major Chrome and Edge on Windows/macOS        | Camera/microphone permissions, download policy, managed-browser restrictions             |
| Android         | Current and previous major Chrome on supported Android releases    | Rear-camera focus, memory pressure, screen lock, offline restart                         |
| iPhone/iPad     | Current and previous major Safari on supported iOS/iPadOS releases | Microphone permission, camera file capture, IndexedDB persistence, background suspension |
| Badge QR        | Plain QR content that resolves to text or a URL                    | Proprietary/encrypted event-organizer payloads need a named provider integration         |
| Visiting card   | JPG/PNG/PDF photographed or selected by the user                   | Low light, glare, multilingual cards and handwriting require human correction            |
| Voice note      | Browser-supported recorded audio accepted by the capture flow      | Noisy booth accuracy, language mix and long recordings require pilot evaluation          |
| Manual entry    | All supported browsers                                             | Required fallback when scanning or AI is unavailable                                     |

The product must never promise support for a proprietary badge provider until that provider's sample badges, data contract, permission model, and event-day offline behavior pass a documented test. Manual entry remains the release fallback.

## Event-day acceptance test

Test each device model that the sales team will carry. Capture at least ten samples per enabled mode, switch offline before saving three records, close and reopen the browser, reconnect, and confirm that each stable capture ID creates exactly one lead. Verify camera and microphone denial states, low-storage behavior, incorrect files, duplicate badges, correction of every extracted field, and export after synchronization.
