import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Footer.css";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";

function Footer() {
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicSiteContent(controller.signal)
      .then((content) => {
        setSiteContent(content);
      })
      .catch(() => {
        // Keep fallback content when content API is unavailable.
      });

    return () => controller.abort();
  }, []);

  const brand = siteContent.brand;
  const sections = siteContent.footer.sections || [];
  const paymentBadges = (siteContent.footer.paymentBadges || []).filter(Boolean);
  const footerUi = siteContent.footer.ui || {};
  const copyright = (footerUi.copyrightTemplate || "© {year} {brand}. All rights reserved.")
    .replace("{year}", String(new Date().getFullYear()))
    .replace("{brand}", brand.name || "MYSHOP");

  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <section className="footer-section">
          <h3>{brand.name}</h3>
          <p className="footer-text">{brand.tagline}</p>
          <p className="footer-meta">{brand.supportEmail}</p>
          <p className="footer-meta">{brand.supportHours}</p>
        </section>

        {sections.map((section) => (
          <section className="footer-section" key={section.id}>
            <h3>{section.title}</h3>
            <ul className="footer-links">
              {(section.links || []).map((item) => (
                <li key={item.id}>
                  {item.type === "external" ? (
                    <a href={item.to}>{item.label}</a>
                  ) : (
                    <Link to={item.to}>{item.label}</Link>
                  )}
                </li>
              ))}
            </ul>
            {section.id === "customer-care" && paymentBadges.length > 0 && (
              <div className="payment-badges">
                {paymentBadges.map((badge) => (
                  <span key={badge}>{badge}</span>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="footer-bottom">
        <p>{copyright}</p>
      </div>
    </footer>
  );
}

export default Footer;
