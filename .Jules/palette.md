## 2025-05-15 - [AI Chat Feedback & Icon Button Accessibility]
**Learning:** Icon-only buttons (like the floating chat toggle and sidebar arrows) lacked accessible labels, making them unusable for screen readers. Additionally, the AI chat provided no visual feedback during processing, leading to uncertainty if the message was sent.
**Action:** Consistently apply `aria-label` to SVG buttons and utilize the `status` field from `useChat` to provide immediate "typing" feedback and disable inputs during active streaming.

## 2026-05-04 - Loading states for async submissions
**Learning:** For components executing async operations like AI chat, simply disabling the submit button leaves the user wondering if their action registered. Adding a visual loading spinner inside the button provides clear feedback without needing an extra layout container.
**Action:** Always check async submit buttons (e.g., forms, AI prompts) to ensure they provide explicit visual feedback (like a spinner) beyond just a `disabled` state.

## 2026-05-18 - Search Input UX
**Learning:** Empty search results with just a "No components found" message provide poor user experience. Users have to manually select the input and delete their text to see the list again.
**Action:** Always provide an explicit "Clear Search" button in empty states, and add an inline 'X' clear button inside the search input itself to make returning to the default state a one-click action.
