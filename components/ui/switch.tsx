"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

function Switch({
  className,
  size = "default",
  children,
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default" | "theme"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-[size=theme]:h-10 data-[size=theme]:w-20 data-[size=theme]:justify-between data-[size=theme]:bg-muted data-[size=theme]:p-1 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input data-[size=theme]:data-checked:bg-muted data-[size=theme]:data-unchecked:bg-muted dark:data-[size=theme]:bg-foreground/15 dark:data-[size=theme]:data-checked:bg-foreground/15 dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-background shadow-sm ring-1 ring-black/5 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=theme]/switch:absolute group-data-[size=theme]/switch:left-1 group-data-[size=theme]/switch:top-1 group-data-[size=theme]/switch:z-0 group-data-[size=theme]/switch:size-8 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=theme]/switch:data-checked:translate-x-10 group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 group-data-[size=theme]/switch:data-unchecked:translate-x-0 dark:data-checked:bg-background dark:data-unchecked:bg-foreground dark:ring-white/10"
      />
      {children}
    </SwitchPrimitive.Root>
  )
}

export { Switch }
