## 2025-05-15 - [AI Chat Feedback & Icon Button Accessibility]
**Learning:** Icon-only buttons (like the floating chat toggle and sidebar arrows) lacked accessible labels, making them unusable for screen readers. Additionally, the AI chat provided no visual feedback during processing, leading to uncertainty if the message was sent.
**Action:** Consistently apply `aria-label` to SVG buttons and utilize the `status` field from `useChat` to provide immediate "typing" feedback and disable inputs during active streaming.
