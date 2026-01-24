import { useState, useEffect, useCallback } from "react";
import Button from "./Button";
import styles from "./header.module.scss";

const Header = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [isScrolled, setIsScrolled] = useState(() => {
    // 모바일이 아닐 때만 스크롤 상태 체크
    return window.innerWidth > 768 && window.scrollY > 0;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const handleScroll = useCallback(() => {
    // 768px 초과일 때만 스크롤 상태 업데이트
    if (window.innerWidth > 768) {
      setIsScrolled(window.scrollY > 0);
    } else {
      setIsScrolled(false); // 모바일에서는 스크롤 스타일 적용 안함
    }
  }, []);

  const handleResize = useCallback(() => {
    const mobile = window.innerWidth <= 768;
    setIsMobile(mobile);
    if (mobile) {
      setIsScrolled(false); // 모바일에서는 스크롤 스타일 적용 안함
    } else {
      setIsScrolled(window.scrollY > 0);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [handleScroll, handleResize]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className={styles.header_wrapper}>
      <div
        className={`${styles.header_container} ${
          !isMobile && isScrolled ? styles.scrolled : ""
        } ${isMobile && isMobileMenuOpen ? styles.menu_expanded : ""}`}
      >
        {/* Top Bar - Logo and Hamburger */}
        <div className={styles.header_top}>
          {/* Logo Section */}
          <div className={styles.logo_section}>
            <img
              src={`${import.meta.env.BASE_URL}image/logo.png`}
              alt="Crypto Fellas Logo"
              className={styles.logo_icon}
              loading="eager"
            />
          </div>

          {/* Desktop Navigation Menu */}
          {!isMobile && (
            <nav className={styles.nav_menu} aria-label="Main navigation">
              <a href="#token" className={styles.nav_link}>
                TOKEN
              </a>
              <a href="#ecosystem" className={styles.nav_link}>
                ECOSYSTEM
              </a>
              <a href="#vision" className={styles.nav_link}>
                VISION
              </a>
            </nav>
          )}

          {/* Desktop Action Section */}
          {!isMobile && (
            <div className={styles.action_section}>
              {isScrolled ? (
                <div className={styles.single_button}>
                  <Button size="large">
                    <a href="https://www.mggarena.com" target="_blank">
                      <span>PLAY NOW</span>
                    </a>
                  </Button>
                </div>
              ) : (
                <div className={styles.button_group}>
                  <Button>
                    <a href="https://www.mggarena.com" target="_blank">
                      <img
                        src={`${import.meta.env.BASE_URL}image/mega_arena.png`}
                        alt="MGG ARENA"
                      />
                    </a>
                  </Button>
                  <Button>
                    <a href="https://mining.mimbonode.io/login" target="_blank">
                      <img
                        src={`${import.meta.env.BASE_URL}image/mimbo.png`}
                        alt="MIMBO NODE"
                      />
                    </a>
                  </Button>
                  <Button>
                    <a href="https://www.fellascard.com/login" target="_blank">
                      <img
                        src={`${import.meta.env.BASE_URL}image/fellascard.png`}
                        alt="FELLAS CARD"
                      />
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Mobile Hamburger Button */}
          {isMobile && (
            <button
              className={`${styles.menu_button} ${
                isMobileMenuOpen ? styles.menu_button_open : ""
              }`}
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          )}
        </div>

        {/* Mobile Expanded Menu */}
        {isMobile && (
          <div className={styles.mobile_menu_content}>
            {/* Navigation Links */}
            <nav
              className={styles.mobile_nav_menu}
              aria-label="Main navigation"
            >
              <a
                href="#token"
                className={styles.mobile_nav_link}
                onClick={toggleMobileMenu}
              >
                TOKEN
              </a>
              <a
                href="#ecosystem"
                className={styles.mobile_nav_link}
                onClick={toggleMobileMenu}
              >
                ECOSYSTEM
              </a>
              <a
                href="#vision"
                className={styles.mobile_nav_link}
                onClick={toggleMobileMenu}
              >
                VISION
              </a>
            </nav>

            {/* Action Buttons */}
            <div className={styles.mobile_button_group}>
              <Button>
                <a href="https://www.mggarena.com" target="_blank">
                  <img
                    src={`${import.meta.env.BASE_URL}image/mega_arena.png`}
                    alt="MGG ARENA"
                  />
                </a>
              </Button>
              <Button>
                <a href="https://mining.mimbonode.io/login" target="_blank">
                  <img
                    src={`${import.meta.env.BASE_URL}image/mimbo.png`}
                    alt="MIMBO NODE"
                  />
                </a>
              </Button>
              <Button>
                <a href="https://www.fellascard.com/login" target="_blank">
                  <img
                    src={`${import.meta.env.BASE_URL}image/fellascard.png`}
                    alt="FELLAS CARD"
                  />
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
