// Renders a public static HTML file full-bleed via iframe.
export function StaticHtmlFrame({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
        background: "#fcf1f5",
      }}
    />
  );
}
