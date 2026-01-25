import { useState, useRef, useLayoutEffect } from "react";
import { Palette, X, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import type { InstanceColor } from "../../types";
import { INSTANCE_COLORS, getColorConfig } from "../../lib/instanceColors";

interface InstanceColorPickerProps {
  /** Current color value */
  value: InstanceColor;
  /** Callback when color changes */
  onChange: (color: InstanceColor) => Promise<void> | void;
  /** Disable the picker */
  disabled?: boolean;
  /** Show as small inline picker */
  variant?: "dropdown" | "inline";
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  right: number;
}

/**
 * Color picker for instance/namespace visual organization
 * Displays 27 colors in a 6x5 grid organized by hue family
 */
export function InstanceColorPicker({
  value,
  onChange,
  disabled = false,
  variant = "dropdown",
}: InstanceColorPickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate fixed position for dropdown based on button position and available space
  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom;
      const dropdownHeight = 200; // Approximate height including "Remove color" button

      // Calculate right position (align right edge of dropdown with right edge of button)
      const rightPos = viewportWidth - rect.right;

      // Open above if not enough space below (with some margin)
      if (spaceBelow < dropdownHeight + 10) {
        setPosition({
          bottom: viewportHeight - rect.top + 4,
          right: rightPos,
        });
      } else {
        setPosition({
          top: rect.bottom + 4,
          right: rightPos,
        });
      }
    } else {
      setPosition(null);
    }
  }, [isOpen]);

  const handleColorSelect = async (color: InstanceColor): Promise<void> => {
    setLoading(true);
    try {
      await onChange(color);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const currentColor = getColorConfig(value);

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {INSTANCE_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => void handleColorSelect(color.value)}
            disabled={disabled || loading}
            className={`w-5 h-5 rounded-full transition-all ${color.bgClass} ${
              value === color.value
                ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                : "hover:scale-110"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            title={color.label}
            aria-label={`Set color to ${color.label}`}
          />
        ))}
        {value && (
          <button
            onClick={() => void handleColorSelect(null)}
            disabled={disabled || loading}
            className={`w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center hover:border-destructive hover:text-destructive transition-colors ${
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
            title="Remove color"
            aria-label="Remove color"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  // Dropdown variant
  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={disabled || loading}
        className="h-8 w-8 p-0"
        title={currentColor ? `Color: ${currentColor.label}` : "Set color"}
        aria-label={currentColor ? `Color: ${currentColor.label}` : "Set color"}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : currentColor ? (
          <div className={`w-4 h-4 rounded-full ${currentColor.bgClass}`} />
        ) : (
          <Palette className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />

          {/* Dropdown - uses fixed positioning to escape overflow containers */}
          {position && (
            <div
              className="fixed z-50 bg-popover border rounded-lg shadow-lg p-3"
              style={{
                top:
                  position.top !== undefined
                    ? `${String(position.top)}px`
                    : undefined,
                bottom:
                  position.bottom !== undefined
                    ? `${String(position.bottom)}px`
                    : undefined,
                right: `${String(position.right)}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-6 gap-1.5">
                {INSTANCE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => void handleColorSelect(color.value)}
                    disabled={loading}
                    className={`w-6 h-6 rounded-full transition-all ${color.bgClass} ${
                      value === color.value
                        ? "ring-2 ring-offset-1 ring-offset-background ring-primary"
                        : "hover:scale-110"
                    }`}
                    title={color.label}
                    aria-label={`Set color to ${color.label}`}
                  />
                ))}
              </div>
              {value && (
                <button
                  type="button"
                  onClick={() => void handleColorSelect(null)}
                  disabled={loading}
                  className="w-full mt-2 pt-2 border-t text-xs text-muted-foreground hover:text-destructive flex items-center justify-center gap-1 py-1"
                >
                  <X className="h-3 w-3" />
                  Remove color
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
