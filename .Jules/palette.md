## 2024-11-20 - Add loading spinner and aria-hidden to decorative icons

**Learning:** For async submit buttons like in Chat forms, providing explicit visual feedback via an animated spinner alongside updating text improves user experience and perceived responsiveness. Adding `aria-hidden="true"` to purely decorative icons alongside text in buttons prevents redundant screen reader announcements. Adding `motion-reduce:animate-none` class respects user preferences for reduced motion.
**Action:** When creating or updating interactive submit buttons, ensure an explicit loading state is shown to users, and appropriately hide decorative components via `aria-hidden`. Use `motion-reduce:animate-none` when adding animated classes like `animate-spin` in Tailwind.
