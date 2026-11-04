"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { LiquidGlass } from "@/components/ui/opaline/liquid-glass"

const glassButtonVariants = cva(
  "group/glass-button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-medium tracking-[-0.01em] whitespace-nowrap text-(--glass-foreground) transition-[transform,filter] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] outline-none select-none active:scale-[0.96] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.15em] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] hover:before:opacity-100",
  {
    variants: {
      variant: {
        default: "",
        prominent: "text-white",
        destructive: "text-white",
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        default: "h-11 px-5 text-[15px]",
        lg: "h-14 px-7 text-[17px]",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-14 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const tints = {
  default: undefined,
  prominent: "oklch(0.6 0.2 255 / 0.78)",
  destructive: "oklch(0.62 0.22 27 / 0.8)",
}

type GlassButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof glassButtonVariants> & {
    asChild?: boolean
    /** Custom tint colour, e.g. `oklch(0.7 0.18 150 / 0.7)`. */
    tint?: string
  }

function GlassButton({
  className,
  variant = "default",
  size,
  asChild = false,
  tint,
  children,
  onPointerMove,
  type = "button",
  ...props
}: GlassButtonProps) {
  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`)
    onPointerMove?.(e as React.PointerEvent<HTMLButtonElement>)
  }

  return (
    <LiquidGlass
      data-slot="glass-button"
      tint={tint ?? tints[variant ?? "default"]}
      className={cn(glassButtonVariants({ variant, size }), className)}
      onPointerMove={handlePointerMove}
      {...(props as React.ComponentProps<"div">)}
    >
      {asChild ? children : <button type={type}>{children}</button>}
    </LiquidGlass>
  )
}

export { GlassButton, glassButtonVariants, type GlassButtonProps }
