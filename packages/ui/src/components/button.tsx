import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { LoaderCircle } from "lucide-react"

import { cn } from "#lib/utils"

/**
 * shadcn Button, restyled for the poll UI.
 * Same API as shadcn (variant, size, asChild), plus `loading`.
 * The added `ink` and `soft` variants are for use on a tone card.
 */
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-full font-semibold select-none",
    "transition-[transform,background-color,color,opacity] duration-150 ease-out-strong",
    "active:scale-[.97] motion-reduce:transition-none motion-reduce:active:scale-100",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  ],
  {
    variants: {
      variant: {
        /** Burning Flame pill for the main action on the dark ground, such as the create button. */
        default:
          "bg-primary text-primary-foreground font-bold hover:bg-primary/90",
        /** Abyssal pill on a tone card, such as the vote button. */
        ink: "bg-ink text-foreground font-bold hover:bg-ink/90 focus-visible:outline-on-tone",
        /** Translucent ink on a tone card. */
        soft: "bg-ink/14 text-on-tone hover:bg-ink/22 focus-visible:outline-on-tone",
        /** Hairline pill on a tone card (Share). */
        "tone-outline": "border-[1.5px] border-on-tone/35 bg-transparent text-on-tone hover:bg-ink/8 focus-visible:outline-on-tone",
        /** Hairline pill on the dark ground (New poll). */
        outline: "border-[1.5px] border-border bg-transparent text-foreground hover:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-ink hover:bg-destructive/90",
        link: "rounded-none text-foreground underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        default: "h-12 px-5 text-[15px]",
        lg: "h-16 px-8 text-[17px]",
        xl: "h-[72px] px-10 text-lg",
        icon: "size-12",
        "icon-sm": "size-10",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner, keeps the button's width, and disables it. */
    loading?: boolean
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-loading={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {/* Children stay in the layout (invisible) so the width never jumps. */}
          <span className={cn("inline-flex items-center gap-2.5", loading && "invisible")}>{children}</span>
          {loading && (
            <span className="absolute inset-0 grid place-items-center" aria-hidden>
              <LoaderCircle className="animate-spin motion-reduce:animate-none" />
            </span>
          )}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
