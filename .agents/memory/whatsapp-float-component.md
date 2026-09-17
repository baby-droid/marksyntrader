---
name: WhatsApp Float merged component
description: WhatsAppFloat.tsx replaces both WhatsAppButton and WhatsAppSignals; top-left default, draggable, CallMeBot signal sending
---

## Rule
`src/components/floating/WhatsAppFloat.tsx` is the single unified WhatsApp component. Do not recreate WhatsAppButton or WhatsAppSignals — they have been replaced.

**Why:** User requested merge of the square signal widget into the circular floating WhatsApp FAB.

## How to apply
- In `main.tsx` import `WhatsAppFloat` from `@/components/floating/WhatsAppFloat`, render `<WhatsAppFloat />` once.
- Default position: `{ x: 20, y: 100 }` (top-left), stored in localStorage key `wa_float_pos`.
- Popup opens on click (if not dragged), toggle with `wa_float_open` key.
- Two tabs: "Signals" (auto-generated + live from scalper) and "Pair WA" (CallMeBot integration).
- Signal sending: uses CallMeBot API `https://api.callmebot.com/whatsapp.php?phone=...&text=...&apikey=...` — no CORS issues (mode: no-cors).
- Pairing config stored in `wa_float_pair` localStorage key: `{ phone, apiKey, enabled }`.
- Scalper dispatches signals via `window.dispatchEvent(new CustomEvent('wa:signal', { detail: {...} }))`.
