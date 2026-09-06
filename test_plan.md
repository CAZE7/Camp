1. **Create `components/ui/ValidatingNumberInput.tsx`:**
   - Implement a controlled numeric input component.
   - It maintains its own local string state while focused to allow typing (like deleting to empty before entering a new number, or typing a decimal point).
   - If the input is empty, it calls `onChange(null)` instead of `onChange(0)`.
   - Uses `aria-invalid` and displays an error message below the input when the required field is empty.
2. **Update `components/inspector/NodeInspectors.tsx`:**
   - Import `ValidatingNumberInput`.
   - Replace all `input type="number"` with `<ValidatingNumberInput>`.
   - Update `onChange` handlers to handle `null` (e.g. `onChange={(val) => onUpdateNodeData?.(node.id, { capacity: val })}`).
   - If a fallback `0` was being used (like `value={node.data?.capacity || 0}`), replace it with `value={node.data?.capacity ?? null}`.
   - Add appropriate `errorMessage` properties.
3. **Update `components/ui/StepperSlider.tsx` (if needed):**
   - The user mentioned numeric input handling across the planner. `StepperSlider` uses `type="range"`, which doesn't suffer from empty string issues. However, if there's a numeric input anywhere else using `Number()`, we check it. The `StepperSlider` doesn't have an empty state because ranges have minimums. We will leave `StepperSlider` alone unless it contains text input.
4. **Complete pre-commit steps:**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
