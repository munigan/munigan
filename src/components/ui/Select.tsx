"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useId,
  type ReactNode,
} from "react";
import { Select as Primitive } from "@base-ui/react/select";
import { classes } from "./classes";
import "./select.css";

type OptionProps = {
  value: string | number;
  children: ReactNode;
  disabled?: boolean;
  description?: string;
  icon?: ReactNode;
  label?: string;
};

export function SelectOption({
  value,
  children,
  disabled,
  description,
  icon,
  label,
}: OptionProps) {
  const descriptionId = useId();
  return (
    <Primitive.Item
      value={String(value)}
      disabled={disabled}
      label={label}
      aria-label={label}
      data-select-value={String(value)}
      className="app-select-option"
      aria-describedby={description ? descriptionId : undefined}
    >
      {icon && (
        <span className="app-select-option-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="app-select-option-content">
        <Primitive.ItemText>{children}</Primitive.ItemText>
        {description && (
          <span id={descriptionId} className="app-select-description">
            {description}
          </span>
        )}
      </span>
      <Primitive.ItemIndicator className="app-select-check">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m5 12 4 4L19 6" />
        </svg>
      </Primitive.ItemIndicator>
    </Primitive.Item>
  );
}

// Register labels synchronously so the trigger renders correctly before the popup opens.
function collectItems(
  children: ReactNode,
): { value: string; label: ReactNode }[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionProps>(child)) return [];
    if (child.type === Fragment) return collectItems(child.props.children);
    if (!Object.hasOwn(child.props, "value")) return [];
    const { icon, children: label } = child.props;
    return [
      {
        value: String(child.props.value),
        label: icon ? (
          <span className="app-select-label">
            <span className="app-select-option-icon" aria-hidden="true">
              {icon}
            </span>
            {label}
          </span>
        ) : (
          label
        ),
      },
    ];
  });
}

type SelectProps = Omit<
  Primitive.Trigger.Props,
  "children" | "value" | "defaultValue" | "onChange" | "className"
> & {
  children: ReactNode;
  value: string | number;
  onValueChange: (value: string) => void;
  className?: string;
  size?: "default" | "small";
  name?: string;
  required?: boolean;
};

/** Shared single-select: compose SelectOption children, including conditional and mapped options. */
export function Select({
  children,
  value,
  onValueChange,
  className,
  id,
  name,
  required,
  size = "default",
  disabled,
  ...props
}: SelectProps) {
  return (
    <Primitive.Root
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      items={collectItems(children)}
      value={String(value)}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
    >
      <Primitive.Trigger
        {...props}
        className={classes("app-select-trigger", className)}
        data-size={size}
        data-select-trigger
        data-select-value={String(value)}
      >
        <Primitive.Value className="app-select-value" />
        <Primitive.Icon className="app-select-chevron">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Positioner
          sideOffset={6}
          align="start"
          alignItemWithTrigger={false}
          collisionPadding={12}
          className="app-select-positioner"
        >
          <Primitive.Popup className="app-select-popup">
            <Primitive.List className="app-select-list">
              {children}
            </Primitive.List>
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
