## 2024-10-17 - AI Chat Loading State
**Learning:** Async forms without explicit loading states lead to a confusing UX where the user clicks and waits with no confirmation that work is happening, relying purely on the `disabled` attribute.
**Action:** Always add visual indicators like a spinning `Loader2` and updated button text for long-running async requests like chat messages, and ensure to apply `aria-hidden="true"` on these icons so screen readers do not redundantly announce them.
