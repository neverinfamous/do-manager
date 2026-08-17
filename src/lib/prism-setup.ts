import Prism from "prismjs";

// Make Prism available globally so that components like prism-sql can find it when bundled by Vite
if (typeof window !== "undefined") {
  (window as any).Prism = Prism;
}

export default Prism;
