"use client";

import { useEffect, useRef, useState } from "react";

interface ConfirmButtonProps {
  onConfirm: () => void;
  /** Rendered in the resting state. */
  children: React.ReactNode;
  /** Replaces the label once armed. Keep it short — it has to fit the same button. */
  confirmLabel?: string;
  className?: string;
  armedClassName?: string;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
}

/**
 * A destructive action that asks twice, in the page rather than in a
 * `window.confirm`. The native dialog is unstyled, sits outside the app's
 * visual language, blocks the whole tab, and cannot be driven by anything
 * automated — a browser test just answers "cancel" and the action silently
 * never happens.
 *
 * The first click arms the button and the second one commits. Clicking
 * anywhere else disarms it, so a button left armed by accident cannot fire
 * later by mistake. There is deliberately no timeout: a countdown only races
 * whoever is still reading the label, and the outside-click rule already
 * covers walking away.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Confirmar?",
  className = "",
  armedClassName = "",
  disabled,
  title,
  "aria-label": ariaLabel,
}: ConfirmButtonProps) {
  const [isArmed, setIsArmed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isArmed) return;

    const disarmOnOutsideClick = (event: MouseEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) setIsArmed(false);
    };

    document.addEventListener("click", disarmOnOutsideClick);
    return () => document.removeEventListener("click", disarmOnOutsideClick);
  }, [isArmed]);

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      onClick={() => {
        if (isArmed) {
          setIsArmed(false);
          onConfirm();
          return;
        }
        setIsArmed(true);
      }}
      className={`${className} ${isArmed ? armedClassName : ""}`}
    >
      {isArmed ? confirmLabel : children}
    </button>
  );
}
