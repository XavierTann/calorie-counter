import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Makan Log",
    short_name: "Makan Log",
    description: "Calorie counter for hawker food and home cooking",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f3ef",
    theme_color: "#f4f3ef",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
