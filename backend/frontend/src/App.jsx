import React, { useState } from "react";
import { createLink, listLinks, getLink } from "./api.js";

export default function App() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [key, setKey] = useState("");
  const [authorizedKey, setAuthorizedKey] = useState("");
  const [links, setLinks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  async function shorten(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);
    try {
      setResult(await createLink(url.trim()));
      setMessage("Your short link is ready to share.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setMessage("Link copied to clipboard.");
    } catch {
      setError("Copy is unavailable. Select and copy the short link manually.");
    }
  }

  function lock() {
    setKey("");
    setAuthorizedKey("");
    setLinks([]);
    setSelected(null);
    setAdminError("");
  }

  async function loadLinks(event) {
    event?.preventDefault();
    const token = authorizedKey || key;
    setAdminBusy(true);
    setAdminError("");
    setSelected(null);
    try {
      setLinks(await listLinks(token));
      setAuthorizedKey(token);
      setKey("");
    } catch (error) {
      setLinks([]);
      setAuthorizedKey("");
      setKey("");
      setAdminError(error.message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function showDetails(code) {
    setAdminBusy(true);
    setAdminError("");
    try {
      setSelected(await getLink(code, authorizedKey));
    } catch (error) {
      setSelected(null);
      if (error.status === 401 || error.status === 503) lock();
      setAdminError(error.message);
    } finally {
      setAdminBusy(false);
    }
  }

  return (
    <div className="shell">
      <header>
        <a className="brand" href="/" aria-label="CodeAlpha home">
          <span className="brand-icon" aria-hidden="true">
            ↗
          </span>
          CodeAlpha<span className="brand-sub"> / links</span>
        </a>
        <span className="badge">Small links. Clear purpose.</span>
      </header>
      <main>
        <section className="intro">
          <p className="eyebrow">THE SHORTER WAY TO SHARE</p>
          <h1>
            Long address.
            <br />
            <span>Short conversation.</span>
          </h1>
          <p className="description">
            Turn a lengthy web address into a simple link. Paste it, shorten it,
            and share what matters.
          </p>
        </section>
        <section className="card" aria-labelledby="create-title">
          <div className="card-heading">
            <span className="step">01</span>
            <div>
              <h2 id="create-title">Make a short link</h2>
              <p>Start with an HTTP or HTTPS address.</p>
            </div>
          </div>
          <form onSubmit={shorten}>
            <label htmlFor="url">Your destination URL</label>
            <div className="input-row">
              <input
                id="url"
                type="url"
                required
                maxLength={2048}
                placeholder="https://example.com/something-worth-sharing"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={busy}
              />
              <button disabled={busy}>
                {busy ? "Creating…" : "Shorten link ↗"}
              </button>
            </div>
          </form>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="notice success" role="status">
              {message}
            </p>
          )}
          {result && (
            <div className="result">
              <span className="eyebrow">YOUR SHORT LINK</span>
              <a
                className="short-link"
                href={result.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {result.shortUrl}
              </a>
              <div className="result-actions">
                <button className="secondary" type="button" onClick={copy}>
                  Copy link
                </button>
                <a
                  className="button secondary"
                  href={result.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open link ↗
                </a>
              </div>
              <p className="destination">Destination: {result.originalUrl}</p>
            </div>
          )}
          <p className="hint">
            Share the short link with anyone who should visit your destination.
            Treat it as a public link.
          </p>
        </section>
        <section className="features" aria-label="How it works">
          <div>
            <span>01 / PASTE</span>
            <p>A destination worth sharing.</p>
          </div>
          <div>
            <span>02 / SHORTEN</span>
            <p>A small link, ready in a moment.</p>
          </div>
          <div>
            <span>03 / SHARE</span>
            <p>One click takes visitors there.</p>
          </div>
        </section>
        <section className="admin card" aria-labelledby="admin-title">
          <div className="admin-heading">
            <div>
              <p className="eyebrow">RESTRICTED ACCESS</p>
              <h2 id="admin-title">Link administration</h2>
            </div>
            <button
              type="button"
              className="secondary"
              disabled={adminBusy}
              aria-expanded={adminOpen}
              onClick={() => {
                if (adminOpen) lock();
                setAdminOpen(!adminOpen);
              }}
            >
              {adminOpen ? "Close" : "Unlock statistics"}
            </button>
          </div>
          {adminOpen && (
            <div className="admin-content">
              <p className="hint">
                An administrator key is required to view destinations and click
                counts. It stays in memory until you lock, close, or reload this
                page.
              </p>
              {!authorizedKey ? (
                <form onSubmit={loadLinks}>
                  <label htmlFor="admin-key">Administrator key</label>
                  <div className="input-row">
                    <input
                      id="admin-key"
                      type="password"
                      autoComplete="off"
                      required
                      value={key}
                      onChange={(event) => setKey(event.target.value)}
                    />
                    <button disabled={adminBusy}>
                      {adminBusy ? "Checking…" : "Unlock"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="result-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={adminBusy}
                      onClick={() => loadLinks()}
                    >
                      Refresh statistics
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={lock}
                      disabled={adminBusy}
                    >
                      Lock
                    </button>
                  </div>
                  <p role="status">
                    {links.length} saved {links.length === 1 ? "link" : "links"}
                    {adminBusy ? " · Loading…" : ""}
                  </p>
                  <div className="table-wrap">
                    <table>
                      <caption className="sr-only">
                        Stored links and redirect request counts
                      </caption>
                      <thead>
                        <tr>
                          <th>Code / destination</th>
                          <th>Clicks</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {links.map((link) => (
                          <tr key={link.shortCode}>
                            <td>
                              <strong>{link.shortCode}</strong>
                              <span className="table-url">
                                {link.originalUrl}
                              </span>
                            </td>
                            <td>{link.clicks}</td>
                            <td>
                              <button
                                type="button"
                                className="secondary"
                                disabled={adminBusy}
                                onClick={() => showDetails(link.shortCode)}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selected && (
                    <div className="detail" aria-live="polite">
                      <h3>Link details · {selected.shortCode}</h3>
                      <p className="destination">{selected.originalUrl}</p>
                      <p>
                        Created: {new Date(selected.createdAt).toLocaleString()}
                      </p>
                      <p>
                        Redirect requests: <strong>{selected.clicks}</strong>
                      </p>
                    </div>
                  )}
                </>
              )}
              {adminError && (
                <p className="notice error" role="alert">
                  {adminError}
                </p>
              )}
            </div>
          )}
        </section>
      </main>
      <footer>
        <span>CodeAlpha URL Shortener</span>
        <span>Built to keep sharing simple.</span>
      </footer>
    </div>
  );
}
