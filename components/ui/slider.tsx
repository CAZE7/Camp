import { Slider as SliderPrimitive } from '@base-ui/react/slider';

import { cn } from '@/lib/utils';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min];

  return (
    <SliderPrimitive.Root
      className={cn(
        'relative flex w-full touch-none select-none items-center group data-[orientation=vertical]:flex-col data-[orientation=vertical]:w-auto data-[orientation=vertical]:h-full py-4',
        className
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="center"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full grow items-center data-[orientation=vertical]:flex-col data-[orientation=vertical]:h-full">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden bg-rule data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-copper data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="block size-5 shrink-0 rounded-none border-2 border-ink bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
