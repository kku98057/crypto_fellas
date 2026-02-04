import styles from "./footer.module.scss";
export default function Footer() {
  const sns = [
    {
      name: "x",
      src: `${import.meta.env.BASE_URL}image/icons/x.png`,
      link: "https://x.com/MimboNode",
    },
    {
      name: "telegram",
      src: `${import.meta.env.BASE_URL}/image/icons/telegram.png`,
      link: "https://t.me/MimboNode_Announce",
    },
    {
      name: "linktree",
      src: `${import.meta.env.BASE_URL}/image/icons/linktree.png`,
      link: "https://linktr.ee/mimbonode",
    },
    {
      name: "medium",
      src: `${import.meta.env.BASE_URL}/image/icons/medium.png`,
      link: "https://mimbonode.medium.com/",
    },
    {
      name: "mimbo node",
      src: `${import.meta.env.BASE_URL}/image/icons/mimbo.png`,
      link: "https://iq.wiki/kr/wiki/mimbo-node",
    },
  ];
  return (
    <footer className={styles.footer_wrapper}>
      <div className={styles.footer_container}>
        <div className={styles.footer_left}>
          <div className={styles.footer_logo}>
            <img
              src={`${import.meta.env.BASE_URL}image/logo_footer.png`}
              alt="logo"
            />
          </div>
          <a href="mailto:contact@mimbonode.io">contact@mimbonode.io</a>
        </div>
        <ul className={styles.sns}>
          {sns.map((item) => (
            <li key={item.name}>
              <a href={item.link} target="_blank">
                <img src={item.src} alt={item.name} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
