import { forwardRef } from "react";
import styles from "./Button.module.scss";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  size?: "default" | "large";
  variant?: "primary" | "secondary";
  className?: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      size = "default",
      variant = "primary",
      className = "",
      ...props
    },
    ref
  ) => {
    const classNames = [
      styles.button,
      size === "large" && styles.large,
      variant === "secondary" && styles.secondary,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button ref={ref} className={classNames} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
