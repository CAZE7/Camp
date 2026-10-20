## 2026-10-20 - Added visual loading state to AI chat form
**Learning:** The AI chat form submit button lacked a visual loading state during submission. Adding an animated spinner using `Loader2` from `lucide-react` ensures clear feedback that an async operation is occurring, preventing user confusion.
**Action:** Always use an animated indicator along with `aria-hidden='true'` inside async submit buttons instead of just disabling them.
