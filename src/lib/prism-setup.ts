import Prism from "prismjs";

declare global {
  interface Window {
    Prism: typeof Prism;
  }
}

// Make Prism available globally so that components like prism-sql can find it when bundled by Vite
if (typeof window !== "undefined") {
  window.Prism = Prism;
}

export default Prism;
