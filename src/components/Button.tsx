import styles from "./Button.module.scss";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  size?: "default" | "large";
  variant?: "primary" | "secondary";
  className?: string;
  href?: string;
  target?: string;
}

const Button = ({
  children,
  size = "default",
  variant = "primary",
  className = "",
  href,
  target,
  ...props
}: ButtonProps) => {
  const classNames = [
    styles.button,
    size === "large" && styles.large,
    variant === "secondary" && styles.secondary,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // href가 있으면 <a> 태그로 렌더링
  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        className={classNames}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classNames} {...props}>
      {children}
    </button>
  );
};

export default Button;
