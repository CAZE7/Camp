## 2025-05-15 - [AI Chat Feedback & Icon Button Accessibility]
**Learning:** Icon-only buttons (like the floating chat toggle and sidebar arrows) lacked accessible labels, making them unusable for screen readers. Additionally, the AI chat provided no visual feedback during processing, leading to uncertainty if the message was sent.
**Action:** Consistently apply `aria-label` to SVG buttons and utilize the `status` field from `useChat` to provide immediate "typing" feedback and disable inputs during active streaming.

## 2026-05-04 - Loading states for async submissions
**Learning:** For components executing async operations like AI chat, simply disabling the submit button leaves the user wondering if their action registered. Adding a visual loading spinner inside the button provides clear feedback without needing an extra layout container.
**Action:** Always check async submit buttons (e.g., forms, AI prompts) to ensure they provide explicit visual feedback (like a spinner) beyond just a `disabled` state.

## 2026-05-18 - Search Input UX
**Learning:** Empty search results with just a "No components found" message provide poor user experience. Users have to manually select the input and delete their text to see the list again.
**Action:** Always provide an explicit "Clear Search" button in empty states, and add an inline 'X' clear button inside the search input itself to make returning to the default state a one-click action.

## 2026-05-18 - Search Clear Button Accessibility
**Learning:** Missing `aria-label` on inline search-clear buttons makes them completely invisible/unusable to screen readers, leaving users stuck without knowing what the clear icon does.
**Action:** Always ensure icon-only buttons, especially those placed conditionally inside inputs (like clear buttons), receive descriptive `aria-label`s.

## 2026-05-18 - Missing Empty State for Inspector
**Learning:** The `Inspector` component simply displayed "Kein Element ausgewählt" when no node or edge was selected, leaving the user with an empty pane. An empty state like this should provide guidance or an action.
**Action:** Replaced the plain text empty state in `Inspector` with an icon (`MousePointerClick`) and a short sentence guiding the user to click on a component or connection in the schematic.

## 2026-05-18 - Missing Input Labels ID Linking
**Learning:** In the Inspector UI components, multiple `<input>` and `<select>` fields had visual labels but lacked proper `id` attributes linked via the label's `htmlFor` attribute. This is a significant accessibility issue because screen readers cannot associate the text label with the form field, and users cannot click the label to focus the input.
**Action:** Always ensure every form element (`<input>`, `<select>`, `<textarea>`) has a unique `id` and is paired with a `<label>` containing a matching `htmlFor` attribute, or is wrapped by the label.

## 2026-05-18 - Missing Input Labels ID Linking
**Learning:** In the Inspector UI components, multiple `<input>` and `<select>` fields had visual labels but lacked proper `id` attributes linked via the label's `htmlFor` attribute. This is a significant accessibility issue because screen readers cannot associate the text label with the form field, and users cannot click the label to focus the input.
**Action:** Always ensure every form element (`<input>`, `<select>`, `<textarea>`) has a unique `id` and is paired with a `<label>` containing a matching `htmlFor` attribute, or is wrapped by the label.
## 2026-05-16 - Add ARIA Attributes to Custom Accordion
**Learning:** Custom implementations of interactive components like accordions often lack built-in accessibility. It is crucial to manually link the toggle button state and the content container using `aria-expanded` and `aria-controls`, paired with an `id` on the content wrapper, so screen readers can interpret the relationship and state changes correctly.
**Action:** Always verify custom interactive components (dropdowns, accordions, tabs) for appropriate ARIA state and linking attributes (`aria-expanded`, `aria-controls`, `id`) during implementation and code reviews.
## 2026-05-18 - Missing Explicit ID linking on Search Inputs
**Learning:** Search input fields inside dynamic components or popovers can lose accessibility if their placeholder text is solely relied upon for screen reader context. Visually hidden labels using `.sr-only` are crucial, but they must be explicitly linked to the input via an `id` matching the `htmlFor` attribute. In components like `Sidebar.tsx`, the `<input>` element lacked an `id` property entirely, breaking the connection to the hidden label and resulting in poor accessibility for assistive technologies. Additionally, tests checking for placeholder text should match exactly rather than relying on emojis that might change or cause rendering inconsistencies in some environments.
**Action:** Always add an explicit `id` to form inputs, even when visually hidden labels are used, to maintain a 1:1 linkage via `htmlFor`. When updating UI components, also ensure tests querying elements by visible text or placeholders are correctly updated to match the final rendered text.
