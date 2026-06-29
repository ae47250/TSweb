"use client";

export default function Error({ error, reset }) {
  return (
    <main>
      <section className="card">
        <h1>Something went wrong</h1>
        <p className="text-muted">{error?.message || "The app hit an unexpected error."}</p>
        <button className="btn-primary" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
