import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  dotColor?: string;
  icon?: React.ReactNode;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
  menuAlign?: "left" | "right";
  disabled?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  size = "xs",
  className,
  menuAlign = "left",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuMinWidth = 135;
    const menuWidth = Math.max(rect.width, menuMinWidth);

    let left = menuAlign === "right" ? rect.right - menuWidth : rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (left < 8) left = 8;

    const estimatedHeight = options.length * 36 + 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    let top = rect.bottom + 4;
    if (spaceBelow < estimatedHeight && rect.top > estimatedHeight) {
      top = rect.top - estimatedHeight - 4;
    }

    setMenuStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      minWidth: `${menuWidth}px`,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, options.length, menuAlign]);

  const sizeClasses = {
    xs: "h-6 px-2 text-[11px] gap-1.5 rounded-md",
    sm: "h-7 px-2.5 text-xs gap-2 rounded-lg",
    md: "h-8 px-3 text-xs gap-2.5 rounded-xl",
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center justify-between font-medium transition-all select-none",
          "bg-background/80 hover:bg-muted/80 text-foreground border border-border/50",
          "shadow-2xs hover:shadow-xs active:scale-[0.98] focus:outline-hidden",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          sizeClasses[size],
          className
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground transition-transform duration-150 shrink-0",
            isOpen && "rotate-180 text-foreground"
          )}
        />
      </button>

      {/* Floating Portal Menu attached to document.body */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className={cn(
              "p-1",
              "bg-popover/98 text-popover-foreground backdrop-blur-md",
              "border border-border/80 rounded-xl shadow-xl shadow-black/15",
              "animate-in fade-in zoom-in-95 duration-100 origin-top"
            )}
          >
            <div className="space-y-0.5">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left",
                      isSelected
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted/70"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {option.dotColor && (
                        <span
                          className={cn(
                            "size-1.5 rounded-full shrink-0",
                            option.dotColor
                          )}
                        />
                      )}
                      {option.icon && (
                        <span className="shrink-0">{option.icon}</span>
                      )}
                      <span className="truncate">{option.label}</span>
                    </div>

                    {isSelected && (
                      <Check className="size-3 text-primary shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default CustomDropdown;
